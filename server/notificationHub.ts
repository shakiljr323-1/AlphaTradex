import type { Express, Request } from 'express';
import nodemailer from 'nodemailer';
import type {
  AdminEmailConfigStatus,
  AdminTelegramConfigStatus,
  EmailAutomationToggles,
  EmailProviderMode,
} from '../src/types/platform.ts';

// =========================================================================
// Shared Helper Injection (provided by web3PaymentService to avoid duplication)
// =========================================================================

export interface VerifiedCallerRef {
  uid: string;
  email: string;
  emailVerified?: boolean;
  idToken: string;
}

export interface NotificationHubDeps {
  verifyFirebaseBearerToken: (req: Request) => Promise<VerifiedCallerRef>;
  verifySuperAdminCaller: (caller: VerifiedCallerRef) => Promise<void>;
  fsGetDoc: (
    idToken: string,
    docPath: string,
    transaction?: string
  ) => Promise<Record<string, unknown> | null>;
  fsBeginTransaction: (idToken: string) => Promise<string>;
  fsRollbackTransaction: (idToken: string, transaction: string) => Promise<void>;
  fsCommitTransaction: (
    idToken: string,
    transaction: string,
    writes: unknown[]
  ) => Promise<void>;
  buildCreateWrite: (
    docPath: string,
    fields: Record<string, unknown>,
    serverTimestampFields?: string[]
  ) => unknown;
  buildUpsertWrite: (
    docPath: string,
    fields: Record<string, unknown>,
    serverTimestampFields?: string[]
  ) => unknown;
  makeServerDocId: (prefix: string) => string;
}

// =========================================================================
// Safe Validators, SSRF Guard & Secret Masking
// =========================================================================

const DEFAULT_FALLBACK_FROM_EMAIL = 'AlphaTradex Security <onboarding@resend.dev>';

const DEFAULT_AUTOMATION_TOGGLES: EmailAutomationToggles = {
  welcomeEmailEnabled: true,
  depositConfirmedEmailEnabled: true,
  withdrawalStatusEmailEnabled: true,
  kycStatusEmailEnabled: true,
  loginAlertEmailEnabled: true,
};

function escapeHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function maskSecretValue(raw: string, fallbackLast4 = ''): string {
  const clean = raw.trim();
  const last4 = clean.length >= 4 ? clean.slice(-4) : fallbackLast4.slice(-4);
  if (!last4) return clean ? 'Configured / Hidden' : 'Not Configured';
  if (clean.startsWith('re_')) return `re_••••••••••••${last4}`;
  return `••••••••••••${last4}`;
}

export function isValidFromEmail(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 254 || /[\r\n]/.test(trimmed)) return false;
  const plainEmail = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
  const namedEmail = /^[^<>@]{1,100}\s*<[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>$/;
  return plainEmail.test(trimmed) || namedEmail.test(trimmed);
}

export function isValidEmailAddress(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 254 || /[\r\n]/.test(trimmed)) return false;
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(trimmed);
}

/**
 * Validates SMTP host and blocks loopback, link-local, private RFC1918, and metadata hosts
 * to prevent SSRF via custom SMTP settings.
 */
export function isSafePublicSmtpHost(host: string): boolean {
  const h = host.trim().toLowerCase();
  if (!h || h.length > 160 || /[\s/\\:@\r\n]/.test(h)) return false;
  if (!/^[a-z0-9.-]+$/.test(h) || !h.includes('.')) return false;
  if (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '0.0.0.0' ||
    h === '::1' ||
    h === '169.254.169.254' ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    h.endsWith('.localhost') ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^0\./.test(h)
  ) {
    return false;
  }
  return true;
}

// =========================================================================
// Runtime Caches (Hydrated from Firestore /adminSecrets/* with Env Fallback)
// =========================================================================

const emailConfigCache = {
  providerMode: 'auto' as EmailProviderMode,
  databaseApiKey: '',
  databaseApiKeyLast4: '',
  databaseFromEmail: '',
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: '',
  smtpPass: '',
  smtpPassLast4: '',
  smtpFromName: 'AlphaTradex',
  smtpFromEmail: '',
  automation: { ...DEFAULT_AUTOMATION_TOGGLES },
  updatedByEmail: '',
  updatedAtIso: '',
};

const telegramConfigCache = {
  enabled: false,
  databaseBotToken: '',
  databaseBotTokenLast4: '',
  adminChatId: '',
  alertOnDeposits: true,
  largeDepositThresholdUsd: 100,
  alertOnKyc: true,
  alertOnWithdrawals: true,
  updatedByEmail: '',
  updatedAtIso: '',
};

export function hydrateEmailConfigCache(doc: Record<string, unknown> | null): void {
  if (!doc) return;
  const rawMode = String(doc.providerMode || 'auto').trim().toLowerCase();
  emailConfigCache.providerMode =
    rawMode === 'smtp' || rawMode === 'resend' ? rawMode : 'auto';
  emailConfigCache.databaseApiKey = String(doc.resendApiKey || '').trim();
  emailConfigCache.databaseApiKeyLast4 = String(doc.resendApiKeyLast4 || '').trim();
  emailConfigCache.databaseFromEmail = String(doc.resendFromEmail || '').trim();
  emailConfigCache.smtpHost = String(doc.smtpHost || '').trim();
  const parsedPort = Number(doc.smtpPort);
  emailConfigCache.smtpPort =
    Number.isFinite(parsedPort) && parsedPort >= 1 && parsedPort <= 65535 ? parsedPort : 587;
  emailConfigCache.smtpSecure = doc.smtpSecure === true;
  emailConfigCache.smtpUser = String(doc.smtpUser || '').trim();
  emailConfigCache.smtpPass = String(doc.smtpPass || '').trim();
  emailConfigCache.smtpPassLast4 = String(doc.smtpPassLast4 || '').trim();
  emailConfigCache.smtpFromName = String(doc.smtpFromName || 'AlphaTradex').trim() || 'AlphaTradex';
  emailConfigCache.smtpFromEmail = String(doc.smtpFromEmail || '').trim();
  emailConfigCache.automation = {
    welcomeEmailEnabled: doc.welcomeEmailEnabled !== false,
    depositConfirmedEmailEnabled: doc.depositConfirmedEmailEnabled !== false,
    withdrawalStatusEmailEnabled: doc.withdrawalStatusEmailEnabled !== false,
    kycStatusEmailEnabled: doc.kycStatusEmailEnabled !== false,
    loginAlertEmailEnabled: doc.loginAlertEmailEnabled !== false,
  };
  emailConfigCache.updatedByEmail = String(doc.updatedByEmail || '').trim();
  emailConfigCache.updatedAtIso = String(doc.updatedAtIso || '').trim();
}

export function hydrateTelegramConfigCache(doc: Record<string, unknown> | null): void {
  if (!doc) return;
  telegramConfigCache.enabled = doc.enabled === true;
  telegramConfigCache.databaseBotToken = String(doc.botToken || '').trim();
  telegramConfigCache.databaseBotTokenLast4 = String(doc.botTokenLast4 || '').trim();
  telegramConfigCache.adminChatId = String(doc.adminChatId || '').trim();
  telegramConfigCache.alertOnDeposits = doc.alertOnDeposits !== false;
  const thresh = Number(doc.largeDepositThresholdUsd);
  telegramConfigCache.largeDepositThresholdUsd =
    Number.isFinite(thresh) && thresh >= 0 ? thresh : 100;
  telegramConfigCache.alertOnKyc = doc.alertOnKyc !== false;
  telegramConfigCache.alertOnWithdrawals = doc.alertOnWithdrawals !== false;
  telegramConfigCache.updatedByEmail = String(doc.updatedByEmail || '').trim();
  telegramConfigCache.updatedAtIso = String(doc.updatedAtIso || '').trim();
}

function resolveEffectiveEmailEngine() {
  // Resend resolution
  const dbResendKey = emailConfigCache.databaseApiKey.trim();
  const envResendKey = process.env.RESEND_API_KEY?.trim() || '';
  const resendApiKey = dbResendKey || envResendKey;
  const activeApiKeySource: 'database' | 'env' | 'none' = dbResendKey
    ? 'database'
    : envResendKey
    ? 'env'
    : 'none';
  const dbResendFrom = emailConfigCache.databaseFromEmail.trim();
  const envResendFrom = process.env.RESEND_FROM_EMAIL?.trim() || '';
  const resendFromEmail = dbResendFrom || envResendFrom || DEFAULT_FALLBACK_FROM_EMAIL;
  const activeFromEmailSource: 'database' | 'env' | 'default' = dbResendFrom
    ? 'database'
    : envResendFrom
    ? 'env'
    : 'default';

  // SMTP (Company Email + Pass Key) resolution — Database config is always PRIMARY
  const envSmtpHost = process.env.SMTP_HOST?.trim() || '';
  const envSmtpUser = process.env.SMTP_USER?.trim() || '';
  const envSmtpPass = process.env.SMTP_PASS?.trim() || '';
  const envSmtpPort = Number(process.env.SMTP_PORT || 587);
  const envSmtpSecure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';
  const envSmtpFrom = process.env.SMTP_FROM_EMAIL?.trim() || '';

  const inferSmtpHostFromUser = (userEmail: string): string => {
    const domain = (userEmail.split('@')[1] || '').trim().toLowerCase();
    if (!domain) return '';
    if (domain === 'gmail.com' || domain === 'googlemail.com') return 'smtp.gmail.com';
    if (domain === 'zoho.com' || domain === 'zohomail.com') return 'smtp.zoho.com';
    if (domain === 'outlook.com' || domain === 'hotmail.com' || domain === 'live.com') {
      return 'smtp.office365.com';
    }
    if (domain === 'hostinger.com') return 'smtp.hostinger.com';
    return '';
  };

  const resolvedDbHost =
    emailConfigCache.smtpHost || envSmtpHost || inferSmtpHostFromUser(emailConfigCache.smtpUser);
  const dbSmtpReady = Boolean(
    resolvedDbHost && emailConfigCache.smtpUser && emailConfigCache.smtpPass
  );
  const envSmtpReady = Boolean(envSmtpHost && envSmtpUser && envSmtpPass);

  const smtpHost = dbSmtpReady
    ? resolvedDbHost
    : envSmtpReady
    ? envSmtpHost
    : resolvedDbHost;
  const smtpPort = dbSmtpReady
    ? emailConfigCache.smtpPort
    : envSmtpReady
    ? Number.isFinite(envSmtpPort)
      ? envSmtpPort
      : 587
    : emailConfigCache.smtpPort;
  const smtpSecure = dbSmtpReady
    ? emailConfigCache.smtpSecure
    : envSmtpReady
    ? envSmtpSecure
    : emailConfigCache.smtpSecure;
  const smtpUser = dbSmtpReady ? emailConfigCache.smtpUser : envSmtpReady ? envSmtpUser : emailConfigCache.smtpUser;
  const smtpPass = dbSmtpReady ? emailConfigCache.smtpPass : envSmtpReady ? envSmtpPass : '';
  const smtpFromEmail =
    (dbSmtpReady
      ? emailConfigCache.smtpFromEmail ||
        (emailConfigCache.smtpFromName
          ? `${emailConfigCache.smtpFromName} <${emailConfigCache.smtpUser}>`
          : emailConfigCache.smtpUser)
      : envSmtpReady
      ? envSmtpFrom || envSmtpUser
      : '') || DEFAULT_FALLBACK_FROM_EMAIL;

  const smtpConfigured = dbSmtpReady || envSmtpReady;
  const activeSmtpSource: 'database' | 'env' | 'none' = dbSmtpReady
    ? 'database'
    : envSmtpReady
    ? 'env'
    : 'none';

  // Determine active delivery provider (Database primary, env fallback)
  let activeProvider: 'smtp' | 'resend' | 'none' = 'none';
  if (emailConfigCache.providerMode === 'smtp') {
    activeProvider = smtpConfigured ? 'smtp' : resendApiKey ? 'resend' : 'none';
  } else if (emailConfigCache.providerMode === 'resend') {
    activeProvider = resendApiKey ? 'resend' : smtpConfigured ? 'smtp' : 'none';
  } else {
    // Auto: prioritize DB SMTP -> DB Resend -> Env SMTP -> Env Resend
    if (dbSmtpReady) activeProvider = 'smtp';
    else if (dbResendKey) activeProvider = 'resend';
    else if (envSmtpReady) activeProvider = 'smtp';
    else if (envResendKey) activeProvider = 'resend';
  }

  return {
    providerMode: emailConfigCache.providerMode,
    activeProvider,
    resendApiKey,
    activeApiKeySource,
    resendFromEmail,
    activeFromEmailSource,
    hasDatabaseApiKey: Boolean(dbResendKey),
    hasEnvApiKey: Boolean(envResendKey),
    databaseFromEmail: dbResendFrom,
    envFromEmail: envResendFrom,
    smtpConfigured,
    smtpHost,
    smtpPort,
    smtpSecure,
    smtpUser,
    smtpPass,
    smtpFromName: emailConfigCache.smtpFromName,
    smtpFromEmail,
    hasDatabaseSmtpPass: Boolean(emailConfigCache.smtpPass),
    hasEnvSmtp: envSmtpReady,
    activeSmtpSource,
    automation: { ...emailConfigCache.automation },
  };
}

export function buildMaskedEmailStatus(message?: string): AdminEmailConfigStatus {
  const eff = resolveEffectiveEmailEngine();
  const resendLast4 =
    eff.resendApiKey.length >= 4
      ? eff.resendApiKey.slice(-4)
      : emailConfigCache.databaseApiKeyLast4;
  const smtpLast4 =
    eff.smtpPass.length >= 4 ? eff.smtpPass.slice(-4) : emailConfigCache.smtpPassLast4;

  return {
    ok: true,
    providerMode: eff.providerMode,
    activeProvider: eff.activeProvider,
    apiKeyConfigured: Boolean(eff.resendApiKey),
    apiKeyMasked: eff.resendApiKey ? maskSecretValue(eff.resendApiKey, resendLast4) : 'Not Configured',
    apiKeyLast4: eff.resendApiKey ? resendLast4 : '',
    hasDatabaseApiKey: eff.hasDatabaseApiKey,
    hasEnvApiKey: eff.hasEnvApiKey,
    activeApiKeySource: eff.activeApiKeySource,
    fromEmail: eff.resendFromEmail,
    databaseFromEmail: eff.databaseFromEmail,
    envFromEmail: eff.envFromEmail,
    activeFromEmailSource: eff.activeFromEmailSource,
    smtpConfigured: eff.smtpConfigured,
    smtpHost: emailConfigCache.smtpHost || eff.smtpHost,
    smtpPort: emailConfigCache.smtpPort || eff.smtpPort,
    smtpSecure: emailConfigCache.smtpSecure,
    smtpUser: emailConfigCache.smtpUser || eff.smtpUser,
    smtpFromName: emailConfigCache.smtpFromName || 'AlphaTradex',
    smtpFromEmail: emailConfigCache.smtpFromEmail,
    smtpPassConfigured: Boolean(eff.smtpPass),
    smtpPassMasked: eff.smtpPass ? maskSecretValue(eff.smtpPass, smtpLast4) : 'Not Configured',
    smtpPassLast4: eff.smtpPass ? smtpLast4 : '',
    hasDatabaseSmtpPass: eff.hasDatabaseSmtpPass,
    hasEnvSmtp: eff.hasEnvSmtp,
    activeSmtpSource: eff.activeSmtpSource,
    automation: eff.automation,
    updatedByEmail: emailConfigCache.updatedByEmail,
    updatedAtIso: emailConfigCache.updatedAtIso,
    ...(message ? { message } : {}),
  };
}

function resolveEffectiveTelegram() {
  const dbToken = telegramConfigCache.databaseBotToken.trim();
  const envToken = process.env.TELEGRAM_BOT_TOKEN?.trim() || '';
  const botToken = dbToken || envToken;
  const activeTokenSource: 'database' | 'env' | 'none' = dbToken
    ? 'database'
    : envToken
    ? 'env'
    : 'none';
  const envChatId = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim() || '';
  const adminChatId = telegramConfigCache.adminChatId.trim() || envChatId;

  return {
    enabled: telegramConfigCache.enabled || Boolean(envToken && envChatId && !dbToken),
    botToken,
    activeTokenSource,
    hasDatabaseBotToken: Boolean(dbToken),
    hasEnvBotToken: Boolean(envToken),
    adminChatId,
    envAdminChatId: envChatId,
    alertOnDeposits: telegramConfigCache.alertOnDeposits,
    largeDepositThresholdUsd: telegramConfigCache.largeDepositThresholdUsd,
    alertOnKyc: telegramConfigCache.alertOnKyc,
    alertOnWithdrawals: telegramConfigCache.alertOnWithdrawals,
  };
}

export function buildMaskedTelegramStatus(message?: string): AdminTelegramConfigStatus {
  const eff = resolveEffectiveTelegram();
  const last4 =
    eff.botToken.length >= 4
      ? eff.botToken.slice(-4)
      : telegramConfigCache.databaseBotTokenLast4;

  return {
    ok: true,
    enabled: eff.enabled,
    botTokenConfigured: Boolean(eff.botToken),
    botTokenMasked: eff.botToken ? maskSecretValue(eff.botToken, last4) : 'Not Configured',
    botTokenLast4: eff.botToken ? last4 : '',
    hasDatabaseBotToken: eff.hasDatabaseBotToken,
    hasEnvBotToken: eff.hasEnvBotToken,
    activeTokenSource: eff.activeTokenSource,
    adminChatId: telegramConfigCache.adminChatId || eff.envAdminChatId,
    envAdminChatId: eff.envAdminChatId,
    alertOnDeposits: eff.alertOnDeposits,
    largeDepositThresholdUsd: eff.largeDepositThresholdUsd,
    alertOnKyc: eff.alertOnKyc,
    alertOnWithdrawals: eff.alertOnWithdrawals,
    updatedByEmail: telegramConfigCache.updatedByEmail,
    updatedAtIso: telegramConfigCache.updatedAtIso,
    ...(message ? { message } : {}),
  };
}

// =========================================================================
// Dual-Engine Email Sender (Company Email SMTP + Pass Key OR Resend API)
// =========================================================================

async function sendViaSmtp(params: {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ ok: boolean; id?: string; errorMessage?: string; statusCode?: number }> {
  if (!isSafePublicSmtpHost(params.host)) {
    return {
      ok: false,
      statusCode: 400,
      errorMessage: 'SMTP host is invalid or blocked for security reasons.',
    };
  }
  try {
    const transporter = nodemailer.createTransport({
      host: params.host,
      port: params.port,
      secure: params.secure,
      auth: {
        user: params.user,
        pass: params.pass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 8000,
      socketTimeout: 12000,
    });

    const info = await transporter.sendMail({
      from: params.from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      ...(params.html ? { html: params.html } : {}),
    });

    return {
      ok: true,
      id: typeof info?.messageId === 'string' ? info.messageId : '',
      statusCode: 200,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'SMTP delivery failed.';
    return {
      ok: false,
      statusCode: 502,
      errorMessage: `SMTP Error: ${msg.slice(0, 260)}`,
    };
  }
}

async function sendViaResend(params: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ ok: boolean; id?: string; errorMessage?: string; statusCode?: number }> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: params.from,
        to: [params.to],
        subject: params.subject,
        text: params.text,
        ...(params.html ? { html: params.html } : {}),
      }),
      signal: AbortSignal.timeout(9000),
    });

    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) {
      return {
        ok: false,
        statusCode: res.status,
        errorMessage:
          typeof data?.message === 'string' && data.message.trim()
            ? data.message.trim().slice(0, 280)
            : `Resend API rejected request (HTTP ${res.status}).`,
      };
    }

    return {
      ok: true,
      id: typeof data?.id === 'string' ? data.id : '',
      statusCode: res.status,
    };
  } catch (err) {
    return {
      ok: false,
      statusCode: 502,
      errorMessage:
        err instanceof Error
          ? `Unable to reach Resend API: ${err.message}`
          : 'Unable to reach Resend API.',
    };
  }
}

export async function sendPlatformEmail(params: {
  toEmail: string;
  subject: string;
  text: string;
  html?: string;
  forceProvider?: 'smtp' | 'resend';
}): Promise<{
  ok: boolean;
  providerUsed: 'smtp' | 'resend' | 'none';
  fromEmail: string;
  source: string;
  id?: string;
  errorMessage?: string;
  statusCode?: number;
}> {
  const eff = resolveEffectiveEmailEngine();
  const chosen = params.forceProvider || eff.activeProvider;

  if (chosen === 'smtp' && eff.smtpConfigured) {
    const res = await sendViaSmtp({
      host: eff.smtpHost,
      port: eff.smtpPort,
      secure: eff.smtpSecure,
      user: eff.smtpUser,
      pass: eff.smtpPass,
      from: eff.smtpFromEmail,
      to: params.toEmail,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    return {
      ...res,
      providerUsed: 'smtp',
      fromEmail: eff.smtpFromEmail,
      source: `smtp:${eff.activeSmtpSource}`,
    };
  }

  if (chosen === 'resend' && eff.resendApiKey) {
    const res = await sendViaResend({
      apiKey: eff.resendApiKey,
      from: eff.resendFromEmail,
      to: params.toEmail,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    return {
      ...res,
      providerUsed: 'resend',
      fromEmail: eff.resendFromEmail,
      source: `resend:${eff.activeApiKeySource}`,
    };
  }

  return {
    ok: false,
    providerUsed: 'none',
    fromEmail: eff.resendFromEmail,
    source: 'none',
    statusCode: 400,
    errorMessage:
      'No email delivery provider is configured yet. Add your Company Email + Pass Key (SMTP) or a Resend API Key in Super Admin → Email, SMTP & Alerts.',
  };
}

// =========================================================================
// Telegram Admin Bot Dispatcher (Hardcoded api.telegram.org endpoint only)
// =========================================================================

export async function sendTelegramAdminAlert(
  messageText: string,
  opts?: { forceSend?: boolean }
): Promise<{ ok: boolean; messageId?: string; errorMessage?: string }> {
  const eff = resolveEffectiveTelegram();
  if (!opts?.forceSend && !eff.enabled) {
    return { ok: false, errorMessage: 'Telegram Admin alerts are disabled.' };
  }
  if (!eff.botToken || !eff.adminChatId) {
    return {
      ok: false,
      errorMessage: 'Telegram Bot Token or Admin Chat ID is not configured.',
    };
  }

  // Strictly validate token format to prevent URL manipulation
  if (!/^[0-9]{5,15}:[A-Za-z0-9_-]{20,100}$/.test(eff.botToken)) {
    return {
      ok: false,
      errorMessage: 'Telegram Bot Token format appears invalid. Copy the exact token from @BotFather.',
    };
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(eff.botToken)}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: eff.adminChatId,
          text: messageText.slice(0, 3800),
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(7000),
      }
    );
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
      result?: { message_id?: number };
    };
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        errorMessage: data.description || `Telegram API error (HTTP ${res.status}).`,
      };
    }
    return {
      ok: true,
      messageId: data.result?.message_id ? String(data.result.message_id) : '',
    };
  } catch (err) {
    return {
      ok: false,
      errorMessage:
        err instanceof Error
          ? `Unable to reach Telegram API: ${err.message}`
          : 'Unable to reach Telegram API.',
    };
  }
}

// =========================================================================
// Branded Institutional Email Template Builder
// =========================================================================

function buildBrandedEmailHtml(params: {
  eyebrow: string;
  heading: string;
  intro: string;
  rows?: Array<{ label: string; value: string }>;
  footerNote?: string;
  accentColor?: string;
}): string {
  const accent = params.accentColor || '#10B981';
  const rowsHtml = (params.rows || [])
    .map(
      (r) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #1E293B;color:#94A3B8;font-size:12px;font-weight:600;">${escapeHtml(
            r.label
          )}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #1E293B;color:#F8FAFC;font-size:12px;font-family:monospace;text-align:right;word-break:break-all;">${escapeHtml(
            r.value
          )}</td>
        </tr>`
    )
    .join('');

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:580px;margin:0 auto;padding:24px;background:#0B111E;color:#E2E8F0;border-radius:14px;border:1px solid #1E293B;">
      <div style="font-size:11px;font-family:monospace;color:${accent};text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">${escapeHtml(
        params.eyebrow
      )}</div>
      <h2 style="margin:0 0 12px;color:#FFFFFF;font-size:20px;line-height:1.3;">${escapeHtml(
        params.heading
      )}</h2>
      <p style="margin:0 0 18px;color:#CBD5E1;font-size:14px;line-height:1.6;">${escapeHtml(
        params.intro
      )}</p>
      ${
        rowsHtml
          ? `<table style="width:100%;border-collapse:collapse;background:#0F172A;border:1px solid #1E293B;border-radius:10px;overflow:hidden;margin-bottom:18px;">${rowsHtml}</table>`
          : ''
      }
      <p style="margin:0;color:#64748B;font-size:11px;line-height:1.5;">${escapeHtml(
        params.footerNote ||
          'AlphaTradex Institutional Desk • Automated Security & Account Notification. Never share OTP codes or passwords with anyone.'
      )}</p>
    </div>
  `;
}

// =========================================================================
// Automated Event Notification Helpers (Email + Telegram)
// =========================================================================

export type PlatformNotificationEventType =
  | 'welcome'
  | 'deposit_submitted'
  | 'deposit_confirmed'
  | 'withdrawal_requested'
  | 'withdrawal_approved'
  | 'withdrawal_rejected'
  | 'kyc_submitted'
  | 'kyc_approved'
  | 'kyc_rejected'
  | 'login_new_device';

export async function triggerAutomatedEventNotifications(params: {
  eventType: PlatformNotificationEventType;
  userEmail: string;
  userName: string;
  amountUsd?: number;
  network?: string;
  txHash?: string;
  destinationAddress?: string;
  reason?: string;
  deviceSummary?: string;
  sourceLabel?: string;
}): Promise<{ emailSent: boolean; telegramSent: boolean }> {
  const emailEff = resolveEffectiveEmailEngine();
  const tgEff = resolveEffectiveTelegram();

  let emailSent = false;
  let telegramSent = false;
  const nowUtc = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const amtStr =
    typeof params.amountUsd === 'number' && Number.isFinite(params.amountUsd)
      ? `$${params.amountUsd.toFixed(2)} USD`
      : '';

  const safeUser = params.userName || 'Investor';

  // 1. User-facing Automated Emails
  if (params.userEmail && isValidEmailAddress(params.userEmail) && emailEff.activeProvider !== 'none') {
    if (params.eventType === 'welcome' && emailEff.automation.welcomeEmailEnabled) {
      const r = await sendPlatformEmail({
        toEmail: params.userEmail,
        subject: 'Welcome to AlphaTradex — Your Institutional Account Is Ready',
        text: `Welcome ${safeUser}!\n\nYour AlphaTradex account (${params.userEmail}) is now active. Complete KYC verification, whitelist your USDT withdrawal wallet, and explore AI trading packages in your Vault Dashboard.`,
        html: buildBrandedEmailHtml({
          eyebrow: 'AlphaTradex Onboarding',
          heading: `Welcome to AlphaTradex, ${safeUser}`,
          intro:
            'Your institutional client account is now active. You can deposit funds via Web3 or verified payment methods, enable withdrawal address whitelisting, and track portfolio performance in real time.',
          rows: [
            { label: 'Account Email', value: params.userEmail },
            { label: 'Activated At', value: nowUtc },
          ],
        }),
      });
      emailSent = r.ok;
    } else if (
      params.eventType === 'deposit_confirmed' &&
      emailEff.automation.depositConfirmedEmailEnabled
    ) {
      const r = await sendPlatformEmail({
        toEmail: params.userEmail,
        subject: `Deposit Confirmed: ${amtStr} Credited to Your AlphaTradex Vault`,
        text: `Hello ${safeUser},\n\nYour deposit of ${amtStr} (${params.network || 'USDT'}) has been confirmed and credited to your Deposit Wallet.\nTX Reference: ${params.txHash || 'Verified'}\nTimestamp: ${nowUtc}`,
        html: buildBrandedEmailHtml({
          eyebrow: 'Deposit Receipt • Confirmed',
          heading: `${amtStr} Credited to Your Deposit Wallet`,
          intro: `Hi ${safeUser}, your incoming deposit has been verified and credited to your AlphaTradex vault balance.`,
          rows: [
            { label: 'Credited Amount', value: amtStr },
            { label: 'Network / Method', value: params.network || 'USDT' },
            { label: 'Verification', value: params.sourceLabel || 'Verified' },
            { label: 'TX Hash / Ref', value: params.txHash || '—' },
            { label: 'Timestamp', value: nowUtc },
          ],
          accentColor: '#10B981',
        }),
      });
      emailSent = r.ok;
    } else if (
      params.eventType === 'withdrawal_requested' &&
      emailEff.automation.withdrawalStatusEmailEnabled
    ) {
      const r = await sendPlatformEmail({
        toEmail: params.userEmail,
        subject: `Withdrawal Request Received: ${amtStr} (${params.network || 'USDT'})`,
        text: `Hello ${safeUser},\n\nWe received your withdrawal request for ${amtStr} to ${params.destinationAddress || 'your wallet'} (${params.network || 'USDT'}). Funds are safely held while awaiting Super Admin security approval.`,
        html: buildBrandedEmailHtml({
          eyebrow: 'Withdrawal Security Desk',
          heading: `Withdrawal Request Pending Review`,
          intro: `Hi ${safeUser}, your withdrawal request has been locked in pending review. You will receive another confirmation email with the payout transaction hash once processed.`,
          rows: [
            { label: 'Requested Amount', value: amtStr },
            { label: 'Network', value: params.network || 'USDT' },
            { label: 'Destination Wallet', value: params.destinationAddress || '—' },
            { label: 'Status', value: 'PENDING ADMIN APPROVAL' },
            { label: 'Submitted At', value: nowUtc },
          ],
          accentColor: '#F59E0B',
        }),
      });
      emailSent = r.ok;
    } else if (
      params.eventType === 'withdrawal_approved' &&
      emailEff.automation.withdrawalStatusEmailEnabled
    ) {
      const r = await sendPlatformEmail({
        toEmail: params.userEmail,
        subject: `Withdrawal Approved & Paid: ${amtStr}`,
        text: `Hello ${safeUser},\n\nYour withdrawal of ${amtStr} (${params.network || 'USDT'}) has been approved and sent to ${params.destinationAddress || 'your wallet'}.\nPayout TX Hash: ${params.txHash || 'Processed'}`,
        html: buildBrandedEmailHtml({
          eyebrow: 'Payout Dispatched • Completed',
          heading: `Your Withdrawal of ${amtStr} Has Been Paid`,
          intro: `Hi ${safeUser}, Super Admin has verified and dispatched your payout to your designated wallet address.`,
          rows: [
            { label: 'Amount', value: amtStr },
            { label: 'Network', value: params.network || 'USDT' },
            { label: 'Destination', value: params.destinationAddress || '—' },
            { label: 'Payout TX Hash', value: params.txHash || 'Verified' },
            { label: 'Processed At', value: nowUtc },
          ],
          accentColor: '#10B981',
        }),
      });
      emailSent = r.ok;
    } else if (
      params.eventType === 'withdrawal_rejected' &&
      emailEff.automation.withdrawalStatusEmailEnabled
    ) {
      const r = await sendPlatformEmail({
        toEmail: params.userEmail,
        subject: `Withdrawal Update: ${amtStr} Refunded to Your Wallet`,
        text: `Hello ${safeUser},\n\nYour withdrawal request for ${amtStr} was declined and the full balance has been refunded to your AlphaTradex wallet.\nNote: ${params.reason || 'Contact support for details.'}`,
        html: buildBrandedEmailHtml({
          eyebrow: 'Withdrawal Declined • Balance Refunded',
          heading: `Withdrawal Request Returned to Your Balance`,
          intro: `Hi ${safeUser}, your withdrawal request was not approved and the held funds have been automatically refunded back to your wallet.`,
          rows: [
            { label: 'Refunded Amount', value: amtStr },
            { label: 'Reason / Admin Note', value: params.reason || 'Security review declined' },
            { label: 'Timestamp', value: nowUtc },
          ],
          accentColor: '#EF4444',
        }),
      });
      emailSent = r.ok;
    } else if (
      params.eventType === 'kyc_approved' &&
      emailEff.automation.kycStatusEmailEnabled
    ) {
      const r = await sendPlatformEmail({
        toEmail: params.userEmail,
        subject: 'KYC Identity Verification Approved — AlphaTradex',
        text: `Hello ${safeUser},\n\nYour identity verification (KYC) has been approved by our compliance team. All account withdrawal and investment privileges are now unlocked.`,
        html: buildBrandedEmailHtml({
          eyebrow: 'Compliance & KYC Verification',
          heading: 'Your KYC Verification Is Approved',
          intro: `Congratulations ${safeUser}! Your identity documents have been verified and approved. Full deposit, trading, and withdrawal privileges are active.`,
          rows: [
            { label: 'Account', value: params.userEmail },
            { label: 'KYC Status', value: 'APPROVED' },
            { label: 'Verified At', value: nowUtc },
          ],
          accentColor: '#10B981',
        }),
      });
      emailSent = r.ok;
    } else if (
      params.eventType === 'kyc_rejected' &&
      emailEff.automation.kycStatusEmailEnabled
    ) {
      const r = await sendPlatformEmail({
        toEmail: params.userEmail,
        subject: 'Action Required: KYC Verification Update — AlphaTradex',
        text: `Hello ${safeUser},\n\nYour KYC submission requires attention.\nReason: ${params.reason || 'Document image unclear or mismatch.'}\nPlease log in to your dashboard and re-submit clear documents.`,
        html: buildBrandedEmailHtml({
          eyebrow: 'Compliance & KYC Review',
          heading: 'KYC Submission Requires Attention',
          intro: `Hi ${safeUser}, we were unable to approve your recent KYC submission. Please review the reason below and upload updated documents in your dashboard.`,
          rows: [
            { label: 'KYC Status', value: 'ACTION REQUIRED / REJECTED' },
            { label: 'Reviewer Note', value: params.reason || 'Please submit clearer ID photos.' },
            { label: 'Timestamp', value: nowUtc },
          ],
          accentColor: '#EF4444',
        }),
      });
      emailSent = r.ok;
    } else if (
      params.eventType === 'login_new_device' &&
      emailEff.automation.loginAlertEmailEnabled
    ) {
      const r = await sendPlatformEmail({
        toEmail: params.userEmail,
        subject: 'Security Alert: New Sign-In Device Detected — AlphaTradex',
        text: `Hello ${safeUser},\n\nA sign-in to your AlphaTradex account was detected from a new device or browser.\nDevice: ${params.deviceSummary || 'Unknown browser'}\nTime: ${nowUtc}\n\nIf this wasn't you, change your password immediately and lock your withdrawal whitelist.`,
        html: buildBrandedEmailHtml({
          eyebrow: 'Account Security Alert',
          heading: 'New Device Sign-In Detected',
          intro: `Hi ${safeUser}, we noticed a sign-in to your AlphaTradex account from a new device or browser. If this was you, no action is needed. If not, secure your account immediately.`,
          rows: [
            { label: 'Device / Browser', value: params.deviceSummary || 'New Browser Session' },
            { label: 'Account', value: params.userEmail },
            { label: 'Detected At', value: nowUtc },
          ],
          accentColor: '#F59E0B',
        }),
      });
      emailSent = r.ok;
    }
  }

  // 2. Super Admin Telegram Bot Instant Alerts
  if (tgEff.enabled && tgEff.botToken && tgEff.adminChatId) {
    const amt = Number(params.amountUsd || 0);
    if (
      (params.eventType === 'deposit_confirmed' || params.eventType === 'deposit_submitted') &&
      tgEff.alertOnDeposits &&
      amt >= tgEff.largeDepositThresholdUsd
    ) {
      const title =
        params.eventType === 'deposit_confirmed'
          ? '💰 <b>DEPOSIT CONFIRMED</b>'
          : '📥 <b>NEW MANUAL DEPOSIT SUBMITTED</b>';
      const tgRes = await sendTelegramAdminAlert(
        `${title}\nUser: <b>${escapeHtml(safeUser)}</b> (${escapeHtml(params.userEmail)})\nAmount: <b>${escapeHtml(
          amtStr
        )}</b>\nNetwork: ${escapeHtml(params.network || 'USDT')}\nSource: ${escapeHtml(
          params.sourceLabel || 'Vault'
        )}\nTX: <code>${escapeHtml((params.txHash || '—').slice(0, 80))}</code>\nTime: ${nowUtc}`
      );
      telegramSent = tgRes.ok;
    } else if (params.eventType === 'withdrawal_requested' && tgEff.alertOnWithdrawals) {
      const tgRes = await sendTelegramAdminAlert(
        `🚨 <b>NEW WITHDRAWAL REQUEST</b>\nUser: <b>${escapeHtml(safeUser)}</b> (${escapeHtml(
          params.userEmail
        )})\nAmount: <b>${escapeHtml(amtStr)}</b>\nNetwork: ${escapeHtml(
          params.network || 'USDT'
        )}\nDestination: <code>${escapeHtml(
          (params.destinationAddress || '—').slice(0, 80)
        )}</code>\nAction: Open Super Admin → Approvals to review.\nTime: ${nowUtc}`
      );
      telegramSent = tgRes.ok;
    } else if (params.eventType === 'kyc_submitted' && tgEff.alertOnKyc) {
      const tgRes = await sendTelegramAdminAlert(
        `🪪 <b>NEW KYC SUBMISSION</b>\nUser: <b>${escapeHtml(safeUser)}</b> (${escapeHtml(
          params.userEmail
        )})\nAction: Open Super Admin → KYC Verifications to review.\nTime: ${nowUtc}`
      );
      telegramSent = tgRes.ok;
    }
  }

  return { emailSent, telegramSent };
}

// =========================================================================
// Express Route Registration
// =========================================================================

export function registerNotificationHubRoutes(
  app: Express,
  deps: NotificationHubDeps
): void {
  // 1. Super Admin: Get Masked Email (Company SMTP + Resend + Automation) Config
  app.get('/api/admin/email-config', async (req, res) => {
    try {
      const caller = await deps.verifyFirebaseBearerToken(req);
      await deps.verifySuperAdminCaller(caller);

      const doc = await deps.fsGetDoc(caller.idToken, 'adminSecrets/emailConfig');
      hydrateEmailConfigCache(doc);

      res.json(buildMaskedEmailStatus());
    } catch (err) {
      const e = err as Error & { statusCode?: number; code?: string };
      res.status(e.statusCode || 500).json({
        error: e.message || 'Unable to load Email & SMTP configuration.',
        code: e.code || 'EMAIL_CONFIG_LOAD_ERROR',
      });
    }
  });

  // 2. Super Admin: Save / Rotate Company Email + Pass Key (SMTP), Resend Key, & Automation Toggles
  app.post('/api/admin/email-config', async (req, res) => {
    try {
      const caller = await deps.verifyFirebaseBearerToken(req);
      await deps.verifySuperAdminCaller(caller);

      const body = (req.body || {}) as {
        providerMode?: EmailProviderMode;
        resendApiKey?: string;
        resendFromEmail?: string;
        clearDatabaseApiKey?: boolean;
        clearDatabaseFromEmail?: boolean;
        smtpHost?: string;
        smtpPort?: number;
        smtpSecure?: boolean;
        smtpUser?: string;
        smtpPass?: string;
        smtpFromName?: string;
        smtpFromEmail?: string;
        clearDatabaseSmtpPass?: boolean;
        automation?: Partial<EmailAutomationToggles>;
      };

      const incomingKey = typeof body.resendApiKey === 'string' ? body.resendApiKey.trim() : '';
      const incomingFrom =
        typeof body.resendFromEmail === 'string' ? body.resendFromEmail.trim() : '';
      const incomingSmtpHost = typeof body.smtpHost === 'string' ? body.smtpHost.trim() : undefined;
      const incomingSmtpUser = typeof body.smtpUser === 'string' ? body.smtpUser.trim() : undefined;
      const incomingSmtpPass = typeof body.smtpPass === 'string' ? body.smtpPass.trim() : '';
      const incomingSmtpFromName =
        typeof body.smtpFromName === 'string' ? body.smtpFromName.trim().slice(0, 120) : undefined;
      const incomingSmtpFromEmail =
        typeof body.smtpFromEmail === 'string' ? body.smtpFromEmail.trim() : undefined;

      if (incomingKey && !/^[\x21-\x7E]{8,200}$/.test(incomingKey)) {
        res.status(400).json({
          error:
            'Invalid RESEND_API_KEY format. Enter 8–200 printable characters with no spaces.',
          code: 'INVALID_API_KEY',
        });
        return;
      }

      if (incomingFrom && !isValidFromEmail(incomingFrom)) {
        res.status(400).json({
          error:
            'Invalid RESEND_FROM_EMAIL format. Use sender@yourdomain.com or "AlphaTradex <sender@yourdomain.com>".',
          code: 'INVALID_FROM_EMAIL',
        });
        return;
      }

      if (incomingSmtpHost && !isSafePublicSmtpHost(incomingSmtpHost)) {
        res.status(400).json({
          error:
            'Invalid SMTP Host. Enter a valid public mail server hostname (e.g. smtp.gmail.com, smtp.zoho.com, smtp.hostinger.com, mail.yourdomain.com).',
          code: 'INVALID_SMTP_HOST',
        });
        return;
      }

      if (incomingSmtpUser && !isValidEmailAddress(incomingSmtpUser)) {
        res.status(400).json({
          error: 'Invalid Company Email (SMTP Username). Enter a valid email address.',
          code: 'INVALID_SMTP_USER',
        });
        return;
      }

      if (incomingSmtpFromEmail && !isValidFromEmail(incomingSmtpFromEmail)) {
        res.status(400).json({
          error:
            'Invalid SMTP From Email format. Use support@yourdomain.com or "AlphaTradex <support@yourdomain.com>".',
          code: 'INVALID_SMTP_FROM',
        });
        return;
      }

      if (incomingSmtpPass && (incomingSmtpPass.length < 4 || incomingSmtpPass.length > 220)) {
        res.status(400).json({
          error: 'SMTP Pass Key / App Password must be between 4 and 220 characters.',
          code: 'INVALID_SMTP_PASS',
        });
        return;
      }

      const txHandle = await deps.fsBeginTransaction(caller.idToken);
      try {
        const existingDoc = await deps.fsGetDoc(
          caller.idToken,
          'adminSecrets/emailConfig',
          txHandle
        );

        const prevResendKey = String(existingDoc?.resendApiKey || '').trim();
        const prevResendFrom = String(existingDoc?.resendFromEmail || '').trim();
        const prevSmtpHost = String(existingDoc?.smtpHost || '').trim();
        const prevSmtpPort = Number(existingDoc?.smtpPort || 587);
        const prevSmtpSecure = existingDoc?.smtpSecure === true;
        const prevSmtpUser = String(existingDoc?.smtpUser || '').trim();
        const prevSmtpPass = String(existingDoc?.smtpPass || '').trim();
        const prevSmtpFromName = String(existingDoc?.smtpFromName || 'AlphaTradex').trim();
        const prevSmtpFromEmail = String(existingDoc?.smtpFromEmail || '').trim();
        const prevMode = String(existingDoc?.providerMode || 'auto').trim();

        const nextMode: EmailProviderMode =
          body.providerMode === 'smtp' ||
          body.providerMode === 'resend' ||
          body.providerMode === 'auto'
            ? body.providerMode
            : prevMode === 'smtp' || prevMode === 'resend'
            ? prevMode
            : 'auto';

        const nextResendKey = body.clearDatabaseApiKey ? '' : incomingKey || prevResendKey;
        const nextResendLast4 = nextResendKey.length >= 4 ? nextResendKey.slice(-4) : '';
        const nextResendFrom = body.clearDatabaseFromEmail
          ? ''
          : typeof body.resendFromEmail === 'string'
          ? incomingFrom
          : prevResendFrom;

        const nextSmtpHost =
          incomingSmtpHost !== undefined ? incomingSmtpHost : prevSmtpHost;
        const parsedPort = Number(body.smtpPort);
        const nextSmtpPort =
          body.smtpPort !== undefined &&
          Number.isFinite(parsedPort) &&
          parsedPort >= 1 &&
          parsedPort <= 65535
            ? Math.round(parsedPort)
            : Number.isFinite(prevSmtpPort) && prevSmtpPort >= 1
            ? prevSmtpPort
            : 587;
        const nextSmtpSecure =
          typeof body.smtpSecure === 'boolean' ? body.smtpSecure : prevSmtpSecure;
        const nextSmtpUser =
          incomingSmtpUser !== undefined ? incomingSmtpUser : prevSmtpUser;
        const nextSmtpPass = body.clearDatabaseSmtpPass ? '' : incomingSmtpPass || prevSmtpPass;
        const nextSmtpPassLast4 = nextSmtpPass.length >= 4 ? nextSmtpPass.slice(-4) : '';
        const nextSmtpFromName =
          incomingSmtpFromName !== undefined
            ? incomingSmtpFromName || 'AlphaTradex'
            : prevSmtpFromName || 'AlphaTradex';
        const nextSmtpFromEmail =
          incomingSmtpFromEmail !== undefined ? incomingSmtpFromEmail : prevSmtpFromEmail;

        const nextAutomation: EmailAutomationToggles = {
          welcomeEmailEnabled:
            typeof body.automation?.welcomeEmailEnabled === 'boolean'
              ? body.automation.welcomeEmailEnabled
              : existingDoc?.welcomeEmailEnabled !== false,
          depositConfirmedEmailEnabled:
            typeof body.automation?.depositConfirmedEmailEnabled === 'boolean'
              ? body.automation.depositConfirmedEmailEnabled
              : existingDoc?.depositConfirmedEmailEnabled !== false,
          withdrawalStatusEmailEnabled:
            typeof body.automation?.withdrawalStatusEmailEnabled === 'boolean'
              ? body.automation.withdrawalStatusEmailEnabled
              : existingDoc?.withdrawalStatusEmailEnabled !== false,
          kycStatusEmailEnabled:
            typeof body.automation?.kycStatusEmailEnabled === 'boolean'
              ? body.automation.kycStatusEmailEnabled
              : existingDoc?.kycStatusEmailEnabled !== false,
          loginAlertEmailEnabled:
            typeof body.automation?.loginAlertEmailEnabled === 'boolean'
              ? body.automation.loginAlertEmailEnabled
              : existingDoc?.loginAlertEmailEnabled !== false,
        };

        const nowIso = new Date().toISOString();
        const audId = deps.makeServerDocId('aud');
        const adminLogId = deps.makeServerDocId('alog');

        // Strictly sanitized audit summary — NEVER log raw SMTP pass keys or Resend API keys
        const summaryParts = [
          `Mode: ${nextMode.toUpperCase()}`,
          incomingSmtpPass
            ? `SMTP Pass Key updated (${maskSecretValue(nextSmtpPass, nextSmtpPassLast4)})`
            : body.clearDatabaseSmtpPass
            ? 'SMTP Pass Key cleared'
            : nextSmtpUser
            ? `SMTP User: ${nextSmtpUser}`
            : 'SMTP not set',
          incomingKey
            ? `Resend Key updated (${maskSecretValue(nextResendKey, nextResendLast4)})`
            : body.clearDatabaseApiKey
            ? 'Resend Key cleared'
            : nextResendKey
            ? `Resend Key active (${maskSecretValue(nextResendKey, nextResendLast4)})`
            : 'Resend Key unset',
        ];
        const auditDetails = `Email & SMTP settings saved. ${summaryParts.join(' | ')}.`.slice(
          0,
          490
        );

        const nextRecord = {
          providerMode: nextMode,
          resendApiKey: nextResendKey,
          resendApiKeyLast4: nextResendLast4,
          resendFromEmail: nextResendFrom,
          smtpHost: nextSmtpHost,
          smtpPort: nextSmtpPort,
          smtpSecure: nextSmtpSecure,
          smtpUser: nextSmtpUser,
          smtpPass: nextSmtpPass,
          smtpPassLast4: nextSmtpPassLast4,
          smtpFromName: nextSmtpFromName,
          smtpFromEmail: nextSmtpFromEmail,
          ...nextAutomation,
          updatedByUid: caller.uid,
          updatedByEmail: caller.email,
          updatedAtIso: nowIso,
        };

        await deps.fsCommitTransaction(caller.idToken, txHandle, [
          deps.buildUpsertWrite('adminSecrets/emailConfig', nextRecord, ['updatedAt']),
          deps.buildCreateWrite(
            `auditLogs/${audId}`,
            {
              actorUid: caller.uid,
              actorEmail: caller.email,
              actorRole: 'admin',
              eventType: 'EMAIL_API_CONFIG_UPDATED',
              targetUid: caller.uid,
              network: 'EMAIL_ENGINE',
              txHash: '',
              amountUsd: 0,
              details: auditDetails,
            },
            ['createdAt']
          ),
          deps.buildCreateWrite(
            `adminLogs/${adminLogId}`,
            {
              adminUid: caller.uid,
              adminEmail: caller.email,
              action: 'EMAIL_API_CONFIG_UPDATED',
              targetUid: 'emailConfig',
              targetLabel: 'Email, Company SMTP & Alerts',
              details: auditDetails,
              amountUsd: 0,
            },
            ['createdAt']
          ),
        ]);

        hydrateEmailConfigCache(nextRecord);

        res.json(
          buildMaskedEmailStatus(
            'Email, Company SMTP & automation settings saved and activated live without redeploying.'
          )
        );
      } catch (txErr) {
        await deps.fsRollbackTransaction(caller.idToken, txHandle);
        throw txErr;
      }
    } catch (err) {
      const e = err as Error & { statusCode?: number; code?: string };
      res.status(e.statusCode || 500).json({
        error: e.message || 'Unable to save Email & SMTP configuration.',
        code: e.code || 'EMAIL_CONFIG_SAVE_ERROR',
      });
    }
  });

  // 3. Super Admin: Send Live Test Email (via Company SMTP or Resend)
  app.post('/api/admin/email-config/test', async (req, res) => {
    try {
      const caller = await deps.verifyFirebaseBearerToken(req);
      await deps.verifySuperAdminCaller(caller);

      const doc = await deps.fsGetDoc(caller.idToken, 'adminSecrets/emailConfig');
      hydrateEmailConfigCache(doc);

      const body = (req.body || {}) as {
        toEmail?: string;
        forceProvider?: 'smtp' | 'resend';
      };
      const targetEmail =
        typeof body.toEmail === 'string' && body.toEmail.trim()
          ? body.toEmail.trim()
          : caller.email;

      if (!isValidEmailAddress(targetEmail)) {
        res.status(400).json({
          error: 'Invalid recipient email address for test email.',
          code: 'INVALID_RECIPIENT_EMAIL',
        });
        return;
      }

      const sentAtIso = new Date().toISOString();
      const sendResult = await sendPlatformEmail({
        toEmail: targetEmail,
        forceProvider:
          body.forceProvider === 'smtp' || body.forceProvider === 'resend'
            ? body.forceProvider
            : undefined,
        subject: 'AlphaTradex Super Admin — Email Delivery Test Confirmation',
        text: [
          'AlphaTradex Email Automation & Security Verification',
          '',
          `Status: Delivery pipeline verified successfully.`,
          `Triggered By: ${caller.email}`,
          `Timestamp (UTC): ${sentAtIso}`,
        ].join('\n'),
        html: buildBrandedEmailHtml({
          eyebrow: 'AlphaTradex Email & Security Engine',
          heading: 'Live Email Delivery Confirmed',
          intro:
            'Your saved Company Email (SMTP) / Resend configuration is active and ready for withdrawal 2FA OTPs, deposit receipts, KYC alerts, and broadcast campaigns.',
          rows: [
            { label: 'Triggered By', value: caller.email },
            { label: 'Recipient', value: targetEmail },
            { label: 'UTC Time', value: sentAtIso },
          ],
        }),
      });

      if (!sendResult.ok) {
        res.status(sendResult.statusCode || 502).json({
          error: sendResult.errorMessage || 'Test email delivery failed.',
          code: 'EMAIL_TEST_FAILED',
          providerUsed: sendResult.providerUsed,
          fromEmail: sendResult.fromEmail,
        });
        return;
      }

      try {
        const txHandle = await deps.fsBeginTransaction(caller.idToken);
        const audId = deps.makeServerDocId('aud');
        await deps.fsCommitTransaction(caller.idToken, txHandle, [
          deps.buildCreateWrite(
            `auditLogs/${audId}`,
            {
              actorUid: caller.uid,
              actorEmail: caller.email,
              actorRole: 'admin',
              eventType: 'EMAIL_API_TEST_SENT',
              targetUid: caller.uid,
              network: sendResult.providerUsed.toUpperCase(),
              txHash: (sendResult.id || '').slice(0, 120),
              amountUsd: 0,
              details: `Sent test email to ${targetEmail} via ${sendResult.providerUsed.toUpperCase()} (${sendResult.source}) from ${sendResult.fromEmail}`.slice(
                0,
                490
              ),
            },
            ['createdAt']
          ),
        ]);
      } catch {
        // Test email already succeeded
      }

      res.json({
        ok: true,
        messageId: sendResult.id || '',
        toEmail: targetEmail,
        fromEmail: sendResult.fromEmail,
        providerUsed: sendResult.providerUsed,
        activeApiKeySource: sendResult.source,
        message: `Test email sent successfully to ${targetEmail} via ${sendResult.providerUsed.toUpperCase()}${
          sendResult.id ? ` (ID: ${sendResult.id})` : ''
        }.`,
      });
    } catch (err) {
      const e = err as Error & { statusCode?: number; code?: string };
      res.status(e.statusCode || 500).json({
        error: e.message || 'Unable to send test email.',
        code: e.code || 'EMAIL_TEST_ERROR',
      });
    }
  });

  // 4. Super Admin: Bulk Email / Broadcast Campaign
  app.post('/api/admin/email/broadcast', async (req, res) => {
    try {
      const caller = await deps.verifyFirebaseBearerToken(req);
      await deps.verifySuperAdminCaller(caller);

      const doc = await deps.fsGetDoc(caller.idToken, 'adminSecrets/emailConfig');
      hydrateEmailConfigCache(doc);

      const eff = resolveEffectiveEmailEngine();
      if (eff.activeProvider === 'none') {
        res.status(400).json({
          error:
            'Configure your Company Email + Pass Key (SMTP) or Resend API Key before sending a broadcast campaign.',
          code: 'NO_EMAIL_PROVIDER',
        });
        return;
      }

      const body = (req.body || {}) as {
        segmentLabel?: string;
        subject?: string;
        message?: string;
        recipients?: Array<{ email: string; name?: string }>;
      };

      const subject = String(body.subject || '').trim().slice(0, 160);
      const message = String(body.message || '').trim().slice(0, 4000);
      const segmentLabel = String(body.segmentLabel || 'Selected Clients').trim().slice(0, 80);

      if (!subject || subject.length < 3 || /[\r\n]/.test(subject)) {
        res.status(400).json({ error: 'Enter a valid email subject line (3–160 characters).' });
        return;
      }
      if (!message || message.length < 10) {
        res.status(400).json({ error: 'Enter an announcement message (at least 10 characters).' });
        return;
      }

      const rawRecipients = Array.isArray(body.recipients) ? body.recipients : [];
      const deduped = new Map<string, string>();
      for (const item of rawRecipients) {
        const email = String(item?.email || '').trim().toLowerCase();
        if (isValidEmailAddress(email) && !deduped.has(email)) {
          deduped.set(email, String(item?.name || 'Valued Client').trim().slice(0, 80));
        }
        if (deduped.size >= 150) break;
      }

      if (deduped.size === 0) {
        res.status(400).json({ error: 'No valid recipient email addresses found for this segment.' });
        return;
      }

      let sentCount = 0;
      let failedCount = 0;
      let firstError = '';

      for (const [email, name] of deduped.entries()) {
        const personalizedBody = message.replace(/\{\{name\}\}/gi, name);
        const r = await sendPlatformEmail({
          toEmail: email,
          subject,
          text: personalizedBody,
          html: buildBrandedEmailHtml({
            eyebrow: 'AlphaTradex Official Announcement',
            heading: subject,
            intro: personalizedBody,
            rows: [
              { label: 'Recipient', value: `${name} (${email})` },
              { label: 'Audience', value: segmentLabel },
            ],
          }),
        });
        if (r.ok) {
          sentCount += 1;
        } else {
          failedCount += 1;
          if (!firstError && r.errorMessage) firstError = r.errorMessage;
        }
      }

      // Log campaign in auditLogs & adminLogs
      try {
        const txHandle = await deps.fsBeginTransaction(caller.idToken);
        const audId = deps.makeServerDocId('aud');
        const adminLogId = deps.makeServerDocId('alog');
        const details = `Broadcast "${subject}" to ${segmentLabel}: ${sentCount} sent, ${failedCount} failed via ${eff.activeProvider.toUpperCase()}.`.slice(
          0,
          490
        );
        await deps.fsCommitTransaction(caller.idToken, txHandle, [
          deps.buildCreateWrite(
            `auditLogs/${audId}`,
            {
              actorUid: caller.uid,
              actorEmail: caller.email,
              actorRole: 'admin',
              eventType: 'BULK_EMAIL_BROADCAST_SENT',
              targetUid: caller.uid,
              network: eff.activeProvider.toUpperCase(),
              txHash: '',
              amountUsd: 0,
              details,
            },
            ['createdAt']
          ),
          deps.buildCreateWrite(
            `adminLogs/${adminLogId}`,
            {
              adminUid: caller.uid,
              adminEmail: caller.email,
              action: 'BULK_EMAIL_BROADCAST_SENT',
              targetUid: 'broadcast',
              targetLabel: segmentLabel,
              details,
              amountUsd: 0,
            },
            ['createdAt']
          ),
        ]);
      } catch {
        // Non-blocking audit write
      }

      res.json({
        ok: sentCount > 0,
        sentCount,
        failedCount,
        totalAttempted: deduped.size,
        providerUsed: eff.activeProvider,
        firstError: firstError || undefined,
        message:
          sentCount > 0
            ? `Broadcast completed via ${eff.activeProvider.toUpperCase()}: ${sentCount} delivered${
                failedCount > 0 ? `, ${failedCount} failed` : ''
              }.`
            : firstError || 'Broadcast failed to deliver.',
      });
    } catch (err) {
      const e = err as Error & { statusCode?: number; code?: string };
      res.status(e.statusCode || 500).json({
        error: e.message || 'Unable to execute broadcast campaign.',
        code: e.code || 'BROADCAST_ERROR',
      });
    }
  });

  // 5. Super Admin: Get Masked Telegram Bot Config
  app.get('/api/admin/telegram-config', async (req, res) => {
    try {
      const caller = await deps.verifyFirebaseBearerToken(req);
      await deps.verifySuperAdminCaller(caller);

      const doc = await deps.fsGetDoc(caller.idToken, 'adminSecrets/telegramConfig');
      hydrateTelegramConfigCache(doc);

      res.json(buildMaskedTelegramStatus());
    } catch (err) {
      const e = err as Error & { statusCode?: number; code?: string };
      res.status(e.statusCode || 500).json({
        error: e.message || 'Unable to load Telegram Admin Bot configuration.',
        code: e.code || 'TELEGRAM_CONFIG_LOAD_ERROR',
      });
    }
  });

  // 6. Super Admin: Save Telegram Bot Token, Admin Chat ID & Trigger Rules
  app.post('/api/admin/telegram-config', async (req, res) => {
    try {
      const caller = await deps.verifyFirebaseBearerToken(req);
      await deps.verifySuperAdminCaller(caller);

      const body = (req.body || {}) as {
        enabled?: boolean;
        botToken?: string;
        clearDatabaseBotToken?: boolean;
        adminChatId?: string;
        alertOnDeposits?: boolean;
        largeDepositThresholdUsd?: number;
        alertOnKyc?: boolean;
        alertOnWithdrawals?: boolean;
      };

      const incomingToken = typeof body.botToken === 'string' ? body.botToken.trim() : '';
      const incomingChatId =
        typeof body.adminChatId === 'string' ? body.adminChatId.trim() : undefined;

      if (incomingToken && !/^[0-9]{5,15}:[A-Za-z0-9_-]{20,100}$/.test(incomingToken)) {
        res.status(400).json({
          error:
            'Invalid Telegram Bot Token format. Expected format like 123456789:ABCdefGHIjklMNO... from @BotFather.',
          code: 'INVALID_TELEGRAM_TOKEN',
        });
        return;
      }

      if (incomingChatId && !/^-?[0-9]{4,24}$/.test(incomingChatId)) {
        res.status(400).json({
          error:
            'Invalid Telegram Chat ID. Enter a numeric Chat/Channel ID (e.g. 123456789 or -1001234567890).',
          code: 'INVALID_TELEGRAM_CHAT_ID',
        });
        return;
      }

      const txHandle = await deps.fsBeginTransaction(caller.idToken);
      try {
        const existingDoc = await deps.fsGetDoc(
          caller.idToken,
          'adminSecrets/telegramConfig',
          txHandle
        );
        const prevToken = String(existingDoc?.botToken || '').trim();
        const nextToken = body.clearDatabaseBotToken ? '' : incomingToken || prevToken;
        const nextLast4 = nextToken.length >= 4 ? nextToken.slice(-4) : '';
        const nextChatId =
          incomingChatId !== undefined
            ? incomingChatId
            : String(existingDoc?.adminChatId || '').trim();
        const nextThresholdRaw = Number(
          body.largeDepositThresholdUsd ?? existingDoc?.largeDepositThresholdUsd ?? 100
        );
        const nextThreshold =
          Number.isFinite(nextThresholdRaw) && nextThresholdRaw >= 0
            ? Math.min(10_000_000, nextThresholdRaw)
            : 100;

        const nowIso = new Date().toISOString();
        const audId = deps.makeServerDocId('aud');
        const adminLogId = deps.makeServerDocId('alog');

        const hasNewCredentials = Boolean(incomingToken && nextChatId && !prevToken);
        const resolvedEnabled =
          typeof body.enabled === 'boolean'
            ? body.enabled || (hasNewCredentials && existingDoc?.enabled !== false)
            : Boolean(nextToken && nextChatId) || existingDoc?.enabled === true;

        const nextRecord = {
          enabled: resolvedEnabled,
          botToken: nextToken,
          botTokenLast4: nextLast4,
          adminChatId: nextChatId,
          alertOnDeposits:
            typeof body.alertOnDeposits === 'boolean'
              ? body.alertOnDeposits
              : existingDoc?.alertOnDeposits !== false,
          largeDepositThresholdUsd: nextThreshold,
          alertOnKyc:
            typeof body.alertOnKyc === 'boolean'
              ? body.alertOnKyc
              : existingDoc?.alertOnKyc !== false,
          alertOnWithdrawals:
            typeof body.alertOnWithdrawals === 'boolean'
              ? body.alertOnWithdrawals
              : existingDoc?.alertOnWithdrawals !== false,
          updatedByUid: caller.uid,
          updatedByEmail: caller.email,
          updatedAtIso: nowIso,
        };

        const maskedChatAudit = nextChatId ? maskSecretValue(nextChatId) : 'Unset';
        const auditDetails = `Telegram Admin Bot updated. Enabled: ${
          nextRecord.enabled ? 'ON' : 'OFF'
        }, Chat ID: ${maskedChatAudit}, Token: ${
          nextToken ? maskSecretValue(nextToken, nextLast4) : 'Cleared/Env'
        }, Deposit Threshold: $${nextThreshold}.`.slice(0, 490);

        await deps.fsCommitTransaction(caller.idToken, txHandle, [
          deps.buildUpsertWrite('adminSecrets/telegramConfig', nextRecord, ['updatedAt']),
          deps.buildCreateWrite(
            `auditLogs/${audId}`,
            {
              actorUid: caller.uid,
              actorEmail: caller.email,
              actorRole: 'admin',
              eventType: 'TELEGRAM_CONFIG_UPDATED',
              targetUid: caller.uid,
              network: 'TELEGRAM_BOT',
              txHash: '',
              amountUsd: 0,
              details: auditDetails,
            },
            ['createdAt']
          ),
          deps.buildCreateWrite(
            `adminLogs/${adminLogId}`,
            {
              adminUid: caller.uid,
              adminEmail: caller.email,
              action: 'TELEGRAM_CONFIG_UPDATED',
              targetUid: 'telegramConfig',
              targetLabel: 'Telegram Admin Bot Alerts',
              details: auditDetails,
              amountUsd: 0,
            },
            ['createdAt']
          ),
        ]);

        hydrateTelegramConfigCache(nextRecord);
        res.json(
          buildMaskedTelegramStatus('Telegram Admin Bot settings saved and activated live.')
        );
      } catch (txErr) {
        await deps.fsRollbackTransaction(caller.idToken, txHandle);
        throw txErr;
      }
    } catch (err) {
      const e = err as Error & { statusCode?: number; code?: string };
      res.status(e.statusCode || 500).json({
        error: e.message || 'Unable to save Telegram Bot configuration.',
        code: e.code || 'TELEGRAM_CONFIG_SAVE_ERROR',
      });
    }
  });

  // 7. Super Admin: Send Test Telegram Alert
  app.post('/api/admin/telegram-config/test', async (req, res) => {
    try {
      const caller = await deps.verifyFirebaseBearerToken(req);
      await deps.verifySuperAdminCaller(caller);

      const doc = await deps.fsGetDoc(caller.idToken, 'adminSecrets/telegramConfig');
      hydrateTelegramConfigCache(doc);

      const nowUtc = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
      const tgRes = await sendTelegramAdminAlert(
        `✅ <b>AlphaTradex Admin Bot Connected!</b>\nTriggered by: <b>${escapeHtml(
          caller.email
        )}</b>\nTime: ${nowUtc}\nYou will now receive instant alerts for deposits, KYC submissions, and withdrawal requests.`,
        { forceSend: true }
      );

      if (!tgRes.ok) {
        res.status(400).json({
          error: tgRes.errorMessage || 'Failed to send Telegram test alert.',
          code: 'TELEGRAM_TEST_FAILED',
        });
        return;
      }

      try {
        const txHandle = await deps.fsBeginTransaction(caller.idToken);
        const audId = deps.makeServerDocId('aud');
        await deps.fsCommitTransaction(caller.idToken, txHandle, [
          deps.buildCreateWrite(
            `auditLogs/${audId}`,
            {
              actorUid: caller.uid,
              actorEmail: caller.email,
              actorRole: 'admin',
              eventType: 'TELEGRAM_TEST_SENT',
              targetUid: caller.uid,
              network: 'TELEGRAM_BOT',
              txHash: tgRes.messageId || '',
              amountUsd: 0,
              details: `Sent Telegram Admin Bot test alert to Chat ID ${
                telegramConfigCache.adminChatId
                  ? maskSecretValue(telegramConfigCache.adminChatId)
                  : 'ENV'
              }.`,
            },
            ['createdAt']
          ),
        ]);
      } catch {
        // Non-blocking
      }

      res.json({
        ok: true,
        messageId: tgRes.messageId || '',
        message: `Telegram test alert delivered successfully${
          tgRes.messageId ? ` (Message #${tgRes.messageId})` : ''
        }.`,
      });
    } catch (err) {
      const e = err as Error & { statusCode?: number; code?: string };
      res.status(e.statusCode || 500).json({
        error: e.message || 'Unable to send Telegram test alert.',
        code: e.code || 'TELEGRAM_TEST_ERROR',
      });
    }
  });

  // 8. Authenticated Platform Event Notification Dispatcher (strict role/ownership enforced)
  app.post('/api/notifications/dispatch', async (req, res) => {
    try {
      const caller = await deps.verifyFirebaseBearerToken(req);
      const body = (req.body || {}) as {
        eventType?: PlatformNotificationEventType;
        userEmail?: string;
        userName?: string;
        amountUsd?: number;
        network?: string;
        txHash?: string;
        destinationAddress?: string;
        reason?: string;
        deviceSummary?: string;
        sourceLabel?: string;
      };

      const adminOnlyEvents: PlatformNotificationEventType[] = [
        'deposit_confirmed',
        'withdrawal_approved',
        'withdrawal_rejected',
        'kyc_approved',
        'kyc_rejected',
      ];
      const selfEvents: PlatformNotificationEventType[] = [
        'welcome',
        'deposit_submitted',
        'withdrawal_requested',
        'kyc_submitted',
        'login_new_device',
      ];

      const eventType = body.eventType;
      if (
        !eventType ||
        (!adminOnlyEvents.includes(eventType) && !selfEvents.includes(eventType))
      ) {
        res.status(400).json({ error: 'Unsupported notification event type.' });
        return;
      }

      let targetEmail = caller.email;
      if (adminOnlyEvents.includes(eventType)) {
        await deps.verifySuperAdminCaller(caller);
        // Hydrate latest secrets on admin dispatch
        const [eDoc, tDoc] = await Promise.all([
          deps.fsGetDoc(caller.idToken, 'adminSecrets/emailConfig').catch(() => null),
          deps.fsGetDoc(caller.idToken, 'adminSecrets/telegramConfig').catch(() => null),
        ]);
        hydrateEmailConfigCache(eDoc);
        hydrateTelegramConfigCache(tDoc);
        targetEmail = String(body.userEmail || '').trim();
      } else {
        // Regular user can ONLY trigger notifications for their own authenticated email
        targetEmail = caller.email;
      }

      const result = await triggerAutomatedEventNotifications({
        eventType,
        userEmail: targetEmail,
        userName: String(body.userName || '').trim().slice(0, 120),
        amountUsd: typeof body.amountUsd === 'number' ? body.amountUsd : undefined,
        network: typeof body.network === 'string' ? body.network.slice(0, 64) : undefined,
        txHash: typeof body.txHash === 'string' ? body.txHash.slice(0, 160) : undefined,
        destinationAddress:
          typeof body.destinationAddress === 'string'
            ? body.destinationAddress.slice(0, 160)
            : undefined,
        reason: typeof body.reason === 'string' ? body.reason.slice(0, 300) : undefined,
        deviceSummary:
          typeof body.deviceSummary === 'string' ? body.deviceSummary.slice(0, 160) : undefined,
        sourceLabel:
          typeof body.sourceLabel === 'string' ? body.sourceLabel.slice(0, 80) : undefined,
      });

      res.json({ ok: true, ...result });
    } catch (err) {
      const e = err as Error & { statusCode?: number; code?: string };
      res.status(e.statusCode || 500).json({
        error: e.message || 'Unable to dispatch notification.',
        code: e.code || 'NOTIFICATION_DISPATCH_ERROR',
      });
    }
  });
}
