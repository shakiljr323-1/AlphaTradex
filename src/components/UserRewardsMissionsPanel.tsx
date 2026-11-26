import React, { useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Flame,
  Gift,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Investment,
  ReferralLinkRecord,
  UserMissionProfile,
  UserProfile,
  WhitelistedWallet,
} from '../types/platform';

interface UserRewardsMissionsPanelProps {
  userProfile: UserProfile;
  missionProfile: UserMissionProfile | null;
  investments: Investment[];
  downlineReferrals: ReferralLinkRecord[];
  whitelistedWallets: WhitelistedWallet[];
  onClaimDailyCheckIn: () => Promise<{ streak: number; xpEarned: number }>;
  onClaimMissionReward: (missionId: string, xpReward: number, badgeName: string) => Promise<void>;
  onNavigateToTab: (tab: string) => void;
  onNotify: (type: 'ok' | 'err', text: string) => void;
}

interface MissionDef {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  badgeName: string;
  completed: boolean;
  actionTab: string;
  actionLabel: string;
  Icon: React.ComponentType<{ className?: string }>;
}

function getTodayUtcKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export const UserRewardsMissionsPanel: React.FC<UserRewardsMissionsPanelProps> = ({
  userProfile,
  missionProfile,
  investments,
  downlineReferrals,
  whitelistedWallets,
  onClaimDailyCheckIn,
  onClaimMissionReward,
  onNavigateToTab,
  onNotify,
}) => {
  const [busyId, setBusyId] = useState<string | null>(null);

  const todayKey = getTodayUtcKey();
  const checkedInToday = missionProfile?.lastCheckInDayKey === todayKey;
  const currentStreak = missionProfile?.currentStreak || 0;
  const longestStreak = missionProfile?.longestStreak || 0;
  const totalXp = missionProfile?.totalXp || 0;
  const claimedIds = missionProfile?.claimedMissionIds || [];
  const badges = missionProfile?.badges || [];

  const tierInfo = useMemo(() => {
    if (totalXp >= 1500) return { name: 'Platinum Sentinel', nextXp: 2500, color: 'text-amber-300' };
    if (totalXp >= 800) return { name: 'Gold Strategist', nextXp: 1500, color: 'text-amber-400' };
    if (totalXp >= 300) return { name: 'Silver Trader', nextXp: 800, color: 'text-sky-300' };
    return { name: 'Bronze Member', nextXp: 300, color: 'text-emerald-300' };
  }, [totalXp]);

  const missions: MissionDef[] = useMemo(
    () => [
      {
        id: 'mission_kyc_verified',
        title: 'Complete Identity Verification (KYC)',
        description: 'Submit and verify your KYC documents for full institutional withdrawal access.',
        xpReward: 250,
        badgeName: 'Verified Member',
        completed: userProfile.kycStatus === 'approved',
        actionTab: 'kyc-verification',
        actionLabel: 'Go to KYC',
        Icon: ShieldCheck,
      },
      {
        id: 'mission_whitelist_wallet',
        title: 'Secure Withdrawal Address Whitelist',
        description: 'Add at least one trusted USDT withdrawal wallet in your Security Center.',
        xpReward: 150,
        badgeName: 'Vault Guardian',
        completed: whitelistedWallets.length > 0,
        actionTab: 'security-center',
        actionLabel: 'Open Security',
        Icon: Wallet,
      },
      {
        id: 'mission_first_package',
        title: 'Activate Your First AI Trading Package',
        description: 'Start any Starter, Growth, Pro, or Elite package inside your Vault.',
        xpReward: 400,
        badgeName: 'Active Investor',
        completed: investments.length > 0,
        actionTab: 'activate-trading',
        actionLabel: 'View Packages',
        Icon: Sparkles,
      },
      {
        id: 'mission_first_referral',
        title: 'Invite Your First Team Member',
        description: 'Share your personal referral link or marketing card and onboard 1 member.',
        xpReward: 350,
        badgeName: 'Team Builder',
        completed: downlineReferrals.length > 0,
        actionTab: 'referral-network',
        actionLabel: 'Invite Team',
        Icon: Users,
      },
      {
        id: 'mission_streak_3',
        title: 'Achieve a 3-Day Check-In Streak',
        description: 'Check in for 3 consecutive days to build momentum and climb the leaderboard.',
        xpReward: 200,
        badgeName: 'Consistent Trader',
        completed: longestStreak >= 3 || currentStreak >= 3,
        actionTab: 'rewards-missions',
        actionLabel: 'Check In Daily',
        Icon: Flame,
      },
    ],
    [
      userProfile.kycStatus,
      whitelistedWallets.length,
      investments.length,
      downlineReferrals.length,
      longestStreak,
      currentStreak,
    ]
  );

  const handleCheckIn = async () => {
    setBusyId('daily');
    try {
      const res = await onClaimDailyCheckIn();
      onNotify(
        'ok',
        `Daily Check-In complete! Day ${res.streak} streak achieved (+${res.xpEarned} XP).`
      );
    } catch (e) {
      onNotify('err', e instanceof Error ? e.message : 'Unable to claim daily check-in.');
    } finally {
      setBusyId(null);
    }
  };

  const handleClaimMission = async (m: MissionDef) => {
    setBusyId(m.id);
    try {
      await onClaimMissionReward(m.id, m.xpReward, m.badgeName);
      onNotify('ok', `Mission claimed! Earned +${m.xpReward} XP and the "${m.badgeName}" badge.`);
    } catch (e) {
      onNotify('err', e instanceof Error ? e.message : 'Unable to claim mission reward.');
    } finally {
      setBusyId(null);
    }
  };

  const streakDays = [1, 2, 3, 4, 5, 6, 7];
  const progressInCycle = currentStreak % 7 === 0 && currentStreak > 0 ? 7 : currentStreak % 7;

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-[#0B111E] via-[#131F3A] to-[#1A1A2E] border border-slate-800 rounded-2xl p-6 text-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-400/30 text-amber-300 text-[11px] font-semibold">
              <Flame className="w-3.5 h-3.5" />
              Engagement Rewards &amp; Leaderboard XP
            </div>
            <h2 className="font-display font-bold text-xl">
              Daily Check-In Streak &amp; Platform Missions
            </h2>
            <p className="text-xs text-slate-300 max-w-xl">
              Check in every day to build your streak, unlock official AlphaTradex profile badges,
              and earn XP points linked to your Top Performers community standing.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-right">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                Current Rank Tier
              </div>
              <div className={`font-display font-bold text-sm ${tierInfo.color}`}>
                {tierInfo.name}
              </div>
              <div className="font-mono text-xs text-white mt-0.5">
                {totalXp.toLocaleString()} XP
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateToTab('leaderboard')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition"
            >
              <Trophy className="w-4 h-4" />
              Leaderboard
            </button>
          </div>
        </div>
      </div>

      {/* 7-Day Daily Check-In Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display font-bold text-slate-900 text-base flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              7-Day Check-In Streak Tracker
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Current Streak: <strong className="text-slate-900">{currentStreak} days</strong> &bull;
              Best Streak: <strong className="text-slate-900">{longestStreak} days</strong> &bull;
              Total Check-Ins: <strong className="text-slate-900">{missionProfile?.totalCheckIns || 0}</strong>
            </p>
          </div>

          <button
            type="button"
            disabled={checkedInToday || busyId === 'daily'}
            onClick={() => void handleCheckIn()}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition ${
              checkedInToday
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 cursor-default'
                : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-sm'
            }`}
          >
            {checkedInToday ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Checked In Today
              </>
            ) : (
              <>
                <Gift className="w-4 h-4" />
                {busyId === 'daily' ? 'Claiming...' : 'Claim Daily Check-In (+25 XP)'}
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {streakDays.map((day) => {
            const done = day <= progressInCycle;
            const xpVal = day === 7 ? 100 : 25 + (day - 1) * 5;
            return (
              <div
                key={day}
                className={`rounded-xl border p-3 text-center transition ${
                  done
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : day === 7
                    ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <div className="text-[10px] font-bold uppercase">Day {day}</div>
                <div className="my-1.5 flex justify-center">
                  {done ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : day === 7 ? (
                    <Star className="w-5 h-5 text-amber-500" />
                  ) : (
                    <Flame className="w-5 h-5 text-slate-300" />
                  )}
                </div>
                <div className="font-mono text-[11px] font-bold">+{xpVal} XP</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Earned Badges Shelf */}
      {badges.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <h3 className="font-display font-bold text-slate-900 text-sm flex items-center gap-2 mb-3">
            <Award className="w-4 h-4 text-amber-500" />
            Your Unlocked Badges ({badges.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {badges.map((b) => (
              <span
                key={b}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold"
              >
                <Award className="w-3.5 h-3.5 text-amber-600" />
                {b}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Platform Missions Grid */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div>
          <h3 className="font-display font-bold text-slate-900 text-base">
            Platform Milestones &amp; Bonus Missions
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete key account milestones to unlock verified badges and leaderboard XP.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {missions.map((m) => {
            const claimed = claimedIds.includes(m.id);
            const Icon = m.Icon;
            return (
              <div
                key={m.id}
                className={`rounded-xl border p-4 flex flex-col justify-between gap-4 ${
                  claimed
                    ? 'bg-emerald-50/40 border-emerald-200'
                    : m.completed
                    ? 'bg-amber-50/40 border-amber-300'
                    : 'bg-slate-50/60 border-slate-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      claimed
                        ? 'bg-emerald-100 text-emerald-700'
                        : m.completed
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-200/70 text-slate-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="font-bold text-xs text-slate-900">{m.title}</div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{m.description}</p>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 text-amber-300">
                        +{m.xpReward} XP
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                        Badge: {m.badgeName}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  {claimed ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                      <CheckCircle2 className="w-4 h-4" />
                      Reward Claimed
                    </span>
                  ) : m.completed ? (
                    <button
                      type="button"
                      disabled={busyId === m.id}
                      onClick={() => void handleClaimMission(m)}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition disabled:opacity-50"
                    >
                      {busyId === m.id ? 'Claiming...' : `Claim +${m.xpReward} XP`}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onNavigateToTab(m.actionTab)}
                      className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition"
                    >
                      {m.actionLabel}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
