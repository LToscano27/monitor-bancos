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


def parse_titulos(path: Path) -> dict | None:
    """Separa títulos públicos vs privados desde baldet (cuentas 12xxxx).

    baldet trae saldo debe/haber por cuenta. Las hojas son las cuentas que no terminan
    en 000; la suma de hojas == cuenta 120000 == rubro 'Títulos Públicos y Privados' del
    balres (verificado al peso contra 202604). 'otros' son Notas del BCRA y similares.
    """
    pub = priv = otros = 0.0
    found = False
    for ln in bcra.read_lines(path):
        f = split_tsv(ln)
        if len(f) < 7:
            continue
        cta, nombre = f[3], f[4].upper()
        if not cta.startswith("12") or cta.endswith("000"):
            continue
        try:
            val = float(f[5] or 0) - float(f[6] or 0)
        except ValueError:
            continue
        found = True
        if "TULOS P" in nombre and "BLICOS" in nombre:      # TÍTULOS PÚBLICOS (con o sin tildes)
            pub += val
        elif "TULOS PRIVADOS" in nombre:
            priv += val
        else:
            otros += val
    if not found:
        return None
    return {"publicos": round(pub, 2), "privados": round(priv, 2), "otros": round(otros, 2)}


def parse_resena(path: Path) -> list[str]:
    """Un archivo puede traer varios bloques (código reutilizado o renombres); cada bloque
    abre con una línea-header TSV `"code"\t"nombre"\t...\t"estado"`. Los headers se
    convierten en títulos de sección y el resto queda como párrafos."""
    out: list[str] = []
    for ln in bcra.read_lines(path):
        if ln.startswith('"') and "\t" in ln:
            fields = split_tsv(ln)
            if len(fields) >= 2 and fields[1]:
                out.append(f"— {fields[1]} —")
        elif ln.strip():
            out.append(ln.strip())
    return out


def build(period: str) -> int:
    archive = bcra.download(period)
    if archive is None:
        raise RuntimeError(f"{period} no está en caché ni publicado")
    workdir = bcra.cache_dir() / f"_extract_meta_{period}"
    try:
        root = bcra.extract(archive, workdir)
        nomina = load_nomina(root)
        entint = load_entint(root)

        # reseñas: archivos "{code}{Nombre}.txt"; en Bajas puede haber varios por código
        resenas: dict[str, list[Path]] = {}
        bajas: dict[str, list[Path]] = {}
        for dirname, dest in (("Activas", resenas), ("Bajas", bajas)):
            d = bcra.find_file(root, "Info_Hist", dirname)
            if d and d.is_dir():
                for f in sorted(d.iterdir()):
                    m = re.match(r"^(\d{5})", f.name)
                    if m:
                        dest.setdefault(m.group(1), []).append(f)

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
            for f in resenas.get(code, []):
                meta["resena"].extend(parse_resena(f))
            balres = bcra.find_file(root, "Entfin", "Tec_Cont", "balres", f"{code}.txt")
            if balres:
                meta["balance"] = parse_balres(balres)
            baldet = bcra.find_file(root, "Entfin", "Tec_Cont", "baldet", f"{code}.txt")
            if baldet:
                meta["titulos"] = parse_titulos(baldet)
            if code in logos:
                dest = LOGOS_DIR / f"{code}{logos[code].suffix.lower()}"
                shutil.copyfile(logos[code], dest)
                meta["logo"] = dest.name
            with open(DATA_DIR / "meta" / f"{code}.json", "w", encoding="utf-8") as f:
                json.dump(meta, f, ensure_ascii=False, separators=(",", ":"))
            n += 1

        # agregados AA000/AA110/AA120: balance del balres propio + títulos sumados de sus
        # miembros (no hay baldet para agrupamientos, pero la suma de entidades es exacta)
        group_names = {"AA000": "SISTEMA FINANCIERO", "AA110": "BANCOS PÚBLICOS", "AA120": "BANCOS PRIVADOS"}
        for gcode, gnombre in group_names.items():
            gmeta = {"code": gcode, "nombre": gnombre, "alias": "", "grupo": None,
                     "resena": [], "balance": [], "logo": None, "period": period}
            balres = bcra.find_file(root, "Entfin", "Tec_Cont", "balres", f"{gcode}.txt")
            if balres:
                gmeta["balance"] = parse_balres(balres)
            tot = {"publicos": 0.0, "privados": 0.0, "otros": 0.0}
            algun_titulo = False
            for code in nomina:
                mfile = DATA_DIR / "meta" / f"{code}.json"
                if not mfile.exists():
                    continue
                with open(mfile, encoding="utf-8") as f:
                    m = json.load(f)
                t = m.get("titulos")
                if not t:
                    continue
                if gcode == "AA000" or \
                   (gcode == "AA110" and m.get("grupo") == "publico") or \
                   (gcode == "AA120" and m.get("grupo") == "privado"):
                    algun_titulo = True
                    for k in tot:
                        tot[k] += t.get(k, 0.0)
            if algun_titulo:
                gmeta["titulos"] = {k: round(v, 2) for k, v in tot.items()}
            with open(DATA_DIR / "meta" / f"{gcode}.json", "w", encoding="utf-8") as f:
                json.dump(gmeta, f, ensure_ascii=False, separators=(",", ":"))
            n += 1

        # entidades dadas de baja: solo reseña (sirven para las fichas históricas)
        for code, files in bajas.items():
            if code in nomina:
                continue
            resena: list[str] = []
            nombre = code
            for f in files:
                parsed = parse_resena(f)
                resena.extend(parsed)
                for ln in parsed:
                    if ln.startswith("— ") and ln.endswith(" —"):
                        nombre = ln[2:-2]
            meta = {"code": code, "nombre": nombre, "alias": "", "grupo": None,
                    "resena": resena, "balance": [], "logo": None, "period": period,
                    "baja": True}
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
