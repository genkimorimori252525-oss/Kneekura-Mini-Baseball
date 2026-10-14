import { expect, it } from 'vitest';
import * as subject from './SamePlateAppearanceOccupiedRunnerHold';
import type { BodyMaterializationReceipt } from './PlayerBodyCapabilityMaterialization';

const ref = (owner: string, sourceId: string) => ({ owner, sourceId, sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) });
const source = () => ({ sourceId: 'runner-hold', sourceVersion: 'explicit-fixture-v1', capability: 'same_pa_occupied_runner_hold_v1',
  enrollmentReference: ref('same_pa_enrollments', 'enrollment'), playerId: 'runner', personId: 'person',
  bodyReference: ref('world_player_body_materializations', 'runner-body'),
  runnerModelReference: ref('world_player_runner_decision_motion_models', 'runner-model'),
  intent: { kind: 'hold', issuedTick: 100 }, coverageThroughTick: 500,
  provenance: { sourceRecordId: 'independently-issued-hold', sourceVersion: 'fixture-only-v1' } });
const body: BodyMaterializationReceipt['actor'] = { playerId: 'runner', personId: 'person', heightMeters: 1.8, bodyOriginHeightMeters: 0.8,
  primitives: (['body', 'glove', 'tag_hand', 'left_foot', 'right_foot'] as const).map((role, i) => ({ role,
    radius: 0.1, offset: { x: i / 10, y: i === 3 || i === 4 ? -0.7 : 0, z: 0 } })) };
const setup = { playerId: 'runner', personId: 'person', tick: 100, position: { x: 27, z: 0 }, velocity: { x: 0, z: 0 } };

it('OH01 requires a separately issued finite hold and composes all five original parts at the owned base', () => {
  expect(subject.samePaOccupiedRunnerHoldInput, 'missing occupied runner hold Source owner').toBeTypeOf('function');
  const accepted = subject.samePaOccupiedRunnerHoldInput(source());
  const actors = subject.samePaOccupiedRunnerHoldCurves(accepted, setup, body, 1_000_000);
  expect(actors).toHaveLength(5);
  expect(actors.map(a => a.primitive.role)).toEqual(body.primitives.map(p => p.role));
  for (const [index, actor] of actors.entries()) {
    const p = actor.primitive, shape = body.primitives[index];
    expect(actor.playerId).toBe('runner'); expect(p.startTick).toBe(100); expect(p.endTick).toBe(500);
    expect(p.startCenter).toEqual({ x: setup.position.x + shape.offset.x, y: 0.8 + shape.offset.y, z: setup.position.z });
    expect(p.startVelocity).toEqual({ x: 0, y: 0, z: 0 }); expect(p.acceleration).toEqual({ x: 0, y: 0, z: 0 });
  }
});
it.each(['no_intent', 'advance', 'expired', 'backdated', 'route', 'foreign_player', 'foreign_person', 'moving_setup'] as const)
('OH02 rejects %s rather than supplying missing execution inputs', fault => {
  expect(subject.samePaOccupiedRunnerHoldInput).toBeTypeOf('function');
  const raw: any = source(); let original = setup;
  if (fault === 'no_intent') delete raw.intent;
  if (fault === 'advance') raw.intent.kind = 'advance';
  if (fault === 'expired') raw.coverageThroughTick = 100;
  if (fault === 'backdated') raw.intent.issuedTick = 99;
  if (fault === 'route') raw.route = { segments: [] };
  if (fault === 'foreign_player') raw.playerId = 'another-runner';
  if (fault === 'foreign_person') raw.personId = 'another-person';
  if (fault === 'moving_setup') original = { ...setup, velocity: { x: 1, z: 0 } };
  expect(() => subject.samePaOccupiedRunnerHoldCurves(subject.samePaOccupiedRunnerHoldInput(raw), original,
    body, 1_000_000)).toThrow();
});
