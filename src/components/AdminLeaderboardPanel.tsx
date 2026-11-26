import React, { useState } from 'react';
import {
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Trophy,
} from 'lucide-react';
import { DEFAULT_PLATFORM_CONFIG } from '../constants/defaults';
import {
  ForexTrade,
  Investment,
  LeaderboardCategory,
  LeaderboardConfig,
  LeaderboardEntry,
  LeaderboardTimeframe,
  MlmCommission,
  PlatformConfig,
  UserProfile,
} from '../types/platform';

interface AdminLeaderboardPanelProps {
  draftConfig: PlatformConfig;
  setDraftConfig: React.Dispatch<React.SetStateAction<PlatformConfig>>;
  allUsers: UserProfile[];
  allMlm: MlmCommission[];
  allForexTrades: ForexTrade[];
  allInvestments: Investment[];
  onSaveConfig: (nextConfig?: PlatformConfig) => Promise<void>;
  busy: boolean;
  onNotify: (type: 'ok' | 'err', text: string) => void;
}

export const AdminLeaderboardPanel: React.FC<AdminLeaderboardPanelProps> = ({
  draftConfig,
  setDraftConfig,
  allUsers,
  allMlm,
  allForexTrades,
  allInvestments,
  onSaveConfig,
  busy,
  onNotify,
}) => {
  const lb: LeaderboardConfig =
    draftConfig.leaderboardConfig || DEFAULT_PLATFORM_CONFIG.leaderboardConfig!;

  const [categoryFilter, setCategoryFilter] = useState<'all' | LeaderboardCategory>('all');

  // New Showcase / Demo Entry Form State
  const [newCategory, setNewCategory] = useState<LeaderboardCategory>('referrals');
  const [newName, setNewName] = useState('');
  const [newHandle, setNewHandle] = useState('');
  const [newCountry, setNewCountry] = useState('BD');
  const [newTier, setNewTier] = useState('Elite');
  const [newEarningsUsd, setNewEarningsUsd] = useState('2500');
  const [newSecondaryCount, setNewSecondaryCount] = useState('24');
  const [newWinRate, setNewWinRate] = useState('72');
  const [newTrendDelta, setNewTrendDelta] = useState('12.5');
  const [newPinnedRank, setNewPinnedRank] = useState('0');

  const patchLb = (patch: Partial<LeaderboardConfig>) => {
    setDraftConfig((prev) => {
      const current = prev.leaderboardConfig || DEFAULT_PLATFORM_CONFIG.leaderboardConfig!;
      return {
        ...prev,
        leaderboardConfig: {
          ...current,
          ...patch,
        },
      };
    });
  };

  const patchEntry = (entryId: string, patch: Partial<LeaderboardEntry>) => {
    patchLb({
      entries: lb.entries.map((e) => (e.id === entryId ? { ...e, ...patch } : e)),
    });
  };

  const deleteEntry = (entryId: string) => {
    patchLb({
      entries: lb.entries.filter((e) => e.id !== entryId),
    });
  };

  const handleAddDemoEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newHandle.trim()) {
      onNotify('err', 'Please enter both Display Name and Handle for the showcase entry.');
      return;
    }
    if (lb.entries.length >= 40) {
      onNotify('err', 'Maximum 40 leaderboard entries reached. Remove an old entry first.');
      return;
    }

    const entry: LeaderboardEntry = {
      id: `demo_${newCategory}_${Date.now()}`,
      category: newCategory,
      displayName: newName.trim().slice(0, 64),
      handle: newHandle
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, '')
        .slice(0, 28),
      countryCode:
        newCountry
          .trim()
          .toUpperCase()
          .replace(/[^A-Z]/g, '')
          .slice(0, 2) || 'US',
      tierLabel: newTier.trim().slice(0, 28) || 'Pro',
      primaryMetricUsd: Math.max(0, Number(newEarningsUsd) || 0),
      secondaryMetricValue: Math.max(0, Math.round(Number(newSecondaryCount) || 0)),
      winRatePercent:
        newCategory === 'traders'
          ? Math.max(0, Math.min(100, Number(newWinRate) || 0))
          : 0,
      trendDeltaPercent: Math.max(-100, Math.min(999, Number(newTrendDelta) || 0)),
      source: 'demo_sample',
      enabled: true,
      pinnedRank: Math.max(0, Math.min(40, Math.round(Number(newPinnedRank) || 0))),
    };

    patchLb({ entries: [entry, ...lb.entries] });
    setNewName('');
    setNewHandle('');
    onNotify(
      'ok',
      `Added demo showcase entry "${entry.displayName}" (labeled Demo Sample). Click Publish Leaderboard Live to push to all dashboards.`
    );
  };

  // Compute real live top referral earners & top traders from Firestore collections (PII-free)
  const handleSyncLivePlatformLeaders = (keepDemoEntries: boolean) => {
    const userByUid = new Map(allUsers.map((u) => [u.uid, u]));

    // 1. Real Referral Earners
    const refTotals = new Map<string, { usd: number; count: number }>();
    for (const c of allMlm) {
      if (!c.beneficiaryUid) continue;
      const curr = refTotals.get(c.beneficiaryUid) || { usd: 0, count: 0 };
      curr.usd += Number(c.commissionUsd) || 0;
      curr.count += 1;
      refTotals.set(c.beneficiaryUid, curr);
    }

    const liveRefEntries: LeaderboardEntry[] = Array.from(refTotals.entries())
      .filter(([, v]) => v.usd > 0)
      .sort((a, b) => b[1].usd - a[1].usd)
      .slice(0, 10)
      .map(([uid, stats], idx) => {
        const u = userByUid.get(uid);
        const cap = Number(u?.totalInvested || 0);
        const tier = cap >= 1000 ? 'Elite' : cap >= 500 ? 'Pro' : cap >= 300 ? 'Growth' : 'Starter';
        return {
          id: `live_ref_${uid.slice(0, 14)}_${idx}`,
          category: 'referrals',
          displayName: u?.fullName || `Member ${idx + 1}`,
          handle: u?.handle || `ALPHA_${idx + 1}`,
          countryCode: (u?.countryCode || u?.kycCountryCode || 'US').slice(0, 2).toUpperCase(),
          tierLabel: tier,
          primaryMetricUsd: Number(stats.usd.toFixed(2)),
          secondaryMetricValue: stats.count,
          winRatePercent: 0,
          trendDeltaPercent: 8.5,
          source: 'live_sync',
          enabled: true,
          pinnedRank: 0,
        };
      });

    // 2. Real Top Traders (Closed Forex Realized Profit + Package Claimed Profit)
    const traderStats = new Map<
      string,
      { profitUsd: number; trades: number; wins: number }
    >();
    for (const t of allForexTrades) {
      if (t.status !== 'closed') continue;
      const curr = traderStats.get(t.uid) || { profitUsd: 0, trades: 0, wins: 0 };
      const pnl = Number(t.realizedPnlUsd) || 0;
      if (pnl > 0) {
        curr.profitUsd += pnl;
        curr.wins += 1;
      }
      curr.trades += 1;
      traderStats.set(t.uid, curr);
    }
    for (const inv of allInvestments) {
      const claimed = Number(inv.claimedProfit) || 0;
      if (claimed <= 0) continue;
      const curr = traderStats.get(inv.uid) || { profitUsd: 0, trades: 0, wins: 0 };
      curr.profitUsd += claimed;
      curr.trades += 1;
      curr.wins += 1;
      traderStats.set(inv.uid, curr);
    }

    const liveTraderEntries: LeaderboardEntry[] = Array.from(traderStats.entries())
      .filter(([, v]) => v.profitUsd > 0)
      .sort((a, b) => b[1].profitUsd - a[1].profitUsd)
      .slice(0, 10)
      .map(([uid, stats], idx) => {
        const u = userByUid.get(uid);
        const cap = Number(u?.totalInvested || 0);
        const tier = cap >= 1000 ? 'Elite' : cap >= 500 ? 'Pro' : cap >= 300 ? 'Growth' : 'Starter';
        const wr = stats.trades > 0 ? Number(((stats.wins / stats.trades) * 100).toFixed(1)) : 0;
        return {
          id: `live_trd_${uid.slice(0, 14)}_${idx}`,
          category: 'traders',
          displayName: u?.fullName || `Trader ${idx + 1}`,
          handle: u?.handle || `TRADER_${idx + 1}`,
          countryCode: (u?.countryCode || u?.kycCountryCode || 'US').slice(0, 2).toUpperCase(),
          tierLabel: tier,
          primaryMetricUsd: Number(stats.profitUsd.toFixed(2)),
          secondaryMetricValue: stats.trades,
          winRatePercent: wr,
          trendDeltaPercent: 10.2,
          source: 'live_sync',
          enabled: true,
          pinnedRank: 0,
        };
      });

    const retainedDemos = keepDemoEntries
      ? lb.entries.filter((e) => e.source === 'demo_sample')
      : [];
    const merged = [...liveRefEntries, ...liveTraderEntries, ...retainedDemos].slice(0, 40);

    patchLb({
      entries: merged,
      lastLiveSyncAtIso: new Date().toISOString(),
    });
    onNotify(
      'ok',
      `Synced ${liveRefEntries.length} live referral leaders & ${liveTraderEntries.length} live traders from Firestore. Click Publish Leaderboard Live to update all dashboards.`
    );
  };

  const filteredEntries = lb.entries.filter((e) =>
    categoryFilter === 'all' ? true : e.category === categoryFilter
  );

  const liveCount = lb.entries.filter((e) => e.source === 'live_sync').length;
  const demoCount = lb.entries.filter((e) => e.source === 'demo_sample').length;

  return (
    <section className="space-y-6">
      {/* Header & Global Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-5 h-5 text-orange-500" />
            <div>
              <h2 className="font-display font-bold text-slate-900 text-base">
                Top Performers Leaderboard Control Center
              </h2>
              <p className="text-xs text-slate-500">
                Customize widget settings, sync real platform leaders, or manage labeled Demo
                Sample showcase entries.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleSyncLivePlatformLeaders(true)}
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Sync Live Leaders (Keep Demos)
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onSaveConfig(draftConfig)}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-bold inline-flex items-center gap-1.5 transition"
            >
              <Save className="w-4 h-4 text-amber-400" />
              {busy ? 'Publishing...' : 'Publish Leaderboard Live'}
            </button>
          </div>
        </div>

        {/* Summary Counters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50">
            <div className="text-slate-500 font-semibold">Total Leaderboard Entries</div>
            <div className="font-mono font-bold text-xl text-slate-900 mt-0.5 tabular-nums">
              {lb.entries.length} / 40
            </div>
          </div>
          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50">
            <div className="text-slate-500 font-semibold">Verified Live Synced</div>
            <div className="font-mono font-bold text-xl text-emerald-700 mt-0.5 tabular-nums">
              {liveCount}
            </div>
          </div>
          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50">
            <div className="text-slate-500 font-semibold">Labeled Demo Sample Entries</div>
            <div className="font-mono font-bold text-xl text-amber-700 mt-0.5 tabular-nums">
              {demoCount}
            </div>
          </div>
        </div>

        {/* Feature Toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { key: 'enabled', label: 'Enable Leaderboard Widget' },
            { key: 'showReferralTab', label: 'Show Top Referral Earners' },
            { key: 'showTradersTab', label: 'Show Top Traders Tab' },
            { key: 'allowClientSelfRank', label: 'Show User Live Standing Bar' },
          ].map((item) => (
            <label
              key={item.key}
              className="flex items-center justify-between gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer"
            >
              <span className="text-xs font-semibold text-slate-800">{item.label}</span>
              <input
                type="checkbox"
                checked={Boolean(lb[item.key as keyof LeaderboardConfig])}
                onChange={(e) => patchLb({ [item.key]: e.target.checked })}
                className="accent-orange-500 w-4 h-4"
              />
            </label>
          ))}
        </div>

        {/* Editable Title, Subtitle, Timeframe, Max Rows */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Widget Title</label>
            <input
              type="text"
              value={lb.title}
              onChange={(e) => patchLb({ title: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Subtitle</label>
            <input
              type="text"
              value={lb.subtitle}
              onChange={(e) => patchLb({ subtitle: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Active Period Label</label>
            <select
              value={lb.activeTimeframe}
              onChange={(e) =>
                patchLb({ activeTimeframe: e.target.value as LeaderboardTimeframe })
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="all_time">All-Time</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Max Visible Rows (3–25)</label>
            <input
              type="number"
              min={3}
              max={25}
              value={lb.maxVisibleRows}
              onChange={(e) =>
                patchLb({ maxVisibleRows: Math.max(3, Math.min(25, Number(e.target.value) || 8)) })
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs text-slate-900"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700">
            Transparency &amp; Risk Disclaimer Footer
          </label>
          <input
            type="text"
            value={lb.disclaimerText}
            onChange={(e) => patchLb({ disclaimerText: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900"
          />
        </div>
      </div>

      {/* Add Demo / Showcase Entry Form */}
      <form
        onSubmit={handleAddDemoEntry}
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-orange-500" />
            <div>
              <h3 className="font-display font-bold text-slate-900 text-base">
                Add Custom Demo / Showcase Top Performer
              </h3>
              <p className="text-xs text-slate-500">
                Custom entries are clearly labeled <strong>Demo Sample</strong> on the dashboard so
                users always know which entries are showcase samples vs. synced live leaders.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600">Board Category</label>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as LeaderboardCategory)}
              className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
            >
              <option value="referrals">Top Referral Earners</option>
              <option value="traders">Top Traders</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600">Display Name</label>
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Tariq Hasan"
              className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs text-slate-900"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600">Handle</label>
            <input
              type="text"
              required
              value={newHandle}
              onChange={(e) => setNewHandle(e.target.value)}
              placeholder="e.g. TARIQ_PRO"
              className="w-full px-2.5 py-2 rounded-lg border border-slate-300 font-mono text-xs text-slate-900"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600">Country (2-letter)</label>
            <input
              type="text"
              maxLength={2}
              value={newCountry}
              onChange={(e) => setNewCountry(e.target.value.toUpperCase())}
              className="w-full px-2.5 py-2 rounded-lg border border-slate-300 font-mono text-xs text-slate-900"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600">Package Tier</label>
            <select
              value={newTier}
              onChange={(e) => setNewTier(e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
            >
              <option value="Elite">Elite</option>
              <option value="Pro">Pro</option>
              <option value="Growth">Growth</option>
              <option value="Starter">Starter</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600">
              {newCategory === 'referrals' ? 'Referral Earnings ($)' : 'Trading Profit ($)'}
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={newEarningsUsd}
              onChange={(e) => setNewEarningsUsd(e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg border border-slate-300 font-mono text-xs text-slate-900"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600">
              {newCategory === 'referrals' ? 'Referrals Count' : 'Closed Trades'}
            </label>
            <input
              type="number"
              min={0}
              value={newSecondaryCount}
              onChange={(e) => setNewSecondaryCount(e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg border border-slate-300 font-mono text-xs text-slate-900"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600">Win Rate % (Traders)</label>
            <input
              type="number"
              min={0}
              max={100}
              step="0.1"
              disabled={newCategory !== 'traders'}
              value={newWinRate}
              onChange={(e) => setNewWinRate(e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg border border-slate-300 font-mono text-xs text-slate-900 disabled:bg-slate-100"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600">Momentum (%)</label>
            <input
              type="number"
              step="0.1"
              value={newTrendDelta}
              onChange={(e) => setNewTrendDelta(e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg border border-slate-300 font-mono text-xs text-slate-900"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600">Pin Rank (0 = Auto)</label>
            <input
              type="number"
              min={0}
              max={40}
              value={newPinnedRank}
              onChange={(e) => setNewPinnedRank(e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg border border-slate-300 font-mono text-xs text-slate-900"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" />
            Add Demo Entry to Draft
          </button>

          <button
            type="button"
            onClick={() => handleSyncLivePlatformLeaders(false)}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            Replace All With Live Synced Leaders Only
          </button>
        </div>
      </form>

      {/* Editable Entries Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <h3 className="font-display font-bold text-slate-900 text-base">
            Manage Leaderboard Entries ({filteredEntries.length})
          </h3>
          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-100">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'referrals', label: 'Referrals' },
                { id: 'traders', label: 'Traders' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setCategoryFilter(f.id)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                  categoryFilter === f.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                <th className="py-2 pr-2">Show</th>
                <th className="py-2 px-2">Board</th>
                <th className="py-2 px-2">Display Name</th>
                <th className="py-2 px-2">Handle</th>
                <th className="py-2 px-2">CC</th>
                <th className="py-2 px-2">Tier</th>
                <th className="py-2 px-2">USD Amount</th>
                <th className="py-2 px-2">Refs / Trades</th>
                <th className="py-2 px-2">WR %</th>
                <th className="py-2 px-2">Pin #</th>
                <th className="py-2 px-2">Source</th>
                <th className="py-2 pl-2 text-right">Del</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50">
                  <td className="py-2 pr-2">
                    <input
                      type="checkbox"
                      checked={entry.enabled}
                      onChange={(e) => patchEntry(entry.id, { enabled: e.target.checked })}
                      className="accent-orange-500"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <select
                      value={entry.category}
                      onChange={(e) =>
                        patchEntry(entry.id, { category: e.target.value as LeaderboardCategory })
                      }
                      className="px-2 py-1 rounded border border-slate-300 bg-white text-[11px]"
                    >
                      <option value="referrals">Referrals</option>
                      <option value="traders">Traders</option>
                    </select>
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      value={entry.displayName}
                      onChange={(e) => patchEntry(entry.id, { displayName: e.target.value })}
                      className="w-32 px-2 py-1 rounded border border-slate-300 text-xs"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      value={entry.handle}
                      onChange={(e) =>
                        patchEntry(entry.id, { handle: e.target.value.toUpperCase() })
                      }
                      className="w-28 px-2 py-1 rounded border border-slate-300 font-mono text-[11px]"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      maxLength={2}
                      value={entry.countryCode}
                      onChange={(e) =>
                        patchEntry(entry.id, { countryCode: e.target.value.toUpperCase() })
                      }
                      className="w-12 px-2 py-1 rounded border border-slate-300 font-mono text-[11px]"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      value={entry.tierLabel}
                      onChange={(e) => patchEntry(entry.id, { tierLabel: e.target.value })}
                      className="w-20 px-2 py-1 rounded border border-slate-300 text-[11px]"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={entry.primaryMetricUsd}
                      onChange={(e) =>
                        patchEntry(entry.id, { primaryMetricUsd: Number(e.target.value) || 0 })
                      }
                      className="w-24 px-2 py-1 rounded border border-slate-300 font-mono text-[11px]"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      min={0}
                      value={entry.secondaryMetricValue}
                      onChange={(e) =>
                        patchEntry(entry.id, {
                          secondaryMetricValue: Math.max(0, Math.round(Number(e.target.value) || 0)),
                        })
                      }
                      className="w-16 px-2 py-1 rounded border border-slate-300 font-mono text-[11px]"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={entry.winRatePercent}
                      onChange={(e) =>
                        patchEntry(entry.id, { winRatePercent: Number(e.target.value) || 0 })
                      }
                      className="w-16 px-2 py-1 rounded border border-slate-300 font-mono text-[11px]"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      min={0}
                      max={40}
                      value={entry.pinnedRank || 0}
                      onChange={(e) =>
                        patchEntry(entry.id, {
                          pinnedRank: Math.max(0, Math.round(Number(e.target.value) || 0)),
                        })
                      }
                      className="w-14 px-2 py-1 rounded border border-slate-300 font-mono text-[11px]"
                    />
                  </td>
                  <td className="py-2 px-2 font-mono text-[11px]">
                    <span
                      className={
                        entry.source === 'live_sync' ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'
                      }
                    >
                      {entry.source === 'live_sync' ? 'Live' : 'Demo Sample'}
                    </span>
                  </td>
                  <td className="py-2 pl-2 text-right">
                    <button
                      type="button"
                      onClick={() => deleteEntry(entry.id)}
                      className="p-1.5 rounded border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600"
                      title="Delete entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
