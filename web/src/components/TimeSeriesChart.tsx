import { Line } from "react-chartjs-2";
import "../lib/charts";
import { fmtValue, periodLabel } from "../lib/format";
import type { MetricUnit } from "../lib/types";

export interface TsDataset {
  label: string;
  values: (number | null)[];
  color: string;
}

interface Props {
  periods: string[];
  datasets: TsDataset[];
  unit: MetricUnit;
  /** "pct_var": los valores son variaciones % (no la unidad original) */
  asVariation?: boolean;
  height?: "" | "sm" | "xs";
}

export default function TimeSeriesChart({ periods, datasets, unit, asVariation, height = "" }: Props) {
  const fmt = (v: number | null) =>
    asVariation
      ? (v == null ? "—" : (v >= 0 ? "+" : "") + v.toLocaleString("es-AR", { maximumFractionDigits: 1 }) + "%")
      : fmtValue(v, unit);

  return (
    <div className={`chartbox ${height}`}>
      <Line
        data={{
          labels: periods.map((p) => periodLabel(p)),
          datasets: datasets.map((d) => ({
            label: d.label,
            data: d.values,
            borderColor: d.color,
            backgroundColor: d.color + "26",
            pointRadius: 0,
            pointHitRadius: 8,
            borderWidth: 2,
            spanGaps: false,
            fill: datasets.length === 1,
            tension: 0.15,
          })),
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: datasets.length > 1, position: "top", labels: { color: "#e8edf6" } },
            tooltip: {
              callbacks: {
                label: (c) => `${c.dataset.label}: ${fmt(c.parsed.y)}`,
              },
            },
          },
          scales: {
            x: {
              ticks: { maxTicksLimit: 14, maxRotation: 0, autoSkip: true },
              grid: { display: false },
            },
            y: {
              ticks: { callback: (v) => fmt(typeof v === "number" ? v : null) },
              grid: { color: "#2a3550" },
            },
          },
        }}
      />
    </div>
  );
}
