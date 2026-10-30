import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve,relative,isAbsolute} from 'node:path';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';

const require=createRequire(import.meta.url),esbuild=require('esbuild'),root=process.cwd(),out=resolve(process.argv[2]??''),rel=relative(root,out);
assert(process.argv.length===3&&rel&&!rel.startsWith('..')&&!isAbsolute(rel));await mkdir(out,{recursive:false});
const sha=b=>createHash('sha256').update(b).digest('hex'),paths=['docs/demos/baseball-maker-batting-practice-v150.js','docs/demos/baseball-maker-spin-practice-v239.js'];
const inputs=await Promise.all(paths.map(async path=>({path,bytes:await readFile(path)})));
for(const input of inputs)execFileSync(process.execPath,['--check',input.path]);
const built=await esbuild.build({stdin:{contents:"export {validateLiveContactFrameMotorV244} from './src/integration/browser/LiveContactFrameMotorV244';export {validateLiveSpinMotorV239} from './src/integration/browser/LiveSpinMotorPracticeV239';",resolveDir:root},bundle:true,format:'cjs',platform:'node',write:false,logLevel:'silent'});
const module={exports:{}};new Function('module','exports','require',built.outputFiles[0].text)(module,module.exports,require);const validators=module.exports;
const source=inputs[0].bytes.toString('utf8'),from=source.indexOf('async function startSpinMotor('),through=source.indexOf('async function nextSpinMotor(',from);
assert(from>=0&&through>from);const body=source.slice(from,through),techniques=['BACKSPIN','TOPSPIN','SLICE','HOOK'],cases=[];
for(const technique of techniques)for(const episodeMode of [true,false]){
 const calls=[],declarations=[],values={'comparison-direction':'AUTO','practice-batting':'balanced'};
 const state={pitchCount:0,finished:false,batterPlayerId:'synthetic'},clip={id:'synthetic-clip',side:'L',source:{sha256:'a'.repeat(64)}},physical={clipId:clip.id};
 const context={state,stale:false,signature:'fixed',currentSignature:()=> 'fixed',act:fn=>fn(),clone:structuredClone,crypto:{randomUUID:()=> 'fixed-label'},
  practiceConfiguration:{seed:20261102,players:[{playerId:'synthetic',bats:'L',heightMeters:1.75,physical}],measuredClips:[clip]},$:id=>({value:values[id]}),swingDecision:()=>({version:'practice_swing_decision_v241',sourceId:'test',scope:'EXPLICIT_PRACTICE',mode:'SWING'}),
  core:{resolveLiveMatchPlayerPhysicalV98:p=>p.physical,resolveLiveBattingSetupV94:()=>({contactPlaneZ:.15}),validateLiveContactFrameMotorV244:x=>validators.validateLiveContactFrameMotorV244(structuredClone(x)),declareSpinPracticeEpisodesV242:x=>{declarations.push(structuredClone(x));return x}},
  send:async(kind,value)=>{calls.push({kind,value:structuredClone(value)});return {state:{...state,spinPracticeEpisodesV242:{phase:'ACTIVE'},spinMotorPracticeV239:{phase:'ACTIVE'}}}}};
 vm.createContext(context);vm.runInContext(body+';globalThis.run=startSpinMotor;',context);await context.run(technique,episodeMode);assert.equal(calls.length,1);
 if(episodeMode){const plan=declarations[0];assert.equal(calls[0].kind,'episodes-start');assert.deepEqual(plan.episodeSeeds,[20261102,20261103]);assert.equal(plan.motor.version,'live_contact_frame_motor_v244');assert.equal(plan.motor.technique,technique);assert.equal(Object.hasOwn(plan.motor,'delta'),false);assert.deepEqual(plan.motor.thresholds,{minimumComponent:1,minimumImprovement:1});assert.equal(plan.criterion.minimumIndependentTrials,2);assert.equal(calls[0].value.normalRequest.practiceSwingDecisionV241.mode,'SWING');assert.equal(calls[0].value.normalRequest.battingDirectionRequestV149.mode,'AUTO');validators.validateLiveContactFrameMotorV244(plan.motor);
 }else{assert.equal(calls[0].kind,'spin-start');validators.validateLiveSpinMotorV239(calls[0].value.motor);assert.equal(calls[0].value.motor.technique,technique);assert.equal(calls[0].value.motor.version,'live_spin_xy_motor_v239');}
 cases.push({technique,episodeMode,version:episodeMode?declarations[0].motor.version:calls[0].value.motor.version});
}

function renderReason(key){
 const nodes=new Map();function element(){return {children:[],textContent:'',append(...xs){this.children.push(...xs)},replaceChildren(){this.children=[]},querySelector(selector){return nodes.get(selector.slice(1))},set innerHTML(value){for(const match of value.matchAll(/id="([^"]+)"/g))nodes.set(match[1],element())}}}
 const container=element(),document={getElementById:id=>id==='batting-practice-editor'?container:nodes.get(id),createElement:element};
 const motor={subjectId:'synthetic',technique:'HOOK'},criterion={minimumIndependentTrials:2,minimumContactFraction:1,minimumSuccessFraction:1,minimumDirectionalSpin:1,minimumDirectionalImprovement:1};
 const record={command:{practiceSwingDecisionV241:{mode:'SWING'}},play:{contact:null,diagnostics:{[key]:{status:'NO_TARGET',reason:'retained-prediction-reason'}}}};
 const episodes={phase:'ENDED',activeIndex:0,plan:{motor,criterion,episodes:[{seed:1},{seed:2}]},slots:[{index:0,seed:1,initial:{},ended:true,steps:[{kind:'TARGET',trialRecord:record}]},{index:1,seed:2,initial:null,ended:false,steps:[]}],evaluation:{status:'HOLD'}};
 const fake={KneekuraBattingPractice:{inspect:()=>({state:{pitchCount:1,spinPracticeEpisodesV242:episodes},stale:false})},addEventListener(){}};
 vm.runInNewContext(inputs[1].bytes.toString('utf8'),{globalThis:fake,document,queueMicrotask:fn=>fn()});const text=nodes.get('spin-practice-result-v239').children.map(n=>n.textContent).join('\n');assert(text.includes('対象なし（候補を選べませんでした）'));assert(text.includes('本人の評価球は未実施'));assert(text.includes('打席終了・次の練習待ち'));return true;
}
assert(renderReason('observedSpinContactFrameV244'));assert(renderReason('observedSpinComposeV238'));
for(const input of inputs)assert.equal(sha(await readFile(input.path)),sha(input.bytes));
const report={pass:true,boundary:'UI_PAYLOAD_AND_RENDER_SEAMS_NOT_BROWSER_ACCEPTANCE',cases,newAndLegacyReasonRendering:true,sourcePins:inputs.map(x=>({path:x.path,sha256:sha(x.bytes)})),actualContact:false,goalComplete:false};
await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({pass:true,cases:cases.length,newAndLegacyReasonRendering:true}));
