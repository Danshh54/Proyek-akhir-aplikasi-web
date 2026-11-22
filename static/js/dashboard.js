function formatAmount(value) {
  return `INR ${Math.round(Number(value)).toLocaleString("id-ID")}`;
}

let priceChart;
let airlineChart;
let departureChart;

const bestWindowPlugin = {
  id: "bestWindow",
  beforeDatasetsDraw(chart, args, options) {
    const range = options.window;
    if (!range || range.start === null || range.end === null) return;
    const { ctx, chartArea, scales } = chart;
    const left = Math.min(scales.x.getPixelForValue(range.start), scales.x.getPixelForValue(range.end));
    const right = Math.max(scales.x.getPixelForValue(range.start), scales.x.getPixelForValue(range.end));
    ctx.save();
    ctx.fillStyle = "rgba(34, 197, 94, .14)";
    ctx.fillRect(left, chartArea.top, right - left, chartArea.bottom - chartArea.top);
    ctx.restore();
  },
  afterDraw(chart, args, options) {
    const range = options.window;
    if (!range || range.start === null || range.end === null) return;
    const { ctx, chartArea, scales } = chart;
    const center = (scales.x.getPixelForValue(range.start) + scales.x.getPixelForValue(range.end)) / 2;
    ctx.save();
    ctx.fillStyle = "#15803d";
    ctx.font = "600 11px Poppins, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Waktu terbaik beli", center, chartArea.top + 14);
    ctx.restore();
  },
};

function updatePriceChart(trend, bestWindow) {
  const canvas = document.getElementById("price-chart");
  if (!canvas || typeof Chart === "undefined") return;

  const points = trend
    .map((item) => ({ x: Number(item.days_left), y: Number(item.harga) }))
    .sort((a, b) => b.x - a.x);
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { display: false },
      bestWindow: { window: bestWindow },
      tooltip: {
        callbacks: {
          title: (items) => `${items[0].parsed.x} hari sebelum berangkat`,
          label: (item) => `INR ${Math.round(item.parsed.y).toLocaleString("id-ID")}`,
        },
      },
    },
    scales: {
      x: {
        type: "linear",
        min: 1,
        max: 49,
        reverse: true,
        title: { display: true, text: "hari sebelum berangkat" },
        ticks: {
          stepSize: 7,
          callback: (value) => [49, 35, 21, 7, 1].includes(Number(value)) ? value : "",
        },
      },
      y: {
        title: { display: true, text: "Harga (INR)" },
        ticks: { callback: (value) => Math.round(value).toLocaleString("id-ID") },
      },
    },
  };

  if (!priceChart) {
    priceChart = new Chart(canvas, {
      type: "line",
      data: {
        datasets: [{
          label: "Harga tiket",
          data: points,
          borderColor: "#14568E",
          backgroundColor: "rgba(20, 86, 142, .08)",
          borderWidth: 2,
          pointRadius: 2,
          tension: .25,
          fill: true,
        }],
      },
      options,
      plugins: [bestWindowPlugin],
    });
  } else {
    priceChart.data.datasets[0].data = points;
    priceChart.options.plugins.bestWindow.window = bestWindow;
    priceChart.update();
  }
}

function updateBarChart(chart, canvasId, labels, values, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === "undefined") return chart;
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (item) => `INR ${Math.round(item.raw).toLocaleString("id-ID")}` } },
    },
    scales: {
      x: { ticks: { maxRotation: 45, minRotation: 0 } },
      y: {
        title: { display: true, text: "Harga (INR)" },
        ticks: { callback: (value) => Math.round(value).toLocaleString("id-ID") },
      },
    },
  };
  if (!chart) {
    return new Chart(canvas, {
      type: "bar",
      data: { labels, datasets: [{ data: values, backgroundColor: color, borderRadius: 6 }] },
      options,
    });
  }
  chart.data.labels = labels;
  chart.data.datasets[0].data = values;
  chart.update();
  return chart;
}

function readSummary(summary) {
  const urgent = Math.round(Number(summary.harga_dadakan));
  const safe = Math.round(Number(summary.harga_aman));
  const savings = Math.max(0, urgent - safe);
  const percentage = Number(summary.persentase_hemat).toLocaleString("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const start = Number(summary.waktu_aman_beli.start);
  const end = Number(summary.waktu_aman_beli.end);

  return { urgent, safe, savings, percentage, smaller: Math.min(start, end), larger: Math.max(start, end) };
}

async function fetchDashboardData(asal, tujuan, kelas) {
  const params = new URLSearchParams({ asal, tujuan, kelas });
  const response = await fetch(`/api/dashboard-data?${params}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Data analitik tidak dapat dimuat.");
  return { data, params };
}

function initLandingDashboard() {
  const form = document.getElementById("route-search");
  if (!form) return;

  const asal = document.getElementById("quick-asal");
  const tujuan = document.getElementById("quick-tujuan");
  const kelas = document.getElementById("quick-kelas");
  const results = document.getElementById("dashboard-results");
  const loading = document.getElementById("dashboard-loading");
  const error = document.getElementById("dashboard-error");
  const verdict = document.getElementById("dashboard-verdict");
  const cards = document.getElementById("dashboard-cards");

  function setLoading(isLoading) {
    loading.classList.toggle("hidden", !isLoading);
    form.querySelectorAll("select, button").forEach((element) => { element.disabled = isLoading; });
  }

  async function load(shouldScroll) {
    results.classList.remove("hidden");
    error.classList.add("hidden");
    if (shouldScroll) results.scrollIntoView({ behavior: "smooth", block: "start" });
    if (!asal.value || !tujuan.value || !kelas.value) return;
    if (asal.value === tujuan.value) {
      error.textContent = "Kota asal dan tujuan harus berbeda.";
      error.classList.remove("hidden");
      verdict.classList.add("hidden");
      cards.classList.add("hidden");
      return;
    }

    setLoading(true);
    verdict.classList.add("hidden");
    try {
      const { data, params } = await fetchDashboardData(asal.value, tujuan.value, kelas.value);
      const summary = readSummary(data.summary);
      document.getElementById("harga-dadakan").textContent = formatAmount(summary.urgent);
      document.getElementById("harga-aman").textContent = formatAmount(summary.safe);
      verdict.textContent = `Beli ${summary.smaller} sampai ${summary.larger} hari sebelum berangkat, hemat sekitar INR ${summary.savings.toLocaleString("id-ID")} (${summary.percentage}%)`; //jangan kasih titik
      verdict.classList.remove("hidden");
      document.getElementById("full-analytics-link").href = `/dashboard?${params.toString()}`;
      cards.classList.remove("hidden");
    } catch (err) {
      error.textContent = err.message;
      error.classList.remove("hidden");
      cards.classList.add("hidden");
    } finally {
      setLoading(false);
    }
  }

  form.addEventListener("submit", (event) => { event.preventDefault(); load(true); });
  [asal, tujuan, kelas].forEach((select) => {
    select.addEventListener("change", () => {
      if (!results.classList.contains("hidden")) load(false);
    });
  });
  if (asal.value && tujuan.value && kelas.value) load(false);
}

function initStandaloneDashboard() {
  const form = document.getElementById("dashboard-filters");
  if (!form) return;

  const asal = document.getElementById("dashboard-asal");
  const tujuan = document.getElementById("dashboard-tujuan");
  const kelas = document.getElementById("dashboard-kelas");
  const loading = document.getElementById("dashboard-loading");
  const error = document.getElementById("dashboard-error");
  const summaryElement = document.getElementById("dashboard-summary");

  function setLoading(isLoading) {
    loading.classList.toggle("hidden", !isLoading);
    form.querySelectorAll("select").forEach((select) => { select.disabled = isLoading; });
  }

  async function load() {
    error.classList.add("hidden");
    if (!asal.value || !tujuan.value || !kelas.value) {
      summaryElement.classList.add("hidden");
      return;
    }
    if (asal.value === tujuan.value) {
      error.textContent = "Kota asal dan tujuan harus berbeda.";
      error.classList.remove("hidden");
      summaryElement.classList.add("hidden");
      return;
    }

    setLoading(true);
    try {
      const { data } = await fetchDashboardData(asal.value, tujuan.value, kelas.value);
      const summary = readSummary(data.summary);
      document.getElementById("dashboard-harga-dadakan").textContent = formatAmount(summary.urgent);
      document.getElementById("dashboard-harga-aman").textContent = formatAmount(summary.safe);
      document.getElementById("dashboard-potensi-hemat").textContent = `INR ${summary.savings.toLocaleString("id-ID")} (${summary.percentage}%)`;
      document.getElementById("dashboard-waktu-aman").textContent = `${summary.smaller}-${summary.larger} hari sebelum berangkat`;
      updatePriceChart(data.chart.tren_harga, data.summary.waktu_aman_beli);
      airlineChart = updateBarChart(
        airlineChart,
        "airline-chart",
        data.chart.rata_rata_airline.map((item) => item.airline),
        data.chart.rata_rata_airline.map((item) => Number(item.harga)),
        "rgba(248, 106, 0, .78)"
      );
      departureChart = updateBarChart(
        departureChart,
        "departure-chart",
        data.chart.rata_rata_jam_berangkat.map((item) => item.jam_berangkat.replace("_", " ")),
        data.chart.rata_rata_jam_berangkat.map((item) => Number(item.harga)),
        "rgba(20, 86, 142, .78)"
      );
      summaryElement.classList.remove("hidden");
    } catch (err) {
      error.textContent = err.message;
      error.classList.remove("hidden");
      summaryElement.classList.add("hidden");
    } finally {
      setLoading(false);
    }
  }

  form.addEventListener("change", load);
  if (asal.value && tujuan.value && kelas.value) load();
}

document.addEventListener("DOMContentLoaded", function () {
  initLandingDashboard();
  initStandaloneDashboard();
});
