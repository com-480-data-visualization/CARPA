// Shared configuration for all charts
const CONFIG = {
  colors: {
    accent: "#e94560",
    accentSoft: "#f2a365",
    primary: "#3d5a80",
    teal: "#1b9aaa",
    mint: "#50b8a6",
    lavender: "#d4a5a5",
    sand: "#c4b7a6",
    sky: "#8ecae6",
    purple: "#6a0572",
  },

  // Genre streamgraph palette
  genreColors: [
    "#e94560", "#f2a365", "#6a0572", "#1b9aaa",
    "#50b8a6", "#d4a5a5", "#c4b7a6", "#3d5a80",
    "#ee6c4d", "#8ecae6",
  ],

  margin: { top: 20, right: 30, bottom: 40, left: 50 },

  // Reusable tooltip
  createTooltip() {
    return d3.select("body").append("div").attr("class", "tooltip");
  },

  // Get chart dimensions from a container element
  getDimensions(elementId, margin = this.margin) {
    const rect = document.getElementById(elementId).getBoundingClientRect();
    return {
      width: Math.max(rect.width, 400) - margin.left - margin.right,
      height: 400 - margin.top - margin.bottom,
      margin,
    };
  },

  // Create an SVG with viewBox inside a container
  createSvg(container, width, height, margin) {
    return container
      .append("svg")
      .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
  },
};
