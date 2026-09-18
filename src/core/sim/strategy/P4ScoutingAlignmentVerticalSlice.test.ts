import { describe, expect, it } from 'vitest';
import {
  DeterministicRng,
} from '../../rng/DeterministicRng';
import {
  createBatterTrueTendency,
} from '../../model/BatterTendency';
import {
  buildScoutingEstimate,
} from './ScoutingEstimate';
import {
  createDefensiveAlignment,
} from './DefensiveAlignment';
import {
  selectDefensiveAlignmentCandidateForManager,
} from './ManagerAlignmentSelection';
import {
  createDefenderWorldStatesFromAlignment,
} from './DefensiveAlignmentWorldAdapter';

const makeAlignment = (
  cfX: number,
  cfZ: number,
) => createDefensiveAlignment([
  { playerId: 'p', registeredPosition: 'P', start: { x: 0, z: 18 } },
  { playerId: 'c', registeredPosition: 'C', start: { x: 0, z: -2 } },
  { playerId: '1b', registeredPosition: '1B', start: { x: 18, z: 20 } },
  { playerId: '2b', registeredPosition: '2B', start: { x: 8, z: 24 } },
  { playerId: '3b', registeredPosition: '3B', start: { x: -20, z: 20 } },
  { playerId: 'ss', registeredPosition: 'SS', start: { x: -8, z: 24 } },
  { playerId: 'lf', registeredPosition: 'LF', start: { x: -30, z: 55 } },
  { playerId: 'cf', registeredPosition: 'CF', start: { x: cfX, z: cfZ } },
  { playerId: 'rf', registeredPosition: 'RF', start: { x: 30, z: 55 } },
]);

const candidates = [
  {
    id: 'pull-shift',
    alignment: makeAlignment(-22, 38),
  },
  {
    id: 'neutral',
    alignment: makeAlignment(0, 45),
  },
  {
    id: 'opposite-shift',
    alignment: makeAlignment(22, 38),
  },
] as const;

const prior = {
  directionDistribution: {
    pull: 1 / 3,
    middle: 1 / 3,
    opposite: 1 / 3,
  },
  trajectoryDistribution: {
    ground: 0.4,
    line: 0.2,
    fly: 0.3,
    popup: 0.1,
  },
} as const;

const estimateFrom = (
  direction: 'pull' | 'opposite',
) => buildScoutingEstimate({
  observations: Array.from(
    { length: 8 },
    (_, index) => ({
      direction,
      trajectory: 'ground' as const,
      observedAtSequence: 93 + index,
    }),
  ),
  currentSequence: 100,
  prior,
  parameters: {
    priorWeight: 1,
    recencyDecayPerObservation: 0.05,
  },
});

const select = (
  scoutingEstimate: ReturnType<
    typeof buildScoutingEstimate
  >,
) => selectDefensiveAlignmentCandidateForManager({
  scoutingEstimate,
  candidates,
  directionAnchors: {
    pull: { x: -22, z: 38 },
    middle: { x: 0, z: 45 },
    opposite: { x: 22, z: 38 },
  },
  neutralDirectionDistribution:
    prior.directionDistribution,
  coveragePlayerIds: ['cf'],
  alignmentComparison: 1,
  rng: new DeterministicRng(20260918),
  calibration: {
    minimumComparisonErrorMeters: 0,
    maximumComparisonErrorMeters: 8,
  },
});

describe('P4 scouting -> alignment vertical slice', () => {
  it('lets different defensive observation histories produce different alignments for the same unseen batter truth', () => {
    const trueTendency = createBatterTrueTendency({
      directionDistribution: {
        pull: 0.6,
        middle: 0.25,
        opposite: 0.15,
      },
      trajectoryDistribution: {
        ground: 0.45,
        line: 0.25,
        fly: 0.25,
        popup: 0.05,
      },
      contextAdjustments: [],
    });

    const pullEstimate = estimateFrom('pull');
    const oppositeEstimate = estimateFrom('opposite');

    const pullSelection = select(pullEstimate);
    const oppositeSelection = select(
      oppositeEstimate,
    );

    expect(trueTendency.directionDistribution.pull)
      .toBe(0.6);
    expect(pullEstimate.directionDistribution.pull)
      .toBeGreaterThan(
        oppositeEstimate.directionDistribution.pull,
      );
    expect(pullSelection.selected.id)
      .toBe('pull-shift');
    expect(oppositeSelection.selected.id)
      .toBe('opposite-shift');

    const pullWorld =
      createDefenderWorldStatesFromAlignment(
        pullSelection.selected.alignment,
      );
    const oppositeWorld =
      createDefenderWorldStatesFromAlignment(
        oppositeSelection.selected.alignment,
      );

    expect(
      pullWorld.find(
        (defender) => defender.playerId === 'cf',
      )?.position,
    ).toEqual({ x: -22, z: 38 });
    expect(
      oppositeWorld.find(
        (defender) => defender.playerId === 'cf',
      )?.position,
    ).toEqual({ x: 22, z: 38 });
  });

  it('does not alter the selected players physical state beyond their pre-pitch coordinates', () => {
    const selection = select(
      estimateFrom('pull'),
    );
    const world =
      createDefenderWorldStatesFromAlignment(
        selection.selected.alignment,
      );

    expect(world.every(
      (defender) => (
        defender.velocity.x === 0
        && defender.velocity.z === 0
        && defender.assignment.kind === 'hold'
      ),
    )).toBe(true);
  });
});
