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

