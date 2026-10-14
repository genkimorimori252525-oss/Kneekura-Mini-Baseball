import { expect, it } from 'vitest';
import { deriveReceivedUmpireDefenderReplan, quantizeEventTick,
  type ReceivedUmpireDefenderReplanInput, type ReceivedUmpireCallMoment, type ReceivedUmpireCallContent,
} from '../../index';
import type { ReceivedCommunication } from '../perception/Communication';

const at = (elapsedSeconds: number): ReceivedUmpireCallMoment => ({ originTick: 1_000, elapsedSeconds,
  tick: quantizeEventTick(1_000, elapsedSeconds, 1_000) });

/** Explicit synthetic internal dependencies; no Native continuity/admission or motor issuance is asserted. */
function inputAtDecision(): ReceivedUmpireDefenderReplanInput {
  const calledAt = at(0.119), receivedAt = at(0.1202), observedAt = at(0.1204);
  const received: ReceivedCommunication<ReceivedUmpireCallContent> = { event: {
    sourceId: 'umpire', targetScope: { kind: 'nearby' }, kind: 'callout', issuedAt: calledAt.tick,
    content: { callSourceId: 'call', call: 'safe', calledAt,
      onFieldCall: { callId: 'on-field-call', tick: calledAt.tick, basisSnapshotId: 'umpire-perception', basisEvidenceRevision: 1,
        ruling: { outsAfter: 0, basesAfter: { first: 'batter', second: null, third: null }, scoredRunnerIds: [] } } },
  }, receivedAt: receivedAt.tick, confidence: 0.8 };
  return {
    processSourceId: 'replan-decision', physicalPitchSourceId: 'pitch', playerId: 'defender', receiverRole: 'defender',
    ticksPerSecond: 1_000, currentCut: at(0.126), previous: null,
    communication: { sourceId: 'communication-received', hash: 'communication-received-hash', originCommunicationSourceId: 'communication-origin', callSourceId: 'call' },
    observation: { sourceId: 'observation-call', hash: 'observation-call-hash', at: observedAt,
      reception: { kind: 'received', receivedAt, order: null, received },
      perceived: { observerId: 'defender', observationTime: observedAt.tick,
        attention: { target: { kind: 'ball' }, focusedSinceTick: 1_000 }, players: [], communications: [received], knownContext: null,
        ball: { estimate: { position: { x: 8, y: 0.3, z: 13 }, velocity: { x: 1, y: -0.1, z: 2 } },
          sourceObservedAt: 1_119, predictedAt: observedAt.tick, confidence: 0.8 } } },
    predecessor: { originDecisionSourceId: 'initial-1', originObservationSourceId: 'observation-origin', originObservationHash: 'observation-origin-hash',
      availability: at(0.1002), informationOrder: null, observationSourceId: 'observation-issued', observationHash: 'observation-issued-hash',
      observedThrough: at(0.110), decisionTick: 1_106, issuedAt: at(0.110),
      command: { sourceId: 'initial-issued', hash: 'initial-issued-hash', selected: { intent: { kind: 'ball_handler' }, localPriority: 0.28,
        evidenceAvailableAt: 1_100, evidenceKinds: ['observed_ball', 'accepted_contextual_priorities'] }, target: { x: 4, z: 9 } },
      motor: { sourceId: 'initial-motor', hash: 'initial-motor-hash', adoptionSourceId: 'physical-adoption', adoptedAt: at(0.110) } },
    model: { sourceId: 'decision-model', hash: 'decision-model-hash', situationalAwareness: 0.5, firstStepAbility: 0.5,
      minimumCueConfidence: 0.5, communicationTrust: 0.75,
      decisionTimingParameters: { minimumDecisionDelayTicks: 2, maximumDecisionDelayTicks: 6, fixedProcessingOffsetTicks: 1 },
      firstStepTimingParameters: { minimumFirstStepDelayTicks: 2, maximumFirstStepDelayTicks: 4, fixedMotorOffsetTicks: 1 } },
    contextualPlan: { sourceId: 'contextual-plan', hash: 'contextual-plan-hash', priorities: { ballPursuitPriority: 0.35,
      baseCoverPriorities: [], relayPriority: 0, backupPriority: 0, deepCoveragePriority: 0, holdPriority: 0.1 } },
    policy: { sourceId: 'call-policy', hash: 'call-policy-hash', availableAt: at(0.119),
      profiles: { out: null, safe: { ballPursuitPriority: 0.9, holdPriority: 0.1 } } },
  };
}

it.each([0.130, 0.131, 0.13000000000001])('retains a pending renewal handoff at exact cut %s after timely cognition', elapsed => {
  const input = inputAtDecision(), committed = deriveReceivedUmpireDefenderReplan(input);
  expect(committed.phase).toBe('pending_first_step');
  expect(committed.selectedAt).toEqual(at(0.126));
  expect(committed.scheduling?.decisionTick).toBe(1_126);
  expect(committed.scheduling?.movementStartTick).toBe(1_130);
  const currentCut = at(elapsed), perceived = input.observation.perceived;
  if (elapsed === 0.13000000000001) expect(currentCut.tick).toBe(at(0.130).tick);
  const result = deriveReceivedUmpireDefenderReplan({ ...input, processSourceId: 'replan-renewal-read', previous: committed, currentCut,
    communication: { ...input.communication, sourceId: 'communication-next', hash: 'communication-next-hash' },
    observation: { ...input.observation, sourceId: 'observation-current', hash: 'observation-current-hash', at: currentCut,
      perceived: { ...perceived, observationTime: currentCut.tick, ball: { ...perceived.ball!, predictedAt: currentCut.tick } } } });
  expect(result.selectedAt).toEqual(committed.selectedAt);
  expect(result.scheduling).toEqual(committed.scheduling);
  expect(result.retainedCommand).toEqual(input.predecessor.command);
  expect(result.work).toEqual([{ kind: 'renewal_adoption', sourceId: 'replan-renewal-read', cause: committed.cause, dueTick: 1_130 }]);
  expect(result).not.toHaveProperty('physicalAdoption');
  expect(result.phase).toBe('renewal_due');
});
