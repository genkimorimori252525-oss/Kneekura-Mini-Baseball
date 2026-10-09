import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createEmotionState } from '../../core/world/psychology/EmotionState';
import { readPolicy } from '../../core/world/psychology/EmotionValidation';
import type { EmotionPolicy, EmotionScope, EmotionState } from '../../core/world/psychology/EmotionTypes';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields, samePaText as text, samePaReferenceValid as reference, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaDispatchMemberValid, type SamePaDispatchMember } from './SamePlateAppearanceDispatchRoles';

export type AcceptedBattingEmotionGenesis = Readonly<{
  sourceId: string; sourceVersion: string; capability: 'owned_batting_emotion_genesis_v1';
  viewReference: SamePaReference<'reserved_pa_execution_views'>; member: SamePaDispatchMember;
  policy: EmotionPolicy;
  provenance: Readonly<{ assessmentSourceId: string; assessmentVersion: string; calibrationSourceId: string; calibrationVersion: string }>;
}>;
export type DurableBattingEmotionGenesis = Readonly<{
  kind: 'batting_emotion_genesis'; source: AcceptedBattingEmotionGenesis; scope: EmotionScope; state: EmotionState;
}>;
export const battingEmotionGenesisInput = (raw: unknown, sourceId?: string): AcceptedBattingEmotionGenesis => {
  const source = cloneInert(raw);
  if (!fields(source, ['sourceId', 'sourceVersion', 'capability', 'viewReference', 'member', 'policy', 'provenance'])
    || !text(source.sourceId) || !text(source.sourceVersion) || sourceId !== undefined && source.sourceId !== sourceId
    || source.capability !== 'owned_batting_emotion_genesis_v1' || !reference(source.viewReference, 'reserved_pa_execution_views')
    || !samePaDispatchMemberValid(source.member) || !fields(source.provenance, ['assessmentSourceId', 'assessmentVersion', 'calibrationSourceId', 'calibrationVersion'])
    || !Object.values(source.provenance).every(text)) throw new Error('invalid explicit batting emotion genesis Source');
  // Validate the existing policy domain only. The Native reader supplies the
  // real scope when constructing the durable state; no fixture scope is used.
  readPolicy(source.policy, 'battingEmotion.policy');
  return freeze(source as AcceptedBattingEmotionGenesis);
};
export const deriveBattingEmotionGenesis = (source: AcceptedBattingEmotionGenesis, scope: EmotionScope): DurableBattingEmotionGenesis => {
  const result = createEmotionState({ scope, policy: source.policy });
  if (!result.ok) throw new Error('invalid explicit emotion genesis policy: ' + result.reason.path);
  return freeze({ kind: 'batting_emotion_genesis', source, scope, state: result.value });
};
