import { useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import "../lib/charts";
import { money, num } from "../lib/format";
import { chartColors, useTheme } from "../lib/theme";
import type { BalanceItem, EntityMeta } from "../lib/types";

const COLORS = [
  "#4da3ff", "#33d69f", "#ffb454", "#b98cff", "#5ad0e6",
  "#f2789f", "#9edd72", "#e0c068", "#ff8f6b", "#8a97b2",
];

interface Slice {
  label: string;
  value: number;
  /** nunca agrupar esta porción dentro de "Otros" (p.ej. el split de títulos) */
  keep?: boolean;
}

/** Rubros nivel 1 bajo un encabezado nivel 0 dado ("A C T I V O" / "P A S I V O"). */
function rubrosDe(balance: BalanceItem[], header: string): BalanceItem[] {
  const out: BalanceItem[] = [];
  let dentro = false;
  for (const it of balance) {
    if (it.nivel === 0) {
      dentro = it.nombre.replace(/\s+/g, "") === header.replace(/\s+/g, "");
      continue;
    }
    if (dentro && it.nivel === 1 && it.valor != null && it.valor > 0) out.push(it);
  }
  return out;
}

function buildSlices(items: BalanceItem[], titulos?: EntityMeta["titulos"]): Slice[] {
  let slices: Slice[] = items.map((it) => ({ label: it.nombre, value: it.valor as number }));
  // separar títulos públicos vs privados si tenemos el detalle de baldet
  if (titulos) {
    const i = slices.findIndex((s) => /t[ií]tulos p[uú]blicos y privados/i.test(s.label));
    if (i >= 0) {
      const otros = titulos.otros ?? 0;
      slices.splice(i, 1,
        { label: "Títulos públicos", value: titulos.publicos + otros, keep: true },
        { label: "Títulos privados", value: titulos.privados, keep: true },
      );
    }
  }
  slices.sort((a, b) => b.value - a.value);
  // agrupar rubros menores al 2,5% para que el gráfico respire (el split de títulos
  // nunca se agrupa: es justamente el detalle que se quiere ver)
  const total = slices.reduce((s, x) => s + x.value, 0);
  const grandes = slices.filter((s) => s.keep || s.value / total >= 0.025);
  const resto = slices.filter((s) => !s.keep && s.value / total < 0.025);
  if (resto.length > 1) {
    grandes.push({ label: "Otros rubros", value: resto.reduce((s, x) => s + x.value, 0) });
    return grandes;
  }
  return slices;
}

function CompositionDonut({ title, slices }: { title: string; slices: Slice[] }) {
  const { theme } = useTheme();
  const c = chartColors(theme);
  const total = slices.reduce((s, x) => s + x.value, 0);
  return (
    <div>
      <div className="cs" style={{ marginBottom: 4 }}>
        <b style={{ color: "var(--txt)" }}>{title}</b> · {money(total)}
      </div>
      <div className="chartbox xs">
        <Doughnut
          data={{
            labels: slices.map((s) => s.label),
            datasets: [{ data: slices.map((s) => s.value), backgroundColor: COLORS, borderWidth: 0 }],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            cutout: "55%",
            plugins: {
              legend: { position: "right", labels: { color: c.txt, boxWidth: 11, font: { size: 11 } } },
              tooltip: {
                callbacks: {
                  label: (ctx) =>
                    `${ctx.label}: ${money(ctx.raw as number)} (${num(100 * (ctx.raw as number) / total, 1)}%)`,
                },
              },
            },
          }}
        />
      </div>
    </div>
  );
}

/** Composición del activo y del pasivo a partir del balance resumido (+ split de títulos). */
export default function BalanceComposition({ meta }: { meta: EntityMeta }) {
  const activo = useMemo(() => buildSlices(rubrosDe(meta.balance, "ACTIVO"), meta.titulos), [meta]);
  const pasivo = useMemo(() => buildSlices(rubrosDe(meta.balance, "PASIVO")), [meta]);
  if (activo.length === 0 && pasivo.length === 0) return null;
  return (
    <div className="grid2">
      {activo.length > 0 && <CompositionDonut title="Composición del activo" slices={activo} />}
      {pasivo.length > 0 && <CompositionDonut title="Composición del pasivo" slices={pasivo} />}
    </div>
  );
}
