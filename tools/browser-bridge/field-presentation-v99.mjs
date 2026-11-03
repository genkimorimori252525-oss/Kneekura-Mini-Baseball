import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
function once(s,a,b){const needle=!s.includes(a)&&a.includes('\n')?a.replaceAll('\n','\r\n'):a;assert.equal(s.split(needle).length,2,'V99 presentation seam: '+a.slice(0,80));return s.replace(needle,()=>b);}
export async function applyFieldPresentationV99(html){
 const gaze=await readFile('tools/browser-bridge/live-field-gaze-v99.js','utf8')+'\n'+await readFile('tools/browser-bridge/field-gaze-controls-v99.js','utf8');
 assert(!/<\/script/i.test(gaze));
 let s=once(html,'</head>','<script id="field-gaze-v99">\n'+gaze+'\n</script>\n</head>');
 s=once(s,'   return {eye,yaw:Math.atan2(target.x-eye.x,target.z-eye.z),\n     pitch:-Math.atan2(target.y-eye.y,Math.hypot(target.x-eye.x,target.z-eye.z)),f:530,cx:300,cy:196,labelMetres:.5};',
  '   const gaze=observed.liveFieldGazeV99;\n   return {eye,yaw:gaze?.yaw??Math.atan2(target.x-eye.x,target.z-eye.z),\n     pitch:gaze?.pitch??-Math.atan2(target.y-eye.y,Math.hypot(target.x-eye.x,target.z-eye.z)),f:530,cx:300,cy:196,labelMetres:.5};');
 s=once(s,"  if(frame.phase==='bench')return 'overhead';","  if(frame.phase==='bench'){const record=activeResult(),caught=record?.play.field?.ruleFacts.flyCatch,safe=caught&&caught.secureCatchTick<=frame.tick&&(record.beforeMatch.outs===2||Object.values(record.beforeMatch.bases).every(v=>v===null));return safe&&(options.camera==='fielder'||options.camera==='mound')&&fieldCameraV83?.phase==='held'&&!fieldCameraV83?.target?'fielder':'overhead';}");
 s=once(s,'    liveFieldCameraTarget:homeRunWatchV83?.target??fieldCameraObservation?.target??null,',
  '    liveFieldGazeV99:result?.play.field&&currentFrame.ballKind!==\'pitch\'&&(options.camera===\'fielder\'||options.camera===\'mound\')?window.KneekuraLiveFieldGazeV99.observe({record:result,frame:currentFrame,bases:core.LIVE_MATCH_BASES_V1,defaultObserverPlayerId:fieldCameraObservation?.observerPlayerId??currentFrame.fieldObserverPlayerId,eyeHeightMeters:(actors.find(a=>a.sourcePlayerId===(fieldCameraObservation?.observerPlayerId??currentFrame.fieldObserverPlayerId))?.player.height??1.79)*.92}):null,\n    liveFieldCameraTarget:homeRunWatchV83?.target??fieldCameraObservation?.target??null,');
 s=once(s,'function stop(cancelNext=true){playing=false;token++;if(cancelNext)pauseAfterPitch=true;}',
  'let preparingPitchV99=false,preparingSceneV99=null;\n function stop(cancelNext=true){playing=false;token++;if(preparingPitchV99){preparingPitchV99=false;if(Number.isFinite(preparingSceneV99))setSceneTime(preparingSceneV99);preparingSceneV99=null;}if(cancelNext)pauseAfterPitch=true;}');
 s=once(s,'function activeResult(){return records[selected]??null;}','function activeResult(){return preparingPitchV99?null:records[selected]??null;}');
 s=once(s,"     if(selected<records.length-1){selected++;setSceneTime(0);skipAtMs=null;selectedMark=null;}else issue();\n     animate();",`     if(selected<records.length-1){selected++;setSceneTime(0);skipAtMs=null;selectedMark=null;animate();}
     else {const nextToken=token,nextGame=gameToken;preparingSceneV99=sceneMs;preparingPitchV99=true;sceneMs=0;frameIndex=0;draw();
      requestAnimationFrame(()=>requestAnimationFrame(()=>{if(nextToken!==token||nextGame!==gameToken||!preparingPitchV99)return;
       preparingPitchV99=false;preparingSceneV99=null;try{if(issue())animate();else draw();}catch(error){fail(error);draw();}}));}
`);
 s=once(s,' function play(){\n  if(fast)return;',' function play(){\n  if(preparingPitchV99){stop();draw();return;}\n  if(fast)return;');
 s=once(s,'nativeSqliteAdmission:false,playing,fast,error:lastFailure','nativeSqliteAdmission:false,playing,fast,preparingPitchV99,error:lastFailure');
 // The existing camera, palette and grid stay intact. Rasterize a 10cm-high
 // physical-size mesh only; no base or ball collision geometry is changed.
 const mesh=`function raisedBaseV99(points){
 const bottom=points.map(p=>({...p,y:0})),top=points.map(p=>({...p,y:.10})),faces=[{p:top,color:C.chalk}];
 for(let i=0;i<4;i++)faces.push({p:[bottom[i],bottom[(i+1)%4],top[(i+1)%4],top[i]],color:i%2?'#b5b9ae':'#8d9588'});
 const polygons=faces.map(face=>({color:face.color,p:face.p.map(project)})).filter(face=>face.p.every(Boolean));
 polygons.sort((a,b)=>b.p.reduce((n,p)=>n+p.depth,0)-a.p.reduce((n,p)=>n+p.depth,0));
 const inside=(x,y,ps)=>{let yes=false;for(let i=0,j=ps.length-1;i<ps.length;j=i++)if((ps[i].y>y)!==(ps[j].y>y)&&x<(ps[j].x-ps[i].x)*(y-ps[i].y)/(ps[j].y-ps[i].y)+ps[i].x)yes=!yes;return yes;};
 for(const face of polygons){const minX=Math.max(0,gridV84.floor(Math.min(...face.p.map(p=>p.x)))),maxX=Math.min(600,Math.max(...face.p.map(p=>p.x))),minY=Math.max(0,gridV84.floor(Math.min(...face.p.map(p=>p.y)))),maxY=Math.min(432,Math.max(...face.p.map(p=>p.y)));
  for(let y=minY;y<=maxY;y+=gridV84.step())for(let x=minX;x<=maxX;x+=gridV84.step())if(inside(x,y,face.p))dot(x,y,LIGHT_RADIUS,face.color,1);}
 poly([...top,top[0]],C.chalk,LIGHT_RADIUS,1);
}
`;
 s=once(s,'function park(){',mesh+'function park(){');
 s=once(s,"fieldGeometry.bases.forEach((p,i)=>closed(p,'base-'+(i+1)));",'fieldGeometry.bases.forEach(raisedBaseV99);');
 s=once(s,"[['home',fieldGeometry.homePlate],['rubber',fieldGeometry.rubber],...fieldGeometry.bases.map((p,i)=>['base-'+(i+1),p])]","[['home',fieldGeometry.homePlate],['rubber',fieldGeometry.rubber]]");
 return s;
}
