import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  Bell,
  BellRing,
  Calculator,
  Calendar,
  CheckCircle2,
  Clock,
  Gift,
  Loader2,
  Mail,
  Pause,
  Play,
  RefreshCw,
  Repeat,
  RotateCcw,
  Sparkles,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  Unlock,
  Zap,
} from 'lucide-react';
import {
  AutoCompoundConfig,
  Investment,
  InvestmentPackage,
  PlatformConfig,
  PriceAlert,
  PriceAlertCondition,
  PriceAlertSymbol,
  PromoRedemption,
  UserProfile,
} from '../types/platform';
import {
  computeInvestmentMetrics,
  estimateCompletionDate,
  formatTimestamp,
  isWeekendDate,
} from '../utils/investmentMath';
import {
  ALERT_SYMBOLS_META,
  fetchAllLiveAlertPrices,
  formatAlertPrice,
  LivePriceQuote,
} from '../utils/livePriceFeed';

interface InvestorToolsHubProps {
  userProfile: UserProfile;
  platformConfig: PlatformConfig;
  investments: Investment[];
  priceAlerts: PriceAlert[];
  promoRedemptions: PromoRedemption[];
  initialSubTab?: 'calculator' | 'auto-reinvest' | 'price-alerts';
  onSaveAutoCompoundConfig: (cfg: AutoCompoundConfig) => Promise<void>;
  onExecuteAutoCompoundNow: () => Promise<{
    claimedUsd: number;
    amountCompoundedUsd: number;
    actionSummary: string;
  }>;
  onCreatePriceAlert: (params: {
    symbol: PriceAlertSymbol;
    condition: PriceAlertCondition;
    targetPrice: number;
    notifyEmail: boolean;
    notifyInApp: boolean;
    note?: string;
  }) => Promise<void>;
  onUpdatePriceAlert: (
    alertId: string,
    patch: Partial<
      Pick<
        PriceAlert,
        | 'condition'
        | 'targetPrice'
        | 'notifyEmail'
        | 'notifyInApp'
        | 'status'
        | 'triggeredPrice'
        | 'triggeredAtMs'
        | 'emailSent'
        | 'note'
      >
    >
  ) => Promise<void>;
  onDeletePriceAlert: (alertId: string) => Promise<void>;
  onRedeemBonusPromoCode: (code: string) => Promise<{
    code: string;
    bonusUsd: number;
    creditedWallet: string;
    message: string;
  }>;
  onOpenActivateTrading: () => void;
  onNotify: (type: 'ok' | 'err', text: string) => void;
}

const MS_PER_DAY = 86_400_000;

function addWeekdays(startMs: number, weekdays: number): Date {
  const cursor = new Date(startMs);
  cursor.setHours(12, 0, 0, 0);
  let count = 0;
  while (count < weekdays) {
    cursor.setTime(cursor.getTime() + MS_PER_DAY);
    if (!isWeekendDate(cursor)) {
      count += 1;
    }
  }
  return cursor;
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export const InvestorToolsHub: React.FC<InvestorToolsHubProps> = ({
  userProfile,
  platformConfig,
  investments,
  priceAlerts,
  promoRedemptions,
  initialSubTab = 'calculator',
  onSaveAutoCompoundConfig,
  onExecuteAutoCompoundNow,
  onCreatePriceAlert,
  onUpdatePriceAlert,
  onDeletePriceAlert,
  onRedeemBonusPromoCode,
  onOpenActivateTrading,
  onNotify,
}) => {
  const [subTab, setSubTab] = useState<'calculator' | 'auto-reinvest' | 'price-alerts'>(
    initialSubTab
  );

  // =========================================================================
  // 1. INTERACTIVE PROFIT & UNLOCK SCHEDULE CALCULATOR STATE
  // =========================================================================
  const packages = platformConfig.packages || [];
  const defaultPkg: InvestmentPackage | undefined = packages[0];

  const [selectedPkgId, setSelectedPkgId] = useState<string>(defaultPkg?.id || 'custom');
  const [calcCapital, setCalcCapital] = useState<number>(defaultPkg?.capital || 500);
  const [calcDailyPct, setCalcDailyPct] = useState<number>(defaultPkg?.dailyPercent || 1.2);
  const [calcProfitDays, setCalcProfitDays] = useState<number>(defaultPkg?.profitDays || 200);
  const [calcLockDays, setCalcLockDays] = useState<number>(defaultPkg?.capitalLockDays || 200);
  const [calcStartDate, setCalcStartDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [simulateCompounding, setSimulateCompounding] = useState<boolean>(true);
  const [compoundThreshold, setCompoundThreshold] = useState<number>(100);

  const handleSelectPackagePreset = (pkg: InvestmentPackage) => {
    setSelectedPkgId(pkg.id);
    setCalcCapital(pkg.capital);
    setCalcDailyPct(pkg.dailyPercent);
    setCalcProfitDays(pkg.profitDays || 200);
    setCalcLockDays(pkg.capitalLockDays || 200);
  };

  const calcProjection = useMemo(() => {
    const cap = Math.max(10, Number(calcCapital) || 100);
    const rate = Math.max(0.05, Math.min(20, Number(calcDailyPct) || 1));
    const totalDays = Math.max(10, Math.min(500, Math.round(Number(calcProfitDays) || 200)));
    const lockDays = Math.max(1, Math.min(1000, Math.round(Number(calcLockDays) || 200)));
    const startMs = new Date(`${calcStartDate}T12:00:00`).getTime() || Date.now();
    const thresh = Math.max(25, Number(compoundThreshold) || 100);

    const dailyUsd = Number(((cap * rate) / 100).toFixed(2));
    const weeklyUsd = Number((dailyUsd * 5).toFixed(2));
    const monthlyUsd = Number((dailyUsd * 21.5).toFixed(2));
    const totalSimpleProfit = Number((dailyUsd * totalDays).toFixed(2));
    const breakEvenWeekday = Math.ceil(cap / Math.max(0.01, dailyUsd));

    const completionDate = estimateCompletionDate(startMs, totalDays);
    const unlockDate = new Date(startMs + lockDays * MS_PER_DAY);
    const breakEvenDate =
      breakEvenWeekday <= totalDays ? addWeekdays(startMs, breakEvenWeekday) : null;

    // Simulate simple vs auto-compounding day-by-day across weekdays
    let compPrincipal = cap;
    let compPocket = 0;
    let compTotalEarned = 0;
    let compReinvestCount = 0;

    const chartPoints: Array<{
      day: string;
      weekday: number;
      simpleProfit: number;
      compoundedProfit: number;
      compoundedCapital: number;
    }> = [
      {
        day: 'Day 0',
        weekday: 0,
        simpleProfit: 0,
        compoundedProfit: 0,
        compoundedCapital: cap,
      },
    ];

    const step = Math.max(1, Math.floor(totalDays / 25));
    for (let d = 1; d <= totalDays; d++) {
      const todayCompProfit = (compPrincipal * rate) / 100;
      compPocket += todayCompProfit;
      compTotalEarned += todayCompProfit;
      if (simulateCompounding && compPocket >= thresh) {
        const blocks = Math.floor(compPocket / thresh);
        const addAmt = blocks * thresh;
        compPrincipal += addAmt;
        compPocket -= addAmt;
        compReinvestCount += blocks;
      }
      if (d % step === 0 || d === totalDays) {
        chartPoints.push({
          day: `D${d}`,
          weekday: d,
          simpleProfit: Number((dailyUsd * d).toFixed(2)),
          compoundedProfit: Number(compTotalEarned.toFixed(2)),
          compoundedCapital: Number(compPrincipal.toFixed(2)),
        });
      }
    }

    const milestoneDays = Array.from(
      new Set([
        Math.min(20, totalDays),
        Math.min(50, totalDays),
        ...(breakEvenWeekday <= totalDays ? [breakEvenWeekday] : []),
        Math.min(100, totalDays),
        Math.min(150, totalDays),
        totalDays,
      ])
    ).sort((a, b) => a - b);

    const milestones = milestoneDays.map((wd) => {
      const dt = addWeekdays(startMs, wd);
      const earned = Number((dailyUsd * wd).toFixed(2));
      const roiPct = Number(((earned / cap) * 100).toFixed(1));
      const tag =
        wd === breakEvenWeekday
          ? '100% Principal Break-Even'
          : wd === totalDays
          ? 'Full Cycle Maturity'
          : wd === 20
          ? '1st Trading Month'
          : wd === 100
          ? 'Halfway Milestone'
          : `Weekday ${wd}`;
      return {
        weekday: wd,
        dateLabel: formatShortDate(dt),
        earnedUsd: earned,
        roiPct,
        tag,
        isCapitalUnlocked: dt.getTime() >= unlockDate.getTime(),
      };
    });

    return {
      cap,
      rate,
      totalDays,
      lockDays,
      dailyUsd,
      weeklyUsd,
      monthlyUsd,
      totalSimpleProfit,
      totalSimpleReturn: Number((cap + totalSimpleProfit).toFixed(2)),
      compTotalEarned: Number(compTotalEarned.toFixed(2)),
      compFinalPrincipal: Number(compPrincipal.toFixed(2)),
      compReinvestCount,
      breakEvenWeekday,
      breakEvenDateLabel: breakEvenDate ? formatShortDate(breakEvenDate) : 'Beyond cycle',
      unlockDateLabel: formatShortDate(unlockDate),
      completionDateLabel: formatShortDate(completionDate),
      chartPoints,
      milestones,
    };
  }, [
    calcCapital,
    calcDailyPct,
    calcProfitDays,
    calcLockDays,
    calcStartDate,
    simulateCompounding,
    compoundThreshold,
  ]);

  // =========================================================================
  // 2. AUTO-REINVEST / COMPOUNDING RULES STATE
  // =========================================================================
  const existingAuto = userProfile.autoCompoundConfig;
  const [autoEnabled, setAutoEnabled] = useState<boolean>(Boolean(existingAuto?.enabled));
  const [autoMode, setAutoMode] = useState<'route_to_deposit' | 'auto_activate_package'>(
    existingAuto?.mode || 'route_to_deposit'
  );
  const [autoThreshold, setAutoThreshold] = useState<string>(
    String(existingAuto?.thresholdUsd || 100)
  );
  const [autoTargetPkgId, setAutoTargetPkgId] = useState<string>(
    existingAuto?.targetPackageId || packages[0]?.id || ''
  );
  const [autoClaimFirst, setAutoClaimFirst] = useState<boolean>(
    existingAuto?.autoClaimOnThreshold ?? true
  );
  const [savingAuto, setSavingAuto] = useState<boolean>(false);
  const [runningAuto, setRunningAuto] = useState<boolean>(false);

  useEffect(() => {
    if (!userProfile.autoCompoundConfig) return;
    setAutoEnabled(Boolean(userProfile.autoCompoundConfig.enabled));
    setAutoMode(userProfile.autoCompoundConfig.mode || 'route_to_deposit');
    setAutoThreshold(String(userProfile.autoCompoundConfig.thresholdUsd || 100));
    if (userProfile.autoCompoundConfig.targetPackageId) {
      setAutoTargetPkgId(userProfile.autoCompoundConfig.targetPackageId);
    }
    setAutoClaimFirst(userProfile.autoCompoundConfig.autoClaimOnThreshold ?? true);
  }, [userProfile.autoCompoundConfig]);

  const totalUnclaimedProfit = useMemo(() => {
    return investments
      .filter((inv) => inv.status === 'active')
      .reduce(
        (sum, inv) => sum + computeInvestmentMetrics(inv, platformConfig.globalPaused).unclaimedProfit,
        0
      );
  }, [investments, platformConfig.globalPaused]);

  const targetAutoPkg = useMemo(
    () => packages.find((p) => p.id === autoTargetPkgId) || packages[0],
    [packages, autoTargetPkgId]
  );

  const effectiveAutoTargetUsd = useMemo(() => {
    const t = Math.max(10, Number(autoThreshold) || 100);
    if (autoMode === 'auto_activate_package' && targetAutoPkg) {
      return Math.max(t, targetAutoPkg.capital);
    }
    return t;
  }, [autoMode, autoThreshold, targetAutoPkg]);

  const eligibleForCompoundingUsd = useMemo(() => {
    return Number(
      (userProfile.profitBalance + (autoClaimFirst ? totalUnclaimedProfit : 0)).toFixed(2)
    );
  }, [userProfile.profitBalance, totalUnclaimedProfit, autoClaimFirst]);

  const autoProgressPct = Math.min(
    100,
    Math.round((eligibleForCompoundingUsd / Math.max(1, effectiveAutoTargetUsd)) * 100)
  );

  const handleSaveAutoRules = async (e: React.FormEvent) => {
    e.preventDefault();
    const threshNum = Number(autoThreshold);
    if (!Number.isFinite(threshNum) || threshNum < 10) {
      onNotify('err', 'Minimum Auto-Reinvest threshold is $10.00 USD.');
      return;
    }
    setSavingAuto(true);
    try {
      await onSaveAutoCompoundConfig({
        enabled: autoEnabled,
        mode: autoMode,
        thresholdUsd: Number(threshNum.toFixed(2)),
        targetPackageId: autoTargetPkgId || packages[0]?.id || '',
        autoClaimOnThreshold: autoClaimFirst,
      });
      onNotify(
        'ok',
        autoEnabled
          ? `Auto-Reinvest rules saved (${
              autoMode === 'auto_activate_package'
                ? `Auto-activate ${targetAutoPkg?.name || 'AI Package'}`
                : 'Route to Deposit Wallet'
            } at $${threshNum.toFixed(2)}).`
          : 'Auto-Reinvest rules saved (Paused).'
      );
    } catch (err) {
      onNotify('err', (err as Error).message);
    } finally {
      setSavingAuto(false);
    }
  };

  const handleRunCompoundingNow = async () => {
    setRunningAuto(true);
    try {
      const res = await onExecuteAutoCompoundNow();
      onNotify(
        'ok',
        `${res.actionSummary}${res.claimedUsd > 0 ? ` (Auto-claimed +$${res.claimedUsd.toFixed(2)} first)` : ''}`
      );
    } catch (err) {
      onNotify('err', (err as Error).message);
    } finally {
      setRunningAuto(false);
    }
  };

  // =========================================================================
  // 3. LIVE PRICE ALERTS & BONUS VOUCHERS STATE
  // =========================================================================
  const [liveQuotes, setLiveQuotes] = useState<Partial<Record<PriceAlertSymbol, LivePriceQuote>>>(
    {}
  );
  const [loadingPrices, setLoadingPrices] = useState<boolean>(false);
  const [alertSymbol, setAlertSymbol] = useState<PriceAlertSymbol>('BTC/USD');
  const [alertCondition, setAlertCondition] = useState<PriceAlertCondition>('above');
  const [alertTargetInput, setAlertTargetInput] = useState<string>('');
  const [alertNotifyEmail, setAlertNotifyEmail] = useState<boolean>(true);
  const [alertNotifyInApp, setAlertNotifyInApp] = useState<boolean>(true);
  const [alertNote, setAlertNote] = useState<string>('');
  const [creatingAlert, setCreatingAlert] = useState<boolean>(false);

  // Bonus Voucher Redeem state
  const [voucherCodeInput, setVoucherCodeInput] = useState<string>('');
  const [redeemingVoucher, setRedeemingVoucher] = useState<boolean>(false);

  const refreshQuotes = useCallback(async () => {
    setLoadingPrices(true);
    try {
      const q = await fetchAllLiveAlertPrices();
      setLiveQuotes(q);
    } finally {
      setLoadingPrices(false);
    }
  }, []);

  useEffect(() => {
    void refreshQuotes();
    const id = window.setInterval(() => {
      void refreshQuotes();
    }, 25_000);
    return () => window.clearInterval(id);
  }, [refreshQuotes]);

  const selectedLivePrice = liveQuotes[alertSymbol]?.price || 0;

  const applyPriceOffset = (pct: number) => {
    if (!selectedLivePrice) return;
    const meta = ALERT_SYMBOLS_META.find((m) => m.symbol === alertSymbol);
    const dec = meta?.decimals ?? 2;
    const nextPrice = selectedLivePrice * (1 + pct / 100);
    setAlertTargetInput(nextPrice.toFixed(dec));
    setAlertCondition(pct >= 0 ? 'above' : 'below');
  };

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = Number(alertTargetInput);
    if (!Number.isFinite(target) || target <= 0) {
      onNotify('err', 'Enter a valid positive target price.');
      return;
    }
    if (!alertNotifyEmail && !alertNotifyInApp) {
      onNotify('err', 'Enable at least one delivery channel (In-App or Email).');
      return;
    }
    setCreatingAlert(true);
    try {
      await onCreatePriceAlert({
        symbol: alertSymbol,
        condition: alertCondition,
        targetPrice: target,
        notifyEmail: alertNotifyEmail,
        notifyInApp: alertNotifyInApp,
        note: alertNote,
      });
      setAlertTargetInput('');
      setAlertNote('');
      onNotify(
        'ok',
        `Price alert armed: ${alertSymbol} ${alertCondition === 'above' ? '≥' : '≤'} ${formatAlertPrice(alertSymbol, target)}`
      );
    } catch (err) {
      onNotify('err', (err as Error).message);
    } finally {
      setCreatingAlert(false);
    }
  };

  const handleRedeemBonusVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = voucherCodeInput.trim().toUpperCase();
    if (!clean) {
      onNotify('err', 'Enter a bonus voucher code.');
      return;
    }
    setRedeemingVoucher(true);
    try {
      const res = await onRedeemBonusPromoCode(clean);
      setVoucherCodeInput('');
      onNotify('ok', res.message);
    } catch (err) {
      onNotify('err', (err as Error).message);
    } finally {
      setRedeemingVoucher(false);
    }
  };

  const activeAlertsCount = priceAlerts.filter((a) => a.status === 'active').length;
  const triggeredAlertsCount = priceAlerts.filter((a) => a.status === 'triggered').length;

  return (
    <section className="space-y-6">
      {/* Top Header */}
      <div className="bg-[#0B111E]/85 backdrop-blur-md border border-slate-700/75 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-amber-400 uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>Investor Automation &amp; Planning Suite</span>
          </div>
          <h2 className="font-display font-bold text-white text-xl sm:text-2xl tracking-tight">
            Investor Tools &amp; Automation Hub
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
            Model exact weekday profit curves and unlock schedules, configure automated compounding
            rules, set live Crypto/Gold/Forex price alerts, and redeem reward vouchers.
          </p>
        </div>

        {/* Sub-Navigation Switcher */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-950/75 border border-slate-800 p-1.5 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setSubTab('calculator')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
              subTab === 'calculator'
                ? 'bg-orange-500 text-white shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Profit Calculator</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('auto-reinvest')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
              subTab === 'auto-reinvest'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>Auto-Reinvest</span>
            {autoEnabled && (
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setSubTab('price-alerts')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
              subTab === 'price-alerts'
                ? 'bg-sky-500 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <BellRing className="w-3.5 h-3.5" />
            <span>Price Alerts &amp; Vouchers</span>
            {activeAlertsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-slate-900/40 text-[10px] font-mono">
                {activeAlertsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: INTERACTIVE PROFIT & UNLOCK SCHEDULE CALCULATOR                */}
      {/* ===================================================================== */}
      {subTab === 'calculator' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Left Controls */}
            <div className="xl:col-span-5 bg-[#0B111E]/85 backdrop-blur-md border border-slate-700/75 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="font-display font-bold text-white text-base">
                    Configure Strategy Preview
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Mon–Fri trading schedule · Sat–Sun market rest
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-md bg-orange-500/15 border border-orange-500/35 text-[11px] font-mono text-orange-300">
                  {calcProjection.rate.toFixed(2)}% / day
                </span>
              </div>

              {/* Package Tier Presets */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">
                  Quick-Load Live AI Tier
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {packages.map((pkg) => {
                    const active = selectedPkgId === pkg.id;
                    return (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => handleSelectPackagePreset(pkg)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          active
                            ? 'border-orange-500 bg-orange-500/15 text-white'
                            : 'border-slate-700/80 bg-slate-900/75 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <div className="text-xs font-bold truncate">{pkg.name}</div>
                        <div className="text-[11px] font-mono text-emerald-400 mt-0.5 tabular-nums">
                          ${pkg.capital.toLocaleString()} · {pkg.dailyPercent}%/d
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Capital Slider & Number Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    Investment Capital (USD)
                  </label>
                  <span className="text-xs font-mono font-bold text-white tabular-nums">
                    ${calcCapital.toLocaleString()}
                  </span>
                </div>
                <input
                  type="number"
                  min={10}
                  max={1000000}
                  step={10}
                  value={calcCapital}
                  onChange={(e) => {
                    setSelectedPkgId('custom');
                    setCalcCapital(Math.max(10, Number(e.target.value) || 0));
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-900/90 text-white font-mono font-bold text-base focus:outline-none focus:border-orange-500 tabular-nums"
                />
                <input
                  type="range"
                  min={100}
                  max={25000}
                  step={50}
                  value={Math.min(25000, Math.max(100, calcCapital))}
                  onChange={(e) => {
                    setSelectedPkgId('custom');
                    setCalcCapital(Number(e.target.value));
                  }}
                  className="w-full accent-orange-500 cursor-pointer"
                />
              </div>

              {/* Rate / Profit Days / Lock Days / Start Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Daily Weekday ROI (%)
                  </label>
                  <input
                    type="number"
                    min={0.1}
                    max={10}
                    step={0.05}
                    value={calcDailyPct}
                    onChange={(e) => {
                      setSelectedPkgId('custom');
                      setCalcDailyPct(Number(e.target.value) || 0.5);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-900/90 text-white font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={calcStartDate}
                    onChange={(e) => setCalcStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-900/90 text-white font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Profit Days (Mon–Fri)
                  </label>
                  <input
                    type="number"
                    min={20}
                    max={400}
                    value={calcProfitDays}
                    onChange={(e) => setCalcProfitDays(Number(e.target.value) || 200)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-900/90 text-white font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Capital Lock (Calendar Days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={730}
                    value={calcLockDays}
                    onChange={(e) => setCalcLockDays(Number(e.target.value) || 200)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-900/90 text-white font-mono text-sm"
                  />
                </div>
              </div>

              {/* Compounding Comparison Toggle */}
              <div className="p-3.5 rounded-xl bg-emerald-950/25 border border-emerald-500/30 space-y-2.5">
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                    <Repeat className="w-3.5 h-3.5" />
                    Compare Auto-Reinvest Compounding
                  </span>
                  <input
                    type="checkbox"
                    checked={simulateCompounding}
                    onChange={(e) => setSimulateCompounding(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 rounded"
                  />
                </label>
                {simulateCompounding && (
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-300">
                    <span>Reinvest whenever profit hits:</span>
                    <div className="flex items-center gap-1">
                      {[100, 250, 500].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setCompoundThreshold(v)}
                          className={`px-2 py-1 rounded font-mono font-bold border ${
                            compoundThreshold === v
                              ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                              : 'border-slate-700 bg-slate-900 text-slate-400'
                          }`}
                        >
                          ${v}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={onOpenActivateTrading}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Zap className="w-4 h-4" />
                  <span>Fund &amp; Activate Package</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab('auto-reinvest')}
                  className="py-2.5 px-3.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  <span>Set Auto-Reinvest</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Right Results & Chart */}
            <div className="xl:col-span-7 space-y-5">
              {/* 4 Output Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-[#0B111E]/85 border border-slate-700/75 rounded-2xl p-4 space-y-1">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                    Daily (Mon–Fri)
                  </div>
                  <div className="font-mono font-extrabold text-xl text-emerald-400 tabular-nums">
                    ${calcProjection.dailyUsd.toFixed(2)}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    ${calcProjection.weeklyUsd.toFixed(2)} / wk
                  </div>
                </div>

                <div className="bg-[#0B111E]/85 border border-slate-700/75 rounded-2xl p-4 space-y-1">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                    Simple Profit
                  </div>
                  <div className="font-mono font-extrabold text-xl text-white tabular-nums">
                    ${calcProjection.totalSimpleProfit.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Total: ${calcProjection.totalSimpleReturn.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="bg-[#0B111E]/85 border border-sky-500/35 rounded-2xl p-4 space-y-1">
                  <div className="text-[11px] uppercase tracking-wider text-sky-300 font-semibold flex items-center gap-1">
                    <Unlock className="w-3 h-3" /> Capital Unlock
                  </div>
                  <div className="font-mono font-bold text-base text-white">
                    {calcProjection.unlockDateLabel}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    After {calcProjection.lockDays} cal. days
                  </div>
                </div>

                <div className="bg-[#0B111E]/85 border border-amber-500/35 rounded-2xl p-4 space-y-1">
                  <div className="text-[11px] uppercase tracking-wider text-amber-300 font-semibold flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Cycle End
                  </div>
                  <div className="font-mono font-bold text-base text-white">
                    {calcProjection.completionDateLabel}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Break-even: {calcProjection.breakEvenDateLabel}
                  </div>
                </div>
              </div>

              {/* Compounded Boost Banner */}
              {simulateCompounding && calcProjection.compTotalEarned > calcProjection.totalSimpleProfit && (
                <div className="p-4 rounded-2xl bg-emerald-950/35 border border-emerald-500/40 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-emerald-300">
                      Auto-Reinvest Compounding Uplift ({calcProjection.compReinvestCount} auto-reinvest cycles @ ${compoundThreshold})
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Projected compounded profit reaches{' '}
                      <strong className="text-emerald-300 font-mono">
                        ${calcProjection.compTotalEarned.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </strong>{' '}
                      (+${(calcProjection.compTotalEarned - calcProjection.totalSimpleProfit).toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
                      extra vs. simple payout) with active principal growing to{' '}
                      <strong className="text-white font-mono">
                        ${calcProjection.compFinalPrincipal.toLocaleString()}
                      </strong>.
                    </p>
                  </div>
                </div>
              )}

              {/* Recharts Growth Curve */}
              <div className="bg-[#0B111E]/85 border border-slate-700/75 rounded-2xl p-5 space-y-3 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-white">
                    Projected Cumulative Profit Curve ({calcProjection.totalDays} Weekdays)
                  </h4>
                  <div className="flex items-center gap-4 text-[11px]">
                    <span className="inline-flex items-center gap-1.5 text-orange-300">
                      <span className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                      Simple Profit
                    </span>
                    {simulateCompounding && (
                      <span className="inline-flex items-center gap-1.5 text-emerald-300">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                        Auto-Compounded
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={calcProjection.chartPoints}
                      margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="calcSimpleGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="calcCompGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.38} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} />
                      <YAxis
                        stroke="#94a3b8"
                        fontSize={11}
                        tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          border: '1px solid #334155',
                          borderRadius: '0.75rem',
                          fontSize: '12px',
                        }}
                        formatter={(value, name) => [
                          `$${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                          name === 'compoundedProfit' ? 'Auto-Compounded Profit' : 'Simple Profit',
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="simpleProfit"
                        stroke="#f97316"
                        strokeWidth={2}
                        fill="url(#calcSimpleGrad)"
                      />
                      {simulateCompounding && (
                        <Area
                          type="monotone"
                          dataKey="compoundedProfit"
                          stroke="#10b981"
                          strokeWidth={2.5}
                          fill="url(#calcCompGrad)"
                        />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Milestone Schedule Table */}
              <div className="bg-[#0B111E]/85 border border-slate-700/75 rounded-2xl overflow-hidden shadow-xl">
                <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white">
                    Weekday Milestone &amp; Unlock Schedule
                  </h4>
                  <span className="text-[11px] font-mono text-slate-400">
                    Excludes Sat–Sun market rest
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px]">
                      <tr>
                        <th className="px-4 py-2.5">Milestone</th>
                        <th className="px-4 py-2.5">Target Date</th>
                        <th className="px-4 py-2.5">Accrued Profit</th>
                        <th className="px-4 py-2.5">ROI %</th>
                        <th className="px-4 py-2.5">Principal Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {calcProjection.milestones.map((m) => (
                        <tr key={m.weekday} className="hover:bg-slate-900/50">
                          <td className="px-4 py-2.5 font-semibold text-white">
                            {m.tag}{' '}
                            <span className="text-slate-500 font-mono">(D{m.weekday})</span>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-slate-300">{m.dateLabel}</td>
                          <td className="px-4 py-2.5 font-mono font-bold text-emerald-400 tabular-nums">
                            +${m.earnedUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-amber-300 tabular-nums">
                            {m.roiPct}%
                          </td>
                          <td className="px-4 py-2.5">
                            {m.isCapitalUnlocked ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-[10px] font-semibold">
                                Unlocked
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 text-[10px]">
                                Locked
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: AUTO-REINVEST / COMPOUNDING RULES                              */}
      {/* ===================================================================== */}
      {subTab === 'auto-reinvest' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Configuration Form */}
          <form
            onSubmit={handleSaveAutoRules}
            className="xl:col-span-7 bg-[#0B111E]/85 backdrop-blur-md border border-slate-700/75 rounded-2xl p-6 space-y-5 shadow-xl"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <h3 className="font-display font-bold text-white text-lg">
                  Auto-Reinvest &amp; Compounding Rules
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Automatically route profits to your Deposit Wallet or launch a new AI package once
                  your Income balance hits your target threshold.
                </p>
              </div>
              <label className="inline-flex items-center gap-2.5 cursor-pointer px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-900">
                <input
                  type="checkbox"
                  checked={autoEnabled}
                  onChange={(e) => setAutoEnabled(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500"
                />
                <span
                  className={`text-xs font-bold ${
                    autoEnabled ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  {autoEnabled ? 'Auto-Reinvest ACTIVE' : 'Rule Paused'}
                </span>
              </label>
            </div>

            {/* Mode Cards */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                1. Choose Compounding Action
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAutoMode('route_to_deposit')}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    autoMode === 'route_to_deposit'
                      ? 'border-emerald-500 bg-emerald-500/12 ring-1 ring-emerald-500/30'
                      : 'border-slate-700/80 bg-slate-900/70 hover:border-slate-600'
                  }`}
                >
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Repeat className="w-4 h-4 text-emerald-400" />
                    Route Profits → Deposit Wallet
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                    Moves available Income Wallet funds into your Deposit Wallet once the target
                    threshold is reached, ready for packages or Forex margin.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setAutoMode('auto_activate_package')}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    autoMode === 'auto_activate_package'
                      ? 'border-orange-500 bg-orange-500/12 ring-1 ring-orange-500/30'
                      : 'border-slate-700/80 bg-slate-900/70 hover:border-slate-600'
                  }`}
                >
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-orange-400" />
                    Auto-Activate New AI Package
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                    Automatically deploys a brand-new AI trading package from your Income Wallet as
                    soon as your balance covers the package capital.
                  </p>
                </button>
              </div>
            </div>

            {/* Threshold Input */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                2. Trigger Threshold Amount (USD)
              </label>
              <input
                type="number"
                min={10}
                max={1000000}
                step="0.01"
                value={autoThreshold}
                onChange={(e) => setAutoThreshold(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-900/90 text-white font-mono text-base font-bold tabular-nums focus:outline-none focus:border-emerald-500"
              />
              <div className="flex flex-wrap gap-1.5">
                {[50, 100, 250, 500, 1000].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAutoThreshold(String(v))}
                    className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-900 hover:border-emerald-500/60 text-[11px] font-mono text-slate-300"
                  >
                    ${v}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Package Selector */}
            {autoMode === 'auto_activate_package' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block">
                  3. Target AI Package to Auto-Activate
                </label>
                <select
                  value={autoTargetPkgId}
                  onChange={(e) => setAutoTargetPkgId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-900/90 text-white text-xs sm:text-sm focus:outline-none focus:border-orange-500"
                >
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} — ${pkg.capital.toLocaleString()} ({pkg.dailyPercent}% Mon–Fri ·{' '}
                      {pkg.profitDays} days)
                    </option>
                  ))}
                </select>
                {targetAutoPkg && Number(autoThreshold) < targetAutoPkg.capital && (
                  <p className="text-[11px] text-amber-300">
                    Note: Execution requires at least ${targetAutoPkg.capital.toLocaleString()} to
                    fund {targetAutoPkg.name}.
                  </p>
                )}
              </div>
            )}

            <label className="flex items-start gap-2.5 p-3.5 rounded-xl bg-slate-900/75 border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={autoClaimFirst}
                onChange={(e) => setAutoClaimFirst(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-emerald-500"
              />
              <div>
                <div className="text-xs font-semibold text-white">
                  Auto-claim accrued package profits before compounding
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Automatically sweeps unclaimed profits (${totalUnclaimedProfit.toFixed(2)} currently
                  ready) into your Income Wallet before checking your ${effectiveAutoTargetUsd.toFixed(2)}{' '}
                  target.
                </p>
              </div>
            </label>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={savingAuto}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs inline-flex items-center gap-2 transition-colors"
              >
                {savingAuto ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>Save Compounding Rules</span>
              </button>

              <button
                type="button"
                disabled={runningAuto || !userProfile.autoCompoundConfig?.enabled}
                onClick={() => void handleRunCompoundingNow()}
                className="px-5 py-2.5 rounded-xl border border-orange-500/50 bg-orange-500/15 hover:bg-orange-500/25 disabled:opacity-45 text-orange-200 font-bold text-xs inline-flex items-center gap-2 transition-colors"
              >
                {runningAuto ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                <span>Run Compounding Cycle Now</span>
              </button>
            </div>
          </form>

          {/* Live Threshold Progress & History */}
          <div className="xl:col-span-5 space-y-4">
            <div className="bg-[#0B111E]/85 border border-emerald-500/35 rounded-2xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                  Live Threshold Progress
                </span>
                <span className="font-mono text-xs font-bold text-white tabular-nums">
                  {autoProgressPct}%
                </span>
              </div>

              <div className="w-full h-3 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-300 transition-all duration-500"
                  style={{ width: `${autoProgressPct}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="text-[11px] text-slate-400">Eligible Balance</div>
                  <div className="font-mono font-bold text-lg text-emerald-400 tabular-nums mt-0.5">
                    ${eligibleForCompoundingUsd.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Income ${userProfile.profitBalance.toFixed(2)} + Unclaimed $
                    {totalUnclaimedProfit.toFixed(2)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="text-[11px] text-slate-400">Trigger Target</div>
                  <div className="font-mono font-bold text-lg text-white tabular-nums mt-0.5">
                    ${effectiveAutoTargetUsd.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {eligibleForCompoundingUsd >= effectiveAutoTargetUsd
                      ? 'Ready to execute now!'
                      : `$${Math.max(0, effectiveAutoTargetUsd - eligibleForCompoundingUsd).toFixed(2)} remaining`}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800 text-xs">
                <div>
                  <div className="text-[11px] text-slate-400">Lifetime Auto-Compounded</div>
                  <div className="font-mono font-bold text-white text-base tabular-nums">
                    ${(userProfile.autoCompoundConfig?.totalAutoCompoundedUsd || 0).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Cycles Executed</div>
                  <div className="font-mono font-bold text-white text-base tabular-nums">
                    {userProfile.autoCompoundConfig?.executionsCount || 0}
                  </div>
                </div>
              </div>

              {userProfile.autoCompoundConfig?.lastExecutedAtMs ? (
                <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    Last executed:{' '}
                    {new Date(userProfile.autoCompoundConfig.lastExecutedAtMs).toLocaleString()}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="bg-[#0B111E]/85 border border-slate-700/75 rounded-2xl p-5 space-y-2 text-xs text-slate-300">
              <div className="font-bold text-white">How Automated Compounding Works</div>
              <p className="text-slate-400 leading-relaxed">
                Whenever your dashboard syncs and your Income Wallet (plus optional unclaimed daily
                profits) reaches your saved threshold, you can compound in one click—or let the
                dashboard auto-trigger when you claim profits. Every compounding action writes a
                verified ledger entry in your Wallet Transfers or AI Packages history.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: LIVE PRICE ALERTS (FOREX & CRYPTO) + BONUS VOUCHERS            */}
      {/* ===================================================================== */}
      {subTab === 'price-alerts' && (
        <div className="space-y-6">
          {/* Live Market Price Ribbon */}
          <div className="bg-[#0B111E]/85 border border-slate-700/75 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <Bell className="w-4 h-4 text-sky-400" />
                <span>Live Crypto, Gold (XAU/USD) &amp; Forex Feed</span>
              </div>
              <button
                type="button"
                onClick={() => void refreshQuotes()}
                disabled={loadingPrices}
                className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:border-sky-500/60 text-[11px] font-semibold text-slate-200 inline-flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingPrices ? 'animate-spin' : ''}`} />
                <span>Refresh Prices</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-2">
              {ALERT_SYMBOLS_META.map((item) => {
                const quote = liveQuotes[item.symbol];
                const active = alertSymbol === item.symbol;
                return (
                  <button
                    key={item.symbol}
                    type="button"
                    onClick={() => {
                      setAlertSymbol(item.symbol);
                      if (quote?.price) {
                        setAlertTargetInput(quote.price.toFixed(item.decimals));
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      active
                        ? 'border-sky-400 bg-sky-500/15'
                        : 'border-slate-800 bg-slate-900/80 hover:border-slate-600'
                    }`}
                  >
                    <div className="text-[10px] font-mono text-slate-400">{item.category}</div>
                    <div className="text-xs font-bold text-white">{item.symbol}</div>
                    <div className="font-mono text-xs font-bold text-emerald-400 mt-0.5 tabular-nums">
                      {quote ? formatAlertPrice(item.symbol, quote.price) : '...'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Create Alert Form */}
            <form
              onSubmit={handleCreateAlert}
              className="xl:col-span-5 bg-[#0B111E]/85 border border-slate-700/75 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl"
            >
              <div className="border-b border-slate-800 pb-3">
                <h3 className="font-display font-bold text-white text-base">
                  Create Live Price Alert
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Instant in-app banner &amp; email alert when the live feed crosses your target.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Market Pair
                  </label>
                  <select
                    value={alertSymbol}
                    onChange={(e) => {
                      const sym = e.target.value as PriceAlertSymbol;
                      setAlertSymbol(sym);
                      const q = liveQuotes[sym];
                      const meta = ALERT_SYMBOLS_META.find((m) => m.symbol === sym);
                      if (q?.price) setAlertTargetInput(q.price.toFixed(meta?.decimals ?? 2));
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-white text-xs font-bold"
                  >
                    {ALERT_SYMBOLS_META.map((m) => (
                      <option key={m.symbol} value={m.symbol}>
                        {m.symbol} — {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Trigger Condition
                  </label>
                  <select
                    value={alertCondition}
                    onChange={(e) => setAlertCondition(e.target.value as PriceAlertCondition)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-white text-xs font-bold"
                  >
                    <option value="above">Rises Above (≥)</option>
                    <option value="below">Drops Below (≤)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Target Price ({alertSymbol})
                  </label>
                  {selectedLivePrice > 0 && (
                    <span className="text-[11px] font-mono text-sky-300 tabular-nums">
                      Live: {formatAlertPrice(alertSymbol, selectedLivePrice)}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  step="any"
                  required
                  value={alertTargetInput}
                  onChange={(e) => setAlertTargetInput(e.target.value)}
                  placeholder="Enter target price"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-white font-mono text-sm font-bold tabular-nums focus:outline-none focus:border-sky-500"
                />
                {selectedLivePrice > 0 && (
                  <div className="grid grid-cols-6 gap-1">
                    {[-5, -2, -1, 1, 2, 5].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => applyPriceOffset(pct)}
                        className={`py-1 rounded border text-[10px] font-mono font-bold ${
                          pct > 0
                            ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                            : 'border-rose-500/35 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
                        }`}
                      >
                        {pct > 0 ? `+${pct}%` : `${pct}%`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Optional Trade Note
                </label>
                <input
                  type="text"
                  maxLength={160}
                  value={alertNote}
                  onChange={(e) => setAlertNote(e.target.value)}
                  placeholder="e.g., Gold breakout entry / BTC take-profit zone"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-900 text-white text-xs placeholder:text-slate-500"
                />
              </div>

              <div className="flex flex-wrap gap-4 text-xs text-slate-300">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alertNotifyInApp}
                    onChange={(e) => setAlertNotifyInApp(e.target.checked)}
                    className="w-4 h-4 accent-sky-500"
                  />
                  <span>Instant In-App Alert</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alertNotifyEmail}
                    onChange={(e) => setAlertNotifyEmail(e.target.checked)}
                    className="w-4 h-4 accent-sky-500"
                  />
                  <span className="inline-flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-sky-400" />
                    Email Notification
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={creatingAlert}
                className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-bold text-xs inline-flex items-center justify-center gap-2 transition-colors"
              >
                {creatingAlert ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <BellRing className="w-4 h-4" />
                )}
                <span>Arm Live Price Alert</span>
              </button>
            </form>

            {/* Right: Active Alerts List + Bonus Voucher Redemption */}
            <div className="xl:col-span-7 space-y-5">
              {/* Alerts List */}
              <div className="bg-[#0B111E]/85 border border-slate-700/75 rounded-2xl overflow-hidden shadow-xl">
                <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display font-bold text-white text-base">
                      Your Armed &amp; Triggered Alerts ({priceAlerts.length})
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {activeAlertsCount} active · {triggeredAlertsCount} triggered
                    </p>
                  </div>
                </div>

                {priceAlerts.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No price alerts set yet. Select BTC/USD, XAU/USD (Gold), or any Forex pair on
                    the left to arm your first target alert.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/80">
                    {priceAlerts.map((alert) => {
                      const live = liveQuotes[alert.symbol]?.price || 0;
                      const diffPct =
                        live > 0 ? ((alert.targetPrice - live) / live) * 100 : null;
                      return (
                        <div
                          key={alert.id}
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-900/50"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono font-bold text-sm text-white">
                                {alert.symbol}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 ${
                                  alert.condition === 'above'
                                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35'
                                    : 'bg-rose-500/15 text-rose-300 border border-rose-500/35'
                                }`}
                              >
                                {alert.condition === 'above' ? (
                                  <TrendingUp className="w-3 h-3" />
                                ) : (
                                  <TrendingDown className="w-3 h-3" />
                                )}
                                {alert.condition === 'above' ? 'Above' : 'Below'}{' '}
                                {formatAlertPrice(alert.symbol, alert.targetPrice)}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                  alert.status === 'triggered'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : alert.status === 'paused'
                                    ? 'bg-slate-800 text-slate-400 border border-slate-700'
                                    : 'bg-sky-500/15 text-sky-300 border border-sky-500/35'
                                }`}
                              >
                                {alert.status}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-mono">
                              {live > 0 && (
                                <span>
                                  Live: <strong className="text-slate-200">{formatAlertPrice(alert.symbol, live)}</strong>
                                  {diffPct !== null && (
                                    <span className="text-slate-500">
                                      {' '}
                                      ({diffPct >= 0 ? '+' : ''}
                                      {diffPct.toFixed(2)}%)
                                    </span>
                                  )}
                                </span>
                              )}
                              {alert.status === 'triggered' && alert.triggeredPrice > 0 && (
                                <span className="text-amber-300">
                                  Hit @ {formatAlertPrice(alert.symbol, alert.triggeredPrice)}
                                  {alert.emailSent ? ' · Email Sent' : ''}
                                </span>
                              )}
                              {alert.notifyEmail && (
                                <span className="text-sky-400">Email ON</span>
                              )}
                            </div>
                            {alert.note && (
                              <p className="text-[11px] text-slate-400 italic">“{alert.note}”</p>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {alert.status === 'triggered' ? (
                              <button
                                type="button"
                                title="Re-arm alert"
                                onClick={() =>
                                  void onUpdatePriceAlert(alert.id, {
                                    status: 'active',
                                    triggeredPrice: 0,
                                    triggeredAtMs: 0,
                                    emailSent: false,
                                  }).then(() => onNotify('ok', `Re-armed ${alert.symbol} alert.`))
                                }
                                className="px-2.5 py-1.5 rounded-lg border border-sky-500/40 bg-sky-500/15 text-sky-300 text-[11px] font-semibold inline-flex items-center gap-1"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Re-arm
                              </button>
                            ) : (
                              <button
                                type="button"
                                title={alert.status === 'active' ? 'Pause alert' : 'Resume alert'}
                                onClick={() =>
                                  void onUpdatePriceAlert(alert.id, {
                                    status: alert.status === 'active' ? 'paused' : 'active',
                                  })
                                }
                                className="p-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-500"
                              >
                                {alert.status === 'active' ? (
                                  <Pause className="w-3.5 h-3.5" />
                                ) : (
                                  <Play className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                            <button
                              type="button"
                              title="Delete alert"
                              onClick={() => void onDeletePriceAlert(alert.id)}
                              className="p-2 rounded-lg border border-rose-500/35 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Promo & Milestone Bonus Voucher Redemption */}
              <div className="bg-[#0B111E]/85 border border-amber-500/35 rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display font-bold text-white text-base flex items-center gap-2">
                      <Gift className="w-4 h-4 text-amber-400" />
                      <span>Redeem Bonus &amp; Milestone Voucher Code</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Have a limited-time Deposit Bonus or Milestone Reward code? Redeem it here for
                      instant server-verified wallet credit. (Fee-waiver codes apply inside
                      Withdrawals.)
                    </p>
                  </div>
                </div>

                <form onSubmit={handleRedeemBonusVoucher} className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <Tag className="w-4 h-4 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      maxLength={24}
                      value={voucherCodeInput}
                      onChange={(e) => setVoucherCodeInput(e.target.value.toUpperCase())}
                      placeholder="ENTER VOUCHER CODE (E.G. MILESTONE25)"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-white font-mono text-xs uppercase tracking-wider focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={redeemingVoucher || !voucherCodeInput.trim()}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs inline-flex items-center justify-center gap-1.5 shrink-0"
                  >
                    {redeemingVoucher ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Gift className="w-4 h-4" />
                    )}
                    <span>Redeem Voucher</span>
                  </button>
                </form>

                {promoRedemptions.length > 0 && (
                  <div className="pt-3 border-t border-slate-800 space-y-2">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Your Voucher Redemption History ({promoRedemptions.length})
                    </div>
                    <div className="space-y-1.5 max-h-44 overflow-y-auto">
                      {promoRedemptions.map((r) => (
                        <div
                          key={r.id}
                          className="px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-amber-300">{r.code}</span>
                            <span className="text-[11px] text-slate-400">
                              {r.appliedTo === 'withdrawal' ? 'Withdrawal Fee Discount' : 'Bonus Credit'}
                            </span>
                          </div>
                          <div className="font-mono font-bold text-emerald-400 tabular-nums">
                            {r.bonusCreditedUsd > 0
                              ? `+$${r.bonusCreditedUsd.toFixed(2)}`
                              : `Saved $${r.feeSavedUsd.toFixed(2)}`}
                            <span className="text-[10px] text-slate-500 font-normal ml-2">
                              {formatTimestamp(r.createdAt).slice(0, 10)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
