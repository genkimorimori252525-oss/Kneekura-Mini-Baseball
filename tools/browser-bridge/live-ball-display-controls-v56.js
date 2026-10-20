/* Presentation diameter only. This module receives no ball, Source or clock. */
(function(root){
 'use strict';
 const defaults=Object.freeze({perspective:1,overhead:1});
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
   if(typeof value!=='number'||!Number.isFinite(value)||value<.25||value>8)throw new Error('ball display: setting outside 0.25..8: '+key);
   patch[key]=value;
  }
  return patch;
 }
 function normalizeSettings(input={}){return Object.freeze({...defaults,...readPatch(input)});}
 function configure(input={}){
  const patch=readPatch(input),next=Object.freeze({...current,...patch});
  current=next;return current;
 }
 root.KneekuraBallDisplayControls=Object.freeze({version:1,defaults,normalizeSettings,configure,
  inspect:()=>current,scaleFor:camera=>camera==='overhead'?current.overhead:current.perspective});
})(typeof globalThis==='object'?globalThis:this);
