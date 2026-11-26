import { jsPDF } from 'jspdf';
import {
  CryptoDeposit,
  Investment,
  MlmCommission,
  UserProfile,
  Withdrawal,
} from '../types/platform';
import { formatTimestamp } from './investmentMath';

function money(val: number): string {
  return `$${Number(val || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function makeDocHash(uid: string, salt: string): string {
  const raw = `${uid}:${salt}:${new Date().toISOString().slice(0, 10)}`;
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `ATX-${(hash >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
}

/**
 * Generates and downloads a crisp monthly / all-time Account Statement PDF using jsPDF.
 */
export function downloadAccountStatementPdf(params: {
  companyName: string;
  user: UserProfile;
  deposits: CryptoDeposit[];
  withdrawals: Withdrawal[];
  investments: Investment[];
  commissions: MlmCommission[];
  monthFilter?: string; // 'ALL' or 'YYYY-MM'
}): void {
  const { companyName, user, deposits, withdrawals, investments, commissions } = params;
  const periodLabel =
    params.monthFilter && params.monthFilter !== 'ALL'
      ? `Monthly Period: ${params.monthFilter}`
      : 'All-Time Vault Account Statement';

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Header Dark Navy Banner
  doc.setFillColor(11, 17, 30);
  doc.rect(0, 0, pageW, 104, 'F');
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 100, pageW, 4, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(companyName.toUpperCase(), 40, 44);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text('INSTITUTIONAL CLIENT ACCOUNT STATEMENT', 40, 62);
  doc.text(periodLabel, 40, 78);

  const verifyCode = makeDocHash(user.uid, 'STATEMENT');
  doc.setTextColor(52, 211, 153);
  doc.setFont('courier', 'bold');
  doc.setFontSize(9.5);
  doc.text(`VERIFICATION ID: ${verifyCode}`, pageW - 40, 44, { align: 'right' });
  doc.setTextColor(203, 213, 225);
  doc.setFont('helvetica', 'normal');
  doc.text(`Issued: ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC`, pageW - 40, 62, {
    align: 'right',
  });
  doc.text(`KYC Status: ${user.kycStatus.toUpperCase()}`, pageW - 40, 78, { align: 'right' });

  // Client Info Box
  let y = 126;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(40, y, pageW - 80, 62, 6, 6, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(user.fullName || 'Client Account', 54, y + 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Email: ${user.email}`, 54, y + 38);
  doc.text(`Handle / Referral Code: @${user.handle}`, 54, y + 52);

  doc.text(`Client UID: ${user.uid.slice(0, 20)}...`, pageW - 54, y + 38, { align: 'right' });
  doc.text(`Mentor Status: ${user.isMentor ? 'ACTIVE MENTOR' : 'STANDARD CLIENT'}`, pageW - 54, y + 52, {
    align: 'right',
  });

  // Summary KPI Grid (4 Boxes)
  y += 80;
  const totalDepositedApproved = deposits
    .filter((d) => d.status === 'approved')
    .reduce((s, d) => s + Number(d.amountUsd || 0), 0);
  const totalClaimedProfit = investments.reduce((s, i) => s + Number(i.claimedProfit || 0), 0);
  const totalCommissions = commissions.reduce((s, c) => s + Number(c.commissionUsd || 0), 0);
  const totalWithdrawnPaid = withdrawals
    .filter((w) => w.status === 'approved' || w.status === 'completed')
    .reduce((s, w) => s + Number(w.amountUsd || 0), 0);

  const kpis = [
    { label: 'DEPOSIT WALLET', value: money(user.usdBalance) },
    { label: 'INCOME WALLET', value: money(user.profitBalance) },
    { label: 'TOTAL DEPOSITED', value: money(totalDepositedApproved) },
    { label: 'TOTAL WITHDRAWN', value: money(totalWithdrawnPaid) },
  ];
  const boxW = (pageW - 80 - 24) / 4;
  kpis.forEach((k, idx) => {
    const bx = 40 + idx * (boxW + 8);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(bx, y, boxW, 48, 5, 5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(k.label, bx + 10, y + 17);
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(k.value, bx + 10, y + 36);
  });

  y += 64;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Active Packages: ${investments.length}   |   Total Claimed Profit: ${money(
      totalClaimedProfit
    )}   |   Referral Commissions: ${money(totalCommissions)}`,
    40,
    y
  );

  // Helper to check page overflow
  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 60) {
      doc.addPage();
      y = 48;
    }
  };

  // Deposits Section
  y += 24;
  ensureSpace(90);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(11, 17, 30);
  doc.text(`Recent Deposits (${deposits.length})`, 40, y);
  y += 12;

  doc.setFillColor(241, 245, 249);
  doc.rect(40, y, pageW - 80, 18, 'F');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('DATE', 46, y + 12);
  doc.text('NETWORK', 175, y + 12);
  doc.text('TX REFERENCE', 260, y + 12);
  doc.text('STATUS', 420, y + 12);
  doc.text('AMOUNT', pageW - 46, y + 12, { align: 'right' });
  y += 22;

  const recentDeposits = deposits.slice(0, 12);
  if (recentDeposits.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('No deposit records found for this period.', 46, y + 8);
    y += 20;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    recentDeposits.forEach((d) => {
      ensureSpace(18);
      doc.setTextColor(15, 23, 42);
      doc.text(formatTimestamp(d.createdAt).slice(0, 20), 46, y + 10);
      doc.text(String(d.network || 'USDT').slice(0, 14), 175, y + 10);
      doc.setFont('courier', 'normal');
      doc.text(String(d.txId || '—').slice(0, 24), 260, y + 10);
      doc.setFont('helvetica', 'bold');
      doc.text(String(d.status || '').toUpperCase(), 420, y + 10);
      doc.text(money(d.amountUsd), pageW - 46, y + 10, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setDrawColor(241, 245, 249);
      doc.line(40, y + 15, pageW - 40, y + 15);
      y += 18;
    });
  }

  // Withdrawals Section
  y += 16;
  ensureSpace(90);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(11, 17, 30);
  doc.text(`Recent Withdrawals (${withdrawals.length})`, 40, y);
  y += 12;

  doc.setFillColor(241, 245, 249);
  doc.rect(40, y, pageW - 80, 18, 'F');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('DATE', 46, y + 12);
  doc.text('NETWORK', 175, y + 12);
  doc.text('DESTINATION / TX', 255, y + 12);
  doc.text('STATUS', 420, y + 12);
  doc.text('AMOUNT', pageW - 46, y + 12, { align: 'right' });
  y += 22;

  const recentWithdrawals = withdrawals.slice(0, 12);
  if (recentWithdrawals.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('No withdrawal records found for this period.', 46, y + 8);
    y += 20;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    recentWithdrawals.forEach((w) => {
      ensureSpace(18);
      doc.setTextColor(15, 23, 42);
      doc.text(formatTimestamp(w.createdAt).slice(0, 20), 46, y + 10);
      doc.text(String(w.network || 'USDT').slice(0, 14), 175, y + 10);
      doc.setFont('courier', 'normal');
      const refStr = w.payoutTxHash ? `TX:${w.payoutTxHash.slice(0, 18)}` : w.destinationAddress.slice(0, 22);
      doc.text(refStr, 255, y + 10);
      doc.setFont('helvetica', 'bold');
      doc.text(String(w.status || '').toUpperCase(), 420, y + 10);
      doc.text(money(w.amountUsd), pageW - 46, y + 10, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setDrawColor(241, 245, 249);
      doc.line(40, y + 15, pageW - 40, y + 15);
      y += 18;
    });
  }

  // Footer Disclaimer
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Generated automatically by ${companyName} Vault Ledger. Digital asset trading carries market risk; past performance does not guarantee future results.`,
    40,
    pageH - 28
  );

  const fileDate = new Date().toISOString().slice(0, 10);
  doc.save(`${companyName.replace(/\s+/g, '-')}-Account-Statement-${fileDate}.pdf`);
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

  // Verified Ledger Figures (Strictly derived from actual account ledger — zero fabricated claims)
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

  // Footer Signature & Verification Code
  const certId = makeDocHash(user.uid, 'CERTIFICATE');
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
