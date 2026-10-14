import type { samePaPhysicalLifecycleFixture } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import type { prepareFreshPhysicalFieldFixture } from './SamePlateAppearancePhysicalFieldFixture.test-support';
import type { SamePaPhysicalFieldAction } from './SamePlateAppearancePhysicalFieldAction';
import type { SamePaPhysicalFieldStep, SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { openSqliteSamePlateAppearancePhysicalEpisodeStore } from './SqliteSamePlateAppearancePhysicalEpisodeStore';
type Fixture = ReturnType<typeof samePaPhysicalLifecycleFixture>;
type Field = ReturnType<ReturnType<typeof prepareFreshPhysicalFieldFixture>['appendField']>;
/** Extend IFN01's one owned field root. No database, actor, view, calibration,
 * observation, decision or motion receipt is copied into a writer. */
export const appendNativePhysicalFieldActions = (h: Fixture, field: Field, label: string) => {
  let previous = field.step;
  const moment = previous.field.motion.world.moment, cursor = previous.field.motion.cursor;
  if (!cursor) throw new Error('IFN01 field action chain needs its owned free/retained cursor');
  const ticksPerSecond = field.root.response.world.parameters.ticksPerSecond;
  const bodyRelativeEyeOffset = { x: 0, y: 0.6, z: 0 };
  // Explicit synthetic view selection: aim the closest owned defender at the
  // actual cut. The production decision still sees only its sampled perception.
  const candidates = h.f.actor.defenderBindings.map(binding => {
    const actor = previous.field.motion.actors.find(a => a.playerId === binding.playerId && a.primitive.role === 'body');
    if (!actor) throw new Error('IFN01 actual defender body missing');
    const p = actor.primitive, dt = (moment.originTick - p.startTick) / ticksPerSecond + moment.elapsedSeconds - (actor.startElapsedSeconds ?? 0);
    const center = { x: p.startCenter.x + p.startVelocity.x * dt + 0.5 * p.acceleration.x * dt * dt,
      y: p.startCenter.y + p.startVelocity.y * dt + 0.5 * p.acceleration.y * dt * dt,
      z: p.startCenter.z + p.startVelocity.z * dt + 0.5 * p.acceleration.z * dt * dt };
    const forward = { x: cursor.moment.ball.position.x - center.x, y: cursor.moment.ball.position.y - center.y - bodyRelativeEyeOffset.y,
      z: cursor.moment.ball.position.z - center.z };
    return { playerId: binding.playerId, forward, distance: Math.hypot(forward.x, forward.y, forward.z) };
  }).sort((a, b) => a.distance - b.distance || a.playerId.localeCompare(b.playerId));
  const selected = candidates[0];
  if (!selected || selected.distance === 0) throw new Error('IFN01 explicit observer view is degenerate');
  const member = () => {
    const value = h.current().basis.members.find(m => m.playerId === selected.playerId);
    if (!value) throw new Error('IFN01 current field member missing'); return value;
  };
  const calibration = (route: 'defender_observation' | 'defender_decision' | 'defender_locomotion') => {
    const value = h.current().calibrationSet.calibrations.find(c => c.source.member.playerId === selected.playerId && c.source.route === route);
    if (!value) throw new Error('IFN01 current effective field calibration missing');
    return reference('pa_lifecycle_v1_execution_calibrations', value);
  };
  let ordinal = 0;
  const append = (throughTick: number, action?: SamePaPhysicalFieldAction) => {
    const previousReference = reference('pa_physical_v1_field_steps', previous);
    const source: SamePaPhysicalFieldStepSource = { sourceId: label + ':' + (++ordinal), sourceVersion: 'fixture-only-v1', capability: 'same_pa_physical_field_step_v1',
      viewReference: h.current().viewReference, launchReference: field.root.source.launchReference, previousOperationReference: previousReference,
      fieldRootReference: field.rootReference, previousFieldReference: previousReference, throughTick, ...(action ? { action } : {}) };
    h.save(source); const value = h.physical.acceptOperation(source.sourceId);
    if (value.kind !== 'same_pa_physical_field_step_v1') throw new Error('IFN01 accepted physical field action is pending');
    const operationReference = reference('pa_physical_v1_field_steps', value);
    h.advance(operationReference); previous = value; return { value, operationReference };
  };
  const observation = append(previous.evaluationTick, { kind: 'defender_observation_v1', member: member(), calibrationReference: calibration('defender_observation'),
    previousObservationReference: null, view: { poseVersion: 'IFN01-explicit-actual-cut-view-v1', bodyRelativeEyeOffset,
      forward: selected.forward, attentionTarget: { kind: 'ball' } } });
  const decision = append(previous.evaluationTick, { kind: 'defender_decision_v1', member: member(), calibrationReference: calibration('defender_decision'),
    observationReference: observation.operationReference, priorities: { ballPursuitPriority: 1, baseCoverPriorities: [], relayPriority: 0, backupPriority: 0, deepCoveragePriority: 0, holdPriority: 0 } });
  const d = decision.value.actionResult;
  if (d?.kind !== 'defender_decision_v1') throw new Error('IFN01 actual field decision result missing');
  const dueTick = d.calculation.scheduling.movementStartTick, waits: SamePaPhysicalFieldStep[] = [];
  while (previous.evaluationTick < dueTick) {
    if (!previous.field.motion.cursor) throw new Error('IFN01 field boundary needs its actual operation owner before locomotion');
    const old = previous.field.motion.world.moment.elapsedSeconds, next = append(dueTick).value;
    if (next.field.motion.world.moment.elapsedSeconds <= old) throw new Error('IFN01 due-time advance made no physical progress');
    waits.push(next);
  }
  const motionViewReference = h.current().viewReference;
  const motion = append(previous.evaluationTick + 1, { kind: 'defender_motion_v1', selections: [{ member: member(), decisionReference: decision.operationReference,
    calibrationReference: calibration('defender_locomotion') }] });
  const reopened = h.f.x.f.track(openSqliteSamePlateAppearancePhysicalEpisodeStore(h.f.path));
  const replay = reopened.readOperation(motion.operationReference);
  return { playerId: selected.playerId, observation, decision, waits, dueTick, motion, motionViewReference, replay };
};
