import { playerObservationCalibrationFixture } from '../../core/sim/perception/PlayerObservationCalibrationFixtures.test-support';
import { playerLocomotionCalibrationFixture } from '../../core/sim/fielding/PlayerLocomotionCalibrationFixtures.test-support';

// Explicit generic research inputs. No measured person, league or production
// defaults. Legacy fixture non-temporal SI values are identified here only.
export const authoredClockFixture = () => {
  const { refreshPolicy: _refresh, qualityParameters, memoryDecayParameters, ...observation } = playerObservationCalibrationFixture();
  const { maxIntegrationStepTicks: _step, ...locomotion } = playerLocomotionCalibrationFixture();
  const { ticksPerSecond: _clock, ...memory } = memoryDecayParameters;
  return {
    version: 'authored_match_si_clock_v1', authority: 'AUTHORED_SYNTHETIC_NOT_EMPIRICAL', units: 'SI',
    namespace: 'authored-clock-research', revision: 1, careerId: 'authored-clock-research:career', acceptedAtDay: 0,
    clock: { ticksPerSecond: 1_000_000 },
    defenders: Array.from({ length: 9 }, (_, i) => ({
      playerId: 'authored-clock-research:player:' + i, personLinkSourceId: 'authored-clock-research:person-link:' + i,
      fieldingModelSourceId: 'authored-clock-research:fielding:' + i,
      observation: { ...structuredClone(observation), refreshSeconds: { attended: '0.020', peripheral: '0.080' },
        qualityParameters: { ...structuredClone(qualityParameters), fullQualityObservationDurationSeconds: '1.000' },
        memoryDecayParameters: { ...memory } },
      decision: { decisionSeconds: { minimum: '0.120', maximum: '0.280', fixedProcessingOffset: '0.010' },
        firstStepSeconds: { minimum: '0.030', maximum: '0.090', fixedMotorOffset: '0.005' },
        minimumCueConfidence: 0.4, communicationTrust: 0.8 },
      locomotion: { ...structuredClone(locomotion), maximumControlStepSeconds: '0.002' },
      transferSeconds: { minimum: '0.080', maximum: '0.220', fixedGripOffset: '0.010' },
      throwCalibration: { minimumReleaseSpeedMps: 10, maximumReleaseSpeedMps: 30, minimumTargetErrorMeters: 0, maximumTargetErrorMeters: 1 },
    })),
  };
};
