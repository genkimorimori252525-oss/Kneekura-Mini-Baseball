import { expect, it, vi } from 'vitest';
import * as physical from './BattedWorldFieldPhysicalPrefix';
import * as archive from './OwnedScheduledMotionArchive';
import * as acquisition from '../../core/sim/ball/BattedWorldPiecewiseFieldAcquisition';
import { actorFreeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { ownedPhysicalPlanEncodingFixture } from './OwnedPhysicalPlanEncodingFixtures.test-support';

const create = physical.createBattedWorldFieldPhysicalReplay;

it('encodes each exact immutable snapshot once across growing physical prefixes and later references', () => {
  const x = ownedPhysicalPlanEncodingFixture(4), expected = physical.battedWorldFieldPhysicalPrefix(x.prefix);
  const calls = vi.spyOn(archive, 'ownedScheduledMotionArchiveEncoding'), hashes = vi.spyOn(archive, 'ownedScheduledMotionArchiveHash');
  try {
    const replay = create();
    for (let length = 1; length <= x.prefix.executions.length; length++) {
      replay.project({ ...x.prefix, executions: x.prefix.executions.slice(0, length) });
      // The owner compares this pair against freshly queried row bytes/hash.
      replay.snapshotIdentity(x.prefix.executions[length - 1]);
    }
    expect(replay.project(x.prefix)).toEqual(expected);
    for (const value of x.prefix.executions) expect(replay.reference(value).snapshotHash).toBe(replay.snapshotIdentity(value).hash);
    expect(calls.mock.calls.length + hashes.mock.calls.length).toBe(x.prefix.executions.length);
    expect(new Set(calls.mock.calls.map(([value]) => value)).size).toBe(x.prefix.executions.length);
    calls.mockClear(); hashes.mockClear();
    create().project(x.prefix);
    expect(calls).toHaveBeenCalledTimes(x.count);
  } finally { calls.mockRestore(); hashes.mockRestore(); }
});

it('retains every Core progress check after warming exact immutable archive references', () => {
  const x = ownedPhysicalPlanEncodingFixture(4), replay = create();
  x.prefix.executions.forEach(value => replay.snapshotIdentity(value));
  const calls = vi.spyOn(acquisition, 'validateBattedWorldPiecewiseFieldAcquisitionProgress');
  try {
    replay.project(x.prefix); replay.project(x.prefix);
    expect(calls).toHaveBeenCalledTimes(x.count * 2);
    const changed = structuredClone(x.prefix), last = changed.executions.at(-1)!;
    if (last.execution.kind !== 'owned_motion_v2' || last.execution.operation?.kind !== 'acquisition') throw new Error('fixture');
    (last.execution.operation.progress.world.moment.ball.velocity as { x: number }).x += 1;
    actorFreeze(changed); replay.snapshotIdentity(last);
    calls.mockClear();
    expect(() => replay.project(changed)).toThrow(/progress differs/);
    expect(calls).toHaveBeenCalledTimes(x.count);
    expect(calls.mock.calls.at(-1)![0].progress).toBe(last.execution.operation.progress);
  } finally { calls.mockRestore(); }
});

it('does not reuse archive identity for distinct equal, same-Source changed, mutable or shallow-frozen snapshots', () => {
  const x = ownedPhysicalPlanEncodingFixture(1), value = x.prefix.executions[0], replay = create();
  const first = replay.snapshotIdentity(value), equal = actorFreeze(structuredClone(value));
  expect(replay.snapshotIdentity(equal)).toEqual(first); expect(replay.snapshotIdentity(equal)).not.toBe(first);
  for (const shallow of [false, true]) {
    const changed = structuredClone(value);
    if (shallow) Object.freeze(changed);
    const before = replay.snapshotIdentity(changed);
    (changed.source as { sourceVersion: string }).sourceVersion += '-changed';
    expect(replay.snapshotIdentity(changed).hash).not.toBe(before.hash);
    actorFreeze(changed);
    expect(replay.snapshotIdentity(changed).hash).not.toBe(first.hash);
  }
});

import * as kinematics from './ActualPlayerKinematicsFromPrefix';
import * as composition from './OwnedScheduledMotionComposition';
import * as execution from './OwnedScheduledMotionExecution';

it('creates fresh role encoders through the parameterless factory chain without an evidence-injection signature', () => {
  const value = ownedPhysicalPlanEncodingFixture(1).prefix.executions[0];
  const factories = [physical.createBattedWorldFieldPhysicalReplay, kinematics.createActualPlayersKinematicsReplay,
    composition.createOwnedScheduledMotionCompositionReplay, execution.createOwnedScheduledMotionExecutionReplay];
  for (const factory of factories) {
    expect(factory.length).toBe(0);
    const first = factory(), second = factory(), identity = first.snapshotIdentity(value);
    expect(first.snapshotIdentity(value)).toBe(identity);
    expect(second.snapshotIdentity(value)).toEqual(identity); expect(second.snapshotIdentity(value)).not.toBe(identity);
  }
  expect(physical).not.toHaveProperty('projectPhysicalPrefix');
  expect(kinematics).not.toHaveProperty('deriveActualPlayerKinematicsFromPhysicalPrefix');
  expect(kinematics).not.toHaveProperty('derivePlayersWithProjection');
  expect(composition).not.toHaveProperty('deriveComposition');
  expect(execution).not.toHaveProperty('deriveExecution');
  // Compile-time regression checks are intentionally unreachable at runtime.
  if (false) {
    // @ts-expect-error A caller cannot provide an encoder to a factory.
    physical.createBattedWorldFieldPhysicalReplay(() => 'forged');
    // @ts-expect-error A caller cannot provide a physical projection to kinematics.
    kinematics.actualPlayersKinematicsFromPrefix([], null as never, () => ({}));
    // @ts-expect-error The public execution API keeps exactly its original arguments.
    execution.deriveOwnedScheduledMotionExecution(null as never, null as never, [], [], null, () => 'forged');
  }
});

it('rejects active snapshot envelopes before reading them and never retains error results', () => {
  const value = structuredClone(ownedPhysicalPlanEncodingFixture(1).prefix.executions[0]), source = value.source;
  const calls = vi.spyOn(archive, 'ownedScheduledMotionArchiveEncoding'), replay = create(); let getterCalls = 0;
  Object.defineProperty(value, 'source', { configurable: true, enumerable: true, get() { getterCalls++; return source; } });
  try {
    expect(() => replay.reference(value)).toThrow(/shape|inert/);
    expect(() => replay.reference(value)).toThrow(/shape|inert/);
    expect(getterCalls).toBe(0); expect(calls).toHaveBeenCalledTimes(2);
    Object.defineProperty(value, 'source', { enumerable: true, value: source }); actorFreeze(value);
    const first = replay.snapshotIdentity(value);
    expect(replay.snapshotIdentity(value)).toBe(first); expect(calls).toHaveBeenCalledTimes(3);
  } finally { calls.mockRestore(); }
});

import { ownedPhysicalThrowEncodingFixture } from './OwnedPhysicalPlanEncodingFixtures.test-support';
import * as throwing from '../../core/sim/ball/BattedWorldPiecewiseFieldThrow';

it('retains every throw Core progress check and rejects forged progress after warming archive identities', () => {
  const x = ownedPhysicalThrowEncodingFixture(), replay = create();
  x.prefix.executions.forEach(value => replay.snapshotIdentity(value));
  const calls = vi.spyOn(throwing, 'validateBattedWorldPiecewiseFieldThrowProgress');
  try {
    replay.project(x.prefix); replay.project(x.prefix);
    expect(calls).toHaveBeenCalledTimes(x.count * 2);
    const changed = structuredClone(x.prefix), last = changed.executions.at(-1)!;
    if (last.execution.kind !== 'owned_motion_v2' || last.execution.operation?.kind !== 'throw') throw new Error('fixture');
    (last.execution.operation.progress.field.motion.world.moment.ball.velocity as { x: number }).x += 1;
    actorFreeze(changed); replay.snapshotIdentity(last);
    calls.mockClear();
    expect(() => replay.project(changed)).toThrow(/progress differs/);
    expect(calls).toHaveBeenCalledTimes(x.count);
    expect(calls.mock.calls.at(-1)![0].progress).toBe(last.execution.operation.progress);
  } finally { calls.mockRestore(); }
});
