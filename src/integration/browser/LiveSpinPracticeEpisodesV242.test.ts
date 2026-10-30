import {describe,it,expect} from 'vitest';
import {declareSpinPracticeEpisodesV242,assessSpinPracticeEpisodesV242,deriveSpinEpisodeConfigurationV242} from './LiveSpinPracticeEpisodesV242';
import type {LiveSpinMotorV239} from './LiveSpinMotorPracticeV239';
const motor:LiveSpinMotorV239={version:'live_spin_xy_motor_v239',motorId:'m',motorVersion:'v1',subjectId:'p',technique:'HOOK',clip:{id:'clip',sourceSha256:'a'.repeat(64),bats:'L'},domain:{plateZ:0,coordinateSystem:'LIVE_WORLD_METERS_V1'},delta:{x:-.01,y:0},provenance:{kind:'EXPLICIT_DIAGNOSTIC_UNCALIBRATED',sourceId:'test',sourceVersion:'v1',humanCalibration:'NOT_MEASURED'},trainingOpportunities:[]};
describe('declared episode schedule',()=>{
 it('fixes seed order and retains the full denominator for unstarted or unfinished episodes',()=>{
  const plan=declareSpinPracticeEpisodesV242({scopeId:'scope',motor,criterion:null,episodeSeeds:[5,6]});
  expect(plan.episodes.map(x=>x.seed)).toEqual([5,6]);expect(plan.selection).toBe('FIRST_TARGET_PITCH');
  expect(assessSpinPracticeEpisodesV242(plan,[])).toMatchObject({status:'HOLD',planned:2,complete:0,unstarted:2,ownerAuthenticated:false});
  expect(assessSpinPracticeEpisodesV242(plan,[{episodeIndex:0,status:'PA_OPEN'}])).toMatchObject({status:'HOLD',planned:2,complete:0});
 });
 it('rejects duplicate episode observations and does not call declared completion authenticated',()=>{
  const plan=declareSpinPracticeEpisodesV242({scopeId:'scope',motor,criterion:null,episodeSeeds:[5,6]});
  expect(()=>assessSpinPracticeEpisodesV242(plan,[{episodeIndex:0,status:'PA_ENDED'},{episodeIndex:0,status:'PA_ENDED'}])).toThrow();
  expect(assessSpinPracticeEpisodesV242(plan,[{episodeIndex:0,status:'PA_ENDED'},{episodeIndex:1,status:'PA_ENDED'}])).toMatchObject({status:'DECLARED_COMPLETE',planned:2,ownerAuthenticated:false,earnedQualification:false});
 });
});

it('derives separate seed-only host configurations from the same bound target and rejects mismatches',async()=>{
 const {liveMatchFixture}=await import('./LiveBaseballMatchV1.test-support');
 const {LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,resolveLiveMatchPlayerPhysicalV98}=await import('./LiveBaseballMatchV1');
 const {resolveLiveBattingSetupV94}=await import('../../core/sim/pitching/BattingSetupV94');
 const input=liveMatchFixture(),clip=input.measuredClips.find(c=>c.side==='L')!;
 const player={...input.players.find(p=>p.playerId==='0-b0')!,physical:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,clipId:clip.id}};
 const config={...input,players:input.players.map(p=>p.playerId===player.playerId?player:p)};
 const physical=resolveLiveMatchPlayerPhysicalV98(player),plateZ=resolveLiveBattingSetupV94({...physical,heightMeters:player.heightMeters,bats:player.bats}).contactPlaneZ;
 const plan=declareSpinPracticeEpisodesV242({scopeId:'s',motor:{...motor,subjectId:player.playerId,clip:{id:clip.id,sourceSha256:clip.source.sha256,bats:'L'},domain:{plateZ,coordinateSystem:'LIVE_WORLD_METERS_V1'}},criterion:null,episodeSeeds:[5,6]});
 expect(deriveSpinEpisodeConfigurationV242(plan,0,config).seed).toBe(5);expect(deriveSpinEpisodeConfigurationV242(plan,1,config).seed).toBe(6);expect(config.seed).toBe(input.seed);
 expect(()=>deriveSpinEpisodeConfigurationV242(plan,2,config)).toThrow();
 expect(()=>deriveSpinEpisodeConfigurationV242(plan,0,{...config,players:config.players.filter(p=>p.playerId!==player.playerId)})).toThrow();
});
