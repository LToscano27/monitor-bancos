"""Tasas de mercado que acompañan a los indicadores de la portada.

Fuente: API de Estadísticas Monetarias del BCRA (series diarias, en % nominal anual).
La portada muestra el último dato diario, comparado contra el de un mes y un año antes.
También se guarda el promedio de cada mes, alineado con los períodos del resto del sitio.

- tamar: TAMAR de bancos privados (variable 44, desde 2024-10)
- pases: operaciones de pases entre terceros a 1 día (variable 150, desde 2008)

Uso: python pipeline/tasas_mercado.py
"""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

import requests

REPO_ROOT = Path(__file__).resolve().parent.parent
OUT = REPO_ROOT / "data" / "tasas_mercado.json"

SERIES = {
    "tamar": (44, "Tasa TAMAR de bancos privados (TNA, %)"),
    "pases": (150, "Tasa de pases entre terceros a 1 día (TNA, %)"),
}
PRIMER_PERIODO = "201107"  # el sitio arranca acá; lo anterior no se usa
URL = "https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/{id}"
LIMIT = 3000


def fetch_diaria(id_variable: int) -> list[tuple[str, float]]:
    """[(AAAA-MM-DD, valor)] de toda la serie, ordenada por fecha."""
    filas: dict[str, float] = {}
    offset = 0
    while True:
        r = requests.get(URL.format(id=id_variable),
                         params={"Limit": LIMIT, "Offset": offset}, timeout=60)
        r.raise_for_status()
        detalle = r.json()["results"][0]["detalle"]
        for d in detalle:
            if d.get("valor") is not None:
                filas[d["fecha"][:10]] = float(d["valor"])
        if len(detalle) < LIMIT:
            break
        offset += LIMIT
    return sorted(filas.items())


def _valor_al(diaria: list[tuple[str, float]], fecha: str) -> float | None:
    """Último dato publicado en `fecha` o antes (los fines de semana no hay dato)."""
    previos = [v for f, v in diaria if f <= fecha]
    return previos[-1] if previos else None


def _restar_meses(fecha: str, meses: int) -> str:
    y, m, d = int(fecha[:4]), int(fecha[5:7]), int(fecha[8:10])
    t = y * 12 + (m - 1) - meses
    return f"{t // 12:04d}-{t % 12 + 1:02d}-{d:02d}"


def promedio_mensual(id_variable: int, descripcion: str) -> dict:
    diaria = fetch_diaria(id_variable)
    if not diaria:
        raise RuntimeError(f"la API del BCRA no devolvió datos de la variable {id_variable}")
    por_mes: dict[str, list[float]] = defaultdict(list)
    for fecha, valor in diaria:
        por_mes[fecha[:4] + fecha[5:7]].append(valor)
    periods = sorted(p for p in por_mes if p >= PRIMER_PERIODO)
    return {
        "descripcion": descripcion,
        "variable": id_variable,
        "periods": periods,
        "promedio": [round(sum(por_mes[p]) / len(por_mes[p]), 4) for p in periods],
        "ultimo": {"fecha": diaria[-1][0], "valor": diaria[-1][1]},
        "hace_un_mes": _valor_al(diaria, _restar_meses(diaria[-1][0], 1)),
        "hace_un_anio": _valor_al(diaria, _restar_meses(diaria[-1][0], 12)),
    }


def build() -> dict:
    return {
        "fuente": "BCRA, API de Estadísticas Monetarias",
        "series": {k: promedio_mensual(i, d) for k, (i, d) in SERIES.items()},
    }


def main() -> None:
    data = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    for k, s in data["series"].items():
        print(f"{k}: {s['periods'][0]} -> {s['periods'][-1]} "
              f"(último dato diario {s['ultimo']['fecha']}: {s['ultimo']['valor']}%)")


if __name__ == "__main__":
    main()
