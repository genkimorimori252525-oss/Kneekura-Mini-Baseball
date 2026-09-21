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
 * Current evidence ledger for the frozen v1 realism branch.
 *
 * "explicitly_scoped_out" is not a disguised calibration. It means the
 * required equations/evidence boundary is preserved, but v1 refuses to invent
 * a universal production coefficient that the adopted experiments do not
 * identify. A later promotion decision must explicitly accept every such
 * omission.
 */
export const CURRENT_BASEBALL_PHYSICS_V1_GATE_COVERAGE:
  readonly BaseballPhysicsGateCoverage[] =
  Object.freeze([
    {
      gateId:
        'wood_bat_production_contact_parameters',
      evidenceState: 'satisfied',
      evidenceId:
        'nathan-2012-rigid-three-inch-wood-cylinder-47-impact-fit',
      evidenceVersion:
        'nathan-2012-47-impact-fit-v1',
      coverage:
        'The v1 local wood-contact profile is frozen from one same-fixture high-speed fit: e_y=0.52 and e_x=0.30 +/- 0.02 for the non-gross-slip data, with gross-slip friction about 0.15. RigidBatBallContact separately supplies finite bat mass, inertia, recoil, impact location, and surface velocity.',
      missing:
        'The selected profile is intentionally a local reduced-order wood-surface response, not a claim that every wooden bat has the same material response. Bat-specific future profiles remain versioned replacements.',
    },
    {
      gateId:
        'infield_dirt_material_profile',
      evidenceState:
        'explicitly_scoped_out',
      evidenceId:
        'pennbounce+brosnan-2011-skinned-infield',
      evidenceVersion:
        'surface-pace-underdetermined-scope-v1',
      coverage:
        'Angle/speed pace evidence, compaction-dependent field observations, conditional material fitting, and assumption-search diagnostics are retained.',
      missing:
        'Scoped out from a universal v1 material preset: published Vout/Vin pace does not uniquely identify normal COR, tangential COR, and friction. v1 requires a ballpark-specific material profile rather than fabricating the missing decomposition.',
    },
    {
      gateId:
        'natural_grass_material_profile',
      evidenceState:
        'explicitly_scoped_out',
      evidenceId:
        'pennbounce+brosnan-2011+park-2020+tahara-2008',
      evidenceVersion:
        'natural-grass-construction-specific-scope-v1',
      coverage:
        'Natural-grass pace evidence, dry/wet qualitative friction-regime behavior, and Tahara 2008 hard-ball vertical rebound evidence (normal repulsion 0.13 +/- 0.01 for the tested Viktor construction) are retained.',
      missing:
        'Scoped out from a universal v1 preset: the measured construction does not identify tangential response, wet response, or rolling resistance for other grass/base systems. Reality profiles must name the actual measured or conditionally fitted construction.',
    },
    {
      gateId:
        'artificial_turf_material_profile',
      evidenceState:
        'explicitly_scoped_out',
      evidenceId:
        'pennbounce+brosnan-2011-synthetic-turf+tahara-2008',
      evidenceVersion:
        'synthetic-turf-construction-specific-scope-v1',
      coverage:
        'Multiple synthetic-turf pace observations and Tahara 2008 hard-ball vertical rebound evidence remain separate for previous-generation (0.29 +/- 0.02) and fifth-generation (0.25 +/- 0.02) systems.',
      missing:
        'Scoped out from a universal v1 preset: those constructions are not interchangeable and the adopted evidence does not uniquely identify tangential/spin-friction response for an arbitrary ballpark turf.',
    },
    {
      gateId:
        'warning_track_material_profile',
      evidenceState:
        'explicitly_scoped_out',
      evidenceId:
        'warning-track-baseball-response-evidence-gap',
      evidenceVersion:
        'warning-track-scope-v1',
      coverage:
        'The unified material/contact model already supports a separately selected warning-track segment.',
      missing:
        'Scoped out from a v1 numeric preset: no sufficiently specific adopted baseball rebound/skid dataset supports a production warning-track coefficient set. Construction specifications are not substituted for ball-response measurements.',
    },
    {
      gateId:
        'wall_padding_material_profile',
      evidenceState:
        'explicitly_scoped_out',
      evidenceId:
        'takashima-2015-rigid-wall+padding-response-evidence-gap',
      evidenceVersion:
        'padded-wall-scope-v1',
      coverage:
        'Deterministic planar wall timing and the Takashima 2015 rigid-wall baseball reference are retained for validation of rigid impact mechanics.',
      missing:
        'Scoped out from a padded-wall numeric preset: rigid-wall COR is not used as a surrogate for energy-absorbing outfield padding. A padding-specific baseball impact dataset is required for a future versioned material.',
    },
    {
      gateId:
        'sliding_friction_calibration',
      evidenceState:
        'explicitly_scoped_out',
      evidenceId:
        'cross-nathan-hardwood+park-2020+surface-pace-underdetermination',
      evidenceVersion:
        'field-sliding-friction-scope-v1',
      coverage:
        'Coulomb friction enters the correct spin-coupled impact and finite skid-to-roll equations; published bounds and directional wet-grass effects are retained.',
      missing:
        'Scoped out from a universal field coefficient: adopted baseball field experiments do not independently identify sliding friction for every dirt/grass/turf construction. Each production material must provide its own evidence-backed or explicitly conditional value.',
    },
    {
      gateId:
        'rolling_resistance_calibration',
      evidenceState:
        'explicitly_scoped_out',
      evidenceId:
        'knudson-hoyle-2017-ground-ball-transit',
      evidenceVersion:
        'rolling-resistance-joint-fit-scope-v1',
      coverage:
        'Finite skid-to-roll physics and the independent 30.5 m tall-fescue ground-ball transit targets are retained for end-to-end checks.',
      missing:
        'Scoped out from a universal rolling-deceleration coefficient: the experiment constrains the combined bounce/skid/roll trajectory rather than uniquely identifying rolling resistance.',
    },
    {
      gateId:
        'pitching_coefficient_calibration',
      evidenceState: 'satisfied',
      evidenceId:
        'lyu-2022+smith-2022+nathan-2026+statcast-2025',
      evidenceVersion:
        'seam-averaged-pitch-aero-v1',
      coverage:
        'Weather-derived air properties, Reynolds/spin-dependent seam-averaged drag/lift, active/gyro spin, physical pitch-name calibration, and evidence-bounded aerodynamic spin decay are implemented and independently regression-tested.',
      missing:
        'Generative seam-shifted-wake, knuckleball-specific unsteady seam force, and full biomechanics are explicit architecture-v1 deferrals, not hidden missing terms in the v1 seam-averaged production claim.',
    },
    {
      gateId:
        'end_to_end_validation_corpus',
      evidenceState: 'satisfied',
      evidenceId:
        'baseball-physics-v1-release-validation-v1',
      evidenceVersion:
        'published-coefficients+e2e-observables-v1',
      coverage:
        'The release corpus now combines source-level coefficient regression with deterministic integrated cases for pitch-path spin decay, game-speed wood contact, batted-ball spin decay, construction-specific ground bounce, no-slip rolling kinematics, and rigid-wall response.',
      missing:
        'Universal field-material presets remain intentionally outside this gate and are tracked by their own explicit scope-out records rather than hidden inside the validation corpus.',
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
