import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseAreaMeasurement(val: string): number | null {
  if (!val) return null;
  const cleaned = val.trim().toLowerCase();
  if (!cleaned) return null;
  const dimMatch = cleaned.match(/^([\d.]+)\s*[xX*]\s*([\d.]+)/);
  if (dimMatch) {
    const w = parseFloat(dimMatch[1]);
    const h = parseFloat(dimMatch[2]);
    if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
      return w * h;
    }
  }
  const num = parseFloat(cleaned);
  if (!isNaN(num) && num > 0) {
    return num;
  }
  return null;
}

export function computeRatesFromArea(areaStr: string) {
  const area = parseAreaMeasurement(areaStr);
  if (!area) {
    return { rate2026: "", rate2027: "", rate2028: "", area: null };
  }
  const rate2026Val = area * 10 * 30;
  const rate2027Val = area * 12 * 30;
  const rate2028Val = area * 15 * 30;

  const formatRate = (val: number) => {
    const rounded = Math.round(val * 100) / 100;
    return String(rounded);
  };

  return {
    rate2026: formatRate(rate2026Val),
    rate2027: formatRate(rate2027Val),
    rate2028: formatRate(rate2028Val),
    area,
  };
}

export const PAYMENT_DUE_DAY = 20; // Due date is every 20th of the month
export const PENALTY_RATE = 0.25; // 25% late payment penalty

export function isMonthOverdue(month: number, year: number, isBolante: boolean = false): boolean {
  if (isBolante) return false;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  if (year < currentYear) return true;
  if (year > currentYear) return false;
  if (month < currentMonth) return true;
  if (month === currentMonth && currentDay > PAYMENT_DUE_DAY) return true;
  return false;
}

export function computeMonthPenalty(params: {
  month: number;
  year: number;
  baseFee: number;
  paidAmount: number;
  isBolante?: boolean;
}): {
  isOverdue: boolean;
  baseDue: number;
  penalty: number;
  totalDue: number;
  balance: number;
} {
  const { month, year, baseFee, paidAmount, isBolante = false } = params;
  if (isBolante || baseFee <= 0) {
    return {
      isOverdue: false,
      baseDue: baseFee,
      penalty: 0,
      totalDue: baseFee,
      balance: Math.max(0, baseFee - paidAmount),
    };
  }

  const isOverdue = isMonthOverdue(month, year, false);
  const unpaidBase = Math.max(0, baseFee - paidAmount);
  const penalty = isOverdue && unpaidBase > 0 ? Math.round(unpaidBase * PENALTY_RATE * 100) / 100 : 0;
  const totalDue = baseFee + penalty;
  const balance = Math.max(0, totalDue - paidAmount);

  return {
    isOverdue,
    baseDue: baseFee,
    penalty,
    totalDue,
    balance,
  };
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export interface MonthStatementRow {
  month: string;
  monthNum: number;
  baseDue: number;
  penalty: number;
  totalDue: number;
  paid: number;
  balance: number;
  isFully: boolean;
  isPartial: boolean;
  isAdvance: boolean;
  isFuture: boolean;
  isOverdue: boolean;
}

export function calculateMonthlyStatement(params: {
  year: number;
  getMonthFee: (month: number) => number;
  payments: Array<{ period_month?: number | null; period_year?: number | null; amount: number | string; status?: string; created_at?: string }>;
  isBolante?: boolean;
}): {
  rows: MonthStatementRow[];
  totalPaid: number;
  totalOutstanding: number;
  monthsPaid: number;
  displayPaidMap: Record<number, number>;
  effectiveMap: Record<number, number>;
  rawPaidMap: Record<number, number>;
} {
  const { year, getMonthFee, payments, isBolante = false } = params;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = year === currentYear ? now.getMonth() + 1 : (year < currentYear ? 12 : 0);

  // 1. Sort all confirmed payments for this year chronologically
  const confirmedPayments = (payments || [])
    .filter((p: any) => p.status === "completed" && (p.period_year ? p.period_year === year : true))
    .sort((a: any, b: any) => {
      const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tA - tB;
    });

  const rawPaidMap: Record<number, number> = {};
  confirmedPayments.forEach((p: any) => {
    if (p.period_month && p.period_month >= 1 && p.period_month <= 12) {
      rawPaidMap[p.period_month] = (rawPaidMap[p.period_month] || 0) + Number(p.amount);
    }
  });

  const totalPaid = confirmedPayments.reduce((s: number, p: any) => s + Number(p.amount), 0);

  // 2. Initialize the 12 month ledger accounts
  interface MonthAccount {
    monthName: string;
    monthNum: number;
    baseFee: number;
    penalty: number;
    totalDue: number;
    paid: number;
    isOverdue: boolean;
    penaltyLocked: boolean;
  }

  const accounts: MonthAccount[] = [];
  for (let m = 1; m <= 12; m++) {
    const baseFee = isBolante ? 0 : getMonthFee(m);
    const isOverdue = isMonthOverdue(m, year, isBolante);
    accounts.push({
      monthName: MONTH_NAMES[m - 1],
      monthNum: m,
      baseFee,
      penalty: 0,
      totalDue: baseFee,
      paid: 0,
      isOverdue,
      penaltyLocked: false,
    });
  }

  // 3. Process each payment transaction sequentially into the ledger
  for (const p of confirmedPayments) {
    let pAmount = Number(p.amount) || 0;
    if (pAmount <= 0) continue;

    for (let m = 1; m <= 12 && pAmount > 0; m++) {
      const acc = accounts[m - 1];

      if (isBolante || acc.baseFee <= 0) {
        acc.paid += pAmount;
        pAmount = 0;
        break;
      }

      if (acc.isOverdue) {
        if (!acc.penaltyLocked) {
          const fullPenalty = Math.round(acc.baseFee * PENALTY_RATE * 100) / 100;
          const fullRequired = acc.baseFee + fullPenalty;
          const neededToFull = fullRequired - acc.paid;

          if (pAmount >= neededToFull) {
            acc.penalty = fullPenalty;
            acc.totalDue = fullRequired;
            acc.paid += neededToFull;
            pAmount -= neededToFull;
            acc.penaltyLocked = true;
          } else {
            acc.paid += pAmount;
            pAmount = 0;
            const unpaidBase = Math.max(0, acc.baseFee - acc.paid);
            acc.penalty = unpaidBase > 0 ? Math.round(unpaidBase * PENALTY_RATE * 100) / 100 : 0;
            acc.totalDue = acc.baseFee + acc.penalty;
            acc.penaltyLocked = true;
          }
        } else {
          const remainingDue = Math.max(0, acc.totalDue - acc.paid);
          if (remainingDue > 0) {
            const payThis = Math.min(pAmount, remainingDue);
            acc.paid += payThis;
            pAmount -= payThis;
          }
        }
      } else {
        const remainingDue = Math.max(0, acc.baseFee - acc.paid);
        if (remainingDue > 0) {
          const payThis = Math.min(pAmount, remainingDue);
          acc.paid += payThis;
          pAmount -= payThis;
        }
      }
    }

    if (pAmount > 0) {
      accounts[11].paid += pAmount;
      pAmount = 0;
    }
  }

  // 4. Construct final statement rows
  const rows: MonthStatementRow[] = accounts.map(acc => {
    const balance = isBolante ? 0 : Math.max(0, acc.totalDue - acc.paid);
    const isAdvance = !isBolante && acc.monthNum > currentMonth && acc.paid >= acc.totalDue && acc.totalDue > 0;
    const isFuture = !isBolante && acc.monthNum > currentMonth && acc.paid === 0;
    const isFully = !isBolante && acc.paid >= acc.totalDue && acc.totalDue > 0 && !isAdvance;
    const isPartial = !isBolante && acc.paid > 0 && acc.paid < acc.totalDue;

    return {
      month: acc.monthName,
      monthNum: acc.monthNum,
      baseDue: acc.baseFee,
      penalty: acc.penalty,
      totalDue: acc.totalDue,
      paid: acc.paid,
      balance,
      isFully,
      isPartial,
      isAdvance,
      isFuture,
      isOverdue: acc.isOverdue,
    };
  });

  const displayPaidMap: Record<number, number> = {};
  const effectiveMap: Record<number, number> = {};
  rows.forEach(r => {
    displayPaidMap[r.monthNum] = r.paid;
    effectiveMap[r.monthNum] = r.paid;
  });

  const totalOutstanding = isBolante ? 0 : rows.reduce((sum, r) => {
    if (r.monthNum > currentMonth && r.balance === r.baseDue) return sum;
    return sum + r.balance;
  }, 0);

  const monthsPaid = isBolante ? 0 : rows.filter(r => r.isFully || r.isAdvance).length;

  return {
    rows,
    totalPaid,
    totalOutstanding,
    monthsPaid,
    displayPaidMap,
    effectiveMap,
    rawPaidMap,
  };
}

