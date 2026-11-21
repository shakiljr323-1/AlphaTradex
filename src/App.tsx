/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { AdminRouteGate } from './components/AdminRouteGate';
import { AiRobotBackdrop } from './components/AiRobotBackdrop';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FrontPage } from './components/FrontPage';
import { Navbar } from './components/Navbar';
import { UserVaultDashboard } from './components/UserVaultDashboard';
import { PlatformProvider, usePlatform } from './context/PlatformContext';
import { NavSection } from './types/platform';

function checkIsAdminRoute(): boolean {
  const path = window.location.pathname.replace(/\/+$/, '');
  const hash = window.location.hash.replace(/\/+$/, '');
  return path === '/admin' || hash === '#/admin';
}

const AppRouter: React.FC = () => {
  const { authUser, authReady, platformConfig } = usePlatform();
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(checkIsAdminRoute);
  const [activeSection, setActiveSection] = useState<NavSection>('home');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');
  const [showHomeView, setShowHomeView] = useState(false);
  const [dashTargetTab, setDashTargetTab] = useState<'dashboard' | 'forex-market'>('dashboard');
  const authCardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const syncRoute = () => setIsAdminRoute(checkIsAdminRoute());
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
    }
  }, [authUser]);

  const exitAdminRoute = () => {
    if (window.location.hash === '#/admin') {
      window.location.hash = '';
    }
    if (window.location.pathname === '/admin') {
      window.history.pushState({}, '', '/');
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
    return (
      <>
        <AiRobotBackdrop />
        <UserVaultDashboard
          initialSection={dashTargetTab}
          onOpenHomePage={(section = 'home') => {
            setActiveSection(section);
            setShowHomeView(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      </>
    );
  }

  const scrollToAuth = (mode: 'signin' | 'signup') => {
    setAuthMode(mode);
    authCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openDashboardFromHome = (targetNav: 'dashboard' | 'forex-market' = 'dashboard') => {
    setDashTargetTab(targetNav);
    setShowHomeView(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="relative min-h-screen flex flex-col text-slate-100">
      <AiRobotBackdrop />
      <Navbar
        companyName={platformConfig.companyName}
        coinName={platformConfig.pumpFunToken.name}
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        onOpenSignIn={() => scrollToAuth('signin')}
        onOpenRegister={() => scrollToAuth('signup')}
        globalPaused={platformConfig.globalPaused}
        isSignedIn={Boolean(authUser)}
        onOpenDashboard={() => openDashboardFromHome('dashboard')}
      />
      <div className="relative z-10 flex-1">
        <FrontPage
          activeSection={activeSection}
          onSelectSection={setActiveSection}
          authMode={authMode}
          setAuthMode={setAuthMode}
          authCardRef={authCardRef}
          onOpenDashboard={authUser ? openDashboardFromHome : undefined}
        />
      </div>
      <footer className="relative z-10 border-t border-slate-800/80 bg-[#0B111E]/85 backdrop-blur-md py-5 px-4 sm:px-6 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <span>
            © {new Date().getFullYear()} {platformConfig.companyName}. Institutional Multi-Asset Portal.
          </span>
          <span>Crypto Settlement Only: USDT (TRC20) · USDT (ERC20) · SOL</span>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <PlatformProvider>
        <AppRouter />
      </PlatformProvider>
    </ErrorBoundary>
  );
}
