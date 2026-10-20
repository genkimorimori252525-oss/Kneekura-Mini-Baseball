/* Presentation diameter only. No physical ball state or clock is mutated. */
(function(root){
 'use strict';
 const defaults=Object.freeze({perspective:1,overhead:1,overheadHeightEmphasis:2});
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
 function normalizeImportedSettings(input={}){return Object.freeze({...defaults,overheadHeightEmphasis:1,...readPatch(input)});}
 function configure(input={}){
  const patch=readPatch(input),next=Object.freeze({...current,...patch});
  current=next;return current;
 }
 // Literal diameter factor on the ground-referenced perspective size.
 // The one-ball-height transition joins the unchanged ground marker smoothly.
 const heightModel=Object.freeze({basis:'GROUND_REFERENCED_LITERAL_AIR_DIAMETER_FACTOR',groundCenterMeters:.0366,groundBlendHeightMeters:.0732,legacyAtOne:true,sourcePhysicsChanged:false});
 function heightSizingFor(camera,projectedDiameterPx,groundProjectedDiameterPx,groundDisplayDiameterPx,legacyDisplayDiameterPx,heightMeters){
  if(camera!=='overhead'||current.overheadHeightEmphasis===1)return {diameterPx:legacyDisplayDiameterPx,physicalHeightRatio:1};
  if(!Number.isFinite(heightMeters))throw new Error('ball display: finite observed height required');
  if(heightMeters<=heightModel.groundCenterMeters)return {diameterPx:legacyDisplayDiameterPx,physicalHeightRatio:1};
  for(const value of [projectedDiameterPx,groundProjectedDiameterPx,groundDisplayDiameterPx,legacyDisplayDiameterPx]){
   if(!Number.isFinite(value)||value<=0)throw new Error('ball display: finite positive projected diameter required');
  }
  const physicalHeightRatio=Math.max(1,projectedDiameterPx/groundProjectedDiameterPx),
   u=Math.max(0,Math.min(1,(heightMeters-heightModel.groundCenterMeters)/heightModel.groundBlendHeightMeters)),
   weight=u*u*u*(10+u*(-15+6*u)),airFactor=1+(current.overheadHeightEmphasis-1)*weight;
  return {diameterPx:groundDisplayDiameterPx*physicalHeightRatio*airFactor,physicalHeightRatio};
 }
 root.KneekuraBallDisplayControls=Object.freeze({version:3,defaults,normalizeSettings,normalizeImportedSettings,configure,
  inspect:()=>current,scaleFor:camera=>camera==='overhead'?current.overhead:current.perspective,heightSizingFor,heightModel});
})(typeof globalThis==='object'?globalThis:this);
