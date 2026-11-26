import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Award,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Gift,
  Home,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Search,
  Share2,
  ShieldCheck,
  TrendingUp,
  Unlock,
  Users,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { CryptoNetwork, Investment } from '../types/platform';
import { computeInvestmentMetrics, formatTimestamp, isWeekendDate } from '../utils/investmentMath';
import { AlphatradexLogo3D } from './AlphatradexLogo3D';

type MentorSection =
  | 'overview'
  | 'gifted-vaults'
  | 'team-volume'
  | 'commissions'
  | 'payouts';

interface MentorDashboardProps {
  onSwitchToClientVault: () => void;
  onOpenHomePage?: () => void;
}

export const MentorDashboard: React.FC<MentorDashboardProps> = ({
  onSwitchToClientVault,
  onOpenHomePage,
}) => {
  const {
    userProfile,
    platformConfig,
    investments,
    downlineReferrals,
    mlmCommissions,
    withdrawals,
    referralLinkClicks,
    savedPaymentMethods,
    claimInvestmentProfit,
    withdrawInstantProfit,
    addUserPaymentMethod,
    signOutUser,
  } = usePlatform();

  const [activeTab, setActiveTab] = useState<MentorSection>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Team & Volume filters
  const [teamLevelFilter, setTeamLevelFilter] = useState<'all' | 1 | 2 | 3>('all');
  const [teamFundedFilter, setTeamFundedFilter] = useState<'all' | 'funded' | 'unfunded'>('all');
  const [teamSearch, setTeamSearch] = useState('');

  // Commissions filters
  const [commFilter, setCommFilter] = useState<'all' | 'mentor' | 'referral'>('all');
  const [commSearch, setCommSearch] = useState('');

  // Mentor Payout form + tracker
  const enabledWithdrawMethods = useMemo(
    () =>
      (platformConfig.paymentMethods || []).filter(
        (m) => m.enabled && m.allowWithdrawal
      ),
    [platformConfig.paymentMethods]
  );

  const [wdNetwork, setWdNetwork] = useState<CryptoNetwork>(
    () => enabledWithdrawMethods[0]?.id || 'USDT_TRC20'
  );
  const [wdAmount, setWdAmount] = useState('25');
  const [wdAddress, setWdAddress] = useState('');
  const [saveMethodAfter, setSaveMethodAfter] = useState(false);
  const [wdSubmitting, setWdSubmitting] = useState(false);
  const [payoutStatusFilter, setPayoutStatusFilter] = useState<
    'all' | 'pending' | 'processed' | 'rejected'
  >('all');
  const [payoutSearch, setPayoutSearch] = useState('');

  const activeWithdrawNetworkId = enabledWithdrawMethods.some((m) => m.id === wdNetwork)
    ? wdNetwork
    : enabledWithdrawMethods[0]?.id || 'USDT_TRC20';

  const selectedWithdrawMethod =
    enabledWithdrawMethods.find((m) => m.id === activeWithdrawNetworkId) ||
    enabledWithdrawMethods[0];

  const minWithdrawUsd = Math.max(
    Number(platformConfig.minWithdrawalUsd || 10),
    Number(selectedWithdrawMethod?.minWithdrawalUsd || 0)
  );

  const isWeekend = isWeekendDate(new Date());
  const mentorCfg = platformConfig.mentorConfig;
  const userHandle = userProfile?.handle || '';
  const referralLink =
    typeof window !== 'undefined'
      ? `${window.location.origin}/?ref=${encodeURIComponent(userHandle)}`
      : `/?ref=${encodeURIComponent(userHandle)}`;

  const notify = (type: 'ok' | 'err', text: string) => {
    setFeedback({ type, text });
    window.setTimeout(() => {
      setFeedback((prev) => (prev?.text === text ? null : prev));
    }, 6500);
  };

  const copyValue = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? '' : prev));
      }, 2000);
    } catch {
      notify('err', 'Clipboard access is unavailable in this browser.');
    }
  };

  // Gifted investments & live profit calculations
  const giftedVaultRows = useMemo(() => {
    return investments
      .filter((inv) => inv.isMentorGifted)
      .map((inv) => ({
        inv,
        metrics: computeInvestmentMetrics(inv, platformConfig.globalPaused),
      }));
  }, [investments, platformConfig.globalPaused]);

  const metricsSummary = useMemo(() => {
    const mentorGifted = Number(userProfile?.mentorGiftedCapital || 0);
    const mentorRequired = Number(userProfile?.mentorRequiredVolume || 0);
    const mentorBrought = Number(userProfile?.mentorBroughtVolume || 0);
    const mentorRemaining = Math.max(0, mentorRequired - mentorBrought);
    const volumeProgressPct =
      mentorRequired > 0 ? Math.min(100, (mentorBrought / mentorRequired) * 100) : 100;
    const isVolumeUnlocked = mentorGifted <= 0 || mentorBrought >= mentorRequired;

    const totalClaimableNow = giftedVaultRows.reduce(
      (sum, row) => sum + Number(row.metrics.unclaimedProfit || 0),
      0
    );
    const totalClaimedGiftedProfit = giftedVaultRows.reduce(
      (sum, row) => sum + Number(row.inv.claimedProfit || 0),
      0
    );
    const totalAccruedGiftedProfit = giftedVaultRows.reduce(
      (sum, row) => sum + Number(row.metrics.totalProfitGenerated || 0),
      0
    );
    const dailyWeekdayYieldUsd = giftedVaultRows
      .filter((row) => row.inv.status === 'active')
      .reduce((sum, row) => sum + Number(row.metrics.dailyDollarTarget || 0), 0);

    let mentorOverrideEarned = 0;
    let level1Earned = 0;
    let level2Earned = 0;
    let level3Earned = 0;
    let totalCommissionEarned = 0;

    for (const c of mlmCommissions) {
      const amt = Number(c.commissionUsd || 0);
      totalCommissionEarned += amt;
      if (c.commissionType === 'mentor') {
        mentorOverrideEarned += amt;
      } else if (c.level === 1) {
        level1Earned += amt;
      } else if (c.level === 2) {
        level2Earned += amt;
      } else if (c.level === 3) {
        level3Earned += amt;
      }
    }

    const l1Refs = downlineReferrals.filter((r) => r.level === 1);
    const fundedRefs = downlineReferrals.filter((r) => Number(r.totalInvestedUsd || 0) > 0);
    const totalTeamVolume = downlineReferrals.reduce(
      (sum, r) => sum + Number(r.totalInvestedUsd || 0),
      0
    );
    const directL1Volume = l1Refs.reduce((sum, r) => sum + Number(r.totalInvestedUsd || 0), 0);
    const clicks = Math.max(0, Number(referralLinkClicks || 0));
    const conversionPct =
      clicks > 0
        ? Math.min(100, (downlineReferrals.length / clicks) * 100)
        : downlineReferrals.length > 0
        ? 100
        : 0;

    const pendingPayoutsUsd = withdrawals
      .filter((w) => w.status === 'pending')
      .reduce((sum, w) => sum + Number(w.amountUsd || 0), 0);
    const processedPayoutsUsd = withdrawals
      .filter((w) => w.status === 'approved' || w.status === 'completed')
      .reduce((sum, w) => sum + Number(w.amountUsd || 0), 0);

    return {
      mentorGifted,
      mentorRequired,
      mentorBrought,
      mentorRemaining,
      volumeProgressPct,
      isVolumeUnlocked,
      totalClaimableNow,
      totalClaimedGiftedProfit,
      totalAccruedGiftedProfit,
      dailyWeekdayYieldUsd,
      mentorOverrideEarned,
      level1Earned,
      level2Earned,
      level3Earned,
      totalCommissionEarned,
      l1Count: l1Refs.length,
      fundedCount: fundedRefs.length,
      totalTeamVolume,
      directL1Volume,
      clicks,
      conversionPct,
      pendingPayoutsUsd,
      processedPayoutsUsd,
    };
  }, [userProfile, giftedVaultRows, mlmCommissions, downlineReferrals, referralLinkClicks, withdrawals]);

  const filteredDownline = useMemo(() => {
    const q = teamSearch.trim().toLowerCase();
    return downlineReferrals.filter((r) => {
      if (teamLevelFilter !== 'all' && r.level !== teamLevelFilter) return false;
      const isFunded = Number(r.totalInvestedUsd || 0) > 0;
      if (teamFundedFilter === 'funded' && !isFunded) return false;
      if (teamFundedFilter === 'unfunded' && isFunded) return false;
      if (!q) return true;
      return (
        r.refereeName.toLowerCase().includes(q) ||
        r.refereeHandle.toLowerCase().includes(q)
      );
    });
  }, [downlineReferrals, teamLevelFilter, teamFundedFilter, teamSearch]);

  const filteredCommissions = useMemo(() => {
    const q = commSearch.trim().toLowerCase();
    return mlmCommissions.filter((c) => {
      if (commFilter === 'mentor' && c.commissionType !== 'mentor') return false;
      if (commFilter === 'referral' && c.commissionType === 'mentor') return false;
      if (!q) return true;
      return (
        c.fromName.toLowerCase().includes(q) ||
        (c.commissionType === 'mentor' ? 'mentor override' : `level ${c.level}`).includes(q)
      );
    });
  }, [mlmCommissions, commFilter, commSearch]);

  const filteredWithdrawals = useMemo(() => {
    const q = payoutSearch.trim().toLowerCase();
    return withdrawals.filter((w) => {
      if (payoutStatusFilter === 'pending' && w.status !== 'pending') return false;
      if (
        payoutStatusFilter === 'processed' &&
        w.status !== 'approved' &&
        w.status !== 'completed'
      ) {
        return false;
      }
      if (payoutStatusFilter === 'rejected' && w.status !== 'rejected') return false;
      if (!q) return true;
      return (
        w.id.toLowerCase().includes(q) ||
        w.network.toLowerCase().includes(q) ||
        w.destinationAddress.toLowerCase().includes(q) ||
        (w.adminNote || '').toLowerCase().includes(q)
      );
    });
  }, [withdrawals, payoutStatusFilter, payoutSearch]);

  const navItems: {
    id: MentorSection;
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'overview', label: 'Mentor Overview', Icon: LayoutDashboard },
    { id: 'gifted-vaults', label: 'Gifted Vaults & Yield', Icon: Gift },
    { id: 'team-volume', label: 'Team & Volume Tracker', Icon: Users },
    { id: 'commissions', label: 'Override Commissions', Icon: Award },
    { id: 'payouts', label: 'Mentor Payouts', Icon: Wallet },
  ];

  // Strict security gate: never render Mentor Dashboard unless user is an Admin-gifted Mentor
  if (!userProfile || !userProfile.isMentor) {
    return null;
  }

  const activeTitle = navItems.find((i) => i.id === activeTab)?.label || 'Mentor Overview';

  const handleClaimGiftedProfit = async (inv: Investment) => {
    setBusyId(inv.id);
    try {
      const credited = await claimInvestmentProfit(inv);
      notify(
        'ok',
        `Claimed $${credited.toFixed(2)} weekday yield from your Mentor Gifted Vault into Income Wallet.`
      );
    } catch (err) {
      notify('err', (err as Error).message || 'Could not claim profit.');
    } finally {
      setBusyId(null);
    }
  };

  const handleSubmitMentorPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(wdAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      notify('err', 'Enter a valid payout amount in USD.');
      return;
    }
    if (!wdAddress.trim()) {
      notify('err', 'Enter your receiving payout wallet or account details.');
      return;
    }
    setWdSubmitting(true);
    try {
      await withdrawInstantProfit({
        amountUsd: amt,
        network: activeWithdrawNetworkId,
        destinationAddress: wdAddress.trim(),
        source: 'mentor_profit',
        settlementMode: 'pending',
      });
      if (
        saveMethodAfter &&
        !savedPaymentMethods.some(
          (pm) =>
            pm.methodId === activeWithdrawNetworkId &&
            pm.accountAddress === wdAddress.trim()
        )
      ) {
        const methodName = selectedWithdrawMethod?.name || activeWithdrawNetworkId;
        await addUserPaymentMethod({
          label: `${methodName} Mentor Payout`,
          methodId: activeWithdrawNetworkId,
          methodName,
          accountAddress: wdAddress.trim(),
          accountHolder: userProfile.fullName,
          isDefault: savedPaymentMethods.length === 0,
        });
      }
      setWdAddress('');
      setSaveMethodAfter(false);
      notify(
        'ok',
        `Mentor payout request of $${amt.toFixed(2)} submitted and queued for settlement review.`
      );
    } catch (err) {
      notify('err', (err as Error).message || 'Failed to submit mentor payout request.');
    } finally {
      setWdSubmitting(false);
    }
  };

  const kycBlockedForWithdraw =
    Boolean(platformConfig.kycSettings?.enabled) &&
    Boolean(platformConfig.kycSettings?.requireKycForWithdrawals) &&
    userProfile.kycStatus !== 'approved';

  const selectSection = (sec: MentorSection) => {
    setActiveTab(sec);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="relative z-10 min-h-screen bg-[#060A13]/92 text-slate-100 flex">
      {/* LEFT MENTOR SIDEBAR (248px Desktop + Mobile Drawer) */}
      <aside
        aria-label="Mentor Partner Navigation"
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#070C18]/98 backdrop-blur-xl border-r border-amber-500/20 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800/90 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <AlphatradexLogo3D
              variant="mark"
              size="sm"
              companyName={platformConfig.companyName}
            />
            <div className="min-w-0">
              <div className="font-display font-bold text-white text-sm truncate">
                Mentor Portal
              </div>
              <div className="text-[11px] font-mono text-amber-400/90 truncate">
                {userProfile.handle}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close mentor sidebar"
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mentor Account Status Summary (Clean Unboxed Block) */}
        <div className="px-4 py-3.5 border-b border-slate-800/80 bg-slate-900/40 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Partner Tier</span>
            <span className="font-semibold text-amber-300">Gifted Mentor</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Override Rate</span>
            <span className="font-mono font-semibold text-emerald-400 tabular-nums">
              +{mentorCfg?.enabled ? mentorCfg.mentorCommissionPercent : 0}% L1
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Payout Gate</span>
            <span
              className={`font-medium ${
                metricsSummary.isVolumeUnlocked ? 'text-emerald-400' : 'text-amber-300'
              }`}
            >
              {metricsSummary.isVolumeUnlocked
                ? 'Unlocked'
                : `${metricsSummary.volumeProgressPct.toFixed(0)}% Volume`}
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => selectSection(id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors text-left whitespace-nowrap ${
                  active
                    ? 'bg-amber-500/15 text-amber-200 border border-amber-500/35'
                    : 'text-slate-300 border border-transparent hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    active ? 'text-amber-400' : 'text-slate-500'
                  }`}
                />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Workspace Switcher & Sign Out */}
        <div className="p-3 border-t border-slate-800/90 space-y-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onSwitchToClientVault();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate">Back to Client Vault</span>
          </button>
          {onOpenHomePage && (
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenHomePage();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            >
              <Home className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="truncate">Home Page</span>
            </button>
          )}
          <button
            type="button"
            onClick={signOutUser}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            <LogOut className="w-4 h-4 text-slate-500 shrink-0" />
            <span className="truncate">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/70 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* MAIN CONTENT VIEWPORT */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Utility Bar (Breadcrumb left, 2 clean actions right) */}
        <header className="sticky top-0 z-20 h-16 bg-[#080D1A]/95 backdrop-blur-xl border-b border-slate-800/90 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open mentor menu"
              className="lg:hidden p-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
              <span className="text-amber-400/90 font-medium hidden sm:inline whitespace-nowrap">
                Mentor Portal
              </span>
              <span className="text-slate-600 hidden sm:inline">/</span>
              <h1 className="font-display font-semibold text-white truncate">
                {activeTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onSwitchToClientVault}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500 hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
              <span>Client Vault</span>
            </button>
            <button
              type="button"
              onClick={() => selectSection('payouts')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-colors whitespace-nowrap shrink-0"
            >
              <span>Request Payout</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* Scrollable Workspace Body */}
        <main className="flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Feedback Notification Banner */}
          {feedback && (
            <div
              role="status"
              className={`p-4 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                feedback.type === 'ok'
                  ? 'bg-emerald-950/70 border-emerald-700/70 text-emerald-200'
                  : 'bg-red-950/70 border-red-700/70 text-red-200'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {feedback.type === 'ok' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                aria-label="Dismiss message"
                className="text-slate-400 hover:text-white shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* TAB 1: MENTOR OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Executive Welcome & Metadata Line */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-800/80">
                <div>
                  <h2 className="font-display font-bold text-xl sm:text-2xl text-white">
                    Welcome back, {userProfile.fullName}
                  </h2>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400 mt-1">
                    <span>Mentor Handle: {userProfile.handle}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Override Bonus: +{mentorCfg?.enabled ? mentorCfg.mentorCommissionPercent : 0}% on Direct L1
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Volume Rule: {mentorCfg?.volumeMultiplier || 4}× Gifted Capital
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {isWeekend ? 'Weekend Market Pause' : 'Weekday Trading Active'}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-slate-400 font-mono tabular-nums">
                  Income Wallet Balance:{' '}
                  <strong className="text-emerald-400 text-sm">
                    ${userProfile.profitBalance.toFixed(2)}
                  </strong>
                </div>
              </div>

              {/* 4-Column KPI Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-[#0B111E] border border-slate-800 rounded-xl p-5 space-y-1.5">
                  <div className="text-xs text-slate-400">Gifted Mentor Capital</div>
                  <div className="font-mono font-bold text-2xl text-white tabular-nums">
                    ${metricsSummary.mentorGifted.toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-400 tabular-nums">
                    {giftedVaultRows.length} active vault(s) · ${metricsSummary.dailyWeekdayYieldUsd.toFixed(2)}/weekday
                  </div>
                </div>

                <div className="bg-[#0B111E] border border-slate-800 rounded-xl p-5 space-y-1.5">
                  <div className="text-xs text-slate-400">Brought L1 Volume</div>
                  <div className="font-mono font-bold text-2xl text-amber-400 tabular-nums">
                    ${metricsSummary.mentorBrought.toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-400 tabular-nums">
                    Target: ${metricsSummary.mentorRequired.toFixed(2)} ({metricsSummary.volumeProgressPct.toFixed(1)}%)
                  </div>
                </div>

                <div className="bg-[#0B111E] border border-slate-800 rounded-xl p-5 space-y-1.5">
                  <div className="text-xs text-slate-400">Total Mentor &amp; Team Earnings</div>
                  <div className="font-mono font-bold text-2xl text-emerald-400 tabular-nums">
                    ${(metricsSummary.totalCommissionEarned + metricsSummary.totalClaimedGiftedProfit).toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-400 tabular-nums">
                    Override: ${metricsSummary.mentorOverrideEarned.toFixed(2)} · Claimable: ${metricsSummary.totalClaimableNow.toFixed(2)}
                  </div>
                </div>

                <div className="bg-[#0B111E] border border-slate-800 rounded-xl p-5 space-y-1.5">
                  <div className="text-xs text-slate-400">Referred Network</div>
                  <div className="font-mono font-bold text-2xl text-white tabular-nums">
                    {downlineReferrals.length}
                  </div>
                  <div className="text-xs text-slate-400 tabular-nums">
                    {metricsSummary.l1Count} Direct L1 · {metricsSummary.fundedCount} Funded · {metricsSummary.conversionPct.toFixed(1)}% Conv.
                  </div>
                </div>
              </div>

              {/* Volume Unlock Requirement & Shareable Referral Desk (2-Column Balanced Row) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                {/* Volume Unlock Progress */}
                <div className="lg:col-span-7 bg-[#0B111E] border border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-5">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-display font-semibold text-base text-white">
                        Withdrawal Volume Unlock Progress
                      </h3>
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                          metricsSummary.isVolumeUnlocked
                            ? 'text-emerald-400'
                            : 'text-amber-300'
                        }`}
                      >
                        {metricsSummary.isVolumeUnlocked ? (
                          <>
                            <Unlock className="w-3.5 h-3.5" />
                            <span>Unlocked for Payouts</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5" />
                            <span>Volume Target Active</span>
                          </>
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Your gifted trading vault earns weekday profits immediately. Profit withdrawals unlock once your Direct Level-1 referred investors activate at least{' '}
                      <span className="text-slate-200 font-mono">
                        ${metricsSummary.mentorRequired.toFixed(2)}
                      </span>{' '}
                      in combined package volume ({mentorCfg?.volumeMultiplier || 4}× gifted capital).
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                      <span className="text-slate-300">
                        Brought: <strong className="text-white">${metricsSummary.mentorBrought.toFixed(2)}</strong>
                      </span>
                      <span className="text-amber-300 font-semibold">
                        {metricsSummary.volumeProgressPct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-slate-800/90 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          metricsSummary.isVolumeUnlocked ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${metricsSummary.volumeProgressPct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 tabular-nums">
                      <span>$0</span>
                      <span>25%</span>
                      <span>50%</span>
                      <span>75%</span>
                      <span>${metricsSummary.mentorRequired.toFixed(0)}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <span className="text-slate-300">
                      {metricsSummary.isVolumeUnlocked
                        ? 'Volume requirement completed. You can submit Mentor payout requests anytime.'
                        : `Remaining L1 volume needed: $${metricsSummary.mentorRemaining.toFixed(2)}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => selectSection('team-volume')}
                      className="text-amber-400 hover:text-amber-300 font-medium inline-flex items-center gap-1 whitespace-nowrap"
                    >
                      <span>Inspect Team Volume</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Shareable Mentor Invite Controls */}
                <div className="lg:col-span-5 bg-[#0B111E] border border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-5">
                  <div className="space-y-1">
                    <h3 className="font-display font-semibold text-base text-white">
                      Mentor Referral Credentials
                    </h3>
                    <p className="text-xs text-slate-400">
                      Share your Mentor ID or link to onboard direct L1 clients and earn +{mentorCfg?.mentorCommissionPercent || 0}% Mentor Override plus L1–L3 commissions.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="text-xs text-slate-400">Mentor Referral ID</div>
                      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="font-mono font-bold text-sm text-amber-400 truncate">
                          {userProfile.handle}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyValue('mentor-id', userProfile.handle)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-slate-300 hover:text-white shrink-0"
                        >
                          {copiedKey === 'mentor-id' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{copiedKey === 'mentor-id' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs text-slate-400">Direct Registration Link</div>
                      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="font-mono text-xs text-slate-200 truncate">
                          {referralLink}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyValue('mentor-link', referralLink)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 hover:text-amber-300 shrink-0"
                        >
                          {copiedKey === 'mentor-link' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Share2 className="w-3.5 h-3.5" />
                          )}
                          <span>{copiedKey === 'mentor-link' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-slate-400 font-mono tabular-nums">
                      {metricsSummary.clicks.toLocaleString()} link click(s)
                    </span>
                    <div className="flex items-center gap-2">
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(
                          `Join ${platformConfig.companyName} with my Mentor ID (${userProfile.handle}): ${referralLink}`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-emerald-700/80 hover:bg-emerald-600 text-white font-medium transition-colors"
                      >
                        WhatsApp
                      </a>
                      <a
                        href={`https://t.me/share/url?url=${encodeURIComponent(
                          referralLink
                        )}&text=${encodeURIComponent(
                          `Join ${platformConfig.companyName} (${userProfile.handle})`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-sky-700/80 hover:bg-sky-600 text-white font-medium transition-colors"
                      >
                        Telegram
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Gifted Vaults & Recent Commissions Split */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Active Gifted Vaults Preview */}
                <div className="bg-[#0B111E] border border-slate-800 rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display font-semibold text-base text-white">
                      Gifted Mentor Vaults ({giftedVaultRows.length})
                    </h3>
                    <button
                      type="button"
                      onClick={() => selectSection('gifted-vaults')}
                      className="text-xs font-medium text-amber-400 hover:text-amber-300"
                    >
                      Manage Vaults
                    </button>
                  </div>

                  {giftedVaultRows.length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">
                      No gifted mentor vault packages found on your account yet.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-800/80">
                      {giftedVaultRows.slice(0, 4).map(({ inv, metrics }) => {
                        const canClaim =
                          !platformConfig.globalPaused &&
                          !isWeekend &&
                          metrics.unclaimedProfit > 0.005;
                        return (
                          <div
                            key={inv.id}
                            className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="font-medium text-white truncate">
                                #{inv.packageNumber} · {inv.packageName}
                              </div>
                              <div className="text-slate-400 font-mono tabular-nums mt-0.5">
                                ${inv.capital.toFixed(2)} · {inv.dailyPercent}%/day · Day{' '}
                                {metrics.completedProfitDays}/{inv.totalProfitDays}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right font-mono tabular-nums">
                                <div className="text-emerald-400 font-semibold">
                                  +${metrics.unclaimedProfit.toFixed(2)}
                                </div>
                                <div className="text-[11px] text-slate-500">Claimable</div>
                              </div>
                              <button
                                type="button"
                                disabled={!canClaim || busyId === inv.id}
                                onClick={() => handleClaimGiftedProfit(inv)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 disabled:cursor-not-allowed text-white font-semibold transition-colors whitespace-nowrap"
                              >
                                {busyId === inv.id ? 'Claiming...' : 'Claim'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Recent Commissions Preview */}
                <div className="bg-[#0B111E] border border-slate-800 rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display font-semibold text-base text-white">
                      Recent Commission Credits
                    </h3>
                    <button
                      type="button"
                      onClick={() => selectSection('commissions')}
                      className="text-xs font-medium text-amber-400 hover:text-amber-300"
                    >
                      View Full Ledger
                    </button>
                  </div>

                  {mlmCommissions.length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">
                      No commissions credited yet. Share your Mentor Referral Link to earn overrides when clients activate packages.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-800/80">
                      {mlmCommissions.slice(0, 5).map((c) => (
                        <div
                          key={c.id}
                          className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-medium text-white truncate">
                              {c.commissionType === 'mentor'
                                ? `Mentor Override (${c.ratePercent}%)`
                                : `Level ${c.level} Referral (${c.ratePercent}%)`}{' '}
                              · {c.fromName}
                            </div>
                            <div className="text-slate-400 font-mono tabular-nums mt-0.5">
                              Volume ${c.investmentAmount.toFixed(2)} · {formatTimestamp(c.createdAt)}
                            </div>
                          </div>
                          <div className="font-mono font-semibold text-emerald-400 tabular-nums shrink-0">
                            +${c.commissionUsd.toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GIFTED VAULTS & YIELD */}
          {activeTab === 'gifted-vaults' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-slate-800/80">
                <div>
                  <h2 className="font-display font-bold text-xl text-white">
                    Gifted Mentor Vaults &amp; Daily Yield
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Track weekday algorithmic returns accrued on your Admin-gifted Mentor trading capital and claim profit to your Income Wallet.
                  </p>
                </div>
                <div className="text-xs font-mono text-slate-400 tabular-nums">
                  Claimable Across All Vaults:{' '}
                  <strong className="text-emerald-400 text-sm">
                    ${metricsSummary.totalClaimableNow.toFixed(2)}
                  </strong>
                </div>
              </div>

              {/* Yield Summary Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#0B111E] border border-slate-800 rounded-xl p-4 space-y-1">
                  <div className="text-xs text-slate-400">Total Gifted Principal</div>
                  <div className="font-mono font-bold text-xl text-white tabular-nums">
                    ${metricsSummary.mentorGifted.toFixed(2)}
                  </div>
                </div>
                <div className="bg-[#0B111E] border border-slate-800 rounded-xl p-4 space-y-1">
                  <div className="text-xs text-slate-400">Weekday Yield Rate</div>
                  <div className="font-mono font-bold text-xl text-amber-400 tabular-nums">
                    ${metricsSummary.dailyWeekdayYieldUsd.toFixed(2)}/day
                  </div>
                </div>
                <div className="bg-[#0B111E] border border-slate-800 rounded-xl p-4 space-y-1">
                  <div className="text-xs text-slate-400">Total Accrued Yield</div>
                  <div className="font-mono font-bold text-xl text-white tabular-nums">
                    ${metricsSummary.totalAccruedGiftedProfit.toFixed(2)}
                  </div>
                </div>
                <div className="bg-[#0B111E] border border-slate-800 rounded-xl p-4 space-y-1">
                  <div className="text-xs text-slate-400">Claimed to Income Wallet</div>
                  <div className="font-mono font-bold text-xl text-emerald-400 tabular-nums">
                    ${metricsSummary.totalClaimedGiftedProfit.toFixed(2)}
                  </div>
                </div>
              </div>

              {(platformConfig.globalPaused || isWeekend) && (
                <div className="p-4 rounded-xl border border-amber-700/60 bg-amber-950/40 text-xs text-amber-200 flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    {platformConfig.globalPaused
                      ? 'Profit claiming is temporarily paused while global trading maintenance is active.'
                      : 'Market weekend schedule (Saturday/Sunday): weekday profit claiming resumes Monday.'}
                  </span>
                </div>
              )}

              {/* High-Density Gifted Vault Table */}
              <div className="bg-[#0B111E] border border-slate-800 rounded-xl overflow-hidden">
                {giftedVaultRows.length === 0 ? (
                  <div className="p-10 text-center space-y-2">
                    <p className="text-sm font-medium text-white">
                      No gifted mentor vaults active
                    </p>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      When administration gifts a Mentor trading capital package to your account, it appears here with live weekday profit tracking.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400">
                        <tr>
                          <th className="py-3 px-4 font-medium">Vault &amp; AI Strategy</th>
                          <th className="py-3 px-4 font-medium text-right">Gifted Capital</th>
                          <th className="py-3 px-4 font-medium text-right">Daily Rate</th>
                          <th className="py-3 px-4 font-medium text-right">Trading Days</th>
                          <th className="py-3 px-4 font-medium text-right">Claimed</th>
                          <th className="py-3 px-4 font-medium text-right">Claimable Now</th>
                          <th className="py-3 px-4 font-medium text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {giftedVaultRows.map(({ inv, metrics }) => {
                          const canClaim =
                            !platformConfig.globalPaused &&
                            !isWeekend &&
                            metrics.unclaimedProfit > 0.005;
                          return (
                            <tr
                              key={inv.id}
                              className="hover:bg-slate-900/40 transition-colors"
                            >
                              <td className="py-3.5 px-4">
                                <div className="font-semibold text-white">
                                  Package #{inv.packageNumber} · {inv.packageName}
                                </div>
                                <div className="text-slate-400 mt-0.5">
                                  {inv.aiMode} · Started {formatTimestamp(inv.createdAt)}
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono font-semibold text-white tabular-nums">
                                ${inv.capital.toFixed(2)}
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono text-amber-300 tabular-nums">
                                {inv.dailyPercent}% (${metrics.dailyDollarTarget.toFixed(2)})
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono text-slate-300 tabular-nums">
                                {metrics.completedProfitDays} / {inv.totalProfitDays}
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono text-slate-300 tabular-nums">
                                ${inv.claimedProfit.toFixed(2)}
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono font-semibold text-emerald-400 tabular-nums">
                                ${metrics.unclaimedProfit.toFixed(2)}
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <button
                                  type="button"
                                  disabled={!canClaim || busyId === inv.id}
                                  onClick={() => handleClaimGiftedProfit(inv)}
                                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 disabled:cursor-not-allowed text-white font-semibold transition-colors whitespace-nowrap"
                                >
                                  {busyId === inv.id ? 'Claiming...' : 'Claim Yield'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: TEAM & VOLUME TRACKER */}
          {activeTab === 'team-volume' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-slate-800/80">
                <div>
                  <h2 className="font-display font-bold text-xl text-white">
                    Referred Team &amp; Volume Tracker
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Monitor Direct Level-1 client deposits counting toward your Mentor Volume Unlock target alongside Level-2 and Level-3 network growth.
                  </p>
                </div>
                <div className="text-xs font-mono text-slate-400 tabular-nums">
                  Direct L1 Volume:{' '}
                  <strong className="text-amber-400 text-sm">
                    ${metricsSummary.directL1Volume.toFixed(2)}
                  </strong>{' '}
                  · Total Network:{' '}
                  <strong className="text-white text-sm">
                    ${metricsSummary.totalTeamVolume.toFixed(2)}
                  </strong>
                </div>
              </div>

              {/* Filter & Search Toolbar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center p-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                    {(['all', 1, 2, 3] as const).map((lvl) => (
                      <button
                        key={String(lvl)}
                        type="button"
                        onClick={() => setTeamLevelFilter(lvl)}
                        className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
                          teamLevelFilter === lvl
                            ? 'bg-amber-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {lvl === 'all' ? 'All Levels' : `Level ${lvl}`}
                      </button>
                    ))}
                  </div>

                  <div className="inline-flex items-center p-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                    {(
                      [
                        { id: 'all', label: 'All Members' },
                        { id: 'funded', label: 'Funded Only' },
                        { id: 'unfunded', label: 'Registered Only' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setTeamFundedFilter(opt.id)}
                        className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
                          teamFundedFilter === opt.id
                            ? 'bg-slate-700 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative w-full md:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={teamSearch}
                    onChange={(e) => setTeamSearch(e.target.value)}
                    placeholder="Search client name or handle..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-800 bg-slate-900 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Team Data Table */}
              <div className="bg-[#0B111E] border border-slate-800 rounded-xl overflow-hidden">
                {filteredDownline.length === 0 ? (
                  <div className="p-10 text-center space-y-2">
                    <p className="text-sm font-medium text-white">
                      {downlineReferrals.length === 0
                        ? 'No referred clients yet'
                        : 'No team members match your filters'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {downlineReferrals.length === 0
                        ? 'Share your Mentor Referral Link from Overview to onboard clients and build your volume.'
                        : 'Try clearing your search query or switching level filters.'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400">
                        <tr>
                          <th className="py-3 px-4 font-medium">Client Name &amp; Handle</th>
                          <th className="py-3 px-4 font-medium">Tier</th>
                          <th className="py-3 px-4 font-medium">Joined</th>
                          <th className="py-3 px-4 font-medium">Status</th>
                          <th className="py-3 px-4 font-medium text-right">Invested Volume</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {filteredDownline.map((r) => {
                          const invested = Number(r.totalInvestedUsd || 0);
                          return (
                            <tr
                              key={r.id}
                              className="hover:bg-slate-900/40 transition-colors"
                            >
                              <td className="py-3.5 px-4">
                                <div className="font-medium text-white">{r.refereeName}</div>
                                <div className="font-mono text-[11px] text-slate-400">
                                  {r.refereeHandle}
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-slate-300">
                                {r.level === 1
                                  ? 'Direct Level 1 (Counts for Unlock)'
                                  : `Network Level ${r.level}`}
                              </td>
                              <td className="py-3.5 px-4 font-mono text-slate-400 tabular-nums">
                                {formatTimestamp(r.createdAt)}
                              </td>
                              <td className="py-3.5 px-4">
                                <span
                                  className={
                                    invested > 0
                                      ? 'text-emerald-400 font-medium'
                                      : 'text-slate-400'
                                  }
                                >
                                  {invested > 0 ? 'Funded Investor' : 'Registered'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono font-semibold text-white tabular-nums">
                                ${invested.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: OVERRIDE COMMISSIONS */}
          {activeTab === 'commissions' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-slate-800/80">
                <div>
                  <h2 className="font-display font-bold text-xl text-white">
                    Mentor Override &amp; Referral Commissions
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Breakdown of all automatic Income Wallet commission payouts earned across your Mentor Override and 3-tier referral network.
                  </p>
                </div>
                <div className="text-xs font-mono text-slate-400 tabular-nums">
                  Lifetime Commissions:{' '}
                  <strong className="text-emerald-400 text-sm">
                    ${metricsSummary.totalCommissionEarned.toFixed(2)}
                  </strong>
                </div>
              </div>

              {/* 4-Column Commission Tier Totals */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#0B111E] border border-amber-500/35 rounded-xl p-4 space-y-1">
                  <div className="text-xs text-amber-300">
                    Mentor Override (+{mentorCfg?.enabled ? mentorCfg.mentorCommissionPercent : 0}%)
                  </div>
                  <div className="font-mono font-bold text-xl text-amber-400 tabular-nums">
                    ${metricsSummary.mentorOverrideEarned.toFixed(2)}
                  </div>
                </div>
                <div className="bg-[#0B111E] border border-slate-800 rounded-xl p-4 space-y-1">
                  <div className="text-xs text-slate-400">
                    Level 1 Direct ({platformConfig.mlmRates.level1}%)
                  </div>
                  <div className="font-mono font-bold text-xl text-emerald-400 tabular-nums">
                    ${metricsSummary.level1Earned.toFixed(2)}
                  </div>
                </div>
                <div className="bg-[#0B111E] border border-slate-800 rounded-xl p-4 space-y-1">
                  <div className="text-xs text-slate-400">
                    Level 2 Network ({platformConfig.mlmRates.level2}%)
                  </div>
                  <div className="font-mono font-bold text-xl text-sky-400 tabular-nums">
                    ${metricsSummary.level2Earned.toFixed(2)}
                  </div>
                </div>
                <div className="bg-[#0B111E] border border-slate-800 rounded-xl p-4 space-y-1">
                  <div className="text-xs text-slate-400">
                    Level 3 Network ({platformConfig.mlmRates.level3}%)
                  </div>
                  <div className="font-mono font-bold text-xl text-slate-200 tabular-nums">
                    ${metricsSummary.level3Earned.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="inline-flex items-center p-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                  {(
                    [
                      { id: 'all', label: 'All Credits' },
                      { id: 'mentor', label: 'Mentor Overrides' },
                      { id: 'referral', label: 'Standard L1–L3' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setCommFilter(opt.id)}
                      className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
                        commFilter === opt.id
                          ? 'bg-amber-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="relative w-full md:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={commSearch}
                    onChange={(e) => setCommSearch(e.target.value)}
                    placeholder="Search investor name..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-800 bg-slate-900 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Commissions Table */}
              <div className="bg-[#0B111E] border border-slate-800 rounded-xl overflow-hidden">
                {filteredCommissions.length === 0 ? (
                  <div className="p-10 text-center space-y-2">
                    <p className="text-sm font-medium text-white">No commission records found</p>
                    <p className="text-xs text-slate-400">
                      Mentor Override and Level 1–3 referral commissions credit instantly whenever your team funds an AI trading package.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400">
                        <tr>
                          <th className="py-3 px-4 font-medium">Commission Type</th>
                          <th className="py-3 px-4 font-medium">From Investor</th>
                          <th className="py-3 px-4 font-medium text-right">Package Volume</th>
                          <th className="py-3 px-4 font-medium text-right">Rate</th>
                          <th className="py-3 px-4 font-medium">Date</th>
                          <th className="py-3 px-4 font-medium text-right">Credited</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {filteredCommissions.map((c) => (
                          <tr
                            key={c.id}
                            className="hover:bg-slate-900/40 transition-colors"
                          >
                            <td className="py-3.5 px-4 font-medium">
                              <span
                                className={
                                  c.commissionType === 'mentor'
                                    ? 'text-amber-300'
                                    : 'text-slate-200'
                                }
                              >
                                {c.commissionType === 'mentor'
                                  ? 'Mentor Override Bonus'
                                  : `Level ${c.level} Referral`}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-white">{c.fromName}</td>
                            <td className="py-3.5 px-4 text-right font-mono text-slate-300 tabular-nums">
                              ${c.investmentAmount.toFixed(2)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-slate-300 tabular-nums">
                              {c.ratePercent}%
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-400 tabular-nums">
                              {formatTimestamp(c.createdAt)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-semibold text-emerald-400 tabular-nums">
                              +${c.commissionUsd.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: MENTOR PAYOUTS */}
          {activeTab === 'payouts' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-slate-800/80">
                <div>
                  <h2 className="font-display font-bold text-xl text-white">
                    Mentor Payouts &amp; Settlement Tracker
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Request Mentor profit and commission payouts from your Income Wallet and track Pending vs Processed settlements.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
                  <span className="text-slate-400">
                    Available:{' '}
                    <strong className="text-emerald-400">
                      ${userProfile.profitBalance.toFixed(2)}
                    </strong>
                  </span>
                  <span className="text-slate-400">
                    Pending:{' '}
                    <strong className="text-amber-300">
                      ${metricsSummary.pendingPayoutsUsd.toFixed(2)}
                    </strong>
                  </span>
                  <span className="text-slate-400">
                    Processed:{' '}
                    <strong className="text-white">
                      ${metricsSummary.processedPayoutsUsd.toFixed(2)}
                    </strong>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Payout Request Form */}
                <div className="lg:col-span-5 bg-[#0B111E] border border-slate-800 rounded-xl p-6 space-y-4">
                  <h3 className="font-display font-semibold text-base text-white">
                    Request Mentor Payout
                  </h3>

                  {!metricsSummary.isVolumeUnlocked && (
                    <div className="p-3.5 rounded-lg border border-amber-700/60 bg-amber-950/40 text-xs text-amber-200 space-y-1">
                      <div className="font-semibold flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Mentor Volume Requirement Active</span>
                      </div>
                      <p className="text-amber-200/85 leading-relaxed">
                        Bring{' '}
                        <strong className="font-mono text-white">
                          ${metricsSummary.mentorRemaining.toFixed(2)}
                        </strong>{' '}
                        more in Direct L1 referred volume (${metricsSummary.mentorBrought.toFixed(2)} /{' '}
                        ${metricsSummary.mentorRequired.toFixed(2)}) to unlock profit withdrawals.
                      </p>
                    </div>
                  )}

                  {platformConfig.withdrawalsPaused && (
                    <div className="p-3.5 rounded-lg border border-red-700/60 bg-red-950/40 text-xs text-red-200 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>Withdrawals are temporarily paused by administration.</span>
                    </div>
                  )}

                  {kycBlockedForWithdraw && (
                    <div className="p-3.5 rounded-lg border border-amber-700/60 bg-amber-950/40 text-xs text-amber-200 flex items-center justify-between gap-2">
                      <span>KYC approval is required before requesting payouts.</span>
                      <button
                        type="button"
                        onClick={onSwitchToClientVault}
                        className="underline font-semibold text-amber-300 shrink-0"
                      >
                        Verify in Vault
                      </button>
                    </div>
                  )}

                  {savedPaymentMethods.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-xs text-slate-400">Saved Payout Accounts</div>
                      <div className="flex flex-wrap gap-1.5">
                        {savedPaymentMethods.map((pm) => (
                          <button
                            key={pm.id}
                            type="button"
                            onClick={() => {
                              setWdNetwork(pm.methodId);
                              setWdAddress(pm.accountAddress);
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:border-amber-500/60 text-xs text-slate-200 transition-colors"
                          >
                            {pm.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleSubmitMentorPayout} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Payout Channel
                      </label>
                      <select
                        value={activeWithdrawNetworkId}
                        onChange={(e) => setWdNetwork(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-700 bg-slate-900 text-white text-xs focus:outline-none focus:border-amber-500"
                      >
                        {enabledWithdrawMethods.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} (Min ${Math.max(platformConfig.minWithdrawalUsd, m.minWithdrawalUsd || 0)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-slate-300">
                          Amount (USD)
                        </label>
                        <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                          Min ${minWithdrawUsd.toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        min={minWithdrawUsd}
                        required
                        value={wdAmount}
                        onChange={(e) => setWdAmount(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-900 text-white font-mono text-sm tabular-nums focus:outline-none focus:border-amber-500"
                      />
                      <div className="grid grid-cols-4 gap-1.5 mt-2">
                        {[
                          { label: '25%', mult: 0.25 },
                          { label: '50%', mult: 0.5 },
                          { label: '75%', mult: 0.75 },
                          { label: 'MAX', mult: 1 },
                        ].map((pct) => (
                          <button
                            key={pct.label}
                            type="button"
                            onClick={() =>
                              setWdAmount(
                                Math.max(0, userProfile.profitBalance * pct.mult).toFixed(2)
                              )
                            }
                            className="py-1.5 rounded-md border border-slate-800 bg-slate-900 hover:bg-slate-800 text-[11px] font-mono text-slate-300 hover:text-white transition-colors"
                          >
                            {pct.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Destination Wallet / Account
                      </label>
                      <input
                        type="text"
                        required
                        value={wdAddress}
                        onChange={(e) => setWdAddress(e.target.value)}
                        placeholder={`Enter receiving ${selectedWithdrawMethod?.name || 'payout'} address`}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-900 text-white font-mono text-xs placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={saveMethodAfter}
                        onChange={(e) => setSaveMethodAfter(e.target.checked)}
                      />
                      <span>Save payout destination for future requests</span>
                    </label>

                    <button
                      type="submit"
                      disabled={
                        wdSubmitting ||
                        !metricsSummary.isVolumeUnlocked ||
                        Boolean(platformConfig.withdrawalsPaused) ||
                        kycBlockedForWithdraw ||
                        enabledWithdrawMethods.length === 0
                      }
                      className="w-full py-2.5 px-4 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
                    >
                      {wdSubmitting
                        ? 'Submitting Request...'
                        : !metricsSummary.isVolumeUnlocked
                        ? 'Unlock Volume Target to Withdraw'
                        : 'Submit Mentor Payout Request'}
                    </button>
                  </form>
                </div>

                {/* Settlement Status Tracker */}
                <div className="lg:col-span-7 bg-[#0B111E] border border-slate-800 rounded-xl p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h3 className="font-display font-semibold text-base text-white">
                      Payout Settlement History ({filteredWithdrawals.length})
                    </h3>
                    <div className="inline-flex items-center p-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                      {(
                        [
                          { id: 'all', label: 'All' },
                          { id: 'pending', label: 'Pending' },
                          { id: 'processed', label: 'Processed' },
                          { id: 'rejected', label: 'Rejected' },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setPayoutStatusFilter(tab.id)}
                          className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
                            payoutStatusFilter === tab.id
                              ? 'bg-amber-600 text-white'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={payoutSearch}
                      onChange={(e) => setPayoutSearch(e.target.value)}
                      placeholder="Filter by request ID, wallet, channel, or TXID..."
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-800 bg-slate-900 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {filteredWithdrawals.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400">
                      No payout requests match this filter.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800/80">
                      {filteredWithdrawals.map((w) => {
                        const isProcessed =
                          w.status === 'approved' || w.status === 'completed';
                        const isRejected = w.status === 'rejected';
                        const sourceLabel =
                          w.source === 'mentor_profit'
                            ? 'Mentor Profit'
                            : w.source === 'mlm_commission'
                            ? 'Referral Commission'
                            : w.source === 'elite_capital'
                            ? 'Capital Unlock'
                            : 'Trading Profit';
                        return (
                          <div key={w.id} className="py-3.5 first:pt-0 last:pb-0 space-y-2 text-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono font-semibold text-white tabular-nums text-sm">
                                  ${w.amountUsd.toFixed(2)}
                                </span>
                                <span className="text-slate-500">·</span>
                                <span className="text-slate-300">{sourceLabel}</span>
                                <span className="text-slate-500">·</span>
                                <span className="font-mono text-slate-400">
                                  {w.network.replace(/_/g, ' ')}
                                </span>
                              </div>
                              <span
                                className={`inline-flex items-center gap-1 font-semibold ${
                                  isProcessed
                                    ? 'text-emerald-400'
                                    : isRejected
                                    ? 'text-red-400'
                                    : 'text-amber-300'
                                }`}
                              >
                                {isProcessed ? (
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                ) : isRejected ? (
                                  <XCircle className="w-3.5 h-3.5" />
                                ) : (
                                  <Clock className="w-3.5 h-3.5" />
                                )}
                                <span>
                                  {isProcessed
                                    ? 'Processed'
                                    : isRejected
                                    ? 'Rejected (Refunded)'
                                    : 'Pending Review'}
                                </span>
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 font-mono">
                              <span className="truncate max-w-xs">
                                To: {w.destinationAddress}
                              </span>
                              <span className="tabular-nums">
                                {formatTimestamp(w.createdAt)}
                              </span>
                            </div>

                            {w.adminNote && (
                              <div className="flex items-center justify-between gap-2 text-[11px] text-slate-300 bg-slate-900/70 px-3 py-1.5 rounded-lg border border-slate-800">
                                <span className="truncate font-mono">
                                  Settlement Ref: {w.adminNote}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => copyValue(`tx-${w.id}`, w.adminNote)}
                                  className="text-amber-400 hover:text-amber-300 shrink-0"
                                >
                                  {copiedKey === `tx-${w.id}` ? 'Copied' : 'Copy'}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
