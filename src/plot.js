import * as d3 from 'd3';

export const REGION_COLORS = {
  Downtown: '#1d4ed8',
  Midtown: '#f59e0b',
  Uptown: '#10b981',
};

export const SEMANTIC_COLORS = {
  trips: '#1d4ed8',
  baseline: '#b45309',
  marker: '#be185d',
};

export function createBaseChart(container = '#chart') {
  d3.select(container).html('');
  const svg = d3.select(container).append('svg').attr('viewBox', '0 0 1120 660').attr('width', 1120).attr('height', 660);
  return { svg, margin: { top: 86, right: 48, bottom: 220, left: 124 }, width: 948, height: 354 };
}

export function addXAxisCaption(g, text, width, height) {
  g.append('text').attr('x', width / 2).attr('y', height + 170).attr('text-anchor', 'middle').attr('fill', '#111827').attr('font-size', 14).text(text);
}

export function addYAxisCaption(g, text) {
  g.append('text').attr('transform', 'rotate(-90)').attr('x', -177).attr('y', -92).attr('text-anchor', 'middle').attr('fill', '#111827').attr('font-size', 14).text(text);
}

export function styleDenseXAxis(axisG) {
  axisG.selectAll('text')
    .attr('text-anchor', 'end')
    .attr('dx', '-0.7em')
    .attr('dy', '0.2em')
    .attr('transform', 'rotate(-42)')
    .attr('font-size', 11);
}

export function addColorLegend(svg, { title, items, x = 98, y = 20, itemGap = 210 }) {
  const legend = svg.append('g').attr('transform', `translate(${x},${y})`);
  legend.append('text').attr('x', 0).attr('y', -12).attr('font-size', 12).attr('fill', '#374151').text(title);
  items.forEach((item, i) => {
    const g = legend.append('g').attr('transform', `translate(${i * itemGap},0)`);
    g.append('line').attr('x1', 0).attr('x2', 22).attr('y1', 0).attr('y2', 0).attr('stroke', item.color).attr('stroke-width', 3);
    g.append('text').attr('x', 28).attr('y', 4).attr('font-size', 11).text(item.label);
  });
}
