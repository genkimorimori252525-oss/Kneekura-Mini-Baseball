import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
export function once(s,a,b){assert.equal(s.split(a).length,2,'V100 seam '+a.slice(0,80));return s.replace(a,()=>b);}
export function transformEmbedded(s,key,fn){const start=s.indexOf('globalThis.'+key+'=');assert(start>=0,key);const from=start+('globalThis.'+key+'=').length;assert.equal(s[from],'"');
 let to=from+1;for(;to<s.length;to++){if(s[to]==='\\')to++;else if(s[to]==='"')break;}const value=JSON.parse(s.slice(from,to+1)),changed=fn(value);
 return s.slice(0,from)+JSON.stringify(changed).replaceAll('<','\\u003c')+s.slice(to+1);
}
export async function applyScoringAudioV100(s){
 const engine=await readFile('tools/browser-bridge/live-audio-v100.js','utf8'),pack=await readFile('work/v100-investigation/audio-pack.json','utf8');
 s=once(s,'</head>','<script id="audio-bank-v100">globalThis.KneekuraAudioPackV100='+pack+';</script>\n<script id="audio-runtime-v100">'+engine+'</script>\n</head>');
 let replaced=0;const description=await readFile('tools/browser-bridge/live-play-description.js','utf8');
 s=s.replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/g,(all,a,b,c)=>{if(b.includes('root.KneekuraLivePlayDescription=Object.freeze')){replaced++;return a+description+c;}return all;});assert.equal(replaced,1);
 s=once(s,'function updateScore(match,line,finished){','function updateScore(match,line,finished,scored){');
 s=once(s,"team===0?match.score.away:match.score.home,'未採点','未採点'",`team===0?match.score.away:match.score.home,...['hits','errors'].map(key=>{const n=scored?.[key],side=team===0?'away':'home',pending=team===0?'pendingAway':'pendingHome';return n?String(n[side])+(n[pending]?'＋保留'+n[pending]:''):'未採点';})`);
 s=once(s,'updateScore(match,line,finished);','updateScore(match,line,finished,result?(atEnd?result:records[selected-1]??{hits:{away:0,home:0},errors:{away:0,home:0}}):state);');
 s=once(s,' function draw(){'," const liveAudioV100=window.KneekuraAudioV100.create();\n window.KneekuraAudioV100.installControls(document.querySelector('.settings')?.parentElement??document.body);\n function draw(){");
 s=once(s,'  syncUi(result,sceneEnded(),currentFrame);','  syncUi(result,sceneEnded(),currentFrame);\n  liveAudioV100.observe({record:result,tick:currentFrame.tick,playing:playing&&!fast&&sceneStage()!==\'preparation\'});');
 s=once(s,'function stop(cancelNext=true){playing=false;token++;','function stop(cancelNext=true){liveAudioV100.stop();playing=false;token++;');
 // Both viewers consume the same saved summary. Display is read-only.
 const season="root.KneekuraCourseChartsV79.renderPublic(course,value);root.KneekuraCourseChartsV79.renderSpray(spray,value.spray);";
 s=once(s,season,season+"const fielding=core.getLiveSeasonFieldingV100({store:state,seasonId:selected,playerId:currentPlayerId});course.append(node('p','失策 '+fielding.errors+' / 記録保留プレー '+fielding.pendingPlays+' / 旧未採点プレー '+fielding.legacyUnscoredPlays));");
 return s;
}
export function shareAudioBankV100(html){return html.replace(/<script id="audio-bank-v100">[\s\S]*?<\/script>/,'<script id="audio-bank-v100">/* bank/context owned by parent */</script>');}
export function patchPracticeAudioV100(renderer,driver){
 renderer=once(renderer,'  let prepared=null,last=null,points=[],gridMeasurements=null;','  const audioV100=root.KneekuraAudioV100.create();\n  let prepared=null,last=null,points=[],gridMeasurements=null;');
 renderer=once(renderer,"function render({ms=0,camera='overhead',selectedPlayerId=null,zoom=1,appearance='retro',labels=true}={})", "function render({ms=0,camera='overhead',selectedPlayerId=null,zoom=1,appearance='retro',labels=true,playing=false,speed=1}={})");
 renderer=once(renderer,'   last={ms,frameTick:frame.tick,frame,fieldFrame:fieldAt(frame.tick),rendered,world,options,points};',
  '   audioV100.observe({record,tick:frame.tick,playing,speed});\n   last={ms,frameTick:frame.tick,frame,fieldFrame:fieldAt(frame.tick),rendered,world,options,points};');
 driver=once(driver,'zoom:s.zoom});renderer.copyToCanvas','zoom:s.zoom,playing:s.playing,speed:s.speed});renderer.copyToCanvas');
 driver=once(driver,"function pause(){s.playing=false;", "function pause(){win?.KneekuraAudioV100?.owner().stop();s.playing=false;");
 return {renderer,driver};
}
export function patchComparisonAudioV100(html){
 if(html.includes('v70-maker-match-renderer')){
  html=once(html,' function makeRecord(source,input,context,actors,ready){', ' const comparisonAudioV100=root.KneekuraAudioV100.create();\n function makeRecord(source,input,context,actors,ready){');
  html=once(html,'play:{diagnostics:clone(source.pitch.diagnostics),contactMoment:clone(source.pitch.contactMoment),call:source.pitch.call}',
   'play:{diagnostics:clone(source.pitch.diagnostics),contactMoment:clone(source.pitch.contactMoment),outgoingBallMoment:source.flightFrames.length?{ball:{velocity:source.flightFrames[0].velocity??source.flightFrames[0].ball?.velocity}}:null,call:source.pitch.call}');
  html=once(html,'  lastRequest={level,seconds,yawOffset,pitchOffset,zoom,playing};','  comparisonAudioV100.observe({record,tick:sourceTick,playing});\n  lastRequest={level,seconds,yawOffset,pitchOffset,zoom,playing};');
 }else{
  html=once(html," function render({seconds,camera='mound',playing=false}={}){", " const pitcherAudioV100=root.KneekuraAudioV100.create();\n function render({seconds,camera='mound',playing=false}={}){");
  // Physical frame tick, never a new simulation or invented pitch.
  html=once(html,'  lastRequest={seconds,camera};','  pitcherAudioV100.observe({record:prepared.record,tick:observedFrame.tick,playing:playing&&!beforeRelease});\n  lastRequest={seconds,camera};');
 }
 return shareAudioBankV100(html);
}
