/* Read-only perspective charts of one shared-Core trial. No flight equations. */
(function(root){
 'use strict';
 const width=600,height=360,pitcherHeight=432,near=.12,focal=240;
 const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z}),dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
 const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
 const unit=a=>{const n=Math.hypot(a.x,a.y,a.z);if(!(n>0))throw Error('軌道図の視線方向を確認してください。');return {x:a.x/n,y:a.y/n,z:a.z/n};};
 function project(p,camera){
  if(!p||![p.x,p.y,p.z].every(Number.isFinite))throw Error('軌道図の座標が不正です。');
  if(camera.camera==='mound'){
   const dx=p.x-camera.eye.x,dy=p.y-camera.eye.y,dz=p.z-camera.eye.z,
    side=Math.cos(camera.yaw)*dx-Math.sin(camera.yaw)*dz,ahead=Math.sin(camera.yaw)*dx+Math.cos(camera.yaw)*dz,
    up=Math.cos(camera.pitch)*dy+Math.sin(camera.pitch)*ahead,depth=-Math.sin(camera.pitch)*dy+Math.cos(camera.pitch)*ahead;
   return depth<near?null:{x:camera.cx+camera.f*side/depth,y:camera.cy-camera.f*up/depth,scale:camera.f/depth,depth};
  }
  const forward=unit(sub(camera.target,camera.eye)),right=unit(cross({x:0,y:1,z:0},forward)),up=cross(forward,right),v=sub(p,camera.eye),depth=dot(v,forward);
  return depth<near?null:{x:width/2+focal*dot(v,right)/depth,y:height/2-focal*dot(v,up)/depth,depth};
 }
 function projectPath(path,camera){
  const segments=[];let active=null;
  for(const p of path){const q=project(p,camera);if(!q){active=null;continue;}if(!active){active=[];segments.push(active);}active.push(q);}
  return segments;
 }
 function samplePath(sample,end){
  const path=[];for(let t=0;t<end;t+=.008){const row=sample(t);if(!row)break;path.push({...row.position});}
  const last=sample(end);if(last)path.push({...last.position});return path;
 }
 function baselineEnd(trial){
  const plane=trial.metrics.measurementPlaneZ,through=trial.pitch.diagnostics.sourceDescriptor.throughElapsedSeconds,sample=trial.sampleBaselineAtPitchElapsedSeconds;
  let previous=sample(0),start=0;if(!previous)return 0;
  for(let end=Math.min(.008,through);end<=through;end=Math.min(end+.008,through)){
   const current=sample(end);if(!current)break;
   if(previous.position.z>=plane&&current.position.z<=plane){let lo=start,hi=end;
    for(let n=0;n<42;n++){const mid=(lo+hi)/2;if(sample(mid).position.z>plane)lo=mid;else hi=mid;}return hi;
   }
   if(end===through)break;previous=current;start=end;
  }
  throw Error('比較球の本塁通過時刻を観測できませんでした。');
 }
 function pitcherEye(trial){
  const helper=root.KneekuraPitcherBodyHeadView;
  if(typeof helper?.observe!=='function')throw Error('投手の目位置を計算する既存の表示部品が読み込まれていません。');
  const pitcher=trial.input.pitcher,mound=pitcher.moundPosition,preparationMs=pitcher.pitchingMotion?.preparationMs??1540;
  return helper.observe({record:{play:{diagnostics:trial.pitch.diagnostics}},frame:{phase:'pitch'},sceneMs:preparationMs,preparationMs,
   pitcherActor:{position:{x:mound.x,y:0,z:mound.z},player:{heightMeters:pitcher.heightMeters,throws:pitcher.throws}},moundSurfacePosition:mound}).eye;
 }
 function pitcherCamera(trial){
  const eye=pitcherEye(trial);
  return {camera:'mound',eye,yaw:Math.atan2(-eye.x,-eye.z),pitch:Math.atan2(eye.y-1.03,Math.hypot(eye.x,eye.z)),f:1600,cx:300,cy:192};
 }
 // The same flat field coordinates as the ordinary renderer, in metres.
 const referenceField={homePlate:[{x:0,z:0},{x:.2159,z:.2159},{x:.2159,z:.4318},{x:-.2159,z:.4318},{x:-.2159,z:.2159}],
  batterBoxes:[{points:[{x:-1.5875,z:-.6985},{x:-.3683,z:-.6985},{x:-.3683,z:1.1303},{x:-1.5875,z:1.1303}]},
   {points:[{x:.3683,z:-.6985},{x:1.5875,z:-.6985},{x:1.5875,z:1.1303},{x:.3683,z:1.1303}]}]};
 function projectEdges(edges,camera){
  const depth=p=>-Math.sin(camera.pitch)*(p.y-camera.eye.y)+Math.cos(camera.pitch)*(Math.sin(camera.yaw)*(p.x-camera.eye.x)+Math.cos(camera.yaw)*(p.z-camera.eye.z)),
   mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t}),result=[];
  for(let [a,b]of edges){const da=depth(a),db=depth(b);if(da<.121&&db<.121)continue;
   if(da<.121)a=mix(a,b,(.121-da)/(db-da));else if(db<.121)b=mix(b,a,(.121-db)/(da-db));
   const p=project(a,camera),q=project(b,camera);if(p&&q)result.push([p,q]);
  }return result;
 }
 const polygonEdges=points=>points.map((p,i)=>[p,points[(i+1)%points.length]]);
 function fieldContext(camera){
  const snapshot=root.KneekuraPitcherMakerV78?.inspect?.()?.renderer?.rendered?.fieldGeometry,
   geometry=snapshot?.homePlate&&snapshot?.batterBoxes?snapshot:referenceField,groundPoint=p=>({...p,y:0}),
   home=geometry.homePlate.map(groundPoint),boxes=geometry.batterBoxes.map(box=>box.points.map(groundPoint)),
   ground=[...[-1,0,1].map(x=>[{x,y:0,z:0},{x,y:0,z:18.44}]),...[0,5,10,15,18.44].map(z=>[{x:-1,y:0,z},{x:1,y:0,z}])];
  return {home:projectEdges(polygonEdges(home),camera),boxes:boxes.map(points=>projectEdges(polygonEdges(points),camera)),
   ground:projectEdges(ground,camera),geometry:{homePlate:geometry.homePlate,batterBoxes:geometry.batterBoxes},
   horizonY:camera.cy-camera.f*Math.tan(camera.pitch)};
 }
 function zoneVolume(volume,camera){
  if(!volume)return null;
  const polygon=volume.platePolygon;
  if(!Array.isArray(polygon)||polygon.length<3||!polygon.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z))||
   !Number.isFinite(volume.lowerY)||!Number.isFinite(volume.upperY)||volume.lowerY>=volume.upperY)throw Error('ストライクゾーンの立体範囲を確認してください。');
  const lower=polygon.map(p=>({...p,y:volume.lowerY})),upper=polygon.map(p=>({...p,y:volume.upperY}));
  return {volume,edges:projectEdges([...polygonEdges(lower),...polygonEdges(upper),...lower.map((p,i)=>[p,upper[i]])],camera)};
 }
 function observe(trial){
  const zone=trial.metrics.strikeZone,center=zone.centerX??0,plane=trial.metrics.measurementPlaneZ,
   eyeHeight=Math.max(1.15,trial.input.batter.heightMeters*.77),cameraOffsetZ=trial.metrics.battingSetupV94?.cameraOffsetZ??0,
   actual=samplePath(trial.sampleAtPitchElapsedSeconds,trial.metrics.flightSeconds),
   baseline=samplePath(trial.sampleBaselineAtPitchElapsedSeconds,baselineEnd(trial)),
   zonePoints=[{x:center-zone.halfWidth,y:zone.lowerY,z:plane},{x:center+zone.halfWidth,y:zone.lowerY,z:plane},
    {x:center+zone.halfWidth,y:zone.upperY,z:plane},{x:center-zone.halfWidth,y:zone.upperY,z:plane}],
   cameras=[{id:'behind',name:'投手の目 → 本塁',...pitcherCamera(trial)},
    {id:'catcher',name:'捕手の正面 → 投手',eye:{x:0,y:1.03,z:-1},target:{x:0,y:1.03,z:18.44}},
    {id:'batter-right',name:'右打者の目 → 投手',eye:{x:-.4,y:eyeHeight,z:-.95+cameraOffsetZ},target:{x:0,y:eyeHeight,z:18.44}},
    {id:'batter-left',name:'左打者の目 → 投手',eye:{x:.4,y:eyeHeight,z:-.95+cameraOffsetZ},target:{x:0,y:eyeHeight,z:18.44}}];
  return {version:1,actual,baseline,views:cameras.map(({id,name,...camera})=>{
   const field=id==='behind'?fieldContext(camera):null;
   return {id,name,camera,
   actual:projectPath(actual,camera),baseline:projectPath(baseline,camera),zone:zonePoints.map(p=>project(p,camera)),
   ground:field?[field.ground]:[0,5,10,15,18.44].map(z=>projectPath([{x:-1,y:0,z},{x:1,y:0,z}],camera)),
   centerline:field?[]:projectPath([{x:0,y:0,z:0},{x:0,y:0,z:18.44}],camera),
   ...(field?{field,zoneVolume:zoneVolume(trial.metrics.strikeZoneVolumeV94,camera)}:{})};})};
 }
 const api={version:1,project,projectPath,observe};root.KneekuraPitcherTrajectoryViewsV78=api;
 if(!root.document||!root.KneekuraPitcherMakerV78)return;
 const document=root.document,maker=root.KneekuraPitcherMakerV78,side=document.getElementById('pitcher-plot-side'),details=side?.closest('details');
 if(!details)return;
 details.id='pitcher-trajectory-details';details.querySelector('summary').textContent='横・上・投手目線・捕手・左右打者から同じ軌道を見る';
 const style=document.createElement('style');style.textContent='.pitcher-perspective-plots{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}.pitcher-perspective-plots figure{margin:0;min-width:0}.pitcher-perspective-plots figcaption{font-size:12px;color:#36533f;margin-bottom:4px}.pitcher-perspective-plots canvas{display:block;width:100%;height:auto;aspect-ratio:5/3;background:#fbfdfb;border:1px solid #d3e1d7;border-radius:6px}.pitcher-perspective-plots #pitcher-plot-behind{aspect-ratio:25/18}@media(max-width:650px){.pitcher-perspective-plots{grid-template-columns:1fr}}';document.head.append(style);
 const note=document.createElement('p');note.className='note';note.textContent='緑：実投球　○：投げ始め　●：本塁。比較線をONにすると、回転だけ0の比較球を灰色で重ねます。固定した目の位置から同じ球を見ます。左右打者では目の位置だけを変えます。投手目線は試合と同じ倍率で固定し、ボールを離す瞬間の目位置から見ます。身長・左右投げ・投球動作の設定に対応します。近くの球や図の外側は切れて表示されます。';
 note.dataset.help='軌道は試合と同じCoreの観測結果です。投手目線はマウンドから本塁を見る試合と同じ遠近投影です。地面・本塁・打席・ゾーンを基準に球の奥行きを見ます。近くの球に合わせた拡大縮小は行いません。目より後ろ・目の直前・図の外側は切れて表示されます。試合カメラの首の動きや追従は、この固定図へ加えていません。';
 const grid=document.createElement('div');grid.className='pitcher-perspective-plots';grid.id='pitcher-perspective-plots';
 const canvases=new Map();
 for(const [id,name]of [['behind','投手の目 → 本塁'],['catcher','捕手の正面 → 投手'],['batter-right','右打者の目 → 投手'],['batter-left','左打者の目 → 投手']]){
  const figure=document.createElement('figure'),caption=document.createElement('figcaption'),canvas=document.createElement('canvas');
  caption.textContent=name;canvas.width=width;canvas.height=id==='behind'?pitcherHeight:height;canvas.id='pitcher-plot-'+id;canvas.setAttribute('aria-label',name+'：実投球と無回転比較の軌道');
  figure.append(caption,canvas);grid.append(figure);canvases.set(id,canvas);
 }
 const fitLabel=document.createElement('label'),fit=document.createElement('input');fit.type='checkbox';fit.checked=true;fit.id='pitcher-views-fit';fitLabel.className='pitcher-check';fitLabel.append(fit,document.createTextNode('軌道全体を見やすく拡大（捕手・左右打者）'));fitLabel.dataset.help='捕手・左右打者の視点の位置と遠近法を保ったまま、線とゾーンを画面内へ拡大します。投手目線は試合と同じ倍率で固定し、この操作では変わりません。球の物理や試投は変わりません。';
 details.append(note,fitLabel,grid);root.KneekuraMakerHelp?.decorate(details);
 let lastTrial=null,model=null,error=null,drawnTrial=null;
 const stroke=(c,segments,color,lineWidth=1)=>{c.strokeStyle=color;c.lineWidth=lineWidth;for(const path of segments){if(!path.length)continue;c.beginPath();path.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();}};
 function draw(){
  for(const [id,canvas]of canvases){const c=canvas.getContext('2d'),viewHeight=canvas.height;c.fillStyle='#fbfdfb';c.fillRect(0,0,width,viewHeight);
   if(!model){c.fillStyle='#52685a';c.font='18px sans-serif';c.fillText(error??'試投すると同じ球の軌道を表示します。',18,32);continue;}
   let view=model.views.find(v=>v.id===id);c.save();c.beginPath();c.rect(8,8,width-16,viewHeight-16);c.clip();
   if(fit.checked&&id!=='behind'){const points=[...view.actual.flat(),...view.baseline.flat(),...view.zone.filter(Boolean)],xs=points.map(p=>p.x),ys=points.map(p=>p.y),
     loX=Math.min(...xs),hiX=Math.max(...xs),loY=Math.min(...ys),hiY=Math.max(...ys),
     anchor={x:(loX+hiX)/2,y:(loY+hiY)/2},spanX=hiX-loX,spanY=hiY-loY,
     scale=Math.min(24,(width-40)/Math.max(.01,spanX),(height-40)/Math.max(.01,spanY));
    const point=p=>p?{...p,x:width/2+(p.x-anchor.x)*scale,y:height/2+(p.y-anchor.y)*scale}:null,
     paths=segments=>segments.map(path=>path.map(point));
    view={...view,actual:paths(view.actual),baseline:paths(view.baseline),zone:view.zone.map(point),ground:view.ground.map(paths),centerline:paths(view.centerline)};
   }
   if(view.field){const horizon=Math.max(8,Math.min(viewHeight-8,view.field.horizonY));c.fillStyle='#e0e9e3';c.globalAlpha=.28;c.fillRect(8,horizon,width-16,viewHeight-8-horizon);c.globalAlpha=1;}
   for(const path of view.ground)stroke(c,path,'#e0e9e3');stroke(c,view.centerline,'#d2dfd6');
   if(view.field){
    const outline=view.field.home.map(path=>path[0]);if(outline.length){c.fillStyle='#fbfdfb';c.beginPath();outline.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.fill();}
    stroke(c,view.field.home,'#b1c6b8',1.5);for(const box of view.field.boxes)stroke(c,box,'#d2dfd6',1.2);
   }
   if(view.zoneVolume)stroke(c,view.zoneVolume.edges,'#b1c6b8',1.5);
   else if(view.zone.every(Boolean)){const zone=[...view.zone,view.zone[0]];stroke(c,[zone],'#b1c6b8',1.5);}
   const showComparison=document.getElementById('pitcher-comparison-on')?.getAttribute('aria-pressed')==='true';
   const releaseVisible=id!=='behind'||!!(model.actual[0]&&project(model.actual[0],view.camera));
   for(const [segments,color]of [...(showComparison?[[view.baseline,'#89968e']]:[]),[view.actual,'#18824d']]){
    stroke(c,segments,color,2.4);const first=segments[0]?.[0],last=segments.at(-1)?.at(-1);
    if(first&&releaseVisible){c.fillStyle='#fbfdfb';c.strokeStyle=color;c.lineWidth=2;c.beginPath();c.arc(first.x,first.y,4,0,2*Math.PI);c.fill();c.stroke();}
    if(last){c.fillStyle=color;c.beginPath();c.arc(last.x,last.y,4.5,0,2*Math.PI);c.fill();}
   }c.restore();
  }
 }
 function refresh(){
  const trial=maker.getResult();if(trial!==lastTrial){lastTrial=trial;model=null;error=null;try{if(trial)model=observe(trial);}catch(e){error=String(e.message??e);}}
  if(details.open&&drawnTrial!==lastTrial){draw();drawnTrial=lastTrial;}return model;
 }
 details.addEventListener('toggle',()=>{refresh();draw();drawnTrial=lastTrial;});fit.addEventListener('change',draw);
 document.addEventListener('kneekura:pitcher-comparison-change-v85',()=>{refresh();draw();drawnTrial=lastTrial;});
 function loop(){if(!document.hidden)refresh();root.requestAnimationFrame(loop);}draw();root.requestAnimationFrame(loop);
 Object.assign(api,{refresh,inspect:()=>({version:1,ready:!!model,error,views:model?.views??[],actual:model?.actual??[],baseline:model?.baseline??[]})});Object.freeze(api);
})(globalThis);
