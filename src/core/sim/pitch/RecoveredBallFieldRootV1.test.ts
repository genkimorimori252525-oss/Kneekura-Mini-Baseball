import { expect, it } from 'vitest';
import { controlledBatBodyPitchFixture } from './ControlledBatBodyPitchWorldFixtures.test-support';
import { prepareRecoveredBallFieldRootV1, type RecoveredBallFieldRootInputV1 } from './RecoveredBallFieldRootV1';
import { createSourceBallWorldMotionSessionV1 } from '../ball/SourceBallWorldMotionV1';
import type { BattedActorResponseProfile } from '../ball/BattedBallContactResponse';
const fixture = (): RecoveredBallFieldRootInputV1 => {
  const w = controlledBatBodyPitchFixture();
  const actors = [...w.pitch.otherActors, { playerId: w.pitch.pitcherPlayerId, primitive: { ...w.pitch.otherActors[0].primitive, role: 'tag_hand' as const } }];
  return { version: 'recovered_ball_field_root_v1', recovery: { version: 'post_impact_bat_body_world_v1',
    control: { version: 'post_impact_bat_body_control_v1', world: w, recoveryEndTick: 1200000,
      maximumSweetSpotSpeedMps: 20, maximumBodySpeedMps: 5 }, throughTick: 1200000 }, holdThroughTick: 1300000,
    equipmentId: 'original-bat', actorProfiles: actors.map(a => ({ playerId: a.playerId, profile: a.primitive.role === 'glove'
      ? { role: 'glove' as const, pocketCenterOffset: { x: 0, y: 0, z: 0 }, bodyStability: 1,
        parameters: { ticksPerSecond: 1e6, ballMassKg: .145, ballRadiusMeters: .0366, pocketRadiusMeters: .1,
          centerRetentionCapacityJ: 20, captureDissipationPowerW: 1000, failedContactRestitution: .1, failedTangentialDamping: .3, failedSpinDamping: .1 } }
      : { role: a.primitive.role, material: { restitution: .3, tangentialDamping: .2, spinDamping: .1 } } as BattedActorResponseProfile })),
    surfaces: [], surfaceProfiles: [], baseGeometry: null };
};
it('reconstructs a clear completed recovery with the same outgoing Source and all original colliders plus pitcher hand and held bat', () => {
  const input = fixture(), before = JSON.stringify(input), prepared = prepareRecoveredBallFieldRootV1(input);
  expect(prepared.nativeAdmission).toBe(false); expect(prepared.motionIssued).toBe(false);
  expect(prepared.requiresNewCumulativeWorkloadAssessment).toBe(true);
  expect(prepared.root.response.world.actors.length).toBe(input.recovery.control.world.pitch.otherActors.length + 1);
  expect(prepared.root.cursor.moment).toEqual(prepared.recovered.moment);
  expect(prepared.root.cursor.sourceCurve!.initial).toEqual(prepared.recovered.descriptor.initial);
  expect(prepared.root.cursor.sourceCurve!.initial.elapsedSeconds).not.toBe(0);
  expect(prepared.state.orientation).toEqual(prepared.recovered.orientation);
  const palm = prepared.root.response.world.actors.find(a => a.playerId === 'b' && a.primitive.role === 'tag_hand')!;
  expect(palm.primitive.startCenter).toEqual(prepared.recovered.actorsAtMoment.hand.position);
  expect(prepared.root.heldBats[0].bat.pose.grip).toEqual(prepared.recovered.actorsAtMoment.bat.state.pose.grip);
  const result = createSourceBallWorldMotionSessionV1(prepared.root).advance(input.holdThroughTick);
  expect(result.kind).toBe('world'); expect(JSON.stringify(input)).toBe(before);
});
it('rejects early/blocked recovery, incomplete response coverage and an invented endpoint', () => {
  const p = fixture();
  expect(() => prepareRecoveredBallFieldRootV1({ ...p, recovery: { ...p.recovery, throughTick: p.recovery.throughTick - 1 } })).toThrow(/unfinished/);
  expect(() => prepareRecoveredBallFieldRootV1({ ...p, actorProfiles: p.actorProfiles.slice(1) })).toThrow(/incomplete/);
  expect(() => prepareRecoveredBallFieldRootV1({ ...p, moment: {} } as never)).toThrow(/invalid input/);
  expect(() => prepareRecoveredBallFieldRootV1({ ...p, holdThroughTick: p.recovery.throughTick })).toThrow(/finite successor/);
});
