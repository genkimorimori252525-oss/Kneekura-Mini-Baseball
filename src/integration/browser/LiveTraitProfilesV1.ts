import { markLiveAuthoringSourceV101 } from './LiveAuthoringSourceV101';
import { getTechnicalTraitDefinitionsV75, getTechnicalTraitDefinitionsV77, isTechnicalTraitV75, resolveValidatedTechnicalProfileV75 } from './LiveTechnicalTraitsV75';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { LivePhysicalRosterInputV1 } from './LivePhysicalRosterV1';
import { deriveLiveThrowAccuracyGradeV54, getLiveThrowAccuracySourceV54, getLiveTraitAuthoringCalibrationV54 } from './LiveTraitAuthoringCalibrationV54';
import type { ResponseAxis } from '../../core/world/psychology/appraisal/AppraisalTypes';
import { TECHNICAL_SKILL_IDS_CONNECTED_V1, type TechnicalSkillControlsV75 } from '../../core/sim/TechnicalSkillControlsV75';
import { DELIVERY_SECONDS } from './LiveBaseRunningV1';

/** Local authoring only. Neither colors nor saved labels add another execution
 * effect or authenticate Native persistent mastery. v1 bad-ball packets retain
 * their exact family, state and source shape. */
export type LiveTraitSourceV1 = Readonly<Record<string, number | string>>;
export type LiveTraitProfileV1 = Readonly<{
  version: 'live_trait_profile_v1' | 'live_trait_profile_v2';
  selections: readonly Readonly<{ familyId: string; stateId: string | null; source: LiveTraitSourceV1 }>[];
}>;
export type LiveTraitRosterInputV1 = Omit<LivePhysicalRosterInputV1, 'entries'> & Readonly<{
  entries: readonly (LivePhysicalRosterInputV1['entries'][number] & Readonly<{ traitProfile?: LiveTraitProfileV1 }>)[];
}>;
type TraitColor = 'blue' | 'red' | 'green' | 'gold' | 'neutral';
export type LiveTraitDefinitionV1 = Readonly<{
  familyId: string; label: string; lifecycleClass: string; sourceRoute: 'SOURCE_EXECUTION' | 'PREFERENCE';
  states: readonly Readonly<{ stateId: string; label: string; color: TraitColor }>[];
  sourcePaths: readonly string[]; effectOwner: string; sourceDefinition: string;
  editor?: 'OWNERSHIP' | 'PREFERENCE' | 'GRADE' | 'TECHNIQUE' | 'PITCH_QUALITY'; availability?: 'EXECUTABLE' | 'SOURCE_DERIVED' | 'UNAVAILABLE'; calibrationId?: string; displayNote?: string;
}>;
export type LiveTraitPhysicalSourceV54 = Readonly<{
  badBallControl?: number; throwDirectionStdRadians?: number; baserunningSafetyMarginSeconds?: number;
  fieldingPursuitCostWeight?: number; swingDecision?: Readonly<{ approach: 'AUTO' | 'TAKE' | 'SWING'; threshold: number; aggressionWeight: number }>;
}>;
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const calibration = getLiveTraitAuthoringCalibrationV54();
const state = (stateId: string, label: string, color: TraitColor = 'green') => ({ stateId, label, color });
const legacyCatalog: readonly LiveTraitDefinitionV1[] = freeze([
  { familyId: 'bad_ball_hitting', label: '悪球打ち', lifecycleClass: 'LEARNED_MASTERY_PERSISTENT', sourceRoute: 'SOURCE_EXECUTION',
    states: [state('LEARNED', '悪球打ち', 'blue')], editor: 'OWNERSHIP', availability: 'EXECUTABLE',
    sourcePaths: ['physical.badBallControl', 'workbenchPlayer.traits.badBallControl'],
    effectOwner: 'LivePitchV1 awkward execution error / BattingWorkbench execution error',
    sourceDefinition: 'canonical09 §5.2.1 / 2026-10-14 USER-DIRECTED REFINEMENT; no chase or result-probability bonus' },
  { familyId: 'throw_accuracy', label: '送球', lifecycleClass: 'GRADED_DYNAMIC', sourceRoute: 'SOURCE_EXECUTION',
    states: ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'GOLD'].map(id => state(id, id === 'GOLD' ? 'ストライク送球' : '送球' + id,
      id === 'GOLD' ? 'gold' : ['A', 'B'].includes(id) ? 'blue' : ['F', 'G'].includes(id) ? 'red' : 'neutral')),
    editor: 'GRADE', availability: 'SOURCE_DERIVED', calibrationId: calibration.throwAccuracy.id,
    sourcePaths: ['physical.throwDirectionStdRadians'], effectOwner: 'LiveThrowDirectionV1 angular release error',
    sourceDefinition: 'canonical09 §5.7 + versioned LOCAL_AUTHORING_ONLY SI thresholds, not a league or mastery assessment' },
  { familyId: 'plate_aggression', label: '打撃積極性', lifecycleClass: 'GREEN_SLOW_PREFERENCE', sourceRoute: 'PREFERENCE',
    states: [state('AGGRESSIVE', '積極打法'), state('BALANCED', '標準', 'neutral'), state('CAUTIOUS', '慎重打法')],
    editor: 'PREFERENCE', availability: 'EXECUTABLE', calibrationId: calibration.plateAggression.id,
    sourcePaths: ['physical.swingDecision.threshold', 'physical.swingDecision.aggressionWeight', 'physical.swingDecision.approach'],
    effectOwner: 'LivePitchV1 AUTO swing decision', sourceDefinition: 'canonical09 §5.11 / §6; no recognition or forced-swing bonus' },
  { familyId: 'running_aggression', label: '走塁積極性', lifecycleClass: 'GREEN_SLOW_PREFERENCE', sourceRoute: 'PREFERENCE',
    states: [state('AGGRESSIVE', '積極走塁'), state('BALANCED', '標準', 'neutral')],
    editor: 'PREFERENCE', availability: 'EXECUTABLE', calibrationId: calibration.runningAggression.id,
    sourcePaths: ['physical.baserunningSafetyMarginSeconds'], effectOwner: 'LiveRunnerAdvancePolicyV1 safety margin',
    sourceDefinition: 'canonical09 §5.11 / §6; no speed, reaction or rounding boost' },
  { familyId: 'fielding_aggression', label: '守備積極性', lifecycleClass: 'GREEN_SLOW_PREFERENCE', sourceRoute: 'PREFERENCE',
    states: [state('AGGRESSIVE', '積極守備'), state('BALANCED', '標準', 'neutral'), state('CAUTIOUS', '慎重守備')],
    editor: 'PREFERENCE', availability: 'EXECUTABLE', calibrationId: calibration.fieldingAggression.id,
    sourcePaths: ['physical.fieldingPursuitCostWeight'], effectOwner: 'LiveFieldHandlerSelectionV1 pursuit preference / V106 double play / V108 first-base attempts',
    sourceDefinition: '近くを通る際どい打球は、届く保証がなくても捕球を試みます。積極守備は挑戦を広げ、慎重守備は確実さとカバーを重視します。送球や併殺も距離と走者の到達を比べて選びます。基礎能力・球速・反応・手の届く範囲やアウト判定は変わりません。' },
  { familyId: 'pitch_approach', label: '投球傾向', lifecycleClass: 'GREEN_SLOW_PREFERENCE', sourceRoute: 'PREFERENCE',
    states: [state('FASTBALL', '速球中心'), state('BALANCED', '標準', 'neutral'), state('BREAKING', '変化球中心')],
    editor: 'PREFERENCE', availability: 'EXECUTABLE', sourcePaths: [], effectOwner: 'Host AUTO pitch selection',
    sourceDefinition: 'canonical09 §5.11 / §6; accepted explicit pitch commands take priority' },
  { familyId: 'swing_mode_preference', label: '打撃傾向', lifecycleClass: 'GREEN_SLOW_PREFERENCE', sourceRoute: 'PREFERENCE',
    states: [state('POWER', '強振多用'), state('BALANCED', '標準', 'neutral'), state('CONTACT', 'ミート多用')],
    editor: 'PREFERENCE', availability: 'EXECUTABLE', sourcePaths: [], effectOwner: 'Host AUTO batting motor selection',
    sourceDefinition: 'canonical09 §5.11 / §6; accepted explicit batting commands take priority' },
]);
const catalog: readonly LiveTraitDefinitionV1[] = freeze([...legacyCatalog, ...getTechnicalTraitDefinitionsV75()]);
export const getLiveTraitCatalogV1 = (options?: Readonly<{includeTechnical?:boolean}>): readonly LiveTraitDefinitionV1[] => options?.includeTechnical ? catalog : legacyCatalog;
/** Independent authoring is explicitly versioned; the original catalog stays unchanged. */
export const getLiveTraitCatalogV77 = (): readonly LiveTraitDefinitionV1[] => freeze([
  ...legacyCatalog.map(definition => ['throw_accuracy', 'bad_ball_hitting', 'plate_aggression', 'running_aggression', 'fielding_aggression'].includes(definition.familyId)
    ? { ...definition, editor: ['throw_accuracy', 'bad_ball_hitting'].includes(definition.familyId) ? 'TECHNIQUE' as const : 'PREFERENCE' as const,
      availability: 'EXECUTABLE' as const, sourcePaths: ['traitProfile.selections.source.effectScale'],
      sourceDefinition: 'V77 independent execution technique; base SI and public abilities are unchanged. LOCAL_AUTHORING_ONLY, not empirically calibrated.' }
    : definition), ...getTechnicalTraitDefinitionsV77(),
  { familyId:'breaking_ball_quality', label:'キレ', lifecycleClass:'LEARNED_MASTERY_PERSISTENT', sourceRoute:'SOURCE_EXECUTION',
    states:[state('KIRE_CIRCLE','キレ○','blue'),state('KIRE_DOUBLE_CIRCLE','キレ◎','blue'),
      state('THREATENING_DOUBLE_CIRCLE','驚異の切れ味','gold')],
    editor:'PITCH_QUALITY', availability:'UNAVAILABLE', calibrationId:'kire_release_recipe_v177',
    sourcePaths:['traitProfile.selections.source.recipeVersion','pitcher.pitchQualityV177'],
    effectOwner:'No current physical effect; selection is retained for authoring',
    sourceDefinition:'Three-state selection and recipe version are retained for authoring; physical effect is unavailable.' },
]);
/** Connected 2026-11-02 under 08/09. A family here has a stated route into the match:
 * EMOTION feeds the Appraisal response and nothing else; TECHNICAL becomes a technique
 * control; PHYSICAL a resolved runner or delivery value; SITUATION a per-pitch resolution
 * of the player's own execution inputs. Every coefficient is authored and uncalibrated. */
type ConnectedRouteV1 = 'EMOTION' | 'TECHNICAL' | 'PHYSICAL' | 'SITUATION';
type ConnectedTier = readonly [stateId: string, label: string, color: TraitColor, strength: number];
const CONNECTED_CALIBRATION_V1 = 'local-trait-connection-v1-not-empirically-calibrated';
const GRADE_STRENGTHS: readonly (readonly [string, number])[] = [['G', -1], ['F', -.65], ['E', -.3], ['D', 0], ['C', .3], ['B', .6], ['A', .8]];
const graded = (name: string, gold: string, extras: Readonly<{ redExtreme?: string; strengths?: typeof GRADE_STRENGTHS; goldStrength?: number }> = {}): readonly ConnectedTier[] => [
  ...(extras.redExtreme ? [['RED_EXTREME', extras.redExtreme, 'red', -1.25] as ConnectedTier] : []),
  ...(extras.strengths ?? GRADE_STRENGTHS).map(([id, strength]): ConnectedTier => [id, name + id, ['A', 'B'].includes(id) ? 'blue' : ['F', 'G'].includes(id) ? 'red' : 'neutral', strength]),
  ['GOLD', gold, 'gold', extras.goldStrength ?? 1]];
const learned = (name: string, master?: string): readonly ConnectedTier[] => [['LEARNED', name, 'blue', .5], ...(master ? [['MASTERED', master, 'gold', 1] as ConnectedTier] : [])];
const QUICK_GOLD_STRENGTH = Math.log(2.5) / Math.log(1.8);
const QUICK_STRENGTHS: typeof GRADE_STRENGTHS = [['G', -1], ['F', -.65], ['E', -.3], ['D', 0], ['C', .33], ['B', .67], ['A', 1]];
const connected = (familyId: string, label: string, lifecycleClass: string, route: ConnectedRouteV1, tiers: readonly ConnectedTier[], effectOwner: string, sourceDefinition: string, preference = false) => ({
  route, strength: Object.fromEntries(tiers.map(tier => [tier[0], tier[3]])) as Readonly<Record<string, number>>,
  definition: { familyId, label, lifecycleClass, sourceRoute: preference ? 'PREFERENCE' as const : 'SOURCE_EXECUTION' as const,
    states: tiers.map(([stateId, name, color]) => state(stateId, name, color)), editor: preference ? 'PREFERENCE' as const : 'TECHNIQUE' as const, availability: 'EXECUTABLE' as const,
    calibrationId: CONNECTED_CALIBRATION_V1, sourcePaths: ['traitProfile.selections.source.effectScale'], effectOwner, sourceDefinition: sourceDefinition + ' ' + CONNECTED_CALIBRATION_V1,
    displayNote: sourceDefinition.slice(sourceDefinition.indexOf(': ') + 2) } });
const appraisal = 'LiveEmotionV1 Appraisal response', zoneError = 'LivePitchV1 zone hit error scale', command = 'LivePitchV1 command error', plan = 'LivePitchTargetPlanV111 auto target plan',
  running = 'LiveBaseRunningV1', situation = 'Per-pitch situation resolution';
const connectedFamilies = [
  connected('pitch_pressure', '対ピンチ / 強心臓 / ノミの心臓 / 要所○', 'GRADED_DYNAMIC', 'EMOTION', graded('対ピンチ', '強心臓', { redExtreme: 'ノミの心臓' }), appraisal, '09 §4.6 / 05 §3.1: ピンチの受け取り方の差です。感情が動かない限り、能力は変わりません。'),
  connected('bat_pressure', 'チャンス / 勝負師', 'GRADED_DYNAMIC', 'EMOTION', graded('チャンス', '勝負師'), appraisal, '09 §5.4 / 05 §3.1: 好機の受け取り方の差です。満塁・サヨナラ・決勝打も同じ系統で、打率へ直接足しません。'),
  connected('setback_recovery', '打たれ強さ / 不屈の魂', 'GRADED_DYNAMIC', 'EMOTION', graded('打たれ強さ', '不屈の魂'), appraisal, '09 §4.6: 良くない出来事の後の感情の戻りやすさです。'),
  connected('anger_response', '短気', 'CAUSAL_NEGATIVE_DYNAMIC', 'EMOTION', [['ACTIVE', '短気', 'red', 1]], appraisal, '09 §4.6: 怒りが動きやすい気質です。感情が動かない限り、能力は変わりません。'),
  connected('trailing_motivation', '逆境○ / 火事場の馬鹿力', 'LEARNED_MASTERY_PERSISTENT', 'EMOTION', learned('逆境○', '火事場の馬鹿力'), appraisal, '09 §5.4: 負けている試合の受け取り方です。点差から打力を上げません。'),
  connected('inside_zone_hitting', 'インコースヒッター / 内角必打', 'LEARNED_MASTERY_PERSISTENT', 'TECHNICAL', learned('インコースヒッター', '内角必打'), zoneError, '09 §5.2: 内角と読んだ球のスイングだけ、位置と時刻の誤差を抑えます。'),
  connected('outside_zone_hitting', 'アウトコースヒッター / 外角必打', 'LEARNED_MASTERY_PERSISTENT', 'TECHNICAL', learned('アウトコースヒッター', '外角必打'), zoneError, '09 §5.2: 外角と読んだ球のスイングだけ、位置と時刻の誤差を抑えます。'),
  connected('fastball_recognition', '対ストレート○', 'LEARNED_MASTERY_PERSISTENT', 'TECHNICAL', learned('対ストレート○'), zoneError, '09 §5.2: 速球系へのタイミング技術です。一般の選球眼は変えません。'),
  connected('breaking_ball_recognition', '対変化球○', 'LEARNED_MASTERY_PERSISTENT', 'TECHNICAL', learned('対変化球○'), zoneError, '09 §5.2: 変化球系へのタイミング技術です。一般の選球眼は変えません。'),
  connected('opposite_field_technique', '流し打ち / 芸術的流し打ち', 'LEARNED_MASTERY_PERSISTENT', 'TECHNICAL', learned('流し打ち', '芸術的流し打ち'), zoneError, '09 §5.1: 逆方向を狙うスイングの再現性です。'),
  connected('pull_side_transfer', 'プルヒッター / 引っ張り屋', 'LEARNED_MASTERY_PERSISTENT', 'TECHNICAL', learned('プルヒッター', '引っ張り屋'), zoneError, '09 §5.1: 引っ張るスイングの再現性です。'),
  connected('multi_direction_contact', '広角打法 / 広角砲', 'LEARNED_MASTERY_PERSISTENT', 'TECHNICAL', learned('広角打法', '広角砲'), zoneError, '09 §5.1: 中央以外の方向を狙うスイングの再現性です。'),
  connected('pitch_platoon_left', '対左打者 / 左キラー', 'GRADED_DYNAMIC', 'TECHNICAL', graded('対左打者', '左キラー'), command, '09 §4.6: 左打者への投球だけ狙いの誤差に作用します。基礎制球は変えません。'),
  connected('diagonal_command', 'クロスファイヤー / クロスキャノン', 'LEARNED_MASTERY_PERSISTENT', 'TECHNICAL', learned('クロスファイヤー', 'クロスキャノン'), command, '09 §4.2: 放す腕と反対側を狙う対角の投球だけ、狙いの誤差を抑えます。'),
  connected('dangerous_miss', '一発 / 逃げ球 / 本塁打厳禁', 'CAUSAL_NEGATIVE_DYNAMIC', 'TECHNICAL', [['DANGEROUS', '一発', 'red', -1], ['SAFE', '逃げ球', 'blue', .5], ['GOLD', '本塁打厳禁', 'gold', 1]], command, '09 §4.2: 大きく外れた時の外れ方の分布です。本塁打の確率は変えません。'),
  connected('release_miss_pattern', '抜け球', 'CAUSAL_NEGATIVE_DYNAMIC', 'TECHNICAL', [['DIRECTIONAL_MISS', '抜け球', 'red', 1]], command, '09 §4.2: 大きく外れた時に、上と腕の側へ抜けやすくなります。'),
  connected('early_count_approach', 'ボール先行 / ストライク先行', 'GREEN_SLOW_PREFERENCE', 'TECHNICAL', [['BALL_FIRST', 'ボール先行', 'red', -1], ['NEUTRAL', '標準', 'neutral', 0], ['STRIKE_FIRST', 'ストライク先行', 'green', 1]], plan, '09 §4.2: 序盤カウントの狙い方の好みです。明示したコースが優先されます。', true),
  connected('walk_prone_approach', '四球', 'CAUSAL_NEGATIVE_DYNAMIC', 'TECHNICAL', [['WALK_PRONE', '四球', 'red', 1]], plan, '09 §4.2: 際どい所を狙いすぎる傾向です。制球は変えません。'),
  connected('pitch_strong_batter_response', '対強打者○ / 主砲キラー', 'LEARNED_MASTERY_PERSISTENT', 'TECHNICAL', learned('対強打者○', '主砲キラー'), plan, '09 §4.3: 強打者への狙い所の判断です。投げる球は変えません。'),
  connected('stealing', '盗塁 / 電光石火', 'GRADED_DYNAMIC', 'PHYSICAL', graded('盗塁', '電光石火'), running, '09 §5.6: リードとスタートです。最高走速と加速度は変えません。'),
  connected('steal_aggression', '積極盗塁 / 慎重盗塁', 'GREEN_SLOW_PREFERENCE', 'PHYSICAL', [['AGGRESSIVE', '積極盗塁', 'green', 1], ['BALANCED', '標準', 'neutral', 0], ['CAUTIOUS', '慎重盗塁', 'green', -1]], running, '09 §6.2 / 08 §8: 指示がない時の企図の傾向です。監督の指示が優先されます。', true),
  connected('quick_delivery', 'クイック / 走者釘付', 'GRADED_DYNAMIC', 'PHYSICAL', graded('クイック', '走者釘付', { strengths: QUICK_STRENGTHS, goldStrength: QUICK_GOLD_STRENGTH }), running, '09 §4.5: 始動から放すまでの時間です。Gは標準の1.8倍、Aは1/1.8、走者釘付は1/2.5までです。'),
  connected('pickoff_technique', '牽制○', 'LEARNED_MASTERY_PERSISTENT', 'PHYSICAL', [['LEARNED', '牽制○', 'blue', 1]], running, '09 §4.5: 牽制の動作の速さです。'),
  connected('runner_threat_attention', 'かく乱 / トリックスター', 'LEARNED_MASTERY_PERSISTENT', 'PHYSICAL', learned('かく乱', 'トリックスター'), running, '09 §5.6: 走者の脅威が投手の注意を引き、牽制が増えます。投手の能力は変えません。'),
  connected('pitch_velocity_consistency', '球速安定', 'DYNAMIC_DESCRIPTOR', 'PHYSICAL', [['STABLE', '球速安定', 'blue', 1]], 'LivePitchV1 release speed spread', '09 §4.1: 球速のばらつきの幅です。平均球速は変えません。'),
  connected('first_pitch_execution', '初球○ / 一球入魂', 'LEARNED_MASTERY_PERSISTENT', 'SITUATION', learned('初球○', '一球入魂'), situation, '09 §5.2: 打席の初球だけ、スイングの誤差を抑えます。'),
  connected('two_strike_adjustment', '粘り打ち', 'LEARNED_MASTERY_PERSISTENT', 'SITUATION', learned('粘り打ち'), situation, '09 §5.1: 追い込まれた後の時刻の誤差を抑えます。'),
  connected('two_strike_narrow_options', '窮地○ / ヒートアップ', 'LEARNED_MASTERY_PERSISTENT', 'SITUATION', learned('窮地○', 'ヒートアップ'), situation, '09 §5.3: 追い込まれた後の位置の誤差を抑えます。'),
  connected('two_strike_weakness', '三振 / 扇風機', 'CAUSAL_NEGATIVE_DYNAMIC', 'SITUATION', [['RED', '三振', 'red', .5], ['RED_EXTREME', '扇風機', 'red', 1]], situation, '09 §5.3 / §8.2: 追い込まれた後の認識と調整の弱さです。'),
  connected('cut_contact', 'カット打ち', 'LEARNED_MASTERY_PERSISTENT', 'SITUATION', learned('カット打ち'), situation, '09 §5.1: 追い込まれた後、遅めの接触へ寄せて位置の誤差を抑えます。'),
  connected('power_swing_generation', 'パワーヒッター / アーチスト', 'LEARNED_MASTERY_PERSISTENT', 'SITUATION', learned('パワーヒッター', 'アーチスト'), situation, '09 §5.1 / §3.3: 強振した時だけ、バットの上向きの軌道を作ります。最大バット速度は変えません。'),
  connected('bat_platoon_left', '対左投手 / 左腕キラー', 'GRADED_DYNAMIC', 'SITUATION', graded('対左投手', '左腕キラー'), situation, '09 §5.5: 左投手の球の認識だけに作用します。'),
  connected('pitch_putaway_execution', '奪三振 / ドクターK', 'LEARNED_MASTERY_PERSISTENT', 'SITUATION', learned('奪三振', 'ドクターK'), situation, '09 §4.3: 追い込んだ打者への投球だけ、狙いの誤差を抑えます。'),
  connected('runner_on_base_stability', '対ランナー○', 'LEARNED_MASTERY_PERSISTENT', 'SITUATION', learned('対ランナー○'), situation, '09 §4.5: 走者がいる時の投球の安定です。赤版の対ランナーではありません。'),
] as const;
const connectedById = new Map<string, (typeof connectedFamilies)[number]>(connectedFamilies.map(family => [family.definition.familyId, family]));
let connectedCatalog: readonly LiveTraitDefinitionV1[] | undefined;
/** V77 stays exactly as it was; a v2 profile reads this superset, so old saves load unchanged. */
export const getLiveTraitCatalogConnectedV1 = (): readonly LiveTraitDefinitionV1[] => connectedCatalog ??= freeze([...getLiveTraitCatalogV77(), ...connectedFamilies.map(family => family.definition)]);
export const isLiveConnectedTraitV1 = (id: string) => connectedById.has(id);
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error('live trait profiles: ' + message); }
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.trim() === value && value.length <= 160;
const object = (value: unknown, fields: readonly string[], path: string): Record<string, unknown> => {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'invalid ' + path);
  const record = value as Record<string, unknown>;
  assert(Object.keys(record).length === fields.length && fields.every(key => Object.hasOwn(record, key)), 'invalid fields ' + path);
  return record;
};
const range = (value: unknown, min: number, max: number): number => {
  assert(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max, 'invalid technical source');
  return value;
};
const virtual = (id: string) => id === 'pitch_approach' || id === 'swing_mode_preference' || isTechnicalTraitV75(id);
const scalarKey = (id: string): string | null => ({ bad_ball_hitting: 'badBallControl', throw_accuracy: 'throwDirectionStdRadians',
  running_aggression: 'baserunningSafetyMarginSeconds', fielding_aggression: 'fieldingPursuitCostWeight' } as Record<string, string>)[id] ?? null;
const sourceKeys = (id: string): readonly string[] => isTechnicalTraitV75(id) ? ['effectScale'] : virtual(id) ? [] : id === 'plate_aggression'
  ? ['swingDecision.threshold', 'swingDecision.aggressionWeight', 'swingDecision.approach'] : [scalarKey(id)!];
function readSource(raw: unknown, id: string, independent = false): LiveTraitSourceV1 {
  if (independent && connectedById.has(id)) { const source = object(raw, ['effectScale'], 'connected source'); range(source.effectScale, 0, 2); return source as LiveTraitSourceV1; }
  if (independent && id === 'breaking_ball_quality') {
    const source = object(raw, ['recipeVersion'], 'pitch quality source');
    assert(source.recipeVersion === 'kire_release_recipe_v177', 'unsupported pitch quality recipe version');
    return source as LiveTraitSourceV1;
  }
  if (independent && ['throw_accuracy', 'plate_aggression', 'running_aggression', 'fielding_aggression', 'bad_ball_hitting'].includes(id)) {
    const source = object(raw, id === 'bad_ball_hitting' ? ['badBallControl', 'effectScale'] : ['effectScale'], 'independent source');
    range(source.effectScale, 0, 2);
    if (id === 'bad_ball_hitting') range(source.badBallControl, 0, 1);
    return source as LiveTraitSourceV1;
  }
  const source = object(raw, sourceKeys(id), 'source');
  if (isTechnicalTraitV75(id)) range(source.effectScale, 0, 2);
  else if (id === 'bad_ball_hitting') range(source.badBallControl, 0, 1);
  else if (id === 'throw_accuracy') range(source.throwDirectionStdRadians, 0, .12);
  else if (id === 'running_aggression') range(source.baserunningSafetyMarginSeconds, 0, 3);
  else if (id === 'fielding_aggression') range(source.fieldingPursuitCostWeight, .25, 4);
  else if (id === 'plate_aggression') {
    range(source['swingDecision.threshold'], 0, 1); range(source['swingDecision.aggressionWeight'], 0, 1);
    assert(source['swingDecision.approach'] === 'AUTO', 'forced plate source cannot become a green preference');
  }
  return source as LiveTraitSourceV1;
}
const readProfile = (raw: unknown): LiveTraitProfileV1 => {
  const profile = object(cloneInert(raw), ['version', 'selections'], 'profile');
  assert(['live_trait_profile_v1', 'live_trait_profile_v2'].includes(profile.version as string) && Array.isArray(profile.selections), 'unsupported profile');
  const independent = profile.version === 'live_trait_profile_v2', definitions = independent ? getLiveTraitCatalogConnectedV1() : catalog;
  const seen = new Set<string>();
  const selections = (profile.selections as unknown[]).map(rawSelection => {
    const selection = object(rawSelection, ['familyId', 'stateId', 'source'], 'selection'),
      definition = definitions.find(item => item.familyId === selection.familyId);
    assert(definition && !seen.has(definition.familyId), 'unknown or duplicate trait family');
    seen.add(definition.familyId);
    assert(definition.editor !== 'GRADE', 'a source-derived grade must not be saved as a second trait effect');
    assert(selection.stateId === null || definition.states.some(value => value.stateId === selection.stateId), 'unsupported family state');
    return { familyId: definition.familyId, stateId: selection.stateId as string | null, source: readSource(selection.source, definition.familyId, independent) };
  });
  return { version: profile.version as LiveTraitProfileV1['version'], selections };
};
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
type Selection = LiveTraitProfileV1['selections'][number];
function effectiveSource(selection: Selection): LiveTraitSourceV1 {
  const { familyId: id, source, stateId } = selection;
  if (id === 'bad_ball_hitting') return { badBallControl: stateId === null ? 0 : source.badBallControl };
  if (id === 'running_aggression') return { baserunningSafetyMarginSeconds: stateId === 'AGGRESSIVE'
    ? clamp(Number(source.baserunningSafetyMarginSeconds) + calibration.runningAggression.offsetSeconds, 0, 3) : source.baserunningSafetyMarginSeconds };
  if (id === 'fielding_aggression') return { fieldingPursuitCostWeight: stateId === 'AGGRESSIVE'
    ? clamp(Number(source.fieldingPursuitCostWeight) * calibration.fieldingAggression.costMultiplier, .25, 4)
    : stateId === 'CAUTIOUS' ? clamp(Number(source.fieldingPursuitCostWeight) / calibration.fieldingAggression.costMultiplier, .25, 4) : source.fieldingPursuitCostWeight };
  if (id === 'plate_aggression') return { ...source, 'swingDecision.threshold': clamp(Number(source['swingDecision.threshold'])
    + (stateId === 'AGGRESSIVE' ? -calibration.plateAggression.thresholdOffset : stateId === 'CAUTIOUS' ? calibration.plateAggression.thresholdOffset : 0), 0, 1) };
  return {};
}
const getPath = (source: unknown, path: string): unknown => path.split('.').reduce<unknown>((value, key) =>
  value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, source);
const sameSource = (a: LiveTraitSourceV1 | null, b: LiveTraitSourceV1 | null) => a === null || b === null ? a === b
  : Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => a[key] === b[key]);
/** The final merged execution source is checked, never multiplied again. */
export function validateLiveTraitProfileV1(raw: unknown, physical: LiveTraitPhysicalSourceV54): LiveTraitProfileV1 {
  const profile = readProfile(raw), source = cloneInert(physical);
  for (const selection of profile.version === 'live_trait_profile_v2' ? [] : profile.selections) for (const [key, expected] of Object.entries(effectiveSource(selection)))
    assert(getPath(source, key) === expected, 'trait profile contradicts the executed technical source');
  return freeze(profile);
}
type Entry = LiveTraitRosterInputV1['entries'][number];
function physicalSource(entry: Entry): LiveTraitPhysicalSourceV54 {
  assert(!(entry.physical && entry.workbenchPlayer), 'ambiguous physical and workbench sources');
  return entry.physical ?? (entry.workbenchPlayer ? { badBallControl: entry.workbenchPlayer.traits.badBallControl,
    ...(entry.workbenchPlayer.decision === undefined ? {} : { swingDecision: entry.workbenchPlayer.decision }) } : {});
}
function currentSource(entry: Entry, id: string): LiveTraitSourceV1 | null {
  const source = physicalSource(entry), key = scalarKey(id);
  if (isTechnicalTraitV75(id)) return entry.traitProfile?.selections.find((s:Selection)=>s.familyId===id)?.source??{effectScale:1};
  if (virtual(id)) return {};
  if (id === 'plate_aggression') {
    const decision = source.swingDecision ?? { approach: 'AUTO', threshold: calibration.plateAggression.defaultThreshold,
      aggressionWeight: calibration.plateAggression.defaultAggressionWeight };
    range(decision.threshold, 0, 1); range(decision.aggressionWeight, 0, 1);
    assert(['AUTO', 'TAKE', 'SWING'].includes(decision.approach), 'invalid plate approach source');
    return { 'swingDecision.threshold': decision.threshold, 'swingDecision.aggressionWeight': decision.aggressionWeight, 'swingDecision.approach': decision.approach };
  }
  const value = getPath(source, key!);
  if (value === undefined && (id === 'bad_ball_hitting' || id === 'throw_accuracy')) return null;
  return readSource({ [key!]: value ?? (id === 'running_aggression' ? calibration.runningAggression.defaultSource : calibration.fieldingAggression.defaultSource) }, id);
}
const sourceTextV101 = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200 && value.trim() === value;
function context(raw: LiveTraitRosterInputV1, playerId: string, verifySources = true) {
  const roster = cloneInert(raw);
  assert(roster.version === 'live_physical_roster_v1' && sourceTextV101(roster.sourceId) && Array.isArray(roster.entries), 'invalid roster');
  const ids = new Set<string>();
  for (const entry of roster.entries) {
    assert(sourceTextV101(entry.playerId) && sourceTextV101(entry.sourceId) && !ids.has(entry.playerId), 'invalid or duplicate player source');
    ids.add(entry.playerId);
    const source = physicalSource(entry);
    if (entry.traitProfile !== undefined) {
      readProfile(entry.traitProfile);
      if (verifySources) validateLiveTraitProfileV1(entry.traitProfile, source);
    }
  }
  const entry = roster.entries.find(item => item.playerId === playerId);
  assert(entry, 'unknown player');
  return { roster, entry };
}
const displaySource = (id: string, source: LiveTraitSourceV1 | null): number | LiveTraitSourceV1 | null =>
  source === null ? null : scalarKey(id) ? Number(source[scalarKey(id)!]) : source;
export function projectLiveTraitProfilesV1(input: Readonly<{ roster: LiveTraitRosterInputV1; playerId: string; includeTechnical?:boolean }>) {
  const { entry } = context(input.roster, input.playerId);
  return freeze({ boundary: 'LOCAL_TRAIT_AUTHORING_ONLY' as const, nativeMasteryAuthenticated: false as const,
    catalogVersion: input.includeTechnical ? 75 : 54, calibrationVersion: calibration.version, calibrationAuthority: calibration.authority,
    traits: getLiveTraitCatalogV1({includeTechnical:input.includeTechnical}).map(definition => {
      const current = currentSource(entry, definition.familyId), selection = entry.traitProfile?.selections.find((item: Selection) => item.familyId === definition.familyId),
        derived = definition.editor === 'GRADE' && current !== null ? deriveLiveThrowAccuracyGradeV54(Number(current.throwDirectionStdRadians)) : null,
        owned = derived !== null ? true : selection ? selection.stateId !== null : null,
        stateId = derived ?? selection?.stateId ?? null, selectedState = definition.states.find(value => value.stateId === stateId);
      return { familyId: definition.familyId, label: definition.label,
        status: derived !== null ? 'DERIVED' as const : owned === null ? 'UNASSESSED' as const : owned ? 'OWNED' as const : 'ABSENT' as const,
        owned, stateId, color: selectedState?.color ?? 'neutral',
        sourceValue: displaySource(definition.familyId, selection?.source ?? current), effectiveSourceValue: displaySource(definition.familyId, current),
        sourcePath: definition.familyId === 'bad_ball_hitting' ? entry.workbenchPlayer ? 'workbenchPlayer.traits.badBallControl' : 'physical.badBallControl'
          : definition.sourcePaths[0] ?? 'traitProfile.selections', sourceRoute: definition.sourceRoute,
        editor: definition.editor, availability: definition.availability, states: definition.states, calibrationId: definition.calibrationId ?? null };
    }) });
}
type MutableEntry = { sourceId: string; traitProfile?: LiveTraitProfileV1; physical?: Record<string, unknown>;
  workbenchPlayer?: { traits: { badBallControl: number } } };
function markEdited(roster: LiveTraitRosterInputV1, entry: Entry) {
  const mutable = entry as unknown as MutableEntry, mutableRoster = roster as unknown as { sourceId: string };
  mutable.sourceId = markLiveAuthoringSourceV101(mutable.sourceId, 'trait-edited');
  mutableRoster.sourceId = markLiveAuthoringSourceV101(mutableRoster.sourceId, 'trait-edited');
  assert(text(mutable.sourceId) && text(mutableRoster.sourceId), 'source identifier exceeds the authoring limit');
}
function writeSource(entry: Entry, id: string, source: LiveTraitSourceV1) {
  const mutable = entry as unknown as MutableEntry;
  if (id === 'bad_ball_hitting' && mutable.workbenchPlayer) mutable.workbenchPlayer.traits.badBallControl = Number(source.badBallControl);
  else if (!virtual(id)) {
    assert(mutable.physical, 'an explicit physical source owner is required for this trait');
    if (id === 'plate_aggression') mutable.physical.swingDecision = { approach: source['swingDecision.approach'],
      threshold: source['swingDecision.threshold'], aggressionWeight: source['swingDecision.aggressionWeight'] };
    else for (const [key, value] of Object.entries(source)) mutable.physical[key] = value;
  }
}
export function setLiveTraitProfileV1(input: Readonly<{ roster: LiveTraitRosterInputV1; playerId: string;
  familyId: string; stateId: string | null; source?: LiveTraitSourceV1 }>) {
  const request = cloneInert(input), { roster, entry } = context(request.roster, request.playerId),
    definition = catalog.find(item => item.familyId === request.familyId);
  assert(entry.traitProfile?.version !== 'live_trait_profile_v2', 'independent profiles require the V77 authoring API');
  assert(definition && (request.stateId === null || definition.states.some(value => value.stateId === request.stateId)), 'unknown family or state');
  const id = definition.familyId, current = currentSource(entry, id), explicit = request.source === undefined ? null : readSource(request.source, id),
    changes: { path: string; before: unknown; after: unknown }[] = [];
  if (isTechnicalTraitV75(id)) {
    const previous=entry.traitProfile?.selections.find((s:Selection)=>s.familyId===id), source=explicit??previous?.source??{effectScale:1};
    if(previous?.stateId!==request.stateId||!sameSource(previous.source,source)){
      const selection={familyId:id,stateId:request.stateId,source:readSource(source,id)};
      (entry as unknown as MutableEntry).traitProfile={version:'live_trait_profile_v1',selections:[...(entry.traitProfile?.selections??[]).filter((s:Selection)=>s.familyId!==id),selection]};
      changes.push({path:'traitProfile.selections.'+id,before:previous??null,after:selection});markEdited(roster,entry);
    }
    return freeze({roster,projection:projectLiveTraitProfilesV1({roster,playerId:request.playerId,includeTechnical:true}),changes});
  }
  if (definition.editor === 'GRADE') {
    assert(request.stateId !== null && entry.physical, 'a source-derived grade requires an explicit physical owner and tier');
    if (explicit === null && current !== null && deriveLiveThrowAccuracyGradeV54(Number(current.throwDirectionStdRadians)) === request.stateId)
      return freeze({ roster, projection: projectLiveTraitProfilesV1({ roster, playerId: request.playerId }), changes });
    const source = explicit ?? { throwDirectionStdRadians: getLiveThrowAccuracySourceV54(request.stateId) };
    assert(deriveLiveThrowAccuracyGradeV54(Number(source.throwDirectionStdRadians)) === request.stateId, 'throw grade contradicts its authored source');
    if (!sameSource(current, source)) {
      writeSource(entry, id, source); markEdited(roster, entry);
      changes.push({ path: 'physical.throwDirectionStdRadians', before: current?.throwDirectionStdRadians ?? null, after: source.throwDirectionStdRadians });
    }
    return freeze({ roster, projection: projectLiveTraitProfilesV1({ roster, playerId: request.playerId }), changes });
  }
  assert(virtual(id) || entry.physical || id === 'bad_ball_hitting' && entry.workbenchPlayer, 'an explicit numerical source owner is required');
  if (id === 'plate_aggression') assert(current?.['swingDecision.approach'] === 'AUTO', 'forced plate source cannot become a green preference');
  const previousProfile = entry.traitProfile, previous = previousProfile?.selections.find((item: Selection) => item.familyId === id),
    retained = explicit ?? previous?.source ?? current ?? { badBallControl: 0 },
    selection = { familyId: id, stateId: request.stateId, source: readSource(retained, id) }, effective = effectiveSource(selection);
  if (previous?.stateId === request.stateId && sameSource(previous.source, retained) && sameSource(current, effective))
    return freeze({ roster, projection: projectLiveTraitProfilesV1({ roster, playerId: request.playerId }), changes });
  if (id === 'bad_ball_hitting') assert(request.stateId === null || explicit !== null || Number(retained.badBallControl) > 0,
    'an explicit technique source is required for initial zero or missing control');
  const mutable = entry as unknown as MutableEntry;
  mutable.traitProfile = { version: 'live_trait_profile_v1', selections: [
    ...(previousProfile?.selections.filter((item: Selection) => item.familyId !== id) ?? []), selection] };
  changes.push({ path: 'traitProfile', before: cloneInert(previousProfile ?? null), after: cloneInert(mutable.traitProfile) });
  const beforeValues = Object.fromEntries(Object.keys(effective).map(key => [key, getPath(physicalSource(entry), key) ?? null]));
  writeSource(entry, id, effective);
  for (const [key, value] of Object.entries(effective)) if (beforeValues[key] !== value)
    changes.push({ path: id === 'bad_ball_hitting' && entry.workbenchPlayer ? 'workbenchPlayer.traits.badBallControl' : 'physical.' + key,
      before: beforeValues[key], after: value });
  markEdited(roster, entry);
  return freeze({ roster, projection: projectLiveTraitProfilesV1({ roster, playerId: request.playerId }), changes });
}
/** Stored preference is a local authoring input, not a learned career proof.
 * Runtime selection and accepted-command precedence stay with the Host. */
export function isLiveCautiousFieldingV117(profile?: LiveTraitProfileV1): boolean {
  const selection = profile === undefined ? undefined : readProfile(profile).selections.find(s => s.familyId === 'fielding_aggression');
  return selection?.stateId === 'CAUTIOUS' && Number(selection.source.effectScale ?? 1) > 0;
}
export function resolveLiveTraitPreferencesV54(profile?: LiveTraitProfileV1) {
  const selections = profile === undefined ? [] : readProfile(profile).selections,
    pitch = selections.find(item => item.familyId === 'pitch_approach')?.stateId,
    swing = selections.find(item => item.familyId === 'swing_mode_preference')?.stateId;
  return freeze({ pitchApproach: (pitch ?? 'BALANCED') as 'FASTBALL' | 'BALANCED' | 'BREAKING',
    swingMode: (swing ?? 'BALANCED') as 'POWER' | 'BALANCED' | 'CONTACT' });
}
/** After an explicit direct SI edit, retain technical ownership only when it
 * still describes that source. Green edits remove only that axis's baseline. */
export function reconcileLiveTraitSourcesV54(input: Readonly<{ roster: LiveTraitRosterInputV1; playerId: string; changedPaths: readonly string[] }>): LiveTraitRosterInputV1 {
  const request = cloneInert(input), { roster, entry } = context(request.roster, request.playerId, false);
  assert(Array.isArray(request.changedPaths) && request.changedPaths.every(text), 'invalid changed source paths');
  if (entry.traitProfile?.version === 'live_trait_profile_v2') { context(roster, request.playerId); return freeze(roster); }
  const paths = request.changedPaths.map(path => path.replace(/^physical\./, '')),
    touches = (id: string) => sourceKeys(id).some(key => paths.some(path => path === key || key.startsWith(path + '.') || path.startsWith(key + '.')));
  if (entry.traitProfile !== undefined) {
    const previous = readProfile(entry.traitProfile), selections = previous.selections.flatMap(selection => {
      const id = selection.familyId;
      if (virtual(id) || !touches(id)) return [selection];
      const current = currentSource(entry, id);
      if (id === 'bad_ball_hitting') {
        assert(current !== null, 'a directly edited bad-ball source must remain explicit');
        if (selection.stateId === null) {
          assert(current.badBallControl === 0, 'an absent bad-ball trait cannot infer ownership from a direct nonzero source');
          return [selection];
        }
        return [{ ...selection, source: current }];
      }
      return sameSource(current, effectiveSource(selection)) ? [selection] : [];
    });
    if (JSON.stringify(previous.selections) !== JSON.stringify(selections)) {
      (entry as unknown as MutableEntry).traitProfile = { version: 'live_trait_profile_v1', selections };
      markEdited(roster, entry);
    }
  }
  context(roster, request.playerId);
  return freeze(roster);
}

/** Public boundary uses the same strict profile parser as every other trait resolver. */
export function resolveLiveTechnicalTraitsV75(profile?: LiveTraitProfileV1): TechnicalSkillControlsV75 | undefined {
  const base=resolveValidatedTechnicalProfileV75(profile===undefined?undefined:readProfile(profile)),strengths=resolveLiveConnectedTraitsV1(profile),
    extra=Object.fromEntries(TECHNICAL_SKILL_IDS_CONNECTED_V1.flatMap(id=>strengths[id]===undefined?[]:[[id,strengths[id]!]]));
  return Object.keys(extra).length?Object.freeze({...base,...extra}):base;
}

/** Effective strength per connected family. Absent, null and zero-scale selections add nothing. */
export function resolveLiveConnectedTraitsV1(profile?: LiveTraitProfileV1): Readonly<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const { familyId, stateId, source } of profile === undefined ? [] : readProfile(profile).selections) {
    const family = connectedById.get(familyId);
    if (!family || stateId === null) continue;
    const strength = family.strength[stateId]! * Number(source.effectScale);
    if (strength !== 0) result[familyId] = strength;
  }
  return result;
}
const responseFrom = (strengths: Readonly<Record<string, number>>, table: Readonly<Record<string, Partial<Record<ResponseAxis, number>>>>) => {
  const response: Partial<Record<ResponseAxis, number>> = {};
  for (const [id, axes] of Object.entries(table)) if (strengths[id] !== undefined) for (const [axis, weight] of Object.entries(axes))
    response[axis as ResponseAxis] = (response[axis as ResponseAxis] ?? .5) + weight * strengths[id]!;
  for (const axis of Object.keys(response) as ResponseAxis[]) response[axis] = clamp(response[axis]!, 0, 1);
  return freeze(response);
};
const EMOTION_RESPONSE_V1 = { pitch_pressure: { stability: .3, confidence: .2 }, bat_pressure: { stability: .2, confidence: .15, competitiveness: .2 },
  setback_recovery: { stability: .25, experience: .15 }, anger_response: { aggression: .35, selfFocus: .15, stability: -.2 } } as const;
/** Pure bridge to LiveEmotionPlayerV1.response. The stable state enters the Appraisal only;
 * none of these families reaches the physical or technical channels, so a trait can never
 * act beside ActiveEmotion. Below the gate it changes nothing at all. */
export function liveEmotionResponseFromTraitsV1(profile?: LiveTraitProfileV1): Partial<Record<ResponseAxis, number>> {
  return responseFrom(resolveLiveConnectedTraitsV1(profile), EMOTION_RESPONSE_V1);
}
/** The whole response for an appraisal made while behind: 逆境○ is a response to trailing, so it adds only here. */
export function liveEmotionTrailingResponseFromTraitsV1(profile?: LiveTraitProfileV1): Partial<Record<ResponseAxis, number>> {
  return responseFrom(resolveLiveConnectedTraitsV1(profile), { ...EMOTION_RESPONSE_V1, trailing_motivation: { competitiveness: .3, confidence: .1 } });
}
export type LiveTraitPhysicalFieldsV1 = Readonly<{ stealSkillV1?: number; stealPreferenceV1?: number; deliverySecondsV1?: number; pickoffTechniqueV1?: number;
  runnerThreatV1?: number; velocitySpreadScaleV1?: number }>;
/** Resolved once with the physical object. Read by LiveBaseRunningV1 and the pitch release. */
export function resolveLivePhysicalTraitFieldsV1(profile?: LiveTraitProfileV1): LiveTraitPhysicalFieldsV1 {
  const s = resolveLiveConnectedTraitsV1(profile), quickState = profile?.selections.find(selection => selection.familyId === 'quick_delivery')?.stateId,
    quick = s.quick_delivery === undefined ? undefined : clamp(s.quick_delivery, -1, quickState === 'GOLD' ? QUICK_GOLD_STRENGTH : 1);
  return { ...(s.stealing === undefined ? {} : { stealSkillV1: s.stealing }), ...(s.steal_aggression === undefined ? {} : { stealPreferenceV1: s.steal_aggression }),
    ...(quick === undefined ? {} : { deliverySecondsV1: DELIVERY_SECONDS * 1.8 ** -quick }), ...(s.pickoff_technique === undefined ? {} : { pickoffTechniqueV1: s.pickoff_technique }),
    ...(s.runner_threat_attention === undefined ? {} : { runnerThreatV1: s.runner_threat_attention }),
    ...(s.pitch_velocity_consistency === undefined ? {} : { velocitySpreadScaleV1: 1 / (1 + s.pitch_velocity_consistency) }) };
}
const errorScale = (strength: number) => strength >= 0 ? 1 / (1 + .4 * strength) : 1 - .4 * strength;
export type LiveBatterSituationV1 = Readonly<{ balls: number; strikes: number; pitcherThrows: 'R' | 'L'; batting: string }>;
export type LivePitcherSituationV1 = Readonly<{ strikes: number; runnersOn: number }>;
/** One pitch's copy of the batter's execution inputs. The stored SI is never written back.
 * No connected trait returns the same object, so an old player's inputs stay exact. */
export function resolveLiveBatterSituationV1<T extends Readonly<{ timingStdSeconds?: number; aimStdMeters?: number; zoneJudgmentStdMeters?: number; technicalTimingOffsetSeconds?: number; attackAngleDegrees?: number }>>(
  physical: T, profile: LiveTraitProfileV1 | undefined, at: LiveBatterSituationV1): T {
  const s = resolveLiveConnectedTraitsV1(profile);
  let timing = 1, aim = 1, judgment = 1, late = 0, attack = 0;
  if (at.balls === 0 && at.strikes === 0 && s.first_pitch_execution !== undefined) { timing *= errorScale(s.first_pitch_execution); aim *= errorScale(s.first_pitch_execution); }
  if (at.strikes === 2) {
    if (s.two_strike_weakness !== undefined) { timing *= 1 + .6 * s.two_strike_weakness; judgment *= 1 + .6 * s.two_strike_weakness; }
    if (s.two_strike_adjustment !== undefined) timing *= errorScale(s.two_strike_adjustment);
    if (s.two_strike_narrow_options !== undefined) aim *= errorScale(s.two_strike_narrow_options);
    if (s.cut_contact !== undefined) { late = .008 * s.cut_contact; aim *= errorScale(s.cut_contact); }
  }
  if (at.batting === 'power' && s.power_swing_generation !== undefined) attack = 4 * s.power_swing_generation;
  if (at.pitcherThrows === 'L' && s.bat_platoon_left !== undefined) judgment *= 2 ** -s.bat_platoon_left;
  const patch: Record<string, number> = {};
  if (timing !== 1 && physical.timingStdSeconds !== undefined) patch.timingStdSeconds = clamp(physical.timingStdSeconds * timing, 0, .08);
  if (aim !== 1 && physical.aimStdMeters !== undefined) patch.aimStdMeters = clamp(physical.aimStdMeters * aim, 0, .35);
  if (judgment !== 1 && physical.zoneJudgmentStdMeters !== undefined) patch.zoneJudgmentStdMeters = clamp(physical.zoneJudgmentStdMeters * judgment, 0, .6);
  if (late !== 0) patch.technicalTimingOffsetSeconds = clamp((physical.technicalTimingOffsetSeconds ?? 0) + late, -.5, .5);
  if (attack !== 0 && physical.attackAngleDegrees !== undefined) patch.attackAngleDegrees = clamp(physical.attackAngleDegrees + attack, -80, 80);
  return Object.keys(patch).length ? { ...physical, ...patch } : physical;
}
export function resolveLivePitcherSituationV1<T extends Readonly<{ commandStdMeters?: number }>>(physical: T, profile: LiveTraitProfileV1 | undefined, at: LivePitcherSituationV1): T {
  const s = resolveLiveConnectedTraitsV1(profile), putaway = at.strikes === 2 ? s.pitch_putaway_execution ?? 0 : 0, runners = at.runnersOn > 0 ? s.runner_on_base_stability ?? 0 : 0;
  if ((putaway === 0 && runners === 0) || physical.commandStdMeters === undefined) return physical;
  return { ...physical, commandStdMeters: clamp(physical.commandStdMeters / (1 + .6 * putaway) / (1 + .4 * runners), 0, .6) };
}
