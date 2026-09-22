import type { ImportanceInput } from './AppraisalTypes';
export const importanceInput = (): ImportanceInput => ({
 scope: {careerId:'career',matchId:'match',playerId:'player'},contextId:'context',time:{tick:100,sequence:0},clubId:'club',opponentClubId:'opponent',
 competition:{stamp:{sourceId:'competition',revision:2,time:{tick:100,sequence:0}},careerId:'career',matchId:'match',clubId:'club',opponentClubId:'opponent',
  competitionId:'league',kind:'REGULAR_SEASON',stage:'LEAGUE',participantCount:4,remainingGamesAfterMatch:9,
  win:{rank:1,opponentRank:3,champion:false,qualified:false,eliminated:false},
  loss:{rank:3,opponentRank:1,champion:false,qualified:false,eliminated:false}},
 personal:{stamp:{sourceId:'personal',revision:1,time:{tick:95,sequence:0}},scope:{careerId:'career',matchId:'match',playerId:'player'},clubId:'club',
  recordStake:0,returnStake:0,historyStake:0,clubIdentification:0.8},
 rivalry:{stamp:{sourceId:'rivalry',revision:1,time:{tick:90,sequence:0}},careerId:'career',fromClubId:'club',toClubId:'opponent',intensity:0.75},
 model:{modelId:'synthetic-importance',version:'test-v1',maxSourceAgeTicks:20,
  kindLevels:{REGULAR_SEASON:0.1,POSTSEASON:0.8,INTERNATIONAL:1},stageLevels:{LEAGUE:0.1,GROUP:0.3,ROUND:0.5,SEMIFINAL:0.8,FINAL:1},
  weights:{stage:1,standings:1,championship:1,qualification:1,elimination:1,matchup:1,urgency:1,personal:1}}
});
export function change<T>(input:T, edit:(draft:any)=>void):T { const d=structuredClone(input);edit(d);return d; }
export function value<T>(result:{ok:true;value:T}|{ok:false;reason:unknown}):T {
 if (!result.ok) throw new Error(JSON.stringify(result.reason)); return result.value;
}
import { EMOTIONS } from '../EmotionTypes';
import { policy,zeroEffects } from '../EmotionFixtures.test-support';
import { RESPONSE_AXES,SITUATION_AXES,type AppraisalInput,type AppraisalRow } from './AppraisalTypes';
export const appraisalInput=():AppraisalInput=>{
 const rows:AppraisalRow[]=EMOTIONS.map(emotion=>({emotion,bias:0,
  situationWeights:Object.fromEntries(SITUATION_AXES.map(k=>[k,0])) as AppraisalRow['situationWeights'],
  responseWeights:Object.fromEntries(RESPONSE_AXES.map(k=>[k,0])) as AppraisalRow['responseWeights'],
  stabilityDamping:0.2,effectsAtFullPressure:zeroEffects()}));
 const mutate=(kind:string,f:(row:any)=>void)=>f(rows.find(r=>r.emotion===kind));
 mutate('FEAR',r=>{r.bias=0.2;r.situationWeights.negativeSurprise=0.6;r.responseWeights.stability=-0.5;r.responseWeights.experience=-0.2;r.effectsAtFullPressure.runningRiskDelta=-0.4;});
 mutate('MOTIVATION',r=>{r.situationWeights.negativeSurprise=0.2;r.situationWeights.positiveSurprise=0.3;r.responseWeights.competitiveness=0.4;r.responseWeights.confidence=0.2;r.effectsAtFullPressure.swingAggressionDelta=0.4;});
 mutate('ANGER',r=>{r.situationWeights.tacticalDeviation=0.4;r.situationWeights.hostility=0.4;r.responseWeights.aggression=0.4;r.responseWeights.selfFocus=0.2;r.responseWeights.stability=-0.5;r.effectsAtFullPressure.throwAggressionDelta=0.6;});
 mutate('IMPATIENCE',r=>{r.situationWeights.negativeSurprise=0.3;r.situationWeights.longTermStrain=0.3;r.responseWeights.experience=-0.2;r.responseWeights.stability=-0.1;r.effectsAtFullPressure.swingDecisionShiftTicks=-5;});
 mutate('SUPERIORITY',r=>{r.situationWeights.positiveSurprise=0.4;r.situationWeights.tacticalDeviation=0.2;r.responseWeights.confidence=0.3;r.responseWeights.selfFocus=0.3;r.effectsAtFullPressure.throwIntentShiftTicks=8;});
 const importance=importanceInput();
 return {importance,appraisalId:'appraisal',bundleId:'bundle',evidenceEventIds:['event'],expectedRevision:0,policy:policy(),
  player:{stamp:{sourceId:'player-response',revision:3,time:{tick:100,sequence:0}},scope:importance.scope,
   response:{judgment:0.5,experience:0.2,concentration:0.5,stability:0.2,confidence:0.4,competitiveness:0.3,selfFocus:0.2,aggression:0.1},longTermStrain:0.1},
  event:{stamp:{sourceId:'event-context',revision:1,time:{tick:100,sequence:0}},scope:importance.scope,contextId:importance.contextId,eventId:'event',
   expectedOutcome:0.8,perceivedOutcome:0,tacticalDeviation:0,localLeverage:0.5,recentSuccess:0,recentFailure:0,hostility:0},
  model:{modelId:'synthetic-appraisal',version:'test-v1',maxSourceAgeTicks:20,importanceGain:1,impactTickScale:10,rows}};
};
