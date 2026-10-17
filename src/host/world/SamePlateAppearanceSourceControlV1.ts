import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createSourceDefensiveControlV1, type SourceDefensiveControlPlanV1 } from '../../core/sim/ball/SourceDefensiveControlV1';
import type { PlayerObservationCalibration } from '../../core/sim/perception/PlayerObservationCalibration';
import type { ActualFieldObservationReceipt, AcceptedActualFieldObservation } from './ActualFieldObservation';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep, SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import type { SamePaPhysicalFieldActionResult } from './SamePlateAppearancePhysicalFieldAction';
import { readSamePaSourceFreeMotorPrefixV1 } from './SamePlateAppearanceSourceMotorFieldV1';
import { assertSamePaFieldBallPhysicsStep, samePaSourceFieldMetadataActionV3,
  SAME_PA_AERO_GROUND_CONTROL_FIELD_STEP_SOURCE_VERSION as VERSION } from './SamePlateAppearanceBallPhysics';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorFreeze as freeze, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

type Field = SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep;
type Control = Extract<SamePaPhysicalFieldActionResult, { kind: 'defender_control_v1' }>;
type Input = Readonly<{ source: SamePaPhysicalFieldStepSource; root: SamePaPhysicalFieldRoot;
  previous: Field; history: readonly Field[]; actionResult?: Control }>;
const ref = (f: Field) => reference(f.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', f);
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('Source continuous control original history differs'); };

/** Uses the sampler's actual successful/not-yet-due samples. Nondetection does
 * not manufacture perpetual refresh work (the existing schedule contract).
 * Native supplies the original authenticated effective policy and receipt. */
export const samePaControlReviewTickV1 = (observation: Readonly<{ receipt: ActualFieldObservationReceipt;
  samplingRequest: Pick<AcceptedActualFieldObservation, 'view'> }>, calibration: PlayerObservationCalibration,
  now: number, coverage: number, ticksPerSecond: number): number => {
  if (calibration.memoryDecayParameters.ticksPerSecond !== ticksPerSecond || observation.receipt.at.tick > now)
    throw new Error('Source continuous control observation clock differs');
  const due = observation.receipt.results.flatMap(result => {
    if (result.status !== 'detected' && result.status !== 'refresh_not_due') return [];
    const target = result.target;
    const sample = target.kind === 'ball' ? observation.receipt.samples.ball
      : observation.receipt.samples.players.find(p => p.playerId === target.playerId);
    if (!sample || !Number.isSafeInteger(sample.sample.observedAt) || sample.sample.observedAt > observation.receipt.at.tick)
      throw new Error('Source continuous control original sample is missing');
    const interval = json(result.target) === json(observation.samplingRequest.view.attentionTarget)
      ? calibration.refreshPolicy.attendedIntervalTicks : calibration.refreshPolicy.peripheralIntervalTicks;
    const at = sample.sample.observedAt + interval;
    if (!Number.isSafeInteger(at) || at <= now) throw new Error('Source continuous control observation refresh is already due');
    return [at];
  });
  return Math.min(coverage, ...due);
};

export const samePaControlPlansV1 = (motors: Control['motors'], reviewTicks: readonly number[], decisionSourceIds: readonly string[]): readonly SourceDefensiveControlPlanV1[] => {
  if (motors.length !== 9 || reviewTicks.length !== 9 || decisionSourceIds.length !== 9 || new Set(motors.map(m => m.self.playerId)).size !== 9)
    throw new Error('Source continuous control requires nine owned motors');
  return freeze(motors.map((m, i) => {
    const body = m.self.roles.find(role => role.role === 'body');
    if (!body) throw new Error('Source continuous control body model missing');
    return { playerId: m.self.playerId, decisionSourceId: decisionSourceIds[i],
      availableAtTick: m.startAt.tick, movementStartTick: m.movementStartTick, reviewAtTick: reviewTicks[i],
      bodyOffset: { x: body.declaredPose.offset.x, z: body.declaredPose.offset.z },
      waypoints: m.target === null ? null : m.route?.waypoints.length ? m.route.waypoints : [m.target], parameters: m.parameters };
  }));
};

/** Per-record inert limits are unchanged; histories are collections of records. */
const copied = (raw: Input): Input => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || ![Object.prototype, null].includes(Object.getPrototypeOf(raw))
    || Object.getOwnPropertySymbols(raw).length) throw new Error('invalid Source continuous control envelope');
  const d: Record<string, PropertyDescriptor> = Object.getOwnPropertyDescriptors(raw), names = ['source', 'root', 'previous', 'history'];
  if ('actionResult' in d) names.push('actionResult');
  if (Object.keys(d).sort().join('|') !== names.sort().join('|') || Object.values(d).some(v => !('value' in v) || !v.enumerable))
    throw new Error('invalid Source continuous control properties');
  const rows = d.history.value;
  if (!Array.isArray(rows) || Object.getOwnPropertySymbols(rows).length) throw new Error('invalid Source continuous control history');
  const entries = Object.getOwnPropertyDescriptors(rows) as unknown as Record<string, PropertyDescriptor>, length = entries.length.value;
  if (!Number.isSafeInteger(length) || length < 1 || length > 512 || Object.keys(entries).length !== length + 1
    || Array.from({ length }, (_, i) => entries[String(i)]).some(v => !v || !('value' in v) || !v.enumerable))
    throw new Error('invalid Source continuous control records');
  return { source: cloneInert(d.source.value), root: cloneInert(d.root.value), previous: cloneInert(d.previous.value),
    history: Array.from({ length }, (_, i) => cloneInert(entries[String(i)].value)),
    ...('actionResult' in d ? { actionResult: cloneInert(d.actionResult.value) } : {}) };
};

/** Native rederives model/decision/observation rows before entering this seam.
 * Replay starts from the original bat-contact root, then retains one issued
 * team across control ticks and checkpoint rows. A second issuance requires
 * the subsequent versioned review/replanning consumer, not a silent reset. */
export const deriveSamePaSourceControlV1 = (raw: Input) => {
  const { source, root, previous, history, actionResult } = copied(raw);
  if (source.sourceVersion !== VERSION) throw new Error('Source continuous control requires its explicit version');
  same(history[0], root); same(history.at(-1), previous);
  const first = history.findIndex(f => f.source.sourceVersion === VERSION), cut = first < 0 ? history.length : first;
  const original = readSamePaSourceFreeMotorPrefixV1({ root, history: history.slice(0, cut) });
  const issued = first < 0 ? actionResult : (history[first] as SamePaPhysicalFieldStep).actionResult;
  if (issued?.kind !== 'defender_control_v1') throw new Error('Source continuous control original issuance missing');
  const startSource = first < 0 ? source : history[first].source;
  if (!('action' in startSource) || startSource.action?.kind !== 'defender_control_v1') throw new Error('Source continuous control original team missing');
  same(issued.plans, samePaControlPlansV1(issued.motors, issued.plans.map(p => p.reviewAtTick), startSource.action.selections.map(s => s.decisionReference.sourceId)));
  if (issued.coverageThroughTick !== Math.min(...original.trace.field.motion.actors.map(a => a.primitive.endTick)))
    throw new Error('Source continuous control model coverage differs');
  const control = createSourceDefensiveControlV1({ initial: original.initial, priorActions: original.actions, plans: issued.plans });
  const evidence = () => {
    const e = control.evidence();
    return { solverVersion: 'source_defensive_control_v1' as const,
      impulseCertificates: e.impulseCertificates.map(c => ({ afterStepIndex: c.afterActionIndex, diagnostic: c.diagnostic })),
      escapedIntervals: e.escapedIntervals.map(c => ({ stepIndex: c.actionIndex, advance: c.advance })) };
  };
  const execute = (s: SamePaPhysicalFieldStepSource, prior: Field, initial: boolean) => {
    assertSamePaFieldBallPhysicsStep(s, root.source, prior.source, prior.kind === 'same_pa_physical_field_root_v1');
    same(s.fieldRootReference, ref(root)); same(s.previousFieldReference, ref(prior)); same(s.previousOperationReference, s.previousFieldReference);
    same(s.launchReference, root.source.launchReference);
    if (initial) {
      if (s.action?.kind !== 'defender_control_v1' || s.action.selections.length !== 9) throw new Error('Source continuous control initial team missing');
      same(s.action.selections.map(p => p.member.playerId), issued.plans.map(p => p.playerId));
      for (const m of issued.motors) same(m.self.physicalCutReference, ref(prior));
    } else if (samePaSourceFieldMetadataActionV3(s.action)) {
      if (s.throughTick !== prior.evaluationTick || !control.read().field.motion.cursor) throw new Error('Source continuous control metadata changed its clock or free-ball state');
      return control.read();
    } else if (Object.hasOwn(s, 'action')) throw new Error('Source continuous control cannot replace issued work without a review consumer');
    if (s.throughTick <= prior.evaluationTick || s.throughTick > issued.coverageThroughTick)
      throw new Error('Source continuous control checkpoint horizon differs');
    const result = control.advanceThrough(s.throughTick);
    if (result.status === 'work_limit') throw new Error('Source continuous control span requires a smaller explicit horizon');
    if (result.status === 'review_due' && result.field.motion.world.moment.ball.tick < s.throughTick)
      throw new Error('Source continuous control cannot cross an unconsumed observation deadline');
    return result;
  };
  for (let i = cut; i < history.length; i++) {
    const f = history[i], prior = history[i - 1];
    if (f.kind !== 'same_pa_physical_field_step_v1' || f.operationOrdinal !== prior.operationOrdinal + 1
      || f.physicalPitchSourceId !== root.physicalPitchSourceId || f.source.sourceVersion !== VERSION)
      throw new Error('Source continuous control original history is not consecutive');
    same(f.lineage, root.lineage);
    if (i > cut && samePaSourceFieldMetadataActionV3(f.source.action)) {
      if (f.actionResult?.kind !== f.source.action?.kind) throw new Error('Source continuous control original metadata result differs');
      same(f.timeline, prior.timeline);
    } else if (i > cut && f.actionResult !== undefined) throw new Error('Source continuous control free checkpoint has a foreign result');
    const value = execute(f.source, prior, i === cut);
    same(f.field, value.field); same(f.ballSolverEvidence, evidence());
    if (f.evaluationTick !== value.field.motion.world.moment.ball.tick) throw new Error('Source continuous control original clock differs');
  }
  const value = execute(source, previous, first < 0);
  return freeze({ field: value.field, ballSolverEvidence: evidence() });
};
