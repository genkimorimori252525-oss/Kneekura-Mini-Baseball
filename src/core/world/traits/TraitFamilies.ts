import type { TraitFamily } from './TraitTypes';
export const TRAIT_REGISTRY_VERSION = 'canonical09-lifecycle-subset-v1' as const;
export const TRAIT_DESIGN_REVISION = '782f6b8ef2406839de5678b00040001111cd8f77';
const grades = ['G','F','E','D','C','B','A'];
/** Explicit canonical09 mappings. Reference names are audit labels, NOT finalized UI names. */
const graded: readonly (readonly [string,string,boolean,boolean])[] = [
  ['pitch_pressure','対ピンチ',true,true],['pitch_platoon_left','対左打者',true,false],
  ['setback_recovery','打たれ強さ',true,true],['fastball_quality','ノビ',true,false],
  ['quick_delivery','クイック',true,false],['bat_pressure','チャンス',true,true],
  ['bat_platoon_left','対左投手',true,false],['catcher_handling','キャッチャー',true,false],
  ['stealing','盗塁',true,false],['baserunning','走塁',true,false],['throw_accuracy','送球',true,false],
  ['injury_resistance','ケガしにくさ',true,false],['recovery','回復',false,false],
];
const learned: readonly (readonly [string,string,boolean])[] = [
  ['opposite_field_technique','流し打ち',true],['cut_contact','カット打ち',false],
  ['two_strike_adjustment','粘り打ち',false],['bunting','バント○ / バント職人',true],
  ['advanced_fielding','守備職人 / 魔術師',true],['blocking','ブロッキング',false],
  ['pinch_hit_readiness','代打○ / 代打の神様',true],
];
const green: readonly (readonly [string,string,readonly string[],string])[] = [
  ['pitch_approach','速球中心 / 変化球中心',['FASTBALL','BALANCED','BREAKING'],'BALANCED'],
  ['swing_mode_preference','強振多用 / ミート多用',['POWER','BALANCED','CONTACT'],'BALANCED'],
  ['plate_aggression','積極打法 / 慎重打法',['AGGRESSIVE','BALANCED','CAUTIOUS'],'BALANCED'],
  ['steal_aggression','積極盗塁 / 慎重盗塁',['AGGRESSIVE','BALANCED','CAUTIOUS'],'BALANCED'],
  ['running_aggression','積極走塁',['AGGRESSIVE','BALANCED'],'BALANCED'],
  ['fielding_aggression','積極守備',['AGGRESSIVE','BALANCED'],'BALANCED'],
  ['team_play_preference','チームプレイ○ / ×',['COOPERATIVE','NEUTRAL','SELF_DIRECTED'],'NEUTRAL'],
];
const families: readonly TraitFamily[] = Object.freeze([
  ...graded.map(([familyId,referenceName,gold,pressure]):TraitFamily=>({ familyId,referenceName,
    lifecycleClass:'GRADED_DYNAMIC',stateIds:[...(familyId==='pitch_pressure'?['RED_EXTREME']:[]),...grades,...(gold?['GOLD']:[])],
    neutralStateId:null,sourceRoute:pressure?'PRESSURE_APPRAISAL':'SOURCE_EXECUTION' })),
  ...learned.map(([familyId,referenceName,master]):TraitFamily=>({ familyId,referenceName,
    lifecycleClass:'LEARNED_MASTERY_PERSISTENT',stateIds:master?['LEARNED','MASTERED']:['LEARNED'],neutralStateId:null,sourceRoute:'SOURCE_EXECUTION' })),
  ...green.map(([familyId,referenceName,stateIds,neutralStateId]):TraitFamily=>({ familyId,referenceName,
    lifecycleClass:'GREEN_SLOW_PREFERENCE',stateIds:[...stateIds],neutralStateId,sourceRoute:'PREFERENCE' })),
].map(f=>Object.freeze({...f,stateIds:Object.freeze([...f.stateIds])})));
export const getTraitFamilies = (): readonly TraitFamily[] => families;
export const findTraitFamily = (id: string): TraitFamily | undefined => families.find(x=>x.familyId===id);
