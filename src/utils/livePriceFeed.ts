import { PriceAlertSymbol } from '../types/platform';

export interface LivePriceQuote {
  symbol: PriceAlertSymbol;
  price: number;
  source: string;
  decimals: number;
  category: 'Crypto' | 'Metals' | 'Forex';
  updatedAtMs: number;
}

export const ALERT_SYMBOLS_META: Array<{
  symbol: PriceAlertSymbol;
  label: string;
  category: 'Crypto' | 'Metals' | 'Forex';
  decimals: number;
  binancePair?: string;
}> = [
  { symbol: 'BTC/USD', label: 'Bitcoin', category: 'Crypto', decimals: 2, binancePair: 'BTCUSDT' },
  { symbol: 'ETH/USD', label: 'Ethereum', category: 'Crypto', decimals: 2, binancePair: 'ETHUSDT' },
  { symbol: 'SOL/USD', label: 'Solana', category: 'Crypto', decimals: 2, binancePair: 'SOLUSDT' },
  { symbol: 'BNB/USD', label: 'BNB', category: 'Crypto', decimals: 2, binancePair: 'BNBUSDT' },
  { symbol: 'XAU/USD', label: 'Gold Spot', category: 'Metals', decimals: 2 },
  { symbol: 'EUR/USD', label: 'Euro / USD', category: 'Forex', decimals: 5 },
  { symbol: 'GBP/USD', label: 'Pound / USD', category: 'Forex', decimals: 5 },
  { symbol: 'USD/JPY', label: 'USD / Yen', category: 'Forex', decimals: 3 },
  { symbol: 'AUD/USD', label: 'Aussie / USD', category: 'Forex', decimals: 5 },
];

export function formatAlertPrice(symbol: PriceAlertSymbol, price: number): string {
  const meta = ALERT_SYMBOLS_META.find((m) => m.symbol === symbol);
  const dec = meta?.decimals ?? 2;
  if (!Number.isFinite(price) || price <= 0) return '—';
  return price.toLocaleString('en-US', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

/**
 * Fetches real-time public market prices across Crypto (Binance), Gold (gold-api), and Forex (open.er-api).
 * Failures on any single feed are isolated so other feeds still update smoothly.
 */
export async function fetchAllLiveAlertPrices(): Promise<Record<PriceAlertSymbol, LivePriceQuote>> {
  const now = Date.now();
  const quotes: Partial<Record<PriceAlertSymbol, LivePriceQuote>> = {};

  const cryptoReq = fetch(
    'https://api.binance.com/api/v3/ticker/price?symbols=%5B%22BTCUSDT%22,%22ETHUSDT%22,%22SOLUSDT%22,%22BNBUSDT%22%5D'
  )
    .then((r) => (r.ok ? r.json() : []))
    .then((rows: Array<{ symbol?: string; price?: string }>) => {
      if (!Array.isArray(rows)) return;
      const map: Record<string, PriceAlertSymbol> = {
        BTCUSDT: 'BTC/USD',
        ETHUSDT: 'ETH/USD',
        SOLUSDT: 'SOL/USD',
        BNBUSDT: 'BNB/USD',
      };
      for (const row of rows) {
        const sym = map[String(row.symbol || '')];
        const p = Number(row.price);
        if (sym && Number.isFinite(p) && p > 0) {
          quotes[sym] = {
            symbol: sym,
            price: p,
            source: 'Binance',
            decimals: 2,
            category: 'Crypto',
            updatedAtMs: now,
          };
        }
      }
    })
    .catch(() => {});

  const goldReq = fetch('https://api.gold-api.com/price/XAU')
    .then((r) => (r.ok ? r.json() : null))
    .then((data: { price?: number } | null) => {
      const p = Number(data?.price);
      if (Number.isFinite(p) && p > 0) {
        quotes['XAU/USD'] = {
          symbol: 'XAU/USD',
          price: p,
          source: 'Gold-API',
          decimals: 2,
          category: 'Metals',
          updatedAtMs: now,
        };
      }
    })
    .catch(() => {});

  const fxReq = fetch('https://open.er-api.com/v6/latest/USD')
    .then((r) => (r.ok ? r.json() : null))
    .then((data: { rates?: Record<string, number> } | null) => {
      const rates = data?.rates;
      if (!rates) return;
      if (rates.EUR && rates.EUR > 0) {
        quotes['EUR/USD'] = {
          symbol: 'EUR/USD',
          price: Number((1 / rates.EUR).toFixed(5)),
          source: 'FX Live',
          decimals: 5,
          category: 'Forex',
          updatedAtMs: now,
        };
      }
      if (rates.GBP && rates.GBP > 0) {
        quotes['GBP/USD'] = {
          symbol: 'GBP/USD',
          price: Number((1 / rates.GBP).toFixed(5)),
          source: 'FX Live',
          decimals: 5,
          category: 'Forex',
          updatedAtMs: now,
        };
      }
      if (rates.JPY && rates.JPY > 0) {
        quotes['USD/JPY'] = {
          symbol: 'USD/JPY',
          price: Number(rates.JPY.toFixed(3)),
          source: 'FX Live',
          decimals: 3,
          category: 'Forex',
          updatedAtMs: now,
        };
      }
      if (rates.AUD && rates.AUD > 0) {
        quotes['AUD/USD'] = {
          symbol: 'AUD/USD',
          price: Number((1 / rates.AUD).toFixed(5)),
          source: 'FX Live',
          decimals: 5,
          category: 'Forex',
          updatedAtMs: now,
        };
      }
    })
    .catch(() => {});

  await Promise.all([cryptoReq, goldReq, fxReq]);
  return quotes as Record<PriceAlertSymbol, LivePriceQuote>;
}
