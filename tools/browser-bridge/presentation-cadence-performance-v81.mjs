/** Experimental v81 Presentation scheduling only. A RAF may observe a newer
 * presentation time; it never advances/reorders Core ticks, frames or commands.
 * Paused seeks retain the v79 physical frame's ball and exact paint semantics. */
const cadenceMarker=' const cadence={sceneMs:55,pitchBallMs:22,sceneDraws:0,pitchBallSamples:0,pitchBallPaints:0,nonPitchFastPaints:0,lastSceneMs:null,lastPitchBallMs:null};';
const cadenceReplacement=` const cadence={sceneMs:55,pitchBallMs:22,sceneDraws:0,pitchBallSamples:0,pitchBallPaints:0,nonPitchFastPaints:0,lastSceneMs:null,lastPitchBallMs:null,
  effectiveSceneMs:55/3,effectiveFreePitchMs:22/3,ballOnlyPainting:false,boundaryRedraws:0};
 let lastCadenceBoundaryV81=null,continuousPitchObservationV81=false;
 function cadenceBoundaryV81(){
  const result=activeResult(),stage=sceneStage(),frame=result?(stage==='preparation'?result.beforeFrame:result.frames[frameIndex]):null;
  return [result,stage,frame?.phase,frame?.ballKind,frame?.possessedBy??null,frame?.ball?.visible!==false,
   frame?.ball?.custody??null,freePitchAt(sceneMs),frame?.homeRunConfirmed??false,frame?.fairKnown??false,
   !!result&&!!frame&&frame.tick>=result.play.rules.endedAtTick];
 }
 function sameCadenceBoundaryV81(a,b){return !!a&&!!b&&a.length===b.length&&a.every((value,index)=>value===b[index]);}`;
const refreshMarker=` function refreshPitchBall(now){const active=freePitchAt(sceneMs);
  if(!active){const clear=pitchBallActive;pitchBallActive=false;pitchBallSample=null;return clear;}
  if(!pitchBallActive||now-lastPitchBall>=22){pitchBallActive=true;lastPitchBall=Number.isFinite(lastPitchBall)?lastPitchBall+Math.max(1,Math.floor((now-lastPitchBall)/22))*22:now;
   pitchBallSample=observePitchBallAtPresentationMs(sceneMs);cadence.pitchBallSamples++;cadence.lastPitchBallMs=sceneMs;return true;}return false;
 }`;
const refreshReplacement=` function refreshPitchBall(now){const active=(playing||continuousPitchObservationV81)&&freePitchAt(sceneMs);
  if(!active){const clear=pitchBallActive;pitchBallActive=false;pitchBallSample=null;return clear;}
  // Sample only as part of draw(), at that draw's shared sceneMs. Font/camera,
  // actors, bat and ball are submitted in one scene, never a ball-only paint.
  pitchBallActive=true;lastPitchBall=now;
  pitchBallSample=observePitchBallAtPresentationMs(sceneMs);cadence.pitchBallSamples++;cadence.lastPitchBallMs=sceneMs;return true;
 }`;
const paintMarker=' function paintPitchBall(){rendered={...rendered,...visual.paintLivePitchBall(pitchBallSample)};cadence.pitchBallPaints++;}';
const drawMarker="  currentFrame=result?(sceneStage()==='preparation'?result.beforeFrame:result.frames[frameIndex]):state.frame;";
const displayMarker="  const displayBall=playing&&currentFrame.ballKind==='pitch'&&pitchBallActive?pitchBallSample:ball;";
const seekMarker=`  seekPresentationMs:value=>{if(!Number.isFinite(value)||value<0)throw new Error('Invalid presentation time');
   stop();pauseAfterPitch=true;setSceneTime(value);draw();},`;
const seekReplacement=`  seekPresentationMs:(value,optionsV81)=>{if(!Number.isFinite(value)||value<0)throw new Error('Invalid presentation time');
   stop();pauseAfterPitch=true;setSceneTime(value);
   // Read-only opt-in for a lab's single synchronous scene observation. The
   // default paused seek still paints the original v79 physical-frame ball.
   const previousObservationV81=continuousPitchObservationV81;
   try{continuousPitchObservationV81=optionsV81?.continuousPitchObservation===true;draw();}
   finally{continuousPitchObservationV81=previousObservationV81;}
  },`;
const updateMarker=`   const atEnd=sceneEnded(),pitchChanged=refreshPitchBall(now);
   if(now-lastDraw>=55||atEnd){draw();lastDraw=Number.isFinite(lastDraw)?lastDraw+Math.max(1,Math.floor((now-lastDraw)/55))*55:now;}
   else if(pitchChanged)paintPitchBall();`;
const updateReplacement=`   const atEnd=sceneEnded(),boundaryV81=cadenceBoundaryV81(),boundaryChangedV81=!sameCadenceBoundaryV81(lastCadenceBoundaryV81,boundaryV81),
    periodV81=boundaryV81[7]?cadence.effectiveFreePitchMs:cadence.effectiveSceneMs,elapsedV81=now-lastDraw;
   // Preserve the original 55:22 scene ratio at triple frequency, capped by
   // the single RAF loop. Contact/custody/visibility changes bypass the period.
   if(elapsedV81>=periodV81||atEnd||boundaryChangedV81){
    if(boundaryChangedV81)cadence.boundaryRedraws++;
    draw();lastDraw=!Number.isFinite(lastDraw)||boundaryChangedV81&&elapsedV81<periodV81?now:
     lastDraw+Math.max(1,Math.floor(elapsedV81/periodV81))*periodV81;
   }`;
function once(html,marker,replacement,label,eol){
  // v79 contains inherited CRLF Host code and LF cadence insertions. Accept
  // only these two exact marker encodings, without normalizing other bytes.
  const matches=[];
  for(const variant of new Set([marker,marker.replaceAll('\n','\r\n')])){
   let from=0,index;while((index=html.indexOf(variant,from))>=0){matches.push({index,variant});from=index+variant.length;}
  }
  if(matches.length!==1)throw Error('v81 experimental cadence marker differs: '+label);
  const {index,variant}=matches[0],encoding=variant.includes('\r\n')?'\r\n':variant.includes('\n')?'\n':eol;
  replacement=replacement.replaceAll('\n',encoding);
  return html.slice(0,index)+replacement+html.slice(index+variant.length);
}
export function applyPresentationCadencePerformanceV81(html){
  if(typeof html!=='string')throw TypeError('v81 experimental cadence requires HTML text');
  const eol=html.includes(' function animate(){\r\n')?'\r\n':'\n';
  let next=once(html,cadenceMarker,cadenceReplacement,'legacy cadence declaration',eol);
  next=once(next,refreshMarker,refreshReplacement,'draw-synchronous free-pitch observation',eol);
  next=once(next,paintMarker,' // v81 experiment: private ball-only painting removed; public observer APIs remain.', 'private ball-only paint',eol);
  next=once(next,drawMarker,drawMarker+'\n  refreshPitchBall(performance.now());lastCadenceBoundaryV81=cadenceBoundaryV81();','shared scene observation',eol);
  next=once(next,displayMarker,"  const displayBall=(playing||continuousPitchObservationV81)&&currentFrame.ballKind==='pitch'&&pitchBallActive?pitchBallSample:ball;",'single-draw continuous observation',eol);
  next=once(next,seekMarker,seekReplacement,'optional read-only seek observation',eol);
  return once(next,updateMarker,updateReplacement,'single RAF scene schedule',eol);
}
