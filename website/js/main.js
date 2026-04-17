// Main controller: scrollytelling, nav highlighting, stat counters
(function () {

  // ── Animated stat counters ───────────────────────────────────────
  function animateCounters() {
    document.querySelectorAll(".stat-number").forEach(el => {
      const target = +el.dataset.target;
      const duration = 2000;
      const start = performance.now();

      function tick(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        el.textContent = Math.floor(eased * target).toLocaleString();
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  // Trigger counters when the stats panel scrolls into view
  const statsObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounters();
        statsObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  const statsPanel = document.getElementById("stats-panel");
  if (statsPanel) statsObserver.observe(statsPanel);

  // ── Sticky nav highlighting ──────────────────────────────────────
  const sections = document.querySelectorAll("section[id]");
  const navLinks = document.querySelectorAll(".nav-link");

  const navObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach(link => {
          link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
        });
      }
    });
  }, { rootMargin: "-40% 0px -55% 0px" });

  sections.forEach(s => navObserver.observe(s));

  // ── Scrollama for streamgraph steps ──────────────────────────────
  if (typeof scrollama !== "undefined") {
    const scroller = scrollama();
    scroller
      .setup({ step: ".step", offset: 0.5, debug: false })
      .onStepEnter(response => {
        const stepNum = response.element.dataset.step;
        // Could highlight specific genre layers based on step
        d3.selectAll("#streamgraph .layer")
          .transition().duration(300)
          .attr("opacity", 0.85);

        if (stepNum === "2") {
          // Highlight Sci-Fi layer
          d3.selectAll("#streamgraph .layer")
            .transition().duration(300)
            .attr("opacity", (d, i) => i === 7 ? 1 : 0.3);
        } else if (stepNum === "3") {
          // Highlight Self-Help layer
          d3.selectAll("#streamgraph .layer")
            .transition().duration(300)
            .attr("opacity", (d, i) => i === 8 ? 1 : 0.3);
        }
      });
  }

})();
