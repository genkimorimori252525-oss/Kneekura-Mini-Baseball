import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
const code=readFileSync('tools/browser-bridge/field-practice-renderer-v98.js','utf8'),zero=()=>({x:0,y:0,z:0});
function fixture(recovery){
 const actor=(standing=false)=>({playerId:'b',role:'runner',team:0,position:zero(),velocity:zero(),retired:true,
  bodyPoseV105:{foot:zero(),head:{x:standing?0:1.5,y:standing?1.8:.2,z:0}},athleticV115:{kind:'head_slide',phase:standing?'ready':'slide'}}),
  observation=tick=>({tick,ball:null,bat:null,actors:[actor()],phase:'batted',ballKind:'batted',fairKnown:true,possessedBy:null}),
  source=(tick,standing=false)=>({tick,ball:{position:zero(),velocity:zero(),visible:false,possessedBy:'p'},fielders:[],
   runners:[{runnerId:'b',position:zero(),velocity:zero(),retired:true,bodyPoseV105:actor(standing).bodyPoseV105,athleticV115:actor(standing).athleticV115}],
   ...(tick>1500?{recoveryV115:{kind:'runner_action_recovery',officialEndTick:1500,readOnly:true}}:{})}),
  frames=[observation(1000),observation(1500)],field={frames:[source(1000),source(1500)],facts:[{kind:'runner_out',tick:1500}],
   fieldGeometry:{fenceCenter:{x:0,z:0},fenceRadiusMeters:100},...(recovery?{recoveryFramesV115:[source(2000),source(2500,true)]}:{})};
 return {frames,field,beforeFrame:observation(1000),input:{ball:{},fielders:[{playerId:'p',defensivePosition:'P'}]},
  ticksPerSecond:1000,context:{battingTeam:0},batterPlayerId:'b',pitcherPlayerId:'p',rules:{kind:'applied',endedAtTick:1500}};
}
function renderer(){
 const calls=[],seen=[],root={structuredClone,document:{getElementById:id=>id==='match-data'?{textContent:JSON.stringify({players:{b:{height:1.8},p:{height:1.8}}})}:{width:600,height:432},createElement:()=>({})},
  matchPreview:{liveDrawWorld:()=>({actors:[]})},liveMatchPlayback:{stop(){},inspect:()=>({presentation:{timing:{preparationMs:500}}})},
  KneekuraNativeMatchCore:{LIVE_MATCH_BASES_V1:{},convertLiveFieldFramesV98(input){calls.push(input);return input.field.frames.map(f=>({tick:f.tick,ball:f.ball,bat:null,
   actors:f.runners.map(r=>({playerId:r.runnerId,role:'runner',team:0,position:r.bodyPoseV105.foot,velocity:r.velocity,retired:r.retired,bodyPoseV105:r.bodyPoseV105,athleticV115:r.athleticV115})),phase:'held',ballKind:'batted',possessedBy:'p'}));}},
  KneekuraLiveActorAnimation:{observe:({record,frame})=>{seen.push({record,frame});return {};}}};
 vm.runInNewContext(code,{window:root});return {view:root.KneekuraFieldPracticeRendererV98.install(root),calls,seen};
}
test('practice replays saved third-out recovery through Source standing without changing the official result',()=>{
 const result=fixture(true),before=JSON.stringify(result),{view,calls,seen}=renderer(),prepared=view.prepare({result,profiles:[],park:{fenceHeightMeters:2}});
 assert.equal(prepared.durationMs,1500);assert.equal(calls.length,1);assert.equal(calls[0].rules,null);
 assert.equal(calls[0].readyFrame,result.beforeFrame);assert.deepEqual(JSON.parse(JSON.stringify(calls[0].defense)),{P:'p'});
 assert.equal(calls[0].field.frames,result.field.recoveryFramesV115);assert.equal(calls[0].ticksPerSecond,1000);
 const old=view.render({ms:500,camera:'mound'});assert.equal(old.frame,result.frames[1]);assert.equal(old.fieldFrame,result.field.frames[1]);
 const last=view.render({ms:9999,camera:'mound'}),record=seen.at(-1).record;
 assert.equal(last.frameTick,2500);assert.equal(last.fieldFrame,result.field.recoveryFramesV115.at(-1));
 assert.equal(last.frame.recoveryV115,result.field.recoveryFramesV115.at(-1).recoveryV115);
 assert.equal(last.frame.actors[0].athleticV115.phase,'ready');assert.equal(last.frame.actors[0].bodyPoseV105.head.y,1.8);
 assert.equal(record.frames.length,4);assert.equal(record.frames[0],result.frames[0]);assert.equal(record.frames[1],result.frames[1]);
 assert.equal(record.play.rules,result.rules);assert.equal(result.rules.endedAtTick,1500);assert.equal(JSON.stringify(result),before);
});
test('practice without Source recovery keeps the previous frame references and duration',()=>{
 const result=fixture(false),before=JSON.stringify(result),{view,calls,seen}=renderer();
 assert.equal(view.prepare({result,profiles:[],park:{fenceHeightMeters:2}}).durationMs,500);assert.equal(calls.length,0);
 const last=view.render({ms:9999,camera:'mound'});assert.equal(last.frame,result.frames[1]);assert.equal(last.fieldFrame,result.field.frames[1]);
 assert.equal(seen.at(-1).record.frames,result.frames);assert.equal(JSON.stringify(result),before);
});
