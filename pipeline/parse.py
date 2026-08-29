"""Parseo de los TXT del dump IEF a un esquema canónico de métricas.

Todos los TXT son TSV con campos entre comillas dobles, encoding latin-1, decimales con
punto y vacíos como '.' o cadena vacía. El BCRA usa 99999 como sentinel de "no aplica" en
los indicadores.

El archivo principal es Entfin/Tec_Cont/ranking/completo.txt. Su layout cambió con los años
y el formato.txt que lo acompaña en los dumps viejos está desactualizado, así que el layout
se detecta por la cantidad de campos de cada fila:

- MODERN (42 campos): código + 40 métricas (9 de volumen/estructura + 31 indicadores) + fecha.
- OLD (11 campos): código + 9 métricas de volumen/estructura + fecha. Los indicadores de esa
  era viven en indicad/completo.txt con otro codebook; se mapean al esquema canónico solo los
  conceptualmente equivalentes (mora, ROE, ROA, liquidez — esta última con quiebre de
  definición, ver SERIES_BREAKS).
"""

from __future__ import annotations

from pathlib import Path

from bcra import find_file, read_lines

SENTINEL = 99999.0

# Claves canónicas de las columnas 2..41 del layout moderno, en orden.
MODERN_KEYS = [
    "activo", "prestamos", "depositos", "patrimonio",
    "ctas_corrientes", "cajas_ahorro", "plazos_fijos", "ops_prestamos", "personal",
    "apalancamiento", "c2", "c3",
    "a11", "a12", "a13", "a14", "a16", "a17", "a21", "mora", "ag29", "ag3",
    "e1", "e2", "e4", "e5",
    "roe", "r17", "r2", "r8", "r9",
    "roa", "rg15", "rg2_ii", "rg3", "rg4_ii", "rg5",
    "liquidez", "l8_ii", "l9",
]

# Las primeras 9 son montos/cantidades; el resto son indicadores (aplica el sentinel 99999).
VOLUME_KEYS = MODERN_KEYS[:9]
OLD_KEYS = MODERN_KEYS[:9]

# Era vieja: token del indicador en indicad/completo.txt -> clave canónica.
# Solo se mapean conceptos equivalentes. L2 (activos líquidos / pasivos líquidos) se mapea a
# `liquidez` pero la definición difiere de L1 moderna: queda documentado como quiebre.
OLD_INDICATOR_MAP = {
    "A10": "mora",      # cartera irregular / financiaciones == A9 moderno
    "R1": "roe",
    "R2": "roa",        # ¡el R2 moderno es otra cosa (rendimiento ordinario)!
    "L2": "liquidez",
}

# Quiebres de definición a documentar en index.json y marcar en la UI.
SERIES_BREAKS = {
    "liquidez": "Hasta el cambio de codebook del BCRA la serie corresponde a L2 (activos "
                "líquidos / pasivos líquidos); desde entonces es L1 (liquidez amplia). "
                "Las definiciones no son estrictamente comparables.",
    "mora": "Serie construida con A10 (era vieja) y A9 (era moderna): misma definición "
            "conceptual (cartera irregular / financiaciones totales).",
    "roe": "Quiebre contable en enero de 2020: desde entonces los balances se presentan "
           "ajustados por inflación, así que el ROE ya es un rendimiento real. Hasta 2019 "
           "es nominal y hay que descontarle la inflación para compararlo. Usá la vista "
           "«real homogéneo» para ver los 15 años en el mismo criterio.",
    "roa": "Quiebre contable en enero de 2020: desde entonces los balances se presentan "
           "ajustados por inflación, así que el ROA ya es un rendimiento real. Hasta 2019 "
           "es nominal. Usá la vista «real homogéneo» para comparar toda la serie.",
}

# Primer período con balances ajustados por inflación (los resultados ya son reales).
# Verificado empíricamente: hasta 2019 el ROE deflactado replica la variación real del
# patrimonio neto; desde 2020 la replica el ROE publicado sin deflactar.
AJUSTE_INFLACION_DESDE = "202001"


# Los dumps viejos no traen Grupos.txt; nombres conocidos de los agrupamientos.
DEFAULT_GROUP_NAMES = {
    "AA000": "SISTEMA FINANCIERO",
    "AA100": "BANCOS",
    "AA110": "BANCOS PÚBLICOS",
    "AA120": "BANCOS PRIVADOS",
    "AA121": "BANCOS LOCALES DE CAPITAL NACIONAL",
    "AA123": "BANCOS LOCALES DE CAPITAL EXTRANJERO",
    "AA124": "BANCOS SUCURSALES ENTIDADES FINANCIERAS DEL EXTERIOR",
    "AA200": "COMPAÑÍAS FINANCIERAS",
    "AA210": "COMPAÑÍAS FINANCIERAS DE CAPITAL NACIONAL",
    "AA220": "COMPAÑÍAS FINANCIERAS DE CAPITAL EXTRANJERO",
    "AA300": "CAJAS DE CRÉDITO",
    "AA910": "10 PRIMEROS BANCOS PRIVADOS",
    "AA920": "ENTIDADES FINANCIERAS PRIVADAS",
}


class UnknownLayout(Exception):
    def __init__(self, n_fields: int, sample: str):
        self.n_fields = n_fields
        super().__init__(f"Layout desconocido de ranking/completo.txt: {n_fields} campos. Muestra: {sample[:200]}")


def split_tsv(line: str) -> list[str]:
    return [f.strip().strip('"').strip() for f in line.split("\t")]


def parse_num(raw: str, *, indicator: bool = False) -> float | None:
    if raw in ("", "."):
        return None
    try:
        v = float(raw)
    except ValueError:
        return None
    if indicator and v == SENTINEL:
        return None
    return v


def parse_ranking(lines: list[str]) -> tuple[str, str, list[dict]]:
    """Devuelve (layout, fecha, filas). Cada fila: {code, <métricas canónicas>}."""
    rows = []
    layout = None
    fecha = None
    for ln in lines:
        fields = split_tsv(ln)
        if len(fields) == 42:
            row_layout, keys = "modern", MODERN_KEYS
        elif len(fields) == 11:
            row_layout, keys = "old", OLD_KEYS
        else:
            raise UnknownLayout(len(fields), ln)
        if layout is None:
            layout = row_layout
        elif layout != row_layout:
            raise UnknownLayout(len(fields), f"layouts mezclados en el mismo archivo: {ln}")
        code = fields[0]
        fecha = fields[-1]
        row: dict = {"code": code}
        for key, raw in zip(keys, fields[1:-1]):
            row[key] = parse_num(raw, indicator=key not in VOLUME_KEYS)
        rows.append(row)
    if layout is None or fecha is None:
        raise UnknownLayout(0, "(archivo vacío)")
    return layout, fecha, rows


def _indicator_token(desc: str) -> str | None:
    """'A10 - Cartera irregular sobre financiaciones' -> 'A10'."""
    head = desc.split("-", 1)[0].strip().upper()
    return head or None


def parse_indicad_completo(lines: list[str]) -> tuple[dict, dict, dict]:
    """Parsea indicad/completo.txt de la era vieja.

    Devuelve (por_entidad, sistema, nombres):
    - por_entidad: {code: {clave_canónica: valor_del_período}}
    - sistema: {clave_canónica: valor} (columna 13, "valores correspondientes al sistema")
    - nombres: {code: nombre}
    Columnas: code, nombre, fecha, cod_línea, descripción, v1..v5 (5 fechas, la 5ta es el
    período del dump), grupo homogéneo, 10 primeros privados, sistema.
    """
    por_entidad: dict[str, dict] = {}
    sistema: dict[str, float | None] = {}
    nombres: dict[str, str] = {}
    for ln in lines:
        fields = split_tsv(ln)
        if len(fields) < 13:
            continue
        code, nombre, desc = fields[0], fields[1], fields[4]
        token = _indicator_token(desc)
        key = OLD_INDICATOR_MAP.get(token or "")
        if key is None:
            continue
        nombres[code] = nombre
        val = parse_num(fields[9], indicator=True)  # 5ta fecha = período del dump
        por_entidad.setdefault(code, {})[key] = val
        if key not in sistema or sistema[key] is None:
            sistema[key] = parse_num(fields[12], indicator=True)
    return por_entidad, sistema, nombres


def load_nomina(root: Path) -> dict[str, dict]:
    """Nomina.txt moderno: {code: {nombre, alias}}. Puede no existir en dumps viejos."""
    path = find_file(root, "Entfin", "Nomina.txt") or find_file(root, "Entfin", "Nomina", "Nomina.txt")
    if path is None or not path.is_file():
        return {}
    out = {}
    for ln in read_lines(path):
        fields = split_tsv(ln)
        if len(fields) >= 2:
            out[fields[0]] = {"nombre": fields[1], "alias": fields[2] if len(fields) > 2 else ""}
    return out


def load_grupos(root: Path) -> dict[str, str]:
    path = find_file(root, "Entfin", "Grupos.txt") or find_file(root, "Entfin", "Grupos", "Grupos.txt")
    if path is None or not path.is_file():
        return {}
    out = {}
    for ln in read_lines(path):
        fields = split_tsv(ln)
        if len(fields) >= 2:
            out[fields[0]] = fields[1]
    return out


def load_entint(root: Path) -> dict[str, list[str]]:
    """entint: {code: [grupos AA### a los que pertenece]}."""
    d = find_file(root, "Entfin", "Tec_Cont", "entint")
    if d is None or not d.is_dir():
        return {}
    out: dict[str, list[str]] = {}
    for f in d.iterdir():
        if f.suffix.lower() != ".txt" or f.stem.lower() == "formato":
            continue
        for ln in read_lines(f):
            fields = split_tsv(ln)
            if len(fields) >= 4:
                out.setdefault(fields[0], []).append(fields[3])
    return out


def parse_period(root: Path, period: str) -> dict:
    """Arma el JSON canónico de un período a partir de la raíz extraída del dump."""
    ranking_path = find_file(root, "Entfin", "Tec_Cont", "ranking", "completo.txt")
    if ranking_path is None:
        raise FileNotFoundError("ranking/completo.txt no encontrado en el dump")
    layout, fecha, rows = parse_ranking(read_lines(ranking_path))
    if fecha != period:
        # algunos dumps informan la fecha adentro; confiar en el contenido pero avisar
        pass

    nomina = load_nomina(root)
    grupos = load_grupos(root)

    nombres_extra: dict[str, str] = {}
    if layout == "old":
        ind_path = find_file(root, "Entfin", "Tec_Cont", "indicad", "completo.txt")
        if ind_path is not None:
            por_entidad, sistema, nombres_extra = parse_indicad_completo(read_lines(ind_path))
            for row in rows:
                extra = por_entidad.get(row["code"])
                if extra:
                    row.update(extra)
                elif row["code"] == "AA000":
                    row.update(sistema)

    # El BCRA a veces publica el bloque entero de indicadores en cero cuando no los
    # calculó para ese mes (verificado: feb-2018, todo el sistema en 0,00 con los montos
    # correctos). Un cero aislado es legítimo —un banco sin cartera irregular tiene mora
    # 0— pero si TODOS los indicadores de la fila son cero es dato faltante, no un valor.
    ind_keys = [k for k in MODERN_KEYS if k not in VOLUME_KEYS]
    for row in rows:
        presentes = [row[k] for k in ind_keys if row.get(k) is not None]
        if presentes and all(v == 0 for v in presentes):
            for k in ind_keys:
                if k in row:
                    row[k] = None

    entidades = []
    agregados = {}
    for row in rows:
        code = row["code"]
        if code.startswith("AA"):
            row["nombre"] = grupos.get(code) or DEFAULT_GROUP_NAMES.get(code, code)
            agregados[code] = row
        else:
            info = nomina.get(code)
            row["nombre"] = info["nombre"] if info else nombres_extra.get(code, "")
            if info and info.get("alias"):
                row["alias"] = info["alias"]
            entidades.append(row)

    return {
        "fecha": fecha,
        "layout": layout,
        "entidades": entidades,
        "agregados": agregados,
    }
