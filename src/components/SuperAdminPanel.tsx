import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bell,
  CheckCircle2,
  Coins,
  CreditCard,
  Download,
  Gift,
  LogOut,
  Megaphone,
  Menu,
  PauseCircle,
  PlayCircle,
  Plus,
  Save,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { usePlatform } from '../context/PlatformContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  AnnouncementTone,
  CryptoDeposit,
  Investment,
  MemeCoinInvestment,
  MlmCommission,
  P2PTransfer,
  PaymentMethodCategory,
  PaymentMethodConfig,
  PlatformConfig,
  UserProfile,
  Withdrawal,
} from '../types/platform';
import { CapitalRequestModal } from './CapitalRequestModal';

type AdminTab =
  | 'approvals'
  | 'clients'
  | 'mentors'
  | 'packages'
  | 'announcements'
  | 'company'
  | 'wallets-meme'
  | 'audit';

export const SuperAdminPanel: React.FC<{ onExitAdmin: () => void }> = ({ onExitAdmin }) => {
  const {
    authUser,
    platformConfig,
    signOutUser,
    updatePlatformConfig,
    approveCryptoDeposit,
    rejectCryptoDeposit,
    approveKyc,
    rejectKyc,
    approveCapitalWithdrawal,
    rejectCapitalWithdrawal,
    giftMentorAccount,
  } = usePlatform();

  const [tab, setTab] = useState<AdminTab>('approvals');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [draftConfig, setDraftConfig] = useState<PlatformConfig>(platformConfig);
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewKycUser, setPreviewKycUser] = useState<UserProfile | null>(null);
  const [breakdownModalWd, setBreakdownModalWd] = useState<Withdrawal | null>(null);

  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [allInvestments, setAllInvestments] = useState<Investment[]>([]);
  const [allDeposits, setAllDeposits] = useState<CryptoDeposit[]>([]);
  const [allWithdrawals, setAllWithdrawals] = useState<Withdrawal[]>([]);
  const [allP2P, setAllP2P] = useState<P2PTransfer[]>([]);
  const [allMlm, setAllMlm] = useState<MlmCommission[]>([]);
  const [allMeme, setAllMeme] = useState<MemeCoinInvestment[]>([]);

  const [clientSearch, setClientSearch] = useState('');
  const [clientKycFilter, setClientKycFilter] = useState<'all' | 'pending' | 'approved' | 'unsubmitted' | 'rejected'>('all');

  const [mentorTargetUid, setMentorTargetUid] = useState('');
  const [mentorGiftAmount, setMentorGiftAmount] = useState('500');
  const [mentorDailyPct, setMentorDailyPct] = useState('2.0');
  const [mentorAiMode, setMentorAiMode] = useState('AI Mentor Institutional Desk');

  const [newPmName, setNewPmName] = useState('');
  const [newPmCode, setNewPmCode] = useState('');
  const [newPmCategory, setNewPmCategory] = useState<PaymentMethodCategory>('crypto');
  const [newPmAccount, setNewPmAccount] = useState('');
  const [newPmInstructions, setNewPmInstructions] = useState('');
  const [newPmMinDeposit, setNewPmMinDeposit] = useState('10');
  const [newPmMinWithdraw, setNewPmMinWithdraw] = useState('10');
  const [newPmAllowDep, setNewPmAllowDep] = useState(true);
  const [newPmAllowWd, setNewPmAllowWd] = useState(true);

  useEffect(() => {
    setDraftConfig(platformConfig);
  }, [platformConfig]);

  useEffect(() => {
    const u1 = onSnapshot(
      collection(db, 'users'),
      (snap) => setAllUsers(snap.docs.map((d) => d.data() as UserProfile)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );
    const u2 = onSnapshot(
      query(collection(db, 'cryptoDeposits'), orderBy('createdAt', 'desc')),
      (snap) => setAllDeposits(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CryptoDeposit, 'id'>) }))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'cryptoDeposits')
    );
    const u3 = onSnapshot(
      query(collection(db, 'withdrawals'), orderBy('createdAt', 'desc')),
      (snap) => setAllWithdrawals(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Withdrawal, 'id'>) }))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'withdrawals')
    );
    const u4 = onSnapshot(
      query(collection(db, 'p2pTransfers'), orderBy('createdAt', 'desc')),
      (snap) => setAllP2P(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<P2PTransfer, 'id'>) }))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'p2pTransfers')
    );
    const u5 = onSnapshot(
      query(collection(db, 'mlmCommissions'), orderBy('createdAt', 'desc')),
      (snap) => setAllMlm(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MlmCommission, 'id'>) }))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'mlmCommissions')
    );
    const u6 = onSnapshot(
      query(collection(db, 'memeCoinInvestments'), orderBy('createdAt', 'desc')),
      (snap) => setAllMeme(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MemeCoinInvestment, 'id'>) }))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'memeCoinInvestments')
    );
    const u7 = onSnapshot(
      query(collection(db, 'investments'), orderBy('startedAtMs', 'desc')),
      (snap) => setAllInvestments(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Investment, 'id'>) }))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'investments')
    );

    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
      u6();
      u7();
    };
  }, []);

  const notify = (type: 'ok' | 'err', text: string) => {
    setStatusMsg({ type, text });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveConfig = async (nextConfig: PlatformConfig = draftConfig) => {
    setBusy(true);
    try {
      await updatePlatformConfig(nextConfig);
      notify('ok', 'Platform configuration published globally to Firestore.');
    } catch (err) {
      notify('err', (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const pendingDeposits = allDeposits.filter((d) => d.status === 'pending');
  const pendingKyc = allUsers.filter((u) => u.kycStatus === 'pending');
  const pendingCapitalWd = allWithdrawals.filter(
    (w) => w.type === 'manual_capital' && w.status === 'pending'
  );
  const mentorUsers = allUsers.filter((u) => u.isMentor);

  const filteredClients = allUsers.filter((u) => {
    const matchesKyc = clientKycFilter === 'all' || u.kycStatus === clientKycFilter;
    const q = clientSearch.trim().toLowerCase();
    if (!q) return matchesKyc;
    return (
      matchesKyc &&
      (u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.handle.toLowerCase().includes(q) ||
        (u.idNumber || '').toLowerCase().includes(q))
    );
  });

  const handleExportClientsCsv = () => {
    const headers = [
      'UID',
      'Full Name',
      'Email',
      'Handle',
      'KYC Status',
      'ID Type',
      'ID Number',
      'USD Vault Balance',
      'Profit Balance',
      'Total Invested',
      'Total Withdrawn',
      'Referred By',
    ];
    const esc = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = filteredClients.map((u) =>
      [
        u.uid,
        u.fullName,
        u.email,
        u.handle,
        u.kycStatus,
        u.idType || '',
        u.idNumber || '',
        u.usdBalance.toFixed(2),
        u.profitBalance.toFixed(2),
        u.totalInvested.toFixed(2),
        u.totalWithdrawn.toFixed(2),
        u.referredByHandle || '',
      ]
        .map(esc)
        .join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alphatradex-clients-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const navGroups: {
    heading: string;
    items: { id: AdminTab; label: string; Icon: React.ComponentType<{ className?: string }> }[];
  }[] = [
    {
      heading: 'OPERATIONS',
      items: [
        {
          id: 'approvals',
          label: `Approvals (${pendingDeposits.length + pendingKyc.length + pendingCapitalWd.length})`,
          Icon: ShieldCheck,
        },
        { id: 'clients', label: `Client Database (${allUsers.length})`, Icon: Users },
        { id: 'mentors', label: 'Mentor Gifts (4× Rule)', Icon: Gift },
      ],
    },
    {
      heading: 'PLATFORM CONTROLS',
      items: [
        { id: 'announcements', label: 'Dashboard Notice Bar', Icon: Megaphone },
        { id: 'packages', label: 'Packages & 200-Day Rules', Icon: Settings },
        { id: 'company', label: 'Company & Trust Ratings', Icon: Shield },
        { id: 'wallets-meme', label: 'Payments, Wallets & Meme', Icon: Coins },
      ],
    },
    {
      heading: 'SYSTEM LEDGERS',
      items: [{ id: 'audit', label: 'Audit & P2P Ledgers', Icon: Activity }],
    },
  ];

  const activeTitle = navGroups.flatMap((g) => g.items).find((i) => i.id === tab)?.label || 'Super Admin';

  return (
    <div className="min-h-screen bg-[#F3F6FA] text-slate-900 flex">
      {/* Left Dark Navy Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 bg-[#0B111E] text-slate-300 flex flex-col border-r border-slate-800/80 transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center font-display font-extrabold text-white text-base shrink-0">
              V
            </span>
            <div className="min-w-0">
              <div className="font-display font-bold text-white text-sm truncate">Super Admin</div>
              <div className="text-[10px] font-mono text-orange-400 truncate">/admin Control Desk</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {navGroups.map((group) => (
            <div key={group.heading} className="space-y-1">
              <div className="px-3 text-[10px] font-mono font-semibold tracking-wider text-slate-500 uppercase">
                {group.heading}
              </div>
              {group.items.map(({ id, label, Icon }) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setTab(id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                      active
                        ? 'bg-slate-800/90 text-white border border-slate-700/70'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-orange-500' : 'text-slate-500'}`} />
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-800/80 space-y-1.5 shrink-0">
          <button
            type="button"
            onClick={onExitAdmin}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/60"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>Public Site</span>
          </button>
          <button
            type="button"
            onClick={signOutUser}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/60"
          >
            <LogOut className="w-4 h-4 text-slate-500" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Right Content Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-600"
              aria-label="Open admin menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-xs sm:text-sm flex items-center gap-2 min-w-0">
              <span className="text-slate-400 hidden sm:inline">Super Admin</span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <span className="font-display font-bold text-slate-900 truncate">{activeTitle}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden md:inline text-xs font-mono text-slate-500">{authUser?.email}</span>
            <button
              type="button"
              onClick={() => {
                const next = { ...draftConfig, globalPaused: !draftConfig.globalPaused };
                setDraftConfig(next);
                handleSaveConfig(next);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                draftConfig.globalPaused
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-red-600 hover:bg-red-500 text-white'
              }`}
            >
              {draftConfig.globalPaused ? (
                <>
                  <PlayCircle className="w-3.5 h-3.5" />
                  Resume Desk
                </>
              ) : (
                <>
                  <PauseCircle className="w-3.5 h-3.5" />
                  Global Pause
                </>
              )}
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 space-y-6 max-w-[1400px] w-full mx-auto">
          {statusMsg && (
            <div
              className={`p-3.5 rounded-xl border text-sm flex items-center justify-between ${
                statusMsg.type === 'ok'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              <span>{statusMsg.text}</span>
              <button
                type="button"
                onClick={() => setStatusMsg(null)}
                className="text-xs font-semibold underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* KPI Overview Strip */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Registered Vault Clients</div>
              <div className="font-mono font-bold text-2xl text-slate-900 tabular-nums mt-1">
                {allUsers.length}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Pending Deposits</div>
              <div className="font-mono font-bold text-2xl text-amber-600 tabular-nums mt-1">
                {pendingDeposits.length}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Pending KYC Reviews</div>
              <div className="font-mono font-bold text-2xl text-orange-600 tabular-nums mt-1">
                {pendingKyc.length}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Pending Capital Withdrawals</div>
              <div className="font-mono font-bold text-2xl text-red-600 tabular-nums mt-1">
                {pendingCapitalWd.length}
              </div>
            </div>
          </section>

          {/* TAB 1: APPROVAL QUEUES */}
          {tab === 'approvals' && (
            <section className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h2 className="font-display font-bold text-slate-900 text-base">
                  Pending Deposits (All Payment Methods)
                </h2>
                {pendingDeposits.length === 0 ? (
                  <p className="text-xs text-slate-500">No pending deposits.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-2 pr-3">Client</th>
                          <th className="py-2 pr-3">Network</th>
                          <th className="py-2 pr-3">Amount</th>
                          <th className="py-2 pr-3">TxID</th>
                          <th className="py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {pendingDeposits.map((d) => (
                          <tr key={d.id}>
                            <td className="py-2.5 pr-3">
                              <div className="font-semibold text-slate-900">{d.userName}</div>
                              <div className="text-slate-500">{d.userEmail}</div>
                            </td>
                            <td className="py-2.5 pr-3 font-mono">{d.network.replace('_', ' ')}</td>
                            <td className="py-2.5 pr-3 font-mono font-bold tabular-nums">
                              ${d.amountUsd.toFixed(2)}
                            </td>
                            <td className="py-2.5 pr-3 font-mono text-slate-600 max-w-[180px] truncate">
                              {d.txId}
                            </td>
                            <td className="py-2.5 text-right space-x-2 whitespace-nowrap">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={async () => {
                                  setBusy(true);
                                  try {
                                    await approveCryptoDeposit(d);
                                    notify('ok', `Approved $${d.amountUsd.toFixed(2)} deposit for ${d.userName}.`);
                                  } catch (err) {
                                    notify('err', (err as Error).message);
                                  } finally {
                                    setBusy(false);
                                  }
                                }}
                                className="px-3 py-1 rounded bg-emerald-600 text-white font-semibold hover:bg-emerald-500"
                              >
                                Approve &amp; Credit
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={async () => {
                                  setBusy(true);
                                  try {
                                    await rejectCryptoDeposit(d, 'TxID not found on chain');
                                    notify('ok', `Rejected deposit ${d.txId}.`);
                                  } catch (err) {
                                    notify('err', (err as Error).message);
                                  } finally {
                                    setBusy(false);
                                  }
                                }}
                                className="px-3 py-1 rounded bg-red-600 text-white font-semibold hover:bg-red-500"
                              >
                                Reject
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h2 className="font-display font-bold text-slate-900 text-base">
                  Pending KYC Identity Submissions
                </h2>
                {pendingKyc.length === 0 ? (
                  <p className="text-xs text-slate-500">No pending KYC submissions.</p>
                ) : (
                  <div className="space-y-3">
                    {pendingKyc.map((u) => (
                      <div
                        key={u.uid}
                        className="p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs"
                      >
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">
                            {u.fullName} ({u.handle})
                          </div>
                          <div className="text-slate-500">
                            {u.email} · {u.idType}: <span className="font-mono text-slate-800">{u.idNumber}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPreviewKycUser(u)}
                            className="px-3 py-1.5 rounded border border-slate-300 font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Inspect Photos
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              try {
                                await approveKyc(u.uid);
                                notify('ok', `KYC approved for ${u.fullName}.`);
                              } finally {
                                setBusy(false);
                              }
                            }}
                            className="px-3 py-1.5 rounded bg-emerald-600 text-white font-semibold hover:bg-emerald-500"
                          >
                            Approve KYC
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              try {
                                await rejectKyc(u.uid);
                                notify('ok', `KYC rejected for ${u.fullName}.`);
                              } finally {
                                setBusy(false);
                              }
                            }}
                            className="px-3 py-1.5 rounded bg-red-600 text-white font-semibold hover:bg-red-500"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h2 className="font-display font-bold text-slate-900 text-base">
                  Pending Manual Capital Withdrawals (Elite 70-Day &amp; Principal Requests)
                </h2>
                {pendingCapitalWd.length === 0 ? (
                  <p className="text-xs text-slate-500">No pending manual capital withdrawals.</p>
                ) : (
                  <div className="space-y-3">
                    {pendingCapitalWd.map((w) => (
                      <div
                        key={w.id}
                        className="p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs"
                      >
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">
                            Package #{w.packageNumber} · {w.userName}
                          </div>
                          <div className="text-slate-500 font-mono">
                            Principal: ${w.principalCapital.toFixed(2)} · Profit Gen: ${w.totalProfitGenerated.toFixed(2)} ·{' '}
                            {w.network.replace('_', ' ')} ({w.destinationAddress})
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setBreakdownModalWd(w)}
                            className="px-3 py-1.5 rounded border border-slate-300 font-semibold text-slate-700"
                          >
                            Breakdown
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              try {
                                await approveCapitalWithdrawal(w);
                                notify('ok', `Approved capital withdrawal for Package #${w.packageNumber}.`);
                              } finally {
                                setBusy(false);
                              }
                            }}
                            className="px-3 py-1.5 rounded bg-emerald-600 text-white font-semibold"
                          >
                            Approve Payout
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              try {
                                await rejectCapitalWithdrawal(w, 'Capital lock review declined');
                                notify('ok', `Rejected capital withdrawal for Package #${w.packageNumber}.`);
                              } finally {
                                setBusy(false);
                              }
                            }}
                            className="px-3 py-1.5 rounded bg-red-600 text-white font-semibold"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* TAB: CLIENT DATABASE (FIRESTORE & CSV EXPORT) */}
          {tab === 'clients' && (
            <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-display font-bold text-slate-900 text-lg">
                    Client Database Directory ({filteredClients.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Manage client KYC profiles, balances, and referral lineage powered by Cloud Firestore.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleExportClientsCsv}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 text-center">
                {[
                  { label: 'users', count: allUsers.length },
                  { label: 'investments', count: allInvestments.length },
                  { label: 'cryptoDeposits', count: allDeposits.length },
                  { label: 'withdrawals', count: allWithdrawals.length },
                  { label: 'p2pTransfers', count: allP2P.length },
                  { label: 'mlmCommissions', count: allMlm.length },
                  { label: 'memeCoin', count: allMeme.length },
                  { label: 'config/platform', count: 1 },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                    <div className="font-mono text-[11px] text-slate-500 truncate">{item.label}</div>
                    <div className="font-mono font-bold text-sm text-slate-900 tabular-nums">{item.count}</div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    placeholder="Search by full name, email, handle, or ID number..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  />
                </div>
                <select
                  value={clientKycFilter}
                  onChange={(e) =>
                    setClientKycFilter(
                      e.target.value as 'all' | 'pending' | 'approved' | 'unsubmitted' | 'rejected'
                    )
                  }
                  className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700"
                >
                  <option value="all">All KYC Statuses</option>
                  <option value="pending">KYC Pending</option>
                  <option value="approved">KYC Approved</option>
                  <option value="unsubmitted">KYC Unsubmitted</option>
                  <option value="rejected">KYC Rejected</option>
                </select>
              </div>

              {filteredClients.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No client records match your current filter.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2.5 pr-3">Client</th>
                        <th className="py-2.5 pr-3">Handle / Upline</th>
                        <th className="py-2.5 pr-3">KYC</th>
                        <th className="py-2.5 pr-3">ID Document</th>
                        <th className="py-2.5 pr-3">USD Vault</th>
                        <th className="py-2.5 pr-3">Profit Bal</th>
                        <th className="py-2.5 pr-3">Invested</th>
                        <th className="py-2.5 text-right">Controls</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredClients.map((u) => (
                        <tr key={u.uid} className="hover:bg-slate-50/70">
                          <td className="py-2.5 pr-3">
                            <div className="font-semibold text-slate-900">{u.fullName}</div>
                            <div className="text-slate-500">{u.email}</div>
                          </td>
                          <td className="py-2.5 pr-3 font-mono">
                            <div className="text-slate-800">{u.handle}</div>
                            {u.referredByHandle && (
                              <div className="text-[11px] text-slate-500">Ref: {u.referredByHandle}</div>
                            )}
                          </td>
                          <td className="py-2.5 pr-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded font-semibold uppercase text-[10px] ${
                                u.kycStatus === 'approved'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : u.kycStatus === 'pending'
                                  ? 'bg-amber-100 text-amber-800'
                                  : u.kycStatus === 'rejected'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {u.kycStatus}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 text-slate-600">
                            {u.idType ? (
                              <span className="font-mono">
                                {u.idType}: {u.idNumber}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-2.5 pr-3 font-mono tabular-nums font-semibold">
                            ${u.usdBalance.toFixed(2)}
                          </td>
                          <td className="py-2.5 pr-3 font-mono tabular-nums text-emerald-700">
                            ${u.profitBalance.toFixed(2)}
                          </td>
                          <td className="py-2.5 pr-3 font-mono tabular-nums">
                            ${u.totalInvested.toFixed(2)}
                          </td>
                          <td className="py-2.5 text-right whitespace-nowrap space-x-1.5">
                            <button
                              type="button"
                              onClick={() => setPreviewKycUser(u)}
                              className="px-2.5 py-1 rounded border border-slate-200 text-slate-700 font-semibold hover:bg-slate-100"
                            >
                              Inspect
                            </button>
                            {u.kycStatus !== 'approved' && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={async () => {
                                  setBusy(true);
                                  try {
                                    await approveKyc(u.uid);
                                    notify('ok', `KYC approved for ${u.fullName}.`);
                                  } finally {
                                    setBusy(false);
                                  }
                                }}
                                className="px-2.5 py-1 rounded bg-emerald-600 text-white font-semibold hover:bg-emerald-500"
                              >
                                Approve
                              </button>
                            )}
                            {u.kycStatus !== 'rejected' && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={async () => {
                                  setBusy(true);
                                  try {
                                    await rejectKyc(u.uid);
                                    notify('ok', `KYC rejected for ${u.fullName}.`);
                                  } finally {
                                    setBusy(false);
                                  }
                                }}
                                className="px-2.5 py-1 rounded bg-red-600 text-white font-semibold hover:bg-red-500"
                              >
                                Reject
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* TAB 2: MENTOR GIFTED ACCOUNTS (4x RULE) */}
          {tab === 'mentors' && (
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h2 className="font-display font-bold text-slate-900 text-base">
                  Gift Mentor Account (Automatic 4× Volume Rule)
                </h2>
                <p className="text-xs text-slate-500">
                  Gifted capital begins weekday profit accrual immediately, but profit withdrawals remain
                  locked until referred volume reaches 4 × Gifted Capital.
                </p>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!mentorTargetUid) {
                      notify('err', 'Select a client account to gift.');
                      return;
                    }
                    setBusy(true);
                    try {
                      await giftMentorAccount({
                        targetUid: mentorTargetUid,
                        giftedCapital: Number(mentorGiftAmount),
                        dailyPercent: Number(mentorDailyPct),
                        aiMode: mentorAiMode,
                      });
                      notify(
                        'ok',
                        `Mentor account gifted ($${Number(mentorGiftAmount).toFixed(2)} capital, $${(
                          Number(mentorGiftAmount) * 4
                        ).toFixed(2)} 4× volume required).`
                      );
                    } catch (err) {
                      notify('err', (err as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="space-y-3"
                >
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Select Client Account
                    </label>
                    <select
                      required
                      value={mentorTargetUid}
                      onChange={(e) => setMentorTargetUid(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white"
                    >
                      <option value="">-- Choose Registered User --</option>
                      {allUsers.map((u) => (
                        <option key={u.uid} value={u.uid}>
                          {u.fullName} ({u.handle}) — {u.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Gifted Capital ($)
                      </label>
                      <input
                        type="number"
                        min={10}
                        required
                        value={mentorGiftAmount}
                        onChange={(e) => setMentorGiftAmount(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Daily Target (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min={0.1}
                        required
                        value={mentorDailyPct}
                        onChange={(e) => setMentorDailyPct(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">AI Trading Mode</label>
                    <input
                      type="text"
                      required
                      value={mentorAiMode}
                      onChange={(e) => setMentorAiMode(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                    />
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono">
                    Required 4× Referred Volume:{' '}
                    <strong>${(Number(mentorGiftAmount || 0) * 4).toFixed(2)}</strong>
                  </div>

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full py-2.5 px-4 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold"
                  >
                    Gift Mentor Account
                  </button>
                </form>
              </div>

              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h3 className="font-display font-bold text-slate-900 text-base">
                  Active Mentor Accounts &amp; 4× Progress ({mentorUsers.length})
                </h3>
                {mentorUsers.length === 0 ? (
                  <p className="text-xs text-slate-500">No mentor accounts gifted yet.</p>
                ) : (
                  <div className="space-y-3">
                    {mentorUsers.map((m) => {
                      const req = m.mentorRequiredVolume || 0;
                      const brought = m.mentorBroughtVolume || 0;
                      const pct = req > 0 ? Math.min(100, Math.round((brought / req) * 100)) : 0;
                      const unlocked = req > 0 && brought >= req;
                      return (
                        <div key={m.uid} className="p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-semibold text-slate-900">{m.fullName}</span>{' '}
                              <span className="font-mono text-slate-500">({m.handle})</span>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded font-semibold ${
                                unlocked ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                              }`}
                            >
                              {unlocked ? '4× Unlocked' : 'Locked'}
                            </span>
                          </div>
                          <div className="flex justify-between font-mono text-slate-600 tabular-nums">
                            <span>Gifted: ${m.mentorGiftedCapital.toFixed(2)}</span>
                            <span>
                              Volume: ${brought.toFixed(2)} / ${req.toFixed(2)} ({pct}%)
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${unlocked ? 'bg-emerald-600' : 'bg-orange-600'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* TAB 3: PACKAGES & 200-DAY SCHEDULE RULES */}
          {tab === 'packages' && (
            <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display font-bold text-slate-900 text-lg">
                    Packages, 200-Day Schedule &amp; Withdrawal Rules
                  </h2>
                  <p className="text-xs text-slate-500">
                    Changes propagate immediately to the Front Page and User Vaults.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleSaveConfig()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save All Rules
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Minimum Profit Withdrawal ($)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={draftConfig.minWithdrawalUsd}
                    onChange={(e) =>
                      setDraftConfig({ ...draftConfig, minWithdrawalUsd: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Default Profit Days (Mon–Fri)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={draftConfig.totalProfitDays}
                    onChange={(e) =>
                      setDraftConfig({ ...draftConfig, totalProfitDays: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Elite Capital Lock (Calendar Days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={draftConfig.eliteCapitalLockDays}
                    onChange={(e) =>
                      setDraftConfig({ ...draftConfig, eliteCapitalLockDays: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                  />
                </div>
              </div>

              <div className="space-y-4">
                {draftConfig.packages.map((pkg, idx) => (
                  <div
                    key={pkg.id}
                    className="p-4 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-5 gap-3"
                  >
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Name</label>
                      <input
                        type="text"
                        value={pkg.name}
                        onChange={(e) => {
                          const pkgs = [...draftConfig.packages];
                          pkgs[idx] = { ...pkg, name: e.target.value };
                          setDraftConfig({ ...draftConfig, packages: pkgs });
                        }}
                        className="w-full px-3 py-1.5 rounded border border-slate-200 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Capital ($)</label>
                      <input
                        type="number"
                        value={pkg.capital}
                        onChange={(e) => {
                          const pkgs = [...draftConfig.packages];
                          pkgs[idx] = { ...pkg, capital: Number(e.target.value) };
                          setDraftConfig({ ...draftConfig, packages: pkgs });
                        }}
                        className="w-full px-3 py-1.5 rounded border border-slate-200 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Daily (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={pkg.dailyPercent}
                        onChange={(e) => {
                          const pkgs = [...draftConfig.packages];
                          pkgs[idx] = { ...pkg, dailyPercent: Number(e.target.value) };
                          setDraftConfig({ ...draftConfig, packages: pkgs });
                        }}
                        className="w-full px-3 py-1.5 rounded border border-slate-200 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">AI Trading Mode</label>
                      <input
                        type="text"
                        value={pkg.aiMode}
                        onChange={(e) => {
                          const pkgs = [...draftConfig.packages];
                          pkgs[idx] = { ...pkg, aiMode: e.target.value };
                          setDraftConfig({ ...draftConfig, packages: pkgs });
                        }}
                        className="w-full px-3 py-1.5 rounded border border-slate-200 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Profit Days</label>
                      <input
                        type="number"
                        value={pkg.profitDays}
                        onChange={(e) => {
                          const pkgs = [...draftConfig.packages];
                          pkgs[idx] = { ...pkg, profitDays: Number(e.target.value) };
                          setDraftConfig({ ...draftConfig, packages: pkgs });
                        }}
                        className="w-full px-3 py-1.5 rounded border border-slate-200 text-xs font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* TAB: USER DASHBOARD NOTIFICATION BAR EDITOR */}
          {tab === 'announcements' && (
            <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display font-bold text-slate-900 text-lg flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-orange-600" />
                    User Dashboard Notification Bar (Important Announcements)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Displayed exclusively inside logged-in User Dashboards (never on the public Home Page). Changes publish immediately to all users.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleSaveConfig()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold"
                >
                  <Save className="w-3.5 h-3.5" />
                  Publish Notification Bar
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-4">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Visibility Status</label>
                  <button
                    type="button"
                    onClick={() =>
                      setDraftConfig({
                        ...draftConfig,
                        dashboardAnnouncement: {
                          ...draftConfig.dashboardAnnouncement,
                          enabled: !draftConfig.dashboardAnnouncement.enabled,
                        },
                      })
                    }
                    className={`w-full px-3.5 py-2.5 rounded-lg border text-xs font-semibold flex items-center justify-between ${
                      draftConfig.dashboardAnnouncement.enabled
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span>
                      {draftConfig.dashboardAnnouncement.enabled
                        ? 'Active in User Dashboard'
                        : 'Hidden / Disabled'}
                    </span>
                    <span className="font-mono uppercase">
                      {draftConfig.dashboardAnnouncement.enabled ? 'ON' : 'OFF'}
                    </span>
                  </button>
                </div>

                <div className="md:col-span-4">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Announcement Priority / Tone</label>
                  <select
                    value={draftConfig.dashboardAnnouncement.tone}
                    onChange={(e) =>
                      setDraftConfig({
                        ...draftConfig,
                        dashboardAnnouncement: {
                          ...draftConfig.dashboardAnnouncement,
                          tone: e.target.value as AnnouncementTone,
                        },
                      })
                    }
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
                  >
                    <option value="info">Announcement (Blue / Info)</option>
                    <option value="warning">Important Notice (Amber / Warning)</option>
                    <option value="urgent">Urgent Alert (Red / Critical)</option>
                    <option value="success">Platform Update (Green / Success)</option>
                  </select>
                </div>

                <div className="md:col-span-4">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Announcement Title (max 120 chars)
                  </label>
                  <input
                    type="text"
                    maxLength={120}
                    value={draftConfig.dashboardAnnouncement.title}
                    onChange={(e) =>
                      setDraftConfig({
                        ...draftConfig,
                        dashboardAnnouncement: {
                          ...draftConfig.dashboardAnnouncement,
                          title: e.target.value,
                        },
                      })
                    }
                    placeholder="e.g. Important Platform Announcement"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                  />
                </div>

                <div className="md:col-span-12">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Announcement Message (max 500 chars)
                  </label>
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={draftConfig.dashboardAnnouncement.message}
                    onChange={(e) =>
                      setDraftConfig({
                        ...draftConfig,
                        dashboardAnnouncement: {
                          ...draftConfig.dashboardAnnouncement,
                          message: e.target.value,
                        },
                      })
                    }
                    placeholder="Write important notices for Vault users (maintenance windows, new payment methods, Forex rollout, withdrawal rules)..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                  />
                  <div className="text-[11px] font-mono text-slate-400 mt-1 text-right">
                    {draftConfig.dashboardAnnouncement.message.length} / 500
                  </div>
                </div>
              </div>

              {/* Live User Dashboard Preview */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="text-xs font-semibold text-slate-600">
                  Live Preview (Inside User Dashboard):
                </div>
                {!draftConfig.dashboardAnnouncement.enabled ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-300 text-xs text-slate-500 text-center">
                    Notification bar is currently turned OFF and hidden from users.
                  </div>
                ) : (
                  (() => {
                    const t = draftConfig.dashboardAnnouncement.tone;
                    const PreviewIcon =
                      t === 'urgent'
                        ? AlertTriangle
                        : t === 'warning'
                        ? Bell
                        : t === 'success'
                        ? CheckCircle2
                        : Megaphone;
                    const wrap =
                      t === 'urgent'
                        ? 'bg-red-950 border-red-500/60 text-red-100'
                        : t === 'warning'
                        ? 'bg-amber-950 border-amber-500/60 text-amber-100'
                        : t === 'success'
                        ? 'bg-emerald-950 border-emerald-500/60 text-emerald-100'
                        : 'bg-[#0B111E] border-sky-500/50 text-slate-100';
                    const tagColor =
                      t === 'urgent'
                        ? 'text-red-300'
                        : t === 'warning'
                        ? 'text-amber-300'
                        : t === 'success'
                        ? 'text-emerald-300'
                        : 'text-sky-300';
                    const label =
                      t === 'urgent'
                        ? 'Urgent Alert'
                        : t === 'warning'
                        ? 'Important Notice'
                        : t === 'success'
                        ? 'Platform Update'
                        : 'Announcement';

                    return (
                      <div className={`rounded-xl border px-4 py-3 flex items-start justify-between gap-3 ${wrap}`}>
                        <div className="flex items-start gap-3">
                          <PreviewIcon className={`w-4 h-4 mt-0.5 shrink-0 ${tagColor}`} />
                          <div className="space-y-0.5">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className={`font-mono font-semibold uppercase text-[11px] ${tagColor}`}>
                                {label}
                              </span>
                              {draftConfig.dashboardAnnouncement.title && (
                                <>
                                  <span className="opacity-50">·</span>
                                  <span className="font-display font-bold text-white">
                                    {draftConfig.dashboardAnnouncement.title}
                                  </span>
                                </>
                              )}
                            </div>
                            <p className="text-xs text-slate-200">
                              {draftConfig.dashboardAnnouncement.message || 'Enter an announcement message above.'}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs underline opacity-75 shrink-0">Hide</span>
                      </div>
                    );
                  })()
                )}
              </div>
            </section>
          )}

          {/* TAB 4: COMPANY DETAILS & TRUST RATINGS */}
          {tab === 'company' && (
            <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-slate-900 text-lg">
                  Company Details, Goal, Trustpilot &amp; Security Agency Ratings
                </h2>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleSaveConfig()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold"
                >
                  <Save className="w-3.5 h-3.5" />
                  Publish Updates
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Company Name</label>
                  <input
                    type="text"
                    value={draftConfig.companyName}
                    onChange={(e) => setDraftConfig({ ...draftConfig, companyName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Company Tagline</label>
                  <input
                    type="text"
                    value={draftConfig.companyTagline}
                    onChange={(e) => setDraftConfig({ ...draftConfig, companyTagline: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Company Details</label>
                  <textarea
                    rows={3}
                    value={draftConfig.companyDescription}
                    onChange={(e) => setDraftConfig({ ...draftConfig, companyDescription: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Company Goal</label>
                  <textarea
                    rows={3}
                    value={draftConfig.companyGoal}
                    onChange={(e) => setDraftConfig({ ...draftConfig, companyGoal: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Risk &amp; KYC Disclosure</label>
                  <textarea
                    rows={2}
                    value={draftConfig.riskDisclosure}
                    onChange={(e) => setDraftConfig({ ...draftConfig, riskDisclosure: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Trustpilot (★)</label>
                  <input
                    type="number"
                    step="0.1"
                    max={5}
                    value={draftConfig.trustpilotScore}
                    onChange={(e) => setDraftConfig({ ...draftConfig, trustpilotScore: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Trustpilot Reviews</label>
                  <input
                    type="number"
                    value={draftConfig.trustpilotReviews}
                    onChange={(e) => setDraftConfig({ ...draftConfig, trustpilotReviews: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Norton Secured</label>
                  <input
                    type="number"
                    step="0.1"
                    max={5}
                    value={draftConfig.nortonScore}
                    onChange={(e) => setDraftConfig({ ...draftConfig, nortonScore: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">ISO/IEC 27001</label>
                  <input
                    type="number"
                    step="0.1"
                    max={5}
                    value={draftConfig.isoScore}
                    onChange={(e) => setDraftConfig({ ...draftConfig, isoScore: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">CertiK Audit</label>
                  <input
                    type="number"
                    step="0.1"
                    max={5}
                    value={draftConfig.certikScore}
                    onChange={(e) => setDraftConfig({ ...draftConfig, certikScore: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                  />
                </div>
              </div>
            </section>
          )}

          {/* TAB 5: CRYPTO WALLETS, PAYMENT METHODS, MLM & PUMP.FUN CONFIG */}
          {tab === 'wallets-meme' && (
            <section className="space-y-6">
              {/* Dynamic Platform Payment Methods Manager */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display font-bold text-slate-900 text-base flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-orange-600" />
                      Platform Payment Methods (Deposit &amp; Withdrawal Channels)
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Add, edit, or toggle payment methods stored in Firestore. Active methods appear live in User Deposit &amp; Withdraw forms.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleSaveConfig()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Publish Payment Methods
                  </button>
                </div>

                {/* Existing Configured Payment Methods */}
                <div className="space-y-3">
                  {draftConfig.paymentMethods.map((pm, idx) => {
                    const updatePm = (patch: Partial<PaymentMethodConfig>) => {
                      const nextList = [...draftConfig.paymentMethods];
                      nextList[idx] = { ...pm, ...patch };
                      const nextWallets = { ...draftConfig.depositWallets };
                      if (pm.id === 'USDT_TRC20' && patch.receivingAccount !== undefined) {
                        nextWallets.usdtTrc20 = patch.receivingAccount;
                      } else if (pm.id === 'USDT_ERC20' && patch.receivingAccount !== undefined) {
                        nextWallets.usdtErc20 = patch.receivingAccount;
                      } else if (pm.id === 'SOL' && patch.receivingAccount !== undefined) {
                        nextWallets.sol = patch.receivingAccount;
                      }
                      setDraftConfig({
                        ...draftConfig,
                        depositWallets: nextWallets,
                        paymentMethods: nextList,
                      });
                    };

                    return (
                      <div
                        key={pm.id}
                        className={`p-4 rounded-xl border space-y-3 ${
                          pm.enabled ? 'border-slate-200 bg-slate-50/60' : 'border-slate-200 bg-slate-100/80 opacity-75'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-display font-bold text-slate-900 text-sm">{pm.name}</span>
                            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                              {pm.id}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded bg-orange-100 text-orange-800 font-semibold uppercase">
                              {pm.category.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs">
                            <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                              <input
                                type="checkbox"
                                checked={pm.allowDeposit}
                                onChange={(e) => updatePm({ allowDeposit: e.target.checked })}
                              />
                              Deposit
                            </label>
                            <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                              <input
                                type="checkbox"
                                checked={pm.allowWithdrawal}
                                onChange={(e) => updatePm({ allowWithdrawal: e.target.checked })}
                              />
                              Withdraw
                            </label>
                            <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold text-emerald-700">
                              <input
                                type="checkbox"
                                checked={pm.enabled}
                                onChange={(e) => updatePm({ enabled: e.target.checked })}
                              />
                              Enabled
                            </label>
                            {draftConfig.paymentMethods.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const filtered = draftConfig.paymentMethods.filter((item) => item.id !== pm.id);
                                  setDraftConfig({ ...draftConfig, paymentMethods: filtered });
                                }}
                                className="p-1.5 rounded text-red-600 hover:bg-red-50"
                                title="Remove Payment Method"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                          <div className="md:col-span-3">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Display Name</label>
                            <input
                              type="text"
                              value={pm.name}
                              onChange={(e) => updatePm({ name: e.target.value })}
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                            />
                          </div>
                          <div className="md:col-span-5">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Receiving Wallet / Pay ID / Number
                            </label>
                            <input
                              type="text"
                              value={pm.receivingAccount}
                              onChange={(e) => updatePm({ receivingAccount: e.target.value })}
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Min Deposit ($)</label>
                            <input
                              type="number"
                              min={1}
                              value={pm.minDepositUsd}
                              onChange={(e) => updatePm({ minDepositUsd: Number(e.target.value) || 1 })}
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Min Withdraw ($)</label>
                            <input
                              type="number"
                              min={1}
                              value={pm.minWithdrawalUsd}
                              onChange={(e) => updatePm({ minWithdrawalUsd: Number(e.target.value) || 1 })}
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs"
                            />
                          </div>
                          <div className="md:col-span-12">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Deposit / Payment Instructions for Users
                            </label>
                            <input
                              type="text"
                              value={pm.instructions}
                              onChange={(e) => updatePm({ instructions: e.target.value })}
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add New Payment Method Form */}
                <div className="p-4 rounded-xl border border-dashed border-orange-300 bg-orange-50/40 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-display font-bold text-slate-900 flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-orange-600" />
                      Add New Payment Method
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      {[
                        { name: 'Binance Pay', code: 'BINANCE_PAY', cat: 'exchange' as PaymentMethodCategory },
                        { name: 'USDT (BEP20)', code: 'USDT_BEP20', cat: 'crypto' as PaymentMethodCategory },
                        { name: 'Bitcoin (BTC)', code: 'BTC', cat: 'crypto' as PaymentMethodCategory },
                        { name: 'bKash', code: 'BKASH', cat: 'mobile_banking' as PaymentMethodCategory },
                        { name: 'Nagad', code: 'NAGAD', cat: 'mobile_banking' as PaymentMethodCategory },
                        { name: 'Bank Wire', code: 'BANK_WIRE', cat: 'bank' as PaymentMethodCategory },
                      ].map((preset) => (
                        <button
                          key={preset.code}
                          type="button"
                          onClick={() => {
                            setNewPmName(preset.name);
                            setNewPmCode(preset.code);
                            setNewPmCategory(preset.cat);
                            if (preset.cat === 'mobile_banking') {
                              setNewPmInstructions(`Send Money / Cash Out to our ${preset.name} number and paste your TrxID.`);
                            } else if (preset.cat === 'exchange') {
                              setNewPmInstructions(`Send USDT via ${preset.name} ID and enter your Order ID.`);
                            } else {
                              setNewPmInstructions(`Send funds via ${preset.name} and submit transaction reference.`);
                            }
                          }}
                          className="px-2 py-1 rounded border border-orange-200 bg-white hover:bg-orange-100 text-slate-700 font-medium"
                        >
                          + {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Method Name</label>
                      <input
                        type="text"
                        value={newPmName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewPmName(val);
                          if (!newPmCode) {
                            setNewPmCode(
                              val
                                .trim()
                                .toUpperCase()
                                .replace(/[^A-Z0-9]+/g, '_')
                                .replace(/^_+|_+$/g, '')
                                .slice(0, 32)
                            );
                          }
                        }}
                        placeholder="e.g. Binance Pay or bKash"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Method ID</label>
                      <input
                        type="text"
                        value={newPmCode}
                        onChange={(e) =>
                          setNewPmCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '_').slice(0, 48))
                        }
                        placeholder="BINANCE_PAY"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Category</label>
                      <select
                        value={newPmCategory}
                        onChange={(e) => setNewPmCategory(e.target.value as PaymentMethodCategory)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                      >
                        <option value="crypto">Crypto Network</option>
                        <option value="exchange">Exchange Pay</option>
                        <option value="mobile_banking">Mobile Banking</option>
                        <option value="bank">Bank Transfer</option>
                      </select>
                    </div>
                    <div className="md:col-span-5">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Receiving Wallet / Pay ID / Number
                      </label>
                      <input
                        type="text"
                        value={newPmAccount}
                        onChange={(e) => setNewPmAccount(e.target.value)}
                        placeholder="Wallet address, Binance Pay ID, or Mobile/Bank account"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs"
                      />
                    </div>
                    <div className="md:col-span-6">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Instructions</label>
                      <input
                        type="text"
                        value={newPmInstructions}
                        onChange={(e) => setNewPmInstructions(e.target.value)}
                        placeholder="Instructions shown to users during deposit"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Min Deposit ($)</label>
                      <input
                        type="number"
                        min={1}
                        value={newPmMinDeposit}
                        onChange={(e) => setNewPmMinDeposit(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Min Withdraw ($)</label>
                      <input
                        type="number"
                        min={1}
                        value={newPmMinWithdraw}
                        onChange={(e) => setNewPmMinWithdraw(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs"
                      />
                    </div>
                    <div className="md:col-span-2 flex items-end">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          const cleanName = newPmName.trim();
                          const cleanId = (
                            newPmCode.trim() ||
                            cleanName
                              .toUpperCase()
                              .replace(/[^A-Z0-9]+/g, '_')
                              .replace(/^_+|_+$/g, '')
                          ).slice(0, 64);
                          const cleanAcc = newPmAccount.trim();
                          if (!cleanName || !cleanId || !cleanAcc) {
                            notify('err', 'Enter Method Name, Method ID, and Receiving Account / Wallet.');
                            return;
                          }
                          if (draftConfig.paymentMethods.some((m) => m.id === cleanId)) {
                            notify('err', `Payment method ID "${cleanId}" already exists.`);
                            return;
                          }
                          const added: PaymentMethodConfig = {
                            id: cleanId,
                            name: cleanName,
                            category: newPmCategory,
                            receivingAccount: cleanAcc,
                            instructions:
                              newPmInstructions.trim() ||
                              `Send funds via ${cleanName} and paste your transaction reference ID.`,
                            minDepositUsd: Math.max(1, Number(newPmMinDeposit) || 10),
                            minWithdrawalUsd: Math.max(1, Number(newPmMinWithdraw) || 10),
                            allowDeposit: newPmAllowDep,
                            allowWithdrawal: newPmAllowWd,
                            enabled: true,
                          };
                          const nextConfig: PlatformConfig = {
                            ...draftConfig,
                            paymentMethods: [...draftConfig.paymentMethods, added],
                          };
                          setDraftConfig(nextConfig);
                          setNewPmName('');
                          setNewPmCode('');
                          setNewPmAccount('');
                          setNewPmInstructions('');
                          await handleSaveConfig(nextConfig);
                        }}
                        className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add &amp; Save
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-700">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newPmAllowDep}
                        onChange={(e) => setNewPmAllowDep(e.target.checked)}
                      />
                      Allow Deposits
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newPmAllowWd}
                        onChange={(e) => setNewPmAllowWd(e.target.checked)}
                      />
                      Allow Withdrawals
                    </label>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-bold text-slate-900 text-base">
                    Legacy Crypto Wallets Quick-Sync &amp; MLM Commission Rates
                  </h2>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleSaveConfig()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save Wallets &amp; Token
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">USDT (TRC20) Address</label>
                    <input
                      type="text"
                      value={draftConfig.depositWallets.usdtTrc20}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraftConfig({
                          ...draftConfig,
                          depositWallets: { ...draftConfig.depositWallets, usdtTrc20: val },
                          paymentMethods: draftConfig.paymentMethods.map((pm) =>
                            pm.id === 'USDT_TRC20' ? { ...pm, receivingAccount: val } : pm
                          ),
                        });
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">USDT (ERC20) Address</label>
                    <input
                      type="text"
                      value={draftConfig.depositWallets.usdtErc20}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraftConfig({
                          ...draftConfig,
                          depositWallets: { ...draftConfig.depositWallets, usdtErc20: val },
                          paymentMethods: draftConfig.paymentMethods.map((pm) =>
                            pm.id === 'USDT_ERC20' ? { ...pm, receivingAccount: val } : pm
                          ),
                        });
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Solana (SOL) Address</label>
                    <input
                      type="text"
                      value={draftConfig.depositWallets.sol}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraftConfig({
                          ...draftConfig,
                          depositWallets: { ...draftConfig.depositWallets, sol: val },
                          paymentMethods: draftConfig.paymentMethods.map((pm) =>
                            pm.id === 'SOL' ? { ...pm, receivingAccount: val } : pm
                          ),
                        });
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">MLM Level 1 (%)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={draftConfig.mlmRates.level1}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          mlmRates: { ...draftConfig.mlmRates, level1: Number(e.target.value) },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">MLM Level 2 (%)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={draftConfig.mlmRates.level2}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          mlmRates: { ...draftConfig.mlmRates, level2: Number(e.target.value) },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">MLM Level 3 (%)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={draftConfig.mlmRates.level3}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          mlmRates: { ...draftConfig.mlmRates, level3: Number(e.target.value) },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h3 className="font-display font-bold text-slate-900 text-base">
                  Official Pump.fun Meme Coin Configuration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Token Name</label>
                    <input
                      type="text"
                      value={draftConfig.pumpFunToken.name}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          pumpFunToken: { ...draftConfig.pumpFunToken, name: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Ticker</label>
                    <input
                      type="text"
                      value={draftConfig.pumpFunToken.ticker}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          pumpFunToken: { ...draftConfig.pumpFunToken, ticker: e.target.value.toUpperCase() },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Live Price (USD)</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={draftConfig.pumpFunToken.priceUsd}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          pumpFunToken: { ...draftConfig.pumpFunToken, priceUsd: Number(e.target.value) },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Solana Mint Address</label>
                    <input
                      type="text"
                      value={draftConfig.pumpFunToken.mintAddress}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          pumpFunToken: { ...draftConfig.pumpFunToken, mintAddress: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Pump.fun URL</label>
                    <input
                      type="url"
                      value={draftConfig.pumpFunToken.pumpFunUrl}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          pumpFunToken: { ...draftConfig.pumpFunToken, pumpFunUrl: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* TAB 6: AUDIT & LEDGERS */}
          {tab === 'audit' && (
            <section className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
                <h2 className="font-display font-bold text-slate-900 text-base">
                  All Vault Users ({allUsers.length})
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2 pr-3">Name / Handle</th>
                        <th className="py-2 pr-3">Email</th>
                        <th className="py-2 pr-3">KYC</th>
                        <th className="py-2 pr-3">USD Vault</th>
                        <th className="py-2 pr-3">Profit Bal</th>
                        <th className="py-2">Invested</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allUsers.map((u) => (
                        <tr key={u.uid}>
                          <td className="py-2 pr-3 font-semibold">
                            {u.fullName} <span className="font-mono text-slate-500">({u.handle})</span>
                          </td>
                          <td className="py-2 pr-3 text-slate-600">{u.email}</td>
                          <td className="py-2 pr-3 font-mono">{u.kycStatus}</td>
                          <td className="py-2 pr-3 font-mono tabular-nums">${u.usdBalance.toFixed(2)}</td>
                          <td className="py-2 pr-3 font-mono tabular-nums">${u.profitBalance.toFixed(2)}</td>
                          <td className="py-2 font-mono tabular-nums">${u.totalInvested.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                  <h3 className="font-display font-bold text-slate-900 text-base">
                    P2P Transfers ({allP2P.length})
                  </h3>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {allP2P.map((t) => (
                      <div key={t.id} className="p-2.5 rounded-lg border border-slate-200 text-xs flex justify-between">
                        <span>
                          <strong>{t.senderHandle}</strong> → <strong>{t.receiverHandle}</strong>
                        </span>
                        <span className="font-mono font-bold tabular-nums">${t.amountUsd.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                  <h3 className="font-display font-bold text-slate-900 text-base">
                    Withdrawals &amp; Meme Coin Allocations ({allWithdrawals.length + allMeme.length})
                  </h3>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {allWithdrawals.map((w) => (
                      <div key={w.id} className="p-2.5 rounded-lg border border-slate-200 text-xs flex justify-between">
                        <span>
                          [{w.type}] {w.userName} ({w.status})
                        </span>
                        <span className="font-mono font-bold tabular-nums">${w.amountUsd.toFixed(2)}</span>
                      </div>
                    ))}
                    {allMeme.map((m) => (
                      <div key={m.id} className="p-2.5 rounded-lg border border-slate-200 text-xs flex justify-between">
                        <span>
                          [Pump.fun ${m.tokenTicker}] {m.userName} ({m.tokenQuantity.toLocaleString()} tokens)
                        </span>
                        <span className="font-mono font-bold tabular-nums">${m.amountUsd.toFixed(2)}</span>
                      </div>
                    ))}
                    {allMlm.map((c) => (
                      <div key={c.id} className="p-2.5 rounded-lg border border-slate-200 text-xs flex justify-between">
                        <span>
                          [MLM L{c.level}] from {c.fromName}
                        </span>
                        <span className="font-mono font-bold text-emerald-700 tabular-nums">
                          +${c.commissionUsd.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>

      {/* KYC Document Photo Preview Modal */}
      {previewKycUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-w-lg w-full bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-xl">
            <div className="bg-[#0B111E] px-5 py-4 text-white flex justify-between items-center">
              <span className="font-display font-bold text-sm">
                KYC Photos · {previewKycUser.fullName} ({previewKycUser.idType}: {previewKycUser.idNumber})
              </span>
              <button
                type="button"
                onClick={() => setPreviewKycUser(null)}
                className="text-xs text-slate-300 hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-semibold text-slate-600 mb-1.5">Document Photo</div>
                {previewKycUser.idPhotoData ? (
                  <img
                    src={previewKycUser.idPhotoData}
                    alt="ID document"
                    className="w-full h-44 object-cover rounded-lg border border-slate-200"
                  />
                ) : (
                  <div className="h-44 rounded-lg bg-slate-100 flex items-center justify-center text-xs text-slate-400">
                    No photo
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-600 mb-1.5">Client Portrait</div>
                {previewKycUser.portraitPhotoData ? (
                  <img
                    src={previewKycUser.portraitPhotoData}
                    alt="Client portrait"
                    className="w-full h-44 object-cover rounded-lg border border-slate-200"
                  />
                ) : (
                  <div className="h-44 rounded-lg bg-slate-100 flex items-center justify-center text-xs text-slate-400">
                    No photo
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <CapitalRequestModal
        withdrawal={breakdownModalWd}
        onClose={() => setBreakdownModalWd(null)}
      />
    </div>
  );
};
