import { Line } from "react-chartjs-2";
import "../lib/charts";
import { num, periodLabel } from "../lib/format";
import { chartColors, useTheme } from "../lib/theme";

export interface CompoSeries {
  label: string;
  values: (number | null)[]; // porcentajes del activo
  color: string;
}

interface Props {
  periods: string[];
  series: CompoSeries[];
}

/** Área apilada: participación de cada rubro en el activo, mes a mes. */
export default function CompositionChart({ periods, series }: Props) {
  const { theme } = useTheme();
  const c = chartColors(theme);

  return (
    <div className="chartbox">
      <Line
        data={{
          labels: periods.map((p) => periodLabel(p)),
          datasets: series.map((s) => ({
            label: s.label,
            data: s.values,
            borderColor: s.color,
            backgroundColor: s.color + "cc",
            borderWidth: 1,
            pointRadius: 0,
            pointHitRadius: 6,
            fill: true,
            tension: 0.15,
          })),
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { position: "bottom", labels: { color: c.txt, boxWidth: 11, font: { size: 11 } } },
            tooltip: {
              callbacks: { label: (ctx) => `${ctx.dataset.label}: ${num(ctx.parsed.y, 1)}%` },
            },
          },
          scales: {
            x: {
              ticks: { maxTicksLimit: 14, maxRotation: 0, autoSkip: true, color: c.mut },
              grid: { display: false },
            },
            y: {
              stacked: true,
              min: 0,
              max: 100,
              ticks: { callback: (v) => `${v}%`, color: c.mut },
              grid: { color: c.line },
            },
          },
        }}
      />
    </div>
  );
}
