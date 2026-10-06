import { afterEach, expect, it } from 'vitest';
import { practiceHash, practiceJson, type PitchPracticeOpportunity } from './PitchPracticeAttempt';
import { practiceOriginBehaviorFixture } from './PracticeOriginDevelopmentBehavior.test-support';
import { practiceOriginRequest, resolvePracticeDevelopmentOrigin, type PracticeOrigin } from './PracticeDevelopmentOrigin';
import { openSqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';
import { openSqlitePlayerReleaseGeometryStore } from './SqlitePlayerReleaseGeometryStore';
import { openSqliteDevelopmentInitiationStore } from './SqliteDevelopmentInitiationStore';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });

it('rejects a caller-made completed DTO even when it copies a genuine attempt and completion hash', () => {
  const f = practiceOriginBehaviorFixture(cleanup), before = f.developmentSnapshot();
  const consumer = openSqliteDevelopmentInitiationStore(f.base.path, { roster: f.base.roster, person: f.base.sources.person,
    appraisal: { readAcceptedAppraisal: () => null }, policies: { readAcceptedPolicies: () => f.initialPolicies },
    practice: { attempts: { read: () => f.origin.completed }, workload: f.base.sources.workload,
      readAcceptedAppraisal: () => f.packet.appraisal } });
  cleanup.push(() => consumer.close());
  expect(() => consumer.applyPractice(f.packet.request)).toThrow('genuine physical owner');
  expect(f.developmentSnapshot()).toBe(before);
});

it.each(['incomplete', 'unassessed', 'unsettled'] as const)('rejects a real %s practice origin without charging its workload', stage => {
  const f = practiceOriginBehaviorFixture(cleanup);
  const o: PitchPracticeOpportunity = { ...f.base.opportunity, sourceId: 'fixture-unsettled-origin', ordinal: 1,
    previousAttemptId: f.origin.completed.attemptId, readyAtUs: f.origin.completed.plannedDelivery.timeline.followThroughEndUs + 1,
    workloadRevision: 1, episode: null };
  f.opportunities.set(o.sourceId, o);
  let attempt = f.practice.begin(o.sourceId);
  attempt = f.practice.advance(attempt.attemptId, attempt.revision,
    stage === 'incomplete' ? attempt.plannedDelivery.timeline.releaseUs : attempt.plannedDelivery.timeline.followThroughEndUs);
  if (stage === 'unsettled') {
    f.assessments.set('fixture-unsettled-assessment', { ...f.origin.completed.assessment!, sourceId: 'fixture-unsettled-assessment',
      attemptId: attempt.attemptId, completionHash: attempt.completionReference!.hash });
    attempt = f.practice.acceptAssessment('fixture-unsettled-assessment');
  }
  const a = f.packet.appraisal;
  f.appraisals.set(a.sourceId, { ...a, discovery: { ...a.discovery, completionReference: attempt.completionReference
    ?? { attemptId: attempt.attemptId, revision: attempt.revision, hash: f.origin.completed.completionReference!.hash } } });
  const before = f.developmentSnapshot(), physical = f.base.snapshot('pitch_practice_attempts');
  expect(() => f.episodes.applyPractice(f.packet.request)).toThrow(/completion|assessment|workload|activity|origin/i);
  expect(f.developmentSnapshot()).toBe(before);
  expect(f.base.snapshot('pitch_practice_attempts')).toBe(physical);
  expect(f.base.count('world_player_workload_activities')).toBe(1);
});

it.each(['person', 'career', 'version', 'motif', 'discovery-event', 'appraisal-event'] as const)('rejects invalid accepted %s identity without a reservation', field => {
  const f = practiceOriginBehaviorFixture(cleanup), a = f.packet.appraisal;
  const changed = { ...a, careerId: field === 'career' ? 'foreign-career' : a.careerId,
    sourceVersion: field === 'version' ? '' : a.sourceVersion,
    discovery: { ...a.discovery, motifId: field === 'motif' ? '' : a.discovery.motifId,
      sourceEventId: field === 'discovery-event' ? '' : a.discovery.sourceEventId },
    appraisal: { ...a.appraisal, sourceEventId: field === 'appraisal-event' ? a.discovery.sourceEventId : a.appraisal.sourceEventId } };
  f.appraisals.set(a.sourceId, changed);
  const before = f.developmentSnapshot();
  expect(() => f.episodes.applyPractice({ ...f.packet.request, personSourceId: field === 'person' ? 'foreign-person' : f.packet.request.personSourceId }))
    .toThrow(/scope|appraisal|policy|Person|discovery/i);
  expect(f.developmentSnapshot()).toBe(before);
});

it.each(['learning', 'receptivity', 'initiation'] as const)('rejects a future accepted %s policy and releases its reservation', field => {
  const f = practiceOriginBehaviorFixture(cleanup), p = f.initialPolicies;
  f.policies.set(p.sourceId, { ...p, [field]: { ...p[field], availableAtDay: 14 } });
  const before = f.developmentSnapshot();
  expect(() => f.episodes.applyPractice(f.packet.request)).toThrow(/future|policy|profile/i);
  expect(f.developmentSnapshot()).toBe(before);
  f.policies.set(p.sourceId, p);
  expect(f.episodes.applyPractice(f.packet.request).episode.stage).toBe('ENGAGED');
});

it.each(['assessment', 'workload', 'physical'] as const)('rejects altered original %s evidence on read and retry', evidence => {
  const f = practiceOriginBehaviorFixture(cleanup);
  f.episodes.applyPractice(f.packet.request);
  const before = f.developmentSnapshot();
  if (evidence === 'assessment') f.base.db.exec("UPDATE pitch_practice_attempts SET assessment_json=json_set(assessment_json,'$.effortUnits',2)");
  if (evidence === 'workload') f.base.db.exec("UPDATE world_player_workload_activities SET after_json=json_set(after_json,'$.fatigue',0.01)");
  if (evidence === 'physical') f.base.db.exec("UPDATE pitch_practice_attempts SET progress_json='[]'");
  expect(() => f.episodes.read(f.packet.request.episodeId)).toThrow(/corrupt|practice|workload|source|prefix|history|evidence/i);
  expect(() => f.episodes.applyPractice(f.packet.request)).toThrow(/corrupt|practice|workload|source|prefix|history|evidence/i);
  expect(f.developmentSnapshot()).toBe(before);
});

it('uses shared cooldown for a distinct practice discovery without conflating its motif', () => {
  const f = practiceOriginBehaviorFixture(cleanup);
  f.episodes.applyPractice(f.packet.request);
  const a = { ...f.packet.appraisal, sourceId: 'fixture-cooldown-appraisal', episodeId: 'fixture-cooldown-episode',
    discovery: { ...f.packet.appraisal.discovery, sourceEventId: 'fixture-cooldown-discovery', motifId: 'fixture-other-motif' },
    appraisal: { ...f.packet.appraisal.appraisal, sourceEventId: 'fixture-cooldown-response' } };
  f.appraisals.set(a.sourceId, a);
  const result = f.episodes.applyPractice({ ...f.packet.request, episodeId: a.episodeId, appraisalSourceId: a.sourceId });
  expect(result.assessment).toMatchObject({ reason: 'COOLDOWN', probability: 0, drawCount: 1, initiated: false });
  expect(result.episode.stage).toBe('ABANDONED');
});

it('uses the configured open-hypothesis cap across different technical motifs', () => {
  const f = practiceOriginBehaviorFixture(cleanup), p = f.initialPolicies;
  f.policies.set(p.sourceId, { ...p, initiation: { ...p.initiation, cooldownDays: 0, maximumOpenHypotheses: 1 } });
  f.episodes.applyPractice(f.packet.request);
  const a = { ...f.packet.appraisal, sourceId: 'fixture-cap-appraisal', episodeId: 'fixture-cap-episode',
    discovery: { ...f.packet.appraisal.discovery, sourceEventId: 'fixture-cap-discovery', motifId: 'fixture-other-motif' },
    appraisal: { ...f.packet.appraisal.appraisal, sourceEventId: 'fixture-cap-response' } };
  f.appraisals.set(a.sourceId, a);
  expect(f.episodes.applyPractice({ ...f.packet.request, episodeId: a.episodeId, appraisalSourceId: a.sourceId }).assessment)
    .toMatchObject({ reason: 'OPEN_HYPOTHESIS_CAP', probability: 0, drawCount: 1 });
});

it('cannot backdate a new practice discovery around a later accepted appraisal', () => {
  const f = practiceOriginBehaviorFixture(cleanup), original = f.packet.appraisal;
  f.appraisals.set(original.sourceId, { ...original, appraisal: { ...original.appraisal, atDay: 14 } });
  f.episodes.applyPractice(f.packet.request);
  const before = f.developmentSnapshot();
  const earlier = { ...original, sourceId: 'fixture-backdated-appraisal', episodeId: 'fixture-backdated-episode',
    discovery: { ...original.discovery, sourceEventId: 'fixture-backdated-discovery' },
    appraisal: { ...original.appraisal, sourceEventId: 'fixture-backdated-response' } };
  f.appraisals.set(earlier.sourceId, earlier);
  expect(() => f.episodes.applyPractice({ ...f.packet.request, episodeId: earlier.episodeId, appraisalSourceId: earlier.sourceId })).toThrow(/history|future|day/i);
  expect(f.developmentSnapshot()).toBe(before);
});

it('rejects coherent post-insert origin and assessment replacement rather than adopting the substituted outcome', () => {
  const sample = practiceOriginBehaviorFixture(cleanup);
  sample.episodes.applyPractice(sample.packet.request);
  const stored = sample.base.db.prepare('SELECT origin_json FROM world_development_practice_origins').get() as { origin_json: string };
  const original = JSON.parse(stored.origin_json) as PracticeOrigin;
  const replacement: PracticeOrigin = { ...original, appraisal: { ...original.appraisal, appraisal: { ...original.appraisal.appraisal, novelty: 0 } } };
  const alternative = resolvePracticeDevelopmentOrigin(replacement);
  expect(alternative.episode.stage).toBe('ABANDONED');
  const f = practiceOriginBehaviorFixture(cleanup);
  expect(f.base.snapshot('pitch_practice_attempts')).toBe(sample.base.snapshot('pitch_practice_attempts'));
  const before = f.developmentSnapshot(), workload = f.base.snapshot('world_player_workload_activities');
  const sql = (value: string) => `'${value.replaceAll("'", "''")}'`;
  f.base.db.exec(`CREATE TRIGGER replace_practice_origin AFTER INSERT ON world_development_initiations BEGIN
    UPDATE world_development_practice_origins SET origin_json=${sql(practiceJson(replacement))},origin_hash=${sql(practiceHash(replacement))};
    UPDATE world_development_initiations SET request_json=${sql(practiceJson(practiceOriginRequest(replacement)))},
      assessment_json=${sql(practiceJson(alternative.assessment))},initial_json=${sql(practiceJson(alternative.episode))},current_json=${sql(practiceJson(alternative.episode))}; END;`);
  expect(() => f.episodes.applyPractice(f.packet.request)).toThrow(/reservation|written|source|differ/i);
  expect(f.developmentSnapshot()).toBe(before);
  expect(f.base.snapshot('world_player_workload_activities')).toBe(workload);
  f.base.db.exec('DROP TRIGGER replace_practice_origin');
  expect(f.episodes.applyPractice(f.packet.request).episode.stage).toBe('ENGAGED');
});

it('rejects an unknown source discriminator instead of falling back to roster replay', () => {
  const f = practiceOriginBehaviorFixture(cleanup);
  f.episodes.applyPractice(f.packet.request);
  f.base.db.exec("UPDATE world_development_initiations SET request_json=json_set(request_json,'$.kind','UNKNOWN_ORIGIN')");
  expect(() => f.episodes.read(f.packet.request.episodeId)).toThrow(/kind/i);
});

it('keeps an original initiation valid after real later practice, recovery and an accepted release change', () => {
  const f = practiceOriginBehaviorFixture(cleanup), initial = f.episodes.applyPractice(f.packet.request);
  const hypothesis = { eventId: 'fixture-history-hypothesis', sourceEventId: 'fixture-history-hypothesis',
    kind: 'HYPOTHESIS_FORMED' as const, atDay: 13, domain: 'TECHNICAL' as const };
  f.learningEvents.set(hypothesis.sourceEventId, hypothesis);
  f.episodes.advance(initial.episode.episodeId, hypothesis.sourceEventId, initial.episode.revision);
  const later = f.completeLater(), settled = f.practice.settle(later.attemptId);
  expect(settled.kind).toBe('complete');
  const episode = f.episodes.read(initial.episode.episodeId), origin = f.base.owner.read(f.origin.completed.attemptId);
  const recovery = { sourceEventId: 'fixture-later-recovery', sourceVersion: 'fixture-v1', evidenceId: 'fixture-accepted-recovery',
    careerId: 'career-a', playerId: 'p1', atDay: 13, kind: 'RECOVERY' as const, durationHours: 1, quality: 1, medicalAvailability: 1 };
  const workloads = openSqlitePlayerWorkloadRecoveryStore(f.base.path, f.base.sources.personLinks, {
    readAcceptedBaseline: () => null, readAcceptedActivity: id => id === recovery.sourceEventId ? recovery : null });
  cleanup.push(() => workloads.close());
  workloads.apply(recovery.sourceEventId, f.base.sources.workload.readHead('career-a', 'p1')!.revision);
  const releaseChange = { sourceId: 'fixture-later-release', sourceVersion: 'fixture-v1', careerId: 'career-a', playerId: 'p1',
    causeEventId: 'fixture-independent-form-change', causeKind: 'FORM_REBUILD' as const, effectiveDay: 13,
    body: f.origin.completed.frame.release.body, profile: { ...f.origin.completed.frame.release.profile, releaseExtensionRatio: 0.25 } };
  const release = openSqlitePlayerReleaseGeometryStore(f.base.path, f.base.sources.personLinks, {
    readAcceptedBaseline: () => null, readAcceptedChange: id => id === releaseChange.sourceId ? releaseChange : null });
  cleanup.push(() => release.close());
  release.apply(releaseChange.sourceId, 0);
  const workloadHead = f.base.sources.workload.readHead('career-a', 'p1');
  expect(f.episodes.read(initial.episode.episodeId)).toEqual(episode);
  expect(f.base.owner.read(f.origin.completed.attemptId)).toEqual(origin);
  f.reopen();
  expect(f.episodes.read(initial.episode.episodeId)).toEqual(episode);
  expect(f.episodes.applyPractice(f.packet.request)).toEqual(episode);
  expect(f.practice.settle(later.attemptId)).toEqual(settled);
  expect(f.base.sources.workload.readHead('career-a', 'p1')).toEqual(workloadHead);
  expect(f.base.owner.read(f.origin.completed.attemptId)).toEqual(origin);
});

it('retains settled workload while a stale later-practice learning revision stays pending', () => {
  const f = practiceOriginBehaviorFixture(cleanup), initial = f.episodes.applyPractice(f.packet.request);
  const hypothesis = { eventId: 'fixture-stale-hypothesis', sourceEventId: 'fixture-stale-hypothesis',
    kind: 'HYPOTHESIS_FORMED' as const, atDay: 13, domain: 'TECHNICAL' as const };
  f.learningEvents.set(hypothesis.sourceEventId, hypothesis);
  f.episodes.advance(initial.episode.episodeId, hypothesis.sourceEventId, initial.episode.revision);
  const first = f.completeLater();
  expect(f.practice.settle(first.attemptId).kind).toBe('complete');
  const head = f.episodes.read(initial.episode.episodeId)!.episode;
  const next: PitchPracticeOpportunity = { ...first.opportunity, sourceId: 'fixture-stale-later-practice', ordinal: 2,
    previousAttemptId: first.attemptId, readyAtUs: first.plannedDelivery.timeline.followThroughEndUs + 1, workloadRevision: 2,
    episode: { episodeId: head.episodeId, revision: head.revision, domain: 'TECHNICAL' } };
  f.opportunities.set(next.sourceId, next);
  const begun = f.practice.begin(next.sourceId);
  const completed = f.practice.advance(begun.attemptId, begun.revision, begun.plannedDelivery.timeline.followThroughEndUs);
  const assessment = { ...first.assessment!, sourceId: 'fixture-stale-later-assessment', attemptId: completed.attemptId,
    completionHash: completed.completionReference!.hash };
  f.assessments.set(assessment.sourceId, assessment); f.practice.acceptAssessment(assessment.sourceId);
  const feedback = { eventId: 'fixture-separate-feedback', sourceEventId: 'fixture-separate-feedback',
    kind: 'FEEDBACK_RECORDED' as const, atDay: 13, domain: 'TECHNICAL' as const };
  f.learningEvents.set(feedback.sourceEventId, feedback);
  f.episodes.advance(head.episodeId, feedback.sourceEventId, head.revision);
  const current = f.episodes.read(head.episodeId), result = f.practice.settle(completed.attemptId);
  expect(result).toMatchObject({ kind: 'pending', reason: 'learning_revision_conflict' });
  expect(f.practice.settle(completed.attemptId)).toEqual(result);
  expect(f.base.count('world_player_workload_activities')).toBe(3);
  expect(f.episodes.read(head.episodeId)).toEqual(current);
});
