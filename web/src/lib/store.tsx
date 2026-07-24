import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { loadIndex, loadIpc, loadSystem } from "./data";
import type { DataIndex, IpcData, SystemSeries } from "./types";

export interface CoreData {
  index: DataIndex;
  system: SystemSeries;
  ipc: IpcData | null;
}

const Ctx = createContext<CoreData | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [core, setCore] = useState<CoreData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      loadIndex(),
      loadSystem(),
      loadIpc().catch(() => null), // sin IPC igual funciona todo lo nominal
    ])
      .then(([index, system, ipc]) => setCore({ index, system, ipc }))
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <div className="loading">Error cargando datos: {error}</div>;
  if (!core) return <div className="loading">Cargando datos…</div>;
  return <Ctx.Provider value={core}>{children}</Ctx.Provider>;
}

export function useCore(): CoreData {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCore fuera de DataProvider");
  return v;
}
