import { expect } from 'vitest';
import { getOfficialPlayClosure } from '../../core/adjudication/PlayAdjudicationLedger';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { openSqliteSamePlateAppearanceLifecycleOutcomeStore } from './SamePlateAppearanceLifecycleOutcomeFromSqlite';
import { openSqliteSamePlateAppearanceTerminalEndpointStore } from './SamePlateAppearanceTerminalEndpointFromSqlite';
import { openSqliteSamePlateAppearanceTerminalSettlementStore } from './SqliteSamePlateAppearanceTerminalSettlementStore';
import { openSqliteSamePlateAppearanceTerminalTransitionStore } from './SqliteSamePlateAppearanceTerminalTransitionStore';
import { openSqliteSamePlateAppearanceEnrollmentStore } from './SqliteSamePlateAppearanceEnrollmentStore';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import type { AcceptedSamePaLifecycleOutcome } from './SamePlateAppearanceLifecycleOutcome';
import type { AcceptedSamePaTerminalEndpoint } from './SamePlateAppearanceTerminalEndpoint';
import type { AcceptedSamePaTerminalTransition } from './SamePlateAppearanceTerminalTransition';
import type { samePaPhysicalLifecycleFixture } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';

/** Append to the existing real physical chain. The only new declarations are
 * original official instructions and reference-only completion Sources. The
 * window/game/setup values reuse the existing explicit official fixtures.
 * No endpoint, workload AFTER, official result or released claim is injected. */
export const completeSamePaTerminalFixture = (h: ReturnType<typeof samePaPhysicalLifecycleFixture>, label: string,
  originalCatchOutcome?: Extract<AcceptedSamePaLifecycleOutcome, { kind: 'fair_catch' }>) => {
  const { f } = h, track = f.x.f.track, cut = h.current(), enrollmentReference = h.original.enrollmentReference;
  if (!originalCatchOutcome && cut.view.cut.timeline.status.kind !== 'walk' && cut.view.cut.timeline.status.kind !== 'strikeout') throw new Error('owned terminal count required');
  const enrollmentOwner = track(openSqliteSamePlateAppearanceEnrollmentStore(f.path));
  const originalEnrollment = enrollmentOwner.readHistorical(enrollmentReference.sourceId);
  expect(originalEnrollment?.kind).toBe('reserved');
  if (originalEnrollment?.kind !== 'reserved') throw new Error('real original participant enrollment missing');
  const participantCount = originalEnrollment.participants.length;
  expect(participantCount).toBe(10 + f.actor.world.runners.length);
  const beforeActivities = f.db.prepare('SELECT * FROM world_player_workload_activities ORDER BY source_id').all();
  const beforeHeads = f.db.prepare('SELECT * FROM world_player_workload_heads ORDER BY career_id,player_id').all();
  const source: AcceptedSamePaLifecycleOutcome = originalCatchOutcome ?? {
    sourceId: label + ':outcome', sourceVersion: 'fixture-only-v1', capability: 'same_pa_lifecycle_outcome_v1',
    enrollmentReference, viewReference: cut.viewReference, physicalOperationReference: cut.view.cut.physicalOperationReference,
    kind: 'count_terminal', rulePolicy: null,
    officialPolicy: { sourceId: label + ':window-policy', sourceVersion: 'explicit-fixture-v1', ruleProfileId: f.actor.match.ruleProfileId,
      officialWindows: { appeal: { available: true }, review: { available: false }, challenge: { available: false } } },
    official: {
      assignment: { sourceId: label + ':assignment', sourceVersion: 'fixture-only-v1', gameId: f.actor.source.gameId,
        playId: f.actor.match.playId, physicalPitchSourceId: cut.view.cut.physicalPitchReference.sourceId,
        officialIds: ['explicit-fixture-umpire'], schedulerId: 'explicit-fixture-scheduler' },
      call: { sourceId: label + ':call', sourceVersion: 'fixture-only-v1', assignmentSourceId: label + ':assignment',
        officialId: 'explicit-fixture-umpire', judgment: 'count_result' },
      events: [
        { sourceId: label + ':advance', sourceVersion: 'fixture-only-v1', schedulerId: 'explicit-fixture-scheduler', kind: 'advance_tick' },
        { sourceId: label + ':fence', sourceVersion: 'fixture-only-v1', schedulerId: 'explicit-fixture-scheduler', kind: 'next_pitch_fence' },
      ],
    },
  };
  h.save(source);
  const outcomes = track(openSqliteSamePlateAppearanceLifecycleOutcomeStore(f.path, { readAcceptedOutcome: id => h.accepted.get(id) }));
  const outcome = outcomes.acceptOutcome(source.sourceId);
  if (outcome.kind !== 'same_pa_lifecycle_outcome') throw new Error('real terminal official closure pending');
  expect(outcome.disposition).toBe('terminal'); expect(outcome.controllerRetirementBasis.participants).toHaveLength(participantCount);
  const closure = getOfficialPlayClosure(outcome.officialLedger); if (!closure) throw new Error('real terminal official window remains open');
  h.advance(reference('pa_lifecycle_v1_outcomes', outcome));
  const final = h.current(); expect(final.view.cut.stage).toBe('terminal');
  const endpointSource: AcceptedSamePaTerminalEndpoint = { sourceId: label + ':endpoint', sourceVersion: 'fixture-only-v1', capability: 'same_pa_terminal_endpoint_v1',
    enrollmentReference, finalViewReference: final.viewReference, outcomeReference: reference('pa_lifecycle_v1_outcomes', outcome) };
  h.save(endpointSource);
  const endpoints = track(openSqliteSamePlateAppearanceTerminalEndpointStore(f.path, { readAcceptedEndpoint: id => h.accepted.get(id) }));
  const endpoint = endpoints.accept(endpointSource.sourceId); if (endpoint.kind !== 'same_pa_terminal_endpoint_v1') throw new Error('real final endpoint pending');
  expect(endpoint.participants).toHaveLength(participantCount); expect(endpoint.participants).toEqual(final.view.participants);
  expect(f.db.prepare('SELECT * FROM world_player_workload_heads ORDER BY career_id,player_id').all()).toEqual(beforeHeads);
  const settlementSource = h.save({ sourceId: label + ':settlement', sourceVersion: 'fixture-only-v1', capability: 'same_pa_terminal_settlement_v1',
    terminalReference: reference('pa_terminal_v1_endpoints', endpoint) });
  const settlements = track(openSqliteSamePlateAppearanceTerminalSettlementStore(f.path, f.x.f.links, { readAcceptedSettlement: id => h.accepted.get(id) }));
  const frozen = settlements.freeze(settlementSource.sourceId);
  expect(frozen.kind).toBe('applying'); expect(frozen.participants.every(p => !p.applied)).toBe(true);
  expect(() => settlements.release(settlementSource.sourceId)).toThrow('all ten durable effects');
  const settled = settlements.settle(settlementSource.sourceId);
  expect(settled.kind).toBe('settled'); expect(settled.participants.every(p => p.applied)).toBe(true);
  expect(settled.plan.participants).toEqual(endpoint.participants);
  const afterActivities = f.db.prepare('SELECT * FROM world_player_workload_activities ORDER BY source_id').all();
  expect(afterActivities).toHaveLength(beforeActivities.length + participantCount);
  expect(afterActivities.filter(row => beforeActivities.some(old => old.source_id === row.source_id))).toEqual(beforeActivities);
  withSqliteReadTransaction(f.db, () => {
    for (const p of settled.participants) {
      expect(readActualRoleWorkloadState(f.db, endpoint.lineage.careerId, p.playerId)).toEqual(p.projectedState);
      expect(p.projectedState.revision).toBe(p.reservedState.revision + 1);
      const row = f.db.prepare('SELECT source_json,before_json,after_json FROM world_player_workload_activities WHERE source_id=?').get(p.activity.sourceEventId)!;
      expect(JSON.parse(String(row.source_json))).toEqual(p.activity);
      expect(JSON.parse(String(row.before_json))).toEqual(p.reservedState); expect(JSON.parse(String(row.after_json))).toEqual(p.projectedState);
    }
  });
  expect(() => settlements.release(settlementSource.sourceId)).toThrow('completed PA transition');
  expect(f.db.prepare('SELECT count(*) n FROM same_pa_participant_reservations WHERE enrollment_source_id=?').get(enrollmentReference.sourceId)!.n).toBe(participantCount);
  const transitionSource: AcceptedSamePaTerminalTransition = {
    sourceId: label + ':transition', sourceVersion: 'fixture-only-v1', capability: 'same_pa_terminal_transition_v1',
    terminalReference: settlementSource.terminalReference, settlementReference: settled.reference,
    applicationId: label + ':application', scoringApplicationId: label + ':scoring', controllerReset: 'rule_system_retire_original_play',
    game: f.x.closeInput(0).game, kind: 'continuing', nextStartedAtTick: closure.closedAtTick + 1, worldSetup: f.x.f.firstInput.worldSetup,
  };
  h.save(transitionSource);
  const transitions = track(openSqliteSamePlateAppearanceTerminalTransitionStore(f.path, { readAcceptedTransition: id => h.accepted.get(id) }));
  const transition = transitions.complete(transitionSource.sourceId);
  if (source.kind === 'fair_catch') {
    expect(outcome.fairCatch?.kind).toBe('same_pa_fair_catch_physical_end_v1');
    expect(transition.officialApplication.kind).toBe('live_ball');
    expect(transition.scoring.record).toMatchObject({ classification: 'fly_out', runsScored: 0, hitsCredited: 0, errorsCharged: 0 });
    expect(transition.scoringEvidence?.physical).toEqual(outcome.fairCatch?.scoringEvidence);
    expect(transition.official.receipt.appliedMatchState.outs).toBe(f.actor.match.outs + 1);
  }
  expect(transition.completion).toBe('next_play'); expect(transition.controllerRetirement.basis).toEqual(endpoint.controllerRetirementBasis);
  expect(transition.official.receipt.durableRevision).toBe(f.actor.officialRevision + 1);
  expect('activation' in transition.official).toBe(true);
  if ('activation' in transition.official) expect(transition.official.activation.nextMatchState.playId).toBe(f.actor.match.playId + 1);
  expect(f.db.prepare('SELECT count(*) n FROM applications WHERE application_id=?').get(transitionSource.applicationId)!.n).toBe(1);
  expect(f.db.prepare('SELECT count(*) n FROM official_scoring_applications WHERE scoring_application_id=?').get(transitionSource.scoringApplicationId)!.n).toBe(1);
  const release = settlements.release(settlementSource.sourceId);
  expect(release.memberRows).toHaveLength(participantCount); expect(release.settlementReference).toEqual(settled.reference);
  expect(f.db.prepare('SELECT count(*) n FROM same_pa_participant_reservations WHERE enrollment_source_id=?').get(enrollmentReference.sourceId)!.n).toBe(0);
  const bytes = () => json(['world_player_workload_activities', 'world_player_workload_heads', 'same_pa_enrollments', 'same_pa_participant_reservations',
    'pa_lifecycle_v1_outcomes', 'pa_terminal_v1_endpoints', 'pa_terminal_v1_transitions', 'pa_settlement_v1_plans', 'pa_settlement_v1_releases',
    'matches', 'applications', 'official_scoring_applications'].map(table => f.db.prepare('SELECT * FROM main.' + table + ' ORDER BY rowid').all()));
  const saved = bytes();
  outcomes.close(); endpoints.close(); settlements.close(); transitions.close(); enrollmentOwner.close();
  const reopenedOutcome = track(openSqliteSamePlateAppearanceLifecycleOutcomeStore(f.path));
  const reopenedEndpoint = track(openSqliteSamePlateAppearanceTerminalEndpointStore(f.path));
  const reopenedSettlement = track(openSqliteSamePlateAppearanceTerminalSettlementStore(f.path, f.x.f.links));
  const reopenedTransition = track(openSqliteSamePlateAppearanceTerminalTransitionStore(f.path));
  const reopenedEnrollment = track(openSqliteSamePlateAppearanceEnrollmentStore(f.path));
  expect(reopenedOutcome.acceptOutcome(source.sourceId)).toEqual(outcome);
  expect(reopenedEndpoint.accept(endpointSource.sourceId)).toEqual(endpoint);
  expect(reopenedSettlement.settle(settlementSource.sourceId)).toEqual(settled);
  expect(reopenedTransition.complete(transitionSource.sourceId)).toEqual(transition);
  expect(reopenedSettlement.release(settlementSource.sourceId)).toEqual(release);
  expect(reopenedEnrollment.readHistorical(enrollmentReference.sourceId)).toEqual(originalEnrollment);
  expect(bytes()).toBe(saved);
  return { outcome, endpoint, settled, transition, release };
};
