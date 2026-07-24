"""Procesa un período AAAAMM: descarga (o usa caché), extrae, parsea y escribe
data/periods/AAAAMM.json.

Uso:
    python pipeline/process_period.py 202604 [--force]

Salida 0 con JSON escrito, salida 2 si el período no está publicado todavía.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

import bcra
from parse import parse_period

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"


def process(period: str, force: bool = False) -> Path | None:
    out_path = DATA_DIR / "periods" / f"{period}.json"
    if out_path.exists() and not force:
        return out_path
    archive = bcra.download(period)
    if archive is None:
        return None
    workdir = bcra.cache_dir() / f"_extract_{period}"
    try:
        root = bcra.extract(archive, workdir)
        data = parse_period(root, period)
    finally:
        shutil.rmtree(workdir, ignore_errors=True)
    # El BCRA a veces publica la URL de un mes con el contenido (stale) del mes anterior
    # (verificado en 201403 = feb-2014 y 202007 = jun-2020). La fecha interna del dump es
    # la autoridad: si no coincide con el período pedido, el mes todavía no está publicado.
    if data.get("fecha") != period:
        return None
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    return out_path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("period", help="AAAAMM, p.ej. 202604")
    ap.add_argument("--force", action="store_true", help="reprocesar aunque ya exista el JSON")
    args = ap.parse_args()
    out = process(args.period, force=args.force)
    if out is None:
        print(f"{args.period}: no publicado todavía (o no es un 7z válido)")
        return 2
    print(f"{args.period}: OK -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
