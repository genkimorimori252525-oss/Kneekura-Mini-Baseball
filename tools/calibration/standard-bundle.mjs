// Writes the standard (MLB-average) players of bundle 2 (2026-11-06) into a config whose match policies defaults.mjs wrote.
// The bundle's match side lives in the Core's defaults; this is its player side, the anchor the maker inverts from.
// usage: node standard-bundle.mjs <in-config.json> <out-config.json>
// Same as core-playthrough --batters=attackAngleDegrees:11,chaseMarginMeters:0.2,contactDepthMeters:0.44 --decision=threshold:0.48
// --pitchers=commandStdMeters:0.19,contactDepthMeters:0.44, on position players (ids ending -b<n>) and pitchers (-p<n>).
import {readFileSync, writeFileSync} from 'node:fs';
// Bundle 2: attack 11 (was 16) and the contact plane at the MLB depth, .44 m (was .15; the plate front is at .43).
export const STANDARD_BATTER_V1 = {attackAngleDegrees: 11, chaseMarginMeters: .2, contactDepthMeters: .44};
export const STANDARD_SWING_DECISION_V1 = {threshold: .48};
export const STANDARD_PITCHER_V1 = {commandStdMeters: .19, contactDepthMeters: .44};
// Bundle 4 (2026-11-08): every player rounds a base on an 8 m radius (4.5 was the Host default). Paired replays of the same
// singles put home-to-first / first-to-third / second-to-home at .746/.756/.817 of sprint speed (MLB .72/.78/.82-.84).
export const STANDARD_RUNNER_V1 = {baserunningTurnRadiusMeters: 8};
const [inPath, outPath] = process.argv.slice(2);
const config = JSON.parse(readFileSync(inPath, 'utf8'));
for (const player of config.players) {
  if (/-b\d$/.test(player.playerId)) {
    Object.assign(player.physical, STANDARD_BATTER_V1);
    if (player.physical.swingDecision) player.physical.swingDecision = {...player.physical.swingDecision, ...STANDARD_SWING_DECISION_V1};
  }
  if (/-p\d+$/.test(player.playerId)) Object.assign(player.physical, STANDARD_PITCHER_V1);
  Object.assign(player.physical, STANDARD_RUNNER_V1);
}
writeFileSync(outPath, JSON.stringify(config));
