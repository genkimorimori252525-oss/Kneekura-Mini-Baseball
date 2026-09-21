import {
  createCanonicalEvidenceFingerprint,
} from './CanonicalEvidenceFingerprint';

export type PhysicsObservableId =
  | 'normal_coefficient_of_restitution'
  | 'tangential_coefficient_of_restitution'
  | 'drag_coefficient'
  | 'lift_coefficient'
  | 'surface_pace_ratio'
  | 'rotational_inertia_factor'
  | 'pitch_plate_x_m'
  | 'pitch_plate_y_m'
  | 'pitch_plate_speed_mps'
  | 'exit_speed_mps'
  | 'launch_angle_rad'
  | 'spray_angle_rad'
  | 'spin_rate_rad_per_second'
  | 'hang_time_seconds'
  | 'apex_height_m'
  | 'landing_distance_m'
  | 'ground_rebound_speed_mps'
  | 'ground_transit_seconds'
  | 'roll_distance_m'
  | 'wall_rebound_speed_mps';

export type PhysicsObservableTarget = Readonly<{
  observableId: PhysicsObservableId;
  sourceId: string;
  sourceVersion: string;
  targetValue: number;
  absoluteTolerance?: number;
  relativeTolerance?: number;
}>;

export type PhysicsObservableMeasurement = Readonly<{
  observableId: PhysicsObservableId;
  observedValue: number;
}>;

export type PhysicsObservableEvaluation = Readonly<{
  observableId: PhysicsObservableId;
  sourceId: string;
  sourceVersion: string;
  observedValue: number;
  targetValue: number;
  residual: number;
  absoluteResidual: number;
  allowedAbsoluteResidual: number;
  passed: boolean;
}>;

export type PhysicsValidationCase = Readonly<{
  caseId: string;
  targets: readonly PhysicsObservableTarget[];
  measurements:
    readonly PhysicsObservableMeasurement[];
}>;

export type PhysicsValidationCaseResult = Readonly<{
  caseId: string;
  passed: boolean;
  evaluations:
    readonly PhysicsObservableEvaluation[];
  fingerprint: string;
}>;

const validateTolerance = (
  name: string,
  value: number | undefined,
): void => {
  if (
    value !== undefined
    && (
      !Number.isFinite(value)
      || value < 0
    )
  ) {
    throw new Error(
      `${name} must be finite and non-negative when provided`,
    );
  }
};

const validateTarget = (
  target: PhysicsObservableTarget,
): void => {
  if (target.sourceId.length === 0) {
    throw new Error(
      'physics observable sourceId must not be empty',
    );
  }
  if (
    target.sourceVersion.length === 0
  ) {
    throw new Error(
      'physics observable sourceVersion must not be empty',
    );
  }
  if (
    !Number.isFinite(
      target.targetValue,
    )
  ) {
    throw new Error(
      'physics observable targetValue must be finite',
    );
  }
  validateTolerance(
    'absoluteTolerance',
    target.absoluteTolerance,
  );
  validateTolerance(
    'relativeTolerance',
    target.relativeTolerance,
  );
  if (
    target.absoluteTolerance
      === undefined
    && target.relativeTolerance
      === undefined
  ) {
    throw new Error(
      'physics observable target requires an explicit tolerance',
    );
  }
};

const allowedResidual = (
  target: PhysicsObservableTarget,
): number => Math.max(
  target.absoluteTolerance ?? 0,
  (
    target.relativeTolerance ?? 0
  ) * Math.abs(target.targetValue),
);

export const evaluatePhysicsValidationCase = (
  validationCase: PhysicsValidationCase,
): PhysicsValidationCaseResult => {
  if (
    validationCase.caseId.length === 0
  ) {
    throw new Error(
      'physics validation caseId must not be empty',
    );
  }
  if (
    validationCase.targets.length === 0
  ) {
    throw new Error(
      'physics validation case requires targets',
    );
  }

  const targetsById =
    new Map<
      PhysicsObservableId,
      PhysicsObservableTarget
    >();
  for (
    const target
    of validationCase.targets
  ) {
    validateTarget(target);
    if (
      targetsById.has(
        target.observableId,
      )
    ) {
      throw new Error(
        'physics validation observable targets must be unique per case',
      );
    }
    targetsById.set(
      target.observableId,
      target,
    );
  }

  const measurementsById =
    new Map<
      PhysicsObservableId,
      PhysicsObservableMeasurement
    >();
  for (
    const measurement
    of validationCase.measurements
  ) {
    if (
      !Number.isFinite(
        measurement.observedValue,
      )
    ) {
      throw new Error(
        'physics observable observedValue must be finite',
      );
    }
    if (
      measurementsById.has(
        measurement.observableId,
      )
    ) {
      throw new Error(
        'physics validation measurements must be unique per case',
      );
    }
    measurementsById.set(
      measurement.observableId,
      measurement,
    );
  }

  const evaluations =
    validationCase.targets.map(
      (
        target,
      ): PhysicsObservableEvaluation => {
        const measurement =
          measurementsById.get(
            target.observableId,
          );
        if (
          measurement === undefined
        ) {
          throw new Error(
            `missing physics measurement for ${target.observableId}`,
          );
        }

        const residual =
          measurement.observedValue
          - target.targetValue;
        const absoluteResidual =
          Math.abs(residual);
        const allowedAbsoluteResidual =
          allowedResidual(target);

        return {
          observableId:
            target.observableId,
          sourceId:
            target.sourceId,
          sourceVersion:
            target.sourceVersion,
          observedValue:
            measurement.observedValue,
          targetValue:
            target.targetValue,
          residual,
          absoluteResidual,
          allowedAbsoluteResidual,
          passed:
            absoluteResidual
            <= allowedAbsoluteResidual,
        };
      },
    );

  const evidence = {
    caseId:
      validationCase.caseId,
    evaluations,
  };

  return {
    caseId:
      validationCase.caseId,
    passed:
      evaluations.every(
        (evaluation) =>
          evaluation.passed,
      ),
    evaluations,
    fingerprint:
      createCanonicalEvidenceFingerprint(
        evidence,
      ),
  };
};

export type PhysicsValidationCorpusResult = Readonly<{
  version: string;
  passed: boolean;
  cases:
    readonly PhysicsValidationCaseResult[];
  fingerprint: string;
}>;

export const evaluatePhysicsValidationCorpus = (
  version: string,
  cases: readonly PhysicsValidationCase[],
): PhysicsValidationCorpusResult => {
  if (version.length === 0) {
    throw new Error(
      'physics validation corpus version must not be empty',
    );
  }
  if (cases.length === 0) {
    throw new Error(
      'physics validation corpus requires cases',
    );
  }

  const seen = new Set<string>();
  const results = cases.map(
    (validationCase) => {
      if (
        seen.has(validationCase.caseId)
      ) {
        throw new Error(
          'physics validation caseIds must be unique',
        );
      }
      seen.add(validationCase.caseId);
      return evaluatePhysicsValidationCase(
        validationCase,
      );
    },
  );

  return {
    version,
    passed:
      results.every(
        (result) => result.passed,
      ),
    cases: results,
    fingerprint:
      createCanonicalEvidenceFingerprint({
        version,
        cases:
          results.map(
            (result) => ({
              caseId:
                result.caseId,
              fingerprint:
                result.fingerprint,
              passed:
                result.passed,
            }),
          ),
      }),
  };
};
