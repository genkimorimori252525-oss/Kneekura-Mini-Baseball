/** Narrow floating-point domain for the experimental linear Source.
 * This bounds represented endpoint differences, not every error in Core gap/search. */
const MIN_NORMAL=2**-1022;
const bytes=new DataView(new ArrayBuffer(8));
function nextUp(x:number):number {
 if(!Number.isFinite(x)||x<0)throw Error('Robin bound HOLD: invalid value');
 if(x===0)return Number.MIN_VALUE;
 bytes.setFloat64(0,x,false);bytes.setBigUint64(0,bytes.getBigUint64(0,false)+1n,false);
 const result=bytes.getFloat64(0,false);if(!Number.isFinite(result))throw Error('Robin bound HOLD: overflow');return result;
}
const normalOrZero=(x:number)=>Number.isFinite(x)&&(x===0||Math.abs(x)>=MIN_NORMAL);
const addUp=(a:number,b:number)=>{const x=a+b;if(!normalOrZero(x))throw Error('Robin bound HOLD: subnormal or overflow');return x===0?0:nextUp(x);};
const divUp=(a:number,b:number)=>{const x=a/b;if(!normalOrZero(x))throw Error('Robin bound HOLD: subnormal or overflow');return x===0?0:nextUp(x);};
export function robinGlobalSpeedBoundV1(points:readonly Readonly<{x:number;y:number;z:number}>[],dt:number){
 if(points.length<2||points.length>100000||!normalOrZero(dt)||dt<1e-6||dt>1||dt*(points.length-1)>100||!points.every(p=>[p.x,p.y,p.z].every(v=>normalOrZero(v)&&Math.abs(v)<=1000)))throw Error('Robin bound HOLD: unsupported domain');
 let max=0;
 for(let i=1;i<points.length;i++){
  let sum=0;
  for(const key of ['x','y','z'] as const){const delta=points[i][key]-points[i-1][key];if(!normalOrZero(delta))throw Error('Robin bound HOLD: subnormal or overflow');sum=addUp(sum,delta===0?0:nextUp(Math.abs(delta)));}
  const speed=divUp(sum,dt);if(speed>1e7)throw Error('Robin bound HOLD: speed');max=Math.max(max,speed);
 }
 return max;
}
