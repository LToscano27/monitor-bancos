import type { MetricUnit } from "./types";

const MESES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];
const MESES_LARGO = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** Suma `months` (puede ser negativo) a un período AAAAMM. */
export function shiftPeriod(p: string, months: number): string {
  const total = parseInt(p.slice(0, 4), 10) * 12 + (parseInt(p.slice(4), 10) - 1) + months;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return `${y}${String(m).padStart(2, "0")}`;
}

export function periodLabel(p: string, largo = false): string {
  const m = parseInt(p.slice(4), 10) - 1;
  return `${(largo ? MESES_LARGO : MESES)[m]} ${p.slice(0, 4)}`;
}

/** Montos del BCRA vienen en miles de pesos. */
export function money(vMiles: number | null | undefined, digits = 1): string {
  if (vMiles == null) return "—";
  const p = vMiles * 1000;
  const abs = Math.abs(p);
  if (abs >= 1e12) return "$" + (p / 1e12).toLocaleString("es-AR", { maximumFractionDigits: digits }) + " B";
  if (abs >= 1e9) return "$" + (p / 1e9).toLocaleString("es-AR", { maximumFractionDigits: digits }) + " MM";
  if (abs >= 1e6) return "$" + (p / 1e6).toLocaleString("es-AR", { maximumFractionDigits: 0 }) + " M";
  return "$" + p.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

export function pct(v: number | null | undefined, digits = 2): string {
  if (v == null) return "—";
  return v.toLocaleString("es-AR", { maximumFractionDigits: digits }) + "%";
}

export function num(v: number | null | undefined, digits = 0): string {
  if (v == null) return "—";
  return v.toLocaleString("es-AR", { maximumFractionDigits: digits });
}

export function fmtValue(v: number | null | undefined, unit: MetricUnit): string {
  switch (unit) {
    case "miles_pesos": return money(v);
    case "millones_pesos": return v == null ? "—" : "$" + num(v, 1) + " M";
    case "pct": return pct(v);
    case "veces": return v == null ? "—" : num(v, 2) + "×";
    case "cantidad": return num(v);
  }
}

export function isMoney(unit: MetricUnit): boolean {
  return unit === "miles_pesos" || unit === "millones_pesos";
}

/**
 * Variación entre dos valores según la unidad:
 * - montos y cantidades: variación porcentual
 * - ratios (%, veces): diferencia en puntos (p.p. / veces)
 */
export function delta(unit: MetricUnit, cur: number | null | undefined, prev: number | null | undefined):
  { text: string; cls: "pos" | "neg" | "mut" } | null {
  if (cur == null || prev == null) return null;
  if (isMoney(unit) || unit === "cantidad") {
    if (prev === 0) return null;
    const d = 100 * (cur / prev - 1);
    return {
      text: (d >= 0 ? "+" : "") + d.toLocaleString("es-AR", { maximumFractionDigits: 1 }) + "%",
      cls: d > 0.05 ? "pos" : d < -0.05 ? "neg" : "mut",
    };
  }
  const d = cur - prev;
  const suf = unit === "veces" ? "×" : " pp";
  return {
    text: (d >= 0 ? "+" : "") + d.toLocaleString("es-AR", { maximumFractionDigits: 2 }) + suf,
    cls: d > 0.005 ? "pos" : d < -0.005 ? "neg" : "mut",
  };
}

/** Nombre corto de entidad para gráficos y tablas. */
export function shortName(n: string): string {
  return n
    .replace(/BANCO DE LA /i, "")
    .replace(/BANCO /i, "")
    .replace(/COMPAÑ[IÍ]A FINANCIERA /i, "")
    .replace(/ S\.?\s?A\.?U?\.?$/i, "")
    .replace(/ SOCIEDAD ANONIMA.*/i, "")
    .replace(/ COOPERATIVO.*/i, " (Credicoop)")
    .replace(/ARGENTINA/i, "")
    .replace(/\(\s*\)/g, "")
    .replace(/^DE /i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const GROUP_LABELS: Record<string, string> = {
  AA000: "Sistema",
  AA110: "Públicos",
  AA120: "Privados",
};

export const PALETTE = [
  "#4da3ff", "#33d69f", "#ffb454", "#ff6b6b", "#b98cff",
  "#5ad0e6", "#f2789f", "#9edd72", "#e0c068", "#8a97b2",
];
