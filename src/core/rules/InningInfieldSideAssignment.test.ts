import { describe, expect, it } from 'vitest';
import {
  createDefenderFootPlacementFact,
  createSecondBaseDivisionReference,
} from './DefensiveAlignmentFacts';
import {
  evaluatePitchReleaseInfieldSide,
} from './PitchReleaseInfieldSideRule';
import {
  establishInningInfieldSideAssignment,
  evaluateInningInfieldSideLock,
} from './InningInfieldSideAssignment';

const tick = 2_000_000;
const reference = createSecondBaseDivisionReference(
  { x: 0, z: 0 },
  { x: 1, z: 0 },
);
const parameters = {
  requiredInfielderCount: 4,
  minimumInfieldersEachSideOfSecondBase: 2,
} as const;

const fact = (
  id: string,
  position: '1B' | '2B' | '3B' | 'SS',
  x: number,
  atTick = tick,
) => createDefenderFootPlacementFact(
  id,
  position,
  atTick,
  { x: x - 0.05, z: 0 },
  { x: x + 0.05, z: 0 },
);

const evaluate = (
  facts: readonly ReturnType<typeof fact>[],
  atTick = tick,
) => evaluatePitchReleaseInfieldSide({
  pitchReleaseTick: atTick,
  facts,
  reference,
  parameters,
});

const initial = () => evaluate([
  fact('1b', '1B', 3),
  fact('2b', '2B', 2),
  fact('ss', 'SS', -2),
  fact('3b', '3B', -3),
]);

describe('InningInfieldSideAssignment', () => {
  it('establishes immutable player-to-side assignments from the first legal 2+2 pitch', () => {
    expect(establishInningInfieldSideAssignment(initial())).toEqual({
      assignments: [
        { playerId: '1b', side: 'first_base_side' },
        { playerId: '2b', side: 'first_base_side' },
        { playerId: 'ss', side: 'third_base_side' },
        { playerId: '3b', side: 'third_base_side' },
      ],
    });
  });

  it('accepts the same four players remaining on their established sides', () => {
    const assignment = establishInningInfieldSideAssignment(initial());
    const current = evaluate([
      fact('1b', '1B', 4),
      fact('2b', '2B', 1),
      fact('ss', 'SS', -1),
      fact('3b', '3B', -4),
    ]);

    expect(evaluateInningInfieldSideLock(
      assignment,
      current,
    )).toEqual({
      kind: 'compliant',
      movedPlayers: [],
      invalidPlayers: [],
    });
  });

  it('rejects a 2B/SS side swap even though the current raw count is still 2+2', () => {
    const assignment = establishInningInfieldSideAssignment(initial());
    const current = evaluate([
      fact('1b', '1B', 3),
      fact('2b', '2B', -2),
      fact('ss', 'SS', 2),
      fact('3b', '3B', -3),
    ]);

    expect(current.kind).toBe('legal');
    expect(evaluateInningInfieldSideLock(
      assignment,
      current,
    )).toEqual({
      kind: 'violation',
      movedPlayers: ['2b', 'ss'],
      invalidPlayers: [],
    });
  });

  it('reports a 3+1 change as a moved-player lock violation', () => {
    const assignment = establishInningInfieldSideAssignment(initial());
    const current = evaluate([
      fact('1b', '1B', 3),
      fact('2b', '2B', 2),
      fact('ss', 'SS', 1),
      fact('3b', '3B', -3),
    ]);

    expect(current.kind).toBe('violation');
    expect(evaluateInningInfieldSideLock(
      assignment,
      current,
    )).toEqual({
      kind: 'violation',
      movedPlayers: ['ss'],
      invalidPlayers: [],
    });
  });

  it('reports straddling as a lock violation', () => {
    const assignment = establishInningInfieldSideAssignment(initial());
    const current = evaluate([
      fact('1b', '1B', 3),
      fact('2b', '2B', 2),
      createDefenderFootPlacementFact(
        'ss',
        'SS',
        tick,
        { x: -0.1, z: 0 },
        { x: 0.1, z: 0 },
      ),
      fact('3b', '3B', -3),
    ]);

    expect(evaluateInningInfieldSideLock(
      assignment,
      current,
    )).toEqual({
      kind: 'violation',
      movedPlayers: [],
      invalidPlayers: ['ss'],
    });
  });

  it('returns unsupported participant change instead of guessing substitution semantics', () => {
    const assignment = establishInningInfieldSideAssignment(initial());
    const current = evaluate([
      fact('1b', '1B', 3),
      fact('replacement-2b', '2B', 2),
      fact('ss', 'SS', -2),
      fact('3b', '3B', -3),
    ]);

    expect(evaluateInningInfieldSideLock(
      assignment,
      current,
    )).toEqual({
      kind: 'unsupported_participant_change',
      expectedPlayerIds: ['1b', '2b', 'ss', '3b'],
      currentPlayerIds: ['1b', 'replacement-2b', 'ss', '3b'],
    });
  });

  it('refuses to establish the inning assignment from an illegal first-pitch alignment', () => {
    expect(() => establishInningInfieldSideAssignment(
      evaluate([
        fact('1b', '1B', 3),
        fact('2b', '2B', 2),
        fact('ss', 'SS', 1),
        fact('3b', '3B', -3),
      ]),
    )).toThrow(
      'inning side assignment requires a legal initial pitch-release alignment',
    );
  });
});
