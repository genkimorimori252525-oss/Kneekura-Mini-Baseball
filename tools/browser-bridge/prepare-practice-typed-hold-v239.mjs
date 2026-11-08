import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const paths=['src/integration/browser/LiveBaseballMatchV1.test-support.ts','src/integration/browser/LiveBattingPracticeSpinMotorV239.test.ts','src/integration/browser/LiveBaseballMatchV1.ts','src/integration/browser/LiveBatterObservationV151.ts','src/core/sim/pitching/BattingSetupV94.ts','docs/demos/measured-bat-motions.json'];
const hash=b=>createHash('sha256').update(b).digest('hex'),pins={};for(const p of paths){const b=await readFile(p);pins[p]={bytes:b.length,sha256:hash(b)}}
const source=`import {liveMatchFixture} from './src/integration/browser/LiveBaseballMatchV1.test-support';
import {createLiveBaseballMatchWorkerV116,LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1} from './src/integration/browser/LiveBaseballMatchV1';
import {AUTHORED_LIVE_BATTER_OBSERVATION_V151} from './src/integration/browser/LiveBatterObservationV151';
import {resolveLiveBattingSetupV94} from './src/core/sim/pitching/BattingSetupV94';
const base=liveMatchFixture(2468),h=createLiveBaseballMatchWorkerV116(base),subjectId=h.inspect().batterPlayerId,p=base.players.find(p=>p.playerId===subjectId)!,clip=base.measuredClips.find(c=>c.side===p.bats)!,physical={...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,clipId:clip.id,swingDecision:{approach:'SWING' as const,threshold:0,aggressionWeight:1}},setup={...base,players:base.players.map(x=>x.playerId===subjectId?{...x,physical}:x),batterObservationV151:AUTHORED_LIVE_BATTER_OBSERVATION_V151},catcher=setup.teams[1].defense.C;
const configuration={...setup,players:setup.players.map(p=>p.playerId===catcher?{...p,physical:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,gloveSpeedMps:.1,gloveReachMeters:.4,gloveRadiusMeters:.03,retentionCapacityJ:1}}:p)};
const motor={version:'live_spin_xy_motor_v239' as const,motorId:'fixture-motor',motorVersion:'v1',subjectId,technique:'TOPSPIN' as const,clip:{id:clip.id,sourceSha256:clip.source.sha256,bats:p.bats},domain:{plateZ:resolveLiveBattingSetupV94({...physical,heightMeters:p.heightMeters,bats:p.bats}).contactPlaneZ,coordinateSystem:'LIVE_WORLD_METERS_V1' as const},delta:{x:0,y:.01},provenance:{kind:'EXPLICIT_DIAGNOSTIC_UNCALIBRATED' as const,sourceId:'fixture',sourceVersion:'v1',humanCalibration:'NOT_MEASURED' as const},trainingOpportunities:[]};
export {configuration,motor};`;
const bundle=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'cjs',write:false,logLevel:'silent'}),mod={exports:{}};
new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);
for(const p of paths){const b=await readFile(p);if(hash(b)!==pins[p].sha256)throw Error('fixture source changed: '+p)}
const out=resolve(process.argv[2]??'');if(!process.argv[2])throw Error('new output directory required');await mkdir(out,{recursive:false});
const fixture={boundary:'AUTHORED_TEST_FIXTURE_NOT_USER',seed:2468,provenance:{pins,description:'Same liveMatchFixture/input/catcher setup as genuine Host unresolved test; no pitch executed.'},...mod.exports,plan:{version:'live_spin_practice_plan_v239',scopeId:'scope',pitchOrdinals:[1,2],motor:mod.exports.motor,criterion:null,normalRequest:{batting:'take'}}};
const data=Buffer.from(JSON.stringify(fixture)+'\n');await writeFile(resolve(out,'fixture.json'),data,{flag:'wx'});console.log(JSON.stringify({fixtureBytes:data.length,sha256:hash(data),subjectId:fixture.motor.subjectId,clip:fixture.motor.clip,pins}));
