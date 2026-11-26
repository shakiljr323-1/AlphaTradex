import React, { useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowDownLeft, ArrowUpRight, BarChart3, TrendingUp, Wallet } from 'lucide-react';
import { CryptoDeposit, Withdrawal } from '../types/platform';

interface AdminCashflowAnalyticsCardProps {
  deposits: CryptoDeposit[];
  withdrawals: Withdrawal[];
}

function toMs(val: unknown): number {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const parsed = Date.parse(val);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof val === 'object' && val !== null) {
    const rec = val as { toMillis?: () => number; seconds?: number };
    if (typeof rec.toMillis === 'function') return rec.toMillis();
    if (typeof rec.seconds === 'number') return rec.seconds * 1000;
  }
  return 0;
}

export const AdminCashflowAnalyticsCard: React.FC<AdminCashflowAnalyticsCardProps> = ({
  deposits,
  withdrawals,
}) => {
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly'>('daily');

  const analytics = useMemo(() => {
    const now = new Date();
    const approvedDeposits = deposits.filter((d) => d.status === 'approved');
    const paidWithdrawals = withdrawals.filter(
      (w) => w.status === 'approved' || w.status === 'completed'
    );
    const pendingWithdrawals = withdrawals.filter((w) => w.status === 'pending');

    const totalDepositsUsd = approvedDeposits.reduce((s, d) => s + Number(d.amountUsd || 0), 0);
    const totalWithdrawalsUsd = paidWithdrawals.reduce((s, w) => s + Number(w.amountUsd || 0), 0);
    const pendingLiabilityUsd = pendingWithdrawals.reduce(
      (s, w) => s + Number(w.amountUsd || 0),
      0
    );
    const netCashflowUsd = totalDepositsUsd - totalWithdrawalsUsd;
    const avgDepositUsd =
      approvedDeposits.length > 0 ? totalDepositsUsd / approvedDeposits.length : 0;

    const buckets: Array<{
      key: string;
      label: string;
      startMs: number;
      endMs: number;
      deposits: number;
      withdrawals: number;
      netFlow: number;
      cumulativeNet: number;
    }> = [];

    if (timeframe === 'daily') {
      // Last 14 UTC days
      for (let i = 13; i >= 0; i--) {
        const d = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i)
        );
        const startMs = d.getTime();
        const endMs = startMs + 24 * 60 * 60 * 1000;
        const label = d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        });
        buckets.push({
          key: d.toISOString().slice(0, 10),
          label,
          startMs,
          endMs,
          deposits: 0,
          withdrawals: 0,
          netFlow: 0,
          cumulativeNet: 0,
        });
      }
    } else {
      // Last 8 weeks
      const endOfTodayMs =
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      for (let i = 7; i >= 0; i--) {
        const endMs = endOfTodayMs - i * weekMs;
        const startMs = endMs - weekMs;
        const d = new Date(startMs);
        const label = `Wk ${d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        })}`;
        buckets.push({
          key: `wk_${i}`,
          label,
          startMs,
          endMs,
          deposits: 0,
          withdrawals: 0,
          netFlow: 0,
          cumulativeNet: 0,
        });
      }
    }

    for (const d of approvedDeposits) {
      const ts = toMs(d.createdAt);
      const b = buckets.find((x) => ts >= x.startMs && ts < x.endMs);
      if (b) b.deposits += Number(d.amountUsd || 0);
    }

    for (const w of paidWithdrawals) {
      const ts = toMs(w.createdAt);
      const b = buckets.find((x) => ts >= x.startMs && ts < x.endMs);
      if (b) b.withdrawals += Number(w.amountUsd || 0);
    }

    let runningNet = 0;
    for (const b of buckets) {
      b.deposits = Number(b.deposits.toFixed(2));
      b.withdrawals = Number(b.withdrawals.toFixed(2));
      b.netFlow = Number((b.deposits - b.withdrawals).toFixed(2));
      runningNet = Number((runningNet + b.netFlow).toFixed(2));
      b.cumulativeNet = runningNet;
    }

    return {
      buckets,
      totalDepositsUsd,
      totalWithdrawalsUsd,
      netCashflowUsd,
      pendingLiabilityUsd,
      avgDepositUsd,
      depositCount: approvedDeposits.length,
      withdrawalCount: paidWithdrawals.length,
    };
  }, [deposits, withdrawals, timeframe]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-slate-900 text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-600" />
            Revenue &amp; Cashflow Analytics (Deposits vs Withdrawals)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Live platform inflow vs completed payout outflow and cumulative net liquidity trend.
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
          <button
            type="button"
            onClick={() => setTimeframe('daily')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              timeframe === 'daily'
                ? 'bg-[#0B111E] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Daily (14D)
          </button>
          <button
            type="button"
            onClick={() => setTimeframe('weekly')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              timeframe === 'weekly'
                ? 'bg-[#0B111E] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Weekly (8W)
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl bg-emerald-50/70 border border-emerald-200/80 p-3.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-emerald-700 uppercase">
            <span>Approved Deposits</span>
            <ArrowDownLeft className="w-3.5 h-3.5" />
          </div>
          <div className="font-mono font-bold text-lg text-slate-900 mt-1">
            ${analytics.totalDepositsUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-emerald-700 mt-0.5">
            {analytics.depositCount} tx &bull; Avg ${analytics.avgDepositUsd.toFixed(0)}
          </div>
        </div>

        <div className="rounded-xl bg-rose-50/70 border border-rose-200/80 p-3.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-rose-700 uppercase">
            <span>Paid Withdrawals</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
          <div className="font-mono font-bold text-lg text-slate-900 mt-1">
            ${analytics.totalWithdrawalsUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-rose-700 mt-0.5">
            {analytics.withdrawalCount} completed payouts
          </div>
        </div>

        <div className="rounded-xl bg-sky-50/70 border border-sky-200/80 p-3.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-sky-700 uppercase">
            <span>Net Platform Cashflow</span>
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
          <div
            className={`font-mono font-bold text-lg mt-1 ${
              analytics.netCashflowUsd >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {analytics.netCashflowUsd >= 0 ? '+' : '-'}$
            {Math.abs(analytics.netCashflowUsd).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="text-[11px] text-sky-700 mt-0.5">Deposits minus paid outflows</div>
        </div>

        <div className="rounded-xl bg-amber-50/70 border border-amber-200/80 p-3.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-amber-800 uppercase">
            <span>Pending Payout Queue</span>
            <Wallet className="w-3.5 h-3.5" />
          </div>
          <div className="font-mono font-bold text-lg text-slate-900 mt-1">
            ${analytics.pendingLiabilityUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-amber-800 mt-0.5">Awaiting Admin manual approval</div>
        </div>
      </div>

      {/* Recharts Composed Chart */}
      <div className="h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={analytics.buckets}
            margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#64748B' }}
              axisLine={{ stroke: '#CBD5E1' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#64748B' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0B111E',
                border: '1px solid #1E293B',
                borderRadius: '10px',
                color: '#F8FAFC',
                fontSize: '12px',
              }}
              formatter={(value, name) => [
                `$${Number(value || 0).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`,
                String(name ?? ''),
              ]}
            />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
            <Bar
              dataKey="deposits"
              name="Deposits ($)"
              fill="#10B981"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
            <Bar
              dataKey="withdrawals"
              name="Withdrawals ($)"
              fill="#F43F5E"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
            <Line
              type="monotone"
              dataKey="cumulativeNet"
              name="Net Liquidity Trend ($)"
              stroke="#0EA5E9"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#0EA5E9' }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
