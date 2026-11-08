import {paypayDisplayLayout,paypayDisplayPoint,paypaySuiteClearance,paypaySeatElevation} from './paypay-display-layout.mjs';
import {wallAt} from './model.mjs';
import {defaultScoreboard,runs} from './scoreboard.mjs';
import {PAYPAY,paypayOuter,paypayBowlPoint,paypaySeatPoint,paypayRoofPoint,paypayPremiumSection,paypayTerraceSection} from './paypay-layout.mjs';
const TAU=2*Math.PI;
/** New model built from the 13 supplied photographs. All ornament goes through native dots/depth. */
export function paypayMesh(g){const display=paypayDisplayLayout(),a=g.architecture,s=a.scoreboard??defaultScoreboard(),surfaces=[],segments=[],lights=[],illuminationFixtures=[],N=120;let tiles=0;
 const face=(id,points,color,opts={})=>surfaces.push({id:'paypay-'+id+'-'+surfaces.length,points,color,roof:false,detailDensity:2,...opts}),
  line=(id,p,q,color,roof=false,density=1)=>segments.push({id:'paypay-'+id,p,q,color,roof,detailDensity:density}),
  seat=(t,v,y)=>{const p=paypaySeatPoint(g,t,v,y);p.y=paypaySeatElevation(p,y,display);return p;},quad=(t,u,v,w,y,z)=>[seat(t,v,y),seat(u,v,y),seat(u,w,z),seat(t,w,z)],
  shell=(t,y,r=111)=>paypayOuter(t,y,r),
  panel=(id,x,z,w,y,h,color,material=null,angle=0)=>{const tangent={x:Math.cos(angle),z:-Math.sin(angle)},point=(n,yy)=>({x:x+tangent.x*n,y:yy,z:z+tangent.z*n});face(id,[point(-w/2,y),point(w/2,y),point(w/2,y+h),point(-w/2,y+h)],color,{material});return{point};},
  beam=(id,p,q,width,color,roof=false)=>{const dx=q.x-p.x,dz=q.z-p.z,n=Math.hypot(dx,dz)||1,ox=-dz/n*width/2,oz=dx/n*width/2;face(id,[{x:p.x+ox,y:p.y,z:p.z+oz},{x:q.x+ox,y:q.y,z:q.z+oz},{x:q.x-ox,y:q.y,z:q.z-oz},{x:p.x-ox,y:p.y,z:p.z-oz}],color,{roof,detailDensity:roof?4:2});};
 // Shared boundary: smooth foul perimeter, original fixed diamond and authored fair fence.
 for(let i=0;i<g.vertices.length-1;i++){const p=g.vertices[i],q=g.vertices[i+1];face('fence',[{...p,y:0},{...q,y:0},{...q,y:q.heightMeters},{...p,y:p.heightMeters}],'#153d32',{material:i%4===0?'paypay:wall':null});line('fence-cap',{...p,y:p.heightMeters},{...q,y:q.heightMeters},'#bcab53');}
 const decks=[{v0:.025,v1:.49,y0:2.4,y1:15.2,bands:8},{v0:.55,v1:.96,y0:17.4,y1:29.2,bands:7}];
 for(let i=0;i<N;i++){const t=-Math.PI+i*TAU/N,u=t+TAU/N,aisle=i%6===0;
  const p=seat(t,.025,2.4),q=seat(u,.025,2.4),edgeT=paypayBowlPoint(g,t,0,p.y-.15),edgeU=paypayBowlPoint(g,u,0,q.y-.15);
  face('lower-apron',[edgeT,edgeU,q,p],'#405348',{detailDensity:3});
  for(let tier=0;tier<decks.length;tier++){const d=decks[tier];for(let band=0;band<d.bands;band++){const v=d.v0+(d.v1-d.v0)*band/d.bands,w=d.v0+(d.v1-d.v0)*(band+1)/d.bands,y=d.y0+(d.y1-d.y0)*band/d.bands,z=d.y0+(d.y1-d.y0)*(band+1)/d.bands;
   face(aisle?'steps':'seats',quad(t,u,v,w,y,z),aisle?'#7b8274':tier?'#35644b':'#416953',aisle?{}:{crowdTile:{id:tiles++,tier,band,sector:i,seatTint:'#35614b'}});
   face('tier-underside',quad(t,u,v,w,y-.3,z-.3),'#324339');
   if(band%2===1)line('seat-row',seat(t,w,z+.02),seat(u,w,z+.02),'#526f5c');}
  }
  face('cross-concourse',quad(t,u,.49,.55,15.2,15.2),'#777d6a');
  face('concourse-fascia',[seat(t,.55,15.2),seat(u,.55,15.2),seat(u,.55,17.4),seat(t,.55,17.4)],'#475a4a');
  // Display bays share a clearance profile with the seats, suite fascia and support structure.
  const suiteY=Math.min(paypaySuiteClearance(seat(t,.98,35),display),paypaySuiteClearance(seat(u,.98,35),display));
  if(suiteY>29.5)face('suite-band',[seat(t,.98,29.5),seat(u,.98,29.5),seat(u,.98,suiteY),seat(t,.98,suiteY)],'#a9a07f',{material:'paypay:suite'});
  // Enclosure is circular even though the playing fence and the seating front are not.
  face('exterior',[shell(t,0),shell(u,0),shell(u,38),shell(t,38)],'#aaa99c');
  face('lower-foot',[shell(t,-.2,111),shell(u,-.2,111),shell(u,-.2,120),shell(t,-.2,120)],'#626b66',{detailDensity:1});
  const m=(t+u)/2,slit=.007;face('upper-slit',[shell(m-slit,30.5,111.06),shell(m+slit,30.5,111.06),shell(m+slit,35.6,111.06),shell(m-slit,35.6,111.06)],'#625f4c');
  face('rail-ring',[shell(t,38,106),shell(u,38,106),shell(u,38,111),shell(t,38,111)],'#6e7770',{roof:true});
  line('rim-top',shell(t,38),shell(u,38),'#c7c5b7');line('rim-bottom',shell(t,0),shell(u,0),'#727d76');
  if(i%10===0){const f=shell(m,1.1,115);illuminationFixtures.push({...f,target:shell(m,24,111),kind:'facade',power:.65});}
  if(i%3===0){const f=shell(m,39.5,98),target={x:-f.x*.22,y:0,z:46+(46-f.z)*.15};illuminationFixtures.push({...f,target,kind:'field',power:1.1});
   for(let row=0;row<2;row++){const p=shell(t+.006,39.5+row*.65,98),q=shell(u-.006,39.5+row*.65,98);face('lamp-bank',[p,q,{...q,y:q.y+.36},{...p,y:p.y+.36}],'#fff6dc');}}
 }
 // Inset field seating shares the playing wall; its rear joins the general stand and walkway.
 const blend=(section,v)=>({x:section.front.x+(section.back.x-section.front.x)*v,y:section.front.y+(section.back.y-section.front.y)*v,z:section.front.z+(section.back.z-section.front.z)*v});
 for(const side of [-1,1]){for(let i=4;i<32;i++){const p=paypayPremiumSection(g,side,i/32),q=paypayPremiumSection(g,side,(i+1)/32);for(let row=0;row<4;row++)face('premium-seats',[blend(p,row/4),blend(q,row/4),blend(q,(row+1)/4),blend(p,(row+1)/4)],'#763c38',{crowdTile:{id:tiles++,tier:0,band:row,sector:side*i,seatTint:'#763c38'}});}
  const p=paypayPremiumSection(g,side,.02),q=paypayPremiumSection(g,side,.14);beam('dugout-roof',{...p.back,y:1.8},{...q.back,y:1.8},3.1,'#243d34');}
 // Low outfield terraces follow the authored fair fence rather than an independent decorative arc.
 for(let i=0;i<g.fencePoints.length-1;i++){const a=g.fencePoints[i],b=g.fencePoints[i+1],p=paypayTerraceSection(g,a.angleDegrees*Math.PI/180),q=paypayTerraceSection(g,b.angleDegrees*Math.PI/180);if(Math.max(p.width,q.width)<.01)continue;
  for(let row=0;row<3;row++)face('terrace-seats',[blend(p,row/3),blend(q,row/3),blend(q,(row+1)/3),blend(p,(row+1)/3)],'#8b8f79',{crowdTile:{id:tiles++,tier:0,band:row,sector:i,seatTint:'#8b8f79'}});line('terrace-rail',p.back,q.back,'#b9c1a9');}
 // A continuous curved display ring. Material U spans the full board across all panels.
 const boards=display.boards;
 for(const board of boards){const count=Math.ceil(board.width/4),point=(u,y,o=0)=>paypayDisplayPoint(display,board,u,y,o),part=board.role==='scoreboard'?'paypay:vision':'paypay:monitor-'+board.index;
  for(let i=0;i<count;i++){const u=i/count,v=(i+1)/count,at=(u,y,vv,o=0)=>({...point(u,y,o),u,v:vv});
   face('vision-housing',[point(u,board.baseY-.45,.45),point(v,board.baseY-.45,.45),point(v,board.topY+.45,.45),point(u,board.topY+.45,.45)],'#343d39');
   face('score-vision-'+board.index,[at(u,board.baseY,0,-.12),at(v,board.baseY,0,-.12),at(v,board.topY,1,-.12),at(u,board.topY,1,-.12)],'#11191b',{material:s.enabled?part:null});
   face('vision-top-frame',[point(u,board.topY,.0),point(v,board.topY,.0),point(v,board.topY+.45,.0),point(u,board.topY+.45,.0)],'#869181');
   face('vision-bottom-frame',[point(u,board.baseY-.45,.0),point(v,board.baseY-.45,.0),point(v,board.baseY,.0),point(u,board.baseY,.0)],'#67776b');
   face('vision-back',[point(v,board.baseY-.45,1),point(u,board.baseY-.45,1),point(u,board.topY+.45,1),point(v,board.topY+.45,1)],'#3d4d42');
   face('vision-podium',[point(u,board.baseY-1.8,.45),point(v,board.baseY-1.8,.45),point(v,board.baseY-.45,.45),point(u,board.baseY-.45,.45)],'#536355');
  }
  for(const u of [0,1]){face('vision-end',[point(u,board.baseY-.45,0),point(u,board.baseY-.45,1),point(u,board.topY+.45,1),point(u,board.topY+.45,0)],'#4c5a4c');}
  for(const u of [.18,.5,.82])beam('vision-support',point(u,19,1),point(u,board.baseY-.45,1),.55,'#465048');
 }
 // Dark center batter's eye is a solid base below the central vision.
 const cf=wallAt(g,0).distanceMeters;panel('batters-eye',0,cf+.3,17,0,8.8,'#102f27');
 for(const side of [-1,1]){const c=shell(side*.23,46,93);panel('sponsor',c.x,c.z,15.5,43,3.7,'#9d292c',a.details?.logos!==false?'paypay:upper-ad':null,side*.23);}
 // Three independent curved leaves and their two-depth triangular lattice, not flat fan lines.
 const opening=a.roof.openingPercent,angular=24,rings=10;
 for(let leaf=0;leaf<3;leaf++)for(let i=0;i<angular;i++)for(let j=0;j<rings;j++){
  const u=i/angular,v=(i+1)/angular,r=j/rings,w=(j+1)/rings,point=(uu,vv,under=false)=>paypayRoofPoint(leaf,uu,vv,opening,under),p=point(u,r),q=point(v,r),h=point(v,w),k=point(u,w);
  face('roof-skin-'+leaf,j===0?[p,h,k]:[p,q,h,k],j%2?'#626b62':'#697067',{roof:true,detailDensity:3});
  if(j>0){const a0=point(u,r,true),b0=point(v,r,true),c0=point(v,w,true),d0=point(u,w,true);
   beam('roof-lower-chord',a0,b0,.48,'#abb7a6',true);beam('roof-lower-chord',a0,d0,.48,'#abb7a6',true);beam('roof-diagonal',i%2?a0:b0,i%2?c0:d0,.30,'#91a08c',true);
   if(i%3===0&&j%2===0){beam('roof-web',a0,point(v,w),.12,'#7b887a',true);beam('roof-web',point(u,r),c0,.12,'#7b887a',true);}}
 }
 for(let leaf=0;leaf<3;leaf++)for(const u of [0,1])for(let j=0;j<10;j++){const p=paypayRoofPoint(leaf,u,j/10,opening),q=paypayRoofPoint(leaf,u,(j+1)/10,opening),r=paypayRoofPoint(leaf,u,(j+1)/10,opening,true),h=paypayRoofPoint(leaf,u,j/10,opening,true);face('roof-panel-edge',[p,q,r,h],'#6e796b',{roof:true,detailDensity:3});}
 // The broad entry bay is embedded in the cylindrical wall and follows its curvature.
 for(let i=-7;i<7;i++){const t=Math.PI+i*.035,u=t+.035;for(let row=0;row<4;row++){const y=3+row*4.6;face('entry-glass',[shell(t+.003,y,111.12),shell(u-.003,y,111.12),shell(u-.003,y+3.8,111.12),shell(t+.003,y+3.8,111.12)],'#6a756b');}
  beam('entry-pier',shell(t,2.5,111.4),shell(t,23.5,111.4),.6,'#c4bfa9');}
 panel('entry-name',0,46-111-.3,49,25,4,'#a9a99e',a.details?.logos!==false?'paypay:entry':null);
 for(let i=0;i<4;i++){const y=-.1+i*.25,r=120-i*2;face('entry-step',[shell(2.83,y,r),shell(3.45,y,r),shell(3.45,y,r-2),shell(2.83,y,r-2)],'#92958a');}
 return{surfaces,segments,lights,illuminationFixtures,capacity:a.capacity,tiers:3,rowsPerTier:decks.map(d=>d.bands),spectatorTiles:tiles,spectatorLights:0,seating:{decks:2,upperSuites:true,crossConcourse:true},
  envelope:{rx:111,rz:111,centerZ:46,frontZ:-65,bowlTop:29.2,eaveY:38,topY:68,exponent:2},roof:{type:'three_layer_rotating_shells',openingPercent:opening,leafCount:3,movingLeafCount:2,rotationDegrees:120,trussDepthMeters:2.3},
  scoreboard:{enabled:s.enabled,mode:'DESIGN_SAMPLE',layout:'fukuoka_continuous_panorama',display,boards,z:display.boards[2].z,baseY:display.boards[2].baseY,scale:.55,teams:s.teams.map(t=>({...t,runs:runs(t)})),balls:s.balls,strikes:s.strikes,outs:s.outs,speedKmh:s.speedKmh}};
}
