import { setImmediate as nextTurn } from 'node:timers/promises';
import { REFERENCE_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';
import { calculateBattingExecution } from '../../core/world/psychology/batting/BattingCommitment';
import { samePaPhysicalLifecycleFixture } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import { prepareActorSpinPracticeV127 } from './ActorSpinPracticeV127.test-support';
import { prepareInFlightBattingSwing } from './InFlightBattingLifecycleFixture.test-support';
import { dispatchCalibrationValues } from './SamePlateAppearanceDispatchCalibration.test-support';
import { openSqliteSpinControlMasteryV123 } from './SqliteSpinControlMasteryV123';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import type { SamePaPhysicalCommitmentSource } from './SamePlateAppearancePhysicalEpisode';

/** Same-Actor Native proof with synthetic practice/calibration. It ends at an
 * actual Rigid contact; no flight terminal, official closure, current World
 * epoch, natural Gold rarity or production human-skill calibration is claimed. */
export async function nativeSpinNeutralFixtureV193(stage: (name: string) => void = () => {}, checkpoint: (value: unknown) => void = () => {}) {
  const practices: ReturnType<typeof prepareActorSpinPracticeV127>[] = [];
  const sensor = dispatchCalibrationValues().batter_observation;
  stage('fixture-start'); await nextTurn();
  const h = samePaPhysicalLifecycleFixture({ modelDay: 1, fixtureGameDay: 40, onFixtureStage: stage,
    explicitBatterObservation: { ...sensor, calibration: { ...sensor.calibration, errorParameters: { ...sensor.calibration.errorParameters,
      minimumPositionErrorMeters: 0, maximumPositionErrorMeters: 0, minimumVelocityErrorMps: 0, maximumVelocityErrorMps: 0 } } },
    prepareBeforeEnrollment(context) {
      practices.push(prepareActorSpinPracticeV127(context, name => stage('back:' + name),
        { sourcePrefix: 'native-spin-neutral-v193:back:', technique: 'BACKSPIN', discoveryDay: 2 }));
      practices.push(prepareActorSpinPracticeV127(context, name => stage('top:' + name),
        { sourcePrefix: 'native-spin-neutral-v193:top:', technique: 'TOPSPIN', discoveryDay: 32 }));
      stage('two-independent-qualifications-ready');
    } });
  try {
    stage('lifecycle-ready'); await nextTurn();
    const masteries = h.f.x.f.track(openSqliteSpinControlMasteryV123(h.f.path));
    const inventory = masteries.selectAtDay(h.f.actor.binding.careerId, h.f.actor.binding.playerId, h.f.actor.binding.gameDay);
    if (inventory.effectiveStateId !== 'GOLD' || inventory.motorQualifications.length !== 2 || inventory.rejected.length) throw Error('Native V193 Gold inventory is unavailable');
    const current = h.current();
    checkpoint({ boundary: 'INERT_NATIVE_CONSUMER_LOCATORS_ONLY', stage: 'NATIVE_GOLD_READ', databasePath: h.f.path,
      actorReference: reference('physical_plate_appearance_actors', h.f.actor), actorSource: h.f.actor.source,
      modelReference: h.original.batterModelReference, modelSource: h.f.source,
      enrollmentReference: h.original.enrollmentReference, lifecycleViewReference: current.viewReference,
      originalActionDeclaration: h.original,
      qualificationReferences: practices.map(practice => practice.qualificationReference),
      qualificationSources: practices.map(practice => practice.qualification.source), inventory });
    stage('native-gold-read-ready');
    const readyAtUs = Math.max(current.view.cut.evaluationTick, current.view.cut.bodyCut.completedAtTick);
    const action = h.prepareAction('native-spin-neutral-v193:pitch3', 'observer_decision', { ...h.original.nominalPitch,
      delivery: { ...h.original.nominalPitch.delivery, readyAtUs, physics: { velocity: { x: 0, y: 3.5, z: -40 }, spin: { x: 0, y: 0, z: 0 } } } },
      { ticksPerSecond: 1_000_000, integrationStepTicks: 2_000, gravityY: -9.81, aerodynamics: REFERENCE_BASEBALL_AERODYNAMICS });
    stage('action-ready'); await nextTurn();
    const swing = prepareInFlightBattingSwing(h, action, 'native-spin-neutral-v193:pitch3', undefined, { onStage: stage,
      prepareCommitment(source, input) {
        const { buntProfileBinding: _buntProfileBinding, ...ordinary } = source;
        const qualified: SamePaPhysicalCommitmentSource = { ...ordinary, capability: 'same_pa_physical_commitment_v123', spinBindingV123: {
          kind: 'fixed_native_spin_binding_v123', modelReference: action.action.source.batterModelReference,
          intent: { technique: 'NO_SPIN_TARGET', selectedAtTick: input.nominalRequest.currentFrame.time.tick },
          qualificationReferences: practices.map(practice => practice.qualificationReference) } };
        checkpoint({ boundary: 'INERT_NATIVE_CONSUMER_LOCATORS_ONLY', stage: 'BEFORE_NATIVE_COMMITMENT', databasePath: h.f.path,
          sourceDeclaration: qualified, actorReference: reference('physical_plate_appearance_actors', h.f.actor),
          modelReference: action.action.source.batterModelReference,
          qualificationReferences: practices.map(practice => practice.qualificationReference),
          qualificationSources: practices.map(practice => practice.qualification.source), inventory });
        return qualified;
      } });
    stage('actual-contact-ready');
    const ordinary = calculateBattingExecution({ nominalRequest: swing.input.nominalRequest, effectiveValues: swing.input.effectiveValues });
    if (!ordinary.ok) throw Error('V193 ordinary execution calculation failed');
    return { h, practices, inventory, swing, ordinary: ordinary.value,
      fixtureAuthority: { kind: 'NATIVE_TWO_QUALIFICATION_NO_TARGET_CONTACT_V193', sameOriginalActorPersonRepertoire: true,
        practiceTechniques: ['BACKSPIN', 'TOPSPIN'], practiceEpisodeCount: 2, independentActualPracticeContacts: 6,
        qualificationAcceptedDays: [9, 39], matchGameDay: 40, practiceGravityY: 0, practiceAirDensityKgM3: 0,
        learningCooldownDays: 30, learningMinimumElapsedDays: 5, syntheticCalibrationOnly: true,
        productionMasteryCalibrationProven: false, naturalGoldRarityProven: false, normalAiProven: false,
        ordinaryComparator: 'PURE_EXISTING_V1_CALCULATION_FROM_IDENTICAL_OWNED_INPUT',
        secondNativeControlBranchProven: false, flightExercised: false, officialTerminalProven: false, wholeRngConsumptionProven: false } };
  } catch (error) { h.close(); throw error; }
}
