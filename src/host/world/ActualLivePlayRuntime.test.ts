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
it('keeps the explicit settled-foul capability limited to original source references', () => {
  const source = { ...input, capability: 'causal_original_settled_foul_runtime_v1' as const };
  expect(actualLivePlayRuntimeInput(source, source.sourceId)).toEqual(source);
  for (const key of ['participants', 'producers', 'membership', 'completed', 'terminal', 'watermark']) {
    expect(() => actualLivePlayRuntimeInput({ ...source, [key]: [] }, source.sourceId)).toThrow(/invalid/);
  }
});
it('rejects unknown runtime capabilities without silently selecting a legacy manifest', () => {
  for (const capability of ['', 'causal_original_settled_foul_runtime_v2', 'unknown']) {
    expect(() => actualLivePlayRuntimeInput({ ...input, capability } as typeof input, input.sourceId)).toThrow(/invalid/);
  }
});
