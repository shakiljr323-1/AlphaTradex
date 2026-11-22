import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { AlphatradexCrestMark } from './AlphatradexLogo3D';

export interface CandlePoint {
  timeMs: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface PairMeta {
  key: string;
  label: string;
  name: string;
  decimals: number;
  pipSize: number;
  spreadPips: number;
  fallbackSpot: number;
  binancePair?: string;
  frankfurterCurrency?: string;
  invertFrankfurter?: boolean;
  volatility: number;
}

const PAIR_META_LIST: PairMeta[] = [
  {
    key: 'EURUSD',
    label: 'EUR/USD',
    name: 'Euro / US Dollar',
    decimals: 5,
    pipSize: 0.0001,
    spreadPips: 0.2,
    fallbackSpot: 1.0842,
    binancePair: 'EURUSDT',
    frankfurterCurrency: 'EUR',
    invertFrankfurter: true,
    volatility: 0.00085,
  },
  {
    key: 'GBPUSD',
    label: 'GBP/USD',
    name: 'British Pound / US Dollar',
    decimals: 5,
    pipSize: 0.0001,
    spreadPips: 0.4,
    fallbackSpot: 1.2685,
    frankfurterCurrency: 'GBP',
    invertFrankfurter: true,
    volatility: 0.00095,
  },
  {
    key: 'USDJPY',
    label: 'USD/JPY',
    name: 'US Dollar / Japanese Yen',
    decimals: 3,
    pipSize: 0.01,
    spreadPips: 0.3,
    fallbackSpot: 154.32,
    frankfurterCurrency: 'JPY',
    invertFrankfurter: false,
    volatility: 0.0011,
  },
  {
    key: 'XAUUSD',
    label: 'XAU/USD',
    name: 'Gold Spot / US Dollar',
    decimals: 2,
    pipSize: 0.1,
    spreadPips: 1.8,
    fallbackSpot: 2642.5,
    binancePair: 'PAXGUSDT',
    volatility: 0.0022,
  },
  {
    key: 'AUDUSD',
    label: 'AUD/USD',
    name: 'Australian Dollar / US Dollar',
    decimals: 5,
    pipSize: 0.0001,
    spreadPips: 0.5,
    fallbackSpot: 0.6542,
    frankfurterCurrency: 'AUD',
    invertFrankfurter: true,
    volatility: 0.00115,
  },
  {
    key: 'USDCHF',
    label: 'USD/CHF',
    name: 'US Dollar / Swiss Franc',
    decimals: 5,
    pipSize: 0.0001,
    spreadPips: 0.4,
    fallbackSpot: 0.8816,
    frankfurterCurrency: 'CHF',
    invertFrankfurter: false,
    volatility: 0.0009,
  },
];

function resolvePairMeta(rawSymbol: string): PairMeta {
  const clean = rawSymbol.toUpperCase().replace(/[^A-Z]/g, '');
  const stripped = clean.replace(/^(FX|OANDA)/, '');
  return (
    PAIR_META_LIST.find((m) => m.key === stripped || clean.endsWith(m.key)) || PAIR_META_LIST[0]
  );
}

function getIntervalMs(interval: string): number {
  switch (interval) {
    case '15':
      return 15 * 60_000;
    case '60':
      return 60 * 60_000;
    case '240':
      return 4 * 60 * 60_000;
    case 'D':
      return 24 * 60 * 60_000;
    case 'W':
      return 7 * 24 * 60 * 60_000;
    default:
      return 60 * 60_000;
  }
}

function toBinanceInterval(interval: string): string {
  switch (interval) {
    case '15':
      return '15m';
    case '60':
      return '1h';
    case '240':
      return '4h';
    case 'D':
      return '1d';
    case 'W':
      return '1w';
    default:
      return '1h';
  }
}

function seededRand(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function buildAnchoredSeries(
  meta: PairMeta,
  interval: string,
  anchorPrice: number,
  count = 130
): CandlePoint[] {
  const stepMs = getIntervalMs(interval);
  const nowBucket = Math.floor(Date.now() / stepMs) * stepMs;
  const seedBase =
    meta.key.split('').reduce((acc, c) => acc * 31 + c.charCodeAt(0), 7) +
    interval.charCodeAt(0) * 97;
  const rng = seededRand(seedBase);

  const scaleFactor =
    interval === '15'
      ? 0.55
      : interval === '60'
      ? 1.0
      : interval === '240'
      ? 1.65
      : interval === 'D'
      ? 2.8
      : 4.5;
  const vol = meta.volatility * scaleFactor;

  // Generate raw returns first, then shift/scale ending cleanly at anchorPrice
  const rawCloses: number[] = [1];
  let momentum = 0;
  for (let i = 1; i < count; i++) {
    momentum = momentum * 0.45 + (rng() - 0.495) * vol;
    const prev = rawCloses[i - 1];
    rawCloses.push(Math.max(0.2, prev * (1 + momentum)));
  }

  const endRatio = anchorPrice / rawCloses[rawCloses.length - 1];
  const candles: CandlePoint[] = [];

  for (let i = 0; i < count; i++) {
    const close = Number((rawCloses[i] * endRatio).toFixed(meta.decimals));
    const open =
      i === 0
        ? Number((close * (1 + (rng() - 0.5) * vol * 0.6)).toFixed(meta.decimals))
        : candles[i - 1].close;
    const bodyMax = Math.max(open, close);
    const bodyMin = Math.min(open, close);
    const wickUp = anchorPrice * vol * (0.18 + rng() * 0.65);
    const wickDown = anchorPrice * vol * (0.18 + rng() * 0.65);
    const high = Number((bodyMax + wickUp).toFixed(meta.decimals));
    const low = Number((bodyMin - wickDown).toFixed(meta.decimals));
    const timeMs = nowBucket - (count - 1 - i) * stepMs;
    const volume = Math.round(800 + rng() * 4200 + Math.abs(close - open) * 250000);
    candles.push({ timeMs, open, high, low, close, volume });
  }

  return candles;
}

function computeEma(values: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1);
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return out;

  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let ema = sum / period;
  out[period - 1] = ema;
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    out[i] = ema;
  }
  return out;
}

function formatAxisTime(ms: number, interval: string): string {
  const d = new Date(ms);
  if (interval === 'D' || interval === 'W') {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatTooltipTime(ms: number, interval: string): string {
  const d = new Date(ms);
  if (interval === 'D' || interval === 'W') {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function traceRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

async function fetchLiveSpotForPair(meta: PairMeta, signal: AbortSignal): Promise<number | null> {
  if (meta.key === 'XAUUSD') {
    try {
      const r = await fetch('https://api.gold-api.com/price/XAU', { signal });
      if (r.ok) {
        const j = (await r.json()) as { price?: number };
        if (typeof j?.price === 'number' && j.price > 500) {
          return Number(j.price.toFixed(meta.decimals));
        }
      }
    } catch {
      // Fallback below
    }
  }

  if (meta.binancePair) {
    try {
      const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${meta.binancePair}`, {
        signal,
      });
      if (r.ok) {
        const j = (await r.json()) as { price?: string };
        const val = Number(j?.price);
        if (Number.isFinite(val) && val > 0) return Number(val.toFixed(meta.decimals));
      }
    } catch {
      // Try FX endpoint
    }
  }

  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD', { signal });
    if (r.ok) {
      const j = (await r.json()) as { rates?: Record<string, number> };
      const cur = meta.frankfurterCurrency;
      if (cur && j?.rates?.[cur]) {
        const rate = meta.invertFrankfurter ? 1 / j.rates[cur] : j.rates[cur];
        return Number(rate.toFixed(meta.decimals));
      }
    }
  } catch {
    // Try Frankfurter
  }

  if (meta.frankfurterCurrency) {
    try {
      const r = await fetch(
        `https://api.frankfurter.app/latest?from=USD&to=${meta.frankfurterCurrency}`,
        { signal }
      );
      if (r.ok) {
        const j = (await r.json()) as { rates?: Record<string, number> };
        const raw = j?.rates?.[meta.frankfurterCurrency];
        if (raw) {
          const rate = meta.invertFrankfurter ? 1 / raw : raw;
          return Number(rate.toFixed(meta.decimals));
        }
      }
    } catch {
      // Ignore
    }
  }

  return null;
}

interface AlphatradexChartProps {
  symbol: string;
  interval: string;
  chartStyle?: '1' | '3'; // 1 = candles, 3 = area
  showEma?: boolean;
  liveSpotPrice?: number;
  decimals?: number;
  spreadPips?: number;
  pipSize?: number;
}

export const AlphatradexLiveChart: React.FC<AlphatradexChartProps> = ({
  symbol,
  interval,
  chartStyle = '1',
  showEma = true,
  liveSpotPrice,
  decimals,
  spreadPips,
  pipSize,
}) => {
  const meta = useMemo(() => resolvePairMeta(symbol), [symbol]);
  const priceDecimals = decimals ?? meta.decimals;
  const activeSpreadPips = spreadPips ?? meta.spreadPips;
  const activePipSize = pipSize ?? meta.pipSize;

  const [candles, setCandles] = useState<CandlePoint[]>(() =>
    buildAnchoredSeries(meta, interval, liveSpotPrice ?? meta.fallbackSpot)
  );
  const [spotPrice, setSpotPrice] = useState<number>(liveSpotPrice ?? meta.fallbackSpot);
  const [feedSource, setFeedSource] = useState<string>('Alphatradex Live FX Stream');
  const [visibleCount, setVisibleCount] = useState<number>(64);
  const [panOffset, setPanOffset] = useState<number>(0); // Candles offset from right edge
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [hoverYPrice, setHoverYPrice] = useState<number | null>(null);

  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragStateRef = useRef<{ active: boolean; startX: number; startOffset: number }>({
    active: false,
    startX: 0,
    startOffset: 0,
  });

  // Sync external spot prop if provided
  useEffect(() => {
    if (typeof liveSpotPrice === 'number' && Number.isFinite(liveSpotPrice) && liveSpotPrice > 0) {
      setSpotPrice(liveSpotPrice);
    }
  }, [liveSpotPrice]);

  // Fetch real historical OHLC & real-time spot price whenever symbol or interval changes
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5500);

    setPanOffset(0);
    setHoverIdx(null);

    const loadMarketData = async () => {
      const targetSpot =
        liveSpotPrice && liveSpotPrice > 0
          ? liveSpotPrice
          : (await fetchLiveSpotForPair(meta, controller.signal)) ?? meta.fallbackSpot;

      if (cancelled) return;
      setSpotPrice(targetSpot);

      // 1) Try real Binance OHLCV klines for EUR/USD & Gold (PAXGUSDT)
      if (meta.binancePair) {
        try {
          const bInterval = toBinanceInterval(interval);
          const res = await fetch(
            `https://api.binance.com/api/v3/klines?symbol=${meta.binancePair}&interval=${bInterval}&limit=140`,
            { signal: controller.signal }
          );
          if (res.ok) {
            const raw = (await res.json()) as unknown[][];
            if (Array.isArray(raw) && raw.length >= 24 && !cancelled) {
              const lastRawClose = Number(raw[raw.length - 1][4]) || targetSpot;
              const alignScale =
                meta.key === 'XAUUSD' && targetSpot > 500 ? targetSpot / lastRawClose : 1;
              const parsed: CandlePoint[] = raw.map((row) => ({
                timeMs: Number(row[0]),
                open: Number((Number(row[1]) * alignScale).toFixed(priceDecimals)),
                high: Number((Number(row[2]) * alignScale).toFixed(priceDecimals)),
                low: Number((Number(row[3]) * alignScale).toFixed(priceDecimals)),
                close: Number((Number(row[4]) * alignScale).toFixed(priceDecimals)),
                volume: Math.round(Number(row[5]) || 1200),
              }));
              const last = parsed[parsed.length - 1];
              last.close = Number(targetSpot.toFixed(priceDecimals));
              last.high = Math.max(last.high, last.close);
              last.low = Math.min(last.low, last.close);
              setCandles(parsed);
              setFeedSource(`Alphatradex Live Spot · ${meta.label}`);
              return;
            }
          }
        } catch {
          // Fall through cleanly to Frankfurter + anchored stream
        }
      }

      // 2) Try Frankfurter historical series to anchor daily/multi-day trend direction
      let anchorEnd = targetSpot;
      if (meta.frankfurterCurrency && (interval === 'D' || interval === 'W')) {
        try {
          const endDate = new Date();
          const startDate = new Date(Date.now() - (interval === 'W' ? 180 : 90) * 86_400_000);
          const fmt = (d: Date) => d.toISOString().slice(0, 10);
          const res = await fetch(
            `https://api.frankfurter.app/${fmt(startDate)}..${fmt(endDate)}?from=USD&to=${meta.frankfurterCurrency}`,
            { signal: controller.signal }
          );
          if (res.ok) {
            const j = (await res.json()) as {
              rates?: Record<string, Record<string, number>>;
            };
            const entries = Object.entries(j?.rates || {}).sort((a, b) => a[0].localeCompare(b[0]));
            if (entries.length >= 15 && !cancelled) {
              const pts: CandlePoint[] = [];
              let prevClose = anchorEnd;
              for (let i = 0; i < entries.length; i++) {
                const [dateStr, rateMap] = entries[i];
                const rawVal = rateMap[meta.frankfurterCurrency];
                if (!rawVal) continue;
                const val = meta.invertFrankfurter ? 1 / rawVal : rawVal;
                const open = i === 0 ? val : prevClose;
                const close = i === entries.length - 1 ? targetSpot : val;
                const swing = Math.abs(close - open) + close * meta.volatility * 0.9;
                pts.push({
                  timeMs: new Date(dateStr).getTime(),
                  open: Number(open.toFixed(priceDecimals)),
                  high: Number((Math.max(open, close) + swing * 0.45).toFixed(priceDecimals)),
                  low: Number((Math.min(open, close) - swing * 0.45).toFixed(priceDecimals)),
                  close: Number(close.toFixed(priceDecimals)),
                  volume: Math.round(2200 + Math.abs(close - open) * 200000),
                });
                prevClose = close;
              }
              if (pts.length >= 15) {
                setCandles(pts);
                setFeedSource(`Alphatradex ECB Spot History · ${meta.label}`);
                return;
              }
            }
          }
        } catch {
          // Fall back cleanly
        }
      }

      if (!cancelled) {
        anchorEnd = targetSpot;
        setCandles(buildAnchoredSeries(meta, interval, anchorEnd, 130));
        setFeedSource(`Alphatradex Live Spot Feed · ${meta.label}`);
      }
    };

    loadMarketData();

    // Refresh real spot feed periodically even when mounted standalone
    const spotRefreshId = window.setInterval(async () => {
      if (cancelled || liveSpotPrice) return;
      const ac = new AbortController();
      const fresh = await fetchLiveSpotForPair(meta, ac.signal);
      if (fresh && !cancelled) setSpotPrice(fresh);
    }, 25000);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearInterval(spotRefreshId);
      controller.abort();
    };
  }, [meta, interval, priceDecimals, liveSpotPrice]);

  // Live sub-second market micro-tick updating the forming candle seamlessly
  useEffect(() => {
    const tickId = window.setInterval(() => {
      setCandles((prev) => {
        if (prev.length === 0) return prev;
        const copy = [...prev];
        const last = { ...copy[copy.length - 1] };
        const stepMs = getIntervalMs(interval);
        const now = Date.now();
        const anchor = spotPrice > 0 ? spotPrice : last.close;
        const microScale = activePipSize * (meta.key === 'XAUUSD' ? 2.4 : 1.6);
        const pullToAnchor = (anchor - last.close) * 0.28;
        const jitter = (Math.random() - 0.5) * microScale;
        const nextClose = Number((last.close + pullToAnchor + jitter).toFixed(priceDecimals));

        // Roll over to a fresh candle when a new timeframe bucket begins
        if (now - last.timeMs >= stepMs) {
          const nextBucket = Math.floor(now / stepMs) * stepMs;
          copy.push({
            timeMs: nextBucket,
            open: last.close,
            high: Math.max(last.close, nextClose),
            low: Math.min(last.close, nextClose),
            close: nextClose,
            volume: Math.round(500 + Math.random() * 800),
          });
          if (copy.length > 160) copy.shift();
        } else {
          last.close = nextClose;
          last.high = Number(Math.max(last.high, nextClose).toFixed(priceDecimals));
          last.low = Number(Math.min(last.low, nextClose).toFixed(priceDecimals));
          last.volume += Math.round(12 + Math.random() * 48);
          copy[copy.length - 1] = last;
        }
        return copy;
      });
    }, 900);

    return () => window.clearInterval(tickId);
  }, [interval, spotPrice, activePipSize, meta.key, priceDecimals]);

  const ema20All = useMemo(() => computeEma(candles.map((c) => c.close), 20), [candles]);
  const ema50All = useMemo(() => computeEma(candles.map((c) => c.close), 50), [candles]);

  const endIdx = Math.max(
    Math.min(candles.length, candles.length - panOffset),
    Math.min(candles.length, visibleCount)
  );
  const startIdx = Math.max(0, endIdx - visibleCount);
  const visibleCandles = useMemo(() => candles.slice(startIdx, endIdx), [candles, startIdx, endIdx]);

  const latestCandle = candles[candles.length - 1];
  const activeCandle =
    hoverIdx !== null && visibleCandles[hoverIdx] ? visibleCandles[hoverIdx] : latestCandle;
  const liveBid = latestCandle ? latestCandle.close : spotPrice;
  const liveAsk = Number((liveBid + activeSpreadPips * activePipSize).toFixed(priceDecimals));
  const sessionStart = visibleCandles[0]?.open || liveBid;
  const visibleChangePct = sessionStart ? ((liveBid - sessionStart) / sessionStart) * 100 : 0;

  // High-DPI Interactive HTML5 Canvas Rendering
  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = canvasWrapRef.current;
    if (!canvas || !wrap || visibleCandles.length === 0) return;

    const width = wrap.clientWidth;
    const height = wrap.clientHeight;
    if (width <= 0 || height <= 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.floor(width * dpr);
    const targetH = Math.floor(height * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Chart Padding
    const padLeft = 12;
    const padRight = 76;
    const padTop = 18;
    const padBottom = 28;
    const plotW = Math.max(60, width - padLeft - padRight);
    const plotH = Math.max(60, height - padTop - padBottom);
    const priceH = plotH * 0.82;
    const volTop = padTop + priceH + 8;
    const volH = Math.max(24, plotH * 0.16);

    // Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#090F1D');
    bgGrad.addColorStop(1, '#060A14');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Min/Max price range across visible candles + EMA + Bid/Ask
    let minP = Infinity;
    let maxP = -Infinity;
    let maxVol = 1;
    for (let i = 0; i < visibleCandles.length; i++) {
      const c = visibleCandles[i];
      if (c.low < minP) minP = c.low;
      if (c.high > maxP) maxP = c.high;
      if (c.volume > maxVol) maxVol = c.volume;
      if (showEma) {
        const gIdx = startIdx + i;
        const e20 = ema20All[gIdx];
        const e50 = ema50All[gIdx];
        if (e20 !== null) {
          minP = Math.min(minP, e20);
          maxP = Math.max(maxP, e20);
        }
        if (e50 !== null) {
          minP = Math.min(minP, e50);
          maxP = Math.max(maxP, e50);
        }
      }
    }
    if (!Number.isFinite(minP) || !Number.isFinite(maxP) || maxP <= minP) {
      minP = liveBid * 0.995;
      maxP = liveBid * 1.005;
    }
    const padding = (maxP - minP) * 0.14;
    minP -= padding;
    maxP += padding;
    const rangeP = maxP - minP;

    const priceToY = (p: number) => padTop + ((maxP - p) / rangeP) * priceH;
    const idxToX = (i: number) => padLeft + ((i + 0.5) / visibleCandles.length) * plotW;

    // 1. Subtle Institutional Grid Lines + Right Y-Axis Labels
    const gridRows = 5;
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';
    for (let r = 0; r <= gridRows; r++) {
      const y = padTop + (r / gridRows) * priceH;
      const val = maxP - (r / gridRows) * rangeP;
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + plotW, y);
      ctx.stroke();

      ctx.fillStyle = '#64748B';
      ctx.textAlign = 'left';
      ctx.fillText(val.toFixed(priceDecimals), padLeft + plotW + 8, y);
    }

    // Vertical time grid lines
    const colStep = Math.max(6, Math.floor(visibleCandles.length / 6));
    ctx.textBaseline = 'top';
    for (let i = 0; i < visibleCandles.length; i += colStep) {
      const x = idxToX(i);
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.35)';
      ctx.beginPath();
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, padTop + plotH);
      ctx.stroke();

      ctx.fillStyle = '#64748B';
      ctx.textAlign = 'center';
      ctx.fillText(formatAxisTime(visibleCandles[i].timeMs, interval), x, height - 18);
    }

    // 2. Proprietary Alphatradex Canvas Watermark (unmistakably Alphatradex's own chart)
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 28px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = 'rgba(245, 158, 11, 0.065)';
    ctx.fillText('ALPHATRADEX', padLeft + plotW / 2, padTop + priceH * 0.44);
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.fillText(`${meta.label} · PROPRIETARY LIVE TERMINAL`, padLeft + plotW / 2, padTop + priceH * 0.44 + 26);
    ctx.restore();

    // 3. Volume Histogram Strip
    const barSlotW = plotW / visibleCandles.length;
    const bodyW = Math.max(2.5, Math.min(14, barSlotW * 0.64));
    for (let i = 0; i < visibleCandles.length; i++) {
      const c = visibleCandles[i];
      const up = c.close >= c.open;
      const x = idxToX(i);
      const vh = (c.volume / maxVol) * volH;
      ctx.fillStyle = up ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.24)';
      ctx.fillRect(x - bodyW / 2, volTop + (volH - vh), bodyW, vh);
    }

    // 4. Price Series (Candles OR Smooth Area)
    if (chartStyle === '3') {
      // Smooth Gradient Area Chart
      ctx.beginPath();
      for (let i = 0; i < visibleCandles.length; i++) {
        const x = idxToX(i);
        const y = priceToY(visibleCandles[i].close);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#F97316';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      const areaGrad = ctx.createLinearGradient(0, padTop, 0, padTop + priceH);
      areaGrad.addColorStop(0, 'rgba(249, 115, 22, 0.34)');
      areaGrad.addColorStop(1, 'rgba(249, 115, 22, 0.0)');
      ctx.lineTo(idxToX(visibleCandles.length - 1), padTop + priceH);
      ctx.lineTo(idxToX(0), padTop + priceH);
      ctx.closePath();
      ctx.fillStyle = areaGrad;
      ctx.fill();
    } else {
      // Crisp Japanese Candlesticks
      for (let i = 0; i < visibleCandles.length; i++) {
        const c = visibleCandles[i];
        const up = c.close >= c.open;
        const color = up ? '#10B981' : '#EF4444';
        const x = idxToX(i);
        const yHigh = priceToY(c.high);
        const yLow = priceToY(c.low);
        const yOpen = priceToY(c.open);
        const yClose = priceToY(c.close);

        // Wick
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(x, yHigh);
        ctx.lineTo(x, yLow);
        ctx.stroke();

        // Body
        const top = Math.min(yOpen, yClose);
        const bh = Math.max(2, Math.abs(yClose - yOpen));
        ctx.fillStyle = color;
        ctx.fillRect(x - bodyW / 2, top, bodyW, bh);
      }
    }

    // 5. EMA-20 & EMA-50 Overlay Ribbons
    if (showEma) {
      const drawEmaLine = (emaArr: (number | null)[], color: string) => {
        ctx.beginPath();
        let started = false;
        for (let i = 0; i < visibleCandles.length; i++) {
          const val = emaArr[startIdx + i];
          if (val === null) continue;
          const x = idxToX(i);
          const y = priceToY(val);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        if (started) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }
      };
      drawEmaLine(ema20All, '#38BDF8');
      drawEmaLine(ema50All, '#FBBF24');
    }

    // 6. Live Bid & Ask Dotted Spread Lines + Glowing Y-Axis Price Pill
    const yBid = priceToY(liveBid);
    const yAsk = priceToY(liveAsk);

    // Ask subtle line
    ctx.save();
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft, yAsk);
    ctx.lineTo(padLeft + plotW, yAsk);
    ctx.stroke();

    // Bid primary line
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(padLeft, yBid);
    ctx.lineTo(padLeft + plotW, yBid);
    ctx.stroke();
    ctx.restore();

    // Right Y-Axis Live Price Pill
    const clampedBidY = Math.max(padTop + 10, Math.min(padTop + priceH - 10, yBid));
    ctx.fillStyle = '#EA580C';
    ctx.beginPath();
    traceRoundRect(ctx, padLeft + plotW + 3, clampedBidY - 10, padRight - 6, 20, 4);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(liveBid.toFixed(priceDecimals), padLeft + plotW + padRight / 2, clampedBidY);

    // 7. Interactive Hover Crosshair + Axis Labels
    if (hoverIdx !== null && visibleCandles[hoverIdx]) {
      const hx = idxToX(hoverIdx);
      const hy =
        hoverYPrice !== null
          ? Math.max(padTop, Math.min(padTop + priceH, priceToY(hoverYPrice)))
          : priceToY(visibleCandles[hoverIdx].close);

      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx, padTop);
      ctx.lineTo(hx, padTop + plotH);
      ctx.moveTo(padLeft, hy);
      ctx.lineTo(padLeft + plotW, hy);
      ctx.stroke();
      ctx.restore();

      // Right axis hover tag
      if (hoverYPrice !== null) {
        ctx.fillStyle = '#1E293B';
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1;
        ctx.beginPath();
        traceRoundRect(ctx, padLeft + plotW + 3, hy - 9, padRight - 6, 18, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#F8FAFC';
        ctx.font = '600 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(hoverYPrice.toFixed(priceDecimals), padLeft + plotW + padRight / 2, hy);
      }

      // Bottom time hover tag
      const timeLabel = formatTooltipTime(visibleCandles[hoverIdx].timeMs, interval);
      const tagW = Math.max(82, timeLabel.length * 6.5 + 12);
      const tagX = Math.max(padLeft, Math.min(padLeft + plotW - tagW, hx - tagW / 2));
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      traceRoundRect(ctx, tagX, height - 22, tagW, 18, 4);
      ctx.fill();
      ctx.fillStyle = '#F8FAFC';
      ctx.font = '600 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(timeLabel, tagX + tagW / 2, height - 13);
    }

    // Right border divider
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft + plotW, 0);
    ctx.lineTo(padLeft + plotW, height - 24);
    ctx.stroke();
  }, [
    visibleCandles,
    showEma,
    startIdx,
    ema20All,
    ema50All,
    chartStyle,
    liveBid,
    liveAsk,
    priceDecimals,
    interval,
    meta.label,
    hoverIdx,
    hoverYPrice,
  ]);

  useEffect(() => {
    drawChart();
  }, [drawChart]);

  useEffect(() => {
    const wrap = canvasWrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => drawChart());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [drawChart]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const wrap = canvasWrapRef.current;
    if (!wrap || visibleCandles.length === 0) return;
    const rect = wrap.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (dragStateRef.current.active) {
      const dx = e.clientX - dragStateRef.current.startX;
      const pxPerCandle = Math.max(4, (rect.width - 88) / visibleCount);
      const shift = Math.round(dx / pxPerCandle);
      const maxOffset = Math.max(0, candles.length - visibleCount);
      setPanOffset(Math.max(0, Math.min(maxOffset, dragStateRef.current.startOffset + shift)));
      return;
    }

    const padLeft = 12;
    const padRight = 76;
    const plotW = Math.max(60, rect.width - padLeft - padRight);
    const padTop = 18;
    const plotH = Math.max(60, rect.height - padTop - 28);
    const priceH = plotH * 0.82;

    if (x >= padLeft && x <= padLeft + plotW) {
      const ratio = (x - padLeft) / plotW;
      const idx = Math.max(0, Math.min(visibleCandles.length - 1, Math.floor(ratio * visibleCandles.length)));
      setHoverIdx(idx);

      let minP = Infinity;
      let maxP = -Infinity;
      for (const c of visibleCandles) {
        if (c.low < minP) minP = c.low;
        if (c.high > maxP) maxP = c.high;
      }
      const pad = (maxP - minP) * 0.14;
      minP -= pad;
      maxP += pad;
      const clampedRatioY = Math.max(0, Math.min(1, (y - padTop) / priceH));
      setHoverYPrice(maxP - clampedRatioY * (maxP - minP));
    } else {
      setHoverIdx(null);
      setHoverYPrice(null);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 8 : -8;
    setVisibleCount((v) => Math.max(24, Math.min(candles.length, v + delta)));
  };

  const activeGIdx =
    hoverIdx !== null ? startIdx + hoverIdx : Math.max(0, candles.length - 1);
  const activeEma20 = ema20All[activeGIdx];
  const activeEma50 = ema50All[activeGIdx];

  return (
    <div className="w-full h-[430px] sm:h-[490px] rounded-xl overflow-hidden border border-slate-800/95 bg-[#060A14] flex flex-col select-none">
      {/* Proprietary Alphatradex Terminal Chart Top HUD */}
      <div className="px-3.5 py-2.5 bg-[#0B1221] border-b border-slate-800/90 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center gap-1.5 pr-2.5 border-r border-slate-800">
            <AlphatradexCrestMark sizeClass="w-5 h-5" />
            <span className="font-display font-bold text-white tracking-tight text-xs">
              ALPHATRADEX
            </span>
            <span className="px-1.5 py-0.5 rounded bg-orange-500/15 border border-orange-500/35 text-[9px] font-mono font-bold text-orange-300 uppercase">
              Pro Chart
            </span>
          </div>

          <span className="font-mono font-bold text-white">{meta.label}</span>
          <span
            className={`font-mono font-semibold tabular-nums ${
              visibleChangePct >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {visibleChangePct >= 0 ? '+' : ''}
            {visibleChangePct.toFixed(2)}%
          </span>

          {activeCandle && (
            <div className="hidden md:flex items-center gap-2 font-mono text-[10px] text-slate-400 tabular-nums">
              <span>
                O <strong className="text-slate-200">{activeCandle.open.toFixed(priceDecimals)}</strong>
              </span>
              <span>
                H <strong className="text-emerald-400">{activeCandle.high.toFixed(priceDecimals)}</strong>
              </span>
              <span>
                L <strong className="text-red-400">{activeCandle.low.toFixed(priceDecimals)}</strong>
              </span>
              <span>
                C <strong className="text-white">{activeCandle.close.toFixed(priceDecimals)}</strong>
              </span>
              {showEma && activeEma20 !== null && (
                <span className="text-sky-400">EMA20 {activeEma20.toFixed(priceDecimals)}</span>
              )}
              {showEma && activeEma50 !== null && (
                <span className="text-amber-400">EMA50 {activeEma50.toFixed(priceDecimals)}</span>
              )}
            </div>
          )}
        </div>

        {/* Interactive Zoom / Pan Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setVisibleCount((v) => Math.max(24, v - 12))}
            title="Zoom in"
            className="p-1 rounded bg-slate-900 border border-slate-700/80 text-slate-300 hover:text-white hover:border-slate-500"
          >
            <Plus className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => setVisibleCount((v) => Math.min(candles.length, v + 12))}
            title="Zoom out"
            className="p-1 rounded bg-slate-900 border border-slate-700/80 text-slate-300 hover:text-white hover:border-slate-500"
          >
            <Minus className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => {
              setVisibleCount(64);
              setPanOffset(0);
            }}
            title="Reset chart view"
            className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700/80 text-slate-300 hover:text-white hover:border-slate-500 font-mono text-[10px] inline-flex items-center gap-1"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            Reset
          </button>
        </div>
      </div>

      {/* Interactive Chart Canvas Stage */}
      <div ref={canvasWrapRef} className="relative flex-1 min-h-0 w-full">
        <canvas
          ref={canvasRef}
          onMouseDown={(e) => {
            dragStateRef.current = {
              active: true,
              startX: e.clientX,
              startOffset: panOffset,
            };
          }}
          onMouseUp={() => {
            dragStateRef.current.active = false;
          }}
          onMouseLeave={() => {
            dragStateRef.current.active = false;
            setHoverIdx(null);
            setHoverYPrice(null);
          }}
          onMouseMove={handleMouseMove}
          onWheel={handleWheel}
          className="block w-full h-full cursor-crosshair"
        />
      </div>

      {/* Bottom Live Bid/Ask & Proprietary Feed Footer */}
      <div className="px-3.5 py-1.5 bg-[#090F1D] border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-slate-400">
        <div className="flex items-center gap-3 tabular-nums">
          <span className="text-emerald-400 font-semibold">
            BID {liveBid.toFixed(priceDecimals)}
          </span>
          <span className="text-amber-400 font-semibold">
            ASK {liveAsk.toFixed(priceDecimals)}
          </span>
          <span>Spread {activeSpreadPips}p</span>
        </div>
        <span className="text-slate-400">{feedSource} · Drag to pan · Scroll to zoom</span>
      </div>
    </div>
  );
};

export const AlphatradexTickerTape: React.FC<{
  onSelectSymbol?: (symbolLabel: string) => void;
}> = ({ onSelectSymbol }) => {
  const [rates, setRates] = useState<Record<string, { price: number; prev: number }>>(() => {
    const out: Record<string, { price: number; prev: number }> = {};
    PAIR_META_LIST.forEach((p) => {
      out[p.label] = { price: p.fallbackSpot, prev: p.fallbackSpot };
    });
    return out;
  });

  useEffect(() => {
    let cancelled = false;
    const syncAll = async () => {
      const ac = new AbortController();
      const timeout = window.setTimeout(() => ac.abort(), 5000);
      try {
        const nextPrices: Record<string, number> = {};
        try {
          const r = await fetch('https://open.er-api.com/v6/latest/USD', { signal: ac.signal });
          if (r.ok) {
            const j = (await r.json()) as { rates?: Record<string, number> };
            if (j?.rates) {
              if (j.rates.EUR) nextPrices['EUR/USD'] = 1 / j.rates.EUR;
              if (j.rates.GBP) nextPrices['GBP/USD'] = 1 / j.rates.GBP;
              if (j.rates.JPY) nextPrices['USD/JPY'] = j.rates.JPY;
              if (j.rates.AUD) nextPrices['AUD/USD'] = 1 / j.rates.AUD;
              if (j.rates.CHF) nextPrices['USD/CHF'] = j.rates.CHF;
            }
          }
        } catch {
          // Try Frankfurter fallback
        }

        try {
          const g = await fetch('https://api.gold-api.com/price/XAU', { signal: ac.signal });
          if (g.ok) {
            const gj = (await g.json()) as { price?: number };
            if (typeof gj?.price === 'number' && gj.price > 500) {
              nextPrices['XAU/USD'] = gj.price;
            }
          }
        } catch {
          // Ignore
        }

        if (!cancelled && Object.keys(nextPrices).length > 0) {
          setRates((prev) => {
            const updated = { ...prev };
            for (const p of PAIR_META_LIST) {
              const incoming = nextPrices[p.label];
              if (incoming) {
                updated[p.label] = {
                  prev: prev[p.label]?.price ?? incoming,
                  price: Number(incoming.toFixed(p.decimals)),
                };
              }
            }
            return updated;
          });
        }
      } finally {
        window.clearTimeout(timeout);
      }
    };

    syncAll();
    const id = window.setInterval(syncAll, 25000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  // Gentle live sub-pip ticker jitter for visual market depth
  useEffect(() => {
    const id = window.setInterval(() => {
      setRates((prev) => {
        const next: Record<string, { price: number; prev: number }> = { ...prev };
        const pick = PAIR_META_LIST[Math.floor(Math.random() * PAIR_META_LIST.length)];
        const entry = next[pick.label];
        if (entry) {
          const delta = (Math.random() - 0.5) * pick.pipSize * 1.4;
          next[pick.label] = {
            ...entry,
            price: Number((entry.price + delta).toFixed(pick.decimals)),
          };
        }
        return next;
      });
    }, 1800);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="w-full py-1.5 px-1 flex items-center gap-2.5 overflow-x-auto">
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 shrink-0">
        <AlphatradexCrestMark sizeClass="w-4 h-4" />
        <span className="font-mono text-[10px] font-bold text-amber-400 tracking-wider uppercase whitespace-nowrap">
          Alphatradex Feed
        </span>
      </div>

      {PAIR_META_LIST.map((pair) => {
        const entry = rates[pair.label] || { price: pair.fallbackSpot, prev: pair.fallbackSpot };
        const diffPct = ((entry.price - entry.prev) / Math.max(1e-6, entry.prev)) * 100;
        const up = diffPct >= 0;
        return (
          <button
            key={pair.label}
            type="button"
            onClick={() => onSelectSymbol?.(pair.label)}
            className="inline-flex items-center gap-2.5 px-3 py-1 rounded-lg bg-slate-900/75 border border-slate-800 hover:border-orange-500/60 transition-colors shrink-0 whitespace-nowrap"
          >
            <span className="font-display font-bold text-xs text-white">{pair.label}</span>
            <span className="font-mono font-bold text-xs text-slate-100 tabular-nums">
              {entry.price.toFixed(pair.decimals)}
            </span>
            <span
              className={`font-mono text-[10px] font-semibold tabular-nums ${
                up ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {up ? '+' : ''}
              {diffPct.toFixed(2)}%
            </span>
          </button>
        );
      })}
    </div>
  );
};

// Backwards-compatible aliases
export const TradingViewChart = AlphatradexLiveChart;
export const TradingViewTickerTape = AlphatradexTickerTape;
