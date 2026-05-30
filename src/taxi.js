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
   * como buffers em memória e executa quatro queries de agregação em paralelo.
   *
   * A chave de cada arquivo (ex.: "T201907") é gerada a partir do mês para
   * evitar colisões de nome no sistema de arquivos virtual do DuckDB WASM.
   *
   * Retorna um objeto com quatro arrays enriquecidos com metadados de feriado:
   *  - `passengers`: soma de passageiros por dia e macro-região.
   *  - `tips`: média de gorjetas por dia e macro-região.
   *  - `destinations`: top-10 destinos (DOLocationID) por dia de feriado.
   *  - `holidaySeries`: total de corridas por dia (sem divisão por região).
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
    // Fazer em paralelo com Promise.all causaria pico de memória excessivo.
    for (const f of files) {
      const res = await fetch(f.url);
      await this.db.registerFileBuffer(
        f.key,
        new Uint8Array(await res.arrayBuffer()),
      );
    }

    // Monta as strings SQL interpoladas a partir das constantes do projeto
    const fileKeys = `[${files.map((d) => `'${d.key}'`).join(",")}]`;
    const zoneList = MANHATTAN_ZONES.join(",");
    const holidayList = HOLIDAYS.map((d) => `DATE '${d}'`).join(",");

    /**
     * Expressão CASE que classifica cada zona de embarque em uma
     * das três macro-regiões de Manhattan para simplificar a análise.
     * Os IDs foram atribuídos manualmente com base no mapa de zonas da NYC TLC.
     */
    const macroRegionSql = `
      CASE
        WHEN PULocationID IN (24,41,42,43,74,75,116,151,152,166) THEN 'Downtown'
        WHEN PULocationID IN (48,50,68,79,90,100,107,113,114,125,137,140,141,142,143,144,148,229,230,231,233,234) THEN 'Midtown'
        ELSE 'Uptown'
      END
    `;

    // Executa as quatro queries analíticas em paralelo para minimizar o tempo de espera
    const [passengers, tips, destinations, holidaySeries] = await Promise.all([
      this.query(
        `SELECT CAST(tpep_pickup_datetime AS DATE) AS day, ${macroRegionSql} AS region, SUM(passenger_count) AS passengers FROM read_parquet(${fileKeys}) WHERE PULocationID IN (${zoneList}) AND CAST(tpep_pickup_datetime AS DATE) IN (${holidayList}) GROUP BY day, region ORDER BY day, region;`,
      ),
      this.query(
        `SELECT CAST(tpep_pickup_datetime AS DATE) AS day, ${macroRegionSql} AS region, AVG(tip_amount) AS avg_tip FROM read_parquet(${fileKeys}) WHERE PULocationID IN (${zoneList}) AND CAST(tpep_pickup_datetime AS DATE) IN (${holidayList}) GROUP BY day, region ORDER BY day, region;`,
      ),
      // QUALIFY filtra apenas o top-10 destinos por dia, evitando subquery
      this.query(
        `SELECT CAST(tpep_pickup_datetime AS DATE) AS day, DOLocationID AS destination, COUNT(*) AS trips FROM read_parquet(${fileKeys}) WHERE PULocationID IN (${zoneList}) AND CAST(tpep_pickup_datetime AS DATE) IN (${holidayList}) GROUP BY day, destination QUALIFY ROW_NUMBER() OVER (PARTITION BY day ORDER BY trips DESC) <= 10 ORDER BY day, trips DESC;`,
      ),
      this.query(
        `SELECT CAST(tpep_pickup_datetime AS DATE) AS day, COUNT(*) AS trips FROM read_parquet(${fileKeys}) WHERE PULocationID IN (${zoneList}) AND CAST(tpep_pickup_datetime AS DATE) IN (${holidayList}) GROUP BY day ORDER BY day;`,
      ),
    ]);

    return {
      passengers: passengers.map((d) => enrichHoliday(d)),
      tips: tips.map((d) => enrichHoliday(d)),
      destinations: destinations.map((d) => ({
        ...enrichHoliday(d),
        destinationLabel: `Zona ${d.destination}`,
      })),
      holidaySeries: holidaySeries.map((d) => enrichHoliday(d)),
    };
  }

  /**
   * Executa uma query SQL e retorna os resultados como array de objetos planos.
   * O método `normalizeRow` converte campos `bigint` (tipo padrão de COUNT no DuckDB)
   * para `number`, garantindo compatibilidade com D3 e operações aritméticas.
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
