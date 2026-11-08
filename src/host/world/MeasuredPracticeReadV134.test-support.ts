import { expect } from 'vitest';
import { contactFixture } from './StandalonePracticeContact.test-support';
import { measuredRepertoire } from '../../core/world/psychology/batting/MeasuredBattingFixtures.test-support';
import { planCourseAwareSwingKinematicsV1 } from '../../core/sim/pitching/CourseAwareSwingKinematicsV1';
import { openSqlitePlayerBattingModelStore } from './SqlitePlayerBattingModelStore';
import { openSqliteDevelopmentInitiationStore } from './SqliteDevelopmentInitiationStore';
import { openSqliteStandalonePracticeStore, type AcceptedStandalonePracticeAssessment } from './SqliteStandalonePracticeStore';
import type { StandaloneBattingContactCommand } from './StandalonePracticeContact';
import type { AcceptedStandalonePractice } from './StandalonePracticeMotion';
import { registeredMeasuredMotorBindingV133, planStandaloneMeasuredPracticeV133 } from './StandaloneMeasuredPracticeV133';

/** One genuine Native contact, no qualification, fabricated episode or match.
 * The original practice fixture's real Person/roster/episode/body/feeder owners
 * are retained. Numerical model/flight/effort declarations are synthetic. */
export async function measuredPracticeReadFixtureV134(cleanup: (() => void)[]) {
  const f = await contactFixture(cleanup), original = f.batting;
  const repertoire = { ...original.repertoire, sourceId: 'm134:repertoire', acceptedAtDay: 13, values: measuredRepertoire() };
  const modelSource = { ...original.source, sourceId: 'm134:model', acceptedAtDay: 13,
    repertoireRef: { sourceId: repertoire.sourceId, sourceVersion: repertoire.sourceVersion } };
  const models = openSqlitePlayerBattingModelStore(f.path, { readAcceptedModel: id => id === modelSource.sourceId ? modelSource : null,
    readAcceptedRepertoire: id => id === repertoire.sourceId ? repertoire : null,
    readAcceptedCapability: id => id === original.capability.sourceId ? original.capability : null,
    readAcceptedDecisionModel: id => id === original.decisionModel.sourceId ? original.decisionModel : null,
    readAcceptedEquipment: id => id === original.equipment.sourceId ? original.equipment : null,
    readAcceptedObservationCalibration: id => id === original.observationCalibration.sourceId ? original.observationCalibration : null,
    readAcceptedPredictionCalibration: id => id === original.predictionCalibration.sourceId ? original.predictionCalibration : null });
  cleanup.push(models.close);
  const batting = models.accept(modelSource.sourceId), release = f.pitch.plannedDelivery.release, profile = repertoire.values.profiles[0].profile;
  const plan = { handedness: 'R' as const, batterCenterOfMass: { x: release.position.x - .8, y: .95, z: 0 },
    targetBallCenterAtPlate: { x: release.position.x, y: release.position.y - .02, z: 0 },
    strikeZone: { centerX: release.position.x, halfWidth: .22, lowerY: .5, upperY: 1.8 }, contactTick: release.releaseAtUs + 600_000 };
  const depth = planCourseAwareSwingKinematicsV1({ ...plan, ticksPerSecond: 1_000_000, profile }).preferredContactDepthM;
  plan.contactTick = release.releaseAtUs + Math.round((release.position.z - depth) / -release.velocity.z * 1_000_000);
  const binding = registeredMeasuredMotorBindingV133(batting.repertoire.values, batting.equipment.values, { profileId: profile.profileId, version: profile.version });
  const command: StandaloneBattingContactCommand = { kind: 'BATTING_CONTACT', pitchAttemptId: f.pitch.attemptId,
    issuedTick: 0, bodyReadyTick: 0, profileId: profile.profileId, profileVersion: profile.version, plan,
    calibrationRef: { sourceId: 'm134:synthetic-flight', sourceVersion: 'test-v134' },
    measuredMotorV133: { implementationV133: binding.implementationV133, payloadHash: binding.payloadHash },
    parameters: { ticksPerSecond: 1_000_000, integrationStepTicks: 2000, gravityY: 0,
      aerodynamics: { ballMassKg: batting.equipment.values.ball.massKg, ballRadiusM: batting.equipment.values.ball.radiusM,
        airDensityKgM3: 0, windVelocityMps: { x: 0, y: 0, z: 0 }, dragCoefficient: 0 } } };
  const motion = planStandaloneMeasuredPracticeV133({ ...command, measuredMotorV133: command.measuredMotorV133! }, 1_000_000, batting);
  const source: AcceptedStandalonePractice = { sourceId: 'm134:contact', sourceVersion: 'test-v134', opportunityId: 'm134:opportunity',
    careerId: 'career-a', playerId: 'p1', personLinkSourceId: 'intake-p1', atDay: 13, startTick: motion.startTick, endTick: motion.endTick,
    ticksPerSecond: 1_000_000, workloadRevision: 0, bodySourceId: batting.bodyMaterialization.source.sourceId,
    modelSourceId: batting.source.sourceId, episodeId: 'episode', episodeRevision: 2, domain: 'TECHNICAL', command };
  const assessments = new Map<string, AcceptedStandalonePracticeAssessment>();
  const practice = openSqliteStandalonePracticeStore(f.path, f.sources.episodes, { readAcceptedPractice: id => id === source.sourceId ? source : null,
    readAcceptedAssessment: id => assessments.get(id) ?? null }); cleanup.push(practice.close);
  practice.begin(source.sourceId);
  const pitched = f.owner.advance(f.pitch.attemptId, 0, f.pitch.plannedDelivery.timeline.followThroughEndUs);
  f.assess(pitched); f.owner.settle(pitched.attemptId);
  const completed = practice.advance(source.sourceId, 0, source.endTick);
  if (completed.progress.execution.kind !== 'BATTING_CONTACT') throw Error('genuine measured contact family missing');
  expect(completed.progress.execution.contact).not.toBeNull();
  const assessment: AcceptedStandalonePracticeAssessment = { sourceId: 'm134:assessment', sourceVersion: 'test-v134', opportunitySourceId: source.sourceId,
    physicalProofHash: completed.physicalProofHash!, effortUnits: 2, relevant: true,
    factors: { trainingStimulus: 1, coachingFit: 1, challengeFit: 1, healthAvailability: .8, motivation: 1, opportunity: 1, novelty: 1 },
    provenance: { assessmentSourceId: 'm134:review', assessmentVersion: 'v1', calibrationSourceId: 'm134:synthetic-effort', calibrationVersion: 'v1' } };
  assessments.set(assessment.sourceId, assessment);
  const assessed = practice.assess(assessment.sourceId); f.learningEvents.set(assessed.event!.sourceEventId, assessed.event!);
  const settled = practice.settle(source.sourceId); expect(settled.kind).toBe('complete');
  if (settled.kind !== 'complete') throw Error('genuine measured contact did not settle');
  // An actual additional owner, not an adapter: mandatory original ownership
  // guards still execute. Only its optional evidence callback is mutable.
  let guardReads = 0, rejectGuard = false;
  const development = openSqliteDevelopmentInitiationStore(f.path, { roster: f.roster, person: f.sources.person,
    appraisal: { readAcceptedAppraisal: () => null }, policies: { readAcceptedPolicies: () => null } }, undefined,
  (_db, _event, phase) => { if (phase === 'read') { guardReads++; if (rejectGuard) throw Error('m134 mutable owned guard rejects'); } });
  cleanup.push(development.close);
  return { ...f, source, development, eventId: settled.activity.sourceEventId,
    guardReads: () => guardReads, rejectGuard: (value: boolean) => { rejectGuard = value; } };
}
