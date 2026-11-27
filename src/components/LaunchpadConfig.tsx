import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Link2,
  PauseCircle,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Undo2,
} from 'lucide-react';
import { DEFAULT_MEME_LAUNCHPAD_CONFIG } from '../constants/defaults';
import { usePlatform } from '../context/PlatformContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  CustomMemeContractEntry,
  LaunchpadContractDeploymentStatus,
  MemeLaunchpadChain,
  MemeLaunchpadConfig,
  PlatformConfig,
} from '../types/platform';

interface LaunchpadConfigProps {
  onNotify?: (type: 'ok' | 'err', msg: string) => void;
}

const MAX_CONTRACTS = 40;

const STATUS_META: Record<
  LaunchpadContractDeploymentStatus,
  { label: string; badgeClass: string }
> = {
  pending: {
    label: 'Pending Deployment',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  deployed: {
    label: 'Contract Deployed',
    badgeClass: 'border-sky-200 bg-sky-50 text-sky-800',
  },
  listed: {
    label: 'Listed on DEX',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  paused: {
    label: 'Paused / Hidden',
    badgeClass: 'border-slate-200 bg-slate-100 text-slate-600',
  },
};

function getExplorerUrl(network: MemeLaunchpadChain, contractAddress: string): string {
  const clean = encodeURIComponent(contractAddress.trim());
  return network === 'BSC'
    ? `https://bscscan.com/token/${clean}`
    : `https://solscan.io/token/${clean}`;
}

function normalizeContracts(data?: Partial<PlatformConfig> | null): CustomMemeContractEntry[] {
  const list = data?.memeLaunchpadConfig?.customContracts;
  if (!Array.isArray(list)) return [];
  return list.slice(0, MAX_CONTRACTS).map((item, idx) => ({
    id: String(item?.id || `contract_${idx + 1}`),
    tokenName: String(item?.tokenName || `Meme Token ${idx + 1}`),
    ticker: String(item?.ticker || `MEME${idx + 1}`).toUpperCase(),
    contractAddress: String(item?.contractAddress || ''),
    network: item?.network === 'BSC' ? 'BSC' : 'Solana',
    deploymentStatus:
      item?.deploymentStatus === 'deployed' ||
      item?.deploymentStatus === 'listed' ||
      item?.deploymentStatus === 'paused'
        ? item.deploymentStatus
        : 'pending',
    dexName: String(item?.dexName || ''),
    dexPairUrl: String(item?.dexPairUrl || ''),
    notes: String(item?.notes || ''),
    updatedAtIso: String(item?.updatedAtIso || ''),
  }));
}

export const LaunchpadConfig: React.FC<LaunchpadConfigProps> = ({ onNotify }) => {
  const { platformConfig, updatePlatformConfigSection } = usePlatform();

  const [persistedContracts, setPersistedContracts] = useState<CustomMemeContractEntry[]>(() =>
    normalizeContracts(platformConfig)
  );
  const [contractsDraft, setContractsDraft] = useState<CustomMemeContractEntry[]>(() =>
    normalizeContracts(platformConfig)
  );
  const [loadingFirestore, setLoadingFirestore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState('');
  const [localNotice, setLocalNotice] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  // Filters
  const [networkFilter, setNetworkFilter] = useState<'ALL' | MemeLaunchpadChain>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | LaunchpadContractDeploymentStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Add new custom contract form state
  const [newTokenName, setNewTokenName] = useState('');
  const [newTicker, setNewTicker] = useState('');
  const [newNetwork, setNewNetwork] = useState<MemeLaunchpadChain>('BSC');
  const [newStatus, setNewStatus] = useState<LaunchpadContractDeploymentStatus>('pending');
  const [newContractAddress, setNewContractAddress] = useState('');
  const [newDexName, setNewDexName] = useState('PancakeSwap');
  const [newDexPairUrl, setNewDexPairUrl] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Live Firestore listener on modular platform_config/launchpad (with legacy config/platform fallback)
  useEffect(() => {
    const launchpadRef = doc(db, 'platform_config', 'launchpad');
    const unsub = onSnapshot(
      launchpadRef,
      async (snap) => {
        let data: Partial<PlatformConfig> | null = snap.exists()
          ? (snap.data() as Partial<PlatformConfig>)
          : null;
        if (!data) {
          try {
            const legacySnap = await getDoc(doc(db, 'config', 'platform'));
            if (legacySnap.exists()) data = legacySnap.data() as Partial<PlatformConfig>;
          } catch {
            // Fall back to defaults
          }
        }
        const normalized = normalizeContracts(data);
        setPersistedContracts(normalized);
        setContractsDraft(normalized);
        setLoadingFirestore(false);
        setLastSyncedAt(
          new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        );
      },
      (err) => {
        setLoadingFirestore(false);
        setLocalNotice({
          type: 'err',
          msg: err instanceof Error ? err.message : 'Unable to fetch platform_config/launchpad.',
        });
        handleFirestoreError(err, OperationType.GET, 'platform_config/launchpad');
      }
    );
    return () => unsub();
  }, []);

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(contractsDraft) !== JSON.stringify(persistedContracts),
    [contractsDraft, persistedContracts]
  );

  const stats = useMemo(() => {
    const total = contractsDraft.length;
    const bsc = contractsDraft.filter((c) => c.network === 'BSC').length;
    const solana = contractsDraft.filter((c) => c.network === 'Solana').length;
    const listed = contractsDraft.filter((c) => c.deploymentStatus === 'listed').length;
    const pending = contractsDraft.filter((c) => c.deploymentStatus === 'pending').length;
    return { total, bsc, solana, listed, pending };
  }, [contractsDraft]);

  const filteredContracts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return contractsDraft.filter((entry) => {
      if (networkFilter !== 'ALL' && entry.network !== networkFilter) return false;
      if (statusFilter !== 'ALL' && entry.deploymentStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        entry.tokenName.toLowerCase().includes(q) ||
        entry.ticker.toLowerCase().includes(q) ||
        entry.contractAddress.toLowerCase().includes(q) ||
        (entry.dexName || '').toLowerCase().includes(q)
      );
    });
  }, [contractsDraft, networkFilter, statusFilter, searchQuery]);

  const handleRefreshFromFirestore = useCallback(async () => {
    setRefreshing(true);
    setLocalNotice(null);
    try {
      const snap = await getDoc(doc(db, 'platform_config', 'launchpad'));
      let data: Partial<PlatformConfig> | null = snap.exists()
        ? (snap.data() as Partial<PlatformConfig>)
        : null;
      if (!data) {
        const legacySnap = await getDoc(doc(db, 'config', 'platform'));
        if (legacySnap.exists()) data = legacySnap.data() as Partial<PlatformConfig>;
      }
      const normalized = normalizeContracts(data);
      setPersistedContracts(normalized);
      setContractsDraft(normalized);
      setLastSyncedAt(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
      setLocalNotice({
        type: 'ok',
        msg: 'Synced latest LaunchpadConfig contracts from platform_config/launchpad.',
      });
    } catch (err) {
      setLocalNotice({
        type: 'err',
        msg: err instanceof Error ? err.message : 'Failed to refresh contract registry.',
      });
      handleFirestoreError(err, OperationType.GET, 'platform_config/launchpad');
    } finally {
      setRefreshing(false);
    }
  }, []);

  const persistContracts = async (nextList: CustomMemeContractEntry[], successMsg: string) => {
    for (const item of nextList) {
      if (
        (item.deploymentStatus === 'deployed' || item.deploymentStatus === 'listed') &&
        !item.contractAddress.trim()
      ) {
        const msg = `$${item.ticker} (${item.network}) requires a smart contract address when status is "${STATUS_META[item.deploymentStatus].label}".`;
        setLocalNotice({ type: 'err', msg });
        onNotify?.('err', msg);
        return false;
      }
      if (item.dexPairUrl?.trim() && !/^https?:\/\//i.test(item.dexPairUrl.trim())) {
        const msg = `$${item.ticker} DEX Pair URL must start with https:// or http://.`;
        setLocalNotice({ type: 'err', msg });
        onNotify?.('err', msg);
        return false;
      }
    }

    setSaving(true);
    setLocalNotice(null);
    try {
      const baseLp: MemeLaunchpadConfig =
        platformConfig.memeLaunchpadConfig || DEFAULT_MEME_LAUNCHPAD_CONFIG;
      await updatePlatformConfigSection('launchpad', {
        memeLaunchpadConfig: {
          ...baseLp,
          customContracts: nextList.slice(0, MAX_CONTRACTS),
        },
      });
      setLocalNotice({ type: 'ok', msg: successMsg });
      onNotify?.('ok', successMsg);
      return true;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to save LaunchpadConfig contracts to Firestore.';
      setLocalNotice({ type: 'err', msg });
      onNotify?.('err', msg);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleAddContract = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalNotice(null);

    if (contractsDraft.length >= MAX_CONTRACTS) {
      setLocalNotice({
        type: 'err',
        msg: `Maximum of ${MAX_CONTRACTS} custom meme contracts reached.`,
      });
      return;
    }

    const cleanName = newTokenName.trim().slice(0, 64);
    const cleanTicker = newTicker
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 16);
    const cleanAddress = newContractAddress.trim().slice(0, 128);
    const cleanPairUrl = newDexPairUrl.trim().slice(0, 300);

    if (cleanName.length < 2) {
      setLocalNotice({ type: 'err', msg: 'Enter a token name (at least 2 characters).' });
      return;
    }
    if (cleanTicker.length < 2) {
      setLocalNotice({ type: 'err', msg: 'Enter a ticker symbol (2–16 letters/numbers).' });
      return;
    }
    if ((newStatus === 'deployed' || newStatus === 'listed') && !cleanAddress) {
      setLocalNotice({
        type: 'err',
        msg: `Enter the deployed ${newNetwork} contract address or set status to Pending Deployment.`,
      });
      return;
    }
    if (cleanPairUrl && !/^https?:\/\//i.test(cleanPairUrl)) {
      setLocalNotice({ type: 'err', msg: 'External DEX Pair URL must start with https:// or http://.' });
      return;
    }

    const entry: CustomMemeContractEntry = {
      id: `mc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      tokenName: cleanName,
      ticker: cleanTicker,
      contractAddress: cleanAddress,
      network: newNetwork,
      deploymentStatus: newStatus,
      dexName: newDexName.trim().slice(0, 60) || (newNetwork === 'BSC' ? 'PancakeSwap' : 'Raydium'),
      dexPairUrl: cleanPairUrl,
      notes: newNotes.trim().slice(0, 240),
      updatedAtIso: new Date().toISOString(),
    };

    const nextList = [entry, ...contractsDraft];
    setContractsDraft(nextList);

    const saved = await persistContracts(
      nextList,
      `Added $${entry.ticker} (${entry.network}) to Launchpad Contract Registry & synced live.`
    );
    if (saved) {
      setNewTokenName('');
      setNewTicker('');
      setNewContractAddress('');
      setNewDexPairUrl('');
      setNewNotes('');
      setNewStatus('pending');
    }
  };

  const updateEntry = (id: string, patch: Partial<CustomMemeContractEntry>) => {
    setContractsDraft((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, ...patch, updatedAtIso: new Date().toISOString() }
          : item
      )
    );
  };

  const removeEntry = (id: string) => {
    setContractsDraft((prev) => prev.filter((item) => item.id !== id));
  };

  const handleCopyAddress = (id: string, addr: string) => {
    if (!addr) return;
    try {
      navigator.clipboard.writeText(addr);
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1500);
    } catch {
      // Clipboard unavailable
    }
  };

  const dexPresetsForForm =
    newNetwork === 'BSC' ? ['PancakeSwap', 'Biswap', 'Thena'] : ['Raydium', 'Pump.fun', 'Jupiter'];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Link2 className="h-5 w-5 text-amber-600" />
              <span>Launchpad Contract Registry (BSC &amp; Solana)</span>
            </h2>
            {hasUnsavedChanges && (
              <span className="px-2 py-0.5 rounded-md border border-amber-300 bg-amber-50 text-amber-800 text-[11px] font-bold">
                Unsaved Edits
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Store custom meme coin smart contract addresses, select BSC or Solana network, and control deployment status (Pending, Deployed, Listed on DEX, or Paused). Published contracts appear live on the user-facing Meme Launchpad dashboard.
          </p>
          {lastSyncedAt && (
            <p className="text-[11px] font-mono text-slate-400">
              Firestore synced at {lastSyncedAt} · {contractsDraft.length}/{MAX_CONTRACTS} slots used
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={refreshing}
            onClick={handleRefreshFromFirestore}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          {hasUnsavedChanges && (
            <button
              type="button"
              onClick={() => {
                setContractsDraft(persistedContracts);
                setLocalNotice(null);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700"
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span>Discard</span>
            </button>
          )}
          <button
            type="button"
            disabled={saving || !hasUnsavedChanges}
            onClick={() =>
              persistContracts(
                contractsDraft,
                `Saved ${contractsDraft.length} custom meme contract(s) live to Meme Launchpad.`
              )
            }
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Publishing...' : 'Save & Publish Contracts'}</span>
          </button>
        </div>
      </div>

      {localNotice && (
        <div
          className={`rounded-xl px-4 py-3 text-xs font-semibold border ${
            localNotice.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {localNotice.msg}
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">Total Contracts</p>
          <p className="mt-1 font-mono text-xl font-bold text-slate-900">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">BSC (BEP-20)</p>
          <p className="mt-1 font-mono text-xl font-bold text-amber-600">{stats.bsc}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">Solana (SPL)</p>
          <p className="mt-1 font-mono text-xl font-bold text-violet-600">{stats.solana}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">Listed on DEX</p>
          <p className="mt-1 font-mono text-xl font-bold text-emerald-600">{stats.listed}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">Pending Deploy</p>
          <p className="mt-1 font-mono text-xl font-bold text-slate-700">{stats.pending}</p>
        </div>
      </div>

      {/* Add Custom Meme Contract Form */}
      <form
        onSubmit={handleAddContract}
        className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Plus className="h-4 w-4 text-amber-600" />
              <span>Register New Meme Coin Smart Contract</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Leave Contract Address blank with status <span className="font-semibold text-amber-700">Pending Deployment</span> to pre-announce a coin, then paste the address later after deploying on BSC or Solana.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-3">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Token Name *
            </label>
            <input
              required
              maxLength={64}
              value={newTokenName}
              onChange={(e) => setNewTokenName(e.target.value)}
              placeholder="e.g. AlphaPepe"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Ticker *
            </label>
            <input
              required
              maxLength={16}
              value={newTicker}
              onChange={(e) =>
                setNewTicker(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
              }
              placeholder="APEPE"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono uppercase font-bold text-amber-700"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Network *
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {(['BSC', 'Solana'] as const).map((net) => (
                <button
                  key={net}
                  type="button"
                  onClick={() => {
                    setNewNetwork(net);
                    setNewDexName(net === 'BSC' ? 'PancakeSwap' : 'Raydium');
                  }}
                  className={`py-2 rounded-xl border text-xs font-bold transition-colors ${
                    newNetwork === net
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {net}
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-4">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Deployment Status *
            </label>
            <select
              value={newStatus}
              onChange={(e) =>
                setNewStatus(e.target.value as LaunchpadContractDeploymentStatus)
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800"
            >
              <option value="pending">Pending Deployment (Contract TBA)</option>
              <option value="deployed">Contract Deployed (Pre-DEX)</option>
              <option value="listed">Listed on External DEX</option>
              <option value="paused">Paused / Hidden from Users</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              {newNetwork} Smart Contract Address{' '}
              {newStatus === 'pending' ? '(Optional while Pending)' : '*'}
            </label>
            <input
              maxLength={128}
              value={newContractAddress}
              onChange={(e) => setNewContractAddress(e.target.value)}
              placeholder={
                newNetwork === 'BSC'
                  ? '0x... (BEP-20 Contract Address)'
                  : 'So111... (Solana SPL Mint Address)'
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-900"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Target / Listed DEX
            </label>
            <input
              maxLength={60}
              value={newDexName}
              onChange={(e) => setNewDexName(e.target.value)}
              placeholder={newNetwork === 'BSC' ? 'PancakeSwap' : 'Raydium'}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
            />
            <div className="flex flex-wrap gap-1 mt-1">
              {dexPresetsForForm.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setNewDexName(preset)}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                    newDexName === preset
                      ? 'border-amber-400 bg-amber-50 text-amber-800'
                      : 'border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-4">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              DEX Pair / Trade URL (Optional)
            </label>
            <input
              type="url"
              maxLength={300}
              value={newDexPairUrl}
              onChange={(e) => setNewDexPairUrl(e.target.value)}
              placeholder={
                newNetwork === 'BSC'
                  ? 'https://pancakeswap.finance/swap?outputCurrency=0x...'
                  : 'https://raydium.io/swap/?inputMint=sol&outputMint=...'
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-800"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="flex-1">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Public Deployment Note (Optional)
            </label>
            <input
              maxLength={240}
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="e.g. Liquidity lock proof & DEX pair scheduled after bonding curve milestone"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shrink-0 disabled:opacity-50"
          >
            <Rocket className="h-3.5 w-3.5 text-amber-400" />
            <span>{saving ? 'Saving...' : 'Add & Publish Contract'}</span>
          </button>
        </div>
      </form>

      {/* Registered Custom Contracts Array Editor */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Stored Custom Meme Contracts ({contractsDraft.length})
            </h3>
            <p className="text-[11px] text-slate-500">
              Edit network, smart contract address, or deployment status inline, then click <span className="font-semibold text-slate-700">Save &amp; Publish Contracts</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5">
              {(['ALL', 'BSC', 'Solana'] as const).map((net) => (
                <button
                  key={net}
                  type="button"
                  onClick={() => setNetworkFilter(net)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                    networkFilter === net
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {net}
                </button>
              ))}
            </div>

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'ALL' | LaunchpadContractDeploymentStatus)
              }
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px] font-semibold text-slate-700"
            >
              <option value="ALL">All Statuses</option>
              <option value="pending">Pending Deployment</option>
              <option value="deployed">Contract Deployed</option>
              <option value="listed">Listed on DEX</option>
              <option value="paused">Paused / Hidden</option>
            </select>

            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter ticker or 0x..."
                className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 w-44"
              />
            </div>
          </div>
        </div>

        {loadingFirestore ? (
          <p className="text-xs text-slate-500 py-6 text-center">
            Loading LaunchpadConfig from Firestore...
          </p>
        ) : filteredContracts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center space-y-1">
            <p className="text-xs font-semibold text-slate-700">
              {contractsDraft.length === 0
                ? 'No custom meme coin contracts registered yet.'
                : 'No contracts match your active filter.'}
            </p>
            <p className="text-[11px] text-slate-500">
              Add a BSC or Solana meme coin contract above — it will automatically sync to the user-facing Meme Launchpad dashboard.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredContracts.map((entry) => {
              const meta = STATUS_META[entry.deploymentStatus] || STATUS_META.pending;
              const hasAddress = Boolean(entry.contractAddress.trim());
              return (
                <div
                  key={entry.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{entry.tokenName}</span>
                      <span className="font-mono text-xs font-bold text-amber-700">
                        ${entry.ticker}
                      </span>
                      <span className="px-2 py-0.5 rounded-md border border-slate-200 bg-white font-mono text-[11px] font-bold text-slate-700">
                        {entry.network}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-bold ${meta.badgeClass}`}
                      >
                        {entry.deploymentStatus === 'listed' ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : entry.deploymentStatus === 'deployed' ? (
                          <ShieldCheck className="h-3 w-3" />
                        ) : entry.deploymentStatus === 'paused' ? (
                          <PauseCircle className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        <span>{meta.label}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {hasAddress && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleCopyAddress(entry.id, entry.contractAddress)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700"
                            title="Copy contract address"
                          >
                            {copiedId === entry.id ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-600" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span>Copy CA</span>
                              </>
                            )}
                          </button>
                          <a
                            href={getExplorerUrl(entry.network, entry.contractAddress)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700"
                          >
                            <span>{entry.network === 'BSC' ? 'BscScan' : 'Solscan'}</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => removeEntry(entry.id)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                        title="Remove contract entry"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                        Network
                      </label>
                      <select
                        value={entry.network}
                        onChange={(e) =>
                          updateEntry(entry.id, {
                            network: e.target.value as MemeLaunchpadChain,
                          })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-800"
                      >
                        <option value="BSC">BSC</option>
                        <option value="Solana">Solana</option>
                      </select>
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                        Deployment Status
                      </label>
                      <select
                        value={entry.deploymentStatus}
                        onChange={(e) =>
                          updateEntry(entry.id, {
                            deploymentStatus: e.target.value as LaunchpadContractDeploymentStatus,
                          })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-800"
                      >
                        <option value="pending">Pending Deployment</option>
                        <option value="deployed">Contract Deployed</option>
                        <option value="listed">Listed on DEX</option>
                        <option value="paused">Paused / Hidden</option>
                      </select>
                    </div>

                    <div className="md:col-span-4">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                        Smart Contract Address
                      </label>
                      <input
                        maxLength={128}
                        value={entry.contractAddress}
                        onChange={(e) =>
                          updateEntry(entry.id, { contractAddress: e.target.value })
                        }
                        placeholder={
                          entry.network === 'BSC'
                            ? '0x... (Pending deployment)'
                            : 'Solana Mint... (Pending deployment)'
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-mono text-slate-900"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                        External DEX Name
                      </label>
                      <input
                        maxLength={60}
                        value={entry.dexName || ''}
                        onChange={(e) => updateEntry(entry.id, { dexName: e.target.value })}
                        placeholder={entry.network === 'BSC' ? 'PancakeSwap' : 'Raydium'}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
                    <div className="md:col-span-6">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                        DEX Trade / Pair URL (Optional)
                      </label>
                      <input
                        type="url"
                        maxLength={300}
                        value={entry.dexPairUrl || ''}
                        onChange={(e) => updateEntry(entry.id, { dexPairUrl: e.target.value })}
                        placeholder="https://..."
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-mono text-slate-700"
                      />
                    </div>
                    <div className="md:col-span-6">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                        Public Note (Optional)
                      </label>
                      <input
                        maxLength={240}
                        value={entry.notes || ''}
                        onChange={(e) => updateEntry(entry.id, { notes: e.target.value })}
                        placeholder="Deployment note shown on Meme Launchpad"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
