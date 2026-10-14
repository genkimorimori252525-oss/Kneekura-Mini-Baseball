// Genuine practice-origin episode plus existing World/control/roster/order owners.
// Manager beliefs are explicit fixture inputs pinned through a genuinely issued
// roster opportunity. The opportunity is never executed: no promotion is invented.
import { expect } from 'vitest';
import { createHumanControlState } from '../../core/world/control/HumanControl';
import { practiceOriginBehaviorFixture } from './PracticeOriginDevelopmentBehavior.test-support';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { openSqliteWorldControlStore } from './SqliteWorldControlStore';
import { openSqliteManagerBeliefHistoryStore } from './SqliteManagerBeliefHistoryStore';
import { managerBoundaryPolicy } from './ManagerBeliefBoundary.test-support';
import { openSqlitePitchPracticeAttemptStore } from './SqlitePitchPracticeAttemptStore';
import type { AcceptedPracticePrescription, PracticeOrderDecisionInput } from './OwnedPitchPracticeOrder';
import type { ManagerPracticeOrderDecisionInput } from './ManagerPracticeOrderFromBelief';

export function practiceOriginOwnedOrderFixture(cleanup: (() => void)[], route: 'Human' | 'Manager',
  beforePrepare?: (fixture: ReturnType<typeof practiceOriginBehaviorFixture>) => void) {
  const f = practiceOriginBehaviorFixture(cleanup), initiated = f.episodes.applyPractice(f.packet.request);
  expect(initiated.episode.stage).toBe('ENGAGED');
  const hypothesis = { eventId: 'fixture-owned-origin-hypothesis', sourceEventId: 'fixture-owned-origin-hypothesis',
    kind: 'HYPOTHESIS_FORMED' as const, atDay: 13, domain: 'TECHNICAL' as const };
  f.learningEvents.set(hypothesis.sourceEventId, hypothesis);
  const target = f.episodes.advance(initiated.episode.episodeId, hypothesis.sourceEventId, initiated.episode.revision);
  expect(target.stage).toBe('HYPOTHESIS');
  const handles: { close(): void }[] = [];
  const keep = <T extends { close(): void }>(value: T): T => { handles.push(value); return value; };
  const close = () => { while (handles.length) handles.pop()!.close(); };
  cleanup.push(close);
  let world = keep(openSqliteWorldSettlementStore(f.base.path));
  let control = keep(openSqliteWorldControlStore(f.base.path));
  const controls = createHumanControlState({ revision: 0, controllerId: 'human', controlledClubId: 'club-a',
    domainIds: ['ROSTER', 'PITCH_PRACTICE'], manualDomainIds: route === 'Human' ? ['PITCH_PRACTICE'] : [] });
  control.initialize({ careerId: 'career-a', worldRevision: 0, control: controls });
  const actionId = 'fixture-origin-practice-action', score = { mean: 1, uncertainty: 0, evidence: 1 };
  const belief = (id: string) => ({ actionId: id, styleTags: [] as string[], competitiveOutcome: score, resourceHealth: score,
    executionFeasibility: score, opponentInformationResponse: score });
  const agent = { managerId: 'manager-a', appointmentId: 'appointment-a', state: {
    skills: { tacticalJudgment: 50, analysis: 50, adaptation: 50, playerEvaluation: 50, operations: 50, leadership: 50 },
    philosophy: { preferredStyleTags: [] as string[] },
    temperament: { riskAppetite: 50, decisionPace: 50, policyPersistence: 50, noveltyAppetite: 50, consultationStyle: 50 },
    beliefs: { candidates: [belief('fixture-seed-roster-action'), belief(actionId)] }, strategyMemory: { activePolicyActionIds: [] as string[] } } };
  f.base.roster.issueOpportunity({ careerId: 'career-a', clubId: 'club-a', expectedClubRevision: 0, expectedRosterRevision: 0,
    clubAsOfDay: 13, control: controls, decisionId: 'fixture-origin-manager-seed', contextId: 'fixture-origin-manager-context',
    worldRevision: 0, candidates: [{ actionId: 'fixture-seed-roster-action', command: { commandId: 'fixture-seed-roster-action',
      expectedRevision: 0, effectiveDay: 13, changes: [{ playerId: 'p1', assignment: { unitId: 'first', clubId: 'club-a' } }] } }], selectionAgent: agent });
  const history = keep(openSqliteManagerBeliefHistoryStore(f.base.path));
  history.initializeFromOpportunity({ careerId: 'career-a', clubId: 'club-a', decisionId: 'fixture-origin-manager-seed', policy: managerBoundaryPolicy });
  expect(f.base.count('world_roster_executions')).toBe(0);
  const { workloadRevision: _workload, timingRevision: _timing, releaseRevision: _release, ...prospective } = f.base.opportunity;
  const readyAtUs = f.origin.completed.plannedDelivery.timeline.followThroughEndUs + 1;
  const prescription: AcceptedPracticePrescription = { ...prospective, sourceId: 'fixture-origin-owned-prescription', sourceVersion: 'fixture-v1',
    opportunityId: 'fixture-origin-owned-opportunity', ordinal: 0, previousAttemptId: null, readyAtUs,
    episode: { episodeId: target.episodeId, revision: target.revision, domain: 'TECHNICAL' },
    clubId: 'club-a', participation: { assignmentUnitId: 'reserve', availabilityStatus: 'AVAILABLE', availabilityEvidenceId: 'accepted-health' },
    window: { startsAtUs: readyAtUs, endsAtUs: readyAtUs + 30_000_000 },
    managerAction: { version: 'manager-practice-action-v1', domainId: 'PITCH_PRACTICE', actionId } };
  const prescriptions = new Map([[prescription.sourceId, prescription]]);
  const open = (withAuthority: boolean) => keep(openSqlitePitchPracticeAttemptStore(f.base.path,
    { ...f.base.sources, episodes: f.episodes, orders: { world, control, roster: f.base.roster } }, withAuthority ? {
      readAcceptedOpportunity: () => null, readAcceptedAssessment: () => null,
      readAcceptedPracticePrescription: id => prescriptions.get(id) ?? null } : undefined));
  let owner = open(true);
  const request: PracticeOrderDecisionInput = { sourceId: 'fixture-origin-owned-decision', prescriptionSourceId: prescription.sourceId,
    careerId: 'career-a', clubId: 'club-a', decisionId: 'fixture-origin-practice-decision', contextId: 'fixture-origin-practice-context', actionId,
    expected: { worldRevision: 0, controlRevision: 0, clubRevision: 0, rosterRevision: 0, workloadRevision: 1, timingRevision: 0, releaseRevision: 0 } };
  const managerRequest: ManagerPracticeOrderDecisionInput = { ...request,
    managerSelection: { version: 'manager-practice-selection-v1', managerId: 'manager-a', appointmentId: 'appointment-a',
      expectedBeliefRevision: 0, traceId: 'fixture-origin-manager-practice-trace' } };
  const prepare = () => route === 'Human' ? owner.prepareOrderDecision(request) : owner.prepareManagerOrderDecision(managerRequest);
  beforePrepare?.(f);
  const prepared = prepare();
  expect(prepared.kind).toBe('ready');
  if (prepared.kind !== 'ready') throw new Error('genuine practice-origin order preparation remained pending');
  const issue = () => route === 'Human' ? owner.issueOrder({ decisionSourceId: prepared.decision.sourceId,
    executionId: 'fixture-origin-owned-execution', submission: { decisionId: prepared.decision.opportunity.decisionId,
      contextId: prepared.decision.opportunity.contextId, expectedControlRevision: prepared.decision.control.revision,
      expectedWorldRevision: prepared.decision.opportunity.worldRevision, actionId,
      actor: { kind: 'HUMAN', controllerId: 'human' } } })
    : owner.issueManagerOrder({ decisionSourceId: prepared.decision.sourceId, executionId: 'fixture-origin-owned-execution' });
  const readDecision = () => route === 'Human' ? owner.readOrderDecision(prepared.decision.sourceId) : owner.readManagerOrderDecision(prepared.decision.sourceId);
  expect(readDecision()).toEqual(prepared.decision);
  expect(prepare()).toEqual(prepared);
  const snapshot = () => JSON.stringify(Object.fromEntries(['pitch_practice_order_decisions', 'pitch_practice_orders', 'world_control_heads',
    'world_decision_revision_events', 'pitch_practice_attempts', 'world_player_workload_activities', 'world_development_learning_events',
    'world_roster_executions', 'world_manager_person_heads'].map(table => [table, f.base.snapshot(table)])));
  const reopen = () => {
    close(); prescriptions.clear(); f.appraisals.clear(); f.policies.clear(); f.learningEvents.clear(); f.opportunities.clear(); f.assessments.clear(); f.reopen();
    world = keep(openSqliteWorldSettlementStore(f.base.path)); control = keep(openSqliteWorldControlStore(f.base.path)); owner = open(false);
  };
  return { f, prepared, prepare, issue, readDecision, reopen, snapshot, get owner() { return owner; } };
}
