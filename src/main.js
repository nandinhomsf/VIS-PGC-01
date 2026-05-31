import { Taxi } from "./taxi";
import {
  renderHolidayHeatmap,
  renderHolidayTipsLineView,
  renderHolidayPaymentShareStackedBarsView,
  renderHolidayHourlyHistogramView,
} from "./views";

/**
 * Catálogo de visualizações disponíveis no painel.
 * Mantém a lógica original do seletor, com análises centradas em feriados,
 * pandemia e comportamento das corridas em Manhattan.
 */
const views = [
  {
    id: "heatmap",
    title: "Volume de Corridas em Feriados",
    question:
      "Como a pandemia afetou o volume de corridas de táxi em Manhattan durante os feriados entre 2019 e 2022?",
    explanation:
      "Mapa de calor comparando o volume de corridas de táxi em Manhattan nos principais feriados entre 2019 e 2022. Tons mais escuros indicam maior volume de corridas; as marcações destacam o primeiro feriado com queda acentuada em relação ao período pré-pandemia e o primeiro feriado com sinal de retomada.",
    render: renderHolidayHeatmap,
  },
  {
    id: "tips-line",
    title: "Gorjetas por Feriado e Ano",
    question:
      "Como a pandemia alterou o valor médio das gorjetas por corrida de táxi nos feriados em Manhattan?",
    explanation:
      "Comparação do valor médio das gorjetas por corrida em cada feriado, ano a ano. Cada painel representa um feriado, permitindo observar diferenças entre 2019, 2020, 2021 e 2022.",
    render: renderHolidayTipsLineView,
  },
  {
    id: "payment-share",
    title: "Formas de Pagamento em Feriados",
    question:
      "Como a pandemia alterou a distribuição das formas de pagamento das corridas de táxi nos feriados em Manhattan?",
    explanation:
      "Barras empilhadas percentuais mostrando a composição das formas de pagamento em cada feriado ao longo dos anos. A visualização considera apenas Flex Fare, cartão de crédito e dinheiro.",
    render: renderHolidayPaymentShareStackedBarsView,
  },
  {
    id: "hourly-histogram",
    title: "Uso de Táxi por Hora nos Feriados",
    question:
      "A pandemia mudou os horários em que as pessoas usavam táxi nos feriados em Manhattan?",
    explanation:
      "Histograma por hora. Cada painel representa um feriado e, dentro de cada painel, cada linha representa um ano. A altura das barras indica o número de corridas em cada hora do dia.",
    render: renderHolidayHourlyHistogramView,
  },
];

// Cache global dos dados agregados, preenchido uma única vez no carregamento.
let appData;

/**
 * Ponto de entrada da aplicação.
 * Monta o HTML do shell, inicializa o DuckDB, carrega e agrega os dados
 * e renderiza a primeira visualização disponível no seletor.
 */
window.addEventListener("load", async () => {
  document.body.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand">
          <div class="brand-logo">🚕</div>
          <h1>TaxiVis — Manhattan &amp; Feriados (2019-2022)</h1>
        </div>

        <div class="select-container">
          <select id="viewSelect"></select>
        </div>
      </header>
      
      <main class="panel">
        <div class="panel-header">
          <h2 id="question"></h2>
          <p id="explanation"></p>
        </div>

        <div class="chart-wrapper">
          <div id="chart"></div>
        </div>
      </main>
      
      <footer id="status">
        <span class="status-dot"></span>
        <span class="status-text">Inicializando...</span>
      </footer>
    </div>
  `;

  setStatus("Carregando e processando dados (DuckDB)...", "loading");

  try {
    const taxi = new Taxi();
    await taxi.init();

    appData = await taxi.loadAndAggregate();

    fillMenu();
    switchView(views[0].id);

    setStatus("Pronto para visualização.", "ready");
  } catch (error) {
    console.error(error);
    setStatus(`Erro ao carregar dados: ${error.message}`, "error");
  }
});

/**
 * Popula o dropdown com as opções de visualização e registra o listener
 * que troca a view ativa quando o usuário seleciona uma nova opção.
 */
function fillMenu() {
  const select = document.querySelector("#viewSelect");

  select.innerHTML = views
    .map((v) => `<option value="${v.id}">${v.title}</option>`)
    .join("");

  select.addEventListener("change", (e) => switchView(e.target.value));
}

/**
 * Troca a visualização ativa: atualiza os textos do painel e invoca
 * a função de renderização D3 correspondente.
 */
function switchView(id) {
  const view = views.find((v) => v.id === id);
  if (!view) return;

  document.querySelector("#question").innerHTML =
    `<span class="question-badge">Pergunta</span> ${view.question}`;

  document.querySelector("#explanation").textContent = view.explanation;

  view.render(appData);
}

/**
 * Atualiza o indicador de status no rodapé da aplicação.
 */
function setStatus(text, state = "ready") {
  const statusEl = document.querySelector("#status");
  if (!statusEl) return;

  const dot = statusEl.querySelector(".status-dot");
  const txt = statusEl.querySelector(".status-text");

  if (dot && txt) {
    txt.textContent = text;
    statusEl.className = `status-${state}`;
  }
}