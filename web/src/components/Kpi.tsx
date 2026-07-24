import { delta, fmtValue } from "../lib/format";
import type { MetricUnit } from "../lib/types";

interface Props {
  label: string;
  unit: MetricUnit;
  value: number | null;
  prevMonth?: number | null;
  prevYear?: number | null;
  /** para mora: subir es malo */
  invert?: boolean;
}

function DeltaTag({ tag, unit, cur, prev, invert }: {
  tag: string; unit: MetricUnit; cur: number | null; prev: number | null | undefined; invert?: boolean;
}) {
  const d = delta(unit, cur, prev);
  if (!d) return null;
  let cls: string = d.cls;
  if (invert && cls !== "mut") cls = cls === "pos" ? "neg" : "pos";
  return (
    <span>
      <span className="mut">{tag} </span>
      <b className={cls}>{d.text}</b>
    </span>
  );
}

export default function Kpi({ label, unit, value, prevMonth, prevYear, invert }: Props) {
  return (
    <div className="kpi">
      <div className="l">{label}</div>
      <div className="v">{fmtValue(value, unit)}</div>
      <div className="deltas">
        <DeltaTag tag="m/m" unit={unit} cur={value} prev={prevMonth} invert={invert} />
        <DeltaTag tag="i.a." unit={unit} cur={value} prev={prevYear} invert={invert} />
      </div>
    </div>
  );
}
