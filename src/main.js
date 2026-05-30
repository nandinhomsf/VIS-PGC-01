import { Taxi } from "./taxi";
import {
  renderPassengersView,
  renderTipsView,
  renderDestinationsView,
  renderImpactView,
  renderRecoveryView,
  renderHolidayAcrossYearsPassengers,
  renderHolidayAcrossYearsTips,
  renderHolidayHeatmap,
} from "./views";

/**
 * Catálogo de visualizações disponíveis no painel.
 * Cada entrada define o identificador da aba, os textos exibidos na UI
 * (pergunta analítica e explicação metodológica) e a função de renderização.
 * A ordem aqui determina a ordem no menu dropdown.
 */
const views = [
  {
    id: "heatmap",
    title: "Heatmap de Feriados",
    question:
      "Como o volume total de corridas mudou nos feriados ao longo do período de 2019 a 2022 em Manhattan?",
    explanation:
      "Mapa de calor abstrato correlacionando Feriados × Anos. Cores quentes e intensas indicam volumes elevados, destacando claramente a queda em 2020 e a recuperação gradual subsequente.",
    render: renderHolidayHeatmap,
  },
  {
    id: "passengers",
    title: "Passageiros em Feriados",
    question:
      "Como o número de passageiros foi alterado em Manhattan durante o período inicial da pandemia em feriados?",
    explanation:
      "Linhas temporais mostrando o total de passageiros em cada feriado por macro-região de origem.",
    render: renderPassengersView,
  },
  {
    id: "tips",
    title: "Gorjetas em Feriados",
    question:
      "Como as gorjetas foram alteradas em Manhattan durante o período inicial da pandemia em feriados?",
    explanation:
      "Linhas temporais da variação da média de gorjetas em Manhattan por região.",
    render: renderTipsView,
  },
  {
    id: "destinations",
    title: "Destinos Principais",
    question:
      "Onde era o principal destino em Manhattan nos feriados no início da pandemia?",
    explanation:
      "Destaque para o destino mais frequente e volume de corridas por feriado.",
    render: renderDestinationsView,
  },
  {
    id: "impact",
    title: "Início do Impacto",
    question:
      "Quando as atividades foram impactadas pelo início da pandemia em Manhattan?",
    explanation:
      "Análise temporal marcando o início da queda drástica na mobilidade urbana em Manhattan.",
    render: renderImpactView,
  },
  {
    id: "recovery",
    title: "Normalização das Atividades",
    question:
      "Quando as atividades foram normalizadas pós-pandemia em Manhattan?",
    explanation:
      "Análise temporal marcando o feriado de retorno aos níveis pré-pandemia.",
    render: renderRecoveryView,
  },
  {
    id: "passengers-years",
    title: "Passageiros por Feriado (Comparação Anual)",
    question:
      "Como os passageiros variaram por tipo de feriado ao longo de 2019-2022 em Manhattan?",
    explanation:
      "Comparação anual por tipo de feriado com destaque para o ano crítico de 2020.",
    render: renderHolidayAcrossYearsPassengers,
  },
  {
    id: "tips-years",
    title: "Gorjetas por Feriado (Comparação Anual)",
    question:
      "Como as gorjetas variaram por tipo de feriado ao longo de 2019-2022 em Manhattan?",
    explanation:
      "Comparação anual por tipo de feriado destacando tendências ao longo do tempo.",
    render: renderHolidayAcrossYearsTips,
  },
];

// Cache global dos dados agregados, preenchido uma única vez no carregamento
let appData;

/**
 * Ponto de entrada da aplicação.
 * Monta o HTML do shell, inicializa o DuckDB, carrega e agrega os dados
 * e renderiza a primeira visualização. O indicador de status no rodapé
 * reflete o estado atual do carregamento para feedback ao usuário.
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
 * a função de renderização D3 correspondente, que limpa e redesenha o SVG.
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
 * O estado CSS (`loading`, `ready`, `error`) é aplicado como classe no elemento
 * para que as animações e cores correspondentes sejam ativadas via CSS.
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
