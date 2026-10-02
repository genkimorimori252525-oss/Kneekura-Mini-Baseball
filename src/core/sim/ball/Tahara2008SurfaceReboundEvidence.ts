export type Tahara2008HardBallSurfaceId =
  | 'previous_generation_artificial_turf'
  | 'fifth_generation_artificial_turf'
  | 'natural_turf';

export type Tahara2008HardBallSurfaceReboundEvidence =
  Readonly<{
    surfaceId:
      Tahara2008HardBallSurfaceId;
    reboundHeightM:
      number;
    reboundHeightStdDevM:
      number;
    normalRepulsionCoefficient:
      number;
    normalRepulsionCoefficientStdDev:
      number;
    source:
      string;
    sourceYear:
      number;
    note:
      string;
  }>;

/**
 * Tahara et al., ISBS 2008.
 *
 * Hard baseball, vertical rebound experiments:
 * - previous-generation artificial turf;
 * - fifth-generation artificial turf;
 * - natural turf.
 *
 * The paper reports both free-fall rebound height and a separately measured
 * perpendicular coefficient of repulsion. These are retained as direct
 * normal-response evidence, not converted into Pennbounce total-speed pace.
 */
export const TAHARA_2008_HARD_BALL_SURFACE_REBOUND_EVIDENCE:
  readonly Tahara2008HardBallSurfaceReboundEvidence[] =
  Object.freeze([
    {
      surfaceId:
        'previous_generation_artificial_turf',
      reboundHeightM: 0.46,
      reboundHeightStdDevM: 0.04,
      normalRepulsionCoefficient:
        0.29,
      normalRepulsionCoefficientStdDev:
        0.02,
      source:
        'Tahara et al. 2008, ISBS Conference Proceedings, Rebound Characteristics of Baseball in Different Surfaces',
      sourceYear: 2008,
      note:
        'Previous-generation artificial turf (NewGTB-16); hard-ball result.',
    },
    {
      surfaceId:
        'fifth_generation_artificial_turf',
      reboundHeightM: 0.33,
      reboundHeightStdDevM: 0.04,
      normalRepulsionCoefficient:
        0.25,
      normalRepulsionCoefficientStdDev:
        0.02,
      source:
        'Tahara et al. 2008, ISBS Conference Proceedings, Rebound Characteristics of Baseball in Different Surfaces',
      sourceYear: 2008,
      note:
        'Fifth-generation artificial turf (MONDTURF); hard-ball result.',
    },
    {
      surfaceId:
        'natural_turf',
      reboundHeightM: 0.19,
      reboundHeightStdDevM: 0.06,
      normalRepulsionCoefficient:
        0.13,
      normalRepulsionCoefficientStdDev:
        0.01,
      source:
        'Tahara et al. 2008, ISBS Conference Proceedings, Rebound Characteristics of Baseball in Different Surfaces',
      sourceYear: 2008,
      note:
        'Natural turf (Viktor); hard-ball result. The study warns that underlying base construction strongly affects ball behavior.',
    },
  ]);

export const findTahara2008HardBallSurfaceReboundEvidence = (
  surfaceId:
    Tahara2008HardBallSurfaceId,
): Tahara2008HardBallSurfaceReboundEvidence => {
  const result =
    TAHARA_2008_HARD_BALL_SURFACE_REBOUND_EVIDENCE
      .find(
        (entry) =>
          entry.surfaceId
          === surfaceId,
      );

  if (result === undefined) {
    throw new Error(
      `missing Tahara 2008 hard-ball surface evidence: ${surfaceId}`,
    );
  }

  return result;
};
