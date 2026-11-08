import { contactFixture } from './StandalonePracticeContact.test-support';
import { openSqliteStandalonePracticeStore, type AcceptedStandalonePracticeAssessment } from './SqliteStandalonePracticeStore';
import type { AcceptedStandalonePractice } from './StandalonePracticeMotion';
import type { StandaloneBattingContactCommand } from './StandalonePracticeContact';
import { planCourseAwareSwingKinematicsV1 } from '../../core/sim/pitching/CourseAwareSwingKinematicsV1';
import { openSqliteDevelopmentPracticeExposureStore, type AcceptedDevelopmentPracticeExposure } from './SqliteDevelopmentPracticeExposureStore';
import { observeBattedBallSpinV123 } from '../../core/sim/contact/BattedBallSpinObservationV123';

/** Synthetic calibration, but genuine Native occurrence/settlement for every
 * repetition. No raw consolidated episode or mock Owner is substituted. */
export async function spinPracticeFixtureV123(cleanup: (() => void)[], intentional = true, options: Parameters<typeof contactFixture>[1] = {}) {
  const cleanupStart = cleanup.length;
  const f = await contactFixture(cleanup, options), commands = new Map<string, AcceptedStandalonePractice>(),
    assessments = new Map<string, AcceptedStandalonePracticeAssessment>();
  const owner = openSqliteStandalonePracticeStore(f.path, f.sources.episodes, {
    readAcceptedPractice: id => commands.get(id) ?? null, readAcceptedAssessment: id => assessments.get(id) ?? null,
  }); cleanup.push(owner.close);
  let pitch = f.pitch;
  const eventIds: string[] = [];
  const observations: ReturnType<typeof observeBattedBallSpinV123>[] = [];
  for (let index = 0; index < 3; index++) {
    if (index) {
      const next = { ...f.opportunities.get('feeder-pitch')!, sourceId: `spin-feeder-${index}`, ordinal: index,
        previousAttemptId: pitch.attemptId, readyAtUs: pitch.plannedDelivery.timeline.followThroughEndUs + 1,
        workloadRevision: index };
      f.opportunities.set(next.sourceId, next); pitch = f.owner.begin(next.sourceId);
    }
    const release = pitch.plannedDelivery.release, profile = f.batting.repertoire.values.profiles[0].profile;
    const plan = { handedness: 'R' as const, batterCenterOfMass: { x: release.position.x - 0.8, y: 0.95, z: 0 },
      // Explicit synthetic below-center contact, not a bonus to exitSpin.
      targetBallCenterAtPlate: { x: release.position.x, y: release.position.y - 0.02, z: 0 },
      strikeZone: { centerX: release.position.x, halfWidth: 0.22, lowerY: 0.5, upperY: 1.8 }, contactTick: release.releaseAtUs + 600000 };
    const depth = planCourseAwareSwingKinematicsV1({ ...plan, ticksPerSecond: 1_000_000, profile }).preferredContactDepthM;
    plan.contactTick = release.releaseAtUs + Math.round((release.position.z - depth) / -release.velocity.z * 1_000_000);
    const trajectory = planCourseAwareSwingKinematicsV1({ ...plan, ticksPerSecond: 1_000_000, profile }).trajectory;
    const command: StandaloneBattingContactCommand = { kind: 'BATTING_CONTACT', pitchAttemptId: pitch.attemptId,
      ...(intentional ? { spinIntentV123: { technique: 'BACKSPIN' as const, decidedTick: pitch.opportunity.readyAtUs } } : {}),
      calibrationRef: { sourceId: 'explicit-actual-flight', sourceVersion: 'v1' }, issuedTick: pitch.opportunity.readyAtUs,
      bodyReadyTick: pitch.opportunity.readyAtUs, profileId: profile.profileId, profileVersion: profile.version, plan,
      parameters: { ticksPerSecond: 1_000_000, integrationStepTicks: 2000, gravityY: 0,
        aerodynamics: { ballMassKg: 0.145, ballRadiusM: 0.0366, airDensityKgM3: 0,
          windVelocityMps: { x: 0, y: 0, z: 0 }, dragCoefficient: 0 } } };
    const source: AcceptedStandalonePractice = { sourceId: `spin-contact-${index}`, sourceVersion: 'synthetic-test-v1',
      opportunityId: `spin-opportunity-${index}`, careerId: 'career-a', playerId: 'p1', personLinkSourceId: 'intake-p1', atDay: 13,
      startTick: trajectory.startTick, endTick: trajectory.endTick, ticksPerSecond: 1_000_000, workloadRevision: index,
      episodeId: 'episode', episodeRevision: f.sources.episodes.read('episode')!.episode.revision, domain: 'TECHNICAL',
      bodySourceId: f.batting.bodyMaterialization.source.sourceId, modelSourceId: f.batting.source.sourceId, command };
    commands.set(source.sourceId, source); owner.begin(source.sourceId);
    pitch = f.owner.advance(pitch.attemptId, 0, pitch.plannedDelivery.timeline.followThroughEndUs);
    f.assess(pitch); f.owner.settle(pitch.attemptId);
    const completed = owner.advance(source.sourceId, 0, source.endTick);
    if (completed.progress.execution.kind !== 'BATTING_CONTACT' || !completed.progress.execution.contact) throw Error('actual test contact missing');
    observations.push(observeBattedBallSpinV123({ velocityMps: completed.progress.execution.contact.exitVelocity,
      spinRadPerSecond: completed.progress.execution.contact.exitSpin, bats: 'R' }));
    const assessment: AcceptedStandalonePracticeAssessment = { sourceId: `spin-contact-assessment-${index}`, sourceVersion: 'synthetic-test-v1',
      opportunitySourceId: source.sourceId, physicalProofHash: completed.physicalProofHash!, effortUnits: 1, relevant: true,
      factors: { trainingStimulus: 1, coachingFit: 1, challengeFit: 1, healthAvailability: 0.8, motivation: 1, opportunity: 1, novelty: 1 },
      provenance: { assessmentSourceId: `review-contact-${index}`, assessmentVersion: 'v1', calibrationSourceId: 'explicit-effort', calibrationVersion: 'v1' } };
    assessments.set(assessment.sourceId, assessment); const assessed = owner.assess(assessment.sourceId);
    f.learningEvents.set(assessed.event!.sourceEventId, assessed.event!);
    const settled = owner.settle(source.sourceId);
    if (settled.kind !== 'complete') throw Error('actual test contact not settled');
    eventIds.push(settled.activity.sourceEventId);
  }
  for (const [sourceId, kind, atDay] of [['feedback', 'FEEDBACK_RECORDED', 15], ['consolidation', 'CONSOLIDATION_RECORDED', 16]] as const) {
    f.learningEvents.set(sourceId, { eventId: sourceId, sourceEventId: sourceId, kind, atDay, domain: 'TECHNICAL' });
    f.sources.episodes.advance('episode', sourceId, f.sources.episodes.read('episode')!.episode.revision);
  }
  const accepted: AcceptedDevelopmentPracticeExposure = { sourceId: 'spin-exposure', sourceVersion: 'synthetic-test-v1',
    episodeId: 'episode', episodeRevision: f.sources.episodes.read('episode')!.episode.revision,
    policy: { policyId: 'explicit-exposure', version: 'v1', availableAtDay: 10, selfDirectedShare: 0.5,
      minimumEffectiveExposure: 0.1, minimumDistinctPracticeDays: 1 },
    prior: { careerId: 'career-a', playerId: 'p1', atDay: 11, domain: 'TECHNICAL', receptivity: 1,
      profileVersion: 'v1', policyId: 'explicit-prior', policyVersion: 'v1' }, pitchFactors: [],
    provenance: { assessmentSourceId: 'reviewed-spin-exposure', assessmentVersion: 'v1', calibrationSourceId: 'explicit-exposure-calibration', calibrationVersion: 'v1' } };
  const exposures = openSqliteDevelopmentPracticeExposureStore(f.path, { development: f.sources.episodes }, {
    readAcceptedExposure: id => id === accepted.sourceId ? accepted : null }); cleanup.push(exposures.close);
  const exposure = exposures.accept(accepted.sourceId);
  return { ...f, eventIds, observations, exposure, commands, owner, exposures, lastPitch: pitch, feederOwner: f.owner,
    closeAllOriginalOwners() {
      // The original fixture's first cleanup is its owned temporary directory.
      // Keep it until after the independent offline owner has finished reading.
      const removeDirectory = cleanup.splice(cleanupStart, 1)[0];
      while (cleanup.length > cleanupStart) cleanup.pop()!();
      cleanup.splice(cleanupStart, 0, removeDirectory);
    } };
}
