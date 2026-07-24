import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import BalanceComposition from "../components/BalanceComposition";
import TimeSeriesChart from "../components/TimeSeriesChart";
import { loadEntity, loadMeta } from "../lib/data";
import { delta, fmtValue, money, num, PALETTE, periodLabel, shiftPeriod } from "../lib/format";
import { useCore } from "../lib/store";
import type { EntityMeta, EntitySeries, MetricUnit } from "../lib/types";

const STRIP_KEYS: { key: string; invert?: boolean }[] = [
  { key: "activo" }, { key: "depositos" }, { key: "prestamos" }, { key: "patrimonio" },
  { key: "mora", invert: true }, { key: "roe" }, { key: "roa" }, { key: "liquidez" },
  { key: "personal" },
];

const GRUPO_LABEL: Record<string, string> = {
  publico: "Banco público",
  privado: "Banco privado",
  financiera: "Compañía financiera",
};

function StripStat({ label, unit, value, prevMonth, prevYear, invert }: {
  label: string; unit: MetricUnit; value: number | null;
  prevMonth: number | null; prevYear: number | null; invert?: boolean;
}) {
  const tag = (t: string, prev: number | null) => {
    const d = delta(unit, value, prev);
    if (!d) return null;
    let cls: string = d.cls;
    if (invert && cls !== "mut") cls = cls === "pos" ? "neg" : "pos";
    return <span><span className="mut">{t} </span><b className={cls}>{d.text}</b></span>;
  };
  return (
    <div className="st">
      <div className="l">{label}</div>
      <div className="v">{fmtValue(value, unit)}</div>
      <div className="deltas">{tag("m/m", prevMonth)}{tag("i.a.", prevYear)}</div>
    </div>
  );
}

export default function Entidad() {
  const { code = "" } = useParams();
  const { index, system } = useCore();
  const [ent, setEnt] = useState<EntitySeries | null>(null);
  const [meta, setMeta] = useState<EntityMeta | null>(null);
  const [metric, setMetric] = useState("activo");
  const [showBalance, setShowBalance] = useState(false);

  useEffect(() => {
    setEnt(null); setMeta(null);
    loadEntity(code).then(setEnt).catch(() => setEnt(null));
    loadMeta(code).then(setMeta).catch(() => setMeta(null));
  }, [code]);

  const periods = system.periods;
  const ref = index.entities.find((e) => e.code === code);

  // último período con dato de activo (la entidad pudo haber dejado de existir)
  const lastIdx = useMemo(() => {
    const s = ent?.m?.activo ?? [];
    for (let i = s.length - 1; i >= 0; i--) if (s[i] != null) return i;
    return -1;
  }, [ent]);

  if (!ent && lastIdx === -1 && !ref) return <div className="loading">Entidad {code} no encontrada.</div>;
  if (!ent) return <div className="loading">Cargando…</div>;

  const def = index.metrics[metric];
  const inactive = ref && index.latest != null && ref.last !== index.latest;
  const base = lastIdx >= 0 ? periods[lastIdx] : null;
  const iPm = base ? periods.indexOf(shiftPeriod(base, -1)) : -1;
  const iPy = base ? periods.indexOf(shiftPeriod(base, -12)) : -1;

  return (
    <>
      <div className="enthead">
        {meta?.logo && <img src={`/logos/${meta.logo}`} alt="" />}
        <div>
          <h1>{ent.nombre}</h1>
          <div className="sub">
            {meta?.grupo && <span className={`grptag ${meta.grupo}`}>{GRUPO_LABEL[meta.grupo]}</span>}
            {ref && (
              <span style={{ marginLeft: meta?.grupo ? 10 : 0 }}>
                Datos desde {periodLabel(ref.first)}
                {inactive ? ` hasta ${periodLabel(ref.last)}` : ""}
              </span>
            )}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {lastIdx >= 0 && (
          <div style={{ textAlign: "right" }}>
            <div className="mut" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".5px" }}>
              Share del activo del sistema
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "var(--acc)" }}>
              {(() => {
                const v = ent.m.activo?.[lastIdx];
                const sys = system.groups.AA000?.activo?.[lastIdx];
                return v != null && sys ? num(100 * v / sys, 2) + "%" : "—";
              })()}
            </div>
          </div>
        )}
      </div>
      {inactive && (
        <div className="note" style={{ marginTop: 10 }}>
          Esta entidad dejó de informar en {periodLabel(ref!.last, true)} (fusión, absorción o baja —
          ver historia abajo).
        </div>
      )}

      <section>
        <p className="stitle">
          Indicadores · {base ? periodLabel(base, true) : "—"} · variación m/m e interanual
        </p>
        <div className="statstrip">
          {STRIP_KEYS.map(({ key, invert }) => {
            const s = ent.m[key] ?? [];
            return (
              <StripStat
                key={key}
                label={index.metrics[key].label}
                unit={index.metrics[key].unit}
                value={lastIdx >= 0 ? s[lastIdx] ?? null : null}
                prevMonth={iPm >= 0 ? s[iPm] : null}
                prevYear={iPy >= 0 ? s[iPy] : null}
                invert={invert}
              />
            );
          })}
        </div>
      </section>

      {meta && meta.balance.length > 0 && (
        <section>
          <div className="card">
            <h3>Composición del balance</h3>
            <div className="cs">
              {periodLabel(meta.period, true)} · rubros del balance resumido · títulos separados según
              el balance detallado
            </div>
            <BalanceComposition meta={meta} />
          </div>
        </section>
      )}

      <section>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <h3>Evolución histórica</h3>
              <div className="cs">Serie propia{def.unit === "pct" || def.unit === "veces" ? " vs. sistema" : ""}</div>
            </div>
            <select value={metric} onChange={(e) => setMetric(e.target.value)}>
              {Object.entries(index.metrics).map(([k, m]) => (
                <option key={k} value={k}>{m.label}</option>
              ))}
            </select>
          </div>
          <TimeSeriesChart
            periods={periods}
            datasets={[
              { label: ent.nombre, values: ent.m[metric] ?? [], color: PALETTE[0] },
              ...(def.unit === "pct" || def.unit === "veces"
                ? [{ label: "Sistema", values: system.groups.AA000?.[metric] ?? [], color: "#8a97b2" }]
                : []),
            ]}
            unit={def.unit}
          />
          {index.series_breaks[metric] && <div className="note">{index.series_breaks[metric]}</div>}
        </div>
      </section>

      <section>
        <div className="grid2">
          {meta && meta.balance.length > 0 && (
            <div className="card">
              <h3>Balance resumido</h3>
              <div className="cs">
                {periodLabel(meta.period, true)} · miles de pesos ·{" "}
                <button className="ctl" style={{ padding: "2px 8px", fontSize: 11 }} onClick={() => setShowBalance(!showBalance)}>
                  {showBalance ? "ver menos" : "ver detalle"}
                </button>
              </div>
              <div style={{ maxHeight: 460, overflow: "auto" }}>
                <table>
                  <tbody>
                    {meta.balance
                      .filter((b) => showBalance || b.nivel <= 1)
                      .map((b, i) => (
                        <tr key={i}>
                          <td className={`n balance-l${Math.min(b.nivel, 3)}`}>{b.nombre}</td>
                          <td className={b.nivel === 0 ? "balance-l0" : ""}>{money(b.valor)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {meta && meta.resena.length > 0 && (
            <div className="card">
              <h3>Historia</h3>
              <div className="cs">Reseña oficial (BCRA, Información Histórica)</div>
              <div className="resena" style={{ maxHeight: 460, overflow: "auto" }}>
                {meta.resena.map((p, i) =>
                  p.startsWith("— ") ? (
                    <p key={i} style={{ color: "var(--acc)", fontWeight: 650, marginTop: 12 }}>{p}</p>
                  ) : (
                    <p key={i}>{p}</p>
                  ),
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
