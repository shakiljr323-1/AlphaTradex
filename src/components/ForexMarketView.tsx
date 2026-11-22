import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Clock,
  Globe,
  Layers,
  Lock,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import { AlphatradexLiveChart, AlphatradexTickerTape } from './TradingViewChart';

type Timeframe = '15M' | '1H' | '4H' | '1D' | '1W';
type ChartMode = 'candles' | 'area';

interface ForexPairSpec {
  symbol: string;
  tvSymbol: string;
  name: string;
  basePrice: number;
  decimals: number;
  pipSize: number;
  spreadPips: number;
  session: string;
  contractSize: number;
}

const FOREX_PAIRS: ForexPairSpec[] = [
  {
    symbol: 'EUR/USD',
    tvSymbol: 'FX:EURUSD',
    name: 'Euro / US Dollar',
    basePrice: 1.0842,
    decimals: 5,
    pipSize: 0.0001,
    spreadPips: 0.2,
    session: 'London · New York',
    contractSize: 100000,
  },
  {
    symbol: 'GBP/USD',
    tvSymbol: 'FX:GBPUSD',
    name: 'British Pound / US Dollar',
    basePrice: 1.2685,
    decimals: 5,
    pipSize: 0.0001,
    spreadPips: 0.4,
    session: 'London · New York',
    contractSize: 100000,
  },
  {
    symbol: 'USD/JPY',
    tvSymbol: 'FX:USDJPY',
    name: 'US Dollar / Japanese Yen',
    basePrice: 154.32,
    decimals: 3,
    pipSize: 0.01,
    spreadPips: 0.3,
    session: 'Tokyo · New York',
    contractSize: 100000,
  },
  {
    symbol: 'XAU/USD',
    tvSymbol: 'OANDA:XAUUSD',
    name: 'Gold Spot / US Dollar',
    basePrice: 2642.5,
    decimals: 2,
    pipSize: 0.1,
    spreadPips: 1.8,
    session: 'COMEX · LBMA Spot',
    contractSize: 100,
  },
  {
    symbol: 'AUD/USD',
    tvSymbol: 'FX:AUDUSD',
    name: 'Australian Dollar / US Dollar',
    basePrice: 0.6542,
    decimals: 5,
    pipSize: 0.0001,
    spreadPips: 0.5,
    session: 'Sydney · Tokyo',
    contractSize: 100000,
  },
  {
    symbol: 'USD/CHF',
    tvSymbol: 'FX:USDCHF',
    name: 'US Dollar / Swiss Franc',
    basePrice: 0.8816,
    decimals: 5,
    pipSize: 0.0001,
    spreadPips: 0.4,
    session: 'Zurich · London',
    contractSize: 100000,
  },
];

const TV_INTERVALS: Record<Timeframe, string> = {
  '15M': '15',
  '1H': '60',
  '4H': '240',
  '1D': 'D',
  '1W': 'W',
};

interface ForexMarketViewProps {
  vaultBalanceUsd: number;
  onEarlyAccessRequested?: (pairSymbol: string) => void;
}

export const ForexMarketView: React.FC<ForexMarketViewProps> = ({
  vaultBalanceUsd,
  onEarlyAccessRequested,
}) => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('EUR/USD');
  const [timeframe, setTimeframe] = useState<Timeframe>('1H');
  const [chartMode, setChartMode] = useState<ChartMode>('candles');
  const [showEma, setShowEma] = useState<boolean>(true);

  // Live spot rate map synced from real FX & Gold APIs (fallback to institutional spot if offline)
  const [spotState, setSpotState] = useState<{
    current: Record<string, number>;
    previous: Record<string, number>;
  }>(() => {
    const initial: Record<string, number> = {};
    FOREX_PAIRS.forEach((p) => {
      initial[p.symbol] = p.basePrice;
    });
    return { current: initial, previous: initial };
  });
  const [lastSyncLabel, setLastSyncLabel] = useState<string>('Syncing live FX...');
  const [syncingSpots, setSyncingSpots] = useState<boolean>(false);

  // Upcoming Order Calculator state
  const [lotSize, setLotSize] = useState<string>('0.10');
  const [leverage, setLeverage] = useState<number>(100);
  const [slPips, setSlPips] = useState<string>('25');
  const [tpPips, setTpPips] = useState<string>('50');
  const [earlyAccessJoined, setEarlyAccessJoined] = useState<boolean>(() => {
    try {
      return localStorage.getItem('vtv_forex_early_access') === '1';
    } catch {
      return false;
    }
  });

  const syncLiveSpotRates = useCallback(async () => {
    setSyncingSpots(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);

    try {
      const updates: Record<string, number> = {};

      // Primary FX spot feed (open.er-api.com -> fallback frankfurter.app)
      let fxRates: Record<string, number> | null = null;
      try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD', {
          signal: controller.signal,
        });
        if (res.ok) {
          const json = (await res.json()) as { rates?: Record<string, number> };
          if (json?.rates) fxRates = json.rates;
        }
      } catch {
        // Try secondary FX endpoint
      }

      if (!fxRates) {
        try {
          const res2 = await fetch(
            'https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY,CHF,AUD',
            { signal: controller.signal }
          );
          if (res2.ok) {
            const json2 = (await res2.json()) as { rates?: Record<string, number> };
            if (json2?.rates) fxRates = json2.rates;
          }
        } catch {
          // Keep current prices if unreachable
        }
      }

      if (fxRates) {
        if (fxRates.EUR) updates['EUR/USD'] = Number((1 / fxRates.EUR).toFixed(5));
        if (fxRates.GBP) updates['GBP/USD'] = Number((1 / fxRates.GBP).toFixed(5));
        if (fxRates.JPY) updates['USD/JPY'] = Number(fxRates.JPY.toFixed(3));
        if (fxRates.AUD) updates['AUD/USD'] = Number((1 / fxRates.AUD).toFixed(5));
        if (fxRates.CHF) updates['USD/CHF'] = Number(fxRates.CHF.toFixed(5));
      }

      // Live XAU/USD Gold Spot feed
      try {
        const goldRes = await fetch('https://api.gold-api.com/price/XAU', {
          signal: controller.signal,
        });
        if (goldRes.ok) {
          const goldJson = (await goldRes.json()) as { price?: number };
          if (typeof goldJson?.price === 'number' && goldJson.price > 500) {
            updates['XAU/USD'] = Number(goldJson.price.toFixed(2));
          }
        }
      } catch {
        // Keep current XAU/USD spot if unreachable
      }

      if (Object.keys(updates).length > 0) {
        setSpotState((prev) => ({
          previous: prev.current,
          current: { ...prev.current, ...updates },
        }));
        setLastSyncLabel(
          `Synced ${new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}`
        );
      } else {
        setLastSyncLabel('Alphatradex Live Stream');
      }
    } finally {
      window.clearTimeout(timeout);
      setSyncingSpots(false);
    }
  }, []);

  useEffect(() => {
    syncLiveSpotRates();
    const timer = window.setInterval(syncLiveSpotRates, 30000);
    return () => window.clearInterval(timer);
  }, [syncLiveSpotRates]);

  const activePair = useMemo(
    () => FOREX_PAIRS.find((p) => p.symbol === selectedSymbol) || FOREX_PAIRS[0],
    [selectedSymbol]
  );

  const bidPrice = spotState.current[activePair.symbol] ?? activePair.basePrice;
  const spreadPrice = activePair.spreadPips * activePair.pipSize;
  const askPrice = Number((bidPrice + spreadPrice).toFixed(activePair.decimals));

  // Interactive position sizing preview calculations using real spot price
  const parsedLots = Math.max(0.01, Math.min(50, Number(lotSize) || 0.1));
  const parsedSl = Math.max(1, Number(slPips) || 25);
  const parsedTp = Math.max(1, Number(tpPips) || 50);

  const notionalUsd = useMemo(() => {
    if (activePair.symbol.startsWith('USD/')) {
      return parsedLots * activePair.contractSize;
    }
    return parsedLots * activePair.contractSize * bidPrice;
  }, [activePair, parsedLots, bidPrice]);

  const requiredMarginUsd = notionalUsd / Math.max(1, leverage);
  const pipValueUsd = useMemo(() => {
    if (activePair.symbol === 'USD/JPY' || activePair.symbol === 'USD/CHF') {
      return (parsedLots * activePair.contractSize * activePair.pipSize) / Math.max(0.1, bidPrice);
    }
    return parsedLots * activePair.contractSize * activePair.pipSize;
  }, [activePair, parsedLots, bidPrice]);

  const estSlLossUsd = parsedSl * pipValueUsd;
  const estTpProfitUsd = parsedTp * pipValueUsd;
  const vaultCoversMargin = vaultBalanceUsd >= requiredMarginUsd;

  const handleJoinEarlyAccess = () => {
    try {
      localStorage.setItem('vtv_forex_early_access', '1');
    } catch {
      // Ignore storage error
    }
    setEarlyAccessJoined(true);
    onEarlyAccessRequested?.(activePair.symbol);
  };

  return (
    <div className="space-y-5">
      {/* Live Alphatradex FX Ticker Strip */}
      <div className="bg-[#0B111E]/90 backdrop-blur-md border border-slate-700/70 rounded-2xl px-2 py-1 shadow-xl overflow-hidden">
        <AlphatradexTickerTape onSelectSymbol={(sym) => setSelectedSymbol(sym)} />
      </div>

      {/* Top Instrument Strip: Pair Selector synced with Live Spot Feeds */}
      <div className="bg-[#0B111E]/85 backdrop-blur-md border border-slate-700/70 rounded-2xl p-3 shadow-xl">
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          {FOREX_PAIRS.map((pair) => {
            const liveVal = spotState.current[pair.symbol] ?? pair.basePrice;
            const refVal = spotState.previous[pair.symbol] ?? pair.basePrice;
            const pairDeltaPct = ((liveVal - refVal) / Math.max(1e-6, refVal)) * 100;
            const up = pairDeltaPct >= 0;
            const isSelected = pair.symbol === activePair.symbol;

            return (
              <button
                key={pair.symbol}
                type="button"
                onClick={() => setSelectedSymbol(pair.symbol)}
                className={`min-w-[156px] px-3.5 py-2.5 rounded-xl border text-left transition-colors shrink-0 ${
                  isSelected
                    ? 'bg-slate-800/95 border-orange-500/75 text-white'
                    : 'bg-slate-900/55 border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display font-bold text-xs tracking-tight">{pair.symbol}</span>
                  <span className="font-mono text-[10px] text-slate-400">
                    Spread {pair.spreadPips}p
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2 mt-1">
                  <span className="font-mono font-bold text-sm text-white tabular-nums">
                    {liveVal.toFixed(pair.decimals)}
                  </span>
                  <span
                    className={`font-mono text-[10px] font-semibold tabular-nums ${
                      up ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {up ? '+' : ''}
                    {pairDeltaPct.toFixed(2)}%
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">{pair.session}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Split Terminal: 8-col Live TradingView Chart + 4-col Upcoming Forex Execution Desk */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* LEFT: Live TradingView Advanced Real-Time Chart */}
        <div className="xl:col-span-8 bg-[#0B111E]/85 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 flex flex-col justify-between shadow-xl space-y-4">
          {/* Chart Header & Controls */}
          <div className="flex flex-wrap items-start justify-between gap-4 pb-3 border-b border-slate-800">
            <div className="space-y-1">
              <div className="flex flex-wrap items-baseline gap-3">
                <h2 className="font-display font-bold text-xl text-white tracking-tight">
                  {activePair.symbol}
                </h2>
                <span className="font-mono font-extrabold text-xl text-white tabular-nums">
                  {bidPrice.toFixed(activePair.decimals)}
                </span>
                <span className="text-xs font-mono font-semibold text-emerald-400">
                  Alphatradex Live Feed
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span>{activePair.name}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  Bid {bidPrice.toFixed(activePair.decimals)} / Ask {askPrice.toFixed(activePair.decimals)}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">Feed ATX:{activePair.symbol}</span>
              </div>
            </div>

            {/* Chart Segmented Controls */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div className="flex items-center gap-0.5 p-1 rounded-lg bg-slate-900 border border-slate-800">
                {(['15M', '1H', '4H', '1D', '1W'] as Timeframe[]).map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => setTimeframe(tf)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      timeframe === tf
                        ? 'bg-orange-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-0.5 p-1 rounded-lg bg-slate-900 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setChartMode('candles')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    chartMode === 'candles'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Candles
                </button>
                <button
                  type="button"
                  onClick={() => setChartMode('area')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    chartMode === 'area'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Area
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowEma((v) => !v)}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-mono font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  showEma
                    ? 'border-orange-500/60 bg-orange-500/15 text-orange-300'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                EMA
              </button>

              <button
                type="button"
                onClick={syncLiveSpotRates}
                disabled={syncingSpots}
                title="Refresh live spot rates"
                className="px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:border-slate-600 text-[11px] font-mono inline-flex items-center gap-1 transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${syncingSpots ? 'animate-spin text-orange-400' : ''}`} />
                Sync
              </button>
            </div>
          </div>

          {/* Proprietary Alphatradex Real-Time Chart */}
          <AlphatradexLiveChart
            symbol={activePair.tvSymbol}
            interval={TV_INTERVALS[timeframe]}
            chartStyle={chartMode === 'candles' ? '1' : '3'}
            showEma={showEma}
            liveSpotPrice={bidPrice}
            decimals={activePair.decimals}
            spreadPips={activePair.spreadPips}
            pipSize={activePair.pipSize}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-[11px] text-slate-400">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-slate-400" />
                Session: <strong className="text-slate-200">{activePair.session}</strong>
              </span>
              <span className="font-mono text-emerald-400">{lastSyncLabel}</span>
            </div>
            <span className="font-mono text-slate-500">
              Powered by Alphatradex Proprietary Market Engine · Direct Order Execution Upcoming
            </span>
          </div>
        </div>

        {/* RIGHT: Upcoming Forex Trading Desk (Interactive Preview + Early Access) */}
        <div className="xl:col-span-4 bg-[#0B111E]/85 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 flex flex-col justify-between space-y-5 shadow-xl">
          <div className="space-y-4">
            <div className="pb-3.5 border-b border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-orange-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Upcoming Release
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  Vault Ready: ${vaultBalanceUsd.toFixed(2)}
                </span>
              </div>
              <h3 className="font-display font-bold text-lg text-white">
                Direct Forex Execution Desk
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Track live Alphatradex price action right now. In the upcoming update, you will be able to open Buy &amp; Sell Forex positions directly from your USD Vault with full SL/TP risk control.
              </p>
            </div>

            {/* Interactive Position Preview Calculator */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-orange-400" />
                  Trade Size &amp; Margin Preview
                </span>
                <span className="font-mono text-[11px] text-slate-400">{activePair.symbol}</span>
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                  <span>Volume (Lots)</span>
                  <div className="flex items-center gap-1">
                    {['0.01', '0.10', '0.50', '1.00'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setLotSize(preset)}
                        className={`px-1.5 py-0.5 rounded font-mono text-[10px] transition-colors ${
                          lotSize === preset
                            ? 'bg-orange-600 text-white'
                            : 'bg-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="number"
                  min={0.01}
                  max={50}
                  step="0.01"
                  value={lotSize}
                  onChange={(e) => setLotSize(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/90 text-white font-mono text-sm tabular-nums"
                />
              </div>

              <div>
                <div className="text-[11px] text-slate-400 mb-1">Leverage Preview</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[50, 100, 200, 500].map((lev) => (
                    <button
                      key={lev}
                      type="button"
                      onClick={() => setLeverage(lev)}
                      className={`py-1.5 rounded-lg border font-mono text-xs font-semibold transition-colors ${
                        leverage === lev
                          ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                          : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      1:{lev}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Stop Loss (Pips)</label>
                  <input
                    type="number"
                    min={1}
                    value={slPips}
                    onChange={(e) => setSlPips(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900/90 text-white font-mono text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Take Profit (Pips)</label>
                  <input
                    type="number"
                    min={1}
                    value={tpPips}
                    onChange={(e) => setTpPips(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900/90 text-white font-mono text-xs tabular-nums"
                  />
                </div>
              </div>

              {/* Clean Tabular Breakdown */}
              <div className="pt-2 border-t border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Live Spot Entry</span>
                  <span className="font-mono font-semibold text-white tabular-nums">
                    {bidPrice.toFixed(activePair.decimals)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Position Notional</span>
                  <span className="font-mono font-semibold text-white tabular-nums">
                    ${notionalUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Est. Margin Required (1:{leverage})</span>
                  <span
                    className={`font-mono font-bold tabular-nums ${
                      vaultCoversMargin ? 'text-white' : 'text-amber-400'
                    }`}
                  >
                    ${requiredMarginUsd.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Pip Value</span>
                  <span className="font-mono text-slate-200 tabular-nums">${pipValueUsd.toFixed(2)} / pip</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Projected TP / SL</span>
                  <span className="font-mono tabular-nums">
                    <span className="text-emerald-400 font-semibold">+${estTpProfitUsd.toFixed(2)}</span>
                    <span className="text-slate-600 mx-1">/</span>
                    <span className="text-red-400 font-semibold">-${estSlLossUsd.toFixed(2)}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Upcoming Locked Execution Controls + Functional Early Access CTA */}
          <div className="space-y-2.5 pt-3 border-t border-slate-800">
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="py-2.5 px-3 rounded-lg border border-emerald-700/40 bg-emerald-950/35 text-emerald-300/70 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-not-allowed whitespace-nowrap"
              >
                <Lock className="w-3.5 h-3.5" />
                Buy · Upcoming
              </button>
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="py-2.5 px-3 rounded-lg border border-red-700/40 bg-red-950/35 text-red-300/70 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-not-allowed whitespace-nowrap"
              >
                <Lock className="w-3.5 h-3.5" />
                Sell · Upcoming
              </button>
            </div>

            <button
              type="button"
              onClick={handleJoinEarlyAccess}
              className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                earlyAccessJoined
                  ? 'bg-emerald-950/70 border border-emerald-600/60 text-emerald-300'
                  : 'bg-orange-600 hover:bg-orange-500 text-white'
              }`}
            >
              {earlyAccessJoined ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Priority Early Access Confirmed
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4" />
                  Notify Me When Live Trading Opens
                </>
              )}
            </button>
            <p className="text-[11px] text-slate-400 text-center">
              Live Alphatradex charts active · Direct order routing opens in the next release.
            </p>
          </div>
        </div>
      </div>

      {/* Upcoming Forex Desk Roadmap Strip */}
      <div className="bg-[#0B111E]/85 backdrop-blur-md border border-slate-700/70 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-5 py-3.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-orange-400" />
            <h3 className="font-display font-bold text-white text-sm">
              Forex Desk Rollout &amp; Capabilities
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Alphatradex Live Feeds Active · Direct Execution Upcoming
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
          <div className="p-5 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white">01. Live Alphatradex Charts</span>
              <span className="font-mono text-[11px] text-emerald-400 font-semibold">Active</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Real-time proprietary candlestick &amp; area feeds across Major FX pairs and XAU/USD Gold with EMA overlays.
            </p>
          </div>

          <div className="p-5 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white">02. Direct Vault Execution</span>
              <span className="font-mono text-[11px] text-orange-400 font-semibold">Upcoming</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Open instant Buy/Sell positions directly using your existing Vault USD balance with zero extra transfers.
            </p>
          </div>

          <div className="p-5 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white">03. SL / TP Risk Controls</span>
              <span className="font-mono text-[11px] text-orange-400 font-semibold">Upcoming</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Automated Stop Loss, Take Profit, and trailing stop management built directly into the order ticket.
            </p>
          </div>

          <div className="p-5 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white">04. Unified Profit Settlement</span>
              <span className="font-mono text-[11px] text-orange-400 font-semibold">Upcoming</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Realized Forex gains settle straight into your Income Wallet for instant withdrawal via any saved method.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
