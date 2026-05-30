/**
 * Feriados oficiais dos EUA cobertos pela análise (2019–2022).
 *
 * A janela começa em julho de 2019 porque os arquivos Parquet disponíveis
 * só cobrem a partir de 2019-07. Os anos de 2020 a 2022 estão completos.
 * As datas estão no formato ISO 8601 (AAAA-MM-DD) para uso direto nas
 * cláusulas SQL `DATE '...'` do DuckDB.
 */
export const HOLIDAYS = [
  "2019-07-04",
  "2019-09-02",
  "2019-11-11",
  "2019-11-28",
  "2019-12-25",
  "2020-01-01",
  "2020-01-20",
  "2020-02-17",
  "2020-05-25",
  "2020-07-04",
  "2020-09-07",
  "2020-11-11",
  "2020-11-26",
  "2020-12-25",
  "2021-01-01",
  "2021-01-18",
  "2021-02-15",
  "2021-05-31",
  "2021-07-04",
  "2021-09-06",
  "2021-11-11",
  "2021-11-25",
  "2021-12-25",
  "2022-01-01",
  "2022-01-17",
  "2022-02-21",
  "2022-05-30",
  "2022-07-04",
  "2022-09-05",
  "2022-11-11",
  "2022-11-24",
  "2022-12-25",
];

/**
 * Rótulos de exibição para cada feriado, indexados pela data ISO.
 * O formato "DD Mon AAAA (Nome)" é usado nos eixos e tooltips dos gráficos.
 * O nome entre parênteses é extraído em `utils/date.js` para identificar
 * o tipo do feriado (ex.: "Memorial Day", "Thanksgiving") de forma genérica.
 */
export const HOLIDAY_LABELS = {
  "2019-07-04": "04 Jul 2019 (Independence Day)",
  "2019-09-02": "02 Sep 2019 (Labor Day)",
  "2019-11-11": "11 Nov 2019 (Veterans Day)",
  "2019-11-28": "28 Nov 2019 (Thanksgiving)",
  "2019-12-25": "25 Dec 2019 (Christmas)",
  "2020-01-01": "01 Jan 2020 (New Year)",
  "2020-01-20": "20 Jan 2020 (MLK Day)",
  "2020-02-17": "17 Feb 2020 (Presidents Day)",
  "2020-05-25": "25 May 2020 (Memorial Day)",
  "2020-07-04": "04 Jul 2020 (Independence Day)",
  "2020-09-07": "07 Sep 2020 (Labor Day)",
  "2020-11-11": "11 Nov 2020 (Veterans Day)",
  "2020-11-26": "26 Nov 2020 (Thanksgiving)",
  "2020-12-25": "25 Dec 2020 (Christmas)",
  "2021-01-01": "01 Jan 2021 (New Year)",
  "2021-01-18": "18 Jan 2021 (MLK Day)",
  "2021-02-15": "15 Feb 2021 (Presidents Day)",
  "2021-05-31": "31 May 2021 (Memorial Day)",
  "2021-07-04": "04 Jul 2021 (Independence Day)",
  "2021-09-06": "06 Sep 2021 (Labor Day)",
  "2021-11-11": "11 Nov 2021 (Veterans Day)",
  "2021-11-25": "25 Nov 2021 (Thanksgiving)",
  "2021-12-25": "25 Dec 2021 (Christmas)",
  "2022-01-01": "01 Jan 2022 (New Year)",
  "2022-01-17": "17 Jan 2022 (MLK Day)",
  "2022-02-21": "21 Feb 2022 (Presidents Day)",
  "2022-05-30": "30 May 2022 (Memorial Day)",
  "2022-07-04": "04 Jul 2022 (Independence Day)",
  "2022-09-05": "05 Sep 2022 (Labor Day)",
  "2022-11-11": "11 Nov 2022 (Veterans Day)",
  "2022-11-24": "24 Nov 2022 (Thanksgiving)",
  "2022-12-25": "25 Dec 2022 (Christmas)",
};
