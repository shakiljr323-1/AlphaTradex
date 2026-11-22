import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  Bot,
  Calculator,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  ExternalLink,
  FileCheck,
  Globe,
  IdCard,
  Layers,
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
import { AlphatradexCoinHub, BannerAdSlot } from './AlphatradexCoinHub';
import { AlphatradexLiveChart, AlphatradexTickerTape } from './TradingViewChart';
import { AlphatradexLogo3D } from './AlphatradexLogo3D';

interface FrontPageProps {
  activeSection: NavSection;
  onSelectSection: (s: NavSection) => void;
  authMode: 'signin' | 'signup';
  setAuthMode: (mode: 'signin' | 'signup') => void;
  onOpenAuth: (mode: 'signin' | 'signup') => void;
  onOpenDashboard?: (targetNav?: 'dashboard' | 'forex-market' | 'pump-fun') => void;
}

const HOME_FX_PAIRS = [
  { label: 'EUR/USD', tv: 'FX:EURUSD', name: 'Euro / US Dollar' },
  { label: 'GBP/USD', tv: 'FX:GBPUSD', name: 'British Pound / USD' },
  { label: 'USD/JPY', tv: 'FX:USDJPY', name: 'US Dollar / Japanese Yen' },
  { label: 'XAU/USD', tv: 'OANDA:XAUUSD', name: 'Gold Spot / USD' },
  { label: 'AUD/USD', tv: 'FX:AUDUSD', name: 'Australian Dollar / USD' },
  { label: 'USD/CHF', tv: 'FX:USDCHF', name: 'US Dollar / Swiss Franc' },
];

export const FrontPage: React.FC<FrontPageProps> = ({
  activeSection,
  onSelectSection,
  authMode,
  setAuthMode,
  onOpenAuth,
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

  // Dedicated Auth form states (rendered ONLY when activeSection === 'auth')
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
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
  const [providerNotEnabled, setProviderNotEnabled] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Dedicated Page interactive states
  const [copiedMint, setCopiedMint] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('pro');
  const [selectedHomeFxSymbol, setSelectedHomeFxSymbol] = useState<string>('FX:EURUSD');
  const [fxInterval, setFxInterval] = useState<'15' | '60' | '240' | 'D'>('60');
  const [fxChartStyle, setFxChartStyle] = useState<'1' | '3'>('1');
  const [fxShowEma, setFxShowEma] = useState<boolean>(true);
  const [simL1Volume, setSimL1Volume] = useState<string>('2500');
  const [simL2Volume, setSimL2Volume] = useState<string>('4000');
  const [simL3Volume, setSimL3Volume] = useState<string>('6500');

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

  const selectedPlan = useMemo(
    () =>
      platformConfig.packages.find((p) => p.id === selectedPlanId) ||
      platformConfig.packages[0],
    [platformConfig.packages, selectedPlanId]
  );

  const l1Commission =
    ((Number(simL1Volume) || 0) * platformConfig.mlmRates.level1) / 100;
  const l2Commission =
    ((Number(simL2Volume) || 0) * platformConfig.mlmRates.level2) / 100;
  const l3Commission =
    ((Number(simL3Volume) || 0) * platformConfig.mlmRates.level3) / 100;
  const totalSimCommission = l1Commission + l2Commission + l3Commission;

  const handleCopyMint = () => {
    navigator.clipboard?.writeText(platformConfig.pumpFunToken.mintAddress)?.catch(() => {});
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
    setProviderNotEnabled(false);
    setSuccessMsg('');
    setSubmitting(true);
    try {
      await signInWithEmail(loginEmail, loginPassword);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setProviderNotEnabled(true);
        setErrorMsg(
          'Email/Password sign-in is not yet enabled in Firebase Console (Authentication -> Sign-in method -> Email/Password). Use "Continue with Google" for instant access, or enable the Email/Password provider in Firebase Console.'
        );
      } else if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
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
    setProviderNotEnabled(false);
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
        setProviderNotEnabled(true);
        setErrorMsg(
          'Email/Password registration is not yet enabled in Firebase Console (Authentication -> Sign-in method -> Email/Password). Click "Continue with Google" below to enter immediately—your KYC details from this form will be saved automatically.'
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
    setProviderNotEnabled(false);
    setSuccessMsg('');
    setSubmitting(true);
    try {
      const kycDraft =
        authMode === 'signup' && (fullName.trim() || idNumber.trim())
          ? {
              fullName,
              referralCode,
              idType,
              idNumber,
              idPhotoData,
              portraitPhotoData,
            }
          : undefined;
      await signInWithGoogle(referralCode, kycDraft);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/unauthorized-domain') {
        setErrorMsg(
          `Domain "${window.location.hostname}" is not yet authorized in Firebase Console (Authentication -> Settings -> Authorized domains). Add "${window.location.hostname}" there or sign in with Email/Password.`
        );
      } else {
        const msg = (err as Error)?.message || 'Google authentication was cancelled or failed.';
        setErrorMsg(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openPortalOrAuth = (
    targetDash: 'dashboard' | 'forex-market' | 'pump-fun' = 'dashboard',
    preferredAuth: 'signin' | 'signup' = 'signup'
  ) => {
    if (authUser && onOpenDashboard) {
      onOpenDashboard(targetDash);
    } else {
      onOpenAuth(preferredAuth);
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

  // ============================================================================
  // DEDICATED VIEW: AUTHENTICATION (ONLY rendered when activeSection === 'auth')
  // ============================================================================
  if (activeSection === 'auth') {
    return (
      <main className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-8 lg:py-12 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onSelectSection('home')}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white bg-[#0B111E]/80 border border-slate-700/80 px-3.5 py-2 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Home Overview
          </button>
          <span className="text-xs font-mono text-slate-400">
            Dedicated Client Portal Access
          </span>
        </div>

        <div className="bg-white/95 backdrop-blur-md border border-white/20 rounded-2xl shadow-[0_24px_70px_rgba(0,0,0,0.65)] p-6 sm:p-8">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-3">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>Firebase Auth · Verified KYC Ledger</span>
          </div>

          {authUser && onOpenDashboard ? (
            <div className="space-y-5 pt-2">
              <div className="pb-4 border-b border-slate-100 space-y-1">
                <h1 className="font-display font-bold text-slate-900 text-2xl leading-tight">
                  Active Vault Session
                </h1>
                <p className="text-xs text-slate-500">
                  Signed in as{' '}
                  <strong className="text-slate-800">{userProfile?.fullName || authUser.email}</strong>
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
              <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-100">
                <div>
                  <h1 className="font-display font-bold text-slate-900 text-2xl leading-tight">
                    {authMode === 'signup' ? 'Verified Client Registration' : 'Client Vault Sign In'}
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    {authMode === 'signup'
                      ? 'Complete KYC details once to activate deposits, AI packages, and instant profit payouts.'
                      : 'Access your Deposit Wallet, AI Packages, P2P Ledger, and Forex Desk.'}
                  </p>
                </div>

                <div className="flex items-center p-1 bg-slate-100 rounded-lg shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signin');
                      setErrorMsg('');
                      setProviderNotEnabled(false);
                      setSuccessMsg('');
                    }}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
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
                      setProviderNotEnabled(false);
                      setSuccessMsg('');
                    }}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
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
                <div className="mt-4 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 leading-relaxed space-y-2.5">
                  <div>{errorMsg}</div>
                  {providerNotEnabled && (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleGoogleAuth}
                      className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold inline-flex items-center gap-2 transition-colors"
                    >
                      <span>
                        {authMode === 'signup'
                          ? 'Continue with Google & Submit KYC'
                          : 'Continue with Google Now'}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {successMsg && (
                <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Recommended Instant Google Sign-In */}
              <div className="mt-5 space-y-4">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleGoogleAuth}
                  className="w-full py-2.5 px-4 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-900 text-sm font-semibold transition-colors flex items-center justify-center gap-2.5"
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
                  <span>
                    {authMode === 'signup'
                      ? 'Continue with Google (Instant Account + KYC)'
                      : 'Continue with Google (Instant Sign In)'}
                  </span>
                </button>

                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                    or use Email &amp; Password
                  </span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>
              </div>

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

            </>
          )}
        </div>
      </main>
    );
  }

  // ============================================================================
  // DEDICATED FULL-WIDTH PAGES (Zero Sign In / Sign Up forms shown here)
  // ============================================================================
  return (
    <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8 lg:py-12 space-y-8">
      <BannerAdSlot
        bannerAds={platformConfig.bannerAds}
        placement="all_pages"
        compact
        onCtaAction={(url) => {
          if (url === '#coin-mining-desk') {
            onSelectSection('pump-fun');
          } else if (url.startsWith('#')) {
            document.getElementById(url.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }}
      />

      {/* 1. DEDICATED HOME / OVERVIEW PAGE */}
      {activeSection === 'home' && (
        <div className="space-y-8">
          <div className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-6 space-y-4">
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
                  <h1 className="font-display font-extrabold text-white text-3xl sm:text-4xl tracking-tight leading-tight">
                    {platformConfig.companyName}
                  </h1>
                  <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl">
                    {platformConfig.companyTagline}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-2xl">
                    {platformConfig.companyDescription}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => onSelectSection('plans')}
                    className="px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold transition-colors inline-flex items-center gap-2"
                  >
                    <span>Explore Investment Plans</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectSection('forex')}
                    className="px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-900/80 hover:border-slate-500 text-slate-200 hover:text-white text-sm font-semibold transition-colors inline-flex items-center gap-2"
                  >
                    <Globe className="w-4 h-4 text-orange-400" />
                    <span>Live Forex Charts</span>
                  </button>
                </div>
              </div>

              <div className="lg:col-span-6">
                <AlphatradexLogo3D
                  variant="hero"
                  companyName={platformConfig.companyName}
                  companyGoal={platformConfig.companyGoal}
                  tokenTicker={platformConfig.pumpFunToken.ticker}
                  onSelectFeature={onSelectSection}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">
              {platformConfig.packages.map((pkg) => (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => {
                    setSelectedPlanId(pkg.id);
                    onSelectSection('plans');
                  }}
                  className="p-4 rounded-xl bg-slate-900/75 border border-slate-700/70 hover:border-orange-500/60 text-left space-y-1 transition-colors"
                >
                  <div className="text-xs font-semibold text-slate-400">{pkg.name}</div>
                  <div className="font-mono font-bold text-xl text-white tabular-nums">
                    ${pkg.capital.toLocaleString()}
                  </div>
                  <div className="text-xs font-mono font-semibold text-emerald-400 tabular-nums">
                    {pkg.dailyPercent}% / profit day
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">{pkg.aiMode}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Dedicated Feature Navigation Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => onSelectSection('ai-trading')}
              className="p-5 rounded-2xl bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 hover:border-orange-500/60 text-left space-y-2 transition-colors shadow-xl"
            >
              <div className="flex items-center justify-between text-xs font-mono text-orange-400">
                <span>ALGORITHMIC EXECUTION</span>
                <Bot className="w-4 h-4" />
              </div>
              <div className="font-display font-bold text-white text-base">
                Mon–Fri AI Trading Desk
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Dedicated 200-profit-day algorithmic execution running Monday to Friday with automatic Weekend Rest preservation.
              </p>
            </button>

            <button
              type="button"
              onClick={() => onSelectSection('pump-fun')}
              className="p-5 rounded-2xl bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 hover:border-amber-400/70 text-left space-y-2 transition-colors shadow-xl"
            >
              <div className="flex items-center justify-between text-xs font-mono text-amber-400">
                <span>3D QUANTUM ASIC RIG</span>
                <TrendingUp className="w-4 h-4" />
              </div>
              <div className="font-display font-bold text-white text-base">
                {platformConfig.pumpFunToken.name} (${platformConfig.pumpFunToken.ticker})
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Live 3D ASIC mining stage, Pump.fun Solana liquidity tracking, and Upcoming Crypto Mining Bot roadmap.
              </p>
            </button>

            <button
              type="button"
              onClick={() => onSelectSection('mentor-referral')}
              className="p-5 rounded-2xl bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 hover:border-emerald-500/60 text-left space-y-2 transition-colors shadow-xl"
            >
              <div className="flex items-center justify-between text-xs font-mono text-emerald-400">
                <span>LEVELS 1–3 PAYOUTS</span>
                <Users className="w-4 h-4" />
              </div>
              <div className="font-display font-bold text-white text-base">
                All-Plan Referral Program
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Instant {platformConfig.mlmRates.level1}% / {platformConfig.mlmRates.level2}% /{' '}
                {platformConfig.mlmRates.level3}% referral commissions active across all investment packages.
              </p>
            </button>
          </div>

          {/* Company Details & Goal */}
          <div className="bg-[#0B111E]/76 backdrop-blur-md border border-slate-700/70 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

          {/* Trust & Security Ratings */}
          <div className="bg-[#0B111E]/76 backdrop-blur-md border border-slate-700/70 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display font-bold text-white text-sm">
                Independent Trust &amp; Security Verification
              </h2>
              <span className="text-xs text-slate-400 font-mono">Audited Custody &amp; Controls</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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

          <div className="bg-amber-950/55 backdrop-blur-md border border-amber-600/40 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-100/90 leading-relaxed">{platformConfig.riskDisclosure}</p>
          </div>
        </div>
      )}

      {/* 2. DEDICATED INVESTMENT PLANS PAGE */}
      {activeSection === 'plans' && (
        <div className="space-y-6">
          <div className="bg-[#0B111E]/82 backdrop-blur-md border border-slate-700/70 rounded-2xl p-6 sm:p-7 shadow-xl flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="text-xs font-mono text-orange-400 font-semibold">
                200 PROFIT-DAY CYCLE · MON–FRI EXECUTION
              </div>
              <h1 className="font-display font-extrabold text-white text-2xl sm:text-3xl tracking-tight">
                Institutional Investment Packages
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
                Every tier earns automated Monday–Friday daily targets with instant profit withdrawals from ${platformConfig.minWithdrawalUsd} and all-plan L1–L3 referral eligibility.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openPortalOrAuth('dashboard', 'signup')}
              className="px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold transition-colors inline-flex items-center gap-2 shrink-0"
            >
              <span>{authUser ? 'Activate Inside Vault' : 'Register to Activate Plan'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {platformConfig.packages.map((pkg) => {
              const isSelected = pkg.id === selectedPlan?.id;
              const dailyUsd = (pkg.capital * pkg.dailyPercent) / 100;
              const total200Usd = dailyUsd * pkg.profitDays;
              return (
                <div
                  key={pkg.id}
                  onClick={() => setSelectedPlanId(pkg.id)}
                  className={`cursor-pointer rounded-2xl p-5 border transition-colors flex flex-col justify-between space-y-4 shadow-xl ${
                    isSelected
                      ? 'bg-slate-900/95 border-orange-500'
                      : 'bg-[#0B111E]/78 border-slate-700/70 hover:border-slate-500'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-display font-bold text-white text-lg">{pkg.name}</span>
                      <span className="text-[11px] font-mono text-emerald-400 font-semibold">
                        {pkg.dailyPercent}% / day
                      </span>
                    </div>
                    <div className="font-mono font-extrabold text-3xl text-white tabular-nums">
                      ${pkg.capital.toLocaleString()}
                    </div>
                    <div className="text-xs font-mono text-slate-300">{pkg.aiMode}</div>
                    <p className="text-xs text-slate-400 leading-relaxed">{pkg.description}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Daily Profit (Mon–Fri)</span>
                      <span className="font-mono font-bold text-emerald-400 tabular-nums">
                        +${dailyUsd.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">{pkg.profitDays}-Day Return</span>
                      <span className="font-mono font-bold text-white tabular-nums">
                        ${total200Usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Capital Lock</span>
                      <span className="font-mono text-slate-200 tabular-nums">
                        {pkg.id === 'elite'
                          ? `${platformConfig.eliteCapitalLockDays} Cal. Days`
                          : `${pkg.profitDays} Profit Days`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Interactive 200-Day Projection Panel for Selected Plan */}
          {selectedPlan && (
            <div className="bg-[#0B111E]/82 backdrop-blur-md border border-slate-700/70 rounded-2xl p-6 shadow-xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-7 space-y-2">
                <div className="inline-flex items-center gap-2 text-xs font-mono text-orange-400 font-semibold">
                  <Calculator className="w-4 h-4" />
                  Selected Package Projection · {selectedPlan.name} (${selectedPlan.capital.toLocaleString()})
                </div>
                <h2 className="font-display font-bold text-white text-xl">
                  {selectedPlan.aiMode} — Weekly &amp; Cycle Yield Breakdown
                </h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Profits credit strictly on active trading weekdays (Monday through Friday). Instant payouts are available as soon as your Income Wallet reaches ${platformConfig.minWithdrawalUsd}.
                </p>
              </div>
              <div className="lg:col-span-5 grid grid-cols-3 gap-3 text-center">
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="text-[11px] text-slate-400">Weekly (5d)</div>
                  <div className="font-mono font-bold text-lg text-emerald-400 tabular-nums mt-1">
                    ${(((selectedPlan.capital * selectedPlan.dailyPercent) / 100) * 5).toFixed(2)}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="text-[11px] text-slate-400">Monthly (20d)</div>
                  <div className="font-mono font-bold text-lg text-white tabular-nums mt-1">
                    ${(((selectedPlan.capital * selectedPlan.dailyPercent) / 100) * 20).toFixed(0)}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="text-[11px] text-slate-400">200 Profit Days</div>
                  <div className="font-mono font-bold text-lg text-orange-400 tabular-nums mt-1">
                    $
                    {(
                      ((selectedPlan.capital * selectedPlan.dailyPercent) / 100) *
                      selectedPlan.profitDays
                    ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. DEDICATED AI TRADING DESK PAGE */}
      {activeSection === 'ai-trading' && (
        <div className="space-y-6">
          <div className="bg-[#0B111E]/82 backdrop-blur-md border border-slate-700/70 rounded-2xl p-6 sm:p-7 shadow-xl flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-orange-400">
                <Bot className="w-4 h-4" />
                <span>ALGORITHMIC EXECUTION ARCHITECTURE</span>
              </div>
              <h1 className="font-display font-extrabold text-white text-2xl sm:text-3xl tracking-tight">
                AI Robot Execution Desk (Mon–Fri)
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
                Automated institutional trading engines allocated by plan tier. Weekend sessions (Saturday &amp; Sunday) enter Weekend Rest with zero counter increment.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold ${
                  isWeekend
                    ? 'border-amber-500/50 bg-amber-950/50 text-amber-300'
                    : 'border-emerald-500/50 bg-emerald-950/50 text-emerald-300'
                }`}
              >
                {isWeekend ? 'Weekend Rest Active' : 'Mon–Fri AI Execution Live'}
              </span>
              <button
                type="button"
                onClick={() => openPortalOrAuth('dashboard', 'signin')}
                className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold transition-colors"
              >
                {authUser ? 'Open AI Desk' : 'Launch Vault AI'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {platformConfig.packages.map((pkg) => (
              <div
                key={pkg.id}
                className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-6 space-y-3 shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-bold text-white text-lg">{pkg.aiMode}</h2>
                  <span className="font-mono text-xs font-semibold text-orange-400">
                    {pkg.name} · ${pkg.capital}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{pkg.description}</p>
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">Daily Target Rate</span>
                  <span className="text-emerald-400 font-bold">
                    {pkg.dailyPercent}% (${((pkg.capital * pkg.dailyPercent) / 100).toFixed(2)} / day)
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 flex items-center gap-3 text-xs sm:text-sm text-slate-300 shadow-xl">
            <Calendar className="w-5 h-5 text-orange-400 shrink-0" />
            <span>
              Execution runs 5 profit days per week (Monday to Friday, ~280 calendar days to reach 200 profit days). Realized returns settle into your Income Wallet automatically.
            </span>
          </div>
        </div>
      )}

      {/* 4. DEDICATED ALPHATRADEX PROPRIETARY FOREX MARKET PAGE */}
      {activeSection === 'forex' && (
        <div className="space-y-5">
          <div className="bg-[#0B111E]/85 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-xs font-mono text-orange-400 font-semibold">
                <Globe className="w-4 h-4" />
                ALPHATRADEX PROPRIETARY LIVE TERMINAL · DIRECT ORDERS UPCOMING
              </div>
              <h1 className="font-display font-extrabold text-white text-2xl sm:text-3xl tracking-tight">
                {platformConfig.companyName} Live Forex &amp; Gold (XAU/USD) Charts
              </h1>
            </div>
            <button
              type="button"
              onClick={() => openPortalOrAuth('forex-market', 'signin')}
              className="px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors shrink-0"
            >
              <span>{authUser ? 'Open Full Desk in Vault' : 'Sign In for Execution Calculator'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-[#0B111E]/90 backdrop-blur-md border border-slate-700/70 rounded-2xl px-2 py-1 shadow-xl overflow-hidden">
            <AlphatradexTickerTape
              onSelectSymbol={(symLabel) => {
                const match = HOME_FX_PAIRS.find((p) => p.label === symLabel);
                if (match) setSelectedHomeFxSymbol(match.tv);
              }}
            />
          </div>

          <div className="bg-[#0B111E]/85 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {HOME_FX_PAIRS.map((pair) => {
                  const active = selectedHomeFxSymbol === pair.tv;
                  return (
                    <button
                      key={pair.tv}
                      type="button"
                      onClick={() => setSelectedHomeFxSymbol(pair.tv)}
                      className={`px-3.5 py-2 rounded-xl border text-left transition-colors ${
                        active
                          ? 'bg-slate-800 border-orange-500 text-white'
                          : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white'
                      }`}
                    >
                      <div className="font-display font-bold text-xs">{pair.label}</div>
                      <div className="text-[10px] text-slate-400">{pair.name}</div>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-900 border border-slate-800">
                  {(
                    [
                      { id: '15', label: '15M' },
                      { id: '60', label: '1H' },
                      { id: '240', label: '4H' },
                      { id: 'D', label: '1D' },
                    ] as const
                  ).map((tf) => (
                    <button
                      key={tf.id}
                      type="button"
                      onClick={() => setFxInterval(tf.id)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold transition-colors ${
                        fxInterval === tf.id
                          ? 'bg-orange-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-900 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setFxChartStyle('1')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                      fxChartStyle === '1'
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Candles
                  </button>
                  <button
                    type="button"
                    onClick={() => setFxChartStyle('3')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                      fxChartStyle === '3'
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Area
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setFxShowEma((v) => !v)}
                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-mono font-semibold transition-colors ${
                    fxShowEma
                      ? 'border-orange-500/60 bg-orange-500/15 text-orange-300'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  EMA
                </button>
              </div>
            </div>

            <AlphatradexLiveChart
              symbol={selectedHomeFxSymbol}
              interval={fxInterval}
              chartStyle={fxChartStyle}
              showEma={fxShowEma}
            />

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 pt-1">
              <span className="inline-flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-orange-400" />
                Live {platformConfig.companyName} proprietary candlestick &amp; area market charts active now. Direct USD Vault Forex Buy/Sell execution launches in the next release.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 5. DEDICATED ALPHATRADEX COIN + 3D QUANTUM MINING PAGE */}
      {activeSection === 'pump-fun' && (
        <div className="space-y-6">
          <AlphatradexCoinHub
            mode="preview"
            onRequireAuth={() => openPortalOrAuth('pump-fun', 'signin')}
            onPrimaryHeroAction={() => openPortalOrAuth('pump-fun', 'signin')}
            primaryHeroLabel={authUser ? 'Open Mining & Allocation Vault' : 'Access Mining Portal'}
          />

          <div className="bg-[#0B111E]/82 backdrop-blur-md border border-slate-700/70 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display font-bold text-white text-lg">
                  {platformConfig.pumpFunToken.name} (${platformConfig.pumpFunToken.ticker}) · Solana On-Chain Details
                </h2>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                  {platformConfig.pumpFunToken.description}
                </p>
              </div>
              <div className="text-right font-mono">
                <div className="text-xs text-slate-400">Market Cap</div>
                <div className="text-lg font-bold text-white tabular-nums">
                  ${platformConfig.pumpFunToken.marketCapUsd.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="min-w-0">
                <div className="text-[11px] text-slate-400">Verified Solana Mint Address</div>
                <div className="font-mono text-xs text-slate-100 break-all">
                  {platformConfig.pumpFunToken.mintAddress}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyMint}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                >
                  {copiedMint ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedMint ? 'Copied' : 'Copy Mint'}
                </button>
                <a
                  href={platformConfig.pumpFunToken.pumpFunUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 text-white text-xs font-semibold hover:bg-orange-500"
                >
                  <span>View on Pump.fun</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. DEDICATED MULTI-LEVEL REFERRAL & MENTOR PROGRAM PAGE */}
      {activeSection === 'mentor-referral' && (
        <div className="space-y-6">
          <div className="bg-[#0B111E]/82 backdrop-blur-md border border-slate-700/70 rounded-2xl p-6 sm:p-7 shadow-xl flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-orange-400">
                <Users className="w-4 h-4" />
                <span>ALL-PLAN MULTI-LEVEL COMMISSION STRUCTURE</span>
              </div>
              <h1 className="font-display font-extrabold text-white text-2xl sm:text-3xl tracking-tight">
                Referral &amp; Mentor Commission Program
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
                Every active investment package pays instant Level 1–3 referral commissions directly into your Income Wallet.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openPortalOrAuth('dashboard', 'signup')}
              className="px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold inline-flex items-center gap-2 shrink-0"
            >
              <span>{authUser ? 'Copy My Referral Link' : 'Get Your Referral Link'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div
            className={`grid grid-cols-1 gap-5 ${
              platformConfig.mentorConfig?.enabled ? 'md:grid-cols-4' : 'md:grid-cols-3'
            }`}
          >
            <div className="p-6 rounded-2xl bg-[#0B111E]/80 border border-slate-700/70 text-center space-y-2 shadow-xl">
              <div className="text-xs font-mono text-slate-400 uppercase">Level 1 · Direct</div>
              <div className="font-mono font-extrabold text-4xl text-white tabular-nums">
                {platformConfig.mlmRates.level1}%
              </div>
              <p className="text-xs text-slate-300">
                Earned immediately on every direct referral package activation.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-[#0B111E]/80 border border-slate-700/70 text-center space-y-2 shadow-xl">
              <div className="text-xs font-mono text-slate-400 uppercase">Level 2 · Network</div>
              <div className="font-mono font-extrabold text-4xl text-white tabular-nums">
                {platformConfig.mlmRates.level2}%
              </div>
              <p className="text-xs text-slate-300">
                Earned on second-tier network activations across all investment tiers.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-[#0B111E]/80 border border-slate-700/70 text-center space-y-2 shadow-xl">
              <div className="text-xs font-mono text-slate-400 uppercase">Level 3 · Depth</div>
              <div className="font-mono font-extrabold text-4xl text-white tabular-nums">
                {platformConfig.mlmRates.level3}%
              </div>
              <p className="text-xs text-slate-300">
                Earned across third-level partner activations with instant payout access.
              </p>
            </div>
            {platformConfig.mentorConfig?.enabled && (
              <div className="p-6 rounded-2xl bg-[#0B111E]/80 border border-sky-500/45 text-center space-y-2 shadow-xl">
                <div className="text-xs font-mono text-sky-400 uppercase">Mentor · Override</div>
                <div className="font-mono font-extrabold text-4xl text-sky-300 tabular-nums">
                  {platformConfig.mentorConfig.mentorCommissionPercent}%
                </div>
                <p className="text-xs text-slate-300">
                  Paid to assigned Mentors on partner activations ({platformConfig.mentorConfig.volumeMultiplier}× team rule).
                </p>
              </div>
            )}
          </div>

          {/* Interactive Referral Earnings Simulator */}
          <div className="bg-[#0B111E]/82 backdrop-blur-md border border-slate-700/70 rounded-2xl p-6 shadow-xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center gap-2 text-xs font-mono font-semibold text-orange-400">
                <Calculator className="w-4 h-4" />
                <span>INTERACTIVE TEAM COMMISSION SIMULATOR</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">L1 Volume ($)</label>
                  <input
                    type="number"
                    min={0}
                    value={simL1Volume}
                    onChange={(e) => setSimL1Volume(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/90 text-white font-mono text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">L2 Volume ($)</label>
                  <input
                    type="number"
                    min={0}
                    value={simL2Volume}
                    onChange={(e) => setSimL2Volume(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/90 text-white font-mono text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">L3 Volume ($)</label>
                  <input
                    type="number"
                    min={0}
                    value={simL3Volume}
                    onChange={(e) => setSimL3Volume(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/90 text-white font-mono text-sm tabular-nums"
                  />
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">L1 Payout ({platformConfig.mlmRates.level1}%)</span>
                <span className="font-mono font-semibold text-white tabular-nums">${l1Commission.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">L2 Payout ({platformConfig.mlmRates.level2}%)</span>
                <span className="font-mono font-semibold text-white tabular-nums">${l2Commission.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">L3 Payout ({platformConfig.mlmRates.level3}%)</span>
                <span className="font-mono font-semibold text-white tabular-nums">${l3Commission.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-200">Total Instant Bonus</span>
                <span className="font-mono font-extrabold text-emerald-400 tabular-nums">
                  ${totalSimCommission.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
