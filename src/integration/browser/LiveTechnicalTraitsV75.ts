import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { LiveTraitDefinitionV1, LiveTraitProfileV1 } from './LiveTraitProfilesV1';
import { type TechnicalSkillControlsV75, type TechnicalSkillIdV75, TECHNICAL_SKILL_IDS_V77 } from '../../core/sim/TechnicalSkillControlsV75';
export const TECHNICAL_TRAIT_CALIBRATION_V75 = 'local-technique-authoring-v75-not-empirically-calibrated';
export const isTechnicalTraitV75 = (id: string): id is TechnicalSkillIdV75 => (TECHNICAL_SKILL_IDS_V77 as readonly string[]).includes(id);
const definitions = [
  ['baserunning', '走塁', 'GRADED_DYNAMIC', 'ベース旋回の経路選択。最高走速と身体の加速度上限は変更しません。'],
  ['bunting', 'バント○ / バント職人', 'LEARNED_MASTERY_PERSISTENT', 'バント時だけ、予測した打点へバットを構え、迎球して引く動作と面・位置・時刻の再現性。'],
  ['advanced_fielding', '守備職人 / 魔術師', 'LEARNED_MASTERY_PERSISTENT', '捕球体勢と捕球後の持ち替え。一般走力・肩力・手の速度上限は変更しません。'],
  ['bat_to_run_transition', '内野安打○ / ロケットスタート', 'DYNAMIC_DESCRIPTOR', '打者走者だけの打撃から初動への切り替え。塁上走者と最高走速は変更しません。'],
  ['slow_ball_charge', '高速チャージ', 'LEARNED_MASTERY_PERSISTENT', '観測した低速の接地打球へ前進して拾う動作。飛球・送球には適用しません。'],
  ['low_zone_command', '低め○ / 精密機械', 'LEARNED_MASTERY_PERSISTENT', '低めを狙った投球だけの狙い誤差。球速・回転・審判やリリース後の球は上書きしません。'],
] as const;
const newDefinitions = [
  ['inside_command', '内角攻め / 内角無双', 'LEARNED_MASTERY_PERSISTENT', '打者の左右を考慮した内角目標だけで投球実行誤差を低減。基礎制球と公開値、放球後の物理を変更しません。'],
  ['high_zone_hitting', 'ハイボールヒッター / 高球必打', 'LEARNED_MASTERY_PERSISTENT', '高い予測打点に向かうスイングだけで位置と時刻の実行誤差を低減。基礎ミートと公開値は変更しません。'],
  ['low_zone_hitting', 'ローボールヒッター / 低球必打', 'LEARNED_MASTERY_PERSISTENT', '低い予測打点に向かうスイングだけで位置と時刻の実行誤差を低減。基礎ミートと公開値は変更しません。'],
  ['pitcher_field_reaction', '打球反応○', 'LEARNED_MASTERY_PERSISTENT', '投手本人の打球への最初の反応だけを速めます。一般野手と送球の受球には作用しません。'],
] as const;
const makeDefinitions = (rows: readonly (readonly [string, string, LiveTraitDefinitionV1['lifecycleClass'], string])[]): readonly LiveTraitDefinitionV1[] => rows.map(([familyId,label,lifecycleClass,note]) => ({
  familyId,label,lifecycleClass,sourceRoute:'SOURCE_EXECUTION',editor:'TECHNIQUE',availability:'EXECUTABLE',
  calibrationId:TECHNICAL_TRAIT_CALIBRATION_V75,sourcePaths:['traitProfile.selections.source.effectScale'],
  effectOwner:['bunting','low_zone_command','inside_command','high_zone_hitting','low_zone_hitting'].includes(familyId)?'LivePitchV1 dedicated technique':'LiveFieldPlayV1 dedicated technique',sourceDefinition:note+' '+TECHNICAL_TRAIT_CALIBRATION_V75,
  states:familyId==='baserunning'?['G','F','E','D','C','B','A','GOLD'].map(id=>({stateId:id,label:id==='GOLD'?'高速ベースラン':'走塁'+id,color:id==='GOLD'?'gold':['A','B'].includes(id)?'blue':['F','G'].includes(id)?'red':'neutral'} as const))
    :[{stateId:'LEARNED',label:label.split(' / ')[0],color:'blue' as const},...(['slow_ball_charge','pitcher_field_reaction'].includes(familyId)?[]:[{stateId:'MASTERED',label:label.split(' / ')[1]!,color:'gold' as const}])],
}));
export const getTechnicalTraitDefinitionsV75 = (): readonly LiveTraitDefinitionV1[] => makeDefinitions(definitions);
export const getTechnicalTraitDefinitionsV77 = (): readonly LiveTraitDefinitionV1[] => makeDefinitions([...definitions, ...newDefinitions]);
/** Exactly one authored source per family. Zero/null produces no runtime fields. */
export function resolveValidatedTechnicalProfileV75(profile?: LiveTraitProfileV1): TechnicalSkillControlsV75 | undefined {
  const result: Partial<Record<TechnicalSkillIdV75,number>>={}, seen=new Set<string>();
  const safe=profile===undefined?undefined:cloneInert(profile);
  for(const selection of safe?.selections??[]){
    if(!isTechnicalTraitV75(selection.familyId))continue;
    if(seen.has(selection.familyId)||Object.keys(selection.source).length!==1||!Object.hasOwn(selection.source,'effectScale'))throw Error('technical traits: duplicate or invalid source');
    seen.add(selection.familyId);
    const scale=selection.source.effectScale;
    if(typeof scale!=='number'||!Number.isFinite(scale)||scale<0||scale>2)throw Error('technical traits: invalid effect scale');
    const definition=getTechnicalTraitDefinitionsV77().find(d=>d.familyId===selection.familyId)!;
    if(selection.stateId!==null&&!definition.states.some(s=>s.stateId===selection.stateId))throw Error('technical traits: invalid state');
    if(selection.stateId===null||scale===0)continue;
    const factor=selection.familyId==='baserunning'?({G:-1,F:-.65,E:-.3,D:0,C:.3,B:.6,A:.8,GOLD:1} as Record<string,number>)[selection.stateId]
      :selection.stateId==='MASTERED'?1:.5;
    if(factor!==0)result[selection.familyId]=factor*scale;
  }
  return Object.keys(result).length?Object.freeze(result):undefined;
}
