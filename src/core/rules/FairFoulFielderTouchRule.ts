import {
  classifyBallAgainstFairTerritory,
  type FairTerritoryWedge,
} from '../sim/ball/FairTerritoryGeometry';
import type {
  BattedBallFirstFielderTouchTerritory,
} from '../sim/fielding/BattedBallFirstFielderTouchTerritory';

export type FirstFielderTouchTerritoryRuleInput = Readonly<{
  evidence: BattedBallFirstFielderTouchTerritory;
  field: FairTerritoryWedge;
}>;

export type FirstFielderTouchTerritoryRuleResult = Readonly<{
  territory: 'fair' | 'foul';
  decisiveTick: number;
  fielderId: string;
  ballCenter: BattedBallFirstFielderTouchTerritory['ballCenter'];
}>;

export const resolveFirstFielderTouchTerritory = (
  input: FirstFielderTouchTerritoryRuleInput,
): FirstFielderTouchTerritoryRuleResult => {
  const classification = classifyBallAgainstFairTerritory(
    input.field,
    {
      x: input.evidence.ballCenter.x,
      z: input.evidence.ballCenter.z,
    },
    input.evidence.ballRadiusMeters,
  );

  return {
    territory: classification.kind === 'inside_fair_wedge'
      ? 'fair'
      : 'foul',
    decisiveTick: input.evidence.tick,
    fielderId: input.evidence.fielderId,
    ballCenter: input.evidence.ballCenter,
  };
};
