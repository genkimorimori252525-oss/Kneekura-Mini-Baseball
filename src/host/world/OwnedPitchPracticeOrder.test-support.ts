// Explicit synthetic prescription/window; genuine World/control/roster/body owners.
import { vi } from 'vitest';
import type { ControlledDecision, DecisionEvidenceProjection, DecisionOpportunity,
  DecisionSubmission, ExecutedDecision, HumanControlState } from '../../core/world/control/ControlTypes';
import { practiceFixture, type PracticeOpportunity } from './PitchPracticeAttempt.test-support';

export type PracticePrescription = Omit<PracticeOpportunity,
  'workloadRevision' | 'timingRevision' | 'releaseRevision'> & {
  clubId: string;
  participation: { assignmentUnitId: string; availabilityStatus: 'AVAILABLE'; availabilityEvidenceId: string };
  window: { startsAtUs: number; endsAtUs: number };
};
export type PracticeOrderDecisionInput = {
  sourceId: string; prescriptionSourceId: string; careerId: string; clubId: string;
  decisionId: string; contextId: string; actionId: string;
  expected: { worldRevision: number; controlRevision: number; clubRevision: number; rosterRevision: number;
    workloadRevision: number; timingRevision: number; releaseRevision: number };
};
export type IssuedPracticeOrderDecision = {
  sourceId: string; request: PracticeOrderDecisionInput; prescription: PracticePrescription;
  opportunity: DecisionOpportunity; control: HumanControlState; hash: string;
};
export type OwnedPracticeOrder = {
  sourceId: string; decisionSourceId: string; prescriptionSourceId: string;
  opportunity: PracticeOpportunity; decision: ControlledDecision; execution: ExecutedDecision;
  projection: DecisionEvidenceProjection; hash: string;
};
export type PracticeOrderOwner = {
  prepareOrderDecision(input: PracticeOrderDecisionInput): { kind: 'pending'; reason: string }
    | { kind: 'ready'; decision: IssuedPracticeOrderDecision };
  readOrderDecision(sourceId: string): IssuedPracticeOrderDecision | null;
  issueOrder(input: { decisionSourceId: string; executionId: string; submission: DecisionSubmission }): OwnedPracticeOrder;
  readOrder(sourceId: string): OwnedPracticeOrder | null;
};
type Module = { createOwnedPitchPracticeOrder(sources: unknown): PracticeOrderOwner };

export async function practiceOrderFixture(cleanup: (() => void)[], options: { registered?: boolean; delegated?: boolean } = {}) {
  const prescriptions = new Map<string, PracticePrescription>();
  const registered = options.registered !== false;
  const base = await practiceFixture(cleanup, {
    controlDomainIds: registered ? ['ROSTER', 'PITCH_PRACTICE'] : ['ROSTER'],
    manualControlDomainIds: registered && !options.delegated ? ['PITCH_PRACTICE'] : [],
    practiceOrderSources: true,
    extraPracticeAuthority: { readAcceptedPracticePrescription: id => prescriptions.get(id) ?? null },
  });
  // Genuine roster promotion and hypothesis exist; no actual practice was begun.
  if (base.count('pitch_practice_attempts') !== 0 || base.sources.orders!.control.readHead('career-a')!.worldRevision !== 1) {
    throw new Error('practice order fixture has an unexpected execution boundary');
  }
  const makePrescription = (index = 0, change: Partial<PracticePrescription> = {}): PracticePrescription => {
    const { workloadRevision: _workload, timingRevision: _timing, releaseRevision: _release, ...command } = base.opportunity;
    const prescription: PracticePrescription = { ...command, sourceId: `prescription-${index}`, sourceVersion: 'fixture-prescription-v1',
      opportunityId: `ordered-practice-${index}`, ordinal: 0, previousAttemptId: null,
      clubId: 'club-a', window: { startsAtUs: 0, endsAtUs: 30_000_000 },
      participation: { assignmentUnitId: 'first', availabilityStatus: 'AVAILABLE', availabilityEvidenceId: 'accepted-health' },
      episode: { episodeId: 'episode', revision: base.sources.episodes.read('episode')!.episode.revision, domain: 'TECHNICAL' }, ...change };
    prescriptions.set(prescription.sourceId, prescription); return prescription;
  };
  const prescription = makePrescription();
  // All fixture handles have registered cleanup before this absent-module RED boundary.
  const module = await vi.importActual<Module>('./OwnedPitchPracticeOrder');
  const connect = () => module.createOwnedPitchPracticeOrder({ practice: base.owner });
  let owner = connect();
  const request = (source = prescription, index = 0): PracticeOrderDecisionInput => {
    const orders = base.sources.orders!, control = orders.control.readHead('career-a')!;
    return { sourceId: `order-decision-source-${index}`, prescriptionSourceId: source.sourceId, careerId: 'career-a', clubId: 'club-a',
      decisionId: `practice-decision-${index}`, contextId: `practice-context-${index}`, actionId: `practice-action-${index}`,
      expected: { worldRevision: control.worldRevision, controlRevision: control.control.revision,
        clubRevision: orders.world.readClub('career-a', 'club-a')!.revision,
        rosterRevision: orders.roster.readHead('career-a', 'club-a')!.roster.revision,
        workloadRevision: base.sources.workload.readHead('career-a', 'p1')!.revision,
        timingRevision: base.sources.timing.readHead('career-a', 'p1')!.revision,
        releaseRevision: base.sources.release.readHead('career-a', 'p1')!.revision } };
  };
  const prepare = (input = request()) => {
    const result = owner.prepareOrderDecision(input);
    if (result.kind !== 'ready') throw new Error('accepted practice prescription remained pending');
    return result.decision;
  };
  const submission = (issued: IssuedPracticeOrderDecision): DecisionSubmission => ({ decisionId: issued.opportunity.decisionId,
    contextId: issued.opportunity.contextId, expectedControlRevision: issued.control.revision,
    expectedWorldRevision: issued.opportunity.worldRevision, actionId: issued.opportunity.legalActionIds[0],
    actor: { kind: 'HUMAN', controllerId: 'human' } });
  const issue = (issued = prepare(), executionId = 'practice-order-execution-0') => owner.issueOrder({
    decisionSourceId: issued.sourceId, executionId, submission: submission(issued) });
  const rows = (table: string) => base.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table)
    ? base.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all() : [];
  const snapshot = () => JSON.stringify(Object.fromEntries(['pitch_practice_order_decisions', 'pitch_practice_orders',
    'world_control_heads', 'world_decision_revision_events', 'world_club_heads', 'world_roster_heads',
    'pitch_practice_attempts', 'world_player_workload_activities', 'world_development_learning_events', 'world_pitch_timing_heads']
    .map(table => [table, rows(table)])));
  const reopen = () => { base.reopen(); owner = connect(); };
  return { base, prescriptions, prescription, makePrescription, request, prepare, submission, issue, rows, snapshot, reopen,
    get owner() { return owner; }, get control() { return base.sources.orders!.control; },
    clearAuthorities() { prescriptions.clear(); base.opportunities.clear(); base.assessments.clear(); } };
}
