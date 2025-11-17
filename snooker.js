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

  // Output: match winner
  const matchProbAEl = document.getElementById("snookerMatchProbA");
  const matchProbBEl = document.getElementById("snookerMatchProbB");
  const matchOddsAEl = document.getElementById("snookerMatchOddsA");
  const matchOddsBEl = document.getElementById("snookerMatchOddsB");

  // Output: totals
  const ouLineLabelEl = document.getElementById("snookerOuLineLabel");
  const pOverEl = document.getElementById("snookerPOv");
  const pUnderEl = document.getElementById("snookerPUnder");
  const oddsOverEl = document.getElementById("snookerOddsOver");
  const oddsUnderEl = document.getElementById("snookerOddsUnder");

  // Output: handicap
  const hcapLabelEl = document.getElementById("snookerHcapLabel");
  const pHcapAEl = document.getElementById("snookerPHcapA");
  const pHcapBEl = document.getElementById("snookerPHcapB");
  const oddsHcapAEl = document.getElementById("snookerOddsHcapA");
  const oddsHcapBEl = document.getElementById("snookerOddsHcapB");

  // Output: details
  const detailFrameProbAEl = document.getElementById("detailFrameProbA");
  const detailFrameProbBEl = document.getElementById("detailFrameProbB");
  const detailBestOfEl = document.getElementById("detailBestOf");
  const detailFirstToEl = document.getElementById("detailFirstTo");
  const detailExpectedFramesEl = document.getElementById("detailExpectedFrames");
  const framesDistContainer = document.getElementById("framesDistContainer");

  // Init: set B prob properly
  updateFrameProbB();

  frameProbAInput.addEventListener("input", () => {
    updateFrameProbB();
  });

  calcBtn.addEventListener("click", () => {
    runModel();
  });

  function updateFrameProbB() {
    const pA = parseFloat(frameProbAInput.value);
    if (!isFinite(pA)) {
      frameProbBInput.value = "";
      return;
    }
    const pB = 1 - pA;
    frameProbBInput.value = pB.toFixed(2);
  }

  function runModel() {
    const pA = parseFloat(frameProbAInput.value);
    if (!isFinite(pA) || pA <= 0 || pA >= 1) {
      statusEl.textContent = "Frame probability for A must be between 0 and 1 (exclusive).";
      return;
    }

    const bestOf = parseInt(bestOfSelect.value, 10);
    if (!bestOf || bestOf <= 0 || bestOf % 2 === 0) {
      statusEl.textContent = "Best-of must be a positive odd number.";
      return;
    }

    let margin = parseFloat(marginInput.value);
    if (!isFinite(margin) || margin < 0) margin = 0;

    const res = window.SnookerMath.computeMarkets(pA, bestOf, margin);
    renderResults(res);
  }

  function pct(x) {
    return (x * 100).toFixed(1) + "%";
  }

  function renderResults(res) {
    const M = res.match;
    const T = res.totals;
    const H = res.handicap;

    // Match winner (using margined probabilities for odds)
    matchProbAEl.textContent = pct(M.pA);
    matchProbBEl.textContent = pct(M.pB);

    matchOddsAEl.textContent = SnookerMath.probToOdds(M.pA_margined || M.pA);
    matchOddsBEl.textContent = SnookerMath.probToOdds(M.pB_margined || M.pB);

    // Totals
    ouLineLabelEl.textContent = "O/U " + T.line.toFixed(1) + " frames";
    pOverEl.textContent = pct(T.pOver);
    pUnderEl.textContent = pct(T.pUnder);

    oddsOverEl.textContent = SnookerMath.probToOdds(T.pOver_margined || T.pOver);
    oddsUnderEl.textContent = SnookerMath.probToOdds(T.pUnder_margined || T.pUnder);

    // Handicap A -1.5
    hcapLabelEl.textContent = "Player A -1.5 frames";
    pHcapAEl.textContent = pct(H.pA_cover);
    pHcapBEl.textContent = pct(H.pB_plus);

    oddsHcapAEl.textContent = SnookerMath.probToOdds(H.pA_cover_margined || H.pA_cover);
    oddsHcapBEl.textContent = SnookerMath.probToOdds(H.pB_plus_margined || H.pB_plus);

    // Details
    detailFrameProbAEl.textContent = res.pFrameA.toFixed(3);
    detailFrameProbBEl.textContent = res.pFrameB.toFixed(3);
    detailBestOfEl.textContent = res.bestOf;
    detailFirstToEl.textContent = res.firstTo;
    detailExpectedFramesEl.textContent = res.expectedFrames.toFixed(2);

    // Frames distribution list
    framesDistContainer.innerHTML = "";
    res.framesDist.forEach((d) => {
      const row = document.createElement("div");
      row.textContent =
        `${d.frames} frames: ` +
        `${(d.prob * 100).toFixed(1)}% ` +
        `(A wins: ${(d.probAwin * 100).toFixed(1)}%, ` +
        `B wins: ${(d.probBwin * 100).toFixed(1)}%)`;
      framesDistContainer.appendChild(row);
    });

    statusEl.textContent = `Calculated: P(A frame)=${res.pFrameA.toFixed(
      3
    )}, best-of ${res.bestOf}, FT${res.firstTo}.`;
  }
})();
