import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function api() {
  const context = vm.createContext({});
  vm.runInContext(readFileSync(new URL('./home-run-watch-v83.js', import.meta.url), 'utf8'), context);
  return context.KneekuraHomeRunWatchV83;
}
const plain = value => value == null ? value : JSON.parse(JSON.stringify(value));
const point = (x, y, z) => ({ x, y, z });
function fixture(tps = 1e6) {
  const origin = 100 * tps, crossingTick = origin + 2 * tps, preparationMs = 1540;
  const ball = (x, visible = true, phase = 'airborne') => ({
    position: point(x, 5, 105), velocity: point(10, -2, 20), spin: point(1, 2, 3),
    orientation: { x: 0, y: 0, z: 0, w: 1 }, visible, phase, possessedBy: null,
  });
  const frames = [
    { tick: origin, phase: 'pitch', ballKind: 'pitch', possessedBy: null, ball: ball(0) },
    { tick: origin + tps, phase: 'batted', ballKind: 'batted', possessedBy: null, ball: ball(10) },
    { tick: crossingTick, phase: 'batted', ballKind: 'batted', possessedBy: null,
      ball: ball(20, false, 'dead'), homeRunConfirmed: true },
    { tick: crossingTick + tps / 10, phase: 'batted', ballKind: 'batted', possessedBy: null,
      ball: ball(21, false, 'dead'), homeRunConfirmed: true },
  ];
  const record = { frames, play: { classification: 'home_run',
    diagnostics: { sourceClockTicksPerSecond: tps }, field: { ruleFacts: {
      overFence: { tick: crossingTick, fair: true, untouchedGround: true, cause: 'batted' },
      firstGroundContactTick: null,
    } }, rules: { endedAtTick: origin + 20 * tps } } };
  const cameraAt = (sample, sampleSceneMs) => {
    expect(sampleSceneMs).toBeCloseTo(preparationMs + (sample.tick - origin) / tps * 1000, 8);
    return sample.tick === origin + tps
      ? { camera: 'fielder', observerPlayerId: 'LF' }
      : { camera: 'mound', observerPlayerId: 'P' };
  };
  return { record, frame: frames.at(-1), preparationMs, crossingTick,
    startAtMs: preparationMs + 2000, cameraAt, selectedCamera: 'mound' };
}
const request = (f, sceneMs = f.startAtMs) => ({ record: f.record, frame: f.frame,
  sceneMs, preparationMs: f.preparationMs, selectedCamera: f.selectedCamera, cameraAt: f.cameraAt });

test('holds the previously admitted defender camera for exactly 1750 presentation milliseconds', () => {
  const factory = api(), watch = factory.create(), f = fixture();
  expect(factory.version).toBe(83); expect(factory.holdMs).toBe(1750);
  const result = plain(watch.observe(request(f, f.startAtMs + 500)));
  expect(result).toMatchObject({ camera: 'fielder', observerPlayerId: 'LF',
    target: f.frame.ball.position, crossingTick: f.crossingTick, startAtMs: f.startAtMs,
    untilMs: f.startAtMs + 1750, holdMs: 1750, active: true,
    authority: 'READ_ONLY_PRESENTATION_CONVENTION' });
  expect(watch.observe(request(f, f.startAtMs - .001))).toBeNull();
  expect(watch.observe(request(f, f.startAtMs))).not.toBeNull();
  expect(watch.observe(request(f, f.startAtMs + 1749.999))).not.toBeNull();
  expect(watch.observe(request(f, f.startAtMs + 1750))).toBeNull();
  expect(watch.observe(request(f, f.startAtMs + 3000))).toBeNull();
});

test('reverse seeks and interleaved records do not retain a stale camera or countdown', () => {
  const watch = api().create(), f = fixture(), other = fixture();
  other.record.play.classification = 'fly_out';
  const expected = plain(watch.observe(request(f, f.startAtMs + 500)));
  expect(watch.observe(request(f, f.startAtMs + 1750))).toBeNull();
  expect(watch.observe(request(other, other.startAtMs + 500))).toBeNull();
  expect(watch.observe(request(f, f.startAtMs - 1))).toBeNull();
  expect(plain(watch.observe(request(f, f.startAtMs + 500)))).toEqual(expected);
  const beforeCrossing = { ...request(f), frame: f.record.frames[1] };
  expect(watch.observe(beforeCrossing)).toBeNull();
});

test('uses the declared Source clock, including one tick per second, for start and duration', () => {
  for (const tps of [1, 1000, 1e6]) {
    const watch = api().create(), f = fixture(tps);
    expect(plain(watch.observe(request(f)))).toMatchObject({ startAtMs: 3540, untilMs: 5290 });
    expect(watch.minDurationMs({ record: f.record, preparationMs: f.preparationMs,
      selectedCamera: 'mound' })).toBe(5290);
    expect(watch.minDurationMs({ record: f.record, preparationMs: f.preparationMs,
      selectedCamera: 'fielder' })).toBe(5290);
  }
});

test('does not read payloads after the admitted crossing prefix or reveal a future confirmation', () => {
  const watch = api().create(), f = fixture();
  const future = { tick: f.crossingTick + 1 };
  for (const key of ['ball', 'phase', 'ballKind', 'possessedBy', 'homeRunConfirmed', 'actors', 'defensiveOpportunity']) {
    Object.defineProperty(future, key, { get() { throw Error('future payload: ' + key); } });
  }
  f.record.frames.splice(3, 0, future);
  expect(watch.observe(request(f))).not.toBeNull();
  // A later confirmation must not authorize a hold before the crossing frame.
  expect(watch.observe({ ...request(f), frame: f.record.frames[1] })).toBeNull();
});

test('requires an actual past defender view and preserves the existing decisive-HR mound view', () => {
  const watch = api().create(), f = fixture();
  expect(watch.observe({ ...request(f), cameraAt: () => ({ camera: 'mound', observerPlayerId: 'P' }) })).toBeNull();
  expect(watch.observe({ ...request(f), cameraAt: sample => sample.tick > f.crossingTick
    ? { camera: 'fielder', observerPlayerId: 'RF' } : { camera: 'mound', observerPlayerId: 'P' } })).toBeNull();
  const direct = plain(watch.observe({ ...request(f), selectedCamera: 'fielder',
    cameraAt: () => ({ camera: 'fielder', observerPlayerId: 'CF' }) }));
  expect(direct).toMatchObject({ camera: 'fielder', observerPlayerId: 'CF' });
});

test('continues the hold into a bench frame without a duplicated homeRunConfirmed flag', () => {
  const watch = api().create(), f = fixture();
  const bench = { tick: f.crossingTick + 500000, phase: 'bench', ballKind: 'batted',
    possessedBy: null, ball: null };
  f.record.frames.push(bench); f.frame = bench;
  const result = plain(watch.observe(request(f, f.startAtMs + 500)));
  expect(result).toMatchObject({ camera: 'fielder', observerPlayerId: 'LF',
    target: f.record.frames[2].ball.position, untilMs: f.startAtMs + 1750 });
});

test('accepts confirmation in the first admitted saved frame after a crossing between saved frames', () => {
  const watch = api().create(), f = fixture();
  // Core event ticks are exact; saved Presentation frames need not occur at that tick.
  f.crossingTick -= 25000;
  f.record.play.field.ruleFacts.overFence.tick = f.crossingTick;
  f.startAtMs -= 25;
  f.frame = f.record.frames[2];
  expect(f.record.frames.some(frame => frame.tick <= f.crossingTick && frame.homeRunConfirmed)).toBe(false);
  expect(plain(watch.observe(request(f, f.startAtMs + 25)))).toMatchObject({
    crossingTick: f.crossingTick, startAtMs: f.startAtMs, untilMs: f.startAtMs + 1750,
    camera: 'fielder', observerPlayerId: 'LF', active: true,
  });
});

test('changes only a copied dead HR ball visibility and never mutates canonical rows', () => {
  const watch = api().create(), f = fixture(), before = structuredClone(f.record);
  const result = watch.observe(request(f));
  expect(plain(result.displayBall)).toEqual({ ...f.frame.ball, visible: true });
  expect(f.record).toEqual(before);
  for (const [object, key] of [[result.target, 'x'], [result.displayBall.position, 'x'],
    [result.displayBall.velocity, 'y'], [result.displayBall.orientation, 'w']]) {
    // A separately owned copy may be mutable or frozen; neither may mutate Source.
    Reflect.set(object, key, -999);
  }
  expect(f.record).toEqual(before);
  const live = { ...f.frame, ball: { ...f.frame.ball, phase: 'airborne', visible: true } };
  expect(watch.observe({ ...request(f), frame: live }).displayBall).toBeUndefined();
  const held = { ...f.frame, possessedBy: 'LF', ball: { ...f.frame.ball, possessedBy: 'LF' } };
  expect(watch.observe({ ...request(f), frame: held })?.displayBall).toBeUndefined();
});

test('does not affect other selected cameras, non-HR outcomes, caught balls, or invalid fence evidence', () => {
  const watch = api().create();
  for (const selectedCamera of ['catcher', 'overhead', 'batter', 'runner']) {
    const f = fixture();
    expect(watch.observe({ ...request(f), selectedCamera })).toBeNull();
    expect(watch.minDurationMs({ record: f.record, preparationMs: f.preparationMs, selectedCamera })).toBe(0);
  }
  const changes = [
    f => { f.record.play.classification = 'fly_out'; f.frame.possessedBy = 'LF'; },
    f => { f.record.play.classification = 'live_ball'; },
    f => { f.record.play.field.ruleFacts.overFence = null; },
    f => { f.record.play.field.ruleFacts.overFence.fair = false; },
    f => { f.record.play.field.ruleFacts.overFence.untouchedGround = false; },
    f => { f.record.play.field.ruleFacts.overFence.cause = 'throw'; },
    f => { f.record.play.field.ruleFacts.firstGroundContactTick = f.crossingTick - 1; },
  ];
  for (const change of changes) {
    const f = fixture(); change(f);
    expect(watch.observe(request(f))).toBeNull();
    expect(watch.minDurationMs({ record: f.record, preparationMs: f.preparationMs,
      selectedCamera: f.selectedCamera })).toBe(0);
  }
  const unconfirmed = fixture();
  for (const frame of unconfirmed.record.frames) delete frame.homeRunConfirmed;
  expect(watch.observe(request(unconfirmed))).toBeNull();
});
