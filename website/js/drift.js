// Rating Drift Line Chart — loads real data from website/data/drift.json
(function () {
  function drawDrift(data) {
    const container = d3.select("#drift-chart");
    container.selectAll("*").remove();

    const rect = document.getElementById("drift-chart").getBoundingClientRect();
    const margin = { top: 20, right: 30, bottom: 50, left: 55 };
    const width = Math.max(rect.width, 350) - margin.left - margin.right;
    const height = 320 - margin.top - margin.bottom;

    const svg = container.append("svg")
      .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const xMax = d3.max(data, d => d.bookNumber);
    const x = d3.scaleLinear().domain([1, xMax]).range([0, width]);

    const yExtent = [
      d3.min(data, d => d.stdLow) - 0.1,
      d3.max(data, d => d.stdHigh) + 0.1
    ];
    const y = d3.scaleLinear().domain(yExtent).range([height, 0]);

    // Confidence band
    svg.append("path")
      .datum(data)
      .attr("d", d3.area()
        .x(d => x(d.bookNumber))
        .y0(d => y(d.stdLow))
        .y1(d => y(d.stdHigh))
        .curve(d3.curveBasis))
      .attr("fill", "#e94560")
      .attr("opacity", 0.15);

    // Main line
    svg.append("path")
      .datum(data)
      .attr("d", d3.line()
        .x(d => x(d.bookNumber))
        .y(d => y(d.avgRating))
        .curve(d3.curveBasis))
      .attr("fill", "none")
      .attr("stroke", "#e94560")
      .attr("stroke-width", 2.5);

    // Trend line (first to last point)
    const first = data[0], last = data[data.length - 1];
    svg.append("line")
      .attr("x1", x(first.bookNumber)).attr("y1", y(first.avgRating))
      .attr("x2", x(last.bookNumber)).attr("y2", y(last.avgRating))
      .attr("stroke", "#f2a365")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "6 4")
      .attr("opacity", 0.8);

    // Axes
    svg.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d => `#${d}`));

    svg.append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => d.toFixed(1) + " ★"));

    svg.append("text")
      .attr("x", width / 2).attr("y", height + 40)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px").attr("fill", "#666")
      .text("Nth Book Read");

    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2).attr("y", -42)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px").attr("fill", "#666")
      .text("Average Rating");

    // Drift annotation
    const drift = (first.avgRating - last.avgRating).toFixed(2);
    svg.append("text")
      .attr("x", x(last.bookNumber * 0.8)).attr("y", y((first.avgRating + last.avgRating) / 2) - 10)
      .attr("text-anchor", "middle")
      .attr("font-size", "11px").attr("fill", "#f2a365")
      .text(`−${drift} ★ drift`);
  }

  d3.json("data/drift.json").then(data => {
    drawDrift(data);
    window.addEventListener("resize", () => drawDrift(data));
  });
})();
