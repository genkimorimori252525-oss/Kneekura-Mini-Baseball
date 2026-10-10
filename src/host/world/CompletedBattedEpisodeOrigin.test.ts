import {expect,it} from 'vitest';
import {continuousPitchFixture,continuousPitchAction} from './ContinuousPitchFixtures.test-support';
import {openSqlitePhysicalPitchProgressStore,type AcceptedPhysicalPitchActionSource} from './SqlitePhysicalPitchProgressStore';
import {openSqlitePhysicalPlayClosureStore,type AcceptedPhysicalPlayClosure} from './SqlitePhysicalPlayClosureStore';
import {openSqlitePhysicalPlateAppearanceActorStore} from './SqlitePhysicalPlateAppearanceActorStore';
import {withSqliteReadTransaction} from './SqliteReadTransaction.test-support';
import {completedBattedEpisodeOriginInput,readCompletedBattedEpisodeOrigin} from './CompletedBattedEpisodeOrigin';
// Fresh structural Native/Core fixtures; no retained actor or physical proof is substituted.
it('captures only inert explicitly versioned completed-origin references',()=>{
 for(const kind of ['physical_play_closure','foul_terminal_completion']as const)expect(completedBattedEpisodeOriginInput({kind,sourceId:'completed'})).toEqual({kind,sourceId:'completed'});
 expect(()=>completedBattedEpisodeOriginInput({kind:'legacy_application',sourceId:'application'})).toThrow();expect(()=>completedBattedEpisodeOriginInput({kind:'physical_play_closure',sourceId:'completed',applicationHash:'unowned'})).toThrow();
 let reads=0;expect(()=>completedBattedEpisodeOriginInput({kind:'physical_play_closure',get sourceId(){reads++;return'completed';}})).toThrow();expect(reads).toBe(0);
});
it('requires the actual completed physical effects and exact next actor instead of a legacy application hash',()=>{
 const f=continuousPitchFixture(undefined,true),actions=new Map<string,AcceptedPhysicalPitchActionSource>();
 try{
  const pitches=f.track(openSqlitePhysicalPitchProgressStore(f.path,{matches:f.official,initialWorlds:f.initialWorlds,participation:f.participation,runtime:f.stores},{readAcceptedAction:id=>actions.get(id)??null}));
  let timeline=f.input.timeline;for(let i=0;i<3;i++){const s=continuousPitchAction(f,i,timeline.lastEventTick);actions.set(s.sourceId,s);timeline=pitches.accept(s.sourceId,i).result.pitch.resolution.timeline;}
  const source:AcceptedPhysicalPlayClosure={sourceId:'batch-physical-close',sourceVersion:'fixture-v1',physicalPitchSourceId:'pitch-2',applicationId:'batch-application',scoringApplicationId:'batch-score',snapshotId:'batch-rule',ruleTick:timeline.lastEventTick+1,closureTick:timeline.lastEventTick+2,nextStartedAtTick:timeline.lastEventTick+3,batterRunnerId:null,worldSetup:f.firstInput.worldSetup,game:{seasonId:'league-season-1',homeClubId:'club-a',awayClubId:'club-b',policy:{version:'fixture-v1',minimumInnings:9,maximumInnings:9,tiesAllowed:true}}};
  const closure=f.track(openSqlitePhysicalPlayClosureStore(f.path,{physicalPitches:pitches,initialWorlds:f.initialWorlds,participation:f.participation,personLinks:f.links},{readAcceptedClosure:id=>id===source.sourceId?source:null}));closure.enqueue(source.sourceId);const done=closure.resume(source.sourceId);if(!('activation'in done.official))throw new Error('structural ordinary fixture must continue');
  const actorSource={sourceId:'batch-next-actor',sourceVersion:'fixture-v1',gameId:'game-1',playerId:'away-2',activationApplicationId:source.applicationId};
  const actors=f.track(openSqlitePhysicalPlateAppearanceActorStore(f.path,{matches:f.official,initialWorlds:f.initialWorlds,participation:f.participation},{readAcceptedActor:id=>id===actorSource.sourceId?actorSource:null}));const actor=actors.accept(actorSource.sourceId),origin={kind:'physical_play_closure'as const,sourceId:source.sourceId};
  expect(()=>readCompletedBattedEpisodeOrigin(f.db,actor,origin)).toThrow('owner transaction');
  const evidence=withSqliteReadTransaction(f.db,()=>readCompletedBattedEpisodeOrigin(f.db,actor,origin));expect(evidence).toMatchObject({applicationId:source.applicationId,durableRevision:1,match:actor.match,world:actor.world,baseCenters:source.worldSetup.baseCenters});
  expect(()=>withSqliteReadTransaction(f.db,()=>readCompletedBattedEpisodeOrigin(f.db,actor,{...origin,sourceId:'unrelated'}))).toThrow();
  expect(()=>withSqliteReadTransaction(f.db,()=>readCompletedBattedEpisodeOrigin(f.db,{...actor,officialRevision:2},origin))).toThrow('actor archive');
  // Advance a second real structural play before replaying the first origin.
  let secondTimeline=done.official.activation.nextTimeline;
  for(let i=0;i<3;i++){const {initialWorldSourceId:_initial,...recipe}=continuousPitchAction(f,i,secondTimeline.lastEventTick)as AcceptedPhysicalPitchActionSource&{initialWorldSourceId:string};
   const next={...recipe,sourceId:'second-pitch-'+i,activationApplicationId:source.applicationId,request:{...recipe.request,workloadRevision:done.workload.after.revision}};actions.set(next.sourceId,next);secondTimeline=pitches.accept(next.sourceId,i).result.pitch.resolution.timeline;}
  const secondSource={...source,sourceId:'second-close',physicalPitchSourceId:'second-pitch-2',applicationId:'second-application',scoringApplicationId:'second-score',snapshotId:'second-rule',ruleTick:secondTimeline.lastEventTick+1,closureTick:secondTimeline.lastEventTick+2,nextStartedAtTick:secondTimeline.lastEventTick+3};
  const second=f.track(openSqlitePhysicalPlayClosureStore(f.path,{physicalPitches:pitches,initialWorlds:f.initialWorlds,participation:f.participation,personLinks:f.links},{readAcceptedClosure:id=>id===secondSource.sourceId?secondSource:null}));second.enqueue(secondSource.sourceId);second.resume(secondSource.sourceId);
  expect(f.official.getMatch('game-1')!.durableRevision).toBe(2);expect(withSqliteReadTransaction(f.db,()=>readCompletedBattedEpisodeOrigin(f.db,actor,origin))).toEqual(evidence);
  const original=f.db.prepare('SELECT * FROM physical_play_closures WHERE source_id=?').get(source.sourceId)!;
  f.db.prepare("UPDATE physical_play_closures SET status='PENDING',result_json=NULL WHERE source_id=?").run(source.sourceId);
  expect(()=>withSqliteReadTransaction(f.db,()=>readCompletedBattedEpisodeOrigin(f.db,actor,origin))).toThrow('not completed');
  f.db.prepare("UPDATE physical_play_closures SET status='COMPLETED',result_json=? WHERE source_id=?").run(original.result_json,source.sourceId);
  const shadow:Record<string,import('node:sqlite').SQLInputValue>={...original,source_id:'alias-owner',game_id:'foreign',play_id:99,application_id:'alias-app',scoring_application_id:'alias-score'};const keys=Object.keys(shadow);f.db.prepare('INSERT INTO physical_play_closures ('+keys.join(',')+') VALUES ('+keys.map(()=>'?').join(',')+')').run(...keys.map(k=>shadow[k]));
  expect(()=>withSqliteReadTransaction(f.db,()=>readCompletedBattedEpisodeOrigin(f.db,actor,origin))).toThrow('ownership');
 }finally{f.close();}
});
