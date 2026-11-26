import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  KeyRound,
  Laptop,
  Loader2,
  Lock,
  Mail,
  Pencil,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Tablet,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import { isAddress } from 'viem';
import {
  LoginActivityRecord,
  UserProfile,
  WhitelistedWallet,
  WhitelistUsdtNetwork,
} from '../types/platform';
import { formatTimestamp } from '../utils/investmentMath';

interface UserSecurityCenterProps {
  userProfile: UserProfile;
  whitelistedWallets: WhitelistedWallet[];
  loginActivities: LoginActivityRecord[];
  getIdToken: () => Promise<string>;
  onToggleStrictMode: (enabled: boolean) => Promise<void>;
  onToggle24hLock: (enabled: boolean) => Promise<void>;
  onNotify: (type: 'ok' | 'err', text: string) => void;
}

interface PendingOtpChallenge {
  action: 'add' | 'update' | 'remove' | 'update_policy';
  token: string;
  maskedEmail: string;
  inboxCode?: string;
  message: string;
  summary: string;
  walletId?: string;
}

const NETWORK_OPTIONS: Array<{
  id: WhitelistUsdtNetwork;
  label: string;
  hint: string;
  placeholder: string;
}> = [
  { id: 'BEP20', label: 'BEP-20', hint: 'BNB Smart Chain (0x...)', placeholder: '0x...' },
  { id: 'TRC20', label: 'TRC-20', hint: 'TRON Network (T...)', placeholder: 'T...' },
  { id: 'POLYGON', label: 'Polygon', hint: 'Polygon PoS (0x...)', placeholder: '0x...' },
  { id: 'ERC20', label: 'ERC-20', hint: 'Ethereum (0x...)', placeholder: '0x...' },
];

function formatRemainingMs(unlockAtMs: number, nowMs: number): string {
  const diff = unlockAtMs - nowMs;
  if (diff <= 0) return 'Active';
  const hrs = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.ceil((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hrs > 0) return `${hrs}h ${mins}m remaining`;
  return `${Math.max(1, mins)}m remaining`;
}

function formatUnlockDateTime(unlockAtMs: number): string {
  try {
    return new Date(unlockAtMs).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return new Date(unlockAtMs).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  }
}

export const UserSecurityCenter: React.FC<UserSecurityCenterProps> = ({
  userProfile,
  whitelistedWallets,
  loginActivities,
  getIdToken,
  onToggleStrictMode,
  onToggle24hLock,
  onNotify,
}) => {
  const strictEnabled = userProfile.whitelistStrictMode === true;
  const default24hLockEnabled = userProfile.whitelist24hLockEnabled !== false;

  // Live clock tick so 24-hour lock countdowns stay accurate
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Add / Change Address form state
  const [editingWalletId, setEditingWalletId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [network, setNetwork] = useState<WhitelistUsdtNetwork>('BEP20');
  const [address, setAddress] = useState('');
  const [apply24hLock, setApply24hLock] = useState<boolean>(default24hLockEnabled);

  useEffect(() => {
    if (!editingWalletId) {
      setApply24hLock(default24hLockEnabled);
    }
  }, [default24hLockEnabled, editingWalletId]);

  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState('');

  // Unified Email OTP state for add / update / remove / policy downgrade
  const [otpChallenge, setOtpChallenge] = useState<PendingOtpChallenge | null>(null);
  const [otpCode, setOtpCode] = useState('');

  const editingWallet = useMemo(
    () => (editingWalletId ? whitelistedWallets.find((w) => w.id === editingWalletId) || null : null),
    [editingWalletId, whitelistedWallets]
  );

  const activeWalletsCount = useMemo(
    () => whitelistedWallets.filter((w) => Number(w.unlockAtMs || 0) <= nowMs).length,
    [whitelistedWallets, nowMs]
  );

  const lockedWalletsCount = Math.max(0, whitelistedWallets.length - activeWalletsCount);

  const destinationChangedInEdit = useMemo(() => {
    if (!editingWallet) return true;
    const cleanAddr = address.trim();
    if (editingWallet.network !== network) return true;
    if (network === 'TRC20') return editingWallet.address.trim() !== cleanAddr;
    return editingWallet.address.trim().toLowerCase() !== cleanAddr.toLowerCase();
  }, [editingWallet, network, address]);

  const validateForm = (): string | null => {
    const cleanAddr = address.trim();
    if (!label.trim()) return 'Enter a friendly wallet label (e.g. Binance Main USDT).';
    if (network === 'BEP20' || network === 'POLYGON' || network === 'ERC20') {
      if (!isAddress(cleanAddr)) {
        return `${network} USDT requires a valid 42-character 0x... EVM wallet address.`;
      }
    } else if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(cleanAddr)) {
      return 'TRC-20 USDT requires a valid 34-character Tron wallet address starting with T.';
    }
    const duplicate = whitelistedWallets.find((w) => {
      if (editingWalletId && w.id === editingWalletId) return false;
      if (w.network !== network) return false;
      if (network === 'TRC20') return w.address.trim() === cleanAddr;
      return w.address.trim().toLowerCase() === cleanAddr.toLowerCase();
    });
    if (duplicate) {
      return `This ${network} USDT address is already whitelisted as "${duplicate.label}".`;
    }
    return null;
  };

  const resetForm = () => {
    setEditingWalletId(null);
    setLabel('');
    setAddress('');
    setApply24hLock(default24hLockEnabled);
    setOtpCode('');
    setOtpChallenge(null);
  };

  const startEditWallet = (w: WhitelistedWallet) => {
    setEditingWalletId(w.id);
    setLabel(w.label);
    setNetwork(w.network);
    setAddress(w.address);
    setApply24hLock(default24hLockEnabled);
    setOtpCode('');
    setOtpChallenge(null);
  };

  const requestWhitelistOtp = async (
    payload: {
      action: 'add' | 'update' | 'remove' | 'update_policy';
      walletId?: string;
      label?: string;
      network?: WhitelistUsdtNetwork;
      address?: string;
      apply24hLock?: boolean;
      whitelistStrictMode?: boolean;
      whitelist24hLockEnabled?: boolean;
    },
    summary: string
  ) => {
    setBusy(true);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/security/whitelist/request-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        challengeToken?: string;
        maskedEmail?: string;
        securityInboxCode?: string;
        message?: string;
        error?: string;
      };
      if (!res.ok || !data.challengeToken) {
        throw new Error(data.error || 'Could not request Email OTP.');
      }
      setOtpCode('');
      setOtpChallenge({
        action: payload.action,
        token: data.challengeToken,
        maskedEmail: data.maskedEmail || userProfile.email,
        inboxCode: data.securityInboxCode,
        message: data.message || '6-digit Email OTP dispatched.',
        summary,
        walletId: payload.walletId,
      });
      onNotify('ok', data.message || '6-digit Email OTP dispatched.');
    } catch (e) {
      onNotify('err', e instanceof Error ? e.message : 'Unable to send Email OTP.');
    } finally {
      setBusy(false);
    }
  };

  const handleRequestSaveOtp = async () => {
    const err = validateForm();
    if (err) {
      onNotify('err', err);
      return;
    }
    const isEdit = Boolean(editingWalletId);
    const willLock24h = apply24hLock && (!isEdit || destinationChangedInEdit);
    await requestWhitelistOtp(
      {
        action: isEdit ? 'update' : 'add',
        walletId: editingWalletId || undefined,
        label: label.trim(),
        network,
        address: address.trim(),
        apply24hLock: willLock24h,
      },
      isEdit
        ? `Change "${label.trim()}" (${network})${willLock24h ? ' + 24h security lock' : ''}`
        : `Add "${label.trim()}" (${network})${willLock24h ? ' + 24h security lock' : ' · Instant activation'}`
    );
  };

  const handleRequestRemoveOtp = async (w: WhitelistedWallet) => {
    await requestWhitelistOtp(
      {
        action: 'remove',
        walletId: w.id,
      },
      `Remove "${w.label}" (${w.network} · ${w.address.slice(0, 10)}...${w.address.slice(-6)})`
    );
  };

  const handleConfirmOtp = async () => {
    if (!otpChallenge) return;
    const cleanOtp = otpCode.trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      onNotify('err', 'Enter the 6-digit numeric Email OTP code.');
      return;
    }
    setBusy(true);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/security/whitelist/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          challengeToken: otpChallenge.token,
          otpCode: cleanOtp,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Email OTP verification failed.');
      }
      if (otpChallenge.action === 'add' || otpChallenge.action === 'update') {
        resetForm();
      } else {
        setOtpCode('');
        setOtpChallenge(null);
      }
      setNowMs(Date.now());
      onNotify('ok', data.message || 'Withdrawal whitelist updated via Email OTP.');
    } catch (e) {
      onNotify('err', e instanceof Error ? e.message : 'Unable to confirm Email OTP.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleStrict = async () => {
    if (!strictEnabled) {
      setBusy(true);
      try {
        await onToggleStrictMode(true);
        onNotify(
          'ok',
          'Strict Withdrawal Whitelist Lock ENABLED. Only verified, unlocked whitelisted addresses can receive payouts.'
        );
      } catch (e) {
        onNotify('err', e instanceof Error ? e.message : 'Unable to enable Strict Whitelist Lock.');
      } finally {
        setBusy(false);
      }
      return;
    }
    // Lowering protection requires Email OTP
    await requestWhitelistOtp(
      { action: 'update_policy', whitelistStrictMode: false },
      'Disable Strict Withdrawal Whitelist Lock'
    );
  };

  const handleToggle24hLockPolicy = async () => {
    if (!default24hLockEnabled) {
      setBusy(true);
      try {
        await onToggle24hLock(true);
        setApply24hLock(true);
        onNotify(
          'ok',
          '24-Hour New-Address Security Lock ENABLED by default for newly added or changed addresses.'
        );
      } catch (e) {
        onNotify('err', e instanceof Error ? e.message : 'Unable to enable 24-hour lock.');
      } finally {
        setBusy(false);
      }
      return;
    }
    // Disabling default 24h lock requires Email OTP
    await requestWhitelistOtp(
      { action: 'update_policy', whitelist24hLockEnabled: false },
      'Disable Default 24-Hour Security Lock for New Addresses'
    );
  };

  const handleCopyAddress = (id: string, val: string) => {
    navigator.clipboard?.writeText(val).catch(() => {});
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(''), 1600);
  };

  const renderDeviceIcon = (type: LoginActivityRecord['deviceType']) => {
    if (type === 'Mobile') return <Smartphone className="w-4 h-4 text-sky-400" />;
    if (type === 'Tablet') return <Tablet className="w-4 h-4 text-amber-400" />;
    return <Laptop className="w-4 h-4 text-emerald-400" />;
  };

  const isInlineOtpForForm =
    otpChallenge && (otpChallenge.action === 'add' || otpChallenge.action === 'update');
  const isBannerOtpForAction =
    otpChallenge && (otpChallenge.action === 'remove' || otpChallenge.action === 'update_policy');

  const selectedNetworkSpec =
    NETWORK_OPTIONS.find((n) => n.id === network) || NETWORK_OPTIONS[0];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#0B111E] via-[#101C33] to-[#0E2235] border border-slate-800 rounded-2xl p-6 text-white space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-[11px] font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              Anti-Drain Withdrawal Address Whitelist
            </div>
            <h2 className="font-display font-bold text-xl">
              Withdrawal Address Whitelist &amp; Account Security
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Save one or more trusted USDT withdrawal addresses (BEP-20, TRC-20, Polygon, ERC-20).
              Every address addition, modification, or removal requires mandatory 6-digit Email OTP
              verification, with an optional 24-hour security lock delay before new addresses can be
              used for withdrawals.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleToggleStrict()}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition ${
                strictEnabled
                  ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200 hover:bg-emerald-500/30'
                  : 'bg-slate-800/80 border-slate-700 text-slate-200 hover:border-amber-400/50'
              }`}
            >
              {strictEnabled ? (
                <Lock className="w-4 h-4 text-emerald-400" />
              ) : (
                <Unlock className="w-4 h-4 text-amber-400" />
              )}
              {strictEnabled ? 'Strict Whitelist: ON' : 'Enable Strict Whitelist'}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => void handleToggle24hLockPolicy()}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition ${
                default24hLockEnabled
                  ? 'bg-sky-500/20 border-sky-400/50 text-sky-200 hover:bg-sky-500/30'
                  : 'bg-slate-800/80 border-slate-700 text-slate-200 hover:border-sky-400/50'
              }`}
            >
              <Clock
                className={`w-4 h-4 ${default24hLockEnabled ? 'text-sky-300' : 'text-slate-400'}`}
              />
              {default24hLockEnabled ? '24h New-Address Lock: ON' : '24h New-Address Lock: OFF'}
            </button>
          </div>
        </div>

        {/* Summary Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
              Active Trusted Addresses
            </div>
            <div className="font-mono font-bold text-lg text-emerald-400 mt-0.5 tabular-nums">
              {activeWalletsCount} Ready
            </div>
          </div>
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
              In 24h Security Lock
            </div>
            <div className="font-mono font-bold text-lg text-amber-300 mt-0.5 tabular-nums">
              {lockedWalletsCount} Cooling Down
            </div>
          </div>
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
              Mutation Safeguard
            </div>
            <div className="font-semibold text-xs text-sky-300 mt-1.5 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5" />
              Mandatory Email OTP Required
            </div>
          </div>
        </div>
      </div>

      {/* Inline OTP Verification Banner for Policy Downgrade or Address Removal */}
      {isBannerOtpForAction && otpChallenge && (
        <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-5 shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900">
                <KeyRound className="w-4 h-4 text-amber-600" />
                Email OTP Verification Required: {otpChallenge.summary}
              </div>
              <p className="text-xs text-amber-800">{otpChallenge.message}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOtpChallenge(null);
                setOtpCode('');
              }}
              className="p-1.5 rounded-lg text-amber-700 hover:bg-amber-100"
              aria-label="Cancel verification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {otpChallenge.inboxCode && (
            <div className="rounded-lg bg-white border border-amber-300 px-3.5 py-2 font-mono text-xs font-bold text-amber-900 flex items-center justify-between max-w-md">
              <span>Security Inbox OTP:</span>
              <span className="tracking-widest text-sm">{otpChallenge.inboxCode}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 max-w-md">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter 6-digit Email OTP"
              className="flex-1 min-w-[180px] rounded-xl border border-amber-300 bg-white px-3.5 py-2.5 text-xs font-mono tracking-widest text-slate-900 outline-none focus:border-amber-500"
            />
            <button
              type="button"
              disabled={busy || otpCode.length !== 6}
              onClick={() => void handleConfirmOtp()}
              className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Confirm via OTP
            </button>
          </div>
        </div>
      )}

      {/* Whitelist Lock Status Banner */}
      <div
        className={`rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3 text-xs ${
          strictEnabled
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}
      >
        <div className="flex items-start gap-2.5">
          {strictEnabled ? (
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          )}
          <div>
            <div className="font-bold">
              {strictEnabled
                ? 'Strict Withdrawal Whitelist Protection Is Active (Server-Enforced)'
                : 'Recommended: Enable Strict Withdrawal Whitelist Lock'}
            </div>
            <p className="text-[11px] opacity-85 mt-0.5">
              {strictEnabled
                ? `You have ${activeWalletsCount} unlocked trusted address(es)${
                    lockedWalletsCount > 0 ? ` and ${lockedWalletsCount} in 24h lock` : ''
                  }. Withdrawals to any other address are automatically rejected by the server.`
                : 'Save your trusted USDT withdrawal address(es) below and turn on Strict Whitelist Lock so funds can never be sent to an unauthorized wallet.'}
            </p>
          </div>
        </div>
      </div>

      {/* Add / Edit Whitelisted Wallet + Saved List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-display font-bold text-slate-900 text-sm flex items-center gap-2">
                {editingWalletId ? (
                  <>
                    <Pencil className="w-4 h-4 text-sky-600" />
                    Change Whitelisted USDT Address
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 text-emerald-600" />
                    Add Trusted USDT Address
                  </>
                )}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {editingWalletId
                  ? 'Email OTP verification is required to modify any saved withdrawal address.'
                  : 'All new trusted addresses require 6-digit Email OTP verification before saving.'}
              </p>
            </div>
            {editingWalletId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Wallet Label
              </label>
              <input
                type="text"
                maxLength={80}
                value={label}
                onChange={(e) => {
                  setLabel(e.target.value);
                  if (isInlineOtpForForm) setOtpChallenge(null);
                }}
                placeholder="e.g. My Binance USDT BEP-20"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                USDT Network
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {NETWORK_OPTIONS.map((net) => (
                  <button
                    key={net.id}
                    type="button"
                    onClick={() => {
                      setNetwork(net.id);
                      if (isInlineOtpForForm) setOtpChallenge(null);
                    }}
                    className={`py-2 px-2 rounded-lg text-xs font-bold border transition ${
                      network === net.id
                        ? 'bg-[#0B111E] text-white border-[#0B111E]'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {net.label}
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">{selectedNetworkSpec.hint}</div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                USDT Receiving Address ({selectedNetworkSpec.label})
              </label>
              <input
                type="text"
                maxLength={160}
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  if (isInlineOtpForForm) setOtpChallenge(null);
                }}
                placeholder={selectedNetworkSpec.placeholder}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-900 focus:bg-white focus:border-emerald-500 outline-none"
              />
            </div>

            {/* Optional 24-Hour Security Lock Delay Control */}
            <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/80 cursor-pointer hover:border-sky-300 transition">
              <input
                type="checkbox"
                checked={apply24hLock}
                onChange={(e) => {
                  setApply24hLock(e.target.checked);
                  if (isInlineOtpForForm) setOtpChallenge(null);
                }}
                className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  Apply 24-hour security lock delay (Optional)
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {editingWalletId && !destinationChangedInEdit
                    ? 'Label-only edits keep your current unlock status. Changing the address or network will apply the 24-hour lock if checked.'
                    : apply24hLock
                    ? 'After Email OTP verification, withdrawals to this address will unlock in 24 hours for extra anti-drain protection.'
                    : 'Unchecked: This address will be immediately usable for withdrawals once verified by Email OTP.'}
                </p>
              </div>
            </label>

            {/* Mandatory Email OTP Step */}
            {isInlineOtpForForm && otpChallenge ? (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-emerald-900 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                    Step 2: Enter 6-Digit Email OTP
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleRequestSaveOtp()}
                    className="text-[11px] font-semibold text-emerald-700 hover:underline"
                  >
                    Resend OTP
                  </button>
                </div>
                <p className="text-[11px] text-emerald-800 leading-snug">{otpChallenge.message}</p>
                {otpChallenge.inboxCode && (
                  <div className="rounded-lg bg-white border border-emerald-300 px-3 py-2 font-mono text-xs font-bold text-emerald-800 flex items-center justify-between">
                    <span>Security Inbox OTP:</span>
                    <span className="tracking-widest text-sm">{otpChallenge.inboxCode}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit OTP"
                    className="flex-1 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-mono tracking-widest text-slate-900 outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    disabled={busy || otpCode.length !== 6}
                    onClick={() => void handleConfirmOtp()}
                    className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50 inline-flex items-center gap-1.5 shrink-0"
                  >
                    {busy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    {editingWalletId ? 'Verify & Update' : 'Verify & Save'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleRequestSaveOtp()}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                {editingWalletId
                  ? 'Send Email OTP to Save Address Change'
                  : 'Send 6-Digit Email OTP to Add Address'}
              </button>
            )}
          </div>
        </div>

        {/* Saved Whitelisted Addresses List */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display font-bold text-slate-900 text-sm">
                Saved Trusted USDT Addresses ({whitelistedWallets.length})
              </h3>
              <p className="text-[11px] text-slate-500">
                Unlocked addresses appear for one-click selection inside Withdraw Funds. Editing or
                removing any address requires Email OTP verification.
              </p>
            </div>
          </div>

          {whitelistedWallets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center space-y-1.5">
              <ShieldCheck className="w-7 h-7 text-slate-300 mx-auto" />
              <div className="text-xs font-semibold text-slate-700">
                No trusted USDT withdrawal addresses saved yet
              </div>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                Add your personal BEP-20, TRC-20, Polygon, or ERC-20 USDT wallet on the left and
                verify with Email OTP.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {whitelistedWallets.map((w) => {
                const isUnlocked = Number(w.unlockAtMs || 0) <= nowMs;
                const isBeingEdited = editingWalletId === w.id;
                return (
                  <div
                    key={w.id}
                    className={`rounded-xl border p-3.5 flex flex-wrap items-center justify-between gap-3 transition ${
                      isBeingEdited
                        ? 'border-sky-400 bg-sky-50/60 ring-1 ring-sky-200'
                        : 'border-slate-200 bg-slate-50/70'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-slate-900">{w.label}</span>
                        <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-[10px] font-bold">
                          USDT {w.network}
                        </span>
                        {isUnlocked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3" />
                            OTP Verified · Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                            <Clock className="w-3 h-3" />
                            24h Lock: {formatRemainingMs(w.unlockAtMs, nowMs)}
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-[11px] text-slate-600 break-all">
                        {w.address}
                      </div>
                      {!isUnlocked && (
                        <div className="text-[10px] text-amber-700 font-medium">
                          Withdrawals to this address unlock on {formatUnlockDateTime(w.unlockAtMs)}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopyAddress(w.id, w.address)}
                        className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 transition"
                        title="Copy wallet address"
                      >
                        {copiedId === w.id ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => startEditWallet(w)}
                        className="p-2 rounded-lg text-slate-500 hover:text-sky-700 hover:bg-sky-50 transition"
                        title="Change address (Email OTP required)"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleRequestRemoveOtp(w)}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Remove whitelisted address (Email OTP required)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Logins & Device Activity History */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display font-bold text-slate-900 text-sm flex items-center gap-2">
              <Laptop className="w-4 h-4 text-sky-600" />
              Recent Logins &amp; Device Activity History
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Tracks sign-in sessions by browser, OS, device type, and timezone. New devices trigger
              automated security email alerts when enabled.
            </p>
          </div>
          <span className="text-[11px] font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md">
            {loginActivities.length} Recorded Sessions
          </span>
        </div>

        {loginActivities.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No login activity logged yet for this account.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3">Date &amp; Time</th>
                  <th className="px-5 py-3">Device &amp; Browser</th>
                  <th className="px-5 py-3">OS / Region</th>
                  <th className="px-5 py-3">Security Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loginActivities.slice(0, 20).map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {formatTimestamp(item.createdAt || item.loginAtMs)}
                      {idx === 0 && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-sans font-bold">
                          CURRENT
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {renderDeviceIcon(item.deviceType)}
                        <span className="font-semibold text-slate-800">
                          {item.browser} ({item.deviceType})
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600 whitespace-nowrap">
                      {item.os} &bull; {item.timezone || 'UTC'} ({item.locale || 'en'})
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {item.isNewDevice ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold">
                          <AlertTriangle className="w-3 h-3" />
                          New Device Sign-In
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                          <CheckCircle2 className="w-3 h-3" />
                          Recognized Device
                        </span>
                      )}
                    </td>
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
