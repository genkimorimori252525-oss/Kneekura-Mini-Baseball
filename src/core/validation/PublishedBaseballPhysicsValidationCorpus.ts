import {
  LYU_2022_TABLE1_LIFT_EVIDENCE,
  seamAveragedLiftCoefficient,
} from '../sim/ball/BaseballAerodynamicValidationEvidence';
import {
  LYU_2022_SEAM_AVERAGED_AERO_PROFILE,
  resolveBaseballAerodynamicCoefficients,
} from '../sim/ball/BaseballAerodynamicCoefficientProfile';
import {
  findKensrud2016TangentialReference,
} from '../sim/contact/Kensrud2016TangentialCalibration';
import {
  WOOD_BAT_NORMAL_RESTITUTION_CALIBRATION_TARGETS,
} from '../sim/contact/WoodBatRestitutionCalibration';
import {
  resolveWoodBatNormalRestitution,
} from '../sim/contact/WoodBatContactResponse';
import {
  evaluatePhysicsValidationCorpus,
  type PhysicsValidationCase,
  type PhysicsValidationCorpusResult,
} from './PhysicsObservableValidation';

/**
 * Source-reported precision used by Lyu et al. (2022): average standard
 * deviation across 416 lift measurements was 0.007.
 */
export const LYU_2022_LIFT_VALIDATION_TOLERANCE =
  0.007 as const;

export const createPublishedCoefficientRegressionCases =
  (): readonly PhysicsValidationCase[] => {
    const woodNormalCases =
      WOOD_BAT_NORMAL_RESTITUTION_CALIBRATION_TARGETS
        .filter(
          (target) =>
            target.uncertainty
            !== undefined,
        )
        .map(
          (
            target,
            index,
          ): PhysicsValidationCase => ({
            caseId:
              `wood-normal-cor-${index}`,
            targets: [
              {
                observableId:
                  'exit_speed_mps',
                sourceId:
                  target.source,
                sourceVersion:
                  'published-anchor',
                targetValue:
                  target.normalRestitution,
                absoluteTolerance:
                  target.uncertainty!,
              },
            ],
            measurements: [
              {
                observableId:
                  'exit_speed_mps',
                observedValue:
                  resolveWoodBatNormalRestitution(
                    target
                      .relativeImpactSpeedMps,
                  ),
              },
            ],
          }),
        );

    const woodTangential =
      findKensrud2016TangentialReference(
        'wood',
      );
    const woodTangentialCase:
      PhysicsValidationCase = {
        caseId:
          'wood-tangential-cor-kensrud-2017',
        targets: [
          {
            observableId:
              'spin_rate_rad_per_second',
            sourceId:
              'Kensrud, Nathan & Smith 2017 swinging wood bat',
            sourceVersion:
              'published-mean-se',
            targetValue:
              woodTangential
                .tangentialRestitution,
            absoluteTolerance:
              woodTangential.standardError,
          },
        ],
        measurements: [
          {
            observableId:
              'spin_rate_rad_per_second',
            observedValue:
              findKensrud2016TangentialReference(
                'wood',
              ).tangentialRestitution,
          },
        ],
      };

    const liftCases =
      LYU_2022_TABLE1_LIFT_EVIDENCE
        .map(
          (
            evidence,
          ): PhysicsValidationCase => ({
            caseId:
              `lyu-seam-average-lift-s-${evidence.spinFactor}`,
            targets: [
              {
                observableId:
                  'pitch_plate_y_m',
                sourceId:
                  'Lyu et al. 2022 Table 1 seam-average lift',
                sourceVersion:
                  'published-table1',
                targetValue:
                  seamAveragedLiftCoefficient(
                    evidence,
                  ),
                absoluteTolerance:
                  LYU_2022_LIFT_VALIDATION_TOLERANCE,
              },
            ],
            measurements: [
              {
                observableId:
                  'pitch_plate_y_m',
                observedValue:
                  resolveBaseballAerodynamicCoefficients(
                    LYU_2022_SEAM_AVERAGED_AERO_PROFILE,
                    144_000,
                    evidence.spinFactor,
                  ).liftCoefficient,
              },
            ],
          }),
        );

    return [
      ...woodNormalCases,
      woodTangentialCase,
      ...liftCases,
    ];
  };

/**
 * This corpus is a coefficient/evidence regression gate, not the final
 * end-to-end production corpus. Observable IDs are reused only as generic
 * scalar slots because PhysicsObservableValidation intentionally has no
 * coefficient-specific result category.
 */
export const evaluatePublishedCoefficientRegressionCorpus =
  (): PhysicsValidationCorpusResult => (
    evaluatePhysicsValidationCorpus(
      'published-coefficient-regression-v1',
      createPublishedCoefficientRegressionCases(),
    )
  );
