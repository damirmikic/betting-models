// tableTennisBo5Engine.js
// Core BO5 pricing utilities exposed via window.TableTennisBo5Engine

(function () {
  "use strict";

  function decimalOddsToFairProb(oddsHome, oddsAway) {
    if (oddsHome <= 1 || oddsAway <= 1) {
      throw new Error("Odds must be > 1.0");
    }
    const pHomeRaw = 1 / oddsHome;
    const pAwayRaw = 1 / oddsAway;
    const sum = pHomeRaw + pAwayRaw;
    return {
      pHome: pHomeRaw / sum,
      pAway: pAwayRaw / sum,
    };
  }

  function applyMarginBinary(p1, p2, targetOverround = 1.05) {
    const factor = targetOverround;
    const p1m = p1 * factor;
    const p2m = p2 * factor;
    return {
      p1: p1m,
      p2: p2m,
      o1: 1 / p1m,
      o2: 1 / p2m,
    };
  }

  function applyMarginMulti(probs, targetOverround = 1.07) {
    const factor = targetOverround;
    const priced = probs.map((p) => {
      const pm = p * factor;
      return {
        p: pm,
        o: 1 / pm,
      };
    });
    return priced;
  }

  function invertBo5ForSetProb(pMatch, tol = 1e-8, maxIter = 100) {
    if (pMatch <= 0 || pMatch >= 1) {
      throw new Error("pMatch must be strictly between 0 and 1");
    }
    let lo = 0.5;
    let hi = 1 - 1e-9;

    function f(s) {
      return 6 * s ** 5 - 15 * s ** 4 + 10 * s ** 3 - pMatch;
    }

    let fLo = f(lo);
    let fHi = f(hi);
    if (fLo * fHi > 0) {
      throw new Error("BO5 inversion failed: f(lo) and f(hi) have same sign");
    }

    for (let i = 0; i < maxIter; i++) {
      const mid = 0.5 * (lo + hi);
      const fMid = f(mid);
      if (Math.abs(fMid) < tol) {
        return mid;
      }
      if (fLo * fMid <= 0) {
        hi = mid;
        fHi = fMid;
      } else {
        lo = mid;
        fLo = fMid;
      }
    }
    return 0.5 * (lo + hi);
  }

  function bo5Distributions(s) {
    const t = 1 - s;

    const pHome3_0 = s ** 3;
    const pHome3_1 = 3 * s ** 3 * t;
    const pHome3_2 = 6 * s ** 3 * t ** 2;

    const pAway3_0 = t ** 3;
    const pAway3_1 = 3 * t ** 3 * s;
    const pAway3_2 = 6 * t ** 3 * s ** 2;

    const p3sets = pHome3_0 + pAway3_0;
    const p4sets = pHome3_1 + pAway3_1;
    const p5sets = pHome3_2 + pAway3_2;

    const pHomeMatch = pHome3_0 + pHome3_1 + pHome3_2;
    const pAwayMatch = 1 - pHomeMatch;

    return {
      pHomeMatch,
      pAwayMatch,
      correctScore: {
        "3-0": pHome3_0,
        "3-1": pHome3_1,
        "3-2": pHome3_2,
        "0-3": pAway3_0,
        "1-3": pAway3_1,
        "2-3": pAway3_2,
      },
      totalSets: {
        3: p3sets,
        4: p4sets,
        5: p5sets,
      },
    };
  }

  function expectedTotalSets(totalSetsDist) {
    return (
      3 * totalSetsDist[3] +
      4 * totalSetsDist[4] +
      5 * totalSetsDist[5]
    );
  }

  function competitivenessIndex(s) {
    return 1 - Math.abs(2 * s - 1);
  }

  function expectedSetPoints(s, params = { a: 15.5, b: 7.5 }) {
    const c = competitivenessIndex(s);
    const { a, b } = params;
    const e = a + b * c;
    return Math.max(e, 0);
  }

  function expectedMatchPoints(s, totalSetsDist, pointsParams) {
    const eSets = expectedTotalSets(totalSetsDist);
    const eSetPts = expectedSetPoints(s, pointsParams);
    return eSets * eSetPts;
  }

  function expectedPointsHandicap(s, eMatchPoints) {
    const bias = 2 * s - 1;
    return eMatchPoints * bias;
  }

  function priceWinnerMarket(oddsHome, oddsAway, marginWinner = 1.05) {
    const { pHome } = decimalOddsToFairProb(oddsHome, oddsAway);
    const s = invertBo5ForSetProb(pHome);
    const dist = bo5Distributions(s);

    const fairHome = dist.pHomeMatch;
    const fairAway = dist.pAwayMatch;

    const withMargin = applyMarginBinary(fairHome, fairAway, marginWinner);
    return {
      s,
      fair: {
        home: fairHome,
        away: fairAway,
        oddsHome: 1 / fairHome,
        oddsAway: 1 / fairAway,
      },
      priced: {
        homeProb: withMargin.p1,
        awayProb: withMargin.p2,
        oddsHome: withMargin.o1,
        oddsAway: withMargin.o2,
      },
    };
  }

  function priceFirstSetWinner(s, marginBinary = 1.05) {
    const pHome = s;
    const pAway = 1 - s;
    const withMargin = applyMarginBinary(pHome, pAway, marginBinary);
    return {
      fair: {
        home: pHome,
        away: pAway,
        oddsHome: 1 / pHome,
        oddsAway: 1 / pAway,
      },
      priced: {
        homeProb: withMargin.p1,
        awayProb: withMargin.p2,
        oddsHome: withMargin.o1,
        oddsAway: withMargin.o2,
      },
    };
  }

  function priceTotalSets(s, totalSetsDist, marginMulti = 1.07) {
    const probs = [totalSetsDist[3], totalSetsDist[4], totalSetsDist[5]];
    const priced = applyMarginMulti(probs, marginMulti);
    return {
      fair: {
        3: probs[0],
        4: probs[1],
        5: probs[2],
      },
      priced: {
        3: { prob: priced[0].p, odds: priced[0].o },
        4: { prob: priced[1].p, odds: priced[1].o },
        5: { prob: priced[2].p, odds: priced[2].o },
        over3_5: priced[1].p + priced[2].p,
        under3_5: priced[0].p,
        over4_5: priced[2].p,
        under4_5: priced[0].p + priced[1].p,
      },
    };
  }

  function priceSetsHandicap(s, correctScore, marginBinary = 1.05) {
    const pHomeMinus1_5 = correctScore["3-0"] + correctScore["3-1"];
    const pHomeMinus2_5 = correctScore["3-0"];

    const m1_5 = applyMarginBinary(
      pHomeMinus1_5,
      1 - pHomeMinus1_5,
      marginBinary
    );
    const m2_5 = applyMarginBinary(
      pHomeMinus2_5,
      1 - pHomeMinus2_5,
      marginBinary
    );

    return {
      fair: {
        homeMinus1_5: pHomeMinus1_5,
        homeMinus2_5: pHomeMinus2_5,
      },
      priced: {
        homeMinus1_5: {
          prob: m1_5.p1,
          odds: m1_5.o1,
        },
        homePlus1_5: {
          prob: m1_5.p2,
          odds: m1_5.o2,
        },
        homeMinus2_5: {
          prob: m2_5.p1,
          odds: m2_5.o1,
        },
        homePlus2_5: {
          prob: m2_5.p2,
          odds: m2_5.o2,
        },
      },
    };
  }

  function priceCorrectScore(correctScore, marginMulti = 1.07) {
    const labels = ["3-0", "3-1", "3-2", "0-3", "1-3", "2-3"];
    const fairProbs = labels.map((k) => correctScore[k]);
    const priced = applyMarginMulti(fairProbs, marginMulti);

    const fair = {};
    const out = {};
    labels.forEach((label, i) => {
      fair[label] = fairProbs[i];
      out[label] = { prob: priced[i].p, odds: priced[i].o };
    });

    return { fair, priced: out };
  }

  function pricePointsMarkets(
    s,
    totalSetsDist,
    pointsParams = { a: 15.5, b: 7.5 }
  ) {
    const eMatchPoints = expectedMatchPoints(s, totalSetsDist, pointsParams);
    const ePointsHandicap = expectedPointsHandicap(s, eMatchPoints);

    return {
      fair: {
        expectedMatchPoints: eMatchPoints,
        expectedPointsHandicap: ePointsHandicap,
      },
    };
  }

  function priceAllMarkets({
    oddsHome,
    oddsAway,
    marginWinner = 1.05,
    marginBinary = 1.05,
    marginMulti = 1.07,
    pointsModel = { a: 15.5, b: 7.5 },
  }) {
    const winner = priceWinnerMarket(oddsHome, oddsAway, marginWinner);
    const s = winner.s;

    const dist = bo5Distributions(s);
    const totalSetsDist = dist.totalSets;
    const correctScore = dist.correctScore;

    const firstSetWinner = priceFirstSetWinner(s, marginBinary);
    const totalSets = priceTotalSets(s, totalSetsDist, marginMulti);
    const setsHandicap = priceSetsHandicap(s, correctScore, marginBinary);
    const correctScoreMarket = priceCorrectScore(correctScore, marginMulti);
    const pointsMarkets = pricePointsMarkets(s, totalSetsDist, pointsModel);

    return {
      inputs: {
        oddsHome,
        oddsAway,
        s,
      },
      winner,
      firstSetWinner,
      totalSets,
      setsHandicap,
      correctScoreMarket,
      pointsMarkets,
    };
  }

  const api = {
    priceAllMarkets,
    priceWinnerMarket,
    priceFirstSetWinner,
    priceTotalSets,
    priceSetsHandicap,
    priceCorrectScore,
    pricePointsMarkets,
    decimalOddsToFairProb,
    invertBo5ForSetProb,
    bo5Distributions,
    expectedTotalSets,
    expectedSetPoints,
    expectedMatchPoints,
    expectedPointsHandicap,
  };

  window.TableTennisBo5Engine = api;
})();
