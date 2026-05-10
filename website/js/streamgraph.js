// Genre Popularity Streamgraph — loads real data from website/data/streamgraph.json
(function () {
  const genres = [
    "Romance", "Mystery & Thriller", "Fantasy & Paranormal",
    "Young Adult", "Fiction", "Non-Fiction",
    "History & Biography", "Comics & Graphic", "Poetry", "Children"
  ];

  const colors = [
    "#e94560", "#f2a365", "#6a0572", "#1b9aaa",
    "#50b8a6", "#d4a5a5", "#c4b7a6", "#3d5a80",
    "#ee6c4d", "#8ecae6"
  ];

  const events = [
    { date: new Date(2011, 2, 1), label: "Arab Spring" },
    { date: new Date(2012, 10, 1), label: "Obama re-elected" },
    { date: new Date(2014, 6, 1), label: "ISIS rise" },
    { date: new Date(2016, 10, 1), label: "Trump elected" },
    // { date: new Date(2017, 0, 1), label: "1984 sales spike" },
  ];

  function quarterToDate(q) {
    const [year, qn] = q.split("-Q");
    return new Date(+year, (+qn - 1) * 3, 1);
  }

  function drawStreamgraph(data) {
    const container = d3.select("#streamgraph");
    container.selectAll("*").remove();

    const rect = document.getElementById("streamgraph").getBoundingClientRect();
    const margin = { top: 30, right: 20, bottom: 40, left: 50 };
    const width = Math.max(rect.width, 400) - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = container.append("svg")
      .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Parse dates
    data.forEach(d => { d.date = quarterToDate(d.quarter); });

    const stack = d3.stack()
      .keys(genres)
      .offset(d3.stackOffsetWiggle)
      .order(d3.stackOrderInsideOut);

    const series = stack(data);

    const x = d3.scaleTime()
      .domain(d3.extent(data, d => d.date))
      .range([0, width]);

    const y = d3.scaleLinear()
      .domain([
        d3.min(series, s => d3.min(s, d => d[0])),
        d3.max(series, s => d3.max(s, d => d[1]))
      ])
      .range([height, 0]);

    const area = d3.area()
      .x(d => x(d.data.date))
      .y0(d => y(d[0]))
      .y1(d => y(d[1]))
      .curve(d3.curveBasis);

    const tooltip = d3.select("body").append("div").attr("class", "tooltip");

    svg.selectAll(".layer")
      .data(series)
      .join("path")
      .attr("class", "layer")
      .attr("d", area)
      .attr("fill", (d, i) => colors[i])
      .attr("opacity", 0.85)
      .on("mouseover", function (event, d) {
        d3.select(this).attr("opacity", 1).attr("stroke", "#fff").attr("stroke-width", 1);
        tooltip.style("opacity", 1).html(`<strong>${d.key}</strong>`);
      })
      .on("mousemove", function (event) {
        tooltip
          .style("left", (event.pageX + 12) + "px")
          .style("top", (event.pageY - 30) + "px");
      })
      .on("mouseout", function () {
        d3.select(this).attr("opacity", 0.85).attr("stroke", "none");
        tooltip.style("opacity", 0);
      });

    svg.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(d3.timeYear.every(1)).tickFormat(d3.timeFormat("%Y")));

    events.forEach(ev => {
      const ex = x(ev.date);
      svg.append("line")
        .attr("class", "event-line")
        .attr("x1", ex).attr("x2", ex)
        .attr("y1", 0).attr("y2", height);
      svg.append("text")
        .attr("class", "event-label")
        .attr("x", ex).attr("y", -8)
        .text(ev.label)
        .attr("text-anchor", "end");
    });

    // Legend (outside plot, below chart)
    const legendContainer = container.append("div")
      .style("display", "flex")
      .style("flex-wrap", "wrap")
      .style("justify-content", "center")
      .style("gap", "8px 20px")
      .style("margin-top", "12px");

    genres.forEach((g, i) => {
      const item = legendContainer.append("span")
        .style("display", "inline-flex")
        .style("align-items", "center")
        .style("gap", "6px")
        .style("font-size", "12px")
        .style("color", "#ccc")
        .style("font-family", "var(--font-heading)");

      item.append("span")
        .style("width", "12px")
        .style("height", "12px")
        .style("border-radius", "2px")
        .style("background", colors[i])
        .style("display", "inline-block");

      item.append("span").text(g);
    });
  }

  // Load real data
  d3.json("data/streamgraph.json").then(data => {
    drawStreamgraph(data);
    window.addEventListener("resize", () => drawStreamgraph(data));
    window.drawStreamgraph = () => drawStreamgraph(data);
  });
})();
