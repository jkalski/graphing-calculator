const display = document.querySelector('#display');
const buttons = document.querySelector('.calculator-buttons');
const functionGraph = document.querySelector('#functionGraph');
const graphStatus = document.querySelector('#graphStatus');
const graphTooltip = document.querySelector('#graphTooltip');
const resetZoomButton = document.querySelector('#resetZoom');

let expression = '0';
let lastAnswer = '0';
let resetGraphZoom = () => {};

const chartMargin = {
  top: 18,
  right: 18,
  bottom: 32,
  left: 46,
};

function updateDisplay() {
  display.textContent = expression;
}

function formatResult(result) {
  if (!Number.isFinite(result)) {
    return 'Error';
  }

  const rounded = Math.round((result + Number.EPSILON) * 100000000) / 100000000;
  return String(rounded);
}

function appendToExpression(value) {
  if (expression === '0' || expression === 'Error') {
    expression = value;
    return;
  }

  expression += value;
}

function clearCalculator() {
  expression = '0';
}

function backspace() {
  expression = expression.length > 1 ? expression.slice(0, -1) : '0';
}

function runEquals() {
  if (!window.math || expression.includes('x')) {
    graphStatus.textContent = 'Use Graph for expressions with x.';
    return;
  }

  try {
    lastAnswer = formatResult(math.evaluate(expression, { ans: Number(lastAnswer) }));
    expression = lastAnswer;
  } catch (error) {
    expression = 'Error';
  }
}

function getChartSize() {
  const chartBox = functionGraph.getBoundingClientRect();

  return {
    width: chartBox.width || 420,
    height: chartBox.height || 260,
  };
}

function drawFunctionGraph() {
  if (!window.d3 || !window.math || !functionGraph) {
    return;
  }

  const graphExpression = expression === 'Error' ? '0' : expression;
  const { width, height } = getChartSize();
  const innerWidth = Math.max(width - chartMargin.left - chartMargin.right, 1);
  const innerHeight = Math.max(height - chartMargin.top - chartMargin.bottom, 1);
  const svg = d3.select(functionGraph);
  const baseXScale = d3.scaleLinear().domain([-10, 10]).range([0, innerWidth]);
  const baseYScale = d3.scaleLinear().domain([-10, 10]).range([innerHeight, 0]);

  svg.attr('viewBox', `0 0 ${width} ${height}`);
  svg.selectAll('*').remove();
  graphTooltip.hidden = true;

  const chart = svg
    .append('g')
    .attr('transform', `translate(${chartMargin.left}, ${chartMargin.top})`);

  const gridGroup = chart.append('g').attr('class', 'chart-grid');
  const xAxisGroup = chart.append('g').attr('class', 'chart-axis');
  const yAxisGroup = chart.append('g').attr('class', 'chart-axis');
  const areaPath = chart.append('path').attr('class', 'result-area');
  const linePath = chart.append('path').attr('class', 'result-line');
  const crosshairX = chart.append('line').attr('class', 'crosshair-line').attr('y1', 0).attr('y2', innerHeight).attr('hidden', true);
  const crosshairY = chart.append('line').attr('class', 'crosshair-line').attr('x1', 0).attr('x2', innerWidth).attr('hidden', true);
  let activeXScale = baseXScale;
  let activeYScale = baseYScale;

  try {
    const compiled = math.compile(graphExpression);
    const data = d3
      .range(-10, 10.05, 0.1)
      .map((x) => ({ x, y: compiled.evaluate({ x, ans: Number(lastAnswer) }) }))
      .filter((point) => Number.isFinite(point.y) && point.y >= -100 && point.y <= 100);

    if (data.length < 2) {
      throw new Error('Not enough graphable points.');
    }

    const hoverPoints = data.filter((point, index) => point.y >= -10 && point.y <= 10 && index % 10 === 0);

    function renderGraph(xScale, yScale) {
      activeXScale = xScale;
      activeYScale = yScale;

      const line = d3
        .line()
        .defined((point) => point.y >= yScale.domain()[0] && point.y <= yScale.domain()[1])
        .x((point) => xScale(point.x))
        .y((point) => yScale(point.y))
        .curve(d3.curveMonotoneX);

      const area = d3
        .area()
        .defined((point) => point.y >= yScale.domain()[0] && point.y <= yScale.domain()[1])
        .x((point) => xScale(point.x))
        .y0(yScale(0))
        .y1((point) => yScale(point.y))
        .curve(d3.curveMonotoneX);

      gridGroup.call(d3.axisLeft(yScale).ticks(5).tickSize(-innerWidth).tickFormat(''));
      xAxisGroup.attr('transform', `translate(0, ${yScale(0)})`).call(d3.axisBottom(xScale).ticks(5));
      yAxisGroup.attr('transform', `translate(${xScale(0)}, 0)`).call(d3.axisLeft(yScale).ticks(5));
      areaPath.datum(data).attr('d', area);
      linePath.datum(data).attr('d', line);

      chart
        .selectAll('.graph-point')
        .data(hoverPoints)
        .join('circle')
        .attr('class', 'graph-point')
        .attr('cx', (point) => xScale(point.x))
        .attr('cy', (point) => yScale(point.y))
        .attr('r', 4)
        .on('mouseenter', (event, point) => {
          graphTooltip.hidden = false;
          graphTooltip.textContent = `x: ${point.x.toFixed(1)}, y: ${point.y.toFixed(2)}`;
          crosshairX.attr('hidden', null);
          crosshairY.attr('hidden', null);
        })
        .on('mousemove', (event, point) => {
          const x = activeXScale(point.x);
          const y = activeYScale(point.y);

          crosshairX.attr('x1', x).attr('x2', x);
          crosshairY.attr('y1', y).attr('y2', y);
          graphTooltip.style.left = `${event.offsetX + 14}px`;
          graphTooltip.style.top = `${event.offsetY + 14}px`;
        })
        .on('mouseleave', () => {
          graphTooltip.hidden = true;
          crosshairX.attr('hidden', true);
          crosshairY.attr('hidden', true);
        });
    }

    renderGraph(baseXScale, baseYScale);

    const length = linePath.node().getTotalLength();

    linePath
      .attr('stroke-dasharray', `${length} ${length}`)
      .attr('stroke-dashoffset', length)
      .transition()
      .duration(650)
      .ease(d3.easeCubicOut)
      .attr('stroke-dashoffset', 0);

    const zoomBehavior = d3
      .zoom()
      .scaleExtent([0.8, 8])
      .translateExtent([[0, 0], [width, height]])
      .on('zoom', (event) => {
        const zoomedXScale = event.transform.rescaleX(baseXScale);
        const zoomedYScale = event.transform.rescaleY(baseYScale);

        renderGraph(zoomedXScale, zoomedYScale);
        linePath.attr('stroke-dasharray', null).attr('stroke-dashoffset', null);
      });

    svg.call(zoomBehavior);

    resetGraphZoom = () => {
      svg
        .transition()
        .duration(300)
        .call(zoomBehavior.transform, d3.zoomIdentity);
    };

    svg.on('mouseleave', () => {
      graphTooltip.hidden = true;
      crosshairX.attr('hidden', true);
      crosshairY.attr('hidden', true);
    });

    svg.on('dblclick.zoom', null);
    svg.on('dblclick', resetGraphZoom);

    graphStatus.textContent = `Graphing y = ${graphExpression}. Scroll or drag to zoom and pan.`;
  } catch (error) {
    graphStatus.textContent = 'Enter a valid expression, like x^2 - 4 or sin(x).';
  }
}

buttons.addEventListener('click', (event) => {
  const button = event.target.closest('button');

  if (!button) {
    return;
  }

  const value = button.dataset.number ?? button.dataset.insert;
  const action = button.dataset.action;

  if (value !== undefined) {
    appendToExpression(value);
  } else if (action === 'clear') {
    clearCalculator();
  } else if (action === 'backspace') {
    backspace();
  } else if (action === 'equals') {
    runEquals();
  } else if (action === 'graph-display') {
    drawFunctionGraph();
  }

  updateDisplay();
});

drawFunctionGraph();
updateDisplay();

resetZoomButton.addEventListener('click', resetGraphZoom);
window.addEventListener('resize', drawFunctionGraph);
