import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import { prepareBattedWorldScheduledFieldAcquisition } from '../../core/sim/ball/BattedWorldScheduledFieldAcquisition';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { prepareNativePhysicalThrowCalibration } from './SamePlateAppearancePhysicalThrowNative.test-support';
import { physicalThrowSceneFixture } from './SamePlateAppearancePhysicalThrowScene.test-support';
import type { samePaPhysicalLifecycleFixture } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import type { prepareFreshPhysicalFieldFixture } from './SamePlateAppearancePhysicalFieldFixture.test-support';
import type { SamePaPhysicalFieldAction } from './SamePlateAppearancePhysicalFieldAction';
import type { SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
type Fixture = ReturnType<typeof samePaPhysicalLifecycleFixture>;
type Field = ReturnType<ReturnType<typeof prepareFreshPhysicalFieldFixture>['appendField']>;
/** Continue IFN01's real first glove boundary under its original static curves.
 * The only future values in Sources are bounded horizons and an explicit target.
 * Scheduled capture/throw kernels own every physical result. */
export const appendNativePhysicalThrowReception = (h: Fixture, field: Field, label: string) => {
  let previous = field.step, ordinal = 0;
  const root = field.root, p = root.response.world.parameters;
  const append = (throughTick: number, action?: SamePaPhysicalFieldAction) => {
    const previousReference = reference('pa_physical_v1_field_steps', previous);
    const source: SamePaPhysicalFieldStepSource = { sourceId: label + ':' + (++ordinal), sourceVersion: 'fixture-only-v1', capability: 'same_pa_physical_field_step_v1',
      viewReference: h.current().viewReference, launchReference: root.source.launchReference, previousOperationReference: previousReference,
      previousFieldReference: previousReference, fieldRootReference: field.rootReference, throughTick, ...(action ? { action } : {}) };
    h.save(source); const value = h.physical.acceptOperation(source.sourceId);
    if (value.kind !== 'same_pa_physical_field_step_v1') throw new Error('Native throw/reception physical step pending');
    const operationReference = reference('pa_physical_v1_field_steps', value); h.advance(operationReference); previous = value;
    return { value, operationReference };
  };
  const capture = () => {
    const candidate = previous, plan = prepareBattedWorldScheduledFieldAcquisition({ response: root.response, geometry: root.geometry, field: candidate.field });
    const secured = append(plan.candidateSecureTick, { kind: 'capture_checkpoint_v1', candidateReference: reference('pa_physical_v1_field_steps', candidate),
      throughElapsedSeconds: plan.fenceElapsedSeconds });
    if (secured.value.actionResult?.kind !== 'capture_checkpoint_v1' || secured.value.actionResult.progress.kind !== 'secured') throw new Error('Native scheduled glove capture was not secured');
    return { candidate, ...secured };
  };
  const secured = capture(), carrier = secured.value.field.motion.carrierPlayerId;
  if (carrier !== 'p2') throw new Error('IFN01 explicit initial glove did not acquire');
  const calibration = prepareNativePhysicalThrowCalibration(h, carrier, label, physicalThrowSceneFixture().values);
  const member = h.current().basis.members.find(m => m.playerId === carrier)!;
  const planned = append(previous.evaluationTick, { kind: 'throw_plan_v1', member, calibrationReference: calibration.calibrationReference,
    receiverPlayerId: 'home-1', coverageThroughTick: Math.min(...previous.field.motion.actors.map(a => a.primitive.endTick)) });
  if (planned.value.actionResult?.kind !== 'throw_plan_v1') throw new Error('Native scheduled throw plan missing');
  const plan = planned.value.actionResult.plan, start = plan.input.cursor.moment;
  const checkpoint = (elapsed: number) => append(quantizeEventTick(start.originTick, elapsed, p.ticksPerSecond), {
    kind: 'throw_checkpoint_v1', planReference: planned.operationReference, throughElapsedSeconds: elapsed });
  const transfer = checkpoint((start.elapsedSeconds + plan.releaseElapsedSeconds) / 2);
  if (transfer.value.actionResult?.kind !== 'throw_checkpoint_v1' || transfer.value.actionResult.progress.kind !== 'transfer') throw new Error('Native scheduled transfer was not retained');
  const released = checkpoint(plan.releaseElapsedSeconds);
  if (released.value.actionResult?.kind !== 'throw_checkpoint_v1' || released.value.actionResult.progress.kind !== 'released') throw new Error('Native scheduled throw did not release');
  // This horizon searches the actual free flight and stops at its first contact.
  const reception = append(released.value.evaluationTick + 100_000);
  const received = capture();
  if (received.value.field.motion.carrierPlayerId !== 'home-1') throw new Error('IFN01 receiver did not secure actual flight');
  return { secured, calibration, planned, transfer, released, reception, received,
    fieldForActions: { ...field, step: received.value, stepReference: received.operationReference } };
};
