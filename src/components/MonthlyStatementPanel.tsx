import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Award,
  Calendar,
  CheckCircle2,
  Eye,
  EyeOff,
  FileDown,
  FileText,
  Lock,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import {
  CryptoDeposit,
  ForexTrade,
  Investment,
  MlmCommission,
  UserProfile,
  Withdrawal,
} from '../types/platform';
import { formatTimestamp } from '../utils/investmentMath';
import {
  buildMonthlyStatementSummary,
  computeStatementIntegritySeal,
  downloadAccountStatementPdf,
  downloadProfitCertificatePdf,
  getCurrentMonthKey,
  getRecentMonthOptions,
  maskEmailAddress,
  maskWalletOrTx,
  StatementIntegritySeal,
} from '../utils/pdfStatementGenerator';

interface MonthlyStatementPanelProps {
  companyName: string;
  userProfile: UserProfile;
  deposits: CryptoDeposit[];
  withdrawals: Withdrawal[];
  investments: Investment[];
  commissions: MlmCommission[];
  forexTrades: ForexTrade[];
  globalPaused: boolean;
  onNotify: (type: 'ok' | 'err', text: string) => void;
}

function fmtUsd(val: number): string {
  const num = Number(val || 0);
  const abs = Math.abs(num).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return num < 0 ? `-$${abs}` : `$${abs}`;
}

export const MonthlyStatementPanel: React.FC<MonthlyStatementPanelProps> = ({
  companyName,
  userProfile,
  deposits,
  withdrawals,
  investments,
  commissions,
  forexTrades,
  globalPaused,
  onNotify,
}) => {
  const monthOptions = useMemo(() => getRecentMonthOptions(12), []);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getCurrentMonthKey());
  const [maskSensitive, setMaskSensitive] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [activePreviewTab, setActivePreviewTab] = useState<'deposits' | 'profits' | 'withdrawals'>(
    'deposits'
  );
  const [seal, setSeal] = useState<StatementIntegritySeal | null>(null);

  const summary = useMemo(
    () =>
      buildMonthlyStatementSummary({
        deposits,
        withdrawals,
        investments,
        commissions,
        forexTrades,
        globalPaused,
        monthFilter: selectedMonth,
      }),
    [deposits, withdrawals, investments, commissions, forexTrades, globalPaused, selectedMonth]
  );

  useEffect(() => {
    let active = true;
    void computeStatementIntegritySeal(summary, userProfile).then((computed) => {
      if (active) setSeal(computed);
    });
    return () => {
      active = false;
    };
  }, [summary, userProfile]);

  const handleDownloadMonthlyPdf = async () => {
    setDownloading(true);
    try {
      const result = await downloadAccountStatementPdf({
        companyName,
        user: userProfile,
        deposits,
        withdrawals,
        investments,
        commissions,
        forexTrades,
        globalPaused,
        monthFilter: selectedMonth,
        maskSensitive,
      });
      onNotify(
        'ok',
        `Downloaded ${result.periodLabel} PDF report (${result.verificationCode}).`
      );
    } catch (err) {
      onNotify(
        'err',
        err instanceof Error ? err.message : 'Unable to generate PDF report right now.'
      );
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadCertificate = () => {
    try {
      downloadProfitCertificatePdf({
        companyName,
        user: userProfile,
        investments,
        withdrawals,
        commissions,
      });
      onNotify('ok', 'Verified Portfolio Certificate PDF downloaded.');
    } catch (err) {
      onNotify(
        'err',
        err instanceof Error ? err.message : 'Unable to generate portfolio certificate.'
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Institutional Header Card */}
      <div className="rounded-2xl border border-slate-700/80 bg-[#0B111E]/95 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-mono font-semibold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>Cryptographically Sealed Investor Statement</span>
            </div>
            <h2 className="font-display font-bold text-xl sm:text-2xl text-white">
              Monthly PDF Statement &amp; Ledger Report
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
              Generate a stylized A4 PDF report summarizing your verified deposits, accrued package
              &amp; referral profits, and withdrawal transactions for{' '}
              <span className="text-slate-200 font-semibold">{summary.periodLabel}</span> (
              {summary.dateRangeLabel}).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={downloading}
              onClick={() => void handleDownloadMonthlyPdf()}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-bold text-xs sm:text-sm inline-flex items-center gap-2 transition shadow-lg shadow-emerald-950/40"
            >
              <FileDown className="w-4 h-4" />
              <span>
                {downloading
                  ? 'Generating Secure PDF...'
                  : selectedMonth === getCurrentMonthKey()
                  ? 'Download Current Month PDF'
                  : 'Download Selected PDF'}
              </span>
            </button>
            <button
              type="button"
              onClick={handleDownloadCertificate}
              className="px-3.5 py-2.5 rounded-xl border border-amber-500/45 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 font-semibold text-xs inline-flex items-center gap-1.5 transition"
            >
              <Award className="w-4 h-4 text-amber-400" />
              <span>Profit Certificate</span>
            </button>
          </div>
        </div>

        {/* Report Controls: Month Picker + Privacy Redaction + Live SHA-256 Seal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 items-stretch">
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between gap-2">
            <label className="text-[11px] font-semibold text-slate-400 inline-flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-sky-400" />
              Statement Period
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-semibold text-white focus:outline-none focus:border-emerald-400"
            >
              {monthOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between gap-2">
            <div className="text-[11px] font-semibold text-slate-400 inline-flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              Privacy &amp; Redaction Controls
            </div>
            <button
              type="button"
              onClick={() => setMaskSensitive((v) => !v)}
              className={`w-full px-3 py-2 rounded-lg border text-xs font-semibold inline-flex items-center justify-between transition ${
                maskSensitive
                  ? 'border-amber-500/60 bg-amber-500/15 text-amber-200'
                  : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-600'
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                {maskSensitive ? (
                  <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                )}
                Mask Email &amp; Wallet Addresses
              </span>
              <span className="font-mono text-[11px]">{maskSensitive ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between gap-1.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                SHA-256 Tamper-Evident Seal
              </span>
              <span className="font-mono text-emerald-400 font-bold">
                {seal?.verificationCode || 'COMPUTING...'}
              </span>
            </div>
            <div className="font-mono text-[10px] text-slate-400 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 truncate">
              {seal?.sha256Full || 'Computing cryptographic digest...'}
            </div>
          </div>
        </div>

        {/* 4 Summary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
          <div className="rounded-xl border border-sky-500/30 bg-sky-500/8 p-4 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-sky-300">
              <span>DEPOSITS ({summary.deposits.length})</span>
              <ArrowDownLeft className="w-4 h-4 text-sky-400" />
            </div>
            <div className="font-mono font-extrabold text-2xl text-white tabular-nums">
              {fmtUsd(summary.approvedDepositsUsd)}
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Pending: {fmtUsd(summary.pendingDepositsUsd)}
            </div>
          </div>

          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/8 p-4 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-300">
              <span>ACCRUED PROFITS</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="font-mono font-extrabold text-2xl text-white tabular-nums">
              {fmtUsd(summary.totalPeriodAccruedProfitsUsd)}
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Live Unclaimed: {fmtUsd(summary.liveUnclaimedProfitUsd)}
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 p-4 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-amber-300">
              <span>WITHDRAWALS ({summary.withdrawals.length})</span>
              <ArrowUpRight className="w-4 h-4 text-amber-400" />
            </div>
            <div className="font-mono font-extrabold text-2xl text-white tabular-nums">
              {fmtUsd(summary.completedWithdrawalsUsd)}
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Pending: {fmtUsd(summary.pendingWithdrawalsUsd)} · Fees:{' '}
              {fmtUsd(summary.totalWithdrawalFeesUsd)}
            </div>
          </div>

          <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/8 p-4 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-300">
              <span>NET PERIOD CASHFLOW</span>
              <FileText className="w-4 h-4 text-indigo-400" />
            </div>
            <div
              className={`font-mono font-extrabold text-2xl tabular-nums ${
                summary.netPeriodCashflowUsd >= 0 ? 'text-emerald-300' : 'text-rose-300'
              }`}
            >
              {summary.netPeriodCashflowUsd >= 0 ? '+' : ''}
              {fmtUsd(summary.netPeriodCashflowUsd)}
            </div>
            <div className="text-[11px] text-slate-400 font-mono truncate">
              {maskSensitive ? maskEmailAddress(userProfile.email) : userProfile.email}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Statement Ledger Preview */}
      <div className="rounded-2xl border border-slate-800 bg-[#0B111E]/90 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="font-display font-bold text-base text-white">
              Statement Preview — {summary.periodLabel}
            </h3>
            <p className="text-xs text-slate-400">
              Review the exact figures included inside your downloadable PDF report.
            </p>
          </div>

          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800">
            {(
              [
                { id: 'deposits', label: `Deposits (${summary.deposits.length})` },
                { id: 'profits', label: `Accrued Profits (${summary.packageAccruals.length})` },
                { id: 'withdrawals', label: `Withdrawals (${summary.withdrawals.length})` },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActivePreviewTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                  activePreviewTab === t.id
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Preview Tab 1: Deposits */}
        {activePreviewTab === 'deposits' && (
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900/80 border-b border-slate-800 text-[11px] font-mono text-slate-400">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Network &amp; Channel</th>
                  <th className="py-2.5 px-3">Tx Reference</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {summary.deposits.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No deposit transactions recorded for {summary.periodLabel}.
                    </td>
                  </tr>
                ) : (
                  summary.deposits.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-mono text-slate-300 whitespace-nowrap">
                        {formatTimestamp(d.createdAt).slice(0, 16)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-200 font-semibold">
                        {d.network}{' '}
                        <span className="text-[11px] font-normal text-slate-400">
                          ({d.verificationSource === 'web3_auto' ? 'Web3 Auto' : 'Manual'})
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                        {maskSensitive ? maskWalletOrTx(d.txId) : d.txId.slice(0, 28)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`font-mono text-[11px] font-bold uppercase ${
                            d.status === 'approved'
                              ? 'text-emerald-400'
                              : d.status === 'pending'
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {d.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-white tabular-nums">
                        {fmtUsd(d.amountUsd)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Preview Tab 2: Accrued Profits */}
        {activePreviewTab === 'profits' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
                <div className="text-slate-400">Package Yield Accrued (Period)</div>
                <div className="font-mono font-bold text-lg text-emerald-400 mt-0.5 tabular-nums">
                  +{fmtUsd(summary.periodPackageAccruedUsd)}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
                <div className="text-slate-400">
                  Referral Commissions ({summary.commissions.length})
                </div>
                <div className="font-mono font-bold text-lg text-sky-400 mt-0.5 tabular-nums">
                  +{fmtUsd(summary.periodCommissionsUsd)}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
                <div className="text-slate-400">
                  Closed Forex PnL ({summary.closedTrades.length})
                </div>
                <div
                  className={`font-mono font-bold text-lg mt-0.5 tabular-nums ${
                    summary.periodForexPnlUsd >= 0 ? 'text-amber-300' : 'text-rose-400'
                  }`}
                >
                  {summary.periodForexPnlUsd >= 0 ? '+' : ''}
                  {fmtUsd(summary.periodForexPnlUsd)}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900/80 border-b border-slate-800 text-[11px] font-mono text-slate-400">
                    <th className="py-2.5 px-3">Package</th>
                    <th className="py-2.5 px-3 text-right">Capital</th>
                    <th className="py-2.5 px-3 text-right">Daily Target</th>
                    <th className="py-2.5 px-3 text-right">Period Days</th>
                    <th className="py-2.5 px-3 text-right">Period Accrued</th>
                    <th className="py-2.5 px-3 text-right">Claimed</th>
                    <th className="py-2.5 px-3 text-right">Live Unclaimed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {summary.packageAccruals.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No active packages accrued profit during {summary.periodLabel}.
                      </td>
                    </tr>
                  ) : (
                    summary.packageAccruals.map((p) => (
                      <tr key={p.investmentId} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 font-semibold text-white">
                          #{p.packageNumber} {p.packageName}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-300 tabular-nums">
                          {fmtUsd(p.capitalUsd)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-300 tabular-nums">
                          {p.dailyPercent.toFixed(2)}% ({fmtUsd(p.dailyDollarTarget)})
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-300 tabular-nums">
                          {p.periodProfitDays}d
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400 tabular-nums">
                          +{fmtUsd(p.periodAccruedUsd)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-300 tabular-nums">
                          {fmtUsd(p.claimedProfitUsd)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-300 tabular-nums">
                          {fmtUsd(p.unclaimedProfitUsd)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Preview Tab 3: Withdrawals */}
        {activePreviewTab === 'withdrawals' && (
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900/80 border-b border-slate-800 text-[11px] font-mono text-slate-400">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Network</th>
                  <th className="py-2.5 px-3">Destination / Payout Tx</th>
                  <th className="py-2.5 px-3 text-right">Fee</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {summary.withdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No withdrawal transactions recorded for {summary.periodLabel}.
                    </td>
                  </tr>
                ) : (
                  summary.withdrawals.map((w) => {
                    const refStr = w.payoutTxHash
                      ? `TX: ${maskSensitive ? maskWalletOrTx(w.payoutTxHash) : w.payoutTxHash.slice(0, 22)}`
                      : maskSensitive
                      ? maskWalletOrTx(w.destinationAddress)
                      : w.destinationAddress.slice(0, 26);
                    return (
                      <tr key={w.id} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 font-mono text-slate-300 whitespace-nowrap">
                          {formatTimestamp(w.createdAt).slice(0, 16)}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-200">{w.network}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                          {refStr}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-400 tabular-nums">
                          {fmtUsd(w.feeUsd || 0)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`font-mono text-[11px] font-bold uppercase ${
                              w.status === 'approved' || w.status === 'completed'
                                ? 'text-emerald-400'
                                : w.status === 'pending'
                                ? 'text-amber-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {w.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-white tabular-nums">
                          {fmtUsd(w.amountUsd)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Security Assurance Note */}
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Every PDF report is compiled directly from your authenticated Firestore vault ledger and
            sealed with a unique <strong className="text-slate-200">SHA-256 integrity hash</strong>{' '}
            and scannable <strong className="text-slate-200">QR verification badge</strong>. Enable{' '}
            <em>Mask Email &amp; Wallet Addresses</em> before downloading if you plan to share the
            statement externally.
          </p>
        </div>
      </div>
    </div>
  );
};
