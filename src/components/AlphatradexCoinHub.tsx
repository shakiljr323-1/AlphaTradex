import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Award,
  BatteryCharging,
  CheckCircle2,
  Clock,
  Coins,
  Cpu,
  ExternalLink,
  Flame,
  Hammer,
  Megaphone,
  Pickaxe,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { usePlatform, getTodayDayKey } from '../context/PlatformContext';
import {
  BannerAdConfig,
  BannerAdPlacement,
  BannerAdTheme,
  CoinMiningPlan,
  CoinMiningStake,
} from '../types/platform';
import { CoinMiningStage3D } from './CoinMiningStage3D';

const THEME_STYLES: Record<
  BannerAdTheme,
  { wrap: string; badge: string; cta: string; accent: string }
> = {
  gold: {
    wrap: 'bg-gradient-to-r from-[#1A1407]/95 via-[#0F1422]/95 to-[#1D1206]/95 border-amber-500/45 text-amber-50',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    cta: 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950',
    accent: 'text-amber-400',
  },
  emerald: {
    wrap: 'bg-gradient-to-r from-[#071A14]/95 via-[#0B1522]/95 to-[#081F18]/95 border-emerald-500/45 text-emerald-50',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    cta: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    accent: 'text-emerald-400',
  },
  sky: {
    wrap: 'bg-gradient-to-r from-[#071525]/95 via-[#0B111E]/95 to-[#091A2B]/95 border-sky-500/45 text-sky-50',
    badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    cta: 'bg-sky-600 hover:bg-sky-500 text-white',
    accent: 'text-sky-400',
  },
  crimson: {
    wrap: 'bg-gradient-to-r from-[#22090D]/95 via-[#13101D]/95 to-[#210A10]/95 border-rose-500/45 text-rose-50',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    cta: 'bg-rose-600 hover:bg-rose-500 text-white',
    accent: 'text-rose-400',
  },
};

interface BannerAdSlotProps {
  bannerAds: BannerAdConfig[];
  placement: BannerAdPlacement;
  compact?: boolean;
  onCtaAction?: (url: string) => void;
}

export const BannerAdSlot: React.FC<BannerAdSlotProps> = ({
  bannerAds,
  placement,
  compact = false,
  onCtaAction,
}) => {
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const visibleAds = useMemo(
    () =>
      (bannerAds || []).filter(
        (ad) => ad.enabled && ad.placement === placement && (ad.title.trim() || ad.subtitle.trim())
      ),
    [bannerAds, placement]
  );

  if (visibleAds.length === 0) return null;

  return (
    <div className="space-y-3">
      {visibleAds.map((ad) => {
        const style = THEME_STYLES[ad.theme] || THEME_STYLES.gold;
        const hasValidImage = Boolean(ad.imageUrl && ad.imageUrl.trim() && !brokenImages[ad.id]);
        const url = (ad.ctaUrl || '').trim();
        const isAnchor = !url || url.startsWith('#');

        return (
          <div
            key={ad.id}
            className={`rounded-2xl border backdrop-blur-md shadow-xl overflow-hidden ${style.wrap}`}
          >
            <div
              className={`flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 ${
                compact ? 'p-3.5 sm:px-5' : 'p-4 sm:p-5'
              }`}
            >
              <div className="flex items-start sm:items-center gap-4 min-w-0">
                {hasValidImage ? (
                  <img
                    src={ad.imageUrl}
                    alt={ad.title || 'Sponsored banner'}
                    onError={() => setBrokenImages((prev) => ({ ...prev, [ad.id]: true }))}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-white/15 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                    <Megaphone className={`w-6 h-6 ${style.accent}`} />
                  </div>
                )}

                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {ad.badgeText && (
                      <span
                        className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold uppercase tracking-wider ${style.badge}`}
                      >
                        {ad.badgeText}
                      </span>
                    )}
                    <span className="font-display font-bold text-white text-sm sm:text-base truncate">
                      {ad.title}
                    </span>
                  </div>
                  {ad.subtitle && (
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{ad.subtitle}</p>
                  )}
                </div>
              </div>

              {ad.ctaText && (
                <div className="shrink-0 flex items-center">
                  {isAnchor ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (onCtaAction) {
                          onCtaAction(url || '#coin-mining-desk');
                          return;
                        }
                        if (url.startsWith('#')) {
                          const target = document.getElementById(url.slice(1));
                          target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                      }}
                      className={`px-4 py-2.5 rounded-xl font-display font-bold text-xs sm:text-sm inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${style.cta}`}
                    >
                      <span>{ad.ctaText}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className={`px-4 py-2.5 rounded-xl font-display font-bold text-xs sm:text-sm inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${style.cta}`}
                    >
                      <span>{ad.ctaText}</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

interface FloatingTapBurst {
  id: number;
  x: number;
  y: number;
  amount: number;
}

interface AlphatradexCoinHubProps {
  mode: 'vault' | 'preview';
  onNotify?: (type: 'ok' | 'err', text: string) => void;
  onRequireAuth?: () => void;
  onPrimaryHeroAction?: () => void;
  primaryHeroLabel?: string;
}

function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) return '00:00:00';
  const totalSecs = Math.floor(msRemaining / 1000);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function getMinerRank(totalTapped: number): { label: string; color: string } {
  if (totalTapped >= 10000) return { label: 'Quantum Sovereign', color: 'text-amber-300' };
  if (totalTapped >= 2500) return { label: 'Gold Rig Operator', color: 'text-yellow-300' };
  if (totalTapped >= 500) return { label: 'Silver Extractor', color: 'text-sky-300' };
  return { label: 'Bronze Tapper', color: 'text-orange-300' };
}

export const AlphatradexCoinHub: React.FC<AlphatradexCoinHubProps> = ({
  mode,
  onNotify,
  onRequireAuth,
  onPrimaryHeroAction,
  primaryHeroLabel,
}) => {
  const {
    authUser,
    userProfile,
    platformConfig,
    coinMiningStakes,
    coinTapAccount,
    startCoinMiningStake,
    claimCoinMiningInterest,
    syncTapMiningProgress,
    claimTapMiningRewards,
  } = usePlatform();

  const settings = platformConfig.coinMiningSettings;
  const activePlans = useMemo(
    () => (platformConfig.coinMiningPlans || []).filter((p) => p.enabled),
    [platformConfig.coinMiningPlans]
  );

  const [selectedPlanId, setSelectedPlanId] = useState<string>(activePlans[0]?.id || '');
  const selectedPlan: CoinMiningPlan | undefined = useMemo(
    () => activePlans.find((p) => p.id === selectedPlanId) || activePlans[0],
    [activePlans, selectedPlanId]
  );

  const [stakeAmount, setStakeAmount] = useState<string>(
    String(activePlans[0]?.minUsd || 25)
  );
  const [busyMining, setBusyMining] = useState(false);
  const [busyTapClaim, setBusyTapClaim] = useState(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Hamster-style interactive Tap-to-Mine state
  const [energy, setEnergy] = useState<number>(settings.maxEnergy);
  const [pendingLocalCoins, setPendingLocalCoins] = useState<number>(0);
  const [previewTappedTotal, setPreviewTappedTotal] = useState<number>(0);
  const [coinPressed, setCoinPressed] = useState<boolean>(false);
  const [bursts, setBursts] = useState<FloatingTapBurst[]>([]);
  const [tapNotice, setTapNotice] = useState<string>('');

  const burstIdRef = useRef(1);
  const pendingRef = useRef(0);
  const energyRef = useRef(settings.maxEnergy);
  const syncTimerRef = useRef<number | null>(null);
  const miningDeskRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (selectedPlan && !activePlans.some((p) => p.id === selectedPlanId)) {
      setSelectedPlanId(selectedPlan.id);
      setStakeAmount(String(selectedPlan.minUsd));
    }
  }, [activePlans, selectedPlan, selectedPlanId]);

  // Live 1s clock tick for energy regeneration and 24h mining countdowns
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
      setEnergy((prev) => {
        const next = Math.min(settings.maxEnergy, prev + settings.energyRegenPerSec);
        energyRef.current = next;
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [settings.maxEnergy, settings.energyRegenPerSec]);

  // Hydrate initial energy when cloud coinTapAccount loads
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current || !coinTapAccount) return;
    const elapsedSecs = Math.max(0, Math.floor((Date.now() - (coinTapAccount.lastEnergySyncMs || Date.now())) / 1000));
    const recovered = Math.min(
      settings.maxEnergy,
      (coinTapAccount.energy ?? settings.maxEnergy) + elapsedSecs * settings.energyRegenPerSec
    );
    setEnergy(recovered);
    energyRef.current = recovered;
    hydratedRef.current = true;
  }, [coinTapAccount, settings.maxEnergy, settings.energyRegenPerSec]);

  const flushTapBatch = useCallback(async () => {
    if (mode !== 'vault' || !authUser) return;
    const coinsToFlush = pendingRef.current;
    if (coinsToFlush <= 0) return;

    pendingRef.current = 0;
    setPendingLocalCoins(0);
    try {
      await syncTapMiningProgress({
        addedCoins: coinsToFlush,
        energy: energyRef.current,
        dayKey: getTodayDayKey(),
      });
    } catch {
      // Restore pending coins if network error occurred
      pendingRef.current += coinsToFlush;
      setPendingLocalCoins((p) => p + coinsToFlush);
    }
  }, [authUser, mode, syncTapMiningProgress]);

  useEffect(() => {
    return () => {
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
      if (pendingRef.current > 0 && mode === 'vault' && authUser) {
        void syncTapMiningProgress({
          addedCoins: pendingRef.current,
          energy: energyRef.current,
          dayKey: getTodayDayKey(),
        });
      }
    };
  }, [authUser, mode, syncTapMiningProgress]);

  const todayKey = getTodayDayKey();
  const cloudDailyTapped =
    coinTapAccount && coinTapAccount.lastTapDayKey === todayKey
      ? coinTapAccount.dailyTappedCoins || 0
      : 0;
  const effectiveDailyTapped =
    (mode === 'vault' ? cloudDailyTapped : previewTappedTotal) + pendingLocalCoins;
  const remainingDailyCap = Math.max(0, settings.dailyTapLimitCoins - effectiveDailyTapped);

  const effectiveUnclaimedCoins =
    (mode === 'vault' ? coinTapAccount?.unclaimedTapCoins || 0 : previewTappedTotal) + pendingLocalCoins;
  const effectiveLifetimeTapped =
    (mode === 'vault' ? coinTapAccount?.totalTappedCoins || 0 : previewTappedTotal) + pendingLocalCoins;
  const unclaimedUsdValue = effectiveUnclaimedCoins * settings.tapUsdPerCoin;
  const minerRank = getMinerRank(effectiveLifetimeTapped);

  const handleCoinTap = (e: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => {
    if (!settings.tapToMineEnabled) return;
    if (energyRef.current < settings.energyCostPerTap) {
      setTapNotice('Energy recharging — wait a few seconds for automatic recovery.');
      return;
    }
    if (remainingDailyCap <= 0) {
      setTapNotice('Daily tap mining cap reached. Claim your rewards or return tomorrow.');
      return;
    }

    setTapNotice('');
    const reward = Math.min(settings.tapRewardCoins, remainingDailyCap);

    const nextEnergy = Math.max(0, energyRef.current - settings.energyCostPerTap);
    energyRef.current = nextEnergy;
    setEnergy(nextEnergy);

    if (mode === 'vault') {
      pendingRef.current += reward;
      setPendingLocalCoins(pendingRef.current);
    } else {
      setPreviewTappedTotal((prev) => prev + reward);
    }

    setCoinPressed(true);
    window.setTimeout(() => setCoinPressed(false), 95);

    // Compute local tap burst coordinates
    const rect = e.currentTarget.getBoundingClientRect();
    let clientX = rect.left + rect.width / 2;
    let clientY = rect.top + rect.height / 2;
    if ('touches' in e && e.touches[0]) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e && e.clientX > 0) {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const burstId = burstIdRef.current++;
    const x = Math.max(16, Math.min(rect.width - 44, clientX - rect.left - 18));
    const y = Math.max(12, Math.min(rect.height - 28, clientY - rect.top - 16));
    setBursts((prev) => [...prev.slice(-9), { id: burstId, x, y, amount: reward }]);
    window.setTimeout(() => {
      setBursts((prev) => prev.filter((item) => item.id !== burstId));
    }, 680);

    // Batch background Firestore sync on vault mode
    if (mode === 'vault') {
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
      if (pendingRef.current >= settings.tapRewardCoins * 10) {
        void flushTapBatch();
      } else {
        syncTimerRef.current = window.setTimeout(() => {
          void flushTapBatch();
        }, 1400);
      }
    }
  };

  const handleClaimTap = async () => {
    if (mode !== 'vault') {
      onRequireAuth?.();
      return;
    }
    if (effectiveUnclaimedCoins <= 0) {
      onNotify?.('err', 'Tap the $ATX coin first to mine free rewards.');
      return;
    }
    setBusyTapClaim(true);
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    const localToClaim = pendingRef.current;
    pendingRef.current = 0;
    setPendingLocalCoins(0);

    try {
      const res = await claimTapMiningRewards(localToClaim);
      onNotify?.(
        'ok',
        `Claimed ${res.claimedCoins.toLocaleString()} $${platformConfig.pumpFunToken.ticker} tap rewards (+$${res.creditedUsd.toFixed(2)} credited to Income Wallet)!`
      );
    } catch (err) {
      pendingRef.current += localToClaim;
      setPendingLocalCoins(pendingRef.current);
      onNotify?.('err', (err as Error).message);
    } finally {
      setBusyTapClaim(false);
    }
  };

  const handleStartPaidMining = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode !== 'vault') {
      onRequireAuth?.();
      return;
    }
    if (!selectedPlan) return;
    const amt = Number(stakeAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      onNotify?.('err', 'Enter a valid USD mining stake amount.');
      return;
    }
    setBusyMining(true);
    try {
      await startCoinMiningStake(selectedPlan, amt);
      onNotify?.(
        'ok',
        `Activated ${selectedPlan.name} with $${amt.toFixed(2)}! Daily interest unlocks every 24 hours.`
      );
    } catch (err) {
      onNotify?.('err', (err as Error).message);
    } finally {
      setBusyMining(false);
    }
  };

  const handleClaimRigInterest = async (stake: CoinMiningStake) => {
    setBusyMining(true);
    try {
      const res = await claimCoinMiningInterest(stake);
      onNotify?.(
        'ok',
        `Claimed +$${res.claimedUsd.toFixed(2)} daily mining interest & ${res.claimedCoins.toLocaleString()} $${platformConfig.pumpFunToken.ticker} bonus!`
      );
    } catch (err) {
      onNotify?.('err', (err as Error).message);
    } finally {
      setBusyMining(false);
    }
  };

  const energyPct = Math.min(100, Math.round((energy / Math.max(1, settings.maxEnergy)) * 100));
  const dailyPct = Math.min(
    100,
    Math.round((effectiveDailyTapped / Math.max(1, settings.dailyTapLimitCoins)) * 100)
  );
  const ticker = platformConfig.pumpFunToken.ticker || 'ATX';
  const coinName = platformConfig.pumpFunToken.name || 'Alphatradex';

  const parsedStakeUsd = Number(stakeAmount) || 0;
  const estDailyInterestUsd = selectedPlan ? (parsedStakeUsd * selectedPlan.dailyInterestPercent) / 100 : 0;
  const estTotalInterestUsd = selectedPlan ? estDailyInterestUsd * selectedPlan.durationDays : 0;
  const estTotalBonusCoins = selectedPlan ? parsedStakeUsd * selectedPlan.coinBonusPerUsd : 0;

  return (
    <div className="space-y-6">
      {/* 1. 3D Quantum ASIC Mining Hero Stage */}
      <CoinMiningStage3D
        tokenName={coinName}
        tokenTicker={ticker}
        priceUsd={platformConfig.pumpFunToken.priceUsd}
        change24hPercent={platformConfig.pumpFunToken.change24hPercent}
        onPrimaryAction={() => {
          if (onPrimaryHeroAction) {
            onPrimaryHeroAction();
            return;
          }
          miningDeskRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
        primaryActionLabel={primaryHeroLabel || `Mine & Claim $${ticker}`}
      />

      {/* 2. Admin-Controlled Coin Page Banner Ads */}
      <BannerAdSlot
        bannerAds={platformConfig.bannerAds}
        placement="coin_page"
        onCtaAction={(url) => {
          if (url === '#coin-mining-desk') {
            miningDeskRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else if (url.startsWith('#')) {
            document.getElementById(url.slice(1))?.scrollIntoView({ behavior: 'smooth' });
          }
        }}
      />

      {/* 3. Dual Mining Ecosystem: Free Tap-to-Mine + Paid Coin Mining Plans */}
      <div
        id="coin-mining-desk"
        ref={miningDeskRef}
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
      >
        {/* LEFT COLUMN (5 cols): HAMSTER-STYLE FREE TAP-TO-MINE CONSOLE */}
        {settings.tapToMineEnabled && (
          <div className="lg:col-span-5 bg-[#0B111E]/85 backdrop-blur-md border border-amber-500/35 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold text-amber-400 uppercase tracking-wider">
                  <Hammer className="w-3.5 h-3.5" />
                  Free Tap-to-Mine Arena
                </div>
                <h3 className="font-display font-bold text-white text-lg mt-0.5">
                  Tap Golden ${ticker} Coin
                </h3>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-mono text-slate-400 uppercase">Miner Tier</div>
                <div className={`text-xs font-display font-bold ${minerRank.color}`}>
                  {minerRank.label}
                </div>
              </div>
            </div>

            {/* Balance & Claimable Counter */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                <div className="text-slate-400">Unclaimed Tap Coins</div>
                <div className="font-mono font-extrabold text-xl text-amber-300 tabular-nums">
                  {effectiveUnclaimedCoins.toLocaleString()} <span className="text-xs">${ticker}</span>
                </div>
                <div className="text-[11px] font-mono text-emerald-400 tabular-nums">
                  ≈ ${unclaimedUsdValue.toFixed(3)} USD
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                <div className="text-slate-400">Rate &amp; Claimed</div>
                <div className="font-mono font-bold text-base text-white tabular-nums">
                  +{settings.tapRewardCoins} / tap
                </div>
                <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                  Total: ${(coinTapAccount?.totalClaimedUsdFromTap || 0).toFixed(2)} USD
                </div>
              </div>
            </div>

            {/* Interactive Hamster-Style Tactile Coin Tapper */}
            <div className="relative flex flex-col items-center justify-center py-4 select-none">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute w-56 h-56 rounded-full"
                style={{
                  background:
                    'radial-gradient(circle, rgba(245,158,11,0.28) 0%, rgba(249,115,22,0.08) 52%, transparent 72%)',
                }}
              />

              <button
                type="button"
                onClick={handleCoinTap}
                aria-label={`Tap to mine ${coinName} coin`}
                className={`relative w-44 h-44 sm:w-48 sm:h-48 rounded-full border-4 border-amber-400/80 bg-gradient-to-br from-amber-300 via-amber-500 to-orange-700 shadow-[0_0_50px_rgba(245,158,11,0.45)] flex flex-col items-center justify-center transition-transform duration-75 focus:outline-none focus:ring-4 focus:ring-amber-400/40 cursor-pointer ${
                  coinPressed ? 'scale-95' : 'hover:scale-[1.02]'
                }`}
              >
                <div className="w-36 h-36 sm:w-40 sm:h-40 rounded-full border-2 border-amber-200/50 bg-gradient-to-b from-amber-400/90 to-orange-800/90 flex flex-col items-center justify-center shadow-inner">
                  <Coins className="w-10 h-10 text-amber-100 drop-shadow mb-1" />
                  <span className="font-display font-extrabold text-2xl text-white tracking-tight drop-shadow">
                    ${ticker}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-amber-100/90 uppercase tracking-widest mt-0.5">
                    Tap to Mine
                  </span>
                </div>

                {/* Floating +X ATX bursts */}
                {bursts.map((b) => (
                  <span
                    key={b.id}
                    style={{ left: b.x, top: b.y }}
                    className="pointer-events-none absolute z-30 font-mono font-extrabold text-base text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] -translate-y-4 transition-all duration-500"
                  >
                    +{b.amount}
                  </span>
                ))}
              </button>

              {tapNotice && (
                <div className="mt-3 text-xs text-amber-300 font-medium text-center">{tapNotice}</div>
              )}
            </div>

            {/* Energy Bar & Daily Cap Progress */}
            <div className="space-y-3 text-xs">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between font-mono">
                  <span className="inline-flex items-center gap-1.5 text-slate-300">
                    <BatteryCharging className="w-3.5 h-3.5 text-amber-400" />
                    Mining Energy (+{settings.energyRegenPerSec}/s)
                  </span>
                  <span className="font-bold text-white tabular-nums">
                    {energy} / {settings.maxEnergy}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-300"
                    style={{ width: `${energyPct}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between font-mono">
                  <span className="inline-flex items-center gap-1.5 text-slate-300">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    Daily Tap Cap
                  </span>
                  <span className="font-bold text-slate-200 tabular-nums">
                    {effectiveDailyTapped.toLocaleString()} / {settings.dailyTapLimitCoins.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${dailyPct}%` }}
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={busyTapClaim}
              onClick={handleClaimTap}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-60 text-slate-950 font-display font-bold text-xs sm:text-sm shadow-lg inline-flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <CheckCircle2 className="w-4 h-4" />
              {mode === 'vault'
                ? busyTapClaim
                  ? 'Crediting Rewards...'
                  : `Claim Tap Rewards (+$${unclaimedUsdValue.toFixed(2)})`
                : 'Sign In to Save & Claim Real Tap Rewards'}
            </button>
          </div>
        )}

        {/* RIGHT COLUMN (7 cols): PAID COIN MINING PLANS + DAILY INTEREST CLAIM */}
        {settings.paidMiningEnabled && (
          <div
            className={`${
              settings.tapToMineEnabled ? 'lg:col-span-7' : 'lg:col-span-12'
            } space-y-5`}
          >
            <div className="bg-[#0B111E]/85 backdrop-blur-md border border-slate-700/75 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xl">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold text-orange-400 uppercase tracking-wider">
                    <Cpu className="w-3.5 h-3.5" />
                    Paid Cloud ASIC Mining Tiers
                  </div>
                  <h3 className="font-display font-bold text-white text-lg mt-0.5">
                    Stake USD &amp; Claim Daily Mining Interest
                  </h3>
                </div>
                {mode === 'vault' && userProfile && (
                  <div className="text-right font-mono text-xs">
                    <div className="text-slate-400">Deposit Wallet</div>
                    <div className="font-bold text-white text-sm tabular-nums">
                      ${userProfile.usdBalance.toFixed(2)}
                    </div>
                  </div>
                )}
              </div>

              {activePlans.length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed border-slate-700 text-center text-xs text-slate-400">
                  No coin mining rigs are currently active. Super Admin can publish rigs from the admin desk.
                </div>
              ) : (
                <>
                  {/* Mining Plans Selector Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {activePlans.map((plan) => {
                      const active = selectedPlan?.id === plan.id;
                      return (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => {
                            setSelectedPlanId(plan.id);
                            setStakeAmount(String(plan.minUsd));
                          }}
                          className={`p-4 rounded-xl border text-left space-y-2 transition-colors ${
                            active
                              ? 'bg-slate-900 border-amber-400 shadow-[0_0_24px_rgba(245,158,11,0.18)]'
                              : 'bg-slate-900/60 border-slate-800 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-display font-bold text-white text-sm truncate">
                              {plan.name}
                            </span>
                            <Flame
                              className={`w-3.5 h-3.5 shrink-0 ${
                                active ? 'text-amber-400' : 'text-slate-500'
                              }`}
                            />
                          </div>
                          <div className="font-mono font-extrabold text-xl text-emerald-400 tabular-nums">
                            {plan.dailyInterestPercent}%{' '}
                            <span className="text-[11px] font-normal text-slate-400">/ day</span>
                          </div>
                          <div className="space-y-0.5 text-[11px] font-mono text-slate-300 tabular-nums">
                            <div>
                              Range: ${plan.minUsd.toLocaleString()} – ${plan.maxUsd.toLocaleString()}
                            </div>
                            <div>
                              Term: {plan.durationDays}d · {plan.hashRateLabel}
                            </div>
                            <div className="text-amber-300">
                              +{plan.coinBonusPerUsd} ${ticker} per $1 staked
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Deploy Mining Rig Form */}
                  {selectedPlan && (
                    <form
                      onSubmit={handleStartPaidMining}
                      className="p-4 rounded-xl bg-slate-900/75 border border-slate-800 space-y-4"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                        <div className="sm:col-span-5">
                          <label className="block text-xs font-semibold text-slate-300 mb-1">
                            Stake USD (${selectedPlan.minUsd} – ${selectedPlan.maxUsd})
                          </label>
                          <input
                            type="number"
                            min={selectedPlan.minUsd}
                            max={selectedPlan.maxUsd}
                            step="1"
                            required
                            value={stakeAmount}
                            onChange={(e) => setStakeAmount(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-950 text-white font-mono text-sm tabular-nums"
                          />
                        </div>
                        <div className="sm:col-span-7 grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="p-2 rounded-lg bg-slate-950/90 border border-slate-800">
                            <div className="text-[10px] text-slate-400">Daily Claim</div>
                            <div className="font-mono font-bold text-emerald-400 tabular-nums mt-0.5">
                              +${estDailyInterestUsd.toFixed(2)}
                            </div>
                          </div>
                          <div className="p-2 rounded-lg bg-slate-950/90 border border-slate-800">
                            <div className="text-[10px] text-slate-400">{selectedPlan.durationDays}d Yield</div>
                            <div className="font-mono font-bold text-white tabular-nums mt-0.5">
                              ${estTotalInterestUsd.toFixed(2)}
                            </div>
                          </div>
                          <div className="p-2 rounded-lg bg-slate-950/90 border border-slate-800">
                            <div className="text-[10px] text-slate-400">${ticker} Bonus</div>
                            <div className="font-mono font-bold text-amber-300 tabular-nums mt-0.5">
                              +{estTotalBonusCoins.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                          {[
                            selectedPlan.minUsd,
                            Math.min(selectedPlan.maxUsd, selectedPlan.minUsd * 2),
                            Math.min(selectedPlan.maxUsd, selectedPlan.minUsd * 5),
                          ]
                            .filter((v, idx, arr) => arr.indexOf(v) === idx)
                            .map((presetUsd) => (
                              <button
                                key={presetUsd}
                                type="button"
                                onClick={() => setStakeAmount(String(presetUsd))}
                                className="px-2.5 py-1 rounded border border-slate-700 bg-slate-800/80 text-slate-200 hover:border-amber-400"
                              >
                                ${presetUsd}
                              </button>
                            ))}
                        </div>

                        <button
                          type="submit"
                          disabled={busyMining}
                          className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-white font-display font-bold text-xs sm:text-sm inline-flex items-center gap-2 whitespace-nowrap shrink-0"
                        >
                          <Zap className="w-4 h-4" />
                          {mode === 'vault'
                            ? busyMining
                              ? 'Deploying Rig...'
                              : `Activate ${selectedPlan.name}`
                            : 'Sign In to Start Coin Mining'}
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>

            {/* Active Coin Mining Stakes & 24h Daily Claim Ledger (Vault Mode) */}
            {mode === 'vault' && (
              <div className="bg-[#0B111E]/85 backdrop-blur-md border border-slate-700/75 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Pickaxe className="w-4 h-4 text-amber-400" />
                    <h3 className="font-display font-bold text-white text-base">
                      My Active Mining Rigs &amp; Daily Interest Claims ({coinMiningStakes.length})
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    24h Daily Cycle
                  </span>
                </div>

                {coinMiningStakes.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">
                    No active coin mining rigs yet. Select a rig tier above to start earning daily USD interest + ${ticker} bonus.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {coinMiningStakes.map((stake) => {
                      const MS_PER_DAY = 86_400_000;
                      const maxEndMs = stake.startedAtMs + stake.durationDays * MS_PER_DAY;
                      const effectiveNow = Math.min(nowMs, maxEndMs);
                      const elapsedDays = Math.floor((effectiveNow - stake.startedAtMs) / MS_PER_DAY);
                      const claimedDays = Math.floor((stake.lastClaimAtMs - stake.startedAtMs) / MS_PER_DAY);
                      const claimableDays =
                        stake.status === 'active' ? Math.max(0, elapsedDays - claimedDays) : 0;

                      const dailyUsd = (stake.principalUsd * stake.dailyInterestPercent) / 100;
                      const claimableUsd = Number((dailyUsd * claimableDays).toFixed(2));
                      const claimableCoins = Number(
                        (((stake.principalUsd * stake.coinBonusPerUsd) / stake.durationDays) * claimableDays).toFixed(2)
                      );

                      const nextUnlockAtMs = stake.startedAtMs + (elapsedDays + 1) * MS_PER_DAY;
                      const countdownMs = stake.status === 'active' && elapsedDays < stake.durationDays
                        ? Math.max(0, nextUnlockAtMs - nowMs)
                        : 0;
                      const progressPct = Math.min(
                        100,
                        Math.round((Math.min(stake.durationDays, elapsedDays) / Math.max(1, stake.durationDays)) * 100)
                      );

                      return (
                        <div
                          key={stake.id}
                          className="p-4 rounded-xl border border-slate-700/80 bg-slate-900/75 space-y-3 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Award className="w-4 h-4 text-amber-400 shrink-0" />
                              <span className="font-display font-bold text-white text-sm">
                                {stake.planName}
                              </span>
                              <span className="font-mono text-slate-400 tabular-nums">
                                ${stake.principalUsd.toFixed(2)} · {stake.dailyInterestPercent}%/d
                              </span>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded font-mono font-semibold text-[11px] uppercase ${
                                stake.status === 'completed'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-amber-500/20 text-amber-300'
                              }`}
                            >
                              {stake.status}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono tabular-nums">
                            <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
                              <div className="text-[10px] text-slate-400">Daily Interest</div>
                              <div className="font-bold text-emerald-400">+${dailyUsd.toFixed(2)}</div>
                            </div>
                            <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
                              <div className="text-[10px] text-slate-400">USD Claimed</div>
                              <div className="font-bold text-white">${stake.claimedUsd.toFixed(2)}</div>
                            </div>
                            <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
                              <div className="text-[10px] text-slate-400">${ticker} Mined</div>
                              <div className="font-bold text-amber-300">
                                {stake.claimedCoins.toLocaleString()}
                              </div>
                            </div>
                            <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
                              <div className="text-[10px] text-slate-400">Next 24h Cycle</div>
                              <div className="font-bold text-sky-300 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {stake.status === 'completed' ? 'Done' : formatCountdown(countdownMs)}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between font-mono text-[11px] text-slate-400 tabular-nums">
                              <span>
                                Cycle {Math.min(stake.durationDays, elapsedDays)} / {stake.durationDays} days
                              </span>
                              <span>{progressPct}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                              {claimableDays > 0
                                ? `Ready now: +$${claimableUsd.toFixed(2)} & +${claimableCoins.toLocaleString()} $${ticker}`
                                : 'Interest accrues automatically every 24 hours'}
                            </span>

                            {stake.status === 'active' && (
                              <button
                                type="button"
                                disabled={busyMining || claimableDays <= 0}
                                onClick={() => handleClaimRigInterest(stake)}
                                className={`px-3.5 py-1.5 rounded-lg font-display font-bold text-xs inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                                  claimableDays > 0
                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                    : 'bg-slate-800 text-slate-400 cursor-not-allowed'
                                }`}
                              >
                                <TrendingUp className="w-3.5 h-3.5" />
                                {claimableDays > 0
                                  ? `Claim Daily Interest (+$${claimableUsd.toFixed(2)})`
                                  : `Locked (${formatCountdown(countdownMs)})`}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
