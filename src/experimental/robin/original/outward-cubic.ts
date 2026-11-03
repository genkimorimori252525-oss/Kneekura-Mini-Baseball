export type Interval=Readonly<{lo:number;hi:number}>;
const data=new DataView(new ArrayBuffer(8));
export function nextUpV1(x:number){if(!Number.isFinite(x))throw Error('interval HOLD: nonfinite');if(x===0)return Number.MIN_VALUE;data.setFloat64(0,x,false);const b=data.getBigUint64(0,false);data.setBigUint64(0,x>0?b+1n:b-1n,false);const r=data.getFloat64(0,false);if(!Number.isFinite(r))throw Error('interval HOLD: overflow');return r;}
export const nextDownV1=(x:number)=>-nextUpV1(-x);
export const pointV1=(x:number):Interval=>{if(!Number.isFinite(x))throw Error('interval HOLD: nonfinite');return {lo:x,hi:x};};
export const addV1=(a:Interval,b:Interval):Interval=>({lo:nextDownV1(a.lo+b.lo),hi:nextUpV1(a.hi+b.hi)});
export const subV1=(a:Interval,b:Interval):Interval=>({lo:nextDownV1(a.lo-b.hi),hi:nextUpV1(a.hi-b.lo)});
export const mulV1=(a:Interval,b:Interval):Interval=>{const v=[a.lo*b.lo,a.lo*b.hi,a.hi*b.lo,a.hi*b.hi];return {lo:nextDownV1(Math.min(...v)),hi:nextUpV1(Math.max(...v))};};
export const divPositiveV1=(a:Interval,b:Interval):Interval=>{if(!(b.lo>0))throw Error('interval HOLD: denominator');const v=[a.lo/b.lo,a.lo/b.hi,a.hi/b.lo,a.hi/b.hi];return {lo:nextDownV1(Math.min(...v)),hi:nextUpV1(Math.max(...v))};};
/** Each leaf encloses the exact cubic for any controls inside input intervals. */
export function subdivideCubicIntervalsV1(controls:readonly Interval[],depth:number){
 if(controls.length!==4||!controls.every(x=>Number.isFinite(x.lo)&&Number.isFinite(x.hi)&&x.lo<=x.hi&&Math.abs(x.lo)<=100&&Math.abs(x.hi)<=100)||!Number.isInteger(depth)||depth<0||depth>8)throw Error('interval HOLD: unsupported cubic');
 const midpoint=(a:Interval,b:Interval)=>mulV1(addV1(a,b),pointV1(.5));
 const visit=(c:readonly Interval[],n:number):Interval[]=>{if(n===0)return [{lo:Math.min(...c.map(x=>x.lo)),hi:Math.max(...c.map(x=>x.hi))}];const a=midpoint(c[0],c[1]),b=midpoint(c[1],c[2]),d=midpoint(c[2],c[3]),e=midpoint(a,b),f=midpoint(b,d),m=midpoint(e,f);return [...visit([c[0],a,e,m],n-1),...visit([m,f,d,c[3]],n-1)];};
 return Object.freeze(visit(controls,depth).map(Object.freeze));
}
export const subdivideCubicHullV1=(controls:readonly number[],depth:number)=>subdivideCubicIntervalsV1(controls.map(pointV1),depth);
