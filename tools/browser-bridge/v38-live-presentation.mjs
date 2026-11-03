import {transformLiveV37} from './v37-live-presentation.mjs';

export function transformLiveV38(source,runtime){
 let html=transformLiveV37(source,runtime);
 const replace=(before,after)=>{
  if(html.split(before).length!==2)throw new Error('v38 guard: '+before.slice(0,100));
  html=html.replace(before,after);
 };
 replace('presentationVersion:37','presentationVersion:38');
 replace('alpha:observed.localTick>=26&&observed.localTick<38?.28:e===selected?1:.85',
  'alpha:observed.liveObservation?(observed.livePitchMarksOpacity??1)*(e===selected?1:.85):observed.localTick>=26&&observed.localTick<38?.28:e===selected?1:.85');
 replace('shape:s,pitchId:entry.pitchId,number:entry.number};',
  'shape:s,pitchId:entry.pitchId,number:entry.number,alpha:options.alpha??1};');
 replace(`if(catcher)return {eye:{x:catcher.position.x,y:catcher.position.y+1.03,z:catcher.position.z+.5},
    yaw:0,pitch:.018,f:440,cx:300,cy:104,labelMetres:.58};`,
  `if(catcher){
   const eye={x:catcher.position.x,y:catcher.position.y+1.03,z:catcher.position.z+.5},target=observed.liveCatcherCameraTarget;
   return {eye,yaw:target?Math.atan2(target.x-eye.x,target.z-eye.z):0,
    pitch:target?-Math.atan2(target.y-eye.y,Math.hypot(target.x-eye.x,target.z-eye.z)):.018,
    f:440,cx:300,cy:104,labelMetres:.58};
  }`);
 return html;
}
