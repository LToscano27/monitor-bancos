import { useEffect, useMemo, useState } from "react";
import EntityPicker from "../components/EntityPicker";
import Seg from "../components/Seg";
import TimeSeriesChart from "../components/TimeSeriesChart";
import { loadEntity } from "../lib/data";
import { deflateSeries } from "../lib/deflate";
import { GROUP_LABELS, isMoney, PALETTE, shiftPeriod, shortName } from "../lib/format";
import { useCore } from "../lib/store";
import type { Series as SeriesMap } from "../lib/types";

type View = "nivel" | "ia" | "im";

/** variación % contra `lag` meses atrás (por período, tolera huecos de publicación) */
function variation(values: (number | null)[], periods: string[], lag: number): (number | null)[] {
  const byPeriod = new Map(periods.map((p, i) => [p, values[i]]));
  return values.map((v, i) => {
    const prev = byPeriod.get(shiftPeriod(periods[i], -lag));
    if (v == null || prev == null || prev === 0) return null;
    return 100 * (v / prev - 1);
  });
}

export default function Series() {
  const { index, system, ipc } = useCore();
  const periods = system.periods;
  const latest = periods[periods.length - 1];

  const [metric, setMetric] = useState("activo");
  const [selected, setSelected] = useState<string[]>(["AA000"]);
  const [entSeries, setEntSeries] = useState<Record<string, SeriesMap>>({});
  const [mode, setMode] = useState<"nominal" | "real">("nominal");
  const [view, setView] = useState<View>("nivel");

  const def = index.metrics[metric];
  const money = isMoney(def.unit);
  const canReal = money && ipc != null;

  // cargar series de entidades seleccionadas que falten
  useEffect(() => {
    selected
      .filter((c) => !c.startsWith("AA") && !entSeries[c])
      .forEach((c) => {
        loadEntity(c).then((e) => setEntSeries((prev) => ({ ...prev, [c]: e.m })));
      });
  }, [selected, entSeries]);

  const nameOf = (code: string) =>
    GROUP_LABELS[code] ??
    shortName(index.entities.find((e) => e.code === code)?.nombre ?? code);

  const datasets = useMemo(() => {
    return selected
      .map((code, i) => {
        const src = code.startsWith("AA") ? system.groups[code] : entSeries[code];
        if (!src) return null;
        let values = src[metric] ?? [];
        if (mode === "real" && canReal && ipc) values = deflateSeries(values, periods, ipc, latest);
        if (view === "ia") values = variation(values, periods, 12);
        if (view === "im") values = variation(values, periods, 1);
        return { label: nameOf(code), values, color: PALETTE[i % PALETTE.length] };
      })
      .filter((d) => d != null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, entSeries, metric, mode, view, canReal, ipc, periods, latest, system]);

  const breakNote = index.series_breaks[metric];

  return (
    <>
      <h1 className="pagetitle">Series históricas</h1>
      <div className="pagesub">
        Cualquier indicador, del sistema o de cada entidad, desde julio 2011 — con variaciones
        interanuales e intermensuales.
      </div>

      <div className="controls">
        <select value={metric} onChange={(e) => setMetric(e.target.value)}>
          {Object.entries(index.metrics).map(([k, m]) => (
            <option key={k} value={k}>{m.label}</option>
          ))}
        </select>
        <Seg
          options={[
            { value: "nivel", label: "Nivel" },
            { value: "ia", label: "Var. interanual" },
            { value: "im", label: "Var. mensual" },
          ]}
          value={view}
          onChange={setView}
        />
        {money && (
          <Seg
            options={[
              { value: "nominal", label: "$ corrientes" },
              { value: "real", label: "$ constantes" },
            ]}
            value={canReal ? mode : "nominal"}
            onChange={(v) => canReal && setMode(v)}
          />
        )}
      </div>

      <div className="controls">
        {(["AA000", "AA110", "AA120"] as const).map((g) => (
          <button
            key={g}
            className={`ctl ${selected.includes(g) ? "on" : ""}`}
            onClick={() =>
              setSelected((s) => (s.includes(g) ? s.filter((x) => x !== g) : [...s, g]))
            }
          >
            {GROUP_LABELS[g]}
          </button>
        ))}
        <EntityPicker
          entities={index.entities}
          exclude={selected}
          onPick={(code) => setSelected((s) => [...s, code])}
          placeholder="Agregar entidad…"
        />
      </div>

      {selected.some((c) => !c.startsWith("AA")) && (
        <div className="chips" style={{ marginBottom: 12 }}>
          {selected.filter((c) => !c.startsWith("AA")).map((c) => (
            <span key={c} className="chip">
              {nameOf(c)}
              <button onClick={() => setSelected((s) => s.filter((x) => x !== c))}>×</button>
            </span>
          ))}
        </div>
      )}

      <div className="card">
        <h3>{def.label}</h3>
        <div className="cs">
          {view === "nivel"
            ? mode === "real" && canReal ? "Pesos constantes del último período" : "Valores publicados"
            : view === "ia" ? "Variación % contra el mismo mes del año anterior" : "Variación % mensual"}
        </div>
        <TimeSeriesChart
          periods={periods}
          datasets={datasets}
          unit={def.unit}
          asVariation={view !== "nivel"}
        />
        {breakNote && view === "nivel" && <div className="note">{breakNote}</div>}
        {money && view === "nivel" && mode === "nominal" && (
          <div className="note">
            Serie en pesos corrientes: en un contexto de alta inflación el crecimiento nominal
            sobreestima el real. Probá la vista en $ constantes o las variaciones interanuales
            comparadas con la inflación.
          </div>
        )}
      </div>
    </>
  );
}
