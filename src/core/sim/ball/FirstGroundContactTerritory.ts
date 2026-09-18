import type { Vec2 } from '../../model/geometry';
import type {
  BattedBallFlightEvidence,
} from './BattedBallFlightEvidence';
import {
  classifyBallAgainstFairTerritory,
  type FairTerritoryPointClassification,
  type FairTerritoryWedge,
} from './FairTerritoryGeometry';

export type FirstGroundContactTerritory = Readonly<{
  tick: number;
  position: Vec2;
  classification: FairTerritoryPointClassification;
}>;

export const classifyFirstGroundContactTerritory = (
  evidence: BattedBallFlightEvidence,
  field: FairTerritoryWedge,
): FirstGroundContactTerritory | null => {
  if (evidence.firstGroundContact === null) {
    return null;
  }

  const position: Vec2 = {
    x: evidence.firstGroundContact.state.position.x,
    z: evidence.firstGroundContact.state.position.z,
  };

  return {
    tick: evidence.firstGroundContact.tick,
    position,
    classification: classifyBallAgainstFairTerritory(
      field,
      position,
      evidence.ballRadiusMeters,
    ),
  };
};
