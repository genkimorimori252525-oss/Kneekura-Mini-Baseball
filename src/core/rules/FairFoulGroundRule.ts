import type { Vec2 } from '../model/geometry';
import {
  classifyPointAgainstFairTerritory,
  type FairTerritoryWedge,
} from '../sim/ball/FairTerritoryGeometry';
import {
  classifyPointBeyondFirstThirdBaseGates,
  type FairFoulBaseGateGeometry,
} from '../sim/ball/FairFoulBaseGateGeometry';
import type {
  FirstGroundContactTerritory,
} from '../sim/ball/FirstGroundContactTerritory';

export type {
  FairFoulBaseGateGeometry,
} from '../sim/ball/FairFoulBaseGateGeometry';

export type UntouchedGroundContactBeyondBasesInput = Readonly<{
  firstGroundContact: FirstGroundContactTerritory;
  field: FairTerritoryWedge;
  bases: FairFoulBaseGateGeometry;
  noPriorFielderTouch: true;
}>;

export type UntouchedGroundContactBeyondBasesResult =
  | Readonly<{
      kind: 'resolved';
      territory: 'fair' | 'foul';
      decisiveTick: number;
      decisivePosition: Vec2;
      beyond: Readonly<{
        firstBase: boolean;
        thirdBase: boolean;
      }>;
    }>
  | Readonly<{
      kind: 'not_decisive';
      reason:
        'first_ground_contact_not_beyond_first_or_third';
      beyond: Readonly<{
        firstBase: boolean;
        thirdBase: boolean;
      }>;
    }>;

export const resolveUntouchedGroundContactBeyondBases = (
  input: UntouchedGroundContactBeyondBasesInput,
): UntouchedGroundContactBeyondBasesResult => {
  if (input.noPriorFielderTouch !== true) {
    throw new Error(
      'ground-contact fair/foul resolution requires no prior fielder touch',
    );
  }

  validateVec2(
    'firstBase',
    input.bases.firstBase,
  );
  validateVec2(
    'secondBase',
    input.bases.secondBase,
  );
  validateVec2(
    'thirdBase',
    input.bases.thirdBase,
  );
  validateVec2(
    'firstGroundContact.position',
    input.firstGroundContact.position,
  );

  const point = input.firstGroundContact.position;
  const beyond = classifyPointBeyondFirstThirdBaseGates(
    {
      homePlate: input.field.homePlate,
      firstBase: input.bases.firstBase,
      secondBase: input.bases.secondBase,
      thirdBase: input.bases.thirdBase,
    },
    point,
  );
  const beyondFirstBase = beyond.firstBase;
  const beyondThirdBase = beyond.thirdBase;

  if (!beyondFirstBase && !beyondThirdBase) {
    return {
      kind: 'not_decisive',
      reason:
        'first_ground_contact_not_beyond_first_or_third',
      beyond,
    };
  }

  const territory = classifyPointAgainstFairTerritory(
    input.field,
    point,
  );

  return {
    kind: 'resolved',
    territory: territory.kind === 'inside_fair_wedge'
      ? 'fair'
      : 'foul',
    decisiveTick: input.firstGroundContact.tick,
    decisivePosition: point,
    beyond,
  };
};
