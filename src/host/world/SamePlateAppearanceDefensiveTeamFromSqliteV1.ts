import type { DatabaseSync } from 'node:sqlite';
import { calculateDefensiveCandidatesV1 } from './DefensiveCandidateCalculationV1';
import { createTeamCoveragePlan } from '../../core/sim/fielding/TeamCoveragePlan';
import { actualDefensiveBoundary } from './ActualDefensiveContext';
import { deriveSamePaDefensiveSupportGeometry, samePaSupportIntentTarget } from './SamePlateAppearanceDefensiveSupportGeometry';
import { readSamePaPhysicalOperationFromSqlite } from './SamePlateAppearancePhysicalEpisodeFromSqlite';
import { readCurrentSamePaLifecycleViewFromSqlite, readHistoricalSamePaLifecycleViewFromSqlite,
  readSamePaLifecycleCalibrationFromSqlite } from './SamePlateAppearanceLifecycleFromSqlite';
import { playerDecisionModelEvidenceFromSqlite } from './SqlitePlayerDecisionModelStore';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { SamePaPhysicalAction, SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep, SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import type { SamePaLifecycleViewBasis } from './SamePlateAppearanceLifecycle';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaDefensiveCandidateSourceV1Input, type SamePaDefensiveCandidateActionResultV1,
  type SamePaDefensiveCandidateSetResultV1, type SamePaDefensiveTeamSelectionResultV1 } from './SamePlateAppearanceDefensiveCandidateSourceV1';

type Field = SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep;
type StepReference = SamePaReference<'pa_physical_v1_field_steps'>;
const ref = (field: Field) => reference(field.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', field);
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error('same-PA defensive team owner: ' + message);
}
const same = (a: unknown, b: unknown) => assert(json(a) === json(b), 'original Source, cut or calculation differs');
const result = (field: Field) => field.kind === 'same_pa_physical_field_step_v1' ? field.actionResult : undefined;
const metadataKinds = ['defender_observation_v1', 'defender_decision_v1', 'defender_candidate_set_v1', 'defender_team_selection_v1', 'defender_actor_selection_v1'];
const moment = (field: Field) => ({ originTick: field.field.motion.world.moment.originTick, elapsedSeconds: field.field.motion.world.moment.elapsedSeconds });

/** Native-private rederivation on the original DB. The physical store owns
 * Source acceptance/persistence; no caller candidate/target/calibration is used.
 * All three outputs are metadata and cannot issue or advance a body motor. */
export const deriveSamePaDefensiveTeamFromSqliteV1 = (db: DatabaseSync, source: SamePaPhysicalFieldStepSource, root: SamePaPhysicalFieldRoot,
  previous: Field, action: SamePaPhysicalAction, basis: SamePaLifecycleViewBasis, prefix: readonly Field[], current: boolean): SamePaDefensiveCandidateActionResultV1 => {
  assert(db.isTransaction && db.prepare('PRAGMA query_only').get()!.query_only === 1, 'requires a read-only transaction');
  const signature = () => json({ transaction: db.isTransaction, query: db.prepare('PRAGMA query_only').get()!.query_only,
    changes: db.prepare('SELECT total_changes() AS n').get()!.n, main: db.prepare('PRAGMA main.schema_version').get()!.schema_version,
    temp: db.prepare('PRAGMA temp.schema_version').get()!.schema_version });
  const before = signature(), request = samePaDefensiveCandidateSourceV1Input(source.action);
  assert(source.throughTick === previous.evaluationTick && previous.evaluationTick === basis.view.cut.evaluationTick, 'metadata cannot advance physical time');
  same(source.fieldRootReference, ref(root)); same(source.previousFieldReference, ref(previous)); same(prefix[0], root); same(prefix.at(-1), previous);
  const view = (current ? readCurrentSamePaLifecycleViewFromSqlite : readHistoricalSamePaLifecycleViewFromSqlite)(db, source.viewReference);
  same(view, basis); same(view.view.lineage, root.lineage); same(action.actor, view.actor);
  const linked = (original: StepReference): SamePaPhysicalFieldStep => {
    const value = prefix.find(field => field.source.sourceId === original.sourceId);
    assert(value?.kind === 'same_pa_physical_field_step_v1', 'dependency is outside the original field prefix'); same(ref(value), original);
    const owned = readSamePaPhysicalOperationFromSqlite(db, original).record;
    assert(owned.kind === 'same_pa_physical_field_step_v1', 'dependency owner kind differs');
    if (owned !== value) same(owned, value);
    same(owned.lineage, root.lineage); assert(owned.physicalPitchSourceId === root.physicalPitchSourceId, 'foreign physical pitch');
    same(owned.source.fieldRootReference, ref(root)); return owned;
  };
  // These checks bind the passed prefix to the real owner, including Source and snapshot hashes.
  const ownedRoot = readSamePaPhysicalOperationFromSqlite(db, ref(root)).record;
  if (ownedRoot !== root) same(ownedRoot, root);
  const ownedPrevious = readSamePaPhysicalOperationFromSqlite(db, ref(previous)).record;
  if (ownedPrevious !== previous) same(ownedPrevious, previous);
  const exact = (field: Field) => { assert(field.evaluationTick === previous.evaluationTick, 'foreign evaluation cut'); same(moment(field), moment(previous)); };
  const latest = (kind: 'defender_observation_v1' | 'defender_decision_v1', playerId: string) => [...prefix].reverse().find(field => {
    const value = result(field); return value?.kind === kind && value.playerId === playerId;
  });
  const unchangedSince = (field: Field) => {
    const index = prefix.findIndex(value => value.source.sourceId === field.source.sourceId); assert(index >= 0, 'original predecessor missing');
    for (const later of prefix.slice(index + 1)) {
      assert(later.kind === 'same_pa_physical_field_step_v1' && metadataKinds.includes(later.source.action?.kind ?? ''), 'catch, throw or physical work supersedes candidates');
      same({ field: later.field, timeline: later.timeline, evaluationTick: later.evaluationTick }, { field: field.field, timeline: field.timeline, evaluationTick: field.evaluationTick });
    }
  };
  const candidateFromDecision = (original: StepReference): SamePaDefensiveCandidateSetResultV1 => {
    const decision = linked(original), old = result(decision), decisionRequest = decision.source.action;
    assert(old?.kind === 'defender_decision_v1' && decisionRequest?.kind === 'defender_decision_v1', 'original owned defender decision missing');
    same(decision, latest('defender_decision_v1', old.playerId)); exact(decision); unchangedSince(decision);
    const observation = linked(decisionRequest.observationReference), observed = result(observation);
    assert(observed?.kind === 'defender_observation_v1' && observed.playerId === old.playerId, 'own observation missing');
    same(observation, latest('defender_observation_v1', old.playerId)); exact(observation);
    same(old.observationReference, decisionRequest.observationReference);
    same({ originTick: observed.receipt.at.originTick, elapsedSeconds: observed.receipt.at.elapsedSeconds }, moment(previous));
    const c = readSamePaLifecycleCalibrationFromSqlite(db, decisionRequest.calibrationReference);
    assert(c.source.route === 'defender_decision', 'original decision calibration route differs');
    same(c.source.member, decisionRequest.member); same(c.source.viewReference, decision.source.viewReference); same(c.lineage, root.lineage);
    const oldView = readHistoricalSamePaLifecycleViewFromSqlite(db, decision.source.viewReference);
    same(decisionRequest.member, oldView.members.find(member => member.playerId === old.playerId));
    const binding = action.actor.defenderBindings.find(binding => binding.playerId === old.playerId);
    const defender = action.actor.world.defenders.find(defender => defender.playerId === old.playerId);
    assert(binding && defender, 'actor is not one of the original nine defenders'); same(hash(binding), decisionRequest.member.bindingHash);
    const model = playerDecisionModelEvidenceFromSqlite(db).read(c.source.nominalReference.sourceId);
    assert(model, 'original nominal decision model missing'); same(reference('world_player_decision_models', model), c.source.nominalReference);
    same(hash(model.fieldingModel), observed.fieldingModelHash); same(old.fieldingModelHash, observed.fieldingModelHash);
    let commitment: Readonly<{ playerId: string; issuedAtTick: number }> | null = null;
    if (decisionRequest.supportGeometry?.teammateMotionReference) {
      const originalMotion = linked(decisionRequest.supportGeometry.teammateMotionReference), motor = result(originalMotion);
      const handlers = motor?.kind === 'defender_motion_v1' ? motor.motors.filter(value => value.intent.kind === 'ball_handler') : [];
      assert(motor?.kind === 'defender_motion_v1' && handlers.length === 1 && originalMotion.evaluationTick > handlers[0].segment.startTick
        && originalMotion.evaluationTick <= observed.receipt.at.tick && motor.coverageThroughTick >= observed.receipt.at.tick, 'original executed teammate commitment missing');
      const playerId = handlers[0].self.playerId;
      const motionIndex = prefix.findIndex(field => field.source.sourceId === originalMotion.source.sourceId);
      const observationIndex = prefix.findIndex(field => field.source.sourceId === observation.source.sourceId);
      assert(motionIndex >= 0 && observationIndex > motionIndex, 'teammate motion must precede the owned observation');
      assert(!prefix.slice(motionIndex + 1, observationIndex).some(field => {
        const value = result(field); return value?.kind === 'defender_motion_v1' && value.motors.some(motor => motor.self.playerId === playerId);
      }), 'teammate commitment was replaced');
      commitment = { playerId, issuedAtTick: originalMotion.evaluationTick };
    }
    const support = decisionRequest.supportGeometry ? deriveSamePaDefensiveSupportGeometry(decisionRequest.supportGeometry, observed.receipt, root.geometry, commitment, old.playerId) : null;
    same(old.supportGeometry ?? null, support);
    const calculation = calculateDefensiveCandidatesV1({ startedAtTick: actualDefensiveBoundary(observed.receipt.at, root.response.world.parameters.ticksPerSecond),
      ratings: { situationalAwareness: model.fieldingModel.source.ratings.situationalAwareness,
        firstStep: model.fieldingModel.source.ratings.firstStep }, decision: { self: { playerId: old.playerId }, perceivedWorld: observed.receipt.perceived,
        prePlayPlan: decisionRequest.priorities, perceivedCues: support?.cues ?? [] } }, c.source.response.values);
    same({ selected: calculation.selected, scheduling: calculation.scheduling }, old.calculation);
    return freeze({ kind: 'defender_candidate_set_v1', playerId: old.playerId, registeredPosition: defender.registeredPosition,
      member: decisionRequest.member, originalDecisionReference: original, observationReference: decisionRequest.observationReference,
      calibrationReference: decisionRequest.calibrationReference, calculation, availability: observed.receipt.at,
      fieldingModelHash: observed.fieldingModelHash, effectiveDecisionValuesHash: hash(c.source.response.values),
      supportRequest: decisionRequest.supportGeometry ?? null, supportGeometry: support, movementAdmission: false });
  };
  const candidate = (original: StepReference) => {
    const field = linked(original), value = result(field), candidateRequest = samePaDefensiveCandidateSourceV1Input(field.source.action);
    assert(value?.kind === 'defender_candidate_set_v1' && candidateRequest.kind === 'defender_candidate_set_v1', 'candidate-set Source kind differs'); exact(field);
    const expected = candidateFromDecision(candidateRequest.originalDecisionReference); same(value, expected); return expected;
  };
  const team = (originals: readonly StepReference[], requireBallHandler: boolean): SamePaDefensiveTeamSelectionResultV1 => {
    const candidates = originals.map(candidate), ids = candidates.map(candidate => candidate.playerId);
    same([...ids].sort(), action.actor.defenderBindings.map(binding => binding.playerId).sort());
    assert(new Set(ids).size === 9, 'duplicate or missing original defenders');
    return freeze({ kind: 'defender_team_selection_v1', candidateReferences: originals, requireBallHandler,
      plan: createTeamCoveragePlan({ requireBallHandler, defenders: candidates.map(candidate => ({ playerId: candidate.playerId,
        registeredPosition: candidate.registeredPosition, candidates: candidate.calculation.candidates })) }), availability: candidates[0].availability, movementAdmission: false });
  };
  let output: SamePaDefensiveCandidateActionResultV1;
  if (request.kind === 'defender_candidate_set_v1') output = candidateFromDecision(request.originalDecisionReference);
  else if (request.kind === 'defender_team_selection_v1') output = team(request.candidateReferences, request.requireBallHandler);
  else {
    same(request.member, basis.members.find(member => member.playerId === request.member.playerId));
    const teamField = linked(request.teamSelectionReference), stored = result(teamField), teamRequest = samePaDefensiveCandidateSourceV1Input(teamField.source.action);
    assert(stored?.kind === 'defender_team_selection_v1' && teamRequest.kind === 'defender_team_selection_v1', 'team selection Source kind differs');
    same(teamField, [...prefix].reverse().find(field => result(field)?.kind === 'defender_team_selection_v1')); exact(teamField);
    const expected = team(teamRequest.candidateReferences, teamRequest.requireBallHandler); same(stored, expected);
    const original = expected.candidateReferences.find(original => candidate(original).playerId === request.member.playerId);
    assert(original, 'actor is not an original candidate member'); const selected = candidate(original);
    const assignment = expected.plan.assignments.find(assignment => assignment.playerId === request.member.playerId); assert(assignment, 'actor assignment missing');
    const index = selected.calculation.candidates.findIndex(value => json({ intent: value.intent, selectedPriority: Math.round(value.localPriority * 1e12) / 1e12,
      evidenceAvailableAt: value.evidenceAvailableAt, evidenceKinds: value.evidenceKinds }) === json({ intent: assignment.intent, selectedPriority: assignment.selectedPriority,
      evidenceAvailableAt: assignment.evidenceAvailableAt, evidenceKinds: assignment.evidenceKinds }));
    assert(index >= 0, 'team assignment is not in the original actor candidate set'); const chosen = selected.calculation.candidates[index];
    const observation = linked(selected.observationReference), observed = result(observation); assert(observed?.kind === 'defender_observation_v1', 'actor observation missing');
    const target = selected.supportGeometry ? samePaSupportIntentTarget(chosen.intent, selected.supportGeometry, observed.receipt)
      : chosen.intent.kind === 'hold' ? null : chosen.intent.kind === 'ball_handler' ? observed.receipt.perceived.ball?.estimate.position
        : chosen.intent.kind === 'base_cover' ? root.geometry.bases[({ 1: 'first', 2: 'second', 3: 'third', 4: 'home' } as const)[chosen.intent.base]].region.center : chosen.intent.target;
    assert(target !== undefined, 'actor intent requires original perceived ball');
    output = freeze({ kind: 'defender_actor_selection_v1', playerId: request.member.playerId, member: request.member,
      teamSelectionReference: request.teamSelectionReference, candidateReference: original, originalDecisionReference: selected.originalDecisionReference,
      observationReference: selected.observationReference, assignment, candidate: chosen, candidateIndex: index, scheduling: selected.calculation.scheduling,
      target: target === null ? null : { x: target.x, z: target.z }, availability: selected.availability, fieldingModelHash: selected.fieldingModelHash, movementAdmission: false });
  }
  same(signature(), before); return output;
};
