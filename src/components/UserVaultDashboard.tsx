import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Award,
  Bell,
  Bot,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  CreditCard,
  ExternalLink,
  FileCheck,
  Globe,
  History,
  Home,
  LayoutDashboard,
  Lock,
  LogOut,
  Megaphone,
  Menu,
  Network,
  PlusCircle,
  QrCode,
  Receipt,
  RefreshCw,
  Rocket,
  Send,
  ShieldCheck,
  Star,
  Trash2,
  TrendingUp,
  Upload,
  UserCheck,
  Users,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import {
  CryptoNetwork,
  IdType,
  Investment,
  NavSection,
  PackageFundingSource,
  Withdrawal,
} from '../types/platform';
import {
  compressImageToDataUrl,
  computeInvestmentMetrics,
  formatTimestamp,
  isWeekendDate,
} from '../utils/investmentMath';
import { CapitalRequestModal } from './CapitalRequestModal';
import { DepositFundsModal } from './DepositFundsModal';
import { AlphatradexCoinHub, BannerAdSlot } from './AlphatradexCoinHub';
import { ForexMarketView } from './ForexMarketView';
import { AlphatradexLogo3D } from './AlphatradexLogo3D';
import { ReferralDashboard } from './ReferralDashboard';
import { ReferralMentorDeskView } from './ReferralMentorDeskView';
import { ProfileManagementView } from './ProfileManagementView';
import { TermsAgreementCheckbox } from './TermsAndConditionsView';
import { TransactionHistoryView } from './TransactionHistoryView';

function formatVaultError(raw: string): string {
  if (raw.startsWith('{') && raw.includes('"error"')) {
    try {
      const parsed = JSON.parse(raw) as { error?: string };
      if (parsed?.error) return parsed.error;
    } catch {
      // Ignore JSON error
    }
  }
  return raw;
}

type SidebarSection =
  | 'dashboard'
  | 'deposit'
  | 'deposit-report'
  | 'income-wallet'
  | 'p2p-transfers'
  | 'withdraw'
  | 'payment-methods'
  | 'transaction-history'
  | 'activate-trading'
  | 'my-packages'
  | 'capital-withdraw'
  | 'pump-fun'
  | 'forex-market'
  | 'income-details'
  | 'mlm-commissions'
  | 'referral-mentor-desk'
  | 'referral-network'
  | 'downline-team'
  | 'profile-kyc';

interface UserVaultDashboardProps {
  initialSection?: 'dashboard' | 'forex-market' | 'pump-fun';
  onOpenHomePage?: (section?: NavSection) => void;
}

export const UserVaultDashboard: React.FC<UserVaultDashboardProps> = ({
  initialSection = 'dashboard',
  onOpenHomePage,
}) => {
  const {
    authUser,
    userProfile,
    profileLoading,
    provisioningError,
    retryProfileSync,
    platformConfig,
    investments,
    deposits,
    withdrawals,
    p2pTransfers,
    walletTransfers,
    mlmCommissions,
    memeCoinInvestments,
    downlineReferrals,
    referralLinkClicks,
    savedPaymentMethods,
    submitKycUpdate,
    updateProfileAvatar,
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
    addUserPaymentMethod,
    setDefaultUserPaymentMethod,
    deleteUserPaymentMethod,
  } = usePlatform();

  const [activeNav, setActiveNav] = useState<SidebarSection>(initialSection);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [dismissedAnnSig, setDismissedAnnSig] = useState<string>(() => {
    try {
      return localStorage.getItem('vtv_dismissed_announcement') || '';
    } catch {
      return '';
    }
  });
  const [busyAction, setBusyAction] = useState(false);
  const [acceptedPackageTerms, setAcceptedPackageTerms] = useState(false);
  const [acceptedMemeTerms, setAcceptedMemeTerms] = useState(false);
  const [packageFundingSource, setPackageFundingSource] =
    useState<PackageFundingSource>('deposit_wallet');
  const [walletTransferAmount, setWalletTransferAmount] = useState('10');
  const [showWalletTransferBar, setShowWalletTransferBar] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [copiedText, setCopiedText] = useState('');
  const [selectedBreakdown, setSelectedBreakdown] = useState<Withdrawal | null>(null);
  const [retryingSync, setRetryingSync] = useState(false);
  const [showSyncFallback, setShowSyncFallback] = useState(false);
  const autoRetryTriggeredRef = useRef<string | null>(null);

  useEffect(() => {
    setActiveNav(initialSection);
  }, [initialSection]);

  useEffect(() => {
    if (!authUser || !authUser.emailVerified || userProfile) {
      setShowSyncFallback(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowSyncFallback(true);
    }, 3500);

    if (!profileLoading && !provisioningError && autoRetryTriggeredRef.current !== authUser.uid) {
      autoRetryTriggeredRef.current = authUser.uid;
      void retryProfileSync();
    }

    return () => window.clearTimeout(timer);
  }, [authUser, userProfile, profileLoading, provisioningError, retryProfileSync]);

  // Capital withdrawal target modal
  const [capitalTargetInv, setCapitalTargetInv] = useState<Investment | null>(null);
  const [capitalNet, setCapitalNet] = useState<CryptoNetwork>('USDT_TRC20');
  const [capitalAddress, setCapitalAddress] = useState('');

  // Inline KYC form
  const [kycName, setKycName] = useState(userProfile?.fullName || authUser?.displayName || '');
  useEffect(() => {
    if (!kycName && userProfile?.fullName) {
      setKycName(userProfile.fullName);
    }
  }, [kycName, userProfile?.fullName]);
  const [kycIdType, setKycIdType] = useState<IdType>('NID');
  const [kycIdNumber, setKycIdNumber] = useState('');
  const [kycIdPhoto, setKycIdPhoto] = useState('');
  const [kycPortrait, setKycPortrait] = useState('');
  const idInputRef = useRef<HTMLInputElement | null>(null);
  const portraitInputRef = useRef<HTMLInputElement | null>(null);

  // Deposit form
  const [depNetwork, setDepNetwork] = useState<CryptoNetwork>('USDT_TRC20');
  const [depAmount, setDepAmount] = useState('100');
  const [depTxId, setDepTxId] = useState('');

  // Instant profit withdrawal form
  const [wdAmount, setWdAmount] = useState('10');
  const [wdNetwork, setWdNetwork] = useState<CryptoNetwork>('USDT_TRC20');
  const [wdAddress, setWdAddress] = useState('');
  const [wdSource, setWdSource] = useState<'package_profit' | 'mlm_commission'>('package_profit');
  const [saveAfterWithdraw, setSaveAfterWithdraw] = useState(false);

  // User Saved Payment Method form
  const [pmLabel, setPmLabel] = useState('');
  const [pmChannelId, setPmChannelId] = useState('USDT_TRC20');
  const [pmAddress, setPmAddress] = useState('');
  const [pmHolder, setPmHolder] = useState('');
  const [pmDefault, setPmDefault] = useState(true);

  // P2P transfer form
  const [p2pRecipient, setP2pRecipient] = useState('');
  const [p2pAmount, setP2pAmount] = useState('25');
  const [p2pNote, setP2pNote] = useState('');

  // Pump.fun invest form
  const [memeAmountUsd, setMemeAmountUsd] = useState('50');
  const [memePayMethod, setMemePayMethod] = useState<'USD_VAULT' | 'SOL_WALLET'>('USD_VAULT');
  const [memeSolTx, setMemeSolTx] = useState('');
  const buyTokenInputRef = useRef<HTMLInputElement | null>(null);

  const activeInvestments = useMemo(
    () => investments.filter((inv) => inv.status === 'active' || inv.status === 'capital_requested'),
    [investments]
  );

  const actualUserInvestments = useMemo(
    () => activeInvestments.filter((inv) => !inv.isMentorGifted),
    [activeInvestments]
  );

  const activeCapital = useMemo(
    () => activeInvestments.reduce((acc, inv) => acc + inv.capital, 0),
    [activeInvestments]
  );

  const actualUserCapital = useMemo(
    () => actualUserInvestments.reduce((acc, inv) => acc + inv.capital, 0),
    [actualUserInvestments]
  );

  const totalProjectedReturn = useMemo(
    () =>
      activeInvestments.reduce(
        (acc, inv) => acc + ((inv.capital * inv.dailyPercent) / 100) * (inv.totalProfitDays || 200),
        0
      ),
    [activeInvestments]
  );

  const totalDailyTargetUsd = useMemo(
    () => activeInvestments.reduce((acc, inv) => acc + (inv.capital * inv.dailyPercent) / 100, 0),
    [activeInvestments]
  );

  const totalProfitGeneratedAll = useMemo(
    () =>
      investments.reduce(
        (acc, inv) => acc + computeInvestmentMetrics(inv, platformConfig.globalPaused).totalProfitGenerated,
        0
      ),
    [investments, platformConfig.globalPaused]
  );

  const totalMlmEarned = useMemo(
    () => mlmCommissions.reduce((acc, c) => acc + c.commissionUsd, 0),
    [mlmCommissions]
  );

  const totalReferralVolume = useMemo(
    () => downlineReferrals.reduce((acc, r) => acc + (r.totalInvestedUsd || 0), 0),
    [downlineReferrals]
  );

  const totalMemeTokens = useMemo(
    () => memeCoinInvestments.reduce((acc, item) => acc + item.tokenQuantity, 0),
    [memeCoinInvestments]
  );

  const isWeekend = isWeekendDate(new Date());

  const copyValue = (label: string, val: string) => {
    navigator.clipboard?.writeText(val)?.catch(() => {});
    setCopiedText(label);
    setTimeout(() => setCopiedText(''), 1800);
  };

  const notify = (type: 'ok' | 'err', text: string) => {
    setFeedback({ type, text: type === 'err' ? formatVaultError(text) : text });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selectNav = (sec: SidebarSection) => {
    setActiveNav(sec);
    setMobileMenuOpen(false);
  };

  // Unverified Email Gate
  if (authUser && !authUser.emailVerified) {
    return (
      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#0B111E]/90 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-6 space-y-4 shadow-2xl text-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-white text-lg">Verify Your Email Address</h2>
              <p className="text-xs text-slate-400">{authUser.email}</p>
            </div>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            A verification link was sent to your email. Please verify your address to activate your KYC
            profile and open your {platformConfig.companyName} ledger.
          </p>
          {feedback && (
            <div
              className={`p-3 rounded-lg text-xs border ${
                feedback.type === 'ok'
                  ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-200'
                  : 'bg-red-950/70 border-red-700/60 text-red-200'
              }`}
            >
              {feedback.text}
            </div>
          )}
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={async () => {
                setBusyAction(true);
                try {
                  const ok = await refreshAuthVerification();
                  if (!ok) notify('err', 'Email is not verified yet. Please click the link in your inbox.');
                } finally {
                  setBusyAction(false);
                }
              }}
              disabled={busyAction}
              className="w-full py-2.5 px-4 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold"
            >
              I Have Verified My Email
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await resendVerificationEmail();
                  notify('ok', 'Verification email resent.');
                } catch (err) {
                  notify('err', (err as Error).message);
                }
              }}
              className="w-full py-2 px-4 rounded-lg border border-slate-700 text-slate-200 text-sm font-medium hover:bg-slate-800"
            >
              Resend Verification Email
            </button>
            <button
              type="button"
              onClick={signOutUser}
              className="w-full py-2 px-4 rounded-lg text-slate-400 text-xs font-medium hover:text-white"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (profileLoading || !userProfile) {
    const showRecoveryActions = Boolean(provisioningError) || showSyncFallback || !profileLoading;
    return (
      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#0B111E]/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-6 space-y-4 shadow-2xl text-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
              {provisioningError ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <RefreshCw className={`w-5 h-5 ${retryingSync || profileLoading ? 'animate-spin' : ''}`} />
              )}
            </div>
            <div>
              <h2 className="font-display font-bold text-white text-base">
                Synchronizing {platformConfig.companyName} Vault Ledger...
              </h2>
              <p className="text-xs text-slate-400">
                {authUser?.email || 'Initializing authenticated session'}
              </p>
            </div>
          </div>

          {provisioningError ? (
            <div className="p-3 rounded-lg bg-red-950/70 border border-red-700/60 text-xs text-red-200 leading-relaxed">
              {formatVaultError(provisioningError)}
            </div>
          ) : (
            <p className="text-xs text-slate-300 leading-relaxed">
              Connecting your verified account to the ledger. If this takes more than a few seconds,
              use Retry Ledger Sync below to refresh your token and provision your vault record.
            </p>
          )}

          {showRecoveryActions && (
            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                disabled={retryingSync}
                onClick={async () => {
                  setRetryingSync(true);
                  try {
                    await retryProfileSync();
                  } finally {
                    setRetryingSync(false);
                  }
                }}
                className="flex-1 py-2.5 px-4 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${retryingSync ? 'animate-spin' : ''}`} />
                {retryingSync ? 'Retrying Sync...' : 'Retry Ledger Sync'}
              </button>
              <button
                type="button"
                onClick={signOutUser}
                className="py-2.5 px-4 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const enabledDepositMethods = platformConfig.paymentMethods.filter(
    (m) => m.enabled && m.allowDeposit
  );
  const enabledWithdrawMethods = platformConfig.paymentMethods.filter(
    (m) => m.enabled && m.allowWithdrawal
  );

  const selectedDepositMethod =
    enabledDepositMethods.find((m) => m.id === depNetwork) ||
    enabledDepositMethods[0] ||
    platformConfig.paymentMethods[0];

  const activeDepositNetworkId = selectedDepositMethod?.id || depNetwork;
  const currentDepositWallet =
    selectedDepositMethod?.receivingAccount ||
    (depNetwork === 'USDT_TRC20'
      ? platformConfig.depositWallets.usdtTrc20
      : depNetwork === 'USDT_ERC20'
      ? platformConfig.depositWallets.usdtErc20
      : platformConfig.depositWallets.sol);

  const selectedWithdrawMethod =
    enabledWithdrawMethods.find((m) => m.id === wdNetwork) || enabledWithdrawMethods[0];
  const activeWithdrawNetworkId = selectedWithdrawMethod?.id || wdNetwork;

  const selectedCapitalMethod =
    enabledWithdrawMethods.find((m) => m.id === capitalNet) || enabledWithdrawMethods[0];
  const activeCapitalNetworkId = selectedCapitalMethod?.id || capitalNet;

  const referralLink = `${window.location.origin}${import.meta.env.BASE_URL}?ref=${userProfile.handle}`;

  const sidebarGroups: {
    heading: string;
    items: { id: SidebarSection; label: string; Icon: React.ComponentType<{ className?: string }> }[];
  }[] = [
    {
      heading: 'OVERVIEW',
      items: [{ id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard }],
    },
    {
      heading: 'WALLETS',
      items: [
        { id: 'deposit', label: 'Deposit Funds', Icon: PlusCircle },
        { id: 'deposit-report', label: 'Deposit Wallet Report', Icon: Receipt },
        { id: 'income-wallet', label: 'Income Wallet', Icon: Wallet },
        { id: 'p2p-transfers', label: 'P2P Transfers', Icon: Send },
        { id: 'withdraw', label: 'Withdraw', Icon: ArrowUpRight },
        { id: 'payment-methods', label: 'Payment Methods', Icon: CreditCard },
        { id: 'transaction-history', label: 'Transaction History', Icon: History },
      ],
    },
    {
      heading: 'AI TRADING & LAUNCHPAD',
      items: [
        { id: 'activate-trading', label: 'Activate Trading', Icon: Zap },
        { id: 'my-packages', label: 'My Packages', Icon: Bot },
        { id: 'capital-withdraw', label: 'Capital Withdraw', Icon: Lock },
        { id: 'pump-fun', label: `${platformConfig.pumpFunToken.name} Coin`, Icon: Rocket },
        { id: 'forex-market', label: 'Forex Market', Icon: Globe },
      ],
    },
    {
      heading: 'INCOME & REFERRALS',
      items: [
        { id: 'referral-mentor-desk', label: 'Referral & Mentor Desk', Icon: ShieldCheck },
        { id: 'income-details', label: 'Income Details', Icon: TrendingUp },
        { id: 'mlm-commissions', label: 'All-Plan Commissions', Icon: Award },
      ],
    },
    {
      heading: 'MY TEAM',
      items: [
        { id: 'referral-network', label: 'Referral Dashboard', Icon: Network },
        { id: 'downline-team', label: 'Downline Team', Icon: Users },
      ],
    },
    {
      heading: 'ACCOUNT',
      items: [{ id: 'profile-kyc', label: 'Profile Management', Icon: UserCheck }],
    },
  ];

  const activeNavTitle =
    sidebarGroups.flatMap((g) => g.items).find((i) => i.id === activeNav)?.label || 'Dashboard';

  // Reusable KYC Verification Card (shown on non-profile views when unsubmitted/rejected)
  const renderKycBannerOrForm = () => {
    if (
      activeNav === 'profile-kyc' ||
      (userProfile.kycStatus !== 'unsubmitted' && userProfile.kycStatus !== 'rejected')
    ) {
      return null;
    }

    const isRejected = userProfile.kycStatus === 'rejected';

    return (
      <div className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4 text-slate-100">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-white text-base">
              Complete Identity Verification (KYC)
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              {isRejected
                ? 'Your previous KYC submission was declined. Please re-submit valid documents.'
                : 'Submit your NID, Passport, or Driving License along with a portrait photo for Admin approval.'}
            </p>
          </div>
          <span className="px-2.5 py-1 rounded text-xs font-semibold shrink-0 bg-red-500/20 text-red-300 border border-red-500/30">
            KYC: {userProfile.kycStatus.toUpperCase()}
          </span>
        </div>

        {(userProfile.kycStatus === 'unsubmitted' || isRejected) && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!kycName.trim() || !kycIdNumber.trim() || !kycIdPhoto || !kycPortrait) {
                notify('err', 'Please fill full name, ID number, and upload both KYC photos.');
                return;
              }
              setBusyAction(true);
              try {
                await submitKycUpdate({
                  fullName: kycName,
                  idType: kycIdType,
                  idNumber: kycIdNumber,
                  idPhotoData: kycIdPhoto,
                  portraitPhotoData: kycPortrait,
                });
                notify('ok', 'KYC documents submitted and queued for Super Admin verification.');
              } catch (err) {
                notify('err', (err as Error).message);
              } finally {
                setBusyAction(false);
              }
            }}
            className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end"
          >
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-300 mb-1">Full Legal Name</label>
              <input
                type="text"
                required
                value={kycName}
                onChange={(e) => setKycName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/90 text-white text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">ID Type</label>
              <select
                value={kycIdType}
                onChange={(e) => setKycIdType(e.target.value as IdType)}
                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/90 text-white text-sm"
              >
                <option value="NID">NID</option>
                <option value="Passport">Passport</option>
                <option value="Driving License">Driving License</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-300 mb-1">ID Number</label>
              <input
                type="text"
                required
                value={kycIdNumber}
                onChange={(e) => setKycIdNumber(e.target.value)}
                placeholder="Document number"
                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/90 text-white text-sm font-mono placeholder:text-slate-500"
              />
            </div>
            <div className="md:col-span-2">
              <input
                ref={idInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) setKycIdPhoto(await compressImageToDataUrl(f));
                }}
              />
              <button
                type="button"
                onClick={() => idInputRef.current?.click()}
                className="w-full px-3 py-2 rounded-lg border border-dashed border-slate-600 bg-slate-900/60 text-xs font-medium text-slate-200 hover:border-orange-500 flex items-center justify-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                {kycIdPhoto ? 'ID Uploaded' : 'Upload ID'}
              </button>
            </div>
            <div className="md:col-span-2">
              <input
                ref={portraitInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) setKycPortrait(await compressImageToDataUrl(f));
                }}
              />
              <button
                type="button"
                onClick={() => portraitInputRef.current?.click()}
                className="w-full px-3 py-2 rounded-lg border border-dashed border-slate-600 bg-slate-900/60 text-xs font-medium text-slate-200 hover:border-orange-500 flex items-center justify-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                {kycPortrait ? 'Portrait Set' : 'Portrait Photo'}
              </button>
            </div>
            <div className="md:col-span-12 flex justify-end">
              <button
                type="submit"
                disabled={busyAction}
                className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold"
              >
                Submit KYC Documents
              </button>
            </div>
          </form>
        )}
      </div>
    );
  };

  // Reusable Active Investments Table
  const renderInvestmentsTable = () => (
    <div className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl overflow-hidden shadow-xl text-slate-100">
      <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-orange-400" />
          <h3 className="font-display font-bold text-white text-sm">
            Active Investments &amp; Capital Control
          </h3>
        </div>
        <span className="text-xs font-mono text-slate-400">
          Mon–Fri Profit Days · Sat–Sun Weekend Rest
        </span>
      </div>

      {investments.length === 0 ? (
        <div className="p-8 text-center space-y-2">
          <p className="text-xs text-slate-400">
            No active AI packages yet. Deposit USDT or SOL and activate Starter ($100) through Elite ($1,000).
          </p>
          <button
            type="button"
            onClick={() => selectNav('activate-trading')}
            className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold"
          >
            Activate Trading Package
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Deployed Capital</th>
                <th className="py-3 px-4">Daily Target &amp; Profit</th>
                <th className="py-3 px-4">200 Profit-Day Progress</th>
                <th className="py-3 px-4">Fund Type</th>
                <th className="py-3 px-4">AI Bot Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {investments.map((inv) => {
                const m = computeInvestmentMetrics(inv, platformConfig.globalPaused);
                const relatedWd = withdrawals.find(
                  (w) => w.investmentId === inv.id && w.type === 'manual_capital'
                );

                return (
                  <tr key={inv.id} className="hover:bg-slate-900/50">
                    <td className="py-3.5 px-4 font-mono font-bold text-white whitespace-nowrap">
                      #{inv.packageNumber}
                      <div className="text-[11px] font-sans font-normal text-slate-400">
                        {inv.packageName}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-white tabular-nums whitespace-nowrap">
                      {inv.capital.toFixed(2)} ₮
                      <div className="text-[11px] font-normal text-slate-400">
                        {m.calendarDaysElapsed} cal. days elapsed
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums whitespace-nowrap">
                      <span className="font-bold text-emerald-400">
                        {inv.dailyPercent}% (${m.dailyDollarTarget.toFixed(2)}/d)
                      </span>
                      <div className="text-[11px] text-slate-300">
                        Gen: ${m.totalProfitGenerated.toFixed(2)} · Unclaimed: ${m.unclaimedProfit.toFixed(2)}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 min-w-[170px]">
                      <div className="flex justify-between font-mono text-[11px] text-slate-300 tabular-nums mb-1">
                        <span>
                          {m.completedProfitDays} / {inv.totalProfitDays} days
                        </span>
                        <span>{m.remainingProfitDays} left</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-orange-500 rounded-full"
                          style={{ width: `${m.progressPercent}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        Est. {m.estimatedCompletionLabel}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                          inv.isMentorGifted
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {inv.isMentorGifted ? 'Partner Allocation' : 'Actual User'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                          platformConfig.globalPaused
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : m.isWeekendRest
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {platformConfig.globalPaused
                          ? 'Trading Paused'
                          : m.isWeekendRest
                          ? 'Weekend Rest'
                          : 'AI Active (Mon–Fri)'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-2">
                      {m.unclaimedProfit > 0 && (
                        <button
                          type="button"
                          disabled={busyAction}
                          onClick={async () => {
                            setBusyAction(true);
                            try {
                              const amt = await claimInvestmentProfit(inv);
                              notify('ok', `Claimed $${amt.toFixed(2)} into your Income Wallet.`);
                            } catch (err) {
                              notify('err', (err as Error).message);
                            } finally {
                              setBusyAction(false);
                            }
                          }}
                          className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold"
                        >
                          Claim ${m.unclaimedProfit.toFixed(2)}
                        </button>
                      )}

                      {inv.isMentorGifted ? (
                        <span className="px-2.5 py-1 rounded border border-slate-700 text-[11px] text-slate-400">
                          Allocated Capital
                        </span>
                      ) : inv.status === 'capital_requested' || inv.status === 'capital_withdrawn' ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (relatedWd) {
                              setSelectedBreakdown(relatedWd);
                            } else {
                              setSelectedBreakdown({
                                id: inv.id,
                                uid: inv.uid,
                                userEmail: userProfile.email,
                                userName: userProfile.fullName,
                                type: 'manual_capital',
                                source: 'elite_capital',
                                investmentId: inv.id,
                                packageNumber: inv.packageNumber,
                                investmentDate: formatTimestamp(inv.createdAt, inv.startedAtMs),
                                principalCapital: inv.capital,
                                totalProfitGenerated: m.totalProfitGenerated,
                                amountUsd: inv.capital,
                                network: 'USDT_TRC20',
                                destinationAddress: 'On file',
                                status: inv.status === 'capital_withdrawn' ? 'approved' : 'pending',
                                adminNote: '',
                              });
                            }
                          }}
                          className="px-3 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-900 text-[11px] font-semibold"
                        >
                          {inv.status === 'capital_withdrawn' ? 'Capital Settled' : 'Review Pending'}
                        </button>
                      ) : m.isCapitalUnlockEligible ? (
                        <button
                          type="button"
                          onClick={() => setCapitalTargetInv(inv)}
                          className="px-3 py-1 rounded bg-orange-600 hover:bg-orange-500 text-white text-[11px] font-semibold"
                        >
                          Request Capital
                        </button>
                      ) : (
                        <span className="px-2.5 py-1 rounded border border-slate-700 bg-slate-900/70 text-[11px] text-slate-400 font-mono">
                          Locked ({m.daysRemainingForCapital}d)
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="relative z-10 min-h-screen bg-transparent text-slate-100 flex">
      {/* LEFT DARK NAVY GLASS SIDEBAR (Desktop Fixed + Mobile Drawer) — STRICTLY NO ADMIN OR MENTOR UI */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 bg-[#070C17]/88 backdrop-blur-xl text-slate-300 flex flex-col border-r border-slate-800/80 transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Brand Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <AlphatradexLogo3D variant="mark" size="sm" companyName={platformConfig.companyName} />
            <div className="min-w-0">
              <div className="font-display font-bold text-white text-sm truncate">
                {platformConfig.companyName}
              </div>
              <div className="text-[10px] font-mono text-slate-400 truncate">
                {userProfile.handle}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Grouped Sidebar Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {sidebarGroups.map((group) => (
            <div key={group.heading} className="space-y-1">
              <div className="px-3 text-[10px] font-mono font-semibold tracking-wider text-slate-500 uppercase">
                {group.heading}
              </div>
              {group.items.map(({ id, label, Icon }) => {
                const active = activeNav === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => selectNav(id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                      active
                        ? 'bg-slate-800/90 text-white border border-slate-700/70 shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-orange-500' : 'text-slate-500'}`} />
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Bottom Home Page & Sign Out */}
        <div className="p-3 border-t border-slate-800/80 space-y-1 shrink-0">
          {onOpenHomePage && (
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenHomePage('home');
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
            >
              <Home className="w-4 h-4 text-orange-400" />
              <span>Home Page</span>
            </button>
          )}
          <button
            type="button"
            onClick={signOutUser}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            <LogOut className="w-4 h-4 text-slate-500" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/65 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* RIGHT MAIN WORKSPACE */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Glass Top Utility Header */}
        <header className="sticky top-0 z-20 h-16 bg-[#0B111E]/82 backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline">Vault</span>
              <span className="text-slate-600 hidden sm:inline">/</span>
              <span className="font-display font-bold text-white truncate">{activeNavTitle}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {onOpenHomePage && (
              <button
                type="button"
                onClick={() => onOpenHomePage('home')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border border-slate-700 bg-slate-900/80 text-slate-200 hover:border-orange-500/70 hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                <Home className="w-3.5 h-3.5 text-orange-400" />
                <span className="hidden sm:inline">Home Page</span>
              </button>
            )}

            <span
              className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono border ${
                platformConfig.globalPaused
                  ? 'bg-red-950/70 border-red-700/60 text-red-300'
                  : isWeekend
                  ? 'bg-amber-950/70 border-amber-700/60 text-amber-300'
                  : 'bg-emerald-950/70 border-emerald-700/60 text-emerald-300'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              {platformConfig.globalPaused
                ? 'Paused'
                : isWeekend
                ? 'Weekend Rest (Sat–Sun)'
                : 'Mon–Fri Earning'}
            </span>

            <button
              type="button"
              onClick={() => selectNav('profile-kyc')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border ${
                userProfile.kycStatus === 'approved'
                  ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60'
                  : userProfile.kycStatus === 'pending'
                  ? 'bg-amber-950/70 text-amber-300 border-amber-700/60'
                  : 'bg-red-950/70 text-red-300 border-red-700/60'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              KYC: {userProfile.kycStatus.toUpperCase()}
            </button>

            <button
              type="button"
              onClick={() => selectNav('profile-kyc')}
              title="Open Profile Management"
              className="hidden sm:flex items-center gap-2.5 pl-2.5 border-l border-slate-800 text-xs hover:opacity-90 transition-opacity"
            >
              <div className="w-8 h-8 rounded-full overflow-hidden border border-orange-500/45 bg-slate-900 flex items-center justify-center shrink-0">
                {userProfile.avatarData ? (
                  <img
                    src={userProfile.avatarData}
                    alt={`${userProfile.fullName} avatar`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="font-display font-bold text-orange-400 text-[11px]">
                    {(userProfile.fullName || 'VC').slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="text-right">
                <div className="font-semibold text-white leading-tight">{userProfile.fullName}</div>
                <div className="font-mono text-[11px] text-slate-400">{userProfile.handle}</div>
              </div>
            </button>
          </div>
        </header>

        {/* Main Scrollable Content */}
        <main className="flex-1 p-4 sm:p-6 space-y-5 max-w-[1400px] w-full mx-auto">
          {/* USER-DASHBOARD-ONLY IMPORTANT ANNOUNCEMENT NOTIFICATION BAR */}
          {(() => {
            const ann = platformConfig.dashboardAnnouncement;
            if (!ann || !ann.enabled) return null;
            const title = (ann.title || '').trim();
            const msg = (ann.message || '').trim();
            if (!title && !msg) return null;
            const sig = `${ann.tone}::${title}::${msg}`;
            if (dismissedAnnSig === sig) return null;

            const toneStyles =
              ann.tone === 'urgent'
                ? {
                    wrap: 'bg-red-950/75 border-red-500/50 text-red-100',
                    tag: 'text-red-300',
                    Icon: AlertTriangle,
                    label: 'Urgent Alert',
                  }
                : ann.tone === 'warning'
                ? {
                    wrap: 'bg-amber-950/75 border-amber-500/50 text-amber-100',
                    tag: 'text-amber-300',
                    Icon: Bell,
                    label: 'Important Notice',
                  }
                : ann.tone === 'success'
                ? {
                    wrap: 'bg-emerald-950/75 border-emerald-500/50 text-emerald-100',
                    tag: 'text-emerald-300',
                    Icon: CheckCircle2,
                    label: 'Platform Update',
                  }
                : {
                    wrap: 'bg-[#0B111E]/90 border-sky-500/45 text-slate-100',
                    tag: 'text-sky-300',
                    Icon: Megaphone,
                    label: 'Announcement',
                  };
            const ToneIcon = toneStyles.Icon;

            return (
              <div
                role="region"
                aria-label="Important Platform Announcement"
                className={`rounded-xl border backdrop-blur-md px-4 py-3 shadow-lg flex items-start justify-between gap-3 ${toneStyles.wrap}`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`mt-0.5 shrink-0 ${toneStyles.tag}`}>
                    <ToneIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className={`font-mono font-semibold uppercase tracking-wide text-[11px] ${toneStyles.tag}`}>
                        {toneStyles.label}
                      </span>
                      {title && (
                        <>
                          <span aria-hidden="true" className="opacity-50">·</span>
                          <span className="font-display font-bold text-white text-xs sm:text-sm">
                            {title}
                          </span>
                        </>
                      )}
                    </div>
                    {msg && (
                      <p className="text-xs text-slate-200/95 leading-relaxed">{msg}</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDismissedAnnSig(sig);
                    try {
                      localStorage.setItem('vtv_dismissed_announcement', sig);
                    } catch {
                      // Ignore storage restrictions
                    }
                  }}
                  className="text-xs font-medium opacity-75 hover:opacity-100 underline shrink-0 whitespace-nowrap"
                >
                  Hide
                </button>
              </div>
            );
          })()}

          <BannerAdSlot
            bannerAds={platformConfig.bannerAds}
            placement="all_pages"
            compact
            onCtaAction={(url) => {
              if (url === '#coin-mining-desk') {
                selectNav('pump-fun');
              } else if (url.startsWith('#')) {
                document.getElementById(url.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }}
          />

          {feedback && (
            <div
              className={`p-3.5 rounded-xl border backdrop-blur-md text-xs sm:text-sm flex items-center justify-between gap-3 ${
                feedback.type === 'ok'
                  ? 'bg-emerald-950/80 border-emerald-600/50 text-emerald-200'
                  : 'bg-red-950/80 border-red-600/50 text-red-200'
              }`}
            >
              <span>{feedback.text}</span>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="text-xs font-semibold underline shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {renderKycBannerOrForm()}

          {/* VIEW: MAIN DASHBOARD */}
          {activeNav === 'dashboard' && (
            <div className="space-y-5">
              {/* Row 1: Wallet Overview Section (Deposit Wallet, Income Wallet, Pump.fun Wallet + Transfer to Package Funding) */}
              <section aria-labelledby="wallet-overview-heading" className="space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2
                      id="wallet-overview-heading"
                      className="font-display font-bold text-white text-base sm:text-lg tracking-tight flex items-center gap-2"
                    >
                      <Wallet className="w-4 h-4 text-orange-400" />
                      <span>Wallet Overview</span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      Combined Vault Liquidity:{' '}
                      <strong className="font-mono text-slate-200 tabular-nums">
                        ${(userProfile.usdBalance + userProfile.profitBalance).toFixed(2)}
                      </strong>{' '}
                      · Transfer from Income Wallet or fund AI trading packages directly from either balance.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDepositModal(true)}
                      className="px-3 py-1.5 rounded-lg border border-sky-500/50 bg-sky-500/15 hover:bg-sky-500/25 text-xs font-semibold text-sky-200 inline-flex items-center gap-1.5 transition-colors"
                    >
                      <PlusCircle className="w-3.5 h-3.5 text-sky-400" />
                      <span>Deposit Funds</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => selectNav('transaction-history')}
                      className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900/85 hover:border-sky-500/60 text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5 transition-colors"
                    >
                      <History className="w-3.5 h-3.5 text-sky-400" />
                      <span>Transaction History</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowWalletTransferBar((v) => !v)}
                      className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900/85 hover:border-emerald-500/60 text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Transfer Income → Deposit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPackageFundingSource(
                          userProfile.usdBalance >= 100
                            ? 'deposit_wallet'
                            : userProfile.profitBalance >= 100
                            ? 'income_wallet'
                            : 'combined'
                        );
                        selectNav('activate-trading');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Fund AI Package</span>
                    </button>
                  </div>
                </div>

                {showWalletTransferBar && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const amt = Number(walletTransferAmount);
                      if (!Number.isFinite(amt) || amt < 1) {
                        notify('err', 'Enter at least $1.00 USD to transfer.');
                        return;
                      }
                      setBusyAction(true);
                      try {
                        await transferIncomeToDepositWallet(amt);
                        notify(
                          'ok',
                          `Transferred $${amt.toFixed(2)} from Income Wallet to Deposit Wallet.`
                        );
                        setShowWalletTransferBar(false);
                      } catch (err) {
                        notify('err', (err as Error).message);
                      } finally {
                        setBusyAction(false);
                      }
                    }}
                    className="bg-[#0B111E]/90 backdrop-blur-md border border-emerald-500/40 rounded-2xl p-4 flex flex-wrap items-end justify-between gap-3 shadow-xl"
                  >
                    <div className="space-y-1 flex-1 min-w-[220px]">
                      <div className="text-xs font-semibold text-white">
                        Internal Wallet Transfer: Income Wallet → Deposit Wallet
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Available Income Wallet:{' '}
                        <strong className="font-mono text-emerald-400">
                          ${userProfile.profitBalance.toFixed(2)}
                        </strong>{' '}
                        · Move profits into Deposit Wallet to fund AI Trading &amp; Mining packages.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1">
                        {[0.25, 0.5, 1].map((ratio) => (
                          <button
                            key={ratio}
                            type="button"
                            onClick={() =>
                              setWalletTransferAmount(
                                Math.max(0, Number((userProfile.profitBalance * ratio).toFixed(2))).toString()
                              )
                            }
                            className="px-2 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-[11px] font-mono text-slate-300 hover:border-emerald-500/60"
                          >
                            {ratio === 1 ? 'MAX' : `${ratio * 100}%`}
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        min={1}
                        step="0.01"
                        required
                        value={walletTransferAmount}
                        onChange={(e) => setWalletTransferAmount(e.target.value)}
                        aria-label="Transfer amount USD"
                        className="w-28 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-950 text-white font-mono text-xs tabular-nums"
                      />
                      <button
                        type="submit"
                        disabled={busyAction || userProfile.profitBalance < 1}
                        className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold whitespace-nowrap"
                      >
                        Transfer to Deposit
                      </button>
                    </div>
                  </form>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Deposit Wallet Card */}
                  <div className="bg-[#0B111E]/78 backdrop-blur-md border border-sky-500/35 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between min-h-[136px] shadow-xl">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
                          <Wallet className="w-3.5 h-3.5 text-sky-400" />
                          <span>Deposit Wallet</span>
                        </div>
                        <div className="font-mono font-extrabold text-2xl text-white tabular-nums mt-2">
                          {userProfile.usdBalance.toFixed(2)} <span className="text-sky-400 text-base">₮</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          For AI Plans &amp; Mining · Direct FX: <span className="text-amber-300 font-semibold">Upcoming</span>
                        </div>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0">
                        <Lock className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-3 text-xs border-t border-slate-800/70 mt-3">
                      <button
                        type="button"
                        onClick={() => setShowDepositModal(true)}
                        className="text-sky-400 font-semibold hover:underline inline-flex items-center gap-1"
                      >
                        Deposit Crypto <ArrowRight className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPackageFundingSource('deposit_wallet');
                          selectNav('activate-trading');
                        }}
                        className="text-slate-200 hover:text-orange-400 font-semibold"
                      >
                        Fund AI Package
                      </button>
                    </div>
                  </div>

                  {/* Income Wallet Card */}
                  <div className="bg-[#0B111E]/78 backdrop-blur-md border border-emerald-500/35 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between min-h-[136px] shadow-xl">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Income Wallet</span>
                        </div>
                        <div className="font-mono font-extrabold text-2xl text-white tabular-nums mt-2">
                          {userProfile.profitBalance.toFixed(2)}{' '}
                          <span className="text-emerald-400 text-base">₮</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          Profit &amp; Commission · Fund AI Plans, Trade Forex or Withdraw
                        </div>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                        <Wallet className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 text-xs border-t border-slate-800/70 mt-3">
                      <button
                        type="button"
                        onClick={() => selectNav('withdraw')}
                        className="text-emerald-400 font-semibold hover:underline inline-flex items-center gap-1"
                      >
                        Withdraw (${platformConfig.minWithdrawalUsd} Min) <ArrowRight className="w-3 h-3" />
                      </button>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setPackageFundingSource('income_wallet');
                            selectNav('activate-trading');
                          }}
                          className="text-slate-200 hover:text-orange-400 font-semibold"
                        >
                          Fund Plan
                        </button>
                        <button
                          type="button"
                          onClick={() => selectNav('forex-market')}
                          className="text-orange-400 hover:underline font-semibold"
                        >
                          Forex Trade
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Pump.fun Coin Wallet Card */}
                  <div className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between min-h-[136px] shadow-xl">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <Coins className="w-3.5 h-3.5 text-orange-400" />
                          <span>Pump.fun (${platformConfig.pumpFunToken.ticker})</span>
                        </div>
                        <div className="font-mono font-extrabold text-2xl text-white tabular-nums mt-2">
                          {totalMemeTokens.toLocaleString()}{' '}
                          <span className="text-orange-400 text-sm">${platformConfig.pumpFunToken.ticker}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          ASIC Mining &amp; Launchpad Allocations
                        </div>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center shrink-0">
                        <Rocket className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-3 text-xs border-t border-slate-800/70 mt-3">
                      <button
                        type="button"
                        onClick={() => selectNav('pump-fun')}
                        className="text-orange-400 font-semibold hover:underline inline-flex items-center gap-1"
                      >
                        Mine &amp; Allocate <ArrowRight className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => selectNav('p2p-transfers')}
                        className="text-slate-400 hover:text-white"
                      >
                        P2P Send
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Row 2: Total Running AI Trading Exposure Banner */}
              <div className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl px-5 py-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Total Running AI Trading Capital &amp; 200-Day Target
                  </div>
                  <div className="flex flex-wrap items-baseline gap-2 mt-1">
                    <span className="font-mono font-extrabold text-xl text-orange-400 tabular-nums">
                      {activeCapital.toFixed(2)} ₮
                    </span>
                    <span className="text-xs text-slate-300">
                      · {activeInvestments.length} running package(s) · Projected 200-day yield{' '}
                      <strong className="font-mono text-white">${totalProjectedReturn.toFixed(2)}</strong>
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => selectNav('forex-market')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-900/90 hover:border-orange-500/70 text-slate-100 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                  >
                    <Globe className="w-4 h-4 text-orange-400" />
                    Forex WebTerminal &amp; Copy Trade
                  </button>
                  <button
                    type="button"
                    onClick={() => selectNav('activate-trading')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow-sm transition-colors whitespace-nowrap shrink-0"
                  >
                    <Zap className="w-4 h-4" />
                    Activate AI Trading
                  </button>
                </div>
              </div>

              {/* Row 3: Actual User Fund vs All-Plan Referral Earnings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 space-y-3 shadow-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-slate-400" />
                      Actual User Fund
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-mono font-semibold">
                      {actualUserInvestments.length} Pkg(s)
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div>
                      <div className="text-xs text-slate-400">Capital</div>
                      <div className="font-mono font-bold text-lg text-white tabular-nums">
                        {actualUserCapital.toFixed(2)} ₮
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Total Profit Generated</div>
                      <div className="font-mono font-bold text-lg text-emerald-400 tabular-nums">
                        {totalProfitGeneratedAll.toFixed(2)} ₮
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 space-y-3 shadow-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-orange-400" />
                      All-Plan Referral Earnings
                    </span>
                    <button
                      type="button"
                      onClick={() => selectNav('referral-mentor-desk')}
                      className="text-[11px] font-semibold text-orange-400 hover:underline inline-flex items-center gap-1"
                    >
                      Referral &amp; Mentor Desk <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div>
                      <div className="text-xs text-slate-400">Referral Commissions</div>
                      <div className="font-mono font-bold text-lg text-emerald-400 tabular-nums">
                        {totalMlmEarned.toFixed(2)} ₮
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">
                        Network Vol ({downlineReferrals.length} Refs)
                      </div>
                      <div className="font-mono font-bold text-lg text-sky-400 tabular-nums">
                        {totalReferralVolume.toFixed(2)} ₮
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 4: 200-Day AI Trading Tiers Strip */}
              <div className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-orange-400" />
                    <h2 className="font-display font-bold text-white text-sm">
                      200 Profit-Day AI Packages (Mon–Fri Active / Sat–Sun Weekend Rest)
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => selectNav('activate-trading')}
                    className="text-xs font-semibold text-orange-400 hover:underline inline-flex items-center gap-1"
                  >
                    Activate Package <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {platformConfig.packages.map((pkg) => {
                    const isElite = pkg.id === 'elite';
                    return (
                      <div
                        key={pkg.id}
                        className="p-4 rounded-xl border border-slate-700/70 bg-slate-900/70 flex flex-col justify-between space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display font-bold text-white text-sm">
                            {pkg.name} (${pkg.capital.toLocaleString()})
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              isElite
                                ? 'bg-amber-400 text-slate-900'
                                : 'bg-emerald-600 text-white'
                            }`}
                          >
                            {isElite ? `${platformConfig.eliteCapitalLockDays}d Lock` : `${pkg.profitDays}d`}
                          </span>
                        </div>
                        <div className="text-xs text-slate-300">
                          Target: <strong className="font-mono text-emerald-400">{pkg.dailyPercent}% / day</strong> ·{' '}
                          {pkg.aiMode}
                        </div>
                        <div className="text-[11px] font-medium text-orange-400">
                          {isElite
                            ? `Capital withdrawal after ${platformConfig.eliteCapitalLockDays} calendar days`
                            : `AI Trading + Referral Active · ${pkg.profitDays}d`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Row 5: Dark Live AI Execution & Pump.fun Feed + Glass Referral Toolkit */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left Dark Telemetry Card */}
                <div className="lg:col-span-7 bg-[#0B111E]/85 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 text-white space-y-4 shadow-xl">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-orange-500" />
                      <h3 className="font-display font-bold text-sm text-white">
                        AI Quantitative Execution &amp; Pump.fun Desk
                      </h3>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-[11px] font-mono font-semibold ${
                        platformConfig.globalPaused
                          ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                          : isWeekend
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}
                    >
                      {platformConfig.globalPaused
                        ? 'Desk Paused'
                        : isWeekend
                        ? 'Weekend Rest (Sat–Sun)'
                        : 'Trading Running (Mon–Fri)'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300">
                    Weekday algorithmic execution runs Monday to Friday (200 profit days ≈ 280 calendar days).
                    Official Pump.fun token ${platformConfig.pumpFunToken.ticker} is live for direct allocation.
                  </p>

                  <div className="grid grid-cols-3 divide-x divide-slate-800 bg-slate-900/80 border border-slate-800 rounded-xl py-3.5 text-center">
                    <div className="px-2">
                      <div className="text-[10px] text-slate-400 font-mono">ACTIVE PAIR / COIN</div>
                      <div className="font-mono font-bold text-orange-400 text-sm sm:text-base mt-0.5">
                        ${platformConfig.pumpFunToken.ticker} / USDT
                      </div>
                    </div>
                    <div className="px-2">
                      <div className="text-[10px] text-slate-400 font-mono">DAILY TARGET</div>
                      <div className="font-mono font-bold text-white text-sm sm:text-base mt-0.5 tabular-nums">
                        ${totalDailyTargetUsd.toFixed(2)} / day
                      </div>
                    </div>
                    <div className="px-2">
                      <div className="text-[10px] text-slate-400 font-mono">TOKEN PRICE</div>
                      <div className="font-mono font-bold text-emerald-400 text-sm sm:text-base mt-0.5 tabular-nums">
                        ${platformConfig.pumpFunToken.priceUsd.toFixed(6)}
                      </div>
                    </div>
                  </div>

                  <div className="bg-black/60 border border-slate-800 rounded-xl p-3.5 font-mono text-[11px] space-y-1">
                    <div className="text-emerald-400">
                      [VAULT_DESK]: {activeInvestments.length} active package(s) ·{' '}
                      {isWeekend ? 'Weekend Rest active (no counter increment)' : 'Mon–Fri earning cycle active'}
                    </div>
                    <div className="text-sky-400 truncate">
                      [PUMP_FUN]: {platformConfig.pumpFunToken.name} (${platformConfig.pumpFunToken.ticker}) · Mint:{' '}
                      {platformConfig.pumpFunToken.mintAddress}
                    </div>
                  </div>
                </div>

                {/* Right Referral Toolkit Card */}
                <div className="lg:col-span-5 bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xl">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Network className="w-4 h-4 text-orange-400" />
                      <h3 className="font-display font-bold text-white text-sm">
                        Referral Toolkit
                      </h3>
                    </div>
                    <p className="text-xs text-slate-300">
                      Earn {platformConfig.mlmRates.level1}% / {platformConfig.mlmRates.level2}% /{' '}
                      {platformConfig.mlmRates.level3}% instant referral commissions across all plans (Starter,
                      Growth, Pro &amp; Elite).
                    </p>

                    <div>
                      <div className="text-[11px] text-slate-400 mb-1">Your Direct Referral Link:</div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={referralLink}
                          className="flex-1 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/90 font-mono text-xs text-slate-100"
                        />
                        <button
                          type="button"
                          onClick={() => copyValue('ref-dash', referralLink)}
                          className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shrink-0"
                        >
                          {copiedText === 'ref-dash' ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          {copiedText === 'ref-dash' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900/75 border border-slate-700/70 flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                        <QrCode className="w-8 h-8 text-orange-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white">
                          Code: <span className="font-mono text-orange-400">{userProfile.handle}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Active across all plans ({downlineReferrals.length} referrals)
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Share Buttons */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(
                        `Join ${platformConfig.companyName} using my referral link: ${referralLink}`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold text-center"
                    >
                      WhatsApp
                    </a>
                    <a
                      href={`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(
                        `Join ${platformConfig.companyName}`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold text-center"
                    >
                      Telegram
                    </a>
                    <a
                      href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                        `Trade with ${platformConfig.companyName}: ${referralLink}`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-semibold text-center"
                    >
                      X / Twitter
                    </a>
                  </div>
                </div>
              </div>

              {/* Row 6: Active Investments & Capital Control Table */}
              {renderInvestmentsTable()}
            </div>
          )}

          {/* VIEW: MY PACKAGES / CAPITAL WITHDRAW */}
          {(activeNav === 'my-packages' || activeNav === 'capital-withdraw') && renderInvestmentsTable()}

          {/* VIEW: ACTIVATE TRADING (200-DAY AI PACKAGES) */}
          {activeNav === 'activate-trading' && (() => {
            const combinedWalletBalance = Number(
              (userProfile.usdBalance + userProfile.profitBalance).toFixed(2)
            );
            const selectedWalletBalance =
              packageFundingSource === 'deposit_wallet'
                ? userProfile.usdBalance
                : packageFundingSource === 'income_wallet'
                ? userProfile.profitBalance
                : combinedWalletBalance;
            const selectedWalletLabel =
              packageFundingSource === 'deposit_wallet'
                ? 'Deposit Wallet'
                : packageFundingSource === 'income_wallet'
                ? 'Income Wallet'
                : 'Combined (Deposit + Income)';

            return (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display font-bold text-white text-lg">
                    Fund &amp; Activate 200 Profit-Day AI Package
                  </h2>
                  <p className="text-xs text-slate-300">
                    Choose your funding wallet (Deposit Wallet, Income Wallet, or both combined) to activate AI trading &amp; L1–L3 referral commissions.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                  <span className="bg-[#0B111E]/80 backdrop-blur-md border border-sky-500/40 px-3 py-1.5 rounded-lg text-slate-200">
                    Deposit Wallet: <strong className="text-sky-300">${userProfile.usdBalance.toFixed(2)}</strong>
                  </span>
                  <span className="bg-[#0B111E]/80 backdrop-blur-md border border-emerald-500/40 px-3 py-1.5 rounded-lg text-slate-200">
                    Income Wallet: <strong className="text-emerald-300">${userProfile.profitBalance.toFixed(2)}</strong>
                  </span>
                </div>
              </div>

              {/* Wallet Funding Source Selector */}
              <div className="bg-[#0B111E]/82 backdrop-blur-md border border-slate-700/75 rounded-2xl p-4 space-y-3 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-white">
                    Select Package Funding Source
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    Active Source Balance:{' '}
                    <strong className="text-orange-400">${selectedWalletBalance.toFixed(2)}</strong>
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    {
                      id: 'deposit_wallet' as PackageFundingSource,
                      title: 'Deposit Wallet',
                      balance: userProfile.usdBalance,
                      hint: 'Primary crypto deposits',
                      accent: 'border-sky-500 bg-sky-500/15 text-sky-200',
                    },
                    {
                      id: 'income_wallet' as PackageFundingSource,
                      title: 'Income Wallet',
                      balance: userProfile.profitBalance,
                      hint: 'Reinvest earned profits & commissions',
                      accent: 'border-emerald-500 bg-emerald-500/15 text-emerald-200',
                    },
                    {
                      id: 'combined' as PackageFundingSource,
                      title: 'Combined Wallets',
                      balance: combinedWalletBalance,
                      hint: 'Auto-uses Deposit + Income balance',
                      accent: 'border-orange-500 bg-orange-500/15 text-orange-200',
                    },
                  ].map((opt) => {
                    const active = packageFundingSource === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPackageFundingSource(opt.id)}
                        className={`p-3 rounded-xl border text-left transition-colors ${
                          active
                            ? opt.accent
                            : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold">{opt.title}</span>
                          <span className="font-mono font-bold text-xs tabular-nums">
                            ${opt.balance.toFixed(2)}
                          </span>
                        </div>
                        <div className="text-[11px] opacity-80 mt-0.5">{opt.hint}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <TermsAgreementCheckbox
                id="invest-package-terms-checkbox"
                checked={acceptedPackageTerms}
                onChange={setAcceptedPackageTerms}
                onOpenTerms={() => onOpenHomePage?.('terms')}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {platformConfig.packages.map((pkg) => {
                  const dailyUsd = (pkg.capital * pkg.dailyPercent) / 100;
                  const totalTarget = dailyUsd * pkg.profitDays;
                  const lockDays = pkg.id === 'elite' ? platformConfig.eliteCapitalLockDays : pkg.capitalLockDays;
                  const canAfford = selectedWalletBalance >= pkg.capital;

                  return (
                    <div
                      key={pkg.id}
                      className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xl"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-display font-bold text-white text-lg">{pkg.name}</span>
                          <span className="font-mono text-xs font-semibold text-orange-400">
                            {pkg.dailyPercent}% / day
                          </span>
                        </div>
                        <div className="font-mono font-extrabold text-3xl text-white tabular-nums">
                          ${pkg.capital.toLocaleString()}
                        </div>
                        <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                          <Bot className="w-4 h-4 text-orange-400 shrink-0" />
                          <span>{pkg.aiMode}</span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">{pkg.description}</p>
                        <div className="border-t border-slate-800 pt-3 space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Weekday Target:</span>
                            <span className="font-mono font-semibold text-emerald-400 tabular-nums">
                              ${dailyUsd.toFixed(2)} / day
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Profit Cycle:</span>
                            <span className="font-mono font-semibold text-slate-200 tabular-nums">{pkg.profitDays} Profit Days</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Projected Yield:</span>
                            <span className="font-mono font-semibold text-slate-200 tabular-nums">${totalTarget.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Referral Payout:</span>
                            <span className="font-mono font-semibold text-sky-400 tabular-nums">
                              {platformConfig.mlmRates.level1}% / {platformConfig.mlmRates.level2}% / {platformConfig.mlmRates.level3}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Capital Lock:</span>
                            <span className="font-mono font-semibold text-slate-200 tabular-nums">
                              {pkg.id === 'elite' ? `${lockDays} Cal. Days` : `${lockDays} Profit Days`}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={busyAction || platformConfig.globalPaused}
                        onClick={async () => {
                          if (!canAfford) {
                            selectNav('deposit');
                            notify(
                              'err',
                              `Insufficient ${selectedWalletLabel} balance ($${selectedWalletBalance.toFixed(
                                2
                              )}). Deposit $${(pkg.capital - selectedWalletBalance).toFixed(2)} more or select Combined Wallets.`
                            );
                            return;
                          }
                          if (!acceptedPackageTerms) {
                            notify(
                              'err',
                              'Please check the Terms & Conditions and Risk Disclosure agreement above before investing in a package.'
                            );
                            return;
                          }
                          setBusyAction(true);
                          try {
                            await activatePackage(pkg, packageFundingSource);
                            notify(
                              'ok',
                              `${pkg.name} ($${pkg.capital}) funded from ${selectedWalletLabel}! Mon–Fri AI trading is now live.`
                            );
                            selectNav('dashboard');
                          } catch (err) {
                            notify('err', (err as Error).message);
                          } finally {
                            setBusyAction(false);
                          }
                        }}
                        className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold transition-colors ${
                          canAfford
                            ? 'bg-orange-600 hover:bg-orange-500 text-white'
                            : 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white'
                        }`}
                      >
                        {platformConfig.globalPaused
                          ? 'Platform Paused'
                          : canAfford
                          ? `Fund & Activate ($${pkg.capital})`
                          : `Deposit to Activate ($${pkg.capital})`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
            );
          })()}

          {/* VIEW: DEPOSIT & REPORT */}
          {(activeNav === 'deposit' || activeNav === 'deposit-report') && (
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-6 space-y-4 shadow-xl">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-display font-bold text-white text-lg">Deposit Funds to Deposit Wallet</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Fund your Deposit Wallet to buy AI Trading &amp; Mining plans. Direct Forex trading from Deposit Wallet is{' '}
                      <span className="text-amber-300 font-semibold">Upcoming</span>.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/35 font-mono text-xs text-sky-300 shrink-0">
                    ${userProfile.usdBalance.toFixed(2)}
                  </span>
                </div>

                {enabledDepositMethods.length === 0 ? (
                  <div className="p-4 rounded-xl bg-amber-950/50 border border-amber-700/50 text-xs text-amber-200">
                    All deposit channels are currently paused by administration.
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {enabledDepositMethods.map((method) => (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setDepNetwork(method.id)}
                          className={`py-2 px-2.5 rounded-lg border text-xs font-semibold text-left transition-colors ${
                            activeDepositNetworkId === method.id
                              ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                              : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <div className="truncate">{method.name}</div>
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5 uppercase">
                            Min ${method.minDepositUsd}
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-700/70 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-medium">
                          {selectedDepositMethod?.name || activeDepositNetworkId} Receiving Account
                        </span>
                        <button
                          type="button"
                          onClick={() => copyValue('wallet', currentDepositWallet)}
                          className="inline-flex items-center gap-1 text-orange-400 font-semibold"
                        >
                          {copiedText === 'wallet' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedText === 'wallet' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <div className="font-mono text-xs text-slate-100 break-all bg-slate-950/90 border border-slate-800 rounded-lg p-2.5">
                        {currentDepositWallet}
                      </div>
                      {selectedDepositMethod?.instructions && (
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          {selectedDepositMethod.instructions}
                        </p>
                      )}
                    </div>

                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const amt = Number(depAmount);
                        const minReq = selectedDepositMethod?.minDepositUsd || 1;
                        if (!Number.isFinite(amt) || amt < minReq || !depTxId.trim()) {
                          notify(
                            'err',
                            `Enter at least $${minReq.toFixed(2)} USD and a valid Transaction ID / Reference.`
                          );
                          return;
                        }
                        setBusyAction(true);
                        try {
                          await submitCryptoDeposit({
                            network: activeDepositNetworkId,
                            amountUsd: amt,
                            txId: depTxId,
                          });
                          setDepTxId('');
                          notify(
                            'ok',
                            `Deposit submitted via ${selectedDepositMethod?.name || activeDepositNetworkId}! Super Admin will verify and credit your Vault.`
                          );
                        } catch (err) {
                          notify('err', (err as Error).message);
                        } finally {
                          setBusyAction(false);
                        }
                      }}
                      className="space-y-3"
                    >
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Deposit Amount (USD Equivalent · Min ${selectedDepositMethod?.minDepositUsd || 1})
                        </label>
                        <input
                          type="number"
                          min={selectedDepositMethod?.minDepositUsd || 1}
                          step="0.01"
                          required
                          value={depAmount}
                          onChange={(e) => setDepAmount(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-900/90 text-white font-mono text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Transaction ID / Hash / TrxID
                        </label>
                        <input
                          type="text"
                          required
                          value={depTxId}
                          onChange={(e) => setDepTxId(e.target.value)}
                          placeholder="Paste confirmed TxID / Order ID / TrxID"
                          className="w-full px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-900/90 text-white font-mono text-sm placeholder:text-slate-500"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={busyAction}
                        className="w-full py-2.5 px-4 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold"
                      >
                        {busyAction
                          ? 'Submitting...'
                          : `Submit ${selectedDepositMethod?.name || 'Deposit'}`}
                      </button>
                    </form>
                  </>
                )}
              </div>

              <div className="lg:col-span-7 bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-6 space-y-4 shadow-xl">
                <h3 className="font-display font-bold text-white text-base">Deposit Wallet Report</h3>
                {deposits.length === 0 ? (
                  <p className="text-xs text-slate-400 py-8 text-center">No deposits submitted yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="py-2 pr-3">Date</th>
                          <th className="py-2 pr-3">Channel</th>
                          <th className="py-2 pr-3">Amount</th>
                          <th className="py-2 pr-3">TxID</th>
                          <th className="py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {deposits.map((d) => (
                          <tr key={d.id}>
                            <td className="py-2.5 pr-3 font-mono text-slate-400 whitespace-nowrap">
                              {formatTimestamp(d.createdAt)}
                            </td>
                            <td className="py-2.5 pr-3 font-semibold text-slate-200">{d.network.replace(/_/g, ' ')}</td>
                            <td className="py-2.5 pr-3 font-mono font-bold text-white tabular-nums">
                              ${d.amountUsd.toFixed(2)}
                            </td>
                            <td className="py-2.5 pr-3 font-mono text-slate-400 max-w-[140px] truncate">{d.txId}</td>
                            <td className="py-2.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                  d.status === 'approved'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : d.status === 'rejected'
                                    ? 'bg-red-500/20 text-red-300'
                                    : 'bg-amber-500/20 text-amber-300'
                                }`}
                              >
                                {d.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* VIEW: WITHDRAW, INCOME WALLET & P2P TRANSFERS */}
          {(activeNav === 'income-wallet' || activeNav === 'p2p-transfers' || activeNav === 'withdraw') && (
            <section className="space-y-6">
              {/* Dual Wallet Overview Strip */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#0B111E]/78 backdrop-blur-md border border-emerald-500/40 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xl">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                      Income Wallet (Profit &amp; Commission)
                    </div>
                    <div className="font-mono font-extrabold text-2xl text-white tabular-nums mt-1">
                      ${userProfile.profitBalance.toFixed(2)}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Earned from packages &amp; referral commissions. Trade Forex to grow balance or withdraw.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => selectNav('forex-market')}
                    className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
                  >
                    Forex Trade
                  </button>
                </div>

                <div className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xl">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-sky-400 flex items-center gap-2">
                      <span>Deposit Wallet (Plans Only)</span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-[10px]">
                        Direct Trade: Upcoming
                      </span>
                    </div>
                    <div className="font-mono font-extrabold text-2xl text-white tabular-nums mt-1">
                      ${userProfile.usdBalance.toFixed(2)}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Deposit funds here first to activate AI Trading plans and generate Income Wallet profits.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => selectNav('activate-trading')}
                    className="px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
                  >
                    Buy Plan
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-6 space-y-4 shadow-xl">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="font-display font-bold text-white text-lg">
                        Instant Profit Withdrawal
                      </h2>
                      <p className="text-xs text-slate-400">
                        Minimum ${platformConfig.minWithdrawalUsd} · Income Wallet:{' '}
                        <strong className="font-mono text-emerald-400">
                          ${userProfile.profitBalance.toFixed(2)}
                        </strong>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => selectNav('payment-methods')}
                      className="text-xs font-semibold text-orange-400 hover:underline inline-flex items-center gap-1 shrink-0"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      Saved Methods ({savedPaymentMethods.length})
                    </button>
                  </div>

                  {savedPaymentMethods.length > 0 && (
                    <div className="p-3 rounded-xl bg-slate-900/75 border border-slate-700/70 space-y-2">
                      <div className="text-[11px] font-semibold text-slate-300">
                        Quick-Fill from Saved Payment Methods:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {savedPaymentMethods.map((pm) => (
                          <button
                            key={pm.id}
                            type="button"
                            onClick={() => {
                              setWdNetwork(pm.methodId);
                              setWdAddress(pm.accountAddress);
                            }}
                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium inline-flex items-center gap-1 ${
                              wdNetwork === pm.methodId && wdAddress === pm.accountAddress
                                ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                                : 'border-slate-700 bg-slate-800/80 text-slate-200 hover:border-orange-500'
                            }`}
                          >
                            {pm.isDefault && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                            <span>{pm.label}</span>
                            <span className="text-slate-400 font-mono">({pm.methodName})</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const amt = Number(wdAmount);
                      if (!Number.isFinite(amt) || amt <= 0) {
                        notify('err', 'Enter a valid withdrawal USD amount.');
                        return;
                      }
                      setBusyAction(true);
                      try {
                        await withdrawInstantProfit({
                          amountUsd: amt,
                          network: activeWithdrawNetworkId,
                          destinationAddress: wdAddress,
                          source: wdSource,
                        });
                        if (
                          saveAfterWithdraw &&
                          wdAddress.trim() &&
                          !savedPaymentMethods.some(
                            (pm) =>
                              pm.methodId === activeWithdrawNetworkId &&
                              pm.accountAddress === wdAddress.trim()
                          )
                        ) {
                          const methodName = selectedWithdrawMethod?.name || activeWithdrawNetworkId;
                          await addUserPaymentMethod({
                            label: `${methodName} Payout`,
                            methodId: activeWithdrawNetworkId,
                            methodName,
                            accountAddress: wdAddress.trim(),
                            accountHolder: userProfile.fullName,
                            isDefault: savedPaymentMethods.length === 0,
                          });
                        }
                        setWdAddress('');
                        setSaveAfterWithdraw(false);
                        notify('ok', `Instant profit payout of $${amt.toFixed(2)} completed!`);
                      } catch (err) {
                        notify('err', (err as Error).message);
                      } finally {
                        setBusyAction(false);
                      }
                    }}
                    className="space-y-3"
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Profit Source</label>
                        <select
                          value={wdSource}
                          onChange={(e) =>
                            setWdSource(e.target.value as 'package_profit' | 'mlm_commission')
                          }
                          className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/90 text-white text-xs"
                        >
                          <option value="package_profit">Package AI Profit</option>
                          <option value="mlm_commission">Referral Commission (All Plans)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Payout Channel</label>
                        <select
                          value={activeWithdrawNetworkId}
                          onChange={(e) => setWdNetwork(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/90 text-white text-xs"
                        >
                          {enabledWithdrawMethods.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Amount (Min ${Math.max(platformConfig.minWithdrawalUsd, selectedWithdrawMethod?.minWithdrawalUsd || 0)})
                      </label>
                      <input
                        type="number"
                        min={platformConfig.minWithdrawalUsd}
                        step="0.01"
                        required
                        value={wdAmount}
                        onChange={(e) => setWdAmount(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900/90 text-white font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Destination Wallet / Account Number
                      </label>
                      <input
                        type="text"
                        required
                        value={wdAddress}
                        onChange={(e) => setWdAddress(e.target.value)}
                        placeholder={`Enter receiving ${selectedWithdrawMethod?.name || 'payout'} address / ID`}
                        className="w-full px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900/90 text-white font-mono text-sm placeholder:text-slate-500"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={saveAfterWithdraw}
                        onChange={(e) => setSaveAfterWithdraw(e.target.checked)}
                      />
                      <span>Save this payout account to My Payment Methods</span>
                    </label>
                    <button
                      type="submit"
                      disabled={busyAction || enabledWithdrawMethods.length === 0}
                      className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold"
                    >
                      Withdraw Profit Instantly
                    </button>
                  </form>
                </div>

                {/* P2P Dollar Transfer */}
                <div className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-6 space-y-4 shadow-xl">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="font-display font-bold text-white text-lg">
                        User-to-User (P2P) USD Transfer
                      </h2>
                      <p className="text-xs text-slate-400">
                        Send USD instantly by Email or Handle · Deposit Wallet:{' '}
                        <strong className="font-mono text-white">${userProfile.usdBalance.toFixed(2)}</strong>
                      </p>
                    </div>
                    <Send className="w-5 h-5 text-orange-400 shrink-0" />
                  </div>

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const amt = Number(p2pAmount);
                      if (!Number.isFinite(amt) || amt <= 0) {
                        notify('err', 'Enter a valid USD transfer amount.');
                        return;
                      }
                      setBusyAction(true);
                      try {
                        await sendP2PTransfer({
                          recipientQuery: p2pRecipient,
                          amountUsd: amt,
                          note: p2pNote,
                        });
                        setP2pRecipient('');
                        setP2pNote('');
                        notify('ok', `Sent $${amt.toFixed(2)} USD via P2P transfer.`);
                      } catch (err) {
                        notify('err', (err as Error).message);
                      } finally {
                        setBusyAction(false);
                      }
                    }}
                    className="space-y-3"
                  >
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Recipient Email or User Handle (e.g. ATX...)
                      </label>
                      <input
                        type="text"
                        required
                        value={p2pRecipient}
                        onChange={(e) => setP2pRecipient(e.target.value)}
                        placeholder="user@domain.com or ATXABC123"
                        className="w-full px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900/90 text-white text-sm placeholder:text-slate-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Amount (USD)</label>
                        <input
                          type="number"
                          min={1}
                          step="0.01"
                          required
                          value={p2pAmount}
                          onChange={(e) => setP2pAmount(e.target.value)}
                          className="w-full px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900/90 text-white font-mono text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Note (Optional)</label>
                        <input
                          type="text"
                          value={p2pNote}
                          onChange={(e) => setP2pNote(e.target.value)}
                          placeholder="Settlement memo"
                          className="w-full px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900/90 text-white text-sm placeholder:text-slate-500"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={busyAction}
                      className="w-full py-2.5 px-4 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold"
                    >
                      Send Instant P2P USD
                    </button>
                  </form>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 space-y-3 shadow-xl">
                  <h3 className="font-display font-bold text-white text-base">
                    Withdrawals (Instant Profit &amp; Manual Capital)
                  </h3>
                  {withdrawals.length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">No withdrawals yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {withdrawals.map((w) => (
                        <div
                          key={w.id}
                          className="p-3 rounded-xl border border-slate-700/70 bg-slate-900/60 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-white">
                              {w.type === 'manual_capital'
                                ? `Manual Capital (Pkg #${w.packageNumber})`
                                : 'Instant Profit Payout'}
                            </div>
                            <div className="text-slate-400 font-mono truncate">
                              {w.network.replace('_', ' ')} · {w.destinationAddress}
                            </div>
                          </div>
                          <div className="text-right shrink-0 space-y-1">
                            <div className="font-mono font-bold text-white tabular-nums">
                              ${w.amountUsd.toFixed(2)}
                            </div>
                            <div className="flex items-center justify-end gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  w.status === 'completed' || w.status === 'approved'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : w.status === 'rejected'
                                    ? 'bg-red-500/20 text-red-300'
                                    : 'bg-amber-500/20 text-amber-300'
                                }`}
                              >
                                {w.status}
                              </span>
                              {w.type === 'manual_capital' && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedBreakdown(w)}
                                  className="text-[11px] font-semibold text-orange-400 underline"
                                >
                                  Breakdown
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 space-y-3 shadow-xl">
                  <h3 className="font-display font-bold text-white text-base">P2P USD Transfer Ledger</h3>
                  {p2pTransfers.length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">No P2P transfers recorded.</p>
                  ) : (
                    <div className="space-y-2">
                      {p2pTransfers.map((t) => {
                        const isSender = t.senderUid === userProfile.uid;
                        return (
                          <div
                            key={t.id}
                            className="p-3 rounded-xl border border-slate-700/70 bg-slate-900/60 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {isSender ? (
                                <ArrowUpRight className="w-4 h-4 text-red-400 shrink-0" />
                              ) : (
                                <ArrowDownLeft className="w-4 h-4 text-emerald-400 shrink-0" />
                              )}
                              <div className="min-w-0">
                                <div className="font-semibold text-white truncate">
                                  {isSender
                                    ? `Sent to ${t.receiverName} (${t.receiverHandle})`
                                    : `Received from ${t.senderName} (${t.senderHandle})`}
                                </div>
                                <div className="text-slate-400 truncate">{t.note || 'P2P USD Settlement'}</div>
                              </div>
                            </div>
                            <div
                              className={`font-mono font-bold tabular-nums shrink-0 ${
                                isSender ? 'text-red-400' : 'text-emerald-400'
                              }`}
                            >
                              {isSender ? '-' : '+'}${t.amountUsd.toFixed(2)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* VIEW: TRANSACTION HISTORY */}
          {activeNav === 'transaction-history' && (
            <TransactionHistoryView
              deposits={deposits}
              withdrawals={withdrawals}
              p2pTransfers={p2pTransfers}
              walletTransfers={walletTransfers}
              currentUid={userProfile.uid}
              onSelectBreakdown={(w) => setSelectedBreakdown(w)}
              onNavigate={(sec) => selectNav(sec)}
            />
          )}

          {/* VIEW: ALPHATRADEX COIN MINING, TAP-TO-MINE, BANNER ADS & PUMP.FUN */}
          {activeNav === 'pump-fun' && (
            <section className="space-y-6">
              <AlphatradexCoinHub
                mode="vault"
                onNotify={notify}
                onOpenTerms={() => onOpenHomePage?.('terms')}
                onPrimaryHeroAction={() => {
                  buyTokenInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  buyTokenInputRef.current?.focus();
                }}
                primaryHeroLabel={`Allocate $${platformConfig.pumpFunToken.ticker} Now`}
              />

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-6 bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-6 space-y-5 shadow-xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-orange-400">
                      <Rocket className="w-3.5 h-3.5" />
                      Official Pump.fun Solana Launch
                    </div>
                    <h2 className="font-display font-bold text-white text-xl mt-0.5">
                      {platformConfig.pumpFunToken.name} (${platformConfig.pumpFunToken.ticker})
                    </h2>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-xl text-white tabular-nums">
                      ${platformConfig.pumpFunToken.priceUsd.toFixed(6)}
                    </div>
                    <div className="text-xs font-mono font-semibold text-emerald-400 tabular-nums">
                      +{platformConfig.pumpFunToken.change24hPercent}% (24h)
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {platformConfig.pumpFunToken.description}
                </p>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-700/70 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Solana Mint Address</span>
                    <button
                      type="button"
                      onClick={() => copyValue('mint', platformConfig.pumpFunToken.mintAddress)}
                      className="inline-flex items-center gap-1 text-orange-400 font-semibold"
                    >
                      {copiedText === 'mint' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedText === 'mint' ? 'Copied' : 'Copy Mint'}
                    </button>
                  </div>
                  <div className="font-mono text-xs text-slate-100 break-all">
                    {platformConfig.pumpFunToken.mintAddress}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-400">
                    Market Cap:{' '}
                    <strong className="font-mono text-white">
                      ${platformConfig.pumpFunToken.marketCapUsd.toLocaleString()}
                    </strong>
                  </span>
                  <a
                    href={platformConfig.pumpFunToken.pumpFunUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-orange-400 font-semibold hover:underline"
                  >
                    View Token on Pump.fun
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const amt = Number(memeAmountUsd);
                    if (!Number.isFinite(amt) || amt <= 0) {
                      notify('err', 'Enter a valid USD allocation amount.');
                      return;
                    }
                    if (memePayMethod === 'SOL_WALLET' && !memeSolTx.trim()) {
                      notify('err', 'Paste your Solana wallet transfer signature for SOL Direct allocation.');
                      return;
                    }
                    if (!acceptedMemeTerms) {
                      notify(
                        'err',
                        'Please agree to the Terms & Conditions and Risk Disclosure checkbox before allocating funds.'
                      );
                      return;
                    }
                    setBusyAction(true);
                    try {
                      await investPumpFunMemeCoin({
                        amountUsd: amt,
                        paymentMethod: memePayMethod,
                        txSignature: memeSolTx,
                      });
                      setMemeSolTx('');
                      notify('ok', `Allocated $${amt.toFixed(2)} into $${platformConfig.pumpFunToken.ticker}!`);
                    } catch (err) {
                      notify('err', (err as Error).message);
                    } finally {
                      setBusyAction(false);
                    }
                  }}
                  className="pt-4 border-t border-slate-800 space-y-3"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMemePayMethod('USD_VAULT')}
                      className={`py-2 px-3 rounded-lg border text-xs font-semibold ${
                        memePayMethod === 'USD_VAULT'
                          ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                          : 'border-slate-700 bg-slate-900/70 text-slate-300'
                      }`}
                    >
                      Deposit Wallet (${userProfile.usdBalance.toFixed(2)})
                    </button>
                    <button
                      type="button"
                      onClick={() => setMemePayMethod('SOL_WALLET')}
                      className={`py-2 px-3 rounded-lg border text-xs font-semibold ${
                        memePayMethod === 'SOL_WALLET'
                          ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                          : 'border-slate-700 bg-slate-900/70 text-slate-300'
                      }`}
                    >
                      Direct Solana Wallet
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Allocation Amount (USD)</label>
                    <input
                      ref={buyTokenInputRef}
                      type="number"
                      min={1}
                      step="0.01"
                      required
                      value={memeAmountUsd}
                      onChange={(e) => setMemeAmountUsd(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900/90 text-white font-mono text-sm"
                    />
                    <div className="text-[11px] font-mono text-slate-400 mt-1 tabular-nums">
                      Estimated Output:{' '}
                      <strong className="text-white">
                        {(
                          Number(memeAmountUsd || 0) / Math.max(0.0000001, platformConfig.pumpFunToken.priceUsd)
                        ).toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
                        ${platformConfig.pumpFunToken.ticker}
                      </strong>
                    </div>
                  </div>

                  {memePayMethod === 'SOL_WALLET' && (
                    <div className="space-y-2">
                      <div className="text-[11px] text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-700">
                        Send SOL equivalent to{' '}
                        <span className="font-mono break-all text-white">
                          {platformConfig.paymentMethods.find((m) => m.id === 'SOL')?.receivingAccount ||
                            platformConfig.depositWallets.sol}
                        </span>{' '}
                        and enter signature below:
                      </div>
                      <input
                        type="text"
                        required
                        value={memeSolTx}
                        onChange={(e) => setMemeSolTx(e.target.value)}
                        placeholder="Solana Tx Signature"
                        className="w-full px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900/90 text-white font-mono text-xs placeholder:text-slate-500"
                      />
                    </div>
                  )}

                  <TermsAgreementCheckbox
                    id="invest-meme-terms-checkbox"
                    checked={acceptedMemeTerms}
                    onChange={setAcceptedMemeTerms}
                    onOpenTerms={() => onOpenHomePage?.('terms')}
                  />

                  <button
                    type="submit"
                    disabled={busyAction}
                    className="w-full py-2.5 px-4 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold"
                  >
                    Buy ${platformConfig.pumpFunToken.ticker} Now
                  </button>
                </form>
              </div>

              <div className="lg:col-span-6 bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-white text-base">Your Meme Coin Allocations</h3>
                  <span className="font-mono text-xs font-bold text-orange-400 tabular-nums">
                    {totalMemeTokens.toLocaleString()} ${platformConfig.pumpFunToken.ticker}
                  </span>
                </div>
                {memeCoinInvestments.length === 0 ? (
                  <div className="py-10 text-center space-y-2">
                    <Coins className="w-7 h-7 text-slate-600 mx-auto" />
                    <p className="text-xs text-slate-400">
                      No ${platformConfig.pumpFunToken.ticker} allocations recorded yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {memeCoinInvestments.map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-xl border border-slate-700/70 bg-slate-900/60 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-semibold text-white">
                            {item.tokenQuantity.toLocaleString()} ${item.tokenTicker}
                          </div>
                          <div className="text-slate-400 font-mono">
                            {item.paymentMethod === 'USD_VAULT' ? 'Internal USD Vault' : 'Solana Wallet'} ·{' '}
                            {formatTimestamp(item.createdAt)}
                          </div>
                        </div>
                        <div className="text-right font-mono">
                          <div className="font-bold text-white tabular-nums">${item.amountUsd.toFixed(2)}</div>
                          <div className="text-[11px] text-slate-400 tabular-nums">
                            @${item.entryPriceUsd.toFixed(6)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </div>
            </section>
          )}

          {/* VIEW: FOREX MARKET WEBTERMINAL & COPY TRADE */}
          {activeNav === 'forex-market' && (
            <ForexMarketView
              vaultBalanceUsd={userProfile.profitBalance}
              mode="vault"
              onNotify={notify}
              onNavigateToDeposit={() => selectNav('deposit')}
              onNavigateToPackages={() => selectNav('activate-trading')}
            />
          )}

          {/* VIEW: REFERRAL & MENTOR DESK */}
          {activeNav === 'referral-mentor-desk' && (
            <ReferralMentorDeskView
              userProfile={userProfile}
              platformConfig={platformConfig}
              referralLink={referralLink}
              referralLinkClicks={referralLinkClicks}
              downlineReferrals={downlineReferrals}
              mlmCommissions={mlmCommissions}
              copiedText={copiedText}
              onCopyValue={copyValue}
              onOpenWithdraw={() => selectNav('withdraw')}
            />
          )}

          {/* VIEW: REFERRAL DASHBOARD, INCOME & DOWNLINE */}
          {(activeNav === 'income-details' ||
            activeNav === 'mlm-commissions' ||
            activeNav === 'referral-network' ||
            activeNav === 'downline-team') && (
            <ReferralDashboard
              userProfile={userProfile}
              platformConfig={platformConfig}
              referralLink={referralLink}
              referralLinkClicks={referralLinkClicks}
              downlineReferrals={downlineReferrals}
              mlmCommissions={mlmCommissions}
              copiedText={copiedText}
              onCopyValue={copyValue}
              onOpenWithdraw={() => selectNav('withdraw')}
            />
          )}

          {/* VIEW: PAYMENT METHODS MANAGER (USER SAVED PAYOUTS + PLATFORM CHANNELS) */}
          {activeNav === 'payment-methods' && (
            <section className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Add Saved Payout Method Form */}
                <div className="lg:col-span-5 bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-6 space-y-4 shadow-xl">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-orange-400" />
                    <div>
                      <h2 className="font-display font-bold text-white text-lg">Add Payout Payment Method</h2>
                      <p className="text-xs text-slate-400">
                        Save your wallet addresses or payment accounts in Firestore for 1-click withdrawals.
                      </p>
                    </div>
                  </div>

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const chosen =
                        enabledWithdrawMethods.find((m) => m.id === pmChannelId) ||
                        enabledWithdrawMethods[0] ||
                        platformConfig.paymentMethods[0];
                      if (!chosen) {
                        notify('err', 'No withdrawal payment channels are enabled.');
                        return;
                      }
                      setBusyAction(true);
                      try {
                        await addUserPaymentMethod({
                          label: pmLabel,
                          methodId: chosen.id,
                          methodName: chosen.name,
                          accountAddress: pmAddress,
                          accountHolder: pmHolder,
                          isDefault: pmDefault,
                        });
                        setPmLabel('');
                        setPmAddress('');
                        setPmHolder('');
                        notify('ok', `Saved payment method "${pmLabel.trim()}" to your Vault.`);
                      } catch (err) {
                        notify('err', (err as Error).message);
                      } finally {
                        setBusyAction(false);
                      }
                    }}
                    className="space-y-3"
                  >
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Payment Channel
                      </label>
                      <select
                        value={
                          enabledWithdrawMethods.some((m) => m.id === pmChannelId)
                            ? pmChannelId
                            : enabledWithdrawMethods[0]?.id || ''
                        }
                        onChange={(e) => setPmChannelId(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900/90 text-white text-xs"
                      >
                        {enabledWithdrawMethods.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.category.replace('_', ' ')})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Nickname / Label
                      </label>
                      <input
                        type="text"
                        required
                        value={pmLabel}
                        onChange={(e) => setPmLabel(e.target.value)}
                        placeholder="e.g. My Binance TRC20 or Personal bKash"
                        className="w-full px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900/90 text-white text-sm placeholder:text-slate-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Wallet Address / Pay ID / Account Number
                      </label>
                      <input
                        type="text"
                        required
                        value={pmAddress}
                        onChange={(e) => setPmAddress(e.target.value)}
                        placeholder="Paste receiving address or account number"
                        className="w-full px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900/90 text-white font-mono text-sm placeholder:text-slate-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Account Holder Name (Optional)
                      </label>
                      <input
                        type="text"
                        value={pmHolder}
                        onChange={(e) => setPmHolder(e.target.value)}
                        placeholder={userProfile.fullName}
                        className="w-full px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900/90 text-white text-sm placeholder:text-slate-500"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pmDefault}
                        onChange={(e) => setPmDefault(e.target.checked)}
                      />
                      <span>Set as default payout method</span>
                    </label>
                    <button
                      type="submit"
                      disabled={busyAction || enabledWithdrawMethods.length === 0}
                      className="w-full py-2.5 px-4 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold"
                    >
                      {busyAction ? 'Saving...' : 'Save Payment Method'}
                    </button>
                  </form>
                </div>

                {/* Saved Payout Methods List */}
                <div className="lg:col-span-7 bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-6 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-white text-base">
                      My Saved Payout Accounts ({savedPaymentMethods.length})
                    </h3>
                    <button
                      type="button"
                      onClick={() => selectNav('withdraw')}
                      className="text-xs font-semibold text-emerald-400 hover:underline inline-flex items-center gap-1"
                    >
                      Go to Withdraw <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {savedPaymentMethods.length === 0 ? (
                    <div className="py-10 text-center space-y-2 border border-dashed border-slate-700 rounded-xl">
                      <CreditCard className="w-7 h-7 text-slate-600 mx-auto" />
                      <p className="text-xs text-slate-400">
                        No saved payment methods yet. Add your crypto wallet or payout account on the left.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {savedPaymentMethods.map((pm) => (
                        <div
                          key={pm.id}
                          className="p-4 rounded-xl border border-slate-700/70 bg-slate-900/70 flex flex-wrap items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-display font-bold text-white text-sm">{pm.label}</span>
                              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[10px]">
                                {pm.methodName}
                              </span>
                              {pm.isDefault && (
                                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold text-[10px] inline-flex items-center gap-1">
                                  <Star className="w-2.5 h-2.5 fill-amber-300" />
                                  Default
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-slate-300 break-all">{pm.accountAddress}</div>
                            {pm.accountHolder && (
                              <div className="text-slate-400">Holder: {pm.accountHolder}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setWdNetwork(pm.methodId);
                                setWdAddress(pm.accountAddress);
                                selectNav('withdraw');
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                            >
                              Withdraw
                            </button>
                            {!pm.isDefault && (
                              <button
                                type="button"
                                disabled={busyAction}
                                onClick={async () => {
                                  setBusyAction(true);
                                  try {
                                    await setDefaultUserPaymentMethod(pm.id);
                                    notify('ok', `"${pm.label}" set as default payout method.`);
                                  } catch (err) {
                                    notify('err', (err as Error).message);
                                  } finally {
                                    setBusyAction(false);
                                  }
                                }}
                                className="px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800 font-semibold"
                              >
                                Set Default
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={busyAction}
                              onClick={async () => {
                                setBusyAction(true);
                                try {
                                  await deleteUserPaymentMethod(pm.id);
                                  notify('ok', `Removed "${pm.label}".`);
                                } catch (err) {
                                  notify('err', (err as Error).message);
                                } finally {
                                  setBusyAction(false);
                                }
                              }}
                              className="p-1.5 rounded-lg border border-red-900/60 text-red-400 hover:bg-red-950/60"
                              title="Delete payment method"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Supported Platform Payment Channels Directory */}
              <div className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-6 space-y-4 shadow-xl">
                <div>
                  <h3 className="font-display font-bold text-white text-base">
                    Active Platform Payment Channels
                  </h3>
                  <p className="text-xs text-slate-400">
                    Live deposit and payout channels configured by Super Admin.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {platformConfig.paymentMethods
                    .filter((m) => m.enabled)
                    .map((m) => (
                      <div
                        key={m.id}
                        className="p-4 rounded-xl border border-slate-700/70 bg-slate-900/70 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display font-bold text-white text-sm">{m.name}</span>
                          <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 font-mono text-[10px] uppercase">
                            {m.category.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="text-slate-400">{m.instructions}</div>
                        {m.withdrawAddress && (
                          <div className="text-[11px] font-mono text-slate-400 truncate">
                            Payout Source: {m.withdrawAddress}
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-1 font-mono text-[11px] text-slate-300">
                          <span>{m.allowDeposit ? `Dep Min $${m.minDepositUsd}` : 'Deposit Off'}</span>
                          <span>{m.allowWithdrawal ? `Wd Min $${m.minWithdrawalUsd}` : 'Withdraw Off'}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </section>
          )}

          {/* VIEW: PROFILE MANAGEMENT */}
          {activeNav === 'profile-kyc' && (
            <ProfileManagementView
              userProfile={userProfile}
              authEmail={authUser?.email || userProfile.email}
              usesPasswordProvider={Boolean(
                authUser?.providerData?.some((p) => p.providerId === 'password')
              )}
              onUpdateProfileAvatar={updateProfileAvatar}
              onUpdateAccountEmail={updateAccountEmail}
              onSubmitKyc={submitKycUpdate}
              onNotify={notify}
            />
          )}

          {/* Vault Portal Footer */}
          <footer className="pt-4 mt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>© {new Date().getFullYear()} {platformConfig.companyName}</span>
              {onOpenHomePage && (
                <button
                  type="button"
                  onClick={() => onOpenHomePage('terms')}
                  className="font-semibold text-slate-300 hover:text-orange-400 underline underline-offset-4 transition-colors"
                >
                  Terms &amp; Conditions
                </button>
              )}
            </div>
            <span>Domain: alphatradex.pro · Crypto Settlement Only</span>
          </footer>
        </main>
      </div>

      {/* Request Manual Capital Withdrawal Modal */}
      {capitalTargetInv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md bg-white rounded-xl overflow-hidden shadow-2xl border border-slate-200">
            <div className="bg-[#0B111E] px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-orange-500" />
                <h3 className="font-display font-bold text-base">
                  Request Principal Capital (Package #{capitalTargetInv.packageNumber})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCapitalTargetInv(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                Close
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusyAction(true);
                try {
                  await requestManualCapitalWithdrawal({
                    investment: capitalTargetInv,
                    network: activeCapitalNetworkId,
                    destinationAddress: capitalAddress,
                  });
                  setCapitalTargetInv(null);
                  setCapitalAddress('');
                  notify('ok', 'Manual capital withdrawal submitted for Super Admin review.');
                } catch (err) {
                  notify('err', (err as Error).message);
                } finally {
                  setBusyAction(false);
                }
              }}
              className="p-5 space-y-4 text-sm text-slate-900"
            >
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Principal Capital:</span>
                  <strong className="font-mono">${capitalTargetInv.capital.toFixed(2)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Approval Flow:</span>
                  <span className="font-semibold text-amber-700">Manual Super Admin Review</span>
                </div>
              </div>
              {savedPaymentMethods.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-600">Quick-Fill Saved Method:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {savedPaymentMethods.map((pm) => (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => {
                          setCapitalNet(pm.methodId);
                          setCapitalAddress(pm.accountAddress);
                        }}
                        className="px-2 py-1 rounded border border-slate-200 bg-slate-50 hover:bg-orange-50 text-[11px] font-medium text-slate-700"
                      >
                        {pm.label} ({pm.methodName})
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payout Channel</label>
                <select
                  value={activeCapitalNetworkId}
                  onChange={(e) => setCapitalNet(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
                >
                  {enabledWithdrawMethods.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Destination Wallet / Account Address
                </label>
                <input
                  type="text"
                  required
                  value={capitalAddress}
                  onChange={(e) => setCapitalAddress(e.target.value)}
                  placeholder="Enter payout address / account number"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCapitalTargetInv(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busyAction}
                  className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Submit Capital Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Capital Request Breakdown Modal */}
      <CapitalRequestModal
        withdrawal={selectedBreakdown}
        onClose={() => setSelectedBreakdown(null)}
      />

      {/* Wallet Overview Deposit Funds Modal (QR Code, Wallet Address & USDT/SOL Network Selection) */}
      <DepositFundsModal
        open={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        paymentMethods={platformConfig.paymentMethods}
        depositWallets={platformConfig.depositWallets}
        currentDepositBalance={userProfile.usdBalance}
        initialNetwork={activeDepositNetworkId}
        onSubmitDeposit={submitCryptoDeposit}
        onNotify={notify}
      />
    </div>
  );
};
