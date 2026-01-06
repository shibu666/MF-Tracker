document.addEventListener("DOMContentLoaded", async () => {

  const BUY_DATE = new Date("2024-09-30");

  const funds = [
    { name: "SBI Innovation Opportunities Fund", invested: 100000, units: 9861.93 },
    { name: "SBI Technology Opportunities Fund", invested: 35000, units: 158.37 },
    { name: "Tata Digital India Fund", invested: 150000, units: 2500.83 },
    { name: "SBI Contra Fund", invested: 44300, units: 113.59 }
  ];

  const portfolioEl = document.getElementById("portfolio");
  const summaryEl = document.getElementById("summary");
  const portfolioValueEl = document.getElementById("portfolioValue");
  const portfolioChangeEl = document.getElementById("portfolioChange");
  const chartCanvas = document.getElementById("portfolioChart");

  /* ===============================
     RESOLVE DIRECT GROWTH SCHEME
     =============================== */
  async function resolveDirectGrowthScheme(fundName) {
    const res = await fetch(
      `https://api.mfapi.in/mf/search?q=${encodeURIComponent(fundName)}`
    );
    const data = await res.json();

    const normalizedTarget = fundName.toLowerCase();

    const candidates = data.filter(s => {
      const name = s.schemeName.toLowerCase();
      return (
        name.includes("direct") &&
        name.includes("growth") &&
        name.includes("fund") &&
        !name.includes("etf") &&
        !name.includes("index") &&
        !name.includes("nifty") &&
        !name.includes("sensex") &&
        !name.includes("idcw") &&
        !name.includes("dividend")
      );
    });

    if (candidates.length === 0) {
      console.error("Scheme resolution failed:", fundName, data);
      throw new Error(`Direct Growth MF not found for ${fundName}`);
    }

    return (
      candidates.find(s =>
        s.schemeName.toLowerCase().includes(normalizedTarget)
      ) || candidates[0]
    );
  }

  async function fetchNAVHistory(schemeCode) {
    const res = await fetch(`https://api.mfapi.in/mf/${schemeCode}`);
    const json = await res.json();

    return json.data
      .map(d => ({
        date: new Date(d.date.split("-").reverse().join("-")),
        nav: parseFloat(d.nav)
      }))
      .filter(d => d.date >= BUY_DATE)
      .reverse();
  }

  async function buildPortfolioHistory() {
    const dailyTotals = {};

    for (const fund of funds) {
      const scheme = await resolveDirectGrowthScheme(fund.name);
      const history = await fetchNAVHistory(scheme.schemeCode);

      history.forEach(h => {
        const key = h.date.toISOString().split("T")[0];
        dailyTotals[key] = (dailyTotals[key] || 0) + (h.nav * fund.units);
      });
    }

    const dates = Object.keys(dailyTotals).sort();
    let lastValue = null;

    const values = dates.map(d => {
      if (dailyTotals[d]) {
        lastValue = dailyTotals[d];
        return dailyTotals[d];
      }
      return lastValue;
    });

    return { dates, values };
  }

  /* ===============================
     LOAD CURRENT PORTFOLIO
     =============================== */
  let totalInvested = 0;
  let totalCurrent = 0;
  portfolioEl.innerHTML = "";

  for (const fund of funds) {
    const scheme = await resolveDirectGrowthScheme(fund.name);
    const history = await fetchNAVHistory(scheme.schemeCode);
    const latest = history[history.length - 1];

    const currentValue = latest.nav * fund.units;
    const pl = currentValue - fund.invested;

    totalInvested += fund.invested;
    totalCurrent += currentValue;

    portfolioEl.innerHTML += `
      <div class="asset">
        <div class="asset-left">
          <div class="asset-name">${scheme.schemeName}</div>
          <div class="asset-meta">
            <span>Invested: ₹${fund.invested.toLocaleString()}</span>
            <span>Current: ₹${currentValue.toFixed(0)}</span>
          </div>
          <div class="label">NAV (${latest.date.toISOString().split("T")[0]}): ₹${latest.nav}</div>
        </div>
        <div class="asset-pl ${pl >= 0 ? "positive" : "negative"}">
          ${pl >= 0 ? "+" : ""}₹${pl.toFixed(0)}
        </div>
      </div>
    `;
  }

  const netPL = totalCurrent - totalInvested;
  const netPLPercent = (netPL / totalInvested) * 100;

  portfolioValueEl.innerText = `₹${Math.round(totalCurrent).toLocaleString()}`;
  portfolioChangeEl.innerText =
    `${netPL >= 0 ? "+" : ""}${netPLPercent.toFixed(2)}%`;
  portfolioChangeEl.className =
    `pill ${netPL >= 0 ? "positive" : "negative"}`;

  summaryEl.innerHTML = `
    <div class="row space"><span>Total Invested</span><span>₹${totalInvested.toLocaleString()}</span></div>
    <div class="row space"><span>Current Value</span><span>₹${totalCurrent.toFixed(2)}</span></div>
    <div class="row space ${netPL >= 0 ? "profit" : "loss"}"><span>Net P/L</span><span>₹${netPL.toFixed(2)}</span></div>
  `;

  /* ===============================
     CHART
     =============================== */
  const { dates, values } = await buildPortfolioHistory();
  const ctx = chartCanvas.getContext("2d");

  new Chart(ctx, {
    type: "line",
    data: {
      labels: dates,
      datasets: [{
        data: values,
        borderColor: "#f5c542",
        borderWidth: 3,
        tension: 0.35,
        fill: false,
        pointRadius: 0,
        spanGaps: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: { display: false }
      }
    }
  });

});
