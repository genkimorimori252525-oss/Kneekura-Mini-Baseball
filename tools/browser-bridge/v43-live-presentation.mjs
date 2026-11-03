import {transformLiveV41} from './v41-live-presentation.mjs';

function replaceOnce(source,before,after){
 if(source.split(before).length!==2)throw new Error('v43 batter gaze guard: '+before.slice(0,90));
 return source.replace(before,after);
}
export function transformLiveV43(source,runtime){
 runtime=replaceOnce(runtime,'let pitchMarksOpacity=1,catcherFollow=null,resultDisplay=null;',
  'let pitchMarksOpacity=1,catcherFollow=null,resultDisplay=null,batterGaze=null;');
 runtime=replaceOnce(runtime,"if(frame.phase==='bench')return 'overhead';",
  "if(frame.phase==='bench')return 'overhead';\n  if(options.camera==='batter'&&batterGaze)return 'batter';");
 runtime=replaceOnce(runtime,'catcherFollow=observeCatcher(result,currentFrame);',
  'catcherFollow=observeCatcher(result,currentFrame);\n  batterGaze=window.KneekuraLiveBatterGaze.observe({record:result,frame:currentFrame,sceneMs,preparationMs:timing.preparationMs});');
 runtime=replaceOnce(runtime,'liveCatcherCameraTarget:catcherFollow?.target??null,',
  'liveCatcherCameraTarget:catcherFollow?.target??null,\n   liveBatterCameraTarget:batterGaze?.target??null,');
 runtime=replaceOnce(runtime,'pitchMarksOpacity,catcherFollow,resultDisplay,foulStop:',
  'pitchMarksOpacity,catcherFollow,resultDisplay,batterGaze,foulStop:');
 let html=transformLiveV41(source,runtime);
 html=replaceOnce(html,'presentationVersion:41','presentationVersion:43');
 // Core may already call BAT a runner during the follow-through. Preserve
 // first-person self-body hiding while the eye still belongs to the batter.
 html=replaceOnce(html,'function viewHidesActor(actor){return ',
  "function viewHidesActor(actor){if(observed.liveObservation&&state.camera==='batter'&&observed.liveBatterCameraTarget&&actor.id==='BAT')return true;return ");
 // The approved close batter eye can lie inside the catcher's billboard.
 // Reuse the existing runner near-body clipping test for this brief gaze;
 // preserve player locations, labels, custody, and the unobstructed bat layer.
 html=replaceOnce(html,"runnerNearBodyIds=new Set(state.camera==='runner'?observed.actors.filter",
  "runnerNearBodyIds=new Set((state.camera==='runner'||state.camera==='batter'&&observed.liveBatterCameraTarget)?observed.actors.filter");
 // Keep v36's eye position, optics and handedness. Only its gaze is held; after
 // release the original runner/ball-follow camera receives the same world.
 return replaceOnce(html,'   const followsBattedBall=!homeRunForward',
  "   if(observed.liveObservation&&state.camera==='batter'&&observed.liveBatterCameraTarget){\n"+
  '    const target=observed.liveBatterCameraTarget,dx=target.x-base.eye.x,dz=target.z-base.eye.z;\n'+
  '    base.yaw=Math.atan2(dx,dz);base.pitch=-Math.atan2(target.y-base.eye.y,Math.hypot(dx,dz));\n'+
  '    return base;\n   }\n   const followsBattedBall=!homeRunForward');
}
