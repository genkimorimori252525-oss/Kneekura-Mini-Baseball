import {
  classifyPitchMovementDirection,
  type PitchMovementDirectionFamily,
  type PitchMovementSignature,
} from './PitchMovementSignature';
import {
  registerNearestPitchName,
  type PitchNameRegistration,
  type PitchNameRegistry,
} from './PitchNameRegistry';

export type PitchArsenalPhysicalSummary = Readonly<{
  samples: number;
  meanInducedHorizontalM: number;
  meanInducedVerticalM: number;
  horizontalStdDevM: number;
  verticalStdDevM: number;
  meanReleaseSpeedMps: number;
  releaseSpeedStdDevMps: number;
  meanPlateSpeedMps: number;
  meanSpinRadPerSecond: number;
  meanActiveSpinFractionAtRelease: number;
  meanActiveSpinFractionAtPlate: number;
  directionFamily: PitchMovementDirectionFamily;
}>;

export type PitchArsenalEntry = Readonly<{
  /**
   * Stable internal identity for a learned/release-intent cluster.
   * Physics never branches on the registered pitch name.
   */
  pitchSkillId: string;
  physical: PitchArsenalPhysicalSummary;
  registeredName: PitchNameRegistration;
}>;

export type PitcherPitchArsenalProfile = Readonly<{
  pitcherId: string;
  registryVersion: string;
  pitches: readonly PitchArsenalEntry[];
}>;

export type BuildPitchArsenalEntryInput = Readonly<{
  pitchSkillId: string;
  samples: readonly PitchMovementSignature[];
  registry: PitchNameRegistry;
}>;

const mean = (
  values: readonly number[],
): number => (
  values.reduce(
    (sum, value) => sum + value,
    0,
  ) / values.length
);

const standardDeviation = (
  values: readonly number[],
  average: number,
): number => Math.sqrt(
  values.reduce(
    (sum, value) => {
      const delta = value - average;
      return sum + delta * delta;
    },
    0,
  ) / values.length,
);

const assertFiniteSamples = (
  samples: readonly PitchMovementSignature[],
): void => {
  for (const sample of samples) {
    for (const value of [
      sample.inducedHorizontalM,
      sample.inducedVerticalM,
      sample.releaseSpeedMps,
      sample.plateSpeedMps,
      sample.totalSpinRadPerSecond,
      sample.activeSpinFractionAtRelease,
      sample.activeSpinFractionAtPlate,
    ]) {
      if (!Number.isFinite(value)) {
        throw new Error(
          'pitch arsenal samples must contain only finite values',
        );
      }
    }
  }
};

export const buildPitchArsenalEntry = (
  input: BuildPitchArsenalEntryInput,
): PitchArsenalEntry => {
  if (input.pitchSkillId.length === 0) {
    throw new Error(
      'pitchSkillId must not be empty',
    );
  }
  if (input.samples.length === 0) {
    throw new Error(
      'pitch arsenal entry requires at least one physical sample',
    );
  }
  assertFiniteSamples(input.samples);

  const horizontal = input.samples.map(
    (sample) => sample.inducedHorizontalM,
  );
  const vertical = input.samples.map(
    (sample) => sample.inducedVerticalM,
  );
  const releaseSpeeds = input.samples.map(
    (sample) => sample.releaseSpeedMps,
  );

  const meanInducedHorizontalM =
    mean(horizontal);
  const meanInducedVerticalM =
    mean(vertical);
  const meanReleaseSpeedMps =
    mean(releaseSpeeds);

  const physical: PitchArsenalPhysicalSummary = {
    samples: input.samples.length,
    meanInducedHorizontalM,
    meanInducedVerticalM,
    horizontalStdDevM:
      standardDeviation(
        horizontal,
        meanInducedHorizontalM,
      ),
    verticalStdDevM:
      standardDeviation(
        vertical,
        meanInducedVerticalM,
      ),
    meanReleaseSpeedMps,
    releaseSpeedStdDevMps:
      standardDeviation(
        releaseSpeeds,
        meanReleaseSpeedMps,
      ),
    meanPlateSpeedMps: mean(
      input.samples.map(
        (sample) => sample.plateSpeedMps,
      ),
    ),
    meanSpinRadPerSecond: mean(
      input.samples.map(
        (sample) =>
          sample.totalSpinRadPerSecond,
      ),
    ),
    meanActiveSpinFractionAtRelease:
      mean(
        input.samples.map(
          (sample) =>
            sample.activeSpinFractionAtRelease,
        ),
      ),
    meanActiveSpinFractionAtPlate:
      mean(
        input.samples.map(
          (sample) =>
            sample.activeSpinFractionAtPlate,
        ),
      ),
    directionFamily:
      classifyPitchMovementDirection(
        meanInducedHorizontalM,
        meanInducedVerticalM,
        input.registry.neutralThresholdM,
      ),
  };

  const registeredName =
    registerNearestPitchName(
      {
        inducedHorizontalM:
          physical.meanInducedHorizontalM,
        inducedVerticalM:
          physical.meanInducedVerticalM,
        directionFamily:
          physical.directionFamily,
      },
      input.registry,
    );

  return {
    pitchSkillId: input.pitchSkillId,
    physical,
    registeredName,
  };
};

export const buildPitcherPitchArsenalProfile = (
  pitcherId: string,
  entries: readonly PitchArsenalEntry[],
  registryVersion: string,
): PitcherPitchArsenalProfile => {
  if (pitcherId.length === 0) {
    throw new Error(
      'pitcherId must not be empty',
    );
  }
  if (registryVersion.length === 0) {
    throw new Error(
      'registryVersion must not be empty',
    );
  }

  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.pitchSkillId)) {
      throw new Error(
        'pitch arsenal pitchSkillId values must be unique per pitcher',
      );
    }
    if (
      entry.registeredName.registryVersion
      !== registryVersion
    ) {
      throw new Error(
        'all pitch arsenal names must use the profile registryVersion',
      );
    }
    seen.add(entry.pitchSkillId);
  }

  return {
    pitcherId,
    registryVersion,
    pitches: [...entries],
  };
};
