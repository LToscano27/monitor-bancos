import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import CompositionChart from "../components/CompositionChart";
import EntityPicker from "../components/EntityPicker";
import Seg from "../components/Seg";
import TimeSeriesChart from "../components/TimeSeriesChart";
import { loadComposition, loadCompositionMeta, loadEntity } from "../lib/data";
import { deflateSeries } from "../lib/deflate";
import {
  delta, fmtValue, GROUP_LABELS, isMoney, num, PALETTE, periodLabel, shiftPeriod, shortName,
} from "../lib/format";
import { useCore } from "../lib/store";
import type {
  CompositionMeta, CompositionSeries, MetricUnit, Series as SeriesMap,
} from "../lib/types";

// métricas donde un aumento es "malo" (para colorear la variación de forma intuitiva)
const LOWER_IS_BETTER = new Set(["mora", "a11", "a16", "a17", "ag3", "rg3", "rg5", "e1", "c2", "c3"]);

// agregados fijados arriba del buscador
const GROUP_OPTS = [
  { code: "AA000", label: "Sistema financiero" },
  { code: "AA120", label: "Bancos privados" },
  { code: "AA110", label: "Bancos públicos" },
];

// opciones de composición: se eligen desde el mismo desplegable que los indicadores
const COMPO_OPTS = {
  __compo_activo: { seccion: "activo" as const, label: "Composición del activo" },
  __compo_pasivo: { seccion: "pasivo" as const, label: "Composición del pasivo" },
};

// colores fijos para los rubros protagonistas de cada sección
const RUBRO_COLOR: Record<string, string> = {
  prestamos: "#4da3ff",
  titulos_publicos: "#33d69f",
  depositos: "#4da3ff",
  otras_obligaciones: "#33d69f",
};

function StatCard({ label, sub, unit, value, prev, invert, variation }: {
  label: string; sub: string; unit: MetricUnit;
  value: number | null; prev: number | null; invert?: boolean; variation?: boolean;
}) {
  let body: ReactNode = fmtValue(value, unit);
  let cls = "";
  if (variation) {
    const d = delta(unit, value, prev);
    if (!d) { body = "—"; }
    else {
      cls = invert && d.cls !== "mut" ? (d.cls === "pos" ? "neg" : "pos") : d.cls;
      body = d.text;
    }
  }
  return (
    <div className="kpi">
      <div className="l">{label}</div>
      <div className="v" style={variation ? { color: `var(--${cls === "pos" ? "good" : cls === "neg" ? "bad" : "txt"})` } : undefined}>
        {body}
      </div>
      <div className="u mut" style={{ fontSize: 11, marginTop: 3 }}>{sub}</div>
    </div>
  );
}

export default function Series() {
  const { index, system, ipc } = useCore();
  const periods = system.periods;
  const refPeriod = periods[periods.length - 1];

  const [metric, setMetric] = useState("activo");
  const [sel, setSel] = useState("AA000"); // selección única: código de grupo (AA###) o de entidad
  const [entSeries, setEntSeries] = useState<Record<string, SeriesMap>>({});
  const [mode, setMode] = useState<"nominal" | "real">("nominal");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [compo, setCompo] = useState<CompositionSeries | null>(null);
  const [compoMeta, setCompoMeta] = useState<CompositionMeta | null>(null);

  // la composición es una opción más del desplegable, no un indicador del BCRA
  const compoOpt = COMPO_OPTS[metric as keyof typeof COMPO_OPTS];
  const seccion = compoOpt?.seccion ?? null;
  const def = seccion ? null : index.metrics[metric];
  const money = def ? isMoney(def.unit) : false;
  const canReal = money && ipc != null;
  const real = mode === "real" && canReal;

  useEffect(() => {
    if (!sel.startsWith("AA") && !entSeries[sel]) {
      loadEntity(sel).then((e) => setEntSeries((p) => ({ ...p, [sel]: e.m }))).catch(() => {});
    }
  }, [sel, entSeries]);

  useEffect(() => {
    if (!seccion) return;
    if (!compoMeta) loadCompositionMeta().then(setCompoMeta).catch(() => {});
    setCompo(null);
    loadComposition(sel).then(setCompo).catch(() => setCompo(null));
  }, [seccion, sel, compoMeta]);

  const isGroup = sel.startsWith("AA");
  const srcSeries: SeriesMap | undefined = isGroup ? system.groups[sel] : entSeries[sel];
  const nameOf = (code: string) =>
    GROUP_LABELS[code] ?? shortName(index.entities.find((e) => e.code === code)?.nombre ?? code);

  // valores mostrados (deflactados si corresponde)
  const values = useMemo(() => {
    if (seccion) return [];
    let v = srcSeries?.[metric] ?? [];
    if (real && ipc) v = deflateSeries(v, periods, ipc, refPeriod);
    return v;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcSeries, metric, seccion, real, ipc, periods, refPeriod]);

  // último período con dato para esta selección
  const lastIdx = useMemo(() => {
    for (let i = values.length - 1; i >= 0; i--) if (values[i] != null) return i;
    return -1;
  }, [values]);

  const base = lastIdx >= 0 ? periods[lastIdx] : null;
  const iPm = base ? periods.indexOf(shiftPeriod(base, -1)) : -1;
  const iPy = base ? periods.indexOf(shiftPeriod(base, -12)) : -1;
  const invert = LOWER_IS_BETTER.has(metric);

  const breakNote = index.series_breaks[metric];
  const color = isGroup && sel === "AA000" ? "#8a97b2" : PALETTE[0];

  // --- composición: participación de cada rubro en el total de la sección, mes a mes ---
  const compoView = useMemo(() => {
    if (!compo || !compoMeta || !seccion) return null;
    // en el activo se usa el split de títulos y se descarta el rubro combinado
    const keys = (seccion === "activo" ? compoMeta.keys_activo : compoMeta.keys_pasivo)
      .filter((k) => k !== "titulos");
    const n = compo.periods.length;
    const totales = Array.from({ length: n }, (_, i) =>
      keys.reduce((s, k) => s + (compo.m[k]?.[i] ?? 0), 0));
    const shareDe = (k: string) =>
      Array.from({ length: n }, (_, i) =>
        totales[i] > 0 && compo.m[k]?.[i] != null ? (100 * (compo.m[k]![i] as number)) / totales[i] : null);

    const shares = keys.map((k) => ({ key: k, label: compoMeta.labels[k] ?? k, values: shareDe(k) }));
    const pico = (vals: (number | null)[]) => Math.max(...vals.map((v) => v ?? 0));
    // rubros chicos (siempre por debajo del 2%) se agrupan para que el gráfico se lea
    const grandes = shares.filter((s) => pico(s.values) >= 2);
    const chicos = shares.filter((s) => pico(s.values) < 2);
    const ordenados = grandes.sort((a, b) => (b.values[n - 1] ?? 0) - (a.values[n - 1] ?? 0));
    const series = ordenados.map((s, i) => ({
      label: s.label,
      values: s.values,
      color: RUBRO_COLOR[s.key] ?? PALETTE[(i + 2) % PALETTE.length],
    }));
    if (chicos.length) {
      series.push({
        label: "Otros rubros",
        values: Array.from({ length: n }, (_, i) =>
          chicos.reduce((s, c) => s + (c.values[i] ?? 0), 0)),
        color: "#8a97b2",
      });
    }
    // último período con datos de composición
    let last = -1;
    for (let i = n - 1; i >= 0; i--) if (totales[i] > 0) { last = i; break; }
    return { series, last, periods: compo.periods };
  }, [compo, compoMeta, seccion]);

  return (
    <>
      <h1 className="pagetitle">Series históricas</h1>
      <div className="pagesub">
        La evolución de un indicador, del sistema o de una entidad, desde julio 2011. Para superponer
        varias entidades usá el <Link to="/comparar">comparador</Link>.
      </div>

      <div className="controls">
        <select value={metric} onChange={(e) => { setMetric(e.target.value); setHoverIdx(null); }}>
          <optgroup label="Composición del balance">
            {Object.entries(COMPO_OPTS).map(([k, o]) => (
              <option key={k} value={k}>{o.label}</option>
            ))}
          </optgroup>
          <optgroup label="Indicadores">
            {Object.entries(index.metrics).map(([k, m]) => (
              <option key={k} value={k}>{m.label}</option>
            ))}
          </optgroup>
        </select>
        {money && (
          <Seg
            options={[
              { value: "nominal", label: "$ corrientes" },
              { value: "real", label: `$ constantes${canReal ? "" : " (n/d)"}` },
            ]}
            value={real ? "real" : "nominal"}
            onChange={(v) => canReal && setMode(v)}
          />
        )}
      </div>

      <div className="controls">
        <EntityPicker
          entities={index.entities}
          groups={GROUP_OPTS}
          onPick={(code) => setSel(code)}
          placeholder="Buscar sistema, grupo o entidad…"
        />
        <span className="chip" style={{ borderColor: color }}>
          <span style={{ color }}>●</span> Viendo: {nameOf(sel)}
          {sel !== "AA000" && <button onClick={() => setSel("AA000")} title="Volver al sistema">×</button>}
        </span>
      </div>

      {seccion ? (
        <div className="serieswrap">
          <div className="card">
            <h3>{compoOpt.label} · {nameOf(sel)}</h3>
            <div className="cs">
              Participación de cada rubro en el {seccion}, mes a mes. Al ser porcentajes, la inflación
              no distorsiona la serie.
            </div>
            {!compoView ? (
              <div className="loading">Cargando composición…</div>
            ) : (
              <CompositionChart
                periods={compoView.periods}
                series={compoView.series}
                onHoverIndex={setHoverIdx}
              />
            )}
          </div>

          <div className="sidecards">
            {compoView && compoView.last >= 0 && (() => {
              const p = compoView.periods;
              const i = hoverIdx != null && compoView.series[0]?.values[hoverIdx] != null
                ? hoverIdx : compoView.last;
              const iPmC = p.indexOf(shiftPeriod(p[i], -1));
              return (
                <div className="card" style={{ padding: "13px 15px" }}>
                  <div className="l" style={{ color: "var(--mut)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".6px" }}>
                    {hoverIdx != null ? "Mes señalado" : "Último dato"}
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 680, margin: "4px 0 10px" }}>
                    {periodLabel(p[i], true)}
                  </div>
                  <table style={{ fontSize: 12 }}>
                    <tbody>
                      {compoView.series.map((s) => {
                        const v = s.values[i];
                        const d = iPmC >= 0 && v != null && s.values[iPmC] != null ? v - s.values[iPmC]! : null;
                        return (
                          <tr key={s.label}>
                            <td className="n" style={{ padding: "4px 0", lineHeight: 1.25 }}>
                              <span style={{ color: s.color, marginRight: 6 }}>●</span>
                              {s.label}
                            </td>
                            <td style={{ padding: "4px 0 4px 6px", fontWeight: 650, whiteSpace: "nowrap" }}>
                              {num(v, 1)}%
                            </td>
                            <td style={{ padding: "4px 0 4px 6px", whiteSpace: "nowrap", fontSize: 11 }}>
                              {d == null ? "" : (
                                <span className={d > 0.05 ? "pos" : d < -0.05 ? "neg" : "mut"}>
                                  {(Math.abs(d) < 0.05 ? "" : d > 0 ? "+" : "") +
                                    (Math.abs(d) < 0.05 ? 0 : d)
                                      .toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="mut" style={{ fontSize: 10.5, marginTop: 8, lineHeight: 1.45 }}>
                    % del {seccion} · la tercera columna es la variación en puntos contra el mes
                    anterior. Pasá el cursor por el gráfico para ver cualquier mes.
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      ) : def ? (
      <div className="serieswrap">
        <div className="card">
          <h3>{def.label} · {nameOf(sel)}</h3>
          <div className="cs">
            {real ? "Pesos constantes del último período" : "Valores publicados"}
            {base ? ` · último dato ${periodLabel(base, true)}` : ""}
          </div>
          <TimeSeriesChart
            periods={periods}
            datasets={[{ label: nameOf(sel), values, color }]}
            unit={def.unit}
          />
          {breakNote && <div className="note">{breakNote}</div>}
          {money && mode === "nominal" && (
            <div className="note">
              Serie en pesos corrientes: con alta inflación el crecimiento nominal sobreestima el real.
              Probá la vista en $ constantes.
            </div>
          )}
        </div>

        <div className="sidecards">
          <StatCard
            label="Último dato"
            sub={base ? periodLabel(base, true) : "—"}
            unit={def.unit}
            value={lastIdx >= 0 ? values[lastIdx] : null}
            prev={null}
          />
          <StatCard
            label="Variación mensual"
            sub={iPm >= 0 ? `vs. ${periodLabel(periods[iPm])}` : "sin mes previo"}
            unit={def.unit}
            value={lastIdx >= 0 ? values[lastIdx] : null}
            prev={iPm >= 0 ? values[iPm] : null}
            invert={invert}
            variation
          />
          <StatCard
            label="Variación interanual"
            sub={iPy >= 0 ? `vs. ${periodLabel(periods[iPy])}` : "sin año previo"}
            unit={def.unit}
            value={lastIdx >= 0 ? values[lastIdx] : null}
            prev={iPy >= 0 ? values[iPy] : null}
            invert={invert}
            variation
          />
          {real && (
            <div className="u mut" style={{ fontSize: 11, lineHeight: 1.5 }}>
              Variaciones calculadas sobre la serie en pesos constantes: reflejan crecimiento real.
            </div>
          )}
        </div>
      </div>
      ) : null}
    </>
  );
}
