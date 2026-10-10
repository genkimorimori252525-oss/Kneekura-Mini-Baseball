import { expect, it } from 'vitest';
import { fixture, material, v, throwInput } from '../../core/sim/ball/BattedWorldScheduledFieldThrow.test-support';
import { deriveInitialBattedWorldFieldMotion } from '../../core/sim/ball/BattedWorldFieldMotion';
import { prepareBattedWorldScheduledFieldAcquisition } from '../../core/sim/ball/BattedWorldScheduledFieldAcquisition';
import { prepareBattedWorldScheduledFieldThrow, advanceBattedWorldScheduledFieldThrow } from '../../core/sim/ball/BattedWorldScheduledFieldThrow';
import { deriveSamePaFieldRuleEvidence } from './SamePlateAppearanceFieldRuleEvidence';
import { deriveSamePaPhysicalFieldCapture } from './SamePlateAppearancePhysicalFieldCapture';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep } from './SamePlateAppearancePhysicalEpisode';
import type { SamePaPhysicalFieldActionResult } from './SamePlateAppearancePhysicalFieldAction';
import { deriveSamePaLiveWorkCensus, type SamePaLiveWorkCensusInput } from './SamePlateAppearanceLiveWorkCensus';
import { deriveSamePaCatchPhaseWork } from './SamePlateAppearanceCatchPhaseWork';
import type { SamePaCatchWork } from './SamePlateAppearanceCatchWorkFromSqlite';
import { resolveExactCommunicationReception } from '../../core/sim/perception/ExactCommunication';
import { DeterministicRng } from '../../core/rng/DeterministicRng';
import { deriveSamePaCatchOperativeRuling } from './SamePlateAppearanceCatchOperativeRuling';
type Field = SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep;
const fieldRef = (f: Field) => reference(f.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', f);
const ref = <O extends string>(owner: O) => ({ owner, sourceId: owner, sourceHash: hash(owner), snapshotHash: hash(owner) });
const roles = ['body', 'glove', 'tag_hand', 'left_foot', 'right_foot'] as const;
/** Core supplies actual contact/capture/throw. The small sensory records exercise
 * the pure census contract only; this fixture does not claim Native ownership. */
const setup = () => {
  const original = fixture(0, 1, 5, 5), participantIds = ['batter', 'carrier', 'receiver'];
  const actors = participantIds.flatMap((playerId, index) => roles.map((role, roleIndex) => {
    const glove = original.response.world.actors.find(a => a.playerId === playerId)?.primitive;
    return { playerId, primitive: { role, radius: 0.125, startTick: 0, endTick: 5_000_000, ticksPerSecond: 1_000_000,
      startCenter: v(glove?.startCenter.x ?? 20 + index * 5, role === 'glove' ? 5 : 10 + roleIndex, 5),
      startVelocity: glove?.startVelocity ?? v(0, 0, 0), acceleration: v(0, 0, 0) } };
  }));
  const response = { ...original.response, world: { ...original.response.world, actors }, actors: actors.map(a => ({ playerId: a.playerId,
    profile: a.primitive.role === 'glove' ? original.response.actors[0].profile : { role: a.primitive.role, material } })) };
  const field = deriveInitialBattedWorldFieldMotion({ ...original, response, commands: actors.map(a => ({ playerId: a.playerId, role: a.primitive.role, acceleration: v(0, 0, 0) })) });
  const root = { kind: 'same_pa_physical_field_root_v1', source: { sourceId: 'root', sourceVersion: 'fixture-only', parameters: response.world.parameters },
    physicalPitchSourceId: 'pitch', pitchOrdinal: 3, operationOrdinal: 3, evaluationTick: field.motion.world.moment.ball.tick,
    response, geometry: original.geometry, field, lineage: { playId: 1, enrollmentReference: ref('same_pa_enrollments') }, timeline: { playId: 1, startedAtTick: 0, lastEventTick: 0, nextSequence: 0,
      events: [], status: { kind: 'batted_ball_pending', count: { balls: 0, strikes: 0 } } } } as unknown as SamePaPhysicalFieldRoot;
  const scope = { participantIds, batterRunnerId: 'batter', defenderIds: ['carrier', 'receiver'], outsAtStart: 0 };
  const step = (previous: Field, sourceId: string, actionResult?: SamePaPhysicalFieldActionResult,
    action?: SamePaPhysicalFieldStep['source']['action']): SamePaPhysicalFieldStep => ({ ...root, kind: 'same_pa_physical_field_step_v1',
      source: { sourceId, sourceVersion: 'fixture-only', capability: 'same_pa_physical_field_step_v1',
        viewReference: ref('pa_lifecycle_v1_execution_views') as never, launchReference: ref('pa_physical_v1_launches') as never,
        previousOperationReference: fieldRef(previous), previousFieldReference: fieldRef(previous), fieldRootReference: fieldRef(root) as never,
        throughTick: previous.evaluationTick, ...(action ? { action } : {}) }, operationOrdinal: previous.operationOrdinal + 1,
      evaluationTick: previous.evaluationTick, field: previous.field, ...(actionResult ? { actionResult } : {}) });
  const capture = (previous: Field, throughElapsedSeconds: number) => {
    const current = step(previous, 'capture:' + previous.operationOrdinal, undefined, { kind: 'capture_checkpoint_v1', candidateReference: fieldRef(root), throughElapsedSeconds });
    const source = { ...current.source, throughTick: Math.round(throughElapsedSeconds * 1_000_000) };
    return { ...current, source, ...deriveSamePaPhysicalFieldCapture(source, root, previous.kind === 'same_pa_physical_field_step_v1' && previous.actionResult?.kind === 'capture_checkpoint_v1' ? previous : root, root) };
  };
  const observation = (previous: Field, sourceId: string, playerId = 'carrier', status: 'detected' | 'not_detected' | 'refresh_not_due' = 'detected') => {
    const m = previous.field.motion.world.moment, at = { originTick: m.originTick, elapsedSeconds: m.elapsedSeconds, tick: m.ball.tick };
    const result = { kind: 'defender_observation_v1', playerId, samplingRequest: { sourceId, playerId, view: { attentionTarget: { kind: 'ball' } } },
      receipt: { at, results: [{ target: { kind: 'ball' }, status }] } } as unknown as SamePaPhysicalFieldActionResult;
    return step(previous, sourceId, result, { kind: 'defender_observation_v1', member: { playerId }, view: { attentionTarget: { kind: 'ball' } } } as never);
  };
  const decision = (previous: Field, sourceId: string, observation: SamePaPhysicalFieldStep, decisionTick = 10, movementStartTick = 20) =>
    step(previous, sourceId, { kind: 'defender_decision_v1', playerId: 'carrier', observationReference: fieldRef(observation),
      calculation: { scheduling: { startedAtTick: 0, decisionTick, movementStartTick, decisionDelayTicks: decisionTick, firstStepDelayTicks: movementStartTick - decisionTick } } } as never,
    { kind: 'defender_decision_v1', member: { playerId: 'carrier' }, observationReference: fieldRef(observation) } as never);
  const policies = (fields: readonly Field[]): SamePaLiveWorkCensusInput['observationPolicies'] => fields.flatMap(f => f.kind === 'same_pa_physical_field_step_v1'
    && f.actionResult?.kind === 'defender_observation_v1' ? [{ observationReference: fieldRef(f) as never, refreshPolicy: { attendedIntervalTicks: 10, peripheralIntervalTicks: 40 } }] : []);
  const census = (fields: readonly Field[], observationPolicies = policies(fields)) => deriveSamePaLiveWorkCensus({ participantIds, fields, observationPolicies, possessionEvidence: deriveSamePaFieldRuleEvidence({ ...scope, fields }).rule.possessionEvidence });
  return { root, scope, step, capture, observation, decision, policies, census };
};
it('LC01 exposes original prefix coverage, role curves and pending capture without claiming missing domains complete', () => {
  const h = setup(), result = h.census([h.root]);
  expect(result.originalFieldPrefix).toMatchObject({ kind: 'original_field_prefix_only', participantIds: h.scope.participantIds, fieldReferences: [fieldRef(h.root)] });
  expect(result.participantCurves).toHaveLength(3);
  expect(result.participantCurves.every(p => p.roles.length === 5 && p.coverageThroughTick === 5_000_000)).toBe(true);
  expect(result.pendingPhysical.captures).toMatchObject([{ playerId: 'carrier', candidateReference: fieldRef(h.root), due: 'future' }]);
  expect(result.unownedDomains).toEqual(['calls', 'receptions', 'producer_completeness', 'live_play_end']);
  expect(result).not.toHaveProperty('liveAppeals');
  expect(result).not.toHaveProperty('completion'); expect(result).not.toHaveProperty('physicalEnd'); expect(result).not.toHaveProperty('officialResult');
});
it('LC02 refresh work is observer-specific and elapsed time alone does not consume it', () => {
  const h = setup(), seen = h.observation(h.root, 'seen'), other = h.observation(seen, 'other', 'receiver');
  const later = h.capture(other, 0.01), result = h.census([h.root, seen, other, later]);
  expect(result.observationRefresh.pending).toMatchObject([{ playerId: 'carrier', causeReference: fieldRef(seen), dueTick: 10, due: 'due' },
    { playerId: 'receiver', causeReference: fieldRef(other), dueTick: 10, due: 'due' }]);
  expect(result.observationRefresh.consumed).toEqual([]);
  const missed = h.observation(later, 'missed', 'carrier', 'not_detected'), after = h.census([h.root, seen, other, later, missed]);
  expect(after.observationRefresh.pending).toHaveLength(1);
  expect(after.observationRefresh.pending[0].playerId).toBe('receiver');
  expect(after.observationRefresh.consumed).toMatchObject([{ playerId: 'carrier', causeReference: fieldRef(seen), consumerReference: fieldRef(missed), dueTick: 10 }]);
});
it('LC03 every decision remains pending through time and replacement until its exact motor selection executes', () => {
  const h = setup(), seen = h.observation(h.root, 'seen'), first = h.decision(seen, 'decision-a', seen), second = h.decision(first, 'decision-b', seen, 30, 40);
  const plan = prepareBattedWorldScheduledFieldAcquisition({ response: h.root.response, geometry: h.root.geometry, field: h.root.field });
  const secured = h.capture(second, plan.fenceElapsedSeconds), fields = [h.root, seen, first, second, secured];
  expect(h.census(fields).defenderDecisions.pending).toMatchObject([{ decisionReference: fieldRef(first), decisionTick: 10, movementStartTick: 20, movementDue: 'due' },
    { decisionReference: fieldRef(second), decisionTick: 30, movementStartTick: 40, movementDue: 'due' }]);
  const motor = h.step(secured, 'motor', { kind: 'defender_motion_v1', motors: [{ self: { playerId: 'carrier' }, command: { playerId: 'carrier' } }], coverageThroughTick: 5_000_000 } as never,
    { kind: 'defender_motion_v1', selections: [{ member: { playerId: 'carrier' }, decisionReference: fieldRef(second) }] } as never);
  const after = h.census([...fields, motor]);
  expect(after.defenderDecisions.pending).toMatchObject([{ decisionReference: fieldRef(first) }]);
  expect(after.defenderDecisions.consumed).toMatchObject([{ decisionReference: fieldRef(second), consumerReference: fieldRef(motor) }]);
});
it('LC04 preserves future decision times and rejects foreign motor identity or substituted decision hashes', () => {
  const h = setup(), seen = h.observation(h.root, 'seen'), decision = h.decision(seen, 'decision', seen);
  expect(h.census([h.root, seen, decision]).defenderDecisions.pending).toMatchObject([{ decisionDue: 'future', movementDue: 'future' }]);
  const make = (decisionReference: unknown, playerId: string) => h.step(decision, 'motor', { kind: 'defender_motion_v1', motors: [{ self: { playerId }, command: { playerId } }], coverageThroughTick: 5_000_000 } as never,
    { kind: 'defender_motion_v1', selections: [{ member: { playerId: 'carrier' }, decisionReference }] } as never);
  expect(() => h.census([h.root, seen, decision, make(fieldRef(decision), 'receiver')])).toThrow(/motor|decision/);
  expect(() => h.census([h.root, seen, decision, make({ ...fieldRef(decision), snapshotHash: hash('foreign') }, 'carrier')])).toThrow(/motor|decision/);
});
it('LC05 requires the complete ordered field prefix and exactly one accepted policy for every original observation', () => {
  const h = setup(), seen = h.observation(h.root, 'seen'), next = h.observation(seen, 'next');
  for (const fields of [[seen], [h.root, next], [h.root, seen, seen], [h.root, { ...seen, physicalPitchSourceId: 'foreign' }]]) expect(() => h.census(fields)).toThrow();
  expect(() => h.census([h.root, seen], [])).toThrow(/policy|calibration/);
  expect(() => h.census([h.root, seen], [...h.policies([seen]), ...h.policies([seen])])).toThrow(/policy|calibration/);
  expect(() => h.census([h.root, seen], [{ ...h.policies([seen])[0], observationReference: { ...fieldRef(seen), snapshotHash: hash('foreign') } as never }])).toThrow(/policy|calibration/);
  expect(() => deriveSamePaLiveWorkCensus({ participantIds: ['batter', 'carrier'], fields: [h.root], observationPolicies: [], possessionEvidence: deriveSamePaFieldRuleEvidence({ ...h.scope, fields: [h.root] }).rule.possessionEvidence })).toThrow(/participant|membership/);
});
it('LC06 a capture retires only through actual secured progress and a throw only through original release', () => {
  const h = setup(), capture = prepareBattedWorldScheduledFieldAcquisition({ response: h.root.response, geometry: h.root.geometry, field: h.root.field });
  const secured = h.capture(h.root, capture.fenceElapsedSeconds), nominal = throwInput(fixture(0, 1, 5, 5));
  const plan = prepareBattedWorldScheduledFieldThrow({ response: h.root.response, geometry: h.root.geometry, actors: secured.field.motion.actors,
    cursor: secured.field.motion.cursor!, carrierPlayerId: 'carrier', receiverPlayerId: 'receiver', availableAtTick: secured.evaluationTick, throughTick: 5_000_000,
    commands: secured.field.motion.actors.map(a => ({ playerId: a.playerId, role: a.primitive.role, acceleration: a.primitive.acceleration })),
    ratings: nominal.ratings, transferParameters: nominal.transferParameters, throwCalibration: nominal.throwCalibration, seed: nominal.seed });
  const planned = h.step(secured, 'throw-plan', { kind: 'throw_plan_v1', plan, fieldingModelHash: hash('fixture') });
  const seen = h.observation(planned, 'while-transferring');
  const before = h.census([h.root, secured, planned, seen]);
  expect(before.pendingPhysical.captures).toEqual([]);
  expect(before.pendingPhysical.throw).toMatchObject({ planReference: fieldRef(planned), releaseTick: plan.transfer.throwReadyTick, due: 'future' });
  const progress = advanceBattedWorldScheduledFieldThrow({ plan, previous: null, throughElapsedSeconds: plan.releaseElapsedSeconds });
  const released = { ...h.step(seen, 'release', { kind: 'throw_checkpoint_v1', planReference: fieldRef(planned) as never, progress }),
    field: progress.field, evaluationTick: progress.field.motion.world.moment.ball.tick };
  expect(h.census([h.root, secured, planned, seen, released]).pendingPhysical.throw).toBeNull();
});
it('LC07 reuses original per-observation intervals and does not let refresh-not-due consume the prior cause', () => {
  const h = setup(), seen = h.observation(h.root, 'seen'), early = h.observation(seen, 'early', 'carrier', 'refresh_not_due');
  const fields = [h.root, seen, early], pending = h.census(fields);
  expect(pending.observationRefresh.pending).toMatchObject([{ causeReference: fieldRef(seen), dueTick: 10, due: 'future' }]);
  expect(pending.observationRefresh.consumed).toEqual([]);
  const sampled = h.observation(early, 'sampled'), all = [...fields, sampled];
  const policies = h.policies(all).map(policy => policy.observationReference.sourceId === 'sampled'
    ? { ...policy, refreshPolicy: { attendedIntervalTicks: 29, peripheralIntervalTicks: 73 } } : policy);
  const after = h.census(all, policies);
  expect(after.observationRefresh.pending).toMatchObject([{ causeReference: fieldRef(sampled), dueTick: 29 }]);
  expect(after.observationRefresh.consumed).toMatchObject([{ causeReference: fieldRef(seen), consumerReference: fieldRef(sampled), disposition: 'superseded_by_actual_sample' }]);
});
it('LC08 retains every original role end and records the actual curve replacement reference', () => {
  const h = setup(), capture = prepareBattedWorldScheduledFieldAcquisition({ response: h.root.response, geometry: h.root.geometry, field: h.root.field });
  const secured = h.capture(h.root, capture.fenceElapsedSeconds), next = h.step(secured, 'new-curve');
  const changed = { ...next, field: { ...next.field, motion: { ...next.field.motion, actors: next.field.motion.actors.map(a => a.playerId === 'carrier' && a.primitive.role === 'glove'
    ? { ...a, primitive: { ...a.primitive, endTick: secured.evaluationTick } } : a) } } };
  const seen = h.observation(changed, 'seen'), result = h.census([h.root, secured, changed, seen]);
  const carrier = result.participantCurves.find(p => p.playerId === 'carrier')!;
  expect(carrier.coverageThroughTick).toBe(secured.evaluationTick);
  expect(carrier.roles.find(r => r.role === 'glove')).toMatchObject({ curveReference: fieldRef(changed), endTick: secured.evaluationTick, endDue: 'due' });
  expect(carrier.roles.find(r => r.role === 'body')).toMatchObject({ curveReference: fieldRef(h.root), endTick: 5_000_000, endDue: 'future' });
});
it('LC09 rejects a possession envelope from a different clock or original capture', () => {
  const h = setup(), possessionEvidence = deriveSamePaFieldRuleEvidence({ ...h.scope, fields: [h.root] }).rule.possessionEvidence;
  const input = { participantIds: h.scope.participantIds, fields: [h.root], observationPolicies: [], possessionEvidence };
  expect(() => deriveSamePaLiveWorkCensus({ ...input, possessionEvidence: { ...possessionEvidence, throughElapsedSeconds: 1 } })).toThrow(/possession clock/);
  expect(() => deriveSamePaLiveWorkCensus({ ...input, possessionEvidence: { ...possessionEvidence, pending: [{ ...possessionEvidence.pending[0], planSourceId: 'foreign' }] } })).toThrow(/capture candidate/);
});
it('LC10 leaves a non-defender contact to the existing rule owner without inventing capture admission', () => {
  const h = setup(), swap = (id: string) => id === 'batter' ? 'carrier' : id === 'carrier' ? 'batter' : id;
  const response = { ...h.root.response, world: { ...h.root.response.world, actors: h.root.response.world.actors.map(a => ({ ...a, playerId: swap(a.playerId) })) },
    actors: h.root.response.actors.map(a => ({ ...a, playerId: swap(a.playerId) })) };
  const field = deriveInitialBattedWorldFieldMotion({ response, geometry: h.root.geometry, availableAtTick: 0, throughTick: 1_000_000,
    commands: response.world.actors.map(a => ({ playerId: a.playerId, role: a.primitive.role, acceleration: a.primitive.acceleration })) });
  const root = { ...h.root, response, field, evaluationTick: field.motion.world.moment.ball.tick };
  expect(h.census([root]).pendingPhysical.captures).toEqual([]);
});
it('LC11 rejects a lost original decision result instead of treating its accepted Source as empty work', () => {
  const h = setup(), seen = h.observation(h.root, 'seen'), decision = h.decision(seen, 'decision', seen);
  const { actionResult: _lost, ...missing } = decision;
  expect(() => h.census([h.root, seen, missing])).toThrow(/action result/);
});
it('LC12 keeps integer deadlines future when the exact horizon only rounds up to their recorded tick', () => {
  const h = setup(), seen = h.observation(h.root, 'seen'), decision = h.decision(seen, 'decision', seen, 10, 10);
  const early = h.capture(decision, 9.75 / 1_000_000), before = h.census([h.root, seen, decision, early]);
  expect(before.originalFieldPrefix.at).toEqual({ originTick: 0, elapsedSeconds: 9.75 / 1_000_000, tick: 10 });
  expect(before.observationRefresh.pending).toMatchObject([{ dueTick: 10, due: 'future' }]);
  expect(before.defenderDecisions.pending).toMatchObject([{ decisionTick: 10, movementStartTick: 10, decisionDue: 'future', movementDue: 'future' }]);
  const reached = h.capture(early, 10 / 1_000_000), after = h.census([h.root, seen, decision, early, reached]);
  expect(after.originalFieldPrefix.at.tick).toBe(10);
  expect(after.observationRefresh.pending).toMatchObject([{ dueTick: 10, due: 'due' }]);
  expect(after.defenderDecisions.pending).toMatchObject([{ decisionDue: 'due', movementDue: 'due' }]);
});
it('LC13 rejects motor consumption before its exact movement time even when the recorded tick matches', () => {
  const h = setup(), seen = h.observation(h.root, 'seen'), decision = h.decision(seen, 'decision', seen, 10, 10);
  const early = h.capture(decision, 9.75 / 1_000_000);
  const motor = h.step(early, 'early-motor', { kind: 'defender_motion_v1', motors: [{ self: { playerId: 'carrier' }, command: { playerId: 'carrier' } }], coverageThroughTick: 5_000_000 } as never,
    { kind: 'defender_motion_v1', selections: [{ member: { playerId: 'carrier' }, decisionReference: fieldRef(decision) }] } as never);
  expect(motor.evaluationTick).toBe(10);
  expect(() => h.census([h.root, seen, decision, early, motor])).toThrow(/motor original decision or player/);
});

it('LC14 received proposals keep their due work and cannot masquerade as motor issuance', () => {
  const h = setup(), seen = h.observation(h.root, 'seen'), at = (seen.actionResult as Extract<SamePaPhysicalFieldActionResult, {kind:'defender_observation_v1'}>).receipt.at;
  const response = h.step(seen, 'response', { kind: 'defender_catch_response_v1', playerId: 'carrier', observationReference: fieldRef(seen), issuedBySourceId: null,
    replan: { processSourceId: 'response', trigger: 'communication_received', cause: { playerId: 'carrier', physicalPitchSourceId: 'pitch' },
      originObservationSourceId: seen.source.sourceId, selectedAt: null, selected: { intent: { kind: 'hold' } }, semantic: 'ready', phase: 'pending_decision',
      scheduling: { decisionTick: 10, movementStartTick: null }, work: [{ kind: 'decision', dueTick: 10 }] } } as never,
    { kind: 'defender_catch_response_v1', member: { playerId: 'carrier' }, observationReference: fieldRef(seen), previousResponseReference: null } as never);
  const census = h.census([h.root, seen, response]);
  expect(census.catchResponses.pending).toMatchObject([{ responseReference: fieldRef(response), work: [{ kind: 'decision', due: 'future' }] }]);
  expect(census.catchResponses.adopted).toEqual([]); expect(census.pendingPhysical.captures).toHaveLength(1);
  const phases = deriveSamePaCatchPhaseWork({ fields: [h.root, seen, response], census, calls: [] });
  expect(phases.phases.filter(p => p.kind === 'decision_issue' || p.kind === 'motor_adoption').every(p => !p.source.completion)).toBe(true);
  const motor = h.step(response, 'false-issuance', { kind: 'defender_motion_v1', motors: [{ self: { playerId: 'carrier' }, command: { playerId: 'carrier' }, issuedAt: at, startAt: at }] } as never,
    { kind: 'defender_motion_v1', selections: [{ member: { playerId: 'carrier' }, decisionReference: fieldRef(response) }] } as never);
  expect(() => h.census([h.root, seen, response, motor])).toThrow(/not issued or due/);
});
it('LC15 received work is consumed only by matching actual motor adoption and keeps its exact issuance', () => {
  const h = setup(), capture = prepareBattedWorldScheduledFieldAcquisition({ response: h.root.response, geometry: h.root.geometry, field: h.root.field });
  const secured = h.capture(h.root, capture.fenceElapsedSeconds), seen = h.observation(secured, 'seen'), at = (seen.actionResult as Extract<SamePaPhysicalFieldActionResult, {kind:'defender_observation_v1'}>).receipt.at;
  const response = h.step(seen, 'response', { kind: 'defender_catch_response_v1', playerId: 'carrier', observationReference: fieldRef(seen), issuedBySourceId: 'response',
    replan: { processSourceId: 'response', trigger: 'communication_received', cause: { playerId: 'carrier', physicalPitchSourceId: 'pitch' },
      originObservationSourceId: seen.source.sourceId, selectedAt: at, selected: { intent: { kind: 'hold' } }, semantic: 'ready', phase: 'renewal_due',
      scheduling: { decisionTick: at.tick, movementStartTick: at.tick }, work: [{ kind: 'renewal_adoption', dueTick: at.tick }] } } as never,
    { kind: 'defender_catch_response_v1', member: { playerId: 'carrier' }, observationReference: fieldRef(seen), previousResponseReference: null } as never);
  const motor = h.step(response, 'adoption', { kind: 'defender_motion_v1', motors: [{ self: { playerId: 'carrier' }, command: { playerId: 'carrier' }, issuedAt: at, startAt: at }] } as never,
    { kind: 'defender_motion_v1', selections: [{ member: { playerId: 'carrier' }, decisionReference: fieldRef(response) }] } as never);
  const census = h.census([h.root, secured, seen, response, motor]);
  expect(census.catchResponses.pending).toEqual([]); expect(census.catchResponses.adopted).toMatchObject([{ consumerReference: fieldRef(motor), at }]);
  const phaseWork = deriveSamePaCatchPhaseWork({ fields: [h.root, secured, seen, response, motor], census, calls: [] });
  expect(phaseWork.phases.find(p => p.kind === 'decision_issue')).toMatchObject({ completionReference: fieldRef(response) });
  expect(phaseWork.phases.find(p => p.kind === 'motor_adoption')).toMatchObject({ completionReference: fieldRef(motor) });
  const altered = structuredClone(motor) as SamePaPhysicalFieldStep;
  if (altered.actionResult?.kind !== 'defender_motion_v1') throw new Error('fixture motor missing');
  const bad = { ...altered, actionResult: { ...altered.actionResult, motors: altered.actionResult.motors.map(m => ({ ...m, issuedAt: { ...at, elapsedSeconds: 1 } })) } };
  expect(() => h.census([h.root, secured, seen, response, bad])).toThrow(/issuance differs/);
});

it('CP01 completes an executed sample without consuming its decision or caused refresh', () => {
  const h = setup(), seen = h.observation(h.root, 'sample'), fields = [h.root, seen];
  const result = deriveSamePaCatchPhaseWork({ fields, census: h.census(fields), calls: [] });
  const sample = result.phases.find(p => p.kind === 'observation_sample');
  expect(sample).toMatchObject({ originReference: fieldRef(seen), completionReference: fieldRef(seen),
    source: { completion: { completedAtTick: seen.evaluationTick }, queue: null },
    successors: [{ domain: 'controller_renewal', playerId: 'carrier' }, { domain: 'observation_scheduling', playerId: 'carrier' }] });
  expect(result).not.toHaveProperty('playEnd');
  expect(h.census(fields).observationRefresh.pending).toHaveLength(1);
});

it('CP02 completes only the exactly consumed decision/adoption and leaves the body controller open', () => {
  const h = setup(), plan = prepareBattedWorldScheduledFieldAcquisition({ response: h.root.response, geometry: h.root.geometry, field: h.root.field });
  const secured = h.capture(h.root, plan.fenceElapsedSeconds), seen = h.observation(secured, 'sample'), chosen = h.decision(seen, 'choice', seen, 0, 0);
  const fields = [h.root, secured, seen, chosen], before = deriveSamePaCatchPhaseWork({ fields, census: h.census(fields), calls: [] });
  expect(before.phases.find(p => p.kind === 'decision_issue')!.source).not.toHaveProperty('completion');
  const motor = h.step(chosen, 'motor', { kind: 'defender_motion_v1', motors: [{ self: { playerId: 'carrier' }, command: { playerId: 'carrier' } }] } as never,
    { kind: 'defender_motion_v1', selections: [{ member: { playerId: 'carrier' }, decisionReference: fieldRef(chosen) }] } as never);
  const afterFields = [...fields, motor], census = h.census(afterFields);
  const after = deriveSamePaCatchPhaseWork({ fields: afterFields, census, calls: [] });
  for (const kind of ['decision_issue', 'motor_adoption']) expect(after.phases.find(p => p.kind === kind)).toMatchObject({
    originReference: fieldRef(chosen), completionReference: fieldRef(motor), source: { completion: { completedAtTick: motor.evaluationTick } } });
  expect(after.phases.find(p => p.kind === 'motor_adoption')!.successors).toEqual([
    { domain: 'body_motion', playerId: 'carrier' }, { domain: 'controller_renewal', playerId: 'carrier' }]);
  const forged = { ...census, defenderDecisions: { ...census.defenderDecisions, consumed: census.defenderDecisions.consumed.map(d => ({
    ...d, consumerReference: { ...d.consumerReference, snapshotHash: hash('foreign') } })) } };
  expect(() => deriveSamePaCatchPhaseWork({ fields: afterFields, census: forged, calls: [] })).toThrow(/original|reference/);
});

it('CP03 completes a secured acquisition but keeps custody and rule consumption separate', () => {
  const h = setup(), plan = prepareBattedWorldScheduledFieldAcquisition({ response: h.root.response, geometry: h.root.geometry, field: h.root.field });
  const half = h.capture(h.root, plan.fenceElapsedSeconds / 2), earlyFields = [h.root, half];
  expect(deriveSamePaCatchPhaseWork({ fields: earlyFields, census: h.census(earlyFields), calls: [] }).phases
    .filter(p => p.kind === 'acquisition' && p.source.completion)).toEqual([]);
  const secured = h.capture(h.root, plan.fenceElapsedSeconds), fields = [h.root, secured];
  const result = deriveSamePaCatchPhaseWork({ fields, census: h.census(fields), calls: [] });
  expect(result.phases.find(p => p.kind === 'acquisition')).toMatchObject({ originReference: fieldRef(h.root),
    completionReference: fieldRef(secured), source: { completion: { completedAtTick: secured.evaluationTick } },
    successors: [{ domain: 'ball_and_contact_generation', playerId: null }, { domain: 'canonical_fair_catch_rule_consumption', playerId: null }] });
});

it('CP04 owns per-recipient delivery, preserves future reception and pins the first actual terminal receipt', () => {
  const h = setup(), plan = prepareBattedWorldScheduledFieldAcquisition({ response: h.root.response, geometry: h.root.geometry, field: h.root.field });
  const secured = h.capture(h.root, plan.fenceElapsedSeconds), calledAt = { originTick: 0, elapsedSeconds: 0, tick: 0 };
  const emitted = { sourceId: 'umpire', targetScope: { kind: 'nearby' as const }, kind: 'callout' as const, issuedAt: 0,
    content: { actionSourceId: 'call', officialId: 'umpire', personId: 'umpire-person', judgment: 'caught' as const, calledAt } };
  const action = { sourceId: 'call', sourceVersion: 'fixture-only', capability: 'same_pa_explicit_catch_action_v1' as const,
    assignmentReference: { sourceId: 'assignment', sourceVersion: 'fixture-only', sourceHash: hash('assignment') },
    officialId: 'umpire', personId: 'umpire-person', viewReference: ref('pa_lifecycle_v1_execution_views'), judgment: 'caught' as const, calledAt };
  const operative = deriveSamePaCatchOperativeRuling({ action, originalMatch: { playId: 1, ruleProfileId: 'npb-2026', outs: 0,
    bases: { first: null, second: null, third: null } } as never, batterRunnerId: 'batter', basisTick: 0, basisEvidenceRevision: 1,
    fairCatch: { kind: 'pending', reason: 'actual_fair_catch_required' } });
  // A small structural owner seam around real Core reception results. These
  // records exercise phase projection, not SQLite admission or a genuine game.
  const call = (field: Field, id: string, previous: SamePaCatchWork | null): SamePaCatchWork => {
    const moment = field.field.motion.world.moment, at = { originTick: moment.originTick, elapsedSeconds: moment.elapsedSeconds, tick: moment.ball.tick };
    return { source: { sourceId: id, priorWorkReference: previous ? reference('pa_catch_v1_work', previous) : null }, lineage: h.root.lineage,
      physicalPitchReference: { sourceId: 'pitch' }, physicalOperationReference: fieldRef(field), evaluationTick: at.tick,
      originalInputs: { action }, operative, communication: { emitted, evaluatedThrough: at,
        recipients: h.scope.participantIds.map(playerId => {
          const reception = resolveExactCommunicationReception(emitted, 0, { originTick: 0, ticksPerSecond: 1_000_000 },
            { propagationDelayTicks: 100, recognitionBaseDelayTicks: 0, maxAdditionalRecognitionDelayTicks: 0,
              audibility: playerId === 'receiver' ? 0 : 1, recognition: 1, attention: 1, minimumRecognizableQuality: 0.5 }, new DeterministicRng(1));
          return !reception ? { playerId, kind: 'dropped', reason: 'not_recognizable' }
            : reception.receivedAtElapsedSeconds > at.elapsedSeconds ? { playerId, kind: 'scheduled', reception, receiverPosition: null }
              : { playerId, kind: 'received', reception, receiverPosition: v(0, 0, 0) };
        }) } } as unknown as SamePaCatchWork;
  };
  const first = call(h.root, 'delivery-start', null);
  const initial = deriveSamePaCatchPhaseWork({ fields: [h.root], census: h.census([h.root]), calls: [first] });
  expect(initial.phases.find(p => p.playerId === 'batter')!.source).not.toHaveProperty('completion');
  expect(initial.phases.find(p => p.playerId === 'receiver')).toMatchObject({ completionReference: reference('pa_catch_v1_work', first), successors: [] });
  expect(initial.phases.find(p => p.kind === 'catch_rule_evidence')).toMatchObject({
    source: { completion: { basisEventId: 'call:rule-evidence' } }, successors: [{ domain: 'canonical_fair_catch_rule_consumption', playerId: null }] });
  expect(operative.kind === 'retired' && operative.ledger.events[0].kind).toBe('UnresolvedCorrectRuleSnapshotRecorded');
  const next = call(secured, 'delivery-finished', first), fields = [h.root, secured], census = h.census(fields);
  const result = deriveSamePaCatchPhaseWork({ fields, census, calls: [first, next] });
  const delivered = result.phases.find(p => p.kind === 'communication_delivery' && p.playerId === 'batter')!;
  expect(delivered).toMatchObject({ originReference: reference('pa_catch_v1_work', first), completionReference: reference('pa_catch_v1_work', next),
    source: { completion: { completedAtTick: next.evaluationTick } }, successors: [{ domain: 'controller_renewal', playerId: 'batter' }] });
  expect(delivered.source.sourceId).toBe(initial.phases.find(p => p.playerId === 'batter')!.source.sourceId);
  expect(delivered.source.revision).toBeGreaterThan(initial.phases.find(p => p.playerId === 'batter')!.source.revision);
  const later = call(secured, 'later-read', next);
  expect(deriveSamePaCatchPhaseWork({ fields, census, calls: [first, next, later] }).phases.find(p => p.kind === 'communication_delivery' && p.playerId === 'batter')!.completionReference)
    .toEqual(reference('pa_catch_v1_work', next));
  const duplicate = { ...next, communication: { ...next.communication, recipients: [...next.communication.recipients, next.communication.recipients[0]] } };
  expect(() => deriveSamePaCatchPhaseWork({ fields, census, calls: [first, duplicate] })).toThrow(/scope/);
  expect(() => deriveSamePaCatchPhaseWork({ fields, census, calls: [{ ...next, physicalOperationReference: ref('pa_physical_v1_field_steps') } as never] })).toThrow(/reference/);
});
