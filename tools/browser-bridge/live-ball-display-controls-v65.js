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
 // Height contrast is measured from the current camera's optical projection.
 // 1 retains legacy pixels (including its visibility floor); values >1 expose
 // the physical height contrast against the same-xz ground-ball marker.
 const heightModel=Object.freeze({basis:'GROUND_REFERENCED_CAMERA_PROJECTION',groundCenterMeters:.0366,legacyAtOne:true,sourcePhysicsChanged:false});
 function heightSizingFor(camera,projectedDiameterPx,groundProjectedDiameterPx,groundDisplayDiameterPx,legacyDisplayDiameterPx){
  if(camera!=='overhead'||current.overheadHeightEmphasis===1)return {diameterPx:legacyDisplayDiameterPx,physicalHeightRatio:1};
  for(const value of [projectedDiameterPx,groundProjectedDiameterPx,groundDisplayDiameterPx,legacyDisplayDiameterPx]){
   if(!Number.isFinite(value)||value<=0)throw new Error('ball display: finite positive projected diameter required');
  }
  const physicalHeightRatio=Math.max(1,projectedDiameterPx/groundProjectedDiameterPx);
  return {diameterPx:physicalHeightRatio===1?groundDisplayDiameterPx:groundDisplayDiameterPx*(1+current.overheadHeightEmphasis*(physicalHeightRatio-1)),physicalHeightRatio};
 }
 root.KneekuraBallDisplayControls=Object.freeze({version:2,defaults,normalizeSettings,configure,
  inspect:()=>current,scaleFor:camera=>camera==='overhead'?current.overhead:current.perspective,heightSizingFor,heightModel});
})(typeof globalThis==='object'?globalThis:this);
