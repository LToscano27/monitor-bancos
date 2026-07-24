"""Sanity checks del histórico consolidado. Corre después del backfill.

Chequea:
1. Continuidad de períodos (huecos = meses que el BCRA nunca publicó; se listan).
2. AA000 == suma de entidades individuales en cada mes (activo/préstamos/depósitos/PN).
3. Series del sistema sin saltos mensuales absurdos (>60% nominal m/m).
4. Cobertura de entidades por mes (conteo estable, sin derrumbes de parseo).
"""

from __future__ import annotations

import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def main() -> int:
    files = sorted((DATA_DIR / "periods").glob("*.json"))
    periods = [json.loads(f.read_text(encoding="utf-8")) for f in files]
    print(f"períodos procesados: {len(periods)} ({files[0].stem} -> {files[-1].stem})")

    problems: list[str] = []

    # 1. continuidad
    have = [p["fecha"] for p in periods]
    missing = []
    y, m = int(have[0][:4]), int(have[0][4:])
    idx = set(have)
    while f"{y:04d}{m:02d}" <= have[-1]:
        p = f"{y:04d}{m:02d}"
        if p not in idx:
            missing.append(p)
        m += 1
        if m > 12:
            y, m = y + 1, 1
    print(f"huecos (no publicados por el BCRA): {len(missing)} {missing}")

    # 2. AA000 vs suma. Umbral 1%: en un puñado de meses (2019-08/10, 2021-02/04, 2024-10)
    # el propio dato publicado por el BCRA trae diferencias de 0,2-0,9% entre el agregado
    # y la suma de las filas individuales (sin que falte ninguna entidad). El dashboard usa
    # siempre AA000 oficial como total, así que no afecta ningún número mostrado.
    peor = 0.0
    for p in periods:
        aa = p["agregados"].get("AA000")
        if not aa:
            problems.append(f"{p['fecha']}: sin AA000")
            continue
        for k in ("activo", "prestamos", "depositos", "patrimonio"):
            suma = sum(e.get(k) or 0 for e in p["entidades"])
            ref = aa.get(k)
            if ref:
                dif = abs(suma - ref) / ref
                peor = max(peor, dif)
                if dif > 0.01:
                    problems.append(f"{p['fecha']}.{k}: suma={suma:.0f} vs AA000={ref:.0f} ({100*dif:.2f}%)")
    print(f"AA000 vs suma de entidades: desvío máximo {100*peor:.4f}% (umbral 1%)")

    # 3. saltos absurdos en series del sistema
    prev = None
    for p in periods:
        aa = p["agregados"].get("AA000", {})
        if prev is not None:
            for k in ("activo", "depositos"):
                a, b = prev.get(k), aa.get(k)
                if a and b and (b / a > 1.6 or b / a < 0.6):
                    problems.append(f"{p['fecha']}.{k}: salto x{b/a:.2f} vs mes anterior")
        prev = aa

    # 4. cobertura
    counts = [(p["fecha"], len(p["entidades"])) for p in periods]
    minc = min(c for _, c in counts)
    maxc = max(c for _, c in counts)
    print(f"entidades por mes: min {minc}, max {maxc}")
    if minc < 60:
        problems.extend(f"{f}: solo {c} entidades" for f, c in counts if c < 60)

    if problems:
        print(f"\nPROBLEMAS ({len(problems)}):")
        for pr in problems[:40]:
            print(" -", pr)
        return 1
    print("\nSANITY OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
