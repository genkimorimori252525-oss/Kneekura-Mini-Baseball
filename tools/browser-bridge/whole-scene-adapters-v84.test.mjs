import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'vitest';
import vm from 'node:vm';
import {presentationControlsSourceV84} from './presentation-cadence-v84.mjs';
const directory='tools/browser-bridge/',copy=value=>structuredClone(value),
 oldMatch=await readFile(directory+'maker-match-renderer-v81.js','utf8'),
 oldPitcher=await readFile(directory+'maker-pitcher-renderer-v81.js','utf8'),
 newMatch=await readFile(directory+'maker-match-renderer-v84.js','utf8'),
 newPitcher=await readFile(directory+'maker-pitcher-renderer-v84.js','utf8'),
 newLab=await readFile(directory+'camera-workbench-v84.js','utf8');
function canvas(id,commands=[]){
 let width=1200,height=864;
 const context={imageSmoothingEnabled:true,setTransform(...args){commands.push([id,'transform',...args]);},
  clearRect(...args){commands.push([id,'clear',...args]);},drawImage(layer,...args){commands.push([id,'image',layer.id,...args]);},
  save(){},restore(){},scale(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}};
 return {id,commands,context,get width(){return width;},set width(value){width=value;commands.push([id,'width',value]);},
  get height(){return height;},set height(value){height=value;commands.push([id,'height',value]);},getContext:()=>context};
}
function adapter(source,kind){
 const commands=[],scenes=[],observations=[],players=[['A-b0','P','A'],['A-b1','C','A'],['B-b0','batter','B']].map(([playerId,role,team])=>
  ({playerId,role,team,heightMeters:1.83,throws:'R',hand:'R',physical:{heightMeters:1.83}})),
  actors=players.map((player,index)=>({playerId:player.playerId,role:player.role,position:{x:0,y:0,z:index?-.2:18},velocity:{x:0,y:0,z:0}})),
  field=canvas('field',commands),bat=canvas('bat-overlay',commands),ball=canvas('ball-overlay',commands),composite=canvas('composite',commands),
  data={players:Object.fromEntries(players.map(p=>[p.playerId,{name:p.playerId,height:1.83,team:p.team,hand:'R',throws:'R'}])),defenseMap:{A:{C:1}}},
  host={pitchCount:0,frame:{actors},fenceGeometry:{center:{x:0,z:0},radiusMeters:110,heightMeters:3}},
  normal={stop(){},inspect:()=>({host,currentFrame:host.frame,physicalRoster:{players},presentation:{timing:{preparationMs:1000}}})},
  animation=({sceneMs})=>{observations.push(sceneMs);return {actors:Object.fromEntries(players.map(p=>[p.playerId,{action:'hold',frame:sceneMs}])),batFrame:sceneMs,pitchFrame:sceneMs};},
  context={pitcherId:'A-b0',batterId:'B-b0',catcherId:'A-b1'},input={originTick:1000,batting:kind==='pitcher'?'take':'balanced',
   batter:{bats:'R',heightMeters:1.83},pitcher:{throws:'R',moundPosition:{x:0,y:0,z:18},pitchingMotion:{preparationMs:1000,headMotionScale:1}},measuredClips:[{id:'clip'}]},
  frames=[0,.05,.2].map(seconds=>({tick:1000+seconds*1e6,elapsedSeconds:seconds,ball:{position:{x:0,y:1,z:18-seconds*40},velocity:{x:0,y:0,z:-40},possessedBy:null}})),
  pitch={frames,clipId:'clip',call:'strike',diagnostics:{sourceClockTicksPerSecond:1e6,swingOffered:kind!=='pitcher'},
   sampleBatAtTick:tick=>({grip:{x:0,y:1,z:0},tip:{x:tick/1e6,y:1,z:0}})},
  root={structuredClone,performance:{now:()=>root.wall},wall:0,liveMatchPlayback:normal,
   document:{getElementById:id=>id==='match-data'?{textContent:JSON.stringify(data)}:({'field':field,'bat-overlay':bat,'ball-overlay':ball}[id]),
    querySelector:()=>({dataset:{appearance:'retro'}}),createElement:()=>composite},
   matchPreview:{liveDrawWorld(world,options){scenes.push({world:copy(world),options:copy(options)});return {cameraProjection:{eye:{x:0,y:1,z:0},yaw:0,pitch:0,f:440,cx:300,cy:104},ballDotDisplay:copy(world.ball)};},
    paintLivePitchBall(){throw Error('V81 must not paint a newer ball over an older scene');}},
   KneekuraCameraTuningBatterView:{create:()=>({observe:({sceneMs})=>({eye:{x:0,y:1,z:0},yaw:0,pitch:0,f:440,cx:300,cy:104,sceneMs})})},
   KneekuraPitchBallCadence:{create:()=>({sample:(_record,seconds)=>({position:{x:0,y:1,z:18-seconds*40},visible:true,sourceObservation:true,ballKind:'pitch'})})},
   KneekuraLiveActorAnimation:{observe:animation},KneekuraPitcherBodyHeadView:{configure(){},observe:({sceneMs})=>({sceneMs})},
   KneekuraNameDisplayControls:{paintToCanvas(ctx,w,h){commands.push(['names',w,h]);return {painted:true};}},getComputedStyle:()=>({display:'block'})};
 vm.runInNewContext(presentationControlsSourceV84,{globalThis:root});
 vm.runInNewContext(source,{window:root});
 const api=kind==='pitcher'?root.KneekuraMakerPitcherRendererV77:root.KneekuraMakerMatchRenderer,
  result=kind==='pitcher'?{version:77,authority:'SHARED_LIVE_PITCHER_WORKBENCH',pitch,sampleAtPitchElapsedSeconds(){}}:
   {version:69,cases:[1,2,3,4].map(level=>({level,pitch,flightFrames:[],sampleFlightAtPitchElapsedSeconds:seconds=>seconds>=.12?{position:{x:seconds,y:2,z:3}}:null}))};
 api.prepare({result,input,context,players});
 return {api,root,scenes,observations,commands,input,result,request:seconds=>kind==='pitcher'?{seconds:seconds+1,camera:'mound'}:{level:1,seconds}};
}

function lab(source){
 const commands=[],seeks=[],callbacks=[],elements=new Map(),get=id=>{
  if(!elements.has(id))elements.set(id,{...canvas(id,commands),textContent:'',checked:false,value:0,disabled:false,addEventListener(){}});
  return elements.get(id);
 };
 get('camera-workbench-source').textContent=JSON.stringify({sourceGameSha256:'game',sourceCoreSha256:'core'});
 const field=canvas('field'),bat=canvas('bat-overlay'),ball=canvas('ball-overlay'),controllers={A:{side:'A'},B:{side:'B'}},
  state={host:{match:{inning:1,half:'top',outs:0},finished:false},selectedPitch:0,generatedPitches:1,currentFrame:{tick:1000},
   rendered:{camera:'batter',cameraEye:{x:0,y:1,z:0},cameraYaw:0,cameraPitch:0,cameraProjection:{yaw:0}},
   presentation:{elapsedMs:0,durationMs:10000,fastPitchEligible:true,continuousBatterView:{phase:'pitch',aimWeight:0}}},
  playback={stop(){},inspect:()=>state,seekPresentationMs(ms){state.presentation.elapsedMs=ms;state.currentFrame.tick=1000+ms;seeks.push([child.KneekuraContinuousBatterView.side,ms]);},
   isFreePitchAtPresentationMs:()=>true,observePitchBallAtPresentationMs(){throw Error('V81 must not sample a separate ball time');},paintLivePitchBall(){throw Error('V81 must not paint a separate ball time');}},
  child={document:{getElementById:id=>({'field':field,'bat-overlay':bat,'ball-overlay':ball,'match-seed':{value:'seed'}}[id])},
   KneekuraNameDisplayControls:{paintToCanvas(){commands.push(['names']);}}},window={},
  hook="window.KneekuraCameraLab=Object.freeze({version:1,",
  instrumented=source.replace(hook,hook+"testV81:{configure:(w,p,c)=>{win=w;playback=p;controllers=c;ready=true;},renderPair,snapshots:()=>clone(snapshots)},");
 assert.notEqual(instrumented,source);
 vm.runInNewContext(instrumented,{window,document:{getElementById:get},CAMERA_LAB_GAME_HTML:'',performance:{now:()=>0},
  requestAnimationFrame:callback=>{callbacks.push(callback);return callbacks.length;},cancelAnimationFrame(){}});
 vm.runInNewContext(presentationControlsSourceV84,{globalThis:child});
 const api=window.KneekuraCameraLab;api.testV81.configure(child,playback,controllers);
 return {api,commands,seeks,callbacks,state,step(now){const callback=callbacks.shift();assert(callback);callback(now);}};
}


for(const [kind,beforeSource,afterSource]of [['match',oldMatch,newMatch],['pitcher',oldPitcher,newPitcher]]){
 test(kind+' keeps paused whole-scene observations and Core inputs exact',()=>{
  const before=adapter(beforeSource,kind),after=adapter(afterSource,kind);
  for(const seconds of [.01,.07,.15,.01])assert.deepEqual(copy(after.api.render({...after.request(seconds),playing:false})),copy(before.api.render({...before.request(seconds),playing:false})));
 });
 test(kind+' uses the same 22/6 pitch period and never a ball-only paint',()=>{
  const value=adapter(afterSource,kind);value.api.render({...value.request(.01),playing:true});
  value.root.wall=2;value.api.render({...value.request(.012),playing:true});assert.equal(value.scenes.length,1);
  value.root.wall=4;value.api.render({...value.request(.014),playing:true});assert.equal(value.scenes.length,2);
  assert.equal(value.scenes.at(-1).world.pitchFrame,value.observations.at(-1));
  value.api.presentationControls.configure({frequencyScale:1});
  value.root.wall=8;value.api.render({...value.request(.018),playing:true});assert.equal(value.scenes.length,2);
 });
}
test('free batted scenes use 55/12ms, contact forces one full-scene boundary redraw',()=>{
 const value=adapter(newMatch,'match');value.api.render({...value.request(.01),playing:true});
 value.root.wall=1;value.api.render({...value.request(.13),playing:true});assert.equal(value.scenes.length,2);
 value.root.wall=5;value.api.render({...value.request(.14),playing:true});assert.equal(value.scenes.length,2);
 value.root.wall=6;value.api.render({...value.request(.15),playing:true});assert.equal(value.scenes.length,3);
});
test('lab delegates to the same controls and copies both scenes at 22/6ms',()=>{
 const value=lab(newLab);value.api.play();value.step(0);value.step(2);value.step(4);
 assert.deepEqual(value.seeks,[['A',0],['B',0],['A',4],['B',4]]);
 for(const side of ['A','B'])assert.equal(value.commands.filter(row=>row[0]==='view-'+side&&row[1]==='image'&&row[2]==='ball-overlay').length,2);
});
