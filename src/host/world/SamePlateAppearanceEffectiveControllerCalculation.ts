import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { deriveBattedWorldFieldMotionCheckpoint } from '../../core/sim/ball/BattedWorldFieldMotion';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields } from './SamePlateAppearanceWorkPrefix';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { calculateSamePaEffectiveDefenderCandidate } from './SamePlateAppearanceEffectiveDefenderCalculation';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite } from './SqliteBattedWorldFieldExecutionStore';
import { actualPlayerKinematicsEvidenceFromSqlite } from './SqliteActualPlayerKinematicsReader';
import { battedWorldMotionCommandsInput, battedWorldMotionPrimitiveCommands } from './SqliteBattedWorldMotionStore';
import { battedWorldFieldGeometry } from './BattedWorldFieldRoot';
import { battedWorldResponseInput } from './SqliteBattedWorldContinuationStore';
import { pendingOwnedScheduledPlan } from './OwnedScheduledMotionExecution';
import { withSamePaContinuationReadPhase } from './SamePlateAppearanceContinuationFromSqlite';

type DecisionInput = Readonly<{ source: Parameters<typeof calculateSamePaEffectiveDefenderCandidate>[1];
  motionInputs: Parameters<typeof calculateSamePaEffectiveDefenderCandidate>[2];
  values: Parameters<typeof calculateSamePaEffectiveDefenderCandidate>[3] }>;
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('effective controller original cut or command differs'); };

/** Internal original-owner calculation composition. Native reconstructs every
 * input; no caller supplies a self, issued result, actor or retained command.
 * The proposed field result is not adopted or persisted. Fresh same-PA use
 * still requires an owned batted-field cut and its complete current work census.
 * A completed TAKE crossing cannot provide that batted-field prerequisite. */
export const calculateSamePaEffectiveControllerCandidate = (db: DatabaseSync, raw: readonly DecisionInput[], rawThroughTick: number) =>
  withSamePaContinuationReadPhase(db, () => {
    const inputs = cloneInert(raw), throughTick = cloneInert(rawThroughTick);
    if (!Array.isArray(inputs) || !inputs.length || inputs.length > 9 || !Number.isSafeInteger(throughTick) || throughTick < 0
      || inputs.some(input => !samePaFields(input, ['source', 'motionInputs', 'values']))
      || new Set(inputs.map(input => input.source.member.playerId)).size !== inputs.length) throw new Error('invalid effective controller calculation inputs');
    const calculated = inputs.map(input => calculateSamePaEffectiveDefenderCandidate(db, input.source, input.motionInputs, input.values));
    const first = calculated[0].decisionCandidate.source, cut = first.originalInputReferences;
    for (const pair of calculated) {
      const source = pair.decisionCandidate.source;
      same(source.rightReference, first.rightReference); same(source.physicalSourceReference, first.physicalSourceReference);
      same(source.originalInputReferences.baseFieldReference, cut.baseFieldReference);
      same(source.originalInputReferences.executionReference, cut.executionReference);
    }
    // An unissued decision does not become an adopted hold or an empty command.
    if (calculated.some(pair => pair.commandCandidate === null)) return freeze({ kind: 'same_pa_effective_controller_pending_v1' as const,
      physicalEffect: 'none' as const, decisions: calculated, controllerCandidate: null });
    // Permission to create a command at an owned operation cut does not
    // authorize this generic kernel to advance through its acquisition/release.
    if (calculated.some(pair => pair.commandCandidate?.physicalAvailability.status !== 'unblocked_at_original_cut')) {
      throw new Error('effective controller pending owned operation requires operation-aware bridge');
    }
    const fields = battedWorldFieldEvidenceFromSqlite(db), executions = battedWorldFieldExecutionEvidenceFromSqlite(db);
    const base = fields.read(cut.baseFieldReference.sourceId); if (!base) throw new Error('effective controller original field missing');
    same(reference('batted_world_field_actions', base), cut.baseFieldReference);
    const prefix = cut.executionReference ? executions.scope(base, cut.executionReference.sourceId) : [];
    const previous = prefix.at(-1);
    if (cut.executionReference) {
      if (!previous) throw new Error('effective controller original execution missing');
      same(reference('batted_world_field_executions', previous), cut.executionReference);
    }
    // A newly planned acquisition may still report an unblocked command cut;
    // its owned physical plan independently prevents generic advancement.
    if (pendingOwnedScheduledPlan(prefix)) throw new Error('effective controller pending owned operation requires operation-aware bridge');
    const world = base.response.touch.worldContact, actor = world.flight.physicalPitch.frame.batterActor;
    if (!actor || actor.defenderBindings.length !== 9) throw new Error('effective controller original ten missing');
    const bindings = [actor.binding, ...actor.defenderBindings];
    if (new Set(bindings.map(binding => binding.playerId)).size !== 10
      || calculated.some(pair => !actor.defenderBindings.some(binding => binding.playerId === pair.decisionCandidate.source.member.playerId))) {
      throw new Error('effective controller requires original defender commands');
    }
    const kinematics = actualPlayerKinematicsEvidenceFromSqlite(db);
    const contributors = bindings.map(binding => {
      const self = kinematics.read({ physicalPitchSourceId: first.physicalSourceReference.sourceId, playerId: binding.playerId,
        baseFieldSourceId: cut.baseFieldReference.sourceId, executionSourceId: cut.executionReference?.sourceId ?? null, mode: 'original' });
      if (self.personId !== binding.personId || self.personLinkSourceId !== binding.personLinkSourceId || self.gameId !== binding.gameId
        || self.gameDay !== binding.gameDay || self.roles.length !== 5 || new Set(self.roles.map(role => role.role)).size !== 5) throw new Error('effective controller original self differs');
      const selected = calculated.find(pair => pair.decisionCandidate.source.member.playerId === binding.playerId)?.commandCandidate ?? null;
      if (selected) same(selected.motion.self, self);
      if (self.roles.some(role => Object.values(role.canonicalRoundingResidual.acceleration).some(value => value !== 0))) {
        throw new Error('effective controller cannot discard canonical acceleration residual');
      }
      const retainedRoles = self.roles.map(role => ({ role: role.role, command: self.activeCommand,
        acceptedThroughTick: Math.min(role.canonicalActor.primitive.endTick, self.activeCommand.acceptedThroughTick),
        offsetAcceleration: role.declaredPose.relativeAcceleration }));
      const coverageThroughTick = Math.min(self.activeCommand.acceptedThroughTick, ...retainedRoles.map(role => role.acceptedThroughTick),
        selected?.motion.coverageEndTick ?? self.activeCommand.acceptedThroughTick);
      const command = selected?.motion.command ?? { playerId: self.playerId, bodyAcceleration: self.root.acceleration,
        primitiveMotions: retainedRoles.map(role => ({ role: role.role, offsetAcceleration: role.offsetAcceleration })) };
      return { playerId: self.playerId, personId: self.personId, selfHash: hash(self), at: self.at, ticksPerSecond: self.ticksPerSecond,
        retainedCommand: self.activeCommand, retainedRoles, effectiveCommand: selected, command, coverageThroughTick };
    });
    const at = contributors[0].at, ticksPerSecond = contributors[0].ticksPerSecond;
    for (const contributor of contributors) { same(contributor.at, at); same(contributor.ticksPerSecond, ticksPerSecond); }
    const coverageThroughTick = Math.min(...contributors.map(contributor => contributor.coverageThroughTick));
    const checkpointThroughTick = Math.min(throughTick, coverageThroughTick);
    if ((checkpointThroughTick - at.originTick) / ticksPerSecond <= at.elapsedSeconds) throw new Error('effective controller requires positive covered progress');
    const originalField = previous?.execution.field ?? base.field, physical = [...prefix].reverse().find(value => ![
      'whole_play_history', 'base_touch_history', 'first_base_race', 'throw_plan', 'acquisition_plan',
      'owned_acquisition_plan_v1', 'owned_throw_plan_v1'].includes(value.execution.kind));
    let cursor = originalField.motion.cursor, carrierPlayerId = originalField.motion.carrierPlayerId;
    if (physical?.execution.kind === 'acquisition') {
      const acquired = physical.execution.acquisition;
      if (acquired.kind !== 'secured') throw new Error('effective controller acquisition unresolved');
      carrierPlayerId = acquired.acquirerPlayerId;
      cursor = { moment: acquired.moment, previousContacts: [{ kind: 'actor', playerId: carrierPlayerId, role: 'glove' }] };
    } else if (physical?.execution.kind === 'acquisition_advance') {
      const progress = physical.execution.progress;
      if (progress.kind !== 'secured') throw new Error('effective controller scheduled acquisition unresolved');
      carrierPlayerId = progress.acquisition.acquirerPlayerId; cursor = progress.cursor;
    }
    if (!cursor) throw new Error('effective controller requires an owned free physical cursor');
    same({ originTick: cursor.moment.originTick, elapsedSeconds: cursor.moment.elapsedSeconds, tick: cursor.moment.ball.tick }, at);
    const commands = contributors.map(contributor => contributor.command);
    const field = deriveBattedWorldFieldMotionCheckpoint({ response: battedWorldResponseInput(base.response), geometry: battedWorldFieldGeometry(base),
      actors: originalField.motion.actors, cursor, carrierPlayerId, availableAtTick: calculated[0].commandCandidate!.motion.segment.startTick,
      coverageThroughTick, checkpointThroughTick, commands: battedWorldMotionPrimitiveCommands(base.response, battedWorldMotionCommandsInput(commands)) });
    return freeze({ kind: 'same_pa_effective_controller_calculated_v1' as const, physicalEffect: 'none' as const, decisions: calculated,
      controllerCandidate: { kind: 'same_pa_effective_controller_candidate_v1' as const, baseFieldReference: cut.baseFieldReference,
        executionReference: cut.executionReference, sourceCoverage: 'explicit_original_calculation_inputs_only' as const,
        at, contributors, requestedThroughTick: throughTick, coverageThroughTick, checkpointThroughTick, commands, field } });
  });
