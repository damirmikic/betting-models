// snooker_math.js
// Frame probability → match, totals, handicap markets

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
  function computeMarkets(pA, bestOf, margin) {
    pA = clamp01(pA);
    const pB = 1 - pA;
    const N = bestOf;
    const K = Math.floor(N / 2) + 1; // first-to-K

    // --- Match winner: P(A wins match) via negative binomial sum ---
    let pMatchA = 0;
    for (let b = 0; b <= K - 1; b++) {
      // A first to K, B has b
      const ways = comb(K - 1 + b, b);
      pMatchA += ways * Math.pow(pA, K) * Math.pow(pB, b);
    }
    const pMatchB = 1 - pMatchA;

    // --- Frames distribution F in [K .. 2K-1] ---
    const framesDist = [];
    let expectedFrames = 0;

    for (let F = K; F <= 2 * K - 1; F++) {
      const winsB = F - K;

      const probAwinF = comb(F - 1, K - 1) * Math.pow(pA, K) * Math.pow(pB, winsB);
      const probBwinF = comb(F - 1, K - 1) * Math.pow(pB, K) * Math.pow(pA, winsB);
      const probTotal = probAwinF + probBwinF;

      framesDist.push({
        frames: F,
        prob: probTotal,
        probAwin: probAwinF,
        probBwin: probBwinF,
      });

      expectedFrames += F * probTotal;
    }

    // --- O/U line ≈ around expected frames ---
    const roundedE = Math.round(expectedFrames);
    const ouLine = roundedE - 0.5;

    let pOver = 0;
    let pUnder = 0;
    framesDist.forEach((d) => {
      if (d.frames >= roundedE) pOver += d.prob;
      else pUnder += d.prob;
    });

    // --- Handicap A -1.5 frames ---
    let pA_cover = 0; // Player A -1.5 frames
    framesDist.forEach((d) => {
      // When A wins match in F frames:
      const marginA = 2 * K - d.frames; // final score: A=K, B=F-K
      if (marginA >= 2) {
        pA_cover += d.probAwin;
      }
    });
    const pB_plus = 1 - pA_cover; // Player B +1.5

    // Apply market margin (simple proportional overround)
    const marginVal = isFinite(margin) ? Math.max(0, margin) : 0;
    function addMargin(prob) {
      if (marginVal <= 0) return prob;
      // naive margin: scale towards 0.5 a bit, or scale probabilities to sum>1
      return prob * (1 + marginVal);
    }

    // Match (2-way)
    let mA = addMargin(pMatchA);
    let mB = addMargin(pMatchB);
    const mSum = mA + mB;
    if (mSum > 0) {
      mA /= mSum;
      mB /= mSum;
    }

    // O/U (2-way)
    let oOver = addMargin(pOver);
    let oUnder = addMargin(pUnder);
    const oSum = oOver + oUnder;
    if (oSum > 0) {
      oOver /= oSum;
      oUnder /= oSum;
    }

    // Handicap (2-way)
    let hA = addMargin(pA_cover);
    let hB = addMargin(pB_plus);
    const hSum = hA + hB;
    if (hSum > 0) {
      hA /= hSum;
      hB /= hSum;
    }

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
      totals: {
        line: ouLine,
        cutFrames: roundedE,
        pOver,
        pUnder,
        pOver_margined: oOver,
        pUnder_margined: oUnder,
      },
      handicap: {
        line: -1.5,
        pA_cover: pA_cover,
        pB_plus: pB_plus,
        pA_cover_margined: hA,
        pB_plus_margined: hB,
      },
      framesDist,
      expectedFrames,
    };
  }

  // Odds helper for UI
  function probToOdds(p) {
    if (!isFinite(p) || p <= 0) return "–";
    return (1 / p).toFixed(2);
  }

  // Expose
  window.SnookerMath = {
    computeMarkets,
    probToOdds,
  };
})();
