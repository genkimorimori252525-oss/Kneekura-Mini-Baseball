import { expect, it } from 'vitest';
import { deriveInitialBattedWorldFieldMotion } from '../ball/BattedWorldFieldMotion';
import { acquisitionInput, withContactAt } from '../ball/BattedWorldScheduledFieldAcquisition.test-support';
import { fixture, geometry } from '../ball/BattedWorldScheduledFieldThrow.test-support';
import { prepareBattedWorldScheduledFieldAcquisition, advanceBattedWorldScheduledFieldAcquisition } from '../ball/BattedWorldScheduledFieldAcquisition';
import { deriveScheduledFieldAcquisitionLiveWork } from './ScheduledFieldAcquisitionLiveWork';
import { createLivePlayRegistry, resolveLivePlayRegistry, upsertLivePlaySource } from './LivePlayRegistry';
import { resolveEventQueueWatermark } from './EventQueueWatermark';

const scope = { physicalPitchSourceId: 'pitch', planSourceId: 'plan', executionSourceId: 'advance', revision: 1 };
const prepare = (input = fixture()) => prepareBattedWorldScheduledFieldAcquisition({ response: input.response,
  geometry: input.geometry, field: deriveInitialBattedWorldFieldMotion(input) });
const secured = (plan = prepare(fixture(0, 0.0625 / 0.0625001))) => {
  const progress = advanceBattedWorldScheduledFieldAcquisition({ plan, previous: null, throughElapsedSeconds: 3 });
  if (progress.kind !== 'secured') throw new Error('secured fixture');
  return { plan, progress };
};

it('keeps admission as reception and possession work without future coverage or receipt', () => {
  const plan = prepare(), result = deriveScheduledFieldAcquisitionLiveWork({ ...scope, plan, progress: null });
  expect(result.phase).toBe('pending'); expect(result.dueTick).toBe(62_500);
  expect(result.source.queue).toEqual({ sourceId: result.source.sourceId, settledThroughTick: -1, nextPendingTick: 62_500 });
  expect(result.source.physical).toMatchObject([
    { kind: 'reception', actorId: 'carrier', throughTick: 62_500 },
    { kind: 'possession_transition', actorId: 'carrier', throughTick: 62_500 },
  ]);
  expect(result.source).not.toHaveProperty('completion'); expect(result.receipts).toEqual([]); expect(result.handoffs).toEqual([]);
  for (const key of ['field', 'cursor', 'acquisition', 'confirmationMoment']) expect(result).not.toHaveProperty(key);
});

it('advances queue coverage only behind actually executed partial capture', () => {
  const plan = prepare(), progress = advanceBattedWorldScheduledFieldAcquisition({ plan, previous: null, throughElapsedSeconds: 0.03 });
  const result = deriveScheduledFieldAcquisitionLiveWork({ ...scope, revision: 2, plan, progress });
  expect(result.phase).toBe('capturing'); expect(result.source.queue?.settledThroughTick).toBe(29_999);
  expect(result.source.queue?.nextPendingTick).toBe(plan.candidateSecureTick); expect(result.source.physical).toHaveLength(2);
  expect(result.receipts).toEqual([]); expect(result.handoffs).toEqual([]); expect(result.source).not.toHaveProperty('completion');
});

it('does not settle the recorded secure tick while zero-energy confirmation is pending', () => {
  const plan = prepare(fixture(0, 0.0625 / 0.0625001));
  const progress = advanceBattedWorldScheduledFieldAcquisition({ plan, previous: null, throughElapsedSeconds: 0.0625003 });
  expect(progress.kind).toBe('fence_pending'); expect(progress.transport.remainingEnergyJ).toBe(0);
  const result = deriveScheduledFieldAcquisitionLiveWork({ ...scope, plan, progress });
  expect(result.phase).toBe('fence_pending'); expect(result.dueTick).toBe(62_501);
  expect(result.source.queue).toEqual({ sourceId: result.source.sourceId, settledThroughTick: 62_500, nextPendingTick: 62_501 });
  expect(result.source.physical).toMatchObject([{ kind: 'reception' }, { kind: 'possession_transition' }]);
  expect(result.source).not.toHaveProperty('completion'); expect(result.receipts).toEqual([]); expect(result.handoffs).toEqual([]);
});

it('completes only this capture owner with exact secure evidence and the actual later confirmation moment', () => {
  const { plan, progress } = secured(), result = deriveScheduledFieldAcquisitionLiveWork({ ...scope, plan, progress });
  expect(result.phase).toBe('secured'); expect(result.source.physical).toEqual([]); expect(result.receipts).toHaveLength(1);
  const receipt = result.receipts[0];
  expect(receipt).toMatchObject({ ...scope, kind: 'acquisition_confirmed', status: 'consumed', sourceId: result.source.sourceId,
    generatedAtTick: 62_501, adoptedAtTick: 62_501, confirmationMoment: progress.world.moment,
    acquisition: progress.acquisition, cursor: progress.cursor });
  expect(receipt.kind).toBe('acquisition_confirmed'); if (receipt.kind !== 'acquisition_confirmed') throw new Error('confirmed fixture');
  expect(receipt.acquisition.moment.elapsedSeconds).toBe(0.0625001);
  expect(receipt.confirmationMoment.elapsedSeconds).toBe(0.062501);
  expect(receipt.cursor.moment).toEqual(receipt.confirmationMoment);
  expect(result.source.completion).toEqual({ completedAtTick: 62_501, basisEventId: receipt.eventId });
  expect(result.source.queue).toEqual({ sourceId: result.source.sourceId, settledThroughTick: 62_501, nextPendingTick: null });
  expect(result.handoffs.map((handoff) => handoff.kind)).toEqual(['custody', 'rule_evidence']);
  for (const handoff of result.handoffs) {
    expect(handoff.fromSourceId).toBe(result.source.sourceId); expect(handoff.basisEventId).toBe(receipt.eventId);
    expect(handoff.toSourceId).toBe(handoff.source.sourceId); expect(handoff.source.revision).toBe(1);
    expect(handoff.source).not.toHaveProperty('completion'); expect(handoff.source.ruleWindows).toEqual([]);
  }
  const custody = result.handoffs[0];
  expect(custody).toMatchObject({ kind: 'custody', cursor: progress.cursor,
    source: { physical: [{ kind: 'ball_motion', actorId: 'carrier', throughTick: plan.coverageThroughTick }],
      queue: { settledThroughTick: 62_500, nextPendingTick: null } } });
  const rule = result.handoffs[1];
  expect(rule).toMatchObject({ kind: 'rule_evidence', status: 'pending', acquisition: progress.acquisition,
    source: { physical: [], queue: { settledThroughTick: 62_500, nextPendingTick: 62_501 } } });
  expect(rule).not.toHaveProperty('consumedAtTick'); expect(rule).not.toHaveProperty('rule');
});

it.each([
  { name: 'before secure', input: () => fixture(0, 0.03125), reason: 'contact', elapsed: 1.625, energy: 0.01171875 },
  { name: 'at secure', input: () => ({ ...fixture(), geometry: geometry(1.4375) }), reason: 'contact', elapsed: 0.0625, energy: 0 },
  { name: 'inside fence', input: () => ({ ...fixture(0, 0.0625 / 0.0625001), geometry: geometry(1.375 + 0.06250025) }),
    reason: 'same_tick_competition', elapsed: 0.06250025, energy: 0 },
])('leaves actual $name contact work open and preserves interruption provenance', ({ input, reason, elapsed, energy }) => {
  const plan = prepare(input()), progress = advanceBattedWorldScheduledFieldAcquisition({ plan, previous: null, throughElapsedSeconds: 3 });
  expect(progress.kind).toBe('interrupted'); if (progress.kind !== 'interrupted') throw new Error('interrupted fixture');
  const result = deriveScheduledFieldAcquisitionLiveWork({ ...scope, plan, progress }), tick = progress.world.moment.ball.tick;
  expect(result.phase).toBe('interrupted'); expect(result.handoffs).toEqual([]); expect(result.source).not.toHaveProperty('completion');
  expect(result.receipts).toMatchObject([{ kind: 'acquisition_interrupted', status: 'consumed', generatedAtTick: tick, adoptedAtTick: tick,
    acquisition: progress.acquisition }]);
  expect(result.receipts[0]).not.toHaveProperty('cursor'); expect(result.receipts[0]).not.toHaveProperty('confirmationMoment');
  expect(progress.acquisition.reason).toBe(reason); expect(progress.world.moment.elapsedSeconds).toBeCloseTo(elapsed, 14);
  expect(progress.transport.remainingEnergyJ).toBe(energy);
  expect(progress.acquisition.baseContacts).toMatchObject([{ kind: 'base', baseId: 'first' }]);
  expect(progress.acquisition.world.contacts).toContainEqual(expect.objectContaining({ kind: 'actor', playerId: 'carrier', continuing: true }));
  expect(result.source.physical).toMatchObject([{ kind: 'possession_transition', actorId: 'carrier', throughTick: tick }]);
  expect(result.source.queue).toEqual({ sourceId: result.source.sourceId, settledThroughTick: tick - 1, nextPendingTick: null });
});

it.each([0, 2 ** 52])('preserves the exact original clock and current confirmation at origin %s', (originTick) => {
  const { plan, progress } = secured(prepare(fixture(originTick, 0.0625 / 0.0625001)));
  const result = deriveScheduledFieldAcquisitionLiveWork({ ...scope, plan, progress });
  expect(result.dueTick).toBe(originTick + 62_501); expect(result.receipts[0].generatedAtTick).toBe(result.dueTick);
  const receipt = result.receipts[0]; if (receipt.kind !== 'acquisition_confirmed') throw new Error('confirmed fixture');
  expect(receipt.confirmationMoment.originTick).toBe(originTick); expect(receipt.acquisition.moment.elapsedSeconds).toBe(0.0625001);
  expect(receipt.cursor.moment.elapsedSeconds).toBe(0.062501);
});

it('retains collision-safe source and event identity across serialization and revision changes', () => {
  const { plan, progress } = secured(), input = { ...scope, plan, progress }, first = deriveScheduledFieldAcquisitionLiveWork(input);
  expect(deriveScheduledFieldAcquisitionLiveWork(JSON.parse(JSON.stringify(input)))).toEqual(first);
  const revised = deriveScheduledFieldAcquisitionLiveWork({ ...input, revision: 9 });
  expect(revised.source.sourceId).toBe(first.source.sourceId); expect(revised.source.revision).toBe(9);
  expect(revised.receipts[0].eventId).toBe(first.receipts[0].eventId);
  expect(revised.handoffs.map((handoff) => handoff.toSourceId)).toEqual(first.handoffs.map((handoff) => handoff.toSourceId));
  const a = deriveScheduledFieldAcquisitionLiveWork({ ...input, physicalPitchSourceId: 'a:b', planSourceId: 'c' });
  const b = deriveScheduledFieldAcquisitionLiveWork({ ...input, physicalPitchSourceId: 'a', planSourceId: 'b:c' });
  expect(a.source.sourceId).not.toBe(b.source.sourceId);
  const other = deriveScheduledFieldAcquisitionLiveWork({ ...input, executionSourceId: 'other-execution' });
  expect(other.source.sourceId).toBe(first.source.sourceId); expect(other.receipts[0].eventId).not.toBe(first.receipts[0].eventId);
  expect(other.handoffs.map((handoff) => handoff.toSourceId)).not.toEqual(first.handoffs.map((handoff) => handoff.toSourceId));
  expect(JSON.parse(first.source.sourceId)).toEqual(['scheduled-field-acquisition', 'pitch', 'plan']);
});

it.each(['terminal', 'completion', 'watermark', 'queue', 'receipts', 'handoffs', 'playEnd', 'actors', 'policy', 'acquisition'])('rejects caller %s authority', (field) => {
  expect(() => deriveScheduledFieldAcquisitionLiveWork({ ...scope, plan: prepare(), progress: null, [field]: true })).toThrow(/scope/);
});

it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid revision %s', (revision) => {
  expect(() => deriveScheduledFieldAcquisitionLiveWork({ ...scope, revision, plan: prepare(), progress: null })).toThrow(/revision/);
});

it.each(['physicalPitchSourceId', 'planSourceId', 'executionSourceId'] as const)('rejects invalid %s', (key) => {
  expect(() => deriveScheduledFieldAcquisitionLiveWork({ ...scope, [key]: ' ', plan: prepare(), progress: null })).toThrow(/scope/);
});

it('rederives the plan and actual progress instead of trusting forged evidence or history', () => {
  const { plan, progress } = secured();
  const derive = (changed: object) => deriveScheduledFieldAcquisitionLiveWork({ ...scope, plan, progress, ...changed });
  expect(() => derive({ plan: { ...plan, secureElapsedSeconds: 0.1 } })).toThrow();
  expect(() => derive({ progress: { ...progress, checkpointElapsedSeconds: [0.01] } })).toThrow();
  expect(() => derive({ progress: { ...progress, kind: 'interrupted' } })).toThrow();
  expect(() => derive({ progress: { ...progress, receipts: [] } })).toThrow();
  expect(() => derive({ progress: { ...progress, acquisition: { ...progress.acquisition,
    moment: { ...progress.acquisition.moment, elapsedSeconds: 0.01 } } } })).toThrow();
  expect(() => derive({ progress: { ...progress, cursor: { ...progress.cursor,
    moment: progress.acquisition.moment } } })).toThrow();
});

it('rejects active and nonfinite input while returning independent deeply frozen inert data', () => {
  const { plan, progress } = secured();
  let read = false;
  const active = Object.defineProperty({ ...scope, plan, progress }, 'revision', { enumerable: true, get() { read = true; return 1; } });
  expect(() => deriveScheduledFieldAcquisitionLiveWork(active)).toThrow(); expect(read).toBe(false);
  expect(() => deriveScheduledFieldAcquisitionLiveWork({ ...scope, plan, progress: { ...progress,
    transport: { ...progress.transport, remainingEnergyJ: Number.NaN } } })).toThrow();
  const result = deriveScheduledFieldAcquisitionLiveWork({ ...scope, plan, progress });
  expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  expect(Object.isFrozen(result)).toBe(true); expect(Object.isFrozen(result.receipts[0])).toBe(true);
  expect(Object.isFrozen(result.handoffs[0].source.physical)).toBe(true); expect(Object.isFrozen(result.handoffs[1].source.queue)).toBe(true);
  const receipt = result.receipts[0]; if (receipt.kind !== 'acquisition_confirmed') throw new Error('confirmed fixture');
  expect(receipt.acquisition).not.toBe(progress.acquisition); expect(receipt.cursor).not.toBe(progress.cursor);
});

it('fits existing source and queue APIs while leaving ball and rule consumers unresolved', () => {
  const { plan, progress } = secured();
  const pending = deriveScheduledFieldAcquisitionLiveWork({ ...scope, plan, progress: null });
  const result = deriveScheduledFieldAcquisitionLiveWork({ ...scope, revision: 2, plan, progress });
  let registry = createLivePlayRegistry({ playId: 1, revision: 0, sources: [pending.source] });
  registry = upsertLivePlaySource(registry, registry.revision, result.source);
  for (const handoff of result.handoffs) registry = upsertLivePlaySource(registry, registry.revision, handoff.source);
  const resolution = resolveLivePlayRegistry(registry, { tick: result.dueTick, terminal: 'none', actors: [] });
  expect(resolution.resolution.kind).toBe('continues'); expect(resolution.frontier.physical).toMatchObject([{ kind: 'ball_motion' }]);
  expect(resolution.frontier.ruleWindows).toEqual([]); expect(resolution.frontier.actors).toEqual([]);
  if (resolution.resolution.kind !== 'continues') throw new Error('open successor fixture');
  expect(resolution.resolution.blockers).toContainEqual({ kind: 'pending_source', sourceId: result.handoffs[1].toSourceId });
  expect(resolveEventQueueWatermark(result.dueTick, [result.source.queue!, ...result.handoffs.map((handoff) => handoff.source.queue!)])
    .settledThroughTick).toBe(result.dueTick - 1);
  const terminal = resolveLivePlayRegistry(registry, { tick: result.dueTick, terminal: 'all_offense_terminal', actors: [] });
  expect(terminal.resolution.kind).toBe('continues');
  for (const key of ['registry', 'frontier', 'resolution', 'actors', 'terminal', 'playEnd', 'officialClosure']) expect(result).not.toHaveProperty(key);
});

it.each([0, 0.0000001])('executes zero-load confirmation only after its real fence at contact %s', (elapsedSeconds) => {
  const plan = prepareBattedWorldScheduledFieldAcquisition(withContactAt(acquisitionInput(), elapsedSeconds, true));
  const progress = advanceBattedWorldScheduledFieldAcquisition({ plan, previous: null, throughElapsedSeconds: elapsedSeconds });
  const first = deriveScheduledFieldAcquisitionLiveWork({ ...scope, plan, progress });
  if (elapsedSeconds === 0) {
    expect(first.phase).toBe('secured'); expect(first.receipts[0].generatedAtTick).toBe(0);
    expect(first.source.completion?.completedAtTick).toBe(0);
    expect(first.handoffs.map((handoff) => handoff.source.queue?.settledThroughTick)).toEqual([-1, -1]);
  } else {
    expect(first.phase).toBe('fence_pending'); expect(first.source.queue?.settledThroughTick).toBe(0);
    expect(first.receipts).toEqual([]); expect(first.handoffs).toEqual([]);
    const finished = advanceBattedWorldScheduledFieldAcquisition({ plan, previous: progress, throughElapsedSeconds: plan.fenceElapsedSeconds });
    const final = deriveScheduledFieldAcquisitionLiveWork({ ...scope, executionSourceId: 'confirmation', revision: 2, plan, progress: finished });
    expect(final.phase).toBe('secured'); expect(final.receipts[0].generatedAtTick).toBe(1);
    const receipt = final.receipts[0]; if (receipt.kind !== 'acquisition_confirmed') throw new Error('confirmed fixture');
    expect(receipt.acquisition.moment.elapsedSeconds).toBe(elapsedSeconds);
    expect(receipt.confirmationMoment.elapsedSeconds).toBe(0.000001);
  }
});
