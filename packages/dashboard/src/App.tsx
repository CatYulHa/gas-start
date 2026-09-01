import type { DashboardData } from "@gasstart/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable } from "./components/DataTable";
import { KpiTile } from "./components/KpiTile";
import { TrendChart } from "./components/TrendChart";
import { Welcome } from "./components/Welcome";
import { loadDashboardData } from "./lib/gas";
import { categoriesOf, computeKpis, fmtNumber, fmtPercent, pivotByDate, toDataPoints } from "./lib/transform";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: DashboardData; source: "gas" | "mock" };

export function App() {
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(() => {
    setState({ status: "loading" });
    loadDashboardData()
      .then(({ data, source }) => setState({ status: "ready", data, source }))
      .catch((e: unknown) => setState({ status: "error", message: e instanceof Error ? e.message : String(e) }));
  }, []);

  useEffect(load, [load]);

  const model = useMemo(() => {
    if (state.status !== "ready") return null;
    const points = toDataPoints(state.data.rows);
    const categories = categoriesOf(points);
    return { points, categories, series: pivotByDate(points, categories), kpis: computeKpis(points, categories) };
  }, [state]);

  if (state.status === "loading") {
    return <div className="state">Loading data from Google Sheets…</div>;
  }

  if (state.status === "error") {
    return (
      <div className="state error">
        <p>Failed to load dashboard data.</p>
        <pre>{state.message}</pre>
        <p>
          <button onClick={load}>Retry</button>
        </p>
      </div>
    );
  }

  const { data, source } = state;
  const { kpis, categories, series, points } = model!;

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>GasStart Dashboard</h1>
          <div className="meta">
            <span>
              Source: <a href={data.spreadsheetUrl} target="_blank" rel="noreferrer">{data.spreadsheetName}</a> / {data.sheetName}
            </span>
            <span>Updated {new Date(data.updatedAt).toLocaleString()}</span>
          </div>
        </div>
        <div className="meta">
          {source === "mock" && <span className="badge mock">mock data (local dev)</span>}
          <button onClick={load}>Refresh</button>
        </div>
      </header>

      {points.length === 0 ? (
        <Welcome data={data} onSeeded={load} />
      ) : (
        <>
          <section className="kpi-row">
            <KpiTile label="Total value" value={fmtNumber(kpis.total)} hint={`${kpis.days} days`} />
            <KpiTile
              label="Daily average"
              value={fmtNumber(kpis.dailyAverage)}
              hint={kpis.weekOverWeek === null ? "week over week: n/a" : `${fmtPercent(kpis.weekOverWeek)} week over week`}
              trend={kpis.weekOverWeek === null ? undefined : kpis.weekOverWeek >= 0 ? "up" : "down"}
            />
            <KpiTile label="Categories" value={String(kpis.categories)} hint={categories.join(", ")} />
            <KpiTile label="Latest date" value={kpis.latestDate ?? "—"} hint={`${points.length} rows`} />
          </section>

          <section className="card">
            <h2>Daily value by category</h2>
            <TrendChart data={series} categories={categories} />
          </section>

          <section className="card">
            <h2>Rows</h2>
            <DataTable rows={data.rows} />
          </section>
        </>
      )}
    </div>
  );
}
