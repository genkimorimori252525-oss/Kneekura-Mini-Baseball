import type { ActorPlayDisposition } from '../../core/sim/liveAction/ActionFrontier';
import type { LivePlaySource } from '../../core/sim/liveAction/LivePlayRegistry';
import type { ActualLiveProducerDomain } from './ActualLivePlayScope';
import type { OwnedActualDefensiveDecisionLiveWork } from './SqliteActualDefensiveDecisionLiveWork';
export type ActualLiveFutureControllerWork = Readonly<{
  controllerDecisions?: readonly OwnedActualDefensiveDecisionLiveWork[];
  controllerFirstSteps?: readonly OwnedActualDefensiveDecisionLiveWork[];
}>;
/** Pure retention of already authenticated Native decision-owner output. It
 * creates no schedules, retires no work and does not certify queue coverage. */
export const retainActualLiveFutureControllerWork = (work: readonly OwnedActualDefensiveDecisionLiveWork[], throughTick: number): ActualLiveFutureControllerWork => {
  if (work.some(w => [...w.work.source.decisions, ...w.work.source.intents].some(p => p.dueTick <= throughTick))) {
    throw new Error('due original controller work cannot be retained as future');
  }
  const controllerDecisions = work.filter(w => w.work.source.decisions.length > 0);
  const controllerFirstSteps = work.filter(w => w.work.source.intents.length > 0);
  // Omit absent collections so existing empty-work receipt bytes stay unchanged.
  return { ...(controllerDecisions.length ? { controllerDecisions } : {}),
    ...(controllerFirstSteps.length ? { controllerFirstSteps } : {}) };
};
export const actualLiveFutureControllerProducer = (domain: ActualLiveProducerDomain, playerId: string | null,
  future: ActualLiveFutureControllerWork): Pick<LivePlaySource, 'decisions' | 'intents'> & { nextPendingTick: number | null } => {
  const decisions = domain === 'actor_decision' ? (future.controllerDecisions ?? [])
    .filter(w => w.work.playerId === playerId).flatMap(w => w.work.source.decisions) : [];
  const intents = domain === 'motor_issuance' ? (future.controllerFirstSteps ?? [])
    .filter(w => w.work.playerId === playerId).flatMap(w => w.work.source.intents) : [];
  const ticks = [...decisions, ...intents].map(w => w.dueTick);
  return { decisions, intents, nextPendingTick: ticks.length ? Math.min(...ticks) : null };
};
export const actualLiveFutureControllerDisposition = (playerId: string, future: ActualLiveFutureControllerWork): ActorPlayDisposition => {
  const decision = actualLiveFutureControllerProducer('actor_decision', playerId, future).decisions[0];
  if (decision) return { actorId: playerId, kind: 'decision_pending', dueTick: decision.dueTick };
  const intent = actualLiveFutureControllerProducer('motor_issuance', playerId, future).intents[0];
  return intent ? { actorId: playerId, kind: 'waiting_on_pending_trigger', triggerId: intent.workId }
    : { actorId: playerId, kind: 'acting' };
};
