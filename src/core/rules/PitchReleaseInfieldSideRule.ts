import type {
  DefensivePosition,
} from '../model/CanonicalWorldSnapshot';
import type { Vec2 } from '../model/geometry';
import type {
  DefenderFootPlacementFact,
  SecondBaseDivisionReference,
} from './DefensiveAlignmentFacts';

export type InfieldSide =
  | 'first_base_side'
  | 'third_base_side'
  | 'straddling_or_on_division';

export type InfieldSidePlacement = Readonly<{
  playerId: string;
  registeredPosition: '1B' | '2B' | '3B' | 'SS';
  side: InfieldSide;
}>;

export type PitchReleaseInfieldSideParameters = Readonly<{
  requiredInfielderCount: number;
  minimumInfieldersEachSideOfSecondBase: number;
}>;

export type PitchReleaseInfieldSideResult = Readonly<{
  kind: 'legal' | 'violation';
  pitchReleaseTick: number;
  firstBaseSideCount: number;
  thirdBaseSideCount: number;
  invalidInfielders: readonly string[];
  placements: readonly InfieldSidePlacement[];
}>;

export type PitchReleaseInfieldSideInput = Readonly<{
  pitchReleaseTick: number;
  facts: readonly DefenderFootPlacementFact[];
  reference: SecondBaseDivisionReference;
  parameters: PitchReleaseInfieldSideParameters;
}>;

const REQUIRED_INFIELD_POSITIONS = [
  '1B',
  '2B',
  '3B',
  'SS',
] as const;

const DIVISION_EPSILON_METERS = 1e-9;

const isRegisteredInfielder = (
  position: DefensivePosition,
): position is typeof REQUIRED_INFIELD_POSITIONS[number] => (
  REQUIRED_INFIELD_POSITIONS.includes(
    position as typeof REQUIRED_INFIELD_POSITIONS[number],
  )
);

const signedSideDistance = (
  point: Vec2,
  reference: SecondBaseDivisionReference,
): number => (
  (point.x - reference.secondBaseCenter.x)
    * reference.firstBaseSideUnit.x
  + (point.z - reference.secondBaseCenter.z)
    * reference.firstBaseSideUnit.z
);

const classify = (
  fact: DefenderFootPlacementFact,
  reference: SecondBaseDivisionReference,
): InfieldSide => {
  const left = signedSideDistance(fact.leftFoot, reference);
  const right = signedSideDistance(fact.rightFoot, reference);

  if (
    left > DIVISION_EPSILON_METERS
    && right > DIVISION_EPSILON_METERS
  ) {
    return 'first_base_side';
  }
  if (
    left < -DIVISION_EPSILON_METERS
    && right < -DIVISION_EPSILON_METERS
  ) {
    return 'third_base_side';
  }
  return 'straddling_or_on_division';
};

const validateInput = (
  input: PitchReleaseInfieldSideInput,
  infielders: readonly DefenderFootPlacementFact[],
): void => {
  if (
    !Number.isSafeInteger(input.pitchReleaseTick)
    || input.pitchReleaseTick < 0
  ) {
    throw new Error(
      'pitchReleaseTick must be a non-negative safe integer',
    );
  }
  if (
    !Number.isInteger(input.parameters.requiredInfielderCount)
    || input.parameters.requiredInfielderCount <= 0
  ) {
    throw new Error(
      'requiredInfielderCount must be a positive integer',
    );
  }
  if (
    !Number.isInteger(
      input.parameters.minimumInfieldersEachSideOfSecondBase,
    )
    || input.parameters.minimumInfieldersEachSideOfSecondBase < 0
  ) {
    throw new Error(
      'minimumInfieldersEachSideOfSecondBase must be a non-negative integer',
    );
  }

  if (
    input.parameters.requiredInfielderCount
    !== REQUIRED_INFIELD_POSITIONS.length
  ) {
    throw new Error(
      'this evaluator requires the four registered infield positions',
    );
  }

  if (infielders.length !== input.parameters.requiredInfielderCount) {
    throw new Error(
      'pitch-release alignment requires exactly one 1B, 2B, 3B, and SS',
    );
  }

  const positions = new Set(
    infielders.map((fact) => fact.registeredPosition),
  );
  if (
    REQUIRED_INFIELD_POSITIONS.some(
      (position) => !positions.has(position),
    )
  ) {
    throw new Error(
      'pitch-release alignment requires exactly one 1B, 2B, 3B, and SS',
    );
  }

  const ids = infielders.map((fact) => fact.playerId);
  if (new Set(ids).size !== ids.length) {
    throw new Error(
      'pitch-release infielders must have unique player ids',
    );
  }

  if (
    infielders.some(
      (fact) => fact.tick !== input.pitchReleaseTick,
    )
  ) {
    throw new Error(
      'all infield foot placements must be sampled at pitchReleaseTick',
    );
  }
};

export const evaluatePitchReleaseInfieldSide = (
  input: PitchReleaseInfieldSideInput,
): PitchReleaseInfieldSideResult => {
  const infielders = input.facts.filter(
    (fact) => isRegisteredInfielder(fact.registeredPosition),
  );

  validateInput(input, infielders);

  const placements: InfieldSidePlacement[] = infielders.map(
    (fact) => ({
      playerId: fact.playerId,
      registeredPosition: fact.registeredPosition as
        | '1B'
        | '2B'
        | '3B'
        | 'SS',
      side: classify(fact, input.reference),
    }),
  );

  const firstBaseSideCount = placements.filter(
    (placement) => placement.side === 'first_base_side',
  ).length;
  const thirdBaseSideCount = placements.filter(
    (placement) => placement.side === 'third_base_side',
  ).length;
  const invalidInfielders = placements
    .filter(
      (placement) => (
        placement.side === 'straddling_or_on_division'
      ),
    )
    .map((placement) => placement.playerId);

  const minimum = (
    input.parameters.minimumInfieldersEachSideOfSecondBase
  );
  const legal = (
    invalidInfielders.length === 0
    && firstBaseSideCount >= minimum
    && thirdBaseSideCount >= minimum
  );

  return {
    kind: legal ? 'legal' : 'violation',
    pitchReleaseTick: input.pitchReleaseTick,
    firstBaseSideCount,
    thirdBaseSideCount,
    invalidInfielders,
    placements,
  };
};
