import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Cpu,
  Flame,
  Gauge,
  Layers,
  Move3d,
  RefreshCw,
  RotateCw,
  ShieldCheck,
  Sparkles,
  Thermometer,
  Zap,
} from 'lucide-react';
import { DEFAULT_BOOSTER_CONFIG } from '../constants/defaults';
import { usePlatform } from '../context/PlatformContext';
import { BoosterNode, BoosterTierConfig, PackageFundingSource } from '../types/platform';
import { computeInvestmentMetrics } from '../utils/investmentMath';
import { BoosterWalkthroughMotion } from './BoosterWalkthroughMotion';

interface BoosterEngineViewProps {
  compactPreview?: boolean;
  onOpenFullPage?: () => void;
  onRequireAuth?: () => void;
}

const ACCENT_RING: Record<
  BoosterTierConfig['accent'],
  { primary: string; secondary: string; badge: string; border: string }
> = {
  sky: {
    primary: '#38bdf8',
    secondary: '#14b8a6',
    badge: 'text-sky-300 border-sky-500/40 bg-sky-500/10',
    border: 'border-sky-500/50',
  },
  teal: {
    primary: '#14b8a6',
    secondary: '#f59e0b',
    badge: 'text-teal-300 border-teal-500/40 bg-teal-500/10',
    border: 'border-teal-500/50',
  },
  amber: {
    primary: '#f59e0b',
    secondary: '#10b981',
    badge: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
    border: 'border-amber-500/50',
  },
  violet: {
    primary: '#a855f7',
    secondary: '#f59e0b',
    badge: 'text-violet-300 border-violet-500/40 bg-violet-500/10',
    border: 'border-violet-500/50',
  },
};

export const BoosterEngineView: React.FC<BoosterEngineViewProps> = ({
  compactPreview = false,
  onOpenFullPage,
  onRequireAuth,
}) => {
  const {
    authUser,
    userProfile,
    platformConfig,
    boosterNodes,
    activateBoosterNode,
    claimBoosterProfit,
    toggleBoosterNodeTurbo,
  } = usePlatform();

  const boosterConfig = platformConfig.boosterConfig || DEFAULT_BOOSTER_CONFIG;
  const boosterName =
    platformConfig.boosterBrandName?.trim() ||
    boosterConfig.brandName?.trim() ||
    DEFAULT_BOOSTER_CONFIG.brandName;
  const enabledTiers = useMemo(
    () => (boosterConfig.tiers || DEFAULT_BOOSTER_CONFIG.tiers).filter((t) => t.enabled !== false),
    [boosterConfig.tiers]
  );

  const [selectedTierId, setSelectedTierId] = useState<string>(enabledTiers[2]?.id || enabledTiers[0]?.id || 'spark-core');
  const [fundingSource, setFundingSource] = useState<PackageFundingSource>('deposit_wallet');
  const [autoRotate, setAutoRotate] = useState(true);
  const [turboMode, setTurboMode] = useState(true);
  const [rotY, setRotY] = useState(18);
  const [rotX, setRotX] = useState(14);
  const [ringAngle, setRingAngle] = useState(0);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const draggingRef = useRef<{ active: boolean; lastX: number; lastY: number }>({
    active: false,
    lastX: 0,
    lastY: 0,
  });

  const selectedTier = useMemo(
    () => enabledTiers.find((t) => t.id === selectedTierId) || enabledTiers[0] || DEFAULT_BOOSTER_CONFIG.tiers[0],
    [enabledTiers, selectedTierId]
  );

  // Smooth requestAnimationFrame rotation for twin counter-rotating energy rings & optional Auto 360° core orbit
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      const speedFactor = turboMode ? 76 : 36;
      setRingAngle((prev) => (prev + dt * speedFactor) % 360);
      if (autoRotate && !draggingRef.current.active) {
        setRotY((prev) => (prev + dt * (turboMode ? 28 : 14)) % 360);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [autoRotate, turboMode]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current.active) return;
    const dx = e.clientX - draggingRef.current.lastX;
    const dy = e.clientY - draggingRef.current.lastY;
    draggingRef.current.lastX = e.clientX;
    draggingRef.current.lastY = e.clientY;
    setRotY((prev) => (prev + dx * 0.65) % 360);
    setRotX((prev) => Math.max(-42, Math.min(42, prev - dy * 0.45)));
  };

  const handlePointerUp = () => {
    draggingRef.current.active = false;
  };

  const handleActivate = async (tier: BoosterTierConfig) => {
    if (!authUser || !userProfile) {
      onRequireAuth?.();
      return;
    }
    setActivatingId(tier.id);
    setFeedback(null);
    try {
      await activateBoosterNode(tier, fundingSource, turboMode);
      setFeedback({
        type: 'ok',
        msg: `${boosterName} · ${tier.name} ($${tier.capital}) activated and synced to the 200 Mon–Fri settlement cycle.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        msg: err instanceof Error ? err.message : 'Unable to activate booster node.',
      });
    } finally {
      setActivatingId(null);
    }
  };

  const handleClaimNode = async (node: BoosterNode) => {
    setClaimingId(node.id);
    setFeedback(null);
    try {
      const amt = await claimBoosterProfit(node);
      setFeedback({
        type: 'ok',
        msg: `Claimed $${amt.toFixed(2)} weekday settlement from ${node.tierName} into your Income Wallet.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        msg: err instanceof Error ? err.message : 'No rewards available to claim yet.',
      });
    } finally {
      setClaimingId(null);
    }
  };

  const ringStyle = ACCENT_RING[selectedTier.accent] || ACCENT_RING.amber;

  // Aggregate telemetry for user's active nodes or selected preview tier
  const activeUserNodes = useMemo(
    () => boosterNodes.filter((n) => n.status === 'active'),
    [boosterNodes]
  );

  const avgCycleProgress = useMemo(() => {
    if (activeUserNodes.length === 0) return turboMode ? 68.4 : 42.0;
    const sumPct = activeUserNodes.reduce((acc, n) => {
      const m = computeInvestmentMetrics(
        {
          id: n.id,
          uid: n.uid,
          packageNumber: 1,
          packageId: n.tierId,
          packageName: n.tierName,
          capital: n.capital,
          dailyPercent: n.dailyPercent,
          aiMode: n.boostPowerLabel,
          totalProfitDays: n.totalProfitDays,
          capitalLockDays: n.capitalLockDays,
          isMentorGifted: false,
          claimedProfit: n.claimedProfit,
          status: n.status,
          startedAtMs: n.startedAtMs,
        },
        platformConfig.globalPaused
      );
      return acc + m.progressPercent;
    }, 0);
    return sumPct / activeUserNodes.length;
  }, [activeUserNodes, turboMode, platformConfig.globalPaused]);

  if (!boosterConfig.enabled) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
        <p className="text-sm text-slate-400">
          {boosterName} is currently paused by platform administration.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      {/* Main 360° Booster Core Visualizer & Telemetry Console */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5 sm:p-7 overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
              <Cpu className="h-3.5 w-3.5" />
              <span>AlphaTradex Proprietary Compute Engine · alphatradex.pro</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {boosterName} 360° Core Matrix
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
              {boosterConfig.tagline ||
                'Precision 360° compute telemetry synced to the 200 Mon–Fri profit-day settlement engine and L1–L3 referral attribution.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAutoRotate((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                autoRotate
                  ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
                  : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              <RotateCw className="h-3.5 w-3.5" />
              <span>Auto 360°: {autoRotate ? 'ON' : 'OFF'}</span>
            </button>

            <button
              type="button"
              onClick={() => setTurboMode((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                turboMode
                  ? 'border-teal-500/50 bg-teal-500/15 text-teal-300'
                  : 'border-slate-800 bg-slate-900 text-slate-300 hover:text-white'
              }`}
            >
              <Flame className="h-3.5 w-3.5" />
              <span>Mode: {turboMode ? 'Turbo' : 'Standard'}</span>
            </button>

            {compactPreview && onOpenFullPage && (
              <button
                type="button"
                onClick={onOpenFullPage}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors"
              >
                Launch Full {boosterName}
              </button>
            )}
          </div>
        </div>

        {/* 2-Column Core Stage + Live Telemetry Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6 items-center">
          {/* Interactive 360° Drag-Rotatable Core Visualizer */}
          <div className="lg:col-span-6">
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              style={{ perspective: '950px', touchAction: 'none' }}
              className="relative h-72 sm:h-80 rounded-2xl border border-slate-800/90 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.12)_0%,rgba(15,23,42,0.95)_62%,rgba(2,6,23,1)_100%)] flex items-center justify-center cursor-grab active:cursor-grabbing select-none overflow-hidden"
            >
              {/* Subtle Radial Grid Backdrop */}
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 50% 50%, rgba(148,163,184,0.35) 1px, transparent 1px)',
                  backgroundSize: '22px 22px',
                }}
              />

              {/* Harmonic Pulse Waves */}
              <div
                style={{
                  borderColor: `${ringStyle.primary}38`,
                  animationDuration: turboMode ? '1.8s' : '3.2s',
                }}
                className="absolute h-56 w-56 rounded-full border animate-ping pointer-events-none"
              />
              <div
                style={{
                  borderColor: `${ringStyle.secondary}30`,
                  animationDuration: turboMode ? '2.4s' : '4.2s',
                }}
                className="absolute h-40 w-40 rounded-full border animate-pulse pointer-events-none"
              />

              {/* 3D Rotatable Core Assembly */}
              <div
                style={{
                  transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
                  transformStyle: 'preserve-3d',
                }}
                className="relative h-56 w-56 flex items-center justify-center transition-transform duration-75"
              >
                {/* Twin Counter-Rotating Ring 1 (Outer Precision Gold/Primary Arc) */}
                <svg
                  viewBox="0 0 220 220"
                  style={{
                    transform: `rotateZ(${ringAngle}deg) translateZ(18px)`,
                  }}
                  className="absolute inset-0 h-full w-full pointer-events-none"
                >
                  <circle
                    cx="110"
                    cy="110"
                    r="100"
                    fill="none"
                    stroke={ringStyle.primary}
                    strokeWidth="2.5"
                    strokeDasharray="24 10 8 10"
                    strokeLinecap="round"
                    opacity="0.9"
                  />
                  <circle
                    cx="110"
                    cy="110"
                    r="90"
                    fill="none"
                    stroke={ringStyle.primary}
                    strokeWidth="1"
                    strokeDasharray="4 8"
                    opacity="0.45"
                  />
                </svg>

                {/* Twin Counter-Rotating Ring 2 (Inner Harmonic Teal/Secondary Orbital) */}
                <svg
                  viewBox="0 0 220 220"
                  style={{
                    transform: `rotateX(58deg) rotateZ(${-ringAngle * 1.45}deg) translateZ(8px)`,
                  }}
                  className="absolute inset-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)] pointer-events-none"
                >
                  <circle
                    cx="110"
                    cy="110"
                    r="92"
                    fill="none"
                    stroke={ringStyle.secondary}
                    strokeWidth="3.2"
                    strokeDasharray="42 16 14 16"
                    strokeLinecap="round"
                    opacity="0.95"
                  />
                </svg>

                {/* Third Orthogonal Stabilizer Ring */}
                <svg
                  viewBox="0 0 220 220"
                  style={{
                    transform: `rotateY(64deg) rotateZ(${ringAngle * 0.9}deg)`,
                  }}
                  className="absolute inset-7 h-[calc(100%-3.5rem)] w-[calc(100%-3.5rem)] pointer-events-none"
                >
                  <circle
                    cx="110"
                    cy="110"
                    r="86"
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="1.5"
                    strokeDasharray="12 18"
                    opacity="0.35"
                  />
                </svg>

                {/* Central Precision Reactor Core */}
                <div
                  style={{
                    borderColor: `${ringStyle.primary}90`,
                    boxShadow: `0 0 36px ${ringStyle.primary}35, inset 0 0 24px ${ringStyle.secondary}35`,
                    transform: 'translateZ(26px)',
                  }}
                  className="h-24 w-24 rounded-2xl border-2 bg-slate-950/90 flex flex-col items-center justify-center text-center px-2"
                >
                  <Zap
                    style={{ color: ringStyle.primary }}
                    className="h-6 w-6 mb-0.5"
                  />
                  <span className="font-mono text-[10px] font-bold tracking-wider text-white uppercase truncate max-w-full">
                    {selectedTier.name.split(' ')[0]}
                  </span>
                  <span className="font-mono text-[10px] text-emerald-400 font-semibold">
                    {selectedTier.boostPowerLabel}
                  </span>
                </div>
              </div>

              {/* HUD Corner Overlays */}
              <div className="absolute top-3 left-3.5 flex items-center gap-1.5 text-[11px] font-mono text-slate-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{turboMode ? 'TURBO SYNC' : 'STANDARD SYNC'}</span>
              </div>
              <div className="absolute top-3 right-3.5 font-mono text-[11px] text-slate-400 tabular-nums">
                {Math.round(((rotY % 360) + 360) % 360)}° Y · {Math.round(rotX)}° X
              </div>
              <div className="absolute bottom-3 left-3.5 inline-flex items-center gap-1.5 text-[11px] text-slate-400">
                <Move3d className="h-3.5 w-3.5 text-amber-400" />
                <span>Drag core to inspect 360°</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setRotX(14);
                  setRotY(18);
                }}
                className="absolute bottom-2.5 right-3 px-2 py-1 rounded-md bg-slate-900/90 border border-slate-700 text-[10px] font-mono text-slate-300 hover:text-white"
              >
                Reset Angle
              </button>
            </div>
          </div>

          {/* Live Telemetry Readouts + Active Tier Preview */}
          <div className="lg:col-span-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-500">
                  Selected Compute Tier
                </p>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>{selectedTier.name}</span>
                  <span className={`text-[11px] font-mono px-2 py-0.5 rounded-md border ${ringStyle.badge}`}>
                    ${selectedTier.capital.toLocaleString()}
                  </span>
                </h3>
              </div>
              <span className="font-mono text-xs text-slate-400">
                {selectedTier.profitDays} Mon–Fri Days
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">{selectedTier.description}</p>

            {/* 4 Live Telemetry KPIs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Gauge className="h-3.5 w-3.5 text-amber-400" />
                  <span>Boost Power</span>
                </div>
                <p className="mt-1 font-mono text-lg font-bold text-white tabular-nums">
                  {selectedTier.boostPowerLabel}
                </p>
                <p className="text-[10px] font-mono text-amber-400/90">
                  {turboMode ? boosterConfig.turboBonusLabel || 'Harmonic Overclock' : 'Balanced Baseline'}
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Activity className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Daily Yield Rate</span>
                </div>
                <p className="mt-1 font-mono text-lg font-bold text-emerald-400 tabular-nums">
                  {selectedTier.dailyPercent.toFixed(2)}% / day
                </p>
                <p className="text-[10px] font-mono text-slate-400">
                  ≈ ${((selectedTier.capital * selectedTier.dailyPercent) / 100).toFixed(2)} Mon–Fri
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Layers className="h-3.5 w-3.5 text-sky-400" />
                  <span>Cycle Progress</span>
                </div>
                <p className="mt-1 font-mono text-lg font-bold text-sky-300 tabular-nums">
                  {activeUserNodes.length > 0
                    ? `${avgCycleProgress.toFixed(1)}%`
                    : `0 / ${selectedTier.profitDays}d`}
                </p>
                <div className="mt-1.5 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    style={{ width: `${Math.max(4, Math.min(100, avgCycleProgress))}%` }}
                    className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Thermometer className="h-3.5 w-3.5 text-teal-400" />
                  <span>Thermal Efficiency</span>
                </div>
                <p className="mt-1 font-mono text-lg font-bold text-teal-300 tabular-nums">
                  {selectedTier.thermalEfficiency}
                </p>
                <p className="text-[10px] font-mono text-slate-400">
                  {turboMode ? 'Active Harmonic Cooling' : 'Optimal Nominal Load'}
                </p>
              </div>
            </div>

            {/* Quick Tier Switcher Strip inside Core HUD */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {enabledTiers.map((tier) => (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setSelectedTierId(tier.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    tier.id === selectedTier.id
                      ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  {tier.name} · ${tier.capital}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs font-medium ${
            feedback.type === 'ok'
              ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
              : 'border-rose-500/35 bg-rose-500/10 text-rose-300'
          }`}
        >
          {feedback.msg}
        </div>
      )}

      {/* Distinct 4-Tier Allocation Matrix */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white">
              {boosterName} Compute Tiers
            </h3>
            <p className="text-xs text-slate-400">
              All tiers run on the 200 Mon–Fri profit-day engine and qualify for L1–L3 referral commissions ({platformConfig.mlmRates.level1}% / {platformConfig.mlmRates.level2}% / {platformConfig.mlmRates.level3}%).
            </p>
          </div>

          {authUser && !compactPreview && (
            <div className="inline-flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
              {(
                [
                  { id: 'deposit_wallet', label: `Deposit ($${(userProfile?.usdBalance || 0).toFixed(0)})` },
                  { id: 'income_wallet', label: `Income ($${(userProfile?.profitBalance || 0).toFixed(0)})` },
                  { id: 'combined', label: 'Combined' },
                ] as const
              ).map((src) => (
                <button
                  key={src.id}
                  type="button"
                  onClick={() => setFundingSource(src.id)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                    fundingSource === src.id
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {src.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {enabledTiers.map((tier) => {
            const style = ACCENT_RING[tier.accent] || ACCENT_RING.amber;
            const isSelected = tier.id === selectedTier.id;
            const dailyUsd = (tier.capital * tier.dailyPercent) / 100;
            const totalProjectedUsd = dailyUsd * tier.profitDays;
            return (
              <div
                key={tier.id}
                onClick={() => setSelectedTierId(tier.id)}
                className={`cursor-pointer rounded-2xl border p-5 flex flex-col justify-between gap-4 transition-all bg-slate-900/80 ${
                  isSelected ? `${style.border} shadow-lg shadow-amber-500/5` : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-base font-bold text-white">{tier.name}</h4>
                    <span className={`text-[11px] font-mono px-2 py-0.5 rounded-md border ${style.badge}`}>
                      {tier.boostPowerLabel}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-2xl font-bold text-white tabular-nums">
                      ${tier.capital.toLocaleString()}
                    </span>
                    <span className="text-xs text-slate-500">USDT</span>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed min-h-[42px]">
                    {tier.description}
                  </p>

                  <div className="space-y-1.5 pt-2 border-t border-slate-800 text-xs font-mono tabular-nums">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">Daily Yield (Mon–Fri)</span>
                      <span className="text-emerald-400 font-bold">
                        {tier.dailyPercent}% (${dailyUsd.toFixed(2)})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">200-Day Output</span>
                      <span className="text-amber-300 font-semibold">
                        ${totalProjectedUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">Thermal Rating</span>
                      <span className="text-slate-200">{tier.thermalEfficiency}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={activatingId === tier.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleActivate(tier);
                  }}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-colors ${
                    isSelected
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      : 'bg-slate-800 hover:bg-slate-700 text-white'
                  } disabled:opacity-50`}
                >
                  {!authUser
                    ? `Sign In to Activate`
                    : activatingId === tier.id
                    ? 'Syncing Node...'
                    : `Activate ${tier.name}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active User Booster Nodes Portfolio */}
      {!compactPreview && authUser && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <span>Your Active {boosterName} Nodes ({boosterNodes.length})</span>
              </h3>
              <p className="text-xs text-slate-400">
                Weekday profits accrue automatically Monday–Friday and can be claimed directly to your Income Wallet.
              </p>
            </div>
          </div>

          {boosterNodes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-xs text-slate-500">
              No {boosterName} nodes activated yet. Choose{' '}
              {enabledTiers.map((t) => t.name).join(', ') || 'an active compute tier'} above to start syncing.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {boosterNodes.map((node) => {
                const metrics = computeInvestmentMetrics(
                  {
                    id: node.id,
                    uid: node.uid,
                    packageNumber: 1,
                    packageId: node.tierId,
                    packageName: node.tierName,
                    capital: node.capital,
                    dailyPercent: node.dailyPercent,
                    aiMode: node.boostPowerLabel,
                    totalProfitDays: node.totalProfitDays,
                    capitalLockDays: node.capitalLockDays,
                    isMentorGifted: false,
                    claimedProfit: node.claimedProfit,
                    status: node.status,
                    startedAtMs: node.startedAtMs,
                  },
                  platformConfig.globalPaused
                );
                return (
                  <div
                    key={node.id}
                    className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-white">
                          {node.tierName}{' '}
                          <span className="font-mono text-xs text-amber-400">
                            ${node.capital.toLocaleString()}
                          </span>
                        </p>
                        <p className="text-[11px] font-mono text-slate-400">
                          {node.boostPowerLabel} · {node.dailyPercent}%/day ·{' '}
                          {metrics.completedProfitDays}/{node.totalProfitDays} weekdays
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleBoosterNodeTurbo(node.id, !node.turboMode)}
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${
                          node.turboMode
                            ? 'border-teal-500/40 bg-teal-500/10 text-teal-300'
                            : 'border-slate-700 bg-slate-900 text-slate-400'
                        }`}
                      >
                        {node.turboMode ? 'Turbo ON' : 'Standard'}
                      </button>
                    </div>

                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        style={{ width: `${Math.min(100, metrics.progressPercent)}%` }}
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-400"
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                      <div>
                        <span className="text-slate-500 font-sans">Claimed: </span>
                        <span className="text-slate-200">${node.claimedProfit.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-sans">Ready: </span>
                        <span className="text-emerald-400 font-bold">
                          ${metrics.unclaimedProfit.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={claimingId === node.id || metrics.unclaimedProfit < 0.01}
                      onClick={() => handleClaimNode(node)}
                      className="w-full py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
                    >
                      {node.status === 'completed' ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Cycle Completed</span>
                        </>
                      ) : claimingId === node.id ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>Settling Profit...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-3.5 w-3.5" />
                          <span>Claim ${metrics.unclaimedProfit.toFixed(2)} Weekday Reward</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Interactive "How [BoosterName] Works" Framer Motion Walkthrough */}
      {!compactPreview && <BoosterWalkthroughMotion />}
    </section>
  );
};
