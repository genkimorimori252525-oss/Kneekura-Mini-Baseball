import { expect, it, vi } from 'vitest';
// This suite exercises the immediate projection/binding seam, not the separate
// post-play owner or its SQLite traversal.
vi.mock('./ActualPostPlayReviewFromSqlite', () => ({}));
import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { fixture, throwInput } from '../../core/sim/ball/BattedWorldScheduledFieldThrow.test-support';
import { createBattedBallFlightEvidence } from '../../core/sim/ball/BattedBallFlightEvidence';
import { deriveInitialBattedWorldFieldMotion, deriveBattedWorldFieldMotionAdoption, advanceBattedWorldFieldMotionCheckpoint } from '../../core/sim/ball/BattedWorldFieldMotion';
import { prepareBattedWorldScheduledFieldAcquisition, advanceBattedWorldScheduledFieldAcquisition } from '../../core/sim/ball/BattedWorldScheduledFieldAcquisition';
import { prepareBattedWorldScheduledFieldThrow, advanceBattedWorldScheduledFieldThrow } from '../../core/sim/ball/BattedWorldScheduledFieldThrow';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samePaPhysicalEpisodeSourceInput } from './SamePlateAppearancePhysicalEpisode';
import { battedVenueLegalCoveragePolicyInput, bindSamePaVenueLegalCoveragePolicy, type AcceptedBattedVenueLegalCoveragePolicy } from './BattedVenueLegalCoveragePolicy';
import { readSamePaVenueLegalCoverageFromPair } from './SamePlateAppearanceVenueLegalCoverage';
const ref = (owner: string, id = owner) => ({ owner, sourceId: id, sourceHash: hash(id), snapshotHash: hash(id) });
const policy = (): AcceptedBattedVenueLegalCoveragePolicy => ({ sourceId: 'legal', sourceVersion: 'synthetic-v1', version: 'batted_venue_legal_coverage_policy_v1',
  gameId: 'game', careerId: 'career', playId: 1, physicalPitchSourceId: 'pitch', fixtureEventId: 'fixture', venueId: 'venue', baseFieldSourceId: 'root',
  worldModelSourceId: 'model', worldModelSourceVersion: 'v1', responseModelSourceId: 'response', responseModelSourceVersion: 'v1',
  geometryBindingHash: hash('geometry'), availableAtDay: 1,
  rulePolicy: { version: 'closed_interior_venue_legal_regions_v1', ruleProfileId: NPB_2026_RULE_PROFILE.id, rulesRevision: NPB_2026_RULE_PROFILE.rulesRevision,
    regions: [{ regionId: 'live', classification: 'inside_playable_region', minimum: { x: -5, y: -5, z: -5 }, maximum: { x: 5, y: 5, z: 5 } },
      { regionId: 'dead', classification: 'out_of_play', minimum: { x: -20, y: -5, z: -5 }, maximum: { x: -6, y: 5, z: 5 } }] },
  pitcherPlate: { region: { center: { x: 1.25, z: 0 }, halfSize: { x: 0.25, z: 0.125 }, rotationRadians: 0 }, surfaceHeightMeters: 0 },
});
const context = () => {
  const fixture = { game_id: 'game', fixture_event_id: 'fixture', venue_id: 'venue' };
  const scope = { gameId: 'game', careerId: 'career', fixtureEventId: 'fixture', venueId: 'venue' };
  return { fixture, geometryBindingHash: hash('geometry'),
    actor: { source: { gameId: 'game' }, match: { playId: 1, ruleProfileId: NPB_2026_RULE_PROFILE.id },
      binding: { careerId: 'career', fixtureEventId: 'fixture', gameDay: 1 }, fixtureHash: hash(fixture) },
    model: { ...scope, sourceId: 'model', sourceVersion: 'v1' }, responseModel: { ...scope, sourceId: 'response', sourceVersion: 'v1' } };
};
// Structural reader seam with real Core acquisition/throw/motion. This does not
// claim that the synthetic reduced participant set is a Native admission.
const original = (f = fixture(), p = policy()) => {
  const c = context(), lineage = { gameId: 'game', careerId: 'career', playId: 1 };
  const source: any = { sourceId: 'root', sourceVersion: 'synthetic-v1', capability: 'same_pa_physical_field_root_v1',
    viewReference: ref('pa_lifecycle_v1_execution_views'), launchReference: ref('pa_physical_v1_launches', 'pitch'),
    previousOperationReference: ref('pa_physical_v1_resolutions'), resolutionReference: ref('pa_physical_v1_resolutions'),
    postureReference: ref('batting_observation_v1_postures'), fieldInputs: { kind: 'fresh_physical_field_calibration_v1', calibrationReference: ref('pa_physical_v1_field_calibrations') },
    commands: Array.from({ length: 10 }, (_, i) => ({ playerId: String(i), bodyAcceleration: { x: 0, y: 0, z: 0 }, primitiveMotions: [] })),
    parameters: f.response.world.parameters, throughTick: 0, venueLegalCoveragePolicy: p };
  const initial = f.response.world.flight.initialBall;
  const field = f.throughTick === initial.tick ? deriveBattedWorldFieldMotionAdoption({ response: f.response, geometry: f.geometry,
    actors: f.response.world.actors, carrierPlayerId: null, availableAtTick: initial.tick,
    coverageThroughTick: f.response.world.throughTick, commands: f.commands,
    cursor: { moment: { originTick: initial.tick, elapsedSeconds: 0, ball: initial }, previousContacts: [] } }) : deriveInitialBattedWorldFieldMotion(f);
  const root: any = { kind: 'same_pa_physical_field_root_v1', source, lineage, physicalPitchSourceId: 'pitch', field,
    response: f.response, geometry: f.geometry, geometryBindingHash: c.geometryBindingHash,
    venueLegalCoveragePolicyBinding: bindSamePaVenueLegalCoveragePolicy(source, c as any) };
  const records: any[] = [root];
  const add = (sourceId: string, field: any, actionResult: any) => {
    const value = { kind: 'same_pa_physical_field_step_v1', source: { sourceId, sourceVersion: 'synthetic-v1' }, lineage, physicalPitchSourceId: 'pitch', field,
      ...(actionResult === undefined ? {} : { actionResult }) };
    records.push(value); return value;
  };
  const pair = (): any => {
    const references = records.map(r => reference(r.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', r));
    return { kind: 'same_pa_field_rule_read_pair_v1', actor: c.actor, fields: records, view: { lineage },
      value: { fieldReferences: references, physicalOperationReference: references.at(-1) } };
  };
  return { f, c, root, records, pair, add };
};
it('VL01 accepted Source binds actual fixture, model, response, geometry and optional plate without adding legacy keys', () => {
  const h = original();
  expect(samePaPhysicalEpisodeSourceInput(h.root.source)).toEqual(h.root.source);
  const old = { ...h.root.source }; delete old.venueLegalCoveragePolicy;
  expect(samePaPhysicalEpisodeSourceInput(old)).not.toHaveProperty('venueLegalCoveragePolicy');
  expect(bindSamePaVenueLegalCoveragePolicy(old, h.c as any)).toBeUndefined();
  const value = readSamePaVenueLegalCoverageFromPair(h.pair());
  expect(value.kind).toBe('same_pa_venue_legal_coverage_v1');
  if (value.kind !== 'same_pa_venue_legal_coverage_v1') throw new Error('coverage required');
  expect(value.coverage.kind).toBe('complete');
  expect(value.pitcherPlate).toEqual(policy().pitcherPlate);
});
it.each(['fixtureEventId', 'venueId', 'worldModelSourceVersion', 'responseModelSourceId', 'geometryBindingHash', 'careerId'] as const)(
  'VL02 rejects changed original %s even when supplied as accepted configuration', key => {
    const h = original(), p = { ...policy(), [key]: key === 'geometryBindingHash' ? hash('foreign') : 'foreign' };
    expect(() => bindSamePaVenueLegalCoveragePolicy({ ...h.root.source, venueLegalCoveragePolicy: p }, h.c as any)).toThrow(/original physical/);
  });
it('VL03 requires explicit original venue policy and rejects result flags or malformed plate geometry', () => {
  const h = original(); delete h.root.source.venueLegalCoveragePolicy; delete h.root.venueLegalCoveragePolicyBinding;
  expect(readSamePaVenueLegalCoverageFromPair(h.pair())).toEqual({ kind: 'pending', reason: 'original_venue_legal_coverage_policy_required' });
  expect(() => battedVenueLegalCoveragePolicyInput({ ...policy(), inPlay: true } as any)).toThrow();
  expect(() => battedVenueLegalCoveragePolicyInput({ ...policy(), pitcherPlate: { ...policy().pitcherPlate!, surfaceHeightMeters: Infinity } })).toThrow();
});
const releasedAppeal = () => {
  // The throw must clear the real home-base prism before reaching the certified
  // out-of-play interior. A lower flight physically stops at that earlier hit.
  const h = original(fixture(0, 1, 2)), rootReference = reference('pa_physical_v1_field_roots', h.root);
  const acquisition = prepareBattedWorldScheduledFieldAcquisition({ response: h.f.response, geometry: h.f.geometry, field: h.root.field });
  const progress = advanceBattedWorldScheduledFieldAcquisition({ plan: acquisition, previous: null, throughElapsedSeconds: acquisition.fenceElapsedSeconds });
  if (progress.kind !== 'secured') throw new Error('synthetic physical acquisition');
  const carried = { baseContacts: [], motion: { actors: h.root.field.motion.actors, carrierPlayerId: acquisition.acquirerPlayerId,
    world: progress.world, cursor: progress.cursor, response: { kind: 'carried', cursor: progress.cursor } } };
  h.add('capture', carried, { kind: 'capture_checkpoint_v1', candidateReference: rootReference, progress });
  const indication = h.add('indication', carried, { kind: 'appeal_indication_v1' });
  const plan = prepareBattedWorldScheduledFieldThrow({ ...throwInput(h.f), cursor: progress.cursor });
  const planned = h.add('throw', carried, { kind: 'throw_plan_v1', plan, appealIndicationReference: reference('pa_physical_v1_field_steps', indication) });
  const planReference = reference('pa_physical_v1_field_steps', planned);
  const released = advanceBattedWorldScheduledFieldThrow({ plan, previous: null, throughElapsedSeconds: plan.releaseElapsedSeconds });
  if (released.kind !== 'released') throw new Error('synthetic physical release');
  const releaseRow = h.add('release', released.field, { kind: 'throw_checkpoint_v1', planReference, progress: released });
  const releaseReference = reference('pa_physical_v1_field_steps', releaseRow);
  if (!released.field.motion.cursor) throw new Error('synthetic release cursor');
  return { h, released, releaseReference };
};
it('VL04 finds failed appeal-purpose throw out-of-play without an appeal contact receipt and preserves an earlier cut', () => {
  const { h, released, releaseReference } = releasedAppeal();
  const free = advanceBattedWorldFieldMotionCheckpoint({ response: h.f.response, geometry: h.f.geometry,
    cursor: released.field.motion.cursor!, actors: released.field.motion.actors, carrierPlayerId: null, checkpointThroughTick: 1_900_000 });
  expect(free.motion.world.kind).toBe('moving');
  expect(free.motion.carrierPlayerId).toBeNull();
  expect(free.motion.world.moment.ball.tick).toBe(1_900_000);
  h.add('failed-flight', free, undefined);
  const before = JSON.stringify(h.records), value = readSamePaVenueLegalCoverageFromPair(h.pair());
  if (value.kind !== 'same_pa_venue_legal_coverage_v1') throw new Error('coverage required');
  expect(value.appealThrows).toHaveLength(1);
  expect(value.appealThrows[0].release?.fieldReference).toEqual(releaseReference);
  expect(value.appealThrows[0].segmentIndexes).toEqual([5]);
  expect(value.fieldSegments[5].constraint).toBe('free');
  expect(value.appealThrows[0].coverage?.firstCertainOutOfPlay?.tick).toBe(1_900_000);
  expect(value.appealThrows[0].coverage?.uncertainSpans.length).toBeGreaterThan(0);
  expect(value.unresolvedCarrierSpans.length).toBeGreaterThan(0);
  const earlier = readSamePaVenueLegalCoverageFromPair(h.pair(), releaseReference);
  if (earlier.kind !== 'same_pa_venue_legal_coverage_v1') throw new Error('earlier coverage required');
  expect(earlier.coverage.firstCertainOutOfPlay).toBeNull();
  expect(JSON.stringify(h.records)).toBe(before);
  expect(() => readSamePaVenueLegalCoverageFromPair(h.pair(), ref('pa_physical_v1_field_steps', 'foreign') as any)).toThrow(/outside/);
});
it('VL05 retains unconfirmed capture constraints until secured reception and excludes later carrying', () => {
  const { h, released } = releasedAppeal();
  const contact = advanceBattedWorldFieldMotionCheckpoint({ response: h.f.response, geometry: h.f.geometry,
    cursor: released.field.motion.cursor!, actors: released.field.motion.actors, carrierPlayerId: null, checkpointThroughTick: 4_000_000 });
  expect(contact.motion.response.kind).toBe('capture_candidate');
  const candidate = h.add('receiver-contact', contact, undefined);
  const candidateReference = reference('pa_physical_v1_field_steps', candidate);
  const plan = prepareBattedWorldScheduledFieldAcquisition({ response: h.f.response, geometry: h.f.geometry, field: contact });
  const capturing = advanceBattedWorldScheduledFieldAcquisition({ plan, previous: null,
    throughElapsedSeconds: (plan.contactMoment.elapsedSeconds + plan.secureElapsedSeconds) / 2 });
  expect(capturing.kind).toBe('capturing');
  const captureField = (progress: typeof capturing) => ({ baseContacts: progress.baseContacts,
    motion: { actors: contact.motion.actors, carrierPlayerId: progress.kind === 'secured' ? plan.acquirerPlayerId : null,
      world: progress.world, cursor: progress.cursor, response: progress.kind === 'secured' ? { kind: 'carried', cursor: progress.cursor }
        : { kind: progress.kind === 'interrupted' ? 'capture_interrupted' : 'capture_pending', cursor: null } } });
  h.add('receiver-capturing', captureField(capturing), { kind: 'capture_checkpoint_v1', candidateReference, progress: capturing });
  const pending = readSamePaVenueLegalCoverageFromPair(h.pair());
  if (pending.kind !== 'same_pa_venue_legal_coverage_v1') throw new Error('pending coverage required');
  expect(pending.appealThrows[0].segmentIndexes).toEqual([5, 6]);
  expect(pending.fieldSegments[6].constraint).toBe('glove_constraint');
  const secured = advanceBattedWorldScheduledFieldAcquisition({ plan, previous: capturing, throughElapsedSeconds: plan.fenceElapsedSeconds });
  if (secured.kind !== 'secured') throw new Error('synthetic receiver acquisition');
  h.add('receiver-secured', captureField(secured), { kind: 'capture_checkpoint_v1', candidateReference, progress: secured });
  const carried = advanceBattedWorldFieldMotionCheckpoint({ response: h.f.response, geometry: h.f.geometry,
    cursor: secured.cursor, actors: contact.motion.actors, carrierPlayerId: plan.acquirerPlayerId, checkpointThroughTick: 4_000_000 });
  h.add('receiver-carried', carried, undefined);
  const value = readSamePaVenueLegalCoverageFromPair(h.pair());
  if (value.kind !== 'same_pa_venue_legal_coverage_v1') throw new Error('coverage required');
  expect(value.appealThrows[0].segmentIndexes).toEqual([5, 6, 7]);
  expect(value.fieldSegments.slice(5).map(s => s.constraint)).toEqual(['free', 'glove_constraint', 'glove_constraint', 'carried']);
});

const rollingFixture = (x = 1, deceleration = 1) => {
  const f = fixture(7, 1, 0.125, 1.5), parameters = { ...f.response.world.parameters, groundRollingDecelerationMps2: deceleration };
  const contact = { ...f.response.world.flight.contact, ballCenter: { x, y: 0.125, z: 1.5 } };
  const actors = f.response.world.actors.map(a => ({ ...a, primitive: { ...a.primitive, startCenter: { x: 50, y: 2, z: 50 } } }));
  return { ...f, throughTick: 7, response: { ...f.response, world: { ...f.response.world, parameters, actors,
    flight: createBattedBallFlightEvidence({ contact, parameters, searchDurationTicks: 0 }) } } };
};
const advanceFree = (h: ReturnType<typeof original>, sourceId: string, seconds: number) => {
  const prior = h.records.at(-1).field.motion;
  const field = advanceBattedWorldFieldMotionCheckpoint({ response: h.f.response, geometry: h.f.geometry,
    cursor: prior.cursor, actors: prior.actors, carrierPlayerId: null, checkpointThroughTick: 7 + seconds * 1_000_000 });
  return h.add(sourceId, field, undefined);
};
it.each([[1, 'inside_playable_region'], [-10, 'out_of_play']] as const)(
  'VL06 projects executed rolling, stop and resting pieces continuously at x=%s', (x, classification) => {
    const h = original(rollingFixture(x));
    advanceFree(h, 'rolling', 0.5);
    const stopped = advanceFree(h, 'stop', 4);
    expect(stopped.field.motion.world).toMatchObject({ kind: 'boundary', phase: 'rolling', moment: { elapsedSeconds: 2 } });
    advanceFree(h, 'resting', 4);
    const before = JSON.stringify(h.records), value = readSamePaVenueLegalCoverageFromPair(h.pair());
    if (value.kind !== 'same_pa_venue_legal_coverage_v1') throw new Error('coverage required');
    expect(value.coverage.kind).toBe('complete');
    expect(value.coverage.intervals.map(s => s.classification)).toEqual(Array(4).fill(classification));
    expect(value.input.segments.map(s => [s.startElapsedSeconds, s.endElapsedSeconds])).toEqual([[0, 0], [0, 0.5], [0.5, 2], [2, 4]]);
    expect(value.input.segments.map(s => s.acceleration?.x)).toEqual([-1, -1, -1, 0]);
    expect(value.input.segments[3].basis.ball.velocity).toEqual({ x: 0, y: 0, z: 0 });
    expect(value.coverage.firstCertainOutOfPlay?.elapsedSeconds ?? null).toBe(classification === 'out_of_play' ? 0 : null);
    expect(value.fieldSegments.map(s => s.segmentIndex)).toEqual([0, 1, 2, 3]);
    expect(JSON.stringify(h.records)).toBe(before);
  });
it('VL07 retains zero-deceleration rolling without fabricating a stop and keeps unknown legal space unresolved', () => {
  const h = original(rollingFixture(1, 0));
  advanceFree(h, 'rolling', 0.5);
  const cut = reference('pa_physical_v1_field_steps', h.records.at(-1));
  advanceFree(h, 'outside-certified-space', 4);
  const earlier = readSamePaVenueLegalCoverageFromPair(h.pair(), cut), value = readSamePaVenueLegalCoverageFromPair(h.pair());
  if (earlier.kind !== 'same_pa_venue_legal_coverage_v1' || value.kind !== 'same_pa_venue_legal_coverage_v1') throw new Error('coverage required');
  expect(earlier.coverage.kind).toBe('complete');
  expect(earlier.input.segments[1].acceleration).toEqual({ x: -0, y: 0, z: -0 });
  expect(value.coverage.kind).toBe('pending');
  expect(value.coverage.uncertainSpans.map(s => s.segmentIndex)).toEqual([2]);
  expect(value.coverage.firstCertainOutOfPlay).toBeNull();
  expect(h.records.at(-1).field.motion.world).toMatchObject({ kind: 'moving', phase: 'rolling', moment: { elapsedSeconds: 4 } });
});
it('VL08 does not certify a free curve without its physical phase or beyond its rolling-stop partition', () => {
  const h = original(rollingFixture());
  const row = advanceFree(h, 'rolling', 0.5), real = row.field;
  for (const unsupported of ['missing-phase', 'past-stop'] as const) {
    row.field = structuredClone(real);
    const world = row.field.motion.world;
    if (unsupported === 'missing-phase') delete world.phase;
    else world.moment = { ...world.moment, elapsedSeconds: 4, ball: { ...world.moment.ball, tick: 4_000_007 } };
    const value = readSamePaVenueLegalCoverageFromPair(h.pair());
    if (value.kind !== 'same_pa_venue_legal_coverage_v1') throw new Error('coverage required');
    expect(value.input.segments[1].acceleration).toBeNull();
    expect(value.coverage.intervals[1].classification).toBe('unresolved');
  }
});
it('VL09 preserves live coverage through ground contact, no-advance observation/decision and the actual rolling/resting continuation', () => {
  const f = rollingFixture(), parameters = { ...f.response.world.parameters, groundRestitution: 0, groundFriction: 1 };
  const contact = { ...f.response.world.flight.contact, ballCenter: { x: 1, y: 0.625, z: 1.5 }, exitVelocity: { x: 2, y: -1, z: 0 } };
  const h = original({ ...f, response: { ...f.response, world: { ...f.response.world, parameters,
    flight: createBattedBallFlightEvidence({ contact, parameters, searchDurationTicks: 0 }) } } });
  const ground = advanceFree(h, 'ground-contact', 1);
  expect(ground.field.motion.world).toMatchObject({ phase: 'airborne', moment: { elapsedSeconds: 0.5, ball: { velocity: { y: -1 } } } });
  expect(ground.field.motion.cursor.moment.ball.velocity).toEqual({ x: 2, y: 0, z: 0 });
  // Native stable() copies the field unchanged for these actions. Preserve a
  // serialized copy too, so this seam does not rely on object identity.
  h.add('observation', ground.field, { kind: 'defender_observation_v1' });
  const decision = h.add('decision', structuredClone(ground.field), { kind: 'defender_decision_v1' });
  const decisionReference = reference('pa_physical_v1_field_steps', decision);
  advanceFree(h, 'rolling', 0.75);
  advanceFree(h, 'rolling-stop', 4);
  advanceFree(h, 'resting', 4);
  const before = JSON.stringify(h.records), cut = readSamePaVenueLegalCoverageFromPair(h.pair(), decisionReference);
  const value = readSamePaVenueLegalCoverageFromPair(h.pair());
  if (cut.kind !== 'same_pa_venue_legal_coverage_v1' || value.kind !== 'same_pa_venue_legal_coverage_v1') throw new Error('coverage required');
  expect(cut.coverage.kind).toBe('complete');
  expect(value.coverage.kind).toBe('complete');
  expect(value.input.segments.slice(2, 4).map(s => [s.startElapsedSeconds, s.endElapsedSeconds, s.basis.elapsedSeconds])).toEqual([[0.5, 0.5, 0.5], [0.5, 0.5, 0.5]]);
  expect(value.input.segments.slice(2, 4).every(s => s.basis === s.endpoint)).toBe(true);
  expect(value.input.segments.slice(4).map(s => [s.startElapsedSeconds, s.endElapsedSeconds, s.acceleration?.x])).toEqual([[0.5, 0.75, -1], [0.75, 2.5, -1], [2.5, 4, 0]]);
  expect(value.coverage.intervals.every(s => s.classification === 'inside_playable_region')).toBe(true);
  expect(JSON.stringify(h.records)).toBe(before);
});
