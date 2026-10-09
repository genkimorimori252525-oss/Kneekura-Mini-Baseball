import type { ActualObservationMoment } from './ActualFieldObservation';
import type { SamePaPhysicalAction, SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep, SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import { samePaFields as fields, samePaText as text, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorFreeze as freeze, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

type Field = SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep;
type StepReference = SamePaReference<'pa_physical_v1_field_steps'>;
export type SamePaOrdinaryPlayAuthority = Pick<SamePaPhysicalAction, 'actor' | 'physicalPitchSourceId'>;
/** Accepted purpose names the attempted retirement, never its physical or legal outcome. */
export type SamePaOrdinaryPlayPurpose = Readonly<{ kind: 'ordinary_play_attempt_v1'; runnerId: string;
  targetBase: 'first' | 'second' | 'third' | 'home'; intent: 'attempt_retirement' }>;
export type SamePaOrdinaryPlayAttempt = Readonly<{ kind: 'ordinary_play_attempt_v1';
  planReference: StepReference; releaseReference: StepReference; throwerId: string; receiverPlayerId: string;
  purpose: SamePaOrdinaryPlayPurpose; moment: ActualObservationMoment }>;
export const samePaOrdinaryPlayPurposeValid = (value: unknown): value is SamePaOrdinaryPlayPurpose =>
  fields(value, ['kind', 'runnerId', 'targetBase', 'intent']) && value.kind === 'ordinary_play_attempt_v1'
  && text(value.runnerId) && typeof value.targetBase === 'string' && ['first', 'second', 'third', 'home'].includes(value.targetBase)
  && value.intent === 'attempt_retirement';
const same = (a: unknown, b: unknown) => {
  if (a !== b && (a === undefined || b === undefined || json(a) !== json(b))) throw new Error('ordinary play original linkage differs');
};

/** Original offensive membership and target geometry come from the accepted
 * action, not a caller-supplied roster or an inferred result of the throw. */
export const bindSamePaOrdinaryPlayPurpose = (source: SamePaPhysicalFieldStepSource, root: SamePaPhysicalFieldRoot,
  action: SamePaOrdinaryPlayAuthority): SamePaOrdinaryPlayPurpose | undefined => {
  const a = source.action;
  if (a?.kind !== 'throw_plan_v1' || !('ordinaryPlayPurpose' in a)) return undefined;
  const purpose = a.ordinaryPlayPurpose, actor = action.actor;
  if (!samePaOrdinaryPlayPurposeValid(purpose) || 'appealIndicationReference' in a)
    throw new Error('invalid ordinary play throw purpose');
  const defenderIds = actor.defenderBindings.map(d => d.playerId);
  const runner = purpose.runnerId === actor.binding.playerId
    || Object.values(actor.match.bases).filter(id => id === purpose.runnerId).length === 1
      && actor.world.runners.filter(r => r.playerId === purpose.runnerId).length === 1;
  if (root.physicalPitchSourceId !== action.physicalPitchSourceId || actor.match.playId !== root.lineage.playId
    || !runner || defenderIds.includes(purpose.runnerId)
    || ![a.member.playerId, a.receiverPlayerId].every(id => defenderIds.filter(d => d === id).length === 1
      && actor.world.defenders.filter(d => d.playerId === id).length === 1)
    || a.member.playerId === a.receiverPlayerId || !root.geometry.baseGeometry.bases[purpose.targetBase])
    throw new Error('ordinary play original participant, pitch or target differs');
  return purpose;
};

/** Project only original actual release receipts from an authenticated prefix.
 * Native replay owns physical authenticity; the legal owner must separately
 * check live state at this exact moment. Planning, transfer and an interrupted
 * transfer are not attempts here. A released throw need not retire anyone. */
export const deriveSamePaOrdinaryPlayAttempts = (prefix: readonly Field[], action: SamePaOrdinaryPlayAuthority): readonly SamePaOrdinaryPlayAttempt[] => {
  const root = prefix[0];
  if (!root || root.kind !== 'same_pa_physical_field_root_v1') throw new Error('ordinary play original field root missing');
  const plans = new Map<string, SamePaPhysicalFieldStep>(), released = new Set<string>();
  const attempts: SamePaOrdinaryPlayAttempt[] = [];
  for (const field of prefix) {
    if (field.kind !== 'same_pa_physical_field_step_v1') continue;
    const a = field.source.action, r = field.actionResult;
    if (a?.kind === 'throw_plan_v1' || r?.kind === 'throw_plan_v1') {
      if (a?.kind !== 'throw_plan_v1' || r?.kind !== 'throw_plan_v1' || plans.has(field.source.sourceId))
        throw new Error('ordinary play original throw plan differs');
      const purpose = bindSamePaOrdinaryPlayPurpose(field.source, root, action);
      same('ordinaryPlayPurpose' in a, 'ordinaryPlayPurpose' in r);
      same(purpose, r.ordinaryPlayPurpose);
      if (purpose) {
        if ('appealIndicationReference' in r || field.physicalPitchSourceId !== root.physicalPitchSourceId
          || r.plan.input.carrierPlayerId !== a.member.playerId || r.plan.input.receiverPlayerId !== a.receiverPlayerId
          || r.plan.input.seed.playId !== root.lineage.playId || r.plan.input.seed.streamKey !== field.source.sourceId)
          throw new Error('ordinary play original physical plan differs');
      }
      plans.set(field.source.sourceId, field);
    } else if (r?.kind === 'throw_checkpoint_v1' && r.progress.kind === 'released') {
      const plan = plans.get(r.planReference.sourceId);
      if (a?.kind !== 'throw_checkpoint_v1' || !plan || plan.actionResult?.kind !== 'throw_plan_v1'
        || field.physicalPitchSourceId !== root.physicalPitchSourceId || field.operationOrdinal <= plan.operationOrdinal
        || released.has(plan.source.sourceId)) throw new Error('ordinary play original release differs');
      same(a.planReference, r.planReference); same(r.planReference, reference('pa_physical_v1_field_steps', plan));
      released.add(plan.source.sourceId);
      const purpose = plan.actionResult.ordinaryPlayPurpose;
      if (!purpose) continue;
      const progress = r.progress, moment = progress.releaseCursor.moment, original = plan.actionResult.plan;
      same(progress.planIdentity, JSON.stringify(original)); same(field.field, progress.field);
      if (moment.originTick !== original.input.cursor.moment.originTick || moment.elapsedSeconds !== original.releaseElapsedSeconds
        || moment.ball.tick !== progress.launch.releaseTick || moment.ball.tick !== field.evaluationTick
        || moment.elapsedSeconds > a.throughElapsedSeconds) throw new Error('ordinary play original release moment differs');
      attempts.push({ kind: 'ordinary_play_attempt_v1', planReference: r.planReference,
        releaseReference: reference('pa_physical_v1_field_steps', field), throwerId: original.input.carrierPlayerId,
        receiverPlayerId: original.input.receiverPlayerId, purpose,
        moment: { originTick: moment.originTick, elapsedSeconds: moment.elapsedSeconds, tick: moment.ball.tick } });
    }
  }
  return freeze(attempts);
};
