import * as d3 from "d3";
import { createBaseChart } from "../utils/chart";

/**
 * Mapeamento dos feriados usados na visualização.
 *
 * O `id` precisa corresponder ao nome canônico gerado na etapa de agregação
 * dos dados. O `label` é o texto exibido no painel, e `dateRule` informa
 * a data fixa ou a regra de ocorrência do feriado.
 *
 * A ordem deste array também define a posição dos painéis no grid.
 
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
 * Anos analisados.
 *
 * Manter esse domínio fixo garante que todos os feriados tenham o mesmo eixo X,
 * mesmo quando algum ano não possui dados para determinado feriado.
 */
const YEAR_DOMAIN = [2019, 2020, 2021, 2022];

/**
 * Renderiza a visualização de gorjetas médias por feriado e ano.
 *
 * A escolha por pequenos múltiplos evita colocar todos os feriados em uma única
 * linha temporal, o que deixaria o gráfico poluído. Assim, cada feriado tem seu
 * próprio painel, mas todos compartilham a mesma escala vertical, permitindo
 * comparação entre eles.
 */
export function renderHolidayTipsLineView(data) {
  const { svg } = createBaseChart();

  /**
   * Margens gerais da visualização.
   *
   * A margem superior reserva espaço para a legenda. A margem inferior acomoda
   * os eixos X dos painéis da última linha.
   */
  const margin = { top: 72, right: 48, bottom: 72, left: 70 };
  const width = 1120 - margin.left - margin.right;
  const height = 660 - margin.top - margin.bottom;

  /**
   * Grupo principal deslocado pelas margens.
   *
   * A partir daqui, o grid de painéis é desenhado em coordenadas locais,
   * começando em (0, 0).
   */
  const root = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  /**
   * Prepara os pontos válidos da série.
   *
   * Cada ponto representa um feriado em um ano específico. A métrica principal
   * é `avg_tip`, isto é, a gorjeta média por corrida.
   *
   * Também adicionamos rótulos legíveis do feriado para não repetir essa busca
   * em todas as etapas da renderização.
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

  /**
   * Índice por feriado e ano.
   *
   * Esse Map permite recuperar rapidamente o dado de uma combinação específica,
   * como "Christmas_2020", sem precisar procurar no array inteiro.
   */
  const dataMap = new Map();
  points.forEach((d) => {
    dataMap.set(`${d.holidayName}_${d.year}`, d);
  });

  /**
   * Monta uma série completa para cada feriado.
   *
   * Mesmo quando um ano não possui dado, criamos um item com valores nulos.
   * Isso mantém o eixo temporal 2019–2022 sempre visível em todos os painéis.
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

  /**
   * Maior gorjeta média observada.
   *
   * Esse valor define a escala Y global. Usar uma escala global, e não uma escala
   * separada por painel, permite comparar os níveis de gorjeta entre feriados.
   */
  const maxTip = d3.max(points, (d) => d.avg_tip) || 1;

  /**
   * Layout em pequenos múltiplos: 3 colunas × 3 linhas.
   *
   * Como há nove feriados, essa divisão coloca exatamente um feriado por painel.
   */
  const cols = 3;
  const rows = 3;
  const panelWidth = width / cols;
  const panelHeight = height / rows;

  /**
   * Margens internas de cada painel.
   *
   * O topo acomoda o título e a regra/data do feriado. A esquerda acomoda o eixo
   * Y compacto com os valores de gorjeta.
   */
  const innerMargin = { top: 48, right: 18, bottom: 34, left: 44 };
  const innerWidth = panelWidth - innerMargin.left - innerMargin.right;
  const innerHeight = panelHeight - innerMargin.top - innerMargin.bottom;

  /**
   * Escala X dos anos.
   *
   * `scalePoint` é adequada aqui porque os anos são pontos discretos, não faixas.
   * O padding evita que os pontos de 2019 e 2022 fiquem colados nas bordas.
   */
  const x = d3
    .scalePoint()
    .domain(YEAR_DOMAIN)
    .range([0, innerWidth])
    .padding(0.45);

  /**
   * Escala Y da gorjeta média.
   *
   * O domínio começa em zero para facilitar a leitura da magnitude. O multiplicador
   * 1.12 cria um pequeno respiro acima do maior ponto.
   */
  const y = d3
    .scaleLinear()
    .domain([0, maxTip * 1.12])
    .range([innerHeight, 0])
    .nice();

  /**
   * Cores da visualização.
   *
   * A série de gorjetas usa verde/teal para manter harmonia com o restante do
   * dashboard e com a paleta do heatmap. O ano de 2020 usa âmbar/marrom, a cor
   * de destaque já usada nas outras views para facilitar a comparação visual
   * com o período inicial da pandemia.
   */
  const surfaceColor = "#f8fafc";
  const panelBorder = "rgba(15, 23, 42, 0.08)";
  const tipLineColor = "#0f766e";
  const tipPointColor = "#14b8a6";
  const highlightYearColor = "#92400e";
  const textPrimary = "#0f172a";
  const textSecondary = "#475569";
  const gridColor = "#e2e8f0";

  /**
   * Gerador da linha temporal.
   *
   * `.defined(...)` faz a linha ignorar anos sem dados, evitando que valores
   * nulos sejam tratados como zero. A curva monotônica suaviza a linha sem criar
   * oscilações artificiais entre os anos.
   */
  const line = d3
    .line()
    .defined((d) => Number.isFinite(d.avg_tip))
    .x((d) => x(d.year))
    .y((d) => y(d.avg_tip))
    .curve(d3.curveMonotoneX);

  /**
   * Tooltip único compartilhado pela visualização.
   *
   * O padrão `data([null]).join("div")` garante que apenas um tooltip exista no
   * DOM, mesmo quando a view é renderizada várias vezes ao trocar de gráfico.
   */
  const tooltip = d3
    .select("body")
    .selectAll(".chart-tooltip")
    .data([null])
    .join("div")
    .attr("class", "chart-tooltip");

  /**
   * Cria um painel para cada feriado.
   *
   * O índice `i` define a posição do painel no grid 3×3.
   */
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

  /**
   * Fundo de cada painel.
   *
   * O retângulo arredondado cria a aparência de card e separa visualmente os
   * feriados dentro do grid.
   */
  panels
    .append("rect")
    .attr("x", 8)
    .attr("y", 4)
    .attr("width", panelWidth - 16)
    .attr("height", panelHeight - 12)
    .attr("rx", 14)
    .attr("fill", surfaceColor)
    .attr("stroke", panelBorder);

  /**
   * Título do feriado.
   */
  panels
    .append("text")
    .attr("x", 18)
    .attr("y", 22)
    .attr("fill", textPrimary)
    .attr("font-size", 13)
    .attr("font-weight", 800)
    .text((d) => d.label);

  /**
   * Data fixa ou regra de ocorrência do feriado.
   */
  panels
    .append("text")
    .attr("x", 18)
    .attr("y", 39)
    .attr("fill", textSecondary)
    .attr("font-size", 10.5)
    .attr("font-weight", 600)
    .text((d) => d.dateRule);

  /**
   * Área interna do gráfico dentro de cada painel.
   *
   * Esse deslocamento evita que a linha e os eixos fiquem sobrepostos ao título.
   */
  const plot = panels
    .append("g")
    .attr("transform", `translate(${innerMargin.left},${innerMargin.top})`);

  /**
   * Faixa vertical em 2020.
   *
   * A marcação fica atrás da linha e dos pontos. Ela chama atenção para o ano
   * de impacto inicial sem esconder os valores.
   */
  plot
    .append("rect")
    .attr("x", x(2020) - 18)
    .attr("y", 0)
    .attr("width", 36)
    .attr("height", innerHeight)
    .attr("rx", 6)
    .attr("fill", "rgba(146, 64, 14, 0.08)");

  /**
   * Grade horizontal leve.
   *
   * A grade ajuda a comparar alturas entre os pontos, mas usa traços discretos
   * para não competir com a linha de dados.
   */
  plot
    .append("g")
    .call(d3.axisLeft(y).ticks(3).tickSize(-innerWidth).tickFormat(""))
    .selectAll("line")
    .attr("stroke", gridColor)
    .attr("stroke-dasharray", "3,3");

  plot.selectAll(".domain").remove();

  /**
   * Linha temporal da gorjeta média.
   *
   * Cada painel recebe sua própria linha, construída a partir dos quatro anos
   * daquele feriado.
   */
  plot
    .append("path")
    .attr("fill", "none")
    .attr("stroke", tipLineColor)
    .attr("stroke-width", 2.4)
    .attr("stroke-linecap", "round")
    .attr("stroke-linejoin", "round")
    .attr("d", (d) => line(d.values));

  /**
   * Pontos anuais.
   *
   * Os pontos reforçam os valores exatos de cada ano e funcionam como alvos
   * de interação para o tooltip.
   */
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

  /**
   * Eixo X de cada painel.
   *
   * Mostra os anos como inteiros. O texto de 2020 recebe a cor de destaque para
   * reforçar a marcação visual da faixa vertical.
   */
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

  /**
   * Eixo Y compacto.
   *
   * Como os painéis são pequenos, usamos poucos ticks. O prefixo `$` indica que
   * os valores representam dólares.
   */
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
   *
   * A legenda explica a cor principal da série e o destaque aplicado a 2020.
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
   *
   * A média anual é ponderada pelo número de corridas. Isso evita calcular uma
   * média simples entre feriados com volumes muito diferentes.
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