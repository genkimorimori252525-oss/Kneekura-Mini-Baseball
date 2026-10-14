import { physicalCapabilityDevelopmentInput, type AcceptedPhysicalCapabilityDevelopment } from './AcceptedPhysicalCapabilityDevelopment';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { RunnerDecisionInput } from '../../core/sim/running/RunnerDecision';
import type { RunnerMotionParameters } from '../../core/sim/running/RunnerMotion';
import { resolveRunnerDecisionTiming } from '../../core/sim/running/RunnerDecisionTiming';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type RunnerDecisionParameters = Pick<RunnerDecisionInput, 'minimumCueConfidence' | 'coachTrust'
  | 'minimumAdvanceSafetyMarginTicks' | 'decisionAbility' | 'timingParameters'>;
/** Explicit accepted runner inputs only. This owns no live knowledge, choice or motor command. */
export type AcceptedPlayerRunnerDecisionMotionModel = Readonly<{
  sourceId: string; sourceVersion: string; capability: 'runner_decision_motion_v1'; careerId: string; playerId: string;
  developmentProvenance?: AcceptedPhysicalCapabilityDevelopment;
  personLinkSourceId: string; acceptedAtDay: number; decision: RunnerDecisionParameters; motion: RunnerMotionParameters;
}>;
export const runnerModelId = (value: unknown): value is string => typeof value === 'string' && !!value.length && value === value.trim();
export const runnerModelDay = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const fields = (value: unknown, names: readonly string[]) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join('|') === [...names].sort().join('|');
const unit = (value: number) => Number.isFinite(value) && value >= 0 && value <= 1;

export const playerRunnerDecisionMotionModelInput = (raw: AcceptedPlayerRunnerDecisionMotionModel,
  sourceId?: string): AcceptedPlayerRunnerDecisionMotionModel => {
  const source = cloneInert(raw), id = runnerModelId, tick = runnerModelDay;
  if (!fields(source, ['sourceId', 'sourceVersion', 'capability', 'careerId', 'playerId', 'personLinkSourceId', 'acceptedAtDay', 'decision', 'motion',
    ...(source && Object.hasOwn(source, 'developmentProvenance') ? ['developmentProvenance'] : [])])
    || sourceId !== undefined && source.sourceId !== sourceId || source.capability !== 'runner_decision_motion_v1'
    || ![source.sourceId, source.sourceVersion, source.careerId, source.playerId, source.personLinkSourceId].every(id) || !tick(source.acceptedAtDay)
    || !fields(source.decision, ['minimumCueConfidence', 'coachTrust', 'minimumAdvanceSafetyMarginTicks', 'decisionAbility', 'timingParameters'])
    || ![source.decision.minimumCueConfidence, source.decision.coachTrust, source.decision.decisionAbility].every(unit)
    || !tick(source.decision.minimumAdvanceSafetyMarginTicks)
    || !fields(source.decision.timingParameters, ['minimumDecisionDelayTicks', 'maximumDecisionDelayTicks', 'fixedRecognitionOffsetTicks'])
    || !fields(source.motion, ['ticksPerSecond', 'reactionDelayTicks', 'accelerationMps2', 'brakingMps2', 'slideDecelerationMps2', 'topSpeedMps'])
    || !tick(source.motion.ticksPerSecond) || source.motion.ticksPerSecond === 0 || !tick(source.motion.reactionDelayTicks)
    || ![source.motion.accelerationMps2, source.motion.brakingMps2, source.motion.slideDecelerationMps2, source.motion.topSpeedMps]
      .every(value => Number.isFinite(value) && value > 0)) throw new Error('invalid accepted runner decision-motion model Source');
  // Validate the existing delay law at its slowest ability, without inventing
  // actor knowledge or invoking a fake live decision. Real consumers recheck
  // their nonzero evidence and issue ticks before adopting a motor.
  const slowest = resolveRunnerDecisionTiming(0, 0, source.decision.timingParameters);
  if (!Number.isSafeInteger(slowest.decisionTick + source.motion.reactionDelayTicks)) throw new Error('runner decision/motor delay composition overflows');
  if (Object.hasOwn(source, 'developmentProvenance')) physicalCapabilityDevelopmentInput(source.developmentProvenance!, 'runner_decision_motion');
  return freeze(source);
};
