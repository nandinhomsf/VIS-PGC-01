import * as d3 from "d3";
import { createBaseChart } from "../utils/chart";

/**
 * Mapeamento de nomes canônicos dos feriados para rótulos em português.
 * A ordem define a distribuição dos pequenos múltiplos no grid.
 *
 * `dateRule` aparece no título de cada subgráfico. Para feriados fixos,
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
  { id: "Independence Day", label: "Independência", dateRule: "04/julho" },
  {
    id: "Labor Day",
    label: "Dia do Trabalho",
    dateRule: "1ª segunda-feira/setembro",
  },
  { id: "Veterans Day", label: "Dia dos Veteranos", dateRule: "11/novembro" },
  {
    id: "Thanksgiving",
    label: "Ação de Graças",
    dateRule: "4ª quinta-feira/novembro",
  },
  { id: "Christmas", label: "Natal", dateRule: "25/dezembro" },
];

const YEAR_DOMAIN = [2019, 2020, 2021, 2022];

/**
 * Códigos de pagamento considerados na análise.
 *
 * A visualização usa apenas categorias que representam uma forma efetiva
 * de pagamento:
 *
 * 0 = Flex Fare trip
 * 1 = Credit card
 * 2 = Cash
 *
 * As categorias 3, 4, 5 e 6 são excluídas ainda na query da classe Taxi:
 * 3 = No charge
 * 4 = Dispute
 * 5 = Unknown
 * 6 = Voided trip
 */
const PAYMENT_TYPES = [
  {
    id: 1,
    label: "Cartão",
    fullLabel: "Credit card",
    color: "#2563eb",
  },
  {
    id: 2,
    label: "Dinheiro",
    fullLabel: "Cash",
    color: "#16a34a",
  },
  {
    id: 0,
    label: "Flex Fare",
    fullLabel: "Flex Fare trip",
    color: "#92400e",
  },
];

/**
 * Formata a data real do feriado para o tooltip.
 * Exemplo: "2020-12-25" vira "25/12".
 */
function formatDateShort(dayISO, dayLabel) {
  if (dayISO && /^\d{4}-\d{2}-\d{2}$/.test(dayISO)) {
    const [, month, day] = dayISO.split("-");
    return `${day}/${month}`;
  }

  const isoFromLabel = dayLabel?.match(/\d{4}-\d{2}-\d{2}/)?.[0];

  if (isoFromLabel) {
    const [, month, day] = isoFromLabel.split("-");
    return `${day}/${month}`;
  }

  return "—";
}

/**
 * Visualização de formas de pagamento em feriados.
 *
 * Cada painel representa um feriado.
 * Cada barra representa um ano.
 * Cada segmento mostra a proporção de corridas por forma de pagamento.
 *
 * O uso de barras empilhadas 100% prioriza a composição das formas de
 * pagamento, evitando que a queda no volume total de corridas durante a
 * pandemia domine a leitura.
 */
export function renderHolidayPaymentShareStackedBarsView(data) {
  const { svg } = createBaseChart();

  const margin = { top: 78, right: 48, bottom: 56, left: 70 };
  const width = 1120 - margin.left - margin.right;
  const height = 660 - margin.top - margin.bottom;

  const root = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const rawRows = (data.holidayPaymentShare || []).filter(
    (d) =>
      Number.isFinite(d.trips) &&
      Number.isFinite(d.payment_type) &&
      PAYMENT_TYPES.some((p) => p.id === d.payment_type),
  );

  /**
   * Índice por feriado, ano e tipo de pagamento.
   * Facilita montar uma matriz completa mesmo quando algum tipo não aparece
   * em determinado feriado/ano.
   */
  const dataMap = new Map();

  rawRows.forEach((d) => {
    dataMap.set(`${d.holidayName}_${d.year}_${d.payment_type}`, d);
  });

  /**
   * Monta uma série completa para cada feriado:
   * - 9 feriados;
   * - 4 anos por feriado;
   * - 3 tipos de pagamento por ano.
   */
  const holidayPanels = HOLIDAY_MAP.map((holiday) => {
    const years = YEAR_DOMAIN.map((year) => {
      const values = PAYMENT_TYPES.map((payment) => {
        const item = dataMap.get(`${holiday.id}_${year}_${payment.id}`);

        return {
          holidayName: holiday.id,
          holidayLabel: holiday.label,
          holidayDateRule: holiday.dateRule,
          year,
          paymentType: payment.id,
          paymentLabel: payment.label,
          paymentFullLabel: payment.fullLabel,
          color: payment.color,
          trips: item?.trips ?? 0,
          dayLabel: item?.dayLabel ?? null,
          dayISO: item?.dayISO ?? null,
        };
      });

      const total = d3.sum(values, (d) => d.trips);
      const dateSource = values.find((d) => d.dayISO || d.dayLabel);

      let acc = 0;
      const stackedValues = values.map((d) => {
        const share = total > 0 ? d.trips / total : 0;
        const x0 = acc;
        const x1 = acc + share;
        acc = x1;

        return {
          ...d,
          total,
          share,
          x0,
          x1,
        };
      });

      return {
        holidayName: holiday.id,
        holidayLabel: holiday.label,
        holidayDateRule: holiday.dateRule,
        year,
        total,
        dayLabel: dateSource?.dayLabel ?? null,
        dayISO: dateSource?.dayISO ?? null,
        dateShort: formatDateShort(dateSource?.dayISO, dateSource?.dayLabel),
        values: stackedValues,
      };
    });

    return {
      ...holiday,
      years,
    };
  });

  /**
   * Layout em pequenos múltiplos: 3 colunas × 3 linhas.
   * Essa estrutura mantém os feriados como foco principal da análise.
   */
  const cols = 3;
  const rows = 3;
  const panelWidth = width / cols;
  const panelHeight = height / rows;

  const innerMargin = { top: 48, right: 18, bottom: 28, left: 38 };
  const innerWidth = panelWidth - innerMargin.left - innerMargin.right;
  const innerHeight = panelHeight - innerMargin.top - innerMargin.bottom;

  const x = d3.scaleLinear().domain([0, 1]).range([0, innerWidth]);

  const y = d3
    .scaleBand()
    .domain(YEAR_DOMAIN)
    .range([0, innerHeight])
    .padding(0.28);

  /**
   * Cores e superfícies.
   * O fundo claro mantém consistência com as demais views.
   * O ano de 2020 recebe uma marcação sutil por ser o período de impacto
   * inicial da pandemia.
   */
  const surfaceColor = "#f8fafc";
  const panelBorder = "rgba(15, 23, 42, 0.08)";
  const yearHighlight = "rgba(146, 64, 14, 0.08)";
  const emptyBarColor = "#e2e8f0";
  const textPrimary = "#0f172a";
  const textSecondary = "#475569";
  const gridColor = "#e2e8f0";
  const impactColor = "#92400e";

  const tooltip = d3
    .select("body")
    .selectAll(".chart-tooltip")
    .data([null])
    .join("div")
    .attr("class", "chart-tooltip");

  const panels = root
    .selectAll("g.payment-panel")
    .data(holidayPanels)
    .join("g")
    .attr("class", "payment-panel")
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

  // Regra/data do feriado no cabeçalho do painel.
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

  // Destaque sutil para o ano de impacto inicial.
  plot
    .append("rect")
    .attr("x", 0)
    .attr("y", y(2020) - 3)
    .attr("width", innerWidth)
    .attr("height", y.bandwidth() + 6)
    .attr("rx", 6)
    .attr("fill", yearHighlight);

  // Grade vertical em 0%, 50% e 100%.
  plot
    .append("g")
    .call(
      d3
        .axisBottom(x)
        .tickValues([0, 0.5, 1])
        .tickSize(innerHeight)
        .tickFormat(""),
    )
    .selectAll("line")
    .attr("stroke", gridColor)
    .attr("stroke-dasharray", "3,3");

  plot.selectAll(".domain").remove();

  const yearGroups = plot
    .selectAll("g.year-row")
    .data((d) => d.years)
    .join("g")
    .attr("class", "year-row")
    .attr("transform", (d) => `translate(0,${y(d.year)})`);

  // Fundo de cada barra anual.
  yearGroups
    .append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", innerWidth)
    .attr("height", y.bandwidth())
    .attr("rx", 5)
    .attr("fill", emptyBarColor);

  // Segmentos empilhados de pagamento.
  yearGroups
    .selectAll("rect.payment-segment")
    .data((d) => d.values.filter((v) => v.total > 0 && v.share > 0))
    .join("rect")
    .attr("class", "payment-segment")
    .attr("x", (d) => x(d.x0))
    .attr("y", 0)
    .attr("width", (d) => Math.max(0, x(d.x1) - x(d.x0)))
    .attr("height", y.bandwidth())
    .attr("rx", 4)
    .attr("fill", (d) => d.color)
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 0.8)
    .on("mouseover", function (event, d) {
      d3.select(this).attr("opacity", 0.82);

      tooltip.style("opacity", 1).html(`
        <div class="tooltip-title">${d.holidayLabel} — ${d.year}</div>
        <div class="tooltip-row">
          <span class="tooltip-label">Data real:</span>
          <span class="tooltip-val">${formatDateShort(
            d.dayISO,
            d.dayLabel,
          )}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Regra:</span>
          <span class="tooltip-val">${d.holidayDateRule}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Pagamento:</span>
          <span class="tooltip-val">${d.paymentFullLabel}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Corridas:</span>
          <span class="tooltip-val">${d.trips.toLocaleString("pt-BR")}</span>
        </div>
        <div class="tooltip-row tooltip-divider">
          <span class="tooltip-label">Participação:</span>
          <span class="tooltip-val highlight">${d3.format(".1%")(
            d.share,
          )}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Total no ano/feriado:</span>
          <span class="tooltip-val">${d.total.toLocaleString("pt-BR")}</span>
        </div>
      `);
    })
    .on("mousemove", function (event) {
      tooltip
        .style("left", event.pageX + 16 + "px")
        .style("top", event.pageY - 28 + "px");
    })
    .on("mouseout", function () {
      d3.select(this).attr("opacity", 1);
      tooltip.style("opacity", 0);
    });

  // Rótulo para anos sem dados disponíveis.
  yearGroups
    .filter((d) => d.total === 0)
    .append("text")
    .attr("x", innerWidth / 2)
    .attr("y", y.bandwidth() / 2 + 4)
    .attr("text-anchor", "middle")
    .attr("fill", textSecondary)
    .attr("font-size", 9.5)
    .attr("font-weight", 600)
    .text("sem dados");

  // Eixo Y com os anos.
  const yAxis = d3.axisLeft(y).tickFormat(d3.format("d")).tickSize(0);

  const yAxisG = plot.append("g").call(yAxis);

  yAxisG
    .selectAll("text")
    .attr("font-size", 10.5)
    .attr("font-weight", 700)
    .attr("fill", (d) => (d === 2020 ? impactColor : textSecondary));

  yAxisG.select(".domain").remove();

  // Eixo X percentual compacto em cada painel.
  const xAxis = d3
    .axisBottom(x)
    .tickValues([0, 0.5, 1])
    .tickFormat(d3.format(".0%"));

  const xAxisG = plot
    .append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(xAxis);

  xAxisG
    .selectAll("text")
    .attr("font-size", 9.5)
    .attr("font-weight", 600)
    .attr("fill", textSecondary);

  xAxisG.selectAll("line").attr("stroke", "#cbd5e1");
  xAxisG.select(".domain").attr("stroke", "#cbd5e1");

  /**
   * Legenda superior.
   * Explica as três categorias de pagamento mantidas na visualização.
   */
  const legend = svg.append("g").attr("transform", `translate(${margin.left},28)`);

  const legendItems = legend
    .selectAll("g.legend-item")
    .data(PAYMENT_TYPES)
    .join("g")
    .attr("class", "legend-item")
    .attr("transform", (_, i) => `translate(${i * 145},0)`);

  legendItems
    .append("rect")
    .attr("x", 0)
    .attr("y", -7)
    .attr("width", 12)
    .attr("height", 12)
    .attr("rx", 3)
    .attr("fill", (d) => d.color);

  legendItems
    .append("text")
    .attr("x", 18)
    .attr("y", 3)
    .attr("fill", textSecondary)
    .attr("font-size", 12)
    .attr("font-weight", 600)
    .text((d) => `${d.label} (${d.id})`);

  /**
   * Resumo textual acima do gráfico.
   * Os percentuais anuais são calculados a partir da soma das corridas
   * por forma de pagamento em todos os feriados disponíveis naquele ano.
   */
  const explanationEl = document.querySelector("#explanation");

  if (explanationEl) {
    const yearlySummary = YEAR_DOMAIN.map((year) => {
      const rows = rawRows.filter((d) => d.year === year);
      const total = d3.sum(rows, (d) => d.trips);

      const shares = PAYMENT_TYPES.map((payment) => {
        const trips = d3.sum(
          rows.filter((d) => d.payment_type === payment.id),
          (d) => d.trips,
        );

        return {
          ...payment,
          trips,
          share: total > 0 ? trips / total : null,
        };
      });

      return {
        year,
        total,
        shares,
      };
    });

    explanationEl.innerHTML = `
      <div style="
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
        align-items: flex-start;
        background: ${surfaceColor};
        border: 1px solid ${panelBorder};
        border-radius: 12px;
        padding: 12px 16px;
        color: ${textSecondary};
      ">
        ${yearlySummary
          .map((yearData) => {
            const summary = yearData.shares
              .map((d) => {
                const pct = Number.isFinite(d.share)
                  ? d3.format(".1%")(d.share)
                  : "—";
                return `${d.label}: ${pct}`;
              })
              .join(" · ");

            return `
              <span>
                <strong style="color: ${
                  yearData.year === 2020 ? impactColor : textPrimary
                };">${yearData.year}:</strong>
                ${summary}
              </span>
            `;
          })
          .join("")}
      </div>
    `;
  }
}