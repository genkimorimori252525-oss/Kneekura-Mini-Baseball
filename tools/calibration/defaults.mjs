// Writes a config whose match policies equal the game's defaults (082 helper), from the native core.
// usage: node defaults.mjs <native.js> <in-config.json> <out-config.json>
import {readFileSync, writeFileSync} from 'node:fs';
const [nativePath, inPath, outPath] = process.argv.slice(2);
globalThis.self = globalThis;
(0, eval)(readFileSync(nativePath, 'utf8') + ';globalThis.__core=KneekuraNativeMatchCore;');
const core = globalThis.__core, config = JSON.parse(readFileSync(inPath, 'utf8'));
const policies = {batterObservationV151: core.LIVE_MATCH_BATTER_OBSERVATION_V2, runnerLeadV1: core.LIVE_RUNNER_LEAD_POLICY_V1, catcherThrowV1: core.LIVE_CATCHER_THROW_POLICY_V1,
  fieldThrowV1: core.LIVE_FIELD_THROW_POLICY_V1, fieldRangeV1: core.LIVE_FIELD_RANGE_POLICY_V1, batterTechniqueV1: core.LIVE_BATTER_TECHNIQUE_POLICY_V1, emotionPolicyV1: core.LIVE_EMOTION_POLICY_V1};
for (const [key, value] of Object.entries(policies)) {
  const before = JSON.stringify(config[key]), after = JSON.stringify(value);
  if (before !== after) console.log(key, value === undefined ? 'absent in core' : config[key] === undefined ? 'added' : 'replaced', before?.slice(0, 120), '->', after?.slice(0, 160));
  if (value === undefined) delete config[key]; else config[key] = JSON.parse(after);
}
if (core.LIVE_EMOTION_POLICY_V1) config.managerTacticsV1 = true;
writeFileSync(outPath, JSON.stringify(config));
