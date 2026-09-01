import type { DashboardData } from "@gasstart/shared";
import { useState } from "react";
import { seedSampleData } from "../lib/gas";

interface Props {
  data: DashboardData;
  onSeeded: () => void;
}

/**
 * "Hello, GasStart" — shown when the `data` sheet is empty or missing, i.e. right
 * after `npm run setup`. Proves the whole pipeline works (React → google.script.run
 * → Apps Script → Spreadsheet) and offers to fill the sheet with demo rows.
 */
export function Welcome({ data, onSeeded }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seed = () => {
    setBusy(true);
    setError(null);
    seedSampleData()
      .then(onSeeded)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  };

  return (
    <section className="card welcome">
      <h2 className="welcome-title">
        <span aria-hidden>👋</span> Hello, GasStart!
      </h2>
      <p>
        Your React dashboard is live inside Google Apps Script and connected to{" "}
        <a href={data.spreadsheetUrl} target="_blank" rel="noreferrer">
          {data.spreadsheetName}
        </a>
        . The <code>{data.sheetName}</code> sheet is empty, so there is nothing to chart yet.
      </p>
      <ol className="welcome-steps">
        <li>
          <button onClick={seed} disabled={busy}>
            {busy ? "Writing demo rows…" : "Load sample data"}
          </button>{" "}
          — writes 90 days × 3 categories into <code>{data.sheetName}</code>
        </li>
        <li>
          Or fill the sheet yourself: header row <code>date, category, value</code>, one row per point
          (Python: <code>gasstart-sheets seed &lt;sheet&gt;</code>)
        </li>
        <li>
          Then edit <code>packages/dashboard/src/App.tsx</code>, run <code>npm run dev</code> to iterate with mock
          data, and <code>npm run push:dev</code> to ship
        </li>
      </ol>
      {error && (
        <p className="welcome-error">
          Could not write sample data: {error}
          <br />
          If this mentions permissions, open the web app URL directly once and accept the authorization prompt.
        </p>
      )}
    </section>
  );
}
