import { HOLIDAY_LABELS } from "../constants/holidays";

/**
 * Converte um valor de data para o formato ISO 8601 (AAAA-MM-DD).
 * O DuckDB retorna datas como objetos Date, inteiros (epoch ms) ou strings,
 * portanto esta função normaliza os três casos antes de qualquer processamento.
 */
export function toISODate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number")
    return new Date(value).toISOString().slice(0, 10);
  const s = String(value);
  // Epoch numérico armazenado como string (ex.: "1577836800000")
  if (/^\d+$/.test(s)) return new Date(Number(s)).toISOString().slice(0, 10);
  return s.slice(0, 10);
}

/**
 * Formata uma data ISO para exibição localizada em português do Brasil.
 * Usado como fallback quando a data não está mapeada em HOLIDAY_LABELS.
 */
export function formatDate(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Enriquece uma linha do resultado DuckDB com metadados de feriado.
 *
 * Campos adicionados:
 *  - `dayISO`: data no formato "AAAA-MM-DD" para ordenação e comparação.
 *  - `dayLabel`: rótulo de exibição (ex.: "25 May 2020 (Memorial Day)").
 *  - `holidayName`: nome do feriado extraído dos parênteses do rótulo,
 *    usado como chave de agrupamento nas visualizações comparativas.
 *  - `year`: ano numérico, útil para filtros e escalas de cor por ano.
 */
export function enrichHoliday(d) {
  const dayISO = toISODate(d.day);
  const dayLabel = HOLIDAY_LABELS[dayISO] ?? formatDate(dayISO);
  const holidayName = dayLabel.includes("(")
    ? dayLabel.split("(")[1].replace(")", "")
    : dayLabel;
  const year = Number(dayISO.slice(0, 4));
  return { ...d, dayISO, dayLabel, holidayName, year };
}
