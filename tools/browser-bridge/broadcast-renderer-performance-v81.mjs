const START='function makeBroadcastRenderer(canvas,labelHost){',END="\n'use strict';\nconst freeze=o=>",MARK='/* V81_BROADCAST_PERFORMANCE */';
const once=(source,from,to)=>{
 if(source.split(from).length!==2)throw Error('V81 broadcast renderer marker differs: '+from.slice(0,100));
 return source.replace(from,()=>to);
};

/** Pure, exact-source renderer patch. No Core, world clock or sampling changes. */
export function applyBroadcastRendererPerformanceV81(html){
 if(typeof html!=='string'||html.includes(MARK)||html.split(START).length!==2||html.split(END).length!==2)
  throw Error('V81 broadcast renderer requires one unmodified renderer boundary');
 const from=html.indexOf(START),through=html.indexOf(END,from);
 if(through<from)throw Error('V81 broadcast renderer boundary order differs');
 let renderer=html.slice(from,through);
 renderer=once(renderer,' function camera(){return cam;}',` ${MARK}
 let projectionV81=null,parkCacheV81=null,parkCandidateV81=null,parkReadbackFailedV81=false;
 const groundRowsV81=new Map(),rasterKeyV81=(x,y)=>Number.isFinite(x)&&Number.isFinite(y)?x*512+y:x+','+y;
 function updateProjectionV81(){projectionV81={sinYaw:Math.sin(cam.yaw),cosYaw:Math.cos(cam.yaw),sinPitch:Math.sin(cam.pitch),cosPitch:Math.cos(cam.pitch)};groundRowsV81.clear();}
 const sameParkKeyV81=(a,b)=>!!a&&a.length===b.length&&a.every((value,index)=>Object.is(value,b[index]));
 function drawParkV81(){
  if(parkReadbackFailedV81||typeof ctx.getImageData!=='function'||typeof ctx.putImageData!=='function'){park();return;}
  const g=observed.livePark,key=[cam.eye.x,cam.eye.y,cam.eye.z,cam.yaw,cam.pitch,cam.f,cam.cx,cam.cy,
   state.camera,state.detail,state.glow,observed.liveObservation,g?.center?.x,g?.center?.z,g?.radiusMeters,g?.heightMeters,
   canvas.width,canvas.height,ctx.globalCompositeOperation,ctx.filter,ctx.globalAlpha,ctx.shadowOffsetX,ctx.shadowOffsetY];
  if(parkCacheV81&&sameParkKeyV81(parkCacheV81.key,key)){
   try{ctx.putImageData(parkCacheV81.image,0,0);}
   catch{parkReadbackFailedV81=true;parkCacheV81=null;park();return;}
   // Cached depth and mark snapshots never become the actors' mutable storage.
   sceneDepth=new Map(parkCacheV81.depth);fieldMarkCells=parkCacheV81.marks.map(cell=>({...cell}));
   anchors=parkCacheV81.anchors.map(point=>[...point]);groundCells=parkCacheV81.groundCells;markingOwner=parkCacheV81.markingOwner;
   Object.assign(ctx,parkCacheV81.context);parkCandidateV81=key;return;
  }
  park();
  // One image at most. A moving camera does not add a readback every frame.
  if(sameParkKeyV81(parkCandidateV81,key)){
   try{parkCacheV81={key,image:ctx.getImageData(0,0,canvas.width,canvas.height),depth:new Map(sceneDepth),
    marks:fieldMarkCells.map(cell=>({...cell})),anchors:anchors.map(point=>[...point]),groundCells,markingOwner,
    context:{fillStyle:ctx.fillStyle,globalAlpha:ctx.globalAlpha,shadowColor:ctx.shadowColor,shadowBlur:ctx.shadowBlur}};}
   catch{parkReadbackFailedV81=true;parkCacheV81=null;}
  }
  parkCandidateV81=key;
 }
 function camera(){return cam;}`);
 renderer=once(renderer,` const side=Math.cos(c.yaw)*dx-Math.sin(c.yaw)*dz,ahead=Math.sin(c.yaw)*dx+Math.cos(c.yaw)*dz;
 const up=Math.cos(c.pitch)*dy+Math.sin(c.pitch)*ahead,depth=-Math.sin(c.pitch)*dy+Math.cos(c.pitch)*ahead;`,
 ` const side=projectionV81.cosYaw*dx-projectionV81.sinYaw*dz,ahead=projectionV81.sinYaw*dx+projectionV81.cosYaw*dz;
 const up=projectionV81.cosPitch*dy+projectionV81.sinPitch*ahead,depth=-projectionV81.sinPitch*dy+projectionV81.cosPitch*ahead;`);
 renderer=once(renderer,`function viewRay(u,v){
 const c=camera(),side=(u-c.cx)/c.f,up=(c.cy-v)/c.f;
 const ahead=Math.sin(c.pitch)*up+Math.cos(c.pitch),dy=Math.cos(c.pitch)*up-Math.sin(c.pitch);
 return{eye:c.eye,dir:{x:Math.cos(c.yaw)*side+Math.sin(c.yaw)*ahead,y:dy,z:-Math.sin(c.yaw)*side+Math.cos(c.yaw)*ahead}};`,
 `function viewRay(u,v){
 const c=camera(),side=(u-c.cx)/c.f,up=(c.cy-v)/c.f;
 const ahead=projectionV81.sinPitch*up+projectionV81.cosPitch,dy=projectionV81.cosPitch*up-projectionV81.sinPitch;
 return{eye:c.eye,dir:{x:projectionV81.cosYaw*side+projectionV81.sinYaw*ahead,y:dy,z:-projectionV81.sinYaw*side+projectionV81.cosYaw*ahead}};`);
 renderer=once(renderer,` const c=camera(),depth=p=>-Math.sin(c.pitch)*((p.y||0)-c.eye.y)+Math.cos(c.pitch)*(Math.sin(c.yaw)*(p.x-c.eye.x)+Math.cos(c.yaw)*(p.z-c.eye.z));`,
 ` const c=camera(),depth=p=>-projectionV81.sinPitch*((p.y||0)-c.eye.y)+projectionV81.cosPitch*(projectionV81.sinYaw*(p.x-c.eye.x)+projectionV81.cosYaw*(p.z-c.eye.z));`);
 renderer=once(renderer,'function groundAt(u,v){const{eye,dir}=viewRay(u,v);if(dir.y>=-.0001)return null;const t=-eye.y/dir.y;return{x:eye.x+t*dir.x,z:eye.z+t*dir.z};}',
 `function groundAt(u,v){
  // Only the renderer's exact bounded 4px lattice is memoized. General rays
  // retain the original path, including signed-zero and fractional inputs.
  if(u<4||u>596||v<4||v>428||u%4!==0||v%4!==0){const{eye,dir}=viewRay(u,v);if(dir.y>=-.0001)return null;const t=-eye.y/dir.y;return{x:eye.x+t*dir.x,z:eye.z+t*dir.z};}
  const c=camera();let row=groundRowsV81.get(v);
  if(!row){const up=(c.cy-v)/c.f,ahead=projectionV81.sinPitch*up+projectionV81.cosPitch,dy=projectionV81.cosPitch*up-projectionV81.sinPitch;
   row={ahead,dy,t:-c.eye.y/dy,points:new Map()};groundRowsV81.set(v,row);}
  if(row.dy>=-.0001)return null;
  if(row.points.has(u))return row.points.get(u);
  const side=(u-c.cx)/c.f,dirX=projectionV81.cosYaw*side+projectionV81.sinYaw*row.ahead,
   dirZ=-projectionV81.sinYaw*side+projectionV81.cosYaw*row.ahead,
   point={x:c.eye.x+row.t*dirX,z:c.eye.z+row.t*dirZ};row.points.set(u,point);return point;
 }`);
 renderer=once(renderer,"sceneDepth.set(x+','+y,q.depth)",'sceneDepth.set(rasterKeyV81(x,y),q.depth)');
 renderer=once(renderer," const key=x+','+y,previous=sceneDepth.get(key);",' const key=rasterKeyV81(x,y),previous=sceneDepth.get(key);');
 renderer=once(renderer,"const blocker=rasterCells.get(cx+','+cy);",'const blocker=rasterCells.get(rasterKeyV81(cx,cy));');
 renderer=once(renderer,'observed=input;state={detail:true,glow:.2,...settings};cam=chooseCamera();cam.f*=settings.zoom||1;',
  'observed=input;state={detail:true,glow:.2,...settings};cam=chooseCamera();cam.f*=settings.zoom||1;updateProjectionV81();');
 renderer=once(renderer,'  park();observed.actors.forEach(actor);','  drawParkV81();observed.actors.forEach(actor);');
 return html.slice(0,from)+renderer+html.slice(through);
}
