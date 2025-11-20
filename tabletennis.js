// tabletennis.js

(function () {
  "use strict";

  const engine = window.TableTennisEngine || window.TableTennisBo5Engine;

  const oddsHomeInput = document.getElementById("ttOddsHome");
  const oddsAwayInput = document.getElementById("ttOddsAway");
  const marginWinnerInput = document.getElementById("ttMarginWinner");
  const marginBinaryInput = document.getElementById("ttMarginBinary");
  const marginMultiInput = document.getElementById("ttMarginMulti");
  const pointsAInput = document.getElementById("ttPointsA");
  const pointsBInput = document.getElementById("ttPointsB");
  const formatSelect = document.getElementById("ttFormat");

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
  const detailExpectedSetPointsEl = document.getElementById("ttDetailExpectedSetPoints");
  const pointsPerSetEl = document.getElementById("ttPointsPerSet");
  const pointsExpectedEl = document.getElementById("ttPointsExpected");
  const pointsHandicapEl = document.getElementById("ttPointsHandicap");

  [oddsHomeInput, oddsAwayInput].forEach(function (input) {
    if (!input) return;
    input.addEventListener("change", function () {
      runModel(true);
    });
  });

  [
    marginWinnerInput,
    marginBinaryInput,
    marginMultiInput,
    pointsAInput,
    pointsBInput,
    formatSelect,
  ].forEach(function (input) {
    if (!input) return;
    if (input && input.tagName === "SELECT") {
      input.addEventListener("change", function () {
        runModel(true);
      });
    } else {
      input.addEventListener("input", function () {
        runModel(true);
      });
    }
  });

  if (calcBtn) {
    calcBtn.addEventListener("click", function () {
      runModel(false);
    });
  }

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
      const format = formatSelect && formatSelect.value === "bo7" ? "bo7" : "bo5";

      const result = engine.priceAllMarkets({
        oddsHome,
        oddsAway,
        marginWinner,
        marginBinary,
        marginMulti,
        pointsModel,
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
      renderSetsDistribution(result.totalSets, result.correctScoreMarket);
      logSanityWarnings(result, format);

      const formatLabel = format === "bo7" ? "BO7" : "BO5";
      statusEl.textContent = `Calculated: odds ${oddsHome.toFixed(2)} vs ${oddsAway.toFixed(2)} · Format ${formatLabel}.`;
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

  function formatPoints(val, digits = 1) {
    if (!Number.isFinite(val)) return "-";
    return val.toFixed(digits);
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
    rows.forEach(function (row) {
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
      Object.keys(totalSets.priced)
        .sort(function (a, b) {
          return Number(a) - Number(b);
        })
        .forEach(function (label) {
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
    const lines = totalSets.ouLines || [];
    if (!lines.length) {
      totalsOuBody.innerHTML = `<tr><td colspan="3">Lines unavailable</td></tr>`;
      return;
    }
      lines.forEach(function (line) {
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
    const lines = setsHandicap.lines || [];
    if (!lines.length) {
      handicapBody.innerHTML = `<tr><td colspan="3">Handicap unavailable</td></tr>`;
      return;
    }
      lines.forEach(function (line) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>Player A ${line.line.toFixed(1)} / Player B ${(-line.line).toFixed(1)}</td>
          <td>${formatPercent(line.priced.home.prob)} · ${formatOdds(line.priced.home.prob)}</td>
          <td>${formatPercent(line.priced.away.prob)} · ${formatOdds(line.priced.away.prob)}</td>
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
    const labels = Object.keys(correctScore.priced);
    if (!labels.length) {
      correctScoreBody.innerHTML = `<tr><td colspan="3">Correct score unavailable</td></tr>`;
      return;
    }
      const sorted = labels.sort(function (a, b) {
        const [ha, aa] = a.split("-").map(Number);
        const [hb, ab] = b.split("-").map(Number);
        const aHomeWin = ha > aa;
        const bHomeWin = hb > ab;
        if (aHomeWin !== bHomeWin) return aHomeWin ? -1 : 1;
        return aHomeWin ? aa - ab : ha - hb;
      });
      sorted.forEach(function (label) {
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
      pointsPerSetEl.textContent = "-";
      pointsExpectedEl.textContent = "-";
      pointsHandicapEl.textContent = "-";
      return;
    }
    const fair = pointsMarkets.fair || {};
    pointsPerSetEl.textContent = formatPoints(fair.expectedSetPoints);
    pointsExpectedEl.textContent = formatPoints(fair.expectedMatchPoints);
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
      const expectedSets = Object.entries(totalSets).reduce(function (acc, entry) {
        const sets = Number(entry[0]);
        const prob = entry[1];
        return acc + sets * prob;
      }, 0);
      detailExpectedSetsEl.textContent = expectedSets.toFixed(2);
    } else {
      detailExpectedSetsEl.textContent = "-";
    }

    const pointsFair = result.pointsMarkets ? result.pointsMarkets.fair : null;
    detailExpectedPointsEl.textContent = formatPoints(pointsFair && pointsFair.expectedMatchPoints);
    detailExpectedSetPointsEl.textContent = formatPoints(pointsFair && pointsFair.expectedSetPoints);
  }

  function renderSetsDistribution(totalSets, correctScoreMarket) {
    setsDistBody.innerHTML = "";
    if (!totalSets || !totalSets.fair || !correctScoreMarket) {
      setsDistBody.innerHTML = `<tr><td colspan="4">Distribution unavailable</td></tr>`;
      return;
    }
    const fair = totalSets.fair;
    const correctScoreFair = correctScoreMarket.fair || {};

    Object.keys(fair)
      .sort(function (a, b) {
        return Number(a) - Number(b);
      })
      .forEach(function (sets) {
        const matchProb = fair[sets];
        const breakdown = breakdownByWinner(Number(sets));
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${sets}</td>
          <td>${formatPercent(matchProb)}</td>
          <td>${formatPercent(breakdown.homeWin)}</td>
          <td>${formatPercent(breakdown.awayWin)}</td>
        `;
        setsDistBody.appendChild(tr);
      });

    function breakdownByWinner(setsPlayed) {
      let homeWin = 0;
      let awayWin = 0;
      Object.entries(correctScoreFair).forEach(function (entry) {
        const score = entry[0];
        const prob = entry[1];
        const parts = score.split("-").map(Number);
        const home = parts[0];
        const away = parts[1];
        if (home + away === setsPlayed) {
          if (home > away) homeWin += prob;
          else awayWin += prob;
        }
      });
      return { homeWin, awayWin };
    }
  }

  function logSanityWarnings(result, format) {
    const totalSetsFair = result.totalSets ? result.totalSets.fair : null;
    const pointsFair = result.pointsMarkets ? result.pointsMarkets.fair : null;
    const minSets = format === "bo7" ? 4 : 3;
    const maxSets = format === "bo7" ? 7 : 5;

    const totalProb = result.totalSets && result.totalSets.meta ? result.totalSets.meta.totalProb : null;

    if (Number.isFinite(totalProb) && Math.abs(totalProb - 1) > 1e-3) {
      console.warn("Total sets distribution not normalized", { totalProb });
    }

    if (totalSetsFair) {
        const expectedSets = Object.entries(totalSetsFair).reduce(function (acc, entry) {
          const sets = Number(entry[0]);
          const prob = entry[1];
          return acc + sets * prob;
        }, 0);

      if (expectedSets < minSets - 0.05 || expectedSets > maxSets + 0.05) {
        console.warn("Unexpected sets expectation", { expectedSets, minSets, maxSets });
      }
    }

    if (pointsFair) {
      const { expectedMatchPoints, expectedTotalSets, expectedSetPoints } = pointsFair;
      if (
        !Number.isFinite(expectedMatchPoints) ||
        !Number.isFinite(expectedTotalSets) ||
        !Number.isFinite(expectedSetPoints) ||
        expectedMatchPoints <= 0 ||
        expectedTotalSets <= 0 ||
        expectedSetPoints <= 0
      ) {
        console.warn("Unexpected points expectation", pointsFair);
      }
    }
  }
})();
