import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowDown, ArrowUp, TrendingDown, TrendingUp } from 'lucide-react';
import { PumpFunTokenConfig } from '../types/platform';

interface TickerAsset {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  decimals: number;
  category: 'crypto' | 'commodity' | 'token';
}

interface MarketTickerBarProps {
  pumpFunToken: PumpFunTokenConfig;
  onSelectAsset?: (symbol: string) => void;
}

const INITIAL_ASSETS: TickerAsset[] = [
  { id: 'usdt', symbol: 'USDT/USD', name: 'Tether', price: 1.0, change24h: 0.01, decimals: 4, category: 'crypto' },
  { id: 'sol', symbol: 'SOL/USD', name: 'Solana', price: 148.5, change24h: 2.14, decimals: 2, category: 'crypto' },
  { id: 'btc', symbol: 'BTC/USD', name: 'Bitcoin', price: 94250.0, change24h: 1.42, decimals: 2, category: 'crypto' },
  { id: 'eth', symbol: 'ETH/USD', name: 'Ethereum', price: 3320.0, change24h: 1.18, decimals: 2, category: 'crypto' },
  { id: 'bnb', symbol: 'BNB/USD', name: 'BNB', price: 618.4, change24h: 0.74, decimals: 2, category: 'crypto' },
  { id: 'xrp', symbol: 'XRP/USD', name: 'XRP', price: 1.42, change24h: 1.85, decimals: 4, category: 'crypto' },
  { id: 'xau', symbol: 'XAU/USD', name: 'Gold Spot', price: 2685.4, change24h: 0.36, decimals: 2, category: 'commodity' },
];

export const MarketTickerBar: React.FC<MarketTickerBarProps> = ({
  pumpFunToken,
  onSelectAsset,
}) => {
  const [assets, setAssets] = useState<Record<string, TickerAsset>>(() => {
    const map: Record<string, TickerAsset> = {};
    INITIAL_ASSETS.forEach((a) => {
      map[a.id] = a;
    });
    return map;
  });
  const [feedMode, setFeedMode] = useState<'LIVE STREAM' | 'SPOT FEED'>('SPOT FEED');
  const wsRef = useRef<WebSocket | null>(null);

  const fetchSnapshotFeeds = useCallback(async () => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5500);

    try {
      // 1. CoinGecko public simple price snapshot for USDT, SOL, BTC, ETH, BNB, XRP
      try {
        const cgRes = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=tether,solana,bitcoin,ethereum,binancecoin,ripple&vs_currencies=usd&include_24hr_change=true',
          { signal: controller.signal }
        );
        if (cgRes.ok) {
          const data = (await cgRes.json()) as Record<
            string,
            { usd?: number; usd_24h_change?: number }
          >;
          setAssets((prev) => {
            const next = { ...prev };
            const applyCoin = (id: string, cgKey: string) => {
              const row = data?.[cgKey];
              if (row && typeof row.usd === 'number' && row.usd > 0) {
                next[id] = {
                  ...next[id],
                  price: row.usd,
                  change24h:
                    typeof row.usd_24h_change === 'number'
                      ? row.usd_24h_change
                      : next[id].change24h,
                };
              }
            };
            applyCoin('usdt', 'tether');
            applyCoin('sol', 'solana');
            applyCoin('btc', 'bitcoin');
            applyCoin('eth', 'ethereum');
            applyCoin('bnb', 'binancecoin');
            applyCoin('xrp', 'ripple');
            return next;
          });
        }
      } catch {
        // Secondary REST fallback via Binance 24hr ticker
        try {
          const symbolsParam = encodeURIComponent(
            JSON.stringify(['SOLUSDT', 'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT'])
          );
          const bnRes = await fetch(
            `https://api.binance.com/api/v3/ticker/24hr?symbols=${symbolsParam}`,
            { signal: controller.signal }
          );
          if (bnRes.ok) {
            const rows = (await bnRes.json()) as Array<{
              symbol: string;
              lastPrice: string;
              priceChangePercent: string;
            }>;
            const symMap: Record<string, string> = {
              SOLUSDT: 'sol',
              BTCUSDT: 'btc',
              ETHUSDT: 'eth',
              BNBUSDT: 'bnb',
              XRPUSDT: 'xrp',
            };
            setAssets((prev) => {
              const next = { ...prev };
              rows.forEach((r) => {
                const key = symMap[r.symbol];
                const price = Number(r.lastPrice);
                const pct = Number(r.priceChangePercent);
                if (key && Number.isFinite(price) && price > 0) {
                  next[key] = {
                    ...next[key],
                    price,
                    change24h: Number.isFinite(pct) ? pct : next[key].change24h,
                  };
                }
              });
              return next;
            });
          }
        } catch {
          // Retain last known prices
        }
      }

      // 2. Spot Gold (XAU/USD)
      try {
        const goldRes = await fetch('https://api.gold-api.com/price/XAU', {
          signal: controller.signal,
        });
        if (goldRes.ok) {
          const goldJson = (await goldRes.json()) as { price?: number };
          if (typeof goldJson?.price === 'number' && goldJson.price > 500) {
            setAssets((prev) => ({
              ...prev,
              xau: {
                ...prev.xau,
                price: goldJson.price!,
              },
            }));
          }
        }
      } catch {
        // Keep current XAU price
      }
    } finally {
      window.clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    fetchSnapshotFeeds();
    const pollTimer = window.setInterval(fetchSnapshotFeeds, 25000);

    // Real-time Binance WebSocket mini-ticker stream
    let closedByCleanup = false;
    try {
      const streams = [
        'solusdt@ticker',
        'btcusdt@ticker',
        'ethusdt@ticker',
        'bnbusdt@ticker',
        'xrpusdt@ticker',
        'usdcusdt@ticker',
      ].join('/');
      const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!closedByCleanup) setFeedMode('LIVE STREAM');
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data) as {
            stream?: string;
            data?: { s?: string; c?: string; P?: string };
          };
          const d = msg?.data;
          if (!d?.s || !d?.c) return;
          const last = Number(d.c);
          const pct = Number(d.P);
          if (!Number.isFinite(last) || last <= 0) return;

          const symToId: Record<string, string> = {
            SOLUSDT: 'sol',
            BTCUSDT: 'btc',
            ETHUSDT: 'eth',
            BNBUSDT: 'bnb',
            XRPUSDT: 'xrp',
          };

          if (d.s === 'USDCUSDT') {
            // Invert USDC/USDT to approximate live USDT USD peg deviation
            const usdtApprox = Number((1 / last).toFixed(4));
            setAssets((prev) => ({
              ...prev,
              usdt: {
                ...prev.usdt,
                price: usdtApprox,
                change24h: Number.isFinite(pct) ? Number((-pct).toFixed(2)) : prev.usdt.change24h,
              },
            }));
            return;
          }

          const id = symToId[d.s];
          if (id) {
            setAssets((prev) => ({
              ...prev,
              [id]: {
                ...prev[id],
                price: last,
                change24h: Number.isFinite(pct) ? pct : prev[id].change24h,
              },
            }));
          }
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onerror = () => {
        if (!closedByCleanup) setFeedMode('SPOT FEED');
      };
      ws.onclose = () => {
        if (!closedByCleanup) setFeedMode('SPOT FEED');
      };
    } catch {
      setFeedMode('SPOT FEED');
    }

    return () => {
      closedByCleanup = true;
      window.clearInterval(pollTimer);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // Ignore close errors
        }
        wsRef.current = null;
      }
    };
  }, [fetchSnapshotFeeds]);

  const orderedItems = useMemo<TickerAsset[]>(() => {
    const tokenTicker = (pumpFunToken?.ticker || 'ATX').toUpperCase();
    const platformTokenItem: TickerAsset = {
      id: 'atx',
      symbol: `${tokenTicker}/USD`,
      name: pumpFunToken?.name || 'Alphatradex',
      price: Number(pumpFunToken?.priceUsd || 0.00042),
      change24h: Number(pumpFunToken?.change24hPercent || 0),
      decimals: Number(pumpFunToken?.priceUsd || 0) < 0.01 ? 6 : 4,
      category: 'token',
    };

    return [
      assets.usdt,
      assets.sol,
      assets.btc,
      assets.eth,
      assets.bnb,
      assets.xrp,
      assets.xau,
      platformTokenItem,
    ].filter(Boolean);
  }, [assets, pumpFunToken]);

  const renderTickerItem = (item: TickerAsset, keySuffix: string) => {
    const isBullish = item.change24h >= 0;
    const sentimentLabel = isBullish ? 'Bullish' : 'Bearish';
    const formattedPrice = item.price.toLocaleString(undefined, {
      minimumFractionDigits: item.decimals,
      maximumFractionDigits: item.decimals,
    });
    const formattedChange = `${isBullish ? '+' : ''}${item.change24h.toFixed(2)}%`;

    return (
      <button
        key={`${item.id}-${keySuffix}`}
        type="button"
        onClick={() => onSelectAsset?.(item.symbol)}
        aria-label={`${item.symbol} ${formattedPrice}, 24h ${formattedChange}, Market Sentiment ${sentimentLabel}`}
        className="inline-flex items-center gap-2 px-4 py-1.5 border-r border-slate-800/80 hover:bg-slate-900/90 transition-colors shrink-0 text-left group"
      >
        <span
          title={`Market Sentiment: ${sentimentLabel} (24h ${formattedChange})`}
          className={`inline-flex items-center justify-center w-4 h-4 rounded border shrink-0 ${
            isBullish
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
              : 'bg-red-500/15 border-red-500/40 text-red-400'
          }`}
        >
          {isBullish ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
        </span>
        <span className="font-mono font-bold text-[11px] tracking-wide text-amber-300 group-hover:text-amber-200">
          {item.symbol}
        </span>
        <span className="font-mono font-semibold text-xs text-white tabular-nums">
          ${formattedPrice}
        </span>
        <span
          className={`inline-flex items-center gap-0.5 font-mono text-[11px] font-semibold tabular-nums ${
            isBullish ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {isBullish ? (
            <TrendingUp className="w-3 h-3 shrink-0" />
          ) : (
            <TrendingDown className="w-3 h-3 shrink-0" />
          )}
          <span>{formattedChange}</span>
        </span>
      </button>
    );
  };

  return (
    <div
      role="region"
      aria-label="Live Market Ticker Feed"
      className="w-full h-9 bg-[#050912]/95 backdrop-blur-xl border-b border-amber-500/20 flex items-center overflow-hidden select-none shrink-0"
    >
      {/* Left Static Market Feed Tag */}
      <div className="h-full px-3 sm:px-4 bg-[#0B111E] border-r border-slate-800/90 flex items-center gap-2 shrink-0 z-10">
        <Activity className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="font-mono font-bold text-[10px] tracking-[0.14em] uppercase text-amber-300 whitespace-nowrap">
          {feedMode}
        </span>
      </div>

      {/* Continuous Seamless Scrolling Tape */}
      <div className="flex-1 min-w-0 overflow-hidden relative">
        <div className="animate-ticker-scroll">
          <div className="flex items-center">{orderedItems.map((item) => renderTickerItem(item, 'a'))}</div>
          <div className="flex items-center" aria-hidden="true">
            {orderedItems.map((item) => renderTickerItem(item, 'b'))}
          </div>
        </div>
      </div>
    </div>
  );
};
