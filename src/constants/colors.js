/**
 * Paleta de cores por macro-região de Manhattan.
 * Cada região recebe uma cor distinta e de alto contraste para que as linhas
 * temporais de Downtown, Midtown e Uptown sejam imediatamente distinguíveis
 * mesmo em condições de sobreposição de traçados no gráfico.
 */
export const REGION_COLORS = {
  Downtown: "#3b82f6",
  Midtown: "#f59e0b",
  Uptown: "#10b981",
};

/**
 * Cores semânticas usadas nas visualizações de linha do tempo (timelineView).
 * - `trips`: cor da série principal de contagem de corridas.
 * - `baseline`: cor da linha de referência pré-pandemia (média até fev/2020).
 * - `marker`: destaca o feriado de maior inflexão (impacto ou normalização).
 */
export const SEMANTIC_COLORS = {
  trips: "#6366f1",
  baseline: "#f97316",
  marker: "#ec4899",
};
