import {test,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
function fixture(){const context=vm.createContext({});vm.runInContext(readFileSync(new URL('./whiff-follow-through-v88.js',import.meta.url),'utf8'),context);let builds=0;
 const core={createLiveBatPlaybackV88(){builds++;return {throughTick:1600,sampleAtTick:tick=>({grip:{x:tick,y:0,z:0},tip:{x:tick+1,y:0,z:0}})};}},
  record={frames:[{tick:1000},{tick:1500}],play:{call:'swinging_strike',diagnostics:{sourceClockTicksPerSecond:1000,swingOffered:true,batPlaybackV88:{}}}},
  input={record,frame:{phase:'pitch'},sceneMs:1590,preparationMs:1000,bodyBatFrame:3,measuredClip:{}};
 return {watch:context.KneekuraWhiffFollowThroughV88.create({core}),input,builds:()=>builds};}
test('advances post-call motor, clamps its exact finite endpoint and reuses the descriptor',()=>{
 const {watch,input,builds}=fixture();expect(watch.observe({...input,sceneMs:1500})).toBeNull();
 expect(watch.observe(input).bat.grip.x).toBe(1590);const end=watch.observe({...input,sceneMs:1655});expect(end.bat.grip.x).toBe(1600);expect(end.reason).toBe('FINITE_MEASURED_END_POSE');
 expect(watch.observe({...input,sceneMs:1900,bodyBatFrame:0}).bat).toBeNull();expect(watch.observe(input).bat.grip.x).toBe(1590);expect(builds()).toBe(1);
});
test('leaves take, contact and preparation alone and respects immediate third-out bench',()=>{
 const {watch,input,builds}=fixture();for(const call of ['called_strike','ball',null])expect(watch.observe({...input,record:{...input.record,play:{...input.record.play,call}}})).toBeNull();
 expect(watch.observe({...input,sceneMs:800})).toBeNull();expect(watch.observe({...input,frame:{phase:'bench'}}).bat).toBeNull();expect(builds()).toBe(0);
});
