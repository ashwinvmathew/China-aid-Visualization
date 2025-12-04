
const container = d3.select('#area-chart');
const chartNote = d3.select('#chart-note');

const margin = { top: 28, right: 28, bottom: 54, left: 74 };
const datasetPath = "data/aiddata.csv";   // single dataset

// create an HTML tooltip (floating div)
let tooltip = d3.select('body').selectAll('.chart-tooltip').data([0]);
tooltip = tooltip.enter()
  .append('div')
  .attr('class', 'chart-tooltip')
  .style('position', 'absolute')
  .style('pointer-events', 'none')
  .style('display', 'none')
  .merge(tooltip);

function clearChart() {
  container.selectAll("*").remove();
  chartNote.text("");
}

function draw(svgWidth = null) {
  clearChart();

  const rawWidth = parseInt(container.style("width")) || 900;
  const width = (svgWidth || rawWidth) - margin.left - margin.right;
  const height = 460 - margin.top - margin.bottom;

  const svg = container.append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  // add svg filter glow for the line
  const defs = svg.append("defs");
  defs.append("filter")
    .attr("id", "glow")
    .attr("width", "400%")
    .attr("height", "400%")
    .append("feGaussianBlur")
    .attr("stdDeviation", 4)
    .attr("result", "coloredBlur");
  const feMerge = defs.select("#glow").node().parentNode.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "feMerge"));
  defs.html(`
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="#e6f3ff" stop-opacity="0.95"></stop>
      <stop offset="40%" stop-color="#d6ecff" stop-opacity="0.85"></stop>
      <stop offset="100%" stop-color="#f7fbff" stop-opacity="0.9"></stop>
    </linearGradient>
  `);

  d3.csv(datasetPath).then(raw => {
    if (!raw || raw.length === 0) {
      chartNote.text("CSV is empty or not found: " + datasetPath);
      return;
    }

    // detect year column
    const headers = Object.keys(raw[0]);
    const yearCol = headers.find(h => /year/i.test(h)) || "Commitment Year";
    let valueCol = headers.find(h => /value|amount|count|total|sum|usd|amount_usd/i.test(h));
    const hasNumeric = !!valueCol;

    const parsed = raw.map(d => ({
      year: +d[yearCol],
      value: hasNumeric ? (+d[valueCol] || 0) : 1
    })).filter(d => !isNaN(d.year));

    const rolled = Array.from(
      d3.rollup(parsed, v => d3.sum(v, d => d.value), d => d.year),
      ([year, val]) => ({ year: +year, value: +val })
    ).sort((a,b) => a.year - b.year);

    if (rolled.length === 0) {
      chartNote.text("No valid year/value pairs.");
      return;
    }

    // scales
    const x = d3.scaleLinear()
      .domain(d3.extent(rolled, d => d.year))
      .range([0, width]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(rolled, d => d.value) * 1.08])
      .range([height, 0])
      .nice();

    // axes with nicer ticks and fonts
    const years = rolled.map(d => d.year); // e.g. [2000,2001,...,2021]
    const xAxis = d3.axisBottom(x)
    .tickValues(years)          // force tick at every year
    .tickFormat(d3.format('d'));
    const yAxis = d3.axisLeft(y).ticks(6).tickFormat(d3.format("~s"));

    // area + line generators
    const area = d3.area()
      .x(d => x(d.year))
      .y0(y(0))
      .y1(d => y(d.value))
      .curve(d3.curveCatmullRom.alpha(0.5)); // slightly smoother

    const line = d3.line()
      .x(d => x(d.year))
      .y(d => y(d.value))
      .curve(d3.curveCatmullRom.alpha(0.5));

    // draw area (with initial opacity 0 for fade-in)
    const areaPath = g.append("path")
      .datum(rolled)
      .attr("d", area)
      .attr("fill", "url(#areaGradient)")
      .attr("opacity", 0);

    // draw line (thicker)
    const linePath = g.append("path")
      .datum(rolled)
      .attr("d", line)
      .attr("fill", "none")
      .attr("stroke", "#2b7be4")
      .attr("stroke-width", 3)
      .attr("class", "line-glow")
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round");

    // add subtle shadow path (lighter) for depth
    g.append("path")
      .datum(rolled)
      .attr("d", line)
      .attr("fill", "none")
      .attr("stroke", "#bfe3ff")
      .attr("stroke-width", 8)
      .attr("opacity", 0.08)
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round");

    // axes
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(xAxis)
      .selectAll("text")
      .attr("font-size", 12)
      .attr("fill", "#344054");

    g.append("g")
      .call(yAxis)
      .selectAll("text")
      .attr("font-size", 12)
      .attr("fill", "#344054");

    // axis labels
    svg.append("text")
      .attr("class", "axis-label")
      .attr("text-anchor", "middle")
      .attr("x", margin.left + width / 2)
      .attr("y", height + margin.top + margin.bottom - 6)
      .text("Year");

    svg.append("text")
      .attr("class", "axis-label")
      .attr("text-anchor", "middle")
      .attr("transform", "rotate(-90)")
      .attr("x", - (margin.top + height / 2))
      .attr("y", 20)
      .text("Number of Projects");

    // Animate area fade-in and line draw
    areaPath.transition().duration(900).delay(150).attr("opacity", 1);
    // stroke-dash trick for line drawing
    const totalLength = linePath.node().getTotalLength();
    linePath
      .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
      .attr("stroke-dashoffset", totalLength)
      .transition()
      .duration(1200)
      .ease(d3.easeCubicOut)
      .attr("stroke-dashoffset", 0);

    // focus dot + tooltip
    const focus = g.append('g').style('display','none');
    focus.append('circle').attr('r',6).attr('fill','#2b7be4').attr('stroke','#fff').attr('stroke-width',2);
    focus.append('text').attr('x',10).attr('y',-12).attr('font-size',13).attr('fill','#05293c').attr('font-weight',600);

    // overlay for mouse
    g.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'transparent')
      .on('mouseover', (event) => {
        focus.style('display', null);
        tooltip.style('display', 'block');
      })
      .on('mouseout', () => {
        focus.style('display', 'none');
        tooltip.style('display', 'none');
      })
      .on('mousemove', function(event) {
        const [mx, my] = d3.pointer(event, this);
        const yearAt = x.invert(mx);
        const nearest = rolled.reduce((a,b) => Math.abs(b.year - yearAt) < Math.abs(a.year - yearAt) ? b : a);
        const cx = x(nearest.year), cy = y(nearest.value);

        // move focus and update label
        focus.attr('transform', `translate(${cx},${cy})`);
        focus.select('text').text(`${nearest.year}: ${nearest.value.toLocaleString()}`);
        
      });

    chartNote.text(`Years: ${rolled[0].year}–${rolled[rolled.length - 1].year} • Points: ${rolled.length}`);

  }).catch(err => {
    chartNote.text("Error loading CSV: " + err);
    console.error(err);
  });
}

// initial draw
draw();

// redraw on resize (throttled)
let resizeTimer = null;
window.addEventListener('resize', () => {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => draw(), 220);
});
