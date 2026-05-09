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

// Math.js evaluates the full display string for number-only calculator expressions.
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

// D3 turns the calculator expression into an animated, interactive SVG graph.
function drawFunctionGraph() {
  if (!window.d3 || !window.math || !functionGraph) {
    return;
  }

  const graphExpression = expression === 'Error' ? '0' : expression;
  const { width, height } = getChartSize();
  const innerWidth = Math.max(width - chartMargin.left - chartMargin.right, 1);
  const innerHeight = Math.max(height - chartMargin.top - chartMargin.bottom, 1);
  // D3 selection grabs the SVG so the script can add axes, paths, and points.
  const svg = d3.select(functionGraph);
  // D3 scales convert math coordinates into SVG pixel positions.
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
  // Crosshair lines are moved during hover events to point at the selected data point.
  const crosshairX = chart.append('line').attr('class', 'crosshair-line').attr('y1', 0).attr('y2', innerHeight).attr('hidden', true);
  const crosshairY = chart.append('line').attr('class', 'crosshair-line').attr('x1', 0).attr('x2', innerWidth).attr('hidden', true);
  let activeXScale = baseXScale;
  let activeYScale = baseYScale;

  try {
    // Math.js compiles once, then evaluates the expression for many x-values.
    const compiled = math.compile(graphExpression);
    const data = d3
      .range(-10, 10.05, 0.1)
      .map((x) => ({ x, y: compiled.evaluate({ x, ans: Number(lastAnswer) }) }))
      .filter((point) => Number.isFinite(point.y) && point.y >= -100 && point.y <= 100);

    if (data.length < 2) {
      throw new Error('Not enough graphable points.');
    }

    const hoverPoints = data.filter((point, index) => point.y >= -10 && point.y <= 10 && index % 10 === 0);

    // Re-renders the graph with whatever scales are active, including zoomed scales.
    function renderGraph(xScale, yScale) {
      activeXScale = xScale;
      activeYScale = yScale;

      // D3 line generator converts data points into the SVG path for the curve.
      const line = d3
        .line()
        .defined((point) => point.y >= yScale.domain()[0] && point.y <= yScale.domain()[1])
        .x((point) => xScale(point.x))
        .y((point) => yScale(point.y))
        .curve(d3.curveMonotoneX);

      // D3 area generator shades the region between the curve and the x-axis.
      const area = d3
        .area()
        .defined((point) => point.y >= yScale.domain()[0] && point.y <= yScale.domain()[1])
        .x((point) => xScale(point.x))
        .y0(yScale(0))
        .y1((point) => yScale(point.y))
        .curve(d3.curveMonotoneX);

      // D3 axis helpers redraw readable axes and grid lines from the current scales.
      gridGroup.call(d3.axisLeft(yScale).ticks(5).tickSize(-innerWidth).tickFormat(''));
      xAxisGroup.attr('transform', `translate(0, ${yScale(0)})`).call(d3.axisBottom(xScale).ticks(5));
      yAxisGroup.attr('transform', `translate(${xScale(0)}, 0)`).call(d3.axisLeft(yScale).ticks(5));
      areaPath.datum(data).attr('d', area);
      linePath.datum(data).attr('d', line);

      // D3 data binding creates one hover circle for each sampled point.
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

    // D3 transition animates the SVG stroke so the curve draws onto the screen.
    linePath
      .attr('stroke-dasharray', `${length} ${length}`)
      .attr('stroke-dashoffset', length)
      .transition()
      .duration(650)
      .ease(d3.easeCubicOut)
      .attr('stroke-dashoffset', 0);

    // D3 zoom updates the scales during scroll/drag, then redraws the graph.
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

    // Reset Zoom uses D3's identity transform to restore the original view.
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

// Shared keypad handler: buttons either append text or run calculator/graph actions.
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
