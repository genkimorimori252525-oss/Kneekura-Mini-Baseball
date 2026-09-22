import { compareTime, fail, fraction, integer, obj, readScope, readTime, same, text } from '../EmotionValidation';
import type { EmotionTime } from '../EmotionTypes';
import { COMPETITION_KINDS, COMPETITION_STAGES, IMPORTANCE_AXES, type CompetitionProjection,
  type ImportanceInput, type SourceStamp } from './AppraisalTypes';
export const pick = <T extends string>(input:unknown, choices:readonly T[],path:string):T => {
 if(!choices.includes(input as T)) fail('INVALID_INPUT',path);return input as T;
};
export function numbers<K extends string>(input:unknown,keys:readonly K[],path:string,signed=false):Record<K,number> {
 const v=obj(input,keys,path);return Object.fromEntries(keys.map(k=>[k,fraction(v[k],path+'.'+k,signed)])) as Record<K,number>;
}
export function readStamp(input:unknown,path:string,now:EmotionTime,maxAge:number):SourceStamp {
 const v=obj(input,['sourceId','revision','time'],path);
 const result={sourceId:text(v.sourceId,path+'.sourceId'),revision:integer(v.revision,path+'.revision'),time:readTime(v.time,path+'.time')};
 if(compareTime(result.time,now)>0) fail('BACKDATED_APPRAISAL',path+'.future');
 if(now.tick-result.time.tick>maxAge) fail('INVALID_INPUT',path+'.stale');
 return result;
}
const bool=(input:unknown,path:string):boolean=>{if(typeof input!=='boolean')fail('INVALID_INPUT',path);return input;};
function projection(input:unknown,path:string,count:number):CompetitionProjection {
 const v=obj(input,['rank','opponentRank','champion','qualified','eliminated'],path);
 const rank=(x:unknown,p:string):number|null=>{if(x===null)return null;const n=integer(x,p);if(n<1||n>count)fail('INVALID_INPUT',p);return n;};
 const r={rank:rank(v.rank,path+'.rank'),opponentRank:rank(v.opponentRank,path+'.opponentRank'),champion:bool(v.champion,path+'.champion'),
  qualified:bool(v.qualified,path+'.qualified'),eliminated:bool(v.eliminated,path+'.eliminated')};
 if((r.champion&&!r.qualified)||(r.qualified&&r.eliminated))fail('INVALID_INPUT',path+'.status');return r;
}
export function readImportance(input:unknown):ImportanceInput {
 const v=obj(input,['scope','contextId','time','clubId','opponentClubId','competition','personal','rivalry','model'],'importance');
 const scope=readScope(v.scope,'importance.scope'),time=readTime(v.time,'importance.time');
 const clubId=text(v.clubId,'importance.clubId'),opponentClubId=text(v.opponentClubId,'importance.opponentClubId');
 if(clubId===opponentClubId)fail('SCOPE_MISMATCH','importance.opponentClubId');
 const m=obj(v.model,['modelId','version','maxSourceAgeTicks','kindLevels','stageLevels','weights'],'importance.model');
 const model={modelId:text(m.modelId,'importance.model.modelId'),version:text(m.version,'importance.model.version'),
  maxSourceAgeTicks:integer(m.maxSourceAgeTicks,'importance.model.maxSourceAgeTicks'),
  kindLevels:numbers(m.kindLevels,COMPETITION_KINDS,'importance.model.kindLevels'),
  stageLevels:numbers(m.stageLevels,COMPETITION_STAGES,'importance.model.stageLevels'),weights:numbers(m.weights,IMPORTANCE_AXES,'importance.model.weights')};
 if(!Object.values(model.weights).some(n=>n>0))fail('INVALID_INPUT','importance.model.weights');
 const c=obj(v.competition,['stamp','careerId','matchId','clubId','opponentClubId','competitionId','kind','stage','participantCount','remainingGamesAfterMatch','win','loss'],'competition');
 const count=integer(c.participantCount,'competition.participantCount');if(count<2)fail('INVALID_INPUT','competition.participantCount');
 const competition={stamp:readStamp(c.stamp,'competition.stamp',time,model.maxSourceAgeTicks),
  careerId:text(c.careerId,'competition.careerId'),matchId:text(c.matchId,'competition.matchId'),clubId:text(c.clubId,'competition.clubId'),
  opponentClubId:text(c.opponentClubId,'competition.opponentClubId'),competitionId:text(c.competitionId,'competition.competitionId'),
  kind:pick(c.kind,COMPETITION_KINDS,'competition.kind'),stage:pick(c.stage,COMPETITION_STAGES,'competition.stage'),participantCount:count,
  remainingGamesAfterMatch:integer(c.remainingGamesAfterMatch,'competition.remainingGamesAfterMatch'),win:projection(c.win,'competition.win',count),loss:projection(c.loss,'competition.loss',count)};
 if(competition.careerId!==scope.careerId||competition.matchId!==scope.matchId||competition.clubId!==clubId||competition.opponentClubId!==opponentClubId)
  fail('SCOPE_MISMATCH','competition');
 const {win,loss}=competition;
 for(const key of ['rank','opponentRank'] as const) if((win[key]===null)!==(loss[key]===null))fail('INVALID_INPUT','competition.'+key);
 if((win.rank!==null&&loss.rank!==null&&win.rank>loss.rank)
  ||(win.opponentRank!==null&&loss.opponentRank!==null&&win.opponentRank<loss.opponentRank)
  ||(loss.champion&&!win.champion)||(loss.qualified&&!win.qualified)||(win.eliminated&&!loss.eliminated))
  fail('INVALID_INPUT','competition.scenarioOrder');
 const p=obj(v.personal,['stamp','scope','clubId','recordStake','returnStake','historyStake','clubIdentification'],'personal');
 const personal={stamp:readStamp(p.stamp,'personal.stamp',time,model.maxSourceAgeTicks),scope:readScope(p.scope,'personal.scope'),clubId:text(p.clubId,'personal.clubId'),
  recordStake:fraction(p.recordStake,'personal.recordStake'),returnStake:fraction(p.returnStake,'personal.returnStake'),historyStake:fraction(p.historyStake,'personal.historyStake'),
  clubIdentification:fraction(p.clubIdentification,'personal.clubIdentification')};
 if(!same(personal.scope,scope)||personal.clubId!==clubId)fail('SCOPE_MISMATCH','personal');
 const r=obj(v.rivalry,['stamp','careerId','fromClubId','toClubId','intensity'],'rivalry');
 const rivalry={stamp:readStamp(r.stamp,'rivalry.stamp',time,model.maxSourceAgeTicks),careerId:text(r.careerId,'rivalry.careerId'),
  fromClubId:text(r.fromClubId,'rivalry.fromClubId'),toClubId:text(r.toClubId,'rivalry.toClubId'),intensity:fraction(r.intensity,'rivalry.intensity')};
 if(rivalry.careerId!==scope.careerId||rivalry.fromClubId!==clubId||rivalry.toClubId!==opponentClubId)fail('SCOPE_MISMATCH','rivalry');
 if(new Set([competition.stamp.sourceId,personal.stamp.sourceId,rivalry.stamp.sourceId]).size!==3)fail('INVALID_INPUT','importance.sourceIds');
 return {scope,contextId:text(v.contextId,'importance.contextId'),time,clubId,opponentClubId,competition,personal,rivalry,model};
}
