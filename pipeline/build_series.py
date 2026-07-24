"""Consolida data/periods/*.json en series temporales + índice de catálogo.

Salidas:
- data/series/system.json           series de AA000 / AA110 / AA120 (todas las métricas)
- data/series/entities/{code}.json  serie por entidad individual
- data/index.json                   catálogo: períodos, entidades, métricas, quiebres

Todos los arrays de series están alineados con la lista global de períodos (null donde la
entidad no existía o la métrica no estaba disponible).
"""

from __future__ import annotations

import json
from pathlib import Path

from parse import MODERN_KEYS, SERIES_BREAKS, VOLUME_KEYS

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"

GROUPS = {
    "AA000": "Sistema financiero",
    "AA110": "Bancos públicos",
    "AA120": "Bancos privados",
}

# Diccionario de métricas para la UI (etiquetas del tit_rank moderno, resumidas).
METRICS = {
    "activo":          {"label": "Activo", "unit": "miles_pesos"},
    "prestamos":       {"label": "Préstamos", "unit": "miles_pesos"},
    "depositos":       {"label": "Depósitos", "unit": "miles_pesos"},
    "patrimonio":      {"label": "Patrimonio neto", "unit": "miles_pesos"},
    "ctas_corrientes": {"label": "Cuentas corrientes (cantidad)", "unit": "cantidad"},
    "cajas_ahorro":    {"label": "Cajas de ahorro (cantidad)", "unit": "cantidad"},
    "plazos_fijos":    {"label": "Plazos fijos (cantidad)", "unit": "cantidad"},
    "ops_prestamos":   {"label": "Operaciones de préstamo (cantidad)", "unit": "cantidad"},
    "personal":        {"label": "Dotación de personal", "unit": "cantidad"},
    "apalancamiento":  {"label": "Apalancamiento (veces)", "unit": "veces"},
    "c2":     {"label": "C2 — Pérdida potencial cartera sit. 2-5", "unit": "pct"},
    "c3":     {"label": "C3 — Pérdida potencial cartera sit. 3-5", "unit": "pct"},
    "a11":    {"label": "A11 — Cartera irregular sector privado", "unit": "pct"},
    "a12":    {"label": "A12 — Participación cartera comercial", "unit": "pct"},
    "a13":    {"label": "A13 — Participación cartera consumo", "unit": "pct"},
    "a14":    {"label": "A14 — Previsiones / cartera irregular", "unit": "pct"},
    "a16":    {"label": "A16 — Cartera irregular consumo", "unit": "pct"},
    "a17":    {"label": "A17 — Cartera irregular comercial", "unit": "pct"},
    "a21":    {"label": "A21 — Posición de previsiones mínimas", "unit": "pct"},
    "mora":   {"label": "Mora (cartera irregular / financiaciones)", "unit": "pct"},
    "ag29":   {"label": "AG29 — Efectivo y dep. en bancos / activo", "unit": "pct"},
    "ag3":    {"label": "AG3 — Cartera vencida sector privado", "unit": "pct"},
    "e1":     {"label": "E1 — Absorción de gastos adm.", "unit": "pct"},
    "e2":     {"label": "E2 — Margen operativo / gastos estructura", "unit": "pct"},
    "e4":     {"label": "E4 — Depósitos por empleado (millones $)", "unit": "millones_pesos"},
    "e5":     {"label": "E5 — Financiaciones por empleado (millones $)", "unit": "millones_pesos"},
    "roe":    {"label": "ROE — Rendimiento anual del patrimonio", "unit": "pct"},
    "r17":    {"label": "R17 — Gastos en personal / gastos adm.", "unit": "pct"},
    "r2":     {"label": "R2 — Rendimiento ordinario del patrimonio", "unit": "pct"},
    "r8":     {"label": "R8 — Tasa implícita préstamos", "unit": "pct"},
    "r9":     {"label": "R9 — Tasa implícita depósitos", "unit": "pct"},
    "roa":    {"label": "ROA — Retorno sobre activos", "unit": "pct"},
    "rg15":   {"label": "RG15 — ROA antes de imp. a las ganancias", "unit": "pct"},
    "rg2_ii": {"label": "RG2 — Margen financiero / activo", "unit": "pct"},
    "rg3":    {"label": "RG3 — Cargos por incobrabilidad / activo", "unit": "pct"},
    "rg4_ii": {"label": "RG4 — Resultados por servicios / activo", "unit": "pct"},
    "rg5":    {"label": "RG5 — Gastos de administración / activo", "unit": "pct"},
    "liquidez": {"label": "Liquidez amplia", "unit": "pct"},
    "l8_ii":  {"label": "L8 — Liquidez con títulos con cotización", "unit": "pct"},
    "l9":     {"label": "L9 — Liquidez con LELIQ, pases y LEFI", "unit": "pct"},
}

# Métricas de la ficha/series por entidad (las 40 completas pesan poco, van todas).
SERIES_KEYS = MODERN_KEYS


def load_periods() -> list[dict]:
    files = sorted((DATA_DIR / "periods").glob("*.json"))
    out = []
    seen: set[str] = set()
    for f in files:
        with open(f, encoding="utf-8") as fh:
            data = json.load(fh)
        # defensa contra dumps stale: un mismo período no puede aparecer dos veces
        if data["fecha"] in seen:
            continue
        seen.add(data["fecha"])
        out.append(data)
    return out


def build() -> dict:
    periods_data = load_periods()
    periods = [p["fecha"] for p in periods_data]
    n = len(periods)

    # --- series por grupo ---
    system = {"periods": periods, "groups": {}}
    for gcode in GROUPS:
        series = {k: [None] * n for k in SERIES_KEYS}
        for i, p in enumerate(periods_data):
            row = p["agregados"].get(gcode)
            if row:
                for k in SERIES_KEYS:
                    series[k][i] = row.get(k)
        system["groups"][gcode] = series

    # --- series por entidad ---
    ent_meta: dict[str, dict] = {}
    ent_series: dict[str, dict] = {}
    for i, p in enumerate(periods_data):
        for row in p["entidades"]:
            code = row["code"]
            if code not in ent_series:
                ent_series[code] = {k: [None] * n for k in SERIES_KEYS}
                ent_meta[code] = {"code": code, "nombre": row.get("nombre", ""),
                                  "alias": row.get("alias", ""), "first": p["fecha"]}
            for k in SERIES_KEYS:
                ent_series[code][k][i] = row.get(k)
            meta = ent_meta[code]
            meta["last"] = p["fecha"]
            if row.get("nombre"):
                meta["nombre"] = row["nombre"]  # el nombre más reciente gana
            if row.get("alias"):
                meta["alias"] = row["alias"]

    ent_dir = DATA_DIR / "series" / "entities"
    ent_dir.mkdir(parents=True, exist_ok=True)
    for old in ent_dir.glob("*.json"):
        old.unlink()
    for code, series in ent_series.items():
        with open(ent_dir / f"{code}.json", "w", encoding="utf-8") as f:
            json.dump({"code": code, "nombre": ent_meta[code]["nombre"], "m": series},
                      f, ensure_ascii=False, separators=(",", ":"))

    (DATA_DIR / "series").mkdir(parents=True, exist_ok=True)
    with open(DATA_DIR / "series" / "system.json", "w", encoding="utf-8") as f:
        json.dump(system, f, ensure_ascii=False, separators=(",", ":"))

    # --- index ---
    # grupo institucional de cada entidad según meta/{code}.json si existe (lo arma build_meta)
    for code, meta in ent_meta.items():
        mfile = DATA_DIR / "meta" / f"{code}.json"
        if mfile.exists():
            with open(mfile, encoding="utf-8") as f:
                meta["grupo"] = json.load(f).get("grupo")
        else:
            meta["grupo"] = None

    # En los buscadores solo se ofrecen las entidades que siguen operando (las que
    # reportan en el último período). Las que dieron de baja quedan en los períodos y
    # series históricas (y accesibles por URL directa), pero no como opción seleccionable.
    latest = periods[-1] if periods else None
    activas = [e for e in ent_meta.values() if e["last"] == latest]

    index = {
        "periods": periods,
        "latest": latest,
        "groups": GROUPS,
        "metrics": METRICS,
        "volume_keys": VOLUME_KEYS,
        "series_breaks": SERIES_BREAKS,
        "entities": sorted(activas, key=lambda e: e["code"]),
    }
    with open(DATA_DIR / "index.json", "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))
    print(f"entidades activas en el índice: {len(activas)} de {len(ent_meta)} históricas")
    return index


if __name__ == "__main__":
    idx = build()
    print(f"series consolidadas: {len(idx['periods'])} períodos, {len(idx['entities'])} entidades")
