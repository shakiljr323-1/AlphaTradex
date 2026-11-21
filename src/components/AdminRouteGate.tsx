import React, { useState } from 'react';
import { ArrowLeft, Lock, ShieldAlert } from 'lucide-react';
import { SUPER_ADMIN_EMAIL } from '../constants/defaults';
import { usePlatform } from '../context/PlatformContext';
import { SuperAdminPanel } from './SuperAdminPanel';

export const AdminRouteGate: React.FC<{ onExitAdmin: () => void }> = ({ onExitAdmin }) => {
  const { authUser, authReady, isAdminUser, signInWithGoogle, signInWithEmail, signOutUser } =
    usePlatform();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);

  if (!authReady) {
    return (
      <div className="relative z-10 min-h-screen flex items-center justify-center text-slate-300 font-mono text-sm">
        Initializing Admin Security Gate...
      </div>
    );
  }

  if (authUser && isAdminUser) {
    return (
      <div className="relative z-10">
        <SuperAdminPanel onExitAdmin={onExitAdmin} />
      </div>
    );
  }

  return (
    <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 px-6 py-5 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center font-display font-extrabold text-white text-lg">
              A
            </span>
            <div>
              <h1 className="font-display font-bold text-base">Super Admin Sign-In Gate</h1>
              <p className="text-[11px] font-mono text-slate-400">Restricted Route · /admin</p>
            </div>
          </div>
          <Lock className="w-5 h-5 text-orange-500" />
        </div>

        <div className="p-6 space-y-4">
          {authUser && !isAdminUser && (
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-900 space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Unauthorized Account ({authUser.email})</span>
              </div>
              <p>
                This account does not hold Super Admin privileges. Sign in with the authorized
                Super Admin identity ({SUPER_ADMIN_EMAIL}).
              </p>
              <button
                type="button"
                onClick={signOutUser}
                className="px-3 py-1.5 rounded bg-red-700 text-white font-semibold"
              >
                Switch Account
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              {errorMsg}
            </div>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setErrorMsg('');
              setBusy(true);
              try {
                await signInWithGoogle();
              } catch (err) {
                setErrorMsg((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
            className="w-full py-2.5 px-4 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold transition-colors"
          >
            Sign In with Authorized Google Admin
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[11px] text-slate-400 uppercase">or credentials</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setErrorMsg('');
              setBusy(true);
              try {
                await signInWithEmail(email, password);
              } catch (err) {
                setErrorMsg((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
            className="space-y-3"
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Admin email"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm"
            />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Admin password"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 px-4 rounded-lg bg-[#0B111E] hover:bg-slate-800 text-white text-sm font-semibold"
            >
              Authenticate Admin
            </button>
          </form>

          <div className="pt-2 border-t border-slate-100 flex justify-center">
            <button
              type="button"
              onClick={onExitAdmin}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Return to Alphatradex
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
