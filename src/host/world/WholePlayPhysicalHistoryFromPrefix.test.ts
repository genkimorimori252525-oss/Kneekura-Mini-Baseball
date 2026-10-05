import { expect, it, vi } from 'vitest';
import * as physical from './BattedWorldFieldPhysicalPrefix';
import * as history from './WholePlayPhysicalHistoryFromPrefix';
import * as core from '../../core/sim/plateAppearance/CanonicalWholePlayHistory';
import * as acquisition from '../../core/sim/ball/BattedWorldPiecewiseFieldAcquisition';
import { acquiredHistory } from '../../core/sim/plateAppearance/CanonicalWholePlayHistory.test-support';
import { ownedPhysicalPlanEncodingFixture } from './OwnedPhysicalPlanEncodingFixtures.test-support';
import { ownedScheduledMotionArchiveHash, ownedScheduledWholeHistoryArchiveEncoding } from './OwnedScheduledMotionArchive';
import { actorFreeze, actorHash, actorJson } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';

/** Real Core steps in the existing small pure envelope, with the matching original
 * timeline restored. These are projection inputs, never Native admission evidence. */
const prefixFixture = (owned = true) => {
  const { prefix, count } = ownedPhysicalPlanEncodingFixture(3, 'mutable');
  const pitch = prefix.baseField.response.touch.worldContact.flight.physicalPitch;
  Object.assign(pitch, { source: { sourceId: 'pitch', gameId: 'game' },
    frame: { ...pitch.frame, gameId: 'game', match: { playId: 1 } },
    result: { pitch: { resolution: { timeline: acquiredHistory().originalTimeline } } } });
  const reference = (value: DurableBattedWorldFieldExecution) => ({ sourceId: value.source.sourceId,
    sourceHash: actorHash(value.source), snapshotHash: ownedScheduledMotionArchiveHash(value) });
  // Archive references include the original pitch, so rebuild them in source order.
  for (let index = 1; index < prefix.executions.length; index++) {
    const execution = prefix.executions[index].execution;
    if (execution.kind !== 'owned_motion_v2' || !execution.operation) throw new Error('owned fixture');
    Object.assign(execution.operation, { planReference: reference(prefix.executions[0]),
      previousSteps: prefix.executions.slice(1, index).map(reference) });
  }
  return { prefix: actorFreeze({ ...prefix, executions: owned ? prefix.executions : [] }), count };
};

const pair = (input: Parameters<typeof history.wholePlayPhysicalHistoryFromPrefix>[0]) => {
  expect(history.battedWorldPhysicalPrefixAndWholePlayHistory).toBeTypeOf('function');
  return history.battedWorldPhysicalPrefixAndWholePlayHistory(input);
};

it.each([false, true])('pairs the same physical and whole-history bytes with one real projection (owned=%s)', owned => {
  const { prefix } = prefixFixture(owned), expectedPhysical = physical.battedWorldFieldPhysicalPrefix(prefix);
  const expectedHistory = history.wholePlayPhysicalHistoryFromPrefix(prefix);
  const expectedArchive = ownedScheduledWholeHistoryArchiveEncoding(expectedHistory, 'pitch', 'game');
  // Captured from unchanged 75ff32a production before the paired API existed.
  const originalHashes = owned ? {
    physical: '6c3bb2b653ff30498a7b16bc994ce25bf293c86c102f9033a7b8b287777c2c2e',
    history: 'c5befd957e9d1619202eaad0c1795f484baf8f3e3f75c2c06bb1bcf0cf0764f1',
    archive: '9310b430ae7264ee4e0ee5cfc5f0a5cb435dc1b54501bd78cbc1e57a03084ead',
  } : {
    physical: '42532ae98d09915a596dae03a89efb2bdc7d299ba5aa7f8c72419d8a731dd1cb',
    history: 'c0f8b69cd2d1d54635cae10de9651af161aabcf2f7b72fa2e304b1ef6d740f7e',
    archive: '7015cb00740cf97eda16a3bf0ed450f88cf6ec44c2bf77f006c9cf4bc6f84aa4',
  };
  const project = vi.spyOn(physical, 'battedWorldFieldPhysicalPrefix'), derive = vi.spyOn(core, 'deriveCanonicalWholePlayHistory');
  try {
    const actual = pair(prefix);
    expect(actorJson(actual.physical)).toBe(actorJson(expectedPhysical));
    expect(actorJson(actual.history)).toBe(actorJson(expectedHistory));
    expect(ownedScheduledWholeHistoryArchiveEncoding(actual.history, 'pitch', 'game')).toEqual(expectedArchive);
    expect({ physical: actorHash(actual.physical), history: actorHash(actual.history),
      archive: ownedScheduledWholeHistoryArchiveEncoding(actual.history, 'pitch', 'game').hash }).toEqual(originalHashes);
    expect(actual.history.originalTimeline).toEqual(prefix.baseField.response.touch.worldContact.flight.physicalPitch.result.pitch.resolution.timeline);
    expect(actual.history.end).toEqual({ kind: 'unestablished' });
    expect(project).toHaveBeenCalledTimes(1); expect(derive).toHaveBeenCalledTimes(1);
    expect(actual.physical).toBe(project.mock.results[0].value);
    expect(actual.history).toBe(derive.mock.results[0].value);
  } finally { project.mockRestore(); derive.mockRestore(); }
});

it('runs both physical and canonical Core validators again on each independent pair', () => {
  const { prefix, count } = prefixFixture();
  const progress = vi.spyOn(acquisition, 'validateBattedWorldPiecewiseFieldAcquisitionProgress');
  try {
    const first = pair(prefix), second = pair(prefix);
    expect(second).toEqual(first); expect(second.physical).not.toBe(first.physical); expect(second.history).not.toBe(first.history);
    // Each operation retains the physical validator and the canonical-history validator.
    expect(progress).toHaveBeenCalledTimes(count * 4);
  } finally { progress.mockRestore(); }
});

it('keeps partial, reordered, rebound and unknown prefixes at the existing rejection boundaries', () => {
  const { prefix } = prefixFixture();
  const unknown = structuredClone(prefix);
  Object.assign(unknown.executions.at(-1)!.execution, { kind: 'unknown_execution' });
  const unknownSource = structuredClone(unknown);
  Object.assign(unknownSource.executions.at(-1)!.source.action, { kind: 'unknown_execution' });
  const changed = structuredClone(prefix);
  Object.assign(changed.executions.at(-1)!.baseField.source, { sourceId: 'other-owner' });
  const malformed = structuredClone(prefix);
  const last = malformed.executions.at(-1)!.execution;
  if (last.kind !== 'owned_motion_v2' || last.operation?.kind !== 'acquisition') throw new Error('owned fixture');
  Object.assign(last.operation.progress.world.moment.ball.velocity, { x: 999 });
  const missing = { ...prefix, fields: [] }, reordered = { ...prefix, executions: [...prefix.executions].reverse() };
  const partial = { ...prefix, executions: prefix.executions.slice(1) };
  for (const value of [missing, partial, reordered, changed, unknown, unknownSource, malformed]) {
    let expected: unknown;
    try { history.wholePlayPhysicalHistoryFromPrefix(value); } catch (error) { expected = error; }
    expect(expected).toBeInstanceOf(Error);
    expect(() => pair(value)).toThrow((expected as Error).message);
  }
  expect(pair(prefix).history.end).toEqual({ kind: 'unestablished' });
});

it('rejects original timeline changes that pass physical projection and never reuses a prior successful history', () => {
  const { prefix } = prefixFixture(false), changed = structuredClone(prefix);
  pair(changed);
  Object.assign(changed.baseField.response.touch.worldContact.flight.physicalPitch.result.pitch.resolution.timeline,
    { status: { kind: 'complete' } });
  expect(() => physical.battedWorldFieldPhysicalPrefix(changed)).not.toThrow();
  expect(() => pair(changed)).toThrow(/original pitch timeline or bat contact/);
  expect(() => history.wholePlayPhysicalHistoryFromPrefix(changed)).toThrow(/original pitch timeline or bat contact/);
  expect(pair(prefix).history.end).toEqual({ kind: 'unestablished' });
});

it('accepts only the original prefix and keeps the projection-consuming builder private', () => {
  expect(history.battedWorldPhysicalPrefixAndWholePlayHistory).toBeTypeOf('function');
  expect(history.battedWorldPhysicalPrefixAndWholePlayHistory.length).toBe(1);
  expect(history.wholePlayPhysicalHistoryFromPrefix.length).toBe(1);
  expect(Object.keys(history).sort()).toEqual(['battedWorldPhysicalPrefixAndWholePlayHistory', 'wholePlayPhysicalHistoryFromPrefix']);
  if (false) {
    // @ts-expect-error A caller cannot provide a trusted projection or encoder.
    history.battedWorldPhysicalPrefixAndWholePlayHistory(null as never, () => ({}));
    // @ts-expect-error The legacy API still accepts only the original prefix.
    history.wholePlayPhysicalHistoryFromPrefix(null as never, {});
  }
});
