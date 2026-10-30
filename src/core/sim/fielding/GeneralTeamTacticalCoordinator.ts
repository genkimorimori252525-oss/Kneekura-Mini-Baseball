import type { DefensivePosition } from '../../model/CanonicalWorldSnapshot';
import {
  findNextDefensiveReplanTick,
  type DefensiveReplanTrigger,
  type DefensiveReplanTriggerKind,
} from './DefensiveReplan';
import {
  assessGeneralDefensivePlanAdmission,
  searchGeneralDefensivePlay,
  type DefensiveSearchEvidenceReference,
  type DefensiveSearchInput,
  type GeneralDefensiveNativeOwnerCapabilities,
  type GeneralDefensivePlanAdmissionAssessment,
  type GeneralDefensivePlaySearchResult,
  type HypotheticalDefensivePlay,
} from './GeneralDefensivePlaySearch';
import {
  createTeamCoveragePlan,
  type TeamCoverageAssignment,
  type TeamCoveragePlan,
  type TeamCoveragePlanInput,
} from './TeamCoveragePlan';
import {
  replanTeamCoveragePlan,
  type TeamCoveragePlanRevision,
  type TeamCoverageReplanReason,
} from './TeamCoverageReplan';

/** An accepted owner reference is an opaque identity, never self-authenticating.
 * The Native owner must validate hashes/revisions and the live physical world
 * before invoking this projection. No signatures are minted by this module. */
export type TeamTacticalCoverageSource = Readonly<{
  evidence: DefensiveSearchEvidenceReference;
  defenders: readonly Readonly<{
    playerId: string;
    registeredPosition: DefensivePosition;
    evidence: DefensiveSearchEvidenceReference;
  }>[];
}>;

export type GeneralTeamTacticalInput = Readonly<{
  /** Candidate intent priorities already issued by each accepted defender's
   * perception/decision source. This coordinator invents none. */
  coverageInput: TeamCoveragePlanInput;
  coverageSource: TeamTacticalCoverageSource;
  /** Physically observed world/custody/runner constraints for the SAME play. */
  physical: DefensiveSearchInput;
  /** Optional externally supplied Native admission-capability declaration.
   * Even a complete declaration does not admit or execute a plan. */
  ownerCapabilities: GeneralDefensiveNativeOwnerCapabilities | null;
}>;

/** Every hypothesis remains independent of official rules and scoring. */
export type GeneralTeamTacticalOpportunity = Readonly<{
  kind: 'unexecuted_force_hypothesis';
  hypothesis: HypotheticalDefensivePlay;
  currentFirstStepCoverage:
    | 'receiver_already_assigned_to_target_base'
    | 'requires_new_coverage_assignment';
  admission: GeneralDefensivePlanAdmissionAssessment;
}>;

export type GeneralTeamTacticalReplanCause = Readonly<{
  trigger: DefensiveReplanTrigger;
  /** Authenticated externally by the Native source owner; its received time
   * must be no later than the actual recognition tick. */
  evidence: DefensiveSearchEvidenceReference;
  /** Use the existing generic TeamCoverageReplan reason taxonomy. */
  reason: TeamCoverageReplanReason;
}>;

export type GeneralTeamTacticalHandoff = Readonly<{
  kind: 'read_only_team_tactical_handoff_v1';
  /** Advisory revision, not a MatchState/official ledger revision. */
  revision: number;
  playId: number;
  observedAtTick: number;
  coverageSource: TeamTacticalCoverageSource;
  /** Exact accepted observed kinematics and runner/force context. */
  physical: DefensiveSearchInput;
  /** Original DP plan with all NINE defenders and original evidence metadata. */
  coverage: TeamCoveragePlan;
  roles: readonly TeamCoverageAssignment[];
  replan: TeamCoveragePlanRevision | null;
  cause: GeneralTeamTacticalReplanCause | null;
  searchStatus: GeneralDefensivePlaySearchResult['kind'];
  /** Alternatives in source search order, never chosen as an official play. */
  opportunities: readonly GeneralTeamTacticalOpportunity[];
  strategicSelection: Readonly<{
    kind: 'pending_evidence';
    owner: 'ThrowPlan';
    selected: null;
    reason: 'source_backed_throw_value_and_rule_context_required';
  }>;
  /** Host admission, executable motion, RuleEngine and umpire are external. */
  execution: Readonly<{
    status: 'requires_team_intent_owner_admission';
    canExecute: false;
    confirmedOuts: null;
    officialResult: null;
    nextMatchState: null;
  }>;
  sourceAuthority: 'opaque_refs_require_native_owner_verification';
}>;

const POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const;
const REASONS: readonly TeamCoverageReplanReason[] = [
  'ball_state_changed', 'runner_state_changed', 'possession_changed', 'communication_received',
];
const TRIGGERS: readonly DefensiveReplanTriggerKind[] = [
  'batted_ball_recognized', 'teammate_commitment_recognized', 'catch_outcome_recognized',
  'ball_direction_change_recognized', 'throw_start_recognized',
  'runner_motion_recognized', 'communication_received', 'coverage_need_changed',
];
/** Generic event semantics, independent of which base or play is involved.
 * coverage_need_changed is deliberately left to the accepted source reason:
 * a new coverage need can result from ball, runner or communication evidence. */
const KNOWN_CAUSE_REASON: Partial<Record<DefensiveReplanTriggerKind, TeamCoverageReplanReason>> = {
  batted_ball_recognized: 'ball_state_changed',
  teammate_commitment_recognized: 'possession_changed',
  catch_outcome_recognized: 'possession_changed',
  ball_direction_change_recognized: 'ball_state_changed',
  throw_start_recognized: 'possession_changed',
  runner_motion_recognized: 'runner_state_changed',
  communication_received: 'communication_received',
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error('General team tactical coordinator: ' + message);
}

function tick(value: unknown, name: string): asserts value is number {
  assert(Number.isSafeInteger(value) && (value as number) >= 0,
    name + ' must be a non-negative safe integer tick.');
}

function evidenceAt(
  source: DefensiveSearchEvidenceReference,
  playId: number,
  deadline: number,
  name: string,
): void {
  assert(source !== null && typeof source === 'object'
    && typeof source.sourceId === 'string'
    && source.sourceId.length > 0 && source.sourceId.trim() === source.sourceId
    && typeof source.sourceHash === 'string'
    && /^[a-f0-9]{64}$/.test(source.sourceHash),
  name + ' requires an accepted source ID/hash reference.');
  tick(source.playId, name + '.playId');
  tick(source.revision, name + '.revision');
  tick(source.observedAtTick, name + '.observedAtTick');
  tick(source.availableAtTick, name + '.availableAtTick');
  assert(source.playId === playId, name + ' belongs to a foreign play.');
  assert(source.observedAtTick <= source.availableAtTick
    && source.availableAtTick <= deadline,
  name + ' uses future or unavailable evidence.');
}

/** No browser/Node/SQLite interfaces, getters, class instances or aliases
 * can introduce mutable side effects across a retained tactical handoff. */
function frozenPureCopy<T>(input: T): T {
  const ancestors = new Set<object>();
  let count = 0;
  function visit(value: unknown, depth: number): unknown {
    count += 1;
    assert(count <= 150_000 && depth <= 64, 'evidence exceeds bounded pure-data limits.');
    if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
    if (typeof value === 'number') {
      assert(Number.isFinite(value), 'evidence has a nonfinite number.');
      return value === 0 ? 0 : value;
    }
    assert(typeof value === 'object' && value !== null, 'evidence must be pure data.');
    assert(!ancestors.has(value), 'cyclic evidence is forbidden.');
    ancestors.add(value);
    if (Array.isArray(value)) {
      assert(Reflect.ownKeys(value).length === value.length + 1, 'only dense arrays are accepted.');
      const values: unknown[] = [];
      for (let index = 0; index < value.length; index += 1) {
        const property = Object.getOwnPropertyDescriptor(value, String(index));
        assert(property?.enumerable && 'value' in property, 'array getters are forbidden.');
        values.push(visit(property.value, depth + 1));
      }
      ancestors.delete(value);
      return Object.freeze(values);
    }
    const proto = Object.getPrototypeOf(value);
    assert(proto === Object.prototype || proto === null, 'source evidence must be a plain record.');
    const record: Record<string, unknown> = {};
    for (const key of Reflect.ownKeys(value).sort()) {
      assert(typeof key === 'string', 'symbol evidence properties are forbidden.');
      const property = Object.getOwnPropertyDescriptor(value, key);
      assert(property?.enumerable && 'value' in property, 'object getters are forbidden.');
      Object.defineProperty(record, key, {
        value: visit(property.value, depth + 1),
        enumerable: true,
      });
    }
    ancestors.delete(value);
    return Object.freeze(record);
  }
  return visit(input, 0) as T;
}

function validateSourceBinding(input: GeneralTeamTacticalInput): number {
  const { physical, coverageSource, coverageInput } = input;
  assert(physical && physical.observation && physical.match,
    'physical Native match/observation evidence is mandatory.');
  const currentTick = physical.observation.evidence.observedAtTick;
  tick(currentTick, 'observation time');
  const playId = physical.match.playId;
  tick(playId, 'playId');
  evidenceAt(physical.observation.evidence, playId, currentTick, 'physical world');
  evidenceAt(coverageSource?.evidence, playId, currentTick, 'coverage owner');
  assert(coverageSource.evidence.observedAtTick <= currentTick,
    'team coverage source must not be observed after the actual world.');
  assert(coverageInput?.requireBallHandler === true,
    'a secured ball requires one explicitly assigned ball handler.');
  assert(Array.isArray(physical.observation.defenders)
    && physical.observation.defenders.length === 9
    && Array.isArray(coverageInput.defenders)
    && coverageInput.defenders.length === 9
    && Array.isArray(coverageSource.defenders)
    && coverageSource.defenders.length === 9,
  'all nine defender roles, source references and observed actors are mandatory.');
  const physicalById = new Map(physical.observation.defenders.map(defender => [defender.playerId, defender]));
  const candidateById = new Map(coverageInput.defenders.map(defender => [defender.playerId, defender]));
  assert(physicalById.size === 9 && candidateById.size === 9,
    'duplicate or missing defender identities are forbidden.');
  const observedPositions = new Set(physical.observation.defenders.map(defender => defender.registeredPosition));
  assert(observedPositions.size === 9 && POSITIONS.every(position => observedPositions.has(position)),
    'the observed team must have all nine distinct registered positions.');
  const provenPlayers = new Set<string>();
  for (const owner of coverageSource.defenders) {
    assert(owner && typeof owner.playerId === 'string' && !provenPlayers.has(owner.playerId),
      'duplicate or missing per-defender candidate owner.');
    provenPlayers.add(owner.playerId);
    const world = physicalById.get(owner.playerId);
    const candidates = candidateById.get(owner.playerId);
    assert(world && candidates && world.registeredPosition === owner.registeredPosition
      && candidates.registeredPosition === owner.registeredPosition,
    'candidate ownership and registered position must match the actual nine-player world.');
    evidenceAt(owner.evidence, playId, coverageSource.evidence.availableAtTick,
      'defender ' + owner.playerId);
    for (const candidate of candidates.candidates) {
      tick(candidate.evidenceAvailableAt, 'candidate evidenceAvailableAt');
      assert(candidate.evidenceAvailableAt <= owner.evidence.availableAtTick,
        'defender candidate uses future evidence outside its accepted owner revision.');
    }
  }
  return currentTick;
}

function requireCompleteCoverage(plan: TeamCoveragePlan, physical: DefensiveSearchInput): void {
  const defenders = physical.observation.defenders;
  assert(plan.assignments.length === 9, 'coverage planner did not retain all nine roles.');
  const assignments = new Map(plan.assignments.map(assignment => [assignment.playerId, assignment]));
  assert(assignments.size === 9, 'coverage planner duplicated a defender role.');
  for (const defender of defenders) {
    assert(assignments.get(defender.playerId)?.registeredPosition === defender.registeredPosition,
      'coverage role must correspond to each actual defender identity.');
  }
  const handlers = plan.assignments.filter(assignment => assignment.intent.kind === 'ball_handler');
  assert(handlers.length === 1
    && handlers[0].playerId === physical.observation.ballCustody.holderId,
  'the selected coverage ball handler must match authoritative secured custody.');
}

function describeOpportunities(
  plan: TeamCoveragePlan,
  physical: DefensiveSearchInput,
  capabilities: GeneralDefensiveNativeOwnerCapabilities | null,
): Readonly<{
  searchStatus: GeneralDefensivePlaySearchResult['kind'];
  opportunities: readonly GeneralTeamTacticalOpportunity[];
}> {
  const physicalSearch = searchGeneralDefensivePlay(physical);
  const owners = new Map(plan.assignments.map(assignment => [assignment.playerId, assignment]));
  const opportunities = physicalSearch.plans.map(hypothesis => {
    const first = hypothesis.steps[0];
    assert(first !== undefined, 'a source-backed force hypothesis requires a physical step.');
    const receiver = owners.get(first.receiverId);
    const aligned = first.method === 'throw_to_coverer'
      && receiver?.intent.kind === 'base_cover'
      && receiver.intent.base === first.targetBase;
    return {
      kind: 'unexecuted_force_hypothesis' as const,
      hypothesis,
      currentFirstStepCoverage: aligned
        ? 'receiver_already_assigned_to_target_base' as const
        : 'requires_new_coverage_assignment' as const,
      admission: assessGeneralDefensivePlanAdmission(hypothesis, capabilities),
    };
  });
  return { searchStatus: physicalSearch.kind, opportunities };
}

function buildHandoff(
  input: GeneralTeamTacticalInput,
  coverage: TeamCoveragePlan,
  revision: number,
  replan: TeamCoveragePlanRevision | null,
  cause: GeneralTeamTacticalReplanCause | null,
): GeneralTeamTacticalHandoff {
  requireCompleteCoverage(coverage, input.physical);
  const tactical = describeOpportunities(coverage, input.physical, input.ownerCapabilities);
  return frozenPureCopy({
    kind: 'read_only_team_tactical_handoff_v1',
    revision,
    playId: input.physical.match.playId,
    observedAtTick: input.physical.observation.evidence.observedAtTick,
    coverageSource: input.coverageSource,
    physical: input.physical,
    coverage,
    roles: coverage.assignments,
    replan,
    cause,
    searchStatus: tactical.searchStatus,
    opportunities: tactical.opportunities,
    strategicSelection: {
      kind: 'pending_evidence',
      owner: 'ThrowPlan',
      selected: null,
      reason: 'source_backed_throw_value_and_rule_context_required',
    },
    execution: {
      status: 'requires_team_intent_owner_admission',
      canExecute: false,
      confirmedOuts: null,
      officialResult: null,
      nextMatchState: null,
    },
    sourceAuthority: 'opaque_refs_require_native_owner_verification',
  });
}

/** Initial advisory. The team DP owns role decisions; the generic force
 * search exposes alternatives without promoting its speculative first plan.
 * ThrowPlan retains strategic ranking authority when authentic inputs exist. */
export function createGeneralTeamTacticalCoordinator(
  sourceInput: GeneralTeamTacticalInput,
): GeneralTeamTacticalHandoff {
  const input = frozenPureCopy(sourceInput);
  const observedAt = validateSourceBinding(input);
  for (const defender of input.coverageInput.defenders) {
    for (const candidate of defender.candidates) {
      assert(candidate.evidenceAvailableAt <= observedAt,
        'initial coverage may not consume future candidate cues.');
    }
  }
  const coverage = createTeamCoveragePlan(input.coverageInput);
  return buildHandoff(input, coverage, 0, null, null);
}

export type GeneralTeamTacticalRevisionInput = Readonly<{
  previous: GeneralTeamTacticalHandoff;
  expectedRevision: number;
  next: GeneralTeamTacticalInput;
  cause: GeneralTeamTacticalReplanCause;
}>;

/** Exactly one source-backed physical/perception trigger may change this
 * advisory at a later observation. The previous nine-player plan and its
 * provenance are retained; no physical/official world mutation occurs. */
export function replanGeneralTeamTacticalCoordinator(
  sourceInput: GeneralTeamTacticalRevisionInput,
): GeneralTeamTacticalHandoff {
  const input = frozenPureCopy(sourceInput);
  const { previous, expectedRevision, next, cause } = input;
  assert(previous?.kind === 'read_only_team_tactical_handoff_v1'
    && previous.execution?.canExecute === false
    && previous.strategicSelection?.selected === null
    && previous.coverage?.assignments.length === 9,
  'previous advisory must preserve the untouched nine-player handoff.');
  tick(previous.revision, 'previous advisory revision');
  tick(expectedRevision, 'expected advisory revision');
  assert(previous.revision === expectedRevision, 'stale advisory revision.');
  const nextTick = validateSourceBinding(next);
  assert(next.physical.match.playId === previous.playId, 'cannot replan a different play.');
  assert(nextTick > previous.observedAtTick, 'replan requires a later actual world observation.');
  assert(next.physical.observation.evidence.revision >= previous.physical.observation.evidence.revision,
    'physical observation revision regressed.');
  assert(next.physical.observation.evidence.sourceId
    !== previous.physical.observation.evidence.sourceId
    || next.physical.observation.evidence.revision
    > previous.physical.observation.evidence.revision,
  'replan requires a fresh accepted physical source or revision.');
  assert(next.coverageSource.evidence.revision > previous.coverageSource.evidence.revision
    && next.coverageSource.evidence.sourceId !== previous.coverageSource.evidence.sourceId,
  'replan needs a fresh accepted team coverage source revision.');
  assert(cause && TRIGGERS.includes(cause.trigger?.kind)
    && REASONS.includes(cause.reason),
  'replan requires a recognized actual defensive trigger and reason.');
  const expectedReason = KNOWN_CAUSE_REASON[cause.trigger.kind];
  assert(expectedReason === undefined || cause.reason === expectedReason,
    'replan reason contradicts its accepted perceived trigger.');
  tick(cause.trigger.perceivedAt, 'perceived trigger tick');
  const due = findNextDefensiveReplanTick(previous.observedAtTick, [cause.trigger]);
  assert(due === cause.trigger.perceivedAt
    && due <= nextTick,
  'replan trigger must be newer than the previous decision and known by the current world observation.');
  evidenceAt(cause.evidence, previous.playId, cause.trigger.perceivedAt, 'replan trigger');
  assert(next.coverageSource.evidence.availableAtTick >= cause.trigger.perceivedAt,
    'coverage source cannot predate the replan trigger it claims to handle.');
  const oldRunners = new Map(previous.physical.observation.runners.map(runner =>
    [runner.playerId, runner]));
  for (const runner of next.physical.observation.runners) {
    const prior = oldRunners.get(runner.playerId);
    assert(prior === undefined || runner.motionRevision >= prior.motionRevision,
      'runner motion revision regressed across team replan.');
  }
  const teamRevision = replanTeamCoveragePlan({
    previousPlan: previous.coverage,
    nextPlanInput: next.coverageInput,
    revisionTick: nextTick,
    reason: cause.reason,
  });
  assert(teamRevision.revisionTick === nextTick
    && teamRevision.changedPlayerIds.every(id => next.physical.observation.defenders.some(defender =>
      defender.playerId === id)),
  'team replan produced a role change outside the nine actual players.');
  return buildHandoff(next, teamRevision.plan, expectedRevision + 1, teamRevision, cause);
}
