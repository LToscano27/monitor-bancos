"""Serie de IPC mensual empalmada para deflactar los montos nominales.

Empalme (criterio estándar para series largas en Argentina, dado que el IPC INDEC
nacional recién existe desde dic-2016 y el IPC-GBA 2011-2015 está cuestionado):

- 201107..201206  IPC San Luis  (datos.gob.ar id 197.1_NIVEL_GENERAL_2014_0_13)
- 201207..201611  IPC CABA      (datos.gob.ar id 193.1_NIVEL_GENERAL_JULI_0_13)
- 201612..hoy     IPC Nacional INDEC (datos.gob.ar id 148.3_INIVELNAL_DICI_M_26)

El índice se encadena mes a mes con la variación mensual de la serie asignada a cada
tramo (en el mes de empalme, si la serie nueva no cubre el mes anterior, se usa la
variación de la serie saliente). data/ipc.json trae el índice re-basado a jul-2011=100;
el deflactor a pesos del último mes es index[último]/index[t].

Uso: python pipeline/ipc.py
"""

from __future__ import annotations

import json
from pathlib import Path

import requests

REPO_ROOT = Path(__file__).resolve().parent.parent
OUT = REPO_ROOT / "data" / "ipc.json"

API = "https://apis.datos.gob.ar/series/api/series/"

TRAMOS = [
    ("197.1_NIVEL_GENERAL_2014_0_13", "201107", "201206", "IPC San Luis"),
    ("193.1_NIVEL_GENERAL_JULI_0_13", "201207", "201611", "IPC CABA"),
    ("148.3_INIVELNAL_DICI_M_26", "201612", None, "IPC Nacional (INDEC)"),
]


def fetch_series(series_id: str) -> dict[str, float]:
    """Devuelve {AAAAMM: valor} para la serie completa."""
    out: dict[str, float] = {}
    start = 0
    while True:
        r = requests.get(API, params={
            "ids": series_id, "format": "json", "limit": 1000, "start": start, "sort": "asc",
        }, timeout=60)
        r.raise_for_status()
        payload = r.json()
        rows = payload["data"]
        for fecha, valor in rows:
            if valor is not None:
                out[fecha[:4] + fecha[5:7]] = float(valor)
        start += len(rows)
        if start >= payload["count"] or not rows:
            break
    return out


def prev_period(p: str) -> str:
    y, m = int(p[:4]), int(p[4:])
    m -= 1
    if m == 0:
        y, m = y - 1, 12
    return f"{y:04d}{m:02d}"


def next_period(p: str) -> str:
    y, m = int(p[:4]), int(p[4:])
    m += 1
    if m > 12:
        y, m = y + 1, 1
    return f"{y:04d}{m:02d}"


def build() -> dict:
    tramos = []
    for sid, start, end, fuente in TRAMOS:
        s = fetch_series(sid)
        if end is None:
            end = max(s)
        tramos.append((s, start, end, fuente))

    periods: list[str] = []
    index: list[float] = []
    sources: list[dict] = []

    prev_series: dict[str, float] | None = None
    for s, start, end, fuente in tramos:
        p = start
        tramo_start_idx = len(periods)
        while p <= end:
            if p not in s:
                raise RuntimeError(f"{fuente}: falta el período {p}")
            if not index:
                index.append(100.0)
            else:
                prev = prev_period(p)
                if prev in s:
                    rate = s[p] / s[prev]
                elif prev_series is not None and prev in prev_series and p in prev_series:
                    rate = prev_series[p] / prev_series[prev]
                else:
                    raise RuntimeError(f"{fuente}: no puedo encadenar {prev}->{p}")
                index.append(index[-1] * rate)
            periods.append(p)
            p = next_period(p)
        sources.append({"desde": periods[tramo_start_idx], "hasta": periods[-1], "fuente": fuente})
        prev_series = s

    return {
        "base": f"{periods[0]}=100",
        "latest": periods[-1],
        "periods": periods,
        "index": [round(v, 4) for v in index],
        "sources": sources,
    }


def main() -> None:
    data = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"ipc.json: {data['periods'][0]} -> {data['latest']} ({len(data['periods'])} meses)")


if __name__ == "__main__":
    main()
