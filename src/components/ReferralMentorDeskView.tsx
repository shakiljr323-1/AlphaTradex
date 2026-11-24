import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Award,
  Check,
  CheckCircle2,
  Copy,
  Lock,
  MousePointerClick,
  Network,
  Search,
  Share2,
  ShieldCheck,
  TrendingUp,
  Unlock,
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

interface ReferralMentorDeskViewProps {
  userProfile: UserProfile;
  platformConfig: PlatformConfig;
  referralLink: string;
  referralLinkClicks: number;
  downlineReferrals: ReferralLinkRecord[];
  mlmCommissions: MlmCommission[];
  copiedText: string;
  onCopyValue: (label: string, val: string) => void;
  onOpenWithdraw: () => void;
}

export const ReferralMentorDeskView: React.FC<ReferralMentorDeskViewProps> = ({
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

  const stats = useMemo(() => {
    const l1Refs = downlineReferrals.filter((r) => r.level === 1);
    const l2l3Refs = downlineReferrals.filter((r) => r.level > 1);
    const totalReferredVolume = downlineReferrals.reduce(
      (acc, r) => acc + Number(r.totalInvestedUsd || 0),
      0
    );
    const directL1Volume = l1Refs.reduce(
      (acc, r) => acc + Number(r.totalInvestedUsd || 0),
      0
    );
    const networkL2L3Volume = l2l3Refs.reduce(
      (acc, r) => acc + Number(r.totalInvestedUsd || 0),
      0
    );
    const fundedCount = downlineReferrals.filter(
      (r) => Number(r.totalInvestedUsd || 0) > 0
    ).length;

    let totalCommissionEarned = 0;
    let level1Earned = 0;
    let level2Earned = 0;
    let level3Earned = 0;
    let mentorEarned = 0;

    for (const c of mlmCommissions) {
      const amt = Number(c.commissionUsd || 0);
      totalCommissionEarned += amt;
      if (c.commissionType === 'mentor') {
        mentorEarned += amt;
      } else if (c.level === 1) {
        level1Earned += amt;
      } else if (c.level === 2) {
        level2Earned += amt;
      } else if (c.level === 3) {
        level3Earned += amt;
      }
    }

    const mentorRequired = Number(userProfile.mentorRequiredVolume || 0);
    const mentorBrought = Number(userProfile.mentorBroughtVolume || 0);
    const mentorGifted = Number(userProfile.mentorGiftedCapital || 0);
    const mentorRemaining = Math.max(0, mentorRequired - mentorBrought);
    const mentorProgressPct =
      mentorRequired > 0
        ? Math.min(100, (mentorBrought / mentorRequired) * 100)
        : userProfile.isMentor
        ? 100
        : 0;
    const isMentorVolumeUnlocked =
      !userProfile.isMentor || mentorGifted <= 0 || mentorBrought >= mentorRequired;

    const clicks = Math.max(0, Number(referralLinkClicks || 0));
    const conversionPct =
      clicks > 0
        ? Math.min(100, (downlineReferrals.length / clicks) * 100)
        : downlineReferrals.length > 0
        ? 100
        : 0;

    return {
      l1Refs,
      l2l3Refs,
      totalReferredVolume,
      directL1Volume,
      networkL2L3Volume,
      fundedCount,
      totalCommissionEarned,
      level1Earned,
      level2Earned,
      level3Earned,
      mentorEarned,
      mentorRequired,
      mentorBrought,
      mentorGifted,
      mentorRemaining,
      mentorProgressPct,
      isMentorVolumeUnlocked,
      clicks,
      conversionPct,
    };
  }, [downlineReferrals, mlmCommissions, userProfile, referralLinkClicks]);

  const filteredDownline = useMemo(() => {
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

  const mentorCfg = platformConfig.mentorConfig;

  return (
    <section aria-labelledby="referral-mentor-desk-heading" className="space-y-6">
      {/* Header & Shareable Referral Link / ID Card */}
      <div className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/35 text-orange-400 flex items-center justify-center shrink-0">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="referral-mentor-desk-heading"
                  className="font-display font-bold text-white text-lg sm:text-xl"
                >
                  Referral &amp; Mentor Desk
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${
                    userProfile.isMentor
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                      : 'bg-sky-500/20 border-sky-500/35 text-sky-300'
                  }`}
                >
                  {userProfile.isMentor ? 'Mentor Partner' : 'Referral Partner'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Track your total referred volume, multi-level &amp; mentor commission earnings, and share your referral link or ID.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenWithdraw}
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <span>Withdraw Commissions</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Shareable Referral ID & Link Box */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-4 p-3.5 rounded-xl bg-slate-900/85 border border-slate-700/75 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Shareable Referral ID
              </div>
              <div className="font-mono font-extrabold text-base text-orange-400 tracking-wide truncate mt-0.5">
                {userProfile.handle}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onCopyValue('desk-ref-id', userProfile.handle)}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white inline-flex items-center gap-1.5 shrink-0 transition-colors"
            >
              {copiedText === 'desk-ref-id' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-300" />
              )}
              <span>{copiedText === 'desk-ref-id' ? 'Copied' : 'Copy ID'}</span>
            </button>
          </div>

          <div className="lg:col-span-8 p-3.5 rounded-xl bg-slate-900/85 border border-slate-700/75 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Shareable Referral Link
              </div>
              <div className="font-mono text-xs text-slate-100 truncate mt-0.5">
                {referralLink}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onCopyValue('desk-ref-link', referralLink)}
                className="px-3.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                {copiedText === 'desk-ref-link' ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Share2 className="w-3.5 h-3.5" />
                )}
                <span>{copiedText === 'desk-ref-link' ? 'Link Copied' : 'Copy Link'}</span>
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Join ${platformConfig.companyName} with my referral ID (${userProfile.handle}): ${referralLink}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-semibold"
              >
                WhatsApp
              </a>
              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(
                  `Join ${platformConfig.companyName} (${userProfile.handle})`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg bg-sky-600/90 hover:bg-sky-500 text-white text-xs font-semibold"
              >
                Telegram
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Total Referred Volume */}
        <div className="bg-[#0B111E]/78 backdrop-blur-md border border-sky-500/35 rounded-2xl p-5 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-300">
              Total Referred Volume
            </span>
            <span className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="font-mono font-extrabold text-2xl sm:text-3xl text-white tabular-nums">
            ${stats.totalReferredVolume.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 tabular-nums">
            L1: <strong className="text-slate-200">${stats.directL1Volume.toFixed(2)}</strong> · L2–L3:{' '}
            <strong className="text-slate-200">${stats.networkL2L3Volume.toFixed(2)}</strong>
          </div>
        </div>

        {/* Current Commission Earnings */}
        <div className="bg-[#0B111E]/78 backdrop-blur-md border border-emerald-500/35 rounded-2xl p-5 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
              Current Commission Earnings
            </span>
            <span className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </span>
          </div>
          <div className="font-mono font-extrabold text-2xl sm:text-3xl text-emerald-400 tabular-nums">
            ${stats.totalCommissionEarned.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 tabular-nums">
            {mlmCommissions.length} payout(s) · Income Wallet:{' '}
            <strong className="text-emerald-300">${userProfile.profitBalance.toFixed(2)}</strong>
          </div>
        </div>

        {/* Team & Funded Sign-Ups */}
        <div className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
              Referred Network
            </span>
            <span className="w-8 h-8 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="font-mono font-extrabold text-2xl sm:text-3xl text-white tabular-nums">
            {downlineReferrals.length}
          </div>
          <div className="text-[11px] text-slate-400 tabular-nums">
            {stats.l1Refs.length} Direct L1 · {stats.fundedCount} Funded Investor(s)
          </div>
        </div>

        {/* Link Clicks & Conversion */}
        <div className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
              Link Clicks &amp; Rate
            </span>
            <span className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <MousePointerClick className="w-4 h-4" />
            </span>
          </div>
          <div className="font-mono font-extrabold text-2xl sm:text-3xl text-white tabular-nums">
            {stats.clicks.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 tabular-nums">
            Sign-up conversion: <strong className="text-amber-300">{stats.conversionPct.toFixed(1)}%</strong>
          </div>
        </div>
      </div>

      {/* Mentor Desk Status & Commission Structure */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              <h3 className="font-display font-bold text-white text-base">
                Mentor Desk &amp; Volume Requirement
              </h3>
            </div>
            {userProfile.isMentor ? (
              stats.isMentorVolumeUnlocked ? (
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/35 text-emerald-300 text-[11px] font-semibold inline-flex items-center gap-1">
                  <Unlock className="w-3 h-3" />
                  Unlocked
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/35 text-amber-300 text-[11px] font-semibold inline-flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Volume Locked
                </span>
              )
            ) : (
              <span className="px-2.5 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-semibold">
                Standard Account
              </span>
            )}
          </div>

          {userProfile.isMentor ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900/75 border border-slate-700/70">
                  <div className="text-slate-400">Gifted Capital</div>
                  <div className="font-mono font-bold text-white text-sm mt-1 tabular-nums">
                    ${stats.mentorGifted.toFixed(2)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/75 border border-slate-700/70">
                  <div className="text-slate-400">Brought Volume</div>
                  <div className="font-mono font-bold text-emerald-400 text-sm mt-1 tabular-nums">
                    ${stats.mentorBrought.toFixed(2)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/75 border border-slate-700/70">
                  <div className="text-slate-400">Required ({mentorCfg.volumeMultiplier}×)</div>
                  <div className="font-mono font-bold text-amber-300 text-sm mt-1 tabular-nums">
                    ${stats.mentorRequired.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">Withdrawal Unlock Progress</span>
                  <span className="font-mono font-bold text-white tabular-nums">
                    {stats.mentorProgressPct.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      stats.isMentorVolumeUnlocked ? 'bg-emerald-500' : 'bg-amber-400'
                    }`}
                    style={{ width: `${stats.mentorProgressPct}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  {stats.isMentorVolumeUnlocked
                    ? 'Your required referred volume target is complete. Instant profit withdrawals are unlocked.'
                    : `Bring $${stats.mentorRemaining.toFixed(
                        2
                      )} more in Level-1 referred package volume to unlock instant profit withdrawals.`}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-300 leading-relaxed">
                Standard accounts have no referral volume lock on profit withdrawals. Accounts promoted to{' '}
                <strong className="text-amber-300">Mentor Partner</strong> receive gifted trading capital and earn an additional{' '}
                <strong className="text-emerald-400">
                  +{mentorCfg?.mentorCommissionPercent || 0}% Mentor Override
                </strong>{' '}
                commission on Level-1 referred packages (subject to a{' '}
                <strong className="text-white">{mentorCfg?.volumeMultiplier || 4}×</strong> volume unlock rule).
              </p>
              <div className="p-3 rounded-xl bg-slate-900/75 border border-slate-700/70 flex items-center justify-between text-xs">
                <span className="text-slate-300 inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Current Account Withdrawal Status
                </span>
                <span className="font-semibold text-emerald-300">Instant Withdrawal Active</span>
              </div>
            </div>
          )}
        </div>

        {/* Commission Tier & Earnings Breakdown */}
        <div className="lg:col-span-6 bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-400" />
              <h3 className="font-display font-bold text-white text-base">
                Commission Earnings by Tier
              </h3>
            </div>
            <span className="font-mono text-xs font-bold text-emerald-400 tabular-nums">
              Total: ${stats.totalCommissionEarned.toFixed(2)}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-900/75 border border-slate-700/70 space-y-1">
              <div className="text-slate-400">Level 1 ({platformConfig.mlmRates.level1}%)</div>
              <div className="font-mono font-bold text-base text-emerald-400 tabular-nums">
                ${stats.level1Earned.toFixed(2)}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/75 border border-slate-700/70 space-y-1">
              <div className="text-slate-400">Level 2 ({platformConfig.mlmRates.level2}%)</div>
              <div className="font-mono font-bold text-base text-sky-400 tabular-nums">
                ${stats.level2Earned.toFixed(2)}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/75 border border-slate-700/70 space-y-1">
              <div className="text-slate-400">Level 3 ({platformConfig.mlmRates.level3}%)</div>
              <div className="font-mono font-bold text-base text-amber-400 tabular-nums">
                ${stats.level3Earned.toFixed(2)}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/75 border border-slate-700/70 space-y-1">
              <div className="text-slate-400">
                Mentor ({mentorCfg?.enabled ? `+${mentorCfg.mentorCommissionPercent}%` : 'Off'})
              </div>
              <div className="font-mono font-bold text-base text-orange-400 tabular-nums">
                ${stats.mentorEarned.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/75 border border-slate-700/70 text-xs text-slate-300 leading-relaxed">
            Commissions credit automatically to your <strong className="text-emerald-400">Income Wallet</strong> whenever any Level 1–3 referral activates an AI Trading package. You can withdraw commissions or trade Forex using your Income Wallet balance.
          </div>
        </div>
      </div>

      {/* Referred Members & Commission Payout Ledgers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-orange-400" />
              <h3 className="font-display font-bold text-white text-base">
                Referred Team Volume ({filteredDownline.length})
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
                      ? 'bg-orange-600 text-white'
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
              placeholder="Search referral by name or ID..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-700 bg-slate-900/85 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500/70"
            />
          </div>

          {filteredDownline.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">
              {downlineReferrals.length === 0
                ? 'No referred members yet. Share your Referral ID or link above to build your volume.'
                : 'No referred members match your current filter.'}
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {filteredDownline.map((r) => (
                <div
                  key={r.id}
                  className="p-3 rounded-xl border border-slate-700/70 bg-slate-900/60 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-white truncate">
                      {r.refereeName}{' '}
                      <span className="font-mono text-slate-400">({r.refereeHandle})</span>
                    </div>
                    <div className="text-slate-400 mt-0.5">
                      Level {r.level} · {formatTimestamp(r.createdAt)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-bold text-sky-400 tabular-nums">
                      ${Number(r.totalInvestedUsd || 0).toFixed(2)}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {Number(r.totalInvestedUsd || 0) > 0 ? 'Funded' : 'Signed Up'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-400" />
              <h3 className="font-display font-bold text-white text-base">
                Commission Earnings History ({mlmCommissions.length})
              </h3>
            </div>
            <span className="font-mono text-xs font-bold text-emerald-400 tabular-nums">
              +${stats.totalCommissionEarned.toFixed(2)}
            </span>
          </div>

          {mlmCommissions.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">
              No commission payouts yet. Commissions credit instantly when your downline funds a plan.
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
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
                      · {c.fromName}
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
