/**
 * Contract between the Apps Script backend (packages/gas) and the dashboard
 * (packages/dashboard). Keep this file free of runtime dependencies — it is
 * imported by both sides and only types/constants should live here.
 */

/** Name of the worksheet (tab) the Python ETL writes and the dashboard reads. */
export const SHEET_DATA = "data";

/** Script Property key holding the spreadsheet id for standalone scripts. */
export const PROP_SPREADSHEET_ID = "SPREADSHEET_ID";

/** A cell value after JSON serialisation through google.script.run. */
export type Cell = string | number | boolean | null;

/** One spreadsheet row keyed by the header row. */
export type Row = Record<string, Cell>;

/** Shape of the sample dataset produced by `gasstart-sheets seed`. */
export interface DataPoint {
  date: string; // ISO date, YYYY-MM-DD
  category: string;
  value: number;
}

/** Payload returned by the `getDashboardData` server function. */
export interface DashboardData {
  spreadsheetName: string;
  spreadsheetUrl: string;
  sheetName: string;
  updatedAt: string; // ISO timestamp of when the server read the sheet
  rows: Row[];
}

/** Result of `seedSampleData`. */
export interface SeedResult {
  sheetName: string;
  rows: number;
}

/** Server functions callable through google.script.run, with their signatures. */
export interface ServerApi {
  getDashboardData: () => DashboardData;
  seedSampleData: () => SeedResult;
  ping: () => string;
}
