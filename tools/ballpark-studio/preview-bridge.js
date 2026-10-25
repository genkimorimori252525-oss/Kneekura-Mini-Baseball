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
  function draw(geometry,{camera='overhead',zoom=1,orbit=null,people=true,roofCutaway=true,crowdFrame=0,crowdFrames=3,crowdVisible=true}={}){
    const observed={...world,actors:people?world.actors:[],livePark:{...world.livePark,heightMeters:geometry.kind==='editable'?geometry.maximumHeightMeters:3},
      ballparkGeometryV1:geometry,ballparkRoofCutawayV2:roofCutaway,ballparkCrowdV3:{frame:crowdFrame,frames:crowdFrames,visible:crowdVisible}};
    if(camera==='stadium')observed.ballparkCameraV1={eye:{x:0,y:350,z:-335},yaw:0,pitch:Math.atan2(315,390),f:450,cx:300,cy:185};
    if(camera==='interior')observed.ballparkCameraV1={eye:{x:0,y:130,z:-80},yaw:0,pitch:Math.atan2(110,155),f:430,cx:300,cy:230};
    if(camera==='scoreboard'){const t=root.KneekuraBallparkArchitectureV2.scoreboardTarget(geometry);if(t)observed.ballparkCameraV1={eye:{x:0,y:t.y+20*t.scale,z:t.z-180*t.scale},yaw:0,pitch:Math.atan2(20,180),f:500,cx:300,cy:210};}
    if(camera==='exterior')observed.ballparkCameraV1={eye:{x:-270,y:265,z:-330},yaw:Math.atan2(270,385),pitch:Math.atan2(220,470),f:435,cx:300,cy:190};
    if(orbit){const yaw=orbit.yaw,elevation=orbit.elevation,radius=geometry.architecture?420:180,h=radius*Math.cos(elevation),target={x:0,y:geometry.architecture?35:0,z:45};
      observed.ballparkCameraV1={eye:{x:target.x-Math.sin(yaw)*h,y:target.y+radius*Math.sin(elevation),z:target.z-Math.cos(yaw)*h},yaw,pitch:elevation,cx:300,cy:216};}
    const rendered=visual.liveDrawWorld(observed,{camera:['stadium','exterior','interior','scoreboard'].includes(camera)?'overhead':camera,appearance:'retro',zoom,labels:false,zone:false,history:false,autoOverhead:false,homeClose:false}),
      g=rendered.fieldGeometry,fixed=Object.fromEntries(fixedKeys.map(k=>[k,g[k]]));
    latest={rendered,fixed,geometry,architecture:root.KneekuraBallparkLastRenderV2??null,logo:root.KneekuraBallparkSurfaceReportV3?.logo??null,surface:root.KneekuraBallparkSurfaceReportV3??null,options:{camera,zoom,orbit,people,roofCutaway},sourceActorCount:world.actors.length};return latest;
  }
  function copyTo(target){target.width=canvas.width;target.height=canvas.height;const c=target.getContext('2d');c.imageSmoothingEnabled=false;c.clearRect(0,0,target.width,target.height);c.drawImage(canvas,0,0);}
  return Object.freeze({draw,copyTo,inspect:()=>latest,sourceWorld:()=>structuredClone(world)});
 }
})(globalThis);
