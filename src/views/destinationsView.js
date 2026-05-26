import * as d3 from 'd3';
import { createBaseChart, addXAxisCaption, addYAxisCaption, styleDenseXAxis } from '../plot';

export function renderDestinationsView(data) {
  const { svg, margin, width, height } = createBaseChart();
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const days = [...new Set(data.destinations.map((d) => d.dayLabel))];
  const topDestByDay = d3.rollups(
    data.destinations,
    (values) => values.sort((a, b) => b.trips - a.trips)[0],
    (d) => d.dayLabel,
  ).map(([, v]) => v).sort((a, b) => a.dayISO.localeCompare(b.dayISO));

  const x = d3.scaleBand().domain(days).range([0, width]).padding(0.15);
  const y = d3.scaleLinear().domain([0, d3.max(topDestByDay, (d) => d.trips)]).nice().range([height, 0]);
  const destinationLabels = [...new Set(topDestByDay.map((d) => d.destinationLabel))];
  const color = d3.scaleOrdinal().domain(destinationLabels).range(d3.schemeTableau10.concat(d3.schemeSet3));

  g.selectAll('rect').data(topDestByDay).join('rect')
    .attr('x', (d) => x(d.dayLabel)).attr('y', (d) => y(d.trips))
    .attr('width', x.bandwidth()).attr('height', (d) => height - y(d.trips))
    .attr('fill', (d) => color(d.destinationLabel));

  g.selectAll('text.val').data(topDestByDay).join('text')
    .attr('class', 'val').attr('x', (d) => x(d.dayLabel) + x.bandwidth() / 2)
    .attr('y', (d) => y(d.trips) - 6).attr('text-anchor', 'middle').attr('font-size', 10)
    .text((d) => d.destinationLabel.replace('Zona ', 'Z') + ` (${d.trips})`);

  const xAxis = g.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x));
  styleDenseXAxis(xAxis);
  g.append('g').call(d3.axisLeft(y));
  addXAxisCaption(g, 'Feriado (quando)', width, height);
  addYAxisCaption(g, 'Corridas para destino principal (o que)');

  const legend = svg.append('g').attr('transform', `translate(${margin.left},22)`);
  legend.append('text').attr('x', 0).attr('y', -8).attr('font-size', 11).attr('fill', '#374151')
    .text('Cor da barra = destino principal (onde). Rótulo no topo indica zona e volume.');
}
