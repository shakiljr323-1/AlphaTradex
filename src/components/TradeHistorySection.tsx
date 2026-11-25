import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  Cpu,
  Globe,
  Search,
  Users,
  XCircle,
} from 'lucide-react';
import {
  CoinMiningStake,
  CopyTradeSubscription,
  ForexTrade,
  Investment,
  Withdrawal,
} from '../types/platform';
import { computeInvestmentMetrics, formatTimestamp } from '../utils/investmentMath';

export type TradeHistoryStatus = 'Success' | 'Pending' | 'Failed';
type StatusFilter = 'All' | TradeHistoryStatus;

interface TradeHistoryRow {
  id: string;
  category: 'AI Package' | 'Forex WebTerminal' | 'Copy Trade' | 'Coin Mining' | 'Capital Settlement';
  title: string;
  subtitle: string;
  amountUsd: number;
  outcomeText: string;
  outcomePositive: boolean | null;
  status: TradeHistoryStatus;
  timestampMs: number;
  timestampLabel: string;
}

interface TradeHistorySectionProps {
  investments: Investment[];
  forexTrades: ForexTrade[];
  copyTradeSubscriptions: CopyTradeSubscription[];
  coinMiningStakes: CoinMiningStake[];
  withdrawals: Withdrawal[];
  globalPaused: boolean;
  compact?: boolean;
  onViewAll?: () => void;
}

function getTimeMs(value: unknown, fallbackMs?: number): number {
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof fallbackMs === 'number' && fallbackMs > 0) return fallbackMs;
  return 0;
}

export const TradeHistorySection: React.FC<TradeHistorySectionProps> = ({
  investments,
  forexTrades,
  copyTradeSubscriptions,
  coinMiningStakes,
  withdrawals,
  globalPaused,
  compact = false,
  onViewAll,
}) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const rows = useMemo<TradeHistoryRow[]>(() => {
    const items: TradeHistoryRow[] = [];

    // 1. AI Trading Packages
    investments.forEach((inv) => {
      const metrics = computeInvestmentMetrics(inv, globalPaused);
      const tsMs = getTimeMs(inv.createdAt, inv.startedAtMs);
      const status: TradeHistoryStatus =
        inv.status === 'capital_requested' ? 'Pending' : 'Success';
      items.push({
        id: `inv-${inv.id}`,
        category: 'AI Package',
        title: `${inv.packageName} (#${inv.packageNumber}) · ${inv.aiMode}`,
        subtitle: `${inv.dailyPercent}%/day · ${metrics.completedProfitDays}/${
          inv.totalProfitDays || 200
        } profit days`,
        amountUsd: inv.capital,
        outcomeText: `+$${metrics.totalProfitGenerated.toFixed(2)} generated`,
        outcomePositive: true,
        status,
        timestampMs: tsMs,
        timestampLabel: formatTimestamp(inv.createdAt, inv.startedAtMs),
      });
    });

    // 2. Forex WebTerminal Executions
    forexTrades.forEach((t) => {
      const fallbackMs = t.status === 'closed' ? t.closedAtMs || t.openedAtMs : t.openedAtMs;
      const tsVal = t.status === 'closed' ? t.updatedAt || t.createdAt : t.createdAt;
      const tsMs = getTimeMs(tsVal, fallbackMs);

      let status: TradeHistoryStatus = 'Pending';
      if (t.status === 'closed') {
        status = t.realizedPnlUsd < 0 ? 'Failed' : 'Success';
      }

      const pnl = t.realizedPnlUsd || 0;
      items.push({
        id: `fx-${t.id}`,
        category: 'Forex WebTerminal',
        title: `${t.direction} ${t.symbol} · ${t.lots.toFixed(2)} Lots`,
        subtitle: `${t.accountTierName} · 1:${t.leverage} · Entry ${t.entryPrice}`,
        amountUsd: t.marginUsd,
        outcomeText:
          t.status === 'open'
            ? 'Position Open'
            : `${pnl >= 0 ? '+' : '-'}$${Math.abs(pnl).toFixed(2)} PnL`,
        outcomePositive: t.status === 'open' ? null : pnl >= 0,
        status,
        timestampMs: tsMs,
        timestampLabel: formatTimestamp(tsVal, fallbackMs),
      });
    });

    // 3. Copy Trading Strategy Allocations
    copyTradeSubscriptions.forEach((s) => {
      const fallbackMs = s.lastSyncedAtMs || s.startedAtMs;
      const tsMs = getTimeMs(s.updatedAt || s.createdAt, fallbackMs);
      let status: TradeHistoryStatus = 'Success';
      if (s.status === 'stopped' && (s.claimedProfitUsd || 0) <= 0) {
        status = 'Failed';
      }
      items.push({
        id: `copy-${s.id}`,
        category: 'Copy Trade',
        title: `Mirror ${s.traderName} (${s.traderHandle})`,
        subtitle: `${s.riskMultiplier}x Risk · ${s.dailyTargetPercent}%/day est.`,
        amountUsd: s.allocatedUsd,
        outcomeText: `+$${(s.claimedProfitUsd || 0).toFixed(2)} claimed`,
        outcomePositive: (s.claimedProfitUsd || 0) >= 0,
        status,
        timestampMs: tsMs,
        timestampLabel: formatTimestamp(s.updatedAt || s.createdAt, fallbackMs),
      });
    });

    // 4. Algorithmic Coin Mining Stakes
    coinMiningStakes.forEach((m) => {
      const tsMs = getTimeMs(m.createdAt, m.startedAtMs);
      items.push({
        id: `mine-${m.id}`,
        category: 'Coin Mining',
        title: `Mining Node: ${m.planName}`,
        subtitle: `${m.dailyInterestPercent}%/day · ${m.durationDays}d term`,
        amountUsd: m.principalUsd,
        outcomeText: `+$${(m.claimedUsd || 0).toFixed(2)} mined`,
        outcomePositive: true,
        status: 'Success',
        timestampMs: tsMs,
        timestampLabel: formatTimestamp(m.createdAt, m.startedAtMs),
      });
    });

    // 5. Manual AI Capital Settlement Requests (Captures Pending / Rejected / Approved settlements)
    withdrawals
      .filter((w) => w.type === 'manual_capital')
      .forEach((w) => {
        const tsMs = getTimeMs(w.createdAt);
        const status: TradeHistoryStatus =
          w.status === 'rejected'
            ? 'Failed'
            : w.status === 'pending'
            ? 'Pending'
            : 'Success';
        items.push({
          id: `cap-${w.id}`,
          category: 'Capital Settlement',
          title: `Capital Release · Package #${w.packageNumber}`,
          subtitle: `${w.network.replace('_', ' ')} · ${w.adminNote || 'Capital settlement'}`,
          amountUsd: w.amountUsd,
          outcomeText:
            status === 'Failed'
              ? 'Settlement Rejected'
              : status === 'Pending'
              ? 'Awaiting Review'
              : 'Capital Released',
          outcomePositive: status === 'Success' ? true : status === 'Failed' ? false : null,
          status,
          timestampMs: tsMs,
          timestampLabel: formatTimestamp(w.createdAt),
        });
      });

    return items.sort((a, b) => b.timestampMs - a.timestampMs);
  }, [
    investments,
    forexTrades,
    copyTradeSubscriptions,
    coinMiningStakes,
    withdrawals,
    globalPaused,
  ]);

  const counts = useMemo(
    () => ({
      All: rows.length,
      Success: rows.filter((r) => r.status === 'Success').length,
      Pending: rows.filter((r) => r.status === 'Pending').length,
      Failed: rows.filter((r) => r.status === 'Failed').length,
    }),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (statusFilter !== 'All' && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.subtitle.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
      );
    });
    return compact ? list.slice(0, 6) : list;
  }, [rows, statusFilter, searchQuery, compact]);

  const renderStatusBadge = (status: TradeHistoryStatus) => {
    if (status === 'Success') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/35">
          <CheckCircle2 className="w-3 h-3" />
          Success
        </span>
      );
    }
    if (status === 'Pending') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/35">
          <Clock className="w-3 h-3" />
          Pending
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-500/15 text-red-300 border border-red-500/35">
        <XCircle className="w-3 h-3" />
        Failed
      </span>
    );
  };

  const renderCategoryIcon = (category: TradeHistoryRow['category']) => {
    switch (category) {
      case 'AI Package':
      case 'Capital Settlement':
        return <Bot className="w-4 h-4 text-orange-400 shrink-0" />;
      case 'Forex WebTerminal':
        return <Globe className="w-4 h-4 text-sky-400 shrink-0" />;
      case 'Copy Trade':
        return <Users className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'Coin Mining':
        return <Cpu className="w-4 h-4 text-amber-400 shrink-0" />;
    }
  };

  return (
    <section
      aria-labelledby="trade-history-heading"
      className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="trade-history-heading"
            className="font-display font-bold text-white text-base sm:text-lg flex items-center gap-2"
          >
            <Activity className="w-4 h-4 text-orange-400" />
            <span>AI Trade History</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Execution ledger across AI trading packages, Forex WebTerminal trades, copy trading &amp; mining allocations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(['All', 'Success', 'Pending', 'Failed'] as StatusFilter[]).map((tab) => {
            const active = statusFilter === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  active
                    ? 'bg-orange-600/25 border-orange-500 text-orange-200'
                    : 'bg-slate-900/75 border-slate-700/80 text-slate-300 hover:border-slate-500'
                }`}
              >
                {tab} ({counts[tab]})
              </button>
            );
          })}
          {compact && onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700 hover:border-orange-500/60 text-xs font-semibold text-orange-400 inline-flex items-center gap-1"
            >
              Full Log <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {!compact && (
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by strategy, pair, package number, or status..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-700/80 bg-slate-900/85 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="py-10 text-center space-y-1.5 border border-dashed border-slate-800 rounded-xl">
          <p className="text-sm font-semibold text-slate-300">
            No {statusFilter === 'All' ? '' : `${statusFilter.toLowerCase()} `}AI trade executions recorded yet
          </p>
          <p className="text-xs text-slate-500">
            Activate an AI package, open a Forex position, or mirror a trader to populate your execution history.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="py-2.5 pr-3 font-semibold">Execution Timestamp</th>
                  <th className="py-2.5 px-3 font-semibold">Module</th>
                  <th className="py-2.5 px-3 font-semibold">Strategy / Asset</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Allocation</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Execution Result</th>
                  <th className="py-2.5 pl-3 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filtered.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3 pr-3 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                      {row.timestampLabel}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-slate-200 font-medium">
                        {renderCategoryIcon(row.category)}
                        <span>{row.category}</span>
                      </span>
                    </td>
                    <td className="py-3 px-3 min-w-[200px]">
                      <div className="font-semibold text-white">{row.title}</div>
                      <div className="text-[11px] text-slate-400">{row.subtitle}</div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-slate-100 tabular-nums whitespace-nowrap">
                      ${row.amountUsd.toFixed(2)}
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${
                        row.outcomePositive === true
                          ? 'text-emerald-400'
                          : row.outcomePositive === false
                          ? 'text-red-400'
                          : 'text-amber-300'
                      }`}
                    >
                      {row.outcomeText}
                    </td>
                    <td className="py-3 pl-3 text-right whitespace-nowrap">
                      {renderStatusBadge(row.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-2.5">
            {filtered.map((row) => (
              <div
                key={row.id}
                className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/70 space-y-2 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {renderCategoryIcon(row.category)}
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate">{row.title}</div>
                      <div className="text-[11px] text-slate-400 truncate">{row.subtitle}</div>
                    </div>
                  </div>
                  {renderStatusBadge(row.status)}
                </div>
                <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80 font-mono text-[11px]">
                  <span className="text-slate-400">{row.timestampLabel}</span>
                  <div className="flex items-center gap-2.5">
                    <span className="text-slate-200 font-semibold">${row.amountUsd.toFixed(2)}</span>
                    <span
                      className={
                        row.outcomePositive === true
                          ? 'text-emerald-400'
                          : row.outcomePositive === false
                          ? 'text-red-400'
                          : 'text-amber-300'
                      }
                    >
                      {row.outcomeText}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
};
