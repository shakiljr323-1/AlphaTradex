import React from 'react';
import { Clock, ShieldAlert, X } from 'lucide-react';
import { Withdrawal } from '../types/platform';

interface CapitalRequestModalProps {
  withdrawal: Withdrawal | null;
  onClose: () => void;
}

export const CapitalRequestModal: React.FC<CapitalRequestModalProps> = ({ withdrawal, onClose }) => {
  if (!withdrawal) return null;

  const statusMeta =
    withdrawal.status === 'pending'
      ? {
          label: 'Pending Admin Review',
          badgeClass: 'bg-amber-400 text-slate-900',
          boxClass: 'bg-amber-50 border-amber-200 text-amber-900',
          message: 'Your request is currently under review by administration.',
        }
      : withdrawal.status === 'approved'
      ? {
          label: 'Approved & Settled',
          badgeClass: 'bg-emerald-600 text-white',
          boxClass: 'bg-emerald-50 border-emerald-200 text-emerald-900',
          message: withdrawal.adminNote || 'Principal capital withdrawal has been approved and settled.',
        }
      : {
          label: 'Rejected',
          badgeClass: 'bg-red-600 text-white',
          boxClass: 'bg-red-50 border-red-200 text-red-900',
          message: withdrawal.adminNote || 'This capital withdrawal request was declined by administration.',
        };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="capital-breakdown-title"
    >
      <div className="w-full max-w-md bg-white rounded-xl overflow-hidden shadow-2xl border border-slate-200">
        {/* Dark Navy Header matching reference screenshot */}
        <div className="bg-[#0B111E] px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <ShieldAlert className="w-5 h-5 text-orange-500 shrink-0" />
            <h3
              id="capital-breakdown-title"
              className="font-display font-bold text-white text-base truncate"
            >
              Capital Request Breakdown (Package #{withdrawal.packageNumber || 413})
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close breakdown modal"
            className="text-slate-400 hover:text-white transition-colors p-1 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3.5 text-sm">
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-slate-500">Request Status:</span>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusMeta.badgeClass}`}>
              {statusMeta.label}
            </span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-slate-500">Investment Date:</span>
            <span className="font-mono font-semibold text-slate-900 tabular-nums">
              {withdrawal.investmentDate || '—'}
            </span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-slate-500">Requested Principal Capital:</span>
            <span className="font-mono font-bold text-slate-900 tabular-nums">
              {withdrawal.principalCapital.toFixed(2)} ₮
            </span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-slate-500">Total Profit Generated:</span>
            <span className="font-mono font-bold text-emerald-700 tabular-nums">
              {withdrawal.totalProfitGenerated.toFixed(2)} ₮
            </span>
          </div>

          <div className="flex items-center justify-between py-1 text-xs text-slate-500">
            <span>Payout Network / Wallet:</span>
            <span className="font-mono text-slate-700 truncate max-w-[210px]">
              {withdrawal.network.replace('_', ' ')} · {withdrawal.destinationAddress}
            </span>
          </div>

          <div className={`mt-2 flex items-center gap-2.5 px-3.5 py-3 rounded-lg border text-xs font-medium ${statusMeta.boxClass}`}>
            <Clock className="w-4 h-4 shrink-0" />
            <span>{statusMeta.message}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-700 text-white text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
