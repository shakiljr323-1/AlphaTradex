import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { registerWeb3PaymentRoutes } from './server/web3PaymentService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const AUTO_POST_INTERVAL_MS = 20 * 60 * 1000; // Auto-publish fresh Forex & Crypto desk updates every 20 minutes
const MANUAL_REFRESH_COOLDOWN_MS = 25 * 1000;
const MODEL_NAME = 'gemini-4-hydrogen';

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

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    const err = new Error(
      'GEMINI_API_KEY is not configured. Please attach your API key in Settings > Secrets.'
    ) as Error & { statusCode?: number; code?: string };
    err.statusCode = 503;
    err.code = 'MISSING_API_KEY';
    throw err;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('Market intelligence response did not contain valid JSON.');
  }
  return JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
}

function normalizeSentiment(val: unknown): MarketSentimentBias {
  const s = String(val || '').toUpperCase().trim();
  if (s.includes('BULL') || s.includes('LONG') || s.includes('POSITIVE')) return 'BULLISH';
  if (s.includes('BEAR') || s.includes('SHORT') || s.includes('NEGATIVE')) return 'BEARISH';
  return 'NEUTRAL';
}

function normalizeImpact(val: unknown): MarketImpactLevel {
  const s = String(val || '').toUpperCase().trim();
  if (s === 'HIGH' || s === 'URGENT') return 'HIGH';
  if (s === 'LOW') return 'LOW';
  return 'MEDIUM';
}

function normalizeCategory(val: unknown): MarketCategory {
  const s = String(val || '').toUpperCase().trim();
  if (s.includes('FOREX') || s.includes('FX')) return 'FOREX';
  if (s.includes('CRYPTO') || s.includes('BTC') || s.includes('SOL')) return 'CRYPTO';
  if (s.includes('AI') || s.includes('QUANT') || s.includes('ALGO')) return 'AI_TRADING';
  return 'MACRO';
}

function normalizeVolatility(val: unknown): 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH' {
  const s = String(val || '').toUpperCase().trim();
  if (s === 'LOW' || s === 'MODERATE' || s === 'ELEVATED' || s === 'HIGH') return s;
  return 'MODERATE';
}

let cachedFeed: MarketNewsFeedResponse | null = null;
let rollingArticles: MarketNewsArticle[] = [];
let publishCount = 0;
let lastGeneratedAtMs = 0;
let inFlightGeneration: Promise<MarketNewsFeedResponse> | null = null;

const MARKET_NEWS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    dailyBriefing: {
      type: Type.OBJECT,
      properties: {
        headline: { type: Type.STRING },
        summary: { type: Type.STRING },
        cryptoTrend: { type: Type.STRING },
        aiTradingOutlook: { type: Type.STRING },
        forexTrend: { type: Type.STRING },
        volatilityLevel: { type: Type.STRING },
        keyDrivers: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
      required: [
        'headline',
        'summary',
        'cryptoTrend',
        'aiTradingOutlook',
        'forexTrend',
        'volatilityLevel',
        'keyDrivers',
      ],
    },
    tickerHeadlines: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          market: { type: Type.STRING },
          symbol: { type: Type.STRING },
          headline: { type: Type.STRING },
          sentiment: { type: Type.STRING },
          impact: { type: Type.STRING },
        },
        required: ['market', 'symbol', 'headline', 'sentiment', 'impact'],
      },
    },
    articles: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          summary: { type: Type.STRING },
          analysis: { type: Type.STRING },
          category: { type: Type.STRING },
          symbols: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          impact: { type: Type.STRING },
          sentiment: { type: Type.STRING },
          sourceName: { type: Type.STRING },
          sourceUrl: { type: Type.STRING },
        },
        required: ['title', 'summary', 'analysis', 'category', 'symbols', 'impact', 'sentiment', 'sourceName'],
      },
    },
    sentimentPairs: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          symbol: { type: Type.STRING },
          market: { type: Type.STRING },
          longPercent: { type: Type.INTEGER },
          shortPercent: { type: Type.INTEGER },
          netBias: { type: Type.STRING },
          keyLevel: { type: Type.STRING },
          momentumNote: { type: Type.STRING },
        },
        required: ['symbol', 'market', 'longPercent', 'shortPercent', 'netBias', 'keyLevel', 'momentumNote'],
      },
    },
    economicEvents: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          timeUtc: { type: Type.STRING },
          currency: { type: Type.STRING },
          event: { type: Type.STRING },
          impact: { type: Type.STRING },
          forecast: { type: Type.STRING },
          previous: { type: Type.STRING },
          marketNote: { type: Type.STRING },
        },
        required: ['timeUtc', 'currency', 'event', 'impact', 'forecast', 'previous', 'marketNote'],
      },
    },
  },
  required: ['dailyBriefing', 'tickerHeadlines', 'articles', 'sentimentPairs', 'economicEvents'],
};

function buildMarketPrompt(todayStr: string, nowIso: string, withSearch: boolean): string {
  const lead = withSearch
    ? `Today is ${todayStr} (${nowIso} UTC). Use Google Search to gather today's latest real-time developments across:`
    : `Current session timestamp: ${todayStr} (${nowIso} UTC). Produce a comprehensive institutional Myfxbook-style daily market intelligence report covering:`;

  return `${lead}
1. Forex Markets (EUR/USD, GBP/USD, USD/JPY, AUD/USD, Gold XAU/USD, USD index DXY, central bank policy).
2. Crypto Markets (Bitcoin BTC, Ethereum ETH, Solana SOL, USDT liquidity flows, ETF flows, institutional crypto positioning).
3. AI & Algorithmic Trading Markets (quantitative trading desks, AI market-making, algorithmic crypto/FX volatility regimes).
4. Forex & Crypto retail/institutional market sentiment (Myfxbook-style Long vs Short positioning percentages) and key scheduled macro economic calendar releases.

Respond with ONLY a single valid JSON object (no markdown fences, no commentary outside JSON) with this exact structure:
{
  "dailyBriefing": {
    "headline": "Concise 8-14 word institutional headline summarizing today's crypto, forex & AI trading session",
    "summary": "2-3 clear sentences summarizing today's top market trends across Crypto, Forex, and AI quantitative trading.",
    "cryptoTrend": "1-2 sentences on BTC, ETH, SOL, and stablecoin liquidity flows.",
    "aiTradingOutlook": "1-2 sentences on algorithmic / AI trading volatility conditions and execution edge.",
    "forexTrend": "1-2 sentences on EUR/USD, GBP/USD, USD/JPY, and XAU/USD price action.",
    "volatilityLevel": "LOW | MODERATE | ELEVATED | HIGH",
    "keyDrivers": ["Short driver 1", "Short driver 2", "Short driver 3", "Short driver 4"]
  },
  "tickerHeadlines": [
    {
      "market": "FOREX | CRYPTO | AI_TRADING",
      "symbol": "EUR/USD or BTC/USDT or XAU/USD or SOL/USDT or AI-QUANT",
      "headline": "Crisp 10-16 word news ticker alert",
      "sentiment": "BULLISH | BEARISH | NEUTRAL",
      "impact": "HIGH | MEDIUM | LOW"
    }
  ],
  "articles": [
    {
      "title": "Myfxbook-style professional news headline",
      "summary": "2 concise sentences summarizing the catalyst and immediate price reaction.",
      "analysis": "2-3 sentences detailing key technical levels, sentiment implication, and what traders should watch next.",
      "category": "FOREX | CRYPTO | AI_TRADING | MACRO",
      "symbols": ["EUR/USD", "DXY"],
      "impact": "HIGH | MEDIUM | LOW",
      "sentiment": "BULLISH | BEARISH | NEUTRAL",
      "sourceName": "Publisher or Desk Name",
      "sourceUrl": ""
    }
  ],
  "sentimentPairs": [
    {
      "symbol": "EUR/USD",
      "market": "FOREX | CRYPTO | COMMODITY",
      "longPercent": 58,
      "shortPercent": 42,
      "netBias": "BULLISH | BEARISH | NEUTRAL",
      "keyLevel": "Key support/resistance price level",
      "momentumNote": "Short 6-10 word sentiment explanation"
    }
  ],
  "economicEvents": [
    {
      "timeUtc": "13:30 UTC",
      "currency": "USD",
      "event": "Economic release or central bank event name",
      "impact": "HIGH | MEDIUM | LOW",
      "forecast": "Forecast value or N/A",
      "previous": "Previous value or N/A",
      "marketNote": "Brief impact note for FX & Crypto"
    }
  ]
}

Requirements:
- Provide 6-8 items in tickerHeadlines mixing FOREX, CRYPTO, and AI_TRADING.
- Provide 8 detailed articles in articles: 3 FOREX, 3 CRYPTO, and 2 AI_TRADING/MACRO.
- Provide 8 pairs in sentimentPairs: EUR/USD, GBP/USD, USD/JPY, XAU/USD, AUD/USD, BTC/USDT, ETH/USDT, SOL/USDT (longPercent + shortPercent must equal 100).
- Provide 5-6 economicEvents in economicEvents.
- Never return empty arrays.`;
}

async function generateMarketNewsWithGemini(): Promise<MarketNewsFeedResponse> {
  const ai = getGeminiClient();
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const nowIso = now.toISOString();
  const systemInstruction =
    'You are an institutional multi-asset Forex, Crypto, and AI Quantitative Market News Editor producing live Myfxbook-style market briefings, sentiment outlooks, and economic calendar summaries. Output strictly valid JSON matching the requested schema.';

  let response;
  try {
    response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: buildMarketPrompt(todayStr, nowIso, true),
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        tools: [{ googleSearch: {} }],
      },
    });
  } catch (groundingErr: unknown) {
    const errMsg = groundingErr instanceof Error ? groundingErr.message : String(groundingErr);
    const errStatus =
      (groundingErr as { status?: number; statusCode?: number })?.status ??
      (groundingErr as { statusCode?: number })?.statusCode;
    console.warn('[market-news] Grounded Gemini request failed:', errStatus, errMsg.slice(0, 300));

    if (
      errStatus === 429 ||
      errStatus === 400 ||
      errMsg.includes('RESOURCE_EXHAUSTED') ||
      errMsg.includes('Search')
    ) {
      const structuredPrompt = buildMarketPrompt(todayStr, nowIso, false);
      try {
        response = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: structuredPrompt,
          config: {
            systemInstruction,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: MARKET_NEWS_SCHEMA,
          },
        });
      } catch (secondaryErr: unknown) {
        const secMsg = secondaryErr instanceof Error ? secondaryErr.message : String(secondaryErr);
        const secStatus =
          (secondaryErr as { status?: number; statusCode?: number })?.status ??
          (secondaryErr as { statusCode?: number })?.statusCode;
        console.warn('[market-news] Primary model JSON fallback failed:', secStatus, secMsg.slice(0, 300));
        if (secStatus === 429 || secMsg.includes('RESOURCE_EXHAUSTED')) {
          response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: structuredPrompt,
            config: {
              systemInstruction,
              thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
              responseMimeType: 'application/json',
              responseSchema: MARKET_NEWS_SCHEMA,
            },
          });
        } else {
          throw secondaryErr;
        }
      }
    } else {
      throw groundingErr;
    }
  }

  let rawText = response.text;
  let parsed = rawText ? extractJsonObject(rawText) : {};

  // If grounded response returned incomplete JSON, perform one structured-schema retry
  if (
    !Array.isArray(parsed.articles) ||
    parsed.articles.length === 0 ||
    !Array.isArray(parsed.sentimentPairs) ||
    parsed.sentimentPairs.length === 0
  ) {
    console.warn('[market-news] Incomplete JSON from first pass, retrying with strict responseSchema');
    response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: buildMarketPrompt(todayStr, nowIso, false),
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        responseMimeType: 'application/json',
        responseSchema: MARKET_NEWS_SCHEMA,
      },
    });
    rawText = response.text;
    if (!rawText) {
      throw new Error('Gemini returned an empty market news response.');
    }
    parsed = extractJsonObject(rawText);
  }

  // Extract verified Google Search grounding citations
  const rawChunks =
    response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const seenUris = new Set<string>();
  const groundingSources: GroundingSource[] = [];
  for (const chunk of rawChunks) {
    const uri = (chunk as { web?: { uri?: string; title?: string } })?.web?.uri;
    const title = (chunk as { web?: { uri?: string; title?: string } })?.web?.title;
    if (uri && !seenUris.has(uri)) {
      seenUris.add(uri);
      groundingSources.push({
        title: (title || uri).slice(0, 140),
        uri,
      });
    }
  }

  const rawBrief = (parsed.dailyBriefing || {}) as Record<string, unknown>;
  const dailyBriefing: MarketDailyBriefing = {
    headline: String(
      rawBrief.headline || 'Global Forex, Crypto & AI Quantitative Markets Daily Briefing'
    ).slice(0, 180),
    summary: String(
      rawBrief.summary || 'Live multi-asset intelligence synthesized from current market sessions.'
    ).slice(0, 700),
    cryptoTrend: String(rawBrief.cryptoTrend || '').slice(0, 420),
    aiTradingOutlook: String(rawBrief.aiTradingOutlook || '').slice(0, 420),
    forexTrend: String(rawBrief.forexTrend || '').slice(0, 420),
    volatilityLevel: normalizeVolatility(rawBrief.volatilityLevel),
    keyDrivers: Array.isArray(rawBrief.keyDrivers)
      ? rawBrief.keyDrivers.map((d) => String(d).slice(0, 120)).filter(Boolean).slice(0, 6)
      : [],
    publishedAtIso: nowIso,
  };

  const rawTickers = Array.isArray(parsed.tickerHeadlines) ? parsed.tickerHeadlines : [];
  const tickerHeadlines: MarketTickerItem[] = rawTickers
    .map((item, idx) => {
      const rec = item as Record<string, unknown>;
      const mRaw = String(rec.market || '').toUpperCase();
      const market: 'FOREX' | 'CRYPTO' | 'AI_TRADING' = mRaw.includes('FOREX')
        ? 'FOREX'
        : mRaw.includes('AI')
        ? 'AI_TRADING'
        : 'CRYPTO';
      return {
        id: `tk_${now.getTime()}_${idx}`,
        market,
        symbol: String(rec.symbol || (market === 'FOREX' ? 'EUR/USD' : 'BTC/USDT')).slice(0, 20),
        headline: String(rec.headline || '').slice(0, 160),
        sentiment: normalizeSentiment(rec.sentiment),
        impact: normalizeImpact(rec.impact),
      };
    })
    .filter((t) => Boolean(t.headline))
    .slice(0, 12);

  const rawArticles = Array.isArray(parsed.articles) ? parsed.articles : [];
  const freshArticles: MarketNewsArticle[] = rawArticles
    .map((item, idx) => {
      const rec = item as Record<string, unknown>;
      const publishedMs = now.getTime() - idx * 4 * 60 * 1000;
      const rawUrl = String(rec.sourceUrl || '').trim();
      const fallbackSource = groundingSources[idx % Math.max(1, groundingSources.length)];
      const safeUrl =
        rawUrl.startsWith('https://') || rawUrl.startsWith('http://')
          ? rawUrl
          : fallbackSource?.uri || '';
      return {
        id: `news_${now.getTime()}_${idx}`,
        title: String(rec.title || '').slice(0, 180),
        summary: String(rec.summary || '').slice(0, 500),
        analysis: String(rec.analysis || '').slice(0, 900),
        category: normalizeCategory(rec.category),
        symbols: Array.isArray(rec.symbols)
          ? rec.symbols.map((s) => String(s).slice(0, 20)).filter(Boolean).slice(0, 4)
          : [],
        impact: normalizeImpact(rec.impact),
        sentiment: normalizeSentiment(rec.sentiment),
        publishedAtIso: new Date(publishedMs).toISOString(),
        sourceName: String(rec.sourceName || fallbackSource?.title || 'Market Wire').slice(0, 80),
        sourceUrl: safeUrl,
        autoPosted: true,
      };
    })
    .filter((a) => Boolean(a.title && a.summary));

  // Merge new auto-posted articles into rolling archive (newest first, deduplicated by title)
  const titleSet = new Set<string>();
  const mergedArticles: MarketNewsArticle[] = [];
  for (const art of [...freshArticles, ...rollingArticles]) {
    const key = art.title.toLowerCase().trim();
    if (!titleSet.has(key)) {
      titleSet.add(key);
      mergedArticles.push(art);
    }
    if (mergedArticles.length >= 24) break;
  }
  rollingArticles = mergedArticles;

  const rawSentiments = Array.isArray(parsed.sentimentPairs) ? parsed.sentimentPairs : [];
  const sentimentPairs: MarketSentimentPair[] = rawSentiments
    .map((item) => {
      const rec = item as Record<string, unknown>;
      const rawLong = Math.round(Number(rec.longPercent));
      const longPercent = Number.isFinite(rawLong)
        ? Math.min(95, Math.max(5, rawLong))
        : 50;
      const shortPercent = 100 - longPercent;
      const mRaw = String(rec.market || '').toUpperCase();
      const market: 'FOREX' | 'CRYPTO' | 'COMMODITY' = mRaw.includes('CRYPTO')
        ? 'CRYPTO'
        : mRaw.includes('COMM') || String(rec.symbol || '').includes('XAU')
        ? 'COMMODITY'
        : 'FOREX';
      const netBias: MarketSentimentBias =
        longPercent >= 54 ? 'BULLISH' : longPercent <= 46 ? 'BEARISH' : 'NEUTRAL';
      return {
        symbol: String(rec.symbol || 'EUR/USD').slice(0, 16),
        market,
        longPercent,
        shortPercent,
        netBias,
        keyLevel: String(rec.keyLevel || '—').slice(0, 40),
        momentumNote: String(rec.momentumNote || '').slice(0, 140),
      };
    })
    .slice(0, 10);

  const rawEvents = Array.isArray(parsed.economicEvents) ? parsed.economicEvents : [];
  const economicEvents: EconomicCalendarEvent[] = rawEvents
    .map((item, idx) => {
      const rec = item as Record<string, unknown>;
      return {
        id: `ev_${now.getTime()}_${idx}`,
        timeUtc: String(rec.timeUtc || 'TBD').slice(0, 24),
        currency: String(rec.currency || 'USD').toUpperCase().slice(0, 8),
        event: String(rec.event || '').slice(0, 140),
        impact: normalizeImpact(rec.impact),
        forecast: String(rec.forecast || '—').slice(0, 32),
        previous: String(rec.previous || '—').slice(0, 32),
        marketNote: String(rec.marketNote || '').slice(0, 160),
      };
    })
    .filter((ev) => Boolean(ev.event))
    .slice(0, 8);

  publishCount += 1;
  lastGeneratedAtMs = now.getTime();

  const feed: MarketNewsFeedResponse = {
    dailyBriefing,
    tickerHeadlines,
    articles: rollingArticles,
    sentimentPairs,
    economicEvents,
    groundingSources: groundingSources.slice(0, 12),
    lastAutoPostAtIso: nowIso,
    nextAutoPostAtIso: new Date(lastGeneratedAtMs + AUTO_POST_INTERVAL_MS).toISOString(),
    autoPostIntervalMinutes: Math.round(AUTO_POST_INTERVAL_MS / 60000),
    publishCount,
  };

  cachedFeed = feed;
  return feed;
}

async function getOrPublishMarketNews(forceRefresh = false): Promise<MarketNewsFeedResponse> {
  const nowMs = Date.now();
  const isFresh = cachedFeed && nowMs - lastGeneratedAtMs < AUTO_POST_INTERVAL_MS;

  if (!forceRefresh && isFresh && cachedFeed) {
    return cachedFeed;
  }

  if (
    forceRefresh &&
    cachedFeed &&
    nowMs - lastGeneratedAtMs < MANUAL_REFRESH_COOLDOWN_MS
  ) {
    return cachedFeed;
  }

  if (!inFlightGeneration) {
    inFlightGeneration = generateMarketNewsWithGemini().finally(() => {
      inFlightGeneration = null;
    });
  }
  return inFlightGeneration;
}

function formatGeminiError(err: unknown): { status: number; message: string; code: string } {
  const e = err as { status?: number; statusCode?: number; code?: string; message?: string };
  const msg = e?.message || 'Unable to fetch live market intelligence right now.';
  const status = e?.status || e?.statusCode || 500;
  if (e?.code === 'MISSING_API_KEY') {
    return { status: 503, message: msg, code: 'MISSING_API_KEY' };
  }
  if (status === 403 || status === 400 || msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED')) {
    return {
      status: 403,
      message: 'Gemini API key authentication failed. Please check your key in Settings > Secrets.',
      code: 'API_KEY_ERROR',
    };
  }
  if (status === 429 || msg.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message: 'Gemini API rate limit reached. Please retry shortly or check your API quota in Settings > Secrets.',
      code: 'RATE_LIMITED',
    };
  }
  return { status: status >= 400 && status < 600 ? status : 500, message: msg, code: 'UPSTREAM_ERROR' };
}

// =========================================================================
// Global KYC Verification: Free Gemini AI OCR + API-Ready Provider Status
// =========================================================================

const KYC_IMAGE_DATA_URL_REGEX = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/;
const MAX_KYC_IMAGE_CHARS = 450_000;

interface ParsedInlineImage {
  mimeType: string;
  data: string;
}

function parseKycDataUrl(raw: unknown, fieldName: string): ParsedInlineImage | null {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw !== 'string') {
    throw Object.assign(new Error(`${fieldName} must be a valid image data URL.`), { statusCode: 400 });
  }
  if (raw.length > MAX_KYC_IMAGE_CHARS) {
    throw Object.assign(
      new Error(`${fieldName} exceeds maximum compressed size. Please upload a clearer, smaller photo.`),
      { statusCode: 413 }
    );
  }
  const match = raw.match(KYC_IMAGE_DATA_URL_REGEX);
  if (!match) {
    throw Object.assign(
      new Error(`${fieldName} must be a JPEG, PNG, or WebP image.`),
      { statusCode: 400 }
    );
  }
  const mimeType = match[1] === 'jpg' ? 'image/jpeg' : `image/${match[1]}`;
  return { mimeType, data: match[2] };
}

function isSafeExternalHttpsUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host === '169.254.169.254' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      /^169\.254\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

const KYC_OCR_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    fullName: { type: Type.STRING },
    dateOfBirth: { type: Type.STRING },
    documentNumber: { type: Type.STRING },
    nationality: { type: Type.STRING },
    issueDate: { type: Type.STRING },
    expiryDate: { type: Type.STRING },
    address: { type: Type.STRING },
    confidence: { type: Type.INTEGER },
    livenessCheckPassed: { type: Type.BOOLEAN },
    matchedInputId: { type: Type.BOOLEAN },
    extractionNotes: { type: Type.STRING },
  },
  required: [
    'fullName',
    'dateOfBirth',
    'documentNumber',
    'nationality',
    'issueDate',
    'expiryDate',
    'address',
    'confidence',
    'livenessCheckPassed',
    'matchedInputId',
    'extractionNotes',
  ],
};

function sanitizeKycDate(val: unknown): string {
  const s = String(val || '').trim().slice(0, 32);
  return s;
}

function normalizeIdForCompare(val: string): string {
  return val.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function smartParseIdWithoutImages(params: {
  countryCode: string;
  countryName: string;
  nationalityHint: string;
  idType: string;
  idNumber: string;
  currentFullName: string;
}) {
  const cleanId = params.idNumber.trim().slice(0, 64);
  const cc = params.countryCode.toUpperCase();
  let inferredDob = '';
  const notes: string[] = [];

  // Country-specific deterministic structural parsing (non-fabricating)
  if (cc === 'BD' && params.idType === 'NID' && /^(19|20)\d{2}\d{13}$/.test(cleanId)) {
    inferredDob = `${cleanId.slice(0, 4)}-01-01`;
    notes.push(`Detected 17-digit Bangladesh NID format with embedded birth year ${cleanId.slice(0, 4)}.`);
  } else if (cc === 'MY' && params.idType === 'NID') {
    const digits = cleanId.replace(/\D/g, '');
    if (digits.length === 12) {
      const yy = Number(digits.slice(0, 2));
      const mm = digits.slice(2, 4);
      const dd = digits.slice(4, 6);
      const yyyy = yy <= 26 ? `20${digits.slice(0, 2)}` : `19${digits.slice(0, 2)}`;
      if (Number(mm) >= 1 && Number(mm) <= 12 && Number(dd) >= 1 && Number(dd) <= 31) {
        inferredDob = `${yyyy}-${mm}-${dd}`;
        notes.push(`Parsed birth date ${inferredDob} from Malaysian MyKad prefix.`);
      }
    }
  } else if (cc === 'ID' && params.idType === 'NID' && /^\d{16}$/.test(cleanId)) {
    const ddRaw = Number(cleanId.slice(6, 8));
    const dd = ddRaw > 40 ? ddRaw - 40 : ddRaw;
    const mm = cleanId.slice(8, 10);
    const yy = Number(cleanId.slice(10, 12));
    const yyyy = yy <= 26 ? `20${cleanId.slice(10, 12)}` : `19${cleanId.slice(10, 12)}`;
    if (dd >= 1 && dd <= 31 && Number(mm) >= 1 && Number(mm) <= 12) {
      inferredDob = `${yyyy}-${mm}-${String(dd).padStart(2, '0')}`;
      notes.push(`Parsed birth date ${inferredDob} from Indonesian KTP NIK.`);
    }
  }

  notes.push(
    `Validated ${params.idType} document number format for ${params.countryName}. Upload Front/Back ID photos to run Free AI Vision OCR for full field extraction.`
  );

  return {
    extracted: {
      fullName: params.currentFullName.trim().slice(0, 120),
      dateOfBirth: inferredDob,
      documentNumber: cleanId,
      nationality: params.nationalityHint || params.countryName,
      issueDate: '',
      expiryDate: '',
      address: '',
    },
    confidence: cleanId.length >= 6 ? 68 : 42,
    livenessCheckPassed: false,
    matchedInputId: Boolean(cleanId),
    extractionNotes: notes.join(' '),
    verificationSource: 'FORMAT_SMART_PARSE' as const,
    liveApiStatus: 'ocr_preview_only' as const,
    providerUsed: 'Built-in Format Parser (Free)',
  };
}

function getKycProviderStatuses() {
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY?.trim());

  return {
    defaultProvider: 'free_qr_mrz_ocr',
    providers: [
      {
        id: 'free_qr_mrz_ocr',
        name: 'Built-in QR / Barcode & Local OCR',
        tier: 'FREE',
        mode: 'free_builtin',
        configured: true,
        envVars: [],
        description:
          'Built directly into the platform. Automatically scans document QR codes, PDF417 barcodes (NID / Driving License), Passport MRZ, and runs local OCR whenever a document is uploaded or updated.',
      },
      {
        id: 'free_ai_ocr',
        name: 'Built-in AI Vision Document Scanner',
        tier: 'FREE',
        mode: 'free_builtin',
        configured: geminiConfigured,
        envVars: [],
        description:
          'Uses the built-in AI Vision service to read blurry, angled, or non-QR document photos and auto-fill Name, DOB, ID Number, Dates, and Address.',
      },
    ],
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, autoPostIntervalMinutes: Math.round(AUTO_POST_INTERVAL_MS / 60000) });
  });

  // High-Security Web3 Auto-Deposit Verification & Safe 2FA Withdrawal Routes (Zero Private Keys)
  registerWeb3PaymentRoutes(app);

  app.get('/api/kyc/provider-status', (_req, res) => {
    res.json(getKycProviderStatuses());
  });

  app.post('/api/kyc/ocr-extract', async (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const countryCode = String(body.countryCode || 'US').toUpperCase().slice(0, 4);
      const countryName = String(body.countryName || 'United States').trim().slice(0, 80);
      const nationalityHint = String(body.nationalityHint || countryName).trim().slice(0, 80);
      const rawIdType = String(body.idType || 'NID').trim();
      const idType = ['NID', 'Passport', 'Driving License'].includes(rawIdType) ? rawIdType : 'NID';
      const idNumber = String(body.idNumber || '').trim().slice(0, 64);
      const currentFullName = String(body.currentFullName || '').trim().slice(0, 120);

      const frontImg = parseKycDataUrl(body.frontImageDataUrl, 'Front ID photo');
      const backImg = parseKycDataUrl(body.backImageDataUrl, 'Back ID photo');
      const selfieImg = parseKycDataUrl(body.selfieDataUrl, 'Live selfie photo');

      if (!frontImg && !backImg && !selfieImg) {
        if (!idNumber) {
          res.status(400).json({
            error: 'Enter your document number or upload Front/Back ID photos to extract KYC details.',
            code: 'EMPTY_KYC_INPUT',
          });
          return;
        }
        res.json(
          smartParseIdWithoutImages({
            countryCode,
            countryName,
            nationalityHint,
            idType,
            idNumber,
            currentFullName,
          })
        );
        return;
      }

      const ai = getGeminiClient();
      const parts: Array<
        | { text: string }
        | { inlineData: { mimeType: string; data: string } }
      > = [
        {
          text: [
            `You are a strict global KYC document OCR and visual liveness pre-screener.`,
            `Expected jurisdiction: ${countryName} (${countryCode}), expected nationality: ${nationalityHint}.`,
            `Selected document type: ${idType}.`,
            idNumber ? `User-entered document number to cross-check: "${idNumber}".` : 'No document number pre-entered.',
            `Examine the attached image(s) carefully in order:`,
            frontImg ? '- Image 1: Front side of government ID document.' : '',
            backImg ? '- Next image: Back side of government ID document (look for address, MRZ, issue/expiry dates, barcode metadata).' : '',
            selfieImg ? '- Final image: Live selfie / portrait photo (check whether a real human face is clearly visible for liveness pre-check).' : '',
            ``,
            `Extraction rules:`,
            `1. Read ONLY text actually visible on the document image(s). NEVER invent or guess random personal data if a field is unreadable or absent—return an empty string "" for unreadable fields.`,
            `2. Format dates as YYYY-MM-DD when clearly readable (otherwise preserve the exact printed date string).`,
            `3. If documentNumber is visible on the ID, return it accurately; otherwise return "${idNumber}".`,
            `4. Set matchedInputId = true if no idNumber was entered OR if the printed ID number matches the user-entered ID number ignoring spaces/hyphens.`,
            `5. Set livenessCheckPassed = true ONLY if a live selfie image was attached AND shows a clear human face.`,
            `6. Set confidence as an integer 0-100 reflecting image clarity and OCR legibility.`,
            `7. In extractionNotes, summarize in 1-2 short factual sentences what was read and flag any blurry/missing fields or mismatches.`,
          ]
            .filter(Boolean)
            .join('\n'),
        },
      ];

      if (frontImg) parts.push({ inlineData: frontImg });
      if (backImg) parts.push({ inlineData: backImg });
      if (selfieImg) parts.push({ inlineData: selfieImg });

      const systemInstruction =
        'You are an institutional KYC OCR extraction engine. Output strictly valid JSON matching the schema. Never fabricate personal details that are not visibly present in the uploaded document images.';

      let response;
      let modelUsed = MODEL_NAME;
      try {
        response = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: [{ role: 'user', parts }],
          config: {
            systemInstruction,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: KYC_OCR_SCHEMA,
          },
        });
      } catch (primaryErr: unknown) {
        const msg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
        const status =
          (primaryErr as { status?: number; statusCode?: number })?.status ??
          (primaryErr as { statusCode?: number })?.statusCode;
        if (status === 429 || status === 503 || msg.includes('RESOURCE_EXHAUSTED')) {
          modelUsed = 'gemini-3.1-flash-lite';
          response = await ai.models.generateContent({
            model: modelUsed,
            contents: [{ role: 'user', parts }],
            config: {
              systemInstruction,
              thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
              responseMimeType: 'application/json',
              responseSchema: KYC_OCR_SCHEMA,
            },
          });
        } else {
          throw primaryErr;
        }
      }

      const rawText = response.text;
      if (!rawText) {
        throw new Error('OCR engine returned an empty response. Please try again with a clearer image.');
      }

      const parsed = extractJsonObject(rawText);
      const extractedDocNumber = String(parsed.documentNumber || idNumber || '').trim().slice(0, 64);
      const rawConf = Math.round(Number(parsed.confidence));
      const confidence = Number.isFinite(rawConf) ? Math.min(100, Math.max(0, rawConf)) : 50;
      const matchedInputId = idNumber
        ? normalizeIdForCompare(extractedDocNumber) === normalizeIdForCompare(idNumber) || Boolean(parsed.matchedInputId)
        : true;

      res.json({
        extracted: {
          fullName: String(parsed.fullName || '').trim().slice(0, 120),
          dateOfBirth: sanitizeKycDate(parsed.dateOfBirth),
          documentNumber: extractedDocNumber,
          nationality: String(parsed.nationality || nationalityHint || '').trim().slice(0, 80),
          issueDate: sanitizeKycDate(parsed.issueDate),
          expiryDate: sanitizeKycDate(parsed.expiryDate),
          address: String(parsed.address || '').trim().slice(0, 260),
        },
        confidence,
        livenessCheckPassed: Boolean(selfieImg) && Boolean(parsed.livenessCheckPassed),
        matchedInputId,
        extractionNotes: String(
          parsed.extractionNotes || 'OCR extraction complete. Review extracted details before submitting.'
        ).slice(0, 400),
        verificationSource: 'FREE_GEMINI_OCR' as const,
        liveApiStatus: 'ocr_preview_only' as const,
        providerUsed: `Built-in Free AI Vision OCR (${modelUsed})`,
      });
    } catch (err: unknown) {
      const customStatus = (err as { statusCode?: number })?.statusCode;
      if (customStatus === 400 || customStatus === 413) {
        res.status(customStatus).json({
          error: err instanceof Error ? err.message : 'Invalid KYC image payload.',
          code: 'INVALID_KYC_INPUT',
        });
        return;
      }
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message, code: formatted.code });
    }
  });

  app.get('/api/market-news', async (_req, res) => {
    try {
      const feed = await getOrPublishMarketNews(false);
      res.json(feed);
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message, code: formatted.code });
    }
  });

  app.post('/api/market-news/refresh', async (_req, res) => {
    try {
      const feed = await getOrPublishMarketNews(true);
      res.json(feed);
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message, code: formatted.code });
    }
  });

  // Live Crypto Sentiment Heatmap Feed (20s cache, CoinGecko primary + Binance 24hr fallback)
  let cryptoHeatmapCache: {
    expiresAt: number;
    payload: {
      source: string;
      updatedAt: string;
      assets: Array<{
        symbol: string;
        price: number;
        change24h: number;
        high24h: number;
        low24h: number;
        volume24hUsd: number;
        marketCapUsd: number;
      }>;
    };
  } | null = null;

  app.get('/api/crypto-heatmap', async (_req, res) => {
    if (cryptoHeatmapCache && Date.now() < cryptoHeatmapCache.expiresAt) {
      res.json(cryptoHeatmapCache.payload);
      return;
    }

    const trackedCoins = [
      { cgId: 'bitcoin', symbol: 'BTC', binance: 'BTCUSDT' },
      { cgId: 'ethereum', symbol: 'ETH', binance: 'ETHUSDT' },
      { cgId: 'solana', symbol: 'SOL', binance: 'SOLUSDT' },
      { cgId: 'binancecoin', symbol: 'BNB', binance: 'BNBUSDT' },
      { cgId: 'ripple', symbol: 'XRP', binance: 'XRPUSDT' },
      { cgId: 'dogecoin', symbol: 'DOGE', binance: 'DOGEUSDT' },
      { cgId: 'cardano', symbol: 'ADA', binance: 'ADAUSDT' },
      { cgId: 'avalanche-2', symbol: 'AVAX', binance: 'AVAXUSDT' },
      { cgId: 'chainlink', symbol: 'LINK', binance: 'LINKUSDT' },
      { cgId: 'sui', symbol: 'SUI', binance: 'SUIUSDT' },
      { cgId: 'polkadot', symbol: 'DOT', binance: 'DOTUSDT' },
      { cgId: 'near', symbol: 'NEAR', binance: 'NEARUSDT' },
      { cgId: 'uniswap', symbol: 'UNI', binance: 'UNIUSDT' },
      { cgId: 'render-token', symbol: 'RENDER', binance: 'RENDERUSDT' },
      { cgId: 'aave', symbol: 'AAVE', binance: 'AAVEUSDT' },
      { cgId: 'bittensor', symbol: 'TAO', binance: 'TAOUSDT' },
    ];

    try {
      const ids = trackedCoins.map((c) => c.cgId).join(',');
      const cgRes = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(ids)}&price_change_percentage=24h`,
        { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5500) }
      );
      if (cgRes.ok) {
        const rows = (await cgRes.json()) as Array<{
          id?: string;
          symbol?: string;
          current_price?: number;
          price_change_percentage_24h?: number;
          high_24h?: number;
          low_24h?: number;
          total_volume?: number;
          market_cap?: number;
        }>;
        const byCg = new Map(trackedCoins.map((c) => [c.cgId, c.symbol]));
        const assets = rows
          .map((r) => {
            const sym = byCg.get(String(r.id || ''));
            if (!sym || !Number.isFinite(Number(r.current_price))) return null;
            return {
              symbol: sym,
              price: Number(r.current_price),
              change24h: Number(r.price_change_percentage_24h || 0),
              high24h: Number(r.high_24h || r.current_price),
              low24h: Number(r.low_24h || r.current_price),
              volume24hUsd: Number(r.total_volume || 0),
              marketCapUsd: Number(r.market_cap || 0),
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null);

        if (assets.length >= 6) {
          const payload = {
            source: 'CoinGecko Live Markets',
            updatedAt: new Date().toISOString(),
            assets,
          };
          cryptoHeatmapCache = { expiresAt: Date.now() + 20_000, payload };
          res.json(payload);
          return;
        }
      }
    } catch {
      // Fall through to Binance 24hr ticker
    }

    try {
      const symbolsParam = encodeURIComponent(
        JSON.stringify(trackedCoins.map((c) => c.binance))
      );
      const bnRes = await fetch(
        `https://api.binance.com/api/v3/ticker/24hr?symbols=${symbolsParam}`,
        { signal: AbortSignal.timeout(5500) }
      );
      if (bnRes.ok) {
        const rows = (await bnRes.json()) as Array<{
          symbol?: string;
          lastPrice?: string;
          priceChangePercent?: string;
          highPrice?: string;
          lowPrice?: string;
          quoteVolume?: string;
        }>;
        const byBn = new Map(trackedCoins.map((c) => [c.binance, c.symbol]));
        const assets = rows
          .map((r) => {
            const sym = byBn.get(String(r.symbol || '').toUpperCase());
            const price = Number(r.lastPrice);
            if (!sym || !Number.isFinite(price) || price <= 0) return null;
            return {
              symbol: sym,
              price,
              change24h: Number(r.priceChangePercent || 0),
              high24h: Number(r.highPrice || price),
              low24h: Number(r.lowPrice || price),
              volume24hUsd: Number(r.quoteVolume || 0),
              marketCapUsd: 0,
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null);

        if (assets.length > 0) {
          const payload = {
            source: 'Binance 24h Spot Feed',
            updatedAt: new Date().toISOString(),
            assets,
          };
          cryptoHeatmapCache = { expiresAt: Date.now() + 20_000, payload };
          res.json(payload);
          return;
        }
      }
    } catch {
      // Return empty list so client keeps last known or WebSocket live quotes
    }

    res.json({
      source: 'Live WebSocket Fallback',
      updatedAt: new Date().toISOString(),
      assets: [],
    });
  });

  // AI Motion Video Studio — generates compliant 4-scene animated storyboards + 4-language captions via gemini-4-hydrogen
  app.post('/api/ai-motion-guide/generate', async (req, res) => {
    try {
      const body = (req.body || {}) as {
        prompt?: string;
        videoTitle?: string;
        existingScript?: string;
        visualPreset?: string;
        companyName?: string;
      };

      const userPrompt = String(body.prompt || '').trim().slice(0, 800);
      const videoTitle = String(body.videoTitle || 'How AlphaTradex Works').trim().slice(0, 120);
      const existingScript = String(body.existingScript || '').trim().slice(0, 1000);
      const visualPreset = ['overview', 'signup', 'package', 'dashboard'].includes(
        String(body.visualPreset || '')
      )
        ? String(body.visualPreset)
        : 'overview';
      const companyName = String(body.companyName || 'AlphaTradex').trim().slice(0, 80);

      if (!userPrompt && !existingScript) {
        res.status(400).json({ error: 'Please provide a motion prompt or tutorial script.' });
        return;
      }

      const ai = getGeminiClient();

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Generate a crisp 4-scene animated tutorial motion video storyboard and 3-language captions for "${videoTitle}" on ${companyName}.

Admin Prompt: ${userPrompt || 'Refresh the tutorial motion reel with clear onboarding visuals.'}
Base Script Context: ${existingScript || 'Explain registration, wallet deposit & packages (Starter $100, Growth $300, Pro $500, Elite $1,000; 200 Mon-Fri profit days, Sat-Sun off, 70 calendar days capital withdrawal eligibility for Elite), and transparent dashboard tracking.'}
Primary Visual Preset: ${visualPreset}

STRICT COMPLIANCE RULES:
- Never promise guaranteed profits, guaranteed returns, or risk-free income.
- Clearly frame visuals as illustrative onboarding & demo walkthroughs.
- Keep every scene headline punchy (3 to 6 words) and each caption concise (under 24 words) so it reads cleanly inside a 16:9 motion canvas.
- Translate the summary caption accurately into English (en), Hindi (hi), and Spanish (es).`,
        config: {
          systemInstruction:
            'You are a fintech motion graphics director creating clean, factual, compliance-safe onboarding tutorial storyboards for a trading and vault platform. Never invent fake guaranteed profit promises.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              script: {
                type: Type.STRING,
                description: 'Concise 2-4 sentence narration script for the tutorial video.',
              },
              caption: {
                type: Type.OBJECT,
                properties: {
                  en: { type: Type.STRING },
                  hi: { type: Type.STRING },
                  es: { type: Type.STRING },
                },
                required: ['en', 'hi', 'es'],
              },
              scenes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING, description: 'Short chapter label e.g. 01 · Account Setup' },
                    headline: { type: Type.STRING, description: '3-6 word kinetic canvas headline' },
                    caption: { type: Type.STRING, description: '1-sentence subtitle shown during this scene' },
                    metricLabel: { type: Type.STRING, description: 'Short uppercase metric label' },
                    metricValue: { type: Type.STRING, description: 'Short factual highlight value (no fake ROI promises)' },
                    durationSec: { type: Type.NUMBER, description: 'Scene duration between 4 and 6 seconds' },
                    accent: { type: Type.STRING, description: 'One of: amber, emerald, sky, violet' },
                    visualType: { type: Type.STRING, description: 'One of: overview, signup, package, dashboard' },
                  },
                  required: [
                    'title',
                    'headline',
                    'caption',
                    'metricLabel',
                    'metricValue',
                    'durationSec',
                    'accent',
                    'visualType',
                  ],
                },
              },
            },
            required: ['script', 'caption', 'scenes'],
          },
        },
      });

      const parsed = extractJsonObject(response.text || '{}') as {
        script?: string;
        caption?: { en?: string; hi?: string; es?: string };
        scenes?: Array<Record<string, unknown>>;
      };

      const validAccents = new Set(['amber', 'emerald', 'sky', 'violet']);
      const validVisuals = new Set(['overview', 'signup', 'package', 'dashboard']);

      const scenes = (Array.isArray(parsed.scenes) ? parsed.scenes : [])
        .slice(0, 6)
        .map((sc, idx) => ({
          title: String(sc.title || `0${idx + 1} · Scene ${idx + 1}`).trim().slice(0, 80),
          headline: String(sc.headline || videoTitle).trim().slice(0, 120),
          caption: String(sc.caption || '').trim().slice(0, 260),
          metricLabel: String(sc.metricLabel || 'WALKTHROUGH').trim().slice(0, 48),
          metricValue: String(sc.metricValue || `Step ${idx + 1}`).trim().slice(0, 48),
          durationSec: Math.max(3, Math.min(8, Number(sc.durationSec) || 4.5)),
          accent: validAccents.has(String(sc.accent || ''))
            ? String(sc.accent)
            : (['amber', 'sky', 'emerald', 'violet'][idx % 4] as string),
          visualType: validVisuals.has(String(sc.visualType || ''))
            ? String(sc.visualType)
            : visualPreset,
        }));

      if (scenes.length === 0) {
        res.status(502).json({ error: 'AI returned an empty storyboard. Please refine your prompt and retry.' });
        return;
      }

      res.json({
        script: String(parsed.script || existingScript || userPrompt).trim().slice(0, 1200),
        caption: {
          en: String(parsed.caption?.en || scenes[0].caption || videoTitle).trim().slice(0, 320),
          hi: String(parsed.caption?.hi || parsed.caption?.en || videoTitle).trim().slice(0, 320),
          es: String(parsed.caption?.es || parsed.caption?.en || videoTitle).trim().slice(0, 320),
        },
        scenes,
        aiUpdatedAtIso: new Date().toISOString(),
        model: MODEL_NAME,
      });
    } catch (err) {
      const errorObj = err as Error & { statusCode?: number; code?: string };
      const status = errorObj.statusCode || 500;
      res.status(status).json({
        error:
          errorObj.message ||
          'Failed to generate AI motion storyboard. Verify your Gemini API key in Settings > Secrets.',
        code: errorObj.code || 'AI_MOTION_FAILED',
      });
    }
  });

  const distDir = path.resolve(__dirname, 'dist');
  const hasDistBuild = fs.existsSync(path.join(distDir, 'index.html'));
  const isProd =
    process.env.NODE_ENV === 'production' ||
    (process.env.npm_lifecycle_event === 'start' && hasDistBuild);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);

    // Background Auto-Publisher: pre-warm and periodically publish fresh Forex & Crypto market news
    if (process.env.GEMINI_API_KEY?.trim()) {
      void getOrPublishMarketNews(false).catch((err) => {
        console.warn(
          'Initial auto-publish warm-up deferred:',
          err instanceof Error ? err.message : String(err)
        );
      });

      setInterval(() => {
        void getOrPublishMarketNews(true).catch((err) => {
          console.warn(
            'Scheduled auto-publish cycle deferred:',
            err instanceof Error ? err.message : String(err)
          );
        });
      }, AUTO_POST_INTERVAL_MS);
    }
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
