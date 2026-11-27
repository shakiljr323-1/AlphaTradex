import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Award,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Lock,
  Search,
  ShieldCheck,
  Tag,
  Unlock,
  Wallet,
  XCircle,
} from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { CryptoNetwork } from '../types/platform';
import { formatTimestamp } from '../utils/investmentMath';

interface PayoutManagementProps {
  onSwitchToClientVault: () => void;
  onNotify?: (type: 'ok' | 'err', text: string) => void;
}

type PayoutSourceOption = 'mentor_profit' | 'mlm_commission';
type CommissionFilter = 'all' | 'mentor' | 'level1' | 'level2' | 'level3';
type SettlementFilter = 'all' | 'pending' | 'processed' | 'rejected';

function formatUsd(val: number): string {
  return `$${(Number(val) || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const PayoutManagement: React.FC<PayoutManagementProps> = ({
  onSwitchToClientVault,
  onNotify,
}) => {
  const {
    userProfile,
    platformConfig,
    mlmCommissions,
    withdrawals,
    savedPaymentMethods,
    whitelistedWallets,
    withdrawInstantProfit,
    addUserPaymentMethod,
  } = usePlatform();

  // Settlement withdrawal request form state
  const enabledWithdrawMethods = useMemo(
    () => (platformConfig.paymentMethods || []).filter((m) => m.enabled && m.allowWithdrawal),
    [platformConfig.paymentMethods]
  );

  const [payoutSource, setPayoutSource] = useState<PayoutSourceOption>('mentor_profit');
  const [wdNetwork, setWdNetwork] = useState<CryptoNetwork>(
    () => enabledWithdrawMethods[0]?.id || 'USDT_TRC20'
  );
  const [wdAmount, setWdAmount] = useState('25');
  const [wdAddress, setWdAddress] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [saveMethodAfter, setSaveMethodAfter] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localBanner, setLocalBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Commission tracker filters
  const [commFilter, setCommFilter] = useState<CommissionFilter>('all');
  const [commSearch, setCommSearch] = useState('');

  // Settlement tracker filters
  const [settlementFilter, setSettlementFilter] = useState<SettlementFilter>('all');
  const [settlementSearch, setSettlementSearch] = useState('');
  const [copiedKey, setCopiedKey] = useState('');

  const activeNetworkId = enabledWithdrawMethods.some((m) => m.id === wdNetwork)
    ? wdNetwork
    : enabledWithdrawMethods[0]?.id || 'USDT_TRC20';

  const selectedMethod =
    enabledWithdrawMethods.find((m) => m.id === activeNetworkId) || enabledWithdrawMethods[0];

  const minWithdrawUsd = Math.max(
    Number(platformConfig.minWithdrawalUsd || 10),
    Number(selectedMethod?.minWithdrawalUsd || 0)
  );

  const feePercent = Math.max(
    0,
    Math.min(15, Number(platformConfig.web3PaymentConfig?.withdrawalFeePercent || 0))
  );

  // Live Mentor earnings, commissions, volume unlock, and settlement totals
  const summary = useMemo(() => {
    const availableBalance = Number(userProfile?.profitBalance || 0);
    const mentorGifted = Number(userProfile?.mentorGiftedCapital || 0);
    const mentorRequired = Number(userProfile?.mentorRequiredVolume || 0);
    const mentorBrought = Number(userProfile?.mentorBroughtVolume || 0);
    const mentorRemaining = Math.max(0, mentorRequired - mentorBrought);
    const isVolumeUnlocked = mentorGifted <= 0 || mentorBrought >= mentorRequired;
    const volumeProgressPct =
      mentorRequired > 0 ? Math.min(100, (mentorBrought / mentorRequired) * 100) : 100;

    let mentorOverrideUsd = 0;
    let level1Usd = 0;
    let level2Usd = 0;
    let level3Usd = 0;
    let totalCommissionsUsd = 0;

    for (const c of mlmCommissions) {
      const amt = Number(c.commissionUsd || 0);
      totalCommissionsUsd += amt;
      if (c.commissionType === 'mentor') {
        mentorOverrideUsd += amt;
      } else if (c.level === 1) {
        level1Usd += amt;
      } else if (c.level === 2) {
        level2Usd += amt;
      } else if (c.level === 3) {
        level3Usd += amt;
      }
    }

    const pendingRows = withdrawals.filter((w) => w.status === 'pending');
    const processedRows = withdrawals.filter(
      (w) => w.status === 'approved' || w.status === 'completed'
    );
    const pendingUsd = pendingRows.reduce((s, w) => s + Number(w.amountUsd || 0), 0);
    const processedUsd = processedRows.reduce((s, w) => s + Number(w.amountUsd || 0), 0);

    return {
      availableBalance,
      mentorRequired,
      mentorBrought,
      mentorRemaining,
      isVolumeUnlocked,
      volumeProgressPct,
      mentorOverrideUsd,
      level1Usd,
      level2Usd,
      level3Usd,
      totalCommissionsUsd,
      pendingCount: pendingRows.length,
      pendingUsd,
      processedCount: processedRows.length,
      processedUsd,
    };
  }, [userProfile, mlmCommissions, withdrawals]);

  const parsedAmount = Math.max(0, Number(wdAmount) || 0);
  const estimatedFeeUsd = Number(((parsedAmount * feePercent) / 100).toFixed(2));
  const estimatedNetUsd = Math.max(0, Number((parsedAmount - estimatedFeeUsd).toFixed(2)));

  const kycBlocked =
    Boolean(platformConfig.kycSettings?.enabled) &&
    Boolean(platformConfig.kycSettings?.requireKycForWithdrawals) &&
    userProfile?.kycStatus !== 'approved';

  const filteredCommissions = useMemo(() => {
    const q = commSearch.trim().toLowerCase();
    return mlmCommissions.filter((c) => {
      if (commFilter === 'mentor' && c.commissionType !== 'mentor') return false;
      if (commFilter === 'level1' && (c.commissionType === 'mentor' || c.level !== 1)) return false;
      if (commFilter === 'level2' && (c.commissionType === 'mentor' || c.level !== 2)) return false;
      if (commFilter === 'level3' && (c.commissionType === 'mentor' || c.level !== 3)) return false;
      if (!q) return true;
      return (
        c.fromName.toLowerCase().includes(q) ||
        (c.commissionType === 'mentor' ? 'mentor override' : `level ${c.level}`).includes(q)
      );
    });
  }, [mlmCommissions, commFilter, commSearch]);

  const filteredWithdrawals = useMemo(() => {
    const q = settlementSearch.trim().toLowerCase();
    return withdrawals.filter((w) => {
      if (settlementFilter === 'pending' && w.status !== 'pending') return false;
      if (
        settlementFilter === 'processed' &&
        w.status !== 'approved' &&
        w.status !== 'completed'
      ) {
        return false;
      }
      if (settlementFilter === 'rejected' && w.status !== 'rejected') return false;
      if (!q) return true;
      return (
        w.id.toLowerCase().includes(q) ||
        w.network.toLowerCase().includes(q) ||
        w.destinationAddress.toLowerCase().includes(q) ||
        (w.adminNote || '').toLowerCase().includes(q)
      );
    });
  }, [withdrawals, settlementFilter, settlementSearch]);

  const emitFeedback = (type: 'ok' | 'err', text: string) => {
    setLocalBanner({ type, text });
    onNotify?.(type, text);
  };

  const copyValue = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? '' : prev));
      }, 1800);
    } catch {
      emitFeedback('err', 'Clipboard access is unavailable in this browser.');
    }
  };

  const handleSubmitSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;

    const amt = Number(wdAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      emitFeedback('err', 'Enter a valid withdrawal amount in USD.');
      return;
    }
    if (amt < minWithdrawUsd) {
      emitFeedback('err', `Minimum withdrawal for this channel is ${formatUsd(minWithdrawUsd)}.`);
      return;
    }
    if (amt > summary.availableBalance) {
      emitFeedback(
        'err',
        `Requested amount exceeds your available Income Vault balance (${formatUsd(summary.availableBalance)}).`
      );
      return;
    }
    const cleanAddr = wdAddress.trim();
    if (!cleanAddr) {
      emitFeedback('err', 'Enter your receiving payout wallet address or account.');
      return;
    }

    setSubmitting(true);
    setLocalBanner(null);
    try {
      await withdrawInstantProfit({
        amountUsd: amt,
        network: activeNetworkId,
        destinationAddress: cleanAddr,
        source: payoutSource,
        settlementMode: 'pending',
        promoCode: promoCode.trim() ? promoCode.trim().toUpperCase() : undefined,
      });

      if (
        saveMethodAfter &&
        !savedPaymentMethods.some(
          (pm) => pm.methodId === activeNetworkId && pm.accountAddress === cleanAddr
        )
      ) {
        const methodName = selectedMethod?.name || activeNetworkId;
        await addUserPaymentMethod({
          label: `${methodName} Mentor Payout`,
          methodId: activeNetworkId,
          methodName,
          accountAddress: cleanAddr,
          accountHolder: userProfile.fullName,
          isDefault: savedPaymentMethods.length === 0,
        });
      }

      setWdAddress('');
      setPromoCode('');
      setSaveMethodAfter(false);
      emitFeedback(
        'ok',
        `Withdrawal request of ${formatUsd(amt)} (${
          payoutSource === 'mlm_commission' ? 'Referral Commission' : 'Mentor Profit'
        }) submitted to the Vault Settlement Queue.`
      );
    } catch (err) {
      emitFeedback(
        'err',
        err instanceof Error ? err.message : 'Unable to submit settlement withdrawal request.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!userProfile) return null;

  const mentorRatePct = platformConfig.mentorConfig?.enabled
    ? platformConfig.mentorConfig.mentorCommissionPercent
    : 0;

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-slate-800/80">
        <div>
          <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-amber-400" />
            <span>Payout Management &amp; Commission Settlement</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Track earned Mentor Override and L1–L3 referral commissions and trigger withdrawal requests directly through the vault settlement system.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 text-xs font-medium">
          {summary.isVolumeUnlocked ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/10 text-emerald-300">
              <Unlock className="w-3.5 h-3.5" />
              <span>Settlement Unlocked</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/35 bg-amber-500/10 text-amber-300">
              <Lock className="w-3.5 h-3.5" />
              <span>Volume Unlock: {summary.volumeProgressPct.toFixed(0)}%</span>
            </span>
          )}
        </div>
      </div>

      {localBanner && (
        <div
          role="status"
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
            localBanner.type === 'ok'
              ? 'border-emerald-700/70 bg-emerald-950/60 text-emerald-200'
              : 'border-red-700/70 bg-red-950/60 text-red-200'
          }`}
        >
          {localBanner.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{localBanner.text}</span>
        </div>
      )}

      {/* 4-Column Financial KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-[#0B111E] border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="text-xs text-slate-400">Available Income Vault</div>
          <div className="font-mono font-bold text-2xl text-emerald-400 tabular-nums">
            {formatUsd(summary.availableBalance)}
          </div>
          <div className="text-[11px] text-slate-400">
            Ready for vault settlement payout
          </div>
        </div>

        <div className="bg-[#0B111E] border border-amber-500/30 rounded-xl p-4 space-y-1">
          <div className="text-xs text-amber-300">Earned Commissions ({mlmCommissions.length})</div>
          <div className="font-mono font-bold text-2xl text-amber-400 tabular-nums">
            {formatUsd(summary.totalCommissionsUsd)}
          </div>
          <div className="text-[11px] text-slate-400 font-mono tabular-nums">
            Override {formatUsd(summary.mentorOverrideUsd)} · L1–L3{' '}
            {formatUsd(summary.level1Usd + summary.level2Usd + summary.level3Usd)}
          </div>
        </div>

        <div className="bg-[#0B111E] border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="text-xs text-slate-400">Pending Vault Settlements</div>
          <div className="font-mono font-bold text-2xl text-white tabular-nums">
            {formatUsd(summary.pendingUsd)}
          </div>
          <div className="text-[11px] text-amber-300 font-mono tabular-nums">
            {summary.pendingCount} request{summary.pendingCount === 1 ? '' : 's'} in review
          </div>
        </div>

        <div className="bg-[#0B111E] border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="text-xs text-slate-400">Settled Lifetime Payouts</div>
          <div className="font-mono font-bold text-2xl text-sky-400 tabular-nums">
            {formatUsd(summary.processedUsd)}
          </div>
          <div className="text-[11px] text-slate-400 font-mono tabular-nums">
            {summary.processedCount} completed payout{summary.processedCount === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {/* Main Two-Column Grid: Vault Withdrawal Form + Settlement Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT: Trigger Withdrawal via Vault Settlement System */}
        <div className="lg:col-span-5 bg-[#0B111E] border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display font-semibold text-base text-white">
              Trigger Vault Withdrawal
            </h3>
            <span className="text-[11px] font-mono text-slate-400">
              Fee: {feePercent.toFixed(1)}%
            </span>
          </div>

          {!summary.isVolumeUnlocked && (
            <div className="p-3.5 rounded-lg border border-amber-700/60 bg-amber-950/40 text-xs text-amber-200 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Mentor Volume Unlock Active</span>
              </div>
              <p className="text-amber-200/85 leading-relaxed">
                Bring{' '}
                <strong className="font-mono text-white">
                  {formatUsd(summary.mentorRemaining)}
                </strong>{' '}
                more in Direct L1 volume ({formatUsd(summary.mentorBrought)} /{' '}
                {formatUsd(summary.mentorRequired)}) to unlock vault settlement payouts.
              </p>
            </div>
          )}

          {platformConfig.withdrawalsPaused && (
            <div className="p-3.5 rounded-lg border border-red-700/60 bg-red-950/40 text-xs text-red-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>Withdrawals are temporarily paused by administration.</span>
            </div>
          )}

          {kycBlocked && (
            <div className="p-3.5 rounded-lg border border-amber-700/60 bg-amber-950/40 text-xs text-amber-200 flex items-center justify-between gap-2">
              <span>KYC verification is required before triggering payouts.</span>
              <button
                type="button"
                onClick={onSwitchToClientVault}
                className="underline font-semibold text-amber-300 shrink-0"
              >
                Verify in Vault
              </button>
            </div>
          )}

          {/* Quick-Select Saved & Whitelisted Destinations */}
          {(savedPaymentMethods.length > 0 || whitelistedWallets.length > 0) && (
            <div className="space-y-1.5">
              <div className="text-[11px] text-slate-400">
                Quick-Fill Saved / Whitelisted Wallets
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
                    className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-900 hover:border-amber-500/60 text-[11px] text-slate-200 transition-colors"
                  >
                    {pm.label}
                  </button>
                ))}
                {whitelistedWallets.map((wl) => (
                  <button
                    key={wl.id}
                    type="button"
                    onClick={() => {
                      const mappedMethod = enabledWithdrawMethods.find((m) =>
                        m.id.toUpperCase().includes(wl.network.toUpperCase())
                      );
                      if (mappedMethod) setWdNetwork(mappedMethod.id);
                      setWdAddress(wl.address);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-500/35 bg-emerald-500/10 hover:bg-emerald-500/20 text-[11px] text-emerald-300 transition-colors"
                  >
                    <ShieldCheck className="w-3 h-3" />
                    <span>{wl.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmitSettlement} className="space-y-4">
            {/* Payout Source Toggle */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Earnings Source
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPayoutSource('mentor_profit')}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                    payoutSource === 'mentor_profit'
                      ? 'border-amber-500 bg-amber-500/15 text-amber-200'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  Mentor Profit
                </button>
                <button
                  type="button"
                  onClick={() => setPayoutSource('mlm_commission')}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                    payoutSource === 'mlm_commission'
                      ? 'border-emerald-500 bg-emerald-500/15 text-emerald-200'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  Commission Payout
                </button>
              </div>
            </div>

            {/* Payout Channel */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Settlement Channel
              </label>
              <select
                value={activeNetworkId}
                onChange={(e) => setWdNetwork(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-700 bg-slate-900 text-white text-xs focus:outline-none focus:border-amber-500"
              >
                {enabledWithdrawMethods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} (Min $
                    {Math.max(platformConfig.minWithdrawalUsd, m.minWithdrawalUsd || 0)})
                  </option>
                ))}
              </select>
            </div>

            {/* Amount + Percentage Presets */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-300">Amount (USD)</label>
                <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                  Min {formatUsd(minWithdrawUsd)} · Avail {formatUsd(summary.availableBalance)}
                </span>
              </div>
              <input
                type="number"
                step="0.01"
                min={minWithdrawUsd}
                required
                value={wdAmount}
                onChange={(e) => setWdAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-900 text-white font-mono text-sm tabular-nums focus:outline-none focus:border-amber-500"
              />
              <div className="grid grid-cols-4 gap-1.5 mt-2">
                {[
                  { label: '25%', mult: 0.25 },
                  { label: '50%', mult: 0.5 },
                  { label: '75%', mult: 0.75 },
                  { label: 'MAX', mult: 1 },
                ].map((pct) => (
                  <button
                    key={pct.label}
                    type="button"
                    onClick={() =>
                      setWdAmount(Math.max(0, summary.availableBalance * pct.mult).toFixed(2))
                    }
                    className="py-1.5 rounded-md border border-slate-800 bg-slate-900 hover:bg-slate-800 text-[11px] font-mono text-slate-300 hover:text-white transition-colors"
                  >
                    {pct.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Destination Wallet */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Destination Wallet / Account
              </label>
              <input
                type="text"
                required
                value={wdAddress}
                onChange={(e) => setWdAddress(e.target.value)}
                placeholder={`Enter receiving ${selectedMethod?.name || 'payout'} address`}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-900 text-white font-mono text-xs placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Optional Fee-Waiver Voucher Code */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-400" />
                <span>Fee-Waiver Voucher Code (Optional)</span>
              </label>
              <input
                type="text"
                maxLength={32}
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="e.g. MENTORZERO"
                className="w-full px-3.5 py-2 rounded-lg border border-slate-800 bg-slate-900 text-amber-300 font-mono text-xs uppercase placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Live Settlement Preview Box */}
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 space-y-1.5 text-xs font-mono tabular-nums">
              <div className="flex items-center justify-between text-slate-400">
                <span className="font-sans">Gross Withdrawal</span>
                <span className="text-white">{formatUsd(parsedAmount)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span className="font-sans">Est. Settlement Fee ({feePercent.toFixed(1)}%)</span>
                <span>{promoCode.trim() ? 'Voucher applied at submit' : `-${formatUsd(estimatedFeeUsd)}`}</span>
              </div>
              <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between font-semibold">
                <span className="font-sans text-slate-200">Est. Net Settlement</span>
                <span className="text-emerald-400">{formatUsd(estimatedNetUsd)}</span>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={saveMethodAfter}
                onChange={(e) => setSaveMethodAfter(e.target.checked)}
              />
              <span>Save payout destination to vault accounts</span>
            </label>

            <button
              type="submit"
              disabled={
                submitting ||
                !summary.isVolumeUnlocked ||
                Boolean(platformConfig.withdrawalsPaused) ||
                kycBlocked ||
                enabledWithdrawMethods.length === 0
              }
              className="w-full py-2.5 px-4 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <span>
                {submitting
                  ? 'Routing to Vault Settlement...'
                  : !summary.isVolumeUnlocked
                  ? 'Unlock Volume Target to Withdraw'
                  : 'Submit Settlement Withdrawal'}
              </span>
              {!submitting && summary.isVolumeUnlocked && <ArrowUpRight className="w-3.5 h-3.5" />}
            </button>
          </form>
        </div>

        {/* RIGHT: Vault Settlement Queue & History */}
        <div className="lg:col-span-7 bg-[#0B111E] border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="font-display font-semibold text-base text-white">
              Vault Settlement Queue ({filteredWithdrawals.length})
            </h3>
            <div className="inline-flex items-center p-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'pending', label: 'Pending' },
                  { id: 'processed', label: 'Processed' },
                  { id: 'rejected', label: 'Rejected' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSettlementFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
                    settlementFilter === tab.id
                      ? 'bg-amber-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={settlementSearch}
              onChange={(e) => setSettlementSearch(e.target.value)}
              placeholder="Filter by request ID, wallet, channel, or TXID..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-800 bg-slate-900 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {filteredWithdrawals.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              No vault settlement requests match this filter.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80 max-h-[540px] overflow-y-auto pr-1">
              {filteredWithdrawals.map((w) => {
                const isProcessed = w.status === 'approved' || w.status === 'completed';
                const isRejected = w.status === 'rejected';
                const sourceLabel =
                  w.source === 'mentor_profit'
                    ? 'Mentor Profit'
                    : w.source === 'mlm_commission'
                    ? 'Referral Commission'
                    : w.source === 'elite_capital'
                    ? 'Capital Unlock'
                    : 'Trading Profit';
                return (
                  <div key={w.id} className="py-3.5 first:pt-0 last:pb-0 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-semibold text-white tabular-nums text-sm">
                          {formatUsd(w.amountUsd)}
                        </span>
                        <span className="text-slate-500">·</span>
                        <span className="text-slate-300">{sourceLabel}</span>
                        <span className="text-slate-500">·</span>
                        <span className="font-mono text-slate-400">
                          {w.network.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 font-semibold ${
                          isProcessed
                            ? 'text-emerald-400'
                            : isRejected
                            ? 'text-red-400'
                            : 'text-amber-300'
                        }`}
                      >
                        {isProcessed ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : isRejected ? (
                          <XCircle className="w-3.5 h-3.5" />
                        ) : (
                          <Clock className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {isProcessed
                            ? 'Processed'
                            : isRejected
                            ? 'Rejected (Refunded)'
                            : 'Pending Settlement'}
                        </span>
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 font-mono">
                      <span className="truncate max-w-xs">To: {w.destinationAddress}</span>
                      <span className="tabular-nums">{formatTimestamp(w.createdAt)}</span>
                    </div>

                    {w.adminNote && (
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-300 bg-slate-900/70 px-3 py-1.5 rounded-lg border border-slate-800">
                        <span className="truncate font-mono">Settlement Ref: {w.adminNote}</span>
                        <button
                          type="button"
                          onClick={() => copyValue(`tx-${w.id}`, w.adminNote)}
                          className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 shrink-0"
                        >
                          {copiedKey === `tx-${w.id}` ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>{copiedKey === `tx-${w.id}` ? 'Copied' : 'Copy'}</span>
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

      {/* Integrated Earned Commissions Tracker */}
      <div className="bg-[#0B111E] border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="font-display font-semibold text-base text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <span>Earned Commissions Tracker ({filteredCommissions.length})</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live ledger of Mentor Override (+{mentorRatePct}%) and 3-tier referral commissions credited into your withdrawable Income Vault.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex flex-wrap items-center p-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'mentor', label: 'Override' },
                  { id: 'level1', label: 'L1' },
                  { id: 'level2', label: 'L2' },
                  { id: 'level3', label: 'L3' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setCommFilter(opt.id)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
                    commFilter === opt.id
                      ? 'bg-amber-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={commSearch}
                onChange={(e) => setCommSearch(e.target.value)}
                placeholder="Search investor..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Per-Tier Commission Summary Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="rounded-lg border border-amber-500/25 bg-slate-950/60 px-3.5 py-2.5 flex items-center justify-between">
            <span className="text-amber-300">Mentor Override</span>
            <span className="font-mono font-bold text-amber-400 tabular-nums">
              {formatUsd(summary.mentorOverrideUsd)}
            </span>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3.5 py-2.5 flex items-center justify-between">
            <span className="text-slate-400">L1 ({platformConfig.mlmRates.level1}%)</span>
            <span className="font-mono font-bold text-emerald-400 tabular-nums">
              {formatUsd(summary.level1Usd)}
            </span>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3.5 py-2.5 flex items-center justify-between">
            <span className="text-slate-400">L2 ({platformConfig.mlmRates.level2}%)</span>
            <span className="font-mono font-bold text-sky-400 tabular-nums">
              {formatUsd(summary.level2Usd)}
            </span>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3.5 py-2.5 flex items-center justify-between">
            <span className="text-slate-400">L3 ({platformConfig.mlmRates.level3}%)</span>
            <span className="font-mono font-bold text-slate-200 tabular-nums">
              {formatUsd(summary.level3Usd)}
            </span>
          </div>
        </div>

        {filteredCommissions.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No commission credits match your filter yet. Commissions credit automatically whenever your referred investors fund trading packages.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Commission Type</th>
                  <th className="py-2.5 px-4 font-medium">From Investor</th>
                  <th className="py-2.5 px-4 font-medium text-right">Package Volume</th>
                  <th className="py-2.5 px-4 font-medium text-right">Rate</th>
                  <th className="py-2.5 px-4 font-medium">Date</th>
                  <th className="py-2.5 px-4 font-medium text-right">Credited</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredCommissions.slice(0, 25).map((c) => (
                  <tr key={c.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3 px-4 font-medium">
                      <span
                        className={
                          c.commissionType === 'mentor' ? 'text-amber-300' : 'text-slate-200'
                        }
                      >
                        {c.commissionType === 'mentor'
                          ? 'Mentor Override Bonus'
                          : `Level ${c.level} Referral`}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-white">{c.fromName}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-300 tabular-nums">
                      {formatUsd(c.investmentAmount)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-300 tabular-nums">
                      {c.ratePercent}%
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 tabular-nums">
                      {formatTimestamp(c.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-400 tabular-nums">
                      +{formatUsd(c.commissionUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
