// snooker_math.js
// Frame probability -> match, totals, handicap markets

(function () {
  "use strict";

  // Combination nCk with stable product form (n <= 32 here)
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
    if (!isFinite(x)) return 0.5;
    if (x < 0) return 0;
    if (x > 1) return 1;
    return x;
  }

  // Core: compute markets from frame probability pA and best-of N
  function computeMarkets(pA, bestOf, margin, state = {}) {
    pA = clamp01(pA);
    const pB = 1 - pA;
    const N = bestOf;
    const K = Math.floor(N / 2) + 1;
    const framesA = Math.max(0, Math.min(K - 1, Math.floor(state.framesA ?? 0)));
    const framesB = Math.max(0, Math.min(K - 1, Math.floor(state.framesB ?? 0)));
    const framesPlayed = framesA + framesB;
    const remainingA = K - framesA;
    const remainingB = K - framesB;

    if (remainingA <= 0 || remainingB <= 0 || framesPlayed >= N) {
      const aAlreadyWon = remainingA <= 0;
      return {
        pFrameA: pA,
        pFrameB: pB,
        bestOf: N,
        firstTo: K,
        match: {
          pA: aAlreadyWon ? 1 : 0,
          pB: aAlreadyWon ? 0 : 1,
          pA_margined: aAlreadyWon ? 1 : 0,
          pB_margined: aAlreadyWon ? 0 : 1,
        },
        totals: [],
        handicap: [],
        framesDist: [],
        expectedFrames: framesPlayed,
      };
    }

    const framesDistMap = new Map();
    let pMatchA = 0;
    let pMatchB = 0;

    function addOutcome(totalFrames, prob, winner) {
      let entry = framesDistMap.get(totalFrames);
      if (!entry) {
        entry = { frames: totalFrames, prob: 0, probAwin: 0, probBwin: 0 };
        framesDistMap.set(totalFrames, entry);
      }
      entry.prob += prob;
      if (winner === "A") entry.probAwin += prob;
      else entry.probBwin += prob;
    }

    for (let b = 0; b <= remainingB - 1; b++) {
      const ways = comb(remainingA - 1 + b, b);
      const prob = ways * Math.pow(pA, remainingA) * Math.pow(pB, b);
      pMatchA += prob;
      const totalFrames = framesPlayed + remainingA + b;
      addOutcome(totalFrames, prob, "A");
    }

    for (let a = 0; a <= remainingA - 1; a++) {
      const ways = comb(remainingB - 1 + a, a);
      const prob = ways * Math.pow(pB, remainingB) * Math.pow(pA, a);
      pMatchB += prob;
      const totalFrames = framesPlayed + remainingB + a;
      addOutcome(totalFrames, prob, "B");
    }

    let framesDist = Array.from(framesDistMap.values()).sort((x, y) => x.frames - y.frames);
    const totalProb = framesDist.reduce((sum, d) => sum + d.prob, 0);
    if (totalProb > 0 && Math.abs(totalProb - 1) > 1e-6) {
      framesDist = framesDist.map((d) => ({
        frames: d.frames,
        prob: d.prob / totalProb,
        probAwin: d.probAwin / totalProb,
        probBwin: d.probBwin / totalProb,
      }));
      pMatchA /= totalProb;
      pMatchB = 1 - pMatchA;
    }

    let expectedFrames = 0;
    framesDist.forEach((d) => {
      expectedFrames += d.frames * d.prob;
    });

    const minFrames = framesDist.length ? framesDist[0].frames : framesPlayed;
    const maxFrames = framesDist.length ? framesDist[framesDist.length - 1].frames : framesPlayed;

    const marginVal = isFinite(margin) ? Math.max(0, margin) : 0;
    function addMargin(prob) {
      if (marginVal <= 0) return prob;
      const scaled = prob * (1 + marginVal);
      return Math.min(0.999, scaled);
    }

    function totalsVariant(cut) {
      const clampedCut = Math.max(minFrames, Math.min(maxFrames, Math.round(cut)));
      let over = 0;
      framesDist.forEach((d) => {
        if (d.frames >= clampedCut) over += d.prob;
      });
      const under = Math.max(0, 1 - over);
      return {
        cutFrames: clampedCut,
        line: clampedCut - 0.5,
        pOver: over,
        pUnder: under,
        pOver_margined: addMargin(over),
        pUnder_margined: addMargin(under),
      };
    }

    function handicapVariant(lineMagnitude) {
      const requiredMargin = Math.max(1, Math.floor(lineMagnitude + 0.5));
      let cover = 0;
      framesDist.forEach((d) => {
        const marginA = 2 * K - d.frames;
        if (marginA >= requiredMargin) {
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

    const roundedE = Math.round(expectedFrames);
    const totalsDeltas = [-2, -1, 0, 1, 2];
    const totalsMap = new Map();
    totalsDeltas.forEach((delta) => {
      const variant = totalsVariant(roundedE + delta);
      const key = variant.line.toFixed(1);
      if (!totalsMap.has(key)) {
        totalsMap.set(key, variant);
      }
    });
    const totalsLines = Array.from(totalsMap.values())
      .filter(
        (variant) =>
          variant.pOver > 1e-6 &&
          variant.pUnder > 1e-6 &&
          variant.pOver < 1 - 1e-6 &&
          variant.pUnder < 1 - 1e-6
      )
      .sort((a, b) => a.line - b.line);

    const baseHandicap = 1.5;
    const handicapOffsets = [-1, 0, 1];
    const handicapLines = handicapOffsets.map((offset) =>
      handicapVariant(Math.max(0.5, baseHandicap + offset))
    );

    const mA = addMargin(pMatchA);
    const mB = addMargin(pMatchB);

    return {
      pFrameA: pA,
      pFrameB: pB,
      bestOf: N,
      firstTo: K,
      match: {
        pA: pMatchA,
        pB: pMatchB,
        pA_margined: mA,
        pB_margined: mB,
      },
      totals: totalsLines,
      handicap: handicapLines,
      framesDist,
      expectedFrames,
    };
  }


  // Odds helper for UI
  function probToOdds(p) {
    if (!isFinite(p) || p <= 0) return "-";
    return (1 / p).toFixed(2);
  }

  // Expose
  window.SnookerMath = {
    computeMarkets,
    probToOdds,
  };
})();
