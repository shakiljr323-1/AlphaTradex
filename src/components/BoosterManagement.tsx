import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Copy,
  Cpu,
  Flame,
  Layers,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Undo2,
  Zap,
} from 'lucide-react';
import { DEFAULT_BOOSTER_CONFIG } from '../constants/defaults';
import { usePlatform } from '../context/PlatformContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { BoosterConfig, BoosterNode, BoosterTierConfig, PlatformConfig } from '../types/platform';

interface BoosterManagementProps {
  allBoosterNodes: BoosterNode[];
  onNotify?: (type: 'ok' | 'err', msg: string) => void;
}

const CANONICAL_CORE_TIERS: Array<{ id: string; defaultName: string; slotLabel: string }> = [
  { id: 'spark-core', defaultName: 'Spark Core', slotLabel: 'Tier 01 · Base Slot' },
  { id: 'pulse-node', defaultName: 'Pulse Node', slotLabel: 'Tier 02 · Growth Slot' },
  { id: 'vector-array', defaultName: 'Vector Array', slotLabel: 'Tier 03 · Pro Slot' },
  { id: 'sovereign-cluster', defaultName: 'Sovereign Cluster', slotLabel: 'Tier 04 · Elite Slot' },
];

const ACCENT_BADGE: Record<BoosterTierConfig['accent'], string> = {
  sky: 'bg-sky-50 text-sky-700 border-sky-200',
  teal: 'bg-teal-50 text-teal-700 border-teal-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  violet: 'bg-violet-50 text-violet-700 border-violet-200',
};

const MAX_TIERS = 12;

function normalizeFetchedBooster(data?: Partial<PlatformConfig> | null): BoosterConfig {
  const raw = data?.boosterConfig;
  const resolvedBrand =
    String(
      data?.boosterBrandName || raw?.brandName || DEFAULT_BOOSTER_CONFIG.brandName
    ).trim() || DEFAULT_BOOSTER_CONFIG.brandName;

  const incomingTiers =
    Array.isArray(raw?.tiers) && raw.tiers.length > 0 ? raw.tiers : DEFAULT_BOOSTER_CONFIG.tiers;

  // Ensure the 4 canonical tier slots are always present in deterministic order, followed by any custom tiers
  const byId = new Map<string, BoosterTierConfig>();
  incomingTiers.forEach((t) => {
    if (t && t.id) byId.set(t.id, t);
  });

  const canonicalMapped: BoosterTierConfig[] = CANONICAL_CORE_TIERS.map((slot, idx) => {
    const existing = byId.get(slot.id) || incomingTiers[idx];
    const fallback = DEFAULT_BOOSTER_CONFIG.tiers[idx];
    return {
      ...fallback,
      ...(existing || {}),
      id: existing?.id || slot.id,
      name: String(existing?.name || fallback.name).trim() || fallback.name,
      dailyPercent: Number(existing?.dailyPercent ?? fallback.dailyPercent) || fallback.dailyPercent,
      capital: Number(existing?.capital ?? fallback.capital) || fallback.capital,
      profitDays: Number(existing?.profitDays ?? fallback.profitDays) || fallback.profitDays,
      capitalLockDays: Number(existing?.capitalLockDays ?? fallback.capitalLockDays) || fallback.capitalLockDays,
      enabled: existing?.enabled !== false,
    };
  });

  const canonicalIds = new Set(canonicalMapped.map((t) => t.id));
  const extraTiers = incomingTiers.filter((t) => t && t.id && !canonicalIds.has(t.id));

  return {
    ...DEFAULT_BOOSTER_CONFIG,
    ...(raw || {}),
    enabled: raw?.enabled !== false,
    brandName: resolvedBrand,
    tagline: String(raw?.tagline ?? DEFAULT_BOOSTER_CONFIG.tagline),
    turboBonusLabel: String(raw?.turboBonusLabel ?? DEFAULT_BOOSTER_CONFIG.turboBonusLabel),
    tiers: [...canonicalMapped, ...extraTiers].slice(0, MAX_TIERS),
  };
}

export const BoosterManagement: React.FC<BoosterManagementProps> = ({
  allBoosterNodes,
  onNotify,
}) => {
  const { platformConfig, updatePlatformConfigSection } = usePlatform();

  const [fetchedConfig, setFetchedConfig] = useState<BoosterConfig>(() =>
    normalizeFetchedBooster(platformConfig)
  );
  const [boosterBrandName, setBoosterBrandName] = useState<string>(() =>
    normalizeFetchedBooster(platformConfig).brandName
  );
  const [draft, setDraft] = useState<BoosterConfig>(() => normalizeFetchedBooster(platformConfig));
  const [loadingFirestore, setLoadingFirestore] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>('');
  const [localNotice, setLocalNotice] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  // Direct real-time Firestore subscription to modular platform_config/boosters (with legacy fallback)
  useEffect(() => {
    const boosterRef = doc(db, 'platform_config', 'boosters');
    const unsub = onSnapshot(
      boosterRef,
      async (snap) => {
        let data: Partial<PlatformConfig> | null = snap.exists()
          ? (snap.data() as Partial<PlatformConfig>)
          : null;
        if (!data) {
          try {
            const legacySnap = await getDoc(doc(db, 'config', 'platform'));
            if (legacySnap.exists()) {
              data = legacySnap.data() as Partial<PlatformConfig>;
            }
          } catch {
            // Fall back to defaults
          }
        }
        const normalized = normalizeFetchedBooster(data);
        setFetchedConfig(normalized);
        setBoosterBrandName(normalized.brandName);
        setDraft(normalized);
        setLoadingFirestore(false);
        setLastSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      },
      (err) => {
        setLoadingFirestore(false);
        setLocalNotice({
          type: 'err',
          msg: err instanceof Error ? err.message : 'Unable to fetch platform_config/boosters from Firestore.',
        });
        handleFirestoreError(err, OperationType.GET, 'platform_config/boosters');
      }
    );
    return () => unsub();
  }, []);

  const handleRefreshFromFirestore = useCallback(async () => {
    setRefreshing(true);
    setLocalNotice(null);
    try {
      const snap = await getDoc(doc(db, 'platform_config', 'boosters'));
      let data: Partial<PlatformConfig> | null = snap.exists()
        ? (snap.data() as Partial<PlatformConfig>)
        : null;
      if (!data) {
        const legacySnap = await getDoc(doc(db, 'config', 'platform'));
        if (legacySnap.exists()) data = legacySnap.data() as Partial<PlatformConfig>;
      }
      const normalized = normalizeFetchedBooster(data);
      setFetchedConfig(normalized);
      setBoosterBrandName(normalized.brandName);
      setDraft(normalized);
      setLastSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setLocalNotice({
        type: 'ok',
        msg: 'Re-fetched latest boosterConfig directly from platform_config/boosters.',
      });
    } catch (err) {
      setLocalNotice({
        type: 'err',
        msg: err instanceof Error ? err.message : 'Failed to refresh platform_config/boosters.',
      });
      handleFirestoreError(err, OperationType.GET, 'platform_config/boosters');
    } finally {
      setRefreshing(false);
    }
  }, []);

  const hasUnsavedChanges = useMemo(() => {
    const currentSnapshot = JSON.stringify({
      boosterBrandName: boosterBrandName.trim(),
      enabled: draft.enabled,
      tagline: draft.tagline,
      turboBonusLabel: draft.turboBonusLabel,
      tiers: draft.tiers,
    });
    const persistedSnapshot = JSON.stringify({
      boosterBrandName: fetchedConfig.brandName.trim(),
      enabled: fetchedConfig.enabled,
      tagline: fetchedConfig.tagline,
      turboBonusLabel: fetchedConfig.turboBonusLabel,
      tiers: fetchedConfig.tiers,
    });
    return currentSnapshot !== persistedSnapshot;
  }, [boosterBrandName, draft, fetchedConfig]);

  const activeTiers = useMemo(
    () => draft.tiers.filter((t) => t.enabled !== false),
    [draft.tiers]
  );

  const yieldRangeLabel = useMemo(() => {
    if (activeTiers.length === 0) return '0.00%';
    const rates = activeTiers.map((t) => Number(t.dailyPercent) || 0);
    const min = Math.min(...rates);
    const max = Math.max(...rates);
    return min === max ? `${min.toFixed(2)}%/day` : `${min.toFixed(2)}% – ${max.toFixed(2)}%/day`;
  }, [activeTiers]);

  const totalBoosterTvl = useMemo(
    () => allBoosterNodes.reduce((sum, n) => sum + (Number(n.capital) || 0), 0),
    [allBoosterNodes]
  );

  const totalClaimedPayouts = useMemo(
    () => allBoosterNodes.reduce((sum, n) => sum + (Number(n.claimedProfit) || 0), 0),
    [allBoosterNodes]
  );

  const emitNotice = (type: 'ok' | 'err', msg: string) => {
    setLocalNotice({ type, msg });
    onNotify?.(type, msg);
  };

  const updateTier = (idx: number, patch: Partial<BoosterTierConfig>) => {
    setDraft((prev) => ({
      ...prev,
      tiers: prev.tiers.map((tier, i) => (i === idx ? { ...tier, ...patch } : tier)),
    }));
  };

  const stepDailyYield = (idx: number, delta: number) => {
    const target = draft.tiers[idx];
    if (!target) return;
    const nextRate = Math.max(
      0.1,
      Math.min(50, Number(((target.dailyPercent || 0) + delta).toFixed(2)))
    );
    updateTier(idx, { dailyPercent: nextRate });
  };

  const addCustomTier = () => {
    if (draft.tiers.length >= MAX_TIERS) {
      emitNotice('err', `Maximum of ${MAX_TIERS} booster tiers allowed.`);
      return;
    }
    const nextIndex = draft.tiers.length + 1;
    setDraft((prev) => ({
      ...prev,
      tiers: [
        ...prev.tiers,
        {
          id: `booster_tier_${Date.now()}`,
          name: `Quantum Core ${nextIndex}`,
          capital: 2500,
          dailyPercent: 1.65,
          boostPowerLabel: '36.0 TH/u',
          profitDays: 200,
          capitalLockDays: 70,
          thermalEfficiency: '99.4%',
          description: 'High-throughput compute node configured by Super Admin.',
          accent: 'amber',
          enabled: true,
        },
      ],
    }));
  };

  const duplicateTier = (idx: number) => {
    if (draft.tiers.length >= MAX_TIERS) {
      emitNotice('err', `Maximum of ${MAX_TIERS} booster tiers allowed.`);
      return;
    }
    const source = draft.tiers[idx];
    if (!source) return;
    setDraft((prev) => ({
      ...prev,
      tiers: [
        ...prev.tiers,
        {
          ...source,
          id: `${source.id}_copy_${Date.now().toString().slice(-5)}`,
          name: `${source.name} Plus`.slice(0, 80),
        },
      ],
    }));
  };

  const removeTier = (idx: number) => {
    if (draft.tiers.length <= 1) {
      emitNotice('err', 'At least one booster tier must remain active.');
      return;
    }
    setDraft((prev) => ({
      ...prev,
      tiers: prev.tiers.filter((_, i) => i !== idx),
    }));
  };

  const handleDiscard = () => {
    setBoosterBrandName(fetchedConfig.brandName);
    setDraft(fetchedConfig);
    setLocalNotice(null);
  };

  const handleResetDefaults = () => {
    setBoosterBrandName(DEFAULT_BOOSTER_CONFIG.brandName);
    setDraft(DEFAULT_BOOSTER_CONFIG);
    setLocalNotice({
      type: 'ok',
      msg: 'Restored Spark Core, Pulse Node, Vector Array, and Sovereign Cluster defaults in draft. Click "Save & Propagate Live" to publish to Firestore.',
    });
  };

  const handleSaveToFirestore = async () => {
    const cleanBrand = boosterBrandName.trim().slice(0, 60);
    if (!cleanBrand) {
      emitNotice('err', 'boosterBrandName cannot be empty.');
      return;
    }
    if (draft.tiers.length === 0) {
      emitNotice('err', 'Configure at least one Booster tier before saving.');
      return;
    }

    for (let i = 0; i < draft.tiers.length; i++) {
      const t = draft.tiers[i];
      if (!t.name.trim()) {
        emitNotice('err', `Tier #${i + 1} requires a valid Tier Name.`);
        return;
      }
      if (!Number.isFinite(t.dailyPercent) || t.dailyPercent < 0.1 || t.dailyPercent > 50) {
        emitNotice('err', `Tier "${t.name}" daily yield rate must be between 0.1% and 50%.`);
        return;
      }
      if (!Number.isFinite(t.capital) || t.capital < 10) {
        emitNotice('err', `Tier "${t.name}" capital allocation must be at least $10.`);
        return;
      }
    }

    setSaving(true);
    setLocalNotice(null);
    try {
      const nextBoosterConfig: BoosterConfig = {
        ...draft,
        brandName: cleanBrand,
        tagline: draft.tagline.trim().slice(0, 180),
        turboBonusLabel: draft.turboBonusLabel.trim().slice(0, 80),
        tiers: draft.tiers.slice(0, MAX_TIERS).map((t, idx) => ({
          ...t,
          id: (t.id || `booster_tier_${idx + 1}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64),
          name: t.name.trim().slice(0, 80),
          capital: Math.max(10, Math.min(10000000, Number(t.capital) || 100)),
          dailyPercent: Math.max(0.1, Math.min(50, Number(Number(t.dailyPercent).toFixed(2)))),
          boostPowerLabel: (t.boostPowerLabel || '1.25 TH/u').trim().slice(0, 40),
          profitDays: Math.max(1, Math.min(1000, Math.round(Number(t.profitDays) || 200))),
          capitalLockDays: Math.max(0, Math.min(1000, Math.round(Number(t.capitalLockDays) || 70))),
          thermalEfficiency: (t.thermalEfficiency || '97.5%').trim().slice(0, 20),
          description: (t.description || '').trim().slice(0, 260),
          enabled: t.enabled !== false,
        })),
      };

      await updatePlatformConfigSection('boosters', {
        boosterBrandName: cleanBrand,
        boosterConfig: nextBoosterConfig,
      });

      emitNotice(
        'ok',
        `Published to platform_config/boosters! boosterBrandName="${cleanBrand}" and all ${nextBoosterConfig.tiers.length} tiers are now propagating live to every user dashboard.`
      );
    } catch (err) {
      emitNotice(
        'err',
        err instanceof Error ? err.message : 'Failed to save boosterConfig to Firestore.'
      );
    } finally {
      setSaving(false);
    }
  };

  const displayBrand = boosterBrandName.trim() || DEFAULT_BOOSTER_CONFIG.brandName;

  return (
    <div className="space-y-6">
      {/* Header & Live Firestore Sync Controls */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-bold uppercase tracking-wider">
              <Cpu className="h-3.5 w-3.5" />
              BoosterManagement
            </span>
            {loadingFirestore ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-semibold">
                Fetching Firestore boosterConfig…
              </span>
            ) : hasUnsavedChanges ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-semibold">
                Unsaved Draft Changes
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold">
                <CheckCircle2 className="h-3 w-3" />
                Live Synced {lastSyncedAt ? `(${lastSyncedAt})` : ''}
              </span>
            )}
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            {displayBrand} Engine — Live Brand &amp; 4-Tier Yield Mapping
          </h2>
          <p className="text-xs text-slate-500">
            Reads and updates modular <code className="font-mono text-amber-700">platform_config/boosters</code> in Firestore. Changes propagate immediately to all connected User Dashboards.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRefreshFromFirestore}
            disabled={refreshing || saving}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-50"
            title="Fetch latest boosterConfig from Firestore"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
          <button
            type="button"
            onClick={handleResetDefaults}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Defaults</span>
          </button>
          {hasUnsavedChanges && (
            <button
              type="button"
              onClick={handleDiscard}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span>Discard</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleSaveToFirestore}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm transition-colors disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Publishing Live...' : 'Save & Propagate Live'}</span>
          </button>
        </div>
      </div>

      {localNotice && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs font-medium ${
            localNotice.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {localNotice.msg}
        </div>
      )}

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            boosterBrandName
          </p>
          <p className="mt-1 text-base font-bold text-slate-900 truncate">{displayBrand}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {draft.enabled ? 'Visible to Users' : 'Hidden / Paused'}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Daily Yield Band
          </p>
          <p className="mt-1 font-mono text-base font-bold text-amber-600 tabular-nums">
            {yieldRangeLabel}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {activeTiers.length} of {draft.tiers.length} tiers enabled
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Deployed User Nodes
          </p>
          <p className="mt-1 font-mono text-base font-bold text-slate-900 tabular-nums">
            {allBoosterNodes.length}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {allBoosterNodes.filter((n) => n.turboMode).length} in Turbo mode
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Total Booster TVL
          </p>
          <p className="mt-1 font-mono text-base font-bold text-emerald-700 tabular-nums">
            ${totalBoosterTvl.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400 font-mono">
            Claimed: ${totalClaimedPayouts.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Section 1: boosterBrandName & Global Brand Identity */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-600" />
              <span>Global Brand Identity (boosterBrandName)</span>
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Updating <code className="font-mono text-amber-800">boosterBrandName</code> propagates live to the Top Navbar, User Dashboard Sidebar, 360° Visualizer, 4-Language Walkthrough, and Roadmap Phase 2.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-amber-200 text-xs font-semibold text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => setDraft((prev) => ({ ...prev, enabled: e.target.checked }))}
              className="rounded border-slate-300 text-amber-600"
            />
            <span>Booster Engine Enabled</span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="booster-management-brand-name"
                className="text-xs font-semibold text-slate-700"
              >
                boosterBrandName *
              </label>
              <span className="text-[11px] font-mono text-slate-400">
                {boosterBrandName.length}/60
              </span>
            </div>
            <input
              id="booster-management-brand-name"
              type="text"
              value={boosterBrandName}
              maxLength={60}
              onChange={(e) => {
                const val = e.target.value;
                setBoosterBrandName(val);
                setDraft((prev) => ({ ...prev, brandName: val }));
              }}
              placeholder="e.g. ATXBooster"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-amber-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="booster-management-turbo-label"
                className="text-xs font-semibold text-slate-700"
              >
                Turbo Telemetry Label
              </label>
              <span className="text-[11px] font-mono text-slate-400">
                {draft.turboBonusLabel.length}/80
              </span>
            </div>
            <input
              id="booster-management-turbo-label"
              type="text"
              value={draft.turboBonusLabel}
              maxLength={80}
              onChange={(e) => setDraft((prev) => ({ ...prev, turboBonusLabel: e.target.value }))}
              placeholder="Harmonic Overclock Telemetry"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="booster-management-tagline"
                className="text-xs font-semibold text-slate-700"
              >
                Engine Subtitle / Tagline
              </label>
              <span className="text-[11px] font-mono text-slate-400">
                {draft.tagline.length}/180
              </span>
            </div>
            <input
              id="booster-management-tagline"
              type="text"
              value={draft.tagline}
              maxLength={180}
              onChange={(e) => setDraft((prev) => ({ ...prev, tagline: e.target.value }))}
              placeholder="Precision 360° Compute Matrix & Mon–Fri Yield Architecture"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
        </div>

        {/* Live Propagation Preview */}
        <div className="rounded-xl bg-white/90 border border-amber-200/80 px-3.5 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-slate-600">
          <span className="font-bold text-slate-800 uppercase tracking-wider">Live Propagation:</span>
          <span>
            Navbar &amp; Sidebar: <strong className="text-slate-900">{displayBrand}</strong>
          </span>
          <span>
            Walkthrough: <strong className="text-slate-900">How {displayBrand} Works</strong>
          </span>
          <span>
            Roadmap Phase 2: <strong className="text-slate-900">{displayBrand} Engine Launch</strong>
          </span>
        </div>
      </div>

      {/* Section 2: Quick 4-Tier Rename & Daily Yield Rate Mapping Matrix */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="h-4 w-4 text-slate-700" />
              <span>Core Tier Rename &amp; Daily Yield Mapping Matrix</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Map each canonical tier slot (Spark Core, Pulse Node, Vector Array, Sovereign Cluster) to a live display name and Mon–Fri daily yield rate (%).
            </p>
          </div>
          <button
            type="button"
            onClick={addCustomTier}
            disabled={draft.tiers.length >= MAX_TIERS}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Extra Tier ({draft.tiers.length}/{MAX_TIERS})</span>
          </button>
        </div>

        {/* Compact Mapping Overview Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Canonical Tier Slot</th>
                <th className="py-2.5 px-3 font-semibold">Live Tier Display Name</th>
                <th className="py-2.5 px-3 font-semibold">Daily Yield Rate (%)</th>
                <th className="py-2.5 px-3 font-semibold">Capital (USDT)</th>
                <th className="py-2.5 px-3 font-semibold">Projected Daily / Cycle</th>
                <th className="py-2.5 px-3 text-right font-semibold">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {draft.tiers.map((tier, idx) => {
                const canonical = CANONICAL_CORE_TIERS.find((c) => c.id === tier.id);
                const dailyUsd = Number(((tier.capital * tier.dailyPercent) / 100).toFixed(2));
                const totalCycleUsd = Number((dailyUsd * (tier.profitDays || 200)).toFixed(2));
                return (
                  <tr key={`map-${tier.id}`} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-700">
                          {canonical ? canonical.defaultName : `Custom Tier #${idx + 1}`}
                        </span>
                        <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                      </div>
                      <span className="font-mono text-[10px] text-slate-400">
                        {canonical ? canonical.slotLabel : tier.id}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 min-w-[180px]">
                      <input
                        type="text"
                        value={tier.name}
                        maxLength={80}
                        aria-label={`Display name for ${canonical?.defaultName || tier.id}`}
                        onChange={(e) => updateTier(idx, { name: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </td>
                    <td className="py-2.5 px-3 min-w-[165px]">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => stepDailyYield(idx, -0.1)}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700"
                          title="Decrease daily yield by 0.1%"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <div className="relative flex-1">
                          <input
                            type="number"
                            min="0.1"
                            max="50"
                            step="0.05"
                            aria-label={`Daily yield percent for ${tier.name}`}
                            value={tier.dailyPercent}
                            onChange={(e) =>
                              updateTier(idx, { dailyPercent: Number(e.target.value) || 0 })
                            }
                            className="w-full pl-2.5 pr-6 py-1.5 rounded-lg bg-white border border-amber-300 text-xs font-mono font-bold text-amber-700 tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-400"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-amber-600">
                            %
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => stepDailyYield(idx, 0.1)}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700"
                          title="Increase daily yield by 0.1%"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 min-w-[115px]">
                      <input
                        type="number"
                        min="10"
                        step="10"
                        value={tier.capital}
                        onChange={(e) => updateTier(idx, { capital: Number(e.target.value) || 0 })}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono font-semibold text-slate-900 tabular-nums"
                      />
                    </td>
                    <td className="py-2.5 px-3 font-mono tabular-nums whitespace-nowrap">
                      <span className="text-emerald-700 font-bold">+${dailyUsd.toFixed(2)}/d</span>
                      <span className="text-slate-400 mx-1">·</span>
                      <span className="text-slate-700">${totalCycleUsd.toLocaleString()}/{tier.profitDays}d</span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <input
                        type="checkbox"
                        checked={tier.enabled !== false}
                        onChange={(e) => updateTier(idx, { enabled: e.target.checked })}
                        className="rounded border-slate-300 text-emerald-600"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Detailed Tier Specifications Editor */}
        <div className="space-y-3 pt-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Advanced Tier Parameters (Power, Cycle Days, Lock Period &amp; Copy)
          </p>
          {draft.tiers.map((tier, idx) => {
            const canonical = CANONICAL_CORE_TIERS.find((c) => c.id === tier.id);
            const dailyUsd = Number(((tier.capital * tier.dailyPercent) / 100).toFixed(2));
            const monthlyUsd = Number((dailyUsd * 22).toFixed(2));
            const totalCycleUsd = Number((dailyUsd * (tier.profitDays || 200)).toFixed(2));
            const totalRoiPct = Number(
              ((tier.dailyPercent || 0) * (tier.profitDays || 200)).toFixed(1)
            );

            return (
              <div
                key={tier.id}
                className={`rounded-xl border p-4 space-y-3 transition-colors ${
                  tier.enabled !== false
                    ? 'border-slate-200 bg-slate-50/70'
                    : 'border-slate-200/70 bg-slate-100/60 opacity-75'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-slate-900 text-white font-mono text-[11px] font-bold">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      {tier.name || 'Untitled Tier'}
                    </span>
                    {canonical && canonical.defaultName !== tier.name && (
                      <span className="text-[11px] text-slate-500">
                        (mapped from {canonical.defaultName})
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase ${
                        ACCENT_BADGE[tier.accent] || ACCENT_BADGE.amber
                      }`}
                    >
                      {tier.accent}
                    </span>
                    <span className="font-mono text-[11px] text-amber-700 font-bold">
                      {Number(tier.dailyPercent || 0).toFixed(2)}%/day
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => duplicateTier(idx)}
                      disabled={draft.tiers.length >= MAX_TIERS}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      title="Duplicate tier"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    {!canonical && (
                      <button
                        type="button"
                        onClick={() => removeTier(idx)}
                        disabled={draft.tiers.length <= 1}
                        className="p-1.5 rounded-lg border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                        title="Delete custom tier"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-12 gap-3">
                  <div className="lg:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Boost Power
                    </label>
                    <input
                      type="text"
                      maxLength={40}
                      value={tier.boostPowerLabel}
                      onChange={(e) => updateTier(idx, { boostPowerLabel: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-900"
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Thermal Eff.
                    </label>
                    <input
                      type="text"
                      maxLength={20}
                      value={tier.thermalEfficiency}
                      onChange={(e) => updateTier(idx, { thermalEfficiency: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-900"
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Profit Days
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={tier.profitDays}
                      onChange={(e) =>
                        updateTier(idx, { profitDays: Math.max(1, Number(e.target.value) || 200) })
                      }
                      className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-900 tabular-nums"
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Lock Days
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="1000"
                      value={tier.capitalLockDays}
                      onChange={(e) =>
                        updateTier(idx, {
                          capitalLockDays: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-900 tabular-nums"
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Ring Accent
                    </label>
                    <select
                      value={tier.accent}
                      onChange={(e) =>
                        updateTier(idx, { accent: e.target.value as BoosterTierConfig['accent'] })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-800"
                    >
                      <option value="sky">Sky</option>
                      <option value="teal">Teal</option>
                      <option value="amber">Amber</option>
                      <option value="violet">Violet</option>
                    </select>
                  </div>
                  <div className="col-span-2 sm:col-span-3 lg:col-span-12">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Tier Description
                    </label>
                    <input
                      type="text"
                      maxLength={260}
                      value={tier.description}
                      onChange={(e) => updateTier(idx, { description: e.target.value })}
                      placeholder="Short operational summary shown to investors..."
                      className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700"
                    />
                  </div>
                </div>

                <div className="rounded-lg bg-white border border-slate-200/90 px-3.5 py-2 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono tabular-nums">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="text-slate-500 font-sans">
                      Daily Reward:{' '}
                      <strong className="font-mono text-emerald-700">
                        +${dailyUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </strong>
                    </span>
                    <span className="text-slate-500 font-sans">
                      Est. Monthly (22d):{' '}
                      <strong className="font-mono text-slate-900">
                        +${monthlyUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </strong>
                    </span>
                    <span className="text-slate-500 font-sans">
                      {tier.profitDays}-Day Gross Yield:{' '}
                      <strong className="font-mono text-amber-700">
                        ${totalCycleUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({totalRoiPct}%)
                      </strong>
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-slate-500 font-sans">
                    <Zap className="h-3 w-3 text-amber-500" />
                    <span>Mon–Fri Settlement</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 3: Active Deployed User Booster Nodes */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 shadow-sm">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-600" />
            <span>Live Deployed {displayBrand} Nodes ({allBoosterNodes.length})</span>
          </h3>
          <p className="text-xs text-slate-500">
            Updated tier names and daily yield rates propagate immediately to all User Dashboards for live previews and new activations.
          </p>
        </div>

        {allBoosterNodes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-500">
            No users have activated a {displayBrand} node yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3">Tier</th>
                  <th className="py-2 pr-3">User UID</th>
                  <th className="py-2 pr-3">Capital</th>
                  <th className="py-2 pr-3">Daily Yield</th>
                  <th className="py-2 pr-3">Claimed</th>
                  <th className="py-2 pr-3">Mode</th>
                  <th className="py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {allBoosterNodes.slice(0, 25).map((node) => (
                  <tr key={node.id}>
                    <td className="py-2.5 pr-3 font-sans font-semibold text-slate-900">
                      {node.tierName}
                      <span className="ml-1.5 font-mono text-[10px] text-slate-400">
                        {node.boostPowerLabel}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-slate-500 text-[11px]">
                      {node.uid.slice(0, 10)}…
                    </td>
                    <td className="py-2.5 pr-3 font-semibold text-slate-900">
                      ${Number(node.capital || 0).toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-3 text-amber-700 font-semibold">
                      {Number(node.dailyPercent || 0).toFixed(2)}%
                    </td>
                    <td className="py-2.5 pr-3 text-emerald-700 font-semibold">
                      ${Number(node.claimedProfit || 0).toFixed(2)}
                    </td>
                    <td className="py-2.5 pr-3 font-sans">
                      {node.turboMode ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200 text-[10px] font-bold">
                          <Flame className="h-3 w-3" />
                          Turbo
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold">
                          Standard
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-right font-sans">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                          node.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {node.status}
                      </span>
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
