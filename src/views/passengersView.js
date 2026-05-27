import * as d3 from 'd3';
import { createBaseChart, addXAxisCaption, addYAxisCaption, styleDenseXAxis, addColorLegend, REGION_COLORS } from '../plot';

export function renderPassengersView(data) {
  const { svg, margin, width, height } = createBaseChart();
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const days = [...new Set(data.passengers.map((d) => d.dayLabel))];
  const regions = [...new Set(data.passengers.map((d) => d.region))];
  const x = d3.scalePoint().domain(days).range([0, width]).padding(0.5);
  const y = d3.scaleLinear().domain([0, d3.max(data.passengers, (d) => d.passengers)]).nice().range([height, 0]);
  const color = d3.scaleOrdinal().domain(regions).range(regions.map((r) => REGION_COLORS[r]));

  const byRegion = d3.groups(data.passengers, (d) => d.region);
  const line = d3.line().x((d) => x(d.dayLabel)).y((d) => y(d.passengers));

  byRegion.forEach(([region, values]) => {
    const sorted = values.sort((a, b) => a.dayISO.localeCompare(b.dayISO));
    g.append('path').datum(sorted).attr('fill', 'none').attr('stroke', color(region)).attr('stroke-width', 2.5).attr('d', line);
    g.selectAll(`.dot-${region}`).data(sorted).join('circle').attr('cx', (d) => x(d.dayLabel)).attr('cy', (d) => y(d.passengers)).attr('r', 4).attr('fill', color(region));
  });

  const xAxis = g.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x));
  styleDenseXAxis(xAxis);
  g.append('g').call(d3.axisLeft(y));
  addXAxisCaption(g, 'Feriados (2019-2022, eixo temporal)', width, height);
  addYAxisCaption(g, 'Passageiros totais em Manhattan');

  addColorLegend(svg, {
    title: 'Cores representam macro-regiões de origem em Manhattan',
    items: regions.map((r) => ({ label: r, color: color(r) })),
    x: margin.left,
    y: 26,
  });
}
