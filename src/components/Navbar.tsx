import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { NavSection } from '../types/platform';
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
  onOpenDashboard,
}) => {
  const navItems: { id: NavSection; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'plans', label: 'Plans' },
    { id: 'ai-trading', label: 'AI Trading' },
    { id: 'forex', label: 'Forex Market' },
    { id: 'pump-fun', label: `${coinName} Coin` },
    { id: 'mentor-referral', label: 'Referrals' },
  ];
  const isSignInActive = activeSection === 'auth' && authMode === 'signin';
  const isRegisterActive = activeSection === 'auth' && authMode === 'signup';

  return (
    <header className="sticky top-0 z-40 bg-[#0B111E]/85 backdrop-blur-xl border-b border-slate-800/80 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand Zone */}
        <button
          type="button"
          onClick={() => onSelectSection('home')}
          className="flex items-center gap-3 whitespace-nowrap shrink-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-lg"
        >
          <AlphatradexLogo3D variant="mark" size="md" companyName={companyName} />
          <span className="font-display font-bold text-base sm:text-lg tracking-tight text-white">
            {companyName}
          </span>
        </button>

        {/* Nav Links */}
        <nav className="hidden lg:flex items-center gap-5">
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectSection(item.id)}
                className={`text-sm font-medium whitespace-nowrap shrink-0 transition-colors py-1 border-b-2 ${
                  isActive
                    ? 'text-orange-400 border-orange-500'
                    : 'text-slate-300 border-transparent hover:text-white hover:border-slate-600'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Actions & LIVE DESK badge (NO admin link anywhere) */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <span
            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-semibold whitespace-nowrap shrink-0 border ${
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
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-orange-600 hover:bg-orange-500 transition-colors shadow-sm whitespace-nowrap shrink-0"
            >
              Vault Dashboard
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onOpenSignIn}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 border ${
                  isSignInActive
                    ? 'bg-slate-800 text-white border-orange-500'
                    : 'text-slate-200 border-slate-700 hover:bg-slate-800 hover:text-white'
                }`}
              >
                Sign In
              </button>

              <button
                type="button"
                onClick={onOpenRegister}
                className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors shadow-sm whitespace-nowrap shrink-0 ${
                  isRegisterActive
                    ? 'bg-orange-500 ring-2 ring-orange-400/50'
                    : 'bg-orange-600 hover:bg-orange-500'
                }`}
              >
                Register (KYC)
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mobile Nav Strip */}
      <div className="lg:hidden border-t border-slate-800/80 px-4 py-2 flex items-center gap-4 overflow-x-auto">
        {navItems.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSection(item.id)}
              className={`text-xs font-medium whitespace-nowrap shrink-0 py-1 ${
                isActive ? 'text-orange-400 underline underline-offset-4' : 'text-slate-300'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </header>
  );
};
