import type { Vec2 } from '../model/geometry';
import type {
  BattedBallBaseGatePassage,
} from '../sim/ball/BattedBallBaseGatePassage';
import {
  classifyBallAgainstFairTerritory,
  type FairTerritoryWedge,
} from '../sim/ball/FairTerritoryGeometry';

export type UntouchedBaseGatePassageTerritoryInput = Readonly<{
  passage: BattedBallBaseGatePassage;
  field: FairTerritoryWedge;
  ballRadiusMeters: number;
  noPriorFielderTouch: true;
  noPriorFirstOrThirdBaseTouch: true;
}>;

export type UntouchedBaseGatePassageTerritoryResult = Readonly<{
  territory: 'fair' | 'foul';
  decisiveTick: number;
  decisivePosition: Vec2;
  beyond: BattedBallBaseGatePassage['beyond'];
}>;

export const resolveUntouchedBaseGatePassageTerritory = (
  input: UntouchedBaseGatePassageTerritoryInput,
): UntouchedBaseGatePassageTerritoryResult => {
  if (input.noPriorFielderTouch !== true) {
    throw new Error(
      'base-gate fair/foul resolution requires no prior fielder touch',
    );
  }
  if (input.noPriorFirstOrThirdBaseTouch !== true) {
    throw new Error(
      'base-gate fair/foul resolution requires no prior first/third-base touch',
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
  if (
    !input.passage.beyond.firstBase
    && !input.passage.beyond.thirdBase
  ) {
    throw new Error(
      'base-gate fair/foul resolution requires a passage beyond first or third',
    );
  }

  const decisivePosition = {
    x: input.passage.state.position.x,
    z: input.passage.state.position.z,
  };
  const classification = classifyBallAgainstFairTerritory(
    input.field,
    decisivePosition,
    input.ballRadiusMeters,
  );

  return {
    territory: classification.kind === 'inside_fair_wedge'
      ? 'fair'
      : 'foul',
    decisiveTick: input.passage.tick,
    decisivePosition,
    beyond: input.passage.beyond,
  };
};
