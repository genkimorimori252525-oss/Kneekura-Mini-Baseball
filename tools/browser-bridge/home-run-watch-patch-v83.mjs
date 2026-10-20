/** Fail-closed patches over the frozen v81 normal renderer. */
const once=(source,marker,replacement)=>{if(source.split(marker).length!==2)throw Error('HR watch marker differs: '+marker.slice(0,100));return source.replace(marker,()=>replacement);};
export function applyHomeRunWatchV83(source,helper){
 let html=once(source,'<script id="v33-offline-core-match">','<script id="v83-home-run-watch">\n'+helper+'\n</script>\n<script id="v33-offline-core-match">');
 html=once(html,' function activeResult(){return records[selected]??null;}',` const homeRunWatchControllerV83=window.KneekuraHomeRunWatchV83.create();
 let homeRunWatchV83=null;
 function activeResult(){return records[selected]??null;}`);
 html=once(html,'  return {first,physicalMs,officialMs,thirdOut,durationMs:timing.preparationMs+duration};',`  duration=Math.max(duration,homeRunWatchControllerV83.minDurationMs({record:result,preparationMs:timing.preparationMs,selectedCamera:options.camera})-timing.preparationMs);
  return {first,physicalMs,officialMs,thirdOut,durationMs:timing.preparationMs+duration};`);
 const start=html.indexOf(' function cameraFor(frame,actors){'),end=html.indexOf(' function updateScore(',start);
 if(start<0||end<0)throw Error('HR camera scope unavailable');
 const original=html.slice(start,end),base=original.replace('function cameraFor(frame,actors){','function baseCameraForV83(frame,actors,fieldCameraV83=fieldCameraObservation,reactionV83=pitcherReactionView){')
  .replaceAll('fieldCameraObservation?.','fieldCameraV83?.').replaceAll('pitcherReactionView','reactionV83');
 // Keep the default parameter bound to the current read-only observation.
 html=once(html,original,base.replace('reactionV83=reactionV83','reactionV83=pitcherReactionView')+` function cameraFor(frame,actors){return homeRunWatchV83?.active?homeRunWatchV83.camera:baseCameraForV83(frame,actors);}
`);
 html=once(html,"  const displayBall=(playing||continuousPitchObservationV81)&&currentFrame.ballKind==='pitch'&&pitchBallActive?pitchBallSample:ball;","  let displayBall=(playing||continuousPitchObservationV81)&&currentFrame.ballKind==='pitch'&&pitchBallActive?pitchBallSample:ball;");
 html=once(html,'  continuousBatterView=window.KneekuraContinuousBatterView.observe',`  homeRunWatchV83=homeRunWatchControllerV83.observe({record:result,frame:currentFrame,sceneMs,preparationMs:timing.preparationMs,selectedCamera:options.camera,
   cameraAt:(sample,sampleSceneMs)=>{
    const field=window.KneekuraLiveFieldCamera.observe({record:result,frame:sample,bases:core.LIVE_MATCH_BASES_V1,defaultObserverPlayerId:sample.fieldObserverPlayerId}),
     sourceActors=sample.actors.map(actor=>sourceActor(actor,batterId,battingSide)),
     reaction=window.KneekuraLivePitcherReactionView.observe({record:result,frame:sample,sceneMs:sampleSceneMs,preparationMs:timing.preparationMs,pitcherActor:sourceActors.find(actor=>actor.id==='P')});
    return {camera:baseCameraForV83(sample,sourceActors,field,reaction),observerPlayerId:field?.observerPlayerId??sample.fieldObserverPlayerId};
   }});
  if(homeRunWatchV83?.displayBall)displayBall={...homeRunWatchV83.displayBall,sourceObservation:true,ballKind:'batted'};
  continuousBatterView=window.KneekuraContinuousBatterView.observe`);
 html=once(html,'liveFieldObserverPlayerId:fieldCameraObservation?.observerPlayerId??currentFrame.fieldObserverPlayerId??null,','liveFieldObserverPlayerId:homeRunWatchV83?.observerPlayerId??fieldCameraObservation?.observerPlayerId??currentFrame.fieldObserverPlayerId??null,');
 html=once(html,'liveFieldCameraTarget:fieldCameraObservation?.target??null,','liveFieldCameraTarget:homeRunWatchV83?.target??fieldCameraObservation?.target??null,');
 html=once(html,"inspect:()=>({version:81,authority:'OFFLINE_HOST_SHARED_CORE'","inspect:()=>({version:83,homeRunWatch:homeRunWatchV83,authority:'OFFLINE_HOST_SHARED_CORE'");
 return html.replaceAll('無劣化性能改善版 81','ホームラン見送り延長版 83');
}
