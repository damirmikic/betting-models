// tabletennis_math.js
// Set probability -> match, sets, and points markets for table tennis

(function () {
  "use strict";

  const POINTS_WIN_SET = 11;
  const POINTS_LOSS_SET = 9;

  function comb(n, k) {
    if (k < 0 || k > n) return 0;
    if (k > n - k) k = n - k;
    let res = 1;
    for (let i = 1; i <= k; i++) {
      res = (res * (n - k + i)) / i;
    }
    return res;
  }

  function clamp01(x) {
    if (!Number.isFinite(x)) return 0.5;
    if (x < 0) return 0;
    if (x > 1) return 1;
    return x;
  }

  function computeMarkets(pSetA, bestOf, margin) {
    pSetA = clamp01(pSetA);
    const pSetB = 1 - pSetA;
    const N = bestOf;
    const K = Math.floor(N / 2) + 1;

    const setPointsSummary = expectedPointsSummaryFromSetProb(pSetA);
    const pointsAWin = setPointsSummary.pointsAWin;
    const pointsBWin = setPointsSummary.pointsBWin;
    const diffAWin = setPointsSummary.diffAWin;
    const diffBWin = setPointsSummary.diffBWin;
    const avgSetPoints = setPointsSummary.avgSetPoints;

    const events = [];

    for (let b = 0; b <= K - 1; b++) {
      const setsPlayed = K + b;
      const prob =
        comb(K - 1 + b, b) *
        Math.pow(pSetA, K) *
        Math.pow(pSetB, b);
      events.push({
        sets: setsPlayed,
        setsA: K,
        setsB: b,
        prob,
      });
    }

    for (let a = 0; a <= K - 1; a++) {
      const setsPlayed = K + a;
      const prob =
        comb(K - 1 + a, a) *
        Math.pow(pSetB, K) *
        Math.pow(pSetA, a);
      events.push({
        sets: setsPlayed,
        setsA: a,
        setsB: K,
        prob,
      });
    }

    const totalProb = events.reduce((sum, e) => sum + e.prob, 0) || 1;
    events.forEach((e) => {
      e.prob /= totalProb;
    });

    let pMatchA = 0;
    let expectedSets = 0;
    let expectedPoints = 0;
    const setsMap = new Map();
    const uniquePointTotals = new Map();

    events.forEach((event) => {
      const { setsA, setsB, sets, prob } = event;
      const totalPoints =
        setsA * pointsAWin + setsB * pointsBWin;
      const diffPoints =
        setsA * diffAWin + setsB * diffBWin;

      expectedSets += sets * prob;
      expectedPoints += totalPoints * prob;

      if (setsA === K) pMatchA += prob;

      const setEntry = setsMap.get(sets) || {
        sets,
        prob: 0,
        probAwin: 0,
        probBwin: 0,
      };
      setEntry.prob += prob;
      if (setsA === K) setEntry.probAwin += prob;
      else setEntry.probBwin += prob;
      setsMap.set(sets, setEntry);

      const roundedPoints = Math.round(totalPoints * 10) / 10;
      const pointEntry = uniquePointTotals.get(roundedPoints) || {
        points: roundedPoints,
        prob: 0,
      };
      pointEntry.prob += prob;
      uniquePointTotals.set(roundedPoints, pointEntry);

      event.totalPoints = totalPoints;
      event.pointDiff = diffPoints;
    });

    const setsDist = Array.from(setsMap.values()).sort(
      (a, b) => a.sets - b.sets
    );

    const marginVal = Number.isFinite(margin) ? Math.max(0, margin) : 0;
    const addMargin = (prob) =>
      marginVal > 0 ? Math.min(0.999, prob * (1 + marginVal)) : prob;

    function setsTotalsVariant(cut) {
      const minSets = K;
      const maxSets = 2 * K - 1;
      const clamped = Math.max(
        minSets,
        Math.min(maxSets, Math.round(cut))
      );
      let over = 0;
      setsDist.forEach((d) => {
        if (d.sets >= clamped) over += d.prob;
      });
      const under = Math.max(0, 1 - over);
      return {
        cutSets: clamped,
        line: clamped - 0.5,
        pOver: over,
        pUnder: under,
        pOver_margined: addMargin(over),
        pUnder_margined: addMargin(under),
      };
    }

    function setsHandicapVariant(lineMagnitude) {
      const neededMargin = Math.max(1, Math.floor(lineMagnitude + 0.5));
      let cover = 0;
      setsDist.forEach((d) => {
        const marginA = 2 * K - d.sets;
        if (marginA >= neededMargin) {
          cover += d.probAwin;
        }
      });
      const plus = Math.max(0, 1 - cover);
      return {
        line: lineMagnitude,
        pA_cover: cover,
        pB_plus: plus,
        pA_cover_margined: addMargin(cover),
        pB_plus_margined: addMargin(plus),
      };
    }

    const roundedSets = Math.round(expectedSets);
    const setsTotals = createLineArray([-1, 0, 1], (delta) =>
      setsTotalsVariant(roundedSets + delta)
    ).filter(
      (line) =>
        line.pOver > 1e-6 &&
        line.pUnder > 1e-6 &&
        line.pOver < 1 - 1e-6 &&
        line.pUnder < 1 - 1e-6
    );

    const setsHandicap = [-1, 0, 1].map((offset) =>
      setsHandicapVariant(Math.max(0.5, 1.5 + offset))
    );

    const minPoints = K * POINTS_WIN_SET;
    const maxPoints = (2 * K - 1) * (POINTS_WIN_SET + POINTS_LOSS_SET);

    function pointsTotalsVariant(lineValue) {
      const minLine = minPoints - 0.5;
      const maxLine = maxPoints - 0.5;
      const clampedLine = Math.max(
        minLine,
        Math.min(maxLine, roundToHalf(lineValue))
      );
      const threshold = Math.floor(clampedLine) + 1;
      let over = 0;
      uniquePointTotals.forEach((entry) => {
        if (entry.points >= threshold) over += entry.prob;
      });
      const under = Math.max(0, 1 - over);
      return {
        cutPoints: threshold,
        line: clampedLine,
        pOver: over,
        pUnder: under,
        pOver_margined: addMargin(over),
        pUnder_margined: addMargin(under),
      };
    }

    function pointsHandicapVariant(linePoints) {
      const minLine = -maxPoints;
      const maxLine = maxPoints;
      const clampedLine = Math.max(
        minLine,
        Math.min(maxLine, roundToHalf(linePoints))
      );
      let cover = 0;
      events.forEach((event) => {
        if (event.pointDiff >= clampedLine) {
          cover += event.prob;
        }
      });
      const plus = Math.max(0, 1 - cover);
      return {
        line: clampedLine,
        pA_cover: cover,
        pB_plus: plus,
        pA_cover_margined: addMargin(cover),
        pB_plus_margined: addMargin(plus),
      };
    }

    const basePointsLine = expectedPoints;
    const pointsTotalCandidates = createLineArray([-4, -2, 0, 2, 4], (delta) =>
      pointsTotalsVariant(basePointsLine + delta * (avgSetPoints / 2))
    ).filter(
      (line) =>
        line.pOver > 1e-6 &&
        line.pUnder > 1e-6 &&
        line.pOver < 1 - 1e-6 &&
        line.pUnder < 1 - 1e-6
    );
    const pointsTotals = pickBalancedLines(pointsTotalCandidates, 1, 0.01);

    const basePointDiff = Math.max(1, Math.abs(diffAWin));
    const pointsHandicapCandidates = [-2, -1, 0, 1, 2].map((offset) =>
      pointsHandicapVariant(basePointDiff * (1.5 + offset * 0.5))
    );
    const pointsHandicap = pickBalancedLines(pointsHandicapCandidates, 1, 0.01);

    const match = {
      pA: pMatchA,
      pB: 1 - pMatchA,
      pA_margined: addMargin(pMatchA),
      pB_margined: addMargin(1 - pMatchA),
    };

    const firstSetTotals = buildFirstSetLine(
      avgSetPoints,
      addMargin
    );

    return {
      pSetA,
      pSetB,
      bestOf: N,
      firstTo: K,
      match,
      totals: setsTotals,
      handicap: setsHandicap,
      pointsTotals,
      pointsHandicap,
      firstSetTotals,
      setsDist,
      expectedSets,
      expectedPoints,
    };
  }

  function createLineArray(deltas, buildFn) {
    const results = [];
    deltas.forEach((delta) => {
      const variant = buildFn(delta);
      if (variant) {
        results.push(variant);
      }
    });
    return results;
  }

  function pickBalancedLines(lines, maxCount, probTolerance = 0.01) {
    if (!lines.length) return [];
    const deduped = dedupeByLine(lines);
    const sorted = deduped
      .sort((a, b) => {
        const diff =
          Math.abs(a.pOver - 0.5) - Math.abs(b.pOver - 0.5);
        if (diff !== 0) return diff;
        return Math.abs(a.line) - Math.abs(b.line);
      });
    const selected = [];
    sorted.forEach((line) => {
      const tooSimilar = selected.some(
        (existing) =>
          Math.abs(existing.pOver - line.pOver) < probTolerance
      );
      if (!tooSimilar) {
        selected.push(line);
      }
    });
    return selected.slice(0, maxCount);
  }

  function dedupeByLine(lines) {
    const map = new Map();
    lines.forEach((line) => {
      const key = line.line.toFixed(1);
      if (!map.has(key)) {
        map.set(key, line);
      }
    });
    return Array.from(map.values());
  }

  function probToOdds(p) {
    if (!Number.isFinite(p) || p <= 0) return "-";
    return (1 / p).toFixed(2);
  }

  function roundToHalf(x) {
    return Math.round(x * 2) / 2;
  }

  function expectedPointsSummaryFromSetProb(P_set) {
    let P = clamp01(P_set);
    let invert = false;
    if (P < 0.5) {
      P = 1 - P;
      invert = true;
    }
    if (Math.abs(P - 0.5) < 1e-6) {
      const summary = expectedPointsSummaryFromRally(0.5);
      return invert ? swapSummary(summary) : summary;
    }
    const pRally = solveRallyProbability(P);
    const summary = expectedPointsSummaryFromRally(pRally);
    return invert ? swapSummary(summary) : summary;
  }

  function solveRallyProbability(target) {
    let low = 0.5;
    let high = 0.999999;
    for (let iter = 0; iter < 60; iter++) {
      const mid = (low + high) / 2;
      const Pmid = probSetWinFromRally(mid);
      if (Pmid < target) low = mid;
      else high = mid;
    }
    return (low + high) / 2;
  }

  function probSetWinFromRally(p) {
    const pClamped = Math.min(Math.max(p, 1e-9), 1 - 1e-9);
    const qClamped = 1 - pClamped;
    let sum = 0;
    for (let k = 0; k <= 9; k++) {
      const ways = comb(10 + k, 10);
      sum +=
        ways *
        Math.pow(pClamped, 11) *
        Math.pow(qClamped, k);
    }
    const probDeuce =
      comb(20, 10) *
      Math.pow(pClamped, 10) *
      Math.pow(qClamped, 10);
    const continueProb = 2 * pClamped * qClamped;
    const probAFromDeuce =
      continueProb >= 1
        ? 0.5
        : (pClamped * pClamped) / (1 - continueProb);
    return sum + probDeuce * probAFromDeuce;
  }

  function expectedPointsSummaryFromRally(p) {
    const pClamped = Math.min(Math.max(p, 1e-9), 1 - 1e-9);
    const qClamped = 1 - pClamped;
    let sumPoints = 0;
    let sumPointsA = 0;
    let sumPointsB = 0;
    let probA = 0;
    let probB = 0;
    let sumDiffA = 0;
    let sumDiffB = 0;

    for (let k = 0; k <= 9; k++) {
      const ways = comb(10 + k, 10);
      const totalPoints = 11 + k;
      const diff = 11 - 2 * k;

      const probAwin =
        ways *
        Math.pow(pClamped, 11) *
        Math.pow(qClamped, k);
      const probBwin =
        ways *
        Math.pow(qClamped, 11) *
        Math.pow(pClamped, k);

      sumPoints += totalPoints * (probAwin + probBwin);
      sumPointsA += totalPoints * probAwin;
      sumPointsB += totalPoints * probBwin;
      probA += probAwin;
      probB += probBwin;
      sumDiffA += diff * probAwin;
      sumDiffB += -diff * probBwin;
    }

    const probDeuce =
      comb(20, 10) *
      Math.pow(pClamped, 10) *
      Math.pow(qClamped, 10);
    const continueProb = 2 * pClamped * qClamped;
    const probAFromDeuce =
      continueProb >= 1
        ? 0.5
        : (pClamped * pClamped) / (1 - continueProb);
    const probBFromDeuce = 1 - probAFromDeuce;
    const probADeuce = probDeuce * probAFromDeuce;
    const probBDeuce = probDeuce * probBFromDeuce;

    const expectedCycles =
      continueProb / Math.max(1 - continueProb, 1e-9);
    const expectedExtraPoints = 2 * expectedCycles + 2;
    const deucePoints = 20 + expectedExtraPoints;

    sumPoints += deucePoints * probDeuce;
    sumPointsA += deucePoints * probADeuce;
    sumPointsB += deucePoints * probBDeuce;
    sumDiffA += 2 * probADeuce;
    sumDiffB += -2 * probBDeuce;
    probA += probADeuce;
    probB += probBDeuce;

    const avgSetPoints =
      sumPoints / Math.max(probA + probB, 1e-9);
    return {
      avgSetPoints,
      pointsAWin: sumPointsA / Math.max(probA, 1e-9),
      pointsBWin: sumPointsB / Math.max(probB, 1e-9),
      diffAWin: sumDiffA / Math.max(probA, 1e-9),
      diffBWin: sumDiffB / Math.max(probB, 1e-9),
    };
  }

  function swapSummary(summary) {
    return {
      avgSetPoints: summary.avgSetPoints,
      pointsAWin: summary.pointsBWin,
      pointsBWin: summary.pointsAWin,
      diffAWin: -summary.diffBWin,
      diffBWin: -summary.diffAWin,
    };
  }

  function buildFirstSetLine(avgPoints, addMargin) {
    const line = roundToHalf(avgPoints);
    const prob = 0.5;
    return {
      line,
      pOver: prob,
      pUnder: prob,
      pOver_margined: addMargin(prob),
      pUnder_margined: addMargin(prob),
    };
  }

  window.TableTennisMath = {
    computeMarkets,
    probToOdds,
  };
})();
