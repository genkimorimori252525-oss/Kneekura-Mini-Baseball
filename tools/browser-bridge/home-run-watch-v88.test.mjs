import {test,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const plain=v=>JSON.parse(JSON.stringify(v));
function api(){const c=vm.createContext({});vm.runInContext(readFileSync(new URL(process.env.HR_WATCH_SOURCE??'./home-run-watch-v88.js',import.meta.url),'utf8'),c);return c.KneekuraHomeRunWatchV83;}
function fixture(seed=1){
 const ball=x=>({position:{x,y:5,z:105},velocity:{x:1,y:-1,z:2},spin:{x:1,y:2,z:3},visible:false,phase:'dead',possessedBy:null});
 const frames=[{tick:1000000,ballKind:'pitch',ball:ball(0)},{tick:2000000,ballKind:'batted',ball:ball(1)},{tick:3000000,ballKind:'batted',ball:ball(2),homeRunConfirmed:true}];
 const record={batterPlayerId:'B',pitcherPlayerId:'P',frames,play:{classification:'home_run',diagnostics:{sourceClockTicksPerSecond:1e6,courseRecognitionV87:{batter:{seed}}},field:{ruleFacts:{overFence:{tick:3000000,fair:true,untouchedGround:true,cause:'batted'},firstGroundContactTick:null}}}};
 return {record,frame:frames[2],sceneMs:3540,preparationMs:1540,selectedCamera:'mound',cameraAt:()=>({camera:'fielder',observerPlayerId:'LF'})};
}
test('samples a stable per-play duration across the inclusive 1500..2000ms range',()=>{
 const a=api(),samples=Array.from({length:128},(_,i)=>a.create().observe(fixture(i)).holdMs);
 expect(samples.every(n=>Number.isInteger(n)&&n>=1500&&n<=2000)).toBe(true);expect(new Set(samples).size).toBeGreaterThan(40);
 const f=fixture(8),w=a.create(),first=plain(w.observe(f));expect(plain(w.observe({...f,sceneMs:f.sceneMs+20}))).toEqual({...first});
 expect(a.create().observe({...f,cameraAt:undefined})).toBeNull();
 expect(a.create().observe(f).holdMs).toBe(first.holdMs);
});
test('keeps the admitted fielder through its sampled deadline, including reverse seeks',()=>{
 const w=api().create(),f=fixture(),start=plain(w.observe(f)),end=start.untilMs;
 expect(start.camera).toBe('fielder');expect(start.observerPlayerId).toBe('LF');expect(end).toBe(3540+start.holdMs);
 expect(w.observe({...f,sceneMs:end-.001})).not.toBeNull();expect(w.observe({...f,sceneMs:end})).toBeNull();expect(plain(w.observe(f))).toEqual(start);
 expect(w.minDurationMs(f)).toBe(end);
});
test('decisive home runs keep the actual mound observer through the same watch window',()=>{
 const f={...fixture(),cameraAt:()=>({camera:'mound',observerPlayerId:'P'})},w=api().create(),v=w.observe(f);
 expect(v).not.toBeNull();expect(v.camera).toBe('mound');expect(v.observerPlayerId).toBe('P');
 expect(w.observe({...f,sceneMs:v.untilMs-.001}).camera).toBe('mound');expect(w.observe({...f,sceneMs:v.untilMs})).toBeNull();
});
test('a confirmed decisive-HR mound view takes priority over an older fielder handoff',()=>{
 const f=fixture();f.frame.defensiveOpportunity={kind:'none-decisive-over-fence'};
 f.cameraAt=sample=>sample.tick===2000000?{camera:'fielder',observerPlayerId:'LF'}:{camera:'mound',observerPlayerId:'P'};
 expect(api().create().observe(f).camera).toBe('mound');
});
test('requires a physically confirmed fair fence crossing and never reads future payloads',()=>{
 const f=fixture(),w=api().create();
 expect(w.observe({...f,frame:f.record.frames[1]})).toBeNull();expect(w.observe({...f,sceneMs:3539})).toBeNull();
 const future={tick:4000000};for(const key of ['ball','homeRunConfirmed','ballKind'])Object.defineProperty(future,key,{get(){throw Error('future payload read');}});
 f.record.frames.push(future);expect(w.observe(f)).not.toBeNull();
 for(const patch of [{fair:false},{untouchedGround:false},{cause:'throw'}]){const r=fixture();Object.assign(r.record.play.field.ruleFacts.overFence,patch);expect(w.observe(r)).toBeNull();}
});
test('copies the displayed dead ball and does not expose custody or alter canonical records',()=>{
 const f=fixture(),before=plain(f.record),w=api().create(),v=w.observe(f);expect(v.displayBall.visible).toBe(true);expect(f.record).toEqual(before);
 f.frame.possessedBy='C';expect(w.observe(f).displayBall).toBeUndefined();
 const bench={tick:3500000,ballKind:'batted',phase:'bench',ball:null};f.record.frames.push(bench);
 expect(w.observe({...f,frame:bench,sceneMs:4000})).toMatchObject({camera:'fielder',target:before.frames[2].ball.position});
});
