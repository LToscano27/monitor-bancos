import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import EntityPicker from "../components/EntityPicker";
import Seg from "../components/Seg";
import TimeSeriesChart from "../components/TimeSeriesChart";
import { loadEntity } from "../lib/data";
import { deflateSeries } from "../lib/deflate";
import {
  delta, fmtValue, GROUP_LABELS, isMoney, PALETTE, periodLabel, shiftPeriod, shortName,
} from "../lib/format";
import { useCore } from "../lib/store";
import type { MetricUnit, Series as SeriesMap } from "../lib/types";

// métricas donde un aumento es "malo" (para colorear la variación de forma intuitiva)
const LOWER_IS_BETTER = new Set(["mora", "a11", "a16", "a17", "ag3", "rg3", "rg5", "e1", "c2", "c3"]);

// agregados fijados arriba del buscador
const GROUP_OPTS = [
  { code: "AA000", label: "Sistema financiero" },
  { code: "AA120", label: "Bancos privados" },
  { code: "AA110", label: "Bancos públicos" },
];

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

  const def = index.metrics[metric];
  const money = isMoney(def.unit);
  const canReal = money && ipc != null;
  const real = mode === "real" && canReal;

  useEffect(() => {
    if (!sel.startsWith("AA") && !entSeries[sel]) {
      loadEntity(sel).then((e) => setEntSeries((p) => ({ ...p, [sel]: e.m }))).catch(() => {});
    }
  }, [sel, entSeries]);

  const isGroup = sel.startsWith("AA");
  const srcSeries: SeriesMap | undefined = isGroup ? system.groups[sel] : entSeries[sel];
  const nameOf = (code: string) =>
    GROUP_LABELS[code] ?? shortName(index.entities.find((e) => e.code === code)?.nombre ?? code);

  // valores mostrados (deflactados si corresponde)
  const values = useMemo(() => {
    let v = srcSeries?.[metric] ?? [];
    if (real && ipc) v = deflateSeries(v, periods, ipc, refPeriod);
    return v;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcSeries, metric, real, ipc, periods, refPeriod]);

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

  return (
    <>
      <h1 className="pagetitle">Series históricas</h1>
      <div className="pagesub">
        La evolución de un indicador, del sistema o de una entidad, desde julio 2011. Para superponer
        varias entidades usá el <Link to="/comparar">comparador</Link>.
      </div>

      <div className="controls">
        <select value={metric} onChange={(e) => setMetric(e.target.value)}>
          {Object.entries(index.metrics).map(([k, m]) => (
            <option key={k} value={k}>{m.label}</option>
          ))}
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
    </>
  );
}
