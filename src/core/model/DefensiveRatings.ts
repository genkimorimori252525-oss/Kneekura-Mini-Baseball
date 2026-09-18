import type {
  DefensivePosition,
} from './CanonicalWorldSnapshot';

export type NormalizedRating = number;

export type PositionSuitabilityMap = Readonly<
  Record<DefensivePosition, NormalizedRating>
>;

export type DefensiveRatings = Readonly<{
  positionSuitability: PositionSuitabilityMap;
  firstStep: NormalizedRating;
  acceleration: NormalizedRating;
  battedBallRead: NormalizedRating;
  routeEfficiency: NormalizedRating;
  catching: NormalizedRating;
  transfer: NormalizedRating;
  armStrength: NormalizedRating;
  throwingAccuracy: NormalizedRating;
  situationalAwareness: NormalizedRating;
  tagSkill: NormalizedRating;
}>;

export type DefensiveRatingsInput = Readonly<{
  positionSuitability: Readonly<
    Record<DefensivePosition, number>
  >;
  firstStep: number;
  acceleration: number;
  battedBallRead: number;
  routeEfficiency: number;
  catching: number;
  transfer: number;
  armStrength: number;
  throwingAccuracy: number;
  situationalAwareness: number;
  tagSkill: number;
}>;

const DEFENSIVE_POSITIONS = [
  'P',
  'C',
  '1B',
  '2B',
  '3B',
  'SS',
  'LF',
  'CF',
  'RF',
] as const satisfies readonly DefensivePosition[];

export const createNormalizedRating = (
  value: number,
): NormalizedRating => {
  if (
    !Number.isFinite(value)
    || value < 0
    || value > 1
  ) {
    throw new Error(
      'rating must be finite and within [0, 1]',
    );
  }
  return value;
};

const createPositionSuitabilityMap = (
  input: DefensiveRatingsInput['positionSuitability'],
): PositionSuitabilityMap => {
  const record = input as Readonly<Record<string, unknown>>;
  if (
    DEFENSIVE_POSITIONS.some(
      (position) => !Object.prototype.hasOwnProperty.call(
        record,
        position,
      ),
    )
  ) {
    throw new Error(
      'positionSuitability must explicitly contain all nine defensive positions',
    );
  }

  return Object.freeze(
    Object.fromEntries(
      DEFENSIVE_POSITIONS.map((position) => [
        position,
        createNormalizedRating(
          input[position],
        ),
      ]),
    ) as Record<DefensivePosition, NormalizedRating>,
  );
};

export const createDefensiveRatings = (
  input: DefensiveRatingsInput,
): DefensiveRatings => ({
  positionSuitability:
    createPositionSuitabilityMap(
      input.positionSuitability,
    ),
  firstStep: createNormalizedRating(input.firstStep),
  acceleration:
    createNormalizedRating(input.acceleration),
  battedBallRead:
    createNormalizedRating(input.battedBallRead),
  routeEfficiency:
    createNormalizedRating(input.routeEfficiency),
  catching: createNormalizedRating(input.catching),
  transfer: createNormalizedRating(input.transfer),
  armStrength:
    createNormalizedRating(input.armStrength),
  throwingAccuracy:
    createNormalizedRating(input.throwingAccuracy),
  situationalAwareness:
    createNormalizedRating(input.situationalAwareness),
  tagSkill: createNormalizedRating(input.tagSkill),
});
