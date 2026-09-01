import type { Row } from "@gasstart/shared";

/**
 * Deterministic demo dataset — same shape (date, category, value) and the same
 * generator as python/src/gasstart_sheets/sample.py and the dashboard mock, so
 * every entry point shows comparable numbers.
 */
const CATEGORIES: Array<[name: string, base: number]> = [
  ["Web", 120],
  ["Mobile", 90],
  ["Store", 60],
];

export function sampleRows(days = 90, end: Date = new Date(), seed = 42): Row[] {
  const rand = lcg(seed);
  const rows: Row[] = [];
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  for (let d = 0; d < days; d++) {
    const day = new Date(endUtc - (days - 1 - d) * 86_400_000);
    const date = day.toISOString().slice(0, 10);
    const weekend = day.getUTCDay() === 0 || day.getUTCDay() === 6 ? 0.7 : 1;
    const trend = 1 + (d / days) * 0.35;
    for (const [category, base] of CATEGORIES) {
      const value = Math.round(base * trend * weekend * (0.85 + rand() * 0.3));
      rows.push({ date, category, value });
    }
  }
  return rows;
}

/** Small linear congruential generator so the demo data is stable across runs. */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    return (state & 0x7fffffff) / 0x7fffffff;
  };
}
