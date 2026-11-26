import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  Crown,
  Medal,
  Search,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import { DEFAULT_PLATFORM_CONFIG } from '../constants/defaults';
import {
  ForexTrade,
  Investment,
  LeaderboardCategory,
  LeaderboardEntry,
  MlmCommission,
  PlatformConfig,
  ReferralLinkRecord,
  UserProfile,
} from '../types/platform';

interface TopPerformersLeaderboardProps {
  userProfile: UserProfile;
  platformConfig: PlatformConfig;
  mlmCommissions: MlmCommission[];
  downlineReferrals: ReferralLinkRecord[];
  investments: Investment[];
  forexTrades: ForexTrade[];
  compact?: boolean;
  onOpenReferrals?: () => void;
  onOpenTrading?: () => void;
  onOpenFullView?: () => void;
}

const TIMEFRAME_LABELS: Record<string, string> = {
  weekly: 'This Week',
  monthly: 'This Month',
  all_time: 'All-Time',
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'AT';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function sortLeaderboardEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  const active = entries.filter((e) => e.enabled !== false);
  const pinned = active
    .filter((e) => (e.pinnedRank || 0) > 0)
    .sort((a, b) => (a.pinnedRank || 99) - (b.pinnedRank || 99));
  const unpinned = active
    .filter((e) => !e.pinnedRank || e.pinnedRank <= 0)
    .sort((a, b) => b.primaryMetricUsd - a.primaryMetricUsd);

  const result: LeaderboardEntry[] = [];
  const total = active.length;
  const pinnedBySlot = new Map<number, LeaderboardEntry[]>();
  for (const p of pinned) {
    const slot = Math.max(1, Math.min(total, p.pinnedRank || 1));
    const list = pinnedBySlot.get(slot) || [];
    list.push(p);
    pinnedBySlot.set(slot, list);
  }

  let unpinnedIdx = 0;
  for (let rank = 1; rank <= total; rank++) {
    const slotItems = pinnedBySlot.get(rank);
    if (slotItems && slotItems.length > 0) {
      for (const item of slotItems) result.push(item);
    } else if (unpinnedIdx < unpinned.length) {
      result.push(unpinned[unpinnedIdx++]);
    }
  }
  while (unpinnedIdx < unpinned.length) {
    result.push(unpinned[unpinnedIdx++]);
  }
  return result;
}

export const TopPerformersLeaderboard: React.FC<TopPerformersLeaderboardProps> = ({
  userProfile,
  platformConfig,
  mlmCommissions,
  downlineReferrals,
  investments,
  forexTrades,
  compact = false,
  onOpenReferrals,
  onOpenTrading,
  onOpenFullView,
}) => {
  const lbConfig = useMemo(
    () => platformConfig.leaderboardConfig || DEFAULT_PLATFORM_CONFIG.leaderboardConfig!,
    [platformConfig.leaderboardConfig]
  );

  const defaultTab: LeaderboardCategory = lbConfig.showReferralTab ? 'referrals' : 'traders';
  const [activeTab, setActiveTab] = useState<LeaderboardCategory>(defaultTab);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const effectiveTab: LeaderboardCategory =
    activeTab === 'referrals' && !lbConfig.showReferralTab
      ? 'traders'
      : activeTab === 'traders' && !lbConfig.showTradersTab
      ? 'referrals'
      : activeTab;

  const rankedEntries = useMemo(() => {
    const byCategory = (lbConfig.entries || []).filter((e) => e.category === effectiveTab);
    const sorted = sortLeaderboardEntries(byCategory);
    const maxRows = compact
      ? Math.min(lbConfig.maxVisibleRows || 8, 6)
      : lbConfig.maxVisibleRows || 10;
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? sorted.filter(
          (e) =>
            e.displayName.toLowerCase().includes(q) ||
            e.handle.toLowerCase().includes(q) ||
            e.countryCode.toLowerCase().includes(q) ||
            e.tierLabel.toLowerCase().includes(q)
        )
      : sorted;
    return filtered.slice(0, maxRows);
  }, [lbConfig.entries, lbConfig.maxVisibleRows, effectiveTab, compact, searchQuery]);

  const hasDemoEntries = useMemo(
    () => rankedEntries.some((e) => e.source === 'demo_sample'),
    [rankedEntries]
  );

  // Compute current signed-in user's real live metrics for gamified competitive standing
  const myLiveStanding = useMemo(() => {
    const myReferralUsd = mlmCommissions.reduce((sum, c) => sum + (Number(c.commissionUsd) || 0), 0);
    const myReferralsCount = downlineReferrals.length;

    const closedTrades = forexTrades.filter((t) => t.status === 'closed');
    const forexPnl = closedTrades.reduce((sum, t) => sum + Math.max(0, Number(t.realizedPnlUsd) || 0), 0);
    const packageClaimed = investments.reduce((sum, inv) => sum + (Number(inv.claimedProfit) || 0), 0);
    const myTraderUsd = Number((forexPnl + packageClaimed).toFixed(2));
    const winningTrades = closedTrades.filter((t) => (Number(t.realizedPnlUsd) || 0) > 0).length;
    const myWinRate =
      closedTrades.length > 0 ? Number(((winningTrades / closedTrades.length) * 100).toFixed(1)) : 0;

    const myScore = effectiveTab === 'referrals' ? myReferralUsd : myTraderUsd;
    const allSorted = sortLeaderboardEntries(
      (lbConfig.entries || []).filter((e) => e.category === effectiveTab)
    );
    const higherCount = allSorted.filter((e) => e.primaryMetricUsd > myScore).length;
    const estimatedRank = higherCount + 1;
    const targetNext =
      higherCount > 0 ? allSorted[higherCount - 1] : allSorted[0] || null;
    const gapToNextUsd =
      targetNext && targetNext.primaryMetricUsd > myScore
        ? Math.max(0, targetNext.primaryMetricUsd - myScore)
        : 0;
    const progressPct =
      targetNext && targetNext.primaryMetricUsd > 0
        ? Math.min(100, Math.round((myScore / targetNext.primaryMetricUsd) * 100))
        : myScore > 0
        ? 100
        : 4;

    return {
      myScore,
      myReferralsCount,
      myTradesCount: closedTrades.length,
      myWinRate,
      estimatedRank,
      targetNext,
      gapToNextUsd,
      progressPct,
    };
  }, [
    downlineReferrals.length,
    effectiveTab,
    forexTrades,
    investments,
    lbConfig.entries,
    mlmCommissions,
  ]);

  if (!lbConfig.enabled || (!lbConfig.showReferralTab && !lbConfig.showTradersTab)) {
    return null;
  }

  const podium = rankedEntries.slice(0, 3);
  const tableRows = rankedEntries.slice(3);

  return (
    <section className="bg-[#0B111E]/85 border border-slate-700/70 rounded-2xl p-5 sm:p-6 space-y-5">
      {/* Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
            <h3 className="font-display font-bold text-white text-lg leading-tight">
              {lbConfig.title}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>{lbConfig.subtitle}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-amber-300">
              {TIMEFRAME_LABELS[lbConfig.activeTimeframe] || 'This Month'}
            </span>
            {hasDemoEntries && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-slate-300">Includes Demo Showcase Entries</span>
              </>
            )}
          </div>
        </div>

        {/* Controls: Segmented Category Tabs + Search */}
        <div className="flex flex-wrap items-center gap-2.5">
          {lbConfig.showReferralTab && lbConfig.showTradersTab && (
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-700/80">
              <button
                type="button"
                onClick={() => setActiveTab('referrals')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition ${
                  effectiveTab === 'referrals'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Top Referral Earners
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('traders')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition ${
                  effectiveTab === 'traders'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Top Traders
              </button>
            </div>
          )}

          {!compact && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search handle or country..."
                className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 w-48"
              />
            </div>
          )}

          {compact && onOpenFullView && (
            <button
              type="button"
              onClick={onOpenFullView}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 inline-flex items-center gap-1 whitespace-nowrap transition"
            >
              <span>Full Board</span>
              <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
            </button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {rankedEntries.length === 0 ? (
        <div className="py-10 text-center border border-slate-800 rounded-xl bg-slate-900/40 space-y-2">
          <Award className="w-7 h-7 text-slate-500 mx-auto" />
          <div className="text-sm font-semibold text-slate-200">
            No leaderboard entries match this filter
          </div>
          <p className="text-xs text-slate-400">
            Start referring members or executing trades to claim a top spot on the board.
          </p>
        </div>
      ) : (
        <>
          {/* Top-3 Podium Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {podium.map((entry, idx) => {
              const rank = idx + 1;
              const isFirst = rank === 1;
              const rankStyles =
                rank === 1
                  ? 'border-amber-400/60 bg-amber-500/8'
                  : rank === 2
                  ? 'border-slate-500/70 bg-slate-800/50'
                  : 'border-orange-500/45 bg-orange-950/20';
              const rankTextColor =
                rank === 1 ? 'text-amber-300' : rank === 2 ? 'text-slate-200' : 'text-orange-300';

              return (
                <div
                  key={entry.id}
                  className={`rounded-xl border p-4 flex flex-col justify-between gap-3 ${rankStyles}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-mono font-bold text-xs shrink-0 border ${
                          isFirst
                            ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                            : 'bg-slate-900 border-slate-700 text-slate-200'
                        }`}
                      >
                        {getInitials(entry.displayName)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-display font-bold text-sm text-white truncate">
                          {entry.displayName}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 truncate">
                          @{entry.handle} · {entry.countryCode} · {entry.tierLabel}
                        </div>
                      </div>
                    </div>

                    <div className={`inline-flex items-center gap-1 font-mono font-bold text-sm shrink-0 tabular-nums ${rankTextColor}`}>
                      {isFirst ? <Crown className="w-4 h-4" /> : <Medal className="w-4 h-4" />}
                      <span>#{rank}</span>
                    </div>
                  </div>

                  <div className="flex items-end justify-between gap-2 pt-2 border-t border-slate-800/80">
                    <div>
                      <div className="text-[11px] text-slate-400">
                        {effectiveTab === 'referrals' ? 'Referral Earnings' : 'Trading Profit'}
                      </div>
                      <div className="font-mono font-extrabold text-xl text-white tabular-nums">
                        ${entry.primaryMetricUsd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono text-xs font-semibold text-emerald-400 tabular-nums">
                        {entry.trendDeltaPercent >= 0 ? '+' : ''}
                        {entry.trendDeltaPercent.toFixed(1)}%
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                        {effectiveTab === 'referrals'
                          ? `${entry.secondaryMetricValue} referrals`
                          : `${entry.secondaryMetricValue} trades · ${entry.winRatePercent.toFixed(0)}% WR`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1">
                    <span>
                      {entry.source === 'live_sync' ? 'Verified Live' : 'Demo Sample'}
                    </span>
                    {entry.pinnedRank && entry.pinnedRank > 0 ? (
                      <span className="text-amber-400">Featured Rank</span>
                    ) : (
                      <span>Auto-Ranked</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ranks #4+ High-Density Table */}
          {tableRows.length > 0 && (
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/70 text-[11px] font-mono text-slate-400">
                    <th className="py-2.5 px-3 font-semibold w-14">Rank</th>
                    <th className="py-2.5 px-3 font-semibold">Member</th>
                    <th className="py-2.5 px-3 font-semibold">Tier · Origin</th>
                    <th className="py-2.5 px-3 font-semibold text-right">
                      {effectiveTab === 'referrals' ? 'Referrals' : 'Trades / Win Rate'}
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-right">Momentum</th>
                    <th className="py-2.5 px-3 font-semibold text-right">
                      {effectiveTab === 'referrals' ? 'Earned (USD)' : 'Profit (USD)'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-xs">
                  {tableRows.map((entry, idx) => {
                    const rank = idx + 4;
                    return (
                      <tr
                        key={entry.id}
                        className="hover:bg-slate-800/35 transition-colors"
                      >
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-300 tabular-nums">
                          #{rank}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-slate-900 border border-slate-700 text-slate-200 flex items-center justify-center font-mono text-[10px] font-bold shrink-0">
                              {getInitials(entry.displayName)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-white truncate">
                                {entry.displayName}
                              </div>
                              <div className="text-[11px] font-mono text-slate-400">
                                @{entry.handle} ·{' '}
                                <span className="text-slate-500">
                                  {entry.source === 'live_sync' ? 'Live' : 'Demo Sample'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 font-mono text-[11px]">
                          {entry.tierLabel} · {entry.countryCode}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-300 tabular-nums">
                          {effectiveTab === 'referrals'
                            ? `${entry.secondaryMetricValue} active`
                            : `${entry.secondaryMetricValue} · ${entry.winRatePercent.toFixed(1)}%`}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono font-semibold tabular-nums ${
                            entry.trendDeltaPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {entry.trendDeltaPercent >= 0 ? '+' : ''}
                          {entry.trendDeltaPercent.toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-white tabular-nums">
                          ${entry.primaryMetricUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Competitive Progress Bar: Your Real Live Standing */}
      {lbConfig.allowClientSelfRank && (
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-700/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-display font-bold text-white">
                Your Live Standing ({userProfile.fullName})
              </span>
              <span className="text-slate-500" aria-hidden="true">·</span>
              <span className="font-mono font-bold text-amber-400 tabular-nums">
                Rank #{myLiveStanding.estimatedRank}
              </span>
              <span className="text-slate-500" aria-hidden="true">·</span>
              <span className="font-mono text-emerald-400 font-semibold tabular-nums">
                ${myLiveStanding.myScore.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-300"
                style={{ width: `${Math.max(4, myLiveStanding.progressPct)}%` }}
              />
            </div>

            <div className="text-[11px] text-slate-400 font-mono tabular-nums">
              {myLiveStanding.gapToNextUsd > 0 && myLiveStanding.targetNext ? (
                <>
                  ${myLiveStanding.gapToNextUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                  away from overtaking @{myLiveStanding.targetNext.handle}
                </>
              ) : (
                <>You are leading this category on the current board.</>
              )}
            </div>
          </div>

          <div className="shrink-0">
            {effectiveTab === 'referrals' && onOpenReferrals ? (
              <button
                type="button"
                onClick={onOpenReferrals}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 whitespace-nowrap transition"
              >
                <span>Grow Referral Rank</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : effectiveTab === 'traders' && onOpenTrading ? (
              <button
                type="button"
                onClick={onOpenTrading}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 whitespace-nowrap transition"
              >
                <span>Open Trading Desk</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      )}

      {/* Transparency Disclaimer */}
      <div className="text-[11px] text-slate-400 leading-relaxed pt-1 border-t border-slate-800/80">
        {lbConfig.disclaimerText}
      </div>
    </section>
  );
};
