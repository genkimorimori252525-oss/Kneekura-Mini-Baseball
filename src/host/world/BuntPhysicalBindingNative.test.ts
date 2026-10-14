import { expect, it } from 'vitest';
import { REFERENCE_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samePaPhysicalLifecycleFixture } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import { prepareInFlightBattingSwing } from './InFlightBattingLifecycleFixture.test-support';
import { dispatchCalibrationValues } from './SamePlateAppearanceDispatchCalibration.test-support';
import { openSqliteSamePlateAppearancePhysicalEpisodeStore } from './SqliteSamePlateAppearancePhysicalEpisodeStore';
import type { SamePaBuntProfileBinding } from './SamePlateAppearanceBuntProfile';

/** One synthetic real-owner chain for the consolidated batch. The existing
 * explicit course is deliberately reused under separately accepted bunt intent,
 * as the original intent contract permits. This is not a production bunt pose,
 * a new calibration or a demonstration of short/low-speed bunt realism. */
it('BPN01 explicit current owned profile binds pre-launch bunt intent to real contact, atomic adoption and offline replay', () => {
  const declared = dispatchCalibrationValues(), sensor = declared.batter_observation;
  const explicitBatterObservation = { ...sensor, calibration: { ...sensor.calibration, errorParameters: { ...sensor.calibration.errorParameters,
    minimumPositionErrorMeters: 0, maximumPositionErrorMeters: 0, minimumVelocityErrorMps: 0, maximumVelocityErrorMps: 0 } } };
  const h = samePaPhysicalLifecycleFixture({ explicitBatterObservation }), { f } = h;
  try {
    const current = h.current(), readyAtUs = Math.max(current.view.cut.evaluationTick, current.view.cut.bodyCut.completedAtTick);
    const workloadHeads = f.db.prepare('SELECT * FROM world_player_workload_heads ORDER BY career_id,player_id').all();
    const action = h.prepareAction('bunt-binding:pitch3', 'observer_decision', { ...h.original.nominalPitch,
      delivery: { ...h.original.nominalPitch.delivery, readyAtUs, physics: { velocity: { x: 0, y: 3.5, z: -40 }, spin: { x: 0, y: 0, z: 0 } } } },
      { ticksPerSecond: 1_000_000, integrationStepTicks: 2_000, gravityY: -9.81, aerodynamics: REFERENCE_BASEBALL_AERODYNAMICS });
    const s = prepareInFlightBattingSwing(h, action, 'bunt-binding:pitch3', undefined, { attempt: 'bunt', prepareCommitment(source, input) {
      if (input.source.capability !== 'owned_in_flight_same_pa_batting_execution_input_v1') throw new Error('expected real in-flight input');
      const before = f.db.prepare('SELECT * FROM pa_physical_v1_heads').all();
      const world = h.worldOwner.readHead(f.actor.binding.careerId);
      const absent = h.save({ ...source, sourceId: 'bunt-binding:missing' });
      expect(h.physical.acceptOperation(absent.sourceId)).toMatchObject({ kind: 'pending', reason: 'owned_bunt_physical_profile_required' });
      expect(f.db.prepare('SELECT 1 FROM pa_physical_v1_commitments WHERE source_id=?').get(absent.sourceId)).toBeUndefined();
      const repertoire = declared.batter_swing, profile = repertoire.profiles[0].profile;
      expect(input.effectiveValues.repertoire).toEqual(repertoire);
      const buntProfileBinding: SamePaBuntProfileBinding = { kind: 'accepted_bunt_course_profile_v1', intentReference: source.intentReference,
        viewReference: source.viewReference, member: input.source.member, modelReference: h.original.batterModelReference,
        calibrationReference: input.source.calibrationReferences.find(c => c.route === 'batter_swing')!.calibrationReference,
        repertoireId: repertoire.repertoireId, repertoireVersion: repertoire.repertoireVersion,
        profileId: profile.profileId, profileVersion: profile.version, profileHash: hash(profile) };
      const wrong = h.save({ ...source, sourceId: 'bunt-binding:foreign-person',
        buntProfileBinding: { ...buntProfileBinding, member: { ...buntProfileBinding.member, personHash: hash('foreign-person') } } });
      expect(() => h.physical.acceptOperation(wrong.sourceId)).toThrow(/binding differs/);
      expect(f.db.prepare('SELECT 1 FROM pa_physical_v1_commitments WHERE source_id=?').get(wrong.sourceId)).toBeUndefined();
      expect(f.db.prepare('SELECT * FROM pa_physical_v1_heads').all()).toEqual(before);
      expect(h.worldOwner.readHead(f.actor.binding.careerId)).toEqual(world);
      return { ...source, buntProfileBinding };
    } });
    expect(s.intent.originalIntent.attempt).toBe('bunt');
    expect(s.beforeLaunch.intent).toEqual(s.intent);
    expect(s.commitment.originalIntent).toEqual(s.intent.originalIntent);
    expect(s.commitment.source.buntProfileBinding!.intentReference).toEqual(s.intentReference);
    expect(s.commitment.calculation.effectiveValues).toEqual(s.input.effectiveValues);
    expect(s.commitment.commitment.profileId).toBe('explicit-test-course');
    expect(s.commitment.commitment.action).toBe('SWING');
    expect(s.resolution.contact).not.toBeNull();
    expect(s.resolution.timeline.status.kind).toBe('batted_ball_pending');
    expect(s.resolution.timeline.events.filter(e => e.kind === 'BatBallContact')).toHaveLength(1);
    expect(s.commitment.afterWorldRevision).toBe(s.preparedWorldRevision + 1);
    expect(f.db.prepare('SELECT * FROM world_player_workload_heads ORDER BY career_id,player_id').all()).toEqual(workloadHeads);
    const archived = f.db.prepare('SELECT source_json,snapshot_json,source_hash,snapshot_hash FROM pa_physical_v1_commitments WHERE source_id=?').get(s.commitment.source.sourceId);
    const reopened = f.x.f.track(openSqliteSamePlateAppearancePhysicalEpisodeStore(f.path));
    expect(reopened.acceptOperation(s.commitment.source.sourceId)).toEqual(s.commitment);
    expect(reopened.readOperation(reference('pa_physical_v1_resolutions', s.resolution)).record).toEqual(s.resolution);
    expect(f.db.prepare('SELECT source_json,snapshot_json,source_hash,snapshot_hash FROM pa_physical_v1_commitments WHERE source_id=?').get(s.commitment.source.sourceId)).toEqual(archived);
  } finally { h.close(); }
}, 1_200_000);
