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
  CryptoDeposit,
  CryptoNetwork,
  IdType,
  Investment,
  InvestmentPackage,
  MemeCoinInvestment,
  MlmCommission,
  P2PTransfer,
  PlatformConfig,
  ReferralLinkRecord,
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
  downlineReferrals: ReferralLinkRecord[];
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
  const [downlineReferrals, setDownlineReferrals] = useState<ReferralLinkRecord[]>([]);
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
              ? data.paymentMethods
              : buildDefaultPaymentMethods(mergedWallets);

          setPlatformConfig({
            ...DEFAULT_PLATFORM_CONFIG,
            ...data,
            mlmRates: { ...DEFAULT_PLATFORM_CONFIG.mlmRates, ...(data.mlmRates || {}) },
            depositWallets: mergedWallets,
            paymentMethods: resolvedMethods,
            pumpFunToken: { ...DEFAULT_PLATFORM_CONFIG.pumpFunToken, ...(data.pumpFunToken || {}) },
            dashboardAnnouncement: {
              ...DEFAULT_PLATFORM_CONFIG.dashboardAnnouncement,
              ...(data.dashboardAnnouncement || {}),
            },
            packages: Array.isArray(data.packages) && data.packages.length > 0
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
        setDownlineReferrals([]);
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
      query(collection(db, 'investments'), where('uid', '==', uid), orderBy('startedAtMs', 'desc')),
      (snap) => setInvestments(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Investment, 'id'>) }))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'investments')
    );

    const unsubDep = onSnapshot(
      query(collection(db, 'cryptoDeposits'), where('uid', '==', uid), orderBy('createdAt', 'desc')),
      (snap) => setDeposits(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CryptoDeposit, 'id'>) }))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'cryptoDeposits')
    );

    const unsubWith = onSnapshot(
      query(collection(db, 'withdrawals'), where('uid', '==', uid), orderBy('createdAt', 'desc')),
      (snap) => setWithdrawals(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Withdrawal, 'id'>) }))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'withdrawals')
    );

    let sentList: P2PTransfer[] = [];
    let recvList: P2PTransfer[] = [];
    const mergeP2P = () => {
      const merged = [...sentList, ...recvList];
      merged.sort((a, b) => {
        const ta = (a.createdAt as { seconds?: number })?.seconds || 0;
        const tb = (b.createdAt as { seconds?: number })?.seconds || 0;
        return tb - ta;
      });
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
      query(collection(db, 'mlmCommissions'), where('beneficiaryUid', '==', uid), orderBy('createdAt', 'desc')),
      (snap) => setMlmCommissions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MlmCommission, 'id'>) }))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'mlmCommissions')
    );

    const unsubMeme = onSnapshot(
      query(collection(db, 'memeCoinInvestments'), where('uid', '==', uid), orderBy('createdAt', 'desc')),
      (snap) =>
        setMemeCoinInvestments(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MemeCoinInvestment, 'id'>) }))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'memeCoinInvestments')
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
          const ta = (a.createdAt as { seconds?: number })?.seconds || 0;
          const tb = (b.createdAt as { seconds?: number })?.seconds || 0;
          return tb - ta;
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
      unsubRefs();
      unsubPaymentMethods();
    };
  }, [authUser]);

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
    const methodId = params.network.trim().slice(0, 64);
    const configuredMethod = platformConfig.paymentMethods.find((m) => m.id === methodId);
    if (configuredMethod && (!configuredMethod.enabled || !configuredMethod.allowDeposit)) {
      throw new Error(`${configuredMethod.name} deposits are currently disabled.`);
    }
    const minDeposit = configuredMethod?.minDepositUsd || 1;
    if (Number(params.amountUsd) < minDeposit) {
      throw new Error(`Minimum deposit for ${configuredMethod?.name || methodId} is $${minDeposit.toFixed(2)}.`);
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
        amountUsd: Number(params.amountUsd),
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

        // Pay MLM commissions & track Mentor 4x brought volume on Level 1
        for (const u of uplines) {
          const commissionUsd = Number(((pkg.capital * u.rate) / 100).toFixed(2));
          if (commissionUsd <= 0) continue;
          const addedVolume = u.level === 1 ? pkg.capital : 0;
          const nextProfit = Number((u.snapData.profitBalance + commissionUsd).toFixed(2));
          const nextBrought = Number(((u.snapData.mentorBroughtVolume || 0) + addedVolume).toFixed(2));

          tx.update(doc(db, 'users', u.uid), {
            profitBalance: nextProfit,
            mentorBroughtVolume: nextBrought,
            updatedAt: serverTimestamp(),
          });

          const commId = makeId(`mlmL${u.level}`);
          tx.set(doc(db, 'mlmCommissions', commId), {
            beneficiaryUid: u.uid,
            fromUid: authUser.uid,
            fromName: current.fullName,
            level: u.level,
            investmentAmount: pkg.capital,
            ratePercent: u.rate,
            commissionUsd,
            createdAt: serverTimestamp(),
          });
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
    const activeMethod = (platformConfig.paymentMethods || []).find((m) => m.id === params.network);
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
        `Mentor 4x Volume Rule Active: Bring $${remaining} more in referred investment volume ($${userProfile.mentorBroughtVolume.toFixed(
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
          amountUsd: amount,
          network: params.network,
          destinationAddress: params.destinationAddress.trim(),
          status: 'completed',
          adminNote: 'Instant automated profit settlement',
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

    const withId = makeId('wdc');
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
      network: params.network,
      destinationAddress: params.destinationAddress.trim(),
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
    if (amount <= 0) throw new Error('Transfer amount must be greater than $0.');
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
    if (amount <= 0) throw new Error('Allocation amount must be greater than $0.');

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
    try {
      await setDoc(doc(db, 'config', 'platform'), {
        ...next,
        dashboardAnnouncement: safeAnnouncement,
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

        const nextGifted = Number(((cur.mentorGiftedCapital || 0) + giftAmount).toFixed(2));
        const nextRequired = Number((nextGifted * 4).toFixed(2));

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
        downlineReferrals,
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
