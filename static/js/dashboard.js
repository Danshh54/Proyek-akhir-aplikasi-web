document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("route-search");
  const asal = document.getElementById("quick-asal");
  const tujuan = document.getElementById("quick-tujuan");
  const kelas = document.getElementById("quick-kelas");
  const results = document.getElementById("dashboard-results");
  const loading = document.getElementById("dashboard-loading");
  const error = document.getElementById("dashboard-error");
  const verdict = document.getElementById("dashboard-verdict");
  const cards = document.getElementById("dashboard-cards");

  function formatAmount(value) {
    return value === null || value === undefined
      ? "-"
      : `INR ${Math.round(Number(value)).toLocaleString("id-ID")}`;
  }

  function setLoading(isLoading) {
    loading.classList.toggle("hidden", !isLoading);
    form.querySelectorAll("select, button").forEach((element) => {
      element.disabled = isLoading;
    });
  }

  function showError(message) {
    error.textContent = message;
    error.classList.remove("hidden");
    verdict.classList.add("hidden");
    cards.classList.add("hidden");
  }

  async function loadDashboardData(shouldScroll) {
    results.classList.remove("hidden");
    error.classList.add("hidden");

    if (shouldScroll) results.scrollIntoView({ behavior: "smooth", block: "start" });
    if (!asal.value || !tujuan.value || !kelas.value) {
      verdict.classList.add("hidden");
      cards.classList.add("hidden");
      return;
    }
    if (asal.value === tujuan.value) {
      showError("Kota asal dan tujuan harus berbeda.");
      return;
    }

    setLoading(true);
    verdict.classList.add("hidden");
    try {
      const params = new URLSearchParams({ asal: asal.value, tujuan: tujuan.value, kelas: kelas.value });
      const response = await fetch(`/api/dashboard-data?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Data dashboard tidak dapat dimuat.");

      const summary = data.summary;
      const urgent = Math.round(Number(summary.harga_dadakan));
      const safe = Math.round(Number(summary.harga_aman));
      const savings = Math.max(0, urgent - safe);
      const percentage = Math.round(Number(summary.persentase_hemat)).toLocaleString("id-ID");
      const start = Number(summary.waktu_aman_beli.start);
      const end = Number(summary.waktu_aman_beli.end);
      const smaller = Math.min(start, end);
      const larger = Math.max(start, end);

      document.getElementById("harga-dadakan").textContent = formatAmount(urgent);
      document.getElementById("harga-aman").textContent = formatAmount(safe);
      verdict.textContent = `Beli ${smaller} sampai ${larger} hari sebelum berangkat, hemat sekitar INR ${savings.toLocaleString("id-ID")} (${percentage}%).`;
      verdict.classList.remove("hidden");
      document.getElementById("full-analytics-link").href = `/dashboard?${params.toString()}`;
      cards.classList.remove("hidden");
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    loadDashboardData(true);
  });

  [asal, tujuan, kelas].forEach((select) => {
    select.addEventListener("change", function () {
      if (!results.classList.contains("hidden")) loadDashboardData(false);
    });
  });

  if (asal.value && tujuan.value && kelas.value) loadDashboardData(false);
});
