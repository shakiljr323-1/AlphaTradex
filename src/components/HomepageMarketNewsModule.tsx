import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Clock,
  Coins,
  ExternalLink,
  Globe,
  Minus,
  Newspaper,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  fetchMarketNews,
  formatRelativeTime,
  getCachedMarketNews,
  MarketNewsFeedResponse,
  MarketSentimentBias,
} from '../lib/marketNewsApi';

interface HomepageMarketNewsModuleProps {
  onOpenForexNews: () => void;
}

function formatCountdown(targetIso: string, nowMs: number): string {
  const targetMs = Date.parse(targetIso || '');
  if (!Number.isFinite(targetMs)) return '20:00';
  const remainingSec = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
  const mins = Math.floor(remainingSec / 60);
  const secs = remainingSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function SentimentIcon({ bias }: { bias: MarketSentimentBias }) {
  if (bias === 'BULLISH') {
    return <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-label="Bullish" />;
  }
  if (bias === 'BEARISH') {
    return <TrendingDown className="w-3.5 h-3.5 text-rose-400 shrink-0" aria-label="Bearish" />;
  }
  return <Minus className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-label="Neutral" />;
}

export const HomepageMarketNewsModule: React.FC<HomepageMarketNewsModuleProps> = ({
  onOpenForexNews,
}) => {
  const [feed, setFeed] = useState<MarketNewsFeedResponse | null>(() => getCachedMarketNews());
  const [loading, setLoading] = useState<boolean>(() => !getCachedMarketNews());
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const loadFeed = useCallback(async (force = false) => {
    setErrorMsg('');
    if (force) {
      setRefreshing(true);
    } else if (!getCachedMarketNews()) {
      setLoading(true);
    }
    try {
      const data = await fetchMarketNews(force);
      setFeed(data);
    } catch (err: unknown) {
      setErrorMsg((err as Error)?.message || 'Unable to load live market intelligence feed.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadFeed(false);
  }, [loadFeed]);

  // Countdown tick & automatic refresh when server auto-post window elapses
  useEffect(() => {
    const interval = window.setInterval(() => {
      const current = Date.now();
      setNowMs(current);
      if (feed?.nextAutoPostAtIso) {
        const nextMs = Date.parse(feed.nextAutoPostAtIso);
        if (Number.isFinite(nextMs) && current >= nextMs + 2500 && !refreshing) {
          void loadFeed(false);
        }
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [feed?.nextAutoPostAtIso, loadFeed, refreshing]);

  const tickerItems = feed?.tickerHeadlines ?? [];
  const featuredSentiment = (feed?.sentimentPairs ?? []).slice(0, 4);
  const latestHeadlines = (feed?.articles ?? []).slice(0, 3);

  return (
    <section
      aria-label="Daily Crypto, AI Trading & Forex Market Trends"
      className="space-y-4"
    >
      {/* 1. Live Scrolling Breaking News Ticker */}
      <div className="rounded-xl bg-[#080D19]/92 backdrop-blur-md border border-slate-700/80 overflow-hidden shadow-lg">
        <div className="flex items-stretch">
          <button
            type="button"
            onClick={onOpenForexNews}
            className="px-3.5 py-2.5 bg-gradient-to-r from-amber-600/90 to-orange-600/90 hover:from-amber-500 hover:to-orange-500 text-white text-[11px] font-mono font-bold uppercase tracking-wider flex items-center gap-2 shrink-0 transition-colors"
          >
            <Newspaper className="w-3.5 h-3.5" />
            <span>Market Wire</span>
          </button>

          <div className="flex-1 overflow-hidden flex items-center min-w-0 py-2">
            {loading && !feed ? (
              <div className="px-4 text-xs font-mono text-slate-400">
                Synthesizing live Forex, Crypto &amp; AI Trading market trends...
              </div>
            ) : errorMsg && !feed ? (
              <div className="px-4 text-xs text-rose-300 flex items-center gap-2 truncate">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{errorMsg}</span>
              </div>
            ) : tickerItems.length > 0 ? (
              <div className="animate-ticker-scroll flex items-center">
                {[0, 1].map((dupIdx) => (
                  <div key={dupIdx} className="flex items-center shrink-0">
                    {tickerItems.map((item) => (
                      <button
                        key={`${dupIdx}-${item.id}`}
                        type="button"
                        onClick={onOpenForexNews}
                        className="inline-flex items-center gap-2 px-4 border-r border-slate-800 text-xs hover:text-amber-300 transition-colors whitespace-nowrap"
                      >
                        <SentimentIcon bias={item.sentiment} />
                        <span className="font-mono font-bold text-amber-300">
                          {item.symbol}
                        </span>
                        <span className="text-slate-200">{item.headline}</span>
                        <span
                          className={`text-[10px] font-mono font-semibold uppercase ${
                            item.impact === 'HIGH'
                              ? 'text-rose-400'
                              : item.impact === 'MEDIUM'
                              ? 'text-amber-400'
                              : 'text-slate-400'
                          }`}
                        >
                          [{item.market === 'AI_TRADING' ? 'AI' : item.market}]
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 text-xs font-mono text-slate-400">
                Connecting to real-time market news wire...
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenForexNews}
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 text-[11px] font-mono font-semibold text-amber-300 hover:text-white border-l border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 transition-colors shrink-0"
          >
            <span>Forex News</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Daily Crypto, AI Trading & Forex Market Trends Briefing Module */}
      <div className="bg-[#0B111E]/82 backdrop-blur-md border border-slate-700/75 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-800/90">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-wider text-amber-400">
              <Activity className="w-3.5 h-3.5" />
              <span>Daily Market Intelligence · Auto-Posted Every 20m</span>
              {feed && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-400 normal-case font-normal">
                    Updated {formatRelativeTime(feed.lastAutoPostAtIso)}
                  </span>
                </>
              )}
            </div>
            <h2 className="font-display font-bold text-white text-xl sm:text-2xl tracking-tight leading-snug">
              {feed?.dailyBriefing?.headline ||
                'Daily Crypto, AI Trading & Global Forex Market Summary'}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {feed && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700/80 text-[11px] font-mono text-slate-300 tabular-nums">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Next auto-post: {formatCountdown(feed.nextAutoPostAtIso, nowMs)}</span>
              </div>
            )}
            <button
              type="button"
              disabled={refreshing || loading}
              onClick={() => void loadFeed(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900/85 hover:border-amber-500/60 hover:text-white text-slate-200 text-xs font-semibold transition-colors disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Updating...' : 'Refresh'}</span>
            </button>
            <button
              type="button"
              onClick={onOpenForexNews}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold transition-colors"
            >
              <span>Full Forex News Desk</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Loading Skeleton */}
        {loading && !feed && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
            {[0, 1, 2].map((idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-900/75 border border-slate-800 space-y-2.5"
              >
                <div className="h-3.5 w-28 bg-slate-800 rounded" />
                <div className="h-3 w-full bg-slate-800/80 rounded" />
                <div className="h-3 w-4/5 bg-slate-800/80 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Honest Error State (no fake fallback) */}
        {errorMsg && !feed && !loading && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 flex flex-wrap items-center justify-between gap-3 text-xs text-rose-200">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-semibold text-white">Live Market Feed Unavailable</div>
                <p className="text-rose-200/90">{errorMsg}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadFeed(true)}
              className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold transition-colors"
            >
              Retry Live Sync
            </button>
          </div>
        )}

        {/* Live Data View */}
        {feed && (
          <div className="space-y-5">
            {errorMsg && (
              <div className="p-3 rounded-lg bg-amber-950/50 border border-amber-500/40 text-xs text-amber-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              {feed.dailyBriefing?.summary}
            </p>

            {/* 3-Column Daily Trends Cards: Crypto / AI Trading / Forex */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/75 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono font-semibold text-amber-400">
                  <span className="inline-flex items-center gap-1.5">
                    <Coins className="w-4 h-4" />
                    CRYPTO MARKET TREND
                  </span>
                  <span className="text-[10px] text-slate-400">24H DESK</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {feed.dailyBriefing?.cryptoTrend}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/75 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono font-semibold text-sky-400">
                  <span className="inline-flex items-center gap-1.5">
                    <Bot className="w-4 h-4" />
                    AI TRADING OUTLOOK
                  </span>
                  <span className="text-[10px] text-slate-400">
                    VOL: {feed.dailyBriefing?.volatilityLevel || 'MODERATE'}
                  </span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {feed.dailyBriefing?.aiTradingOutlook}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/75 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono font-semibold text-emerald-400">
                  <span className="inline-flex items-center gap-1.5">
                    <Globe className="w-4 h-4" />
                    FOREX &amp; MACRO TREND
                  </span>
                  <span className="text-[10px] text-slate-400">FX PAIRS</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {feed.dailyBriefing?.forexTrend}
                </p>
              </div>
            </div>

            {/* Compact Myfxbook-Style Market Sentiment Strip */}
            {featuredSentiment.length > 0 && (
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                    Live Community &amp; Desk Sentiment Outlook (Long vs Short)
                  </span>
                  <button
                    type="button"
                    onClick={onOpenForexNews}
                    className="text-[11px] font-mono font-semibold text-amber-400 hover:text-amber-300"
                  >
                    View all {(feed.sentimentPairs ?? []).length} pairs →
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {featuredSentiment.map((pair) => (
                    <button
                      key={pair.symbol}
                      type="button"
                      onClick={onOpenForexNews}
                      className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 text-left space-y-2 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-sm text-white">
                          {pair.symbol}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-mono font-semibold ${
                            pair.netBias === 'BULLISH'
                              ? 'text-emerald-400'
                              : pair.netBias === 'BEARISH'
                              ? 'text-rose-400'
                              : 'text-slate-300'
                          }`}
                        >
                          <SentimentIcon bias={pair.netBias} />
                          <span>{pair.netBias}</span>
                        </span>
                      </div>

                      <div className="h-2 w-full rounded-sm overflow-hidden flex bg-slate-800">
                        <div
                          className="h-full bg-emerald-500"
                          style={{ width: `${pair.longPercent}%` }}
                        />
                        <div
                          className="h-full bg-rose-500"
                          style={{ width: `${pair.shortPercent}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                        <span className="text-emerald-400 font-semibold">
                          Long {pair.longPercent}%
                        </span>
                        <span className="text-rose-400 font-semibold">
                          Short {pair.shortPercent}%
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Latest 3 Auto-Posted Headlines Preview */}
            {latestHeadlines.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                {latestHeadlines.map((art) => (
                  <button
                    key={art.id}
                    type="button"
                    onClick={onOpenForexNews}
                    className="p-3.5 rounded-xl bg-[#070B14]/85 border border-slate-800/90 hover:border-amber-500/45 text-left space-y-1.5 transition-colors flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                        <span className="text-amber-400 font-semibold">
                          {art.category === 'AI_TRADING' ? 'AI TRADING' : art.category}
                        </span>
                        <span className="text-slate-400">
                          {formatRelativeTime(art.publishedAtIso)}
                        </span>
                      </div>
                      <div className="font-display font-semibold text-sm text-white line-clamp-2 leading-snug">
                        {art.title}
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {art.summary}
                      </p>
                    </div>
                    <div className="pt-2 flex items-center justify-between text-[11px] font-mono">
                      <span className="inline-flex items-center gap-1 text-slate-300">
                        <SentimentIcon bias={art.sentiment} />
                        <span>{art.symbols.slice(0, 2).join(' · ') || 'GLOBAL'}</span>
                      </span>
                      <span className="text-amber-400">Read →</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Verified Grounding Sources Footer */}
            {(feed.groundingSources ?? []).length > 0 && (
              <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-400">
                  <span className="font-mono uppercase tracking-wider text-slate-500">
                    Sources:
                  </span>
                  {(feed.groundingSources ?? []).slice(0, 4).map((src) => (
                    <a
                      key={src.uri}
                      href={src.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-slate-300 hover:text-amber-300 transition-colors"
                    >
                      <span className="truncate max-w-[180px]">{src.title}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ))}
                </div>
                <span className="font-mono text-slate-500 tabular-nums">
                  Auto-Posts Published: #{feed.publishCount}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
