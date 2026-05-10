// Aspiration vs Reality - diverging bar chart with gap sorting and tooltips.
(function () {
  const CHART_SELECTOR = "#aspiration-chart";
  const TOOLTIP_CLASS = "aspiration-tooltip";
  const SHELVED_COLOR = "#5b8cc9";
  const READ_COLOR = "#e94560";
  const POSITIVE_GAP_COLOR = "#f2a365";
  const NEGATIVE_GAP_COLOR = "#8ecae6";

  let loadedData = [];
  let resizeFrame = null;

  const formatPct = d3.format(".1f");
  const formatGap = value => `${value > 0 ? "+" : ""}${formatPct(value)} pp`;

  function normalizeData(data) {
    if (!Array.isArray(data)) return [];

    return data
      .map(d => {
        const shelved = Number(d.shelved);
        const read = Number(d.read);
        return {
          genre: String(d.genre || "").trim(),
          shelved,
          read,
          gap: shelved - read
        };
      })
      .filter(d => d.genre && Number.isFinite(d.shelved) && Number.isFinite(d.read))
      .sort((a, b) => d3.descending(a.gap, b.gap) || d3.ascending(a.genre, b.genre));
  }

  function renderMessage(message) {
    d3.select(CHART_SELECTOR)
      .selectAll("*")
      .remove();

    d3.selectAll(`.${TOOLTIP_CLASS}`).style("opacity", 0);

    d3.select(CHART_SELECTOR)
      .append("div")
      .attr("class", "aspiration-empty")
      .text(message);
  }

  function tooltip() {
    return d3.select("body")
      .selectAll(`.${TOOLTIP_CLASS}`)
      .data([null])
      .join("div")
      .attr("class", `tooltip ${TOOLTIP_CLASS}`)
      .attr("role", "tooltip")
      .style("opacity", 0);
  }

  function positionTooltip(tip, event) {
    const pageX = event.pageX || 0;
    const pageY = event.pageY || 0;

    tip
      .style("left", `${pageX + 14}px`)
      .style("top", `${pageY - 18}px`);
  }

  function wrapGenreLabels(selection, width) {
    selection.each(function () {
      const text = d3.select(this);
      const words = text.text().split(/\s+/).filter(Boolean);
      const x = Number(text.attr("x"));
      const y = Number(text.attr("y"));
      const lineHeight = 1.05;
      const lines = [];
      let line = [];

      text.text(null);
      const probe = text.append("tspan").attr("x", x).attr("y", y);

      words.forEach(word => {
        line.push(word);
        probe.text(line.join(" "));

        if (probe.node().getComputedTextLength() > width && line.length > 1) {
          line.pop();
          lines.push(line.join(" "));
          line = [word];
          probe.text(word);
        }
      });

      if (line.length) lines.push(line.join(" "));
      probe.remove();

      const displayLines = lines.length > 2
        ? [lines[0], `${lines.slice(1).join(" ").replace(/\s+$/, "")}...`]
        : lines;
      const startDy = -((displayLines.length - 1) * lineHeight) / 2;

      displayLines.forEach((lineText, i) => {
        text.append("tspan")
          .attr("x", x)
          .attr("y", y)
          .attr("dy", `${i === 0 ? startDy : lineHeight}em`)
          .text(lineText);
      });
    });
  }

  function drawAspiration(data) {
    const rows = normalizeData(data);
    const container = d3.select(CHART_SELECTOR);
    const node = container.node();

    if (!node) return;
    if (!rows.length) {
      renderMessage("Aspiration data is not available yet.");
      return;
    }

    container.selectAll("*").remove();

    const bounds = node.getBoundingClientRect();
    const outerWidth = Math.max(bounds.width || node.clientWidth || 760, 340);
    const isCompact = outerWidth < 560;
    const margin = {
      top: isCompact ? 72 : 64,
      right: isCompact ? 54 : 88,
      bottom: 22,
      left: isCompact ? 108 : 168
    };
    const rowHeight = isCompact ? 46 : 42;
    const width = Math.max(outerWidth - margin.left - margin.right, 180);
    const height = rows.length * rowHeight;
    const maxVal = Math.ceil(d3.max(rows, d => Math.max(d.shelved, d.read)) / 5) * 5;
    const barRadius = 4;
    const tip = tooltip();

    const svg = container.append("svg")
      .attr("viewBox", `0 0 ${outerWidth} ${height + margin.top + margin.bottom}`)
      .attr("role", "img")
      .attr("aria-label", "Diverging bar chart comparing Goodreads to-read shelves with actual read interactions by genre.");

    const chart = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
      .domain([-maxVal, maxVal])
      .range([0, width])
      .nice();

    const y = d3.scaleBand()
      .domain(rows.map(d => d.genre))
      .range([0, height])
      .paddingInner(0.26)
      .paddingOuter(0.08);

    const centerX = x(0);

    chart.append("line")
      .attr("class", "aspiration-center-line")
      .attr("x1", centerX)
      .attr("x2", centerX)
      .attr("y1", -8)
      .attr("y2", height)
      .attr("stroke", "rgba(255,255,255,0.38)")
      .attr("stroke-width", 1);

    chart.append("text")
      .attr("class", "aspiration-side-label")
      .attr("x", x(-maxVal * 0.5))
      .attr("y", -38)
      .attr("text-anchor", "middle")
      .attr("fill", SHELVED_COLOR)
      .text("Shelved to-read");

    chart.append("text")
      .attr("class", "aspiration-side-label")
      .attr("x", x(maxVal * 0.5))
      .attr("y", -38)
      .attr("text-anchor", "middle")
      .attr("fill", READ_COLOR)
      .text("Actually read");

    chart.append("text")
      .attr("class", "aspiration-gap-heading")
      .attr("x", width + 8)
      .attr("y", -38)
      .attr("fill", "rgba(255,255,255,0.72)")
      .text("Gap");

    chart.append("text")
      .attr("class", "aspiration-axis-note")
      .attr("x", centerX)
      .attr("y", -16)
      .attr("text-anchor", "middle")
      .attr("fill", "rgba(255,255,255,0.6)")
      .text("Rows sorted by to-read minus read percentage points");

    const row = chart.selectAll(".aspiration-row")
      .data(rows, d => d.genre)
      .join("g")
      .attr("class", "aspiration-row")
      .attr("tabindex", 0)
      .attr("role", "listitem")
      .attr("aria-label", d => `${d.genre}: ${formatPct(d.shelved)} percent to-read, ${formatPct(d.read)} percent actually read, ${formatGap(d.gap)} gap.`)
      .attr("transform", d => `translate(0,${y(d.genre)})`)
      .on("pointerenter focus", function (event, d) {
        const html = [
          `<strong>${d.genre}</strong>`,
          `Shelved to-read: ${formatPct(d.shelved)}%`,
          `Actually read: ${formatPct(d.read)}%`,
          `Gap: ${formatGap(d.gap)}`
        ].join("<br>");

        tip.html(html).style("opacity", 1);
        positionTooltip(tip, event);
        d3.select(this).classed("is-active", true);
      })
      .on("pointermove", event => positionTooltip(tip, event))
      .on("pointerleave blur", function () {
        tip.style("opacity", 0);
        d3.select(this).classed("is-active", false);
      });

    row.append("rect")
      .attr("class", "aspiration-hover-target")
      .attr("x", -margin.left)
      .attr("y", -3)
      .attr("width", outerWidth)
      .attr("height", y.bandwidth() + 6)
      .attr("fill", "transparent");

    row.append("rect")
      .attr("class", "aspiration-bar aspiration-bar-shelved")
      .attr("x", d => x(-d.shelved))
      .attr("y", 0)
      .attr("width", d => centerX - x(-d.shelved))
      .attr("height", y.bandwidth())
      .attr("fill", SHELVED_COLOR)
      .attr("rx", barRadius);

    row.append("rect")
      .attr("class", "aspiration-bar aspiration-bar-read")
      .attr("x", centerX)
      .attr("y", 0)
      .attr("width", d => x(d.read) - centerX)
      .attr("height", y.bandwidth())
      .attr("fill", READ_COLOR)
      .attr("rx", barRadius);

    row.append("text")
      .attr("class", "aspiration-genre-label")
      .attr("x", -12)
      .attr("y", y.bandwidth() / 2)
      .attr("text-anchor", "end")
      .attr("fill", "#e8e8e8")
      .text(d => d.genre)
      .call(wrapGenreLabels, margin.left - 24);

    row.append("text")
      .attr("class", "aspiration-value-label aspiration-label-shelved")
      .attr("x", d => {
        const start = x(-d.shelved);
        const barWidth = centerX - start;
        return barWidth > 44 ? start + 7 : start - 6;
      })
      .attr("y", y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", d => centerX - x(-d.shelved) > 44 ? "start" : "end")
      .attr("fill", d => centerX - x(-d.shelved) > 44 ? "#fff" : SHELVED_COLOR)
      .text(d => `${formatPct(d.shelved)}%`);

    row.append("text")
      .attr("class", "aspiration-value-label aspiration-label-read")
      .attr("x", d => {
        const barWidth = x(d.read) - centerX;
        return barWidth > 44 ? x(d.read) - 7 : x(d.read) + 6;
      })
      .attr("y", y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", d => x(d.read) - centerX > 44 ? "end" : "start")
      .attr("fill", d => x(d.read) - centerX > 44 ? "#fff" : READ_COLOR)
      .text(d => `${formatPct(d.read)}%`);

    row.append("text")
      .attr("class", "aspiration-gap-label")
      .attr("x", width + 8)
      .attr("y", y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("fill", d => d.gap >= 0 ? POSITIVE_GAP_COLOR : NEGATIVE_GAP_COLOR)
      .text(d => formatGap(d.gap));
  }

  function scheduleDraw() {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => drawAspiration(loadedData));
  }

  d3.json("data/aspiration.json")
    .then(data => {
      loadedData = data;
      drawAspiration(loadedData);
      window.addEventListener("resize", scheduleDraw, { passive: true });
    })
    .catch(error => {
      console.error("Failed to load aspiration data", error);
      renderMessage("Aspiration data could not be loaded.");
    });
})();
