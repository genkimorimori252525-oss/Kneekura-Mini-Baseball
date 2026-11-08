import {transformLiveV49} from './v49-live-presentation.mjs';
function once(source,before,after){
 if(source.split(before).length!==2)throw Error('v52 view guard: '+before.slice(0,90));
 return source.replace(before,after);
}
export function transformLiveV52(source,runtime){
 runtime=once(runtime,'let sceneMs=0,skipAtMs=null,', 'let pitcherReactionView=null;\n let sceneMs=0,skipAtMs=null,');
 runtime=once(runtime,'defaultObserverPlayerId:currentFrame.fieldObserverPlayerId}):null;',
  'defaultObserverPlayerId:currentFrame.fieldObserverPlayerId}):null;\n'+
  '  pitcherReactionView=window.KneekuraLivePitcherReactionView.observe({record:result,frame:currentFrame,sceneMs,\n'+
  "   preparationMs:timing.preparationMs,pitcherActor:actors.find(actor=>actor.id==='P')});");
 runtime=once(runtime,"if(frame.phase==='bench')return 'overhead';",
  "if(frame.phase==='bench')return 'overhead';\n  if(options.camera==='mound'&&pitcherReactionView?.view)return 'mound';");
 runtime=once(runtime,"if(options.camera==='mound'&&live&&observer){",
  "if(options.camera==='mound'&&live&&observer){\n   if(pitcherReactionView&&!pitcherReactionView.handoffAllowed)return 'mound';");
 runtime=once(runtime,'livePitchMarksOpacity:pitchMarksOpacity,',
  'livePitcherReactionView:pitcherReactionView,livePitchMarksOpacity:pitchMarksOpacity,');
 runtime=once(runtime,'presentation:{stage:sceneStage(),','presentation:{stage:sceneStage(),pitcherReactionView,');
 let html=transformLiveV49(source,runtime);
 html=once(html,'presentationVersion:49','presentationVersion:52');
 const endOfMound=/}return base;(\r?\n  }\r?\n  if\(observed\.liveObservation&&state\.camera==='batter')/g;
 if([...html.matchAll(endOfMound)].length!==1)throw Error('v52 mound return guard');
 return html.replace(endOfMound,(_,suffix)=>'}return window.KneekuraLivePitcherReactionView.mixTrackingView({reaction:observed.livePitcherReactionView,tracked:base});'+suffix);
}
