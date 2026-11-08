// Exact, guarded edits of the frozen v55 presentation. Core bytes remain intact.
export function patchV56Game(source){
 const once=(a,b)=>{if(source.split(a).length!==2&&a.includes('\n'))a=a.replaceAll('\n','\r\n');if(source.split(a).length!==2)throw Error('v56 marker: '+a);source=source.replace(a,()=>b);};
 once('function paintBallOverlay(ball,overlay){',`function projectBallView(p,c){
  const dx=p.x-c.eye.x,dy=(p.y||0)-c.eye.y,dz=p.z-c.eye.z;
  const side=Math.cos(c.yaw)*dx-Math.sin(c.yaw)*dz,ahead=Math.sin(c.yaw)*dx+Math.cos(c.yaw)*dz;
  const up=Math.cos(c.pitch)*dy+Math.sin(c.pitch)*ahead,depth=-Math.sin(c.pitch)*dy+Math.cos(c.pitch)*ahead;
  return depth<.12?null:{x:c.cx+c.f*side/depth,y:c.cy-c.f*up/depth,scale:c.f/depth,depth};
 }
 function paintBallOverlay(ball,overlay,viewOverride=null){`);
 once('const point=project(ball.position);if(!point||point.x<0',"const ballCam=viewOverride??cam,ballCamera=viewOverride?.camera??state.camera;\n  const point=viewOverride?projectBallView(ball.position,ballCam):project(ball.position);if(!point||point.x<0");
 once('const opticalD=visualBallDiameter(realD,state.camera,kind);','const opticalD=visualBallDiameter(realD,ballCamera,kind);');
 once("const visibilityMarker=state.camera==='overhead'&&ball.sourceObservation&&opticalD<1.25;", "const visibilityMarker=ballCamera==='overhead'&&ball.sourceObservation&&opticalD<1.25;");
 once('const displayD=visibilityMarker?1.25:opticalD,r=displayD/2;', 'const unscaledDisplayDiameterPx=visibilityMarker?1.25:opticalD,displayScale=window.KneekuraBallDisplayControls.scaleFor(ballCamera);\n  const displayD=unscaledDisplayDiameterPx*displayScale,r=displayD/2;');
 for(const key of ['right','up','facing']){
  const start=source.indexOf('const '+key+'=',source.indexOf('function paintBallOverlay'));
  const end=source.indexOf(';',start),old=source.slice(start,end);
  once(old,old.replaceAll('cam.', 'ballCam.'));
 }
 once('ballDotDisplay={camera:state.camera,ballKind:kind,projectedDiameterPx:', 'ballDotDisplay={camera:ballCamera,displayScale,unscaledDisplayDiameterPx,ballKind:kind,projectedDiameterPx:');
 once('const w=.4318/2,y0=observed.batter.height*.270,y1=observed.batter.height*.535;\n  zoneCorners=[{x:-w,y:y1,z:0},{x:w,y:y1,z:0},{x:w,y:y0,z:0},{x:-w,y:y0,z:0}]', 'const w=.4318/2,y0=observed.batter.height*.270,y1=observed.batter.height*.535,z=observed.liveObservation?.15:0;\n  zoneCorners=[{x:-w,y:y1,z},{x:w,y:y1,z},{x:w,y:y0,z},{x:-w,y:y0,z}]');
 once('cameraEye:{...cam.eye},custody:', 'cameraEye:{...cam.eye},cameraProjection:{camera:state.camera,eye:{...cam.eye},yaw:cam.yaw,pitch:cam.pitch,f:cam.f,cx:cam.cx,cy:cam.cy},zonePlaneZ:observed.liveObservation?.15:0,custody:');
 once('return {draw,paintBallOverlay,paintBatOverlay,visualBallDiameter,', 'return {draw,paintBallOverlay,paintBatOverlay,visualBallDiameter,inspectBall:()=>ballDotDisplay,');
 once('probeOpticalDiameter:(diameter,view,ballKind=null)=>', "paintLivePitchBall:(ball,projection)=>{broadcast.paintBallOverlay(ball,$('ball-overlay'),projection);return {ballDotDisplay:broadcast.inspectBall()};},probeOpticalDiameter:(diameter,view,ballKind=null)=>");
 once("let pitchMarksOpacity=1,catcherFollow=null,resultDisplay=null,batterGaze=null;", `let pitchMarksOpacity=1,catcherFollow=null,resultDisplay=null,batterGaze=null;
 const pitchSource=window.KneekuraPitchBallCadence.create(core);
 const cadence={sceneMs:55,pitchBallMs:22,sceneDraws:0,pitchBallSamples:0,pitchBallPaints:0,nonPitchFastPaints:0,lastSceneMs:null,lastPitchBallMs:null};
 let lastPitchBall=-Infinity,pitchBallActive=false,pitchBallSample=null;
 function freePitchAt(ms){const r=activeResult();if(!r||ms<timing.preparationMs)return false;
  const seconds=(ms-timing.preparationMs)/1000,d=r.play.diagnostics;
  if(Number.isFinite(d.catcherContactElapsedSeconds)&&seconds>=d.catcherContactElapsedSeconds||Number.isFinite(r.play.contactMoment?.elapsedSeconds)&&seconds>=r.play.contactMoment.elapsedSeconds)return false;
  const tick=r.frames[0].tick+(ms-timing.preparationMs)/1000*(r.play.diagnostics.sourceClockTicksPerSecond??1e6);
  let lo=0,hi=r.frames.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(r.frames[mid].tick<=tick)lo=mid;else hi=mid-1;}
  const f=r.frames[lo];return f.ballKind==='pitch'&&!!f.ball&&f.ball.visible!==false&&!f.possessedBy&&!f.ball.custody&&!f.ball.possessedBy;
 }
 function observePitchBallAtPresentationMs(ms){if(!Number.isFinite(ms)||ms<0)throw Error('Invalid presentation time');
  return freePitchAt(ms)?pitchSource.sample(activeResult(),(ms-timing.preparationMs)/1000):null;
 }
 function refreshPitchBall(now){const active=freePitchAt(sceneMs);
  if(!active){const clear=pitchBallActive;pitchBallActive=false;pitchBallSample=null;return clear;}
  if(!pitchBallActive||now-lastPitchBall>=22){pitchBallActive=true;lastPitchBall=Number.isFinite(lastPitchBall)?lastPitchBall+Math.max(1,Math.floor((now-lastPitchBall)/22))*22:now;
   pitchBallSample=observePitchBallAtPresentationMs(sceneMs);cadence.pitchBallSamples++;cadence.lastPitchBallMs=sceneMs;return true;}return false;
 }
 function paintPitchBall(){rendered={...rendered,...visual.paintLivePitchBall(pitchBallSample)};cadence.pitchBallPaints++;}
 function syncBallDisplay(){const s=window.KneekuraBallDisplayControls.inspect();
  for(const key of ['perspective','overhead']){const input=$('ball-scale-'+key);if(input)input.value=s[key];}
 }
 function setBallDisplay(patch){const s=window.KneekuraBallDisplayControls.configure(patch);syncBallDisplay();draw();return s;}`);
 once("sourceObservation:true,ballKind:currentFrame.ballKind}:null;", "sourceObservation:true,ballKind:currentFrame.ballKind}:null;\n  const displayBall=playing&&currentFrame.ballKind==='pitch'&&pitchBallActive?pitchBallSample:ball;");
 once('tick:currentFrame.tick,localTick,batter,pitcher,actors,ball,bat,', 'tick:currentFrame.tick,localTick,batter,pitcher,actors,ball:displayBall,bat,');
 once("const camera=cameraFor(currentFrame,actors);rendered=", "cadence.sceneDraws++;cadence.lastSceneMs=sceneMs;\n  const camera=cameraFor(currentFrame,actors);const chartWrap=$('pitch-chart').closest('.chart-wrap');if(chartWrap){chartWrap.hidden=camera==='overhead';chartWrap.style.display=camera==='overhead'?'none':'';}\n  rendered=");
 once('lastDraw=-Infinity;draw();\n  function update(now){', 'lastDraw=-Infinity;lastPitchBall=-Infinity;pitchBallActive=false;pitchBallSample=null;draw();\n  function update(now){');
 once('const atEnd=sceneEnded();\n   if(now-lastDraw>=55||atEnd){draw();lastDraw=now;}', 'const atEnd=sceneEnded(),pitchChanged=refreshPitchBall(now);\n   if(now-lastDraw>=55||atEnd){draw();lastDraw=Number.isFinite(lastDraw)?lastDraw+Math.max(1,Math.floor((now-lastDraw)/55))*55:now;}\n   else if(pitchChanged)paintPitchBall();');
 once('window.liveMatchPlayback=Object.freeze({newGame:', `const ballDisplayPanel=document.createElement('details');ballDisplayPanel.id='ball-display-controls';ballDisplayPanel.style.padding='12px 18px';
 ballDisplayPanel.innerHTML='<summary>ボールの表示倍率</summary><p>物理の大きさは変わりません。初期値はどちらも1です。投球の描画間隔は22ms、ほかは55msです。</p><label>通常視点 <input id="ball-scale-perspective" type="number" min="0.25" max="8" step="0.05" value="1"></label><label>俯瞰 <input id="ball-scale-overhead" type="number" min="0.25" max="8" step="0.05" value="1"></label><button id="ball-scale-reset">倍率を1に戻す</button>';
 document.querySelector('details.settings').after(ballDisplayPanel);
 for(const key of ['perspective','overhead'])$('ball-scale-'+key).onchange=()=>{try{setBallDisplay({[key]:Number($('ball-scale-'+key).value)});}catch(error){syncBallDisplay();$('announcement').textContent=error.message;}};
 $('ball-scale-reset').onclick=()=>setBallDisplay(window.KneekuraBallDisplayControls.defaults);
 window.liveMatchPlayback=Object.freeze({setBallDisplay,isFreePitchAtPresentationMs:ms=>{if(!Number.isFinite(ms)||ms<0)throw Error('Invalid presentation time');return freePitchAt(ms);},observePitchBallAtPresentationMs,paintLivePitchBall:(ball,projection)=>visual.paintLivePitchBall(ball,projection),newGame:`);
 once('presentation:{continuousBatterView,', 'presentation:{ballDisplay:window.KneekuraBallDisplayControls.inspect(),cadence:{...cadence},fastPitchEligible:freePitchAt(sceneMs),continuousBatterView,');
 once('presentationVersion:55','presentationVersion:56');
 once('version:55,authority:','version:56,authority:');
 once('打球追尾調整版 55','投球描画と追従調整版 56');
 once('カメラ追尾調整版 55</title>','投球描画と追従調整版 56</title>');
 return source;
}
