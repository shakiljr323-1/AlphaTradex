import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import {
  CryptoDeposit,
  ForexTrade,
  Investment,
  MlmCommission,
  UserProfile,
  Withdrawal,
} from '../types/platform';
import {
  computeInvestmentMetrics,
  countWeekdaysBetween,
  formatTimestamp,
  sha256Hex,
} from './investmentMath';

export interface PackageMonthlyAccrualRow {
  investmentId: string;
  packageNumber: number;
  packageName: string;
  capitalUsd: number;
  dailyPercent: number;
  dailyDollarTarget: number;
  periodProfitDays: number;
  periodAccruedUsd: number;
  cumulativeGeneratedUsd: number;
  claimedProfitUsd: number;
  unclaimedProfitUsd: number;
  status: string;
}

export interface MonthlyStatementSummary {
  periodKey: string; // 'YYYY-MM' or 'ALL'
  periodLabel: string; // e.g., 'November 2026' or 'All-Time Ledger'
  dateRangeLabel: string; // e.g., 'Nov 1, 2026 – Nov 26, 2026'
  generatedAtIso: string;

  // Filtered period records
  deposits: CryptoDeposit[];
  withdrawals: Withdrawal[];
  commissions: MlmCommission[];
  closedTrades: ForexTrade[];
  packageAccruals: PackageMonthlyAccrualRow[];

  // Deposit totals (in period)
  approvedDepositsUsd: number;
  pendingDepositsUsd: number;
  rejectedDepositsUsd: number;

  // Accrued profit totals (in period)
  periodPackageAccruedUsd: number;
  periodCommissionsUsd: number;
  periodForexPnlUsd: number;
  totalPeriodAccruedProfitsUsd: number;
  liveUnclaimedProfitUsd: number;
  cumulativeClaimedProfitUsd: number;

  // Withdrawal totals (in period)
  completedWithdrawalsUsd: number;
  pendingWithdrawalsUsd: number;
  totalWithdrawalFeesUsd: number;
  netWithdrawalsPayoutUsd: number;

  // Net summary
  netPeriodCashflowUsd: number;
}

export interface StatementIntegritySeal {
  verificationCode: string;
  sha256Full: string;
}

export interface StatementDownloadResult extends StatementIntegritySeal {
  fileName: string;
  periodLabel: string;
}

const MS_PER_DAY = 86_400_000;

export function getCurrentMonthKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getRecentMonthOptions(count = 12, now: Date = new Date()): { key: string; label: string }[] {
  const options: { key: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    options.push({
      key,
      label: i === 0 ? `${label} (Current Month)` : label,
    });
  }
  options.push({ key: 'ALL', label: 'All-Time Account Ledger' });
  return options;
}

export function extractTimestampMs(value: unknown, fallbackMs?: number): number {
  if (value && typeof value === 'object') {
    if ('toMillis' in value && typeof (value as { toMillis: () => number }).toMillis === 'function') {
      const ms = (value as { toMillis: () => number }).toMillis();
      if (Number.isFinite(ms) && ms > 0) return ms;
    }
    if ('toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
      const ms = (value as { toDate: () => Date }).toDate().getTime();
      if (Number.isFinite(ms) && ms > 0) return ms;
    }
    if ('seconds' in value && typeof (value as { seconds: number }).seconds === 'number') {
      const ms = (value as { seconds: number }).seconds * 1000;
      if (Number.isFinite(ms) && ms > 0) return ms;
    }
  }
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  if (typeof fallbackMs === 'number' && Number.isFinite(fallbackMs) && fallbackMs > 0) {
    return fallbackMs;
  }
  return 0;
}

function money(val: number): string {
  const num = Number(val || 0);
  const abs = Math.abs(num).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return num < 0 ? `-$${abs}` : `$${abs}`;
}

export function maskEmailAddress(email: string): string {
  const parts = String(email || '').split('@');
  if (parts.length !== 2) return '***';
  const local = parts[0];
  if (local.length <= 2) return `${local[0] || '*'}***@${parts[1]}`;
  return `${local[0]}${'*'.repeat(Math.min(5, local.length - 2))}${local[local.length - 1]}@${parts[1]}`;
}

export function maskWalletOrTx(value: string): string {
  const clean = String(value || '').trim();
  if (!clean || clean === '—') return '—';
  if (clean.length <= 10) return `${clean.slice(0, 3)}***${clean.slice(-2)}`;
  return `${clean.slice(0, 6)}...${clean.slice(-4)}`;
}

function parseMonthBounds(periodKey: string, nowMs: number): {
  isAllTime: boolean;
  startMs: number;
  endMs: number;
  effectiveEndMs: number;
  periodLabel: string;
  dateRangeLabel: string;
} {
  if (!periodKey || periodKey === 'ALL') {
    const nowDate = new Date(nowMs);
    return {
      isAllTime: true,
      startMs: 0,
      endMs: nowMs,
      effectiveEndMs: nowMs,
      periodLabel: 'All-Time Vault Statement',
      dateRangeLabel: `Account Inception – ${nowDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`,
    };
  }

  const match = /^(\d{4})-(\d{2})$/.exec(periodKey);
  const nowDate = new Date(nowMs);
  const year = match ? Number(match[1]) : nowDate.getFullYear();
  const monthIdx = match ? Math.max(0, Math.min(11, Number(match[2]) - 1)) : nowDate.getMonth();

  const startDate = new Date(year, monthIdx, 1, 0, 0, 0, 0);
  const endDate = new Date(year, monthIdx + 1, 0, 23, 59, 59, 999);
  const effectiveEndMs = Math.min(endDate.getTime(), nowMs);
  const effectiveEndDate = new Date(Math.max(startDate.getTime(), effectiveEndMs));

  const fmtShort = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return {
    isAllTime: false,
    startMs: startDate.getTime(),
    endMs: endDate.getTime(),
    effectiveEndMs,
    periodLabel: startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    dateRangeLabel: `${fmtShort(startDate)} – ${fmtShort(effectiveEndDate)}`,
  };
}

/**
 * Computes exact Mon-Fri accrued profits, filtered deposits, commissions, closed Forex trades,
 * and withdrawal transactions for the selected month (defaults to current month).
 */
export function buildMonthlyStatementSummary(params: {
  deposits: CryptoDeposit[];
  withdrawals: Withdrawal[];
  investments: Investment[];
  commissions: MlmCommission[];
  forexTrades?: ForexTrade[];
  globalPaused?: boolean;
  monthFilter?: string; // 'YYYY-MM' (defaults to current month) or 'ALL'
  nowMs?: number;
}): MonthlyStatementSummary {
  const nowMs = params.nowMs ?? Date.now();
  const periodKey = params.monthFilter || getCurrentMonthKey(new Date(nowMs));
  const bounds = parseMonthBounds(periodKey, nowMs);

  const inPeriod = (tsValue: unknown, fallbackMs?: number): boolean => {
    if (bounds.isAllTime) return true;
    const ms = extractTimestampMs(tsValue, fallbackMs);
    if (!ms) return false;
    return ms >= bounds.startMs && ms <= bounds.endMs;
  };

  const filteredDeposits = (params.deposits || [])
    .filter((d) => inPeriod(d.createdAt))
    .sort((a, b) => extractTimestampMs(b.createdAt) - extractTimestampMs(a.createdAt));

  const filteredWithdrawals = (params.withdrawals || [])
    .filter((w) => inPeriod(w.createdAt))
    .sort((a, b) => extractTimestampMs(b.createdAt) - extractTimestampMs(a.createdAt));

  const filteredCommissions = (params.commissions || [])
    .filter((c) => inPeriod(c.createdAt))
    .sort((a, b) => extractTimestampMs(b.createdAt) - extractTimestampMs(a.createdAt));

  const filteredClosedTrades = (params.forexTrades || [])
    .filter((t) => t.status === 'closed' && inPeriod(t.closedAtMs ?? t.createdAt, t.openedAtMs))
    .sort(
      (a, b) =>
        extractTimestampMs(b.closedAtMs ?? b.createdAt, b.openedAtMs) -
        extractTimestampMs(a.closedAtMs ?? a.createdAt, a.openedAtMs)
    );

  // Compute per-package profit accrued within the selected period
  const packageAccruals: PackageMonthlyAccrualRow[] = (params.investments || [])
    .filter((inv) => bounds.isAllTime || inv.startedAtMs <= bounds.effectiveEndMs)
    .map((inv) => {
      const totalProfitDays = inv.totalProfitDays || 200;
      const metrics = computeInvestmentMetrics(inv, Boolean(params.globalPaused), nowMs);

      let periodProfitDays = metrics.completedProfitDays;
      if (!bounds.isAllTime) {
        const beforePeriodEndMs = bounds.startMs - MS_PER_DAY;
        const daysBeforePeriod =
          inv.startedAtMs < bounds.startMs
            ? countWeekdaysBetween(inv.startedAtMs, beforePeriodEndMs, totalProfitDays)
            : 0;
        const daysThroughPeriodEnd = countWeekdaysBetween(
          inv.startedAtMs,
          bounds.effectiveEndMs,
          totalProfitDays
        );
        periodProfitDays = Math.max(0, daysThroughPeriodEnd - daysBeforePeriod);
      }

      const periodAccruedUsd = Number((periodProfitDays * metrics.dailyDollarTarget).toFixed(2));
      return {
        investmentId: inv.id,
        packageNumber: inv.packageNumber,
        packageName: inv.packageName,
        capitalUsd: Number(inv.capital || 0),
        dailyPercent: Number(inv.dailyPercent || 0),
        dailyDollarTarget: metrics.dailyDollarTarget,
        periodProfitDays,
        periodAccruedUsd,
        cumulativeGeneratedUsd: metrics.totalProfitGenerated,
        claimedProfitUsd: Number(inv.claimedProfit || 0),
        unclaimedProfitUsd: metrics.unclaimedProfit,
        status: inv.status,
      };
    });

  const approvedDepositsUsd = Number(
    filteredDeposits
      .filter((d) => d.status === 'approved')
      .reduce((s, d) => s + Number(d.amountUsd || 0), 0)
      .toFixed(2)
  );
  const pendingDepositsUsd = Number(
    filteredDeposits
      .filter((d) => d.status === 'pending')
      .reduce((s, d) => s + Number(d.amountUsd || 0), 0)
      .toFixed(2)
  );
  const rejectedDepositsUsd = Number(
    filteredDeposits
      .filter((d) => d.status === 'rejected')
      .reduce((s, d) => s + Number(d.amountUsd || 0), 0)
      .toFixed(2)
  );

  const periodPackageAccruedUsd = Number(
    packageAccruals.reduce((s, p) => s + p.periodAccruedUsd, 0).toFixed(2)
  );
  const liveUnclaimedProfitUsd = Number(
    packageAccruals.reduce((s, p) => s + p.unclaimedProfitUsd, 0).toFixed(2)
  );
  const cumulativeClaimedProfitUsd = Number(
    packageAccruals.reduce((s, p) => s + p.claimedProfitUsd, 0).toFixed(2)
  );
  const periodCommissionsUsd = Number(
    filteredCommissions.reduce((s, c) => s + Number(c.commissionUsd || 0), 0).toFixed(2)
  );
  const periodForexPnlUsd = Number(
    filteredClosedTrades.reduce((s, t) => s + Number(t.realizedPnlUsd || 0), 0).toFixed(2)
  );
  const totalPeriodAccruedProfitsUsd = Number(
    (periodPackageAccruedUsd + periodCommissionsUsd + periodForexPnlUsd).toFixed(2)
  );

  const paidWithdrawals = filteredWithdrawals.filter(
    (w) => w.status === 'approved' || w.status === 'completed'
  );
  const completedWithdrawalsUsd = Number(
    paidWithdrawals.reduce((s, w) => s + Number(w.amountUsd || 0), 0).toFixed(2)
  );
  const pendingWithdrawalsUsd = Number(
    filteredWithdrawals
      .filter((w) => w.status === 'pending')
      .reduce((s, w) => s + Number(w.amountUsd || 0), 0)
      .toFixed(2)
  );
  const totalWithdrawalFeesUsd = Number(
    paidWithdrawals.reduce((s, w) => s + Number(w.feeUsd || 0), 0).toFixed(2)
  );
  const netWithdrawalsPayoutUsd = Number(
    paidWithdrawals
      .reduce(
        (s, w) =>
          s +
          (typeof w.netPayoutUsd === 'number'
            ? w.netPayoutUsd
            : Math.max(0, Number(w.amountUsd || 0) - Number(w.feeUsd || 0))),
        0
      )
      .toFixed(2)
  );

  const netPeriodCashflowUsd = Number(
    (approvedDepositsUsd + totalPeriodAccruedProfitsUsd - completedWithdrawalsUsd).toFixed(2)
  );

  return {
    periodKey,
    periodLabel: bounds.periodLabel,
    dateRangeLabel: bounds.dateRangeLabel,
    generatedAtIso: new Date(nowMs).toISOString(),
    deposits: filteredDeposits,
    withdrawals: filteredWithdrawals,
    commissions: filteredCommissions,
    closedTrades: filteredClosedTrades,
    packageAccruals,
    approvedDepositsUsd,
    pendingDepositsUsd,
    rejectedDepositsUsd,
    periodPackageAccruedUsd,
    periodCommissionsUsd,
    periodForexPnlUsd,
    totalPeriodAccruedProfitsUsd,
    liveUnclaimedProfitUsd,
    cumulativeClaimedProfitUsd,
    completedWithdrawalsUsd,
    pendingWithdrawalsUsd,
    totalWithdrawalFeesUsd,
    netWithdrawalsPayoutUsd,
    netPeriodCashflowUsd,
  };
}

/**
 * Computes a real SHA-256 tamper-evident integrity seal over the canonical statement payload.
 */
export async function computeStatementIntegritySeal(
  summary: MonthlyStatementSummary,
  user: UserProfile
): Promise<StatementIntegritySeal> {
  const canonicalPayload = JSON.stringify({
    uid: user.uid,
    period: summary.periodKey,
    approvedDepositsUsd: summary.approvedDepositsUsd,
    totalPeriodAccruedProfitsUsd: summary.totalPeriodAccruedProfitsUsd,
    completedWithdrawalsUsd: summary.completedWithdrawalsUsd,
    depositIds: summary.deposits.map((d) => `${d.id}:${d.status}:${d.amountUsd}`),
    withdrawalIds: summary.withdrawals.map((w) => `${w.id}:${w.status}:${w.amountUsd}`),
    commissionIds: summary.commissions.map((c) => `${c.id}:${c.commissionUsd}`),
  });

  const fullHex = (await sha256Hex(canonicalPayload)).toUpperCase();
  const shortCode = `ATX-${fullHex.slice(0, 4)}-${fullHex.slice(4, 8)}`;
  return {
    verificationCode: shortCode,
    sha256Full: fullHex,
  };
}

function setStatusColor(doc: jsPDF, status: string) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'approved' || normalized === 'completed' || normalized === 'active') {
    doc.setTextColor(5, 150, 105); // Emerald 600
  } else if (normalized === 'pending' || normalized === 'capital_requested') {
    doc.setTextColor(217, 119, 6); // Amber 600
  } else {
    doc.setTextColor(225, 29, 72); // Rose 600
  }
}

/**
 * Generates and downloads a secure, stylized institutional PDF statement summarizing
 * deposit history, accrued profits, and withdrawal transactions for the selected month
 * (defaults to the current calendar month).
 */
export async function downloadAccountStatementPdf(params: {
  companyName: string;
  user: UserProfile;
  deposits: CryptoDeposit[];
  withdrawals: Withdrawal[];
  investments: Investment[];
  commissions: MlmCommission[];
  forexTrades?: ForexTrade[];
  globalPaused?: boolean;
  monthFilter?: string; // defaults to current month 'YYYY-MM'
  maskSensitive?: boolean;
}): Promise<StatementDownloadResult> {
  const { companyName, user, maskSensitive = false } = params;
  const monthFilter = params.monthFilter || getCurrentMonthKey();

  const summary = buildMonthlyStatementSummary({
    deposits: params.deposits,
    withdrawals: params.withdrawals,
    investments: params.investments,
    commissions: params.commissions,
    forexTrades: params.forexTrades,
    globalPaused: params.globalPaused,
    monthFilter,
  });

  const seal = await computeStatementIntegritySeal(summary, user);

  // Generate QR verification seal image
  let qrDataUrl = '';
  try {
    const qrPayload = JSON.stringify({
      issuer: companyName,
      id: seal.verificationCode,
      period: summary.periodKey,
      uid: user.uid.slice(0, 10),
      sha256: seal.sha256Full.slice(0, 24),
    });
    qrDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 140,
      margin: 1,
      color: { dark: '#0B111E', light: '#FFFFFF' },
    });
  } catch {
    qrDataUrl = '';
  }

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 38;
  const contentW = pageW - marginX * 2;

  const drawContinuationHeader = () => {
    doc.setFillColor(11, 17, 30);
    doc.rect(0, 0, pageW, 38, 'F');
    doc.setFillColor(217, 169, 66);
    doc.rect(0, 38, pageW, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(`${companyName.toUpperCase()}  •  MONTHLY INVESTOR STATEMENT`, marginX, 23);
    doc.setFont('courier', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`${summary.periodLabel}  |  ID: ${seal.verificationCode}`, pageW - marginX, 23, {
      align: 'right',
    });
  };

  let y = 0;
  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 64) {
      doc.addPage();
      drawContinuationHeader();
      y = 58;
    }
  };

  // === PAGE 1 INSTITUTIONAL HEADER BANNER ===
  doc.setFillColor(10, 16, 30);
  doc.rect(0, 0, pageW, 118, 'F');
  // Dual Gold + Emerald precision accent bar
  doc.setFillColor(217, 169, 66);
  doc.rect(0, 114, pageW * 0.42, 4, 'F');
  doc.setFillColor(16, 185, 129);
  doc.rect(pageW * 0.42, 114, pageW * 0.58, 4, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(companyName.toUpperCase(), marginX, 40);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(245, 198, 92);
  doc.text(
    summary.periodKey === 'ALL'
      ? 'VERIFIED ALL-TIME ACCOUNT STATEMENT'
      : 'MONTHLY INVESTOR STATEMENT & LEDGER REPORT',
    marginX,
    58
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(`Statement Period: ${summary.periodLabel} (${summary.dateRangeLabel})`, marginX, 75);
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(8);
  doc.text(
    `Issued: ${summary.generatedAtIso.replace('T', ' ').slice(0, 19)} UTC  •  Security Mode: ${
      maskSensitive ? 'Privacy Redacted' : 'Full Ledger'
    }`,
    marginX,
    92
  );

  // Right side: QR Security Seal + Verification Code
  const qrSize = 62;
  const qrX = pageW - marginX - qrSize;
  const qrY = 22;
  if (qrDataUrl) {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(qrX - 3, qrY - 3, qrSize + 6, qrSize + 6, 4, 4, 'F');
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
  }
  const metaRightX = qrDataUrl ? qrX - 12 : pageW - marginX;
  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(52, 211, 153);
  doc.text(seal.verificationCode, metaRightX, 42, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('TAMPER-EVIDENT SEAL', metaRightX, 54, { align: 'right' });
  doc.text(`KYC: ${String(user.kycStatus || 'unverified').toUpperCase()}`, metaRightX, 72, {
    align: 'right',
  });
  doc.text(`SHA-256: ${seal.sha256Full.slice(0, 14)}...`, metaRightX, 86, { align: 'right' });

  // === CLIENT PROFILE CARD ===
  y = 134;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(marginX, y, contentW, 56, 6, 6, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(user.fullName || 'Investor Account', marginX + 14, y + 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const displayEmail = maskSensitive ? maskEmailAddress(user.email) : user.email;
  doc.text(`Account Email: ${displayEmail}`, marginX + 14, y + 35);
  doc.text(`Investor Handle: @${user.handle}`, marginX + 14, y + 48);

  doc.text(
    `Client UID: ${maskSensitive ? maskWalletOrTx(user.uid) : user.uid.slice(0, 24)}`,
    pageW - marginX - 14,
    y + 20,
    { align: 'right' }
  );
  doc.text(
    `Deposit Wallet: ${money(user.usdBalance)}   |   Income Wallet: ${money(user.profitBalance)}`,
    pageW - marginX - 14,
    y + 35,
    { align: 'right' }
  );
  doc.text(
    `Account Tier: ${user.isMentor ? 'ACTIVE MENTOR' : 'INVESTOR VAULT'}  •  Total Invested: ${money(
      user.totalInvested
    )}`,
    pageW - marginX - 14,
    y + 48,
    { align: 'right' }
  );

  // === 4 STYLED KPI CARDS ===
  y += 70;
  const kpis: {
    label: string;
    value: string;
    sub: string;
    accent: [number, number, number];
  }[] = [
    {
      label: 'MONTH DEPOSITS',
      value: money(summary.approvedDepositsUsd),
      sub: `${summary.deposits.length} tx (${money(summary.pendingDepositsUsd)} pending)`,
      accent: [14, 165, 233],
    },
    {
      label: 'ACCRUED PROFITS',
      value: money(summary.totalPeriodAccruedProfitsUsd),
      sub: `Unclaimed live: ${money(summary.liveUnclaimedProfitUsd)}`,
      accent: [16, 185, 129],
    },
    {
      label: 'MONTH WITHDRAWALS',
      value: money(summary.completedWithdrawalsUsd),
      sub: `${summary.withdrawals.length} tx (${money(summary.pendingWithdrawalsUsd)} pending)`,
      accent: [245, 158, 11],
    },
    {
      label: 'NET PERIOD FLOW',
      value: `${summary.netPeriodCashflowUsd >= 0 ? '+' : ''}${money(summary.netPeriodCashflowUsd)}`,
      sub: `Fees paid: ${money(summary.totalWithdrawalFeesUsd)}`,
      accent: [99, 102, 241],
    },
  ];

  const cardGap = 8;
  const cardW = (contentW - cardGap * 3) / 4;
  kpis.forEach((k, idx) => {
    const cx = marginX + idx * (cardW + cardGap);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(cx, y, cardW, 58, 5, 5, 'FD');

    doc.setFillColor(k.accent[0], k.accent[1], k.accent[2]);
    doc.rect(cx + 1, y + 1, cardW - 2, 3.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(100, 116, 139);
    doc.text(k.label, cx + 9, y + 18);

    doc.setFontSize(12.5);
    doc.setTextColor(15, 23, 42);
    doc.text(k.value, cx + 9, y + 36);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(k.sub.slice(0, 28), cx + 9, y + 49);
  });

  // Helper to draw styled section heading
  const drawSectionTitle = (num: string, title: string, rightNote: string) => {
    ensureSpace(64);
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(marginX, y, 18, 16, 3, 3, 'F');
    doc.setTextColor(245, 198, 92);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(num, marginX + 9, y + 11, { align: 'center' });

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(title, marginX + 25, y + 11.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(rightNote, pageW - marginX, y + 11, { align: 'right' });
    y += 22;
  };

  // =========================================================
  // SECTION 1: DEPOSIT HISTORY (PERIOD)
  // =========================================================
  y += 74;
  drawSectionTitle(
    '01',
    `Deposit History — ${summary.periodLabel}`,
    `Approved: ${money(summary.approvedDepositsUsd)}  •  ${summary.deposits.length} record(s)`
  );

  doc.setFillColor(241, 245, 249);
  doc.rect(marginX, y, contentW, 18, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('DATE (UTC)', marginX + 6, y + 12);
  doc.text('NETWORK / CHANNEL', marginX + 112, y + 12);
  doc.text('TX HASH / REFERENCE', marginX + 220, y + 12);
  doc.text('STATUS', marginX + 382, y + 12);
  doc.text('AMOUNT', pageW - marginX - 6, y + 12, { align: 'right' });
  y += 20;

  if (summary.deposits.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('No deposit transactions recorded in this statement period.', marginX + 6, y + 12);
    y += 24;
  } else {
    summary.deposits.forEach((d, idx) => {
      ensureSpace(20);
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, y - 2, contentW, 18, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(15, 23, 42);
      doc.text(formatTimestamp(d.createdAt).slice(0, 16), marginX + 6, y + 10);

      const channel = d.verificationSource === 'web3_auto' ? 'Web3 Auto' : 'Manual';
      doc.text(`${String(d.network || 'USDT').slice(0, 10)} (${channel})`, marginX + 112, y + 10);

      doc.setFont('courier', 'normal');
      const txLabel = maskSensitive ? maskWalletOrTx(d.txId || '—') : String(d.txId || '—').slice(0, 26);
      doc.text(txLabel, marginX + 220, y + 10);

      doc.setFont('helvetica', 'bold');
      setStatusColor(doc, d.status);
      doc.text(String(d.status || '').toUpperCase(), marginX + 382, y + 10);

      doc.setTextColor(15, 23, 42);
      doc.text(money(d.amountUsd), pageW - marginX - 6, y + 10, { align: 'right' });

      doc.setDrawColor(241, 245, 249);
      doc.line(marginX, y + 16, pageW - marginX, y + 16);
      y += 18;
    });

    // Deposit subtotal row
    ensureSpace(22);
    doc.setFillColor(239, 246, 255);
    doc.rect(marginX, y, contentW, 18, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 58, 138);
    doc.text('TOTAL APPROVED DEPOSITS (PERIOD)', marginX + 6, y + 12);
    doc.text(money(summary.approvedDepositsUsd), pageW - marginX - 6, y + 12, { align: 'right' });
    y += 24;
  }

  // =========================================================
  // SECTION 2: ACCRUED PROFITS & YIELD SUMMARY (PERIOD)
  // =========================================================
  y += 8;
  drawSectionTitle(
    '02',
    `Accrued Profits & Yield Breakdown — ${summary.periodLabel}`,
    `Total Period Accrued: ${money(summary.totalPeriodAccruedProfitsUsd)}`
  );

  doc.setFillColor(241, 245, 249);
  doc.rect(marginX, y, contentW, 18, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('PACKAGE', marginX + 6, y + 12);
  doc.text('CAPITAL', marginX + 132, y + 12, { align: 'right' });
  doc.text('RATE / DAY', marginX + 206, y + 12, { align: 'right' });
  doc.text('MO. DAYS', marginX + 266, y + 12, { align: 'right' });
  doc.text('MO. ACCRUED', marginX + 344, y + 12, { align: 'right' });
  doc.text('CLAIMED', marginX + 422, y + 12, { align: 'right' });
  doc.text('UNCLAIMED', pageW - marginX - 6, y + 12, { align: 'right' });
  y += 20;

  if (summary.packageAccruals.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('No active AI trading packages accrued profit in this period.', marginX + 6, y + 12);
    y += 22;
  } else {
    summary.packageAccruals.forEach((p, idx) => {
      ensureSpace(20);
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, y - 2, contentW, 18, 'F');
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.8);
      doc.setTextColor(15, 23, 42);
      doc.text(`#${p.packageNumber} ${p.packageName}`.slice(0, 20), marginX + 6, y + 10);

      doc.setFont('helvetica', 'normal');
      doc.text(money(p.capitalUsd), marginX + 132, y + 10, { align: 'right' });
      doc.text(`${p.dailyPercent.toFixed(2)}% (${money(p.dailyDollarTarget)})`, marginX + 206, y + 10, {
        align: 'right',
      });
      doc.text(`${p.periodProfitDays}d`, marginX + 266, y + 10, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(5, 150, 105);
      doc.text(`+${money(p.periodAccruedUsd)}`, marginX + 344, y + 10, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(money(p.claimedProfitUsd), marginX + 422, y + 10, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(217, 119, 6);
      doc.text(money(p.unclaimedProfitUsd), pageW - marginX - 6, y + 10, { align: 'right' });

      doc.setDrawColor(241, 245, 249);
      doc.line(marginX, y + 16, pageW - marginX, y + 16);
      y += 18;
    });
  }

  // Secondary Profit Streams (Referral Commissions & Closed Forex PnL)
  ensureSpace(44);
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(marginX, y + 2, contentW, 34, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(6, 95, 70);
  doc.text('PERIOD PROFIT STREAMS BREAKDOWN', marginX + 10, y + 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `Package Accrual: ${money(summary.periodPackageAccruedUsd)}   |   Referral Commissions (${summary.commissions.length}): ${money(
      summary.periodCommissionsUsd
    )}   |   Closed Forex PnL (${summary.closedTrades.length}): ${money(summary.periodForexPnlUsd)}`,
    marginX + 10,
    y + 28
  );

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(5, 150, 105);
  doc.text(
    `TOTAL: ${money(summary.totalPeriodAccruedProfitsUsd)}`,
    pageW - marginX - 10,
    y + 14,
    { align: 'right' }
  );
  y += 46;

  // =========================================================
  // SECTION 3: WITHDRAWAL TRANSACTIONS (PERIOD)
  // =========================================================
  y += 6;
  drawSectionTitle(
    '03',
    `Withdrawal Transactions — ${summary.periodLabel}`,
    `Paid: ${money(summary.completedWithdrawalsUsd)}  •  Net: ${money(summary.netWithdrawalsPayoutUsd)}`
  );

  doc.setFillColor(241, 245, 249);
  doc.rect(marginX, y, contentW, 18, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('DATE (UTC)', marginX + 6, y + 12);
  doc.text('NETWORK', marginX + 102, y + 12);
  doc.text('DESTINATION / PAYOUT TX', marginX + 174, y + 12);
  doc.text('FEE', marginX + 350, y + 12, { align: 'right' });
  doc.text('STATUS', marginX + 372, y + 12);
  doc.text('AMOUNT', pageW - marginX - 6, y + 12, { align: 'right' });
  y += 20;

  if (summary.withdrawals.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('No withdrawal transactions recorded in this statement period.', marginX + 6, y + 12);
    y += 24;
  } else {
    summary.withdrawals.forEach((w, idx) => {
      ensureSpace(20);
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, y - 2, contentW, 18, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(15, 23, 42);
      doc.text(formatTimestamp(w.createdAt).slice(0, 16), marginX + 6, y + 10);
      doc.text(String(w.network || 'USDT').slice(0, 12), marginX + 102, y + 10);

      doc.setFont('courier', 'normal');
      const rawRef = w.payoutTxHash ? `TX:${w.payoutTxHash}` : w.destinationAddress || '—';
      const displayRef = maskSensitive
        ? w.payoutTxHash
          ? `TX:${maskWalletOrTx(w.payoutTxHash)}`
          : maskWalletOrTx(w.destinationAddress || '—')
        : rawRef.slice(0, 24);
      doc.text(displayRef, marginX + 174, y + 10);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(money(w.feeUsd || 0), marginX + 350, y + 10, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      setStatusColor(doc, w.status);
      doc.text(String(w.status || '').toUpperCase(), marginX + 372, y + 10);

      doc.setTextColor(15, 23, 42);
      doc.text(money(w.amountUsd), pageW - marginX - 6, y + 10, { align: 'right' });

      doc.setDrawColor(241, 245, 249);
      doc.line(marginX, y + 16, pageW - marginX, y + 16);
      y += 18;
    });

    ensureSpace(22);
    doc.setFillColor(255, 251, 235);
    doc.rect(marginX, y, contentW, 18, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(146, 64, 14);
    doc.text(
      `TOTAL PAID WITHDRAWALS (FEES: ${money(summary.totalWithdrawalFeesUsd)}  •  NET: ${money(
        summary.netWithdrawalsPayoutUsd
      )})`,
      marginX + 6,
      y + 12
    );
    doc.text(money(summary.completedWithdrawalsUsd), pageW - marginX - 6, y + 12, {
      align: 'right',
    });
    y += 24;
  }

  // === SECURITY FOOTER & PAGE NUMBERS ON EVERY PAGE ===
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.line(marginX, pageH - 46, pageW - marginX, pageH - 46);

    doc.setFont('courier', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(71, 85, 105);
    doc.text(`SHA-256 INTEGRITY DIGEST: ${seal.sha256Full}`, marginX, pageH - 34);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Generated securely from ${companyName} Vault Ledger. Digital asset trading carries market risk; past performance does not guarantee future results.`,
      marginX,
      pageH - 22
    );

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Page ${p} of ${totalPages}`, pageW - marginX, pageH - 22, { align: 'right' });
  }

  const safeCompany = companyName.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'AlphaTradex';
  const fileTag = summary.periodKey === 'ALL' ? `AllTime-${new Date().toISOString().slice(0, 10)}` : summary.periodKey;
  const fileName = `${safeCompany}-Monthly-Statement-${fileTag}.pdf`;
  doc.save(fileName);

  return {
    ...seal,
    fileName,
    periodLabel: summary.periodLabel,
  };
}

function makeLegacyCertHash(uid: string): string {
  const raw = `${uid}:CERTIFICATE:${new Date().toISOString().slice(0, 10)}`;
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `ATX-${(hash >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
}

/**
 * Generates and downloads an institutional dark-navy & gold Portfolio / Profit Certificate PDF.
 */
export function downloadProfitCertificatePdf(params: {
  companyName: string;
  user: UserProfile;
  investments: Investment[];
  withdrawals: Withdrawal[];
  commissions: MlmCommission[];
}): void {
  const { companyName, user, investments, withdrawals, commissions } = params;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // Dark Navy Luxury Background
  doc.setFillColor(10, 16, 30);
  doc.rect(0, 0, w, h, 'F');

  // Double Gold Frame
  doc.setDrawColor(217, 169, 66);
  doc.setLineWidth(3);
  doc.rect(24, 24, w - 48, h - 48, 'S');
  doc.setLineWidth(0.8);
  doc.setDrawColor(100, 116, 139);
  doc.rect(34, 34, w - 68, h - 68, 'S');

  // Header Badge
  doc.setTextColor(245, 198, 92);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`${companyName.toUpperCase()}  •  VERIFIED PORTFOLIO RECORD`, w / 2, 82, {
    align: 'center',
  });

  doc.setTextColor(255, 255, 255);
  doc.setFont('times', 'bold');
  doc.setFontSize(34);
  doc.text('CERTIFICATE OF PORTFOLIO PERFORMANCE', w / 2, 132, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(148, 163, 184);
  doc.text('This document certifies the recorded vault ledger activity for', w / 2, 174, {
    align: 'center',
  });

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text(user.fullName || user.email, w / 2, 214, { align: 'center' });

  doc.setFont('courier', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(52, 211, 153);
  doc.text(`@${user.handle}  •  ${user.email}`, w / 2, 238, { align: 'center' });

  const totalProfitClaimed = investments.reduce((s, i) => s + Number(i.claimedProfit || 0), 0);
  const totalReferralEarned = commissions.reduce((s, c) => s + Number(c.commissionUsd || 0), 0);
  const totalPaidOut = withdrawals
    .filter((wd) => wd.status === 'approved' || wd.status === 'completed')
    .reduce((s, wd) => s + Number(wd.amountUsd || 0), 0);

  const cards = [
    { label: 'ACTIVE & TOTAL INVESTED', val: money(user.totalInvested) },
    { label: 'VERIFIED CLAIMED PROFIT', val: money(totalProfitClaimed) },
    { label: 'REFERRAL COMMISSIONS', val: money(totalReferralEarned) },
    { label: 'COMPLETED PAYOUTS', val: money(totalPaidOut) },
  ];

  const cardW = 172;
  const gap = 16;
  const totalRowW = cards.length * cardW + (cards.length - 1) * gap;
  const startX = (w - totalRowW) / 2;
  const cardY = 278;

  cards.forEach((c, idx) => {
    const cx = startX + idx * (cardW + gap);
    doc.setFillColor(18, 28, 48);
    doc.setDrawColor(51, 65, 85);
    doc.roundedRect(cx, cardY, cardW, 78, 8, 8, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(c.label, cx + cardW / 2, cardY + 26, { align: 'center' });
    doc.setFontSize(17);
    doc.setTextColor(245, 198, 92);
    doc.text(c.val, cx + cardW / 2, cardY + 54, { align: 'center' });
  });

  const certId = makeLegacyCertHash(user.uid);
  doc.setDrawColor(71, 85, 105);
  doc.line(90, h - 125, 290, h - 125);
  doc.line(w - 290, h - 125, w - 90, h - 125);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(226, 232, 240);
  doc.text(`${companyName} Treasury Desk`, 190, h - 108, { align: 'center' });
  doc.text(`Certificate ID: ${certId}`, w - 190, h - 108, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Issued: ${new Date().toISOString().slice(0, 10)} UTC`, 190, h - 92, { align: 'center' });
  doc.text(`KYC Status: ${user.kycStatus.toUpperCase()}`, w - 190, h - 92, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Informational statement reflecting actual recorded platform ledger data. Trading involves risk; no future returns are guaranteed.',
    w / 2,
    h - 52,
    { align: 'center' }
  );

  const fileDate = new Date().toISOString().slice(0, 10);
  doc.save(`${companyName.replace(/\s+/g, '-')}-Portfolio-Certificate-${fileDate}.pdf`);
}
