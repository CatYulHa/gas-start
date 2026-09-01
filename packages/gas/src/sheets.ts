import type { Cell, Row } from "@gasstart/shared";

/**
 * Reads a worksheet whose first row is a header and returns one object per row.
 * Dates are serialised to ISO strings so they survive google.script.run.
 */
export function readTable(
  spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet,
  sheetName: string,
): Row[] {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    const names = spreadsheet.getSheets().map((s) => s.getName()).join(", ");
    throw new Error(`Sheet "${sheetName}" not found. Available sheets: ${names}`);
  }

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const header = values[0].map((h) => String(h).trim());
  const rows: Row[] = [];
  for (let i = 1; i < values.length; i++) {
    const raw = values[i];
    if (raw.every((v) => v === "" || v === null)) continue; // skip blank rows
    const row: Row = {};
    header.forEach((key, col) => {
      if (key) row[key] = toCell(raw[col]);
    });
    rows.push(row);
  }
  return rows;
}

/** Overwrites a worksheet with the given rows (header derived from the first row's keys). */
export function writeTable(
  spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet,
  sheetName: string,
  rows: Row[],
): void {
  const sheet = spreadsheet.getSheetByName(sheetName) ?? spreadsheet.insertSheet(sheetName);
  sheet.clearContents();
  if (rows.length === 0) return;

  const header = Object.keys(rows[0]);
  const values: Cell[][] = [header, ...rows.map((r) => header.map((k) => r[k] ?? null))];
  sheet.getRange(1, 1, values.length, header.length).setValues(values);
}

function toCell(value: unknown): Cell {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  if (typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}
