import type { samePaPhysicalLifecycleFixture } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import type { prepareFreshPhysicalFieldFixture } from './SamePlateAppearancePhysicalFieldFixture.test-support';
import type { SamePaPhysicalFieldAction } from './SamePlateAppearancePhysicalFieldAction';
import type { SamePaPhysicalFieldStep, SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { openSqliteSamePlateAppearanceTeamCoverageDispatch } from './SamePlateAppearanceTeamCoverageDispatch';

type Fixture = ReturnType<typeof samePaPhysicalLifecycleFixture>;
type Field = ReturnType<ReturnType<typeof prepareFreshPhysicalFieldFixture>['appendField']>;
type Policy = Readonly<{ playerId: string; priorities: Extract<SamePaPhysicalFieldAction, { kind: 'defender_decision_v1' }>['priorities'];
  supportGeometry?: Extract<SamePaPhysicalFieldAction, { kind: 'defender_decision_v1' }>['supportGeometry'] }>;

/** Source-only fixture declarations. These explicit priorities are a synthetic
 * policy, not production tactical AI. All views, perceptions, selected decisions
 * and motors are calculated and accepted by their unmocked Native owners. */
export const appendNativeSelectedTeamCoverage = (h: Fixture, field: Field, label: string, policies: readonly Policy[]) => {
  if (policies.length !== 9) throw new Error('team fixture needs nine explicit policies');
  let previous = field.step, ordinal = 0;
  const ticksPerSecond = field.root.response.world.parameters.ticksPerSecond;
  const member = (playerId: string) => {
    const value = h.current().basis.members.find(m => m.playerId === playerId);
    if (!value) throw new Error('team fixture current original member missing'); return value;
  };
  const calibration = (playerId: string, route: 'defender_observation' | 'defender_decision' | 'defender_locomotion') => {
    const value = h.current().calibrationSet.calibrations.find(c => c.source.member.playerId === playerId && c.source.route === route);
    if (!value) throw new Error('team fixture original calibration missing');
    return reference('pa_lifecycle_v1_execution_calibrations', value);
  };
  const sourceAt = (throughTick: number, action?: SamePaPhysicalFieldAction): SamePaPhysicalFieldStepSource => {
    const previousReference = reference('pa_physical_v1_field_steps', previous);
    return { sourceId: label + ':' + (++ordinal), sourceVersion: 'explicit-selected-policy-fixture-v1', capability: 'same_pa_physical_field_step_v1',
      viewReference: h.current().viewReference, launchReference: field.root.source.launchReference, previousOperationReference: previousReference,
      fieldRootReference: field.rootReference, previousFieldReference: previousReference, throughTick, ...(action ? { action } : {}) };
  };
  const append = (throughTick: number, action?: SamePaPhysicalFieldAction) => {
    const source = h.save(sourceAt(throughTick, action)), value = h.physical.acceptOperation(source.sourceId);
    if (value.kind !== 'same_pa_physical_field_step_v1') throw new Error('team fixture original field operation pending');
    const operationReference = reference('pa_physical_v1_field_steps', value);
    h.advance(operationReference); previous = value; return { value, operationReference };
  };
  const observations = [], decisions = [];
  for (const policy of policies) {
    const moment = previous.field.motion.world.moment, cursor = previous.field.motion.cursor;
    const body = previous.field.motion.actors.find(a => a.playerId === policy.playerId && a.primitive.role === 'body');
    if (!cursor || !body) throw new Error('team fixture needs actual free/retained ball and original body');
    const p = body.primitive, dt = (moment.originTick - p.startTick) / ticksPerSecond + moment.elapsedSeconds - (body.startElapsedSeconds ?? 0);
    const center = { x: p.startCenter.x + p.startVelocity.x * dt + 0.5 * p.acceleration.x * dt * dt,
      y: p.startCenter.y + p.startVelocity.y * dt + 0.5 * p.acceleration.y * dt * dt,
      z: p.startCenter.z + p.startVelocity.z * dt + 0.5 * p.acceleration.z * dt * dt };
    const observation = append(previous.evaluationTick, { kind: 'defender_observation_v1', member: member(policy.playerId),
      calibrationReference: calibration(policy.playerId, 'defender_observation'), previousObservationReference: null,
      view: { poseVersion: 'actual-current-ball-directed-fixture-v1', bodyRelativeEyeOffset: { x: 0, y: 0.6, z: 0 },
        forward: { x: cursor.moment.ball.position.x - center.x, y: cursor.moment.ball.position.y - center.y - 0.6,
          z: cursor.moment.ball.position.z - center.z }, attentionTarget: { kind: 'ball' } } });
    observations.push(observation);
    decisions.push(append(previous.evaluationTick, { kind: 'defender_decision_v1', member: member(policy.playerId),
      calibrationReference: calibration(policy.playerId, 'defender_decision'), observationReference: observation.operationReference,
      priorities: policy.priorities, ...(policy.supportGeometry ? { supportGeometry: policy.supportGeometry } : {}) }));
  }
  const dueTick = Math.max(...decisions.map(d => {
    if (d.value.actionResult?.kind !== 'defender_decision_v1') throw new Error('team fixture original decision missing');
    return d.value.actionResult.calculation.scheduling.movementStartTick;
  }));
  const waits: SamePaPhysicalFieldStep[] = [];
  while (previous.evaluationTick < dueTick) {
    const old = previous.evaluationTick;
    waits.push(append(dueTick).value);
    if (previous.evaluationTick <= old) throw new Error('team fixture actual due cut made no progress');
  }
  const source = h.save(sourceAt(previous.evaluationTick + 1, { kind: 'defender_motion_v1', selections: decisions.map(d => {
    const result = d.value.actionResult;
    if (result?.kind !== 'defender_decision_v1') throw new Error('team fixture original selected decision missing');
    return { member: member(result.playerId), decisionReference: d.operationReference,
      calibrationReference: calibration(result.playerId, 'defender_locomotion') };
  }) }));
  const dispatch = h.f.x.f.track(openSqliteSamePlateAppearanceTeamCoverageDispatch(h.f.path, { readAcceptedOperation: id => h.accepted.get(id) }));
  const preparation = dispatch.prepare(source), receipt = dispatch.accept(source.sourceId, preparation);
  const value = h.physical.readOperation(receipt.motionReference);
  h.advance(receipt.motionReference);
  const reopened = h.f.x.f.track(openSqliteSamePlateAppearanceTeamCoverageDispatch(h.f.path));
  return { observations, decisions, waits, source, preparation, receipt, proof: value, replay: reopened.read(receipt.motionReference) };
};
