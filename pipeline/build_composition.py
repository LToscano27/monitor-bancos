"""Series históricas de composición del balance (activo y pasivo) por entidad y agregados.

Fuente: `Entfin/Tec_Cont/bal_hist/balhist.txt`, un único archivo que el BCRA empezó a
publicar en el dump de 2025-06 y que trae el balance a nivel de cuenta de imputación de
TODAS las entidades desde 1994 (9,2M de filas: entidad, fecha, cuenta, saldo).

Los rubros se arman por el prefijo de 2 dígitos del código de cuenta. Verificado al peso
contra el balance resumido: para Galicia 2026-04 la suma de los prefijos del activo da
36.704.435.926, exactamente el activo publicado; y los títulos separados por descripción
reproducen el split del balance detallado.

Los saldos vienen con signo contable (deudor positivo, acreedor negativo). En el activo se
conserva el signo para que las cuentas regularizadoras —previsiones por incobrabilidad,
amortizaciones acumuladas— resten; en el pasivo se invierte el signo para expresarlo en
positivo.

Agregados: se suman las entidades de cada grupo. La pertenencia sale de `entint` (presente
en los dumps desde ~2018); para períodos anteriores se usa el mapeo disponible más viejo.

Uso:
    python pipeline/build_composition.py
"""

from __future__ import annotations

import json
import shutil
from collections import defaultdict
from pathlib import Path

import bcra
from parse import split_tsv

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"
OUT_DIR = DATA_DIR / "composition"
MEMBERSHIP_CACHE = DATA_DIR / "_membership.json"

BALHIST_REL = ("Entfin", "Tec_Cont", "bal_hist", "balhist.txt")

# prefijo de cuenta -> (sección, clave de rubro, etiqueta)
RUBROS: dict[str, tuple[str, str, str]] = {
    "11": ("activo", "efectivo", "Efectivo y depósitos en bancos"),
    "12": ("activo", "titulos", "Títulos públicos y privados"),
    "13": ("activo", "prestamos", "Préstamos"),
    "14": ("activo", "otros_creditos", "Otros créditos por interm. financiera"),
    "15": ("activo", "leasing", "Créditos por arrendamientos financieros"),
    "16": ("activo", "participaciones", "Participaciones en otras sociedades"),
    "17": ("activo", "creditos_diversos", "Créditos diversos"),
    "18": ("activo", "propiedad", "Propiedad, planta y equipo"),
    "19": ("activo", "bienes_diversos", "Bienes diversos"),
    "21": ("activo", "intangibles", "Activos intangibles"),
    "23": ("activo", "partidas_pend_activo", "Partidas pendientes (deudoras)"),
    "31": ("pasivo", "depositos", "Depósitos"),
    "32": ("pasivo", "otras_obligaciones", "Otras obligaciones por interm. financiera"),
    "33": ("pasivo", "obligaciones_diversas", "Obligaciones diversas"),
    "34": ("pasivo", "provisiones", "Provisiones"),
    "35": ("pasivo", "partidas_pend_pasivo", "Partidas pendientes (acreedoras)"),
    "36": ("pasivo", "obligaciones_subordinadas", "Obligaciones subordinadas"),
}

# dentro del rubro de títulos (prefijo 12) se separa por la descripción de la cuenta
TITULOS_KEYS = {
    "titulos_publicos": "Títulos públicos",
    "titulos_privados": "Títulos privados",
}

GROUP_OF = {"AA110": "publico", "AA120": "privado", "AA200": "financiera"}
AGGREGATES = {"AA000": None, "AA110": "publico", "AA120": "privado"}


def load_index() -> dict:
    with open(DATA_DIR / "index.json", encoding="utf-8") as f:
        return json.load(f)


def load_cuentas(root: Path) -> dict[str, str]:
    path = bcra.find_file(root, "Entfin", "Tec_Cont", "cuentas", "cuentas.txt")
    out: dict[str, str] = {}
    if path is None:
        return out
    for ln in bcra.read_lines(path):
        f = split_tsv(ln)
        if len(f) >= 2:
            out[f[0]] = f[1].upper()
    return out


def build_membership(periods: list[str]) -> dict[str, dict[str, str]]:
    """{período: {código: grupo}} a partir de entint (cacheado en disco).

    Se muestrean dumps cada 6 meses (más el último): la pertenencia a un agrupamiento
    cambia muy de vez en cuando, y extraer los 175 dumps completos sería carísimo.
    Del 7z se extrae únicamente la carpeta entint.
    """
    import py7zr

    if MEMBERSHIP_CACHE.exists():
        with open(MEMBERSHIP_CACHE, encoding="utf-8") as f:
            cached = json.load(f)
    else:
        cached = {}

    muestra = [p for i, p in enumerate(periods) if i % 6 == 0 or p == periods[-1]]
    for period in muestra:
        if period in cached:
            continue
        archive = bcra.cache_dir() / f"{period}d.7z"
        if not archive.exists():
            continue
        workdir = bcra.cache_dir() / f"_entint_{period}"
        try:
            shutil.rmtree(workdir, ignore_errors=True)
            workdir.mkdir(parents=True)
            with py7zr.SevenZipFile(archive) as z:
                targets = [n for n in z.getnames() if "entint" in n.lower()]
                if not targets:
                    continue
                z.extract(path=workdir, targets=targets)
            mapping: dict[str, str] = {}
            for f in workdir.rglob("*.txt"):
                if f.stem.lower() == "formato":
                    continue
                for ln in bcra.read_lines(f):
                    fields = split_tsv(ln)
                    if len(fields) >= 4 and fields[3] in GROUP_OF:
                        mapping[fields[0]] = GROUP_OF[fields[3]]
            if mapping:
                cached[period] = mapping
                print(f"  entint {period}: {len(mapping)} entidades", flush=True)
        except Exception as e:  # un dump roto no debe frenar el resto
            print(f"  entint {period}: {type(e).__name__}: {e}", flush=True)
        finally:
            shutil.rmtree(workdir, ignore_errors=True)

    with open(MEMBERSHIP_CACHE, "w", encoding="utf-8") as f:
        json.dump(cached, f, ensure_ascii=False, separators=(",", ":"))
    return cached


def resolve_membership(periods: list[str], raw: dict[str, dict[str, str]]) -> dict[str, dict[str, str]]:
    """Rellena los períodos sin entint con el mapeo conocido más cercano hacia atrás,
    y los más viejos con el primero disponible."""
    known = sorted(raw)
    if not known:
        return {}
    out: dict[str, dict[str, str]] = {}
    first = raw[known[0]]
    last_seen = first
    for p in periods:
        if p in raw:
            last_seen = raw[p]
        out[p] = last_seen if p >= known[0] else first
    return out


def find_balhist() -> tuple[Path, Path] | None:
    """Devuelve (carpeta temporal, path de balhist.txt) del dump más nuevo que lo tenga.

    Extrae solo bal_hist y cuentas: el resto del dump no hace falta acá.
    """
    import py7zr

    archives = sorted(bcra.cache_dir().glob("*d.7z"), reverse=True)
    for archive in archives:
        period = archive.stem[:-1]
        with py7zr.SevenZipFile(archive) as z:
            names = z.getnames()
        targets = [n for n in names if "bal_hist" in n.lower() or "cuentas" in n.lower()]
        if not any("balhist" in n.lower() for n in targets):
            continue
        workdir = bcra.cache_dir() / f"_balhist_{period}"
        shutil.rmtree(workdir, ignore_errors=True)
        workdir.mkdir(parents=True)
        with py7zr.SevenZipFile(archive) as z:
            z.extract(path=workdir, targets=targets)
        path = next(iter(workdir.rglob("balhist.txt")), None)
        if path is not None:
            print(f"balhist tomado del dump {period}", flush=True)
            return workdir, path
        shutil.rmtree(workdir, ignore_errors=True)
    return None


def build() -> None:
    index = load_index()
    periods = index["periods"]
    period_set = set(periods)
    pidx = {p: i for i, p in enumerate(periods)}
    n = len(periods)

    found = find_balhist()
    if found is None:
        raise RuntimeError("Ningún dump en caché contiene bal_hist/balhist.txt")
    workdir, balhist_path = found
    root = workdir

    cuentas = load_cuentas(root)
    print(f"cuentas: {len(cuentas)} códigos", flush=True)

    print("construyendo pertenencia a grupos (entint)…", flush=True)
    membership = resolve_membership(periods, build_membership(periods))

    # acumulador: (code, period) -> {clave_rubro: monto}
    acc: dict[tuple[str, str], defaultdict[str, float]] = {}
    leidas = 0
    with open(balhist_path, encoding=bcra.ENCODING) as fh:
        for ln in fh:
            f = ln.rstrip("\r\n").split("\t")
            if len(f) < 4:
                continue
            period = f[1].strip().strip('"')
            if period not in period_set:
                continue
            code = f[0].strip().strip('"')
            cta = f[2].strip().strip('"')
            rub = RUBROS.get(cta[:2])
            if rub is None:  # resultados y cuentas de orden quedan fuera
                continue
            try:
                v = float(f[3])
            except ValueError:
                continue
            leidas += 1
            key = (code, period)
            slot = acc.get(key)
            if slot is None:
                slot = acc[key] = defaultdict(float)
            seccion, rkey, _ = rub
            # Los saldos vienen con signo contable: deudor positivo, acreedor negativo.
            # En el activo hay que conservar el signo para que las cuentas regularizadoras
            # (previsiones, amortizaciones acumuladas) resten. En el pasivo el saldo es
            # acreedor, así que se invierte para expresarlo en positivo.
            signo = 1.0 if seccion == "activo" else -1.0
            slot[rkey] += signo * v
            if rkey == "titulos":
                desc = cuentas.get(cta, "")
                if "TULOS P" in desc and "BLICOS" in desc:
                    slot["titulos_publicos"] += v
                elif "TULOS PRIVADOS" in desc:
                    slot["titulos_privados"] += v
    print(f"balhist: {leidas:,} filas usadas, {len(acc):,} pares entidad-período", flush=True)

    shutil.rmtree(workdir, ignore_errors=True)

    all_keys = [k for _, k, _ in RUBROS.values()] + list(TITULOS_KEYS)
    codes = sorted({c for c, _ in acc})

    def empty() -> dict[str, list[float | None]]:
        return {k: [None] * n for k in all_keys}

    series: dict[str, dict[str, list[float | None]]] = {c: empty() for c in codes}
    aggs: dict[str, dict[str, list[float | None]]] = {a: empty() for a in AGGREGATES}

    for (code, period), vals in acc.items():
        i = pidx[period]
        for k, v in vals.items():
            s = series[code][k]
            s[i] = (s[i] or 0.0) + v
            for agg, grupo in AGGREGATES.items():
                if grupo is None or membership.get(period, {}).get(code) == grupo:
                    t = aggs[agg][k]
                    t[i] = (t[i] or 0.0) + v

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("*.json"):
        old.unlink()

    labels = {k: lbl for _, k, lbl in RUBROS.values()}
    labels.update(TITULOS_KEYS)
    sections = {k: sec for sec, k, _ in RUBROS.values()}
    sections.update({k: "activo" for k in TITULOS_KEYS})

    written = 0
    for code, s in list(series.items()) + list(aggs.items()):
        payload = {
            "code": code,
            "periods": periods,
            "m": {k: [round(v, 2) if v is not None else None for v in vals] for k, vals in s.items()},
        }
        with open(OUT_DIR / f"{code}.json", "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
        written += 1

    with open(DATA_DIR / "composition_meta.json", "w", encoding="utf-8") as f:
        json.dump({"labels": labels, "sections": sections,
                   "keys_activo": [k for k in all_keys if sections[k] == "activo"],
                   "keys_pasivo": [k for k in all_keys if sections[k] == "pasivo"]},
                  f, ensure_ascii=False, separators=(",", ":"))

    print(f"composición: {written} archivos ({len(codes)} entidades + {len(aggs)} agregados)")


if __name__ == "__main__":
    build()
