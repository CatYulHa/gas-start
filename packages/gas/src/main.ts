/**
 * Apps Script entry points. Every exported function here becomes a global in
 * dist/Code.js (the @gas-plugin/unplugin strips the `export` keyword) and can be
 * called by Apps Script (doGet, triggers) or by the dashboard via google.script.run.
 *
 * Adding a function the dashboard can call:
 *   1. export it here
 *   2. add its signature to ServerApi in packages/shared/src/index.ts
 *   3. add its name to `globals` in vite.config.ts (protects it from tree-shaking)
 */
import { SHEET_DATA, type DashboardData, type SeedResult } from "@gasstart/shared";
import { getSpreadsheet, setSpreadsheetId } from "./config";
import { sampleRows } from "./sample";
import { readTable, writeTable } from "./sheets";

/** Web app entry: serves the Vite-built single-file dashboard (dist/index.html). */
export function doGet(): GoogleAppsScript.HTML.HtmlOutput {
  return HtmlService.createHtmlOutputFromFile("index")
    .setTitle("GasStart Dashboard")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    // DEFAULT blocks embedding in third-party iframes (clickjacking). Switch to
    // ALLOWALL only if you embed the app in Google Sites or your own page.
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/**
 * Called by the dashboard: returns the `data` sheet as JSON-friendly rows.
 * A missing `data` sheet is not an error — the dashboard shows the welcome
 * screen with a "Load sample data" button instead.
 */
export function getDashboardData(): DashboardData {
  const ss = getSpreadsheet();
  const hasSheet = ss.getSheetByName(SHEET_DATA) !== null;
  return {
    spreadsheetName: ss.getName(),
    spreadsheetUrl: ss.getUrl(),
    sheetName: SHEET_DATA,
    updatedAt: new Date().toISOString(),
    rows: hasSheet ? readTable(ss, SHEET_DATA) : [],
  };
}

/**
 * Fills the `data` sheet with 90 days × 3 categories of demo rows (replaces existing content).
 * Write access is limited to the account that deployed the web app: with
 * `executeAs: USER_DEPLOYING` every visitor runs as the deployer, so without this
 * guard anyone holding the URL could overwrite the sheet.
 */
export function seedSampleData(): SeedResult {
  assertDeployer("seedSampleData");
  const ss = getSpreadsheet();
  const rows = sampleRows(90);
  writeTable(ss, SHEET_DATA, rows);
  return { sheetName: SHEET_DATA, rows: rows.length };
}

/** Cheap connectivity check for the dashboard / clasp run-function. */
export function ping(): string {
  return `pong ${new Date().toISOString()}`;
}

/**
 * Only needed for STANDALONE scripts (not bound to a spreadsheet): stores the
 * spreadsheet id in Script Properties. Run once from the editor, or set the
 * Script Property SPREADSHEET_ID by hand in Project Settings.
 */
export function setup(spreadsheetId: string): string {
  assertDeployer("setup"); // exported => callable by any viewer; it repoints the data source
  setSpreadsheetId(spreadsheetId);
  const ss = getSpreadsheet();
  return `Linked to "${ss.getName()}" (${ss.getUrl()})`;
}

/**
 * Throws unless the visitor is the deploying account. For consumer Gmail accounts
 * `getActiveUser()` is empty for anyone other than the owner, so this is a safe
 * "owner only" check for functions that modify data.
 */
function assertDeployer(action: string): void {
  const active = Session.getActiveUser().getEmail();
  const effective = Session.getEffectiveUser().getEmail();
  if (!active || active !== effective) {
    throw new Error(`${action} is restricted to the account that deployed this web app.`);
  }
}

/** Prints the current configuration to the execution log. */
export function showConfig(): void {
  const ss = getSpreadsheet();
  console.log({
    spreadsheet: ss.getName(),
    url: ss.getUrl(),
    sheets: ss.getSheets().map((s) => s.getName()),
    dataSheet: SHEET_DATA,
  });
}
