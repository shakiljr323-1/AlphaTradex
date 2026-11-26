import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Globe } from 'lucide-react';
import { AppLanguage } from '../types/platform';

const STORAGE_KEY = 'alphatradex_ui_lang_v1';

export const LANGUAGE_META: Record<
  AppLanguage,
  { code: AppLanguage; shortLabel: string; nativeName: string; flag: string }
> = {
  en: { code: 'en', shortLabel: 'EN', nativeName: 'English', flag: '🇺🇸' },
  hi: { code: 'hi', shortLabel: 'हिन्दी', nativeName: 'हिन्दी', flag: '🇮🇳' },
  es: { code: 'es', shortLabel: 'ES', nativeName: 'Español', flag: '🇪🇸' },
};

const DICTIONARY: Record<AppLanguage, Record<string, string>> = {
  en: {
    'nav.home': 'Home Overview',
    'nav.howItWorks': 'How It Works',
    'nav.plans': 'Investment Plans',
    'nav.forexNews': 'Forex News',
    'nav.referrals': 'Referrals',
    'nav.referralsMentor': 'Referrals & Mentor',
    'nav.signIn': 'Sign In',
    'nav.register': 'Create Account',
    'nav.dashboard': 'Vault Dashboard',
    'nav.mentorDashboard': 'Mentor Dashboard',
    'nav.menu': 'Menu',
    'nav.liveDesk': 'LIVE DESK',
    'nav.deskPaused': 'DESK PAUSED',
    'dash.overview': 'Vault Overview',
    'dash.deposit': 'Deposit Funds',
    'dash.withdraw': 'Withdraw Funds',
    'dash.myPackages': 'My Packages',
    'dash.activateTrading': 'Activate AI Package',
    'dash.forexMarket': 'Forex & Market',
    'dash.referralNetwork': 'Referral & Team',
    'dash.leaderboard': 'Top Performers',
    'dash.marketingCards': 'Marketing Cards',
    'dash.videoGuide': 'Video Guide',
    'dash.securityWhitelist': 'Security & Whitelist',
    'dash.rewardsMissions': 'Daily Check-In & Missions',
    'dash.pdfStatement': 'PDF Statement',
    'dash.monthlyStatement': 'Monthly PDF Report',
    'dash.investorTools': 'Investor Tools & Alerts',
    'dash.profitCertificate': 'Profit Certificate',
    'dash.profileKyc': 'Profile & KYC',
    'dash.supportDesk': 'Support Desk',
    'dash.signOut': 'Sign Out',
    'dash.depositWallet': 'Deposit Wallet',
    'dash.incomeWallet': 'Income Wallet',
    'dash.activeCapital': 'Active Capital',
    'dash.totalWithdrawn': 'Total Withdrawn',
    'sec.title': 'Account Security & Withdrawal Whitelist',
    'missions.title': 'Daily Check-In Streak & Platform Missions',
  },
  hi: {
    'nav.home': 'होम ओवरव्यू',
    'nav.howItWorks': 'यह कैसे काम करता है',
    'nav.plans': 'निवेश प्लान',
    'nav.forexNews': 'फ़ॉरेक्स न्यूज़',
    'nav.referrals': 'रेफ़रल',
    'nav.referralsMentor': 'रेफ़रल और मेंटर',
    'nav.signIn': 'साइन इन',
    'nav.register': 'खाता बनाएं',
    'nav.dashboard': 'वॉल्ट डैशबोर्ड',
    'nav.mentorDashboard': 'मेंटर डैशबोर्ड',
    'nav.menu': 'मेनू',
    'nav.liveDesk': 'लाइव डेस्क',
    'nav.deskPaused': 'डेस्क रुका हुआ',
    'dash.overview': 'डैशबोर्ड ओवरव्यू',
    'dash.deposit': 'डिपॉज़िट करें',
    'dash.withdraw': 'विथड्रॉल करें',
    'dash.myPackages': 'मेरे पैकेज',
    'dash.activateTrading': 'AI पैकेज सक्रिय करें',
    'dash.forexMarket': 'फ़ॉरेक्स और मार्केट',
    'dash.referralNetwork': 'रेफ़रल और टीम',
    'dash.leaderboard': 'टॉप परफ़ॉर्मर्स',
    'dash.marketingCards': 'मार्केटिंग कार्ड्स',
    'dash.videoGuide': 'वीडियो गाइड',
    'dash.securityWhitelist': 'सुरक्षा और व्हाइटलिस्ट',
    'dash.rewardsMissions': 'डेली चेक-इन और मिशन',
    'dash.pdfStatement': 'PDF स्टेटमेंट',
    'dash.monthlyStatement': 'मासिक PDF रिपोर्ट',
    'dash.investorTools': 'निवेशक टूल्स और अलर्ट',
    'dash.profitCertificate': 'प्रॉफ़िट सर्टिफ़िकेट',
    'dash.profileKyc': 'प्रोफ़ाइल और KYC',
    'dash.supportDesk': 'सपोर्ट डेस्क',
    'dash.signOut': 'साइन आउट',
    'dash.depositWallet': 'डिपॉज़िट वॉलेट',
    'dash.incomeWallet': 'इनकम वॉलेट',
    'dash.activeCapital': 'सक्रिय पूंजी',
    'dash.totalWithdrawn': 'कुल निकासी',
    'sec.title': 'खाता सुरक्षा और विथड्रॉल व्हाइटलिस्ट',
    'missions.title': 'डेली चेक-इन स्ट्रीक और मिशन',
  },
  es: {
    'nav.home': 'Inicio',
    'nav.howItWorks': 'Cómo Funciona',
    'nav.plans': 'Planes de Inversión',
    'nav.forexNews': 'Noticias Forex',
    'nav.referrals': 'Referidos',
    'nav.referralsMentor': 'Referidos y Mentor',
    'nav.signIn': 'Iniciar Sesión',
    'nav.register': 'Crear Cuenta',
    'nav.dashboard': 'Panel Vault',
    'nav.mentorDashboard': 'Panel Mentor',
    'nav.menu': 'Menú',
    'nav.liveDesk': 'MESA ACTIVA',
    'nav.deskPaused': 'EN PAUSA',
    'dash.overview': 'Resumen General',
    'dash.deposit': 'Depositar Fondos',
    'dash.withdraw': 'Retirar Fondos',
    'dash.myPackages': 'Mis Paquetes',
    'dash.activateTrading': 'Activar Paquete AI',
    'dash.forexMarket': 'Mercado Forex',
    'dash.referralNetwork': 'Red de Referidos',
    'dash.leaderboard': 'Top Performers',
    'dash.marketingCards': 'Tarjetas Promo',
    'dash.videoGuide': 'Guía en Video',
    'dash.securityWhitelist': 'Seguridad y Whitelist',
    'dash.rewardsMissions': 'Check-In y Misiones',
    'dash.pdfStatement': 'Estado PDF',
    'dash.monthlyStatement': 'Reporte PDF Mensual',
    'dash.investorTools': 'Herramientas y Alertas',
    'dash.profitCertificate': 'Certificado PDF',
    'dash.profileKyc': 'Perfil y KYC',
    'dash.supportDesk': 'Soporte Técnico',
    'dash.signOut': 'Cerrar Sesión',
    'dash.depositWallet': 'Billetera Depósito',
    'dash.incomeWallet': 'Billetera Ingresos',
    'dash.activeCapital': 'Capital Activo',
    'dash.totalWithdrawn': 'Total Retirado',
    'sec.title': 'Seguridad de Cuenta y Whitelist de Retiros',
    'missions.title': 'Racha Diaria y Misiones de Plataforma',
  },
};

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: () => {},
  t: (key, fallback) => fallback || key,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'hi' || saved === 'es') {
        return saved;
      }
    } catch {
      // Ignore storage access errors
    }
    return 'en';
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Ignore
    }
  }, [language]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage: (lang) => setLanguageState(lang),
      t: (key, fallback) =>
        DICTIONARY[language]?.[key] || DICTIONARY.en[key] || fallback || key,
    }),
    [language]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}

export const LanguageSwitcher: React.FC<{
  variant?: 'dark' | 'light';
  compact?: boolean;
}> = ({ variant = 'dark', compact = false }) => {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold ${
        variant === 'dark'
          ? 'bg-slate-900/90 border-slate-700/80 text-slate-200'
          : 'bg-white border-slate-200 text-slate-700'
      }`}
    >
      <Globe
        className={`w-3.5 h-3.5 shrink-0 ${
          variant === 'dark' ? 'text-amber-400' : 'text-emerald-600'
        }`}
      />
      <select
        aria-label="Select Platform Language"
        value={language}
        onChange={(e) => setLanguage(e.target.value as AppLanguage)}
        className={`bg-transparent outline-none cursor-pointer text-xs font-semibold pr-1 ${
          variant === 'dark' ? 'text-slate-100' : 'text-slate-800'
        }`}
      >
        {(Object.keys(LANGUAGE_META) as AppLanguage[]).map((code) => {
          const item = LANGUAGE_META[code];
          return (
            <option
              key={code}
              value={code}
              className="bg-slate-900 text-white"
            >
              {compact ? item.shortLabel : `${item.flag} ${item.nativeName}`}
            </option>
          );
        })}
      </select>
    </div>
  );
};
