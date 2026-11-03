/** Versioned hash encoding only; the full values remain the authority input.
 * IEEE-754 bits preserve -0, arrays retain order, object keys sort by UTF-16. */
export function encodeLiveSpinPracticeProofV239(input:unknown):string {
 const ancestors=new Set<object>(),buffer=new ArrayBuffer(8),view=new DataView(buffer);
 const visit=(value:unknown):unknown=>{
  if(value===null)return ['null'];if(value===undefined)return ['undefined'];
  if(typeof value==='string'||typeof value==='boolean')return [typeof value,value];
  if(typeof value==='number'){view.setFloat64(0,value,false);
   return ['number',Array.from(new Uint8Array(buffer),b=>b.toString(16).padStart(2,'0')).join('')];}
  if(typeof value!=='object')throw Error('spin practice proof v239: non-inert value');
  if(ancestors.has(value))throw Error('spin practice proof v239: cycle');
  if(!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)throw Error('spin practice proof v239: non-inert prototype');
  ancestors.add(value);try{
   const keys=Reflect.ownKeys(value),descriptors=Object.getOwnPropertyDescriptors(value);
   if(keys.some(k=>typeof k!=='string'))throw Error('spin practice proof v239: symbol key');
   if(Array.isArray(value)){
    if(keys.length!==value.length+1||!keys.includes('length'))throw Error('spin practice proof v239: sparse array');
    const out=[];for(let i=0;i<value.length;i++){const d=descriptors[String(i)];if(!d||!d.enumerable||!('value' in d))throw Error('spin practice proof v239: array descriptor');out.push(visit(d.value))}return ['array',out];
   }
   return ['object',(keys as string[]).sort().map(k=>{const d=descriptors[k];if(!d.enumerable||!('value' in d))throw Error('spin practice proof v239: object descriptor');return [k,visit(d.value)]})];
  }finally{ancestors.delete(value)}
 };
 return JSON.stringify(['live-spin-proof-ieee754-v239',visit(input)]);
}
export async function hashLiveSpinPracticeProofV239(input:unknown):Promise<string> {
 if(!globalThis.crypto?.subtle)throw Error('spin practice proof v239: WebCrypto unavailable');
 const bytes=new TextEncoder().encode(encodeLiveSpinPracticeProofV239(input)),digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
