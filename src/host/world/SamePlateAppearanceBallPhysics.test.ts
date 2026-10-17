import { expect, it } from 'vitest';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from '../../core/sim/ball/BallFlight';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaPhysicalEpisodeSourceInput } from './SamePlateAppearancePhysicalEpisode';
import { samePaFieldBallPhysics, assertSamePaFieldBallPhysicsStep, SAME_PA_AERO_GROUND_FIELD_ROOT_SOURCE_VERSION as ROOT, SAME_PA_AERO_GROUND_FIELD_STEP_SOURCE_VERSION as STEP,
  SAME_PA_AERO_GROUND_ESCAPE_FIELD_ROOT_SOURCE_VERSION as ROOT_V3, SAME_PA_AERO_GROUND_ESCAPE_FIELD_STEP_SOURCE_VERSION as STEP_V3 } from './SamePlateAppearanceBallPhysics';

const ref = (owner: string) => ({ owner, sourceId: owner, sourceHash: hash(owner), snapshotHash: hash('snapshot:'+owner) });
const ballPhysics = () => ({ kind: 'aero_ground_v1' as const,
  air: { ticksPerSecond: 1_000_000, integrationStepTicks: 2_000, gravityY: -9.81, aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS },
  ground: { ticksPerSecond: 1_000_000, gravityMps2: 9.81, radiusM: 0.0366, inertiaRatio: 0.378, restingVerticalSpeedMps: 0.15,
    material: { restitution: 0.4, slidingFriction: 0.25, rollingDecelerationMps2: 1, normalSpinDecayPerSecond: 0.5 } } });
const root = () => ({ sourceId: 'root', sourceVersion: ROOT, capability: 'same_pa_physical_field_root_v1', viewReference: ref('pa_lifecycle_v1_execution_views'),
  launchReference: ref('pa_physical_v1_launches'), previousOperationReference: ref('pa_physical_v1_resolutions'), resolutionReference: ref('pa_physical_v1_resolutions'),
  postureReference: ref('batting_observation_v1_postures'), fieldInputs: { kind: 'fresh_physical_field_calibration_v1', calibrationReference: ref('pa_physical_v1_field_calibrations') },
  parameters: { ...DEFAULT_BALL_FLIGHT_PARAMETERS, groundRollingDecelerationMps2: 4, integrationStepTicks: 2_000 }, throughTick: 1,
  commands: Array.from({ length: 10 }, (_, i) => ({ playerId: 'player'+i })), ballPhysics: ballPhysics() });

it('selects the exact new root version with an explicit complete profile and preserves opaque legacy Source bytes', () => {
  const x = root(), parsed = samePaPhysicalEpisodeSourceInput(x);
  expect(parsed).toEqual(x); expect(Object.isFrozen(parsed)).toBe(true);
  const { ballPhysics: _, ...legacy } = x; legacy.sourceVersion = 'historical-fixture-v1';
  expect(JSON.stringify(samePaPhysicalEpisodeSourceInput(legacy))).toBe(JSON.stringify(legacy));
  expect(samePaFieldBallPhysics(legacy)).toBeUndefined();
  for (const changed of [{ ...x, sourceVersion: 'historical-fixture-v1' }, { ...x, ballPhysics: undefined }, { ...legacy, sourceVersion: ROOT },
    { ...x, ballPhysics: { ...x.ballPhysics, ground: { ...x.ballPhysics.ground, radiusM: 0.04 } } },
    { ...x, ballPhysics: { ...x.ballPhysics, air: { ...x.ballPhysics.air, integrationStepTicks: 1_000 } } },
    { ...x, ballPhysics: { ...x.ballPhysics, inferred: true } }]) expect(() => samePaPhysicalEpisodeSourceInput(changed)).toThrow();
});
it('retains the selected physics version across the original root and each predecessor and rejects unconnected actions', () => {
  const r = root();
  expect(() => assertSamePaFieldBallPhysicsStep({ sourceVersion: STEP }, r, r, true)).not.toThrow();
  expect(() => assertSamePaFieldBallPhysicsStep({ sourceVersion: STEP }, r, { sourceVersion: STEP }, false)).not.toThrow();
  for (const source of [{ sourceVersion: 'fixture-v1' }, { sourceVersion: ROOT }, { sourceVersion: STEP, action: { kind: 'capture_checkpoint_v1' } },
    { sourceVersion: STEP, action: { kind: 'defender_observation_v1' } }]) expect(() => assertSamePaFieldBallPhysicsStep(source, r, r, true)).toThrow();
  expect(() => assertSamePaFieldBallPhysicsStep({ sourceVersion: STEP }, r, { sourceVersion: 'fixture-v1' }, false)).toThrow();
  const { ballPhysics: _, ...legacy } = r; legacy.sourceVersion = 'legacy-v1';
  expect(() => assertSamePaFieldBallPhysicsStep({ sourceVersion: STEP }, legacy, legacy, true)).toThrow();
});
it('admits the separate explicit v3 Source shape while forbidding a solver switch in either direction', () => {
  const original=root(),v3={...original,sourceVersion:ROOT_V3};
  expect(samePaPhysicalEpisodeSourceInput(v3)).toEqual(v3);
  expect(()=>assertSamePaFieldBallPhysicsStep({sourceVersion:STEP_V3},v3,v3,true)).not.toThrow();
  expect(()=>assertSamePaFieldBallPhysicsStep({sourceVersion:STEP},v3,v3,true)).toThrow('original version');
  expect(()=>assertSamePaFieldBallPhysicsStep({sourceVersion:STEP_V3},original,original,true)).toThrow('original version');
  const {ballPhysics:_,...missing}=v3;expect(()=>samePaPhysicalEpisodeSourceInput(missing)).toThrow();
});
it('admits only the five nonphysical defensive metadata kinds for v3, leaving v2 and physical actions closed', () => {
  const original=root(),v3={...original,sourceVersion:ROOT_V3};
  for(const kind of ['defender_observation_v1','defender_decision_v1','defender_candidate_set_v1','defender_team_selection_v1','defender_actor_selection_v1']){
    expect(()=>assertSamePaFieldBallPhysicsStep({sourceVersion:STEP_V3,action:{kind}},v3,v3,true)).not.toThrow();
    expect(()=>assertSamePaFieldBallPhysicsStep({sourceVersion:STEP,action:{kind}},original,original,true)).toThrow('free checkpoints only');
  }
  for(const kind of ['defender_motion_v1','capture_checkpoint_v1','throw_plan_v1','throw_checkpoint_v1','batter_run_motion_v1',
    'occupied_runner_motion_v1','retained_quantizer_checkpoint_v1','appeal_indication_v1','unknown'])
    expect(()=>assertSamePaFieldBallPhysicsStep({sourceVersion:STEP_V3,action:{kind}},v3,v3,true)).toThrow('free checkpoints only');
});
