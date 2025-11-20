// tabletennis.js

(function () {
  "use strict";

  const engine = window.TableTennisBo5Engine;

  const oddsHomeInput = document.getElementById("ttOddsHome");
  const oddsAwayInput = document.getElementById("ttOddsAway");
  const marginWinnerInput = document.getElementById("ttMarginWinner");
  const marginBinaryInput = document.getElementById("ttMarginBinary");
  const marginMultiInput = document.getElementById("ttMarginMulti");
  const pointsAInput = document.getElementById("ttPointsA");
  const pointsBInput = document.getElementById("ttPointsB");

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

  [
    oddsHomeInput,
    oddsAwayInput,
    marginWinnerInput,
    marginBinaryInput,
    marginMultiInput,
    pointsAInput,
    pointsBInput,
  ].forEach((input) => {
    input.addEventListener("input", () => runModel(true));
  });

  calcBtn.addEventListener("click", () => runModel(false));

  runModel(true);

  function runModel(autoTriggered) {
    try {
      const oddsHome = parseOdds(oddsHomeInput);
      const oddsAway = parseOdds(oddsAwayInput);
      const marginWinner = parseOverround(marginWinnerInput);
      const marginBinary = parseOverround(marginBinaryInput);
      const marginMulti = parseOverround(marginMultiInput);
      const pointsModel = {
        a: parsePoints(pointsAInput, 15.5),
        b: parsePoints(pointsBInput, 7.5),
      };

      const result = engine.priceAllMarkets({
        oddsHome,
        oddsAway,
        marginWinner,
        marginBinary,
        marginMulti,
        pointsModel,
      });

      renderWinner(result.winner);
      renderFirstSet(result.firstSetWinner);
      renderTotalSets(result.totalSets);
      renderTotalsOverUnder(result.totalSets);
      renderHandicap(result.setsHandicap);
      renderCorrectScore(result.correctScoreMarket);
      renderPointsSummary(result.pointsMarkets);
      renderDetails(result);
      renderSetsDistribution(result.correctScoreMarket);

      statusEl.textContent = `Calculated: odds ${oddsHome.toFixed(
        2
      )} vs ${oddsAway.toFixed(2)} · BO5 assumed.`;
    } catch (err) {
      if (!autoTriggered) {
        statusEl.textContent = err.message || "Calculation failed";
      }
    }
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
    let pct = parseFloat(input.value);
    if (!Number.isFinite(pct)) pct = 0;
    pct = clamp(pct, 0, 100);
    input.value = pct.toFixed(1);
    return 1 + pct / 100;
  }

  function parsePoints(input, fallback) {
    const val = parseFloat(input.value);
    if (!Number.isFinite(val)) {
      input.value = fallback.toFixed(1);
      return fallback;
    }
    input.value = val.toFixed(1);
    return Math.max(0, val);
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
      { label: "Player A", prob: firstSet.priced.homeProb, odds: firstSet.priced.oddsHome },
      { label: "Player B", prob: firstSet.priced.awayProb, odds: firstSet.priced.oddsAway },
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
    ["3", "4", "5"].forEach((label) => {
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
    const lines = [
      {
        label: "3.5 sets",
        over: totalSets.priced.over3_5,
        under: totalSets.priced.under3_5,
      },
      {
        label: "4.5 sets",
        over: totalSets.priced.over4_5,
        under: totalSets.priced.under4_5,
      },
    ];
    lines.forEach((line) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>O/U ${line.label}</td>
        <td>${formatPercent(line.over)} · ${formatOdds(line.over)}</td>
        <td>${formatPercent(line.under)} · ${formatOdds(line.under)}</td>
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
    const priced = setsHandicap.priced;
    const lines = [
      {
        label: "Player A -1.5 / Player B +1.5",
        home: priced.homeMinus1_5,
        away: priced.homePlus1_5,
      },
      {
        label: "Player A -2.5 / Player B +2.5",
        home: priced.homeMinus2_5,
        away: priced.homePlus2_5,
      },
    ];
    lines.forEach((line) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${line.label}</td>
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
    const order = ["3-0", "3-1", "3-2", "0-3", "1-3", "2-3"];
    order.forEach((label) => {
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

    const totalSets = result.totalSets ? result.totalSets.fair : null;
    if (totalSets) {
      const expectedSets =
        3 * totalSets["3"] + 4 * totalSets["4"] + 5 * totalSets["5"];
      detailExpectedSetsEl.textContent = expectedSets.toFixed(2);
    } else {
      detailExpectedSetsEl.textContent = "-";
    }

    const pointsFair = result.pointsMarkets ? result.pointsMarkets.fair : null;
    if (pointsFair && Number.isFinite(pointsFair.expectedMatchPoints)) {
      detailExpectedPointsEl.textContent = pointsFair.expectedMatchPoints.toFixed(1);
    } else {
      detailExpectedPointsEl.textContent = "-";
    }
  }

  function renderSetsDistribution(correctScore) {
    setsDistBody.innerHTML = "";
    if (!correctScore) {
      setsDistBody.innerHTML = `<tr><td colspan="4">Distribution unavailable</td></tr>`;
      return;
    }
    const fair = correctScore.fair;
    const rows = [
      {
        sets: 3,
        matchProb: fair["3-0"] + fair["0-3"],
        pA: fair["3-0"],
        pB: fair["0-3"],
      },
      {
        sets: 4,
        matchProb: fair["3-1"] + fair["1-3"],
        pA: fair["3-1"],
        pB: fair["1-3"],
      },
      {
        sets: 5,
        matchProb: fair["3-2"] + fair["2-3"],
        pA: fair["3-2"],
        pB: fair["2-3"],
      },
    ];
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
})();
