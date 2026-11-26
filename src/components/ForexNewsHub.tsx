import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Coins,
  ExternalLink,
  Globe,
  Minus,
  Newspaper,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  fetchMarketNews,
  formatRelativeTime,
  getCachedMarketNews,
  MarketCategory,
  MarketImpactLevel,
  MarketNewsFeedResponse,
  MarketSentimentBias,
} from '../lib/marketNewsApi';

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
    return <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
  }
  if (bias === 'BEARISH') {
    return <TrendingDown className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
  }
  return <Minus className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
}

function impactTextClass(impact: MarketImpactLevel): string {
  if (impact === 'HIGH') return 'text-rose-400 border-rose-500/40 bg-rose-950/50';
  if (impact === 'MEDIUM') return 'text-amber-300 border-amber-500/40 bg-amber-950/50';
  return 'text-slate-300 border-slate-700 bg-slate-900/70';
}

export const ForexNewsHub: React.FC = () => {
  const [feed, setFeed] = useState<MarketNewsFeedResponse | null>(() => getCachedMarketNews());
  const [loading, setLoading] = useState<boolean>(() => !getCachedMarketNews());
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const [categoryFilter, setCategoryFilter] = useState<'ALL' | MarketCategory>('ALL');
  const [impactFilter, setImpactFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM'>('ALL');
  const [sentimentTab, setSentimentTab] = useState<'ALL' | 'FOREX' | 'CRYPTO'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedArticleId, setExpandedArticleId] = useState<string | null>(null);

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
      setErrorMsg((err as Error)?.message || 'Failed to load live Forex & Crypto news feed.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadFeed(false);
  }, [loadFeed]);

  // Countdown tick + auto-sync when server publishes the next scheduled edition
  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNowMs(current);
      if (feed?.nextAutoPostAtIso) {
        const nextMs = Date.parse(feed.nextAutoPostAtIso);
        if (Number.isFinite(nextMs) && current >= nextMs + 2500 && !refreshing) {
          void loadFeed(false);
        }
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [feed?.nextAutoPostAtIso, loadFeed, refreshing]);

  const filteredArticles = useMemo(() => {
    const list = feed?.articles ?? [];
    const q = searchQuery.trim().toLowerCase();
    return list.filter((art) => {
      if (categoryFilter !== 'ALL' && art.category !== categoryFilter) return false;
      if (impactFilter !== 'ALL' && art.impact !== impactFilter) return false;
      if (q) {
        const haystack = `${art.title} ${art.summary} ${art.analysis} ${art.symbols.join(' ')} ${art.sourceName}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [feed?.articles, categoryFilter, impactFilter, searchQuery]);

  const filteredSentiment = useMemo(() => {
    const list = feed?.sentimentPairs ?? [];
    if (sentimentTab === 'ALL') return list;
    if (sentimentTab === 'FOREX') {
      return list.filter((p) => p.market === 'FOREX' || p.market === 'COMMODITY');
    }
    return list.filter((p) => p.market === 'CRYPTO');
  }, [feed?.sentimentPairs, sentimentTab]);

  const categoryCounts = useMemo(() => {
    const list = feed?.articles ?? [];
    return {
      ALL: list.length,
      FOREX: list.filter((a) => a.category === 'FOREX').length,
      CRYPTO: list.filter((a) => a.category === 'CRYPTO').length,
      AI_TRADING: list.filter((a) => a.category === 'AI_TRADING').length,
      MACRO: list.filter((a) => a.category === 'MACRO').length,
    };
  }, [feed?.articles]);

  const tickerItems = feed?.tickerHeadlines ?? [];

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="bg-[#0B111E]/88 backdrop-blur-md border border-slate-700/75 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-amber-400 uppercase tracking-wider">
              <Newspaper className="w-4 h-4" />
              <span>Myfxbook-Style Market Wire · Auto-Publishing Engine</span>
            </div>
            <h1 className="font-display font-extrabold text-white text-2xl sm:text-3xl tracking-tight">
              Forex, Crypto &amp; AI Market News Desk
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
              Live auto-posted Forex pairs news, Crypto &amp; AI trading desk trends, Long/Short community sentiment bars, and high-impact economic calendar events.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs font-mono text-slate-200 space-y-0.5 tabular-nums">
              <div className="text-[10px] text-slate-400 uppercase">Next Auto-Post</div>
              <div className="flex items-center gap-1.5 font-bold text-amber-300">
                <Clock className="w-3.5 h-3.5" />
                <span>{feed ? formatCountdown(feed.nextAutoPostAtIso, nowMs) : '--:--'}</span>
                <span className="text-slate-500 font-normal">
                  / {feed?.autoPostIntervalMinutes ?? 20}m
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={refreshing || loading}
              onClick={() => void loadFeed(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-60 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors shadow-md"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Auto-Posting...' : 'Auto-Post Fresh Update'}</span>
            </button>
          </div>
        </div>

        {/* Auto-Publish Telemetry Strip */}
        {feed && (
          <div className="pt-3 border-t border-slate-800/90 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-400">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>
                Last Auto-Post:{' '}
                <strong className="text-slate-200">{formatRelativeTime(feed.lastAutoPostAtIso)}</strong>
              </span>
              <span>
                Edition:{' '}
                <strong className="text-amber-300 tabular-nums">#{feed.publishCount}</strong>
              </span>
              <span>
                Desk Volatility:{' '}
                <strong className="text-white">{feed.dailyBriefing?.volatilityLevel || 'MODERATE'}</strong>
              </span>
            </div>
            <span className="tabular-nums">
              {(feed.articles ?? []).length} Auto-Published Stories · {(feed.sentimentPairs ?? []).length} Sentiment Pairs
            </span>
          </div>
        )}
      </div>

      {/* Breaking News Ticker */}
      {tickerItems.length > 0 && (
        <div className="rounded-xl bg-[#080D19]/92 border border-slate-700/80 overflow-hidden shadow-lg">
          <div className="flex items-stretch">
            <div className="px-3.5 py-2 bg-amber-500/15 border-r border-slate-800 text-[11px] font-mono font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5 shrink-0">
              <Activity className="w-3.5 h-3.5" />
              <span>Breaking</span>
            </div>
            <div className="flex-1 overflow-hidden py-2">
              <div className="animate-ticker-scroll flex items-center">
                {[0, 1].map((dup) => (
                  <div key={dup} className="flex items-center shrink-0">
                    {tickerItems.map((item) => (
                      <div
                        key={`${dup}-${item.id}`}
                        className="inline-flex items-center gap-2 px-4 border-r border-slate-800 text-xs whitespace-nowrap"
                      >
                        <SentimentIcon bias={item.sentiment} />
                        <span className="font-mono font-bold text-amber-300">{item.symbol}</span>
                        <span className="text-slate-200">{item.headline}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Honest Error Banner */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-950/45 border border-rose-500/45 flex flex-wrap items-center justify-between gap-3 text-xs text-rose-200">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-white">Market News Sync Notice</div>
              <p className="text-rose-200/90 mt-0.5">{errorMsg}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadFeed(true)}
            className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold transition-colors"
          >
            Retry Now
          </button>
        </div>
      )}

      {/* Initial Loading State */}
      {loading && !feed ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-pulse">
          <div className="lg:col-span-8 space-y-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-5 rounded-2xl bg-[#0B111E]/80 border border-slate-800 space-y-3"
              >
                <div className="h-4 w-36 bg-slate-800 rounded" />
                <div className="h-5 w-4/5 bg-slate-800 rounded" />
                <div className="h-3.5 w-full bg-slate-800/80 rounded" />
                <div className="h-3.5 w-2/3 bg-slate-800/80 rounded" />
              </div>
            ))}
          </div>
          <div className="lg:col-span-4 space-y-4">
            <div className="p-5 rounded-2xl bg-[#0B111E]/80 border border-slate-800 h-80" />
            <div className="p-5 rounded-2xl bg-[#0B111E]/80 border border-slate-800 h-60" />
          </div>
        </div>
      ) : feed ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT 8 COLUMNS: Auto-Posted News Stream */}
          <div className="lg:col-span-8 space-y-4">
            {/* Daily Briefing Banner */}
            <div className="bg-[#0B111E]/85 border border-amber-500/30 rounded-2xl p-5 space-y-3 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-amber-400">
                  Daily Market Briefing · Crypto, AI Trading &amp; Forex
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {formatRelativeTime(feed.dailyBriefing?.publishedAtIso || feed.lastAutoPostAtIso)}
                </span>
              </div>
              <h2 className="font-display font-bold text-white text-lg sm:text-xl leading-snug">
                {feed.dailyBriefing?.headline ||
                  'Daily Crypto, AI Trading & Global Forex Market Summary'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {feed.dailyBriefing?.summary}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold text-emerald-400">
                    <Globe className="w-3.5 h-3.5" />
                    <span>FOREX DESK</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {feed.dailyBriefing?.forexTrend}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold text-amber-400">
                    <Coins className="w-3.5 h-3.5" />
                    <span>CRYPTO DESK</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {feed.dailyBriefing?.cryptoTrend}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold text-sky-400">
                    <Bot className="w-3.5 h-3.5" />
                    <span>AI TRADING</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {feed.dailyBriefing?.aiTradingOutlook}
                  </p>
                </div>
              </div>

              {(feed.dailyBriefing?.keyDrivers ?? []).length > 0 && (
                <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="font-mono text-slate-400 uppercase">Key Drivers:</span>
                  {(feed.dailyBriefing?.keyDrivers ?? []).map((driver, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-700/80 text-slate-200"
                    >
                      {driver}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-[#0B111E]/85 border border-slate-700/75 rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: 'ALL', label: 'All News' },
                      { id: 'FOREX', label: 'Forex' },
                      { id: 'CRYPTO', label: 'Crypto' },
                      { id: 'AI_TRADING', label: 'AI Trading' },
                      { id: 'MACRO', label: 'Macro' },
                    ] as const
                  ).map((tab) => {
                    const active = categoryFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setCategoryFilter(tab.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                          active
                            ? 'bg-amber-500/20 border-amber-400/70 text-amber-200'
                            : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white'
                        }`}
                      >
                        {tab.label}{' '}
                        <span className="font-mono text-[11px] opacity-75 tabular-nums">
                          ({categoryCounts[tab.id]})
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1.5">
                  {(['ALL', 'HIGH', 'MEDIUM'] as const).map((imp) => (
                    <button
                      key={imp}
                      type="button"
                      onClick={() => setImpactFilter(imp)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold border transition-colors ${
                        impactFilter === imp
                          ? 'bg-slate-800 border-amber-400/70 text-amber-300'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {imp === 'ALL' ? 'All Impact' : `${imp}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search pair, ticker, or headline (e.g. EUR/USD, XAU/USD, BTC, Fed, SOL)..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-700/80 bg-slate-900/90 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Auto-Posted News Cards */}
            <div className="space-y-3.5">
              {filteredArticles.length === 0 ? (
                <div className="p-8 rounded-2xl bg-[#0B111E]/80 border border-slate-800 text-center space-y-2">
                  <div className="font-display font-bold text-white text-base">
                    No matching articles found
                  </div>
                  <p className="text-xs text-slate-400">
                    Try clearing your search filter or switch to All News.
                  </p>
                </div>
              ) : (
                filteredArticles.map((art) => {
                  const isExpanded = expandedArticleId === art.id;
                  return (
                    <article
                      key={art.id}
                      className="bg-[#0B111E]/85 backdrop-blur-md border border-slate-700/75 hover:border-amber-500/45 rounded-2xl p-5 shadow-xl space-y-3 transition-colors"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded border border-amber-500/40 bg-amber-950/40 text-amber-300 font-semibold">
                            {art.category === 'AI_TRADING' ? 'AI TRADING' : art.category}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded border font-semibold ${impactTextClass(
                              art.impact
                            )}`}
                          >
                            {art.impact} IMPACT
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 font-semibold ${
                              art.sentiment === 'BULLISH'
                                ? 'text-emerald-400'
                                : art.sentiment === 'BEARISH'
                                ? 'text-rose-400'
                                : 'text-slate-300'
                            }`}
                          >
                            <SentimentIcon bias={art.sentiment} />
                            <span>{art.sentiment}</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-slate-400">
                          {art.autoPosted && (
                            <span className="text-emerald-400/90">Auto-Posted</span>
                          )}
                          <span>·</span>
                          <span>{formatRelativeTime(art.publishedAtIso)}</span>
                        </div>
                      </div>

                      <h3 className="font-display font-bold text-white text-base sm:text-lg leading-snug">
                        {art.title}
                      </h3>

                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                        {art.summary}
                      </p>

                      {isExpanded && art.analysis && (
                        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
                          <div className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-semibold">
                            Desk Technical &amp; Macro Analysis
                          </div>
                          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                            {art.analysis}
                          </p>
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {art.symbols.map((sym) => (
                            <span
                              key={sym}
                              className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700/80 font-mono text-[11px] text-slate-200 font-semibold"
                            >
                              {sym}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center gap-3 text-xs">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedArticleId(isExpanded ? null : art.id)
                            }
                            className="inline-flex items-center gap-1 font-semibold text-amber-400 hover:text-amber-300 transition-colors"
                          >
                            <span>{isExpanded ? 'Hide Analysis' : 'Full Analysis'}</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {art.sourceUrl ? (
                            <a
                              href={art.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
                            >
                              <span className="truncate max-w-[140px]">{art.sourceName}</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          ) : (
                            <span className="text-slate-500 font-mono text-[11px]">
                              {art.sourceName}
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT 4 COLUMNS: Myfxbook-Style Market Sentiment + Economic Calendar + Sources */}
          <aside className="lg:col-span-4 space-y-5">
            {/* 1. Myfxbook-Style Community & Market Sentiment Outlook */}
            <div className="bg-[#0B111E]/88 backdrop-blur-md border border-slate-700/75 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-display font-bold text-white text-base">
                    Market Sentiment Outlook
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Myfxbook-style Long vs Short positioning
                  </p>
                </div>
                <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono">
                  {(['ALL', 'FOREX', 'CRYPTO'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setSentimentTab(tab)}
                      className={`px-2 py-1 rounded transition-colors ${
                        sentimentTab === tab
                          ? 'bg-amber-500/20 text-amber-300 font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3.5">
                {filteredSentiment.map((pair) => (
                  <div
                    key={pair.symbol}
                    className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-bold text-sm text-white">
                          {pair.symbol}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 uppercase">
                          {pair.market}
                        </span>
                      </div>
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

                    {/* Dual Green/Red Sentiment Bar */}
                    <div className="h-2.5 w-full rounded-sm overflow-hidden flex bg-slate-800">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${pair.longPercent}%` }}
                        title={`Long ${pair.longPercent}%`}
                      />
                      <div
                        className="h-full bg-rose-500 transition-all"
                        style={{ width: `${pair.shortPercent}%` }}
                        title={`Short ${pair.shortPercent}%`}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                      <span className="text-emerald-400 font-semibold">
                        Long {pair.longPercent}%
                      </span>
                      <span className="text-slate-400">Lvl: {pair.keyLevel}</span>
                      <span className="text-rose-400 font-semibold">
                        Short {pair.shortPercent}%
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {pair.momentumNote}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Economic & Macro Calendar */}
            <div className="bg-[#0B111E]/88 backdrop-blur-md border border-slate-700/75 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-400" />
                  <h2 className="font-display font-bold text-white text-base">
                    Economic Calendar
                  </h2>
                </div>
                <span className="text-[11px] font-mono text-slate-400">UTC Watchlist</span>
              </div>

              <div className="space-y-2.5">
                {(feed.economicEvents ?? []).map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-300">{ev.currency}</span>
                        <span className="text-slate-400">{ev.timeUtc}</span>
                      </div>
                      <span
                        className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${impactTextClass(
                          ev.impact
                        )}`}
                      >
                        {ev.impact}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-white">{ev.event}</div>
                    <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400 tabular-nums">
                      <span>
                        Fcst: <strong className="text-slate-200">{ev.forecast}</strong>
                      </span>
                      <span>
                        Prev: <strong className="text-slate-200">{ev.previous}</strong>
                      </span>
                    </div>
                    {ev.marketNote && (
                      <p className="text-[11px] text-slate-400 leading-snug">{ev.marketNote}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Verified Live Grounding Sources */}
            {(feed.groundingSources ?? []).length > 0 && (
              <div className="bg-[#0B111E]/88 backdrop-blur-md border border-slate-700/75 rounded-2xl p-5 shadow-xl space-y-3">
                <h2 className="font-display font-bold text-white text-sm">
                  Verified Market Sources
                </h2>
                <div className="space-y-2">
                  {(feed.groundingSources ?? []).map((src) => (
                    <a
                      key={src.uri}
                      href={src.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-900/75 border border-slate-800 hover:border-amber-500/50 text-xs text-slate-200 hover:text-amber-200 transition-colors"
                    >
                      <span className="truncate">{src.title}</span>
                      <ExternalLink className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      ) : null}
    </div>
  );
};
