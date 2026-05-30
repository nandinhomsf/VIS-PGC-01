import * as d3 from "d3";
import {
  createBaseChart,
  addXAxisCaption,
  addYAxisCaption,
  addColorLegend,
  REGION_COLORS,
} from "../utils/chart";

// Pontos de entrada públicos que delegam para a função interna com a métrica correta
export function renderHolidayAcrossYearsPassengers(data) {
  renderAcrossYears(
    data.passengers,
    "passengers",
    "Passageiros totais",
    "Como os passageiros mudaram por tipo de feriado ao longo dos anos?",
  );
}

export function renderHolidayAcrossYearsTips(data) {
  renderAcrossYears(
    data.tips,
    "avg_tip",
    "Gorjeta média (USD)",
    "Como as gorjetas mudaram por tipo de feriado ao longo dos anos?",
  );
}

/**
 * Renderiza um gráfico de linhas comparando o mesmo conjunto de feriados
 * em múltiplos anos (2019–2022), separado por macro-região.
 *
 * O eixo X usa os nomes dos feriados como domínio categórico (scalePoint),
 * permitindo comparação direta entre anos no mesmo tipo de feriado.
 * O ano de 2020 recebe linha mais grossa e opacidade máxima para evidenciar
 * visualmente o impacto da pandemia em relação aos demais anos.
 *
 * @param {string} metric - Nome do campo numérico a ser plotado (ex.: "passengers").
 */
function renderAcrossYears(rows, metric, yLabel, subtitle) {
  const { svg, margin, width, height } = createBaseChart();
  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const holidayNames = [...new Set(rows.map((d) => d.holidayName))];
  const years = [...new Set(rows.map((d) => d.year))].sort((a, b) => a - b);

  const x = d3.scalePoint().domain(holidayNames).range([0, width]).padding(0.5);
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(rows, (d) => d[metric])])
    .nice()
    .range([height, 0]);

  // Ordem fixa das regiões para garantir consistência visual entre views
  const regionOrder = ["Downtown", "Midtown", "Uptown"];

  years.forEach((year) => {
    regionOrder.forEach((region) => {
      // Filtra e ordena os pontos de acordo com a posição no domínio do eixo X
      const series = rows
        .filter((d) => d.year === year && d.region === region)
        .sort(
          (a, b) =>
            holidayNames.indexOf(a.holidayName) -
            holidayNames.indexOf(b.holidayName),
        );

      // 2020 é realçado com linha mais espessa; demais anos ficam em segundo plano
      g.append("path")
        .datum(series)
        .attr("fill", "none")
        .attr("stroke", REGION_COLORS[region])
        .attr("stroke-width", year === 2020 ? 3.5 : 1.7)
        .attr("stroke-opacity", year === 2020 ? 0.95 : 0.35)
        .attr(
          "d",
          d3
            .line()
            .x((d) => x(d.holidayName))
            .y((d) => y(d[metric])),
        );
    });
  });

  const xAxis = g
    .append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x));

  // Rotação leve (-35°) para acomodar nomes de feriados sem sobreposição
  xAxis
    .selectAll("text")
    .attr("text-anchor", "end")
    .attr("transform", "rotate(-35)")
    .attr("font-size", 11)
    .attr("dx", "-0.5em")
    .attr("fill", "#cbd5e1");

  xAxis.selectAll("line").attr("stroke", "#475569");
  xAxis.select(".domain").attr("stroke", "#475569");

  g.append("g").call(d3.axisLeft(y));
  addXAxisCaption(g, "Tipo de feriado (comparação anual)", width, height);
  addYAxisCaption(g, yLabel);

  addColorLegend(svg, {
    title: `${subtitle} · cor fixa para região; linhas mais fortes = 2020 (início da pandemia)`,
    items: regionOrder.map((r) => ({ label: r, color: REGION_COLORS[r] })),
    x: margin.left,
    y: 28,
  });
}
