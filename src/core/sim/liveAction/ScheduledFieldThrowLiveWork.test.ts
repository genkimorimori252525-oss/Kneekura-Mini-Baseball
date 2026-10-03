import { expect, it } from 'vitest';
import { prepareBattedWorldScheduledFieldThrow, advanceBattedWorldScheduledFieldThrow } from '../ball/BattedWorldScheduledFieldThrow';
import { fixture, throwInput, v } from '../ball/BattedWorldScheduledFieldThrow.test-support';
import { deriveScheduledFieldThrowLiveWork } from './ScheduledFieldThrowLiveWork';
import { createLivePlayRegistry, resolveLivePlayRegistry, upsertLivePlaySource } from './LivePlayRegistry';
import { resolveEventQueueWatermark } from './EventQueueWatermark';

const scope = { physicalPitchSourceId: 'pitch', planSourceId: 'plan', executionSourceId: 'advance', revision: 1 };
const prepare = () => prepareBattedWorldScheduledFieldThrow(throwInput());
const released = (plan = prepare()) => {
  const progress = advanceBattedWorldScheduledFieldThrow({ plan, previous: null, throughElapsedSeconds: 3 });
  if (progress.kind !== 'released') throw new Error('released fixture');
  return { plan, progress };
};

it('projects admission as pending transfer work without claiming future event coverage', () => {
  const plan = prepare(), result = deriveScheduledFieldThrowLiveWork({ ...scope, plan, progress: null });
  expect(result.phase).toBe('pending'); expect(result.dueTick).toBe(162_500);
  expect(result.source.queue).toEqual({ sourceId: result.source.sourceId, settledThroughTick: 62_499, nextPendingTick: 162_500 });
  expect(result.source.physical).toMatchObject([
    { kind: 'throw', actorId: 'carrier', throughTick: 162_500 },
    { kind: 'possession_transition', actorId: 'carrier', throughTick: 162_500 },
  ]);
  expect(result.source).not.toHaveProperty('completion'); expect(result.receipts).toEqual([]); expect(result.handoff).toBeNull();
  expect(result).not.toHaveProperty('field'); expect(result).not.toHaveProperty('cursor');
});

it('advances generation coverage only behind actual carried physical progress', () => {
  const plan = prepare(), progress = advanceBattedWorldScheduledFieldThrow({ plan, previous: null, throughElapsedSeconds: 0.1 });
  const result = deriveScheduledFieldThrowLiveWork({ ...scope, revision: 2, plan, progress });
  expect(result.phase).toBe('transfer'); expect(result.source.queue?.settledThroughTick).toBe(99_999);
  expect(result.source.queue?.nextPendingTick).toBe(162_500); expect(result.source.physical).toHaveLength(2);
  expect(result.source.queue!.settledThroughTick).toBeLessThan(progress.field.motion.world.moment.ball.tick);
  expect(result.source.queue!.settledThroughTick).toBeLessThan(result.dueTick - 1);
  expect(result.receipts).toEqual([]); expect(result.handoff).toBeNull();
});

it('consumes the actual release only with an explicit active ball-work handoff', () => {
  const { plan, progress } = released(), result = deriveScheduledFieldThrowLiveWork({ ...scope, plan, progress });
  expect(result.phase).toBe('released'); expect(result.source.physical).toEqual([]);
  expect(result.receipts).toHaveLength(1);
  const receipt = result.receipts[0];
  expect(receipt).toMatchObject({ ...scope, kind: 'throw_released', status: 'consumed', generatedAtTick: 162_500, adoptedAtTick: 162_500,
    sourceId: result.source.sourceId, cursor: progress.releaseCursor });
  expect(result.source.completion).toEqual({ completedAtTick: 162_500, basisEventId: receipt.eventId });
  expect(result.source.queue).toEqual({ sourceId: result.source.sourceId, settledThroughTick: 162_500, nextPendingTick: null });
  expect(result.handoff).toMatchObject({ fromSourceId: result.source.sourceId, basisEventId: receipt.eventId, cursor: progress.releaseCursor,
    source: { revision: 1, physical: [{ kind: 'ball_motion', throughTick: plan.input.throughTick }] } });
  expect(result.handoff!.toSourceId).toBe(result.handoff!.source.sourceId);
  expect(result.handoff!.source).not.toHaveProperty('completion');
  expect(result.handoff!.source.queue).toEqual({ sourceId: result.handoff!.source.sourceId, settledThroughTick: 162_499, nextPendingTick: null });
});

it('hands off an actual same-instant post-release collision instead of reviving the release cursor', () => {
  const raw = throwInput(fixture(0, 1, 0.125)), input = { ...raw, actors: raw.actors.map((actor) => actor.playerId !== 'receiver' ? actor
    : { ...actor, primitive: { ...actor.primitive, startCenter: v(-10, 0, 0) } }) };
  const plan = prepareBattedWorldScheduledFieldThrow(input);
  const progress = advanceBattedWorldScheduledFieldThrow({ plan, previous: null, throughElapsedSeconds: 1 });
  expect(progress.kind).toBe('released'); if (progress.kind !== 'released') throw new Error('release fixture');
  expect(progress.field.motion.response).toMatchObject({ kind: 'unresolved', reason: 'simultaneous', cursor: null });
  expect(progress.field.motion.world.moment.elapsedSeconds).toBe(progress.releaseCursor.moment.elapsedSeconds);
  const result = deriveScheduledFieldThrowLiveWork({ ...scope, plan, progress });
  expect(result.receipts[0]).toMatchObject({ kind: 'throw_released', cursor: progress.releaseCursor });
  expect(result.handoff?.cursor).toBeNull(); expect(result.handoff).toHaveProperty('field', progress.field);
  expect(result.handoff?.source.physical).toMatchObject([{ kind: 'possession_transition', throughTick: result.dueTick }]);
  expect(result.handoff?.source).not.toHaveProperty('completion');
  expect(result.handoff?.source.queue).toMatchObject({ settledThroughTick: result.dueTick - 1, nextPendingTick: null });
});

it.each([0, 2 ** 52])('records immediate zero-delay release and preserves unresolved same-tick ball work at origin %s', (originTick) => {
  const plan = prepareBattedWorldScheduledFieldThrow(throwInput(fixture(originTick), 0));
  const progress = advanceBattedWorldScheduledFieldThrow({ plan, previous: null, throughElapsedSeconds: plan.input.cursor.moment.elapsedSeconds });
  const result = deriveScheduledFieldThrowLiveWork({ ...scope, plan, progress });
  expect(result.phase).toBe('released'); expect(result.dueTick).toBe(originTick + 62_500);
  expect(result.receipts[0].generatedAtTick).toBe(result.dueTick);
  expect(result.handoff?.cursor?.moment.elapsedSeconds).toBe(plan.input.cursor.moment.elapsedSeconds);
  expect(result.handoff?.source.queue?.settledThroughTick).toBe(result.dueTick - 1);
});

it('keeps same-recorded-tick transfer distinct from release until the exact physical boundary', () => {
  const plan = prepareBattedWorldScheduledFieldThrow(throwInput(fixture(0, 0.0625 / 0.0625001), 0));
  const progress = advanceBattedWorldScheduledFieldThrow({ plan, previous: null, throughElapsedSeconds: 0.0625003 });
  const before = deriveScheduledFieldThrowLiveWork({ ...scope, plan, progress });
  expect(before.phase).toBe('transfer'); expect(before.source.queue?.settledThroughTick).toBe(62_500);
  expect(before.source.queue?.nextPendingTick).toBe(62_501); expect(before.receipts).toEqual([]);
  const final = advanceBattedWorldScheduledFieldThrow({ plan, previous: progress, throughElapsedSeconds: 0.062501 });
  const after = deriveScheduledFieldThrowLiveWork({ ...scope, executionSourceId: 'release-execution', revision: 2, plan, progress: final });
  expect(after.phase).toBe('released'); expect(after.receipts[0].executionSourceId).toBe('release-execution');
  expect(after.receipts[0].generatedAtTick).toBe(62_501);
  expect(after.handoff?.cursor?.moment.elapsedSeconds).toBe(0.062501);
});

it.each([2_000_000, 1_562_500])('adopts a carried collision without fabricating release or clearing physical work (delay %s)', (delay) => {
  const plan = prepareBattedWorldScheduledFieldThrow(throwInput(fixture(), delay));
  const progress = advanceBattedWorldScheduledFieldThrow({ plan, previous: null, throughElapsedSeconds: 3 });
  const result = deriveScheduledFieldThrowLiveWork({ ...scope, plan, progress });
  expect(result.phase).toBe('interrupted'); expect(result.handoff).toBeNull();
  expect(result.receipts).toMatchObject([{ kind: 'throw_interrupted', status: 'consumed', generatedAtTick: 1_625_000,
    adoptedAtTick: 1_625_000, field: progress.field }]);
  expect(result.receipts[0]).not.toHaveProperty('cursor');
  expect(result.source.physical).toMatchObject([{ kind: 'possession_transition', actorId: 'carrier', throughTick: 1_625_000 }]);
  expect(result.source).not.toHaveProperty('completion');
  expect(result.source.queue).toEqual({ sourceId: result.source.sourceId, settledThroughTick: 1_624_999, nextPendingTick: null });
});

it('uses deterministic collision-safe identities and caller revision only as a version', () => {
  const { plan, progress } = released(), input = { ...scope, plan, progress };
  const first = deriveScheduledFieldThrowLiveWork(input);
  expect(deriveScheduledFieldThrowLiveWork(JSON.parse(JSON.stringify(input)))).toEqual(first);
  const revised = deriveScheduledFieldThrowLiveWork({ ...input, revision: 9 });
  expect(revised.source.sourceId).toBe(first.source.sourceId);
  expect(revised.source.physical).toEqual(first.source.physical); expect(revised.source.revision).toBe(9);
  expect(revised.receipts[0].eventId).toBe(first.receipts[0].eventId);
  expect(revised.handoff?.source.sourceId).toBe(first.handoff?.source.sourceId);
  const colonA = deriveScheduledFieldThrowLiveWork({ ...input, physicalPitchSourceId: 'a:b', planSourceId: 'c' });
  const colonB = deriveScheduledFieldThrowLiveWork({ ...input, physicalPitchSourceId: 'a', planSourceId: 'b:c' });
  expect(colonA.source.sourceId).not.toBe(colonB.source.sourceId);
  const otherExecution = deriveScheduledFieldThrowLiveWork({ ...input, executionSourceId: 'other-execution' });
  expect(otherExecution.source.sourceId).toBe(first.source.sourceId);
  expect(otherExecution.receipts[0].eventId).not.toBe(first.receipts[0].eventId);
  expect(JSON.parse(first.source.sourceId)).toEqual(['scheduled-field-throw', 'pitch', 'plan']);
});

it.each(['terminal', 'completion', 'watermark', 'queue', 'receipts', 'handoff', 'playEnd', 'actors'])('rejects caller-supplied %s authority', (field) => {
  const input = { ...scope, plan: prepare(), progress: null, [field]: true };
  expect(() => deriveScheduledFieldThrowLiveWork(input)).toThrow(/scope/);
});

it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid source revision %s', (revision) => {
  expect(() => deriveScheduledFieldThrowLiveWork({ ...scope, revision, plan: prepare(), progress: null })).toThrow(/revision/);
});

it.each(['physicalPitchSourceId', 'planSourceId', 'executionSourceId'] as const)('rejects invalid %s', (key) => {
  expect(() => deriveScheduledFieldThrowLiveWork({ ...scope, [key]: ' ', plan: prepare(), progress: null })).toThrow(/scope/);
});

it('validates serialized plan/progress instead of accepting injected lifecycle evidence', () => {
  const { plan, progress } = released();
  expect(() => deriveScheduledFieldThrowLiveWork({ ...scope, plan: { ...plan, releaseElapsedSeconds: 0.1 }, progress })).toThrow();
  expect(() => deriveScheduledFieldThrowLiveWork({ ...scope, plan, progress: { ...progress,
    releaseCursor: { ...progress.releaseCursor, moment: { ...progress.releaseCursor.moment, elapsedSeconds: 0.15 } } } })).toThrow();
  expect(() => deriveScheduledFieldThrowLiveWork({ ...scope, plan, progress: { ...progress, checkpointElapsedSeconds: [0.1] } })).toThrow();
  expect(() => deriveScheduledFieldThrowLiveWork({ ...scope, plan, progress: { ...progress, receipts: [] } as typeof progress })).toThrow();
  expect(() => deriveScheduledFieldThrowLiveWork({ ...scope, plan, progress: { ...progress, kind: 'interrupted' } as never })).toThrow();
  let read = false;
  const malicious = Object.defineProperty({ ...scope, plan, progress }, 'revision', { enumerable: true, get() { read = true; return 1; } });
  expect(() => deriveScheduledFieldThrowLiveWork(malicious)).toThrow(); expect(read).toBe(false);
});

it('fits existing queue and source APIs while retaining a blocker after release', () => {
  const { plan, progress } = released();
  const pending = deriveScheduledFieldThrowLiveWork({ ...scope, plan, progress: null });
  const result = deriveScheduledFieldThrowLiveWork({ ...scope, revision: 2, plan, progress });
  let registry = createLivePlayRegistry({ playId: 1, revision: 0, sources: [pending.source] });
  registry = upsertLivePlaySource(registry, 0, result.source);
  registry = upsertLivePlaySource(registry, 1, result.handoff!.source);
  const resolution = resolveLivePlayRegistry(registry, { tick: result.dueTick, terminal: 'none', actors: [] });
  expect(resolution.resolution.kind).toBe('continues');
  expect(resolution.frontier.physical).toMatchObject([{ kind: 'ball_motion' }]);
  expect(resolveEventQueueWatermark(result.dueTick, [result.source.queue!, result.handoff!.source.queue!]).settledThroughTick).toBe(result.dueTick - 1);
  for (const key of ['registry', 'frontier', 'resolution', 'actors', 'terminal', 'playEnd']) expect(result).not.toHaveProperty(key);
  expect(Object.isFrozen(result)).toBe(true); expect(Object.isFrozen(result.receipts[0])).toBe(true);
  expect(Object.isFrozen(result.handoff!.source.physical)).toBe(true);
});
