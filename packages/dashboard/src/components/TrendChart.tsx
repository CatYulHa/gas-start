import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SeriesRow } from "../lib/transform";
import { fmtNumber } from "../lib/transform";

interface Props {
  data: SeriesRow[];
  categories: string[];
}

const MAX_SERIES = 8;

/** Series colour by fixed slot — assigned in first-seen category order, never re-cycled. */
const seriesColor = (i: number) => `var(--series-${(i % MAX_SERIES) + 1})`;

export function TrendChart({ data, categories }: Props) {
  const shown = categories.slice(0, MAX_SERIES);
  const tick = { fill: "var(--text-secondary)", fontSize: 12 };

  return (
    <div>
      {shown.length > 1 && (
        <div className="legend" role="list">
          {shown.map((c, i) => (
            <span key={c} role="listitem">
              <span className="swatch" style={{ background: seriesColor(i) }} />
              {c}
            </span>
          ))}
        </div>
      )}
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis
              dataKey="date"
              tick={tick}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              tickFormatter={(d: string) => d.slice(5)}
              minTickGap={24}
            />
            <YAxis tick={tick} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => fmtNumber(v)} />
            <Tooltip
              cursor={{ stroke: "var(--text-muted)", strokeWidth: 1 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="tooltip">
                    <div className="date">{String(label)}</div>
                    {payload.map((p) => (
                      <div className="row" key={String(p.dataKey)}>
                        <span className="name">
                          <span className="dot" style={{ background: p.color }} />
                          {String(p.name)}
                        </span>
                        <span>{fmtNumber(Number(p.value))}</span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            {shown.map((c, i) => (
              <Line
                key={c}
                type="monotone"
                dataKey={c}
                name={c}
                stroke={seriesColor(i)}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--surface-1)" }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
