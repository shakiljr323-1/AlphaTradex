import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Award,
  CheckCircle2,
  Copy,
  Globe,
  History,
  Layers,
  Lock,
  RefreshCw,
  Search,
  Shield,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import { DEFAULT_PLATFORM_CONFIG } from '../constants/defaults';
import { usePlatform } from '../context/PlatformContext';
import {
  CopyTraderProfile,
  CopyTradeSubscription,
  ForexAccountTierConfig,
  ForexAccountTierId,
  ForexTrade,
} from '../types/platform';
import {
  AlphatradexLiveChart,
  AlphatradexTickerTape,
  ChartPositionOverlay,
} from './TradingViewChart';

type Timeframe = '15M' | '1H' | '4H' | '1D' | '1W';
type ChartMode = 'candles' | 'area';
type TerminalTab = 'terminal' | 'copy-trade' | 'account-tiers';
type OrdersTab = 'open' | 'history';

export interface ForexPairSpec {
  symbol: string;
  tvSymbol: string;
  name: string;
  basePrice: number;
  decimals: number;
  pipSize: number;
  spreadPips: number;
  session: string;
  contractSize: number;
}

export const FOREX_PAIRS: ForexPairSpec[] = [
  {
    symbol: 'EUR/USD',
    tvSymbol: 'FX:EURUSD',
    name: 'Euro / US Dollar',
    basePrice: 1.0842,
    decimals: 5,
    pipSize: 0.0001,
    spreadPips: 1.0,
    session: 'London · New York',
    contractSize: 100000,
  },
  {
    symbol: 'GBP/USD',
    tvSymbol: 'FX:GBPUSD',
    name: 'British Pound / US Dollar',
    basePrice: 1.2685,
    decimals: 5,
    pipSize: 0.0001,
    spreadPips: 1.2,
    session: 'London · New York',
    contractSize: 100000,
  },
  {
    symbol: 'USD/JPY',
    tvSymbol: 'FX:USDJPY',
    name: 'US Dollar / Japanese Yen',
    basePrice: 154.32,
    decimals: 3,
    pipSize: 0.01,
    spreadPips: 1.1,
    session: 'Tokyo · New York',
    contractSize: 100000,
  },
  {
    symbol: 'XAU/USD',
    tvSymbol: 'OANDA:XAUUSD',
    name: 'Gold Spot / US Dollar',
    basePrice: 2642.5,
    decimals: 2,
    pipSize: 0.1,
    spreadPips: 2.4,
    session: 'COMEX · LBMA Spot',
    contractSize: 100,
  },
  {
    symbol: 'AUD/USD',
    tvSymbol: 'FX:AUDUSD',
    name: 'Australian Dollar / US Dollar',
    basePrice: 0.6542,
    decimals: 5,
    pipSize: 0.0001,
    spreadPips: 1.2,
    session: 'Sydney · Tokyo',
    contractSize: 100000,
  },
  {
    symbol: 'USD/CHF',
    tvSymbol: 'FX:USDCHF',
    name: 'US Dollar / Swiss Franc',
    basePrice: 0.8816,
    decimals: 5,
    pipSize: 0.0001,
    spreadPips: 1.1,
    session: 'Zurich · London',
    contractSize: 100000,
  },
];

const TV_INTERVALS: Record<Timeframe, string> = {
  '15M': '15',
  '1H': '60',
  '4H': '240',
  '1D': 'D',
  '1W': 'W',
};

function computePipValuePerLot(pair: ForexPairSpec, spotPrice: number): number {
  if (pair.symbol === 'USD/JPY' || pair.symbol === 'USD/CHF') {
    return (pair.contractSize * pair.pipSize) / Math.max(0.1, spotPrice);
  }
  return pair.contractSize * pair.pipSize;
}

function computeNotionalUsd(pair: ForexPairSpec, lots: number, spotPrice: number): number {
  if (pair.symbol.startsWith('USD/')) {
    return lots * pair.contractSize;
  }
  return lots * pair.contractSize * spotPrice;
}

function computeCopyPendingNet(sub: CopyTradeSubscription, nowMs: number): number {
  if (sub.status !== 'active') return 0;
  const elapsedMs = Math.max(0, nowMs - (sub.lastSyncedAtMs || sub.startedAtMs));
  const days = elapsedMs / 86_400_000;
  const gross = sub.allocatedUsd * (sub.dailyTargetPercent / 100) * sub.riskMultiplier * days;
  const net = gross * (1 - Math.max(0, Math.min(50, sub.performanceFeePercent)) / 100);
  return Math.max(0, net);
}

interface ForexMarketViewProps {
  vaultBalanceUsd?: number;
  mode?: 'vault' | 'preview';
  onNotify?: (type: 'ok' | 'err', message: string) => void;
  onRequireAuth?: () => void;
  onNavigateToDeposit?: () => void;
  onNavigateToPackages?: () => void;
}

export const ForexMarketView: React.FC<ForexMarketViewProps> = ({
  vaultBalanceUsd,
  mode = 'vault',
  onNotify,
  onRequireAuth,
  onNavigateToDeposit,
  onNavigateToPackages,
}) => {
  const {
    authUser,
    userProfile,
    platformConfig,
    investments,
    forexTrades,
    copyTradeSubscriptions,
    openForexTrade,
    closeForexTrade,
    startCopyTrade,
    claimCopyTradeProfit,
    stopCopyTrade,
  } = usePlatform();

  const forexCfg = platformConfig.forexConfig || DEFAULT_PLATFORM_CONFIG.forexConfig!;
  const enabledTiers = useMemo(() => {
    const list = forexCfg.accountTiers.filter((t) => t.enabled);
    return list.length > 0 ? list : forexCfg.accountTiers;
  }, [forexCfg.accountTiers]);

  const enabledTraders = useMemo(
    () => forexCfg.copyTraders.filter((t) => t.enabled),
    [forexCfg.copyTraders]
  );

  const incomeBalance = userProfile?.profitBalance ?? vaultBalanceUsd ?? 0;
  const depositBalance = userProfile?.usdBalance ?? 0;
  const effectiveBalance = incomeBalance;
  const isAuthenticated = Boolean(authUser && userProfile && mode === 'vault');
  const hasPurchasedPackage = useMemo(
    () => investments.length > 0 || (userProfile?.totalInvested ?? 0) > 0,
    [investments.length, userProfile?.totalInvested]
  );

  const [terminalTab, setTerminalTab] = useState<TerminalTab>('terminal');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('EUR/USD');
  const [selectedTierId, setSelectedTierId] = useState<ForexAccountTierId>('standard');
  const [timeframe, setTimeframe] = useState<Timeframe>('1H');
  const [chartMode, setChartMode] = useState<ChartMode>('candles');
  const [showEma, setShowEma] = useState<boolean>(true);
  const [ordersTab, setOrdersTab] = useState<OrdersTab>('open');

  // Live spot rates anchored from FX & Gold APIs
  const [spotState, setSpotState] = useState<{
    current: Record<string, number>;
    previous: Record<string, number>;
  }>(() => {
    const initial: Record<string, number> = {};
    FOREX_PAIRS.forEach((p) => {
      initial[p.symbol] = p.basePrice;
    });
    return { current: initial, previous: initial };
  });
  const [chartTickQuote, setChartTickQuote] = useState<{
    symbol: string;
    bid: number;
    ask: number;
  } | null>(null);
  const [lastSyncLabel, setLastSyncLabel] = useState<string>('Syncing live FX...');
  const [syncingSpots, setSyncingSpots] = useState<boolean>(false);

  // Order Ticket State
  const [lotSize, setLotSize] = useState<string>('0.10');
  const [leverage, setLeverage] = useState<number>(100);
  const [slPips, setSlPips] = useState<string>('25');
  const [tpPips, setTpPips] = useState<string>('50');
  const [busyAction, setBusyAction] = useState<boolean>(false);
  const [localBanner, setLocalBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Copy Trade State
  const [copySearch, setCopySearch] = useState<string>('');
  const [copyRiskFilter, setCopyRiskFilter] = useState<'ALL' | 'Low' | 'Moderate' | 'Dynamic'>('ALL');
  const [activeCopyTrader, setActiveCopyTrader] = useState<CopyTraderProfile | null>(null);
  const [copyAllocUsd, setCopyAllocUsd] = useState<string>('100');
  const [copyMultiplier, setCopyMultiplier] = useState<number>(1);
  const [copyStopLossPct, setCopyStopLossPct] = useState<number>(25);
  const [copyTierId, setCopyTierId] = useState<ForexAccountTierId>('standard');
  const [clockMs, setClockMs] = useState<number>(() => Date.now());

  const autoClosingIdsRef = useRef<Set<string>>(new Set());

  const emitToast = useCallback(
    (type: 'ok' | 'err', msg: string) => {
      setLocalBanner({ type, text: msg });
      onNotify?.(type, msg);
    },
    [onNotify]
  );

  // 1-second clock tick for live Copy Trade accrual display
  useEffect(() => {
    const id = window.setInterval(() => setClockMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const selectedTier: ForexAccountTierConfig = useMemo(() => {
    return (
      enabledTiers.find((t) => t.id === selectedTierId) ||
      enabledTiers[0] ||
      DEFAULT_PLATFORM_CONFIG.forexConfig!.accountTiers[0]
    );
  }, [enabledTiers, selectedTierId]);

  const activePair = useMemo(
    () => FOREX_PAIRS.find((p) => p.symbol === selectedSymbol) || FOREX_PAIRS[0],
    [selectedSymbol]
  );

  const syncLiveSpotRates = useCallback(async () => {
    setSyncingSpots(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);

    try {
      const updates: Record<string, number> = {};
      let fxRates: Record<string, number> | null = null;
      try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD', {
          signal: controller.signal,
        });
        if (res.ok) {
          const json = (await res.json()) as { rates?: Record<string, number> };
          if (json?.rates) fxRates = json.rates;
        }
      } catch {
        // Fallback below
      }

      if (!fxRates) {
        try {
          const res2 = await fetch(
            'https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY,CHF,AUD',
            { signal: controller.signal }
          );
          if (res2.ok) {
            const json2 = (await res2.json()) as { rates?: Record<string, number> };
            if (json2?.rates) fxRates = json2.rates;
          }
        } catch {
          // Keep current prices if unreachable
        }
      }

      if (fxRates) {
        if (fxRates.EUR) updates['EUR/USD'] = Number((1 / fxRates.EUR).toFixed(5));
        if (fxRates.GBP) updates['GBP/USD'] = Number((1 / fxRates.GBP).toFixed(5));
        if (fxRates.JPY) updates['USD/JPY'] = Number(fxRates.JPY.toFixed(3));
        if (fxRates.AUD) updates['AUD/USD'] = Number((1 / fxRates.AUD).toFixed(5));
        if (fxRates.CHF) updates['USD/CHF'] = Number(fxRates.CHF.toFixed(5));
      }

      try {
        const goldRes = await fetch('https://api.gold-api.com/price/XAU', {
          signal: controller.signal,
        });
        if (goldRes.ok) {
          const goldJson = (await goldRes.json()) as { price?: number };
          if (typeof goldJson?.price === 'number' && goldJson.price > 500) {
            updates['XAU/USD'] = Number(goldJson.price.toFixed(2));
          }
        }
      } catch {
        // Keep fallback
      }

      if (Object.keys(updates).length > 0) {
        setSpotState((prev) => ({
          previous: prev.current,
          current: { ...prev.current, ...updates },
        }));
        setLastSyncLabel(
          `Synced ${new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}`
        );
      } else {
        setLastSyncLabel('Alphatradex Live Stream');
      }
    } finally {
      window.clearTimeout(timeout);
      setSyncingSpots(false);
    }
  }, []);

  useEffect(() => {
    syncLiveSpotRates();
    const timer = window.setInterval(syncLiveSpotRates, 30000);
    return () => window.clearInterval(timer);
  }, [syncLiveSpotRates]);

  // Synchronized Bid / Ask taking Exness tier spreadMultiplier into account
  const effectiveSpreadPips = Number(
    Math.max(0, activePair.spreadPips * selectedTier.spreadMultiplier).toFixed(2)
  );
  const bidPrice =
    chartTickQuote && chartTickQuote.symbol === activePair.symbol
      ? chartTickQuote.bid
      : spotState.current[activePair.symbol] ?? activePair.basePrice;
  const askPrice = Number(
    (bidPrice + effectiveSpreadPips * activePair.pipSize).toFixed(activePair.decimals)
  );

  // Helper to get current live bid & ask for any symbol (used by Open Positions list)
  const getSymbolQuotes = useCallback(
    (symbol: string, tierId: ForexAccountTierId) => {
      const pair = FOREX_PAIRS.find((p) => p.symbol === symbol) || FOREX_PAIRS[0];
      const tier =
        forexCfg.accountTiers.find((t) => t.id === tierId) || selectedTier;
      const liveBid =
        chartTickQuote && chartTickQuote.symbol === pair.symbol
          ? chartTickQuote.bid
          : spotState.current[pair.symbol] ?? pair.basePrice;
      const spreadPips = pair.spreadPips * (tier?.spreadMultiplier ?? 1);
      const liveAsk = Number((liveBid + spreadPips * pair.pipSize).toFixed(pair.decimals));
      return { pair, liveBid, liveAsk };
    },
    [chartTickQuote, spotState.current, forexCfg.accountTiers, selectedTier]
  );

  // Trade Sizing Calculations
  const parsedLots = Math.max(0.01, Math.min(100, Number(lotSize) || 0.01));
  const parsedSlPips = Math.max(0, Number(slPips) || 0);
  const parsedTpPips = Math.max(0, Number(tpPips) || 0);

  const notionalUsd = useMemo(
    () => computeNotionalUsd(activePair, parsedLots, bidPrice),
    [activePair, parsedLots, bidPrice]
  );
  const safeLeverage = Math.min(leverage, selectedTier.maxLeverage);
  const requiredMarginUsd = Number((notionalUsd / Math.max(1, safeLeverage)).toFixed(2));
  const tradeCommissionUsd = Number((parsedLots * selectedTier.commissionPerLot).toFixed(2));
  const totalOutlayUsd = Number((requiredMarginUsd + tradeCommissionUsd).toFixed(2));

  const pipValuePerLot = useMemo(
    () => computePipValuePerLot(activePair, bidPrice),
    [activePair, bidPrice]
  );
  const pipValueUsd = pipValuePerLot * parsedLots;
  const estSlLossUsd = parsedSlPips * pipValueUsd;
  const estTpProfitUsd = parsedTpPips * pipValueUsd;

  const meetsTierMin = effectiveBalance >= selectedTier.minDepositUsd;
  const vaultCoversTotal = effectiveBalance >= totalOutlayUsd;

  // Open & Closed Forex Trades
  const openTrades = useMemo(
    () => forexTrades.filter((t) => t.status === 'open'),
    [forexTrades]
  );
  const closedTrades = useMemo(
    () => forexTrades.filter((t) => t.status === 'closed'),
    [forexTrades]
  );

  const computeTradeFloating = useCallback(
    (trade: ForexTrade) => {
      const { pair, liveBid, liveAsk } = getSymbolQuotes(trade.symbol, trade.accountTierId);
      const closePrice = trade.direction === 'BUY' ? liveBid : liveAsk;
      const priceDiff =
        trade.direction === 'BUY'
          ? closePrice - trade.entryPrice
          : trade.entryPrice - closePrice;
      const pipsDiff = priceDiff / pair.pipSize;
      const pvPerLot = computePipValuePerLot(pair, trade.entryPrice);
      const pnlUsd = Number((pipsDiff * pvPerLot * trade.lots).toFixed(2));
      return { pair, closePrice, pipsDiff, pnlUsd };
    },
    [getSymbolQuotes]
  );

  const totalFloatingPnlUsd = useMemo(
    () =>
      openTrades.reduce((sum, t) => sum + computeTradeFloating(t).pnlUsd, 0),
    [openTrades, computeTradeFloating]
  );

  // Auto-SL / Auto-TP trigger check when price crosses SL or TP
  useEffect(() => {
    if (!isAuthenticated || openTrades.length === 0) return;
    openTrades.forEach((t) => {
      if (autoClosingIdsRef.current.has(t.id)) return;
      const { closePrice, pnlUsd } = computeTradeFloating(t);
      const hitTp =
        t.tpPrice > 0 &&
        ((t.direction === 'BUY' && closePrice >= t.tpPrice) ||
          (t.direction === 'SELL' && closePrice <= t.tpPrice));
      const hitSl =
        t.slPrice > 0 &&
        ((t.direction === 'BUY' && closePrice <= t.slPrice) ||
          (t.direction === 'SELL' && closePrice >= t.slPrice));

      if (hitTp || hitSl) {
        autoClosingIdsRef.current.add(t.id);
        closeForexTrade(t, closePrice, pnlUsd)
          .then(() => {
            emitToast(
              pnlUsd >= 0 ? 'ok' : 'err',
              `${hitTp ? 'Take Profit' : 'Stop Loss'} triggered for ${t.direction} ${t.lots} ${
                t.symbol
              } (${pnlUsd >= 0 ? '+' : ''}$${pnlUsd.toFixed(2)}).`
            );
          })
          .catch(() => {
            autoClosingIdsRef.current.delete(t.id);
          });
      }
    });
  }, [isAuthenticated, openTrades, computeTradeFloating, closeForexTrade, emitToast]);

  // Active position lines to overlay on the live chart for the active symbol
  const chartOverlays: ChartPositionOverlay[] = useMemo(
    () =>
      openTrades
        .filter((t) => t.symbol === activePair.symbol)
        .map((t) => ({
          id: t.id,
          direction: t.direction,
          entryPrice: t.entryPrice,
          slPrice: t.slPrice > 0 ? t.slPrice : undefined,
          tpPrice: t.tpPrice > 0 ? t.tpPrice : undefined,
          lots: t.lots,
        })),
    [openTrades, activePair.symbol]
  );

  const activeCopySubs = useMemo(
    () => copyTradeSubscriptions.filter((s) => s.status === 'active'),
    [copyTradeSubscriptions]
  );
  const stoppedCopySubs = useMemo(
    () => copyTradeSubscriptions.filter((s) => s.status === 'stopped'),
    [copyTradeSubscriptions]
  );

  const filteredTraders = useMemo(() => {
    const q = copySearch.trim().toLowerCase();
    return enabledTraders.filter((tr) => {
      const riskOk = copyRiskFilter === 'ALL' || tr.riskLevel === copyRiskFilter;
      if (!riskOk) return false;
      if (!q) return true;
      return (
        tr.name.toLowerCase().includes(q) ||
        tr.handle.toLowerCase().includes(q) ||
        tr.pairs.toLowerCase().includes(q) ||
        tr.strategy.toLowerCase().includes(q)
      );
    });
  }, [enabledTraders, copyRiskFilter, copySearch]);

  const handleExecuteTrade = async (direction: 'BUY' | 'SELL') => {
    if (!isAuthenticated) {
      onRequireAuth?.();
      return;
    }
    if (!hasPurchasedPackage) {
      emitToast(
        'err',
        'Buy an AI Trading package from your Deposit Wallet first. Forex trading only uses earned Income Wallet profits (Direct Deposit Trade is Upcoming).'
      );
      return;
    }
    const entryPrice = direction === 'BUY' ? askPrice : bidPrice;
    const slPrice =
      parsedSlPips > 0
        ? Number(
            (
              entryPrice +
              (direction === 'BUY' ? -1 : 1) * parsedSlPips * activePair.pipSize
            ).toFixed(activePair.decimals)
          )
        : 0;
    const tpPrice =
      parsedTpPips > 0
        ? Number(
            (
              entryPrice +
              (direction === 'BUY' ? 1 : -1) * parsedTpPips * activePair.pipSize
            ).toFixed(activePair.decimals)
          )
        : 0;

    setBusyAction(true);
    setLocalBanner(null);
    try {
      await openForexTrade({
        symbol: activePair.symbol,
        direction,
        tier: selectedTier,
        lots: parsedLots,
        leverage: safeLeverage,
        entryPrice,
        slPrice,
        tpPrice,
        marginUsd: requiredMarginUsd,
        commissionUsd: tradeCommissionUsd,
      });
      emitToast(
        'ok',
        `${direction} ${parsedLots.toFixed(2)} lots ${activePair.symbol} @ ${entryPrice.toFixed(
          activePair.decimals
        )} executed on ${selectedTier.name} account (Commission: $${tradeCommissionUsd.toFixed(2)}).`
      );
      setOrdersTab('open');
    } catch (err) {
      emitToast('err', (err as Error).message);
    } finally {
      setBusyAction(false);
    }
  };

  const handleClosePosition = async (trade: ForexTrade) => {
    if (!isAuthenticated) return;
    const { closePrice, pnlUsd } = computeTradeFloating(trade);
    setBusyAction(true);
    try {
      await closeForexTrade(trade, closePrice, pnlUsd);
      emitToast(
        pnlUsd >= 0 ? 'ok' : 'err',
        `Closed ${trade.direction} ${trade.lots.toFixed(2)} ${trade.symbol} @ ${closePrice.toFixed(
          2
        )}. Realized P&L: ${pnlUsd >= 0 ? '+' : ''}$${pnlUsd.toFixed(2)}.`
      );
    } catch (err) {
      emitToast('err', (err as Error).message);
    } finally {
      setBusyAction(false);
    }
  };

  const handleCloseAllOpen = async () => {
    if (!isAuthenticated || openTrades.length === 0) return;
    setBusyAction(true);
    let closedCount = 0;
    try {
      for (const t of openTrades) {
        const { closePrice, pnlUsd } = computeTradeFloating(t);
        await closeForexTrade(t, closePrice, pnlUsd);
        closedCount++;
      }
      emitToast('ok', `Closed ${closedCount} open position(s) at live market quotes.`);
    } catch (err) {
      emitToast('err', (err as Error).message);
    } finally {
      setBusyAction(false);
    }
  };

  const handleStartCopy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCopyTrader) return;
    if (!isAuthenticated) {
      onRequireAuth?.();
      return;
    }
    if (!hasPurchasedPackage) {
      emitToast(
        'err',
        'Buy an AI Trading package from your Deposit Wallet first. Copy Trading unlocks strictly with earned Income Wallet balance (Direct Deposit Trade is Upcoming).'
      );
      return;
    }
    setBusyAction(true);
    setLocalBanner(null);
    try {
      const alloc = Number(copyAllocUsd);
      await startCopyTrade({
        trader: activeCopyTrader,
        accountTierId: copyTierId,
        allocatedUsd: alloc,
        riskMultiplier: copyMultiplier,
        stopLossPercent: copyStopLossPct,
      });
      emitToast(
        'ok',
        `Started copying ${activeCopyTrader.name} (${activeCopyTrader.handle}) with $${alloc.toFixed(
          2
        )} (${copyMultiplier}x ratio).`
      );
      setActiveCopyTrader(null);
    } catch (err) {
      emitToast('err', (err as Error).message);
    } finally {
      setBusyAction(false);
    }
  };

  const openCopyModal = (trader: CopyTraderProfile) => {
    setActiveCopyTrader(trader);
    setCopyAllocUsd(String(Math.max(trader.minCopyUsd, 50)));
    setCopyMultiplier(1);
    setCopyStopLossPct(25);
    setCopyTierId(trader.recommendedTierId || 'standard');
  };

  return (
    <div className="space-y-5">
      {/* 1. Live Alphatradex FX Ticker Tape */}
      <div className="bg-[#0B111E]/90 backdrop-blur-md border border-slate-700/70 rounded-2xl px-2 py-1 shadow-xl overflow-hidden">
        <AlphatradexTickerTape
          onSelectSymbol={(sym) => {
            setSelectedSymbol(sym);
            setTerminalTab('terminal');
          }}
        />
      </div>

      {/* 2. WebTerminal / Copy Trade / Exness 3-Tier Switcher & Live Account Strip */}
      <div className="bg-[#0B111E]/90 backdrop-blur-md border border-slate-700/70 rounded-2xl p-3.5 shadow-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800">
          <button
            type="button"
            onClick={() => setTerminalTab('terminal')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
              terminalTab === 'terminal'
                ? 'bg-orange-600 text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            WebTerminal
          </button>
          <button
            type="button"
            onClick={() => setTerminalTab('copy-trade')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
              terminalTab === 'copy-trade'
                ? 'bg-orange-600 text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Copy className="w-3.5 h-3.5" />
            Copy Trade ({activeCopySubs.length > 0 ? `${activeCopySubs.length} Active` : enabledTraders.length})
          </button>
          <button
            type="button"
            onClick={() => setTerminalTab('account-tiers')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
              terminalTab === 'account-tiers'
                ? 'bg-orange-600 text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            3 Account Categories
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums">
          <div>
            <span className="text-slate-400">Income Wallet: </span>
            <strong className="text-emerald-400">${incomeBalance.toFixed(2)}</strong>
          </div>
          {isAuthenticated && (
            <div>
              <span className="text-slate-400">Deposit Wallet: </span>
              <strong className="text-sky-300">${depositBalance.toFixed(2)}</strong>
              <span className="text-[10px] text-slate-500 ml-1">(Plans Only)</span>
            </div>
          )}
          <div>
            <span className="text-slate-400">Open Orders: </span>
            <strong className="text-white">{openTrades.length}</strong>
          </div>
          <div>
            <span className="text-slate-400">Floating P&amp;L: </span>
            <strong
              className={
                totalFloatingPnlUsd > 0
                  ? 'text-emerald-400'
                  : totalFloatingPnlUsd < 0
                  ? 'text-red-400'
                  : 'text-slate-200'
              }
            >
              {totalFloatingPnlUsd >= 0 ? '+' : ''}${totalFloatingPnlUsd.toFixed(2)}
            </strong>
          </div>
        </div>
      </div>

      {/* Wallet Mode Strip: Income Wallet Trading (LIVE) vs Direct Deposit Trading (Upcoming) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-[#0B111E]/90 backdrop-blur-md border border-emerald-500/40 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
              <Wallet className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-display font-bold text-white">
                  Income Wallet Trading (Profit &amp; Commission)
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono text-[10px] font-bold uppercase">
                  Active
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                Deposit into Deposit Wallet → Buy a Plan → Trade Forex strictly with earned Profit &amp; Commission USD to grow your Income Wallet.
              </p>
            </div>
          </div>
          {isAuthenticated && (
            <div className="text-right font-mono shrink-0">
              <div className="text-[10px] text-slate-400">Available</div>
              <div className="text-sm font-bold text-emerald-400 tabular-nums">
                ${incomeBalance.toFixed(2)}
              </div>
            </div>
          )}
        </div>

        <div className="bg-[#0B111E]/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-lg opacity-90">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/35 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
              <Lock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-display font-bold text-white">
                  Direct Deposit Trade
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-[10px] font-bold uppercase">
                  Upcoming
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                Direct Forex trading with Deposit Wallet funds is upcoming. Deposit Wallet is currently for purchasing plans.
              </p>
            </div>
          </div>
          {isAuthenticated && onNavigateToPackages && !hasPurchasedPackage && (
            <button
              type="button"
              onClick={onNavigateToPackages}
              className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors"
            >
              Buy Plan
            </button>
          )}
        </div>
      </div>

      {/* Package Required Notice if authenticated without any package yet */}
      {isAuthenticated && !hasPurchasedPackage && (
        <div className="px-4 py-3.5 rounded-xl border border-amber-500/50 bg-amber-950/55 text-xs text-amber-100 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="font-semibold text-amber-200">
              Package Activation Required Before Forex Trading
            </div>
            <p className="text-[11px] text-amber-200/85">
              Direct trading from Deposit Wallet is Upcoming. First fund your Deposit Wallet, purchase an AI Trading plan, and trade Forex strictly using earned Profit &amp; Commission dollars in your Income Wallet.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onNavigateToDeposit && (
              <button
                type="button"
                onClick={onNavigateToDeposit}
                className="px-3 py-1.5 rounded-lg border border-sky-500/50 bg-sky-950/60 hover:bg-sky-900/70 text-sky-200 text-xs font-semibold transition-colors"
              >
                1. Deposit Funds
              </button>
            )}
            {onNavigateToPackages && (
              <button
                type="button"
                onClick={onNavigateToPackages}
                className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold transition-colors"
              >
                2. Buy Package
              </button>
            )}
          </div>
        </div>
      )}

      {/* Inline Feedback Notice */}
      {localBanner && (
        <div
          className={`px-4 py-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
            localBanner.type === 'ok'
              ? 'bg-emerald-950/75 border-emerald-500/60 text-emerald-100'
              : 'bg-red-950/75 border-red-500/60 text-red-100'
          }`}
        >
          <span>{localBanner.text}</span>
          <button
            type="button"
            onClick={() => setLocalBanner(null)}
            className="text-xs underline opacity-80 hover:opacity-100 shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 1: SELF-TRADING WEBTERMINAL                                       */}
      {/* ===================================================================== */}
      {terminalTab === 'terminal' && (
        <div className="space-y-5">
          {/* 3-Category Exness Account Selector Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {enabledTiers.map((tier) => {
              const active = tier.id === selectedTier.id;
              const eligible = effectiveBalance >= tier.minDepositUsd;
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setSelectedTierId(tier.id)}
                  className={`p-4 rounded-2xl border text-left transition-colors ${
                    active
                      ? 'bg-[#0B111E] border-orange-500/90 shadow-lg'
                      : 'bg-[#0B111E]/75 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display font-bold text-sm text-white">
                      {tier.name} Account
                    </span>
                    <span
                      className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded ${
                        tier.commissionPerLot === 0
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                          : 'bg-orange-500/15 text-orange-300 border border-orange-500/40'
                      }`}
                    >
                      {tier.commissionPerLot === 0
                        ? '$0 / lot'
                        : `$${tier.commissionPerLot.toFixed(2)} / lot`}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{tier.tagline}</p>
                  <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-slate-800/80 text-[11px] font-mono tabular-nums">
                    <span className="text-slate-300">
                      Spread: <strong className="text-white">{tier.spreadMultiplier}x</strong>
                    </span>
                    <span className="text-slate-300">
                      Lev: <strong className="text-white">1:{tier.maxLeverage}</strong>
                    </span>
                    <span className={eligible ? 'text-emerald-400' : 'text-amber-400'}>
                      Min ${tier.minDepositUsd}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 6-Pair Instrument Strip */}
          <div className="bg-[#0B111E]/85 backdrop-blur-md border border-slate-700/70 rounded-2xl p-3 shadow-xl">
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
              {FOREX_PAIRS.map((pair) => {
                const liveVal =
                  chartTickQuote && chartTickQuote.symbol === pair.symbol
                    ? chartTickQuote.bid
                    : spotState.current[pair.symbol] ?? pair.basePrice;
                const refVal = spotState.previous[pair.symbol] ?? pair.basePrice;
                const pairDeltaPct = ((liveVal - refVal) / Math.max(1e-6, refVal)) * 100;
                const up = pairDeltaPct >= 0;
                const isSelected = pair.symbol === activePair.symbol;
                const pairSpread = Number(
                  (pair.spreadPips * selectedTier.spreadMultiplier).toFixed(2)
                );

                return (
                  <button
                    key={pair.symbol}
                    type="button"
                    onClick={() => setSelectedSymbol(pair.symbol)}
                    className={`min-w-[158px] px-3.5 py-2.5 rounded-xl border text-left transition-colors shrink-0 ${
                      isSelected
                        ? 'bg-slate-800/95 border-orange-500/75 text-white'
                        : 'bg-slate-900/55 border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display font-bold text-xs tracking-tight">
                        {pair.symbol}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {pairSpread}p
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-2 mt-1">
                      <span className="font-mono font-bold text-sm text-white tabular-nums">
                        {liveVal.toFixed(pair.decimals)}
                      </span>
                      <span
                        className={`font-mono text-[10px] font-semibold tabular-nums ${
                          up ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {up ? '+' : ''}
                        {pairDeltaPct.toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">{pair.session}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Split WebTerminal: 8-col Chart + 4-col Live Order Execution Desk */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
            {/* LEFT: Live Alphatradex Proprietary Chart */}
            <div className="xl:col-span-8 bg-[#0B111E]/85 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 flex flex-col justify-between shadow-xl space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-3 border-b border-slate-800">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-baseline gap-3">
                    <h2 className="font-display font-bold text-xl text-white tracking-tight">
                      {activePair.symbol}
                    </h2>
                    <span className="font-mono font-extrabold text-xl text-white tabular-nums">
                      {bidPrice.toFixed(activePair.decimals)}
                    </span>
                    <span className="text-xs font-mono font-semibold text-emerald-400">
                      {selectedTier.name} Feed ({effectiveSpreadPips}p)
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span>{activePair.name}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      Bid {bidPrice.toFixed(activePair.decimals)} / Ask{' '}
                      {askPrice.toFixed(activePair.decimals)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {selectedTier.executionType}
                    </span>
                  </div>
                </div>

                {/* Chart Controls */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <div className="flex items-center gap-0.5 p-1 rounded-lg bg-slate-900 border border-slate-800">
                    {(['15M', '1H', '4H', '1D', '1W'] as Timeframe[]).map((tf) => (
                      <button
                        key={tf}
                        type="button"
                        onClick={() => setTimeframe(tf)}
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
                    EMA
                  </button>

                  <button
                    type="button"
                    onClick={syncLiveSpotRates}
                    disabled={syncingSpots}
                    title="Refresh live spot rates"
                    className="px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:border-slate-600 text-[11px] font-mono inline-flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${syncingSpots ? 'animate-spin text-orange-400' : ''}`}
                    />
                    Sync
                  </button>
                </div>
              </div>

              <AlphatradexLiveChart
                symbol={activePair.tvSymbol}
                interval={TV_INTERVALS[timeframe]}
                chartStyle={chartMode === 'candles' ? '1' : '3'}
                showEma={showEma}
                liveSpotPrice={spotState.current[activePair.symbol] ?? activePair.basePrice}
                decimals={activePair.decimals}
                spreadPips={activePair.spreadPips}
                spreadMultiplier={selectedTier.spreadMultiplier}
                pipSize={activePair.pipSize}
                activePositions={chartOverlays}
                onLiveTick={(b, a) =>
                  setChartTickQuote({ symbol: activePair.symbol, bid: b, ask: a })
                }
              />

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-[11px] text-slate-400">
                <div className="flex items-center gap-4">
                  <span className="inline-flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    Session: <strong className="text-slate-200">{activePair.session}</strong>
                  </span>
                  <span className="font-mono text-emerald-400">{lastSyncLabel}</span>
                </div>
                <span className="font-mono text-slate-400">
                  Alphatradex Live WebTerminal · Real-time Order &amp; SL/TP Engine
                </span>
              </div>
            </div>

            {/* RIGHT: Self-Trading WebTerminal Order Ticket */}
            <div className="xl:col-span-4 bg-[#0B111E]/85 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 flex flex-col justify-between space-y-5 shadow-xl">
              <div className="space-y-4">
                <div className="pb-3 border-b border-slate-800 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      {selectedTier.name} WebTerminal
                    </span>
                    <span className="text-[11px] font-mono text-emerald-300 tabular-nums">
                      Income: ${effectiveBalance.toFixed(2)}
                    </span>
                  </div>
                  <h3 className="font-display font-bold text-lg text-white">
                    Market Order · {activePair.symbol}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Orders trade strictly using Profit &amp; Commission USD in your Income Wallet after package purchase; P&amp;L grows your Income Wallet. (Direct Deposit Trade: Upcoming)
                  </p>
                </div>

                {/* Volume (Lots) */}
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                    <span>Volume (Lots)</span>
                    <div className="flex items-center gap-1">
                      {['0.01', '0.05', '0.10', '0.50', '1.00'].map((preset) => (
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
                    max={100}
                    step="0.01"
                    value={lotSize}
                    onChange={(e) => setLotSize(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/90 text-white font-mono text-sm tabular-nums"
                  />
                </div>

                {/* Leverage */}
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                    <span>Account Leverage</span>
                    <span className="font-mono text-slate-300">Max 1:{selectedTier.maxLeverage}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[50, 100, 200, 500]
                      .filter((lev) => lev <= selectedTier.maxLeverage)
                      .map((lev) => (
                        <button
                          key={lev}
                          type="button"
                          onClick={() => setLeverage(lev)}
                          className={`py-1.5 rounded-lg border font-mono text-xs font-semibold transition-colors ${
                            safeLeverage === lev
                              ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                              : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                          }`}
                        >
                          1:{lev}
                        </button>
                      ))}
                  </div>
                </div>

                {/* Stop Loss & Take Profit (Pips) */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Stop Loss (Pips, 0=off)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={slPips}
                      onChange={(e) => setSlPips(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900/90 text-white font-mono text-xs tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Take Profit (Pips, 0=off)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={tpPips}
                      onChange={(e) => setTpPips(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900/90 text-white font-mono text-xs tabular-nums"
                    />
                  </div>
                </div>

                {/* Financial Breakdown */}
                <div className="pt-2.5 border-t border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Position Notional</span>
                    <span className="font-mono font-semibold text-white tabular-nums">
                      ${notionalUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Required Margin (1:{safeLeverage})</span>
                    <span className="font-mono font-semibold text-white tabular-nums">
                      ${requiredMarginUsd.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">
                      Trade Commission ({selectedTier.name})
                    </span>
                    <span className="font-mono font-semibold text-orange-300 tabular-nums">
                      ${tradeCommissionUsd.toFixed(2)} (${selectedTier.commissionPerLot.toFixed(2)}/lot)
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                    <span className="text-slate-200 font-semibold">Total Income Outlay</span>
                    <span
                      className={`font-mono font-bold tabular-nums ${
                        vaultCoversTotal && meetsTierMin && hasPurchasedPackage
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }`}
                    >
                      ${totalOutlayUsd.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Projected TP / SL</span>
                    <span className="font-mono tabular-nums">
                      <span className="text-emerald-400 font-semibold">
                        +${estTpProfitUsd.toFixed(2)}
                      </span>
                      <span className="text-slate-600 mx-1">/</span>
                      <span className="text-red-400 font-semibold">
                        -${estSlLossUsd.toFixed(2)}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Execution Buttons */}
              <div className="space-y-2.5 pt-3 border-t border-slate-800">
                {isAuthenticated && !hasPurchasedPackage ? (
                  <div className="p-2.5 rounded-lg bg-amber-950/60 border border-amber-500/40 text-[11px] text-amber-200">
                    Buy a package from Deposit Wallet first to unlock Income Wallet trading. Direct Deposit Trade is Upcoming.
                  </div>
                ) : (
                  !meetsTierMin &&
                  isAuthenticated && (
                    <div className="p-2.5 rounded-lg bg-amber-950/60 border border-amber-500/40 text-[11px] text-amber-200">
                      {selectedTier.name} tier requires min ${selectedTier.minDepositUsd} in Income Wallet. Switch to Standard ($10 min) or earn more package profit.
                    </div>
                  )
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={busyAction}
                    onClick={() => handleExecuteTrade('SELL')}
                    className="py-3 px-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white flex flex-col items-center justify-center transition-colors shadow-lg shadow-red-950/40"
                  >
                    <span className="text-[10px] font-mono uppercase tracking-wider opacity-90 inline-flex items-center gap-1">
                      <TrendingDown className="w-3 h-3" />
                      Sell Market
                    </span>
                    <span className="font-mono font-bold text-sm tabular-nums mt-0.5">
                      {bidPrice.toFixed(activePair.decimals)}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={busyAction}
                    onClick={() => handleExecuteTrade('BUY')}
                    className="py-3 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white flex flex-col items-center justify-center transition-colors shadow-lg shadow-emerald-950/40"
                  >
                    <span className="text-[10px] font-mono uppercase tracking-wider opacity-90 inline-flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      Buy Market
                    </span>
                    <span className="font-mono font-bold text-sm tabular-nums mt-0.5">
                      {askPrice.toFixed(activePair.decimals)}
                    </span>
                  </button>
                </div>

                {!isAuthenticated && (
                  <p className="text-[11px] text-slate-400 text-center">
                    Sign in, deposit to buy a plan, and trade live using your Income Wallet Profit &amp; Commission USD (Direct Deposit Trade: Upcoming).
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Open Positions & Closed History Panel */}
          <div className="bg-[#0B111E]/90 backdrop-blur-md border border-slate-700/70 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-5 py-3.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOrdersTab('open')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    ordersTab === 'open'
                      ? 'bg-orange-600 text-white'
                      : 'bg-slate-900 text-slate-300 hover:text-white'
                  }`}
                >
                  Open Positions ({openTrades.length})
                </button>
                <button
                  type="button"
                  onClick={() => setOrdersTab('history')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                    ordersTab === 'history'
                      ? 'bg-orange-600 text-white'
                      : 'bg-slate-900 text-slate-300 hover:text-white'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  Closed History ({closedTrades.length})
                </button>
              </div>

              {ordersTab === 'open' && openTrades.length > 1 && (
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={handleCloseAllOpen}
                  className="px-3 py-1.5 rounded-lg bg-red-600/90 hover:bg-red-500 text-white text-xs font-semibold transition-colors"
                >
                  Close All ({openTrades.length})
                </button>
              )}
            </div>

            {ordersTab === 'open' ? (
              openTrades.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  {isAuthenticated
                    ? 'No open positions yet. Select an Exness Account Category above and click Buy or Sell Market to place a live trade.'
                    : 'Sign in to view and manage live Forex positions.'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                        <th className="py-3 px-4">Pair / Tier</th>
                        <th className="py-3 px-3">Side &amp; Lots</th>
                        <th className="py-3 px-3">Entry → Market</th>
                        <th className="py-3 px-3">SL / TP</th>
                        <th className="py-3 px-3">Margin / Fee</th>
                        <th className="py-3 px-3">Floating P&amp;L</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
                      {openTrades.map((t) => {
                        const { pair, closePrice, pipsDiff, pnlUsd } = computeTradeFloating(t);
                        return (
                          <tr key={t.id} className="hover:bg-slate-900/50">
                            <td className="py-3 px-4">
                              <div className="font-display font-bold text-white">{t.symbol}</div>
                              <div className="text-[10px] text-slate-400">
                                {t.accountTierName} · 1:{t.leverage}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`font-bold ${
                                  t.direction === 'BUY' ? 'text-emerald-400' : 'text-red-400'
                                }`}
                              >
                                {t.direction}
                              </span>{' '}
                              <span className="text-white">{t.lots.toFixed(2)} lots</span>
                            </td>
                            <td className="py-3 px-3 text-slate-200">
                              {t.entryPrice.toFixed(pair.decimals)} →{' '}
                              <strong className="text-white">{closePrice.toFixed(pair.decimals)}</strong>
                            </td>
                            <td className="py-3 px-3 text-[11px] text-slate-400">
                              <div>SL: {t.slPrice > 0 ? t.slPrice.toFixed(pair.decimals) : '—'}</div>
                              <div>TP: {t.tpPrice > 0 ? t.tpPrice.toFixed(pair.decimals) : '—'}</div>
                            </td>
                            <td className="py-3 px-3 text-slate-300">
                              <div>${t.marginUsd.toFixed(2)}</div>
                              <div className="text-[10px] text-slate-400">
                                Fee: ${t.commissionUsd.toFixed(2)}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <div
                                className={`font-bold ${
                                  pnlUsd >= 0 ? 'text-emerald-400' : 'text-red-400'
                                }`}
                              >
                                {pnlUsd >= 0 ? '+' : ''}${pnlUsd.toFixed(2)}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {pipsDiff >= 0 ? '+' : ''}
                                {pipsDiff.toFixed(1)} pips
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                disabled={busyAction}
                                onClick={() => handleClosePosition(t)}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-orange-600 border border-slate-700 hover:border-orange-500 text-white text-[11px] font-sans font-semibold transition-colors"
                              >
                                Close
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            ) : closedTrades.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No closed Forex trades yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                      <th className="py-3 px-4">Pair / Tier</th>
                      <th className="py-3 px-3">Side &amp; Lots</th>
                      <th className="py-3 px-3">Entry → Close</th>
                      <th className="py-3 px-3">Margin / Comm</th>
                      <th className="py-3 px-3">Realized P&amp;L</th>
                      <th className="py-3 px-4 text-right">Closed At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
                    {closedTrades.map((t) => {
                      const pair =
                        FOREX_PAIRS.find((p) => p.symbol === t.symbol) || FOREX_PAIRS[0];
                      return (
                        <tr key={t.id} className="hover:bg-slate-900/40">
                          <td className="py-3 px-4">
                            <div className="font-display font-bold text-white">{t.symbol}</div>
                            <div className="text-[10px] text-slate-400">{t.accountTierName}</div>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`font-bold ${
                                t.direction === 'BUY' ? 'text-emerald-400' : 'text-red-400'
                              }`}
                            >
                              {t.direction}
                            </span>{' '}
                            <span className="text-slate-200">{t.lots.toFixed(2)}</span>
                          </td>
                          <td className="py-3 px-3 text-slate-300">
                            {t.entryPrice.toFixed(pair.decimals)} →{' '}
                            {t.closePrice.toFixed(pair.decimals)}
                          </td>
                          <td className="py-3 px-3 text-slate-300">
                            ${t.marginUsd.toFixed(2)} / ${t.commissionUsd.toFixed(2)}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`font-bold ${
                                t.realizedPnlUsd >= 0 ? 'text-emerald-400' : 'text-red-400'
                              }`}
                            >
                              {t.realizedPnlUsd >= 0 ? '+' : ''}${t.realizedPnlUsd.toFixed(2)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-[11px] text-slate-400">
                            {t.closedAtMs
                              ? new Date(t.closedAtMs).toLocaleString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: COPY TRADE MARKETPLACE & ACTIVE MIRRORING DESK                 */}
      {/* ===================================================================== */}
      {terminalTab === 'copy-trade' && (
        <div className="space-y-6">
          {/* Active Copy Subscriptions Desk */}
          {isAuthenticated && (activeCopySubs.length > 0 || stoppedCopySubs.length > 0) && (
            <div className="bg-[#0B111E]/90 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="font-display font-bold text-white text-base flex items-center gap-2">
                    <Layers className="w-4 h-4 text-orange-400" />
                    My Copy Trade Allocations ({activeCopySubs.length} Active)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Mirrored net profits accrue continuously after Master performance fee and settle into your Income Wallet.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {activeCopySubs.map((sub) => {
                  const pendingNet = computeCopyPendingNet(sub, clockMs);
                  const tierObj = forexCfg.accountTiers.find((t) => t.id === sub.accountTierId);
                  return (
                    <div
                      key={sub.id}
                      className="p-4 rounded-xl border border-slate-700/80 bg-slate-900/70 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-display font-bold text-white text-sm">
                            {sub.traderName}{' '}
                            <span className="font-mono text-xs text-orange-400">
                              {sub.traderHandle}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                            Tier: {tierObj?.name || sub.accountTierId} · Ratio {sub.riskMultiplier}x · SL {sub.stopLossPercent}%
                          </div>
                        </div>
                        <span className="font-mono text-[11px] font-bold text-emerald-400">
                          ACTIVE
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs font-mono tabular-nums pt-1">
                        <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
                          <div className="text-[10px] text-slate-400">Allocated</div>
                          <div className="font-bold text-white mt-0.5">
                            ${sub.allocatedUsd.toFixed(2)}
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
                          <div className="text-[10px] text-slate-400">Claimed Net</div>
                          <div className="font-bold text-slate-200 mt-0.5">
                            ${sub.claimedProfitUsd.toFixed(2)}
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-emerald-950/35 border border-emerald-700/50">
                          <div className="text-[10px] text-emerald-300">Accrued Live</div>
                          <div className="font-bold text-emerald-400 mt-0.5">
                            +${pendingNet.toFixed(4)}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={busyAction || pendingNet < 0.01}
                          onClick={async () => {
                            setBusyAction(true);
                            try {
                              const claimed = await claimCopyTradeProfit(sub);
                              emitToast(
                                'ok',
                                `Claimed $${claimed.toFixed(2)} net copy profit from ${sub.traderName} into your Income Wallet.`
                              );
                            } catch (err) {
                              emitToast('err', (err as Error).message);
                            } finally {
                              setBusyAction(false);
                            }
                          }}
                          className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 text-white text-xs font-semibold transition-colors"
                        >
                          Claim Profit (${pendingNet.toFixed(2)})
                        </button>
                        <button
                          type="button"
                          disabled={busyAction}
                          onClick={async () => {
                            setBusyAction(true);
                            try {
                              const res = await stopCopyTrade(sub);
                              emitToast(
                                'ok',
                                `Stopped copying ${sub.traderName}. Returned $${res.returnedCapitalUsd.toFixed(
                                  2
                                )} capital${
                                  res.claimedProfitUsd >= 0.01
                                    ? ` + $${res.claimedProfitUsd.toFixed(2)} profit`
                                    : ''
                                } to your Income Wallet.`
                              );
                            } catch (err) {
                              emitToast('err', (err as Error).message);
                            } finally {
                              setBusyAction(false);
                            }
                          }}
                          className="py-2 px-3 rounded-lg border border-red-500/60 bg-red-950/40 hover:bg-red-900/60 text-red-200 text-xs font-semibold transition-colors"
                        >
                          Stop &amp; Return Capital
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {stoppedCopySubs.length > 0 && (
                <div className="pt-2 border-t border-slate-800 space-y-1.5">
                  <div className="text-[11px] font-mono text-slate-400 uppercase">
                    Completed / Stopped Copy Allocations ({stoppedCopySubs.length})
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {stoppedCopySubs.slice(0, 4).map((s) => (
                      <div
                        key={s.id}
                        className="px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-800 flex items-center justify-between text-xs font-mono"
                      >
                        <span className="text-slate-300">
                          {s.traderName} (${s.allocatedUsd.toFixed(2)})
                        </span>
                        <span className="text-emerald-400">
                          Net +${s.claimedProfitUsd.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Master Strategy Providers Header + Filter */}
          <div className="bg-[#0B111E]/90 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display font-bold text-white text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-orange-400" />
                  Alphatradex Copy Trade · Verified Master Strategy Providers
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Mirror institutional FX &amp; Gold desks automatically using earned Profit &amp; Commission USD in your Income Wallet. Direct Deposit Trade is Upcoming.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={copySearch}
                    onChange={(e) => setCopySearch(e.target.value)}
                    placeholder="Search trader or pair..."
                    className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-900 border border-slate-800">
                  {(['ALL', 'Low', 'Moderate', 'Dynamic'] as const).map((rf) => (
                    <button
                      key={rf}
                      type="button"
                      onClick={() => setCopyRiskFilter(rf)}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                        copyRiskFilter === rf
                          ? 'bg-orange-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {rf}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {!forexCfg.copyTradingEnabled && (
              <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-950/50 text-xs text-amber-200">
                Copy Trading allocations are currently paused by administration.
              </div>
            )}

            {/* Master Traders Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTraders.map((tr) => {
                const isSelected = activeCopyTrader?.id === tr.id;
                const recTier = forexCfg.accountTiers.find((t) => t.id === tr.recommendedTierId);
                return (
                  <div
                    key={tr.id}
                    className={`p-5 rounded-2xl border transition-colors flex flex-col justify-between space-y-4 ${
                      isSelected
                        ? 'bg-slate-900 border-orange-500'
                        : 'bg-slate-900/65 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-display font-bold text-white text-base">
                              {tr.name}
                            </h3>
                            <span className="font-mono text-[11px] text-orange-400">
                              {tr.handle}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                            {tr.pairs} · Recommended: {recTier?.name || tr.recommendedTierId}
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                            tr.riskLevel === 'Low'
                              ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                              : tr.riskLevel === 'Moderate'
                              ? 'border-sky-500/40 bg-sky-500/15 text-sky-300'
                              : 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                          }`}
                        >
                          {tr.riskLevel} Risk
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">{tr.strategy}</p>

                      <div className="grid grid-cols-4 gap-2 text-xs font-mono tabular-nums pt-1">
                        <div className="p-2.5 rounded-lg bg-slate-950/75 border border-slate-800">
                          <div className="text-[10px] text-slate-400">30D ROI</div>
                          <div className="font-bold text-emerald-400 mt-0.5">
                            +{tr.monthlyRoiPercent}%
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-950/75 border border-slate-800">
                          <div className="text-[10px] text-slate-400">Win Rate</div>
                          <div className="font-bold text-white mt-0.5">{tr.winRatePercent}%</div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-950/75 border border-slate-800">
                          <div className="text-[10px] text-slate-400">Max DD</div>
                          <div className="font-bold text-amber-300 mt-0.5">
                            {tr.maxDrawdownPercent}%
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-950/75 border border-slate-800">
                          <div className="text-[10px] text-slate-400">Perf Fee</div>
                          <div className="font-bold text-slate-200 mt-0.5">
                            {tr.performanceFeePercent}%
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                        Min Copy <strong className="text-white">${tr.minCopyUsd}</strong> ·{' '}
                        {tr.followersCount} Copiers · Daily Target +{tr.dailyTargetPercent}%
                      </div>
                      <button
                        type="button"
                        onClick={() => openCopyModal(tr)}
                        className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold transition-colors"
                      >
                        Copy Strategy
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Active Copy Configuration Form Drawer */}
            {activeCopyTrader && (
              <form
                onSubmit={handleStartCopy}
                className="p-5 rounded-2xl border border-orange-500/70 bg-slate-950/90 space-y-4 mt-4"
              >
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
                  <div>
                    <h4 className="font-display font-bold text-white text-base">
                      Configure Copy Trade · {activeCopyTrader.name}
                    </h4>
                    <p className="text-xs text-slate-400">
                      Master takes {activeCopyTrader.performanceFeePercent}% fee on net profits only. You retain 100% control to stop anytime.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveCopyTrader(null)}
                    className="text-slate-400 hover:text-white"
                    aria-label="Close copy config"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Allocation Amount (USD, Min ${activeCopyTrader.minCopyUsd})
                    </label>
                    <input
                      type="number"
                      min={activeCopyTrader.minCopyUsd}
                      step="1"
                      required
                      value={copyAllocUsd}
                      onChange={(e) => setCopyAllocUsd(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-white font-mono text-sm tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Execution Account Tier
                    </label>
                    <select
                      value={copyTierId}
                      onChange={(e) => setCopyTierId(e.target.value as ForexAccountTierId)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-white text-xs font-semibold"
                    >
                      {enabledTiers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} (${t.commissionPerLot}/lot)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Lot Risk Multiplier
                    </label>
                    <div className="grid grid-cols-4 gap-1">
                      {[0.5, 1, 1.5, 2].map((mult) => (
                        <button
                          key={mult}
                          type="button"
                          onClick={() => setCopyMultiplier(mult)}
                          className={`py-2 rounded-lg border font-mono text-xs font-semibold ${
                            copyMultiplier === mult
                              ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                              : 'border-slate-800 bg-slate-900 text-slate-400'
                          }`}
                        >
                          {mult}x
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Equity Stop-Loss (%)
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                      {[15, 25, 40].map((sl) => (
                        <button
                          key={sl}
                          type="button"
                          onClick={() => setCopyStopLossPct(sl)}
                          className={`py-2 rounded-lg border font-mono text-xs font-semibold ${
                            copyStopLossPct === sl
                              ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                              : 'border-slate-800 bg-slate-900 text-slate-400'
                          }`}
                        >
                          -{sl}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="text-xs font-mono text-slate-300 tabular-nums">
                    Income Wallet: <strong className="text-emerald-400">${effectiveBalance.toFixed(2)}</strong> ·
                    Est. Net Daily Yield:{' '}
                    <strong className="text-emerald-400">
                      +$
                      {(
                        (Number(copyAllocUsd) || 0) *
                        (activeCopyTrader.dailyTargetPercent / 100) *
                        copyMultiplier *
                        (1 - activeCopyTrader.performanceFeePercent / 100)
                      ).toFixed(2)}
                      /day
                    </strong>
                  </div>

                  <button
                    type="submit"
                    disabled={busyAction}
                    className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {isAuthenticated ? 'Activate Copy Trade' : 'Sign In to Copy'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: 3 EXNESS-STYLE ACCOUNT CATEGORIES & COMMISSIONS                */}
      {/* ===================================================================== */}
      {terminalTab === 'account-tiers' && (
        <div className="space-y-5">
          <div className="bg-[#0B111E]/90 backdrop-blur-md border border-slate-700/70 rounded-2xl p-6 space-y-5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <h2 className="font-display font-bold text-white text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5 text-orange-400" />
                  Alphatradex Forex Account Categories (3 Institutional Tiers)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Choose between Standard zero-commission accounts, Pro tight-spread accounts, or Raw Spread interbank ECN pricing — all editable by administration.
                </p>
              </div>
              <span className="font-mono text-xs text-slate-300 tabular-nums">
                Income Wallet: <strong className="text-emerald-400">${effectiveBalance.toFixed(2)}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {forexCfg.accountTiers.map((tier) => {
                const isSelected = tier.id === selectedTier.id;
                return (
                  <div
                    key={tier.id}
                    className={`rounded-2xl border p-6 flex flex-col justify-between space-y-5 transition-colors ${
                      isSelected
                        ? 'bg-slate-900 border-orange-500'
                        : 'bg-slate-900/60 border-slate-800'
                    }`}
                  >
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-display font-extrabold text-white text-xl">
                            {tier.name}
                          </h3>
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                            {tier.tagline}
                          </p>
                        </div>
                        {!tier.enabled && (
                          <span className="text-[10px] font-mono text-red-400 uppercase">
                            Paused
                          </span>
                        )}
                      </div>

                      <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5 text-xs font-mono tabular-nums">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Trade Commission</span>
                          <span className="font-bold text-orange-300">
                            {tier.commissionPerLot === 0
                              ? '$0.00 / lot (No Comm)'
                              : `$${tier.commissionPerLot.toFixed(2)} / lot`}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Spread Factor</span>
                          <span className="font-bold text-emerald-400">
                            {tier.spreadMultiplier}x ({(tier.spreadMultiplier * 1.0).toFixed(2)}p EUR/USD)
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Min Income Balance</span>
                          <span className="font-bold text-white">${tier.minDepositUsd}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Max Leverage</span>
                          <span className="font-bold text-white">Up to 1:{tier.maxLeverage}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Execution Mode</span>
                          <span className="text-slate-200">{tier.executionType}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!tier.enabled}
                      onClick={() => {
                        setSelectedTierId(tier.id);
                        setTerminalTab('terminal');
                      }}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition-colors ${
                        isSelected
                          ? 'bg-orange-600 hover:bg-orange-500 text-white'
                          : 'bg-slate-800 hover:bg-slate-700 text-white'
                      } disabled:opacity-40`}
                    >
                      {isSelected ? `Selected · Trade on ${tier.name}` : `Trade with ${tier.name}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
