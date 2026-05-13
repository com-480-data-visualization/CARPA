// Rating Drift - longitudinal Goodreads rating explorer.
(function () {
  const chartSelector = "#drift-chart";
  const scrubberSelector = "#drift-scrubber";
  const ratingFormat = d3.format(".2f");
  const changeFormat = d3.format("+.2f");
  const countFormat = d3.format(",");

  const milestones = [
    { target: 1, label: "First rating" },
    { target: 30, label: "Rating 30" },
    { target: 100, label: "Rating 100" },
    { target: 250, label: "Rating 250" },
  ];

  let loadedData = [];
  let selectedBookNumber = null;
  let resizeTimer = null;
  let hasAnimated = false;

  function parseDriftData(data) {
    if (!Array.isArray(data)) return [];

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
      .attr("class", "drift-empty")
      .call(box => {
        box.append("strong").text(title);
        box.append("span").text(detail);
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

  function nearestRow(data, bookNumber) {
    if (!data.length) return null;
    const bisect = d3.bisector(d => d.bookNumber).center;
    const index = Math.max(0, Math.min(data.length - 1, bisect(data, bookNumber)));
    return data[index];
  }

  function currentSelection(data) {
    const fallback = data[data.length - 1];
    const target = selectedBookNumber ?? fallback.bookNumber;
    return nearestRow(data, target) || fallback;
  }

  function selectedSubset(data, selected) {
    const subset = data.filter(d => d.bookNumber <= selected.bookNumber);
    return subset.length ? subset : [data[0]];
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function updateDashboard(data, selected) {
    const first = data[0];
    const change = selected.avgRating - first.avgRating;

    setText("drift-selected-book", `#${selected.bookNumber}`);
    setText("drift-selected-rating", `${ratingFormat(selected.avgRating)} ★`);
    setText("drift-selected-drop", changeFormat(change));
    setText("drift-selected-count", selected.count === null ? "n/a" : countFormat(selected.count));
    setText("drift-scrubber-min", `#${data[0].bookNumber}`);
    setText("drift-scrubber-max", `#${data[data.length - 1].bookNumber}`);

    d3.selectAll(".drift-stage-button")
      .classed("is-active", function () {
        return Number(this.dataset.driftTarget) === selected.bookNumber;
      })
      .attr("aria-pressed", function () {
        return String(Number(this.dataset.driftTarget) === selected.bookNumber);
      });

    const scrubber = document.querySelector(scrubberSelector);
    if (scrubber) {
      scrubber.min = data[0].bookNumber;
      scrubber.max = data[data.length - 1].bookNumber;
      scrubber.value = selected.bookNumber;
    }
  }

  function bindControls(data) {
    d3.selectAll(".drift-stage-button")
      .each(function () {
        const target = Number(this.dataset.driftTarget);
        const row = nearestRow(data, target);
        if (row) {
          this.dataset.driftTarget = row.bookNumber;
        }
      })
      .on("click", function () {
        const target = Number(this.dataset.driftTarget);
        if (!Number.isFinite(target)) return;
        selectedBookNumber = target;
        drawDrift(loadedData);
      });

    d3.select(scrubberSelector)
      .on("input", function () {
        selectedBookNumber = Number(this.value);
        drawDrift(loadedData);
      });
  }

  function createDefs(svg) {
    const defs = svg.append("defs");

    const lineGradient = defs.append("linearGradient")
      .attr("id", "drift-line-gradient")
      .attr("x1", "0%")
      .attr("x2", "100%")
      .attr("y1", "0%")
      .attr("y2", "0%");

    lineGradient.append("stop").attr("offset", "0%").attr("stop-color", "#1b9aaa");
    lineGradient.append("stop").attr("offset", "48%").attr("stop-color", "#f2a365");
    lineGradient.append("stop").attr("offset", "100%").attr("stop-color", "#e94560");

    const dropGradient = defs.append("linearGradient")
      .attr("id", "drift-drop-gradient")
      .attr("x1", "0%")
      .attr("x2", "100%")
      .attr("y1", "0%")
      .attr("y2", "0%");

    dropGradient.append("stop").attr("offset", "0%").attr("stop-color", "#f2a365").attr("stop-opacity", 0.18);
    dropGradient.append("stop").attr("offset", "100%").attr("stop-color", "#e94560").attr("stop-opacity", 0.45);

    const bandGradient = defs.append("linearGradient")
      .attr("id", "drift-band-gradient")
      .attr("x1", "0%")
      .attr("x2", "0%")
      .attr("y1", "0%")
      .attr("y2", "100%");

    bandGradient.append("stop").attr("offset", "0%").attr("stop-color", "#e94560").attr("stop-opacity", 0.18);
    bandGradient.append("stop").attr("offset", "100%").attr("stop-color", "#1b9aaa").attr("stop-opacity", 0.08);
  }

  function animatePath(path) {
    const node = path.node();
    if (!node || typeof node.getTotalLength !== "function") return;
    const length = node.getTotalLength();
    path
      .attr("stroke-dasharray", `${length} ${length}`)
      .attr("stroke-dashoffset", length)
      .transition()
      .duration(950)
      .ease(d3.easeCubicOut)
      .attr("stroke-dashoffset", 0);
  }

  function drawDrift(rawData) {
    const container = d3.select(chartSelector);
    const data = parseDriftData(rawData);

    container.selectAll("*").remove();
    container.style("position", "relative");

    if (!data.length) {
      showMessage(
        container,
        "Rating drift data is empty",
        "Run src/preprocess_for_website.py to regenerate website/data/drift.json."
      );
      return;
    }

    if (selectedBookNumber === null) {
      selectedBookNumber = data[data.length - 1].bookNumber;
    }

    const selected = currentSelection(data);
    selectedBookNumber = selected.bookNumber;
    const progressData = selectedSubset(data, selected);
    const first = data[0];
    const node = container.node();
    const rect = node.getBoundingClientRect();
    const isCompact = rect.width < 540;
    const margin = {
      top: isCompact ? 32 : 36,
      right: isCompact ? 28 : 40,
      bottom: 58,
      left: isCompact ? 56 : 70,
    };
    const outerWidth = Math.max(rect.width || 760, 340);
    const outerHeight = isCompact ? 410 : 430;
    const width = outerWidth - margin.left - margin.right;
    const height = outerHeight - margin.top - margin.bottom;

    const svgRoot = container.append("svg")
      .attr("viewBox", `0 0 ${outerWidth} ${outerHeight}`)
      .attr("role", "img")
      .attr("aria-label", "Interactive chart of mean Goodreads rating by chronological dated rating position");

    createDefs(svgRoot);

    const svg = svgRoot.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const xDomain = d3.extent(data, d => d.bookNumber);
    const yValues = data.flatMap(d => [d.stdLow, d.stdHigh, d.avgRating, first.avgRating]);
    const yDomain = paddedDomain(yValues, 0.06, 0, 5.5);
    const x = d3.scaleLinear().domain(xDomain).range([0, width]);
    const y = d3.scaleLinear().domain(yDomain).nice().range([height, 0]);
    const selectedX = x(selected.bookNumber);
    const baselineY = y(first.avgRating);

    const grid = d3.axisLeft(y).ticks(6).tickSize(-width).tickFormat("");
    svg.append("g")
      .attr("class", "axis drift-grid")
      .call(grid)
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll("line")
        .attr("stroke", "#ddd")
        .attr("stroke-opacity", 0.45));

    const uncertaintyArea = d3.area()
      .x(d => x(d.bookNumber))
      .y0(d => y(d.stdLow))
      .y1(d => y(d.stdHigh))
      .curve(d3.curveMonotoneX);

    svg.append("path")
      .datum(data)
      .attr("class", "drift-band")
      .attr("d", uncertaintyArea)
      .attr("fill", "url(#drift-band-gradient)");

    svg.append("line")
      .attr("class", "drift-baseline")
      .attr("x1", 0)
      .attr("x2", width)
      .attr("y1", baselineY)
      .attr("y2", baselineY);

    svg.append("text")
      .attr("class", "drift-baseline-label")
      .attr("x", 6)
      .attr("y", baselineY - 8)
      .text(`First-rating baseline: ${ratingFormat(first.avgRating)}`);

    const dropArea = d3.area()
      .x(d => x(d.bookNumber))
      .y0(baselineY)
      .y1(d => y(d.avgRating))
      .curve(d3.curveMonotoneX);

    svg.append("path")
      .datum(progressData)
      .attr("class", "drift-drop-area")
      .attr("d", dropArea)
      .attr("fill", "url(#drift-drop-gradient)");

    const line = d3.line()
      .x(d => x(d.bookNumber))
      .y(d => y(d.avgRating))
      .curve(d3.curveMonotoneX);

    svg.append("path")
      .datum(data)
      .attr("class", "drift-full-line")
      .attr("d", line);

    const progressPath = svg.append("path")
      .datum(progressData)
      .attr("class", "drift-progress-line")
      .attr("d", line);

    if (!hasAnimated) {
      animatePath(progressPath);
      hasAnimated = true;
    }

    const xAxis = d3.axisBottom(x)
      .tickValues([1, 30, 50, 100, 150, 200, 250].filter(v => v >= xDomain[0] && v <= xDomain[1]))
      .tickFormat(d => `#${Math.round(d)}`);

    const yAxis = d3.axisLeft(y)
      .ticks(6)
      .tickFormat(d => ratingFormat(d));

    svg.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${height})`)
      .call(xAxis);

    svg.append("g")
      .attr("class", "axis")
      .call(yAxis);

    svg.append("text")
      .attr("class", "drift-axis-label")
      .attr("x", width / 2)
      .attr("y", height + 44)
      .attr("text-anchor", "middle")
      .text("Chronological rating position (nth dated rating)");

    svg.append("text")
      .attr("class", "drift-axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -48)
      .attr("text-anchor", "middle")
      .text("Mean rating (1-5 stars)");

    const milestonePoints = milestones
      .map(m => nearestRow(data, m.target))
      .filter((d, i, arr) => d && arr.findIndex(other => other.bookNumber === d.bookNumber) === i);

    svg.selectAll(".drift-milestone")
      .data(milestonePoints)
      .join("circle")
      .attr("class", d => `drift-milestone${d.bookNumber === selected.bookNumber ? " is-selected" : ""}`)
      .attr("cx", d => x(d.bookNumber))
      .attr("cy", d => y(d.avgRating))
      .attr("r", d => d.bookNumber === selected.bookNumber ? 6 : 4)
      .on("click", (event, d) => {
        selectedBookNumber = d.bookNumber;
        drawDrift(loadedData);
      });

    svg.append("line")
      .attr("class", "drift-selected-line")
      .attr("x1", selectedX)
      .attr("x2", selectedX)
      .attr("y1", 0)
      .attr("y2", height);

    svg.append("circle")
      .attr("class", "drift-selected-dot")
      .attr("cx", selectedX)
      .attr("cy", y(selected.avgRating))
      .attr("r", 7);

    const change = selected.avgRating - first.avgRating;
    const labelWidth = isCompact ? 168 : 190;
    const labelX = Math.max(labelWidth / 2, Math.min(width - labelWidth / 2, selectedX));
    const labelY = Math.max(26, y(selected.avgRating) - 42);

    const label = svg.append("g")
      .attr("class", "drift-callout")
      .attr("transform", `translate(${labelX},${labelY})`);

    label.append("rect")
      .attr("x", -labelWidth / 2)
      .attr("y", -22)
      .attr("width", labelWidth)
      .attr("height", 44)
      .attr("rx", 8);

    label.append("text")
      .attr("class", "drift-callout-title")
      .attr("text-anchor", "middle")
      .attr("y", -4)
      .text(`Rating #${selected.bookNumber}: ${ratingFormat(selected.avgRating)} stars`);

    label.append("text")
      .attr("class", "drift-callout-change")
      .attr("text-anchor", "middle")
      .attr("y", 13)
      .text(`${changeFormat(change)} from first rating`);

    const tooltip = container.append("div")
      .attr("class", "tooltip drift-tooltip")
      .style("opacity", 0);

    const focus = svg.append("g")
      .attr("class", "drift-focus")
      .style("display", "none");

    focus.append("line")
      .attr("y1", 0)
      .attr("y2", height);

    focus.append("circle")
      .attr("r", 5);

    const bisect = d3.bisector(d => d.bookNumber).center;

    svg.append("rect")
      .attr("class", "drift-hit-area")
      .attr("width", width)
      .attr("height", height)
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
        const tooltipLeft = Math.max(8, Math.min(containerX + 14, outerWidth - 212));
        const tooltipTop = Math.max(8, Math.min(containerY - 34, outerHeight - 94));

        focus.attr("transform", `translate(${chartPointX},0)`);
        focus.select("circle").attr("cy", chartPointY);

        tooltip
          .style("left", `${tooltipLeft}px`)
          .style("top", `${tooltipTop}px`)
          .html(
            `<strong>Rating #${nearest.bookNumber}</strong><br>` +
            `Mean rating: ${ratingFormat(nearest.avgRating)} / 5<br>` +
            `Change from first: ${changeFormat(nearest.avgRating - first.avgRating)}<br>` +
            `Contributing users: ${nearest.count === null ? "n/a" : countFormat(nearest.count)}`
          );
      })
      .on("mouseleave", () => {
        focus.style("display", "none");
        tooltip.style("opacity", 0);
      })
      .on("click", function (event) {
        const [mouseX] = d3.pointer(event, this);
        const nearest = data[Math.max(0, Math.min(data.length - 1, bisect(data, x.invert(mouseX))))];
        selectedBookNumber = nearest.bookNumber;
        drawDrift(loadedData);
      });

    updateDashboard(data, selected);
  }

  d3.json("data/drift.json")
    .then(data => {
      loadedData = data;
      const parsed = parseDriftData(data);
      if (parsed.length) {
        selectedBookNumber = parsed[parsed.length - 1].bookNumber;
      }

      bindControls(parsed);
      drawDrift(loadedData);

      window.addEventListener("resize", () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => drawDrift(loadedData), 140);
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
