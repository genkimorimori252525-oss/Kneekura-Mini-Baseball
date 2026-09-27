import { generateDevelopmentCatalystProfile } from './DevelopmentCatalyst';
import type { DevelopmentCatalystPolicy,
  DevelopmentCatalystProfile } from './DevelopmentCatalyst';
import { generateDevelopmentTrajectory } from './DevelopmentTrajectory';
import type { DevelopmentTrajectoryPolicy,
  DevelopmentTrajectoryProfile } from './DevelopmentTrajectory';
import { generateStarGenesis } from './StarGenesis';
import type { StarGenesisPolicy,
  StarGenesisProfile } from './StarGenesis';
import { UINT32_RANGE } from './DevelopmentRandom';

export const PLAYER_PERSON_SEED_VERSION = 'player-person-seed-v1' as const;

export type PlayerPersonPriorPolicies = Readonly<{
  trajectory: DevelopmentTrajectoryPolicy;
  catalyst: DevelopmentCatalystPolicy;
  star: StarGenesisPolicy;
}>;
export type PlayerPersonPriorGeneration = Readonly<{
  careerId: string;
  playerId: string;
  createdAtDay: number;
  careerSeed: number;
  policies: PlayerPersonPriorPolicies;
}>;
/** Hidden Person-creation data; it does not contain current ability or public status. */
export type PlayerPersonPriors = Readonly<{
  careerId: string;
  playerId: string;
  createdAtDay: number;
  trajectory: DevelopmentTrajectoryProfile;
  catalyst: DevelopmentCatalystProfile;
  star: StarGenesisProfile;
}>;

/** Stable, Person-specific stream; a Career seed is never reused verbatim. */
export const derivePlayerPersonSeed = (careerId: string,
  playerId: string, careerSeed: number): number => {
  if (!careerId || !playerId || careerId.trim() !== careerId
    || playerId.trim() !== playerId
    || !Number.isSafeInteger(careerSeed)
    || careerSeed <= 0 || careerSeed >= UINT32_RANGE) {
    throw new Error('invalid Player Person seed scope');
  }
  let hash = (0x811c9dc5 ^ careerSeed) >>> 0;
  const key = JSON.stringify([PLAYER_PERSON_SEED_VERSION,
    careerId, playerId]);
  for (let index = 0; index < key.length; index += 1) {
    hash = Math.imul(hash ^ key.charCodeAt(index), 0x01000193) >>> 0;
  }
  return hash || 0x9e3779b9;
};

/** Generates independent salted streams from one Career seed and pinned policies. */
export const generatePlayerPersonPriors = (
  input: PlayerPersonPriorGeneration,
): PlayerPersonPriors => {
  if (!input || !input.policies
    || Object.keys(input).length !== 5
    || Object.keys(input.policies).length !== 3) {
    throw new Error('invalid Player Person prior generation');
  }
  const common = { careerId: input.careerId,
    playerId: input.playerId, createdAtDay: input.createdAtDay,
    seed: derivePlayerPersonSeed(input.careerId,
      input.playerId, input.careerSeed) };
  const trajectory = generateDevelopmentTrajectory({ ...common,
    policy: input.policies.trajectory });
  const catalyst = generateDevelopmentCatalystProfile({ ...common,
    policy: input.policies.catalyst });
  const star = generateStarGenesis({ ...common,
    policy: input.policies.star });
  return Object.freeze({ careerId: input.careerId,
    playerId: input.playerId, createdAtDay: input.createdAtDay,
    trajectory, catalyst, star });
};
