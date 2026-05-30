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
 * Renderiza um gráfico de linhas temporais mostrando a gorjeta média (USD)
 * em cada feriado, separado por macro-região de origem em Manhattan.
 *
 * Estruturalmente idêntico ao `passengersView`, mas utiliza o campo `avg_tip`
 * como métrica. Gorjetas tendem a cair mais abruptamente em 2020 do que o
 * volume de corridas, revelando mudança no perfil do passageiro remanescente.
 */
export function renderTipsView(data) {
  const { svg, margin, width, height } = createBaseChart();
  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const days = [...new Set(data.tips.map((d) => d.dayLabel))];
  const regions = [...new Set(data.tips.map((d) => d.region))];

  const x = d3.scalePoint().domain(days).range([0, width]).padding(0.5);
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data.tips, (d) => d.avg_tip)])
    .nice()
    .range([height, 0]);

  const color = d3
    .scaleOrdinal()
    .domain(regions)
    .range(regions.map((r) => REGION_COLORS[r]));

  const line = d3
    .line()
    .x((d) => x(d.dayLabel))
    .y((d) => y(d.avg_tip));

  d3.groups(data.tips, (d) => d.region).forEach(([region, values]) => {
    const sorted = values.sort((a, b) => a.dayISO.localeCompare(b.dayISO));
    g.append("path")
      .datum(sorted)
      .attr("fill", "none")
      .attr("stroke", color(region))
      .attr("stroke-width", 2.5)
      .attr("d", line);
    g.selectAll(`.tip-${region}`)
      .data(sorted)
      .join("circle")
      .attr("cx", (d) => x(d.dayLabel))
      .attr("cy", (d) => y(d.avg_tip))
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
  addYAxisCaption(g, "Gorjeta média (USD)");

  addColorLegend(svg, {
    title: "Cores representam macro-regiões de origem em Manhattan",
    items: regions.map((r) => ({ label: r, color: color(r) })),
    x: margin.left,
    y: 26,
  });
}
