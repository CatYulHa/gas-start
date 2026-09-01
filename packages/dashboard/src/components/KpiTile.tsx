interface Props {
  label: string;
  value: string;
  hint?: string;
  trend?: "up" | "down";
}

export function KpiTile({ label, value, hint, trend }: Props) {
  return (
    <div className="card kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {hint && (
        <div className={`hint ${trend ?? ""}`}>
          {trend === "up" && <span aria-hidden>▲</span>}
          {trend === "down" && <span aria-hidden>▼</span>}
          <span>{hint}</span>
        </div>
      )}
    </div>
  );
}
