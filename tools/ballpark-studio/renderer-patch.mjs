import assert from 'node:assert/strict';
/** Only an in-memory copy for the design room. Normal HTML/Core stay frozen. */
export function patchDesignRenderer(source) {
  let html=source;const changes=[],once=(before,after)=>{const at=html.indexOf(before);
    assert(at>=0&&html.indexOf(before,at+before.length)<0,'Unique design renderer seam: '+before.slice(0,90));
    html=html.slice(0,at)+after+html.slice(at+before.length);changes.push({before,after});};
  once('function liveFenceDistance(t){',`function liveFenceDistance(t){
 if(observed.ballparkGeometryV1?.kind==='editable')return window.KneekuraBallparkGeometryV1.wallAt(observed.ballparkGeometryV1,t).distanceMeters;`);
  once('function fence(t,offset=0,y=0){',`function fence(t,offset=0,y=0){
 if(observed.ballparkGeometryV1?.kind==='editable'&&offset===0&&y===observed.livePark.heightMeters)
  y=window.KneekuraBallparkGeometryV1.wallAt(observed.ballparkGeometryV1,t).heightMeters;`);
  once('for(let i=0;i<=80;i++)ps.push(fence(start+i*range/80,offset,y));',`if(observed.ballparkGeometryV1?.kind==='editable'){
 const angles=[...new Set([...Array.from({length:81},(_,i)=>start+i*range/80),...observed.ballparkGeometryV1.vertices.map(p=>p.angleDegrees*Math.PI/180)])].sort((a,b)=>a-b);
 for(const t of angles)ps.push(fence(t,offset,y));
 }else for(let i=0;i<=80;i++)ps.push(fence(start+i*range/80,offset,y));`);
  once('if(observed.liveObservation?Math.hypot(x-observed.livePark.center.x,z-observed.livePark.center.z)>observed.livePark.radiusMeters+3:',
    `if(observed.liveObservation?(observed.ballparkGeometryV1?.kind==='editable'?rad>edge+3:Math.hypot(x-observed.livePark.center.x,z-observed.livePark.center.z)>observed.livePark.radiusMeters+3):`);
  once('if(rad>edge-3.5)return', 'if(rad>edge-(observed.ballparkGeometryV1?.trackWidthMeters??3.5))return');
  once('cam=chooseCamera();cam.f*=settings.zoom||1;', 'cam=observed.ballparkCameraV1?{...chooseCamera(),...observed.ballparkCameraV1}:chooseCamera();cam.f*=settings.zoom||1;');
  once('g?.radiusMeters,g?.heightMeters,','g?.radiusMeters,g?.heightMeters,observed.ballparkGeometryV1?.boundaryKey,observed.ballparkGeometryV1?.surfaceKey,!!observed.ballparkGeometryV1?.architecture,observed.ballparkGeometryV1?.architecture?.colors.gold,JSON.stringify(observed.ballparkGeometryV1?.architecture?.effects??null),JSON.stringify(observed.ballparkGeometryV1?.architecture?.roof??null),');
  once('let sceneDepth=new Map(),rasterCells=new Map(),','let architectureDetailCellsV4=[],groundDetailCellsV3=[];\n let sceneDepth=new Map(),rasterCells=new Map(),');
  once('sceneDepth=new Map(parkCacheV81.depth);fieldMarkCells=parkCacheV81.marks.map(cell=>({...cell}));',
   'sceneDepth=new Map(parkCacheV81.depth);fieldMarkCells=parkCacheV81.marks.map(cell=>({...cell}));groundDetailCellsV3=parkCacheV81.detailCellsV3.slice();window.KneekuraBallparkSurfaceReportV3=parkCacheV81.surfaceReportV3;');
  once('marks:fieldMarkCells.map(cell=>({...cell})),anchors:',
   'marks:fieldMarkCells.map(cell=>({...cell})),detailCellsV3:groundDetailCellsV3.slice(),surfaceReportV3:window.KneekuraBallparkSurfaceReportV3,anchors:');
  once('function dot(x,y,r,color,alpha=1,glow=0){x=snap(x);y=snap(y);',
   'function dot(x,y,r,color,alpha=1,glow=0,density=1,emissive=false,worldPoint=null){const g=observed.ballparkGeometryV1,lighting=g?.architecture?.effects?.lighting;if(g?.architecture?.effects?.environment){if(worldPoint)color=window.KneekuraBallparkEffectsV6.lightAt(color,g,worldPoint,emissive||glow>0);}else if(lighting)color=window.KneekuraBallparkEffectsV6.lightColor(color,lighting,emissive||glow>0);x=density===1?snap(x):snap(x*density)/density;y=density===1?snap(y):snap(y*density)/density;');
  once('function ground(){\n groundCells=0;',`function ground(){
 const surfaceV3=window.KneekuraBallparkSurfaceV3,gV3=observed.ballparkGeometryV1,zoneV3=surfaceV3.detailZone(gV3);let coarseLogoCellsV3=0;
 groundDetailCellsV3=[];groundCells=0;`);
  once('const p=groundAt(x,y),s=surfaceAt(p);\n  if(s){dot(x,y,LIGHT_RADIUS,s.color,s.alpha);',`const p=groundAt(x,y),s=surfaceV3.materialAt(gV3,p,surfaceAt(p));
  if(s){const w=surfaceV3.densityWeight(zoneV3,p);if(s.logoCoverage)coarseLogoCellsV3++;if(w<1)dot(x,y,LIGHT_RADIUS,s.color,s.alpha*(1-w),s.logoGlow??0,1,false,p);`);
  once('groundCells++;}\n }\n}\nfunction insidePolygon',`groundCells++;}
 }
 window.KneekuraBallparkSurfaceReportV3=surfaceV3.renderDetailRegion({geometry:gV3,project,groundAt,surfaceAt,grid:gridV84,coarseLogoCells:coarseLogoCellsV3,
  paint:(x,y,color,alpha,factor,depth,logo,glow)=>groundDetailCellsV3.push({x,y,color,alpha,factor,depth,logo,glow})});
}
function insidePolygon`);
  once('flushWorld();guides();history();labels();',`{
   const marksV3=new Set(fieldMarkCells.map(c=>rasterKeyV81(c.x,c.y))),reportV3=window.KneekuraBallparkSurfaceReportV3;
   let visibleV3=0,logoV3=0;
   for(const cell of groundDetailCellsV3){const key=rasterKeyV81(snap(cell.x),snap(cell.y)),blocker=rasterCells.get(key);
    if(marksV3.has(key)||(blocker&&cell.depth>blocker.depth+.02))continue;
    dot(cell.x,cell.y,LIGHT_RADIUS/cell.factor*(1+(cell.factor-1)*.075),cell.color,cell.alpha,cell.glow??0,cell.factor,false,groundAt(cell.x,cell.y));visibleV3++;if(cell.logo)logoV3++;
   }
   if(reportV3){reportV3.visibleFinePoints=visibleV3;reportV3.visibleFineLogoPoints=logoV3;if(reportV3.logo?.mode==='fine')reportV3.logo.cells=logoV3;}
  }
  flushWorld();guides();history();labels();
  window.KneekuraBallparkEffectViewV6={step:gridV84.step(),radius:LIGHT_RADIUS/qualityV84(),glow:state.glow,project:(p,density=1)=>{
   const q=project(p);if(!q||q.depth<.121||q.x<0||q.x>600||q.y<0||q.y>432)return null;
   const x=snap(q.x*density)/density,y=snap(q.y*density)/density,blocker=rasterCells.get(rasterKeyV81(snap(x),snap(y)));
   if(blocker&&blocker.owner!=='ballpark'&&blocker.depth<q.depth-.04)return {occluded:true};
   if(observed.ballparkGeometryV1?.architecture&&window.KneekuraBallparkArchitectureV2.effectsOccluded(x,y,q.depth))return {occluded:true};
   return{x,y,depth:q.depth};}};`);
  once('function flushWorld(){\n  actorCells=[];',`function flushWorld(){
  // Opaque architectural cells clear complete device pixels, preventing a finer ground lattice leaking through fractional cell edges.
  if(observed.ballparkGeometryV1?.architecture){ctx.fillStyle='#000';ctx.globalAlpha=1;for(const cell of rasterCells.values())if(cell.owner==='ballpark'){
   const half=gridV84.step()/2,x0=Math.floor((cell.x-half)*2)/2,y0=Math.floor((cell.y-half)*2)/2,x1=Math.ceil((cell.x+half)*2)/2,y1=Math.ceil((cell.y+half)*2)/2;
   ctx.fillRect(x0,y0,x1-x0,y1-y0);
  }}
  actorCells=[];`);
  once('function paintWorldCell(x,y,depth,color,alpha,owner){',`function paintWorldCell(x,y,depth,color,alpha,owner,glow=0,density=1,surfaceId=null){
 if(density>1){architectureDetailCellsV4.push({x,y,depth,color,alpha,glow,density,surfaceId});return;}`);
  once("rasterCells.set(key,{x,y,r:LIGHT_RADIUS,color,alpha:owner==='ball'?1:owner==='bat'?Math.max(.85,alpha):alpha,owner,depth});",
   "rasterCells.set(key,{x,y,r:LIGHT_RADIUS,color,alpha:owner==='ball'?1:owner==='bat'?Math.max(.85,alpha):alpha,owner,depth,glow,surfaceId});");
  once('  // Outfielders are tiny from this distance but still need identifiable labels.',`  // Emit only surviving crowd LED cells after opaque cells have finished clearing their neighbors.
  let visibleCrowdLedV4=0;for(const cell of rasterCells.values())if(cell.owner==='ballpark'&&cell.glow>0&&cell.surfaceId?.startsWith('crowd-')){
   dot(cell.x,cell.y,LIGHT_RADIUS,cell.color,cell.alpha,cell.glow);visibleCrowdLedV4++;
  }
  if(window.KneekuraBallparkLastRenderV2?.crowd)window.KneekuraBallparkLastRenderV2.crowd.visibleLedCells=visibleCrowdLedV4;
  const fineDepthV4=new Map(),netDepthV4=new Map();for(const cell of architectureDetailCellsV4){
   const key=cell.density+':'+Math.round(cell.x*cell.density/gridV84.step())+':'+Math.round(cell.y*cell.density/gridV84.step()),old=fineDepthV4.get(key);
   // Transparent strands composite after opaque details; they must not replace the seats behind them.
   if(cell.surfaceId?.startsWith('koshien-net-')){const prior=netDepthV4.get(key);if(!prior||prior.depth>cell.depth)netDepthV4.set(key,cell);continue;}
   if(!old||old.depth>cell.depth)fineDepthV4.set(key,cell);
  }
  let visibleDetailV4=0;for(const cell of fineDepthV4.values()){
   const key=rasterKeyV81(snap(cell.x),snap(cell.y)),blocker=rasterCells.get(key);
   // Dodger fine surfaces/lines already passed exact triangle depth at this pixel.
   // A neighboring coarse architectural sample must not punch holes into those surfaces.
   const exactDodgerV4=cell.surfaceId?.startsWith('paypay-')||cell.surfaceId?.startsWith('crowd-paypay-')||cell.surfaceId?.startsWith('dodger-')||cell.surfaceId?.startsWith('crowd-dodger-')||cell.surfaceId?.startsWith('koshien-')||cell.surfaceId?.startsWith('crowd-koshien-')||cell.surfaceId?.startsWith('crowd-niikura-')||cell.surfaceId?.startsWith('niikura-score-screen-');
   if(blocker&&blocker.surfaceId!==cell.surfaceId&&blocker.depth<cell.depth-.04&&!(exactDodgerV4&&blocker.owner==='ballpark'))continue;
   dot(cell.x,cell.y,LIGHT_RADIUS/cell.density*(1+(cell.density-1)*.075),cell.color,cell.alpha,cell.glow,cell.density,window.KneekuraBallparkEffectsV6.emissiveSurface(cell.surfaceId));visibleDetailV4++;
  }
  if(window.KneekuraBallparkLastRenderV2?.detail)window.KneekuraBallparkLastRenderV2.detail.visibleFineCells=visibleDetailV4;
  let visibleNetV4=0;for(const cell of netDepthV4.values()){
   const blocker=rasterCells.get(rasterKeyV81(snap(cell.x),snap(cell.y)));
   if(blocker&&blocker.owner!=='ballpark'&&blocker.depth<cell.depth-.04)continue;
   dot(cell.x,cell.y,LIGHT_RADIUS/cell.density*(1+(cell.density-1)*.075),cell.color,cell.alpha,0,cell.density);visibleNetV4++;
  }
  if(window.KneekuraBallparkLastRenderV2?.net)window.KneekuraBallparkLastRenderV2.net.visibleCells=visibleNetV4;
  // Outfielders are tiny from this distance but still need identifiable labels.`);
  once("dot(cell.x,cell.y,LIGHT_RADIUS,cell.color,cell.alpha,cell.owner==='ball'?2:0);", "dot(cell.x,cell.y,LIGHT_RADIUS,cell.color,cell.alpha,cell.owner==='ball'?2:cell.surfaceId?.includes('lamp')?(cell.glow??0):0,1,window.KneekuraBallparkEffectsV6.emissiveSurface(cell.surfaceId),cell.owner==='ballpark'?null:screenWorldV7(cell.x,cell.y,cell.depth));");
  once("function park(){const wallHeight=observed.liveObservation?observed.livePark.heightMeters:3;", `function park(){const wallHeight=observed.liveObservation?observed.livePark.heightMeters:3,boardZ=observed.ballparkGeometryV1?.kind==='editable'?liveFenceDistance(0)+24:134,
 goldV3=observed.ballparkGeometryV1?.architecture?.colors.gold,
 lineColorV3=goldV3?'#'+goldV3.slice(1).match(/../g).map(v=>Math.round(parseInt(v,16)*.8+255*.2).toString(16).padStart(2,'0')).join(''):C.chalk;`);
  for(const edge of ['left','right'])once(`},${edge},C.chalk,LIGHT_RADIUS,1);`,`},${edge},lineColorV3,LIGHT_RADIUS,1);`);
  once("markingOwner=id;poly([...points,points[0]],C.chalk,LIGHT_RADIUS,1);", "markingOwner=id;poly([...points,points[0]],id==='home'||id==='rubber'?C.chalk:lineColorV3,LIGHT_RADIUS,1);");
  once('poly(fieldGeometry.catcherLines,C.chalk,LIGHT_RADIUS,1);','poly(fieldGeometry.catcherLines,lineColorV3,LIGHT_RADIUS,1);');
  once('poly(fieldGeometry.runningLane,C.chalk,1.25,.95);','poly(fieldGeometry.runningLane,lineColorV3,1.25,.95);');
  once("wline(left,{...left,y:15},C.wall,1.15,.95);wline(right,{...right,y:15},C.wall,1.15,.95)",
    "wline(left,{...left,y:observed.ballparkGeometryV1?.kind==='editable'?Math.max(15,window.KneekuraBallparkGeometryV1.wallAt(observed.ballparkGeometryV1,-Math.PI/4).heightMeters+4):15},C.wall,1.15,.95);wline(right,{...right,y:observed.ballparkGeometryV1?.kind==='editable'?Math.max(15,window.KneekuraBallparkGeometryV1.wallAt(observed.ballparkGeometryV1,Math.PI/4).heightMeters+4):15},C.wall,1.15,.95)");
  once('for(const[x,z]of[[-86,84],[86,84],[-45,-1],[45,-1]]){',`for(const[sourceX,sourceZ]of[[-86,84],[86,84],[-45,-1],[45,-1]]){
 let x=sourceX,z=sourceZ;if(observed.ballparkGeometryV1?.kind==='editable'){
 const radius=Math.hypot(x,z),scale=Math.max(1,(liveFenceDistance(Math.atan2(x,z))+6)/radius);x*=scale;z*=scale;}`);
  const start=html.indexOf('function park(){'),end=html.indexOf('function paintWorldCell(',start),park=html.slice(start,end),
    boardPark=park.replaceAll('z:134','z:boardZ').replaceAll('z:133','z:boardZ-1'),
    seatsAt=boardPark.indexOf('const rows=state.detail'),lastBrace=boardPark.lastIndexOf('}'),
    nextPark=boardPark.slice(0,seatsAt)+'if(!observed.ballparkGeometryV1?.architecture){'+boardPark.slice(seatsAt,lastBrace)+'}'+boardPark.slice(lastBrace);
  assert(seatsAt>0&&lastBrace>seatsAt);
  assert.notEqual(park,nextPark);once(park,nextPark);
  once('drawParkV81();observed.actors.forEach(actor);',`drawParkV81();
  architectureDetailCellsV4=[];
  window.KneekuraBallparkLastRenderV2=observed.ballparkGeometryV1?.architecture?window.KneekuraBallparkArchitectureV2.render({
   geometry:observed.ballparkGeometryV1,project,paint:paintWorldCell,grid:gridV84,cam,cutaway:observed.ballparkRoofCutawayV2===true,crowd:observed.ballparkCrowdV3}):null;
  observed.actors.forEach(actor);`);
  once("ctx.fillStyle='#000';ctx.fillRect(0,0,600,432);",`ctx.fillStyle='#000';ctx.fillRect(0,0,600,432);
  window.KneekuraBallparkEffectsV6.paintSky(ctx,cam,observed.ballparkGeometryV1?.architecture?.effects?.environment,gridV84.step(),LIGHT_RADIUS);`);
  once('function draw(input,settings){',`function screenWorldV7(x,y,d){const rx=(x-cam.cx)*d/cam.f,ry=(cam.cy-y)*d/cam.f,sp=Math.sin(cam.pitch),cp=Math.cos(cam.pitch),sy=Math.sin(cam.yaw),cy=Math.cos(cam.yaw),forward=cp*d+sp*ry;return{x:cam.eye.x+cy*rx+sy*forward,y:cam.eye.y-sp*d+cp*ry,z:cam.eye.z-sy*rx+cy*forward};}
 function draw(input,settings){`);
  // Keep an exact reversibility proof for the copied renderer only.
  let reverse=html;for(const c of [...changes].reverse())reverse=reverse.replace(c.after,c.before);
  assert.equal(reverse,source);
  return {html,changes:changes.map(c=>({before:c.before.slice(0,120),after:c.after.slice(0,120)})),exactReverse:true};
}
