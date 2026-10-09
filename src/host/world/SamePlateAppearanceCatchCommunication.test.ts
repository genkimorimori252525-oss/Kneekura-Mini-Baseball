import { expect, it } from 'vitest';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import { deriveSamePaCatchCommunication, samePaCatchCommunicationObservationAt, type SamePaCatchCommunicationScope } from './SamePlateAppearanceCatchCommunication';
import { samePaOfficialSourceReference as originalRef, samePaCatchActionInput, samePaCatchAssignmentInput,
  type AcceptedSamePaCatchAction, type AcceptedSamePaCatchAssignment, type AcceptedSamePaOfficialPerson,
  type AcceptedSamePaCatchCommunication } from './SamePlateAppearanceCatchCommunicationSource';
import type { AcceptedActualCommunicationModel } from './ActualCallCommunication';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaCatchWorkInput, samePaCatchWorkOriginalsInput, assertSamePaCatchWorkContinuation, samePaCatchOriginalAuthority, captureSamePaCatchOriginals } from './SamePlateAppearanceCatchWork';
import { deriveSamePaCatchOperativeRuling, samePaCaughtOutReception } from './SamePlateAppearanceCatchOperativeRuling';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
const ref = <T extends string>(owner: T, sourceId: string) => ({ owner, sourceId, sourceHash: hash(sourceId), snapshotHash: hash(sourceId) });
const point = { x: 0, y: 0, z: 0 };
/** Explicit author fixtures are accepted original actions/conditions, not a
 * simulated umpire or Native admission. Core computes every reception. */
const fixture = (judgment: 'caught' | 'not_caught' = 'caught') => {
  const viewReference = ref('pa_lifecycle_v1_execution_views', 'view'), enrollmentReference = ref('same_pa_enrollments', 'enrollment');
  const person: AcceptedSamePaOfficialPerson = { sourceId: 'person', sourceVersion: 'fixture-v1',
    capability: 'accepted_original_umpire_person_v1', careerId: 'career', officialId: 'umpire', personId: 'umpire-person' };
  const assignment: AcceptedSamePaCatchAssignment = { sourceId: 'assignment', sourceVersion: 'fixture-v1',
    capability: 'same_pa_explicit_catch_assignment_v1', enrollmentReference, gameId: 'game', playId: 1,
    physicalPitchSourceId: 'pitch', officialId: person.officialId, personId: person.personId, personReference: originalRef(person),
    policy: { sourceId: 'original-action-policy', sourceVersion: 'fixture-v1', ruleProfileId: 'rules', kind: 'accepted_original_official_action_v1' },
    pose: { position: point, validFromElapsedSeconds: 0, validThroughElapsedSeconds: 2 } };
  const action: AcceptedSamePaCatchAction = { sourceId: 'action', sourceVersion: 'fixture-v1', capability: 'same_pa_explicit_catch_action_v1',
    assignmentReference: originalRef(assignment), officialId: person.officialId, personId: person.personId, viewReference,
    judgment, calledAt: { originTick: 1000, elapsedSeconds: 0.1, tick: 1001 } };
  const conditions = { propagationDelayTicks: 1, recognitionBaseDelayTicks: 2, maxAdditionalRecognitionDelayTicks: 0,
    audibility: 1, recognition: 1, attention: 1, minimumRecognizableQuality: 0.5 };
  const model: AcceptedActualCommunicationModel = { sourceId: 'reception-model', sourceVersion: 'fixture-v1', gameId: 'game', physicalPitchSourceId: 'pitch',
    parameters: { version: 'fixed_receiver_conditions_v1', timing: 'exact_sent_plus_core_delay_ticks_v1',
      receivers: ['batter', 'defender'].map(playerId => ({ playerId, conditions })) } };
  const source: AcceptedSamePaCatchCommunication = { sourceId: 'communication', sourceVersion: 'fixture-v1',
    capability: 'same_pa_explicit_catch_communication_v1', viewReference, actionReference: originalRef(action), modelReference: originalRef(model) };
  const scope: SamePaCatchCommunicationScope = { lineage: { enrollmentReference, actorReference: ref('physical_plate_appearance_actors', 'actor'),
    careerId: 'career', gameId: 'game', playId: 1, firstPhysicalPitchSourceId: 'original-pitch', participantReferences: [] },
    physicalPitchSourceId: 'pitch', ruleProfileId: 'rules', matchSeed: 42, ticksPerSecond: 10,
    at: { originTick: 1000, elapsedSeconds: 1, tick: 1010 }, actionBasisAt: { originTick: 1000, elapsedSeconds: 0.1, tick: 1001 },
    participantIds: ['batter', 'defender'], segments: [{ originTick: 1000, startElapsedSeconds: 0, endElapsedSeconds: 1,
      actors: ['batter', 'defender'].map(playerId => ({ playerId, primitive: { role: 'body', radius: 0.2, startTick: 1000,
        endTick: 1020, ticksPerSecond: 10, startCenter: { x: 1, y: 1, z: 0 }, startVelocity: { x: 2, y: 0, z: 0 }, acceleration: point } })) }] };
  return { source, action, assignment, person, model, scope };
};
it.each(['caught', 'not_caught'] as const)('CC01 preserves the independently accepted %s action and computes exact reception', judgment => {
  const f = fixture(judgment), before = JSON.stringify(f), value = deriveSamePaCatchCommunication(f);
  expect(value.emitted?.content.judgment).toBe(judgment);
  expect(value.recipients).toHaveLength(2);
  for (const r of value.recipients) {
    expect(r.kind).toBe('received'); if (r.kind !== 'received') throw new Error('actual reception missing');
    expect(r.reception.receivedAtElapsedSeconds).toBe(0.4);
    expect(r.receiverPosition).toEqual({ x: 1.8, y: 1, z: 0 });
  }
  expect(value.canonicalAdmission).toBeNull(); expect(value.physicalEnd).toBeNull(); expect(value.consumedRecipients).toEqual([]);
  expect(JSON.stringify(f)).toBe(before);
});
it('CC02 withholds future content even when the reception and physical cut share a recorded tick', () => {
  const f = fixture(), p = 1_000_000, calledAt = { originTick: 1000, elapsedSeconds: 0.0000001, tick: 1001 };
  const action = { ...f.action, calledAt };
  const model = { ...f.model, parameters: { ...f.model.parameters!, receivers: f.model.parameters!.receivers.map(r => ({ ...r,
    conditions: { ...r.conditions, propagationDelayTicks: 1, recognitionBaseDelayTicks: 0 } })) } };
  const at = { originTick: 1000, elapsedSeconds: 0.00000105, tick: 1002 };
  const scope = { ...f.scope, ticksPerSecond: p, actionBasisAt: calledAt, at,
    segments: f.scope.segments.map(s => ({ ...s, endElapsedSeconds: at.elapsedSeconds, actors: s.actors.map(a => ({ ...a,
      primitive: { ...a.primitive, ticksPerSecond: p, endTick: 2000 } })) })) };
  const value = deriveSamePaCatchCommunication({ ...f, action, model, scope,
    source: { ...f.source, actionReference: originalRef(action), modelReference: originalRef(model) } });
  expect(value.recipients[0].kind).toBe('scheduled');
  const visible = samePaCatchCommunicationObservationAt(value, 'batter', at);
  expect(visible).toMatchObject({ kind: 'scheduled', dueAt: { tick: at.tick } });
  expect(visible).not.toHaveProperty('received'); expect(visible).not.toHaveProperty('reception');
  expect(() => samePaCatchCommunicationObservationAt(value, 'batter', { ...at, elapsedSeconds: 0.1, tick: quantizeEventTick(1000, 0.1, p) })).toThrow(/proved clock/);
});
it('CC03 leaves absent actual action, action policy and receiver models pending without neutral defaults', () => {
  const f = fixture();
  expect(deriveSamePaCatchCommunication({ ...f, source: { ...f.source, actionReference: null }, action: null, assignment: null, person: null }).emitted).toBeNull();
  const assignment = { ...f.assignment, policy: null }, action = { ...f.action, assignmentReference: originalRef(assignment) };
  const absentPolicy = deriveSamePaCatchCommunication({ ...f, assignment, action, source: { ...f.source, actionReference: originalRef(action) } });
  expect(absentPolicy.pendingReason).toBe('accepted_original_action_policy_missing'); expect(absentPolicy.emitted).toBeNull();
  const absentModel = deriveSamePaCatchCommunication({ ...f, model: null });
  expect(absentModel.emitted).not.toBeNull(); expect(absentModel.recipients.every(r => r.kind === 'pending' && r.reason === 'reception_model_unavailable')).toBe(true);
});
it('CC04 preserves a real dropped reception and rejects changed Person, Source, scope or time', () => {
  const f = fixture(), model = { ...f.model, parameters: { ...f.model.parameters!, receivers: f.model.parameters!.receivers.map(r => ({ ...r, conditions: { ...r.conditions, audibility: 0 } })) } };
  expect(deriveSamePaCatchCommunication({ ...f, model, source: { ...f.source, modelReference: originalRef(model) } }).recipients.every(r => r.kind === 'dropped')).toBe(true);
  expect(() => deriveSamePaCatchCommunication({ ...f, person: { ...f.person, personId: 'replacement' } })).toThrow(/Source changed/);
  expect(() => deriveSamePaCatchCommunication({ ...f, action: { ...f.action, judgment: 'not_caught' } })).toThrow(/Source changed/);
  expect(() => deriveSamePaCatchCommunication({ ...f, scope: { ...f.scope, physicalPitchSourceId: 'replacement' } })).toThrow(/assignment differs/);
  const action = { ...f.action, calledAt: { ...f.action.calledAt, elapsedSeconds: 0, tick: 1000 } };
  expect(() => deriveSamePaCatchCommunication({ ...f, action, source: { ...f.source, actionReference: originalRef(action) } })).toThrow(/availability differs/);
});
it('CC05 rejects injected end/ruling fields and leaves uncovered receiver bodies explicit', () => {
  const f = fixture();
  expect(() => samePaCatchActionInput({ ...f.action, physicalEnd: { tick: 1 } }, f.action.sourceId)).toThrow();
  expect(() => samePaCatchAssignmentInput({ ...f.assignment, correctRuleResult: 'caught' }, f.assignment.sourceId)).toThrow();
  const value = deriveSamePaCatchCommunication({ ...f, scope: { ...f.scope, segments: [] } });
  expect(value.recipients.every(r => r.kind === 'pending' && r.reason === 'receiver_pose_coverage_unavailable')).toBe(true);
});
it('CW01 captures inert independent Sources and rejects caller closure or changed original action', () => {
  const f = fixture('not_caught'), originals = { source: f.source, action: f.action, assignment: f.assignment, person: f.person, model: f.model };
  const source = samePaCatchWorkInput({ sourceId: 'work', sourceVersion: 'fixture-v1', capability: 'same_pa_catch_work_v1',
    enrollmentReference: f.scope.lineage.enrollmentReference, viewReference: f.source.viewReference,
    communicationReference: originalRef(f.source), priorWorkReference: null });
  expect(captureSamePaCatchOriginals(source, samePaCatchOriginalAuthority(originals))).toEqual(originals);
  expect(() => samePaCatchWorkInput({ ...source, physicalEnd: { tick: 1010, reason: 'all_runners_retired' } })).toThrow();
  expect(() => samePaCatchWorkOriginalsInput({ ...originals, action: { ...f.action, judgment: 'caught' } }, source)).toThrow(/Source changed/);
  expect(() => samePaCatchWorkOriginalsInput({ ...originals, source: { ...f.source, viewReference: ref('pa_lifecycle_v1_execution_views', 'foreign') } }, source)).toThrow();
});
it('CW02 later evaluation keeps the original judgment and bound stochastic reception model', () => {
  const f = fixture(), originals = { source: f.source, action: f.action, assignment: f.assignment, person: f.person, model: f.model };
  expect(() => assertSamePaCatchWorkContinuation(originals, { ...originals, source: { ...f.source, sourceId: 'later-evaluation' } })).not.toThrow();
  expect(() => assertSamePaCatchWorkContinuation(originals, { ...originals, action: { ...f.action, judgment: 'not_caught' } })).toThrow();
  expect(() => assertSamePaCatchWorkContinuation(originals, { ...originals, model: { ...f.model, sourceId: 'new-random-stream' } })).toThrow();
  expect(() => assertSamePaCatchWorkContinuation({ ...originals, model: null }, originals)).not.toThrow();
});
it.each(['caught', 'not_caught'] as const)('CO01 derives only the independently accepted %s legal meaning', judgment => {
  const f = fixture(judgment), originalMatch = { ruleProfileId: asRuleProfileId('npb-2026'), playId: 1, inning: 1, half: 'top' as const,
    outs: 1, balls: 0, strikes: 0, bases: { first: null, second: null, third: null }, score: { away: 0, home: 0 } };
  const operative = deriveSamePaCatchOperativeRuling({ action: f.action, originalMatch, batterRunnerId: 'batter', basisTick: f.action.calledAt.tick,
    basisEvidenceRevision: 2, fairCatch: { kind: 'pending', reason: 'actual_fair_catch_required' } });
  const p = deriveSamePaCatchCommunication(f), result = samePaCatchCommunicationObservationAt(p, 'defender', f.scope.at);
  const semantic = samePaCaughtOutReception(operative, result);
  if (judgment === 'caught') {
    expect(operative.kind).toBe('retired'); expect(operative.onFieldCall?.ruling.outsAfter).toBe(2);
    expect(operative.ledger?.events[0].kind).toBe('UnresolvedCorrectRuleSnapshotRecorded');
    expect(operative.ledger?.playEnd).toBeNull(); expect(operative.ledger?.events.at(-1)?.kind).toBe('OnFieldCallRecorded');
    expect(semantic?.kind).toBe('received');
    if (semantic?.kind !== 'received') throw new Error('actual received OUT semantic binding missing');
    expect(semantic.received.event.content.call).toBe('out'); expect(semantic.received.event.content.callSourceId).toBe(f.action.sourceId);
    expect(samePaCaughtOutReception(operative, { kind: 'scheduled', playerId: 'defender', dueAt: f.scope.at })).toBeNull();
  } else {
    expect(operative.kind).toBe('active'); expect(operative.onFieldCall).toBeNull(); expect(semantic).toBeNull();
  }
});
