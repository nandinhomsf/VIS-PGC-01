import { loadDb } from "./config";
import { HOLIDAYS } from "./constants/holidays";
import { MANHATTAN_ZONES } from "./constants/zones";
import { enrichHoliday } from "./utils/date";

/**
 * Classe responsável por toda a camada de dados da aplicação.
 * Encapsula a conexão com o DuckDB WASM, o carregamento dos arquivos Parquet
 * e a execução das queries de agregação analítica.
 */
export class Taxi {
  /**
   * Inicializa o banco de dados e abre uma conexão reutilizável.
   * `SET threads=1` é obrigatório no ambiente WASM de thread única do browser.
   * `SET preserve_insertion_order=false` melhora o desempenho das agregações
   * ao permitir que o DuckDB reordene internamente as linhas lidas.
   */
  async init() {
    this.db = await loadDb();
    this.conn = await this.db.connect();

    await this.conn.query("SET threads=1; SET preserve_insertion_order=false;");
  }

  /**
   * Carrega os arquivos Parquet mensais via fetch, registra-os no DuckDB
   * como buffers em memória e executa as queries necessárias para as views:
   *
   *  - `holidaySeries`:
   *      total de corridas por feriado, usado no heatmap Feriado × Ano.
   *
   *  - `holidayTipsByYear`:
   *      gorjeta média por corrida em cada feriado e ano.
   *
   *  - `holidayPaymentShare`:
   *      distribuição das formas de pagamento por feriado e ano.
   *
   *  - `holidayHourlyByYear`:
   *      distribuição horária das corridas por feriado e ano.
   */
  async loadAndAggregate() {
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

    // Carrega cada arquivo Parquet na memória do DuckDB sequencialmente.
    // Fazer em paralelo com Promise.all pode causar pico de memória no browser.
    for (const f of files) {
      const res = await fetch(f.url);

      await this.db.registerFileBuffer(
        f.key,
        new Uint8Array(await res.arrayBuffer()),
      );
    }

    // Monta as strings SQL interpoladas a partir das constantes do projeto.
    const fileKeys = `[${files.map((d) => `'${d.key}'`).join(",")}]`;

    /**
     * `union_by_name=true` evita erros quando os arquivos Parquet mensais
     * possuem pequenas diferenças de schema entre si.
     */
    const parquetSource = `read_parquet(${fileKeys}, union_by_name=true)`;

    const zoneList = MANHATTAN_ZONES.join(",");
    const holidayList = HOLIDAYS.map((d) => `DATE '${d}'`).join(",");

    /**
     * As queries são executadas em paralelo:
     *
     * 1. `holidaySeries` mede volume total de corridas por feriado.
     * 2. `holidayTipsByYear` mede gorjeta média por corrida em cada feriado.
     * 3. `holidayPaymentShare` mede a composição das formas de pagamento.
     * 4. `holidayHourlyByYear` mede o número de corridas por hora do dia.
     *
     * Para `payment_type`, usamos apenas códigos com pagamento efetivo:
     * 0 = Flex Fare trip
     * 1 = Credit card
     * 2 = Cash
     */
    const [
      holidaySeries,
      holidayTipsByYear,
      holidayPaymentShare,
      holidayHourlyByYear,
    ] = await Promise.all([
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

    return {
      holidaySeries: holidaySeries.map((d) => enrichHoliday(d)),
      holidayTipsByYear: holidayTipsByYear.map((d) => enrichHoliday(d)),
      holidayPaymentShare: holidayPaymentShare.map((d) => enrichHoliday(d)),
      holidayHourlyByYear: holidayHourlyByYear.map((d) => enrichHoliday(d)),
    };
  }

  /**
   * Executa uma query SQL e retorna os resultados como array de objetos planos.
   * O método `normalizeRow` converte campos `bigint`, tipo padrão de COUNT
   * no DuckDB, para `number`, garantindo compatibilidade com D3.
   */
  async query(sql) {
    const result = await this.conn.query(sql);
    return result.toArray().map((row) => this.normalizeRow(row.toJSON()));
  }

  normalizeRow(obj) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [
        k,
        typeof v === "bigint" ? Number(v) : v,
      ]),
    );
  }
}