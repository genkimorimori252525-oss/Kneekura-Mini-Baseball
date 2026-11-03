import { appraiseEmotion } from '../../core/world/psychology/appraisal/SourceAppraisal';
import { RESPONSE_AXES, SITUATION_AXES, type AppraisalInput, type AppraisalRow, type ResponseAxis } from '../../core/world/psychology/appraisal/AppraisalTypes';
import { createEmotionState, getEmotionInfluence, restoreEmotionState } from '../../core/world/psychology/EmotionState';
import { evaluateEmotion } from '../../core/world/psychology/EmotionGate';
import { EMOTIONS, type EmotionDecisionEffects, type EmotionKind, type EmotionPolicy, type EmotionState } from '../../core/world/psychology/EmotionTypes';

/** Connects one match to the headless emotion gate. Below the threshold nothing
 * reaches a decision and no mark exists (05-psychology-emotion E-001, E-002).
 * Every coefficient here is authored and unmeasured; none is a player rating. */
export type LiveEmotionPolicyV1 = Readonly<{ version:'live_emotion_policy_v1'; sourceId:string; importance?:number }>;
export const LIVE_EMOTION_POLICY_V1:LiveEmotionPolicyV1 = Object.freeze({ version:'live_emotion_policy_v1', sourceId:'authored-live-emotion-v1' });
export type LiveEmotionPlayerV1 = Readonly<{ playerId:string; clubId:string; response?:Partial<Record<ResponseAxis,number>> }>;
export type LiveEmotionOutcomeV1 = 'homer'|'hit'|'walk'|'out'|'strikeout';
export type LiveEmotionEventV1 = Readonly<{ tick:number; batterId:string; pitcherId:string; outcome:LiveEmotionOutcomeV1;
  inning:number; regulationInnings:number; outs:number; runnersOn:number; scoringPosition:boolean; runDifference:number }>;
export type LiveEmotionInfluenceV1 = Readonly<{ emotion:EmotionKind; effects:EmotionDecisionEffects }>;
type Memory = { state:EmotionState; sequence:number; success:number; failure:number };

const POLICY:EmotionPolicy = Object.freeze({ policyId:'live-emotion-gate', version:'v1', clearAfterCalmEvents:3,
  thresholds:Object.freeze(EMOTIONS.map(emotion => Object.freeze({ emotion, activation:.55, sustain:.35 }))) }) as EmotionPolicy;
const zero = ():EmotionDecisionEffects => ({ swingDecisionShiftTicks:0, throwIntentShiftTicks:0, defenseReplanShiftTicks:0, swingAggressionDelta:0, throwAggressionDelta:0, runningRiskDelta:0 });
const row = (emotion:EmotionKind, bias:number, situation:Partial<AppraisalRow['situationWeights']>, response:Partial<AppraisalRow['responseWeights']>, effects:Partial<EmotionDecisionEffects>):AppraisalRow => ({
  emotion, bias, stabilityDamping:.6,
  situationWeights:{ ...Object.fromEntries(SITUATION_AXES.map(k => [k, 0])), ...situation } as AppraisalRow['situationWeights'],
  responseWeights:{ ...Object.fromEntries(RESPONSE_AXES.map(k => [k, 0])), ...response } as AppraisalRow['responseWeights'],
  effectsAtFullPressure:{ ...zero(), ...effects } });
// 焦りは判断を早め、怒りは強振へ寄り、恐怖は消極へ寄る。やる気は万能な能力上昇にしない。
const ROWS:readonly AppraisalRow[] = [
  row('FEAR', .06, { negativeSurprise:.3, localLeverage:.45, recentFailure:.3 }, { stability:-.5, experience:-.25, confidence:-.2 }, { swingAggressionDelta:-.22, runningRiskDelta:-.4 }),
  row('IMPATIENCE', .08, { negativeSurprise:.3, recentFailure:.45, localLeverage:.25 }, { experience:-.25, stability:-.25, judgment:-.1 }, { swingDecisionShiftTicks:-30_000, swingAggressionDelta:.1, defenseReplanShiftTicks:40_000 }),
  row('ANGER', -.22, { negativeSurprise:.25, recentFailure:.3, hostility:.5 }, { aggression:.5, selfFocus:.2, stability:-.35 }, { swingAggressionDelta:.2, throwAggressionDelta:.5 }),
  row('MOTIVATION', -.34, { positiveSurprise:.3, localLeverage:.45, recentSuccess:.2 }, { competitiveness:.45, confidence:.2 }, { swingAggressionDelta:.1 }),
  row('SUPERIORITY', -.4, { positiveSurprise:.4, recentSuccess:.4 }, { confidence:.3, selfFocus:.35 }, { swingAggressionDelta:.08, throwIntentShiftTicks:60_000, runningRiskDelta:.2 }),
].sort((a, b) => a.emotion < b.emotion ? -1 : 1);
const EXPECTED = .3, VALUE:Readonly<Record<LiveEmotionOutcomeV1,number>> = { homer:1, hit:.8, walk:.5, out:.15, strikeout:0 };
const NEUTRAL = Object.fromEntries(RESPONSE_AXES.map(k => [k, .5])) as Record<ResponseAxis,number>;
const clamp = (v:number) => Math.min(1, Math.max(0, v));

/** Late, close and with men on: public facts, known to both sides. */
export function liveLeverageV1(e:Pick<LiveEmotionEventV1,'inning'|'regulationInnings'|'outs'|'runnersOn'|'scoringPosition'|'runDifference'>) {
  const late = clamp(e.inning / e.regulationInnings), close = clamp(1 - Math.abs(e.runDifference) / 5);
  return clamp(close * (.35 + .4 * late * late + .08 * e.runnersOn + (e.scoringPosition ? .12 : 0) + (e.outs === 2 ? .05 : 0)));
}

export function createLiveEmotionTrackerV1(input:Readonly<{ matchId:string; policy:LiveEmotionPolicyV1; players:readonly LiveEmotionPlayerV1[]; saved?:unknown }>) {
  const careerId = 'single-match', players = new Map(input.players.map(p => [p.playerId, p])), memory = new Map<string,Memory>();
  const scope = (playerId:string) => ({ careerId, matchId:input.matchId, playerId });
  const fresh = (playerId:string):Memory => {
    const made = createEmotionState({ scope:scope(playerId), policy:POLICY });
    if (!made.ok) throw Error('live emotion: ' + made.reason.code + ' ' + made.reason.path);
    return { state:made.value, sequence:0, success:0, failure:0 };
  };
  const saved = input.saved as readonly (readonly [string, Memory])[]|undefined;
  for (const player of input.players) memory.set(player.playerId, fresh(player.playerId));
  if (saved) for (const [playerId, m] of saved) {
    const restored = restoreEmotionState(m.state);
    if (!restored.ok) throw Error('live emotion: invalid saved state ' + restored.reason.path);
    memory.set(playerId, { ...m, state:restored.value });
  }
  const opponentOf = (clubId:string) => input.players.find(p => p.clubId !== clubId)?.clubId ?? clubId + '-opponent';
  const appraise = (playerId:string, tick:number, id:string, perceived:number, expected:number, leverage:number) => {
    const player = players.get(playerId)!, m = memory.get(playerId)!, sequence = m.sequence++, time = { tick, sequence };
    const stamp = (sourceId:string) => ({ sourceId, revision:1, time }), s = scope(playerId), clubId = player.clubId, opponentClubId = opponentOf(clubId), contextId = 'pa-' + id;
    const request:AppraisalInput = {
      importance:{ scope:s, contextId, time, clubId, opponentClubId,
        competition:{ stamp:stamp('competition'), careerId, matchId:input.matchId, clubId, opponentClubId, competitionId:'single-match', kind:'REGULAR_SEASON', stage:'LEAGUE',
          participantCount:2, remainingGamesAfterMatch:0, win:{ rank:null, opponentRank:null, champion:false, qualified:false, eliminated:false }, loss:{ rank:null, opponentRank:null, champion:false, qualified:false, eliminated:false } },
        personal:{ stamp:stamp('personal'), scope:s, clubId, recordStake:0, returnStake:0, historyStake:0, clubIdentification:.5 },
        rivalry:{ stamp:stamp('rivalry'), careerId, fromClubId:clubId, toClubId:opponentClubId, intensity:0 },
        model:{ modelId:'live-importance', version:'v1', maxSourceAgeTicks:1, kindLevels:{ REGULAR_SEASON:.1, POSTSEASON:.8, INTERNATIONAL:1 },
          stageLevels:{ LEAGUE:.1, GROUP:.3, ROUND:.5, SEMIFINAL:.8, FINAL:1 }, weights:{ stage:1, standings:1, championship:1, qualification:1, elimination:1, matchup:1, urgency:1, personal:1 } } },
      appraisalId:'appraisal-' + id, bundleId:'bundle-' + id, evidenceEventIds:['event-' + id], expectedRevision:m.state.revision, policy:POLICY,
      player:{ stamp:stamp('player-response'), scope:s, response:{ ...NEUTRAL, ...player.response }, longTermStrain:0 },
      event:{ stamp:stamp('event-context'), scope:s, contextId, eventId:'event-' + id, expectedOutcome:expected, perceivedOutcome:perceived, tacticalDeviation:0, localLeverage:leverage,
        recentSuccess:clamp(m.success / 3), recentFailure:clamp(m.failure / 3), hostility:0 },
      model:{ modelId:'live-appraisal', version:'v1', maxSourceAgeTicks:1, importanceGain:input.policy.importance ?? .4, impactTickScale:100_000, rows:ROWS as AppraisalRow[] } };
    const appraisal = appraiseEmotion(request);
    if (!appraisal.ok) throw Error('live emotion: ' + appraisal.reason.code + ' ' + appraisal.reason.path);
    const next = evaluateEmotion(m.state, appraisal.value.appraisal);
    if (!next.ok) throw Error('live emotion: ' + next.reason.code + ' ' + next.reason.path);
    m.state = next.state;
    if (perceived > expected) { m.success = Math.min(3, m.success + 1); m.failure = Math.max(0, m.failure - 1); } else if (perceived < expected) { m.failure = Math.min(3, m.failure + 1); m.success = Math.max(0, m.success - 1); }
  };
  return Object.freeze({
    /** Called once when a plate appearance ends. Replays read the same events, so nothing is redrawn. */
    observe(event:LiveEmotionEventV1) {
      const leverage = liveLeverageV1(event), value = VALUE[event.outcome], id = String(event.tick);
      if (players.has(event.batterId)) appraise(event.batterId, event.tick, 'b' + id, value, EXPECTED, leverage);
      if (players.has(event.pitcherId)) appraise(event.pitcherId, event.tick, 'p' + id, 1 - value, 1 - EXPECTED, leverage);
    },
    influence(playerId:string):LiveEmotionInfluenceV1|null {
      const m = memory.get(playerId);
      if (!m) return null;
      const seen = getEmotionInfluence(m.state);
      return seen.ok && seen.value.activeEmotion && seen.value.effects ? { emotion:seen.value.activeEmotion, effects:seen.value.effects } : null;
    },
    marks() { return [...memory].flatMap(([playerId, m]) => m.state.active ? [{ playerId, emotion:m.state.active.emotion }] : []); },
    capture() { return [...memory].map(([playerId, m]) => [playerId, { ...m }] as const); },
  });
}
