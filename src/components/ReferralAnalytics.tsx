import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, Layers, TrendingUp, Users } from 'lucide-react';
import { MlmCommission, ReferralLinkRecord } from '../types/platform';

interface ReferralAnalyticsProps {
  downlineReferrals: ReferralLinkRecord[];
  mlmCommissions: MlmCommission[];
  mentorBroughtVolume?: number;
  mentorRequiredVolume?: number;
}

type AnalyticsViewMode = 'tiers' | 'bands' | 'contributors';

interface ChartDatum {
  label: string;
  sublabel?: string;
  users: number;
  fundedUsers: number;
  volumeUsd: number;
  commissionsUsd: number;
}

function formatCompactUsd(value: number): string {
  const num = Number(value) || 0;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
  return `$${num.toFixed(0)}`;
}

function formatFullUsd(value: number): string {
  return `$${(Number(value) || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    dataKey?: string;
    color?: string;
    payload?: ChartDatum;
  }>;
  label?: string;
}

const AnalyticsTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0]?.payload;

  return (
    <div className="rounded-xl border border-slate-700/90 bg-[#070C18]/98 px-3.5 py-3 shadow-xl text-xs space-y-1.5 min-w-[200px]">
      <div className="border-b border-slate-800 pb-1.5">
        <div className="font-semibold text-white">{label}</div>
        {datum?.sublabel && <div className="text-[11px] text-slate-400">{datum.sublabel}</div>}
      </div>
      <div className="space-y-1 font-mono tabular-nums">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sky-300 font-sans">Referred Users</span>
          <span className="font-semibold text-white">{datum?.users ?? 0}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-emerald-300 font-sans">Funded Investors</span>
          <span className="font-semibold text-emerald-400">{datum?.fundedUsers ?? 0}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-amber-300 font-sans">Trading Volume</span>
          <span className="font-semibold text-amber-400">
            {formatFullUsd(datum?.volumeUsd ?? 0)}
          </span>
        </div>
        {datum && datum.commissionsUsd > 0 && (
          <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-800/80">
            <span className="text-slate-400 font-sans">Earned Overrides</span>
            <span className="font-semibold text-emerald-300">
              +{formatFullUsd(datum.commissionsUsd)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export const ReferralAnalytics: React.FC<ReferralAnalyticsProps> = ({
  downlineReferrals,
  mlmCommissions,
  mentorBroughtVolume = 0,
  mentorRequiredVolume = 0,
}) => {
  const [viewMode, setViewMode] = useState<AnalyticsViewMode>('tiers');

  // Map commissions by level and by sender UID for rich attribution
  const commissionMaps = useMemo(() => {
    const byLevel: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    const byFromUid: Record<string, number> = {};

    for (const c of mlmCommissions) {
      const amt = Number(c.commissionUsd || 0);
      const lvl = c.commissionType === 'mentor' ? 1 : Number(c.level || 1);
      if (lvl === 1 || lvl === 2 || lvl === 3) {
        byLevel[lvl] = (byLevel[lvl] || 0) + amt;
      }
      if (c.fromUid) {
        byFromUid[c.fromUid] = (byFromUid[c.fromUid] || 0) + amt;
      }
    }

    return { byLevel, byFromUid };
  }, [mlmCommissions]);

  // 1) Tier distribution (Level 1 Direct, Level 2, Level 3)
  const tierChartData = useMemo<ChartDatum[]>(() => {
    const tiers: Array<{ level: 1 | 2 | 3; label: string; sublabel: string }> = [
      { level: 1, label: 'Level 1 (Direct)', sublabel: 'Counts toward Mentor Unlock' },
      { level: 2, label: 'Level 2', sublabel: 'Second-tier downline' },
      { level: 3, label: 'Level 3', sublabel: 'Third-tier downline' },
    ];

    return tiers.map(({ level, label, sublabel }) => {
      const members = downlineReferrals.filter((r) => Number(r.level) === level);
      const funded = members.filter((r) => Number(r.totalInvestedUsd || 0) > 0);
      const rawVolume = members.reduce((sum, r) => sum + Number(r.totalInvestedUsd || 0), 0);
      // Keep L1 aligned if mentorBroughtVolume reflects additional credited volume
      const volumeUsd = level === 1 ? Math.max(rawVolume, Number(mentorBroughtVolume || 0)) : rawVolume;
      return {
        label,
        sublabel,
        users: members.length,
        fundedUsers: funded.length,
        volumeUsd: Number(volumeUsd.toFixed(2)),
        commissionsUsd: Number((commissionMaps.byLevel[level] || 0).toFixed(2)),
      };
    });
  }, [downlineReferrals, commissionMaps.byLevel, mentorBroughtVolume]);

  // 2) Volume-band distribution across all referred users
  const bandChartData = useMemo<ChartDatum[]>(() => {
    const bands: Array<{
      label: string;
      sublabel: string;
      min: number;
      max: number;
    }> = [
      { label: '$0 Reg.', sublabel: 'Registered · Not yet funded', min: 0, max: 0 },
      { label: '$1–$499', sublabel: 'Starter volume bracket', min: 0.01, max: 499.99 },
      { label: '$500–$2.4K', sublabel: 'Growth volume bracket', min: 500, max: 2499.99 },
      { label: '$2.5K–$9.9K', sublabel: 'Pro volume bracket', min: 2500, max: 9999.99 },
      { label: '$10K+', sublabel: 'Institutional / VIP bracket', min: 10000, max: Infinity },
    ];

    return bands.map((band) => {
      const members = downlineReferrals.filter((r) => {
        const vol = Number(r.totalInvestedUsd || 0);
        if (band.max === 0) return vol <= 0;
        return vol >= band.min && vol <= band.max;
      });
      const funded = members.filter((r) => Number(r.totalInvestedUsd || 0) > 0);
      const volumeUsd = members.reduce((sum, r) => sum + Number(r.totalInvestedUsd || 0), 0);
      const commissionsUsd = members.reduce(
        (sum, r) => sum + Number(commissionMaps.byFromUid[r.refereeUid] || 0),
        0
      );
      return {
        label: band.label,
        sublabel: band.sublabel,
        users: members.length,
        fundedUsers: funded.length,
        volumeUsd: Number(volumeUsd.toFixed(2)),
        commissionsUsd: Number(commissionsUsd.toFixed(2)),
      };
    });
  }, [downlineReferrals, commissionMaps.byFromUid]);

  // 3) Top 8 contributors by trading volume
  const topContributorsData = useMemo<ChartDatum[]>(() => {
    const ranked = [...downlineReferrals]
      .sort((a, b) => Number(b.totalInvestedUsd || 0) - Number(a.totalInvestedUsd || 0))
      .slice(0, 8);

    return ranked.map((r) => {
      const vol = Number(r.totalInvestedUsd || 0);
      const shortName = r.refereeHandle
        ? `@${r.refereeHandle.slice(0, 12)}`
        : r.refereeName.slice(0, 12);
      return {
        label: shortName,
        sublabel: `${r.refereeName} · Level ${r.level}`,
        users: 1,
        fundedUsers: vol > 0 ? 1 : 0,
        volumeUsd: Number(vol.toFixed(2)),
        commissionsUsd: Number((commissionMaps.byFromUid[r.refereeUid] || 0).toFixed(2)),
      };
    });
  }, [downlineReferrals, commissionMaps.byFromUid]);

  const activeData =
    viewMode === 'tiers'
      ? tierChartData
      : viewMode === 'bands'
      ? bandChartData
      : topContributorsData;

  const summary = useMemo(() => {
    const totalUsers = downlineReferrals.length;
    const fundedUsers = downlineReferrals.filter((r) => Number(r.totalInvestedUsd || 0) > 0).length;
    const rawNetworkVolume = downlineReferrals.reduce(
      (sum, r) => sum + Number(r.totalInvestedUsd || 0),
      0
    );
    const totalVolumeUsd = Math.max(rawNetworkVolume, Number(mentorBroughtVolume || 0));
    const l1Volume = tierChartData[0]?.volumeUsd || 0;
    const l1SharePct = totalVolumeUsd > 0 ? (l1Volume / totalVolumeUsd) * 100 : 0;
    const avgPerFunded = fundedUsers > 0 ? totalVolumeUsd / fundedUsers : 0;
    const fundedRatePct = totalUsers > 0 ? (fundedUsers / totalUsers) * 100 : 0;
    const unlockPct =
      mentorRequiredVolume > 0
        ? Math.min(100, (Number(mentorBroughtVolume || 0) / mentorRequiredVolume) * 100)
        : 100;

    return {
      totalUsers,
      fundedUsers,
      totalVolumeUsd,
      l1SharePct,
      avgPerFunded,
      fundedRatePct,
      unlockPct,
    };
  }, [downlineReferrals, mentorBroughtVolume, mentorRequiredVolume, tierChartData]);

  const hasChartActivity =
    downlineReferrals.length > 0 || Number(mentorBroughtVolume || 0) > 0;

  return (
    <section
      aria-label="Referral Distribution and Trading Volume Analytics"
      className="bg-[#0B111E] border border-slate-800 rounded-xl p-5 sm:p-6 space-y-5"
    >
      {/* Header & Mode Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-400 shrink-0" />
            <h3 className="font-display font-semibold text-base text-white">
              Referral Analytics — User Distribution &amp; Trading Volume
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            Live breakdown of referred investors and cumulative trading volume across your Mentor downline network.
          </p>
        </div>

        <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-900 border border-slate-800 text-xs self-start lg:self-auto">
          {(
            [
              { id: 'tiers', label: 'By Tier (L1–L3)', Icon: Layers },
              { id: 'bands', label: 'By Volume Band', Icon: TrendingUp },
              { id: 'contributors', label: 'Top Contributors', Icon: Users },
            ] as const
          ).map(({ id, label, Icon }) => {
            const active = viewMode === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setViewMode(id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Compact Metric Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-slate-800/90 bg-slate-950/60 px-3.5 py-3">
          <div className="text-[11px] text-slate-400">Referred Users</div>
          <div className="mt-1 font-mono font-bold text-lg text-white tabular-nums">
            {summary.totalUsers}
            <span className="ml-1.5 text-xs font-normal text-emerald-400">
              ({summary.fundedUsers} funded)
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800/90 bg-slate-950/60 px-3.5 py-3">
          <div className="text-[11px] text-slate-400">Network Trading Volume</div>
          <div className="mt-1 font-mono font-bold text-lg text-amber-400 tabular-nums">
            {formatFullUsd(summary.totalVolumeUsd)}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800/90 bg-slate-950/60 px-3.5 py-3">
          <div className="text-[11px] text-slate-400">Avg. Volume / Funded User</div>
          <div className="mt-1 font-mono font-bold text-lg text-sky-400 tabular-nums">
            {formatFullUsd(summary.avgPerFunded)}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800/90 bg-slate-950/60 px-3.5 py-3">
          <div className="text-[11px] text-slate-400">
            {mentorRequiredVolume > 0 ? 'Unlock Target Progress' : 'Funded Conversion Rate'}
          </div>
          <div className="mt-1 font-mono font-bold text-lg text-emerald-400 tabular-nums">
            {mentorRequiredVolume > 0
              ? `${summary.unlockPct.toFixed(1)}%`
              : `${summary.fundedRatePct.toFixed(1)}%`}
            <span className="ml-1.5 text-xs font-normal text-slate-400">
              L1 {summary.l1SharePct.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {/* Bar Chart Container */}
      <div className="relative rounded-xl border border-slate-800/90 bg-[#070C18]/70 p-4">
        {viewMode === 'contributors' && topContributorsData.length === 0 ? (
          <div className="h-[280px] flex flex-col items-center justify-center text-center px-4 space-y-2">
            <Users className="w-8 h-8 text-slate-600" />
            <p className="text-sm font-medium text-slate-200">
              No referred investors to rank yet
            </p>
            <p className="text-xs text-slate-400 max-w-md">
              Once clients sign up via your Mentor Referral Link and activate trading packages, your highest-volume contributors will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={activeData}
                margin={{ top: 14, right: 16, left: 2, bottom: 6 }}
                barGap={6}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={{ stroke: '#334155' }}
                  tickLine={false}
                />
                {viewMode !== 'contributors' && (
                  <YAxis
                    yAxisId="users"
                    orientation="left"
                    allowDecimals={false}
                    tick={{ fill: '#38bdf8', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                )}
                <YAxis
                  yAxisId="volume"
                  orientation={viewMode === 'contributors' ? 'left' : 'right'}
                  tickFormatter={(v: number) => formatCompactUsd(v)}
                  tick={{ fill: '#f59e0b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip
                  content={<AnalyticsTooltip />}
                  cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px', color: '#cbd5e1' }}
                />
                {viewMode !== 'contributors' && (
                  <Bar
                    yAxisId="users"
                    dataKey="users"
                    name="Referred Users"
                    fill="#38bdf8"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={36}
                  />
                )}
                {viewMode !== 'contributors' && (
                  <Bar
                    yAxisId="users"
                    dataKey="fundedUsers"
                    name="Funded Users"
                    fill="#10b981"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={36}
                  />
                )}
                <Bar
                  yAxisId="volume"
                  dataKey="volumeUsd"
                  name="Trading Volume (USD)"
                  fill="#f59e0b"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {!hasChartActivity && viewMode !== 'contributors' && (
          <div className="mt-2 text-center text-[11px] text-slate-400">
            Bars reflect live Firestore data and update automatically as your referred investors sign up and fund packages.
          </div>
        )}
      </div>

      {/* Per-Tier Summary Row (Always visible for quick scanning) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {tierChartData.map((row) => {
          const fundedRatio = row.users > 0 ? (row.fundedUsers / row.users) * 100 : 0;
          return (
            <div
              key={row.label}
              className="rounded-lg border border-slate-800/80 bg-slate-900/40 px-4 py-3 flex items-center justify-between gap-3 text-xs"
            >
              <div className="min-w-0">
                <div className="font-semibold text-white">{row.label}</div>
                <div className="text-[11px] text-slate-400 mt-0.5 font-mono tabular-nums">
                  {row.users} users · {row.fundedUsers} funded ({fundedRatio.toFixed(0)}%)
                </div>
              </div>
              <div className="text-right font-mono tabular-nums shrink-0">
                <div className="font-semibold text-amber-400">{formatFullUsd(row.volumeUsd)}</div>
                <div className="text-[11px] text-emerald-400">
                  +{formatFullUsd(row.commissionsUsd)} comm.
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
