import { shiftPeriod } from "./format";
import type { IpcData, Series } from "./types";

/**
 * ROE y ROA en un mismo criterio real para toda la serie.
 *
 * Desde `desde` (enero de 2020) los balances se presentan ajustados por inflación y el
 * indicador publicado ya es un rendimiento real: se deja tal cual. Antes es nominal y se
 * convierte así:
 *
 *   ROE real = (1 + ROE nominal) / (1 + inflación interanual) − 1
 *
 * El ROA no se puede deflactar de la misma forma: la inflación erosiona el patrimonio,
 * no todo el activo. Se escala el ROE real por el mismo apalancamiento que relaciona los
 * dos indicadores publicados (ROA / ROE); si esa relación no es utilizable, por
 * patrimonio / activo.
 *
 * Verificado contra los cierres de 2012 a 2019: el ROE real así calculado replica la
 * variación real del patrimonio neto del sistema (2016: −7,1% contra −7,1%).
 */
export function realHomogeneo(
  metric: "roe" | "roa",
  src: Series,
  periods: string[],
  ipc: IpcData,
  desde: string,
): (number | null)[] {
  const idx = new Map(ipc.periods.map((p, i) => [p, ipc.index[i]]));
  return periods.map((p, i) => {
    const publicado = src[metric]?.[i] ?? null;
    if (p >= desde) return publicado;

    const roe = src.roe?.[i];
    const ahora = idx.get(p);
    const antes = idx.get(shiftPeriod(p, -12));
    if (roe == null || ahora == null || antes == null) return null;
    const roeReal = ((1 + roe / 100) / (ahora / antes) - 1) * 100;
    if (metric === "roe") return roeReal;

    const roa = src.roa?.[i];
    let apalancamiento: number | null = null;
    if (roa != null && Math.abs(roe) >= 1 && roa / roe > 0 && roa / roe < 1) {
      apalancamiento = roa / roe;
    } else {
      const pn = src.patrimonio?.[i];
      const activo = src.activo?.[i];
      if (pn != null && activo) apalancamiento = pn / activo;
    }
    return apalancamiento == null ? null : roeReal * apalancamiento;
  });
}
