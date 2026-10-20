/* Authoring shell and same-origin renderer frames share one display policy.
 * This bridge only configures Presentation; it issues no playback/Core command. */
(function(root){
 'use strict';
 const controls=root.KneekuraPresentationControlsV84;
 if(!controls)throw Error('V84 maker bridge requires presentation controls');
 function sync(frame){
  const child=frame.contentWindow,policy=child?.KneekuraPresentationControlsV84;
  if(!policy||policy===controls)return;
  const {frequencyScale,qualityScale}=controls.inspect();policy.configure({frequencyScale,qualityScale});
 }
 root.addEventListener('kneekura:presentation-controls-v84',()=>{for(const frame of root.document.querySelectorAll('iframe'))sync(frame);});
 root.document.addEventListener('load',event=>{if(event.target?.tagName==='IFRAME')sync(event.target);},true);
})(globalThis);
