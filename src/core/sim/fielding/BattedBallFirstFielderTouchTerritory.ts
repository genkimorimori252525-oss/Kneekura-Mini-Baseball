import type { Vec3 } from '../../model/geometry';
import type {
  FairTerritoryPointClassification,
  FairTerritoryWedge,
} from '../ball/FairTerritoryGeometry';
import {
  classifyBallAgainstFairTerritory,
} from '../ball/FairTerritoryGeometry';
import type {
  CatchRetentionContact,
} from './CatchRetention';

export type BattedBallFirstFielderTouchTerritory = Readonly<{
  fielderId: string;
  tick: number;
  ballCenter: Vec3;
  ballRadiusMeters: number;
  classification: FairTerritoryPointClassification;
}>;

export type BattedBallFirstFielderTouchTerritoryInput = Readonly<{
  fielderId: string;
  contact: CatchRetentionContact;
  field: FairTerritoryWedge;
  ballRadiusMeters: number;
  isFirstFielderTouch: true;
}>;

export const createBattedBallFirstFielderTouchTerritory = (
  input: BattedBallFirstFielderTouchTerritoryInput,
): BattedBallFirstFielderTouchTerritory => {
  if (input.fielderId.length === 0) {
    throw new Error('fielderId must not be empty');
  }
  if (
    !Number.isFinite(input.ballRadiusMeters)
    || input.ballRadiusMeters <= 0
  ) {
    throw new Error(
      'ballRadiusMeters must be finite and positive',
    );
  }
  if (input.isFirstFielderTouch !== true) {
    throw new Error(
      'batted-ball territory evidence requires first fielder touch',
    );
  }
  if (
    input.contact.ball.tick !== input.contact.contactTick
    || input.contact.glove.tick !== input.contact.contactTick
  ) {
    throw new Error(
      'fielder-touch contact must be sampled at contactTick',
    );
  }

  const ballCenter = input.contact.ball.position;

  return {
    fielderId: input.fielderId,
    tick: input.contact.contactTick,
    ballCenter,
    ballRadiusMeters: input.ballRadiusMeters,
    classification: classifyBallAgainstFairTerritory(
      input.field,
      {
        x: ballCenter.x,
        z: ballCenter.z,
      },
      input.ballRadiusMeters,
    ),
  };
};
