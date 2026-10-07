import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { quantizeEventTick } from '../ExactEventTime';
import { buildPlayerPerceivedWorldState } from '../perception/PlayerPerceivedWorldState';
import { chooseDefensiveIntentCandidate, generateDefensiveIntentCandidates, type DefensiveIntentCandidate } from './DefensiveDecision';
import { resolveDefensiveDecisionTiming } from './DefensiveDecisionTiming';
import { resolveDefenderFirstStepTiming } from './DefenderFirstStepTiming';
import { findNextDefensiveReplanTick } from './DefensiveReplan';
import type {
  ReceivedUmpireCallMoment as Moment, ReceivedUmpireCallOrder as Order, ReceivedUmpireCallCause as Cause,
  ReceivedUmpireDefenderOriginEvidence as Origin, ReceivedUmpireDefenderPolicyBinding as Binding,
  ReceivedUmpireDefenderReplanInput as Input, ReceivedUmpireDefenderReplan as Result,
} from './ReceivedUmpireDefenderReplanTypes';
export type * from './ReceivedUmpireDefenderReplanTypes';

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`received umpire defender replan: ${message}`);
}
function fields(value: unknown, expected: readonly string[]): void {
  check(value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('|') === [...expected].sort().join('|'), 'unexpected dependency fields');
}
function id(value: unknown): void { check(typeof value === 'string' && value.length > 0 && value.trim() === value, 'invalid owner identity'); }
function tick(value: number): void { check(Number.isSafeInteger(value) && value >= 0, 'invalid tick or sequence'); }
function unit(value: number): void { check(Number.isFinite(value) && value >= 0 && value <= 1, 'invalid explicit unit value'); }
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const left = Object.keys(a).sort(), right = Object.keys(b).sort();
  return left.length === right.length && left.every((key, index) => key === right[index] && same(Reflect.get(a, key), Reflect.get(b, key)));
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function moment(value: Moment, originTick: number, ticksPerSecond: number): void {
  fields(value, ['originTick', 'elapsedSeconds', 'tick']);
  check(value.originTick === originTick && value.tick === quantizeEventTick(originTick, value.elapsedSeconds, ticksPerSecond), 'exact clock differs');
}
function order(value: Order): void {
  if (value === null) return;
  fields(value, ['sequenceOwnerSourceId', 'sequence']); id(value.sequenceOwnerSourceId); tick(value.sequence);
}
/** Same exact relative comparison as the Native initial scheduling boundary; no quantizer tolerance. */
function boundary(at: Moment, ticksPerSecond: number): number {
  let lower = 0, upper = Number.MAX_SAFE_INTEGER - at.originTick;
  check(upper / ticksPerSecond >= at.elapsedSeconds, 'scheduling boundary overflow');
  while (lower < upper) {
    const middle = lower + Math.floor((upper - lower) / 2);
    if (middle / ticksPerSecond >= at.elapsedSeconds) upper = middle;
    else lower = middle + 1;
  }
  return at.originTick + lower;
}
function predecessorBasis(input: Input): Origin['predecessor'] {
  const p = input.predecessor;
  return { originDecisionSourceId: p.originDecisionSourceId, originObservationSourceId: p.originObservationSourceId,
    originObservationHash: p.originObservationHash, availability: p.availability, informationOrder: p.informationOrder,
    command: p.command, motor: p.motor };
}
function originEvidence(input: Input): Origin {
  return { physicalPitchSourceId: input.physicalPitchSourceId, playerId: input.playerId, receiverRole: input.receiverRole,
    ticksPerSecond: input.ticksPerSecond, communication: input.communication, observation: input.observation,
    model: input.model, contextualPlan: input.contextualPlan, predecessor: predecessorBasis(input) };
}
function causeFor(origin: Origin): Cause {
  return { physicalPitchSourceId: origin.physicalPitchSourceId, playerId: origin.playerId,
    callSourceId: origin.communication.callSourceId, originCommunicationSourceId: origin.communication.originCommunicationSourceId };
}
function baseline(origin: Origin): readonly DefensiveIntentCandidate[] {
  return generateDefensiveIntentCandidates({ perceivedWorld: origin.observation.perceived, self: { playerId: origin.playerId },
    prePlayPlan: origin.contextualPlan.priorities, perceivedCues: [], minimumCueConfidence: origin.model.minimumCueConfidence,
    communicationTrust: origin.model.communicationTrust });
}
function validatePolicy(policy: NonNullable<Input['policy']>, input: Input): void {
  fields(policy, ['sourceId', 'hash', 'availableAt', 'profiles']); id(policy.sourceId); id(policy.hash);
  moment(policy.availableAt, input.currentCut.originTick, input.ticksPerSecond);
  check(policy.availableAt.elapsedSeconds <= input.currentCut.elapsedSeconds, 'policy is not yet available');
  fields(policy.profiles, ['out', 'safe']);
  for (const profile of [policy.profiles.out, policy.profiles.safe]) {
    if (profile === null) continue;
    fields(profile, ['ballPursuitPriority', 'holdPriority']); unit(profile.ballPursuitPriority); unit(profile.holdPriority);
  }
}
function validateInput(input: Input): void {
  fields(input, ['processSourceId', 'physicalPitchSourceId', 'playerId', 'receiverRole', 'ticksPerSecond', 'currentCut',
    'communication', 'observation', 'predecessor', 'model', 'contextualPlan', 'policy', 'previous']);
  [input.processSourceId, input.physicalPitchSourceId, input.playerId].forEach(id);
  check(input.receiverRole === 'defender' || input.receiverRole === 'batter', 'unsupported receiver role shape');
  tick(input.ticksPerSecond); check(input.ticksPerSecond > 0, 'invalid clock rate'); tick(input.currentCut.originTick);
  const validateMoment = (at: Moment) => moment(at, input.currentCut.originTick, input.ticksPerSecond);
  validateMoment(input.currentCut);
  fields(input.communication, ['sourceId', 'hash', 'originCommunicationSourceId', 'callSourceId']); Object.values(input.communication).forEach(id);
  const o = input.observation, p = input.predecessor, model = input.model;
  fields(o, ['sourceId', 'hash', 'at', 'perceived', 'reception']); id(o.sourceId); id(o.hash); validateMoment(o.at);
  check(o.at.elapsedSeconds <= input.currentCut.elapsedSeconds, 'observation is from the future');
  fields(o.perceived, ['observerId', 'observationTime', 'attention', 'ball', 'players', 'communications', 'knownContext']);
  check(o.perceived.observerId === input.playerId && o.perceived.observationTime === o.at.tick && o.perceived.knownContext === null,
    'perceived observer, time or semantic context differs');
  check(same(buildPlayerPerceivedWorldState(o.perceived), o.perceived), 'future communication in perceived world');
  if (o.perceived.ball !== null) {
    const ball = o.perceived.ball;
    tick(ball.sourceObservedAt); unit(ball.confidence);
    check(ball.sourceObservedAt <= o.at.tick, 'future ball memory');
  }
  if (o.reception.kind === 'scheduled') {
    fields(o.reception, ['kind', 'dueAt']); validateMoment(o.reception.dueAt);
    check(o.reception.dueAt.elapsedSeconds > o.at.elapsedSeconds, 'scheduled reception is already due at observation');
    check(!o.perceived.communications.some(item => item.event.content !== null && typeof item.event.content === 'object'
      && Reflect.get(item.event.content, 'callSourceId') === input.communication.callSourceId), 'scheduled call payload is not yet available');
  } else {
    check(o.reception.kind === 'received', 'unsupported reception state');
    fields(o.reception, ['kind', 'receivedAt', 'order', 'received']); validateMoment(o.reception.receivedAt); order(o.reception.order);
    const r = o.reception.received, event = r.event, content = event.content;
    fields(r, ['event', 'receivedAt', 'confidence']); unit(r.confidence);
    fields(event, ['sourceId', 'targetScope', 'kind', 'issuedAt', 'content']); id(event.sourceId); tick(event.issuedAt);
    check(event.kind === 'callout' && r.receivedAt === o.reception.receivedAt.tick, 'callout reception identity differs');
    const scope = event.targetScope;
    check(scope.kind === 'nearby' || scope.kind === 'team' || scope.kind === 'player' && scope.playerId === input.playerId, 'call targets another receiver');
    fields(scope, scope.kind === 'player' ? ['kind', 'playerId'] : ['kind']);
    fields(content, ['callSourceId', 'call', 'calledAt', 'onFieldCall']);
    check(content.callSourceId === input.communication.callSourceId && (content.call === 'out' || content.call === 'safe'), 'operative call payload differs');
    validateMoment(content.calledAt);
    check(event.issuedAt === content.calledAt.tick && content.calledAt.elapsedSeconds <= o.reception.receivedAt.elapsedSeconds
      && o.reception.receivedAt.elapsedSeconds <= o.at.elapsedSeconds, 'future or reversed exact reception');
    const matching = o.perceived.communications.filter(item => item.event.content !== null && typeof item.event.content === 'object'
      && Reflect.get(item.event.content, 'callSourceId') === content.callSourceId);
    check(matching.length > 0 && matching.every(item => same(item, r)), 'received call is absent or conflicts with perceived evidence');
  }
  fields(p, ['originDecisionSourceId', 'originObservationSourceId', 'originObservationHash', 'availability', 'informationOrder',
    'observationSourceId', 'observationHash', 'observedThrough', 'decisionTick', 'issuedAt', 'command', 'motor']);
  [p.originDecisionSourceId, p.originObservationSourceId, p.originObservationHash, p.observationSourceId, p.observationHash].forEach(id);
  [p.availability, p.observedThrough, p.issuedAt].forEach(validateMoment); order(p.informationOrder); tick(p.decisionTick);
  check(p.availability.elapsedSeconds <= p.observedThrough.elapsedSeconds && p.observedThrough.elapsedSeconds <= input.currentCut.elapsedSeconds
    && p.availability.elapsedSeconds <= p.issuedAt.elapsedSeconds && p.issuedAt.elapsedSeconds <= input.currentCut.elapsedSeconds, 'predecessor information or issuance cut differs');
  fields(p.command, ['sourceId', 'hash', 'selected', 'target']); id(p.command.sourceId); id(p.command.hash);
  chooseDefensiveIntentCandidate([p.command.selected]);
  fields(p.motor, ['sourceId', 'hash', 'adoptionSourceId', 'adoptedAt']); id(p.motor.sourceId); id(p.motor.hash);
  check((p.motor.adoptionSourceId === null) === (p.motor.adoptedAt === null), 'incomplete initial motor adoption');
  if (p.motor.adoptedAt !== null) {
    id(p.motor.adoptionSourceId); validateMoment(p.motor.adoptedAt);
    check(p.motor.adoptedAt.elapsedSeconds >= p.issuedAt.elapsedSeconds && p.motor.adoptedAt.elapsedSeconds <= input.currentCut.elapsedSeconds,
      'initial motor adoption is outside its actual cut');
  }
  fields(model, ['sourceId', 'hash', 'situationalAwareness', 'firstStepAbility', 'minimumCueConfidence', 'communicationTrust',
    'decisionTimingParameters', 'firstStepTimingParameters']); id(model.sourceId); id(model.hash);
  fields(model.decisionTimingParameters, ['minimumDecisionDelayTicks', 'maximumDecisionDelayTicks', 'fixedProcessingOffsetTicks']);
  fields(model.firstStepTimingParameters, ['minimumFirstStepDelayTicks', 'maximumFirstStepDelayTicks', 'fixedMotorOffsetTicks']);
  resolveDefensiveDecisionTiming(0, model.situationalAwareness, model.decisionTimingParameters);
  resolveDefenderFirstStepTiming(0, model.firstStepAbility, model.firstStepTimingParameters);
  fields(input.contextualPlan, ['sourceId', 'hash', 'priorities']); id(input.contextualPlan.sourceId); id(input.contextualPlan.hash);
  baseline(originEvidence(input));
  if (input.policy !== null) validatePolicy(input.policy, input);
}

function proposal(origin: Origin, binding: Binding | null): Pick<Result, 'semantic' | 'candidates' | 'selected' | 'target'> {
  const empty = { candidates: [], selected: null, target: null } as const;
  if (origin.receiverRole !== 'defender') return { ...empty, semantic: 'receiver_role_unavailable' };
  if (origin.predecessor.motor.adoptionSourceId === null) return { ...empty, semantic: 'predecessor_work_pending' };
  const reception = origin.observation.reception;
  check(reception.kind === 'received', 'proposal has no received call');
  const profile = binding?.policy.profiles[reception.received.event.content.call] ?? null;
  if (profile === null) return { ...empty, semantic: 'call_profile_unavailable' };
  const candidates = [...baseline(origin)], model = origin.model, confidence = reception.received.confidence;
  const available = Math.max(boundary(origin.observation.at, origin.ticksPerSecond), boundary(binding!.policy.availableAt, origin.ticksPerSecond));
  if (confidence >= model.minimumCueConfidence && model.communicationTrust > 0) {
    const weight = confidence * model.communicationTrust;
    const ball = origin.observation.perceived.ball;
    if (ball !== null && ball.confidence >= model.minimumCueConfidence && profile.ballPursuitPriority > 0) {
      candidates.push({ intent: { kind: 'ball_handler' }, localPriority: profile.ballPursuitPriority * weight,
        evidenceAvailableAt: available, evidenceKinds: [`received_umpire_call:${origin.communication.callSourceId}`, 'accepted_call_profile'] });
    }
    if (profile.holdPriority > 0) candidates.push({ intent: { kind: 'hold' }, localPriority: profile.holdPriority * weight,
      evidenceAvailableAt: available, evidenceKinds: [`received_umpire_call:${origin.communication.callSourceId}`, 'accepted_call_profile'] });
  }
  const selected = chooseDefensiveIntentCandidate(candidates);
  if (selected.intent.kind !== 'ball_handler' && selected.intent.kind !== 'hold') {
    return { semantic: 'intent_adapter_unavailable', candidates, selected: null, target: null };
  }
  const ball = origin.observation.perceived.ball;
  check(selected.intent.kind !== 'ball_handler' || ball !== null, 'selected pursuit lacks perceived ball');
  return { semantic: 'ready', candidates, selected,
    target: selected.intent.kind === 'ball_handler' && ball !== null ? { x: ball.estimate.position.x, z: ball.estimate.position.z } : null };
}

/** Pure scheduling/decision receipt only. Native must authenticate every supplied owner and prior receipt. */
export function deriveReceivedUmpireDefenderReplan(raw: Input): Result {
  const input = cloneInert(raw); validateInput(input);
  const previous = input.previous;
  const empty: Result = { processSourceId: input.processSourceId, cause: null, originEvidence: null, policyBinding: null,
    trigger: 'no_new_trigger', semantic: 'ready', phase: null, originObservationSourceId: null, receivedAt: null, availableAt: null,
    scheduling: null, candidates: [], selected: null, selectedAt: null, target: null, retainedCommand: input.predecessor.command, work: [] };
  if (input.observation.reception.kind === 'scheduled') {
    check(previous === null, 'an existing received process cannot become scheduled again');
    return freeze(empty);
  }
  let origin = originEvidence(input);
  if (previous !== null) {
    check(previous.originEvidence !== null && previous.trigger === 'communication_received' && previous.scheduling !== null, 'previous process is not a received-call decision');
    origin = previous.originEvidence;
    check(input.physicalPitchSourceId === origin.physicalPitchSourceId && input.playerId === origin.playerId
      && input.receiverRole === origin.receiverRole && input.ticksPerSecond === origin.ticksPerSecond, 'original receiver or clock binding differs');
    check(input.communication.callSourceId === origin.communication.callSourceId
      && input.communication.originCommunicationSourceId === origin.communication.originCommunicationSourceId, 'original communication cause differs');
    check(same(input.model, origin.model) && same(input.contextualPlan, origin.contextualPlan)
      && same(predecessorBasis(input), origin.predecessor), 'immutable model, plan or incumbent owner differs');
    check(same(input.observation.reception, origin.observation.reception), 'original reception changed');
    check(input.observation.at.elapsedSeconds >= origin.observation.at.elapsedSeconds && same(previous.cause, causeFor(origin)), 'original observation or cause differs');
    if (previous.policyBinding !== null) {
      check(input.policy !== null && same(input.policy, previous.policyBinding.policy), 'bound policy cannot be replaced or discarded');
      moment(previous.policyBinding.boundAt, input.currentCut.originTick, input.ticksPerSecond);
      check(previous.policyBinding.policy.availableAt.elapsedSeconds <= previous.policyBinding.boundAt.elapsedSeconds
        && previous.policyBinding.boundAt.elapsedSeconds <= input.currentCut.elapsedSeconds, 'policy binding is from the future');
    }
  }
  const reception = origin.observation.reception;
  check(reception.kind === 'received', 'origin has no received call');
  const cause = causeFor(origin), retainedCommand = origin.predecessor.command;
  const common = { ...empty, cause, originEvidence: origin, retainedCommand,
    originObservationSourceId: origin.observation.sourceId, receivedAt: reception.receivedAt, availableAt: origin.observation.at };
  let exactOrder = Math.sign(reception.receivedAt.elapsedSeconds - origin.predecessor.availability.elapsedSeconds);
  if (exactOrder === 0) {
    const receivedOrder = reception.order, predecessorOrder = origin.predecessor.informationOrder;
    if (receivedOrder === null || predecessorOrder === null || receivedOrder.sequenceOwnerSourceId !== predecessorOrder.sequenceOwnerSourceId
      || receivedOrder.sequence === predecessorOrder.sequence) {
      return freeze({ ...common, semantic: 'same_moment_order_unavailable', phase: 'semantic_pending' });
    }
    exactOrder = Math.sign(receivedOrder.sequence - predecessorOrder.sequence);
  }
  if (exactOrder < 0) return freeze(common);
  const startedAtTick = findNextDefensiveReplanTick(null, [{ kind: 'communication_received', perceivedAt: boundary(origin.observation.at, origin.ticksPerSecond) }]);
  check(startedAtTick !== null, 'received trigger has no scheduling boundary');
  const timing = resolveDefensiveDecisionTiming(startedAtTick, origin.model.situationalAwareness, origin.model.decisionTimingParameters);
  const scheduling = { startedAtTick, decisionDelayTicks: timing.decisionDelayTicks, decisionTick: timing.decisionTick,
    firstStepDelayTicks: null, movementStartTick: null };
  if (previous !== null) check(previous.scheduling?.startedAtTick === startedAtTick && previous.scheduling.decisionDelayTicks === timing.decisionDelayTicks
    && previous.scheduling.decisionTick === timing.decisionTick, 'original decision timing changed');
  const binding = previous?.policyBinding ?? (input.policy === null ? null : { policy: input.policy, boundAt: input.currentCut });
  const proposed = proposal(origin, binding);
  const decisionSeconds = (timing.decisionTick - input.currentCut.originTick) / input.ticksPerSecond;
  const now = input.currentCut.elapsedSeconds;
  const decisionWork: Result['work'] = [{ kind: 'decision', sourceId: input.processSourceId, cause, dueTick: timing.decisionTick }];
  const result: Result = { ...common, ...proposed, trigger: 'communication_received', policyBinding: binding, scheduling,
    phase: now < decisionSeconds ? 'pending_decision' : 'semantic_pending', work: decisionWork };
  const selectedAt = previous?.selectedAt ?? null;
  if (selectedAt === null && (previous?.phase === 'missed_commitment' || now > decisionSeconds && proposed.semantic === 'ready')) {
    return freeze({ ...result, phase: 'missed_commitment', candidates: [], selected: null, target: null });
  }
  if (proposed.semantic !== 'ready' || now < decisionSeconds) return freeze(result);
  if (selectedAt !== null) {
    moment(selectedAt, input.currentCut.originTick, input.ticksPerSecond);
    check(selectedAt.elapsedSeconds === decisionSeconds && selectedAt.elapsedSeconds <= now && same(previous?.selected, proposed.selected)
      && same(previous?.target, proposed.target) && same(previous?.candidates, proposed.candidates), 'previous decision commitment differs');
  }
  const committedAt = selectedAt ?? input.currentCut;
  check(committedAt.elapsedSeconds === decisionSeconds, 'cannot backdate decision selection');
  const motor = resolveDefenderFirstStepTiming(timing.decisionTick, origin.model.firstStepAbility, origin.model.firstStepTimingParameters);
  const movementSeconds = (motor.movementStartTick - input.currentCut.originTick) / input.ticksPerSecond;
  return freeze({ ...result, selectedAt: committedAt,
    scheduling: { ...scheduling, firstStepDelayTicks: motor.firstStepDelayTicks, movementStartTick: motor.movementStartTick },
    phase: now < movementSeconds ? 'pending_first_step' : 'renewal_due',
    work: [{ kind: now < movementSeconds ? 'intent' : 'renewal_adoption', sourceId: input.processSourceId, cause, dueTick: motor.movementStartTick }] });
}
