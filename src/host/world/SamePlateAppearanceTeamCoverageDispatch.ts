import type { DefenderWorldState } from '../../core/model/CanonicalWorldSnapshot';
import type { DefensiveIntentCandidate } from '../../core/sim/fielding/DefensiveDecision';
import { createTeamCoveragePlan } from '../../core/sim/fielding/TeamCoveragePlan';
import { actorFreeze as freeze, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samePaPhysicalEpisodeSourceInput, type SamePaPhysicalFieldStepSource, type SamePaPhysicalOperationProof } from './SamePlateAppearancePhysicalEpisode';
import { openSqliteSamePlateAppearancePhysicalEpisodeStore } from './SqliteSamePlateAppearancePhysicalEpisodeStore';

/** Calculation only. Singleton candidates preserve each accepted individual
 * selection; this does not optimize the unavailable full candidate Sources.
 * Conflicting handlers or bags fail rather than replacing a decision. */
export const calculateSelectedTeamCoveragePlan = (defenders: readonly Pick<DefenderWorldState, 'playerId' | 'registeredPosition'>[],
  selections: readonly Readonly<{ playerId: string; selected: DefensiveIntentCandidate }>[]) => {
  if (defenders.length !== 9 || selections.length !== 9 || new Set(selections.map(s => s.playerId)).size !== 9
    || selections.some(s => !defenders.some(d => d.playerId === s.playerId))) throw new Error('team dispatch requires exactly nine original defender selections');
  return freeze(createTeamCoveragePlan({ requireBallHandler: true, defenders: defenders.map(d => ({ ...d,
    candidates: [selections.find(s => s.playerId === d.playerId)!.selected] })) }));
};

type Store = ReturnType<typeof openSqliteSamePlateAppearancePhysicalEpisodeStore>;
type Authority = Parameters<typeof openSqliteSamePlateAppearancePhysicalEpisodeStore>[1];
const same = (a: unknown, b: unknown, detail: string) => { if (hash(a) !== hash(b)) throw new Error('team dispatch ' + detail + ' differs'); };
const field = (proof: SamePaPhysicalOperationProof) => {
  if (proof.record.kind !== 'same_pa_physical_field_root_v1' && proof.record.kind !== 'same_pa_physical_field_step_v1')
    throw new Error('team dispatch requires an original field operation');
  return proof.record;
};

/** Privately reads the original SQLite owner. No caller-supplied actor, world,
 * motor, receipt or target can become execution evidence. Preparation is merely
 * an admission request; only the existing owner moves bodies and applies rules.
 * No schema, owner kind, or legacy TeamCoverageExecutionGate contract changes. */
export const openSqliteSamePlateAppearanceTeamCoverageDispatch = (path: string, authority?: Authority) => {
  const original = openSqliteSamePlateAppearancePhysicalEpisodeStore(path, authority);
  const prepare = (raw: SamePaPhysicalFieldStepSource) => {
    const source = samePaPhysicalEpisodeSourceInput(raw);
    if (source.capability !== 'same_pa_physical_field_step_v1' || source.action?.kind !== 'defender_motion_v1'
      || source.action.selections.length !== 9) throw new Error('team dispatch requires the original nine-selection motion Source');
    same(source.previousOperationReference, source.previousFieldReference, 'previous field');
    const previousProof = original.readOperation(source.previousFieldReference), previous = field(previousProof);
    same(previous.source.launchReference, source.launchReference, 'launch');
    same(previous.kind === 'same_pa_physical_field_root_v1' ? previousProof.reference : previous.source.fieldRootReference,
      source.fieldRootReference, 'root');
    if (source.throughTick <= previous.evaluationTick) throw new Error('team dispatch needs actual future execution coverage');
    const decisions = source.action.selections.map(selection => {
      const proof = original.readOperation(selection.decisionReference), value = field(proof);
      if (value.kind !== 'same_pa_physical_field_step_v1' || value.source.action?.kind !== 'defender_decision_v1'
        || value.actionResult?.kind !== 'defender_decision_v1' || value.actionResult.playerId !== selection.member.playerId)
        throw new Error('team dispatch requires each original selected defensive calculation');
      same(value.source.launchReference, source.launchReference, 'decision launch');
      same(value.source.fieldRootReference, source.fieldRootReference, 'decision root');
      same(value.lineage, previous.lineage, 'decision lineage');
      const decision = value.actionResult;
      same(value.source.action.observationReference, decision.observationReference, 'decision observation');
      const observation = field(original.readOperation(decision.observationReference));
      if (observation.kind !== 'same_pa_physical_field_step_v1' || observation.actionResult?.kind !== 'defender_observation_v1'
        || observation.actionResult.playerId !== selection.member.playerId) throw new Error('team dispatch original perception differs');
      if (decision.calculation.scheduling.movementStartTick > previous.evaluationTick
        || decision.availability.tick > previous.evaluationTick) throw new Error('team dispatch decision is not due at the original cut');
      return { playerId: decision.playerId, selected: decision.calculation.selected, target: decision.target,
        decisionReference: selection.decisionReference, observationReference: decision.observationReference,
        movementStartTick: decision.calculation.scheduling.movementStartTick };
    });
    const plan = calculateSelectedTeamCoveragePlan(previousProof.actor.world.defenders, decisions);
    return freeze({ status: 'requires_original_owner_admission' as const, selectionScope: 'accepted_individual_selected_only' as const,
      sourceHash: hash(source), planHash: hash(plan), plan, decisions,
      teamPlanAdopted: false as const, bodiesMoved: false as const, physicalOutsConfirmed: null, officialResult: null });
  };
  const read = (motionReference: Parameters<Store['readOperation']>[0]) => {
    const proof = original.readOperation(motionReference), value = field(proof);
    if (value.kind !== 'same_pa_physical_field_step_v1' || value.actionResult?.kind !== 'defender_motion_v1')
      throw new Error('team dispatch requires original accepted motion readback');
    const prepared = prepare(value.source), motors = value.actionResult.motors;
    if (motors.length !== 9 || new Set(motors.map(m => m.self.playerId)).size !== 9) throw new Error('team dispatch original nine motors missing');
    const actors = prepared.decisions.map(decision => {
      const motor = motors.find(m => m.self.playerId === decision.playerId);
      if (!motor || motor.command.playerId !== decision.playerId) throw new Error('team dispatch owned motor player differs');
      same(motor.intent, decision.selected.intent, 'owned motor intent');
      same(motor.target, decision.target, 'owned motor target');
      same(motor.self.physicalCutReference, value.source.previousFieldReference, 'owned motor current cut');
      same(motor.self.originalFieldReference, value.source.fieldRootReference, 'owned motor root');
      if (value.evaluationTick <= motor.segment.startTick || value.evaluationTick > motor.coverageEndTick)
        throw new Error('team dispatch motor has no actual executed coverage');
      const after = proof.physicalWorld.defenders.find(d => d.playerId === decision.playerId);
      if (!after) throw new Error('team dispatch original world defender missing');
      const displacementMeters = Math.hypot(after.position.x - motor.self.root.position.x, after.position.z - motor.self.root.position.z);
      if (!Number.isFinite(displacementMeters)) throw new Error('team dispatch executed displacement is non-finite');
      return { playerId: decision.playerId, decisionReference: decision.decisionReference, observationReference: decision.observationReference,
        intent: motor.intent, target: motor.target, startTick: motor.segment.startTick, executedThroughTick: value.evaluationTick,
        physicalCutReference: motor.self.physicalCutReference, displacementMeters };
    });
    return freeze({ status: 'original_owner_executed' as const, selectionScope: prepared.selectionScope,
      sourceHash: hash(value.source), planHash: prepared.planHash, plan: prepared.plan, motionReference: proof.reference, actors,
      teamPlanAdopted: true as const, bodiesMoved: actors.some(a => a.displacementMeters > 0),
      physicalOutsConfirmed: null, officialResult: null });
  };
  return { prepare, read, accept(sourceId: string, prepared: ReturnType<typeof prepare>) {
    // Source publication remains the original authority seam; cannot substitute
    // a prepared calculation for Native acceptance. Pending returns no receipt.
    const raw = authority?.readAcceptedOperation?.(sourceId);
    if (!raw) throw new Error('team dispatch original published Source is unavailable');
    const candidate = samePaPhysicalEpisodeSourceInput(raw, sourceId);
    if (candidate.capability !== 'same_pa_physical_field_step_v1') throw new Error('team dispatch published Source is not a field step');
    const actualPreparation = prepare(candidate);
    same(actualPreparation.sourceHash, prepared.sourceHash, 'prepared Source binding');
    same(actualPreparation.planHash, prepared.planHash, 'prepared plan binding');
    const value = original.acceptOperation(sourceId);
    if (value.kind !== 'same_pa_physical_field_step_v1') throw new Error('team dispatch original motion admission is pending');
    same(hash(value.source), prepared.sourceHash, 'prepared Source binding');
    const receipt = read(reference('pa_physical_v1_field_steps', value));
    same(receipt.planHash, prepared.planHash, 'prepared plan binding');
    return receipt;
  }, close: () => original.close() };
};
