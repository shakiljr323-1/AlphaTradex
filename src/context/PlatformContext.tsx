import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateEmail,
  User,
  verifyBeforeUpdateEmail,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  buildDefaultPaymentMethods,
  DEFAULT_GLOBAL_KYC_SETTINGS,
  DEFAULT_PLATFORM_CONFIG,
  DEFAULT_SUPPORT_AUTO_RESPONDER,
  SUPER_ADMIN_EMAIL,
} from '../constants/defaults';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import { clearGoogleChatToken } from '../lib/googleChat';
import {
  AdminActionLog,
  AdminModuleControls,
  BannerAdConfig,
  CoinMiningPlan,
  CoinMiningStake,
  CoinTapAccount,
  CopyTraderProfile,
  CopyTradeSubscription,
  CryptoDeposit,
  CryptoNetwork,
  ForexAccountTierConfig,
  ForexAccountTierId,
  ForexPlatformConfig,
  ForexTrade,
  GlobalKycSettings,
  IdType,
  Investment,
  InvestmentPackage,
  KycApiVerificationStatus,
  KycProviderId,
  MarketingCardCategory,
  MarketingCardStats,
  MarketingCardsConfig,
  MarketingCardTemplateConfig,
  MarketingCardThemeId,
  MemeCoinInvestment,
  MlmCommission,
  P2PTransfer,
  PackageFundingSource,
  PaymentMethodConfig,
  PlatformConfig,
  ReferralLinkRecord,
  ReferralStats,
  SupportAutoResponderConfig,
  SupportChatMessage,
  SupportChatThread,
  SupportLinksConfig,
  SupportTicket,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
  TicketConfirmationReceipt,
  UserNotification,
  UserPaymentMethod,
  UserProfile,
  WalletTransfer,
  Withdrawal,
} from '../types/platform';
import {
  computeInvestmentMetrics,
  formatTimestamp,
  generateHandleFromUid,
  sha256Hex,
} from '../utils/investmentMath';

interface KycDraft {
  fullName: string;
  referralCode: string;
  idType: IdType | '';
  idNumber: string;
  idPhotoData: string;
  portraitPhotoData: string;
  countryCode?: string;
  countryName?: string;
  phoneDialPrefix?: string;
  phoneNumber?: string;
  phoneVerified?: boolean;
}

interface PlatformContextValue {
  authUser: User | null;
  authReady: boolean;
  userProfile: UserProfile | null;
  profileLoading: boolean;
  provisioningError: string | null;
  retryProfileSync: () => Promise<void>;
  isAdminUser: boolean;
  platformConfig: PlatformConfig;
  investments: Investment[];
  deposits: CryptoDeposit[];
  withdrawals: Withdrawal[];
  p2pTransfers: P2PTransfer[];
  walletTransfers: WalletTransfer[];
  mlmCommissions: MlmCommission[];
  memeCoinInvestments: MemeCoinInvestment[];
  coinMiningStakes: CoinMiningStake[];
  coinTapAccount: CoinTapAccount | null;
  downlineReferrals: ReferralLinkRecord[];
  referralLinkClicks: number;
  savedPaymentMethods: UserPaymentMethod[];
  forexTrades: ForexTrade[];
  copyTradeSubscriptions: CopyTradeSubscription[];
  supportChatThread: SupportChatThread | null;
  supportChatMessages: SupportChatMessage[];
  supportTickets: SupportTicket[];
  userNotifications: UserNotification[];
  // Auth & KYC
  signInWithGoogle: (
    referralCode?: string,
    kycDraft?: Partial<KycDraft>
  ) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithKyc: (params: {
    email: string;
    password: string;
    fullName: string;
    referralCode: string;
    idType: IdType;
    idNumber: string;
    idPhotoData: string;
    portraitPhotoData: string;
    countryCode: string;
    countryName: string;
    phoneDialPrefix: string;
    phoneNumber: string;
    phoneVerified: boolean;
  }) => Promise<{ needsEmailVerification: boolean }>;
  submitKycUpdate: (params: {
    fullName: string;
    idType: IdType;
    idNumber: string;
    idPhotoData: string;
    idBackPhotoData?: string;
    portraitPhotoData: string;
    kycCountryCode?: string;
    kycCountryName?: string;
    kycDateOfBirth?: string;
    kycNationality?: string;
    kycIssueDate?: string;
    kycExpiryDate?: string;
    kycAddress?: string;
    kycVerificationMethod?: string;
    kycApiVerificationStatus?: KycApiVerificationStatus;
    kycOcrConfidence?: number;
    kycLivenessPassed?: boolean;
  }) => Promise<void>;
  updateProfileAvatar: (avatarData: string, fullName?: string) => Promise<void>;
  updateUserPhone: (params: {
    countryCode: string;
    countryName: string;
    phoneDialPrefix: string;
    phoneNumber: string;
    phoneVerified: boolean;
  }) => Promise<void>;
  updateAccountEmail: (
    newEmail: string,
    currentPassword?: string
  ) => Promise<{ status: 'updated' | 'verification_sent'; email: string }>;
  resendVerificationEmail: () => Promise<void>;
  refreshAuthVerification: () => Promise<boolean>;
  signOutUser: () => Promise<void>;
  // User Financial Operations
  submitCryptoDeposit: (params: {
    network: CryptoNetwork;
    amountUsd: number;
    txId: string;
  }) => Promise<void>;
  activatePackage: (pkg: InvestmentPackage, fundingSource?: PackageFundingSource) => Promise<void>;
  transferIncomeToDepositWallet: (amountUsd: number) => Promise<void>;
  claimInvestmentProfit: (investment: Investment) => Promise<number>;
  withdrawInstantProfit: (params: {
    amountUsd: number;
    network: CryptoNetwork;
    destinationAddress: string;
    source: 'package_profit' | 'mlm_commission' | 'mentor_profit';
    settlementMode?: 'pending' | 'completed';
  }) => Promise<void>;
  requestManualCapitalWithdrawal: (params: {
    investment: Investment;
    network: CryptoNetwork;
    destinationAddress: string;
  }) => Promise<void>;
  sendP2PTransfer: (params: {
    recipientQuery: string;
    amountUsd: number;
    note: string;
  }) => Promise<void>;
  investPumpFunMemeCoin: (params: {
    amountUsd: number;
    paymentMethod: 'USD_VAULT' | 'SOL_WALLET';
    txSignature?: string;
  }) => Promise<void>;
  // Paid Coin Mining & Free Tap-to-Mine Operations
  startCoinMiningStake: (plan: CoinMiningPlan, amountUsd: number) => Promise<void>;
  claimCoinMiningInterest: (stake: CoinMiningStake) => Promise<{ claimedUsd: number; claimedCoins: number }>;
  syncTapMiningProgress: (params: {
    addedCoins: number;
    energy: number;
    dayKey: string;
  }) => Promise<void>;
  claimTapMiningRewards: (pendingLocalCoins?: number) => Promise<{ claimedCoins: number; creditedUsd: number }>;
  // User Saved Payment Methods
  addUserPaymentMethod: (params: {
    label: string;
    methodId: string;
    methodName: string;
    accountAddress: string;
    accountHolder: string;
    isDefault?: boolean;
  }) => Promise<void>;
  setDefaultUserPaymentMethod: (methodDocId: string) => Promise<void>;
  deleteUserPaymentMethod: (methodDocId: string) => Promise<void>;
  // Forex WebTerminal & Copy Trade
  openForexTrade: (params: {
    symbol: string;
    direction: 'BUY' | 'SELL';
    tier: ForexAccountTierConfig;
    lots: number;
    leverage: number;
    entryPrice: number;
    slPrice: number;
    tpPrice: number;
    marginUsd: number;
    commissionUsd: number;
  }) => Promise<void>;
  closeForexTrade: (
    trade: ForexTrade,
    closePrice: number,
    realizedPnlUsd: number
  ) => Promise<void>;
  startCopyTrade: (params: {
    trader: CopyTraderProfile;
    accountTierId: ForexAccountTierId;
    allocatedUsd: number;
    riskMultiplier: number;
    stopLossPercent: number;
  }) => Promise<void>;
  claimCopyTradeProfit: (sub: CopyTradeSubscription) => Promise<number>;
  stopCopyTrade: (
    sub: CopyTradeSubscription
  ) => Promise<{ returnedCapitalUsd: number; claimedProfitUsd: number }>;
  // Super Admin Actions
  updatePlatformConfig: (next: PlatformConfig) => Promise<void>;
  approveCryptoDeposit: (deposit: CryptoDeposit, adminNote?: string) => Promise<void>;
  rejectCryptoDeposit: (deposit: CryptoDeposit, adminNote: string) => Promise<void>;
  approveKyc: (targetUid: string, note?: string) => Promise<void>;
  rejectKyc: (targetUid: string, reason?: string) => Promise<void>;
  requestKycResubmission: (targetUid: string, reason: string) => Promise<void>;
  setUserKycStatus: (
    targetUid: string,
    status: UserProfile['kycStatus'],
    reason?: string
  ) => Promise<void>;
  verifyUserPhone: (targetUid: string, verified: boolean) => Promise<void>;
  bulkApproveKyc: (targetUids: string[]) => Promise<number>;
  bulkVerifyPhones: (targetUids: string[]) => Promise<number>;
  approveCapitalWithdrawal: (withdrawal: Withdrawal, adminNote?: string) => Promise<void>;
  rejectCapitalWithdrawal: (withdrawal: Withdrawal, adminNote: string) => Promise<void>;
  updateWithdrawalNote: (withdrawalId: string, adminNote: string) => Promise<void>;
  giftMentorAccount: (params: {
    targetUid: string;
    giftedCapital: number;
    dailyPercent: number;
    aiMode: string;
  }) => Promise<void>;
  revokeMentorAccess: (targetUid: string) => Promise<void>;
  adjustUserBalance: (params: {
    targetUid: string;
    wallet: 'usdBalance' | 'profitBalance';
    mode: 'credit' | 'debit';
    amountUsd: number;
    reason: string;
  }) => Promise<void>;
  setUserSuspension: (targetUid: string, suspended: boolean, reason: string) => Promise<void>;
  // Live Support Chat & Complaint Tickets
  sendClientSupportMessage: (text: string, topicTag?: string) => Promise<void>;
  markClientChatRead: () => Promise<void>;
  createSupportTicket: (params: {
    category: SupportTicketCategory;
    priority: SupportTicketPriority;
    subject: string;
    description: string;
    referenceId?: string;
  }) => Promise<TicketConfirmationReceipt>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  sendAdminSupportReply: (
    targetUser: { uid: string; fullName: string; email: string; handle: string },
    text: string
  ) => Promise<void>;
  markAdminChatRead: (targetUid: string) => Promise<void>;
  setSupportChatStatus: (targetUid: string, status: 'open' | 'resolved') => Promise<void>;
  updateSupportTicket: (
    ticketId: string,
    params: { status: SupportTicketStatus; adminReply: string }
  ) => Promise<void>;
  // Marketing Photo Card Studio stats & telemetry
  marketingCardStats: MarketingCardStats;
  trackMarketingCardEvent: (event: 'generated' | 'shared') => Promise<void>;
}

const PlatformContext = createContext<PlatformContextValue | null>(null);

function makeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`;
}

function sanitizeRuleId(raw: string, fallback = 'CUSTOM'): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 64);
  return cleaned || fallback;
}

function createdAtSeconds(val: unknown): number {
  return (val as { seconds?: number } | undefined)?.seconds || 0;
}

export function getTodayDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export const PlatformProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [provisioningError, setProvisioningError] = useState<string | null>(null);
  const [authSyncTick, setAuthSyncTick] = useState(0);
  const provisioningInFlightRef = useRef<Map<string, Promise<void>>>(new Map());
  const [isAdminDoc, setIsAdminDoc] = useState(false);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>(DEFAULT_PLATFORM_CONFIG);
  const [marketingCardStats, setMarketingCardStats] = useState<MarketingCardStats>({
    totalGenerated: 0,
    totalShared: 0,
  });

  const [investments, setInvestments] = useState<Investment[]>([]);
  const [deposits, setDeposits] = useState<CryptoDeposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [p2pTransfers, setP2pTransfers] = useState<P2PTransfer[]>([]);
  const [walletTransfers, setWalletTransfers] = useState<WalletTransfer[]>([]);
  const [mlmCommissions, setMlmCommissions] = useState<MlmCommission[]>([]);
  const [memeCoinInvestments, setMemeCoinInvestments] = useState<MemeCoinInvestment[]>([]);
  const [coinMiningStakes, setCoinMiningStakes] = useState<CoinMiningStake[]>([]);
  const [coinTapAccount, setCoinTapAccount] = useState<CoinTapAccount | null>(null);
  const [downlineReferrals, setDownlineReferrals] = useState<ReferralLinkRecord[]>([]);
  const [referralLinkClicks, setReferralLinkClicks] = useState<number>(0);
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<UserPaymentMethod[]>([]);
  const [forexTrades, setForexTrades] = useState<ForexTrade[]>([]);
  const [copyTradeSubscriptions, setCopyTradeSubscriptions] = useState<CopyTradeSubscription[]>([]);
  const [supportChatThread, setSupportChatThread] = useState<SupportChatThread | null>(null);
  const [supportChatMessages, setSupportChatMessages] = useState<SupportChatMessage[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [userNotifications, setUserNotifications] = useState<UserNotification[]>([]);

  const isAdminUser = Boolean(
    authUser &&
      authUser.emailVerified &&
      (authUser.email === SUPER_ADMIN_EMAIL || isAdminDoc || userProfile?.role === 'admin')
  );

  // Subscribe to public platform config
  useEffect(() => {
    const configRef = doc(db, 'config', 'platform');
    const unsub = onSnapshot(
      configRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as PlatformConfig;
          const mergedWallets = {
            ...DEFAULT_PLATFORM_CONFIG.depositWallets,
            ...(data.depositWallets || {}),
          };
          const resolvedMethods =
            Array.isArray(data.paymentMethods) && data.paymentMethods.length > 0
              ? data.paymentMethods.map((m) => ({
                  ...m,
                  withdrawAddress: m.withdrawAddress ?? m.receivingAccount,
                }))
              : buildDefaultPaymentMethods(mergedWallets);

          setPlatformConfig({
            ...DEFAULT_PLATFORM_CONFIG,
            ...data,
            withdrawalsPaused: Boolean(data.withdrawalsPaused),
            signupsPaused: Boolean(data.signupsPaused),
            p2pPaused: Boolean(data.p2pPaused),
            moduleControls: {
              ...DEFAULT_PLATFORM_CONFIG.moduleControls!,
              ...(data.moduleControls || {}),
            },
            supportLinks: {
              ...DEFAULT_PLATFORM_CONFIG.supportLinks!,
              ...(data.supportLinks || {}),
            },
            supportAutoResponder: {
              ...DEFAULT_SUPPORT_AUTO_RESPONDER,
              ...(data.supportAutoResponder || {}),
            },
            kycSettings: {
              ...DEFAULT_GLOBAL_KYC_SETTINGS,
              ...(data.kycSettings || {}),
              disabledCountryCodes: Array.isArray(data.kycSettings?.disabledCountryCodes)
                ? data.kycSettings.disabledCountryCodes
                : DEFAULT_GLOBAL_KYC_SETTINGS.disabledCountryCodes,
            },
            marketingCardsConfig: {
              ...DEFAULT_PLATFORM_CONFIG.marketingCardsConfig!,
              ...(data.marketingCardsConfig || {}),
              templates:
                Array.isArray(data.marketingCardsConfig?.templates) &&
                data.marketingCardsConfig.templates.length > 0
                  ? data.marketingCardsConfig.templates
                  : DEFAULT_PLATFORM_CONFIG.marketingCardsConfig!.templates,
            },
            mlmRates: { ...DEFAULT_PLATFORM_CONFIG.mlmRates, ...(data.mlmRates || {}) },
            mentorConfig: { ...DEFAULT_PLATFORM_CONFIG.mentorConfig, ...(data.mentorConfig || {}) },
            depositWallets: mergedWallets,
            paymentMethods: resolvedMethods,
            pumpFunToken: { ...DEFAULT_PLATFORM_CONFIG.pumpFunToken, ...(data.pumpFunToken || {}) },
            dashboardAnnouncement: {
              ...DEFAULT_PLATFORM_CONFIG.dashboardAnnouncement,
              ...(data.dashboardAnnouncement || {}),
            },
            bannerAds: Array.isArray(data.bannerAds)
              ? data.bannerAds
              : DEFAULT_PLATFORM_CONFIG.bannerAds,
            coinMiningSettings: {
              ...DEFAULT_PLATFORM_CONFIG.coinMiningSettings,
              ...(data.coinMiningSettings || {}),
            },
            coinMiningPlans: Array.isArray(data.coinMiningPlans)
              ? data.coinMiningPlans
              : DEFAULT_PLATFORM_CONFIG.coinMiningPlans,
            forexConfig: {
              tradingEnabled:
                data.forexConfig?.tradingEnabled ??
                DEFAULT_PLATFORM_CONFIG.forexConfig!.tradingEnabled,
              copyTradingEnabled:
                data.forexConfig?.copyTradingEnabled ??
                DEFAULT_PLATFORM_CONFIG.forexConfig!.copyTradingEnabled,
              accountTiers:
                Array.isArray(data.forexConfig?.accountTiers) &&
                data.forexConfig.accountTiers.length > 0
                  ? data.forexConfig.accountTiers
                  : DEFAULT_PLATFORM_CONFIG.forexConfig!.accountTiers,
              copyTraders: Array.isArray(data.forexConfig?.copyTraders)
                ? data.forexConfig.copyTraders
                : DEFAULT_PLATFORM_CONFIG.forexConfig!.copyTraders,
            },
            packages:
              Array.isArray(data.packages) && data.packages.length > 0
                ? data.packages
                : DEFAULT_PLATFORM_CONFIG.packages,
          });
        }
      },
      (error) => {
        console.warn('Config snapshot fallback to defaults:', error.message);
      }
    );
    return () => unsub();
  }, []);

  // Subscribe to Marketing Photo Card Studio aggregate analytics (generated/shared counts)
  useEffect(() => {
    if (!authUser) {
      setMarketingCardStats({ totalGenerated: 0, totalShared: 0 });
      return;
    }
    const statsRef = doc(db, 'marketingCardStats', 'global');
    const unsub = onSnapshot(
      statsRef,
      (snap) => {
        if (snap.exists()) {
          const d = snap.data() as Partial<MarketingCardStats>;
          setMarketingCardStats({
            totalGenerated: Math.max(0, Number(d.totalGenerated) || 0),
            totalShared: Math.max(0, Number(d.totalShared) || 0),
            updatedAt: d.updatedAt,
          });
        } else {
          setMarketingCardStats({ totalGenerated: 0, totalShared: 0 });
        }
      },
      (err) => {
        console.warn('Marketing card stats snapshot unavailable:', err.message);
      }
    );
    return () => unsub();
  }, [authUser]);

  const trackMarketingCardEvent = useCallback(
    async (event: 'generated' | 'shared') => {
      if (!authUser) return;
      const statsRef = doc(db, 'marketingCardStats', 'global');
      try {
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(statsRef);
          if (!snap.exists()) {
            tx.set(statsRef, {
              totalGenerated: event === 'generated' ? 1 : 0,
              totalShared: event === 'shared' ? 1 : 0,
              updatedAt: serverTimestamp(),
            });
          } else {
            const cur = snap.data() as Partial<MarketingCardStats>;
            const curGen = Math.max(0, Math.floor(Number(cur.totalGenerated) || 0));
            const curShare = Math.max(0, Math.floor(Number(cur.totalShared) || 0));
            tx.update(statsRef, {
              totalGenerated: event === 'generated' ? curGen + 1 : curGen,
              totalShared: event === 'shared' ? curShare + 1 : curShare,
              updatedAt: serverTimestamp(),
            });
          }
        });
      } catch (err) {
        console.warn('Marketing card telemetry update skipped:', err instanceof Error ? err.message : String(err));
      }
    },
    [authUser]
  );

  // Track referral link visits (?ref=HANDLE) once per browser session
  useEffect(() => {
    let rawRef = '';
    try {
      rawRef = new URLSearchParams(window.location.search).get('ref') || '';
    } catch {
      return;
    }
    const cleanHandle = rawRef
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '')
      .slice(0, 32);
    if (!cleanHandle) return;

    try {
      localStorage.setItem('vtv_pending_ref', cleanHandle);
    } catch {
      // Ignore storage access errors in restricted contexts
    }

    const sessionKey = `vtv_ref_clicked_${cleanHandle}`;
    try {
      if (sessionStorage.getItem(sessionKey)) return;
      sessionStorage.setItem(sessionKey, '1');
    } catch {
      // Proceed even if sessionStorage is unavailable
    }

    const statRef = doc(db, 'referralStats', cleanHandle);
    runTransaction(db, async (tx) => {
      const snap = await tx.get(statRef);
      if (!snap.exists()) {
        tx.set(statRef, {
          handle: cleanHandle,
          clicks: 1,
          lastClickedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const currentClicks = Number((snap.data() as ReferralStats).clicks || 0);
        tx.update(statRef, {
          handle: cleanHandle,
          clicks: currentClicks + 1,
          lastClickedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }).catch((err) => {
      console.warn('Referral click tracking skipped:', err instanceof Error ? err.message : String(err));
    });
  }, []);

  const ensureUserProvisioned = useCallback(async (user: User, draft?: KycDraft | null) => {
    if (!user.emailVerified) return;

    const existingTask = provisioningInFlightRef.current.get(user.uid);
    if (existingTask) {
      return existingTask;
    }

    const task = (async () => {
      setProvisioningError(null);
      const userRef = doc(db, 'users', user.uid);
      let snap;
      try {
        snap = await getDoc(userRef);
      } catch (err) {
        // Token may have just been verified — force refresh once and retry
        try {
          await user.getIdToken(true);
          snap = await getDoc(userRef);
        } catch (retryErr) {
          const msg = retryErr instanceof Error ? retryErr.message : String(retryErr);
          setProvisioningError(msg);
          handleFirestoreError(retryErr, OperationType.GET, `users/${user.uid}`);
        }
      }

      if (snap.exists()) return;

      let handle = generateHandleFromUid(user.uid);
      let shouldCreateHandleDoc = true;
      try {
        const existingHandleSnap = await getDoc(doc(db, 'handles', handle));
        if (existingHandleSnap.exists()) {
          const existingUid = (existingHandleSnap.data() as { uid?: string }).uid;
          if (existingUid === user.uid) {
            shouldCreateHandleDoc = false;
          } else {
            const suffix = user.uid.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(-4) || '99';
            handle = `${handle}_${suffix}`.slice(0, 32);
          }
        }
      } catch {
        // Proceed with default generated handle
      }

      const fullName = (
        draft?.fullName?.trim() ||
        user.displayName?.trim() ||
        (user.email ? user.email.split('@')[0] : 'Vault Client')
      ).slice(0, 120);
      const email = (user.email || '').trim().toLowerCase().slice(0, 254);

      let referredByUid = '';
      let referredByHandle = '';
      let uplineChain: string[] = [];

      const refCode = (
        draft?.referralCode ||
        localStorage.getItem('vtv_pending_ref') ||
        ''
      )
        .trim()
        .toUpperCase();
      if (refCode && refCode !== handle) {
        try {
          const refHandleSnap = await getDoc(doc(db, 'handles', refCode));
          if (refHandleSnap.exists()) {
            const refData = refHandleSnap.data() as {
              uid: string;
              handle: string;
              uplineUids?: string[];
            };
            if (refData.uid && refData.uid !== user.uid) {
              referredByUid = refData.uid.slice(0, 128);
              referredByHandle = (refData.handle || refCode).slice(0, 32);
              uplineChain = [refData.uid, ...(refData.uplineUids || []).slice(0, 2)].filter(
                (u) => typeof u === 'string' && /^[a-zA-Z0-9_-]+$/.test(u)
              );
            }
          }
        } catch {
          // Invalid or unreadable ref code ignored cleanly
        }
      }

      const cleanIdNumber = (draft?.idNumber || '').trim().slice(0, 64);
      const cleanIdPhoto =
        draft?.idPhotoData && draft.idPhotoData.length <= 300000 ? draft.idPhotoData : '';
      const cleanPortrait =
        draft?.portraitPhotoData && draft.portraitPhotoData.length <= 300000
          ? draft.portraitPhotoData
          : '';
      const hasKycFields = Boolean(draft?.idType && cleanIdNumber);
      const batch = writeBatch(db);

      const cleanCountryCode = (draft?.countryCode || '').trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
      const cleanCountryName = (draft?.countryName || '').trim().slice(0, 80);
      const cleanDialPrefix =
        draft?.phoneDialPrefix && /^\+[0-9]{1,8}$/.test(draft.phoneDialPrefix.trim())
          ? draft.phoneDialPrefix.trim()
          : '';
      const cleanPhoneNumber =
        draft?.phoneNumber && /^\+[0-9]{6,18}$/.test(draft.phoneNumber.trim())
          ? draft.phoneNumber.trim()
          : '';
      const cleanPhoneVerified = Boolean(draft?.phoneVerified && cleanPhoneNumber);

      const newClientRecord = {
        uid: user.uid,
        email,
        fullName,
        handle,
        role: 'user' as const,
        referredByUid,
        referredByHandle,
        uplineChain,
        kycStatus: (hasKycFields ? 'pending' : 'unsubmitted') as UserProfile['kycStatus'],
        idType: (draft?.idType || '') as UserProfile['idType'],
        idNumber: cleanIdNumber,
        idPhotoData: cleanIdPhoto,
        portraitPhotoData: cleanPortrait,
        ...(cleanCountryCode ? { countryCode: cleanCountryCode } : {}),
        ...(cleanCountryName ? { countryName: cleanCountryName } : {}),
        ...(cleanDialPrefix ? { phoneDialPrefix: cleanDialPrefix } : {}),
        ...(cleanPhoneNumber ? { phoneNumber: cleanPhoneNumber } : {}),
        ...(cleanPhoneNumber ? { phoneVerified: cleanPhoneVerified } : {}),
        usdBalance: 0,
        profitBalance: 0,
        totalInvested: 0,
        totalWithdrawn: 0,
        isMentor: false,
        mentorGiftedCapital: 0,
        mentorRequiredVolume: 0,
        mentorBroughtVolume: 0,
      };

      batch.set(userRef, {
        ...newClientRecord,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (shouldCreateHandleDoc) {
        batch.set(doc(db, 'handles', handle), {
          uid: user.uid,
          handle,
          displayName: fullName,
          uplineUids: uplineChain,
          createdAt: serverTimestamp(),
        });
      }

      if (email) {
        try {
          const emailHash = await sha256Hex(email);
          const existingEmailSnap = await getDoc(doc(db, 'emailHashes', emailHash));
          if (!existingEmailSnap.exists()) {
            batch.set(doc(db, 'emailHashes', emailHash), {
              uid: user.uid,
              handle,
              displayName: fullName,
              createdAt: serverTimestamp(),
            });
          }
        } catch {
          // Non-fatal if WebCrypto unavailable or hash doc already present
        }
      }

      uplineChain.forEach((uplineUid, idx) => {
        const level = idx + 1;
        const refDocId = `${user.uid}_L${level}`;
        batch.set(doc(db, 'referrals', refDocId), {
          referrerUid: uplineUid,
          refereeUid: user.uid,
          refereeHandle: handle,
          refereeName: fullName,
          level,
          totalInvestedUsd: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      try {
        await batch.commit();
      } catch (err) {
        // Retry once with refreshed auth token in case email_verified claim just updated
        try {
          await user.getIdToken(true);
          await batch.commit();
        } catch (retryErr) {
          const msg = retryErr instanceof Error ? retryErr.message : String(retryErr);
          setProvisioningError(msg);
          handleFirestoreError(retryErr, OperationType.WRITE, `users/${user.uid}`);
        }
      }

      try {
        localStorage.removeItem(`vtv_kyc_draft_${user.uid}`);
        localStorage.removeItem('vtv_pending_kyc_draft');
        localStorage.removeItem('vtv_pending_ref');
      } catch {
        // Ignore storage errors
      }
      setAuthSyncTick((t) => t + 1);
    })();

    provisioningInFlightRef.current.set(user.uid, task);
    try {
      await task;
    } finally {
      provisioningInFlightRef.current.delete(user.uid);
    }
  }, []);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      setAuthReady(true);
      setProvisioningError(null);
      if (!user) {
        setUserProfile(null);
        setIsAdminDoc(false);
        setInvestments([]);
        setDeposits([]);
        setWithdrawals([]);
        setP2pTransfers([]);
        setWalletTransfers([]);
        setMlmCommissions([]);
        setMemeCoinInvestments([]);
        setCoinMiningStakes([]);
        setCoinTapAccount(null);
        setDownlineReferrals([]);
        setReferralLinkClicks(0);
        setSavedPaymentMethods([]);
        setForexTrades([]);
        setCopyTradeSubscriptions([]);
        setSupportChatThread(null);
        setSupportChatMessages([]);
        setSupportTickets([]);
        setUserNotifications([]);
        return;
      }

      if (user.emailVerified) {
        const rawDraft =
          localStorage.getItem(`vtv_kyc_draft_${user.uid}`) ||
          localStorage.getItem('vtv_pending_kyc_draft');
        let draft: KycDraft | null = null;
        if (rawDraft) {
          try {
            draft = JSON.parse(rawDraft) as KycDraft;
          } catch {
            draft = null;
          }
        }
        try {
          await ensureUserProvisioned(user, draft);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setProvisioningError(msg);
        }

        // Check /admins/{uid}
        try {
          const adminSnap = await getDoc(doc(db, 'admins', user.uid));
          setIsAdminDoc(adminSnap.exists());
        } catch {
          setIsAdminDoc(false);
        }
      }
    });
    return () => unsub();
  }, [ensureUserProvisioned]);

  // Attach user-scoped Firestore listeners when authenticated & verified
  useEffect(() => {
    if (!authUser || !authUser.emailVerified) {
      setUserProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    const uid = authUser.uid;

    const unsubUser = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (snap.exists()) {
          setUserProfile(snap.data() as UserProfile);
        } else {
          setUserProfile(null);
        }
        setProfileLoading(false);
      },
      (err) => {
        setProfileLoading(false);
        handleFirestoreError(err, OperationType.GET, `users/${uid}`);
      }
    );

    const unsubInv = onSnapshot(
      query(collection(db, 'investments'), where('uid', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Investment, 'id'>) }));
        list.sort((a, b) => (b.startedAtMs || 0) - (a.startedAtMs || 0));
        setInvestments(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'investments')
    );

    const unsubDep = onSnapshot(
      query(collection(db, 'cryptoDeposits'), where('uid', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CryptoDeposit, 'id'>) }));
        list.sort((a, b) => createdAtSeconds(b.createdAt) - createdAtSeconds(a.createdAt));
        setDeposits(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'cryptoDeposits')
    );

    const unsubWith = onSnapshot(
      query(collection(db, 'withdrawals'), where('uid', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Withdrawal, 'id'>) }));
        list.sort((a, b) => createdAtSeconds(b.createdAt) - createdAtSeconds(a.createdAt));
        setWithdrawals(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'withdrawals')
    );

    let sentList: P2PTransfer[] = [];
    let recvList: P2PTransfer[] = [];
    const mergeP2P = () => {
      const merged = [...sentList, ...recvList];
      merged.sort((a, b) => createdAtSeconds(b.createdAt) - createdAtSeconds(a.createdAt));
      setP2pTransfers(merged);
    };

    const unsubP2PSent = onSnapshot(
      query(collection(db, 'p2pTransfers'), where('senderUid', '==', uid)),
      (snap) => {
        sentList = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<P2PTransfer, 'id'>) }));
        mergeP2P();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'p2pTransfers')
    );

    const unsubP2PRecv = onSnapshot(
      query(collection(db, 'p2pTransfers'), where('receiverUid', '==', uid)),
      (snap) => {
        recvList = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<P2PTransfer, 'id'>) }));
        mergeP2P();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'p2pTransfers')
    );

    const unsubWalletTransfers = onSnapshot(
      query(collection(db, 'walletTransfers'), where('uid', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WalletTransfer, 'id'>) }));
        list.sort((a, b) => createdAtSeconds(b.createdAt) - createdAtSeconds(a.createdAt));
        setWalletTransfers(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'walletTransfers')
    );

    const unsubMlm = onSnapshot(
      query(collection(db, 'mlmCommissions'), where('beneficiaryUid', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MlmCommission, 'id'>) }));
        list.sort((a, b) => createdAtSeconds(b.createdAt) - createdAtSeconds(a.createdAt));
        setMlmCommissions(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'mlmCommissions')
    );

    const unsubMeme = onSnapshot(
      query(collection(db, 'memeCoinInvestments'), where('uid', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MemeCoinInvestment, 'id'>) }));
        list.sort((a, b) => createdAtSeconds(b.createdAt) - createdAtSeconds(a.createdAt));
        setMemeCoinInvestments(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'memeCoinInvestments')
    );

    const unsubCoinStakes = onSnapshot(
      query(collection(db, 'coinMiningStakes'), where('uid', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CoinMiningStake, 'id'>) }));
        list.sort((a, b) => (b.startedAtMs || 0) - (a.startedAtMs || 0));
        setCoinMiningStakes(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'coinMiningStakes')
    );

    const unsubCoinTap = onSnapshot(
      doc(db, 'coinTapAccounts', uid),
      (snap) => {
        if (snap.exists()) {
          setCoinTapAccount(snap.data() as CoinTapAccount);
        } else {
          setCoinTapAccount(null);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `coinTapAccounts/${uid}`)
    );

    const unsubRefs = onSnapshot(
      query(collection(db, 'referrals'), where('referrerUid', '==', uid)),
      (snap) =>
        setDownlineReferrals(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ReferralLinkRecord, 'id'>) }))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'referrals')
    );

    const unsubPaymentMethods = onSnapshot(
      query(collection(db, 'users', uid, 'paymentMethods'), where('uid', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<UserPaymentMethod, 'id'>) }));
        list.sort((a, b) => {
          if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
          return createdAtSeconds(b.createdAt) - createdAtSeconds(a.createdAt);
        });
        setSavedPaymentMethods(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/paymentMethods`)
    );

    const unsubForexTrades = onSnapshot(
      query(collection(db, 'forexTrades'), where('uid', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ForexTrade, 'id'>) }));
        list.sort((a, b) => (b.openedAtMs || 0) - (a.openedAtMs || 0));
        setForexTrades(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'forexTrades')
    );

    const unsubCopySubs = onSnapshot(
      query(collection(db, 'copyTradeSubscriptions'), where('uid', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<CopyTradeSubscription, 'id'>),
        }));
        list.sort((a, b) => (b.startedAtMs || 0) - (a.startedAtMs || 0));
        setCopyTradeSubscriptions(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'copyTradeSubscriptions')
    );

    const unsubSupportThread = onSnapshot(
      doc(db, 'supportChats', uid),
      (snap) => {
        if (snap.exists()) {
          setSupportChatThread(snap.data() as SupportChatThread);
        } else {
          setSupportChatThread(null);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `supportChats/${uid}`)
    );

    const unsubSupportMessages = onSnapshot(
      query(collection(db, 'supportChats', uid, 'messages'), where('uid', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SupportChatMessage, 'id'>),
        }));
        list.sort((a, b) => createdAtSeconds(a.createdAt) - createdAtSeconds(b.createdAt));
        setSupportChatMessages(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `supportChats/${uid}/messages`)
    );

    const unsubSupportTickets = onSnapshot(
      query(collection(db, 'supportTickets'), where('uid', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SupportTicket, 'id'>),
        }));
        list.sort((a, b) => createdAtSeconds(b.createdAt) - createdAtSeconds(a.createdAt));
        setSupportTickets(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'supportTickets')
    );

    const unsubNotifications = onSnapshot(
      query(collection(db, 'users', uid, 'notifications'), where('uid', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<UserNotification, 'id'>),
        }));
        list.sort((a, b) => createdAtSeconds(b.createdAt) - createdAtSeconds(a.createdAt));
        setUserNotifications(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/notifications`)
    );

    return () => {
      unsubUser();
      unsubInv();
      unsubDep();
      unsubWith();
      unsubP2PSent();
      unsubP2PRecv();
      unsubWalletTransfers();
      unsubMlm();
      unsubMeme();
      unsubCoinStakes();
      unsubCoinTap();
      unsubRefs();
      unsubPaymentMethods();
      unsubForexTrades();
      unsubCopySubs();
      unsubSupportThread();
      unsubSupportMessages();
      unsubSupportTickets();
      unsubNotifications();
    };
  }, [authUser, authSyncTick]);

  // Subscribe to live referral link click stats for the authenticated user's handle
  useEffect(() => {
    const handle = userProfile?.handle;
    if (!handle || !authUser?.emailVerified) {
      setReferralLinkClicks(0);
      return;
    }
    const cleanHandle = sanitizeRuleId(handle.toUpperCase(), '').slice(0, 32);
    if (!cleanHandle) {
      setReferralLinkClicks(0);
      return;
    }
    const unsub = onSnapshot(
      doc(db, 'referralStats', cleanHandle),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as ReferralStats;
          setReferralLinkClicks(Number(data.clicks || 0));
        } else {
          setReferralLinkClicks(0);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `referralStats/${cleanHandle}`);
      }
    );
    return () => unsub();
  }, [authUser?.emailVerified, userProfile?.handle]);

  const signInWithGoogle = async (
    referralCode?: string,
    kycDraft?: Partial<KycDraft>
  ) => {
    const ref = (kycDraft?.referralCode || referralCode || '').trim().toUpperCase();
    if (ref) {
      try {
        localStorage.setItem('vtv_pending_ref', ref);
      } catch {
        // Ignore storage error
      }
    }
    const hasDraft = Boolean(
      kycDraft &&
        (kycDraft.fullName?.trim() ||
          (kycDraft.idType && kycDraft.idNumber?.trim()) ||
          kycDraft.phoneNumber?.trim())
    );
    const normalizedDraft: KycDraft | null = hasDraft
      ? {
          fullName: (kycDraft?.fullName || '').trim(),
          referralCode: ref,
          idType: kycDraft?.idType || '',
          idNumber: (kycDraft?.idNumber || '').trim(),
          idPhotoData: kycDraft?.idPhotoData || '',
          portraitPhotoData: kycDraft?.portraitPhotoData || '',
          countryCode: kycDraft?.countryCode || '',
          countryName: kycDraft?.countryName || '',
          phoneDialPrefix: kycDraft?.phoneDialPrefix || '',
          phoneNumber: kycDraft?.phoneNumber || '',
          phoneVerified: Boolean(kycDraft?.phoneVerified),
        }
      : null;

    if (normalizedDraft) {
      try {
        localStorage.setItem('vtv_pending_kyc_draft', JSON.stringify(normalizedDraft));
      } catch {
        // Ignore storage error
      }
    }

    const res = await signInWithPopup(auth, googleProvider);
    if (normalizedDraft) {
      try {
        localStorage.setItem(`vtv_kyc_draft_${res.user.uid}`, JSON.stringify(normalizedDraft));
      } catch {
        // Ignore storage error
      }
    }
    await ensureUserProvisioned(res.user, normalizedDraft);
  };

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  };

  const signUpWithKyc = async (params: {
    email: string;
    password: string;
    fullName: string;
    referralCode: string;
    idType: IdType;
    idNumber: string;
    idPhotoData: string;
    portraitPhotoData: string;
    countryCode: string;
    countryName: string;
    phoneDialPrefix: string;
    phoneNumber: string;
    phoneVerified: boolean;
  }) => {
    if (platformConfig.signupsPaused) {
      throw new Error('New client registrations are temporarily paused by administration. Please try again shortly.');
    }
    const cred = await createUserWithEmailAndPassword(auth, params.email.trim(), params.password);
    const draft: KycDraft = {
      fullName: params.fullName.trim(),
      referralCode: params.referralCode.trim().toUpperCase(),
      idType: params.idType,
      idNumber: params.idNumber.trim(),
      idPhotoData: params.idPhotoData,
      portraitPhotoData: params.portraitPhotoData,
      countryCode: params.countryCode.trim().toUpperCase(),
      countryName: params.countryName.trim(),
      phoneDialPrefix: params.phoneDialPrefix.trim(),
      phoneNumber: params.phoneNumber.trim(),
      phoneVerified: Boolean(params.phoneVerified),
    };
    try {
      localStorage.setItem(`vtv_kyc_draft_${cred.user.uid}`, JSON.stringify(draft));
      localStorage.setItem('vtv_pending_kyc_draft', JSON.stringify(draft));
    } catch {
      // Ignore storage error
    }
    if (!cred.user.emailVerified) {
      await sendEmailVerification(cred.user);
      return { needsEmailVerification: true };
    }
    await ensureUserProvisioned(cred.user, draft);
    return { needsEmailVerification: false };
  };

  const submitKycUpdate = async (params: {
    fullName: string;
    idType: IdType;
    idNumber: string;
    idPhotoData: string;
    idBackPhotoData?: string;
    portraitPhotoData: string;
    kycCountryCode?: string;
    kycCountryName?: string;
    kycDateOfBirth?: string;
    kycNationality?: string;
    kycIssueDate?: string;
    kycExpiryDate?: string;
    kycAddress?: string;
    kycVerificationMethod?: string;
    kycApiVerificationStatus?: KycApiVerificationStatus;
    kycOcrConfidence?: number;
    kycLivenessPassed?: boolean;
  }) => {
    if (!authUser) throw new Error('Authentication required.');
    const kycPolicy = platformConfig.kycSettings || DEFAULT_GLOBAL_KYC_SETTINGS;
    const cleanCountryCode = String(params.kycCountryCode || '')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 4);
    if (
      cleanCountryCode &&
      (kycPolicy.disabledCountryCodes || []).includes(cleanCountryCode)
    ) {
      throw new Error(
        `KYC verification is currently restricted for ${params.kycCountryName || cleanCountryCode}. Contact compliance support for assistance.`
      );
    }
    const cleanName = params.fullName.trim().slice(0, 120);
    const cleanIdNumber = params.idNumber.trim().slice(0, 64);
    if (!cleanName || !cleanIdNumber) {
      throw new Error('Full legal name and document number are required.');
    }
    if (!params.idPhotoData) {
      throw new Error('Front side of your government ID document is required.');
    }
    if (kycPolicy.requireLiveSelfie && !params.portraitPhotoData) {
      throw new Error('A live selfie / portrait check photo is required.');
    }

    const safeApiStatus: KycApiVerificationStatus =
      params.kycApiVerificationStatus === 'ocr_preview_only' ||
      params.kycApiVerificationStatus === 'manual_review'
        ? params.kycApiVerificationStatus
        : 'manual_review';

    const rawConfidence = Number(params.kycOcrConfidence ?? 0);
    const safeConfidence = Number.isFinite(rawConfidence)
      ? Math.min(100, Math.max(0, Math.round(rawConfidence)))
      : 0;

    try {
      await updateDoc(doc(db, 'users', authUser.uid), {
        fullName: cleanName,
        idType: params.idType,
        idNumber: cleanIdNumber,
        idPhotoData: params.idPhotoData.slice(0, 300000),
        idBackPhotoData: (params.idBackPhotoData || '').slice(0, 300000),
        portraitPhotoData: (params.portraitPhotoData || '').slice(0, 300000),
        kycCountryCode: cleanCountryCode,
        kycCountryName: String(params.kycCountryName || '').trim().slice(0, 80),
        kycDateOfBirth: String(params.kycDateOfBirth || '').trim().slice(0, 32),
        kycNationality: String(params.kycNationality || '').trim().slice(0, 80),
        kycIssueDate: String(params.kycIssueDate || '').trim().slice(0, 32),
        kycExpiryDate: String(params.kycExpiryDate || '').trim().slice(0, 32),
        kycAddress: String(params.kycAddress || '').trim().slice(0, 260),
        kycRejectionReason: '',
        kycResubmissionRequested: false,
        kycVerificationMethod: String(
          params.kycVerificationMethod || 'Free AI Vision OCR Preview + Manual Compliance Review'
        )
          .trim()
          .slice(0, 80),
        kycApiVerificationStatus: safeApiStatus,
        kycOcrConfidence: safeConfidence,
        kycLivenessPassed: Boolean(params.kycLivenessPassed),
        kycSubmittedAtMs: Date.now(),
        kycStatus: 'pending',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${authUser.uid}`);
    }
  };

  const updateProfileAvatar = async (avatarData: string, fullName?: string) => {
    if (!authUser || !userProfile) throw new Error('Authentication required.');
    if (avatarData && avatarData.length > 300000) {
      throw new Error('Avatar image is too large. Please choose a smaller image.');
    }
    const payload: Record<string, unknown> = {
      avatarData: avatarData || '',
      updatedAt: serverTimestamp(),
    };
    if (fullName !== undefined) {
      const cleanName = fullName.trim().slice(0, 120);
      if (!cleanName) throw new Error('Full name cannot be empty.');
      payload.fullName = cleanName;
    }
    try {
      await updateDoc(doc(db, 'users', authUser.uid), payload);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${authUser.uid}`);
    }
  };

  const updateUserPhone = async (params: {
    countryCode: string;
    countryName: string;
    phoneDialPrefix: string;
    phoneNumber: string;
    phoneVerified: boolean;
  }) => {
    if (!authUser || !userProfile) throw new Error('Authentication required.');
    const cleanCountryCode = params.countryCode.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
    const cleanCountryName = params.countryName.trim().slice(0, 80);
    const cleanPrefix = params.phoneDialPrefix.trim();
    const cleanPhone = params.phoneNumber.trim();
    if (!/^\+[0-9]{1,8}$/.test(cleanPrefix)) {
      throw new Error('Invalid country phone prefix.');
    }
    if (!/^\+[0-9]{6,18}$/.test(cleanPhone)) {
      throw new Error('Invalid E.164 phone number format.');
    }
    try {
      await updateDoc(doc(db, 'users', authUser.uid), {
        countryCode: cleanCountryCode,
        countryName: cleanCountryName,
        phoneDialPrefix: cleanPrefix,
        phoneNumber: cleanPhone,
        phoneVerified: Boolean(params.phoneVerified),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${authUser.uid}`);
    }
  };

  const updateAccountEmail = async (
    newEmail: string,
    currentPassword?: string
  ): Promise<{ status: 'updated' | 'verification_sent'; email: string }> => {
    const current = auth.currentUser;
    if (!current || !userProfile) throw new Error('Authentication required.');
    const cleanEmail = newEmail.trim().toLowerCase().slice(0, 254);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error('Please enter a valid email address.');
    }
    if (cleanEmail === (current.email || userProfile.email).toLowerCase()) {
      throw new Error('The new email address is the same as your current email.');
    }

    const usesGoogle = current.providerData.some((p) => p.providerId === 'google.com');
    const usesPassword = current.providerData.some((p) => p.providerId === 'password');

    if (currentPassword && current.email && usesPassword) {
      const cred = EmailAuthProvider.credential(current.email, currentPassword);
      await reauthenticateWithCredential(current, cred);
    }

    const applyEmailSync = async () => {
      try {
        await updateDoc(doc(db, 'users', current.uid), {
          email: cleanEmail,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${current.uid}`);
      }
      try {
        const emailHash = await sha256Hex(cleanEmail);
        const existingHash = await getDoc(doc(db, 'emailHashes', emailHash));
        if (!existingHash.exists()) {
          await setDoc(doc(db, 'emailHashes', emailHash), {
            uid: current.uid,
            handle: userProfile.handle,
            displayName: userProfile.fullName,
            createdAt: serverTimestamp(),
          });
        }
      } catch {
        // Non-fatal email lookup index sync
      }
    };

    try {
      await updateEmail(current, cleanEmail);
      await applyEmailSync();
      setAuthUser({ ...current, email: cleanEmail } as User);
      return { status: 'updated', email: cleanEmail };
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/requires-recent-login') {
        if (usesGoogle && !currentPassword) {
          await reauthenticateWithPopup(current, googleProvider);
          try {
            await updateEmail(current, cleanEmail);
            await applyEmailSync();
            setAuthUser({ ...current, email: cleanEmail } as User);
            return { status: 'updated', email: cleanEmail };
          } catch (retryErr) {
            const retryCode = (retryErr as { code?: string })?.code || '';
            if (retryCode === 'auth/operation-not-allowed') {
              await verifyBeforeUpdateEmail(current, cleanEmail);
              return { status: 'verification_sent', email: cleanEmail };
            }
            throw retryErr;
          }
        }
        throw new Error(
          'Security check required: enter your current account password above to confirm this email change.'
        );
      }
      if (code === 'auth/operation-not-allowed') {
        await verifyBeforeUpdateEmail(current, cleanEmail);
        return { status: 'verification_sent', email: cleanEmail };
      }
      if (code === 'auth/email-already-in-use') {
        throw new Error('That email address is already registered to another account.');
      }
      throw err;
    }
  };

  const resendVerificationEmail = async () => {
    if (!auth.currentUser) throw new Error('No active session.');
    await sendEmailVerification(auth.currentUser);
  };

  const refreshAuthVerification = async () => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    const updated = auth.currentUser;
    if (updated.emailVerified) {
      await updated.getIdToken(true);
      setAuthUser(updated);
      setAuthSyncTick((t) => t + 1);
      const rawDraft =
        localStorage.getItem(`vtv_kyc_draft_${updated.uid}`) ||
        localStorage.getItem('vtv_pending_kyc_draft');
      let draft: KycDraft | null = null;
      if (rawDraft) {
        try {
          draft = JSON.parse(rawDraft) as KycDraft;
        } catch {
          draft = null;
        }
      }
      await ensureUserProvisioned(updated, draft);
      return true;
    }
    return false;
  };

  const retryProfileSync = useCallback(async () => {
    const current = auth.currentUser;
    if (!current) return;
    await current.reload();
    if (current.emailVerified) {
      await current.getIdToken(true);
      setAuthUser(current);
      const rawDraft =
        localStorage.getItem(`vtv_kyc_draft_${current.uid}`) ||
        localStorage.getItem('vtv_pending_kyc_draft');
      let draft: KycDraft | null = null;
      if (rawDraft) {
        try {
          draft = JSON.parse(rawDraft) as KycDraft;
        } catch {
          draft = null;
        }
      }
      await ensureUserProvisioned(current, draft);
      setAuthSyncTick((t) => t + 1);
    }
  }, [ensureUserProvisioned]);

  const signOutUser = async () => {
    clearGoogleChatToken();
    await signOut(auth);
  };

  const assertKycPolicyAllowed = (
    gate: 'deposits' | 'packages' | 'claims' | 'withdrawals',
    profile: UserProfile
  ) => {
    const kycPolicy = platformConfig.kycSettings || DEFAULT_GLOBAL_KYC_SETTINGS;
    const isRequired =
      (gate === 'deposits' && kycPolicy.requireKycForDeposits) ||
      (gate === 'packages' && kycPolicy.requireKycForPackages) ||
      (gate === 'claims' && kycPolicy.requireKycForClaims) ||
      (gate === 'withdrawals' && kycPolicy.requireKycForWithdrawals);
    if (!isRequired || profile.kycStatus === 'approved') return;

    const gateLabels = {
      deposits: 'submitting deposits',
      packages: 'activating investment packages',
      claims: 'claiming accrued rewards',
      withdrawals: 'requesting withdrawals',
    };
    const statusHint =
      profile.kycStatus === 'pending'
        ? 'Your KYC submission is currently under compliance review.'
        : profile.kycStatus === 'rejected'
        ? `Your previous KYC was rejected${profile.kycRejectionReason ? ` (${profile.kycRejectionReason})` : ''}. Please resubmit under Account & Security -> KYC Verification.`
        : 'Complete your identity check under Account & Security -> KYC Verification.';
    throw new Error(`KYC Verification Required before ${gateLabels[gate]}. ${statusHint}`);
  };

  const submitCryptoDeposit = async (params: {
    network: CryptoNetwork;
    amountUsd: number;
    txId: string;
  }) => {
    if (!authUser || !userProfile) throw new Error('User vault profile required.');
    if (userProfile.suspended) {
      throw new Error(`Account suspended: ${userProfile.suspensionReason || 'Contact compliance support.'}`);
    }
    assertKycPolicyAllowed('deposits', userProfile);
    const methodId = sanitizeRuleId(params.network, 'USDT_TRC20');
    const amount = Number(params.amountUsd);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Enter a valid deposit USD amount.');
    }
    const configuredMethod = platformConfig.paymentMethods.find((m) => m.id === methodId);
    if (configuredMethod && (!configuredMethod.enabled || !configuredMethod.allowDeposit)) {
      throw new Error(`${configuredMethod.name} deposits are currently disabled.`);
    }
    const minDeposit = configuredMethod?.minDepositUsd || 1;
    if (amount < minDeposit) {
      throw new Error(`Minimum deposit for ${configuredMethod?.name || methodId} is $${minDeposit.toFixed(2)}.`);
    }
    if (!params.txId.trim()) {
      throw new Error('Transaction ID / reference hash is required.');
    }

    const fallbackWallet =
      methodId === 'USDT_TRC20'
        ? platformConfig.depositWallets.usdtTrc20
        : methodId === 'USDT_ERC20'
        ? platformConfig.depositWallets.usdtErc20
        : platformConfig.depositWallets.sol;
    const walletAddress = (configuredMethod?.receivingAccount || fallbackWallet || 'ON_FILE').trim().slice(0, 160);

    const depId = makeId('dep');
    try {
      await setDoc(doc(db, 'cryptoDeposits', depId), {
        uid: authUser.uid,
        userEmail: userProfile.email,
        userName: userProfile.fullName,
        network: methodId,
        walletAddress,
        amountUsd: Number(amount.toFixed(2)),
        txId: params.txId.trim().slice(0, 160),
        status: 'pending',
        adminNote: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `cryptoDeposits/${depId}`);
    }
  };

  const addUserPaymentMethod = async (params: {
    label: string;
    methodId: string;
    methodName: string;
    accountAddress: string;
    accountHolder: string;
    isDefault?: boolean;
  }) => {
    if (!authUser || !userProfile) throw new Error('Authentication required.');
    const cleanLabel = params.label.trim().slice(0, 80);
    const cleanMethodId = params.methodId.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
    const cleanMethodName = params.methodName.trim().slice(0, 80);
    const cleanAddress = params.accountAddress.trim().slice(0, 160);
    const cleanHolder = params.accountHolder.trim().slice(0, 120);

    if (!cleanLabel || !cleanMethodId || !cleanMethodName || !cleanAddress) {
      throw new Error('Please fill in nickname, payment channel, and account/wallet address.');
    }

    const docId = makeId('pm');
    const shouldDefault = params.isDefault ?? savedPaymentMethods.length === 0;

    try {
      const batch = writeBatch(db);
      if (shouldDefault) {
        for (const existingPm of savedPaymentMethods) {
          if (existingPm.isDefault) {
            batch.update(doc(db, 'users', authUser.uid, 'paymentMethods', existingPm.id), {
              isDefault: false,
              updatedAt: serverTimestamp(),
            });
          }
        }
      }
      batch.set(doc(db, 'users', authUser.uid, 'paymentMethods', docId), {
        uid: authUser.uid,
        label: cleanLabel,
        methodId: cleanMethodId,
        methodName: cleanMethodName,
        accountAddress: cleanAddress,
        accountHolder: cleanHolder,
        isDefault: shouldDefault,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${authUser.uid}/paymentMethods/${docId}`);
    }
  };

  const setDefaultUserPaymentMethod = async (methodDocId: string) => {
    if (!authUser) throw new Error('Authentication required.');
    try {
      const batch = writeBatch(db);
      for (const pm of savedPaymentMethods) {
        const nextDefault = pm.id === methodDocId;
        if (pm.isDefault !== nextDefault) {
          batch.update(doc(db, 'users', authUser.uid, 'paymentMethods', pm.id), {
            isDefault: nextDefault,
            updatedAt: serverTimestamp(),
          });
        }
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${authUser.uid}/paymentMethods/${methodDocId}`);
    }
  };

  const deleteUserPaymentMethod = async (methodDocId: string) => {
    if (!authUser) throw new Error('Authentication required.');
    try {
      await deleteDoc(doc(db, 'users', authUser.uid, 'paymentMethods', methodDocId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${authUser.uid}/paymentMethods/${methodDocId}`);
    }
  };

  const activatePackage = async (
    pkg: InvestmentPackage,
    fundingSource: PackageFundingSource = 'deposit_wallet'
  ) => {
    if (!authUser || !userProfile) throw new Error('Authentication required.');
    if (userProfile.suspended) {
      throw new Error(`Account suspended: ${userProfile.suspensionReason || 'Contact compliance support.'}`);
    }
    assertKycPolicyAllowed('packages', userProfile);
    if (platformConfig.moduleControls?.aiTradingEnabled === false) {
      throw new Error('AI Trading module is temporarily disabled by administration.');
    }
    if (platformConfig.globalPaused) throw new Error('Trading allocations are temporarily paused by administration.');

    if (fundingSource === 'deposit_wallet' && userProfile.usdBalance < pkg.capital) {
      throw new Error(
        `Insufficient Deposit Wallet balance. Deposit $${(pkg.capital - userProfile.usdBalance).toFixed(2)} more or switch funding source.`
      );
    }
    if (fundingSource === 'income_wallet' && userProfile.profitBalance < pkg.capital) {
      throw new Error(
        `Insufficient Income Wallet balance. Need $${(pkg.capital - userProfile.profitBalance).toFixed(2)} more or use Combined/Deposit Wallet.`
      );
    }
    if (
      fundingSource === 'combined' &&
      userProfile.usdBalance + userProfile.profitBalance < pkg.capital
    ) {
      throw new Error(
        `Insufficient combined Deposit + Income Wallet balance. Need $${(
          pkg.capital -
          (userProfile.usdBalance + userProfile.profitBalance)
        ).toFixed(2)} more.`
      );
    }

    const invId = makeId('inv');
    const pkgNumber = 400 + investments.length + Math.floor(Math.random() * 50) + 1;

    try {
      await runTransaction(db, async (tx) => {
        const userRef = doc(db, 'users', authUser.uid);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists()) throw new Error('Profile missing.');
        const current = userSnap.data() as UserProfile;

        let deductDeposit = 0;
        let deductIncome = 0;
        if (fundingSource === 'deposit_wallet') {
          if (current.usdBalance < pkg.capital) {
            throw new Error('Insufficient Deposit Wallet balance.');
          }
          deductDeposit = pkg.capital;
        } else if (fundingSource === 'income_wallet') {
          if (current.profitBalance < pkg.capital) {
            throw new Error('Insufficient Income Wallet balance.');
          }
          deductIncome = pkg.capital;
        } else {
          if (current.usdBalance + current.profitBalance < pkg.capital) {
            throw new Error('Insufficient combined wallet balance.');
          }
          deductDeposit = Number(Math.min(current.usdBalance, pkg.capital).toFixed(2));
          deductIncome = Number((pkg.capital - deductDeposit).toFixed(2));
        }

        // Read uplines before writing
        const uplines: { uid: string; level: number; rate: number; snapData: UserProfile }[] = [];
        const rates = [platformConfig.mlmRates.level1, platformConfig.mlmRates.level2, platformConfig.mlmRates.level3];

        for (let i = 0; i < Math.min(3, (current.uplineChain || []).length); i++) {
          const upUid = current.uplineChain[i];
          const rate = rates[i] || 0;
          if (!upUid || rate <= 0) continue;
          const upSnap = await tx.get(doc(db, 'users', upUid));
          if (upSnap.exists()) {
            uplines.push({ uid: upUid, level: i + 1, rate, snapData: upSnap.data() as UserProfile });
          }
        }

        // Read referral links
        const refSnapshots = [];
        for (const u of uplines) {
          const refLinkRef = doc(db, 'referrals', `${authUser.uid}_L${u.level}`);
          const rSnap = await tx.get(refLinkRef);
          if (rSnap.exists()) {
            refSnapshots.push({ ref: refLinkRef, data: rSnap.data() as ReferralLinkRecord });
          }
        }

        const nextUsdBalance = Number(Math.max(0, current.usdBalance - deductDeposit).toFixed(2));
        const nextProfitBalance = Number(Math.max(0, current.profitBalance - deductIncome).toFixed(2));
        const nextTotalInvested = Number((current.totalInvested + pkg.capital).toFixed(2));
        const startedAtMs = Date.now();
        const totalProfitDays = pkg.profitDays || platformConfig.totalProfitDays;
        const capitalLockDays = pkg.id === 'elite' ? platformConfig.eliteCapitalLockDays : pkg.capitalLockDays;

        // Deduct capital & record investment
        tx.update(userRef, {
          usdBalance: nextUsdBalance,
          profitBalance: nextProfitBalance,
          totalInvested: nextTotalInvested,
          updatedAt: serverTimestamp(),
        });

        tx.set(doc(db, 'investments', invId), {
          uid: authUser.uid,
          packageNumber: pkgNumber,
          packageId: pkg.id,
          packageName: pkg.name,
          capital: pkg.capital,
          dailyPercent: pkg.dailyPercent,
          aiMode: pkg.aiMode,
          totalProfitDays,
          capitalLockDays,
          isMentorGifted: false,
          claimedProfit: 0,
          status: 'active',
          startedAtMs,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Pay MLM commissions & Mentor Commission override + track Mentor Volume on Level 1
        const mentorCfg = platformConfig.mentorConfig || DEFAULT_PLATFORM_CONFIG.mentorConfig;

        for (const u of uplines) {
          const refCommUsd = Number(((pkg.capital * u.rate) / 100).toFixed(2));
          const isLevel1Mentor =
            u.level === 1 &&
            Boolean(u.snapData.isMentor) &&
            Boolean(mentorCfg.enabled) &&
            Number(mentorCfg.mentorCommissionPercent) > 0;
          const mentorBonusUsd = isLevel1Mentor
            ? Number(((pkg.capital * mentorCfg.mentorCommissionPercent) / 100).toFixed(2))
            : 0;
          const totalCredit = Number((refCommUsd + mentorBonusUsd).toFixed(2));
          const addedVolume = u.level === 1 ? pkg.capital : 0;

          if (totalCredit > 0 || addedVolume > 0) {
            const nextProfit = Number((u.snapData.profitBalance + totalCredit).toFixed(2));
            const nextBrought = Number(((u.snapData.mentorBroughtVolume || 0) + addedVolume).toFixed(2));

            tx.update(doc(db, 'users', u.uid), {
              profitBalance: nextProfit,
              mentorBroughtVolume: nextBrought,
              updatedAt: serverTimestamp(),
            });
          }

          if (refCommUsd > 0) {
            const commId = makeId(`mlmL${u.level}`);
            tx.set(doc(db, 'mlmCommissions', commId), {
              beneficiaryUid: u.uid,
              fromUid: authUser.uid,
              fromName: current.fullName,
              level: u.level,
              commissionType: 'referral',
              investmentAmount: pkg.capital,
              ratePercent: u.rate,
              commissionUsd: refCommUsd,
              createdAt: serverTimestamp(),
            });
          }

          if (mentorBonusUsd > 0) {
            const mentorCommId = makeId('mentorC');
            tx.set(doc(db, 'mlmCommissions', mentorCommId), {
              beneficiaryUid: u.uid,
              fromUid: authUser.uid,
              fromName: current.fullName,
              level: 1,
              commissionType: 'mentor',
              investmentAmount: pkg.capital,
              ratePercent: mentorCfg.mentorCommissionPercent,
              commissionUsd: mentorBonusUsd,
              createdAt: serverTimestamp(),
            });
          }
        }

        for (const r of refSnapshots) {
          tx.update(r.ref, {
            totalInvestedUsd: Number(((r.data.totalInvestedUsd || 0) + pkg.capital).toFixed(2)),
            updatedAt: serverTimestamp(),
          });
        }
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `investments/${invId}`);
    }
  };

  const transferIncomeToDepositWallet = async (amountUsd: number) => {
    if (!authUser || !userProfile) throw new Error('Authentication required.');
    if (userProfile.suspended) {
      throw new Error(`Account suspended: ${userProfile.suspensionReason || 'Contact compliance support.'}`);
    }
    const amount = Number(Number(amountUsd).toFixed(2));
    if (!Number.isFinite(amount) || amount < 1) {
      throw new Error('Minimum internal wallet transfer is $1.00 USD.');
    }
    if (userProfile.profitBalance < amount) {
      throw new Error(
        `Insufficient Income Wallet balance. Available: $${userProfile.profitBalance.toFixed(2)}.`
      );
    }

    const wtId = makeId('wtx');
    try {
      await runTransaction(db, async (tx) => {
        const userRef = doc(db, 'users', authUser.uid);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists()) throw new Error('Profile missing.');
        const cur = userSnap.data() as UserProfile;
        if (cur.profitBalance < amount) {
          throw new Error('Insufficient Income Wallet balance.');
        }

        tx.update(userRef, {
          usdBalance: Number((cur.usdBalance + amount).toFixed(2)),
          profitBalance: Number((cur.profitBalance - amount).toFixed(2)),
          updatedAt: serverTimestamp(),
        });

        tx.set(doc(db, 'walletTransfers', wtId), {
          uid: authUser.uid,
          userName: (cur.fullName || userProfile.fullName || 'Vault Client').slice(0, 120),
          direction: 'income_to_deposit',
          fromWallet: 'Income Wallet',
          toWallet: 'Deposit Wallet',
          amountUsd: amount,
          note: 'Internal wallet transfer for package funding',
          status: 'approved',
          createdAt: serverTimestamp(),
        });
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${authUser.uid}`);
    }
  };

  const claimInvestmentProfit = async (investment: Investment): Promise<number> => {
    if (!authUser || !userProfile) throw new Error('Authentication required.');
    if (userProfile.suspended) {
      throw new Error(`Account suspended: ${userProfile.suspensionReason || 'Contact compliance support.'}`);
    }
    assertKycPolicyAllowed('claims', userProfile);
    const metrics = computeInvestmentMetrics(investment, platformConfig.globalPaused);
    if (metrics.unclaimedProfit <= 0) {
      throw new Error('No unclaimed weekday profit available yet.');
    }

    const claimAmount = metrics.unclaimedProfit;
    try {
      await runTransaction(db, async (tx) => {
        const invRef = doc(db, 'investments', investment.id);
        const userRef = doc(db, 'users', authUser.uid);
        const invSnap = await tx.get(invRef);
        const userSnap = await tx.get(userRef);
        if (!invSnap.exists() || !userSnap.exists()) throw new Error('Record not found.');

        const curInv = invSnap.data() as Investment;
        const curUser = userSnap.data() as UserProfile;
        const nextStatus =
          metrics.completedProfitDays >= (curInv.totalProfitDays || 200) && curInv.status === 'active'
            ? 'completed'
            : curInv.status;
        const nextClaimed = Number(((curInv.claimedProfit || 0) + claimAmount).toFixed(2));
        const nextProfitBalance = Number((curUser.profitBalance + claimAmount).toFixed(2));

        tx.update(invRef, {
          claimedProfit: nextClaimed,
          status: nextStatus,
          updatedAt: serverTimestamp(),
        });

        tx.update(userRef, {
          profitBalance: nextProfitBalance,
          updatedAt: serverTimestamp(),
        });
      });
      return claimAmount;
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `investments/${investment.id}`);
    }
  };

  const withdrawInstantProfit = async (params: {
    amountUsd: number;
    network: CryptoNetwork;
    destinationAddress: string;
    source: 'package_profit' | 'mlm_commission' | 'mentor_profit';
    settlementMode?: 'pending' | 'completed';
  }) => {
    if (!authUser || !userProfile) throw new Error('Authentication required.');
    if (userProfile.suspended) {
      throw new Error(`Account suspended: ${userProfile.suspensionReason || 'Contact compliance support.'}`);
    }
    assertKycPolicyAllowed('withdrawals', userProfile);
    if (platformConfig.withdrawalsPaused) {
      throw new Error('Withdrawals are temporarily paused for scheduled maintenance by administration.');
    }
    const amount = Number(params.amountUsd);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Enter a valid withdrawal USD amount.');
    }
    const cleanNetwork = sanitizeRuleId(params.network, 'USDT_TRC20');
    const activeMethod = (platformConfig.paymentMethods || []).find((m) => m.id === cleanNetwork);
    if (activeMethod && (!activeMethod.enabled || !activeMethod.allowWithdrawal)) {
      throw new Error(`Withdrawals are currently disabled for ${activeMethod.name}.`);
    }
    const effectiveMinWd = Math.max(platformConfig.minWithdrawalUsd, activeMethod?.minWithdrawalUsd || 0);
    if (amount < effectiveMinWd) {
      throw new Error(
        `Minimum withdrawal${activeMethod ? ` for ${activeMethod.name}` : ''} is $${effectiveMinWd.toFixed(2)}.`
      );
    }
    if (!params.destinationAddress.trim()) {
      throw new Error('Destination payout address or account number is required.');
    }
    if (amount > userProfile.profitBalance) {
      throw new Error('Insufficient withdrawable profit balance.');
    }
    if (
      userProfile.isMentor &&
      userProfile.mentorGiftedCapital > 0 &&
      userProfile.mentorBroughtVolume < userProfile.mentorRequiredVolume
    ) {
      const remaining = (userProfile.mentorRequiredVolume - userProfile.mentorBroughtVolume).toFixed(2);
      throw new Error(
        `Mentor Volume Rule Active: Bring $${remaining} more in referred investment volume ($${userProfile.mentorBroughtVolume.toFixed(
          2
        )} / $${userProfile.mentorRequiredVolume.toFixed(2)}) to unlock profit withdrawals.`
      );
    }

    const targetStatus = params.settlementMode === 'completed' ? 'completed' : 'pending';
    const withId = makeId('wdp');
    try {
      await runTransaction(db, async (tx) => {
        const userRef = doc(db, 'users', authUser.uid);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists()) throw new Error('Profile missing.');
        const cur = userSnap.data() as UserProfile;
        if (cur.profitBalance < amount) throw new Error('Insufficient profit balance.');

        const nextProfitBalance = Number((cur.profitBalance - amount).toFixed(2));
        const nextTotalWithdrawn =
          targetStatus === 'completed'
            ? Number((cur.totalWithdrawn + amount).toFixed(2))
            : cur.totalWithdrawn;

        tx.update(userRef, {
          profitBalance: nextProfitBalance,
          totalWithdrawn: nextTotalWithdrawn,
          updatedAt: serverTimestamp(),
        });

        tx.set(doc(db, 'withdrawals', withId), {
          uid: authUser.uid,
          userEmail: cur.email,
          userName: cur.fullName,
          type: 'instant_profit',
          source: params.source,
          investmentId: '',
          packageNumber: 0,
          investmentDate: '',
          principalCapital: 0,
          totalProfitGenerated: 0,
          amountUsd: Number(amount.toFixed(2)),
          network: cleanNetwork,
          destinationAddress: params.destinationAddress.trim().slice(0, 160),
          status: targetStatus,
          adminNote: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `withdrawals/${withId}`);
    }
  };

  const requestManualCapitalWithdrawal = async (params: {
    investment: Investment;
    network: CryptoNetwork;
    destinationAddress: string;
  }) => {
    if (!authUser || !userProfile) throw new Error('Authentication required.');
    if (userProfile.suspended) {
      throw new Error(`Account suspended: ${userProfile.suspensionReason || 'Contact compliance support.'}`);
    }
    assertKycPolicyAllowed('withdrawals', userProfile);
    if (platformConfig.withdrawalsPaused) {
      throw new Error('Capital withdrawals are temporarily paused for scheduled maintenance by administration.');
    }
    const inv = params.investment;
    const metrics = computeInvestmentMetrics(inv, platformConfig.globalPaused);
    if (!metrics.isCapitalUnlockEligible) {
      throw new Error(
        `Capital is locked for ${metrics.daysRemainingForCapital} more calendar days (eligible ${metrics.capitalUnlockDateLabel}).`
      );
    }
    if (inv.status === 'capital_requested' || inv.status === 'capital_withdrawn') {
      throw new Error('Capital withdrawal already submitted for this package.');
    }
    if (!params.destinationAddress.trim()) {
      throw new Error('Destination payout address is required.');
    }

    const withId = makeId('wdc');
    const cleanNetwork = sanitizeRuleId(params.network, 'USDT_TRC20');
    const wdDoc: Omit<Withdrawal, 'id' | 'createdAt'> = {
      uid: authUser.uid,
      userEmail: userProfile.email,
      userName: userProfile.fullName,
      type: 'manual_capital',
      source: 'elite_capital',
      investmentId: inv.id,
      packageNumber: inv.packageNumber,
      investmentDate: formatTimestamp(inv.createdAt, inv.startedAtMs),
      principalCapital: inv.capital,
      totalProfitGenerated: metrics.totalProfitGenerated,
      amountUsd: inv.capital,
      network: cleanNetwork,
      destinationAddress: params.destinationAddress.trim().slice(0, 160),
      status: 'pending',
      adminNote: '',
    };
    try {
      await runTransaction(db, async (tx) => {
        const invRef = doc(db, 'investments', inv.id);
        const invSnap = await tx.get(invRef);
        if (!invSnap.exists()) throw new Error('Package not found.');

        tx.update(invRef, {
          status: 'capital_requested',
          updatedAt: serverTimestamp(),
        });

        tx.set(doc(db, 'withdrawals', withId), {
          ...wdDoc,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `withdrawals/${withId}`);
    }
  };

  const sendP2PTransfer = async (params: {
    recipientQuery: string;
    amountUsd: number;
    note: string;
  }) => {
    if (!authUser || !userProfile) throw new Error('Authentication required.');
    if (userProfile.suspended) {
      throw new Error(`Account suspended: ${userProfile.suspensionReason || 'Contact compliance support.'}`);
    }
    if (platformConfig.p2pPaused || platformConfig.moduleControls?.p2pEnabled === false) {
      throw new Error('P2P internal transfers are temporarily paused by administration.');
    }
    const amount = Number(params.amountUsd);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Transfer amount must be greater than $0.');
    }
    if (amount > userProfile.usdBalance) throw new Error('Insufficient USD Vault balance.');

    const clean = params.recipientQuery.trim();
    if (!clean) throw new Error('Enter recipient email or User ID / handle.');

    let targetUid = '';
    let targetHandle = '';
    let targetName = '';

    if (clean.includes('@')) {
      const hash = await sha256Hex(clean);
      const emailSnap = await getDoc(doc(db, 'emailHashes', hash));
      if (!emailSnap.exists()) throw new Error('No registered Vault user found with that email.');
      const data = emailSnap.data() as { uid: string; handle: string; displayName: string };
      targetUid = data.uid;
      targetHandle = data.handle;
      targetName = data.displayName;
    } else {
      const handleSnap = await getDoc(doc(db, 'handles', clean.toUpperCase()));
      if (!handleSnap.exists()) throw new Error('No Vault user found with that User ID / Handle.');
      const data = handleSnap.data() as { uid: string; handle: string; displayName: string };
      targetUid = data.uid;
      targetHandle = data.handle;
      targetName = data.displayName;
    }

    if (targetUid === authUser.uid) {
      throw new Error('Cannot transfer USD to your own account.');
    }

    const p2pId = makeId('p2p');
    try {
      await runTransaction(db, async (tx) => {
        const senderRef = doc(db, 'users', authUser.uid);
        const receiverRef = doc(db, 'users', targetUid);
        const senderSnap = await tx.get(senderRef);
        const receiverSnap = await tx.get(receiverRef);
        if (!senderSnap.exists() || !receiverSnap.exists()) throw new Error('Account record missing.');

        const senderData = senderSnap.data() as UserProfile;
        const receiverData = receiverSnap.data() as UserProfile;
        if (senderData.usdBalance < amount) throw new Error('Insufficient USD balance.');

        const nextSenderBalance = Number((senderData.usdBalance - amount).toFixed(2));
        const nextReceiverBalance = Number((receiverData.usdBalance + amount).toFixed(2));

        tx.update(senderRef, {
          usdBalance: nextSenderBalance,
          updatedAt: serverTimestamp(),
        });

        tx.update(receiverRef, {
          usdBalance: nextReceiverBalance,
          updatedAt: serverTimestamp(),
        });

        tx.set(doc(db, 'p2pTransfers', p2pId), {
          senderUid: authUser.uid,
          senderHandle: senderData.handle,
          senderName: senderData.fullName,
          receiverUid: targetUid,
          receiverHandle: targetHandle,
          receiverName: targetName,
          amountUsd: amount,
          note: params.note.trim().slice(0, 200),
          createdAt: serverTimestamp(),
        });
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `p2pTransfers/${p2pId}`);
    }
  };

  const investPumpFunMemeCoin = async (params: {
    amountUsd: number;
    paymentMethod: 'USD_VAULT' | 'SOL_WALLET';
    txSignature?: string;
  }) => {
    if (!authUser || !userProfile) throw new Error('Authentication required.');
    if (userProfile.suspended) {
      throw new Error(`Account suspended: ${userProfile.suspensionReason || 'Contact compliance support.'}`);
    }
    if (platformConfig.moduleControls?.coinMiningEnabled === false) {
      throw new Error('Coin Launchpad & Mining module is temporarily disabled by administration.');
    }
    const amount = Number(params.amountUsd);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Allocation amount must be greater than $0.');
    }

    const token = platformConfig.pumpFunToken;
    const tokenQuantity = Number((amount / Math.max(0.0000001, token.priceUsd)).toFixed(2));
    const allocId = makeId('meme');
    const memeDoc: Omit<MemeCoinInvestment, 'id' | 'createdAt'> = {
      uid: authUser.uid,
      userName: userProfile.fullName,
      tokenTicker: token.ticker,
      mintAddress: token.mintAddress,
      paymentMethod: params.paymentMethod,
      amountUsd: amount,
      tokenQuantity,
      entryPriceUsd: token.priceUsd,
      txSignature: (params.txSignature || `VAULT_${allocId}`).trim(),
    };

    try {
      await runTransaction(db, async (tx) => {
        if (params.paymentMethod === 'USD_VAULT') {
          const userRef = doc(db, 'users', authUser.uid);
          const userSnap = await tx.get(userRef);
          if (!userSnap.exists()) throw new Error('Profile missing.');
          const cur = userSnap.data() as UserProfile;
          if (cur.usdBalance < amount) throw new Error('Insufficient USD Vault balance.');

          const nextUsdBalance = Number((cur.usdBalance - amount).toFixed(2));
          tx.update(userRef, {
            usdBalance: nextUsdBalance,
            updatedAt: serverTimestamp(),
          });
        }

        tx.set(doc(db, 'memeCoinInvestments', allocId), {
          ...memeDoc,
          createdAt: serverTimestamp(),
        });
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `memeCoinInvestments/${allocId}`);
    }
  };

  const startCoinMiningStake = async (plan: CoinMiningPlan, amountUsd: number) => {
    if (!authUser || !userProfile) throw new Error('Authentication required.');
    if (userProfile.suspended) {
      throw new Error(`Account suspended: ${userProfile.suspensionReason || 'Contact compliance support.'}`);
    }
    if (platformConfig.moduleControls?.coinMiningEnabled === false || !platformConfig.coinMiningSettings.paidMiningEnabled) {
      throw new Error('Coin mining allocations are temporarily paused by administration.');
    }
    if (!plan.enabled) {
      throw new Error(`${plan.name} is currently disabled.`);
    }
    const amount = Number(amountUsd);
    if (!Number.isFinite(amount) || amount < plan.minUsd || amount > plan.maxUsd) {
      throw new Error(`Enter an amount between $${plan.minUsd} and $${plan.maxUsd} for ${plan.name}.`);
    }
    if (userProfile.usdBalance < amount) {
      throw new Error(`Insufficient Deposit Wallet balance. Need $${(amount - userProfile.usdBalance).toFixed(2)} more.`);
    }

    const stakeId = makeId('mine');
    const cleanPlanId = sanitizeRuleId(plan.id, 'asic_plan');
    const nowMs = Date.now();

    try {
      await runTransaction(db, async (tx) => {
        const userRef = doc(db, 'users', authUser.uid);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists()) throw new Error('Profile missing.');
        const cur = userSnap.data() as UserProfile;
        if (cur.usdBalance < amount) throw new Error('Insufficient USD Vault balance.');

        tx.update(userRef, {
          usdBalance: Number((cur.usdBalance - amount).toFixed(2)),
          totalInvested: Number((cur.totalInvested + amount).toFixed(2)),
          updatedAt: serverTimestamp(),
        });

        tx.set(doc(db, 'coinMiningStakes', stakeId), {
          uid: authUser.uid,
          userName: cur.fullName,
          planId: cleanPlanId,
          planName: plan.name.trim().slice(0, 80),
          principalUsd: Number(amount.toFixed(2)),
          dailyInterestPercent: Number(plan.dailyInterestPercent),
          durationDays: Math.max(1, Math.round(plan.durationDays)),
          coinBonusPerUsd: Math.max(0, Number(plan.coinBonusPerUsd)),
          claimedUsd: 0,
          claimedCoins: 0,
          startedAtMs: nowMs,
          lastClaimAtMs: nowMs,
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `coinMiningStakes/${stakeId}`);
    }
  };

  const claimCoinMiningInterest = async (
    stake: CoinMiningStake
  ): Promise<{ claimedUsd: number; claimedCoins: number }> => {
    if (!authUser || !userProfile) throw new Error('Authentication required.');
    if (stake.status !== 'active') throw new Error('This mining rig has completed its full term.');

    const MS_PER_DAY = 86_400_000;
    const nowMs = Date.now();
    const maxEndMs = stake.startedAtMs + stake.durationDays * MS_PER_DAY;
    const effectiveNowMs = Math.min(nowMs, maxEndMs);
    const totalElapsedDays = Math.floor((effectiveNowMs - stake.startedAtMs) / MS_PER_DAY);
    const alreadyClaimedDays = Math.floor((stake.lastClaimAtMs - stake.startedAtMs) / MS_PER_DAY);
    const claimableDays = Math.max(0, totalElapsedDays - alreadyClaimedDays);

    if (claimableDays <= 0) {
      throw new Error('Daily mining interest unlocks every 24 hours. Check countdown for next claim.');
    }

    const dailyUsd = (stake.principalUsd * stake.dailyInterestPercent) / 100;
    const claimUsd = Number((dailyUsd * claimableDays).toFixed(2));
    const claimCoins = Number(((stake.principalUsd * stake.coinBonusPerUsd) / stake.durationDays * claimableDays).toFixed(2));
    const nextLastClaimMs = stake.startedAtMs + totalElapsedDays * MS_PER_DAY;
    const nextStatus = totalElapsedDays >= stake.durationDays ? 'completed' : 'active';

    try {
      await runTransaction(db, async (tx) => {
        const stakeRef = doc(db, 'coinMiningStakes', stake.id);
        const userRef = doc(db, 'users', authUser.uid);
        const stakeSnap = await tx.get(stakeRef);
        const userSnap = await tx.get(userRef);
        if (!stakeSnap.exists() || !userSnap.exists()) throw new Error('Mining stake missing.');

        const curStake = stakeSnap.data() as CoinMiningStake;
        if (curStake.status !== 'active') throw new Error('Mining stake already completed.');
        const curUser = userSnap.data() as UserProfile;

        tx.update(stakeRef, {
          claimedUsd: Number(((curStake.claimedUsd || 0) + claimUsd).toFixed(2)),
          claimedCoins: Number(((curStake.claimedCoins || 0) + claimCoins).toFixed(2)),
          lastClaimAtMs: nextLastClaimMs,
          status: nextStatus,
          updatedAt: serverTimestamp(),
        });

        tx.update(userRef, {
          profitBalance: Number((curUser.profitBalance + claimUsd).toFixed(2)),
          updatedAt: serverTimestamp(),
        });
      });

      return { claimedUsd: claimUsd, claimedCoins: claimCoins };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `coinMiningStakes/${stake.id}`);
    }
  };

  const syncTapMiningProgress = async (params: {
    addedCoins: number;
    energy: number;
    dayKey: string;
  }) => {
    if (!authUser) return;
    const added = Math.max(0, Number(params.addedCoins) || 0);
    if (added <= 0) return;

    const tapRef = doc(db, 'coinTapAccounts', authUser.uid);
    const maxCap = platformConfig.coinMiningSettings.dailyTapLimitCoins;
    const maxEnergy = platformConfig.coinMiningSettings.maxEnergy;
    const safeEnergy = Math.max(0, Math.min(maxEnergy, Math.round(params.energy)));
    const nowMs = Date.now();

    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(tapRef);
        if (!snap.exists()) {
          const cappedAdded = Math.min(added, maxCap);
          tx.set(tapRef, {
            uid: authUser.uid,
            totalTappedCoins: cappedAdded,
            unclaimedTapCoins: cappedAdded,
            dailyTappedCoins: cappedAdded,
            lastTapDayKey: params.dayKey,
            totalClaimedUsdFromTap: 0,
            totalClaimedCoins: 0,
            energy: safeEnergy,
            lastEnergySyncMs: nowMs,
            updatedAt: serverTimestamp(),
          });
          return;
        }
        const cur = snap.data() as CoinTapAccount;
        const baseDaily = cur.lastTapDayKey === params.dayKey ? cur.dailyTappedCoins || 0 : 0;
        const allowedAdd = Math.max(0, Math.min(added, maxCap - baseDaily));
        if (allowedAdd <= 0) return;

        tx.update(tapRef, {
          totalTappedCoins: Number(((cur.totalTappedCoins || 0) + allowedAdd).toFixed(2)),
          unclaimedTapCoins: Number(((cur.unclaimedTapCoins || 0) + allowedAdd).toFixed(2)),
          dailyTappedCoins: Number((baseDaily + allowedAdd).toFixed(2)),
          lastTapDayKey: params.dayKey,
          energy: safeEnergy,
          lastEnergySyncMs: nowMs,
          updatedAt: serverTimestamp(),
        });
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `coinTapAccounts/${authUser.uid}`);
    }
  };

  const claimTapMiningRewards = async (
    pendingLocalCoins = 0
  ): Promise<{ claimedCoins: number; creditedUsd: number }> => {
    if (!authUser || !userProfile) throw new Error('Authentication required.');
    const settings = platformConfig.coinMiningSettings;
    if (!settings.tapToMineEnabled) throw new Error('Free tap-to-mine is currently disabled.');

    const tapRef = doc(db, 'coinTapAccounts', authUser.uid);
    const userRef = doc(db, 'users', authUser.uid);
    const todayKey = getTodayDayKey();
    const nowMs = Date.now();

    try {
      let localCoinsToProcess = Math.max(0, Number(pendingLocalCoins) || 0);
      const initialCheckSnap = await getDoc(tapRef);
      if (!initialCheckSnap.exists() && localCoinsToProcess > 0) {
        await syncTapMiningProgress({
          addedCoins: localCoinsToProcess,
          energy: Math.max(0, settings.maxEnergy - settings.energyCostPerTap),
          dayKey: todayKey,
        });
        localCoinsToProcess = 0;
      }

      let result = { claimedCoins: 0, creditedUsd: 0 };
      await runTransaction(db, async (tx) => {
        const tapSnap = await tx.get(tapRef);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists()) throw new Error('Profile missing.');
        const curUser = userSnap.data() as UserProfile;

        const existingTap = tapSnap.exists() ? (tapSnap.data() as CoinTapAccount) : null;
        const baseDaily =
          existingTap && existingTap.lastTapDayKey === todayKey ? existingTap.dailyTappedCoins || 0 : 0;
        const extraLocal = Math.max(
          0,
          Math.min(localCoinsToProcess, settings.dailyTapLimitCoins - baseDaily)
        );
        const totalClaimableCoins = Number(
          (((existingTap?.unclaimedTapCoins || 0) + extraLocal)).toFixed(2)
        );

        if (totalClaimableCoins <= 0) {
          throw new Error('Tap the $ATX coin to mine free rewards before claiming.');
        }

        const creditedUsd = Number((totalClaimableCoins * settings.tapUsdPerCoin).toFixed(4));
        const creditRoundedUsd = Number(creditedUsd.toFixed(2));

        if (!tapSnap.exists() || !existingTap) {
          throw new Error('Tap the $ATX coin to mine free rewards before claiming.');
        }
        if (settings.tapUsdPerCoin > 0 && creditRoundedUsd <= 0) {
          throw new Error('Mine a few more taps to reach at least $0.01 USD before claiming.');
        }

        tx.update(tapRef, {
          totalTappedCoins: Number(((existingTap.totalTappedCoins || 0) + extraLocal).toFixed(2)),
          unclaimedTapCoins: 0,
          dailyTappedCoins: Number((baseDaily + extraLocal).toFixed(2)),
          lastTapDayKey: todayKey,
          totalClaimedUsdFromTap: Number(
            ((existingTap.totalClaimedUsdFromTap || 0) + creditedUsd).toFixed(4)
          ),
          totalClaimedCoins: Number(
            ((existingTap.totalClaimedCoins || 0) + totalClaimableCoins).toFixed(2)
          ),
          lastEnergySyncMs: nowMs,
          updatedAt: serverTimestamp(),
        });

        if (creditRoundedUsd > 0) {
          tx.update(userRef, {
            profitBalance: Number((curUser.profitBalance + creditRoundedUsd).toFixed(2)),
            updatedAt: serverTimestamp(),
          });
        }

        result = { claimedCoins: totalClaimableCoins, creditedUsd: creditRoundedUsd };
      });
      return result;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `coinTapAccounts/${authUser.uid}`);
    }
  };

  // =========================================================================
  // Forex WebTerminal & Copy Trade Operations
  // =========================================================================

  const openForexTrade = async (params: {
    symbol: string;
    direction: 'BUY' | 'SELL';
    tier: ForexAccountTierConfig;
    lots: number;
    leverage: number;
    entryPrice: number;
    slPrice: number;
    tpPrice: number;
    marginUsd: number;
    commissionUsd: number;
  }) => {
    if (!authUser || !userProfile) throw new Error('Authentication required to place Forex orders.');
    if (userProfile.suspended) {
      throw new Error(`Account suspended: ${userProfile.suspensionReason || 'Contact compliance support.'}`);
    }
    if (platformConfig.moduleControls?.forexMarketEnabled === false) {
      throw new Error('Forex Market module is temporarily disabled by administration.');
    }
    if (platformConfig.globalPaused) {
      throw new Error('Platform trading is temporarily paused by administration.');
    }
    if (platformConfig.forexConfig?.tradingEnabled === false) {
      throw new Error('Forex WebTerminal execution is temporarily disabled by administration.');
    }
    if (!params.tier.enabled) {
      throw new Error(`${params.tier.name} account tier is currently disabled.`);
    }

    const hasPurchasedPackage = investments.length > 0 || (userProfile.totalInvested || 0) > 0;
    if (!hasPurchasedPackage) {
      throw new Error(
        'Purchase an AI Trading package from your Deposit Wallet first. Forex trading is unlocked strictly with Income Wallet profits earned after buying a package (Direct Deposit Trade is Upcoming).'
      );
    }

    const lots = Number(params.lots);
    const leverage = Math.round(Number(params.leverage));
    const entryPrice = Number(params.entryPrice);
    const slPrice = Math.max(0, Number(params.slPrice) || 0);
    const tpPrice = Math.max(0, Number(params.tpPrice) || 0);
    const marginUsd = Number(Number(params.marginUsd).toFixed(2));
    const commissionUsd = Number(Math.max(0, Number(params.commissionUsd) || 0).toFixed(2));
    const totalOutlayUsd = Number((marginUsd + commissionUsd).toFixed(2));

    if (!Number.isFinite(lots) || lots < 0.01 || lots > 100) {
      throw new Error('Lot size must be between 0.01 and 100 lots.');
    }
    if (!Number.isFinite(leverage) || leverage < 1 || leverage > params.tier.maxLeverage) {
      throw new Error(`Leverage for ${params.tier.name} cannot exceed 1:${params.tier.maxLeverage}.`);
    }
    if (!Number.isFinite(entryPrice) || entryPrice <= 0 || marginUsd <= 0) {
      throw new Error('Live quote unavailable. Wait a moment for price sync.');
    }
    if (userProfile.profitBalance < params.tier.minDepositUsd) {
      throw new Error(
        `${params.tier.name} account requires at least $${params.tier.minDepositUsd.toFixed(2)} in your Income Wallet. Direct Deposit trading is Upcoming.`
      );
    }
    if (userProfile.profitBalance < totalOutlayUsd) {
      throw new Error(
        `Insufficient Income Wallet balance. Need $${totalOutlayUsd.toFixed(2)} (Margin $${marginUsd.toFixed(
          2
        )} + Fee $${commissionUsd.toFixed(2)}). Direct Deposit trading is Upcoming.`
      );
    }

    const tradeId = makeId('fx');
    const nowMs = Date.now();

    try {
      await runTransaction(db, async (tx) => {
        const userRef = doc(db, 'users', authUser.uid);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists()) throw new Error('User vault profile missing.');
        const cur = userSnap.data() as UserProfile;

        if (investments.length === 0 && (cur.totalInvested || 0) <= 0) {
          throw new Error(
            'Purchase a package from your Deposit Wallet first to trade Forex with your Income Wallet.'
          );
        }
        if (cur.profitBalance < params.tier.minDepositUsd) {
          throw new Error(
            `${params.tier.name} requires $${params.tier.minDepositUsd.toFixed(2)} minimum Income Wallet balance.`
          );
        }
        if (cur.profitBalance < totalOutlayUsd) {
          throw new Error('Insufficient Income Wallet balance for margin + commission.');
        }

        tx.update(userRef, {
          profitBalance: Number((cur.profitBalance - totalOutlayUsd).toFixed(2)),
          updatedAt: serverTimestamp(),
        });

        tx.set(doc(db, 'forexTrades', tradeId), {
          uid: authUser.uid,
          userName: cur.fullName.trim().slice(0, 120) || 'Vault Trader',
          symbol: params.symbol.trim().slice(0, 16),
          direction: params.direction,
          accountTierId: params.tier.id,
          accountTierName: params.tier.name.trim().slice(0, 40),
          lots: Number(lots.toFixed(2)),
          leverage,
          entryPrice,
          closePrice: 0,
          slPrice,
          tpPrice,
          marginUsd,
          commissionUsd,
          realizedPnlUsd: 0,
          status: 'open',
          openedAtMs: nowMs,
          closedAtMs: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `forexTrades/${tradeId}`);
    }
  };

  const closeForexTrade = async (
    trade: ForexTrade,
    closePrice: number,
    realizedPnlUsd: number
  ) => {
    if (!authUser || !userProfile) throw new Error('Authentication required.');
    if (trade.status !== 'open') throw new Error('Position is already closed.');

    const safeClosePrice = Number(closePrice);
    if (!Number.isFinite(safeClosePrice) || safeClosePrice <= 0) {
      throw new Error('Valid market closing quote required.');
    }

    // Cap realized loss at -marginUsd so negative balance protection holds
    const boundedPnl = Number(Math.max(-trade.marginUsd, Number(realizedPnlUsd) || 0).toFixed(2));
    const closedAtMs = Math.max(trade.openedAtMs, Date.now());

    try {
      await runTransaction(db, async (tx) => {
        const tradeRef = doc(db, 'forexTrades', trade.id);
        const userRef = doc(db, 'users', authUser.uid);
        const tradeSnap = await tx.get(tradeRef);
        const userSnap = await tx.get(userRef);
        if (!tradeSnap.exists() || !userSnap.exists()) throw new Error('Trade record missing.');

        const curTrade = tradeSnap.data() as ForexTrade;
        if (curTrade.status !== 'open') throw new Error('Trade already closed.');
        const curUser = userSnap.data() as UserProfile;

        const returnedMarginUsd =
          boundedPnl >= 0
            ? curTrade.marginUsd
            : Math.max(0, Number((curTrade.marginUsd + boundedPnl).toFixed(2)));
        const addedProfitUsd = boundedPnl > 0 ? boundedPnl : 0;
        const creditToIncomeWalletUsd = Number((returnedMarginUsd + addedProfitUsd).toFixed(2));

        tx.update(tradeRef, {
          closePrice: safeClosePrice,
          realizedPnlUsd: boundedPnl,
          status: 'closed',
          closedAtMs,
          updatedAt: serverTimestamp(),
        });

        tx.update(userRef, {
          profitBalance: Number((curUser.profitBalance + creditToIncomeWalletUsd).toFixed(2)),
          updatedAt: serverTimestamp(),
        });
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `forexTrades/${trade.id}`);
    }
  };

  const startCopyTrade = async (params: {
    trader: CopyTraderProfile;
    accountTierId: ForexAccountTierId;
    allocatedUsd: number;
    riskMultiplier: number;
    stopLossPercent: number;
  }) => {
    if (!authUser || !userProfile) throw new Error('Authentication required to start Copy Trading.');
    if (userProfile.suspended) {
      throw new Error(`Account suspended: ${userProfile.suspensionReason || 'Contact compliance support.'}`);
    }
    if (platformConfig.moduleControls?.forexMarketEnabled === false) {
      throw new Error('Forex & Copy Trading module is temporarily disabled by administration.');
    }
    if (platformConfig.globalPaused) {
      throw new Error('Platform allocations are temporarily paused by administration.');
    }
    if (platformConfig.forexConfig?.copyTradingEnabled === false) {
      throw new Error('Copy Trading is temporarily disabled by administration.');
    }
    if (!params.trader.enabled) {
      throw new Error(`${params.trader.name} is not accepting new copiers right now.`);
    }

    const hasPurchasedPackage = investments.length > 0 || (userProfile.totalInvested || 0) > 0;
    if (!hasPurchasedPackage) {
      throw new Error(
        'Purchase an AI Trading package from your Deposit Wallet first. Copy Trading allocates strictly from Income Wallet profits (Direct Deposit Trade is Upcoming).'
      );
    }

    const allocatedUsd = Number(Number(params.allocatedUsd).toFixed(2));
    const riskMultiplier = Math.max(0.25, Math.min(5, Number(params.riskMultiplier) || 1));
    const stopLossPercent = Math.max(5, Math.min(95, Number(params.stopLossPercent) || 25));

    if (!Number.isFinite(allocatedUsd) || allocatedUsd < params.trader.minCopyUsd) {
      throw new Error(
        `Minimum copy allocation for ${params.trader.name} is $${params.trader.minCopyUsd.toFixed(2)}.`
      );
    }
    if (userProfile.profitBalance < allocatedUsd) {
      throw new Error(
        `Insufficient Income Wallet balance. Need $${(allocatedUsd - userProfile.profitBalance).toFixed(
          2
        )} more in earned Income Wallet balance.`
      );
    }

    const subId = makeId('copy');
    const cleanTraderId = sanitizeRuleId(params.trader.id, 'master');
    const nowMs = Date.now();

    try {
      await runTransaction(db, async (tx) => {
        const userRef = doc(db, 'users', authUser.uid);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists()) throw new Error('Profile missing.');
        const cur = userSnap.data() as UserProfile;
        if (investments.length === 0 && (cur.totalInvested || 0) <= 0) {
          throw new Error('Purchase a package from your Deposit Wallet first before Copy Trading.');
        }
        if (cur.profitBalance < allocatedUsd) {
          throw new Error('Insufficient Income Wallet balance.');
        }

        tx.update(userRef, {
          profitBalance: Number((cur.profitBalance - allocatedUsd).toFixed(2)),
          updatedAt: serverTimestamp(),
        });

        tx.set(doc(db, 'copyTradeSubscriptions', subId), {
          uid: authUser.uid,
          userName: cur.fullName.trim().slice(0, 120) || 'Vault Copier',
          traderId: cleanTraderId,
          traderName: params.trader.name.trim().slice(0, 80),
          traderHandle: params.trader.handle.trim().slice(0, 32),
          accountTierId: params.accountTierId,
          allocatedUsd,
          riskMultiplier,
          stopLossPercent,
          performanceFeePercent: Math.max(0, Math.min(50, Number(params.trader.performanceFeePercent) || 20)),
          dailyTargetPercent: Math.max(0, Math.min(50, Number(params.trader.dailyTargetPercent) || 1)),
          claimedProfitUsd: 0,
          startedAtMs: nowMs,
          lastSyncedAtMs: nowMs,
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `copyTradeSubscriptions/${subId}`);
    }
  };

  const computeAccruedCopyNetUsd = (sub: CopyTradeSubscription, nowMs: number): number => {
    const elapsedMs = Math.max(0, nowMs - (sub.lastSyncedAtMs || sub.startedAtMs));
    const daysElapsed = elapsedMs / 86_400_000;
    const grossUsd =
      sub.allocatedUsd * (sub.dailyTargetPercent / 100) * sub.riskMultiplier * daysElapsed;
    const netFactor = 1 - Math.max(0, Math.min(50, sub.performanceFeePercent)) / 100;
    return Number((grossUsd * netFactor).toFixed(2));
  };

  const claimCopyTradeProfit = async (sub: CopyTradeSubscription): Promise<number> => {
    if (!authUser || !userProfile) throw new Error('Authentication required.');
    if (sub.status !== 'active') throw new Error('Copy subscription is already stopped.');

    const nowMs = Date.now();
    const pendingNetUsd = computeAccruedCopyNetUsd(sub, nowMs);
    if (pendingNetUsd < 0.01) {
      throw new Error(
        'Accrued net copy profit has not reached $0.01 yet. Mirrored strategy profits accrue continuously.'
      );
    }

    try {
      await runTransaction(db, async (tx) => {
        const subRef = doc(db, 'copyTradeSubscriptions', sub.id);
        const userRef = doc(db, 'users', authUser.uid);
        const subSnap = await tx.get(subRef);
        const userSnap = await tx.get(userRef);
        if (!subSnap.exists() || !userSnap.exists()) throw new Error('Subscription record missing.');

        const curSub = subSnap.data() as CopyTradeSubscription;
        if (curSub.status !== 'active') throw new Error('Copy subscription is stopped.');
        const curUser = userSnap.data() as UserProfile;

        const safeClaim = computeAccruedCopyNetUsd(curSub, nowMs);
        if (safeClaim < 0.01) throw new Error('Accrued copy profit is under $0.01.');

        tx.update(subRef, {
          claimedProfitUsd: Number(((curSub.claimedProfitUsd || 0) + safeClaim).toFixed(2)),
          lastSyncedAtMs: nowMs,
          updatedAt: serverTimestamp(),
        });

        tx.update(userRef, {
          profitBalance: Number((curUser.profitBalance + safeClaim).toFixed(2)),
          updatedAt: serverTimestamp(),
        });
      });
      return pendingNetUsd;
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `copyTradeSubscriptions/${sub.id}`);
    }
  };

  const stopCopyTrade = async (
    sub: CopyTradeSubscription
  ): Promise<{ returnedCapitalUsd: number; claimedProfitUsd: number }> => {
    if (!authUser || !userProfile) throw new Error('Authentication required.');
    if (sub.status !== 'active') throw new Error('Copy subscription is already stopped.');

    const nowMs = Date.now();
    let finalClaimed = 0;

    try {
      await runTransaction(db, async (tx) => {
        const subRef = doc(db, 'copyTradeSubscriptions', sub.id);
        const userRef = doc(db, 'users', authUser.uid);
        const subSnap = await tx.get(subRef);
        const userSnap = await tx.get(userRef);
        if (!subSnap.exists() || !userSnap.exists()) throw new Error('Subscription record missing.');

        const curSub = subSnap.data() as CopyTradeSubscription;
        if (curSub.status !== 'active') throw new Error('Copy subscription already stopped.');
        const curUser = userSnap.data() as UserProfile;

        finalClaimed = computeAccruedCopyNetUsd(curSub, nowMs);
        const addProfit = finalClaimed >= 0.01 ? finalClaimed : 0;

        tx.update(subRef, {
          claimedProfitUsd: Number(((curSub.claimedProfitUsd || 0) + addProfit).toFixed(2)),
          lastSyncedAtMs: Math.max(curSub.lastSyncedAtMs, nowMs),
          status: 'stopped',
          updatedAt: serverTimestamp(),
        });

        tx.update(userRef, {
          profitBalance: Number((curUser.profitBalance + curSub.allocatedUsd + addProfit).toFixed(2)),
          updatedAt: serverTimestamp(),
        });
      });

      return { returnedCapitalUsd: sub.allocatedUsd, claimedProfitUsd: finalClaimed };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `copyTradeSubscriptions/${sub.id}`);
    }
  };

  // =========================================================================
  // Super Admin Actions (Invoked strictly inside /admin)
  // =========================================================================

  const updatePlatformConfig = async (next: PlatformConfig) => {
    const rawAnn = next.dashboardAnnouncement || DEFAULT_PLATFORM_CONFIG.dashboardAnnouncement;
    const safeAnnouncement = {
      enabled: Boolean(rawAnn.enabled),
      tone: (['info', 'warning', 'urgent', 'success'].includes(rawAnn.tone)
        ? rawAnn.tone
        : 'info') as PlatformConfig['dashboardAnnouncement']['tone'],
      title: String(rawAnn.title || '').trim().slice(0, 120),
      message: String(rawAnn.message || '').trim().slice(0, 500),
      updatedBy: String(rawAnn.updatedBy || authUser?.email || 'Super Admin').trim().slice(0, 120),
    };

    const rawMentor = next.mentorConfig || DEFAULT_PLATFORM_CONFIG.mentorConfig;
    const safeMentorConfig = {
      enabled: Boolean(rawMentor.enabled),
      mentorCommissionPercent: Math.max(0, Math.min(50, Number(rawMentor.mentorCommissionPercent) || 0)),
      volumeMultiplier: Math.max(1, Math.min(20, Number(rawMentor.volumeMultiplier) || 4)),
      defaultGiftCapital: Math.max(1, Number(rawMentor.defaultGiftCapital) || 500),
      defaultDailyPercent: Math.max(0.1, Math.min(50, Number(rawMentor.defaultDailyPercent) || 2.0)),
    };

    const rawTap = next.coinMiningSettings || DEFAULT_PLATFORM_CONFIG.coinMiningSettings;
    const safeCoinMiningSettings = {
      paidMiningEnabled: Boolean(rawTap.paidMiningEnabled),
      tapToMineEnabled: Boolean(rawTap.tapToMineEnabled),
      tapRewardCoins: Math.max(0.1, Number(rawTap.tapRewardCoins) || 5),
      tapUsdPerCoin: Math.max(0, Number(rawTap.tapUsdPerCoin) || 0),
      maxEnergy: Math.max(10, Math.round(Number(rawTap.maxEnergy) || 500)),
      energyCostPerTap: Math.max(1, Math.round(Number(rawTap.energyCostPerTap) || 1)),
      energyRegenPerSec: Math.max(0, Number(rawTap.energyRegenPerSec) || 2),
      dailyTapLimitCoins: Math.max(1, Math.round(Number(rawTap.dailyTapLimitCoins) || 2500)),
    };

    const safePackages = (Array.isArray(next.packages) && next.packages.length > 0
      ? next.packages
      : DEFAULT_PLATFORM_CONFIG.packages
    )
      .slice(0, 25)
      .map((p, idx) => ({
        id: sanitizeRuleId(p.id || `pkg_${idx + 1}`, `pkg_${idx + 1}`),
        name: String(p.name || `Tier ${idx + 1}`).trim().slice(0, 80),
        capital: Math.max(1, Number(p.capital) || 100),
        dailyPercent: Math.max(0.1, Math.min(50, Number(p.dailyPercent) || 1)),
        aiMode: String(p.aiMode || 'AI Execution Engine').trim().slice(0, 100),
        profitDays: Math.max(1, Math.round(Number(p.profitDays) || 200)),
        capitalLockDays: Math.max(0, Math.round(Number(p.capitalLockDays) || 200)),
        description: String(p.description || '').trim().slice(0, 300),
      }));

    const safePaymentMethods: PaymentMethodConfig[] = (
      Array.isArray(next.paymentMethods) && next.paymentMethods.length > 0
        ? next.paymentMethods
        : DEFAULT_PLATFORM_CONFIG.paymentMethods
    )
      .slice(0, 25)
      .map((pm, idx) => ({
        ...pm,
        id: sanitizeRuleId(pm.id || `PM_${idx + 1}`, `PM_${idx + 1}`),
        name: String(pm.name || `Channel ${idx + 1}`).trim().slice(0, 80),
        receivingAccount: String(pm.receivingAccount || '').trim().slice(0, 160),
        withdrawAddress: String(pm.withdrawAddress ?? pm.receivingAccount ?? '').trim().slice(0, 160),
        instructions: String(pm.instructions || '').trim().slice(0, 300),
        minDepositUsd: Math.max(1, Number(pm.minDepositUsd) || 10),
        minWithdrawalUsd: Math.max(1, Number(pm.minWithdrawalUsd) || 10),
      }));

    const safeBannerAds: BannerAdConfig[] = (Array.isArray(next.bannerAds) ? next.bannerAds : [])
      .slice(0, 15)
      .map((ad, idx) => ({
        id: sanitizeRuleId(ad.id || `ad_${idx + 1}`, `ad_${idx + 1}`),
        enabled: Boolean(ad.enabled),
        title: String(ad.title || '').trim().slice(0, 120),
        subtitle: String(ad.subtitle || '').trim().slice(0, 300),
        badgeText: String(ad.badgeText || '').trim().slice(0, 40),
        ctaText: String(ad.ctaText || 'Learn More').trim().slice(0, 40),
        ctaUrl: String(ad.ctaUrl || '#coin-mining-desk').trim().slice(0, 300),
        imageUrl: String(ad.imageUrl || '').trim().slice(0, 500),
        placement: ad.placement === 'all_pages' ? 'all_pages' : 'coin_page',
        theme: (['gold', 'emerald', 'sky', 'crimson'].includes(ad.theme)
          ? ad.theme
          : 'gold') as BannerAdConfig['theme'],
      }));

    const safeMiningPlans: CoinMiningPlan[] = (Array.isArray(next.coinMiningPlans)
      ? next.coinMiningPlans
      : []
    )
      .slice(0, 20)
      .map((plan, idx) => {
        const minUsd = Math.max(1, Number(plan.minUsd) || 25);
        const maxUsd = Math.max(minUsd, Number(plan.maxUsd) || minUsd * 10);
        return {
          id: sanitizeRuleId(plan.id || `rig_${idx + 1}`, `rig_${idx + 1}`),
          name: String(plan.name || `Mining Rig ${idx + 1}`).trim().slice(0, 80),
          minUsd,
          maxUsd,
          dailyInterestPercent: Math.max(0.1, Math.min(50, Number(plan.dailyInterestPercent) || 1.5)),
          durationDays: Math.max(1, Math.min(1000, Math.round(Number(plan.durationDays) || 30))),
          hashRateLabel: String(plan.hashRateLabel || '100 TH/s').trim().slice(0, 40),
          coinBonusPerUsd: Math.max(0, Number(plan.coinBonusPerUsd) || 0),
          enabled: Boolean(plan.enabled),
        };
      });

    const clampScore = (val: unknown, fallback: number) => {
      const n = Number(val);
      return Number.isFinite(n) ? Math.max(0, Math.min(5, Number(n.toFixed(1)))) : fallback;
    };

    const safeMlmRates = {
      level1: Math.max(0, Math.min(50, Number(next.mlmRates?.level1) || 0)),
      level2: Math.max(0, Math.min(50, Number(next.mlmRates?.level2) || 0)),
      level3: Math.max(0, Math.min(50, Number(next.mlmRates?.level3) || 0)),
    };

    const rawToken = next.pumpFunToken || DEFAULT_PLATFORM_CONFIG.pumpFunToken;
    const safePumpFunToken = {
      name: String(rawToken.name || 'Alphatradex').trim().slice(0, 80) || 'Alphatradex',
      ticker: String(rawToken.ticker || 'ATX').trim().slice(0, 20) || 'ATX',
      mintAddress: String(rawToken.mintAddress || DEFAULT_PLATFORM_CONFIG.pumpFunToken.mintAddress)
        .trim()
        .slice(0, 160),
      pumpFunUrl: String(rawToken.pumpFunUrl || 'https://pump.fun').trim().slice(0, 300),
      priceUsd: Math.max(0.000001, Number(rawToken.priceUsd) || 0.0042),
      marketCapUsd: Math.max(0, Number(rawToken.marketCapUsd) || 0),
      change24hPercent: Number.isFinite(Number(rawToken.change24hPercent))
        ? Number(rawToken.change24hPercent)
        : 0,
      description: String(rawToken.description || '').trim().slice(0, 600),
    };

    const safeDepositWallets = {
      usdtTrc20: String(next.depositWallets?.usdtTrc20 || '').trim().slice(0, 160),
      usdtErc20: String(next.depositWallets?.usdtErc20 || '').trim().slice(0, 160),
      sol: String(next.depositWallets?.sol || '').trim().slice(0, 160),
    };

    const defaultFx = DEFAULT_PLATFORM_CONFIG.forexConfig!;
    const rawFx = next.forexConfig || defaultFx;
    const validTierIds: ForexAccountTierId[] = ['standard', 'pro', 'raw_spread'];
    const safeAccountTiers: ForexAccountTierConfig[] = (
      Array.isArray(rawFx.accountTiers) && rawFx.accountTiers.length > 0
        ? rawFx.accountTiers
        : defaultFx.accountTiers
    )
      .slice(0, 6)
      .map((tier, idx) => ({
        id: validTierIds.includes(tier.id) ? tier.id : validTierIds[idx % 3],
        name: String(tier.name || `Tier ${idx + 1}`).trim().slice(0, 40) || `Tier ${idx + 1}`,
        tagline: String(tier.tagline || '').trim().slice(0, 160),
        commissionPerLot: Math.max(0, Math.min(100, Number(tier.commissionPerLot) || 0)),
        spreadMultiplier: Math.max(0.05, Math.min(5, Number(tier.spreadMultiplier) || 1)),
        minDepositUsd: Math.max(1, Number(tier.minDepositUsd) || 10),
        maxLeverage: Math.max(10, Math.min(2000, Math.round(Number(tier.maxLeverage) || 500))),
        executionType: String(tier.executionType || 'Market Execution').trim().slice(0, 60),
        enabled: Boolean(tier.enabled),
      }));

    const safeCopyTraders: CopyTraderProfile[] = (
      Array.isArray(rawFx.copyTraders) ? rawFx.copyTraders : []
    )
      .slice(0, 20)
      .map((ct, idx) => ({
        id: sanitizeRuleId(ct.id || `trader_${idx + 1}`, `trader_${idx + 1}`).slice(0, 64),
        name: String(ct.name || `Master Trader ${idx + 1}`).trim().slice(0, 80),
        handle: String(ct.handle || `@MASTER${idx + 1}`).trim().slice(0, 32),
        strategy: String(ct.strategy || '').trim().slice(0, 300),
        pairs: String(ct.pairs || 'EUR/USD · XAU/USD').trim().slice(0, 80),
        riskLevel: (['Low', 'Moderate', 'Dynamic'].includes(ct.riskLevel)
          ? ct.riskLevel
          : 'Moderate') as CopyTraderProfile['riskLevel'],
        monthlyRoiPercent: Math.max(-50, Math.min(500, Number(ct.monthlyRoiPercent) || 0)),
        winRatePercent: Math.max(1, Math.min(100, Number(ct.winRatePercent) || 70)),
        maxDrawdownPercent: Math.max(0.5, Math.min(99, Number(ct.maxDrawdownPercent) || 10)),
        profitFactor: Math.max(0.1, Math.min(20, Number(ct.profitFactor) || 1.5)),
        performanceFeePercent: Math.max(0, Math.min(50, Number(ct.performanceFeePercent) || 20)),
        dailyTargetPercent: Math.max(0, Math.min(50, Number(ct.dailyTargetPercent) || 1.0)),
        minCopyUsd: Math.max(1, Number(ct.minCopyUsd) || 25),
        recommendedTierId: validTierIds.includes(ct.recommendedTierId)
          ? ct.recommendedTierId
          : 'standard',
        followersCount: Math.max(0, Math.round(Number(ct.followersCount) || 0)),
        enabled: Boolean(ct.enabled),
      }));

    const safeModuleControls: AdminModuleControls = {
      aiTradingEnabled: next.moduleControls?.aiTradingEnabled !== false,
      forexMarketEnabled: next.moduleControls?.forexMarketEnabled !== false,
      coinMiningEnabled: next.moduleControls?.coinMiningEnabled !== false,
      p2pEnabled: next.moduleControls?.p2pEnabled !== false,
      requireSignupForTradingModules:
        next.moduleControls?.requireSignupForTradingModules !== false,
    };

    const safeSupportLinks: SupportLinksConfig = {
      telegramUrl: String(next.supportLinks?.telegramUrl || '').trim().slice(0, 250),
      whatsappUrl: String(next.supportLinks?.whatsappUrl || '').trim().slice(0, 250),
      supportEmail: String(next.supportLinks?.supportEmail || '').trim().slice(0, 254),
    };

    const rawAuto = next.supportAutoResponder || DEFAULT_SUPPORT_AUTO_RESPONDER;
    const safeSupportAutoResponder: SupportAutoResponderConfig = {
      enabled: rawAuto.enabled !== false,
      notifyOnStatusChange: rawAuto.notifyOnStatusChange !== false,
      senderName:
        String(rawAuto.senderName || DEFAULT_SUPPORT_AUTO_RESPONDER.senderName)
          .trim()
          .slice(0, 120) || DEFAULT_SUPPORT_AUTO_RESPONDER.senderName,
      subjectTemplate:
        String(rawAuto.subjectTemplate || DEFAULT_SUPPORT_AUTO_RESPONDER.subjectTemplate)
          .trim()
          .slice(0, 200) || DEFAULT_SUPPORT_AUTO_RESPONDER.subjectTemplate,
      bodyTemplate:
        String(rawAuto.bodyTemplate || DEFAULT_SUPPORT_AUTO_RESPONDER.bodyTemplate)
          .trim()
          .slice(0, 2000) || DEFAULT_SUPPORT_AUTO_RESPONDER.bodyTemplate,
      slaUrgent:
        String(rawAuto.slaUrgent || DEFAULT_SUPPORT_AUTO_RESPONDER.slaUrgent)
          .trim()
          .slice(0, 80) || DEFAULT_SUPPORT_AUTO_RESPONDER.slaUrgent,
      slaHigh:
        String(rawAuto.slaHigh || DEFAULT_SUPPORT_AUTO_RESPONDER.slaHigh)
          .trim()
          .slice(0, 80) || DEFAULT_SUPPORT_AUTO_RESPONDER.slaHigh,
      slaMedium:
        String(rawAuto.slaMedium || DEFAULT_SUPPORT_AUTO_RESPONDER.slaMedium)
          .trim()
          .slice(0, 80) || DEFAULT_SUPPORT_AUTO_RESPONDER.slaMedium,
      slaLow:
        String(rawAuto.slaLow || DEFAULT_SUPPORT_AUTO_RESPONDER.slaLow)
          .trim()
          .slice(0, 80) || DEFAULT_SUPPORT_AUTO_RESPONDER.slaLow,
    };

    const rawKycCfg = next.kycSettings || DEFAULT_GLOBAL_KYC_SETTINGS;
    const allowedProviders: KycProviderId[] = [
      'free_qr_mrz_ocr',
      'free_ai_ocr',
      'didit_free',
      'sumsub',
      'veriff',
      'shufti_pro',
      'custom_webhook',
    ];
    const safeKycSettings: GlobalKycSettings = {
      enabled: rawKycCfg.enabled !== false,
      requireKycForDeposits: Boolean(rawKycCfg.requireKycForDeposits),
      requireKycForPackages: Boolean(rawKycCfg.requireKycForPackages),
      requireKycForClaims: Boolean(rawKycCfg.requireKycForClaims),
      requireKycForWithdrawals: Boolean(rawKycCfg.requireKycForWithdrawals),
      allowFreeAiOcr: rawKycCfg.allowFreeAiOcr !== false,
      requireBackSideForCards: rawKycCfg.requireBackSideForCards !== false,
      requireLiveSelfie: rawKycCfg.requireLiveSelfie !== false,
      activeProvider: allowedProviders.includes(rawKycCfg.activeProvider)
        ? rawKycCfg.activeProvider
        : 'free_qr_mrz_ocr',
      disabledCountryCodes: Array.from(
        new Set(
          (Array.isArray(rawKycCfg.disabledCountryCodes) ? rawKycCfg.disabledCountryCodes : [])
            .map((c) => String(c || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))
            .filter(Boolean)
        )
      ).slice(0, 250),
    };

    const defaultMc = DEFAULT_PLATFORM_CONFIG.marketingCardsConfig!;
    const rawMc = next.marketingCardsConfig || defaultMc;
    const allowedThemes: MarketingCardThemeId[] = [
      'navy_gold',
      'emerald_green',
      'cyber_cyan',
      'royal_purple',
    ];
    const allowedCategories: MarketingCardCategory[] = [
      'member',
      'package',
      'trading',
      'referral',
      'milestone',
      'launchpad',
      'custom',
    ];
    const safeMarketingTemplates: MarketingCardTemplateConfig[] = (
      Array.isArray(rawMc.templates) ? rawMc.templates : defaultMc.templates
    )
      .slice(0, 20)
      .map((tpl, idx) => {
        const cleanTpl: MarketingCardTemplateConfig = {
          id: sanitizeRuleId(tpl.id || `tpl_${idx + 1}`, `tpl_${idx + 1}`),
          name: String(tpl.name || `Template ${idx + 1}`).trim().slice(0, 80) || `Template ${idx + 1}`,
          category: allowedCategories.includes(tpl.category) ? tpl.category : 'custom',
          enabled: tpl.enabled !== false,
          headline: String(tpl.headline || defaultMc.defaultHeadline).trim().slice(0, 140),
          subheadline: String(tpl.subheadline || defaultMc.defaultTagline).trim().slice(0, 220),
          badgeText: String(tpl.badgeText || 'OFFICIAL').trim().slice(0, 48),
          ctaText: String(tpl.ctaText || 'Join via Referral').trim().slice(0, 64),
          defaultTheme: allowedThemes.includes(tpl.defaultTheme) ? tpl.defaultTheme : 'navy_gold',
        };
        if (tpl.isCustom) {
          cleanTpl.isCustom = true;
          if (tpl.overlayImageData) {
            cleanTpl.overlayImageData = String(tpl.overlayImageData).slice(0, 220_000);
          }
          if (tpl.photoSlot) {
            cleanTpl.photoSlot = {
              xPct: Math.max(5, Math.min(95, Number(tpl.photoSlot.xPct) || 50)),
              yPct: Math.max(5, Math.min(95, Number(tpl.photoSlot.yPct) || 38)),
              sizePct: Math.max(12, Math.min(60, Number(tpl.photoSlot.sizePct) || 28)),
            };
          }
          if (tpl.textSlot) {
            cleanTpl.textSlot = {
              xPct: Math.max(5, Math.min(95, Number(tpl.textSlot.xPct) || 50)),
              yPct: Math.max(5, Math.min(95, Number(tpl.textSlot.yPct) || 68)),
            };
          }
        }
        return cleanTpl;
      });

    const safeMarketingCardsConfig: MarketingCardsConfig = {
      enabled: rawMc.enabled !== false,
      allowQrCode: rawMc.allowQrCode !== false,
      allowReferralCode: rawMc.allowReferralCode !== false,
      allowRankBadge: rawMc.allowRankBadge !== false,
      allowPackageBadge: rawMc.allowPackageBadge !== false,
      defaultHeadline: String(rawMc.defaultHeadline || defaultMc.defaultHeadline).trim().slice(0, 140),
      defaultTagline: String(rawMc.defaultTagline || defaultMc.defaultTagline).trim().slice(0, 240),
      disclaimerText: String(rawMc.disclaimerText || defaultMc.disclaimerText).trim().slice(0, 300),
      templates: safeMarketingTemplates,
    };

    const writeAdminLog = async (entry: Omit<AdminActionLog, 'id' | 'adminUid' | 'adminEmail' | 'createdAt'>) => {
      if (!authUser) return;
      try {
        const logId = makeId('alog');
        await setDoc(doc(db, 'adminLogs', logId), {
          adminUid: authUser.uid,
          adminEmail: (authUser.email || SUPER_ADMIN_EMAIL).trim().slice(0, 254),
          action: entry.action.trim().slice(0, 80),
          targetUid: entry.targetUid.trim().slice(0, 128),
          targetLabel: (entry.targetLabel.trim() || 'Platform').slice(0, 160),
          details: (entry.details.trim() || 'Admin action executed').slice(0, 500),
          amountUsd: Number.isFinite(entry.amountUsd) ? Number(entry.amountUsd.toFixed(2)) : 0,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Admin audit log write skipped:', err instanceof Error ? err.message : String(err));
      }
    };

    try {
      await setDoc(doc(db, 'config', 'platform'), {
        ...next,
        companyName:
          String(next.companyName || DEFAULT_PLATFORM_CONFIG.companyName).trim().slice(0, 120) ||
          'Alphatradex',
        companyTagline: String(next.companyTagline || '').trim().slice(0, 200),
        companyDescription: String(next.companyDescription || '').trim().slice(0, 1500),
        companyGoal: String(next.companyGoal || '').trim().slice(0, 1500),
        riskDisclosure: String(next.riskDisclosure || '').trim().slice(0, 1500),
        trustpilotScore: clampScore(next.trustpilotScore, 4.9),
        trustpilotReviews: Math.max(0, Math.round(Number(next.trustpilotReviews) || 0)),
        nortonScore: clampScore(next.nortonScore, 4.9),
        isoScore: clampScore(next.isoScore, 5.0),
        certikScore: clampScore(next.certikScore, 4.9),
        minWithdrawalUsd: Math.max(1, Number(next.minWithdrawalUsd) || 10),
        eliteCapitalLockDays: Math.max(1, Math.round(Number(next.eliteCapitalLockDays) || 70)),
        totalProfitDays: Math.max(1, Math.round(Number(next.totalProfitDays) || 200)),
        globalPaused: Boolean(next.globalPaused),
        withdrawalsPaused: Boolean(next.withdrawalsPaused),
        signupsPaused: Boolean(next.signupsPaused),
        p2pPaused: Boolean(next.p2pPaused),
        moduleControls: safeModuleControls,
        supportLinks: safeSupportLinks,
        mlmRates: safeMlmRates,
        depositWallets: safeDepositWallets,
        pumpFunToken: safePumpFunToken,
        packages: safePackages,
        mentorConfig: safeMentorConfig,
        paymentMethods: safePaymentMethods,
        dashboardAnnouncement: safeAnnouncement,
        bannerAds: safeBannerAds,
        coinMiningSettings: safeCoinMiningSettings,
        coinMiningPlans: safeMiningPlans,
        forexConfig: {
          tradingEnabled: rawFx.tradingEnabled !== false,
          copyTradingEnabled: rawFx.copyTradingEnabled !== false,
          accountTiers: safeAccountTiers,
          copyTraders: safeCopyTraders,
        },
        supportAutoResponder: safeSupportAutoResponder,
        kycSettings: safeKycSettings,
        marketingCardsConfig: safeMarketingCardsConfig,
        updatedAt: serverTimestamp(),
      });
      await writeAdminLog({
        action: 'CONFIG_PUBLISHED',
        targetUid: '',
        targetLabel: 'config/platform',
        details: `Global Pause=${Boolean(next.globalPaused)} · Withdrawals Paused=${Boolean(next.withdrawalsPaused)} · Signups Paused=${Boolean(next.signupsPaused)} · P2P Paused=${Boolean(next.p2pPaused)}`,
        amountUsd: 0,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'config/platform');
    }
  };

  const recordAdminAudit = async (entry: Omit<AdminActionLog, 'id' | 'adminUid' | 'adminEmail' | 'createdAt'>) => {
    if (!authUser) return;
    try {
      const logId = makeId('alog');
      await setDoc(doc(db, 'adminLogs', logId), {
        adminUid: authUser.uid,
        adminEmail: (authUser.email || SUPER_ADMIN_EMAIL).trim().slice(0, 254),
        action: entry.action.trim().slice(0, 80),
        targetUid: entry.targetUid.trim().slice(0, 128),
        targetLabel: (entry.targetLabel.trim() || 'Platform').slice(0, 160),
        details: (entry.details.trim() || 'Admin action executed').slice(0, 500),
        amountUsd: Number.isFinite(entry.amountUsd) ? Number(entry.amountUsd.toFixed(2)) : 0,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Admin audit log write skipped:', err instanceof Error ? err.message : String(err));
    }
  };

  const approveCryptoDeposit = async (deposit: CryptoDeposit, adminNote = 'TxID verified on-chain') => {
    try {
      await runTransaction(db, async (tx) => {
        const depRef = doc(db, 'cryptoDeposits', deposit.id);
        const userRef = doc(db, 'users', deposit.uid);
        const depSnap = await tx.get(depRef);
        const userSnap = await tx.get(userRef);
        if (!depSnap.exists() || !userSnap.exists()) throw new Error('Deposit or user missing.');
        if ((depSnap.data() as CryptoDeposit).status !== 'pending') {
          throw new Error('Deposit already processed.');
        }
        const curUser = userSnap.data() as UserProfile;
        const nextUsdBalance = Number((curUser.usdBalance + deposit.amountUsd).toFixed(2));

        tx.update(depRef, {
          status: 'approved',
          adminNote,
          updatedAt: serverTimestamp(),
        });

        tx.update(userRef, {
          usdBalance: nextUsdBalance,
          updatedAt: serverTimestamp(),
        });
      });
      await recordAdminAudit({
        action: 'DEPOSIT_APPROVED',
        targetUid: deposit.uid,
        targetLabel: deposit.userName || deposit.userEmail,
        details: `Approved ${deposit.network} deposit (TxID: ${deposit.txId})`,
        amountUsd: deposit.amountUsd,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `cryptoDeposits/${deposit.id}`);
    }
  };

  const rejectCryptoDeposit = async (deposit: CryptoDeposit, adminNote: string) => {
    const note = adminNote || 'TxID verification failed';
    try {
      await updateDoc(doc(db, 'cryptoDeposits', deposit.id), {
        status: 'rejected',
        adminNote: note,
        updatedAt: serverTimestamp(),
      });
      await recordAdminAudit({
        action: 'DEPOSIT_REJECTED',
        targetUid: deposit.uid,
        targetLabel: deposit.userName || deposit.userEmail,
        details: `Rejected ${deposit.network} deposit: ${note}`,
        amountUsd: deposit.amountUsd,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `cryptoDeposits/${deposit.id}`);
    }
  };

  const approveKyc = async (targetUid: string, note = '') => {
    try {
      const userRef = doc(db, 'users', targetUid);
      const snap = await getDoc(userRef);
      const targetUser = snap.exists() ? (snap.data() as UserProfile) : null;
      const hasPhone = Boolean(targetUser?.phoneNumber);
      const reviewerLabel = (authUser?.email || SUPER_ADMIN_EMAIL).trim().slice(0, 120);
      await updateDoc(userRef, {
        kycStatus: 'approved',
        kycRejectionReason: '',
        kycResubmissionRequested: false,
        kycReviewedAtMs: Date.now(),
        kycReviewedBy: reviewerLabel,
        ...(hasPhone ? { phoneVerified: true } : {}),
        updatedAt: serverTimestamp(),
      });
      await recordAdminAudit({
        action: 'KYC_APPROVED',
        targetUid,
        targetLabel: targetUser ? `${targetUser.fullName} (${targetUser.handle})` : targetUid,
        details: `KYC approved (${targetUser?.kycCountryName || targetUser?.countryName || 'Global'} · ${targetUser?.idType || 'ID'})${hasPhone ? ' + phone verified' : ''}${note.trim() ? ` · Note: ${note.trim()}` : ''}`.slice(0, 500),
        amountUsd: 0,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUid}`);
    }
  };

  const rejectKyc = async (targetUid: string, reason = 'Document image unclear or details mismatch.') => {
    try {
      const userRef = doc(db, 'users', targetUid);
      const snap = await getDoc(userRef);
      const targetUser = snap.exists() ? (snap.data() as UserProfile) : null;
      const cleanReason =
        reason.trim().slice(0, 400) || 'Document image unclear or details mismatch.';
      const reviewerLabel = (authUser?.email || SUPER_ADMIN_EMAIL).trim().slice(0, 120);
      await updateDoc(userRef, {
        kycStatus: 'rejected',
        kycRejectionReason: cleanReason,
        kycResubmissionRequested: false,
        kycReviewedAtMs: Date.now(),
        kycReviewedBy: reviewerLabel,
        updatedAt: serverTimestamp(),
      });
      await recordAdminAudit({
        action: 'KYC_REJECTED',
        targetUid,
        targetLabel: targetUser ? `${targetUser.fullName} (${targetUser.handle})` : targetUid,
        details: `KYC rejected: ${cleanReason}`.slice(0, 500),
        amountUsd: 0,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUid}`);
    }
  };

  const requestKycResubmission = async (targetUid: string, reason: string) => {
    try {
      const userRef = doc(db, 'users', targetUid);
      const snap = await getDoc(userRef);
      const targetUser = snap.exists() ? (snap.data() as UserProfile) : null;
      const cleanReason =
        reason.trim().slice(0, 400) ||
        'Please re-upload clearer front/back document photos and a live selfie.';
      const reviewerLabel = (authUser?.email || SUPER_ADMIN_EMAIL).trim().slice(0, 120);
      await updateDoc(userRef, {
        kycStatus: 'rejected',
        kycRejectionReason: cleanReason,
        kycResubmissionRequested: true,
        kycReviewedAtMs: Date.now(),
        kycReviewedBy: reviewerLabel,
        updatedAt: serverTimestamp(),
      });
      await recordAdminAudit({
        action: 'KYC_RESUBMISSION_REQUESTED',
        targetUid,
        targetLabel: targetUser ? `${targetUser.fullName} (${targetUser.handle})` : targetUid,
        details: `Requested KYC re-submission: ${cleanReason}`.slice(0, 500),
        amountUsd: 0,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUid}`);
    }
  };

  const setUserKycStatus = async (
    targetUid: string,
    status: UserProfile['kycStatus'],
    reason = ''
  ) => {
    try {
      const userRef = doc(db, 'users', targetUid);
      const snap = await getDoc(userRef);
      const targetUser = snap.exists() ? (snap.data() as UserProfile) : null;
      const reviewerLabel = (authUser?.email || SUPER_ADMIN_EMAIL).trim().slice(0, 120);
      await updateDoc(userRef, {
        kycStatus: status,
        kycRejectionReason: status === 'rejected' ? reason.trim().slice(0, 400) : '',
        kycResubmissionRequested: false,
        kycReviewedAtMs: Date.now(),
        kycReviewedBy: reviewerLabel,
        updatedAt: serverTimestamp(),
      });
      await recordAdminAudit({
        action: 'KYC_STATUS_OVERRIDE',
        targetUid,
        targetLabel: targetUser ? `${targetUser.fullName} (${targetUser.handle})` : targetUid,
        details: `Admin override: KYC status set to ${status}${reason.trim() ? ` (${reason.trim()})` : ''}`.slice(0, 500),
        amountUsd: 0,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUid}`);
    }
  };

  const verifyUserPhone = async (targetUid: string, verified: boolean) => {
    try {
      const userRef = doc(db, 'users', targetUid);
      const snap = await getDoc(userRef);
      const targetUser = snap.exists() ? (snap.data() as UserProfile) : null;
      await updateDoc(userRef, {
        phoneVerified: verified,
        updatedAt: serverTimestamp(),
      });
      await recordAdminAudit({
        action: verified ? 'PHONE_VERIFIED' : 'PHONE_UNVERIFIED',
        targetUid,
        targetLabel: targetUser ? `${targetUser.fullName} (${targetUser.handle})` : targetUid,
        details: `Phone verification set to ${verified ? 'VERIFIED' : 'PENDING'}`,
        amountUsd: 0,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUid}`);
    }
  };

  const bulkApproveKyc = async (targetUids: string[]): Promise<number> => {
    const unique = Array.from(new Set(targetUids.filter(Boolean)));
    if (unique.length === 0) return 0;
    let count = 0;
    try {
      for (let i = 0; i < unique.length; i += 200) {
        const slice = unique.slice(i, i + 200);
        const batch = writeBatch(db);
        for (const uid of slice) {
          const userRef = doc(db, 'users', uid);
          const snap = await getDoc(userRef);
          if (!snap.exists()) continue;
          const u = snap.data() as UserProfile;
          batch.update(userRef, {
            kycStatus: 'approved',
            kycRejectionReason: '',
            kycResubmissionRequested: false,
            kycReviewedAtMs: Date.now(),
            kycReviewedBy: (authUser?.email || SUPER_ADMIN_EMAIL).trim().slice(0, 120),
            ...(u.phoneNumber ? { phoneVerified: true } : {}),
            updatedAt: serverTimestamp(),
          });
          count++;
        }
        await batch.commit();
      }
      await recordAdminAudit({
        action: 'BULK_KYC_APPROVED',
        targetUid: '',
        targetLabel: `${count} Clients`,
        details: `Bulk approved KYC for ${count} selected client accounts`,
        amountUsd: 0,
      });
      return count;
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'users/bulk-kyc');
    }
  };

  const bulkVerifyPhones = async (targetUids: string[]): Promise<number> => {
    const unique = Array.from(new Set(targetUids.filter(Boolean)));
    if (unique.length === 0) return 0;
    let count = 0;
    try {
      for (let i = 0; i < unique.length; i += 200) {
        const slice = unique.slice(i, i + 200);
        const batch = writeBatch(db);
        for (const uid of slice) {
          const userRef = doc(db, 'users', uid);
          const snap = await getDoc(userRef);
          if (!snap.exists()) continue;
          const u = snap.data() as UserProfile;
          if (!u.phoneNumber) continue;
          batch.update(userRef, {
            phoneVerified: true,
            updatedAt: serverTimestamp(),
          });
          count++;
        }
        await batch.commit();
      }
      await recordAdminAudit({
        action: 'BULK_PHONE_VERIFIED',
        targetUid: '',
        targetLabel: `${count} Clients`,
        details: `Bulk verified phone numbers for ${count} clients`,
        amountUsd: 0,
      });
      return count;
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'users/bulk-phone');
    }
  };

  const approveCapitalWithdrawal = async (withdrawal: Withdrawal, adminNote?: string) => {
    const defaultNote =
      withdrawal.type === 'manual_capital'
        ? 'Manual capital payout released'
        : withdrawal.source === 'mlm_commission'
        ? 'Referral commission payout processed'
        : 'Trading profit payout processed';
    const cleanNote = (adminNote || '').trim().slice(0, 300) || defaultNote;
    try {
      await runTransaction(db, async (tx) => {
        const wdRef = doc(db, 'withdrawals', withdrawal.id);
        const wdSnap = await tx.get(wdRef);
        if (!wdSnap.exists()) throw new Error('Withdrawal missing.');
        if ((wdSnap.data() as Withdrawal).status !== 'pending') {
          throw new Error('Withdrawal already processed.');
        }

        const userRef = doc(db, 'users', withdrawal.uid);
        const userSnap = await tx.get(userRef);

        if (withdrawal.investmentId) {
          const invRef = doc(db, 'investments', withdrawal.investmentId);
          const invSnap = await tx.get(invRef);
          if (invSnap.exists()) {
            tx.update(invRef, {
              status: 'capital_withdrawn',
              updatedAt: serverTimestamp(),
            });
          }
        }

        if (userSnap.exists()) {
          const curUser = userSnap.data() as UserProfile;
          const nextWithdrawn = Number((curUser.totalWithdrawn + withdrawal.amountUsd).toFixed(2));
          tx.update(userRef, {
            totalWithdrawn: nextWithdrawn,
            updatedAt: serverTimestamp(),
          });
        }

        tx.update(wdRef, {
          status: 'approved',
          adminNote: cleanNote,
          updatedAt: serverTimestamp(),
        });
      });
      await recordAdminAudit({
        action:
          withdrawal.type === 'manual_capital'
            ? 'CAPITAL_WITHDRAWAL_APPROVED'
            : 'PROFIT_WITHDRAWAL_APPROVED',
        targetUid: withdrawal.uid,
        targetLabel: withdrawal.userName || withdrawal.userEmail,
        details:
          withdrawal.type === 'manual_capital'
            ? `Released Package #${withdrawal.packageNumber} capital payout · ${cleanNote}`
            : `Processed ${withdrawal.source === 'mlm_commission' ? 'Referral Commission' : 'Trading Profit'} payout · ${cleanNote}`,
        amountUsd: withdrawal.amountUsd,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `withdrawals/${withdrawal.id}`);
    }
  };

  const rejectCapitalWithdrawal = async (withdrawal: Withdrawal, adminNote: string) => {
    const note = adminNote.trim().slice(0, 300) || 'Rejected by administration';
    try {
      await runTransaction(db, async (tx) => {
        const wdRef = doc(db, 'withdrawals', withdrawal.id);
        const wdSnap = await tx.get(wdRef);
        if (!wdSnap.exists()) throw new Error('Withdrawal missing.');
        if ((wdSnap.data() as Withdrawal).status !== 'pending') {
          throw new Error('Withdrawal already processed.');
        }

        if (withdrawal.investmentId) {
          const invRef = doc(db, 'investments', withdrawal.investmentId);
          const invSnap = await tx.get(invRef);
          if (invSnap.exists()) {
            tx.update(invRef, {
              status: 'active',
              updatedAt: serverTimestamp(),
            });
          }
        } else if (withdrawal.type === 'instant_profit') {
          const userRef = doc(db, 'users', withdrawal.uid);
          const userSnap = await tx.get(userRef);
          if (userSnap.exists()) {
            const curUser = userSnap.data() as UserProfile;
            const refundedBalance = Number(
              ((curUser.profitBalance || 0) + withdrawal.amountUsd).toFixed(2)
            );
            tx.update(userRef, {
              profitBalance: refundedBalance,
              updatedAt: serverTimestamp(),
            });
          }
        }

        tx.update(wdRef, {
          status: 'rejected',
          adminNote: note,
          updatedAt: serverTimestamp(),
        });
      });
      await recordAdminAudit({
        action:
          withdrawal.type === 'manual_capital'
            ? 'CAPITAL_WITHDRAWAL_REJECTED'
            : 'PROFIT_WITHDRAWAL_REJECTED',
        targetUid: withdrawal.uid,
        targetLabel: withdrawal.userName || withdrawal.userEmail,
        details:
          withdrawal.type === 'manual_capital'
            ? `Rejected Package #${withdrawal.packageNumber} capital withdrawal: ${note}`
            : `Rejected ${withdrawal.source === 'mlm_commission' ? 'Referral Commission' : 'Trading Profit'} payout (refunded to Income Wallet): ${note}`,
        amountUsd: withdrawal.amountUsd,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `withdrawals/${withdrawal.id}`);
    }
  };

  const updateWithdrawalNote = async (withdrawalId: string, adminNote: string) => {
    const cleanNote = adminNote.trim().slice(0, 300);
    try {
      await updateDoc(doc(db, 'withdrawals', withdrawalId), {
        adminNote: cleanNote,
        updatedAt: serverTimestamp(),
      });
      await recordAdminAudit({
        action: 'WITHDRAWAL_NOTE_UPDATED',
        targetUid: '',
        targetLabel: withdrawalId,
        details: `Updated payout TXID / reference: ${cleanNote || '(cleared)'}`,
        amountUsd: 0,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `withdrawals/${withdrawalId}`);
    }
  };

  const giftMentorAccount = async (params: {
    targetUid: string;
    giftedCapital: number;
    dailyPercent: number;
    aiMode: string;
  }) => {
    const giftAmount = Number(params.giftedCapital);
    if (giftAmount <= 0) throw new Error('Gifted capital must be greater than $0.');
    const invId = makeId('mentor_inv');
    let targetLabel = params.targetUid;

    try {
      await runTransaction(db, async (tx) => {
        const userRef = doc(db, 'users', params.targetUid);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists()) throw new Error('Target user not found.');
        const cur = userSnap.data() as UserProfile;
        targetLabel = `${cur.fullName} (${cur.handle})`;

        const multiplier = Math.max(1, Number(platformConfig.mentorConfig?.volumeMultiplier) || 4);
        const nextGifted = Number(((cur.mentorGiftedCapital || 0) + giftAmount).toFixed(2));
        const nextRequired = Number((nextGifted * multiplier).toFixed(2));

        tx.update(userRef, {
          isMentor: true,
          mentorGiftedCapital: nextGifted,
          mentorRequiredVolume: nextRequired,
          updatedAt: serverTimestamp(),
        });

        tx.set(doc(db, 'investments', invId), {
          uid: params.targetUid,
          packageNumber: 700 + Math.floor(Math.random() * 200),
          packageId: 'mentor_gifted',
          packageName: 'Mentor Gifted Vault',
          capital: giftAmount,
          dailyPercent: Number(params.dailyPercent) || 2.0,
          aiMode: params.aiMode || 'AI Mentor Institutional Desk',
          totalProfitDays: platformConfig.totalProfitDays,
          capitalLockDays: platformConfig.totalProfitDays,
          isMentorGifted: true,
          claimedProfit: 0,
          status: 'active',
          startedAtMs: Date.now(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      await recordAdminAudit({
        action: 'MENTOR_GIFTED',
        targetUid: params.targetUid,
        targetLabel,
        details: `Gifted $${giftAmount.toFixed(2)} mentor vault (${Number(params.dailyPercent) || 2}%/day)`,
        amountUsd: giftAmount,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${params.targetUid}`);
    }
  };

  const revokeMentorAccess = async (targetUid: string) => {
    let targetLabel = targetUid;
    try {
      await runTransaction(db, async (tx) => {
        const userRef = doc(db, 'users', targetUid);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists()) throw new Error('Target user not found.');
        const cur = userSnap.data() as UserProfile;
        targetLabel = `${cur.fullName} (${cur.handle})`;
        tx.update(userRef, {
          isMentor: false,
          updatedAt: serverTimestamp(),
        });
      });
      await recordAdminAudit({
        action: 'MENTOR_REVOKED',
        targetUid,
        targetLabel,
        details: 'Revoked Mentor account access (Mentor options hidden from client dashboard)',
        amountUsd: 0,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUid}`);
    }
  };

  const adjustUserBalance = async (params: {
    targetUid: string;
    wallet: 'usdBalance' | 'profitBalance';
    mode: 'credit' | 'debit';
    amountUsd: number;
    reason: string;
  }) => {
    const amount = Number(Number(params.amountUsd).toFixed(2));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Adjustment amount must be greater than $0.00.');
    }
    const cleanReason = params.reason.trim().slice(0, 300) || 'Admin manual balance adjustment';
    let targetLabel = params.targetUid;
    let nextBal = 0;

    try {
      await runTransaction(db, async (tx) => {
        const userRef = doc(db, 'users', params.targetUid);
        const snap = await tx.get(userRef);
        if (!snap.exists()) throw new Error('Client account not found.');
        const cur = snap.data() as UserProfile;
        targetLabel = `${cur.fullName} (${cur.handle})`;
        const prevBal = Number(cur[params.wallet] || 0);
        if (params.mode === 'debit' && prevBal < amount) {
          throw new Error(
            `Cannot debit $${amount.toFixed(2)}; current ${
              params.wallet === 'usdBalance' ? 'Deposit Wallet' : 'Income Wallet'
            } balance is $${prevBal.toFixed(2)}.`
          );
        }
        nextBal =
          params.mode === 'credit'
            ? Number((prevBal + amount).toFixed(2))
            : Number(Math.max(0, prevBal - amount).toFixed(2));
        tx.update(userRef, {
          [params.wallet]: nextBal,
          updatedAt: serverTimestamp(),
        });
      });

      await recordAdminAudit({
        action: params.mode === 'credit' ? 'BALANCE_CREDITED' : 'BALANCE_DEBITED',
        targetUid: params.targetUid,
        targetLabel,
        details: `${params.mode === 'credit' ? 'Credited +' : 'Debited -'}$${amount.toFixed(2)} on ${
          params.wallet === 'usdBalance' ? 'Deposit Wallet' : 'Income Wallet'
        } (New: $${nextBal.toFixed(2)}) · ${cleanReason}`,
        amountUsd: params.mode === 'credit' ? amount : -amount,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${params.targetUid}`);
    }
  };

  const setUserSuspension = async (targetUid: string, suspended: boolean, reason: string) => {
    const cleanReason = suspended
      ? reason.trim().slice(0, 300) || 'Account frozen by administration for compliance review.'
      : '';
    try {
      const userRef = doc(db, 'users', targetUid);
      const snap = await getDoc(userRef);
      const targetUser = snap.exists() ? (snap.data() as UserProfile) : null;
      await updateDoc(userRef, {
        suspended,
        suspensionReason: cleanReason,
        updatedAt: serverTimestamp(),
      });
      await recordAdminAudit({
        action: suspended ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_UNFROZEN',
        targetUid,
        targetLabel: targetUser ? `${targetUser.fullName} (${targetUser.handle})` : targetUid,
        details: suspended ? `Account suspended: ${cleanReason}` : 'Account suspension lifted',
        amountUsd: 0,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUid}`);
    }
  };

  // =========================================================================
  // Live Support Chat & Complaint Tickets
  // =========================================================================
  const sendClientSupportMessage = async (text: string, topicTag = '') => {
    if (!authUser || !userProfile) throw new Error('Sign in to send a live support message.');
    const cleanText = text.trim().slice(0, 2000);
    if (!cleanText) throw new Error('Please type a message or select a suggestion.');
    const cleanTag = topicTag.trim().slice(0, 80);
    const uid = authUser.uid;
    const threadRef = doc(db, 'supportChats', uid);
    const msgId = makeId('msg');
    const msgRef = doc(db, 'supportChats', uid, 'messages', msgId);

    try {
      const threadSnap = await getDoc(threadRef);
      if (!threadSnap.exists()) {
        await setDoc(threadRef, {
          uid,
          userName: (userProfile.fullName || 'Vault Client').slice(0, 120),
          userEmail: (userProfile.email || authUser.email || 'client@alphatradex.pro').slice(0, 254),
          userHandle: (userProfile.handle || 'CLIENT').slice(0, 32),
          status: 'open',
          lastMessage: cleanText.slice(0, 500),
          lastSender: 'client',
          unreadByAdmin: 1,
          unreadByClient: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const cur = threadSnap.data() as SupportChatThread;
        await updateDoc(threadRef, {
          lastMessage: cleanText.slice(0, 500),
          lastSender: 'client',
          status: 'open',
          unreadByAdmin: Math.min(9999, Number(cur.unreadByAdmin || 0) + 1),
          unreadByClient: 0,
          updatedAt: serverTimestamp(),
        });
      }

      await setDoc(msgRef, {
        uid,
        senderUid: uid,
        senderRole: 'client',
        senderName: (userProfile.fullName || 'Vault Client').slice(0, 120),
        text: cleanText,
        topicTag: cleanTag,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `supportChats/${uid}`);
    }
  };

  const markClientChatRead = async () => {
    if (!authUser || !supportChatThread || supportChatThread.unreadByClient <= 0) return;
    const uid = authUser.uid;
    try {
      await updateDoc(doc(db, 'supportChats', uid), {
        unreadByClient: 0,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `supportChats/${uid}`);
    }
  };

  const resolveTicketSla = (priority: SupportTicketPriority): string => {
    const cfg = platformConfig.supportAutoResponder || DEFAULT_SUPPORT_AUTO_RESPONDER;
    if (priority === 'urgent') return cfg.slaUrgent || DEFAULT_SUPPORT_AUTO_RESPONDER.slaUrgent;
    if (priority === 'high') return cfg.slaHigh || DEFAULT_SUPPORT_AUTO_RESPONDER.slaHigh;
    if (priority === 'low') return cfg.slaLow || DEFAULT_SUPPORT_AUTO_RESPONDER.slaLow;
    return cfg.slaMedium || DEFAULT_SUPPORT_AUTO_RESPONDER.slaMedium;
  };

  const renderAutoResponseTemplate = (
    template: string,
    vars: {
      ticketNumber: string;
      userName: string;
      subject: string;
      category: string;
      priority: string;
      referenceId: string;
      sla: string;
      companyName: string;
    }
  ): string => {
    const referenceLine = vars.referenceId ? ` · Ref: ${vars.referenceId}` : '';
    return template
      .replace(/\{\{ticketNumber\}\}/g, vars.ticketNumber)
      .replace(/\{\{userName\}\}/g, vars.userName)
      .replace(/\{\{subject\}\}/g, vars.subject)
      .replace(/\{\{category\}\}/g, vars.category)
      .replace(/\{\{priority\}\}/g, vars.priority)
      .replace(/\{\{referenceId\}\}/g, vars.referenceId || 'N/A')
      .replace(/\{\{referenceLine\}\}/g, referenceLine)
      .replace(/\{\{sla\}\}/g, vars.sla)
      .replace(/\{\{companyName\}\}/g, vars.companyName);
  };

  const createSupportTicket = async (params: {
    category: SupportTicketCategory;
    priority: SupportTicketPriority;
    subject: string;
    description: string;
    referenceId?: string;
  }): Promise<TicketConfirmationReceipt> => {
    if (!authUser || !userProfile) throw new Error('Sign in to submit a complaint ticket.');
    const cleanSubject = params.subject.trim().slice(0, 140);
    const cleanDesc = params.description.trim().slice(0, 2500);
    const cleanRef = (params.referenceId || '').trim().slice(0, 120);
    if (cleanSubject.length < 3) throw new Error('Ticket subject must be at least 3 characters.');
    if (cleanDesc.length < 5) throw new Error('Please describe your issue in at least 5 characters.');

    const ticketId = makeId('tkt');
    const notificationId = makeId('notif');
    const ticketNumber = `TKT-${Date.now().toString().slice(-6)}`;
    const recipientEmail = (
      userProfile.email ||
      authUser.email ||
      'client@alphatradex.pro'
    ).slice(0, 254);
    const cleanUserName = (userProfile.fullName || 'Vault Client').slice(0, 120);
    const cleanHandle = (userProfile.handle || 'CLIENT').slice(0, 32);

    const autoCfg = platformConfig.supportAutoResponder || DEFAULT_SUPPORT_AUTO_RESPONDER;
    const estimatedResponseTime = resolveTicketSla(params.priority).slice(0, 80);
    const senderName = (
      autoCfg.senderName ||
      `${platformConfig.companyName || 'Alphatradex'} Support Desk`
    ).slice(0, 120);

    const templateVars = {
      ticketNumber,
      userName: cleanUserName,
      subject: cleanSubject,
      category: params.category.toUpperCase(),
      priority: params.priority.toUpperCase(),
      referenceId: cleanRef,
      sla: estimatedResponseTime,
      companyName: platformConfig.companyName || 'Alphatradex',
    };

    const emailSubject = renderAutoResponseTemplate(
      autoCfg.subjectTemplate || DEFAULT_SUPPORT_AUTO_RESPONDER.subjectTemplate,
      templateVars
    ).slice(0, 200);
    const autoAckMessage = renderAutoResponseTemplate(
      autoCfg.bodyTemplate || DEFAULT_SUPPORT_AUTO_RESPONDER.bodyTemplate,
      templateVars
    ).slice(0, 2000);

    try {
      const batch = writeBatch(db);
      const ticketRef = doc(db, 'supportTickets', ticketId);
      batch.set(ticketRef, {
        uid: authUser.uid,
        userName: cleanUserName,
        userEmail: recipientEmail,
        userHandle: cleanHandle,
        ticketNumber,
        category: params.category,
        priority: params.priority,
        subject: cleanSubject,
        description: cleanDesc,
        referenceId: cleanRef,
        status: 'open',
        adminReply: '',
        resolvedBy: '',
        autoAckMessage,
        estimatedResponseTime,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (autoCfg.enabled !== false) {
        const notifRef = doc(db, 'users', authUser.uid, 'notifications', notificationId);
        batch.set(notifRef, {
          uid: authUser.uid,
          type: 'ticket_received',
          ticketId,
          ticketNumber,
          recipientEmail,
          senderName,
          title: `Ticket ${ticketNumber} Received — Confirmation Sent`.slice(0, 160),
          emailSubject,
          message: autoAckMessage,
          category: params.category,
          priority: params.priority,
          estimatedResponseTime,
          read: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();

      return {
        ticketId,
        ticketNumber,
        notificationId: autoCfg.enabled !== false ? notificationId : '',
        recipientEmail,
        senderName,
        emailSubject,
        message: autoAckMessage,
        category: params.category,
        priority: params.priority,
        subject: cleanSubject,
        referenceId: cleanRef,
        estimatedResponseTime,
        sentAtIso: new Date().toISOString(),
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `supportTickets/${ticketId}`);
    }
  };

  const markNotificationRead = async (notificationId: string) => {
    if (!authUser) return;
    try {
      await updateDoc(doc(db, 'users', authUser.uid, 'notifications', notificationId), {
        read: true,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.UPDATE,
        `users/${authUser.uid}/notifications/${notificationId}`
      );
    }
  };

  const markAllNotificationsRead = async () => {
    if (!authUser) return;
    const unread = userNotifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    try {
      const batch = writeBatch(db);
      for (const n of unread) {
        batch.update(doc(db, 'users', authUser.uid, 'notifications', n.id), {
          read: true,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${authUser.uid}/notifications`);
    }
  };

  const sendAdminSupportReply = async (
    targetUser: { uid: string; fullName: string; email: string; handle: string },
    text: string
  ) => {
    if (!authUser) throw new Error('Admin session required.');
    const cleanText = text.trim().slice(0, 2000);
    if (!cleanText) throw new Error('Reply message cannot be empty.');
    const targetUid = targetUser.uid;
    const threadRef = doc(db, 'supportChats', targetUid);
    const msgId = makeId('msg');
    const msgRef = doc(db, 'supportChats', targetUid, 'messages', msgId);

    try {
      const snap = await getDoc(threadRef);
      if (!snap.exists()) {
        await setDoc(threadRef, {
          uid: targetUid,
          userName: (targetUser.fullName || 'Vault Client').slice(0, 120),
          userEmail: (targetUser.email || 'client@alphatradex.pro').slice(0, 254),
          userHandle: (targetUser.handle || 'CLIENT').slice(0, 32),
          status: 'open',
          lastMessage: cleanText.slice(0, 500),
          lastSender: 'admin',
          unreadByAdmin: 0,
          unreadByClient: 1,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const cur = snap.data() as SupportChatThread;
        await updateDoc(threadRef, {
          lastMessage: cleanText.slice(0, 500),
          lastSender: 'admin',
          unreadByAdmin: 0,
          unreadByClient: Math.min(9999, Number(cur.unreadByClient || 0) + 1),
          updatedAt: serverTimestamp(),
        });
      }

      await setDoc(msgRef, {
        uid: targetUid,
        senderUid: authUser.uid,
        senderRole: 'admin',
        senderName: 'Support Desk',
        text: cleanText,
        topicTag: '',
        createdAt: serverTimestamp(),
      });

      await recordAdminAudit({
        action: 'LIVE_CHAT_REPLIED',
        targetUid,
        targetLabel: `${targetUser.fullName} (${targetUser.handle})`,
        details: cleanText.slice(0, 220),
        amountUsd: 0,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `supportChats/${targetUid}`);
    }
  };

  const markAdminChatRead = async (targetUid: string) => {
    try {
      await updateDoc(doc(db, 'supportChats', targetUid), {
        unreadByAdmin: 0,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `supportChats/${targetUid}`);
    }
  };

  const setSupportChatStatus = async (targetUid: string, status: 'open' | 'resolved') => {
    try {
      await updateDoc(doc(db, 'supportChats', targetUid), {
        status,
        unreadByAdmin: 0,
        updatedAt: serverTimestamp(),
      });
      await recordAdminAudit({
        action: status === 'resolved' ? 'CHAT_RESOLVED' : 'CHAT_REOPENED',
        targetUid,
        targetLabel: targetUid,
        details: `Support chat thread marked as ${status}`,
        amountUsd: 0,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `supportChats/${targetUid}`);
    }
  };

  const updateSupportTicket = async (
    ticketId: string,
    params: { status: SupportTicketStatus; adminReply: string }
  ) => {
    if (!authUser) throw new Error('Admin session required.');
    const cleanReply = params.adminReply.trim().slice(0, 2000);
    const ticketRef = doc(db, 'supportTickets', ticketId);
    try {
      const snap = await getDoc(ticketRef);
      if (!snap.exists()) throw new Error('Support ticket not found.');
      const tkt = snap.data() as SupportTicket;
      await updateDoc(ticketRef, {
        status: params.status,
        adminReply: cleanReply,
        resolvedBy:
          params.status === 'resolved' || params.status === 'closed'
            ? (authUser.email || SUPER_ADMIN_EMAIL).slice(0, 120)
            : tkt.resolvedBy || '',
        updatedAt: serverTimestamp(),
      });

      const autoCfg = platformConfig.supportAutoResponder || DEFAULT_SUPPORT_AUTO_RESPONDER;
      if (autoCfg.notifyOnStatusChange !== false && tkt.uid) {
        const statusLabel =
          params.status === 'in_progress'
            ? 'In Progress'
            : params.status === 'resolved' || params.status === 'closed'
            ? 'Resolved'
            : 'Pending';
        const notifId = makeId('notif');
        const senderName = (
          autoCfg.senderName ||
          `${platformConfig.companyName || 'Alphatradex'} Support Desk`
        ).slice(0, 120);
        const bodyLines = [
          `Hello ${tkt.userName || 'Vault Client'},`,
          '',
          `Your support ticket ${tkt.ticketNumber} ("${tkt.subject}") has been updated to: ${statusLabel}.`,
          cleanReply
            ? `\nOfficial Support Desk Response:\n${cleanReply}`
            : '\nA support specialist has updated your ticket stage. Open Track Ticket in your dashboard for live progress.',
          '',
          `Regards,\n${platformConfig.companyName || 'Alphatradex'} Client Support Desk`,
        ];
        try {
          await setDoc(doc(db, 'users', tkt.uid, 'notifications', notifId), {
            uid: tkt.uid,
            type: 'ticket_status_update',
            ticketId,
            ticketNumber: tkt.ticketNumber,
            recipientEmail: (tkt.userEmail || 'client@alphatradex.pro').slice(0, 254),
            senderName,
            title: `Ticket ${tkt.ticketNumber} Updated: ${statusLabel}`.slice(0, 160),
            emailSubject: `Ticket Update [${tkt.ticketNumber}]: Status is now ${statusLabel}`.slice(
              0,
              200
            ),
            message: bodyLines.join('\n').slice(0, 2500),
            category: tkt.category || 'other',
            priority: tkt.priority || 'medium',
            estimatedResponseTime: tkt.estimatedResponseTime || resolveTicketSla(tkt.priority),
            read: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (notifErr) {
          console.warn(
            'Status notification delivery skipped:',
            notifErr instanceof Error ? notifErr.message : String(notifErr)
          );
        }
      }

      await recordAdminAudit({
        action: 'TICKET_UPDATED',
        targetUid: tkt.uid,
        targetLabel: `${tkt.ticketNumber} · ${tkt.userName}`,
        details: `Status=${params.status} · Reply: ${cleanReply.slice(0, 200) || '(no reply text)'}`,
        amountUsd: 0,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `supportTickets/${ticketId}`);
    }
  };

  return (
    <PlatformContext.Provider
      value={{
        authUser,
        authReady,
        userProfile,
        profileLoading,
        provisioningError,
        retryProfileSync,
        isAdminUser,
        platformConfig,
        investments,
        deposits,
        withdrawals,
        p2pTransfers,
        walletTransfers,
        mlmCommissions,
        memeCoinInvestments,
        coinMiningStakes,
        coinTapAccount,
        downlineReferrals,
        referralLinkClicks,
        savedPaymentMethods,
        forexTrades,
        copyTradeSubscriptions,
        supportChatThread,
        supportChatMessages,
        supportTickets,
        userNotifications,
        signInWithGoogle,
        signInWithEmail,
        signUpWithKyc,
        submitKycUpdate,
        updateProfileAvatar,
        updateUserPhone,
        updateAccountEmail,
        resendVerificationEmail,
        refreshAuthVerification,
        signOutUser,
        submitCryptoDeposit,
        activatePackage,
        transferIncomeToDepositWallet,
        claimInvestmentProfit,
        withdrawInstantProfit,
        requestManualCapitalWithdrawal,
        sendP2PTransfer,
        investPumpFunMemeCoin,
        startCoinMiningStake,
        claimCoinMiningInterest,
        syncTapMiningProgress,
        claimTapMiningRewards,
        addUserPaymentMethod,
        setDefaultUserPaymentMethod,
        deleteUserPaymentMethod,
        openForexTrade,
        closeForexTrade,
        startCopyTrade,
        claimCopyTradeProfit,
        stopCopyTrade,
        updatePlatformConfig,
        approveCryptoDeposit,
        rejectCryptoDeposit,
        approveKyc,
        rejectKyc,
        requestKycResubmission,
        setUserKycStatus,
        verifyUserPhone,
        bulkApproveKyc,
        bulkVerifyPhones,
        approveCapitalWithdrawal,
        rejectCapitalWithdrawal,
        updateWithdrawalNote,
        giftMentorAccount,
        revokeMentorAccess,
        adjustUserBalance,
        setUserSuspension,
        sendClientSupportMessage,
        markClientChatRead,
        createSupportTicket,
        markNotificationRead,
        markAllNotificationsRead,
        sendAdminSupportReply,
        markAdminChatRead,
        setSupportChatStatus,
        updateSupportTicket,
        marketingCardStats,
        trackMarketingCardEvent,
      }}
    >
      {children}
    </PlatformContext.Provider>
  );
};

export function usePlatform() {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error('usePlatform must be used within PlatformProvider');
  return ctx;
}
