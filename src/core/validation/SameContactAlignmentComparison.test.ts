import { describe, expect, it } from 'vitest';
import {
  advanceDefenderMotion,
} from '../sim/fielding/DefenderMotion';
import {
  createDefensiveAlignment,
} from '../sim/strategy/DefensiveAlignment';
import {
  compareSameContactDefensiveAlignments,
} from './SameContactAlignmentComparison';

const normal = createDefensiveAlignment([
  { playerId: 'p', registeredPosition: 'P', start: { x: 0, z: 18 } },
  { playerId: 'c', registeredPosition: 'C', start: { x: 0, z: -2 } },
  { playerId: '1b', registeredPosition: '1B', start: { x: 20, z: 20 } },
  { playerId: '2b', registeredPosition: '2B', start: { x: 8, z: 24 } },
  { playerId: '3b', registeredPosition: '3B', start: { x: -20, z: 20 } },
  { playerId: 'ss', registeredPosition: 'SS', start: { x: -8, z: 24 } },
  { playerId: 'lf', registeredPosition: 'LF', start: { x: -30, z: 55 } },
  { playerId: 'cf', registeredPosition: 'CF', start: { x: 0, z: 60 } },
  { playerId: 'rf', registeredPosition: 'RF', start: { x: 30, z: 55 } },
]);

const shifted = createDefensiveAlignment([
  { playerId: 'p', registeredPosition: 'P', start: { x: 0, z: 18 } },
  { playerId: 'c', registeredPosition: 'C', start: { x: 0, z: -2 } },
  { playerId: '1b', registeredPosition: '1B', start: { x: 20, z: 20 } },
  { playerId: '2b', registeredPosition: '2B', start: { x: -8, z: 24 } },
  { playerId: '3b', registeredPosition: '3B', start: { x: -20, z: 20 } },
  { playerId: 'ss', registeredPosition: 'SS', start: { x: -16, z: 28 } },
  { playerId: 'lf', registeredPosition: 'LF', start: { x: -25, z: 42 } },
  { playerId: 'cf', registeredPosition: 'CF', start: { x: -14, z: 38 } },
  { playerId: 'rf', registeredPosition: 'RF', start: { x: 30, z: 55 } },
]);

const contacts = [
  {
    contactId: 'pull-1',
    evidence: {
      target: { x: -18, z: 36 },
      fieldingWindowTicks: 1_200_000,
    },
  },
  {
    contactId: 'middle-1',
    evidence: {
      target: { x: 0, z: 44 },
      fieldingWindowTicks: 1_000_000,
    },
  },
] as const;

describe('SameContactAlignmentComparison', () => {
  it('feeds the exact same contact evidence through each alignment and aggregates only evaluator results', () => {
    const result = compareSameContactDefensiveAlignments({
      contacts,
      alignments: [
        { alignmentId: 'normal', alignment: normal },
        { alignmentId: 'shifted', alignment: shifted },
      ],
      evaluator: ({ contact, alignment }) => {
        const nearest = alignment.defenders
          .map((defender) => {
            const final = advanceDefenderMotion(
              {
                tick: 0,
                position: defender.start,
                velocity: { x: 0, z: 0 },
              },
              contact.evidence.target,
              contact.evidence.fieldingWindowTicks,
              {
                ticksPerSecond: 1_000_000,
                maxIntegrationStepTicks: 20_000,
                accelerationMps2: 5,
                brakingMps2: 5,
                topSpeedMps: 8,
                arrivalRadiusMeters: 0.4,
              },
            );

            return Math.hypot(
              final.position.x - contact.evidence.target.x,
              final.position.z - contact.evidence.target.z,
            );
          })
          .sort((a, b) => a - b)[0];

        return {
          classification: nearest <= 1.5 ? 'out' : 'single',
          runsAllowed: 0,
          extraBasesAllowed: 0,
          evidence: { nearestDistanceMeters: nearest },
        };
      },
    });

    expect(result.contactsFingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(result.alignments).toHaveLength(2);

    const normalStats = result.alignments.find(
      (entry) => entry.alignmentId === 'normal',
    )?.aggregate;
    const shiftedStats = result.alignments.find(
      (entry) => entry.alignmentId === 'shifted',
    )?.aggregate;

    expect(normalStats?.contacts).toBe(2);
    expect(shiftedStats?.contacts).toBe(2);
    expect(shiftedStats?.outs)
      .toBeGreaterThan(normalStats?.outs ?? -1);
    expect(shiftedStats?.fieldableHitRate)
      .toBeLessThan(normalStats?.fieldableHitRate ?? 2);
  });

  it('rejects an evaluator that mutates the shared contact evidence', () => {
    const mutable = [{
      contactId: 'mutable',
      evidence: {
        target: { x: 1, z: 2 },
        fieldingWindowTicks: 100,
      },
    }];

    expect(() => compareSameContactDefensiveAlignments({
      contacts: mutable,
      alignments: [
        { alignmentId: 'normal', alignment: normal },
      ],
      evaluator: ({ contact }) => {
        (contact.evidence as {
          target: { x: number; z: number };
        }).target.x = 99;

        return {
          classification: 'out',
          runsAllowed: 0,
          extraBasesAllowed: 0,
          evidence: {},
        };
      },
    })).toThrow();
  });

  it('rejects an evaluator that mutates the compared defensive alignment', () => {
    expect(() => compareSameContactDefensiveAlignments({
      contacts,
      alignments: [
        { alignmentId: 'normal', alignment: normal },
      ],
      evaluator: ({ alignment }) => {
        (alignment.defenders[0].start as {
          x: number;
          z: number;
        }).x = 999;

        return {
          classification: 'out',
          runsAllowed: 0,
          extraBasesAllowed: 0,
          evidence: {},
        };
      },
    })).toThrow();
  });

  it('passes recursively frozen canonical clones to the evaluator', () => {
    compareSameContactDefensiveAlignments({
      contacts,
      alignments: [
        { alignmentId: 'normal', alignment: normal },
      ],
      evaluator: ({ contact, alignment }) => {
        expect(Object.isFrozen(contact)).toBe(true);
        expect(Object.isFrozen(contact.evidence)).toBe(true);
        expect(Object.isFrozen(contact.evidence.target)).toBe(true);
        expect(Object.isFrozen(alignment)).toBe(true);
        expect(Object.isFrozen(alignment.defenders)).toBe(true);
        expect(Object.isFrozen(alignment.defenders[0].start)).toBe(true);

        return {
          classification: 'out',
          runsAllowed: 0,
          extraBasesAllowed: 0,
          evidence: {},
        };
      },
    });
  });

  it('keeps home runs out of fieldable hit-rate denominator', () => {
    const result = compareSameContactDefensiveAlignments({
      contacts: [
        {
          contactId: 'hr',
          evidence: { kind: 'home_run' },
        },
        {
          contactId: 'single',
          evidence: { kind: 'fieldable' },
        },
      ],
      alignments: [
        { alignmentId: 'normal', alignment: normal },
      ],
      evaluator: ({ contact }) => ({
        classification:
          contact.evidence.kind === 'home_run'
            ? 'home_run'
            : 'single',
        runsAllowed:
          contact.evidence.kind === 'home_run'
            ? 1
            : 0,
        extraBasesAllowed: 0,
        evidence: {},
      }),
    });

    expect(result.alignments[0].aggregate).toMatchObject({
      contacts: 2,
      homeRuns: 1,
      fieldableBalls: 1,
      hitsOnFieldableBalls: 1,
      fieldableHitRate: 1,
    });
  });
});