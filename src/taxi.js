import { loadDb } from './config';

const HOLIDAYS = [
  '2019-07-04','2019-09-02','2019-11-11','2019-11-28','2019-12-25',
  '2020-01-01','2020-01-20','2020-02-17','2020-05-25','2020-07-04','2020-09-07','2020-11-11','2020-11-26','2020-12-25',
  '2021-01-01','2021-01-18','2021-02-15','2021-05-31','2021-07-04','2021-09-06','2021-11-11','2021-11-25','2021-12-25',
  '2022-01-01','2022-01-17','2022-02-21','2022-05-30','2022-07-04','2022-09-05','2022-11-11','2022-11-24','2022-12-25',
];

const HOLIDAY_LABELS = {
  '2019-07-04': '04 Jul 2019 (Independence Day)',
  '2019-09-02': '02 Sep 2019 (Labor Day)',
  '2019-11-11': '11 Nov 2019 (Veterans Day)',
  '2019-11-28': '28 Nov 2019 (Thanksgiving)',
  '2019-12-25': '25 Dec 2019 (Christmas)',
  '2020-01-01': '01 Jan 2020 (New Year)',
  '2020-01-20': '20 Jan 2020 (MLK Day)',
  '2020-02-17': '17 Feb 2020 (Presidents Day)',
  '2020-05-25': '25 May 2020 (Memorial Day)',
  '2020-07-04': '04 Jul 2020 (Independence Day)',
  '2020-09-07': '07 Sep 2020 (Labor Day)',
  '2020-11-11': '11 Nov 2020 (Veterans Day)',
  '2020-11-26': '26 Nov 2020 (Thanksgiving)',
  '2020-12-25': '25 Dec 2020 (Christmas)',
  '2021-01-01': '01 Jan 2021 (New Year)',
  '2021-01-18': '18 Jan 2021 (MLK Day)',
  '2021-02-15': '15 Feb 2021 (Presidents Day)',
  '2021-05-31': '31 May 2021 (Memorial Day)',
  '2021-07-04': '04 Jul 2021 (Independence Day)',
  '2021-09-06': '06 Sep 2021 (Labor Day)',
  '2021-11-11': '11 Nov 2021 (Veterans Day)',
  '2021-11-25': '25 Nov 2021 (Thanksgiving)',
  '2021-12-25': '25 Dec 2021 (Christmas)',
  '2022-01-01': '01 Jan 2022 (New Year)',
  '2022-01-17': '17 Jan 2022 (MLK Day)',
  '2022-02-21': '21 Feb 2022 (Presidents Day)',
  '2022-05-30': '30 May 2022 (Memorial Day)',
  '2022-07-04': '04 Jul 2022 (Independence Day)',
  '2022-09-05': '05 Sep 2022 (Labor Day)',
  '2022-11-11': '11 Nov 2022 (Veterans Day)',
  '2022-11-24': '24 Nov 2022 (Thanksgiving)',
  '2022-12-25': '25 Dec 2022 (Christmas)',
};

const MANHATTAN_ZONES = [4,12,13,24,41,42,43,45,48,50,68,74,75,79,87,88,90,100,103,104,105,107,113,114,116,120,125,127,128,137,140,141,142,143,144,148,151,152,153,158,161,162,163,164,166,170,186,194,202,209,211,224,229,230,231,232,233,234,236,237,238,239,243,244,246,249,261,262,263];

export class Taxi {
  async init() {
    this.db = await loadDb();
    this.conn = await this.db.connect();
    await this.conn.query('SET threads=1; SET preserve_insertion_order=false;');
  }

  async loadAndAggregate() {
    const files = [
      '2019-07','2019-08','2019-09','2019-11','2019-12',
      '2020-01','2020-02','2020-03','2020-04','2020-05','2020-06','2020-07','2020-08','2020-09','2020-10','2020-11','2020-12',
      '2021-01','2021-02','2021-03','2021-04','2021-05','2021-06','2021-07','2021-08','2021-09','2021-10','2021-11','2021-12',
      '2022-01','2022-02','2022-03','2022-04','2022-05','2022-06','2022-07','2022-08','2022-09','2022-10','2022-11','2022-12',
    ].map((m) => ({ key: `T${m.replace('-', '')}`, url: `data/parquet/yellow_tripdata_${m}.parquet` }));

    for (const f of files) {
      const res = await fetch(f.url);
      await this.db.registerFileBuffer(f.key, new Uint8Array(await res.arrayBuffer()));
    }

    const fileKeys = `[${files.map((d) => `'${d.key}'`).join(',')}]`;
    const zoneList = MANHATTAN_ZONES.join(',');
    const holidayList = HOLIDAYS.map((d) => `DATE '${d}'`).join(',');

    const macroRegionSql = `
      CASE
        WHEN PULocationID IN (24,41,42,43,74,75,116,151,152,166) THEN 'Downtown'
        WHEN PULocationID IN (48,50,68,79,90,100,107,113,114,125,137,140,141,142,143,144,148,229,230,231,233,234) THEN 'Midtown'
        ELSE 'Uptown'
      END
    `;

    const [passengers, tips, destinations, holidaySeries] = await Promise.all([
      this.query(`SELECT CAST(tpep_pickup_datetime AS DATE) AS day, ${macroRegionSql} AS region, SUM(passenger_count) AS passengers FROM read_parquet(${fileKeys}) WHERE PULocationID IN (${zoneList}) AND CAST(tpep_pickup_datetime AS DATE) IN (${holidayList}) GROUP BY day, region ORDER BY day, region;`),
      this.query(`SELECT CAST(tpep_pickup_datetime AS DATE) AS day, ${macroRegionSql} AS region, AVG(tip_amount) AS avg_tip FROM read_parquet(${fileKeys}) WHERE PULocationID IN (${zoneList}) AND CAST(tpep_pickup_datetime AS DATE) IN (${holidayList}) GROUP BY day, region ORDER BY day, region;`),
      this.query(`SELECT CAST(tpep_pickup_datetime AS DATE) AS day, DOLocationID AS destination, COUNT(*) AS trips FROM read_parquet(${fileKeys}) WHERE PULocationID IN (${zoneList}) AND CAST(tpep_pickup_datetime AS DATE) IN (${holidayList}) GROUP BY day, destination QUALIFY ROW_NUMBER() OVER (PARTITION BY day ORDER BY trips DESC) <= 10 ORDER BY day, trips DESC;`),
      this.query(`SELECT CAST(tpep_pickup_datetime AS DATE) AS day, COUNT(*) AS trips FROM read_parquet(${fileKeys}) WHERE PULocationID IN (${zoneList}) AND CAST(tpep_pickup_datetime AS DATE) IN (${holidayList}) GROUP BY day ORDER BY day;`),
    ]);

    return {
      passengers: passengers.map((d) => enrichHoliday(d)),
      tips: tips.map((d) => enrichHoliday(d)),
      destinations: destinations.map((d) => ({ ...enrichHoliday(d), destinationLabel: `Zona ${d.destination}` })),
      holidaySeries: holidaySeries.map((d) => enrichHoliday(d)),
    };
  }

  async query(sql) {
    const result = await this.conn.query(sql);
    return result.toArray().map((row) => this.normalizeRow(row.toJSON()));
  }

  normalizeRow(obj) {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v]));
  }
}

function formatDate(iso) { return new Date(`${iso}T00:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }); }
function toISODate(value) { if (value instanceof Date) return value.toISOString().slice(0, 10); if (typeof value === 'number') return new Date(value).toISOString().slice(0, 10); const s = String(value); if (/^\d+$/.test(s)) return new Date(Number(s)).toISOString().slice(0, 10); return s.slice(0, 10); }

function enrichHoliday(d) {
  const dayISO = toISODate(d.day);
  const dayLabel = HOLIDAY_LABELS[dayISO] ?? formatDate(dayISO);
  const holidayName = dayLabel.includes('(') ? dayLabel.split('(')[1].replace(')', '') : dayLabel;
  const year = Number(dayISO.slice(0, 4));
  return { ...d, dayISO, dayLabel, holidayName, year };
}
