import { transformV29, V29_CAPTURE_OBSERVER_INSERTION } from './v29-presentation.mjs';

export const V30_CAPTURE_OBSERVER_INSERTION=V29_CAPTURE_OBSERVER_INSERTION.replace('capture:',
  'fairKnownLocal:flight?.fair?(field?.field&&field.field.frame<(flight.firstGround??flight.path.length)?(!foulTerritory(field.field.ball)?39+field.field.frame:null):39+(flight.firstGround??flight.path.length-1)):null,capture:');

/** Focused corrections requested after viewing v29. The bat trajectory is
 * deliberately unchanged pending the separate physical/body/tool design. */
export function transformV30(source) {
  let html=transformV29(source);
  const replace=(before,after)=>{
    if(!html.includes(before)||html.indexOf(before)!==html.lastIndexOf(before))throw new Error('v30 guard: '+before.slice(0,90));
    html=html.replace(before,after);
  };
  const between=(start,end,replacement)=>{
    const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
    if(a<0||b<0)throw new Error('v30 boundary: '+start);
    html=html.slice(0,a)+replacement+html.slice(b);
  };
  html=html.replaceAll('TBD対LAD 描画修正版 29','TBD対LAD 描画修正版 30');
  replace(V29_CAPTURE_OBSERVER_INSERTION,V30_CAPTURE_OBSERVER_INSERTION);
  replace('presentationVersion:29','presentationVersion:30');
  replace("sweetSpotBand:{minimumT:.65,maximumT:.78},aimAtPlate:true,",
    "sweetSpotBand:{minimumT:.65,maximumT:.78},aimAtPlate:true,aerodynamics:native.REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS,");
  replace('aerodynamics:{ballMassKg:.145,ballRadiusM:.0366,airDensityKgM3:1.225,\n        windVelocityMps:{x:0,y:0,z:0},dragCoefficient:.35}',
    'aerodynamics:native.REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS');
  replace('spinSource:last?.result.spinFrames?.[0]?.authority??null,',
    'spinSource:last?.result.spinFrames?.[0]?.authority??null,sourceSpinSpeedAtRelease:last?.result.spinFrames?.[0]?.angularSpeedRadPerSecond??null,sourceSpinSpeedAtContact:last?.result.spinFrames?.at(-1)?.angularSpeedRadPerSecond??null,referenceProfileSpinDecay:!!native.REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS?.spinDecay,');
  replace('labelHost.replaceChildren();if(!state.labels)return;',`labelHost.replaceChildren();if(!state.labels)return;
  if(state.camera==='overhead'){
   const sx=labelHost.clientWidth/600,sy=labelHost.clientHeight/432;
   // Every label keeps its original projected name anchor. Overlap is allowed.
   // Runners are inserted last and explicitly paint above defenders.
   const ranked=[...labelPositions].sort((a,b)=>Number(a.role==='runner')-Number(b.role==='runner'));
   for(const p of ranked){
    const outfield=['LF','CF','RF'].includes(p.id);
    const font=outfield?Math.max(11,Math.min(15,p.fontPx)):Math.max(9,Math.min(18,p.fontPx));
    const el=document.createElement('span');el.textContent=p.name;
    el.dataset.actor=p.id;el.dataset.role=p.role;el.style.fontSize=font*sx+'px';
    el.style.whiteSpace='nowrap';el.style.zIndex=p.role==='runner'?'3':'1';
    if(p.role==='runner')el.style.color='#ff7777';labelHost.append(el);
    const rect=el.getBoundingClientRect(),w=rect.width/sx,h=rect.height/sy,gap=Math.max(2,font*.15);
    const box={x:p.nameAnchor.x-w/2,y:p.nameAnchor.y-h-gap,w,h};
    el.style.left=box.x*sx+'px';el.style.top=box.y*sy+'px';p.labelBox=box;
   }return;
  }`);
  replace('let sceneDepth=new Map(),rasterCells=new Map(),actorCells=[],fieldMarkCells=[],markingOwner=null,batterRig=null;',
    'let sceneDepth=new Map(),rasterCells=new Map(),actorCells=[],fieldMarkCells=[],markingOwner=null,batterRig=null,ballDotDisplay=null;');
  between(' function visualBallDiameter(projectedPx,view,ballKind=null){',' function paintBallOverlay(ball,overlay){',` function visualBallDiameter(projectedPx,view,ballKind=null){
  if(!Number.isFinite(projectedPx)||projectedPx<=0)return 0;
  const kind=ballKind??observed?.ballKind;
  if(kind==='batted')return view==='overhead'?projectedPx:.68*projectedPx;
  if(view==='batter'||view==='catcher')return 1.30*projectedPx+3.70*(-Math.expm1(-6*projectedPx));
  return projectedPx;
 }
`);
  between(' function paintBallOverlay(ball,overlay){','  return {draw,paintBallOverlay,paintBatOverlay,visualBallDiameter,',` function paintBallOverlay(ball,overlay){
  const c=overlay.getContext('2d');c.setTransform(2,0,0,2,0,0);c.clearRect(0,0,600,432);ballDotDisplay=null;
  if(!ball||ball.custody||(!ball.nativeObservation&&!ballVisibleFromCamera()))return 0;
  const point=project(ball.position);if(!point||point.x<0||point.y<0||point.x>=600||point.y>=432)return 0;
  const realD=2*.0366*point.scale,kind=ball.ballKind??(ball.nativeObservation?'pitch':observed?.ballKind);
  const displayD=visualBallDiameter(realD,state.camera,kind),r=displayD/2;
  if(!displayD)return 0;
  const surface=BallSurface.material(ball.orientation,displayD),cells=[];
  // Same 4px lattice and dot density as the field/player art. The material
  // observer reads the source quaternion; there is no gradient/vector seam.
  const right={x:Math.cos(cam.yaw),y:0,z:-Math.sin(cam.yaw)};
  const up={x:Math.sin(cam.pitch)*Math.sin(cam.yaw),y:Math.cos(cam.pitch),z:Math.sin(cam.pitch)*Math.cos(cam.yaw)};
  const facing={x:Math.cos(cam.pitch)*Math.sin(cam.yaw),y:-Math.sin(cam.pitch),z:Math.cos(cam.pitch)*Math.cos(cam.yaw)};
  if(displayD<4){cells.push({x:snap(point.x),y:snap(point.y),radius:r,color:BallSurface.white});}
  else for(let y=Math.max(4,Math.floor((point.y-r)/4)*4);y<=Math.min(428,Math.ceil((point.y+r)/4)*4);y+=4){
   for(let x=Math.max(4,Math.floor((point.x-r)/4)*4);x<=Math.min(596,Math.ceil((point.x+r)/4)*4);x+=4){
    const nx=(x-point.x)/r,ny=(point.y-y)/r,squared=nx*nx+ny*ny;if(squared>1)continue;
    const nz=Math.sqrt(Math.max(0,1-squared));
    const normal={x:right.x*nx+up.x*ny-facing.x*nz,y:up.y*ny-facing.y*nz,z:right.z*nx+up.z*ny-facing.z*nz};
    cells.push({x,y,radius:LIGHT_RADIUS,color:surface.sample(normal).color});
   }
  }
  c.save();c.globalAlpha=Math.min(1,Math.sqrt(displayD));
  for(const cell of cells){c.fillStyle=cell.color;c.beginPath();c.arc(cell.x,cell.y,cell.radius,0,2*Math.PI);c.fill();}
  c.restore();ballDotDisplay={camera:state.camera,ballKind:kind,projectedDiameterPx:realD,displayDiameterPx:displayD,
   style:'4px-dot-grid',orientationStatus:surface.status,cells};return cells.length;
 }
`);
  replace('ballCells:[...rasterCells.values()].filter(c=>c.owner===\'ball\'),','ballDotDisplay,ballCells:[...rasterCells.values()].filter(c=>c.owner===\'ball\'),');
  replace('const fair=p.fair&&localTick>=39;',`const fair=p.fair&&localTick>=39;
 // Legacy first-ground/capture classification becomes observable only after
 // the source point exists. This is not Native RuleEngine fair adjudication.
 const fairKnown=fair&&p.presentationEvidence?.fairKnownLocal!=null&&localTick>=p.presentationEvidence.fairKnownLocal;
 const capture=p.presentationEvidence?.capture;
 const ballKind=p.contactLocal!==null&&localTick>=p.contactLocal&&(!capture||localTick<39+capture.frame)?'batted':
  p.contactLocal!==null&&capture&&localTick>39+capture.frame?'throw':'pitch';`);
  replace('actors,ball,bat,custody,benchReturn,transitionHold','actors,ball,bat,custody,ballKind,fairKnown,benchReturn,transitionHold');
  replace("zoneCorners=[];blockedZoneCells=[];if(state.camera==='overhead'||!state.zone)return;",
    "zoneCorners=[];blockedZoneCells=[];if(state.camera==='overhead'||!state.zone||state.camera==='mound'&&observed.fairKnown)return;");
  return html;
}
