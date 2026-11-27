import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Compass,
  Cpu,
  ExternalLink,
  Link2,
  Lock,
  Plus,
  Rocket,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  DEFAULT_MEME_LAUNCHPAD_CONFIG,
  DEFAULT_ROADMAP_CONFIG,
} from '../constants/defaults';
import { usePlatform } from '../context/PlatformContext';
import {
  BoosterNode,
  MemeDexListingStatus,
  MemeLaunchpadConfig,
  MemeLaunchpadStatus,
  MemeLaunchpadToken,
  MemeLaunchpadTrade,
  RoadmapConfig,
  RoadmapPhase,
  RoadmapPhaseStatus,
} from '../types/platform';
import { BoosterManagement } from './BoosterManagement';
import { LaunchpadConfig } from './LaunchpadConfig';

interface AdminEcosystemControlsPanelProps {
  allLaunchpadTokens: MemeLaunchpadToken[];
  allLaunchpadTrades: MemeLaunchpadTrade[];
  allBoosterNodes: BoosterNode[];
}

export const AdminEcosystemControlsPanel: React.FC<AdminEcosystemControlsPanelProps> = ({
  allLaunchpadTokens,
  allLaunchpadTrades,
  allBoosterNodes,
}) => {
  const {
    platformConfig,
    updatePlatformConfigSection,
    adminUpdateLaunchpadToken,
    adminDeleteLaunchpadToken,
  } = usePlatform();

  const [subTab, setSubTab] = useState<'launchpad' | 'contracts' | 'roadmap' | 'booster'>('launchpad');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  // External DEX smart contract editor state (per meme token)
  const [editingDexTokenId, setEditingDexTokenId] = useState<string | null>(null);
  const [dexStatusDraft, setDexStatusDraft] = useState<MemeDexListingStatus>('pending');
  const [dexContractDraft, setDexContractDraft] = useState('');
  const [dexNameDraft, setDexNameDraft] = useState('');
  const [dexPairUrlDraft, setDexPairUrlDraft] = useState('');
  const [savingDex, setSavingDex] = useState(false);

  // Local editable drafts synced with platformConfig
  const [lpDraft, setLpDraft] = useState<MemeLaunchpadConfig>(
    platformConfig.memeLaunchpadConfig || DEFAULT_MEME_LAUNCHPAD_CONFIG
  );
  const [roadmapDraft, setRoadmapDraft] = useState<RoadmapConfig>(
    platformConfig.roadmapConfig || DEFAULT_ROADMAP_CONFIG
  );

  useEffect(() => {
    setLpDraft(platformConfig.memeLaunchpadConfig || DEFAULT_MEME_LAUNCHPAD_CONFIG);
    setRoadmapDraft(platformConfig.roadmapConfig || DEFAULT_ROADMAP_CONFIG);
  }, [platformConfig]);

  const activeBoosterName =
    platformConfig.boosterBrandName?.trim() ||
    platformConfig.boosterConfig?.brandName?.trim() ||
    'ATXBooster';

  const totalLaunchpadVolume = useMemo(
    () =>
      allLaunchpadTrades.reduce((s, t) => s + (t.amountUsd || 0), 0) +
      allLaunchpadTokens.reduce((s, t) => s + (t.initialBuyUsd || 0), 0),
    [allLaunchpadTrades, allLaunchpadTokens]
  );

  const handlePublishEcosystemConfig = async () => {
    setSaving(true);
    setNotice(null);
    try {
      await Promise.all([
        updatePlatformConfigSection('launchpad', {
          memeLaunchpadConfig: {
            ...lpDraft,
            customContracts:
              platformConfig.memeLaunchpadConfig?.customContracts ||
              lpDraft.customContracts ||
              [],
          },
        }),
        updatePlatformConfigSection('roadmap', {
          roadmapConfig: roadmapDraft,
        }),
      ]);
      setNotice({
        type: 'ok',
        msg: 'Saved & published live! platform_config/launchpad & platform_config/roadmap synced across alphatradex.pro.',
      });
    } catch (err) {
      setNotice({
        type: 'err',
        msg: err instanceof Error ? err.message : 'Failed to publish ecosystem settings.',
      });
    } finally {
      setSaving(false);
    }
  };

  const openDexEditor = (tok: MemeLaunchpadToken) => {
    setNotice(null);
    setEditingDexTokenId(tok.id);
    setDexStatusDraft(tok.dexListingStatus === 'listed' ? 'listed' : 'pending');
    setDexContractDraft(tok.contractAddress || '');
    setDexNameDraft(tok.dexName || (tok.chain === 'BSC' ? 'PancakeSwap' : 'Raydium'));
    setDexPairUrlDraft(tok.dexPairUrl || '');
  };

  const handleSaveDexContract = async (tok: MemeLaunchpadToken) => {
    const cleanContract = dexContractDraft.trim();
    const cleanDexName = dexNameDraft.trim();
    const cleanPairUrl = dexPairUrlDraft.trim();

    if (dexStatusDraft === 'listed' && !cleanContract) {
      setNotice({
        type: 'err',
        msg: `Enter the deployed ${tok.chain} smart contract address before marking $${tok.ticker} as Listed on DEX.`,
      });
      return;
    }
    if (cleanPairUrl && !/^https?:\/\//i.test(cleanPairUrl)) {
      setNotice({
        type: 'err',
        msg: 'External DEX Pair URL must start with https:// or http://.',
      });
      return;
    }

    setSavingDex(true);
    setNotice(null);
    try {
      await adminUpdateLaunchpadToken(tok.id, {
        dexListingStatus: dexStatusDraft,
        contractAddress: cleanContract,
        dexName: cleanDexName || (tok.chain === 'BSC' ? 'PancakeSwap' : 'Raydium'),
        dexPairUrl: cleanPairUrl,
      });
      setNotice({
        type: 'ok',
        msg:
          dexStatusDraft === 'listed'
            ? `$${tok.ticker} linked to ${cleanDexName || (tok.chain === 'BSC' ? 'PancakeSwap' : 'Raydium')} (${cleanContract.slice(0, 8)}...${cleanContract.slice(-4)}) and marked Listed.`
            : `$${tok.ticker} DEX listing status saved as Pending.`,
      });
      setEditingDexTokenId(null);
    } catch (err) {
      setNotice({
        type: 'err',
        msg: err instanceof Error ? err.message : 'Failed to save DEX smart contract details.',
      });
    } finally {
      setSavingDex(false);
    }
  };

  const updatePhase = (idx: number, patch: Partial<RoadmapPhase>) => {
    setRoadmapDraft((prev) => ({
      ...prev,
      phases: prev.phases.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    }));
  };

  const addPhase = () => {
    setRoadmapDraft((prev) => ({
      ...prev,
      phases: [
        ...prev.phases,
        {
          id: `phase_${Date.now()}`,
          phaseLabel: `Phase 0${prev.phases.length + 1}`,
          quarter: '2027 · Upcoming',
          title: 'New Strategic Milestone',
          status: 'upcoming',
          description: 'Describe this upcoming AlphaTradex engineering phase.',
          milestones: ['Milestone deliverable 1', 'Milestone deliverable 2'],
        },
      ],
    }));
  };

  const removePhase = (idx: number) => {
    if (roadmapDraft.phases.length <= 1) return;
    setRoadmapDraft((prev) => ({
      ...prev,
      phases: prev.phases.filter((_, i) => i !== idx),
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header & Global Save Button */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Ecosystem Controls: Booster Engine, Meme Launchpad &amp; Roadmap
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Rename the Booster globally, configure tier yields, moderate BSC/Solana meme launches, and update platform roadmap badges in real time.
          </p>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={handlePublishEcosystemConfig}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm transition-colors disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          <span>{saving ? 'Publishing...' : 'Publish All Ecosystem Changes'}</span>
        </button>
      </div>

      {notice && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs font-medium ${
            notice.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {notice.msg}
        </div>
      )}

      {/* Sub-Navigation */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { id: 'launchpad', label: `Meme Launchpad (${allLaunchpadTokens.length})`, icon: Rocket },
            {
              id: 'contracts',
              label: `Contract Registry (${(platformConfig.memeLaunchpadConfig?.customContracts || []).length})`,
              icon: Link2,
            },
            { id: 'roadmap', label: `Platform Roadmap (${roadmapDraft.phases.length})`, icon: Compass },
            { id: 'booster', label: `${activeBoosterName} Engine`, icon: Cpu },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                active
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ================================================================ */}
      {/* SUB-TAB: LAUNCHPAD CONTRACT REGISTRY (BSC / SOLANA)              */}
      {/* ================================================================ */}
      {subTab === 'contracts' && <LaunchpadConfig />}

      {/* ================================================================ */}
      {/* SUB-TAB: DEDICATED BOOSTER ENGINE MANAGER                        */}
      {/* ================================================================ */}
      {subTab === 'booster' && (
        <BoosterManagement allBoosterNodes={allBoosterNodes} />
      )}

      {/* ================================================================ */}
      {/* SUB-TAB 2: MEME LAUNCHPAD CONTROLS & MODERATION                  */}
      {/* ================================================================ */}
      {subTab === 'launchpad' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] uppercase text-slate-500">Live Firestore Tokens</p>
              <p className="mt-1 font-mono text-lg font-bold text-slate-900">
                {allLaunchpadTokens.length}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] uppercase text-slate-500">Total Launchpad Volume</p>
              <p className="mt-1 font-mono text-lg font-bold text-emerald-700">
                ${totalLaunchpadVolume.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] uppercase text-slate-500">Bonding Curve Orders</p>
              <p className="mt-1 font-mono text-lg font-bold text-slate-900">
                {allLaunchpadTrades.length}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] uppercase text-slate-500">Launch Fee / Curve Fee</p>
              <p className="mt-1 font-mono text-lg font-bold text-amber-600">
                ${lpDraft.launchFeeUsd} · {lpDraft.tradingFeePercent}%
              </p>
            </div>
          </div>

          {/* Launchpad Fee & Policy Form */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-900">Launchpad Fees &amp; Curve Rules</h3>
              <div className="flex items-center gap-4 text-xs font-semibold text-slate-700">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lpDraft.enabled}
                    onChange={(e) => setLpDraft((p) => ({ ...p, enabled: e.target.checked }))}
                  />
                  <span>Launchpad Enabled</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lpDraft.allowUserLaunches}
                    onChange={(e) =>
                      setLpDraft((p) => ({ ...p, allowUserLaunches: e.target.checked }))
                    }
                  />
                  <span>Allow User Launches</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Launch Creation Fee (USD)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={lpDraft.launchFeeUsd}
                  onChange={(e) =>
                    setLpDraft((p) => ({ ...p, launchFeeUsd: Number(e.target.value) || 0 }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Trading / Curve Fee (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="15"
                  step="0.1"
                  value={lpDraft.tradingFeePercent}
                  onChange={(e) =>
                    setLpDraft((p) => ({ ...p, tradingFeePercent: Number(e.target.value) || 0 }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Graduation Target (USD)
                </label>
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  value={lpDraft.graduationTargetUsd}
                  onChange={(e) =>
                    setLpDraft((p) => ({
                      ...p,
                      graduationTargetUsd: Number(e.target.value) || 69000,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Default LP Lock (Days)
                </label>
                <input
                  type="number"
                  min="0"
                  max="3650"
                  value={lpDraft.defaultLockDays}
                  onChange={(e) =>
                    setLpDraft((p) => ({ ...p, defaultLockDays: Number(e.target.value) || 365 }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* Meme Token Moderation Table */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Deployed Meme Tokens Moderation ({allLaunchpadTokens.length})
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  All new tokens default to <span className="font-semibold text-amber-700">DEX Listing: Pending</span>. Click <span className="font-semibold text-slate-700">DEX Contract</span> anytime after deploying your BSC/Solana smart contract to link it live.
                </p>
              </div>
            </div>
            {allLaunchpadTokens.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                No user-deployed meme tokens in Firestore yet. Tokens launched via Meme Launchpad will appear here for live status, featuring, DEX contract linking, and delisting.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-3">Token</th>
                      <th className="py-2 pr-3">Chain</th>
                      <th className="py-2 pr-3">Curve / Vol</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">DEX Listing</th>
                      <th className="py-2 pr-3">Featured</th>
                      <th className="py-2 pr-3">LP Lock</th>
                      <th className="py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allLaunchpadTokens.map((tok) => {
                      const isDexListed = tok.dexListingStatus === 'listed' && Boolean(tok.contractAddress?.trim());
                      const isEditingDex = editingDexTokenId === tok.id;
                      const dexPresets =
                        tok.chain === 'BSC'
                          ? ['PancakeSwap', 'Biswap', 'Thena']
                          : ['Raydium', 'Pump.fun', 'Jupiter'];
                      return (
                        <React.Fragment key={tok.id}>
                          <tr>
                            <td className="py-2.5 pr-3 font-semibold text-slate-900">
                              {tok.name}{' '}
                              <span className="font-mono text-amber-600">${tok.ticker}</span>
                              <div className="text-[11px] font-normal text-slate-500">
                                @{tok.creatorHandle}
                              </div>
                            </td>
                            <td className="py-2.5 pr-3 font-mono text-slate-700">{tok.chain}</td>
                            <td className="py-2.5 pr-3 font-mono text-slate-700">
                              {tok.progressPercent.toFixed(1)}% · ${tok.volume24hUsd.toFixed(0)}
                            </td>
                            <td className="py-2.5 pr-3">
                              <select
                                value={tok.status}
                                onChange={(e) =>
                                  adminUpdateLaunchpadToken(tok.id, {
                                    status: e.target.value as MemeLaunchpadStatus,
                                  })
                                }
                                className="px-2 py-1 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
                              >
                                <option value="live">Live</option>
                                <option value="upcoming">Upcoming</option>
                                <option value="graduated">Graduated</option>
                                <option value="delisted">Delisted</option>
                              </select>
                            </td>
                            <td className="py-2.5 pr-3">
                              {isDexListed ? (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 text-[11px] font-bold">
                                    <CheckCircle2 className="h-3 w-3" />
                                    <span>Listed · {tok.dexName || (tok.chain === 'BSC' ? 'PancakeSwap' : 'Raydium')}</span>
                                  </span>
                                  <div className="font-mono text-[10px] text-slate-500">
                                    {tok.contractAddress && tok.contractAddress.length > 14
                                      ? `${tok.contractAddress.slice(0, 6)}...${tok.contractAddress.slice(-5)}`
                                      : tok.contractAddress}
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-amber-200 bg-amber-50 text-amber-700 text-[11px] font-bold">
                                    <Clock className="h-3 w-3" />
                                    <span>Pending</span>
                                  </span>
                                  <div className="text-[10px] text-slate-400">
                                    {tok.contractAddress ? 'Draft contract saved' : 'No contract linked'}
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 pr-3">
                              <button
                                type="button"
                                onClick={() =>
                                  adminUpdateLaunchpadToken(tok.id, { featured: !tok.featured })
                                }
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                                  tok.featured
                                    ? 'border-amber-300 bg-amber-50 text-amber-700'
                                    : 'border-slate-200 bg-slate-50 text-slate-500'
                                }`}
                              >
                                <Sparkles className="h-3 w-3" />
                                <span>{tok.featured ? 'Featured' : 'Standard'}</span>
                              </button>
                            </td>
                            <td className="py-2.5 pr-3">
                              <button
                                type="button"
                                onClick={() =>
                                  adminUpdateLaunchpadToken(tok.id, {
                                    liquidityLocked: !tok.liquidityLocked,
                                  })
                                }
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                                  tok.liquidityLocked
                                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                    : 'border-slate-200 bg-slate-50 text-slate-500'
                                }`}
                              >
                                <Lock className="h-3 w-3" />
                                <span>{tok.liquidityLocked ? `${tok.lockDays}d` : 'Unlocked'}</span>
                              </button>
                            </td>
                            <td className="py-2.5 text-right">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => (isEditingDex ? setEditingDexTokenId(null) : openDexEditor(tok))}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                                    isEditingDex
                                      ? 'border-slate-900 bg-slate-900 text-white'
                                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-800'
                                  }`}
                                  title="Add or edit external BSC/Solana smart contract & DEX listing"
                                >
                                  <Link2 className="h-3.5 w-3.5" />
                                  <span>{isDexListed ? 'Edit DEX' : 'Add DEX'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => adminDeleteLaunchpadToken(tok.id)}
                                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                                  title="Delete token"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isEditingDex && (
                            <tr className="bg-slate-50/90">
                              <td colSpan={8} className="p-4">
                                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                        <ExternalLink className="h-3.5 w-3.5 text-amber-600" />
                                        <span>
                                          External DEX Smart Contract &amp; Listing — {tok.name} (${tok.ticker} · {tok.chain})
                                        </span>
                                      </h4>
                                      <p className="text-[11px] text-slate-500 mt-0.5">
                                        Keep as <span className="font-semibold">Pending</span> until you deploy the {tok.chain} smart contract externally, then paste the contract address and switch to <span className="font-semibold">Listed on External DEX</span>.
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setEditingDexTokenId(null)}
                                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                                      title="Close editor"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                    <div>
                                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                        DEX Listing Status
                                      </label>
                                      <select
                                        value={dexStatusDraft}
                                        onChange={(e) =>
                                          setDexStatusDraft(e.target.value as MemeDexListingStatus)
                                        }
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800"
                                      >
                                        <option value="pending">Pending (Internal Launchpad Only)</option>
                                        <option value="listed">Listed on External DEX</option>
                                      </select>
                                    </div>

                                    <div>
                                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                        External DEX Platform
                                      </label>
                                      <input
                                        type="text"
                                        maxLength={60}
                                        value={dexNameDraft}
                                        onChange={(e) => setDexNameDraft(e.target.value)}
                                        placeholder={tok.chain === 'BSC' ? 'PancakeSwap' : 'Raydium'}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                                      />
                                      <div className="flex flex-wrap gap-1 mt-1.5">
                                        {dexPresets.map((preset) => (
                                          <button
                                            key={preset}
                                            type="button"
                                            onClick={() => setDexNameDraft(preset)}
                                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                              dexNameDraft === preset
                                                ? 'border-amber-400 bg-amber-50 text-amber-800'
                                                : 'border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-800'
                                            }`}
                                          >
                                            {preset}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="lg:col-span-2">
                                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                        Deployed {tok.chain} Smart Contract Address
                                      </label>
                                      <input
                                        type="text"
                                        maxLength={128}
                                        value={dexContractDraft}
                                        onChange={(e) => setDexContractDraft(e.target.value)}
                                        placeholder={
                                          tok.chain === 'BSC'
                                            ? '0x... (BEP-20 Smart Contract Address)'
                                            : 'So111... (Solana SPL Token Mint Address)'
                                        }
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-900"
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                      External DEX Trade / Pair URL (Optional)
                                    </label>
                                    <input
                                      type="url"
                                      maxLength={300}
                                      value={dexPairUrlDraft}
                                      onChange={(e) => setDexPairUrlDraft(e.target.value)}
                                      placeholder={
                                        tok.chain === 'BSC'
                                          ? 'https://pancakeswap.finance/swap?outputCurrency=0x...'
                                          : 'https://raydium.io/swap/?inputMint=sol&outputMint=...'
                                      }
                                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-800"
                                    />
                                  </div>

                                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => setEditingDexTokenId(null)}
                                      className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      disabled={savingDex}
                                      onClick={() => handleSaveDexContract(tok)}
                                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold disabled:opacity-50"
                                    >
                                      <Save className="h-3.5 w-3.5" />
                                      <span>{savingDex ? 'Saving...' : 'Save DEX Contract'}</span>
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* SUB-TAB 3: PLATFORM ROADMAP EDITOR                               */}
      {/* ================================================================ */}
      {subTab === 'roadmap' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">AlphaTradex Roadmap Editor</h3>
              <p className="text-xs text-slate-500">
                Use <code className="font-mono text-amber-700">{'{BOOSTER}'}</code> inside titles or milestones to automatically display your active Booster brand name.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={roadmapDraft.enabled}
                  onChange={(e) => setRoadmapDraft((p) => ({ ...p, enabled: e.target.checked }))}
                />
                <span>Show Roadmap</span>
              </label>
              <button
                type="button"
                onClick={addPhase}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Phase</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Section Title</label>
              <input
                value={roadmapDraft.title}
                onChange={(e) => setRoadmapDraft((p) => ({ ...p, title: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Section Subtitle</label>
              <input
                value={roadmapDraft.subtitle}
                onChange={(e) => setRoadmapDraft((p) => ({ ...p, subtitle: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>
          </div>

          <div className="space-y-4">
            {roadmapDraft.phases.map((phase, idx) => (
              <div
                key={phase.id}
                className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3"
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Phase Label
                    </label>
                    <input
                      value={phase.phaseLabel}
                      onChange={(e) => updatePhase(idx, { phaseLabel: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Quarter / Timeline
                    </label>
                    <input
                      value={phase.quarter}
                      onChange={(e) => updatePhase(idx, { quarter: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs"
                    />
                  </div>
                  <div className="md:col-span-4">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Phase Title
                    </label>
                    <input
                      value={phase.title}
                      onChange={(e) => updatePhase(idx, { title: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Status Badge
                    </label>
                    <select
                      value={phase.status}
                      onChange={(e) =>
                        updatePhase(idx, { status: e.target.value as RoadmapPhaseStatus })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold"
                    >
                      <option value="completed">Completed</option>
                      <option value="active">Active</option>
                      <option value="upcoming">Upcoming</option>
                    </select>
                  </div>
                  <div className="md:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removePhase(idx)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                      title="Delete phase"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Phase Description
                    </label>
                    <textarea
                      rows={3}
                      value={phase.description}
                      onChange={(e) => updatePhase(idx, { description: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Milestones (one per line)
                    </label>
                    <textarea
                      rows={3}
                      value={(phase.milestones || []).join('\n')}
                      onChange={(e) =>
                        updatePhase(idx, {
                          milestones: e.target.value.split('\n'),
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={handlePublishEcosystemConfig}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Save Roadmap to Live Site</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
