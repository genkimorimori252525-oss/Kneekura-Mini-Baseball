import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { BatterSwingExitRunTransitionParameters } from '../../core/sim/running/BatterSwingExitRunTransition';
import type { DurablePlayerRunnerDecisionMotionModel } from './SqlitePlayerRunnerDecisionMotionModelStore';
import { samePaFields as fields, samePaText as id, samePaReferenceValid as ref, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** Independently accepted recovery limits. No height/rating-derived calibration. */
export type AcceptedPlayerBatterRunTransitionModel = Readonly<{
  sourceId: string; sourceVersion: string; capability: 'batter_run_transition_model_v1'; careerId: string; playerId: string;
  personLinkSourceId: string; acceptedAtDay: number;
  runnerModelReference: SamePaReference<'world_player_runner_decision_motion_models'>;
  parameters: BatterSwingExitRunTransitionParameters;
}>;
export type DurablePlayerBatterRunTransitionModel = Readonly<{
  source: AcceptedPlayerBatterRunTransitionModel; runnerModel: DurablePlayerRunnerDecisionMotionModel;
}>;
export const playerBatterRunTransitionModelInput = (raw: unknown, sourceId?: string): AcceptedPlayerBatterRunTransitionModel => {
  const s = cloneInert(raw) as AcceptedPlayerBatterRunTransitionModel;
  if (!fields(s, ['sourceId','sourceVersion','capability','careerId','playerId','personLinkSourceId','acceptedAtDay','runnerModelReference','parameters'])
    || s.capability !== 'batter_run_transition_model_v1' || sourceId !== undefined && s.sourceId !== sourceId
    || ![s.sourceId,s.sourceVersion,s.careerId,s.playerId,s.personLinkSourceId].every(id)
    || !Number.isSafeInteger(s.acceptedAtDay) || s.acceptedAtDay < 0
    || !ref(s.runnerModelReference, 'world_player_runner_decision_motion_models')
    || !fields(s.parameters, ['ticksPerSecond','maximumBodyTurnRateRadiansPerSecond','lateralRealignmentAccelerationMps2','backwardRecoveryAccelerationMps2'])
    || !Number.isSafeInteger(s.parameters.ticksPerSecond) || s.parameters.ticksPerSecond <= 0
    || ![s.parameters.maximumBodyTurnRateRadiansPerSecond,s.parameters.lateralRealignmentAccelerationMps2,s.parameters.backwardRecoveryAccelerationMps2]
      .every(n => Number.isFinite(n) && n > 0)) throw new Error('invalid accepted batter-run transition model Source');
  return freeze(s);
};
