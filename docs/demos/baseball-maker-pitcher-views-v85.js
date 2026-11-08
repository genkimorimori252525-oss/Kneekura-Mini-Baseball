/* Read-only perspective charts of one shared-Core trial. No flight equations. */
(function(root){
 'use strict';
 const width=600,height=360,near=.12,focal=240;
 const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z}),dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
 const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
 const unit=a=>{const n=Math.hypot(a.x,a.y,a.z);if(!(n>0))throw Error('軌道図の視線方向を確認してください。');return {x:a.x/n,y:a.y/n,z:a.z/n};};
 function project(p,camera){
  if(!p||![p.x,p.y,p.z].every(Number.isFinite))throw Error('軌道図の座標が不正です。');
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
 function observe(trial){
  const zone=trial.metrics.strikeZone,center=zone.centerX??0,middle=(zone.lowerY+zone.upperY)/2,plane=trial.metrics.measurementPlaneZ,
   eyeHeight=Math.max(1.15,trial.input.batter.heightMeters*.77),actual=samplePath(trial.sampleAtPitchElapsedSeconds,trial.metrics.flightSeconds),
   baseline=samplePath(trial.sampleBaselineAtPitchElapsedSeconds,baselineEnd(trial)),
   zonePoints=[{x:center-zone.halfWidth,y:zone.lowerY,z:plane},{x:center+zone.halfWidth,y:zone.lowerY,z:plane},
    {x:center+zone.halfWidth,y:zone.upperY,z:plane},{x:center-zone.halfWidth,y:zone.upperY,z:plane}],
   cameras=[{id:'behind',name:'投手の真後ろ → 本塁',eye:{x:0,y:1.98,z:20.44},target:{x:center,y:middle,z:plane}},
    {id:'catcher',name:'捕手の正面 → 投手',eye:{x:0,y:1.03,z:-1},target:{x:0,y:1.03,z:18.44}},
    {id:'batter-right',name:'右打者の目 → 投手',eye:{x:-.4,y:eyeHeight,z:-.95},target:{x:0,y:eyeHeight,z:18.44}},
    {id:'batter-left',name:'左打者の目 → 投手',eye:{x:.4,y:eyeHeight,z:-.95},target:{x:0,y:eyeHeight,z:18.44}}];
  return {version:1,actual,baseline,views:cameras.map(({id,name,...camera})=>({id,name,camera,
   actual:projectPath(actual,camera),baseline:projectPath(baseline,camera),zone:zonePoints.map(p=>project(p,camera)),
   ground:[0,5,10,15,18.44].map(z=>projectPath([{x:-1,y:0,z},{x:1,y:0,z}],camera)),
   centerline:projectPath([{x:0,y:0,z:0},{x:0,y:0,z:18.44}],camera)}))};
 }
 const api={version:1,project,projectPath,observe};root.KneekuraPitcherTrajectoryViewsV78=api;
 if(!root.document||!root.KneekuraPitcherMakerV78)return;
 const document=root.document,maker=root.KneekuraPitcherMakerV78,side=document.getElementById('pitcher-plot-side'),details=side?.closest('details');
 if(!details)return;
 details.id='pitcher-trajectory-details';details.querySelector('summary').textContent='横・上・投手後方・捕手・左右打者から同じ軌道を見る';
 const style=document.createElement('style');style.textContent='.pitcher-perspective-plots{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}.pitcher-perspective-plots figure{margin:0;min-width:0}.pitcher-perspective-plots figcaption{font-size:12px;color:#36533f;margin-bottom:4px}.pitcher-perspective-plots canvas{display:block;width:100%;height:auto;aspect-ratio:5/3;background:#fbfdfb;border:1px solid #d3e1d7;border-radius:6px}@media(max-width:650px){.pitcher-perspective-plots{grid-template-columns:1fr}}';document.head.append(style);
 const note=document.createElement('p');note.className='note';note.textContent='緑：実投球　○：投げ始め　●：本塁。比較線をONにすると、回転だけ0の比較球を灰色で重ねます。固定した目の位置から同じ球を見ます。左右打者では目の位置だけを変えます。';
 note.dataset.help='軌道は試合と同じCoreの観測結果です。遠近投影だけを変えています。捕手・打者は投手方向、投手後方は本塁方向を見るため、図の左右の向きが変わります。試合カメラの首の動きや追従は、この固定図へ加えていません。';
 const grid=document.createElement('div');grid.className='pitcher-perspective-plots';grid.id='pitcher-perspective-plots';
 const canvases=new Map();
 for(const [id,name]of [['behind','投手の真後ろ → 本塁'],['catcher','捕手の正面 → 投手'],['batter-right','右打者の目 → 投手'],['batter-left','左打者の目 → 投手']]){
  const figure=document.createElement('figure'),caption=document.createElement('figcaption'),canvas=document.createElement('canvas');
  caption.textContent=name;canvas.width=width;canvas.height=height;canvas.id='pitcher-plot-'+id;canvas.setAttribute('aria-label',name+'：実投球と無回転比較の軌道');
  figure.append(caption,canvas);grid.append(figure);canvases.set(id,canvas);
 }
 const fitLabel=document.createElement('label'),fit=document.createElement('input');fit.type='checkbox';fit.checked=true;fit.id='pitcher-views-fit';fitLabel.className='pitcher-check';fitLabel.append(fit,document.createTextNode('軌道全体を見やすく拡大（図ごと）'));fitLabel.dataset.help='視点の位置と遠近法を保ったまま、各図の線とゾーンを画面内へ拡大します。外すと4図を同じ視野倍率で比較できます。球の物理や試投は変わりません。';
 details.append(note,fitLabel,grid);root.KneekuraMakerHelp?.decorate(details);
 let lastTrial=null,model=null,error=null,drawnTrial=null;
 const stroke=(c,segments,color,lineWidth=1)=>{c.strokeStyle=color;c.lineWidth=lineWidth;for(const path of segments){if(!path.length)continue;c.beginPath();path.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();}};
 function draw(){
  for(const [id,canvas]of canvases){const c=canvas.getContext('2d');c.fillStyle='#fbfdfb';c.fillRect(0,0,width,height);
   if(!model){c.fillStyle='#52685a';c.font='18px sans-serif';c.fillText(error??'試投すると同じ球の軌道を表示します。',18,32);continue;}
   let view=model.views.find(v=>v.id===id);c.save();c.beginPath();c.rect(8,8,width-16,height-16);c.clip();
   if(fit.checked){const points=[...view.actual.flat(),...view.baseline.flat(),...view.zone.filter(Boolean)],xs=points.map(p=>p.x),ys=points.map(p=>p.y),
     loX=Math.min(...xs),hiX=Math.max(...xs),loY=Math.min(...ys),hiY=Math.max(...ys),scale=Math.min(24,(width-40)/Math.max(.01,hiX-loX),(height-40)/Math.max(.01,hiY-loY));
    const point=p=>p?{...p,x:width/2+(p.x-(loX+hiX)/2)*scale,y:height/2+(p.y-(loY+hiY)/2)*scale}:null,
     paths=segments=>segments.map(path=>path.map(point));
    view={...view,actual:paths(view.actual),baseline:paths(view.baseline),zone:view.zone.map(point),ground:view.ground.map(paths),centerline:paths(view.centerline)};
   }
   for(const path of view.ground)stroke(c,path,'#e0e9e3');stroke(c,view.centerline,'#d2dfd6');
   if(view.zone.every(Boolean)){const zone=[...view.zone,view.zone[0]];stroke(c,[zone],'#b1c6b8',1.5);}
   const showComparison=document.getElementById('pitcher-comparison-on')?.getAttribute('aria-pressed')==='true';
   for(const [segments,color]of [...(showComparison?[[view.baseline,'#89968e']]:[]),[view.actual,'#18824d']]){
    stroke(c,segments,color,2.4);const first=segments[0]?.[0],last=segments.at(-1)?.at(-1);
    if(first){c.fillStyle='#fbfdfb';c.strokeStyle=color;c.lineWidth=2;c.beginPath();c.arc(first.x,first.y,4,0,2*Math.PI);c.fill();c.stroke();}
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
