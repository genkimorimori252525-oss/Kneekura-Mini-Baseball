import type { EmotionResult } from '../EmotionTypes';
import { attempt } from '../EmotionValidation';
import { IMPORTANCE_AXES, type ImportanceInput, type ImportanceResult } from './AppraisalTypes';
import { readImportance } from './ImportanceValidation';
/** Pure leverage derivation. The competition owner supplies counterfactual projections, not manual importance. */
export function computeImportance(input:ImportanceInput):ImportanceResult {
 const {competition:c,personal:p,rivalry,model:m}=input;
 const personalComponents={record:p.recordStake,returning:p.returnStake,history:p.historyStake,rivalry:rivalry.intensity*p.clubIdentification};
 const components={stage:Math.max(m.kindLevels[c.kind],m.stageLevels[c.stage]),
  standings:c.win.rank===null||c.loss.rank===null?0:(c.loss.rank-c.win.rank)/(c.participantCount-1),
  championship:Number(c.win.champion!==c.loss.champion),qualification:Number(c.win.qualified!==c.loss.qualified),
  elimination:Number(c.win.eliminated!==c.loss.eliminated),
  matchup:c.win.opponentRank===null||c.loss.opponentRank===null?0:(c.win.opponentRank-c.loss.opponentRank)/(c.participantCount-1),
  urgency:1/(1+c.remainingGamesAfterMatch),personal:Math.max(...Object.values(personalComponents))};
 // Scale weights first so tiny but valid weights do not underflow in weighted products.
 const scale=Math.max(...Object.values(m.weights));
 const total=IMPORTANCE_AXES.reduce((sum,k)=>sum+m.weights[k]/scale,0);
 const value=Math.min(1,Math.max(0,IMPORTANCE_AXES.reduce((sum,k)=>sum+components[k]*(m.weights[k]/scale)/total,0)));
 return {value,components,personalComponents,provenance:input};
}
export const deriveMatchImportance=(input:unknown):EmotionResult<ImportanceResult> => attempt(()=>computeImportance(readImportance(input)));
