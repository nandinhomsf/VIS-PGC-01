import * as d3 from "d3";
import { createBaseChart } from "../utils/chart";

/**
 * Mapeamento de nomes canônicos dos feriados para rótulos em português.
 * A ordem define a distribuição dos pequenos múltiplos no grid.
 *
 * `dateRule` aparece no cabeçalho de cada subgráfico. Para feriados fixos,
 * usa-se a data do calendário; para feriados móveis, usa-se a regra
 * baseada em dia da semana e mês.
 */
const HOLIDAY_MAP = [
  { id: "New Year", label: "Ano Novo", dateRule: "01/janeiro" },
  {
    id: "MLK Day",
    label: "Dia de Martin Luther King",
    dateRule: "3ª segunda-feira/janeiro",
  },
  {
    id: "Presidents Day",
    label: "Dia dos Presidentes",
    dateRule: "3ª segunda-feira/fevereiro",
  },
  {
    id: "Memorial Day",
    label: "Memorial Day",
    dateRule: "última segunda-feira/maio",
  },
  {
    id: "Independence Day",
    label: "Independência",
    dateRule: "04/julho",
  },
  {
    id: "Labor Day",
    label: "Dia do Trabalho",
    dateRule: "1ª segunda-feira/setembro",
  },
  {
    id: "Veterans Day",
    label: "Dia dos Veteranos",
    dateRule: "11/novembro",
  },
  {
    id: "Thanksgiving",
    label: "Ação de Graças",
    dateRule: "4ª quinta-feira/novembro",
  },
  {
    id: "Christmas",
    label: "Natal",
    dateRule: "25/dezembro",
  },
];

const YEAR_DOMAIN = [2019, 2020, 2021, 2022];

/**
 * Visualização de pequenos múltiplos para gorjetas.
 *
 * Cada painel representa um feriado, e o eixo X mostra os anos disponíveis.
 * Essa estrutura preserva o foco nos feriados e, ao mesmo tempo, permite
 * observar a variação temporal antes, durante e após o início da pandemia.
 */
export function renderHolidayTipsLineView(data) {
  const { svg } = createBaseChart();

  const margin = { top: 72, right: 48, bottom: 72, left: 70 };
  const width = 1120 - margin.left - margin.right;
  const height = 660 - margin.top - margin.bottom;

  const root = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  /**
   * Cada ponto representa um feriado em um ano específico.
   * A métrica principal é avg_tip: gorjeta média por corrida.
   */
  const points = (data.holidayTipsByYear || [])
    .filter((d) => Number.isFinite(d.avg_tip))
    .map((d) => {
      const holidayInfo = HOLIDAY_MAP.find((h) => h.id === d.holidayName);

      return {
        ...d,
        holidayLabel: holidayInfo?.label ?? d.holidayName,
        holidayDateRule: holidayInfo?.dateRule ?? "",
      };
    });

  const dataMap = new Map();
  points.forEach((d) => {
    dataMap.set(`${d.holidayName}_${d.year}`, d);
  });

  /**
   * Monta uma série completa para cada feriado.
   * Anos sem dados permanecem como null, preservando o eixo temporal.
   */
  const holidaySeries = HOLIDAY_MAP.map((holiday) => ({
    ...holiday,
    values: YEAR_DOMAIN.map((year) => {
      const item = dataMap.get(`${holiday.id}_${year}`);

      return item
        ? item
        : {
            holidayName: holiday.id,
            holidayLabel: holiday.label,
            holidayDateRule: holiday.dateRule,
            year,
            avg_tip: null,
            trips: null,
            total_tip: null,
            dayLabel: null,
          };
    }),
  }));

  const maxTip = d3.max(points, (d) => d.avg_tip) || 1;

  /**
   * Layout em pequenos múltiplos: 3 colunas × 3 linhas.
   * Isso permite comparar todos os feriados sem misturar nove linhas
   * em um único gráfico.
   */
  const cols = 3;
  const rows = 3;
  const panelWidth = width / cols;
  const panelHeight = height / rows;

  const innerMargin = { top: 48, right: 18, bottom: 34, left: 44 };
  const innerWidth = panelWidth - innerMargin.left - innerMargin.right;
  const innerHeight = panelHeight - innerMargin.top - innerMargin.bottom;

  const x = d3
    .scalePoint()
    .domain(YEAR_DOMAIN)
    .range([0, innerWidth])
    .padding(0.45);

  const y = d3
    .scaleLinear()
    .domain([0, maxTip * 1.12])
    .range([innerHeight, 0])
    .nice();

  /**
   * Cores da visualização.
   * O verde/teal é usado para as séries de gorjeta, mantendo harmonia com
   * o tema visual já usado no heatmap, mas sem competir com as cores semânticas
   * das marcações de pandemia.
   */
  const surfaceColor = "#f8fafc";
  const panelBorder = "rgba(15, 23, 42, 0.08)";
  const tipLineColor = "#0f766e";
  const tipPointColor = "#14b8a6";
  const highlightYearColor = "#92400e";
  const textPrimary = "#0f172a";
  const textSecondary = "#475569";
  const gridColor = "#e2e8f0";

  const line = d3
    .line()
    .defined((d) => Number.isFinite(d.avg_tip))
    .x((d) => x(d.year))
    .y((d) => y(d.avg_tip))
    .curve(d3.curveMonotoneX);

  const tooltip = d3
    .select("body")
    .selectAll(".chart-tooltip")
    .data([null])
    .join("div")
    .attr("class", "chart-tooltip");

  const panels = root
    .selectAll("g.holiday-panel")
    .data(holidaySeries)
    .join("g")
    .attr("class", "holiday-panel")
    .attr("transform", (_, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      return `translate(${col * panelWidth},${row * panelHeight})`;
    });

  // Fundo de cada painel.
  panels
    .append("rect")
    .attr("x", 8)
    .attr("y", 4)
    .attr("width", panelWidth - 16)
    .attr("height", panelHeight - 12)
    .attr("rx", 14)
    .attr("fill", surfaceColor)
    .attr("stroke", panelBorder);

  // Título do feriado em cada painel.
  panels
    .append("text")
    .attr("x", 18)
    .attr("y", 22)
    .attr("fill", textPrimary)
    .attr("font-size", 13)
    .attr("font-weight", 800)
    .text((d) => d.label);

  // Data fixa ou regra do feriado no cabeçalho de cada painel.
  panels
    .append("text")
    .attr("x", 18)
    .attr("y", 39)
    .attr("fill", textSecondary)
    .attr("font-size", 10.5)
    .attr("font-weight", 600)
    .text((d) => d.dateRule);

  const plot = panels
    .append("g")
    .attr("transform", `translate(${innerMargin.left},${innerMargin.top})`);

  // Faixa vertical em 2020 para sinalizar o ano do impacto inicial da pandemia.
  plot
    .append("rect")
    .attr("x", x(2020) - 18)
    .attr("y", 0)
    .attr("width", 36)
    .attr("height", innerHeight)
    .attr("rx", 6)
    .attr("fill", "rgba(146, 64, 14, 0.08)");

  // Grid horizontal leve para leitura dos valores.
  plot
    .append("g")
    .call(d3.axisLeft(y).ticks(3).tickSize(-innerWidth).tickFormat(""))
    .selectAll("line")
    .attr("stroke", gridColor)
    .attr("stroke-dasharray", "3,3");

  plot.selectAll(".domain").remove();

  // Linha temporal de gorjeta média por feriado.
  plot
    .append("path")
    .attr("fill", "none")
    .attr("stroke", tipLineColor)
    .attr("stroke-width", 2.4)
    .attr("stroke-linecap", "round")
    .attr("stroke-linejoin", "round")
    .attr("d", (d) => line(d.values));

  // Pontos anuais.
  plot
    .selectAll("circle.tip-point")
    .data((d) => d.values.filter((v) => Number.isFinite(v.avg_tip)))
    .join("circle")
    .attr("class", "tip-point")
    .attr("cx", (d) => x(d.year))
    .attr("cy", (d) => y(d.avg_tip))
    .attr("r", 5.5)
    .attr("fill", (d) => (d.year === 2020 ? highlightYearColor : tipPointColor))
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 2)
    .on("mouseover", function (event, d) {
      d3.select(this).attr("r", 7.5);

      tooltip.style("opacity", 1).html(`
        <div class="tooltip-title">${d.dayLabel ?? d.holidayLabel}</div>
        <div class="tooltip-row">
          <span class="tooltip-label">Feriado:</span>
          <span class="tooltip-val">${d.holidayLabel}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Regra/Data:</span>
          <span class="tooltip-val">${d.holidayDateRule}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Ano:</span>
          <span class="tooltip-val">${d.year}</span>
        </div>
        <div class="tooltip-row tooltip-divider">
          <span class="tooltip-label">Gorjeta média:</span>
          <span class="tooltip-val highlight">US$ ${d.avg_tip.toFixed(2)}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Corridas:</span>
          <span class="tooltip-val">${d.trips.toLocaleString("pt-BR")}</span>
        </div>
      `);
    })
    .on("mousemove", function (event) {
      tooltip
        .style("left", event.pageX + 16 + "px")
        .style("top", event.pageY - 28 + "px");
    })
    .on("mouseout", function () {
      d3.select(this).attr("r", 5.5);
      tooltip.style("opacity", 0);
    });

  // Eixo X em cada painel.
  const xAxis = d3.axisBottom(x).tickFormat(d3.format("d"));

  const xAxisG = plot
    .append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(xAxis);

  xAxisG
    .selectAll("text")
    .attr("font-size", 10)
    .attr("font-weight", 600)
    .attr("fill", (d) => (d === 2020 ? highlightYearColor : textSecondary));

  xAxisG.selectAll("line").attr("stroke", "#cbd5e1");
  xAxisG.select(".domain").attr("stroke", "#cbd5e1");

  // Eixo Y compacto em cada painel.
  const yAxis = d3.axisLeft(y).ticks(3).tickFormat((d) => `$${d}`);

  const yAxisG = plot.append("g").call(yAxis);

  yAxisG
    .selectAll("text")
    .attr("font-size", 10)
    .attr("font-weight", 500)
    .attr("fill", textSecondary);

  yAxisG.selectAll("line").attr("stroke", "#cbd5e1");
  yAxisG.select(".domain").attr("stroke", "#cbd5e1");

  /**
   * Legenda superior.
   * Explica a codificação dos pontos e a marcação visual de 2020.
   */
  const legend = svg.append("g").attr("transform", `translate(${margin.left},28)`);

  legend
    .append("circle")
    .attr("cx", 0)
    .attr("cy", 0)
    .attr("r", 5.5)
    .attr("fill", tipPointColor)
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 2);

  legend
    .append("text")
    .attr("x", 12)
    .attr("y", 4)
    .attr("fill", textSecondary)
    .attr("font-size", 12)
    .attr("font-weight", 600)
    .text("Gorjeta média por corrida");

  legend
    .append("circle")
    .attr("cx", 190)
    .attr("cy", 0)
    .attr("r", 5.5)
    .attr("fill", highlightYearColor)
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 2);

  legend
    .append("text")
    .attr("x", 202)
    .attr("y", 4)
    .attr("fill", textSecondary)
    .attr("font-size", 12)
    .attr("font-weight", 600)
    .text("Ano da Pandemia: 2020");

  /**
   * Resumo textual acima do gráfico.
   * A média anual é ponderada pelo número de corridas de cada feriado.
   */
  const explanationEl = document.querySelector("#explanation");

  if (explanationEl) {
    const yearlyStats = YEAR_DOMAIN.map((year) => {
      const items = points.filter((d) => d.year === year);
      const totalTrips = d3.sum(items, (d) => d.trips);
      const totalTips = d3.sum(items, (d) => d.total_tip);

      return {
        year,
        mean: totalTrips > 0 ? totalTips / totalTrips : null,
      };
    });

    const fmt = (value) =>
      Number.isFinite(value) ? `US$ ${value.toFixed(2)}` : "—";

    explanationEl.innerHTML = `
      <div style="
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
        align-items: center;
        background: ${surfaceColor};
        border: 1px solid ${panelBorder};
        border-radius: 12px;
        padding: 12px 16px;
        color: ${textSecondary};
      ">
        ${yearlyStats
          .map(
            (d) => `
              <span>
                <strong style="color: ${
                  d.year === 2020 ? highlightYearColor : textPrimary
                };">${d.year}:</strong>
                ${fmt(d.mean)}
              </span>
            `,
          )
          .join("")}
      </div>
    `;
  }
}