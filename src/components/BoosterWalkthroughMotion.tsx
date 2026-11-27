import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  Calendar,
  Cpu,
  Pause,
  Play,
  RefreshCw,
  Rocket,
  RotateCcw,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { DEFAULT_BOOSTER_CONFIG } from '../constants/defaults';
import { usePlatform } from '../context/PlatformContext';

type WalkthroughLang = 'en' | 'bn' | 'hi' | 'es';

interface StepCopy {
  number: string;
  shortTitle: string;
  title: string;
  description: string;
  metricLabel: string;
  metricValue: string;
  highlight: string;
}

interface LocalizedWalkthrough {
  langLabel: string;
  kicker: string;
  heading: string;
  subheading: string;
  autoPlayLabel: string;
  pauseLabel: string;
  replayLabel: string;
  steps: StepCopy[];
}

function buildWalkthroughCopy(boosterName: string): Record<WalkthroughLang, LocalizedWalkthrough> {
  return {
    en: {
      langLabel: 'English',
      kicker: `Interactive Walkthrough · ${boosterName}`,
      heading: `How ${boosterName} Works`,
      subheading:
        'Follow the 4-stage lifecycle from USDT allocation to 360° telemetry sync, Mon–Fri settlement, and flexible compounding or withdrawal.',
      autoPlayLabel: 'Auto-Play',
      pauseLabel: 'Pause',
      replayLabel: 'Replay',
      steps: [
        {
          number: '01',
          shortTitle: 'Activate',
          title: `Activate ${boosterName}`,
          description: `Select a compute tier (Spark Core, Pulse Node, Vector Array, or Sovereign Cluster) and allocate USDT directly from your AlphaTradex wallet.`,
          metricLabel: 'Entry Allocation',
          metricValue: '$100 – $1,000',
          highlight: 'Instant wallet verification & tier lock-in',
        },
        {
          number: '02',
          shortTitle: '360° Sync',
          title: '360° Engine Sync',
          description: `Your ${boosterName} module locks into the AlphaTradex compute matrix with real-time cycle telemetry, harmonic ring balancing, and thermal monitoring.`,
          metricLabel: 'Telemetry State',
          metricValue: '99.2% Sync',
          highlight: 'Live Boost Power & Standard/Turbo telemetry',
        },
        {
          number: '03',
          shortTitle: 'Mon–Fri Yield',
          title: 'Mon–Fri Profit Settlement',
          description:
            'Daily rewards settle automatically on active profit days across the 200-day earning cycle (Monday through Friday, weekends off).',
          metricLabel: 'Earning Schedule',
          metricValue: '200 Weekdays',
          highlight: 'Deterministic Mon–Fri accrual into Income Wallet',
        },
        {
          number: '04',
          shortTitle: 'Compound / Exit',
          title: 'Compound or Launchpad/Withdraw',
          description:
            'Re-invest rewards into higher boost capacity, participate in AlphaTradex Meme Launchpad drops, or request a secure admin-approved withdrawal.',
          metricLabel: 'Flexible Output',
          metricValue: '3 Destinations',
          highlight: 'Compound · Meme Launchpad · 2FA Withdrawal',
        },
      ],
    },
    bn: {
      langLabel: 'বাংলা',
      kicker: `ইন্টারেক্টিভ গাইড · ${boosterName}`,
      heading: `${boosterName} যেভাবে কাজ করে`,
      subheading:
        'আপনার AlphaTradex ওয়ালেট থেকে শুরু করে ৩৬০° ইঞ্জিন সিঙ্ক, সোম–শুক্র দৈনিক প্রফিট সেটেলমেন্ট এবং রি-ইনভেস্ট বা উইথড্রয়াল পর্যন্ত ৪টি ধাপ দেখুন।',
      autoPlayLabel: 'অটো-প্লে',
      pauseLabel: 'পজ',
      replayLabel: 'রিপ্লে',
      steps: [
        {
          number: '01',
          shortTitle: 'অ্যাক্টিভেট',
          title: `${boosterName} অ্যাক্টিভেট করুন`,
          description: `আপনার পছন্দমতো বুস্টার টিয়ার (Spark Core, Pulse Node, Vector Array, বা Sovereign Cluster) বেছে নিন এবং AlphaTradex ওয়ালেট থেকে USDT বরাদ্দ করুন।`,
          metricLabel: 'শুরু করুন',
          metricValue: '$100 – $1,000',
          highlight: 'ওয়ালেট থেকে তাৎক্ষণিক অ্যাক্টিভেশন',
        },
        {
          number: '02',
          shortTitle: '৩৬০° সিঙ্ক',
          title: '৩৬০° ইঞ্জিন সিঙ্ক',
          description: `আপনার ${boosterName} রিয়েল-টাইম টেলিমেট্রি এবং হারমোনিক সিঙ্কসহ AlphaTradex কম্পিউট ম্যাট্রিক্সে যুক্ত হয়ে যায়।`,
          metricLabel: 'ইঞ্জিন সিঙ্ক',
          metricValue: '99.2% লাইভ',
          highlight: 'লাইভ বুস্ট পাওয়ার ও থার্মাল মনিটরিং',
        },
        {
          number: '03',
          shortTitle: 'সোম–শুক্র প্রফিট',
          title: 'সোম–শুক্র প্রফিট সেটেলমেন্ট',
          description:
            '২০০ কার্যদিবসের সাইকেলে প্রতি সোমবার থেকে শুক্রবার (সাপ্তাহিক ছুটি বাদে) স্বয়ংক্রিয়ভাবে দৈনিক প্রফিট জমা হয়।',
          metricLabel: 'আয়ের সাইকেল',
          metricValue: '২০০ কার্যদিবস',
          highlight: 'ইনকাম ওয়ালেটে নিয়মিত দৈনিক সেটেলমেন্ট',
        },
        {
          number: '04',
          shortTitle: 'কম্পাউন্ড / উত্তোলন',
          title: 'কম্পাউন্ড, লঞ্চপ্যাড বা উইথড্র',
          description:
            'অর্জিত প্রফিট দিয়ে উচ্চতর বুস্ট ক্যাপাসিটি নিন, Meme Launchpad-এ অংশ নিন, অথবা নিরাপদ অ্যাডমিন-অনুমোদিত উইথড্রয়াল রিকোয়েস্ট করুন।',
          metricLabel: 'ব্যবহারের অপশন',
          metricValue: '৩টি মাধ্যম',
          highlight: 'রি-ইনভেস্ট · Meme Launchpad · নিরাপদ উইথড্র',
        },
      ],
    },
    hi: {
      langLabel: 'हिन्दी',
      kicker: `इंटरैक्टिव वॉकथ्रू · ${boosterName}`,
      heading: `${boosterName} कैसे काम करता है`,
      subheading:
        'USDT आवंटन से 360° टेलीमेट्री सिंक, सोम–शुक्र प्रॉफिट सेटलमेंट और कम्पाउंडिंग या निकासी तक की 4-चरणीय प्रक्रिया देखें।',
      autoPlayLabel: 'ऑटो-प्ले',
      pauseLabel: 'रोकें',
      replayLabel: 'रीप्ले',
      steps: [
        {
          number: '01',
          shortTitle: 'एक्टिवेट',
          title: `${boosterName} एक्टिवेट करें`,
          description:
            'एक बूस्टर टियर (Spark Core, Pulse Node, Vector Array, या Sovereign Cluster) चुनें और अपने AlphaTradex वॉलेट से USDT आवंटित करें।',
          metricLabel: 'आवंटन सीमा',
          metricValue: '$100 – $1,000',
          highlight: 'तुरंत वॉलेट सत्यापन और टियर लॉक',
        },
        {
          number: '02',
          shortTitle: '360° सिंक',
          title: '360° इंजन सिंक',
          description: `आपका ${boosterName} रियल-टाइम साइकिल टेलीमेट्री और थर्मल एफिशिएंसी के साथ AlphaTradex कंप्यूट मैट्रिक्स से जुड़ जाता है।`,
          metricLabel: 'टेलीमेट्री स्थिति',
          metricValue: '99.2% सिंक',
          highlight: 'लाइव बूस्ट पावर और टर्बो मॉनिटरिंग',
        },
        {
          number: '03',
          shortTitle: 'सोम–शुक्र आय',
          title: 'सोम–शुक्र प्रॉफिट सेटलमेंट',
          description:
            '200-दिन के अर्निंग साइकिल में हर सोमवार से शुक्रवार (शनिवार–रविवार अवकाश) दैनिक रिवॉर्ड्स स्वतः सेटल होते हैं।',
          metricLabel: 'अर्निंग शेड्यूल',
          metricValue: '200 कार्यदिवस',
          highlight: 'इनकम वॉलेट में पारदर्शी दैनिक सेटलमेंट',
        },
        {
          number: '04',
          shortTitle: 'कम्पाउंड / निकासी',
          title: 'कम्पाउंड, लॉन्चपैड या विथड्रॉल',
          description:
            'रिवॉर्ड्स को उच्च बूस्ट क्षमता में री-इन्वेस्ट करें, Meme Launchpad ड्रॉप्स में भाग लें, या सुरक्षित एडमिन-स्वीकृत निकासी का अनुरोध करें।',
          metricLabel: 'लचीले विकल्प',
          metricValue: '3 विकल्प',
          highlight: 'कम्पाउंड · Meme Launchpad · 2FA निकासी',
        },
      ],
    },
    es: {
      langLabel: 'Español',
      kicker: `Guía Interactiva · ${boosterName}`,
      heading: `Cómo Funciona ${boosterName}`,
      subheading:
        'Recorre el ciclo en 4 pasos desde la asignación USDT hasta la sincronización 360°, liquidación Lun–Vie y reinversión o retiro.',
      autoPlayLabel: 'Auto-Play',
      pauseLabel: 'Pausar',
      replayLabel: 'Repetir',
      steps: [
        {
          number: '01',
          shortTitle: 'Activar',
          title: `Activar ${boosterName}`,
          description:
            'Elige un nivel (Spark Core, Pulse Node, Vector Array o Sovereign Cluster) y asigna USDT directamente desde tu billetera AlphaTradex.',
          metricLabel: 'Asignación',
          metricValue: '$100 – $1,000',
          highlight: 'Validación instantánea desde tu bóveda',
        },
        {
          number: '02',
          shortTitle: 'Sync 360°',
          title: 'Sincronización 360°',
          description: `Tu módulo ${boosterName} se acopla a la matriz de cómputo AlphaTradex con telemetría de ciclo y eficiencia térmica en vivo.`,
          metricLabel: 'Estado de Sync',
          metricValue: '99.2% Activo',
          highlight: 'Potencia Boost y control Turbo/Estándar',
        },
        {
          number: '03',
          shortTitle: 'Lun–Vie',
          title: 'Liquidación Lun–Vie',
          description:
            'Las recompensas diarias se liquidan automáticamente en días activos durante el ciclo de 200 días hábiles (lunes a viernes).',
          metricLabel: 'Calendario',
          metricValue: '200 Días Hábiles',
          highlight: 'Acreditación continua en Income Wallet',
        },
        {
          number: '04',
          shortTitle: 'Reinvertir / Retirar',
          title: 'Reinvertir, Launchpad o Retirar',
          description:
            'Reinvierte recompensas en mayor capacidad, participa en lanzamientos de Meme Launchpad o solicita un retiro seguro aprobado por administración.',
          metricLabel: 'Destinos',
          metricValue: '3 Rutas',
          highlight: 'Interés Compuesto · Meme Launchpad · Retiro 2FA',
        },
      ],
    },
  };
}

export const BoosterWalkthroughMotion: React.FC<{ onActionCta?: () => void }> = ({ onActionCta }) => {
  const { platformConfig } = usePlatform();
  const shouldReduceMotion = useReducedMotion();

  const boosterName =
    platformConfig.boosterBrandName?.trim() ||
    platformConfig.boosterConfig?.brandName?.trim() ||
    DEFAULT_BOOSTER_CONFIG.brandName;
  const copyMap = buildWalkthroughCopy(boosterName);

  const [lang, setLang] = useState<WalkthroughLang>('en');
  const [activeStep, setActiveStep] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);

  const t = copyMap[lang];
  const currentStep = t.steps[activeStep];

  useEffect(() => {
    if (!autoPlay) return;
    const timer = window.setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 4);
    }, 4600);
    return () => window.clearInterval(timer);
  }, [autoPlay]);

  const handleReplay = () => {
    setActiveStep(0);
    setAutoPlay(true);
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-5 sm:p-7 space-y-6">
      {/* Header + 4-Language Switcher + Playback Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            {t.kicker}
          </p>
          <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {t.heading}
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">{t.subheading}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 4-Language Switcher */}
          <div className="inline-flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1">
            {(['en', 'bn', 'hi', 'es'] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  lang === code
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {copyMap[code].langLabel}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setAutoPlay((p) => !p)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200"
          >
            {autoPlay ? <Pause className="h-3.5 w-3.5 text-amber-400" /> : <Play className="h-3.5 w-3.5 text-emerald-400" />}
            <span>{autoPlay ? t.pauseLabel : t.autoPlayLabel}</span>
          </button>

          <button
            type="button"
            onClick={handleReplay}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200"
          >
            <RotateCcw className="h-3.5 w-3.5 text-sky-400" />
            <span>{t.replayLabel}</span>
          </button>
        </div>
      </div>

      {/* Main Motion Stage + Step Selector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left: Step Selector Rail */}
        <div className="lg:col-span-5 grid grid-cols-2 lg:grid-cols-1 gap-2.5">
          {t.steps.map((step, idx) => {
            const isSelected = idx === activeStep;
            return (
              <button
                key={step.number}
                type="button"
                onClick={() => {
                  setActiveStep(idx);
                  setAutoPlay(false);
                }}
                className={`text-left rounded-xl border p-3.5 transition-all relative overflow-hidden ${
                  isSelected
                    ? 'border-amber-500/60 bg-slate-900 shadow-lg shadow-amber-500/5'
                    : 'border-slate-800/90 bg-slate-900/40 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`font-mono text-xs font-bold ${
                      isSelected ? 'text-amber-400' : 'text-slate-500'
                    }`}
                  >
                    STEP {step.number}
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">{step.metricValue}</span>
                </div>
                <p
                  className={`mt-1 text-sm font-bold ${
                    isSelected ? 'text-white' : 'text-slate-300'
                  }`}
                >
                  {step.title}
                </p>
                {isSelected && (
                  <motion.div
                    key={`progress-${activeStep}-${autoPlay}`}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{
                      duration: autoPlay && !shouldReduceMotion ? 4.6 : 0.35,
                      ease: 'linear',
                    }}
                    style={{ transformOrigin: 'left' }}
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400 to-emerald-400"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Right: GPU-Accelerated Interactive Visual Stage */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-5 sm:p-6 flex flex-col justify-between gap-5 overflow-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${lang}-${activeStep}`}
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -12 }}
              transition={{ duration: 0.32, ease: 'easeOut' }}
              className="space-y-5"
            >
              {/* Animated Visual Illustration per Step */}
              <div className="h-44 sm:h-48 rounded-xl border border-slate-800/80 bg-slate-950/80 relative flex items-center justify-center overflow-hidden px-4">
                {activeStep === 0 && (
                  <div className="flex items-center gap-4 sm:gap-7">
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.35 }}
                      className="rounded-xl border border-slate-700 bg-slate-900 p-3.5 text-center w-28 sm:w-32"
                    >
                      <Wallet className="h-6 w-6 text-amber-400 mx-auto mb-1.5" />
                      <p className="text-[11px] font-semibold text-white">USDT Vault</p>
                      <p className="font-mono text-[10px] text-emerald-400">Ready</p>
                    </motion.div>

                    <motion.div
                      animate={shouldReduceMotion ? undefined : { x: [0, 8, 0] }}
                      transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
                      className="text-amber-400"
                    >
                      <ArrowRight className="h-6 w-6" />
                    </motion.div>

                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.4, delay: 0.1 }}
                      className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-center w-36 sm:w-44"
                    >
                      <Cpu className="h-6 w-6 text-amber-400 mx-auto mb-1.5" />
                      <p className="text-xs font-bold text-white truncate">{boosterName}</p>
                      <p className="font-mono text-[10px] text-amber-300 mt-0.5">
                        Spark · Pulse · Vector · Sovereign
                      </p>
                    </motion.div>
                  </div>
                )}

                {activeStep === 1 && (
                  <div className="relative flex items-center justify-center w-full h-full">
                    <motion.div
                      animate={shouldReduceMotion ? undefined : { rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 10, ease: 'linear' }}
                      className="h-32 w-32 rounded-full border-2 border-dashed border-amber-400/70 absolute"
                    />
                    <motion.div
                      animate={shouldReduceMotion ? undefined : { rotate: -360 }}
                      transition={{ repeat: Infinity, duration: 7, ease: 'linear' }}
                      className="h-24 w-24 rounded-full border-2 border-teal-400/70 absolute"
                    />
                    <motion.div
                      animate={shouldReduceMotion ? undefined : { scale: [1, 1.12, 1], opacity: [0.6, 1, 0.6] }}
                      transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
                      className="h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-500/30 to-teal-500/30 border border-amber-400/50 flex items-center justify-center"
                    >
                      <Cpu className="h-6 w-6 text-amber-300" />
                    </motion.div>
                    <div className="absolute bottom-2.5 right-3 font-mono text-[10px] text-teal-300">
                      360° MATRIX LOCKED
                    </div>
                  </div>
                )}

                {activeStep === 2 && (
                  <div className="w-full max-w-md space-y-3">
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span className="inline-flex items-center gap-1 text-emerald-400">
                        <Calendar className="h-3.5 w-3.5" />
                        MON–FRI ACTIVE CYCLE
                      </span>
                      <span>200 PROFIT DAYS</span>
                    </div>
                    <div className="grid grid-cols-7 gap-1.5">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, dIdx) => {
                        const isWeekday = dIdx < 5;
                        return (
                          <motion.div
                            key={day}
                            initial={{ scaleY: 0.3, opacity: 0 }}
                            animate={{ scaleY: 1, opacity: 1 }}
                            transition={{ delay: dIdx * 0.07, duration: 0.3 }}
                            className={`rounded-lg border p-2 text-center ${
                              isWeekday
                                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                                : 'border-slate-800 bg-slate-900/60 text-slate-600'
                            }`}
                          >
                            <p className="text-[10px] font-bold">{day}</p>
                            <p className="mt-1 font-mono text-[10px]">
                              {isWeekday ? '+Yield' : 'Off'}
                            </p>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeStep === 3 && (
                  <div className="grid grid-cols-3 gap-2.5 w-full max-w-md">
                    {[
                      { icon: RefreshCw, label: 'Auto-Compound', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
                      { icon: Rocket, label: 'Meme Launchpad', color: 'text-sky-400 border-sky-500/30 bg-sky-500/10' },
                      { icon: ShieldCheck, label: '2FA Withdraw', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
                    ].map((dest, idx) => {
                      const Icon = dest.icon;
                      return (
                        <motion.div
                          key={dest.label}
                          initial={{ y: 10, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: idx * 0.1, duration: 0.3 }}
                          className={`rounded-xl border p-3 text-center ${dest.color}`}
                        >
                          <Icon className="h-5 w-5 mx-auto mb-1.5" />
                          <p className="text-[11px] font-semibold text-white">{dest.label}</p>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Copy & Telemetry Readout */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-amber-400">
                    STAGE {currentStep.number} / 04
                  </span>
                  <span className="text-xs font-mono text-emerald-400">
                    {currentStep.metricLabel}: {currentStep.metricValue}
                  </span>
                </div>
                <h4 className="text-lg sm:text-xl font-bold text-white">{currentStep.title}</h4>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {currentStep.description}
                </p>
                <p className="text-xs text-slate-400 pt-1">{currentStep.highlight}</p>
              </div>
            </motion.div>
          </AnimatePresence>

          {onActionCta && (
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500">alphatradex.pro · Mon–Fri 200-Day Settlement</span>
              <button
                type="button"
                onClick={onActionCta}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors"
              >
                <span>Open {boosterName}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
