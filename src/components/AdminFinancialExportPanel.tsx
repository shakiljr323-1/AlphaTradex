import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Users,
  Wallet,
} from 'lucide-react';
import { CryptoDeposit, MlmCommission, UserProfile, Withdrawal } from '../types/platform';
import {
  buildCommissionsSheet,
  buildDepositsSheet,
  buildUserBalancesSheet,
  buildWithdrawalsSheet,
  downloadCsvFile,
  downloadExcelWorkbook,
  ExcelWorksheetSpec,
} from '../utils/financialCsvExport';

interface AdminFinancialExportPanelProps {
  allUsers: UserProfile[];
  allDeposits: CryptoDeposit[];
  allWithdrawals: Withdrawal[];
  allMlmCommissions: MlmCommission[];
  onNotify: (type: 'ok' | 'err', text: string) => void;
}

type DatePreset = 'all' | 'this_month' | 'last_30' | 'last_90' | 'custom';
type StatusFilter = 'all' | 'approved_only' | 'pending_only' | 'rejected_only';

function extractRecordMs(val: unknown): number {
  if (val && typeof val === 'object') {
    if ('toMillis' in val && typeof (val as { toMillis: () => number }).toMillis === 'function') {
      return (val as { toMillis: () => number }).toMillis();
    }
    if ('seconds' in val && typeof (val as { seconds: number }).seconds === 'number') {
      return (val as { seconds: number }).seconds * 1000;
    }
  }
  return 0;
}

export const AdminFinancialExportPanel: React.FC<AdminFinancialExportPanelProps> = ({
  allUsers,
  allDeposits,
  allWithdrawals,
  allMlmCommissions,
  onNotify,
}) => {
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [customEnd, setCustomEnd] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [networkFilter, setNetworkFilter] = useState<string>('all');

  const userLookup = useMemo(() => {
    const m = new Map<string, UserProfile>();
    for (const u of allUsers) m.set(u.uid, u);
    return m;
  }, [allUsers]);

  const availableNetworks = useMemo(() => {
    const s = new Set<string>();
    for (const d of allDeposits) if (d.network) s.add(d.network);
    for (const w of allWithdrawals) if (w.network) s.add(w.network);
    return Array.from(s).sort();
  }, [allDeposits, allWithdrawals]);

  const dateBounds = useMemo(() => {
    const now = new Date();
    if (datePreset === 'all') return { startMs: 0, endMs: Number.MAX_SAFE_INTEGER, label: 'All-Time' };
    if (datePreset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
      return { startMs: start, endMs: Date.now() + 86_400_000, label: 'Current Month' };
    }
    if (datePreset === 'last_30') {
      return { startMs: Date.now() - 30 * 86_400_000, endMs: Date.now() + 86_400_000, label: 'Last 30 Days' };
    }
    if (datePreset === 'last_90') {
      return { startMs: Date.now() - 90 * 86_400_000, endMs: Date.now() + 86_400_000, label: 'Last 90 Days' };
    }
    const s = customStart ? new Date(`${customStart}T00:00:00`).getTime() : 0;
    const e = customEnd ? new Date(`${customEnd}T23:59:59`).getTime() : Number.MAX_SAFE_INTEGER;
    return {
      startMs: Number.isFinite(s) ? s : 0,
      endMs: Number.isFinite(e) ? e : Number.MAX_SAFE_INTEGER,
      label: `${customStart || 'Start'} to ${customEnd || 'Today'}`,
    };
  }, [datePreset, customStart, customEnd]);

  const inRange = (createdAt: unknown): boolean => {
    if (datePreset === 'all') return true;
    const ms = extractRecordMs(createdAt);
    if (!ms) return true;
    return ms >= dateBounds.startMs && ms <= dateBounds.endMs;
  };

  const filteredDeposits = useMemo(() => {
    return allDeposits.filter((d) => {
      if (!inRange(d.createdAt)) return false;
      if (networkFilter !== 'all' && d.network !== networkFilter) return false;
      if (statusFilter === 'approved_only' && d.status !== 'approved') return false;
      if (statusFilter === 'pending_only' && d.status !== 'pending') return false;
      if (statusFilter === 'rejected_only' && d.status !== 'rejected') return false;
      return true;
    });
  }, [allDeposits, dateBounds, datePreset, networkFilter, statusFilter]);

  const filteredWithdrawals = useMemo(() => {
    return allWithdrawals.filter((w) => {
      if (!inRange(w.createdAt)) return false;
      if (networkFilter !== 'all' && w.network !== networkFilter) return false;
      if (statusFilter === 'approved_only' && w.status !== 'approved' && w.status !== 'completed') {
        return false;
      }
      if (statusFilter === 'pending_only' && w.status !== 'pending') return false;
      if (statusFilter === 'rejected_only' && w.status !== 'rejected') return false;
      return true;
    });
  }, [allWithdrawals, dateBounds, datePreset, networkFilter, statusFilter]);

  const filteredCommissions = useMemo(() => {
    return allMlmCommissions.filter((c) => inRange(c.createdAt));
  }, [allMlmCommissions, dateBounds, datePreset]);

  const totals = useMemo(() => {
    const depositsUsd = filteredDeposits.reduce((s, d) => s + (Number(d.amountUsd) || 0), 0);
    const withdrawalsUsd = filteredWithdrawals.reduce((s, w) => s + (Number(w.amountUsd) || 0), 0);
    const feesUsd = filteredWithdrawals.reduce((s, w) => s + (Number(w.feeUsd) || 0), 0);
    const promoDiscountsUsd = filteredWithdrawals.reduce(
      (s, w) => s + (Number(w.feeDiscountUsd) || 0),
      0
    );
    const commissionsUsd = filteredCommissions.reduce(
      (s, c) => s + (Number(c.commissionUsd) || 0),
      0
    );
    const totalUserDepositBal = allUsers.reduce((s, u) => s + (Number(u.usdBalance) || 0), 0);
    const totalUserIncomeBal = allUsers.reduce((s, u) => s + (Number(u.profitBalance) || 0), 0);
    return {
      depositsUsd,
      withdrawalsUsd,
      feesUsd,
      promoDiscountsUsd,
      commissionsUsd,
      totalUserDepositBal,
      totalUserIncomeBal,
    };
  }, [filteredDeposits, filteredWithdrawals, filteredCommissions, allUsers]);

  const stamp = new Date().toISOString().slice(0, 10);

  const exportFullWorkbook = () => {
    const summarySheet: ExcelWorksheetSpec = {
      name: 'Executive Summary',
      headers: ['Metric', 'Value (USD / Count)', 'Filter Scope'],
      rows: [
        ['Report Generated (UTC)', new Date().toISOString().replace('T', ' ').slice(0, 19), dateBounds.label],
        ['Status Filter', statusFilter.replace('_', ' '), networkFilter],
        ['Filtered Deposits Count', filteredDeposits.length, 'Crypto & Payment Deposits'],
        ['Filtered Deposits Volume (USD)', Number(totals.depositsUsd.toFixed(2)), dateBounds.label],
        ['Filtered Withdrawals Count', filteredWithdrawals.length, 'Profit & Capital Payouts'],
        ['Filtered Withdrawals Gross (USD)', Number(totals.withdrawalsUsd.toFixed(2)), dateBounds.label],
        ['Withdrawal Fees Collected (USD)', Number(totals.feesUsd.toFixed(2)), dateBounds.label],
        ['Promo Fee Discounts Granted (USD)', Number(totals.promoDiscountsUsd.toFixed(2)), dateBounds.label],
        ['Referral & Mentor Commissions (USD)', Number(totals.commissionsUsd.toFixed(2)), dateBounds.label],
        ['Registered Client Accounts', allUsers.length, 'Current Live Snapshot'],
        ['Total Client Deposit Wallets (USD)', Number(totals.totalUserDepositBal.toFixed(2)), 'Current Live Snapshot'],
        ['Total Client Income Wallets (USD)', Number(totals.totalUserIncomeBal.toFixed(2)), 'Current Live Snapshot'],
      ],
    };

    downloadExcelWorkbook(`AlphaTradex_Accounting_Workbook_${stamp}.xls`, [
      summarySheet,
      buildDepositsSheet(filteredDeposits),
      buildWithdrawalsSheet(filteredWithdrawals),
      buildCommissionsSheet(filteredCommissions, userLookup),
      buildUserBalancesSheet(allUsers),
    ]);
    onNotify('ok', `Exported 5-sheet Excel Accounting Workbook (${stamp}).`);
  };

  const handleSingleExport = (
    kind: 'deposits' | 'withdrawals' | 'commissions' | 'users',
    format: 'csv' | 'xls'
  ) => {
    let sheet: ExcelWorksheetSpec;
    let baseName: string;
    if (kind === 'deposits') {
      sheet = buildDepositsSheet(filteredDeposits);
      baseName = `AlphaTradex_Deposits_${stamp}`;
    } else if (kind === 'withdrawals') {
      sheet = buildWithdrawalsSheet(filteredWithdrawals);
      baseName = `AlphaTradex_Withdrawals_${stamp}`;
    } else if (kind === 'commissions') {
      sheet = buildCommissionsSheet(filteredCommissions, userLookup);
      baseName = `AlphaTradex_Commissions_${stamp}`;
    } else {
      sheet = buildUserBalancesSheet(allUsers);
      baseName = `AlphaTradex_User_Balances_${stamp}`;
    }

    if (format === 'csv') {
      downloadCsvFile(`${baseName}.csv`, sheet.headers, sheet.rows);
      onNotify('ok', `Downloaded ${baseName}.csv (${sheet.rows.length} rows).`);
    } else {
      downloadExcelWorkbook(`${baseName}.xls`, [sheet]);
      onNotify('ok', `Downloaded ${baseName}.xls (${sheet.rows.length} rows).`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header + Master Multi-Sheet Excel Export */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
            <FileSpreadsheet className="w-4 h-4" />
            Accounting &amp; Tax Reconciliation Desk
          </div>
          <h3 className="text-lg font-bold text-slate-900 mt-1">
            One-Click CSV &amp; Excel Financial Export
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
            Filter deposits, payouts, referral commissions, and live client balances by date range,
            status, or payment channel—and download clean, formula-safe CSV or multi-tab Excel
            workbooks.
          </p>
        </div>

        <button
          type="button"
          onClick={exportFullWorkbook}
          className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center justify-center gap-2 shadow-sm shrink-0"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Download Full 5-Sheet Excel Workbook (.xls)</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
          <Filter className="w-4 h-4 text-orange-500" />
          <span>Export Filters</span>
          <span className="text-[11px] font-normal text-slate-400">
            (Applies to Deposits, Withdrawals, Commissions &amp; Full Workbook)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Date Range Preset
            </label>
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as DatePreset)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 bg-white"
            >
              <option value="all">All-Time Records</option>
              <option value="this_month">Current Calendar Month</option>
              <option value="last_30">Last 30 Days</option>
              <option value="last_90">Last 90 Days</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Settlement Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="approved_only">Approved / Completed Only</option>
              <option value="pending_only">Pending Review Only</option>
              <option value="rejected_only">Rejected Only</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Payment Network / Channel
            </label>
            <select
              value={networkFilter}
              onChange={(e) => setNetworkFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 bg-white"
            >
              <option value="all">All Networks ({availableNetworks.length})</option>
              {availableNetworks.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          {datePreset === 'custom' ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">From</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full px-2 py-2 rounded-xl border border-slate-300 text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">To</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full px-2 py-2 rounded-xl border border-slate-300 text-xs text-slate-900"
                />
              </div>
            </div>
          ) : (
            <div className="flex items-end">
              <div className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Scope: {dateBounds.label}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4 Individual Ledger Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Deposits */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">1. Deposits Ledger</span>
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono text-[11px] font-bold">
                {filteredDeposits.length} rows
              </span>
            </div>
            <div className="text-2xl font-mono font-extrabold text-emerald-600">
              ${totals.depositsUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-500">
              Includes Deposit ID, UTC timestamp, client email, network, Web3/manual source, TX hash,
              and receiving wallet.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSingleExport('deposits', 'csv')}
              className="flex-1 py-2 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold inline-flex items-center justify-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => handleSingleExport('deposits', 'xls')}
              className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Export Excel
            </button>
          </div>
        </div>

        {/* Withdrawals & Payouts */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">2. Withdrawals &amp; Payouts</span>
              <span className="px-2 py-0.5 rounded bg-orange-50 text-orange-700 font-mono text-[11px] font-bold">
                {filteredWithdrawals.length} rows
              </span>
            </div>
            <div className="text-2xl font-mono font-extrabold text-orange-600">
              ${totals.withdrawalsUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-500">
              Gross payout, platform fees (${totals.feesUsd.toFixed(2)}), promo fee savings ($
              {totals.promoDiscountsUsd.toFixed(2)}), net payout, destination wallet, and payout TX
              hash.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSingleExport('withdrawals', 'csv')}
              className="flex-1 py-2 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold inline-flex items-center justify-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => handleSingleExport('withdrawals', 'xls')}
              className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Export Excel
            </button>
          </div>
        </div>

        {/* Commissions */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">
                3. Referral &amp; Mentor Commissions
              </span>
              <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono text-[11px] font-bold">
                {filteredCommissions.length} rows
              </span>
            </div>
            <div className="text-2xl font-mono font-extrabold text-indigo-600">
              ${totals.commissionsUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-500">
              Complete L1–L3 MLM referral overrides and Mentor commissions with beneficiary emails,
              tier rates, and originating investment amounts.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSingleExport('commissions', 'csv')}
              className="flex-1 py-2 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold inline-flex items-center justify-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => handleSingleExport('commissions', 'xls')}
              className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Export Excel
            </button>
          </div>
        </div>

        {/* User Balances */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-500" />
                4. Client Wallet Balances Snapshot
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px] font-bold">
                {allUsers.length} accounts
              </span>
            </div>
            <div className="text-2xl font-mono font-extrabold text-slate-900 flex items-baseline gap-2">
              <span>
                $
                {(totals.totalUserDepositBal + totals.totalUserIncomeBal).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span className="text-xs font-normal text-slate-500 inline-flex items-center gap-1">
                <Wallet className="w-3 h-3" /> Combined Liabilities
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Deposit Wallets (${totals.totalUserDepositBal.toFixed(2)}) + Income Wallets ($
              {totals.totalUserIncomeBal.toFixed(2)}), KYC status, total invested, and total
              withdrawn per user.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSingleExport('users', 'csv')}
              className="flex-1 py-2 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold inline-flex items-center justify-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => handleSingleExport('users', 'xls')}
              className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Export Excel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
