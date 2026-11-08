import type { Vec3 } from '../../model/geometry';

export type SphericalOccluder = Readonly<{
  center: Vec3;
  radiusMeters: number;
}>;
export type CapsuleOccluder = Readonly<{shape:'capsule';start:Vec3;end:Vec3;radiusMeters:number}>;
export type ObservationOccluder = SphericalOccluder|CapsuleOccluder;
const sub=(a:Vec3,b:Vec3):Vec3=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const dot=(a:Vec3,b:Vec3)=>a.x*b.x+a.y*b.y+a.z*b.z;
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const segmentDistanceSquared=(one:Vec3,two:Vec3,start:Vec3,end:Vec3)=>{
  const d=sub(two,one),axis=sub(end,start),r=sub(one,start),a=dot(d,d),e=dot(axis,axis),f=dot(axis,r),c=dot(d,r),b=dot(d,axis);
  if(e===0){const s=clamp(-c/a);return (r.x+s*d.x)**2+(r.y+s*d.y)**2+(r.z+s*d.z)**2;}
  const denominator=a*e-b*b;let s=denominator>0?clamp((b*f-c*e)/denominator):0,t=(b*s+f)/e;
  if(t<0){t=0;s=clamp(-c/a);}else if(t>1){t=1;s=clamp((b-c)/a);}
  const squared=(r.x+s*d.x-t*axis.x)**2+(r.y+s*d.y-t*axis.y)**2+(r.z+s*d.z-t*axis.z)**2;
  if(!Number.isFinite(squared))throw new Error('occlusion segment distance overflow');return squared;
};

const validateVec3 = (name: string, value: Vec3): void => {
  if (![value.x, value.y, value.z].every(Number.isFinite)) {
    throw new Error(`${name} must contain only finite coordinates`);
  }
};

export const estimateOcclusionVisibility = (
  observerPosition: Vec3,
  targetPosition: Vec3,
  occluders: readonly ObservationOccluder[],
): 0 | 1 => {
  validateVec3('observerPosition', observerPosition);
  validateVec3('targetPosition', targetPosition);

  const dx = targetPosition.x - observerPosition.x;
  const dy = targetPosition.y - observerPosition.y;
  const dz = targetPosition.z - observerPosition.z;
  const segmentLengthSquared = dx * dx + dy * dy + dz * dz;

  if (segmentLengthSquared === 0) {
    return 1;
  }

  for (const occluder of occluders) {
    if('shape' in occluder){
      if(occluder.shape!=='capsule')throw new Error('unsupported occluder shape');
      validateVec3('occluder.start',occluder.start);validateVec3('occluder.end',occluder.end);
      if(!Number.isFinite(occluder.radiusMeters)||occluder.radiusMeters<=0)throw new Error('radiusMeters must be finite and positive');
      if(segmentDistanceSquared(observerPosition,targetPosition,occluder.start,occluder.end)<=occluder.radiusMeters**2)return 0;
      continue;
    }
    validateVec3('occluder.center', occluder.center);
    if (!Number.isFinite(occluder.radiusMeters) || occluder.radiusMeters <= 0) {
      throw new Error('radiusMeters must be finite and positive');
    }

    const ox = occluder.center.x - observerPosition.x;
    const oy = occluder.center.y - observerPosition.y;
    const oz = occluder.center.z - observerPosition.z;

    // A center outside the segment may still have a radius overlapping an endpoint.
    const closestT = Math.max(0, Math.min(1, (
      ox * dx + oy * dy + oz * dz
    ) / segmentLengthSquared));

    const closestX = observerPosition.x + dx * closestT;
    const closestY = observerPosition.y + dy * closestT;
    const closestZ = observerPosition.z + dz * closestT;

    const ex = occluder.center.x - closestX;
    const ey = occluder.center.y - closestY;
    const ez = occluder.center.z - closestZ;
    const distanceSquared = ex * ex + ey * ey + ez * ez;

    if (distanceSquared <= occluder.radiusMeters * occluder.radiusMeters) {
      return 0;
    }
  }

  return 1;
};
