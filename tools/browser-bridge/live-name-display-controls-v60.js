/* Name scale is Presentation only. No Source, actor position or clock is received. */
(function(root){
 'use strict';
 const defaults=Object.freeze({scale:1});
 let current=defaults;
 function readPatch(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('name display: settings object required');
  const prototype=Object.getPrototypeOf(input);
  if(prototype!==null&&Object.getPrototypeOf(prototype)!==null)throw new Error('name display: plain settings object required');
  const patch={};
  for(const key of Reflect.ownKeys(input)){
   if(typeof key!=='string'||!Object.hasOwn(defaults,key))throw new Error('name display: unknown setting '+String(key));
   const descriptor=Object.getOwnPropertyDescriptor(input,key);
   if(!descriptor||!Object.hasOwn(descriptor,'value')||!descriptor.enumerable)throw new Error('name display: enumerable data setting required '+key);
   const value=descriptor.value;
   if(typeof value!=='number'||!Number.isFinite(value)||value<.5||value>2.5)throw new Error('name display: setting outside 0.5..2.5: '+key);
   patch[key]=value;
  }
  return patch;
 }
 function normalizeSettings(input={}){return Object.freeze({...defaults,...readPatch(input)});}
 function configure(input={}){
  const next=Object.freeze({...current,...readPatch(input)});
  if(next.scale===current.scale)return current;
  current=next;
  if(typeof root.dispatchEvent==='function'&&typeof root.CustomEvent==='function')
   root.dispatchEvent(new root.CustomEvent('kneekura:name-display-change',{detail:current}));
  return current;
 }
 function paintToCanvas(context,width,height){
  if(!context||typeof context.fillText!=='function'||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)
   throw new Error('name display: positive canvas dimensions and 2D context required');
  const host=root.document?.getElementById('actor-labels'),rects=[];
  if(!host)return {count:0,rects};
  const hostBox=host.getBoundingClientRect();
  if(!hostBox.width||!hostBox.height)return {count:0,rects};
  context.save();context.setTransform(width/hostBox.width,0,0,height/hostBox.height,0,0);context.globalAlpha=1;
  // The workbench copies the current DOM labels between its field/bat image and
  // its ball image. Reading rectangles must never seek or redraw the match.
  try{for(const element of host.children){
   const style=root.getComputedStyle(element);
   if(style.display==='none'||style.visibility==='hidden')continue;
   const box=element.getBoundingClientRect(),x=box.left-hostBox.left,y=box.top-hostBox.top;
   if(!box.width||!box.height)continue;
   context.fillStyle=style.backgroundColor;context.fillRect(x,y,box.width,box.height);
   const fontSize=parseFloat(style.fontSize)||0,paddingLeft=parseFloat(style.paddingLeft)||0,paddingTop=parseFloat(style.paddingTop)||0;
   const lineHeight=parseFloat(style.lineHeight)||fontSize*1.15,textY=y+paddingTop+(lineHeight-fontSize)/2;
   context.font=style.font||[style.fontStyle,style.fontWeight,style.fontSize,style.fontFamily].join(' ');
   context.textAlign='left';context.textBaseline='top';
   if(element.dataset.role==='runner'){context.fillStyle='#000';context.fillText(element.textContent,x+paddingLeft,textY+1);}
   context.fillStyle=style.color;context.fillText(element.textContent,x+paddingLeft,textY);
   rects.push({actor:element.dataset.actor,role:element.dataset.role,name:element.textContent,x:x*width/hostBox.width,y:y*height/hostBox.height,
    w:box.width*width/hostBox.width,h:box.height*height/hostBox.height});
  }}finally{context.restore();}
  return {count:rects.length,rects};
 }
 root.KneekuraNameDisplayControls=Object.freeze({version:1,defaults,normalizeSettings,configure,inspect:()=>current,paintToCanvas});
})(typeof globalThis==='object'?globalThis:this);
