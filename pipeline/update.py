"""Actualización incremental idempotente (la corre el cron de GitHub Actions).

1. Determina el último período procesado en data/periods/.
2. Prueba los períodos siguientes (hasta el mes pasado): baja, valida, procesa.
3. Si apareció al menos un período nuevo, reconstruye series, índice, fichas e IPC.

Si no hay nada nuevo termina con salida 0 sin tocar archivos. Imprime
"NEW_PERIODS=..." para que el workflow decida si commitear.
"""

from __future__ import annotations

import sys

import build_meta
import build_series
from backfill import default_end, iter_periods
from process_period import DATA_DIR, process


def next_period(period: str) -> str:
    y, m = int(period[:4]), int(period[4:])
    m += 1
    if m > 12:
        y, m = y + 1, 1
    return f"{y:04d}{m:02d}"


def main() -> int:
    done = sorted(p.stem for p in (DATA_DIR / "periods").glob("*.json"))
    if not done:
        print("no hay períodos procesados; corré backfill.py primero", file=sys.stderr)
        return 1
    new: list[str] = []
    for period in iter_periods(next_period(done[-1]), default_end()):
        result = process(period)
        if result is None:
            break  # todavía no publicado; los siguientes tampoco van a estar
        new.append(period)
        print(f"{period}: procesado")

    if not new:
        print("sin novedades")
        print("NEW_PERIODS=")
        return 0

    build_series.build()
    build_meta.build(new[-1])
    try:
        import ipc
        ipc.build()
    except Exception as e:  # el IPC no debe frenar la actualización de datos BCRA
        print(f"aviso: actualización de IPC falló: {e}", file=sys.stderr)

    print(f"NEW_PERIODS={','.join(new)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
