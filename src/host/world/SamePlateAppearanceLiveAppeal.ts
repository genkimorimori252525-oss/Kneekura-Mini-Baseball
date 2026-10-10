import type { LivePlaySource } from '../../core/sim/liveAction/LivePlayRegistry';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import type { BallWorldAppealComplianceEvidence } from '../../core/adjudication/PlayAdjudicationLedger';
import { createControlledBaseContactFact, createControlledRunnerTagFact, createDefensiveAppealAttemptFact, createFlyBallFirstFielderTouchFact,
  type DefensiveAppealAttemptFact, type ControlledBaseContactFact, type ControlledRunnerTagFact } from '../../core/rules/PhysicalRuleFacts';
import { evaluateBallWorldTagUpCompliance } from '../../core/rules/BallWorldTagUpCompliance';
import { deriveBallWorldPlayerBaseContactHistory } from '../../core/sim/ball/BallWorldPlayerBaseContactHistory';
import { findBallWorldControlledBaseContacts, type BallWorldBaseControlWindow } from '../../core/sim/ball/BallWorldControlledBaseContacts';
import { samplePiecewiseFieldActor, validatePiecewiseFieldActors } from '../../core/sim/ball/BattedWorldPiecewiseFieldMotion';
import { findAcceleratedSphereContactSeconds } from '../../core/sim/collision/AcceleratedSphereContact';
import type { ActualObservationMoment } from './ActualFieldObservation';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep, SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import { samePaDispatchMemberValid, type SamePaDispatchMember } from './SamePlateAppearanceDispatchRoles';
import { samePaFields as fields, samePaReferenceValid as validRef, samePaText, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { deriveSamePaFieldRuleEvidence } from './SamePlateAppearanceFieldRuleEvidence';
import { actorFreeze as freeze, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
type Field = SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep;
type StepRef = SamePaReference<'pa_physical_v1_field_steps'>;
type Base = 'first' | 'second' | 'third';
const number = { first: 1, second: 2, third: 3 } as const;
export type SamePaLiveAppealIndicationRequest = Readonly<{ kind: 'appeal_indication_v1'; member: SamePaDispatchMember;
  defenderId: string; runnerId: string; base: Base; contact: 'base' | 'runner_body' }>;
export type SamePaLiveAppealIndication = Readonly<{ kind: 'appeal_indication_v1'; throwerId: string; defenderId: string;
  runnerId: string; base: Base; contact: 'base' | 'runner_body'; indicatedAt: ActualObservationMoment }>;
export type SamePaLiveAppealContactRequest = Readonly<{ kind: 'appeal_contact_v1'; indicationReference: StepRef; throwPlanReference: StepRef }>;
export type SamePaLiveAppealExecution = Readonly<{ kind: 'pending'; reason: string }> | Readonly<{
  kind: 'executed'; attempt: DefensiveAppealAttemptFact; complianceEvidence: BallWorldAppealComplianceEvidence;
  moment: ActualObservationMoment; indicatedAt: ActualObservationMoment;
  contact: Readonly<{ kind: 'base' | 'runner_body'; fact: ControlledBaseContactFact | ControlledRunnerTagFact; control: BallWorldBaseControlWindow }>;
  // Missing producer ownership, not a legal result or an assumed live window.
  rights: Readonly<{ kind: 'pending'; reason: 'original_live_ball_and_appeal_rights_required' }>;
}>;
export type SamePaLiveAppealContact = Readonly<{ kind: 'appeal_contact_v1'; indicationReference: StepRef;
  throwPlanReference: StepRef; execution: SamePaLiveAppealExecution }>;
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('live appeal original linkage or cut differs'); };
const pin = (f: Field) => reference(f.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', f);
const at = (f: Field): ActualObservationMoment => { const m=f.field.motion.world.moment; return { originTick:m.originTick,elapsedSeconds:m.elapsedSeconds,tick:m.ball.tick }; };
const linked = (prefix: readonly Field[], ref: StepRef): SamePaPhysicalFieldStep => {
  const found=prefix.find(f=>f.source.sourceId===ref.sourceId);
  if (!found || found.kind!=='same_pa_physical_field_step_v1') throw new Error('live appeal original linked step missing');
  same(pin(found),ref); return found;
};
export const samePaLiveAppealInput = (a: SamePaLiveAppealIndicationRequest | SamePaLiveAppealContactRequest): void => {
  if(a.kind==='appeal_indication_v1') {
    if(!fields(a,['kind','member','defenderId','runnerId','base','contact']) || !samePaDispatchMemberValid(a.member)
      || ![a.defenderId,a.runnerId].every(samePaText) || !Object.hasOwn(number,a.base) || !['base','runner_body'].includes(a.contact)
      || new Set([a.member.playerId,a.defenderId,a.runnerId]).size!==3) throw new Error('invalid explicit live appeal indication');
  } else if(a.kind!=='appeal_contact_v1' || !fields(a,['kind','indicationReference','throwPlanReference'])
    || !validRef(a.indicationReference,'pa_physical_v1_field_steps') || !validRef(a.throwPlanReference,'pa_physical_v1_field_steps'))
    throw new Error('invalid original live appeal contact request');
};
export const deriveSamePaLiveAppealIndication = (source: SamePaPhysicalFieldStepSource, root: SamePaPhysicalFieldRoot,
  previous: Field, match: CanonicalMatchState, defenderIds: readonly string[]): SamePaLiveAppealIndication => {
  const a=source.action; if(a?.kind!=='appeal_indication_v1') throw new Error('live appeal indication Source missing');
  samePaLiveAppealInput(a);
  if(source.throughTick!==previous.evaluationTick || root.physicalPitchSourceId!==previous.physicalPitchSourceId
    || match.playId!==root.lineage.playId || match.bases[a.base]!==a.runnerId
    || !defenderIds.includes(a.member.playerId) || !defenderIds.includes(a.defenderId)
    || defenderIds.includes(a.runnerId) || previous.timeline.status.kind!=='batted_ball_pending') throw new Error('live appeal original participant or phase differs');
  return freeze({kind:a.kind,throwerId:a.member.playerId,defenderId:a.defenderId,runnerId:a.runnerId,base:a.base,contact:a.contact,indicatedAt:at(previous)});
};
/** Link purpose before transfer. The accepted throw still needs its own real execution. */
export const bindSamePaAppealThrow = (source: SamePaPhysicalFieldStepSource, prefix: readonly Field[]): StepRef | undefined => {
  const a=source.action; if(a?.kind!=='throw_plan_v1' || !a.appealIndicationReference) return undefined;
  const indication=linked(prefix,a.appealIndicationReference), r=indication.actionResult;
  if(indication.source.action?.kind!=='appeal_indication_v1' || r?.kind!=='appeal_indication_v1'
    || r.throwerId!==a.member.playerId || r.defenderId!==a.receiverPlayerId
    || prefix.some(f=>f.kind==='same_pa_physical_field_step_v1' && f.actionResult?.kind==='throw_plan_v1'
      && f.actionResult.appealIndicationReference?.sourceId===indication.source.sourceId)) throw new Error('live appeal throw purpose differs or was already consumed');
  same(r.indicatedAt,at(indication)); return a.appealIndicationReference;
};
/** Union already validated, receiver-owned intervals without bridging an exact
 * gap. Starts are inclusive; an exclusive end is covered only by another
 * interval that actually includes that moment. No rounding or tolerance. */
export const samePaContinuousAppealControl = (windows: readonly BallWorldBaseControlWindow[],
  acquiredAt: number, throughElapsedSeconds: number): BallWorldBaseControlWindow | null => {
  if (![acquiredAt, throughElapsedSeconds].every(Number.isFinite) || acquiredAt < 0 || throughElapsedSeconds < acquiredAt)
    throw new Error('live appeal continuous control clock differs');
  let coveredThrough = acquiredAt, endInclusive = false;
  for (const window of [...windows].sort((a, b) => a.startElapsedSeconds - b.startElapsedSeconds || b.endElapsedSeconds - a.endElapsedSeconds)) {
    if (window.startElapsedSeconds === window.endElapsedSeconds && !window.endInclusive
      || window.endElapsedSeconds < acquiredAt || window.endElapsedSeconds === acquiredAt && !window.endInclusive) continue;
    if (window.startElapsedSeconds > coveredThrough) return null;
    if (window.endElapsedSeconds > coveredThrough) {
      coveredThrough = window.endElapsedSeconds; endInclusive = window.endInclusive;
    } else if (window.endElapsedSeconds === coveredThrough) endInclusive ||= window.endInclusive;
    if (coveredThrough > throughElapsedSeconds || coveredThrough === throughElapsedSeconds && endInclusive)
      return freeze({ startElapsedSeconds: acquiredAt, endElapsedSeconds: throughElapsedSeconds, endInclusive: true });
  }
  return null;
};
/** A Native-replayed physical receipt. Eligibility remains an explicit missing
 * legal-owner dependency; neither receipt nor throw contact declares a valid OUT. */
export const deriveSamePaLiveAppealContact = (source: SamePaPhysicalFieldStepSource, root: SamePaPhysicalFieldRoot,
  previous: Field, prefix: readonly Field[], match: CanonicalMatchState, defenderIds: readonly string[], batterRunnerId: string): SamePaLiveAppealContact => {
  const a=source.action; if(a?.kind!=='appeal_contact_v1') throw new Error('live appeal contact Source missing'); samePaLiveAppealInput(a);
  if(source.throughTick!==previous.evaluationTick || root.physicalPitchSourceId!==previous.physicalPitchSourceId
    || previous.timeline.status.kind!=='batted_ball_pending') throw new Error('live appeal current physical cut differs');
  same(prefix[0],root); same(prefix.at(-1),previous);
  const indication=linked(prefix,a.indicationReference), i=indication.actionResult, plan=linked(prefix,a.throwPlanReference), p=plan.actionResult;
  if(i?.kind!=='appeal_indication_v1' || indication.source.action?.kind!=='appeal_indication_v1'
    || p?.kind!=='throw_plan_v1' || plan.source.action?.kind!=='throw_plan_v1') throw new Error('live appeal original indication or throw plan differs');
  same(deriveSamePaLiveAppealIndication(indication.source,root,indication,match,defenderIds),i);
  same(p.appealIndicationReference,a.indicationReference); same(plan.source.action.appealIndicationReference,a.indicationReference);
  if(p.plan.input.carrierPlayerId!==i.throwerId || p.plan.input.receiverPlayerId!==i.defenderId
    || plan.operationOrdinal<=indication.operationOrdinal || prefix.some(f=>f.kind==='same_pa_physical_field_step_v1'
      && f.actionResult?.kind==='appeal_contact_v1' && f.actionResult.indicationReference.sourceId===indication.source.sourceId
      && f.actionResult.execution.kind==='executed')) throw new Error('live appeal target differs or physical attempt already executed');
  const result=(execution: SamePaLiveAppealExecution): SamePaLiveAppealContact => freeze({kind:a.kind,indicationReference:a.indicationReference,throwPlanReference:a.throwPlanReference,execution});
  const pending=(reason:string)=>result({kind:'pending',reason});
  const releases=prefix.filter(f=>f.kind==='same_pa_physical_field_step_v1' && f.actionResult?.kind==='throw_checkpoint_v1'
    && json(f.actionResult.planReference)===json(a.throwPlanReference) && f.actionResult.progress.kind==='released');
  if(releases.length!==1) return pending('original_appeal_throw_release_required');
  const evidence=deriveSamePaFieldRuleEvidence({fields:prefix,batterRunnerId,defenderIds,occupiedRunnerIds:Object.values(match.bases).filter((id):id is string=>id!==null),outsAtStart:match.outs});
  const ball=evidence.physical.field.evidence, motion=previous.field.motion, moment=at(previous);
  if(!motion.cursor || motion.response.kind!=='carried' || motion.carrierPlayerId!==i.defenderId
    || evidence.rule.possessionEvidence.pending.length) return pending('original_appeal_receiver_control_required');
  same(motion.cursor,motion.response.cursor); same(motion.cursor.moment,ball.horizon);
  if(prefix.some(f=>f.kind==='same_pa_physical_field_step_v1' && f.operationOrdinal>plan.operationOrdinal
    && f.actionResult?.kind==='throw_plan_v1')) return pending('original_appeal_linked_throw_custody_required');
  const reception=ball.acquisitions.find(c=>c.kind==='secured' && c.moment.elapsedSeconds>=at(releases[0]).elapsedSeconds);
  if(!reception || reception.kind!=='secured' || reception.acquirerPlayerId!==i.defenderId) return pending('original_appeal_receiver_capture_required');
  if(evidence.rule.ballEvidence.kind!=='fly_catch') return pending('original_fly_catch_required');
  const first=ball.contacts.find(f=>f.contacts.some(c=>c.kind==='actor'&&defenderIds.includes(c.playerId))), touch=first?.contacts[0];
  if(!first || first.contacts.length!==1 || touch?.kind!=='actor' || !defenderIds.includes(touch.playerId)) return pending('original_first_fielder_touch_required');
  same(evidence.rule.ballEvidence.firstFielderTouch,{fielderId:touch.playerId,tick:first.moment.ball.tick,ballCenter:first.moment.ball.position});
  const bag=root.geometry.baseGeometry.bases[i.base];
  const history=(playerId:string)=>deriveBallWorldPlayerBaseContactHistory({segments:evidence.physical.segments,playerId,base:bag.region,baseSurfaceHeightMeters:bag.surfaceHeightMeters});
  const complianceEvidence: BallWorldAppealComplianceEvidence={kind:'ball_world_tag_up_history_v1',history:history(i.runnerId),originBase:i.base,
    firstTouch:{fact:createFlyBallFirstFielderTouchFact(touch.playerId,first.moment.ball.tick),originTick:first.moment.originTick,elapsedSeconds:first.moment.elapsedSeconds}};
  const compliance=evaluateBallWorldTagUpCompliance(complianceEvidence); if(compliance.kind==='pending') return pending(compliance.reason);
  const defenderHistory=history(i.defenderId), windows=evidence.physical.controlWindows.filter(w=>w.playerId===i.defenderId).map(({playerId:_,...w})=>w);
  findBallWorldControlledBaseContacts({history:defenderHistory,controlWindows:windows});
  const control=samePaContinuousAppealControl(windows,reception.moment.elapsedSeconds,moment.elapsedSeconds);
  if(!control) return pending('original_appeal_current_control_required');
  let fact: ControlledBaseContactFact | ControlledRunnerTagFact;
  if(i.contact==='base') {
    if(!defenderHistory.contactAtHorizon) return pending('original_appeal_current_base_contact_required');
    fact=createControlledBaseContactFact(i.defenderId,number[i.base],moment.tick);
  } else {
    validatePiecewiseFieldActors(root.response,ball.horizon,motion.actors);
    const glove=motion.actors.find(a=>a.playerId===i.defenderId&&a.primitive.role==='glove')!,body=motion.actors.find(a=>a.playerId===i.runnerId&&a.primitive.role==='body')!;
    const sample=(actor:typeof glove)=>({tick:moment.tick,...samplePiecewiseFieldActor(actor,ball.horizon),acceleration:actor.primitive.acceleration,radius:actor.primitive.radius});
    if(findAcceleratedSphereContactSeconds(sample(glove),sample(body),0,'include')===null) return pending('original_appeal_current_body_contact_required');
    fact=createControlledRunnerTagFact(i.defenderId,i.runnerId,moment.tick);
  }
  if(moment.originTick!==i.indicatedAt.originTick || moment.elapsedSeconds<i.indicatedAt.elapsedSeconds) throw new Error('live appeal execution precedes its indication');
  return result({kind:'executed',attempt:createDefensiveAppealAttemptFact(i.defenderId,i.runnerId,number[i.base],'tag_up_early_departure',moment.tick),
    complianceEvidence,moment,indicatedAt:i.indicatedAt,contact:{kind:i.contact,fact,control},rights:{kind:'pending',reason:'original_live_ball_and_appeal_rights_required'}});
};


/** Physical intent inventory from the authenticated field prefix. Completing
 * this source consumes only the targeted physical act. Its unresolved legal
 * rights stay in the receipt for the original rule owner to admit separately. */
export const deriveSamePaLiveAppealCensus = (prefix: readonly Field[]) => {
  type Entry = { indicationReference: StepRef; indication: SamePaLiveAppealIndication;
    execution?: { executionReference: StepRef; throwPlanReference: StepRef;
      execution: Extract<SamePaLiveAppealExecution, { kind: 'executed' }> } };
  const entries = new Map<string, Entry>();
  const original: Field[] = [];
  for (const field of prefix) {
    const a = field.kind === 'same_pa_physical_field_step_v1' ? field.source.action : undefined;
    const r = field.kind === 'same_pa_physical_field_step_v1' ? field.actionResult : undefined;
    if (a?.kind === 'appeal_indication_v1' || r?.kind === 'appeal_indication_v1') {
      if (field.kind !== 'same_pa_physical_field_step_v1' || a?.kind !== 'appeal_indication_v1' || r?.kind !== 'appeal_indication_v1'
        || entries.has(field.source.sourceId)) throw new Error('live appeal census original indication differs');
      samePaLiveAppealInput(a);
      same(r, { kind: a.kind, throwerId: a.member.playerId, defenderId: a.defenderId,
        runnerId: a.runnerId, base: a.base, contact: a.contact, indicatedAt: at(field) });
      entries.set(field.source.sourceId, { indicationReference: reference('pa_physical_v1_field_steps', field), indication: r });
    } else if (a?.kind === 'throw_plan_v1' && a.appealIndicationReference) {
      same(bindSamePaAppealThrow(field.source as SamePaPhysicalFieldStepSource, original),
        r?.kind === 'throw_plan_v1' ? r.appealIndicationReference : null);
    } else if (a?.kind === 'appeal_contact_v1' || r?.kind === 'appeal_contact_v1') {
      if (field.kind !== 'same_pa_physical_field_step_v1' || a?.kind !== 'appeal_contact_v1' || r?.kind !== 'appeal_contact_v1')
        throw new Error('live appeal census original contact differs');
      samePaLiveAppealInput(a);
      same(a.indicationReference, r.indicationReference); same(a.throwPlanReference, r.throwPlanReference);
      const entry = entries.get(a.indicationReference.sourceId), plan = linked(original, a.throwPlanReference);
      if (!entry || plan.actionResult?.kind !== 'throw_plan_v1' || entry.execution)
        throw new Error('live appeal census original intent missing or already executed');
      same(entry.indicationReference, a.indicationReference);
      same(plan.actionResult.appealIndicationReference, a.indicationReference);
      if (r.execution.kind === 'executed') {
        const e = r.execution, i = entry.indication;
        same(e.moment, at(field)); same(e.indicatedAt, i.indicatedAt);
        same(e.attempt, createDefensiveAppealAttemptFact(i.defenderId, i.runnerId, number[i.base], 'tag_up_early_departure', e.moment.tick));
        same(e.contact.kind, i.contact);
        same(e.contact.fact, i.contact === 'base' ? createControlledBaseContactFact(i.defenderId, number[i.base], e.moment.tick)
          : createControlledRunnerTagFact(i.defenderId, i.runnerId, e.moment.tick));
        if (e.moment.originTick !== i.indicatedAt.originTick || e.moment.elapsedSeconds < i.indicatedAt.elapsedSeconds)
          throw new Error('live appeal census execution precedes indication');
        entry.execution = { executionReference: reference('pa_physical_v1_field_steps', field), throwPlanReference: a.throwPlanReference, execution: e };
      }
    }
    if (a?.kind === 'appeal_indication_v1' || a?.kind === 'appeal_contact_v1') {
      const previous = original.at(-1);
      if (!previous) throw new Error('live appeal census previous physical cut missing');
      same(field.field, previous.field);
    }
    original.push(field);
  }
  const pending = [...entries.values()].filter(e => !e.execution).map(({ indicationReference, indication }) => ({ indicationReference, indication }));
  const executed = [...entries.values()].flatMap(e => e.execution ? [{ indicationReference: e.indicationReference, ...e.execution }] : []);
  const sources: LivePlaySource[] = [...entries.values()].map(e => {
    const sourceId = json(['live_appeal_physical', e.indicationReference.sourceId]);
    return { sourceId, revision: e.execution ? 2 : 1, queue: null, physical: [], information: [], decisions: [], ruleWindows: [],
      intents: e.execution ? [] : [{ workId: sourceId, kind: 'issued_intent', actorId: e.indication.defenderId,
        dueTick: e.indication.indicatedAt.tick, actionKey: json(e.indicationReference) }],
      ...(e.execution ? { completion: { completedAtTick: e.execution.execution.moment.tick, basisEventId: e.execution.executionReference.sourceId } } : {}) };
  });
  return freeze({ pending, executed, sources });
};
