import { describe, expect, it, vi } from 'vitest';
import { finishSamePaOccupiedPitchReadback } from './SamePlateAppearanceOccupiedReadback.test-support';
import type { SamePaExecutedPitch } from './SamePlateAppearanceDispatchExecution';

// Deliberately a tiny inert value: these tests exercise only the two-assertion
// seam, never simulate a production pitch or claim Native acceptance coverage.
const pitch = { source: { sourceId: 'readback-seam-only' }, progressRevision: 1 } as SamePaExecutedPitch;
const owner = (value: SamePaExecutedPitch | null) => ({
  readPhysicalPitch: vi.fn(() => value),
  acceptPhysicalPitch: vi.fn(() => { throw new Error('completed writer/retry must not run'); }),
});

describe('remaining occupied readback seam without Native owners', () => {
  it('uses one read, retains deep equality, and then compares saved rows without retrying', () => {
    const reopened = owner({ progressRevision: 1, source: { sourceId: 'readback-seam-only' } } as SamePaExecutedPitch);
    const bytes = vi.fn(() => 'saved rows');
    finishSamePaOccupiedPitchReadback(reopened, pitch, bytes, 'saved rows');
    expect(reopened.readPhysicalPitch).toHaveBeenCalledTimes(1);
    expect(reopened.readPhysicalPitch).toHaveBeenCalledWith(pitch.source.sourceId);
    expect(reopened.acceptPhysicalPitch).not.toHaveBeenCalled();
    expect(bytes).toHaveBeenCalledOnce();
  });
  it('rejects a missing or different readback before comparing rows', () => {
    for (const value of [null, { ...pitch, source: { ...pitch.source, sourceId: 'different' } }]) {
      const reopened = owner(value), bytes = vi.fn(() => 'saved rows');
      expect(() => finishSamePaOccupiedPitchReadback(reopened, pitch, bytes, 'saved rows')).toThrow();
      expect(reopened.readPhysicalPitch).toHaveBeenCalledOnce();
      expect(reopened.acceptPhysicalPitch).not.toHaveBeenCalled();
      expect(bytes).not.toHaveBeenCalled();
    }
  });
  it('rejects changed rows after an equal readback', () => {
    const reopened = owner(pitch);
    expect(() => finishSamePaOccupiedPitchReadback(reopened, pitch, () => 'changed rows', 'saved rows')).toThrow();
    expect(reopened.readPhysicalPitch).toHaveBeenCalledOnce();
    expect(reopened.acceptPhysicalPitch).not.toHaveBeenCalled();
  });
});
