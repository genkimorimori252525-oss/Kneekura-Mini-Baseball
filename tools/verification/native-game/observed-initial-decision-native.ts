import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { copyFileSync,mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { strictEqual,deepStrictEqual,throws } from 'node:assert';
import { openSqliteObservedInitialPitchStore,readObservedInitialPitchOperationFromSqlite,observedInitialOperations,type ObservedInitialSource,type ObservedInitialDecisionSource } from '../../../src/host/world/SqliteObservedInitialPitchStore';
import { withBattedWorldPhysicalReadTraversal } from '../../../src/host/world/SqliteBattedWorldFieldExecutionStore';
import { withSamePaLifecycleReadPhase } from '../../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { openSqliteBattingEmotionStore } from '../../../src/host/world/SqliteBattingEmotionStore';
import { openSqliteBattingEmotionExecutionStore } from '../../../src/host/world/SqliteBattingEmotionExecutionStore';
import { openSqliteWorldControlStore } from '../../../src/host/world/SqliteWorldControlStore';
import { samePaExecutionReference as reference } from '../../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { actorHash as hash } from '../../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battingEmotionFrame,type AcceptedInitialBattingEmotionExecution } from '../../../src/host/world/NativeBattingEmotionExecution';
import type { AcceptedBattingEmotionGenesis } from '../../../src/host/world/NativeBattingEmotion';
import { EMOTIONS } from '../../../src/core/world/psychology/EmotionTypes';
import { SITUATION_AXES,RESPONSE_AXES,type AppraisalInput } from '../../../src/core/world/psychology/appraisal/AppraisalTypes';

const [inputArg,outputArg]=process.argv.slice(2);if(!inputArg||!outputArg)throw new Error('requires original motor directory and NEW output directory');
const input=resolve(inputArg),output=resolve(outputArg),sha=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const manifest=JSON.parse(readFileSync(resolve(input,'manifest.json'),'utf8'));
strictEqual(['FRESH_NATIVE_OBSERVED_MEASURED_MOTOR_PREPARATION_ONLY','FRESH_NATIVE_OWNED_INITIAL_BAT_OBSERVATION_AND_MOTOR_PREPARATION'].includes(manifest.scope),true);
const pinned=Object.entries(manifest.files).filter(([name])=>name==='match.sqlite'||name==='match.sqlite-wal');
for(const [name,digest] of pinned)strictEqual(sha(resolve(input,name)),digest);
mkdirSync(output);const path=resolve(output,'match.sqlite'),staging=resolve(output,'input-snapshot.sqlite');
for(const [name] of pinned)copyFileSync(resolve(input,name),staging+name.slice('match.sqlite'.length));
const sqlite=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'),Native=sqlite.DatabaseSync,stage=new Native(staging,{readOnly:true});
try{await sqlite.backup(stage,path);}finally{stage.close();}
for(const [name,digest] of pinned)strictEqual(sha(resolve(input,name)),digest);
const db=new Native(path),sources=new Map<string,ObservedInitialSource>(),emotionSources=new Map<string,unknown>();
const owner=openSqliteObservedInitialPitchStore(path,{readAcceptedOperation:id=>sources.get(id)??null});
const genesisOwner=openSqliteBattingEmotionStore(path,{readAcceptedGenesis:id=>emotionSources.get(id)??null});
const emotionOwner=openSqliteBattingEmotionExecutionStore(path,{readAcceptedExecution:id=>emotionSources.get(id)??null});
const controlOwner=openSqliteWorldControlStore(path),expected=JSON.parse(readFileSync(resolve(input,'expected.json'),'utf8'));
const census=()=>db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(t=>[t.name,
  db.prepare('SELECT * FROM "'+String(t.name).replaceAll('"','""')+'"').all().map(r=>JSON.stringify(r)).sort()]);
try{
  const before=census(),last=owner.read(expected.records.at(-1).source.sourceId);
  if(last?.kind!=='observed_initial_motor_preparation_v1')throw new Error('original saved motor preparation required');
  const prediction=owner.read(last.predictionReference.sourceId);if(prediction?.kind!=='observed_initial_prediction_v1')throw new Error('original forecast required');
  const delivery=owner.read(prediction.deliveryReference.sourceId);if(delivery?.kind!=='observed_initial_delivery_v1')throw new Error('actual delivered event required');
  const capture=owner.read(delivery.captureReference.sourceId);if(capture?.kind!=='observed_initial_capture_v1')throw new Error('actual capture required');
  const opportunitySource={sourceId:'observed-initial:zone-opportunity',sourceVersion:'geometric-opportunity-v1',capability:'same_pa_observed_initial_opportunity_v1' as const,
    launchReference:last.source.launchReference,previousOperationReference:reference(observedInitialOperations,last),predictionReference:last.predictionReference};
  sources.set(opportunitySource.sourceId,opportunitySource);const opportunity=owner.accept(opportunitySource.sourceId);
  if(opportunity.kind!=='observed_initial_opportunity_v1')throw new Error('actual opportunity missing');
  strictEqual([0,1].includes(opportunity.assessment.score),true);
  const pitchRow=db.prepare('SELECT snapshot_json FROM pa_dispatch_v1_pitch_actions WHERE source_id=?').get(last.source.launchReference.sourceId)!;
  const pitch=JSON.parse(String(pitchRow.snapshot_json)),actor=pitch.originalActor,careerId=actor.binding.careerId,scope={careerId,matchId:actor.source.gameId,playerId:actor.binding.playerId};
  const action=JSON.parse(String(db.prepare('SELECT source_json FROM pa_dispatch_v1_action_plans WHERE source_id=?').get(pitch.source.actionReference.sourceId)!.source_json));
  const member=capture.source.calibrationReference;
  const calibration=JSON.parse(String(db.prepare('SELECT source_json FROM pa_dispatch_v1_execution_calibrations WHERE source_id=?').get(member.sourceId)!.source_json));
  controlOwner.initialize({careerId,worldRevision:0,control:{schemaVersion:1,revision:0,controllerId:'authored-initial-ai',controlledClubId:null,domainIds:['BATTING'],manualDomainIds:[]}});
  const provenance=(kind:string)=>({assessmentSourceId:'authored-initial:'+kind,assessmentVersion:'explicit-synthetic-v1',calibrationSourceId:'authored-initial:'+kind+':calibration',calibrationVersion:'explicit-neutral-not-empirical-v1'});
  // All psychological primitive values below are explicit synthetic declarations.
  // They are NOT empirical personality defaults or copied acceptance receipts.
  const policy={policyId:'authored-initial:emotion-policy',version:'explicit-neutral-v1',clearAfterCalmEvents:3,
    thresholds:EMOTIONS.map(emotion=>({emotion,activation:.8,sustain:.5}))};
  const genesisSource:AcceptedBattingEmotionGenesis={sourceId:'authored-initial:emotion-genesis',sourceVersion:'explicit-synthetic-v1',capability:'owned_batting_emotion_genesis_v1',
    viewReference:action.viewReference,member:calibration.member,policy,provenance:provenance('emotion-genesis')};
  emotionSources.set(genesisSource.sourceId,genesisSource);const genesis=genesisOwner.acceptGenesis(genesisSource.sourceId);
  if(genesis.kind!=='batting_emotion_genesis')throw new Error('actual emotion genesis required');
  const head=controlOwner.readHead(careerId)!;
  const worldBefore={head,controlJson:JSON.stringify(head.control)},time={tick:opportunity.evaluationTick,sequence:opportunity.operationOrdinal};
  const clubId=actor.binding.clubId,game=actor.worldFixture.game,opponentClubId=clubId===game.homeClubId?game.awayClubId:game.homeClubId;
  const source:AcceptedInitialBattingEmotionExecution={sourceId:'authored-initial:emotion-execution',sourceVersion:'explicit-synthetic-v1',capability:'owned_initial_batting_emotion_execution_v1',
    executionId:'authored-initial:decision-emotion:1',viewReference:action.viewReference,member:calibration.member,
    observationReference:reference(observedInitialOperations,capture),deliveryReference:reference(observedInitialOperations,delivery),genesisReference:reference('batting_emotion_v1_geneses',genesis),
    previousExecutionReference:null,physicalPitchReference:last.source.launchReference,physicalOperationReference:reference(observedInitialOperations,opportunity),
    expectedWorld:{careerId,worldRevision:head.worldRevision,controlRevision:head.control.revision,controlHash:hash(head.control)},
    appraisalAssessment:null as unknown as AppraisalInput,baseline:{basis:'WITHOUT_EMOTION',sourceId:'authored-initial:baseline',revision:0,
      swingDecision:{tick:time.tick,earliestTick:time.tick,latestTick:time.tick},throwIntent:{tick:time.tick,earliestTick:time.tick,latestTick:time.tick},
      defenseReplan:{tick:time.tick,earliestTick:time.tick,latestTick:time.tick},swingAggression:.5,throwAggression:.5,minimumAdvanceSafetyMarginTicks:0},
    executionModel:{modelId:'authored-initial:execution',version:'explicit-neutral-v1',runningRiskTicksPerUnit:0,maximumAdvanceSafetyMarginTicks:1},provenance:provenance('emotion-execution')};
  const frame=battingEmotionFrame(source,actor,worldBefore,time),stamp=(id:string)=>({sourceId:'authored-initial:'+id,revision:0,time});
  const zeroEffects={swingDecisionShiftTicks:0,throwIntentShiftTicks:0,defenseReplanShiftTicks:0,swingAggressionDelta:0,throwAggressionDelta:0,runningRiskDelta:0};
  const appraisal:AppraisalInput={importance:{scope,contextId:frame.contextId,time,clubId,opponentClubId,
    competition:{stamp:stamp('competition-appraisal'),careerId,matchId:scope.matchId,clubId,opponentClubId,competitionId:actor.binding.competitionEditionId,
      kind:'REGULAR_SEASON',stage:'LEAGUE',participantCount:2,remainingGamesAfterMatch:0,
      win:{rank:1,opponentRank:2,champion:false,qualified:false,eliminated:false},loss:{rank:2,opponentRank:1,champion:false,qualified:false,eliminated:false}},
    personal:{stamp:stamp('personal-appraisal'),scope,clubId,recordStake:0,returnStake:0,historyStake:0,clubIdentification:0},
    rivalry:{stamp:stamp('rivalry-appraisal'),careerId,fromClubId:clubId,toClubId:opponentClubId,intensity:0},
    model:{modelId:'authored-initial:importance',version:'explicit-neutral-v1',maxSourceAgeTicks:1000000,
      kindLevels:{REGULAR_SEASON:0,POSTSEASON:0,INTERNATIONAL:0},stageLevels:{LEAGUE:0,GROUP:0,ROUND:0,SEMIFINAL:0,FINAL:0},
      weights:{stage:1,standings:0,championship:0,qualification:0,elimination:0,matchup:0,urgency:0,personal:0}}},
    appraisalId:'authored-initial:appraisal:1',bundleId:'authored-initial:appraisal-bundle',evidenceEventIds:[delivery.source.sourceId],expectedRevision:0,policy,
    player:{stamp:stamp('response-appraisal'),scope,response:{judgment:.5,experience:.5,concentration:.5,stability:.5,confidence:.5,competitiveness:.5,selfFocus:.5,aggression:.5},longTermStrain:0},
    event:{stamp:{sourceId:delivery.source.sourceId,revision:delivery.operationOrdinal,time:{tick:delivery.evaluationTick,sequence:delivery.operationOrdinal}},scope,contextId:frame.contextId,eventId:delivery.source.sourceId,
      expectedOutcome:0,perceivedOutcome:0,tacticalDeviation:0,localLeverage:0,recentSuccess:0,recentFailure:0,hostility:0},
    model:{modelId:'authored-initial:appraisal-model',version:'explicit-neutral-v1',maxSourceAgeTicks:1000000,importanceGain:0,impactTickScale:1,
      rows:EMOTIONS.map(emotion=>({emotion,bias:0,situationWeights:Object.fromEntries(SITUATION_AXES.map(k=>[k,0])) as AppraisalInput['model']['rows'][number]['situationWeights'],
        responseWeights:Object.fromEntries(RESPONSE_AXES.map(k=>[k,0])) as AppraisalInput['model']['rows'][number]['responseWeights'],stabilityDamping:0,effectsAtFullPressure:zeroEffects}))}};
  const acceptedSource={...source,appraisalAssessment:appraisal};emotionSources.set(source.sourceId,acceptedSource);
  const beforeEmotion=census();
  const bad={...acceptedSource,sourceId:source.sourceId+':foreign-event',appraisalAssessment:{...appraisal,evidenceEventIds:['unreceived-event']}};
  emotionSources.set(bad.sourceId,bad);throws(()=>emotionOwner.accept(bad.sourceId));deepStrictEqual(census(),beforeEmotion);
  const emotion=emotionOwner.accept(source.sourceId);if(emotion.kind!=='batting_emotion_execution')throw new Error('actual emotion acceptance required');
  strictEqual(emotion.acceptance.beforeEmotionRevision,0);strictEqual(emotion.acceptance.afterEmotionRevision,1);strictEqual(controlOwner.readHead(careerId)!.worldRevision,1);
  const cal=(route:string)=>{
    const row=db.prepare('SELECT * FROM pa_dispatch_v1_execution_calibrations').all().find(r=>JSON.parse(String(r.source_json)).route===route)!;
    return {owner:'pa_dispatch_v1_execution_calibrations' as const,sourceId:String(row.source_id),sourceHash:String(row.source_hash),snapshotHash:String(row.snapshot_hash)};
  };
  const world=controlOwner.readHead(careerId)!;
  const decisionSource:ObservedInitialDecisionSource={sourceId:'authored-initial:batting-decision',sourceVersion:'observed-initial-auto-v1',capability:'same_pa_observed_initial_decision_v1',
    launchReference:last.source.launchReference,previousOperationReference:reference(observedInitialOperations,opportunity),opportunityReference:reference(observedInitialOperations,opportunity),
    emotionReference:reference('batting_emotion_execution_v1_executions',emotion),decisionCalibrationReference:cal('batter_decision'),motorCalibrationReference:cal('batter_motor'),repertoireCalibrationReference:cal('batter_swing'),
    expectedWorld:{careerId,worldRevision:world.worldRevision,controlRevision:world.control.revision,controlHash:hash(world.control)},attempt:'ordinary_swing'};
  sources.set(decisionSource.sourceId,decisionSource);const decision=owner.accept(decisionSource.sourceId);
  if(decision.kind!=='observed_initial_decision_v1')throw new Error('actual initial decision required');
  strictEqual(decision.calculation.status,'READY');const actionTaken=decision.calculation.commitment!.action;
  strictEqual(['TAKE','SWING'].includes(actionTaken),true);
  strictEqual(decision.motionIssued,false);deepStrictEqual(decision.invokedRoutes,actionTaken==='SWING'?['batter_decision','batter_motor','batter_swing']:['batter_decision']);
  if(actionTaken==='SWING'){
    strictEqual(!!decision.calculation.commitment!.sampledTrajectoryV1,true);strictEqual(decision.calculation.commitment!.trajectory,null);
    strictEqual(decision.calculation.commitment!.sampledTrajectoryV1!.frames.length,137);
  }
  deepStrictEqual(decision.cut.beforeTimeline,pitch.beforeTimeline);strictEqual(decision.cut.beforeTimeline.events.length,0);
  const saved=census();deepStrictEqual(emotionOwner.accept(source.sourceId),emotion);deepStrictEqual(owner.accept(decisionSource.sourceId),decision);deepStrictEqual(census(),saved);
  const reopened=openSqliteObservedInitialPitchStore(path),reopenedEmotion=openSqliteBattingEmotionExecutionStore(path);
  try{deepStrictEqual(reopened.read(decisionSource.sourceId),decision);deepStrictEqual(reopenedEmotion.read(source.sourceId),emotion);}finally{reopened.close();reopenedEmotion.close();}
  deepStrictEqual(census(),saved);
  // A completed private read may reuse its authenticated context. Changing an
  // original on THAT connection must expire reuse immediately; rollback and a
  // new read bracket must then authenticate the original afresh. No input DB
  // is changed: this is an isolated generated-DB transaction, always rolled back.
  const decisionRef=reference(observedInitialOperations,decision);let changedSnapshotRefused=false;
  db.exec('BEGIN; PRAGMA query_only=1');
  try{
    throws(()=>withBattedWorldPhysicalReadTraversal(db,()=>withSamePaLifecycleReadPhase(db,()=>{
      deepStrictEqual(readObservedInitialPitchOperationFromSqlite(db,decisionRef),decision);
      db.exec('PRAGMA query_only=0');
      db.prepare('UPDATE pa_dispatch_v1_pitch_actions SET snapshot_hash=? WHERE source_id=?').run('isolated-rollback-corruption',last.source.launchReference.sourceId);
      db.exec('PRAGMA query_only=1');
      throws(()=>readObservedInitialPitchOperationFromSqlite(db,decisionRef),/physical read transaction or dependencies changed/);
      changedSnapshotRefused=true;
    })));
  }finally{db.exec('PRAGMA query_only=0; ROLLBACK');}
  strictEqual(changedSnapshotRefused,true);deepStrictEqual(census(),saved);
  db.exec('BEGIN; PRAGMA query_only=1');
  try{deepStrictEqual(withBattedWorldPhysicalReadTraversal(db,()=>withSamePaLifecycleReadPhase(db,()=>readObservedInitialPitchOperationFromSqlite(db,decisionRef))),decision);}
  finally{db.exec('COMMIT; PRAGMA query_only=0');}
  deepStrictEqual(census(),saved);
  const ignore=new Set(['pa_observed_initial_v1_operations','pa_observed_initial_v1_heads','world_control_heads','world_decision_revision_events','batting_emotion_v1_geneses','batting_emotion_execution_v1_executions','batting_emotion_execution_v1_heads']);
  deepStrictEqual(census().filter(r=>!ignore.has(String(r[0]))),before.filter(r=>!ignore.has(String(r[0]))));
  expected.records.push(opportunity,decision);expected.references.push(reference(observedInitialOperations,opportunity),reference(observedInitialOperations,decision));expected.sources.push(opportunitySource,decisionSource);
  writeFileSync(resolve(output,'expected.json'),JSON.stringify(expected),{flag:'wx'});
  writeFileSync(resolve(output,'emotion.json'),JSON.stringify({genesis,emotion,genesisSource,emotionSource:acceptedSource}),{flag:'wx'});
  writeFileSync(resolve(output,'native-report.json'),JSON.stringify({status:'PASS_NATIVE_OBSERVED_INITIAL_AUTO_DECISION',ownerMocks:false,
    originalRowsUnchanged:true,causalOpportunityScore:opportunity.assessment.score,opportunityReason:opportunity.assessment.reason,
    canonicalEmotionRevision:1,actualWorldRevision:world.worldRevision,decision:decision.calculation.commitment!.action,
    syntheticPsychologyParameters:true,forgedEventRefusedWithoutMutation:true,callbackFreeReopen:true,changedReadSnapshotRefused:true,
    newReadAfterRollbackAuthenticated:true,isolatedCorruptionProbeRolledBack:true,initialPhysicalPitchCount:1,
    officialEvents:0,motionIssued:false,physicalEffect:'none',workloadTotalAdmitted:false,fullMatchVerified:false},null,2)+'\n',{flag:'wx'});
  process.stdout.write('PASS_NATIVE_OBSERVED_INITIAL_AUTO_DECISION\n');
}finally{controlOwner.close();emotionOwner.close();genesisOwner.close();owner.close();db.close();}
