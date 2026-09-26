import { generateDevelopmentCatalystProfile } from './DevelopmentCatalyst';
import type { DevelopmentCatalystPolicy,
  DevelopmentCatalystProfile } from './DevelopmentCatalyst';
import { generateDevelopmentTrajectory } from './DevelopmentTrajectory';
import type { DevelopmentTrajectoryPolicy,
  DevelopmentTrajectoryProfile } from './DevelopmentTrajectory';
import { generateStarGenesis } from './StarGenesis';
import type { StarGenesisPolicy,
  StarGenesisProfile } from './StarGenesis';

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
    seed: input.careerSeed };
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
