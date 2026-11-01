import { expect } from 'vitest';
import {setImmediate as nextTurn} from 'node:timers/promises';
import { spinPracticeFixtureV123 } from './SpinMasteryV123.test-support';
import { readRosterDevelopmentOrigin } from './RosterDevelopmentOrigin';
import { openSqliteDevelopmentInitiationStore } from './SqliteDevelopmentInitiationStore';
import { selectManagerControlledDecision } from '../../core/world/manager/ManagerControlledDecision';
import { planCourseAwareSwingKinematicsV1 } from '../../core/sim/pitching/CourseAwareSwingKinematicsV1';
import { observeBattedBallSpinV123 } from '../../core/sim/contact/BattedBallSpinObservationV123';
import { openSqliteStandalonePracticeStore, type AcceptedStandalonePracticeAssessment } from './SqliteStandalonePracticeStore';
import type { AcceptedStandalonePractice } from './StandalonePracticeMotion';
import type { StandaloneBattingContactCommand } from './StandalonePracticeContact';
import { openSqliteDevelopmentPracticeExposureStore, type AcceptedDevelopmentPracticeExposure } from './SqliteDevelopmentPracticeExposureStore';
import type { AcceptedSpinMasteryCalibrationV123, AcceptedSpinMasteryV123 } from './SqliteSpinControlMasteryV123';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { openSqliteWorldControlStore } from './SqliteWorldControlStore';

/** Two finite synthetic learning/calibration recipes, but every roster cause,
 * episode, pitch, bat/ball contact, practice settlement and exposure is accepted
 * by its original Native owner in ONE Career/Player/database. No raw episode
 * replacement or copied receipt is used. This does not calibrate human skill. */
export async function spinMasteryMultiFixtureV125(cleanup: (() => void)[], stage: (name: string) => void = () => {}) {
  stage('back-practice-start');
  const score = { mean: 1, uncertainty: 0, evidence: 1 };
  const f = await spinPracticeFixtureV123(cleanup, true, { managerBeliefCandidates: [{ actionId: 'spin-top-demote', styleTags: [],
    competitiveOutcome: score, resourceHealth: score, executionFeasibility: score, opponentInformationResponse: score }] });
  stage('back-exposure-ready');
  const original = readRosterDevelopmentOrigin(f.db, 'episode');
  if (!original) throw Error('original accepted development policy missing');
  // A distinct real roster event after the original cooldown supplies a second
  // catalyst. Reuse the existing accepted manager/control recipe, not a fake
  // execution receipt or a second Career fixture.
  const promotion = f.roster.readOpportunity('career-a', 'club-a', 'promote-decision')!;
  const roster = f.roster.readHead('career-a', 'club-a')!;
  const world = openSqliteWorldSettlementStore(f.path), control = openSqliteWorldControlStore(f.path);
  cleanup.push(world.close, control.close);
  const clubRevision = world.readClub('career-a', 'club-a')!.revision, worldRevision = control.readHead('career-a')!.worldRevision;
  // Both candidate beliefs were declared at initial World construction; the
  // existing owner must reject retroactive edits of its original snapshots.
  const selectionAgent = promotion.selectionAgent;
  const binding = { actionId: 'spin-top-demote', command: { commandId: 'spin-top-demote', expectedRevision: roster.roster.revision,
    effectiveDay: 50, changes: [{ playerId: 'p1', assignment: { unitId: 'reserve', clubId: 'club-a' } }] } };
  const issued = f.roster.issueOpportunity({ careerId: 'career-a', clubId: 'club-a', expectedClubRevision: clubRevision,
    expectedRosterRevision: roster.roster.revision, clubAsOfDay: 50, control: promotion.control,
    decisionId: 'spin-top-demote', contextId: 'spin-top-demote-context', worldRevision, candidates: [binding], selectionAgent });
  const selected = selectManagerControlledDecision(promotion.control, issued.opportunity, selectionAgent, 'spin-top-demote-trace');
  if (!selected.ok) throw Error('genuine second roster selection unavailable');
  f.roster.apply({ careerId: 'career-a', clubId: 'club-a', expectedClubRevision: clubRevision,
    expectedRosterRevision: roster.roster.revision, expectedMoodRevision: null, clubAsOfDay: 50, control: promotion.control,
    opportunity: issued.opportunity, selection: selected.value, selectionAgent, binding,
    currentWorldRevision: worldRevision, afterWorldRevision: worldRevision + 1, executionId: 'spin-top-demotion-execution' });
  stage('second-roster-cause-ready');
  const appraisal = { ...original.appraisal, sourceId: 'spin-top-appraisal', episodeId: 'spin-top-episode',
    appraisal: { ...original.appraisal.appraisal, sourceEventId: 'spin-top-appraisal', atDay: 50 } };
  const episodes = openSqliteDevelopmentInitiationStore(f.path, { roster: f.roster, person: f.sources.person,
    appraisal: { readAcceptedAppraisal: id => id === appraisal.sourceId ? appraisal : null },
    policies: { readAcceptedPolicies: id => id === original.policies.sourceId ? original.policies : null } },
  { readAcceptedLearningEvent: id => f.learningEvents.get(id) ?? null }); cleanup.push(episodes.close);
  const initiated = episodes.apply({ episodeId: appraisal.episodeId, executionId: 'spin-top-demotion-execution', playerId: 'p1',
    personSourceId: 'intake-p1', appraisalSourceId: appraisal.sourceId, policySourceId: original.policies.sourceId });
  expect(initiated.episode.stage).toBe('ENGAGED');
  f.learningEvents.set('spin-top-hypothesis', { eventId: 'spin-top-hypothesis', sourceEventId: 'spin-top-hypothesis',
    kind: 'HYPOTHESIS_FORMED', atDay: 51, domain: 'TECHNICAL' });
  episodes.advance(appraisal.episodeId, 'spin-top-hypothesis', initiated.episode.revision);
  stage('top-hypothesis-ready');
  const commands = new Map<string, AcceptedStandalonePractice>(), assessments = new Map<string, AcceptedStandalonePracticeAssessment>();
  const practice = openSqliteStandalonePracticeStore(f.path, episodes, { readAcceptedPractice: id => commands.get(id) ?? null,
    readAcceptedAssessment: id => assessments.get(id) ?? null }); cleanup.push(practice.close);
  let pitch = f.lastPitch;
  const observations: ReturnType<typeof observeBattedBallSpinV123>[] = [], eventIds: string[] = [];
  for (let index = 0; index < 3; index++) {
    const next = { ...f.opportunities.get('feeder-pitch')!, sourceId: `spin-top-feeder-${index}`, ordinal: pitch.opportunity.ordinal + 1,
      atDay: 52, previousAttemptId: pitch.attemptId, readyAtUs: pitch.plannedDelivery.timeline.followThroughEndUs + 1,
      workloadRevision: pitch.opportunity.workloadRevision + 1 };
    f.opportunities.set(next.sourceId, next); pitch = f.feederOwner.begin(next.sourceId);
    const release = pitch.plannedDelivery.release, profile = f.batting.repertoire.values.profiles[0].profile;
    const plan = { handedness: 'R' as const, batterCenterOfMass: { x: release.position.x - 0.8, y: 0.95, z: 0 },
      // Above-center target reverses the genuine tangential contact direction.
      // No exitSpin value is assigned by this fixture.
      targetBallCenterAtPlate: { x: release.position.x, y: release.position.y + 0.02, z: 0 },
      strikeZone: { centerX: release.position.x, halfWidth: 0.22, lowerY: 0.5, upperY: 1.8 }, contactTick: release.releaseAtUs + 600000 };
    const depth = planCourseAwareSwingKinematicsV1({ ...plan, ticksPerSecond: 1_000_000, profile }).preferredContactDepthM;
    plan.contactTick = release.releaseAtUs + Math.round((release.position.z - depth) / -release.velocity.z * 1_000_000);
    const trajectory = planCourseAwareSwingKinematicsV1({ ...plan, ticksPerSecond: 1_000_000, profile }).trajectory;
    const command: StandaloneBattingContactCommand = { kind: 'BATTING_CONTACT', pitchAttemptId: pitch.attemptId,
      spinIntentV123: { technique: 'TOPSPIN', decidedTick: pitch.opportunity.readyAtUs },
      calibrationRef: { sourceId: 'explicit-top-actual-flight', sourceVersion: 'synthetic-v1' }, issuedTick: pitch.opportunity.readyAtUs,
      bodyReadyTick: pitch.opportunity.readyAtUs, profileId: profile.profileId, profileVersion: profile.version, plan,
      parameters: { ticksPerSecond: 1_000_000, integrationStepTicks: 2000, gravityY: 0,
        aerodynamics: { ballMassKg: 0.145, ballRadiusM: 0.0366, airDensityKgM3: 0, windVelocityMps: { x: 0, y: 0, z: 0 }, dragCoefficient: 0 } } };
    const source: AcceptedStandalonePractice = { sourceId: `spin-top-contact-${index}`, sourceVersion: 'synthetic-test-v125',
      opportunityId: `spin-top-opportunity-${index}`, careerId: 'career-a', playerId: 'p1', personLinkSourceId: 'intake-p1', atDay: 52,
      startTick: trajectory.startTick, endTick: trajectory.endTick, ticksPerSecond: 1_000_000,
      workloadRevision: f.sources.workload.readHead('career-a', 'p1')!.revision,
      episodeId: appraisal.episodeId, episodeRevision: episodes.read(appraisal.episodeId)!.episode.revision, domain: 'TECHNICAL',
      bodySourceId: f.batting.bodyMaterialization.source.sourceId, modelSourceId: f.batting.source.sourceId, command };
    commands.set(source.sourceId, source); practice.begin(source.sourceId);
    pitch = f.feederOwner.advance(pitch.attemptId, 0, pitch.plannedDelivery.timeline.followThroughEndUs);
    f.assess(pitch); f.feederOwner.settle(pitch.attemptId);
    const completed = practice.advance(source.sourceId, 0, source.endTick);
    if (completed.progress.execution.kind !== 'BATTING_CONTACT' || !completed.progress.execution.contact) throw Error('actual TOPSPIN contact missing');
    observations.push(observeBattedBallSpinV123({ velocityMps: completed.progress.execution.contact.exitVelocity,
      spinRadPerSecond: completed.progress.execution.contact.exitSpin, bats: 'R' }));
    const assessment: AcceptedStandalonePracticeAssessment = { sourceId: `spin-top-assessment-${index}`, sourceVersion: 'synthetic-test-v125',
      opportunitySourceId: source.sourceId, physicalProofHash: completed.physicalProofHash!, effortUnits: 1, relevant: true,
      factors: { trainingStimulus: 1, coachingFit: 1, challengeFit: 1, healthAvailability: 0.8, motivation: 1, opportunity: 1, novelty: 1 },
      provenance: { assessmentSourceId: `review-top-contact-${index}`, assessmentVersion: 'v1', calibrationSourceId: 'explicit-top-effort', calibrationVersion: 'synthetic-v1' } };
    assessments.set(assessment.sourceId, assessment); const assessed = practice.assess(assessment.sourceId);
    f.learningEvents.set(assessed.event!.sourceEventId, assessed.event!);
    const settled = practice.settle(source.sourceId); if (settled.kind !== 'complete') throw Error('TOPSPIN practice not settled');
    eventIds.push(settled.activity.sourceEventId);
    stage('top-contact-settled-' + index);
    // Let the test worker deliver RPC/heartbeat messages between completed
    // transactions. This changes no simulation clock, Source or physical step.
    await nextTurn();
  }
  expect(observations.every(o => o.topspinRadPerSecond !== null && o.topspinRadPerSecond > 0.001), JSON.stringify(observations)).toBe(true);
  stage('top-feedback-start');
  for (const [sourceId, kind, atDay] of [['spin-top-feedback', 'FEEDBACK_RECORDED', 55], ['spin-top-consolidation', 'CONSOLIDATION_RECORDED', 56]] as const) {
    f.learningEvents.set(sourceId, { eventId: sourceId, sourceEventId: sourceId, kind, atDay, domain: 'TECHNICAL' });
    episodes.advance(appraisal.episodeId, sourceId, episodes.read(appraisal.episodeId)!.episode.revision);
    stage(sourceId+'-ready');
  }
  const exposureSource: AcceptedDevelopmentPracticeExposure = { ...f.exposure.source, sourceId: 'spin-top-exposure', sourceVersion: 'synthetic-test-v125',
    episodeId: appraisal.episodeId, episodeRevision: episodes.read(appraisal.episodeId)!.episode.revision,
    prior: { ...f.exposure.source.prior, atDay: 50 },
    provenance: { ...f.exposure.source.provenance, assessmentSourceId: 'reviewed-top-exposure' } };
  const exposures = openSqliteDevelopmentPracticeExposureStore(f.path, { development: episodes }, {
    readAcceptedExposure: id => id === exposureSource.sourceId ? exposureSource : null }); cleanup.push(exposures.close);
  const exposure = exposures.accept(exposureSource.sourceId);
  stage('top-exposure-ready');
  const inputs = (technique: 'BACKSPIN' | 'TOPSPIN', acceptedAtDay: number, contactExposure: typeof f.exposure) => {
    const calibration: AcceptedSpinMasteryCalibrationV123 = { sourceId: `spin-${technique}-calibration`, sourceVersion: 'synthetic-test-v125',
      acceptedAtDay: acceptedAtDay - 5, technique, status: 'MODEL_VERIFIED', minimumIntentionalContacts: 3,
      minimumDirectionalSpinRadPerSecond: 0.001, minimumSuccessFraction: 0.5 };
    const source: AcceptedSpinMasteryV123 = { sourceId: `mastery-${technique}`, sourceVersion: 'synthetic-test-v125',
      sourceEffectIdentity: `player-p1-${technique}`, careerId: 'career-a', playerId: 'p1', personLinkSourceId: 'intake-p1', acceptedAtDay, technique,
      exposureRef: { sourceId: contactExposure.source.sourceId, sourceVersion: contactExposure.source.sourceVersion,
        sourceHash: hash(contactExposure.source), snapshotHash: hash(contactExposure) },
      repertoireRef: { sourceId: f.batting.repertoire.sourceId, sourceVersion: f.batting.repertoire.sourceVersion },
      calibrationRef: { sourceId: calibration.sourceId, sourceVersion: calibration.sourceVersion }, distinctiveness: 0.9,
      policy: { policyId: 'synthetic-qualified-multi-mastery', version: 'v1', availableAtDay: 10,
        minimumEffectiveExposure: 0.1, minimumDistinctPracticeDays: 1, minimumDistinctiveness: 0.8 } };
    return { source, calibration };
  };
  const back = inputs('BACKSPIN', 17, f.exposure), top = inputs('TOPSPIN', 57, exposure);
  const masterySources = new Map([[back.source.sourceId, back.source], [top.source.sourceId, top.source]]);
  const calibrations = new Map([[back.calibration.sourceId, back.calibration], [top.calibration.sourceId, top.calibration]]);
  return { ...f, back, top, masterySources, calibrations, topPractice: { eventIds, observations, exposure },
    authority: { readAcceptedMastery: (id: string) => masterySources.get(id) ?? null,
      readAcceptedCalibration: (id: string) => calibrations.get(id) ?? null } };
}
