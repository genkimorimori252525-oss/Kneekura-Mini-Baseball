import type { SamePaLiveWorkCensus } from './SamePlateAppearanceLiveWorkCensus';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep } from './SamePlateAppearancePhysicalEpisode';
import type { SamePaCatchWork } from './SamePlateAppearanceCatchWorkFromSqlite';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import type { LivePlaySource } from '../../core/sim/liveAction/LivePlayRegistry';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorFreeze as freeze, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

type Field = SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep;
type Domain = 'controller_renewal' | 'observation_scheduling' | 'body_motion'
  | 'ball_and_contact_generation' | 'canonical_fair_catch_rule_consumption';
type Successor = Readonly<{ domain: Domain; playerId: string | null }>;
type Phase = Readonly<{
  kind: 'communication_delivery' | 'observation_sample' | 'decision_issue' | 'motor_adoption' | 'acquisition' | 'catch_rule_evidence';
  playerId: string | null; originReference: SamePaReference; completionReference: SamePaReference | null;
  source: LivePlaySource; successors: readonly Successor[];
}>;
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('catch phase original reference or scope differs'); };

/** Operation-local projection only. The Native admitted-prefix reader supplies
 * rederived original owners and their census on one read snapshot. There is no
 * accepted completion input, global watermark, actor settlement or PlayEnd here.
 * Successor domains remain independently open, including after local completion. */
export const deriveSamePaCatchPhaseWork = (input: Readonly<{
  fields: readonly Field[];
  census: SamePaLiveWorkCensus; calls: readonly SamePaCatchWork[];
}>) => {
  const { fields, census, calls } = input, root = fields[0], last = fields.at(-1);
  if (!root || root.kind !== 'same_pa_physical_field_root_v1' || !last) throw new Error('catch phase original field root missing');
  // Hash each original once for this immutable projection, including a shared
  // communication receipt delivered to eleven through thirteen participants.
  const pins = new Map(fields.map(f => [f, reference(f.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', f)]));
  const fieldRef = (f: Field) => pins.get(f)!;
  const callPins = new Map(calls.map(c => [c, reference('pa_catch_v1_work', c)]));
  const callRef = (c: SamePaCatchWork) => callPins.get(c)!;
  same(census.originalFieldPrefix.fieldReferences, fields.map(fieldRef));
  same(census.originalFieldPrefix.physicalPitchSourceId, root.physicalPitchSourceId);
  const at = census.originalFieldPrefix.at, moment = last.field.motion.world.moment;
  same(at, { originTick: moment.originTick, elapsedSeconds: moment.elapsedSeconds, tick: moment.ball.tick });
  const records = new Map(fields.map(f => [json(fieldRef(f)), f]));
  if (records.size !== fields.length) throw new Error('catch phase duplicate original operation');
  const original = (pin: SamePaReference): Field => {
    const field = records.get(json(pin));
    if (!field) throw new Error('catch phase original field reference missing');
    return field;
  };
  const phases: Phase[] = [], revision = fields.length + calls.length;
  const successor = (domain: Domain, playerId: string | null): Successor => ({ domain, playerId });
  const add = (kind: Phase['kind'], originReference: SamePaReference, playerId: string | null,
    completion: Readonly<{ pin: SamePaReference; tick: number; eventId?: string }> | null, successors: readonly Successor[]) => {
    if (playerId !== null && !census.originalFieldPrefix.participantIds.includes(playerId)) throw new Error('catch phase original participant missing');
    if (completion && (!Number.isSafeInteger(completion.tick) || completion.tick < 0 || completion.tick > at.tick))
      throw new Error('catch phase completion is outside original cut');
    const sourceId = json(['same_pa_catch_phase_v1', root.lineage.enrollmentReference.sourceId, root.physicalPitchSourceId,
      kind, originReference.owner, originReference.sourceId, playerId]);
    if (phases.some(p => p.source.sourceId === sourceId)) throw new Error('catch phase duplicate operation identity');
    phases.push({ kind, playerId, originReference, completionReference: completion?.pin ?? null, successors,
      source: { sourceId, revision, queue: null, physical: [], intents: [], information: [], decisions: [], ruleWindows: [],
        ...(completion ? { completion: { completedAtTick: completion.tick, basisEventId: completion.eventId ?? json(completion.pin) } } : {}) } });
  };
  const consumed = (pin: SamePaReference | undefined) => {
    if (!pin) return null;
    const field = original(pin);
    return { pin: fieldRef(field), tick: field.evaluationTick };
  };
  const motor = (pin: SamePaReference | undefined, decision: SamePaReference, playerId: string) => {
    if (!pin) return null;
    const field = original(pin), a = field.kind === 'same_pa_physical_field_step_v1' ? field.source.action : undefined;
    const r = field.kind === 'same_pa_physical_field_step_v1' ? field.actionResult : undefined;
    if (a?.kind === 'defender_motion_v1' && r?.kind === a.kind) {
      if (!a.selections.some(s => s.member.playerId === playerId && json(s.decisionReference) === json(decision))
        || !r.motors.some(m => m.self.playerId === playerId && m.command.playerId === playerId))
        throw new Error('catch phase original defender adoption differs');
    } else if ((a?.kind === 'batter_catch_motion_v1' || a?.kind === 'occupied_runner_catch_motion_v1') && r?.kind === a.kind) {
      if (r.playerId !== playerId || json(a.responseReference) !== json(decision) || json(r.responseReference) !== json(decision))
        throw new Error('catch phase original runner adoption differs');
    } else throw new Error('catch phase original adoption consumer missing');
    if (fields.indexOf(field) <= fields.indexOf(original(decision))) throw new Error('catch phase adoption precedes its original decision');
    return consumed(pin);
  };
  for (const field of fields) {
    if (field.kind !== 'same_pa_physical_field_step_v1') continue;
    const r = field.actionResult, a = field.source.action, pin = fieldRef(field);
    if (r?.kind === 'defender_observation_v1') {
      if (a?.kind !== r.kind || a.member.playerId !== r.playerId || r.receipt.at.tick !== field.evaluationTick)
        throw new Error('catch phase original observation receipt differs');
      add('observation_sample', pin, r.playerId, consumed(pin), [successor('controller_renewal', r.playerId), successor('observation_scheduling', r.playerId)]);
    }
  }
  for (const d of [...census.defenderDecisions.pending, ...census.defenderDecisions.consumed]) {
    const field = original(d.decisionReference), r = field.kind === 'same_pa_physical_field_step_v1' ? field.actionResult : undefined;
    if (r?.kind !== 'defender_decision_v1' || r.playerId !== d.playerId) throw new Error('catch phase original decision missing');
    same(r.observationReference, d.observationReference); original(d.observationReference);
    const adoption = census.defenderDecisions.consumed.find(c => json(c.decisionReference) === json(d.decisionReference));
    const proof = motor(adoption?.consumerReference, d.decisionReference, d.playerId);
    // The initial decision schedules future issuance. Only its actual motor
    // consumer authenticates issuance; elapsed time or a selected plan does not.
    add('decision_issue', d.decisionReference, d.playerId, proof, [successor('controller_renewal', d.playerId)]);
    add('motor_adoption', d.decisionReference, d.playerId, proof, [successor('body_motion', d.playerId), successor('controller_renewal', d.playerId)]);
  }
  for (const item of [...census.catchResponses.pending, ...census.catchResponses.adopted]) {
    const { response: r, responseReference: pin } = item;
    const owned = original(pin);
    if (owned.kind !== 'same_pa_physical_field_step_v1') throw new Error('catch phase original response missing');
    same(owned.actionResult, r);
    const origin = fields.find(f => f.source.sourceId === r.replan.processSourceId);
    if (origin?.kind !== 'same_pa_physical_field_step_v1' || origin.actionResult?.kind !== 'defender_catch_response_v1'
      || origin.actionResult.playerId !== r.playerId) throw new Error('catch phase original response lifecycle missing');
    const issued = r.issuedBySourceId ? fields.find(f => f.source.sourceId === r.issuedBySourceId) : null;
    if (issued && (issued.kind !== 'same_pa_physical_field_step_v1' || issued.actionResult?.kind !== 'defender_catch_response_v1'
      || issued.actionResult.playerId !== r.playerId || !issued.actionResult.replan.selectedAt
      || issued.actionResult.replan.selectedAt.tick !== issued.evaluationTick)) throw new Error('catch phase original response issuance differs');
    if (r.issuedBySourceId && !issued) throw new Error('catch phase original response issuer missing');
    add('decision_issue', fieldRef(origin), r.playerId, issued ? consumed(fieldRef(issued)) : null, [successor('controller_renewal', r.playerId)]);
    const adoption = census.catchResponses.adopted.find(c => json(c.responseReference) === json(pin));
    add('motor_adoption', fieldRef(origin), r.playerId, motor(adoption?.consumerReference, pin, r.playerId),
      [successor('body_motion', r.playerId), successor('controller_renewal', r.playerId)]);
  }
  for (const item of [...census.batterCatchResponses.pending, ...census.batterCatchResponses.adopted,
    ...(census.occupiedRunnerCatchResponses?.pending ?? []), ...(census.occupiedRunnerCatchResponses?.adopted ?? [])]) {
    const { response: r, responseReference: pin } = item, owned = original(pin);
    if (owned.kind !== 'same_pa_physical_field_step_v1') throw new Error('catch phase original runner response missing');
    same(owned.actionResult, r);
    if (r.intent.issuedTick !== owned.evaluationTick) throw new Error('catch phase original runner issuance differs');
    add('decision_issue', pin, r.playerId, consumed(pin), [successor('controller_renewal', r.playerId)]);
    const adoption = [...census.batterCatchResponses.adopted, ...(census.occupiedRunnerCatchResponses?.adopted ?? [])]
      .find(c => json(c.responseReference) === json(pin));
    add('motor_adoption', pin, r.playerId, motor(adoption?.consumerReference, pin, r.playerId),
      [successor('body_motion', r.playerId), successor('controller_renewal', r.playerId)]);
  }
  const captures = new Map<string, SamePaPhysicalFieldStep>();
  for (const field of fields) if (field.kind === 'same_pa_physical_field_step_v1' && field.actionResult?.kind === 'capture_checkpoint_v1') {
    const r = field.actionResult;
    if (field.source.action?.kind !== r.kind) throw new Error('catch phase original capture Source differs');
    same(field.source.action.candidateReference, r.candidateReference); original(r.candidateReference);
    // Preserve the first genuine terminal receipt. Later cuts do not move it.
    const key = json(r.candidateReference), previous = captures.get(key);
    if (previous?.actionResult?.kind !== 'capture_checkpoint_v1' || previous.actionResult.progress.kind !== 'secured') captures.set(key, field);
  }
  for (const field of captures.values()) {
    const r = field.actionResult;
    if (r?.kind !== 'capture_checkpoint_v1') throw new Error('catch phase capture kind differs');
    add('acquisition', r.candidateReference, null, r.progress.kind === 'secured' ? consumed(fieldRef(field)) : null,
      [successor('ball_and_contact_generation', null), successor('canonical_fair_catch_rule_consumption', null)]);
  }
  for (const [index, call] of calls.entries()) {
    same(call.lineage, root.lineage); same(call.physicalPitchReference.sourceId, root.physicalPitchSourceId);
    original(call.physicalOperationReference); same(call.source.priorWorkReference, index ? callRef(calls[index - 1]) : null);
    same([...call.communication.recipients.map(r => r.playerId)].sort(), [...census.originalFieldPrefix.participantIds].sort());
    if (!call.originalInputs.action || !call.communication.emitted || call.evaluationTick > at.tick
      || call.evaluationTick !== call.communication.evaluatedThrough.tick || index && call.evaluationTick < calls[index - 1].evaluationTick)
      throw new Error('catch phase original call cut differs');
    if (index) same(call.originalInputs.action, calls[0].originalInputs.action);
  }
  if (calls.length) {
    const first = calls[0], latest = calls.at(-1)!, origin = callRef(first);
    for (const recipient of latest.communication.recipients) {
      const proof = calls.find(c => c.communication.recipients.some(r => r.playerId === recipient.playerId && (r.kind === 'received' || r.kind === 'dropped')));
      if (proof) {
        const prior = proof.communication.recipients.find(r => r.playerId === recipient.playerId)!;
        same(prior.kind, recipient.kind);
        if (prior.kind === 'received' && recipient.kind === 'received') same(prior.reception, recipient.reception);
      }
      add('communication_delivery', origin, recipient.playerId, proof ? { pin: callRef(proof), tick: proof.evaluationTick } : null,
        recipient.kind === 'dropped' ? [] : [successor('controller_renewal', recipient.playerId)]);
    }
    // The original operative ledger owns this particular rule interpretation,
    // including an honestly unresolved snapshot. It is not final rule truth.
    if (first.operative.kind === 'retired') {
      const evidence = first.operative.ledger.events.filter(e => e.kind === 'CorrectRuleSnapshotRecorded' || e.kind === 'UnresolvedCorrectRuleSnapshotRecorded');
      if (evidence.length !== 1 || evidence[0].snapshot.snapshotId !== first.operative.onFieldCall.basisSnapshotId
        || evidence[0].eventId !== first.originalInputs.action!.sourceId + ':rule-evidence'
        || evidence[0].tick > first.evaluationTick) throw new Error('catch phase original rule consumption event missing');
      add('catch_rule_evidence', origin, null, { pin: origin, tick: first.evaluationTick, eventId: evidence[0].eventId },
        [successor('canonical_fair_catch_rule_consumption', null)]);
    }
  }
  return freeze({ kind: 'same_pa_catch_phase_work_v1' as const, scope: 'operation_local_only' as const,
    originalFieldPrefix: census.originalFieldPrefix, phases, sources: phases.map(p => p.source), producerCompleteness: 'unproved' as const });
};
export type SamePaCatchPhaseWork = ReturnType<typeof deriveSamePaCatchPhaseWork>;
