// js/charts.js
// Small helpers around Chart.js. Keeps one Chart instance per canvas id and
// destroys the previous one before redrawing, since views re-render often.

const Charts = (() => {
  const instances = {};

  const palette = {
    lime: '#C6FF3D', coral: '#FF6A55', sky: '#5BC8FF', amber: '#FFC24B',
    grid: 'rgba(255,255,255,0.06)', text: '#8A968D'
  };

  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: palette.text, boxWidth: 10, font: { size: 11 } } } },
    scales: {
      x: { ticks: { color: palette.text, font: { size: 11 } }, grid: { color: palette.grid } },
      y: { ticks: { color: palette.text, font: { size: 11 } }, grid: { color: palette.grid }, beginAtZero: true }
    }
  };

  function destroy(id) {
    if (instances[id]) { instances[id].destroy(); delete instances[id]; }
  }

  function line(id, labels, datasets) {
    destroy(id);
    const ctx = document.getElementById(id);
    if (!ctx) return;
    instances[id] = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: datasets.map(d => ({ tension: 0.35, fill: true, pointRadius: 2, borderWidth: 2, ...d })) },
      options: baseOptions
    });
  }

  function bar(id, labels, datasets) {
    destroy(id);
    const ctx = document.getElementById(id);
    if (!ctx) return;
    instances[id] = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: datasets.map(d => ({ borderRadius: 4, ...d })) },
      options: baseOptions
    });
  }

  function doughnut(id, labels, data, colors) {
    destroy(id);
    const ctx = document.getElementById(id);
    if (!ctx) return;
    instances[id] = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: palette.text, boxWidth: 10, font: { size: 11 } } } } }
    });
  }

  return { line, bar, doughnut, destroy, palette };
})();
