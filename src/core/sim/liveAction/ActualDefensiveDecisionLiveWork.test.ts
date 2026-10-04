import { expect, it } from 'vitest';
import { deriveActualDefensiveDecisionLiveWork, type ActualDefensiveDecisionLiveWorkInput } from './ActualDefensiveDecisionLiveWork';

const at = (elapsedSeconds: number, tick = 100 + Math.ceil(elapsedSeconds * 100)) => ({ originTick: 100, elapsedSeconds, tick });
const fixture = (): ActualDefensiveDecisionLiveWorkInput => ({
  physicalPitchSourceId: 'pitch', playerId: 'player', originDecisionSourceId: 'decision-1', decisionSourceId: 'decision-1', revision: 1,
  originObservationSourceId: 'observation-1', ticksPerSecond: 100, availableAt: at(0.0100002),
  cut: { observationSourceId: 'observation-1', baseFieldSourceId: 'field', executionSourceId: null, at: at(0.0100002) },
  scheduling: { startedAtTick: 102, decisionDelayTicks: 3, decisionTick: 105, firstStepDelayTicks: 5, movementStartTick: 110 },
  lifecycle: { status: 'pending_decision', issuedAt: null, issuedBySourceId: null }, intentKind: 'ball_handler',
  evidence: { captureAt: at(0.01), confidence: 0.8 },
});
const progressed = (elapsedSeconds: number): ActualDefensiveDecisionLiveWorkInput => ({ ...fixture(), decisionSourceId: 'decision-2', revision: 2,
  cut: { ...fixture().cut, observationSourceId: 'observation-2', executionSourceId: 'execution-2', at: at(elapsedSeconds) },
  lifecycle: elapsedSeconds >= 0.1 ? { status: 'issued', issuedAt: at(elapsedSeconds), issuedBySourceId: 'decision-2' }
    : { status: 'pending_first_step', issuedAt: null, issuedBySourceId: null },
});

it('projects exact owned decision deadline, cut and original evidence without inventing information or physical work', () => {
  const input = fixture(), value = deriveActualDefensiveDecisionLiveWork(input);
  expect(value.phase).toBe('pending_decision'); expect(value.cut).toEqual(input.cut);
  expect(value.evidence).toEqual(input.evidence); expect(value.availableAt).toEqual(input.availableAt);
  expect(value.deadlines).toEqual({ decision: at(0.05), firstStep: at(0.1) });
  expect(value.source.decisions).toMatchObject([{ kind: 'actor_decision', actorId: 'player', dueTick: 105 }]);
  expect(value.source.intents).toEqual([]); expect(value.source.physical).toEqual([]); expect(value.source.information).toEqual([]);
  expect(value.source.queue).toBeNull(); expect(value.source).not.toHaveProperty('completion');
  expect(value.receipts).toEqual([]); expect(value.handoff).toBeNull();
});

it('keeps first-step work pending until exact original deadline despite recorded-tick equality', () => {
  const input = progressed(0.099999999999), value = deriveActualDefensiveDecisionLiveWork(input);
  expect(input.cut.at.tick).toBe(110); expect(value.phase).toBe('pending_first_step');
  expect(value.source.decisions).toEqual([]);
  expect(value.source.intents).toMatchObject([{ kind: 'issued_intent', actorId: 'player', dueTick: 110 }]);
  expect(value.deadlines.firstStep.elapsedSeconds).toBe(0.1); expect(value.receipts).toEqual([]); expect(value.handoff).toBeNull();
});

it.each([0.1, 0.4])('issuance at %s hands off still-pending motor/adoption at original due time, never physical consumption', elapsed => {
  const value = deriveActualDefensiveDecisionLiveWork(progressed(elapsed));
  expect(value.phase).toBe('issued'); expect(value.source.intents).toEqual([]);
  expect(value.receipts).toMatchObject([{ kind: 'intent_issued', status: 'issued', issuedAt: at(elapsed), decisionSourceId: 'decision-2' }]);
  expect(value.source.completion).toEqual({ completedAtTick: at(elapsed).tick, basisEventId: value.receipts[0].eventId });
  expect(value.source.queue).toBeNull();
  expect(value.handoff).toMatchObject({ kind: 'motor_adoption', status: 'pending', due: at(0.1), availableAt: at(elapsed),
    basisEventId: value.receipts[0].eventId, source: { physical: [], information: [], decisions: [], queue: null,
      intents: [{ kind: 'issued_intent', actorId: 'player', dueTick: 110 }] } });
  expect(value.handoff!.source).not.toHaveProperty('completion');
  for (const key of ['actors', 'watermark', 'frontier', 'playEnd', 'settled', 'motorReceipt', 'executedThrough']) expect(value).not.toHaveProperty(key);
});

it('keeps source/work/action identities stable across revisions and separates pitch/Player/origin/source namespaces', () => {
  const first = deriveActualDefensiveDecisionLiveWork(fixture()), middle = deriveActualDefensiveDecisionLiveWork(progressed(0.05));
  const last = deriveActualDefensiveDecisionLiveWork(progressed(0.1));
  expect(first.source.sourceId).toBe(middle.source.sourceId); expect(last.source.sourceId).toBe(first.source.sourceId);
  expect(JSON.parse(first.source.sourceId)).toEqual(['actual-defensive-decision', 'pitch', 'player', 'decision-1']);
  expect(last.handoff!.source.intents[0].workId).toBe(middle.source.intents[0].workId);
  expect(last.handoff!.source.intents[0].actionKey).toBe(middle.source.intents[0].actionKey);
  const other = deriveActualDefensiveDecisionLiveWork({ ...progressed(0.1), decisionSourceId: 'decision-3', revision: 3,
    lifecycle: { status: 'issued', issuedAt: at(0.1), issuedBySourceId: 'decision-3' } });
  expect(other.receipts[0].eventId).not.toBe(last.receipts[0].eventId);
  expect(deriveActualDefensiveDecisionLiveWork({ ...fixture(), physicalPitchSourceId: 'pitch:player', playerId: 'x' }).source.sourceId)
    .not.toBe(deriveActualDefensiveDecisionLiveWork({ ...fixture(), physicalPitchSourceId: 'pitch', playerId: 'player:x' }).source.sourceId);
});

it('retains hold intent as pending work and deeply freezes detached retry output', () => {
  const input = { ...progressed(0.1), intentKind: 'hold' as const, evidence: null }, value = deriveActualDefensiveDecisionLiveWork(input);
  expect(value.handoff!.source.intents).toHaveLength(1); expect(value.intentKind).toBe('hold');
  expect(Object.isFrozen(value.cut.at)).toBe(true); expect(Object.isFrozen(value.handoff!.source.intents)).toBe(true);
  expect(deriveActualDefensiveDecisionLiveWork(JSON.parse(JSON.stringify(input)))).toEqual(value);
  expect(value.cut).not.toBe(input.cut);
});

it('rejects active, unknown, invalid, contradictory and overflowing inputs before projection', () => {
  const input = fixture(); let called = false;
  const active = Object.defineProperty({ ...input }, 'revision', { enumerable: true, get() { called = true; return 1; } });
  expect(() => deriveActualDefensiveDecisionLiveWork(active)).toThrow(); expect(called).toBe(false);
  const cases = [
    { ...input, currentTick: 900 }, { ...input, revision: 0 }, { ...input, revision: Number.MAX_SAFE_INTEGER + 1 },
    { ...input, playerId: ' ' }, { ...input, ticksPerSecond: 0 }, { ...input, ticksPerSecond: Infinity },
    { ...input, cut: { ...input.cut, future: true } }, { ...input, evidence: { ...input.evidence!, captureAt: at(0.2) } },
    { ...input, evidence: { ...input.evidence!, confidence: 1.1 } }, { ...input, intentKind: 'throw' },
    { ...input, availableAt: { ...input.availableAt, tick: 101 } },
    { ...input, scheduling: { ...input.scheduling, startedAtTick: 101 } },
    { ...input, scheduling: { ...input.scheduling, decisionTick: 104 } },
    { ...input, scheduling: { ...input.scheduling, decisionDelayTicks: Number.MAX_SAFE_INTEGER } },
    { ...input, lifecycle: { status: 'issued', issuedAt: input.cut.at, issuedBySourceId: input.decisionSourceId } },
    { ...progressed(0.1), lifecycle: { status: 'pending_first_step', issuedAt: null, issuedBySourceId: null } },
    { ...progressed(0.1), lifecycle: { status: 'issued', issuedAt: at(0.05), issuedBySourceId: 'decision-2' } },
    { ...input, cut: { ...input.cut, at: at(0) } },
  ];
  for (const value of cases) expect(() => deriveActualDefensiveDecisionLiveWork(value as ActualDefensiveDecisionLiveWorkInput)).toThrow();
});

it.each([0, Number.MAX_SAFE_INTEGER - 7])('preserves zero-delay exact eligibility at large clock origin %s', originTick => {
  const instant = { originTick, elapsedSeconds: 0.07, tick: originTick + 7 };
  const input: ActualDefensiveDecisionLiveWorkInput = { ...fixture(), ticksPerSecond: 100, availableAt: instant,
    cut: { ...fixture().cut, at: instant }, intentKind: 'hold', evidence: null,
    scheduling: { startedAtTick: instant.tick, decisionDelayTicks: 0, decisionTick: instant.tick, firstStepDelayTicks: 0, movementStartTick: instant.tick },
    lifecycle: { status: 'issued', issuedAt: instant, issuedBySourceId: 'decision-1' } };
  const value = deriveActualDefensiveDecisionLiveWork(input);
  expect(value.phase).toBe('issued'); expect(value.deadlines.firstStep).toEqual(instant);
  expect(value.handoff!.source.intents[0].dueTick).toBe(instant.tick);
  expect(value.handoff!.source.queue).toBeNull();
});

it('rejects nested active fields, symbol/unknown aliases, malformed timing and unsafe deadline arithmetic', () => {
  const input = fixture(); let called = false;
  const active = Object.defineProperty({ ...input.cut.at }, 'elapsedSeconds', { enumerable: true, get() { called = true; return 0; } });
  const cases = [
    { ...input, cut: { ...input.cut, at: active } }, { ...input, [Symbol('hidden')]: 1 },
    { ...input, scheduling: { ...input.scheduling, 'decisionDelayTicks|decisionTick': 3 } },
    { ...input, lifecycle: { ...input.lifecycle, adoptedAt: input.cut.at } },
    { ...input, evidence: { ...input.evidence!, confidence: NaN } },
    { ...input, evidence: { ...input.evidence!, captureAt: { ...input.evidence!.captureAt, originTick: 99 } } },
    { ...input, cut: { ...input.cut, at: { ...input.cut.at, elapsedSeconds: -1 } } },
    { ...input, scheduling: { ...input.scheduling, decisionDelayTicks: 0.5 } },
    { ...input, availableAt: { originTick: Number.MAX_SAFE_INTEGER, elapsedSeconds: 1, tick: Number.MAX_SAFE_INTEGER } },
  ];
  for (const value of cases) expect(() => deriveActualDefensiveDecisionLiveWork(value as ActualDefensiveDecisionLiveWorkInput)).toThrow();
  expect(called).toBe(false);
});
