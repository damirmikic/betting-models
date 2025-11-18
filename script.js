// CONFIG
let ALPHA = 0.07;
const MIN_LAMBDA = 0.05;
const GOAL_TAIL_TOLERANCE = 1e-4;
const MAX_LAMBDA3 = 10;
const OPTA_URL =
  "https://dataviz.theanalyst.com/opta-power-rankings/pr-reference.json";
const LEAGUES_JSON = "leagues_min.json";

// DOM
const leagueSelect = document.getElementById("leagueSelect");
const homeSelect = document.getElementById("homeTeam");
const awaySelect = document.getElementById("awayTeam");
const calculateBtn = document.getElementById("calculateBtn");
const statusEl = document.getElementById("status");

const alphaSlider = document.getElementById("alphaSlider");
const alphaDisplay = document.getElementById("alphaDisplay");
const alphaValEl = document.getElementById("alphaVal");

const pHomeEl = document.getElementById("pHome");
const pDrawEl = document.getElementById("pDraw");
const pAwayEl = document.getElementById("pAway");
const oHomeEl = document.getElementById("oHome");
const oDrawEl = document.getElementById("oDraw");
const oAwayEl = document.getElementById("oAway");

const avgHomeEl = document.getElementById("avgHome");
const avgAwayEl = document.getElementById("avgAway");
const drawRateEl = document.getElementById("drawRate");

const ratingDiffEl = document.getElementById("ratingDiff");
const egdEl = document.getElementById("egd");
const lambdaHomeEl = document.getElementById("lambdaHome");
const lambdaAwayEl = document.getElementById("lambdaAway");
const lambda3ValEl = document.getElementById("lambda3Val");

// STATE
let teams = [];
let leaguesData = {};
let currentLeague = null;

// INIT
alphaDisplay.textContent = ALPHA.toFixed(3);
alphaValEl.textContent = ALPHA.toFixed(3);

loadLeagues();
loadTeams();

// EVENT LISTENERS
leagueSelect.addEventListener("change", () => {
  const name = leagueSelect.value;
  currentLeague = leaguesData[name] || null;

  if (currentLeague) {
    avgHomeEl.textContent = currentLeague.avgHome.toFixed(2);
    avgAwayEl.textContent = currentLeague.avgAway.toFixed(2);
    if (
      currentLeague.drawRate !== null &&
      currentLeague.drawRate !== undefined &&
      !Number.isNaN(currentLeague.drawRate)
    ) {
      drawRateEl.textContent =
        (currentLeague.drawRate * 100).toFixed(1) + "%";
    } else {
      drawRateEl.textContent = "N/A";
    }
  } else {
    avgHomeEl.textContent = "-";
    avgAwayEl.textContent = "-";
    drawRateEl.textContent = "-";
  }

  maybeEnableButton();
});

homeSelect.addEventListener("change", maybeEnableButton);
awaySelect.addEventListener("change", maybeEnableButton);
calculateBtn.addEventListener("click", handleCalculate);

// Alpha slider: update + live re-calc
alphaSlider.addEventListener("input", () => {
  ALPHA = parseFloat(alphaSlider.value);
  alphaDisplay.textContent = ALPHA.toFixed(3);
  alphaValEl.textContent = ALPHA.toFixed(3);

  if (
    leagueSelect.value &&
    homeSelect.value &&
    awaySelect.value &&
    homeSelect.value !== awaySelect.value
  ) {
    handleCalculate();
  }
});

// LOAD LEAGUES
function loadLeagues() {
  fetch(LEAGUES_JSON)
    .then((res) => res.json())
    .then((data) => {
      leaguesData = data || {};
      Object.keys(leaguesData)
        .sort()
        .forEach((name) => {
          leagueSelect.appendChild(new Option(name, name));
        });
      statusEl.textContent = "Leagues loaded.";
    })
    .catch((err) => {
      console.error(err);
      statusEl.textContent = "Error loading leagues_min.json.";
    });
}

// LOAD TEAMS
function loadTeams() {
  fetch(OPTA_URL)
    .then((res) => res.json())
    .then((data) => {
      teams = data || [];
      populateTeams();
      statusEl.textContent = "Teams loaded.";
    })
    .catch((err) => {
      console.error(err);
      statusEl.textContent =
        "Error loading Opta power rankings (CORS/network).";
    });
}

function populateTeams() {
  homeSelect.innerHTML = '<option value="">Select home team</option>';
  awaySelect.innerHTML = '<option value="">Select away team</option>';

  const sorted = [...teams].sort((a, b) =>
    (a.contestantName || "").localeCompare(b.contestantName || "")
  );

  sorted.forEach((t) => {
    const label =
      t.contestantName || t.contestantShortName || t.contestantCode;
    const val = t.contestantId;
    homeSelect.appendChild(new Option(label, val));
    awaySelect.appendChild(new Option(label, val));
  });
}

// BUTTON ENABLE
function maybeEnableButton() {
  const leagueOk = !!leagueSelect.value;
  const h = homeSelect.value;
  const a = awaySelect.value;
  const teamsOk = h && a && h !== a;

  calculateBtn.disabled = !(leagueOk && teamsOk);

  if (h && a && h === a) {
    statusEl.textContent = "Home and away team must be different.";
  } else if (!leagueOk) {
    statusEl.textContent = "Select a league.";
  } else {
    statusEl.textContent = "";
  }
}

// MAIN CALCULATION
function handleCalculate() {
  if (!currentLeague) {
    statusEl.textContent = "Select a league.";
    return;
  }

  const homeTeam = teams.find((t) => t.contestantId === homeSelect.value);
  const awayTeam = teams.find((t) => t.contestantId === awaySelect.value);

  if (!homeTeam || !awayTeam) {
    statusEl.textContent = "Teams not found in Opta data.";
    return;
  }

  const R_home = Number(homeTeam.currentRating);
  const R_away = Number(awayTeam.currentRating);

  const ratingDiff = R_home - R_away;
  const EGD = ALPHA * ratingDiff;

  const avgHome = currentLeague.avgHome;
  const avgAway = currentLeague.avgAway;
  const targetDraw = currentLeague.drawRate;

  const lambdaHomeRaw = avgHome + EGD / 2;
  const lambdaAwayRaw = avgAway - EGD / 2;

  const lambdaHome = Math.max(MIN_LAMBDA, lambdaHomeRaw);
  const lambdaAway = Math.max(MIN_LAMBDA, lambdaAwayRaw);
  const goalCap = determineGoalCap(lambdaHome, lambdaAway);

  const lambda3 = solveLambda3(lambdaHome, lambdaAway, targetDraw, goalCap);

  const { pHome, pDraw, pAway } = bivariateOutcome(
    lambdaHome,
    lambdaAway,
    lambda3,
    goalCap
  );

  renderResults({
    homeTeam,
    awayTeam,
    R_home,
    R_away,
    ratingDiff,
    EGD,
    avgHome,
    avgAway,
    lambdaHome,
    lambdaAway,
    lambda3,
    pHome,
    pDraw,
    pAway,
  });
}

// BIVARIATE POISSON
function factorial(n) {
  if (n === 0) return 1;
  let v = 1;
  for (let i = 1; i <= n; i++) v *= i;
  return v;
}

function bivariatePMF(i, j, lambda1, lambda2, lambda3) {
  const minVal = Math.min(i, j);
  let sum = 0;
  for (let k = 0; k <= minVal; k++) {
    sum +=
      (Math.pow(lambda1, i - k) *
        Math.pow(lambda2, j - k) *
        Math.pow(lambda3, k)) /
      (factorial(i - k) * factorial(j - k) * factorial(k));
  }
  return Math.exp(-(lambda1 + lambda2 + lambda3)) * sum;
}

function bivariateOutcome(lambdaHome, lambdaAway, lambda3, goalCap) {
  let pH = 0,
    pD = 0,
    pA = 0;

  for (let i = 0; i <= goalCap; i++) {
    for (let j = 0; j <= goalCap; j++) {
      const p = bivariatePMF(i, j, lambdaHome, lambdaAway, lambda3);
      if (i > j) pH += p;
      else if (i < j) pA += p;
      else pD += p;
    }
  }

  return { pHome: pH, pDraw: pD, pAway: pA };
}

// independent Poisson draw
function independentDraw(lambdaHome, lambdaAway, goalCap) {
  const ph = poissonVector(lambdaHome, goalCap);
  const pa = poissonVector(lambdaAway, goalCap);
  let p = 0;
  for (let i = 0; i < ph.length; i++) p += ph[i] * pa[i];
  return p;
}

// bivariate draw
function bivariateDraw(lambdaHome, lambdaAway, lambda3, goalCap) {
  let p = 0;
  for (let i = 0; i <= goalCap; i++) {
    p += bivariatePMF(i, i, lambdaHome, lambdaAway, lambda3);
  }
  return p;
}

function poissonVector(lambda, limit) {
  const probs = new Array(limit + 1);
  probs[0] = Math.exp(-lambda);
  for (let k = 1; k <= limit; k++) {
    probs[k] = (probs[k - 1] * lambda) / k;
  }
  return probs;
}

// solve λ3 from league draw%
function solveLambda3(lambdaHome, lambdaAway, targetDraw, goalCap) {
  if (
    targetDraw === null ||
    targetDraw === undefined ||
    Number.isNaN(targetDraw)
  ) {
    return 0.15; // generic small correlation
  }

  const baseDraw = independentDraw(lambdaHome, lambdaAway, goalCap);
  if (targetDraw <= baseDraw) {
    return 0.0;
  }

  let lo = 0.0;
  let hi = 0.5;
  let pHi = bivariateDraw(lambdaHome, lambdaAway, hi, goalCap);

  while (pHi < targetDraw && hi < MAX_LAMBDA3) {
    lo = hi;
    hi = Math.min(MAX_LAMBDA3, hi * 2);
    pHi = bivariateDraw(lambdaHome, lambdaAway, hi, goalCap);
    if (hi === MAX_LAMBDA3) break;
  }

  if (pHi < targetDraw) {
    return hi;
  }

  let best = hi;
  for (let iter = 0; iter < 40; iter++) {
    const mid = (lo + hi) / 2;
    const p = bivariateDraw(lambdaHome, lambdaAway, mid, goalCap);
    best = mid;
    if (p > targetDraw) hi = mid;
    else lo = mid;
  }

  return best;
}

function determineGoalCap(lambdaHome, lambdaAway) {
  const maxLambda = Math.max(lambdaHome, lambdaAway);
  let cap = Math.max(10, Math.ceil(maxLambda + 6));
  while (
    poissonTailProbability(lambdaHome, cap) > GOAL_TAIL_TOLERANCE ||
    poissonTailProbability(lambdaAway, cap) > GOAL_TAIL_TOLERANCE
  ) {
    cap += 2;
    if (cap >= 40) break;
  }
  return cap;
}

function poissonTailProbability(lambda, limit) {
  if (!Number.isFinite(lambda) || lambda <= 0) {
    return 0;
  }
  let term = Math.exp(-lambda);
  let cumulative = term;
  for (let k = 1; k <= limit; k++) {
    term = (term * lambda) / k;
    cumulative += term;
  }
  return Math.max(0, 1 - cumulative);
}

// RENDER
function renderResults({
  homeTeam,
  awayTeam,
  R_home,
  R_away,
  ratingDiff,
  EGD,
  avgHome,
  avgAway,
  lambdaHome,
  lambdaAway,
  lambda3,
  pHome,
  pDraw,
  pAway,
}) {
  pHomeEl.textContent = (pHome * 100).toFixed(1) + "%";
  pDrawEl.textContent = (pDraw * 100).toFixed(1) + "%";
  pAwayEl.textContent = (pAway * 100).toFixed(1) + "%";

  oHomeEl.textContent = pHome > 0 ? (1 / pHome).toFixed(2) : "-";
  oDrawEl.textContent = pDraw > 0 ? (1 / pDraw).toFixed(2) : "-";
  oAwayEl.textContent = pAway > 0 ? (1 / pAway).toFixed(2) : "-";

  ratingDiffEl.textContent = ratingDiff.toFixed(2);
  egdEl.textContent = EGD.toFixed(3);

  avgHomeEl.textContent = avgHome.toFixed(2);
  avgAwayEl.textContent = avgAway.toFixed(2);

  lambdaHomeEl.textContent = lambdaHome.toFixed(3);
  lambdaAwayEl.textContent = lambdaAway.toFixed(3);
  lambda3ValEl.textContent = lambda3.toFixed(3);

  statusEl.textContent = `Calculated: ${homeTeam.contestantName} (${R_home.toFixed(
    1
  )}) vs ${awayTeam.contestantName} (${R_away.toFixed(
    1
  )}) with alpha=${ALPHA.toFixed(3)}.`;
}
