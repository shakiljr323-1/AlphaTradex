import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  User,
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
  DEFAULT_PLATFORM_CONFIG,
  SUPER_ADMIN_EMAIL,
} from '../constants/defaults';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  BannerAdConfig,
  CoinMiningPlan,
  CoinMiningStake,
  CoinTapAccount,
  CryptoDeposit,
  CryptoNetwork,
  IdType,
  Investment,
  InvestmentPackage,
  MemeCoinInvestment,
  MlmCommission,
  P2PTransfer,
  PaymentMethodConfig,
  PlatformConfig,
  ReferralLinkRecord,
  ReferralStats,
  UserPaymentMethod,
  UserProfile,
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
}

interface PlatformContextValue {
  authUser: User | null;
  authReady: boolean;
  userProfile: UserProfile | null;
  profileLoading: boolean;
  isAdminUser: boolean;
  platformConfig: PlatformConfig;
  investments: Investment[];
  deposits: CryptoDeposit[];
  withdrawals: Withdrawal[];
  p2pTransfers: P2PTransfer[];
  mlmCommissions: MlmCommission[];
  memeCoinInvestments: MemeCoinInvestment[];
  coinMiningStakes: CoinMiningStake[];
  coinTapAccount: CoinTapAccount | null;
  downlineReferrals: ReferralLinkRecord[];
  referralLinkClicks: number;
  savedPaymentMethods: UserPaymentMethod[];
  // Auth & KYC
  signInWithGoogle: (referralCode?: string) => Promise<void>;
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
  }) => Promise<{ needsEmailVerification: boolean }>;
  submitKycUpdate: (params: {
    fullName: string;
    idType: IdType;
    idNumber: string;
    idPhotoData: string;
    portraitPhotoData: string;
  }) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshAuthVerification: () => Promise<boolean>;
  signOutUser: () => Promise<void>;
  // User Financial Operations
  submitCryptoDeposit: (params: {
    network: CryptoNetwork;
    amountUsd: number;
    txId: string;
  }) => Promise<void>;
  activatePackage: (pkg: InvestmentPackage) => Promise<void>;
  claimInvestmentProfit: (investment: Investment) => Promise<number>;
  withdrawInstantProfit: (params: {
    amountUsd: number;
    network: CryptoNetwork;
    destinationAddress: string;
    source: 'package_profit' | 'mlm_commission' | 'mentor_profit';
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
  // Super Admin Actions
  updatePlatformConfig: (next: PlatformConfig) => Promise<void>;
  approveCryptoDeposit: (deposit: CryptoDeposit, adminNote?: string) => Promise<void>;
  rejectCryptoDeposit: (deposit: CryptoDeposit, adminNote: string) => Promise<void>;
  approveKyc: (targetUid: string) => Promise<void>;
  rejectKyc: (targetUid: string) => Promise<void>;
  approveCapitalWithdrawal: (withdrawal: Withdrawal, adminNote?: string) => Promise<void>;
  rejectCapitalWithdrawal: (withdrawal: Withdrawal, adminNote: string) => Promise<void>;
  giftMentorAccount: (params: {
    targetUid: string;
    giftedCapital: number;
    dailyPercent: number;
    aiMode: string;
  }) => Promise<void>;
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
  const [isAdminDoc, setIsAdminDoc] = useState(false);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>(DEFAULT_PLATFORM_CONFIG);

  const [investments, setInvestments] = useState<Investment[]>([]);
  const [deposits, setDeposits] = useState<CryptoDeposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [p2pTransfers, setP2pTransfers] = useState<P2PTransfer[]>([]);
  const [mlmCommissions, setMlmCommissions] = useState<MlmCommission[]>([]);
  const [memeCoinInvestments, setMemeCoinInvestments] = useState<MemeCoinInvestment[]>([]);
  const [coinMiningStakes, setCoinMiningStakes] = useState<CoinMiningStake[]>([]);
  const [coinTapAccount, setCoinTapAccount] = useState<CoinTapAccount | null>(null);
  const [downlineReferrals, setDownlineReferrals] = useState<ReferralLinkRecord[]>([]);
  const [referralLinkClicks, setReferralLinkClicks] = useState<number>(0);
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<UserPaymentMethod[]>([]);

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

    const userRef = doc(db, 'users', user.uid);
    let snap;
    try {
      snap = await getDoc(userRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
    }

    if (snap.exists()) return;

    const handle = generateHandleFromUid(user.uid);
    const fullName =
      draft?.fullName?.trim() ||
      user.displayName?.trim() ||
      (user.email ? user.email.split('@')[0] : 'Vault Client');
    const email = (user.email || '').trim().toLowerCase();

    let referredByUid = '';
    let referredByHandle = '';
    let uplineChain: string[] = [];

    const refCode = (draft?.referralCode || localStorage.getItem('vtv_pending_ref') || '').trim().toUpperCase();
    if (refCode && refCode !== handle) {
      try {
        const refHandleSnap = await getDoc(doc(db, 'handles', refCode));
        if (refHandleSnap.exists()) {
          const refData = refHandleSnap.data() as {
            uid: string;
            handle: string;
            uplineUids?: string[];
          };
          if (refData.uid !== user.uid) {
            referredByUid = refData.uid;
            referredByHandle = refData.handle;
            uplineChain = [refData.uid, ...(refData.uplineUids || []).slice(0, 2)];
          }
        }
      } catch {
        // Invalid or unreadable ref code ignored cleanly
      }
    }

    const hasKycFields = Boolean(draft?.idType && draft?.idNumber);
    const batch = writeBatch(db);

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
      idNumber: draft?.idNumber || '',
      idPhotoData: draft?.idPhotoData || '',
      portraitPhotoData: draft?.portraitPhotoData || '',
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

    batch.set(doc(db, 'handles', handle), {
      uid: user.uid,
      handle,
      displayName: fullName,
      uplineUids: uplineChain,
      createdAt: serverTimestamp(),
    });

    if (email) {
      const emailHash = await sha256Hex(email);
      batch.set(doc(db, 'emailHashes', emailHash), {
        uid: user.uid,
        handle,
        displayName: fullName,
        createdAt: serverTimestamp(),
      });
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
      localStorage.removeItem(`vtv_kyc_draft_${user.uid}`);
      localStorage.removeItem('vtv_pending_ref');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
    }
  }, []);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      setAuthReady(true);
      if (!user) {
        setUserProfile(null);
        setIsAdminDoc(false);
        setInvestments([]);
        setDeposits([]);
        setWithdrawals([]);
        setP2pTransfers([]);
        setMlmCommissions([]);
        setMemeCoinInvestments([]);
        setCoinMiningStakes([]);
        setCoinTapAccount(null);
        setDownlineReferrals([]);
        setReferralLinkClicks(0);
        setSavedPaymentMethods([]);
        return;
      }

      if (user.emailVerified) {
        const rawDraft = localStorage.getItem(`vtv_kyc_draft_${user.uid}`);
        let draft: KycDraft | null = null;
        if (rawDraft) {
          try {
            draft = JSON.parse(rawDraft) as KycDraft;
          } catch {
            draft = null;
          }
        }
        await ensureUserProvisioned(user, draft);

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

    return () => {
      unsubUser();
      unsubInv();
      unsubDep();
      unsubWith();
      unsubP2PSent();
      unsubP2PRecv();
      unsubMlm();
      unsubMeme();
      unsubCoinStakes();
      unsubCoinTap();
      unsubRefs();
      unsubPaymentMethods();
    };
  }, [authUser]);

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

  const signInWithGoogle = async (referralCode?: string) => {
    if (referralCode) {
      localStorage.setItem('vtv_pending_ref', referralCode.trim().toUpperCase());
    }
    const res = await signInWithPopup(auth, googleProvider);
    await ensureUserProvisioned(res.user, null);
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
  }) => {
    const cred = await createUserWithEmailAndPassword(auth, params.email.trim(), params.password);
    const draft: KycDraft = {
      fullName: params.fullName.trim(),
      referralCode: params.referralCode.trim().toUpperCase(),
      idType: params.idType,
      idNumber: params.idNumber.trim(),
      idPhotoData: params.idPhotoData,
      portraitPhotoData: params.portraitPhotoData,
    };
    localStorage.setItem(`vtv_kyc_draft_${cred.user.uid}`, JSON.stringify(draft));
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
    portraitPhotoData: string;
  }) => {
    if (!authUser) throw new Error('Authentication required.');
    try {
      await updateDoc(doc(db, 'users', authUser.uid), {
        fullName: params.fullName.trim(),
        idType: params.idType,
        idNumber: params.idNumber.trim(),
        idPhotoData: params.idPhotoData,
        portraitPhotoData: params.portraitPhotoData,
        kycStatus: 'pending',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${authUser.uid}`);
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
    setAuthUser(updated);
    if (updated.emailVerified) {
      const rawDraft = localStorage.getItem(`vtv_kyc_draft_${updated.uid}`);
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

  const signOutUser = async () => {
    await signOut(auth);
  };

  const submitCryptoDeposit = async (params: {
    network: CryptoNetwork;
    amountUsd: number;
    txId: string;
  }) => {
    if (!authUser || !userProfile) throw new Error('User vault profile required.');
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

  const activatePackage = async (pkg: InvestmentPackage) => {
    if (!authUser || !userProfile) throw new Error('Authentication required.');
    if (platformConfig.globalPaused) throw new Error('Trading allocations are temporarily paused by administration.');
    if (userProfile.usdBalance < pkg.capital) {
      throw new Error(`Insufficient USD Vault balance. Deposit $${(pkg.capital - userProfile.usdBalance).toFixed(2)} more.`);
    }

    const invId = makeId('inv');
    const pkgNumber = 400 + investments.length + Math.floor(Math.random() * 50) + 1;

    try {
      await runTransaction(db, async (tx) => {
        const userRef = doc(db, 'users', authUser.uid);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists()) throw new Error('Profile missing.');
        const current = userSnap.data() as UserProfile;
        if (current.usdBalance < pkg.capital) throw new Error('Insufficient USD balance.');

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

        const nextUsdBalance = Number((current.usdBalance - pkg.capital).toFixed(2));
        const nextTotalInvested = Number((current.totalInvested + pkg.capital).toFixed(2));
        const startedAtMs = Date.now();
        const totalProfitDays = pkg.profitDays || platformConfig.totalProfitDays;
        const capitalLockDays = pkg.id === 'elite' ? platformConfig.eliteCapitalLockDays : pkg.capitalLockDays;

        // Deduct capital & record investment
        tx.update(userRef, {
          usdBalance: nextUsdBalance,
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

  const claimInvestmentProfit = async (investment: Investment): Promise<number> => {
    if (!authUser || !userProfile) throw new Error('Authentication required.');
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
  }) => {
    if (!authUser || !userProfile) throw new Error('Authentication required.');
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
        )} / $${userProfile.mentorRequiredVolume.toFixed(2)}) to unlock instant profit withdrawals.`
      );
    }

    const withId = makeId('wdp');
    try {
      await runTransaction(db, async (tx) => {
        const userRef = doc(db, 'users', authUser.uid);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists()) throw new Error('Profile missing.');
        const cur = userSnap.data() as UserProfile;
        if (cur.profitBalance < amount) throw new Error('Insufficient profit balance.');

        const nextProfitBalance = Number((cur.profitBalance - amount).toFixed(2));
        const nextTotalWithdrawn = Number((cur.totalWithdrawn + amount).toFixed(2));

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
          status: 'completed',
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
    if (!platformConfig.coinMiningSettings.paidMiningEnabled) {
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
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'config/platform');
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
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `cryptoDeposits/${deposit.id}`);
    }
  };

  const approveKyc = async (targetUid: string) => {
    try {
      const userRef = doc(db, 'users', targetUid);
      await updateDoc(userRef, {
        kycStatus: 'approved',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUid}`);
    }
  };

  const rejectKyc = async (targetUid: string) => {
    try {
      const userRef = doc(db, 'users', targetUid);
      await updateDoc(userRef, {
        kycStatus: 'rejected',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUid}`);
    }
  };

  const approveCapitalWithdrawal = async (withdrawal: Withdrawal, adminNote = 'Manual capital payout released') => {
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
          adminNote,
          updatedAt: serverTimestamp(),
        });
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `withdrawals/${withdrawal.id}`);
    }
  };

  const rejectCapitalWithdrawal = async (withdrawal: Withdrawal, adminNote: string) => {
    const note = adminNote || 'Rejected by administration';
    try {
      await runTransaction(db, async (tx) => {
        const wdRef = doc(db, 'withdrawals', withdrawal.id);
        if (withdrawal.investmentId) {
          const invRef = doc(db, 'investments', withdrawal.investmentId);
          const invSnap = await tx.get(invRef);
          if (invSnap.exists()) {
            tx.update(invRef, {
              status: 'active',
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
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `withdrawals/${withdrawal.id}`);
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

    try {
      await runTransaction(db, async (tx) => {
        const userRef = doc(db, 'users', params.targetUid);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists()) throw new Error('Target user not found.');
        const cur = userSnap.data() as UserProfile;

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
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${params.targetUid}`);
    }
  };

  return (
    <PlatformContext.Provider
      value={{
        authUser,
        authReady,
        userProfile,
        profileLoading,
        isAdminUser,
        platformConfig,
        investments,
        deposits,
        withdrawals,
        p2pTransfers,
        mlmCommissions,
        memeCoinInvestments,
        coinMiningStakes,
        coinTapAccount,
        downlineReferrals,
        referralLinkClicks,
        savedPaymentMethods,
        signInWithGoogle,
        signInWithEmail,
        signUpWithKyc,
        submitKycUpdate,
        resendVerificationEmail,
        refreshAuthVerification,
        signOutUser,
        submitCryptoDeposit,
        activatePackage,
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
        updatePlatformConfig,
        approveCryptoDeposit,
        rejectCryptoDeposit,
        approveKyc,
        rejectKyc,
        approveCapitalWithdrawal,
        rejectCapitalWithdrawal,
        giftMentorAccount,
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
