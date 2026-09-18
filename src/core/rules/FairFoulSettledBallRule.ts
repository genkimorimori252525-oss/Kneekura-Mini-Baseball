import type { Vec2 } from '../model/geometry';
import {
  classifyPointBeyondFirstThirdBaseGates,
  type FairFoulBaseGateGeometry,
} from '../sim/ball/FairFoulBaseGateGeometry';
import {
  classifyBallAgainstFairTerritory,
  type FairTerritoryWedge,
} from '../sim/ball/FairTerritoryGeometry';
import type {
  BattedBallSettlingEvidence,
} from '../sim/ball/BattedBallSettlingEvidence';

export type UntouchedSettledBattedBallTerritoryInput = Readonly<{
  settling: BattedBallSettlingEvidence;
  field: FairTerritoryWedge;
  bases: FairFoulBaseGateGeometry;
  ballRadiusMeters: number;
  noPriorFielderTouch: true;
  noPriorFirstOrThirdBaseTouch: true;
  noPriorBaseGatePassage: true;
}>;

export type UntouchedSettledBattedBallTerritoryResult = Readonly<{
  territory: 'fair' | 'foul';
  decisiveTick: number;
  decisivePosition: Vec2;
}>;

export const resolveUntouchedSettledBattedBallTerritory = (
  input: UntouchedSettledBattedBallTerritoryInput,
): UntouchedSettledBattedBallTerritoryResult => {
  if (input.noPriorFielderTouch !== true) {
    throw new Error(
      'settled-ball fair/foul resolution requires no prior fielder touch',
    );
  }
  if (input.noPriorFirstOrThirdBaseTouch !== true) {
    throw new Error(
      'settled-ball fair/foul resolution requires no prior first/third-base touch',
    );
  }
  if (input.noPriorBaseGatePassage !== true) {
    throw new Error(
      'settled-ball fair/foul resolution requires no prior base-gate passage',
    );
  }
  if (
    !Number.isFinite(input.ballRadiusMeters)
    || input.ballRadiusMeters <= 0
  ) {
    throw new Error(
      'ballRadiusMeters must be finite and positive',
    );
  }

  const decisivePosition = {
    x: input.settling.state.position.x,
    z: input.settling.state.position.z,
  };
  const beyond = classifyPointBeyondFirstThirdBaseGates(
    input.bases,
    decisivePosition,
  );
  if (beyond.firstBase || beyond.thirdBase) {
    throw new Error(
      'settled-ball fair/foul resolution requires the ball to remain before both base gates',
    );
  }

  const classification = classifyBallAgainstFairTerritory(
    input.field,
    decisivePosition,
    input.ballRadiusMeters,
  );

  return {
    territory: classification.kind === 'inside_fair_wedge'
      ? 'fair'
      : 'foul',
    decisiveTick: input.settling.tick,
    decisivePosition,
  };
};
