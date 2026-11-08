/** Reuses the approved renderer for an offline Host running Core. The live
 * controller supplies observations; this seam cannot advance or score a play. */
export function transformLiveV33(source, runtime) {
  let html=source;
  const replace=(before,after)=>{
    if(!html.includes(before)||html.indexOf(before)!==html.lastIndexOf(before))throw new Error('v33 guard: '+before.slice(0,90));
    html=html.replace(before,after);
  };
  replace('presentationVersion:31','presentationVersion:33');
  replace('version:23,presentationVersion:33,',`version:23,presentationVersion:33,
 liveDrawWorld:(observed,options)=>{pause();
  broadcast.draw(observed,{...state,...options,ballOverlay:true,batOverlay:true,
   zone:!!options.zone&&observed.ballKind==='pitch',history:false});
  broadcast.paintBallOverlay(observed.ball,$('ball-overlay'));
  broadcast.paintBatOverlay(observed.bat,$('bat-overlay'));return broadcast.inspect();},`);
  replace('probeOpticalDiameter:(diameter,view)=>broadcast.visualBallDiameter(diameter,view),',
    'probeOpticalDiameter:(diameter,view,ballKind=null)=>broadcast.visualBallDiameter(diameter,view,ballKind),');
  replace("const illustratedBat=action==='bat'&&state.camera==='mound';",
    "const illustratedBat=action==='bat'&&state.camera==='mound'&&!observed.liveObservation;");
  replace("if(state?.camera==='mound'&&state.appearance==='retro')return 0;",
    "if(state?.camera==='mound'&&state.appearance==='retro'&&!observed.liveObservation)return 0;");
  replace("if(!ball||ball.custody||(!ball.nativeObservation&&!ballVisibleFromCamera()))return 0;",
    "if(!ball||ball.custody||(!ball.nativeObservation&&!ball.sourceObservation&&!ballVisibleFromCamera()))return 0;");
  replace('function committedFieldObserver(current){',`function committedFieldObserver(current){
 if(current.liveObservation&&current.liveFieldObserverPlayerId)
  return current.actors.find(actor=>actor.sourcePlayerId===current.liveFieldObserverPlayerId)??null;`);
  replace('if(observed.fair&&observed.ball){const target=observed.ball.position;',`if(observed.liveObservation){
    const pitcher=observed.actors.find(actor=>actor.id==='P');
    if(pitcher){base.eye={x:pitcher.position.x,y:pitcher.position.y+pitcher.player.height*.92,z:pitcher.position.z};
     base.yaw=Math.atan2(-base.eye.x,-base.eye.z);
     base.pitch=Math.atan2(base.eye.y-1.03,Math.hypot(base.eye.x,base.eye.z));}
   }
   if((observed.fair||observed.liveBattedObservation)&&observed.ball){const target=observed.ball.position;`);
  replace("if(state.camera==='runner'){\n    const runner=observed.actors.find(a=>a.id==='BAT');",`if(observed.liveObservation&&state.camera==='batter'){
    const hitter=observed.actors.find(actor=>actor.id==='BAT');
    const pitcher=observed.actors.find(actor=>actor.id==='P');
    if(hitter)base.eye={x:hitter.position.x,y:hitter.position.y+hitter.player.height*.77,z:hitter.position.z};
    if(pitcher){base.yaw=Math.atan2(pitcher.position.x-base.eye.x,pitcher.position.z-base.eye.z);}
   }
   if(state.camera==='runner'){
    const runner=observed.actors.find(a=>a.id==='BAT');`);
  replace('base.eye={x:runner.position.x,y:runner.player.height*.92,z:runner.position.z};',
    'base.eye={x:runner.position.x,y:runner.position.y+runner.player.height*.92,z:runner.position.z};');
  replace('const eye=actor?{...actor.position,y:actor.player.height*.92}:{x:-.25,y:1.72,z:18};',
    'const eye=actor?{...actor.position,y:(observed.liveObservation?actor.position.y:0)+actor.player.height*.92}:{x:-.25,y:1.72,z:18};');
  replace('return {eye:{x:0,y:1.03,z:-1.00},yaw:0,pitch:.018,f:440,cx:300,cy:104,labelMetres:.58};',
    `if(observed.liveObservation){
   const catcher=observed.actors.find(actor=>actor.id==='C');
   if(catcher)return {eye:{x:catcher.position.x,y:catcher.position.y+1.03,z:catcher.position.z+.5},
    yaw:0,pitch:.018,f:440,cx:300,cy:104,labelMetres:.58};
  }
  return {eye:{x:0,y:1.03,z:-1.00},yaw:0,pitch:.018,f:440,cx:300,cy:104,labelMetres:.58};`);
  replace('}base.pitch=.04;\n   }',`}if(observed.liveObservation&&observed.liveRunnerDirection&&Math.hypot(observed.liveRunnerDirection.x,observed.liveRunnerDirection.z)>0)
     base.yaw=Math.atan2(observed.liveRunnerDirection.x,observed.liveRunnerDirection.z);
    base.pitch=.04;
   }`);
  replace("window.addEventListener('resize',()=>render(true));",
    "window.addEventListener('resize',()=>{if(!window.liveMatchPlayback)render(true);});");
  replace('function fence(t,offset=0,y=0){const r=100+22*Math.cos(2*t)+offset;',`function liveFenceDistance(t){
 const g=observed.livePark,along=g.center.x*Math.sin(t)+g.center.z*Math.cos(t);
 return along+Math.sqrt(along*along+g.radiusMeters*g.radiusMeters-g.center.x*g.center.x-g.center.z*g.center.z);
}
function fence(t,offset=0,y=0){const r=(observed.liveObservation?liveFenceDistance(t):100+22*Math.cos(2*t))+offset;`);
  replace('edge=100+22*Math.cos(2*Math.max(-Math.PI/4,Math.min(Math.PI/4,theta)));',
    'edge=observed.liveObservation?liveFenceDistance(Math.atan2(x,z)):100+22*Math.cos(2*Math.max(-Math.PI/4,Math.min(Math.PI/4,theta)));');
  replace('if(z< -fieldGeometry.backstopDistance||Math.abs(x)>Math.max(20,z+10)||rad>edge+3)return null;',
    `if(observed.liveObservation?Math.hypot(x-observed.livePark.center.x,z-observed.livePark.center.z)>observed.livePark.radiusMeters+3:
      z< -fieldGeometry.backstopDistance||Math.abs(x)>Math.max(20,z+10)||rad>edge+3)return null;`);
  replace('const ps=[];for(let i=0;i<=80;i++)ps.push(fence(-Math.PI/4+i*Math.PI/160,offset,y));',
    'const ps=[],start=observed.liveObservation?-Math.PI:-Math.PI/4,range=observed.liveObservation?2*Math.PI:Math.PI/2;for(let i=0;i<=80;i++)ps.push(fence(start+i*range/80,offset,y));');
  replace("function park(){ground();arc(0,0,C.wall,1.2,.95,4,1);if(state.camera!=='overhead'){arc(0,3,C.wall,1.15,.95);",
    "function park(){const wallHeight=observed.liveObservation?observed.livePark.heightMeters:3;ground();arc(0,0,C.wall,1.2,.95,4,1);if(state.camera!=='overhead'){arc(0,wallHeight,C.wall,1.15,.95);");
  replace("wline(fence(t),fence(t,0,3),'#446747'", "wline(fence(t),fence(t,0,wallHeight),'#446747'");
  replace('gridAligned:anchors.every(([x,y])=>x%4===0&&y%4===0),fieldGeometry,',
    `gridAligned:anchors.every(([x,y])=>x%4===0&&y%4===0),fieldGeometry:observed.liveObservation?{...fieldGeometry,
      profile:'OFFLINE_HOST_REFERENCE_PARK',lf:liveFenceDistance(-Math.PI/4),cf:liveFenceDistance(0),
      rf:liveFenceDistance(Math.PI/4),backstopDistance:liveFenceDistance(Math.PI),fenceCenter:observed.livePark.center,
      fenceRadiusMeters:observed.livePark.radiusMeters,wallHeight:observed.livePark.heightMeters}:fieldGeometry,`);
  replace("batDisplayMode:state.camera==='mound'&&state.appearance==='retro'?'approved-four-frame':'observed-geometry'",
    "batDisplayMode:state.camera==='mound'&&state.appearance==='retro'&&!observed.liveObservation?'approved-four-frame':'observed-geometry'");
  const start=html.indexOf('function paintBatOverlay(bat,overlay){'),end=html.indexOf('function ballVisibleFromCamera()',start);
  if(start<0||end<0)throw new Error('v33 physical bat display seam missing');
  let paint=html.slice(start,end).replaceAll('batReferenceRadius(t)','displayBatRadius(t)');
  const segment='const segment=(a,b,t)=>';
  if(!paint.includes(segment))throw new Error('v33 bat interpolation seam missing');
  paint=paint.replace(segment,`const displayBatRadius=t=>{
   const knots=bat.sourceObservation?bat.radiusProfile?.knots:null;
   if(!knots)return batReferenceRadius(t);
   const index=knots.findIndex(k=>k.t>=t),b=knots[index<0?knots.length-1:index],a=knots[Math.max(0,(index<0?knots.length-1:index)-1)];
   return b.t===a.t?b.radiusM:a.radiusM+(b.radiusM-a.radiusM)*(t-a.t)/(b.t-a.t);
  };\n  `+segment);
  html=html.slice(0,start)+paint+html.slice(end);
  if(typeof runtime!=='string'||runtime.includes('</script>'))throw new Error('invalid live runtime source');
  replace('</body></html>','<script id="v33-offline-core-match">\n'+runtime+'\n</script>\n</body></html>');
  return html;
}
