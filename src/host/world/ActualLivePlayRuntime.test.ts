import { expect, it } from 'vitest';
import { actualLivePlayRuntimeInput } from './ActualLivePlayRuntime';
const input = { sourceId: 'runtime', sourceVersion: 'v1', capability: 'causal_original_live_play_runtime_v1' as const, physicalPitchSourceId: 'pitch' };
it('accepts only source references, with no injected membership, schedule, completion, terminal or watermark', () => {
  expect(actualLivePlayRuntimeInput(input, 'runtime')).toEqual(input);
  for (const key of ['participants', 'disabledDomains', 'nextObservationTick', 'nextControllerTick', 'completed', 'terminal', 'watermark']) {
    expect(() => actualLivePlayRuntimeInput({ ...input, [key]: [] }, 'runtime')).toThrow(/invalid/);
  }
  expect(() => actualLivePlayRuntimeInput(input, 'other')).toThrow(/invalid/);
});
