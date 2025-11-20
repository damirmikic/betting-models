// tableTennisBo5Engine.js
// Core BO5/BO7 pricing utilities exposed via window.TableTennisBo5Engine

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

  function normalizeProbabilityMap(probMap) {
    const entries = Object.entries(probMap || {});
    const totalProb = entries.reduce((acc, [, prob]) => acc + Number(prob || 0), 0);
    if (totalProb <= 0) {
      return { normalized: { ...probMap }, totalProb };
    }

    const normalized = {};
    entries.forEach(([key, prob]) => {
      normalized[key] = Number(prob || 0) / totalProb;
    });

    return { normalized, totalProb };
  }

  function combination(n, k) {
    if (k < 0 || k > n) return 0;
    if (k === 0 || k === n) return 1;
    k = Math.min(k, n - k);
    let result = 1;
    for (let i = 1; i <= k; i++) {
      result = (result * (n - k + i)) / i;
    }
    return result;
  }

  function seriesWinProb(s, targetSets) {
    const t = 1 - s;
    let pHomeMatch = 0;
    for (let awayWins = 0; awayWins < targetSets; awayWins++) {
      const ways = combination(targetSets + awayWins - 1, awayWins);
      pHomeMatch += ways * s ** targetSets * t ** awayWins;
    }
    return pHomeMatch;
  }

  function invertForSetProb(pMatch, targetSets, tol = 1e-8, maxIter = 100) {
    if (pMatch <= 0 || pMatch >= 1) {
      throw new Error("pMatch must be strictly between 0 and 1");
    }

    let lo = 1e-9;
    let hi = 1 - 1e-9;

    let fLo = seriesWinProb(lo, targetSets) - pMatch;
    let fHi = seriesWinProb(hi, targetSets) - pMatch;
    if (fLo * fHi > 0) {
      throw new Error("Series inversion failed: f(lo) and f(hi) have same sign");
    }

    for (let i = 0; i < maxIter; i++) {
      const mid = 0.5 * (lo + hi);
      const fMid = seriesWinProb(mid, targetSets) - pMatch;
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

  function boSeriesDistributions(s, targetSets) {
    const t = 1 - s;
    const correctScore = {};
    const totalSets = {};
    let pHomeMatch = 0;
    let pAwayMatch = 0;

    for (let awayWins = 0; awayWins < targetSets; awayWins++) {
      const setsPlayed = targetSets + awayWins;
      const ways = combination(targetSets + awayWins - 1, awayWins);
      const prob = ways * s ** targetSets * t ** awayWins;
      correctScore[`${targetSets}-${awayWins}`] = prob;
      totalSets[setsPlayed] = (totalSets[setsPlayed] || 0) + prob;
      pHomeMatch += prob;
    }

    for (let homeWins = 0; homeWins < targetSets; homeWins++) {
      const setsPlayed = targetSets + homeWins;
      const ways = combination(targetSets + homeWins - 1, homeWins);
      const prob = ways * t ** targetSets * s ** homeWins;
      correctScore[`${homeWins}-${targetSets}`] = prob;
      totalSets[setsPlayed] = (totalSets[setsPlayed] || 0) + prob;
      pAwayMatch += prob;
    }

    return {
      pHomeMatch,
      pAwayMatch,
      correctScore,
      totalSets,
    };
  }

  function expectedTotalSets(totalSetsDist) {
    const { normalized } = normalizeProbabilityMap(totalSetsDist);
    return Object.entries(normalized).reduce(
      (acc, [sets, prob]) => acc + Number(sets) * prob,
      0
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

  function expectedPointsSummary(s, totalSetsDist, pointsParams) {
    const eSetPts = expectedSetPoints(s, pointsParams);
    const eSets = expectedTotalSets(totalSetsDist);
    const expectedMatchPoints = eSets * eSetPts;

    return {
      expectedMatchPoints,
      expectedSetPoints: eSetPts,
      expectedTotalSets: eSets,
    };
  }

  function expectedPointsHandicap(s, eMatchPoints) {
    const bias = 2 * s - 1;
    return eMatchPoints * bias;
  }

  function priceWinnerMarket(
    oddsHome,
    oddsAway,
    marginWinner = 1.05,
    format = "bo5"
  ) {
    const { pHome } = decimalOddsToFairProb(oddsHome, oddsAway);
    const targetSets = format === "bo7" ? 4 : 3;
    const s = invertForSetProb(pHome, targetSets);
    const dist = boSeriesDistributions(s, targetSets);

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

  function priceTotalSets(totalSetsDist, marginMulti = 1.07) {
    const { normalized, totalProb } = normalizeProbabilityMap(totalSetsDist);

    const entries = Object.keys(normalized)
      .map((k) => Number(k))
      .sort((a, b) => a - b);
    const probs = entries.map((key) => normalized[key]);
    const priced = applyMarginMulti(probs, marginMulti);

    const pricedMap = {};
    entries.forEach((sets, i) => {
      pricedMap[sets] = { prob: priced[i].p, odds: priced[i].o };
    });

    const ouLines = [];
    for (let i = 0; i < entries.length - 1; i++) {
      const line = entries[i] + 0.5;
      const over = priced
        .slice(i + 1)
        .reduce((acc, cur) => acc + cur.p, 0);
      const under = priced.slice(0, i + 1).reduce((acc, cur) => acc + cur.p, 0);
      ouLines.push({
        label: `${line.toFixed(1)} sets`,
        over,
        under,
      });
    }

    return {
      fair: entries.reduce((acc, key, idx) => {
        acc[key] = probs[idx];
        return acc;
      }, {}),
      priced: pricedMap,
      ouLines,
      meta: {
        totalProb,
      },
    };
  }

  function priceSetsHandicap(correctScore, marginBinary = 1.05, handicapLines) {
    const lines = handicapLines || [-1.5, -2.5];
    const results = [];
    const scoreEntries = Object.entries(correctScore).map(([score, prob]) => {
      const [home, away] = score.split("-").map(Number);
      return { home, away, prob };
    });

    lines.forEach((line) => {
      let pHomeCovers = 0;
      scoreEntries.forEach(({ home, away, prob }) => {
        if (home + line > away) {
          pHomeCovers += prob;
        }
      });

      const priced = applyMarginBinary(pHomeCovers, 1 - pHomeCovers, marginBinary);
      results.push({
        line,
        fair: {
          home: pHomeCovers,
          away: 1 - pHomeCovers,
        },
        priced: {
          home: { prob: priced.p1, odds: priced.o1 },
          away: { prob: priced.p2, odds: priced.o2 },
        },
      });
    });

    return { lines: results };
  }

  function priceCorrectScore(correctScore, marginMulti = 1.07) {
    const labels = Object.keys(correctScore);
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
    const summary = expectedPointsSummary(s, totalSetsDist, pointsParams);
    const ePointsHandicap = expectedPointsHandicap(s, summary.expectedMatchPoints);

    return {
      fair: {
        expectedMatchPoints: summary.expectedMatchPoints,
        expectedPointsHandicap: ePointsHandicap,
        expectedSetPoints: summary.expectedSetPoints,
        expectedTotalSets: summary.expectedTotalSets,
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
    format = "bo5",
  }) {
    const targetSets = format === "bo7" ? 4 : 3;
    const handicapLines = format === "bo7" ? [-1.5, -2.5, -3.5] : [-1.5, -2.5];
    const winner = priceWinnerMarket(oddsHome, oddsAway, marginWinner, format);
    const s = winner.s;

    const dist = boSeriesDistributions(s, targetSets);
    const totalSetsDist = dist.totalSets;
    const correctScore = dist.correctScore;

    const firstSetWinner = priceFirstSetWinner(s, marginBinary);
    const totalSets = priceTotalSets(totalSetsDist, marginMulti);
    const setsHandicap = priceSetsHandicap(correctScore, marginBinary, handicapLines);
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
    invertForSetProb,
    boSeriesDistributions,
    expectedTotalSets,
    expectedSetPoints,
    expectedMatchPoints,
    expectedPointsHandicap,
    expectedPointsSummary,
  };

  window.TableTennisBo5Engine = api;
  window.TableTennisEngine = api;
})();
