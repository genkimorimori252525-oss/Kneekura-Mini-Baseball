import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { flight } from '../../core/world/psychology/batting/BattingFixtures.test-support';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaPhysicalEpisodeSourceInput as parse } from './SamePlateAppearancePhysicalEpisode';
import { physicalEpisodeTables as tables, samePaPhysicalEpisodeSchema as schema, assertSamePaPhysicalEpisodeStorage as storage } from './SamePlateAppearancePhysicalEpisodeStorage';

const ref=(owner:string,sourceId=owner)=>({owner,sourceId,sourceHash:hash(sourceId),snapshotHash:hash('result:'+sourceId)});
const base=()=>({sourceId:'physical-source',sourceVersion:'explicit-synthetic-v1',viewReference:ref('pa_lifecycle_v1_execution_views')});
// Existing ContinuousPitchFixtures nominal geometry plus the explicit
// BattingFixtures aerodynamic parameters. These are Source-shape tests, not
// accepted Native actor/calibration, physical launch, or fixture qualification.
const action=()=>({...base(),capability:'same_pa_physical_action_v1',physicalPitchSourceId:'pitch-three',
  timingReference:ref('world_pitch_timing_baselines'),releaseReference:ref('world_player_release_baselines'),
  pitchResponseReference:ref('world_pitch_fatigue_policies'),batterModelReference:ref('world_player_batting_models'),
  battingMode:'observer_decision',actualFlightParameters:flight().parameters,contactResponse:'nathan_2012_wood_local_v1',
  nominalPitch:{delivery:{matchSeed:19,moundReference:{x:0,y:0,z:18},outingId:'outing-1',readyAtUs:0,
    timingIntent:{deliveryMode:'NORMAL',cadenceIntent:'STANDARD'},physics:{velocity:{x:0,y:0,z:-30},spin:{x:0,y:100,z:0}}},
    flight:{durationUs:1_500_000,acceleration:{x:0,y:0,z:0}},batter:{action:{kind:'take'},plateZ:0,
      strikeZone:{centerX:0,halfWidth:0.2,lowerY:1.4,upperY:1.8},ballRadiusMeters:0.0366}}});
it('PE01 physical preparation retains explicit parameters without requiring future received knowledge',()=>{
  const s=action(),value=parse(s);expect(value).toEqual(s);expect(value).not.toBe(s);expect(Object.isFrozen(value)).toBe(true);
  for(const extra of [{predictionReference:ref('batting_prediction_v1_predictions')},{physicalWorld:{}},{bodyCut:{}},{ready:true},{cachedProof:{}},{stage:'owned_append'}])expect(()=>parse({...s,...extra})).toThrow();
  expect(()=>parse({...s,viewReference:ref('pa_continuation_v1_execution_views')})).toThrow();
});
it('PE02 malformed or implicit flight parameters cannot become an accepted physical Source',()=>{
  const s=action();
  for(const p of [undefined,{...s.actualFlightParameters,ticksPerSecond:1000},{...s.actualFlightParameters,integrationStepTicks:0},
    {...s.actualFlightParameters,aerodynamics:undefined},{...s.actualFlightParameters,aerodynamics:{...s.actualFlightParameters.aerodynamics,ballMassKg:0}},
    {...s.actualFlightParameters,aerodynamics:{...s.actualFlightParameters.aerodynamics,forecast:true}},
    {...s.actualFlightParameters,aerodynamics:{...s.actualFlightParameters.aerodynamics,windVelocityMps:{x:0,y:0,z:0,source:'guess'}}}])expect(()=>parse({...s,actualFlightParameters:p})).toThrow();
});
it('PE03 physical cuts and adoption pin exact prior work and prepared input without a performed calculation row',()=>{
  const operation={...base(),launchReference:ref('pa_physical_v1_launches'),previousOperationReference:ref('pa_physical_v1_cuts','prior-cut')};
  const cut={...operation,capability:'same_pa_physical_cut_v1',throughTick:140000};expect(parse(cut)).toEqual(cut);
  const commitment={...operation,capability:'same_pa_physical_commitment_v1',inputReference:ref('batting_execution_v1_inputs'),intentReference:ref('batting_execution_v1_intents')};
  expect(parse(commitment)).toEqual(commitment);
  expect(()=>parse({...commitment,inputReference:ref('batting_execution_v1_executions')})).toThrow();
  expect(()=>parse({...commitment,commitment:{action:'SWING'}})).toThrow();
  expect(()=>parse({...cut,previousOperationReference:ref('pa_physical_v1_cuts',cut.sourceId)})).toThrow();
  expect(()=>parse({...cut,previousOperationReference:ref('batting_emotion_execution_v1_executions')})).toThrow();
});
it('PE04 all-ten preparation requires exactly32 distinct lifecycle calibration rows',()=>{
  const participantInputs=Array.from({length:10},(_,i)=>{const playerId='player-'+i,routes=i===0?['batter_observation','batter_decision','batter_motor','batter_swing']:
    i===1?['pitch_delivery','defender_observation','defender_decision','defender_locomotion']:['defender_observation','defender_decision','defender_locomotion'];
    return{member:{playerId,bindingHash:hash('binding:'+i),personHash:hash('person:'+i),baselineSourceId:'baseline:'+i,reservedRevision:0,reservedStateHash:hash('reserved:'+i),projectedStateHash:hash('projected:'+i)},
      calibrationReferences:routes.map(route=>({route,calibrationReference:ref('pa_lifecycle_v1_execution_calibrations',playerId+route)}))};});
  const s={...base(),capability:'same_pa_physical_right_v1',actionReference:ref('pa_physical_v1_action_plans'),postureReference:ref('batting_observation_v1_postures'),participantInputs};expect(parse(s)).toEqual(s);
  expect(()=>parse({...s,postureReference:undefined})).toThrow();
  expect(()=>parse({...s,participantInputs:participantInputs.slice(1)})).toThrow();
  const missing=structuredClone(s);missing.participantInputs[0].calibrationReferences.pop();expect(()=>parse(missing)).toThrow();
  const old=structuredClone(s);old.participantInputs[0].calibrationReferences[0].calibrationReference.owner='pa_dispatch_v1_execution_calibrations';expect(()=>parse(old)).toThrow();
});
const Native=(createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
it('PE05 exact disjoint storage rejects partial, shadow, and extra schema objects without repairing them',()=>{
  const db=new Native(':memory:');try{
    expect(storage(db)).toBe(false);db.exec(schema[tables.action]);expect(()=>storage(db)).toThrow();
    for(const [name,ddl]of Object.entries(schema))if(name!==tables.action)db.exec(ddl);expect(storage(db)).toBe(true);
    db.exec('CREATE TEMP TABLE pa_physical_v1_shadow(value TEXT)');expect(()=>storage(db)).toThrow();db.exec('DROP TABLE temp.pa_physical_v1_shadow');
    db.exec('CREATE INDEX extra_physical_index ON pa_physical_v1_cuts(enrollment_source_id)');expect(()=>storage(db)).toThrow();
    expect(db.prepare("SELECT count(*) n FROM main.sqlite_master WHERE name='extra_physical_index'").get()!.n).toBe(1);
  }finally{db.close();}
});
it('PE06 physical family stores only ordinal3+ and cannot weaken its CHECK constraints',()=>{
  const db=new Native(':memory:');try{
    for(const ddl of Object.values(schema))db.exec(ddl);
    expect(()=>db.prepare(`INSERT INTO ${tables.head} VALUES(?,?,?,?,?,?,?,?,?,?)`).run('enroll','career','game',200,2,'pitch',0,tables.launch,'pitch',hash('pitch'))).toThrow();
    expect(db.prepare(`SELECT count(*) n FROM ${tables.head}`).get()!.n).toBe(0);
    db.exec(`DROP TABLE ${tables.head}`);db.exec(schema[tables.head].replace('CHECK(pitch_ordinal>=3)','CHECK(pitch_ordinal>=1)'));expect(()=>storage(db)).toThrow();
  }finally{db.close();}
});
