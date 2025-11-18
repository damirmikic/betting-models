// tabletennis.js

(function () {
  "use strict";

  const setProbInput = document.getElementById("ttSetProb");
  const setProbBInput = document.getElementById("ttSetProbB");
  const bestOfSelect = document.getElementById("ttBestOf");
  const marginInput = document.getElementById("ttMargin");
  const calcBtn = document.getElementById("ttCalcBtn");
  const statusEl = document.getElementById("ttStatus");

  const matchProbAEl = document.getElementById("ttMatchProbA");
  const matchProbBEl = document.getElementById("ttMatchProbB");
  const matchOddsAEl = document.getElementById("ttMatchOddsA");
  const matchOddsBEl = document.getElementById("ttMatchOddsB");

  const totalsBody = document.getElementById("ttTotalsBody");
  const handicapBody = document.getElementById("ttHandicapBody");
  const firstSetBody = document.getElementById("ttFirstSetBody");
  const pointsTotalsBody = document.getElementById("ttPointsTotalsBody");
  const pointsHandicapBody = document.getElementById("ttPointsHandicapBody");

  const detailSetProbAEl = document.getElementById("ttDetailSetProbA");
  const detailSetProbBEl = document.getElementById("ttDetailSetProbB");
  const detailBestOfEl = document.getElementById("ttDetailBestOf");
  const detailFirstToEl = document.getElementById("ttDetailFirstTo");
  const detailExpectedSetsEl = document.getElementById("ttDetailExpectedSets");
  const detailExpectedPointsEl = document.getElementById("ttDetailExpectedPoints");
  const setsDistBody = document.getElementById("ttSetsDistBody");

  setProbInput.addEventListener("input", () => {
    updateSetProbB();
    runModel(true);
  });

  bestOfSelect.addEventListener("change", () => runModel(true));
  marginInput.addEventListener("input", () => runModel(true));
  calcBtn.addEventListener("click", () => runModel());

  updateSetProbB();
  runModel(true);

  function updateSetProbB() {
    const pA = parseFloat(setProbInput.value);
    if (!Number.isFinite(pA)) {
      setProbBInput.value = "";
      return;
    }
    setProbBInput.value = (1 - pA).toFixed(2);
  }

  function runModel(autoTriggered = false) {
    let pA = parseFloat(setProbInput.value);
    if (!Number.isFinite(pA) || pA <= 0 || pA >= 1) {
      if (!autoTriggered) {
        statusEl.textContent =
          "Set probability must be between 0 and 1 (exclusive).";
      }
      return;
    }
    pA = clampProbability(pA);

    const bestOf = parseInt(bestOfSelect.value, 10);
    if (!bestOf || bestOf <= 0 || bestOf % 2 === 0) {
      if (!autoTriggered) {
        statusEl.textContent = "Best-of must be a positive odd number.";
      }
      return;
    }

    let margin = parseFloat(marginInput.value);
    if (!Number.isFinite(margin)) margin = 0;
    margin = Math.min(0.2, Math.max(0, margin));
    marginInput.value = margin.toFixed(2);

    const res = window.TableTennisMath.computeMarkets(pA, bestOf, margin);
    renderResults(res);
    statusEl.textContent = `Calculated: P(A set)=${res.pSetA.toFixed(
      3
    )}, best-of ${res.bestOf}, FT${res.firstTo}.`;
  }

  function pct(x) {
    return (x * 100).toFixed(1) + "%";
  }

  function formatPrice(prob, margined) {
    const odds = TableTennisMath.probToOdds(
      typeof margined === "number" ? margined : prob
    );
    return `${pct(prob)} · ${odds}`;
  }

  function clampProbability(x) {
    return Math.min(0.99, Math.max(0.01, x));
  }

  function renderResults(res) {
    const M = res.match;
    const totals = res.totals || [];
    const handicap = res.handicap || [];

    matchProbAEl.textContent = pct(M.pA);
    matchProbBEl.textContent = pct(M.pB);
    matchOddsAEl.textContent = TableTennisMath.probToOdds(
      M.pA_margined || M.pA
    );
    matchOddsBEl.textContent = TableTennisMath.probToOdds(
      M.pB_margined || M.pB
    );

    renderTotalsTable(totals);
    renderHandicapTable(handicap);
    renderPointsTotalsTable(res.pointsTotals || []);
    renderPointsHandicapTable(res.pointsHandicap || []);
    renderFirstSetTable(res.firstSetTotals);
    renderSetsDistribution(res.setsDist || []);

    detailSetProbAEl.textContent = res.pSetA.toFixed(3);
    detailSetProbBEl.textContent = res.pSetB.toFixed(3);
    detailBestOfEl.textContent = res.bestOf;
    detailFirstToEl.textContent = res.firstTo;
    detailExpectedSetsEl.textContent = res.expectedSets
      ? res.expectedSets.toFixed(2)
      : "―";
    detailExpectedPointsEl.textContent = res.expectedPoints
      ? res.expectedPoints.toFixed(1)
      : "―";
  }

  function renderTotalsTable(lines) {
    totalsBody.innerHTML = "";
    if (!lines.length) {
      totalsBody.innerHTML = `<tr><td colspan="3">Totals unavailable</td></tr>`;
      return;
    }
    lines.forEach((line) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>O/U ${line.line.toFixed(1)} sets</td>
        <td>${formatPrice(line.pOver, line.pOver_margined)}</td>
        <td>${formatPrice(line.pUnder, line.pUnder_margined)}</td>
      `;
      totalsBody.appendChild(row);
    });
  }

  function renderHandicapTable(lines) {
    handicapBody.innerHTML = "";
    if (!lines.length) {
      handicapBody.innerHTML =
        `<tr><td colspan="3">Handicap unavailable</td></tr>`;
      return;
    }
    lines.forEach((line) => {
      const val = line.line.toFixed(1);
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>Player A -${val} / Player B +${val}</td>
        <td>${formatPrice(line.pA_cover, line.pA_cover_margined)}</td>
        <td>${formatPrice(line.pB_plus, line.pB_plus_margined)}</td>
      `;
      handicapBody.appendChild(row);
    });
  }

  function renderSetsDistribution(dist) {
    setsDistBody.innerHTML = "";
    if (!dist.length) {
      setsDistBody.innerHTML = `<tr><td colspan="4">Distribution unavailable</td></tr>`;
      return;
    }
    dist.forEach((d) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${d.sets}</td>
        <td>${(d.prob * 100).toFixed(1)}%</td>
        <td>${(d.probAwin * 100).toFixed(1)}%</td>
        <td>${(d.probBwin * 100).toFixed(1)}%</td>
      `;
      setsDistBody.appendChild(row);
    });
  }

  function renderPointsTotalsTable(lines) {
    pointsTotalsBody.innerHTML = "";
    if (!lines.length) {
      pointsTotalsBody.innerHTML = `<tr><td colspan="3">Points totals unavailable</td></tr>`;
      return;
    }
    lines.forEach((line) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>O/U ${line.line.toFixed(1)} points</td>
        <td>${formatPrice(line.pOver, line.pOver_margined)}</td>
        <td>${formatPrice(line.pUnder, line.pUnder_margined)}</td>
      `;
      pointsTotalsBody.appendChild(row);
    });
  }

  function renderPointsHandicapTable(lines) {
    pointsHandicapBody.innerHTML = "";
    if (!lines.length) {
      pointsHandicapBody.innerHTML =
        `<tr><td colspan="3">Points handicap unavailable</td></tr>`;
      return;
    }
    lines.forEach((line) => {
      const val = line.line.toFixed(1);
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>Player A -${val} / Player B +${val}</td>
        <td>${formatPrice(line.pA_cover, line.pA_cover_margined)}</td>
        <td>${formatPrice(line.pB_plus, line.pB_plus_margined)}</td>
      `;
      pointsHandicapBody.appendChild(row);
    });
  }

  function renderFirstSetTable(line) {
    firstSetBody.innerHTML = "";
    if (!line) {
      firstSetBody.innerHTML =
        `<tr><td colspan="3">First set line unavailable</td></tr>`;
      return;
    }
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>O/U ${line.line.toFixed(1)} points</td>
      <td>${formatPrice(line.pOver, line.pOver_margined)}</td>
      <td>${formatPrice(line.pUnder, line.pUnder_margined)}</td>
    `;
    firstSetBody.appendChild(row);
  }
})();
