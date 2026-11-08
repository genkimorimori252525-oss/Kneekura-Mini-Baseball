import { expect, it } from 'vitest';
import { resolveLiveManagerCommunicationV122 } from './LiveManagerCommunicationV122';

const input = () => ({ scope: { sessionId: 'session', matchId: 'match', senderId: 'manager', receiverId: 'batter' },
  clock: { originTick: 1000000, ticksPerSecond: 1000000 }, cutoff: { tick: 1100000, elapsedSeconds: .1 }, seed: 37,
  source: { sourceId: 'source', sourceVersion: 'v1', eventId: 'event', sessionId: 'session', matchId: 'match',
    senderId: 'manager', receiverId: 'batter', sourceTick: 1000000, sentAtElapsedSeconds: 0,
    conditions: { propagationDelayTicks: 20000, recognitionBaseDelayTicks: 30000, maxAdditionalRecognitionDelayTicks: 0,
      audibility: 1, recognition: 1, attention: 1, minimumRecognizableQuality: .5 },
    instruction: { authority: 'soft' as const, effort: .4, compactness: .8, acceptance: .2 } } });

it('delivers only received instructions, retaining soft acceptance independently of reception confidence', () => {
  const request = input(), before = JSON.stringify(request), r = resolveLiveManagerCommunicationV122(request);
  expect(r.status).toBe('RECEIVED');
  if (r.status !== 'RECEIVED') throw Error('expected delivery');
  expect(r.instruction).toEqual(request.source.instruction);
  expect(r.confidence).toBe(1); expect(r.instruction.acceptance).toBe(.2);
  expect(r.receivedAtTick).toBe(1050000); expect(r.nativeAdmission).toBe(false);
  expect(JSON.stringify(request)).toBe(before);
  expect(resolveLiveManagerCommunicationV122(request)).toEqual(r);
});

it('does not expose a command before exact reception, after nondetection or to another identity', () => {
  const i = input(), pending = resolveLiveManagerCommunicationV122({ ...i, cutoff: { tick: 1049999, elapsedSeconds: .049999 } });
  expect(pending.status).toBe('NOT_ARRIVED'); expect(pending).not.toHaveProperty('instruction');
  const dropped = resolveLiveManagerCommunicationV122({ ...i, source: { ...i.source, conditions: { ...i.source.conditions, attention: 0 } } });
  expect(dropped.status).toBe('NOT_RECOGNIZED'); expect(dropped).not.toHaveProperty('instruction');
  for (const scope of [{ ...i.scope, receiverId: 'other' }, { ...i.scope, senderId: 'other' },
    { ...i.scope, sessionId: 'other' }, { ...i.scope, matchId: 'other' }]) {
    const r = resolveLiveManagerCommunicationV122({ ...i, scope });
    expect(r.status).toBe('NOT_APPLICABLE'); expect(r).not.toHaveProperty('instruction');
  }
});

it('retains nondelivery of a hard instruction and never infers soft acceptance', () => {
  const i = input(), { acceptance: _acceptance, ...instruction } = i.source.instruction,
    soft = resolveLiveManagerCommunicationV122({ ...i, source: { ...i.source, instruction } });
  if (soft.status !== 'RECEIVED') throw Error('expected delivery');
  expect(soft.instruction).not.toHaveProperty('acceptance');
  const hard = resolveLiveManagerCommunicationV122({ ...i, cutoff: { tick: 1000000, elapsedSeconds: 0 },
    source: { ...i.source, instruction: { ...instruction, authority: 'hard' } } });
  expect(hard.status).toBe('NOT_ARRIVED');
});

it('expires the same one-pitch source on the next release without reinterpreting its sent time or exposing its payload', () => {
  const i = input(), first = resolveLiveManagerCommunicationV122(i), before = JSON.stringify(i.source),
    nextPitch = { ...i, clock: { ...i.clock, originTick: 2000000 }, cutoff: { tick: 2100000, elapsedSeconds: .1 } },
    expired = resolveLiveManagerCommunicationV122(nextPitch);
  expect(first.status).toBe('RECEIVED');
  expect(expired).toMatchObject({ status: 'NOT_APPLICABLE', reason: 'SOURCE_FROM_PREVIOUS_PITCH' });
  expect(expired).not.toHaveProperty('instruction'); expect(expired).not.toHaveProperty('receivedAtTick');
  expect(resolveLiveManagerCommunicationV122(nextPitch)).toEqual(expired);
  expect(JSON.stringify(i.source)).toBe(before);
});

it('keeps fractional exact time, deterministic recognition jitter and input validation', () => {
  const i = input(), fractional = { ...i, source: { ...i.source, sourceTick: 1000001, sentAtElapsedSeconds: .0000004,
    conditions: { ...i.source.conditions, propagationDelayTicks: 0, recognitionBaseDelayTicks: 0 } } };
  expect(resolveLiveManagerCommunicationV122({ ...fractional, cutoff: { tick: 1000001, elapsedSeconds: .0000003 } }).status).toBe('NOT_ARRIVED');
  const jitter = { ...i, source: { ...i.source, conditions: { ...i.source.conditions, attention: .8, maxAdditionalRecognitionDelayTicks: 10000 } } };
  expect(resolveLiveManagerCommunicationV122(jitter)).toEqual(resolveLiveManagerCommunicationV122(jitter));
  for (const bad of [{ ...i, seed: NaN }, { ...i, cutoff: { tick: 1100001, elapsedSeconds: .1 } },
    { ...i, source: { ...i.source, sourceTick: 1000001 } },
    { ...i, source: { ...i.source, instruction: { ...i.source.instruction, acceptance: 2 } } },
    { ...i, source: { ...i.source, conditions: { ...i.source.conditions, recognition: -1 } } }])
    expect(() => resolveLiveManagerCommunicationV122(bad)).toThrow();
  let calls = 0;
  expect(() => resolveLiveManagerCommunicationV122(Object.defineProperty({ ...i }, 'source', { enumerable: true, get: () => { calls++; return i.source; } }))).toThrow();
  expect(calls).toBe(0);
});
