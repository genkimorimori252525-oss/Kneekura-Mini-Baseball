import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { strict as assert } from 'node:assert';

// Run without Node global require/process/etc, as if loaded by a phone browser.
const script = await readFile('dist/native-match-core-browser.js', 'utf8');
const context = Object.create(null);
// structuredClone is a standard browser API, not a Node runtime dependency.
context.structuredClone = structuredClone;
runInNewContext(script, context, { timeout: 5000, filename: 'native-match-core-browser.js' });
const library = context.KneekuraNativeMatchCore;
assert.equal(typeof library?.createNativeSinglePaSession, 'function');
assert.equal(typeof library?.createNativeAerodynamicSession, 'function');
assert.equal(typeof library?.createReferenceAerodynamicPhysicalSource, 'function');
assert.equal(typeof library?.observeNativeFreeBallContinuation, 'function');
assert.equal(typeof library?.createSourceBallMaterialHistoryV1, 'function');
assert.equal(typeof library?.createSourceBallMaterialHistoryFromContinuationV3, 'function');
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
const realAero = () => {
  const session = library.createNativeAerodynamicSession({
    match: {
      ruleProfileId: 'npb-2026',
      inning: 1, half: 'top', outs: 0, balls: 0, strikes: 0,
      bases: { first: null, second: null, third: null },
      score: { home: 0, away: 0 }, playId: 7,
    },
    startedAtTick: 0, matchSeed: 20261014, batterRunnerId: 'reference-batter',
    batterHandedness: 'L', pitcherHandedness: 'R',
  });
  const accepted = session.acceptNextCommand(makeInput('outside'));
  const observation = session.issue(library.createReferenceAerodynamicPhysicalSource({
    pitchSpeedMps: 40, batterAction: 'take',
    actorsAtTick: () => ({ defenders: [], runners: [] }),
  }));
  assert.equal(observation.commandSession, accepted);
  assert.equal(observation.result.authority, 'NATIVE_CORE_AERODYNAMIC_RIGID_PITCH');
  assert.deepEqual(Array.from(observation.eventKinds), ['TakenPitchPlateCrossed', 'PitchAdjudicated']);
  assert.ok(observation.result.samples.length >= 10);
  assert.equal(observation.result.samples[0].world.ball.position.z, 18);
  assert.ok(observation.result.samples.at(-1).world.ball.position.z < 0);
  assert.equal(observation.result.requiresOfficialLiveBallResolution, false);
  return JSON.parse(JSON.stringify(observation));
};
const aeroA = realAero();
const aeroB = realAero();
assert.deepEqual(aeroA, aeroB);
console.log(JSON.stringify({
  status: 'PASS',
  realNativeSourceBundle: true,
  executedOutsideNodeRuntime: true,
  deterministicReplay: true,
  isolatedNextPitchInstructions: true,
  pitchSamples: one.first.result.samples.length + one.second.result.samples.length,
  events: [...one.first.eventKinds, ...one.second.eventKinds],
  aerodynamicReferencePitch: {
    authority: aeroA.result.authority,
    sampledPhysicsFrames: aeroA.result.samples.length,
    events: aeroA.eventKinds,
    deterministicReplay: true,
  },
}));
