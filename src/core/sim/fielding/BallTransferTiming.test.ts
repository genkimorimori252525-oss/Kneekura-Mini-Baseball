import { describe, expect, it } from 'vitest';
import {
  resolveBallTransferTiming,
} from './BallTransferTiming';

const parameters = {
  minimumTransferDelayTicks: 80_000,
  maximumTransferDelayTicks: 260_000,
  fixedGripOffsetTicks: 20_000,
} as const;

describe('BallTransferTiming', () => {
  it('maps low transfer ability to the slow end of throw-ready timing', () => {
    expect(resolveBallTransferTiming(
      2_000_000,
      0,
      parameters,
    )).toEqual({
      securedPossessionTick: 2_000_000,
      transferDelayTicks: 280_000,
      throwReadyTick: 2_280_000,
    });
  });

  it('maps high transfer ability to the fast end without changing possession time', () => {
    expect(resolveBallTransferTiming(
      2_000_000,
      1,
      parameters,
    )).toEqual({
      securedPossessionTick: 2_000_000,
      transferDelayTicks: 100_000,
      throwReadyTick: 2_100_000,
    });
  });

  it('interpolates deterministically', () => {
    expect(resolveBallTransferTiming(
      2_000_000,
      0.5,
      parameters,
    ).throwReadyTick).toBe(2_190_000);
  });

  it('rejects invalid ability and timing calibration', () => {
    expect(() => resolveBallTransferTiming(
      2_000_000,
      -0.1,
      parameters,
    )).toThrow(
      'transferAbility must be finite and within [0, 1]',
    );

    expect(() => resolveBallTransferTiming(
      2_000_000,
      0.5,
      {
        ...parameters,
        minimumTransferDelayTicks: 300_000,
      },
    )).toThrow(
      'minimumTransferDelayTicks must be <= maximumTransferDelayTicks',
    );
  });
});
