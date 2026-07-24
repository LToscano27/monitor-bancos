# Monitor del Sistema Financiero Argentino

Monitor web del sistema financiero argentino construido sobre los datos oficiales que el BCRA
publica mensualmente (Información de Entidades Financieras, directorio IEF). Series históricas
desde julio 2011: totales del sistema, ranking de entidades, comparador, fichas por banco y
vista ajustada por inflación.

## Fuente de datos

El BCRA publica cada mes (con ~3 meses de rezago) un `.7z` con toda la información de entidades
financieras en TXT:

```
https://www.bcra.gob.ar/archivos/Pdfs/PublicacionesEstadisticas/Entidades/AAAAMMd.7z
```

Notas del formato (aprendidas a fuerza de explorar):

- TSV con campos entre comillas dobles, encoding latin-1, decimales con punto, vacíos como `.` o `""`.
- Períodos inexistentes devuelven **HTTP 200 con una página HTML de error**: hay que validar los
  magic bytes `37 7A BC AF` del 7z.
- `Entfin/Tec_Cont/ranking/completo.txt` es el archivo principal (una fila por entidad o
  agrupamiento `AA###`; `AA000` = total del sistema). El layout **cambió con los años**: la era
  moderna trae 42 campos (40 métricas), la era vieja (2011+) solo 10, con los ratios en
  `indicad/completo.txt` bajo otro codebook. El `formato.txt` de los dumps viejos está
  desactualizado: el parser detecta el layout por cantidad de campos, no por lo que declara.
- Montos en **miles de pesos corrientes**. Los ratios de agrupamientos ya vienen ponderados por
  el BCRA y no se recalculan.

## Estructura

- `pipeline/` — ETL en Python 3.12 (`requests`, `py7zr`). Descarga, parsea y consolida.
- `data/` — JSONs versionados: un archivo por período, series temporales consolidadas,
  fichas por entidad, índice de catálogo e IPC para deflactar.
- `web/` — Frontend estático (Vite + React + TypeScript + Chart.js), deployable en Vercel.
- `.github/workflows/update.yml` — cron que detecta períodos nuevos, procesa y commitea.

## Uso del pipeline

```bash
# procesar un período puntual
python pipeline/process_period.py 202604

# backfill histórico completo (reanudable; loguea meses fallidos y sigue)
python pipeline/backfill.py

# reconstruir series consolidadas + índice a partir de data/periods/
python pipeline/build_series.py

# actualización incremental idempotente (la que corre el cron)
python pipeline/update.py
```

Los 7z crudos se cachean en `%LOCALAPPDATA%\bcra-raw-cache` (o `$BCRA_CACHE_DIR`) para no
redescargar en re-corridas.
