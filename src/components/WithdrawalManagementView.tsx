import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Award,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  Filter,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Search,
  ShieldCheck,
  Star,
  Tag,
  TrendingUp,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import { DEFAULT_WEB3_PAYMENT_CONFIG } from '../constants/defaults';
import {
  Investment,
  MlmCommission,
  PlatformConfig,
  UserPaymentMethod,
  UserProfile,
  WhitelistedWallet,
  Withdrawal,
} from '../types/platform';
import { formatTimestamp } from '../utils/investmentMath';

interface WithdrawalManagementViewProps {
  userProfile: UserProfile;
  platformConfig: PlatformConfig;
  withdrawals: Withdrawal[];
  investments: Investment[];
  mlmCommissions: MlmCommission[];
  savedPaymentMethods: UserPaymentMethod[];
  busyAction: boolean;
  onRequestWithdrawalOtp: (params: {
    amountUsd: number;
    network: string;
    destinationAddress: string;
  }) => Promise<{
    ok: boolean;
    emailMasked: string;
    expiresInSeconds: number;
    deliveryMode: string;
    previewCode?: string;
    message: string;
  }>;
  onVerifyWithdrawalOtp: (params: {
    code: string;
    amountUsd: number;
    network: string;
    destinationAddress: string;
  }) => Promise<{
    ok: boolean;
    verified: boolean;
    otpVerificationToken: string;
    expiresAtIso: string;
  }>;
  onRequestPayout: (params: {
    amountUsd: number;
    network: string;
    destinationAddress: string;
    source: 'package_profit' | 'mlm_commission' | 'mentor_profit';
    savePaymentMethod: boolean;
    methodName: string;
    otpVerificationToken?: string;
    promoCode?: string;
  }) => Promise<void>;
  onValidatePromoCode?: (params: {
    code: string;
    context: 'withdrawal' | 'bonus';
    amountUsd?: number;
  }) => Promise<{
    code: string;
    title: string;
    description: string;
    type: string;
    discountPercent: number;
    bonusUsd: number;
    minAmountUsd: number;
    feeSavedUsd: number;
    discountedFeeUsd: number;
  }>;
  whitelistedWallets?: WhitelistedWallet[];
  onOpenPaymentMethods: () => void;
  onOpenSecurityCenter?: () => void;
  onOpenCapitalWithdraw: () => void;
  onInspectBreakdown: (w: Withdrawal) => void;
  onNotify: (type: 'ok' | 'err', text: string) => void;
}

type StatusTab = 'all' | 'pending' | 'processed' | 'rejected';
type SourceFilter = 'all' | 'package_profit' | 'mlm_commission' | 'elite_capital';

function isProcessedStatus(status: Withdrawal['status']): boolean {
  return status === 'completed' || status === 'approved';
}

function getSourceMeta(source: Withdrawal['source'], type: Withdrawal['type']): {
  label: string;
  badgeClass: string;
} {
  if (type === 'manual_capital' || source === 'elite_capital') {
    return {
      label: 'Capital Unlock',
      badgeClass: 'bg-sky-500/15 border-sky-500/35 text-sky-300',
    };
  }
  if (source === 'mlm_commission') {
    return {
      label: 'Referral Commissions',
      badgeClass: 'bg-orange-500/15 border-orange-500/35 text-orange-300',
    };
  }
  if (source === 'mentor_profit') {
    return {
      label: 'Mentor Override',
      badgeClass: 'bg-amber-500/15 border-amber-500/35 text-amber-300',
    };
  }
  return {
    label: 'Trading Profits',
    badgeClass: 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300',
  };
}

export const WithdrawalManagementView: React.FC<WithdrawalManagementViewProps> = ({
  userProfile,
  platformConfig,
  withdrawals,
  investments,
  mlmCommissions,
  savedPaymentMethods,
  whitelistedWallets = [],
  busyAction,
  onRequestWithdrawalOtp,
  onVerifyWithdrawalOtp,
  onRequestPayout,
  onValidatePromoCode,
  onOpenPaymentMethods,
  onOpenSecurityCenter,
  onOpenCapitalWithdraw,
  onInspectBreakdown,
  onNotify,
}) => {
  const web3Config = useMemo(
    () => ({
      ...DEFAULT_WEB3_PAYMENT_CONFIG,
      ...(platformConfig.web3PaymentConfig || {}),
    }),
    [platformConfig.web3PaymentConfig]
  );

  const enabledWithdrawMethods = useMemo(
    () => (platformConfig.paymentMethods || []).filter((m) => m.enabled && m.allowWithdrawal),
    [platformConfig.paymentMethods]
  );

  const defaultPm = useMemo(
    () => savedPaymentMethods.find((pm) => pm.isDefault) || savedPaymentMethods[0] || null,
    [savedPaymentMethods]
  );

  const [payoutSource, setPayoutSource] = useState<'package_profit' | 'mlm_commission'>('package_profit');
  const [networkId, setNetworkId] = useState<string>(
    defaultPm?.methodId || enabledWithdrawMethods[0]?.id || 'USDT_TRC20'
  );
  const [amountInput, setAmountInput] = useState<string>(
    String(Math.max(platformConfig.minWithdrawalUsd || 10, web3Config.minWithdrawalUsd || 10, 10))
  );
  const [destinationAddress, setDestinationAddress] = useState<string>(
    defaultPm?.accountAddress || ''
  );
  const [savePaymentMethod, setSavePaymentMethod] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // 2FA Email OTP state bound to exact withdrawal parameters
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpRequestedForSig, setOtpRequestedForSig] = useState('');
  const [otpMaskedEmail, setOtpMaskedEmail] = useState('');
  const [otpPreviewCode, setOtpPreviewCode] = useState('');
  const [otpCodeInput, setOtpCodeInput] = useState('');
  const [verifiedOtpToken, setVerifiedOtpToken] = useState('');
  const [verifiedOtpSig, setVerifiedOtpSig] = useState('');

  // Tracker filter state
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string>('');

  const activeNetworkId = useMemo(() => {
    if (enabledWithdrawMethods.some((m) => m.id === networkId)) return networkId;
    return enabledWithdrawMethods[0]?.id || 'USDT_TRC20';
  }, [enabledWithdrawMethods, networkId]);

  const selectedMethod = useMemo(
    () => enabledWithdrawMethods.find((m) => m.id === activeNetworkId) || enabledWithdrawMethods[0],
    [enabledWithdrawMethods, activeNetworkId]
  );

  const effectiveMinUsd = Math.max(
    Number(platformConfig.minWithdrawalUsd) || 10,
    Number(web3Config.minWithdrawalUsd) || 10,
    Number(selectedMethod?.minWithdrawalUsd) || 0
  );

  const effectiveMaxUsd = Math.max(
    effectiveMinUsd,
    Number(web3Config.maxWithdrawalUsd) || 25000
  );

  // Promo & Fee-Waiver Code state
  const [promoCodeInput, setPromoCodeInput] = useState<string>('');
  const [validatingPromo, setValidatingPromo] = useState<boolean>(false);
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    title: string;
    discountPercent: number;
  } | null>(null);

  const feePercent = Math.max(0, Number(web3Config.withdrawalFeePercent) || 0);
  const flatFeeUsd = Math.max(0, Number(web3Config.withdrawalFlatFeeUsd) || 0);
  const parsedAmount = Number(amountInput) || 0;
  const baseFeeUsd =
    parsedAmount > 0
      ? Math.round(((parsedAmount * feePercent) / 100 + flatFeeUsd) * 100) / 100
      : 0;
  const promoFeeSavingsUsd = appliedPromo
    ? Math.round(((baseFeeUsd * appliedPromo.discountPercent) / 100) * 100) / 100
    : 0;
  const computedFeeUsd = Math.max(0, Math.round((baseFeeUsd - promoFeeSavingsUsd) * 100) / 100);
  const computedNetPayoutUsd = Math.max(
    0,
    Math.round((parsedAmount - computedFeeUsd) * 100) / 100
  );

  const handleApplyPromoCode = async () => {
    if (!onValidatePromoCode) return;
    const clean = promoCodeInput.trim().toUpperCase();
    if (!clean) {
      onNotify('err', 'Enter a promo or fee-waiver voucher code.');
      return;
    }
    setValidatingPromo(true);
    try {
      const res = await onValidatePromoCode({
        code: clean,
        context: 'withdrawal',
        amountUsd: parsedAmount,
      });
      setAppliedPromo({
        code: res.code,
        title: res.title,
        discountPercent: res.discountPercent,
      });
      setPromoCodeInput(res.code);
      onNotify(
        'ok',
        `Promo "${res.code}" applied (${res.discountPercent}% fee discount — saving $${res.feeSavedUsd.toFixed(2)}).`
      );
    } catch (err) {
      setAppliedPromo(null);
      onNotify('err', (err as Error).message);
    } finally {
      setValidatingPromo(false);
    }
  };

  const require2fa = Boolean(web3Config.require2faForWithdrawals);
  const currentRequestSig = `${(Number.isFinite(parsedAmount) ? parsedAmount : 0).toFixed(2)}|${activeNetworkId}|${destinationAddress.trim()}`;
  const isOtpVerifiedForCurrent =
    Boolean(verifiedOtpToken) && verifiedOtpSig === currentRequestSig;
  const isOtpSentForCurrent = otpRequestedForSig === currentRequestSig;

  const totalReferralEarned = useMemo(
    () => mlmCommissions.reduce((acc, c) => acc + (Number(c.commissionUsd) || 0), 0),
    [mlmCommissions]
  );

  const totalTradingProfitClaimed = useMemo(
    () => investments.reduce((acc, inv) => acc + (Number(inv.claimedProfit) || 0), 0),
    [investments]
  );

  const summary = useMemo(() => {
    let pendingCount = 0;
    let pendingUsd = 0;
    let processedCount = 0;
    let processedUsd = 0;
    let rejectedCount = 0;
    let rejectedUsd = 0;

    for (const w of withdrawals) {
      const amt = Number(w.amountUsd) || 0;
      if (w.status === 'pending') {
        pendingCount++;
        pendingUsd += amt;
      } else if (isProcessedStatus(w.status)) {
        processedCount++;
        processedUsd += amt;
      } else if (w.status === 'rejected') {
        rejectedCount++;
        rejectedUsd += amt;
      }
    }

    return {
      totalCount: withdrawals.length,
      pendingCount,
      pendingUsd,
      processedCount,
      processedUsd,
      rejectedCount,
      rejectedUsd,
    };
  }, [withdrawals]);

  const filteredWithdrawals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return withdrawals.filter((w) => {
      if (statusTab === 'pending' && w.status !== 'pending') return false;
      if (statusTab === 'processed' && !isProcessedStatus(w.status)) return false;
      if (statusTab === 'rejected' && w.status !== 'rejected') return false;

      if (sourceFilter !== 'all') {
        if (sourceFilter === 'elite_capital') {
          if (w.type !== 'manual_capital' && w.source !== 'elite_capital') return false;
        } else if (w.source !== sourceFilter) {
          return false;
        }
      }

      if (!q) return true;
      return (
        w.id.toLowerCase().includes(q) ||
        (w.destinationAddress || '').toLowerCase().includes(q) ||
        (w.network || '').toLowerCase().includes(q) ||
        (w.adminNote || '').toLowerCase().includes(q)
      );
    });
  }, [withdrawals, statusTab, sourceFilter, searchQuery]);

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const kycBlockedForWithdrawals =
    (Boolean(platformConfig.kycSettings?.requireKycForWithdrawals) ||
      Boolean(web3Config.requireKycForWithdrawals)) &&
    userProfile.kycStatus !== 'approved';

  const unlockedWhitelistedWallets = useMemo(
    () => whitelistedWallets.filter((w) => Number(w.unlockAtMs || 0) <= nowMs),
    [whitelistedWallets, nowMs]
  );

  const lockedWhitelistedWallets = useMemo(
    () => whitelistedWallets.filter((w) => Number(w.unlockAtMs || 0) > nowMs),
    [whitelistedWallets, nowMs]
  );

  const strictWhitelistEnabled = Boolean(userProfile.whitelistStrictMode);

  const doesWalletMatchNetwork = (w: WhitelistedWallet, netId: string): boolean => {
    if (netId === 'USDT_BEP20') return w.network === 'BEP20';
    if (netId === 'USDT_POLYGON') return w.network === 'POLYGON';
    if (netId === 'USDT_TRC20') return w.network === 'TRC20';
    if (netId === 'USDT_ERC20') return w.network === 'ERC20';
    return true;
  };

  const doesWalletMatchAddress = (w: WhitelistedWallet, addr: string): boolean => {
    const clean = addr.trim();
    if (!clean) return false;
    if (w.network === 'TRC20') return w.address.trim() === clean;
    return w.address.trim().toLowerCase() === clean.toLowerCase();
  };

  const matchesWhitelistForCurrent = useMemo(() => {
    if (!destinationAddress.trim()) return false;
    return unlockedWhitelistedWallets.some(
      (w) => doesWalletMatchNetwork(w, activeNetworkId) && doesWalletMatchAddress(w, destinationAddress)
    );
  }, [destinationAddress, unlockedWhitelistedWallets, activeNetworkId]);

  const lockedMatchingWallet = useMemo(() => {
    if (!destinationAddress.trim()) return null;
    return (
      lockedWhitelistedWallets.find(
        (w) => doesWalletMatchNetwork(w, activeNetworkId) && doesWalletMatchAddress(w, destinationAddress)
      ) || null
    );
  }, [destinationAddress, lockedWhitelistedWallets, activeNetworkId]);

  const formatCountdownShort = (unlockAtMs: number): string => {
    const diff = Math.max(0, unlockAtMs - nowMs);
    const hrs = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.ceil((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${Math.max(1, mins)}m`;
  };

  const strictWhitelistBlocked = strictWhitelistEnabled && !matchesWhitelistForCurrent;
  const whitelistPolicyBlocked = strictWhitelistBlocked || Boolean(lockedMatchingWallet);

  const handleCopy = (key: string, val: string) => {
    navigator.clipboard?.writeText(val).catch(() => {});
    setCopiedId(key);
    window.setTimeout(() => setCopiedId(''), 1600);
  };

  const applyQuickPercent = (pct: number) => {
    const raw = (userProfile.profitBalance * pct) / 100;
    const capped = Math.min(raw, effectiveMaxUsd);
    const rounded = Math.floor(capped * 100) / 100;
    setAmountInput(rounded > 0 ? rounded.toFixed(2) : String(effectiveMinUsd));
  };

  const handleSendOtp = async () => {
    const amt = Number(amountInput);
    if (!Number.isFinite(amt) || amt < effectiveMinUsd) {
      onNotify('err', `Minimum withdrawal is $${effectiveMinUsd.toFixed(2)}.`);
      return;
    }
    if (amt > effectiveMaxUsd) {
      onNotify('err', `Maximum single withdrawal is $${effectiveMaxUsd.toLocaleString()}.`);
      return;
    }
    if (amt > userProfile.profitBalance) {
      onNotify('err', 'Insufficient withdrawable balance in your Income Wallet.');
      return;
    }
    if (!destinationAddress.trim()) {
      onNotify('err', 'Enter your destination wallet address before requesting a 2FA code.');
      return;
    }
    if (lockedMatchingWallet) {
      onNotify(
        'err',
        `24-Hour Security Lock active for "${lockedMatchingWallet.label}". Withdrawals to this address unlock in ${formatCountdownShort(lockedMatchingWallet.unlockAtMs)}.`
      );
      return;
    }
    if (strictWhitelistBlocked) {
      onNotify(
        'err',
        'Strict Withdrawal Whitelist Lock is active. Select an unlocked whitelisted address or add it via Email OTP under Security & Whitelist.'
      );
      return;
    }

    setOtpSending(true);
    try {
      const res = await onRequestWithdrawalOtp({
        amountUsd: amt,
        network: activeNetworkId,
        destinationAddress: destinationAddress.trim(),
      });
      setOtpRequestedForSig(currentRequestSig);
      setOtpMaskedEmail(res.emailMasked || '');
      setOtpPreviewCode(res.previewCode || '');
      setOtpCodeInput('');
      setVerifiedOtpToken('');
      setVerifiedOtpSig('');
      onNotify('ok', res.message || `6-digit 2FA verification code sent to ${res.emailMasked}.`);
    } catch (err) {
      onNotify('err', (err as Error).message);
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    const cleanCode = otpCodeInput.trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      onNotify('err', 'Enter the 6-digit numeric verification code.');
      return;
    }
    const amt = Number(amountInput);
    setOtpVerifying(true);
    try {
      const res = await onVerifyWithdrawalOtp({
        code: cleanCode,
        amountUsd: amt,
        network: activeNetworkId,
        destinationAddress: destinationAddress.trim(),
      });
      setVerifiedOtpToken(res.otpVerificationToken);
      setVerifiedOtpSig(currentRequestSig);
      onNotify('ok', '2FA verification confirmed. You can now submit your safe withdrawal request.');
    } catch (err) {
      onNotify('err', (err as Error).message);
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amountInput);
    if (!Number.isFinite(amt) || amt <= 0) {
      onNotify('err', 'Enter a valid payout amount in USD.');
      return;
    }
    if (amt < effectiveMinUsd) {
      onNotify('err', `Minimum withdrawal is $${effectiveMinUsd.toFixed(2)}.`);
      return;
    }
    if (amt > effectiveMaxUsd) {
      onNotify('err', `Maximum single withdrawal is $${effectiveMaxUsd.toLocaleString()}.`);
      return;
    }
    if (amt > userProfile.profitBalance) {
      onNotify('err', 'Insufficient withdrawable balance in your Income Wallet.');
      return;
    }
    if (computedNetPayoutUsd <= 0) {
      onNotify('err', 'Withdrawal amount must exceed platform network fees.');
      return;
    }
    if (!destinationAddress.trim()) {
      onNotify('err', 'Enter a valid destination wallet address or payout account.');
      return;
    }
    if (lockedMatchingWallet) {
      onNotify(
        'err',
        `24-Hour Security Lock active for "${lockedMatchingWallet.label}". Withdrawals unlock in ${formatCountdownShort(lockedMatchingWallet.unlockAtMs)}.`
      );
      return;
    }
    if (strictWhitelistBlocked) {
      onNotify(
        'err',
        'Strict Withdrawal Whitelist Lock is enabled. Only unlocked whitelisted addresses can receive payouts.'
      );
      return;
    }
    if (require2fa && !isOtpVerifiedForCurrent) {
      onNotify('err', 'Complete the 6-digit Email OTP / 2FA verification step before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      await onRequestPayout({
        amountUsd: amt,
        network: activeNetworkId,
        destinationAddress: destinationAddress.trim(),
        source: payoutSource,
        savePaymentMethod,
        methodName: selectedMethod?.name || activeNetworkId,
        otpVerificationToken: require2fa ? verifiedOtpToken : undefined,
        promoCode: appliedPromo?.code || undefined,
      });
      setSavePaymentMethod(false);
      setVerifiedOtpToken('');
      setVerifiedOtpSig('');
      setOtpRequestedForSig('');
      setOtpCodeInput('');
      setOtpPreviewCode('');
      setAppliedPromo(null);
      setPromoCodeInput('');
      setStatusTab('pending');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section aria-labelledby="withdrawal-management-heading" className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#0B111E]/82 backdrop-blur-md border border-slate-700/75 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-emerald-400 uppercase tracking-wider">
            <Wallet className="w-4 h-4" />
            <span>Payout &amp; Settlement Desk</span>
          </div>
          <h2
            id="withdrawal-management-heading"
            className="font-display font-bold text-white text-xl sm:text-2xl tracking-tight"
          >
            Withdrawal Management
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
            Request payouts from your earned Trading Profits or Referral Commissions and track every
            request in real time from Pending Review to Processed settlement.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenPaymentMethods}
            className="px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900/85 hover:border-orange-500/60 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <CreditCard className="w-3.5 h-3.5 text-orange-400" />
            <span>Saved Methods ({savedPaymentMethods.length})</span>
          </button>
          <button
            type="button"
            onClick={onOpenCapitalWithdraw}
            className="px-3.5 py-2 rounded-lg border border-sky-500/35 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Capital Unlock Requests</span>
          </button>
        </div>
      </div>

      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-[#0B111E]/82 backdrop-blur-md border border-emerald-500/35 rounded-2xl p-5 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
              Available Balance
            </span>
            <span className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </span>
          </div>
          <div className="font-mono font-extrabold text-2xl sm:text-3xl text-white tabular-nums">
            ${userProfile.profitBalance.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 tabular-nums">
            Trading: <strong className="text-slate-200">${totalTradingProfitClaimed.toFixed(2)}</strong> ·
            Refs: <strong className="text-orange-300">${totalReferralEarned.toFixed(2)}</strong>
          </div>
        </div>

        <div className="bg-[#0B111E]/82 backdrop-blur-md border border-amber-500/35 rounded-2xl p-5 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
              Pending Requests
            </span>
            <span className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="font-mono font-extrabold text-2xl sm:text-3xl text-amber-300 tabular-nums">
            ${summary.pendingUsd.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 tabular-nums">
            {summary.pendingCount} request{summary.pendingCount === 1 ? '' : 's'} awaiting settlement
          </div>
        </div>

        <div className="bg-[#0B111E]/82 backdrop-blur-md border border-slate-700/75 rounded-2xl p-5 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
              Processed Payouts
            </span>
            <span className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="font-mono font-extrabold text-2xl sm:text-3xl text-emerald-400 tabular-nums">
            ${summary.processedUsd.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 tabular-nums">
            {summary.processedCount} completed payout{summary.processedCount === 1 ? '' : 's'}
          </div>
        </div>

        <div className="bg-[#0B111E]/82 backdrop-blur-md border border-slate-700/75 rounded-2xl p-5 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
              Rejected / Refunded
            </span>
            <span className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </span>
          </div>
          <div className="font-mono font-extrabold text-2xl sm:text-3xl text-slate-200 tabular-nums">
            ${summary.rejectedUsd.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 tabular-nums">
            {summary.rejectedCount} declined (profit funds auto-refunded)
          </div>
        </div>
      </div>

      {/* Main 12-Column Grid: Payout Request Form + Status Tracker */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT 5 COLS: Request Payout Form */}
        <div className="xl:col-span-5 bg-[#0B111E]/82 backdrop-blur-md border border-slate-700/75 rounded-2xl p-6 space-y-5 shadow-xl">
          <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-800">
            <div>
              <h3 className="font-display font-bold text-white text-lg">Request Safe Payout</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Min ${effectiveMinUsd.toFixed(2)} · Max ${effectiveMaxUsd.toLocaleString()} · Admin-Reviewed Hold
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-md border border-emerald-500/35 bg-emerald-500/10 text-[11px] font-mono font-semibold text-emerald-300 shrink-0">
              {feePercent === 0 && flatFeeUsd === 0
                ? '0% Platform Fee'
                : `${feePercent > 0 ? `${feePercent}%` : ''}${feePercent > 0 && flatFeeUsd > 0 ? ' + ' : ''}${flatFeeUsd > 0 ? `$${flatFeeUsd.toFixed(2)}` : ''} Fee`}
            </span>
          </div>

          {platformConfig.withdrawalsPaused && (
            <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-xs text-amber-200 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Withdrawals are temporarily paused for scheduled liquidity maintenance by
                administration.
              </span>
            </div>
          )}

          {kycBlockedForWithdrawals && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>
                Verified KYC is required before requesting payouts. Complete your KYC Verification
                under Account &amp; Security first.
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Payout Earnings Source Cards */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                1. Select Earnings Source
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPayoutSource('package_profit')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    payoutSource === 'package_profit'
                      ? 'border-emerald-500 bg-emerald-500/12 ring-1 ring-emerald-500/30'
                      : 'border-slate-700/80 bg-slate-900/70 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <TrendingUp
                      className={`w-3.5 h-3.5 ${
                        payoutSource === 'package_profit' ? 'text-emerald-400' : 'text-slate-400'
                      }`}
                    />
                    <span>Trading Profits</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                    AI packages &amp; Forex profits
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setPayoutSource('mlm_commission')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    payoutSource === 'mlm_commission'
                      ? 'border-orange-500 bg-orange-500/12 ring-1 ring-orange-500/30'
                      : 'border-slate-700/80 bg-slate-900/70 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <Award
                      className={`w-3.5 h-3.5 ${
                        payoutSource === 'mlm_commission' ? 'text-orange-400' : 'text-slate-400'
                      }`}
                    />
                    <span>Referral Commissions</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                    L1–L3 referral rewards
                  </p>
                </button>
              </div>
            </div>

            {/* Whitelisted Anti-Fraud Addresses Quick-Select */}
            <div
              className={`p-3 rounded-xl border space-y-2 ${
                whitelistPolicyBlocked
                  ? 'bg-amber-950/35 border-amber-500/45'
                  : 'bg-emerald-950/25 border-emerald-500/35'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] font-bold text-emerald-300 inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>
                    Trusted USDT Whitelist ({unlockedWhitelistedWallets.length} Ready
                    {lockedWhitelistedWallets.length > 0
                      ? `, ${lockedWhitelistedWallets.length} in 24h Lock`
                      : ''}
                    ){strictWhitelistEnabled ? ' · Strict Lock ON' : ''}
                  </span>
                </div>
                {onOpenSecurityCenter && (
                  <button
                    type="button"
                    onClick={onOpenSecurityCenter}
                    className="text-[11px] font-semibold text-amber-300 hover:underline"
                  >
                    {whitelistedWallets.length === 0 ? 'Set Up Whitelist →' : 'Manage Whitelist →'}
                  </button>
                )}
              </div>

              {(unlockedWhitelistedWallets.length > 0 || lockedWhitelistedWallets.length > 0) ? (
                <div className="flex flex-wrap gap-1.5">
                  {unlockedWhitelistedWallets.map((wl) => {
                    const mappedNetworkId =
                      wl.network === 'BEP20'
                        ? 'USDT_BEP20'
                        : wl.network === 'POLYGON'
                        ? 'USDT_POLYGON'
                        : wl.network === 'ERC20'
                        ? 'USDT_ERC20'
                        : 'USDT_TRC20';
                    const active = doesWalletMatchAddress(wl, destinationAddress);
                    return (
                      <button
                        key={wl.id}
                        type="button"
                        onClick={() => {
                          if (enabledWithdrawMethods.some((m) => m.id === mappedNetworkId)) {
                            setNetworkId(mappedNetworkId);
                          }
                          setDestinationAddress(wl.address);
                        }}
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors ${
                          active
                            ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                            : 'border-slate-700 bg-slate-900/90 text-slate-200 hover:border-emerald-500/60'
                        }`}
                      >
                        <Lock className="w-3 h-3 text-emerald-400" />
                        <span>{wl.label}</span>
                        <span className="font-mono text-[10px] text-slate-400">({wl.network})</span>
                      </button>
                    );
                  })}

                  {lockedWhitelistedWallets.map((wl) => (
                    <span
                      key={wl.id}
                      title={`24-hour security lock active — unlocks in ${formatCountdownShort(wl.unlockAtMs)}`}
                      className="px-2.5 py-1 rounded-lg border border-amber-500/40 bg-amber-950/40 text-amber-200/90 text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-not-allowed opacity-85"
                    >
                      <Clock className="w-3 h-3 text-amber-400" />
                      <span>{wl.label}</span>
                      <span className="font-mono text-[10px] text-amber-300">
                        ({wl.network} · {formatCountdownShort(wl.unlockAtMs)})
                      </span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-300/90">
                  {strictWhitelistEnabled
                    ? 'Strict Whitelist Lock is enabled, but you have no unlocked whitelisted wallet yet. Add and Email-OTP verify a trusted USDT address under Security & Whitelist.'
                    : 'Save your trusted USDT addresses with Email OTP and optional 24-hour lock delay in Security & Whitelist for faster, safer payouts.'}
                </p>
              )}

              {lockedMatchingWallet && (
                <p className="text-[11px] text-amber-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    24-Hour Security Lock active for &ldquo;{lockedMatchingWallet.label}&rdquo;.
                    Withdrawals to this address unlock in{' '}
                    <strong>{formatCountdownShort(lockedMatchingWallet.unlockAtMs)}</strong>.
                  </span>
                </p>
              )}

              {!lockedMatchingWallet && strictWhitelistBlocked && unlockedWhitelistedWallets.length > 0 && (
                <p className="text-[11px] text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Current address is not in your active whitelist for this network. Select one of
                    the verified addresses above to proceed.
                  </span>
                </p>
              )}
            </div>

            {/* Saved Payment Methods Quick-Fill */}
            {savedPaymentMethods.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-900/75 border border-slate-700/70 space-y-2">
                <div className="text-[11px] font-semibold text-slate-300">
                  Quick-Fill Saved Payout Account:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {savedPaymentMethods.map((pm) => {
                    const active =
                      activeNetworkId === pm.methodId && destinationAddress === pm.accountAddress;
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => {
                          setNetworkId(pm.methodId);
                          setDestinationAddress(pm.accountAddress);
                        }}
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium inline-flex items-center gap-1 transition-colors ${
                          active
                            ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                            : 'border-slate-700 bg-slate-800/80 text-slate-200 hover:border-orange-500'
                        }`}
                      >
                        {pm.isDefault && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                        <span>{pm.label}</span>
                        <span className="text-slate-400 font-mono">({pm.methodName})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Payout Channel */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                2. Payout Network / Channel
              </label>
              <select
                value={activeNetworkId}
                onChange={(e) => setNetworkId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-900/90 text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-500"
              >
                {enabledWithdrawMethods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} (Min ${Math.max(platformConfig.minWithdrawalUsd, m.minWithdrawalUsd || 0)})
                  </option>
                ))}
              </select>
            </div>

            {/* Amount + Quick Percentage Buttons */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  3. Withdrawal Amount (USD)
                </label>
                <span className="text-[11px] font-mono text-emerald-400 tabular-nums">
                  Avail: ${userProfile.profitBalance.toFixed(2)}
                </span>
              </div>
              <input
                type="number"
                min={effectiveMinUsd}
                step="0.01"
                required
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-900/90 text-white font-mono text-base font-bold focus:outline-none focus:border-emerald-500 tabular-nums"
              />
              <div className="grid grid-cols-4 gap-1.5 mt-2">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => applyQuickPercent(pct)}
                    className="py-1.5 rounded-lg border border-slate-700/80 bg-slate-900 hover:border-emerald-500/60 hover:text-emerald-300 text-[11px] font-mono font-semibold text-slate-300 transition-colors"
                  >
                    {pct === 100 ? 'MAX' : `${pct}%`}
                  </button>
                ))}
              </div>
            </div>

            {/* Destination Wallet / Account */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                4. Destination Wallet / Account Number
              </label>
              <input
                type="text"
                required
                value={destinationAddress}
                onChange={(e) => setDestinationAddress(e.target.value)}
                placeholder={`Enter receiving ${selectedMethod?.name || 'payout'} address or ID`}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-900/90 text-white font-mono text-xs sm:text-sm placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={savePaymentMethod}
                onChange={(e) => setSavePaymentMethod(e.target.checked)}
                className="rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
              />
              <span>Save this payout destination to My Payment Methods</span>
            </label>

            {/* Optional Promo / Fee-Waiver Voucher Code */}
            {onValidatePromoCode && (
              <div className="p-3 rounded-xl bg-slate-900/75 border border-slate-700/75 space-y-2">
                <label className="block text-[11px] font-semibold text-amber-300 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  <span>Promo / 0% Fee-Waiver Voucher Code (Optional)</span>
                </label>
                {appliedPromo ? (
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-xs">
                    <div className="text-emerald-200">
                      <span className="font-mono font-bold text-emerald-300">
                        {appliedPromo.code}
                      </span>{' '}
                      — {appliedPromo.discountPercent}% fee discount applied
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAppliedPromo(null);
                        setPromoCodeInput('');
                      }}
                      className="p-1 rounded hover:bg-emerald-500/20 text-emerald-300"
                      title="Remove promo code"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={24}
                      value={promoCodeInput}
                      onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                      placeholder="e.g. ZEROFEE30"
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-950 text-white font-mono text-xs uppercase placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      disabled={validatingPromo || !promoCodeInput.trim()}
                      onClick={() => void handleApplyPromoCode()}
                      className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold inline-flex items-center gap-1 shrink-0"
                    >
                      {validatingPromo ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        'Apply'
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Fee & Net Payout Summary */}
            <div className="p-3.5 rounded-xl bg-slate-950/85 border border-slate-800 space-y-1.5 text-xs font-mono">
              <div className="flex items-center justify-between text-slate-400">
                <span>Requested Amount (Locked Hold)</span>
                <span className="text-slate-200 tabular-nums">${parsedAmount.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>
                  Withdrawal Fee ({feePercent}%{flatFeeUsd > 0 ? ` + $${flatFeeUsd.toFixed(2)}` : ''})
                </span>
                <span className="text-amber-300 tabular-nums">-${baseFeeUsd.toFixed(2)}</span>
              </div>
              {promoFeeSavingsUsd > 0 && appliedPromo && (
                <div className="flex items-center justify-between text-emerald-400">
                  <span>Voucher Savings ({appliedPromo.code})</span>
                  <span className="tabular-nums">+${promoFeeSavingsUsd.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1.5 border-t border-slate-800 font-bold text-sm">
                <span className="text-slate-200 font-sans text-xs">Net Payout to Wallet</span>
                <span className="text-emerald-400 tabular-nums">${computedNetPayoutUsd.toFixed(2)}</span>
              </div>
            </div>

            {/* Step 5: Mandatory Email OTP / 2FA Anti-Drain Verification */}
            {require2fa && (
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-sky-500/35 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>5. Email OTP / 2FA Security Check</span>
                  </div>
                  {isOtpVerifiedForCurrent ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-300">
                      <Lock className="w-3 h-3" />
                      Required
                    </span>
                  )}
                </div>

                {isOtpVerifiedForCurrent ? (
                  <p className="text-[11px] text-emerald-300/90 leading-relaxed">
                    2FA verified for ${parsedAmount.toFixed(2)} to{' '}
                    <span className="font-mono">{destinationAddress.trim().slice(0, 14)}...</span>.
                    Editing amount or address will require a fresh code.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        disabled={
                          otpSending ||
                          Boolean(platformConfig.withdrawalsPaused) ||
                          kycBlockedForWithdrawals
                        }
                        onClick={() => void handleSendOtp()}
                        className="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 shrink-0"
                      >
                        {otpSending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Mail className="w-3.5 h-3.5" />
                        )}
                        <span>{isOtpSentForCurrent ? 'Resend 2FA Code' : 'Send 6-Digit Email OTP'}</span>
                      </button>
                      <span className="text-[11px] text-slate-400 self-center">
                        {isOtpSentForCurrent && otpMaskedEmail
                          ? `Sent to ${otpMaskedEmail} (valid 5 min)`
                          : 'Bound to exact amount & destination wallet'}
                      </span>
                    </div>

                    {isOtpSentForCurrent && (
                      <div className="space-y-2 pt-1">
                        {otpPreviewCode && (
                          <div className="px-3 py-2 rounded-lg bg-amber-950/60 border border-amber-500/40 text-[11px] text-amber-200 flex items-center justify-between gap-2">
                            <span>Instant Preview 2FA Code (SMTP unconfigured):</span>
                            <strong className="font-mono text-sm tracking-widest text-amber-300">
                              {otpPreviewCode}
                            </strong>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={otpCodeInput}
                            onChange={(e) => setOtpCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="Enter 6-digit OTP"
                            className="flex-1 px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-white font-mono text-sm tracking-widest placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
                          />
                          <button
                            type="button"
                            disabled={otpVerifying || otpCodeInput.length !== 6}
                            onClick={() => void handleVerifyOtp()}
                            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shrink-0"
                          >
                            {otpVerifying ? 'Checking...' : 'Verify Code'}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={
                submitting ||
                busyAction ||
                enabledWithdrawMethods.length === 0 ||
                Boolean(platformConfig.withdrawalsPaused) ||
                kycBlockedForWithdrawals ||
                whitelistPolicyBlocked ||
                (require2fa && !isOtpVerifiedForCurrent)
              }
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors shadow-lg"
            >
              {submitting || busyAction ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Locking Funds &amp; Submitting...</span>
                </>
              ) : platformConfig.withdrawalsPaused ? (
                <span>Withdrawals Temporarily Paused</span>
              ) : require2fa && !isOtpVerifiedForCurrent ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Complete 2FA Verification to Submit</span>
                </>
              ) : (
                <>
                  <ArrowUpRight className="w-4 h-4" />
                  <span>
                    Request {payoutSource === 'mlm_commission' ? 'Commission' : 'Profit'} Payout
                  </span>
                </>
              )}
            </button>
            <p className="text-[11px] text-slate-400 text-center leading-relaxed">
              Anti-Drain Protection: Requested funds are held securely and require manual Super Admin approval before blockchain settlement.
            </p>
          </form>
        </div>

        {/* RIGHT 7 COLS: Payout Request Status Tracker (Pending vs Processed) */}
        <div className="xl:col-span-7 bg-[#0B111E]/82 backdrop-blur-md border border-slate-700/75 rounded-2xl p-6 space-y-5 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
            <div>
              <h3 className="font-display font-bold text-white text-lg">
                Payout Status Tracker
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Monitor Pending requests vs Processed payouts and settlement TXID references
              </p>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'all', label: 'All', count: summary.totalCount },
                  { id: 'pending', label: 'Pending', count: summary.pendingCount },
                  { id: 'processed', label: 'Processed', count: summary.processedCount },
                  { id: 'rejected', label: 'Rejected', count: summary.rejectedCount },
                ] as const
              ).map((tab) => {
                const active = statusTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusTab(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors tabular-nums ${
                      active
                        ? tab.id === 'pending'
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                          : tab.id === 'processed'
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                          : tab.id === 'rejected'
                          ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                          : 'bg-white/10 border-white/30 text-white'
                        : 'bg-slate-900/75 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {tab.label} ({tab.count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search & Source Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Request ID, wallet address, network, or TXID..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-700/80 bg-slate-900/90 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="inline-flex items-center gap-1.5 shrink-0">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
                className="px-3 py-2 rounded-xl border border-slate-700/80 bg-slate-900/90 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="all">All Sources</option>
                <option value="package_profit">Trading Profits</option>
                <option value="mlm_commission">Referral Commissions</option>
                <option value="elite_capital">Capital Unlock</option>
              </select>
            </div>
          </div>

          {/* Requests List */}
          {filteredWithdrawals.length === 0 ? (
            <div className="py-12 px-4 rounded-xl border border-dashed border-slate-800 bg-slate-900/40 text-center space-y-2">
              <Wallet className="w-8 h-8 text-slate-600 mx-auto" />
              <div className="text-sm font-semibold text-slate-200">
                {withdrawals.length === 0
                  ? 'No withdrawal requests yet'
                  : 'No payouts match your selected filter'}
              </div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {withdrawals.length === 0
                  ? 'Submit your first Trading Profit or Referral Commission payout on the left to track its status here.'
                  : 'Switch between Pending and Processed tabs or clear your search query.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
              {filteredWithdrawals.map((w) => {
                const processed = isProcessedStatus(w.status);
                const pending = w.status === 'pending';
                const rejected = w.status === 'rejected';
                const sourceMeta = getSourceMeta(w.source, w.type);

                return (
                  <div
                    key={w.id}
                    className={`p-4 rounded-xl border transition-colors space-y-3 ${
                      pending
                        ? 'border-amber-500/35 bg-amber-950/15'
                        : processed
                        ? 'border-emerald-500/25 bg-slate-900/70'
                        : 'border-rose-500/30 bg-rose-950/15'
                    }`}
                  >
                    {/* Top Row: Source, Status & Amount */}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded border text-[10px] font-semibold uppercase tracking-wide ${sourceMeta.badgeClass}`}
                          >
                            {sourceMeta.label}
                          </span>

                          {pending ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-amber-500/40 bg-amber-500/15 text-amber-300 text-[10px] font-bold uppercase">
                              <Clock className="w-3 h-3" />
                              Pending Review
                            </span>
                          ) : processed ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 text-[10px] font-bold uppercase">
                              <CheckCircle2 className="w-3 h-3" />
                              Processed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-rose-500/40 bg-rose-500/15 text-rose-300 text-[10px] font-bold uppercase">
                              <XCircle className="w-3 h-3" />
                              Rejected
                            </span>
                          )}
                          {w.twoFactorVerified && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-sky-500/35 bg-sky-500/10 text-sky-300 text-[10px] font-mono font-semibold">
                              <ShieldCheck className="w-3 h-3" />
                              2FA
                            </span>
                          )}
                        </div>

                        <div className="text-xs font-mono text-slate-400 flex flex-wrap items-center gap-2">
                          <span>ID: {w.id}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(`id-${w.id}`, w.id)}
                            className="text-slate-400 hover:text-white inline-flex items-center"
                            aria-label="Copy withdrawal request ID"
                          >
                            {copiedId === `id-${w.id}` ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                          <span>·</span>
                          <span>{formatTimestamp(w.createdAt)}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-mono font-extrabold text-lg text-white tabular-nums">
                          ${Number(w.amountUsd).toFixed(2)}
                        </div>
                        {typeof w.netPayoutUsd === 'number' && typeof w.feeUsd === 'number' && w.feeUsd > 0 && (
                          <div className="text-[10px] font-mono text-emerald-300 tabular-nums">
                            Net ${w.netPayoutUsd.toFixed(2)} (Fee ${w.feeUsd.toFixed(2)})
                          </div>
                        )}
                        <div className="text-[11px] font-mono text-slate-400">
                          {w.network.replace(/_/g, ' ')}
                        </div>
                      </div>
                    </div>

                    {/* Visual Settlement Progress Bar */}
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="flex items-center gap-1.5 text-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>1. Request Submitted</span>
                      </div>
                      <div
                        className={`flex items-center gap-1.5 ${
                          processed
                            ? 'text-emerald-300 font-semibold'
                            : pending
                            ? 'text-amber-300 font-semibold'
                            : 'text-rose-300 font-semibold'
                        }`}
                      >
                        {processed ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>2. Processed &amp; Paid</span>
                          </>
                        ) : pending ? (
                          <>
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            <span>2. Pending Settlement</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              2. Declined
                              {w.type !== 'manual_capital' ? ' (Balance Refunded)' : ''}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Destination & Settlement Reference Row */}
                    <div className="pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="min-w-0 flex items-center gap-2 font-mono text-slate-300 truncate">
                        <span className="text-slate-500">To:</span>
                        <span className="truncate">{w.destinationAddress}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(`addr-${w.id}`, w.destinationAddress)}
                          className="text-slate-400 hover:text-white shrink-0"
                          aria-label="Copy destination wallet"
                        >
                          {copiedId === `addr-${w.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      {w.type === 'manual_capital' && (
                        <button
                          type="button"
                          onClick={() => onInspectBreakdown(w)}
                          className="text-xs font-semibold text-orange-400 hover:text-orange-300 underline shrink-0"
                        >
                          Package #{w.packageNumber} Breakdown
                        </button>
                      )}
                    </div>

                    {w.payoutTxHash && (
                      <div className="p-2.5 rounded-lg bg-emerald-950/35 border border-emerald-500/30 text-[11px] text-emerald-200 flex flex-wrap items-center justify-between gap-2">
                        <span className="min-w-0 break-all">
                          <strong className="text-emerald-400">Payout TxHash:</strong>{' '}
                          <span className="font-mono text-white">{w.payoutTxHash}</span>
                        </span>
                        <div className="inline-flex items-center gap-2 shrink-0">
                          {w.payoutTxHash.startsWith('0x') && (
                            <a
                              href={
                                w.network.includes('POLYGON')
                                  ? `https://polygonscan.com/tx/${w.payoutTxHash}`
                                  : `https://bscscan.com/tx/${w.payoutTxHash}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sky-300 hover:underline inline-flex items-center gap-1"
                            >
                              <span>Explorer</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => handleCopy(`tx-${w.id}`, w.payoutTxHash || '')}
                            className="text-emerald-300 hover:text-white inline-flex items-center gap-1"
                          >
                            {copiedId === `tx-${w.id}` ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span>{copiedId === `tx-${w.id}` ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {w.adminNote && (
                      <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] text-slate-300 flex flex-wrap items-center justify-between gap-2">
                        <span className="min-w-0 break-all">
                          <strong className="text-slate-400">
                            {rejected ? 'Reason:' : 'Settlement TXID / Note:'}
                          </strong>{' '}
                          <span className="font-mono text-slate-200">{w.adminNote}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(`note-${w.id}`, w.adminNote)}
                          className="text-slate-400 hover:text-white inline-flex items-center gap-1 shrink-0"
                        >
                          {copiedId === `note-${w.id}` ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
