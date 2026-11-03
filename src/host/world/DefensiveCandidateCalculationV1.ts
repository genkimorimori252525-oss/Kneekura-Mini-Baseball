import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { DefensivePosition } from '../../core/model/CanonicalWorldSnapshot';
import { generateDefensiveIntentCandidates, type DefensiveIntentCandidate } from '../../core/sim/fielding/DefensiveDecision';
import { createPlayerDecisionCalibration, type PlayerDecisionCalibration } from '../../core/sim/fielding/PlayerDecisionCalibration';
import type { DefensiveSearchEvidenceReference } from '../../core/sim/fielding/GeneralDefensivePlaySearch';
import { createTeamCoveragePlan, type TeamCoveragePlan } from '../../core/sim/fielding/TeamCoveragePlan';
import { calculateDefensiveExecution, type DefensiveExecutionInput, type DefensiveExecutionCalculation } from './DefensiveExecutionCalculation';
import { actorFreeze, actorJson } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** Additive pure-data seam. No Source is admitted or authenticated here. */
export type DefensiveCandidateCalculationV1 = Readonly<{
  schemaVersion: 1; nativeAdmission: false;
  input: DefensiveExecutionInput; calibration: PlayerDecisionCalibration;
  candidates: readonly DefensiveIntentCandidate[];
  selected: DefensiveExecutionCalculation['selected']; scheduling: DefensiveExecutionCalculation['scheduling'];
}>;
export type DefensiveCandidateInputReferencesV1 = Readonly<{
  observation: DefensiveSearchEvidenceReference;
  decisionModel: DefensiveSearchEvidenceReference;
  plan: DefensiveSearchEvidenceReference;
  effectiveCalibration: DefensiveSearchEvidenceReference;
  geometry: DefensiveSearchEvidenceReference | null;
  /** One causal reference per perceived cue, in original cue order. */
  cues: readonly DefensiveSearchEvidenceReference[];
}>;
export type DefensiveCandidateSetProjectionInputV1 = Readonly<{
  reference: DefensiveSearchEvidenceReference;
  registeredPosition: DefensivePosition;
  input: DefensiveExecutionInput;
  calibration: PlayerDecisionCalibration;
  inputReferences: DefensiveCandidateInputReferencesV1;
}>;
export type DefensiveCandidateSetProjectionV1 = Readonly<{
  kind: 'defensive_candidate_set_projection_v1'; nativeAdmission: false;
  sourceAuthority: 'opaque_refs_require_native_owner_verification';
  reference: DefensiveSearchEvidenceReference; registeredPosition: DefensivePosition;
  inputReferences: DefensiveCandidateInputReferencesV1; calculation: DefensiveCandidateCalculationV1;
}>;
export type DefensiveTeamSelectionProjectionInputV1 = Readonly<{
  reference: DefensiveSearchEvidenceReference; requireBallHandler: boolean;
  defenders: readonly DefensiveCandidateSetProjectionV1[];
}>;
export type DefensiveTeamSelectionProjectionV1 = DefensiveTeamSelectionProjectionInputV1 & Readonly<{
  kind: 'defensive_team_selection_projection_v1'; nativeAdmission: false;
  sourceAuthority: 'opaque_refs_require_native_owner_verification'; plan: TeamCoveragePlan;
}>;
const POSITIONS: readonly DefensivePosition[] = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error('Defensive candidate projection: ' + message);
}
function fields(value: unknown, names: readonly string[]): void {
  assert(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('|') === [...names].sort().join('|'), 'unexpected fields');
}
function tick(value: number, name: string): void {
  assert(Number.isSafeInteger(value) && value >= 0, name + ' must be a nonnegative safe tick');
}
function referenceAt(ref: DefensiveSearchEvidenceReference, playId: number, deadline: number): void {
  fields(ref, ['sourceId', 'sourceHash', 'playId', 'revision', 'observedAtTick', 'availableAtTick']);
  assert(typeof ref.sourceId === 'string' && ref.sourceId.length > 0 && ref.sourceId.trim() === ref.sourceId
    && typeof ref.sourceHash === 'string' && /^[a-f0-9]{64}$/.test(ref.sourceHash), 'invalid opaque source reference');
  for (const key of ['playId', 'revision', 'observedAtTick', 'availableAtTick'] as const) tick(ref[key], key);
  assert(ref.playId === playId, 'reference belongs to a foreign play');
  assert(ref.observedAtTick <= ref.availableAtTick && ref.availableAtTick <= deadline, 'future or unavailable source reference');
}
function validatePerception(input: DefensiveExecutionInput): void {
  fields(input, ['decision', 'startedAtTick', 'ratings']);
  fields(input.ratings, ['situationalAwareness', 'firstStep']);
  fields(input.decision, ['self', 'perceivedWorld', 'prePlayPlan', 'perceivedCues']);
  fields(input.decision.self, 'registeredPosition' in input.decision.self ? ['playerId', 'registeredPosition', 'position'] : ['playerId']);
  fields(input.decision.prePlayPlan, ['ballPursuitPriority', 'baseCoverPriorities', 'relayPriority', 'backupPriority', 'deepCoveragePriority', 'holdPriority']);
  for (const priority of input.decision.prePlayPlan.baseCoverPriorities) {
    fields(priority, ['base', 'priority']); assert([1, 2, 3, 4].includes(priority.base), 'invalid known base priority');
  }
  const world = input.decision.perceivedWorld;
  fields(world, ['observerId', 'observationTime', 'attention', 'ball', 'players', 'communications', 'knownContext']);
  tick(input.startedAtTick, 'startedAtTick'); tick(world.observationTime, 'observationTime');
  assert(world.observationTime <= input.startedAtTick, 'future perceived world');
  assert(input.decision.self.playerId === world.observerId && world.observerId.trim().length > 0, 'own perception observer differs');
  const memoryAt = (memory: NonNullable<typeof world.ball> | typeof world.players[number]['memory']) => {
    tick(memory.sourceObservedAt, 'sourceObservedAt'); tick(memory.predictedAt, 'predictedAt');
    assert(memory.sourceObservedAt <= world.observationTime && memory.predictedAt === world.observationTime, 'future or stale perceived prediction');
  };
  if (world.ball) memoryAt(world.ball);
  const seen = new Set<string>();
  for (const player of world.players) { assert(!seen.has(player.playerId), 'duplicate perceived player'); seen.add(player.playerId); memoryAt(player.memory); }
  for (const received of world.communications) {
    tick(received.event.issuedAt, 'communication.issuedAt'); tick(received.receivedAt, 'communication.receivedAt');
    assert(received.event.issuedAt <= received.receivedAt && received.receivedAt <= world.observationTime, 'future communication');
  }
  for (const cue of input.decision.perceivedCues) {
    assert(['teammate_ball_commitment', 'base_needs_cover', 'relay_needed', 'backup_needed', 'deep_coverage_needed'].includes(cue.kind), 'unknown perceived cue');
    fields(cue, ['kind', 'observedAt', 'confidence', cue.kind === 'teammate_ball_commitment' ? 'playerId' : cue.kind === 'base_needs_cover' ? 'base' : 'target']);
    if ('target' in cue) { fields(cue.target, ['x', 'z']); assert(Number.isFinite(cue.target.x) && Number.isFinite(cue.target.z), 'invalid perceived cue target'); }
    if (cue.kind === 'teammate_ball_commitment') assert(cue.playerId !== world.observerId, 'teammate commitment cannot identify self');
    if (cue.kind === 'base_needs_cover') assert([1, 2, 3, 4].includes(cue.base), 'invalid perceived base');
  }
}
export const calculateDefensiveCandidatesV1 = (raw: DefensiveExecutionInput, rawCalibration: PlayerDecisionCalibration): DefensiveCandidateCalculationV1 => {
  const input = cloneInert(raw); validatePerception(input);
  const calibration = createPlayerDecisionCalibration(rawCalibration);
  const candidates = generateDefensiveIntentCandidates({ ...input.decision,
    minimumCueConfidence: calibration.minimumCueConfidence, communicationTrust: calibration.communicationTrust });
  const legacy = calculateDefensiveExecution(input, calibration);
  return actorFreeze(cloneInert({ schemaVersion: 1 as const, nativeAdmission: false as const, input, calibration, candidates, ...legacy }));
};
export const createDefensiveCandidateSetProjectionV1 = (raw: DefensiveCandidateSetProjectionInputV1): DefensiveCandidateSetProjectionV1 => {
  const input = cloneInert(raw); fields(input, ['reference', 'registeredPosition', 'input', 'calibration', 'inputReferences']);
  const calculation = calculateDefensiveCandidatesV1(input.input, input.calibration), cut = calculation.input.startedAtTick;
  const refs = input.inputReferences; fields(refs, ['observation', 'decisionModel', 'plan', 'effectiveCalibration', 'geometry', 'cues']);
  referenceAt(input.reference, input.reference.playId, cut);
  assert(input.reference.observedAtTick === cut, 'candidate reference cut differs');
  assert(POSITIONS.includes(input.registeredPosition), 'invalid registered position');
  for (const ref of [refs.observation, refs.decisionModel, refs.plan, refs.effectiveCalibration]) referenceAt(ref, input.reference.playId, cut);
  assert(refs.observation.observedAtTick === calculation.input.decision.perceivedWorld.observationTime, 'observation reference cut differs');
  if (refs.geometry) referenceAt(refs.geometry, input.reference.playId, cut);
  const cues = calculation.input.decision.perceivedCues;
  assert(Array.isArray(refs.cues) && refs.cues.length === cues.length, 'each cue requires its original causal reference');
  cues.forEach((cue, index) => { referenceAt(refs.cues[index], input.reference.playId, cue.observedAt);
    if ('target' in cue) assert(refs.geometry !== null && refs.geometry.availableAtTick <= cue.observedAt, 'target cue requires available known geometry'); });
  return actorFreeze(cloneInert({ kind: 'defensive_candidate_set_projection_v1' as const, nativeAdmission: false as const,
    sourceAuthority: 'opaque_refs_require_native_owner_verification' as const, reference: input.reference,
    registeredPosition: input.registeredPosition, inputReferences: refs, calculation }));
};
function verifyCandidate(value: DefensiveCandidateSetProjectionV1): DefensiveCandidateSetProjectionV1 {
  fields(value, ['kind', 'nativeAdmission', 'sourceAuthority', 'reference', 'registeredPosition', 'inputReferences', 'calculation']);
  const expected = createDefensiveCandidateSetProjectionV1({ reference: value.reference, registeredPosition: value.registeredPosition,
    inputReferences: value.inputReferences, input: value.calculation.input, calibration: value.calculation.calibration });
  assert(actorJson(value) === actorJson(expected), 'candidate calculation differs from original inputs'); return expected;
}
export const createDefensiveTeamSelectionProjectionV1 = (raw: DefensiveTeamSelectionProjectionInputV1): DefensiveTeamSelectionProjectionV1 => {
  const input = cloneInert(raw); fields(input, ['reference', 'requireBallHandler', 'defenders']);
  const cut = input.reference.observedAtTick; tick(cut, 'team cut'); referenceAt(input.reference, input.reference.playId, cut);
  assert(typeof input.requireBallHandler === 'boolean' && Array.isArray(input.defenders) && input.defenders.length === 9, 'team selection requires nine original defenders');
  const defenders = input.defenders.map(verifyCandidate);
  const ids = new Set<string>();
  for (const defender of defenders) { referenceAt(defender.reference, input.reference.playId, cut);
    const playerId = defender.calculation.input.decision.self.playerId;
    assert(!ids.has(playerId), 'duplicate player in team selection'); ids.add(playerId); }
  const plan = createTeamCoveragePlan({ requireBallHandler: input.requireBallHandler, defenders: defenders.map(defender => ({
    playerId: defender.calculation.input.decision.self.playerId, registeredPosition: defender.registeredPosition, candidates: defender.calculation.candidates })) });
  return actorFreeze(cloneInert({ ...input, defenders, kind: 'defensive_team_selection_projection_v1' as const,
    nativeAdmission: false as const, sourceAuthority: 'opaque_refs_require_native_owner_verification' as const, plan }));
};
export const extractDefensiveActorSelectionV1 = (raw: DefensiveTeamSelectionProjectionV1, playerId: string) => {
  const value = cloneInert(raw); fields(value, ['reference', 'requireBallHandler', 'defenders', 'kind', 'nativeAdmission', 'sourceAuthority', 'plan']);
  const expected = createDefensiveTeamSelectionProjectionV1({ reference: value.reference, requireBallHandler: value.requireBallHandler, defenders: value.defenders });
  assert(actorJson(value) === actorJson(expected), 'team selection differs from original candidates or has a role conflict');
  const defender = expected.defenders.find(candidate => candidate.calculation.input.decision.self.playerId === playerId);
  const assignment = expected.plan.assignments.find(candidate => candidate.playerId === playerId);
  assert(defender && assignment, 'actor is not an original team player');
  const candidate = defender.calculation.candidates.find(candidate => actorJson({ intent: candidate.intent, selectedPriority: Math.round(candidate.localPriority * 1e12) / 1e12,
    evidenceAvailableAt: candidate.evidenceAvailableAt, evidenceKinds: candidate.evidenceKinds }) === actorJson({ intent: assignment.intent,
    selectedPriority: assignment.selectedPriority, evidenceAvailableAt: assignment.evidenceAvailableAt, evidenceKinds: assignment.evidenceKinds }));
  assert(candidate, 'actor assignment is not an original candidate member');
  return actorFreeze(cloneInert({ kind: 'defensive_actor_selection_projection_v1' as const, nativeAdmission: false as const,
    sourceAuthority: 'opaque_refs_require_native_owner_verification' as const, teamReference: expected.reference,
    candidateReference: defender.reference, playerId, assignment, candidate, candidateIndex: defender.calculation.candidates.indexOf(candidate), scheduling: defender.calculation.scheduling }));
};
