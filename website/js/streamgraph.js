// Genre Popularity Streamgraph - loads real data from website/data/streamgraph.json
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
    {
      id: "arab-spring",
      date: new Date(2011, 0, 1),
      quarter: "2011-Q1",
      label: "Arab Spring",
      genre: "Non-Fiction",
      insight: "Non-fiction and history/biography together account for 21.14% of highly-rated books."
    },
    {
      id: "obama-reelected",
      date: new Date(2012, 10, 1),
      quarter: "2012-Q4",
      label: "Obama re-elected",
      genre: "Romance",
      insight: "Romance reaches 22.12%, part of the genre's sharp 2012 rise."
    },
    {
      id: "isis-rise",
      date: new Date(2014, 6, 1),
      quarter: "2014-Q3",
      label: "ISIS rise",
      genre: "Mystery & Thriller",
      insight: "Mystery & Thriller climbs to 9.01% after a lower 2012-2013 baseline."
    },
    {
      id: "trump-elected",
      date: new Date(2016, 10, 1),
      quarter: "2016-Q4",
      label: "Trump elected",
      genre: "Non-Fiction",
      insight: "Non-fiction rises to 10.63%, its highest share since early 2013."
    },
  ];

  const quarterFormat = /^(\d{4})-Q([1-4])$/;
  const monthYear = d3.timeFormat("%b %Y");
  const bisectDate = d3.bisector(d => d.date).left;

  let selectedEventId = null;
  let selectedGenre = null;
  let currentChart = null;

  function quarterToDate(q) {
    if (typeof q !== "string") return null;
    const match = q.match(quarterFormat);
    if (!match) return null;

    const year = +match[1];
    const quarter = +match[2];
    return new Date(year, (quarter - 1) * 3, 1);
  }

  function formatQuarter(q) {
    const match = typeof q === "string" ? q.match(quarterFormat) : null;
    return match ? `${match[1]} Q${match[2]}` : "Unknown quarter";
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function numericValue(value) {
    const n = +value;
    return Number.isFinite(n) ? n : 0;
  }

  function normalizeData(rawData) {
    if (!Array.isArray(rawData)) return [];

    return rawData
      .map(d => {
        const date = quarterToDate(d && d.quarter);
        if (!date) return null;

        const row = { quarter: d.quarter, date };
        genres.forEach(genre => { row[genre] = numericValue(d[genre]); });
        return row;
      })
      .filter(Boolean)
      .sort((a, b) => a.date - b.date);
  }

  function hasUsableData(data) {
    return data.length > 0 && genres.some(genre => data.some(d => d[genre] > 0));
  }

  function renderMessage(container, message) {
    container.selectAll("*").remove();
    container.append("div")
      .attr("class", "streamgraph-empty-message")
      .text(message);
  }

  function getTooltip() {
    return d3.select("body")
      .selectAll(".streamgraph-tooltip")
      .data([null])
      .join("div")
      .attr("class", "tooltip streamgraph-tooltip")
      .style("opacity", 0);
  }

  function nearestRow(data, date) {
    if (!data.length) return null;

    const index = bisectDate(data, date);
    const before = data[index - 1];
    const after = data[index];

    if (!before) return after;
    if (!after) return before;
    return date - before.date <= after.date - date ? before : after;
  }

  function tooltipHtml(genre, row) {
    const value = numericValue(row && row[genre]);
    const dateLabel = row && row.date ? monthYear(row.date) : "Unknown date";

    return `
      <div class="streamgraph-tooltip-title">${escapeHtml(genre)}</div>
      <div>${escapeHtml(formatQuarter(row && row.quarter))} · ${escapeHtml(dateLabel)}</div>
      <div>Share of highly-rated books: <strong>${value.toFixed(2)}%</strong></div>
    `;
  }

  function eventTooltipHtml(ev, row) {
    const value = row ? numericValue(row[ev.genre]) : 0;

    return `
      <div class="streamgraph-tooltip-title">${escapeHtml(ev.label)}</div>
      <div>${escapeHtml(formatQuarter(ev.quarter))} · ${escapeHtml(ev.genre)}</div>
      <div>Genre share: <strong>${value.toFixed(2)}%</strong></div>
      <div>${escapeHtml(ev.insight)}</div>
    `;
  }

  function moveTooltip(tooltip, event) {
    tooltip
      .style("left", `${event.pageX + 14}px`)
      .style("top", `${event.pageY - 34}px`);
  }

  function updateEventSummary() {
    const summary = d3.select("#streamgraph-event-summary");
    if (summary.empty()) return;

    const ev = events.find(d => d.id === selectedEventId);
    if (!ev || !currentChart) {
      summary.html("<strong>All genres</strong><span>Hover a layer for quarter-level values, or select an event to isolate its linked genre.</span>");
      return;
    }

    const row = currentChart.data.find(d => d.quarter === ev.quarter) || nearestRow(currentChart.data, ev.date);
    const value = row ? numericValue(row[ev.genre]) : 0;

    summary.html(`
      <strong>${escapeHtml(ev.label)} · ${escapeHtml(ev.genre)}</strong>
      <span>${escapeHtml(formatQuarter(ev.quarter))}: ${value.toFixed(2)}%. ${escapeHtml(ev.insight)}</span>
    `);
  }

  function updateEventButtons() {
    d3.selectAll("[data-streamgraph-event-id]")
      .classed("is-active", function () {
        return this.dataset.streamgraphEventId === selectedEventId;
      })
      .attr("aria-pressed", function () {
        return String(this.dataset.streamgraphEventId === selectedEventId);
      });

    d3.selectAll("[data-streamgraph-reset]")
      .classed("is-active", selectedEventId === null)
      .attr("aria-pressed", String(selectedEventId === null));
  }

  function setSelection(eventId) {
    const ev = events.find(d => d.id === eventId);

    selectedEventId = ev ? ev.id : null;
    selectedGenre = ev ? ev.genre : null;
    applyHighlight();
    updateEventButtons();
    updateEventSummary();
  }

  function drawFocusMarker() {
    if (!currentChart) return;

    const { svg, x, y, data, series } = currentChart;
    const marker = svg.selectAll(".streamgraph-focus-marker")
      .data(selectedEventId && selectedGenre ? [selectedEventId] : []);

    marker.exit().remove();

    if (!selectedEventId || !selectedGenre) return;

    const ev = events.find(d => d.id === selectedEventId);
    const row = ev && (data.find(d => d.quarter === ev.quarter) || nearestRow(data, ev.date));
    const genreSeries = series.find(d => d.key === selectedGenre);
    const point = row && genreSeries && genreSeries.find(d => d.data.quarter === row.quarter);

    if (!ev || !row || !point) return;

    marker.join("circle")
      .attr("class", "streamgraph-focus-marker")
      .attr("cx", x(row.date))
      .attr("cy", y((point[0] + point[1]) / 2))
      .attr("r", 5)
      .attr("fill", "#fff")
      .attr("stroke", colors[genres.indexOf(selectedGenre)])
      .attr("stroke-width", 3);
  }

  function applyHighlight() {
    if (!currentChart) return;

    const { svg } = currentChart;

    svg.selectAll(".layer")
      .classed("is-muted", d => Boolean(selectedGenre && d.key !== selectedGenre))
      .classed("is-selected", d => d.key === selectedGenre)
      .attr("opacity", d => {
        if (!selectedGenre) return 0.85;
        return d.key === selectedGenre ? 1 : 0.22;
      })
      .attr("stroke", d => d.key === selectedGenre ? "#fff" : "none")
      .attr("stroke-width", d => d.key === selectedGenre ? 1.2 : 0);

    svg.selectAll(".streamgraph-event")
      .classed("is-selected", d => d.id === selectedEventId)
      .classed("is-muted", d => Boolean(selectedEventId && d.id !== selectedEventId));

    drawFocusMarker();
  }

  function bindEventControls(data) {
    const eventById = new Map(events.map(ev => [ev.id, ev]));

    d3.selectAll("[data-streamgraph-event-id]")
      .each(function () {
        const ev = eventById.get(this.dataset.streamgraphEventId);
        const valueNode = this.querySelector(".streamgraph-event-button-value");
        const row = ev && (data.find(d => d.quarter === ev.quarter) || nearestRow(data, ev.date));

        if (ev && valueNode && row) {
          valueNode.textContent = `${ev.genre}: ${numericValue(row[ev.genre]).toFixed(2)}%`;
        }
      })
      .on("click", function () {
        const eventId = this.dataset.streamgraphEventId;
        setSelection(selectedEventId === eventId ? null : eventId);
      });

    d3.selectAll("[data-streamgraph-reset]")
      .on("click", () => setSelection(null));

    updateEventButtons();
    updateEventSummary();
  }

  function drawStreamgraph(rawData) {
    const container = d3.select("#streamgraph");
    if (container.empty()) return;

    container.selectAll("*").remove();
    getTooltip().style("opacity", 0);

    const data = normalizeData(rawData);
    if (!hasUsableData(data)) {
      currentChart = null;
      renderMessage(container, "Streamgraph data is unavailable for the selected period.");
      bindEventControls([]);
      return;
    }

    const rect = document.getElementById("streamgraph").getBoundingClientRect();
    const margin = { top: 42, right: 24, bottom: 40, left: 50 };
    const width = Math.max(rect.width, 400) - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const rootSvg = container.append("svg")
      .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
      .attr("role", "img")
      .attr("aria-label", "Streamgraph of genre popularity over time with annotated world events");

    const svg = rootSvg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const stack = d3.stack()
      .keys(genres)
      .value((d, key) => d[key])
      .offset(d3.stackOffsetWiggle)
      .order(d3.stackOrderInsideOut);

    const series = stack(data);

    const x = d3.scaleTime()
      .domain(d3.extent(data, d => d.date))
      .range([0, width]);

    const yExtent = [
      d3.min(series, s => d3.min(s, d => d[0])),
      d3.max(series, s => d3.max(s, d => d[1]))
    ];

    const y = d3.scaleLinear()
      .domain(yExtent[0] === yExtent[1] ? [-1, 1] : yExtent)
      .range([height, 0]);

    const area = d3.area()
      .x(d => x(d.data.date))
      .y0(d => y(d[0]))
      .y1(d => y(d[1]))
      .curve(d3.curveBasis);

    const tooltip = getTooltip();

    svg.selectAll(".layer")
      .data(series)
      .join("path")
      .attr("class", "layer")
      .attr("d", area)
      .attr("fill", (d, i) => colors[i])
      .attr("opacity", 0.85)
      .on("mouseover", function (event, d) {
        d3.select(this)
          .attr("opacity", 1)
          .attr("stroke", "#fff")
          .attr("stroke-width", 1.2);

        const [mx] = d3.pointer(event, svg.node());
        const row = nearestRow(data, x.invert(mx));

        tooltip
          .style("opacity", 1)
          .html(tooltipHtml(d.key, row));
        moveTooltip(tooltip, event);
      })
      .on("mousemove", function (event, d) {
        const [mx] = d3.pointer(event, svg.node());
        const row = nearestRow(data, x.invert(mx));

        tooltip
          .html(tooltipHtml(d.key, row));
        moveTooltip(tooltip, event);
      })
      .on("mouseout", function () {
        applyHighlight();
        tooltip.style("opacity", 0);
      });

    svg.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(d3.timeYear.every(1)).tickFormat(d3.timeFormat("%Y")));

    const visibleEvents = events.filter(ev => {
      const domain = x.domain();
      return ev.date >= domain[0] && ev.date <= domain[1];
    });

    const eventGroups = svg.selectAll(".streamgraph-event")
      .data(visibleEvents, d => d.id)
      .join("g")
      .attr("class", "streamgraph-event")
      .attr("transform", d => `translate(${x(d.date)},0)`)
      .attr("role", "button")
      .attr("tabindex", 0)
      .attr("aria-label", d => `${d.label}, highlight ${d.genre}`)
      .on("click", function (event, d) {
        event.stopPropagation();
        setSelection(selectedEventId === d.id ? null : d.id);
      })
      .on("keydown", function (event, d) {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        setSelection(selectedEventId === d.id ? null : d.id);
      })
      .on("mouseover", function (event, d) {
        const row = data.find(item => item.quarter === d.quarter) || nearestRow(data, d.date);
        tooltip
          .style("opacity", 1)
          .html(eventTooltipHtml(d, row));
        moveTooltip(tooltip, event);
      })
      .on("mousemove", event => moveTooltip(tooltip, event))
      .on("mouseout", () => tooltip.style("opacity", 0));

    eventGroups.append("line")
      .attr("class", "event-line")
      .attr("x1", 0).attr("x2", 0)
      .attr("y1", 0).attr("y2", height);

    eventGroups.append("circle")
      .attr("class", "streamgraph-event-dot")
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("r", 4);

    const eventLabels = eventGroups.append("g")
      .attr("class", "streamgraph-event-label")
      .attr("transform", (d, i) => `translate(0,${14 + (i % 3) * 20})`);

    eventLabels.append("rect")
      .attr("class", "streamgraph-event-label-bg")
      .attr("rx", 3)
      .attr("ry", 3);

    eventLabels.append("text")
      .attr("class", "event-label")
      .attr("text-anchor", d => {
        const ex = x(d.date);
        if (ex < 78) return "start";
        if (ex > width - 96) return "end";
        return "middle";
      })
      .attr("dy", "0.32em")
      .text(d => d.label);

    eventLabels.each(function () {
      const label = d3.select(this);
      const box = label.select("text").node().getBBox();
      label.select("rect")
        .attr("x", box.x - 6)
        .attr("y", box.y - 4)
        .attr("width", box.width + 12)
        .attr("height", box.height + 8);
    });

    currentChart = { svg, x, y, data, series };

    // Legend (outside plot, below chart)
    const legendContainer = container.append("div")
      .attr("class", "streamgraph-legend")
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

    bindEventControls(data);
    applyHighlight();
  }

  // Load real data
  d3.json("data/streamgraph.json").then(data => {
    drawStreamgraph(data);
    if (window.__streamgraphResizeHandler) {
      window.removeEventListener("resize", window.__streamgraphResizeHandler);
    }

    let resizeFrame = null;
    window.__streamgraphResizeHandler = () => {
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        drawStreamgraph(data);
        resizeFrame = null;
      });
    };

    window.addEventListener("resize", window.__streamgraphResizeHandler);
    window.drawStreamgraph = () => drawStreamgraph(data);
  }).catch(() => {
    const container = d3.select("#streamgraph");
    if (!container.empty()) {
      renderMessage(container, "Streamgraph data could not be loaded.");
    }
  });
})();
