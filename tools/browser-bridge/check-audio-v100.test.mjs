import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const source=await readFile('tools/browser-bridge/live-audio-v100.js','utf8');
function environment(){
 const starts=[],root={atob:s=>Buffer.from(s,'base64').toString('binary'),localStorage:{getItem:()=>null,setItem(){}},addEventListener(){},
  document:{hidden:false,addEventListener(){}},KneekuraAudioPackV100:Object.fromEntries(['start','wood1','wood2','wood3','wood4','catch','mitt','throw','swing','hit1','hit2','homerun','clap','end','score'].map(k=>[k,{base64:'AA=='}])),
  AudioContext:class {state='running';currentTime=0;destination={};resume(){return Promise.resolve();}decodeAudioData(){return Promise.resolve({});}
   createGain(){return{gain:{value:0},connect(){},disconnect(){}};}
   createBufferSource(){return{connect(){},disconnect(){},start(){starts.push(this);},stop(){this.onended?.();}};}}};
 root.parent=root;vm.runInNewContext(source,root);return {api:root.KneekuraAudioV100,root,starts};
}
function record(){return {beforeMatch:{playId:1},frames:[{tick:1000}],command:{batting:'balanced'},finished:false,
 play:{classification:'live_ball',diagnostics:{sourceClockTicksPerSecond:1e6},contactMoment:{originTick:1000,ball:{tick:100000}},
 outgoingBallMoment:{ball:{velocity:{x:0,y:4,z:25}}},localScoringV100:{atTick:900000,hits:1},
 field:{facts:[{kind:'throw_release',tick:600000}]},rules:{endedAtTick:900000,scoredRunnerIds:[],outcomes:[]}}};}
const flush=()=>new Promise(r=>setImmediate(r));
test('separates actual bat contact from scored hit, with timestamped throw and no fabricated error cheer',()=>{
 const {api}=environment(),r=record(),rows=api.events(r);assert.equal(rows.find(e=>e.key==='wood4').tick,100000);
 assert.equal(rows.find(e=>e.key==='hit1').tick,900000);assert.equal(rows.find(e=>e.key==='throw').tick,600000);
 assert.equal(rows.some(e=>e.key==='hbp'),false);assert.deepEqual(r,record());assert.equal(api.events(r),rows);
});
test('prefix playback deduplicates, seeks suppress backlog, mute and speed suppress playback',async()=>{
 const {api}=environment(),owner=api.owner();await owner.unlock();const observer=api.create(),r=record();
 observer.observe({record:r,tick:1000,playing:true});observer.observe({record:r,tick:110000,playing:true});await flush();
 assert.equal(owner.inspect().trace.map(e=>e.key).join(','),'wood4');observer.observe({record:r,tick:110000,playing:true});await flush();assert.equal(owner.inspect().trace.length,1);
 observer.observe({record:r,tick:900000,playing:false});observer.observe({record:r,tick:950000,playing:true});await flush();assert.equal(owner.inspect().trace.length,1);
 observer.observe({record:r,tick:1000,playing:false});owner.configure({mute:true});observer.observe({record:r,tick:110000,playing:true});await flush();assert.equal(owner.inspect().trace.length,1);
 owner.configure({mute:false});observer.observe({record:r,tick:1000,playing:false});observer.observe({record:r,tick:110000,playing:true,speed:4});await flush();assert.equal(owner.inspect().voices,0);
});
test('maker policy suppresses all crowds without suppressing effects or changing normal-game preferences',async()=>{
 const {api,root}=environment(),a=api.owner();root.KneekuraAudioPolicyV100={crowd:false};await a.unlock();
 const r=record();r.play.outgoingBallMoment.ball.velocity.z=45;const o=api.create();o.observe({record:r,tick:1000,playing:true});o.observe({record:r,tick:110000,playing:true});await flush();
 assert.equal(a.inspect().trace.map(e=>e.key).join(','),'wood1');assert.equal(a.inspect().settings.crowd,.45);
});
test('the hidden normal observer cannot stop the active camera-lab observer on every seek',async()=>{
 const {api}=environment(),a=api.owner();await a.unlock();const lab=api.create(),hiddenNormal=api.create(),r=record();
 lab.observe({record:r,tick:1000,playing:true});lab.observe({record:r,tick:110000,playing:true});await flush();assert.equal(a.inspect().voices,1);
 hiddenNormal.stop();hiddenNormal.observe({record:r,tick:110000,playing:false});assert.equal(a.inspect().voices,1);
 lab.stop();assert.equal(a.inspect().voices,0);
});
test('notifies the adjacent controls when a demand-loaded sound fails after unlock',async()=>{
 const {api}=environment(),a=api.owner();await a.unlock();let changed=0;const unsubscribe=a.subscribe(()=>changed++);
 await a.sound({id:'bad',key:'missing',tick:10,group:'crowd',priority:1},{});
 assert.match(a.inspect().error,/音源を再生できません/);assert.equal(changed,1);unsubscribe();
});
test('prepares one generated scene without playing a future event',async()=>{
 const {api}=environment(),a=api.owner();await a.unlock();const observer=api.create();observer.observe({record:record(),tick:1000,playing:false});await flush();
 assert.equal(a.inspect().trace.length,0);assert.equal(a.inspect().voices,0);assert.ok(a.inspect().decoded<=16);assert.ok(a.inspect().decoded>8);
});
test('keeps both decoded buffers and voice count bounded, and cleans paused audio',async()=>{
 const {api}=environment(),a=api.owner();await a.unlock();for(let i=0;i<32;i++)a.sound({id:String(i),key:'wood1',tick:i,group:'sfx',priority:1},'test');await flush();
 assert.ok(a.inspect().voices<=8);assert.ok(a.inspect().decoded<=16);a.stop();assert.equal(a.inspect().voices,0);
});
test('lossless offline pack matches every pinned WAV; no GM, BGM or unused sources',async()=>{
 const pack=JSON.parse(await readFile('work/v100-investigation/audio-pack.json')),manifest=JSON.parse(await readFile('work/v100-investigation/audio-pack.manifest.json'));
 assert.equal(Object.keys(pack).length,20);
 for(const [key,row]of Object.entries(pack)){const bytes=inflateSync(Buffer.from(row.base64,'base64')),entry=manifest.assets[key];
  assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);assert.equal(bytes.length,entry.bytes);assert.ok(!/GM_|BGM/.test(entry.file));}
});
