import type { Chart as ChartJS } from "chart.js";
import { useRef, useState } from "react";
import { Line } from "react-chartjs-2";
import "../lib/charts";
import { periodLabel } from "../lib/format";
import { chartColors, useTheme } from "../lib/theme";

export interface CompoSeries {
  label: string;
  values: (number | null)[]; // porcentajes del activo
  color: string;
}

interface Props {
  periods: string[];
  series: CompoSeries[];
  /** índice del mes bajo el cursor (null al salir); los valores se muestran fuera del gráfico */
  onHoverIndex?: (i: number | null) => void;
}

interface Marker {
  x: number;
  top: number;
  height: number;
}

/**
 * Área apilada: participación de cada rubro en el activo, mes a mes.
 *
 * No usa el tooltip de Chart.js: con siete rubros apilados el cartel tapaba el gráfico.
 * En su lugar el cursor marca el mes con una guía vertical y los valores se muestran en
 * el panel de al lado. El seguimiento del mouse se hace acá (no con el onHover de
 * Chart.js) para no depender de su throttling por requestAnimationFrame.
 */
export default function CompositionChart({ periods, series, onHoverIndex }: Props) {
  const { theme } = useTheme();
  const c = chartColors(theme);
  const chartRef = useRef<ChartJS<"line", (number | null)[], string> | null>(null);
  const [marker, setMarker] = useState<Marker | null>(null);

  const clear = () => {
    setMarker(null);
    onHoverIndex?.(null);
  };

  const track = (clientX: number) => {
    const chart = chartRef.current;
    if (!chart) return;
    const { chartArea, scales } = chart;
    const x = clientX - chart.canvas.getBoundingClientRect().left;
    if (x < chartArea.left || x > chartArea.right) return clear();
    const raw = scales.x.getValueForPixel(x);
    if (raw == null) return clear();
    const i = Math.min(Math.max(Math.round(raw), 0), periods.length - 1);
    setMarker({
      x: scales.x.getPixelForValue(i),
      top: chartArea.top,
      height: chartArea.bottom - chartArea.top,
    });
    onHoverIndex?.(i);
  };

  return (
    <div
      className="chartbox"
      style={{ position: "relative" }}
      onMouseMove={(e) => track(e.clientX)}
      onMouseLeave={clear}
    >
      <Line
        ref={chartRef}
        data={{
          labels: periods.map((p) => periodLabel(p)),
          datasets: series.map((s) => ({
            label: s.label,
            data: s.values,
            borderColor: s.color,
            backgroundColor: s.color + "cc",
            borderWidth: 1,
            pointRadius: 0,
            fill: true,
            tension: 0.15,
          })),
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: {
            legend: { position: "bottom", labels: { color: c.txt, boxWidth: 11, font: { size: 11 } } },
            tooltip: { enabled: false },
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
      {marker && (
        <div
          style={{
            position: "absolute",
            left: marker.x,
            top: marker.top,
            height: marker.height,
            borderLeft: `1.5px dashed ${theme === "dark" ? "#e8edf6" : "#1c2433"}`,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
