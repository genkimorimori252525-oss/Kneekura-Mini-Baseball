/**
 * Offline, OOTP-executable-free historical comparison for Mini Baseball.
 * Consumes compact statistical aggregates, never the OOTP game engine
 * or OOTP game's unexported current player ratings.
 *
 * Run: node tools/player-reconstruction/compute-oh-mini-benchmark.mjs
 * This computes observations for a future Mini-only calibration. It does NOT
 * assign a player skill, modify physics, or certify a season simulation.
 */
import { readFile } from 'node:fs/promises';

const read = async (relative) => JSON.parse(
  await readFile(new URL(relative, import.meta.url), 'utf8')
);
const [player, league] = await Promise.all([
  read('../../docs/player-reconstruction/cases/sadaharu-oh-1974-ootp-editor-input.json'),
  read('../../docs/player-reconstruction/cases/sadaharu-oh-1972-1976-league-reference.json')
]);
const p = player.aggregateOfFiveSeasons;
const l = league.league.totals;
const referencePA = l.AB + l.BB + l.HBP + l.SF;

function finiteRate(a, b, label) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0 || a < 0) {
    throw new Error('Invalid historical source value for ' + label);
  }
  return a / b;
}
function ratio(a, b, label) {
  if (!(a >= 0) || !(b > 0)) throw new Error('Invalid ' + label);
  return a / b;
}
const metrics = {
  battingAverage: {
    player: finiteRate(p.hits, p.atBats, 'player batting average'),
    league: finiteRate(l.H, l.AB, 'league batting average')
  },
  homeRunsPerPA: {
    player: finiteRate(p.homeRuns, p.plateAppearances, 'player home run PA'),
    league: finiteRate(l.HR, referencePA, 'league home run PA')
  },
  walksPerPA: {
    player: finiteRate(p.walks, p.plateAppearances, 'player walks PA'),
    league: finiteRate(l.BB, referencePA, 'league walks PA')
  },
  strikeoutsPerPA: {
    player: finiteRate(p.strikeouts, p.plateAppearances, 'player strikeouts PA'),
    league: finiteRate(l.SO, referencePA, 'league strikeouts PA')
  }
};
for (const [key, metric] of Object.entries(metrics)) {
  metric.relativeToLeague = ratio(metric.player, metric.league, key);
}
if (p.games !== 640 || league.league.teamSeasons !== 30) {
  throw new Error('Unexpected reference cohort: requires 1972-1976 Oh / six-team CL');
}
const output = {
  label: 'Sadaharu Oh, 1972-1976, Mini independent historical calibration TARGET',
  kind: 'OBSERVED_STATISTICAL_TARGET_NOT_PHYSICAL_SKILL',
  ootpExecutableUsed: false,
  ootpPrecomputedPlayerRatingsAvailable: false,
  playerSample: {
    games: p.games,
    plateAppearances: p.plateAppearances,
    battingAverage: metrics.battingAverage.player,
    homeRunsPer130Games: p.homeRuns / p.games * 130
  },
  league: {
    teamSeasons: league.league.teamSeasons,
    leaguePAApprox: referencePA,
    warning: 'League PA excludes sacrifice bunts; per-PA reference is an approximation'
  },
  measures: metrics,
  provenance: {
    player: player.historical.source,
    league: league.source.url,
    labelsAreNotOotpRatings: true
  },
  nextStep: 'Feed true OOTP-independent historical skills into the existing Mini physical batter and pitch source. Compare this statistical target only AFTER physically simulated complete plate appearances are available.'
};
console.log(JSON.stringify(output, null, 2));
