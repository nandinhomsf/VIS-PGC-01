import * as d3 from 'd3';
import { createBaseChart, addXAxisCaption, addYAxisCaption, styleDenseXAxis, addColorLegend, SEMANTIC_COLORS } from '../plot';

export function renderImpactView(data) { renderHolidayTimeline(data, false); }
export function renderRecoveryView(data) { renderHolidayTimeline(data, true); }

function renderHolidayTimeline(data, recovery) {
  const { svg, margin, width, height } = createBaseChart();
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const series = [...data.holidaySeries].sort((a, b) => a.dayISO.localeCompare(b.dayISO));
  const baseline = d3.mean(series.filter((d) => d.dayISO <= '2020-02-17'), (d) => d.trips);
  const x = d3.scalePoint().domain(series.map((d) => d.dayLabel)).range([0, width]).padding(0.5);
  const y = d3.scaleLinear().domain([0, d3.max(series, (d) => d.trips)]).nice().range([height, 0]);

  const line = d3.line().x((d) => x(d.dayLabel)).y((d) => y(d.trips));
  g.append('path').datum(series).attr('fill', 'none').attr('stroke', SEMANTIC_COLORS.trips).attr('stroke-width', 2.5).attr('d', line);
  g.selectAll('circle').data(series).join('circle').attr('cx', (d) => x(d.dayLabel)).attr('cy', (d) => y(d.trips)).attr('r', 4).attr('fill', SEMANTIC_COLORS.trips);

  g.append('line').attr('x1', 0).attr('x2', width).attr('y1', y(baseline)).attr('y2', y(baseline)).attr('stroke', SEMANTIC_COLORS.baseline).attr('stroke-dasharray', '4,4');
  const xAxis = g.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x));
  styleDenseXAxis(xAxis);
  g.append('g').call(d3.axisLeft(y));
  addXAxisCaption(g, 'Feriado (quando)', width, height);
  addYAxisCaption(g, 'Corridas totais (o que)');

  const impact = series.find((d) => d.trips < baseline * 0.6);
  const recoveryPoint = series.find((d) => d.dayISO > (impact?.dayISO ?? '2020-03-01') && d.trips >= baseline * 0.9);
  const marker = recovery ? recoveryPoint : impact;

  if (marker) {
    const mx = x(marker.dayLabel), my = y(marker.trips);
    g.append('line').attr('x1', mx).attr('x2', mx).attr('y1', 0).attr('y2', height).attr('stroke', SEMANTIC_COLORS.marker).attr('stroke-dasharray', '3,3');
    g.append('circle').attr('cx', mx).attr('cy', my).attr('r', 6).attr('fill', SEMANTIC_COLORS.marker);
  }

  addColorLegend(svg, {
    title: 'Legenda de cores: interpretação visual',
    items: [
      { label: 'Série de corridas', color: SEMANTIC_COLORS.trips },
      { label: 'Linha de base pré-pandemia', color: SEMANTIC_COLORS.baseline },
      { label: recovery ? 'Marco de normalização' : 'Marco de impacto', color: SEMANTIC_COLORS.marker },
    ],
    x: margin.left,
    y: 26,
    itemGap: 230,
  });

  document.querySelector('#explanation').textContent = recovery
    ? `Primeiro feriado com normalização (>=90% da base): ${recoveryPoint?.dayLabel ?? 'não observado na janela de dados'}.`
    : `Primeiro feriado com impacto forte (<60% da base): ${impact?.dayLabel ?? 'não observado na janela de dados'}.`;
}
