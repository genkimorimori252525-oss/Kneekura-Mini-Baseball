import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  createP9BatchCalibrationContacts,
  runP9BatchCalibration,
} from './P9BatchCalibration';

describe('P9BatchCalibration', () => {
  it('runs a reproducible 1024-contact real-motion batch with outs, hits, extra-base hits, and runs', () => {
    const first = runP9BatchCalibration(
      20260919,
      1024,
    );
    const second = runP9BatchCalibration(
      20260919,
      1024,
    );

    expect(first).toEqual(second);
    expect(first.calibrationFingerprint)
      .toMatch(/^[0-9a-f]{16}$/);
    expect(first.alignments).toHaveLength(2);

    for (const alignment of first.alignments) {
      expect(alignment.statistics.samples).toBe(1024);
      expect(alignment.statistics.outs)
        .toBeGreaterThan(0);
      expect(alignment.statistics.hits)
        .toBeGreaterThan(0);
      expect(alignment.extraBaseHits)
        .toBeGreaterThan(0);
      expect(alignment.statistics.runsAllowed)
        .toBeGreaterThan(0);
      expect(alignment.statistics.homeRuns).toBe(0);
    }

    expect(
      first.alignments[0].statistics.outs,
    ).not.toBe(
      first.alignments[1].statistics.outs,
    );

    console.log(
      'P9_BATCH_CALIBRATION '
      + JSON.stringify(first),
    );
  });

  it('changes the canonical contact corpus when the seed changes', () => {
    const first = createP9BatchCalibrationContacts(
      1,
      32,
    );
    const second = createP9BatchCalibrationContacts(
      2,
      32,
    );

    expect(first).not.toEqual(second);
  });

  it('rejects invalid seed and sample domains', () => {
    expect(() => runP9BatchCalibration(
      -1,
      10,
    )).toThrow(
      'calibration seed must be an unsigned 32-bit integer',
    );
    expect(() => runP9BatchCalibration(
      1,
      0,
    )).toThrow(
      'calibration samples must be a positive safe integer',
    );
  });
});