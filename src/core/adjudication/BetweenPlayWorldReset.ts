import type { CanonicalMatchState } from '../model/CanonicalMatchState';
import type {
  CanonicalWorldSnapshot,
  DefensivePosition,
  DefenderWorldState,
} from '../model/CanonicalWorldSnapshot';
import type { Vec2 } from '../model/geometry';
import { cloneInert } from './OfficialWindowPolicy';

const positions: readonly DefensivePosition[] = [
  'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF',
];

export type BetweenPlayWorldSetup = Readonly<{
  baseCenters: Readonly<{ first: Vec2; second: Vec2; third: Vec2 }>;
  defenders: readonly Pick<DefenderWorldState, 'playerId' | 'registeredPosition' | 'position'>[];
  activePreviousPlayControllerIds: readonly string[];
}>;

/** Construct a discontinuous rule-system setup after the closed official state is applied. */
export const prepareBetweenPlayWorld = (
  nextMatchInput: CanonicalMatchState,
  setupTick: number,
  setupInput: BetweenPlayWorldSetup,
): CanonicalWorldSnapshot => {
  const nextMatch = cloneInert(nextMatchInput);
  const setup = cloneInert(setupInput);
  if (!Number.isSafeInteger(setupTick) || setupTick < 0) {
    throw new Error('between-play setup tick must be a non-negative safe integer');
  }
  if (setup.activePreviousPlayControllerIds.length !== 0) {
    throw new Error('previous-play controllers must be retired before next-play setup');
  }
  const centers = [setup.baseCenters.first, setup.baseCenters.second, setup.baseCenters.third];
  if (centers.some((center) => !Number.isFinite(center.x) || !Number.isFinite(center.z))) {
    throw new Error('base centers must be finite');
  }
  if (new Set(centers.map((center) => `${center.x}:${center.z}`)).size !== 3) {
    throw new Error('base centers must be distinct');
  }
  if (setup.defenders.length !== positions.length) {
    throw new Error('next-play setup requires all nine defensive positions');
  }
  const defenderIds = new Set<string>();
  const byPosition = new Map<DefensivePosition, typeof setup.defenders[number]>();
  for (const defender of setup.defenders) {
    if (typeof defender.playerId !== 'string' || defender.playerId.length === 0) {
      throw new Error('setup defender playerId must not be empty');
    }
    if (defenderIds.has(defender.playerId) || byPosition.has(defender.registeredPosition)) {
      throw new Error('setup defenders must have unique IDs and defensive positions');
    }
    if (!positions.includes(defender.registeredPosition)) {
      throw new Error('setup defender has an unknown defensive position');
    }
    defenderIds.add(defender.playerId);
    byPosition.set(defender.registeredPosition, defender);
  }
  const runners = ([
    ['first', setup.baseCenters.first],
    ['second', setup.baseCenters.second],
    ['third', setup.baseCenters.third],
  ] as const).flatMap(([base, center]) => {
    const playerId = nextMatch.bases[base];
    return playerId === null ? [] : [{
      playerId,
      position: { x: center.x, z: center.z },
      velocity: { x: 0, z: 0 },
    }];
  });
  const runnerIds = runners.map((runner) => runner.playerId);
  if (
    runnerIds.some((id) => typeof id !== 'string' || id.length === 0)
    || new Set(runnerIds).size !== runnerIds.length
    || runnerIds.some((id) => defenderIds.has(id))
  ) {
    throw new Error('next-play runner actors must be unique and distinct from defenders');
  }
  const defenders: DefenderWorldState[] = positions.map((position) => {
    const defender = byPosition.get(position);
    if (defender === undefined) throw new Error('next-play setup is missing a defender');
    return {
      playerId: defender.playerId,
      registeredPosition: position,
      position: { x: defender.position.x, z: defender.position.z },
      velocity: { x: 0, z: 0 },
      assignment: { kind: 'hold' },
    };
  });
  return Object.freeze({ tick: setupTick, defenders, runners, ball: null });
};
