/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { AdminRouteGate } from './components/AdminRouteGate';
import { AiRobotBackdrop } from './components/AiRobotBackdrop';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FrontPage } from './components/FrontPage';
import { MentorDashboard } from './components/MentorDashboard';
import { Navbar } from './components/Navbar';
import { UserVaultDashboard } from './components/UserVaultDashboard';
import { LanguageProvider } from './context/LanguageContext';
import { PlatformProvider, usePlatform } from './context/PlatformContext';
import { NavSection } from './types/platform';

function checkIsAdminRoute(): boolean {
  const path = window.location.pathname.replace(/\/+$/, '');
  const hash = window.location.hash.replace(/\/+$/, '');
  return path === '/admin' || path.endsWith('/admin') || hash === '#/admin';
}

function checkIsMentorRoute(): boolean {
  const path = window.location.pathname.replace(/\/+$/, '');
  const hash = window.location.hash.replace(/\/+$/, '');
  return path === '/mentor' || path.endsWith('/mentor') || hash === '#/mentor';
}

function checkIsTermsRoute(): boolean {
  const path = window.location.pathname.replace(/\/+$/, '');
  const hash = window.location.hash.replace(/\/+$/, '');
  return path === '/terms' || path.endsWith('/terms') || hash === '#/terms';
}

const AppRouter: React.FC = () => {
  const { authUser, userProfile, authReady, platformConfig } = usePlatform();
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(checkIsAdminRoute);
  const [activeSection, setActiveSection] = useState<NavSection>(() =>
    checkIsTermsRoute() ? 'terms' : 'home'
  );
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authGateNotice, setAuthGateNotice] = useState<string | null>(null);
  const [showHomeView, setShowHomeView] = useState<boolean>(() => checkIsTermsRoute());
  const [dashTargetTab, setDashTargetTab] = useState<'dashboard' | 'forex-market' | 'pump-fun'>('dashboard');
  const [dashboardMode, setDashboardMode] = useState<'client' | 'mentor'>(() =>
    checkIsMentorRoute() ? 'mentor' : 'client'
  );

  const clearMentorRouteFromUrl = () => {
    if (window.location.hash.replace(/\/+$/, '') === '#/mentor') {
      window.location.hash = '';
    }
    const cleanPath = window.location.pathname.replace(/\/+$/, '');
    if (cleanPath === '/mentor' || cleanPath.endsWith('/mentor')) {
      const nextPath = cleanPath.replace(/\/mentor$/, '') || '/';
      window.history.replaceState({}, '', nextPath.endsWith('/') ? nextPath : `${nextPath}/`);
    }
  };

  useEffect(() => {
    const syncRoute = () => {
      setIsAdminRoute(checkIsAdminRoute());
      if (checkIsMentorRoute()) {
        setDashboardMode('mentor');
        setShowHomeView(false);
      }
      if (checkIsTermsRoute()) {
        setActiveSection('terms');
        setShowHomeView(true);
      }
    };
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('hashchange', syncRoute);
    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('hashchange', syncRoute);
    };
  }, []);

  useEffect(() => {
    if (!authUser) {
      setShowHomeView(false);
      setDashTargetTab('dashboard');
      setDashboardMode('client');
      clearMentorRouteFromUrl();
    } else {
      setAuthGateNotice(null);
    }
  }, [authUser]);

  // Hard security guard: immediately eject non-mentor or revoked accounts from Mentor Dashboard
  useEffect(() => {
    if (userProfile && !userProfile.isMentor && dashboardMode === 'mentor') {
      setDashboardMode('client');
      clearMentorRouteFromUrl();
    }
  }, [userProfile, dashboardMode]);

  const openMentorDashboard = () => {
    if (!userProfile?.isMentor) return;
    setDashboardMode('mentor');
    setShowHomeView(false);
    if (window.location.hash !== '#/mentor') {
      window.location.hash = '#/mentor';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const switchToClientVault = () => {
    setDashboardMode('client');
    setShowHomeView(false);
    clearMentorRouteFromUrl();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const exitAdminRoute = () => {
    if (window.location.hash === '#/admin') {
      window.location.hash = '';
    }
    const cleanPath = window.location.pathname.replace(/\/+$/, '');
    if (cleanPath === '/admin' || cleanPath.endsWith('/admin')) {
      const nextPath = cleanPath.replace(/\/admin$/, '') || '/';
      window.history.pushState({}, '', nextPath.endsWith('/') ? nextPath : `${nextPath}/`);
    }
    setIsAdminRoute(false);
  };

  if (isAdminRoute) {
    return (
      <>
        <AiRobotBackdrop />
        <AdminRouteGate onExitAdmin={exitAdminRoute} />
      </>
    );
  }

  if (!authReady) {
    return (
      <>
        <AiRobotBackdrop />
        <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
          <div className="bg-[#0B111E]/90 backdrop-blur-xl border border-slate-700/80 rounded-xl px-6 py-4 text-sm font-mono text-slate-200 shadow-2xl">
            Loading {platformConfig.companyName}...
          </div>
        </div>
      </>
    );
  }

  if (authUser && !showHomeView) {
    if (dashboardMode === 'mentor' && userProfile?.isMentor) {
      return (
        <>
          <AiRobotBackdrop />
          <MentorDashboard
            onSwitchToClientVault={switchToClientVault}
            onOpenHomePage={() => {
              setActiveSection('home');
              setShowHomeView(true);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </>
      );
    }

    return (
      <>
        <AiRobotBackdrop />
        <UserVaultDashboard
          initialSection={dashTargetTab}
          onOpenMentorDashboard={userProfile?.isMentor ? openMentorDashboard : undefined}
          onOpenHomePage={(section = 'home') => {
            setActiveSection(section);
            setShowHomeView(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      </>
    );
  }

  const openDedicatedAuth = (mode: 'signin' | 'signup') => {
    setAuthGateNotice(null);
    setAuthMode(mode);
    setActiveSection('auth');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectSection = (section: NavSection) => {
    const modCtrl = platformConfig.moduleControls;
    if (section === 'ai-trading' && modCtrl?.aiTradingEnabled === false) {
      setAuthGateNotice('AI Trading Desk is temporarily disabled for maintenance by administration.');
      setActiveSection('home');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (section === 'forex' && modCtrl?.forexMarketEnabled === false) {
      setAuthGateNotice('Forex Market & Copy Trade is temporarily disabled for maintenance by administration.');
      setActiveSection('home');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (section === 'pump-fun' && modCtrl?.coinMiningEnabled === false) {
      setAuthGateNotice(`${platformConfig.pumpFunToken.name} Coin & Mining is temporarily disabled for maintenance by administration.`);
      setActiveSection('home');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const requireSignup = modCtrl?.requireSignupForTradingModules !== false;
    const gatedSections: NavSection[] = ['ai-trading', 'forex', 'pump-fun'];
    if (requireSignup && !authUser && gatedSections.includes(section)) {
      const moduleLabel =
        section === 'ai-trading'
          ? 'AI Trading Desk'
          : section === 'forex'
          ? 'Forex Market & Copy Trade'
          : `${platformConfig.pumpFunToken.name} Coin & Mining`;
      setAuthGateNotice(
        `Complete Sign Up (KYC) or Sign In to unlock ${moduleLabel} and live trading access.`
      );
      setAuthMode('signup');
      setActiveSection('auth');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setAuthGateNotice(null);
    setActiveSection(section);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openDashboardFromHome = (targetNav: 'dashboard' | 'forex-market' | 'pump-fun' = 'dashboard') => {
    setDashTargetTab(targetNav);
    setDashboardMode('client');
    clearMentorRouteFromUrl();
    setShowHomeView(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const supportLinks = platformConfig.supportLinks;
  const hasSupportLinks = Boolean(
    supportLinks && (supportLinks.telegramUrl || supportLinks.whatsappUrl || supportLinks.supportEmail)
  );

  return (
    <div className="relative min-h-screen flex flex-col text-slate-100">
      <AiRobotBackdrop />
      <Navbar
        companyName={platformConfig.companyName}
        coinName={platformConfig.pumpFunToken.name}
        activeSection={activeSection}
        authMode={authMode}
        onSelectSection={handleSelectSection}
        onOpenSignIn={() => openDedicatedAuth('signin')}
        onOpenRegister={() => openDedicatedAuth('signup')}
        globalPaused={platformConfig.globalPaused}
        isSignedIn={Boolean(authUser)}
        isMentor={Boolean(userProfile?.isMentor)}
        requireSignupForModules={platformConfig.moduleControls?.requireSignupForTradingModules !== false}
        moduleControls={platformConfig.moduleControls}
        onOpenDashboard={() => openDashboardFromHome('dashboard')}
        onOpenMentorDashboard={userProfile?.isMentor ? openMentorDashboard : undefined}
      />
      <div className="relative z-10 flex-1">
        <FrontPage
          activeSection={activeSection}
          onSelectSection={handleSelectSection}
          authMode={authMode}
          setAuthMode={setAuthMode}
          onOpenAuth={openDedicatedAuth}
          authGateNotice={authGateNotice}
          onClearAuthNotice={() => setAuthGateNotice(null)}
          onOpenDashboard={authUser ? openDashboardFromHome : undefined}
        />
      </div>
      <footer className="relative z-10 border-t border-slate-800/80 bg-[#0B111E]/85 backdrop-blur-md py-5 px-4 sm:px-6 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              © {new Date().getFullYear()} {platformConfig.companyName}. Institutional Multi-Asset Portal.
            </span>
            <button
              type="button"
              onClick={() => handleSelectSection('terms')}
              className={`font-semibold transition-colors underline underline-offset-4 ${
                activeSection === 'terms'
                  ? 'text-orange-400'
                  : 'text-slate-300 hover:text-orange-400'
              }`}
            >
              Terms &amp; Conditions
            </button>
            {hasSupportLinks && (
              <div className="flex flex-wrap items-center gap-3 pl-2 border-l border-slate-700/80">
                {supportLinks?.telegramUrl && (
                  <a
                    href={supportLinks.telegramUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-300 hover:text-sky-200 font-semibold transition-colors"
                  >
                    Telegram Support
                  </a>
                )}
                {supportLinks?.whatsappUrl && (
                  <a
                    href={supportLinks.whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-300 hover:text-emerald-200 font-semibold transition-colors"
                  >
                    WhatsApp Desk
                  </a>
                )}
                {supportLinks?.supportEmail && (
                  <a
                    href={`mailto:${supportLinks.supportEmail}`}
                    className="text-amber-300 hover:text-amber-200 font-semibold transition-colors"
                  >
                    {supportLinks.supportEmail}
                  </a>
                )}
              </div>
            )}
          </div>
          <span>Crypto Settlement Only: USDT (TRC20) · USDT (ERC20) · SOL</span>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <PlatformProvider>
          <AppRouter />
        </PlatformProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}
