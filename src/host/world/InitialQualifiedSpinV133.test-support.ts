import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { authoredNativeMatchFixture } from '../../integration/native-game/AuthoredNativeMatchV1.test-support';
import { initializeAuthoredNativeMatchV1 } from '../../integration/native-game/AuthoredNativeMatchV1';
import { acceptAuthoredMeasuredBattingFixture } from '../../integration/native-game/AuthoredMeasuredBattingV1.test-support';
import type { AuthoredNativeReservationDeclarationV1 } from '../../integration/native-game/AuthoredNativeReservationV1';
import { openSqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
import { openSqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';
import { openSqliteManagerRosterDecisionStore } from './SqliteManagerRosterDecisionStore';
import { prepareActorSpinPracticeV127 } from './ActorSpinPracticeV127.test-support';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import type { BattingModelParameters } from './PlayerBattingModel';
import type { MeasuredContactAimV138 } from '../../core/world/psychology/batting/MeasuredBattingTrajectoryV1';

/** One fresh Native database, its original eighteen people, Actor, early body,
 * measured model and baselines. Numerical training/calibration declarations are
 * synthetic. No accepted Source or row is copied from another database. */
export function initialQualifiedSpinFixtureV133(stage: (name: string) => void = () => {}, options: Readonly<{
  predictionParametersV135?: BattingModelParameters['predictionCalibration']['values']['parameters'];
  uprightRegistrationV135?: true;
  fieldRegistrationV137?: true;
  contactAimV138?: MeasuredContactAimV138;
  controlledObservationV139?: true;
}> = {}) {
  const path = join(mkdtempSync(join(tmpdir(), 'initial-qualified-spin-v133-')), 'match.sqlite');
  const declaration = authoredNativeMatchFixture({ bodyDay: 1 }), genesis = initializeAuthoredNativeMatchV1(path, declaration);
  const ns = declaration.clocks[0].namespace, actor = genesis.actor;
  const measured = acceptAuthoredMeasuredBattingFixture(path, genesis, ns, 1, { bodyMaterializationSourceId: ns + ':materialization:batter:practice',
    ...(options.predictionParametersV135 ? { predictionParameters: options.predictionParametersV135 } : {}),
    ...(options.uprightRegistrationV135 ? { uprightRegistrationV135: true } : {}),
    ...(options.fieldRegistrationV137 ? { fieldRegistrationV137: true } : {}),
    ...(options.contactAimV138 ? { contactAimV138: options.contactAimV138 } : {}),
    ...(options.controlledObservationV139 ? { controlledObservationV139: true } : {}) }), batting = measured.model;
  stage('original-eighteen-person-measured-world-ready');
  const baselines: AuthoredNativeReservationDeclarationV1['baselines'] = declaration.intakes.map((p, i) => ({
    sourceId: ns + ':workload:' + i, sourceVersion: 'explicit-synthetic-workload-v1', personLinkSourceId: p.sourceId,
    careerId: p.careerId, playerId: p.playerId, createdAtDay: 1, fatigue: 0, recoveryCapacity: .5,
    policy: { policyId: ns + ':workload-policy', version: 'explicit-synthetic-v1', availableAtDay: 0,
      workloadFatiguePerUnit: .1, travelFatiguePerKm: .001, recoveryPerHour: .1 } }));
  const reservationDeclaration: AuthoredNativeReservationDeclarationV1 = { version: 'authored_native_reservation_v1', genesisPins: genesis.readPins,
    battingModelReference: reference('world_player_batting_models', batting), baselines,
    enrollment: { sourceId: ns + ':initial-enrollment', sourceVersion: 'explicit-synthetic-enrollment-v1', firstPhysicalPitchSourceId: ns + ':initial-pitch' } };
  const stores: { close(): void }[] = [], track = <T extends { close(): void }>(owner: T): T => { stores.push(owner); return owner; };
  const close = () => { stores.splice(0).reverse().forEach(owner => owner.close()); };
  try {
    const links = track(openSqlitePlayerPersonLinkStore(path));
    const workload = track(openSqlitePlayerWorkloadRecoveryStore(path, links, { readAcceptedBaseline: id => baselines.find(b => b.sourceId === id) ?? null,
      readAcceptedActivity: () => null }));
    baselines.forEach(b => workload.initialize(b.sourceId));
    const roster = track(openSqliteManagerRosterDecisionStore(path));
    const pitcher = actor.world.defenders.find(p => p.registeredPosition === 'P')!;
    const feeder = actor.defenderBindings.find(p => p.playerId === pitcher.playerId)!;
    const prepared = prepareActorSpinPracticeV127({ runtime: { path, track, links, workload, roster }, actor, batting,
      feeder: { playerId: feeder.playerId, personLinkSourceId: feeder.personLinkSourceId }, measuredMotorV133: true,
      ...(options.predictionParametersV135 ? { gravitySoftTossV135: options.predictionParametersV135 } : {}) }, stage);
    stage('original-measured-practice-qualified-before-reservation');
    return { path, declaration, genesis, actor, batting, measured, ...prepared, reservationDeclaration, close,
      openReader: () => new (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync(path, { readOnly: true }) };
  } catch (error) { close(); throw error; }
}
