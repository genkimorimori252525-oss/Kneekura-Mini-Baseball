import { expect, it } from 'vitest';
// This test exercises only inert Source validation, with no Native fixture or DB.
const subject = await import('./ActualLivePlayScope').catch(() => null);
it('has an identity-only versioned Source boundary', () => {
  expect(subject, 'V1-A identity-only Source parser must exist').not.toBe(null);
  const source = { sourceId: 's', sourceVersion: 'v1', capability: 'actual_live_play_scope_v1' as const,
    physicalPitchSourceId: 'pitch', cut: { kind: 'original_pitch' as const } };
  expect(subject!.actualLivePlayScopeInput(source)).toEqual(source);
  for (const key of ['participants', 'producers', 'terminal', 'settledActors', 'registry', 'queueWatermark', 'result']) {
    expect(() => subject!.actualLivePlayScopeInput({ ...source, [key]: [] })).toThrow();
  }
});
