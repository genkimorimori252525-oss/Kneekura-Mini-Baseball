import {expect,test} from 'vitest';
import vm from 'node:vm';
import {presentationControlsSourceV84,applyPresentationCadenceV84} from './presentation-cadence-v84.mjs';
import {readFileSync} from 'node:fs';
function controls(){const root={};vm.runInNewContext(presentationControlsSourceV84,{globalThis:root});return root.KneekuraPresentationControlsV84;}
test('multiplies all scene cadence targets and preserves pitch 2.5 and batted 2 ratios',()=>{
 const c=controls();expect(c.inspect()).toMatchObject({frequencyScale:2,qualityScale:1.2,baseSceneMs:55/3});
 expect(c.intervalMs({kind:'pitch',free:true})).toBeCloseTo(22/6,12);
 expect(c.intervalMs({kind:'batted',free:true})).toBeCloseTo(55/12,12);
 for(const kind of ['throw','held','ready'])expect(c.intervalMs({kind,free:true})).toBeCloseTo(55/6,12);
 expect(c.intervalMs({kind:'batted',free:true,possessed:'LF'})).toBeCloseTo(55/6,12);
 c.configure({frequencyScale:1,qualityScale:1});expect(c.intervalMs({kind:'pitch',free:true})).toBeCloseTo(22/3,12);
});
test('quality lattice uses integer cell indices, has no repeated-addition drift or depth collisions',()=>{
 const c=controls(),g=c.grid;expect(g.step()).toBe(4/1.2);const xs=g.range(g.step(),600-g.step()),ys=g.range(g.step(),432-g.step());
 expect(xs).toHaveLength(179);expect(ys).toHaveLength(128);expect(g.range(g.step(),600-g.step())).toBe(xs);expect(Object.isFrozen(xs)).toBe(true);const keys=new Set();
 for(const x of xs)for(const y of ys){expect(g.aligned(x)&&g.aligned(y)).toBe(true);keys.add(g.key(x,y));expect(g.snap(x)).toBe(x);}
 expect(keys.size).toBe(xs.length*ys.length);expect(xs.at(-1)).toBe(179*4/1.2);
 c.configure({qualityScale:1});expect(g.range(4,596)).toEqual(Array.from({length:149},(_,i)=>(i+1)*4));expect(g.key(596,428)).toBe(596*512+428);
});
test('configuration validates atomically and never reads accessor settings',()=>{
 const c=controls(),before=c.inspect();for(const value of [0,NaN,Infinity,'2'])expect(()=>c.configure({frequencyScale:value})).toThrow();
 expect(()=>c.configure({qualityScale:10})).toThrow();expect(()=>c.configure({unknown:1})).toThrow();
 expect(()=>c.configure({get qualityScale(){throw Error('accessor read');}})).toThrow(/data/);
 expect(c.inspect()).toEqual(before);
});
test('cadence patch uses one shared whole-scene period and retains physical wall clock expression',()=>{
 const old=readFileSync(new URL('../../docs/demos/releases/v83/game.html',import.meta.url),'utf8'),next=applyPresentationCadenceV84(old);
 expect(next).toContain('KneekuraPresentationControlsV84.intervalMs');expect(next).toContain('ballKind');
 expect(next).toContain("const target=playFromMs+Math.max(0,now-playStart)*(Number($('speed').value)||1);");
 expect(next).not.toContain('else if(pitchChanged)paintPitchBall()');expect(()=>applyPresentationCadenceV84(next)).toThrow();
});
