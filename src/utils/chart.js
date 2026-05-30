import * as d3 from "d3";
import { REGION_COLORS, SEMANTIC_COLORS } from "../constants/colors";

// Re-exporta as paletas de cor para que as views as acessem por este módulo
export { REGION_COLORS, SEMANTIC_COLORS };

/**
 * Cria o SVG base e retorna o grupo de desenho com as margens aplicadas.
 *
 * Todos os gráficos compartilham o mesmo viewBox de 1120×660 px para que o
 * container CSS possa redimensioná-los de forma responsiva sem distorção.
 * As margens foram calibradas para acomodar eixos com rótulos longos e a
 * área de legenda acima do gráfico (top: 86px).
 */
export function createBaseChart(container = "#chart") {
  d3.select(container).html("");
  const svg = d3
    .select(container)
    .append("svg")
    .attr("viewBox", "0 0 1120 660")
    .attr("width", 1120)
    .attr("height", 660);

  return {
    svg,
    margin: { top: 86, right: 48, bottom: 220, left: 124 },
    width: 948,
    height: 354,
  };
}

/**
 * Adiciona um rótulo centralizado abaixo do eixo X.
 * O parâmetro `height` aceita um offset personalizado para evitar conflito
 * com rótulos girados do próprio eixo (ver `styleDenseXAxis`).
 */
export function addXAxisCaption(g, text, width, height) {
  g.append("text")
    .attr("x", width / 2)
    .attr("y", height + 170)
    .attr("text-anchor", "middle")
    .attr("fill", "#94a3b8")
    .attr("font-size", 14)
    .attr("font-weight", 500)
    .text(text);
}

/**
 * Adiciona um rótulo rotacionado -90° à esquerda do eixo Y.
 * As coordenadas fixas (-177, -92) funcionam dentro da margem padrão de 124px
 * retornada por `createBaseChart`. Se usar margens personalizadas, prefira
 * calcular `x` e `y` dinamicamente no arquivo da view.
 */
export function addYAxisCaption(g, text) {
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -177)
    .attr("y", -92)
    .attr("text-anchor", "middle")
    .attr("fill", "#94a3b8")
    .attr("font-size", 14)
    .attr("font-weight", 500)
    .text(text);
}

/**
 * Estiliza um eixo X com muitos rótulos aplicando rotação de -42° para evitar
 * sobreposição. Usado nas visualizações onde o domínio são datas de feriados.
 */
export function styleDenseXAxis(axisG) {
  axisG
    .selectAll("text")
    .attr("text-anchor", "end")
    .attr("dx", "-0.7em")
    .attr("dy", "0.2em")
    .attr("transform", "rotate(-42)")
    .attr("font-size", 11)
    .attr("fill", "#cbd5e1");

  axisG.selectAll("line").attr("stroke", "#475569");
  axisG.select(".domain").attr("stroke", "#475569");
}

/**
 * Desenha uma legenda horizontal de linhas coloridas acima do gráfico.
 *
 * @param {d3.Selection} svg - Seleção do elemento SVG raiz.
 * @param {string} title - Texto descritivo exibido acima dos ícones.
 * @param {Array<{label: string, color: string}>} items - Entradas da legenda.
 * @param {number} x - Deslocamento horizontal em pixels (padrão: 98).
 * @param {number} y - Deslocamento vertical em pixels (padrão: 20).
 * @param {number} itemGap - Espaçamento entre cada entrada (padrão: 210px).
 */
export function addColorLegend(
  svg,
  { title, items, x = 98, y = 20, itemGap = 210 },
) {
  const legend = svg.append("g").attr("transform", `translate(${x},${y})`);

  legend
    .append("text")
    .attr("x", 0)
    .attr("y", -12)
    .attr("font-size", 12)
    .attr("fill", "#94a3b8")
    .attr("font-weight", 500)
    .text(title);

  items.forEach((item, i) => {
    const g = legend
      .append("g")
      .attr("transform", `translate(${i * itemGap},0)`);

    // Traço horizontal de 22px representando a cor da série
    g.append("line")
      .attr("x1", 0)
      .attr("x2", 22)
      .attr("y1", 0)
      .attr("y2", 0)
      .attr("stroke", item.color)
      .attr("stroke-width", 3);

    g.append("text")
      .attr("x", 28)
      .attr("y", 4)
      .attr("font-size", 11)
      .attr("fill", "#e2e8f0")
      .text(item.label);
  });
}
