// snooker.js
// Wire UI to SnookerMath

(function () {
  "use strict";

  // DOM elements
  const frameProbAInput = document.getElementById("frameProbA");
  const frameProbBInput = document.getElementById("frameProbB");
  const bestOfSelect = document.getElementById("bestOfSelect");
  const marginInput = document.getElementById("snookerMargin");
  const calcBtn = document.getElementById("snookerCalcBtn");
  const statusEl = document.getElementById("snookerStatus");

  const currentFramesAInput = document.getElementById("currentFramesA");
  const currentFramesBInput = document.getElementById("currentFramesB");
  const momentumInput = document.getElementById("momentumBoost");
  const pressureInput = document.getElementById("pressureFactor");
  const momentumValueEl = document.getElementById("momentumValue");
  const pressureValueEl = document.getElementById("pressureValue");

  // Output: match winner
  const matchProbAEl = document.getElementById("snookerMatchProbA");
  const matchProbBEl = document.getElementById("snookerMatchProbB");
  const matchOddsAEl = document.getElementById("snookerMatchOddsA");
  const matchOddsBEl = document.getElementById("snookerMatchOddsB");

  // Output: totals / handicap tables
  const totalsBody = document.getElementById("snookerTotalsBody");
  const handicapBody = document.getElementById("snookerHandicapBody");

  // Output: details
  const detailFrameProbAEl = document.getElementById("detailFrameProbA");
  const detailFrameProbBEl = document.getElementById("detailFrameProbB");
  const detailBestOfEl = document.getElementById("detailBestOf");
  const detailFirstToEl = document.getElementById("detailFirstTo");
  const detailExpectedFramesEl = document.getElementById("detailExpectedFrames");
  const framesDistBody = document.getElementById("framesDistBody");

  // Init: set B prob properly
  updateFrameProbB();

  frameProbAInput.addEventListener("input", () => {
    updateFrameProbB();
    runModel(true);
  });

  bestOfSelect.addEventListener("change", () => runModel(true));
  marginInput.addEventListener("input", () => runModel(true));

  calcBtn.addEventListener("click", () => {
    runModel();
  });

  [currentFramesAInput, currentFramesBInput].forEach((input) => {
    input.addEventListener("input", () => {
      sanitizeScoreInput(input);
      runModel(true);
    });
  });

  [momentumInput, pressureInput].forEach((input) => {
    input.addEventListener("input", () => {
      updateDynamicLabels();
      runModel(true);
    });
  });

  updateDynamicLabels();
  runModel(true);

  function updateFrameProbB() {
    const pA = parseFloat(frameProbAInput.value);
    if (!isFinite(pA)) {
      frameProbBInput.value = "";
      return;
    }
    const pB = 1 - pA;
    frameProbBInput.value = pB.toFixed(2);
  }

  function runModel(autoTriggered = false) {
    const pA = parseFloat(frameProbAInput.value);
    if (!isFinite(pA) || pA <= 0 || pA >= 1) {
      if (!autoTriggered) {
        statusEl.textContent =
          "Frame probability for A must be between 0 and 1 (exclusive).";
      }
      return;
    }

    const bestOf = parseInt(bestOfSelect.value, 10);
    if (!bestOf || bestOf <= 0 || bestOf % 2 === 0) {
      if (!autoTriggered) {
        statusEl.textContent = "Best-of must be a positive odd number.";
      }
      return;
    }

    let margin = parseFloat(marginInput.value);
    if (!isFinite(margin)) margin = 0;
    margin = Math.min(0.15, Math.max(0, margin));
    marginInput.value = margin.toFixed(2);

    const firstTo = Math.floor(bestOf / 2) + 1;
    updateScoreBounds(firstTo);
    const framesA = normalizeScoreInput(
      currentFramesAInput,
      Math.max(0, firstTo - 1)
    );
    const framesB = normalizeScoreInput(
      currentFramesBInput,
      Math.max(0, firstTo - 1)
    );

    if (framesA >= firstTo || framesB >= firstTo) {
      statusEl.textContent = "Current score already finishes the match.";
      return;
    }

    if (framesA + framesB >= bestOf) {
      statusEl.textContent = "Frames played must be below total frames.";
      return;
    }

    const dynamicPA = applyInPlayAdjustments(pA, {
      framesA,
      framesB,
      firstTo,
      bestOf,
    });

    const res = window.SnookerMath.computeMarkets(dynamicPA, bestOf, margin, {
      framesA,
      framesB,
    });
    renderResults(res);
    statusEl.textContent = `Calculated: P(A frame)=${res.pFrameA.toFixed(
      3
    )}, best-of ${res.bestOf}, FT${res.firstTo}, score ${framesA}-${framesB}.`;
  }

  function pct(x) {
    return (x * 100).toFixed(1) + "%";
  }

  function formatPrice(prob, margined) {
    const odds = SnookerMath.probToOdds(
      typeof margined === "number" ? margined : prob
    );
    return `${pct(prob)} · ${odds}`;
  }

  function clampProbability(x) {
    return Math.min(0.99, Math.max(0.01, x));
  }

  function normalizeScoreInput(input, maxScore) {
    let val = parseInt(input.value, 10);
    if (!Number.isFinite(val)) val = 0;
    val = Math.max(0, Math.min(maxScore, val));
    if (String(val) !== input.value) {
      input.value = String(val);
    }
    return val;
  }

  function sanitizeScoreInput(input) {
    const bestOf = parseInt(bestOfSelect.value, 10);
    if (!bestOf || bestOf <= 0) return;
    const maxScore = Math.max(0, Math.floor(bestOf / 2));
    normalizeScoreInput(input, maxScore);
  }

  function updateScoreBounds(firstTo) {
    const maxScore = Math.max(0, firstTo - 1);
    currentFramesAInput.setAttribute("max", maxScore);
    currentFramesBInput.setAttribute("max", maxScore);
  }

  function applyInPlayAdjustments(baseProb, meta) {
    const momentum = parseFloat(momentumInput.value) || 0;
    const pressure = parseFloat(pressureInput.value) || 0;

    const scoreDiff = meta.framesA - meta.framesB;
    const normalizedScore = scoreDiff / Math.max(1, meta.bestOf - 1);
    const momentumShift = momentum * normalizedScore;

    const framesNeededA = Math.max(0, meta.firstTo - meta.framesA);
    const framesNeededB = Math.max(0, meta.firstTo - meta.framesB);
    const pressureDiff = (framesNeededB - framesNeededA) / meta.firstTo;
    const pressureShift = pressure * pressureDiff;

    return clampProbability(baseProb + momentumShift + pressureShift);
  }

  function updateDynamicLabels() {
    if (momentumValueEl) {
      const value = Math.round((parseFloat(momentumInput.value) || 0) * 100);
      momentumValueEl.textContent = `${value}%`;
    }
    if (pressureValueEl) {
      const value = Math.round((parseFloat(pressureInput.value) || 0) * 100);
      pressureValueEl.textContent = `${value}%`;
    }
  }

  function renderResults(res) {
    const M = res.match;
    const totalsLines = Array.isArray(res.totals) ? res.totals : [];
    const handicapLines = Array.isArray(res.handicap) ? res.handicap : [];

    // Match winner (using margined probabilities for odds)
    matchProbAEl.textContent = pct(M.pA);
    matchProbBEl.textContent = pct(M.pB);

    matchOddsAEl.textContent = SnookerMath.probToOdds(M.pA_margined || M.pA);
    matchOddsBEl.textContent = SnookerMath.probToOdds(M.pB_margined || M.pB);

    renderTotalsTable(totalsLines);
    renderHandicapTable(handicapLines);

    // Details
    detailFrameProbAEl.textContent = res.pFrameA.toFixed(3);
    detailFrameProbBEl.textContent = res.pFrameB.toFixed(3);
    detailBestOfEl.textContent = res.bestOf;
    detailFirstToEl.textContent = res.firstTo;
    detailExpectedFramesEl.textContent = res.expectedFrames.toFixed(2);

    // Frames distribution list
    framesDistBody.innerHTML = "";
    res.framesDist.forEach((d) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${d.frames}</td>
        <td>${(d.prob * 100).toFixed(1)}%</td>
        <td>${(d.probAwin * 100).toFixed(1)}%</td>
        <td>${(d.probBwin * 100).toFixed(1)}%</td>
      `;
      framesDistBody.appendChild(row);
    });

  }

  function renderTotalsTable(lines) {
    totalsBody.innerHTML = "";
    if (!lines.length) {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="3">Totals unavailable</td>`;
      totalsBody.appendChild(row);
      return;
    }
    lines.forEach((line) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>O/U ${line.line.toFixed(1)} frames</td>
        <td>${formatPrice(line.pOver, line.pOver_margined)}</td>
        <td>${formatPrice(line.pUnder, line.pUnder_margined)}</td>
      `;
      totalsBody.appendChild(row);
    });
  }

  function renderHandicapTable(lines) {
    handicapBody.innerHTML = "";
    if (!lines.length) {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="3">Handicap unavailable</td>`;
      handicapBody.appendChild(row);
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
})();
