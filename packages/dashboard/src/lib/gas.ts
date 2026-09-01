import type { DashboardData, SeedResult, ServerApi } from "@gasstart/shared";
import mock from "../mock/data.json";

/** True when the page is served by Apps Script (google.script.run is injected). */
export const isGas = typeof google !== "undefined" && !!google?.script?.run;

/**
 * Promise wrapper around google.script.run.
 *
 *   const data = await runGas("getDashboardData");
 *
 * Function names and return types come from ServerApi in @gasstart/shared, so
 * a typo or a signature change is a compile error on both sides.
 */
export function runGas<K extends keyof ServerApi>(
  fn: K,
  ...args: Parameters<ServerApi[K]>
): Promise<ReturnType<ServerApi[K]>> {
  if (!isGas) {
    return Promise.reject(new Error(`google.script.run is not available (not running inside Apps Script); cannot call ${fn}`));
  }
  return new Promise((resolve, reject) => {
    const runner = google!.script.run
      .withSuccessHandler((value) => resolve(value as ReturnType<ServerApi[K]>))
      .withFailureHandler((error) => reject(error instanceof Error ? error : new Error(String(error))));
    (runner[fn] as (...a: unknown[]) => void)(...args);
  });
}

/**
 * Loads dashboard data from the server, or from the bundled mock during local
 * development (`npm run dev`) so the UI can be built without deploying.
 */
export async function loadDashboardData(): Promise<{ data: DashboardData; source: "gas" | "mock" }> {
  if (isGas) {
    return { data: await runGas("getDashboardData"), source: "gas" };
  }
  await new Promise((r) => setTimeout(r, 300)); // simulate latency
  // http://localhost:5173/?empty previews the welcome screen shown right after `npm run setup`.
  const empty = new URLSearchParams(window.location.search).has("empty");
  const data = empty ? { ...(mock as DashboardData), rows: [] } : (mock as DashboardData);
  return { data, source: "mock" };
}

/** Asks the server to fill the `data` sheet with demo rows. No-op in local mock mode. */
export async function seedSampleData(): Promise<SeedResult> {
  if (isGas) return runGas("seedSampleData");
  return { sheetName: mock.sheetName, rows: mock.rows.length };
}
