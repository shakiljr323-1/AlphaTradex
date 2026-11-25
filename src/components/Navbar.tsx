import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Bot,
  ChevronRight,
  Coins,
  FileText,
  Globe,
  Home,
  Layers,
  Lock,
  Menu,
  PanelLeft,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { AdminModuleControls, NavSection } from '../types/platform';
import { AlphatradexLogo3D } from './AlphatradexLogo3D';

interface NavbarProps {
  companyName: string;
  coinName: string;
  activeSection: NavSection;
  authMode?: 'signin' | 'signup';
  onSelectSection: (section: NavSection) => void;
  onOpenSignIn: () => void;
  onOpenRegister: () => void;
  globalPaused: boolean;
  isSignedIn?: boolean;
  requireSignupForModules?: boolean;
  moduleControls?: AdminModuleControls;
  onOpenDashboard?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  companyName,
  coinName,
  activeSection,
  authMode = 'signin',
  onSelectSection,
  onOpenSignIn,
  onOpenRegister,
  globalPaused,
  isSignedIn = false,
  requireSignupForModules = true,
  moduleControls,
  onOpenDashboard,
}) => {
  const [slideBarOpen, setSlideBarOpen] = useState(false);

  const publicNavItems: { id: NavSection; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'home', label: 'Home Overview', Icon: Home },
    { id: 'plans', label: 'Investment Plans', Icon: Layers },
    { id: 'mentor-referral', label: 'Referrals & Mentor', Icon: Users },
  ];

  const allGatedModuleItems: {
    id: NavSection;
    label: string;
    subtitle: string;
    enabled: boolean;
    Icon: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      id: 'ai-trading',
      label: 'AI Trading Desk',
      subtitle: 'Mon–Fri Algorithmic Execution',
      enabled: moduleControls?.aiTradingEnabled !== false,
      Icon: Bot,
    },
    {
      id: 'forex',
      label: 'Forex Market',
      subtitle: 'Live WebTerminal & Copy Trade',
      enabled: moduleControls?.forexMarketEnabled !== false,
      Icon: Globe,
    },
    {
      id: 'pump-fun',
      label: `${coinName} Coin`,
      subtitle: 'Solana Liquidity & Mining Rig',
      enabled: moduleControls?.coinMiningEnabled !== false,
      Icon: Coins,
    },
  ];
  const gatedModuleItems = allGatedModuleItems.filter((item) => item.enabled);

  const isSignInActive = activeSection === 'auth' && authMode === 'signin';
  const isRegisterActive = activeSection === 'auth' && authMode === 'signup';
  const isGatedModuleActive =
    activeSection === 'ai-trading' || activeSection === 'forex' || activeSection === 'pump-fun';

  useEffect(() => {
    if (!slideBarOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSlideBarOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [slideBarOpen]);

  const handleNavigateFromDrawer = (section: NavSection) => {
    setSlideBarOpen(false);
    onSelectSection(section);
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#080D19]/90 backdrop-blur-xl border-b border-slate-800/80 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Left: Slide Bar Trigger + Brand */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <button
              type="button"
              onClick={() => setSlideBarOpen(true)}
              aria-label="Open Vault Navigation Slide Bar"
              aria-expanded={slideBarOpen}
              className="inline-flex items-center gap-2 px-2.5 sm:px-3 py-2 rounded-lg border border-amber-500/35 bg-[#12192B] hover:bg-[#19233D] hover:border-amber-400/65 text-amber-200 hover:text-white text-xs font-semibold transition-colors shrink-0"
            >
              <Menu className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Menu</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectSection('home')}
              className="flex items-center gap-2.5 whitespace-nowrap shrink-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-lg"
            >
              <AlphatradexLogo3D variant="mark" size="md" companyName={companyName} />
              <span className="font-display font-bold text-base sm:text-lg tracking-tight text-white">
                {companyName}
              </span>
            </button>
          </div>

          {/* Center: Clean Core Links + Slide-Bar Modules Button */}
          <nav className="hidden lg:flex items-center gap-5">
            {publicNavItems.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectSection(item.id)}
                  className={`text-sm font-medium whitespace-nowrap shrink-0 transition-colors py-1 border-b-2 ${
                    isActive
                      ? 'text-amber-400 border-amber-400'
                      : 'text-slate-300 border-transparent hover:text-white hover:border-slate-600'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setSlideBarOpen(true)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                isGatedModuleActive
                  ? 'border-amber-400/70 bg-amber-500/15 text-amber-300'
                  : 'border-slate-700/90 bg-slate-900/75 hover:border-amber-500/50 text-slate-200 hover:text-white'
              }`}
            >
              <PanelLeft className="w-3.5 h-3.5 text-amber-400" />
              <span>AI · Forex · Coin</span>
              {requireSignupForModules && !isSignedIn && <Lock className="w-3 h-3 text-amber-400/80" />}
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </nav>

          {/* Right: Desk Status & Auth Actions */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <span
              className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-semibold whitespace-nowrap shrink-0 border ${
                globalPaused
                  ? 'bg-amber-950/60 text-amber-300 border-amber-700/60'
                  : 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {globalPaused ? 'DESK PAUSED' : 'LIVE DESK'}
            </span>

            {isSignedIn && onOpenDashboard ? (
              <button
                type="button"
                onClick={onOpenDashboard}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 transition-colors shadow-sm whitespace-nowrap shrink-0"
              >
                Vault Dashboard
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onOpenSignIn}
                  className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 border ${
                    isSignInActive
                      ? 'bg-slate-800 text-amber-300 border-amber-400'
                      : 'text-slate-200 border-slate-700 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  Sign In
                </button>

                <button
                  type="button"
                  onClick={onOpenRegister}
                  className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold text-white transition-colors shadow-sm whitespace-nowrap shrink-0 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 ${
                    isRegisterActive ? 'ring-2 ring-amber-400/60' : ''
                  }`}
                >
                  Register (KYC)
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Slide Bar Backdrop */}
      {slideBarOpen && (
        <div
          onClick={() => setSlideBarOpen(false)}
          aria-hidden="true"
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm transition-opacity"
        />
      )}

      {/* Executive Left Slide Bar Drawer */}
      <aside
        aria-label="Portal Navigation Slide Bar"
        className={`fixed inset-y-0 left-0 z-50 w-80 max-w-[86vw] bg-[#080D1A]/98 backdrop-blur-2xl border-r border-amber-500/25 shadow-[20px_0_60px_rgba(0,0,0,0.75)] flex flex-col justify-between transition-transform duration-300 ease-out ${
          slideBarOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
        }`}
      >
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Slide Bar Header */}
          <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-800/90">
            <div className="flex items-center gap-2.5 min-w-0">
              <AlphatradexLogo3D variant="mark" size="md" companyName={companyName} />
              <div className="min-w-0">
                <div className="font-display font-bold text-white text-base truncate">
                  {companyName}
                </div>
                <div className="text-[11px] font-mono text-amber-400/90 truncate">
                  Vault Navigation Desk
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSlideBarOpen(false)}
              aria-label="Close slide bar"
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900/90 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Public Overview Section */}
          <div className="space-y-1.5">
            <div className="px-2 text-[11px] font-mono uppercase tracking-wider text-slate-400">
              Overview &amp; Packages
            </div>
            {publicNavItems.map(({ id, label, Icon }) => {
              const isActive = activeSection === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleNavigateFromDrawer(id)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border text-left text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                      : 'bg-transparent border-transparent text-slate-300 hover:bg-slate-900/80 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                    <span>{label}</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>
              );
            })}
          </div>

          {/* Exclusive Trading & Coin Section (Sign Up Required) */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <div className="px-2 flex items-center justify-between text-[11px] font-mono uppercase tracking-wider">
              <span className="text-amber-400 font-semibold">Trading &amp; Coin Desk</span>
              <span className="text-slate-400">
                {isSignedIn || !requireSignupForModules ? 'Unlocked' : 'Sign Up Required'}
              </span>
            </div>

            <div className="space-y-2">
              {gatedModuleItems.length === 0 ? (
                <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/70 text-xs text-slate-400">
                  Trading modules are currently under scheduled maintenance.
                </div>
              ) : (
                gatedModuleItems.map(({ id, label, subtitle, Icon }) => {
                  const isActive = activeSection === id;
                  const locked = requireSignupForModules && !isSignedIn;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleNavigateFromDrawer(id)}
                      className={`w-full p-3 rounded-xl border text-left transition-colors flex items-center justify-between gap-3 ${
                        isActive
                          ? 'bg-amber-500/15 border-amber-400/70 text-white'
                          : 'bg-[#0F172A]/85 border-slate-800 hover:border-amber-500/55 text-slate-200 hover:bg-[#141F38]'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0 mt-0.5">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-display font-semibold text-sm text-white truncate">
                            {label}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">{subtitle}</div>
                          {locked && (
                            <div className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-300 mt-1">
                              <Lock className="w-3 h-3" />
                              <span>Sign Up to View</span>
                            </div>
                          )}
                        </div>
                      </div>
                      {!locked ? (
                        <ArrowRight className="w-4 h-4 text-amber-400 shrink-0" />
                      ) : (
                        <Lock className="w-4 h-4 text-amber-400/80 shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Compliance Link */}
          <div className="pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => handleNavigateFromDrawer('terms')}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border text-left text-xs font-medium transition-colors ${
                activeSection === 'terms'
                  ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                  : 'border-transparent text-slate-400 hover:bg-slate-900/80 hover:text-slate-200'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <FileText className="w-4 h-4" />
                <span>Terms &amp; Compliance Policy</span>
              </span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Slide Bar Bottom Auth / Vault Actions */}
        <div className="p-5 border-t border-slate-800/90 bg-[#060A14] space-y-2.5">
          {isSignedIn && onOpenDashboard ? (
            <button
              type="button"
              onClick={() => {
                setSlideBarOpen(false);
                onOpenDashboard();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors"
            >
              <span>Open Vault Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setSlideBarOpen(false);
                  onOpenSignIn();
                }}
                className="py-2.5 px-3 rounded-xl border border-amber-500/40 bg-slate-900 hover:bg-slate-800 text-amber-200 text-xs font-semibold transition-colors"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setSlideBarOpen(false);
                  onOpenRegister();
                }}
                className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold transition-colors"
              >
                Sign Up (KYC)
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
