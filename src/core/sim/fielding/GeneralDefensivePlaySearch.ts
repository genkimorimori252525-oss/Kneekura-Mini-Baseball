import type { CanonicalMatchState } from '../../model/CanonicalMatchState';
import type { DefensivePosition } from '../../model/CanonicalWorldSnapshot';
import type { Vec2 } from '../../model/geometry';
import {
  createInitialForceObligationState,
  deriveCurrentForceObligations,
  retireForceParticipant,
  type ForceObligation,
  type ForceObligationState,
} from '../../rules/ForceObligation';
import {
  resolveDefensiveDecisionTiming,
  type DefensiveDecisionTimingParameters,
} from './DefensiveDecisionTiming';
import type { DefensiveIntent } from './DefensiveDecision';

const BASES = [1, 2, 3, 4] as const;
const POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const;
const MAX_SEARCH_STEPS = 4;
const MAX_BEAM_WIDTH = 64;

/** Provenance *reference* from an accepted Native owner, not a fabricated signature. */
export type DefensiveSearchEvidenceReference = Readonly<{
  playId: number;
  sourceId: string;
  sourceHash: string;
  revision: number;
  observedAtTick: number;
  availableAtTick: number;
}>;

export type DefensiveSearchDefender = Readonly<{
  playerId: string;
  registeredPosition: DefensivePosition;
  /** Positions/velocities observed in the SAME accepted world tick. */
  position: Vec2;
  velocity: Vec2;
  /** Explicit physical upper bounds; no ratings or release calibration inferred here. */
  topSpeedMps: number;
  accelerationMps2: number;
  baseCoverRadiusMeters: number;
  maximumThrowSpeedMps: number;
  throwTransferDelayTicks: number;
  receptionSecureDelayTicks: number;
  situationalAwareness: number;
  decisionTiming: DefensiveDecisionTimingParameters;
}>;

/** From the accepted runner motion authority for a SPECIFIC motion revision. */
export type DefensiveSearchRunnerArrival = Readonly<{
  targetBase: 1 | 2 | 3 | 4;
  /** Physical runner cannot arrive earlier than this source-established tick. */
  earliestArrivalNotBeforeTick: number;
  motionRevision: number;
  evidence: DefensiveSearchEvidenceReference;
}>;

export type DefensiveSearchRunner = Readonly<{
  playerId: string;
  position: Vec2;
  velocity: Vec2;
  motionRevision: number;
  arrivals: readonly DefensiveSearchRunnerArrival[];
}>;

export type DefensiveSearchInput = Readonly<{
  match: CanonicalMatchState;
  batterRunnerId: string;
  observation: Readonly<{
    evidence: DefensiveSearchEvidenceReference;
    /** An independent accepted rule/physical owner must confirm that force
     * play remains live. A caught fly or an infield-fly retirement dissolves
     * the batter-created force chain even while a defender holds the ball. */
    forceContext: Readonly<{
      status: 'live_batted_ball_batter_active'
        | 'caught_fly_batter_retired'
        | 'infield_fly_batter_retired'
        | 'unresolved';
      /** Actual force obligations after accepted earlier OUT/SAFE facts.
       * Reconstructing from initial occupied bases would resurrect
       * an obligation that an already accepted force out dissolved. */
      forceState: ForceObligationState | null;
      evidence: DefensiveSearchEvidenceReference;
    }>;
    /** Secured physical custody established by the world owner, not a visual proximity guess. */
    ballCustody: Readonly<{
      holderId: string;
      securedAtTick: number;
      evidence: DefensiveSearchEvidenceReference;
    }>;
    defenders: readonly DefensiveSearchDefender[];
    runners: readonly DefensiveSearchRunner[];
  }>;
  baseCoverTargets: Readonly<Record<1 | 2 | 3 | 4, Vec2>>;
  ticksPerSecond: number;
  search: Readonly<{
    maxSteps: number;
    beamWidth: number;
    horizonThroughTick: number;
  }>;
}>;

/** Only a proposed physical action. No catch, controlled base contact, or OUT exists yet. */
export type HypotheticalDefensiveForceStep = Readonly<{
  kind: 'hypothetical_force_attempt';
  method: 'carry_ball_to_base' | 'throw_to_coverer';
  throwerId: string;
  receiverId: string;
  targetBase: 1 | 2 | 3 | 4;
  targetedRunnerId: string;
  forceClassification: ForceObligation['classification'];
  runnerMotionRevision: number;
  runnerObservedPosition: Vec2;
  /** A physical *earliest possible* timing bound; never a guaranteed completion. */
  earliestDecisionTick: number;
  earliestThrowReleaseTick: number | null;
  earliestThrowArrivalTick: number | null;
  earliestCoverReadyTick: number;
  earliestControlledBaseContactTick: number;
  runnerEarliestArrivalNotBeforeTick: number;
  opportunityMarginTicks: number;
  /** The actual source references used for this speculative path. */
  worldEvidence: DefensiveSearchEvidenceReference;
  runnerEvidence: DefensiveSearchEvidenceReference;
  condition: 'only_if_reception_possession_base_contact_and_rule_engine_confirm';
}>;

export type HypotheticalDefensivePlay = Readonly<{
  kind: 'hypothetical_only';
  steps: readonly HypotheticalDefensiveForceStep[];
  assumedRetiredRunnerIds: readonly string[];
  remainingForceObligations: readonly ForceObligation[];
  /** Search-state bookkeeping. NOT official outs or MatchState. */
  assumedOutsAfterForSearch: number;
  earliestLastStepTick: number;
  totalOpportunityMarginTicks: number;
  /** Existing Native host currently only accepts ball_handler/hold.
   * All paths must undergo real team-intent owner admission before actuation. */
  executionReadiness: 'requires_team_intent_owner_admission';
}>;

export type GeneralDefensivePhysicalAction =
  | 'carry_ball_to_base'
  | 'throw_launch'
  | 'secured_reception'
  | 'controlled_base_contact';

/** Capability claims must themselves come from the Native execution owner.
 * A caller's claimed capability is NOT proof of actual admission. */
export type GeneralDefensiveNativeOwnerCapabilities = Readonly<{
  admittedIntentKinds: readonly DefensiveIntent['kind'][];
  supportedPhysicalActions: readonly GeneralDefensivePhysicalAction[];
  supportsSequentialReplan: boolean;
}>;

export type GeneralDefensivePlanAdmissionAssessment = Readonly<{
  kind: 'owner_capability_missing' | 'requires_team_intent_owner_admission';
  requiredIntentKinds: readonly DefensiveIntent['kind'][];
  missingIntentKinds: readonly DefensiveIntent['kind'][];
  requiredPhysicalActions: readonly GeneralDefensivePhysicalAction[];
  missingPhysicalActions: readonly GeneralDefensivePhysicalAction[];
  requiresSequentialReplan: boolean;
  /** Never marks anything complete; actual Native owner must admit each step. */
  canExecute: false;
  confirmedOuts: null;
  officialResult: null;
}>;

/** Explicit fail-closed handoff gate for the currently limited Native host.
 * No adapter can silently promote a speculative multi-throw plan to a
 * completed or accepted physical action. */
export function assessGeneralDefensivePlanAdmission(
  plan: HypotheticalDefensivePlay,
  owner: GeneralDefensiveNativeOwnerCapabilities | null,
): GeneralDefensivePlanAdmissionAssessment {
  if (plan.kind !== 'hypothetical_only' || plan.executionReadiness !== 'requires_team_intent_owner_admission'
    || plan.steps.length === 0
    || plan.steps.some(step => step.kind !== 'hypothetical_force_attempt')) {
    throw new Error('Native execution handoff requires a nonempty hypothetical defensive plan.');
  }
  const intents = new Set<DefensiveIntent['kind']>(['ball_handler']);
  const actions = new Set<GeneralDefensivePhysicalAction>(['controlled_base_contact']);
  for (const step of plan.steps) {
    if (step.method === 'carry_ball_to_base') actions.add('carry_ball_to_base');
    else if (step.method === 'throw_to_coverer') {
      intents.add('base_cover');
      actions.add('throw_launch');
      actions.add('secured_reception');
    } else {
      throw new Error('Unrecognized physical defensive attempt.');
    }
  }
  const requiredIntentKinds = [...intents].sort();
  const requiredPhysicalActions = [...actions].sort();
  const missingIntentKinds = requiredIntentKinds.filter(
    kind => !owner?.admittedIntentKinds.includes(kind),
  );
  const missingPhysicalActions = requiredPhysicalActions.filter(
    kind => !owner?.supportedPhysicalActions.includes(kind),
  );
  const requiresSequentialReplan = plan.steps.length > 1;
  const lacking = missingIntentKinds.length > 0 || missingPhysicalActions.length > 0
    || (requiresSequentialReplan && owner?.supportsSequentialReplan !== true);
  return {
    kind: lacking ? 'owner_capability_missing' : 'requires_team_intent_owner_admission',
    requiredIntentKinds, missingIntentKinds, requiredPhysicalActions, missingPhysicalActions,
    requiresSequentialReplan,
    canExecute: false,
    confirmedOuts: null,
    officialResult: null,
  };
}

export type GeneralDefensivePlaySearchResult = Readonly<{
  kind: 'candidates' | 'insufficient_force_context' | 'insufficient_runner_evidence' | 'no_reachable_force_opportunity';
  source: DefensiveSearchEvidenceReference;
  /** At most beamWidth paths at each depth, sorted deterministically. */
  plans: readonly HypotheticalDefensivePlay[];
  selected: HypotheticalDefensivePlay | null;
  /** RuleEngine, official umpire, and RunnerDecision own actual future outcomes. */
  outcomeAuthority: 'external_native_physics_rules_and_umpire';
}>;

type DefenderForecastPosition = Readonly<{ position: Vec2; velocity: Vec2 }>;
type CandidateNode = Readonly<{
  holderId: string;
  holderPosition: Vec2;
  heldAtTick: number;
  positions: ReadonlyMap<string, DefenderForecastPosition>;
  usedReceivers: ReadonlySet<string>;
  forceState: ForceObligationState;
  plan: HypotheticalDefensivePlay;
}>;

function tick(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(name + ' must be a non-negative safe integer tick');
  }
}

function finite(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new Error(name + ' must be finite');
}

function positive(value: number, name: string): void {
  finite(value, name);
  if (value <= 0) throw new Error(name + ' must be positive');
}

function point(value: Vec2, name: string): void {
  if (!value || typeof value !== 'object') throw new Error(name + ' must exist');
  finite(value.x, name + '.x');
  finite(value.z, name + '.z');
}

function addTicks(a: number, b: number, name: string): number {
  const result = a + b;
  tick(result, name);
  return result;
}

function source(source: DefensiveSearchEvidenceReference, playId: number, at: number, label: string): void {
  if (!source || typeof source.sourceId !== 'string' || source.sourceId.length === 0
    || source.sourceId.trim() !== source.sourceId
    || !/^[a-f0-9]{64}$/.test(source.sourceHash)) {
    throw new Error(label + ' requires a complete accepted Native source reference');
  }
  tick(source.playId, label + '.playId');
  tick(source.revision, label + '.revision');
  tick(source.observedAtTick, label + '.observedAtTick');
  tick(source.availableAtTick, label + '.availableAtTick');
  if (source.playId !== playId || source.observedAtTick > source.availableAtTick
    || source.availableAtTick > at) {
    throw new Error(label + ' is future, stale, or from a foreign play');
  }
}

function validate(input: DefensiveSearchInput): void {
  const { match, observation, search } = input;
  tick(match.playId, 'match.playId');
  tick(match.outs, 'match.outs');
  if (match.outs > 2) throw new Error('Defensive search requires an active plate appearance.');
  if (!input.batterRunnerId || input.batterRunnerId.trim() !== input.batterRunnerId) {
    throw new Error('Batter-runner must have an accepted identity.');
  }
  tick(observation.evidence.observedAtTick, 'current observed tick');
  source(observation.evidence, match.playId, observation.evidence.observedAtTick, 'world');
  if (observation.evidence.availableAtTick !== observation.evidence.observedAtTick) {
    throw new Error('Defensive search requires an available current world observation.');
  }
  source(observation.ballCustody.evidence, match.playId, observation.evidence.observedAtTick, 'ball custody');
  source(observation.forceContext?.evidence, match.playId, observation.evidence.observedAtTick, 'force context');
  if (!['live_batted_ball_batter_active', 'caught_fly_batter_retired', 'infield_fly_batter_retired', 'unresolved']
    .includes(observation.forceContext.status)) {
    throw new Error('Unrecognized accepted Native force context.');
  }
  if (observation.forceContext.status === 'live_batted_ball_batter_active') {
    const original = createInitialForceObligationState(match.bases, input.batterRunnerId);
    const accepted = observation.forceContext.forceState;
    if (!accepted || accepted.batterRunnerId !== input.batterRunnerId
      || !Array.isArray(accepted.participants)
      || accepted.participants.length !== original.participants.length
      || accepted.participants.some((participant, i) => {
        const initial = original.participants[i];
        return !initial || participant.runnerId !== initial.runnerId
          || participant.startBase !== initial.startBase
          || typeof participant.active !== 'boolean'
          || typeof participant.obligationSatisfied !== 'boolean';
      })
      || accepted.participants[0].active !== true) {
      throw new Error('Accepted current force state is missing or contradicts the original canonical participants.');
    }
  }
  tick(observation.ballCustody.securedAtTick, 'ball custody securedAtTick');
  if (observation.ballCustody.securedAtTick > observation.evidence.observedAtTick) {
    throw new Error('Ball custody cannot come from the future.');
  }
  tick(input.ticksPerSecond, 'ticksPerSecond');
  if (input.ticksPerSecond === 0) throw new Error('ticksPerSecond must be positive.');
  tick(search.maxSteps, 'search.maxSteps');
  tick(search.beamWidth, 'search.beamWidth');
  tick(search.horizonThroughTick, 'search.horizonThroughTick');
  if (search.maxSteps < 1 || search.maxSteps > MAX_SEARCH_STEPS
    || search.beamWidth < 1 || search.beamWidth > MAX_BEAM_WIDTH
    || search.horizonThroughTick <= observation.evidence.observedAtTick) {
    throw new Error('Defensive search requires bounded horizon, steps and beam width.');
  }
  for (const base of BASES) point(input.baseCoverTargets[base], 'baseCoverTargets[' + base + ']');
  if (observation.defenders.length !== 9) throw new Error('Defensive search requires exactly nine actual defenders.');
  const ids = new Set<string>();
  const positions = new Set<DefensivePosition>();
  for (const defender of observation.defenders) {
    if (!defender.playerId || ids.has(defender.playerId)
      || !POSITIONS.includes(defender.registeredPosition)) {
      throw new Error('Defensive identities must be valid and unique.');
    }
    ids.add(defender.playerId);
    if (positions.has(defender.registeredPosition)) {
      throw new Error('Defensive search requires unique registered defensive positions.');
    }
    positions.add(defender.registeredPosition);
    point(defender.position, 'defender position');
    point(defender.velocity, 'defender velocity');
    positive(defender.topSpeedMps, 'topSpeedMps');
    positive(defender.accelerationMps2, 'accelerationMps2');
    finite(defender.baseCoverRadiusMeters, 'baseCoverRadiusMeters');
    if (defender.baseCoverRadiusMeters < 0) throw new Error('baseCoverRadiusMeters must not be negative.');
    positive(defender.maximumThrowSpeedMps, 'maximumThrowSpeedMps');
    tick(defender.throwTransferDelayTicks, 'throwTransferDelayTicks');
    tick(defender.receptionSecureDelayTicks, 'receptionSecureDelayTicks');
    finite(defender.situationalAwareness, 'situationalAwareness');
    if (defender.situationalAwareness < 0 || defender.situationalAwareness > 1) {
      throw new Error('situationalAwareness must be within [0,1].');
    }
    if (Math.hypot(defender.velocity.x, defender.velocity.z) > defender.topSpeedMps + 1e-9) {
      throw new Error('Observed defender velocity exceeds the physical top-speed source.');
    }
    resolveDefensiveDecisionTiming(observation.evidence.observedAtTick,
      defender.situationalAwareness, defender.decisionTiming);
  }
  if (!ids.has(observation.ballCustody.holderId)) {
    throw new Error('Confirmed ball holder must belong to one of the nine observed defenders.');
  }
  const force = observation.forceContext.status === 'live_batted_ball_batter_active'
    ? observation.forceContext.forceState!
    : createInitialForceObligationState(match.bases, input.batterRunnerId);
  const active = new Set(force.participants.filter(participant => participant.active)
    .map(participant => participant.runnerId));
  if (observation.runners.length !== active.size) {
    throw new Error('Every active runner must have an independent actual observed state.');
  }
  const runners = new Set<string>();
  for (const runner of observation.runners) {
    if (!active.has(runner.playerId) || runners.has(runner.playerId)) {
      throw new Error('Unexpected or duplicate physical runner identity.');
    }
    runners.add(runner.playerId);
    point(runner.position, 'runner position');
    point(runner.velocity, 'runner velocity');
    tick(runner.motionRevision, 'runner motionRevision');
    const bases = new Set<number>();
    for (const arrival of runner.arrivals) {
      if (!BASES.includes(arrival.targetBase) || bases.has(arrival.targetBase)) {
        throw new Error('Runner arrival evidence must have distinct real bases.');
      }
      bases.add(arrival.targetBase);
      source(arrival.evidence, match.playId, observation.evidence.observedAtTick, 'runner arrival');
      tick(arrival.motionRevision, 'runner arrival motionRevision');
      tick(arrival.earliestArrivalNotBeforeTick, 'runner earliest arrival');
      if (arrival.motionRevision !== runner.motionRevision
        || arrival.earliestArrivalNotBeforeTick < observation.evidence.observedAtTick) {
        throw new Error('Runner arrival evidence must match the current motion revision and physical clock.');
      }
    }
  }
}

/**
 * Optimistic physical travel lower bound: current speed magnitude, maximum
 * acceleration and top speed, ignoring turns/braking. It cannot certify real
 * defender arrival; all returned plans require physical follow-up.
 */
function earliestTravelTicks(
  from: DefenderForecastPosition,
  target: Vec2,
  defender: DefensiveSearchDefender,
  ticksPerSecond: number,
): number {
  const distance = Math.max(0,
    Math.hypot(target.x - from.position.x, target.z - from.position.z)
    - defender.baseCoverRadiusMeters);
  if (distance === 0) return 0;
  const initialSpeed = Math.min(defender.topSpeedMps,
    Math.hypot(from.velocity.x, from.velocity.z));
  const acceleration = defender.accelerationMps2;
  const maxSpeed = defender.topSpeedMps;
  const accelerateSeconds = (maxSpeed - initialSpeed) / acceleration;
  const acceleratedDistance = (initialSpeed + maxSpeed) * accelerateSeconds / 2;
  const seconds = distance <= acceleratedDistance
    ? (Math.sqrt(initialSpeed * initialSpeed + 2 * acceleration * distance)
      - initialSpeed) / acceleration
    : accelerateSeconds + (distance - acceleratedDistance) / maxSpeed;
  const time = Math.ceil(seconds * ticksPerSecond);
  tick(time, 'physical travel lower bound');
  return time;
}

function pathKey(steps: readonly HypotheticalDefensiveForceStep[]): string {
  return steps.map(s => [s.method, s.throwerId, s.receiverId, s.targetBase, s.targetedRunnerId].join(':')).join('|');
}

function comparePlans(a: HypotheticalDefensivePlay, b: HypotheticalDefensivePlay): number {
  const depthOrder = b.steps.length - a.steps.length;
  if (depthOrder !== 0) return depthOrder;
  const timeOrder = a.earliestLastStepTick - b.earliestLastStepTick;
  if (timeOrder !== 0) return timeOrder;
  const marginOrder = b.totalOpportunityMarginTicks - a.totalOpportunityMarginTicks;
  if (marginOrder !== 0) return marginOrder;
  const first = pathKey(a.steps);
  const second = pathKey(b.steps);
  return first < second ? -1 : first > second ? 1 : 0;
}

function child(
  input: DefensiveSearchInput,
  node: CandidateNode,
  receiver: DefensiveSearchDefender,
  obligation: ForceObligation,
  runner: DefensiveSearchRunner,
  arrival: DefensiveSearchRunnerArrival,
  byPlayerId: ReadonlyMap<string, DefensiveSearchDefender>,
): CandidateNode | null {
  const now = node.heldAtTick;
  const holder = byPlayerId.get(node.holderId)!;
  const baseTarget = input.baseCoverTargets[obligation.targetBase];
  const mover = node.positions.get(receiver.playerId)!;
  const coverDecision = resolveDefensiveDecisionTiming(
    now, receiver.situationalAwareness, receiver.decisionTiming,
  ).decisionTick;
  const coverReady = addTicks(
    coverDecision,
    earliestTravelTicks(mover, baseTarget, receiver, input.ticksPerSecond),
    'earliest cover tick',
  );
  const holderDecision = resolveDefensiveDecisionTiming(
    now, holder.situationalAwareness, holder.decisionTiming,
  ).decisionTick;
  const sameHolder = receiver.playerId === holder.playerId;
  let releaseTick: number | null = null;
  let flightArrivalTick: number | null = null;
  let controlledAt: number;
  if (sameHolder) {
    controlledAt = Math.max(holderDecision, coverReady);
  } else {
    const readyToThrow = addTicks(holderDecision, holder.throwTransferDelayTicks, 'throw readiness');
    const distance = Math.hypot(
      baseTarget.x - node.holderPosition.x,
      baseTarget.z - node.holderPosition.z,
    );
    const flightTicks = Math.ceil(distance / holder.maximumThrowSpeedMps * input.ticksPerSecond);
    tick(flightTicks, 'throw flight lower bound');
    // The thrower may wait for coverage. A receiver must reach the bag before
    // the ball arrives; possession and foot-contact still require real physics.
    releaseTick = Math.max(readyToThrow, coverReady - flightTicks);
    flightArrivalTick = addTicks(releaseTick, flightTicks, 'earliest ball arrival');
    controlledAt = addTicks(flightArrivalTick, receiver.receptionSecureDelayTicks, 'possible controlled contact');
  }
  if (controlledAt >= arrival.earliestArrivalNotBeforeTick
    || controlledAt > input.search.horizonThroughTick) return null;
  const margin = arrival.earliestArrivalNotBeforeTick - controlledAt;
  const step: HypotheticalDefensiveForceStep = {
    kind: 'hypothetical_force_attempt',
    method: sameHolder ? 'carry_ball_to_base' : 'throw_to_coverer',
    throwerId: holder.playerId,
    receiverId: receiver.playerId,
    targetBase: obligation.targetBase,
    targetedRunnerId: obligation.runnerId,
    forceClassification: obligation.classification,
    runnerMotionRevision: runner.motionRevision,
    runnerObservedPosition: { ...runner.position },
    earliestDecisionTick: holderDecision,
    earliestThrowReleaseTick: releaseTick,
    earliestThrowArrivalTick: flightArrivalTick,
    earliestCoverReadyTick: coverReady,
    earliestControlledBaseContactTick: controlledAt,
    runnerEarliestArrivalNotBeforeTick: arrival.earliestArrivalNotBeforeTick,
    opportunityMarginTicks: margin,
    worldEvidence: input.observation.evidence,
    runnerEvidence: arrival.evidence,
    condition: 'only_if_reception_possession_base_contact_and_rule_engine_confirm',
  };
  // Explicitly hypothetical branch. This never records an OUT or a MatchState
  // transition; the actual RuleEngine must later decide using contact facts.
  const hypotheticalForceState = retireForceParticipant(node.forceState, obligation.runnerId);
  const steps = [...node.plan.steps, step];
  const assumedRetiredRunnerIds = [...node.plan.assumedRetiredRunnerIds, obligation.runnerId];
  const remainingForceObligations = deriveCurrentForceObligations(hypotheticalForceState);
  const positions = new Map(node.positions);
  positions.set(receiver.playerId, { position: { ...baseTarget }, velocity: { x: 0, z: 0 } });
  const usedReceivers = new Set(node.usedReceivers);
  usedReceivers.add(receiver.playerId);
  return {
    holderId: receiver.playerId,
    holderPosition: { ...baseTarget },
    heldAtTick: controlledAt,
    positions,
    usedReceivers,
    forceState: hypotheticalForceState,
    plan: {
      kind: 'hypothetical_only',
      steps,
      assumedRetiredRunnerIds,
      remainingForceObligations,
      assumedOutsAfterForSearch: input.match.outs + steps.length,
      earliestLastStepTick: controlledAt,
      totalOpportunityMarginTicks: node.plan.totalOpportunityMarginTicks + margin,
      executionReadiness: 'requires_team_intent_owner_admission',
    },
  };
}

/**
 * Bounded, deterministic and *advisory* search of physical opportunities.
 * A branch assumes a possible force out only to explore what a second throw
 * could target. No RunnerDecision, umpire call, possession, safe/out ruling or
 * signed canonical evidence is altered. Actual Core owners must re-observe
 * and replan at every reception/control and runner-motion revision.
 */
export function searchGeneralDefensivePlay(input: DefensiveSearchInput): GeneralDefensivePlaySearchResult {
  validate(input);
  const world = input.observation;
  const now = world.evidence.observedAtTick;
  if (world.forceContext.status !== 'live_batted_ball_batter_active') {
    return {
      kind: 'insufficient_force_context',
      source: world.evidence,
      plans: [],
      selected: null,
      outcomeAuthority: 'external_native_physics_rules_and_umpire',
    };
  }
  const byPlayerId = new Map(world.defenders.map(defender => [defender.playerId, defender]));
  const runners = new Map(world.runners.map(runner => [runner.playerId, runner]));
  const forceState = world.forceContext.forceState!;
  const availableForce = deriveCurrentForceObligations(forceState);
  // A missing active runner's arrival cannot be filled in with a model guess;
  // even a different, seemingly easy throw must not hide the unknown.
  if (availableForce.some(obligation => !runners.get(obligation.runnerId)!.arrivals.some(
    arrival => arrival.targetBase === obligation.targetBase,
  ))) {
    return {
      kind: 'insufficient_runner_evidence',
      source: world.evidence,
      plans: [],
      selected: null,
      outcomeAuthority: 'external_native_physics_rules_and_umpire',
    };
  }
  const initialPlan: HypotheticalDefensivePlay = {
    kind: 'hypothetical_only', steps: [], assumedRetiredRunnerIds: [],
    remainingForceObligations: availableForce,
    assumedOutsAfterForSearch: input.match.outs,
    earliestLastStepTick: now,
    totalOpportunityMarginTicks: 0,
    executionReadiness: 'requires_team_intent_owner_admission',
  };
  const start: CandidateNode = {
    holderId: world.ballCustody.holderId,
    holderPosition: { ...byPlayerId.get(world.ballCustody.holderId)!.position },
    heldAtTick: now,
    positions: new Map(world.defenders.map(d => [d.playerId, {
      position: { ...d.position }, velocity: { ...d.velocity },
    }])),
    usedReceivers: new Set<string>(),
    forceState,
    plan: initialPlan,
  };
  const allPlans: HypotheticalDefensivePlay[] = [];
  const maxDepth = Math.min(input.search.maxSteps, 3 - input.match.outs);
  let frontier: CandidateNode[] = [start];
  let knownArrival = false;
  for (let depth = 0; depth < maxDepth; depth += 1) {
    const next: CandidateNode[] = [];
    for (const node of frontier) {
      for (const obligation of deriveCurrentForceObligations(node.forceState)) {
        const runner = runners.get(obligation.runnerId)!;
        const arrival = runner.arrivals.find(bound => bound.targetBase === obligation.targetBase);
        if (arrival === undefined) continue;
        knownArrival = true;
        // Delayed or already-passed runner timing cannot produce a new force.
        if (arrival.earliestArrivalNotBeforeTick <= node.heldAtTick) continue;
        for (const defender of world.defenders) {
          if (node.usedReceivers.has(defender.playerId)) continue;
          const proposed = child(input, node, defender, obligation, runner, arrival, byPlayerId);
          if (proposed !== null) next.push(proposed);
        }
      }
    }
    next.sort((a, b) => comparePlans(a.plan, b.plan));
    const seen = new Set<string>();
    const deduplicated = next.filter(node => {
      const key = pathKey(node.plan.steps);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    frontier = deduplicated.slice(0, input.search.beamWidth);
    allPlans.push(...frontier.map(node => node.plan));
    if (frontier.length === 0) break;
  }
  allPlans.sort(comparePlans);
  const plans = allPlans.slice(0, input.search.beamWidth);
  const kind = plans.length > 0 ? 'candidates'
    : knownArrival ? 'no_reachable_force_opportunity' : 'insufficient_runner_evidence';
  return {
    kind,
    source: world.evidence,
    plans,
    selected: plans[0] ?? null,
    outcomeAuthority: 'external_native_physics_rules_and_umpire',
  };
}
