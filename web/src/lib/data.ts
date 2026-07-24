import type {
  DataIndex, EntityMeta, EntitySeries, IpcData, PeriodData, SystemSeries,
} from "./types";

const cache = new Map<string, Promise<unknown>>();

function fetchJson<T>(path: string): Promise<T> {
  let p = cache.get(path);
  if (!p) {
    p = fetch(path).then((r) => {
      if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
      return r.json();
    });
    cache.set(path, p);
  }
  return p as Promise<T>;
}

export const loadIndex = () => fetchJson<DataIndex>("/data/index.json");
export const loadSystem = () => fetchJson<SystemSeries>("/data/series/system.json");
export const loadEntity = (code: string) => fetchJson<EntitySeries>(`/data/series/entities/${code}.json`);
export const loadPeriod = (p: string) => fetchJson<PeriodData>(`/data/periods/${p}.json`);
export const loadIpc = () => fetchJson<IpcData>("/data/ipc.json");
export const loadMeta = (code: string) => fetchJson<EntityMeta>(`/data/meta/${code}.json`);
