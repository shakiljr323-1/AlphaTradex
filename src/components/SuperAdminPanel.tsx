import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Ban,
  Bell,
  CheckCircle2,
  CheckSquare,
  Coins,
  Copy,
  Cpu,
  CreditCard,
  Database,
  Download,
  ExternalLink,
  FileCheck,
  FileJson,
  Film,
  Gift,
  Globe,
  Headphones,
  Image as ImageIcon,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  MessageCircle,
  PauseCircle,
  PlayCircle,
  Plus,
  Power,
  Save,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  TrendingUp,
  Trophy,
  Unlock,
  Users,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { DEFAULT_PLATFORM_CONFIG } from '../constants/defaults';
import { usePlatform } from '../context/PlatformContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  AdminActionLog,
  AnnouncementTone,
  BannerAdConfig,
  BannerAdPlacement,
  BannerAdTheme,
  CoinMiningPlan,
  CoinMiningStake,
  CopyTraderProfile,
  CopyTradeSubscription,
  CryptoDeposit,
  ForexAccountTierConfig,
  ForexAccountTierId,
  ForexPlatformConfig,
  ForexTrade,
  Investment,
  MemeCoinInvestment,
  MlmCommission,
  P2PTransfer,
  PaymentMethodCategory,
  PaymentMethodConfig,
  PlatformConfig,
  SecurityAuditLog,
  SupportChatThread,
  SupportTicket,
  UserProfile,
  Web3VerifiedTx,
  Withdrawal,
} from '../types/platform';
import { BannerAdSlot } from './AlphatradexCoinHub';
import { CapitalRequestModal } from './CapitalRequestModal';
import { AlphatradexLogo3D } from './AlphatradexLogo3D';
import { AdminSupportCenter } from './AdminSupportCenter';
import { AdminKycManagement } from './AdminKycManagement';
import { AdminMarketingCardsPanel } from './AdminMarketingCardsPanel';
import { AdminHowItWorksPanel } from './AdminHowItWorksPanel';
import { AdminLeaderboardPanel } from './AdminLeaderboardPanel';
import { AdminWeb3PaymentPanel } from './AdminWeb3PaymentPanel';
import { AdminResendEmailSettingsPanel } from './AdminResendEmailSettingsPanel';
import { AdminCashflowAnalyticsCard } from './AdminCashflowAnalyticsCard';

function formatUiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err || 'Action failed.');
  if (raw.startsWith('{') && raw.includes('"error"')) {
    try {
      const parsed = JSON.parse(raw) as { error?: string };
      if (parsed?.error) return parsed.error;
    } catch {
      // Ignore parse error
    }
  }
  return raw;
}

type AdminTab =
  | 'overview'
  | 'approvals'
  | 'kyc'
  | 'support'
  | 'clients'
  | 'mentors'
  | 'packages'
  | 'forex-copy'
  | 'announcements'
  | 'coin-ads-mining'
  | 'marketing-cards'
  | 'how-it-works'
  | 'leaderboard'
  | 'modules-support'
  | 'company'
  | 'web3-payments'
  | 'wallets-meme'
  | 'email-api'
  | 'audit';

export const SuperAdminPanel: React.FC<{ onExitAdmin: () => void }> = ({ onExitAdmin }) => {
  const {
    authUser,
    platformConfig,
    marketingCardStats,
    signOutUser,
    updatePlatformConfig,
    approveCryptoDeposit,
    rejectCryptoDeposit,
    approveKyc,
    rejectKyc,
    requestKycResubmission,
    setUserKycStatus,
    verifyUserPhone,
    bulkApproveKyc,
    bulkVerifyPhones,
    approveCapitalWithdrawal,
    rejectCapitalWithdrawal,
    updateWithdrawalNote,
    giftMentorAccount,
    revokeMentorAccess,
    adjustUserBalance,
    setUserSuspension,
  } = usePlatform();

  const [tab, setTab] = useState<AdminTab>('overview');
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
  const [allCoinStakes, setAllCoinStakes] = useState<CoinMiningStake[]>([]);
  const [allForexTrades, setAllForexTrades] = useState<ForexTrade[]>([]);
  const [allCopySubs, setAllCopySubs] = useState<CopyTradeSubscription[]>([]);
  const [allAdminLogs, setAllAdminLogs] = useState<AdminActionLog[]>([]);
  const [allWeb3VerifiedTxs, setAllWeb3VerifiedTxs] = useState<Web3VerifiedTx[]>([]);
  const [allAuditLogs, setAllAuditLogs] = useState<SecurityAuditLog[]>([]);
  const [allSupportChats, setAllSupportChats] = useState<SupportChatThread[]>([]);
  const [allSupportTickets, setAllSupportTickets] = useState<SupportTicket[]>([]);

  const [clientSearch, setClientSearch] = useState('');
  const [clientKycFilter, setClientKycFilter] = useState<'all' | 'pending' | 'approved' | 'unsubmitted' | 'rejected'>('all');

  const [selectedKycUids, setSelectedKycUids] = useState<string[]>([]);
  const [wdStatusFilter, setWdStatusFilter] = useState<'pending' | 'approved' | 'completed' | 'rejected' | 'all'>('pending');
  const [wdNoteDrafts, setWdNoteDrafts] = useState<Record<string, string>>({});
  const [wdTxHashDrafts, setWdTxHashDrafts] = useState<Record<string, string>>({});

  const [manageClient, setManageClient] = useState<UserProfile | null>(null);
  const [manageClientSubTab, setManageClientSubTab] = useState<'controls' | 'deposits' | 'withdrawals' | 'packages' | 'forex'>('controls');
  const [balWallet, setBalWallet] = useState<'usdBalance' | 'profitBalance'>('usdBalance');
  const [balMode, setBalMode] = useState<'credit' | 'debit'>('credit');
  const [balAmount, setBalAmount] = useState('');
  const [balReason, setBalReason] = useState('');
  const [suspendReasonDraft, setSuspendReasonDraft] = useState('');

  const [mentorTargetUid, setMentorTargetUid] = useState('');
  const [mentorGiftAmount, setMentorGiftAmount] = useState(
    String(platformConfig.mentorConfig?.defaultGiftCapital || 500)
  );
  const [mentorDailyPct, setMentorDailyPct] = useState(
    String(platformConfig.mentorConfig?.defaultDailyPercent || 2.0)
  );
  const [mentorAiMode, setMentorAiMode] = useState('AI Mentor Institutional Desk');

  const [newPmName, setNewPmName] = useState('');
  const [newPmCode, setNewPmCode] = useState('');
  const [newPmCategory, setNewPmCategory] = useState<PaymentMethodCategory>('crypto');
  const [newPmAccount, setNewPmAccount] = useState('');
  const [newPmWithdrawAddress, setNewPmWithdrawAddress] = useState('');
  const [newPmInstructions, setNewPmInstructions] = useState('');
  const [newPmMinDeposit, setNewPmMinDeposit] = useState('10');
  const [newPmMinWithdraw, setNewPmMinWithdraw] = useState('10');
  const [newPmAllowDep, setNewPmAllowDep] = useState(true);
  const [newPmAllowWd, setNewPmAllowWd] = useState(true);

  useEffect(() => {
    setDraftConfig(platformConfig);
  }, [platformConfig]);

  // Silently hydrate the server's runtime Email (SMTP/Resend) & Telegram config caches from Firestore on Super Admin load
  useEffect(() => {
    if (!authUser) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await authUser.getIdToken();
        if (cancelled) return;
        await Promise.allSettled([
          fetch('/api/admin/email-config', {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch('/api/admin/telegram-config', {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
      } catch {
        // Non-blocking warmup
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authUser]);

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
    const u8 = onSnapshot(
      query(collection(db, 'coinMiningStakes'), orderBy('startedAtMs', 'desc')),
      (snap) => setAllCoinStakes(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CoinMiningStake, 'id'>) }))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'coinMiningStakes')
    );
    const u9 = onSnapshot(
      query(collection(db, 'forexTrades'), orderBy('openedAtMs', 'desc')),
      (snap) => setAllForexTrades(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ForexTrade, 'id'>) }))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'forexTrades')
    );
    const u10 = onSnapshot(
      query(collection(db, 'copyTradeSubscriptions'), orderBy('startedAtMs', 'desc')),
      (snap) =>
        setAllCopySubs(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CopyTradeSubscription, 'id'>) }))
        ),
      (err) => handleFirestoreError(err, OperationType.LIST, 'copyTradeSubscriptions')
    );
    const u11 = onSnapshot(
      query(collection(db, 'adminLogs'), orderBy('createdAt', 'desc')),
      (snap) =>
        setAllAdminLogs(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AdminActionLog, 'id'>) }))
        ),
      (err) => handleFirestoreError(err, OperationType.LIST, 'adminLogs')
    );
    const u12 = onSnapshot(
      query(collection(db, 'supportChats'), orderBy('updatedAt', 'desc')),
      (snap) => setAllSupportChats(snap.docs.map((d) => d.data() as SupportChatThread)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'supportChats')
    );
    const u13 = onSnapshot(
      query(collection(db, 'supportTickets'), orderBy('createdAt', 'desc')),
      (snap) =>
        setAllSupportTickets(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SupportTicket, 'id'>) }))
        ),
      (err) => handleFirestoreError(err, OperationType.LIST, 'supportTickets')
    );
    const u14 = onSnapshot(
      query(collection(db, 'web3VerifiedTxs'), orderBy('createdAt', 'desc')),
      (snap) =>
        setAllWeb3VerifiedTxs(
          snap.docs.map((d) => ({ txKey: d.id, ...(d.data() as Omit<Web3VerifiedTx, 'txKey'>) }))
        ),
      (err) => handleFirestoreError(err, OperationType.LIST, 'web3VerifiedTxs')
    );
    const u15 = onSnapshot(
      query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc')),
      (snap) =>
        setAllAuditLogs(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SecurityAuditLog, 'id'>) }))
        ),
      (err) => handleFirestoreError(err, OperationType.LIST, 'auditLogs')
    );

    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
      u6();
      u7();
      u8();
      u9();
      u10();
      u11();
      u12();
      u13();
      u14();
      u15();
    };
  }, []);

  const notify = (type: 'ok' | 'err', text: string) => {
    setStatusMsg({ type, text: type === 'err' ? formatUiError(text) : text });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveConfig = async (nextConfig: PlatformConfig = draftConfig) => {
    setBusy(true);
    try {
      await updatePlatformConfig(nextConfig);
      notify('ok', 'Platform configuration published globally to Firestore.');
    } catch (err) {
      notify('err', formatUiError(err));
    } finally {
      setBusy(false);
    }
  };

  const pendingDeposits = allDeposits.filter((d) => d.status === 'pending');
  const pendingKyc = allUsers.filter((u) => u.kycStatus === 'pending');
  const pendingCapitalWd = allWithdrawals.filter((w) => w.status === 'pending');
  const mentorUsers = allUsers.filter((u) => u.isMentor);

  const totalVaultLiquidity = allUsers.reduce((sum, u) => sum + (Number(u.usdBalance) || 0), 0);
  const totalIncomeLiquidity = allUsers.reduce((sum, u) => sum + (Number(u.profitBalance) || 0), 0);
  const totalInvestedAll = allUsers.reduce((sum, u) => sum + (Number(u.totalInvested) || 0), 0);
  const totalWithdrawnAll = allUsers.reduce((sum, u) => sum + (Number(u.totalWithdrawn) || 0), 0);
  const approvedKycCount = allUsers.filter((u) => u.kycStatus === 'approved').length;
  const suspendedCount = allUsers.filter((u) => u.suspended).length;
  const activeInvestmentsCount = allInvestments.filter((i) => i.status === 'active').length;
  const openForexCount = allForexTrades.filter((t) => t.status === 'open').length;
  const activeCopyCount = allCopySubs.filter((c) => c.status === 'active').length;

  const filteredWithdrawals = allWithdrawals.filter((w) =>
    wdStatusFilter === 'all' ? true : w.status === wdStatusFilter
  );

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
      'Suspended',
      'ID Type',
      'ID Number',
      'USD Vault Balance',
      'Profit Balance',
      'Total Invested',
      'Total Withdrawn',
      'Referred By',
    ];
    const esc = (v: string | number | boolean) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = filteredClients.map((u) =>
      [
        u.uid,
        u.fullName,
        u.email,
        u.handle,
        u.kycStatus,
        Boolean(u.suspended),
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

  const handleExportFullBackupJson = () => {
    const backup = {
      exportedAt: new Date().toISOString(),
      exportedBy: authUser?.email || 'admin',
      platformConfig,
      counts: {
        users: allUsers.length,
        investments: allInvestments.length,
        cryptoDeposits: allDeposits.length,
        withdrawals: allWithdrawals.length,
        p2pTransfers: allP2P.length,
        mlmCommissions: allMlm.length,
        memeCoinInvestments: allMeme.length,
        coinMiningStakes: allCoinStakes.length,
        forexTrades: allForexTrades.length,
        copyTradeSubscriptions: allCopySubs.length,
        adminLogs: allAdminLogs.length,
        supportChats: allSupportChats.length,
        supportTickets: allSupportTickets.length,
      },
      data: {
        users: allUsers,
        investments: allInvestments,
        cryptoDeposits: allDeposits,
        withdrawals: allWithdrawals,
        p2pTransfers: allP2P,
        mlmCommissions: allMlm,
        memeCoinInvestments: allMeme,
        coinMiningStakes: allCoinStakes,
        forexTrades: allForexTrades,
        copyTradeSubscriptions: allCopySubs,
        adminLogs: allAdminLogs,
        supportChats: allSupportChats,
        supportTickets: allSupportTickets,
      },
    };
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alphatradex-full-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('ok', 'Full platform JSON backup exported.');
  };

  const formatLogTime = (val: unknown): string => {
    if (!val) return 'Just now';
    const secs = (val as { seconds?: number })?.seconds;
    if (typeof secs === 'number') {
      return new Date(secs * 1000).toLocaleString();
    }
    return String(val);
  };

  const mentorMultiplier = Math.max(1, Number(draftConfig.mentorConfig?.volumeMultiplier) || 4);
  const unreadSupportChatsCount = allSupportChats.reduce(
    (sum, t) => sum + Number(t.unreadByAdmin || 0),
    0
  );
  const openSupportTicketsCount = allSupportTickets.filter(
    (t) => t.status === 'open' || t.status === 'in_progress'
  ).length;

  const navGroups: {
    heading: string;
    items: { id: AdminTab; label: string; Icon: React.ComponentType<{ className?: string }> }[];
  }[] = [
    {
      heading: 'OPERATIONS',
      items: [
        { id: 'overview', label: 'Overview & Kill Switches', Icon: LayoutDashboard },
        {
          id: 'approvals',
          label: `Approvals (${pendingDeposits.length + pendingKyc.length + pendingCapitalWd.length})`,
          Icon: ShieldCheck,
        },
        {
          id: 'kyc',
          label: `KYC Verifications (${pendingKyc.length})`,
          Icon: FileCheck,
        },
        {
          id: 'support',
          label: `Support & Tickets (${unreadSupportChatsCount + openSupportTicketsCount})`,
          Icon: Headphones,
        },
        { id: 'clients', label: `Client Database (${allUsers.length})`, Icon: Users },
        { id: 'mentors', label: `Mentor Gifts (${mentorMultiplier}× Rule)`, Icon: Gift },
      ],
    },
    {
      heading: 'PLATFORM CONTROLS',
      items: [
        { id: 'modules-support', label: 'Module & Front Controls', Icon: Sliders },
        { id: 'announcements', label: 'Dashboard Notice Bar', Icon: Megaphone },
        { id: 'packages', label: 'Packages & Commissions', Icon: Settings },
        { id: 'forex-copy', label: 'Forex Tiers & Copy Trade', Icon: Globe },
        { id: 'coin-ads-mining', label: 'Banner Ads & Coin Mining', Icon: Sparkles },
        { id: 'marketing-cards', label: 'Marketing Cards', Icon: ImageIcon },
        { id: 'how-it-works', label: 'How It Works & Video', Icon: Film },
        { id: 'leaderboard', label: 'Top Leaderboard', Icon: Trophy },
        { id: 'web3-payments', label: 'Web3 Payments & Security', Icon: Zap },
        { id: 'wallets-meme', label: 'Addresses & Meme Coin', Icon: Coins },
        { id: 'company', label: 'Company & Trust Ratings', Icon: Shield },
      ],
    },
    {
      heading: 'SECURITY, LOGS & APIS',
      items: [
        { id: 'email-api', label: 'Integration & Notifications', Icon: Mail },
        { id: 'audit', label: 'Audit Logs & Backup', Icon: Activity },
      ],
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
            <AlphatradexLogo3D
              variant="mark"
              size="sm"
              companyName={draftConfig.companyName || 'Alphatradex'}
            />
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
            <button
              type="button"
              onClick={() => setTab('kyc')}
              className="bg-white border border-slate-200 hover:border-orange-300 rounded-xl p-4 text-left transition-colors"
            >
              <div className="text-xs text-slate-500">Pending KYC Reviews</div>
              <div className="font-mono font-bold text-2xl text-orange-600 tabular-nums mt-1">
                {pendingKyc.length}
              </div>
            </button>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Pending Capital Withdrawals</div>
              <div className="font-mono font-bold text-2xl text-red-600 tabular-nums mt-1">
                {pendingCapitalWd.length}
              </div>
            </div>
          </section>

          {/* TAB 0: OVERVIEW & GLOBAL KILL SWITCHES */}
          {tab === 'overview' && (
            <section className="space-y-6">
              {/* Financial & Platform Telemetry KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-xs text-slate-500">Total Deposit Wallets</div>
                  <div className="font-mono font-bold text-xl text-slate-900 tabular-nums mt-1">
                    ${totalVaultLiquidity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">Client USD vault liquidity</div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-xs text-slate-500">Total Income Wallets</div>
                  <div className="font-mono font-bold text-xl text-emerald-700 tabular-nums mt-1">
                    ${totalIncomeLiquidity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">Unclaimed profit &amp; commissions</div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-xs text-slate-500">Total Capital Invested</div>
                  <div className="font-mono font-bold text-xl text-sky-700 tabular-nums mt-1">
                    ${totalInvestedAll.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">{activeInvestmentsCount} active AI packages</div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-xs text-slate-500">Total Withdrawn</div>
                  <div className="font-mono font-bold text-xl text-orange-600 tabular-nums mt-1">
                    ${totalWithdrawnAll.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Approved KYC: {approvedKycCount}/{allUsers.length} · Suspended: {suspendedCount}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-xs text-slate-500">Open Forex Trades</div>
                  <div className="font-mono font-bold text-lg text-slate-900 tabular-nums mt-1">
                    {openForexCount} <span className="text-xs font-normal text-slate-400">/ {allForexTrades.length} total</span>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-xs text-slate-500">Active Copy Subscriptions</div>
                  <div className="font-mono font-bold text-lg text-slate-900 tabular-nums mt-1">
                    {activeCopyCount} <span className="text-xs font-normal text-slate-400">/ {allCopySubs.length} total</span>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-xs text-slate-500">Coin Mining Stakes</div>
                  <div className="font-mono font-bold text-lg text-slate-900 tabular-nums mt-1">
                    {allCoinStakes.filter((s) => s.status === 'active').length}{' '}
                    <span className="text-xs font-normal text-slate-400">active</span>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-xs text-slate-500">Admin Audit Entries</div>
                  <div className="font-mono font-bold text-lg text-slate-900 tabular-nums mt-1">
                    {allAdminLogs.length}
                  </div>
                </div>
              </div>

              {/* Revenue & Cashflow Analytics (Daily 14D / Weekly 8W) */}
              <AdminCashflowAnalyticsCard
                deposits={allDeposits}
                withdrawals={allWithdrawals}
              />

              {/* 1-Click Global Kill Switches */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display font-bold text-slate-900 text-base flex items-center gap-2">
                      <Power className="w-4 h-4 text-red-600" />
                      1-Click Global Emergency Kill Switches
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Toggle critical operations instantly across all client sessions and public sign-up flows.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    {
                      key: 'globalPaused' as const,
                      title: 'AI Trading & Plans',
                      desc: 'Pauses new package activations, mining & forex opens.',
                      paused: Boolean(draftConfig.globalPaused),
                    },
                    {
                      key: 'withdrawalsPaused' as const,
                      title: 'Withdrawals Gate',
                      desc: 'Stops instant profit & manual capital withdrawal requests.',
                      paused: Boolean(draftConfig.withdrawalsPaused),
                    },
                    {
                      key: 'signupsPaused' as const,
                      title: 'New Sign-Ups',
                      desc: 'Halts new client registrations on the Front Page.',
                      paused: Boolean(draftConfig.signupsPaused),
                    },
                    {
                      key: 'p2pPaused' as const,
                      title: 'P2P Transfers',
                      desc: 'Freezes internal user-to-user USD wallet transfers.',
                      paused: Boolean(draftConfig.p2pPaused),
                    },
                  ].map((sw) => (
                    <div
                      key={sw.key}
                      className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                        sw.paused
                          ? 'bg-red-50/70 border-red-200'
                          : 'bg-emerald-50/40 border-emerald-200'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-xs text-slate-900">{sw.title}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              sw.paused ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
                            }`}
                          >
                            {sw.paused ? 'PAUSED' : 'LIVE'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1.5">{sw.desc}</p>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          const next = { ...draftConfig, [sw.key]: !sw.paused };
                          setDraftConfig(next);
                          handleSaveConfig(next);
                        }}
                        className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                          sw.paused
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : 'bg-red-600 hover:bg-red-500 text-white'
                        }`}
                      >
                        {sw.paused ? 'Resume Now' : 'Pause Now'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Jump Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                  type="button"
                  onClick={() => setTab('approvals')}
                  className="bg-white border border-slate-200 hover:border-orange-400 rounded-xl p-4 text-left transition-colors"
                >
                  <div className="text-xs font-semibold text-orange-600">Approvals Queue →</div>
                  <div className="text-sm font-bold text-slate-900 mt-1">
                    {pendingDeposits.length} Deposits · {pendingKyc.length} KYC · {pendingCapitalWd.length} Payouts
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setTab('clients')}
                  className="bg-white border border-slate-200 hover:border-orange-400 rounded-xl p-4 text-left transition-colors"
                >
                  <div className="text-xs font-semibold text-sky-600">Client Controls →</div>
                  <div className="text-sm font-bold text-slate-900 mt-1">
                    Balance Credit/Debit &amp; Freeze Accounts
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setTab('modules-support')}
                  className="bg-white border border-slate-200 hover:border-orange-400 rounded-xl p-4 text-left transition-colors"
                >
                  <div className="text-xs font-semibold text-emerald-600">Module &amp; Support →</div>
                  <div className="text-sm font-bold text-slate-900 mt-1">
                    Toggle Trading Pages &amp; Support Links
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setTab('support')}
                  className="bg-white border border-slate-200 hover:border-orange-400 rounded-xl p-4 text-left transition-colors"
                >
                  <div className="text-xs font-semibold text-amber-600">Live Support &amp; Tickets →</div>
                  <div className="text-sm font-bold text-slate-900 mt-1">
                    {unreadSupportChatsCount} Unread Chats · {openSupportTicketsCount} Open Tickets
                  </div>
                </button>
              </div>
            </section>
          )}

          {/* TAB: DEDICATED GLOBAL KYC VERIFICATIONS & POLICY MANAGER */}
          {tab === 'kyc' && (
            <AdminKycManagement
              allUsers={allUsers}
              allAdminLogs={allAdminLogs}
              draftConfig={draftConfig}
              setDraftConfig={setDraftConfig}
              onSaveConfig={() => handleSaveConfig(draftConfig)}
              onApproveKyc={approveKyc}
              onRejectKyc={rejectKyc}
              onRequestResubmission={requestKycResubmission}
              onBulkApproveKyc={bulkApproveKyc}
              busy={busy}
            />
          )}

          {/* TAB: LIVE SUPPORT CHAT, COMPLAINT TICKETS & GOOGLE CHAT SYNC */}
          {tab === 'support' && (
            <AdminSupportCenter
              chatThreads={allSupportChats}
              tickets={allSupportTickets}
              onNotify={notify}
            />
          )}

          {/* TAB: MARKETING PHOTO CARD TEMPLATES & ANALYTICS */}
          {tab === 'marketing-cards' && (
            <AdminMarketingCardsPanel
              draftConfig={draftConfig}
              setDraftConfig={setDraftConfig}
              marketingCardStats={marketingCardStats}
              onSaveConfig={handleSaveConfig}
              busy={busy}
              onNotify={notify}
            />
          )}

          {/* TAB: HOW IT WORKS & MOTION VIDEO GUIDE STUDIO */}
          {tab === 'how-it-works' && (
            <AdminHowItWorksPanel
              draftConfig={draftConfig}
              setDraftConfig={setDraftConfig}
              onSaveConfig={handleSaveConfig}
              busy={busy}
              onNotify={notify}
            />
          )}

          {/* TAB: TOP PERFORMERS LEADERBOARD CONTROL */}
          {tab === 'leaderboard' && (
            <AdminLeaderboardPanel
              draftConfig={draftConfig}
              setDraftConfig={setDraftConfig}
              allUsers={allUsers}
              allMlm={allMlm}
              allForexTrades={allForexTrades}
              allInvestments={allInvestments}
              onSaveConfig={handleSaveConfig}
              busy={busy}
              onNotify={notify}
            />
          )}

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

              {/* Pending KYC with Bulk Selection & Bulk Verify Phone */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-display font-bold text-slate-900 text-base">
                    Pending KYC Identity Submissions ({pendingKyc.length})
                  </h2>
                  {pendingKyc.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={
                            pendingKyc.length > 0 &&
                            pendingKyc.every((u) => selectedKycUids.includes(u.uid))
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedKycUids(pendingKyc.map((u) => u.uid));
                            } else {
                              setSelectedKycUids([]);
                            }
                          }}
                        />
                        <span>Select All ({selectedKycUids.length})</span>
                      </label>
                      <button
                        type="button"
                        disabled={busy || selectedKycUids.length === 0}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const count = await bulkApproveKyc(selectedKycUids);
                            setSelectedKycUids([]);
                            notify('ok', `Bulk approved KYC for ${count} client(s).`);
                          } catch (err) {
                            notify('err', formatUiError(err));
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        Bulk Approve KYC
                      </button>
                      <button
                        type="button"
                        disabled={busy || selectedKycUids.length === 0}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const count = await bulkVerifyPhones(selectedKycUids);
                            notify('ok', `Marked phone verified for ${count} selected client(s).`);
                          } catch (err) {
                            notify('err', formatUiError(err));
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold"
                      >
                        Bulk Verify Phones
                      </button>
                    </div>
                  )}
                </div>
                {pendingKyc.length === 0 ? (
                  <p className="text-xs text-slate-500">No pending KYC submissions.</p>
                ) : (
                  <div className="space-y-3">
                    {pendingKyc.map((u) => {
                      const checked = selectedKycUids.includes(u.uid);
                      return (
                        <div
                          key={u.uid}
                          className="p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs"
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setSelectedKycUids((prev) =>
                                  e.target.checked
                                    ? [...prev, u.uid]
                                    : prev.filter((id) => id !== u.uid)
                                );
                              }}
                              className="mt-1"
                              aria-label={`Select ${u.fullName}`}
                            />
                            <div>
                              <div className="font-semibold text-slate-900 text-sm">
                                {u.fullName} ({u.handle})
                              </div>
                              <div className="text-slate-500">
                                {u.email} · {u.idType}: <span className="font-mono text-slate-800">{u.idNumber}</span>
                              </div>
                              {u.phoneNumber && (
                                <div className="text-[11px] font-mono text-slate-600 mt-0.5">
                                  {u.countryName || u.countryCode || 'Phone'}: {u.phoneNumber}{' '}
                                  <span
                                    className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                      u.phoneVerified
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    {u.phoneVerified ? 'Phone Verified' : 'Phone Pending'}
                                  </span>
                                </div>
                              )}
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
                                  setSelectedKycUids((prev) => prev.filter((id) => id !== u.uid));
                                  notify('ok', `KYC approved for ${u.fullName}.`);
                                } catch (err) {
                                  notify('err', formatUiError(err));
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
                                  setSelectedKycUids((prev) => prev.filter((id) => id !== u.uid));
                                  notify('ok', `KYC rejected for ${u.fullName}.`);
                                } catch (err) {
                                  notify('err', formatUiError(err));
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
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Filterable Withdrawals & TXID / Payout Note Control */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display font-bold text-slate-900 text-base">
                      Withdrawals &amp; Payout TXID Control ({filteredWithdrawals.length})
                    </h2>
                    <p className="text-xs text-slate-500">
                      Filter instant &amp; manual capital withdrawals, attach payout TXIDs/notes, and approve or reject requests.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {(['pending', 'approved', 'completed', 'rejected', 'all'] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setWdStatusFilter(f)}
                        className={`px-3 py-1.5 rounded-lg font-semibold capitalize border ${
                          wdStatusFilter === f
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {f} (
                        {f === 'all'
                          ? allWithdrawals.length
                          : allWithdrawals.filter((w) => w.status === f).length}
                        )
                      </button>
                    ))}
                  </div>
                </div>
                {filteredWithdrawals.length === 0 ? (
                  <p className="text-xs text-slate-500">No withdrawals match the selected status filter.</p>
                ) : (
                  <div className="space-y-3">
                    {filteredWithdrawals.map((w) => {
                      const noteValue = wdNoteDrafts[w.id] ?? (w.adminNote || '');
                      const txHashValue = wdTxHashDrafts[w.id] ?? (w.payoutTxHash || '');
                      const wdUser = allUsers.find((u) => u.uid === w.uid);
                      const feeUsd = typeof w.feeUsd === 'number' ? w.feeUsd : 0;
                      const netPayoutUsd =
                        typeof w.netPayoutUsd === 'number'
                          ? w.netPayoutUsd
                          : Math.max(0, w.amountUsd - feeUsd);

                      const riskFlags: { label: string; tone: 'rose' | 'amber' | 'emerald' }[] = [];
                      if (wdUser?.suspended) {
                        riskFlags.push({ label: 'ACCOUNT SUSPENDED', tone: 'rose' });
                      }
                      if (wdUser && wdUser.kycStatus !== 'approved') {
                        riskFlags.push({
                          label: `KYC ${wdUser.kycStatus.toUpperCase()}`,
                          tone: 'amber',
                        });
                      }
                      if (w.amountUsd >= 500) {
                        riskFlags.push({ label: 'LARGE PAYOUT >= $500', tone: 'amber' });
                      }
                      if (
                        wdUser &&
                        wdUser.totalInvested > 0 &&
                        wdUser.totalWithdrawn + w.amountUsd > wdUser.totalInvested * 2
                      ) {
                        riskFlags.push({ label: 'HIGH PAYOUT RATIO', tone: 'amber' });
                      }
                      if (
                        (w.network.includes('BEP20') ||
                          w.network.includes('POLYGON') ||
                          w.network.includes('ERC20')) &&
                        !/^0x[a-fA-F0-9]{40}$/.test((w.destinationAddress || '').trim())
                      ) {
                        riskFlags.push({ label: 'CHECK EVM ADDRESS FORMAT', tone: 'rose' });
                      }
                      if (w.twoFactorVerified) {
                        riskFlags.push({ label: '2FA OTP VERIFIED', tone: 'emerald' });
                      }

                      return (
                        <div
                          key={w.id}
                          className="p-4 rounded-xl border border-slate-200 space-y-3 text-xs"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1.5 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-slate-900 text-sm">
                                  {w.type === 'manual_capital'
                                    ? `Manual Capital · Package #${w.packageNumber}`
                                    : w.source === 'mentor_profit'
                                    ? 'Mentor Profit Payout'
                                    : w.source === 'mlm_commission'
                                    ? 'Referral Commission Payout'
                                    : 'Trading Profit Payout'}{' '}
                                  · {w.userName}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    w.status === 'pending'
                                      ? 'bg-amber-100 text-amber-800'
                                      : w.status === 'rejected'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {w.status === 'approved' || w.status === 'completed'
                                    ? 'Paid / Processed'
                                    : w.status}
                                </span>
                                {wdUser && (
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                                      wdUser.kycStatus === 'approved'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-slate-100 text-slate-700'
                                    }`}
                                  >
                                    KYC: {wdUser.kycStatus}
                                  </span>
                                )}
                              </div>

                              {/* Automated Risk Flags */}
                              {riskFlags.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {riskFlags.map((flag) => (
                                    <span
                                      key={flag.label}
                                      className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                                        flag.tone === 'rose'
                                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                          : flag.tone === 'amber'
                                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                      }`}
                                    >
                                      {flag.label}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Fee & Payout Summary */}
                              <div className="text-slate-700 font-mono flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span>
                                  Gross: <strong className="text-slate-900 tabular-nums">${w.amountUsd.toFixed(2)}</strong>
                                </span>
                                <span>
                                  Fee: <strong className="text-amber-700 tabular-nums">${feeUsd.toFixed(2)}</strong>
                                </span>
                                <span>
                                  Net Send:{' '}
                                  <strong className="text-emerald-700 tabular-nums">${netPayoutUsd.toFixed(2)}</strong>
                                </span>
                                <span>· {w.network.replace(/_/g, ' ')}</span>
                                {w.type === 'manual_capital' && (
                                  <span>
                                    · Principal: ${w.principalCapital.toFixed(2)} · Profit Gen: $
                                    {w.totalProfitGenerated.toFixed(2)}
                                  </span>
                                )}
                              </div>

                              {/* Destination Wallet Address */}
                              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                                <span className="text-slate-500">Dest Wallet:</span>
                                <span className="text-slate-900 break-all select-all">
                                  {w.destinationAddress}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard?.writeText(w.destinationAddress).catch(() => {});
                                    notify('ok', 'Copied destination wallet address.');
                                  }}
                                  className="text-sky-700 hover:text-sky-900 inline-flex items-center gap-1 font-sans font-semibold ml-auto"
                                >
                                  <Copy className="w-3 h-3" />
                                  <span>Copy</span>
                                </button>
                              </div>

                              {/* User Balance History Snapshot */}
                              {wdUser && (
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-slate-500">
                                  <span>
                                    User: <strong className="text-slate-700">{wdUser.email}</strong>
                                  </span>
                                  <span>
                                    Dep Bal: <strong className="text-slate-800">${wdUser.usdBalance.toFixed(2)}</strong>
                                  </span>
                                  <span>
                                    Inc Bal: <strong className="text-emerald-700">${wdUser.profitBalance.toFixed(2)}</strong>
                                  </span>
                                  <span>
                                    Invested: <strong className="text-slate-800">${wdUser.totalInvested.toFixed(2)}</strong>
                                  </span>
                                  <span>
                                    Withdrawn: <strong className="text-orange-700">${wdUser.totalWithdrawn.toFixed(2)}</strong>
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              {w.type === 'manual_capital' && (
                                <button
                                  type="button"
                                  onClick={() => setBreakdownModalWd(w)}
                                  className="px-3 py-1.5 rounded border border-slate-300 font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  Breakdown
                                </button>
                              )}
                              {w.status === 'pending' && (
                                <>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={async () => {
                                      setBusy(true);
                                      try {
                                        await approveCapitalWithdrawal(
                                          w,
                                          noteValue.trim() || undefined,
                                          txHashValue.trim() || undefined
                                        );
                                        notify(
                                          'ok',
                                          w.type === 'manual_capital'
                                            ? `Approved capital withdrawal for Package #${w.packageNumber}.`
                                            : `Approved & marked $${netPayoutUsd.toFixed(2)} net payout for ${w.userName} as Paid.`
                                        );
                                      } catch (err) {
                                        notify('err', formatUiError(err));
                                      } finally {
                                        setBusy(false);
                                      }
                                    }}
                                    className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                                  >
                                    Approve &amp; Mark Paid
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={async () => {
                                      setBusy(true);
                                      try {
                                        await rejectCapitalWithdrawal(
                                          w,
                                          noteValue.trim() ||
                                            (w.type === 'manual_capital'
                                              ? 'Capital lock review declined'
                                              : 'Payout request declined and refunded to Income Wallet')
                                        );
                                        notify(
                                          'ok',
                                          w.type === 'manual_capital'
                                            ? `Rejected capital withdrawal for Package #${w.packageNumber}.`
                                            : `Rejected $${w.amountUsd.toFixed(2)} payout and refunded Income Wallet.`
                                        );
                                      } catch (err) {
                                        notify('err', formatUiError(err));
                                      } finally {
                                        setBusy(false);
                                      }
                                    }}
                                    className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white font-semibold"
                                  >
                                    {w.type === 'manual_capital' ? 'Reject' : 'Reject & Refund Balance'}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Dedicated Payout TxHash & Settlement Note Controls */}
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 pt-2 border-t border-slate-100">
                            <input
                              type="text"
                              value={txHashValue}
                              onChange={(e) =>
                                setWdTxHashDrafts((prev) => ({ ...prev, [w.id]: e.target.value }))
                              }
                              placeholder={
                                platformConfig.web3PaymentConfig?.requirePayoutTxHashOnApprove
                                  ? 'Required: Blockchain Payout txHash (0x... or TRON hash)'
                                  : 'Optional: Blockchain Payout txHash (0x... or TRON hash)'
                              }
                              className="md:col-span-5 px-3 py-1.5 rounded-lg border border-slate-300 font-mono text-xs"
                            />
                            <input
                              type="text"
                              value={noteValue}
                              onChange={(e) =>
                                setWdNoteDrafts((prev) => ({ ...prev, [w.id]: e.target.value }))
                              }
                              placeholder="Admin settlement note or rejection reason..."
                              className="md:col-span-5 px-3 py-1.5 rounded-lg border border-slate-200 font-mono text-xs"
                            />
                            <button
                              type="button"
                              disabled={busy}
                              onClick={async () => {
                                setBusy(true);
                                try {
                                  await updateWithdrawalNote(
                                    w.id,
                                    noteValue,
                                    txHashValue.trim() || undefined
                                  );
                                  notify('ok', 'Saved payout txHash & admin note.');
                                } catch (err) {
                                  notify('err', formatUiError(err));
                                } finally {
                                  setBusy(false);
                                }
                              }}
                              className="md:col-span-2 px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold whitespace-nowrap"
                            >
                              Save TxHash
                            </button>
                          </div>

                          {(w.payoutTxHash || w.reviewedByEmail) && (
                            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-500 pt-1">
                              {w.payoutTxHash && (
                                <span className="inline-flex items-center gap-1.5">
                                  <span>Recorded Payout Tx:</span>
                                  <strong className="text-emerald-700">{w.payoutTxHash}</strong>
                                  {w.payoutTxHash.startsWith('0x') && (
                                    <a
                                      href={
                                        w.network.includes('POLYGON')
                                          ? `https://polygonscan.com/tx/${w.payoutTxHash}`
                                          : `https://bscscan.com/tx/${w.payoutTxHash}`
                                      }
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sky-700 hover:underline inline-flex items-center gap-0.5"
                                    >
                                      <span>Explorer</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </span>
                              )}
                              {w.reviewedByEmail && (
                                <span>Reviewed by: {w.reviewedByEmail}</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
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

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-11 gap-2.5 text-center">
                {[
                  { label: 'users', count: allUsers.length },
                  { label: 'investments', count: allInvestments.length },
                  { label: 'forexTrades', count: allForexTrades.length },
                  { label: 'copySubs', count: allCopySubs.length },
                  { label: 'coinStakes', count: allCoinStakes.length },
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
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-900">{u.fullName}</span>
                              {u.suspended && (
                                <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[9px] font-bold uppercase">
                                  SUSPENDED
                                </span>
                              )}
                            </div>
                            <div className="text-slate-500">{u.email}</div>
                            {u.phoneNumber && (
                              <div className="text-[11px] font-mono text-slate-600 mt-0.5 flex items-center gap-1.5">
                                <span>{u.countryName ? `${u.countryName} ` : ''}{u.phoneNumber}</span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                                    u.phoneVerified
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {u.phoneVerified ? 'VERIFIED' : 'PENDING'}
                                </span>
                              </div>
                            )}
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
                              onClick={() => {
                                setManageClient(u);
                                setManageClientSubTab('controls');
                                setSuspendReasonDraft(u.suspensionReason || '');
                                setBalAmount('');
                                setBalReason('');
                              }}
                              className="px-2.5 py-1 rounded bg-slate-900 text-white font-semibold hover:bg-slate-800"
                            >
                              Manage
                            </button>
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
                                  } catch (err) {
                                    notify('err', formatUiError(err));
                                  } finally {
                                    setBusy(false);
                                  }
                                }}
                                className="px-2.5 py-1 rounded bg-emerald-600 text-white font-semibold hover:bg-emerald-500"
                              >
                                Approve
                              </button>
                            )}
                            {u.phoneNumber && !u.phoneVerified && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={async () => {
                                  setBusy(true);
                                  try {
                                    await verifyUserPhone(u.uid, true);
                                    notify('ok', `Phone ${u.phoneNumber} marked verified for ${u.fullName}.`);
                                  } catch (err) {
                                    notify('err', formatUiError(err));
                                  } finally {
                                    setBusy(false);
                                  }
                                }}
                                className="px-2.5 py-1 rounded bg-sky-600 text-white font-semibold hover:bg-sky-500"
                              >
                                Verify Phone
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
                                  } catch (err) {
                                    notify('err', formatUiError(err));
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

          {/* TAB 2: MENTOR GIFTED ACCOUNTS & OVERRIDE COMMISSION */}
          {tab === 'mentors' && (
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h2 className="font-display font-bold text-slate-900 text-base">
                  Gift Mentor Account (Automatic {mentorMultiplier}× Volume Rule)
                </h2>
                <p className="text-xs text-slate-500">
                  Gifted capital accrues weekday profit immediately, while withdrawals unlock after referred team volume hits {mentorMultiplier}× Gifted Capital. Active mentors also earn a +{draftConfig.mentorConfig.mentorCommissionPercent}% override commission on direct L1 package activations. <strong className="text-slate-900">Normal clients never see any Mentor option</strong> — the dedicated Mentor Dashboard unlocks exclusively for accounts gifted here.
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
                          Number(mentorGiftAmount) * mentorMultiplier
                        ).toFixed(2)} (${mentorMultiplier}×) volume required).`
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
                    Required {mentorMultiplier}× Referred Volume:{' '}
                    <strong>${(Number(mentorGiftAmount || 0) * mentorMultiplier).toFixed(2)}</strong>
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
                  Active Mentor Accounts &amp; Volume Progress ({mentorUsers.length})
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
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded font-semibold ${
                                  unlocked ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                                }`}
                              >
                                {unlocked ? 'Volume Unlocked' : 'Locked'}
                              </span>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={async () => {
                                  setBusy(true);
                                  try {
                                    await revokeMentorAccess(m.uid);
                                    notify('ok', `Revoked Mentor access for ${m.fullName} (${m.handle}). Mentor options are now hidden from their account.`);
                                  } catch (err) {
                                    notify('err', (err as Error).message);
                                  } finally {
                                    setBusy(false);
                                  }
                                }}
                                className="px-2 py-0.5 rounded border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold transition-colors disabled:opacity-50"
                              >
                                Revoke Mentor
                              </button>
                            </div>
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

          {/* TAB 3: PACKAGES CRUD, INTEREST RATES, REFERRAL & MENTOR COMMISSIONS */}
          {tab === 'packages' && (
            <section className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display font-bold text-slate-900 text-lg">
                      Investment Packages, Interest Rates &amp; Withdrawal Rules
                    </h2>
                    <p className="text-xs text-slate-500">
                      Add, edit, or delete investment plans and adjust daily interest rates globally.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const nextIdx = draftConfig.packages.length + 1;
                        setDraftConfig({
                          ...draftConfig,
                          packages: [
                            ...draftConfig.packages,
                            {
                              id: `pkg_${Date.now().toString(36)}`,
                              name: `Custom Tier ${nextIdx}`,
                              capital: 2500,
                              dailyPercent: 3.5,
                              aiMode: 'AI Institutional Hybrid',
                              profitDays: draftConfig.totalProfitDays || 200,
                              capitalLockDays: 90,
                              description: 'Configurable institutional AI strategy package.',
                            },
                          ],
                        });
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5 text-orange-600" />
                      Add New Package
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleSaveConfig()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Save All Rules &amp; Rates
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Global Min Profit Withdrawal ($)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={draftConfig.minWithdrawalUsd}
                      onChange={(e) =>
                        setDraftConfig({ ...draftConfig, minWithdrawalUsd: Math.max(1, Number(e.target.value) || 1) })
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
                        setDraftConfig({ ...draftConfig, totalProfitDays: Math.max(1, Number(e.target.value) || 1) })
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
                        setDraftConfig({
                          ...draftConfig,
                          eliteCapitalLockDays: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  {draftConfig.packages.map((pkg, idx) => (
                    <div
                      key={pkg.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-slate-600">
                          ID: {pkg.id} · Daily Return: ${((pkg.capital * pkg.dailyPercent) / 100).toFixed(2)}/day
                        </span>
                        {draftConfig.packages.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setDraftConfig({
                                ...draftConfig,
                                packages: draftConfig.packages.filter((_, i) => i !== idx),
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
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
                            className="w-full px-3 py-1.5 rounded border border-slate-200 bg-white text-xs font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Capital ($)</label>
                          <input
                            type="number"
                            min={1}
                            value={pkg.capital}
                            onChange={(e) => {
                              const pkgs = [...draftConfig.packages];
                              pkgs[idx] = { ...pkg, capital: Math.max(1, Number(e.target.value) || 1) };
                              setDraftConfig({ ...draftConfig, packages: pkgs });
                            }}
                            className="w-full px-3 py-1.5 rounded border border-slate-200 bg-white text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Daily Interest (%)</label>
                          <input
                            type="number"
                            step="0.1"
                            min={0.1}
                            max={50}
                            value={pkg.dailyPercent}
                            onChange={(e) => {
                              const pkgs = [...draftConfig.packages];
                              pkgs[idx] = { ...pkg, dailyPercent: Math.max(0.1, Number(e.target.value) || 0.1) };
                              setDraftConfig({ ...draftConfig, packages: pkgs });
                            }}
                            className="w-full px-3 py-1.5 rounded border border-slate-200 bg-white text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">AI Mode</label>
                          <input
                            type="text"
                            value={pkg.aiMode}
                            onChange={(e) => {
                              const pkgs = [...draftConfig.packages];
                              pkgs[idx] = { ...pkg, aiMode: e.target.value };
                              setDraftConfig({ ...draftConfig, packages: pkgs });
                            }}
                            className="w-full px-3 py-1.5 rounded border border-slate-200 bg-white text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Profit Days</label>
                          <input
                            type="number"
                            min={1}
                            value={pkg.profitDays}
                            onChange={(e) => {
                              const pkgs = [...draftConfig.packages];
                              pkgs[idx] = { ...pkg, profitDays: Math.max(1, Number(e.target.value) || 1) };
                              setDraftConfig({ ...draftConfig, packages: pkgs });
                            }}
                            className="w-full px-3 py-1.5 rounded border border-slate-200 bg-white text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Capital Lock (d)</label>
                          <input
                            type="number"
                            min={0}
                            value={pkg.capitalLockDays}
                            onChange={(e) => {
                              const pkgs = [...draftConfig.packages];
                              pkgs[idx] = { ...pkg, capitalLockDays: Math.max(0, Number(e.target.value) || 0) };
                              setDraftConfig({ ...draftConfig, packages: pkgs });
                            }}
                            className="w-full px-3 py-1.5 rounded border border-slate-200 bg-white text-xs font-mono"
                          />
                        </div>
                        <div className="md:col-span-6">
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Description</label>
                          <input
                            type="text"
                            value={pkg.description}
                            onChange={(e) => {
                              const pkgs = [...draftConfig.packages];
                              pkgs[idx] = { ...pkg, description: e.target.value };
                              setDraftConfig({ ...draftConfig, packages: pkgs });
                            }}
                            className="w-full px-3 py-1.5 rounded border border-slate-200 bg-white text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Referral & Mentor Commission Controls */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-display font-bold text-slate-900 text-base">
                        Referral Commission Rates (All Plans)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Instant commission credited to upline Income Wallet on package activation.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleSaveConfig()}
                      className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shrink-0"
                    >
                      Save Rates
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Level 1 (%)</label>
                      <input
                        type="number"
                        step="0.5"
                        min={0}
                        max={50}
                        value={draftConfig.mlmRates.level1}
                        onChange={(e) =>
                          setDraftConfig({
                            ...draftConfig,
                            mlmRates: { ...draftConfig.mlmRates, level1: Math.max(0, Number(e.target.value) || 0) },
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Level 2 (%)</label>
                      <input
                        type="number"
                        step="0.5"
                        min={0}
                        max={50}
                        value={draftConfig.mlmRates.level2}
                        onChange={(e) =>
                          setDraftConfig({
                            ...draftConfig,
                            mlmRates: { ...draftConfig.mlmRates, level2: Math.max(0, Number(e.target.value) || 0) },
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Level 3 (%)</label>
                      <input
                        type="number"
                        step="0.5"
                        min={0}
                        max={50}
                        value={draftConfig.mlmRates.level3}
                        onChange={(e) =>
                          setDraftConfig({
                            ...draftConfig,
                            mlmRates: { ...draftConfig.mlmRates, level3: Math.max(0, Number(e.target.value) || 0) },
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-display font-bold text-slate-900 text-base">
                        Mentor Commission &amp; Volume Controls
                      </h3>
                      <p className="text-xs text-slate-500">
                        Extra override commission credited to active Mentors when their L1 downline activates a package.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setDraftConfig({
                          ...draftConfig,
                          mentorConfig: {
                            ...draftConfig.mentorConfig,
                            enabled: !draftConfig.mentorConfig.enabled,
                          },
                        })
                      }
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold shrink-0 ${
                        draftConfig.mentorConfig.enabled
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                          : 'border-slate-200 bg-slate-100 text-slate-600'
                      }`}
                    >
                      {draftConfig.mentorConfig.enabled ? 'Override ON' : 'Override OFF'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Mentor Bonus (%)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min={0}
                        max={50}
                        value={draftConfig.mentorConfig.mentorCommissionPercent}
                        onChange={(e) =>
                          setDraftConfig({
                            ...draftConfig,
                            mentorConfig: {
                              ...draftConfig.mentorConfig,
                              mentorCommissionPercent: Math.max(0, Number(e.target.value) || 0),
                            },
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Volume Rule (×)
                      </label>
                      <input
                        type="number"
                        step="1"
                        min={1}
                        max={20}
                        value={draftConfig.mentorConfig.volumeMultiplier}
                        onChange={(e) =>
                          setDraftConfig({
                            ...draftConfig,
                            mentorConfig: {
                              ...draftConfig.mentorConfig,
                              volumeMultiplier: Math.max(1, Number(e.target.value) || 4),
                            },
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Default Gift ($)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={draftConfig.mentorConfig.defaultGiftCapital}
                        onChange={(e) => {
                          const val = Math.max(1, Number(e.target.value) || 500);
                          setMentorGiftAmount(String(val));
                          setDraftConfig({
                            ...draftConfig,
                            mentorConfig: { ...draftConfig.mentorConfig, defaultGiftCapital: val },
                          });
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Default Daily (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min={0.1}
                        max={50}
                        value={draftConfig.mentorConfig.defaultDailyPercent}
                        onChange={(e) => {
                          const val = Math.max(0.1, Number(e.target.value) || 2.0);
                          setMentorDailyPct(String(val));
                          setDraftConfig({
                            ...draftConfig,
                            mentorConfig: { ...draftConfig.mentorConfig, defaultDailyPercent: val },
                          });
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>
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

          {/* TAB: BANNER ADS, PAID COIN MINING & FREE TAP-TO-MINE CONTROLS */}
          {tab === 'coin-ads-mining' && (
            <section className="space-y-6">
              {/* 1. Banner Ad Studio */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display font-bold text-slate-900 text-lg flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-orange-600" />
                      Banner Ad Manager (Alphatradex Coin Page &amp; Site-Wide)
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Run promotional banner ads on the Alphatradex Coin page or globally across all pages. Supports external links or in-page mining jump links (#coin-mining-desk).
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const newAd: BannerAdConfig = {
                          id: `ad_${Date.now().toString(36)}`,
                          enabled: true,
                          title: 'New Alphatradex ($ATX) Promotion',
                          subtitle: 'Stake or tap daily to grow your on-chain allocation.',
                          badgeText: 'Featured',
                          ctaText: 'Start Mining',
                          ctaUrl: '#coin-mining-desk',
                          imageUrl: '',
                          placement: 'coin_page',
                          theme: 'gold',
                        };
                        setDraftConfig({
                          ...draftConfig,
                          bannerAds: [...(draftConfig.bannerAds || []), newAd],
                        });
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5 text-orange-600" />
                      Add Banner Ad
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleSaveConfig()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Publish Ads &amp; Mining Settings
                    </button>
                  </div>
                </div>

                {(draftConfig.bannerAds || []).length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center border border-dashed border-slate-200 rounded-xl">
                    No banner ads configured yet. Click &ldquo;Add Banner Ad&rdquo; to launch a campaign.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {(draftConfig.bannerAds || []).map((ad, idx) => {
                      const updateAd = (patch: Partial<BannerAdConfig>) => {
                        const list = [...(draftConfig.bannerAds || [])];
                        list[idx] = { ...ad, ...patch };
                        setDraftConfig({ ...draftConfig, bannerAds: list });
                      };
                      return (
                        <div key={ad.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-slate-700">{ad.id}</span>
                              <button
                                type="button"
                                onClick={() => updateAd({ enabled: !ad.enabled })}
                                className={`px-2.5 py-0.5 rounded text-[11px] font-semibold ${
                                  ad.enabled
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-slate-200 text-slate-600'
                                }`}
                              >
                                {ad.enabled ? 'ACTIVE' : 'PAUSED'}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setDraftConfig({
                                  ...draftConfig,
                                  bannerAds: (draftConfig.bannerAds || []).filter((_, i) => i !== idx),
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Remove
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                            <div className="md:col-span-5">
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Banner Title</label>
                              <input
                                type="text"
                                value={ad.title}
                                onChange={(e) => updateAd({ title: e.target.value })}
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                              />
                            </div>
                            <div className="md:col-span-3">
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Badge Tag</label>
                              <input
                                type="text"
                                value={ad.badgeText}
                                onChange={(e) => updateAd({ badgeText: e.target.value })}
                                placeholder="Sponsored Highlight"
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Placement</label>
                              <select
                                value={ad.placement}
                                onChange={(e) => updateAd({ placement: e.target.value as BannerAdPlacement })}
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                              >
                                <option value="coin_page">Coin Page Only</option>
                                <option value="all_pages">All Pages (Top Strip)</option>
                              </select>
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Theme</label>
                              <select
                                value={ad.theme}
                                onChange={(e) => updateAd({ theme: e.target.value as BannerAdTheme })}
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                              >
                                <option value="gold">Gold / Amber</option>
                                <option value="emerald">Emerald</option>
                                <option value="sky">Sky / Navy</option>
                                <option value="crimson">Crimson</option>
                              </select>
                            </div>
                            <div className="md:col-span-12">
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Subtitle / Ad Copy</label>
                              <input
                                type="text"
                                value={ad.subtitle}
                                onChange={(e) => updateAd({ subtitle: e.target.value })}
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                              />
                            </div>
                            <div className="md:col-span-3">
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Button Label</label>
                              <input
                                type="text"
                                value={ad.ctaText}
                                onChange={(e) => updateAd({ ctaText: e.target.value })}
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                              />
                            </div>
                            <div className="md:col-span-4">
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Button URL or #coin-mining-desk
                              </label>
                              <input
                                type="text"
                                value={ad.ctaUrl}
                                onChange={(e) => updateAd({ ctaUrl: e.target.value })}
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs"
                              />
                            </div>
                            <div className="md:col-span-5">
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Optional Banner Image URL (HTTPS)
                              </label>
                              <input
                                type="text"
                                value={ad.imageUrl}
                                onChange={(e) => updateAd({ imageUrl: e.target.value })}
                                placeholder="https://..."
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {(draftConfig.bannerAds || []).some((b) => b.enabled) && (
                  <div className="pt-2 border-t border-slate-200 space-y-2">
                    <div className="text-xs font-semibold text-slate-600">Live Ad Preview:</div>
                    <BannerAdSlot bannerAds={draftConfig.bannerAds} placement="coin_page" />
                    <BannerAdSlot bannerAds={draftConfig.bannerAds} placement="all_pages" compact />
                  </div>
                )}
              </div>

              {/* 2. Free Tap-to-Mine (Hamster Style) + System Toggles */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display font-bold text-slate-900 text-base">
                      Free Tap-to-Mine Controls &amp; Mining Feature Toggles
                    </h2>
                    <p className="text-xs text-slate-500">
                      Control reward per tap, USD conversion value per mined coin, energy bar limits, and daily caps.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setDraftConfig({
                          ...draftConfig,
                          coinMiningSettings: {
                            ...draftConfig.coinMiningSettings,
                            tapToMineEnabled: !draftConfig.coinMiningSettings.tapToMineEnabled,
                          },
                        })
                      }
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                        draftConfig.coinMiningSettings.tapToMineEnabled
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                          : 'border-slate-200 bg-slate-100 text-slate-600'
                      }`}
                    >
                      Tap-to-Mine: {draftConfig.coinMiningSettings.tapToMineEnabled ? 'ON' : 'OFF'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDraftConfig({
                          ...draftConfig,
                          coinMiningSettings: {
                            ...draftConfig.coinMiningSettings,
                            paidMiningEnabled: !draftConfig.coinMiningSettings.paidMiningEnabled,
                          },
                        })
                      }
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                        draftConfig.coinMiningSettings.paidMiningEnabled
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                          : 'border-slate-200 bg-slate-100 text-slate-600'
                      }`}
                    >
                      Paid Mining Rigs: {draftConfig.coinMiningSettings.paidMiningEnabled ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Coins / Tap</label>
                    <input
                      type="number"
                      step="0.5"
                      min={0.1}
                      value={draftConfig.coinMiningSettings.tapRewardCoins}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          coinMiningSettings: {
                            ...draftConfig.coinMiningSettings,
                            tapRewardCoins: Math.max(0.1, Number(e.target.value) || 1),
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">USD / Coin</label>
                    <input
                      type="number"
                      step="0.0001"
                      min={0}
                      value={draftConfig.coinMiningSettings.tapUsdPerCoin}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          coinMiningSettings: {
                            ...draftConfig.coinMiningSettings,
                            tapUsdPerCoin: Math.max(0, Number(e.target.value) || 0),
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Max Energy</label>
                    <input
                      type="number"
                      min={10}
                      value={draftConfig.coinMiningSettings.maxEnergy}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          coinMiningSettings: {
                            ...draftConfig.coinMiningSettings,
                            maxEnergy: Math.max(10, Number(e.target.value) || 500),
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Energy / Tap</label>
                    <input
                      type="number"
                      min={1}
                      value={draftConfig.coinMiningSettings.energyCostPerTap}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          coinMiningSettings: {
                            ...draftConfig.coinMiningSettings,
                            energyCostPerTap: Math.max(1, Number(e.target.value) || 1),
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Regen / Sec</label>
                    <input
                      type="number"
                      step="0.5"
                      min={0}
                      value={draftConfig.coinMiningSettings.energyRegenPerSec}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          coinMiningSettings: {
                            ...draftConfig.coinMiningSettings,
                            energyRegenPerSec: Math.max(0, Number(e.target.value) || 0),
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Daily Cap (Coins)</label>
                    <input
                      type="number"
                      min={1}
                      value={draftConfig.coinMiningSettings.dailyTapLimitCoins}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          coinMiningSettings: {
                            ...draftConfig.coinMiningSettings,
                            dailyTapLimitCoins: Math.max(1, Number(e.target.value) || 2500),
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Paid Coin Mining Rigs CRUD */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display font-bold text-slate-900 text-base flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-orange-600" />
                      Paid Coin Mining Rigs (Daily Interest Plans)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Configure USD stake ranges, daily interest rates (%), contract durations, and bonus coins.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const newRig: CoinMiningPlan = {
                          id: `rig_${Date.now().toString(36)}`,
                          name: `ASIC Cluster Tier ${(draftConfig.coinMiningPlans || []).length + 1}`,
                          minUsd: 100,
                          maxUsd: 5000,
                          dailyInterestPercent: 1.8,
                          durationDays: 30,
                          hashRateLabel: '320 TH/s',
                          coinBonusPerUsd: 30,
                          enabled: true,
                        };
                        setDraftConfig({
                          ...draftConfig,
                          coinMiningPlans: [...(draftConfig.coinMiningPlans || []), newRig],
                        });
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5 text-orange-600" />
                      Add Mining Rig
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleSaveConfig()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Save Mining Rigs
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {(draftConfig.coinMiningPlans || []).map((plan, idx) => {
                    const updatePlan = (patch: Partial<CoinMiningPlan>) => {
                      const list = [...(draftConfig.coinMiningPlans || [])];
                      list[idx] = { ...plan, ...patch };
                      setDraftConfig({ ...draftConfig, coinMiningPlans: list });
                    };
                    return (
                      <div key={plan.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-700">{plan.id}</span>
                            <button
                              type="button"
                              onClick={() => updatePlan({ enabled: !plan.enabled })}
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                plan.enabled
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {plan.enabled ? 'ENABLED' : 'DISABLED'}
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setDraftConfig({
                                ...draftConfig,
                                coinMiningPlans: (draftConfig.coinMiningPlans || []).filter((_, i) => i !== idx),
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
                          <div className="col-span-2 md:col-span-2">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Rig Name</label>
                            <input
                              type="text"
                              value={plan.name}
                              onChange={(e) => updatePlan({ name: e.target.value })}
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Min ($)</label>
                            <input
                              type="number"
                              min={1}
                              value={plan.minUsd}
                              onChange={(e) => updatePlan({ minUsd: Math.max(1, Number(e.target.value) || 1) })}
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Max ($)</label>
                            <input
                              type="number"
                              min={1}
                              value={plan.maxUsd}
                              onChange={(e) => updatePlan({ maxUsd: Math.max(1, Number(e.target.value) || 1) })}
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Daily (%)</label>
                            <input
                              type="number"
                              step="0.1"
                              min={0.1}
                              max={50}
                              value={plan.dailyInterestPercent}
                              onChange={(e) =>
                                updatePlan({ dailyInterestPercent: Math.max(0.1, Number(e.target.value) || 0.1) })
                              }
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Days</label>
                            <input
                              type="number"
                              min={1}
                              value={plan.durationDays}
                              onChange={(e) => updatePlan({ durationDays: Math.max(1, Number(e.target.value) || 1) })}
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Bonus ATX/$</label>
                            <input
                              type="number"
                              min={0}
                              value={plan.coinBonusPerUsd}
                              onChange={(e) =>
                                updatePlan({ coinBonusPerUsd: Math.max(0, Number(e.target.value) || 0) })
                              }
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs"
                            />
                          </div>
                          <div className="col-span-2 md:col-span-7">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Hashrate Label</label>
                            <input
                              type="text"
                              value={plan.hashRateLabel}
                              onChange={(e) => updatePlan({ hashRateLabel: e.target.value })}
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* TAB: FOREX WEBTERMINAL, 3 EXNESS ACCOUNT TIERS & COPY TRADE PROVIDERS */}
          {tab === 'forex-copy' && (() => {
            const fxCfg: ForexPlatformConfig =
              draftConfig.forexConfig || DEFAULT_PLATFORM_CONFIG.forexConfig!;
            const setFxCfg = (patch: Partial<ForexPlatformConfig>) =>
              setDraftConfig({
                ...draftConfig,
                forexConfig: { ...fxCfg, ...patch },
              });

            return (
              <section className="space-y-6">
                {/* 1. Feature Toggles & 3 Exness Account Categories */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display font-bold text-slate-900 text-lg flex items-center gap-2">
                        <Globe className="w-5 h-5 text-orange-600" />
                        Forex WebTerminal &amp; 3 Exness-Style Account Categories
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Configure per-lot commissions, spread multipliers, minimum vault deposits, and leverage for Standard, Pro, and Raw Spread accounts.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setFxCfg({ tradingEnabled: !fxCfg.tradingEnabled })}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                          fxCfg.tradingEnabled
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                            : 'border-slate-200 bg-slate-100 text-slate-600'
                        }`}
                      >
                        WebTerminal: {fxCfg.tradingEnabled ? 'ON' : 'OFF'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFxCfg({ copyTradingEnabled: !fxCfg.copyTradingEnabled })}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                          fxCfg.copyTradingEnabled
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                            : 'border-slate-200 bg-slate-100 text-slate-600'
                        }`}
                      >
                        Copy Trade: {fxCfg.copyTradingEnabled ? 'ON' : 'OFF'}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleSaveConfig()}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Publish Forex &amp; Copy Config
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {fxCfg.accountTiers.map((tier, idx) => {
                      const updateTier = (patch: Partial<ForexAccountTierConfig>) => {
                        const list = [...fxCfg.accountTiers];
                        list[idx] = { ...tier, ...patch };
                        setFxCfg({ accountTiers: list });
                      };
                      return (
                        <div
                          key={tier.id}
                          className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold uppercase text-slate-700">
                                {tier.id}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateTier({ enabled: !tier.enabled })}
                                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                  tier.enabled
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-slate-200 text-slate-600'
                                }`}
                              >
                                {tier.enabled ? 'ENABLED' : 'DISABLED'}
                              </button>
                            </div>
                            <span className="font-mono text-xs text-slate-500">
                              Commission: ${tier.commissionPerLot.toFixed(2)}/lot · Spread {tier.spreadMultiplier}x
                            </span>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Tier Name
                              </label>
                              <input
                                type="text"
                                value={tier.name}
                                onChange={(e) => updateTier({ name: e.target.value })}
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Comm / Lot ($)
                              </label>
                              <input
                                type="number"
                                step="0.5"
                                min={0}
                                value={tier.commissionPerLot}
                                onChange={(e) =>
                                  updateTier({
                                    commissionPerLot: Math.max(0, Number(e.target.value) || 0),
                                  })
                                }
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Spread Mult (×)
                              </label>
                              <input
                                type="number"
                                step="0.05"
                                min={0.05}
                                max={5}
                                value={tier.spreadMultiplier}
                                onChange={(e) =>
                                  updateTier({
                                    spreadMultiplier: Math.max(0.05, Number(e.target.value) || 0.1),
                                  })
                                }
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Min Vault ($)
                              </label>
                              <input
                                type="number"
                                min={1}
                                value={tier.minDepositUsd}
                                onChange={(e) =>
                                  updateTier({
                                    minDepositUsd: Math.max(1, Number(e.target.value) || 1),
                                  })
                                }
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Max Leverage
                              </label>
                              <input
                                type="number"
                                min={10}
                                max={2000}
                                value={tier.maxLeverage}
                                onChange={(e) =>
                                  updateTier({
                                    maxLeverage: Math.max(10, Number(e.target.value) || 100),
                                  })
                                }
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Execution Type
                              </label>
                              <input
                                type="text"
                                value={tier.executionType}
                                onChange={(e) => updateTier({ executionType: e.target.value })}
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                              />
                            </div>
                            <div className="col-span-2 md:col-span-6">
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Account Tagline
                              </label>
                              <input
                                type="text"
                                value={tier.tagline}
                                onChange={(e) => updateTier({ tagline: e.target.value })}
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Copy Trade Master Strategy Providers CRUD */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display font-bold text-slate-900 text-base flex items-center gap-2">
                        <Copy className="w-4 h-4 text-orange-600" />
                        Copy Trade Master Strategy Providers ({fxCfg.copyTraders.length})
                      </h2>
                      <p className="text-xs text-slate-500">
                        Manage Master Traders visible in the Forex Copy Trade marketplace, including ROI, performance fee %, daily target %, and minimum copy amount.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const newTrader: CopyTraderProfile = {
                            id: `master_${Date.now().toString(36)}`,
                            name: `Master FX Desk ${fxCfg.copyTraders.length + 1}`,
                            handle: `@MASTER${fxCfg.copyTraders.length + 1}`,
                            strategy: 'Institutional multi-session price action and liquidity sweep model.',
                            pairs: 'EUR/USD · XAU/USD',
                            riskLevel: 'Moderate',
                            monthlyRoiPercent: 34.5,
                            winRatePercent: 76,
                            maxDrawdownPercent: 9.5,
                            profitFactor: 1.9,
                            performanceFeePercent: 20,
                            dailyTargetPercent: 1.35,
                            minCopyUsd: 50,
                            recommendedTierId: 'pro',
                            followersCount: 120,
                            enabled: true,
                          };
                          setFxCfg({ copyTraders: [...fxCfg.copyTraders, newTrader] });
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold"
                      >
                        <Plus className="w-3.5 h-3.5 text-orange-600" />
                        Add Master Trader
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleSaveConfig()}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Save Copy Traders
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {fxCfg.copyTraders.map((tr, idx) => {
                      const updateTr = (patch: Partial<CopyTraderProfile>) => {
                        const list = [...fxCfg.copyTraders];
                        list[idx] = { ...tr, ...patch };
                        setFxCfg({ copyTraders: list });
                      };
                      return (
                        <div
                          key={tr.id}
                          className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-slate-700">{tr.id}</span>
                              <button
                                type="button"
                                onClick={() => updateTr({ enabled: !tr.enabled })}
                                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                  tr.enabled
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-slate-200 text-slate-600'
                                }`}
                              >
                                {tr.enabled ? 'ACTIVE' : 'PAUSED'}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setFxCfg({
                                  copyTraders: fxCfg.copyTraders.filter((_, i) => i !== idx),
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Remove
                            </button>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                            <div className="col-span-2">
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Trader Name
                              </label>
                              <input
                                type="text"
                                value={tr.name}
                                onChange={(e) => updateTr({ name: e.target.value })}
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Handle
                              </label>
                              <input
                                type="text"
                                value={tr.handle}
                                onChange={(e) => updateTr({ handle: e.target.value.toUpperCase() })}
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Pairs
                              </label>
                              <input
                                type="text"
                                value={tr.pairs}
                                onChange={(e) => updateTr({ pairs: e.target.value })}
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Risk Level
                              </label>
                              <select
                                value={tr.riskLevel}
                                onChange={(e) =>
                                  updateTr({
                                    riskLevel: e.target.value as CopyTraderProfile['riskLevel'],
                                  })
                                }
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                              >
                                <option value="Low">Low</option>
                                <option value="Moderate">Moderate</option>
                                <option value="Dynamic">Dynamic</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Rec. Tier
                              </label>
                              <select
                                value={tr.recommendedTierId}
                                onChange={(e) =>
                                  updateTr({
                                    recommendedTierId: e.target.value as ForexAccountTierId,
                                  })
                                }
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                              >
                                <option value="standard">Standard</option>
                                <option value="pro">Pro</option>
                                <option value="raw_spread">Raw Spread</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                30D ROI (%)
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                value={tr.monthlyRoiPercent}
                                onChange={(e) =>
                                  updateTr({ monthlyRoiPercent: Number(e.target.value) || 0 })
                                }
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Daily Target (%)
                              </label>
                              <input
                                type="number"
                                step="0.05"
                                min={0}
                                value={tr.dailyTargetPercent}
                                onChange={(e) =>
                                  updateTr({
                                    dailyTargetPercent: Math.max(0, Number(e.target.value) || 0),
                                  })
                                }
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Win Rate (%)
                              </label>
                              <input
                                type="number"
                                min={1}
                                max={100}
                                value={tr.winRatePercent}
                                onChange={(e) =>
                                  updateTr({
                                    winRatePercent: Math.max(1, Math.min(100, Number(e.target.value) || 50)),
                                  })
                                }
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Perf Fee (%)
                              </label>
                              <input
                                type="number"
                                min={0}
                                max={50}
                                value={tr.performanceFeePercent}
                                onChange={(e) =>
                                  updateTr({
                                    performanceFeePercent: Math.max(0, Number(e.target.value) || 0),
                                  })
                                }
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Min Copy ($)
                              </label>
                              <input
                                type="number"
                                min={1}
                                value={tr.minCopyUsd}
                                onChange={(e) =>
                                  updateTr({ minCopyUsd: Math.max(1, Number(e.target.value) || 10) })
                                }
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Followers
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={tr.followersCount}
                                onChange={(e) =>
                                  updateTr({ followersCount: Math.max(0, Number(e.target.value) || 0) })
                                }
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs"
                              />
                            </div>

                            <div className="col-span-2 md:col-span-6">
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Strategy Description
                              </label>
                              <input
                                type="text"
                                value={tr.strategy}
                                onChange={(e) => updateTr({ strategy: e.target.value })}
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Live Client Forex Trades & Copy Trade Subscriptions Overview */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                    <h3 className="font-display font-bold text-slate-900 text-base flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-orange-600" />
                      Client WebTerminal Orders ({allForexTrades.length})
                    </h3>
                    {allForexTrades.length === 0 ? (
                      <p className="text-xs text-slate-500">No client Forex trades placed yet.</p>
                    ) : (
                      <div className="space-y-2 max-h-72 overflow-y-auto">
                        {allForexTrades.map((ft) => (
                          <div
                            key={ft.id}
                            className="p-2.5 rounded-lg border border-slate-200 text-xs flex items-center justify-between gap-2"
                          >
                            <div>
                              <span className="font-semibold text-slate-900">{ft.userName}</span> ·{' '}
                              <span
                                className={`font-mono font-bold ${
                                  ft.direction === 'BUY' ? 'text-emerald-700' : 'text-red-700'
                                }`}
                              >
                                {ft.direction} {ft.lots} {ft.symbol}
                              </span>{' '}
                              <span className="text-slate-500">({ft.accountTierName})</span>
                            </div>
                            <div className="font-mono text-right tabular-nums">
                              <div className="font-bold text-slate-900">
                                {ft.status === 'open'
                                  ? `Open ($${ft.marginUsd.toFixed(2)})`
                                  : `${ft.realizedPnlUsd >= 0 ? '+' : ''}$${ft.realizedPnlUsd.toFixed(2)}`}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                Fee: ${ft.commissionUsd.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                    <h3 className="font-display font-bold text-slate-900 text-base flex items-center gap-2">
                      <Users className="w-4 h-4 text-orange-600" />
                      Client Copy Trade Subscriptions ({allCopySubs.length})
                    </h3>
                    {allCopySubs.length === 0 ? (
                      <p className="text-xs text-slate-500">No active or past copy subscriptions yet.</p>
                    ) : (
                      <div className="space-y-2 max-h-72 overflow-y-auto">
                        {allCopySubs.map((cs) => (
                          <div
                            key={cs.id}
                            className="p-2.5 rounded-lg border border-slate-200 text-xs flex items-center justify-between gap-2"
                          >
                            <div>
                              <span className="font-semibold text-slate-900">{cs.userName}</span> →{' '}
                              <span className="font-mono text-orange-700 font-semibold">
                                {cs.traderName}
                              </span>{' '}
                              <span className="text-slate-500">({cs.status})</span>
                            </div>
                            <div className="font-mono text-right tabular-nums">
                              <div className="font-bold text-slate-900">
                                ${cs.allocatedUsd.toFixed(2)} ({cs.riskMultiplier}x)
                              </div>
                              <div className="text-[10px] text-emerald-700">
                                Claimed: +${cs.claimedProfitUsd.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            );
          })()}

          {/* TAB 5: DEPOSIT/WITHDRAW ADDRESSES, PAYMENT CHANNELS & MEME COIN */}
          {tab === 'wallets-meme' && (
            <section className="space-y-6">
              {/* Dynamic Platform Payment Methods Manager */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display font-bold text-slate-900 text-base flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-orange-600" />
                      Deposit &amp; Withdrawal Addresses / Payment Channels
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Manually configure both Deposit Receiving Addresses and Withdrawal Payout Source Addresses for every payment channel.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleSaveConfig()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Publish Addresses
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
                          <div className="md:col-span-4">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Display Name</label>
                            <input
                              type="text"
                              value={pm.name}
                              onChange={(e) => updatePm({ name: e.target.value })}
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                            />
                          </div>
                          <div className="md:col-span-4">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Deposit Receiving Address
                            </label>
                            <input
                              type="text"
                              value={pm.receivingAccount}
                              onChange={(e) => updatePm({ receivingAccount: e.target.value })}
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs"
                            />
                          </div>
                          <div className="md:col-span-4">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Withdrawal Payout Source Address
                            </label>
                            <input
                              type="text"
                              value={pm.withdrawAddress ?? pm.receivingAccount}
                              onChange={(e) => updatePm({ withdrawAddress: e.target.value })}
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
                          <div className="md:col-span-8">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Deposit / Payout Instructions for Users
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
                        Deposit Receiving Address / ID
                      </label>
                      <input
                        type="text"
                        value={newPmAccount}
                        onChange={(e) => setNewPmAccount(e.target.value)}
                        placeholder="Wallet address, Binance Pay ID, or Account"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs"
                      />
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Withdrawal Source Address (Optional)
                      </label>
                      <input
                        type="text"
                        value={newPmWithdrawAddress}
                        onChange={(e) => setNewPmWithdrawAddress(e.target.value)}
                        placeholder="Defaults to Receiving Address if blank"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs"
                      />
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Instructions</label>
                      <input
                        type="text"
                        value={newPmInstructions}
                        onChange={(e) => setNewPmInstructions(e.target.value)}
                        placeholder="Instructions shown to users"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                      />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Min Dep</label>
                      <input
                        type="number"
                        min={1}
                        value={newPmMinDeposit}
                        onChange={(e) => setNewPmMinDeposit(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs"
                      />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Min Wd</label>
                      <input
                        type="number"
                        min={1}
                        value={newPmMinWithdraw}
                        onChange={(e) => setNewPmMinWithdraw(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs"
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
                            notify('err', 'Enter Method Name, Method ID, and Deposit Receiving Address.');
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
                            withdrawAddress: newPmWithdrawAddress.trim() || cleanAcc,
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
                          setNewPmWithdrawAddress('');
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
                    Legacy Crypto Wallets Quick-Sync &amp; Meme Coin Address
                  </h2>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleSaveConfig()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save Wallets &amp; Meme Coin
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
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display font-bold text-slate-900 text-base">
                      Manual Meme Coin Contract &amp; Launchpad Configuration
                    </h3>
                    <p className="text-xs text-slate-500">
                      Set your custom Solana Meme Coin contract mint address, ticker, live price, market cap, and description manually.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleSaveConfig()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Publish Meme Coin
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Coin Name</label>
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
                  <div className="md:col-span-2">
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
                  <div className="md:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Live Price (USD)</label>
                    <input
                      type="number"
                      step="0.000001"
                      min={0.0000001}
                      value={draftConfig.pumpFunToken.priceUsd}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          pumpFunToken: {
                            ...draftConfig.pumpFunToken,
                            priceUsd: Math.max(0.0000001, Number(e.target.value) || 0.0001),
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Market Cap ($)</label>
                    <input
                      type="number"
                      min={0}
                      value={draftConfig.pumpFunToken.marketCapUsd}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          pumpFunToken: {
                            ...draftConfig.pumpFunToken,
                            marketCapUsd: Math.max(0, Number(e.target.value) || 0),
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">24h Change (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={draftConfig.pumpFunToken.change24hPercent}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          pumpFunToken: {
                            ...draftConfig.pumpFunToken,
                            change24hPercent: Number(e.target.value) || 0,
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                    />
                  </div>
                  <div className="md:col-span-7">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Manual Meme Coin Contract / Mint Address
                    </label>
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
                  <div className="md:col-span-5">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Pump.fun / Explorer URL</label>
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
                  <div className="md:col-span-12">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Token Description</label>
                    <textarea
                      rows={2}
                      value={draftConfig.pumpFunToken.description}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          pumpFunToken: { ...draftConfig.pumpFunToken, description: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* TAB: MODULE & SUPPORT CONTROLS */}
          {tab === 'modules-support' && (
            <section className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
                <div>
                  <h2 className="font-display font-bold text-slate-900 text-base">
                    No-Code Module Visibility &amp; Front Gate Controls
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Enable or hide platform modules across the public Slide Bar drawer and Client Vault sidebar without touching code.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {(
                    [
                      {
                        key: 'aiTradingEnabled' as const,
                        label: 'AI Trading Desk & Plans',
                        desc: 'Controls AI Trading menu & package activation desk.',
                      },
                      {
                        key: 'forexMarketEnabled' as const,
                        label: 'Forex Market & Copy Trade',
                        desc: 'Controls Forex WebTerminal & Copy Trading visibility.',
                      },
                      {
                        key: 'coinMiningEnabled' as const,
                        label: `${draftConfig.pumpFunToken.name} Coin & Mining Hub`,
                        desc: 'Controls Coin Launchpad, Tap-to-Mine & Paid Staking.',
                      },
                      {
                        key: 'p2pEnabled' as const,
                        label: 'P2P User-to-User Transfers',
                        desc: 'Controls internal USD wallet transfer tab inside Vault.',
                      },
                      {
                        key: 'requireSignupForTradingModules' as const,
                        label: 'Require Sign-Up Before Viewing Trading Modules',
                        desc: 'Locks AI Trading, Forex Market & Coin links behind Sign Up / Sign In.',
                      },
                    ]
                  ).map((item) => {
                    const mods = draftConfig.moduleControls || DEFAULT_PLATFORM_CONFIG.moduleControls!;
                    const checked = mods[item.key] !== false;
                    return (
                      <label
                        key={item.key}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex items-start gap-3 cursor-pointer hover:border-orange-300"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const base = draftConfig.moduleControls || DEFAULT_PLATFORM_CONFIG.moduleControls!;
                            setDraftConfig({
                              ...draftConfig,
                              moduleControls: {
                                ...base,
                                [item.key]: e.target.checked,
                              },
                            });
                          }}
                          className="mt-0.5"
                        />
                        <div>
                          <div className="font-semibold text-slate-900">{item.label}</div>
                          <div className="text-slate-500 mt-0.5">{item.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
                <div>
                  <h2 className="font-display font-bold text-slate-900 text-base flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-sky-600" />
                    Official Support &amp; Community Channels
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Displayed in the public site footer, client Vault footer, and account suspension help box.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Telegram Support URL</label>
                    <input
                      type="url"
                      value={draftConfig.supportLinks?.telegramUrl || ''}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          supportLinks: {
                            ...(draftConfig.supportLinks || DEFAULT_PLATFORM_CONFIG.supportLinks!),
                            telegramUrl: e.target.value,
                          },
                        })
                      }
                      placeholder="https://t.me/your_support"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">WhatsApp Support URL</label>
                    <input
                      type="url"
                      value={draftConfig.supportLinks?.whatsappUrl || ''}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          supportLinks: {
                            ...(draftConfig.supportLinks || DEFAULT_PLATFORM_CONFIG.supportLinks!),
                            whatsappUrl: e.target.value,
                          },
                        })
                      }
                      placeholder="https://wa.me/1234567890"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Official Support Email</label>
                    <input
                      type="email"
                      value={draftConfig.supportLinks?.supportEmail || ''}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          supportLinks: {
                            ...(draftConfig.supportLinks || DEFAULT_PLATFORM_CONFIG.supportLinks!),
                            supportEmail: e.target.value,
                          },
                        })
                      }
                      placeholder="support@alphatradex.pro"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleSaveConfig(draftConfig)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold"
                  >
                    <Save className="w-4 h-4" />
                    Publish Module &amp; Support Controls
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* TAB 6: AUDIT LOGS & BACKUP */}
          {tab === 'web3-payments' && (
            <AdminWeb3PaymentPanel
              draftConfig={draftConfig}
              setDraftConfig={setDraftConfig}
              busy={busy}
              verifiedTxs={allWeb3VerifiedTxs}
              auditLogs={allAuditLogs}
              onNotify={notify}
              onOpenEmailApiSettings={() => setTab('email-api')}
              onSaveConfig={async (nextCfg) => {
                setBusy(true);
                try {
                  await updatePlatformConfig(nextCfg || draftConfig);
                  notify('ok', 'Web3 Payment & Security settings saved to Firestore.');
                } catch (err) {
                  notify('err', formatUiError(err));
                } finally {
                  setBusy(false);
                }
              }}
            />
          )}

          {tab === 'email-api' && authUser && (
            <AdminResendEmailSettingsPanel
              authUserEmail={authUser.email || ''}
              getIdToken={() => authUser.getIdToken()}
              allUsers={allUsers}
              auditLogs={allAuditLogs}
              onNotify={notify}
            />
          )}

          {tab === 'audit' && (
            <section className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-display font-bold text-slate-900 text-base flex items-center gap-2">
                    <Database className="w-4 h-4 text-orange-600" />
                    Platform Backup &amp; Export Controls
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Download a complete JSON snapshot of all collections &amp; configuration, or export filtered client data to CSV.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleExportClientsCsv}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export Clients CSV
                  </button>
                  <button
                    type="button"
                    onClick={handleExportFullBackupJson}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                  >
                    <FileJson className="w-3.5 h-3.5 text-orange-400" />
                    Export Full Backup (JSON)
                  </button>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
                <h2 className="font-display font-bold text-slate-900 text-base">
                  Immutable Admin Action Activity Log ({allAdminLogs.length})
                </h2>
                {allAdminLogs.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4">No admin audit actions recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-2 pr-3">Time</th>
                          <th className="py-2 pr-3">Admin</th>
                          <th className="py-2 pr-3">Action</th>
                          <th className="py-2 pr-3">Target</th>
                          <th className="py-2 pr-3">Amount</th>
                          <th className="py-2">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {allAdminLogs.map((log) => (
                          <tr key={log.id}>
                            <td className="py-2 pr-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                              {formatLogTime(log.createdAt)}
                            </td>
                            <td className="py-2 pr-3 text-slate-700">{log.adminEmail}</td>
                            <td className="py-2 pr-3">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[10px] font-semibold">
                                {log.action}
                              </span>
                            </td>
                            <td className="py-2 pr-3 font-mono text-slate-700">{log.targetLabel || '—'}</td>
                            <td className="py-2 pr-3 font-mono tabular-nums font-semibold">
                              {typeof log.amountUsd === 'number' ? `$${log.amountUsd.toFixed(2)}` : '—'}
                            </td>
                            <td className="py-2 text-slate-600">{log.details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

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
                    P2P Transfers &amp; Coin Mining Stakes ({allP2P.length + allCoinStakes.length})
                  </h3>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {allCoinStakes.map((s) => (
                      <div key={s.id} className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/40 text-xs flex justify-between">
                        <span>
                          [Mining: {s.planName}] {s.userName} ({s.status})
                        </span>
                        <span className="font-mono font-bold tabular-nums">${s.principalUsd.toFixed(2)}</span>
                      </div>
                    ))}
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
                    Withdrawals, Meme Allocations &amp; Commissions ({allWithdrawals.length + allMeme.length + allMlm.length})
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
                          [{c.commissionType === 'mentor' ? 'MENTOR BONUS' : `MLM L${c.level}`}] ({c.ratePercent}%) from {c.fromName}
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
            <div className="p-5 space-y-4">
              {previewKycUser.phoneNumber && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">Registered Phone ({previewKycUser.countryName || previewKycUser.countryCode || 'Global'}): </span>
                    <strong className="font-mono text-slate-900">{previewKycUser.phoneNumber}</strong>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      const nextState = !previewKycUser.phoneVerified;
                      setBusy(true);
                      try {
                        await verifyUserPhone(previewKycUser.uid, nextState);
                        setPreviewKycUser({ ...previewKycUser, phoneVerified: nextState });
                        notify(
                          'ok',
                          `Phone verification ${nextState ? 'approved' : 'reset'} for ${previewKycUser.fullName}.`
                        );
                      } catch (err) {
                        notify('err', formatUiError(err));
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className={`px-2.5 py-1 rounded font-semibold ${
                      previewKycUser.phoneVerified
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        : 'bg-sky-600 text-white hover:bg-sky-500'
                    }`}
                  >
                    {previewKycUser.phoneVerified ? 'Phone Verified ✓' : 'Verify Phone'}
                  </button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
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
        </div>
      )}

      <CapitalRequestModal
        withdrawal={breakdownModalWd}
        onClose={() => setBreakdownModalWd(null)}
      />

      {/* Client Account & Balance Control Modal */}
      {manageClient && (() => {
        const liveClient = allUsers.find((u) => u.uid === manageClient.uid) || manageClient;
        const cDeposits = allDeposits.filter((d) => d.uid === liveClient.uid);
        const cWithdrawals = allWithdrawals.filter((w) => w.uid === liveClient.uid);
        const cInvestments = allInvestments.filter((i) => i.uid === liveClient.uid);
        const cForex = allForexTrades.filter((t) => t.uid === liveClient.uid);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 overflow-y-auto">
            <div className="max-w-3xl w-full bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-2xl my-6">
              <div className="bg-[#0B111E] px-5 py-4 text-white flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-display font-bold text-sm truncate flex items-center gap-2">
                    <span>{liveClient.fullName}</span>
                    <span className="font-mono text-xs text-orange-400">({liveClient.handle})</span>
                    {liveClient.suspended && (
                      <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold">
                        SUSPENDED
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">{liveClient.email}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setManageClient(null)}
                  className="text-xs text-slate-300 hover:text-white px-2.5 py-1 rounded border border-slate-700"
                >
                  Close
                </button>
              </div>

              {/* Client Summary Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 border-b border-slate-200 text-xs">
                <div>
                  <div className="text-slate-500">Deposit Wallet</div>
                  <div className="font-mono font-bold text-sm text-slate-900 tabular-nums">
                    ${liveClient.usdBalance.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Income Wallet</div>
                  <div className="font-mono font-bold text-sm text-emerald-700 tabular-nums">
                    ${liveClient.profitBalance.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Total Invested</div>
                  <div className="font-mono font-bold text-sm text-slate-900 tabular-nums">
                    ${liveClient.totalInvested.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Total Withdrawn</div>
                  <div className="font-mono font-bold text-sm text-orange-600 tabular-nums">
                    ${liveClient.totalWithdrawn.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Sub-Tab Selector */}
              <div className="px-5 pt-3 border-b border-slate-200 flex flex-wrap gap-2 text-xs">
                {(
                  [
                    { id: 'controls', label: 'Balance & Freeze Controls' },
                    { id: 'deposits', label: `Deposits (${cDeposits.length})` },
                    { id: 'withdrawals', label: `Withdrawals (${cWithdrawals.length})` },
                    { id: 'packages', label: `Packages (${cInvestments.length})` },
                    { id: 'forex', label: `Forex (${cForex.length})` },
                  ] as const
                ).map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setManageClientSubTab(st.id)}
                    className={`px-3 py-2 font-semibold border-b-2 transition-colors ${
                      manageClientSubTab === st.id
                        ? 'border-orange-600 text-orange-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              <div className="p-5 max-h-[65vh] overflow-y-auto space-y-5 text-xs">
                {manageClientSubTab === 'controls' && (
                  <div className="space-y-5">
                    {/* Direct Wallet Credit / Debit */}
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const amt = Number(balAmount);
                        if (!Number.isFinite(amt) || amt <= 0) {
                          notify('err', 'Enter a positive USD amount.');
                          return;
                        }
                        if (!balReason.trim()) {
                          notify('err', 'Provide an audit reason for this adjustment.');
                          return;
                        }
                        setBusy(true);
                        try {
                          await adjustUserBalance({
                            targetUid: liveClient.uid,
                            wallet: balWallet,
                            mode: balMode,
                            amountUsd: amt,
                            reason: balReason.trim(),
                          });
                          setBalAmount('');
                          setBalReason('');
                          notify(
                            'ok',
                            `${balMode === 'credit' ? 'Credited' : 'Debited'} $${amt.toFixed(2)} (${balWallet}) for ${liveClient.fullName}.`
                          );
                        } catch (err) {
                          notify('err', formatUiError(err));
                        } finally {
                          setBusy(false);
                        }
                      }}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3"
                    >
                      <div className="font-display font-bold text-slate-900 text-sm flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-orange-600" />
                        Direct Balance Credit / Debit
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Target Wallet</label>
                          <select
                            value={balWallet}
                            onChange={(e) => setBalWallet(e.target.value as 'usdBalance' | 'profitBalance')}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                          >
                            <option value="usdBalance">Deposit Wallet (usdBalance)</option>
                            <option value="profitBalance">Income Wallet (profitBalance)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Action</label>
                          <select
                            value={balMode}
                            onChange={(e) => setBalMode(e.target.value as 'credit' | 'debit')}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                          >
                            <option value="credit">Credit (+ Add USD)</option>
                            <option value="debit">Debit (- Deduct USD)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Amount (USD)</label>
                          <input
                            type="number"
                            min={0.01}
                            step="0.01"
                            required
                            value={balAmount}
                            onChange={(e) => setBalAmount(e.target.value)}
                            placeholder="100.00"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono bg-white"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          required
                          value={balReason}
                          onChange={(e) => setBalReason(e.target.value)}
                          placeholder="Audit reason (e.g. Manual deposit bonus, fee correction)"
                          className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-white"
                        />
                        <button
                          type="submit"
                          disabled={busy}
                          className={`px-4 py-2 rounded-lg text-white font-semibold whitespace-nowrap ${
                            balMode === 'credit'
                              ? 'bg-emerald-600 hover:bg-emerald-500'
                              : 'bg-red-600 hover:bg-red-500'
                          }`}
                        >
                          {balMode === 'credit' ? 'Apply Credit (+)' : 'Apply Debit (-)'}
                        </button>
                      </div>
                    </form>

                    {/* Account Suspension / Freeze */}
                    <div className="p-4 rounded-xl border border-slate-200 space-y-3">
                      <div className="font-display font-bold text-slate-900 text-sm flex items-center gap-2">
                        {liveClient.suspended ? (
                          <Unlock className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Ban className="w-4 h-4 text-red-600" />
                        )}
                        Account Freeze / Suspension Control
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={suspendReasonDraft}
                          onChange={(e) => setSuspendReasonDraft(e.target.value)}
                          placeholder="Suspension reason shown to user on login..."
                          className="flex-1 px-3 py-2 rounded-lg border border-slate-200"
                        />
                        <button
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            const nextSuspended = !liveClient.suspended;
                            setBusy(true);
                            try {
                              await setUserSuspension(
                                liveClient.uid,
                                nextSuspended,
                                nextSuspended ? suspendReasonDraft.trim() || 'Suspended by administration' : ''
                              );
                              notify(
                                'ok',
                                `${liveClient.fullName} account ${nextSuspended ? 'frozen/suspended' : 'reactivated'}.`
                              );
                            } catch (err) {
                              notify('err', formatUiError(err));
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className={`px-4 py-2 rounded-lg text-white font-semibold whitespace-nowrap inline-flex items-center gap-1.5 ${
                            liveClient.suspended
                              ? 'bg-emerald-600 hover:bg-emerald-500'
                              : 'bg-red-600 hover:bg-red-500'
                          }`}
                        >
                          {liveClient.suspended ? (
                            <>
                              <Unlock className="w-3.5 h-3.5" />
                              Unfreeze Account
                            </>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5" />
                              Freeze Account
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Quick Compliance Overrides */}
                    <div className="p-4 rounded-xl border border-slate-200 space-y-3">
                      <div className="font-display font-bold text-slate-900 text-sm">
                        Compliance &amp; Verification Overrides
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-slate-500 mr-1">KYC Status:</span>
                          {(['approved', 'pending', 'rejected', 'unsubmitted'] as const).map((st) => (
                            <button
                              key={st}
                              type="button"
                              disabled={busy || liveClient.kycStatus === st}
                              onClick={async () => {
                                setBusy(true);
                                try {
                                  await setUserKycStatus(liveClient.uid, st);
                                  notify('ok', `Set KYC status to ${st} for ${liveClient.fullName}.`);
                                } catch (err) {
                                  notify('err', formatUiError(err));
                                } finally {
                                  setBusy(false);
                                }
                              }}
                              className={`px-2.5 py-1 rounded font-semibold uppercase text-[10px] border ${
                                liveClient.kycStatus === st
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {st}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            const nextPhone = !liveClient.phoneVerified;
                            setBusy(true);
                            try {
                              await verifyUserPhone(liveClient.uid, nextPhone);
                              notify(
                                'ok',
                                `Phone ${nextPhone ? 'verified' : 'unverified'} for ${liveClient.fullName}.`
                              );
                            } catch (err) {
                              notify('err', formatUiError(err));
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className={`px-3 py-1.5 rounded font-semibold ${
                            liveClient.phoneVerified
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-sky-600 text-white hover:bg-sky-500'
                          }`}
                        >
                          {liveClient.phoneVerified ? 'Phone Verified ✓ (Reset)' : 'Verify Phone Now'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {manageClientSubTab === 'deposits' && (
                  <div className="space-y-2">
                    {cDeposits.length === 0 ? (
                      <p className="text-slate-500 py-4 text-center">No deposits for this client.</p>
                    ) : (
                      cDeposits.map((d) => (
                        <div key={d.id} className="p-3 rounded-lg border border-slate-200 flex justify-between items-center">
                          <div>
                            <div className="font-semibold text-slate-900">{d.network} · {d.status}</div>
                            <div className="font-mono text-[11px] text-slate-500">TxID: {d.txId}</div>
                          </div>
                          <div className="font-mono font-bold tabular-nums">${d.amountUsd.toFixed(2)}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {manageClientSubTab === 'withdrawals' && (
                  <div className="space-y-2">
                    {cWithdrawals.length === 0 ? (
                      <p className="text-slate-500 py-4 text-center">No withdrawals for this client.</p>
                    ) : (
                      cWithdrawals.map((w) => (
                        <div key={w.id} className="p-3 rounded-lg border border-slate-200 flex justify-between items-center gap-3">
                          <div>
                            <div className="font-semibold text-slate-900">
                              {w.type} · {w.status} ({w.network})
                            </div>
                            <div className="font-mono text-[11px] text-slate-500">
                              To: {w.destinationAddress} {w.adminNote ? `· Note: ${w.adminNote}` : ''}
                            </div>
                          </div>
                          <div className="font-mono font-bold tabular-nums">${w.amountUsd.toFixed(2)}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {manageClientSubTab === 'packages' && (
                  <div className="space-y-2">
                    {cInvestments.length === 0 ? (
                      <p className="text-slate-500 py-4 text-center">No AI packages for this client.</p>
                    ) : (
                      cInvestments.map((inv) => (
                        <div key={inv.id} className="p-3 rounded-lg border border-slate-200 flex justify-between items-center">
                          <div>
                            <div className="font-semibold text-slate-900">
                              Pkg #{inv.packageNumber} · {inv.packageName} ({inv.status})
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {inv.dailyPercent}%/weekday · Claimed: ${inv.claimedProfit.toFixed(2)}
                            </div>
                          </div>
                          <div className="font-mono font-bold tabular-nums">${inv.capital.toFixed(2)}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {manageClientSubTab === 'forex' && (
                  <div className="space-y-2">
                    {cForex.length === 0 ? (
                      <p className="text-slate-500 py-4 text-center">No Forex trades for this client.</p>
                    ) : (
                      cForex.map((t) => (
                        <div key={t.id} className="p-3 rounded-lg border border-slate-200 flex justify-between items-center">
                          <div>
                            <div className="font-semibold text-slate-900">
                              {t.symbol} {t.direction} ({t.lots} lots) · {t.status}
                            </div>
                            <div className="font-mono text-[11px] text-slate-500">
                              Entry: {t.entryPrice} · Margin: ${t.marginUsd.toFixed(2)}
                            </div>
                          </div>
                          <div className="font-mono font-bold tabular-nums">
                            {typeof t.realizedPnlUsd === 'number'
                              ? `${t.realizedPnlUsd >= 0 ? '+' : ''}$${t.realizedPnlUsd.toFixed(2)}`
                              : 'OPEN'}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
