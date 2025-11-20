// tableTennisEngine.js
// Core BO5/BO7 pricing utilities exposed via window.TableTennisEngine

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
    return probs.map((p) => {
      const pm = p * factor;
      return { p: pm, o: 1 / pm };
    });
  }

  function getFormatConfig(format) {
    if (format === "bo7") {
      return {
        key: "bo7",
        label: "BO7",
        setsToWin: 4,
        maxSets: 7,
        totalSetCounts: [4, 5, 6, 7],
        handicapMargins: [1.5, 2.5, 3.5],
      };
    }
    return {
      key: "bo5",
      label: "BO5",
      setsToWin: 3,
      maxSets: 5,
      totalSetCounts: [3, 4, 5],
      handicapMargins: [1.5, 2.5],
    };
  }

  function matchProbFromSetProb(format, s) {
    if (format === "bo7") {
      const t = 1 - s;
      return (
        35 * s ** 4 * t ** 3 +
        21 * s ** 5 * t ** 2 +
        7 * s ** 6 * t +
        s ** 7
      );
    }
    return 6 * s ** 5 - 15 * s ** 4 + 10 * s ** 3;
  }

  function invertMatchProbToSetProb(pMatch, format, tol = 1e-8, maxIter = 100) {
    if (pMatch <= 0 || pMatch >= 1) {
      throw new Error("pMatch must be strictly between 0 and 1");
    }

    let lo = 0.5;
    let hi = 1 - 1e-9;

    function f(s) {
      return matchProbFromSetProb(format, s) - pMatch;
    }

    let fLo = f(lo);
    let fHi = f(hi);
    if (fLo * fHi > 0) {
      throw new Error("Inversion failed: f(lo) and f(hi) have same sign");
    }

    for (let i = 0; i < maxIter; i++) {
      const mid = 0.5 * (lo + hi);
      const fMid = f(mid);
      if (Math.abs(fMid) < tol) return mid;
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
      order: ["3-0", "3-1", "3-2", "0-3", "1-3", "2-3"],
      totalSetCounts: [3, 4, 5],
    };
  }

  function bo7Distributions(s) {
    const t = 1 - s;

    const pHome4_0 = s ** 4;
    const pHome4_1 = 4 * s ** 4 * t;
    const pHome4_2 = 10 * s ** 4 * t ** 2;
    const pHome4_3 = 20 * s ** 4 * t ** 3;

    const pAway4_0 = t ** 4;
    const pAway4_1 = 4 * t ** 4 * s;
    const pAway4_2 = 10 * t ** 4 * s ** 2;
    const pAway4_3 = 20 * t ** 4 * s ** 3;

    const p4sets = pHome4_0 + pAway4_0;
    const p5sets = pHome4_1 + pAway4_1;
    const p6sets = pHome4_2 + pAway4_2;
    const p7sets = pHome4_3 + pAway4_3;

    const pHomeMatch = pHome4_0 + pHome4_1 + pHome4_2 + pHome4_3;
    const pAwayMatch = 1 - pHomeMatch;

    return {
      pHomeMatch,
      pAwayMatch,
      correctScore: {
        "4-0": pHome4_0,
        "4-1": pHome4_1,
        "4-2": pHome4_2,
        "4-3": pHome4_3,
        "0-4": pAway4_0,
        "1-4": pAway4_1,
        "2-4": pAway4_2,
        "3-4": pAway4_3,
      },
      totalSets: {
        4: p4sets,
        5: p5sets,
        6: p6sets,
        7: p7sets,
      },
      order: ["4-0", "4-1", "4-2", "4-3", "0-4", "1-4", "2-4", "3-4"],
      totalSetCounts: [4, 5, 6, 7],
    };
  }

  function getDistributions(format, s) {
    return format === "bo7" ? bo7Distributions(s) : bo5Distributions(s);
  }

  function expectedTotalSets(totalSetsDist, counts) {
    return counts.reduce((acc, count) => acc + count * totalSetsDist[count], 0);
  }

  function priceWinnerMarket(oddsHome, oddsAway, marginWinner = 1.05, format) {
    const { pHome } = decimalOddsToFairProb(oddsHome, oddsAway);
    const s = invertMatchProbToSetProb(pHome, format);
    const dist = getDistributions(format, s);

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
      dist,
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

  function priceTotalSets(s, totalSetsDist, marginMulti = 1.07, config) {
    const counts = config.totalSetCounts;
    const fairArray = counts.map((count) => totalSetsDist[count]);
    const pricedArray = applyMarginMulti(fairArray, marginMulti);

    const fair = {};
    const priced = {};
    counts.forEach((count, idx) => {
      fair[count] = fairArray[idx];
      priced[count] = { prob: pricedArray[idx].p, odds: pricedArray[idx].o };
    });

    const lines = counts.slice(0, -1).map((count, idx) => {
      const label = `${count + 0.5}`;
      const overProb = pricedArray.slice(idx + 1).reduce((acc, p) => acc + p.p, 0);
      const underProb = pricedArray.slice(0, idx + 1).reduce((acc, p) => acc + p.p, 0);
      return {
        label,
        overProb,
        underProb,
        overOdds: 1 / overProb,
        underOdds: 1 / underProb,
      };
    });

    return { fair, priced, counts, lines };
  }

  function aggregateMarginProb(correctScore, predicate) {
    return Object.entries(correctScore).reduce((acc, [label, prob]) => {
      const [home, away] = label.split("-").map(Number);
      const margin = home - away;
      if (predicate(home, away, margin)) return acc + prob;
      return acc;
    }, 0);
  }

  function priceSetsHandicap(s, correctScore, marginBinary = 1.05, config) {
    const lines = config.handicapMargins.map((margin) => {
      const requiredMargin = Math.ceil(margin);
      const pHomeCovers = aggregateMarginProb(
        correctScore,
        (home, away, m) => home > away && m >= requiredMargin
      );
      const priced = applyMarginBinary(pHomeCovers, 1 - pHomeCovers, marginBinary);
      return {
        label: margin,
        home: { prob: priced.p1, odds: priced.o1 },
        away: { prob: priced.p2, odds: priced.o2 },
      };
    });

    return { lines };
  }

  function priceCorrectScore(correctScore, order, marginMulti = 1.07) {
    const fairProbs = order.map((k) => correctScore[k]);
    const priced = applyMarginMulti(fairProbs, marginMulti);

    const fair = {};
    const out = {};
    order.forEach((label, i) => {
      fair[label] = fairProbs[i];
      out[label] = { prob: priced[i].p, odds: priced[i].o };
    });

    return { fair, priced: out, order };
  }

  function pricePointsMarkets(s, expectedSets) {
    const expectedMatchPoints = expectedSets * 18.6;
    const expectedPointsHandicap = expectedMatchPoints * (2 * s - 1);
    return {
      fair: {
        expectedMatchPoints,
        expectedPointsHandicap,
      },
    };
  }

  function priceAllMarkets({
    oddsHome,
    oddsAway,
    marginWinner = 1.05,
    marginBinary = 1.05,
    marginMulti = 1.07,
    format = "bo5",
  }) {
    const config = getFormatConfig(format);
    const winner = priceWinnerMarket(oddsHome, oddsAway, marginWinner, config.key);
    const s = winner.s;

    const dist = winner.dist;
    const totalSetsDist = dist.totalSets;
    const correctScore = dist.correctScore;

    const firstSetWinner = priceFirstSetWinner(s, marginBinary);
    const totalSets = priceTotalSets(s, totalSetsDist, marginMulti, config);
    const setsHandicap = priceSetsHandicap(s, correctScore, marginBinary, config);
    const correctScoreMarket = priceCorrectScore(correctScore, dist.order, marginMulti);

    const expectedSets = expectedTotalSets(totalSetsDist, config.totalSetCounts);
    const pointsMarkets = pricePointsMarkets(s, expectedSets);

    return {
      format: config.key,
      meta: {
        label: config.label,
        setsToWin: config.setsToWin,
        maxSets: config.maxSets,
        totalSetCounts: config.totalSetCounts,
        handicapMargins: config.handicapMargins,
      },
      inputs: {
        oddsHome,
        oddsAway,
        s,
      },
      summary: {
        expectedSets,
        expectedMatchPoints: pointsMarkets.fair.expectedMatchPoints,
        expectedPointsHandicap: pointsMarkets.fair.expectedPointsHandicap,
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
    invertMatchProbToSetProb,
    getDistributions,
  };

  window.TableTennisEngine = api;
})();
