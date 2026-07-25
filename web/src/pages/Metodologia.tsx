import { useCore } from "../lib/store";

// Conceptos clave con su fórmula/definición y cómo leerlos.
const CONCEPTOS: { code: string; titulo: string; formula?: string; nota: string }[] = [
  {
    code: "A9",
    titulo: "Mora (irregularidad total)",
    formula: "Cartera irregular (situación 3 a 6) / Financiaciones totales",
    nota: "Es el indicador que se muestra como “Mora” en la portada. Incluye el crédito al sector " +
      "público (que tiene mora casi nula), por lo que da más bajo que la irregularidad del sector privado.",
  },
  {
    code: "A11",
    titulo: "Irregularidad del sector privado",
    formula: "Cartera irregular del sector privado / Financiaciones al sector privado",
    nota: "Es el número que suele citar la prensa y los informes del BCRA. Ojo: el “Informe sobre Bancos” " +
      "(PDF mensual) puede diferir en una o dos décimas de este A11 del directorio IEF, porque son dos " +
      "productos oficiales con base y vintage algo distintos.",
  },
  {
    code: "A14",
    titulo: "Cobertura de la mora",
    formula: "Previsiones / Cartera irregular total",
    nota: "Cuánto de los préstamos malos está respaldado con reservas. Por encima de 100% = cartera " +
      "irregular más que cubierta.",
  },
  {
    code: "R1",
    titulo: "ROE — Rentabilidad sobre patrimonio",
    formula: "Resultado anualizado / Patrimonio neto",
    nota: "Rentabilidad para el accionista. En términos nominales; en contexto inflacionario conviene " +
      "compararlo contra la inflación del período.",
  },
  {
    code: "Rg1",
    titulo: "ROA — Retorno sobre activos",
    formula: "Resultado anualizado / Activo",
    nota: "Rentabilidad sobre el balance total.",
  },
  {
    code: "C1",
    titulo: "Apalancamiento",
    formula: "Pasivo total / Patrimonio neto (en veces)",
    nota: "Cuántas veces está apalancada la entidad respecto de su capital.",
  },
  {
    code: "C2 / C3",
    titulo: "Pérdida potencial de cartera",
    formula: "[Financiaciones en situación 2-5 (o 3-5) − Previsiones] / Patrimonio neto ajustado",
    nota: "Pueden dar NEGATIVO, y es correcto: significa que las previsiones superan a la cartera " +
      "clasificada en riesgo (entidad sobre-cubierta), lo cual es favorable. Lo mismo aplica a A21.",
  },
  {
    code: "R8 / R9",
    titulo: "Tasas implícitas",
    formula: "R8: Intereses ganados / Préstamos · R9: Intereses pagados / Depósitos",
    nota: "La diferencia entre ambas (R8 − R9) es, a grandes rasgos, el spread de intermediación del sistema.",
  },
  {
    code: "L1",
    titulo: "Liquidez amplia",
    formula: "Activos líquidos (incl. títulos con cotización, call, LELIQ/LEFI) / Depósitos",
    nota: "Hay un quiebre de serie: hasta el cambio de codebook del BCRA la serie histórica corresponde " +
      "a L2 (activos líquidos / pasivos líquidos), con definición distinta.",
  },
  {
    code: "—",
    titulo: "Préstamos / Depósitos",
    formula: "Préstamos totales / Depósitos totales del sistema",
    nota: "Indicador derivado (lo calculamos sobre los totales del sistema). Mide cuánto del ahorro se " +
      "presta efectivamente vs. cuánto se vuelca a títulos públicos y otros activos.",
  },
];

export default function Metodologia() {
  const { index } = useCore();

  return (
    <>
      <h1 className="pagetitle">Metodología y notas</h1>
      <div className="pagesub">
        Cómo se construyen los datos de este sitio y algunas aclaraciones para leerlos bien.
      </div>

      <section>
        <div className="card">
          <h3>Fuente de los datos</h3>
          <div className="resena">
            <p>
              Todo sale de la <b>Información de Entidades Financieras</b> (directorio IEF) que publica el
              BCRA cada mes, con un rezago de aproximadamente <b>3 meses</b>. La serie arranca en
              <b> julio de 2011</b> y se actualiza sola cuando el BCRA publica un período nuevo.
            </p>
            <p className="mut">
              Este sitio no es una publicación oficial del BCRA y no constituye asesoramiento financiero.
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="grid2">
          <div className="card">
            <h3>Unidades y criterios</h3>
            <div className="resena">
              <p>• Los <b>montos</b> están en <b>miles de pesos corrientes</b>.</p>
              <p>• Los <b>ratios</b> (mora, ROE, ROA, liquidez, etc.) vienen <b>ponderados y calculados por
                el BCRA</b> para cada agrupamiento; no los recalculamos.</p>
              <p>• Los agregados son <b>Sistema</b> (todas las entidades), <b>Bancos públicos</b> y
                <b> Bancos privados</b>. No se abre por capital nacional/extranjero ni por tipo de compañía.</p>
              <p>• Las <b>entidades dadas de baja</b> no aparecen en los buscadores, pero siguen en los
                rankings y series de los períodos en que operaban.</p>
            </div>
          </div>
          <div className="card">
            <h3>Inflación y pesos constantes</h3>
            <div className="resena">
              <p>
                En las series y la portada podés ver los montos en <b>pesos constantes</b> del último
                período. El deflactor es un <b>IPC empalmado</b>: IPC San Luis (2011–2012) → IPC CABA
                (2012–2016) → IPC Nacional INDEC (2016 en adelante).
              </p>
              <p className="mut">
                Los <b>ratios</b> (%) y las <b>participaciones de mercado</b> no se deflactan: no tienen ese
                problema. En pesos nominales, el crecimiento en un contexto de alta inflación engaña.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="card">
          <h3>Mora: “total” vs. “sector privado”</h3>
          <div className="resena">
            <p>
              La tarjeta de <b>Mora</b> de la portada usa <b>A9</b> (cartera irregular sobre financiaciones
              <i> totales</i>), que incluye el crédito al sector público —de mora casi nula— y por eso da
              más bajo. El número que suelen citar los informes del BCRA y la prensa es la
              <b> irregularidad del sector privado (A11)</b>, disponible en el ranking y en las series.
              No es una contradicción: son dos definiciones distintas del mismo fenómeno.
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="grid2">
          <div className="card">
            <h3>Indicadores que pueden ser negativos</h3>
            <div className="resena">
              <p>
                <b>C2, C3 y A21</b> pueden dar valores negativos, y es correcto. Su fórmula resta las
                previsiones a la cartera en riesgo: cuando una entidad tiene <b>más previsiones que cartera
                clasificada</b>, el resultado es negativo. Lejos de ser un problema, indica una entidad
                <b> sobre-cubierta</b>.
              </p>
            </div>
          </div>
          <div className="card">
            <h3>Quiebres de serie histórica</h3>
            <div className="resena">
              {Object.entries(index.series_breaks).map(([k, txt]) => (
                <p key={k}>• <b>{index.metrics[k]?.label ?? k}:</b> {txt}</p>
              ))}
              <p className="mut">
                Además, hay meses que el BCRA nunca publicó (mayo-2013, marzo-2014 y julio-2020): aparecen
                como huecos en las series.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="card">
          <h3>Glosario de indicadores clave</h3>
          <div className="cs">Código del BCRA · definición · cómo leerlo</div>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th className="n" style={{ width: 70 }}>Código</th>
                  <th className="n">Indicador</th>
                  <th className="n">Definición / fórmula</th>
                  <th className="n">Nota</th>
                </tr>
              </thead>
              <tbody>
                {CONCEPTOS.map((c) => (
                  <tr key={c.code + c.titulo}>
                    <td className="n"><b>{c.code}</b></td>
                    <td className="n">{c.titulo}</td>
                    <td className="n mut">{c.formula ?? "—"}</td>
                    <td className="n" style={{ fontSize: 12 }}>{c.nota}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section>
        <div className="card">
          <h3>Todos los indicadores disponibles</h3>
          <div className="cs">Los {Object.keys(index.metrics).length} indicadores que trae cada período</div>
          <div className="chips">
            {Object.values(index.metrics).map((m) => (
              <span key={m.label} className="chip">{m.label}</span>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
