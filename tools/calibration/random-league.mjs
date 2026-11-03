// Mixed leagues for ability response surfaces: every batter gets random public abilities (kbm-maker scale, 84 = MLB
// average) and a random attack angle, so a few hundred fielding-free games cover the whole ability space at once.
// usage: node tools/calibration/random-league.mjs <native.js> <base-config.json> <out-dir> <leagues> [seed] [--pitchers]
// Writes <out-dir>/league-<i>.json and <out-dir>/abilities.json ({league: {playerId: {contact, power, vision, run, attackAngleDegrees}}}).
// --pitchers leaves the batters as they are and draws the two starting pitchers' speed and control instead.
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {loadCore, makeRoster} from '../maker/kbm-maker.mjs';

const args = process.argv.slice(2).filter(a => !a.startsWith('--')), pitchers = process.argv.includes('--pitchers');
const [nativePath, basePath, outDir, leagues = '10', seedText = '1'] = args;
const core = loadCore(nativePath), base = JSON.parse(readFileSync(basePath, 'utf8'));
let state = Number(seedText) >>> 0 || 1;
const uniform = () => {state = (state * 1664525 + 1013904223) >>> 0; return state / 2 ** 32;};
// Ranges cover real hitters on this scale; power 60-100 is about 25-35 m/s, the real spread of bat speed.
const RANGE = {contact: [55, 110], power: [60, 100], vision: [30, 100], run: [60, 105]};
const ANGLE = [4, 26];
// Pitchers: top speed 138-165 km/h covers the MLB spread of fastball velocity; control on the shared scale.
const PITCH = {maxSpeedKmh: [138, 165], control: [55, 110]};
mkdirSync(outDir, {recursive: true});
const abilities = {};
for (let league = 0; league < Number(leagues); league++) {
  const spec = {players: {}}, drawn = {};
  const pick = ([lo, hi]) => Math.round((lo + (hi - lo) * uniform()) * 10) / 10;
  if (pitchers) for (const team of base.teams) {
    const a = {maxSpeedKmh: pick(PITCH.maxSpeedKmh), control: pick(PITCH.control)};
    spec.players[team.pitcherId] = {abilities: a};
    drawn[team.pitcherId] = a;
  }
  if (!pitchers) for (const team of base.teams) for (const playerId of team.battingOrder) {
    const a = {contact: pick(RANGE.contact), power: pick(RANGE.power), vision: pick(RANGE.vision), run: pick(RANGE.run)};
    const attackAngleDegrees = pick(ANGLE);
    spec.players[playerId] = {abilities: a, attackAngleDegrees};
    drawn[playerId] = {...a, attackAngleDegrees};
  }
  const made = makeRoster(core, base, spec), byId = new Map(made.roster.entries.map(e => [e.playerId, e]));
  const out = {...base, players: made.players.map(p => ({...p, physical: byId.get(p.playerId).physical}))};
  writeFileSync(`${outDir}/league-${league}.json`, JSON.stringify(out));
  abilities[league] = drawn;
}
writeFileSync(`${outDir}/abilities.json`, JSON.stringify(abilities, null, 1));
console.log('leagues', leagues, pitchers ? 'pitchers' : 'batters', Object.keys(abilities[0]).length);
