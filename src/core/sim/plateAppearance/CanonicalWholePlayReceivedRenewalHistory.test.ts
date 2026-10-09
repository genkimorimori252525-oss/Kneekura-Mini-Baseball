import { expect, it } from 'vitest';
import { advanceBattedWorldFieldMotionCheckpoint, deriveBattedWorldFieldMotionAdoption,
  deriveInitialBattedWorldFieldMotion, type BattedWorldFieldMotion } from '../ball/BattedWorldFieldMotion';
import { deriveCanonicalWholePlayHistory, type CanonicalWholePlayHistoryInput } from './CanonicalWholePlayHistory';
import { acquiredHistory, fixture, geometry, historySource, v } from './CanonicalWholePlayHistory.test-support';

const received = (free = false) => {
  const original = fixture(), acquired = acquiredHistory(original);
  const f = free ? { ...original, geometry: geometry(3.0000003), response: { ...original.response,
    world: { ...original.response.world, actors: original.response.world.actors.map(actor => ({ ...actor,
      primitive: { ...actor.primitive, startCenter: v(-20, 3, 0), startVelocity: v(0, 0, 0) } })) } } } : original;
  const input: CanonicalWholePlayHistoryInput = free ? { ...acquired, origin: { ...acquired.origin, actors: f.response.world.actors },
    steps: [{ ...acquired.steps[0], kind: 'motion', startCursor: { moment: acquired.origin.moment, previousContacts: [] },
      field: deriveInitialBattedWorldFieldMotion({ ...f, throughTick: 100_000 }) }] } : acquired;
  const prior = deriveCanonicalWholePlayHistory(input), cursor = prior.cursor;
  if (!cursor) throw new Error('received fixture requires a resolved cursor');
  const previous = input.steps.at(-1)!;
  const revision = previous.source.owner === 'field_execution' ? previous.source.revision + 1 : 1;
  const field = deriveBattedWorldFieldMotionAdoption({ response: f.response, geometry: f.geometry, cursor,
    actors: input.steps[0].kind === 'motion' ? input.steps[0].field.motion.actors : [], carrierPlayerId: prior.carrierPlayerId,
    availableAtTick: cursor.moment.ball.tick, coverageThroughTick: f.throughTick,
    commands: f.commands.map(command => ({ ...command, acceleration: v(free ? 0 : 0.5, 0, 0) })) });
  const adoption = { source: historySource(revision, 'received-adoption'),
    previousSourceId: previous.source.owner === 'field_execution' ? previous.source.sourceId : null,
    kind: 'received_renewal_adoption_v1' as const, startCursor: cursor, field };
  const continuation = (checkpointThroughTick: number) => ({ source: historySource(revision + 1, 'received-continuation'),
    previousSourceId: adoption.source.sourceId, kind: 'received_renewal_continuation_v1' as const, startCursor: field.motion.cursor!,
    field: advanceBattedWorldFieldMotionCheckpoint({ response: f.response, geometry: f.geometry,
      actors: field.motion.actors, cursor: field.motion.cursor!, carrierPlayerId: prior.carrierPlayerId, checkpointThroughTick }) });
  return { input, prior, adoption, continuation };
};

it('keeps received adoption identity and old history bytes at the exact unchanged cut', () => {
  const { input, prior, adoption } = received(), before = JSON.stringify(input), old = JSON.stringify(prior);
  const history = deriveCanonicalWholePlayHistory({ ...input, steps: [...input.steps, adoption] });
  expect(history.physicalSteps.at(-1)).toEqual(adoption);
  expect(JSON.stringify(history.physicalSteps.slice(0, -1))).toBe(JSON.stringify(prior.physicalSteps));
  expect(JSON.stringify(history.originalTimeline)).toBe(JSON.stringify(prior.originalTimeline));
  expect(history.horizon).toEqual(prior.horizon); expect(history.cursor).toEqual(prior.cursor);
  expect(history.carrierPlayerId).toBe(prior.carrierPlayerId);
  expect(adoption.field.motion.actors).not.toEqual(prior.origin.actors);
  expect(history.frames.at(-1)?.occurrences.at(-1)).toEqual({ source: adoption.source, phase: 'motion_horizon' });
  expect(Object.isFrozen(history.physicalSteps.at(-1))).toBe(true);
  expect(history.end).toEqual({ kind: 'unestablished' });
  expect(JSON.stringify(input)).toBe(before); expect(JSON.stringify(deriveCanonicalWholePlayHistory(input))).toBe(old);
});

it('retains renewed actor curves and normal custody/cursor through positive contact-free time', () => {
  const { input, adoption, continuation } = received(), step = continuation(100_000);
  const history = deriveCanonicalWholePlayHistory({ ...input, steps: [...input.steps, adoption, step] });
  expect(history.physicalSteps.slice(-2)).toEqual([adoption, step]);
  expect(step.field.motion.actors).toEqual(adoption.field.motion.actors);
  expect(history.horizon.elapsedSeconds).toBe(0.1); expect(history.cursor).toEqual(step.field.motion.cursor);
  expect(history.carrierPlayerId).toBe('carrier'); expect(step.field.motion.response.kind).toBe('carried');
  expect(history.end).toEqual({ kind: 'unestablished' });
});

it('preserves an earlier fractional carried boundary, raw contacts and unresolved response', () => {
  const { input, adoption, continuation } = received(), step = continuation(3_000_000), end = step.field.motion.world.moment;
  const history = deriveCanonicalWholePlayHistory({ ...input, steps: [...input.steps, adoption, step] });
  expect(end.elapsedSeconds).toBeLessThan(3);
  expect(Number.isInteger(end.elapsedSeconds * input.origin.ticksPerSecond)).toBe(false);
  expect(history.horizon).toEqual(end); expect(history.frames.at(-1)?.elapsedSeconds).toBe(end.elapsedSeconds);
  expect(history.physicalSteps.at(-1)).toEqual(step); expect(step.field.baseContacts).toHaveLength(1);
  expect(step.field.motion.response).toEqual({ kind: 'unresolved', reason: 'carried_contact', cursor: null });
  expect(history.cursor).toBeNull(); expect(history.carrierPlayerId).toBe('carrier');
  expect(history.end).toEqual({ kind: 'unestablished' });
});

it('preserves the incoming free boundary and its separate same-time response cursor', () => {
  const { input, adoption, continuation } = received(true), step = continuation(2_000_000);
  const history = deriveCanonicalWholePlayHistory({ ...input, steps: [...input.steps, adoption, step] });
  expect(step.field.motion.response.kind).toBe('rebound'); expect(step.field.baseContacts).toHaveLength(1);
  expect(Number.isInteger(history.horizon.elapsedSeconds * input.origin.ticksPerSecond)).toBe(false);
  expect(history.horizon).toEqual(step.field.motion.world.moment); expect(history.cursor).toEqual(step.field.motion.cursor);
  expect(history.cursor?.moment).not.toEqual(history.horizon);
  expect(history.frames.at(-1)?.occurrences).toEqual([
    { source: step.source, phase: 'world_boundary' }, { source: step.source, phase: 'response_cursor' },
  ]);
});

it('rejects received adoption that changes time, ball, cursor, custody, actor continuity or contacts', () => {
  const { input, adoption, continuation } = received(), advanced = continuation(100_000).field;
  const changedCursor = { ...adoption.startCursor, previousContacts: [] };
  const changedBall = { ...adoption.startCursor.moment, ball: { ...adoption.startCursor.moment.ball, position: v(9, 0.5, 0) } };
  const changedBallCursor = { ...adoption.startCursor, moment: changedBall };
  const changes: readonly BattedWorldFieldMotion[] = [advanced,
    { ...adoption.field, motion: { ...adoption.field.motion, cursor: changedBallCursor,
      response: { kind: 'carried', cursor: changedBallCursor },
      world: { kind: 'moving', moment: changedBall, throughTick: changedBall.ball.tick } } },
    { ...adoption.field, motion: { ...adoption.field.motion, cursor: changedCursor,
      response: { kind: 'carried', cursor: changedCursor } } },
    { ...adoption.field, motion: { ...adoption.field.motion, carrierPlayerId: null,
      response: { kind: 'moving', cursor: adoption.startCursor } } },
    { ...adoption.field, motion: { ...adoption.field.motion,
      world: { kind: 'boundary', moment: adoption.startCursor.moment, contacts: [{ kind: 'ground', moment: adoption.startCursor.moment }] } } },
    { ...adoption.field, motion: { ...adoption.field.motion, actors: adoption.field.motion.actors.map(actor => ({ ...actor,
      primitive: { ...actor.primitive, startCenter: v(9, 0.5, 0) } })) } },
  ];
  for (const field of changes) expect(() => deriveCanonicalWholePlayHistory({ ...input,
    steps: [...input.steps, { ...adoption, field }] })).toThrow();
});

it('rejects received continuation with zero elapsed time or altered actor curves', () => {
  const { input, adoption, continuation } = received(), step = continuation(100_000);
  for (const field of [adoption.field, { ...step.field, motion: { ...step.field.motion,
    actors: step.field.motion.actors.map(actor => ({ ...actor, primitive: { ...actor.primitive,
      acceleration: v(1, 0, 0) } })) } }]) {
    expect(() => deriveCanonicalWholePlayHistory({ ...input, steps: [...input.steps, adoption, { ...step, field }] })).toThrow();
  }
});

it('rejects received Source lineage changes and observations bound to a stale physical basis', () => {
  const { input, adoption, continuation } = received(), step = continuation(100_000);
  for (const changed of [{ ...step, previousSourceId: 'stale' },
    { ...step, source: { ...step.source, physicalPitchSourceId: 'foreign-pitch' } }]) {
    expect(() => deriveCanonicalWholePlayHistory({ ...input, steps: [...input.steps, adoption, changed] })).toThrow();
  }
  const observation = { source: historySource(step.source.revision + 1), previousSourceId: step.source.sourceId,
    kind: 'observation' as const, observationKind: 'whole_play_history' as const, basis: step.source, horizon: step.field.motion.world.moment };
  const steps = [...input.steps, adoption, step, observation];
  expect(deriveCanonicalWholePlayHistory({ ...input, steps }).observations).toEqual([observation]);
  expect(() => deriveCanonicalWholePlayHistory({ ...input, steps: [...steps.slice(0, -1),
    { ...observation, basis: adoption.source }] })).toThrow();
});
