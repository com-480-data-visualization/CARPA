// Rating Drift Line Chart - loads preprocessed data from website/data/drift.json
(function () {
  const chartSelector = "#drift-chart";
  const ratingFormat = d3.format(".2f");
  const countFormat = d3.format(",");

  function parseDriftData(data) {
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map(d => {
        const bookNumber = Number(d.bookNumber);
        const avgRating = Number(d.avgRating);
        const stdLow = Number(d.stdLow);
        const stdHigh = Number(d.stdHigh);
        const count = Number(d.count);

        return {
          bookNumber,
          avgRating,
          stdLow: Number.isFinite(stdLow) ? stdLow : avgRating,
          stdHigh: Number.isFinite(stdHigh) ? stdHigh : avgRating,
          count: Number.isFinite(count) ? count : null,
        };
      })
      .filter(d => Number.isFinite(d.bookNumber) && Number.isFinite(d.avgRating))
      .map(d => {
        const low = Math.min(d.stdLow, d.stdHigh);
        const high = Math.max(d.stdLow, d.stdHigh);
        return { ...d, stdLow: low, stdHigh: high };
      })
      .sort((a, b) => a.bookNumber - b.bookNumber);
  }

  function showMessage(container, title, detail) {
    container.selectAll("*").remove();
    container
      .append("div")
      .style("min-height", "260px")
      .style("display", "flex")
      .style("flex-direction", "column")
      .style("align-items", "center")
      .style("justify-content", "center")
      .style("gap", "0.35rem")
      .style("text-align", "center")
      .style("font-family", "var(--font-heading)")
      .style("color", "#666")
      .call(box => {
        box.append("strong")
          .style("font-size", "0.95rem")
          .text(title);
        box.append("span")
          .style("font-size", "0.8rem")
          .style("max-width", "28rem")
          .text(detail);
      });
  }

  function paddedDomain(values, paddingRatio, lowerBound, upperBound) {
    const extent = d3.extent(values);
    if (!Number.isFinite(extent[0]) || !Number.isFinite(extent[1])) {
      return [lowerBound, upperBound];
    }

    if (extent[0] === extent[1]) {
      const pad = extent[0] === 0 ? 1 : Math.abs(extent[0]) * paddingRatio;
      return [
        Math.max(lowerBound, extent[0] - pad),
        Math.min(upperBound, extent[1] + pad),
      ];
    }

    const span = extent[1] - extent[0];
    return [
      Math.max(lowerBound, extent[0] - span * paddingRatio),
      Math.min(upperBound, extent[1] + span * paddingRatio),
    ];
  }

  function clampedLabelY(yScale, value, dy, height) {
    return Math.max(14, Math.min(height - 8, yScale(value) + dy));
  }

  function drawDrift(rawData) {
    const container = d3.select(chartSelector);
    const data = parseDriftData(rawData);

    container.selectAll("*").remove();
    container.style("position", "relative");

    if (data.length === 0) {
      showMessage(
        container,
        "Rating drift data is empty",
        "Run src/preprocess_for_website.py to regenerate website/data/drift.json."
      );
      return;
    }

    const node = container.node();
    const rect = node.getBoundingClientRect();
    const margin = { top: 28, right: 36, bottom: 58, left: 68 };
    const outerWidth = Math.max(rect.width, 360);
    const outerHeight = 360;
    const width = outerWidth - margin.left - margin.right;
    const height = outerHeight - margin.top - margin.bottom;

    const svg = container.append("svg")
      .attr("viewBox", `0 0 ${outerWidth} ${outerHeight}`)
      .attr("role", "img")
      .attr("aria-label", "Mean Goodreads rating by reading sequence position")
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const xDomain = d3.extent(data, d => d.bookNumber);
    if (xDomain[0] === xDomain[1]) {
      xDomain[0] -= 1;
      xDomain[1] += 1;
    }

    const yValues = data.flatMap(d => [d.stdLow, d.stdHigh, d.avgRating]);
    const yDomain = paddedDomain(yValues, 0.05, 0, 5.5);

    const x = d3.scaleLinear().domain(xDomain).range([0, width]);
    const y = d3.scaleLinear().domain(yDomain).nice().range([height, 0]);

    const xAxis = d3.axisBottom(x)
      .ticks(Math.min(6, data.length))
      .tickFormat(d => `#${Math.round(d)}`);
    const yAxis = d3.axisLeft(y)
      .ticks(6)
      .tickFormat(d => `${ratingFormat(d)}`);

    svg.append("g")
      .attr("class", "axis drift-grid")
      .call(d3.axisLeft(y).ticks(6).tickSize(-width).tickFormat(""))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll("line")
        .attr("stroke", "#ddd")
        .attr("stroke-opacity", 0.55));

    const area = d3.area()
      .defined(d => Number.isFinite(d.stdLow) && Number.isFinite(d.stdHigh))
      .x(d => x(d.bookNumber))
      .y0(d => y(d.stdLow))
      .y1(d => y(d.stdHigh))
      .curve(d3.curveMonotoneX);

    svg.append("path")
      .datum(data)
      .attr("d", area)
      .attr("fill", "#e94560")
      .attr("opacity", 0.15);

    const line = d3.line()
      .x(d => x(d.bookNumber))
      .y(d => y(d.avgRating))
      .curve(d3.curveMonotoneX);

    svg.append("path")
      .datum(data)
      .attr("d", line)
      .attr("fill", "none")
      .attr("stroke", "#e94560")
      .attr("stroke-width", 2.6)
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round");

    const first = data[0];
    const last = data[data.length - 1];

    if (data.length > 1) {
      svg.append("line")
        .attr("x1", x(first.bookNumber))
        .attr("y1", y(first.avgRating))
        .attr("x2", x(last.bookNumber))
        .attr("y2", y(last.avgRating))
        .attr("stroke", "#f2a365")
        .attr("stroke-width", 1.6)
        .attr("stroke-dasharray", "6 4")
        .attr("opacity", 0.85);
    }

    const milestonePoints = data.filter(d =>
      d.bookNumber === first.bookNumber ||
      d.bookNumber === last.bookNumber ||
      d.bookNumber % 50 === 0
    );

    svg.selectAll(".drift-point")
      .data(milestonePoints)
      .join("circle")
      .attr("class", "drift-point")
      .attr("cx", d => x(d.bookNumber))
      .attr("cy", d => y(d.avgRating))
      .attr("r", d => d.bookNumber === first.bookNumber || d.bookNumber === last.bookNumber ? 4 : 2.7)
      .attr("fill", "#faf9f6")
      .attr("stroke", "#e94560")
      .attr("stroke-width", 1.8);

    svg.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${height})`)
      .call(xAxis);

    svg.append("g")
      .attr("class", "axis")
      .call(yAxis);

    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height + 44)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("fill", "#555")
      .text("Reading sequence position (nth rated book)");

    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -50)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("fill", "#555")
      .text("Mean user rating (1-5 stars)");

    const drift = last.avgRating - first.avgRating;
    const driftLabel = Math.abs(drift) < 0.005
      ? "Overall drift: flat"
      : `Overall drift: ${ratingFormat(Math.abs(drift))}-star ${drift < 0 ? "drop" : "increase"}`;

    svg.append("text")
      .attr("x", width)
      .attr("y", 12)
      .attr("text-anchor", "end")
      .attr("font-size", "12px")
      .attr("font-weight", 700)
      .attr("fill", "#f2a365")
      .text(driftLabel);

    function addLabel(d, text, anchor, dx, dy) {
      svg.append("text")
        .attr("x", x(d.bookNumber) + dx)
        .attr("y", clampedLabelY(y, d.avgRating, dy, height))
        .attr("text-anchor", anchor)
        .attr("font-size", "11px")
        .attr("font-weight", 700)
        .attr("fill", "#555")
        .style("paint-order", "stroke")
        .style("stroke", "#faf9f6")
        .style("stroke-width", 3)
        .style("stroke-linejoin", "round")
        .text(text);
    }

    addLabel(first, `First: ${ratingFormat(first.avgRating)}`, "start", 8, -12);
    addLabel(last, `#${last.bookNumber}: ${ratingFormat(last.avgRating)}`, "end", -8, 18);

    const tooltip = container.append("div")
      .attr("class", "tooltip drift-tooltip")
      .style("opacity", 0);

    const focus = svg.append("g")
      .attr("class", "drift-focus")
      .style("display", "none");

    focus.append("line")
      .attr("y1", 0)
      .attr("y2", height)
      .attr("stroke", "#999")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3 3")
      .attr("opacity", 0.7);

    focus.append("circle")
      .attr("r", 5)
      .attr("fill", "#fff")
      .attr("stroke", "#e94560")
      .attr("stroke-width", 2);

    const bisect = d3.bisector(d => d.bookNumber).center;

    svg.append("rect")
      .attr("class", "drift-hit-area")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "transparent")
      .style("cursor", "crosshair")
      .on("mouseenter", () => {
        focus.style("display", null);
        tooltip.style("opacity", 1);
      })
      .on("mousemove", function (event) {
        const [mouseX] = d3.pointer(event, this);
        const nearest = data[Math.max(0, Math.min(data.length - 1, bisect(data, x.invert(mouseX))))];
        const chartPointX = x(nearest.bookNumber);
        const chartPointY = y(nearest.avgRating);
        const [containerX, containerY] = d3.pointer(event, node);

        focus
          .attr("transform", `translate(${chartPointX},0)`);
        focus.select("circle")
          .attr("cy", chartPointY);

        tooltip
          .style("left", `${Math.min(containerX + 14, outerWidth - 190)}px`)
          .style("top", `${Math.max(containerY - 24, 8)}px`)
          .html(
            `<strong>Rated book #${nearest.bookNumber}</strong><br>` +
            `Mean rating: ${ratingFormat(nearest.avgRating)} / 5<br>` +
            `Mean +/- 1 SD: ${ratingFormat(nearest.stdLow)}-${ratingFormat(nearest.stdHigh)}<br>` +
            `Ratings included: ${nearest.count === null ? "n/a" : countFormat(nearest.count)}`
          );
      })
      .on("mouseleave", () => {
        focus.style("display", "none");
        tooltip.style("opacity", 0);
      });
  }

  d3.json("data/drift.json")
    .then(data => {
      let resizeTimer = null;
      drawDrift(data);
      window.addEventListener("resize", () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => drawDrift(data), 120);
      });
    })
    .catch(() => {
      showMessage(
        d3.select(chartSelector),
        "Rating drift data could not be loaded",
        "Serve the website through a local web server so data/drift.json is available."
      );
    });
})();
