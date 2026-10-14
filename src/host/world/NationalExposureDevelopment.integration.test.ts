import { afterEach, expect, it } from 'vitest';
import { nationalPhysicalFixture } from './NationalPhysicalMatchFixtures.test-support';
import { nationalExposureAppraisal, nationalExposureGenesisPolicies, nationalExposurePolicies } from './NationalExposureDevelopment.test-support';
import { openSqliteDevelopmentInitiationStore } from './SqliteDevelopmentInitiationStore';
import { openSqlitePersonGenesisStore, personGenesisEvidenceFromSqlite } from './SqlitePersonGenesisStore';
import type { AcceptedNationalExposureAppraisal } from './NationalExposureDevelopmentOrigin';
import type { AcceptedDevelopmentPolicies } from './DevelopmentEpisodeFromAcceptedAppraisal';
import { openSqlitePlayerPitchTimingStore } from './SqlitePlayerPitchTimingStore';
import { openSqlitePlayerReleaseGeometryStore } from './SqlitePlayerReleaseGeometryStore';
import { openSqlitePitchFatiguePolicyStore } from './SqlitePitchFatiguePolicyStore';
import { openSqlitePitchPracticeAttemptStore, type SqlitePitchPracticeAttemptStore } from './SqlitePitchPracticeAttemptStore';
import { openSqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';
import type { PitchPracticeAssessment, PitchPracticeOpportunity } from './PitchPracticeAttempt';
const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });

it('owns one National game exposure through appraisal, actual practice, retry and historical membership', () => {
  const f = nationalPhysicalFixture(); cleanup.push(() => f.close());
  f.closePlay();
  const receipt = f.participation.confirmNationalPhysicalPlayed(f.source.gameId, 'p0', 'close-1');
  const batter = f.participation.confirmNationalPhysicalPlayed(f.source.gameId, 'p9', 'close-1');
  const atDay = receipt.binding.gameDay;
  const person = f.track(openSqlitePersonGenesisStore(f.path));
  person.initializeCareer({ careerId: 'career-a', initializedAtDay: 10, careerSeed: 12345, policies: nationalExposureGenesisPolicies() });
  person.materializeBatch(['link-0', 'link-9']);
  f.db.exec('PRAGMA query_only=ON');
  expect(personGenesisEvidenceFromSqlite(f.db).read('link-0')).toEqual(person.read('link-0'));
  f.db.exec('PRAGMA query_only=OFF');
  const appraisals = new Map<string, AcceptedNationalExposureAppraisal>();
  const policies = new Map<string, AcceptedDevelopmentPolicies>();
  const setup = (playerId: string, personSourceId: string, participationReceiptId: string, chance = 1, suffix = '') => {
    const appraisal = nationalExposureAppraisal(playerId, atDay, suffix), policy = nationalExposurePolicies(chance);
    appraisals.set(appraisal.sourceId, appraisal); policies.set(policy.sourceId, policy);
    return { episodeId: appraisal.episodeId, playerId, personSourceId, participationReceiptId,
      appraisalSourceId: appraisal.sourceId, policySourceId: policy.sourceId };
  };
  const request = setup('p0', 'link-0', receipt.receiptId);
  let practice: SqlitePitchPracticeAttemptStore | undefined;
  const sources = { roster: f.roster, person, appraisal: { readAcceptedAppraisal: () => null },
    policies: { readAcceptedPolicies: (id: string) => policies.get(id) ?? null },
    nationalExposure: { readAcceptedAppraisal: (id: string) => appraisals.get(id) ?? null } };
  const episodeStore = f.track(openSqliteDevelopmentInitiationStore(f.path, sources,
    { readAcceptedLearningEvent: id => id === 'hypothesis' ? { eventId: id, sourceEventId: id, atDay: atDay + 1,
      kind: 'HYPOTHESIS_FORMED', domain: 'TECHNICAL' } : practice?.readAcceptedLearningEvent(id) ?? null },
    (db, event, phase) => { if (event.kind === 'PRACTICE_RECORDED') practice!.assertLearningEvidence(db, event, phase); }));
  const beforePerson = person.read('link-0');
  const first = episodeStore.applyNationalExposure(request);
  expect(first.assessment).toMatchObject({ initiated: true, drawCount: 1 });
  expect(first.episode.catalyst).toMatchObject({ family: 'ELITE_EXPOSURE', sourceEventId: receipt.receiptId,
    competitionEditionId: receipt.binding.competitionEditionId, occurredAtDay: atDay });
  expect(episodeStore.applyNationalExposure(request)).toEqual(first);
  expect(() => episodeStore.applyNationalExposure(setup('p0', 'link-0', receipt.receiptId, 1, '-alias'))).toThrow('consumed');
  const hypothesis = episodeStore.advance(request.episodeId, 'hypothesis', 1);
  const timing = f.track(openSqlitePlayerPitchTimingStore(f.path, f.links));
  const release = f.track(openSqlitePlayerReleaseGeometryStore(f.path, f.links));
  const fatigue = f.track(openSqlitePitchFatiguePolicyStore(f.path));
  const workload = f.track(openSqlitePlayerWorkloadRecoveryStore(f.path, f.links, { readAcceptedBaseline: () => null,
    readAcceptedActivity: id => practice?.readAcceptedActivity(id) ?? null },
    (db, activity, phase) => { if (activity.kind === 'PRACTICE') practice!.assertWorkloadEvidence(db, activity, phase); }));
  const timingBefore = timing.readHead('career-a', 'p0');
  const opportunity: PitchPracticeOpportunity = { sourceId: 'exposure-practice', sourceVersion: 'fixture-v1', opportunityId: 'exposure-session',
    ordinal: 0, previousAttemptId: null, careerId: 'career-a', playerId: 'p0', personLinkSourceId: 'link-0', atDay: atDay + 1, readyAtUs: 0,
    workloadRevision: workload.readHead('career-a', 'p0')!.revision, timingRevision: timingBefore!.revision,
    releaseRevision: release.readHead('career-a', 'p0')!.revision, fatiguePolicySourceId: 'response', practiceSeed: 19,
    timingIntent: { deliveryMode: 'NORMAL', cadenceIntent: 'STANDARD' }, moundReference: { x: 0, y: 0, z: 18 },
    physics: { velocity: { x: 0, y: 0, z: -30 }, spin: { x: 0, y: 100, z: 0 } },
    episode: { episodeId: request.episodeId, revision: hypothesis.revision, domain: 'TECHNICAL' } };
  const assessments = new Map<string, PitchPracticeAssessment>();
  practice = f.track(openSqlitePitchPracticeAttemptStore(f.path, { personLinks: f.links, person, timing, release, policies: fatigue, workload, episodes: episodeStore },
    { readAcceptedOpportunity: id => id === opportunity.sourceId ? opportunity : null, readAcceptedAssessment: id => assessments.get(id) ?? null }));
  const begun = practice.begin(opportunity.sourceId);
  const completed = practice.advance(begun.attemptId, 0, begun.plannedDelivery.timeline.followThroughEndUs);
  assessments.set('actual-practice-assessment', { sourceId: 'actual-practice-assessment', sourceVersion: 'fixture-v1', attemptId: completed.attemptId,
    completionHash: completed.completionReference!.hash, effortUnits: 1, healthAvailability: 1,
    provenance: { assessmentSourceId: 'fixture-observation', assessmentVersion: 'v1', calibrationSourceId: 'fixture-explicit', calibrationVersion: 'v1' } });
  practice.acceptAssessment('actual-practice-assessment');
  const settled = practice.settle(completed.attemptId);
  expect(settled.kind).toBe('complete');
  expect(episodeStore.read(request.episodeId)!.episode.stage).toBe('PRACTICING');
  expect(person.read('link-0')).toEqual(beforePerson); expect(timing.readHead('career-a', 'p0')).toEqual(timingBefore);
  // Later injury/replacement and adoption must not rewrite the original catalyst.
  f.changeAvailability('p0', 'INJURED', atDay + 1);
  f.callups.register({ ...f.request(19), editionId: f.source.editionId, registeredAtDay: atDay + 1, replacementOf: 'call-0',
    callupPolicy: { ...f.request(19).callupPolicy, rosterLimit: 10, initialRegistrationCutoffDay: 120, replacementCutoffDay: 124 } });
  expect(f.callups.readActiveRoster('career-a', f.source.editionId, 'JP', atDay + 1).some(entry => entry.input.playerId === 'p0')).toBe(false);
  f.callups.adoptAppearance({ eventId: 'later-adoption', careerId: 'career-a', receiptId: receipt.receiptId, acceptedAtDay: atDay + 1 });
  expect(episodeStore.read(request.episodeId)!.episode.catalyst).toEqual(first.episode.catalyst);
  const dismissedRequest = setup('p9', 'link-9', batter.receiptId, 0);
  const original = f.db.prepare('SELECT receipt_json FROM official_participation_receipts WHERE receipt_id=?').get(batter.receiptId)!;
  f.db.exec("CREATE TRIGGER corrupt_exposure_origin AFTER INSERT ON world_development_national_exposure_origins WHEN NEW.player_id='p9' BEGIN UPDATE official_participation_receipts SET receipt_json='{}' WHERE player_id='p9'; END");
  expect(() => episodeStore.applyNationalExposure(dismissedRequest)).toThrow();
  expect(f.db.prepare('SELECT receipt_json FROM official_participation_receipts WHERE receipt_id=?').get(batter.receiptId)).toEqual(original);
  expect(episodeStore.read(dismissedRequest.episodeId)).toBeNull();
  f.db.exec('DROP TRIGGER corrupt_exposure_origin');
  expect(episodeStore.applyNationalExposure(dismissedRequest).episode.stage).toBe('ABANDONED');
  expect(() => episodeStore.applyNationalExposure(setup('p9', 'link-9', batter.receiptId, 1, '-retry-roll'))).toThrow('consumed');
  appraisals.clear(); policies.clear();
  const reopened = f.track(openSqliteDevelopmentInitiationStore(f.path, { ...sources, nationalExposure: undefined }));
  expect(reopened.applyNationalExposure(request).episode.stage).toBe('PRACTICING');
  expect(reopened.applyNationalExposure(dismissedRequest).episode.stage).toBe('ABANDONED');
  expect(practice.read(completed.attemptId)).toEqual(practice.acceptAssessment('actual-practice-assessment'));
  f.db.prepare("UPDATE official_participation_receipts SET receipt_json='{}' WHERE receipt_id=?").run(receipt.receiptId);
  expect(() => reopened.read(request.episodeId)).toThrow(); expect(() => practice!.read(completed.attemptId)).toThrow();
});
