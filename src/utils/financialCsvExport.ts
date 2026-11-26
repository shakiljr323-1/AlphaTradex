import { CryptoDeposit, MlmCommission, UserProfile, Withdrawal } from '../types/platform';
import { formatTimestamp } from './investmentMath';

/**
 * Neutralizes spreadsheet formula injection (CSV/Excel DDE & formula cells starting with =, +, -, @, \t, \r)
 * while preserving signed numeric fields when passed as pure numbers.
 */
function neutralizeFormulaString(raw: string): string {
  const s = String(raw ?? '').replace(/\r?\n/g, ' ').trim();
  if (/^[=+\-@\t\r]/.test(s)) {
    return `'${s}`;
  }
  return s;
}

function escapeCsvCell(val: unknown): string {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return String(val);
  }
  const safe = neutralizeFormulaString(String(val ?? ''));
  if (/[",\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function escapeXml(val: string): string {
  return val
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadCsvFile(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number>>
): void {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((r) => r.map(escapeCsvCell).join(',')),
  ];
  // UTF-8 BOM ensures Excel opens UTF-8 text cleanly
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  triggerBlobDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

export interface ExcelWorksheetSpec {
  name: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}

/**
 * Generates an Excel 2003 SpreadsheetML (.xls) multi-worksheet accounting workbook
 * readable directly by Microsoft Excel, LibreOffice Calc, and Google Sheets with zero extra dependencies.
 */
export function downloadExcelWorkbook(
  filename: string,
  sheets: ExcelWorksheetSpec[]
): void {
  const worksheetsXml = sheets
    .map((sheet) => {
      const safeName = escapeXml(
        sheet.name.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Sheet'
      );
      const headerCells = sheet.headers
        .map(
          (h) =>
            `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(
              neutralizeFormulaString(h)
            )}</Data></Cell>`
        )
        .join('');
      const dataRows = sheet.rows
        .map((row) => {
          const cells = row
            .map((cell) => {
              if (typeof cell === 'number' && Number.isFinite(cell)) {
                return `<Cell><Data ss:Type="Number">${cell}</Data></Cell>`;
              }
              return `<Cell><Data ss:Type="String">${escapeXml(
                neutralizeFormulaString(String(cell ?? ''))
              )}</Data></Cell>`;
            })
            .join('');
          return `<Row>${cells}</Row>`;
        })
        .join('');

      return `<Worksheet ss:Name="${safeName}"><Table><Row>${headerCells}</Row>${dataRows}</Table></Worksheet>`;
    })
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 ${worksheetsXml}
</Workbook>`;

  const blob = new Blob([xml], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  triggerBlobDownload(blob, filename.endsWith('.xls') ? filename : `${filename}.xls`);
}

export function buildDepositsSheet(deposits: CryptoDeposit[]): ExcelWorksheetSpec {
  return {
    name: 'Deposits',
    headers: [
      'Deposit ID',
      'Date (UTC)',
      'User Name',
      'User Email',
      'Network',
      'Amount (USD)',
      'Status',
      'Verification Source',
      'TX Hash / ID',
      'Receiving Wallet',
      'Admin Note',
    ],
    rows: deposits.map((d) => [
      d.id,
      formatTimestamp(d.createdAt),
      d.userName || '',
      d.userEmail || '',
      d.network || '',
      Number((Number(d.amountUsd) || 0).toFixed(2)),
      d.status,
      d.verificationSource || 'manual',
      d.txId || '',
      d.walletAddress || '',
      d.adminNote || '',
    ]),
  };
}

export function buildWithdrawalsSheet(withdrawals: Withdrawal[]): ExcelWorksheetSpec {
  return {
    name: 'Withdrawals & Payouts',
    headers: [
      'Withdrawal ID',
      'Date (UTC)',
      'User Name',
      'User Email',
      'Type',
      'Source',
      'Gross Amount (USD)',
      'Fee (USD)',
      'Promo Discount (USD)',
      'Promo Code',
      'Net Payout (USD)',
      'Network',
      'Destination Address',
      'Status',
      'Payout TX Hash',
      'Reviewed By',
      'Admin Note',
    ],
    rows: withdrawals.map((w) => {
      const gross = Number(w.amountUsd) || 0;
      const fee = Number(w.feeUsd) || 0;
      const discount = Number(w.feeDiscountUsd) || 0;
      const net = w.netPayoutUsd !== undefined ? Number(w.netPayoutUsd) : Math.max(0, gross - fee);
      return [
        w.id,
        formatTimestamp(w.createdAt),
        w.userName || '',
        w.userEmail || '',
        w.type,
        w.source,
        Number(gross.toFixed(2)),
        Number(fee.toFixed(2)),
        Number(discount.toFixed(2)),
        w.promoCode || '',
        Number(net.toFixed(2)),
        w.network || '',
        w.destinationAddress || '',
        w.status,
        w.payoutTxHash || '',
        w.reviewedByEmail || '',
        w.adminNote || '',
      ];
    }),
  };
}

export function buildCommissionsSheet(
  commissions: MlmCommission[],
  userLookup: Map<string, UserProfile>
): ExcelWorksheetSpec {
  return {
    name: 'Referral Commissions',
    headers: [
      'Commission ID',
      'Date (UTC)',
      'Beneficiary Name',
      'Beneficiary Email',
      'From Investor',
      'Commission Type',
      'Tier Level',
      'Investment Amount (USD)',
      'Rate (%)',
      'Commission (USD)',
    ],
    rows: commissions.map((c) => {
      const ben = userLookup.get(c.beneficiaryUid);
      return [
        c.id,
        formatTimestamp(c.createdAt),
        ben?.fullName || c.beneficiaryUid,
        ben?.email || '',
        c.fromName || c.fromUid,
        c.commissionType || 'referral',
        c.level,
        Number((Number(c.investmentAmount) || 0).toFixed(2)),
        Number((Number(c.ratePercent) || 0).toFixed(2)),
        Number((Number(c.commissionUsd) || 0).toFixed(2)),
      ];
    }),
  };
}

export function buildUserBalancesSheet(users: UserProfile[]): ExcelWorksheetSpec {
  return {
    name: 'User Balances',
    headers: [
      'UID',
      'Full Name',
      'Email',
      'Handle',
      'Role',
      'KYC Status',
      'Account Status',
      'Deposit Wallet (USD)',
      'Income Wallet (USD)',
      'Combined Liquidity (USD)',
      'Total Invested (USD)',
      'Total Withdrawn (USD)',
      'Mentor Status',
      'Joined Date',
    ],
    rows: users.map((u) => {
      const depBal = Number(u.usdBalance) || 0;
      const profBal = Number(u.profitBalance) || 0;
      return [
        u.uid,
        u.fullName || '',
        u.email || '',
        u.handle || '',
        u.role,
        u.kycStatus,
        u.suspended ? 'Suspended' : 'Active',
        Number(depBal.toFixed(2)),
        Number(profBal.toFixed(2)),
        Number((depBal + profBal).toFixed(2)),
        Number((Number(u.totalInvested) || 0).toFixed(2)),
        Number((Number(u.totalWithdrawn) || 0).toFixed(2)),
        u.isMentor ? 'Mentor' : 'Standard',
        formatTimestamp(u.createdAt),
      ];
    }),
  };
}
