/**
 * TEST-ONLY proposed adapter contract, frozen source 1093402.
 * Register these cases with the REAL callable adapter in a future .test.ts driver.
 * There is deliberately no fake implementation, loader, production stub, or Native proof.
 * All numbers/identities below are explicit synthetic fixtures, never production defaults.
 */
import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../../model/geometry';
import { quantizeEventTick } from '../ExactEventTime';
import type { ReceivedCommunication } from '../perception/Communication';
import { buildPlayerPerceivedWorldState, type PlayerPerceivedWorldState } from '../perception/PlayerPerceivedWorldState';
import { chooseDefensiveIntentCandidate, generateDefensiveIntentCandidates, type DefensiveIntentCandidate, type PrePlayDefensivePlan } from './DefensiveDecision';
import { findNextDefensiveReplanTick } from './DefensiveReplan';
import { resolveDefensiveDecisionTiming, type DefensiveDecisionTimingParameters } from './DefensiveDecisionTiming';
import { resolveDefenderFirstStepTiming, type DefenderFirstStepTimingParameters } from './DefenderFirstStepTiming';
import type { ActualCallCommunicationContent } from '../../../host/world/ActualCallCommunication';

/** Internal, authenticated-shaped dependency data. Never an accepted caller Source API. */
export type ReceivedCallContractMoment = Readonly<{ originTick: number; elapsedSeconds: number; tick: number }>;
type Order = Readonly<{ sequenceOwnerSourceId: string; sequence: number }> | null;
type Profile = Readonly<{ ballPursuitPriority: number; holdPriority: number }>;
type Cause = Readonly<{ physicalPitchSourceId: string; callSourceId: string; originCommunicationSourceId: string; playerId: string }>;
type Reception = Readonly<{ kind: 'scheduled'; dueAt: ReceivedCallContractMoment }>
  | Readonly<{ kind: 'received'; receivedAt: ReceivedCallContractMoment; order: Order;
      received: ReceivedCommunication<ActualCallCommunicationContent> }>;
export type ReceivedCallContractInput = Readonly<{
  processSourceId: string;
  physicalPitchSourceId: string;
  playerId: string;
  receiverRole: 'defender' | 'batter';
  ticksPerSecond: number;
  currentCut: ReceivedCallContractMoment;
  communication: Readonly<{ sourceId: string; hash: string; originCommunicationSourceId: string; callSourceId: string }>;
  observation: Readonly<{ sourceId: string; hash: string; at: ReceivedCallContractMoment;
    perceived: PlayerPerceivedWorldState<null>; reception: Reception }>;
  predecessor: Readonly<{
    originDecisionSourceId: string; originObservationSourceId: string; originObservationHash: string;
    /** Frozen information cut that actually selected the incumbent command. */
    availability: ReceivedCallContractMoment; informationOrder: Order;
    /** Later progress metadata is NOT a new semantic information cut. */
    observationSourceId: string; observationHash: string; observedThrough: ReceivedCallContractMoment;
    decisionTick: number; issuedAt: ReceivedCallContractMoment;
    command: Readonly<{ sourceId: string; hash: string; selected: DefensiveIntentCandidate; target: Vec2 | null }>;
    motor: Readonly<{ sourceId: string; hash: string; adoptionSourceId: string | null; adoptedAt: ReceivedCallContractMoment | null }>;
  }>;
  model: Readonly<{ sourceId: string; hash: string; situationalAwareness: number; firstStepAbility: number;
    minimumCueConfidence: number; communicationTrust: number;
    decisionTimingParameters: DefensiveDecisionTimingParameters; firstStepTimingParameters: DefenderFirstStepTimingParameters }>;
  contextualPlan: Readonly<{ sourceId: string; hash: string; priorities: PrePlayDefensivePlan }>;
  policy: Readonly<{ sourceId: string; hash: string; availableAt: ReceivedCallContractMoment;
    profiles: Readonly<{ out: Profile | null; safe: Profile | null }> }> | null;
  previous: ReceivedCallContractResult | null;
}>;
/** Frozen at the first eligible process, using only the already rederived internal inputs. */
export type ReceivedCallContractOriginEvidence = Readonly<Pick<ReceivedCallContractInput,
  'physicalPitchSourceId' | 'playerId' | 'receiverRole' | 'ticksPerSecond' | 'communication' | 'observation' | 'model' | 'contextualPlan'> & {
  predecessor: Pick<ReceivedCallContractInput['predecessor'],
    'originDecisionSourceId' | 'originObservationSourceId' | 'originObservationHash' | 'availability' | 'informationOrder' | 'command' | 'motor'>;
}>;
/** The only later binding allowed is null -> this explicit, genuinely available policy. */
export type ReceivedCallContractPolicyBinding = Readonly<{
  policy: NonNullable<ReceivedCallContractInput['policy']>;
  boundAt: ReceivedCallContractMoment;
}>;
export type ReceivedCallContractResult = Readonly<{
  processSourceId: string;
  cause: Cause | null;
  /** Retains perception/reception plus original owner IDs/hashes; latest observation is not a replacement. */
  originEvidence: ReceivedCallContractOriginEvidence | null;
  policyBinding: ReceivedCallContractPolicyBinding | null;
  trigger: 'no_new_trigger' | 'communication_received';
  semantic: 'ready' | 'call_profile_unavailable' | 'receiver_role_unavailable' | 'intent_adapter_unavailable' | 'predecessor_work_pending' | 'same_moment_order_unavailable';
  phase: 'pending_decision' | 'semantic_pending' | 'pending_first_step' | 'renewal_due' | 'missed_commitment' | null;
  originObservationSourceId: string | null;
  receivedAt: ReceivedCallContractMoment | null;
  availableAt: ReceivedCallContractMoment | null;
  scheduling: Readonly<{ startedAtTick: number; decisionDelayTicks: number; decisionTick: number;
    firstStepDelayTicks: number | null; movementStartTick: number | null }> | null;
  candidates: readonly DefensiveIntentCandidate[];
  /** A proposal may exist before the boundary; selectedAt is the actual decision commitment. */
  selected: DefensiveIntentCandidate | null;
  selectedAt: ReceivedCallContractMoment | null;
  target: Vec2 | null;
  retainedCommand: ReceivedCallContractInput['predecessor']['command'];
  work: readonly Readonly<{ kind: 'decision' | 'intent' | 'renewal_adoption'; sourceId: string; cause: Cause; dueTick: number }>[];
}>;
export type ReceivedCallContractSubject = (input: ReceivedCallContractInput) => ReceivedCallContractResult;

const clock = { originTick: 1_000, ticksPerSecond: 1_000 } as const;
const at = (elapsedSeconds: number): ReceivedCallContractMoment => ({ originTick: clock.originTick, elapsedSeconds,
  tick: quantizeEventTick(clock.originTick, elapsedSeconds, clock.ticksPerSecond) });
const plan: PrePlayDefensivePlan = { ballPursuitPriority: 0.35, baseCoverPriorities: [], relayPriority: 0,
  backupPriority: 0, deepCoveragePriority: 0, holdPriority: 0.1 };
const priorities = { out: { ballPursuitPriority: 0.1, holdPriority: 0.9 }, safe: { ballPursuitPriority: 0.9, holdPriority: 0.1 } };
const expectedCause: Cause = { physicalPitchSourceId: 'pitch', callSourceId: 'call', originCommunicationSourceId: 'communication-origin', playerId: 'defender' };
const callEvidence = 'received_umpire_call:call';

function fixture(call: 'out' | 'safe' = 'out'): ReceivedCallContractInput {
  const calledAt = at(0.119), receivedAt = at(0.1202), availableAt = at(0.1204);
  const received: ReceivedCommunication<ActualCallCommunicationContent> = {
    event: { sourceId: 'umpire', targetScope: { kind: 'nearby' }, kind: 'callout', issuedAt: calledAt.tick,
      content: { callSourceId: 'call', call, calledAt, onFieldCall: { callId: 'on-field-call', tick: calledAt.tick,
        basisSnapshotId: 'umpire-perception', basisEvidenceRevision: 1,
        ruling: { outsAfter: call === 'out' ? 1 : 0, basesAfter: { first: call === 'safe' ? 'batter' : null, second: null, third: null }, scoredRunnerIds: [] } } } },
    receivedAt: receivedAt.tick, confidence: 0.8,
  };
  const perceived = buildPlayerPerceivedWorldState<null>({ observerId: 'defender', observationTime: availableAt.tick,
    attention: { target: { kind: 'ball' }, focusedSinceTick: 1_000 },
    ball: { estimate: { position: { x: 8, y: 0.3, z: 13 }, velocity: { x: 1, y: -0.1, z: 2 } },
      sourceObservedAt: 1_119, predictedAt: availableAt.tick, confidence: 0.8 },
    players: [], communications: [received], knownContext: null });
  return {
    processSourceId: 'replan-1', physicalPitchSourceId: 'pitch', playerId: 'defender', receiverRole: 'defender',
    ticksPerSecond: clock.ticksPerSecond, currentCut: at(0.126),
    communication: { sourceId: 'communication-2', hash: 'communication-2-hash', originCommunicationSourceId: 'communication-origin', callSourceId: 'call' },
    observation: { sourceId: 'observation-call', hash: 'observation-call-hash', at: availableAt, perceived,
      reception: { kind: 'received', receivedAt, order: null, received } },
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
    contextualPlan: { sourceId: 'contextual-plan', hash: 'contextual-plan-hash', priorities: plan },
    policy: { sourceId: 'call-policy', hash: 'call-policy-hash', availableAt: at(0.119), profiles: priorities }, previous: null,
  };
}
function baseline(input: ReceivedCallContractInput): readonly DefensiveIntentCandidate[] {
  return generateDefensiveIntentCandidates({ perceivedWorld: input.observation.perceived, self: { playerId: input.playerId },
    prePlayPlan: input.contextualPlan.priorities, perceivedCues: [], minimumCueConfidence: input.model.minimumCueConfidence,
    communicationTrust: input.model.communicationTrust });
}
function withConfidence(input: ReceivedCallContractInput, confidence: number): ReceivedCallContractInput {
  const reception = input.observation.reception;
  if (reception.kind !== 'received') throw new Error('test fixture requires received communication');
  const received = { ...reception.received, confidence };
  return { ...input, observation: { ...input.observation, reception: { ...reception, received },
    perceived: { ...input.observation.perceived, communications: [received] } } };
}
function later(input: ReceivedCallContractInput, previous: ReceivedCallContractResult, elapsedSeconds: number): ReceivedCallContractInput {
  const moment = at(elapsedSeconds), perceived = input.observation.perceived;
  return { ...input, processSourceId: 'replan-2', previous, currentCut: moment,
    communication: { ...input.communication, sourceId: 'communication-3', hash: 'communication-3-hash' },
    observation: { ...input.observation, sourceId: 'observation-next', hash: 'observation-next-hash', at: moment,
      perceived: { ...perceived, observationTime: moment.tick,
        ball: perceived.ball ? { ...perceived.ball, predictedAt: moment.tick } : null } } };
}
/** Expected receipt data only: no decision, eligibility, availability, or priority calculation. */
function expectedOriginEvidence(input: ReceivedCallContractInput): ReceivedCallContractOriginEvidence {
  const predecessor = input.predecessor;
  return { physicalPitchSourceId: input.physicalPitchSourceId, playerId: input.playerId, receiverRole: input.receiverRole,
    ticksPerSecond: input.ticksPerSecond, communication: input.communication, observation: input.observation,
    model: input.model, contextualPlan: input.contextualPlan,
    predecessor: { originDecisionSourceId: predecessor.originDecisionSourceId,
      originObservationSourceId: predecessor.originObservationSourceId, originObservationHash: predecessor.originObservationHash,
      availability: predecessor.availability, informationOrder: predecessor.informationOrder,
      command: predecessor.command, motor: predecessor.motor } };
}
const contributions = (result: ReceivedCallContractResult) => result.candidates.filter(candidate => candidate.evidenceKinds.includes(callEvidence));
function expectNoCompletion(result: ReceivedCallContractResult): void {
  expect(result).not.toHaveProperty('consumed');
  expect(result).not.toHaveProperty('watermark');
  expect(result).not.toHaveProperty('playEnd');
  expect(result).not.toHaveProperty('physicalAdoption');
}

/** Bind only a real pure adapter. Native authentication and persistence are separate gates. */
export function registerReceivedUmpireDefenderReplanContractTests(derive: ReceivedCallContractSubject): void {
  describe('ReceivedUmpireDefenderReplan: existing-kernel controls', () => {
    it('keeps the actual callout payload uninterpreted by the legacy cover-base parser', () => {
      const input = fixture();
      expect(input.observation.perceived.communications[0].event.content).toEqual(input.observation.reception.kind === 'received' ? input.observation.reception.received.event.content : null);
      expect(baseline(input)).toHaveLength(2);
      expect(chooseDefensiveIntentCandidate(baseline(input)).intent).toEqual({ kind: 'ball_handler' });
      expect(baseline(input).flatMap(candidate => candidate.evidenceKinds)).not.toContain('communication:cover_base');
    });
    it('filters a future received tick before that communication enters PerceivedWorld', () => {
      const input = fixture(), world = input.observation.perceived;
      const result = buildPlayerPerceivedWorldState({ ...world, observationTime: 1_120,
        ball: world.ball ? { ...world.ball, predictedAt: 1_120 } : null });
      expect(result.communications).toEqual([]);
    });
  });
  describe('ReceivedUmpireDefenderReplan: explicit local profiles', () => {
    it('retains the real call identity and the baseline competitors while OUT locally selects hold', () => {
      const input = fixture(), result = derive(input);
      expect(result.trigger).toBe('communication_received');
      expect(result.cause).toEqual(expectedCause);
      expect(result.originEvidence).toEqual(expectedOriginEvidence(input));
      expect(result.policyBinding).toEqual({ policy: input.policy, boundAt: input.currentCut });
      expect(result.candidates).toEqual(expect.arrayContaining([...baseline(input)]));
      expect(result.selected).toEqual(chooseDefensiveIntentCandidate(result.candidates));
      expect(result.selected?.intent).toEqual({ kind: 'hold' });
      expect(result.target).toBeNull();
      expect(contributions(result).map(value => value.intent.kind).sort()).toEqual(['ball_handler', 'hold']);
      expectNoCompletion(result);
    });
    it('allows OUT to leave pursuit selected under an explicit profile', () => {
      const input = fixture();
      const result = derive({ ...input, policy: { ...input.policy!, profiles: { ...priorities, out: { ballPursuitPriority: 0.9, holdPriority: 0.2 } } } });
      expect(result.selected?.intent).toEqual({ kind: 'ball_handler' });
      expect(result.target).toEqual({ x: 8, z: 13 });
    });
    it('allows SAFE to select hold without issuing a runner advance command', () => {
      const input = fixture('safe');
      const result = derive({ ...input, policy: { ...input.policy!, profiles: { ...priorities, safe: { ballPursuitPriority: 0.1, holdPriority: 0.9 } } } });
      expect(result.selected?.intent).toEqual({ kind: 'hold' });
      expect(result.target).toBeNull();
      expect(result.candidates.every(value => value.intent.kind === 'ball_handler' || value.intent.kind === 'hold')).toBe(true);
    });
    it('uses only the active call branch and does not let SAFE priorities affect OUT', () => {
      const input = fixture(), original = derive(input);
      const changed = derive({ ...input, policy: { ...input.policy!, profiles: { ...priorities, safe: { ballPursuitPriority: 0, holdPriority: 0 } } } });
      expect(changed.candidates).toEqual(original.candidates);
      expect(changed.selected).toEqual(original.selected);
    });
    it('weights each supplied priority by reception confidence and original communication trust exactly once', () => {
      const result = derive(fixture());
      expect(contributions(result).find(value => value.intent.kind === 'hold')?.localPriority).toBeCloseTo(0.9 * 0.8 * 0.75, 14);
      expect(contributions(result).find(value => value.intent.kind === 'ball_handler')?.localPriority).toBeCloseTo(0.1 * 0.8 * 0.75, 14);
    });
    it.each([0.49, 0.5])('applies the original minimum confidence at %s without changing baseline candidates', confidence => {
      const input = withConfidence(fixture(), confidence), result = derive(input);
      expect(result.candidates).toEqual(expect.arrayContaining([...baseline(input)]));
      expect(contributions(result)).toHaveLength(confidence < input.model.minimumCueConfidence ? 0 : 2);
    });
    it('lets lower trust preserve baseline pursuit without suppressing the local reevaluation trace', () => {
      const input = fixture(), result = derive({ ...input, model: { ...input.model, communicationTrust: 0.1 } });
      expect(result.trigger).toBe('communication_received');
      expect(result.semantic).toBe('ready');
      expect(result.selected?.intent).toEqual({ kind: 'ball_handler' });
      expect(result.selectedAt).toEqual(input.currentCut);
    });
    it.each(['zero_trust', 'zero_priorities'] as const)('adds no call candidates for %s but still reevaluates locally', mode => {
      const input = fixture();
      const changed = mode === 'zero_trust' ? { ...input, model: { ...input.model, communicationTrust: 0 } }
        : { ...input, policy: { ...input.policy!, profiles: { ...priorities, out: { ballPursuitPriority: 0, holdPriority: 0 } } } };
      const result = derive(changed);
      expect(result.trigger).toBe('communication_received');
      expect(contributions(result)).toEqual([]);
      expect(result.selected).toEqual(chooseDefensiveIntentCandidate(baseline(changed)));
      expect(result.selectedAt).toEqual(input.currentCut);
    });
    it.each(['absent', 'below_gate'] as const)('does not invent a ball target when perception is %s', mode => {
      const input = fixture('safe'), perceived = input.observation.perceived;
      const result = derive({ ...input, observation: { ...input.observation, perceived: { ...perceived,
        ball: mode === 'absent' ? null : { ...perceived.ball!, confidence: 0.49 } } } });
      expect(result.candidates.some(value => value.intent.kind === 'ball_handler')).toBe(false);
      expect(result.selected?.intent).toEqual({ kind: 'hold' });
      expect(result.target).toBeNull();
    });
    it('uses the unchanged deterministic chooser for an exact profile tie', () => {
      const input = fixture();
      const result = derive({ ...input, policy: { ...input.policy!, profiles: { ...priorities, out: { ballPursuitPriority: 0.9, holdPriority: 0.9 } } } });
      expect(result.selected?.intent).toEqual({ kind: 'ball_handler' });
      expect(result.selected).toEqual(chooseDefensiveIntentCandidate([...result.candidates].reverse()));
    });
  });
  describe('ReceivedUmpireDefenderReplan: original information cut and exact timing', () => {
    it('starts no earlier than exact observation availability and reuses both latency kernels', () => {
      const input = fixture(), result = derive(input);
      const start = findNextDefensiveReplanTick(null, [{ kind: 'communication_received', perceivedAt: 1_121 }]);
      expect(start).toBe(1_121);
      const decision = resolveDefensiveDecisionTiming(start!, input.model.situationalAwareness, input.model.decisionTimingParameters);
      const motor = resolveDefenderFirstStepTiming(decision.decisionTick, input.model.firstStepAbility, input.model.firstStepTimingParameters);
      expect(result.receivedAt).toEqual(at(0.1202));
      expect(result.availableAt).toEqual(at(0.1204));
      expect(result.originObservationSourceId).toBe('observation-call');
      expect(result.scheduling).toEqual({ startedAtTick: start, decisionDelayTicks: decision.decisionDelayTicks,
        decisionTick: decision.decisionTick, firstStepDelayTicks: motor.firstStepDelayTicks, movementStartTick: motor.movementStartTick });
      expect(result.scheduling?.decisionTick).toBe(1_126);
      expect(result.scheduling?.movementStartTick).toBe(1_130);
      expect(result.selectedAt).toEqual(at(0.126));
      expect(result.phase).toBe('pending_first_step');
      expect(contributions(result).every(value => value.evidenceAvailableAt >= 1_121)).toBe(true);
    });
    it('retains the original command before the cognition boundary and does not issue a computed proposal', () => {
      const input = fixture(), beforeBytes = JSON.stringify(input.predecessor.command);
      const result = derive({ ...input, currentCut: at(0.125) });
      expect(result.phase).toBe('pending_decision');
      expect(result.selectedAt).toBeNull();
      expect(JSON.stringify(result.retainedCommand)).toBe(beforeBytes);
      expect(result.work).toContainEqual({ kind: 'decision', sourceId: result.processSourceId, cause: expectedCause, dueTick: 1_126 });
      expectNoCompletion(result);
    });
    it('exposes a renewal handoff only at first-step eligibility without claiming physical adoption', () => {
      const input = fixture(), committed = derive(input);
      const waiting = derive(later(input, committed, 0.129));
      const due = derive(later(input, committed, 0.130));
      expect(waiting.phase).toBe('pending_first_step');
      expect(waiting.work).toContainEqual({ kind: 'intent', sourceId: waiting.processSourceId, cause: expectedCause, dueTick: 1_130 });
      expect(due.phase).toBe('renewal_due');
      expect(due.work).toContainEqual({ kind: 'renewal_adoption', sourceId: due.processSourceId, cause: expectedCause, dueTick: 1_130 });
      expect(due.retainedCommand).toEqual(input.predecessor.command);
      expectNoCompletion(due);
    });
    it('does not substitute a newer initial observation hash or issuance time for the frozen information cut', () => {
      const input = fixture();
      const result = derive({ ...input, predecessor: { ...input.predecessor,
        observationSourceId: 'initial-progress-after-call', observationHash: 'initial-progress-after-call-hash',
        observedThrough: at(0.124), issuedAt: at(0.124),
        motor: { ...input.predecessor.motor, adoptedAt: at(0.124) } } });
      expect(result.trigger).toBe('communication_received');
      expect(result.scheduling?.startedAtTick).toBe(1_121);
      expect(result.selectedAt).toEqual(at(0.126));
      expect(result.retainedCommand).toEqual(input.predecessor.command);
    });
    it.each([
      { received: 0.1001, informationCut: 0.1002, expected: 'no_new_trigger' },
      { received: 0.1002, informationCut: 0.1001, expected: 'communication_received' },
    ] as const)('preserves exact order when reception=$received and the information cut=$informationCut share one recorded tick', row => {
      const input = withExactReception(fixture(), row.received, 0.1204);
      expect(at(row.received).tick).toBe(at(row.informationCut).tick);
      const result = derive({ ...input, predecessor: { ...input.predecessor, availability: at(row.informationCut) } });
      expect(result.trigger).toBe(row.expected);
      if (row.expected === 'no_new_trigger') {
        expect(result.scheduling).toBeNull();
        expect(result.selectedAt).toBeNull();
        expect(result.candidates).toEqual([]);
      } else expect(result.scheduling?.startedAtTick).toBe(1_121);
    });
    it.each([null, { sequenceOwnerSourceId: 'unrelated-sequence', sequence: 9 }, { sequenceOwnerSourceId: 'event-sequence', sequence: 5 }] as const)(
      'keeps exact same-moment ordering pending without matching authenticated sequence ownership (%j)', order => {
        const input = withExactReception(fixture(), 0.1002, 0.1204), reception = input.observation.reception;
        if (reception.kind !== 'received') throw new Error('test fixture requires received communication');
        const result = derive({ ...input, predecessor: { ...input.predecessor, availability: at(0.1002),
          informationOrder: { sequenceOwnerSourceId: 'event-sequence', sequence: 5 } },
          observation: { ...input.observation, reception: { ...reception, order } } });
        expect(result.semantic).toBe('same_moment_order_unavailable');
        expect(result.selectedAt).toBeNull();
        expect(result.scheduling).toBeNull();
        expect(result.retainedCommand).toEqual(input.predecessor.command);
        expectNoCompletion(result);
      });
    it.each([
      { receivedSequence: 4, expected: 'no_new_trigger' },
      { receivedSequence: 6, expected: 'communication_received' },
    ] as const)('uses authenticated semantic order $receivedSequence at an exact same moment', row => {
      const input = withExactReception(fixture(), 0.1002, 0.1204), reception = input.observation.reception;
      if (reception.kind !== 'received') throw new Error('test fixture requires received communication');
      const result = derive({ ...input, predecessor: { ...input.predecessor, availability: at(0.1002),
        informationOrder: { sequenceOwnerSourceId: 'event-sequence', sequence: 5 } },
        observation: { ...input.observation, reception: { ...reception,
          order: { sequenceOwnerSourceId: 'event-sequence', sequence: row.receivedSequence } } } });
      expect(result.trigger).toBe(row.expected);
    });
    it('does not round availability slightly after an integer boundary back into earlier cognition', () => {
      const input = withExactReception(fixture(), 0.1195, 0.12000000000001);
      expect(input.observation.at.tick).toBe(1_120);
      expect(input.observation.at.elapsedSeconds).toBeGreaterThan((1_120 - clock.originTick) / clock.ticksPerSecond);
      expect(derive(input).scheduling?.startedAtTick).toBe(1_121);
    });
    it('does not observe a same-recorded-tick scheduled signal before its exact reception', () => {
      const input = fixture(), beforeReception = at(0.1201), perceived = input.observation.perceived;
      const result = derive({ ...input, currentCut: beforeReception, observation: { ...input.observation, at: beforeReception,
        reception: { kind: 'scheduled', dueAt: at(0.1202) }, perceived: { ...perceived, communications: [] } } });
      expect(beforeReception.tick).toBe(at(0.1202).tick);
      expect(result.trigger).toBe('no_new_trigger');
      expect(result.candidates).toEqual([]);
      expect(result.selected).toBeNull();
      expect(result.scheduling).toBeNull();
      expectNoCompletion(result);
    });
  });
  describe('ReceivedUmpireDefenderReplan: stable cause and ownership', () => {
    it('reconstructs one original cause across new observation and communication Source revisions', () => {
      const input = fixture('safe'), first = derive(input), firstBytes = JSON.stringify(first);
      const nextInput = later(input, first, 0.127), perceived = nextInput.observation.perceived;
      const next = derive({ ...nextInput, observation: { ...nextInput.observation,
        perceived: { ...perceived, ball: { ...perceived.ball!,
          estimate: { ...perceived.ball!.estimate, position: { x: 99, y: 0.3, z: 99 } } } } } });
      expect(JSON.stringify(first)).toBe(firstBytes);
      expect(next.cause).toEqual(first.cause);
      expect(next.originEvidence).toEqual(expectedOriginEvidence(input));
      expect(next.policyBinding).toEqual(first.policyBinding);
      expect(next.originObservationSourceId).toBe(first.originObservationSourceId);
      expect(next.receivedAt).toEqual(first.receivedAt);
      expect(next.availableAt).toEqual(first.availableAt);
      expect(next.scheduling).toEqual(first.scheduling);
      expect(next.selectedAt).toEqual(first.selectedAt);
      expect(next.candidates).toEqual(first.candidates);
      expect(next.candidates).toHaveLength(baseline(input).length + 2);
      expect(contributions(next)).toHaveLength(2);
      expect(next.selected?.localPriority).toBe(first.selected?.localPriority);
      expect(next.target).toEqual({ x: 8, z: 13 });
    });
    it('is deterministic on retries and leaves all input owners byte-identical', () => {
      const input = fixture(), bytes = JSON.stringify(input);
      const first = derive(input), retry = derive(input);
      expect(retry).toEqual(first);
      expect(JSON.stringify(input)).toBe(bytes);
      expect(JSON.stringify(first.retainedCommand)).toBe(JSON.stringify(input.predecessor.command));
    });
    it('rejects a changed call identity in the received payload rather than silently relabeling it', () => {
      const input = fixture(), reception = input.observation.reception;
      if (reception.kind !== 'received') throw new Error('test fixture requires received communication');
      const received = { ...reception.received, event: { ...reception.received.event,
        content: { ...reception.received.event.content, callSourceId: 'different-call' } } };
      expect(() => derive({ ...input, observation: { ...input.observation, reception: { ...reception, received },
        perceived: { ...input.observation.perceived, communications: [received] } } })).toThrow();
    });
    it('rejects a future observation cut rather than using later knowledge in an earlier decision', () => {
      const input = fixture();
      expect(() => derive({ ...input, currentCut: at(0.1203) })).toThrow();
    });
    it('rejects future exact reception copied into a received observation at the same recorded tick', () => {
      const input = withExactReception(fixture(), 0.1205, 0.1204);
      expect(at(0.1205).tick).toBe(input.observation.at.tick);
      expect(() => derive(input)).toThrow();
    });
    it('does not allow a different receiver to continue another defender\'s original cause', () => {
      const input = fixture(), first = derive(input), next = later(input, first, 0.127);
      expect(() => derive({ ...next, playerId: 'another-defender' })).toThrow();
    });
    it.each(['model_identity', 'model_hash', 'plan_identity', 'plan_hash', 'policy_identity', 'policy_hash', 'policy_removal'] as const)(
      'does not replace or discard an already bound dependency through %s', change => {
      const input = fixture(), first = derive(input), next = later(input, first, 0.127);
      expect(first.originEvidence).toEqual(expectedOriginEvidence(input));
      expect(first.policyBinding).toEqual({ policy: input.policy, boundAt: input.currentCut });
      const changed: ReceivedCallContractInput = change === 'model_identity'
        ? { ...next, model: { ...next.model, sourceId: 'different-model' } }
        : change === 'model_hash' ? { ...next, model: { ...next.model, hash: 'different-model-hash' } }
          : change === 'plan_identity' ? { ...next, contextualPlan: { ...next.contextualPlan, sourceId: 'different-plan' } }
            : change === 'plan_hash' ? { ...next, contextualPlan: { ...next.contextualPlan, hash: 'different-plan-hash' } }
              : change === 'policy_identity' ? { ...next, policy: { ...next.policy!, sourceId: 'different-policy' } }
                : change === 'policy_hash' ? { ...next, policy: { ...next.policy!, hash: 'different-policy-hash' } }
                  : { ...next, policy: null };
      expect(() => derive(changed)).toThrow();
    });
  });
  describe('ReceivedUmpireDefenderReplan: honest pending and missed commitment', () => {
    it.each(['out', 'safe'] as const)('keeps a missing %s profile pending even when the other call has a profile', call => {
      const input = fixture(call), result = derive({ ...input, policy: { ...input.policy!, profiles: { ...priorities, [call]: null } } });
      expect(result.semantic).toBe('call_profile_unavailable');
      expect(result.phase).toBe('semantic_pending');
      expect(result.selected).toBeNull();
      expect(result.selectedAt).toBeNull();
      expect(result.target).toBeNull();
      expect(result.scheduling?.decisionTick).toBe(1_126);
      expect(result.scheduling?.movementStartTick).toBeNull();
      expect(result.work).toContainEqual({ kind: 'decision', sourceId: result.processSourceId, cause: expectedCause, dueTick: 1_126 });
      expect(result.retainedCommand).toEqual(input.predecessor.command);
      expectNoCompletion(result);
    });
    it('preserves the same due decision when the policy owner is absent at and before the boundary', () => {
      const input = { ...fixture(), policy: null }, before = derive({ ...input, currentCut: at(0.125) });
      const due = derive(later(input, before, 0.126));
      expect(before.originEvidence).toEqual(expectedOriginEvidence(input));
      expect(before.policyBinding).toBeNull();
      expect(due.originEvidence).toEqual(before.originEvidence);
      expect(due.policyBinding).toBeNull();
      expect(before.phase).toBe('pending_decision');
      expect(due.phase).toBe('semantic_pending');
      expect(due.semantic).toBe('call_profile_unavailable');
      expect(due.scheduling?.decisionTick).toBe(before.scheduling?.decisionTick);
      expect(due.work).toContainEqual({ kind: 'decision', sourceId: due.processSourceId, cause: expectedCause, dueTick: 1_126 });
      expect(due.selectedAt).toBeNull();
      expectNoCompletion(due);
    });
    it('leaves an unsupported receiver role pending without giving it a defender or runner command', () => {
      const input = fixture(), result = derive({ ...input, receiverRole: 'batter' });
      expect(result.semantic).toBe('receiver_role_unavailable');
      expect(result.selected).toBeNull();
      expect(result.selectedAt).toBeNull();
      expect(result.target).toBeNull();
      expect(result.retainedCommand).toEqual(input.predecessor.command);
      expectNoCompletion(result);
    });
    it('leaves an initial motor that has not actually been adopted pending', () => {
      const input = fixture(), result = derive({ ...input, predecessor: { ...input.predecessor,
        motor: { ...input.predecessor.motor, adoptionSourceId: null, adoptedAt: null } } });
      expect(result.semantic).toBe('predecessor_work_pending');
      expect(result.selectedAt).toBeNull();
      expect(result.retainedCommand).toEqual(input.predecessor.command);
      expectNoCompletion(result);
    });
    it('preserves a winning unsupported baseline intent and exposes its pending adapter boundary', () => {
      const input = fixture(), perceived = input.observation.perceived;
      const coverCall: ReceivedCommunication = { event: { sourceId: 'teammate', targetScope: { kind: 'player', playerId: 'defender' },
        kind: 'callout', issuedAt: 1_118, content: { kind: 'cover_base', base: 1 } }, receivedAt: 1_120, confidence: 1 };
      const changed = { ...input, contextualPlan: { ...input.contextualPlan, priorities: { ...plan, baseCoverPriorities: [{ base: 1 as const, priority: 1 }] } },
        observation: { ...input.observation, perceived: { ...perceived, communications: [...perceived.communications, coverCall] } } };
      const result = derive(changed);
      expect(result.candidates).toEqual(expect.arrayContaining([...baseline(changed)]));
      expect(chooseDefensiveIntentCandidate(result.candidates).intent).toEqual({ kind: 'base_cover', base: 1 });
      expect(result.semantic).toBe('intent_adapter_unavailable');
      expect(result.phase).toBe('semantic_pending');
      expect(result.selected).toBeNull();
      expect(result.selectedAt).toBeNull();
      expect(result.target).toBeNull();
      expect(result.retainedCommand).toEqual(input.predecessor.command);
      expect(result.work).toContainEqual({ kind: 'decision', sourceId: result.processSourceId, cause: expectedCause, dueTick: 1_126 });
      expectNoCompletion(result);
    });
    it('binds a predeadline policy to frozen origin evidence when the latest ball perception materially changes', () => {
      const input = fixture('safe'), missing = { ...input, policy: null }, pending = derive({ ...missing, currentCut: at(0.125) });
      const pendingBytes = JSON.stringify(pending), dueInput = later(missing, pending, 0.126), perceived = dueInput.observation.perceived;
      const policy = { ...input.policy!, availableAt: at(0.1259) };
      const result = derive({ ...dueInput, policy, observation: { ...dueInput.observation,
        perceived: { ...perceived, ball: { ...perceived.ball!, confidence: 0.49,
          estimate: { ...perceived.ball!.estimate, position: { x: 99, y: 0.3, z: 99 } } } } } });
      expect(pending.originEvidence).toEqual(expectedOriginEvidence(missing));
      expect(pending.policyBinding).toBeNull();
      expect(JSON.stringify(pending)).toBe(pendingBytes);
      expect(result.originEvidence).toEqual(pending.originEvidence);
      expect(result.policyBinding).toEqual({ policy, boundAt: at(0.126) });
      expect(result.scheduling?.decisionTick).toBe(pending.scheduling?.decisionTick);
      expect(result.selectedAt).toEqual(at(0.126));
      expect(result.selected?.intent).toEqual({ kind: 'ball_handler' });
      expect(result.target).toEqual({ x: 8, z: 13 });
      expect(result.selected?.localPriority).toBeCloseTo(0.9 * 0.8 * 0.75, 14);
      expect(result.candidates).toEqual(expect.arrayContaining([...baseline(missing)]));
      expect(contributions(result)).toHaveLength(2);
      expect(result.retainedCommand).toEqual(input.predecessor.command);
    });
    it.each([0.12600000000001, 0.127])('cannot backdate selection from a profile first available at %s', available => {
      const input = fixture(), missing = { ...input, policy: null }, pending = derive({ ...missing, currentCut: at(0.125) });
      const due = derive(later(missing, pending, 0.126));
      const policy = { ...input.policy!, availableAt: at(available) };
      const result = derive({ ...later(missing, due, 0.127), processSourceId: 'replan-3',
        policy });
      expect(result.originEvidence).toEqual(pending.originEvidence);
      expect(result.policyBinding).toEqual({ policy, boundAt: at(0.127) });
      expect(result.phase).toBe('missed_commitment');
      expect(result.scheduling?.decisionTick).toBe(1_126);
      expect(result.selected).toBeNull();
      expect(result.selectedAt).toBeNull();
      expect(result.scheduling?.movementStartTick).toBeNull();
      expect(result.work).toContainEqual({ kind: 'decision', sourceId: result.processSourceId, cause: expectedCause, dueTick: 1_126 });
      expect(result.retainedCommand).toEqual(input.predecessor.command);
      expectNoCompletion(result);
    });
    it.each([0.12600000000001, 0.127])('does not retroactively complete an unobserved commitment at exact cut %s', currentCut => {
      const input = fixture(), pending = derive({ ...input, currentCut: at(0.125) });
      expect(at(currentCut).elapsedSeconds).toBeGreaterThan(at(0.126).elapsedSeconds);
      if (currentCut === 0.12600000000001) expect(at(currentCut).tick).toBe(at(0.126).tick);
      const result = derive(later(input, pending, currentCut));
      expect(result.originEvidence).toEqual(pending.originEvidence);
      expect(result.policyBinding).toEqual(pending.policyBinding);
      expect(result.phase).toBe('missed_commitment');
      expect(result.selectedAt).toBeNull();
      expect(result.scheduling?.decisionTick).toBe(1_126);
      expect(result.retainedCommand).toEqual(input.predecessor.command);
      expectNoCompletion(result);
    });
  });
}

/** Fixture assembly only. No eligibility, timing, selection, or adapter implementation. */
function withExactReception(input: ReceivedCallContractInput, receivedElapsed: number, availableElapsed: number): ReceivedCallContractInput {
  const reception = input.observation.reception;
  if (reception.kind !== 'received') throw new Error('test fixture requires received communication');
  const receivedAt = at(receivedElapsed), availableAt = at(availableElapsed), calledAt = at(0.099);
  const received = { ...reception.received, receivedAt: receivedAt.tick,
    event: { ...reception.received.event, issuedAt: calledAt.tick, content: { ...reception.received.event.content, calledAt,
      onFieldCall: { ...reception.received.event.content.onFieldCall, tick: calledAt.tick } } } };
  const perceived = input.observation.perceived;
  return { ...input, observation: { ...input.observation, at: availableAt, reception: { ...reception, receivedAt, received },
    perceived: { ...perceived, observationTime: availableAt.tick, communications: [received],
      ball: perceived.ball ? { ...perceived.ball, predictedAt: availableAt.tick } : null } } };
}
