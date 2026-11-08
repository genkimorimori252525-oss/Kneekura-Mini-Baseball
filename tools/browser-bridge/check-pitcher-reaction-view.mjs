import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile('tools/browser-bridge/live-pitcher-reaction-view.js', 'utf8'), root = {};
runInNewContext(source, root);
const api = root.KneekuraLivePitcherReactionView, plain = value => JSON.parse(JSON.stringify(value)),
 P = (x = 0, y = 0, z = 0) => ({ x, y, z }), origin = 1234567, preparationMs = 1540,
 pitcherActor = { id: 'P', sourcePlayerId: 'pitcher', position: P(1, .9, 18.44), player: { height: 1.8 } };
function fixture(speed = 40) {
 return { frames: Array.from({ length: 81 }, (_, index) => ({ tick: origin + index * 25000,
  phase: index < 16 ? 'pitch' : 'batted', ballKind: index < 16 ? 'pitch' : 'batted',
  ball: { position: P(index * .2, 1, index * .4), velocity: index < 16 ? P(0, 0, -40) : P(speed, 0, 0) }, actors: [] })),
  play: { diagnostics: { sourceClockTicksPerSecond: 1e6 }, contactMoment: { ball: { tick: origin + 399000 } } } };
}
const at = (record, physicalMs, capMs = physicalMs, actor = pitcherActor) => api.observe({ record,
 frame: record.frames.findLast(frame => frame.tick <= origin + capMs * 1000) ?? record.frames[0],
 sceneMs: preparationMs + physicalMs, preparationMs, pitcherActor: actor });
assert.equal(api.version, 1);
const record = fixture(), before = JSON.stringify(record), initial = at(record, 100), held = at(record, 700),
 contactAtMs = preparationMs + 399, trackingAtMs = contactAtMs + 35 / 40 * 1000;
assert.equal(initial.phase, 'pre-contact');
assert.equal(initial.view, null);
assert.equal(held.phase, 'reaction-hold');
assert.equal(held.delaySeconds, .875);
assert.equal(held.contactTick, origin + 399000, 'exact contact clock rather than first batted rendering sample');
assert.equal(held.contactAtMs, contactAtMs);
assert.equal(held.trackingAtMs, trackingAtMs);
assert.deepEqual(plain(held.view.eye), P(1, .9 + 1.8 * .92, 18.44), 'same current pitcher eye');
assert.equal(held.view.yaw, Math.atan2(-1, -18.44));
assert.equal(held.view.pitch, Math.atan2(held.view.eye.y - 1.03, Math.hypot(1, 18.44)));
assert.deepEqual(plain({ f: held.view.f, cx: held.view.cx, cy: held.view.cy, labelMetres: held.view.labelMetres }),
 { f: 1600, cx: 300, cy: 192, labelMetres: .23 });
assert.equal(held.handoffAllowed, false, 'an early catch/throw cannot bypass the hold');
let priorDelay = Infinity;
for (const speed of [0, 10, 25, 40, 60, 90]) {
 const observation = at(fixture(speed), 450);
 assert(observation.delaySeconds >= .5 && observation.delaySeconds <= 1.2);
 assert(observation.delaySeconds <= priorDelay, 'faster observed exit ball gives shorter bounded delay');
 priorDelay = observation.delaySeconds;
}
const start = at(record, trackingAtMs - preparationMs), middle = at(record, trackingAtMs - preparationMs + 90),
 complete = at(record, trackingAtMs - preparationMs + 180);
assert.equal(start.phase, 'tracking-blend'); assert.equal(start.trackingAllowed, true); assert.equal(start.trackingBlend, 0);
assert.equal(middle.phase, 'tracking-blend'); assert.equal(middle.trackingBlend, .5); assert.equal(middle.handoffAllowed, false);
assert.equal(complete.phase, 'tracking'); assert.equal(complete.trackingBlend, 1); assert.equal(complete.handoffAllowed, true); assert.equal(complete.view, null);
assert(held.view && middle.view, 'hold and blend share the current-eye base pose');
const movingPitcher = { ...pitcherActor, position: P(2, .9, 19) };
assert.deepEqual(plain(at(record, 700, 700, movingPitcher).view.eye), P(2, .9 + 1.8 * .92, 19), 'no second eye remains at the mound');
assert.equal(JSON.stringify(record), before, 'read-only observer');
const rewind = plain(at(record, 700)); at(record, 1600); assert.deepEqual(plain(at(record, 700)), rewind, 'rewind has no accumulated gaze state');
const frozen = at(record, trackingAtMs - preparationMs + 180, 500);
assert.equal(frozen.handoffAllowed, true, 'presentation time releases even after the physical Source clock stops');
assert.equal(frozen.contactTick, held.contactTick);
const future = fixture();
for (const sample of future.frames) if (sample.tick > origin + 300000)
 Object.defineProperty(sample, 'ballKind', { get() { throw Error('future frame payload read'); } });
Object.defineProperty(future.play, 'contactMoment', { get() { throw Error('future contact read'); } });
assert.equal(at(future, 300).phase, 'pre-contact');
const lateFrame = fixture();
assert.equal(at(lateFrame, 300, 900).phase, 'pre-contact', 'scene clock also fences a frame selected too far ahead');
const earlyFrame = fixture();
assert.equal(at(earlyFrame, 900, 300).phase, 'pre-contact', 'Source tick also fences a scene clock selected too far ahead');
const prepared = fixture(); Object.defineProperty(prepared, 'play', { get() { throw Error('preparation read contact'); } });
assert.equal(api.observe({ record: prepared, frame: prepared.frames[0], sceneMs: 100, preparationMs, pitcherActor }).phase, 'ready');
assert.equal(api.observe({ record, frame: { ...record.frames[20], phase: 'bench' }, sceneMs: 2500, preparationMs, pitcherActor }).phase, 'bench');
const homeRun = fixture(); homeRun.frames[20].homeRunConfirmed = true;
assert.equal(at(homeRun, 500).phase, 'reaction-hold', 'early HR knowledge does not bypass gaze reaction');
const changedFuture = fixture();
for (const sample of changedFuture.frames) if (sample.tick > origin + 500000) sample.ball.velocity = P(999, 999, 999);
assert.equal(at(changedFuture, 700).delaySeconds, held.delaySeconds, 'future ball speed does not change the committed reaction delay');
const changedPitch = fixture();
for (const sample of changedPitch.frames) if (sample.ballKind === 'pitch') sample.ball.velocity = P(0, 0, -9999);
assert.equal(at(changedPitch, 700).delaySeconds, held.delaySeconds, 'incoming pitch speed does not select the batted-ball reaction');
const tracked = { eye: P(7, 4, 16), yaw: -3.1, pitch: .7, f: 530, cx: 310, cy: 196, labelMetres: .5 },
 reaction = { view: { ...held.view, yaw: 3.1 }, trackingBlend: .5 }, mixed = api.mixTrackingView({ reaction, tracked }),
 trackedBefore = JSON.stringify(tracked);
assert(Math.abs(mixed.yaw - Math.PI) < 1e-12, 'tracking takes the shortest angular path across +/-pi');
assert.deepEqual(plain(mixed.eye), tracked.eye, 'blend never interpolates a second eye');
assert.equal(mixed.f, 1065); assert.equal(mixed.cx, 305); assert.equal(mixed.cy, 194); assert.equal(mixed.labelMetres, .365);
assert.equal(mixed.pitch, (held.view.pitch + tracked.pitch) / 2);
assert.deepEqual(plain(api.mixTrackingView({ reaction: { ...reaction, trackingBlend: 1 }, tracked })), tracked, 'completed blend exactly restores the existing follower');
assert.equal(JSON.stringify(tracked), trackedBefore);
const miss = fixture(); for (const sample of miss.frames) sample.ballKind = 'pitch';
Object.defineProperty(miss.play, 'contactMoment', { get() { throw Error('miss has no observed contact'); } });
assert.equal(at(miss, 1500).phase, 'pre-contact');
assert.equal(at(fixture(), 100).phase, 'pre-contact', 'a new pitch starts with no retained contact timer');
console.log(JSON.stringify({ pass: true, checks: ['exact-contact-clock', 'current-pitcher-eye', 'bounded-causal-speed-delay',
 '180ms-blend', 'shortest-angle-and-optics', 'handoff-gate', 'prefix-fences', 'rewind', 'stopped-source-clock',
 'preparation', 'bench', 'early-HR', 'incoming-speed-independent', 'miss-and-next-pitch', 'read-only'] }));
