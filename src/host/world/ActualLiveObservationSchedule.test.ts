import { expect, it } from 'vitest';
import { deriveActualLiveObservationSchedule } from './ActualLiveObservationSchedule';
const observation = (sourceId: string, tick: number, status: 'detected' | 'not_detected' | 'refresh_not_due' = 'detected') => ({
  sourceId, at: { originTick: 0, elapsedSeconds: tick / 1000, tick }, attentionTarget: { kind: 'ball' as const },
  refreshPolicy: { attendedIntervalTicks: 10, peripheralIntervalTicks: 40 },
  results: [{ target: { kind: 'ball' as const }, status }],
});
it('derives future due work from the actual detected sample and accepted calibration', () => {
  const result = deriveActualLiveObservationSchedule([observation('seen', 101)]);
  expect(result.pending).toEqual([{ target: { kind: 'ball' }, causeSourceId: 'seen', dueTick: 111 }]);
  expect(result.consumed).toEqual([]);
});
it('does not create hypothetical work from nondetection and preserves a due sample through refresh-not-due input', () => {
  expect(deriveActualLiveObservationSchedule([observation('missed', 101, 'not_detected')]).pending).toEqual([]);
  expect(deriveActualLiveObservationSchedule([observation('seen', 101), observation('early', 102, 'refresh_not_due')]).pending[0].dueTick).toBe(111);
});
it('consumes only an actual later sample and retains its original deadline and actual execution time', () => {
  const result = deriveActualLiveObservationSchedule([observation('seen', 101), observation('later-miss', 113, 'not_detected')]);
  expect(result.pending).toEqual([]);
  expect(result.consumed).toMatchObject([{ causeSourceId: 'seen', dueTick: 111, consumerSourceId: 'later-miss', at: { tick: 113 } }]);
});
