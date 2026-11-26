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
  Eye,
  EyeOff,
  FileCheck,
  Globe,
  IdCard,
  Layers,
  Lock,
  Phone,
  Shield,
  ShieldCheck,
  Star,
  TrendingUp,
  Upload,
  Users,
} from 'lucide-react';
import type { ConfirmationResult } from 'firebase/auth';
import { usePlatform } from '../context/PlatformContext';
import {
  COUNTRY_PHONE_OPTIONS,
  getCountryByCode,
  normalizeRemainingPhoneDigits,
  validateCountryPhoneNumber,
} from '../constants/countries';
import { confirmFirebasePhoneOtp, sendFirebasePhoneOtp } from '../lib/firebase';
import { IdType, NavSection } from '../types/platform';
import { compressImageToDataUrl, isWeekendDate } from '../utils/investmentMath';
import { AlphatradexCoinHub, BannerAdSlot } from './AlphatradexCoinHub';
import { ForexMarketView } from './ForexMarketView';
import { ForexNewsHub } from './ForexNewsHub';
import { HomepageMarketNewsModule } from './HomepageMarketNewsModule';
import { HomepageFaqAccordion } from './HomepageFaqAccordion';
import { AlphatradexLogo3D } from './AlphatradexLogo3D';
import { TermsAgreementCheckbox, TermsAndConditionsView } from './TermsAndConditionsView';

interface FrontPageProps {
  activeSection: NavSection;
  onSelectSection: (s: NavSection) => void;
  authMode: 'signin' | 'signup';
  setAuthMode: (mode: 'signin' | 'signup') => void;
  onOpenAuth: (mode: 'signin' | 'signup') => void;
  authGateNotice?: string | null;
  onClearAuthNotice?: () => void;
  onOpenDashboard?: (targetNav?: 'dashboard' | 'forex-market' | 'pump-fun') => void;
}

export const FrontPage: React.FC<FrontPageProps> = ({
  activeSection,
  onSelectSection,
  authMode,
  setAuthMode,
  onOpenAuth,
  authGateNotice,
  onClearAuthNotice,
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
  const [selectedCountryCode, setSelectedCountryCode] = useState('BD');
  const [phoneRemainingDigits, setPhoneRemainingDigits] = useState('');
  const [phoneOtpStep, setPhoneOtpStep] = useState<'idle' | 'sent' | 'verified' | 'queued'>('idle');
  const [phoneOtpCode, setPhoneOtpCode] = useState('');
  const [phoneVerifyBusy, setPhoneVerifyBusy] = useState(false);
  const [phoneStatusMsg, setPhoneStatusMsg] = useState<{
    type: 'ok' | 'err' | 'info';
    text: string;
  } | null>(null);
  const [verifiedPhoneE164, setVerifiedPhoneE164] = useState('');
  const phoneConfirmRef = useRef<ConfirmationResult | null>(null);
  const phoneRecaptchaRef = useRef<HTMLDivElement | null>(null);
  const [idType, setIdType] = useState<IdType>('NID');
  const [idNumber, setIdNumber] = useState('');
  const [idPhotoData, setIdPhotoData] = useState('');
  const [portraitPhotoData, setPortraitPhotoData] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [providerNotEnabled, setProviderNotEnabled] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [signupStep, setSignupStep] = useState<1 | 2 | 3>(1);
  const [showInlineGoogleTerms, setShowInlineGoogleTerms] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [vaultFocus, setVaultFocus] = useState<'ai_vaults' | 'forex_copy' | 'coin_mining' | 'custody_mlm'>(() => {
    const saved = localStorage.getItem('vtv_onboarding_focus');
    if (saved === 'forex_copy' || saved === 'coin_mining' || saved === 'custody_mlm') return saved;
    return 'ai_vaults';
  });
  const [preferredNetwork, setPreferredNetwork] = useState<'USDT TRC20' | 'USDT ERC20' | 'Solana SOL'>(() => {
    const saved = localStorage.getItem('vtv_preferred_network');
    if (saved === 'USDT ERC20' || saved === 'Solana SOL') return saved;
    return 'USDT TRC20';
  });

  useEffect(() => {
    localStorage.setItem('vtv_onboarding_focus', vaultFocus);
  }, [vaultFocus]);

  useEffect(() => {
    localStorage.setItem('vtv_preferred_network', preferredNetwork);
  }, [preferredNetwork]);

  useEffect(() => {
    setSignupStep(1);
    setShowInlineGoogleTerms(false);
  }, [authMode]);

  const selectedCountry = useMemo(
    () => getCountryByCode(selectedCountryCode),
    [selectedCountryCode]
  );
  const phoneValidation = useMemo(
    () => validateCountryPhoneNumber(selectedCountry, phoneRemainingDigits),
    [selectedCountry, phoneRemainingDigits]
  );
  const isCurrentPhoneVerified =
    phoneOtpStep === 'verified' &&
    Boolean(verifiedPhoneE164) &&
    verifiedPhoneE164 === phoneValidation.fullNumber;

  // Dedicated Page interactive states
  const [copiedMint, setCopiedMint] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('pro');
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
          'Email/Password sign-in is currently unavailable. Please use "Continue with Google" below for instant access.'
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

  const handleSendPhoneOtp = async () => {
    setPhoneStatusMsg(null);
    if (!phoneValidation.valid) {
      setPhoneStatusMsg({
        type: 'err',
        text: phoneValidation.error || 'Enter a valid phone number first.',
      });
      return;
    }
    if (!phoneRecaptchaRef.current) {
      setPhoneStatusMsg({
        type: 'err',
        text: 'Phone verification container is not ready. Please try again.',
      });
      return;
    }
    setPhoneVerifyBusy(true);
    try {
      const { confirmation } = await sendFirebasePhoneOtp(
        phoneValidation.fullNumber,
        phoneRecaptchaRef.current
      );
      phoneConfirmRef.current = confirmation;
      setPhoneOtpStep('sent');
      setPhoneOtpCode('');
      setPhoneStatusMsg({
        type: 'info',
        text: `6-digit SMS verification code sent to ${phoneValidation.fullNumber}. Enter the code below.`,
      });
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (
        code === 'auth/operation-not-allowed' ||
        code === 'auth/billing-not-enabled' ||
        code === 'auth/unauthorized-domain' ||
        code === 'auth/captcha-check-failed' ||
        code === 'auth/internal-error'
      ) {
        setPhoneOtpStep('queued');
        setPhoneStatusMsg({
          type: 'info',
          text: `Your phone number ${phoneValidation.fullNumber} is validated and queued for KYC compliance verification—you can complete Sign Up now!`,
        });
      } else if (code === 'auth/too-many-requests') {
        setPhoneStatusMsg({
          type: 'err',
          text: 'Too many OTP requests for this number. Please wait a bit before trying again.',
        });
      } else {
        setPhoneStatusMsg({
          type: 'err',
          text: (err as Error)?.message || 'Could not send verification SMS.',
        });
      }
    } finally {
      setPhoneVerifyBusy(false);
    }
  };

  const handleConfirmPhoneOtp = async () => {
    if (!phoneConfirmRef.current) return;
    if (phoneOtpCode.trim().length < 4) {
      setPhoneStatusMsg({
        type: 'err',
        text: 'Enter the 6-digit SMS code sent to your phone.',
      });
      return;
    }
    setPhoneVerifyBusy(true);
    setPhoneStatusMsg(null);
    try {
      const ok = await confirmFirebasePhoneOtp(
        phoneConfirmRef.current,
        phoneOtpCode,
        phoneValidation.fullNumber
      );
      if (ok) {
        setVerifiedPhoneE164(phoneValidation.fullNumber);
        setPhoneOtpStep('verified');
        setPhoneStatusMsg({
          type: 'ok',
          text: `Phone number ${phoneValidation.fullNumber} verified successfully.`,
        });
      } else {
        setPhoneStatusMsg({
          type: 'err',
          text: 'Verification mismatch. Please request a fresh OTP code.',
        });
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/invalid-verification-code') {
        setPhoneStatusMsg({
          type: 'err',
          text: 'Invalid OTP code. Check the SMS code and try again.',
        });
      } else if (code === 'auth/code-expired') {
        setPhoneStatusMsg({
          type: 'err',
          text: 'OTP code expired. Click "Resend Code" to receive a new SMS.',
        });
      } else {
        setPhoneStatusMsg({
          type: 'err',
          text: (err as Error)?.message || 'OTP confirmation failed.',
        });
      }
    } finally {
      setPhoneVerifyBusy(false);
    }
  };

  const handleNextSignupStep = () => {
    setErrorMsg('');
    setProviderNotEnabled(false);
    setShowInlineGoogleTerms(false);

    if (signupStep === 1) {
      if (!fullName.trim() || fullName.trim().length < 2) {
        setErrorMsg('Please enter your full legal name as shown on your ID document.');
        return;
      }
      if (!regEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim())) {
        setErrorMsg('Please enter a valid email address.');
        return;
      }
      if (regPassword.length < 6) {
        setErrorMsg('Please create a password with at least 6 characters.');
        return;
      }
      setSignupStep(2);
      return;
    }

    if (signupStep === 2) {
      if (!phoneValidation.valid) {
        setErrorMsg(phoneValidation.error || 'Please select your country and enter a valid phone number.');
        return;
      }
      setSignupStep(3);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setProviderNotEnabled(false);
    setSuccessMsg('');

    if (!fullName.trim() || !regEmail.trim() || regPassword.length < 6) {
      setSignupStep(1);
      setErrorMsg('Please complete all required account credentials on Step 1.');
      return;
    }
    if (!phoneValidation.valid) {
      setSignupStep(2);
      setErrorMsg(phoneValidation.error || 'Please enter a valid Country and Phone Number on Step 2.');
      return;
    }
    if (!idNumber.trim()) {
      setErrorMsg('Please enter your Identity Document number.');
      return;
    }
    if (!idPhotoData || !portraitPhotoData) {
      setErrorMsg('Please upload both your Identity Document Photo and Client Portrait Photo for KYC.');
      return;
    }
    if (!acceptedTerms) {
      setErrorMsg(
        'Please read and agree to the Terms & Conditions and Privacy Policy before registering.'
      );
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
        countryCode: selectedCountry.code,
        countryName: selectedCountry.name,
        phoneDialPrefix: selectedCountry.dialPrefix,
        phoneNumber: phoneValidation.fullNumber,
        phoneVerified: isCurrentPhoneVerified,
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
          'Email/Password registration is currently unavailable. Click "Continue with Google" below to enter immediately—your KYC details from this form will be saved automatically.'
        );
      } else if (code === 'auth/email-already-in-use') {
        setSignupStep(1);
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
    if (authMode === 'signup' && !acceptedTerms) {
      setShowInlineGoogleTerms(true);
      setErrorMsg(
        'Please check the Terms & Conditions agreement below before continuing with Google registration.'
      );
      return;
    }
    setShowInlineGoogleTerms(false);
    setSubmitting(true);
    try {
      const hasPhone = phoneValidation.valid;
      const kycDraft =
        authMode === 'signup' && (fullName.trim() || idNumber.trim() || hasPhone)
          ? {
              fullName,
              referralCode,
              idType,
              idNumber,
              idPhotoData,
              portraitPhotoData,
              countryCode: selectedCountry.code,
              countryName: selectedCountry.name,
              phoneDialPrefix: selectedCountry.dialPrefix,
              ...(hasPhone
                ? {
                    phoneNumber: phoneValidation.fullNumber,
                    phoneVerified: isCurrentPhoneVerified,
                  }
                : {}),
            }
          : undefined;
      await signInWithGoogle(referralCode, kycDraft);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/unauthorized-domain') {
        setErrorMsg(
          `Google sign-in is not yet authorized for "${window.location.hostname}". Please sign in with Email/Password or contact support.`
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
    const isSignUpMode = authMode === 'signup';
    const signupStepsMeta: { step: 1 | 2 | 3; label: string; subtitle: string }[] = [
      { step: 1, label: '01. Account', subtitle: 'Name & Credentials' },
      { step: 2, label: '02. Phone', subtitle: 'Country & Verification' },
      { step: 3, label: '03. Identity KYC', subtitle: 'ID & Activation' },
    ];

    const focusMeta: Record<typeof vaultFocus, string> = {
      ai_vaults: 'AI Trading Vaults',
      forex_copy: 'Forex Copy Trade',
      coin_mining: 'ATX Coin Mining',
      custody_mlm: 'Custody & Referrals',
    };

    const regPasswordScore =
      (regPassword.length >= 6 ? 1 : 0) +
      (/[A-Z]/.test(regPassword) && /[a-z]/.test(regPassword) ? 1 : 0) +
      (/\d|[^A-Za-z0-9]/.test(regPassword) ? 1 : 0);

    return (
      <div className="relative min-h-[calc(100vh-8rem)]">
        {/* Unified Luxury Royal Gold Ambient Page Backdrop for Sign In & Sign Up */}
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none z-0"
          style={{
            background:
              'radial-gradient(ellipse 85% 65% at 50% 18%, rgba(245, 158, 11, 0.34) 0%, rgba(217, 119, 6, 0.22) 34%, rgba(120, 53, 15, 0.18) 58%, rgba(10, 14, 24, 0.88) 88%)',
          }}
        />

        <main className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-8 lg:py-12 space-y-6">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => onSelectSection('home')}
              className="inline-flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors border text-amber-200 hover:text-white bg-[#1A1307]/85 border-amber-500/40 hover:border-amber-400"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Home Overview
            </button>
            <span className="text-xs font-mono text-amber-300 font-semibold">
              {isSignUpMode ? `Step ${signupStep} of 3 · Sovereign Onboarding` : 'Gold Vault Client Access'}
            </span>
          </div>

          <div className="relative overflow-hidden rounded-2xl p-6 sm:p-8 border bg-gradient-to-br from-[#FFFDF7] via-[#FEF9EA] to-[#FAEDC7] border-amber-400/75 shadow-[0_28px_85px_rgba(245,158,11,0.28)]">
            {/* Top metallic gold accent edge on both Sign In & Sign Up */}
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-500"
            />

            <div className="flex items-center justify-between gap-3 mb-3 pt-1">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <Shield className="w-3.5 h-3.5 text-amber-600" />
                <span>Encrypted Auth · Verified KYC Ledger</span>
              </div>
              <span className="text-[11px] font-mono font-semibold text-amber-800">
                {platformConfig.companyName} Gold Vault
              </span>
            </div>

            {authUser && onOpenDashboard ? (
              <div className="space-y-5 pt-2">
                <div className="pb-4 border-b border-amber-200/80 space-y-1">
                  <h1 className="font-display font-bold text-slate-900 text-2xl leading-tight">
                    Active Vault Session
                  </h1>
                  <p className="text-xs text-slate-600">
                    Signed in as{' '}
                    <strong className="text-slate-900">{userProfile?.fullName || authUser.email}</strong>
                    {userProfile?.handle ? ` · ${userProfile.handle}` : ''}
                  </p>
                </div>

                {userProfile && (
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-white/85 border border-amber-200/70">
                      <div className="text-slate-500">Deposit Wallet</div>
                      <div className="font-mono font-bold text-lg text-slate-900 tabular-nums mt-0.5">
                        ${userProfile.usdBalance.toFixed(2)}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-white/85 border border-amber-200/70">
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
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-sm font-bold shadow-md transition-colors inline-flex items-center justify-center gap-2"
                  >
                    <span>Return to Vault Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenDashboard('forex-market')}
                    className="w-full py-2.5 px-4 rounded-xl border border-amber-300 bg-white/90 hover:bg-white text-slate-800 text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2"
                  >
                    <Globe className="w-4 h-4 text-amber-600" />
                    <span>Open Forex WebTerminal &amp; Copy Trade</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-amber-200/80">
                  <div className="flex items-center gap-3">
                    <AlphatradexLogo3D variant="mark" size="md" companyName={platformConfig.companyName} />
                    <div>
                      <h1 className="font-display font-bold text-slate-900 text-2xl leading-tight">
                        {isSignUpMode ? 'Verified Client Registration' : 'Client Vault Sign In'}
                      </h1>
                      <p className="text-xs text-slate-600 mt-1">
                        {isSignUpMode
                          ? 'Complete all 3 verification pages to activate deposits, AI packages, and instant payouts.'
                          : 'Access your Deposit Wallet, AI Packages, P2P Ledger, and Forex Desk.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center p-1 rounded-lg shrink-0 bg-amber-100/90 border border-amber-200/80">
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
                          ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-sm'
                          : 'text-amber-950/75 hover:text-slate-900'
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
                          ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-sm'
                          : 'text-amber-950/75 hover:text-slate-900'
                      }`}
                    >
                      Sign Up (KYC)
                    </button>
                  </div>
                </div>

                {/* 3-Page Progress Stepper for Sign Up */}
                {isSignUpMode && (
                  <div className="mt-5 space-y-2.5">
                    <div className="grid grid-cols-3 gap-2.5">
                      {signupStepsMeta.map(({ step, label, subtitle }) => {
                        const isActive = signupStep === step;
                        const isDone = signupStep > step;
                        const canJumpBack = step < signupStep;
                        return (
                          <button
                            key={step}
                            type="button"
                            disabled={!canJumpBack && !isActive}
                            onClick={() => {
                              if (canJumpBack) {
                                setErrorMsg('');
                                setSignupStep(step);
                              }
                            }}
                            className={`text-left px-3 py-2.5 rounded-xl border transition-colors ${
                              isActive
                                ? 'bg-slate-900 border-amber-500 text-white shadow-md'
                                : isDone
                                ? 'bg-amber-100/80 border-amber-400/70 text-amber-950 hover:bg-amber-100 cursor-pointer'
                                : 'bg-white/60 border-amber-200/70 text-slate-500 cursor-default'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 text-xs font-bold">
                              <span className="truncate">{label}</span>
                              {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />}
                            </div>
                            <div
                              className={`text-[11px] truncate mt-0.5 ${
                                isActive
                                  ? 'text-amber-300'
                                  : isDone
                                  ? 'text-amber-800'
                                  : 'text-slate-400'
                              }`}
                            >
                              {subtitle}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-amber-200/70 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-600 transition-transform duration-300 origin-left"
                        style={{
                          transform: `scaleX(${signupStep / 3})`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {isSignUpMode && platformConfig.signupsPaused && (
                  <div className="mt-4 p-3.5 rounded-xl bg-red-50 border border-red-300 text-xs text-red-900 leading-relaxed flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>
                      New client registrations are temporarily paused by administration. Existing members can sign in normally.
                    </span>
                  </div>
                )}

                {authGateNotice && (
                  <div className="mt-4 p-3.5 rounded-xl bg-amber-100/90 border border-amber-400/80 text-xs text-amber-950 leading-relaxed flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <span className="font-medium">{authGateNotice}</span>
                    </div>
                    {onClearAuthNotice && (
                      <button
                        type="button"
                        onClick={onClearAuthNotice}
                        className="text-[11px] font-semibold text-amber-800 hover:text-amber-950 shrink-0"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                )}

                {errorMsg && (
                  <div className="mt-4 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 leading-relaxed space-y-2.5">
                    <div>{errorMsg}</div>
                    {showInlineGoogleTerms && (
                      <TermsAgreementCheckbox
                        id="signup-google-terms-checkbox"
                        variant="light"
                        checked={acceptedTerms}
                        onChange={(val) => {
                          setAcceptedTerms(val);
                          if (val) setErrorMsg('');
                        }}
                        onOpenTerms={() => onSelectSection('terms')}
                      />
                    )}
                    {(providerNotEnabled || (showInlineGoogleTerms && acceptedTerms)) && (
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

                {/* Instant Google Sign-In (shown on Sign In and Step 1 of Sign Up) */}
                {(!isSignUpMode || signupStep === 1) && (
                  <div className="mt-5 space-y-4">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleGoogleAuth}
                      className="w-full py-2.5 px-4 rounded-xl border border-amber-300 bg-white/90 hover:bg-white shadow-sm text-slate-900 text-sm font-semibold transition-colors flex items-center justify-center gap-2.5"
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
                        {isSignUpMode
                          ? 'Continue with Google (Instant Account + KYC)'
                          : 'Continue with Google (Instant Sign In)'}
                      </span>
                    </button>

                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-amber-300/70" />
                      <span className="text-[11px] font-medium text-amber-900/70 uppercase tracking-wider">
                        {isSignUpMode ? 'or complete 3-step registration' : 'or use Email & Password'}
                      </span>
                      <div className="h-px flex-1 bg-amber-300/70" />
                    </div>
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
                        className="w-full px-3.5 py-2.5 rounded-lg border border-amber-300/80 bg-white/95 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-slate-700">
                          Password *
                        </label>
                        <span className="text-[11px] text-amber-800/80 font-medium inline-flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          256-bit Protected
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type={showLoginPassword ? 'text' : 'password'}
                          required
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          placeholder="Enter your password"
                          className="w-full pl-3.5 pr-10 py-2.5 rounded-lg border border-amber-300/80 bg-white/95 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20"
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword((prev) => !prev)}
                          aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                          className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-500 hover:text-amber-700 transition-colors"
                        >
                          {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-white/75 border border-amber-200/80 flex items-center justify-between gap-3 text-xs text-slate-700">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span>Direct access to AI Vaults, Forex Desk &amp; Crypto Payouts</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('signup');
                          setErrorMsg('');
                          setSuccessMsg('');
                        }}
                        className="font-semibold text-amber-800 hover:text-amber-950 whitespace-nowrap"
                      >
                        New Client?
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-60 text-white text-sm font-bold shadow-md transition-colors inline-flex items-center justify-center gap-2"
                    >
                      <span>{submitting ? 'Authenticating...' : 'Sign In to Gold Vault'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleSignUpSubmit} className="mt-5 space-y-4">
                    {/* PAGE 1: Account, Credentials & Onboarding Preferences */}
                    {signupStep === 1 && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-xs pb-1">
                          <span className="font-display font-bold text-slate-900 text-sm">
                            Page 1: Personal Profile &amp; Security Credentials
                          </span>
                          <span className="font-mono text-amber-800 font-semibold">1 / 3</span>
                        </div>

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
                              className="w-full px-3.5 py-2.5 rounded-lg border border-amber-300/80 bg-white/95 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20"
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
                              className="w-full px-3.5 py-2.5 rounded-lg border border-amber-300/80 bg-white/95 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20"
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
                              className="w-full px-3.5 py-2.5 rounded-lg border border-amber-300/80 bg-white/95 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                              Password (min 6 chars) *
                            </label>
                            <div className="relative">
                              <input
                                type={showRegPassword ? 'text' : 'password'}
                                required
                                minLength={6}
                                value={regPassword}
                                onChange={(e) => setRegPassword(e.target.value)}
                                placeholder="Create strong password"
                                className="w-full pl-3.5 pr-10 py-2.5 rounded-lg border border-amber-300/80 bg-white/95 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20"
                              />
                              <button
                                type="button"
                                onClick={() => setShowRegPassword((prev) => !prev)}
                                aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                                className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-500 hover:text-amber-700 transition-colors"
                              >
                                {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                            {regPassword.length > 0 && (
                              <div className="mt-1.5 flex items-center gap-2">
                                <div className="flex-1 grid grid-cols-3 gap-1">
                                  {[1, 2, 3].map((lvl) => (
                                    <div
                                      key={lvl}
                                      className={`h-1 rounded-full ${
                                        regPasswordScore >= lvl
                                          ? regPasswordScore === 3
                                            ? 'bg-emerald-600'
                                            : 'bg-amber-500'
                                          : 'bg-amber-200/70'
                                      }`}
                                    />
                                  ))}
                                </div>
                                <span className="text-[11px] font-medium text-slate-600">
                                  {regPasswordScore === 3
                                    ? 'Strong'
                                    : regPasswordScore >= 1
                                    ? 'Standard'
                                    : 'Too short'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Tailored Vault Focus & Preferred Settlement Asset */}
                        <div className="p-3.5 rounded-xl bg-white/80 border border-amber-200/80 space-y-3">
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-semibold text-slate-700">
                                Primary Portfolio Focus
                              </span>
                              <span className="text-[11px] text-amber-800/80 font-medium">
                                Tailors your vault onboarding
                              </span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {[
                                { id: 'ai_vaults' as const, label: 'AI Vaults', Icon: Bot },
                                { id: 'forex_copy' as const, label: 'Forex Copy', Icon: TrendingUp },
                                { id: 'coin_mining' as const, label: 'Coin Mining', Icon: Layers },
                                { id: 'custody_mlm' as const, label: 'Referrals', Icon: Users },
                              ].map(({ id, label, Icon }) => {
                                const selected = vaultFocus === id;
                                return (
                                  <button
                                    key={id}
                                    type="button"
                                    onClick={() => setVaultFocus(id)}
                                    className={`px-2.5 py-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                                      selected
                                        ? 'bg-slate-900 border-amber-500 text-amber-300 shadow-sm'
                                        : 'bg-white border-amber-200/80 text-slate-700 hover:border-amber-400'
                                    }`}
                                  >
                                    <Icon className="w-3.5 h-3.5 shrink-0" />
                                    <span>{label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="pt-2 border-t border-amber-200/60 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-700">
                              Preferred Settlement Rail
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {(['USDT TRC20', 'USDT ERC20', 'Solana SOL'] as const).map((net) => {
                                const active = preferredNetwork === net;
                                return (
                                  <button
                                    key={net}
                                    type="button"
                                    onClick={() => setPreferredNetwork(net)}
                                    className={`px-2.5 py-1 rounded-md border text-[11px] font-mono font-semibold transition-colors whitespace-nowrap ${
                                      active
                                        ? 'bg-amber-100 border-amber-500 text-amber-950'
                                        : 'bg-white border-amber-200 text-slate-600 hover:border-amber-400'
                                    }`}
                                  >
                                    {net}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleNextSignupStep}
                          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-sm font-bold shadow-md transition-colors inline-flex items-center justify-center gap-2"
                        >
                          <span>Continue to Country &amp; Phone Verification</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* PAGE 2: Country Selector & Phone Verification */}
                    {signupStep === 2 && (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
                          <span className="font-display font-bold text-slate-900 text-sm">
                            Page 2: Country Prefix &amp; Mobile Verification
                          </span>
                          <span className="font-mono text-xs text-amber-800 font-semibold">
                            {fullName} · {regEmail}
                          </span>
                        </div>

                        <div className="p-4 rounded-xl bg-white/85 border border-amber-300/80 space-y-3 shadow-sm">
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                            <div className="sm:col-span-5">
                              <label
                                htmlFor="signup-country-select"
                                className="block text-xs font-semibold text-slate-700 mb-1.5"
                              >
                                Country &amp; Dial Prefix *
                              </label>
                              <select
                                id="signup-country-select"
                                value={selectedCountryCode}
                                onChange={(e) => {
                                  setSelectedCountryCode(e.target.value);
                                  setPhoneRemainingDigits('');
                                  setPhoneOtpStep('idle');
                                  setPhoneOtpCode('');
                                  setPhoneStatusMsg(null);
                                  setVerifiedPhoneE164('');
                                }}
                                className="w-full px-3 py-2.5 rounded-lg border border-amber-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20"
                              >
                                {COUNTRY_PHONE_OPTIONS.map((country) => (
                                  <option key={country.code} value={country.code}>
                                    {country.flag} {country.name} ({country.dialPrefix})
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="sm:col-span-7">
                              <div className="flex items-center justify-between mb-1.5">
                                <label
                                  htmlFor="signup-phone-input"
                                  className="text-xs font-semibold text-slate-700 flex items-center gap-1"
                                >
                                  <Phone className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Phone Number *</span>
                                </label>
                                {isCurrentPhoneVerified ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    SMS Verified
                                  </span>
                                ) : phoneOtpStep === 'queued' ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Queued with KYC
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-mono text-slate-500">
                                    {selectedCountry.name} ({selectedCountry.dialPrefix}…)
                                  </span>
                                )}
                              </div>

                              <div className="flex items-stretch gap-2">
                                <div className="flex flex-1 items-stretch rounded-lg border border-amber-200 bg-white overflow-hidden focus-within:border-amber-600 focus-within:ring-2 focus-within:ring-amber-500/20">
                                  <span
                                    className="px-2.5 bg-amber-50 border-r border-amber-200 text-xs sm:text-sm font-mono font-bold text-slate-800 flex items-center gap-1 shrink-0 select-none"
                                    title={`${selectedCountry.name} prefix`}
                                  >
                                    <span>{selectedCountry.flag}</span>
                                    <span>{selectedCountry.dialPrefix}</span>
                                  </span>
                                  <input
                                    id="signup-phone-input"
                                    type="tel"
                                    inputMode="numeric"
                                    required
                                    value={phoneRemainingDigits}
                                    onChange={(e) => {
                                      const cleaned = normalizeRemainingPhoneDigits(
                                        selectedCountry,
                                        e.target.value
                                      );
                                      setPhoneRemainingDigits(cleaned);
                                      if (
                                        verifiedPhoneE164 &&
                                        `${selectedCountry.dialPrefix}${cleaned}` !== verifiedPhoneE164
                                      ) {
                                        setPhoneOtpStep('idle');
                                        setVerifiedPhoneE164('');
                                      } else if (phoneOtpStep === 'queued') {
                                        setPhoneOtpStep('idle');
                                        setPhoneStatusMsg(null);
                                      }
                                    }}
                                    placeholder={selectedCountry.placeholder}
                                    className="w-full px-3 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none"
                                  />
                                </div>

                                <button
                                  type="button"
                                  disabled={
                                    phoneVerifyBusy ||
                                    !phoneValidation.valid ||
                                    isCurrentPhoneVerified
                                  }
                                  onClick={handleSendPhoneOtp}
                                  className={`px-3 py-2 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
                                    isCurrentPhoneVerified
                                      ? 'bg-emerald-600 text-white cursor-default'
                                      : phoneOtpStep === 'queued'
                                      ? 'bg-sky-700 hover:bg-sky-600 text-white'
                                      : 'bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white'
                                  }`}
                                >
                                  {isCurrentPhoneVerified
                                    ? 'Verified ✓'
                                    : phoneVerifyBusy
                                    ? 'Sending...'
                                    : phoneOtpStep === 'sent'
                                    ? 'Resend OTP'
                                    : phoneOtpStep === 'queued'
                                    ? 'Saved ✓ (Retry SMS)'
                                    : 'Verify Number'}
                                </button>
                              </div>

                              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                                <span>
                                  Full Number:{' '}
                                  <strong className="font-mono text-slate-800">
                                    {phoneValidation.fullNumber}
                                  </strong>
                                </span>
                                <span className="font-mono">
                                  {phoneRemainingDigits.length}/{selectedCountry.maxRemainingDigits} digits
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Inline OTP Code Confirmation Row */}
                          {phoneOtpStep === 'sent' && !isCurrentPhoneVerified && (
                            <div className="p-3 rounded-lg bg-white border border-amber-300 flex flex-wrap items-center gap-2">
                              <input
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                value={phoneOtpCode}
                                onChange={(e) => setPhoneOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="Enter 6-digit SMS OTP"
                                aria-label="SMS verification OTP code"
                                className="flex-1 min-w-[160px] px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm text-slate-900 focus:outline-none focus:border-amber-600"
                              />
                              <button
                                type="button"
                                disabled={phoneVerifyBusy || phoneOtpCode.length < 4}
                                onClick={handleConfirmPhoneOtp}
                                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold"
                              >
                                {phoneVerifyBusy ? 'Confirming...' : 'Confirm OTP'}
                              </button>
                            </div>
                          )}

                          {phoneStatusMsg && (
                            <div
                              className={`p-2.5 rounded-lg text-[11px] leading-relaxed border ${
                                phoneStatusMsg.type === 'ok'
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                  : phoneStatusMsg.type === 'err'
                                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                                  : 'bg-sky-50 border-sky-200 text-sky-900'
                              }`}
                            >
                              <div>{phoneStatusMsg.text}</div>
                            </div>
                          )}

                          <div ref={phoneRecaptchaRef} />

                          <div className="pt-2 border-t border-amber-200/70 flex items-start gap-2 text-[11px] text-slate-600 leading-relaxed">
                            <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                            <span>
                              Your verified mobile number locks withdrawal approvals and P2P transfers to your custody profile and is never displayed publicly.
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setErrorMsg('');
                              setSignupStep(1);
                            }}
                            className="px-4 py-3 rounded-xl border border-amber-300 bg-white/85 hover:bg-white text-slate-800 text-sm font-semibold inline-flex items-center gap-1.5 transition-colors shrink-0"
                          >
                            <ArrowLeft className="w-4 h-4" />
                            <span>Back</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleNextSignupStep}
                            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-sm font-bold shadow-md transition-colors inline-flex items-center justify-center gap-2"
                          >
                            <span>Continue to Identity KYC &amp; Terms</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* PAGE 3: Identity Verification Document, Photos, Terms & Final Submit */}
                    {signupStep === 3 && (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
                          <span className="font-display font-bold text-slate-900 text-sm">
                            Page 3: Identity KYC Documents &amp; Activation
                          </span>
                          <span className="font-mono text-xs text-amber-800 font-semibold">
                            {phoneValidation.fullNumber}
                          </span>
                        </div>

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
                                      ? 'border-amber-600 bg-amber-100/80 text-amber-950 shadow-sm'
                                      : 'border-amber-200/80 bg-white/90 text-slate-700 hover:bg-white'
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
                            className="w-full px-3.5 py-2.5 rounded-lg border border-amber-300/80 bg-white/95 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20"
                          />
                        </div>

                        {/* Document Photo & Portrait Photo Upload */}
                        <div className="grid grid-cols-2 gap-3.5">
                          <div className="border border-amber-200 bg-white/85 rounded-xl p-3">
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
                              className="w-full h-24 rounded-lg border border-dashed border-amber-300 hover:border-amber-500 bg-amber-50/50 flex flex-col items-center justify-center gap-1 text-xs text-slate-600 overflow-hidden"
                            >
                              {idPhotoData ? (
                                <img
                                  src={idPhotoData}
                                  alt="Uploaded document"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <>
                                  <Upload className="w-4 h-4 text-amber-600" />
                                  <span>Upload ID</span>
                                </>
                              )}
                            </button>
                          </div>

                          <div className="border border-amber-200 bg-white/85 rounded-xl p-3">
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
                              className="w-full h-24 rounded-lg border border-dashed border-amber-300 hover:border-amber-500 bg-amber-50/50 flex flex-col items-center justify-center gap-1 text-xs text-slate-600 overflow-hidden"
                            >
                              {portraitPhotoData ? (
                                <img
                                  src={portraitPhotoData}
                                  alt="Client portrait"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <>
                                  <Upload className="w-4 h-4 text-amber-600" />
                                  <span>Portrait Photo</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Pre-Activation Review Summary */}
                        <div className="p-3.5 rounded-xl bg-white/85 border border-amber-300/80 space-y-2 text-xs">
                          <div className="flex items-center justify-between font-semibold text-slate-900">
                            <span className="inline-flex items-center gap-1.5">
                              <ShieldCheck className="w-4 h-4 text-emerald-700" />
                              <span>Pre-Activation Compliance Summary</span>
                            </span>
                            <span className="font-mono text-[11px] text-amber-800">{preferredNetwork}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-600 pt-1 border-t border-amber-200/60">
                            <div>
                              Applicant: <strong className="text-slate-900">{fullName}</strong>
                            </div>
                            <div>
                              Focus: <strong className="text-slate-900">{focusMeta[vaultFocus]}</strong>
                            </div>
                            <div className="truncate">
                              Email: <strong className="text-slate-900">{regEmail}</strong>
                            </div>
                            <div>
                              Mobile:{' '}
                              <strong className="font-mono text-slate-900">{phoneValidation.fullNumber}</strong>{' '}
                              <span className={isCurrentPhoneVerified ? 'text-emerald-700 font-semibold' : 'text-amber-800'}>
                                ({isCurrentPhoneVerified ? 'Verified' : 'KYC Queue'})
                              </span>
                            </div>
                          </div>
                        </div>

                        <TermsAgreementCheckbox
                          id="signup-terms-checkbox"
                          variant="light"
                          checked={acceptedTerms}
                          onChange={setAcceptedTerms}
                          onOpenTerms={() => onSelectSection('terms')}
                        />

                        <div className="flex items-center gap-3 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setErrorMsg('');
                              setSignupStep(2);
                            }}
                            className="px-4 py-3 rounded-xl border border-amber-300 bg-white/85 hover:bg-white text-slate-800 text-sm font-semibold inline-flex items-center gap-1.5 transition-colors shrink-0"
                          >
                            <ArrowLeft className="w-4 h-4" />
                            <span>Back</span>
                          </button>
                          <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-60 text-white text-sm font-bold shadow-md transition-colors inline-flex items-center justify-center gap-2"
                          >
                            <span>{submitting ? 'Submitting KYC...' : 'Complete Sign Up & Submit KYC'}</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </form>
                )}

                {/* Institutional Verification & Trust Strip (Shared across Sign In & Sign Up) */}
                <div className="mt-6 pt-5 border-t border-amber-200/80 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[11px]">
                    <div className="p-2.5 rounded-lg bg-white/70 border border-amber-200/70">
                      <div className="text-slate-500 flex items-center gap-1">
                        <Star className="w-3 h-3 text-emerald-600 fill-emerald-600" />
                        <span>Trustpilot</span>
                      </div>
                      <div className="font-mono font-bold text-slate-900 tabular-nums mt-0.5">
                        {platformConfig.trustpilotScore.toFixed(1)}/5 · {platformConfig.trustpilotReviews.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white/70 border border-amber-200/70">
                      <div className="text-slate-500 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-amber-600" />
                        <span>Norton Audit</span>
                      </div>
                      <div className="font-mono font-bold text-slate-900 tabular-nums mt-0.5">
                        {platformConfig.nortonScore.toFixed(1)} / 5.0 Verified
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white/70 border border-amber-200/70">
                      <div className="text-slate-500 flex items-center gap-1">
                        <Award className="w-3 h-3 text-amber-600" />
                        <span>ISO 27001</span>
                      </div>
                      <div className="font-mono font-bold text-slate-900 tabular-nums mt-0.5">
                        {platformConfig.isoScore.toFixed(1)} / 5.0 Custody
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white/70 border border-amber-200/70">
                      <div className="text-slate-500 flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>CertiK Guard</span>
                      </div>
                      <div className="font-mono font-bold text-slate-900 tabular-nums mt-0.5">
                        {platformConfig.certikScore.toFixed(1)} / 5.0 Smart Vault
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-amber-950/75">
                    <span>Encrypted KYC Vault · Dedicated Account Ledger</span>
                    <span>Crypto Custody: USDT TRC20 · USDT ERC20 · Solana SOL</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
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
                <div className="space-y-3.5">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.14em] text-amber-400">
                    <span>Sovereign Multi-Asset Custody</span>
                    <span aria-hidden="true">·</span>
                    <span>Algorithmic Execution</span>
                    <span aria-hidden="true">·</span>
                    <span className={isWeekend ? 'text-amber-300' : 'text-emerald-400'}>
                      {isWeekend ? 'Weekend Rest (Sat–Sun)' : 'Mon–Fri Markets Open'}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="font-editorial italic text-xl sm:text-2xl text-amber-200/90 tracking-wide">
                      Precision Wealth &amp; Quantitative Vault Architecture
                    </div>
                    <h1 className="font-display font-extrabold text-gold-gradient text-4xl sm:text-5xl tracking-tight leading-[1.08]">
                      {platformConfig.companyName}
                    </h1>
                  </div>
                  <p className="text-slate-100 text-base sm:text-lg font-medium leading-relaxed max-w-2xl">
                    {platformConfig.companyTagline}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed max-w-2xl">
                    {platformConfig.companyDescription}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => onSelectSection('plans')}
                    className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-sm font-bold shadow-lg shadow-amber-950/30 transition-colors inline-flex items-center gap-2"
                  >
                    <span>Explore Investment Plans</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectSection('forex')}
                    className="px-4 py-3 rounded-xl border border-amber-500/35 bg-slate-900/85 hover:border-amber-400/70 text-amber-100 hover:text-white text-sm font-semibold transition-colors inline-flex items-center gap-2"
                  >
                    <Globe className="w-4 h-4 text-amber-400" />
                    <span>Forex WebTerminal &amp; Copy Trade</span>
                    {!authUser && <Lock className="w-3.5 h-3.5 text-amber-400/90" />}
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
                  className="p-4 rounded-xl bg-slate-900/75 border border-slate-700/70 hover:border-amber-500/60 text-left space-y-1 transition-colors"
                >
                  <div className="text-xs font-semibold text-slate-300">{pkg.name}</div>
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

          {/* Gemini-Powered Daily Crypto, AI Trading & Forex Market Trends Ticker & Module */}
          <HomepageMarketNewsModule
            onOpenForexNews={() => onSelectSection('forex-news')}
          />

          {/* Dedicated Feature Navigation Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => onSelectSection('ai-trading')}
              className="p-5 rounded-2xl bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 hover:border-amber-500/60 text-left space-y-2 transition-colors shadow-xl"
            >
              <div className="flex items-center justify-between text-xs font-mono text-amber-400">
                <span>ALGORITHMIC EXECUTION</span>
                <span className="inline-flex items-center gap-1.5">
                  {!authUser && <Lock className="w-3.5 h-3.5 text-amber-300" />}
                  <Bot className="w-4 h-4" />
                </span>
              </div>
              <div className="font-display font-bold text-white text-lg tracking-tight">
                Mon–Fri AI Trading Desk
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Dedicated 200-profit-day algorithmic execution running Monday to Friday with automatic Weekend Rest preservation.
              </p>
              {!authUser && (
                <div className="pt-1 text-[11px] font-mono font-semibold text-amber-300">
                  Sign Up Required to Open →
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={() => onSelectSection('pump-fun')}
              className="p-5 rounded-2xl bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 hover:border-amber-400/70 text-left space-y-2 transition-colors shadow-xl"
            >
              <div className="flex items-center justify-between text-xs font-mono text-amber-400">
                <span>3D QUANTUM ASIC RIG</span>
                <span className="inline-flex items-center gap-1.5">
                  {!authUser && <Lock className="w-3.5 h-3.5 text-amber-300" />}
                  <TrendingUp className="w-4 h-4" />
                </span>
              </div>
              <div className="font-display font-bold text-white text-lg tracking-tight">
                {platformConfig.pumpFunToken.name} (${platformConfig.pumpFunToken.ticker})
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Live 3D ASIC mining stage, Pump.fun Solana liquidity tracking, and Upcoming Crypto Mining Bot roadmap.
              </p>
              {!authUser && (
                <div className="pt-1 text-[11px] font-mono font-semibold text-amber-300">
                  Sign Up Required to Open →
                </div>
              )}
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
              <div className="font-display font-bold text-white text-lg tracking-tight">
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

          {/* Dynamic Self-Service FAQ Accordion (Vault Deposits & AI Packages) */}
          <HomepageFaqAccordion
            platformConfig={platformConfig}
            isSignedIn={Boolean(authUser)}
            onSelectSection={onSelectSection}
            onOpenAuth={onOpenAuth}
            onOpenDashboard={onOpenDashboard}
          />

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

      {/* Defensive Sign-Up Gate for Member-Only Modules */}
      {platformConfig.moduleControls?.requireSignupForTradingModules !== false &&
        !authUser &&
        (activeSection === 'ai-trading' ||
          activeSection === 'forex' ||
          activeSection === 'pump-fun') && (
          <div className="max-w-xl mx-auto rounded-2xl p-8 border border-amber-400/70 bg-gradient-to-br from-[#FFFDF7] via-[#FEF9EA] to-[#FAEDC7] text-slate-900 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="font-display font-bold text-2xl text-slate-900">
              Verified Member Access Required
            </h1>
            <p className="text-sm text-slate-700 leading-relaxed">
              Sign Up (KYC) or Sign In to unlock AI Trading Desk, Forex Market WebTerminal, and {platformConfig.pumpFunToken.name} Coin.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onOpenAuth('signup')}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-sm font-bold shadow-md transition-colors inline-flex items-center gap-2"
              >
                <span>Complete Sign Up (KYC)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth('signin')}
                className="px-5 py-2.5 rounded-xl border border-amber-400 bg-white text-slate-900 text-sm font-semibold hover:bg-amber-50 transition-colors"
              >
                Sign In
              </button>
            </div>
          </div>
        )}

      {/* 3. DEDICATED AI TRADING DESK PAGE */}
      {(authUser || platformConfig.moduleControls?.requireSignupForTradingModules === false) &&
        platformConfig.moduleControls?.aiTradingEnabled !== false &&
        activeSection === 'ai-trading' && (
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

      {/* 4. DEDICATED ALPHATRADEX PROPRIETARY FOREX WEBTERMINAL & COPY TRADE PAGE */}
      {(authUser || platformConfig.moduleControls?.requireSignupForTradingModules === false) &&
        platformConfig.moduleControls?.forexMarketEnabled !== false &&
        activeSection === 'forex' && (
        <div className="space-y-5">
          <div className="bg-[#0B111E]/85 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-xs font-mono text-orange-400 font-semibold">
                <Globe className="w-4 h-4" />
                ALPHATRADEX LIVE WEBTERMINAL · 3 ACCOUNT CATEGORIES · COPY TRADE
              </div>
              <h1 className="font-display font-extrabold text-white text-2xl sm:text-3xl tracking-tight">
                {platformConfig.companyName} Forex WebTerminal &amp; Copy Trading
              </h1>
            </div>
            <button
              type="button"
              onClick={() => openPortalOrAuth('forex-market', 'signin')}
              className="px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors shrink-0"
            >
              <span>{authUser ? 'Trade Inside Vault' : 'Sign In to Trade Live'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <ForexMarketView
            mode="preview"
            onRequireAuth={() => openPortalOrAuth('forex-market', 'signin')}
            onNavigateToDeposit={() => openPortalOrAuth('dashboard', 'signin')}
            onNavigateToPackages={() => onSelectSection('plans')}
          />
        </div>
      )}

      {/* 5. DEDICATED ALPHATRADEX COIN + 3D QUANTUM MINING PAGE */}
      {(authUser || platformConfig.moduleControls?.requireSignupForTradingModules === false) &&
        platformConfig.moduleControls?.coinMiningEnabled !== false &&
        activeSection === 'pump-fun' && (
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

      {/* 6. DEDICATED MULTI-LEVEL REFERRAL PROGRAM PAGE (Mentor card shown only to gifted Mentors) */}
      {activeSection === 'mentor-referral' && (
        <div className="space-y-6">
          <div className="bg-[#0B111E]/82 backdrop-blur-md border border-slate-700/70 rounded-2xl p-6 sm:p-7 shadow-xl flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-orange-400">
                <Users className="w-4 h-4" />
                <span>ALL-PLAN MULTI-LEVEL COMMISSION STRUCTURE</span>
              </div>
              <h1 className="font-display font-extrabold text-white text-2xl sm:text-3xl tracking-tight">
                {userProfile?.isMentor
                  ? 'Referral & Mentor Commission Program'
                  : 'Referral Commission Program'}
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
              userProfile?.isMentor && platformConfig.mentorConfig?.enabled
                ? 'md:grid-cols-4'
                : 'md:grid-cols-3'
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
            {userProfile?.isMentor && platformConfig.mentorConfig?.enabled && (
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

      {/* 7. DEDICATED FOREX & CRYPTO NEWS HUB (Myfxbook-Style Auto-Publishing Desk) */}
      {activeSection === 'forex-news' && <ForexNewsHub />}

      {/* 8. DEDICATED TERMS & CONDITIONS PAGE */}
      {activeSection === 'terms' && (
        <TermsAndConditionsView
          onBack={() => onSelectSection('home')}
          backLabel={authUser && onOpenDashboard ? 'Back to Home Overview' : 'Back to Home Overview'}
        />
      )}
    </main>
  );
};
