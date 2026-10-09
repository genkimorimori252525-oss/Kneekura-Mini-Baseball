import assert from 'node:assert/strict';
import {cloneInert} from '../../core/adjudication/OfficialWindowPolicy';
import type {PlayerWorkloadRecoveryState} from '../../core/world/development/PlayerWorkloadRecovery';
import type {AcceptedPhysicalPitchActionSource,DurablePhysicalPitch,SqlitePhysicalPitchProgressStore} from './SqlitePhysicalPitchProgressStore';
import type {DurablePhysicalPlateAppearanceActor} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import {actorJson as json} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import {physicalPitchActionInput} from './PhysicalPitchEvidenceFromSqlite';
import {deriveOriginalBattingIntentEvidence} from './OriginalBattingIntent';
import {materializeContinuationBuntPrefixTake} from './TerminalContinuationBatchInputs.test-support';
import {terminalContinuationFixtureIds as ids} from './TerminalContinuationFixtureInputs.test-support';

/** One in-process continuation, using actual returned pitches for chronology.
 * The supplied Map is the normal pitch owner's explicit accepted authority. */
export const acceptContinuationTwoStrikePrefix=(owner:Pick<SqlitePhysicalPitchProgressStore,'accept'>,
 accepted:Map<string,AcceptedPhysicalPitchActionSource>,recipe:AcceptedPhysicalPitchActionSource,
 actor:DurablePhysicalPlateAppearanceActor,workload:PlayerWorkloadRecoveryState,
 returned:(value:DurablePhysicalPitch)=>void=()=>{})=>{
 const prefix:DurablePhysicalPitch[]=[];
 for(let i=0;i<2;i++){
  const source=materializeContinuationBuntPrefixTake(recipe,actor,workload,prefix);assert(!accepted.has(source.sourceId)||json(accepted.get(source.sourceId))===json(source),'continuation TAKE Source is frozen differently');accepted.set(source.sourceId,source);
  const value=owner.accept(source.sourceId,i);returned(value);assert(json(value.source)===json(source)&&json(value.frame.batterActor)===json(actor)&&json(value.frame.workload)===json(workload),'returned continuation TAKE origin differs');
  const timeline=value.result.pitch.resolution.timeline;assert(value.progressRevision===i+1&&timeline.status.kind==='active'&&timeline.status.count.balls===0&&timeline.status.count.strikes===i+1,'actual continuation TAKE did not produce its required strike');prefix.push(value);
 }
 return prefix;
};
/** A separately accepted swing recipe/declared bunt is required. This never
 * tunes a miss or fair result into the terminal-foul branch. */
export const acceptContinuationBuntContact=(owner:Pick<SqlitePhysicalPitchProgressStore,'accept'>,
 accepted:Map<string,AcceptedPhysicalPitchActionSource>,rawSource:AcceptedPhysicalPitchActionSource,
 actor:DurablePhysicalPlateAppearanceActor,prefix:readonly DurablePhysicalPitch[],returned:(value:DurablePhysicalPitch)=>void=()=>{})=>{
 const raw=cloneInert(rawSource),source=physicalPitchActionInput(raw,raw.sourceId),last=prefix.at(-1);
 assert(prefix.length===2&&last&&last.progressRevision===2&&last.result.pitch.resolution.timeline.status.kind==='active'
  &&last.result.pitch.resolution.timeline.status.count.balls===0&&last.result.pitch.resolution.timeline.status.count.strikes===2,'bunt requires the actual new-PA two-strike prefix');
 assert('activationApplicationId'in source&&source.activationApplicationId===ids.applicationId&&source.battingIntent?.attempt==='bunt'&&source.battingIntent.actorSourceId===actor.source.sourceId
  &&source.gameId===actor.source.gameId&&!('initialWorldSourceId'in source)&&!('prePitchRunner'in source)&&source.request.delivery.readyAtUs>=last.result.pitch.resolution.timeline.lastEventTick,'accepted continuation bunt scope or chronology differs');
 assert(!accepted.has(source.sourceId)||json(accepted.get(source.sourceId))===json(source),'continuation bunt Source is frozen differently');accepted.set(source.sourceId,source);const value=owner.accept(source.sourceId,2);returned(value);
 assert(value.progressRevision===3&&json(value.source)===json(source)&&json(value.frame.batterActor)===json(actor)&&json(value.beforeTimeline)===json(last.result.pitch.resolution.timeline),'returned continuation bunt origin differs');
 const intent=deriveOriginalBattingIntentEvidence(value);assert(intent.intent.kind==='declared'&&intent.intent.attempt==='bunt','actual continuation contact lacks its declared bunt');return value;
};
