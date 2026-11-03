import assert from 'node:assert/strict';
export function patchBackgroundRuntimeV116(text,{observedRegionV222=false}={}){
 text=text.replaceAll('\r\n','\n');
 const once=(a,b)=>{assert.equal(text.split(a).length,2,'background runtime unique seam '+a.slice(0,75));text=text.replace(a,b);};
 const start=text.indexOf(' function issue(){'),end=text.indexOf(' function animate(){',start);assert(start>=0&&end>start);
 let body=text.slice(start+' function issue(){'.length,end).trimEnd();assert(body.endsWith('}'));body=body.slice(0,-1);
 assert(body.includes('result=host.issuePitch(command());'));
 body=body.replace('result=host.issuePitch(command());','result=await thisHost.issuePitch(command());\n  if(thisGame!==gameToken||host!==thisHost||!result)return null;');
 assert(body.includes('return records[selected];'));body=body.replace('return records[selected];','thisHost.prefetch(command());return records[selected];');
 text=text.slice(0,start)+` let issuePendingV116=null;
 function backgroundFailureV116(error){if(error?.name==='AbortError')return;fail(error);draw();}
 async function issue(){
  if(issuePendingV116)return issuePendingV116;
  const thisHost=host,thisGame=gameToken,work=(async()=>{${body}\n  })();
  issuePendingV116=work;try{return await work;}finally{if(issuePendingV116===work)issuePendingV116=null;}
 }
`+text.slice(end);
 once('requestAnimationFrame(()=>requestAnimationFrame(()=>{if(nextToken!==token||nextGame!==gameToken||!preparingPitchV99)return;',
  'requestAnimationFrame(()=>requestAnimationFrame(async()=>{if(nextToken!==token||nextGame!==gameToken||!preparingPitchV99)return;');
 once('try{if(issue())animate();else draw();}catch(error){fail(error);draw();}',
  'try{const result=await issue();if(result&&nextToken===token&&nextGame===gameToken&&!pauseAfterPitch&&!fast)animate();else draw();}catch(error){backgroundFailureV116(error);}');
 once(' function play(){',' async function play(){\n  const thisGame=gameToken;\n  if(issuePendingV116){pauseAfterPitch=true;return;}');
 once('else if(!issue()){selected=0;setSceneTime(0);skipAtMs=null;selectedMark=null;}','else if(!await issue()){if(thisGame!==gameToken)return;selected=0;setSceneTime(0);skipAtMs=null;selectedMark=null;}');
 once('  }animate();\n }','  }if(thisGame===gameToken&&!pauseAfterPitch&&!fast)animate();\n }');
 once('){issue();setSceneTime(sceneTiming(activeResult()).durationMs);draw();await new Promise(resolve=>setTimeout(resolve,0));}',
  '){const next=await issue();if(!next||thisGame!==gameToken)break;setSceneTime(sceneTiming(activeResult()).durationMs);draw();await new Promise(resolve=>setTimeout(resolve,0));}');
 once('  catch(error){fail(error);}\n  finally{if(thisGame===gameToken){fast=false;draw();}}',
  '  catch(error){if(thisGame===gameToken)backgroundFailureV116(error);}\n  finally{if(thisGame===gameToken){fast=false;draw();}}');
 once('nextHost=core.createLiveBaseballMatchV1({seed:nextConfiguration.seed,innings:nextConfiguration.innings,\n     teams,players:nextSeason.players,park,measuredClips:measured.clips});',
  `workerConfigurationV116={seed:nextConfiguration.seed,innings:nextConfiguration.innings,teams,players:nextSeason.players,park,measuredClips:measured.clips${observedRegionV222?',batterObservationV151:core.AUTHORED_LIVE_BATTER_OBSERVATION_V151,batterDirectionMotorV153:core.AUTHORED_OBSERVED_DIRECTION_MOTOR_V153,randomnessV152:core.AUTHORED_MATCH_RANDOMNESS_V152,batterObservedRegionExperienceV222:core.AUTHORED_BATTER_OBSERVED_REGION_EXPERIENCE_V222':''}},
    nextHost=window.KneekuraBackgroundMatchV116.create({configuration:workerConfigurationV116,initialHost:core.createLiveBaseballMatchV1(workerConfigurationV116)});`);
 once('host=nextHost;season.beginGame(nextSeason);draw();','host?.dispose?.();issuePendingV116=null;host=nextHost;season.beginGame(nextSeason);draw();');
 once("$('play').onclick=()=>{try{play();}catch(error){fail(error);}};","$('play').onclick=()=>{play().catch(backgroundFailureV116);};");
 once("$('next-pitch').onclick=()=>{try{stop();pauseAfterPitch=true;if(selected<records.length-1){selected++;setSceneTime(0);skipAtMs=null;selectedMark=null;}else issue();draw();}catch(error){fail(error);}};",
  "$('next-pitch').onclick=async()=>{try{const thisGame=gameToken;stop();pauseAfterPitch=true;if(selected<records.length-1){selected++;setSceneTime(0);skipAtMs=null;selectedMark=null;}else await issue();if(thisGame===gameToken)draw();}catch(error){backgroundFailureV116(error);}};");
 once("pauseAfterPitch=true;$('manager-hint').textContent=playing?", "host.invalidate(command());issuePendingV116=null;pauseAfterPitch=true;$('manager-hint').textContent=playing?");
 once('generatedPitches:records.length,frameIndex,currentFrame,rendered,observedMatch,host:host.inspect(),',
  'generationV116:host.generationV116(),generatedPitches:records.length,frameIndex,currentFrame,rendered,observedMatch,host:host.inspect(),');
 return text;
}
export function applyBackgroundMatchV116(html,runtime,options={}){
 const tag='<script id="v33-offline-core-match">',start=html.indexOf(tag);assert(start>=0&&html.indexOf(tag,start+tag.length)<0);
 const end=html.indexOf('</script>',start),body=html.slice(start+tag.length,end),patched=patchBackgroundRuntimeV116(body,options);
 return html.slice(0,start)+'<script id="background-match-v116">'+runtime+'</script>\n'+tag+patched+html.slice(end);
}
