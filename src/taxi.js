import { loadDb } from "./config";
import { HOLIDAYS } from "./constants/holidays";
import { MANHATTAN_ZONES } from "./constants/zones";
import { enrichHoliday } from "./utils/date";

/**
 * Classe responsável por toda a camada de dados da aplicação.
 *
 * Ela concentra:
 * - a inicialização do DuckDB WASM;
 * - o carregamento dos arquivos Parquet no navegador;
 * - as queries SQL que agregam os dados usados pelas visualizações;
 * - a normalização dos resultados para objetos JavaScript comuns.
 */
export class Taxi {
  /**
   * Inicializa o DuckDB.
   */
  async init() {
    this.db = await loadDb();
    this.conn = await this.db.connect();

    await this.conn.query("SET threads=1; SET preserve_insertion_order=false;");
  }

  /**
   * Carrega os arquivos Parquet mensais via fetch, registra-os no DuckDB
   * como buffers em memória e executa as queries necessárias para as views.
   *
   * As quatro tabelas agregadas geradas aqui são:
   *
   *  - `holidaySeries`:
   *      volume total de corridas por feriado, usado no heatmap.
   *
   *  - `holidayTipsByYear`:
   *      gorjeta média por corrida em cada feriado e ano, usada na view de gorjetas.
   *
   *  - `holidayPaymentShare`:
   *      distribuição das formas de pagamento por feriado e ano, usada na view
   *      de barras empilhadas percentuais.
   *
   *  - `holidayHourlyByYear`:
   *      número de corridas por hora do dia, usado no histograma horário.
   */
  async loadAndAggregate() {
    /**
     * Lista de arquivos mensais usados na análise.
     *
     */
    const files = [
      "2019-07",
      "2019-08",
      "2019-09",
      "2019-11",
      "2019-12",
      "2020-01",
      "2020-02",
      "2020-03",
      "2020-04",
      "2020-05",
      "2020-06",
      "2020-07",
      "2020-08",
      "2020-09",
      "2020-10",
      "2020-11",
      "2020-12",
      "2021-01",
      "2021-02",
      "2021-03",
      "2021-04",
      "2021-05",
      "2021-06",
      "2021-07",
      "2021-08",
      "2021-09",
      "2021-10",
      "2021-11",
      "2021-12",
      "2022-01",
      "2022-02",
      "2022-03",
      "2022-04",
      "2022-05",
      "2022-06",
      "2022-07",
      "2022-08",
      "2022-09",
      "2022-10",
      "2022-11",
      "2022-12",
    ].map((m) => ({
      key: `T${m.replace("-", "")}`,
      url: `data/parquet/yellow_tripdata_${m}.parquet`,
    }));

    /**
     * Carrega cada Parquet no navegador e registra no DuckDB.
     *
     * O carregamento é sequencial de propósito. Embora `Promise.all` fosse mais
     * curto, carregar muitos arquivos grandes ao mesmo tempo gerou pico de
     * memória no browser.
     */
    for (const f of files) {
      const res = await fetch(f.url);

      await this.db.registerFileBuffer(
        f.key,
        new Uint8Array(await res.arrayBuffer()),
      );
    }

    /**
     * Monta a lista de arquivos no formato esperado pelo `read_parquet`.
     *
     * Exemplo de resultado:
     * ['T201907','T201908','T201909',...]
     *
     * Essa string é interpolada nas queries para que o DuckDB leia todos os
     * Parquet como uma única tabela lógica.
     */
    const fileKeys = `[${files.map((d) => `'${d.key}'`).join(",")}]`;

    /**
     * `union_by_name=true` faz o DuckDB combinar os arquivos pelo nome das
     * colunas, em vez de assumir que todos os Parquet têm exatamente o mesmo
     * schema na mesma ordem.
     *
     */
    const parquetSource = `read_parquet(${fileKeys}, union_by_name=true)`;

    /**
     * Strings auxiliares usadas nos filtros SQL.
     *
     * `zoneList` restringe a análise às zonas de Manhattan.
     * `holidayList` restringe a análise às datas dos feriados selecionados.
     */
    const zoneList = MANHATTAN_ZONES.join(",");
    const holidayList = HOLIDAYS.map((d) => `DATE '${d}'`).join(",");

    /**
     * As queries são executadas em paralelo porque são agregações independentes.
     *
     * Todas leem a mesma fonte Parquet, mas produzem tabelas diferentes para
     * visualizações diferentes.
     */
    const [
      holidaySeries,
      holidayTipsByYear,
      holidayPaymentShare,
      holidayHourlyByYear,
    ] = await Promise.all([
      /**
       * Query 1 — Volume total de corridas por feriado.
       *
       * Esta query alimenta o heatmap.
       *
       * A lógica é:
       * - transformar `tpep_pickup_datetime` em data, ignorando a hora;
       * - contar quantas corridas começaram em Manhattan em cada feriado;
       * - agrupar por dia.
       *
       * O resultado tem uma linha por feriado real, por exemplo:
       * `{ day: 2020-12-25, trips: 6429 }`.
       *
       * Depois, `enrichHoliday` adiciona informações como ano, nome do feriado
       * e rótulos usados nas visualizações.
       */
      this.query(
        `
        SELECT
          CAST(tpep_pickup_datetime AS DATE) AS day,
          COUNT(*) AS trips
        FROM ${parquetSource}
        WHERE
          PULocationID IN (${zoneList})
          AND CAST(tpep_pickup_datetime AS DATE) IN (${holidayList})
        GROUP BY day
        ORDER BY day;
        `,
      ),

      /**
       * Query 2 — Gorjeta média por corrida em cada feriado.
       *
       * Esta query alimenta a visualização de gorjetas por feriado e ano.
       *
       * Ela calcula:
       * - `trips`: número de corridas consideradas no feriado;
       * - `total_tip`: soma das gorjetas registradas;
       * - `avg_tip`: média de gorjeta por corrida.
       *
       * O filtro `tip_amount IS NOT NULL` evita valores ausentes.
       * O filtro `tip_amount >= 0` remove valores negativos, que normalmente
       * representam correções ou inconsistências, não uma gorjeta real negativa.
       *
       * A análise continua restrita a corridas com embarque em Manhattan e em
       * datas de feriados.
       */
      this.query(
        `
        SELECT
          CAST(tpep_pickup_datetime AS DATE) AS day,
          COUNT(*) AS trips,
          SUM(tip_amount) AS total_tip,
          AVG(tip_amount) AS avg_tip
        FROM ${parquetSource}
        WHERE
          PULocationID IN (${zoneList})
          AND CAST(tpep_pickup_datetime AS DATE) IN (${holidayList})
          AND tip_amount IS NOT NULL
          AND tip_amount >= 0
        GROUP BY day
        ORDER BY day;
        `,
      ),

      /**
       * Query 3 — Distribuição das formas de pagamento por feriado.
       *
       * Esta query alimenta a visualização de barras empilhadas percentuais.
       *
       * Ela conta quantas corridas, em cada feriado, usaram cada forma de
       * pagamento selecionada. A proporção percentual não é calculada aqui;
       * ela é calculada na view, porque depende da montagem das barras empilhadas.
       *
       * O filtro `payment_type IN (0, 1, 2)` mantém apenas categorias que
       * representam formas efetivas de pagamento:
       * - 0 = Flex Fare trip;
       * - 1 = Credit card;
       * - 2 = Cash.
       *
       * Categorias como disputa, desconhecido, viagem anulada ou sem cobrança
       * são deixadas de fora para não misturar formas de pagamento reais com
       * estados administrativos da corrida.
       */
      this.query(
        `
        SELECT
          CAST(tpep_pickup_datetime AS DATE) AS day,
          CAST(payment_type AS INTEGER) AS payment_type,
          COUNT(*) AS trips
        FROM ${parquetSource}
        WHERE
          PULocationID IN (${zoneList})
          AND CAST(tpep_pickup_datetime AS DATE) IN (${holidayList})
          AND payment_type IN (0, 1, 2)
        GROUP BY day, payment_type
        ORDER BY day, payment_type;
        `,
      ),

      /**
       * Query 4 — Distribuição horária das corridas em feriados.
       *
       * Esta query alimenta o histograma horário.
       *
       * A lógica é:
       * - extrair a hora do embarque com `EXTRACT('hour' FROM tpep_pickup_datetime)`;
       * - contar quantas corridas aconteceram em cada hora do dia;
       * - agrupar por feriado e por hora.
       *
       * O resultado permite reconstruir um histograma de 24 horas para cada
       * combinação de feriado e ano.
       *
       * O filtro `tpep_pickup_datetime IS NOT NULL` garante que a extração da
       * hora só seja feita em registros com data/hora válida.
       */
      this.query(
        `
        SELECT
          CAST(tpep_pickup_datetime AS DATE) AS day,
          CAST(EXTRACT('hour' FROM tpep_pickup_datetime) AS INTEGER) AS pickup_hour,
          COUNT(*) AS trips
        FROM ${parquetSource}
        WHERE
          PULocationID IN (${zoneList})
          AND tpep_pickup_datetime IS NOT NULL
          AND CAST(tpep_pickup_datetime AS DATE) IN (${holidayList})
        GROUP BY day, pickup_hour
        ORDER BY day, pickup_hour;
        `,
      ),
    ]);

    /**
     * Antes de devolver os dados para as views, cada linha passa por
     * `enrichHoliday`.
     *
     * Essa função acrescenta metadados derivados da data, como:
     * - ano;
     * - nome canônico do feriado;
     * - rótulo legível do dia;
     * - data em ISO.
     *
     * Assim, as views não precisam repetir lógica de calendário.
     */
    return {
      holidaySeries: holidaySeries.map((d) => enrichHoliday(d)),
      holidayTipsByYear: holidayTipsByYear.map((d) => enrichHoliday(d)),
      holidayPaymentShare: holidayPaymentShare.map((d) => enrichHoliday(d)),
      holidayHourlyByYear: holidayHourlyByYear.map((d) => enrichHoliday(d)),
    };
  }

  /**
   * Executa uma query SQL no DuckDB e converte o resultado para array de objetos.
   *
   * O DuckDB retorna uma estrutura própria de tabela. O `toArray()` transforma
   * as linhas em objetos, e `toJSON()` facilita converter cada linha para um
   * formato JavaScript comum.
   */
  async query(sql) {
    const result = await this.conn.query(sql);
    return result.toArray().map((row) => this.normalizeRow(row.toJSON()));
  }

  /**
   * Normaliza os tipos retornados pelo DuckDB.
   *
   * Alguns agregadores, como `COUNT(*)`, podem voltar como `bigint`.
   * Como o D3 trabalha melhor com `number` nas escalas, e os valores aqui estão
   * dentro de uma faixa segura para JavaScript, convertemos `bigint` para `number`.
   */
  normalizeRow(obj) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [
        k,
        typeof v === "bigint" ? Number(v) : v,
      ]),
    );
  }
}