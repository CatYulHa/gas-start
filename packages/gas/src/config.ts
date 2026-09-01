import { PROP_SPREADSHEET_ID } from "@gasstart/shared";

/**
 * Resolves the spreadsheet the app reads from.
 *
 * 1. Script Property SPREADSHEET_ID (set once via `setup("<id>")` from the editor
 *    or via Project Settings → Script Properties). Works for standalone scripts.
 * 2. The active spreadsheet, when the script is container-bound.
 */
export function getSpreadsheet(): GoogleAppsScript.Spreadsheet.Spreadsheet {
  const id = PropertiesService.getScriptProperties().getProperty(PROP_SPREADSHEET_ID);
  if (id) return SpreadsheetApp.openById(id);

  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;

  throw new Error(
    `No spreadsheet configured. Run setup("<spreadsheetId>") once from the Apps Script editor, ` +
      `or add a Script Property named ${PROP_SPREADSHEET_ID}.`,
  );
}

export function setSpreadsheetId(spreadsheetId: string): void {
  if (!spreadsheetId || typeof spreadsheetId !== "string") {
    throw new Error("setup(spreadsheetId) requires a non-empty spreadsheet id string.");
  }
  // Fail fast if the id is wrong or not shared with the deploying account.
  SpreadsheetApp.openById(spreadsheetId);
  PropertiesService.getScriptProperties().setProperty(PROP_SPREADSHEET_ID, spreadsheetId);
}
