import { useMemo, useRef, useState } from "react";
import { shortName } from "../lib/format";
import type { EntityRef } from "../lib/types";

interface Props {
  entities: EntityRef[];
  exclude?: string[];
  onPick: (code: string) => void;
  placeholder?: string;
}

/** Buscador de entidades con dropdown filtrado. */
export default function EntityPicker({ entities, exclude = [], onPick, placeholder }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    return entities
      .filter((e) => !exclude.includes(e.code))
      .filter((e) =>
        !t ||
        e.nombre.toLowerCase().includes(t) ||
        e.alias.toLowerCase().includes(t) ||
        e.code.includes(t),
      )
      .slice(0, 12);
  }, [entities, exclude, q]);

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <input
        type="search"
        value={q}
        placeholder={placeholder ?? "Buscar entidad…"}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={{ minWidth: 240 }}
      />
      {open && matches.length > 0 && (
        <div
          style={{
            position: "absolute", top: "105%", left: 0, zIndex: 30, minWidth: 300,
            background: "var(--panel2)", border: "1px solid var(--line)", borderRadius: 10,
            maxHeight: 320, overflow: "auto", boxShadow: "0 8px 24px rgba(0,0,0,.4)",
          }}
        >
          {matches.map((e) => (
            <div
              key={e.code}
              onMouseDown={() => { onPick(e.code); setQ(""); setOpen(false); }}
              style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13 }}
              onMouseEnter={(ev) => (ev.currentTarget.style.background = "var(--panel)")}
              onMouseLeave={(ev) => (ev.currentTarget.style.background = "")}
            >
              <b>{shortName(e.nombre)}</b>
              <span className="mut" style={{ marginLeft: 8, fontSize: 11.5 }}>
                {e.code}{e.last ? ` · hasta ${e.last.slice(0, 4)}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
