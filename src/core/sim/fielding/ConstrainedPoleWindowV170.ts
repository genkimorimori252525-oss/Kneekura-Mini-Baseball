import type { Vec3 } from '../../model/geometry';

export type ConstrainedPoleV170 = Readonly<{ surfaceId:string; center:Readonly<{x:number;z:number}>; radiusM:number }>;
type Cell = Readonly<{fromElapsedSeconds:number;throughElapsedSeconds:number;maximumPositionSpeedMps:number;positionRoundingBoundMeters:number}>;
export type ConstrainedPoleWindowSourceV170 = Readonly<{
  initialElapsedSeconds:number;throughElapsedSeconds:number;initialPosition:Vec3;initialVelocity:Vec3;fenceCenter:Vec3;
  radialDisplacement:Readonly<{x:number;z:number}>;maximumSlidingAccelerationMps2:number;ballRadiusMeters:number;
  cells:readonly Cell[];positionAt:(elapsedSeconds:number)=>Vec3;
}>;
export type ConstrainedPoleWindowRequestV170 = Readonly<{fromElapsedSeconds:number;throughElapsedSeconds:number;poles:readonly ConstrainedPoleV170[]}>;
type Bounds = Readonly<{surfaceId:string;fromElapsedSeconds:number;throughElapsedSeconds:number;
  maximumPositionSpeedMps:number;travelUpperMeters:number;positionRoundingUpperMeters:number;gapLowerMeters:number}>;
type Common = Readonly<{numericModel:'CORE_256EPS_GEOMETRY_AWARE_WINDOW_V170';nativeAdmission:false;positionArithmeticBoundMeters:number|null}>;
export type ConstrainedPoleWindowResultV170 = Common & (Readonly<{kind:'clear';fromElapsedSeconds:number;throughElapsedSeconds:number;
  minimumGapLowerMeters:number;cellsChecked:number;poleCount:number;bounds:readonly Bounds[]}> | Readonly<{kind:'unresolved';
  reason:'invalid_window'|'invalid_source_bound'|'invalid_pole_scope'|'nonfinite_arithmetic'|'source_window_not_covered'|'separation_not_proved';
  interval?:Readonly<{fromElapsedSeconds:number;throughElapsedSeconds:number}>;surfaceId?:string;gapLowerMeters?:number}>);

const freeze=<T>(value:T):T=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const bits=new DataView(new ArrayBuffer(8));
function nextUp(value:number):number {
  if(Number.isNaN(value)||value===Infinity)return value;
  if(value===0)return Number.MIN_VALUE;
  bits.setFloat64(0,value);bits.setBigUint64(0,bits.getBigUint64(0)+(value>0?1n:-1n));return bits.getFloat64(0);
}
function nextDown(value:number):number {
  if(Number.isNaN(value)||value===-Infinity)return value;
  if(value===0)return -Number.MIN_VALUE;
  bits.setFloat64(0,value);bits.setBigUint64(0,bits.getBigUint64(0)+(value>0?-1n:1n));return bits.getFloat64(0);
}
const addUp=(a:number,b:number)=>nextUp(a+b),mulUp=(a:number,b:number)=>nextUp(a*b);
const finiteVector=(p:Vec3)=>[p.x,p.y,p.z].every(Number.isFinite);

/** A numerical exclusion query on a supplied constrained Source, never a free
 * descriptor, contact witness, legal result or Native authorization. The owner
 * supplies its real cells and evaluator; no substitute trajectory is made. */
export function queryConstrainedPoleWindowV170(source:ConstrainedPoleWindowSourceV170,request:ConstrainedPoleWindowRequestV170):ConstrainedPoleWindowResultV170 {
  let positionArithmeticBoundMeters:number|null=null;
  const unresolved=(reason:Extract<ConstrainedPoleWindowResultV170,{kind:'unresolved'}>['reason'],
    interval?:Readonly<{fromElapsedSeconds:number;throughElapsedSeconds:number}>,surfaceId?:string,gapLowerMeters?:number):ConstrainedPoleWindowResultV170 =>
    freeze({kind:'unresolved',numericModel:'CORE_256EPS_GEOMETRY_AWARE_WINDOW_V170',nativeAdmission:false,positionArithmeticBoundMeters,
      reason,...(interval?{interval}:{}),...(surfaceId===undefined?{}:{surfaceId}),...(gapLowerMeters===undefined?{}:{gapLowerMeters})});
  const from=request.fromElapsedSeconds,through=request.throughElapsedSeconds;
  if(![from,through,source.initialElapsedSeconds,source.throughElapsedSeconds].every(Number.isFinite)
    ||through<from||from<source.initialElapsedSeconds||through>source.throughElapsedSeconds)return unresolved('invalid_window');
  if(!finiteVector(source.initialPosition)||!finiteVector(source.initialVelocity)||!finiteVector(source.fenceCenter)
    ||![source.radialDisplacement.x,source.radialDisplacement.z,source.maximumSlidingAccelerationMps2,source.ballRadiusMeters].every(Number.isFinite)
    ||source.maximumSlidingAccelerationMps2<0||source.ballRadiusMeters<=0)return unresolved('invalid_source_bound');
  if(!request.poles.length||request.poles.some(p=>![p.center.x,p.center.z,p.radiusM].every(Number.isFinite)||p.radiusM<=0))
    return unresolved('invalid_pole_scope');

  // Existing Core numerical model, expanded for rotation about an off-center
  // circle. Coulomb slip has |a_i|<=mu*g; rolling does not increase |v_i|.
  // D therefore bounds the ground-displacement scale used to form arc angle.
  const total=nextUp(through-source.initialElapsedSeconds),linear=addUp(Math.abs(source.initialVelocity.x),Math.abs(source.initialVelocity.z)),
    displacement=addUp(mulUp(linear,total),mulUp(nextUp(source.maximumSlidingAccelerationMps2),mulUp(total,total)));
  let scale=1;
  for(const value of [...Object.values(source.fenceCenter),...Object.values(source.initialPosition),
    source.radialDisplacement.x,source.radialDisplacement.z])scale=addUp(scale,Math.abs(value));
  scale=addUp(scale,displacement);
  const arithmetic=mulUp(256*Number.EPSILON,scale);
  if(![total,linear,displacement,scale,arithmetic].every(Number.isFinite))return unresolved('nonfinite_arithmetic');
  positionArithmeticBoundMeters=arithmetic;

  const bounds:Bounds[]=[];let cursor=from,cellsChecked=0,minimumGapLowerMeters=Infinity;
  for(const cell of source.cells){
    if(cell.throughElapsedSeconds<cursor||cell.fromElapsedSeconds>through)continue;
    if(![cell.fromElapsedSeconds,cell.throughElapsedSeconds,cell.maximumPositionSpeedMps,cell.positionRoundingBoundMeters].every(Number.isFinite)
      ||cell.throughElapsedSeconds<cell.fromElapsedSeconds||cell.maximumPositionSpeedMps<0||cell.positionRoundingBoundMeters<0)return unresolved('invalid_source_bound');
    const lo=Math.max(cursor,cell.fromElapsedSeconds),hi=Math.min(through,cell.throughElapsedSeconds),interval={fromElapsedSeconds:lo,throughElapsedSeconds:hi};
    if(lo>cursor)return unresolved('source_window_not_covered');
    if(hi<lo||hi===lo&&through>from)continue;
    const position=source.positionAt(lo);
    if(!finiteVector(position))return unresolved('invalid_source_bound',interval);
    const duration=nextUp(hi-lo),travel=mulUp(nextUp(cell.maximumPositionSpeedMps),duration),
      // Both the anchor sample and a later sample may carry position error.
      rounding=addUp(cell.positionRoundingBoundMeters,mulUp(2,arithmetic));
    if(![duration,travel,rounding].every(Number.isFinite))return unresolved('nonfinite_arithmetic',interval);
    for(const pole of request.poles){
      const dx=Math.abs(position.x-pole.center.x),dz=Math.abs(position.z-pole.center.z),radius=addUp(pole.radiusM,source.ballRadiusMeters);
      if(![dx,dz,radius].every(Number.isFinite))return unresolved('nonfinite_arithmetic',interval,pole.surfaceId);
      // L-infinity separation is a lower bound on horizontal Euclidean
      // separation. A finite vertical pole is inside this infinite cylinder.
      const distance=Math.max(nextDown(dx),nextDown(dz)),gap=nextDown(nextDown(distance-radius)-addUp(travel,rounding));
      if(!Number.isFinite(gap))return unresolved('nonfinite_arithmetic',interval,pole.surfaceId);
      if(!(gap>0))return unresolved('separation_not_proved',interval,pole.surfaceId,gap);
      minimumGapLowerMeters=Math.min(minimumGapLowerMeters,gap);
      bounds.push({surfaceId:pole.surfaceId,...interval,maximumPositionSpeedMps:cell.maximumPositionSpeedMps,
        travelUpperMeters:travel,positionRoundingUpperMeters:rounding,gapLowerMeters:gap});
    }
    cellsChecked++;cursor=hi;if(cursor===through)break;
  }
  if(!cellsChecked||cursor!==through)return unresolved('source_window_not_covered');
  return freeze({kind:'clear',numericModel:'CORE_256EPS_GEOMETRY_AWARE_WINDOW_V170',nativeAdmission:false,positionArithmeticBoundMeters,
    fromElapsedSeconds:from,throughElapsedSeconds:through,minimumGapLowerMeters,cellsChecked,poleCount:request.poles.length,bounds});
}
