import {transformLiveV43} from './v43-live-presentation.mjs';
function once(source,before,after){
 if(source.split(before).length!==2)throw Error('v44 taken gaze guard: '+before.slice(0,80));
 return source.replace(before,after);
}
export function transformLiveV44(source,runtime){
 runtime=once(runtime,'let pitchMarksOpacity=1,catcherFollow=null,resultDisplay=null;',
  'let takenPitchGaze=null;\n let pitchMarksOpacity=1,catcherFollow=null,resultDisplay=null;');
 runtime=once(runtime,'catcherFollow=observeCatcher(result,currentFrame);',
  'takenPitchGaze=window.KneekuraLiveTakenPitchGaze.observe({record:result,frame:currentFrame,sceneMs,preparationMs:timing.preparationMs});\n  catcherFollow=observeCatcher(result,currentFrame);');
 runtime=once(runtime,'livePitchMarksOpacity:pitchMarksOpacity,','liveTakenPitchGaze:takenPitchGaze,livePitchMarksOpacity:pitchMarksOpacity,');
 runtime=once(runtime,'pitchMarksOpacity,catcherFollow,resultDisplay,foulStop:',
  'takenPitchGaze,pitchMarksOpacity,catcherFollow,resultDisplay,foulStop:');
 let html=transformLiveV43(source,runtime);
 html=once(html,'presentationVersion:43','presentationVersion:44');
 // Only batter POV uses the new clock. Keep old paths for the other cameras.
 html=once(html,'   const followsBattedBall=!homeRunForward',
  "   if(observed.liveObservation&&state.camera==='batter'&&observed.liveTakenPitchGaze){\n"+
  '    const glance=observed.liveTakenPitchGaze,target=glance.target,dx=target.x-base.eye.x,dz=target.z-base.eye.z;\n'+
  '    const yaw=Math.atan2(dx,dz),pitch=-Math.atan2(target.y-base.eye.y,Math.max(.05,Math.hypot(dx,dz)));\n'+
  '    const delta=Math.atan2(Math.sin(yaw-base.yaw),Math.cos(yaw-base.yaw));\n'+
  '    base.yaw+=clamp(delta,-.40,.40)*glance.smooth;base.pitch+=clamp(pitch-base.pitch,-.18,.18)*glance.smooth;\n'+
  '    base.f*=1-.06*glance.smooth;base.labelMetres*=1-.03*glance.smooth;base.cy=172;return base;\n'+
  '   }\n   const followsBattedBall=!homeRunForward');
 // Do not run the legacy fixed-localTick glance before the actual trigger.
 return once(html,'const followsTakenPitch=!observed.p.swing && observed.localTick>=38 && observed.p.catchLocal!==null;',
  "const followsTakenPitch=!(observed.liveObservation&&state.camera==='batter')&&!observed.p.swing && observed.localTick>=38 && observed.p.catchLocal!==null;");
}
