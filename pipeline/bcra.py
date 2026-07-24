"""Descarga y extracción de los dumps mensuales del BCRA (directorio IEF).

URL: https://www.bcra.gob.ar/archivos/Pdfs/PublicacionesEstadisticas/Entidades/AAAAMMd.7z

Particularidades verificadas contra los archivos reales:
- Un período inexistente responde HTTP 200 con una página HTML de error, por lo que la
  única señal confiable de existencia son los magic bytes del 7z (37 7A BC AF).
- Algunos dumps viejos (p.ej. 201107) traen una carpeta anidada extra (201107d/201107d/...)
  y nombres de archivo con mayúsculas variables (COMPLETO.TXT), así que la búsqueda de
  archivos dentro del árbol extraído es case-insensitive y a cualquier profundidad.
"""

from __future__ import annotations

import os
import shutil
from pathlib import Path

import py7zr
import requests

URL_TEMPLATE = "https://www.bcra.gob.ar/archivos/Pdfs/PublicacionesEstadisticas/Entidades/{period}d.7z"
SEVENZ_MAGIC = b"7z\xbc\xaf\x27\x1c"
ENCODING = "latin-1"

_UA = {"User-Agent": "monitor-bancos/1.0 (pipeline de datos; github)"}


def cache_dir() -> Path:
    env = os.environ.get("BCRA_CACHE_DIR")
    if env:
        base = Path(env)
    else:
        local = os.environ.get("LOCALAPPDATA") or str(Path.home() / ".cache")
        base = Path(local) / "bcra-raw-cache"
    base.mkdir(parents=True, exist_ok=True)
    return base


def download(period: str, force: bool = False) -> Path | None:
    """Baja el 7z del período a la caché. Devuelve None si el período no existe todavía.

    Valida los magic bytes: una respuesta HTML (período inexistente) no se cachea.
    """
    dest = cache_dir() / f"{period}d.7z"
    if dest.exists() and not force:
        return dest
    url = URL_TEMPLATE.format(period=period)
    with requests.get(url, headers=_UA, stream=True, timeout=300) as r:
        if r.status_code != 200:
            return None
        it = r.iter_content(chunk_size=1 << 16)
        first = next(it, b"")
        while len(first) < len(SEVENZ_MAGIC):
            chunk = next(it, None)
            if chunk is None:
                break
            first += chunk
        if not first.startswith(SEVENZ_MAGIC):
            return None  # página HTML de error u otra cosa que no es el dump
        tmp = dest.with_suffix(".part")
        with open(tmp, "wb") as f:
            f.write(first)
            for chunk in it:
                f.write(chunk)
        tmp.replace(dest)
    return dest


def extract(archive: Path, workdir: Path) -> Path:
    """Extrae el 7z y devuelve la raíz efectiva del dump (la carpeta que contiene Entfin)."""
    if workdir.exists():
        shutil.rmtree(workdir)
    workdir.mkdir(parents=True)
    with py7zr.SevenZipFile(archive, mode="r") as z:
        z.extractall(path=workdir)
    root = _find_dump_root(workdir)
    if root is None:
        raise RuntimeError(f"No se encontró Entfin/ dentro de {archive.name}")
    return root


def _find_dump_root(workdir: Path) -> Path | None:
    """Busca la carpeta que contiene Entfin (los dumps viejos anidan una carpeta extra)."""
    for dirpath, dirnames, _ in os.walk(workdir):
        for d in dirnames:
            if d.lower() == "entfin":
                return Path(dirpath)
    return None


def find_file(root: Path, *parts: str) -> Path | None:
    """Camina `parts` desde root con matching case-insensitive en cada nivel."""
    cur = root
    for part in parts:
        if not cur.is_dir():
            return None
        match = None
        for child in cur.iterdir():
            if child.name.lower() == part.lower():
                match = child
                break
        if match is None:
            return None
        cur = match
    return cur


def read_lines(path: Path) -> list[str]:
    with open(path, encoding=ENCODING, newline="") as f:
        return [ln.rstrip("\r\n") for ln in f if ln.strip()]
