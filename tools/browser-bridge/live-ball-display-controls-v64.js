/* Presentation diameter only. No physical ball state or clock is mutated. */
(function(root){
 'use strict';
 const defaults=Object.freeze({perspective:1,overhead:1,overheadHeightEmphasis:1});
 let current=defaults;
 function readPatch(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('ball display: settings object required');
  // Plain objects from another window have a different Object.prototype,
  // but that prototype still ends at null. Do not invoke toStringTag/getters.
  const prototype=Object.getPrototypeOf(input);
  if(prototype!==null&&Object.getPrototypeOf(prototype)!==null)throw new Error('ball display: plain settings object required');
  const patch={};
  for(const key of Reflect.ownKeys(input)){
   if(typeof key!=='string'||!Object.hasOwn(defaults,key))throw new Error('ball display: unknown setting '+String(key));
   const descriptor=Object.getOwnPropertyDescriptor(input,key);
   if(!descriptor||!Object.hasOwn(descriptor,'value')||!descriptor.enumerable)throw new Error('ball display: enumerable data setting required '+key);
   const value=descriptor.value;
   const minimum=key==='overheadHeightEmphasis'?1:.25;
   if(typeof value!=='number'||!Number.isFinite(value)||value<minimum||value>8)throw new Error('ball display: setting outside '+minimum+'..8: '+key);
   patch[key]=value;
  }
  return patch;
 }
 function normalizeSettings(input={}){return Object.freeze({...defaults,...readPatch(input)});}
 function configure(input={}){
  const patch=readPatch(input),next=Object.freeze({...current,...patch});
  current=next;return current;
 }
 // Authored visibility cue: size grows with current observed height only.
 // At the ground it is unchanged; at/above 20m it reaches the chosen factor.
 const heightModel=Object.freeze({basis:'OBSERVED_HEIGHT_DISPLAY_CUE',groundCenterMeters:.0366,fullEmphasisHeightMeters:20,sourcePhysicsChanged:false});
 function heightMultiplierFor(camera,heightMeters){
  if(camera!=='overhead'||current.overheadHeightEmphasis===1)return 1;
  if(!Number.isFinite(heightMeters))throw new Error('ball display: finite observed height required');
  const weight=Math.max(0,Math.min(1,(heightMeters-heightModel.groundCenterMeters)/(heightModel.fullEmphasisHeightMeters-heightModel.groundCenterMeters)));
  return 1+(current.overheadHeightEmphasis-1)*weight;
 }
 root.KneekuraBallDisplayControls=Object.freeze({version:1,defaults,normalizeSettings,configure,
  inspect:()=>current,scaleFor:camera=>camera==='overhead'?current.overhead:current.perspective,heightMultiplierFor,heightModel});
})(typeof globalThis==='object'?globalThis:this);
