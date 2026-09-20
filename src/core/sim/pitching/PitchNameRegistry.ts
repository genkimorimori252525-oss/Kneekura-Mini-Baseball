import {
  classifyPitchMovementDirection,
  type PitchMovementDirectionFamily,
  type PitchMovementSignature,
} from './PitchMovementSignature';

export type PitchNameCalibrationSample = Readonly<{
  pitchNameId: string;
  displayName: string;
  signature: Pick<
    PitchMovementSignature,
    'inducedHorizontalM' | 'inducedVerticalM'
  >;
}>;

export type PitchNameArchetype = Readonly<{
  pitchNameId: string;
  displayName: string;
  inducedHorizontalM: number;
  inducedVerticalM: number;
  directionFamily: PitchMovementDirectionFamily;
  calibrationSamples: number;
}>;

export type PitchNameHorizontalFrame =
  | 'core_world_x'
  | 'pitcher_arm_side_positive';

export type PitchNameRegistry = Readonly<{
  version: string;
  neutralThresholdM: number;
  horizontalFrame: PitchNameHorizontalFrame;
  archetypes: readonly PitchNameArchetype[];
}>;

export type PitchNameRegistration = Readonly<{
  pitchNameId: string;
  displayName: string;
  registryVersion: string;
  horizontalFrame: PitchNameHorizontalFrame;
  directionFamily: PitchMovementDirectionFamily;
  movementDistanceM: number;
  secondBestDistanceM: number | null;
  separationMarginM: number | null;
  classificationMethod:
    'nearest_movement_centroid_with_direction_gate';
}>;

const validateFinite = (
  name: string,
  value: number,
): void => {
  if (!Number.isFinite(value)) {
    throw new Error(
      `${name} must be finite`,
    );
  }
};

const validatePositiveOrZero = (
  name: string,
  value: number,
): void => {
  validateFinite(name, value);
  if (value < 0) {
    throw new Error(
      `${name} must be non-negative`,
    );
  }
};

export const calibratePitchNameRegistry = (
  version: string,
  samples: readonly PitchNameCalibrationSample[],
  neutralThresholdM: number = 0.01,
  horizontalFrame: PitchNameHorizontalFrame =
    'core_world_x',
): PitchNameRegistry => {
  if (version.length === 0) {
    throw new Error(
      'pitch name registry version must not be empty',
    );
  }
  validatePositiveOrZero(
    'neutralThresholdM',
    neutralThresholdM,
  );
  if (samples.length === 0) {
    throw new Error(
      'pitch name registry calibration requires samples',
    );
  }

  const groups = new Map<
    string,
    {
      displayName: string;
      horizontalSum: number;
      verticalSum: number;
      count: number;
    }
  >();

  for (const sample of samples) {
    if (sample.pitchNameId.length === 0) {
      throw new Error(
        'pitchNameId must not be empty',
      );
    }
    if (sample.displayName.length === 0) {
      throw new Error(
        'pitch displayName must not be empty',
      );
    }
    validateFinite(
      'calibration inducedHorizontalM',
      sample.signature.inducedHorizontalM,
    );
    validateFinite(
      'calibration inducedVerticalM',
      sample.signature.inducedVerticalM,
    );

    const existing = groups.get(
      sample.pitchNameId,
    );
    if (
      existing !== undefined
      && existing.displayName !== sample.displayName
    ) {
      throw new Error(
        'one pitchNameId must use one displayName inside a registry version',
      );
    }

    const group = existing ?? {
      displayName: sample.displayName,
      horizontalSum: 0,
      verticalSum: 0,
      count: 0,
    };
    group.horizontalSum +=
      sample.signature.inducedHorizontalM;
    group.verticalSum +=
      sample.signature.inducedVerticalM;
    group.count += 1;
    groups.set(
      sample.pitchNameId,
      group,
    );
  }

  const archetypes = [...groups.entries()]
    .map(([pitchNameId, group]) => {
      const inducedHorizontalM =
        group.horizontalSum / group.count;
      const inducedVerticalM =
        group.verticalSum / group.count;

      return {
        pitchNameId,
        displayName: group.displayName,
        inducedHorizontalM,
        inducedVerticalM,
        directionFamily:
          classifyPitchMovementDirection(
            inducedHorizontalM,
            inducedVerticalM,
            neutralThresholdM,
          ),
        calibrationSamples: group.count,
      } satisfies PitchNameArchetype;
    })
    .sort((a, b) =>
      a.pitchNameId.localeCompare(
        b.pitchNameId,
      ),
    );

  return {
    version,
    neutralThresholdM,
    horizontalFrame,
    archetypes,
  };
};

const movementDistance = (
  horizontalM: number,
  verticalM: number,
  archetype: PitchNameArchetype,
): number => Math.hypot(
  horizontalM - archetype.inducedHorizontalM,
  verticalM - archetype.inducedVerticalM,
);

export const registerNearestPitchName = (
  signature: Pick<
    PitchMovementSignature,
    | 'inducedHorizontalM'
    | 'inducedVerticalM'
    | 'directionFamily'
  >,
  registry: PitchNameRegistry,
): PitchNameRegistration => {
  if (registry.archetypes.length === 0) {
    throw new Error(
      'pitch name registry requires at least one archetype',
    );
  }

  validateFinite(
    'signature inducedHorizontalM',
    signature.inducedHorizontalM,
  );
  validateFinite(
    'signature inducedVerticalM',
    signature.inducedVerticalM,
  );

  const sameDirection =
    registry.archetypes.filter(
      (archetype) =>
        archetype.directionFamily
        === signature.directionFamily,
    );
  const candidates =
    sameDirection.length > 0
      ? sameDirection
      : registry.archetypes;

  const ranked = candidates
    .map((archetype) => ({
      archetype,
      distance: movementDistance(
        signature.inducedHorizontalM,
        signature.inducedVerticalM,
        archetype,
      ),
    }))
    .sort((a, b) => (
      a.distance - b.distance
      || a.archetype.pitchNameId.localeCompare(
        b.archetype.pitchNameId,
      )
    ));

  const best = ranked[0]!;
  const second = ranked[1] ?? null;

  return {
    pitchNameId:
      best.archetype.pitchNameId,
    displayName:
      best.archetype.displayName,
    registryVersion: registry.version,
    horizontalFrame: registry.horizontalFrame,
    directionFamily:
      signature.directionFamily,
    movementDistanceM: best.distance,
    secondBestDistanceM:
      second?.distance ?? null,
    separationMarginM:
      second === null
        ? null
        : second.distance - best.distance,
    classificationMethod:
      'nearest_movement_centroid_with_direction_gate',
  };
};
