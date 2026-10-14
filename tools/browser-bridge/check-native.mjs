import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { strict as assert } from 'node:assert';

// Run without Node global require/process/etc, as if loaded by a phone browser.
const script = await readFile('dist/native-match-core-browser.js', 'utf8');
const context = Object.create(null);
runInNewContext(script, context, { timeout: 5000, filename: 'native-match-core-browser.js' });
const library = context.KneekuraNativeMatchCore;
assert.equal(typeof library?.createNativeSinglePaSession, 'function');
const makeInput = (zone = 'outside') => ({
  pitcher: { attackZone: zone, verticalPlan: 'low', aggression: 'balanced' },
  batter: { approach: 'take', swingBias: 'neutral' },
  runners: { posture: 'balanced' },
});
const run = () => {
  const native = library.createNativeSinglePaSession(20261014);
  const first = native.issue(makeInput());
  assert.equal(first.result.authority, 'NATIVE_CORE_PHYSICAL_PITCH');
  assert.ok(first.eventKinds.includes('TakenPitchPlateCrossed'));
  assert.ok(first.eventKinds.includes('PitchAdjudicated'));
  const events = JSON.stringify(first.result.events);
  const second = native.issue(makeInput('inside'));
  assert.equal(JSON.stringify(first.result.events), events);
  assert.notEqual(first.intendedTarget.x, second.intendedTarget.x);
  return { first, second };
};
const one = run(), two = run();
assert.deepEqual(JSON.parse(JSON.stringify(one)), JSON.parse(JSON.stringify(two)));
for (const pitch of [one.first, one.second]) {
  assert.equal(pitch.result.samples.length > 5, true);
  assert.equal(pitch.result.samples.length, pitch.result.frames.length);
  for (const frame of pitch.result.frames) {
    assert.deepEqual(JSON.parse(JSON.stringify(frame.events)),
      JSON.parse(JSON.stringify(pitch.result.events.filter(e => e.tick === frame.tick))));
  }
}
console.log(JSON.stringify({
  status: 'PASS',
  realNativeSourceBundle: true,
  executedOutsideNodeRuntime: true,
  deterministicReplay: true,
  isolatedNextPitchInstructions: true,
  pitchSamples: one.first.result.samples.length + one.second.result.samples.length,
  events: [...one.first.eventKinds, ...one.second.eventKinds],
}));
