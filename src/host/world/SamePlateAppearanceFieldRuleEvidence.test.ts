import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import { createCanonicalPlateAppearanceTimeline, recordBatBallContact } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { deriveSamePaFairCatchRuleBasis } from './SamePlateAppearanceFairCatchRuleBasis';
import { fixture, material, v, throwInput } from '../../core/sim/ball/BattedWorldScheduledFieldThrow.test-support';
import { createBattedBallFlightEvidence } from '../../core/sim/ball/BattedBallFlightEvidence';
import { prepareBattedWorldScheduledFieldThrow, advanceBattedWorldScheduledFieldThrow } from '../../core/sim/ball/BattedWorldScheduledFieldThrow';
import { deriveInitialBattedWorldFieldMotion } from '../../core/sim/ball/BattedWorldFieldMotion';
import { prepareBattedWorldScheduledFieldAcquisition } from '../../core/sim/ball/BattedWorldScheduledFieldAcquisition';
import { deriveSamePaPhysicalFieldCapture } from './SamePlateAppearancePhysicalFieldCapture';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep, SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import { deriveSamePaFieldRuleEvidence } from './SamePlateAppearanceFieldRuleEvidence';
import { deriveSamePaLiveWorkCensus } from './SamePlateAppearanceLiveWorkCensus';
const ref = (owner: string) => ({ owner, sourceId: owner, sourceHash: hash(owner), snapshotHash: hash(owner) });
const fieldRef = (r: SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep) => reference(r.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', r);
/** Explicit synthetic physical parameters. Core computes the contact/capture;
 * these short calculation tests do not claim Native ownership. */
const setup = () => {
  const original = fixture(0, 1, 5, 5), ids = ['batter', 'carrier', 'receiver'];
  const actors = ids.flatMap((playerId, index) => ['body', 'glove', 'tag_hand', 'left_foot', 'right_foot'].map(role => {
    const glove = original.response.world.actors.find(a => a.playerId === playerId)?.primitive;
    return { playerId, primitive: { role, radius: 0.125, startTick: 0, endTick: 5_000_000, ticksPerSecond: 1_000_000,
      startCenter: v(glove?.startCenter.x ?? 20 + index * 5, role === 'glove' ? 5 : 10 + ['body', 'tag_hand', 'left_foot', 'right_foot'].indexOf(role), 5),
      startVelocity: glove?.startVelocity ?? v(0, 0, 0), acceleration: v(0, 0, 0) } };
  })) as SamePaPhysicalFieldRoot['field']['motion']['actors'];
  const response = { ...original.response, world: { ...original.response.world, actors }, actors: actors.map(a => ({ playerId: a.playerId,
    profile: a.primitive.role === 'glove' ? original.response.actors[0].profile : { role: a.primitive.role, material } })) };
  const field = deriveInitialBattedWorldFieldMotion({ ...original, response, commands: actors.map(a => ({ playerId: a.playerId, role: a.primitive.role, acceleration: v(0, 0, 0) })) });
  const root = { kind: 'same_pa_physical_field_root_v1', source: { sourceId: 'root', sourceVersion: 'fixture-only', parameters: response.world.parameters },
    physicalPitchSourceId: 'pitch', pitchOrdinal: 3, operationOrdinal: 3, evaluationTick: field.motion.world.moment.ball.tick,
    response, geometry: original.geometry, field, lineage: { playId: 1 }, timeline: { playId: 1, startedAtTick: 0, lastEventTick: 0, nextSequence: 0, events: [], status: { kind: 'batted_ball_pending', count: { balls: 0, strikes: 0 } } } } as unknown as SamePaPhysicalFieldRoot;
  const scope = { batterRunnerId: 'batter', defenderIds: ['carrier', 'receiver'], outsAtStart: 0 };
  const append = (previous: SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep, throughElapsedSeconds: number): SamePaPhysicalFieldStep => {
    const source: SamePaPhysicalFieldStepSource = { sourceId: 'capture:' + (previous.operationOrdinal + 1), sourceVersion: 'fixture-only', capability: 'same_pa_physical_field_step_v1',
      viewReference: ref('pa_lifecycle_v1_execution_views') as never, launchReference: ref('pa_physical_v1_launches') as never,
      previousOperationReference: fieldRef(previous), previousFieldReference: fieldRef(previous), fieldRootReference: fieldRef(root) as never,
      throughTick: Math.round(throughElapsedSeconds * 1_000_000), action: { kind: 'capture_checkpoint_v1', candidateReference: fieldRef(root), throughElapsedSeconds } };
    return { ...root, kind: 'same_pa_physical_field_step_v1', source, operationOrdinal: previous.operationOrdinal + 1,
      ...deriveSamePaPhysicalFieldCapture(source, root, previous, root) };
  };
  return { root, scope, append };
};
it('FR01 reads sole-glove territory while capture and all terminal effects remain pending', () => {
  const h = setup(), result = deriveSamePaFieldRuleEvidence({ ...h.scope, fields: [h.root] });
  expect(result.rule.fieldTerritory).toMatchObject({ kind: 'resolved', territory: 'fair', basis: 'fielder_touch' });
  expect(result.rule.ballEvidence).toMatchObject({ kind: 'unresolved', reason: 'catch_pending' });
  expect(result.batterFirstBase.history.events).toEqual([]);
  expect(result.defendersFirstBase.every(d => d.controlledContacts.length === 0)).toBe(true);
  expect(result.terminal).toEqual({ kind: 'pending', reason: 'reserved_live_play_end_owner_missing', physicalEnd: null });
  expect(result).not.toHaveProperty('officialLedger'); expect(result).not.toHaveProperty('score');
});
it('FR02 capture remains unconfirmed until its real fence then exposes the existing fly-catch rule', () => {
  const h = setup(), plan = prepareBattedWorldScheduledFieldAcquisition({ response: h.root.response, geometry: h.root.geometry, field: h.root.field }), first = h.append(h.root, 0.01), secured = h.append(first, plan.fenceElapsedSeconds);
  const waiting = deriveSamePaFieldRuleEvidence({ ...h.scope, fields: [h.root, first] });
  expect(waiting.rule.possessionEvidence.pending).toHaveLength(1); expect(waiting.physical.controlWindows).toEqual([]);
  const result = deriveSamePaFieldRuleEvidence({ ...h.scope, fields: [h.root, first, secured] });
  expect(result.rule.ballEvidence).toMatchObject({ kind: 'fly_catch', correctRuleResult: { kind: 'caught' } });
  expect(result.rule.possessionEvidence.pending).toEqual([]); expect(result.physical.controlWindows).toHaveLength(1);
  expect(result.terminal.physicalEnd).toBeNull();
});
it('FR03 rejects omitted, reordered and foreign physical prefix ownership', () => {
  const h = setup(), first = h.append(h.root, 0.01), plan = prepareBattedWorldScheduledFieldAcquisition({ response: h.root.response, geometry: h.root.geometry, field: h.root.field }), secured = h.append(first, plan.fenceElapsedSeconds);
  for (const fields of [[first], [h.root, secured], [h.root, first, first], [h.root, { ...first, physicalPitchSourceId: 'foreign' }]])
    expect(() => deriveSamePaFieldRuleEvidence({ ...h.scope, fields: fields as never })).toThrow();
});
it('FR04 first-base history consumes both owned feet and rejects incomplete physical coverage', () => {
  const h = setup(), changed = structuredClone(h.root);
  const field = { ...changed.field, motion: { ...changed.field.motion, actors: changed.field.motion.actors.filter(a => a.playerId !== 'batter' || a.primitive.role !== 'right_foot') } };
  expect(() => deriveSamePaFieldRuleEvidence({ ...h.scope, fields: [{ ...changed, field }] })).toThrow(/coverage|feet|membership/);
});

it.each([1, 2, 3])('FR-occupied keeps %s additional complete stationary bodies in physical evidence and census', count => {
  const h = setup(), original = h.root.response, occupiedRunnerIds = Array.from({ length: count }, (_, i) => 'occupied-' + i);
  const extra = occupiedRunnerIds.flatMap((playerId, i) => original.world.actors.filter(a => a.playerId === 'batter').map(a => ({
    playerId, primitive: { ...a.primitive, startCenter: { ...a.primitive.startCenter, x: 100 + i }, startVelocity: v(0, 0, 0) },
  })));
  const actors = [...original.world.actors, ...extra], response = { ...original, world: { ...original.world, actors },
    actors: [...original.actors, ...extra.map(a => ({ playerId: a.playerId,
      profile: original.actors.find(p => p.playerId === 'batter' && p.profile.role === a.primitive.role)!.profile }))] };
  const field = deriveInitialBattedWorldFieldMotion({ response, geometry: h.root.geometry, availableAtTick: 0, throughTick: 1_000_000,
    commands: actors.map(a => ({ playerId: a.playerId, role: a.primitive.role, acceleration: v(0, 0, 0) })) });
  const root = { ...h.root, response, field, evaluationTick: field.motion.world.moment.ball.tick };
  const evidence = deriveSamePaFieldRuleEvidence({ ...h.scope, occupiedRunnerIds, fields: [root] });
  expect(evidence.physical.segments[0].actors).toHaveLength((3 + count) * 5);
  expect(evidence.terminal.physicalEnd).toBeNull();
  expect(evidence).not.toHaveProperty('occupiedRunnerBaseContacts');
  const appealMarker = { ...root, kind: 'same_pa_physical_field_step_v1', operationOrdinal: root.operationOrdinal + 1,
    source: { ...root.source, sourceId: 'appeal-indication', previousOperationReference: fieldRef(root), previousFieldReference: fieldRef(root), fieldRootReference: fieldRef(root) },
    actionResult: { kind: 'appeal_indication_v1' } } as unknown as SamePaPhysicalFieldStep;
  const appealEvidence = deriveSamePaFieldRuleEvidence({ ...h.scope, occupiedRunnerIds, fields: [root, appealMarker] });
  expect(appealEvidence.occupiedRunnerBaseContacts).toHaveLength(count);
  expect(appealEvidence.occupiedRunnerBaseContacts!.every(r => r.bases.length === 4)).toBe(true);
  const census = deriveSamePaLiveWorkCensus({ fields: [root], participantIds: ['batter', 'carrier', 'receiver', ...occupiedRunnerIds],
    observationPolicies: [], possessionEvidence: evidence.rule.possessionEvidence });
  expect(census.originalFieldPrefix.participantIds).toEqual(['batter', 'carrier', 'receiver', ...occupiedRunnerIds]);
  expect(census.participantCurves.map(p => p.playerId)).toEqual(census.originalFieldPrefix.participantIds);
  for (const playerId of occupiedRunnerIds) {
    const owned = census.participantCurves.find(p => p.playerId === playerId)!;
    expect(owned.roles.map(r => r.role).sort()).toEqual(['body', 'glove', 'left_foot', 'right_foot', 'tag_hand']);
    expect(owned.coverageThroughTick).toBe(1_000_000);
  }
  expect(() => deriveSamePaFieldRuleEvidence({ ...h.scope, fields: [root] })).toThrow(/membership/);
  const missing = { ...root, field: { ...field, motion: { ...field.motion, actors: field.motion.actors.slice(0, -1) } } };
  expect(() => deriveSamePaFieldRuleEvidence({ ...h.scope, occupiedRunnerIds, fields: [missing] })).toThrow(/coverage|membership/);
});

it('FR05 actual fair ground remains unresolved at first base without real controlled bag contact', () => {
  const h = setup(), original = h.root.response, parameters = { ...original.world.parameters, gravityY: -9.81 };
  const contact = { ...original.world.flight.contact, ballCenter: v(10, 1, 10), point: v(10, 1, 10), batPoint: v(10, 1, 10), exitVelocity: v(1, -1, 0) };
  const response = { ...original, world: { ...original.world, parameters, flight: createBattedBallFlightEvidence({ contact, parameters, searchDurationTicks: 0 }) } };
  const field = deriveInitialBattedWorldFieldMotion({ response, geometry: h.root.geometry, availableAtTick: 0, throughTick: 1_000_000,
    commands: response.world.actors.map(a => ({ playerId: a.playerId, role: a.primitive.role, acceleration: a.primitive.acceleration })) });
  const root = { ...h.root, source: { ...h.root.source, parameters: { ...h.root.source.parameters, ...parameters } }, response, field, evaluationTick: field.motion.world.moment.ball.tick };
  const result = deriveSamePaFieldRuleEvidence({ ...h.scope, fields: [root] });
  expect(result.rule.ballEvidence).toMatchObject({ kind: 'grounded', territory: 'fair' });
  expect(result.rule.groundRule?.correctRuleResult).toMatchObject({ kind: 'unresolved', batterRunnerFirstBase: { reason: 'no_first_base_event' } });
  expect(result.terminal.physicalEnd).toBeNull();
});
it('FR06 a real throw releases exclusive custody without creating a physical end or receiver possession', () => {
  const h = setup(), capture = prepareBattedWorldScheduledFieldAcquisition({ response: h.root.response, geometry: h.root.geometry, field: h.root.field });
  const secured = h.append(h.root, capture.fenceElapsedSeconds), nominal = throwInput(fixture(0, 1, 5, 5));
  const plan = prepareBattedWorldScheduledFieldThrow({ response: h.root.response, geometry: h.root.geometry, actors: secured.field.motion.actors,
    cursor: secured.field.motion.cursor!, carrierPlayerId: 'carrier', receiverPlayerId: 'receiver', availableAtTick: secured.evaluationTick, throughTick: 5_000_000,
    commands: secured.field.motion.actors.map(a => ({ playerId: a.playerId, role: a.primitive.role, acceleration: a.primitive.acceleration })),
    ratings: nominal.ratings, transferParameters: nominal.transferParameters, throwCalibration: nominal.throwCalibration, seed: nominal.seed });
  const planSource = { ...secured.source, sourceId: 'throw-plan', previousOperationReference: fieldRef(secured), previousFieldReference: fieldRef(secured) };
  const planned: SamePaPhysicalFieldStep = { ...secured, source: planSource, operationOrdinal: secured.operationOrdinal + 1,
    actionResult: { kind: 'throw_plan_v1', plan, fieldingModelHash: hash('author-fixture') } };
  const progress = advanceBattedWorldScheduledFieldThrow({ plan, previous: null, throughElapsedSeconds: plan.releaseElapsedSeconds });
  const released: SamePaPhysicalFieldStep = { ...planned, source: { ...planSource, sourceId: 'release', previousOperationReference: fieldRef(planned), previousFieldReference: fieldRef(planned) },
    operationOrdinal: planned.operationOrdinal + 1, evaluationTick: progress.field.motion.world.moment.ball.tick, field: progress.field,
    actionResult: { kind: 'throw_checkpoint_v1', planReference: fieldRef(planned) as never, progress } };
  const result = deriveSamePaFieldRuleEvidence({ ...h.scope, fields: [h.root, secured, planned, released] });
  expect(progress.kind).toBe('released');
  expect(result.physical.controlWindows.filter(w => w.endElapsedSeconds === plan.releaseElapsedSeconds).every(w => !w.endInclusive)).toBe(true);
  expect(result.physical.controlWindows.some(w => w.playerId === 'receiver')).toBe(false);
  expect(result.terminal.physicalEnd).toBeNull();
});

it('FR07 contact by a non-defender stays a Core policy question and grants no capture authority', () => {
  const h = setup(), swap = (id: string) => id === 'batter' ? 'carrier' : id === 'carrier' ? 'batter' : id;
  const response = { ...h.root.response, world: { ...h.root.response.world, actors: h.root.response.world.actors.map(a => ({ ...a, playerId: swap(a.playerId) })) },
    actors: h.root.response.actors.map(a => ({ ...a, playerId: swap(a.playerId) })) };
  const field = deriveInitialBattedWorldFieldMotion({ response, geometry: h.root.geometry, availableAtTick: 0, throughTick: 1_000_000,
    commands: response.world.actors.map(a => ({ playerId: a.playerId, role: a.primitive.role, acceleration: a.primitive.acceleration })) });
  const result = deriveSamePaFieldRuleEvidence({ ...h.scope, fields: [{ ...h.root, response, field, evaluationTick: field.motion.world.moment.ball.tick }] });
  expect(result.rule.ballEvidence).toEqual({ kind: 'unresolved', reason: 'non_defender_contact' });
  expect(result.rule.possessionEvidence.pending).toEqual([]); expect(result.physical.controlWindows).toEqual([]);
});

it.each([0, 2] as const)('FR08 binds an empty-base correct catch ruling with %s outs without creating an official call or end', outs => {
  const h = setup(), plan = prepareBattedWorldScheduledFieldAcquisition({ response: h.root.response, geometry: h.root.geometry, field: h.root.field });
  const secured = h.append(h.root, plan.fenceElapsedSeconds);
  const originalMatch = { ruleProfileId: asRuleProfileId('npb-2026'), playId: 1, inning: 1, half: 'top' as const, outs,
    balls: 0, strikes: 0, bases: { first: null, second: null, third: null }, score: { away: 0, home: 0 } };
  const originalTimeline = recordBatBallContact(createCanonicalPlateAppearanceTimeline(originalMatch, 0), h.root.response.world.flight.contact);
  const evidence = deriveSamePaFieldRuleEvidence({ ...h.scope, outsAtStart: outs, fields: [h.root, secured] });
  const basis = deriveSamePaFairCatchRuleBasis({ originalMatch, originalTimeline, evidence });
  expect(basis).toMatchObject({ kind: 'same_pa_fair_catch_rule_basis_v1', batterRunnerId: 'batter',
    correctRuling: { outsAfter: outs + 1, basesAfter: originalMatch.bases, scoredRunnerIds: [] }, physicalEnd: null, operativeCall: null });
  const candidate = deriveSamePaFieldRuleEvidence({ ...h.scope, outsAtStart: outs, fields: [h.root] });
  expect(deriveSamePaFairCatchRuleBasis({ originalMatch, originalTimeline, evidence: candidate })).toEqual({ kind: 'pending', reason: 'actual_fair_catch_required' });
  expect(() => deriveSamePaFairCatchRuleBasis({ originalMatch: { ...originalMatch, playId: 2 }, originalTimeline, evidence })).toThrow(/original contact scope/);
  expect(deriveSamePaFairCatchRuleBasis({ originalMatch: { ...originalMatch, bases: { first: 'prior', second: null, third: null } }, originalTimeline, evidence }))
    .toEqual({ kind: 'pending', reason: 'occupied_runner_original_base_contact_history_required' });
});
