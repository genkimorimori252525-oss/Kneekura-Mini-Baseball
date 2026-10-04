import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { resolveDefensiveDecisionTiming, type DefensiveDecisionTimingParameters } from './DefensiveDecisionTiming';
import { resolveDefenderFirstStepTiming, type DefenderFirstStepTimingParameters } from './DefenderFirstStepTiming';

/** Explicit calibration only. Defensive ratings and contextual pre-play plans have separate owners. */
export type PlayerDecisionCalibration = Readonly<{
  decisionTimingParameters: DefensiveDecisionTimingParameters;
  firstStepTimingParameters: DefenderFirstStepTimingParameters;
  minimumCueConfidence: number;
  communicationTrust: number;
}>;

const fields = (value: unknown, names: readonly string[]): void => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...names].sort())) {
    throw new Error('invalid Player decision calibration fields');
  }
};
const unit = (value: number): void => {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('Player decision calibration must be within [0, 1]');
};

/** Validate the actual delay arithmetic over the ability domain, without selecting production values or live evidence. */
export const createPlayerDecisionCalibration = (input: PlayerDecisionCalibration): PlayerDecisionCalibration => {
  const value = cloneInert(input);
  fields(value, ['decisionTimingParameters', 'firstStepTimingParameters', 'minimumCueConfidence', 'communicationTrust']);
  fields(value.decisionTimingParameters, ['minimumDecisionDelayTicks', 'maximumDecisionDelayTicks', 'fixedProcessingOffsetTicks']);
  fields(value.firstStepTimingParameters, ['minimumFirstStepDelayTicks', 'maximumFirstStepDelayTicks', 'fixedMotorOffsetTicks']);
  unit(value.minimumCueConfidence); unit(value.communicationTrust);
  // Ability zero yields the maximum delay in each existing algorithm. Their composition must fit a safe tick even at origin zero.
  // Later consumers must still validate their actual nonzero evidence/recognition ticks with those same algorithms.
  const slowestDecision = resolveDefensiveDecisionTiming(0, 0, value.decisionTimingParameters);
  resolveDefenderFirstStepTiming(slowestDecision.decisionTick, 0, value.firstStepTimingParameters);
  Object.freeze(value.decisionTimingParameters); Object.freeze(value.firstStepTimingParameters);
  return Object.freeze(value);
};
