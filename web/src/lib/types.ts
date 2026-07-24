export type MetricUnit = "miles_pesos" | "millones_pesos" | "pct" | "veces" | "cantidad";

export interface MetricDef {
  label: string;
  unit: MetricUnit;
}

export interface EntityRef {
  code: string;
  nombre: string;
  alias: string;
  first: string;
  last: string;
  grupo: "publico" | "privado" | "financiera" | null;
}

export interface DataIndex {
  periods: string[];
  latest: string | null;
  groups: Record<string, string>;
  metrics: Record<string, MetricDef>;
  volume_keys: string[];
  series_breaks: Record<string, string>;
  entities: EntityRef[];
}

export type Series = Record<string, (number | null)[]>;

export interface SystemSeries {
  periods: string[];
  groups: Record<string, Series>;
}

export interface EntitySeries {
  code: string;
  nombre: string;
  m: Series;
}

export interface PeriodRow {
  code: string;
  nombre: string;
  alias?: string;
  [metric: string]: number | string | null | undefined;
}

export interface PeriodData {
  fecha: string;
  layout: "modern" | "old";
  entidades: PeriodRow[];
  agregados: Record<string, PeriodRow>;
}

export interface IpcData {
  base: string;
  latest: string;
  periods: string[];
  index: number[];
  sources: { desde: string; hasta: string; fuente: string }[];
}

export interface BalanceItem {
  codigo: string;
  nombre: string;
  nivel: number;
  valor: number | null;
}

export interface EntityMeta {
  code: string;
  nombre: string;
  alias: string;
  grupo: "publico" | "privado" | "financiera" | null;
  resena: string[];
  balance: BalanceItem[];
  logo: string | null;
  period: string;
  baja?: boolean;
  titulos?: { publicos: number; privados: number; otros: number } | null;
}
