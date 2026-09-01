import type { Row } from "@gasstart/shared";
import { useMemo, useState } from "react";

interface Props {
  rows: Row[];
  pageSize?: number;
}

export function DataTable({ rows, pageSize = 25 }: Props) {
  const [limit, setLimit] = useState(pageSize);
  const columns = useMemo(() => (rows.length ? Object.keys(rows[0]) : []), [rows]);
  // Newest first — the sheet is appended chronologically.
  const visible = useMemo(() => [...rows].reverse().slice(0, limit), [rows, limit]);

  return (
    <div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c} className={isNumeric(rows, c) ? "num" : undefined}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c} className={typeof r[c] === "number" ? "num" : undefined}>
                    {formatCell(r[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        Showing {visible.length} of {rows.length} rows{" "}
        {limit < rows.length && <button onClick={() => setLimit((l) => l + pageSize)}>Show more</button>}
      </div>
    </div>
  );
}

function isNumeric(rows: Row[], column: string): boolean {
  return rows.some((r) => typeof r[column] === "number");
}

function formatCell(v: Row[string]): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(v);
  return String(v);
}
