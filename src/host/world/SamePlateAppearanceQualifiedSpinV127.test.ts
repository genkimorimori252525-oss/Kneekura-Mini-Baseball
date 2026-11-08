import { appendFileSync } from 'node:fs';
import { setImmediate as yieldNativeTestTurn } from 'node:timers/promises';
import { expect, it } from 'vitest';
import { REFERENCE_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samePaPhysicalLifecycleFixture } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import { prepareInFlightBattingSwing } from './InFlightBattingLifecycleFixture.test-support';
import { prepareActorSpinPracticeV127 } from './ActorSpinPracticeV127.test-support';
import { dispatchCalibrationValues } from './SamePlateAppearanceDispatchCalibration.test-support';
import { openSqliteSamePlateAppearancePhysicalEpisodeStore } from './SqliteSamePlateAppearancePhysicalEpisodeStore';
import { startNativeActorCpuV127 } from './NativeActorCpuV127.test-support';
import type { SamePaPhysicalCommitmentSource } from './SamePlateAppearancePhysicalEpisode';

// Match SPN03's explicit functional budget; the default performance observation
// and prior timeouts stay at 180s. This option never changes a Source or clock.
const functionalBudgetMs = process.env.BASEBALL_NATIVE_FUNCTIONAL_BUDGET_MS === undefined ? 180_000
  : Number(process.env.BASEBALL_NATIVE_FUNCTIONAL_BUDGET_MS);
if (!Number.isSafeInteger(functionalBudgetMs) || functionalBudgetMs < 180_000 || functionalBudgetMs > 1_200_000)
  throw new Error('invalid Native qualified spin functional test budget');

/** Genuine practice and match share Actor, original model and database. The
 * calibration remains explicitly synthetic; this is no human mastery claim. */
it('SP127 qualified same-Actor practice is adopted by the real in-flight commitment and survives offline contact replay', async () => {
  console.info('SP127_TEST_BUDGET', JSON.stringify({ milliseconds: functionalBudgetMs,
    purpose: functionalBudgetMs === 180_000 ? 'NORMAL_OBSERVATION' : 'FUNCTIONAL_COMPLETION_NOT_PERFORMANCE_PASS' }));
  await yieldNativeTestTurn();
  let practice: ReturnType<typeof prepareActorSpinPracticeV127> | undefined, stopDiagnostic = () => {};
  const stage = (name: string) => {
    const diagnostic = startNativeActorCpuV127(name); if (diagnostic) stopDiagnostic = diagnostic;
    if (process.env.BASEBALL_GATE_ERRORS) appendFileSync(process.env.BASEBALL_GATE_ERRORS + '.SP127-stages.jsonl', JSON.stringify({ name, at: Date.now() }) + '\n');
  };
  stage('fixture-start');
  const sensor = dispatchCalibrationValues().batter_observation;
  const h = samePaPhysicalLifecycleFixture({ modelDay: 1, onFixtureStage: stage,
    explicitBatterObservation: { ...sensor, calibration: { ...sensor.calibration,
      errorParameters: { ...sensor.calibration.errorParameters, minimumPositionErrorMeters: 0, maximumPositionErrorMeters: 0,
        minimumVelocityErrorMps: 0, maximumVelocityErrorMps: 0 } } },
    prepareBeforeEnrollment(context) { practice = prepareActorSpinPracticeV127(context, stage); stage('actor-qualification-ready'); },
  }), { f } = h;
  try {
    stage('fixture-ready');
    await yieldNativeTestTurn();
    if (!practice) throw Error('same Actor practice was not prepared');
    const qualified = practice;
    expect(qualified.qualification.source).toMatchObject({ careerId: f.actor.binding.careerId, playerId: f.actor.binding.playerId,
      personLinkSourceId: f.actor.person.sourceId, acceptedAtDay: 9, technique: 'BACKSPIN' });
    expect(qualified.qualification.person.personId).toBe(f.actor.binding.personId);
    expect(qualified.qualification.source.repertoireRef).toEqual(f.source.repertoireRef);
    expect(f.actor.binding.gameDay).toBe(10);
    const current = h.current(), readyAtUs = Math.max(current.view.cut.evaluationTick, current.view.cut.bodyCut.completedAtTick);
    const action = h.prepareAction('qualified-spin:pitch3', 'observer_decision', { ...h.original.nominalPitch,
      delivery: { ...h.original.nominalPitch.delivery, readyAtUs, physics: { velocity: { x: 0, y: 3.5, z: -40 }, spin: { x: 0, y: 0, z: 0 } } } },
      { ticksPerSecond: 1_000_000, integrationStepTicks: 2_000, gravityY: -9.81, aerodynamics: REFERENCE_BASEBALL_AERODYNAMICS });
    stage('action-ready');
    await yieldNativeTestTurn();
    const s = prepareInFlightBattingSwing(h, action, 'qualified-spin:pitch3', undefined, { onStage: stage,
      prepareCommitment(source, input) {
        const { buntProfileBinding: _bunt, ...original } = source;
        const v123: SamePaPhysicalCommitmentSource = { ...original, capability: 'same_pa_physical_commitment_v123', spinBindingV123: {
          kind: 'fixed_native_spin_binding_v123', modelReference: action.action.source.batterModelReference,
          intent: { technique: 'BACKSPIN', selectedAtTick: input.nominalRequest.currentFrame.time.tick },
          qualificationReferences: [qualified.qualificationReference],
        } };
        return v123;
      } });
    stage('contact-ready');
    const calculation = s.commitment.calculation;
    expect(calculation.algorithm).toBe('batting-spin-execution-calculation-v123');
    if (calculation.algorithm !== 'batting-spin-execution-calculation-v123') throw Error('qualified Native calculation missing');
    expect(calculation.spinContext.techniques).toHaveLength(1);
    expect(calculation.spinMotorPlanV123).toMatchObject({ declaredIntent: 'BACKSPIN', selectedIntent: 'BACKSPIN', fallbackReason: null,
      selectedQualificationRef: { sourceId: qualified.qualification.source.sourceId, sourceVersion: qualified.qualification.source.sourceVersion } });
    expect(s.commitment.commitment?.profileId).toBe(qualified.qualification.motorProfileRefs[0].profileId);
    expect(s.commitment.commitment?.profileVersion).toBe(qualified.qualification.motorProfileRefs[0].version);
    expect(s.resolution.contact).not.toBeNull();
    expect(s.resolution.timeline.events.filter(event => event.kind === 'BatBallContact')).toHaveLength(1);
    expect(s.commitment.afterWorldRevision).toBe(s.preparedWorldRevision + 1);
    expect(f.db.prepare('SELECT count(*) n FROM pa_physical_v1_commitments').get()!.n).toBe(1);
    const beforeHead = f.db.prepare('SELECT * FROM pa_physical_v1_heads').all(), beforeWorld = h.worldOwner.readHead(f.actor.binding.careerId);
    const before = f.db.prepare('SELECT * FROM pa_physical_v1_commitments').all(), commitmentHash = hash(s.commitment), resolutionHash = hash(s.resolution);
    const offline = f.x.f.track(openSqliteSamePlateAppearancePhysicalEpisodeStore(f.path));
    expect(hash(offline.acceptOperation(s.commitment.source.sourceId))).toBe(commitmentHash);
    expect(hash(offline.readOperation(reference('pa_physical_v1_resolutions', s.resolution)).record)).toBe(resolutionHash);
    expect(f.db.prepare('SELECT * FROM pa_physical_v1_commitments').all()).toEqual(before);
    expect(f.db.prepare('SELECT * FROM pa_physical_v1_heads').all()).toEqual(beforeHead);
    expect(h.worldOwner.readHead(f.actor.binding.careerId)).toEqual(beforeWorld);
    stage('offline-contact-replay-ready');
  } finally { h.close(); stopDiagnostic(); }
}, functionalBudgetMs);
