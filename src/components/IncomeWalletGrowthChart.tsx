import React, { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingDown, TrendingUp } from 'lucide-react';
import {
  CopyTradeSubscription,
  ForexTrade,
  Investment,
  MlmCommission,
  WalletTransfer,
  Withdrawal,
} from '../types/platform';
import { isWeekendDate } from '../utils/investmentMath';

interface IncomeWalletGrowthChartProps {
  currentIncomeBalance: number;
  investments: Investment[];
  mlmCommissions: MlmCommission[];
  withdrawals: Withdrawal[];
  walletTransfers: WalletTransfer[];
  forexTrades: ForexTrade[];
  copyTradeSubscriptions: CopyTradeSubscription[];
}

interface ChartPoint {
  dateKey: string;
  label: string;
  fullDate: string;
  balance: number;
  dailyDelta: number;
}

const MS_PER_DAY = 86_400_000;

function extractTimeMs(value: unknown, fallbackMs?: number): number {
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  if (value && typeof value === 'object' && 'seconds' in value) {
    const secs = Number((value as { seconds?: number }).seconds || 0);
    if (secs > 0) return secs * 1000;
  }
  if (typeof value === 'number' && value > 0) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  if (typeof fallbackMs === 'number' && fallbackMs > 0) return fallbackMs;
  return 0;
}

function toLocalDayKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const IncomeWalletGrowthChart: React.FC<IncomeWalletGrowthChartProps> = ({
  currentIncomeBalance,
  investments,
  mlmCommissions,
  withdrawals,
  walletTransfers,
  forexTrades,
  copyTradeSubscriptions,
}) => {
  const { series, net30dChange, high30d, startBalance } = useMemo(() => {
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const daysCount = 30;
    const windowStartMs = todayMidnight - (daysCount - 1) * MS_PER_DAY;

    // Build day buckets [0..29] from oldest to today
    const buckets: {
      dayStartMs: number;
      dateKey: string;
      label: string;
      fullDate: string;
      delta: number;
    }[] = [];
    const indexByKey = new Map<string, number>();

    for (let i = 0; i < daysCount; i += 1) {
      const dayStartMs = windowStartMs + i * MS_PER_DAY;
      const d = new Date(dayStartMs);
      const dateKey = toLocalDayKey(dayStartMs);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const fullDate = d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      indexByKey.set(dateKey, i);
      buckets.push({ dayStartMs, dateKey, label, fullDate, delta: 0 });
    }

    const addDelta = (ms: number, amount: number) => {
      if (!ms || !Number.isFinite(amount) || amount === 0) return;
      const idx = indexByKey.get(toLocalDayKey(ms));
      if (idx !== undefined) {
        buckets[idx].delta += amount;
      }
    };

    // 1. MLM / Mentor Commissions credited to Income Wallet
    mlmCommissions.forEach((c) => {
      const ms = extractTimeMs(c.createdAt);
      addDelta(ms, c.commissionUsd || 0);
    });

    // 2. Instant Profit Withdrawals debited from Income Wallet
    withdrawals.forEach((w) => {
      if (w.type === 'instant_profit' && w.status !== 'rejected') {
        const ms = extractTimeMs(w.createdAt);
        addDelta(ms, -(w.amountUsd || 0));
      }
    });

    // 3. Internal Transfers (Income Wallet -> Deposit Wallet)
    walletTransfers.forEach((t) => {
      if (t.direction === 'income_to_deposit') {
        const ms = extractTimeMs(t.createdAt);
        addDelta(ms, -(t.amountUsd || 0));
      }
    });

    // 4. Forex WebTerminal Trades (Margin & Commission debit on open, Margin + PnL credit on close)
    forexTrades.forEach((t) => {
      const openMs = extractTimeMs(t.createdAt, t.openedAtMs);
      addDelta(openMs, -((t.marginUsd || 0) + (t.commissionUsd || 0)));
      if (t.status === 'closed') {
        const closeMs = extractTimeMs(t.updatedAt, t.closedAtMs || openMs);
        addDelta(closeMs, (t.marginUsd || 0) + (t.realizedPnlUsd || 0));
      }
    });

    // 5. Copy Trade Subscriptions (Allocation debit on start, claimed profit distributed)
    copyTradeSubscriptions.forEach((s) => {
      const startMs = extractTimeMs(s.createdAt, s.startedAtMs);
      addDelta(startMs, -(s.allocatedUsd || 0));
      if (s.claimedProfitUsd > 0) {
        const claimMs = extractTimeMs(s.updatedAt, s.lastSyncedAtMs || startMs);
        addDelta(claimMs, s.claimedProfitUsd);
      }
    });

    // 6. Claimed AI Package Profits spread across active Mon-Fri profit days within window
    investments.forEach((inv) => {
      const claimed = Number(inv.claimedProfit || 0);
      if (claimed <= 0) return;

      const invStart = new Date(inv.startedAtMs || extractTimeMs(inv.createdAt, todayMidnight));
      const invStartMidnight = new Date(
        invStart.getFullYear(),
        invStart.getMonth(),
        invStart.getDate()
      ).getTime();

      const eligibleDayIndices: number[] = [];
      for (let i = 0; i < daysCount; i += 1) {
        const b = buckets[i];
        if (b.dayStartMs > invStartMidnight && !isWeekendDate(new Date(b.dayStartMs))) {
          eligibleDayIndices.push(i);
        }
      }

      if (eligibleDayIndices.length > 0) {
        const dailyTarget = Number(((inv.capital * inv.dailyPercent) / 100).toFixed(4));
        const maxWindowProfit = dailyTarget * eligibleDayIndices.length;
        const attributable = Math.min(claimed, maxWindowProfit > 0 ? maxWindowProfit : claimed);
        const perDay = attributable / eligibleDayIndices.length;
        eligibleDayIndices.forEach((idx) => {
          buckets[idx].delta += perDay;
        });
      } else {
        const fallbackMs = extractTimeMs(inv.updatedAt, inv.startedAtMs);
        addDelta(fallbackMs, claimed);
      }
    });

    // Anchor Day 29 (today) to the exact live Income Wallet balance and walk backwards
    const balances = new Array<number>(daysCount).fill(0);
    balances[daysCount - 1] = Math.max(0, Number(currentIncomeBalance.toFixed(2)));

    for (let i = daysCount - 1; i > 0; i -= 1) {
      const prev = balances[i] - buckets[i].delta;
      balances[i - 1] = Math.max(0, Number(prev.toFixed(2)));
    }

    const points: ChartPoint[] = buckets.map((b, i) => ({
      dateKey: b.dateKey,
      label: b.label,
      fullDate: b.fullDate,
      balance: balances[i],
      dailyDelta: Number(buckets[i].delta.toFixed(2)),
    }));

    const firstVal = points[0]?.balance ?? 0;
    const lastVal = points[points.length - 1]?.balance ?? 0;
    const maxVal = points.reduce((m, p) => Math.max(m, p.balance), 0);

    return {
      series: points,
      startBalance: firstVal,
      net30dChange: Number((lastVal - firstVal).toFixed(2)),
      high30d: Number(maxVal.toFixed(2)),
    };
  }, [
    currentIncomeBalance,
    investments,
    mlmCommissions,
    withdrawals,
    walletTransfers,
    forexTrades,
    copyTradeSubscriptions,
  ]);

  const isPositiveOrFlat = net30dChange >= 0;

  return (
    <div className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 shadow-xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              {isPositiveOrFlat ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-amber-400" />
              )}
            </span>
            <h3 className="font-display font-bold text-white text-sm">
              Income Wallet Growth (Last 30 Days)
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Historical daily trajectory of your Income Wallet from claimed profits, referral commissions, Forex PnL &amp; transfers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <div className="px-2.5 py-1.5 rounded-lg bg-slate-900/85 border border-slate-800">
            <span className="text-slate-400 mr-1.5">30d Net:</span>
            <strong className={isPositiveOrFlat ? 'text-emerald-400' : 'text-amber-400'}>
              {net30dChange >= 0 ? '+' : '-'}${Math.abs(net30dChange).toFixed(2)}
            </strong>
          </div>
          <div className="px-2.5 py-1.5 rounded-lg bg-slate-900/85 border border-slate-800">
            <span className="text-slate-400 mr-1.5">30d High:</span>
            <strong className="text-slate-100">${high30d.toFixed(2)}</strong>
          </div>
          <div className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <span className="text-emerald-300/80 mr-1.5">Current:</span>
            <strong className="text-emerald-300">${currentIncomeBalance.toFixed(2)}</strong>
          </div>
        </div>
      </div>

      <div className="w-full min-w-0 h-[220px]">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 2 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
              minTickGap={24}
            />
            <YAxis
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
              tickLine={false}
              axisLine={false}
              width={54}
              domain={[
                0,
                (dataMax: number) => Math.max(10, Math.ceil(dataMax * 1.15)),
              ]}
              tickFormatter={(val: number) => `$${val}`}
            />
            <Tooltip
              cursor={{ stroke: '#334155', strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const pt = payload[0].payload as ChartPoint;
                return (
                  <div className="rounded-xl border border-slate-700 bg-[#070B14]/95 px-3 py-2 shadow-2xl text-xs space-y-1">
                    <div className="font-semibold text-slate-200">{pt.fullDate}</div>
                    <div className="flex items-center justify-between gap-4 font-mono">
                      <span className="text-slate-400">Income Balance:</span>
                      <span className="font-bold text-emerald-400">${pt.balance.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 font-mono text-[11px]">
                      <span className="text-slate-400">Day Net Flow:</span>
                      <span
                        className={
                          pt.dailyDelta > 0
                            ? 'text-emerald-300'
                            : pt.dailyDelta < 0
                            ? 'text-amber-300'
                            : 'text-slate-400'
                        }
                      >
                        {pt.dailyDelta > 0
                          ? `+$${pt.dailyDelta.toFixed(2)}`
                          : pt.dailyDelta < 0
                          ? `-$${Math.abs(pt.dailyDelta).toFixed(2)}`
                          : '$0.00'}
                      </span>
                    </div>
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="balance"
              name="Income Wallet"
              stroke="#10b981"
              strokeWidth={2.5}
              dot={{ r: 2, fill: '#10b981', strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#34d399', stroke: '#064e3b', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 border-t border-slate-800/70 pt-2.5">
        <span>
          30d Opening Anchor:{' '}
          <strong className="font-mono text-slate-200">${startBalance.toFixed(2)}</strong>
        </span>
        <span className="font-mono text-[10px] text-slate-500">
          Updates live on profit claims, commissions, Forex settlements &amp; withdrawals
        </span>
      </div>
    </div>
  );
};
