import {transformLiveV35} from './v35-live-presentation.mjs';

export function transformLiveV36(source,runtime){
 let html=transformLiveV35(source,runtime);
 const replace=(before,after)=>{
  if(html.split(before).length!==2)throw new Error('v36 guard: '+before.slice(0,100));
  html=html.replace(before,after);
 };
 replace('presentationVersion:35','presentationVersion:36');
 // Restore the approved v34 close camera. Correct the measured field
 // registration in Core rather than changing the user's camera framing.
 replace('eye:{x:.4*s,y:Math.max(1.15,observed.batter.height*.77),z:-.95},yaw:Math.atan2(-.4*s,19.4)',
  'eye:{x:-.4*s,y:Math.max(1.15,observed.batter.height*.77),z:-.95},yaw:Math.atan2(.4*s,19.4)');
 replace('const target=observed.ball?.position??{x:0,y:1,z:0};',
  'const target=observed.liveFieldCameraTarget??observed.ball?.position??{x:0,y:1,z:0};');
 replace('if((observed.fair||observed.liveBattedObservation)&&observed.ball){const target=observed.ball.position;',
  'if((observed.fair||observed.liveBattedObservation)&&(observed.liveFieldCameraTarget||observed.ball)){const target=observed.liveFieldCameraTarget??observed.ball.position;');
 return html;
}
