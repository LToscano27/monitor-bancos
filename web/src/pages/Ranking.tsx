import { useEffect, useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import { Link } from "react-router-dom";
import "../lib/charts";
import Seg from "../components/Seg";
import { loadPeriod } from "../lib/data";
import { fmtValue, isMoney, num, periodLabel, shortName } from "../lib/format";
import { useCore } from "../lib/store";
import { chartColors, useTheme } from "../lib/theme";
import type { PeriodData } from "../lib/types";

// métricas donde un valor menor es mejor
const LOWER_IS_BETTER = new Set(["mora", "a11", "a16", "a17", "ag3", "rg3", "rg5", "e1", "c2", "c3"]);

export default function Ranking() {
  const { index } = useCore();
  const { theme } = useTheme();
  const cc = chartColors(theme);
  const [period, setPeriod] = useState(index.latest ?? "");
  const [metric, setMetric] = useState("activo");
  const [grupo, setGrupo] = useState<"todas" | "publico" | "privado" | "financiera">("todas");
  const [data, setData] = useState<PeriodData | null>(null);

  useEffect(() => {
    if (period) loadPeriod(period).then(setData).catch(() => setData(null));
  }, [period]);

  const def = index.metrics[metric];
  const grupoDe = useMemo(
    () => new Map(index.entities.map((e) => [e.code, e.grupo])),
    [index],
  );

  const rows = useMemo(() => {
    if (!data) return [];
    let list = data.entidades.filter((e) => e[metric] != null);
    if (grupo !== "todas") list = list.filter((e) => grupoDe.get(e.code) === grupo);
    const sign = LOWER_IS_BETTER.has(metric) ? 1 : -1;
    return [...list].sort((a, b) => sign * ((a[metric] as number) - (b[metric] as number)));
  }, [data, metric, grupo, grupoDe]);

  const total = data?.agregados?.AA000?.[metric] as number | null | undefined;
  const withShare = isMoney(def.unit) || def.unit === "cantidad";
  const top = rows.slice(0, 15);

  return (
    <>
      <h1 className="pagetitle">Ranking de entidades</h1>
      <div className="pagesub">Ordená por cualquier indicador · click en una entidad para ver su ficha</div>

      <div className="controls">
        <select value={metric} onChange={(e) => setMetric(e.target.value)}>
          {Object.entries(index.metrics).map(([k, m]) => (
            <option key={k} value={k}>{m.label}</option>
          ))}
        </select>
        <select value={period} onChange={(e) => setPeriod(e.target.value)}>
          {[...index.periods].reverse().map((p) => (
            <option key={p} value={p}>{periodLabel(p)}</option>
          ))}
        </select>
        <Seg
          options={[
            { value: "todas", label: "Todas" },
            { value: "publico", label: "Públicos" },
            { value: "privado", label: "Privados" },
            { value: "financiera", label: "Cías. financieras" },
          ]}
          value={grupo}
          onChange={setGrupo}
        />
      </div>

      {!data ? (
        <div className="loading">Cargando período…</div>
      ) : (
        <div className="grid2">
          <div className="card">
            <h3>Top 15 · {def.label}</h3>
            <div className="cs">
              {periodLabel(period, true)}
              {LOWER_IS_BETTER.has(metric) ? " · menor es mejor" : ""}
            </div>
            <div className="chartbox">
              <Bar
                data={{
                  labels: top.map((r) => shortName(r.nombre)),
                  datasets: [{
                    data: top.map((r) => r[metric] as number),
                    backgroundColor: "#4da3ff",
                    borderRadius: 4,
                    barThickness: 14,
                  }],
                }}
                options={{
                  indexAxis: "y",
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (c) => {
                          const r = top[c.dataIndex];
                          let s = fmtValue(r[metric] as number, def.unit);
                          if (withShare && total) s += ` · ${num(100 * (r[metric] as number) / total, 1)}% del sistema`;
                          return s;
                        },
                      },
                    },
                  },
                  scales: {
                    x: { ticks: { callback: (v) => fmtValue(v as number, def.unit), color: cc.mut }, grid: { color: cc.line } },
                    y: { ticks: { color: cc.txt, font: { size: 11 } }, grid: { display: false } },
                  },
                }}
              />
            </div>
          </div>

          <div className="card">
            <h3>Tabla completa</h3>
            <div className="cs">{rows.length} entidades con dato</div>
            <div style={{ maxHeight: 420, overflow: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th className="rk"></th>
                    <th className="n">Entidad</th>
                    <th>{withShare ? "Monto" : "Valor"}</th>
                    {withShare && <th>Share</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.code}>
                      <td className="rk">{i + 1}</td>
                      <td className="n">
                        <Link to={`/entidad/${r.code}`}>{shortName(r.nombre)}</Link>
                      </td>
                      <td>{fmtValue(r[metric] as number, def.unit)}</td>
                      {withShare && (
                        <td>{total ? num(100 * (r[metric] as number) / total, 1) + "%" : "—"}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
