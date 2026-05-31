import * as d3 from "d3";
import { createBaseChart } from "../utils/chart";

/**
 * Mapeamento dos feriados usados na análise.
 *
 * O `id` precisa bater com o nome canônico gerado na camada de dados.
 * O `label` é o nome exibido no painel.
 * O `dateRule` aparece no cabeçalho de cada subgráfico, ajudando o leitor
 * a entender quando aquele feriado ocorre.
 *
 * A ordem deste array também define a ordem dos painéis no grid.
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
 * Anos comparados nas visualizações.
 *
 * A ordem é fixa para manter consistência
 * 
 * Ponto de melhoria futura: extrair dinamicamente dos dados.
 */
const YEAR_DOMAIN = [2019, 2020, 2021, 2022];

/**
 * Palheta por ano.
 *
 * A cor âmbar/marrom destaca 2020, ano de impacto inicial da pandemia.
 * Os demais anos usam o mesmo verde
 *
 */
const YEAR_STYLES = {
  2019: { color: "#238b45", label: "2019" },
  2020: { color: "#92400e", label: "2020" },
  2021: { color: "#238b45", label: "2021" },
  2022: { color: "#238b45", label: "2022" },
};

/**
 * Renderiza a visualização de histogramas horários.
 *
 * Cada painel representa um feriado.
 * Dentro de cada painel, cada linha representa um ano.
 * Cada barra representa o volume de corridas em uma hora do dia.
 *
 * A ideia é responder se a pandemia alterou não apenas o número de corridas,
 * mas principalmente o momento do dia em que as corridas aconteceram.
 */
export function renderHolidayHourlyHistogramView(data) {
  const { svg } = createBaseChart();

  /**
   * Este gráfico usa altura um pouco maior que o padrão porque ele contém
   * 9 pequenos múltiplos, e cada painel ainda precisa acomodar 4 histogramas
   * pequenos, um para cada ano.
   */
  const margin = { top: 82, right: 48, bottom: 64, left: 70 };
  const width = 1120 - margin.left - margin.right;
  const height = 720 - margin.top - margin.bottom;

  /**
   * Grupo principal deslocado pelas margens.
   *
   * A partir daqui, os elementos do gráfico são desenhados em coordenadas locais,
   * começando em (0, 0), enquanto as margens ficam reservadas para legenda,
   * respiro visual e eventuais rótulos.
   */
  const root = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  /**
   * Filtra os registros horários válidos.
   *
   * A hora precisa estar entre 0 e 23, e `trips` precisa ser numérico.
   * Esse filtro evita que valores ausentes ou inconsistentes entrem na montagem
   * dos histogramas.
   */
  const rawRows = (data.holidayHourlyByYear || []).filter(
    (d) =>
      Number.isFinite(d.pickup_hour) &&
      d.pickup_hour >= 0 &&
      d.pickup_hour <= 23 &&
      Number.isFinite(d.trips),
  );

  /**
   * Índice por feriado, ano e hora.
   *
   * Em vez de procurar no array inteiro a cada célula do histograma, criamos
   * um Map com chave composta. Isso facilita montar a estrutura completa
   * 9 feriados × 4 anos × 24 horas.
   */
  const dataMap = new Map();

  rawRows.forEach((d) => {
    dataMap.set(`${d.holidayName}_${d.year}_${d.pickup_hour}`, d);
  });

  /**
   * Monta os dados no formato exigido pela visualização.
   *
   * Cada painel contém:
   * - dados do feriado;
   * - uma lista de anos;
   * - para cada ano, 24 bins horários.
   *
   * Mesmo que determinada hora não tenha corridas, criamos o bin com `trips = 0`.
   * Isso mantém todos os histogramas com a mesma estrutura e evita buracos no eixo.
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

      /**
       * Total e pico do ano dentro daquele feriado.
       *
       * O total é usado no tooltip e no resumo.
       * O pico ajuda a calcular a escala vertical das barras dentro do painel.
       */
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

      /**
       * Maior valor horário do painel inteiro.
       *
       * Usar um máximo por painel, e não por linha/ano, permite comparar os
       * quatro anos dentro do mesmo feriado. Se cada ano tivesse sua própria
       * escala vertical, todas as linhas pareceriam igualmente altas, escondendo
       * diferenças de volume.
       */
      panelMaxTrips: d3.max(years, (d) => d.peak) || 1,
    };
  });

  /**
   * Layout em pequenos múltiplos.
   *
   * O gráfico é organizado em 3 colunas × 3 linhas, um painel por feriado.
   * Isso evita misturar todos os feriados em um único gráfico e facilita comparar
   * padrões horários dentro de cada feriado.
   */
  const cols = 3;
  const rows = 3;
  const panelWidth = width / cols;
  const panelHeight = height / rows;

  /**
   * Margens internas de cada painel.
   *
   * A margem esquerda interna foi aumentada para acomodar os rótulos dos anos
   * dentro de cada subgráfico, sem que eles escapem para fora dos cards.
   */
  const innerMargin = { top: 50, right: 18, bottom: 32, left: 54 };
  const innerWidth = panelWidth - innerMargin.left - innerMargin.right;
  const innerHeight = panelHeight - innerMargin.top - innerMargin.bottom;

  /**
   * Escala categórica das 24 horas.
   *
   * `scaleBand` é usada porque cada hora ocupa uma barra discreta no histograma.
   * O padding cria um pequeno espaço entre barras adjacentes.
   */
  const x = d3
    .scaleBand()
    .domain(d3.range(24))
    .range([0, innerWidth])
    .padding(0.1);

  /**
   * Escala auxiliar contínua para o eixo X.
   *
   * As barras usam `scaleBand`, mas o eixo com marcações em 0h, 6h, 12h, 18h
   * e 23h fica mais simples com uma escala linear. O range é alinhado ao centro
   * da primeira e da última barra para que os ticks coincidam visualmente com
   * as horas.
   */
  const xLine = d3
    .scaleLinear()
    .domain([0, 23])
    .range([x(0) + x.bandwidth() / 2, x(23) + x.bandwidth() / 2]);

  /**
   * Escala vertical das linhas de ano dentro de cada painel.
   *
   * Cada ano recebe uma faixa vertical. Dentro dessa faixa, desenhamos uma linha
   * de base e o histograma correspondente.
   */
  const yRow = d3
    .scaleBand()
    .domain(YEAR_DOMAIN)
    .range([0, innerHeight])
    .padding(0.28);

  /**
   * Altura útil de cada mini-histograma.
   *
   * A barra não ocupa a faixa inteira do ano para deixar espaço para a linha
   * de base e para evitar colisão entre anos próximos.
   */
  const rowChartHeight = yRow.bandwidth() * 0.72;

  /**
   * Posição da linha de base dentro de cada faixa anual.
   *
   * As barras crescem para cima a partir dessa linha, como em um histograma
   * convencional.
   */
  const rowBaseline = yRow.bandwidth() * 0.84;

  /**
   * Cores de fundo, texto e grade.
   *
   * Os fundos claros e bordas suaves seguem a linguagem visual das demais views.
   * A grade é propositalmente discreta: ela ajuda na leitura das horas, mas não
   * deve competir com as barras coloridas.
   */
  const surfaceColor = "#f8fafc";
  const panelBorder = "rgba(15, 23, 42, 0.08)";
  const textPrimary = "#0f172a";
  const textSecondary = "#475569";
  const gridColor = "#e2e8f0";
  const rowLineColor = "#cbd5e1";

  /**
   * Tooltip único da visualização.
   *
   * O padrão com `data([null]).join("div")` garante que exista apenas um tooltip
   * no DOM, mesmo que a view seja renderizada várias vezes ao trocar de gráfico.
   */
  const tooltip = d3
    .select("body")
    .selectAll(".chart-tooltip")
    .data([null])
    .join("div")
    .attr("class", "chart-tooltip");

  /**
   * Criação dos painéis.
   *
   * Cada grupo `g.hourly-panel` é deslocado para sua posição no grid.
   * O cálculo usa o índice do painel para descobrir coluna e linha.
   */
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

  /**
   * Fundo de cada painel.
   *
   * O retângulo cria a aparência de card, separando visualmente os feriados.
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
   * Título do feriado no painel.
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
   * Regra/data do feriado.
   *
   * Esta segunda linha ajuda a interpretar feriados móveis, como Memorial Day
   * ou Thanksgiving, sem ocupar espaço no eixo.
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
   * Grupo interno de desenho de cada painel.
   *
   * O deslocamento interno reserva espaço para título, data/regra e rótulos
   * dos anos.
   */
  const plot = panels
    .append("g")
    .attr("transform", `translate(${innerMargin.left},${innerMargin.top})`);

  /**
   * Grade vertical de referência para as horas.
   *
   * Marcamos 0h, 6h, 12h, 18h e 23h. Essas marcas são suficientes para orientar
   * a leitura sem transformar cada painel pequeno em um eixo carregado demais.
   */
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

  /**
   * Grupos de ano dentro de cada painel.
   *
   * Cada grupo representa uma linha horizontal: 2019, 2020, 2021 ou 2022.
   */
  const yearGroups = plot
    .selectAll("g.year-row")
    .data((d) => d.years)
    .join("g")
    .attr("class", "year-row")
    .attr("transform", (d) => `translate(0,${yRow(d.year)})`);

  /**
   * Linha de base do histograma.
   *
   * Ela indica de onde as barras começam a crescer. Isso ajuda a separar
   * visualmente as linhas de cada ano.
   */
  yearGroups
    .append("line")
    .attr("x1", 0)
    .attr("x2", innerWidth)
    .attr("y1", rowBaseline)
    .attr("y2", rowBaseline)
    .attr("stroke", rowLineColor)
    .attr("stroke-width", 1);

  /**
   * Rótulo do ano.
   *
   * A cor do rótulo é a mesma usada nas barras daquele ano, reforçando a ligação
   * entre a legenda, o rótulo e o histograma.
   */
  yearGroups
    .append("text")
    .attr("x", -10)
    .attr("y", rowBaseline + 4)
    .attr("text-anchor", "end")
    .attr("fill", (d) => YEAR_STYLES[d.year]?.color ?? textSecondary)
    .attr("font-size", 10)
    .attr("font-weight", 700)
    .text((d) => d.year);

  /**
   * Barras dos histogramas por hora.
   *
   * Aqui usamos `each` porque a escala vertical das barras depende do painel
   * inteiro. Dentro de um mesmo feriado, os quatro anos compartilham o mesmo
   * máximo (`panelMaxTrips`), permitindo comparação direta entre anos naquele
   * feriado.
   */
  yearGroups.each(function (yearData) {
    const panelData = d3.select(this.parentNode).datum();

    /**
     * Escala vertical local do painel.
     *
     * O domínio vai de 0 ao maior pico horário daquele feriado. O range vai de
     * 0 até a altura disponível para as barras dentro de cada linha anual.
     */
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
        /**
         * No hover, aumentamos a opacidade para destacar a barra sob o cursor.
         */
        d3.select(this).attr("opacity", 1);

        const nextHour =
          d.hour === 23
            ? "24:00"
            : `${String(d.hour + 1).padStart(2, "0")}:00`;

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
            <span class="tooltip-val">${String(d.hour).padStart(
              2,
              "0",
            )}:00–${nextHour}</span>
          </div>
          <div class="tooltip-row tooltip-divider">
            <span class="tooltip-label">Corridas:</span>
            <span class="tooltip-val highlight">${d.trips.toLocaleString(
              "pt-BR",
            )}</span>
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
        /**
         * O tooltip segue o cursor, com um pequeno deslocamento para não ficar
         * exatamente embaixo do mouse.
         */
        tooltip
          .style("left", event.pageX + 16 + "px")
          .style("top", event.pageY - 28 + "px");
      })
      .on("mouseout", function () {
        d3.select(this).attr("opacity", 0.88);
        tooltip.style("opacity", 0);
      });
  });

  /**
   * Eixo X compacto de cada painel.
   *
   * Como cada painel é pequeno, exibimos apenas alguns horários de referência.
   * Isso mantém a leitura geral sem poluir o gráfico com 24 rótulos.
   */
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
   *
   * As cores da legenda são as mesmas usadas nos rótulos e nas barras.
   * Isso reforça a associação visual entre ano e cor.
   */
  const legend = svg
    .append("g")
    .attr("transform", `translate(${margin.left},28)`);

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
   *
   * Para cada ano, agregamos todos os feriados e calculamos qual hora teve mais
   * corridas no conjunto. Esse resumo ajuda o usuário a ter uma leitura global
   * antes de investigar os painéis individuais.
   */
  const explanationEl = document.querySelector("#explanation");

  if (explanationEl) {
    const yearlySummary = YEAR_DOMAIN.map((year) => {
      const rows = rawRows.filter((d) => d.year === year);
      const total = d3.sum(rows, (d) => d.trips);

      /**
       * Agrupa as corridas por hora, somando todos os feriados daquele ano.
       */
      const tripsByHour = d3.rollup(
        rows,
        (v) => d3.sum(v, (d) => d.trips),
        (d) => d.pickup_hour,
      );

      /**
       * Encontra a hora com maior volume agregado naquele ano.
       */
      const peakHour = d3.greatest(
        d3.range(24),
        (hour) => tripsByHour.get(hour) || 0,
      );

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
                pico em ${hourLabel} · ${d.total.toLocaleString(
                  "pt-BR",
                )} corridas
              </span>
            `;
          })
          .join("")}
      </div>
    `;
  }
}