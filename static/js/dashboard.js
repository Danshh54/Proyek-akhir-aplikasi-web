function formatAmount(value) {
  return `INR ${Math.round(Number(value)).toLocaleString("id-ID")}`;
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
