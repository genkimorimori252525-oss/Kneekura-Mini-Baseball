import { expect,test } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { applyPresentationCadencePerformanceV81 } from './presentation-cadence-performance-v81.mjs';
import { applyPresentationUiPerformanceV81 } from './presentation-ui-performance-v81.mjs';

const html=readFileSync(new URL('../../docs/demos/releases/v79/game.html',import.meta.url),'utf8');
const cut=(source,start,end)=>{const i=source.indexOf(start),j=source.indexOf(end,i);if(i<0||j<0)throw Error('test marker missing');return source.slice(i,j);};
function harness(source){
  const draws=[],samples=[],queue=[],frames=[
    {tick:0,phase:'pitch',ballKind:'pitch',ball:{position:{x:1,y:1,z:1},visible:true},possessedBy:null},
    {tick:100000,phase:'batted',ballKind:'batted',ball:{position:{x:2,y:1,z:2},visible:true},possessedBy:null},
    {tick:200000,phase:'held',ballKind:'batted',ball:{position:{x:3,y:1,z:3},visible:true},possessedBy:'P'},
    {tick:300000,phase:'held',ballKind:'batted',ball:{position:{x:3,y:1,z:3},visible:false},possessedBy:'P'},
  ],result={frames,beforeFrame:{...frames[0],phase:'ready'},play:{contactMoment:{elapsedSeconds:.1},diagnostics:{sourceClockTicksPerSecond:1e6,catcherContactElapsedSeconds:null},rules:{endedAtTick:300000}}};
  const context={now:0,sceneMs:0,frameIndex:0,currentFrame:null,playing:false,fast:false,pauseAfterPitch:true,token:0,lastDraw:-Infinity,
    playStart:0,playFromMs:0,skipAtMs:null,selected:0,records:[result],rendered:{},timing:{preparationMs:100},
    result,syncPitchMenuV78(){},host:{inspect:()=>({frame:frames[0],finished:true})},performance:{now:()=>context.now},
    $:()=>({value:1}),activeResult:()=>context.result,sceneTiming:()=>({durationMs:1000}),
    sceneStage:()=>context.sceneMs<100?'preparation':context.sceneMs>=400?'result':'physical',sceneEnded:()=>context.sceneMs>=1000,
    setSceneTime(value){context.sceneMs=Math.max(0,Math.min(1000,value));const tick=Math.max(0,context.sceneMs-100)*1000;context.frameIndex=0;while(context.frameIndex+1<frames.length&&frames[context.frameIndex+1].tick<=tick)context.frameIndex++;},
    pitchSource:{sample(record,seconds){samples.push({record,sceneMs:context.sceneMs,seconds});return {position:{x:seconds,y:1,z:9},atSceneMs:context.sceneMs};}},
    visual:{paintLivePitchBall(){throw Error('ball-only painting is forbidden');}},stop(){context.playing=false;context.token++;},
    requestAnimationFrame:callback=>queue.push(callback),fail:error=>{throw error;},issue(){throw Error('test must not issue a physical pitch');}};
  vm.createContext(context);
  const cadence=cut(source,' const cadence=',' function syncNameDisplay(){');
  const draw=cut(source,' function draw(){\r\n  syncPitchMenuV78();',' function issue(){');
  const prefix=draw.slice(0,draw.indexOf('  const batterId='));
  const ball=cut(draw,'  const ball=currentFrame.ball','  const bat=currentFrame.bat');
  vm.runInContext(cadence+prefix+ball+`\n  if(globalThis.drawFault)throw Error('test draw failure');draws.push({sceneMs,playing,frameIndex,phase:currentFrame.phase,ball:displayBall});\n }\n`
    +cut(source,' function animate(){',' function play(){')
    +`\n globalThis.probe=()=>({cadence:{...cadence},pitchBallActive,pitchBallSample,lastPitchBall,continuousObservation:typeof continuousPitchObservationV81==='undefined'?false:continuousPitchObservationV81});`
    +`\n globalThis.seekApi={${cut(source,'  seekPresentationMs:','  seekFrame});')}seekFrame:null};`,Object.assign(context,{draws}));
  return {context,draws,samples,queue,frames,result,start(ms=0){context.sceneMs=ms;context.animate();},frame(now){context.now=now;const callback=queue.shift();if(!callback)throw Error('RAF missing');callback(now);},draw(ms,playing=false){context.playing=playing;context.setSceneTime(ms);context.draw();return draws.at(-1);},probe:()=>context.probe()};
}

test('fails closed on altered or duplicate v79 experiment markers',()=>{
  const patched=applyPresentationCadencePerformanceV81(html);expect(patched).not.toBe(html);
  expect(()=>applyPresentationCadencePerformanceV81(patched)).toThrow();expect(()=>applyPresentationCadencePerformanceV81(42)).toThrow();
  expect(()=>applyPresentationCadencePerformanceV81(html.replace('function refreshPitchBall(now)','function changedRefresh(now)'))).toThrow();
  expect(()=>applyPresentationCadencePerformanceV81(html+cut(html,' function animate(){',' function play(){'))).toThrow();
  expect(patched).not.toContain('else if(pitchChanged)paintPitchBall()');expect(patched).not.toContain('function paintPitchBall()');
});
test('retains legacy cadence fields and exposes the exact divided full-scene periods',()=>{
  const h=harness(applyPresentationCadencePerformanceV81(html)),p=h.probe().cadence;
  expect(p).toMatchObject({sceneMs:55,pitchBallMs:22,pitchBallPaints:0,nonPitchFastPaints:0,effectiveSceneMs:55/3,effectiveFreePitchMs:22/3,ballOnlyPainting:false});
});
test('changes only the declared Presentation experiment regions and commutes with the independent UI patch',()=>{
  const patched=applyPresentationCadencePerformanceV81(html);
  const mask=source=>source.replace(cut(source,' const cadence=',' let lastPitchBall='),'__CADENCE__')
    .replace(cut(source,' function refreshPitchBall(now)',' function syncNameDisplay(){'),'__BALL_REFRESH__')
    .replace(cut(source,'   const atEnd=sceneEnded(),','   if(atEnd){'),'__RAF__')
    .replace(cut(source,'  seekPresentationMs:','  seekFrame});'),'__SEEK__')
    .replace("  const displayBall=(playing||continuousPitchObservationV81)&&currentFrame.ballKind==='pitch'&&pitchBallActive?pitchBallSample:ball;","  const displayBall=playing&&currentFrame.ballKind==='pitch'&&pitchBallActive?pitchBallSample:ball;")
    .replace('  refreshPitchBall(performance.now());lastCadenceBoundaryV81=cadenceBoundaryV81();\r\n','');
  expect(mask(patched)).toBe(mask(html));
  expect(applyPresentationCadencePerformanceV81(applyPresentationUiPerformanceV81(html))).toBe(applyPresentationUiPerformanceV81(patched));
});
test('samples the free-pitch ball only during a synchronized scene draw and respects one steady RAF draw',()=>{
  const h=harness(applyPresentationCadencePerformanceV81(html));h.start(100);const initial=h.draws.length;
  for(let now=0;now<=95;now+=5){const before=h.draws.length;h.frame(now);expect(h.draws.length-before).toBeLessThanOrEqual(1);}
  expect(h.draws.length-initial).toBeGreaterThan(10);expect(h.samples).toHaveLength(h.draws.length);
  for(const draw of h.draws)expect(draw.ball.atSceneMs).toBe(draw.sceneMs);
  expect(h.probe().cadence.pitchBallPaints).toBe(0);expect(h.probe().cadence.lastPitchBallMs).toBe(h.draws.at(-1).sceneMs);
});
test('draws contact, secure custody and visibility boundaries at the next RAF without waiting for a period',()=>{
  const h=harness(applyPresentationCadencePerformanceV81(html));h.start(100);
  for(const now of [0,98,100,198,200,298,300]){const before=h.draws.length;h.frame(now);if([100,200,300].includes(now))expect(h.draws.length-before).toBe(1);}
  expect(h.draws.find(d=>d.sceneMs===200).phase).toBe('batted');
  expect(h.draws.find(d=>d.sceneMs===300).ball).toBeNull();expect(h.draws.find(d=>d.sceneMs===400).ball).toBeNull();
  expect(h.probe().cadence.boundaryRedraws).toBeGreaterThanOrEqual(3);
});
test('keeps paused seeks on the original frame ball, including after playing and backward seeks',()=>{
  const before=harness(html),after=harness(applyPresentationCadencePerformanceV81(html));
  after.start(100);after.frame(40);const sampleCount=after.samples.length;
  for(const ms of [0,100,150,199,200,250,300,400,999,100])expect(after.draw(ms)).toEqual(before.draw(ms));
  expect(after.samples.length).toBe(sampleCount);expect(after.probe().pitchBallActive).toBe(false);
  expect(after.result).toEqual(before.result);expect(after.frames).toEqual(before.frames);
});
test('uses the ordinary scene period outside free pitch without sampling or extra painting',()=>{
  const h=harness(applyPresentationCadencePerformanceV81(html));h.start(400);
  const initial=h.draws.length;for(let now=0;now<=95;now+=5)h.frame(now);
  expect(h.draws.length-initial).toBeGreaterThanOrEqual(5);expect(h.draws.length-initial).toBeLessThanOrEqual(6);
  expect(h.samples).toHaveLength(0);expect(h.probe().cadence.pitchBallPaints).toBe(0);
});
test('supports one read-only continuous seek draw without playing, and always restores the private option',()=>{
  const h=harness(applyPresentationCadencePerformanceV81(html)),before=structuredClone(h.result);
  h.context.seekApi.seekPresentationMs(150,{continuousPitchObservation:true});
  expect(h.draws.at(-1)).toMatchObject({sceneMs:150,playing:false,ball:{atSceneMs:150}});
  expect(h.samples).toHaveLength(1);expect(h.probe().continuousObservation).toBe(false);expect(h.context.playing).toBe(false);
  const frameBall={...h.frames[0].ball,sourceObservation:true,ballKind:'pitch'};
  h.context.seekApi.seekPresentationMs(150);expect(h.draws.at(-1).ball).toEqual(frameBall);expect(h.samples).toHaveLength(1);
  h.context.drawFault=true;expect(()=>h.context.seekApi.seekPresentationMs(160,{continuousPitchObservation:true})).toThrow('test draw failure');
  expect(h.probe().continuousObservation).toBe(false);expect(h.context.playing).toBe(false);h.context.drawFault=false;
  h.context.seekApi.seekPresentationMs(160);expect(h.draws.at(-1).ball).toEqual(frameBall);
  expect(h.result).toEqual(before);expect(h.queue).toHaveLength(0);expect(h.probe().cadence.pitchBallPaints).toBe(0);
});
