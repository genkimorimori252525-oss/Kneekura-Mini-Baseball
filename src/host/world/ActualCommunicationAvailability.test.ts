import { expect, it } from 'vitest';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import { actualCommunicationAt, type DurableActualCallCommunication } from './ActualCallCommunication';
import * as communication from './ActualCallCommunication';
const clock = { originTick: 100, ticksPerSecond: 1000 }, sent = 0.1000001;
const at = (elapsedSeconds: number) => ({ originTick: clock.originTick, elapsedSeconds, tick: quantizeEventTick(clock.originTick, elapsedSeconds, clock.ticksPerSecond) });
const event = { sourceId: 'umpire', kind: 'callout' as const, targetScope: { kind: 'nearby' as const }, issuedAt: at(sent).tick,
  content: { callSourceId: 'call', call: 'safe' as const, calledAt: at(sent), onFieldCall: { callId: 'call', tick: at(sent).tick, basisSnapshotId: 'snapshot',
    basisEvidenceRevision: 1, ruling: { outsAfter: 0, basesAfter: { first: 'p1', second: null, third: null }, scoredRunnerIds: [] as const } } } };
const value = { clock, sentAt: at(sent), recipients: [{ playerId: 'p1', kind: 'received', receiverPosition: { x: 1, y: 2, z: 3 },
  reception: { received: { event, receivedAt: at(sent + 0.0000001).tick, confidence: 0.5 }, sentAtElapsedSeconds: sent, receivedAtElapsedSeconds: sent + 0.0000001 } }] } as unknown as DurableActualCallCommunication;
it('withholds the call before emission and withholds received status before the exact same-tick reception', () => {
  expect(actualCommunicationAt(value, 'p1', at(sent - 0.00000001))).toEqual({ playerId: 'p1', kind: 'pending', reason: 'communication_not_emitted_yet' });
  expect(actualCommunicationAt(value, 'p1', at(sent))).toMatchObject({ kind: 'scheduled', receiverPosition: null });
  expect(actualCommunicationAt(value, 'p1', at(sent + 0.0000001))).toEqual(value.recipients[0]);
});
it('rejects a wrong clock or an actor outside the original recipient scope', () => {
  expect(() => actualCommunicationAt(value, 'p2', at(sent))).toThrow();
  expect(() => actualCommunicationAt(value, 'p1', { ...at(sent), originTick: 1 })).toThrow();
});
it('exposes no future call content in the actual observation receipt before reception', () => {
  const reader = (communication as Record<string, any>).actualCommunicationObservationAt;
  expect(typeof reader).toBe('function');
  const projected = reader(value, 'p1', at(sent));
  expect(projected).toEqual({ playerId: 'p1', kind: 'scheduled', dueAt: at(sent + 0.0000001) });
  expect(JSON.stringify(projected)).not.toContain('safe');
  expect(reader(value, 'p1', at(sent + 0.0000001))).toMatchObject({ kind: 'received', received: { event } });
});
