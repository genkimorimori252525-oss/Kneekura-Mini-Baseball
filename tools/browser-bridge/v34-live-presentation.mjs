import {transformLiveV33} from './v33-live-presentation.mjs';

/** Keep the v33 physical observation seam and restore v31 camera/UI framing. */
export function transformLiveV34(source,runtime){
 let html=transformLiveV33(source,runtime);
 const replace=(before,after)=>{
  if(!html.includes(before)||html.indexOf(before)!==html.lastIndexOf(before))throw new Error('v34 guard: '+before.slice(0,100));
  html=html.replace(before,after);
 };
 replace('presentationVersion:33','presentationVersion:34');
 replace("zone:!!options.zone&&observed.ballKind==='pitch',history:false",
  'zone:!!options.zone&&!observed.liveBattedObservation&&!observed.fairKnown&&!observed.benchReturn,history:!!options.history');
 // The v33 foot anchor put the plate only .2m in front of the eye while
 // retaining the v31 focal length: the entire batter zone projected offscreen.
 // Restore the approved close camera, leaving Source ball/bat/actors untouched.
 replace(`if(observed.liveObservation&&state.camera==='batter'){
    const hitter=observed.actors.find(actor=>actor.id==='BAT');
    const pitcher=observed.actors.find(actor=>actor.id==='P');
    if(hitter)base.eye={x:hitter.position.x,y:hitter.position.y+hitter.player.height*.77,z:hitter.position.z};
    if(pitcher){base.yaw=Math.atan2(pitcher.position.x-base.eye.x,pitcher.position.z-base.eye.z);}
   }
   `,'');
 return html;
}
