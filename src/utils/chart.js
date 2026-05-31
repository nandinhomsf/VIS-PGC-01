import * as d3 from "d3";

/**
 * Cria a base SVG usada pelas visualizações.
 *
 * A função limpa o container antes de criar um novo SVG. Isso é importante
 * porque todas as views compartilham o mesmo `#chart`: quando o usuário troca
 * a visualização no seletor, o gráfico anterior precisa ser removido antes do
 * novo ser desenhado.
 *
 * O `viewBox` fixa uma área lógica de 1120×660 pixels. Com isso, o SVG pode
 * ser redimensionado pelo CSS sem perder proporção, porque os elementos internos
 * continuam usando o mesmo sistema de coordenadas.
 *
 * A função também retorna margens e dimensões úteis para views que desenham o
 * gráfico dentro de uma área interna já descontando espaço para eixos, legendas 
 * e rótulos.
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

    /**
     * Margens padrão usadas por gráficos que precisam de legenda no topo,
     * rótulos laterais e espaço inferior para eixos densos.
     *
     * Algumas visualizações mais específicas, como heatmaps ou pequenos múltiplos,
     * podem ignorar essas margens e definir suas próprias dimensões internamente.
     */
    margin: { top: 86, right: 48, bottom: 220, left: 124 },

    /**
     * Área útil aproximada depois de descontadas as margens padrão.
     * Esses valores funcionam como convenção para views que usam o layout comum.
     */
    width: 948,
    height: 354,
  };
}

/**
 * Adiciona um rótulo centralizado abaixo do eixo X.
 *
 * O texto é inserido diretamente no grupo `g` da visualização. A posição em X
 * usa `width / 2` para manter o rótulo centralizado na área útil do gráfico.
 *
 * O valor em Y usa `height + 170` porque algumas views têm eixos com textos
 * longos ou rotacionados. Esse deslocamento evita que o título do eixo fique
 * sobreposto aos rótulos dos ticks.
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
 * Adiciona um rótulo vertical para o eixo Y.
 *
 * O texto é rotacionado em -90 graus para ficar alinhado ao eixo vertical.
 * As coordenadas foram calibradas para funcionar com a margem esquerda padrão
 * retornada por `createBaseChart`.
 *
 * Em views com margens muito diferentes, é melhor criar o rótulo diretamente
 * na própria visualização, calculando `x` e `y` a partir da altura e da margem.
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
 * Aplica estilo a um eixo X com muitos rótulos.
 *
 * Quando o eixo possui datas, nomes longos ou muitas categorias, os textos
 * tendem a se sobrepor. A rotação de -42 graus reduz esse problema sem deixar
 * o eixo completamente vertical, preservando alguma legibilidade.
 *
 * O `text-anchor: end` faz com que o final do texto fique alinhado ao tick,
 * o que melhora a leitura depois da rotação. Os deslocamentos `dx` e `dy`
 * ajustam manualmente a posição para que os rótulos não fiquem colados no eixo.
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

  /**
   * As linhas e o domínio do eixo recebem uma cor discreta.
   * Isso mantém o eixo visível, mas sem competir visualmente com os dados.
   */
  axisG.selectAll("line").attr("stroke", "#475569");
  axisG.select(".domain").attr("stroke", "#475569");
}

/**
 * Desenha uma legenda horizontal de cores acima do gráfico.
 *
 * A legenda é construída como um grupo SVG (`<g>`) deslocado por `x` e `y`.
 * Cada item da legenda recebe um pequeno traço colorido e um texto descritivo.
 *
 * Essa função é útil para gráficos de linhas ou séries categóricas, em que cada
 * cor representa uma região, categoria ou variável diferente.
 *
 * @param {d3.Selection} svg - Seleção do SVG raiz onde a legenda será desenhada.
 * @param {string} title - Texto descritivo exibido acima dos itens da legenda.
 * @param {Array<{label: string, color: string}>} items - Entradas da legenda.
 * @param {number} x - Deslocamento horizontal da legenda dentro do SVG.
 * @param {number} y - Deslocamento vertical da legenda dentro do SVG.
 * @param {number} itemGap - Espaço horizontal entre os itens da legenda.
 */
export function addColorLegend(
  svg,
  { title, items, x = 98, y = 20, itemGap = 210 },
) {
  /**
   * Grupo principal da legenda.
   *
   * Usar um `<g>` com `transform` facilita mover toda a legenda de uma vez,
   * sem precisar ajustar individualmente cada texto ou marcador.
   */
  const legend = svg.append("g").attr("transform", `translate(${x},${y})`);

  /**
   * Título da legenda.
   *
   * Ele aparece levemente acima dos itens para contextualizar o significado
   * das cores antes de o usuário ler cada categoria.
   */
  legend
    .append("text")
    .attr("x", 0)
    .attr("y", -12)
    .attr("font-size", 12)
    .attr("fill", "#94a3b8")
    .attr("font-weight", 500)
    .text(title);

  /**
   * Cada item é desenhado em seu próprio grupo.
   *
   * O deslocamento horizontal depende do índice `i` e do espaçamento `itemGap`.
   * Isso mantém a legenda em linha e evita cálculos manuais para cada entrada.
   */
  items.forEach((item, i) => {
    const g = legend
      .append("g")
      .attr("transform", `translate(${i * itemGap},0)`);

    /**
     * Traço horizontal usado como marcador visual da série.
     *
     * Para gráficos de linha, um traço comunica melhor a associação com a série
     * do que um quadrado ou círculo, porque repete a forma visual usada no gráfico.
     */
    g.append("line")
      .attr("x1", 0)
      .attr("x2", 22)
      .attr("y1", 0)
      .attr("y2", 0)
      .attr("stroke", item.color)
      .attr("stroke-width", 3);

    /**
     * Texto do item da legenda.
     *
     * O texto começa depois do traço colorido, com um pequeno espaçamento,
     * para que marcador e rótulo sejam lidos como uma unidade.
     */
    g.append("text")
      .attr("x", 28)
      .attr("y", 4)
      .attr("font-size", 11)
      .attr("fill", "#e2e8f0")
      .text(item.label);
  });
}