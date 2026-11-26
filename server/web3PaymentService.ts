import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Express, Request } from 'express';
import { formatUnits, getAddress, isAddress } from 'viem';
import {
  registerNotificationHubRoutes,
  sendPlatformEmail,
  triggerAutomatedEventNotifications,
} from './notificationHub.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =========================================================================
// Firebase Config Loader (Zero Private Keys — Public Project Metadata Only)
// =========================================================================

interface FirebaseAppletConfig {
  projectId: string;
  firestoreDatabaseId?: string;
}

function loadFirebaseAppletConfig(): FirebaseAppletConfig {
  const cfgPath = path.resolve(__dirname, '..', 'firebase-applet-config.json');
  const raw = fs.readFileSync(cfgPath, 'utf-8');
  return JSON.parse(raw) as FirebaseAppletConfig;
}

const FIREBASE_CFG = loadFirebaseAppletConfig();
const PROJECT_ID = FIREBASE_CFG.projectId;
const DATABASE_ID = FIREBASE_CFG.firestoreDatabaseId || '(default)';
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
  PROJECT_ID
)}/databases/${encodeURIComponent(DATABASE_ID)}`;
const DOCS_PREFIX = `projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

// Server-only ephemeral HMAC secret for 2FA OTP hashing & short-lived withdrawal tokens
const OTP_HMAC_SECRET =
  process.env.WEB3_OTP_SECRET?.trim() || crypto.randomBytes(32).toString('hex');

// =========================================================================
// Hardcoded Official EVM Chains & Official USDT Token Contracts
// (Strictly allowlisted RPC endpoints — prevents SSRF & spoofed token attacks)
// =========================================================================

type Web3ChainKey = 'BEP20' | 'POLYGON';

interface OfficialChainSpec {
  key: Web3ChainKey;
  paymentMethodId: string;
  chainId: number;
  label: string;
  usdtContract: string;
  usdtDecimals: number;
  explorerTxBaseUrl: string;
  rpcUrls: readonly string[];
}

const ERC20_TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const OFFICIAL_CHAINS: Record<Web3ChainKey, OfficialChainSpec> = {
  BEP20: {
    key: 'BEP20',
    paymentMethodId: 'USDT_BEP20',
    chainId: 56,
    label: 'BNB Smart Chain (BEP-20 USDT)',
    usdtContract: '0x55d398326f99059ff775485246999027b3197955',
    usdtDecimals: 18,
    explorerTxBaseUrl: 'https://bscscan.com/tx/',
    rpcUrls: [
      'https://bsc-dataseed.binance.org',
      'https://bsc-dataseed1.defibit.io',
      'https://bsc-dataseed1.ninicoin.io',
      'https://bsc-rpc.publicnode.com',
    ],
  },
  POLYGON: {
    key: 'POLYGON',
    paymentMethodId: 'USDT_POLYGON',
    chainId: 137,
    label: 'Polygon PoS (USDT)',
    usdtContract: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
    usdtDecimals: 6,
    explorerTxBaseUrl: 'https://polygonscan.com/tx/',
    rpcUrls: [
      'https://polygon-bor-rpc.publicnode.com',
      'https://polygon-rpc.com',
      'https://1rpc.io/matic',
    ],
  },
};

// =========================================================================
// Firebase Auth RS256 ID Token Verifier (Zero IAM required)
// =========================================================================

interface VerifiedCaller {
  uid: string;
  email: string;
  idToken: string;
}

let cachedCerts: Record<string, string> | null = null;
let certsExpiresAtMs = 0;

async function getFirebasePublicCerts(): Promise<Record<string, string>> {
  if (cachedCerts && Date.now() < certsExpiresAtMs) {
    return cachedCerts;
  }
  const res = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
    { signal: AbortSignal.timeout(6000) }
  );
  if (!res.ok) {
    throw Object.assign(new Error('Failed to load Firebase Auth verification certificates.'), {
      statusCode: 503,
    });
  }
  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const ttlMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 30 * 60 * 1000;
  cachedCerts = (await res.json()) as Record<string, string>;
  certsExpiresAtMs = Date.now() + Math.max(60_000, ttlMs - 60_000);
  return cachedCerts;
}

function decodeBase64UrlJson<T>(segment: string): T {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  const buf = Buffer.from(padded, 'base64');
  return JSON.parse(buf.toString('utf-8')) as T;
}

async function verifyFirebaseBearerToken(req: Request): Promise<VerifiedCaller> {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    throw Object.assign(new Error('Missing or invalid Authorization Bearer token.'), {
      statusCode: 401,
    });
  }
  const idToken = authHeader.slice(7).trim();
  const segments = idToken.split('.');
  if (segments.length !== 3) {
    throw Object.assign(new Error('Malformed Firebase authentication token.'), {
      statusCode: 401,
    });
  }

  const [headerB64, payloadB64, sigB64] = segments;
  let header: { alg?: string; kid?: string };
  let payload: {
    aud?: string;
    iss?: string;
    sub?: string;
    exp?: number;
    iat?: number;
    email?: string;
    email_verified?: boolean;
  };
  try {
    header = decodeBase64UrlJson(headerB64);
    payload = decodeBase64UrlJson(payloadB64);
  } catch {
    throw Object.assign(new Error('Unable to decode Firebase authentication token.'), {
      statusCode: 401,
    });
  }

  if (header.alg !== 'RS256' || !header.kid) {
    throw Object.assign(new Error('Unsupported authentication token algorithm.'), {
      statusCode: 401,
    });
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const expectedIssuer = `https://securetoken.google.com/${PROJECT_ID}`;
  if (
    payload.aud !== PROJECT_ID ||
    payload.iss !== expectedIssuer ||
    !payload.sub ||
    typeof payload.exp !== 'number' ||
    payload.exp <= nowSec ||
    typeof payload.iat !== 'number' ||
    payload.iat > nowSec + 300
  ) {
    throw Object.assign(new Error('Authentication token expired or invalid for this project.'), {
      statusCode: 401,
    });
  }

  if (payload.email_verified !== true || !payload.email) {
    throw Object.assign(
      new Error('Verified email authentication is required for crypto payment operations.'),
      { statusCode: 403 }
    );
  }

  const certs = await getFirebasePublicCerts();
  const cert = certs[header.kid];
  if (!cert) {
    // Force refresh once in case of key rotation
    cachedCerts = null;
    const freshCerts = await getFirebasePublicCerts();
    const freshCert = freshCerts[header.kid];
    if (!freshCert) {
      throw Object.assign(new Error('Authentication token signing key not recognized.'), {
        statusCode: 401,
      });
    }
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    const sigBuf = Buffer.from(sigB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    if (!verifier.verify(freshCert, sigBuf)) {
      throw Object.assign(new Error('Invalid authentication token signature.'), { statusCode: 401 });
    }
  } else {
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    const sigBuf = Buffer.from(sigB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    if (!verifier.verify(cert, sigBuf)) {
      throw Object.assign(new Error('Invalid authentication token signature.'), { statusCode: 401 });
    }
  }

  return {
    uid: payload.sub,
    email: String(payload.email),
    idToken,
  };
}

// =========================================================================
// Firestore REST v1 Client (Evaluates firestore.rules with Caller's Verified JWT)
// =========================================================================

type FirestoreRestValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { timestampValue: string }
  | { arrayValue: { values?: FirestoreRestValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreRestValue> } };

function toFsValue(val: unknown): FirestoreRestValue {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map((v) => toFsValue(v)) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, FirestoreRestValue> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) fields[k] = toFsValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function fromFsValue(val: FirestoreRestValue | undefined): unknown {
  if (!val) return undefined;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('nullValue' in val) return null;
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map((v) => fromFsValue(v));
  }
  if ('mapValue' in val) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      out[k] = fromFsValue(v);
    }
    return out;
  }
  return undefined;
}

function fromFsDoc(docJson: { fields?: Record<string, FirestoreRestValue> }): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(docJson.fields || {})) {
    out[k] = fromFsValue(v);
  }
  return out;
}

function toFsFields(obj: Record<string, unknown>): Record<string, FirestoreRestValue> {
  const fields: Record<string, FirestoreRestValue> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) fields[k] = toFsValue(v);
  }
  return fields;
}

async function fsGetDoc(
  idToken: string,
  relPath: string,
  transaction?: string
): Promise<Record<string, unknown> | null> {
  const qs = transaction ? `?transaction=${encodeURIComponent(transaction)}` : '';
  const url = `${FIRESTORE_BASE_URL}/documents/${relPath}${qs}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw Object.assign(
      new Error(`Database read failed (${res.status}): ${text.slice(0, 220)}`),
      { statusCode: res.status === 403 ? 403 : 502 }
    );
  }
  const json = (await res.json()) as { fields?: Record<string, FirestoreRestValue> };
  return fromFsDoc(json);
}

async function fsBeginTransaction(idToken: string): Promise<string> {
  const res = await fetch(`${FIRESTORE_BASE_URL}/documents:beginTransaction`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ options: { readWrite: {} } }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw Object.assign(
      new Error(`Unable to start atomic database transaction: ${text.slice(0, 200)}`),
      { statusCode: 502 }
    );
  }
  const json = (await res.json()) as { transaction?: string };
  if (!json.transaction) {
    throw Object.assign(new Error('Database transaction handle missing.'), { statusCode: 502 });
  }
  return json.transaction;
}

async function fsRollbackTransaction(idToken: string, transaction: string): Promise<void> {
  await fetch(`${FIRESTORE_BASE_URL}/documents:rollback`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ transaction }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => {});
}

async function fsCommitTransaction(
  idToken: string,
  transaction: string,
  writes: unknown[]
): Promise<void> {
  const res = await fetch(`${FIRESTORE_BASE_URL}/documents:commit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ transaction, writes }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 409 || text.includes('ALREADY_EXISTS')) {
      throw Object.assign(
        new Error('This transaction hash has already been verified and credited.'),
        { statusCode: 409, code: 'TX_ALREADY_CREDITED' }
      );
    }
    throw Object.assign(
      new Error(`Atomic ledger commit failed (${res.status}): ${text.slice(0, 280)}`),
      { statusCode: res.status === 403 ? 403 : 502 }
    );
  }
}

function buildCreateWrite(
  relPath: string,
  data: Record<string, unknown>,
  serverTimeFields: string[]
) {
  return {
    update: {
      name: `${DOCS_PREFIX}/${relPath}`,
      fields: toFsFields(data),
    },
    currentDocument: { exists: false },
    updateTransforms: serverTimeFields.map((fieldPath) => ({
      fieldPath,
      setToServerValue: 'REQUEST_TIME',
    })),
  };
}

function buildUpdateWrite(
  relPath: string,
  data: Record<string, unknown>,
  serverTimeFields: string[]
) {
  const maskFields = [...Object.keys(data)];
  return {
    update: {
      name: `${DOCS_PREFIX}/${relPath}`,
      fields: toFsFields(data),
    },
    updateMask: {
      fieldPaths: maskFields,
    },
    currentDocument: { exists: true },
    updateTransforms: serverTimeFields.map((fieldPath) => ({
      fieldPath,
      setToServerValue: 'REQUEST_TIME',
    })),
  };
}

function buildUpsertWrite(
  relPath: string,
  data: Record<string, unknown>,
  serverTimeFields: string[]
) {
  return {
    update: {
      name: `${DOCS_PREFIX}/${relPath}`,
      fields: toFsFields(data),
    },
    updateTransforms: serverTimeFields.map((fieldPath) => ({
      fieldPath,
      setToServerValue: 'REQUEST_TIME',
    })),
  };
}

function buildDeleteWrite(relPath: string) {
  return {
    delete: `${DOCS_PREFIX}/${relPath}`,
  };
}

async function fsQuerySubcollectionByUid(
  idToken: string,
  parentRelPath: string,
  collectionId: string,
  uid: string
): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
  const url = `${FIRESTORE_BASE_URL}/documents/${parentRelPath}:runQuery`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'uid' },
            op: 'EQUAL',
            value: { stringValue: uid },
          },
        },
        limit: 100,
      },
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw Object.assign(
      new Error(`Database query failed (${res.status}): ${text.slice(0, 220)}`),
      { statusCode: res.status === 403 ? 403 : 502 }
    );
  }
  const rows = (await res.json()) as Array<{
    document?: { name?: string; fields?: Record<string, FirestoreRestValue> };
  }>;
  const out: Array<{ id: string; data: Record<string, unknown> }> = [];
  for (const row of rows) {
    if (!row.document?.name) continue;
    const parts = row.document.name.split('/');
    const id = parts[parts.length - 1] || '';
    if (!id) continue;
    out.push({ id, data: fromFsDoc(row.document) });
  }
  return out;
}

async function fsQueryRootCollectionByUid(
  idToken: string,
  collectionId: string,
  uid: string
): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
  const url = `${FIRESTORE_BASE_URL}/documents:runQuery`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'uid' },
            op: 'EQUAL',
            value: { stringValue: uid },
          },
        },
        limit: 100,
      },
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw Object.assign(
      new Error(`Database query failed (${res.status}): ${text.slice(0, 220)}`),
      { statusCode: res.status === 403 ? 403 : 502 }
    );
  }
  const rows = (await res.json()) as Array<{
    document?: { name?: string; fields?: Record<string, FirestoreRestValue> };
  }>;
  const out: Array<{ id: string; data: Record<string, unknown> }> = [];
  for (const row of rows) {
    if (!row.document?.name) continue;
    const parts = row.document.name.split('/');
    const id = parts[parts.length - 1] || '';
    if (!id) continue;
    out.push({ id, data: fromFsDoc(row.document) });
  }
  return out;
}

function normalizePromoCode(raw: unknown): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 24);
}

interface ValidatedPromoResult {
  code: string;
  title: string;
  description: string;
  type: 'withdrawal_fee_waiver' | 'withdrawal_fee_discount' | 'deposit_bonus_usd' | 'milestone_bonus_usd';
  discountPercent: number;
  bonusUsd: number;
  minAmountUsd: number;
  currentUses: number;
  maxTotalUses: number;
  maxUsesPerUser: number;
}

async function validatePromoForCaller(params: {
  caller: VerifiedCaller;
  rawCode: string;
  context: 'withdrawal' | 'bonus';
  amountUsd?: number;
  txHandle?: string;
}): Promise<ValidatedPromoResult> {
  const code = normalizePromoCode(params.rawCode);
  if (!/^[A-Z0-9_-]{3,24}$/.test(code)) {
    throw Object.assign(new Error('Invalid promo code format. Use 3-24 letters or numbers.'), {
      statusCode: 400,
    });
  }

  const promoDoc = await fsGetDoc(params.caller.idToken, `promoCodes/${code}`, params.txHandle);
  if (!promoDoc) {
    throw Object.assign(new Error(`Promo code "${code}" does not exist.`), { statusCode: 404 });
  }
  if (promoDoc.active !== true) {
    throw Object.assign(new Error(`Promo code "${code}" is currently inactive.`), { statusCode: 400 });
  }
  const expiresAtMs = Number(promoDoc.expiresAtMs || 0);
  if (expiresAtMs > 0 && Date.now() > expiresAtMs) {
    throw Object.assign(new Error(`Promo code "${code}" has expired.`), { statusCode: 400 });
  }

  const currentUses = Math.max(0, Math.round(Number(promoDoc.currentUses || 0)));
  const maxTotalUses = Math.max(1, Math.round(Number(promoDoc.maxTotalUses || 1)));
  if (currentUses >= maxTotalUses) {
    throw Object.assign(new Error(`Promo code "${code}" has reached its global redemption limit.`), {
      statusCode: 400,
    });
  }

  const maxUsesPerUser = Math.max(1, Math.round(Number(promoDoc.maxUsesPerUser || 1)));
  const userRedemptions = await fsQueryRootCollectionByUid(
    params.caller.idToken,
    'promoRedemptions',
    params.caller.uid
  );
  const userUsesForCode = userRedemptions.filter(
    (r) => String(r.data.code || '').toUpperCase() === code
  ).length;
  if (userUsesForCode >= maxUsesPerUser) {
    throw Object.assign(
      new Error(`You have already redeemed promo code "${code}" (${userUsesForCode}/${maxUsesPerUser}).`),
      { statusCode: 400 }
    );
  }

  const type = String(promoDoc.type || '') as ValidatedPromoResult['type'];
  if (params.context === 'withdrawal') {
    if (type !== 'withdrawal_fee_waiver' && type !== 'withdrawal_fee_discount') {
      throw Object.assign(
        new Error(`Code "${code}" is a bonus voucher, not a withdrawal fee voucher. Redeem it in Investor Tools -> Vouchers.`),
        { statusCode: 400 }
      );
    }
  } else {
    if (type !== 'deposit_bonus_usd' && type !== 'milestone_bonus_usd') {
      throw Object.assign(
        new Error(`Code "${code}" is a withdrawal fee-waiver voucher. Apply it inside Withdrawal Management.`),
        { statusCode: 400 }
      );
    }
  }

  const minAmountUsd = Math.max(0, Number(promoDoc.minAmountUsd || 0));
  if (
    params.context === 'withdrawal' &&
    typeof params.amountUsd === 'number' &&
    params.amountUsd < minAmountUsd
  ) {
    throw Object.assign(
      new Error(`Promo code "${code}" requires a minimum withdrawal of $${minAmountUsd.toFixed(2)}.`),
      { statusCode: 400 }
    );
  }

  return {
    code,
    title: String(promoDoc.title || code),
    description: String(promoDoc.description || ''),
    type,
    discountPercent: Math.max(0, Math.min(100, Number(promoDoc.discountPercent || 0))),
    bonusUsd: Math.max(0, Math.min(10000, Number(promoDoc.bonusUsd || 0))),
    minAmountUsd,
    currentUses,
    maxTotalUses,
    maxUsesPerUser,
  };
}

type WhitelistUsdtNetwork = 'BEP20' | 'POLYGON' | 'TRC20' | 'ERC20';

function normalizeWhitelistNetwork(raw: string): WhitelistUsdtNetwork | null {
  const clean = String(raw || '').trim().toUpperCase();
  if (clean === 'BEP20' || clean === 'USDT_BEP20') return 'BEP20';
  if (clean === 'POLYGON' || clean === 'USDT_POLYGON') return 'POLYGON';
  if (clean === 'TRC20' || clean === 'USDT_TRC20') return 'TRC20';
  if (clean === 'ERC20' || clean === 'USDT_ERC20') return 'ERC20';
  return null;
}

function validateAndNormalizeUsdtAddress(
  network: WhitelistUsdtNetwork,
  rawAddress: string
): string {
  const clean = String(rawAddress || '').trim();
  if (network === 'BEP20' || network === 'POLYGON' || network === 'ERC20') {
    if (!isAddress(clean)) {
      throw Object.assign(
        new Error(`${network} USDT requires a valid 42-character 0x... EVM wallet address.`),
        { statusCode: 400 }
      );
    }
    return getAddress(clean);
  }
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(clean)) {
    throw Object.assign(
      new Error('TRC-20 USDT requires a valid 34-character Tron wallet address starting with T.'),
      { statusCode: 400 }
    );
  }
  return clean;
}

function formatLockRemainingShort(unlockAtMs: number): string {
  const diff = Math.max(0, unlockAtMs - Date.now());
  const hrs = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.ceil((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${Math.max(1, mins)}m`;
}

function addressesEqualForNetwork(
  network: WhitelistUsdtNetwork | null,
  a: string,
  b: string
): boolean {
  const ca = a.trim();
  const cb = b.trim();
  if (!ca || !cb) return false;
  if (network === 'TRC20') return ca === cb;
  return ca.toLowerCase() === cb.toLowerCase();
}

async function checkWithdrawalWhitelistPolicy(params: {
  caller: VerifiedCaller;
  userDoc: Record<string, unknown>;
  withdrawalNetwork: string;
  destinationAddress: string;
}): Promise<void> {
  const { caller, userDoc, withdrawalNetwork, destinationAddress } = params;
  const strictEnabled = userDoc.whitelistStrictMode === true;
  const normalizedNet = normalizeWhitelistNetwork(withdrawalNetwork);

  const wallets = await fsQuerySubcollectionByUid(
    caller.idToken,
    `users/${caller.uid}`,
    'whitelistedWallets',
    caller.uid
  );

  const nowMs = Date.now();
  const matchingWallet = wallets.find((w) => {
    const wNet = normalizeWhitelistNetwork(String(w.data.network || ''));
    const wAddr = String(w.data.address || '');
    if (normalizedNet && wNet && wNet !== normalizedNet) return false;
    return addressesEqualForNetwork(normalizedNet || wNet, wAddr, destinationAddress);
  });

  if (matchingWallet) {
    const unlockAtMs = Number(matchingWallet.data.unlockAtMs || 0);
    if (unlockAtMs > nowMs) {
      const remaining = formatLockRemainingShort(unlockAtMs);
      const unlockIso = new Date(unlockAtMs).toISOString();
      throw Object.assign(
        new Error(
          `24-Hour Security Lock active for "${String(
            matchingWallet.data.label || 'Whitelisted Wallet'
          )}". Withdrawals to this address unlock in ${remaining} (${unlockIso.slice(0, 16).replace('T', ' ')} UTC).`
        ),
        { statusCode: 403, code: 'WHITELIST_24H_LOCK_ACTIVE' }
      );
    }
    return;
  }

  if (strictEnabled) {
    throw Object.assign(
      new Error(
        'Strict Withdrawal Whitelist Lock is enabled. Add and verify this destination address via Email OTP under Security & Whitelist before withdrawing.'
      ),
      { statusCode: 403, code: 'WHITELIST_ADDRESS_REQUIRED' }
    );
  }
}

const whitelistOtpRateLimit = new Map<string, number>();
const whitelistOtpAttempts = new Map<string, { attempts: number; expMs: number }>();
const consumedWhitelistChallenges = new Map<string, number>();

function pruneWhitelistOtpMaps(nowMs: number): void {
  for (const [k, exp] of consumedWhitelistChallenges.entries()) {
    if (exp <= nowMs) consumedWhitelistChallenges.delete(k);
  }
  for (const [k, rec] of whitelistOtpAttempts.entries()) {
    if (rec.expMs <= nowMs) whitelistOtpAttempts.delete(k);
  }
}

function makeServerDocId(prefix: string): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
}

const SUPER_ADMIN_PRIMARY_EMAIL = 'shakiljr323@gmail.com';

async function verifySuperAdminCaller(caller: VerifiedCaller): Promise<void> {
  if (caller.email.toLowerCase() === SUPER_ADMIN_PRIMARY_EMAIL) {
    return;
  }
  const adminDoc = await fsGetDoc(caller.idToken, `admins/${caller.uid}`).catch(() => null);
  if (!adminDoc) {
    throw Object.assign(
      new Error('Super Admin authorization is required to manage email API settings.'),
      { statusCode: 403, code: 'FORBIDDEN_ADMIN_ONLY' }
    );
  }
}

// =========================================================================
// EVM JSON-RPC Verifier (Strict Official RPC Pool)
// =========================================================================

interface EthReceiptLog {
  address?: string;
  topics?: string[];
  data?: string;
}

interface EthTransactionReceipt {
  status?: string;
  blockNumber?: string;
  from?: string;
  to?: string;
  transactionHash?: string;
  logs?: EthReceiptLog[];
}

async function callEvmRpc<T>(
  chain: OfficialChainSpec,
  method: string,
  params: unknown[]
): Promise<T> {
  let lastErr: Error | null = null;
  for (const rpcUrl of chain.rpcUrls) {
    try {
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: AbortSignal.timeout(7000),
      });
      if (!res.ok) {
        lastErr = new Error(`RPC ${rpcUrl} returned HTTP ${res.status}`);
        continue;
      }
      const payload = (await res.json()) as {
        result?: T;
        error?: { code?: number; message?: string };
      };
      if (payload.error) {
        lastErr = new Error(payload.error.message || 'RPC error');
        continue;
      }
      return payload.result as T;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw Object.assign(
    new Error(
      `Unable to reach ${chain.label} RPC nodes right now (${lastErr?.message || 'network timeout'}). Please retry in a few seconds.`
    ),
    { statusCode: 503, code: 'RPC_UNAVAILABLE' }
  );
}

function parseHexToNumber(hex: string | undefined): number {
  if (!hex || typeof hex !== 'string') return 0;
  return Number.parseInt(hex, 16) || 0;
}

function extractAddressFromTopic(topic: string | undefined): string | null {
  if (!topic || !/^0x[a-fA-F0-9]{64}$/.test(topic)) return null;
  const candidate = `0x${topic.slice(26)}`;
  return isAddress(candidate) ? getAddress(candidate) : null;
}

// =========================================================================
// Server-Side 2FA Email OTP Store (HMAC-SHA256 Hashed, Bound to Withdrawal)
// =========================================================================

interface PendingOtpRecord {
  uid: string;
  email: string;
  otpHash: string;
  bindingHash: string;
  expiresAtMs: number;
  createdAtMs: number;
  attempts: number;
}

interface ConsumedTokenRecord {
  expiresAtMs: number;
}

const pendingOtps = new Map<string, PendingOtpRecord>();
const usedOtpTokens = new Map<string, ConsumedTokenRecord>();

function computeHmac(input: string): string {
  return crypto.createHmac('sha256', OTP_HMAC_SECRET).update(input).digest('hex');
}

function buildWithdrawalBindingHash(params: {
  uid: string;
  amountUsd: number;
  network: string;
  destinationAddress: string;
}): string {
  const normalized = [
    params.uid,
    Number(params.amountUsd).toFixed(2),
    params.network.trim().toUpperCase(),
    params.destinationAddress.trim().toLowerCase(),
  ].join('|');
  return computeHmac(`wd_bind:${normalized}`);
}

function signWithdrawalAuthToken(params: {
  uid: string;
  bindingHash: string;
  expMs: number;
  nonce: string;
}): string {
  const payloadStr = Buffer.from(
    JSON.stringify({
      uid: params.uid,
      b: params.bindingHash,
      exp: params.expMs,
      n: params.nonce,
    })
  ).toString('base64url');
  const sig = computeHmac(`wd_tok:${payloadStr}`);
  return `${payloadStr}.${sig}`;
}

function verifyAndConsumeWithdrawalAuthToken(
  token: string,
  expectedUid: string,
  expectedBindingHash: string
): boolean {
  const now = Date.now();
  for (const [k, v] of usedOtpTokens.entries()) {
    if (v.expiresAtMs < now) usedOtpTokens.delete(k);
  }
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return false;
  const [payloadStr, sig] = parts;
  const expectedSig = computeHmac(`wd_tok:${payloadStr}`);
  const a = Buffer.from(sig, 'utf-8');
  const b = Buffer.from(expectedSig, 'utf-8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  try {
    const parsed = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf-8')) as {
      uid?: string;
      b?: string;
      exp?: number;
      n?: string;
    };
    if (
      parsed.uid !== expectedUid ||
      parsed.b !== expectedBindingHash ||
      typeof parsed.exp !== 'number' ||
      parsed.exp < now ||
      !parsed.n
    ) {
      return false;
    }
    if (usedOtpTokens.has(parsed.n)) return false;
    usedOtpTokens.set(parsed.n, { expiresAtMs: parsed.exp });
    return true;
  } catch {
    return false;
  }
}

async function trySendEmailOtpViaResend(params: {
  toEmail: string;
  code: string;
  amountUsd: number;
  network: string;
  destinationAddress: string;
}): Promise<boolean> {
  const result = await sendPlatformEmail({
    toEmail: params.toEmail,
    subject: `AlphaTradex Withdrawal 2FA Code: ${params.code}`,
    text: [
      `Your AlphaTradex withdrawal security verification code is: ${params.code}`,
      ``,
      `Amount: $${params.amountUsd.toFixed(2)} USD`,
      `Network: ${params.network}`,
      `Destination: ${params.destinationAddress}`,
      ``,
      `This code expires in 5 minutes. Never share this code with anyone.`,
    ].join('\n'),
  });
  return result.ok;
}

// =========================================================================
// Express Route Registration
// =========================================================================

export function registerWeb3PaymentRoutes(app: Express): void {
  // 1. Server-Side On-Chain Web3 USDT Auto-Deposit Verification & Atomic Credit
  app.post('/api/web3/verify-deposit', async (req, res) => {
    try {
      const caller = await verifyFirebaseBearerToken(req);
      const body = (req.body || {}) as { network?: string; txHash?: string };

      const rawNetwork = String(body.network || '').toUpperCase().trim();
      if (rawNetwork !== 'BEP20' && rawNetwork !== 'POLYGON') {
        res.status(400).json({
          error: 'Unsupported Web3 auto-deposit network. Choose BEP20 (BSC) or POLYGON.',
          code: 'INVALID_NETWORK',
        });
        return;
      }
      const chainKey = rawNetwork as Web3ChainKey;
      const chain = OFFICIAL_CHAINS[chainKey];

      const rawHash = String(body.txHash || '').trim();
      if (!/^0x[a-fA-F0-9]{64}$/.test(rawHash)) {
        res.status(400).json({
          error: 'Invalid transaction hash format. Must be a 66-character 0x EVM txHash.',
          code: 'INVALID_TX_HASH',
        });
        return;
      }
      const normalizedTxHash = rawHash.toLowerCase();
      const txKey = `${chainKey}_${normalizedTxHash}`;

      // Step 1: Read authoritative config/platform directly from Firestore (never trust client config)
      const platformCfg = (await fsGetDoc(caller.idToken, 'config/platform')) || {};
      const web3Cfg = (platformCfg.web3PaymentConfig || {}) as Record<string, unknown>;
      const depositWallets = (platformCfg.depositWallets || {}) as Record<string, unknown>;
      const kycSettings = (platformCfg.kycSettings || {}) as Record<string, unknown>;

      if (platformCfg.globalPaused === true || platformCfg.depositsPaused === true) {
        res.status(403).json({
          error: 'Deposits are currently paused by platform administration.',
          code: 'DEPOSITS_PAUSED',
        });
        return;
      }

      if (web3Cfg.autoDepositEnabled === false) {
        res.status(403).json({
          error: 'Instant Web3 Auto-Deposit is currently disabled by administration.',
          code: 'AUTO_DEPOSIT_DISABLED',
        });
        return;
      }

      if (chainKey === 'BEP20' && web3Cfg.bep20Enabled === false) {
        res.status(403).json({
          error: 'BNB Smart Chain (BEP-20) Web3 auto-deposits are currently disabled.',
          code: 'CHAIN_DISABLED',
        });
        return;
      }
      if (chainKey === 'POLYGON' && web3Cfg.polygonEnabled === false) {
        res.status(403).json({
          error: 'Polygon PoS Web3 auto-deposits are currently disabled.',
          code: 'CHAIN_DISABLED',
        });
        return;
      }

      const rawAdminReceiving =
        chainKey === 'BEP20'
          ? String(web3Cfg.bep20ReceivingAddress || depositWallets.usdtErc20 || '').trim()
          : String(web3Cfg.polygonReceivingAddress || depositWallets.usdtErc20 || '').trim();

      if (!rawAdminReceiving || !isAddress(rawAdminReceiving)) {
        res.status(503).json({
          error: `Official ${chain.label} receiving wallet address is not configured yet. Contact Super Admin.`,
          code: 'ADMIN_WALLET_UNCONFIGURED',
        });
        return;
      }
      const officialAdminAddress = getAddress(rawAdminReceiving);

      const minConfirmations = Math.max(
        1,
        Math.min(
          60,
          Number(
            chainKey === 'BEP20'
              ? web3Cfg.minConfirmationsBsc ?? 3
              : web3Cfg.minConfirmationsPolygon ?? 5
          ) || (chainKey === 'BEP20' ? 3 : 5)
        )
      );
      const minDepositUsd = Math.max(1, Number(web3Cfg.minDepositUsd ?? 10) || 10);
      const maxDepositUsd = Math.max(minDepositUsd, Number(web3Cfg.maxDepositUsd ?? 50000) || 50000);

      // Step 2: Early idempotency check on unique txKey document
      try {
        const existingTxDoc = await fsGetDoc(caller.idToken, `web3VerifiedTxs/${txKey}`);
        if (existingTxDoc) {
          res.status(409).json({
            error: 'This transaction hash has already been verified and credited.',
            code: 'TX_ALREADY_CREDITED',
            depositId: existingTxDoc.depositId || '',
            amountUsd: Number(existingTxDoc.amountUsd || 0),
          });
          return;
        }
      } catch (preCheckErr) {
        const status = (preCheckErr as { statusCode?: number })?.statusCode;
        if (status === 403) {
          res.status(409).json({
            error: 'This transaction hash has already been verified and credited to an account.',
            code: 'TX_ALREADY_CREDITED',
          });
          return;
        }
        throw preCheckErr;
      }

      // Step 3: On-chain verification via official Mainnet JSON-RPC
      const [receipt, latestBlockHex] = await Promise.all([
        callEvmRpc<EthTransactionReceipt | null>(chain, 'eth_getTransactionReceipt', [
          normalizedTxHash,
        ]),
        callEvmRpc<string>(chain, 'eth_blockNumber', []),
      ]);

      if (!receipt) {
        res.status(202).json({
          status: 'pending_mining',
          confirmations: 0,
          requiredConfirmations: minConfirmations,
          txHash: normalizedTxHash,
          network: chainKey,
          explorerUrl: `${chain.explorerTxBaseUrl}${normalizedTxHash}`,
          message: `Transaction broadcast detected on ${chain.label}. Waiting for first block inclusion...`,
        });
        return;
      }

      if (String(receipt.status || '').toLowerCase() !== '0x1') {
        res.status(400).json({
          error: 'On-chain transaction failed or reverted (receipt status is not success).',
          code: 'TX_FAILED_ONCHAIN',
          explorerUrl: `${chain.explorerTxBaseUrl}${normalizedTxHash}`,
        });
        return;
      }

      const receiptBlock = parseHexToNumber(receipt.blockNumber);
      const latestBlock = parseHexToNumber(latestBlockHex);
      const confirmations =
        receiptBlock > 0 && latestBlock >= receiptBlock ? latestBlock - receiptBlock + 1 : 1;

      // Step 4: Strictly verify official USDT smart contract + exact Admin recipient address
      const logs = Array.isArray(receipt.logs) ? receipt.logs : [];
      let totalTransferRaw = 0n;
      let matchedSenderAddress = '';
      let sawOfficialContractTransfer = false;

      for (const log of logs) {
        const contractAddr = String(log.address || '').toLowerCase();
        if (contractAddr !== chain.usdtContract.toLowerCase()) continue;

        const topics = Array.isArray(log.topics) ? log.topics : [];
        if (topics.length < 3) continue;
        if (String(topics[0] || '').toLowerCase() !== ERC20_TRANSFER_TOPIC) continue;

        sawOfficialContractTransfer = true;
        const fromAddr = extractAddressFromTopic(topics[1]);
        const toAddr = extractAddressFromTopic(topics[2]);
        if (!toAddr || toAddr.toLowerCase() !== officialAdminAddress.toLowerCase()) {
          continue;
        }

        const rawData = String(log.data || '0x0');
        if (!/^0x[a-fA-F0-9]+$/.test(rawData)) continue;
        const transferValue = BigInt(rawData);
        if (transferValue > 0n) {
          totalTransferRaw += transferValue;
          if (!matchedSenderAddress && fromAddr) {
            matchedSenderAddress = fromAddr;
          }
        }
      }

      if (totalTransferRaw <= 0n) {
        const detail = sawOfficialContractTransfer
          ? `Recipient address in this USDT transfer does not match the official AlphaTradex receiving wallet (${officialAdminAddress}).`
          : `No official USDT (${chain.usdtContract}) Transfer event found in this transaction. Fake or non-USDT tokens are strictly rejected.`;
        res.status(400).json({
          error: detail,
          code: sawOfficialContractTransfer ? 'RECIPIENT_MISMATCH' : 'INVALID_TOKEN_CONTRACT',
          expectedContract: getAddress(chain.usdtContract),
          expectedRecipient: officialAdminAddress,
        });
        return;
      }

      const formattedUnits = formatUnits(totalTransferRaw, chain.usdtDecimals);
      const verifiedAmountUsd = Number(Number(formattedUnits).toFixed(2));

      if (!Number.isFinite(verifiedAmountUsd) || verifiedAmountUsd <= 0) {
        res.status(400).json({
          error: 'Verified on-chain USDT transfer amount is too small to credit.',
          code: 'AMOUNT_TOO_SMALL',
        });
        return;
      }

      if (verifiedAmountUsd < minDepositUsd) {
        res.status(400).json({
          error: `On-chain USDT amount ($${verifiedAmountUsd.toFixed(
            2
          )}) is below the minimum auto-deposit limit ($${minDepositUsd.toFixed(2)}).`,
          code: 'BELOW_MIN_DEPOSIT',
          verifiedAmountUsd,
        });
        return;
      }

      if (verifiedAmountUsd > maxDepositUsd) {
        res.status(400).json({
          error: `On-chain USDT amount ($${verifiedAmountUsd.toFixed(
            2
          )}) exceeds the maximum single auto-deposit limit ($${maxDepositUsd.toFixed(
            2
          )}). Contact Super Admin for manual clearance.`,
          code: 'ABOVE_MAX_DEPOSIT',
          verifiedAmountUsd,
        });
        return;
      }

      if (confirmations < minConfirmations) {
        res.status(202).json({
          status: 'confirming',
          confirmations,
          requiredConfirmations: minConfirmations,
          verifiedAmountUsd,
          fromAddress: matchedSenderAddress || receipt.from || '',
          toAddress: officialAdminAddress,
          tokenContract: getAddress(chain.usdtContract),
          blockNumber: receiptBlock,
          txHash: normalizedTxHash,
          network: chainKey,
          explorerUrl: `${chain.explorerTxBaseUrl}${normalizedTxHash}`,
          message: `Confirmed on-chain ($${verifiedAmountUsd.toFixed(
            2
          )} USDT). Waiting for ${confirmations}/${minConfirmations} block confirmations...`,
        });
        return;
      }

      // Step 5: Atomic Firestore Transaction (Unique txKey lock + Balance Credit + Deposit + WalletTransaction + AuditLog)
      const txHandle = await fsBeginTransaction(caller.idToken);
      try {
        const userDoc = await fsGetDoc(caller.idToken, `users/${caller.uid}`, txHandle);
        if (!userDoc) {
          await fsRollbackTransaction(caller.idToken, txHandle);
          res.status(404).json({ error: 'User vault profile not found.' });
          return;
        }
        if (userDoc.suspended === true) {
          await fsRollbackTransaction(caller.idToken, txHandle);
          res.status(403).json({
            error: `Account suspended: ${String(userDoc.suspensionReason || 'Contact compliance support.')}`,
          });
          return;
        }
        if (kycSettings.requireKycForDeposits === true && userDoc.kycStatus !== 'approved') {
          await fsRollbackTransaction(caller.idToken, txHandle);
          res.status(403).json({
            error: 'Approved KYC verification is required before deposits can be credited.',
          });
          return;
        }

        const currentUsdBalance = Number(userDoc.usdBalance || 0);
        const nextUsdBalance = Number((currentUsdBalance + verifiedAmountUsd).toFixed(2));
        const userName = String(userDoc.fullName || caller.email).slice(0, 120);
        const senderAddr =
          matchedSenderAddress && isAddress(matchedSenderAddress)
            ? getAddress(matchedSenderAddress)
            : receipt.from && isAddress(receipt.from)
            ? getAddress(receipt.from)
            : '0x0000000000000000000000000000000000000000';

        const depId = makeServerDocId('depw3');
        const wtId = makeServerDocId('wtx');
        const audId = makeServerDocId('aud');
        const nowIso = new Date().toISOString();

        const writes = [
          // 1. Unique Idempotency Lock (exists: false precondition prevents double-credit race conditions)
          buildCreateWrite(
            `web3VerifiedTxs/${txKey}`,
            {
              txKey,
              txHash: normalizedTxHash,
              network: chainKey,
              chainId: chain.chainId,
              uid: caller.uid,
              userEmail: caller.email,
              fromAddress: senderAddr,
              toAddress: officialAdminAddress,
              tokenContract: getAddress(chain.usdtContract),
              amountUsd: verifiedAmountUsd,
              confirmations,
              blockNumber: receiptBlock,
              depositId: depId,
              verifiedAtIso: nowIso,
            },
            ['createdAt']
          ),
          // 2. Credit verified USDT amount to User's Deposit Wallet
          buildUpdateWrite(
            `users/${caller.uid}`,
            {
              usdBalance: nextUsdBalance,
            },
            ['updatedAt']
          ),
          // 3. Approved CryptoDeposit record bound atomically to web3VerifiedTxs/{txKey}
          buildCreateWrite(
            `cryptoDeposits/${depId}`,
            {
              uid: caller.uid,
              userEmail: caller.email,
              userName,
              network: chain.paymentMethodId,
              walletAddress: officialAdminAddress,
              amountUsd: verifiedAmountUsd,
              txId: normalizedTxHash,
              status: 'approved',
              adminNote: `Auto-Verified On-Chain (${chain.label} · ${confirmations} confs · Block #${receiptBlock})`,
              verificationSource: 'web3_auto',
              web3TxKey: txKey,
              confirmations,
              tokenContract: getAddress(chain.usdtContract),
              senderAddress: senderAddr,
            },
            ['createdAt', 'updatedAt']
          ),
          // 4. Immutable WalletTransactions Ledger Entry
          buildCreateWrite(
            `walletTransactions/${wtId}`,
            {
              uid: caller.uid,
              userEmail: caller.email,
              userName,
              type: 'web3_auto_deposit',
              wallet: 'deposit_wallet',
              direction: 'credit',
              amountUsd: verifiedAmountUsd,
              feeUsd: 0,
              netAmountUsd: verifiedAmountUsd,
              network: chain.paymentMethodId,
              txHash: normalizedTxHash,
              referenceId: depId,
              status: 'confirmed',
              details: `Verified ${chain.label} USDT deposit from ${senderAddr} (${confirmations} confirmations, Block #${receiptBlock})`,
            },
            ['createdAt']
          ),
          // 5. Immutable Security AuditLogs Entry
          buildCreateWrite(
            `auditLogs/${audId}`,
            {
              actorUid: caller.uid,
              actorEmail: caller.email,
              actorRole: 'system_web3_verifier',
              eventType: 'WEB3_AUTO_DEPOSIT_CREDITED',
              targetUid: caller.uid,
              network: chain.paymentMethodId,
              txHash: normalizedTxHash,
              amountUsd: verifiedAmountUsd,
              details: `Server RPC verified ${verifiedAmountUsd.toFixed(
                2
              )} USDT on ${chain.label} (${confirmations} confs, contract ${getAddress(
                chain.usdtContract
              )}) -> ${officialAdminAddress}`,
            },
            ['createdAt']
          ),
        ];

        await fsCommitTransaction(caller.idToken, txHandle, writes);

        // Non-blocking automated deposit receipt email + Telegram Admin Bot alert
        void triggerAutomatedEventNotifications({
          eventType: 'deposit_confirmed',
          userEmail: caller.email,
          userName: String(userDoc.fullName || caller.email),
          amountUsd: verifiedAmountUsd,
          network: chain.label,
          txHash: normalizedTxHash,
          sourceLabel: 'Web3 Auto-Deposit (On-Chain Verified)',
        });

        res.json({
          status: 'credited',
          depositId: depId,
          walletTransactionId: wtId,
          auditLogId: audId,
          verifiedAmountUsd,
          newDepositBalance: nextUsdBalance,
          confirmations,
          requiredConfirmations: minConfirmations,
          blockNumber: receiptBlock,
          fromAddress: senderAddr,
          toAddress: officialAdminAddress,
          tokenContract: getAddress(chain.usdtContract),
          txHash: normalizedTxHash,
          network: chainKey,
          explorerUrl: `${chain.explorerTxBaseUrl}${normalizedTxHash}`,
          message: `$${verifiedAmountUsd.toFixed(
            2
          )} USDT verified on ${chain.label} (${confirmations} confirmations) and credited to your Deposit Wallet.`,
        });
      } catch (txErr) {
        await fsRollbackTransaction(caller.idToken, txHandle);
        throw txErr;
      }
    } catch (err) {
      const e = err as Error & { statusCode?: number; code?: string };
      res.status(e.statusCode || 500).json({
        error: e.message || 'Web3 deposit verification failed.',
        code: e.code || 'WEB3_VERIFY_ERROR',
      });
    }
  });

  // 2. Request 2FA Email OTP for Safe Withdrawal Submission
  app.post('/api/withdrawals/otp/request', async (req, res) => {
    try {
      const caller = await verifyFirebaseBearerToken(req);
      const body = (req.body || {}) as {
        amountUsd?: number;
        network?: string;
        destinationAddress?: string;
      };

      const amountUsd = Number(body.amountUsd);
      const network = String(body.network || '').trim().slice(0, 64);
      const destinationAddress = String(body.destinationAddress || '').trim().slice(0, 160);

      if (!Number.isFinite(amountUsd) || amountUsd <= 0 || !network || !destinationAddress) {
        res.status(400).json({
          error: 'Enter valid withdrawal amount, network, and destination wallet before requesting 2FA OTP.',
        });
        return;
      }

      // Enforce server-side Withdrawal Address Whitelist & 24h security lock before dispatching OTP
      const userDoc = await fsGetDoc(caller.idToken, `users/${caller.uid}`);
      if (userDoc) {
        await checkWithdrawalWhitelistPolicy({
          caller,
          userDoc,
          withdrawalNetwork: network,
          destinationAddress,
        });
      }

      const existing = pendingOtps.get(caller.uid);
      const now = Date.now();
      if (existing && now - existing.createdAtMs < 25_000) {
        const waitSec = Math.ceil((25_000 - (now - existing.createdAtMs)) / 1000);
        res.status(429).json({
          error: `Please wait ${waitSec}s before requesting another 2FA verification code.`,
          code: 'OTP_RATE_LIMITED',
        });
        return;
      }

      const code = String(crypto.randomInt(100000, 999999));
      const bindingHash = buildWithdrawalBindingHash({
        uid: caller.uid,
        amountUsd,
        network,
        destinationAddress,
      });

      pendingOtps.set(caller.uid, {
        uid: caller.uid,
        email: caller.email,
        otpHash: computeHmac(`otp:${caller.uid}:${code}`),
        bindingHash,
        expiresAtMs: now + 5 * 60 * 1000,
        createdAtMs: now,
        attempts: 0,
      });

      const sentByEmail = await trySendEmailOtpViaResend({
        toEmail: caller.email,
        code,
        amountUsd,
        network,
        destinationAddress,
      });

      res.json({
        ok: true,
        emailMasked: caller.email.replace(/(^.).*(@.*$)/, '$1***$2'),
        expiresInSeconds: 300,
        deliveryMode: sentByEmail ? 'email_sent' : 'security_inbox_preview',
        ...(sentByEmail ? {} : { previewCode: code }),
        message: sentByEmail
          ? `6-digit security OTP dispatched to ${caller.email}.`
          : `6-digit 2FA verification code generated for ${caller.email} (valid 5 min). Configure RESEND_API_KEY in Secrets to also deliver via external email.`,
      });
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      res.status(e.statusCode || 500).json({
        error: e.message || 'Unable to generate 2FA verification code.',
      });
    }
  });

  // 3. Verify 2FA Email OTP -> Issues Single-Use Withdrawal Authorization Token
  app.post('/api/withdrawals/otp/verify', async (req, res) => {
    try {
      const caller = await verifyFirebaseBearerToken(req);
      const body = (req.body || {}) as {
        code?: string;
        amountUsd?: number;
        network?: string;
        destinationAddress?: string;
      };

      const code = String(body.code || '').replace(/\D/g, '').slice(0, 6);
      const amountUsd = Number(body.amountUsd);
      const network = String(body.network || '').trim().slice(0, 64);
      const destinationAddress = String(body.destinationAddress || '').trim().slice(0, 160);

      if (code.length !== 6) {
        res.status(400).json({ error: 'Enter the 6-digit numeric 2FA verification code.' });
        return;
      }

      const record = pendingOtps.get(caller.uid);
      if (!record) {
        res.status(400).json({
          error: 'No active 2FA code found. Please request a fresh verification code.',
        });
        return;
      }

      if (Date.now() > record.expiresAtMs) {
        pendingOtps.delete(caller.uid);
        res.status(400).json({
          error: '2FA verification code has expired. Please request a new code.',
        });
        return;
      }

      if (record.attempts >= 5) {
        pendingOtps.delete(caller.uid);
        res.status(429).json({
          error: 'Too many invalid 2FA attempts. Please request a new code.',
        });
        return;
      }

      const bindingHash = buildWithdrawalBindingHash({
        uid: caller.uid,
        amountUsd,
        network,
        destinationAddress,
      });

      if (bindingHash !== record.bindingHash) {
        res.status(400).json({
          error:
            'Withdrawal amount, network, or destination address changed after requesting OTP. Please request a new code.',
        });
        return;
      }

      const candidateHash = computeHmac(`otp:${caller.uid}:${code}`);
      const a = Buffer.from(candidateHash, 'utf-8');
      const b = Buffer.from(record.otpHash, 'utf-8');
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        record.attempts += 1;
        res.status(400).json({
          error: `Incorrect 2FA code (${5 - record.attempts} attempts remaining).`,
        });
        return;
      }

      pendingOtps.delete(caller.uid);
      const expMs = Date.now() + 5 * 60 * 1000;
      const otpVerificationToken = signWithdrawalAuthToken({
        uid: caller.uid,
        bindingHash,
        expMs,
        nonce: crypto.randomBytes(12).toString('hex'),
      });

      res.json({
        ok: true,
        verified: true,
        otpVerificationToken,
        expiresAtIso: new Date(expMs).toISOString(),
      });
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      res.status(e.statusCode || 500).json({
        error: e.message || 'Unable to verify 2FA code.',
      });
    }
  });

  // 4. Server-Validated Safe Withdrawal Submission (Atomic Hold + Pending Admin Approval Only)
  app.post('/api/withdrawals/submit', async (req, res) => {
    try {
      const caller = await verifyFirebaseBearerToken(req);
      const body = (req.body || {}) as {
        amountUsd?: number;
        network?: string;
        destinationAddress?: string;
        source?: string;
        otpVerificationToken?: string;
        promoCode?: string;
      };

      const amountUsd = Number(Number(body.amountUsd || 0).toFixed(2));
      const network = String(body.network || 'USDT_BEP20')
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 64);
      const destinationAddress = String(body.destinationAddress || '').trim().slice(0, 160);
      const rawSource = String(body.source || 'package_profit');
      const source = (
        ['package_profit', 'mlm_commission', 'mentor_profit'].includes(rawSource)
          ? rawSource
          : 'package_profit'
      ) as 'package_profit' | 'mlm_commission' | 'mentor_profit';

      if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
        res.status(400).json({ error: 'Enter a valid withdrawal USD amount.' });
        return;
      }
      if (!destinationAddress || destinationAddress.length < 10) {
        res.status(400).json({ error: 'Enter a valid destination wallet address.' });
        return;
      }

      // Read authoritative platform configuration from Firestore
      const platformCfg = (await fsGetDoc(caller.idToken, 'config/platform')) || {};
      const web3Cfg = (platformCfg.web3PaymentConfig || {}) as Record<string, unknown>;
      const kycSettings = (platformCfg.kycSettings || {}) as Record<string, unknown>;

      if (platformCfg.globalPaused === true || platformCfg.withdrawalsPaused === true) {
        res.status(403).json({
          error: 'Withdrawals are currently paused by platform administration.',
        });
        return;
      }

      const paymentMethods = Array.isArray(platformCfg.paymentMethods)
        ? (platformCfg.paymentMethods as Array<Record<string, unknown>>)
        : [];
      const activeMethod = paymentMethods.find((m) => String(m.id || '') === network);
      if (activeMethod && (activeMethod.enabled === false || activeMethod.allowWithdrawal === false)) {
        res.status(403).json({
          error: `Withdrawals are currently disabled for ${String(activeMethod.name || network)}.`,
        });
        return;
      }

      const minWd = Math.max(
        Number(platformCfg.minWithdrawalUsd ?? 10) || 10,
        Number(web3Cfg.minWithdrawalUsd ?? 10) || 10,
        Number(activeMethod?.minWithdrawalUsd ?? 0) || 0
      );
      const maxWd = Math.max(minWd, Number(web3Cfg.maxWithdrawalUsd ?? 25000) || 25000);

      if (amountUsd < minWd) {
        res.status(400).json({ error: `Minimum withdrawal amount is $${minWd.toFixed(2)} USD.` });
        return;
      }
      if (amountUsd > maxWd) {
        res.status(400).json({
          error: `Maximum single withdrawal request is $${maxWd.toFixed(2)} USD.`,
        });
        return;
      }

      const require2fa = web3Cfg.require2faForWithdrawals !== false;
      let twoFactorVerified = false;
      if (require2fa) {
        const bindingHash = buildWithdrawalBindingHash({
          uid: caller.uid,
          amountUsd,
          network,
          destinationAddress,
        });
        const ok = verifyAndConsumeWithdrawalAuthToken(
          String(body.otpVerificationToken || ''),
          caller.uid,
          bindingHash
        );
        if (!ok) {
          res.status(403).json({
            error:
              'Valid Email OTP / 2FA verification is required before submitting a withdrawal request.',
            code: 'TWO_FACTOR_REQUIRED',
          });
          return;
        }
        twoFactorVerified = true;
      }

      const feePercent = Math.max(0, Math.min(15, Number(web3Cfg.withdrawalFeePercent ?? 0) || 0));
      const flatFeeUsd = Math.max(0, Math.min(50, Number(web3Cfg.withdrawalFlatFeeUsd ?? 0) || 0));
      const rawFeeUsd = Number(((amountUsd * feePercent) / 100 + flatFeeUsd).toFixed(2));
      const requestedPromoCode = normalizePromoCode(body.promoCode);
      let appliedPromo: ValidatedPromoResult | null = null;
      let feeDiscountUsd = 0;
      let feeUsd = rawFeeUsd;
      let netPayoutUsd = Number((amountUsd - feeUsd).toFixed(2));

      if (!requestedPromoCode && netPayoutUsd <= 0) {
        res.status(400).json({
          error: `Withdrawal amount ($${amountUsd.toFixed(
            2
          )}) must exceed the withdrawal fee ($${feeUsd.toFixed(2)}).`,
        });
        return;
      }

      // Atomic Firestore Transaction: Validate Balance + KYC + Mentor Rule + Lock Funds + Create Pending Withdrawal + Ledger + Audit
      const txHandle = await fsBeginTransaction(caller.idToken);
      try {
        const userDoc = await fsGetDoc(caller.idToken, `users/${caller.uid}`, txHandle);
        if (!userDoc) {
          await fsRollbackTransaction(caller.idToken, txHandle);
          res.status(404).json({ error: 'User profile not found.' });
          return;
        }
        if (userDoc.suspended === true) {
          await fsRollbackTransaction(caller.idToken, txHandle);
          res.status(403).json({
            error: `Account suspended: ${String(userDoc.suspensionReason || 'Contact compliance support.')}`,
          });
          return;
        }

        const requireKyc =
          web3Cfg.requireKycForWithdrawals === true || kycSettings.requireKycForWithdrawals === true;
        if (requireKyc && userDoc.kycStatus !== 'approved') {
          await fsRollbackTransaction(caller.idToken, txHandle);
          res.status(403).json({
            error: 'Verified KYC is mandatory before requesting withdrawals.',
            code: 'KYC_REQUIRED',
          });
          return;
        }

        const isMentor = userDoc.isMentor === true;
        const mentorGifted = Number(userDoc.mentorGiftedCapital || 0);
        const mentorReq = Number(userDoc.mentorRequiredVolume || 0);
        const mentorBrought = Number(userDoc.mentorBroughtVolume || 0);
        if (isMentor && mentorGifted > 0 && mentorBrought < mentorReq) {
          await fsRollbackTransaction(caller.idToken, txHandle);
          res.status(403).json({
            error: `Mentor Volume Rule Active: Bring $${(mentorReq - mentorBrought).toFixed(
              2
            )} more in referred volume ($${mentorBrought.toFixed(2)} / $${mentorReq.toFixed(
              2
            )}) to unlock profit withdrawals.`,
          });
          return;
        }

        const currentProfitBalance = Number(userDoc.profitBalance || 0);
        if (currentProfitBalance < amountUsd) {
          await fsRollbackTransaction(caller.idToken, txHandle);
          res.status(400).json({
            error: `Insufficient available balance ($${currentProfitBalance.toFixed(2)} USD).`,
          });
          return;
        }

        // Enforce server-side Withdrawal Address Whitelist & 24-Hour Security Lock Policy
        try {
          await checkWithdrawalWhitelistPolicy({
            caller,
            userDoc,
            withdrawalNetwork: network,
            destinationAddress,
          });
        } catch (wlErr) {
          await fsRollbackTransaction(caller.idToken, txHandle);
          const e = wlErr as Error & { statusCode?: number; code?: string };
          res.status(e.statusCode || 403).json({
            error: e.message || 'Destination wallet is blocked by your Withdrawal Address Whitelist.',
            code: e.code || 'WHITELIST_BLOCKED',
          });
          return;
        }

        // Validate optional withdrawal fee-waiver / fee-discount promo code inside transaction
        if (requestedPromoCode) {
          appliedPromo = await validatePromoForCaller({
            caller,
            rawCode: requestedPromoCode,
            context: 'withdrawal',
            amountUsd,
            txHandle,
          });
          const effectiveDiscountPct =
            appliedPromo.type === 'withdrawal_fee_waiver' ? 100 : appliedPromo.discountPercent;
          feeDiscountUsd = Number(((rawFeeUsd * effectiveDiscountPct) / 100).toFixed(2));
          feeUsd = Number(Math.max(0, rawFeeUsd - feeDiscountUsd).toFixed(2));
          netPayoutUsd = Number((amountUsd - feeUsd).toFixed(2));
        }

        if (netPayoutUsd <= 0) {
          await fsRollbackTransaction(caller.idToken, txHandle);
          res.status(400).json({
            error: `Withdrawal amount ($${amountUsd.toFixed(
              2
            )}) must exceed the withdrawal fee ($${feeUsd.toFixed(2)}).`,
          });
          return;
        }

        const nextProfitBalance = Number((currentProfitBalance - amountUsd).toFixed(2));
        const userName = String(userDoc.fullName || caller.email).slice(0, 120);
        const wdId = makeServerDocId('wdp');
        const wtId = makeServerDocId('wtx');
        const audId = makeServerDocId('aud');

        const writes = [
          // 1. Atomic Balance Hold (deduct from available profitBalance so it cannot be double-spent)
          buildUpdateWrite(
            `users/${caller.uid}`,
            {
              profitBalance: nextProfitBalance,
            },
            ['updatedAt']
          ),
          // 2. Strictly Pending Admin-Approved Withdrawal Document (never auto-sent)
          buildCreateWrite(
            `withdrawals/${wdId}`,
            {
              uid: caller.uid,
              userEmail: caller.email,
              userName,
              type: 'instant_profit',
              source,
              investmentId: '',
              packageNumber: 0,
              investmentDate: '',
              principalCapital: 0,
              totalProfitGenerated: 0,
              amountUsd,
              feeUsd,
              feeDiscountUsd,
              promoCode: appliedPromo ? appliedPromo.code : '',
              netPayoutUsd,
              network,
              destinationAddress,
              status: 'pending',
              adminNote: appliedPromo
                ? `Promo ${appliedPromo.code} applied (-$${feeDiscountUsd.toFixed(2)} fee saved)`
                : '',
              payoutTxHash: '',
              twoFactorVerified,
              reviewedByUid: '',
              reviewedByEmail: '',
            },
            ['createdAt', 'updatedAt']
          ),
          // 3. Immutable WalletTransactions Hold Record
          buildCreateWrite(
            `walletTransactions/${wtId}`,
            {
              uid: caller.uid,
              userEmail: caller.email,
              userName,
              type: 'withdrawal_hold',
              wallet: 'income_wallet',
              direction: 'hold',
              amountUsd,
              feeUsd,
              netAmountUsd: netPayoutUsd,
              network,
              txHash: '',
              referenceId: wdId,
              status: 'pending',
              details: `Funds locked pending Super Admin manual payout review (${network} -> ${destinationAddress}, 2FA: ${
                twoFactorVerified ? 'Verified' : 'Optional'
              }${appliedPromo ? `, Promo: ${appliedPromo.code}` : ''})`,
            },
            ['createdAt']
          ),
          // 4. Immutable Security Audit Log
          buildCreateWrite(
            `auditLogs/${audId}`,
            {
              actorUid: caller.uid,
              actorEmail: caller.email,
              actorRole: 'user',
              eventType: 'WITHDRAWAL_REQUESTED_2FA',
              targetUid: caller.uid,
              network,
              txHash: '',
              amountUsd,
              details: `Safe withdrawal request ${wdId} locked ($${amountUsd.toFixed(
                2
              )} gross, $${feeUsd.toFixed(2)} fee${
                appliedPromo ? ` after promo ${appliedPromo.code}` : ''
              }, $${netPayoutUsd.toFixed(2)} net) -> ${destinationAddress}`,
            },
            ['createdAt']
          ),
        ];

        if (appliedPromo) {
          const redId = makeServerDocId('prd');
          writes.push(
            buildUpdateWrite(
              `promoCodes/${appliedPromo.code}`,
              {
                currentUses: appliedPromo.currentUses + 1,
              },
              ['updatedAt']
            ),
            buildCreateWrite(
              `promoRedemptions/${redId}`,
              {
                uid: caller.uid,
                userEmail: caller.email,
                code: appliedPromo.code,
                type: appliedPromo.type,
                appliedTo: 'withdrawal',
                referenceId: wdId,
                feeSavedUsd: feeDiscountUsd,
                bonusCreditedUsd: 0,
              },
              ['createdAt']
            )
          );
        }

        await fsCommitTransaction(caller.idToken, txHandle, writes);

        // Non-blocking automated withdrawal pending email + Telegram Admin Bot alert
        void triggerAutomatedEventNotifications({
          eventType: 'withdrawal_requested',
          userEmail: caller.email,
          userName: String(userDoc.fullName || caller.email),
          amountUsd,
          network,
          destinationAddress,
          sourceLabel: appliedPromo
            ? `2FA Withdrawal Request (Promo ${appliedPromo.code})`
            : '2FA Withdrawal Request',
        });

        res.json({
          ok: true,
          withdrawalId: wdId,
          status: 'pending',
          amountUsd,
          feeUsd,
          feeDiscountUsd,
          promoCode: appliedPromo?.code || '',
          netPayoutUsd,
          twoFactorVerified,
          newProfitBalance: nextProfitBalance,
          message: `Withdrawal request #${wdId} ($${netPayoutUsd.toFixed(
            2
          )} net after $${feeUsd.toFixed(2)} fee${
            appliedPromo ? `, promo ${appliedPromo.code} saved $${feeDiscountUsd.toFixed(2)}` : ''
          }) is locked and queued for Super Admin manual approval.`,
        });
      } catch (txErr) {
        await fsRollbackTransaction(caller.idToken, txHandle);
        throw txErr;
      }
    } catch (err) {
      const e = err as Error & { statusCode?: number; code?: string };
      res.status(e.statusCode || 500).json({
        error: e.message || 'Unable to submit withdrawal request.',
        code: e.code || 'WITHDRAWAL_SUBMIT_ERROR',
      });
    }
  });

  // 5. User Security: Request Mandatory Email OTP for Adding, Changing, Removing Whitelisted USDT Addresses or Lowering Security Policy
  app.post('/api/security/whitelist/request-otp', async (req, res) => {
    try {
      const caller = await verifyFirebaseBearerToken(req);
      const body = (req.body || {}) as {
        action?: 'add' | 'update' | 'remove' | 'update_policy';
        walletId?: string;
        label?: string;
        network?: string;
        address?: string;
        apply24hLock?: boolean;
        whitelistStrictMode?: boolean;
        whitelist24hLockEnabled?: boolean;
      };

      const nowMs = Date.now();
      pruneWhitelistOtpMaps(nowMs);
      const lastReqAt = whitelistOtpRateLimit.get(caller.uid) || 0;
      if (nowMs - lastReqAt < 20_000) {
        const waitSec = Math.ceil((20_000 - (nowMs - lastReqAt)) / 1000);
        res.status(429).json({
          error: `Please wait ${waitSec}s before requesting another whitelist OTP.`,
          code: 'WHITELIST_OTP_RATE_LIMITED',
        });
        return;
      }

      const action =
        body.action && ['add', 'update', 'remove', 'update_policy'].includes(body.action)
          ? body.action
          : 'add';

      let walletId = String(body.walletId || '')
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 128);
      let cleanLabel = String(body.label || '').trim().slice(0, 80);
      let normalizedNet: WhitelistUsdtNetwork = 'BEP20';
      let normalizedAddr = '';
      let apply24hLock = Boolean(body.apply24hLock);
      let nextStrictMode: boolean | undefined;
      let next24hLockPolicy: boolean | undefined;
      let actionSummary = '';

      if (action === 'add' || action === 'update') {
        const parsedNet = normalizeWhitelistNetwork(String(body.network || 'BEP20'));
        if (!parsedNet) {
          res.status(400).json({ error: 'Select a valid USDT network (BEP20, TRC20, POLYGON, or ERC20).' });
          return;
        }
        normalizedNet = parsedNet;
        if (!cleanLabel) {
          res.status(400).json({ error: 'Enter a wallet label (e.g. Binance Main USDT).' });
          return;
        }
        normalizedAddr = validateAndNormalizeUsdtAddress(normalizedNet, String(body.address || ''));

        const existingWallets = await fsQuerySubcollectionByUid(
          caller.idToken,
          `users/${caller.uid}`,
          'whitelistedWallets',
          caller.uid
        );

        if (action === 'update') {
          if (!walletId) {
            res.status(400).json({ error: 'Missing whitelisted wallet ID to update.' });
            return;
          }
          const target = existingWallets.find((w) => w.id === walletId);
          if (!target) {
            res.status(404).json({ error: 'Whitelisted address not found on your account.' });
            return;
          }
        } else if (existingWallets.length >= 20) {
          res.status(400).json({ error: 'Maximum of 20 trusted withdrawal addresses allowed per account.' });
          return;
        }

        const duplicate = existingWallets.find((w) => {
          if (action === 'update' && w.id === walletId) return false;
          const wNet = normalizeWhitelistNetwork(String(w.data.network || ''));
          const wAddr = String(w.data.address || '');
          return wNet === normalizedNet && addressesEqualForNetwork(normalizedNet, wAddr, normalizedAddr);
        });
        if (duplicate) {
          res.status(409).json({
            error: `This ${normalizedNet} USDT address is already saved as "${String(duplicate.data.label || 'Trusted Wallet')}".`,
          });
          return;
        }

        actionSummary =
          action === 'add'
            ? `Add trusted ${normalizedNet} USDT address "${cleanLabel}" (${normalizedAddr})${
                apply24hLock ? ' with a 24-hour new-address security lock' : ' (instant activation after OTP)'
              }`
            : `Update whitelisted ${normalizedNet} USDT address "${cleanLabel}" (${normalizedAddr})${
                apply24hLock ? ' with a 24-hour security lock on address change' : ''
              }`;
      } else if (action === 'remove') {
        if (!walletId) {
          res.status(400).json({ error: 'Missing whitelisted wallet ID to remove.' });
          return;
        }
        const existingDoc = await fsGetDoc(
          caller.idToken,
          `users/${caller.uid}/whitelistedWallets/${walletId}`
        );
        if (!existingDoc) {
          res.status(404).json({ error: 'Whitelisted address not found.' });
          return;
        }
        cleanLabel = String(existingDoc.label || 'Trusted Wallet').slice(0, 80);
        normalizedNet = normalizeWhitelistNetwork(String(existingDoc.network || 'BEP20')) || 'BEP20';
        normalizedAddr = String(existingDoc.address || '').slice(0, 160);
        apply24hLock = false;
        actionSummary = `Remove whitelisted ${normalizedNet} USDT address "${cleanLabel}" (${normalizedAddr})`;
      } else if (action === 'update_policy') {
        if (typeof body.whitelistStrictMode === 'boolean') {
          nextStrictMode = body.whitelistStrictMode;
        }
        if (typeof body.whitelist24hLockEnabled === 'boolean') {
          next24hLockPolicy = body.whitelist24hLockEnabled;
        }
        if (nextStrictMode === undefined && next24hLockPolicy === undefined) {
          res.status(400).json({ error: 'Specify a whitelist security policy change.' });
          return;
        }
        const changes: string[] = [];
        if (nextStrictMode !== undefined) {
          changes.push(`Strict Whitelist Lock -> ${nextStrictMode ? 'ENABLED' : 'DISABLED'}`);
        }
        if (next24hLockPolicy !== undefined) {
          changes.push(`24-Hour New-Address Lock -> ${next24hLockPolicy ? 'ENABLED' : 'DISABLED'}`);
        }
        actionSummary = `Update security policy (${changes.join(', ')})`;
      }

      const code = String(crypto.randomInt(100000, 999999));
      const jti = crypto.randomBytes(12).toString('hex');
      const expiresAtMs = nowMs + 5 * 60 * 1000;
      const payloadStr = Buffer.from(
        JSON.stringify({
          jti,
          uid: caller.uid,
          purpose: 'whitelist_mutation',
          action,
          walletId,
          label: cleanLabel,
          network: normalizedNet,
          address: normalizedAddr,
          apply24hLock,
          whitelistStrictMode: nextStrictMode,
          whitelist24hLockEnabled: next24hLockPolicy,
          codeHash: computeHmac(`wl_code:${jti}:${code}`),
          exp: expiresAtMs,
        })
      ).toString('base64url');
      const challengeToken = `${payloadStr}.${computeHmac(`wl_tok:${payloadStr}`)}`;
      whitelistOtpRateLimit.set(caller.uid, nowMs);

      const safeSummary = actionSummary
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const emailRes = await sendPlatformEmail({
        toEmail: caller.email,
        subject: `AlphaTradex Withdrawal Whitelist OTP: ${code}`,
        text: `AlphaTradex Withdrawal Whitelist Verification\n\nRequested Action: ${actionSummary}\n6-Digit Verification Code: ${code}\n\nThis code expires in 5 minutes. Never share this code with anyone. If you did not initiate this request, secure your account immediately.`,
        html: `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0B111E;color:#F8FAFC;border-radius:14px;border:1px solid #1E293B;">
          <div style="font-size:12px;letter-spacing:1.2px;text-transform:uppercase;color:#34D399;font-weight:700;">AlphaTradex Security Desk</div>
          <h2 style="margin:8px 0 12px;font-size:20px;color:#FFFFFF;">Withdrawal Whitelist Verification Code</h2>
          <p style="font-size:13px;color:#CBD5E1;line-height:1.6;">Use the 6-digit verification code below to authorize this withdrawal whitelist change:</p>
          <div style="margin:14px 0;padding:12px 14px;background:#111B2E;border:1px solid #334155;border-radius:10px;font-size:12px;color:#E2E8F0;">${safeSummary}</div>
          <div style="margin:18px 0;padding:16px;background:#064E3B;border:1px solid #10B981;border-radius:12px;text-align:center;font-family:monospace;font-size:30px;font-weight:800;letter-spacing:8px;color:#FFFFFF;">${code}</div>
          <p style="font-size:11px;color:#94A3B8;line-height:1.5;">Expires in 5 minutes. If you did not request this change, ignore this email and review your recent logins immediately.</p>
        </div>`,
      });

      res.json({
        ok: true,
        action,
        challengeToken,
        expiresAtMs,
        deliveryChannel: emailRes.ok ? 'email' : 'in_app_security_inbox',
        maskedEmail: caller.email.replace(/(^[^@]{2})[^@]*(@.*$)/, '$1***$2'),
        ...(emailRes.ok ? {} : { securityInboxCode: code }),
        message: emailRes.ok
          ? `6-digit Email OTP sent to ${caller.email} to confirm this whitelist action.`
          : 'Email provider not yet configured — use the instant Security Inbox OTP code shown below.',
      });
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      res.status(e.statusCode || 500).json({
        error: e.message || 'Unable to generate whitelist OTP.',
      });
    }
  });

  // 6. User Security: Verify Email OTP & Atomically Commit Whitelist Add / Update / Remove / Policy Change
  app.post('/api/security/whitelist/confirm', async (req, res) => {
    try {
      const caller = await verifyFirebaseBearerToken(req);
      const body = (req.body || {}) as {
        challengeToken?: string;
        otpCode?: string;
      };

      const cleanOtp = String(body.otpCode || '').replace(/\D/g, '').slice(0, 6);
      if (cleanOtp.length !== 6) {
        res.status(400).json({ error: 'Enter the 6-digit numeric Email OTP code.' });
        return;
      }

      const parts = String(body.challengeToken || '').split('.');
      if (parts.length !== 2) {
        res.status(400).json({ error: 'Invalid or expired whitelist OTP challenge.' });
        return;
      }
      const [payloadStr, sig] = parts;
      const expectedSig = computeHmac(`wl_tok:${payloadStr}`);
      const a = Buffer.from(sig, 'utf-8');
      const b = Buffer.from(expectedSig, 'utf-8');
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        res.status(400).json({ error: 'Invalid whitelist OTP signature.' });
        return;
      }

      const parsed = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf-8')) as {
        jti?: string;
        uid?: string;
        purpose?: string;
        action?: 'add' | 'update' | 'remove' | 'update_policy';
        walletId?: string;
        label?: string;
        network?: WhitelistUsdtNetwork;
        address?: string;
        apply24hLock?: boolean;
        whitelistStrictMode?: boolean;
        whitelist24hLockEnabled?: boolean;
        codeHash?: string;
        exp?: number;
      };

      const nowMs = Date.now();
      pruneWhitelistOtpMaps(nowMs);

      if (
        !parsed ||
        !parsed.jti ||
        parsed.uid !== caller.uid ||
        parsed.purpose !== 'whitelist_mutation'
      ) {
        res.status(400).json({ error: 'Invalid or expired whitelist OTP challenge.' });
        return;
      }
      if (nowMs > Number(parsed.exp || 0)) {
        res.status(400).json({ error: 'Whitelist Email OTP expired. Please request a fresh code.' });
        return;
      }
      if (consumedWhitelistChallenges.has(parsed.jti)) {
        res.status(400).json({ error: 'This Email OTP has already been used. Request a new code.' });
        return;
      }

      const attemptRec = whitelistOtpAttempts.get(parsed.jti) || {
        attempts: 0,
        expMs: Number(parsed.exp || nowMs + 300_000),
      };
      if (attemptRec.attempts >= 5) {
        consumedWhitelistChallenges.set(parsed.jti, attemptRec.expMs);
        res.status(429).json({
          error: 'Too many invalid OTP attempts. Request a fresh verification code.',
        });
        return;
      }

      const submittedHash = computeHmac(`wl_code:${parsed.jti}:${cleanOtp}`);
      const hA = Buffer.from(submittedHash, 'utf-8');
      const hB = Buffer.from(String(parsed.codeHash || ''), 'utf-8');
      if (hA.length !== hB.length || !crypto.timingSafeEqual(hA, hB)) {
        attemptRec.attempts += 1;
        whitelistOtpAttempts.set(parsed.jti, attemptRec);
        res.status(400).json({
          error: `Incorrect 6-digit OTP code (${Math.max(0, 5 - attemptRec.attempts)} attempts remaining).`,
        });
        return;
      }

      // Mark challenge consumed before committing write to prevent concurrent replay
      consumedWhitelistChallenges.set(parsed.jti, Number(parsed.exp || nowMs + 300_000));
      whitelistOtpAttempts.delete(parsed.jti);

      const txHandle = await fsBeginTransaction(caller.idToken);
      try {
        const audId = makeServerDocId('aud');
        const writes: unknown[] = [];
        let responseMessage = 'Whitelist updated.';
        let resultWalletId = parsed.walletId || '';
        let resultUnlockAtMs = nowMs;
        let emailNoticeDetails = '';

        if (parsed.action === 'add') {
          const network = normalizeWhitelistNetwork(String(parsed.network || 'BEP20'));
          if (!network) throw Object.assign(new Error('Invalid USDT network.'), { statusCode: 400 });
          const cleanLabel = String(parsed.label || '').trim().slice(0, 80);
          const cleanAddr = validateAndNormalizeUsdtAddress(network, String(parsed.address || ''));
          const applyLock = Boolean(parsed.apply24hLock);
          const lockDelayHours = applyLock ? 24 : 0;
          const unlockAtMs = applyLock ? nowMs + 24 * 60 * 60 * 1000 : nowMs;
          resultWalletId = makeServerDocId('wl');
          resultUnlockAtMs = unlockAtMs;

          writes.push(
            buildCreateWrite(
              `users/${caller.uid}/whitelistedWallets/${resultWalletId}`,
              {
                uid: caller.uid,
                label: cleanLabel,
                network,
                address: cleanAddr,
                verifiedViaOtp: true,
                lockDelayHours,
                createdAtMs: nowMs,
                updatedAtMs: nowMs,
                unlockAtMs,
              },
              ['createdAt', 'updatedAt']
            ),
            buildCreateWrite(
              `auditLogs/${audId}`,
              {
                actorUid: caller.uid,
                actorEmail: caller.email,
                actorRole: 'user',
                eventType: 'WHITELIST_WALLET_ADDED',
                targetUid: caller.uid,
                network,
                txHash: '',
                amountUsd: 0,
                details: `Added OTP-verified ${network} USDT whitelist address "${cleanLabel}" (${cleanAddr}) — ${
                  applyLock ? '24h security lock active' : 'immediate activation'
                }`.slice(0, 500),
              },
              ['createdAt']
            )
          );
          responseMessage = applyLock
            ? `Address "${cleanLabel}" verified via Email OTP and saved with a 24-hour security lock before its first withdrawal.`
            : `Address "${cleanLabel}" verified via Email OTP and immediately unlocked for withdrawals.`;
          emailNoticeDetails = `Added ${network} USDT wallet "${cleanLabel}" (${cleanAddr}). ${
            applyLock
              ? `24-Hour Security Lock active until ${new Date(unlockAtMs).toISOString().slice(0, 16).replace('T', ' ')} UTC.`
              : 'Ready for withdrawals immediately.'
          }`;
        } else if (parsed.action === 'update') {
          const walletId = String(parsed.walletId || '').trim();
          const existingDoc = await fsGetDoc(
            caller.idToken,
            `users/${caller.uid}/whitelistedWallets/${walletId}`,
            txHandle
          );
          if (!existingDoc) {
            throw Object.assign(new Error('Whitelisted wallet not found.'), { statusCode: 404 });
          }
          const network = normalizeWhitelistNetwork(String(parsed.network || 'BEP20'));
          if (!network) throw Object.assign(new Error('Invalid USDT network.'), { statusCode: 400 });
          const cleanLabel = String(parsed.label || '').trim().slice(0, 80);
          const cleanAddr = validateAndNormalizeUsdtAddress(network, String(parsed.address || ''));

          const prevNet = normalizeWhitelistNetwork(String(existingDoc.network || ''));
          const prevAddr = String(existingDoc.address || '');
          const destinationChanged =
            prevNet !== network || !addressesEqualForNetwork(network, prevAddr, cleanAddr);

          const applyLock = Boolean(parsed.apply24hLock);
          const existingUnlockAtMs = Number(existingDoc.unlockAtMs || nowMs);
          let nextUnlockAtMs = existingUnlockAtMs;
          let lockDelayHours = Number(existingDoc.lockDelayHours || 0);

          if (destinationChanged) {
            lockDelayHours = applyLock ? 24 : 0;
            nextUnlockAtMs = applyLock ? nowMs + 24 * 60 * 60 * 1000 : nowMs;
          } else if (applyLock && existingUnlockAtMs <= nowMs) {
            // Label-only edit preserves active status unless address changed
            nextUnlockAtMs = existingUnlockAtMs;
          }
          resultUnlockAtMs = nextUnlockAtMs;

          writes.push(
            buildUpdateWrite(
              `users/${caller.uid}/whitelistedWallets/${walletId}`,
              {
                label: cleanLabel,
                network,
                address: cleanAddr,
                verifiedViaOtp: true,
                lockDelayHours,
                unlockAtMs: nextUnlockAtMs,
                updatedAtMs: nowMs,
              },
              ['updatedAt']
            ),
            buildCreateWrite(
              `auditLogs/${audId}`,
              {
                actorUid: caller.uid,
                actorEmail: caller.email,
                actorRole: 'user',
                eventType: 'WHITELIST_WALLET_UPDATED',
                targetUid: caller.uid,
                network,
                txHash: '',
                amountUsd: 0,
                details: `Updated OTP-verified ${network} USDT whitelist address "${cleanLabel}" (${cleanAddr})${
                  destinationChanged
                    ? applyLock
                      ? ' — destination changed, 24h security lock applied'
                      : ' — destination changed, unlocked immediately'
                    : ' — label updated'
                }`.slice(0, 500),
              },
              ['createdAt']
            )
          );
          responseMessage =
            destinationChanged && applyLock
              ? `Updated "${cleanLabel}" via Email OTP. A 24-hour security lock is now active for the changed destination address.`
              : `Updated whitelisted address "${cleanLabel}" via Email OTP.`;
          emailNoticeDetails = `Updated ${network} USDT wallet "${cleanLabel}" (${cleanAddr}). ${
            destinationChanged && applyLock
              ? `24-Hour Security Lock active until ${new Date(nextUnlockAtMs).toISOString().slice(0, 16).replace('T', ' ')} UTC.`
              : 'Verified via Email OTP.'
          }`;
        } else if (parsed.action === 'remove') {
          const walletId = String(parsed.walletId || '').trim();
          const existingDoc = await fsGetDoc(
            caller.idToken,
            `users/${caller.uid}/whitelistedWallets/${walletId}`,
            txHandle
          );
          if (!existingDoc) {
            throw Object.assign(new Error('Whitelisted wallet not found.'), { statusCode: 404 });
          }
          const prevLabel = String(existingDoc.label || 'Trusted Wallet');
          const prevNet = String(existingDoc.network || 'BEP20');
          const prevAddr = String(existingDoc.address || '');

          writes.push(
            buildDeleteWrite(`users/${caller.uid}/whitelistedWallets/${walletId}`),
            buildCreateWrite(
              `auditLogs/${audId}`,
              {
                actorUid: caller.uid,
                actorEmail: caller.email,
                actorRole: 'user',
                eventType: 'WHITELIST_WALLET_REMOVED',
                targetUid: caller.uid,
                network: prevNet,
                txHash: '',
                amountUsd: 0,
                details: `Removed whitelisted ${prevNet} USDT address "${prevLabel}" (${prevAddr}) via Email OTP.`.slice(
                  0,
                  500
                ),
              },
              ['createdAt']
            )
          );
          responseMessage = `Removed "${prevLabel}" from your Withdrawal Address Whitelist.`;
          emailNoticeDetails = `Removed ${prevNet} USDT wallet "${prevLabel}" (${prevAddr}) from your Withdrawal Whitelist.`;
        } else if (parsed.action === 'update_policy') {
          const policyUpdate: Record<string, unknown> = {};
          const summaryParts: string[] = [];
          if (typeof parsed.whitelistStrictMode === 'boolean') {
            policyUpdate.whitelistStrictMode = parsed.whitelistStrictMode;
            summaryParts.push(
              `Strict Whitelist Lock: ${parsed.whitelistStrictMode ? 'ENABLED' : 'DISABLED'}`
            );
          }
          if (typeof parsed.whitelist24hLockEnabled === 'boolean') {
            policyUpdate.whitelist24hLockEnabled = parsed.whitelist24hLockEnabled;
            summaryParts.push(
              `24-Hour New-Address Lock: ${parsed.whitelist24hLockEnabled ? 'ENABLED' : 'DISABLED'}`
            );
          }
          writes.push(
            buildUpdateWrite(`users/${caller.uid}`, policyUpdate, ['updatedAt']),
            buildCreateWrite(
              `auditLogs/${audId}`,
              {
                actorUid: caller.uid,
                actorEmail: caller.email,
                actorRole: 'user',
                eventType: 'WHITELIST_POLICY_UPDATED',
                targetUid: caller.uid,
                network: '',
                txHash: '',
                amountUsd: 0,
                details: `Updated whitelist security policy via Email OTP (${summaryParts.join(', ')}).`.slice(
                  0,
                  500
                ),
              },
              ['createdAt']
            )
          );
          responseMessage = `Security policy updated (${summaryParts.join(' · ')}).`;
          emailNoticeDetails = `Updated Withdrawal Whitelist settings: ${summaryParts.join(', ')}.`;
        } else {
          throw Object.assign(new Error('Unsupported whitelist action.'), { statusCode: 400 });
        }

        await fsCommitTransaction(caller.idToken, txHandle, writes);

        // Non-blocking security confirmation alert email
        if (emailNoticeDetails) {
          void sendPlatformEmail({
            toEmail: caller.email,
            subject: 'AlphaTradex Security Notice: Withdrawal Whitelist Updated',
            text: `Hello,\n\nYour Withdrawal Address Whitelist was updated via Email OTP:\n${emailNoticeDetails}\n\nIf you did not authorize this change, contact support immediately.`,
          }).catch(() => {});
        }

        res.json({
          ok: true,
          action: parsed.action,
          walletId: resultWalletId,
          unlockAtMs: resultUnlockAtMs,
          message: responseMessage,
        });
      } catch (txErr) {
        await fsRollbackTransaction(caller.idToken, txHandle);
        throw txErr;
      }
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      res.status(e.statusCode || 500).json({
        error: e.message || 'Unable to verify whitelist OTP.',
      });
    }
  });

  // 7. Promo & Fee-Waiver Voucher Code Validation (Preview)
  app.post('/api/promo/validate', async (req, res) => {
    try {
      const caller = await verifyFirebaseBearerToken(req);
      const body = (req.body || {}) as Record<string, unknown>;
      const context = body.context === 'bonus' ? 'bonus' : 'withdrawal';
      const amountUsd = Number(body.amountUsd || 0);

      const promo = await validatePromoForCaller({
        caller,
        rawCode: String(body.code || ''),
        context,
        amountUsd: Number.isFinite(amountUsd) ? amountUsd : 0,
      });

      const cfgDoc = await fsGetDoc(caller.idToken, 'config/platform');
      const web3Cfg = ((cfgDoc?.web3PaymentConfig as Record<string, unknown> | undefined) || {});
      const feePercent = Math.max(0, Math.min(15, Number(web3Cfg.withdrawalFeePercent ?? 0) || 0));
      const flatFeeUsd = Math.max(0, Math.min(50, Number(web3Cfg.withdrawalFlatFeeUsd ?? 0) || 0));
      const baseFeeUsd = Number(((Math.max(0, amountUsd) * feePercent) / 100 + flatFeeUsd).toFixed(2));
      const discountPct = promo.type === 'withdrawal_fee_waiver' ? 100 : promo.discountPercent;
      const feeSavedUsd =
        context === 'withdrawal' ? Number(((baseFeeUsd * discountPct) / 100).toFixed(2)) : 0;

      res.json({
        ok: true,
        promo: {
          code: promo.code,
          title: promo.title,
          description: promo.description,
          type: promo.type,
          discountPercent: discountPct,
          bonusUsd: promo.bonusUsd,
          minAmountUsd: promo.minAmountUsd,
          feeSavedUsd,
          discountedFeeUsd: Number(Math.max(0, baseFeeUsd - feeSavedUsd).toFixed(2)),
        },
      });
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      res.status(e.statusCode || 400).json({
        error: e.message || 'Unable to validate promo code.',
      });
    }
  });

  // 8. Atomic Promo Bonus Voucher Redemption (Deposit Bonus / Milestone Bonus)
  app.post('/api/promo/redeem-bonus', async (req, res) => {
    try {
      const caller = await verifyFirebaseBearerToken(req);
      const body = (req.body || {}) as Record<string, unknown>;
      const rawCode = String(body.code || '');

      const txHandle = await fsBeginTransaction(caller.idToken);
      try {
        const promo = await validatePromoForCaller({
          caller,
          rawCode,
          context: 'bonus',
          txHandle,
        });

        if (promo.bonusUsd <= 0) {
          await fsRollbackTransaction(caller.idToken, txHandle);
          res.status(400).json({ error: 'This voucher does not carry a USD bonus credit.' });
          return;
        }

        const userDoc = await fsGetDoc(caller.idToken, `users/${caller.uid}`, txHandle);
        if (!userDoc) {
          await fsRollbackTransaction(caller.idToken, txHandle);
          res.status(404).json({ error: 'User profile not found.' });
          return;
        }

        if (promo.type === 'deposit_bonus_usd' && promo.minAmountUsd > 0) {
          const userDeposits = await fsQueryRootCollectionByUid(
            caller.idToken,
            'cryptoDeposits',
            caller.uid
          );
          const approvedTotal = userDeposits
            .filter((d) => d.data.status === 'approved')
            .reduce((sum, d) => sum + Number(d.data.amountUsd || 0), 0);
          if (approvedTotal < promo.minAmountUsd) {
            await fsRollbackTransaction(caller.idToken, txHandle);
            res.status(400).json({
              error: `Code "${promo.code}" requires at least $${promo.minAmountUsd.toFixed(
                2
              )} in approved deposits (your total: $${approvedTotal.toFixed(2)}).`,
            });
            return;
          }
        }

        if (promo.type === 'milestone_bonus_usd' && promo.minAmountUsd > 0) {
          const totalInvested = Number(userDoc.totalInvested || 0);
          if (totalInvested < promo.minAmountUsd) {
            await fsRollbackTransaction(caller.idToken, txHandle);
            res.status(400).json({
              error: `Code "${promo.code}" requires at least $${promo.minAmountUsd.toFixed(
                2
              )} in active/total investments (your total: $${totalInvested.toFixed(2)}).`,
            });
            return;
          }
        }

        const currentDepositBalance = Number(userDoc.usdBalance || 0);
        const currentProfitBalance = Number(userDoc.profitBalance || 0);
        const creditToDeposit = promo.type === 'deposit_bonus_usd';
        const nextDepositBalance = creditToDeposit
          ? Number((currentDepositBalance + promo.bonusUsd).toFixed(2))
          : currentDepositBalance;
        const nextProfitBalance = !creditToDeposit
          ? Number((currentProfitBalance + promo.bonusUsd).toFixed(2))
          : currentProfitBalance;

        const redId = makeServerDocId('prd');
        const audId = makeServerDocId('aud');
        const writes = [
          buildUpdateWrite(
            `users/${caller.uid}`,
            creditToDeposit
              ? { usdBalance: nextDepositBalance }
              : { profitBalance: nextProfitBalance },
            ['updatedAt']
          ),
          buildUpdateWrite(
            `promoCodes/${promo.code}`,
            { currentUses: promo.currentUses + 1 },
            ['updatedAt']
          ),
          buildCreateWrite(
            `promoRedemptions/${redId}`,
            {
              uid: caller.uid,
              userEmail: caller.email,
              code: promo.code,
              type: promo.type,
              appliedTo: 'bonus_claim',
              referenceId: redId,
              feeSavedUsd: 0,
              bonusCreditedUsd: promo.bonusUsd,
            },
            ['createdAt']
          ),
          buildCreateWrite(
            `auditLogs/${audId}`,
            {
              actorUid: caller.uid,
              actorEmail: caller.email,
              actorRole: 'user',
              eventType: 'PROMO_VOUCHER_REDEEMED',
              targetUid: caller.uid,
              network: 'VOUCHER',
              txHash: promo.code,
              amountUsd: promo.bonusUsd,
              details: `Redeemed ${promo.type} voucher ${promo.code} (+$${promo.bonusUsd.toFixed(
                2
              )} credited to ${creditToDeposit ? 'Deposit Wallet' : 'Income Wallet'}).`,
            },
            ['createdAt']
          ),
        ];

        await fsCommitTransaction(caller.idToken, txHandle, writes);

        res.json({
          ok: true,
          code: promo.code,
          bonusUsd: promo.bonusUsd,
          creditedWallet: creditToDeposit ? 'Deposit Wallet' : 'Income Wallet',
          message: `Voucher "${promo.code}" redeemed! +$${promo.bonusUsd.toFixed(
            2
          )} credited to your ${creditToDeposit ? 'Deposit Wallet' : 'Income Wallet'}.`,
        });
      } catch (txErr) {
        await fsRollbackTransaction(caller.idToken, txHandle);
        throw txErr;
      }
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      res.status(e.statusCode || 400).json({
        error: e.message || 'Unable to redeem bonus voucher.',
      });
    }
  });

  // 9. Authenticated Live Price Alert Email Dispatch (Owner-Verified Against Firestore)
  app.post('/api/alerts/price-triggered', async (req, res) => {
    try {
      const caller = await verifyFirebaseBearerToken(req);
      const body = (req.body || {}) as Record<string, unknown>;
      const alertId = String(body.alertId || '').trim();
      const livePrice = Number(body.livePrice || 0);

      if (!/^[a-zA-Z0-9_-]{3,128}$/.test(alertId) || !Number.isFinite(livePrice) || livePrice <= 0) {
        res.status(400).json({ error: 'Invalid alertId or livePrice.' });
        return;
      }

      const alertDoc = await fsGetDoc(
        caller.idToken,
        `users/${caller.uid}/priceAlerts/${alertId}`
      );
      if (!alertDoc || alertDoc.uid !== caller.uid) {
        res.status(404).json({ error: 'Price alert not found.' });
        return;
      }
      if (alertDoc.notifyEmail !== true) {
        res.json({ ok: true, emailSent: false, message: 'Email notifications disabled for this alert.' });
        return;
      }
      if (alertDoc.emailSent === true) {
        res.json({ ok: true, emailSent: true, message: 'Alert email already dispatched.' });
        return;
      }

      const symbol = String(alertDoc.symbol || 'MARKET');
      const condition = alertDoc.condition === 'below' ? 'dropped below' : 'rose above';
      const targetPrice = Number(alertDoc.targetPrice || 0);
      const note = String(alertDoc.note || '').trim();
      const decimals = symbol.includes('JPY') ? 3 : symbol.startsWith('EUR') || symbol.startsWith('GBP') || symbol.startsWith('AUD') ? 5 : 2;

      const sendRes = await sendPlatformEmail({
        toEmail: caller.email,
        subject: `Price Alert Triggered: ${symbol} ${condition} ${targetPrice.toFixed(decimals)}`,
        text: `AlphaTradex Live Market Alert\n\nPair: ${symbol}\nCondition: Price ${condition} ${targetPrice.toFixed(
          decimals
        )}\nLive Market Price: ${livePrice.toFixed(decimals)}${
          note ? `\nYour Note: ${note}` : ''
        }\nTriggered At: ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC\n\nLog in to your AlphaTradex Vault Dashboard to review your positions.`,
      });

      if (sendRes.ok) {
        const txHandle = await fsBeginTransaction(caller.idToken);
        try {
          await fsCommitTransaction(caller.idToken, txHandle, [
            buildUpdateWrite(
              `users/${caller.uid}/priceAlerts/${alertId}`,
              { emailSent: true },
              ['updatedAt']
            ),
          ]);
        } catch {
          await fsRollbackTransaction(caller.idToken, txHandle);
        }
      }

      res.json({
        ok: true,
        emailSent: sendRes.ok,
        provider: sendRes.providerUsed,
        message: sendRes.ok
          ? `Price alert email sent to ${caller.email}.`
          : sendRes.errorMessage || 'In-app alert triggered (email provider not configured).',
      });
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      res.status(e.statusCode || 500).json({
        error: e.message || 'Failed to dispatch price alert email.',
      });
    }
  });

  // 10. Register Dual-Engine Email (Company SMTP + Resend), Bulk Broadcast, Telegram Bot & Event Dispatch Routes
  registerNotificationHubRoutes(app, {
    verifyFirebaseBearerToken,
    verifySuperAdminCaller,
    fsGetDoc,
    fsBeginTransaction,
    fsRollbackTransaction,
    fsCommitTransaction,
    buildCreateWrite: (docPath, fields, serverTimestampFields = []) =>
      buildCreateWrite(docPath, fields, serverTimestampFields),
    buildUpsertWrite: (docPath, fields, serverTimestampFields = []) =>
      buildUpsertWrite(docPath, fields, serverTimestampFields),
    makeServerDocId,
  });
}
