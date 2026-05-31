from pathlib import Path
import re
import ast
import calendar
from datetime import date
import duckdb


ROOT = Path(__file__).resolve().parents[1]

INPUT_DIR = ROOT / "data" / "parquet"
OUTPUT_DIR = ROOT / "data" / "parquet_holidays"

ZONES_JS = ROOT / "src" / "constants" / "zones.js"
HOLIDAYS_JS = ROOT / "src" / "constants" / "holidays.js"

START_YEAR = 2019
END_YEAR = 2022

# Colunas necessárias para as visualizações atuais:
# - tpep_pickup_datetime: data, ano, hora e filtro de feriados;
# - PULocationID: filtro de Manhattan;
# - payment_type: formas de pagamento;
# - tip_amount: gorjetas médias.
#
# Mantive algumas colunas extras úteis para conferência ou análises futuras.
SELECTED_COLUMNS = [
    "tpep_pickup_datetime",
    "tpep_dropoff_datetime",
    "PULocationID",
    "DOLocationID",
    "passenger_count",
    "trip_distance",
    "payment_type",
    "tip_amount",
    "total_amount",
]


def parse_js_number_array(path: Path, const_name: str) -> list[int]:
    """
    Lê um arquivo JS simples com algo como:
    export const MANHATTAN_ZONES = [1, 2, 3];

    Isso evita duplicar manualmente a lista de zonas no script Python.
    """
    text = path.read_text(encoding="utf-8")

    pattern = rf"{const_name}\s*=\s*(\[[\s\S]*?\])"
    match = re.search(pattern, text)

    if not match:
        raise ValueError(f"Não encontrei {const_name} em {path}")

    array_text = match.group(1)
    values = ast.literal_eval(array_text)

    return [int(v) for v in values]


def parse_js_string_array(path: Path, const_name: str) -> list[str]:
    """
    Lê um arquivo JS simples com algo como:
    export const HOLIDAYS = ["2020-01-01", "2020-12-25"];

    Se o seu constants/holidays.js já contém a lista usada no app, este script
    reaproveita exatamente as mesmas datas.
    """
    text = path.read_text(encoding="utf-8")

    pattern = rf"{const_name}\s*=\s*(\[[\s\S]*?\])"
    match = re.search(pattern, text)

    if not match:
        raise ValueError(f"Não encontrei {const_name} em {path}")

    array_text = match.group(1)
    values = ast.literal_eval(array_text)

    return [str(v) for v in values]


def nth_weekday(year: int, month: int, weekday: int, n: int) -> date:
    """
    Retorna a n-ésima ocorrência de um dia da semana no mês.
    weekday: segunda=0, terça=1, ..., domingo=6.
    """
    count = 0

    for day in range(1, 32):
        try:
            current = date(year, month, day)
        except ValueError:
            break

        if current.weekday() == weekday:
            count += 1
            if count == n:
                return current

    raise ValueError("Data não encontrada")


def last_weekday(year: int, month: int, weekday: int) -> date:
    """
    Retorna a última ocorrência de um dia da semana no mês.
    weekday: segunda=0, terça=1, ..., domingo=6.
    """
    last_day = calendar.monthrange(year, month)[1]

    for day in range(last_day, 0, -1):
        current = date(year, month, day)
        if current.weekday() == weekday:
            return current

    raise ValueError("Data não encontrada")


def build_us_holidays(start_year: int, end_year: int) -> list[str]:
    """
    Fallback para gerar os feriados usados no projeto caso o arquivo
    src/constants/holidays.js não exista ou não esteja no formato esperado.
    """
    holidays = []

    for year in range(start_year, end_year + 1):
        holidays.extend(
            [
                date(year, 1, 1),                 # New Year
                nth_weekday(year, 1, 0, 3),       # MLK Day: 3ª segunda de janeiro
                nth_weekday(year, 2, 0, 3),       # Presidents Day: 3ª segunda de fevereiro
                last_weekday(year, 5, 0),         # Memorial Day: última segunda de maio
                date(year, 7, 4),                 # Independence Day
                nth_weekday(year, 9, 0, 1),       # Labor Day: 1ª segunda de setembro
                date(year, 11, 11),               # Veterans Day
                nth_weekday(year, 11, 3, 4),      # Thanksgiving: 4ª quinta de novembro
                date(year, 12, 25),               # Christmas
            ]
        )

    return [d.isoformat() for d in holidays]


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    manhattan_zones = parse_js_number_array(ZONES_JS, "MANHATTAN_ZONES")

    try:
        holidays = parse_js_string_array(HOLIDAYS_JS, "HOLIDAYS")
        print(f"Usando feriados de {HOLIDAYS_JS}")
    except Exception as exc:
        print(f"Não consegui ler {HOLIDAYS_JS}. Gerando feriados automaticamente.")
        print(f"Motivo: {exc}")
        holidays = build_us_holidays(START_YEAR, END_YEAR)

    zone_list = ",".join(str(z) for z in manhattan_zones)
    holiday_list = ",".join(f"DATE '{d}'" for d in holidays)

    con = duckdb.connect()

    input_files = sorted(INPUT_DIR.glob("yellow_tripdata_*.parquet"))

    if not input_files:
        raise FileNotFoundError(f"Nenhum arquivo Parquet encontrado em {INPUT_DIR}")

    print(f"Arquivos encontrados: {len(input_files)}")
    print(f"Saída: {OUTPUT_DIR}")

    for input_file in input_files:
        output_file = OUTPUT_DIR / input_file.name

        print(f"Filtrando {input_file.name} -> {output_file.name}")

        # Primeiro inspeciona as colunas existentes no arquivo.
        # Isso evita erro caso algum mês não tenha uma coluna extra da lista.
        columns_df = con.execute(
            f"""
            DESCRIBE SELECT *
            FROM read_parquet('{input_file.as_posix()}', union_by_name=true)
            """
        ).fetchdf()

        available_columns = set(columns_df["column_name"].tolist())

        selected = [
            col for col in SELECTED_COLUMNS
            if col in available_columns
        ]

        if "tpep_pickup_datetime" not in selected or "PULocationID" not in selected:
            print(f"Pulando {input_file.name}: colunas essenciais ausentes.")
            continue

        selected_sql = ",\n          ".join(selected)

        # A query cria um novo Parquet já reduzido:
        # - apenas corridas iniciadas em Manhattan;
        # - apenas datas de feriados;
        # - apenas colunas usadas nas visualizações.
        con.execute(
            f"""
            COPY (
              SELECT
                {selected_sql}
              FROM read_parquet('{input_file.as_posix()}', union_by_name=true)
              WHERE
                PULocationID IN ({zone_list})
                AND CAST(tpep_pickup_datetime AS DATE) IN ({holiday_list})
            )
            TO '{output_file.as_posix()}'
            (FORMAT PARQUET);
            """
        )

        count = con.execute(
            f"""
            SELECT COUNT(*) 
            FROM read_parquet('{output_file.as_posix()}', union_by_name=true)
            """
        ).fetchone()[0]

        print(f"  Linhas mantidas: {count:,}")

    print("Concluído.")


if __name__ == "__main__":
    main()