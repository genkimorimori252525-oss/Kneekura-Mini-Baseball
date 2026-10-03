import { expect, it } from 'vitest';
import { prepareBattedWorldScheduledFieldThrow, advanceBattedWorldScheduledFieldThrow } from '../ball/BattedWorldScheduledFieldThrow';
import { deriveCanonicalWholePlayHistory, type CanonicalWholePlayHistoryInput } from './CanonicalWholePlayHistory';
import { acquiredHistory, fixture, historySource, throwInput } from './CanonicalWholePlayHistory.test-support';

const plannedHistory = (f = fixture(), delay = 100_000) => {
  const input = acquiredHistory(f), throwing = throwInput(f, delay);
  const plan = prepareBattedWorldScheduledFieldThrow(throwing);
  const step = { source: historySource(2), previousSourceId: 'execution-1', kind: 'throw_plan' as const,
    basis: historySource(1), horizon: throwing.cursor.moment, plan };
  return { input, plan, step, planned: { ...input, steps: [...input.steps, step] } as CanonicalWholePlayHistoryInput };
};

it('retains admitted scheduled transfer separately without inventing elapsed time, actors, custody or physical occurrences', () => {
  const { input, plan, step, planned } = plannedHistory();
  const before = deriveCanonicalWholePlayHistory(input), after = deriveCanonicalWholePlayHistory(planned);
  expect(after.physicalSteps).toEqual(before.physicalSteps);
  expect(after.frames).toEqual(before.frames);
  expect(after.horizon).toEqual(before.horizon);
  expect(after.cursor).toEqual(before.cursor);
  expect(after.carrierPlayerId).toBe(before.carrierPlayerId);
  expect(after).toMatchObject({ scheduledThrowPlans: [step] });
  expect(after.frames.every((frame) => frame.elapsedSeconds < plan.releaseElapsedSeconds)).toBe(true);
  expect(before).not.toHaveProperty('scheduledThrowPlans');
  expect(after.end).toEqual({ kind: 'unestablished' });
});

import type { BattedWorldScheduledFieldThrowAdvance } from '../ball/BattedWorldScheduledFieldThrow';
const transferStep = (x: ReturnType<typeof plannedHistory>, throughElapsedSeconds: number, revision = 3,
  previous: BattedWorldScheduledFieldThrowAdvance | null = null) => {
  const progress = advanceBattedWorldScheduledFieldThrow({ plan: x.plan, previous, throughElapsedSeconds });
  return { source: historySource(revision), previousSourceId: `execution-${revision - 1}`, kind: 'throw_advance' as const,
    planSourceId: x.step.source.sourceId, startCursor: progress.startCursor, field: progress.field, progress };
};

it('retains only actual transfer deltas while every resume keeps the original transfer start and admitted actor anchors', () => {
  const x = plannedHistory(), first = transferStep(x, 0.1), second = transferStep(x, 0.125, 4, first.progress);
  const history = deriveCanonicalWholePlayHistory({ ...x.planned, steps: [...x.planned.steps, first, second] } as CanonicalWholePlayHistoryInput);
  expect(history.horizon.elapsedSeconds).toBe(0.125);
  expect(history.physicalSteps.map((step) => step.kind)).toEqual(['motion', 'acquisition', 'throw_advance', 'throw_advance']);
  expect(history.physicalSteps.slice(-2)).toEqual([first, second]);
  expect(history.frames.map((frame) => frame.elapsedSeconds)).toEqual([0, 0.0625, 0.1, 0.125]);
  expect(second.progress.transfer.securedPossessionTick).toBe(62_500);
  expect(second.startCursor.moment.elapsedSeconds).toBe(0.1);
  expect(second.field.motion.actors).toEqual(x.plan.actors);
  expect(history.carrierPlayerId).toBe('carrier');
});

it('records exclusive release exactly once after partial progress without pretending the checkpoint began the transfer', () => {
  const x = plannedHistory(), first = transferStep(x, 0.1);
  const released = transferStep(x, 0.2, 4, first.progress), actual = released.progress;
  if (actual.kind !== 'released') throw new Error('scheduled release fixture');
  const history = deriveCanonicalWholePlayHistory({ ...x.planned, steps: [...x.planned.steps, first, released] } as CanonicalWholePlayHistoryInput);
  expect(history.horizon.elapsedSeconds).toBe(x.plan.releaseElapsedSeconds);
  expect(history.carrierPlayerId).toBeNull();
  expect(history.cursor).toEqual(actual.releaseCursor);
  expect(history.frames.flatMap((frame) => frame.occurrences).filter((value) => value.phase === 'throw_release'))
    .toEqual([{ source: historySource(4), phase: 'throw_release' }]);
  expect(history.end).toEqual({ kind: 'unestablished' });
});

it('preserves raw bag interruption after a checkpoint and never fabricates a scheduled release', () => {
  const x = plannedHistory(fixture(), 2_000_000), first = transferStep(x, 0.1);
  const interrupted = transferStep(x, 2.0625, 4, first.progress);
  expect(interrupted.progress.kind).toBe('interrupted');
  const history = deriveCanonicalWholePlayHistory({ ...x.planned, steps: [...x.planned.steps, first, interrupted] } as CanonicalWholePlayHistoryInput);
  expect(history.physicalSteps.at(-1)?.field).toEqual(interrupted.field);
  expect(interrupted.field.baseContacts).toHaveLength(1);
  expect(history.cursor).toBeNull(); expect(history.carrierPlayerId).toBe('carrier');
  expect(history.frames.flatMap((frame) => frame.occurrences).some((value) => value.phase === 'throw_release')).toBe(false);
});

it('keeps multiple transfer checkpoints within one recorded tick and emits only the original zero-delay release', () => {
  const x = plannedHistory(fixture(0, 0.0625 / 0.0625001), 0);
  const first = transferStep(x, 0.0625003), second = transferStep(x, 0.0625007, 4, first.progress);
  const release = transferStep(x, 0.062501, 5, second.progress);
  const history = deriveCanonicalWholePlayHistory({ ...x.planned, steps: [...x.planned.steps, first, second, release] });
  expect(history.frames.filter((frame) => frame.tick === 62_501).map((frame) => frame.elapsedSeconds))
    .toEqual([0.0625001, 0.0625003, 0.0625007, 0.062501]);
  expect(release.progress.transfer.securedPossessionTick).toBe(62_501);
  expect(history.frames.at(-1)?.occurrences.filter((value) => value.phase === 'throw_release')).toHaveLength(1);
});

it('rejects plan metadata that invents prepared actors or a different delay before any physical advance', () => {
  const x = plannedHistory();
  const changedPlans = [
    { ...x.plan, actors: [] },
    { ...x.plan, transfer: { ...x.plan.transfer, transferDelayTicks: 200_000, throwReadyTick: 262_500 }, releaseElapsedSeconds: 0.2625 },
  ];
  for (const plan of changedPlans) expect(() => deriveCanonicalWholePlayHistory({ ...x.input,
    steps: [...x.input.steps, { ...x.step, plan }] })).toThrow();
});

it('rejects checkpoint replays, transfer restarts, foreign plans, hidden closure and orphan advances', () => {
  const x = plannedHistory(), first = transferStep(x, 0.1), second = transferStep(x, 0.125, 4, first.progress);
  const changes = [
    { ...second, planSourceId: 'foreign' },
    { ...second, startCursor: first.startCursor },
    { ...second, progress: { ...second.progress, checkpointElapsedSeconds: [0.125] } },
    { ...second, progress: { ...second.progress, planIdentity: 'foreign' } },
    { ...second, progress: { ...second.progress, transfer: { ...second.progress.transfer, securedPossessionTick: 100_000 } } },
    { ...second, progress: { ...second.progress, playEnd: true } },
  ];
  for (const changed of changes) expect(() => deriveCanonicalWholePlayHistory({ ...x.planned,
    steps: [...x.planned.steps, first, changed] })).toThrow();
  expect(() => deriveCanonicalWholePlayHistory({ ...x.input, steps: [...x.input.steps,
    { ...first, source: historySource(2), previousSourceId: 'execution-1' }] })).toThrow();
});

it('retains a real same-time post-release contact and its unresolved response without reviving the release cursor', () => {
  const raw = fixture(0, 1, 0.125), f = { ...raw, commands: raw.commands.map((command) => ({ ...command,
    acceleration: command.playerId === 'receiver' ? { x: 0, y: -2, z: 0 } : command.acceleration })) };
  const x = plannedHistory(f), release = transferStep(x, 1), progress = release.progress;
  expect(progress.kind).toBe('released');
  if (progress.kind !== 'released') throw new Error('contact release fixture');
  expect(progress.field.motion.world.kind).toBe('boundary');
  expect(progress.field.motion.response).toMatchObject({ kind: 'unresolved', cursor: null });
  const history = deriveCanonicalWholePlayHistory({ ...x.planned, steps: [...x.planned.steps, release] });
  expect(history.physicalSteps.at(-1)).toEqual(release);
  expect(history.frames.at(-1)?.occurrences.map((value) => value.phase)).toEqual(['throw_release', 'world_boundary']);
  expect(history.horizon).toEqual(progress.field.motion.world.moment);
  expect(history.cursor).toBeNull(); expect(history.carrierPlayerId).toBeNull();
  expect(history.end).toEqual({ kind: 'unestablished' });
});

it('rejects an unexecuted pending checkpoint disguised as a physical transfer occurrence', () => {
  const x = plannedHistory(), actual = transferStep(x, 0.1), cursor = x.plan.input.cursor;
  const field = { ...actual.field, motion: { ...actual.field.motion,
    world: { kind: 'moving' as const, moment: cursor.moment, throughTick: cursor.moment.ball.tick },
    response: { kind: 'carried' as const, cursor }, cursor } };
  const invented = { ...actual, field, progress: { ...actual.progress, field, checkpointElapsedSeconds: [cursor.moment.elapsedSeconds] } };
  expect(() => deriveCanonicalWholePlayHistory({ ...x.planned, steps: [...x.planned.steps, invented] })).toThrow();
});
