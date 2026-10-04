import { expect, it } from 'vitest';
import * as closure from './ActualLivePlayClosureSource';
const source = { sourceId: 'closure', sourceVersion: 'v1', adjudicationSourceId: 'adjudication', applicationId: 'apply',
  closureTick: 10, nextStartedAtTick: 11, controllerReset: 'rule_system_retire_original_play' as const,
  worldSetup: { baseCenters: { first: { x: 1, z: 1 }, second: { x: 0, z: 2 }, third: { x: -1, z: 1 } },
    defenders: [], activePreviousPlayControllerIds: [] } };
it('accepts an explicit rule-system setup instruction and refuses arbitrary gameplay/score/completion fields', () => {
  expect(closure.actualLivePlayClosureInput(source, source.sourceId)).toEqual(source);
  for (const key of ['outsAfter', 'basesAfter', 'score', 'completed', 'workload', 'watermark', 'game']) {
    expect(() => closure.actualLivePlayClosureInput({ ...source, [key]: true }, source.sourceId)).toThrow();
  }
});
it('refuses backdated setup, active old controllers and malformed source clocks', () => {
  expect(() => closure.actualLivePlayClosureInput({ ...source, nextStartedAtTick: 9 }, source.sourceId)).toThrow();
  expect(() => closure.actualLivePlayClosureInput({ ...source, closureTick: NaN }, source.sourceId)).toThrow();
  expect(() => closure.actualLivePlayClosureInput({ ...source,
    worldSetup: { ...source.worldSetup, activePreviousPlayControllerIds: ['old'] } }, source.sourceId)).toThrow();
});
