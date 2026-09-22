import { freeze } from '../TraitValidation';
import type { SourceTraitFamily, SourceRequirement } from './SourceTraitTypes';
export const SOURCE_TRAIT_REGISTRY_VERSION = 'canonical09-source-descriptors-v1' as const;
export const SOURCE_TRAIT_DESIGN_REVISION = '782f6b8ef2406839de5678b00040001111cd8f77';
const player = (role: string, owner: SourceRequirement['owner']): SourceRequirement => ({ role, owner, subject: 'PLAYER' });
const team = (role: string, owner: SourceRequirement['owner']): SourceRequirement => ({ role, owner, subject: 'TARGET_TEAM' });
/** Explicit example subset from canonical09. Reference names are not finalized UI labels. */
const families: readonly SourceTraitFamily[] = freeze([
  { familyId: 'line_drive', evidenceMode: 'RECOGNITION_REQUIRED', referenceName: 'ラインドライブ', lifecycleClass: 'DYNAMIC_DESCRIPTOR',
    stateIds: ['LINE_DRIVE'], requirements: [player('contact', 'BATTING_CONTACT')],
    sourceSections: ['09:2.6', '09:5.1'], route: 'CURRENT_SOURCE_DESCRIPTION' },
  { familyId: 'pitcher_contact_distribution', evidenceMode: 'RECOGNITION_REQUIRED', referenceName: 'ゴロピッチャー / フライボールピッチャー', lifecycleClass: 'DYNAMIC_DESCRIPTOR',
    stateIds: ['GROUND_BALL', 'FLY_BALL'], requirements: [player('contact', 'PITCHING_CONTACT')],
    sourceSections: ['09:2.6', '09:4.9', '53:18.1'], route: 'CURRENT_SOURCE_DESCRIPTION' },
  { familyId: 'gyro_pitch_shape', evidenceMode: 'SOURCE_CHANGE_OR_RECOGNITION', referenceName: 'ジャイロボール / ハイスピンジャイロ', lifecycleClass: 'DYNAMIC_DESCRIPTOR',
    stateIds: ['GYRO', 'HIGH_SPIN_GYRO'], requirements: [player('trajectory', 'PITCH_TRAJECTORY')],
    sourceSections: ['09:2.6', '09:4.1'], route: 'CURRENT_SOURCE_DESCRIPTION' },
  { familyId: 'wild_stuff', evidenceMode: 'SOURCE_CHANGE_OR_RECOGNITION', referenceName: '荒れ球', lifecycleClass: 'DYNAMIC_DESCRIPTOR',
    stateIds: ['QUALITY_VARIANCE_TRADEOFF'], requirements: [player('quality', 'PITCH_QUALITY'), player('variance', 'PITCH_COMMAND')],
    sourceSections: ['09:2.6', '09:4.9', '09:10.1'], route: 'CURRENT_SOURCE_DESCRIPTION' },
  { familyId: 'release_miss_pattern', evidenceMode: 'SOURCE_CHANGE_OR_RECOGNITION', referenceName: '抜け球', lifecycleClass: 'CAUSAL_NEGATIVE_DYNAMIC',
    stateIds: ['DIRECTIONAL_MISS'], requirements: [player('failure', 'RELEASE_FAILURE')],
    sourceSections: ['09:2.6', '09:4.2', '09:15'], route: 'CURRENT_SOURCE_DESCRIPTION' },
  { familyId: 'command_instability', evidenceMode: 'SOURCE_CHANGE_OR_RECOGNITION', referenceName: '乱調', lifecycleClass: 'CAUSAL_NEGATIVE_DYNAMIC',
    stateIds: ['UNSTABLE'], requirements: [player('command', 'PITCH_COMMAND')],
    sourceSections: ['09:2.6', '09:4.2', '09:15'], route: 'CURRENT_SOURCE_DESCRIPTION' },
  { familyId: 'team_matchup', evidenceMode: 'RECOGNITION_REQUIRED', referenceName: '対象チーム付きキラー', lifecycleClass: 'RELATIONSHIP_CONTEXTUAL',
    stateIds: ['MATCHUP_SPECIALIZATION'], requirements: [player('familiarity', 'FAMILIARITY'), team('roster', 'TEAM_ROSTER'),
      team('pitchProfile', 'TEAM_PITCH_PROFILE'), team('tactics', 'TEAM_TACTICS')],
    sourceSections: ['09:2.6', '09:5.10', '53:21.4'], route: 'CONTEXT_DESCRIPTION' },
  { familyId: 'pitcher_result_history', evidenceMode: 'RECOGNITION_REQUIRED', referenceName: '負け運 / 勝ち運（履歴のみ）', lifecycleClass: 'CAREER_HISTORY_DESCRIPTOR',
    stateIds: ['UNFAVORABLE_RESULT_CONTEXT', 'FAVORABLE_RESULT_CONTEXT'], requirements: [player('history', 'CAREER_HISTORY')],
    sourceSections: ['09:2.6', '09:4.7', '09:9', '53:18.1'], route: 'HISTORY_ONLY' },
]);
export const getSourceTraitFamilies = (): readonly SourceTraitFamily[] => families;
export const findSourceTraitFamily = (id: string): SourceTraitFamily | undefined => families.find(f => f.familyId === id);
