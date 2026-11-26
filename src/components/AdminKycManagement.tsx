import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck,
  Globe,
  Loader2,
  RefreshCw,
  Save,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  X,
  XCircle,
  ZoomIn,
} from 'lucide-react';
import { DEFAULT_GLOBAL_KYC_SETTINGS } from '../constants/defaults';
import {
  GLOBAL_KYC_COUNTRIES,
  isoToFlagEmoji,
} from '../constants/globalKycCountries';
import {
  fetchKycProviderStatus,
  KycProviderStatusResponse,
} from '../lib/kycApi';
import {
  AdminActionLog,
  GlobalKycSettings,
  KycProviderId,
  PlatformConfig,
  UserProfile,
} from '../types/platform';
import { formatTimestamp } from '../utils/investmentMath';

interface AdminKycManagementProps {
  allUsers: UserProfile[];
  allAdminLogs: AdminActionLog[];
  draftConfig: PlatformConfig;
  setDraftConfig: React.Dispatch<React.SetStateAction<PlatformConfig>>;
  onSaveConfig: () => Promise<void>;
  onApproveKyc: (uid: string, note?: string) => Promise<void>;
  onRejectKyc: (uid: string, reason: string) => Promise<void>;
  onRequestResubmission: (uid: string, reason: string) => Promise<void>;
  onBulkApproveKyc: (uids: string[]) => Promise<number>;
  busy: boolean;
}

const REJECTION_PRESETS = [
  'Front ID image is blurry or cropped — please upload a clear, well-lit photo.',
  'Back side of the document is missing or unreadable.',
  'Live selfie does not clearly match the face on the government ID.',
  'Submitted ID number does not match the printed document number.',
  'Document appears expired — please submit a currently valid ID or Passport.',
];

const REGIONS = [
  'All',
  'Asia',
  'Europe',
  'North America',
  'South America',
  'Middle East',
  'Africa',
  'Oceania',
] as const;

export const AdminKycManagement: React.FC<AdminKycManagementProps> = ({
  allUsers,
  allAdminLogs,
  draftConfig,
  setDraftConfig,
  onSaveConfig,
  onApproveKyc,
  onRejectKyc,
  onRequestResubmission,
  onBulkApproveKyc,
  busy,
}) => {
  const [subTab, setSubTab] = useState<'queue' | 'settings'>('queue');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'pending' | 'approved' | 'rejected' | 'unsubmitted'
  >('pending');
  const [countryFilter, setCountryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUid, setSelectedUid] = useState<string>('');
  const [feedbackNote, setFeedbackNote] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<{ src: string; title: string } | null>(null);
  const [localMsg, setLocalMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Settings tab state
  const [providerStatus, setProviderStatus] = useState<KycProviderStatusResponse | null>(null);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [countryPolicySearch, setCountryPolicySearch] = useState('');
  const [countryRegionFilter, setCountryRegionFilter] = useState<(typeof REGIONS)[number]>('All');

  const kycSettings: GlobalKycSettings =
    draftConfig.kycSettings || DEFAULT_GLOBAL_KYC_SETTINGS;

  const updateKycSettings = (patch: Partial<GlobalKycSettings>) => {
    setDraftConfig((prev) => ({
      ...prev,
      kycSettings: {
        ...(prev.kycSettings || DEFAULT_GLOBAL_KYC_SETTINGS),
        ...patch,
      },
    }));
  };

  const loadProviderStatus = async () => {
    setLoadingProviders(true);
    try {
      const res = await fetchKycProviderStatus();
      setProviderStatus(res);
    } catch {
      // ignore non-fatal
    } finally {
      setLoadingProviders(false);
    }
  };

  useEffect(() => {
    void loadProviderStatus();
  }, []);

  // Counts
  const counts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let unsubmitted = 0;
    for (const u of allUsers) {
      if (u.kycStatus === 'pending') pending++;
      else if (u.kycStatus === 'approved') approved++;
      else if (u.kycStatus === 'rejected') rejected++;
      else unsubmitted++;
    }
    return { pending, approved, rejected, unsubmitted, total: allUsers.length };
  }, [allUsers]);

  // Countries present among users for queue filter dropdown
  const submittedCountries = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of allUsers) {
      const cc = (u.kycCountryCode || u.countryCode || '').toUpperCase();
      const name = u.kycCountryName || u.countryName || cc;
      if (cc) map.set(cc, name);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [allUsers]);

  // Filtered queue users
  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allUsers
      .filter((u) => {
        if (statusFilter !== 'all' && u.kycStatus !== statusFilter) return false;
        const userCc = (u.kycCountryCode || u.countryCode || '').toUpperCase();
        if (countryFilter !== 'ALL' && userCc !== countryFilter) return false;
        if (!q) return true;
        return (
          u.fullName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.handle.toLowerCase().includes(q) ||
          (u.idNumber || '').toLowerCase().includes(q) ||
          (u.kycCountryName || u.countryName || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const order = { pending: 0, rejected: 1, unsubmitted: 2, approved: 3 };
        const diff = (order[a.kycStatus] ?? 4) - (order[b.kycStatus] ?? 4);
        if (diff !== 0) return diff;
        return (b.kycSubmittedAtMs || 0) - (a.kycSubmittedAtMs || 0);
      });
  }, [allUsers, statusFilter, countryFilter, searchQuery]);

  const inspectedUser = useMemo(() => {
    if (selectedUid) {
      const found = allUsers.find((u) => u.uid === selectedUid);
      if (found) return found;
    }
    return filteredUsers[0] || null;
  }, [allUsers, filteredUsers, selectedUid]);

  useEffect(() => {
    if (inspectedUser) {
      setFeedbackNote(inspectedUser.kycRejectionReason || '');
    }
  }, [inspectedUser?.uid]);

  const kycAuditLogs = useMemo(
    () =>
      allAdminLogs
        .filter((log) => log.action.toUpperCase().includes('KYC'))
        .slice(0, 25),
    [allAdminLogs]
  );

  const disabledSet = useMemo(
    () => new Set((kycSettings.disabledCountryCodes || []).map((c) => c.toUpperCase())),
    [kycSettings.disabledCountryCodes]
  );

  const filteredPolicyCountries = useMemo(() => {
    const q = countryPolicySearch.trim().toLowerCase();
    return GLOBAL_KYC_COUNTRIES.filter((c) => {
      if (countryRegionFilter !== 'All' && c.region !== countryRegionFilter) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q);
    });
  }, [countryPolicySearch, countryRegionFilter]);

  const toggleCountryDisabled = (code: string) => {
    const next = new Set(disabledSet);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    updateKycSettings({ disabledCountryCodes: Array.from(next).sort() });
  };

  const runKycDecision = async (mode: 'approve' | 'reject' | 'resubmit') => {
    if (!inspectedUser) return;
    setActionBusy(true);
    setLocalMsg(null);
    try {
      if (mode === 'approve') {
        await onApproveKyc(inspectedUser.uid, feedbackNote.trim());
        setLocalMsg({
          type: 'ok',
          text: `Approved KYC for ${inspectedUser.fullName} (@${inspectedUser.handle}). Recorded in immutable Audit Log.`,
        });
      } else if (mode === 'reject') {
        const reason =
          feedbackNote.trim() || 'Document verification failed — details unclear or mismatched.';
        await onRejectKyc(inspectedUser.uid, reason);
        setLocalMsg({
          type: 'ok',
          text: `Rejected KYC for ${inspectedUser.fullName} with feedback note. Recorded in Audit Log.`,
        });
      } else {
        const reason =
          feedbackNote.trim() ||
          'Please re-submit clearer Front/Back ID photos and a live selfie.';
        await onRequestResubmission(inspectedUser.uid, reason);
        setLocalMsg({
          type: 'ok',
          text: `Requested KYC re-submission from ${inspectedUser.fullName}. Recorded in Audit Log.`,
        });
      }
    } catch (err) {
      setLocalMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'KYC decision failed.',
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleBulkApprovePending = async () => {
    const pendingUids = filteredUsers
      .filter((u) => u.kycStatus === 'pending')
      .map((u) => u.uid);
    if (pendingUids.length === 0) return;
    setActionBusy(true);
    setLocalMsg(null);
    try {
      const n = await onBulkApproveKyc(pendingUids);
      setLocalMsg({
        type: 'ok',
        text: `Bulk approved ${n} pending KYC submissions and logged action in Audit Log.`,
      });
    } catch (err) {
      setLocalMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Bulk KYC approval failed.',
      });
    } finally {
      setActionBusy(false);
    }
  };

  const renderStatusBadge = (u: UserProfile) => {
    if (u.kycStatus === 'approved') {
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
          <CheckCircle2 className="h-3 w-3" />
          Verified
        </span>
      );
    }
    if (u.kycStatus === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
          <Clock className="h-3 w-3" />
          Pending Review
        </span>
      );
    }
    if (u.kycStatus === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
          <XCircle className="h-3 w-3" />
          {u.kycResubmissionRequested ? 'Resubmit Req' : 'Rejected'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
        Unverified
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <p className="text-xs font-medium text-amber-700">Pending Review</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{counts.pending}</p>
          <p className="mt-0.5 text-[11px] text-amber-700/80">Awaiting compliance check</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
          <p className="text-xs font-medium text-emerald-700">Verified Clients</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{counts.approved}</p>
          <p className="mt-0.5 text-[11px] text-emerald-700/80">Full vault privileges</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4">
          <p className="text-xs font-medium text-rose-700">Rejected / Resubmit</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{counts.rejected}</p>
          <p className="mt-0.5 text-[11px] text-rose-700/80">Requires client correction</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Unverified</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
            {counts.unsubmitted}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">Not submitted yet</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 col-span-2 lg:col-span-1">
          <p className="text-xs font-medium text-slate-500">KYC Scanner Mode</p>
          <p className="mt-1 text-sm font-bold text-emerald-700 truncate">
            {kycSettings.activeProvider === 'free_ai_ocr'
              ? 'Built-in AI Vision OCR'
              : 'Built-in QR & Local OCR'}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 tabular-nums">
            {GLOBAL_KYC_COUNTRIES.length - disabledSet.size}/{GLOBAL_KYC_COUNTRIES.length} countries
            active
          </p>
        </div>
      </div>

      {/* Sub-tab Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab('queue')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              subTab === 'queue'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <FileCheck className="h-4 w-4" />
            Verification Queue & Inspector ({counts.pending})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('settings')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              subTab === 'settings'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Settings className="h-4 w-4" />
            KYC Rules &amp; Countries
          </button>
        </div>

        {subTab === 'queue' && counts.pending > 0 && (
          <button
            type="button"
            disabled={actionBusy || busy}
            onClick={() => void handleBulkApprovePending()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 transition-colors"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Bulk Approve Filtered Pending (
            {filteredUsers.filter((u) => u.kycStatus === 'pending').length})
          </button>
        )}
      </div>

      {localMsg && (
        <div
          className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-medium ${
            localMsg.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          <span>{localMsg.text}</span>
          <button type="button" onClick={() => setLocalMsg(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* TAB 1: VERIFICATION QUEUE & SIDE-BY-SIDE INSPECTOR */}
      {subTab === 'queue' ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left Column: Filterable Queue */}
          <div className="xl:col-span-5 rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="p-4 border-b border-slate-200 space-y-3">
              <div className="relative">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, email, handle, ID number..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {(['pending', 'approved', 'rejected', 'unsubmitted', 'all'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors ${
                      statusFilter === st
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st === 'approved' ? 'Verified' : st}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Globe className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <select
                  value={countryFilter}
                  onChange={(e) => setCountryFilter(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-slate-900"
                >
                  <option value="ALL">All Countries ({allUsers.length} clients)</option>
                  {submittedCountries.map(([code, name]) => (
                    <option key={code} value={code}>
                      {isoToFlagEmoji(code)} {name} ({code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="max-h-[680px] overflow-y-auto divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No KYC records match your selected status and country filters.
                </div>
              ) : (
                filteredUsers.map((u) => {
                  const isActive = inspectedUser?.uid === u.uid;
                  const cc = (u.kycCountryCode || u.countryCode || '').toUpperCase();
                  return (
                    <button
                      key={u.uid}
                      type="button"
                      onClick={() => setSelectedUid(u.uid)}
                      className={`w-full text-left p-4 transition-colors ${
                        isActive ? 'bg-slate-900/[0.04] border-l-4 border-l-slate-900' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {cc ? (
                              <span className="text-base leading-none">{isoToFlagEmoji(cc)}</span>
                            ) : (
                              <Globe className="h-3.5 w-3.5 text-slate-400" />
                            )}
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {u.fullName}
                            </p>
                          </div>
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            @{u.handle} · {u.email}
                          </p>
                        </div>
                        {renderStatusBadge(u)}
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 tabular-nums">
                        <span>
                          Doc: <strong>{u.idType || '—'}</strong>
                        </span>
                        <span className="font-mono">
                          #{u.idNumber || 'Not provided'}
                        </span>
                        {typeof u.kycOcrConfidence === 'number' && u.kycOcrConfidence > 0 && (
                          <span className="text-sky-700 font-medium">
                            OCR {u.kycOcrConfidence}%
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Side-by-Side Document & Data Inspector */}
          <div className="xl:col-span-7 rounded-xl border border-slate-200 bg-white overflow-hidden">
            {!inspectedUser ? (
              <div className="p-12 text-center text-sm text-slate-500">
                Select a client from the KYC queue to inspect their documents and auto-extracted
                details.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {/* Inspector Header */}
                <div className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/70">
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-base font-bold text-slate-900">
                        {inspectedUser.fullName}
                      </h3>
                      {renderStatusBadge(inspectedUser)}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      @{inspectedUser.handle} · {inspectedUser.email} · UID:{' '}
                      <span className="font-mono">{inspectedUser.uid.slice(0, 12)}</span>
                    </p>
                  </div>
                  <div className="text-xs text-slate-600 sm:text-right tabular-nums">
                    <p className="font-semibold text-slate-900">
                      {inspectedUser.kycCountryCode
                        ? `${isoToFlagEmoji(inspectedUser.kycCountryCode)} `
                        : ''}
                      {inspectedUser.kycCountryName || inspectedUser.countryName || 'Unspecified Country'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {inspectedUser.kycSubmittedAtMs
                        ? `Submitted ${formatTimestamp(null, inspectedUser.kycSubmittedAtMs)}`
                        : 'Legacy KYC record'}
                    </p>
                  </div>
                </div>

                {/* Side-by-Side Front ID, Back ID & Live Selfie */}
                <div className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Side-by-Side Document & Biometric Selfie Inspection
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      Click any image to zoom full-size
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { label: 'Front ID Document', src: inspectedUser.idPhotoData },
                      { label: 'Back ID Document', src: inspectedUser.idBackPhotoData || '' },
                      { label: 'Live Selfie / Portrait', src: inspectedUser.portraitPhotoData },
                    ].map((img) => (
                      <div
                        key={img.label}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-2.5"
                      >
                        <p className="text-[11px] font-semibold text-slate-700 mb-2">{img.label}</p>
                        {img.src ? (
                          <button
                            type="button"
                            onClick={() => setLightboxImg({ src: img.src, title: `${inspectedUser.fullName} — ${img.label}` })}
                            className="group relative block w-full aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-slate-900"
                          >
                            <img
                              src={img.src}
                              alt={img.label}
                              className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform"
                            />
                            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-slate-900/80 px-2 py-1 text-[10px] font-semibold text-white">
                              <ZoomIn className="h-3 w-3" />
                              Inspect
                            </span>
                          </button>
                        ) : (
                          <div className="w-full aspect-[4/3] rounded-lg border border-dashed border-slate-300 bg-white flex flex-col items-center justify-center text-slate-400 text-xs">
                            <Eye className="h-4 w-4 mb-1 opacity-60" />
                            <span>Not Uploaded</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Structured Auto-Extracted KYC Details */}
                <div className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Submitted & Auto-Extracted Identity Details
                    </h4>
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 font-semibold text-sky-700">
                        <Sparkles className="h-3 w-3" />
                        {inspectedUser.kycVerificationMethod || 'Standard Submission'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                    {[
                      { label: 'Full Legal Name', val: inspectedUser.fullName },
                      { label: 'Document Type', val: inspectedUser.idType || '—' },
                      { label: 'Document Number', val: inspectedUser.idNumber || '—', mono: true },
                      { label: 'Date of Birth', val: inspectedUser.kycDateOfBirth || '—', mono: true },
                      {
                        label: 'Nationality',
                        val: inspectedUser.kycNationality || inspectedUser.kycCountryName || '—',
                      },
                      {
                        label: 'OCR Confidence / Liveness',
                        val: `${inspectedUser.kycOcrConfidence ?? 0}% · ${
                          inspectedUser.kycLivenessPassed ? 'Face Verified' : 'Manual Check'
                        }`,
                      },
                      { label: 'Issue Date', val: inspectedUser.kycIssueDate || '—', mono: true },
                      { label: 'Expiry Date', val: inspectedUser.kycExpiryDate || '—', mono: true },
                      {
                        label: 'Phone Verified',
                        val: inspectedUser.phoneNumber
                          ? `${inspectedUser.phoneNumber} (${inspectedUser.phoneVerified ? 'Yes' : 'Pending'})`
                          : 'No phone',
                      },
                    ].map((field) => (
                      <div
                        key={field.label}
                        className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          {field.label}
                        </p>
                        <p
                          className={`mt-0.5 font-semibold text-slate-900 break-words ${
                            field.mono ? 'font-mono' : ''
                          }`}
                        >
                          {field.val}
                        </p>
                      </div>
                    ))}
                    <div className="sm:col-span-2 lg:col-span-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Residential Address
                      </p>
                      <p className="mt-0.5 font-medium text-slate-900">
                        {inspectedUser.kycAddress || 'Not provided'}
                      </p>
                    </div>
                  </div>

                  {inspectedUser.kycReviewedBy && (
                    <p className="mt-3 text-[11px] text-slate-500 tabular-nums">
                      Last reviewed by <strong>{inspectedUser.kycReviewedBy}</strong>
                      {inspectedUser.kycReviewedAtMs
                        ? ` on ${formatTimestamp(null, inspectedUser.kycReviewedAtMs)}`
                        : ''}
                    </p>
                  )}
                </div>

                {/* One-Click Compliance Decision Controls */}
                <div className="p-5 bg-slate-50/60 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Compliance Feedback Note / Rejection Reason (visible to client on Reject or
                      Re-submission)
                    </label>
                    <textarea
                      rows={2}
                      value={feedbackNote}
                      onChange={(e) => setFeedbackNote(e.target.value)}
                      maxLength={400}
                      placeholder="Enter clear reason if rejecting or requesting document re-submission..."
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                    />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {REJECTION_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setFeedbackNote(preset)}
                          className="rounded-md border border-slate-200 bg-white hover:bg-slate-100 px-2 py-1 text-[11px] text-slate-600 transition-colors"
                        >
                          {preset.slice(0, 40)}...
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={actionBusy || busy}
                      onClick={() => void runKycDecision('approve')}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-4 py-2.5 text-xs font-semibold text-white transition-colors"
                    >
                      {actionBusy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      Approve KYC
                    </button>

                    <button
                      type="button"
                      disabled={actionBusy || busy}
                      onClick={() => void runKycDecision('resubmit')}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 px-4 py-2.5 text-xs font-semibold text-white transition-colors"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Request Re-submission
                    </button>

                    <button
                      type="button"
                      disabled={actionBusy || busy}
                      onClick={() => void runKycDecision('reject')}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 px-4 py-2.5 text-xs font-semibold text-white transition-colors"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject KYC
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* TAB 2: GLOBAL KYC SETTINGS, COUNTRIES & API PROVIDERS */
        <div className="space-y-6">
          {/* Mandatory KYC Enforcement Toggles */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Global KYC Enforcement & Verification Rules
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Control when clients must hold Verified KYC status and configure document capture
                  requirements.
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onSaveConfig()}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 px-4 py-2.5 text-xs font-semibold text-white transition-colors shrink-0"
              >
                <Save className="h-3.5 w-3.5" />
                Save Global KYC Settings
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  key: 'requireKycForWithdrawals' as const,
                  title: 'Require KYC for Withdrawals',
                  desc: 'Block instant profit withdrawals & manual capital unlock requests until KYC is Approved.',
                },
                {
                  key: 'requireKycForDeposits' as const,
                  title: 'Require KYC for Deposits',
                  desc: 'Require Verified KYC status before submitting crypto or local payment deposits.',
                },
                {
                  key: 'requireKycForPackages' as const,
                  title: 'Require KYC for Package Activation',
                  desc: 'Require Verified KYC before activating AI trading investment packages.',
                },
                {
                  key: 'requireKycForClaims' as const,
                  title: 'Require KYC for Claiming Rewards',
                  desc: 'Require Verified KYC before claiming accrued weekday profit rewards.',
                },
                {
                  key: 'allowFreeAiOcr' as const,
                  title: 'Enable Built-in Free AI Vision OCR Auto-Fill',
                  desc: 'Automatically extract Name, DOB, Document Number, Nationality, Dates & Address from uploaded IDs.',
                },
                {
                  key: 'requireBackSideForCards' as const,
                  title: 'Require Back Side for NID & Driving License',
                  desc: 'Enforce both Front and Back scans for National ID cards and Driving Licenses.',
                },
                {
                  key: 'requireLiveSelfie' as const,
                  title: 'Require Live Selfie / Liveness Check',
                  desc: 'Require a live camera snapshot or clear portrait selfie for side-by-side comparison.',
                },
              ].map((toggle) => {
                const checked = Boolean(kycSettings[toggle.key]);
                return (
                  <label
                    key={toggle.key}
                    className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 cursor-pointer hover:border-slate-300 transition-colors"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-900">{toggle.title}</p>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                        {toggle.desc}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => updateKycSettings({ [toggle.key]: e.target.checked })}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 shrink-0"
                    />
                  </label>
                );
              })}
            </div>
          </div>

          {/* Built-in KYC Document Scanner Mode */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Built-in Document Scanner (No External API Needed)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Uses only the platform&apos;s built-in QR/Barcode scanner and AI Vision OCR — ready
                  out of the box with zero extra setup.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadProviderStatus()}
                disabled={loadingProviders}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingProviders ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {(providerStatus?.providers || []).map((prov) => {
                const isSelected =
                  kycSettings.activeProvider === prov.id ||
                  (prov.id === 'free_qr_mrz_ocr' &&
                    kycSettings.activeProvider !== 'free_ai_ocr');
                return (
                  <div
                    key={prov.id}
                    className={`rounded-xl border p-4 flex flex-col justify-between transition-all ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/40 ring-1 ring-emerald-600/20'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-emerald-600 text-white">
                            {prov.id === 'free_qr_mrz_ocr' ? 'BUILT-IN · DEFAULT' : 'BUILT-IN AI'}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900 mt-1.5">{prov.name}</h4>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {prov.configured ? 'Ready' : 'Standby'}
                        </span>
                      </div>

                      <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                        {prov.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => updateKycSettings({ activeProvider: prov.id as KycProviderId })}
                      className={`mt-4 w-full rounded-lg py-2 text-xs font-semibold transition-colors ${
                        isSelected
                          ? 'bg-emerald-600 text-white'
                          : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {isSelected ? 'Active Scanner' : 'Use This Scanner'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Worldwide Country Access Matrix */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Worldwide Country KYC Availability ({GLOBAL_KYC_COUNTRIES.length - disabledSet.size}{' '}
                  Enabled / {disabledSet.size} Restricted)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Toggle individual countries on or off. Restricted countries are blocked from new
                  KYC submissions.
                </p>
              </div>
              {disabledSet.size > 0 && (
                <button
                  type="button"
                  onClick={() => updateKycSettings({ disabledCountryCodes: [] })}
                  className="rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  Re-enable All Countries
                </button>
              )}
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={countryPolicySearch}
                  onChange={(e) => setCountryPolicySearch(e.target.value)}
                  placeholder="Search country name or ISO code..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {REGIONS.map((reg) => (
                  <button
                    key={reg}
                    type="button"
                    onClick={() => setCountryRegionFilter(reg)}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                      countryRegionFilter === reg
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {reg}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 max-h-72 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 pr-1">
              {filteredPolicyCountries.map((c) => {
                const blocked = disabledSet.has(c.code);
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => toggleCountryDisabled(c.code)}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                      blocked
                        ? 'border-rose-200 bg-rose-50 text-rose-800'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="text-base leading-none">{isoToFlagEmoji(c.code)}</span>
                      <span className="truncate font-medium">{c.name}</span>
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase shrink-0 ${
                        blocked ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    >
                      {blocked ? 'Off' : 'On'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Immutable KYC Audit Trail */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Recent Immutable KYC Compliance Audit Log
                </h3>
                <p className="text-xs text-slate-500">
                  All KYC approvals, rejections, re-submission requests, and overrides are recorded
                  permanently.
                </p>
              </div>
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Timestamp</th>
                    <th className="px-4 py-2.5 font-semibold">Action</th>
                    <th className="px-4 py-2.5 font-semibold">Client</th>
                    <th className="px-4 py-2.5 font-semibold">Admin</th>
                    <th className="px-4 py-2.5 font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {kycAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                        No KYC compliance actions logged yet.
                      </td>
                    </tr>
                  ) : (
                    kycAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-mono text-slate-500 whitespace-nowrap">
                          {formatTimestamp(log.createdAt)}
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-slate-900 whitespace-nowrap">
                          {log.action}
                        </td>
                        <td className="px-4 py-2.5 text-slate-700">{log.targetLabel}</td>
                        <td className="px-4 py-2.5 text-slate-500">{log.adminEmail}</td>
                        <td className="px-4 py-2.5 text-slate-600 max-w-md truncate">
                          {log.details}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Full-size Document Image Lightbox */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxImg(null)}
        >
          <div
            className="max-w-3xl w-full rounded-2xl bg-white overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
              <p className="text-sm font-bold text-slate-900">{lightboxImg.title}</p>
              <button
                type="button"
                onClick={() => setLightboxImg(null)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="bg-slate-900 p-4 flex items-center justify-center max-h-[80vh]">
              <img
                src={lightboxImg.src}
                alt={lightboxImg.title}
                className="max-h-[72vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
