import { readFileSync } from 'node:fs';
import { expect,it } from 'vitest';
import { runFieldPracticeV98 } from './FieldPracticeWorkbenchV98';
const bases=JSON.parse(readFileSync('docs/demos/field-infield-bounce-v108.json','utf8'));
const cases=[['SS',-18,0],['2B',18,0],['3B',-40,0],['1B',40,0],
  ['bounce-low',-18,-.04],['bounce-mid',-18,-.08],['bounce-deep',-18,-.12],['bounce-rolling',-18,-.25]] as const;
for(const team of ['0','1'])it.each(cases)(`receives team ${team} %s without an opposing hand strike`,(_name,direction,pitch)=>{
 const input=structuredClone(bases[team]),angle=direction*Math.PI/180;
 input.fieldInput.maxPlaySeconds=15;
 input.fieldInput.ball.ball.velocity={x:Math.sin(angle)*27.5,y:-1.8,z:Math.cos(angle)*27.5};
 if(pitch)input.executionPerturbationsV95={throwErrors:[{releaseOrdinal:0,yawRadians:0,pitchRadians:pitch}]};
 const before=JSON.stringify(input),r=runFieldPracticeV98(input),contacts=r.field.diagnostics.aiTelemetry.contactDiagnostics;
 expect(r.field.end.complete).toBe(true);expect(contacts.length).toBeGreaterThan(0);
 if(pitch){const release=r.field.facts.find(f=>f.kind==='throw_release')!,
   ground=r.field.facts.find(f=>f.kind==='ground_contact'&&f.tick>release.tick)!;
   expect(ground).toBeDefined();
   expect(contacts.some(c=>c.elapsedSeconds>ground.elapsedSeconds)).toBe(true);}
 for(const c of contacts.filter(c=>c.role==='glove')){
   const spec=r.input.fielders.find(f=>f.playerId===c.playerId)!,v=c.retention!.gloveVelocity;
   expect(c.retention!.outcome).toBe('secured');
   expect(Math.hypot(v.x,v.y,v.z)).toBeLessThanOrEqual(c.bodySpeedMps+spec.gloveSpeedMps*.25);
 }
 expect(JSON.stringify(input)).toBe(before);
});

it('retains authored stature, ability and ground/venue differences rather than flattening them',()=>{
 for(const [height,hand,friction,radius] of [[1.6,8,.65,100],[2.05,18,1.8,130]]){
   const input=structuredClone(bases['1']),id=input.fieldInput.defense.SS,
     p=input.fieldInput.players.find((p:{playerId:string})=>p.playerId===id);
   p.heightMeters=height;p.physical.gloveSpeedMps=hand;
   input.fieldInput.field.fenceRadiusMeters=radius;
   input.fieldInput.physics.ground.material.rollingDecelerationMps2=friction;
   const before=JSON.stringify(input),r=runFieldPracticeV98(input),fielder=r.input.fielders.find(f=>f.playerId===id)!;
   expect(fielder.bodyModelV105!.heightMeters).toBe(height);expect(fielder.gloveSpeedMps).toBe(hand);
   expect(r.input.field.fenceRadiusMeters).toBe(radius);
   expect(r.input.physics.ground.material.rollingDecelerationMps2).toBe(friction);
   expect(JSON.stringify(input)).toBe(before);
 }
});
