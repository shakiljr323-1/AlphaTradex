import React, { useMemo, useState } from 'react';
import { isAddress } from 'viem';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Lock,
  PauseCircle,
  PlayCircle,
  Save,
  ShieldAlert,
  ShieldCheck,
  Wallet,
  Zap,
} from 'lucide-react';
import {
  DEFAULT_WEB3_PAYMENT_CONFIG,
  OFFICIAL_WEB3_NETWORKS,
} from '../constants/defaults';
import {
  PlatformConfig,
  SecurityAuditLog,
  Web3PaymentConfig,
  Web3VerifiedTx,
} from '../types/platform';
import { formatTimestamp } from '../utils/investmentMath';

interface AdminWeb3PaymentPanelProps {
  draftConfig: PlatformConfig;
  setDraftConfig: React.Dispatch<React.SetStateAction<PlatformConfig>>;
  onSaveConfig: (nextConfig?: PlatformConfig) => Promise<void>;
  busy: boolean;
  verifiedTxs: Web3VerifiedTx[];
  auditLogs: SecurityAuditLog[];
  onNotify: (type: 'ok' | 'err', text: string) => void;
  onOpenEmailApiSettings?: () => void;
}

/**
 * Active security guard: rejects private keys (64-hex chars) and 12/24-word seed phrases.
 * Only public receiving wallet addresses are ever allowed in admin settings.
 */
function looksLikePrivateKeyOrSeed(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^(0x)?[0-9a-fA-F]{64}$/.test(trimmed)) {
    return 'SECURITY BLOCK: That looks like a 64-character Private Key. NEVER enter private keys here — only paste your Public Receiving Address (42-char 0x... or 34-char T...).';
  }
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 12 && words.every((w) => /^[a-zA-Z]+$/.test(w))) {
    return 'SECURITY BLOCK: That looks like a Seed / Recovery Phrase. NEVER enter seed phrases into the platform.';
  }
  return null;
}

export const AdminWeb3PaymentPanel: React.FC<AdminWeb3PaymentPanelProps> = ({
  draftConfig,
  setDraftConfig,
  onSaveConfig,
  busy,
  verifiedTxs,
  auditLogs,
  onNotify,
  onOpenEmailApiSettings,
}) => {
  const [ledgerTab, setLedgerTab] = useState<'verified_txs' | 'audit_logs'>('verified_txs');
  const [syncToManualMethods, setSyncToManualMethods] = useState(true);
  const [securityWarning, setSecurityWarning] = useState<string | null>(null);

  const web3: Web3PaymentConfig = useMemo(
    () => ({
      ...DEFAULT_WEB3_PAYMENT_CONFIG,
      ...(draftConfig.web3PaymentConfig || {}),
    }),
    [draftConfig.web3PaymentConfig]
  );

  const updateWeb3Field = <K extends keyof Web3PaymentConfig>(
    key: K,
    value: Web3PaymentConfig[K]
  ) => {
    setDraftConfig((prev) => ({
      ...prev,
      web3PaymentConfig: {
        ...DEFAULT_WEB3_PAYMENT_CONFIG,
        ...(prev.web3PaymentConfig || {}),
        [key]: value,
      },
    }));
  };

  const handleAddressChange = (
    key: 'bep20ReceivingAddress' | 'polygonReceivingAddress' | 'trc20ReceivingAddress',
    raw: string
  ) => {
    const blocked = looksLikePrivateKeyOrSeed(raw);
    if (blocked) {
      setSecurityWarning(blocked);
      onNotify('err', blocked);
      return;
    }
    setSecurityWarning(null);
    updateWeb3Field(key, raw.trim());
  };

  const handleSaveAll = async () => {
    setSecurityWarning(null);

    const bepErr = looksLikePrivateKeyOrSeed(web3.bep20ReceivingAddress);
    const polyErr = looksLikePrivateKeyOrSeed(web3.polygonReceivingAddress);
    const trcErr = looksLikePrivateKeyOrSeed(web3.trc20ReceivingAddress);
    if (bepErr || polyErr || trcErr) {
      const msg = bepErr || polyErr || trcErr || 'Invalid secret detected.';
      setSecurityWarning(msg);
      onNotify('err', msg);
      return;
    }

    if (!isAddress(web3.bep20ReceivingAddress)) {
      onNotify('err', 'BEP-20 Public Receiving Address must be a valid 42-char 0x... EVM address.');
      return;
    }
    if (!isAddress(web3.polygonReceivingAddress)) {
      onNotify('err', 'Polygon Public Receiving Address must be a valid 42-char 0x... EVM address.');
      return;
    }
    if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(web3.trc20ReceivingAddress.trim())) {
      onNotify('err', 'TRC-20 Public Receiving Address must be a valid 34-char TRON address starting with T.');
      return;
    }
    if (web3.maxDepositUsd < web3.minDepositUsd) {
      onNotify('err', 'Max deposit limit must be greater than or equal to min deposit limit.');
      return;
    }
    if (web3.maxWithdrawalUsd < web3.minWithdrawalUsd) {
      onNotify('err', 'Max withdrawal limit must be greater than or equal to min withdrawal limit.');
      return;
    }

    let nextPaymentMethods = draftConfig.paymentMethods;
    let nextDepositWallets = draftConfig.depositWallets;

    if (syncToManualMethods) {
      nextDepositWallets = {
        ...draftConfig.depositWallets,
        usdtTrc20: web3.trc20ReceivingAddress.trim(),
      };
      nextPaymentMethods = (draftConfig.paymentMethods || []).map((pm) => {
        if (pm.id === 'USDT_BEP20') {
          return {
            ...pm,
            receivingAccount: web3.bep20ReceivingAddress.trim(),
            minDepositUsd: web3.minDepositUsd,
            minWithdrawalUsd: web3.minWithdrawalUsd,
          };
        }
        if (pm.id === 'USDT_POLYGON') {
          return {
            ...pm,
            receivingAccount: web3.polygonReceivingAddress.trim(),
            minDepositUsd: web3.minDepositUsd,
            minWithdrawalUsd: web3.minWithdrawalUsd,
          };
        }
        if (pm.id === 'USDT_TRC20') {
          return {
            ...pm,
            receivingAccount: web3.trc20ReceivingAddress.trim(),
            minDepositUsd: web3.minDepositUsd,
            minWithdrawalUsd: web3.minWithdrawalUsd,
          };
        }
        return pm;
      });
    }

    const nextConfig: PlatformConfig = {
      ...draftConfig,
      minWithdrawalUsd: web3.minWithdrawalUsd,
      depositWallets: nextDepositWallets,
      paymentMethods: nextPaymentMethods,
      kycSettings: draftConfig.kycSettings
        ? {
            ...draftConfig.kycSettings,
            requireKycForWithdrawals: web3.requireKycForWithdrawals,
          }
        : undefined,
      web3PaymentConfig: {
        ...web3,
        bep20ReceivingAddress: web3.bep20ReceivingAddress.trim(),
        polygonReceivingAddress: web3.polygonReceivingAddress.trim(),
        trc20ReceivingAddress: web3.trc20ReceivingAddress.trim(),
      },
    };

    setDraftConfig(nextConfig);
    await onSaveConfig(nextConfig);
  };

  const applyEmergencyToggle = async (
    nextDepositsPaused: boolean,
    nextWithdrawalsPaused: boolean
  ) => {
    const nextConfig: PlatformConfig = {
      ...draftConfig,
      depositsPaused: nextDepositsPaused,
      withdrawalsPaused: nextWithdrawalsPaused,
    };
    setDraftConfig(nextConfig);
    await onSaveConfig(nextConfig);
  };

  const totalAutoDepositedUsd = useMemo(
    () => verifiedTxs.reduce((sum, tx) => sum + (Number(tx.amountUsd) || 0), 0),
    [verifiedTxs]
  );

  return (
    <div className="space-y-6">
      {/* Zero Private Key Security Banner */}
      <div className="bg-slate-900 text-slate-100 rounded-2xl p-5 border border-slate-800 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold text-emerald-400 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>Zero Private Key Architecture · Anti-Drain Protected</span>
          </div>
          <h2 className="font-display font-bold text-white text-lg">
            Web3 Crypto Payment System &amp; Security Controls
          </h2>
          <p className="text-xs text-slate-400 max-w-3xl">
            Deposits are verified server-side against official BSC &amp; Polygon mainnet USDT contracts using only your Public Receiving Wallet Addresses. Withdrawals never auto-send from any server hot wallet — every payout requires manual Super Admin review and settlement.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 shrink-0 font-mono">
          <div className="px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700">
            <div className="text-[10px] text-slate-400 uppercase">Verified Auto-Deposits</div>
            <div className="text-base font-bold text-emerald-400 tabular-nums">
              ${totalAutoDepositedUsd.toFixed(2)}
            </div>
          </div>
          <div className="px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700">
            <div className="text-[10px] text-slate-400 uppercase">Unique TxHashes</div>
            <div className="text-base font-bold text-white tabular-nums">{verifiedTxs.length}</div>
          </div>
        </div>
      </div>

      {/* Emergency Kill-Switches */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-600" />
            <div>
              <h3 className="font-display font-bold text-slate-900 text-sm">
                Emergency Payment Kill-Switches
              </h3>
              <p className="text-xs text-slate-500">
                Instantly pause incoming deposits or outgoing withdrawals across the entire platform.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void applyEmergencyToggle(
                  !Boolean(draftConfig.depositsPaused),
                  Boolean(draftConfig.withdrawalsPaused)
                )
              }
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border transition-colors ${
                draftConfig.depositsPaused
                  ? 'bg-amber-600 text-white border-amber-600 hover:bg-amber-500'
                  : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {draftConfig.depositsPaused ? (
                <PlayCircle className="w-4 h-4" />
              ) : (
                <PauseCircle className="w-4 h-4 text-amber-600" />
              )}
              <span>{draftConfig.depositsPaused ? 'Resume Deposits' : 'Pause All Deposits'}</span>
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void applyEmergencyToggle(
                  Boolean(draftConfig.depositsPaused),
                  !Boolean(draftConfig.withdrawalsPaused)
                )
              }
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border transition-colors ${
                draftConfig.withdrawalsPaused
                  ? 'bg-rose-600 text-white border-rose-600 hover:bg-rose-500'
                  : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {draftConfig.withdrawalsPaused ? (
                <PlayCircle className="w-4 h-4" />
              ) : (
                <PauseCircle className="w-4 h-4 text-rose-600" />
              )}
              <span>
                {draftConfig.withdrawalsPaused ? 'Resume Withdrawals' : 'Pause All Withdrawals'}
              </span>
            </button>

            {draftConfig.depositsPaused && draftConfig.withdrawalsPaused ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void applyEmergencyToggle(false, false)}
                className="px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white inline-flex items-center gap-1.5"
              >
                <PlayCircle className="w-4 h-4" />
                <span>Resume All Payments</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void applyEmergencyToggle(true, true)}
                className="px-3.5 py-2 rounded-lg text-xs font-bold bg-rose-700 hover:bg-rose-600 text-white inline-flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Emergency Freeze Both</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {securityWarning && (
        <div className="p-4 rounded-xl bg-rose-50 border-2 border-rose-500 text-rose-900 text-xs font-semibold flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <span>{securityWarning}</span>
        </div>
      )}

      {/* Main Configuration Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* LEFT 7 COLS: Public Receiving Addresses & Web3 Auto-Deposit Settings */}
        <div className="xl:col-span-7 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-600" />
                <h3 className="font-display font-bold text-slate-900 text-sm">
                  Official Public Receiving Wallet Addresses
                </h3>
              </div>
              <span className="text-[11px] font-mono font-semibold text-emerald-700">
                PUBLIC ADDRESSES ONLY
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  BNB Smart Chain (BEP-20 USDT) Public Address
                </label>
                <input
                  type="text"
                  value={web3.bep20ReceivingAddress}
                  onChange={(e) => handleAddressChange('bep20ReceivingAddress', e.target.value)}
                  placeholder="0x..."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 font-mono text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                />
                <div className="mt-1 flex items-center justify-between text-[11px] font-mono text-slate-500">
                  <span>Official Contract: {OFFICIAL_WEB3_NETWORKS.BEP20.usdtContract}</span>
                  <span
                    className={
                      isAddress(web3.bep20ReceivingAddress)
                        ? 'text-emerald-600 font-semibold'
                        : 'text-rose-600 font-semibold'
                    }
                  >
                    {isAddress(web3.bep20ReceivingAddress) ? 'Valid EVM' : 'Invalid Address'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Polygon PoS (USDT) Public Address
                </label>
                <input
                  type="text"
                  value={web3.polygonReceivingAddress}
                  onChange={(e) => handleAddressChange('polygonReceivingAddress', e.target.value)}
                  placeholder="0x..."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 font-mono text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                />
                <div className="mt-1 flex items-center justify-between text-[11px] font-mono text-slate-500">
                  <span>Official Contract: {OFFICIAL_WEB3_NETWORKS.POLYGON.usdtContract}</span>
                  <span
                    className={
                      isAddress(web3.polygonReceivingAddress)
                        ? 'text-emerald-600 font-semibold'
                        : 'text-rose-600 font-semibold'
                    }
                  >
                    {isAddress(web3.polygonReceivingAddress) ? 'Valid EVM' : 'Invalid Address'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  TRON (TRC-20 USDT) Public Address
                </label>
                <input
                  type="text"
                  value={web3.trc20ReceivingAddress}
                  onChange={(e) => handleAddressChange('trc20ReceivingAddress', e.target.value)}
                  placeholder="T..."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 font-mono text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <label className="flex items-center gap-2 pt-1 text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncToManualMethods}
                  onChange={(e) => setSyncToManualMethods(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600"
                />
                <span>
                  Also sync these receiving addresses into Manual Payment Methods (USDT BEP20, Polygon &amp; TRC20) on save
                </span>
              </label>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-orange-600" />
                <h3 className="font-display font-bold text-slate-900 text-sm">
                  Instant Web3 Auto-Deposit Engine
                </h3>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={web3.autoDepositEnabled}
                  onChange={(e) => updateWeb3Field('autoDepositEnabled', e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600"
                />
                <span>Master Auto-Deposit Active</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
                <label className="flex items-center justify-between font-semibold text-slate-800 cursor-pointer">
                  <span>BNB Smart Chain (BEP-20)</span>
                  <input
                    type="checkbox"
                    checked={web3.bep20Enabled}
                    onChange={(e) => updateWeb3Field('bep20Enabled', e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600"
                  />
                </label>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    Min Block Confirmations (1–30)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={web3.minConfirmationsBsc}
                    onChange={(e) =>
                      updateWeb3Field('minConfirmationsBsc', Math.max(1, Number(e.target.value) || 3))
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-xs tabular-nums"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
                <label className="flex items-center justify-between font-semibold text-slate-800 cursor-pointer">
                  <span>Polygon PoS (USDT)</span>
                  <input
                    type="checkbox"
                    checked={web3.polygonEnabled}
                    onChange={(e) => updateWeb3Field('polygonEnabled', e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600"
                  />
                </label>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    Min Block Confirmations (1–60)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={web3.minConfirmationsPolygon}
                    onChange={(e) =>
                      updateWeb3Field(
                        'minConfirmationsPolygon',
                        Math.max(1, Number(e.target.value) || 5)
                      )
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-xs tabular-nums"
                  />
                </div>
              </div>
            </div>

            <div className="text-xs">
              <label className="block font-semibold text-slate-700 mb-1">
                Optional WalletConnect / Reown Project ID (Public Client ID)
              </label>
              <input
                type="text"
                value={web3.walletConnectProjectId}
                onChange={(e) => updateWeb3Field('walletConnectProjectId', e.target.value.trim())}
                placeholder="Optional — EIP-681 QR & direct injected wallets work out of the box"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs text-slate-900"
              />
            </div>
          </div>
        </div>

        {/* RIGHT 5 COLS: Limits, Fees & Safe Withdrawal Anti-Drain Rules */}
        <div className="xl:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <KeyRound className="w-4 h-4 text-slate-800" />
              <h3 className="font-display font-bold text-slate-900 text-sm">
                Deposit/Withdrawal Limits, Fees &amp; 2FA Gate
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Min Deposit ($)</label>
                <input
                  type="number"
                  min={1}
                  step="1"
                  value={web3.minDepositUsd}
                  onChange={(e) =>
                    updateWeb3Field('minDepositUsd', Math.max(1, Number(e.target.value) || 10))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Max Deposit ($)</label>
                <input
                  type="number"
                  min={10}
                  step="10"
                  value={web3.maxDepositUsd}
                  onChange={(e) =>
                    updateWeb3Field('maxDepositUsd', Math.max(10, Number(e.target.value) || 50000))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Min Withdrawal ($)
                </label>
                <input
                  type="number"
                  min={1}
                  step="1"
                  value={web3.minWithdrawalUsd}
                  onChange={(e) =>
                    updateWeb3Field('minWithdrawalUsd', Math.max(1, Number(e.target.value) || 10))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Max Withdrawal ($)
                </label>
                <input
                  type="number"
                  min={10}
                  step="10"
                  value={web3.maxWithdrawalUsd}
                  onChange={(e) =>
                    updateWeb3Field(
                      'maxWithdrawalUsd',
                      Math.max(10, Number(e.target.value) || 25000)
                    )
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Withdrawal Fee (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={25}
                  step="0.1"
                  value={web3.withdrawalFeePercent}
                  onChange={(e) =>
                    updateWeb3Field(
                      'withdrawalFeePercent',
                      Math.max(0, Math.min(25, Number(e.target.value) || 0))
                    )
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Flat Network Fee ($)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.5"
                  value={web3.withdrawalFlatFeeUsd}
                  onChange={(e) =>
                    updateWeb3Field(
                      'withdrawalFlatFeeUsd',
                      Math.max(0, Math.min(100, Number(e.target.value) || 0))
                    )
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-slate-100 text-xs">
              <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={web3.require2faForWithdrawals}
                  onChange={(e) =>
                    updateWeb3Field('require2faForWithdrawals', e.target.checked)
                  }
                  className="mt-0.5 rounded border-slate-300 text-emerald-600"
                />
                <div>
                  <div className="font-semibold text-slate-900">
                    Require Email OTP / 2FA Verification Before Withdrawal
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Binds a server-signed 6-digit OTP to exact amount, network, and wallet address.
                  </div>
                  {onOpenEmailApiSettings && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        onOpenEmailApiSettings();
                      }}
                      className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 underline underline-offset-2"
                    >
                      Configure Resend &amp; Email API Key &rarr;
                    </button>
                  )}
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={web3.requireKycForWithdrawals}
                  onChange={(e) =>
                    updateWeb3Field('requireKycForWithdrawals', e.target.checked)
                  }
                  className="mt-0.5 rounded border-slate-300 text-emerald-600"
                />
                <div>
                  <div className="font-semibold text-slate-900">
                    Require Approved KYC for Withdrawals
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Blocks unverified accounts from requesting outgoing payouts.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={web3.requirePayoutTxHashOnApprove}
                  onChange={(e) =>
                    updateWeb3Field('requirePayoutTxHashOnApprove', e.target.checked)
                  }
                  className="mt-0.5 rounded border-slate-300 text-emerald-600"
                />
                <div>
                  <div className="font-semibold text-slate-900">
                    Require Payout TxHash on Admin Approval
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Forces admin to record the external blockchain payout TxHash before marking Paid.
                  </div>
                </div>
              </label>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSaveAll()}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>{busy ? 'Saving Payment Settings...' : 'Save Web3 Payment & Security Settings'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Idempotency Ledger & Immutable Security Audit Logs */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display font-bold text-slate-900 text-sm">
              On-Chain Verification Ledger &amp; Immutable Security Audit Logs
            </h3>
            <p className="text-xs text-slate-500">
              Append-only records enforcing unique txHash idempotency and full admin/user withdrawal accountability.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setLedgerTab('verified_txs')}
              className={`px-3 py-1.5 rounded-lg font-semibold border ${
                ledgerTab === 'verified_txs'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Verified Web3 TxHashes ({verifiedTxs.length})
            </button>
            <button
              type="button"
              onClick={() => setLedgerTab('audit_logs')}
              className={`px-3 py-1.5 rounded-lg font-semibold border ${
                ledgerTab === 'audit_logs'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Payment Audit Logs ({auditLogs.length})
            </button>
          </div>
        </div>

        {ledgerTab === 'verified_txs' ? (
          verifiedTxs.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              No verified on-chain Web3 auto-deposits recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3">Verified At</th>
                    <th className="py-2 pr-3">User</th>
                    <th className="py-2 pr-3">Network</th>
                    <th className="py-2 pr-3">Verified USDT</th>
                    <th className="py-2 pr-3">Confs / Block</th>
                    <th className="py-2">TxHash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {verifiedTxs.slice(0, 50).map((tx) => {
                    const spec = OFFICIAL_WEB3_NETWORKS[tx.network];
                    return (
                      <tr key={tx.txKey}>
                        <td className="py-2.5 pr-3 font-mono text-slate-500 whitespace-nowrap">
                          {tx.createdAt ? formatTimestamp(tx.createdAt) : tx.verifiedAtIso}
                        </td>
                        <td className="py-2.5 pr-3 text-slate-800 font-medium">{tx.userEmail}</td>
                        <td className="py-2.5 pr-3 font-mono font-semibold text-slate-700">
                          {tx.network}
                        </td>
                        <td className="py-2.5 pr-3 font-mono font-bold text-emerald-700 tabular-nums">
                          ${Number(tx.amountUsd).toFixed(2)}
                        </td>
                        <td className="py-2.5 pr-3 font-mono text-slate-600 tabular-nums">
                          {tx.confirmations} confs · #{tx.blockNumber}
                        </td>
                        <td className="py-2.5 font-mono">
                          <a
                            href={`${spec?.explorerTxBaseUrl || 'https://bscscan.com/tx/'}${tx.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sky-700 hover:underline inline-flex items-center gap-1"
                          >
                            <span>
                              {tx.txHash.slice(0, 10)}...{tx.txHash.slice(-6)}
                            </span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : auditLogs.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">
            No immutable payment security audit logs yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">Event</th>
                  <th className="py-2 pr-3">Actor</th>
                  <th className="py-2 pr-3">Amount</th>
                  <th className="py-2 pr-3">TxHash</th>
                  <th className="py-2">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.slice(0, 60).map((log) => (
                  <tr key={log.id}>
                    <td className="py-2.5 pr-3 font-mono text-slate-500 whitespace-nowrap">
                      {formatTimestamp(log.createdAt)}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                          log.eventType === 'WEB3_AUTO_DEPOSIT_CREDITED' ||
                          log.eventType === 'WITHDRAWAL_APPROVED_PAID'
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.eventType === 'WITHDRAWAL_REJECTED_REFUNDED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        {log.eventType}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-slate-700 font-mono text-[11px]">
                      {log.actorEmail}
                    </td>
                    <td className="py-2.5 pr-3 font-mono font-bold text-slate-900 tabular-nums">
                      {log.amountUsd > 0 ? `$${Number(log.amountUsd).toFixed(2)}` : '—'}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-slate-500 max-w-[130px] truncate">
                      {log.txHash || '—'}
                    </td>
                    <td className="py-2.5 text-slate-600 max-w-[280px]">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
