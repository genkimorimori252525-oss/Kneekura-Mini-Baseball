// Writes the standard (MLB-average) players of the 2026-11-06 bundle into a config whose match policies defaults.mjs wrote.
// The bundle's match side lives in the Core's defaults; this is its player side, the anchor the maker inverts from.
// usage: node standard-bundle.mjs <in-config.json> <out-config.json>
// Same as core-playthrough --batters=attackAngleDegrees:16,chaseMarginMeters:0.2 --decision=threshold:0.48
// --pitchers=commandStdMeters:0.19, on position players (ids ending -b<n>) and pitchers (-p<n>).
import {readFileSync, writeFileSync} from 'node:fs';
export const STANDARD_BATTER_V1 = {attackAngleDegrees: 16, chaseMarginMeters: .2};
export const STANDARD_SWING_DECISION_V1 = {threshold: .48};
export const STANDARD_PITCHER_V1 = {commandStdMeters: .19};
const [inPath, outPath] = process.argv.slice(2);
const config = JSON.parse(readFileSync(inPath, 'utf8'));
for (const player of config.players) {
  if (/-b\d$/.test(player.playerId)) {
    Object.assign(player.physical, STANDARD_BATTER_V1);
    if (player.physical.swingDecision) player.physical.swingDecision = {...player.physical.swingDecision, ...STANDARD_SWING_DECISION_V1};
  }
  if (/-p\d+$/.test(player.playerId)) Object.assign(player.physical, STANDARD_PITCHER_V1);
}
writeFileSync(outPath, JSON.stringify(config));
