import test from 'node:test';import assert from 'node:assert/strict';
import {createCrowdPlayback,crowdSymbol,includeCrowd,DEFAULT_CROWD_APPEARANCE,PENLIGHT_LENGTH_METERS} from './crowd.mjs';
test('two-frame motion twice then three-frame motion once forms a seven-frame loop',()=>{let now=0;const c=createCrowdPlayback({clock:()=>now}),poses=[];
 for(now=0;now<3200;now+=400)poses.push(c.inspect().frame);assert.deepEqual(poses,[0,2,0,2,0,1,2,0]);assert.equal(c.inspect().loopFrames,7);
 c.configure({frames:2});assert([0,1].includes(c.inspect().frame));assert.equal(c.inspect().pattern,'uniform');assert.throws(()=>c.configure({frames:4}));});
test('observed hit speeds up, expires, and duplicate IDs never retrigger',()=>{let now=0;const c=createCrowdPlayback({clock:()=>now});assert.equal(c.inspect().intervalMs,400);
 assert(c.react({type:'hit',id:'play-1'}).accepted);assert.equal(c.inspect().intervalMs,95);now=2500;assert.equal(c.inspect().reaction,null);assert(!c.react({type:'hit',id:'play-1'}).accepted);assert.equal(c.inspect().intervalMs,400);
 assert.throws(()=>c.react({type:'invent_result',id:'x'}));});
test('user pause and hidden page freeze the logical reaction deadline',()=>{let now=0;const c=createCrowdPlayback({clock:()=>now});c.react({type:'home_run',id:'hr'});now=100;c.configure({paused:true});now=10000;assert.equal(c.inspect().elapsedMs,100);
 c.configure({paused:false,hidden:true});now=20000;assert.equal(c.inspect().elapsedMs,100);c.configure({hidden:false});now=20100;assert.equal(c.inspect().elapsedMs,200);assert.equal(c.inspect().reaction,'home_run');
 c.configure({visible:false});now=25000;assert.equal(c.inspect().active,false);assert.equal(c.inspect().elapsedMs,200);});
test('home run response is not replaced by a lower-priority out; symbols preserve anchors and team colors',()=>{const c=createCrowdPlayback({clock:()=>0});c.react({type:'home_run',id:'hr'});assert(!c.react({type:'out',id:'out'}).accepted);
 const l={p:{x:30,y:4,z:70}},colors=['#b72e3d','#254f9a'],s=[0,1,2].map(f=>crowdSymbol(l,0,f,3,colors));assert.deepEqual(s[0].body,l.p);assert.notDeepEqual(s[0].tip,s[2].tip);assert.equal(s[0].color,s[1].color);assert.notEqual(s[0].color,crowdSymbol(l,1,0,3,colors).color);
 for(const x of s)assert(Math.hypot(x.tip.x-l.p.x,x.tip.z-l.p.z)<1.7);});
test('the pen stays exactly seven centimeters while the hand and body move independently',()=>{
 const l={p:{x:30,y:4,z:70}},tips=[];
 for(const size of [.5,1,1.8])for(let frame=0;frame<3;frame++){
  const s=crowdSymbol(l,0,frame,3,['#b72e3d','#254f9a'],{...DEFAULT_CROWD_APPEARANCE,size});
  assert(Math.abs(Math.hypot(s.tip.x-s.base.x,s.tip.y-s.base.y,s.tip.z-s.base.z)-.07)<1e-12);assert.equal(s.penLengthMeters,PENLIGHT_LENGTH_METERS);
  assert(Math.hypot(s.base.x-l.p.x,s.base.z-l.p.z)<=.3*size+1e-12);tips.push(s.tip);
 }assert.notDeepEqual(tips[3],tips[5]);
});
test('density reduction keeps stable nested groups and does not depend on animation phase',()=>{
 const small=[],large=[];for(let i=0;i<17280;i++){if(includeCrowd(i,.25))small.push(i);if(includeCrowd(i,.5))large.push(i);}
 assert(small.length>4000&&small.length<4500);assert(large.length>small.length);assert(small.every(i=>large.includes(i)));assert.equal(includeCrowd(0,1),true);
});
