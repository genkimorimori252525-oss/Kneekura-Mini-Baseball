import { expect, it } from 'vitest';
import { deriveActualDefensiveDecisionLiveWork } from '../../core/sim/liveAction/ActualDefensiveDecisionLiveWork';
import { retainActualLiveFutureControllerWork, actualLiveFutureControllerProducer, actualLiveFutureControllerDisposition } from './ActualLiveFutureControllerWork';
import type { OwnedActualDefensiveDecisionLiveWork } from './SqliteActualDefensiveDecisionLiveWork';
const moment = (tick: number) => ({ originTick: 100, elapsedSeconds: (tick - 100) / 100, tick });
const owned = (playerId: string, phase: 'pending_decision' | 'pending_first_step' | 'issued'): OwnedActualDefensiveDecisionLiveWork => {
  const decisionSourceId = `${playerId}-decision`, at = moment(102), delay = phase === 'pending_decision' ? 8 : 0;
  return { decisionSourceId, decisionHash: `${playerId}-hash`, observationHash: 'observation-hash', decisionModelSourceId: 'model', decisionModelHash: 'model-hash', planSourceId: 'plan', planHash: 'plan-hash',
    work: deriveActualDefensiveDecisionLiveWork({ physicalPitchSourceId: 'pitch', playerId, originDecisionSourceId: decisionSourceId, decisionSourceId, revision: 1,
      originObservationSourceId: `${playerId}-observation`, ticksPerSecond: 100, availableAt: at,
      cut: { observationSourceId: `${playerId}-observation`, baseFieldSourceId: 'field', executionSourceId: 'cut', at },
      scheduling: { startedAtTick: 102, decisionDelayTicks: delay, decisionTick: 102 + delay, firstStepDelayTicks: phase === 'issued' ? 0 : 10, movementStartTick: phase === 'issued' ? 102 : 112 + delay },
      lifecycle: { status: phase, issuedAt: phase === 'issued' ? at : null, issuedBySourceId: phase === 'issued' ? decisionSourceId : null }, intentKind: 'hold', evidence: null }) };
};
it('retains a second defender’s original pending decision and both exact deadlines beyond the end cut', () => {
  const first = owned('first-defender', 'issued'), second = owned('second-defender', 'pending_decision');
  const future = retainActualLiveFutureControllerWork([first, second], 105);
  expect(future.controllerDecisions).toEqual([second]);
  expect(future).not.toHaveProperty('controllerFirstSteps');
  const producer = actualLiveFutureControllerProducer('actor_decision', 'second-defender', future);
  expect(producer.decisions).toEqual(second.work.source.decisions); expect(producer.intents).toEqual([]);
  expect(producer.nextPendingTick).toBe(110);
  expect(future.controllerDecisions![0].work.deadlines).toEqual({ decision: moment(110), firstStep: moment(120) });
  expect(actualLiveFutureControllerDisposition('second-defender', future)).toEqual({ actorId: 'second-defender', kind: 'decision_pending', dueTick: 110 });
});
it('retains the original first-step intent and action identity in its actual motor producer', () => {
  const second = owned('second-defender', 'pending_first_step');
  const future = retainActualLiveFutureControllerWork([owned('first-defender', 'issued'), second], 105);
  expect(future.controllerFirstSteps).toEqual([second]); expect(future).not.toHaveProperty('controllerDecisions');
  const producer = actualLiveFutureControllerProducer('motor_issuance', 'second-defender', future);
  expect(producer.intents).toEqual(second.work.source.intents); expect(producer.decisions).toEqual([]); expect(producer.nextPendingTick).toBe(112);
  expect(actualLiveFutureControllerDisposition('second-defender', future)).toEqual({ actorId: 'second-defender', kind: 'waiting_on_pending_trigger', triggerId: second.work.source.intents[0].workId });
  expect(actualLiveFutureControllerProducer('actor_decision', 'second-defender', future).nextPendingTick).toBeNull();
});
it('rejects due work instead of silently omitting it and preserves absent-field bytes for issued actors', () => {
  expect(() => retainActualLiveFutureControllerWork([owned('second-defender', 'pending_decision')], 110)).toThrow(/due/);
  expect(() => retainActualLiveFutureControllerWork([owned('second-defender', 'pending_first_step')], 112)).toThrow(/due/);
  expect(retainActualLiveFutureControllerWork([owned('first-defender', 'issued')], 105)).toEqual({});
  expect(actualLiveFutureControllerDisposition('first-defender', {})).toEqual({ actorId: 'first-defender', kind: 'acting' });
  expect(actualLiveFutureControllerProducer('body_motion', 'second-defender', retainActualLiveFutureControllerWork([owned('second-defender', 'pending_decision')], 105)))
    .toEqual({ decisions: [], intents: [], nextPendingTick: null });
});
