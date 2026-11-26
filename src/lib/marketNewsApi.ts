export type MarketCategory = 'FOREX' | 'CRYPTO' | 'AI_TRADING' | 'MACRO';
export type MarketSentimentBias = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type MarketImpactLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface MarketTickerItem {
  id: string;
  market: 'FOREX' | 'CRYPTO' | 'AI_TRADING';
  symbol: string;
  headline: string;
  sentiment: MarketSentimentBias;
  impact: MarketImpactLevel;
}

export interface MarketNewsArticle {
  id: string;
  title: string;
  summary: string;
  analysis: string;
  category: MarketCategory;
  symbols: string[];
  impact: MarketImpactLevel;
  sentiment: MarketSentimentBias;
  publishedAtIso: string;
  sourceName: string;
  sourceUrl: string;
  autoPosted: boolean;
}

export interface MarketSentimentPair {
  symbol: string;
  market: 'FOREX' | 'CRYPTO' | 'COMMODITY';
  longPercent: number;
  shortPercent: number;
  netBias: MarketSentimentBias;
  keyLevel: string;
  momentumNote: string;
}

export interface EconomicCalendarEvent {
  id: string;
  timeUtc: string;
  currency: string;
  event: string;
  impact: MarketImpactLevel;
  forecast: string;
  previous: string;
  marketNote: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface MarketDailyBriefing {
  headline: string;
  summary: string;
  cryptoTrend: string;
  aiTradingOutlook: string;
  forexTrend: string;
  volatilityLevel: 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH';
  keyDrivers: string[];
  publishedAtIso: string;
}

export interface MarketNewsFeedResponse {
  dailyBriefing: MarketDailyBriefing;
  tickerHeadlines: MarketTickerItem[];
  articles: MarketNewsArticle[];
  sentimentPairs: MarketSentimentPair[];
  economicEvents: EconomicCalendarEvent[];
  groundingSources: GroundingSource[];
  lastAutoPostAtIso: string;
  nextAutoPostAtIso: string;
  autoPostIntervalMinutes: number;
  publishCount: number;
}

let clientCache: MarketNewsFeedResponse | null = null;
let clientInFlight: Promise<MarketNewsFeedResponse> | null = null;

export function getCachedMarketNews(): MarketNewsFeedResponse | null {
  return clientCache;
}

function normalizeMarketNewsFeed(raw: unknown): MarketNewsFeedResponse {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Market news service returned an invalid response.');
  }
  const data = raw as Partial<MarketNewsFeedResponse> & { error?: string };
  if (!data.dailyBriefing || typeof data.dailyBriefing !== 'object') {
    throw new Error(
      data.error || 'Live market briefing is still warming up. Please retry in a moment.'
    );
  }
  const nowIso = new Date().toISOString();
  const briefing = data.dailyBriefing;
  return {
    dailyBriefing: {
      headline:
        typeof briefing.headline === 'string' && briefing.headline.trim()
          ? briefing.headline
          : 'Daily Crypto, AI Trading & Global Forex Market Summary',
      summary: typeof briefing.summary === 'string' ? briefing.summary : '',
      cryptoTrend: typeof briefing.cryptoTrend === 'string' ? briefing.cryptoTrend : '',
      aiTradingOutlook:
        typeof briefing.aiTradingOutlook === 'string' ? briefing.aiTradingOutlook : '',
      forexTrend: typeof briefing.forexTrend === 'string' ? briefing.forexTrend : '',
      volatilityLevel: briefing.volatilityLevel || 'MODERATE',
      keyDrivers: Array.isArray(briefing.keyDrivers) ? briefing.keyDrivers : [],
      publishedAtIso:
        typeof briefing.publishedAtIso === 'string' ? briefing.publishedAtIso : nowIso,
    },
    tickerHeadlines: Array.isArray(data.tickerHeadlines) ? data.tickerHeadlines : [],
    articles: Array.isArray(data.articles) ? data.articles : [],
    sentimentPairs: Array.isArray(data.sentimentPairs) ? data.sentimentPairs : [],
    economicEvents: Array.isArray(data.economicEvents) ? data.economicEvents : [],
    groundingSources: Array.isArray(data.groundingSources) ? data.groundingSources : [],
    lastAutoPostAtIso:
      typeof data.lastAutoPostAtIso === 'string' ? data.lastAutoPostAtIso : nowIso,
    nextAutoPostAtIso:
      typeof data.nextAutoPostAtIso === 'string' ? data.nextAutoPostAtIso : nowIso,
    autoPostIntervalMinutes:
      typeof data.autoPostIntervalMinutes === 'number' ? data.autoPostIntervalMinutes : 20,
    publishCount: typeof data.publishCount === 'number' ? data.publishCount : 1,
  };
}

export async function fetchMarketNews(forceRefresh = false): Promise<MarketNewsFeedResponse> {
  if (!forceRefresh && clientCache) {
    const nextMs = Date.parse(clientCache.nextAutoPostAtIso || '');
    if (Number.isFinite(nextMs) && Date.now() < nextMs) {
      return clientCache;
    }
  }

  if (clientInFlight && !forceRefresh) {
    return clientInFlight;
  }

  const req = (async () => {
    const res = await fetch(forceRefresh ? '/api/market-news/refresh' : '/api/market-news', {
      method: forceRefresh ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(`Market news service temporarily unavailable (${res.status}).`);
    }
    const payload = (await res.json().catch(() => null)) as
      | (MarketNewsFeedResponse & { error?: string })
      | null;
    if (!res.ok) {
      throw new Error(payload?.error || `Market news request failed (${res.status}).`);
    }
    const normalized = normalizeMarketNewsFeed(payload);
    clientCache = normalized;
    return normalized;
  })();

  clientInFlight = req.finally(() => {
    clientInFlight = null;
  });

  return clientInFlight;
}

export function formatRelativeTime(isoString: string): string {
  const ts = Date.parse(isoString);
  if (!Number.isFinite(ts)) return 'Just now';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'Just now';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
