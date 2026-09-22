import type { Vec3 } from '../../../model/geometry';
import type { SwingKinematicsTrajectoryV1 } from '../../../sim/contact/SwingKinematicsV1';
import { fail } from '../EmotionValidation';

const norm=(v:Vec3):number=>Math.hypot(v.x,v.y,v.z);
const midpoint=(a:Vec3,b:Vec3):Vec3=>({x:a.x/2+b.x/2,y:a.y/2+b.y/2,z:a.z/2+b.z/2});
/** Certify a quadratic velocity curve using its convex hull, subdividing loose hulls.
 * This validates the existing cubic-Hermite path; it does not generate another swing.
 * If the finite subdivision budget cannot certify a borderline profile, reject it.
 */
function certify(a:Vec3,b:Vec3,c:Vec3,ceiling:number,depth=0):void {
 const values=[norm(a),norm(b),norm(c)];
 if(values.some(v=>!Number.isFinite(v)))fail('INVALID_INPUT','batting.source.speedEnvelope.nonFinite');
 if(values.every(v=>v<=ceiling))return;
 const ab=midpoint(a,b),bc=midpoint(b,c),mid=midpoint(ab,bc);
 if(values[0]>ceiling || values[2]>ceiling || norm(mid)>ceiling)
  fail('INVALID_INPUT','batting.source.speedEnvelope.exceeded');
 if(depth===12)fail('INVALID_INPUT','batting.source.speedEnvelope.uncertified');
 certify(a,ab,mid,ceiling,depth+1);certify(mid,bc,c,ceiling,depth+1);
}
export function assertSwingSpeedEnvelope(t:SwingKinematicsTrajectoryV1,ceiling:number):void {
 const knots=[t.start,t.contact,t.finish],ticks=[t.startTick,t.contactTick,t.endTick];
 for(let i=0;i<2;i++){
  const a=knots[i],c=knots[i+1],seconds=(ticks[i+1]-ticks[i])/t.ticksPerSecond;
  // Derivative Bezier controls of the authoritative positional Hermite segment.
  const components=(['x','y','z'] as const).map(k=>3*((c.sweetSpotPosition[k]-a.sweetSpotPosition[k])/seconds)-a.sweetSpotVelocity[k]-c.sweetSpotVelocity[k]);
  const control={x:components[0],y:components[1],z:components[2]};
  certify(a.sweetSpotVelocity,control,c.sweetSpotVelocity,ceiling);
 }
}
