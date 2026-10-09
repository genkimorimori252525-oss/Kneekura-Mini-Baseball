import { expect, it } from 'vitest';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaTakeSuccessorSourceInput } from './SamePlateAppearanceTakeSuccessor';
const ref = (owner: string, id = owner) => ({ owner, sourceId: id, sourceHash: hash(id), snapshotHash: hash('result:' + id) });
/** Existing ContinuousPitchFixtures nominal values; parser-only identities do
 * not claim a physical cut, ready body, Native Source or calibration proof. */
const action = () => ({ sourceId: 'next-action', sourceVersion: 'fixture-only-v1', capability: 'same_pa_next_take_action_v1',
  viewReference: ref('pa_continuation_v1_execution_views'), previousPitchReference: ref('pa_dispatch_v1_pitch_actions'),
  timingReference: ref('world_pitch_timing_baselines'), releaseReference: ref('world_player_release_baselines'),
  pitchResponseReference: ref('world_pitch_fatigue_policies'), batterModelReference: ref('world_player_batting_models'),
  nominalPitch: { delivery: { matchSeed: 19, moundReference: { x: 0, y: 0, z: 18 }, outingId: 'outing-1', readyAtUs: 0,
    timingIntent: { deliveryMode: 'NORMAL', cadenceIntent: 'STANDARD' }, physics: { velocity: { x: 0, y: 0, z: -30 }, spin: { x: 0, y: 100, z: 0 } } },
    flight: { durationUs: 1_500_000, acceleration: { x: 0, y: 0, z: 0 } },
    batter: { action: { kind: 'take' }, plateZ: 0, strikeZone: { centerX: 0, halfWidth: 0.2, lowerY: 1.4, upperY: 1.8 }, ballRadiusMeters: 0.0366 } } });
it('NT01 next TAKE action pins current owners and accepts no supplied timeline World cut or posture proof', () => {
  const s = action(); expect(samePaTakeSuccessorSourceInput(s)).toEqual(s);
  for (const extra of [{ world: {} }, { bodyCut: {} }, { timeline: {} }, { cachedPosture: {} }, { stage: 'owned_append' }]) {
    expect(() => samePaTakeSuccessorSourceInput({ ...s, ...extra })).toThrow();
  }
  expect(() => samePaTakeSuccessorSourceInput({ ...s, viewReference: ref('reserved_pa_execution_views') })).toThrow();
  expect(() => samePaTakeSuccessorSourceInput({ ...s, previousPitchReference: ref('physical_pitch_progress_actions') })).toThrow();
  const swing = structuredClone(s); swing.nominalPitch.batter.action.kind = 'swing'; expect(() => samePaTakeSuccessorSourceInput(swing)).toThrow();
});
it('NT02 retained setup requires ten distinct participants and exactly32 independently pinned response rows', () => {
  const participants = Array.from({ length: 10 }, (_, i) => {
    const playerId = 'player-' + i, routes = i === 0 ? ['batter_observation', 'batter_decision', 'batter_motor', 'batter_swing']
      : i === 1 ? ['pitch_delivery', 'defender_observation', 'defender_decision', 'defender_locomotion'] : ['defender_observation', 'defender_decision', 'defender_locomotion'];
    return { member: { playerId, bindingHash: hash('binding:' + i), personHash: hash('person:' + i), baselineSourceId: 'baseline:' + i,
      reservedRevision: 0, reservedStateHash: hash('reserved:' + i), projectedStateHash: hash('projected:' + i) },
      calibrationReferences: routes.map(route => ({ route, calibrationReference: ref('pa_continuation_v1_execution_calibrations', playerId + ':' + route) })) };
  });
  const s = { sourceId: 'setup', sourceVersion: 'fixture-only-v1', capability: 'same_pa_retained_take_setup_v1', actionReference: ref('pa_take_successor_v1_action_plans'),
    postureReference: ref('batting_observation_v1_postures'), nextPhysicalPitchSourceId: 'next-pitch', participantInputs: participants };
  expect(samePaTakeSuccessorSourceInput(s)).toEqual(s);
  expect(() => samePaTakeSuccessorSourceInput({ ...s, participantInputs: participants.slice(1) })).toThrow();
  const missing = structuredClone(s); missing.participantInputs[0].calibrationReferences.pop(); expect(() => samePaTakeSuccessorSourceInput(missing)).toThrow();
  const duplicate = structuredClone(s); duplicate.participantInputs[0].calibrationReferences.push(duplicate.participantInputs[0].calibrationReferences[0]); expect(() => samePaTakeSuccessorSourceInput(duplicate)).toThrow();
  expect(() => samePaTakeSuccessorSourceInput({ ...s, physicalReady: true })).toThrow();
});
