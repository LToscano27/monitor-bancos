"""Fichas por entidad a partir del último dump disponible.

Para cada entidad de la Nómina vigente arma data/meta/{code}.json con:
- nombre, alias y grupo institucional (público / privado / financiera, según entint)
- reseña histórica (Info_Hist/Activas)
- balance resumido del período (última columna de balres, con jerarquía por indentación)
- flag de logo; los logos se copian a web/public/logos/

Uso:
    python pipeline/build_meta.py [AAAAMM]   (default: último período de data/periods/)
"""

from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

import bcra
from parse import split_tsv, parse_num, load_nomina, load_entint

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"
LOGOS_DIR = REPO_ROOT / "web" / "public" / "logos"


def grupo_de(entint_groups: list[str]) -> str | None:
    if "AA110" in entint_groups:
        return "publico"
    if "AA120" in entint_groups:
        return "privado"
    if "AA200" in entint_groups:
        return "financiera"
    return None


def parse_balres(path: Path) -> list[dict]:
    """Balance resumido: última columna = período del dump. Jerarquía por indentación."""
    items = []
    for ln in bcra.read_lines(path):
        fields = split_tsv(ln)
        if len(fields) < 10:
            continue
        raw_name = ln.split("\t")[4].strip('"')  # conservar espacios de indentación
        nivel = (len(raw_name) - len(raw_name.lstrip())) // 3
        items.append({
            "codigo": fields[3],
            "nombre": raw_name.strip(),
            "nivel": nivel,
            "valor": parse_num(fields[9]),
        })
    return items


def parse_resena(path: Path) -> list[str]:
    lines = bcra.read_lines(path)
    return [ln.strip() for ln in lines[1:] if ln.strip()]  # línea 1 = header TSV


def build(period: str) -> int:
    archive = bcra.download(period)
    if archive is None:
        raise RuntimeError(f"{period} no está en caché ni publicado")
    workdir = bcra.cache_dir() / f"_extract_meta_{period}"
    try:
        root = bcra.extract(archive, workdir)
        nomina = load_nomina(root)
        entint = load_entint(root)

        # reseñas: archivos "{code}{Nombre}.txt"
        resenas: dict[str, Path] = {}
        activas = bcra.find_file(root, "Info_Hist", "Activas")
        if activas and activas.is_dir():
            for f in activas.iterdir():
                m = re.match(r"^(\d{5})", f.name)
                if m:
                    resenas[m.group(1)] = f

        logos: dict[str, Path] = {}
        logos_dir = bcra.find_file(root, "Entfin", "Logos")
        if logos_dir and logos_dir.is_dir():
            for f in logos_dir.iterdir():
                m = re.match(r"^(\d{5})\.(jpg|jpeg|png)$", f.name, re.I)
                if m:
                    logos.setdefault(m.group(1), f)  # prefiere el primero (jpg suele venir antes)

        LOGOS_DIR.mkdir(parents=True, exist_ok=True)
        (DATA_DIR / "meta").mkdir(parents=True, exist_ok=True)

        n = 0
        for code, info in nomina.items():
            meta = {
                "code": code,
                "nombre": info["nombre"],
                "alias": info.get("alias", ""),
                "grupo": grupo_de(entint.get(code, [])),
                "resena": [],
                "balance": [],
                "logo": None,
                "period": period,
            }
            if code in resenas:
                meta["resena"] = parse_resena(resenas[code])
            balres = bcra.find_file(root, "Entfin", "Tec_Cont", "balres", f"{code}.txt")
            if balres:
                meta["balance"] = parse_balres(balres)
            if code in logos:
                dest = LOGOS_DIR / f"{code}{logos[code].suffix.lower()}"
                shutil.copyfile(logos[code], dest)
                meta["logo"] = dest.name
            with open(DATA_DIR / "meta" / f"{code}.json", "w", encoding="utf-8") as f:
                json.dump(meta, f, ensure_ascii=False, separators=(",", ":"))
            n += 1
        return n
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


def latest_period() -> str:
    files = sorted((DATA_DIR / "periods").glob("*.json"))
    if not files:
        raise RuntimeError("no hay períodos procesados")
    return files[-1].stem


if __name__ == "__main__":
    period = sys.argv[1] if len(sys.argv) > 1 else latest_period()
    n = build(period)
    print(f"meta: {n} fichas generadas desde {period}")
