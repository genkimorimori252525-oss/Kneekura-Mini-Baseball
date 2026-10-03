import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import { createCanonicalPlateAppearanceTimeline, recordBatBallContact } from './CanonicalPlateAppearanceTimeline';
import { createBattedWorldFieldGeometry, deriveInitialBattedWorldFieldMotion, deriveBattedWorldFieldMotion } from '../ball/BattedWorldFieldMotion';
import { deriveBattedWorldFieldAcquisition } from '../ball/BattedWorldFieldAcquisition';
import { deriveBattedWorldFieldThrow } from '../ball/BattedWorldFieldThrow';
import { fixture, geometry, throwInput, v } from './CanonicalWholePlayHistory.test-support';
import { deriveCanonicalWholePlayHistory, type CanonicalWholePlayHistoryInput, type WholePlaySourceRef,
  type WholePlayHistoryStep } from './CanonicalWholePlayHistory';

const source = (owner: WholePlaySourceRef['owner'], revision: number, sourceId = `${owner}-${revision}`): WholePlaySourceRef =>
  ({ owner, sourceId, revision, physicalPitchSourceId: 'pitch-1' });
const prefix = (f = fixture()): CanonicalWholePlayHistoryInput => {
  const contact = f.response.world.flight.contact;
  const originalTimeline = recordBatBallContact(createCanonicalPlateAppearanceTimeline({ ruleProfileId: asRuleProfileId('npb-2026'),
    inning: 1, half: 'top', outs: 0, balls: 0, strikes: 0, bases: { first: null, second: null, third: null },
    score: { away: 0, home: 0 }, playId: 1 }, contact.tick), contact);
  const moment = { originTick: contact.tick, elapsedSeconds: 0, ball: f.response.world.flight.initialBall };
  return { scope: { gameId: 'game-1', playId: 1, physicalPitchSourceId: 'pitch-1' }, originalTimeline,
    origin: { moment, actors: f.response.world.actors, batterRunnerId: 'batter', defenderIds: ['carrier', 'receiver'],
      ticksPerSecond: f.response.world.parameters.ticksPerSecond },
    steps: [{ source: source('field_action', 1), previousSourceId: null, kind: 'motion',
      startCursor: { moment, previousContacts: [] }, field: deriveInitialBattedWorldFieldMotion(f) }] };
};
const acquired = (f = fixture()) => {
  const input = prefix(f), field = input.steps[0];
  if (field.kind !== 'motion') throw new Error('motion fixture');
  const acquisition = deriveBattedWorldFieldAcquisition({ response: f.response, geometry: f.geometry, field: field.field });
  const step: WholePlayHistoryStep = { kind: 'acquisition', source: source('field_execution', 1), previousSourceId: null,
    field: field.field, acquisition };
  return { input: { ...input, steps: [...input.steps, step] }, acquisition };
};
const thrown = (f = fixture(), delay = 100_000) => {
  const { input, acquisition } = acquired(f), actual = deriveBattedWorldFieldThrow(throwInput(f, delay));
  if (acquisition.kind !== 'secured') throw new Error('secured fixture');
  const step: WholePlayHistoryStep = { kind: 'throw', source: source('field_execution', 2), previousSourceId: 'field_execution-1',
    startCursor: { moment: acquisition.moment, previousContacts: [{ kind: 'actor', playerId: 'carrier', role: 'glove' }] },
    field: actual.field, throw: actual };
  return { input: { ...input, steps: [...input.steps, step] }, actual };
};

it('retains the exact original pitch timeline and freezes raw pitch-to-field history without ending it', () => {
  const input = prefix(), before = JSON.stringify(input), history = deriveCanonicalWholePlayHistory(input);
  expect(JSON.stringify(history.originalTimeline)).toBe(JSON.stringify(input.originalTimeline));
  expect(history.physicalSteps).toEqual(input.steps);
  expect(history.originalPitch).toEqual({ owner: 'physical_pitch', sourceId: 'pitch-1' });
  expect(history.horizon).toEqual(input.steps[0].kind === 'motion' && input.steps[0].field.motion.world.moment);
  expect(history.end).toEqual({ kind: 'unestablished' });
  expect(Object.isFrozen(history.physicalSteps[0])).toBe(true);
  expect(Object.isFrozen(history.originalTimeline.events)).toBe(true);
  expect(JSON.stringify(input)).toBe(before); expect(Object.isFrozen(input)).toBe(false);
});

it('retains acquisition, exact release cursor, launch, bag companion and post-rebound velocity', () => {
  const { input, actual } = thrown(), history = deriveCanonicalWholePlayHistory(input);
  expect(actual.kind).toBe('released'); if (actual.kind !== 'released') throw new Error('release fixture');
  expect(history.physicalSteps).toEqual(input.steps); expect(actual.field.motion.response.kind).toBe('rebound');
  expect(history.frames.find((frame) => frame.elapsedSeconds === actual.releaseCursor.moment.elapsedSeconds)?.occurrences)
    .toContainEqual({ source: source('field_execution', 2), phase: 'throw_release' });
  expect(history.frames.at(-1)?.occurrences).toEqual([
    { source: source('field_execution', 2), phase: 'world_boundary' },
    { source: source('field_execution', 2), phase: 'response_cursor' },
  ]);
  expect(actual.field.baseContacts).toHaveLength(1);
  expect(actual.field.motion.cursor?.moment.ball.velocity).toEqual(v(2.5, 0, 0));
});

it('keeps distinct elapsed times inside a recorded tick and groups exact coincidence without event ordering', () => {
  const { input, actual } = thrown(fixture(0, 0.0625 / 0.0625001), 0), history = deriveCanonicalWholePlayHistory(input);
  if (actual.kind !== 'released') throw new Error('release fixture');
  const frames = history.frames.filter((frame) => frame.tick === 62_501);
  expect(frames.map((frame) => frame.elapsedSeconds)).toEqual([0.0625001, 0.062501]);
  expect(history.frames[0].occurrences).toHaveLength(2);
  expect(history.frames[0]).not.toHaveProperty('sequence');
  expect(history.frames[0].occurrences[0]).not.toHaveProperty('sequence');
});

it('retains an interrupted acquisition without fabricating custody, secure or release', () => {
  const { input, acquisition } = acquired(fixture(0, 0.03125)), history = deriveCanonicalWholePlayHistory(input);
  expect(acquisition.kind).toBe('interrupted'); expect(history.physicalSteps).toEqual(input.steps);
  expect(history.frames.flatMap((frame) => frame.occurrences.map((occurrence) => occurrence.phase)))
    .not.toContain('acquisition_secured');
  expect(history.frames.at(-1)?.occurrences).toEqual([{ source: source('field_execution', 1), phase: 'acquisition_interrupted' }]);
  expect(history.cursor).toBeNull(); expect(history.carrierPlayerId).toBeNull();
});

it('retains interrupted transfer and every actual contact without inventing release', () => {
  const { input, actual } = thrown(fixture(), 2_000_000), history = deriveCanonicalWholePlayHistory(input);
  expect(actual.kind).toBe('interrupted'); expect(history.physicalSteps).toEqual(input.steps);
  expect(history.frames.flatMap((frame) => frame.occurrences.map((occurrence) => occurrence.phase))).not.toContain('throw_release');
  expect(history.cursor).toBeNull(); expect(history.carrierPlayerId).toBe('carrier');
});

it('binds mixed observations to the unchanged physical prefix and permits equal IDs in different owners', () => {
  const input = prefix(), first = input.steps[0], root = source('field_action', 1, 'same');
  if (first.kind !== 'motion') throw new Error('motion fixture');
  const basis = { ...first, source: root };
  const observations: WholePlayHistoryStep[] = ['base_touch_history', 'first_base_race', 'whole_play_history'].map((kind, index) => ({
    source: source('field_execution', index + 1, index === 0 ? 'same' : `obs-${index}`),
    previousSourceId: index === 0 ? null : index === 1 ? 'same' : `obs-${index - 1}`, kind: 'observation',
    observationKind: kind as 'base_touch_history', basis: root, horizon: first.field.motion.world.moment,
  }));
  const before = deriveCanonicalWholePlayHistory({ ...input, steps: [basis] });
  const history = deriveCanonicalWholePlayHistory({ ...input, steps: [basis, ...observations] });
  expect(history.physicalSteps).toEqual(before.physicalSteps); expect(history.frames).toEqual(before.frames);
  expect(history.horizon).toEqual(before.horizon); expect(history.observations).toEqual(observations);
  expect(history.end).toEqual({ kind: 'unestablished' });
});

it('uses executed horizon rather than the future motor interval and keeps carried motion raw', () => {
  const f = fixture(), { input, acquisition } = acquired(f);
  if (acquisition.kind !== 'secured') throw new Error('secured fixture');
  const startCursor = { moment: acquisition.moment, previousContacts: [{ kind: 'actor' as const, playerId: 'carrier', role: 'glove' as const }] };
  const field = deriveBattedWorldFieldMotion({ ...f, throughTick: 100_000, cursor: startCursor,
    actors: f.response.world.actors, carrierPlayerId: 'carrier' });
  const history = deriveCanonicalWholePlayHistory({ ...input, steps: [...input.steps,
    { source: source('field_execution', 2), previousSourceId: 'field_execution-1', kind: 'motion', startCursor, field }] });
  expect(history.horizon.elapsedSeconds).toBe(0.1); expect(history.carrierPlayerId).toBe('carrier');
  expect(history.frames.every((frame) => frame.elapsedSeconds <= 0.1)).toBe(true);
  expect(history.physicalSteps.at(-1)).toMatchObject({ field: { motion: { response: { kind: 'carried' } } } });
});

it('keeps a stopped ball and exhausted physical horizon open', () => {
  const f = fixture(), changed = { ...f, throughTick: 100_000, response: { ...f.response, world: { ...f.response.world,
    flight: { ...f.response.world.flight, contact: { ...f.response.world.flight.contact, exitVelocity: v(0, 0, 0) },
      initialBall: { ...f.response.world.flight.initialBall, velocity: v(0, 0, 0) } },
    actors: f.response.world.actors.map((actor) => ({ ...actor, primitive: { ...actor.primitive, startCenter: v(-20, 3, 0) } })) } } };
  const history = deriveCanonicalWholePlayHistory(prefix(changed));
  expect(history.horizon.ball.velocity).toEqual(v(0, 0, 0)); expect(history.horizon.elapsedSeconds).toBe(0.1);
  expect(history.end).toEqual({ kind: 'unestablished' }); expect(history).not.toHaveProperty('playEnd');
});

it.each([
  ['scope', (input: CanonicalWholePlayHistoryInput) => ({ ...input, scope: { ...input.scope, playId: 2 } })],
  ['pitch scope', (input: CanonicalWholePlayHistoryInput) => ({ ...input, scope: { ...input.scope, physicalPitchSourceId: 'other' } })],
  ['timeline result', (input: CanonicalWholePlayHistoryInput) => ({ ...input, originalTimeline: { ...input.originalTimeline,
    status: { kind: 'live_ball_complete' } } })],
  ['caller result', (input: CanonicalWholePlayHistoryInput) => ({ ...input, playEnd: { tick: 0 } })],
  ['step result', (input: CanonicalWholePlayHistoryInput) => ({ ...input, steps: [{ ...input.steps[0], out: true }] })],
  ['source revision', (input: CanonicalWholePlayHistoryInput) => ({ ...input, steps: [{ ...input.steps[0], source: source('field_action', 2) }] })],
  ['previous source', (input: CanonicalWholePlayHistoryInput) => ({ ...input, steps: [{ ...input.steps[0], previousSourceId: 'missing' }] })],
  ['original origin', (input: CanonicalWholePlayHistoryInput) => ({ ...input, origin: { ...input.origin,
    moment: { ...input.origin.moment, elapsedSeconds: 0.1 } } })],
])('rejects %s injection', (_, mutate) => {
  expect(() => deriveCanonicalWholePlayHistory(mutate(prefix()) as CanonicalWholePlayHistoryInput)).toThrow();
});

it('rejects stale throw cursor, foreign actor and absent explicit bag companion', () => {
  const { input, actual } = thrown(); if (actual.kind !== 'released') throw new Error('release fixture');
  const prior = input.steps.at(-1)!;
  if (prior.kind !== 'throw') throw new Error('throw fixture');
  const changes = [
    { ...prior, startCursor: { ...prior.startCursor, moment: { ...prior.startCursor.moment, ball: input.origin.moment.ball } } },
    { ...prior, field: { ...prior.field, baseContacts: [] } },
    { ...prior, field: { ...prior.field, motion: { ...prior.field.motion, actors: prior.field.motion.actors.map((actor, index) =>
      index ? actor : { ...actor, playerId: 'foreign' }) } } },
  ];
  for (const changed of changes) expect(() => deriveCanonicalWholePlayHistory({ ...input, steps: [...input.steps.slice(0, -1), changed] })).toThrow();
});

it('rejects observations that advance time, bind to another owner, inject results or embed an earlier history', () => {
  const input = prefix(), field = input.steps[0]; if (field.kind !== 'motion') throw new Error('motion fixture');
  const observation = { kind: 'observation' as const, observationKind: 'whole_play_history' as const, source: source('field_execution', 1),
    previousSourceId: null, basis: field.source, horizon: field.field.motion.world.moment };
  for (const changed of [
    { ...observation, horizon: { ...observation.horizon, elapsedSeconds: 1 } },
    { ...observation, basis: { ...observation.basis, owner: 'field_execution' as const } },
    { ...observation, result: 'out' }, { ...observation, history: deriveCanonicalWholePlayHistory(input) },
  ]) expect(() => deriveCanonicalWholePlayHistory({ ...input, steps: [...input.steps, changed] })).toThrow();
});

it('retains simultaneous initial actor and bag contact without fabricating acquisition', () => {
  const f = { ...fixture(), geometry: geometry(1.375) }, input = prefix(f), history = deriveCanonicalWholePlayHistory(input);
  const step = history.physicalSteps[0]; if (step.kind !== 'motion') throw new Error('motion fixture');
  expect(step.field.motion.world).toMatchObject({ kind: 'boundary' });
  expect(step.field.baseContacts).toHaveLength(1); expect(history.physicalSteps).toEqual(input.steps);
  expect(history.frames).toHaveLength(1); expect(history.end).toEqual({ kind: 'unestablished' });
});

it('rejects execution-only history without its field owner prefix', () => {
  const input = prefix();
  expect(() => deriveCanonicalWholePlayHistory({ ...input, steps: [{ ...input.steps[0], source: source('field_execution', 1) }] })).toThrow();
});

it('rejects nested baseball-result payloads inside retained physical state', () => {
  const input = prefix(), step = input.steps[0]; if (step.kind !== 'motion') throw new Error('motion fixture');
  const response = step.field.motion.response; if (response.kind !== 'capture_candidate') throw new Error('capture fixture');
  const changed = { ...step, field: { ...step.field, motion: { ...step.field.motion, response: { ...response,
    retention: { ...response.retention, out: true } } } } };
  expect(() => deriveCanonicalWholePlayHistory({ ...input, steps: [changed] })).toThrow();
});

it('rejects changed incoming ball state at an exact zero-duration motion boundary', () => {
  const input = prefix(), step = input.steps[0]; if (step.kind !== 'motion') throw new Error('motion fixture');
  const world = step.field.motion.world, response = step.field.motion.response;
  if (world.kind !== 'boundary' || response.kind !== 'capture_candidate') throw new Error('capture fixture');
  const moment = { ...world.moment, ball: { ...world.moment.ball, velocity: v(100, 0, 0) } };
  const changed = { ...step, field: { ...step.field, motion: { ...step.field.motion, response: { ...response, moment },
    world: { ...world, moment, contacts: world.contacts.map((contact) => ({ ...contact, moment })) } } } };
  expect(() => deriveCanonicalWholePlayHistory({ ...input, steps: [changed] })).toThrow();
});

it('rejects mutually matching release/launch positions that teleport away from the carried ball', () => {
  const { input, actual } = thrown(); if (actual.kind !== 'released') throw new Error('release fixture');
  const position = { ...actual.releaseCursor.moment.ball.position, x: 20 };
  const changed = { ...input.steps.at(-1)!, throw: { ...actual, launch: { ...actual.launch, origin: position },
    releaseCursor: { ...actual.releaseCursor, moment: { ...actual.releaseCursor.moment,
      ball: { ...actual.releaseCursor.moment.ball, position } } } } };
  expect(() => deriveCanonicalWholePlayHistory({ ...input, steps: [...input.steps.slice(0, -1), changed] })).toThrow();
});

it('retains both pre-response and persistent-contact states at the same exact time without normalizing raw companions', () => {
  const f = fixture(), changed = { ...f, geometry: createBattedWorldFieldGeometry({ baseGeometry: f.geometry.baseGeometry,
    baseModels: { ...f.geometry.baseModels, home: { bottomY: 0, material: { restitution: 0, tangentialDamping: 0.25, spinDamping: 0.2 } } } }) };
  const { input, actual } = thrown(changed);
  if (actual.kind !== 'released' || !actual.field.motion.cursor) throw new Error('rebound fixture');
  const startCursor = actual.field.motion.cursor;
  const field = deriveBattedWorldFieldMotion({ ...changed, cursor: startCursor, actors: actual.field.motion.actors,
    carrierPlayerId: null, availableAtTick: startCursor.moment.ball.tick });
  const step: WholePlayHistoryStep = { source: source('field_execution', 3), previousSourceId: 'field_execution-2',
    kind: 'motion', startCursor, field };
  const history = deriveCanonicalWholePlayHistory({ ...input, steps: [...input.steps, step] });
  expect(actual.field.motion.response.kind).toBe('rebound');
  expect(field.motion.world).toMatchObject({ kind: 'boundary', pendingReason: 'persistent_contact' });
  expect(field.motion.world.moment.elapsedSeconds).toBe(actual.field.motion.world.moment.elapsedSeconds);
  expect(field.motion.world.moment.ball.velocity).not.toEqual(actual.field.motion.world.moment.ball.velocity);
  expect(history.physicalSteps.at(-1)).toEqual(step);
  expect(history.physicalSteps.at(-2)).toEqual(input.steps.at(-1));
  expect(actual.field.baseContacts[0].continuing).toBeUndefined(); expect(field.baseContacts[0].continuing).toBe(true);
  expect(history.frames.at(-1)?.occurrences).toEqual([
    { source: source('field_execution', 2), phase: 'world_boundary' },
    { source: source('field_execution', 2), phase: 'response_cursor' },
    { source: source('field_execution', 3), phase: 'world_boundary' },
  ]);
  expect(history.cursor).toBeNull(); expect(history.end).toEqual({ kind: 'unestablished' });
});

it('keeps original integer bat precision at a large clock while preserving later elapsed fractions', () => {
  const { input, actual } = thrown(fixture(2 ** 52, 0.0625 / 0.0625001), 0);
  const history = deriveCanonicalWholePlayHistory(input);
  if (actual.kind !== 'released') throw new Error('release fixture');
  expect(history.frames[0]).toMatchObject({ originTick: 2 ** 52, elapsedSeconds: 0, tick: 2 ** 52 });
  expect(history.frames.filter((frame) => frame.tick === 2 ** 52 + 62_501).map((frame) => frame.elapsedSeconds))
    .toEqual([0.0625001, 0.062501]);
  expect(actual.launch.releaseTick).toBe(2 ** 52 + 62_501);
  expect(JSON.stringify(history.originalTimeline)).toBe(JSON.stringify(input.originalTimeline));
});
