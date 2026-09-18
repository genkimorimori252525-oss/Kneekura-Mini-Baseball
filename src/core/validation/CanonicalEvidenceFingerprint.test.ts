import { describe, expect, it } from 'vitest';
import {
  canonicalizeEvidence,
  createCanonicalEvidenceFingerprint,
} from './CanonicalEvidenceFingerprint';

describe('CanonicalEvidenceFingerprint', () => {
  it('is independent of object key insertion order', () => {
    const first = {
      playId: 7,
      state: {
        outs: 1,
        score: {
          away: 2,
          home: 1,
        },
      },
    };
    const second = {
      state: {
        score: {
          home: 1,
          away: 2,
        },
        outs: 1,
      },
      playId: 7,
    };

    expect(canonicalizeEvidence(first))
      .toBe(canonicalizeEvidence(second));
    expect(createCanonicalEvidenceFingerprint(first))
      .toBe(createCanonicalEvidenceFingerprint(second));
  });

  it('preserves array order as canonical evidence', () => {
    const first = {
      events: [
        { tick: 10, kind: 'A' },
        { tick: 20, kind: 'B' },
      ],
    };
    const second = {
      events: [
        { tick: 20, kind: 'B' },
        { tick: 10, kind: 'A' },
      ],
    };

    expect(canonicalizeEvidence(first))
      .not.toBe(canonicalizeEvidence(second));
    expect(createCanonicalEvidenceFingerprint(first))
      .not.toBe(createCanonicalEvidenceFingerprint(second));
  });

  it('changes when one authoritative tick changes', () => {
    const first = {
      matchSeed: 20260919,
      playId: 4,
      events: [{
        tick: 1_000_000,
        sequence: 0,
        kind: 'BallReachedBase',
        payload: { base: 1 },
      }],
    };
    const second = {
      ...first,
      events: [{
        ...first.events[0],
        tick: 1_000_001,
      }],
    };

    expect(createCanonicalEvidenceFingerprint(first))
      .not.toBe(createCanonicalEvidenceFingerprint(second));
  });

  it('replays a nested match/events/world bundle identically', () => {
    const run = () => ({
      matchSeed: 998877,
      playId: 12,
      finalMatchState: {
        inning: 6,
        half: 'bottom',
        outs: 2,
        balls: 0,
        strikes: 0,
        score: {
          away: 3,
          home: 4,
        },
      },
      events: [
        {
          tick: 2_000_000,
          sequence: 0,
          kind: 'BattedBallDeclaredFair',
          payload: {
            contactTick: 1_990_000,
          },
        },
      ],
      worldSamples: [
        {
          tick: 2_000_000,
          defenders: [
            {
              playerId: 'cf',
              position: { x: -2, z: 23 },
            },
          ],
          ball: {
            position: { x: 4, y: 1.2, z: 18 },
          },
        },
      ],
    });

    expect(createCanonicalEvidenceFingerprint(run()))
      .toBe(createCanonicalEvidenceFingerprint(run()));
  });

  it('rejects undefined and non-finite numbers instead of silently dropping them', () => {
    expect(() => canonicalizeEvidence({
      a: undefined,
    })).toThrow(
      'canonical evidence does not support undefined',
    );

    expect(() => canonicalizeEvidence({
      value: Number.NaN,
    })).toThrow(
      'canonical evidence numbers must be finite',
    );

    expect(() => canonicalizeEvidence({
      value: Number.POSITIVE_INFINITY,
    })).toThrow(
      'canonical evidence numbers must be finite',
    );
  });

  it('uses locale-independent code-unit ordering for object keys', () => {
    expect(canonicalizeEvidence({
      'ä': 2,
      z: 1,
    })).toBe(
      '{"z":1,"ä":2}',
    );
  });

  it('returns a fixed-width hexadecimal regression fingerprint', () => {
    expect(
      createCanonicalEvidenceFingerprint({
        playId: 1,
        tick: 100,
      }),
    ).toMatch(/^[0-9a-f]{16}$/);
  });
});