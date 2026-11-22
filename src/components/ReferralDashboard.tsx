import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Award,
  Check,
  Copy,
  MousePointerClick,
  Network,
  Search,
  Share2,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  MlmCommission,
  PlatformConfig,
  ReferralLinkRecord,
  UserProfile,
} from '../types/platform';
import { formatTimestamp } from '../utils/investmentMath';

interface ReferralDashboardProps {
  userProfile: UserProfile;
  platformConfig: PlatformConfig;
  referralLink: string;
  referralLinkClicks: number;
  downlineReferrals: ReferralLinkRecord[];
  mlmCommissions: MlmCommission[];
  copiedText: string;
  onCopyValue: (label: string, val: string) => void;
  onOpenWithdraw?: () => void;
}

export const ReferralDashboard: React.FC<ReferralDashboardProps> = ({
  userProfile,
  platformConfig,
  referralLink,
  referralLinkClicks,
  downlineReferrals,
  mlmCommissions,
  copiedText,
  onCopyValue,
  onOpenWithdraw,
}) => {
  const [levelFilter, setLevelFilter] = useState<'all' | 1 | 2 | 3>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const metrics = useMemo(() => {
    const directSignups = downlineReferrals.filter((r) => r.level === 1);
    const networkSignups = downlineReferrals.filter((r) => r.level > 1);
    const fundedSignups = downlineReferrals.filter((r) => (r.totalInvestedUsd || 0) > 0);
    const totalReferralVolume = downlineReferrals.reduce(
      (acc, r) => acc + (r.totalInvestedUsd || 0),
      0
    );

    const effectiveClicks = Math.max(referralLinkClicks, 0);
    const conversionRate =
      effectiveClicks > 0
        ? Math.min(100, (downlineReferrals.length / effectiveClicks) * 100)
        : downlineReferrals.length > 0
        ? 100
        : 0;
    const fundingRate =
      downlineReferrals.length > 0
        ? (fundedSignups.length / downlineReferrals.length) * 100
        : 0;

    let totalEarnedUsd = 0;
    let level1Earned = 0;
    let level2Earned = 0;
    let level3Earned = 0;
    let mentorEarned = 0;

    for (const c of mlmCommissions) {
      totalEarnedUsd += c.commissionUsd || 0;
      if (c.commissionType === 'mentor') {
        mentorEarned += c.commissionUsd || 0;
      } else if (c.level === 1) {
        level1Earned += c.commissionUsd || 0;
      } else if (c.level === 2) {
        level2Earned += c.commissionUsd || 0;
      } else if (c.level === 3) {
        level3Earned += c.commissionUsd || 0;
      }
    }

    return {
      directSignups,
      networkSignups,
      fundedSignups,
      totalReferralVolume,
      effectiveClicks,
      conversionRate,
      fundingRate,
      totalEarnedUsd,
      level1Earned,
      level2Earned,
      level3Earned,
      mentorEarned,
    };
  }, [downlineReferrals, mlmCommissions, referralLinkClicks]);

  const filteredReferrals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return downlineReferrals.filter((r) => {
      if (levelFilter !== 'all' && r.level !== levelFilter) return false;
      if (!q) return true;
      return (
        r.refereeName.toLowerCase().includes(q) ||
        r.refereeHandle.toLowerCase().includes(q)
      );
    });
  }, [downlineReferrals, levelFilter, searchQuery]);

  const funnelBase = Math.max(metrics.effectiveClicks, downlineReferrals.length, 1);

  return (
    <section className="space-y-6">
      {/* Header & Referral Share Toolkit */}
      <div className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/35 text-orange-400 flex items-center justify-center shrink-0">
                <Network className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display font-bold text-white text-xl leading-tight">
                  Referral Dashboard
                </h2>
                <p className="text-xs text-slate-400">
                  Real-time tracking of your referral link clicks, verified sign-ups, and multi-tier commissions.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700/80 text-xs font-mono text-slate-200">
              Code: <span className="text-orange-400 font-bold">{userProfile.handle}</span>
            </span>
            <button
              type="button"
              onClick={() => onCopyValue('refcode', userProfile.handle)}
              className="px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5 transition"
            >
              {copiedText === 'refcode' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-400" />
              )}
              {copiedText === 'refcode' ? 'Code Copied' : 'Copy Code'}
            </button>
            <button
              type="button"
              onClick={() => onCopyValue('reflink', referralLink)}
              className="px-3.5 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 transition shadow-lg shadow-orange-500/20"
            >
              {copiedText === 'reflink' ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Share2 className="w-3.5 h-3.5" />
              )}
              {copiedText === 'reflink' ? 'Link Copied' : 'Copy Referral Link'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
          <div className="lg:col-span-7 px-3.5 py-2.5 rounded-xl bg-slate-900/85 border border-slate-700/70 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                Active Tracking URL
              </div>
              <div className="font-mono text-xs text-slate-100 truncate">{referralLink}</div>
            </div>
            <button
              type="button"
              onClick={() => onCopyValue('reflink', referralLink)}
              className="shrink-0 text-xs font-semibold text-orange-400 hover:text-orange-300 inline-flex items-center gap-1"
            >
              {copiedText === 'reflink' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedText === 'reflink' ? 'Copied' : 'Copy'}
            </button>
          </div>

          <div className="lg:col-span-5 grid grid-cols-3 sm:grid-cols-4 gap-2">
            <div className="px-3 py-2 rounded-xl bg-slate-900/75 border border-slate-700/70 text-center">
              <div className="text-[11px] text-slate-400">Level 1</div>
              <div className="font-mono font-bold text-sm text-emerald-400 tabular-nums">
                {platformConfig.mlmRates.level1}%
              </div>
            </div>
            <div className="px-3 py-2 rounded-xl bg-slate-900/75 border border-slate-700/70 text-center">
              <div className="text-[11px] text-slate-400">Level 2</div>
              <div className="font-mono font-bold text-sm text-sky-400 tabular-nums">
                {platformConfig.mlmRates.level2}%
              </div>
            </div>
            <div className="px-3 py-2 rounded-xl bg-slate-900/75 border border-slate-700/70 text-center">
              <div className="text-[11px] text-slate-400">Level 3</div>
              <div className="font-mono font-bold text-sm text-amber-400 tabular-nums">
                {platformConfig.mlmRates.level3}%
              </div>
            </div>
            <div className="px-3 py-2 rounded-xl bg-slate-900/75 border border-slate-700/70 text-center col-span-3 sm:col-span-1">
              <div className="text-[11px] text-slate-400">Mentor</div>
              <div className="font-mono font-bold text-sm text-orange-400 tabular-nums">
                {platformConfig.mentorConfig?.enabled
                  ? `+${platformConfig.mentorConfig.mentorCommissionPercent}%`
                  : 'Off'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Primary Tracking KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Referral Link Clicks
            </span>
            <span className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center">
              <MousePointerClick className="w-4 h-4" />
            </span>
          </div>
          <div className="font-mono font-bold text-3xl text-white tabular-nums">
            {metrics.effectiveClicks.toLocaleString()}
          </div>
          <p className="text-xs text-slate-400">
            Unique sessions tracked via <span className="font-mono text-slate-300">?ref={userProfile.handle}</span>
          </p>
        </div>

        <div className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Referred Sign-Ups
            </span>
            <span className="w-8 h-8 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="font-mono font-bold text-3xl text-white tabular-nums">
            {downlineReferrals.length.toLocaleString()}
          </div>
          <p className="text-xs text-slate-400 tabular-nums">
            <span className="text-slate-200 font-semibold">{metrics.directSignups.length}</span> Direct L1 ·{' '}
            <span className="text-slate-200 font-semibold">{metrics.networkSignups.length}</span> Network L2–L3
          </p>
        </div>

        <div className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Conversion & Volume
            </span>
            <span className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="font-mono font-bold text-3xl text-white tabular-nums">
            {metrics.conversionRate.toFixed(1)}%
          </div>
          <p className="text-xs text-slate-400 tabular-nums">
            {metrics.fundedSignups.length}/{downlineReferrals.length} funded ·{' '}
            <span className="text-emerald-400 font-semibold">
              ${metrics.totalReferralVolume.toFixed(2)}
            </span>{' '}
            vol
          </p>
        </div>

        <div className="bg-[#0B111E]/78 backdrop-blur-md border border-emerald-500/35 rounded-2xl p-5 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
              Earned Commissions
            </span>
            <span className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </span>
          </div>
          <div className="font-mono font-bold text-3xl text-emerald-400 tabular-nums">
            ${metrics.totalEarnedUsd.toFixed(2)}
          </div>
          <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
            <span className="tabular-nums truncate">
              L1: ${metrics.level1Earned.toFixed(2)} · Net: $
              {(metrics.level2Earned + metrics.level3Earned + metrics.mentorEarned).toFixed(2)}
            </span>
            {onOpenWithdraw && (
              <button
                type="button"
                onClick={onOpenWithdraw}
                className="shrink-0 text-emerald-300 hover:text-emerald-200 font-semibold inline-flex items-center gap-0.5"
              >
                Withdraw
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Funnel & Commission Breakdown + All-Plan Commission Estimator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-6 space-y-5 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-white text-base">
              Referral Funnel & Tier Breakdown
            </h3>
            <span className="text-xs font-mono text-slate-400 tabular-nums">
              {mlmCommissions.length} payouts
            </span>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">Link Clicks</span>
                <span className="font-mono font-bold text-white tabular-nums">
                  {metrics.effectiveClicks.toLocaleString()}
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-sky-400"
                  style={{ width: `${metrics.effectiveClicks > 0 ? 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">Verified Sign-Ups</span>
                <span className="font-mono font-bold text-white tabular-nums">
                  {downlineReferrals.length.toLocaleString()} ({metrics.conversionRate.toFixed(1)}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-orange-400"
                  style={{
                    width: `${Math.min(100, (downlineReferrals.length / funnelBase) * 100)}%`,
                  }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">Funded Investors</span>
                <span className="font-mono font-bold text-emerald-400 tabular-nums">
                  {metrics.fundedSignups.length.toLocaleString()} ({metrics.fundingRate.toFixed(0)}% of sign-ups)
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-400"
                  style={{
                    width: `${Math.min(100, (metrics.fundedSignups.length / funnelBase) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2.5 text-xs">
            <div className="p-3 rounded-xl bg-slate-900/75 border border-slate-700/70 flex items-center justify-between">
              <span className="text-slate-400">L1 Direct</span>
              <span className="font-mono font-bold text-emerald-400 tabular-nums">
                ${metrics.level1Earned.toFixed(2)}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/75 border border-slate-700/70 flex items-center justify-between">
              <span className="text-slate-400">L2 Tier</span>
              <span className="font-mono font-bold text-sky-400 tabular-nums">
                ${metrics.level2Earned.toFixed(2)}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/75 border border-slate-700/70 flex items-center justify-between">
              <span className="text-slate-400">L3 Tier</span>
              <span className="font-mono font-bold text-amber-400 tabular-nums">
                ${metrics.level3Earned.toFixed(2)}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/75 border border-slate-700/70 flex items-center justify-between">
              <span className="text-slate-400">Mentor</span>
              <span className="font-mono font-bold text-orange-400 tabular-nums">
                ${metrics.mentorEarned.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-400" />
              <h3 className="font-display font-bold text-white text-base">
                Commission Payouts Across All Plans
              </h3>
            </div>
            <span className="px-2.5 py-1 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Instant Credit
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Every investment tier qualifies for automated 3-level referral commissions credited straight
            to your Income Wallet whenever your invited users activate a package:
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            {platformConfig.packages.map((pkg) => {
              const l1Usd = (pkg.capital * platformConfig.mlmRates.level1) / 100;
              const l2Usd = (pkg.capital * platformConfig.mlmRates.level2) / 100;
              return (
                <div
                  key={pkg.id}
                  className="p-3 rounded-xl bg-slate-900/75 border border-slate-700/70 space-y-1"
                >
                  <div className="font-semibold text-white truncate">{pkg.name}</div>
                  <div className="font-mono text-slate-400 text-[11px] tabular-nums">
                    ${pkg.capital}
                  </div>
                  <div className="font-mono font-bold text-emerald-400 tabular-nums">
                    L1: +${l1Usd.toFixed(0)}
                  </div>
                  <div className="font-mono text-sky-400 text-[11px] tabular-nums">
                    L2: +${l2Usd.toFixed(0)}
                  </div>
                </div>
              );
            })}
          </div>

          {platformConfig.mentorConfig?.enabled && (
            <div className="p-3 rounded-xl bg-sky-950/50 border border-sky-500/35 flex items-center justify-between gap-2 text-xs">
              <span className="text-sky-200 font-medium">
                Mentor Override Bonus ({platformConfig.mentorConfig.volumeMultiplier}× network rule)
              </span>
              <span className="font-mono font-bold text-sky-300 tabular-nums shrink-0">
                +{platformConfig.mentorConfig.mentorCommissionPercent}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Detailed Sign-Ups & Earned Commissions Ledgers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-orange-400" />
              <h3 className="font-display font-bold text-white text-base">
                Referred Sign-Ups ({filteredReferrals.length})
              </h3>
            </div>
            <div className="inline-flex items-center rounded-lg bg-slate-900/90 border border-slate-700/80 p-0.5 text-xs">
              {(['all', 1, 2, 3] as const).map((lvl) => (
                <button
                  key={String(lvl)}
                  type="button"
                  onClick={() => setLevelFilter(lvl)}
                  className={`px-2.5 py-1 rounded-md font-semibold transition ${
                    levelFilter === lvl
                      ? 'bg-orange-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {lvl === 'all' ? 'All' : `L${lvl}`}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter sign-ups by name or handle..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-700 bg-slate-900/85 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500/70"
            />
          </div>

          {filteredReferrals.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">
              {downlineReferrals.length === 0
                ? 'No referred sign-ups recorded yet. Share your link to start earning.'
                : 'No sign-ups match your current filter.'}
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {filteredReferrals.map((r) => {
                const isFunded = (r.totalInvestedUsd || 0) > 0;
                return (
                  <div
                    key={r.id}
                    className="p-3 rounded-xl border border-slate-700/70 bg-slate-900/60 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate">
                        {r.refereeName}{' '}
                        <span className="font-mono text-slate-400">({r.refereeHandle})</span>
                      </div>
                      <div className="text-slate-400 flex flex-wrap items-center gap-2 mt-0.5">
                        <span>Level {r.level}</span>
                        <span>·</span>
                        <span>{formatTimestamp(r.createdAt)}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 space-y-0.5">
                      <div className="font-mono font-bold text-emerald-400 tabular-nums">
                        ${(r.totalInvestedUsd || 0).toFixed(2)} vol
                      </div>
                      <div
                        className={`text-[11px] font-semibold ${
                          isFunded ? 'text-emerald-300' : 'text-slate-400'
                        }`}
                      >
                        {isFunded ? 'Funded Investor' : 'Signed Up'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-400" />
              <h3 className="font-display font-bold text-white text-base">
                Earned Commission Ledger ({mlmCommissions.length})
              </h3>
            </div>
            <span className="font-mono text-xs font-bold text-emerald-400 tabular-nums">
              Total: +${metrics.totalEarnedUsd.toFixed(2)}
            </span>
          </div>

          {mlmCommissions.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">
              No commissions earned yet. Commissions credit automatically when your referrals activate plans.
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {mlmCommissions.map((c) => (
                <div
                  key={c.id}
                  className="p-3 rounded-xl border border-slate-700/70 bg-slate-900/60 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-white truncate">
                      {c.commissionType === 'mentor'
                        ? `Mentor Override (${c.ratePercent}%)`
                        : `Level ${c.level} (${c.ratePercent}%)`}{' '}
                      from {c.fromName}
                    </div>
                    <div className="text-slate-400 font-mono mt-0.5 tabular-nums">
                      On ${c.investmentAmount.toFixed(2)} · {formatTimestamp(c.createdAt)}
                    </div>
                  </div>
                  <div className="font-mono font-bold text-emerald-400 tabular-nums shrink-0">
                    +${c.commissionUsd.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
