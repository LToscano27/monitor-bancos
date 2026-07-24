import type { IpcData } from "./types";

/**
 * Deflactor a pesos constantes del período de referencia (normalmente el último
 * publicado por el BCRA): nominal * ipc[ref] / ipc[t].
 */
export function makeDeflator(ipc: IpcData, refPeriod: string): (v: number | null, period: string) => number | null {
  const idx = new Map(ipc.periods.map((p, i) => [p, ipc.index[i]]));
  const ref = idx.get(refPeriod) ?? ipc.index[ipc.index.length - 1];
  return (v, period) => {
    if (v == null) return null;
    const base = idx.get(period);
    if (base == null) return null;
    return (v * ref) / base;
  };
}

/** Deflacta un array de series alineado con `periods`. */
export function deflateSeries(
  values: (number | null)[],
  periods: string[],
  ipc: IpcData,
  refPeriod: string,
): (number | null)[] {
  const d = makeDeflator(ipc, refPeriod);
  return values.map((v, i) => d(v, periods[i]));
}
