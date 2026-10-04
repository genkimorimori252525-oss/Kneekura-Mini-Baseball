import { expect, it } from 'vitest';
import * as scope from './ActualLivePlayScope';
import { quantizerFixture } from './OwnedScheduledQuantizerFixture.test-support';
import type { DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { actorHash, actorJson } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { ownedScheduledMotionArchiveHash } from './OwnedScheduledMotionArchive';

// Adapter-only identity checks; the prerequisite fixture substitutes only the
// kinematics owner. Core executes all motion. These are not Native admission proofs.
it('binds v2 Source, pitch, revision, composition, actual state and original ten Players', () => {
  const x = quantizerFixture(), checkpoint = { kind: 'motion' as const, throughTick: 102 };
  try {
    const source = x.source(checkpoint), execution = x.execute(checkpoint);
    const value = { source, revision: 1, history: [source], baseField: x.baseField, execution } as DurableBattedWorldFieldExecution;
    const ids = x.bindings.map(b => b.playerId), validate = scope.assertActualLiveScheduledIdentity;
    expect(validate, 'scheduled identity guard').toBeTypeOf('function');
    expect(() => validate(value, 'pitch', ids)).not.toThrow();
    const bad = (executionPatch: object) => ({ ...value, execution: { ...execution, ...executionPatch } }) as DurableBattedWorldFieldExecution;
    if (execution.kind !== 'owned_motion_v2') throw new Error('fixture motion');
    for (const adoption of [{ ...execution.adoption, executionSourceId: 'foreign' }, { ...execution.adoption, executionRevision: 2 },
      { ...execution.adoption, physicalPitchSourceId: 'foreign' }, { ...execution.adoption, compositionHash: 'foreign' },
      { ...execution.adoption, executedThrough: execution.adoption.adoptedAt }]) {
      expect(() => validate(bad({ adoption }), 'pitch', ids)).toThrow(/scheduled.*identity|scheduled.*state/);
    }
    expect(() => validate(value, 'foreign', ids)).toThrow();
    expect(() => validate(value, 'pitch', ids.slice(1))).toThrow();
    expect(() => validate(bad({ liveWork: { ...execution.liveWork, executionSourceId: 'foreign' } }), 'pitch', ids)).toThrow();
    expect(() => validate({ ...value, source: { ...source, action: { ...source.action, checkpoint: { kind: 'motion', throughTick: 104 } } } }, 'pitch', ids)).toThrow();
  } finally { x.restore(); }
});

it('uses the concrete physical archive identity while preserving legacy reference bytes', () => {
  const reference = scope.actualLivePhysicalExecutionReference;
  expect(reference, 'physical owner reference').toBeTypeOf('function');
  const source = { sourceId: 'legacy', sourceVersion: 'v1', baseFieldSourceId: 'field', previousExecutionSourceId: null, action: { kind: 'motion' } };
  const legacy = { source, history: [source], revision: 1, baseField: {}, execution: { kind: 'motion' } } as unknown as DurableBattedWorldFieldExecution;
  expect(actorJson(reference(legacy))).toBe(actorJson({ owner: 'batted_world_field_executions', sourceId: 'legacy', hash: actorHash(legacy) }));
  // Encoding is not domain validity: this inert record tests only Source-qualified hash routing.
  const scheduled = { ...legacy, source: { ...source, action: { kind: 'owned_acquisition_plan_v1' } },
    baseField: { source: { sourceId: 'field', sourceVersion: 'v1' }, response: { model: { gameId: 'game' }, touch: { worldContact: { flight: { source: { physicalPitchSourceId: 'pitch' } } } } } },
    execution: { kind: 'owned_acquisition_plan_v1' } } as unknown as DurableBattedWorldFieldExecution;
  Object.assign(scheduled, { history: [scheduled.source] });
  expect(reference(scheduled)).toEqual({ owner: 'batted_world_field_executions', sourceId: 'legacy', hash: ownedScheduledMotionArchiveHash(scheduled) });
});
