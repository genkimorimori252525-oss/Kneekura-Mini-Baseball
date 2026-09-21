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
                  'normal_coefficient_of_restitution',
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
                  'normal_coefficient_of_restitution',
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
              'tangential_coefficient_of_restitution',
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
              'tangential_coefficient_of_restitution',
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
                  'lift_coefficient',
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
                  'lift_coefficient',
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
 * end-to-end production corpus. Coefficient observables are explicit so
 * calibration evidence cannot masquerade as a trajectory measurement.
 */
export const evaluatePublishedCoefficientRegressionCorpus =
  (): PhysicsValidationCorpusResult => (
    evaluatePhysicsValidationCorpus(
      'published-coefficient-regression-v1',
      createPublishedCoefficientRegressionCases(),
    )
  );
