"""Backfill histórico: procesa todos los períodos desde 201107 hasta el presente.

- Reanudable: si data/periods/AAAAMM.json ya existe, saltea (usar --force para reprocesar).
- Robusto: si un mes falla (formato desconocido, descarga corrupta, etc.) lo registra en
  data/_failures.json y sigue con el siguiente.
- Un período no publicado (HTML de error en vez de 7z) se registra como "missing", no como
  falla.

Uso:
    python pipeline/backfill.py [--from 201107] [--to AAAAMM] [--force]
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import time
import traceback
from pathlib import Path

from process_period import DATA_DIR, process

FIRST_PERIOD = "201107"


def iter_periods(start: str, end: str):
    y, m = int(start[:4]), int(start[4:])
    while f"{y:04d}{m:02d}" <= end:
        yield f"{y:04d}{m:02d}"
        m += 1
        if m > 12:
            y, m = y + 1, 1


def default_end() -> str:
    today = dt.date.today()
    # el BCRA publica con ~3 meses de rezago; probamos hasta el mes anterior por las dudas
    y, m = today.year, today.month - 1
    if m == 0:
        y, m = y - 1, 12
    return f"{y:04d}{m:02d}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="start", default=FIRST_PERIOD)
    ap.add_argument("--to", dest="end", default=default_end())
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    failures: dict[str, str] = {}
    missing: list[str] = []
    ok = 0
    t0 = time.time()
    periods = list(iter_periods(args.start, args.end))
    for i, period in enumerate(periods, 1):
        out = DATA_DIR / "periods" / f"{period}.json"
        if out.exists() and not args.force:
            ok += 1
            continue
        try:
            result = process(period, force=args.force)
        except Exception as e:
            failures[period] = f"{type(e).__name__}: {e}"
            print(f"[{i}/{len(periods)}] {period}: FALLO {type(e).__name__}: {e}", flush=True)
            traceback.print_exc()
            continue
        if result is None:
            missing.append(period)
            print(f"[{i}/{len(periods)}] {period}: no publicado", flush=True)
        else:
            ok += 1
            print(f"[{i}/{len(periods)}] {period}: OK ({time.time()-t0:.0f}s)", flush=True)

    report = {"ok": ok, "missing": missing, "failures": failures,
              "run": dt.datetime.now().isoformat(timespec="seconds")}
    with open(DATA_DIR / "_failures.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nbackfill: {ok} ok, {len(missing)} no publicados, {len(failures)} fallas "
          f"en {time.time()-t0:.0f}s")
    if failures:
        print("fallas:", ", ".join(failures))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
