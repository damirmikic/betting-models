// tabletennis.js

(function () {
  "use strict";

  const engine = window.TableTennisEngine;

  const formatSelect = document.getElementById("ttFormat");
  const oddsHomeInput = document.getElementById("ttOddsHome");
  const oddsAwayInput = document.getElementById("ttOddsAway");
  const marginWinnerInput = document.getElementById("ttMarginWinner");
  const marginBinaryInput = document.getElementById("ttMarginBinary");
  const marginMultiInput = document.getElementById("ttMarginMulti");

  const calcBtn = document.getElementById("ttCalcBtn");
  const statusEl = document.getElementById("ttStatus");

  const matchProbAEl = document.getElementById("ttMatchProbA");
  const matchProbBEl = document.getElementById("ttMatchProbB");
  const matchOddsAEl = document.getElementById("ttMatchOddsA");
  const matchOddsBEl = document.getElementById("ttMatchOddsB");

  const firstSetBody = document.getElementById("ttFirstSetBody");
  const totalsBody = document.getElementById("ttTotalsBody");
  const totalsOuBody = document.getElementById("ttTotalsOuBody");
  const handicapBody = document.getElementById("ttHandicapBody");
  const correctScoreBody = document.getElementById("ttCorrectScoreBody");
  const setsDistBody = document.getElementById("ttSetsDistBody");

  const detailSetProbAEl = document.getElementById("ttDetailSetProbA");
  const detailSetProbBEl = document.getElementById("ttDetailSetProbB");
  const detailExpectedSetsEl = document.getElementById("ttDetailExpectedSets");
  const detailExpectedPointsEl = document.getElementById("ttDetailExpectedPoints");
  const pointsExpectedEl = document.getElementById("ttPointsExpected");
  const pointsHandicapEl = document.getElementById("ttPointsHandicap");
  const formatNoteEl = document.getElementById("ttFormatNote");

  [formatSelect, oddsAwayInput, marginBinaryInput, marginMultiInput].forEach(
    (input) => {
      input.addEventListener("input", () => runModel(true));
    }
  );

  oddsHomeInput.addEventListener("input", () => {
    autoFillAwayOdds();
    runModel(true);
  });

  marginWinnerInput.addEventListener("input", () => {
    autoFillAwayOdds();
    runModel(true);
  });

  calcBtn.addEventListener("click", () => runModel(false));

  runModel(true);

  function runModel(autoTriggered) {
    try {
      const format = formatSelect.value;
      const oddsHome = parseOdds(oddsHomeInput);
      const oddsAway = parseOdds(oddsAwayInput);
      const marginWinner = parseOverround(marginWinnerInput);
      const marginBinary = parseOverround(marginBinaryInput);
      const marginMulti = parseOverround(marginMultiInput);

      const result = engine.priceAllMarkets({
        oddsHome,
        oddsAway,
        marginWinner,
        marginBinary,
        marginMulti,
        format,
      });

      renderWinner(result.winner);
      renderFirstSet(result.firstSetWinner);
      renderTotalSets(result.totalSets);
      renderTotalsOverUnder(result.totalSets);
      renderHandicap(result.setsHandicap);
      renderCorrectScore(result.correctScoreMarket);
      renderPointsSummary(result.pointsMarkets);
      renderDetails(result);
      renderSetsDistribution(result.correctScoreMarket, result.meta);
      updateFormatNote(result.meta);

      statusEl.textContent = `Calculated: odds ${oddsHome.toFixed(2)} vs ${oddsAway.toFixed(2)} · ${result.meta.label}.`;
    } catch (err) {
      if (!autoTriggered) {
        statusEl.textContent = err.message || "Calculation failed";
      }
    }
  }

  function autoFillAwayOdds() {
    const homeOdds = parseFloat(oddsHomeInput.value);
    const margin = parseOverroundValue(marginWinnerInput);
    if (!Number.isFinite(homeOdds) || homeOdds <= 1 || !Number.isFinite(margin)) {
      return;
    }
    const impliedHomeProb = 1 / homeOdds;
    const targetOverround = margin;
    const impliedAwayProb = targetOverround - impliedHomeProb;
    if (impliedAwayProb <= 0) return;
    const awayOdds = 1 / impliedAwayProb;
    oddsAwayInput.value = awayOdds.toFixed(2);
  }

  function parseOdds(input) {
    const val = parseFloat(input.value);
    if (!Number.isFinite(val) || val <= 1) {
      throw new Error("Odds must be decimal values > 1.00");
    }
    const rounded = Math.max(1.01, val);
    input.value = rounded.toFixed(2);
    return rounded;
  }

  function parseOverround(input) {
    const factor = parseOverroundValue(input);
    input.value = ((factor - 1) * 100).toFixed(1);
    return factor;
  }

  function parseOverroundValue(input) {
    let pct = parseFloat(input.value);
    if (!Number.isFinite(pct)) pct = 0;
    pct = clamp(pct, 0, 100);
    return 1 + pct / 100;
  }

  function clamp(x, lo, hi) {
    return Math.max(lo, Math.min(hi, x));
  }

  function formatPercent(prob) {
    if (!Number.isFinite(prob)) return "-";
    return `${(prob * 100).toFixed(1)}%`;
  }

  function formatOdds(prob) {
    if (!Number.isFinite(prob) || prob <= 0) return "-";
    return (1 / prob).toFixed(2);
  }

  function renderWinner(winner) {
    matchProbAEl.textContent = formatPercent(winner.priced.homeProb);
    matchProbBEl.textContent = formatPercent(winner.priced.awayProb);
    matchOddsAEl.textContent = formatOdds(winner.priced.homeProb);
    matchOddsBEl.textContent = formatOdds(winner.priced.awayProb);
  }

  function renderFirstSet(firstSet) {
    firstSetBody.innerHTML = "";
    if (!firstSet) {
      firstSetBody.innerHTML = `<tr><td colspan="3">First set market unavailable</td></tr>`;
      return;
    }
    const rows = [
      { label: "Player A", prob: firstSet.priced.homeProb },
      { label: "Player B", prob: firstSet.priced.awayProb },
    ];
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.label}</td>
        <td>${formatPercent(row.prob)}</td>
        <td>${formatOdds(row.prob)}</td>
      `;
      firstSetBody.appendChild(tr);
    });
  }

  function renderTotalSets(totalSets) {
    totalsBody.innerHTML = "";
    if (!totalSets) {
      totalsBody.innerHTML = `<tr><td colspan="3">Totals unavailable</td></tr>`;
      return;
    }
    totalSets.counts.forEach((label) => {
      const priced = totalSets.priced[label];
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${label} sets</td>
        <td>${formatPercent(priced.prob)}</td>
        <td>${formatOdds(priced.prob)}</td>
      `;
      totalsBody.appendChild(tr);
    });
  }

  function renderTotalsOverUnder(totalSets) {
    totalsOuBody.innerHTML = "";
    if (!totalSets) {
      totalsOuBody.innerHTML = `<tr><td colspan="3">Lines unavailable</td></tr>`;
      return;
    }
    totalSets.lines.forEach((line) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>O/U ${line.label} sets</td>
        <td>${formatPercent(line.overProb)} · ${line.overOdds.toFixed(2)}</td>
        <td>${formatPercent(line.underProb)} · ${line.underOdds.toFixed(2)}</td>
      `;
      totalsOuBody.appendChild(tr);
    });
  }

  function renderHandicap(setsHandicap) {
    handicapBody.innerHTML = "";
    if (!setsHandicap) {
      handicapBody.innerHTML = `<tr><td colspan="3">Handicap unavailable</td></tr>`;
      return;
    }
    setsHandicap.lines.forEach((line) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>Player A ${-line.label.toFixed(1)} / Player B +${line.label.toFixed(1)}</td>
        <td>${formatPercent(line.home.prob)} · ${formatOdds(line.home.prob)}</td>
        <td>${formatPercent(line.away.prob)} · ${formatOdds(line.away.prob)}</td>
      `;
      handicapBody.appendChild(tr);
    });
  }

  function renderCorrectScore(correctScore) {
    correctScoreBody.innerHTML = "";
    if (!correctScore) {
      correctScoreBody.innerHTML = `<tr><td colspan="3">Correct score unavailable</td></tr>`;
      return;
    }
    correctScore.order.forEach((label) => {
      const priced = correctScore.priced[label];
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${label}</td>
        <td>${formatPercent(priced.prob)}</td>
        <td>${formatOdds(priced.prob)}</td>
      `;
      correctScoreBody.appendChild(tr);
    });
  }

  function renderPointsSummary(pointsMarkets) {
    if (!pointsMarkets) {
      pointsExpectedEl.textContent = "-";
      pointsHandicapEl.textContent = "-";
      return;
    }
    const fair = pointsMarkets.fair || {};
    pointsExpectedEl.textContent = Number.isFinite(fair.expectedMatchPoints)
      ? fair.expectedMatchPoints.toFixed(1)
      : "-";
    pointsHandicapEl.textContent = Number.isFinite(fair.expectedPointsHandicap)
      ? fair.expectedPointsHandicap.toFixed(1)
      : "-";
  }

  function renderDetails(result) {
    const s = result.inputs ? result.inputs.s : null;
    if (!Number.isFinite(s)) {
      detailSetProbAEl.textContent = "-";
      detailSetProbBEl.textContent = "-";
    } else {
      detailSetProbAEl.textContent = s.toFixed(3);
      detailSetProbBEl.textContent = (1 - s).toFixed(3);
    }

    if (result.summary && Number.isFinite(result.summary.expectedSets)) {
      detailExpectedSetsEl.textContent = result.summary.expectedSets.toFixed(2);
    } else {
      detailExpectedSetsEl.textContent = "-";
    }

    if (result.summary && Number.isFinite(result.summary.expectedMatchPoints)) {
      detailExpectedPointsEl.textContent = result.summary.expectedMatchPoints.toFixed(1);
    } else {
      detailExpectedPointsEl.textContent = "-";
    }
  }

  function renderSetsDistribution(correctScore, meta) {
    setsDistBody.innerHTML = "";
    if (!correctScore) {
      setsDistBody.innerHTML = `<tr><td colspan="4">Distribution unavailable</td></tr>`;
      return;
    }
    const fair = correctScore.fair;
    const rows = meta.totalSetCounts.map((sets) => {
      const homeLabel = `${meta.setsToWin}-${sets - meta.setsToWin}`;
      const awayLabel = `${sets - meta.setsToWin}-${meta.setsToWin}`;
      const pA = fair[homeLabel] || 0;
      const pB = fair[awayLabel] || 0;
      return {
        sets,
        matchProb: pA + pB,
        pA,
        pB,
      };
    });

    rows.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.sets}</td>
        <td>${formatPercent(row.matchProb)}</td>
        <td>${formatPercent(row.pA)}</td>
        <td>${formatPercent(row.pB)}</td>
      `;
      setsDistBody.appendChild(tr);
    });
  }

  function updateFormatNote(meta) {
    const copy = meta.setsToWin === 4
      ? "Model uses a BO7 (first-to-four sets) format and derives set probabilities from the implied fair match price."
      : "Model uses a BO5 (first-to-three sets) format and derives set probabilities from the implied fair match price.";
    formatNoteEl.textContent = copy;
  }
})();
