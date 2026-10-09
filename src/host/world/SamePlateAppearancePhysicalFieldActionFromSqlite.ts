import { deriveSamePaOccupiedRunnerCatchResponse, deriveSamePaOccupiedRunnerCatchMotion, assertSamePaOccupiedRunnerCatchOwnership } from './SamePlateAppearanceOccupiedRunnerCatchResponse';
import { assertSamePaBatterCatchOwnership } from './SamePlateAppearanceBatterCatchOwnership';
import { readBatterRunPlanFromSqlite } from './SqliteBatterRunPlanStore';
import { deriveSamePaBatterRunMotion } from './SamePlateAppearanceBatterRunMotion';
import type { DatabaseSync } from 'node:sqlite';
import { deriveBattedWorldFieldMotionCheckpoint } from '../../core/sim/ball/BattedWorldFieldMotion';
import { sampleExecutedFieldObservationWithCalibration } from './ExecutedFieldObservation';
import { calculateDefensiveExecution } from './DefensiveExecutionCalculation';
import { actualDefensiveBoundary } from './ActualDefensiveContext';
import { playerObservationModelEvidenceFromSqlite } from './SqlitePlayerObservationModelStore';
import { playerDecisionModelEvidenceFromSqlite } from './SqlitePlayerDecisionModelStore';
import { playerLocomotionModelEvidenceFromSqlite } from './SqlitePlayerLocomotionModelStore';
import { playerFieldingModelEvidenceFromSqlite } from './SqlitePlayerFieldingModelStore';
import { readBattingPerceptionFromSqlite } from './SqliteBattingPerceptionStore';
import { readSamePaLifecycleCalibrationFromSqlite, readCurrentSamePaLifecycleCalibrationFromSqlite } from './SamePlateAppearanceLifecycleFromSqlite';
import { samePaPhysicalDefenderSelf, deriveSamePaPhysicalFieldMotor } from './SamePlateAppearancePhysicalFieldMotor';
import { deriveSamePaPhysicalFieldCapture } from './SamePlateAppearancePhysicalFieldCapture';
import { assertSamePaPhysicalThrowOwnership, deriveSamePaPhysicalThrowPlan, deriveSamePaPhysicalThrowCheckpoint, samePaPhysicalHasThrowRelease } from './SamePlateAppearancePhysicalFieldThrow';
import { samePaPhysicalTimelineAtField } from './SamePlateAppearancePhysicalFieldCalculation';
import { readSamePaCatchObservationFromSqlite } from './SamePlateAppearanceCatchObservationFromSqlite';
import { deriveSamePaCatchDefenderResponse } from './SamePlateAppearanceCatchDefenderResponse';
import { deriveSamePaPhysicalQuantizerCheckpoint } from './SamePlateAppearancePhysicalQuantizerCheckpoint';
import { deriveSamePaBatterCatchResponse } from './SamePlateAppearanceBatterCatchResponse';
import { deriveSamePaBatterCatchMotion } from './SamePlateAppearanceBatterCatchMotion';
import type { SamePaPhysicalFieldActionResult, SamePaPhysicalFieldReference } from './SamePlateAppearancePhysicalFieldAction';
import type { SamePaPhysicalAction, SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep, SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import type { SamePaLifecycleViewBasis } from './SamePlateAppearanceLifecycle';
import type { SamePaDispatchMember } from './SamePlateAppearanceDispatchRoles';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
type Field = SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep;
const fieldReference = (field: Field) => reference(field.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', field);
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('physical field action original dependency differs'); };
const result = (step: Field) => step.kind === 'same_pa_physical_field_step_v1' ? step.actionResult : undefined;
const noAdvance = (field: Field) => result(field)?.kind === 'defender_observation_v1' || result(field)?.kind === 'defender_decision_v1' || result(field)?.kind === 'defender_catch_response_v1' || result(field)?.kind === 'batter_catch_response_v1' || result(field)?.kind === 'occupied_runner_catch_response_v1';
/** Reconstruct the actual episode graph on the Native owner's pinned read phase.
 * Sources contain only accepted input references, view geometry and priorities. */
export const deriveSamePaPhysicalFieldAction = (db: DatabaseSync, source: SamePaPhysicalFieldStepSource, root: SamePaPhysicalFieldRoot,
  previous: Field, action: SamePaPhysicalAction, basis: SamePaLifecycleViewBasis, prefix: readonly Field[], current: boolean) => {
  const request = source.action;
  if (!request || root.physicalPitchSourceId !== previous.physicalPitchSourceId || root.physicalPitchSourceId !== action.physicalPitchSourceId
    || previous.evaluationTick !== basis.view.cut.evaluationTick || source.throughTick < previous.evaluationTick) throw new Error('physical field action cut differs');
  same(source.viewReference, reference('pa_lifecycle_v1_execution_views', basis.view));
  same(source.fieldRootReference, fieldReference(root));
  if (!prefix.length || prefix[0].source.sourceId !== root.source.sourceId) throw new Error('physical field action original prefix missing');
  same(fieldReference(prefix.at(-1)!), source.previousFieldReference);
  assertSamePaPhysicalThrowOwnership(source, prefix);
  assertSamePaBatterCatchOwnership(source, prefix);
  assertSamePaOccupiedRunnerCatchOwnership(source, prefix);
  if (request.kind === 'retained_quantizer_checkpoint_v1') return deriveSamePaPhysicalQuantizerCheckpoint(source, root, previous);
  const linked = (ref: SamePaPhysicalFieldReference): Field => {
    const value = prefix.find(v => v.source.sourceId === ref.sourceId);
    if (!value) throw new Error('physical field dependency is outside the original prefix');
    same(fieldReference(value), ref); return value;
  };
  const calibration = (member: SamePaDispatchMember, ref: SamePaReference<'pa_lifecycle_v1_execution_calibrations'>) => {
    same(member, basis.members.find(m => m.playerId === member.playerId));
    if (!action.actor.defenderBindings.some(b => b.playerId === member.playerId)) throw new Error('physical field action requires original defender');
    const c = (current ? readCurrentSamePaLifecycleCalibrationFromSqlite : readSamePaLifecycleCalibrationFromSqlite)(db, ref);
    same(c.source.member, member); same(c.source.viewReference, source.viewReference); same(c.lineage, root.lineage);
    return c.source;
  };
  const stable = (actionResult: SamePaPhysicalFieldActionResult) => {
    if (source.throughTick !== previous.evaluationTick) throw new Error('physical sensory or decision action cannot advance the ball');
    return freeze({ field: previous.field, evaluationTick: previous.evaluationTick, timeline: previous.timeline, actionResult });
  };
  const latest = (kind: 'defender_observation_v1' | 'defender_decision_v1', playerId: string) => [...prefix].reverse().find(f => {
    const r = result(f); return r?.kind === kind && r.playerId === playerId;
  });
  if (request.kind === 'occupied_runner_catch_response_v1') return stable(deriveSamePaOccupiedRunnerCatchResponse(db, source, root, previous, basis, prefix));
  if (request.kind === 'occupied_runner_catch_motion_v1') return deriveSamePaOccupiedRunnerCatchMotion(source, root, previous, prefix);
  if (request.kind === 'batter_catch_response_v1') return stable(deriveSamePaBatterCatchResponse(db, source, root, previous, basis, prefix));
  if (request.kind === 'batter_catch_motion_v1') return deriveSamePaBatterCatchMotion(source, root, previous, prefix);
  if (request.kind === 'defender_observation_v1') {
    const c = calibration(request.member, request.calibrationReference);
    if (c.route !== 'defender_observation') throw new Error('physical observation effective route differs');
    const model = playerObservationModelEvidenceFromSqlite(db).read(c.nominalReference.sourceId);
    if (!model) throw new Error('physical observation nominal model missing');
    same(reference('world_player_observation_models', model), c.nominalReference);
    const old = latest('defender_observation_v1', request.member.playerId);
    same(request.previousObservationReference, old ? fieldReference(old) : null);
    const r = old && result(old), prior = r?.kind === 'defender_observation_v1' ? { source: r.samplingRequest, receipt: r.receipt } : null;
    const samplingRequest = { sourceId: source.sourceId, sourceVersion: source.sourceVersion, physicalPitchSourceId: root.physicalPitchSourceId,
      playerId: request.member.playerId, baseFieldSourceId: root.source.sourceId, executionSourceId: previous.source.sourceId,
      observationModelSourceId: c.nominalReference.sourceId, previousObservationSourceId: old?.source.sourceId ?? null, view: request.view };
    const motion = previous.field.motion, moment = motion.world.moment;
    // A pending glove constraint has sampleable truth but no possession/cursor.
    const ballMoment = motion.cursor?.moment ?? (motion.response.kind === 'capture_pending' ? moment : null);
    const receipt = sampleExecutedFieldObservationWithCalibration(samplingRequest, {
      at: { originTick: moment.originTick, elapsedSeconds: moment.elapsedSeconds, tick: moment.ball.tick },
      ticksPerSecond: root.response.world.parameters.ticksPerSecond, matchSeed: action.source.nominalPitch.delivery.matchSeed,
      playId: root.lineage.playId, playerIds: [action.actor.binding.playerId, ...action.actor.defenderBindings.map(b => b.playerId), ...action.actor.world.runners.map(r => r.playerId)],
      actors: motion.actors, surfaces: root.response.world.surfaces, bases: Object.values(root.geometry.bases), ballMoment,
    }, c.response.values, prior);
    const received = request.catchWorkReference ? readSamePaCatchObservationFromSqlite(db, request.catchWorkReference, basis, previous, receipt) : { receipt };
    return stable({ kind: request.kind, playerId: request.member.playerId, samplingRequest, ...received, fieldingModelHash: hash(model.fieldingModel) });
  }
  if (request.kind === 'defender_decision_v1') {
    const response = [...prefix].reverse().find(f => { const r = result(f); return r?.kind === 'defender_catch_response_v1' && r.playerId === request.member.playerId; });
    if (response && !prefix.slice(prefix.indexOf(response) + 1).some(f => f.kind === 'same_pa_physical_field_step_v1'
      && f.source.action?.kind === 'defender_motion_v1' && f.source.action.selections.some(s => s.member.playerId === request.member.playerId
        && json(s.decisionReference) === json(fieldReference(response))))) throw new Error('received caught response still owns defender decision work');
    const c = calibration(request.member, request.calibrationReference);
    if (c.route !== 'defender_decision') throw new Error('physical decision effective route differs');
    const observation = linked(request.observationReference), r = result(observation);
    same(observation, latest('defender_observation_v1', request.member.playerId));
    if (r?.kind !== 'defender_observation_v1' || r.playerId !== request.member.playerId) throw new Error('physical decision owned observation missing');
    const model = playerDecisionModelEvidenceFromSqlite(db).read(c.nominalReference.sourceId);
    if (!model) throw new Error('physical decision nominal model missing');
    same(reference('world_player_decision_models', model), c.nominalReference); same(hash(model.fieldingModel), r.fieldingModelHash);
    const at = r.receipt.at, p = root.response.world.parameters.ticksPerSecond;
    const calculation = calculateDefensiveExecution({ decision: { perceivedWorld: r.receipt.perceived, self: { playerId: r.playerId },
      prePlayPlan: request.priorities, perceivedCues: [] }, startedAtTick: actualDefensiveBoundary(at, p), ratings: model.fieldingModel.source.ratings }, c.response.values);
    if (calculation.selected.intent.kind !== 'hold' && calculation.selected.intent.kind !== 'ball_handler') throw new Error('physical field decision requires an existing supported intent');
    const target = calculation.selected.intent.kind === 'hold' ? null : r.receipt.perceived.ball?.estimate.position;
    if (target === undefined) throw new Error('physical field pursuit requires perceived ball evidence');
    return stable({ kind: request.kind, playerId: request.member.playerId, observationReference: request.observationReference, calculation,
      target: target === null ? null : { x: target.x, z: target.z }, availability: at, fieldingModelHash: hash(model.fieldingModel) });
  }
  if (request.kind === 'defender_catch_response_v1') return stable(deriveSamePaCatchDefenderResponse(db, source, root, previous, basis, prefix));
  if (request.kind === 'capture_checkpoint_v1') {
    const physical = [...prefix].reverse().find(f => !noAdvance(f));
    if (!physical) throw new Error('physical capture predecessor missing');
    const candidate = linked(request.candidateReference), boundary = candidate.field.motion.world;
    const contact = boundary.kind === 'boundary' && boundary.contacts.length === 1 ? boundary.contacts[0] : null;
    if (contact?.kind !== 'actor' || !action.actor.defenderBindings.some(b => b.playerId === contact.playerId)) throw new Error('physical acquisition requires an original defender');
    const value = deriveSamePaPhysicalFieldCapture(source, root, physical, candidate);
    return freeze({ ...value, timeline: previous.timeline });
  }
  if (request.kind === 'throw_checkpoint_v1') return deriveSamePaPhysicalThrowCheckpoint(source, root, previous, prefix);
  if (request.kind === 'throw_plan_v1') {
    const c = calibration(request.member, request.calibrationReference);
    if (c.route !== 'defender_throw') throw new Error('physical throw effective route differs');
    const model = playerFieldingModelEvidenceFromSqlite(db).read(c.nominalReference.sourceId);
    if (!model) throw new Error('physical throw nominal fielding model missing');
    same(reference('world_player_fielding_models', model), c.nominalReference);
    const posture = readBattingPerceptionFromSqlite(db, 'posture', root.source.postureReference);
    if (posture.kind !== 'batting_invocation_posture') throw new Error('physical throw original bodies missing');
    for (const playerId of [request.member.playerId, request.receiverPlayerId]) {
      const body = posture.sceneBodies.find(b => b.source.playerId === playerId);
      if (!body) throw new Error('physical throw original Person body missing');
      samePaPhysicalDefenderSelf(action, root, previous, body.actor);
    }
    return deriveSamePaPhysicalThrowPlan(source, root, previous, action, model, c.response.values);
  }
  if (request.kind === 'batter_run_motion_v1') {
    if (prefix.some(f => f.kind === 'same_pa_physical_field_step_v1' && f.actionResult?.kind === 'batter_catch_response_v1'))
      throw new Error('received batter response supersedes the original advance controller');
    const plan = readBatterRunPlanFromSqlite(db, request.planReference);
    if (plan.playerId !== action.actor.binding.playerId || plan.personId !== action.actor.binding.personId) throw new Error('physical batter-run original actor differs');
    return deriveSamePaBatterRunMotion(source, root, previous, plan, prefix);
  }
  const motion = previous.field.motion, p = root.response.world.parameters;
  if (!motion.cursor || source.throughTick <= previous.evaluationTick) throw new Error('physical moving field requires a resolved cursor and covered progress');
  const posture = readBattingPerceptionFromSqlite(db, 'posture', root.source.postureReference);
  if (posture.kind !== 'batting_invocation_posture') throw new Error('physical moving field original bodies missing');
  const at = { originTick: motion.world.moment.originTick, elapsedSeconds: motion.world.moment.elapsedSeconds, tick: motion.world.moment.ball.tick };
  const motors = request.selections.map(selection => {
    const c = calibration(selection.member, selection.calibrationReference);
    if (c.route !== 'defender_locomotion') throw new Error('physical movement effective route differs');
    const decision = linked(selection.decisionReference), d = result(decision);
    same(decision, [...prefix].reverse().find(f => { const r = result(f); return (r?.kind === 'defender_decision_v1' || r?.kind === 'defender_catch_response_v1') && r.playerId === selection.member.playerId; }));
    if ((d?.kind !== 'defender_decision_v1' && d?.kind !== 'defender_catch_response_v1') || d.playerId !== selection.member.playerId) throw new Error('physical movement owned decision missing');
    const model = playerLocomotionModelEvidenceFromSqlite(db).read(c.nominalReference.sourceId);
    if (!model) throw new Error('physical movement nominal model missing');
    same(reference('world_player_locomotion_models', model), c.nominalReference); same(hash(model.fieldingModel), d.fieldingModelHash);
    const body = posture.sceneBodies.find(b => b.source.playerId === selection.member.playerId);
    if (!body) throw new Error('physical moving field original Person body missing');
    const self = samePaPhysicalDefenderSelf(action, root, previous, body.actor);
    if (d.kind === 'defender_catch_response_v1') {
      const r = d.replan, schedule = r.scheduling;
      if (r.semantic !== 'ready' || r.phase !== 'renewal_due' || !r.selected || !r.selectedAt || !r.availableAt || !d.issuedBySourceId
        || !schedule || schedule.firstStepDelayTicks === null || schedule.movementStartTick === null)
        throw new Error('caught response has no actually issued and due motor');
      const issued = prefix.find(f => f.source.sourceId === d.issuedBySourceId), issuedResult = issued && result(issued);
      if (!issued || issuedResult?.kind !== 'defender_catch_response_v1' || issuedResult.issuedBySourceId !== issued.source.sourceId
        || json(issuedResult.replan.selectedAt) !== json(r.selectedAt) || json(issuedResult.replan.selected) !== json(r.selected)
        || issuedResult.replan.processSourceId !== r.processSourceId || issued.field.motion.world.moment.elapsedSeconds !== r.selectedAt.elapsedSeconds)
        throw new Error('caught response original decision commitment missing');
      return deriveSamePaPhysicalFieldMotor({ sourceId: issued.source.sourceId, playerId: d.playerId, physicalPitchSourceId: root.physicalPitchSourceId,
        ticksPerSecond: p.ticksPerSecond, availability: r.availableAt, scheduling: { ...schedule, firstStepDelayTicks: schedule.firstStepDelayTicks, movementStartTick: schedule.movementStartTick },
        selected: r.selected, target: r.target, lifecycle: { status: 'issued', issuedAt: r.selectedAt, issuedBySourceId: issued.source.sourceId } }, model, self, c.response.values);
    }
    return deriveSamePaPhysicalFieldMotor({ sourceId: decision.source.sourceId, playerId: d.playerId, physicalPitchSourceId: root.physicalPitchSourceId,
      ticksPerSecond: p.ticksPerSecond, availability: d.availability, scheduling: d.calculation.scheduling, selected: d.calculation.selected, target: d.target,
      lifecycle: { status: 'issued', issuedAt: at, issuedBySourceId: decision.source.sourceId } }, model, self, c.response.values);
  });
  const coverageThroughTick = Math.min(...motion.actors.map(a => a.primitive.endTick), ...motors.map(m => m.coverageEndTick));
  if (source.throughTick > coverageThroughTick) throw new Error('physical moving field exceeds original command coverage');
  const commands = motion.actors.map(a => {
    const selected = motors.find(m => m.self.playerId === a.playerId), r = selected?.command.primitiveMotions.find(r => r.role === a.primitive.role);
    return { playerId: a.playerId, role: a.primitive.role, acceleration: selected && r ? {
      x: selected.command.bodyAcceleration.x + r.offsetAcceleration.x, y: selected.command.bodyAcceleration.y + r.offsetAcceleration.y,
      z: selected.command.bodyAcceleration.z + r.offsetAcceleration.z } : a.primitive.acceleration };
  });
  const field = deriveBattedWorldFieldMotionCheckpoint({ response: root.response, geometry: root.geometry, actors: motion.actors, cursor: motion.cursor,
    carrierPlayerId: motion.carrierPlayerId, availableAtTick: motors[0].segment.startTick, coverageThroughTick, checkpointThroughTick: source.throughTick, commands });
  const actionResult: SamePaPhysicalFieldActionResult = { kind: request.kind, motors, coverageThroughTick };
  return freeze({ field, evaluationTick: field.motion.world.moment.ball.tick,
    timeline: samePaPhysicalHasThrowRelease(prefix) ? previous.timeline : samePaPhysicalTimelineAtField(previous.timeline, field, root.response, root.geometry), actionResult });
};
