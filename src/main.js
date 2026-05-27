import { Taxi } from './taxi';
import { renderPassengersView } from './views/passengersView';
import { renderTipsView } from './views/tipsView';
import { renderDestinationsView } from './views/destinationsView';
import { renderImpactView, renderRecoveryView } from './views/timelineView';
import { renderHolidayAcrossYearsPassengers, renderHolidayAcrossYearsTips } from './views/holidayAcrossYearsView';

// Main minimalista: só orquestra abas + dados + textos.
const views = [
  { id: 'passengers', title: 'Passageiros em feriados', question: 'Como o número de passageiros foi alterado em Manhattan durante o período inicial da pandemia em feriados?', explanation: 'Barras para comparar magnitude entre feriados.', render: renderPassengersView },
  { id: 'tips', title: 'Gorjetas em feriados', question: 'Como as gorjetas foram alteradas em Manhattan durante o período inicial da pandemia em feriados?', explanation: 'Barras para comparar variação de média de gorjeta.', render: renderTipsView },
  { id: 'destinations', title: 'Destinos principais', question: 'Onde era o principal destino em Manhattan nos feriados no início da pandemia?', explanation: 'Heatmap dia × destino para identificar o destino principal em cada feriado.', render: renderDestinationsView },
  { id: 'impact', title: 'Início do impacto', question: 'Quando as atividades foram impactadas pelo início da pandemia em Manhattan?', explanation: '', render: renderImpactView },
  { id: 'recovery', title: 'Normalização', question: 'Quando as atividades foram normalizadas pós-pandemia em Manhattan?', explanation: '', render: renderRecoveryView },
  { id: 'passengers-years', title: 'Passageiros por tipo de feriado (anos)', question: 'Como os passageiros variaram por tipo de feriado ao longo de 2019-2022 em Manhattan?', explanation: 'Comparação anual por tipo de feriado com destaque visual para 2020.', render: renderHolidayAcrossYearsPassengers },
  { id: 'tips-years', title: 'Gorjetas por tipo de feriado (anos)', question: 'Como as gorjetas variaram por tipo de feriado ao longo de 2019-2022 em Manhattan?', explanation: 'Comparação anual por tipo de feriado com destaque visual para 2020.', render: renderHolidayAcrossYearsTips },
];

let appData;

window.addEventListener('load', async () => {
  document.body.innerHTML = `<div class="app-shell"><header class="topbar"><h1>TaxiVis — Manhattan, feriados (2019-2022) e pandemia</h1><select id="viewSelect"></select></header><section class="panel"><p id="question"></p><p id="explanation"></p><div id="chart"></div></section><footer id="status"></footer></div>`;
  setStatus('Carregando dados...');
  const taxi = new Taxi();
  await taxi.init();
  appData = await taxi.loadAndAggregate();
  fillMenu();
  switchView(views[0].id);
  setStatus('Pronto.');
});

function fillMenu() {
  const select = document.querySelector('#viewSelect');
  select.innerHTML = views.map((v) => `<option value="${v.id}">${v.title}</option>`).join('');
  select.addEventListener('change', (e) => switchView(e.target.value));
}

function switchView(id) {
  const view = views.find((v) => v.id === id);
  if (!view) return;
  document.querySelector('#question').textContent = `Pergunta: ${view.question}`;
  document.querySelector('#explanation').textContent = view.explanation;
  view.render(appData);
}

function setStatus(text) {
  document.querySelector('#status').textContent = text;
}
