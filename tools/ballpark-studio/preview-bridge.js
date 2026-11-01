(function(root){
 'use strict';
 root.KneekuraBallparkRendererV1=Object.freeze({install});
 function install(){
  const normal=root.liveMatchPlayback,visual=root.matchPreview,data=JSON.parse(root.document.getElementById('match-data').textContent);
  if(!normal||!visual?.liveDrawWorld)throw Error('通常試合の描画エンジンを読み込めません');
  normal.stop();const snapshot=normal.inspect(),frame=snapshot.currentFrame,all=Object.values(data.players),
   player=id=>data.players[id]??all[0],initial=frame?.actors??[],
   actors=initial.map(a=>({id:a.role==='batter'?'BAT':a.role,sourcePlayerId:a.playerId,role:a.role,position:a.position,
    player:{...player(a.playerId),height:player(a.playerId).height??1.8},running:false,walking:false,...(a.bodyPoseV105?{bodyPoseV105:a.bodyPoseV105}:{})}));
  const batter=player(initial.find(a=>a.role==='BAT'||a.role==='batter')?.playerId),pitcher=player(initial.find(a=>a.role==='P')?.playerId),
   world={liveObservation:true,livePark:{center:{x:0,z:37.5},radiusMeters:72.5,heightMeters:3},
    liveBattedObservation:false,liveFieldObserverPlayerId:initial.find(a=>a.role==='RF')?.playerId??null,liveFieldCameraTarget:{x:0,y:0,z:45},
    liveCatcherCameraTarget:null,liveBatterCameraTarget:null,livePitcherBodyHeadView:null,livePitcherReactionView:null,liveContinuousBatterView:null,
    liveTakenPitchGaze:null,livePitchMarksOpacity:0,liveDefensiveOpportunity:null,tick:frame?.tick??0,localTick:0,
    batter,pitcher,actors,ball:null,bat:null,batFrame:0,pitchFrame:0,
    p:{contactLocal:28,catchLocal:null,swing:false,outcome:null,actors:[],presentationEvidence:null},
    fair:false,fairKnown:false,custody:null,ballKind:'none',benchReturn:false,officialKnown:false,phase:'set',history:[]};
  const canvas=root.document.getElementById('field');let latest=null;
  const fixedKeys=['baseDistance','baseSide','homePlate','batterBoxes','catcherBox','catcherLines','rubber','mound','infieldDirtRadius','coachesBoxes','bases','runningLane','diamondChalk'];
  function draw(geometry,{camera='overhead',zoom=1,orbit=null,cameraPose=null,people=true,roofCutaway=true,crowdFrame=0,crowdFrames=3,crowdVisible=true}={}){
    const observed={...world,actors:people?world.actors:[],livePark:{...world.livePark,heightMeters:geometry.kind==='editable'?geometry.maximumHeightMeters:3},
      ballparkGeometryV1:geometry,ballparkRoofCutawayV2:roofCutaway,ballparkCrowdV3:{frame:crowdFrame,frames:crowdFrames,visible:crowdVisible}};
    if(camera==='stadium')observed.ballparkCameraV1={eye:{x:0,y:350,z:-335},yaw:0,pitch:Math.atan2(315,390),f:450,cx:300,cy:185};
    if(camera==='interior')observed.ballparkCameraV1={eye:{x:0,y:130,z:-80},yaw:0,pitch:Math.atan2(110,155),f:430,cx:300,cy:230};
    if(camera==='scoreboard'){const t=root.KneekuraBallparkArchitectureV2.scoreboardTarget(geometry);if(t)observed.ballparkCameraV1={eye:{x:0,y:t.y+20*t.scale,z:t.z-180*t.scale},yaw:0,pitch:Math.atan2(20,180),f:500,cx:300,cy:210};}
    if(camera==='exterior')observed.ballparkCameraV1={eye:{x:-270,y:265,z:-330},yaw:Math.atan2(270,385),pitch:Math.atan2(220,470),f:435,cx:300,cy:190};
    if(camera==='outfield')observed.ballparkCameraV1={eye:{x:0,y:230,z:420},yaw:Math.PI,pitch:Math.atan2(205,375),f:420,cx:300,cy:210};
    if(camera==='entrance')observed.ballparkCameraV1={eye:{x:0,y:15,z:-160},yaw:0,pitch:0,f:420,cx:300,cy:220};
    if(camera==='mound-detail')observed.ballparkCameraV1={eye:{x:-4.7,y:4.8,z:11},yaw:Math.atan2(4.7,6.9832),pitch:Math.atan2(4.8,Math.hypot(4.7,6.9832)),f:420,cx:300,cy:245};
    if(camera==='backnet'){const back=root.KneekuraBallparkGeometryV1.wallAt(geometry,Math.PI).distanceMeters;observed.ballparkCameraV1={eye:{x:0,y:8.5,z:-back-13},yaw:0,pitch:Math.atan2(7.3,back+41),f:430,cx:300,cy:235};}
    if(camera==='effects')observed.ballparkCameraV1=root.KneekuraBallparkArchitectureV2.effectsCamera(geometry)??{eye:{x:0,y:95,z:-240},yaw:0,pitch:Math.atan2(70,300),f:440,cx:300,cy:250};
    if(geometry.architecture?.style==='fukuoka_dome'){
     if(camera==='backnet'){const b=root.KneekuraBallparkGeometryV1.wallAt(geometry,Math.PI).distanceMeters;observed.ballparkCameraV1={eye:{x:0,y:7,z:-b+.6},yaw:0,pitch:.13,f:300,cx:300,cy:250};}
     if(camera==='interior')observed.ballparkCameraV1={eye:{x:0,y:21,z:-45},yaw:0,pitch:.20,f:400,cx:300,cy:235};
     if(camera==='exterior')observed.ballparkCameraV1={eye:{x:-175,y:175,z:-175},yaw:Math.atan2(175,221),pitch:Math.atan2(145,282),f:475,cx:300,cy:240};
     if(camera==='stadium')observed.ballparkCameraV1={eye:{x:0,y:220,z:-205},yaw:0,pitch:Math.atan2(190,251),f:470,cx:300,cy:240};
     if(camera==='outfield')observed.ballparkCameraV1={eye:{x:0,y:170,z:302},yaw:Math.PI,pitch:Math.atan2(140,256),f:460,cx:300,cy:240};
     if(camera==='entrance')observed.ballparkCameraV1={eye:{x:0,y:8,z:-126},yaw:0,pitch:-.10,f:360,cx:300,cy:230};
     if(camera==='scoreboard')observed.ballparkCameraV1={eye:{x:0,y:30.72,z:82},yaw:0,pitch:0,f:460,cx:300,cy:240};
    }
    if(geometry.architecture?.style==='niikura_dome'){
     if(camera==='scoreboard'){const t=root.KneekuraBallparkArchitectureV2.scoreboardTarget(geometry),n=Math.hypot(t.x,t.z),distance=t.width*1.07;observed.ballparkCameraV1={eye:{x:t.x-t.x/n*distance,y:t.y,z:t.z-t.z/n*distance},yaw:Math.atan2(t.x,t.z),pitch:0,f:480,cx:300,cy:226};}
     if(camera==='stadium')observed.ballparkCameraV1={eye:{x:0,y:250,z:-295},yaw:0,pitch:Math.atan2(210,350),f:420,cx:300,cy:235};
     if(camera==='interior')observed.ballparkCameraV1={eye:{x:0,y:16,z:-30},yaw:0,pitch:.06,f:260,cx:300,cy:265};
     if(camera==='exterior')observed.ballparkCameraV1={eye:{x:-235,y:190,z:-250},yaw:Math.atan2(235,310),pitch:Math.atan2(160,390),f:500,cx:300,cy:240};
     if(camera==='outfield')observed.ballparkCameraV1={eye:{x:0,y:190,z:390},yaw:Math.PI,pitch:Math.atan2(150,335),f:410,cx:300,cy:225};
     if(camera==='entrance'){const front=-root.KneekuraBallparkGeometryV1.wallAt(geometry,Math.PI).distanceMeters-.5-60;observed.ballparkCameraV1={eye:{x:0,y:8,z:front-55},yaw:0,pitch:-.03,f:375,cx:300,cy:235};}
    }
    if(geometry.architecture?.style==='dodger_stadium'){
     if(camera==='entrance')observed.ballparkCameraV1={eye:{x:0,y:4.5,z:222},yaw:Math.PI,pitch:-.04,f:390,cx:300,cy:235};
     if(camera==='stadium')observed.ballparkCameraV1={eye:{x:0,y:175,z:-185},yaw:0,pitch:Math.atan2(165,245),f:440,cx:300,cy:225};
     if(camera==='interior')observed.ballparkCameraV1={eye:{x:0,y:90,z:-65},yaw:0,pitch:Math.atan2(83,135),f:400,cx:300,cy:198};
     if(camera==='exterior')observed.ballparkCameraV1={eye:{x:-190,y:185,z:-190},yaw:Math.atan2(190,240),pitch:Math.atan2(165,305),f:405,cx:300,cy:220};
     if(camera==='outfield')observed.ballparkCameraV1={eye:{x:0,y:150,z:305},yaw:Math.PI,pitch:Math.atan2(138,275),f:420,cx:300,cy:210};
    }
    if(geometry.architecture?.style==='koshien'){
     if(camera==='mound'){
      const p=world.actors.find(a=>a.id==='P'),eye=p?.bodyPoseV105?.eye??{x:p?.position.x??0,y:(p?.position.y??0)+(p?.player.height??1.8)*.92,z:p?.position.z??18.4404};
      observed.ballparkCameraV1={eye:{...eye},yaw:Math.atan2(-eye.x,-eye.z),pitch:-.03,f:330,cx:300,cy:242};
      observed.actors=observed.actors.filter(a=>!['BAT','P'].includes(a.id));
     }
     if(camera==='stadium')observed.ballparkCameraV1={eye:{x:0,y:195,z:-210},yaw:0,pitch:Math.atan2(175,260),f:420,cx:300,cy:220};
     if(camera==='interior')observed.ballparkCameraV1={eye:{x:0,y:95,z:-75},yaw:0,pitch:Math.atan2(84,145),f:405,cx:300,cy:210};
     if(camera==='exterior')observed.ballparkCameraV1={eye:{x:-210,y:165,z:-190},yaw:Math.atan2(210,240),pitch:Math.atan2(135,320),f:420,cx:300,cy:220};
     if(camera==='outfield')observed.ballparkCameraV1={eye:{x:0,y:165,z:325},yaw:Math.PI,pitch:Math.atan2(145,290),f:420,cx:300,cy:220};
    }
    if(orbit){const yaw=orbit.yaw,elevation=orbit.elevation,radius=geometry.architecture?420:180,h=radius*Math.cos(elevation),target={x:0,y:geometry.architecture?35:0,z:45};
      observed.ballparkCameraV1={eye:{x:target.x-Math.sin(yaw)*h,y:target.y+radius*Math.sin(elevation),z:target.z-Math.cos(yaw)*h},yaw,pitch:elevation,cx:300,cy:216};}
    if(cameraPose)observed.ballparkCameraV1={...cameraPose,eye:{...cameraPose.eye}};
    const rendered=visual.liveDrawWorld(observed,{camera:['stadium','exterior','interior','scoreboard','outfield','entrance','mound-detail','backnet','effects'].includes(camera)?'overhead':camera,appearance:'retro',zoom,labels:false,zone:false,history:false,autoOverhead:false,homeClose:false}),
      g=rendered.fieldGeometry,fixed=Object.fromEntries(fixedKeys.map(k=>[k,g[k]]));
    latest={rendered,fixed,geometry,architecture:root.KneekuraBallparkLastRenderV2??null,logo:root.KneekuraBallparkSurfaceReportV3?.logo??null,surface:root.KneekuraBallparkSurfaceReportV3??null,options:{camera,zoom,orbit,people,roofCutaway},sourceActorCount:world.actors.length};return latest;
  }
  function copyTo(target){target.width=canvas.width;target.height=canvas.height;const c=target.getContext('2d');c.imageSmoothingEnabled=false;c.clearRect(0,0,target.width,target.height);c.drawImage(canvas,0,0);}
  function paintEffects(target,points){const v=root.KneekuraBallparkEffectViewV6,report={input:points.length,visible:0,occluded:0,clipped:0};if(!v)return report;const c=target.getContext('2d');c.save();c.scale(target.width/600,target.height/432);
   for(const p of points){const q=v.project(p,p.density??2);if(!q){report.clipped++;continue;}if(q.occluded){report.occluded++;continue;}c.globalAlpha=p.alpha;c.fillStyle=p.color;c.shadowColor=p.color;c.shadowBlur=p.glow*v.glow;c.beginPath();c.arc(q.x,q.y,v.radius*(p.density?1/p.density:.65),0,Math.PI*2);c.fill();report.visible++;}c.restore();return report;}
  function flagPoints(geometry,frame){return root.KneekuraBallparkEffectsV6.flags(geometry,frame);}
  return Object.freeze({draw,copyTo,paintEffects,flagPoints,inspect:()=>latest,sourceWorld:()=>structuredClone(world)});
 }
})(globalThis);
