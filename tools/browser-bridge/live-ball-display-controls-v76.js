/* Presentation diameter only. No physical ball state or clock is mutated. */
(function(root){
 'use strict';
 const defaults=Object.freeze({perspective:1,overhead:1,overheadHeightEmphasis:2});
 let current=defaults;
 function readPatch(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('ball display: settings object required');
  // Cross-window plain objects are valid; never invoke property getters.
  const prototype=Object.getPrototypeOf(input);
  if(prototype!==null&&Object.getPrototypeOf(prototype)!==null)throw new Error('ball display: plain settings object required');
  const patch={};
  for(const key of Reflect.ownKeys(input)){
   if(typeof key!=='string'||!Object.hasOwn(defaults,key))throw new Error('ball display: unknown setting '+String(key));
   const descriptor=Object.getOwnPropertyDescriptor(input,key);
   if(!descriptor||!Object.hasOwn(descriptor,'value')||!descriptor.enumerable)throw new Error('ball display: enumerable data setting required '+key);
   const value=descriptor.value,minimum=key==='overheadHeightEmphasis'?1:.25;
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
 const smooth=value=>{const u=Math.max(0,Math.min(1,value));return u*u*u*(10+u*(-15+6*u));};
 // A display-only clearance band protects rolling balls and shallow hops.
 // Beyond the transition, factors >=2 preserve the v67 high-air size exactly.
 const heightModel=Object.freeze({basis:'GROUND_REFERENCED_LITERAL_AIR_DIAMETER_FACTOR',groundCenterMeters:.0366,
  groundProtectedClearanceMeters:.5,airFullClearanceMeters:1.5,legacyAtOne:true,sourcePhysicsChanged:false});
 function heightSizingFor(camera,projectedDiameterPx,groundProjectedDiameterPx,groundDisplayDiameterPx,legacyDisplayDiameterPx,heightMeters){
  const factor=current.overheadHeightEmphasis;
  if(camera!=='overhead'||factor===1)return {diameterPx:legacyDisplayDiameterPx,physicalHeightRatio:1};
  if(!Number.isFinite(heightMeters))throw new Error('ball display: finite observed height required');
  const clearance=heightMeters-heightModel.groundCenterMeters;
  if(clearance<=heightModel.groundProtectedClearanceMeters)return {diameterPx:legacyDisplayDiameterPx,physicalHeightRatio:1};
  for(const value of [projectedDiameterPx,groundProjectedDiameterPx,groundDisplayDiameterPx,legacyDisplayDiameterPx]){
   if(!Number.isFinite(value)||value<=0)throw new Error('ball display: finite positive projected diameter required');
  }
  const physicalHeightRatio=Math.max(1,projectedDiameterPx/groundProjectedDiameterPx),
   groundReferencedDiameter=groundDisplayDiameterPx*physicalHeightRatio;
  if(clearance>=heightModel.airFullClearanceMeters&&factor>=2)
   return {diameterPx:groundReferencedDiameter*factor,physicalHeightRatio};
  const heightWeight=smooth((clearance-heightModel.groundProtectedClearanceMeters)/
    (heightModel.airFullClearanceMeters-heightModel.groundProtectedClearanceMeters)),
   // The visibility floor can make legacy and ground-referenced diameters
   // differ. Blend their references near factor=1 to avoid a size jump.
   referenceWeight=smooth(factor-1),
   referenceDiameter=legacyDisplayDiameterPx+referenceWeight*(groundReferencedDiameter-legacyDisplayDiameterPx),
   diameterPx=legacyDisplayDiameterPx+heightWeight*(factor*referenceDiameter-legacyDisplayDiameterPx);
  return {diameterPx,physicalHeightRatio};
 }
 root.KneekuraBallDisplayControls=Object.freeze({version:4,defaults,normalizeSettings,normalizeImportedSettings,configure,
  inspect:()=>current,scaleFor:camera=>camera==='overhead'?current.overhead:current.perspective,heightSizingFor,heightModel});
})(typeof globalThis==='object'?globalThis:this);
