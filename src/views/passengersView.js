import * as d3 from "d3";
import {
  createBaseChart,
  addXAxisCaption,
  addYAxisCaption,
  styleDenseXAxis,
  addColorLegend,
  REGION_COLORS,
} from "../utils/chart";

/**
 * Renderiza um gráfico de linhas temporais mostrando o total de passageiros
 * em cada feriado, separado por macro-região de origem em Manhattan.
 *
 * Cada região (Downtown, Midtown, Uptown) é representada por uma linha
 * com cor distinta e pontos circulares sobre cada feriado.
 * O eixo X é um `scalePoint` com os rótulos de feriado girados para
 * evitar sobreposição em datas próximas.
 */
export function renderPassengersView(data) {
  const { svg, margin, width, height } = createBaseChart();
  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Extrai domínios únicos de dias e regiões para montar as escalas
  const days = [...new Set(data.passengers.map((d) => d.dayLabel))];
  const regions = [...new Set(data.passengers.map((d) => d.region))];

  const x = d3.scalePoint().domain(days).range([0, width]).padding(0.5);
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data.passengers, (d) => d.passengers)])
    .nice()
    .range([height, 0]);

  // Escala de cor ordinal mapeada diretamente às cores fixas por região
  const color = d3
    .scaleOrdinal()
    .domain(regions)
    .range(regions.map((r) => REGION_COLORS[r]));

  // Agrupa os dados por região e desenha uma linha + pontos para cada grupo
  const byRegion = d3.groups(data.passengers, (d) => d.region);
  const line = d3
    .line()
    .x((d) => x(d.dayLabel))
    .y((d) => y(d.passengers));

  byRegion.forEach(([region, values]) => {
    const sorted = values.sort((a, b) => a.dayISO.localeCompare(b.dayISO));
    g.append("path")
      .datum(sorted)
      .attr("fill", "none")
      .attr("stroke", color(region))
      .attr("stroke-width", 2.5)
      .attr("d", line);
    g.selectAll(`.dot-${region}`)
      .data(sorted)
      .join("circle")
      .attr("cx", (d) => x(d.dayLabel))
      .attr("cy", (d) => y(d.passengers))
      .attr("r", 4)
      .attr("fill", color(region));
  });

  const xAxis = g
    .append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x));
  styleDenseXAxis(xAxis);
  g.append("g").call(d3.axisLeft(y));
  addXAxisCaption(g, "Feriados (2019-2022, eixo temporal)", width, height);
  addYAxisCaption(g, "Passageiros totais em Manhattan");

  addColorLegend(svg, {
    title: "Cores representam macro-regiões de origem em Manhattan",
    items: regions.map((r) => ({ label: r, color: color(r) })),
    x: margin.left,
    y: 26,
  });
}
