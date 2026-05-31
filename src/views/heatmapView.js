import * as d3 from "d3";
import { createBaseChart } from "../utils/chart";

/**
 * Mapeamento entre os nomes canônicos dos feriados, usados nos dados agregados,
 * e os rótulos exibidos na visualização.
 *
 * A ordem deste array também define a ordem vertical dos feriados no heatmap.
 *
 * `dateRule` é mostrado em texto menor no eixo Y. Para feriados fixos, usamos
 * a data do calendário; para feriados móveis, usamos a regra de ocorrência.
 * 
 * Ponto de melhoria futura: extrair dinamicamente dos dados ou de uma API de feriados.
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

/**
 * Busca as informações de exibição de um feriado.
 *
 * O fallback evita quebrar a visualização caso apareça algum nome de feriado
 * inesperado nos dados. Nesse caso, o próprio id é usado como rótulo.
 */
function getHolidayInfo(id) {
  return (
    HOLIDAY_MAP.find((h) => h.id === id) ?? {
      id,
      label: id,
      dateRule: "",
    }
  );
}

/**
 * Renderiza o heatmap principal de volume de corridas.
 *
 * Cada célula representa um par feriado × ano.
 * A cor da célula representa o número total de corridas naquele feriado.
 * Além do volume, a visualização destaca automaticamente:
 * - o primeiro feriado com queda forte em relação ao pré-pandemia;
 * - o primeiro feriado com sinal de retomada.
 */
export function renderHolidayHeatmap(data) {
  const { svg } = createBaseChart();

  /**
   * O heatmap usa margens próprias em vez das margens padrão de createBaseChart.
   *
   * A margem esquerda é maior porque o eixo Y tem rótulos longos e uma segunda
   * linha com a data/regra do feriado. Sem esse espaço extra, os textos ficariam
   * cortados ou muito próximos do grid.
   */
  const margin = { top: 80, right: 60, bottom: 96, left: 230 };
  const width = 1120 - margin.left - margin.right;
  const height = 660 - margin.top - margin.bottom;

  /**
   * Grupo principal do gráfico.
   *
   * Deslocar um grupo `<g>` pelas margens e desenhar o gráfico
   * dentro dele. Assim, escalas, células e eixos trabalham em coordenadas locais
   * começando em (0, 0), enquanto o espaço externo fica reservado para legendas,
   * títulos e rótulos.
   */
  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  /**
   * Domínios fixos do heatmap.
   *
   * O eixo Y usa os feriados em ordem definida manualmente.
   * O eixo X usa os anos analisados no projeto.
   */
  const yDomain = HOLIDAY_MAP.map((d) => d.id);
  const xDomain = [2019, 2020, 2021, 2022];

  /**
   * Escalas de banda para formar a grade do heatmap.
   *
   * `scaleBand` é adequada para eixos categóricos. Aqui, cada ano e cada feriado
   * recebem uma faixa com largura/altura uniforme. O padding cria pequenos
   * espaços entre as células, melhorando a leitura do grid.
   */
  const x = d3.scaleBand().domain(xDomain).range([0, width]).padding(0.04);
  const y = d3.scaleBand().domain(yDomain).range([0, height]).padding(0.04);

  /**
   * Valores válidos usados para construir a escala de cor.
   *
   * Removemos valores ausentes ou inválidos para que a escala represente apenas
   * células reais. Células sem dados recebem uma cor neutra separada.
   */
  const tripsValues = data.holidaySeries
    .map((d) => d.trips)
    .filter((v) => Number.isFinite(v));

  /**
   * Valores de referência para a legenda e para casos de fallback.
   *
   * Se por algum motivo não houver dados, usamos valores padrão para evitar que
   * a escala e a legenda quebrem.
   */
  const maxTrips = d3.max(tripsValues) || 10000;
  const minTrips = d3.min(tripsValues) || 0;

  /**
   * Paleta Greens em seis faixas discretas.
   *
   * O heatmap representa uma única medida ordenada: volume de corridas.
   * Por isso, uma escala sequencial de uma cor já é boa.
   *
   * A escala é amostrada entre 0.14 e 0.88 para evitar extremos muito claros
   * ou muito escuros. Isso melhora a legibilidade dos números dentro das células.
   *
   * `scaleQuantile` distribui as cores conforme a distribuição real dos dados.
   * Essa escolha é útil quando os valores não estão uniformemente distribuídos,
   * pois evita que quase todas as células caiam na mesma faixa de cor.
   */
  const heatmapColors = d3.range(6).map((i) =>
    d3.interpolateGreens(0.14 + i * ((0.88 - 0.14) / 5)),
  );

  const colorScale = d3
    .scaleQuantile()
    .domain(tripsValues.length ? tripsValues : [0, maxTrips])
    .range(heatmapColors);

  /**
   * Cores de superfície usadas no gráfico e no card explicativo.
   */
  const heatmapSurfaceColor = "#f8fafc";
  const heatmapSurfaceBorder = "rgba(15, 23, 42, 0.08)";

  /**
   * Cor neutra para células sem dados.
   *
   * Ela é propositalmente diferente dos verdes da escala para não sugerir que
   * ausência de dado significa volume baixo.
   */
  const missingCellColor = "#f1f5f9";

  /**
   * Cores das marcações de eventos importantes.
   *
   * A mesma família de cor é usada para impacto e retomada porque ambas são
   * marcações semânticas sobre a série temporal, e não valores da escala verde.
   * A diferença entre elas é feita também pelos textos "PANDEMIA" e "RECUPERADO".
   */
  const impactColor = "#92400e";
  const impactColorDark = "#78350f";
  const impactShadow = "rgba(146, 64, 14, 0.42)";

  const recoveryColor = "#92400e";
  const recoveryColorDark = "#78350f";
  const recoveryShadow = "rgba(146, 64, 14, 0.42)";

  /**
   * Escolhe automaticamente a cor do texto dentro de cada célula.
   *
   * Como a cor de fundo varia de verde claro a verde escuro, usar sempre a
   * mesma cor para o texto poderia comprometer a legibilidade. Aqui calculamos
   * a luminância aproximada da cor de fundo e decidimos entre texto escuro ou
   * branco.
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

  /**
   * Ordena a série por data para permitir cálculos temporais.
   *
   * O heatmap em si é uma matriz feriado × ano, mas as marcações de impacto e
   * retomada dependem da ordem cronológica dos feriados.
   */
  const sortedSeries = [...data.holidaySeries].sort((a, b) =>
    a.dayISO.localeCompare(b.dayISO),
  );

  /**
   * Baseline pré-pandemia.
   *
   * Usamos a média dos feriados até fevereiro de 2020 como referência inicial,
   * pois a pandemia passa a afetar fortemente a mobilidade a partir de março.
   * Essa baseline serve para detectar a primeira queda acentuada.
   */
  const baseline =
    d3.mean(
      sortedSeries.filter((d) => d.dayISO <= "2020-02-17"),
      (d) => d.trips,
    ) || 10000;

  /**
   * Ponto de impacto.
   *
   * É definido como o primeiro feriado cujo volume fica abaixo de 60% da média
   * pré-pandemia.
   */
  const impactPoint = sortedSeries.find((d) => d.trips < baseline * 0.6);

  /**
   * Série posterior ao impacto.
   *
   * A retomada só deve ser procurada depois do ponto de impacto. Caso o impacto
   * não seja encontrado, usamos março de 2020 como referência de fallback.
   */
  const afterImpact = sortedSeries.filter(
    (d) => d.dayISO > (impactPoint?.dayISO ?? "2020-03-01"),
  );

  /**
   * Ponto de retomada.
   *
   * A regra principal marca o primeiro feriado que volta a atingir pelo menos
   * 75% da baseline. Se nenhum feriado atingir esse limiar, usamos como fallback
   * o feriado de maior volume após o impacto, para ainda indicar o melhor sinal
   * de recuperação disponível nos dados.
   */
  const recoveryPoint =
    afterImpact.find((d) => d.trips >= baseline * 0.75) ??
    afterImpact.reduce(
      (best, d) => (d.trips > (best?.trips ?? 0) ? d : best),
      null,
    );

  /**
   * Chaves compostas usadas para identificar as células especiais no grid.
   *
   * Como cada célula é definida por feriado e ano, a chave `feriado_ano` permite
   * verificar rapidamente se uma célula deve receber borda e etiqueta especial.
   */
  const impactKey = impactPoint
    ? `${impactPoint.holidayName}_${impactPoint.year}`
    : null;

  const recoveryKey = recoveryPoint
    ? `${recoveryPoint.holidayName}_${recoveryPoint.year}`
    : null;

  /**
   * Índice para acesso rápido aos dados de cada célula.
   *
   * Em vez de procurar no array inteiro para cada combinação feriado × ano,
   * criamos um Map. Isso deixa a montagem da matriz mais simples e eficiente.
   */
  const dataMap = new Map();
  data.holidaySeries.forEach((item) => {
    dataMap.set(`${item.holidayName}_${item.year}`, item);
  });

  /**
   * Matriz completa do heatmap.
   *
   * Mesmo que algum feriado/ano não tenha registro, a célula é criada com
   * `trips: null`. Isso mantém o layout sempre consistente: 9 linhas por
   * 4 colunas.
   */
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

  /**
   * Tooltip único compartilhado pela visualização.
   *
   * O padrão `selectAll(...).data([null]).join(...)` garante que apenas um
   * elemento de tooltip exista no DOM, mesmo se a view for renderizada várias
   * vezes ao trocar de gráfico no seletor.
   */
  const tooltip = d3
    .select("body")
    .selectAll(".chart-tooltip")
    .data([null])
    .join("div")
    .attr("class", "chart-tooltip");

  /**
   * Células do heatmap.
   *
   * Cada retângulo recebe posição a partir das escalas de banda. Células com
   * dados usam a escala verde; células sem dados usam a cor neutra.
   */
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
   * Células marcadas como impacto ou retomada.
   *
   * A borda é desenhada em um segundo retângulo, por cima da célula original.
   * Isso evita misturar a cor semântica da borda com a cor de preenchimento,
   * que continua representando o volume de corridas.
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

  /**
   * Interações de tooltip.
   *
   * No hover, reforçamos a borda da célula e mostramos os detalhes do feriado.
   * Células sem dados não exibem tooltip.
   */
  cells
    .on("mouseover", function (event, d) {
      if (d.trips === null) return;

      d3.select(this).attr("stroke", "#14532d").attr("stroke-width", 2.25);

      tooltip.style("opacity", 1).html(`
        <div class="tooltip-title">${d.dayLabel}</div>
        <div class="tooltip-row">
          <span class="tooltip-label">Feriado:</span>
          <span class="tooltip-val">${getHolidayInfo(d.holiday).label}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Regra/Data:</span>
          <span class="tooltip-val">${getHolidayInfo(d.holiday).dateRule}</span>
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

  /**
   * Valor numérico dentro de cada célula.
   *
   * Para valores grandes, usamos abreviação em milhares. Nas células marcadas
   * como impacto ou retomada, o número sobe um pouco para abrir espaço para a
   * etiqueta textual abaixo.
   */
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

  /**
   * Etiqueta textual para células especiais.
   *
   * O texto ajuda a interpretar as marcações sem depender apenas da cor.
   */
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

  /**
   * Eixo Y customizado.
   *
   * O d3.axisLeft cria os grupos dos ticks, mas removemos o texto padrão e
   * adicionamos manualmente duas linhas: o nome do feriado e sua data/regra.
   */
  const yAxis = d3.axisLeft(y).tickFormat("");

  const yAxisG = g.append("g").call(yAxis).attr("class", "y-axis");

  yAxisG.selectAll(".tick text").remove();

  const yTicks = yAxisG.selectAll(".tick");

  yTicks
    .append("text")
    .attr("x", -10)
    .attr("y", -3)
    .attr("text-anchor", "end")
    .attr("fill", "#334155")
    .attr("font-size", 12)
    .attr("font-weight", 700)
    .text((id) => getHolidayInfo(id).label);

  yTicks
    .append("text")
    .attr("x", -10)
    .attr("y", 12)
    .attr("text-anchor", "end")
    .attr("fill", "#64748b")
    .attr("font-size", 9.5)
    .attr("font-weight", 600)
    .text((id) => getHolidayInfo(id).dateRule);

  /**
   * Remove as marcas pequenas do eixo Y e suaviza a linha do domínio.
   * Como as células já formam o grid visualmente, os ticks laterais seriam ruído.
   */
  g.selectAll(".tick line").attr("stroke", "none");
  g.selectAll(".domain").attr("stroke", "#cbd5e1");

  /**
   * Rótulo vertical do eixo Y.
   *
   * Como a margem esquerda foi aumentada para comportar os nomes dos feriados,
   * o rótulo também é deslocado mais para a esquerda.
   */
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -205)
    .attr("text-anchor", "middle")
    .attr("fill", "#475569")
    .attr("font-size", 13)
    .attr("font-weight", 600)
    .text("Feriados Oficiais dos Estados Unidos");

  /**
   * Eixo X com os anos.
   *
   * Como o domínio é numérico, usamos `d3.format("d")` para garantir que os
   * anos apareçam como inteiros, sem separador ou casa decimal.
   */
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

  /**
   * Rótulo do eixo X.
   */
  g.append("text")
    .attr("x", width / 2)
    .attr("y", height + 54)
    .attr("text-anchor", "middle")
    .attr("fill", "#475569")
    .attr("font-size", 13)
    .attr("font-weight", 600)
    .text("Anos");

  /**
   * Legenda discreta da escala de cor.
   *
   * Como a escala tem seis faixas, a legenda também é desenhada em seis blocos.
   * Cada bloco mostra o intervalo aproximado de corridas correspondente àquela
   * cor.
   */
  const legendWidth = 360;
  const legendHeight = 14;
  const legendX = margin.left;
  const legendY = 22;

  const legendG = svg
    .append("g")
    .attr("transform", `translate(${legendX},${legendY})`);

  /**
   * Formatação compacta para os números da legenda.
   *
   * Valores acima de mil são mostrados como `k`, mantendo a legenda curta.
   */
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

  /**
   * `invertExtent` recupera, para cada cor, o intervalo de valores que cai
   * naquela faixa da escala quantílica.
   */
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
   * Card explicativo fora do SVG.
   *
   * Diferente dos eixos e células, este conteúdo é inserido no DOM HTML da
   * página, no elemento `#explanation`. Isso permite usar HTML flexível para
   * texto, marcadores e pequenos blocos explicativos.
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
            box-shadow: 0 0 8px ${impactShadow};
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
            box-shadow: 0 0 8px ${recoveryShadow};
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

        <div style="
          flex-basis: 100%;
          border-top: 1px solid rgba(15, 23, 42, 0.08);
          padding-top: 10px;
          margin-top: 2px;
          font-size: 0.82rem;
          font-family: var(--font-body);
          color: #475569;
        ">
          <strong style="color: #0f172a;">
            Perguntas respondidas por esta visualização:
          </strong>
          <span style="margin-left: 6px;">
            Como o volume de corridas mudou nos feriados?
          </span>
          <span style="margin-left: 10px;">
            Quando ocorreu o primeiro impacto?
          </span>
          <span style="margin-left: 10px;">
            Quando surgiu o primeiro sinal de retomada?
          </span>
        </div>
      </div>
    `;
  }
}