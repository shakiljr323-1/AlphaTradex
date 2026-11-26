import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  AlertTriangle,
  Check,
  Copy,
  PlusCircle,
  QrCode,
  ShieldCheck,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import {
  CryptoNetwork,
  DepositWallets,
  PaymentMethodConfig,
} from '../types/platform';

interface DepositFundsModalProps {
  open: boolean;
  onClose: () => void;
  paymentMethods: PaymentMethodConfig[];
  depositWallets: DepositWallets;
  currentDepositBalance: number;
  initialNetwork?: CryptoNetwork;
  depositsPaused?: boolean;
  autoDepositEnabled?: boolean;
  onOpenWeb3AutoDeposit?: () => void;
  onSubmitDeposit: (params: {
    network: CryptoNetwork;
    amountUsd: number;
    txId: string;
  }) => Promise<void>;
  onNotify: (type: 'ok' | 'err', text: string) => void;
}

export const DepositFundsModal: React.FC<DepositFundsModalProps> = ({
  open,
  onClose,
  paymentMethods,
  depositWallets,
  currentDepositBalance,
  initialNetwork,
  depositsPaused = false,
  autoDepositEnabled = true,
  onOpenWeb3AutoDeposit,
  onSubmitDeposit,
  onNotify,
}) => {
  const cryptoOptions = useMemo<PaymentMethodConfig[]>(() => {
    const enabledCrypto = paymentMethods.filter(
      (m) => m.enabled && m.allowDeposit && m.category === 'crypto'
    );
    if (enabledCrypto.length > 0) return enabledCrypto;

    // Fallback to configured crypto deposit wallets (USDT TRC20, USDT ERC20, SOL)
    return [
      {
        id: 'USDT_TRC20',
        name: 'USDT (TRC20)',
        category: 'crypto',
        receivingAccount: depositWallets.usdtTrc20,
        withdrawAddress: depositWallets.usdtTrc20,
        instructions: 'Send USDT via Tron (TRC20) network and submit your confirmed TxID hash.',
        minDepositUsd: 10,
        minWithdrawalUsd: 10,
        allowDeposit: true,
        allowWithdrawal: true,
        enabled: true,
      },
      {
        id: 'USDT_ERC20',
        name: 'USDT (ERC20)',
        category: 'crypto',
        receivingAccount: depositWallets.usdtErc20,
        withdrawAddress: depositWallets.usdtErc20,
        instructions: 'Send USDT via Ethereum (ERC20) network and submit your transaction hash.',
        minDepositUsd: 20,
        minWithdrawalUsd: 20,
        allowDeposit: true,
        allowWithdrawal: true,
        enabled: true,
      },
      {
        id: 'SOL',
        name: 'Solana (SOL)',
        category: 'crypto',
        receivingAccount: depositWallets.sol,
        withdrawAddress: depositWallets.sol,
        instructions: 'Send SOL or USDC-SOL on Solana Mainnet and paste your Tx signature.',
        minDepositUsd: 10,
        minWithdrawalUsd: 10,
        allowDeposit: true,
        allowWithdrawal: true,
        enabled: true,
      },
    ];
  }, [paymentMethods, depositWallets]);

  const [selectedId, setSelectedId] = useState<CryptoNetwork>(
    initialNetwork || cryptoOptions[0]?.id || 'USDT_TRC20'
  );
  const [amountUsd, setAmountUsd] = useState('100');
  const [txId, setTxId] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLocalError(null);
    if (initialNetwork && cryptoOptions.some((o) => o.id === initialNetwork)) {
      setSelectedId(initialNetwork);
    } else if (!cryptoOptions.some((o) => o.id === selectedId) && cryptoOptions[0]) {
      setSelectedId(cryptoOptions[0].id);
    }
  }, [open, initialNetwork, cryptoOptions, selectedId]);

  const activeMethod =
    cryptoOptions.find((m) => m.id === selectedId) || cryptoOptions[0];

  const activeWalletAddress = useMemo(() => {
    if (!activeMethod) return '';
    if (activeMethod.receivingAccount?.trim()) return activeMethod.receivingAccount.trim();
    if (activeMethod.id === 'USDT_TRC20') return depositWallets.usdtTrc20;
    if (activeMethod.id === 'USDT_ERC20') return depositWallets.usdtErc20;
    if (activeMethod.id === 'SOL') return depositWallets.sol;
    return '';
  }, [activeMethod, depositWallets]);

  useEffect(() => {
    if (!open || !activeWalletAddress) {
      setQrDataUrl('');
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(activeWalletAddress, {
      width: 192,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0B111E',
        light: '#FFFFFF',
      },
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
  }, [open, activeWalletAddress]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, submitting, onClose]);

  if (!open || !activeMethod) return null;

  const minDeposit = Math.max(1, Number(activeMethod.minDepositUsd || 10));

  const handleCopyAddress = () => {
    if (!activeWalletAddress) return;
    navigator.clipboard?.writeText(activeWalletAddress)?.catch(() => {});
    setCopiedAddr(true);
    window.setTimeout(() => setCopiedAddr(false), 1800);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const parsedAmount = Number(amountUsd);
    if (!Number.isFinite(parsedAmount) || parsedAmount < minDeposit) {
      setLocalError(`Minimum deposit for ${activeMethod.name} is $${minDeposit.toFixed(2)} USD.`);
      return;
    }
    if (!txId.trim()) {
      setLocalError('Please enter your confirmed Transaction ID / Hash / Signature.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmitDeposit({
        network: activeMethod.id,
        amountUsd: parsedAmount,
        txId: txId.trim(),
      });
      setTxId('');
      onNotify(
        'ok',
        `Deposit request ($${parsedAmount.toFixed(2)} via ${activeMethod.name}) submitted and queued for verification.`
      );
      onClose();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to submit deposit request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deposit-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="w-full max-w-2xl bg-[#0B111E] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 my-auto">
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/35 text-sky-400 flex items-center justify-center shrink-0">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 id="deposit-modal-title" className="font-display font-bold text-white text-base sm:text-lg">
                Deposit Funds to Deposit Wallet
              </h3>
              <p className="text-xs text-slate-400">
                Current Deposit Wallet:{' '}
                <strong className="font-mono text-sky-300 tabular-nums">
                  ${currentDepositBalance.toFixed(2)} USD
                </strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close deposit modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5">
          {depositsPaused && (
            <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-xs text-amber-200 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Deposits are temporarily paused by administration. Please check back shortly.
              </span>
            </div>
          )}

          {!depositsPaused && autoDepositEnabled && onOpenWeb3AutoDeposit && (
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/35 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Instant Web3 Auto-Deposit Available (BEP-20 &amp; Polygon USDT)</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Connect Binance Web3, MetaMask, Trust Wallet, or WalletConnect QR for automatic on-chain credit.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenWeb3AutoDeposit();
                }}
                className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shrink-0"
              >
                Open Web3 Auto-Deposit
              </button>
            </div>
          )}

          {/* Step 1: Select Crypto Asset & Network */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
                1. Select Crypto Asset &amp; Network (USDT / SOL)
              </span>
              <span className="text-slate-400 font-mono text-[11px]">
                Crypto-Only Custody
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {cryptoOptions.map((method) => {
                const isSelected = activeMethod.id === method.id;
                const badge =
                  method.id === 'USDT_TRC20'
                    ? 'TRON · TRC20'
                    : method.id === 'USDT_ERC20'
                    ? 'ETH · ERC20'
                    : method.id === 'SOL'
                    ? 'SOLANA MAINNET'
                    : method.id.replace(/_/g, ' ');
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(method.id);
                      setLocalError(null);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-orange-500 bg-orange-500/15 shadow-lg shadow-orange-500/10'
                        : 'border-slate-700/80 bg-slate-900/75 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`font-display font-bold text-sm ${
                          isSelected ? 'text-orange-300' : 'text-white'
                        }`}
                      >
                        {method.name}
                      </span>
                      {isSelected && (
                        <Check className="w-4 h-4 text-orange-400 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-[10px] font-mono">
                      <span className="text-slate-400">{badge}</span>
                      <span className="text-sky-300 font-semibold">Min ${method.minDepositUsd}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: QR Code & Receiving Wallet Address */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-slate-900/80 border border-slate-700/75 rounded-2xl p-4">
            <div className="md:col-span-4 flex flex-col items-center justify-center">
              <div className="p-2.5 bg-white rounded-xl shadow-md border border-slate-200 flex items-center justify-center">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`${activeMethod.name} Deposit QR Code`}
                    className="w-36 h-36 object-contain"
                  />
                ) : (
                  <div className="w-36 h-36 flex flex-col items-center justify-center text-slate-500 gap-1.5">
                    <QrCode className="w-10 h-10" />
                    <span className="text-[10px] font-mono">Generating QR...</span>
                  </div>
                )}
              </div>
              <span className="mt-2 text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider text-center">
                Scan {activeMethod.name}
              </span>
            </div>

            <div className="md:col-span-8 space-y-3 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-orange-400" />
                  <span>{activeMethod.name} Receiving Address</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyAddress}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-orange-300 inline-flex items-center gap-1.5 transition-colors shrink-0"
                >
                  {copiedAddr ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedAddr ? 'Copied!' : 'Copy Address'}</span>
                </button>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 font-mono text-xs text-slate-100 break-all select-all">
                {activeWalletAddress}
              </div>

              <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/30 text-[11px] text-amber-200/90 flex items-start gap-2 leading-relaxed">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  {activeMethod.instructions ||
                    `Send only ${activeMethod.name} on the selected network. Sending on the wrong network may result in permanent loss.`}
                </span>
              </div>
            </div>
          </div>

          {/* Step 3: Submit Deposit Request */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {localError && (
              <div className="p-3 rounded-xl bg-red-950/75 border border-red-600/50 text-xs text-red-200">
                {localError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Amount Sent (USD Equivalent)
                  </label>
                  <span className="text-[11px] font-mono text-slate-400">
                    Min ${minDeposit}
                  </span>
                </div>
                <input
                  type="number"
                  min={minDeposit}
                  step="0.01"
                  required
                  value={amountUsd}
                  onChange={(e) => setAmountUsd(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-900/90 text-white font-mono text-sm focus:outline-none focus:border-orange-500"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[50, 100, 300, 500, 1000]
                    .filter((amt) => amt >= minDeposit)
                    .map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAmountUsd(String(preset))}
                        className="px-2 py-0.5 rounded-md border border-slate-700 bg-slate-900 text-[11px] font-mono text-slate-300 hover:border-orange-500/70 hover:text-white"
                      >
                        ${preset}
                      </button>
                    ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Transaction Hash / TxID / Signature
                </label>
                <input
                  type="text"
                  required
                  value={txId}
                  onChange={(e) => setTxId(e.target.value)}
                  placeholder="Paste confirmed TxID or signature"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-900/90 text-white font-mono text-sm placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
                />
                <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Credited to your Deposit Wallet upon verification.</span>
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || depositsPaused}
                className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 shadow-lg shadow-orange-600/20"
              >
                <PlusCircle className="w-4 h-4" />
                <span>
                  {depositsPaused
                    ? 'Deposits Paused'
                    : submitting
                    ? 'Submitting Request...'
                    : `Submit ${activeMethod.name} Deposit`}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
