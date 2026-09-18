import type {
  DefensivePosition,
} from '../model/CanonicalWorldSnapshot';
import type {
  DefenderFootPlacementFact,
} from './DefensiveAlignmentFacts';
import {
  isFootDiscFullyInsideInfieldBoundary,
  type InfieldBoundaryRegion,
} from './InfieldBoundaryRegion';

export type InfieldBoundaryPlacement = Readonly<{
  playerId: string;
  registeredPosition: '1B' | '2B' | '3B' | 'SS';
  leftFootFullyInside: boolean;
  rightFootFullyInside: boolean;
}>;

export type PitchingMotionInfieldBoundaryParameters = Readonly<{
  requiredInfielderCount: number;
  footContactRadiusMeters: number;
}>;

export type PitchingMotionInfieldBoundaryInput = Readonly<{
  pitchingRelatedMotionStartTick: number;
  facts: readonly DefenderFootPlacementFact[];
  boundary: InfieldBoundaryRegion;
  parameters: PitchingMotionInfieldBoundaryParameters;
}>;

export type PitchingMotionInfieldBoundaryResult = Readonly<{
  kind: 'legal' | 'violation';
  pitchingRelatedMotionStartTick: number;
  invalidInfielders: readonly string[];
  placements: readonly InfieldBoundaryPlacement[];
}>;

const REQUIRED_INFIELD_POSITIONS = [
  '1B',
  '2B',
  '3B',
  'SS',
] as const;

const isRegisteredInfielder = (
  position: DefensivePosition,
): position is typeof REQUIRED_INFIELD_POSITIONS[number] => (
  REQUIRED_INFIELD_POSITIONS.includes(
    position as typeof REQUIRED_INFIELD_POSITIONS[number],
  )
);

const validateInput = (
  input: PitchingMotionInfieldBoundaryInput,
  infielders: readonly DefenderFootPlacementFact[],
): void => {
  if (
    !Number.isSafeInteger(input.pitchingRelatedMotionStartTick)
    || input.pitchingRelatedMotionStartTick < 0
  ) {
    throw new Error(
      'pitchingRelatedMotionStartTick must be a non-negative safe integer',
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
    !Number.isFinite(input.parameters.footContactRadiusMeters)
    || input.parameters.footContactRadiusMeters < 0
  ) {
    throw new Error(
      'footContactRadiusMeters must be finite and non-negative',
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
      'infield-boundary alignment requires exactly one 1B, 2B, 3B, and SS',
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
      'infield-boundary alignment requires exactly one 1B, 2B, 3B, and SS',
    );
  }

  const ids = infielders.map((fact) => fact.playerId);
  if (new Set(ids).size !== ids.length) {
    throw new Error(
      'infield-boundary infielders must have unique player ids',
    );
  }

  if (
    infielders.some(
      (fact) => fact.tick !== input.pitchingRelatedMotionStartTick,
    )
  ) {
    throw new Error(
      'all infield foot placements must be sampled at pitchingRelatedMotionStartTick',
    );
  }
};

export const evaluatePitchingMotionInfieldBoundary = (
  input: PitchingMotionInfieldBoundaryInput,
): PitchingMotionInfieldBoundaryResult => {
  const infielders = input.facts.filter(
    (fact) => isRegisteredInfielder(fact.registeredPosition),
  );
  validateInput(input, infielders);

  const placements: InfieldBoundaryPlacement[] = infielders.map(
    (fact) => ({
      playerId: fact.playerId,
      registeredPosition: fact.registeredPosition as
        | '1B'
        | '2B'
        | '3B'
        | 'SS',
      leftFootFullyInside: isFootDiscFullyInsideInfieldBoundary(
        input.boundary,
        fact.leftFoot,
        input.parameters.footContactRadiusMeters,
      ),
      rightFootFullyInside: isFootDiscFullyInsideInfieldBoundary(
        input.boundary,
        fact.rightFoot,
        input.parameters.footContactRadiusMeters,
      ),
    }),
  );

  const invalidInfielders = placements
    .filter(
      (placement) => (
        !placement.leftFootFullyInside
        || !placement.rightFootFullyInside
      ),
    )
    .map((placement) => placement.playerId);

  return {
    kind: invalidInfielders.length === 0 ? 'legal' : 'violation',
    pitchingRelatedMotionStartTick:
      input.pitchingRelatedMotionStartTick,
    invalidInfielders,
    placements,
  };
};
