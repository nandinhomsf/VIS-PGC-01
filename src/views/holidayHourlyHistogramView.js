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
 * Cores por ano.
 * 2020 recebe a cor de destaque usada nas demais views para indicar
 * o período de impacto inicial da pandemia.
 */
const YEAR_STYLES = {
  2019: { color: "#64748b", label: "2019" },
  2020: { color: "#92400e", label: "2020" },
  2021: { color: "#2563eb", label: "2021" },
  2022: { color: "#16a34a", label: "2022" },
};

/**
 * Histograma por hora.
 *
 * Cada painel representa um feriado.
 * Cada linha representa um ano.
 * Cada barra indica o número de corridas naquela hora do dia.
 *
 * A estrutura em pequenos múltiplos mantém o foco nos feriados e
 * permite comparar mudanças no perfil horário antes, durante e após
 * o impacto inicial da pandemia.
 */
export function renderHolidayHourlyHistogramView(data) {
  const { svg } = createBaseChart();

  const margin = { top: 82, right: 48, bottom: 64, left: 70 };
  const width = 1120 - margin.left - margin.right;
  const height = 720 - margin.top - margin.bottom;

  const root = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const rawRows = (data.holidayHourlyByYear || []).filter(
    (d) =>
      Number.isFinite(d.pickup_hour) &&
      d.pickup_hour >= 0 &&
      d.pickup_hour <= 23 &&
      Number.isFinite(d.trips),
  );

  /**
   * Índice por feriado, ano e hora.
   * Facilita reconstruir um histograma completo de 24 horas mesmo quando
   * determinada hora não aparece explicitamente nos dados.
   */
  const dataMap = new Map();

  rawRows.forEach((d) => {
    dataMap.set(`${d.holidayName}_${d.year}_${d.pickup_hour}`, d);
  });

  /**
   * Monta uma série completa para cada feriado:
   * - 9 feriados;
   * - 4 anos por feriado;
   * - 24 horas por ano.
   */
  const holidayPanels = HOLIDAY_MAP.map((holiday) => {
    const years = YEAR_DOMAIN.map((year) => {
      const bins = d3.range(24).map((hour) => {
        const item = dataMap.get(`${holiday.id}_${year}_${hour}`);

        return {
          holidayName: holiday.id,
          holidayLabel: holiday.label,
          holidayDateRule: holiday.dateRule,
          year,
          hour,
          trips: item?.trips ?? 0,
          dayLabel: item?.dayLabel ?? null,
        };
      });

      const total = d3.sum(bins, (d) => d.trips);
      const peak = d3.max(bins, (d) => d.trips) || 0;

      return {
        year,
        total,
        peak,
        bins,
      };
    });

    return {
      ...holiday,
      years,
      panelMaxTrips: d3.max(years, (d) => d.peak) || 1,
    };
  });

  /**
   * Layout em pequenos múltiplos: 3 colunas × 3 linhas.
   * Isso mantém um painel por feriado.
   */
  const cols = 3;
  const rows = 3;
  const panelWidth = width / cols;
  const panelHeight = height / rows;

  const innerMargin = { top: 50, right: 18, bottom: 32, left: 54 };
  const innerWidth = panelWidth - innerMargin.left - innerMargin.right;
  const innerHeight = panelHeight - innerMargin.top - innerMargin.bottom;

  const x = d3.scaleBand().domain(d3.range(24)).range([0, innerWidth]).padding(0.1);

  const xLine = d3
    .scaleLinear()
    .domain([0, 23])
    .range([x(0) + x.bandwidth() / 2, x(23) + x.bandwidth() / 2]);

  const yRow = d3
    .scaleBand()
    .domain(YEAR_DOMAIN)
    .range([0, innerHeight])
    .padding(0.28);

  const rowChartHeight = yRow.bandwidth() * 0.72;
  const rowBaseline = yRow.bandwidth() * 0.84;

  const surfaceColor = "#f8fafc";
  const panelBorder = "rgba(15, 23, 42, 0.08)";
  const textPrimary = "#0f172a";
  const textSecondary = "#475569";
  const gridColor = "#e2e8f0";
  const rowLineColor = "#cbd5e1";

  const tooltip = d3
    .select("body")
    .selectAll(".chart-tooltip")
    .data([null])
    .join("div")
    .attr("class", "chart-tooltip");

  const panels = root
    .selectAll("g.hourly-panel")
    .data(holidayPanels)
    .join("g")
    .attr("class", "hourly-panel")
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

  // Grade vertical para leitura das horas.
  plot
    .append("g")
    .selectAll("line.hour-grid")
    .data([0, 6, 12, 18, 23])
    .join("line")
    .attr("class", "hour-grid")
    .attr("x1", (d) => xLine(d))
    .attr("x2", (d) => xLine(d))
    .attr("y1", 0)
    .attr("y2", innerHeight)
    .attr("stroke", gridColor)
    .attr("stroke-dasharray", "3,3");

  const yearGroups = plot
    .selectAll("g.year-row")
    .data((d) => d.years)
    .join("g")
    .attr("class", "year-row")
    .attr("transform", (d) => `translate(0,${yRow(d.year)})`);

  // Linha de base em cada faixa anual.
  yearGroups
    .append("line")
    .attr("x1", 0)
    .attr("x2", innerWidth)
    .attr("y1", rowBaseline)
    .attr("y2", rowBaseline)
    .attr("stroke", rowLineColor)
    .attr("stroke-width", 1);

  // Rótulo do ano em cada faixa.
  yearGroups
    .append("text")
    .attr("x", -10)
    .attr("y", rowBaseline + 4)
    .attr("text-anchor", "end")
    .attr("fill", (d) => YEAR_STYLES[d.year]?.color ?? textSecondary)
    .attr("font-size", 10)
    .attr("font-weight", 700)
    .text((d) => d.year);

  // Barras do histograma por hora.
  yearGroups.each(function (yearData) {
    const panelData = d3.select(this.parentNode).datum();
    const h = d3
      .scaleLinear()
      .domain([0, panelData.panelMaxTrips])
      .range([0, rowChartHeight]);

    d3.select(this)
      .selectAll("rect.hour-bar")
      .data(
        yearData.bins.map((bin) => ({
          ...bin,
          total: yearData.total,
          peak: yearData.peak,
          panelMaxTrips: panelData.panelMaxTrips,
        })),
      )
      .join("rect")
      .attr("class", "hour-bar")
      .attr("x", (d) => x(d.hour))
      .attr("y", (d) => rowBaseline - h(d.trips))
      .attr("width", x.bandwidth())
      .attr("height", (d) => h(d.trips))
      .attr("rx", 1.5)
      .attr("fill", YEAR_STYLES[yearData.year]?.color ?? "#64748b")
      .attr("opacity", 0.88)
      .on("mouseover", function (event, d) {
        d3.select(this).attr("opacity", 1);

        const nextHour = d.hour === 23 ? "24:00" : `${String(d.hour + 1).padStart(2, "0")}:00`;

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
          <div class="tooltip-row">
            <span class="tooltip-label">Hora:</span>
            <span class="tooltip-val">${String(d.hour).padStart(2, "0")}:00–${nextHour}</span>
          </div>
          <div class="tooltip-row tooltip-divider">
            <span class="tooltip-label">Corridas:</span>
            <span class="tooltip-val highlight">${d.trips.toLocaleString("pt-BR")}</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">Participação no dia:</span>
            <span class="tooltip-val">${
              d.total > 0 ? d3.format(".1%")(d.trips / d.total) : "—"
            }</span>
          </div>
        `);
      })
      .on("mousemove", function (event) {
        tooltip
          .style("left", event.pageX + 16 + "px")
          .style("top", event.pageY - 28 + "px");
      })
      .on("mouseout", function () {
        d3.select(this).attr("opacity", 0.88);
        tooltip.style("opacity", 0);
      });
  });

  // Eixo X compacto em cada painel.
  const xAxis = d3
    .axisBottom(xLine)
    .tickValues([0, 6, 12, 18, 23])
    .tickFormat((d) => `${String(d).padStart(2, "0")}h`);

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
   * As cores identificam os anos comparados.
   */
  const legend = svg.append("g").attr("transform", `translate(${margin.left},28)`);

  const legendItems = legend
    .selectAll("g.legend-year")
    .data(YEAR_DOMAIN)
    .join("g")
    .attr("class", "legend-year")
    .attr("transform", (_, i) => `translate(${i * 82},0)`);

  legendItems
    .append("rect")
    .attr("x", 0)
    .attr("y", -7)
    .attr("width", 12)
    .attr("height", 12)
    .attr("rx", 2)
    .attr("fill", (d) => YEAR_STYLES[d]?.color ?? "#64748b");

  legendItems
    .append("text")
    .attr("x", 18)
    .attr("y", 3)
    .attr("fill", textSecondary)
    .attr("font-size", 12)
    .attr("font-weight", 700)
    .text((d) => d);

  /**
   * Resumo textual acima do gráfico.
   * Para cada ano, resume o horário agregado com maior volume de corridas
   * considerando todos os feriados disponíveis.
   */
  const explanationEl = document.querySelector("#explanation");

  if (explanationEl) {
    const yearlySummary = YEAR_DOMAIN.map((year) => {
      const rows = rawRows.filter((d) => d.year === year);
      const total = d3.sum(rows, (d) => d.trips);

      const tripsByHour = d3.rollup(
        rows,
        (v) => d3.sum(v, (d) => d.trips),
        (d) => d.pickup_hour,
      );

      const peakHour = d3.greatest(d3.range(24), (hour) => tripsByHour.get(hour) || 0);
      const peakTrips = tripsByHour.get(peakHour) || 0;

      return {
        year,
        total,
        peakHour,
        peakTrips,
      };
    });

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
        ${yearlySummary
          .map((d) => {
            const yearColor = YEAR_STYLES[d.year]?.color ?? textPrimary;
            const hourLabel = Number.isFinite(d.peakHour)
              ? `${String(d.peakHour).padStart(2, "0")}h`
              : "—";

            return `
              <span>
                <strong style="color: ${yearColor};">${d.year}:</strong>
                pico em ${hourLabel} · ${d.total.toLocaleString("pt-BR")} corridas
              </span>
            `;
          })
          .join("")}
      </div>
    `;
  }
}