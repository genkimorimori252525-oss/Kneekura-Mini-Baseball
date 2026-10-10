import { practiceFixture } from './PitchPracticeAttempt.test-support';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { openSqliteDevelopmentPracticeExposureStore, type AcceptedDevelopmentPracticeExposure } from './SqliteDevelopmentPracticeExposureStore';
import type { SqlitePitchPracticeAttemptStore } from './SqlitePitchPracticeAttemptStore';
import type { AcceptedPhysicalCapabilityDevelopment, PhysicalCapabilityRoute } from './AcceptedPhysicalCapabilityDevelopment';

/** Synthetic accepted coefficients, genuine consumed pitch and learning owners. */
export const physicalCapabilityExposureFixture = async (cleanup: (() => void)[]) => {
  const f = await practiceFixture(cleanup), pitchIds: string[] = [];
  let previous = f.complete();
  for (let index = 0; index < 3; index++) {
    if (index) previous = f.complete(f.nextOpportunity(previous).sourceId);
    f.assess(previous); const settled = f.owner.settle(previous.attemptId);
    if (settled.kind !== 'complete') throw new Error('actual practice fixture did not settle');
    pitchIds.push(settled.activity.sourceEventId);
  }
  for (const [sourceId, kind, atDay] of [['feedback', 'FEEDBACK_RECORDED', 15], ['consolidation', 'CONSOLIDATION_RECORDED', 16]] as const) {
    f.learningEvents.set(sourceId, { eventId: sourceId, sourceEventId: sourceId, kind, atDay, domain: 'TECHNICAL' });
    f.sources.episodes.advance('episode', sourceId, f.sources.episodes.read('episode')!.episode.revision);
  }
  const accepted: AcceptedDevelopmentPracticeExposure = { sourceId: 'physical-capability-exposure', sourceVersion: 'explicit-v1',
    episodeId: 'episode', episodeRevision: f.sources.episodes.read('episode')!.episode.revision,
    policy: { policyId: 'exposure', version: 'v1', availableAtDay: 10, selfDirectedShare: 0.5, minimumEffectiveExposure: 0.1, minimumDistinctPracticeDays: 1 },
    prior: { careerId: 'career-a', playerId: 'p1', atDay: 11, domain: 'TECHNICAL', receptivity: 1, profileVersion: 'v1', policyId: 'prior', policyVersion: 'v1' },
    pitchFactors: pitchIds.map(sourceEventId => ({ sourceEventId, trainingStimulus: 1, coachingFit: 1, challengeFit: 1, motivation: 1, opportunity: 1, novelty: 1 })),
    provenance: { assessmentSourceId: 'explicit-assessment', assessmentVersion: 'v1', calibrationSourceId: 'explicit-calibration', calibrationVersion: 'v1' } };
  const owner = openSqliteDevelopmentPracticeExposureStore(f.path, { development: f.sources.episodes,
    pitchPractice: f.owner as unknown as SqlitePitchPracticeAttemptStore }, { readAcceptedExposure: id => id === accepted.sourceId ? accepted : null });
  cleanup.push(owner.close); const exposure = owner.accept(accepted.sourceId);
  const provenance = (source: unknown, original: { source: { sourceId: string; sourceVersion: string } }, route: PhysicalCapabilityRoute): AcceptedPhysicalCapabilityDevelopment => ({
    kind: 'accepted_physical_capability_development_v1', route,
    originalModelRef: { sourceId: original.source.sourceId, sourceVersion: original.source.sourceVersion },
    originalModelSourceHash: hash(original.source), originalModelSnapshotHash: hash(original),
    exposureRef: { sourceId: exposure.source.sourceId, sourceVersion: exposure.source.sourceVersion },
    exposureSourceHash: hash(exposure.source), exposureSnapshotHash: hash(exposure),
    assessmentRef: { sourceId: 'explicit-capability-assessment', sourceVersion: 'v1' },
    calibrationRef: { sourceId: 'explicit-capability-calibration', sourceVersion: 'v1' }, replacementSourceHash: hash(source),
  });
  return { f, exposure, provenance };
};
