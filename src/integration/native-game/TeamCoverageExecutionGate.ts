import type {
  CanonicalWorldSnapshot,
  DefenderWorldState,
  DefensivePosition,
} from '../../core/model/CanonicalWorldSnapshot';
import type { DefensiveIntent } from '../../core/sim/fielding/DefensiveDecision';
import type {
  TeamCoveragePlan,
  TeamCoverageAssignment,
} from '../../core/sim/fielding/TeamCoveragePlan';

/**
 * Isolated Native owner ADMISSION boundary, never a new fielder AI.
 * Current host stores accept only ball_handler/hold. Global TeamCoveragePlan
 * supports base_cover/relay/backup/deep_coverage, which still need authentic
 * issued sources and real physical motors. No silent fallback is permitted.
 */
const CURRENT_NATIVE_HOST_ADMITTED_INTENTS = new Set<DefensiveIntent['kind']>([
  'ball_handler', 'hold',
]);
const POSITIONS = new Set<DefensivePosition>([
  'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF',
]);

export type NativeTeamCoverageSourceReference = Readonly<{
  /** Reference only; a Native original owner still must authenticate it. */
  sourceId: string;
  sourceVersion: string;
  physicalPitchSourceId: string;
  playId: number;
  revision: number;
  sourceHash: string;
  observedAtTick: number;
  availableAtTick: number;
}>;

export type NativeTeamCoverageGateInput = Readonly<{
  reference: NativeTeamCoverageSourceReference;
  world: CanonicalWorldSnapshot;
  plan: TeamCoveragePlan;
}>;

export type NativeTeamCoverageBlockedActor = Readonly<{
  playerId: string;
  position: DefensivePosition;
  intent: DefensiveIntent['kind'];
  requires: 'native_owner_team_role_source_and_physical_motor';
}>;

export type NativeTeamCoverageAdmission = Readonly<{
  status: 'blocked_unsupported_team_intents' | 'eligible_for_individual_native_source_request';
  source: NativeTeamCoverageSourceReference;
  plan: TeamCoveragePlan;
  blockedActors: readonly NativeTeamCoverageBlockedActor[];
  eligibleIndividualRequests: readonly Readonly<{
    playerId: string;
    registeredPosition: DefensivePosition;
    intent: Extract<DefensiveIntent, { kind: 'hold' | 'ball_handler' }>;
    observedAtTick: number;
  }>[];
  authority: 'NATIVE_HOST_MUST_ADMIT_EACH_SOURCE_AND_CONFIRM_PHYSICAL_STATE';
  teamPlanAdopted: false;
  bodiesMoved: false;
  physicalOutsConfirmed: null;
  officialResult: null;
}>;

const finitePoint = (value: { x: number; z: number }, description: string): void => {
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.z)) {
    throw new Error(description + ' requires finite x/z');
  }
};
const validTick = (value: number, label: string): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(label + ' must be a non-negative safe integer');
  }
};
const sameRole = (actor: DefenderWorldState, assignment: TeamCoverageAssignment): boolean =>
  actor.playerId === assignment.playerId
  && actor.registeredPosition === assignment.registeredPosition;

function assertProvenance(input: NativeTeamCoverageGateInput): void {
  const { reference: ref, world } = input;
  if (!ref || !ref.sourceId?.trim() || !ref.sourceVersion?.trim()
    || !ref.physicalPitchSourceId?.trim() || !/^[a-f\d]{64}$/.test(ref.sourceHash)) {
    throw new Error('Native TeamCoverage requires original source identity and source digest');
  }
  validTick(ref.playId, 'playId');
  validTick(ref.revision, 'revision');
  validTick(ref.observedAtTick, 'observedAtTick');
  validTick(ref.availableAtTick, 'availableAtTick');
  validTick(world.tick, 'world.tick');
  if (ref.observedAtTick !== world.tick || ref.availableAtTick < ref.observedAtTick
    || ref.availableAtTick > world.tick) {
    throw new Error('Native TeamCoverage cannot use unavailable or future world observations');
  }
}

/**
 * Fail-closed all-or-nothing adoption gate. It never issues Native sources,
 * moves bodies, scores runs or calls the RuleEngine.
 */
export function inspectNativeTeamCoverageAdmission(
  input: NativeTeamCoverageGateInput,
): NativeTeamCoverageAdmission {
  assertProvenance(input);
  if (!input.plan || !Array.isArray(input.plan.assignments)
    || input.plan.assignments.length !== 9 || input.world.defenders.length !== 9) {
    throw new Error('Native TeamCoverage requires all nine original defenders and assignments');
  }
  const originalActors = new Map<string, DefenderWorldState>();
  const sourcePositions = new Set<DefensivePosition>();
  for (const actor of input.world.defenders) {
    if (!actor.playerId?.trim() || originalActors.has(actor.playerId)
      || sourcePositions.has(actor.registeredPosition)
      || !POSITIONS.has(actor.registeredPosition)) {
      throw new Error('Native TeamCoverage world identities or positions are duplicated');
    }
    finitePoint(actor.position, 'Native defender position');
    finitePoint(actor.velocity, 'Native defender velocity');
    originalActors.set(actor.playerId, actor);
    sourcePositions.add(actor.registeredPosition);
  }
  if (sourcePositions.size !== POSITIONS.size) {
    throw new Error('Native TeamCoverage world must provide every registered position');
  }
  const seenIds = new Set<string>();
  const occupiedBases = new Set<number>();
  let ballHandlers = 0;
  let priorityTotal = 0;
  const blocked: NativeTeamCoverageBlockedActor[] = [];
  const eligible: NativeTeamCoverageAdmission['eligibleIndividualRequests'][number][] = [];
  for (const assignment of input.plan.assignments) {
    const actor = originalActors.get(assignment.playerId);
    if (!actor || !sameRole(actor, assignment) || seenIds.has(assignment.playerId)) {
      throw new Error('Native TeamCoverage assignment does not match original world defender');
    }
    seenIds.add(assignment.playerId);
    validTick(assignment.evidenceAvailableAt, 'evidenceAvailableAt');
    if (assignment.evidenceAvailableAt > input.reference.availableAtTick) {
      throw new Error('Native TeamCoverage assignment uses future perceived evidence');
    }
    if (!Number.isFinite(assignment.selectedPriority) || assignment.selectedPriority < 0) {
      throw new Error('Native TeamCoverage assignment priority must be finite and nonnegative');
    }
    priorityTotal += assignment.selectedPriority;
    const intent = assignment.intent;
    if (intent.kind === 'ball_handler') {
      ballHandlers += 1;
    } else if (intent.kind === 'base_cover') {
      if (![1, 2, 3, 4].includes(intent.base) || occupiedBases.has(intent.base)) {
        throw new Error('Native TeamCoverage cannot assign multiple coverers to one base');
      }
      occupiedBases.add(intent.base);
    } else if (intent.kind === 'relay' || intent.kind === 'backup' || intent.kind === 'deep_coverage') {
      finitePoint(intent.target, 'Native ' + intent.kind + ' target');
    } else if (intent.kind !== 'hold') {
      throw new Error('Unrecognized Native TeamCoverage intent');
    }
    if (!CURRENT_NATIVE_HOST_ADMITTED_INTENTS.has(intent.kind)) {
      blocked.push({
        playerId: assignment.playerId, position: assignment.registeredPosition,
        intent: intent.kind, requires: 'native_owner_team_role_source_and_physical_motor',
      });
    } else if (intent.kind === 'hold' || intent.kind === 'ball_handler') {
      eligible.push({
        playerId: assignment.playerId, registeredPosition: assignment.registeredPosition,
        intent: { kind: intent.kind }, observedAtTick: assignment.evidenceAvailableAt,
      });
    }
  }
  if (seenIds.size !== 9 || ballHandlers > 1) {
    throw new Error('Native TeamCoverage roles have duplicate ball handlers or missing players');
  }
  if (!Number.isFinite(input.plan.totalPriority)
    || Math.abs(priorityTotal - input.plan.totalPriority) > 1e-9) {
    throw new Error('Native TeamCoverage plan priority summary differs from assignments');
  }
  const isBlocked = blocked.length > 0;
  return {
    status: isBlocked ? 'blocked_unsupported_team_intents' : 'eligible_for_individual_native_source_request',
    source: input.reference, plan: input.plan, blockedActors: blocked,
    eligibleIndividualRequests: isBlocked ? [] : eligible,
    authority: 'NATIVE_HOST_MUST_ADMIT_EACH_SOURCE_AND_CONFIRM_PHYSICAL_STATE',
    teamPlanAdopted: false, bodiesMoved: false,
    physicalOutsConfirmed: null, officialResult: null,
  };
}
