import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('./live-pitch-chart-v94.js',import.meta.url),'utf8'),
 oldSource=readFileSync(new URL('./live-pitch-chart-v78.js',import.meta.url),'utf8'),copy=value=>JSON.parse(JSON.stringify(value)),
 position=t=>({x:t*.1,y:1-.2*t,z:2-2*t}),region={centerX:0,halfWidth:.2159,lowerY:.43,upperY:1.08},
 setup={version:94,plateFrontZ:.4318,region};
function record({modern=true,contact=false,playId=1,endedAtTick=2_000_000}={}){
 return {beforeMatch:{playId},match:{balls:0,strikes:1},pitchType:'curve',speedKmh:120,
  play:{rules:{endedAtTick,batterAdvanced:false},diagnostics:{sourceClockTicksPerSecond:1e6,catcherContactElapsedSeconds:.99,
   ...(modern?{battingSetupV94:setup}:{}),sourceDescriptor:{kind:'aero_ground_continuous_source_kernel_v2',
    initial:{originTick:1e6,elapsedSeconds:0,ball:{position:position(0),velocity:{x:.1,y:-.2,z:-2}}},throughElapsedSeconds:1,
    profile:{air:{gravityY:-9.81}}}},contactMoment:contact?{elapsedSeconds:.65,ball:{position:position(.65)}}:null}};
}
function environment(script=source){
 const calls=[],ctx={};for(const name of ['setTransform','clearRect','fillRect','beginPath','moveTo','lineTo','stroke','strokeRect','fillText','closePath','fill'])
  ctx[name]=(...args)=>calls.push({name,args,strokeStyle:ctx.strokeStyle});
 const canvas={getContext:()=>ctx,setAttribute(){},getBoundingClientRect:()=>({left:0,top:0,width:320,height:304})},caption={},
  core={createSourceBallMaterialHistoryV1:()=>({evaluateAt:seconds=>({moment:{ball:{position:position(seconds)}}})})},
  root={KneekuraPitchSymbols:{draw:(_ctx,entry,project)=>({...project(entry.location.position),r:14,pitchId:entry.pitchId})},
   KneekuraPitchHistory:{select:({records})=>({entries:records})},KneekuraLivePlayDescription:{describe:()=>({label:'ストライク',category:'strike'})}};
 vm.runInNewContext(script,{globalThis:root});return {api:root.KneekuraLivePitchChart.create({canvas,caption,core}),calls,caption};
}
const observe=(api,pitch,extra={})=>api.observe({records:[pitch],pitchIndex:0,atTick:2_000_000,batterHeightMeters:1.8,...extra});

test('new marks observe the real Source at the same plate front as V94 statistics',()=>{
 const {api}=environment(),pitch=record(),before=JSON.stringify(pitch),result=observe(api,pitch),entry=result.history[0],evidence=result.locations[0];
 expect(entry.location.position.z).toBeCloseTo(.4318,11);
 expect(evidence.elapsedSeconds).toBeCloseTo((2-.4318)/2,11);expect(evidence.planeZ).toBe(.4318);
 expect(evidence.method).toBe('ORIGINAL_SOURCE_HOME_PLATE_FRONT_Z_0_4318');expect(copy(result.zone)).toEqual(region);
 expect(JSON.stringify(pitch)).toBe(before);
});

test('legacy issued records retain the full old observation and paint with the old region',()=>{
 const old=environment(oldSource),updated=environment(),pitch=record({modern:false}),before=JSON.stringify(pitch),
  original=observe(old.api,pitch),result=observe(updated.api,pitch,{battingSetupV94:setup});
 expect(copy(result)).toEqual(copy(original));expect(result.locations[0].planeZ).toBe(.15);
 old.api.draw(original);updated.api.draw(result);expect(copy(updated.calls)).toEqual(copy(old.calls));
 expect(JSON.stringify(pitch)).toBe(before);
});

test('both observation and painted chart bounds use the supplied canonical body landmarks',()=>{
 const {api,calls}=environment(),result=observe(api,record());api.draw(result);
 const border=calls.find(call=>call.name==='strokeRect'&&call.strokeStyle==='#e0b541');
 for(const [i,expected]of [160-region.halfWidth*290,286-region.upperY*204,region.halfWidth*580,(region.upperY-region.lowerY)*204].entries())
  expect(border.args[i]).toBeCloseTo(expected,11);
 expect(copy(api.inspect().zone)).toEqual(region);
 const ready=api.observe({records:[],pitchIndex:-1,atTick:0,batterHeightMeters:1.8,battingSetupV94:setup});
 expect(copy(ready.zone)).toEqual(region);expect(ready.history).toHaveLength(0);
});

test('actual bat-contact locations and future-information filtering remain unchanged',()=>{
 const {api}=environment(),pitch=record({contact:true}),result=observe(api,pitch);
 expect(copy(result.history[0].location)).toEqual({kind:'contact',position:position(.65)});
 expect(result.locations[0].method).toBe('CORE_CONTACT_MOMENT');expect(result.locations[0].planeZ).toBeNull();
 expect(observe(api,pitch,{atTick:1_999_999}).history).toHaveLength(0);
});
