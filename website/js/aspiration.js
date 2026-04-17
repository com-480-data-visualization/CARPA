// Aspiration vs Reality — Diverging Bar Chart, loads real data
(function () {
  function drawAspiration(data) {
    const container = d3.select("#aspiration-chart");
    container.selectAll("*").remove();

    const rect = document.getElementById("aspiration-chart").getBoundingClientRect();
    const margin = { top: 20, right: 50, bottom: 30, left: 150 };
    const width = Math.max(rect.width, 400) - margin.left - margin.right;
    const height = data.length * 38;

    const svg = container.append("svg")
      .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const maxVal = d3.max(data, d => Math.max(d.shelved, d.read));

    const x = d3.scaleLinear().domain([-maxVal, maxVal]).range([0, width]);
    const y = d3.scaleBand().domain(data.map(d => d.genre)).range([0, height]).padding(0.25);

    // Center line
    svg.append("line")
      .attr("x1", x(0)).attr("x2", x(0))
      .attr("y1", 0).attr("y2", height)
      .attr("stroke", "#999").attr("stroke-width", 1);

    // "Shelved" bars (left)
    svg.selectAll(".bar-shelved")
      .data(data)
      .join("rect")
      .attr("class", "bar-shelved")
      .attr("x", d => x(-d.shelved))
      .attr("y", d => y(d.genre))
      .attr("width", d => x(0) - x(-d.shelved))
      .attr("height", y.bandwidth())
      .attr("fill", "#3d5a80")
      .attr("rx", 3)
      .attr("opacity", 0.85);

    // "Read" bars (right)
    svg.selectAll(".bar-read")
      .data(data)
      .join("rect")
      .attr("class", "bar-read")
      .attr("x", x(0))
      .attr("y", d => y(d.genre))
      .attr("width", d => x(d.read) - x(0))
      .attr("height", y.bandwidth())
      .attr("fill", "#e94560")
      .attr("rx", 3)
      .attr("opacity", 0.85);

    // Value labels — shelved (placed inside bar if it would overflow)
    svg.selectAll(".label-shelved")
      .data(data)
      .join("text")
      .attr("y", d => y(d.genre) + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("font-size", "11px")
      .each(function(d) {
        const xPos = x(-d.shelved) - 5;
        if (xPos < 5) {
          // Label would go off-screen → place inside bar
          d3.select(this)
            .attr("x", x(-d.shelved) + 8)
            .attr("text-anchor", "start")
            .attr("fill", "#fff");
        } else {
          d3.select(this)
            .attr("x", xPos)
            .attr("text-anchor", "end")
            .attr("fill", "#8ecae6");
        }
      })
      .text(d => d.shelved + "%");

    svg.selectAll(".label-read")
      .data(data)
      .join("text")
      .attr("x", d => x(d.read) + 5)
      .attr("y", d => y(d.genre) + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "start")
      .attr("font-size", "11px").attr("fill", "#f2a365")
      .text(d => d.read + "%");

    // Legend
    const leg = svg.append("g").attr("transform", `translate(${width - 180}, -10)`);
    leg.append("rect").attr("width", 12).attr("height", 12).attr("fill", "#3d5a80").attr("rx", 2);
    leg.append("text").attr("x", 16).attr("y", 10).text("Shelved 'to-read'")
      .attr("font-size", "11px").attr("fill", "#ccc");
    leg.append("rect").attr("x", 120).attr("width", 12).attr("height", 12).attr("fill", "#e94560").attr("rx", 2);
    leg.append("text").attr("x", 136).attr("y", 10).text("Actually read")
      .attr("font-size", "11px").attr("fill", "#ccc");

    // Y axis (genre names on the left)
    svg.append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(y).tickSize(0))
      .selectAll("text")
      .attr("font-size", "12px")
      .attr("fill", "#ddd");

    svg.select(".axis .domain").remove();
  }

  d3.json("data/aspiration.json").then(data => {
    drawAspiration(data);
    window.addEventListener("resize", () => drawAspiration(data));
  });
})();
