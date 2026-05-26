import * as d3 from 'd3';
import { createBaseChart, addXAxisCaption, addYAxisCaption, addColorLegend, REGION_COLORS } from '../plot';

export function renderHolidayAcrossYearsPassengers(data) {
  renderAcrossYears(data.passengers, 'passengers', 'Passageiros totais', 'Como os passageiros mudaram por tipo de feriado ao longo dos anos?');
}

export function renderHolidayAcrossYearsTips(data) {
  renderAcrossYears(data.tips, 'avg_tip', 'Gorjeta média (USD)', 'Como as gorjetas mudaram por tipo de feriado ao longo dos anos?');
}

function renderAcrossYears(rows, metric, yLabel, subtitle) {
  const { svg, margin, width, height } = createBaseChart();
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const holidayNames = [...new Set(rows.map((d) => d.holidayName))];
  const years = [...new Set(rows.map((d) => d.year))].sort((a, b) => a - b);
  const x = d3.scalePoint().domain(holidayNames).range([0, width]).padding(0.5);
  const y = d3.scaleLinear().domain([0, d3.max(rows, (d) => d[metric])]).nice().range([height, 0]);
  const regionOrder = ['Downtown', 'Midtown', 'Uptown'];

  years.forEach((year) => {
    regionOrder.forEach((region) => {
      const series = rows.filter((d) => d.year === year && d.region === region)
        .sort((a, b) => holidayNames.indexOf(a.holidayName) - holidayNames.indexOf(b.holidayName));
      g.append('path').datum(series)
        .attr('fill', 'none')
        .attr('stroke', REGION_COLORS[region])
        .attr('stroke-width', year === 2020 ? 3.5 : 1.7)
        .attr('stroke-opacity', year === 2020 ? 0.95 : 0.35)
        .attr('d', d3.line().x((d) => x(d.holidayName)).y((d) => y(d[metric])));
    });
  });

  const xAxis = g.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x));
  xAxis.selectAll('text').attr('text-anchor', 'end').attr('transform', 'rotate(-35)').attr('font-size', 11).attr('dx', '-0.5em');
  g.append('g').call(d3.axisLeft(y));
  addXAxisCaption(g, 'Tipo de feriado (comparação anual)', width, height);
  addYAxisCaption(g, yLabel);

  addColorLegend(svg, {
    title: `${subtitle} · cor fixa para região; linhas mais fortes = 2020 (início da pandemia)`,
    items: regionOrder.map((r) => ({ label: r, color: REGION_COLORS[r] })),
    x: margin.left,
    y: 28,
  });
}
