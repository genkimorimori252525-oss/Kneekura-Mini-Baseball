import {
  BASEBALL_PHYSICS_V1_CALIBRATION_GATES,
} from '../sim/ball/BaseballPhysicsV1';
import type {
  BaseballPhysicsCalibrationGateEvidence,
  BaseballPhysicsCalibrationGateId,
} from './BaseballPhysicsProductionReadiness';

export type BaseballPhysicsGateCoverage = Readonly<{
  gateId: BaseballPhysicsCalibrationGateId;
  evidenceState:
    BaseballPhysicsCalibrationGateEvidence['state'];
  evidenceId: string;
  evidenceVersion: string;
  coverage: string;
  missing: string;
}>;

/**
 * Current evidence ledger for the v1 realism branch.
 *
 * This is deliberately conservative. A gate stays open when the repository
 * has useful evidence but not enough to justify one production parameter set.
 * The purpose is to prevent partial evidence from silently becoming
 * production calibration.
 */
export const CURRENT_BASEBALL_PHYSICS_V1_GATE_COVERAGE:
  readonly BaseballPhysicsGateCoverage[] =
  Object.freeze([
    {
      gateId:
        'wood_bat_production_contact_parameters',
      evidenceState: 'open',
      evidenceId:
        'cross-nathan-2006+nathan-2011+nathan-2012+kensrud-2017+hirono-2025',
      evidenceVersion:
        'multi-study-bat-contact-v1',
      coverage:
        'Rigid/reduced-order equations, low-speed recoil/COR, game-speed normal/tangential evidence, and bat-specific speed-response requirement are implemented.',
      missing:
        'A production wood-bat profile must be selected from measurements for the chosen bat/construction or a justified population; the current evidence does not identify one universal curve.',
    },
    {
      gateId:
        'infield_dirt_material_profile',
      evidenceState: 'open',
      evidenceId:
        'pennbounce+brosnan-2011-skinned-infield',
      evidenceVersion:
        'surface-pace-evidence-v1',
      coverage:
        'Angle/speed pace evidence and compaction-dependent field observations are retained; conditional material fitting is implemented.',
      missing:
        'Published Vout/Vin pace alone does not uniquely identify normal COR, tangential COR, and friction; independent spin/bounce-angle evidence is still needed for a unique production profile.',
    },
    {
      gateId:
        'natural_grass_material_profile',
      evidenceState: 'open',
      evidenceId:
        'pennbounce+brosnan-2011+park-2020+tahara-2008',
      evidenceVersion:
        'natural-grass-evidence-v2',
      coverage:
        'Natural-grass pace evidence, dry/wet qualitative friction-regime behavior, and Tahara 2008 hard-ball vertical rebound evidence (normal repulsion 0.13 +/- 0.01 for the tested natural turf) are retained.',
      missing:
        'The Tahara natural-turf construction is one specific system and does not identify tangential response, wet-condition response, or post-bounce rolling resistance for a universal production grass profile.',
    },
    {
      gateId:
        'artificial_turf_material_profile',
      evidenceState: 'open',
      evidenceId:
        'pennbounce+brosnan-2011-synthetic-turf+tahara-2008',
      evidenceVersion:
        'synthetic-turf-evidence-v2',
      coverage:
        'Multiple synthetic-turf pace observations and Tahara 2008 hard-ball vertical rebound evidence are retained separately for previous-generation (0.29 +/- 0.02) and fifth-generation (0.25 +/- 0.02) tested turf systems.',
      missing:
        'Those tested turf constructions are not interchangeable and the available evidence still does not uniquely identify tangential/spin friction behavior for a chosen production ballpark surface.',
    },
    {
      gateId:
        'warning_track_material_profile',
      evidenceState: 'open',
      evidenceId:
        'no-production-warning-track-dataset',
      evidenceVersion:
        'evidence-gap-v1',
      coverage:
        'The unified material model can represent warning-track surfaces without new equations.',
      missing:
        'No sufficiently specific, trusted warning-track baseball rebound/skid dataset has been adopted for a production profile.',
    },
    {
      gateId:
        'wall_padding_material_profile',
      evidenceState: 'open',
      evidenceId:
        'npb-rigid-wall-reference+planar-surface-solver',
      evidenceVersion:
        'wall-evidence-gap-v1',
      coverage:
        'Deterministic planar wall timing and a historical rigid-wall COR reference are retained.',
      missing:
        'Rigid-wall evidence is not a substitute for actual padded outfield-wall material response; a padding-specific baseball impact dataset is still required.',
    },
    {
      gateId:
        'sliding_friction_calibration',
      evidenceState: 'open',
      evidenceId:
        'cross-nathan-hardwood-lower-bound+park-2020-wet-grass-direction',
      evidenceVersion:
        'friction-bounds-v1',
      coverage:
        'Surface friction enters the correct spin-coupled impulse/skid equations and published bounds/directional effects are retained.',
      missing:
        'Field-surface baseball sliding friction is not uniquely calibrated across dirt/grass/turf conditions.',
    },
    {
      gateId:
        'rolling_resistance_calibration',
      evidenceState: 'open',
      evidenceId:
        'knudson-hoyle-2017-ground-ball-transit',
      evidenceVersion:
        'ground-transit-evidence-v1',
      coverage:
        'Finite skid-to-roll physics and end-to-end tall-fescue ground-ball transit targets are implemented.',
      missing:
        'The experiment constrains the combined trajectory, not a unique rolling-deceleration coefficient; more direct or joint-fit evidence is needed.',
    },
    {
      gateId:
        'pitching_coefficient_calibration',
      evidenceState: 'open',
      evidenceId:
        'lyu-2022+smith-2022+statcast-2025',
      evidenceVersion:
        'pitch-aero-evidence-v1',
      coverage:
        'Weather-derived air properties, Reynolds/spin-dependent seam-averaged drag/lift, active/gyro spin, and physical pitch-name calibration are implemented.',
      missing:
        'Low-spin seam-orientation split, calibrated spin decay, and explicitly deferred SSW/knuckleball forces prevent claiming complete production pitching calibration.',
    },
    {
      gateId:
        'end_to_end_validation_corpus',
      evidenceState: 'open',
      evidenceId:
        'physics-observable-validation+published-coefficient-regression',
      evidenceVersion:
        'validation-framework-v1',
      coverage:
        'Source-bounded coefficient regression, one-sided experimental constraints, deterministic fingerprints, and observable-level corpus machinery are implemented.',
      missing:
        'A final end-to-end corpus spanning pitch trajectory, game-speed bat contact, batted-ball flight, bounce, skid/roll, and wall response is not yet populated with enough independent measurements.',
    },
  ]);

export const createCurrentBaseballPhysicsV1GateEvidence =
  (): readonly BaseballPhysicsCalibrationGateEvidence[] => {
    const byId =
      new Map(
        CURRENT_BASEBALL_PHYSICS_V1_GATE_COVERAGE
          .map(
            (entry) => [
              entry.gateId,
              entry,
            ] as const,
          ),
      );

    return BASEBALL_PHYSICS_V1_CALIBRATION_GATES
      .map((gateId) => {
        const entry = byId.get(gateId);
        if (entry === undefined) {
          throw new Error(
            `missing current physics gate coverage: ${gateId}`,
          );
        }
        return {
          gateId,
          state:
            entry.evidenceState,
          evidenceId:
            entry.evidenceId,
          evidenceVersion:
            entry.evidenceVersion,
        };
      });
  };