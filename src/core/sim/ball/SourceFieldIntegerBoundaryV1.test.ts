import { expect, it } from 'vitest';
import { quantizeEventTick } from '../ExactEventTime';
import { deriveQuantizerClosedGenerationBoundary } from '../liveAction/QuantizerClosedGenerationBoundary';
import { deriveSourceBattedFieldMotionV3 } from './SourceBattedFieldMotionV3';
import { sourceFieldV3Fixture } from './SourceBattedFieldMotionV3.test-support';
import { createSourceFreeBallKernel } from './SourceFreeBallKernel';
import { advanceSourceFieldToIntegerBoundaryV1 as advance, deriveFieldIntegerBoundaryV1 as boundary } from './SourceFieldIntegerBoundaryV1';

const groundFixture = () => {
  const x = sourceFieldV3Fixture();
  x.response.world.surfaces = []; x.response.surfaces = [];
  return x;
};

it('labels the genuine Native ground-to-integer wait without changing its fractional clock', () => {
  const result = boundary({ originTick: 34054636, elapsedSeconds: 0.2793662989158183, ticksPerSecond: 1_000_000 });
  expect(result.boundaryTick).toBe(34334003);
  expect(result.boundaryElapsedSeconds).toBe(0.279367);
  expect(result.waitSeconds).toBe(7.010841816534885e-7);
  expect(result.fromElapsedSeconds).toBe(0.2793662989158183);
  expect(Object.isFrozen(result)).toBe(true);
});

it('uses strict division boundaries rather than the event tolerance or generation-window endpoint', () => {
  const originTick = 2_000_000, throughTick = 2_002_000, ticksPerSecond = 1_000_000;
  const generation = deriveQuantizerClosedGenerationBoundary({ originTick, throughTick, ticksPerSecond });
  const input = { originTick, ticksPerSecond, elapsedSeconds: generation.lastIncludedElapsedSeconds };
  expect(quantizeEventTick(originTick, input.elapsedSeconds, ticksPerSecond)).toBe(throughTick);
  expect(boundary(input).boundaryTick).toBe(throughTick + 1);
  for (const clock of [1, 3, 60, 1_000_000]) for (const offset of [0, 1, 19, 511]) {
    const exact = boundary({ originTick: 7, ticksPerSecond: clock, elapsedSeconds: offset / clock });
    expect(exact.boundaryTick).toBe(7 + offset);
    expect(exact.waitSeconds).toBe(0);
    if (offset > 0) expect((offset - 1) / clock).toBeLessThan(exact.boundaryElapsedSeconds);
  }
  expect(boundary({ originTick: Number.MAX_SAFE_INTEGER - 2, ticksPerSecond: 3, elapsedSeconds: 2 / 3 }).boundaryTick).toBe(Number.MAX_SAFE_INTEGER);
  expect(() => boundary({ originTick: Number.MAX_SAFE_INTEGER - 2, ticksPerSecond: 3, elapsedSeconds: 1 })).toThrow('overflow');
});

it('executes a real sub-tick ground wait through the original kernel without rebasing ball or actors', () => {
  const initial = groundFixture(), history = { initial, throughTicks: [812345] };
  const before = deriveSourceBattedFieldMotionV3(history), originalBytes = JSON.stringify(before);
  expect(before.field.motion.response.kind).toBe('ground');
  const result = advance(history), after = result.trace.field.motion.cursor!, prior = before.field.motion.cursor!;
  expect(result.kind).toBe('reached_integer_boundary');
  expect(result.boundary.waitSeconds).toBeGreaterThan(0);
  expect(result.boundary.waitSeconds).toBeLessThan(1e-6);
  expect(after.moment.ball.tick).toBe(prior.moment.ball.tick);
  expect(after.moment.elapsedSeconds).toBeGreaterThan(prior.moment.elapsedSeconds);
  expect(after.moment.ball.position).not.toEqual(prior.moment.ball.position);
  expect(after.moment.ball.velocity).not.toEqual(prior.moment.ball.velocity);
  expect(after.moment.ball.spin).not.toEqual(prior.moment.ball.spin);
  expect(after.sourceCurve!.initial).toEqual(prior.sourceCurve!.initial);
  expect(after.sourceCurve!.profile).toEqual(prior.sourceCurve!.profile);
  expect(result.trace.field.motion.actors).toEqual(before.field.motion.actors);
  expect(after.moment).toEqual(createSourceFreeBallKernel(after.sourceCurve!).evaluateAt(result.boundary.boundaryElapsedSeconds).moment);
  expect(result.trace.steps.slice(0, -1)).toEqual(before.steps);
  expect(JSON.stringify(deriveSourceBattedFieldMotionV3(history))).toBe(originalBytes);
  expect(Object.isFrozen(after.moment.ball.position)).toBe(true);
});

it('stops at a real wall during the sub-tick wait instead of declaring the integer boundary reached', () => {
  const initial = groundFixture(), throughTicks = [812345];
  const ground = deriveSourceBattedFieldMotionV3({ initial, throughTicks }).field.motion.cursor!;
  const target = boundary({ originTick: ground.moment.originTick, elapsedSeconds: ground.moment.elapsedSeconds, ticksPerSecond: 1_000_000 });
  const x = ground.moment.ball.position.x + initial.cursor.sourceCurve.profile.ground.radiusM
    + ground.moment.ball.velocity.x * target.waitSeconds / 2;
  const surfaceId = 'wall-before-integer';
  initial.response.world.surfaces = [{ surfaceId, start: { x, z: -10 }, end: { x, z: 10 }, minimumHeight: 0, maximumHeight: 20 }];
  initial.response.surfaces = [{ surfaceId, material: { restitution: 0.5, tangentialDamping: 0.25, spinDamping: 0.2 } }];
  const result = advance({ initial, throughTicks });
  expect(result.kind).toBe('physical_boundary');
  expect(result.trace.field.motion.world.kind).toBe('boundary');
  expect(result.trace.field.motion.response.kind).toBe('rebound');
  expect(result.trace.field.motion.world.moment.elapsedSeconds).toBeGreaterThan(result.startMoment.elapsedSeconds);
  expect(result.trace.field.motion.world.moment.elapsedSeconds).toBeLessThan(result.boundary.boundaryElapsedSeconds);
});

it('does not add a zero-time query when the full original prefix is already at an integer boundary', () => {
  const initial = sourceFieldV3Fixture(), throughTicks: number[] = [];
  const before = deriveSourceBattedFieldMotionV3({ initial, throughTicks }), result = advance({ initial, throughTicks });
  expect(result.kind).toBe('already_at_integer_boundary');
  expect(result.boundary.waitSeconds).toBe(0);
  expect(result.trace).toEqual(before);
  expect(result.trace.steps).toHaveLength(0);
});

it('rederives the original private wall escape proof for a same-scope integer wait', () => {
  const initial = sourceFieldV3Fixture(), throughTicks = [212345];
  const before = deriveSourceBattedFieldMotionV3({ initial, throughTicks });
  expect(before.field.motion.response.kind).toBe('rebound');
  const result = advance({ initial, throughTicks });
  expect(result.kind).toBe('reached_integer_boundary');
  expect(result.trace.impulseCertificates).toEqual(before.impulseCertificates);
  expect(result.trace.escapedIntervals).toHaveLength(1);
  expect(result.trace.field.motion.cursor!.sourceCurve!.initial).toEqual(before.field.motion.cursor!.sourceCurve!.initial);
  expect(result.trace.field.motion.actors).toEqual(before.field.motion.actors);
});

it('rejects invalid clocks, caller cursor/certificate injection and active properties without executing them', () => {
  const input = { originTick: 0, elapsedSeconds: 1, ticksPerSecond: 1_000_000 };
  for (const raw of [null, [], {}, { ...input, originTick: -1 }, { ...input, originTick: 0.5 },
    { ...input, elapsedSeconds: NaN }, { ...input, elapsedSeconds: -1 }, { ...input, elapsedSeconds: Infinity },
    { ...input, ticksPerSecond: 0 }, { ...input, ticksPerSecond: 1.5 }, { ...input, ticksPerSecond: Number.MAX_SAFE_INTEGER + 1 },
    { ...input, motorReady: true }]) expect(() => boundary(raw as never)).toThrow();
  let reads = 0;
  expect(() => boundary({ ...input, get elapsedSeconds() { reads++; return 1; } })).toThrow();
  expect(reads).toBe(0);
  const history = { initial: sourceFieldV3Fixture(), throughTicks: [] };
  for (const extra of [{ cursor: history.initial.cursor }, { certificates: [] }, { commands: [] }]) {
    expect(() => advance({ ...history, ...extra } as never)).toThrow('history');
  }
  expect(() => advance({ initial: history.initial, get throughTicks() { reads++; return []; } })).toThrow();
  expect(reads).toBe(0);
});
