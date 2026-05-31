import { Taxi } from "./taxi";
import {
  renderHolidayHeatmap,
  renderHolidayTipsLineView,
  renderHolidayPaymentShareStackedBarsView,
  renderHolidayHourlyHistogramView,
} from "./views";

/**
 * Catálogo central das visualizações disponíveis no dashboard.
 *
 * Cada item descreve uma visualização de forma declarativa:
 * - `id`: identificador usado pelo seletor para trocar de gráfico;
 * - `title`: texto exibido no dropdown;
 * - `question`: pergunta analítica mostrada no painel;
 * - `explanation`: descrição breve da visualização;
 * - `render`: função D3 responsável por desenhar o gráfico no container.
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

/**
 * Cache global dos dados agregados.
 *
 * Os arquivos Parquet são carregados e processados apenas uma vez pela classe Taxi.
 * Depois disso, cada visualização reutiliza o mesmo objeto `appData`.
 *
 * Essa decisão evita repetir queries pesadas no DuckDB sempre que o usuário muda
 * a opção no seletor. A troca de view redesenha apenas o gráfico, mas não recarrega
 * os dados.
 * 
 * Decisão tomada para aumentar a interatividade após espera inicial.
 * Ponto de otimização futura.
 */
let appData;

/**
 * Ponto de entrada da aplicação.
 *
 * O evento `load` garante que a página já está pronta antes de o JavaScript
 * substituir o conteúdo do `body`. A aplicação monta a interface inteira
 * dinamicamente para manter o HTML base simples e centralizar a estrutura 
 */
window.addEventListener("load", async () => {
  /**
   * Shell principal da aplicação.
   *
   * A estrutura contém:
   * - header com título e seletor de visualização;
   * - painel central com pergunta, explicação e container do gráfico;
   * - rodapé com status de carregamento.
   *
   * As visualizações D3 usam o mesmo container `#chart`. Por isso, ao trocar
   * de gráfico, a função de renderização correspondente limpa e redesenha o
   * conteúdo dentro desse mesmo espaço.
   */
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
    /**
     * Inicialização da camada de dados.
     *
     * A classe Taxi encapsula a conexão com o DuckDB e as queries de
     *  agregação usadas pelas views.
     */
    const taxi = new Taxi();
    await taxi.init();

    /**
     * Carrega e agrega todos os dados necessários ao dashboard.
     *
     * O resultado fica salvo em `appData` para que as visualizações possam ser
     * trocadas sem novo carregamento dos arquivos.
     */
    appData = await taxi.loadAndAggregate();

    /**
     * Depois que os dados estão prontos, o seletor é preenchido e a primeira
     * visualização do catálogo é renderizada automaticamente.
     *
     * A primeira posição do array `views` funciona como visualização inicial.
     */
    fillMenu();
    switchView(views[0].id);

    setStatus("Pronto para visualização.", "ready");
  } catch (error) {
    /**
     * Qualquer erro de carregamento ou processamento aparece no rodapé.
     * O `console.error` mantém o erro completo disponível para depuração.
     */
    console.error(error);
    setStatus(`Erro ao carregar dados: ${error.message}`, "error");
  }
});

/**
 * Preenche o dropdown com as visualizações cadastradas em `views`.
 *
 */
function fillMenu() {
  const select = document.querySelector("#viewSelect");

  select.innerHTML = views
    .map((v) => `<option value="${v.id}">${v.title}</option>`)
    .join("");

  /**
   * Quando o usuário muda a opção no seletor, chamamos `switchView`.
   * A função recebe o `id` da view escolhida e decide qual gráfico renderizar.
   */
  select.addEventListener("change", (e) => switchView(e.target.value));
}

/**
 * Troca a visualização ativa.
 *
 * Essa função tem 3 partes:
 * 1. localiza a view pelo `id`;
 * 2. atualiza a pergunta e a explicação exibidas no painel;
 * 3. chama a função D3 responsável por desenhar o gráfico.
 *
 * A lógica de desenho fica isolada nas funções `render...`, enquanto esta
 * função cuida apenas da navegação entre visualizações e da atualização do DOM.
 */
function switchView(id) {
  const view = views.find((v) => v.id === id);
  if (!view) return;

  /**
   * A pergunta usa `innerHTML` porque inclui o badge visual "Pergunta".
   * O texto da pergunta vem do catálogo de views.
   */
  document.querySelector("#question").innerHTML =
    `<span class="question-badge">Pergunta</span> ${view.question}`;

  /**
   * A explicação usa `textContent` para inserir apenas texto simples.
   * Algumas views podem sobrescrever esse conteúdo depois, caso tenham um
   * resumo dinâmico calculado a partir dos dados.
   */
  document.querySelector("#explanation").textContent = view.explanation;

  /**
   * Renderiza a visualização selecionada usando os dados já carregados.
   * Cada função de renderização é responsável por limpar o container do gráfico
   * e criar seus próprios elementos SVG, escalas, eixos, legendas e tooltips.
   */
  view.render(appData);
}

/**
 * Atualiza o indicador de status no rodapé da aplicação.
 *
 * O texto descreve o estado atual para o usuário, enquanto a classe CSS
 * `status-loading`, `status-ready` ou `status-error` permite mudar a aparência
 * visual do rodapé e do ponto de status.
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