// Writes a config whose match policies equal the game's defaults, from the native core.
// The list of policies is read from the 082 helper itself, so a policy turned on there is never left out here.
// usage: node defaults.mjs <native.js> <in-config.json> <out-config.json>   (run from the repository root)
import {readFileSync, writeFileSync} from 'node:fs';
const [nativePath, inPath, outPath] = process.argv.slice(2);
globalThis.self = globalThis;
(0, eval)(readFileSync(nativePath, 'utf8') + ';globalThis.__core=KneekuraNativeMatchCore;');
const core = globalThis.__core, config = JSON.parse(readFileSync(inPath, 'utf8'));
const helper = readFileSync('release/game/parts/082-match-auto-direction-helper-v250.js', 'utf8');
const policies = {batterObservationV151: core.LIVE_MATCH_BATTER_OBSERVATION_V2, emotionPolicyV1: core.LIVE_EMOTION_POLICY_V1};
for (const [, constant, key] of helper.matchAll(/core\.(LIVE_[A-Z0-9_]+)\?\{(\w+):core\.\1\}/g)) if (key !== 'emotionPolicyV1') policies[key] = core[constant];
for (const [key, value] of Object.entries(policies)) {
  const before = JSON.stringify(config[key]), after = JSON.stringify(value);
  if (before !== after) console.log(key, value === undefined ? 'absent in core' : config[key] === undefined ? 'added' : 'replaced');
  if (value === undefined) delete config[key]; else config[key] = JSON.parse(after);
}
if (core.LIVE_EMOTION_POLICY_V1) config.managerTacticsV1 = true;
// The floor: the game's park takes the first ground constant 090 names that the core has (bundle 3: LIVE_MATCH_GRASS_V4).
const park = readFileSync('release/game/parts/090-v33-offline-core-match.js', 'utf8'), ground = [...park.matchAll(/(LIVE_MATCH_GRASS_V\d+)/g)].map(m => m[1]).find(k => core[k]);
if (ground && config.park && JSON.stringify(config.park.groundMaterialV101) !== JSON.stringify(core[ground])) { console.log('park.groundMaterialV101', ground); config.park = {...config.park, groundMaterialV101: JSON.parse(JSON.stringify(core[ground]))}; }
writeFileSync(outPath, JSON.stringify(config));
