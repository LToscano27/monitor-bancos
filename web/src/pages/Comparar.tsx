import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import EntityPicker from "../components/EntityPicker";
import TimeSeriesChart from "../components/TimeSeriesChart";
import { loadEntity } from "../lib/data";
import { fmtValue, GROUP_LABELS, PALETTE, shortName } from "../lib/format";
import { useCore } from "../lib/store";
import type { Series as SeriesMap } from "../lib/types";

const COMPARE_KEYS = [
  "activo", "depositos", "prestamos", "patrimonio", "personal",
  "mora", "roe", "roa", "liquidez", "apalancamiento", "e4",
];

const DEFAULTS = ["00007", "00011"]; // Galicia y Nación como arranque ilustrativo
const GROUP_OPTS = [
  { code: "AA000", label: "Sistema financiero" },
  { code: "AA120", label: "Bancos privados" },
  { code: "AA110", label: "Bancos públicos" },
];

export default function Comparar() {
  const { index, system } = useCore();
  const periods = system.periods;
  const last = periods.length - 1;

  const [codes, setCodes] = useState<string[]>(() =>
    DEFAULTS.filter((c) => index.entities.some((e) => e.code === c)),
  );
  const [series, setSeries] = useState<Record<string, SeriesMap>>({});
  const [metric, setMetric] = useState("activo");

  useEffect(() => {
    codes
      .filter((c) => !c.startsWith("AA") && !series[c])
      .forEach((c) => loadEntity(c).then((e) => setSeries((prev) => ({ ...prev, [c]: e.m }))));
  }, [codes, series]);

  const seriesFor = (c: string): SeriesMap | undefined =>
    c.startsWith("AA") ? system.groups[c] : series[c];

  const nameOf = (code: string) =>
    GROUP_LABELS[code] ?? shortName(index.entities.find((e) => e.code === code)?.nombre ?? code);

  const def = index.metrics[metric];
  const datasets = useMemo(
    () =>
      codes
        .filter((c) => seriesFor(c))
        .map((c, i) => ({
          label: nameOf(c),
          values: seriesFor(c)![metric] ?? [],
          color: c === "AA000" ? "#8a97b2" : PALETTE[i % PALETTE.length],
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [codes, series, metric, system],
  );

  const colorOf = (c: string, i: number) => (c === "AA000" ? "#8a97b2" : PALETTE[i % PALETTE.length]);

  return (
    <>
      <h1 className="pagetitle">Comparador de entidades</h1>
      <div className="pagesub">
        Elegí dos o más bancos — o el sistema financiero como benchmark — y compará métricas y evolución.
      </div>

      <div className="controls">
        <EntityPicker
          entities={index.entities}
          groups={GROUP_OPTS}
          exclude={codes}
          onPick={(c) => codes.length < 6 && setCodes([...codes, c])}
          placeholder="Buscar entidad, o sistema/grupo como benchmark…"
        />
      </div>
      <div className="chips" style={{ marginBottom: 14 }}>
        {codes.map((c, i) => (
          <span key={c} className="chip" style={{ borderColor: colorOf(c, i) }}>
            <span style={{ color: colorOf(c, i) }}>●</span> {nameOf(c)}
            <button onClick={() => setCodes(codes.filter((x) => x !== c))}>×</button>
          </span>
        ))}
      </div>

      {codes.length < 2 ? (
        <div className="loading">Agregá al menos dos entidades (o una entidad y el sistema) para comparar.</div>
      ) : (
        <>
          <div className="card">
            <h3>Métricas al último período</h3>
            <div className="cs">
              Valores publicados por el BCRA. Los ratios de los agregados (sistema/grupos) ya vienen
              ponderados y sirven de benchmark; sus montos son totales del agrupamiento.
            </div>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th className="n">Métrica</th>
                    {codes.map((c, i) => (
                      <th key={c}>
                        {c.startsWith("AA") ? (
                          <span style={{ color: colorOf(c, i) }}>{nameOf(c)}</span>
                        ) : (
                          <Link to={`/entidad/${c}`} style={{ color: colorOf(c, i) }}>{nameOf(c)}</Link>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_KEYS.map((k) => (
                    <tr key={k}>
                      <td className="n">{index.metrics[k].label}</td>
                      {codes.map((c) => {
                        const s = seriesFor(c);
                        return (
                          <td key={c}>
                            {s ? fmtValue(s[k]?.[last] ?? null, index.metrics[k].unit) : "…"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <section>
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <h3>Evolución comparada</h3>
                <select value={metric} onChange={(e) => setMetric(e.target.value)}>
                  {Object.entries(index.metrics).map(([k, m]) => (
                    <option key={k} value={k}>{m.label}</option>
                  ))}
                </select>
              </div>
              <TimeSeriesChart periods={periods} datasets={datasets} unit={def.unit} />
              {index.series_breaks[metric] && <div className="note">{index.series_breaks[metric]}</div>}
            </div>
          </section>
        </>
      )}
    </>
  );
}
