import * as d3 from "d3";
import { createBaseChart } from "../utils/chart";

/**
 * Mapeamento de nomes canônicos dos feriados (usados como chave de agrupamento
 * nos dados do DuckDB) para rótulos em português exibidos no eixo Y do heatmap.
 * A ordem deste array define a sequência vertical das linhas no grid.
 */
const HOLIDAY_MAP = [
  { id: "New Year", label: "Ano Novo" },
  { id: "MLK Day", label: "Dia de Martin Luther King" },
  { id: "Presidents Day", label: "Dia dos Presidentes" },
  { id: "Memorial Day", label: "Memorial Day" },
  { id: "Independence Day", label: "Independência" },
  { id: "Labor Day", label: "Dia do Trabalho" },
  { id: "Veterans Day", label: "Dia dos Veteranos" },
  { id: "Thanksgiving", label: "Ação de Graças" },
  { id: "Christmas", label: "Natal" },
];

export function renderHolidayHeatmap(data) {
  const { svg } = createBaseChart();

  // Margens generosas à esquerda (200px) para acomodar os rótulos longos do eixo Y
  // sem sobreposição com o grid. O heatmap ignora as margens padrão de createBaseChart.
  const margin = { top: 80, right: 60, bottom: 96, left: 200 };
  const width = 1120 - margin.left - margin.right;
  const height = 660 - margin.top - margin.bottom;

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Domínio Y: ordem cronológica dos feriados | Domínio X: anos da análise
  const yDomain = HOLIDAY_MAP.map((d) => d.id);
  const xDomain = [2019, 2020, 2021, 2022];

  // scaleBand garante células de largura uniforme com espaçamento (padding) entre elas
  const x = d3.scaleBand().domain(xDomain).range([0, width]).padding(0.04);
  const y = d3.scaleBand().domain(yDomain).range([0, height]).padding(0.04);

  // Valor máximo real do dataset; serve como teto da escala de cor
  const maxTrips = d3.max(data.holidaySeries, (d) => d.trips) || 10000;

  /**
   * Escala de cor sequencial multisegmento: do quase-preto (zero corridas)
   * passando por índigo, magenta e terminando em dourado (volume máximo).
   * Os breakpoints intermediários (~25% e ~65%) evitam que a maioria das
   * células fique na mesma faixa de cor, maximizando a discriminação visual.
   */
  const colorScale = d3
    .scaleLinear()
    .domain([0, maxTrips * 0.25, maxTrips * 0.65, maxTrips])
    .range(["#1e293b", "#4f46e5", "#db2777", "#f59e0b"]);

  // Linha de base pré-pandemia: média das corridas nos feriados até fev/2020
  const sortedSeries = [...data.holidaySeries].sort((a, b) =>
    a.dayISO.localeCompare(b.dayISO),
  );
  const baseline =
    d3.mean(
      sortedSeries.filter((d) => d.dayISO <= "2020-02-17"),
      (d) => d.trips,
    ) || 10000;

  // Impacto: primeiro feriado com volume abaixo de 60% da baseline
  const impactPoint = sortedSeries.find((d) => d.trips < baseline * 0.6);

  /**
   * Limiar de 75% (e não 90%) porque a baseline inclui jan/fev 2020,
   * que registraram volumes excepcionalmente altos. Com 90%, nenhum feriado
   * de 2021-2022 atingiria o critério; 75% identifica a retomada real.
   * Fallback: caso o limiar nunca seja atingido, usa o feriado de maior
   * volume após o ponto de impacto.
   */
  const afterImpact = sortedSeries.filter(
    (d) => d.dayISO > (impactPoint?.dayISO ?? "2020-03-01"),
  );
  const recoveryPoint =
    afterImpact.find((d) => d.trips >= baseline * 0.75) ??
    afterImpact.reduce(
      (best, d) => (d.trips > (best?.trips ?? 0) ? d : best),
      null,
    );

  // Chave composta (feriado_ano) usada para marcar células específicas do grid
  const impactKey = impactPoint
    ? `${impactPoint.holidayName}_${impactPoint.year}`
    : null;
  const recoveryKey = recoveryPoint
    ? `${recoveryPoint.holidayName}_${recoveryPoint.year}`
    : null;

  // Índice O(1) para buscar os dados de cada célula sem iterar o array inteiro
  const dataMap = new Map();
  data.holidaySeries.forEach((item) => {
    dataMap.set(`${item.holidayName}_${item.year}`, item);
  });

  // Monta a matriz completa do grid, incluindo células sem dados (trips: null)
  // para que o layout seja sempre 9 linhas × 4 colunas
  const gridCells = [];
  yDomain.forEach((holiday) => {
    xDomain.forEach((year) => {
      const match = dataMap.get(`${holiday}_${year}`);
      const key = `${holiday}_${year}`;
      gridCells.push({
        holiday,
        year,
        trips: match ? match.trips : null,
        dayLabel: match ? match.dayLabel : null,
        dayISO: match ? match.dayISO : null,
        isImpact: key === impactKey,
        isRecovery: key === recoveryKey,
      });
    });
  });

  // O padrão join(div) garante que apenas um tooltip exista no DOM,
  // evitando duplicação a cada re-renderização do heatmap
  const tooltip = d3
    .select("body")
    .selectAll(".chart-tooltip")
    .data([null])
    .join("div")
    .attr("class", "chart-tooltip");

  // Renderiza as células do grid com preenchimento de cor proporcional ao volume
  const cells = g
    .selectAll("rect.cell")
    .data(gridCells)
    .join("rect")
    .attr("class", (d) =>
      d.trips === null ? "cell cell-empty" : "cell cell-active",
    )
    .attr("x", (d) => x(d.year))
    .attr("y", (d) => y(d.holiday))
    .attr("width", x.bandwidth())
    .attr("height", y.bandwidth())
    .attr("rx", 6)
    .attr("fill", (d) => (d.trips === null ? "#0f172a" : colorScale(d.trips)))
    .attr("stroke", (d) =>
      d.trips === null ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.05)",
    )
    .attr("stroke-width", 1.5);

  // Borda neon brilhante (glow) sobreposta nas células marcadas como impacto ou retomada.
  // Desenhada como rect separado para não interferir nos eventos de mouse da célula base.
  const markedCells = gridCells.filter((d) => d.isImpact || d.isRecovery);
  g.selectAll("rect.cell-border")
    .data(markedCells)
    .join("rect")
    .attr("class", "cell-border")
    .attr("x", (d) => x(d.year))
    .attr("y", (d) => y(d.holiday))
    .attr("width", x.bandwidth())
    .attr("height", y.bandwidth())
    .attr("rx", 6)
    .attr("fill", "none")
    .attr("stroke", (d) => (d.isRecovery ? "#10b981" : "#ec4899"))
    .attr("stroke-width", 3)
    .style(
      "filter",
      (d) => `drop-shadow(0 0 6px ${d.isRecovery ? "#10b981" : "#ec4899"})`,
    )
    .style("pointer-events", "none");

  // Add Interactive Tooltips on hover
  cells
    .on("mouseover", function (event, d) {
      if (d.trips === null) return;

      d3.select(this).attr("stroke", "#ffffff").attr("stroke-width", 2);

      tooltip.style("opacity", 1).html(`
      <div class="tooltip-title">${d.dayLabel}</div>
      <div class="tooltip-row">
        <span class="tooltip-label">Feriado:</span>
        <span class="tooltip-val">${HOLIDAY_MAP.find((h) => h.id === d.holiday)?.label || d.holiday}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-label">Ano:</span>
        <span class="tooltip-val">${d.year}</span>
      </div>
      <div class="tooltip-row tooltip-divider">
        <span class="tooltip-label">Corridas Totais:</span>
        <span class="tooltip-val highlight">${d.trips.toLocaleString("pt-BR")}</span>
      </div>
    `);
    })
    .on("mousemove", function (event) {
      tooltip
        .style("left", event.pageX + 16 + "px")
        .style("top", event.pageY - 28 + "px");
    })
    .on("mouseout", function () {
      d3.select(this)
        .attr("stroke", "rgba(255,255,255,0.05)")
        .attr("stroke-width", 1.5);
      tooltip.style("opacity", 0);
    });

  // Rótulo numérico centralizado dentro de cada célula.
  // Nas células anotadas (pandemia/retomada), o número sobe levemente para
  // deixar espaço para a micro-etiqueta textual abaixo.
  g.selectAll("text.cell-val")
    .data(gridCells)
    .join("text")
    .attr("class", "cell-val")
    .attr("x", (d) => x(d.year) + x.bandwidth() / 2)
    .attr("y", (d) => {
      const center = y(d.holiday) + y.bandwidth() / 2;
      return d.isImpact || d.isRecovery ? center - 5 : center + 4;
    })
    .attr("text-anchor", "middle")
    .attr("font-size", 11)
    .attr("font-weight", 700)
    .attr("fill", (d) => {
      if (d.trips === null) return "#475569";
      // Texto escuro nas células de ouro (alto volume) para manter contraste legível
      return d.trips > maxTrips * 0.75 ? "#0f172a" : "#ffffff";
    })
    .text((d) => {
      if (d.trips === null) return "N/A";
      return d.trips >= 1000 ? `${(d.trips / 1000).toFixed(1)}k` : d.trips;
    });

  // Micro-etiqueta colorida abaixo do número: "PANDEMIA" ou "RECUPERADO"
  g.selectAll("text.cell-tag")
    .data(markedCells)
    .join("text")
    .attr("class", "cell-tag")
    .attr("x", (d) => x(d.year) + x.bandwidth() / 2)
    .attr("y", (d) => y(d.holiday) + y.bandwidth() / 2 + 13)
    .attr("text-anchor", "middle")
    .attr("font-size", 8.5)
    .attr("font-weight", 800)
    .attr("fill", (d) => (d.isRecovery ? "#10b981" : "#ec4899"))
    .style("letter-spacing", "0.06em")
    .style("pointer-events", "none")
    .text((d) => (d.isRecovery ? "RECUPERADO" : "PANDEMIA"));

  // Render Y Axis (Holiday Names in Portuguese)
  const yAxis = d3
    .axisLeft(y)
    .tickFormat((id) => HOLIDAY_MAP.find((h) => h.id === id)?.label || id);

  g.append("g")
    .call(yAxis)
    .attr("font-size", 12)
    .selectAll("text")
    .attr("fill", "#cbd5e1")
    .attr("font-weight", 500);

  g.selectAll(".tick line").attr("stroke", "none"); // Hide tick lines on Y-axis
  g.selectAll(".domain").attr("stroke", "rgba(255,255,255,0.1)");

  // Centered Y-axis Caption rotated -90 degrees on the far left margin
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -175)
    .attr("text-anchor", "middle")
    .attr("fill", "#94a3b8")
    .attr("font-size", 13)
    .attr("font-weight", 600)
    .text("Feriados Oficiais dos Estados Unidos");

  // Render X Axis (Years)
  const xAxis = d3.axisBottom(x).tickFormat(d3.format("d")); // formatted as decimal/integer

  const xAxisG = g
    .append("g")
    .attr("transform", `translate(0,${height})`)
    .call(xAxis);

  xAxisG
    .selectAll("text")
    .attr("font-size", 13)
    .attr("font-weight", 600)
    .attr("fill", "#cbd5e1")
    .attr("dy", "1.5em");

  xAxisG.selectAll("line").attr("stroke", "rgba(255,255,255,0.1)");
  xAxisG.select(".domain").attr("stroke", "rgba(255,255,255,0.1)");

  // Centered X-axis Caption below the years
  g.append("text")
    .attr("x", width / 2)
    .attr("y", height + 54)
    .attr("text-anchor", "middle")
    .attr("fill", "#94a3b8")
    .attr("font-size", 13)
    .attr("font-weight", 600)
    .text("Ano Civil (Comparação Temporal)");

  // Heatmap Color Legend
  const legendWidth = 320;
  const legendHeight = 12;
  const legendX = margin.left;
  const legendY = 22;

  const legendG = svg
    .append("g")
    .attr("transform", `translate(${legendX},${legendY})`);

  legendG
    .append("text")
    .attr("x", 0)
    .attr("y", -10)
    .attr("font-size", 12)
    .attr("font-weight", 500)
    .attr("fill", "#94a3b8")
    .text("Volume de corridas (escala de cores contínua):");

  // Create gradient definition
  const defs = svg.append("defs");
  const linearGradient = defs
    .append("linearGradient")
    .attr("id", "heatmap-grad");

  linearGradient
    .selectAll("stop")
    .data([
      { offset: "0%", color: "#1e293b" },
      { offset: "25%", color: "#4f46e5" },
      { offset: "65%", color: "#db2777" },
      { offset: "100%", color: "#f59e0b" },
    ])
    .join("stop")
    .attr("offset", (d) => d.offset)
    .attr("stop-color", (d) => d.color);

  // Draw gradient bar
  legendG
    .append("rect")
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .attr("rx", 3)
    .attr("fill", "url(#heatmap-grad)");

  // Legend Min/Max labels
  legendG
    .append("text")
    .attr("x", 0)
    .attr("y", legendHeight + 14)
    .attr("font-size", 10)
    .attr("fill", "#94a3b8")
    .text("Baixo volume (0)");

  legendG
    .append("text")
    .attr("x", legendWidth)
    .attr("y", legendHeight + 14)
    .attr("text-anchor", "end")
    .attr("font-size", 10)
    .attr("fill", "#94a3b8")
    .text(`Alto volume (${maxTrips.toLocaleString("pt-BR")})`);

  // Set highly polished interactive HTML explanation cards above the chart
  const explanationEl = document.querySelector("#explanation");
  if (explanationEl) {
    const recoveryLabel = recoveryPoint?.dayLabel?.split(" (")[0] ?? "—";
    const recoveryHoliday =
      HOLIDAY_MAP.find((h) => h.id === recoveryPoint?.holidayName)?.label ??
      recoveryPoint?.holidayName ??
      "—";
    const impactLabel = impactPoint?.dayLabel?.split(" (")[0] ?? "—";
    const impactHoliday =
      HOLIDAY_MAP.find((h) => h.id === impactPoint?.holidayName)?.label ??
      impactPoint?.holidayName ??
      "—";

    explanationEl.innerHTML = `
      <div style="display: flex; gap: 24px; flex-wrap: wrap; justify-content: flex-start; align-items: flex-start; background: rgba(30, 41, 59, 0.4); padding: 12px 20px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.05); margin-top: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="display: inline-block; width: 10px; height: 10px; flex-shrink:0; border-radius: 50%; background-color: #ec4899; box-shadow: 0 0 8px #ec4899;"></span>
          <span style="font-size: 0.85rem; font-family: var(--font-body);"><strong style="color: #ec4899;">Início da Pandemia — ${impactHoliday} ${impactPoint?.year ?? ""}</strong>: Queda &lt;60% da média histórica (${(impactPoint?.trips ?? 0).toLocaleString("pt-BR")} corridas).</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="display: inline-block; width: 10px; height: 10px; flex-shrink:0; border-radius: 50%; background-color: #10b981; box-shadow: 0 0 8px #10b981;"></span>
          <span style="font-size: 0.85rem; font-family: var(--font-body);"><strong style="color: #10b981;">Retomada — ${recoveryHoliday} ${recoveryPoint?.year ?? ""}</strong>: Primeiro feriado a retornar a ≥75% da demanda pré-pandemia (${(recoveryPoint?.trips ?? 0).toLocaleString("pt-BR")} corridas).</span>
        </div>
      </div>
    `;
  }
}
