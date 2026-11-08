// Mixed leagues for ability response surfaces: every batter gets random public abilities (kbm-maker scale, 84 = MLB
// average) and a random attack angle, so a few hundred fielding-free games cover the whole ability space at once.
// usage: node tools/calibration/random-league.mjs <native.js> <base-config.json> <out-dir> <leagues> [seed] [--pitchers]
// Writes <out-dir>/league-<i>.json and <out-dir>/abilities.json ({league: {playerId: {contact, power, vision, run, attackAngleDegrees}}}).
// --pitchers leaves the batters as they are and draws the two starting pitchers' speed and control instead.
// --undercut also draws each batter's undercutAimMeters (-0.01..0.035 m), recorded in abilities.json as 'undercut'.
// --write=lo:hi writes only leagues lo..hi-1 (every league is still drawn, so abilities.json and the draws stay the same):
// a disk too small for every league at once can make them a batch at a time.
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {loadCore, makeRoster} from '../maker/kbm-maker.mjs';

const args = process.argv.slice(2).filter(a => !a.startsWith('--')), pitchers = process.argv.includes('--pitchers');
const undercutRange = process.argv.includes('--undercut') ? [-.01, .035] : null;
const [writeLo, writeHi] = (process.argv.find(a => a.startsWith('--write='))?.slice(8) ?? '0:Infinity').split(':').map(Number);
const [nativePath, basePath, outDir, leagues = '10', seedText = '1'] = args;
// <base-config.json> may be a comma-separated list: league i is drawn on base i mod n (e.g. the six standard archetype
// versions, so every pitch mix is in the leagues). The draws do not depend on the bases.
const core = loadCore(nativePath), bases = basePath.split(',').map(path => JSON.parse(readFileSync(path, 'utf8')));
let state = Number(seedText) >>> 0 || 1;
const uniform = () => {state = (state * 1664525 + 1013904223) >>> 0; return state / 2 ** 32;};
// Ranges cover real hitters on this scale; power 60-100 is about 25-35 m/s, the real spread of bat speed. Widened 2026-11-04:
// inverted MLB 2024 hitters sat on the old edges (contact 55/110, angle 4), where the fitted surface had no data.
const RANGE = {contact: [40, 130], power: [55, 112], vision: [15, 100], run: [50, 115]};
// --angle=lo:hi narrows the drawn attack angles (bundle 2's standard batter swings at 11; MLB hitters' own means spread
// with sd 3.9 deg, so most of the surface's data should sit near them).
const ANGLE = (process.argv.find(a => a.startsWith('--angle='))?.slice(8).split(':').map(Number)) ?? [-2, 28];
// Pitchers: top speed 138-165 km/h covers the MLB spread of fastball velocity; control on the shared scale.
const PITCH = {maxSpeedKmh: [138, 165], control: [55, 110]};
mkdirSync(outDir, {recursive: true});
const abilities = {};
for (let league = 0; league < Number(leagues); league++) {
  const base = bases[league % bases.length], spec = {players: {}}, drawn = {};
  const pick = ([lo, hi]) => Math.round((lo + (hi - lo) * uniform()) * 10) / 10;
  if (pitchers) for (const team of base.teams) {
    const a = {maxSpeedKmh: pick(PITCH.maxSpeedKmh), control: pick(PITCH.control)};
    // A pitcher with his own pitches (pitchRepertoireV78) throws every one of them at the new top speed's ratio, spin kept;
    // otherwise his pitches would stay above a lowered top speed and the maker would refuse them.
    const physical = base.players.find(p => p.playerId === team.pitcherId)?.physical, owned = physical?.pitchRepertoireV78;
    const ratio = owned ? a.maxSpeedKmh / 3.6 / physical.maximumPitchSpeedMps : 1;
    spec.players[team.pitcherId] = {abilities: a, ...(owned ? {physical: {maximumPitchSpeedMps: a.maxSpeedKmh / 3.6,
      releaseSpeedMps: physical.releaseSpeedMps * ratio,
      pitchRepertoireV78: {...owned, pitches: owned.pitches.map(row => ({...row, releaseSpeedMps: row.releaseSpeedMps * ratio}))}}} : {})};
    drawn[team.pitcherId] = a;
  }
  if (!pitchers) for (const team of base.teams) for (const playerId of team.battingOrder) {
    const a = {contact: pick(RANGE.contact), power: pick(RANGE.power), vision: pick(RANGE.vision), run: pick(RANGE.run)};
    const attackAngleDegrees = pick(ANGLE);
    // --undercut also draws each hitter's own aim under the ball (metres), his lift apart from the bat path.
    const undercut = undercutRange ? Math.round((undercutRange[0] + (undercutRange[1] - undercutRange[0]) * uniform()) * 10000) / 10000 : undefined;
    spec.players[playerId] = {abilities: a, attackAngleDegrees, ...(undercut === undefined ? {} : {physical: {undercutAimMeters: undercut}})};
    drawn[playerId] = {...a, attackAngleDegrees, ...(undercut === undefined ? {} : {undercut})};
  }
  abilities[league] = drawn;
  if (league < writeLo || league >= writeHi) continue;
  const made = makeRoster(core, base, spec), byId = new Map(made.roster.entries.map(e => [e.playerId, e]));
  const out = {...base, players: made.players.map(p => ({...p, physical: byId.get(p.playerId).physical}))};
  writeFileSync(`${outDir}/league-${league}.json`, JSON.stringify(out));
}
writeFileSync(`${outDir}/abilities.json`, JSON.stringify(abilities, null, 1));
console.log('leagues', leagues, pitchers ? 'pitchers' : 'batters', Object.keys(abilities[0]).length);
