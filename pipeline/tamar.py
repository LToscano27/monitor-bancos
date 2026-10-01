"""Tasa TAMAR de bancos privados (TNA), promedio mensual.

Fuente: API de Estadísticas Monetarias del BCRA, variable 44 (serie diaria, desde
2024-10-01). Se guarda el promedio de cada mes para poder alinearla con los períodos
del resto del sitio.

Uso: python pipeline/tamar.py
"""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

import requests

REPO_ROOT = Path(__file__).resolve().parent.parent
OUT = REPO_ROOT / "data" / "tamar.json"

ID_VARIABLE = 44
URL = f"https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/{ID_VARIABLE}"
LIMIT = 3000


def fetch_diaria() -> list[tuple[str, float]]:
    """[(AAAA-MM-DD, valor)] de toda la serie, ordenada por fecha."""
    filas: dict[str, float] = {}
    offset = 0
    while True:
        r = requests.get(URL, params={"Limit": LIMIT, "Offset": offset}, timeout=60)
        r.raise_for_status()
        detalle = r.json()["results"][0]["detalle"]
        for d in detalle:
            if d.get("valor") is not None:
                filas[d["fecha"][:10]] = float(d["valor"])
        if len(detalle) < LIMIT:
            break
        offset += LIMIT
    return sorted(filas.items())


def build() -> dict:
    diaria = fetch_diaria()
    if not diaria:
        raise RuntimeError("la API del BCRA no devolvió datos de TAMAR")
    por_mes: dict[str, list[float]] = defaultdict(list)
    for fecha, valor in diaria:
        por_mes[fecha[:4] + fecha[5:7]].append(valor)
    periods = sorted(por_mes)
    return {
        "descripcion": "Tasa TAMAR de bancos privados (TNA, %), promedio mensual",
        "fuente": f"BCRA, Estadísticas Monetarias, variable {ID_VARIABLE}",
        "periods": periods,
        "promedio": [round(sum(por_mes[p]) / len(por_mes[p]), 4) for p in periods],
        "ultimo": {"fecha": diaria[-1][0], "valor": diaria[-1][1]},
    }


def main() -> None:
    data = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"tamar.json: {data['periods'][0]} -> {data['periods'][-1]} "
          f"(último dato diario {data['ultimo']['fecha']}: {data['ultimo']['valor']}%)")


if __name__ == "__main__":
    main()
