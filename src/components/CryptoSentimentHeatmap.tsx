import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Flame,
  Maximize2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from 'recharts';

export type CryptoSector = 'Layer 1' | 'DeFi & Payments' | 'AI & Infra' | 'High Beta';

export interface CryptoAssetQuote {
  id: string;
  symbol: string;
  binanceSymbol: string;
  name: string;
  sector: CryptoSector;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24hUsd: number;
  marketCapUsd: number;
}

interface EnrichedCryptoAsset extends CryptoAssetQuote {
  trendDelta: number;
  rangePositionPct: number;
  sentimentScore: number;
  sentimentLabel: 'Strong Bullish' | 'Outperforming' | 'In-Line' | 'Lagging' | 'Heavy Selloff';
  sizeValue: number;
}

const BASELINE_ASSETS: CryptoAssetQuote[] = [
  { id: 'bitcoin', symbol: 'BTC', binanceSymbol: 'BTCUSDT', name: 'Bitcoin', sector: 'Layer 1', price: 94250, change24h: 1.65, high24h: 95400, low24h: 92400, volume24hUsd: 38_400_000_000, marketCapUsd: 1_860_000_000_000 },
  { id: 'ethereum', symbol: 'ETH', binanceSymbol: 'ETHUSDT', name: 'Ethereum', sector: 'Layer 1', price: 3320, change24h: 2.18, high24h: 3380, low24h: 3210, volume24hUsd: 19_200_000_000, marketCapUsd: 400_000_000_000 },
  { id: 'solana', symbol: 'SOL', binanceSymbol: 'SOLUSDT', name: 'Solana', sector: 'Layer 1', price: 184.5, change24h: 4.12, high24h: 189.0, low24h: 174.2, volume24hUsd: 6_150_000_000, marketCapUsd: 88_000_000_000 },
  { id: 'binancecoin', symbol: 'BNB', binanceSymbol: 'BNBUSDT', name: 'BNB', sector: 'Layer 1', price: 624.8, change24h: 0.94, high24h: 632.0, low24h: 615.0, volume24hUsd: 2_050_000_000, marketCapUsd: 90_000_000_000 },
  { id: 'ripple', symbol: 'XRP', binanceSymbol: 'XRPUSDT', name: 'XRP', sector: 'DeFi & Payments', price: 1.48, change24h: 2.84, high24h: 1.53, low24h: 1.41, volume24hUsd: 4_820_000_000, marketCapUsd: 84_000_000_000 },
  { id: 'dogecoin', symbol: 'DOGE', binanceSymbol: 'DOGEUSDT', name: 'Dogecoin', sector: 'High Beta', price: 0.248, change24h: 3.45, high24h: 0.259, low24h: 0.236, volume24hUsd: 3_150_000_000, marketCapUsd: 36_500_000_000 },
  { id: 'cardano', symbol: 'ADA', binanceSymbol: 'ADAUSDT', name: 'Cardano', sector: 'Layer 1', price: 0.785, change24h: -0.62, high24h: 0.805, low24h: 0.768, volume24hUsd: 920_000_000, marketCapUsd: 27_600_000_000 },
  { id: 'avalanche-2', symbol: 'AVAX', binanceSymbol: 'AVAXUSDT', name: 'Avalanche', sector: 'Layer 1', price: 34.6, change24h: 1.24, high24h: 35.8, low24h: 33.4, volume24hUsd: 680_000_000, marketCapUsd: 14_200_000_000 },
  { id: 'chainlink', symbol: 'LINK', binanceSymbol: 'LINKUSDT', name: 'Chainlink', sector: 'DeFi & Payments', price: 18.4, change24h: 2.95, high24h: 18.95, low24h: 17.6, volume24hUsd: 790_000_000, marketCapUsd: 11_700_000_000 },
  { id: 'sui', symbol: 'SUI', binanceSymbol: 'SUIUSDT', name: 'Sui', sector: 'Layer 1', price: 3.24, change24h: 5.18, high24h: 3.35, low24h: 3.01, volume24hUsd: 1_450_000_000, marketCapUsd: 9_800_000_000 },
  { id: 'polkadot', symbol: 'DOT', binanceSymbol: 'DOTUSDT', name: 'Polkadot', sector: 'AI & Infra', price: 6.42, change24h: -1.14, high24h: 6.62, low24h: 6.31, volume24hUsd: 340_000_000, marketCapUsd: 9_600_000_000 },
  { id: 'near', symbol: 'NEAR', binanceSymbol: 'NEARUSDT', name: 'NEAR Protocol', sector: 'AI & Infra', price: 5.18, change24h: 3.05, high24h: 5.34, low24h: 4.92, volume24hUsd: 520_000_000, marketCapUsd: 6_200_000_000 },
  { id: 'uniswap', symbol: 'UNI', binanceSymbol: 'UNIUSDT', name: 'Uniswap', sector: 'DeFi & Payments', price: 9.85, change24h: -0.35, high24h: 10.15, low24h: 9.62, volume24hUsd: 410_000_000, marketCapUsd: 5_900_000_000 },
  { id: 'render-token', symbol: 'RENDER', binanceSymbol: 'RENDERUSDT', name: 'Render', sector: 'AI & Infra', price: 7.45, change24h: 4.62, high24h: 7.72, low24h: 7.01, volume24hUsd: 460_000_000, marketCapUsd: 3_850_000_000 },
  { id: 'aave', symbol: 'AAVE', binanceSymbol: 'AAVEUSDT', name: 'Aave', sector: 'DeFi & Payments', price: 242.5, change24h: 1.92, high24h: 249.0, low24h: 234.0, volume24hUsd: 390_000_000, marketCapUsd: 3_640_000_000 },
  { id: 'bittensor', symbol: 'TAO', binanceSymbol: 'TAOUSDT', name: 'Bittensor', sector: 'AI & Infra', price: 468.0, change24h: -2.18, high24h: 486.0, low24h: 458.0, volume24hUsd: 290_000_000, marketCapUsd: 3_420_000_000 },
];

function formatPrice(price: number): string {
  if (!Number.isFinite(price)) return '$0.00';
  if (price >= 1000) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (price >= 10) return `$${price.toFixed(2)}`;
  if (price >= 1) return `$${price.toFixed(3)}`;
  return `$${price.toFixed(4)}`;
}

function formatCompactUsd(val: number): string {
  if (!Number.isFinite(val) || val <= 0) return '$0';
  if (val >= 1_000_000_000_000) return `$${(val / 1_000_000_000_000).toFixed(2)}T`;
  if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(2)}B`;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  return `$${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function getHeatmapFill(metricPct: number): string {
  if (metricPct >= 3.5) return '#047857';
  if (metricPct >= 1.5) return '#059669';
  if (metricPct >= 0.4) return '#065f46';
  if (metricPct > -0.4) return '#1e293b';
  if (metricPct > -1.5) return '#7f1d1d';
  if (metricPct > -3.5) return '#9f1239';
  return '#881337';
}

function getHeatmapStroke(metricPct: number, isSelected: boolean): string {
  if (isSelected) return '#f59e0b';
  if (metricPct >= 0.4) return '#10b981';
  if (metricPct <= -0.4) return '#f43f5e';
  return '#334155';
}

function getSentimentMeta(
  trendDelta: number,
  change24h: number,
  rangePositionPct: number
): {
  score: number;
  label: EnrichedCryptoAsset['sentimentLabel'];
} {
  const raw = 50 + trendDelta * 6.5 + change24h * 2.5 + (rangePositionPct - 50) * 0.25;
  const score = Math.max(5, Math.min(98, Math.round(raw)));
  if (trendDelta >= 2.2) return { score, label: 'Strong Bullish' };
  if (trendDelta >= 0.45) return { score, label: 'Outperforming' };
  if (trendDelta > -0.45) return { score, label: 'In-Line' };
  if (trendDelta > -2.2) return { score, label: 'Lagging' };
  return { score, label: 'Heavy Selloff' };
}

interface HeatmapCellProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  depth?: number;
  symbol?: string;
  price?: number;
  change24h?: number;
  trendDelta?: number;
  metricMode: 'trend_delta' | 'change_24h';
  selectedSymbol: string;
  onSelect: (sym: string) => void;
}

const HeatmapTreemapCell: React.FC<HeatmapCellProps> = ({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  depth = 1,
  symbol = '',
  price = 0,
  change24h = 0,
  trendDelta = 0,
  metricMode,
  selectedSymbol,
  onSelect,
}) => {
  if (depth !== 1 || width < 8 || height < 8 || !symbol) return null;

  const activeMetric = metricMode === 'trend_delta' ? trendDelta : change24h;
  const isSelected = selectedSymbol === symbol;
  const fill = getHeatmapFill(activeMetric);
  const stroke = getHeatmapStroke(activeMetric, isSelected);

  const showSymbol = width >= 44 && height >= 28;
  const showPrimaryPct = width >= 54 && height >= 46;
  const showPrice = width >= 88 && height >= 68;
  const showSubMetric = width >= 112 && height >= 88;

  const primaryPctText = `${activeMetric >= 0 ? '+' : ''}${activeMetric.toFixed(2)}%`;
  const secondaryText =
    metricMode === 'trend_delta'
      ? `24h ${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%`
      : `vs Trend ${trendDelta >= 0 ? '+' : ''}${trendDelta.toFixed(2)}%`;

  return (
    <g
      onClick={() => onSelect(symbol)}
      style={{ cursor: 'pointer' }}
      role="button"
      tabIndex={0}
      aria-label={`${symbol} ${formatPrice(price)} ${primaryPctText}`}
    >
      <rect
        x={x + 1.5}
        y={y + 1.5}
        width={Math.max(0, width - 3)}
        height={Math.max(0, height - 3)}
        rx={6}
        ry={6}
        fill={fill}
        stroke={stroke}
        strokeWidth={isSelected ? 2.2 : 1}
        strokeOpacity={isSelected ? 1 : 0.45}
      />
      {showSymbol && (
        <text
          x={x + width / 2}
          y={y + height / 2 - (showPrice ? 16 : showPrimaryPct ? 7 : 0)}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#ffffff"
          fontSize={width > 120 ? 15 : 12}
          fontWeight={700}
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', pointerEvents: 'none' }}
        >
          {symbol}
        </text>
      )}
      {showPrimaryPct && (
        <text
          x={x + width / 2}
          y={y + height / 2 + (showPrice ? 2 : 10)}
          textAnchor="middle"
          dominantBaseline="central"
          fill={activeMetric >= 0 ? '#a7f3d0' : '#fecdd3'}
          fontSize={width > 120 ? 13 : 11}
          fontWeight={600}
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', pointerEvents: 'none' }}
        >
          {primaryPctText}
        </text>
      )}
      {showPrice && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 20}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#e2e8f0"
          fontSize={11}
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', pointerEvents: 'none' }}
        >
          {formatPrice(price)}
        </text>
      )}
      {showSubMetric && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 36}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#cbd5e1"
          fillOpacity={0.85}
          fontSize={10}
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', pointerEvents: 'none' }}
        >
          {secondaryText}
        </text>
      )}
    </g>
  );
};

interface CustomTooltipPayload {
  active?: boolean;
  payload?: Array<{ payload?: EnrichedCryptoAsset }>;
  marketTrendAvg: number;
}

const HeatmapTooltip: React.FC<CustomTooltipPayload> = ({
  active,
  payload,
  marketTrendAvg,
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item || !item.symbol) return null;

  return (
    <div className="bg-[#070C17]/98 border border-slate-700 rounded-lg p-3 shadow-2xl text-xs min-w-[210px] space-y-1.5">
      <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-1.5">
        <span className="font-display font-bold text-white">
          {item.name} ({item.symbol})
        </span>
        <span className="text-[11px] text-slate-400">{item.sector}</span>
      </div>
      <div className="flex items-center justify-between font-mono tabular-nums">
        <span className="text-slate-400">Live Price</span>
        <span className="text-white font-semibold">{formatPrice(item.price)}</span>
      </div>
      <div className="flex items-center justify-between font-mono tabular-nums">
        <span className="text-slate-400">24h Change</span>
        <span className={item.change24h >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
          {item.change24h >= 0 ? '+' : ''}
          {item.change24h.toFixed(2)}%
        </span>
      </div>
      <div className="flex items-center justify-between font-mono tabular-nums">
        <span className="text-slate-400">vs. Trend ({marketTrendAvg >= 0 ? '+' : ''}{marketTrendAvg.toFixed(2)}%)</span>
        <span className={item.trendDelta >= 0 ? 'text-emerald-300 font-semibold' : 'text-rose-300 font-semibold'}>
          {item.trendDelta >= 0 ? '+' : ''}
          {item.trendDelta.toFixed(2)}%
        </span>
      </div>
      <div className="flex items-center justify-between font-mono tabular-nums">
        <span className="text-slate-400">24h Volume</span>
        <span className="text-slate-200">{formatCompactUsd(item.volume24hUsd)}</span>
      </div>
      <div className="flex items-center justify-between pt-1 border-t border-slate-800">
        <span className="text-slate-400">Sentiment</span>
        <span className="font-semibold text-amber-300 font-mono tabular-nums">
          {item.sentimentLabel} ({item.sentimentScore}/100)
        </span>
      </div>
    </div>
  );
};

interface CryptoSentimentHeatmapProps {
  compact?: boolean;
  onExpandFullTab?: () => void;
}

export const CryptoSentimentHeatmap: React.FC<CryptoSentimentHeatmapProps> = ({
  compact = false,
  onExpandFullTab,
}) => {
  const [assetsMap, setAssetsMap] = useState<Record<string, CryptoAssetQuote>>(() => {
    const map: Record<string, CryptoAssetQuote> = {};
    BASELINE_ASSETS.forEach((a) => {
      map[a.symbol] = a;
    });
    return map;
  });
  const [sectorFilter, setSectorFilter] = useState<'ALL' | CryptoSector>('ALL');
  const [metricMode, setMetricMode] = useState<'trend_delta' | 'change_24h'>('trend_delta');
  const [sizeMode, setSizeMode] = useState<'market_cap' | 'volume'>('market_cap');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC');
  const [syncing, setSyncing] = useState<boolean>(false);
  const [streamConnected, setStreamConnected] = useState<boolean>(false);
  const [feedSource, setFeedSource] = useState<string>('Syncing live market feed...');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const wsRef = useRef<WebSocket | null>(null);

  const fetchLiveSnapshot = useCallback(async () => {
    setSyncing(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 7000);
    try {
      // 1. Server-cached live CoinGecko / Binance snapshot (CORS-safe)
      const res = await fetch('/api/crypto-heatmap', { signal: controller.signal });
      if (res.ok) {
        const json = (await res.json()) as {
          source?: string;
          updatedAt?: string;
          assets?: Partial<CryptoAssetQuote>[];
        };
        if (Array.isArray(json.assets) && json.assets.length > 0) {
          setAssetsMap((prev) => {
            const next = { ...prev };
            for (const row of json.assets!) {
              const sym = row.symbol?.toUpperCase();
              if (!sym || !next[sym]) continue;
              const price = Number(row.price);
              if (!Number.isFinite(price) || price <= 0) continue;
              next[sym] = {
                ...next[sym],
                price,
                change24h: Number.isFinite(Number(row.change24h))
                  ? Number(row.change24h)
                  : next[sym].change24h,
                high24h:
                  Number.isFinite(Number(row.high24h)) && Number(row.high24h) > 0
                    ? Number(row.high24h)
                    : next[sym].high24h,
                low24h:
                  Number.isFinite(Number(row.low24h)) && Number(row.low24h) > 0
                    ? Number(row.low24h)
                    : next[sym].low24h,
                volume24hUsd:
                  Number.isFinite(Number(row.volume24hUsd)) && Number(row.volume24hUsd) > 0
                    ? Number(row.volume24hUsd)
                    : next[sym].volume24hUsd,
                marketCapUsd:
                  Number.isFinite(Number(row.marketCapUsd)) && Number(row.marketCapUsd) > 0
                    ? Number(row.marketCapUsd)
                    : next[sym].marketCapUsd,
              };
            }
            return next;
          });
          setFeedSource(json.source || 'Live Spot Feed');
          setLastUpdated(
            new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
          );
          return;
        }
      }
      throw new Error('Server snapshot unavailable');
    } catch {
      // 2. Direct Binance 24hr REST fallback
      try {
        const symbols = BASELINE_ASSETS.map((a) => a.binanceSymbol);
        const bnRes = await fetch(
          `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(
            JSON.stringify(symbols)
          )}`,
          { signal: controller.signal }
        );
        if (bnRes.ok) {
          const rows = (await bnRes.json()) as Array<{
            symbol: string;
            lastPrice: string;
            priceChangePercent: string;
            highPrice: string;
            lowPrice: string;
            quoteVolume: string;
          }>;
          const byBinance = new Map(BASELINE_ASSETS.map((a) => [a.binanceSymbol, a.symbol]));
          setAssetsMap((prev) => {
            const next = { ...prev };
            for (const r of rows) {
              const sym = byBinance.get(r.symbol);
              if (!sym || !next[sym]) continue;
              const price = Number(r.lastPrice);
              if (!Number.isFinite(price) || price <= 0) continue;
              next[sym] = {
                ...next[sym],
                price,
                change24h: Number.isFinite(Number(r.priceChangePercent))
                  ? Number(r.priceChangePercent)
                  : next[sym].change24h,
                high24h: Number(r.highPrice) || next[sym].high24h,
                low24h: Number(r.lowPrice) || next[sym].low24h,
                volume24hUsd: Number(r.quoteVolume) || next[sym].volume24hUsd,
              };
            }
            return next;
          });
          setFeedSource('Binance Spot Feed');
          setLastUpdated(
            new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
          );
        } else {
          setFeedSource('Cached Reference Feed');
        }
      } catch {
        setFeedSource('Cached Reference Feed');
      }
    } finally {
      window.clearTimeout(timeoutId);
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    void fetchLiveSnapshot();
    const poll = window.setInterval(() => {
      void fetchLiveSnapshot();
    }, 30_000);

    // Real-time Binance combined WebSocket mini-ticker stream
    let disposed = false;
    try {
      const streams = BASELINE_ASSETS.map((a) => `${a.binanceSymbol.toLowerCase()}@miniTicker`).join(
        '/'
      );
      const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
      wsRef.current = ws;
      const byBinance = new Map(BASELINE_ASSETS.map((a) => [a.binanceSymbol, a.symbol]));

      ws.onopen = () => {
        if (!disposed) {
          setStreamConnected(true);
          setFeedSource('Live WebSocket Stream');
        }
      };
      ws.onmessage = (evt) => {
        if (disposed) return;
        try {
          const parsed = JSON.parse(evt.data as string) as {
            data?: { s?: string; c?: string; o?: string; h?: string; l?: string; q?: string };
          };
          const d = parsed?.data;
          if (!d?.s || !d.c) return;
          const sym = byBinance.get(d.s.toUpperCase());
          if (!sym) return;
          const price = Number(d.c);
          const open = Number(d.o);
          const high = Number(d.h);
          const low = Number(d.l);
          const qVol = Number(d.q);
          if (!Number.isFinite(price) || price <= 0) return;
          const computedChange =
            Number.isFinite(open) && open > 0 ? ((price - open) / open) * 100 : undefined;

          setAssetsMap((prev) => {
            const cur = prev[sym];
            if (!cur) return prev;
            return {
              ...prev,
              [sym]: {
                ...cur,
                price,
                change24h:
                  computedChange !== undefined && Number.isFinite(computedChange)
                    ? Number(computedChange.toFixed(2))
                    : cur.change24h,
                high24h: Number.isFinite(high) && high > 0 ? high : cur.high24h,
                low24h: Number.isFinite(low) && low > 0 ? low : cur.low24h,
                volume24hUsd: Number.isFinite(qVol) && qVol > 0 ? qVol : cur.volume24hUsd,
              },
            };
          });
          setLastUpdated(
            new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
          );
        } catch {
          // Ignore malformed ticker frame
        }
      };
      ws.onerror = () => {
        if (!disposed) setStreamConnected(false);
      };
      ws.onclose = () => {
        if (!disposed) setStreamConnected(false);
      };
    } catch {
      setStreamConnected(false);
    }

    return () => {
      disposed = true;
      window.clearInterval(poll);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // Ignore close error
        }
      }
    };
  }, [fetchLiveSnapshot]);

  // Compute Current Market Trend Baseline (volume-weighted average across entire basket)
  const { marketTrendAvg, enrichedAll, marketSentimentScore, marketSentimentLabel, advancingCount, decliningCount } =
    useMemo(() => {
      const list = Object.values(assetsMap);
      const totalWeight = list.reduce((sum, a) => sum + Math.max(1, Math.sqrt(a.volume24hUsd)), 0);
      const weightedTrend =
        totalWeight > 0
          ? list.reduce((sum, a) => sum + a.change24h * Math.max(1, Math.sqrt(a.volume24hUsd)), 0) /
            totalWeight
          : 0;

      const enriched: EnrichedCryptoAsset[] = list.map((a) => {
        const span = Math.max(1e-8, a.high24h - a.low24h);
        const rangePositionPct = Math.max(0, Math.min(100, ((a.price - a.low24h) / span) * 100));
        const trendDelta = Number((a.change24h - weightedTrend).toFixed(2));
        const { score, label } = getSentimentMeta(trendDelta, a.change24h, rangePositionPct);
        // Log-damped market cap / volume weighting keeps BTC prominent while ensuring altcoin tiles stay legible
        const rawWeight =
          sizeMode === 'market_cap'
            ? Math.pow(Math.max(1_000_000, a.marketCapUsd), 0.36)
            : Math.pow(Math.max(1_000_000, a.volume24hUsd), 0.38);

        return {
          ...a,
          trendDelta,
          rangePositionPct,
          sentimentScore: score,
          sentimentLabel: label,
          sizeValue: Math.round(rawWeight),
        };
      });

      const advancing = enriched.filter((a) => a.change24h >= 0).length;
      const declining = enriched.length - advancing;
      const avgScore =
        enriched.length > 0
          ? Math.round(enriched.reduce((sum, a) => sum + a.sentimentScore, 0) / enriched.length)
          : 50;

      let marketLabel = 'Neutral';
      if (avgScore >= 68) marketLabel = 'Risk-On / Bullish';
      else if (avgScore >= 56) marketLabel = 'Constructive';
      else if (avgScore <= 34) marketLabel = 'Risk-Off / Bearish';
      else if (avgScore <= 45) marketLabel = 'Cautious';

      return {
        marketTrendAvg: Number(weightedTrend.toFixed(2)),
        enrichedAll: enriched,
        marketSentimentScore: avgScore,
        marketSentimentLabel: marketLabel,
        advancingCount: advancing,
        decliningCount: declining,
      };
    }, [assetsMap, sizeMode]);

  const filteredAssets = useMemo(() => {
    const base =
      sectorFilter === 'ALL'
        ? enrichedAll
        : enrichedAll.filter((a) => a.sector === sectorFilter);
    return [...base].sort((a, b) => b.sizeValue - a.sizeValue);
  }, [enrichedAll, sectorFilter]);

  const sortedByTrendDelta = useMemo(() => {
    return [...filteredAssets].sort((a, b) => b.trendDelta - a.trendDelta);
  }, [filteredAssets]);

  const topLeader = sortedByTrendDelta[0];
  const topLaggard = sortedByTrendDelta[sortedByTrendDelta.length - 1];

  const selectedAsset = useMemo(() => {
    return (
      filteredAssets.find((a) => a.symbol === selectedSymbol) ||
      enrichedAll.find((a) => a.symbol === selectedSymbol) ||
      filteredAssets[0] ||
      enrichedAll[0]
    );
  }, [filteredAssets, enrichedAll, selectedSymbol]);

  const treemapData = useMemo(
    () =>
      filteredAssets.map((a) => ({
        ...a,
        name: a.symbol,
        size: a.sizeValue,
      })),
    [filteredAssets]
  );

  const sectors: Array<'ALL' | CryptoSector> = [
    'ALL',
    'Layer 1',
    'DeFi & Payments',
    'AI & Infra',
    'High Beta',
  ];

  return (
    <section
      aria-labelledby="crypto-sentiment-heatmap-heading"
      className="bg-[#0B111E]/92 backdrop-blur-md border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5"
    >
      {/* Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Flame className="w-5 h-5 text-amber-400 shrink-0" />
            <h2
              id="crypto-sentiment-heatmap-heading"
              className="font-display font-bold text-white text-lg sm:text-xl"
            >
              Real-Time Crypto Market Sentiment Heatmap
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
            <span>{streamConnected ? 'Live WebSocket Stream' : feedSource}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Trend Baseline: {marketTrendAvg >= 0 ? '+' : ''}
              {marketTrendAvg.toFixed(2)}%
            </span>
            {lastUpdated && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">Updated {lastUpdated}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void fetchLiveSnapshot()}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:border-slate-500 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing...' : 'Refresh Feed'}</span>
          </button>

          {compact && onExpandFullTab && (
            <button
              type="button"
              onClick={onExpandFullTab}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white transition-colors whitespace-nowrap"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Full Heatmap View</span>
            </button>
          )}
        </div>
      </div>

      {/* 4-Column Market Breadth KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
          <div className="text-xs text-slate-400">Current Market Trend (24h)</div>
          <div
            className={`font-mono font-bold text-xl tabular-nums flex items-center gap-1.5 ${
              marketTrendAvg >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {marketTrendAvg >= 0 ? (
              <TrendingUp className="w-4 h-4 shrink-0" />
            ) : (
              <TrendingDown className="w-4 h-4 shrink-0" />
            )}
            <span>
              {marketTrendAvg >= 0 ? '+' : ''}
              {marketTrendAvg.toFixed(2)}%
            </span>
          </div>
          <div className="text-[11px] text-slate-400">Volume-weighted 16-asset benchmark</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
          <div className="text-xs text-slate-400">Composite Sentiment</div>
          <div className="font-mono font-bold text-xl text-white tabular-nums">
            {marketSentimentScore}
            <span className="text-xs text-slate-400 font-normal"> / 100</span>
          </div>
          <div className="text-[11px] text-amber-300 font-medium">{marketSentimentLabel}</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
          <div className="text-xs text-slate-400">Market Breadth</div>
          <div className="font-mono font-bold text-xl text-white tabular-nums">
            <span className="text-emerald-400">{advancingCount} Up</span>
            <span className="text-slate-600 mx-1.5">/</span>
            <span className="text-rose-400">{decliningCount} Down</span>
          </div>
          <div className="text-[11px] text-slate-400 tabular-nums">
            {Math.round((advancingCount / Math.max(1, enrichedAll.length)) * 100)}% positive across basket
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
          <div className="text-xs text-slate-400">Trend Leader / Laggard</div>
          <div className="text-xs font-mono tabular-nums space-y-0.5 pt-0.5">
            {topLeader && (
              <div className="flex items-center justify-between text-emerald-400 font-semibold">
                <span>{topLeader.symbol}</span>
                <span>
                  {topLeader.trendDelta >= 0 ? '+' : ''}
                  {topLeader.trendDelta.toFixed(2)}% vs trend
                </span>
              </div>
            )}
            {topLaggard && (
              <div className="flex items-center justify-between text-rose-400 font-semibold">
                <span>{topLaggard.symbol}</span>
                <span>
                  {topLaggard.trendDelta >= 0 ? '+' : ''}
                  {topLaggard.trendDelta.toFixed(2)}% vs trend
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter & Metric Controls Toolbar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
          {sectors.map((sec) => (
            <button
              key={sec}
              type="button"
              onClick={() => setSectorFilter(sec)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
                sectorFilter === sec
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {sec === 'ALL' ? 'All Sectors' : sec}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="inline-flex items-center p-1 rounded-lg bg-slate-900 border border-slate-800">
            <button
              type="button"
              onClick={() => setMetricMode('trend_delta')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
                metricMode === 'trend_delta'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              vs. Current Trend
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('change_24h')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
                metricMode === 'change_24h'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              24h Change %
            </button>
          </div>

          <div className="inline-flex items-center p-1 rounded-lg bg-slate-900 border border-slate-800">
            <button
              type="button"
              onClick={() => setSizeMode('market_cap')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
                sizeMode === 'market_cap'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Size: Market Cap
            </button>
            <button
              type="button"
              onClick={() => setSizeMode('volume')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
                sizeMode === 'volume'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Size: 24h Volume
            </button>
          </div>
        </div>
      </div>

      {/* Recharts Visual Grid: Treemap Sentiment Heatmap + Relative Trend Spread BarChart */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* Left: Recharts Treemap Heatmap */}
        <div className="xl:col-span-7 bg-[#070C17] border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-white">
              Sentiment Treemap ({metricMode === 'trend_delta' ? 'Relative to Market Trend' : 'Absolute 24h Return'})
            </span>
            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#881337] inline-block" />
                Lagging
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#1e293b] inline-block" />
                In-Line
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#047857] inline-block" />
                Outperforming
              </span>
            </div>
          </div>

          <div className="w-full" style={{ height: compact ? 320 : 380 }}>
            <ResponsiveContainer width="100%" height="100%">
              <Treemap
                data={treemapData}
                dataKey="size"
                aspectRatio={4 / 3}
                isAnimationActive={false}
                content={
                  <HeatmapTreemapCell
                    metricMode={metricMode}
                    selectedSymbol={selectedAsset?.symbol || 'BTC'}
                    onSelect={setSelectedSymbol}
                  />
                }
              >
                <Tooltip
                  content={<HeatmapTooltip marketTrendAvg={marketTrendAvg} />}
                />
              </Treemap>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Recharts BarChart — Performance Spread vs Current Trend */}
        <div className="xl:col-span-5 bg-[#070C17] border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-white">
              Asset Spread vs. Current Trend (0% = Benchmark)
            </span>
            <span className="font-mono text-[11px] text-slate-400 tabular-nums">
              {sortedByTrendDelta.length} assets
            </span>
          </div>

          <div className="w-full" style={{ height: compact ? 320 : 380 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sortedByTrendDelta}
                layout="vertical"
                margin={{ top: 6, right: 18, left: 6, bottom: 6 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'ui-monospace, monospace' }}
                  tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v}%`}
                  stroke="#334155"
                />
                <YAxis
                  type="category"
                  dataKey="symbol"
                  width={54}
                  tick={{ fill: '#e2e8f0', fontSize: 11, fontFamily: 'ui-monospace, monospace' }}
                  stroke="#334155"
                />
                <ReferenceLine x={0} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.5} />
                <Tooltip
                  cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                  content={<HeatmapTooltip marketTrendAvg={marketTrendAvg} />}
                />
                <Bar
                  dataKey="trendDelta"
                  radius={[4, 4, 4, 4]}
                  isAnimationActive={false}
                  onClick={(barData) => {
                    const sym = (barData as { symbol?: string })?.symbol;
                    if (sym) setSelectedSymbol(sym);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {sortedByTrendDelta.map((entry) => (
                    <Cell
                      key={entry.symbol}
                      fill={entry.trendDelta >= 0 ? '#10b981' : '#f43f5e'}
                      fillOpacity={selectedAsset?.symbol === entry.symbol ? 1 : 0.78}
                      stroke={selectedAsset?.symbol === entry.symbol ? '#f59e0b' : 'none'}
                      strokeWidth={selectedAsset?.symbol === entry.symbol ? 1.5 : 0}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Selected Asset Live Inspector Strip */}
      {selectedAsset && (
        <div className="pt-4 border-t border-slate-800/80 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center text-xs">
          <div className="lg:col-span-4 space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-white text-base">
                {selectedAsset.name} ({selectedAsset.symbol})
              </span>
              <span className="text-slate-400">· {selectedAsset.sector}</span>
            </div>
            <div className="flex items-center gap-3 font-mono tabular-nums">
              <span className="text-white font-semibold text-sm">
                {formatPrice(selectedAsset.price)}
              </span>
              <span
                className={`inline-flex items-center gap-0.5 font-semibold ${
                  selectedAsset.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {selectedAsset.change24h >= 0 ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                )}
                {selectedAsset.change24h >= 0 ? '+' : ''}
                {selectedAsset.change24h.toFixed(2)}% (24h)
              </span>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 tabular-nums">
              <span>24h Low {formatPrice(selectedAsset.low24h)}</span>
              <span>Range Position {Math.round(selectedAsset.rangePositionPct)}%</span>
              <span>High {formatPrice(selectedAsset.high24h)}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  selectedAsset.trendDelta >= 0 ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
                style={{ width: `${selectedAsset.rangePositionPct}%` }}
              />
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-wrap lg:justify-end items-center gap-x-5 gap-y-1 font-mono tabular-nums">
            <div>
              <div className="text-[11px] text-slate-400">vs. Current Trend</div>
              <div
                className={`font-semibold ${
                  selectedAsset.trendDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {selectedAsset.trendDelta >= 0 ? '+' : ''}
                {selectedAsset.trendDelta.toFixed(2)}% ({selectedAsset.sentimentLabel})
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">24h Vol / Cap</div>
              <div className="text-slate-200 font-semibold">
                {formatCompactUsd(selectedAsset.volume24hUsd)} / {formatCompactUsd(selectedAsset.marketCapUsd)}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
