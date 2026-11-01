import {expect,it} from 'vitest';
import {resolveLiveFielderBodyModelV105} from './LiveFielderBodyGeometryV105';
import {readLiveFieldCommitmentV1,type LiveFieldCommitmentV1} from './LiveFieldCommitmentV1';
import {certifyLiveAthleticClearanceV1,validateLiveAthleticClearanceV1} from './LiveAthleticClearanceV1';
const v=(x=0,y=1,z=0)=>({x,y,z});
const motion=(actorId:string,x:number,z:number,dx=2):LiveFieldCommitmentV1=>readLiveFieldCommitmentV1({schemaVersion:1,actorId,commandId:actorId+':dive',revision:1,
 clock:{originTick:0,ticksPerSecond:1000000},worldRevision:3,fromSeconds:0,throughSeconds:1,fromTick:0,throughTick:1000000,
 kind:'athletic',bodyModel:resolveLiveFielderBodyModelV105(1.8,1.35),bodyRadiusMeters:.24,gloveRadiusMeters:.1,extraFootReachMeters:0,
 segments:[{fromSeconds:0,throughSeconds:1,controls:[v(x,1,z),v(x+dx/3,1,z),v(x+2*dx/3,1,z),v(x+dx,1,z)]}]});
const context=(commands:readonly LiveFieldCommitmentV1[])=>({scope:{},worldRevision:3,clock:{originTick:0,ticksPerSecond:1000000},fromSeconds:0,throughSeconds:1,commands,
 expectedActorIds:commands.map(c=>c.actorId),
 fence:{center:{x:0,z:0},radiusMeters:100}});
it('allows two adopted nonintersecting dive corridors with whole body reserves',()=>{
 const q=context([motion('front',0,0),motion('rear',0,4)]),r=certifyLiveAthleticClearanceV1(q);
 expect(r.kind).toBe('safe');expect(validateLiveAthleticClearanceV1(r,q)).toBe(true);
});
it('rejects crossing swept bodies even if willingness is high',()=>{
 const q=context([motion('left',-3,0,6),motion('right',3,0,-6)]);
 expect(certifyLiveAthleticClearanceV1(q).kind).toBe('unsafe');
});
it('does not certify a curved crossing from endpoint or midpoint separation alone',()=>{
 const a=motion('curve',-4,0,0),curve=readLiveFieldCommitmentV1({...a,segments:[{fromSeconds:0,throughSeconds:1,controls:[v(-4),v(4),v(4),v(-4)]}]}),
  b=motion('still',0,0,0);
 expect(certifyLiveAthleticClearanceV1(context([curve,b])).kind).toBe('unsafe');
});
it('keeps missing future coverage unknown instead of shrinking another body',()=>{
 const q=context([motion('one',0,0),motion('two',0,4)]);
 expect(certifyLiveAthleticClearanceV1({...q,throughSeconds:1.1}).kind).toBe('unknown');
});
it('requires a complete current world body snapshot before issuing a new proof',()=>{
 const q=context([motion('one',0,0),motion('two',0,4)]);
 expect(certifyLiveAthleticClearanceV1({...q,worldRevision:4}).kind).toBe('unknown');
 expect(certifyLiveAthleticClearanceV1({...q,commands:[q.commands[0]]}).kind).toBe('unknown');
});
it('invalidates a safe proof after a peer revision, withdrawal, world change, or clone',()=>{
 const q=context([motion('one',0,0),motion('two',0,4)]),r=certifyLiveAthleticClearanceV1(q);
 expect(validateLiveAthleticClearanceV1(r,{...q,commands:[q.commands[0],readLiveFieldCommitmentV1({...q.commands[1],revision:2})]})).toBe(false);
 expect(validateLiveAthleticClearanceV1(r,{...q,commands:[q.commands[0]]})).toBe(false);
 expect(validateLiveAthleticClearanceV1(r,{...q,worldRevision:4})).toBe(false);
 expect(validateLiveAthleticClearanceV1(structuredClone(r),q)).toBe(false);
 expect(validateLiveAthleticClearanceV1(r,{...q,scope:{}})).toBe(false);
});
it('does not promote a focused motor check into joint commit authority',()=>{
 const q=context([motion('one',0,0),motion('two',0,4)]),focused={...q,focusActorId:'one'},r=certifyLiveAthleticClearanceV1(focused);
 expect(r.kind).toBe('safe');expect(validateLiveAthleticClearanceV1(r,q)).toBe(false);
});
it('keeps complete bindings while avoiding irrelevant ordinary-pair interval expansion',()=>{
 const a=motion('air',0,0),ordinary=readLiveFieldCommitmentV1({...motion('focus',0,5),kind:'motor'}),
  noise=readLiveFieldCommitmentV1({...motion('other',0,20),kind:'motor',segments:[
   {fromSeconds:0,throughSeconds:.3,controls:[v(0,1,20),v(0,1,20),v(0,1,20),v(0,1,20)]},
   {fromSeconds:.3,throughSeconds:1,controls:[v(0,1,20),v(0,1,20),v(0,1,20),v(0,1,20)]}]}),
  q={...context([a,ordinary,noise]),focusActorId:'focus'},proof=certifyLiveAthleticClearanceV1(q),
  minimal=certifyLiveAthleticClearanceV1({...context([a,ordinary]),focusActorId:'focus'});
 expect(proof.kind).toBe('safe');expect(proof.checkedIntervals).toBe(minimal.checkedIntervals);
 expect(validateLiveAthleticClearanceV1(proof,{...q,commands:q.commands.slice().reverse()})).toBe(true);
 expect(validateLiveAthleticClearanceV1(proof,{...q,commands:structuredClone(q.commands)})).toBe(true);
 const changed=structuredClone(noise);Object.assign(changed,{revision:2});
 expect(validateLiveAthleticClearanceV1(proof,{...q,commands:[a,ordinary,changed]})).toBe(false);
 expect(validateLiveAthleticClearanceV1(proof,{...q,commands:[a,ordinary]})).toBe(false);
});
it('includes arm and stature differences and rejects incomplete or noninert path data',()=>{
 const a=motion('a',0,0),b=motion('b',0,4),large=readLiveFieldCommitmentV1({...a,bodyModel:resolveLiveFielderBodyModelV105(2.4,1.35,{fieldArmReachMetersV105:3})});
 expect(certifyLiveAthleticClearanceV1(context([large,b])).kind).not.toBe('safe');
 expect(()=>readLiveFieldCommitmentV1({...a,throughTick:2})).toThrow();
 expect(()=>readLiveFieldCommitmentV1({...a,get segments(){throw Error('must not execute');}})).toThrow();
});
