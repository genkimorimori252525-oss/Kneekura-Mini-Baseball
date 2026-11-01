import {wallAt} from './model.mjs';import {defaultScoreboard,runs} from './scoreboard.mjs';
import {KOSHIEN_BOARD,KOSHIEN_FACADE_SECTORS} from './koshien-materials.mjs';
import {scoreboardCapabilities,scoreboardFieldDiagram} from './scoreboard-field.mjs';
import {koshienFanZone} from './koshien-fans.mjs';
import {koshienBowlRim,KOSHIEN_NET} from './koshien-home.mjs';
import {realParkSeatRim} from './real-park-infield.mjs';
const TAU=Math.PI*2;
// Closed architectural footprint independent of the immutable diamond.
function curve(u,rim){const t=((u%1)+1)%1*rim.length,i=Math.floor(t),s=t-i,p=[-1,0,1,2].map(k=>rim[(i+k+rim.length)%rim.length]);return[0,1].map(k=>.5*((2*p[1][k])+(-p[0][k]+p[2][k])*s+(2*p[0][k]-5*p[1][k]+4*p[2][k]-p[3][k])*s*s+(-p[0][k]+3*p[1][k]-3*p[2][k]+p[3][k])*s*s*s));}
export function koshienSeatPoint(u,offset,y,g){const rim=koshienBowlRim(g),legacy=t=>{const p=curve(t,rim);return{x:p[0],z:p[1]};},point=t=>realParkSeatRim(g,'koshien',((t%1)+1)%1,legacy),p=point(u),a=point(u-.00001),b=point(u+.00001),dx=b.x-a.x,dz=b.z-a.z,n=Math.hypot(dx,dz);return{x:p.x-dz/n*offset,y,z:p.z+dx/n*offset};}
export function koshienMesh(g){const a=g.architecture,surfaces=[],segments=[],lights=[],S=KOSHIEN_FACADE_SECTORS,score=a.scoreboard??defaultScoreboard(),gapStart=S/2-4,gapEnd=S/2+4,central=i=>i>=gapStart&&i<gapEnd;let tiles=0;
 const seatPoint=(u,o,y)=>koshienSeatPoint(u,o,y,g),entranceZ=seatPoint(0,57,0).z-.8;
 const face=(id,points,color,{roof=false,crowdTile=null,material=null,density=3}={})=>surfaces.push({id:'koshien-'+id+'-'+surfaces.length,points,color,roof,crowdTile,material,detailDensity:density}),
 line=(p,q,color,roof=false)=>segments.push({p,q,color,roof,detailDensity:2}),
 panel=(id,x0,x1,y0,y1,z,color,material=null)=>face(id,[{x:x0,y:y0,z},{x:x1,y:y0,z},{x:x1,y:y1,z},{x:x0,y:y1,z}],color,{material}),
 quad=(u0,u1,o0,o1,y0,y1)=>[seatPoint(u0,o0,y0),seatPoint(u1,o0,y0),seatPoint(u1,o1,y1),seatPoint(u0,o1,y1)],
 box=(id,x,z,w,d,y,h,color)=>{const p=[{x:x-w/2,y,z:z-d/2},{x:x+w/2,y,z:z-d/2},{x:x+w/2,y,z:z+d/2},{x:x-w/2,y,z:z+d/2}];face(id+'-top',p.map(p=>({...p,y:y+h})),color,{density:1});for(let i=0;i<4;i++)face(id+'-side',[p[i],p[(i+1)%4],{...p[(i+1)%4],y:y+h},{...p[i],y:y+h}],color,{density:1});};
 // Exact authored fence query; presentation-only seating never changes base geometry.
 const angles=[...new Set([...Array.from({length:129},(_,i)=>-Math.PI+i*TAU/128),...g.vertices.map(p=>p.angleDegrees*Math.PI/180)])].sort((a,b)=>a-b);
 for(let i=0;i<angles.length-1;i++){const p=wallAt(g,angles[i]),q=wallAt(g,angles[i+1]);face('fence',[{...p.position,y:0},{...q.position,y:0},{...q.position,y:q.heightMeters},{...p.position,y:p.heightMeters}],'#1b4d3d',{density:2});}
 // Broad bowl, divided into the low seats, middle cross-aisle and upper seats.
 const bands=[{offset:1,depth:12,y:2,rise:4.7,rows:10},{offset:15,depth:18,y:7.2,rise:9.8,rows:18},{offset:36,depth:17,y:18,rise:11,rows:18}];
 for(let i=0;i<S;i++){const u0=i/S,u1=(i+1)/S,back=i<18||i>=66,alps=(i>=18&&i<28)||(i>=56&&i<66),seatColor=back?'#456958':alps?'#718575':'#597c68';
  if(central(i))continue;
  for(const [tier,d]of bands.entries()){
   const aisle=i%4===0,split=u0+(u1-u0)*.28,start=aisle?split:u0;
   for(let b=0;b<4;b++){const v0=b/4,v1=(b+1)/4;face('seats',quad(start,u1,d.offset+d.depth*v0,d.offset+d.depth*v1,d.y+d.rise*v0,d.y+d.rise*v1),seatColor,{crowdTile:{id:i*12+tier*4+b,tier,band:b,sector:i,seatTint:seatColor,fanZone:koshienFanZone(i,tier)}});tiles++;
    if(aisle)face('stairs',quad(u0,split,d.offset+d.depth*v0,d.offset+d.depth*v1,d.y+d.rise*v0,d.y+d.rise*v1),'#a4a48c');}
   for(let row=1;row<d.rows;row++){const v=row/d.rows;line(seatPoint(start,d.offset+d.depth*v,d.y+d.rise*v),seatPoint(u1,d.offset+d.depth*v,d.y+d.rise*v),'#27493c');}
   face('walkway',quad(u0,u1,d.offset-1.7,d.offset,d.y-.1,d.y),'#747e6a');
   const p=seatPoint(u0,d.offset,d.y),q=seatPoint(u1,d.offset,d.y);face('fascia',[{...p,y:p.y-1.1},{...q,y:q.y-1.1},q,p],'#3b5e4a');line(p,q,'#a6b2a0');
  }
  // Continuous rear concourse and climbing ivy wall, with the same fine dot substrate.
  face('rear-walk',quad(u0,u1,53,57,29,29),'#7d8477');
  const lo0=seatPoint(u0,57,0),lo1=seatPoint(u1,57,0),hi0={...lo0,y:29},hi1={...lo1,y:29};
  const mid0={...lo0,y:17},mid1={...lo1,y:17};
  face('outer-wall',[lo0,lo1,mid1,mid0],'#a59e87',{material:a.details?.ornaments!==false?'koshien:ivy:'+i:null});
  face('outer-upper',[mid0,mid1,hi1,hi0],'#a59e87',{material:a.details?.ornaments!==false?'koshien:facade:'+i:null});line(hi0,hi1,'#9da999');
  if([7,18,27,42,57,66,77].includes(i)){const u=i/S,p0=seatPoint(u-.005,60,0),p1=seatPoint(u+.005,60,0),q0={...p0,y:31},q1={...p1,y:31};
   face('pier',[p0,p1,q1,q0],'#b1a68a');for(const [p,q,side]of [[p0,q0,-1],[p1,q1,1]]){const inner=seatPoint(u+side*.005,57,0);face('pier-side',[p,inner,{...inner,y:31},q],'#8c856f');}
   face('pier-cap',[q0,q1,seatPoint(u+.005,57,31),seatPoint(u-.005,57,31)],'#c1b9a0');}
  if(back){
   face('roof',quad(u0,u1,17,59,33,37.5),'#a8b3b3',{roof:true,material:'koshien:roof'});
   face('roof-under',quad(u0,u1,17,59,32.6,37.1),'#152623',{roof:true});
   const p=seatPoint(u0,17,32.5),q=seatPoint(u1,17,32.5);line(p,q,'#b5c3bd',true);
   if(i%2===0){line(p,seatPoint(u0,59,36.9),'#68796e',true);line(seatPoint(u0,57,20),seatPoint(u0,59,37),'#5b6f61',true);}
   for(const offset of [28,41,53]){const y=32.6+(offset-17)*4.5/42;line(seatPoint(u0,offset,y-.04),seatPoint(u1,offset,y-.04),'#3e5149',true);}
   if(i%3!==0)line({...p,y:33.1},{...q,y:33.1},'#ece9cf',true);
  }
 }
 // Walk-up apron joins the bowl and the authored foul fence.
 for(let i=0;i<S;i++){if(central(i))continue;const p=seatPoint(i/S,0,0),q=seatPoint((i+1)/S,0,0),wp=wallAt(g,Math.atan2(p.x,p.z)),wq=wallAt(g,Math.atan2(q.x,q.z));face('apron',[{...wp.position,y:0},{...wq.position,y:0},q,p],'#485c3d',{density:1});}
 // The central curtain leans back to the canopy; both viewpoints see the same world net.
 const net={...KOSHIEN_NET,panels:[]},netPoint=angle=>({...wallAt(g,angle*Math.PI/180).position,y:g.vertices[0].heightMeters}),upperZ=seatPoint(0,17,32).z,
  upper=p=>({x:p.x,y:KOSHIEN_NET.heightMeters,z:upperZ});
 for(let i=0;i<KOSHIEN_NET.panelCount;i++){const angle=145+i*70/KOSHIEN_NET.panelCount,p=netPoint(angle),q=netPoint(angle+70/KOSHIEN_NET.panelCount);net.panels.push({p,q,topP:upper(p),topQ:upper(q),topY:KOSHIEN_NET.heightMeters});}
 for(let i=0;i<=KOSHIEN_NET.panelCount;i++){const p=i<KOSHIEN_NET.panelCount?net.panels[i].p:net.panels.at(-1).q,top=upper(p);
  if(i%2===0){segments.push({id:'koshien-net-support',p,q:top,color:'#607c79',alpha:.5,detailDensity:4});segments.push({id:'koshien-net-tie',p:top,q:{...top,y:33},color:'#69756b',alpha:.42,detailDensity:4});}
  if(i<KOSHIEN_NET.panelCount){const panel=net.panels[i];segments.push({id:'koshien-net-top',p:top,q:panel.topQ,color:'#768070',alpha:.48,detailDensity:4});
   for(const t of [.25,.5,.75]){const p={x:panel.p.x,y:panel.p.y+(top.y-panel.p.y)*t,z:panel.p.z+(top.z-panel.p.z)*t},q={x:panel.q.x,y:panel.q.y+(top.y-panel.q.y)*t,z:panel.q.z+(top.z-panel.q.z)*t};segments.push({id:'koshien-net-cross',p,q,color:'#4e6867',alpha:.4,detailDensity:4});}
  }
 }
 for(const side of [-1,1]){const p={x:side*29,y:1.8,z:7},q={x:side*45,y:1.8,z:30};face('dugout',[p,q,{...q,x:q.x+side*4,z:q.z-3},{...p,x:p.x+side*4,z:p.z-3}],'#245c47');line(p,q,'#b1bea9');const w=wallAt(g,side*Math.PI/4);line({...w.position,y:0},{...w.position,y:31},'#d5b83f');}
 // Wide black board and a stepped clock/BSO tower, proportioned from the supplied photos.
 const board=KOSHIEN_BOARD,z=board.z;
 const front=wallAt(g,0).distanceMeters+1;
 // The screen is part of a solid ground-to-board building, not a panel over seats.
 box('backscreen-plinth',0,z,board.width,16,0,board.baseY,'#234d3c');
 box('backscreen-rear',0,168,64,32,0,9,'#244638');
 box('backscreen-lower',0,(front+136)/2,26,136-front,0,6.2,'#183d30');
 panel('backscreen-eye',-13,13,0,6.2,front-.03,'#14362c','koshien:backscreen');
 face('backscreen-terrace',[{x:-31,y:6.3,z:127},{x:31,y:6.3,z:127},{x:31,y:6.3,z:136},{x:-31,y:6.3,z:136}],'#29523e');
 for(const side of [-1,1]){
  const edge=side<0?gapStart/S:gapEnd/S,inside=edge-side*.006;
  for(const d of bands){const p=seatPoint(edge,d.offset,d.y),q=seatPoint(edge,d.offset+d.depth,d.y+d.rise);
   face('backscreen-seat-end',[{...p,y:0},{...q,y:0},q,p],'#234b3a');
   for(let row=0;row<d.rows;row++){const v0=row/d.rows,v1=(row+1)/d.rows,o0=d.offset+d.depth*v0,o1=d.offset+d.depth*v1,y0=d.y+d.rise*v0,y1=d.y+d.rise*v1;
    face('backscreen-stair',quad(Math.min(edge,inside),Math.max(edge,inside),o0,o1,y1,y1),'#627d68');
    const a0=seatPoint(edge,o0,y0),a1=seatPoint(inside,o0,y0);face('backscreen-stair-riser',[a0,a1,{...a1,y:y1},{...a0,y:y1}],'#355843');
   }
   for(const u of [edge,inside]){const p=seatPoint(u,d.offset,d.y+1),q=seatPoint(u,d.offset+d.depth,d.y+d.rise+1);line(p,q,'#8aa391');for(let j=0;j<=3;j++){const t=j/3,r=seatPoint(u,d.offset+d.depth*t,d.y+d.rise*t);line(r,{...r,y:r.y+1},'#779380');}}
  }
  // Short stairs climb beside the lower black screen to the cross-walk.
  const x0=side<0?-18:14,x1=x0+4;for(let row=0;row<18;row++){const z0=front+(136-front)*row/18,z1=front+(136-front)*(row+1)/18,y=6.3*(row+1)/18;
   face('backscreen-stair',[{x:x0,y,z:z0},{x:x1,y,z:z0},{x:x1,y,z:z1},{x:x0,y,z:z1}],'#58765f');panel('backscreen-step',x0,x1,6.3*row/18,y,z0,'#244b37');}
  for(const x of [x0,x1]){line({x,y:1,z:front},{x,y:7.3,z:136},'#90a797');for(let row=0;row<=6;row++){const t=row/6,p={x,y:6.3*t,z:front+(136-front)*t};line(p,{...p,y:p.y+1},'#789783');}}
  const x=side*15.8;panel('backscreen-flank',x-2,x+2,0,6.2,front+.1,'#214c39');
  if(a.details?.logos!==false)panel('backscreen-sankyu-side',x-1.1,x+1.1,3.25,6.1,front+.08,'#214c39','koshien:sankyu-side');
 }
 if(a.details?.logos!==false)panel('backscreen-sankyu',-10.5,10.5,3.25,5.95,front-.06,'#dfe5dc','koshien:sankyu');
 box('score-body',0,z+1.3,board.width,2.6,board.baseY,board.bodyHeight,'#2b3434');
 panel('score-display',-board.screenWidth/2,board.screenWidth/2,10.1,28.9,z-.08,score.enabled?'#080d0e':'#101817',score.enabled?'koshien:score':null);
 box('score-cap',0,z+1,64,3,29.8,.65,'#3c4543');
 box('clock-shoulders',0,z+1.4,14,2.8,30,7.5,'#293334');box('clock-tower',0,z+1.5,8.8,3,30,14,'#293334');
 panel('clock-face',-4.1,4.1,30.1,43.7,z-.12,'#222b2d','koshien:clock');box('clock-cap',0,z+1.5,10,3.8,44,.65,'#424c48');
 for(const [x,h]of [[-27,39],[-13,48],[0,56],[13,48],[27,39]]){line({x,y:30,z:z+1},{x,y:h,z:z+1},'#8d9a91');const width=x===0?6:5,height=x===0?4:3;
  face('flag',[{x:x-width,y:h-.25,z:z+1.2},{x,y:h,z:z+1},{x,y:h-height,z:z+1},{x:x-width,y:h-height-.25,z:z+1.7}],'#737d70',{material:x===0?'koshien:flag-japan':x===27?'koshien:flag-team':'koshien:flag-club'});
 }
 if(a.details?.logos!==false)panel('vision-sign',-27,27,6.5,8.8,135.94,'#244b3b','koshien:vision');
 // Four lattice towers plus the two roof-light arcs; no extra tower behind home.
 for(const [x,z]of [[-101,70],[101,70],[-67,139],[67,139]]){const y=49;for(const dx of [-3.3,3.3]){line({x:x+dx,y:1,z},{x:x+dx*.72,y,z},'#98a49a');line({x:x+dx,y:1,z:z+2},{x:x+dx*.72,y,z:z+2},'#748e7c');}
  for(let h=5;h<49;h+=5){line({x:x-3,y:h,z},{x:x+3,y:h+5,z},'#768d7d');line({x:x+3,y:h,z},{x:x-3,y:h+5,z},'#768d7d');}
  panel('tower-ad',x-3,x+3,25,40,z-.2,'#356454','koshien:tower');panel('light-rack',x-11,x+11,y,y+4,z,'#a5b3a6');for(let i=0;i<14;i++)for(let row=0;row<2;row++)panel('lamp',x-10+i*1.48,x-9.2+i*1.48,y+.5+row*1.7,y+1.5+row*1.7,z-.1,'#ecebd4');
 }
 if(a.details?.logos!==false){panel('distance',-3,3,.4,2.5,wallAt(g,0).distanceMeters-.08,'#1b4d3d','koshien:distance');
  panel('entrance',-22,22,20,25,entranceZ,'#295544','koshien:entrance');
  for(let i=3;i<S-3;i+=4){if(i<gapEnd&&i+3>gapStart)continue;const p=seatPoint(i/S,54,31),q=seatPoint((i+3)/S,54,31);face('rim-sign',[p,q,{...q,y:34},{...p,y:34}],i%3===0?'#b9b59c':'#315b48',{material:'koshien:wall'});
   const bp=seatPoint(i/S,54.15,31),bq=seatPoint((i+3)/S,54.15,31);face('rim-sign-back',[bp,bq,{...bq,y:34},{...bp,y:34}],'#3b5144');}
 }
 // Curved entry portal at home, kept attached to the outside wall.
 for(let i=-2;i<=2;i++){const x=i*9;panel('gate-door',x-2.7,x+2.7,0,3,entranceZ,'#183d30');for(let j=0;j<12;j++){const a=j*Math.PI/12,b=(j+1)*Math.PI/12,p={x:x+2.7*Math.cos(a),y:3+2.1*Math.sin(a),z:entranceZ},q={x:x+2.7*Math.cos(b),y:3+2.1*Math.sin(b),z:entranceZ};face('gate-arch',[{x,y:3,z:entranceZ},p,q],'#183d30');line(p,q,'#9cae96');}for(const side of [-1,1])line({x:x+side*2.7,y:0,z:entranceZ},{x:x+side*2.7,y:3,z:entranceZ},'#9cae96');}
 // Low urban masses and broad green patches, not isolated tree silhouettes.
 face('surroundings',[{x:-205,y:-1,z:-145},{x:205,y:-1,z:-145},{x:205,y:-1,z:225},{x:-205,y:-1,z:225}],'#202e2a',{density:1});
 for(const [x,z,w,d,h]of [[-156,26,30,28,17],[156,34,26,30,19],[-139,121,27,24,25],[139,130,29,22,23],[-80,195,25,22,22],[-35,207,28,27,31],[32,204,25,22,26],[84,196,30,23,18]])box('city',x,z,w,d,-1,h,'#394640');
 face('road',[{x:-190,y:2,z:-112},{x:190,y:2,z:-112},{x:190,y:2,z:-124},{x:-190,y:2,z:-124}],'#394641',{density:1});for(const z of [-115,-121])line({x:-190,y:2.05,z},{x:190,y:2.05,z},'#6f7b70');
 return{surfaces,segments,lights,net,capacity:a.capacity,tiers:3,rowsPerTier:46,outerOffset:57,spectatorTiles:tiles,spectatorLights:0,lightTowers:4,seating:{decks:3,rows:46},
  envelope:{rx:139,rz:155,centerZ:44,frontZ:entranceZ-1,bowlTop:29,eaveY:33,topY:56,exponent:2},roof:{type:'fixed_canopy',openingPercent:100,y:37.5,innerOffset:17,outerOffset:59},
  scoreboard:{enabled:score.enabled,mode:'DESIGN_SAMPLE',layout:'koshien_split_black',capabilities:scoreboardCapabilities(a.style),fieldDiagram:scoreboardFieldDiagram(a),z,baseY:board.baseY,scale:.55,width:board.width,bodyHeight:board.bodyHeight,clock:{mode:'DISPLAY_SAMPLE',bso:{balls:score.balls,strikes:score.strikes,outs:score.outs}},teams:score.teams.map(t=>({...t,runs:runs(t)})),balls:score.balls,strikes:score.strikes,outs:score.outs,speedKmh:score.speedKmh}};
}
