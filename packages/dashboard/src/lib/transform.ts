import type { DataPoint, Row } from "@gasstart/shared";

/** Coerces raw sheet rows into typed DataPoints, dropping rows that don't fit. */
export function toDataPoints(rows: Row[]): DataPoint[] {
  const out: DataPoint[] = [];
  for (const r of rows) {
    const date = String(r.date ?? "").slice(0, 10);
    const category = String(r.category ?? "").trim();
    const value = Number(r.value);
    if (!date || !category || !Number.isFinite(value)) continue;
    out.push({ date, category, value });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Categories in first-seen order — the order that assigns series colours. Never re-sorted. */
export function categoriesOf(points: DataPoint[]): string[] {
  const seen: string[] = [];
  for (const p of points) if (!seen.includes(p.category)) seen.push(p.category);
  return seen;
}

export type SeriesRow = { date: string } & Record<string, number | string>;

/** Pivot: one row per date, one column per category (for the line chart). */
export function pivotByDate(points: DataPoint[], categories: string[]): SeriesRow[] {
  const byDate = new Map<string, SeriesRow>();
  for (const p of points) {
    let row = byDate.get(p.date);
    if (!row) {
      row = { date: p.date };
      for (const c of categories) row[c] = 0;
      byDate.set(p.date, row);
    }
    row[p.category] = (Number(row[p.category]) || 0) + p.value;
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export interface Kpis {
  total: number;
  dailyAverage: number;
  days: number;
  categories: number;
  latestDate: string | null;
  /** % change of the last 7 days vs the 7 days before; null when not enough data. */
  weekOverWeek: number | null;
}

export function computeKpis(points: DataPoint[], categories: string[]): Kpis {
  const total = points.reduce((s, p) => s + p.value, 0);
  const dates = [...new Set(points.map((p) => p.date))].sort();
  const days = dates.length;

  let weekOverWeek: number | null = null;
  if (days >= 14) {
    const last7 = new Set(dates.slice(-7));
    const prev7 = new Set(dates.slice(-14, -7));
    const sum = (set: Set<string>) => points.filter((p) => set.has(p.date)).reduce((s, p) => s + p.value, 0);
    const a = sum(last7);
    const b = sum(prev7);
    weekOverWeek = b === 0 ? null : ((a - b) / b) * 100;
  }

  return {
    total,
    dailyAverage: days ? total / days : 0,
    days,
    categories: categories.length,
    latestDate: dates.at(-1) ?? null,
    weekOverWeek,
  };
}

const numberFormat = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });
export const fmtNumber = (n: number): string => numberFormat.format(n);
export const fmtPercent = (n: number): string => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
