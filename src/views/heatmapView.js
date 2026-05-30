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

  // Margens à esquerda para acomodar os rótulos longos do eixo Y
  // sem sobreposição com o grid. O heatmap ignora as margens padrão de createBaseChart.
  const margin = { top: 80, right: 60, bottom: 96, left: 200 };
  const width = 1120 - margin.left - margin.right;
  const height = 660 - margin.top - margin.bottom;

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Domínio Y: ordem cronológica dos feriados | Domínio X: anos da análise.
  const yDomain = HOLIDAY_MAP.map((d) => d.id);
  const xDomain = [2019, 2020, 2021, 2022];

  // scaleBand garante células de largura uniforme com espaçamento entre elas.
  const x = d3.scaleBand().domain(xDomain).range([0, width]).padding(0.04);
  const y = d3.scaleBand().domain(yDomain).range([0, height]).padding(0.04);

  /**
   * Valores numéricos válidos usados pela escala de cor.
   * Células sem dados ficam fora da escala e recebem uma cor neutra própria.
   */
  const tripsValues = data.holidaySeries
    .map((d) => d.trips)
    .filter((v) => Number.isFinite(v));

  // Valores de referência usados nos rótulos da legenda e como fallback.
  const maxTrips = d3.max(tripsValues) || 10000;
  const minTrips = d3.min(tripsValues) || 0;

  /**
   * Paleta Greens em 6 faixas discretas.
   *
   * O verde foi escolhido por funcionar bem para uma medida única e ordenada
   * de volume: tons claros indicam menor intensidade e tons escuros indicam
   * maior intensidade. A escala evita amarelo, vermelho e roxo, mantendo uma
   * leitura mais limpa em fundo branco.
   *
   * A escala é amostrada entre 0.14 e 0.88 para evitar os extremos:
   * - valores muito próximos de 0 ficam claros demais;
   * - valores muito próximos de 1 ficam escuros demais.
   *
   * A escala por quantis distribui as cores conforme os valores reais do dataset,
   * o que ajuda quando há concentração de observações em uma mesma faixa.
   */
  const heatmapColors = d3.range(6).map((i) =>
    d3.interpolateGreens(0.14 + i * ((0.88 - 0.14) / 5)),
  );

  const colorScale = d3
    .scaleQuantile()
    .domain(tripsValues.length ? tripsValues : [0, maxTrips])
    .range(heatmapColors);

  /**
   * Cores de superfície do gráfico.
   * A mesma cor é usada no fundo visual do heatmap e na caixa explicativa,
   * mantendo a composição mais uniforme.
   */
  const heatmapSurfaceColor = "#f8fafc";
  const heatmapSurfaceBorder = "rgba(15, 23, 42, 0.08)";

  // Cor neutra para células sem informação, sem sugerir baixo volume.
  const missingCellColor = "#f1f5f9";

  /**
   * Cores semânticas das marcações especiais.
   * A pandemia usa âmbar/marrom 
   */
  const impactColor = "#92400e";
  const impactColorDark = "#78350f";
  const impactShadow = "rgba(146, 64, 14, 0.42)";

  const recoveryColor = "#92400e";
  const recoveryColorDark = "#78350f";
  const recoveryShadow = "rgba(146, 64, 14, 0.42)";

  /**
   * Define automaticamente se o texto dentro da célula deve ser claro ou escuro.
   * Isso mantém a legibilidade nas diferentes intensidades da paleta verde.
   */
  function readableTextColor(backgroundColor) {
    const color = d3.color(backgroundColor);
    if (!color) return "#0f172a";

    const rgb = [color.r, color.g, color.b].map((v) => {
      const x = v / 255;
      return x <= 0.03928
        ? x / 12.92
        : Math.pow((x + 0.055) / 1.055, 2.4);
    });

    const luminance =
      0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];

    return luminance > 0.45 ? "#0f172a" : "#ffffff";
  }

  // Linha de base pré-pandemia: média das corridas nos feriados até fev/2020. 
  // A OMS decretou feriado em março/2020.
  const sortedSeries = [...data.holidaySeries].sort((a, b) =>
    a.dayISO.localeCompare(b.dayISO),
  );

  const baseline =
    d3.mean(
      sortedSeries.filter((d) => d.dayISO <= "2020-02-17"),
      (d) => d.trips,
    ) || 10000;

  // Impacto: primeiro feriado com volume abaixo de 60% da baseline.
  const impactPoint = sortedSeries.find((d) => d.trips < baseline * 0.6);

  /**
   * Limiar de 75% porque a baseline inclui jan/fev 2020,
   * que registraram volumes excepcionalmente altos.
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

  // Chave composta (feriado_ano) usada para marcar células específicas do grid.
  const impactKey = impactPoint
    ? `${impactPoint.holidayName}_${impactPoint.year}`
    : null;

  const recoveryKey = recoveryPoint
    ? `${recoveryPoint.holidayName}_${recoveryPoint.year}`
    : null;

  // Índice O(1) para buscar os dados de cada célula sem iterar o array inteiro.
  const dataMap = new Map();
  data.holidaySeries.forEach((item) => {
    dataMap.set(`${item.holidayName}_${item.year}`, item);
  });

  // Monta a matriz completa do grid, incluindo células sem dados.
  // Isso mantém o layout sempre como 9 linhas × 4 colunas.
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
  // evitando duplicação a cada re-renderização do heatmap.
  const tooltip = d3
    .select("body")
    .selectAll(".chart-tooltip")
    .data([null])
    .join("div")
    .attr("class", "chart-tooltip");

  // Renderiza as células do grid com preenchimento de cor proporcional ao volume.
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
    .attr("fill", (d) =>
      d.trips === null ? missingCellColor : colorScale(d.trips),
    )
    .attr("stroke", (d) => (d.trips === null ? "#cbd5e1" : "#ecfdf5"))
    .attr("stroke-width", 1.5);

  /**
   * Borda sobreposta nas células marcadas como impacto ou retomada.
   *
   * O impacto usa âmbar/marrom para se diferenciar do volume de corridas.
   * A retomada usa azul para não se confundir com a escala principal verde.
   *
   * As etiquetas textuais ("PANDEMIA" / "RECUPERADO") evitam que a interpretação
   * dependa apenas da cor.
   */
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
    .attr("stroke", (d) => (d.isRecovery ? recoveryColor : impactColor))
    .attr("stroke-width", 3)
    .style(
      "filter",
      (d) =>
        `drop-shadow(0 0 5px ${
          d.isRecovery ? recoveryShadow : impactShadow
        })`,
    )
    .style("pointer-events", "none");

  // Tooltips interativos no hover.
  cells
    .on("mouseover", function (event, d) {
      if (d.trips === null) return;

      d3.select(this).attr("stroke", "#14532d").attr("stroke-width", 2.25);

      tooltip.style("opacity", 1).html(`
        <div class="tooltip-title">${d.dayLabel}</div>
        <div class="tooltip-row">
          <span class="tooltip-label">Feriado:</span>
          <span class="tooltip-val">${
            HOLIDAY_MAP.find((h) => h.id === d.holiday)?.label || d.holiday
          }</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Ano:</span>
          <span class="tooltip-val">${d.year}</span>
        </div>
        <div class="tooltip-row tooltip-divider">
          <span class="tooltip-label">Corridas Totais:</span>
          <span class="tooltip-val highlight">${d.trips.toLocaleString(
            "pt-BR",
          )}</span>
        </div>
      `);
    })
    .on("mousemove", function (event) {
      tooltip
        .style("left", event.pageX + 16 + "px")
        .style("top", event.pageY - 28 + "px");
    })
    .on("mouseout", function () {
      d3.select(this).attr("stroke", "#ecfdf5").attr("stroke-width", 1.5);
      tooltip.style("opacity", 0);
    });

  // Rótulo numérico centralizado dentro de cada célula.
  // Nas células anotadas, o número sobe levemente para deixar espaço
  // para a micro-etiqueta textual abaixo.
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
      if (d.trips === null) return "#64748b";
      return readableTextColor(colorScale(d.trips));
    })
    .text((d) => {
      if (d.trips === null) return "N/A";
      return d.trips >= 1000 ? `${(d.trips / 1000).toFixed(1)}k` : d.trips;
    });

  // Micro-etiqueta abaixo do número: "PANDEMIA" ou "RECUPERADO".
  g.selectAll("text.cell-tag")
    .data(markedCells)
    .join("text")
    .attr("class", "cell-tag")
    .attr("x", (d) => x(d.year) + x.bandwidth() / 2)
    .attr("y", (d) => y(d.holiday) + y.bandwidth() / 2 + 13)
    .attr("text-anchor", "middle")
    .attr("font-size", 8.5)
    .attr("font-weight", 800)
    .attr("fill", (d) => (d.isRecovery ? recoveryColorDark : impactColor))
    .style("letter-spacing", "0.06em")
    .style("pointer-events", "none")
    .text((d) => (d.isRecovery ? "RECUPERADO" : "PANDEMIA"));

  // Render Y Axis: nomes dos feriados em português.
  const yAxis = d3
    .axisLeft(y)
    .tickFormat((id) => HOLIDAY_MAP.find((h) => h.id === id)?.label || id);

  g.append("g")
    .call(yAxis)
    .attr("font-size", 12)
    .selectAll("text")
    .attr("fill", "#334155")
    .attr("font-weight", 500);

  // Remove marcas do eixo Y e suaviza a linha do domínio.
  g.selectAll(".tick line").attr("stroke", "none");
  g.selectAll(".domain").attr("stroke", "#cbd5e1");

  // Caption centralizado do eixo Y, rotacionado à esquerda.
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -175)
    .attr("text-anchor", "middle")
    .attr("fill", "#475569")
    .attr("font-size", 13)
    .attr("font-weight", 600)
    .text("Feriados Oficiais dos Estados Unidos");

  // Render X Axis: anos.
  const xAxis = d3.axisBottom(x).tickFormat(d3.format("d"));

  const xAxisG = g
    .append("g")
    .attr("transform", `translate(0,${height})`)
    .call(xAxis);

  xAxisG
    .selectAll("text")
    .attr("font-size", 13)
    .attr("font-weight", 600)
    .attr("fill", "#334155")
    .attr("dy", "1.5em");

  xAxisG.selectAll("line").attr("stroke", "#cbd5e1");
  xAxisG.select(".domain").attr("stroke", "#cbd5e1");

  // Caption centralizado do eixo X.
  g.append("text")
    .attr("x", width / 2)
    .attr("y", height + 54)
    .attr("text-anchor", "middle")
    .attr("fill", "#475569")
    .attr("font-size", 13)
    .attr("font-weight", 600)
    .text("Anos");

  /**
   * Legenda do heatmap.
   * Escala discreta de 6 faixas, com rótulos de intervalo personalizados.
   */
  const legendWidth = 360;
  const legendHeight = 14;
  const legendX = margin.left;
  const legendY = 22;

  const legendG = svg
    .append("g")
    .attr("transform", `translate(${legendX},${legendY})`);

  const formatTripsShort = (value) => {
    if (!Number.isFinite(value)) return "—";
    return value >= 1000
      ? `${(value / 1000).toFixed(1)}k`
      : Math.round(value).toLocaleString("pt-BR");
  };

  legendG
    .append("text")
    .attr("x", 0)
    .attr("y", -10)
    .attr("font-size", 12)
    .attr("font-weight", 600)
    .attr("fill", "#166534")
    .text("Volume de corridas");

  const legendStepWidth = legendWidth / heatmapColors.length;

  const legendItems = heatmapColors.map((color) => {
    const [from, to] = colorScale.invertExtent(color);

    return {
      color,
      from: from ?? minTrips,
      to: to ?? maxTrips,
    };
  });

  const legendSteps = legendG
    .selectAll("g.legend-step")
    .data(legendItems)
    .join("g")
    .attr("class", "legend-step")
    .attr("transform", (_, i) => `translate(${i * legendStepWidth},0)`);

  legendSteps
    .append("rect")
    .attr("width", legendStepWidth - 2)
    .attr("height", legendHeight)
    .attr("rx", 3)
    .attr("fill", (d) => d.color)
    .attr("stroke", "#ecfdf5")
    .attr("stroke-width", 1);

  legendSteps
    .append("text")
    .attr("x", legendStepWidth / 2)
    .attr("y", legendHeight + 16)
    .attr("text-anchor", "middle")
    .attr("font-size", 9.5)
    .attr("fill", "#475569")
    .text((d) => `${formatTripsShort(d.from)}–${formatTripsShort(d.to)}`);

  /**
   * Cards explicativos acima do gráfico.
   * A caixa usa a mesma cor de superfície do heatmap; as cores semânticas
   * aparecem apenas nos marcadores e nos títulos internos.
   */
  const explanationEl = document.querySelector("#explanation");

  if (explanationEl) {
    const recoveryHoliday =
      HOLIDAY_MAP.find((h) => h.id === recoveryPoint?.holidayName)?.label ??
      recoveryPoint?.holidayName ??
      "—";

    const impactHoliday =
      HOLIDAY_MAP.find((h) => h.id === impactPoint?.holidayName)?.label ??
      impactPoint?.holidayName ??
      "—";

    explanationEl.innerHTML = `
      <div style="
        display: flex;
        gap: 24px;
        flex-wrap: wrap;
        justify-content: flex-start;
        align-items: flex-start;
        background: ${heatmapSurfaceColor};
        padding: 12px 20px;
        border-radius: 12px;
        border: 1px solid ${heatmapSurfaceBorder};
        margin-top: 8px;
        color: #334155;
      ">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="
            display: inline-block;
            width: 10px;
            height: 10px;
            flex-shrink: 0;
            border-radius: 50%;
            background-color: ${impactColor};
            box-shadow: 0 0 8px rgba(146, 64, 14, 0.35);
          "></span>
          <span style="font-size: 0.85rem; font-family: var(--font-body);">
            <strong style="color: ${impactColorDark};">
              Início da Pandemia — ${impactHoliday} ${impactPoint?.year ?? ""}
            </strong>:
            Queda &lt;60% da média histórica (${(
              impactPoint?.trips ?? 0
            ).toLocaleString("pt-BR")} corridas).
          </span>
        </div>

        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="
            display: inline-block;
            width: 10px;
            height: 10px;
            flex-shrink: 0;
            border-radius: 50%;
            background-color: ${recoveryColor};
            box-shadow: 0 0 8px rgba(37, 99, 235, 0.35);
          "></span>
          <span style="font-size: 0.85rem; font-family: var(--font-body);">
            <strong style="color: ${recoveryColorDark};">
              Retomada — ${recoveryHoliday} ${recoveryPoint?.year ?? ""}
            </strong>:
            Primeiro feriado a retornar a ≥75% da demanda pré-pandemia (${(
              recoveryPoint?.trips ?? 0
            ).toLocaleString("pt-BR")} corridas).
          </span>
        </div>
      </div>
    `;
  }
}