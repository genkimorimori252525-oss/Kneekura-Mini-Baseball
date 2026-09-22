import type { Vec2, Vec3 } from '../../../model/geometry';
import { fail, obj, integer } from '../EmotionValidation';
export function finite(v:unknown,p:string,min=-Infinity):number {
 if(typeof v!=='number' || !Number.isFinite(v) || v<min)fail('INVALID_INPUT',p);
 return v===0?0:v;
}
export function positive(v:unknown,p:string):number {
 const n=finite(v,p);if(n<=0)fail('INVALID_INPUT',p);return n;
}
export function positiveTick(v:unknown,p:string):number {
 const n=integer(v,p);if(n===0)fail('INVALID_INPUT',p);return n;
}
export function vec2(v:unknown,p:string):Vec2 {
 const o=obj(v,['x','z'],p);return {x:finite(o.x,p+'.x'),z:finite(o.z,p+'.z')};
}
export function vec3(v:unknown,p:string):Vec3 {
 const o=obj(v,['x','y','z'],p);return {x:finite(o.x,p+'.x'),y:finite(o.y,p+'.y'),z:finite(o.z,p+'.z')};
}
export function nullableVec2(v:unknown,p:string):Vec2|null {return v===null?null:vec2(v,p);}
export function member<T extends string|number>(v:unknown,allowed:readonly T[],p:string):T {
 if(!allowed.includes(v as T))fail('INVALID_INPUT',p);return v as T;
}
/** Core owns physical validation, but this public boundary returns its rejection as structured data. */
export function callCore<T>(p:string,run:()=>T):T {
 try{return run();}catch(e){if(e instanceof Error)fail('INVALID_INPUT',p+':'+e.message);throw e;}
}
