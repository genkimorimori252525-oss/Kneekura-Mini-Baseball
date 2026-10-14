import assert from 'node:assert/strict';
import {cloneInert} from '../../core/adjudication/OfficialWindowPolicy';
import type {AcceptedFoulOfficialSession,AcceptedFoulOfficialIntent,AcceptedFoulOfficialEvent,FoulOfficialEndReference,FoulOfficialProjection} from './ActualFoulOfficial';
import type {AcceptedFoulTerminalApplication} from './ActualFoulTerminalApplication';
import {openSqliteActualFoulPlayEndStore,actualFoulEndArchiveEncoding} from './SqliteActualFoulPlayEndStore';
import {openSqliteActualFoulOfficialStore} from './SqliteActualFoulOfficialStore';
import {actorHash as hash,actorJson as json} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type {AttachedOriginalFoulEnd} from './ActualFoulPlayEndFixtures.test-support';
import {terminalContinuationGame} from './TerminalContinuationFixtureInputs.test-support';

export type TerminalOfficialAttachmentSources=Readonly<{
 physicalEndSourceId:string;sessionSourceId:string;assignmentSourceId:string;intentSourceId:string;
 recordCallSourceId:string;advanceSourceId:string;fenceSourceId:string;terminalSourceId:string;applicationId:string;
 sourceVersion:string;assignmentSourceVersion:string;officialIds:readonly string[];officialId:string;schedulerId:string;
 officialPolicy:AcceptedFoulOfficialSession['officialPolicy'];legalGamePolicy:NonNullable<AcceptedFoulTerminalApplication['legalGamePolicy']>;
}>;
/** Continue the actual current-play end through the ordinary official owners.
 * Explicit fixture Sources select identities and policy; original owner results
 * supply every physical/end/journal reference and every revision. */
export const attachTerminalOfficialInputs=(path:string,x:AttachedOriginalFoulEnd,raw:TerminalOfficialAttachmentSources,
 returned:(owner:'physical_end'|'official_session'|'official_call'|'official_advance'|'official_fence',value:unknown)=>void=()=>{})=>{
 const i=cloneInert(raw),names=[i.physicalEndSourceId,i.sessionSourceId,i.assignmentSourceId,i.intentSourceId,i.recordCallSourceId,i.advanceSourceId,i.fenceSourceId,i.terminalSourceId,i.applicationId];
 assert(names.every(v=>typeof v==='string'&&v.length>0&&v.trim()===v)&&new Set(names).size===names.length,'terminal attachment Source identities differ');
 assert(json(i.legalGamePolicy)===json(terminalContinuationGame.policy),'terminal attachment nine-inning policy differs');
 assert(x.count.disposition.kind==='terminal_strikeout','terminal attachment requires an actual two-strike bunt K');
 const source={sourceId:i.physicalEndSourceId,sourceVersion:i.sourceVersion,capability:'actual_original_settled_foul_play_end_v1'as const,ruleConsumptionSourceId:x.count.source.sourceId,baseFieldSourceId:x.foul.last.source.sourceId,executionSourceId:x.endpoint.source.sourceId};
 const ends=x.f.track(openSqliteActualFoulPlayEndStore(path,{readAcceptedEnd:id=>id===source.sourceId?source:null})),end=ends.accept(source.sourceId);returned('physical_end',end);
 const endReference:FoulOfficialEndReference={owner:'actual_foul_play_ends',sourceId:end.source.sourceId,sourceVersion:end.source.sourceVersion,sourceHash:hash(end.source),snapshotHash:actualFoulEndArchiveEncoding(end).hash};
 const session:AcceptedFoulOfficialSession={sourceId:i.sessionSourceId,sourceVersion:i.sourceVersion,capability:'actual_post_play_foul_official_session_v1',physicalEndReference:endReference,
  assignment:{sourceId:i.assignmentSourceId,sourceVersion:i.assignmentSourceVersion,gameId:end.gameId,playId:end.playId,physicalPitchSourceId:end.physicalPitchSourceId,officialIds:i.officialIds,schedulerId:i.schedulerId,clock:'post_play_discrete_tick_v1',openingTrigger:'sealed_foul_physical_end'},officialPolicy:i.officialPolicy};
 const events=new Map<string,AcceptedFoulOfficialEvent>(),intents=new Map<string,AcceptedFoulOfficialIntent>();
 const official=x.f.track(openSqliteActualFoulOfficialStore(path,{readAcceptedSession:id=>id===session.sourceId?session:null,readAcceptedEvent:id=>events.get(id)??null,readAcceptedIntent:id=>intents.get(id)??null}));
 const opened=official.acceptSession(session.sourceId);returned('official_session',opened);assert(opened.kind!=='intake_pending','terminal attachment official policy is incomplete');
 const append=(previous:FoulOfficialProjection,sourceId:string,action:AcceptedFoulOfficialEvent['action'])=>{const value:AcceptedFoulOfficialEvent={sourceId,sourceVersion:i.sourceVersion,capability:'actual_post_play_foul_official_event_v1',sessionSourceId:session.sourceId,expectedRevision:previous.revision,parent:{sourceId:previous.headSourceId,snapshotHash:previous.headHash},action};events.set(sourceId,value);return official.acceptEvent(sourceId);};
 const intent:AcceptedFoulOfficialIntent={sourceId:i.intentSourceId,sourceVersion:i.sourceVersion,capability:'actual_post_play_foul_official_intent_v1',sessionSourceId:session.sourceId,gameId:end.gameId,playId:end.playId,physicalPitchSourceId:end.physicalPitchSourceId,assignmentSourceId:session.assignment.sourceId,officialId:i.officialId,judgment:'foul'};intents.set(intent.sourceId,intent);
 const called=append(opened,i.recordCallSourceId,{kind:'record_call',intentSourceId:intent.sourceId});returned('official_call',called);
 const advanced=append(called,i.advanceSourceId,{kind:'advance_tick',schedulerId:i.schedulerId});returned('official_advance',advanced);
 const fenced=append(advanced,i.fenceSourceId,{kind:'next_pitch_fence',schedulerId:i.schedulerId});returned('official_fence',fenced);
 assert(fenced.kind==='terminal_foul_application_pending','terminal attachment did not reach the actual terminal handoff');
 const terminalSource:AcceptedFoulTerminalApplication={sourceId:i.terminalSourceId,sourceVersion:i.sourceVersion,capability:'actual_foul_terminal_non_live_application_v1',physicalEndReference:endReference,officialReference:{sessionSourceId:session.sourceId,revision:fenced.revision,headSourceId:fenced.headSourceId,headHash:fenced.headHash},applicationId:i.applicationId,legalGamePolicy:i.legalGamePolicy};
 return {x,ends,end,endReference,official,session,intent,opened,called,advanced,fenced,terminalSource};
};
