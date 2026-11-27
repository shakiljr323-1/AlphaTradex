import React, { useMemo, useState } from 'react';
import {
  ArrowDownUp,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Flame,
  Globe,
  Link2,
  Lock,
  Plus,
  Rocket,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react';
import { CURATED_SHOWCASE_LAUNCHPAD_TOKENS, DEFAULT_MEME_LAUNCHPAD_CONFIG } from '../constants/defaults';
import { usePlatform } from '../context/PlatformContext';
import { MemeLaunchpadChain, MemeLaunchpadToken } from '../types/platform';
import { compressImageToDataUrl } from '../utils/investmentMath';

interface MemeLaunchpadViewProps {
  compactPreview?: boolean;
  onOpenFullPage?: () => void;
  onRequireAuth?: () => void;
}

type DiscoveryFilter = 'trending' | 'new' | 'graduating' | 'completed';

const ACCENT_PRESETS = ['#f59e0b', '#10b981', '#38bdf8', '#a855f7', '#fb7185', '#14b8a6'];

function shortenAddress(addr: string): string {
  if (!addr) return 'alphatradex.pro';
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-5)}`;
}

function formatCompactUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function isSafeHttpUrl(url?: string): boolean {
  return Boolean(url && /^https?:\/\//i.test(url.trim()));
}

function getBlockExplorerUrl(chain: MemeLaunchpadChain, contractAddress: string): string {
  const clean = encodeURIComponent(contractAddress.trim());
  return chain === 'BSC'
    ? `https://bscscan.com/token/${clean}`
    : `https://solscan.io/token/${clean}`;
}

const TokenAvatar: React.FC<{ token: Pick<MemeLaunchpadToken, 'ticker' | 'name' | 'logoUrl' | 'accentColor'>; size?: 'sm' | 'md' | 'lg' }> = ({
  token,
  size = 'md',
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const dims = size === 'lg' ? 'h-14 w-14 text-base' : size === 'sm' ? 'h-9 w-9 text-xs' : 'h-11 w-11 text-sm';
  const showImage = Boolean(token.logoUrl && !imgFailed);

  if (showImage) {
    return (
      <img
        src={token.logoUrl}
        alt={`${token.name} logo`}
        onError={() => setImgFailed(true)}
        className={`${dims} shrink-0 rounded-xl object-cover border border-slate-700/80 bg-slate-900`}
      />
    );
  }

  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${token.accentColor || '#f59e0b'}33, ${token.accentColor || '#f59e0b'}12)`,
        borderColor: `${token.accentColor || '#f59e0b'}55`,
      }}
      className={`${dims} shrink-0 rounded-xl border flex items-center justify-center font-mono font-bold tracking-tight text-slate-100`}
    >
      {token.ticker.slice(0, 4)}
    </div>
  );
};

export const MemeLaunchpadView: React.FC<MemeLaunchpadViewProps> = ({
  compactPreview = false,
  onOpenFullPage,
  onRequireAuth,
}) => {
  const {
    authUser,
    userProfile,
    platformConfig,
    launchpadTokens,
    launchpadTrades,
    launchMemeToken,
    tradeMemeLaunchpadToken,
  } = usePlatform();

  const lpConfig = platformConfig.memeLaunchpadConfig || DEFAULT_MEME_LAUNCHPAD_CONFIG;

  const [category, setCategory] = useState<DiscoveryFilter>('trending');
  const [chainFilter, setChainFilter] = useState<'ALL' | MemeLaunchpadChain>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Selected token detail & bonding curve trade modal
  const [selectedToken, setSelectedToken] = useState<MemeLaunchpadToken | null>(null);
  const [tradeSide, setTradeSide] = useState<'buy' | 'sell'>('buy');
  const [tradeUsdInput, setTradeUsdInput] = useState('50');
  const [tradeSubmitting, setTradeSubmitting] = useState(false);
  const [tradeFeedback, setTradeFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  // Create / Launch Meme Token modal
  const [launchModalOpen, setLaunchModalOpen] = useState(false);
  const [tokenName, setTokenName] = useState('');
  const [tokenTicker, setTokenTicker] = useState('');
  const [tokenChain, setTokenChain] = useState<MemeLaunchpadChain>('Solana');
  const [tokenDescription, setTokenDescription] = useState('');
  const [tokenLogoUrl, setTokenLogoUrl] = useState('');
  const [tokenAccent, setTokenAccent] = useState('#f59e0b');
  const [telegramUrl, setTelegramUrl] = useState('');
  const [twitterUrl, setTwitterUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [creatorAddress, setCreatorAddress] = useState('');
  const [initialBuyUsd, setInitialBuyUsd] = useState('50');
  const [lockDays, setLockDays] = useState(String(lpConfig.defaultLockDays || 365));
  const [launchSubmitting, setLaunchSubmitting] = useState(false);
  const [launchFeedback, setLaunchFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  // Admin-configured custom meme coin smart contract registry (non-paused)
  const publishedCustomContracts = useMemo(
    () => (lpConfig.customContracts || []).filter((c) => c.deploymentStatus !== 'paused'),
    [lpConfig.customContracts]
  );

  const visibleCustomContracts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return publishedCustomContracts.filter((entry) => {
      if (chainFilter !== 'ALL' && entry.network !== chainFilter) return false;
      if (!q) return true;
      return (
        entry.tokenName.toLowerCase().includes(q) ||
        entry.ticker.toLowerCase().includes(q) ||
        entry.contractAddress.toLowerCase().includes(q) ||
        (entry.dexName || '').toLowerCase().includes(q)
      );
    });
  }, [publishedCustomContracts, chainFilter, searchQuery]);

  // Merge live Firestore tokens with curated showcase launches (deduplicated by ticker)
  // and enrich with any matching admin LaunchpadConfig contract entry
  const combinedTokens = useMemo(() => {
    const liveTickers = new Set(launchpadTokens.map((t) => t.ticker.toUpperCase()));
    const merged = [
      ...launchpadTokens,
      ...CURATED_SHOWCASE_LAUNCHPAD_TOKENS.filter((s) => !liveTickers.has(s.ticker.toUpperCase())),
    ];
    if (publishedCustomContracts.length === 0) return merged;

    return merged.map((tok) => {
      if (tok.dexListingStatus === 'listed' && tok.contractAddress?.trim()) return tok;
      const match = publishedCustomContracts.find(
        (c) =>
          c.ticker.toUpperCase() === tok.ticker.toUpperCase() &&
          c.network === tok.chain
      );
      if (!match) return tok;
      return {
        ...tok,
        dexListingStatus: match.deploymentStatus === 'listed' ? ('listed' as const) : ('pending' as const),
        contractAddress: match.contractAddress || tok.contractAddress || '',
        dexName: match.dexName || tok.dexName || '',
        dexPairUrl: match.dexPairUrl || tok.dexPairUrl || '',
      };
    });
  }, [launchpadTokens, publishedCustomContracts]);

  // Keep selectedToken synced if live snapshot updates
  const activeModalToken = useMemo(() => {
    if (!selectedToken) return null;
    return combinedTokens.find((t) => t.id === selectedToken.id) || selectedToken;
  }, [selectedToken, combinedTokens]);

  const filteredTokens = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = combinedTokens.filter((t) => t.status !== 'delisted');
    if (chainFilter !== 'ALL') {
      list = list.filter((t) => t.chain === chainFilter);
    }
    if (q) {
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.ticker.toLowerCase().includes(q) ||
          t.creatorAddress.toLowerCase().includes(q) ||
          t.creatorHandle.toLowerCase().includes(q)
      );
    }

    if (category === 'trending') {
      list = [...list].sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return b.volume24hUsd - a.volume24hUsd;
      });
    } else if (category === 'new') {
      list = list.filter((t) => t.status === 'live' || t.status === 'upcoming');
    } else if (category === 'graduating') {
      list = list
        .filter((t) => t.status === 'live' && t.progressPercent >= 40 && t.progressPercent < 100)
        .sort((a, b) => b.progressPercent - a.progressPercent);
    } else if (category === 'completed') {
      list = list.filter((t) => t.status === 'graduated' || t.progressPercent >= 100);
    }

    return compactPreview ? list.slice(0, 3) : list;
  }, [combinedTokens, chainFilter, searchQuery, category, compactPreview]);

  const totalVolume24h = useMemo(
    () => combinedTokens.reduce((sum, t) => sum + (t.volume24hUsd || 0), 0),
    [combinedTokens]
  );
  const liveCount = useMemo(
    () => combinedTokens.filter((t) => t.status === 'live').length,
    [combinedTokens]
  );

  const handleCopyAddress = (id: string, addr: string) => {
    try {
      navigator.clipboard.writeText(addr);
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1500);
    } catch {
      // Clipboard blocked
    }
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageToDataUrl(file, 220, 0.75);
      setTokenLogoUrl(dataUrl);
    } catch {
      setLaunchFeedback({ type: 'err', msg: 'Could not process logo image. Please use a valid PNG/JPG.' });
    }
  };

  const handleOpenLaunchModal = () => {
    setLaunchFeedback(null);
    setLockDays(String(lpConfig.defaultLockDays || 365));
    setLaunchModalOpen(true);
  };

  const handleLaunchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser || !userProfile) {
      setLaunchModalOpen(false);
      onRequireAuth?.();
      return;
    }
    setLaunchSubmitting(true);
    setLaunchFeedback(null);
    try {
      const created = await launchMemeToken({
        name: tokenName,
        ticker: tokenTicker,
        chain: tokenChain,
        description: tokenDescription,
        logoUrl: tokenLogoUrl,
        accentColor: tokenAccent,
        telegramUrl,
        twitterUrl,
        websiteUrl,
        creatorAddress,
        initialBuyUsd: Number(initialBuyUsd) || 0,
        lockDays: Number(lockDays) || 365,
      });
      setLaunchFeedback({
        type: 'ok',
        msg: `$${created.ticker} (${created.name}) deployed live on ${created.chain} via alphatradex.pro.`,
      });
      setTokenName('');
      setTokenTicker('');
      setTokenDescription('');
      setTokenLogoUrl('');
      setTelegramUrl('');
      setTwitterUrl('');
      setWebsiteUrl('');
      setCreatorAddress('');
      setTimeout(() => {
        setLaunchModalOpen(false);
        setSelectedToken(created);
      }, 900);
    } catch (err) {
      setLaunchFeedback({
        type: 'err',
        msg: err instanceof Error ? err.message : 'Unable to deploy token.',
      });
    } finally {
      setLaunchSubmitting(false);
    }
  };

  const tradePreview = useMemo(() => {
    if (!activeModalToken) return null;
    const usd = Math.max(0, Number(tradeUsdInput) || 0);
    const feePct = Number(lpConfig.tradingFeePercent ?? 1.0);
    const feeUsd = (usd * feePct) / 100;
    const netUsd = Math.max(0, usd - feeUsd);
    const unitPrice = Math.max(0.0000001, (activeModalToken.marketCapUsd || 15000) / 1_000_000_000);
    const estTokens = netUsd / unitPrice;
    const projectedRaised = Math.max(
      0,
      activeModalToken.raisedUsd + (tradeSide === 'buy' ? netUsd : -netUsd)
    );
    const projectedProgress = Math.min(
      100,
      (projectedRaised / Math.max(1000, activeModalToken.graduationTargetUsd || 69000)) * 100
    );
    const priceImpactPct =
      activeModalToken.marketCapUsd > 0
        ? Math.min(28, (netUsd / Math.max(5000, activeModalToken.marketCapUsd)) * 100)
        : 0;
    return {
      usd,
      feePct,
      feeUsd,
      netUsd,
      unitPrice,
      estTokens,
      projectedProgress,
      priceImpactPct,
    };
  }, [activeModalToken, tradeUsdInput, tradeSide, lpConfig.tradingFeePercent]);

  const handleExecuteTrade = async () => {
    if (!activeModalToken) return;
    if (!authUser || !userProfile) {
      setSelectedToken(null);
      onRequireAuth?.();
      return;
    }
    setTradeSubmitting(true);
    setTradeFeedback(null);
    try {
      const res = await tradeMemeLaunchpadToken({
        token: activeModalToken,
        side: tradeSide,
        amountUsd: Number(tradeUsdInput) || 0,
      });
      setTradeFeedback({
        type: 'ok',
        msg: `${tradeSide === 'buy' ? 'Bought' : 'Sold'} ${res.tokenQuantity.toLocaleString(undefined, {
          maximumFractionDigits: 0,
        })} $${activeModalToken.ticker} · Fee $${res.feeUsd.toFixed(2)} · Curve ${res.newProgress.toFixed(1)}%`,
      });
    } catch (err) {
      setTradeFeedback({
        type: 'err',
        msg: err instanceof Error ? err.message : 'Order execution failed.',
      });
    } finally {
      setTradeSubmitting(false);
    }
  };

  if (!lpConfig.enabled) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
        <p className="text-sm text-slate-400">
          AlphaTradex Meme Launchpad is currently in scheduled maintenance.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      {/* Header & Metrics Bar */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-5 sm:p-7">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-medium tracking-wider uppercase text-amber-400">
              <Rocket className="h-3.5 w-3.5" />
              <span>AlphaTradex Meme Launchpad · alphatradex.pro</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Fair-Launch Meme Tokens on BSC &amp; Solana
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Discover audited bonding-curve launches with locked liquidity proofs or deploy your own community meme token in minutes directly from your AlphaTradex vault.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {compactPreview && onOpenFullPage && (
              <button
                type="button"
                onClick={onOpenFullPage}
                className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-sm font-semibold transition-colors"
              >
                Explore All Launches
              </button>
            )}
            <button
              type="button"
              onClick={handleOpenLaunchModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold shadow-lg shadow-amber-500/15 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Launch Meme Token</span>
            </button>
          </div>
        </div>

        {/* Monospace Telemetry Summary Strip */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-500">Active Launches</p>
            <p className="mt-1 font-mono text-lg font-bold text-white tabular-nums">{liveCount} Live</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-500">24h Launchpad Volume</p>
            <p className="mt-1 font-mono text-lg font-bold text-emerald-400 tabular-nums">
              {formatCompactUsd(totalVolume24h)}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-500">Launch / Curve Fee</p>
            <p className="mt-1 font-mono text-lg font-bold text-amber-400 tabular-nums">
              ${lpConfig.launchFeeUsd} · {lpConfig.tradingFeePercent}%
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-500">Graduation Target</p>
            <p className="mt-1 font-mono text-lg font-bold text-sky-400 tabular-nums">
              {formatCompactUsd(lpConfig.graduationTargetUsd)}
            </p>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      {!compactPreview && (
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-xl p-1">
            {(
              [
                { id: 'trending', label: 'Trending', icon: Flame },
                { id: 'new', label: 'New Launches', icon: Sparkles },
                { id: 'graduating', label: 'Graduating Soon', icon: TrendingUp },
                { id: 'completed', label: 'Completed', icon: CheckCircle2 },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = category === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCategory(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1">
              {(['ALL', 'Solana', 'BSC'] as const).map((chain) => (
                <button
                  key={chain}
                  type="button"
                  onClick={() => setChainFilter(chain)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    chainFilter === chain
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {chain === 'ALL' ? 'All Chains' : chain}
                </button>
              ))}
            </div>

            <div className="relative flex-1 sm:w-64">
              <Search className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, $TICKER, creator..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
              />
            </div>
          </div>
        </div>
      )}

      {/* Token Discovery Grid */}
      {filteredTokens.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-10 text-center">
          <p className="text-sm text-slate-400">No meme tokens matched your active filter.</p>
          <button
            type="button"
            onClick={() => {
              setCategory('trending');
              setChainFilter('ALL');
              setSearchQuery('');
            }}
            className="mt-3 text-xs font-semibold text-amber-400 hover:text-amber-300"
          >
            Reset Discovery Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTokens.map((token) => {
            const pct = Math.max(0, Math.min(100, Number(token.progressPercent) || 0));
            return (
              <div
                key={token.id}
                className="group rounded-2xl border border-slate-800 bg-slate-900/75 hover:border-amber-500/45 transition-all p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3.5">
                  {/* Top Row: Avatar, Name/Ticker, Chain & Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <TokenAvatar token={token} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-base font-bold text-white truncate">{token.name}</h3>
                          {token.featured && (
                            <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs font-mono text-slate-400">
                          ${token.ticker} · {token.chain}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-md border ${
                        token.status === 'graduated'
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                          : token.status === 'upcoming'
                          ? 'border-sky-500/40 bg-sky-500/10 text-sky-300'
                          : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                      }`}
                    >
                      {token.status === 'graduated'
                        ? 'Graduated'
                        : token.status === 'upcoming'
                        ? 'Upcoming'
                        : 'Live Curve'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {token.description}
                  </p>

                  {/* Bonding Curve Progress */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Bonding Curve Progress</span>
                      <span className="font-mono font-bold text-amber-400 tabular-nums">
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className={`h-full rounded-full transition-all duration-500 ${
                          pct >= 100
                            ? 'bg-emerald-400'
                            : 'bg-gradient-to-r from-amber-500 to-emerald-400'
                        }`}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 tabular-nums">
                      <span>Raised {formatCompactUsd(token.raisedUsd)}</span>
                      <span>Target {formatCompactUsd(token.graduationTargetUsd)}</span>
                    </div>
                  </div>

                  {/* Clean Metadata Grid */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-xs">
                    <div>
                      <span className="block text-[10px] uppercase text-slate-500">Market Cap</span>
                      <span className="font-mono font-semibold text-white tabular-nums">
                        {formatCompactUsd(token.marketCapUsd)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase text-slate-500">24h Vol</span>
                      <span className="font-mono font-semibold text-emerald-400 tabular-nums">
                        {formatCompactUsd(token.volume24hUsd)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase text-slate-500">Holders</span>
                      <span className="font-mono font-semibold text-slate-200 tabular-nums">
                        {token.holdersCount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer: Liquidity Lock, External DEX Status, Creator & Action */}
                <div className="space-y-2.5 pt-3 border-t border-slate-800/80">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    {token.dexListingStatus === 'listed' && token.contractAddress?.trim() ? (
                      <>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-emerald-500/35 bg-emerald-500/10 text-emerald-300 font-semibold">
                          <Link2 className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-[140px]">
                            DEX: {token.dexName?.trim() || (token.chain === 'BSC' ? 'PancakeSwap' : 'Raydium')}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyAddress(`${token.id}_ca`, token.contractAddress || '')}
                          className="inline-flex items-center gap-1 font-mono text-emerald-300/90 hover:text-white transition-colors"
                          title="Copy Smart Contract Address"
                        >
                          <span>CA: {shortenAddress(token.contractAddress)}</span>
                          {copiedId === `${token.id}_ca` ? (
                            <Check className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-300 font-semibold">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span>DEX Listing: Pending</span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Internal Curve
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="inline-flex items-center gap-1 text-emerald-400">
                      <Lock className="h-3 w-3" />
                      {token.liquidityLocked ? `LP Locked ${token.lockDays}d` : 'Standard LP'}
                      {token.antiRugAudit ? ' · Anti-Rug' : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyAddress(token.id, token.creatorAddress)}
                      className="inline-flex items-center gap-1 font-mono text-slate-400 hover:text-white transition-colors"
                      title="Copy creator address"
                    >
                      <span>{shortenAddress(token.creatorAddress)}</span>
                      {copiedId === token.id ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedToken(token);
                      setTradeSide('buy');
                      setTradeUsdInput('50');
                      setTradeFeedback(null);
                    }}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-amber-500 text-slate-100 hover:text-slate-950 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <ArrowDownUp className="h-3.5 w-3.5" />
                    <span>
                      {token.status === 'live'
                        ? 'Trade Bonding Curve & Simulate'
                        : 'Inspect Token & Liquidity Proof'}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Admin-Published Custom Meme Coin Smart Contract Registry (BSC & Solana) */}
      {visibleCustomContracts.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Link2 className="h-4 w-4 text-amber-400" />
                <span>Verified On-Chain Contract Registry (BSC &amp; Solana)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Official smart contract addresses and external DEX deployment statuses published by AlphaTradex administration.
              </p>
            </div>
            <span className="font-mono text-[11px] px-2.5 py-1 rounded-md border border-slate-700 bg-slate-950 text-slate-300">
              {visibleCustomContracts.length} Contract{visibleCustomContracts.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {(compactPreview ? visibleCustomContracts.slice(0, 3) : visibleCustomContracts).map(
              (entry) => {
                const hasContract = Boolean(entry.contractAddress.trim());
                const statusBadge =
                  entry.deploymentStatus === 'listed'
                    ? {
                        label: `Listed · ${entry.dexName?.trim() || (entry.network === 'BSC' ? 'PancakeSwap' : 'Raydium')}`,
                        cls: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300',
                      }
                    : entry.deploymentStatus === 'deployed'
                    ? {
                        label: 'Contract Deployed',
                        cls: 'border-sky-500/35 bg-sky-500/10 text-sky-300',
                      }
                    : {
                        label: 'Pending Deployment',
                        cls: 'border-amber-500/35 bg-amber-500/10 text-amber-300',
                      };
                return (
                  <div
                    key={entry.id}
                    className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-white truncate">
                            {entry.tokenName}
                          </h4>
                          <p className="text-[11px] font-mono text-amber-400">
                            ${entry.ticker} · {entry.network}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold ${statusBadge.cls}`}
                        >
                          {entry.deploymentStatus === 'listed' ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : entry.deploymentStatus === 'deployed' ? (
                            <ShieldCheck className="h-3 w-3" />
                          ) : (
                            <Clock className="h-3 w-3" />
                          )}
                          <span>{statusBadge.label}</span>
                        </span>
                      </div>

                      <div className="rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="block text-[10px] uppercase tracking-wider text-slate-500">
                            {entry.network} Contract Address
                          </span>
                          <span className="block font-mono text-[11px] text-slate-200 truncate">
                            {hasContract ? entry.contractAddress : 'Pending on-chain deployment'}
                          </span>
                        </div>
                        {hasContract && (
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyAddress(`registry_${entry.id}`, entry.contractAddress)
                            }
                            className="shrink-0 p-1.5 rounded-md border border-slate-700 text-slate-300 hover:text-white hover:border-amber-500/60"
                            title="Copy contract address"
                          >
                            {copiedId === `registry_${entry.id}` ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                      </div>

                      {entry.notes && (
                        <p className="text-[11px] text-slate-400 leading-relaxed">{entry.notes}</p>
                      )}
                    </div>

                    {(hasContract || isSafeHttpUrl(entry.dexPairUrl)) && (
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
                        {hasContract && (
                          <a
                            href={getBlockExplorerUrl(entry.network, entry.contractAddress)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:border-slate-500 text-[11px] font-semibold text-slate-200"
                          >
                            <span>{entry.network === 'BSC' ? 'BscScan' : 'Solscan'}</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {isSafeHttpUrl(entry.dexPairUrl) && (
                          <a
                            href={entry.dexPairUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[11px] font-bold text-slate-950"
                          >
                            <span>
                              Trade on{' '}
                              {entry.dexName?.trim() ||
                                (entry.network === 'BSC' ? 'PancakeSwap' : 'Raydium')}
                            </span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              }
            )}
          </div>
        </div>
      )}

      {/* Recent User Launchpad Orders (Dashboard / Signed-In Only) */}
      {!compactPreview && authUser && launchpadTrades.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h3 className="text-sm font-bold text-white mb-3">Your Launchpad Bonding Curve Orders</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500">
                  <th className="py-2 pr-4 font-medium">Token</th>
                  <th className="py-2 pr-4 font-medium">Side</th>
                  <th className="py-2 pr-4 font-medium">Amount</th>
                  <th className="py-2 pr-4 font-medium">Tokens</th>
                  <th className="py-2 font-medium">Fee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
                {launchpadTrades.slice(0, 8).map((tr) => (
                  <tr key={tr.id}>
                    <td className="py-2.5 pr-4 text-white font-semibold">
                      ${tr.tokenTicker} · {tr.chain}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className={tr.side === 'buy' ? 'text-emerald-400 uppercase' : 'text-rose-400 uppercase'}>
                        {tr.side}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-slate-200">${tr.amountUsd.toFixed(2)}</td>
                    <td className="py-2.5 pr-4 text-amber-300">
                      {tr.tokenQuantity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2.5 text-slate-400">${tr.feeUsd.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bonding Curve Detail & Trade Simulator Modal */}
      {activeModalToken && tradePreview && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <TokenAvatar token={activeModalToken} />
                <div>
                  <h3 className="text-base font-bold text-white">
                    {activeModalToken.name}{' '}
                    <span className="font-mono text-amber-400">${activeModalToken.ticker}</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    {activeModalToken.chain} Bonding Curve · Creator @{activeModalToken.creatorHandle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedToken(null)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Anti-Rug & Liquidity Lock Proof Strip */}
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-emerald-300 font-medium">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span>
                    Anti-Rug Contract Verified ·{' '}
                    {activeModalToken.liquidityLocked
                      ? `Liquidity Locked ${activeModalToken.lockDays} Days on Graduation`
                      : 'Standard Liquidity Pool'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {activeModalToken.websiteUrl && (
                    <a
                      href={activeModalToken.websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-300 hover:text-white inline-flex items-center gap-1"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      <span>Web</span>
                    </a>
                  )}
                  {activeModalToken.telegramUrl && (
                    <a
                      href={activeModalToken.telegramUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-300 hover:text-white inline-flex items-center gap-1"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>TG</span>
                    </a>
                  )}
                  {activeModalToken.twitterUrl && (
                    <a
                      href={activeModalToken.twitterUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-300 hover:text-white inline-flex items-center gap-1"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>X</span>
                    </a>
                  )}
                </div>
              </div>

              {/* External DEX & On-Chain Smart Contract Status */}
              {activeModalToken.dexListingStatus === 'listed' &&
              activeModalToken.contractAddress?.trim() ? (
                <div className="rounded-xl border border-emerald-500/30 bg-slate-950/80 p-3.5 space-y-2.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-emerald-300 font-bold">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>
                        External DEX Listed ·{' '}
                        {activeModalToken.dexName?.trim() ||
                          (activeModalToken.chain === 'BSC' ? 'PancakeSwap' : 'Raydium')}
                      </span>
                    </span>
                    <div className="flex items-center gap-2">
                      <a
                        href={getBlockExplorerUrl(
                          activeModalToken.chain,
                          activeModalToken.contractAddress
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-900 hover:border-slate-500 text-[11px] font-semibold text-slate-200"
                      >
                        <span>{activeModalToken.chain === 'BSC' ? 'BscScan' : 'Solscan'}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      {isSafeHttpUrl(activeModalToken.dexPairUrl) && (
                        <a
                          href={activeModalToken.dexPairUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[11px] font-bold text-slate-950"
                        >
                          <span>
                            Trade on{' '}
                            {activeModalToken.dexName?.trim() ||
                              (activeModalToken.chain === 'BSC' ? 'PancakeSwap' : 'Raydium')}
                          </span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-900/90 border border-slate-800 px-3 py-2">
                    <div className="min-w-0">
                      <span className="block text-[10px] uppercase tracking-wider text-slate-500">
                        {activeModalToken.chain} Smart Contract Address
                      </span>
                      <span className="block font-mono text-[11px] text-slate-200 truncate">
                        {activeModalToken.contractAddress}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyAddress(
                          `modal_ca_${activeModalToken.id}`,
                          activeModalToken.contractAddress || ''
                        )
                      }
                      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-700 text-[11px] font-semibold text-slate-300 hover:text-white hover:border-amber-500/60"
                    >
                      {copiedId === `modal_ca_${activeModalToken.id}` ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy CA</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 text-amber-300 font-bold">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span>External DEX Listing: Pending</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Trading is currently active on the AlphaTradex internal bonding curve. The verified {activeModalToken.chain} smart contract address &amp; external DEX listing ({activeModalToken.chain === 'BSC' ? 'PancakeSwap' : 'Raydium'}) will be linked here by AlphaTradex Admin once deployed on-chain.
                    </p>
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-300 leading-relaxed">{activeModalToken.description}</p>

              {/* Bonding Curve Buy / Sell Preview Simulator */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => setTradeSide('buy')}
                      className={`px-4 py-1.5 rounded-md text-xs font-bold transition-colors ${
                        tradeSide === 'buy'
                          ? 'bg-emerald-500 text-slate-950'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Buy ${activeModalToken.ticker}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTradeSide('sell')}
                      className={`px-4 py-1.5 rounded-md text-xs font-bold transition-colors ${
                        tradeSide === 'sell'
                          ? 'bg-rose-500 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Sell ${activeModalToken.ticker}
                    </button>
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    Vault Balance:{' '}
                    <span className="text-white font-semibold">
                      ${(userProfile?.usdBalance || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Order Amount (USDT)</label>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="number"
                      min="5"
                      step="5"
                      value={tradeUsdInput}
                      onChange={(e) => setTradeUsdInput(e.target.value)}
                      className="flex-1 min-w-[140px] px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-amber-500"
                    />
                    {['25', '50', '100', '250'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setTradeUsdInput(preset)}
                        className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-900 hover:border-amber-500/60 text-xs font-mono text-slate-300"
                      >
                        ${preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Simulator Output Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800 text-xs font-mono tabular-nums">
                  <div>
                    <span className="block text-[10px] font-sans uppercase text-slate-500">
                      Est. Tokens
                    </span>
                    <span className="text-amber-400 font-bold">
                      {tradePreview.estTokens.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-sans uppercase text-slate-500">
                      Curve Fee ({tradePreview.feePct}%)
                    </span>
                    <span className="text-slate-200">${tradePreview.feeUsd.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-sans uppercase text-slate-500">
                      Est. Price Impact
                    </span>
                    <span className="text-sky-400">{tradePreview.priceImpactPct.toFixed(2)}%</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-sans uppercase text-slate-500">
                      Curve After Order
                    </span>
                    <span className="text-emerald-400 font-bold">
                      {tradePreview.projectedProgress.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {tradeFeedback && (
                  <div
                    className={`rounded-xl px-3.5 py-2.5 text-xs border ${
                      tradeFeedback.type === 'ok'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                    }`}
                  >
                    {tradeFeedback.msg}
                  </div>
                )}

                <button
                  type="button"
                  disabled={tradeSubmitting || activeModalToken.status !== 'live'}
                  onClick={handleExecuteTrade}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition-colors disabled:opacity-50 ${
                    tradeSide === 'buy'
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      : 'bg-rose-500 hover:bg-rose-400 text-white'
                  }`}
                >
                  {activeModalToken.status !== 'live'
                    ? `Bonding Curve ${activeModalToken.status.toUpperCase()}`
                    : !authUser
                    ? 'Sign In to Execute Launchpad Order'
                    : tradeSubmitting
                    ? 'Settling Bonding Curve Order...'
                    : `${tradeSide === 'buy' ? 'Confirm Buy' : 'Confirm Sell'} · $${tradePreview.usd.toFixed(2)}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create / Launch Meme Token Modal */}
      {launchModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">Create &amp; Launch Meme Token</h3>
                <p className="text-xs text-slate-400">
                  Fair-launch deployment on BSC or Solana via alphatradex.pro
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLaunchModalOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleLaunchSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-400 mb-1">Token Name *</label>
                  <input
                    required
                    maxLength={64}
                    value={tokenName}
                    onChange={(e) => setTokenName(e.target.value)}
                    placeholder="e.g. HyperPepe Alpha"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Ticker Symbol *</label>
                  <input
                    required
                    maxLength={16}
                    value={tokenTicker}
                    onChange={(e) => setTokenTicker(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    placeholder="HPEPE"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono uppercase text-amber-300 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Launch Network</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['Solana', 'BSC'] as const).map((chain) => (
                      <button
                        key={chain}
                        type="button"
                        onClick={() => setTokenChain(chain)}
                        className={`py-2.5 rounded-xl border text-xs font-bold transition-colors ${
                          tokenChain === chain
                            ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                            : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                        }`}
                      >
                        {chain}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Badge Accent</label>
                  <div className="flex items-center gap-2 pt-1.5">
                    {ACCENT_PRESETS.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setTokenAccent(hex)}
                        style={{ backgroundColor: hex }}
                        className={`h-7 w-7 rounded-lg transition-transform ${
                          tokenAccent === hex ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Token Story / Description</label>
                <textarea
                  rows={2}
                  maxLength={600}
                  value={tokenDescription}
                  onChange={(e) => setTokenDescription(e.target.value)}
                  placeholder="Describe your meme token community, utility, and fair-launch mission..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Logo URL or Upload */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-400 mb-1">Logo Image URL (or Upload)</label>
                  <input
                    value={tokenLogoUrl.startsWith('data:') ? 'Uploaded image ready' : tokenLogoUrl}
                    onChange={(e) => setTokenLogoUrl(e.target.value)}
                    placeholder="https://... or upload PNG/JPG"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <label className="cursor-pointer inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200">
                  <Upload className="h-3.5 w-3.5" />
                  <span>Upload Logo</span>
                  <input type="file" accept="image/*" onChange={handleLogoFileChange} className="hidden" />
                </label>
              </div>

              {/* Social Links */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Telegram URL</label>
                  <input
                    value={telegramUrl}
                    onChange={(e) => setTelegramUrl(e.target.value)}
                    placeholder="https://t.me/..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">X / Twitter URL</label>
                  <input
                    value={twitterUrl}
                    onChange={(e) => setTwitterUrl(e.target.value)}
                    placeholder="https://x.com/..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Website URL</label>
                  <input
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Creator Wallet, Initial Buy, LP Lock */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Creator Wallet (Optional)</label>
                  <input
                    value={creatorAddress}
                    onChange={(e) => setCreatorAddress(e.target.value)}
                    placeholder={tokenChain === 'BSC' ? '0x...' : 'Solana pubkey...'}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Initial Dev Buy (USDT)</label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={initialBuyUsd}
                    onChange={(e) => setInitialBuyUsd(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Liquidity Lock (Days)</label>
                  <input
                    type="number"
                    min="0"
                    max="3650"
                    value={lockDays}
                    onChange={(e) => setLockDays(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Platform Fee Breakdown */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Platform Launch Creation Fee</span>
                  <span className="font-mono text-white">${lpConfig.launchFeeUsd.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Creator Initial Bonding Curve Allocation</span>
                  <span className="font-mono text-white">
                    ${Math.max(0, Number(initialBuyUsd) || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Anti-Rug Lock &amp; Fair Launch Verification</span>
                  <span className="text-emerald-400 font-semibold">Included ({lockDays || 0}d Lock)</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>External DEX Smart Contract Status</span>
                  <span className="text-amber-400 font-semibold">
                    Pending (Admin links contract after deploy)
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between font-bold text-sm">
                  <span className="text-white">Total Deposit Wallet Debit</span>
                  <span className="font-mono text-amber-400">
                    ${(lpConfig.launchFeeUsd + Math.max(0, Number(initialBuyUsd) || 0)).toFixed(2)}
                  </span>
                </div>
              </div>

              {launchFeedback && (
                <div
                  className={`rounded-xl px-3.5 py-2.5 text-xs border ${
                    launchFeedback.type === 'ok'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                  }`}
                >
                  {launchFeedback.msg}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setLaunchModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={launchSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors disabled:opacity-50"
                >
                  <Rocket className="h-4 w-4" />
                  <span>
                    {!authUser
                      ? 'Sign In to Launch Token'
                      : launchSubmitting
                      ? 'Deploying Token...'
                      : 'Deploy Meme Token Live'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
