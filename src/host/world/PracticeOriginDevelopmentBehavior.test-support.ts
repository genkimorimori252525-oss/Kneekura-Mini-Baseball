// Test-owned proposed intake on the existing initiation owner. No production stub,
// detector, default appraisal or fake completed-practice source is installed.
import { expect } from 'vitest';
import type { DevelopmentLearningEventInput } from '../../core/world/development/DevelopmentLearningEpisode';
import type { RecordedDevelopmentInitiation } from '../../core/world/development/DevelopmentInitiationHistory';
import type { AcceptedDevelopmentPolicies, DevelopmentAppraisalSources } from './DevelopmentEpisodeFromAcceptedAppraisal';
import type { PitchPracticeAssessment, PitchPracticeOpportunity } from './PitchPracticeAttempt';
import { acceptedPracticeDiscoveryFixture, assertPracticeOriginPrerequisite, practiceOriginFixture,
  type AcceptedPracticeDiscoveryFixture } from './PracticeOriginDevelopment.test-support';
import { openSqliteDevelopmentInitiationStore, type DevelopmentInitiationSourceRequest, type SqliteDevelopmentInitiationStore } from './SqliteDevelopmentInitiationStore';
import { openSqlitePitchPracticeAttemptStore, type SqlitePitchPracticeAttemptStore } from './SqlitePitchPracticeAttemptStore';
import type { SqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';

export type PracticeInitiationRequest = Omit<DevelopmentInitiationSourceRequest, 'executionId'>;
type PracticeIntake = Readonly<{
  attempts: Pick<SqlitePitchPracticeAttemptStore, 'read'>;
  workload: Pick<SqlitePlayerWorkloadRecoveryStore, 'readActivity'>;
  readAcceptedAppraisal?: (sourceId: string) => AcceptedPracticeDiscoveryFixture | null;
}>;
type PracticeInitiationSources = Omit<DevelopmentAppraisalSources, 'history'> & Readonly<{ practice: PracticeIntake }>;
type PracticeInitiationOwner = SqliteDevelopmentInitiationStore & Readonly<{
  applyPractice(input: PracticeInitiationRequest): RecordedDevelopmentInitiation;
}>;

export function practiceOriginBehaviorFixture(cleanup: (() => void)[], outcome: 'ENGAGED' | 'ABANDONED' = 'ENGAGED') {
  const base = practiceOriginFixture(cleanup), origin = assertPracticeOriginPrerequisite(base);
  const packet = acceptedPracticeDiscoveryFixture(origin.completed);
  // Explicit endpoint policies exercise both outcomes without changing an RNG or
  // inventing production calibration. The accepted personal appraisal is unchanged.
  const initialPolicies: AcceptedDevelopmentPolicies = { ...packet.policies,
    initiation: { ...packet.policies.initiation, baseChance: outcome === 'ENGAGED' ? 1 : 0 } };
  const appraisals = new Map([[packet.appraisal.sourceId, packet.appraisal]]);
  const policies = new Map([[initialPolicies.sourceId, initialPolicies]]);
  const learningEvents = new Map<string, DevelopmentLearningEventInput>();
  const opportunities = new Map<string, PitchPracticeOpportunity>();
  const assessments = new Map<string, PitchPracticeAssessment>();
  const handles: { close(): void }[] = [];
  const keep = <T extends { close(): void }>(value: T): T => { handles.push(value); return value; };
  const close = () => { while (handles.length) handles.pop()!.close(); };
  cleanup.push(close);
  let practice = base.owner;
  const openEpisodes = (withAuthority: boolean) => {
    const sources: PracticeInitiationSources = { roster: base.roster, person: base.sources.person,
      appraisal: { readAcceptedAppraisal: () => null },
      policies: { readAcceptedPolicies: id => withAuthority ? policies.get(id) ?? null : null },
      practice: { attempts: base.owner, workload: base.sources.workload,
        ...(withAuthority ? { readAcceptedAppraisal: (id: string) => appraisals.get(id) ?? null } : {}) } };
    return keep(openSqliteDevelopmentInitiationStore(base.path, sources,
      { readAcceptedLearningEvent: id => learningEvents.get(id) ?? practice.readAcceptedLearningEvent(id) },
      (db, event, phase) => { if (event.kind === 'PRACTICE_RECORDED') practice.assertLearningEvidence(db, event, phase); })) as PracticeInitiationOwner;
  };
  let episodes = openEpisodes(true);
  const openPractice = (withAuthority: boolean) => keep(openSqlitePitchPracticeAttemptStore(base.path,
    { ...base.sources, episodes }, withAuthority ? {
      readAcceptedOpportunity: id => opportunities.get(id) ?? null,
      readAcceptedAssessment: id => assessments.get(id) ?? null,
    } : undefined));
  practice = openPractice(true);
  const completeLater = () => {
    const head = episodes.read(packet.request.episodeId)!.episode;
    const o: PitchPracticeOpportunity = { ...base.opportunity, sourceId: 'fixture-later-practice', ordinal: 1,
      previousAttemptId: origin.completed.attemptId, readyAtUs: origin.completed.plannedDelivery.timeline.followThroughEndUs + 1,
      workloadRevision: base.sources.workload.readHead('career-a', 'p1')!.revision,
      episode: { episodeId: head.episodeId, revision: head.revision, domain: 'TECHNICAL' } };
    opportunities.set(o.sourceId, o);
    let attempt = practice.begin(o.sourceId);
    const t = attempt.plannedDelivery.timeline;
    for (const atUs of [t.motionStartUs, t.gatherEndUs, t.strideStartUs, t.releaseUs, t.followThroughEndUs]) {
      attempt = practice.advance(attempt.attemptId, attempt.revision, atUs);
    }
    expect(attempt.events).toHaveLength(5);
    expect(attempt.status).toBe('DELIVERY_COMPLETE');
    const assessment: PitchPracticeAssessment = { sourceId: 'fixture-later-assessment', sourceVersion: 'fixture-v1',
      attemptId: attempt.attemptId, completionHash: attempt.completionReference!.hash, effortUnits: 1, healthAvailability: 0.9,
      provenance: { assessmentSourceId: 'fixture-later-observed-effort', assessmentVersion: 'fixture-v1',
        calibrationSourceId: 'fixture-effort-health', calibrationVersion: 'v1' } };
    assessments.set(assessment.sourceId, assessment);
    return practice.acceptAssessment(assessment.sourceId);
  };
  const reopen = () => {
    close(); base.reopen(); practice = base.owner;
    episodes = openEpisodes(false); practice = openPractice(false);
  };
  // Freeze all durable development rows, including whichever origin table the
  // existing owner adds. This neither assumes nor implements a second registry.
  const developmentSnapshot = () => JSON.stringify(base.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'world_development_%' ORDER BY name")
    .all().map(row => ({ table: row.name, rows: base.db.prepare(`SELECT * FROM ${String(row.name)} ORDER BY rowid`).all() })));
  return { base, origin, packet, initialPolicies, appraisals, policies, learningEvents, opportunities, assessments,
    get episodes() { return episodes; }, get practice() { return practice; },
    completeLater, reopen, developmentSnapshot };
}
