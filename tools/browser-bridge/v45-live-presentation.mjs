import {transformLiveV44} from './v44-live-presentation.mjs';
function once(source,before,after){
 if(source.split(before).length!==2)throw Error('v45 continuous batter guard: '+before.slice(0,80));
 return source.replace(before,after);
}
export function transformLiveV45(source,runtime){
 runtime=once(runtime,'let pitchMarksOpacity=1,catcherFollow=null,resultDisplay=null;',
  'let continuousBatterView=null;\n let pitchMarksOpacity=1,catcherFollow=null,resultDisplay=null;');
 runtime=once(runtime,'catcherFollow=observeCatcher(result,currentFrame);',
  'continuousBatterView=window.KneekuraContinuousBatterView.observe({record:result,frame:currentFrame,sceneMs,preparationMs:timing.preparationMs,\n'+
  '   batter:{...batter,physical:players.find(player=>player.playerId===batterId)?.physical},previousRecord:selected>0?records[selected-1]:null});\n'+
  '  catcherFollow=observeCatcher(result,currentFrame);');
 runtime=once(runtime,"if(frame.phase==='bench')return 'overhead';",
  "if(frame.phase==='bench')return 'overhead';\n  if(options.camera==='batter'&&continuousBatterView)return 'batter';");
 runtime=once(runtime,'livePitchMarksOpacity:pitchMarksOpacity,',
  'liveContinuousBatterView:continuousBatterView,livePitchMarksOpacity:pitchMarksOpacity,');
 runtime=once(runtime,'presentation:{stage:sceneStage(),','presentation:{continuousBatterView,stage:sceneStage(),');
 let html=transformLiveV44(source,runtime);
 html=once(html,'presentationVersion:44','presentationVersion:45');
 html=once(html,"  if(state.camera==='batter'||state.camera==='runner'){",
  "  if(observed.liveObservation&&state.camera==='batter'&&observed.liveContinuousBatterView){\n"+
  '   const v=observed.liveContinuousBatterView;return {eye:{...v.eye},yaw:v.yaw,pitch:v.pitch,f:v.f,cx:v.cx,cy:v.cy,labelMetres:v.labelMetres};\n'+
  "  }\n  if(state.camera==='batter'||state.camera==='runner'){");
 html=once(html,"if(observed.liveObservation&&state.camera==='batter'&&observed.liveBatterCameraTarget&&actor.id==='BAT')",
  "if(observed.liveObservation&&state.camera==='batter'&&observed.liveContinuousBatterView&&actor.id==='BAT')");
 return once(html,"state.camera==='batter'&&observed.liveBatterCameraTarget)?observed.actors.filter",
  "state.camera==='batter'&&observed.liveContinuousBatterView)?observed.actors.filter");
}
