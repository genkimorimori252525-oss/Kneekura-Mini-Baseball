import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../model/geometry';

/** Explicit static physical geometry. Neither an adopted park measurement nor
 * fair/home-run authority is inferred from this cylindrical shape. */
export type SourceFreeBallPoleV136 = Readonly<{
  surfaceId: string;
  center: Readonly<{ x: number; z: number }>;
  minimumHeight: number;
  maximumHeight: number;
  radiusM: number;
}>;

const fields=(v:unknown,keys:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)
  &&Object.keys(v).sort().join('|')===[...keys].sort().join('|');

/** Distance to a finite SOLID cylinder, including its flat caps. A point
 * inside the solid stays inside (normal is then indeterminate); it does not
 * acquire a fictitious escape direction from an infinite line or a sphere. */
export function createSourceFreeBallPoleV136(raw:SourceFreeBallPoleV136){
  const p=cloneInert(raw);
  if(!fields(p,['surfaceId','center','minimumHeight','maximumHeight','radiusM'])
    ||typeof p.surfaceId!=='string'||!p.surfaceId.length||p.surfaceId!==p.surfaceId.trim()
    ||!fields(p.center,['x','z'])||![p.center.x,p.center.z,p.minimumHeight,p.maximumHeight,p.radiusM].every(Number.isFinite)
    ||p.minimumHeight<0||p.maximumHeight<=p.minimumHeight||p.radiusM<=0
    ||![p.maximumHeight-p.minimumHeight,p.center.x-p.radiusM,p.center.x+p.radiusM,p.center.z-p.radiusM,p.center.z+p.radiusM].every(Number.isFinite)
    ||p.center.x-p.radiusM>=p.center.x||p.center.x+p.radiusM<=p.center.x
    ||p.center.z-p.radiusM>=p.center.z||p.center.z+p.radiusM<=p.center.z)throw Error('invalid explicit nonlinear pole geometry');
  // Technical SI coordinate support, not a measured stadium dimension. A
  // gigantic cancelling center/radius can lose the entire baseball-sized gap
  // in subtraction; do not silently classify that unsupported geometry.
  if(Math.max(Math.abs(p.center.x)+p.radiusM,Math.abs(p.center.z)+p.radiusM,p.maximumHeight)>1e6)
    throw Error('nonlinear pole geometry exceeds technical coordinate range');
  Object.freeze(p.center);Object.freeze(p);
  const closest=(point:Vec3):Vec3=>{
    const dx=point.x-p.center.x,dz=point.z-p.center.z,radial=Math.hypot(dx,dz),scale=radial>p.radiusM?p.radiusM/radial:1;
    return{x:radial<=p.radiusM?point.x:p.center.x+dx*scale,
      y:Math.max(p.minimumHeight,Math.min(p.maximumHeight,point.y)),z:radial<=p.radiusM?point.z:p.center.z+dz*scale};
  };
  return Object.freeze({source:p,closest});
}
