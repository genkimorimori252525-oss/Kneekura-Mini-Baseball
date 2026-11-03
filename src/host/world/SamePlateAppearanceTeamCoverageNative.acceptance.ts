import { appendFileSync, copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { REFERENCE_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';
import { samePaPhysicalLifecycleFixture } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import { dispatchCalibrationValues } from './SamePlateAppearanceDispatchCalibration.test-support';
import { prepareInFlightBattingSwing } from './InFlightBattingLifecycleFixture.test-support';
import { prepareFreshPhysicalFieldFixture } from './SamePlateAppearancePhysicalFieldFixture.test-support';
import { appendNativeSelectedTeamCoverage } from './SamePlateAppearanceTeamCoverageNative.test-support';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** Bounded selected-only nine-owner fixture. No mock Source/model/database reads,
 * synthetic future position candidates, or official-result authority. It does
 * not prove the missing full-candidate tactical selection/scoring integration. */
it('TN01 nine original perception/decision Sources execute one owned grouped motor and independently reopen', () => {
  const evidence = process.env.BASEBALL_TEAM_DISPATCH_EVIDENCE;
  if (evidence) {
    mkdirSync(evidence, { recursive: true });
    // Retain the actual original Native database from its first creation;
    // an evidence directory alone does not change the fixture's memory URI.
    process.env.BASEBALL_NATIVE_DATABASE_DIRECTORY ??= evidence;
  }
  const stage = (name: string) => { if (evidence) appendFileSync(join(evidence, 'stages.jsonl'), JSON.stringify({ name, at: Date.now() }) + '\n'); };
  const declared = dispatchCalibrationValues(), observation = declared.defender_observation;
  stage('fixture-start');
  const h = samePaPhysicalLifecycleFixture({ profile: { ruleProfileId: NPB_2026_RULE_PROFILE.id },
    explicitBatterObservation: { ...declared.batter_observation, calibration: { ...declared.batter_observation.calibration,
      errorParameters: { ...declared.batter_observation.calibration.errorParameters, minimumPositionErrorMeters: 0, maximumPositionErrorMeters: 0,
        minimumVelocityErrorMps: 0, maximumVelocityErrorMps: 0 } } },
    explicitDefenderObservation: { ...observation, memoryDecayParameters: { ...observation.memoryDecayParameters, ticksPerSecond: 1_000_000 },
      errorParameters: { ...observation.errorParameters, minimumDetectionQuality: 0, minimumPositionErrorMeters: 0, maximumPositionErrorMeters: 0,
        minimumVelocityErrorMps: 0, maximumVelocityErrorMps: 0 } },
    explicitDefenderLocomotion: { ...declared.defender_locomotion, maxIntegrationStepTicks: 500_000 },
    originalBaseCenters: { first: { x: 19.09, z: 19.09 }, second: { x: 0, z: 38.18 }, third: { x: -19.09, z: 19.09 } } });
  let completed = false;
  try {
    stage('fixture-ready');
    const before = h.current(), readyAtUs = Math.max(before.view.cut.evaluationTick, before.view.cut.bodyCut.completedAtTick);
    const prepared = h.prepareAction('team-native:pitch3', 'observer_decision', { ...h.original.nominalPitch,
      delivery: { ...h.original.nominalPitch.delivery, readyAtUs, physics: { velocity: { x: 0, y: 3.5, z: -40 }, spin: { x: 0, y: 0, z: 0 } } } },
      { ticksPerSecond: 1_000_000, integrationStepTicks: 2_000, gravityY: -9.81, aerodynamics: REFERENCE_BASEBALL_AERODYNAMICS });
    const fields: ReturnType<typeof prepareFreshPhysicalFieldFixture>[] = [];
    const swing = prepareInFlightBattingSwing(h, prepared, 'team-native:pitch3', owned => {
      fields.push(prepareFreshPhysicalFieldFixture(h, prepared, owned.posture, owned.postureReference, 'team-native:field'));
    });
    stage('swing-ready');
    const field = fields[0].appendField(swing.resolution, swing.resolutionReference);
    stage('field-ready');
    const moment = field.step.field.motion.world.moment, ball = field.step.field.motion.cursor?.moment.ball;
    if (!ball) throw new Error('team fixture actual field cursor unavailable');
    const players = h.f.actor.defenderBindings.map(b => {
      const body = field.step.field.motion.actors.find(a => a.playerId === b.playerId && a.primitive.role === 'body')!;
      const dt = (moment.originTick - body.primitive.startTick) / 1_000_000 + moment.elapsedSeconds - (body.startElapsedSeconds ?? 0);
      const p = body.primitive;
      const x = p.startCenter.x + p.startVelocity.x * dt + 0.5 * p.acceleration.x * dt * dt;
      const z = p.startCenter.z + p.startVelocity.z * dt + 0.5 * p.acceleration.z * dt * dt;
      return { playerId: b.playerId, distance: Math.hypot(x - ball.position.x, z - ball.position.z) };
    }).sort((a, b) => a.distance - b.distance || a.playerId.localeCompare(b.playerId));
    const team = appendNativeSelectedTeamCoverage(h, field, 'team-native:dispatch', players.map((p, i) => ({ playerId: p.playerId,
      priorities: { ballPursuitPriority: i === 0 ? 1 : 0, baseCoverPriorities: [], relayPriority: i === 1 ? 1 : 0,
        backupPriority: i === 2 ? 1 : 0, deepCoveragePriority: i === 3 ? 1 : 0, holdPriority: i >= 4 ? 1 : 0 },
      ...(i > 0 && i < 4 ? { supportGeometry: { kind: 'perceived_ball_support_geometry_v1' as const, base: 1 as const } } : {}) })));
    stage('nine-owner-motion-ready');
    expect(team.preparation).toMatchObject({ teamPlanAdopted: false, bodiesMoved: false, officialResult: null });
    expect(team.receipt).toMatchObject({ status: 'original_owner_executed', selectionScope: 'accepted_individual_selected_only',
      teamPlanAdopted: true, bodiesMoved: true, physicalOutsConfirmed: null, officialResult: null });
    expect(team.receipt.actors).toHaveLength(9);
    expect(team.proof.record.kind).toBe('same_pa_physical_field_step_v1');
    if (team.proof.record.kind !== 'same_pa_physical_field_step_v1') throw new Error('team owned field missing');
    expect(team.proof.record.field.motion.actors).toHaveLength(50);
    expect(new Set(team.receipt.actors.map(a => a.intent.kind))).toEqual(new Set(['ball_handler', 'relay', 'backup', 'deep_coverage', 'hold']));
    for (const a of team.receipt.actors.filter(a => a.intent.kind !== 'hold')) expect(a.displacementMeters).toBeGreaterThan(0);
    expect(team.replay).toEqual(team.receipt);
    if (evidence) writeFileSync(join(evidence, 'receipt.json'), JSON.stringify({ ...team.receipt,
      ownedRecordHash: hash(team.proof.record), independentlyReopened: true,
      baseCoverIntegration: 'not_exercised_requires_visible_original_handler_commitment', fullCandidateTacticalIntegration: false }, null, 2));
    completed = true;
    stage('independent-reopen-proved');
  } finally {
    const path = h.f.path;
    h.f.close();
    if (evidence && !path.startsWith('file:')) copyFileSync(path, join(evidence, completed ? 'nine-dispatch.sqlite' : 'incomplete-prefix.sqlite'));
  }
}, 600_000);
