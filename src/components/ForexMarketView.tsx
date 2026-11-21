import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Clock,
  Globe,
  Layers,
  Lock,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

type Timeframe = '15M' | '1H' | '4H' | '1D' | '1W';
type ChartMode = 'candles' | 'area';

interface ForexPairSpec {
  symbol: string;
  name: string;
  basePrice: number;
  decimals: number;
  pipSize: number;
  spreadPips: number;
  volatility: number;
  session: string;
  contractSize: number;
}

interface Candle {
  timeLabel: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const FOREX_PAIRS: ForexPairSpec[] = [
  {
    symbol: 'EUR/USD',
    name: 'Euro / US Dollar',
    basePrice: 1.0842,
    decimals: 5,
    pipSize: 0.0001,
    spreadPips: 0.2,
    volatility: 0.0014,
    session: 'London · New York',
    contractSize: 100000,
  },
  {
    symbol: 'GBP/USD',
    name: 'British Pound / US Dollar',
    basePrice: 1.2685,
    decimals: 5,
    pipSize: 0.0001,
    spreadPips: 0.4,
    volatility: 0.0018,
    session: 'London · New York',
    contractSize: 100000,
  },
  {
    symbol: 'USD/JPY',
    name: 'US Dollar / Japanese Yen',
    basePrice: 154.32,
    decimals: 3,
    pipSize: 0.01,
    spreadPips: 0.3,
    volatility: 0.22,
    session: 'Tokyo · New York',
    contractSize: 100000,
  },
  {
    symbol: 'XAU/USD',
    name: 'Gold Spot / US Dollar',
    basePrice: 2642.5,
    decimals: 2,
    pipSize: 0.1,
    spreadPips: 1.8,
    volatility: 6.4,
    session: 'COMEX · LBMA Spot',
    contractSize: 100,
  },
  {
    symbol: 'AUD/USD',
    name: 'Australian Dollar / US Dollar',
    basePrice: 0.6542,
    decimals: 5,
    pipSize: 0.0001,
    spreadPips: 0.5,
    volatility: 0.0012,
    session: 'Sydney · Tokyo',
    contractSize: 100000,
  },
  {
    symbol: 'USD/CHF',
    name: 'US Dollar / Swiss Franc',
    basePrice: 0.8816,
    decimals: 5,
    pipSize: 0.0001,
    spreadPips: 0.4,
    volatility: 0.0013,
    session: 'Zurich · London',
    contractSize: 100000,
  },
];

const TIMEFRAME_MINUTES: Record<Timeframe, number> = {
  '15M': 15,
  '1H': 60,
  '4H': 240,
  '1D': 1440,
  '1W': 10080,
};

const TIMEFRAME_SCALE: Record<Timeframe, number> = {
  '15M': 0.55,
  '1H': 1.0,
  '4H': 1.75,
  '1D': 2.8,
  '1W': 4.6,
};

// Deterministic pseudo-random helper so each pair/timeframe renders consistent market history
function seededNoise(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function formatAxisTime(date: Date, tf: Timeframe): string {
  if (tf === '1D' || tf === '1W') {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
}

function generateCandles(pair: ForexPairSpec, tf: Timeframe, anchorPrice: number, count = 48): Candle[] {
  const stepMs = TIMEFRAME_MINUTES[tf] * 60 * 1000;
  const vol = pair.volatility * TIMEFRAME_SCALE[tf];
  const pairSeed = pair.symbol.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const tfSeed = tf.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

  // Build backwards from anchorPrice so the latest candle closes near real spot price
  const rawDeltas: number[] = [];
  for (let i = 0; i < count; i++) {
    const r1 = seededNoise(pairSeed * 17 + tfSeed * 31 + i * 7.3);
    const wave = Math.sin((i + pairSeed) * 0.28) * 0.25 + (r1 - 0.485) * 1.45;
    rawDeltas.push(wave * vol);
  }

  const totalDrift = rawDeltas.reduce((a, b) => a + b, 0);
  let cursor = anchorPrice - totalDrift;
  const now = Date.now();
  const candles: Candle[] = [];

  for (let i = 0; i < count; i++) {
    const open = cursor;
    const close = i === count - 1 ? anchorPrice : open + rawDeltas[i];
    const wickUp = seededNoise(pairSeed + i * 19.1) * vol * 0.72;
    const wickDown = seededNoise(tfSeed + i * 23.7) * vol * 0.72;
    const high = Math.max(open, close) + wickUp;
    const low = Math.min(open, close) - wickDown;
    const volume = 35 + Math.round(seededNoise(pairSeed * 3 + i * 11.7) * 65);
    const ts = new Date(now - (count - 1 - i) * stepMs);

    candles.push({
      timeLabel: formatAxisTime(ts, tf),
      open: Number(open.toFixed(pair.decimals)),
      high: Number(high.toFixed(pair.decimals)),
      low: Number(low.toFixed(pair.decimals)),
      close: Number(close.toFixed(pair.decimals)),
      volume,
    });
    cursor = close;
  }

  return candles;
}

function computeEma(candles: Candle[], period = 20): number[] {
  if (candles.length === 0) return [];
  const k = 2 / (period + 1);
  const result: number[] = [candles[0].close];
  for (let i = 1; i < candles.length; i++) {
    result.push(candles[i].close * k + result[i - 1] * (1 - k));
  }
  return result;
}

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
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // Real spot anchor map (starts with institutional defaults, silently syncs live USD crosses if reachable)
  const [spotAnchors, setSpotAnchors] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    FOREX_PAIRS.forEach((p) => {
      initial[p.symbol] = p.basePrice;
    });
    return initial;
  });

  // Live micro-tick offsets for realistic desk motion
  const [liveOffsets, setLiveOffsets] = useState<Record<string, number>>({});

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

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Silent non-blocking FX spot sync (no errors if blocked/offline)
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    fetch('https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY,CHF,AUD', {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { rates?: Record<string, number> } | null) => {
        if (!data?.rates) return;
        const r = data.rates;
        setSpotAnchors((prev) => ({
          ...prev,
          'EUR/USD': r.EUR ? Number((1 / r.EUR).toFixed(5)) : prev['EUR/USD'],
          'GBP/USD': r.GBP ? Number((1 / r.GBP).toFixed(5)) : prev['GBP/USD'],
          'USD/JPY': r.JPY ? Number(r.JPY.toFixed(3)) : prev['USD/JPY'],
          'AUD/USD': r.AUD ? Number((1 / r.AUD).toFixed(5)) : prev['AUD/USD'],
          'USD/CHF': r.CHF ? Number(r.CHF.toFixed(5)) : prev['USD/CHF'],
        }));
      })
      .catch(() => {
        // Fallback institutional quotes remain active seamlessly
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  // Gentle real-time tick movement every 2.4s
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveOffsets((prev) => {
        const next: Record<string, number> = { ...prev };
        for (const pair of FOREX_PAIRS) {
          const cur = prev[pair.symbol] || 0;
          const step = (Math.random() - 0.49) * pair.pipSize * 3.2;
          const clamped = Math.max(-pair.volatility * 1.4, Math.min(pair.volatility * 1.4, cur + step));
          next[pair.symbol] = clamped;
        }
        return next;
      });
    }, 2400);
    return () => clearInterval(timer);
  }, []);

  const activePair = useMemo(
    () => FOREX_PAIRS.find((p) => p.symbol === selectedSymbol) || FOREX_PAIRS[0],
    [selectedSymbol]
  );

  const candles = useMemo(() => {
    const anchor = spotAnchors[activePair.symbol] || activePair.basePrice;
    const base = generateCandles(activePair, timeframe, anchor, 48);
    const offset = liveOffsets[activePair.symbol] || 0;
    if (base.length === 0) return base;
    const last = base[base.length - 1];
    const updatedClose = Number((last.close + offset).toFixed(activePair.decimals));
    const updatedLast: Candle = {
      ...last,
      close: updatedClose,
      high: Number(Math.max(last.high, updatedClose).toFixed(activePair.decimals)),
      low: Number(Math.min(last.low, updatedClose).toFixed(activePair.decimals)),
    };
    return [...base.slice(0, -1), updatedLast];
  }, [activePair, timeframe, spotAnchors, liveOffsets]);

  const emaValues = useMemo(() => computeEma(candles, 20), [candles]);

  const latestCandle = candles[candles.length - 1];
  const firstCandle = candles[0];
  const bidPrice = latestCandle ? latestCandle.close : activePair.basePrice;
  const spreadPrice = activePair.spreadPips * activePair.pipSize;
  const askPrice = Number((bidPrice + spreadPrice).toFixed(activePair.decimals));

  const sessionHigh = useMemo(
    () => (candles.length ? Math.max(...candles.map((c) => c.high)) : bidPrice),
    [candles, bidPrice]
  );
  const sessionLow = useMemo(
    () => (candles.length ? Math.min(...candles.map((c) => c.low)) : bidPrice),
    [candles, bidPrice]
  );

  const changePct = firstCandle
    ? ((bidPrice - firstCandle.open) / firstCandle.open) * 100
    : 0;
  const isPositive = changePct >= 0;

  // Chart coordinate math
  const chartWidth = 860;
  const chartHeight = 360;
  const padTop = 18;
  const padBottom = 34;
  const padLeft = 10;
  const padRight = 72;
  const plotW = chartWidth - padLeft - padRight;
  const plotH = chartHeight - padTop - padBottom;

  const { yMin, yMax, priceTicks } = useMemo(() => {
    const rawMin = Math.min(...candles.map((c) => c.low), ...(showEma ? emaValues : []));
    const rawMax = Math.max(...candles.map((c) => c.high), ...(showEma ? emaValues : []));
    const range = Math.max(rawMax - rawMin, activePair.pipSize * 10);
    const margin = range * 0.12;
    const min = rawMin - margin;
    const max = rawMax + margin;
    const ticks = Array.from({ length: 5 }, (_, idx) => min + ((max - min) * idx) / 4);
    return { yMin: min, yMax: max, priceTicks: ticks };
  }, [candles, emaValues, showEma, activePair.pipSize]);

  const priceToY = (price: number) => {
    const ratio = (price - yMin) / Math.max(1e-9, yMax - yMin);
    return padTop + plotH - ratio * plotH;
  };

  const slotW = plotW / Math.max(1, candles.length);
  const candleBodyW = Math.max(4, Math.min(11, slotW * 0.58));

  const areaPath = useMemo(() => {
    if (candles.length === 0) return '';
    return candles
      .map((c, idx) => {
        const x = padLeft + idx * slotW + slotW / 2;
        const y = priceToY(c.close);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [candles, slotW, yMin, yMax]);

  const areaFillPath = useMemo(() => {
    if (candles.length === 0) return '';
    const firstX = padLeft + slotW / 2;
    const lastX = padLeft + (candles.length - 1) * slotW + slotW / 2;
    const bottomY = padTop + plotH;
    return `${areaPath} L ${lastX.toFixed(1)} ${bottomY} L ${firstX.toFixed(1)} ${bottomY} Z`;
  }, [areaPath, candles.length, slotW, plotH]);

  const emaPath = useMemo(() => {
    if (!showEma || emaValues.length === 0) return '';
    return emaValues
      .map((val, idx) => {
        const x = padLeft + idx * slotW + slotW / 2;
        const y = priceToY(val);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [emaValues, showEma, slotW, yMin, yMax]);

  const inspectedCandle =
    hoverIdx !== null && candles[hoverIdx] ? candles[hoverIdx] : latestCandle;

  // Interactive position sizing preview calculations
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
    if (activePair.symbol === 'USD/JPY') {
      return (parsedLots * activePair.contractSize * activePair.pipSize) / Math.max(1, bidPrice);
    }
    if (activePair.symbol === 'USD/CHF') {
      return (parsedLots * activePair.contractSize * activePair.pipSize) / Math.max(0.1, bidPrice);
    }
    return parsedLots * activePair.contractSize * activePair.pipSize;
  }, [activePair, parsedLots, bidPrice]);

  const estSlLossUsd = parsedSl * pipValueUsd;
  const estTpProfitUsd = parsedTp * pipValueUsd;
  const vaultCoversMargin = vaultBalanceUsd >= requiredMarginUsd;

  const handleSvgPointerMove = (clientX: number) => {
    if (!svgRef.current || candles.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * chartWidth;
    const idx = Math.floor((relX - padLeft) / slotW);
    if (idx >= 0 && idx < candles.length) {
      setHoverIdx(idx);
    } else {
      setHoverIdx(null);
    }
  };

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
      {/* Top Instrument Strip: Pair Selector */}
      <div className="bg-[#0B111E]/85 backdrop-blur-md border border-slate-700/70 rounded-2xl p-3 shadow-xl">
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          {FOREX_PAIRS.map((pair) => {
            const anchor = spotAnchors[pair.symbol] || pair.basePrice;
            const liveVal = Number((anchor + (liveOffsets[pair.symbol] || 0)).toFixed(pair.decimals));
            const pairDeltaPct = ((liveVal - pair.basePrice * 0.9985) / pair.basePrice) * 100;
            const up = pairDeltaPct >= 0;
            const isSelected = pair.symbol === activePair.symbol;

            return (
              <button
                key={pair.symbol}
                type="button"
                onClick={() => {
                  setSelectedSymbol(pair.symbol);
                  setHoverIdx(null);
                }}
                className={`min-w-[148px] px-3.5 py-2.5 rounded-xl border text-left transition-colors shrink-0 ${
                  isSelected
                    ? 'bg-slate-800/95 border-orange-500/70 text-white'
                    : 'bg-slate-900/55 border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display font-bold text-xs tracking-tight">{pair.symbol}</span>
                  <span
                    className={`font-mono text-[11px] font-semibold tabular-nums ${
                      up ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {up ? '+' : ''}
                    {pairDeltaPct.toFixed(2)}%
                  </span>
                </div>
                <div className="font-mono font-bold text-sm text-white tabular-nums mt-1">
                  {liveVal.toFixed(pair.decimals)}
                </div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">{pair.session}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Split Terminal: 8-col Chart + 4-col Upcoming Forex Execution Desk */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* LEFT: Interactive Forex Candlestick & Area Chart */}
        <div className="xl:col-span-8 bg-[#0B111E]/85 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
          {/* Chart Header & Controls */}
          <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="space-y-1">
              <div className="flex flex-wrap items-baseline gap-3">
                <h2 className="font-display font-bold text-xl text-white tracking-tight">
                  {activePair.symbol}
                </h2>
                <span className="font-mono font-extrabold text-xl text-white tabular-nums">
                  {bidPrice.toFixed(activePair.decimals)}
                </span>
                <span
                  className={`inline-flex items-center gap-1 font-mono text-xs font-semibold tabular-nums ${
                    isPositive ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {isPositive ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5" />
                  )}
                  {isPositive ? '+' : ''}
                  {changePct.toFixed(2)}% ({timeframe})
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span>{activePair.name}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  Bid {bidPrice.toFixed(activePair.decimals)} / Ask {askPrice.toFixed(activePair.decimals)}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">Spread {activePair.spreadPips} pips</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  H {sessionHigh.toFixed(activePair.decimals)} / L {sessionLow.toFixed(activePair.decimals)}
                </span>
              </div>
            </div>

            {/* Chart Segmented Controls */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div className="flex items-center gap-0.5 p-1 rounded-lg bg-slate-900 border border-slate-800">
                {(['15M', '1H', '4H', '1D', '1W'] as Timeframe[]).map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => {
                      setTimeframe(tf);
                      setHoverIdx(null);
                    }}
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
                EMA 20
              </button>
            </div>
          </div>

          {/* OHLC Crosshair Readout Strip */}
          {inspectedCandle && (
            <div className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[11px] font-mono text-slate-300 tabular-nums">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-slate-400">{inspectedCandle.timeLabel}</span>
                <span>
                  O <strong className="text-white">{inspectedCandle.open.toFixed(activePair.decimals)}</strong>
                </span>
                <span>
                  H <strong className="text-emerald-400">{inspectedCandle.high.toFixed(activePair.decimals)}</strong>
                </span>
                <span>
                  L <strong className="text-red-400">{inspectedCandle.low.toFixed(activePair.decimals)}</strong>
                </span>
                <span>
                  C{' '}
                  <strong
                    className={
                      inspectedCandle.close >= inspectedCandle.open ? 'text-emerald-400' : 'text-red-400'
                    }
                  >
                    {inspectedCandle.close.toFixed(activePair.decimals)}
                  </strong>
                </span>
              </div>
              <span className="text-slate-500">Hover chart to inspect historical candles</span>
            </div>
          )}

          {/* SVG Candlestick / Area Canvas */}
          <div className="relative w-full overflow-hidden rounded-xl bg-slate-950/75 border border-slate-800/80 p-2">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-[320px] sm:h-[360px] select-none cursor-crosshair block"
              onMouseMove={(e) => handleSvgPointerMove(e.clientX)}
              onMouseLeave={() => setHoverIdx(null)}
              onTouchMove={(e) => {
                if (e.touches[0]) handleSvgPointerMove(e.touches[0].clientX);
              }}
              onTouchEnd={() => setHoverIdx(null)}
            >
              <defs>
                <linearGradient id="fxAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#10B981" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {/* Horizontal Price Grid Lines & Right Axis Ticks */}
              {priceTicks.map((tick, idx) => {
                const y = priceToY(tick);
                return (
                  <g key={idx}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={chartWidth - padRight}
                      y2={y}
                      stroke="#1E293B"
                      strokeDasharray="3 4"
                      strokeWidth="1"
                    />
                    <text
                      x={chartWidth - padRight + 8}
                      y={y + 3.5}
                      fill="#94A3B8"
                      fontSize="10"
                      fontFamily="monospace"
                    >
                      {tick.toFixed(activePair.decimals)}
                    </text>
                  </g>
                );
              })}

              {/* Bottom Time Axis Labels */}
              {candles.map((c, idx) => {
                if (idx % 8 !== 0 && idx !== candles.length - 1) return null;
                const x = padLeft + idx * slotW + slotW / 2;
                return (
                  <text
                    key={`t-${idx}`}
                    x={x}
                    y={chartHeight - 10}
                    textAnchor="middle"
                    fill="#64748B"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {c.timeLabel}
                  </text>
                );
              })}

              {/* Subtle Bottom Volume Histogram */}
              {candles.map((c, idx) => {
                const x = padLeft + idx * slotW + (slotW - candleBodyW) / 2;
                const h = (c.volume / 100) * 40;
                const bull = c.close >= c.open;
                return (
                  <rect
                    key={`vol-${idx}`}
                    x={x}
                    y={padTop + plotH - h}
                    width={candleBodyW}
                    height={h}
                    fill={bull ? 'rgba(16, 185, 129, 0.14)' : 'rgba(239, 68, 68, 0.14)'}
                    rx="1"
                  />
                );
              })}

              {/* Chart Body: Candles OR Area */}
              {chartMode === 'area' ? (
                <g>
                  <path d={areaFillPath} fill="url(#fxAreaGrad)" />
                  <path d={areaPath} fill="none" stroke="#10B981" strokeWidth="2" />
                </g>
              ) : (
                <g>
                  {candles.map((c, idx) => {
                    const cx = padLeft + idx * slotW + slotW / 2;
                    const yHigh = priceToY(c.high);
                    const yLow = priceToY(c.low);
                    const yOpen = priceToY(c.open);
                    const yClose = priceToY(c.close);
                    const bull = c.close >= c.open;
                    const color = bull ? '#10B981' : '#EF4444';
                    const bodyTop = Math.min(yOpen, yClose);
                    const bodyH = Math.max(2, Math.abs(yClose - yOpen));

                    return (
                      <g key={`c-${idx}`}>
                        <line x1={cx} y1={yHigh} x2={cx} y2={yLow} stroke={color} strokeWidth="1.25" />
                        <rect
                          x={cx - candleBodyW / 2}
                          y={bodyTop}
                          width={candleBodyW}
                          height={bodyH}
                          fill={color}
                          rx="1"
                        />
                      </g>
                    );
                  })}
                </g>
              )}

              {/* EMA 20 Overlay */}
              {showEma && emaPath && (
                <path
                  d={emaPath}
                  fill="none"
                  stroke="#F97316"
                  strokeWidth="1.5"
                  strokeOpacity="0.88"
                />
              )}

              {/* Live Current Price Line & Tag */}
              <g>
                <line
                  x1={padLeft}
                  y1={priceToY(bidPrice)}
                  x2={chartWidth - padRight}
                  y2={priceToY(bidPrice)}
                  stroke={isPositive ? '#10B981' : '#EF4444'}
                  strokeWidth="1"
                  strokeDasharray="4 3"
                />
                <rect
                  x={chartWidth - padRight + 2}
                  y={priceToY(bidPrice) - 10}
                  width={padRight - 6}
                  height={20}
                  rx="4"
                  fill={isPositive ? '#059669' : '#DC2626'}
                />
                <text
                  x={chartWidth - padRight + 7}
                  y={priceToY(bidPrice) + 3.5}
                  fill="#FFFFFF"
                  fontSize="10"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {bidPrice.toFixed(activePair.decimals)}
                </text>
              </g>

              {/* Interactive Crosshair */}
              {hoverIdx !== null && candles[hoverIdx] && (
                <g>
                  <line
                    x1={padLeft + hoverIdx * slotW + slotW / 2}
                    y1={padTop}
                    x2={padLeft + hoverIdx * slotW + slotW / 2}
                    y2={padTop + plotH}
                    stroke="#94A3B8"
                    strokeDasharray="2 3"
                    strokeWidth="1"
                  />
                  <line
                    x1={padLeft}
                    y1={priceToY(candles[hoverIdx].close)}
                    x2={chartWidth - padRight}
                    y2={priceToY(candles[hoverIdx].close)}
                    stroke="#94A3B8"
                    strokeDasharray="2 3"
                    strokeWidth="1"
                  />
                  <circle
                    cx={padLeft + hoverIdx * slotW + slotW / 2}
                    cy={priceToY(candles[hoverIdx].close)}
                    r="4"
                    fill="#F97316"
                    stroke="#0B111E"
                    strokeWidth="1.5"
                  />
                </g>
              )}
            </svg>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 text-[11px] text-slate-400">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-slate-400" />
                Session: <strong className="text-slate-200">{activePair.session}</strong>
              </span>
              {showEma && (
                <span className="text-orange-400 font-mono">EMA(20) Trend Overlay Active</span>
              )}
            </div>
            <span className="font-mono text-slate-500">
              Live Forex Market Charts · Direct Order Execution Upcoming
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
                Analyze live FX markets right now. In the upcoming update, you will be able to open Buy &amp; Sell Forex trades directly from your USD Vault with full SL/TP risk control.
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
              Live market charts active · Direct order routing opens in the next release.
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
            Charting Active Now · Trading Execution Upcoming
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
          <div className="p-5 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white">01. Live Market Charts</span>
              <span className="font-mono text-[11px] text-emerald-400 font-semibold">Active</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Multi-timeframe candlestick &amp; area charts across Major FX pairs and XAU/USD Gold with EMA(20) analytics.
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
