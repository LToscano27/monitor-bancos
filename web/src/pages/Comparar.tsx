import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import EntityPicker from "../components/EntityPicker";
import TimeSeriesChart from "../components/TimeSeriesChart";
import { loadEntity } from "../lib/data";
import { fmtValue, PALETTE, shortName } from "../lib/format";
import { useCore } from "../lib/store";
import type { Series as SeriesMap } from "../lib/types";

const COMPARE_KEYS = [
  "activo", "depositos", "prestamos", "patrimonio", "personal",
  "mora", "roe", "roa", "liquidez", "apalancamiento", "e4",
];

const DEFAULTS = ["00007", "00011"]; // Galicia y Nación como arranque ilustrativo

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
      .filter((c) => !series[c])
      .forEach((c) => loadEntity(c).then((e) => setSeries((prev) => ({ ...prev, [c]: e.m }))));
  }, [codes, series]);

  const nameOf = (code: string) =>
    shortName(index.entities.find((e) => e.code === code)?.nombre ?? code);

  const def = index.metrics[metric];
  const datasets = useMemo(
    () =>
      codes
        .filter((c) => series[c])
        .map((c, i) => ({
          label: nameOf(c),
          values: series[c][metric] ?? [],
          color: PALETTE[i % PALETTE.length],
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [codes, series, metric],
  );

  return (
    <>
      <h1 className="pagetitle">Comparador de entidades</h1>
      <div className="pagesub">Elegí dos o más bancos y compará sus métricas y su evolución.</div>

      <div className="controls">
        <EntityPicker
          entities={index.entities}
          exclude={codes}
          onPick={(c) => codes.length < 6 && setCodes([...codes, c])}
          placeholder="Agregar entidad al comparador…"
        />
        <div className="chips">
          {codes.map((c, i) => (
            <span key={c} className="chip" style={{ borderColor: PALETTE[i % PALETTE.length] }}>
              <span style={{ color: PALETTE[i % PALETTE.length] }}>●</span> {nameOf(c)}
              <button onClick={() => setCodes(codes.filter((x) => x !== c))}>×</button>
            </span>
          ))}
        </div>
      </div>

      {codes.length < 2 ? (
        <div className="loading">Agregá al menos dos entidades para comparar.</div>
      ) : (
        <>
          <div className="card">
            <h3>Métricas al último período</h3>
            <div className="cs">Valores publicados por el BCRA</div>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th className="n">Métrica</th>
                    {codes.map((c, i) => (
                      <th key={c}>
                        <Link to={`/entidad/${c}`} style={{ color: PALETTE[i % PALETTE.length] }}>
                          {nameOf(c)}
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_KEYS.map((k) => (
                    <tr key={k}>
                      <td className="n">{index.metrics[k].label}</td>
                      {codes.map((c) => (
                        <td key={c}>
                          {series[c] ? fmtValue(series[c][k]?.[last] ?? null, index.metrics[k].unit) : "…"}
                        </td>
                      ))}
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
