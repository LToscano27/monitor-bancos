import { useMemo, useRef, useState } from "react";
import { shortName } from "../lib/format";
import type { EntityRef } from "../lib/types";

export interface GroupOption {
  code: string;
  label: string;
}

interface Props {
  entities: EntityRef[];
  exclude?: string[];
  /** opciones de agrupamiento fijadas arriba del listado (sistema, privados, públicos) */
  groups?: GroupOption[];
  onPick: (code: string) => void;
  placeholder?: string;
}

/** Buscador de entidades (y agregados) con lupa y dropdown filtrado. */
export default function EntityPicker({ entities, exclude = [], groups = [], onPick, placeholder }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const t = q.trim().toLowerCase();

  const groupMatches = useMemo(
    () => groups.filter((g) => !exclude.includes(g.code)).filter((g) => !t || g.label.toLowerCase().includes(t)),
    [groups, exclude, t],
  );

  const matches = useMemo(
    () =>
      entities
        .filter((e) => !exclude.includes(e.code))
        .filter((e) =>
          !t ||
          e.nombre.toLowerCase().includes(t) ||
          e.alias.toLowerCase().includes(t) ||
          e.code.includes(t),
        ),
    [entities, exclude, t],
  );

  const pick = (code: string) => { onPick(code); setQ(""); setOpen(false); };
  const hasResults = groupMatches.length > 0 || matches.length > 0;

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--mut)", display: "flex" }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.5" y2="16.5" />
        </svg>
      </span>
      <input
        type="search"
        value={q}
        placeholder={placeholder ?? "Buscar entidad…"}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={{ minWidth: 260, paddingLeft: 30 }}
      />
      {open && hasResults && (
        <div
          style={{
            position: "absolute", top: "105%", left: 0, zIndex: 30, minWidth: 320,
            background: "var(--panel2)", border: "1px solid var(--line)", borderRadius: 10,
            maxHeight: 340, overflow: "auto", boxShadow: "0 8px 24px rgba(0,0,0,.35)",
          }}
        >
          {groupMatches.map((g) => (
            <div
              key={g.code}
              onMouseDown={() => pick(g.code)}
              style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}
              onMouseEnter={(ev) => (ev.currentTarget.style.background = "var(--panel)")}
              onMouseLeave={(ev) => (ev.currentTarget.style.background = "")}
            >
              <b style={{ color: "var(--acc)" }}>{g.label}</b>
              <span className="mut" style={{ fontSize: 11 }}>agregado</span>
            </div>
          ))}
          {matches.map((e) => (
            <div
              key={e.code}
              onMouseDown={() => pick(e.code)}
              style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13 }}
              onMouseEnter={(ev) => (ev.currentTarget.style.background = "var(--panel)")}
              onMouseLeave={(ev) => (ev.currentTarget.style.background = "")}
            >
              <b>{shortName(e.nombre)}</b>
              {e.alias && (
                <span className="mut" style={{ marginLeft: 8, fontSize: 11.5 }}>{e.alias}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
