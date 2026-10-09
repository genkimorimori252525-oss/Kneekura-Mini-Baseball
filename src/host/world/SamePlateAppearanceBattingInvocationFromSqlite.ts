import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { samePaReferenceValid, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { readBattingPerceptionFromSqlite, readBattingPerceptionInvocationClaims } from './SqliteBattingPerceptionStore';
import { readBattingEmotionExecutionFromSqlite, readBattingEmotionExecutionClaims } from './SqliteBattingEmotionExecutionStore';
import { readSamePaBattingCalculationFromSqlite, readSamePaBattingCalculationClaims } from './SqliteBattingExecutionInputStore';

export type SamePaBattingInvocationReference = SamePaReference<'batting_observation_v1_observations' | 'batting_observation_v1_deliveries' | 'batting_prediction_v1_predictions' | 'batting_emotion_execution_v1_executions' | 'batting_execution_v1_executions'>;
/** Actual invoked operation replay, separate from model, policy and assessment
 * preparation. The prefix must prove a strictly earlier execution-view edge
 * before calling this reader; it never accepts serialized derived outcomes. */
export const readSamePaBattingInvocationFromSqlite = (db: DatabaseSync, raw: SamePaBattingInvocationReference) => {
  const ref = cloneInert(raw);
  if (samePaReferenceValid(ref, 'batting_execution_v1_executions')) {
    const record = readSamePaBattingCalculationFromSqlite(db, ref as SamePaReference<'batting_execution_v1_executions'>);
    return { record, executionViewReference: record.source.viewReference, member: record.source.member, physicalPitchReference: record.physicalPitchReference,
      evaluationTick: record.calculation.nominalRequest.currentFrame.time.tick };
  }
  if (samePaReferenceValid(ref, 'batting_emotion_execution_v1_executions')) {
    const record = readBattingEmotionExecutionFromSqlite(db, ref as SamePaReference<'batting_emotion_execution_v1_executions'>);
    return { record, executionViewReference: record.source.viewReference, member: record.source.member, physicalPitchReference: record.physicalPitchReference,
      evaluationTick: record.acceptance.expectedFrame.time.tick };
  }
  if (!samePaReferenceValid(ref, 'batting_observation_v1_observations') && !samePaReferenceValid(ref, 'batting_observation_v1_deliveries') && !samePaReferenceValid(ref, 'batting_prediction_v1_predictions')) throw new Error('unsupported actual batting invocation owner');
  const kind = ref.owner === 'batting_observation_v1_observations' ? 'observation' : ref.owner === 'batting_observation_v1_deliveries' ? 'delivery' : 'prediction';
  const record = readBattingPerceptionFromSqlite(db, kind, ref);
  if (record.kind !== 'batting_observation' && record.kind !== 'batting_observation_delivery' && record.kind !== 'batting_observed_prediction') throw new Error('actual batting invocation record kind differs');
  return { record, executionViewReference: record.source.viewReference, member: record.source.member,
    physicalPitchReference: record.kind === 'batting_observation' ? record.source.physicalPitchReference : record.physicalPitchReference,
    evaluationTick: record.kind === 'batting_observation' ? record.source.observedTick : record.kind === 'batting_observation_delivery' ? record.delivery.evaluatedAtTick : record.forecast.availableTick };
};
export const readSamePaBattingInvocationClaims = (db: DatabaseSync, input: Parameters<typeof readBattingPerceptionInvocationClaims>[1]) =>
  [...readBattingPerceptionInvocationClaims(db, input).map(row => row.reference), ...readBattingEmotionExecutionClaims(db, input), ...readSamePaBattingCalculationClaims(db, input)];
