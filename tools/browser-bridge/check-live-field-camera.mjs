import assert from 'node:assert/strict';
import { readFileSync,writeFileSync,existsSync,mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve,dirname } from 'node:path';
import vm from 'node:vm';
import { build } from 'esbuild';
const [beforeArgument,evidenceArgument]=process.argv.slice(2);assert.ok(beforeArgument&&evidenceArgument,'preserved original Source and NEW evidence JSON required');
const evidence=resolve(evidenceArgument);assert.ok(!existsSync(evidence));mkdirSync(dirname(evidence),{recursive:true});
const helperPath=resolve('tools/browser-bridge/live-field-camera.js'),helper=readFileSync(helperPath,'utf8');
const context=vm.createContext({});vm.runInContext(helper,context);const observe=context.KneekuraLiveFieldCamera.observe;
const plain=value=>JSON.parse(JSON.stringify(value)),sha=value=>createHash('sha256').update(value).digest('hex');
const bases={home:{x:0,y:0,z:0},first:{x:10,y:0,z:0},second:{x:20,y:0,z:0},third:{x:0,y:0,z:10}};
const a=(playerId,x)=>({playerId,position:{x,y:0,z:0}});
const frame=(tick,x,possessedBy=null)=>({tick,ball:{position:{x,y:1,z:0}},possessedBy,actors:[a('A',0),a('B',10),a('C',20)]});
const frames=[frame(0,-3),frame(10,0,'A'),frame(20,0),frame(23,2),frame(25,6),frame(30,10,'B'),frame(40,10),frame(41,11),frame(47,17),frame(50,20,'C')];
const facts=[{kind:'catch_secured',tick:10,elapsedSeconds:10,playerId:'A'},
 {kind:'throw_release',tick:20,elapsedSeconds:20,playerId:'A',receiverPlayerId:'B',position:{x:0,y:1,z:0},target:{x:10,y:1,z:0},base:1},
 {kind:'catch_secured',tick:30,elapsedSeconds:30,playerId:'B'},
 {kind:'throw_release',tick:40,elapsedSeconds:40,playerId:'B',receiverPlayerId:'C',position:{x:10,y:1,z:0},target:{x:20,y:1,z:0},base:2},
 {kind:'catch_secured',tick:50,elapsedSeconds:50,playerId:'C'}];
const record={frames,play:{field:{facts,frames:[...frames.map(f=>({...f,elapsedSeconds:f.tick,fielders:f.actors})),{tick:16,elapsedSeconds:16,fielders:frames[1].actors}].sort((a,b)=>a.tick-b.tick),diagnostics:{handPreparationProofs:[
 {playerId:'A',base:1,from:15},{playerId:'B',base:2,from:32}]}}}};
const before=JSON.stringify(record),check=(tick,id,target)=>{const f=frames.find(f=>f.tick===tick),out=plain(observe({record,frame:f,bases,defaultObserverPlayerId:'A'}));
 assert.equal(out.observerPlayerId,id);if(target)assert.deepEqual(out.target,target);return out;};
check(0,'A',frames[0].ball.position);assert.equal(check(10,'A').handoff,null);
const held=observe({record,frame:{...frame(16,0,'A'),tick:16},bases});assert.deepEqual(plain(held.target),bases.first);
assert.equal(check(20,'A').handoff.switched,false);assert.equal(check(23,'A').handoff.switched,false);
assert.equal(check(25,'B',frames[4].ball.position).handoff.switched,true);check(30,'B');check(41,'B');check(47,'C',frames[8].ball.position);check(50,'C');
assert.equal(JSON.stringify(record),before,'no Source mutation');
const legacy=structuredClone(record);for(const e of legacy.play.field.facts)if(e.kind==='throw_release'){delete e.receiverPlayerId;delete e.target;}
assert.equal(observe({record:legacy,frame:frames[4],bases}).observerPlayerId,'A','no recipient inference for legacy records');
const pending=frame(23,2,'B');assert.equal(observe({record,frame:pending,bases}).observerPlayerId,'A','pending retention is not catch_secured');
const futureFrame={tick:1e9,get ball(){throw new Error('FUTURE BALL READ');}},futureFact={tick:1e9,get kind(){throw new Error('FUTURE CATCH READ');}},
 futureCommand={from:1e9,get playerId(){throw new Error('FUTURE COMMAND READ');}};
const fenced={frames:[...frames,futureFrame],play:{field:{...record.play.field,facts:[...facts,futureFact],
 diagnostics:{handPreparationProofs:[...record.play.field.diagnostics.handPreparationProofs,futureCommand]}}}};
assert.equal(observe({record:fenced,frame:frames[4],bases}).observerPlayerId,'B');
assert.deepEqual(plain(observe({record:fenced,frame:frame(16,0,'A'),bases}).target),bases.first);
const heldUnknown=observe({record,frame:frame(11,0,'A'),bases});assert.equal(heldUnknown.target,undefined);
assert.doesNotThrow(()=>observe({record:null,frame:frame(1,0,'A'),bases}));
const recaught=structuredClone(record);recaught.play.field.facts.push({kind:'catch_secured',tick:60,elapsedSeconds:60,playerId:'A'});
recaught.play.field.frames.push({tick:65,elapsedSeconds:65,fielders:frames[1].actors});
assert.equal(observe({record:recaught,frame:frame(65,0,'A'),bases}).target,undefined,'an old hand command cannot belong to a new custody cycle');
const noCatchClock=structuredClone(record);delete noCatchClock.play.field.facts[0].elapsedSeconds;
assert.equal(observe({record:noCatchClock,frame:frame(16,0,'A'),bases}).target,undefined,'missing catch clock fails closed');
const cancelled=structuredClone(record);cancelled.play.field.diagnostics.throwDecisions=[{elapsedSeconds:15.5,reason:'force_target_no_longer_available'}];
assert.equal(observe({record:cancelled,frame:frame(16,0,'A'),bases}).target,undefined,'cancelled command is not a current throw goal');
// Verify exact physical output equality against the preserved pre-metadata
// implementation. Only the newly exposed release metadata is stripped.
const sourcePath=resolve('src/core/sim/fielding/LiveFieldPlayV1.ts'),testSource=readFileSync('src/core/sim/fielding/LiveFieldPlayV1.test.ts','utf8');
const fixture=testSource.slice(testSource.indexOf('const v ='),testSource.indexOf("it('secures")).replace('export const liveFieldFixture','const liveFieldFixture');
const contents=`import {simulateLiveFieldPlayV1,type LiveFieldPlayInputV1} from ${JSON.stringify(sourcePath)};
import {REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS} from ${JSON.stringify(resolve('src/core/sim/ball/BaseballAerodynamics.ts'))};
import {quantizeEventTick} from ${JSON.stringify(resolve('src/core/sim/ExactEventTime.ts'))};
${fixture}
const input=liveFieldFixture();globalThis.__results=[simulateLiveFieldPlayV1(input),simulateLiveFieldPlayV1({...input,outs:0,
ball:{...input.ball,ball:{...input.ball.ball,position:v(0,.2,0),velocity:v(1,-1,5)}},runners:[{...input.runners[0],topSpeedMps:3},
{runnerId:'first-runner',initialBase:1,topSpeedMps:3,accelerationMps2:3,reactionSeconds:.2}]})];`;
async function physical(original){const built=await build({stdin:{contents,resolveDir:process.cwd(),sourcefile:'camera-metadata-probe.ts',loader:'ts'},write:false,bundle:true,platform:'browser',format:'iife',target:'es2022',
 plugins:original?[{name:'preserved-before-source',setup(b){b.onLoad({filter:/LiveFieldPlayV1\.ts$/},args=>args.path===sourcePath?{contents:readFileSync(beforeArgument,'utf8'),loader:'ts',resolveDir:dirname(sourcePath)}:null);}}]:[]});
 const ctx=vm.createContext({structuredClone,performance});vm.runInContext(built.outputFiles[0].text,ctx);return plain(ctx.__results);}
const oldResults=await physical(true),newResults=await physical(false);
const strip=results=>results.map(r=>({...r,facts:r.facts.map(f=>{if(f.kind!=='throw_release')return f;const{receiverPlayerId,target,...old}=f;return old;})}));
assert.deepEqual(strip(newResults),oldResults,'all frames/rules/decisions/physics unchanged after additive metadata');
const actual=newResults[1],actualFrames=actual.frames.map(f=>({...f,actors:f.fielders,possessedBy:f.ball.possessedBy})),actualRecord={frames:actualFrames,play:{field:actual}};
const releases=actual.facts.filter(f=>f.kind==='throw_release'),handoffs=[];assert.equal(releases.length,2);
for(const release of releases){assert.equal(typeof release.receiverPlayerId,'string');assert(release.target);
 const flight=actualFrames.filter(f=>f.tick>=release.tick&&(!f.possessedBy)&&f.tick<(releases.find(e=>e.tick>release.tick)?.tick??Infinity));
 const rows=flight.map(f=>observe({record:actualRecord,frame:f,bases:{home:{x:0,y:0,z:0},first:{x:19.39,y:0,z:19.39},second:{x:0,y:0,z:38.78},third:{x:-19.39,y:0,z:19.39}},defaultObserverPlayerId:release.playerId}));
 const before=rows.find(r=>r.handoff?.releaseTick===release.tick&&!r.handoff.switched),after=rows.find(r=>r.handoff?.releaseTick===release.tick&&r.handoff.switched);
 assert(before&&after,'actual throw must retain thrower then hand off after midpoint');assert.equal(before.observerPlayerId,release.playerId);assert.equal(after.observerPlayerId,release.receiverPlayerId);
 const sourceFrame=actualFrames.find(f=>f.tick===after.atTick);assert.deepEqual(plain(after.target),sourceFrame.ball.position);
 handoffs.push({release,firstThrowerViewTick:before.atTick,firstReceiverViewTick:after.atTick,handoff:plain(after.handoff)});
}
const report={status:'PASS',helperPath,helperSha256:sha(helper),sourceBeforeSha256:sha(readFileSync(beforeArgument)),sourceAfterSha256:sha(readFileSync(sourcePath)),
 physicalResultsEqualExceptAdditiveReleaseMetadata:true,unchangedPhysicalResultsSha256:sha(JSON.stringify(oldResults)),cases:2,actualHandoffs:handoffs,
 prefixPoisonGuards:true,pendingCatchNotPromoted:true,legacyMissingReceiverNotGuessed:true,newCustodyCycleInvalidatesOldGoal:true,readyFrameWithoutRecordSafe:true,sourceMutation:false};
writeFileSync(evidence,JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({status:report.status,physicalResultsEqual:true,actualThrows:releases.length,helperSha256:report.helperSha256,evidence}));
