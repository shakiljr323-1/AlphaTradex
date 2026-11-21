import { Investment } from '../types/platform';

export interface InvestmentScheduleMetrics {
  completedProfitDays: number;
  remainingProfitDays: number;
  calendarDaysElapsed: number;
  estimatedCompletionDate: Date;
  estimatedCompletionLabel: string;
  isWeekendRest: boolean;
  dayScheduleStatus: 'Active Earning (Mon–Fri)' | 'Weekend Rest (Sat–Sun)' | 'Platform Paused' | 'Completed (200/200)';
  dailyDollarTarget: number;
  totalProfitGenerated: number;
  unclaimedProfit: number;
  isCapitalUnlockEligible: boolean;
  daysRemainingForCapital: number;
  capitalUnlockDateLabel: string;
  progressPercent: number;
}

const MS_PER_DAY = 86_400_000;

export function isWeekendDate(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Counts completed Mon-Fri profit days after startedAtMs up to nowMs,
 * capped at totalProfitDays (default 200).
 */
export function countWeekdaysBetween(startMs: number, endMs: number, maxProfitDays: number): number {
  if (endMs <= startMs) return 0;
  const start = new Date(startMs);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endMs);
  end.setHours(0, 0, 0, 0);

  let count = 0;
  const cursor = new Date(start.getTime() + MS_PER_DAY);
  while (cursor.getTime() <= end.getTime() && count < maxProfitDays) {
    if (!isWeekendDate(cursor)) {
      count += 1;
    }
    cursor.setTime(cursor.getTime() + MS_PER_DAY);
  }
  return count;
}

/**
 * Estimates completion date by advancing Mon-Fri days until totalProfitDays are reached (~280 calendar days for 200 profit days).
 */
export function estimateCompletionDate(startMs: number, totalProfitDays: number): Date {
  const cursor = new Date(startMs);
  cursor.setHours(12, 0, 0, 0);
  let counted = 0;
  while (counted < totalProfitDays) {
    cursor.setTime(cursor.getTime() + MS_PER_DAY);
    if (!isWeekendDate(cursor)) {
      counted += 1;
    }
  }
  return cursor;
}

export function computeInvestmentMetrics(
  investment: Investment,
  globalPaused: boolean,
  nowMs: number = Date.now()
): InvestmentScheduleMetrics {
  const totalProfitDays = investment.totalProfitDays || 200;
  const completedProfitDays = countWeekdaysBetween(investment.startedAtMs, nowMs, totalProfitDays);
  const remainingProfitDays = Math.max(0, totalProfitDays - completedProfitDays);
  const calendarDaysElapsed = Math.max(0, Math.floor((nowMs - investment.startedAtMs) / MS_PER_DAY));
  const estDate = estimateCompletionDate(investment.startedAtMs, totalProfitDays);

  const nowDate = new Date(nowMs);
  const weekend = isWeekendDate(nowDate);

  let dayScheduleStatus: InvestmentScheduleMetrics['dayScheduleStatus'] = 'Active Earning (Mon–Fri)';
  if (completedProfitDays >= totalProfitDays || investment.status === 'completed') {
    dayScheduleStatus = 'Completed (200/200)';
  } else if (globalPaused) {
    dayScheduleStatus = 'Platform Paused';
  } else if (weekend) {
    dayScheduleStatus = 'Weekend Rest (Sat–Sun)';
  }

  const dailyDollarTarget = Number(((investment.capital * investment.dailyPercent) / 100).toFixed(2));
  const totalProfitGenerated = Number((completedProfitDays * dailyDollarTarget).toFixed(2));
  const unclaimedProfit = Math.max(0, Number((totalProfitGenerated - (investment.claimedProfit || 0)).toFixed(2)));

  const lockDays = investment.capitalLockDays || totalProfitDays;
  const daysRemainingForCapital = Math.max(0, lockDays - calendarDaysElapsed);
  const isCapitalUnlockEligible = calendarDaysElapsed >= lockDays && !investment.isMentorGifted;
  const unlockDate = new Date(investment.startedAtMs + lockDays * MS_PER_DAY);

  return {
    completedProfitDays,
    remainingProfitDays,
    calendarDaysElapsed,
    estimatedCompletionDate: estDate,
    estimatedCompletionLabel: estDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }),
    isWeekendRest: weekend,
    dayScheduleStatus,
    dailyDollarTarget,
    totalProfitGenerated,
    unclaimedProfit,
    isCapitalUnlockEligible,
    daysRemainingForCapital,
    capitalUnlockDateLabel: unlockDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }),
    progressPercent: Math.min(100, Math.round((completedProfitDays / totalProfitDays) * 100))
  };
}

export function formatTimestamp(value: unknown, fallbackMs?: number): string {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    const d = (value as { toDate: () => Date }).toDate();
    return formatDateSqlStyle(d);
  }
  if (typeof fallbackMs === 'number' && fallbackMs > 0) {
    return formatDateSqlStyle(new Date(fallbackMs));
  }
  return formatDateSqlStyle(new Date());
}

export function formatDateSqlStyle(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function generateHandleFromUid(uid: string): string {
  const clean = uid.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
  return `VTV${clean || 'CLIENT'}`;
}

export async function sha256Hex(input: string): Promise<string> {
  const normalized = input.trim().toLowerCase();
  const data = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function compressImageToDataUrl(file: File, maxDim = 480, quality = 0.68): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format'));
      img.onload = () => {
        const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
        const w = Math.max(1, Math.round(img.width * ratio));
        const h = Math.max(1, Math.round(img.height * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
