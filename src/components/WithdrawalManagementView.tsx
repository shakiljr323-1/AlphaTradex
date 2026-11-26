import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Award,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Filter,
  Loader2,
  Search,
  ShieldCheck,
  Star,
  TrendingUp,
  Wallet,
  XCircle,
} from 'lucide-react';
import {
  Investment,
  MlmCommission,
  PlatformConfig,
  UserPaymentMethod,
  UserProfile,
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
  onRequestPayout: (params: {
    amountUsd: number;
    network: string;
    destinationAddress: string;
    source: 'package_profit' | 'mlm_commission' | 'mentor_profit';
    savePaymentMethod: boolean;
    methodName: string;
  }) => Promise<void>;
  onOpenPaymentMethods: () => void;
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
  busyAction,
  onRequestPayout,
  onOpenPaymentMethods,
  onOpenCapitalWithdraw,
  onInspectBreakdown,
  onNotify,
}) => {
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
    String(Math.max(platformConfig.minWithdrawalUsd || 10, 10))
  );
  const [destinationAddress, setDestinationAddress] = useState<string>(
    defaultPm?.accountAddress || ''
  );
  const [savePaymentMethod, setSavePaymentMethod] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

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
    Number(selectedMethod?.minWithdrawalUsd) || 0
  );

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

  const kycBlockedForWithdrawals =
    Boolean(platformConfig.kycSettings?.requireKycForWithdrawals) &&
    userProfile.kycStatus !== 'approved';

  const handleCopy = (key: string, val: string) => {
    navigator.clipboard?.writeText(val).catch(() => {});
    setCopiedId(key);
    window.setTimeout(() => setCopiedId(''), 1600);
  };

  const applyQuickPercent = (pct: number) => {
    const raw = (userProfile.profitBalance * pct) / 100;
    const rounded = Math.floor(raw * 100) / 100;
    setAmountInput(rounded > 0 ? rounded.toFixed(2) : String(effectiveMinUsd));
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
    if (amt > userProfile.profitBalance) {
      onNotify('err', 'Insufficient withdrawable balance in your Income Wallet.');
      return;
    }
    if (!destinationAddress.trim()) {
      onNotify('err', 'Enter a valid destination wallet address or payout account.');
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
      });
      setSavePaymentMethod(false);
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
              <h3 className="font-display font-bold text-white text-lg">Request New Payout</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Min ${effectiveMinUsd.toFixed(2)} · Funds reserve immediately &amp; move to Pending
                Review
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-md border border-emerald-500/35 bg-emerald-500/10 text-[11px] font-mono font-semibold text-emerald-300 shrink-0">
              0% Platform Fee
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

            <button
              type="submit"
              disabled={
                submitting ||
                busyAction ||
                enabledWithdrawMethods.length === 0 ||
                Boolean(platformConfig.withdrawalsPaused) ||
                kycBlockedForWithdrawals
              }
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors shadow-lg"
            >
              {submitting || busyAction ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting Payout Request...</span>
                </>
              ) : platformConfig.withdrawalsPaused ? (
                <span>Withdrawals Temporarily Paused</span>
              ) : (
                <>
                  <ArrowUpRight className="w-4 h-4" />
                  <span>
                    Request {payoutSource === 'mlm_commission' ? 'Commission' : 'Profit'} Payout
                  </span>
                </>
              )}
            </button>
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
