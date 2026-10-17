import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const context={};vm.runInNewContext(await readFile(new URL('./live-play-description.js',import.meta.url),'utf8'),context);
const describe=context.KneekuraLivePlayDescription.describe;
function record({classification='live_ball',outsBefore=0,outcomes=[],base=1,score=false,contacts=[],ground=null,extraTouches=[]}={}){
 const names=['first','second','third'],bases={first:null,second:null,third:null};
 if(base>=1&&base<=3&&!outcomes.some(out=>out.runnerId==='b'))bases[names[base-1]]='b';
 return {batterPlayerId:'b',beforeMatch:{outs:outsBefore},match:{bases},
  play:{classification,call:null,rules:{endedAtTick:100,outcomes,scoredRunnerIds:score?['b']:[]},
   field:{ruleFacts:{territory:'fair',firstGroundContactTick:ground,controlledBaseContacts:contacts,
    runnerTouches:[...Array.from({length:base},(_,i)=>({runnerId:'b',base:i+1,tick:20+i})),...extraTouches]}}}};
}
const out=(runnerId,tick=80,cause='base_control')=>({runnerId,tick,cause,classification:'force',defenderId:'f'});
const control=(base,tick=80)=>({base,tick,defenderId:'f'});
const assertions=[];
for(const [base,label]of [[1,'一塁出塁'],[2,'二塁到達'],[3,'三塁到達']]){
 const r=record({base}),before=JSON.stringify(r),d=describe(r);assert.equal(d.label,label);assert.equal(d.category,'in-play');
 assert.equal(d.scoring.officialHit,null);assert.equal(d.batter.baseReached,base);assert.equal(JSON.stringify(r),before);assertions.push(label);
}
for(const [classification,label]of [['single','ヒット（単打）'],['double','二塁打'],['triple','三塁打'],['home_run','ホームラン']]){
 const d=describe(record({classification}));assert.equal(d.label,label);assert.equal(d.category,'hit');assert.equal(d.scoring.officialHit,classification);assertions.push(label);
}
const ground=describe(record({base:0,ground:10,outcomes:[out('b')],contacts:[control(1)]}));assert.equal(ground.label,'ゴロアウト（一塁）');
const force=describe(record({outcomes:[out('r')],contacts:[control(2)]}));assert.equal(force.label,'一塁出塁・二塁フォースアウト');
const two=describe(record({base:0,outsBefore:1,outcomes:[out('r',70),out('b',80)],contacts:[control(2,70),control(1,80)]}));
assert.equal(two.label,'併殺（二塁→一塁）');assert.equal(two.playOuts,2);assert.equal(two.thirdOut,true);assert.equal(two.thirdOutAtTick,80);
const oneFromOne=describe(record({base:0,outsBefore:1,outcomes:[out('b')],contacts:[control(1)]}));assert.equal(oneFromOne.playOuts,1);assert.equal(oneFromOne.outsAfter,2);assert.equal(oneFromOne.thirdOut,false);assert(!oneFromOne.label.includes('併殺'));
const oneFromTwo=describe(record({base:0,outsBefore:2,outcomes:[out('b')],contacts:[control(1)]}));assert.equal(oneFromTwo.thirdOut,true);assert.equal(oneFromTwo.playOuts,1);
const triple=describe(record({base:0,outcomes:[out('r3',60),out('r2',70),out('b',80)],contacts:[control(4,60),control(2,70),control(1,80)]}));assert.equal(triple.label,'三重殺（本塁→二塁→一塁）');
const tag=describe(record({outcomes:[out('r',80,'runner_tag')]}));assert.equal(tag.label,'一塁出塁・走者タッチアウト');
const fly=describe(record({classification:'fly_out',base:0,outcomes:[out('b',80,'fly_catch')]}));assert.equal(fly.label,'フライアウト');
const future=describe(record({base:0,outcomes:[out('b',80)],contacts:[control(1)],extraTouches:[{runnerId:'b',base:3,tick:90},{runnerId:'b',base:4,tick:101}]}));assert.equal(future.batter.baseReached,0);
const home=describe(record({base:4,score:true}));assert.equal(home.label,'本塁生還');assert.equal(home.scoring.officialHit,null);assert.equal(home.runCount,1);
console.log(JSON.stringify({status:'PASS',explicitClassifications:assertions,groundOut:true,forceOut:true,tagOut:true,doublePlay:true,triplePlay:true,
 inningOutCountSeparate:true,postOutAndPostOfficialTouchesExcluded:true,unscoredAdvancementNotInventedHit:true,inputUnchanged:true}));
