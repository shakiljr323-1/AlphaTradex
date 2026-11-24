import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Filter,
  History,
  PlusCircle,
  Search,
  Send,
  XCircle,
} from 'lucide-react';
import {
  CryptoDeposit,
  P2PTransfer,
  WalletTransfer,
  Withdrawal,
} from '../types/platform';
import { formatTimestamp } from '../utils/investmentMath';

type TxCategoryFilter = 'all' | 'deposit' | 'withdrawal' | 'internal_transfer';
type TxStatusFilter = 'all' | 'Pending' | 'Approved' | 'Rejected';
type NormalizedStatus = 'Pending' | 'Approved' | 'Rejected';

interface UnifiedTransactionRow {
  id: string;
  category: 'deposit' | 'withdrawal' | 'internal_transfer';
  categoryLabel: string;
  title: string;
  channelOrRoute: string;
  reference: string;
  note: string;
  amountUsd: number;
  signedDirection: 'credit' | 'debit' | 'internal';
  status: NormalizedStatus;
  rawStatusLabel?: string;
  timestampMs: number;
  dateLabel: string;
  breakdownWithdrawal?: Withdrawal;
}

interface TransactionHistoryViewProps {
  deposits: CryptoDeposit[];
  withdrawals: Withdrawal[];
  p2pTransfers: P2PTransfer[];
  walletTransfers: WalletTransfer[];
  currentUid: string;
  onSelectBreakdown: (withdrawal: Withdrawal) => void;
  onNavigate: (section: 'deposit' | 'withdraw' | 'p2p-transfers' | 'dashboard') => void;
}

function getTimestampMs(val: unknown): number {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (val instanceof Date) return val.getTime();
  const obj = val as { seconds?: number; nanoseconds?: number; toMillis?: () => number };
  if (typeof obj.toMillis === 'function') return obj.toMillis();
  if (typeof obj.seconds === 'number') {
    return obj.seconds * 1000 + Math.floor((obj.nanoseconds || 0) / 1_000_000);
  }
  return 0;
}

function normalizeDepositStatus(status: CryptoDeposit['status']): NormalizedStatus {
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  return 'Pending';
}

function normalizeWithdrawalStatus(status: Withdrawal['status']): NormalizedStatus {
  if (status === 'approved' || status === 'completed') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  return 'Pending';
}

export const TransactionHistoryView: React.FC<TransactionHistoryViewProps> = ({
  deposits,
  withdrawals,
  p2pTransfers,
  walletTransfers,
  currentUid,
  onSelectBreakdown,
  onNavigate,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<TxCategoryFilter>('all');
  const [statusFilter, setStatusFilter] = useState<TxStatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const allTransactions = useMemo<UnifiedTransactionRow[]>(() => {
    const depositRows: UnifiedTransactionRow[] = deposits.map((d) => ({
      id: `dep-${d.id}`,
      category: 'deposit',
      categoryLabel: 'Deposit',
      title: `${d.network.replace(/_/g, ' ')} Deposit`,
      channelOrRoute: `${d.network.replace(/_/g, ' ')} → Deposit Wallet`,
      reference: d.txId ? `TxID: ${d.txId}` : d.walletAddress,
      note: d.adminNote || 'Awaiting or verified crypto settlement',
      amountUsd: d.amountUsd,
      signedDirection: 'credit',
      status: normalizeDepositStatus(d.status),
      timestampMs: getTimestampMs(d.createdAt),
      dateLabel: formatTimestamp(d.createdAt),
    }));

    const withdrawalRows: UnifiedTransactionRow[] = withdrawals.map((w) => {
      const isCapital = w.type === 'manual_capital';
      return {
        id: `wd-${w.id}`,
        category: 'withdrawal',
        categoryLabel: 'Withdrawal',
        title: isCapital
          ? `Capital Withdrawal (Pkg #${w.packageNumber})`
          : 'Instant Profit Withdrawal',
        channelOrRoute: `${w.network.replace(/_/g, ' ')} Payout`,
        reference: w.destinationAddress,
        note:
          w.adminNote ||
          (w.source === 'mlm_commission'
            ? 'Referral Commission Payout'
            : w.source === 'elite_capital'
            ? 'Elite Principal Capital Release'
            : 'Income Wallet Profit Payout'),
        amountUsd: w.amountUsd,
        signedDirection: 'debit',
        status: normalizeWithdrawalStatus(w.status),
        rawStatusLabel: w.status === 'completed' ? 'Instant Settled' : undefined,
        timestampMs: getTimestampMs(w.createdAt),
        dateLabel: formatTimestamp(w.createdAt),
        breakdownWithdrawal: isCapital ? w : undefined,
      };
    });

    const p2pRows: UnifiedTransactionRow[] = p2pTransfers.map((t) => {
      const isSender = t.senderUid === currentUid;
      return {
        id: `p2p-${t.id}`,
        category: 'internal_transfer',
        categoryLabel: 'Internal Transfer',
        title: isSender ? 'P2P Sent' : 'P2P Received',
        channelOrRoute: isSender
          ? `To ${t.receiverName} (${t.receiverHandle})`
          : `From ${t.senderName} (${t.senderHandle})`,
        reference: isSender ? t.receiverHandle : t.senderHandle,
        note: t.note || 'User-to-User Internal USD Transfer',
        amountUsd: t.amountUsd,
        signedDirection: isSender ? 'debit' : 'credit',
        status: 'Approved',
        rawStatusLabel: 'Settled',
        timestampMs: getTimestampMs(t.createdAt),
        dateLabel: formatTimestamp(t.createdAt),
      };
    });

    const walletTransferRows: UnifiedTransactionRow[] = walletTransfers.map((wt) => ({
      id: `wt-${wt.id}`,
      category: 'internal_transfer',
      categoryLabel: 'Internal Transfer',
      title: 'Wallet Reallocation',
      channelOrRoute: `${wt.fromWallet} → ${wt.toWallet}`,
      reference: 'Internal Vault Ledger',
      note: wt.note || 'Internal wallet balance transfer',
      amountUsd: wt.amountUsd,
      signedDirection: 'internal',
      status: 'Approved',
      rawStatusLabel: 'Instant',
      timestampMs: getTimestampMs(wt.createdAt),
      dateLabel: formatTimestamp(wt.createdAt),
    }));

    return [...depositRows, ...withdrawalRows, ...p2pRows, ...walletTransferRows].sort(
      (a, b) => b.timestampMs - a.timestampMs
    );
  }, [deposits, withdrawals, p2pTransfers, walletTransfers, currentUid]);

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allTransactions.filter((row) => {
      if (categoryFilter !== 'all' && row.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (!q) return true;
      return (
        row.title.toLowerCase().includes(q) ||
        row.channelOrRoute.toLowerCase().includes(q) ||
        row.reference.toLowerCase().includes(q) ||
        row.note.toLowerCase().includes(q) ||
        row.categoryLabel.toLowerCase().includes(q)
      );
    });
  }, [allTransactions, categoryFilter, statusFilter, searchQuery]);

  const summary = useMemo(() => {
    const approvedDeposits = deposits
      .filter((d) => d.status === 'approved')
      .reduce((acc, d) => acc + d.amountUsd, 0);
    const totalWithdrawalsUsd = withdrawals
      .filter((w) => w.status === 'approved' || w.status === 'completed')
      .reduce((acc, w) => acc + w.amountUsd, 0);
    const totalInternalUsd =
      p2pTransfers.reduce((acc, t) => acc + t.amountUsd, 0) +
      walletTransfers.reduce((acc, wt) => acc + wt.amountUsd, 0);
    const pendingCount = allTransactions.filter((t) => t.status === 'Pending').length;
    const approvedCount = allTransactions.filter((t) => t.status === 'Approved').length;
    const rejectedCount = allTransactions.filter((t) => t.status === 'Rejected').length;

    return {
      approvedDeposits,
      totalWithdrawalsUsd,
      totalInternalUsd,
      pendingCount,
      approvedCount,
      rejectedCount,
      internalCount: p2pTransfers.length + walletTransfers.length,
    };
  }, [deposits, withdrawals, p2pTransfers, walletTransfers, allTransactions]);

  const renderStatusBadge = (status: NormalizedStatus) => {
    if (status === 'Approved') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/35 text-emerald-300 text-[11px] font-semibold">
          <CheckCircle2 className="w-3 h-3" />
          Approved
        </span>
      );
    }
    if (status === 'Rejected') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-red-500/20 border border-red-500/35 text-red-300 text-[11px] font-semibold">
          <XCircle className="w-3 h-3" />
          Rejected
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/35 text-amber-300 text-[11px] font-semibold">
        <Clock className="w-3 h-3" />
        Pending
      </span>
    );
  };

  const renderTypeBadge = (row: UnifiedTransactionRow) => {
    if (row.category === 'deposit') {
      return (
        <span className="inline-flex items-center gap-1.5 text-sky-300 font-semibold">
          <ArrowDownLeft className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span>{row.title}</span>
        </span>
      );
    }
    if (row.category === 'withdrawal') {
      return (
        <span className="inline-flex items-center gap-1.5 text-orange-300 font-semibold">
          <ArrowUpRight className="w-3.5 h-3.5 text-orange-400 shrink-0" />
          <span>{row.title}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-emerald-300 font-semibold">
        <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>{row.title}</span>
      </span>
    );
  };

  return (
    <section aria-labelledby="tx-history-heading" className="space-y-5">
      {/* Header & Quick Actions */}
      <div className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2
            id="tx-history-heading"
            className="font-display font-bold text-white text-lg flex items-center gap-2"
          >
            <History className="w-5 h-5 text-orange-400" />
            <span>Transaction History</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Unified ledger of your crypto deposits, instant/capital withdrawals, and internal wallet &amp; P2P transfers.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('deposit')}
            className="px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Deposit Funds
          </button>
          <button
            type="button"
            onClick={() => onNavigate('withdraw')}
            className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/90 hover:border-emerald-500/60 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
            Withdraw
          </button>
          <button
            type="button"
            onClick={() => onNavigate('p2p-transfers')}
            className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/90 hover:border-sky-500/60 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <Send className="w-3.5 h-3.5 text-sky-400" />
            P2P Transfer
          </button>
        </div>
      </div>

      {/* Summary Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-4 shadow-xl">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-sky-300">
            Approved Deposits
          </div>
          <div className="font-mono font-extrabold text-xl text-white tabular-nums mt-1">
            ${summary.approvedDeposits.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {deposits.length} submission(s) total
          </div>
        </div>

        <div className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-4 shadow-xl">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-orange-300">
            Approved Withdrawals
          </div>
          <div className="font-mono font-extrabold text-xl text-white tabular-nums mt-1">
            ${summary.totalWithdrawalsUsd.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {withdrawals.length} payout(s) recorded
          </div>
        </div>

        <div className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-4 shadow-xl">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
            Internal Transfers
          </div>
          <div className="font-mono font-extrabold text-xl text-white tabular-nums mt-1">
            ${summary.totalInternalUsd.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {summary.internalCount} P2P &amp; wallet transfer(s)
          </div>
        </div>

        <div className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-4 shadow-xl">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
            Status Breakdown
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[11px] font-semibold">
              {summary.pendingCount} Pending
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[11px] font-semibold">
              {summary.approvedCount} Approved
            </span>
            <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-mono text-[11px] font-semibold">
              {summary.rejectedCount} Rejected
            </span>
          </div>
        </div>
      </div>

      {/* Filters & Ledger Container */}
      <div className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Category Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Transaction type filter">
            {(
              [
                { id: 'all', label: `All (${allTransactions.length})` },
                { id: 'deposit', label: `Deposits (${deposits.length})` },
                { id: 'withdrawal', label: `Withdrawals (${withdrawals.length})` },
                {
                  id: 'internal_transfer',
                  label: `Internal Transfers (${summary.internalCount})`,
                },
              ] as { id: TxCategoryFilter; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={categoryFilter === tab.id}
                onClick={() => setCategoryFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  categoryFilter === tab.id
                    ? 'bg-orange-600 text-white'
                    : 'bg-slate-900/80 border border-slate-700/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Status Filter & Search */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 rounded-lg px-2.5 py-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as TxStatusFilter)}
                aria-label="Filter by status"
                className="bg-transparent text-xs text-slate-200 font-semibold focus:outline-none"
              >
                <option value="all" className="bg-slate-900">All Statuses</option>
                <option value="Pending" className="bg-slate-900">Pending</option>
                <option value="Approved" className="bg-slate-900">Approved</option>
                <option value="Rejected" className="bg-slate-900">Rejected</option>
              </select>
            </div>

            <div className="relative flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search TxID, handle, address..."
                aria-label="Search transactions"
                className="w-full sm:w-56 pl-8 pr-3 py-1.5 rounded-lg border border-slate-700/80 bg-slate-900/90 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>
        </div>

        {/* Ledger Rows */}
        {filteredTransactions.length === 0 ? (
          <div className="py-12 text-center space-y-3 border border-dashed border-slate-800 rounded-xl">
            <History className="w-8 h-8 text-slate-600 mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-200">
                No matching transactions found
              </p>
              <p className="text-xs text-slate-400">
                {allTransactions.length === 0
                  ? 'Submit a crypto deposit, request a withdrawal, or execute an internal transfer to populate your history.'
                  : 'Try clearing your status filter or search query.'}
              </p>
            </div>
            {(categoryFilter !== 'all' || statusFilter !== 'all' || searchQuery.trim() !== '') && (
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter('all');
                  setStatusFilter('all');
                  setSearchQuery('');
                }}
                className="px-3.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-xs font-semibold text-slate-200 hover:bg-slate-800"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                    <th className="py-2.5 pr-4">Date &amp; Time</th>
                    <th className="py-2.5 pr-4">Type</th>
                    <th className="py-2.5 pr-4">Channel / Route &amp; Reference</th>
                    <th className="py-2.5 pr-4 text-right">Amount (USD)</th>
                    <th className="py-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredTransactions.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3 pr-4 font-mono text-slate-400 whitespace-nowrap">
                        {row.dateLabel}
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <div>{renderTypeBadge(row)}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {row.categoryLabel}
                          {row.rawStatusLabel ? ` · ${row.rawStatusLabel}` : ''}
                        </div>
                      </td>
                      <td className="py-3 pr-4 max-w-[340px]">
                        <div className="font-semibold text-slate-200 truncate">
                          {row.channelOrRoute}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400 truncate">
                          {row.reference}
                        </div>
                        {row.note && (
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">
                            {row.note}
                          </div>
                        )}
                      </td>
                      <td
                        className={`py-3 pr-4 text-right font-mono font-bold tabular-nums whitespace-nowrap ${
                          row.signedDirection === 'credit'
                            ? 'text-emerald-400'
                            : row.signedDirection === 'debit'
                            ? 'text-red-400'
                            : 'text-sky-300'
                        }`}
                      >
                        {row.signedDirection === 'credit'
                          ? '+'
                          : row.signedDirection === 'debit'
                          ? '-'
                          : ''}
                        ${row.amountUsd.toFixed(2)}
                      </td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2 justify-end">
                          {renderStatusBadge(row.status)}
                          {row.breakdownWithdrawal && (
                            <button
                              type="button"
                              onClick={() => onSelectBreakdown(row.breakdownWithdrawal!)}
                              className="text-[11px] font-semibold text-orange-400 hover:underline"
                            >
                              Breakdown
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-2.5">
              {filteredTransactions.map((row) => (
                <div
                  key={row.id}
                  className="p-3.5 rounded-xl border border-slate-700/70 bg-slate-900/65 space-y-2 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div>{renderTypeBadge(row)}</div>
                      <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                        {row.dateLabel}
                      </div>
                    </div>
                    {renderStatusBadge(row.status)}
                  </div>
                  <div className="text-slate-200 font-medium truncate">{row.channelOrRoute}</div>
                  <div className="font-mono text-[11px] text-slate-400 break-all">
                    {row.reference}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                    <span className="text-[11px] text-slate-400 truncate max-w-[60%]">
                      {row.note}
                    </span>
                    <div className="flex items-center gap-2">
                      {row.breakdownWithdrawal && (
                        <button
                          type="button"
                          onClick={() => onSelectBreakdown(row.breakdownWithdrawal!)}
                          className="text-[11px] font-semibold text-orange-400 underline"
                        >
                          Breakdown
                        </button>
                      )}
                      <span
                        className={`font-mono font-bold tabular-nums ${
                          row.signedDirection === 'credit'
                            ? 'text-emerald-400'
                            : row.signedDirection === 'debit'
                            ? 'text-red-400'
                            : 'text-sky-300'
                        }`}
                      >
                        {row.signedDirection === 'credit'
                          ? '+'
                          : row.signedDirection === 'debit'
                          ? '-'
                          : ''}
                        ${row.amountUsd.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
};
