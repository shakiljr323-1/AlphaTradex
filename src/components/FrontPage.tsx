import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  Bot,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  ExternalLink,
  FileCheck,
  Globe,
  IdCard,
  Lock,
  Shield,
  ShieldCheck,
  Star,
  TrendingUp,
  Upload,
  Users,
} from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { IdType, NavSection } from '../types/platform';
import { compressImageToDataUrl, isWeekendDate } from '../utils/investmentMath';

interface FrontPageProps {
  activeSection: NavSection;
  onSelectSection: (s: NavSection) => void;
  authMode: 'signin' | 'signup';
  setAuthMode: (mode: 'signin' | 'signup') => void;
  authCardRef: React.RefObject<HTMLDivElement | null>;
  onOpenDashboard?: (targetNav?: 'dashboard' | 'forex-market') => void;
}

export const FrontPage: React.FC<FrontPageProps> = ({
  activeSection,
  onSelectSection,
  authMode,
  setAuthMode,
  authCardRef,
  onOpenDashboard,
}) => {
  const {
    authUser,
    userProfile,
    platformConfig,
    signInWithGoogle,
    signInWithEmail,
    signUpWithKyc,
  } = usePlatform();

  // Sign-In state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Sign-Up (KYC) state
  const [fullName, setFullName] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [idType, setIdType] = useState<IdType>('NID');
  const [idNumber, setIdNumber] = useState('');
  const [idPhotoData, setIdPhotoData] = useState('');
  const [portraitPhotoData, setPortraitPhotoData] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [copiedMint, setCopiedMint] = useState(false);

  const idFileRef = useRef<HTMLInputElement | null>(null);
  const portraitFileRef = useRef<HTMLInputElement | null>(null);

  // Capture ?ref= from URL automatically
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      setReferralCode(ref.trim().toUpperCase());
      localStorage.setItem('vtv_pending_ref', ref.trim().toUpperCase());
    }
  }, []);

  const isWeekend = isWeekendDate(new Date());

  const handleCopyMint = () => {
    navigator.clipboard.writeText(platformConfig.pumpFunToken.mintAddress);
    setCopiedMint(true);
    setTimeout(() => setCopiedMint(false), 1800);
  };

  const handlePhotoUpload = async (
    file: File | undefined,
    setter: (dataUrl: string) => void
  ) => {
    if (!file) return;
    setErrorMsg('');
    try {
      const compressed = await compressImageToDataUrl(file, 480, 0.65);
      setter(compressed);
    } catch {
      setErrorMsg('Unable to process the selected image. Please choose a valid JPG or PNG.');
    }
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);
    try {
      await signInWithEmail(loginEmail, loginPassword);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setErrorMsg(
          'Email/Password sign-in is not yet enabled in Firebase Console (Authentication -> Sign-in method -> Email/Password). Use "Continue with Google" below for instant access.'
        );
      } else if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setErrorMsg('Invalid email or password. Please verify your credentials or sign in with Google.');
      } else {
        setErrorMsg((err as Error)?.message || 'Sign in failed.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!fullName.trim() || !regEmail.trim() || regPassword.length < 6 || !idNumber.trim()) {
      setErrorMsg('Please complete all required registration and ID verification fields.');
      return;
    }
    if (!idPhotoData || !portraitPhotoData) {
      setErrorMsg('Please upload both your Identity Document Photo and Client Portrait Photo for KYC.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await signUpWithKyc({
        email: regEmail,
        password: regPassword,
        fullName,
        referralCode,
        idType,
        idNumber,
        idPhotoData,
        portraitPhotoData,
      });
      if (result.needsEmailVerification) {
        setSuccessMsg(
          'Registration created! A verification email has been sent to your inbox. Verify your email to activate your Vault.'
        );
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setErrorMsg(
          'Email/Password registration is not yet enabled in Firebase Console (Authentication -> Sign-in method -> Email/Password). Click "Continue with Google" below to enter immediately and submit KYC inside your Vault.'
        );
      } else if (code === 'auth/email-already-in-use') {
        setErrorMsg('This email is already registered. Switch to Sign In or use Continue with Google.');
      } else {
        setErrorMsg((err as Error)?.message || 'Registration failed.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);
    try {
      await signInWithGoogle(referralCode);
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Google authentication was cancelled or failed.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const idLabel =
    idType === 'NID'
      ? 'National ID (NID) Number *'
      : idType === 'Passport'
      ? 'Passport Number *'
      : 'Driving License Number *';

  const idPlaceholder =
    idType === 'NID'
      ? 'Enter 10-17 digit NID number'
      : idType === 'Passport'
      ? 'Enter passport document number'
      : 'Enter driving license number';

  return (
    <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: Dynamic Module Preview + Company Details + Trust & Security + Disclosure */}
        <div className="lg:col-span-7 space-y-6">
          {/* Hero Title & Kicker */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-semibold text-orange-400">
              <span>Institutional Multi-Asset Portal</span>
              <span aria-hidden="true">·</span>
              <span>LIVE AI Robot Execution</span>
              <span aria-hidden="true">·</span>
              <span className={isWeekend ? 'text-amber-400' : 'text-emerald-400'}>
                {isWeekend ? 'Weekend Rest (Sat–Sun)' : 'Mon–Fri Trading Active'}
              </span>
            </div>

            <h1 className="font-display font-extrabold text-white text-3xl sm:text-4xl tracking-tight leading-tight max-w-2xl drop-shadow-sm">
              {platformConfig.companyName}
            </h1>
            <p className="text-slate-300 text-base leading-relaxed max-w-2xl">
              {platformConfig.companyTagline}
            </p>
          </div>

          {/* Dynamic Module Preview Card controlled by Top Nav links */}
          <div className="bg-[#0B111E]/76 backdrop-blur-md border border-slate-700/70 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
            <div className="bg-[#070C17]/90 border-b border-slate-800/80 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-200">
                <TrendingUp className="w-4 h-4 text-orange-500" />
                <span>
                  {activeSection === 'home' && 'Institutional Vault & 200-Day Overview'}
                  {activeSection === 'plans' && '200 Profit-Day Investment Packages'}
                  {activeSection === 'ai-trading' && 'Weekday AI Robot Execution Desk (Mon–Fri)'}
                  {activeSection === 'forex' && 'Live Forex Market Charts · Direct Trading Upcoming'}
                  {activeSection === 'pump-fun' && `Official Pump.fun Coin · $${platformConfig.pumpFunToken.ticker}`}
                  {activeSection === 'mentor-referral' && 'All-Plan Referral Program (Levels 1–3)'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {(['home', 'plans', 'ai-trading', 'forex', 'pump-fun', 'mentor-referral'] as NavSection[]).map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => onSelectSection(sec)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                      activeSection === sec
                        ? 'bg-orange-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    {sec === 'home'
                      ? 'Overview'
                      : sec === 'plans'
                      ? 'Plans'
                      : sec === 'ai-trading'
                      ? 'AI Desk'
                      : sec === 'forex'
                      ? 'Forex'
                      : sec === 'pump-fun'
                      ? 'Meme Coin'
                      : 'Referral'}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5 sm:p-6">
              {activeSection === 'home' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {platformConfig.packages.map((pkg) => (
                      <div
                        key={pkg.id}
                        className="p-3.5 rounded-xl bg-slate-900/75 border border-slate-700/70 space-y-1"
                      >
                        <div className="text-xs font-semibold text-slate-400">{pkg.name}</div>
                        <div className="font-mono font-bold text-lg text-white tabular-nums">
                          ${pkg.capital.toLocaleString()}
                        </div>
                        <div className="text-xs font-mono font-semibold text-emerald-400 tabular-nums">
                          {pkg.dailyPercent}% / day
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">{pkg.aiMode}</div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-slate-900/65 border border-slate-700/60">
                      <div className="font-semibold text-white mb-0.5">200 Profit-Day Cycle</div>
                      <div className="text-slate-300">
                        Earning Mon–Fri only (~280 calendar days). Sat–Sun marked Weekend Rest.
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-900/65 border border-slate-700/60">
                      <div className="font-semibold text-white mb-0.5">
                        Instant Profit (${platformConfig.minWithdrawalUsd} Min)
                      </div>
                      <div className="text-slate-300">
                        Automated instant profit payouts; Elite capital unlocks after{' '}
                        {platformConfig.eliteCapitalLockDays} calendar days.
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-900/65 border border-slate-700/60">
                      <div className="font-semibold text-white mb-0.5">All-Plan Referral &amp; Multi-Payment</div>
                      <div className="text-slate-300">
                        L1/L2/L3 commissions active on all plans · Flexible Crypto, Pay ID &amp; Bank channels.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectSection('forex')}
                      className="p-3 rounded-lg bg-slate-900/65 border border-orange-500/40 hover:border-orange-400 text-left transition-colors"
                    >
                      <div className="font-semibold text-white mb-0.5 flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-orange-400" />
                          Forex Market Charts
                        </span>
                        <span className="text-[10px] font-mono text-orange-400">Trading Upcoming</span>
                      </div>
                      <div className="text-slate-300">
                        Inspect live FX &amp; XAU/USD charts now — direct Buy/Sell Forex execution launching soon.
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {activeSection === 'plans' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-white text-base">
                      Institutional 200 Profit-Day Packages
                    </h3>
                    <span className="text-xs font-mono text-emerald-400">AI + Referral Active on All Tiers</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-700/80 text-slate-400">
                          <th className="py-2 pr-3 font-medium">Tier</th>
                          <th className="py-2 pr-3 font-medium">Capital</th>
                          <th className="py-2 pr-3 font-medium">Daily Target</th>
                          <th className="py-2 pr-3 font-medium">AI Strategy</th>
                          <th className="py-2 font-medium">Capital Lock</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {platformConfig.packages.map((pkg) => (
                          <tr key={pkg.id}>
                            <td className="py-2.5 pr-3 font-semibold text-white">{pkg.name}</td>
                            <td className="py-2.5 pr-3 font-mono font-bold text-slate-100 tabular-nums">
                              ${pkg.capital.toLocaleString()}
                            </td>
                            <td className="py-2.5 pr-3 font-mono font-semibold text-emerald-400 tabular-nums">
                              {pkg.dailyPercent}% (${((pkg.capital * pkg.dailyPercent) / 100).toFixed(2)}/d)
                            </td>
                            <td className="py-2.5 pr-3 text-slate-300">{pkg.aiMode}</td>
                            <td className="py-2.5 font-mono text-slate-300 tabular-nums">
                              {pkg.id === 'elite'
                                ? `${platformConfig.eliteCapitalLockDays} Cal. Days`
                                : `${pkg.profitDays} Profit Days`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeSection === 'ai-trading' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bot className="w-5 h-5 text-orange-400" />
                      <h3 className="font-display font-bold text-white text-base">
                        Algorithmic Weekday Execution Desk
                      </h3>
                    </div>
                    <span className="text-xs font-mono text-emerald-400">
                      {isWeekend ? 'Weekend Rest' : 'Active Mon–Fri Session'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {platformConfig.packages.map((pkg) => (
                      <div key={pkg.id} className="p-3.5 rounded-xl border border-slate-700/70 bg-slate-900/70">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-white">{pkg.aiMode}</span>
                          <span className="text-xs font-mono text-orange-400 font-semibold">{pkg.name}</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">{pkg.description}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900/70 border border-slate-700/70 rounded-lg px-3.5 py-2.5">
                    <Calendar className="w-4 h-4 text-orange-400 shrink-0" />
                    <span>
                      Earning schedule runs Monday to Friday (5 profit days/week). Saturday & Sunday observe
                      Weekend Rest with zero counter increment (~280 calendar days for 200 profit days).
                    </span>
                  </div>
                </div>
              )}

              {activeSection === 'forex' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Globe className="w-5 h-5 text-orange-400" />
                      <h3 className="font-display font-bold text-white text-base">
                        Forex Spot &amp; Gold Market Terminal
                      </h3>
                    </div>
                    <span className="text-xs font-mono text-orange-400 font-semibold">
                      Charts Active · Direct Trading Upcoming
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { pair: 'EUR/USD', price: '1.08420', delta: '+0.24%', spread: '0.2 pips', up: true },
                      { pair: 'GBP/USD', price: '1.26850', delta: '+0.19%', spread: '0.4 pips', up: true },
                      { pair: 'USD/JPY', price: '154.320', delta: '-0.11%', spread: '0.3 pips', up: false },
                      { pair: 'XAU/USD', price: '2642.50', delta: '+0.62%', spread: '1.8 pips', up: true },
                    ].map((q) => (
                      <div
                        key={q.pair}
                        className="p-3 rounded-xl bg-slate-900/75 border border-slate-700/70 space-y-1"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-display font-bold text-white">{q.pair}</span>
                          <span
                            className={`font-mono text-[11px] font-semibold tabular-nums ${
                              q.up ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {q.delta}
                          </span>
                        </div>
                        <div className="font-mono font-bold text-base text-white tabular-nums">{q.price}</div>
                        <div className="text-[11px] font-mono text-slate-400">Spread {q.spread}</div>
                      </div>
                    ))}
                  </div>

                  {/* Clean Preview Chart Silhouette */}
                  <div className="rounded-xl bg-slate-950/75 border border-slate-800 p-3">
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-2">
                      <span>EUR/USD · 1H Institutional Feed Preview</span>
                      <span className="text-emerald-400">EMA(20) Uptrend</span>
                    </div>
                    <svg viewBox="0 0 420 90" className="w-full h-20 block">
                      <defs>
                        <linearGradient id="homeFxArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10B981" stopOpacity="0.28" />
                          <stop offset="100%" stopColor="#10B981" stopOpacity="0.01" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M0 68 L35 62 L70 65 L105 52 L140 56 L175 44 L210 49 L245 36 L280 41 L315 28 L350 32 L385 18 L420 22 L420 90 L0 90 Z"
                        fill="url(#homeFxArea)"
                      />
                      <path
                        d="M0 68 L35 62 L70 65 L105 52 L140 56 L175 44 L210 49 L245 36 L280 41 L315 28 L350 32 L385 18 L420 22"
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="2"
                      />
                      <path
                        d="M0 72 Q140 60 280 44 T420 27"
                        fill="none"
                        stroke="#F97316"
                        strokeWidth="1.5"
                        strokeDasharray="4 3"
                      />
                    </svg>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300 bg-slate-900/70 border border-slate-700/70 rounded-lg px-3.5 py-2.5">
                    <span>
                      Inspect interactive candlestick charts inside your Vault now — direct Buy/Sell Forex trading opens in the next release.
                    </span>
                    {authUser && onOpenDashboard && (
                      <button
                        type="button"
                        onClick={() => onOpenDashboard('forex-market')}
                        className="text-orange-400 font-semibold hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                      >
                        Open Live Chart <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {activeSection === 'pump-fun' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-mono text-orange-400 font-semibold">
                        Official Pump.fun Solana Launch
                      </div>
                      <h3 className="font-display font-bold text-white text-lg">
                        {platformConfig.pumpFunToken.name} (${platformConfig.pumpFunToken.ticker})
                      </h3>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-lg text-white tabular-nums">
                        ${platformConfig.pumpFunToken.priceUsd.toFixed(6)}
                      </div>
                      <div className="text-xs font-mono text-emerald-400 font-semibold tabular-nums">
                        +{platformConfig.pumpFunToken.change24hPercent}% (24h) · MC $
                        {platformConfig.pumpFunToken.marketCapUsd.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {platformConfig.pumpFunToken.description}
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-slate-900/80 border border-slate-700/70">
                    <div className="min-w-0">
                      <div className="text-[11px] text-slate-400">Solana Mint Address</div>
                      <div className="font-mono text-xs text-slate-100 truncate max-w-xs sm:max-w-md">
                        {platformConfig.pumpFunToken.mintAddress}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyMint}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 hover:bg-slate-700"
                      >
                        {copiedMint ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedMint ? 'Copied' : 'Copy Mint'}
                      </button>
                      <a
                        href={platformConfig.pumpFunToken.pumpFunUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-orange-600 text-white text-xs font-medium hover:bg-orange-500"
                      >
                        Pump.fun
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'mentor-referral' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-orange-400" />
                      <h3 className="font-display font-bold text-white text-base">
                        All-Plan Multi-Level Referral Program
                      </h3>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-400">
                      Active Across All Plans
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-slate-900/75 border border-slate-700/70 text-center">
                      <div className="text-xs text-slate-400">Level 1 Direct</div>
                      <div className="font-mono font-bold text-xl text-white tabular-nums">
                        {platformConfig.mlmRates.level1}%
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/75 border border-slate-700/70 text-center">
                      <div className="text-xs text-slate-400">Level 2 Network</div>
                      <div className="font-mono font-bold text-xl text-white tabular-nums">
                        {platformConfig.mlmRates.level2}%
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/75 border border-slate-700/70 text-center">
                      <div className="text-xs text-slate-400">Level 3 Depth</div>
                      <div className="font-mono font-bold text-xl text-white tabular-nums">
                        {platformConfig.mlmRates.level3}%
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Every investment tier — Starter ($100), Growth ($300), Pro ($500), and Elite ($1,000) —
                    triggers instant multi-level referral commissions directly into your Income Wallet,
                    with instant profit withdrawal eligibility from ${platformConfig.minWithdrawalUsd}.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Company Details & Company Goal */}
          <div className="bg-[#0B111E]/76 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <h2 className="font-display font-bold text-white text-sm mb-1.5">
                  About {platformConfig.companyName}
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {platformConfig.companyDescription}
                </p>
              </div>
              <div>
                <h2 className="font-display font-bold text-white text-sm mb-1.5">
                  Institutional Company Goal
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {platformConfig.companyGoal}
                </p>
              </div>
            </div>
          </div>

          {/* Trustpilot & Security Ratings Showcase */}
          <div className="bg-[#0B111E]/76 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display font-bold text-white text-sm">
                Independent Trust & Security Verification
              </h2>
              <span className="text-xs text-slate-400 font-mono">Audited Custody & Controls</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Trustpilot */}
              <div className="p-3.5 rounded-xl bg-slate-900/75 border border-slate-700/70 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                  <Star className="w-4 h-4 text-emerald-400 fill-emerald-400" />
                  <span>Trustpilot</span>
                </div>
                <div className="font-mono font-bold text-lg text-white tabular-nums">
                  {platformConfig.trustpilotScore.toFixed(1)} / 5★
                </div>
                <div className="text-[11px] text-slate-400 tabular-nums">
                  {platformConfig.trustpilotReviews.toLocaleString()} verified reviews
                </div>
              </div>

              {/* Norton Secured */}
              <div className="p-3.5 rounded-xl bg-slate-900/75 border border-slate-700/70 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>Norton Secured</span>
                </div>
                <div className="font-mono font-bold text-lg text-white tabular-nums">
                  {platformConfig.nortonScore.toFixed(1)} / 5
                </div>
                <div className="text-[11px] text-slate-400">256-Bit TLS Seal</div>
              </div>

              {/* ISO/IEC 27001 */}
              <div className="p-3.5 rounded-xl bg-slate-900/75 border border-slate-700/70 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                  <Award className="w-4 h-4 text-sky-400" />
                  <span>ISO/IEC 27001</span>
                </div>
                <div className="font-mono font-bold text-lg text-white tabular-nums">
                  {platformConfig.isoScore.toFixed(1)} / 5
                </div>
                <div className="text-[11px] text-slate-400">InfoSec Certified</div>
              </div>

              {/* CertiK Web3 Audit */}
              <div className="p-3.5 rounded-xl bg-slate-900/75 border border-slate-700/70 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                  <Lock className="w-4 h-4 text-orange-400" />
                  <span>CertiK Web3</span>
                </div>
                <div className="font-mono font-bold text-lg text-white tabular-nums">
                  {platformConfig.certikScore.toFixed(1)} / 5
                </div>
                <div className="text-[11px] text-slate-400">Smart Vault Audit</div>
              </div>
            </div>
          </div>

          {/* Risk & KYC Disclosure */}
          <div className="bg-amber-950/55 backdrop-blur-md border border-amber-600/40 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-100/90 leading-relaxed">{platformConfig.riskDisclosure}</p>
          </div>
        </div>

        {/* RIGHT COLUMN: Clean White Auth & KYC Registration Card (or Signed-In Return Card) */}
        <div ref={authCardRef} className="lg:col-span-5">
          <div className="bg-white/95 backdrop-blur-md border border-white/20 rounded-2xl shadow-[0_24px_70px_rgba(0,0,0,0.65)] p-6 sm:p-7">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-3">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              <span>Firebase Auth · Verified KYC Ledger</span>
            </div>

            {authUser && onOpenDashboard ? (
              <div className="space-y-5 pt-2">
                <div className="pb-4 border-b border-slate-100 space-y-1">
                  <h2 className="font-display font-bold text-slate-900 text-xl leading-tight">
                    Active Vault Session
                  </h2>
                  <p className="text-xs text-slate-500">
                    Signed in as <strong className="text-slate-800">{userProfile?.fullName || authUser.email}</strong>
                    {userProfile?.handle ? ` · ${userProfile.handle}` : ''}
                  </p>
                </div>

                {userProfile && (
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-slate-500">Deposit Wallet</div>
                      <div className="font-mono font-bold text-lg text-slate-900 tabular-nums mt-0.5">
                        ${userProfile.usdBalance.toFixed(2)}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-slate-500">Income Wallet</div>
                      <div className="font-mono font-bold text-lg text-emerald-700 tabular-nums mt-0.5">
                        ${userProfile.profitBalance.toFixed(2)}
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => onOpenDashboard('dashboard')}
                    className="w-full py-2.5 px-4 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2"
                  >
                    <span>Return to Vault Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenDashboard('forex-market')}
                    className="w-full py-2.5 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2"
                  >
                    <Globe className="w-4 h-4 text-orange-600" />
                    <span>Open Forex Market Charts</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-100">
                  <h2 className="font-display font-bold text-slate-900 text-xl leading-tight">
                    {authMode === 'signup' ? 'Verified Client Registration' : 'Client Vault Sign In'}
                  </h2>

                  <div className="flex items-center p-1 bg-slate-100 rounded-lg shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signin');
                        setErrorMsg('');
                        setSuccessMsg('');
                      }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                        authMode === 'signin'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signup');
                        setErrorMsg('');
                        setSuccessMsg('');
                      }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                        authMode === 'signup'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Sign Up (KYC)
                    </button>
                  </div>
                </div>

            {errorMsg && (
              <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 leading-relaxed">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            {authMode === 'signin' ? (
              <form onSubmit={handleSignInSubmit} className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="you@domain.com"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2"
                >
                  <span>{submitting ? 'Authenticating...' : 'Sign In to Vault'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignUpSubmit} className="mt-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Full Legal Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="As shown on ID document"
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Referral Code (Optional)
                    </label>
                    <input
                      type="text"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                      placeholder="e.g. VTV1234"
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="you@domain.com"
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Password (min 6 chars) *
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Create strong password"
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
                    />
                  </div>
                </div>

                {/* Identity Verification Document Type Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Identity Verification Document *
                    </label>
                    <span className="text-[11px] text-slate-500">Required for vault activation</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'NID' as IdType, label: 'NID Card', Icon: IdCard },
                      { value: 'Passport' as IdType, label: 'Passport', Icon: FileCheck },
                      { value: 'Driving License' as IdType, label: 'Driving License', Icon: CreditCard },
                    ].map(({ value, label, Icon }) => {
                      const selected = idType === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setIdType(value)}
                          className={`px-2.5 py-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                            selected
                              ? 'border-orange-500 bg-orange-50/70 text-orange-700'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {idLabel}
                  </label>
                  <input
                    type="text"
                    required
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    placeholder={idPlaceholder}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
                  />
                </div>

                {/* Document Photo & Portrait Photo Upload */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="border border-slate-200 rounded-xl p-3">
                    <div className="text-xs font-semibold text-slate-700 mb-2">
                      {idType} Photo *
                    </div>
                    <input
                      ref={idFileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handlePhotoUpload(e.target.files?.[0], setIdPhotoData)}
                    />
                    <button
                      type="button"
                      onClick={() => idFileRef.current?.click()}
                      className="w-full h-20 rounded-lg border border-dashed border-slate-300 hover:border-orange-400 bg-slate-50 flex flex-col items-center justify-center gap-1 text-xs text-slate-500 overflow-hidden"
                    >
                      {idPhotoData ? (
                        <img
                          src={idPhotoData}
                          alt="Uploaded document"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <>
                          <Upload className="w-4 h-4 text-slate-400" />
                          <span>Upload ID</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-xl p-3">
                    <div className="text-xs font-semibold text-slate-700 mb-2">
                      Client Photo *
                    </div>
                    <input
                      ref={portraitFileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handlePhotoUpload(e.target.files?.[0], setPortraitPhotoData)}
                    />
                    <button
                      type="button"
                      onClick={() => portraitFileRef.current?.click()}
                      className="w-full h-20 rounded-lg border border-dashed border-slate-300 hover:border-orange-400 bg-slate-50 flex flex-col items-center justify-center gap-1 text-xs text-slate-500 overflow-hidden"
                    >
                      {portraitPhotoData ? (
                        <img
                          src={portraitPhotoData}
                          alt="Client portrait"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <>
                          <Upload className="w-4 h-4 text-slate-400" />
                          <span>Portrait Photo</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2"
                >
                  <span>{submitting ? 'Submitting KYC...' : 'Register & Submit KYC'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* Divider & Google Sign-In */}
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                or
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={handleGoogleAuth}
              className="w-full py-2.5 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold transition-colors flex items-center justify-center gap-2.5"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};
