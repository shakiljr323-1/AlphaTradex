import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { encodeFunctionData, formatUnits, isAddress, parseUnits } from 'viem';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Unlink,
  Wallet,
  Zap,
} from 'lucide-react';
import {
  DEFAULT_WEB3_PAYMENT_CONFIG,
  OFFICIAL_WEB3_NETWORKS,
} from '../constants/defaults';
import { PlatformConfig, Web3ChainKey } from '../types/platform';

const ERC20_MIN_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
  isBinance?: boolean;
  isBinanceWallet?: boolean;
  providers?: Eip1193Provider[];
}

interface DiscoveredWallet {
  id: string;
  name: string;
  rdns?: string;
  icon?: string;
  provider: Eip1193Provider;
}

interface Eip6963AnnounceEvent extends Event {
  detail: {
    info: {
      uuid: string;
      name: string;
      icon: string;
      rdns: string;
    };
    provider: Eip1193Provider;
  };
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
    BinanceChain?: Eip1193Provider;
    binancew3w?: { ethereum?: Eip1193Provider };
    trustwallet?: Eip1193Provider;
  }
}

export interface VerifyWeb3DepositResponse {
  status: 'pending_mining' | 'confirming' | 'credited';
  confirmations: number;
  requiredConfirmations: number;
  verifiedAmountUsd?: number;
  newDepositBalance?: number;
  depositId?: string;
  blockNumber?: number;
  fromAddress?: string;
  toAddress?: string;
  tokenContract?: string;
  txHash: string;
  network: Web3ChainKey;
  explorerUrl?: string;
  message: string;
}

interface Web3AutoDepositPanelProps {
  platformConfig: PlatformConfig;
  currentDepositBalance: number;
  onVerifyTx: (params: {
    network: Web3ChainKey;
    txHash: string;
  }) => Promise<VerifyWeb3DepositResponse>;
  onNotify: (type: 'ok' | 'err', text: string) => void;
  compact?: boolean;
}

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function getInjectedProviders(discovered: DiscoveredWallet[]): {
  binance: Eip1193Provider | null;
  metamask: Eip1193Provider | null;
  trust: Eip1193Provider | null;
} {
  const allFrom6963 = discovered;
  const eth = typeof window !== 'undefined' ? window.ethereum : undefined;
  const subProviders: Eip1193Provider[] = [];
  if (eth?.providers && Array.isArray(eth.providers)) {
    subProviders.push(...eth.providers);
  }
  if (eth) subProviders.push(eth);

  const binance =
    allFrom6963.find(
      (w) =>
        w.rdns?.toLowerCase().includes('binance') ||
        w.name.toLowerCase().includes('binance')
    )?.provider ||
    (typeof window !== 'undefined' ? window.binancew3w?.ethereum : undefined) ||
    (typeof window !== 'undefined' ? window.BinanceChain : undefined) ||
    subProviders.find((p) => p.isBinance || p.isBinanceWallet) ||
    null;

  const trust =
    allFrom6963.find(
      (w) =>
        w.rdns?.toLowerCase().includes('trust') ||
        w.name.toLowerCase().includes('trust')
    )?.provider ||
    (typeof window !== 'undefined' ? window.trustwallet : undefined) ||
    subProviders.find((p) => p.isTrust || p.isTrustWallet) ||
    null;

  const metamask =
    allFrom6963.find(
      (w) =>
        w.rdns?.toLowerCase().includes('metamask') ||
        w.name.toLowerCase().includes('metamask')
    )?.provider ||
    subProviders.find((p) => p.isMetaMask && !p.isTrust && !p.isBinance) ||
    subProviders.find((p) => p.isMetaMask) ||
    null;

  return { binance, metamask, trust };
}

export const Web3AutoDepositPanel: React.FC<Web3AutoDepositPanelProps> = ({
  platformConfig,
  currentDepositBalance,
  onVerifyTx,
  onNotify,
  compact = false,
}) => {
  const web3Config = useMemo(
    () => ({
      ...DEFAULT_WEB3_PAYMENT_CONFIG,
      ...(platformConfig.web3PaymentConfig || {}),
    }),
    [platformConfig.web3PaymentConfig]
  );

  const enabledChains = useMemo<Web3ChainKey[]>(() => {
    const list: Web3ChainKey[] = [];
    if (web3Config.bep20Enabled) list.push('BEP20');
    if (web3Config.polygonEnabled) list.push('POLYGON');
    return list;
  }, [web3Config.bep20Enabled, web3Config.polygonEnabled]);

  const [selectedChain, setSelectedChain] = useState<Web3ChainKey>(
    enabledChains[0] || 'BEP20'
  );
  const [amountInput, setAmountInput] = useState<string>(
    String(Math.max(100, Number(web3Config.minDepositUsd) || 10))
  );

  // Wallet connection state
  const [discoveredWallets, setDiscoveredWallets] = useState<DiscoveredWallet[]>([]);
  const [activeProvider, setActiveProvider] = useState<Eip1193Provider | null>(null);
  const [connectedWalletLabel, setConnectedWalletLabel] = useState<string>('');
  const [connectedAddress, setConnectedAddress] = useState<string>('');
  const [connectedChainId, setConnectedChainId] = useState<number | null>(null);
  const [walletUsdtBalance, setWalletUsdtBalance] = useState<string | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState(false);

  // Mobile QR / WalletConnect drawer state
  const [showMobileQr, setShowMobileQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');

  // Transaction & server verification state
  const [sendingTx, setSendingTx] = useState(false);
  const [verifyingTx, setVerifyingTx] = useState(false);
  const [activeTxHash, setActiveTxHash] = useState('');
  const [manualTxHash, setManualTxHash] = useState('');
  const [showManualVerifier, setShowManualVerifier] = useState(false);
  const [verificationState, setVerificationState] =
    useState<VerifyWeb3DepositResponse | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState('');

  const pollTimerRef = useRef<number | null>(null);
  const pollAttemptsRef = useRef(0);

  // Keep selected chain valid when admin toggles chains
  useEffect(() => {
    if (enabledChains.length > 0 && !enabledChains.includes(selectedChain)) {
      setSelectedChain(enabledChains[0]);
    }
  }, [enabledChains, selectedChain]);

  // Discover EIP-6963 browser wallets (Binance Web3, MetaMask, Trust Wallet, Rabby, etc.)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onAnnounce = (event: Event) => {
      const e = event as Eip6963AnnounceEvent;
      if (!e?.detail?.provider || !e?.detail?.info?.uuid) return;
      setDiscoveredWallets((prev) => {
        if (prev.some((w) => w.id === e.detail.info.uuid)) return prev;
        return [
          ...prev,
          {
            id: e.detail.info.uuid,
            name: e.detail.info.name,
            rdns: e.detail.info.rdns,
            icon: e.detail.info.icon,
            provider: e.detail.provider,
          },
        ];
      });
    };
    window.addEventListener('eip6963:announceProvider', onAnnounce);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    return () => {
      window.removeEventListener('eip6963:announceProvider', onAnnounce);
    };
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        window.clearTimeout(pollTimerRef.current);
      }
    };
  }, []);

  const networkSpec = OFFICIAL_WEB3_NETWORKS[selectedChain];
  const adminReceivingAddress =
    selectedChain === 'BEP20'
      ? web3Config.bep20ReceivingAddress
      : web3Config.polygonReceivingAddress;
  const requiredConfirmations =
    selectedChain === 'BEP20'
      ? web3Config.minConfirmationsBsc
      : web3Config.minConfirmationsPolygon;

  const isReceivingAddressValid = isAddress(adminReceivingAddress || '');
  const depositsPaused = Boolean(platformConfig.depositsPaused);
  const autoDepositDisabled =
    !web3Config.autoDepositEnabled || enabledChains.length === 0;

  const parsedAmount = Number(amountInput);
  const amountValid =
    Number.isFinite(parsedAmount) &&
    parsedAmount >= web3Config.minDepositUsd &&
    parsedAmount <= web3Config.maxDepositUsd;

  // Build EIP-681 payment URI for Binance Web3 / Trust / MetaMask / WalletConnect mobile QR scanning
  const eip681Uri = useMemo(() => {
    if (!isReceivingAddressValid) return '';
    try {
      const safeAmt =
        Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : web3Config.minDepositUsd;
      const rawUnits = parseUnits(safeAmt.toFixed(6), networkSpec.usdtDecimals);
      return `ethereum:${networkSpec.usdtContract}@${networkSpec.chainId}/transfer?address=${adminReceivingAddress}&uint256=${rawUnits.toString()}`;
    } catch {
      return adminReceivingAddress;
    }
  }, [
    isReceivingAddressValid,
    parsedAmount,
    web3Config.minDepositUsd,
    networkSpec.usdtContract,
    networkSpec.chainId,
    networkSpec.usdtDecimals,
    adminReceivingAddress,
  ]);

  useEffect(() => {
    if (!showMobileQr || !eip681Uri) {
      setQrDataUrl('');
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(eip681Uri, {
      width: 210,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0B111E', light: '#FFFFFF' },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [showMobileQr, eip681Uri]);

  const fetchWalletUsdtBalance = useCallback(
    async (provider: Eip1193Provider, account: string, chainKey: Web3ChainKey) => {
      if (!isAddress(account)) return;
      const spec = OFFICIAL_WEB3_NETWORKS[chainKey];
      setLoadingBalance(true);
      try {
        const callData = encodeFunctionData({
          abi: ERC20_MIN_ABI,
          functionName: 'balanceOf',
          args: [account as `0x${string}`],
        });
        const hexResult = (await provider.request({
          method: 'eth_call',
          params: [{ to: spec.usdtContract, data: callData }, 'latest'],
        })) as string;
        if (hexResult && hexResult.startsWith('0x') && hexResult.length > 2) {
          const bal = formatUnits(BigInt(hexResult), spec.usdtDecimals);
          setWalletUsdtBalance(Number(bal).toFixed(2));
        } else {
          setWalletUsdtBalance('0.00');
        }
      } catch {
        setWalletUsdtBalance(null);
      } finally {
        setLoadingBalance(false);
      }
    },
    []
  );

  const switchOrAddChain = useCallback(
    async (provider: Eip1193Provider, chainKey: Web3ChainKey): Promise<boolean> => {
      const spec = OFFICIAL_WEB3_NETWORKS[chainKey];
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: spec.chainIdHex }],
        });
        setConnectedChainId(spec.chainId);
        return true;
      } catch (err: unknown) {
        const code = (err as { code?: number })?.code;
        if (code === 4902 || code === -32603) {
          try {
            await provider.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: spec.chainIdHex,
                  chainName: spec.label,
                  nativeCurrency: {
                    name: spec.nativeSymbol,
                    symbol: spec.nativeSymbol,
                    decimals: 18,
                  },
                  rpcUrls: [spec.rpcUrl],
                  blockExplorerUrls: [spec.explorerTxBaseUrl.replace(/\/tx\/?$/, '')],
                },
              ],
            });
            setConnectedChainId(spec.chainId);
            return true;
          } catch (addErr) {
            setTxError(
              addErr instanceof Error
                ? addErr.message
                : `Please add ${spec.label} in your wallet to continue.`
            );
            return false;
          }
        }
        setTxError(
          err instanceof Error
            ? err.message
            : `Please switch your wallet to ${spec.label}.`
        );
        return false;
      }
    },
    []
  );

  // Sync balance whenever connected wallet or selected chain matches
  useEffect(() => {
    if (!activeProvider || !connectedAddress) return;
    if (connectedChainId === networkSpec.chainId) {
      void fetchWalletUsdtBalance(activeProvider, connectedAddress, selectedChain);
    } else {
      setWalletUsdtBalance(null);
    }
  }, [
    activeProvider,
    connectedAddress,
    connectedChainId,
    networkSpec.chainId,
    selectedChain,
    fetchWalletUsdtBalance,
  ]);

  // Listen to account / chain changes on active provider
  useEffect(() => {
    if (!activeProvider?.on) return;
    const onAccountsChanged = (accounts: unknown) => {
      const list = Array.isArray(accounts) ? (accounts as string[]) : [];
      if (list.length === 0) {
        setConnectedAddress('');
        setWalletUsdtBalance(null);
      } else {
        setConnectedAddress(list[0]);
      }
    };
    const onChainChanged = (hexId: unknown) => {
      if (typeof hexId === 'string') {
        const parsed = parseInt(hexId, 16);
        if (Number.isFinite(parsed)) setConnectedChainId(parsed);
      }
    };
    activeProvider.on('accountsChanged', onAccountsChanged);
    activeProvider.on('chainChanged', onChainChanged);
    return () => {
      activeProvider.removeListener?.('accountsChanged', onAccountsChanged);
      activeProvider.removeListener?.('chainChanged', onChainChanged);
    };
  }, [activeProvider]);

  const connectWallet = async (
    target: 'binance' | 'metamask' | 'trust' | 'walletconnect'
  ) => {
    setTxError(null);
    if (target === 'walletconnect') {
      setShowMobileQr(true);
      setShowManualVerifier(true);
      return;
    }

    const providers = getInjectedProviders(discoveredWallets);
    const chosenProvider =
      target === 'binance'
        ? providers.binance
        : target === 'trust'
        ? providers.trust
        : providers.metamask;

    const labelMap = {
      binance: 'Binance Web3 Wallet',
      metamask: 'MetaMask',
      trust: 'Trust Wallet',
    };

    if (!chosenProvider) {
      // No injected browser extension — open mobile QR / WalletConnect fallback cleanly
      setShowMobileQr(true);
      setShowManualVerifier(true);
      onNotify(
        'err',
        `${labelMap[target]} browser extension not detected. Scan the EIP-681 QR code with your ${labelMap[target]} mobile app and verify your TxHash below.`
      );
      return;
    }

    setConnectingWallet(true);
    try {
      const accounts = (await chosenProvider.request({
        method: 'eth_requestAccounts',
      })) as string[];
      if (!accounts || accounts.length === 0) {
        throw new Error('Wallet connection was cancelled.');
      }
      const rawChain = (await chosenProvider.request({
        method: 'eth_chainId',
      })) as string;
      const numericChain = parseInt(rawChain, 16);

      setActiveProvider(chosenProvider);
      setConnectedWalletLabel(labelMap[target]);
      setConnectedAddress(accounts[0]);
      setConnectedChainId(Number.isFinite(numericChain) ? numericChain : null);
      setShowMobileQr(false);

      if (numericChain !== networkSpec.chainId) {
        await switchOrAddChain(chosenProvider, selectedChain);
      }
      onNotify('ok', `Connected ${labelMap[target]} (${shortenAddress(accounts[0])}).`);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to connect Web3 wallet.';
      setTxError(msg);
      onNotify('err', msg);
    } finally {
      setConnectingWallet(false);
    }
  };

  const disconnectWallet = () => {
    setActiveProvider(null);
    setConnectedAddress('');
    setConnectedWalletLabel('');
    setConnectedChainId(null);
    setWalletUsdtBalance(null);
    setTxError(null);
  };

  const runServerVerification = useCallback(
    async (chainKey: Web3ChainKey, hash: string, isAutoPoll = false) => {
      const normalizedHash = hash.trim();
      if (!/^0x[a-fA-F0-9]{64}$/.test(normalizedHash)) {
        const msg = 'Enter a valid 66-character 0x transaction hash.';
        setTxError(msg);
        if (!isAutoPoll) onNotify('err', msg);
        return;
      }

      if (pollTimerRef.current) {
        window.clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }

      setVerifyingTx(true);
      setActiveTxHash(normalizedHash);
      if (!isAutoPoll) {
        setTxError(null);
        pollAttemptsRef.current = 0;
      }

      try {
        const result = await onVerifyTx({
          network: chainKey,
          txHash: normalizedHash,
        });
        setVerificationState(result);

        if (result.status === 'credited') {
          onNotify(
            'ok',
            `Verified & Credited $${(result.verifiedAmountUsd || 0).toFixed(2)} USDT on ${
              OFFICIAL_WEB3_NETWORKS[chainKey].shortName
            }!`
          );
          setManualTxHash('');
          if (activeProvider && connectedAddress) {
            void fetchWalletUsdtBalance(activeProvider, connectedAddress, chainKey);
          }
          return;
        }

        // Schedule automatic confirmation polling (up to 30 checks ~2 minutes)
        if (pollAttemptsRef.current < 30) {
          pollAttemptsRef.current += 1;
          pollTimerRef.current = window.setTimeout(() => {
            void runServerVerification(chainKey, normalizedHash, true);
          }, 4000);
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'On-chain verification failed.';
        setTxError(msg);
        if (!isAutoPoll) onNotify('err', msg);
      } finally {
        setVerifyingTx(false);
      }
    },
    [onVerifyTx, onNotify, activeProvider, connectedAddress, fetchWalletUsdtBalance]
  );

  const handleSendUsdtDeposit = async () => {
    setTxError(null);
    setVerificationState(null);

    if (depositsPaused) {
      setTxError('Deposits are currently paused by platform administration.');
      return;
    }
    if (autoDepositDisabled) {
      setTxError('Instant Web3 Auto-Deposit is currently disabled by administration.');
      return;
    }
    if (!isReceivingAddressValid) {
      setTxError('Admin receiving wallet address is not properly configured.');
      return;
    }
    if (!amountValid) {
      setTxError(
        `Enter a valid USDT amount between $${web3Config.minDepositUsd} and $${web3Config.maxDepositUsd}.`
      );
      return;
    }
    if (!activeProvider || !connectedAddress) {
      setTxError('Connect Binance Web3 Wallet, MetaMask, or Trust Wallet first.');
      return;
    }

    setSendingTx(true);
    try {
      // Ensure wallet is on the exact selected mainnet chain before sending
      const currentHex = (await activeProvider.request({
        method: 'eth_chainId',
      })) as string;
      const currentId = parseInt(currentHex, 16);
      if (currentId !== networkSpec.chainId) {
        const switched = await switchOrAddChain(activeProvider, selectedChain);
        if (!switched) {
          setSendingTx(false);
          return;
        }
      }

      const rawUnits = parseUnits(
        parsedAmount.toFixed(Math.min(6, networkSpec.usdtDecimals)),
        networkSpec.usdtDecimals
      );

      const transferData = encodeFunctionData({
        abi: ERC20_MIN_ABI,
        functionName: 'transfer',
        args: [adminReceivingAddress as `0x${string}`, rawUnits],
      });

      const txHash = (await activeProvider.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: connectedAddress,
            to: networkSpec.usdtContract,
            data: transferData,
            value: '0x0',
          },
        ],
      })) as string;

      if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
        throw new Error('Wallet did not return a valid transaction hash.');
      }

      onNotify(
        'ok',
        `Transaction broadcast! Verifying on-chain confirmations (${requiredConfirmations} blocks required)...`
      );
      setSendingTx(false);
      await runServerVerification(selectedChain, txHash, false);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'USDT transfer was cancelled or failed.';
      setTxError(msg);
      onNotify('err', msg);
      setSendingTx(false);
    }
  };

  const copyText = (key: string, val: string) => {
    if (!val) return;
    navigator.clipboard?.writeText(val).catch(() => {});
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(''), 1600);
  };

  return (
    <div className="space-y-4">
      {/* Zero Private Key & Instant Auto-Credit Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold text-emerald-400 uppercase tracking-wider">
            <Zap className="w-3.5 h-3.5" />
            <span>Instant Web3 Auto-Deposit</span>
          </div>
          <h3 className="font-display font-bold text-white text-base sm:text-lg mt-0.5">
            Direct On-Chain USDT Verification
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Send official USDT on BNB Smart Chain or Polygon. Verified automatically via mainnet RPC with zero private key exposure.
          </p>
        </div>
        {!compact && (
          <div className="text-right shrink-0">
            <div className="text-[10px] font-mono uppercase text-slate-400">Deposit Wallet</div>
            <div className="font-mono font-bold text-sm text-sky-300 tabular-nums">
              ${currentDepositBalance.toFixed(2)}
            </div>
          </div>
        )}
      </div>

      {depositsPaused && (
        <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-xs text-amber-200 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            Deposits are temporarily paused by administration for maintenance. Please try again shortly.
          </span>
        </div>
      )}

      {autoDepositDisabled && !depositsPaused && (
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700 text-xs text-slate-300 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            Instant Web3 Auto-Deposit is currently disabled. Please use the Manual TxID Deposit tab instead.
          </span>
        </div>
      )}

      {!depositsPaused && !autoDepositDisabled && (
        <>
          {/* Step 1: Select Network */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              1. Select Blockchain Network
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {enabledChains.map((chainKey) => {
                const spec = OFFICIAL_WEB3_NETWORKS[chainKey];
                const active = selectedChain === chainKey;
                const reqConf =
                  chainKey === 'BEP20'
                    ? web3Config.minConfirmationsBsc
                    : web3Config.minConfirmationsPolygon;
                return (
                  <button
                    key={chainKey}
                    type="button"
                    onClick={() => {
                      setSelectedChain(chainKey);
                      setTxError(null);
                      if (activeProvider && connectedChainId !== spec.chainId) {
                        void switchOrAddChain(activeProvider, chainKey);
                      }
                    }}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      active
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-slate-700/80 bg-slate-900/75 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display font-bold text-xs sm:text-sm text-white">
                        {spec.shortName}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-300">
                        {reqConf} confs
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-1">
                      Chain ID {spec.chainId} · Gas: {spec.nativeSymbol}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Verified Official Admin Receiving Address & Official USDT Contract */}
          <div className="p-3.5 rounded-xl bg-slate-900/85 border border-slate-700/75 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-slate-300 inline-flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Official Public Receiving Wallet ({networkSpec.shortName})</span>
              </span>
              <button
                type="button"
                onClick={() => copyText('admin-addr', adminReceivingAddress)}
                className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
              >
                {copiedKey === 'admin-addr' ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>{copiedKey === 'admin-addr' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-slate-100 break-all select-all">
              {adminReceivingAddress || 'Not configured'}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
              <span className="truncate">
                Official USDT Contract: {shortenAddress(networkSpec.usdtContract)}
              </span>
              <a
                href={`${networkSpec.explorerAddressBaseUrl}${networkSpec.usdtContract}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 shrink-0"
              >
                <span>Verify Contract</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Step 2: Connect Web3 Wallet */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">
                2. Connect Web3 Wallet
              </label>
              {connectedAddress && (
                <button
                  type="button"
                  onClick={disconnectWallet}
                  className="text-[11px] font-semibold text-slate-400 hover:text-rose-300 inline-flex items-center gap-1"
                >
                  <Unlink className="w-3 h-3" />
                  <span>Disconnect</span>
                </button>
              )}
            </div>

            {!connectedAddress ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={connectingWallet}
                  onClick={() => void connectWallet('binance')}
                  className="p-2.5 rounded-xl border border-amber-500/35 bg-amber-500/10 hover:bg-amber-500/15 text-left transition-colors"
                >
                  <div className="text-xs font-bold text-amber-200 flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Binance Web3</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Extension or Mobile</div>
                </button>

                <button
                  type="button"
                  disabled={connectingWallet}
                  onClick={() => void connectWallet('metamask')}
                  className="p-2.5 rounded-xl border border-orange-500/35 bg-orange-500/10 hover:bg-orange-500/15 text-left transition-colors"
                >
                  <div className="text-xs font-bold text-orange-200 flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                    <span>MetaMask</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Browser / EIP-6963</div>
                </button>

                <button
                  type="button"
                  disabled={connectingWallet}
                  onClick={() => void connectWallet('trust')}
                  className="p-2.5 rounded-xl border border-sky-500/35 bg-sky-500/10 hover:bg-sky-500/15 text-left transition-colors"
                >
                  <div className="text-xs font-bold text-sky-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span>Trust Wallet</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">BEP-20 &amp; Polygon</div>
                </button>

                <button
                  type="button"
                  disabled={connectingWallet}
                  onClick={() => void connectWallet('walletconnect')}
                  className="p-2.5 rounded-xl border border-slate-700 bg-slate-900/90 hover:border-emerald-500/50 text-left transition-colors"
                >
                  <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>WalletConnect QR</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Scan via Mobile App</div>
                </button>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-950/25 border border-emerald-500/35 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="space-y-0.5">
                  <div className="font-semibold text-emerald-300 flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5" />
                    <span>{connectedWalletLabel || 'Web3 Wallet Connected'}</span>
                  </div>
                  <div className="font-mono text-slate-200 text-[11px]">
                    {shortenAddress(connectedAddress)} ·{' '}
                    {connectedChainId === networkSpec.chainId ? (
                      <span className="text-emerald-400">{networkSpec.shortName}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          activeProvider && void switchOrAddChain(activeProvider, selectedChain)
                        }
                        className="text-amber-300 underline"
                      >
                        Switch to {networkSpec.shortName}
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] font-mono text-slate-400 uppercase">Wallet USDT</div>
                  <div className="font-mono font-bold text-white tabular-nums">
                    {loadingBalance
                      ? '...'
                      : walletUsdtBalance !== null
                      ? `${walletUsdtBalance} USDT`
                      : '—'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Step 3: USDT Amount */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-slate-300">
                3. Deposit Amount (USDT)
              </label>
              <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                Min ${web3Config.minDepositUsd} · Max ${web3Config.maxDepositUsd.toLocaleString()}
              </span>
            </div>
            <input
              type="number"
              min={web3Config.minDepositUsd}
              max={web3Config.maxDepositUsd}
              step="0.01"
              value={amountInput}
              onChange={(e) => {
                setAmountInput(e.target.value);
                setTxError(null);
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-900/90 text-white font-mono text-base font-bold focus:outline-none focus:border-emerald-500 tabular-nums"
            />
            <div className="flex flex-wrap gap-1.5">
              {[50, 100, 300, 500, 1000]
                .filter(
                  (amt) => amt >= web3Config.minDepositUsd && amt <= web3Config.maxDepositUsd
                )
                .map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAmountInput(String(amt))}
                    className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-900 hover:border-emerald-500/60 hover:text-emerald-300 text-[11px] font-mono text-slate-300 transition-colors"
                  >
                    ${amt}
                  </button>
                ))}
            </div>
          </div>

          {/* Primary Pay Button */}
          {connectedAddress && (
            <button
              type="button"
              disabled={sendingTx || verifyingTx || !amountValid || !isReceivingAddressValid}
              onClick={() => void handleSendUsdtDeposit()}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors"
            >
              {sendingTx ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Confirm Transfer in {connectedWalletLabel}...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>
                    Pay {Number.isFinite(parsedAmount) ? `$${parsedAmount.toFixed(2)}` : ''} USDT &amp; Auto-Credit
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}

          {/* Mobile WalletConnect / EIP-681 QR Panel */}
          {showMobileQr && (
            <div className="p-4 rounded-xl bg-slate-900/95 border border-slate-700 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <span>Scan with Binance Web3 / MetaMask / Trust Wallet</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMobileQr(false)}
                  className="text-[11px] text-slate-400 hover:text-white"
                >
                  Hide QR
                </button>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="p-2 bg-white rounded-xl shrink-0">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={`${networkSpec.shortName} EIP-681 Payment QR`}
                      className="w-40 h-40 object-contain"
                    />
                  ) : (
                    <div className="w-40 h-40 flex items-center justify-center text-slate-500 text-xs">
                      Generating QR...
                    </div>
                  )}
                </div>
                <div className="space-y-2 text-xs text-slate-300">
                  <p>
                    1. Scan this EIP-681 QR code in your mobile Web3 wallet to pre-fill the official{' '}
                    <strong className="text-white">{networkSpec.shortName}</strong> USDT transfer of{' '}
                    <strong className="font-mono text-emerald-300">
                      ${Number.isFinite(parsedAmount) ? parsedAmount.toFixed(2) : web3Config.minDepositUsd}
                    </strong>
                    .
                  </p>
                  <p>
                    2. Confirm the transaction in your wallet, then paste the resulting{' '}
                    <code className="text-amber-300">0x...</code> Transaction Hash below for instant server-side on-chain credit.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {txError && (
            <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/45 text-xs text-rose-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{txError}</span>
            </div>
          )}

          {/* Live On-Chain Verification Status Card */}
          {verificationState && (
            <div
              className={`p-4 rounded-xl border space-y-2.5 text-xs ${
                verificationState.status === 'credited'
                  ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-100'
                  : 'bg-sky-950/40 border-sky-500/45 text-sky-100'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold flex items-center gap-1.5">
                  {verificationState.status === 'credited' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Deposit Verified &amp; Credited Automatically</span>
                    </>
                  ) : (
                    <>
                      <Loader2 className="w-4 h-4 text-sky-400 animate-spin" />
                      <span>
                        Confirming On-Chain ({verificationState.confirmations} /{' '}
                        {verificationState.requiredConfirmations} blocks)
                      </span>
                    </>
                  )}
                </div>
                {verificationState.explorerUrl && (
                  <a
                    href={verificationState.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-mono text-sky-300 hover:underline inline-flex items-center gap-1"
                  >
                    <span>Explorer</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <p className="text-slate-300 leading-relaxed">{verificationState.message}</p>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80 font-mono text-[11px] text-slate-300">
                <span>Tx: {shortenAddress(verificationState.txHash)}</span>
                {verificationState.verifiedAmountUsd !== undefined && (
                  <span className="text-emerald-300 font-bold tabular-nums">
                    Verified: ${verificationState.verifiedAmountUsd.toFixed(2)} USDT
                  </span>
                )}
                {verificationState.status !== 'credited' && (
                  <button
                    type="button"
                    disabled={verifyingTx}
                    onClick={() =>
                      void runServerVerification(
                        verificationState.network,
                        verificationState.txHash,
                        false
                      )
                    }
                    className="inline-flex items-center gap-1 text-sky-300 hover:text-white"
                  >
                    <RefreshCw className={`w-3 h-3 ${verifyingTx ? 'animate-spin' : ''}`} />
                    <span>Recheck Now</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Direct TxHash Instant On-Chain Verifier (for Mobile / Binance Web3 Transfers) */}
          <div className="pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => setShowManualVerifier((v) => !v)}
              className="text-xs font-semibold text-sky-400 hover:text-sky-300 inline-flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>
                {showManualVerifier
                  ? 'Hide Instant TxHash Verifier'
                  : 'Already sent via Binance Web3 / Mobile? Verify TxHash Instantly'}
              </span>
            </button>

            {showManualVerifier && (
              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={manualTxHash}
                  onChange={(e) => setManualTxHash(e.target.value)}
                  placeholder={`Paste ${networkSpec.shortName} 0x... transaction hash`}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-white font-mono text-xs placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  disabled={verifyingTx || !manualTxHash.trim()}
                  onClick={() => void runServerVerification(selectedChain, manualTxHash, false)}
                  className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 shrink-0"
                >
                  {verifyingTx && activeTxHash === manualTxHash.trim() ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5" />
                  )}
                  <span>Verify &amp; Credit</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
