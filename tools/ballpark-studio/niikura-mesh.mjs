import {wallAt} from './model.mjs';import {defaultScoreboard,runs} from './scoreboard.mjs';import {niikuraMosaic,mixNiikura} from './niikura-materials.mjs';
import {niikuraFacilityLayout,facilityBayAt,mirroredNiikuraMaterial} from './niikura-facility-layout.mjs';
import {cubicPoint,niikuraFoulSeatPoint} from './niikura-infield.mjs';
const TAU=2*Math.PI;
function rim(g){const back=wallAt(g,Math.PI).distanceMeters+.5,shoulder=-Math.min(13,back-6),cf=wallAt(g,0).distanceMeters+8,wing=wallAt(g,Math.PI/4).distanceMeters/Math.sqrt(2);return[[0,-back],[28,shoulder],[46,32],[wing+10,77],[61,cf-24],[32,cf-2],[0,cf],[-32,cf-2],[-61,cf-24],[-wing-10,77],[-46,32],[-28,shoulder]];}
function curve(u,points){const n=points.length,t=((u%1+1)%1)*n,i=Math.floor(t),s=t-i,p=[-1,0,1,2].map(k=>points[(i+k+n)%n]);return[0,1].map(k=>.5*((2*p[1][k])+(-p[0][k]+p[2][k])*s+(2*p[0][k]-5*p[1][k]+4*p[2][k]-p[3][k])*s*s+(-p[0][k]+3*p[1][k]-3*p[2][k]+p[3][k])*s*s*s));}
function seatRim(g,u){u=((u%1)+1)%1;const r=rim(g);if(u>=.25&&u<=.75){const p=curve(u,r);return{x:p[0],z:p[1]};}
 const sign=u>.75?-1:1,t=sign<0?1-u:u;if(t<=1/6)return niikuraFoulSeatPoint(g,t,sign);
 const start=1/6,end=.25,span=end-start,a=niikuraFoulSeatPoint(g,start,sign),prev=niikuraFoulSeatPoint(g,start-1e-5,sign),q=curve(sign<0?1-end:end,r),next=curve(sign<0?1-end-1e-5:end+1e-5,r),b={x:q[0],z:q[1]},c1={x:a.x+(a.x-prev.x)/1e-5*span/3,z:a.z+(a.z-prev.z)/1e-5*span/3},c2={x:b.x-(next[0]-b.x)/1e-5*span/3,z:b.z-(next[1]-b.z)/1e-5*span/3};return cubicPoint(a,c1,c2,b,(t-start)/span);
}
export function niikuraSeatPoint(g,u,offset,y){const p=seatRim(g,u),a=seatRim(g,u-.00001),b=seatRim(g,u+.00001),dx=b.x-a.x,dz=b.z-a.z,n=Math.hypot(dx,dz);return{x:p.x+dz/n*offset,y,z:p.z-dx/n*offset};}
export function niikuraMesh(g){const a=g.architecture,c=a.colors,N=96,surfaces=[],segments=[],lights=[],illuminationFixtures=[],boards=[],score=a.scoreboard??defaultScoreboard();let tiles=0;
 const p=(u,o,y)=>niikuraSeatPoint(g,u,o,y),face=(id,points,color,{material=null,crowdTile=null,roof=false,detailDensity=3}={})=>surfaces.push({id:'niikura-'+id+'-'+surfaces.length,points,color,material,crowdTile,roof,detailDensity}),
 line=(id,p,q,color,roof=false,density=2)=>segments.push({id:'niikura-'+id,p,q,color,roof,detailDensity:density}),
 quad=(u0,u1,o0,o1,y0,y1)=>[p(u0,o0,y0),p(u1,o0,y0),p(u1,o1,y1),p(u0,o1,y1)],
 strip=(id,u0,u1,o,y0,y1,color,material=null)=>face(id,[p(u0,o,y0),p(u1,o,y0),p(u1,o,y1),p(u0,o,y1)],color,{material}),
 tube=(id,path,r,color,sides=5)=>{const rings=path.map((v,i)=>{const prev=path[Math.max(0,i-1)],next=path[Math.min(path.length-1,i+1)],dx=next.x-prev.x,dy=next.y-prev.y,dz=next.z-prev.z,n=Math.hypot(dx,dy,dz),t={x:dx/n,y:dy/n,z:dz/n},h=Math.hypot(t.x,t.y)||1,b={x:-t.y/h,y:t.x/h,z:0},d={x:-t.z*b.y,y:t.z*b.x,z:t.x*b.y-t.y*b.x};return Array.from({length:sides},(_,j)=>{const co=Math.cos(j*TAU/sides)*r,si=Math.sin(j*TAU/sides)*r;return{x:v.x+b.x*co+d.x*si,y:v.y+b.y*co+d.y*si,z:v.z+b.z*co+d.z*si};});});for(let i=0;i<rings.length-1;i++)for(let j=0;j<sides;j++)face(id,[rings[i][j],rings[i][(j+1)%sides],rings[i+1][(j+1)%sides],rings[i+1][j]],color,{detailDensity:id.startsWith('arch')?3:2});};
 // The authored playing fence stays on the same geometry query as the renderer.
 const facilities=niikuraFacilityLayout(g,p);
 const angles=[...new Set([...Array.from({length:97},(_,i)=>-Math.PI+i*TAU/96),...g.vertices.map(v=>v.angleDegrees*Math.PI/180)])].sort((a,b)=>a-b);
 for(let i=0;i<angles.length-1;i++){const x=wallAt(g,angles[i]),y=wallAt(g,angles[i+1]);face('wall',[{...x.position,y:0},{...y.position,y:0},{...y.position,y:y.heightMeters},{...x.position,y:x.heightMeters}],c.red);line('wall-cap',{...x.position,y:x.heightMeters},{...y.position,y:y.heightMeters},c.blue);}
 for(let i=0;i<N;i++){const q0=p(i/N,0,.02),q1=p((i+1)/N,0,.02),w0=wallAt(g,Math.atan2(q0.x,q0.z)),w1=wallAt(g,Math.atan2(q1.x,q1.z));face('apron',[{...w0.position,y:.02},{...w1.position,y:.02},q1,q0],mixNiikura(c.red,c.gold,.08));face('seat-base',[q0,q1,{...q1,y:2},{...q0,y:2}],c.red);}
 const tiers=[{offset:0,depth:23,y:2,rise:11,bands:8},{offset:27,depth:28,y:19.5,rise:17,bands:10}];
 for(let tier=0;tier<2;tier++){const d=tiers[tier];for(let i=0;i<N;i++){const u0=i/N,u1=(i+1)/N,bay=facilityBayAt(facilities,i),start=u0+(i%6===0?.0015:0),end=u1-((i+1)%6===0?.0015:0);
   if(tier===1&&bay||tier===0&&(bay?.id==='main'||facilities.stairs.includes(i)))continue;
   for(let band=0;band<d.bands;band++){const v0=band/d.bands,v1=(band+1)/d.bands,tint=niikuraMosaic(Math.min((u0+u1)/2,1-(u0+u1)/2),(band+.5)/d.bands,c);
    face('seats-'+tier,quad(start,end,d.offset+d.depth*v0,d.offset+d.depth*v1,d.y+d.rise*v0,d.y+d.rise*v1),tint,{crowdTile:{id:tiles++,tier,band,sector:i,seatTint:tint}});
    for(const [a,b]of [[u0,start],[end,u1]])if(b>a)face('aisle-'+tier,quad(a,b,d.offset+d.depth*v0,d.offset+d.depth*v1,d.y+d.rise*v0,d.y+d.rise*v1),mixNiikura(c.red,c.gold,.14));
   }
   strip('seat-fascia',u0,u1,d.offset,d.y-1.1,d.y,c.red);face('seat-underside',quad(u0,u1,d.offset,d.offset+d.depth+3,d.y-.7,d.y+d.rise-.7),'#637963');
   for(let row=1;row<=d.bands;row++)line('row',p(start,d.offset+d.depth*row/d.bands,d.y+d.rise*row/d.bands),p(end,d.offset+d.depth*row/d.bands,d.y+d.rise*row/d.bands),mixNiikura(c.red,c.gold,.24),false,1);
  }}
 // One middle hospitality band, with green structure and warm glass suites.
 for(let i=0;i<N;i++){const u0=i/N,u1=(i+1)/N,bay=facilityBayAt(facilities,i);
  if(!bay){strip('score-vip',u0,u1,25,13.5,18.7,c.red,mirroredNiikuraMaterial('vip',i));strip('mosaic-fascia',u0,u1,26,18.7,19.5,c.blue,mirroredNiikuraMaterial('mosaic',i));}
  strip('facade',u0,u1,60,i<4||i>91?7:0,37,c.red,mirroredNiikuraMaterial('mosaic',i));if(i<20||i>75)strip('score-exterior-glass',u0,u1,60.2,8,20,c.red,mirroredNiikuraMaterial('vip',i));
  face('facade-foot',quad(u0,u1,60,65,.05,.05),'#7b8877');
  if(i%4===0)tube('yellow-column',[p(u0,60,0),p(u0,60,44+5*Math.cos(u0*TAU*2+.3))],.6,c.blue,4);
  if(i%6===0){const f=p(u0,64,1.1),target=p(u0,60,26);illuminationFixtures.push({...f,target,kind:'facade',power:.9});face('lamp-wallwasher',[{...f,x:f.x-.4},{...f,x:f.x+.4},{...f,x:f.x+.4,y:1.7},{...f,x:f.x-.4,y:1.7}],c.gold);}
 }
 // Reserved display pavilions replace the former seats and continuous suite strip.
 for(const bay of facilities.bays){const u0=bay.start/N,u1=bay.end/N,front=bay.id==='main'?0:23,base=facilities.podiumY;
  for(let i=bay.start;i<bay.end;i++){
   face('facility-'+bay.id+'-floor',quad(i/N,(i+1)/N,front,55,base,base),c.red);
   strip('facility-'+bay.id+'-base',i/N,(i+1)/N,front,0,9.7,c.red);
   strip('facility-'+bay.id+'-lintel',i/N,(i+1)/N,front,12.6,base,c.blue);
   strip('facility-'+bay.id+'-gallery',i/N,(i+1)/N,front,9.7,12.6,c.red,mirroredNiikuraMaterial('vip',i));
   strip('facility-'+bay.id+'-rear',i/N,(i+1)/N,55,base,bay.topY,c.red,mirroredNiikuraMaterial('mosaic',i));
   face('facility-'+bay.id+'-canopy',quad(i/N,(i+1)/N,27,55,bay.topY,bay.topY),c.gold);
  }
  for(const u of [u0,u1]){face('facility-'+bay.id+'-cheek',[p(u,front,base),p(u,55,base),p(u,55,bay.topY),p(u,27,bay.topY)],c.red);tube('facility-'+bay.id+'-pier',[p(u,27,base),p(u,27,bay.topY)],.45,c.blue,4);}
 }
 for(const i of facilities.stairs){const u0=i/N,u1=(i+1)/N;for(let step=0;step<64;step++){const o0=23*step/64,o1=23*(step+1)/64,y=2+11*(step+1)/64;face('facility-main-stair',quad(u0,u1,o0,o1,y,y),c.gold,{detailDensity:2});strip('facility-main-riser',u0,u1,o0,y-11/64,y,c.red);}for(const u of [u0,u1])line('facility-main-handrail',p(u,0,3),p(u,23,14),c.blue,false,2);}
 for(const [index,u]of [.04,.16,.84,.96].entries()){const center=p(u,62,0),r=6.5,top=41;
  for(let j=0;j<16;j++){const angle=j*TAU/16,next=(j+1)*TAU/16,a={x:center.x+r*Math.cos(angle),y:0,z:center.z+r*Math.sin(angle)},b={x:center.x+r*Math.cos(next),y:0,z:center.z+r*Math.sin(next)};face('mosaic-tower',[a,b,{...b,y:top},{...a,y:top}],c.red,{material:'niikura:mosaic:'+((index+j/16)/4*96)});face('tower-cap',[{...center,y:top+.2},{...a,y:top+.2},{...b,y:top+.2}],c.gold,{detailDensity:1});}
 }
 // Wavy membrane ring: a true open aperture, not a transparent closed dome.
 const innerY=u=>43+3*Math.cos(u*TAU*2),outerY=u=>44+5*Math.cos(u*TAU*2+.3);
 for(let i=0;i<N;i++){const u0=i/N,u1=(i+1)/N;for(let band=0;band<3;band++){const v0=band/3,v1=(band+1)/3,point=(u,v)=>p(u,16+49*v,innerY(u)*(1-v)+outerY(u)*v);
   face('membrane',[point(u0,v0),point(u1,v0),point(u1,v1),point(u0,v1)],c.gold,{material:'niikura:membrane',roof:true,detailDensity:2});}
  if(i%2===0){line('roof-rib',p(u0,16,innerY(u0)-.4),p(u0,65,outerY(u0)-.4),c.red,true,2);line('roof-cross',p(u0,16,innerY(u0)-.5),p(u1,65,outerY(u1)-.5),c.blue,true,2);}
  line('roof-inner',p(u0,16,innerY(u0)),p(u1,16,innerY(u1)),c.red,true,2);line('roof-outer',p(u0,65,outerY(u0)),p(u1,65,outerY(u1)),c.blue,true,2);
  if(i%8===0){const f=p(u0,21,innerY(u0)-2.1);illuminationFixtures.push({...f,target:{x:0,y:0,z:55},kind:'field',power:1});const tangent={x:Math.cos(u0*TAU),z:Math.sin(u0*TAU)};
   for(let row=0;row<2;row++)face('lamp-bank',[{x:f.x-tangent.x*4,y:f.y+row*.9,z:f.z-tangent.z*4},{x:f.x+tangent.x*4,y:f.y+row*.9,z:f.z+tangent.z*4},{x:f.x+tangent.x*4,y:f.y+row*.9+.6,z:f.z+tangent.z*4},{x:f.x-tangent.x*4,y:f.y+row*.9+.6,z:f.z-tangent.z*4}],c.gold);
  }
 }
 // A single tilted lattice arch, with two rails forming its structural depth.
 const arch=Array.from({length:49},(_,i)=>{const t=i*Math.PI/48;return{x:-164*Math.cos(t),y:40+98*Math.sin(t),z:66+48*Math.sin(t)};});
 const archGreen=mixNiikura(c.red,'#00150c',.82);
 for(const side of [-1,1])tube('arch-support-leg',[{x:side*164,y:0,z:66},{x:side*164,y:40,z:66}],2,archGreen);
 tube('arch-green-front',arch.map(p=>({...p,z:p.z-2.8})),1.05,archGreen);tube('arch-green-back',arch.map(p=>({...p,z:p.z+2.8})),1.05,archGreen);
 for(let i=0;i<48;i+=2){tube('arch-yellow-web',[{...arch[i],z:arch[i].z-2.8},{...arch[i+2],z:arch[i+2].z+2.8}],.38,c.blue,4);tube('arch-yellow-web',[{...arch[i],z:arch[i].z+2.8},{...arch[i+2],z:arch[i+2].z-2.8}],.38,c.blue,4);}
 for(let i=4;i<46;i+=4){const v=arch[i],u=.5-v.x/656;line('arch-cable',v,p(u,55,outerY(u)),mixNiikura(c.gold,c.red,.25),false,1);}
 for(const side of [-1,1]){const f={x:side*161,y:2,z:67};illuminationFixtures.push({...f,target:{x:side*85,y:117,z:108},kind:'facade',power:1.8});face('lamp-arch',[{...f,x:f.x-.7},{...f,x:f.x+.7},{...f,x:f.x+.7,y:3},{...f,x:f.x-.7,y:3}],c.gold);}
 // Four independent monitors facing the diamond, with solid backs and posts.
 for(const board of facilities.monitors){const {index,width:w,height:h}=board,v={x:board.x,y:board.baseY,z:board.z},n=Math.hypot(v.x,v.z),tx=v.z/n,tz=-v.x/n,point=(sign,y,back=0)=>({x:v.x+tx*w/2*sign+v.x/n*back,y,z:v.z+tz*w/2*sign+v.z/n*back});
  face('score-screen-'+index,[point(-1,v.y),point(1,v.y),point(1,v.y+h),point(-1,v.y+h)],'#092d20',{material:(score.niikura?.monitors??true)?'niikura:video:'+index:null});
  face('monitor-back',[point(1,v.y,1),point(-1,v.y,1),point(-1,v.y+h,1),point(1,v.y+h,1)],c.red);
  for(const s of [-1,1]){face('monitor-side',[point(s,v.y),point(s,v.y,1),point(s,v.y+h,1),point(s,v.y+h)],c.blue);tube('monitor-post',[point(s*.55,facilities.podiumY),point(s*.55,v.y)],.4,c.red,4);}
  boards.push({index,x:v.x,z:v.z,baseY:v.y,width:w,height:h});
 }
 // The main board shares the home-to-center axis and its reserved central pavilion.
 const mainBoard=facilities.mainBoard,v={x:mainBoard.x,y:mainBoard.baseY,z:mainBoard.z},n=Math.hypot(v.x,v.z),tx=v.z/n,tz=-v.x/n,point=(sign,y,back=0)=>({x:v.x+tx*mainBoard.width/2*sign+v.x/n*back,y,z:v.z+tz*mainBoard.width/2*sign+v.z/n*back}),h=mainBoard.height,gold=mixNiikura(c.blue,c.gold,.22);
 face('score-screen-main',[point(-1,v.y),point(1,v.y),point(1,v.y+h),point(-1,v.y+h)],'#092d20',{material:score.enabled?'niikura:main-scoreboard':null});
 face('facility-main-housing-back',[point(1,v.y,1),point(-1,v.y,1),point(-1,v.y+h,1),point(1,v.y+h,1)],c.red);
 const frame=(id,s0,s1,y0,y1)=>face(id,[point(s0,y0,-.12),point(s1,y0,-.12),point(s1,y1,-.12),point(s0,y1,-.12)],gold,{detailDensity:3});
 frame('score-frame-bottom',-1.04,1.04,v.y-.65,v.y+.12);frame('score-frame-top',-1.04,1.04,v.y+h-.12,v.y+h+.65);
 for(const side of [-1,1]){frame('score-frame-side',side<0?-1.04:1,side<0?-1:1.04,v.y,v.y+h);face('score-housing-side',[point(side,v.y),point(side,v.y,1),point(side,v.y+h,1),point(side,v.y+h)],c.blue);tube('score-column',[point(side*1.065,facilities.podiumY,-.05),point(side*1.065,v.y+h+.9,-.05)],.75,c.red,4);for(let y=16;y<v.y+h;y+=6)line('score-column-ring',point(side*1.065-.025,y,-.9),point(side*1.065+.025,y,-.9),gold,false,3);}
 if(a.details?.ornaments!==false)tube('score-crown',[point(-1.04,v.y+h+.7),point(0,v.y+h+2),point(1.04,v.y+h+.7)],.24,gold,4);
 const center=wallAt(g,0);face('batter-eye',[{x:-9,y:0,z:center.position.z+2},{x:9,y:0,z:center.position.z+2},{x:9,y:9,z:center.position.z+2},{x:-9,y:9,z:center.position.z+2}],c.red);
 const front=p(0,60,0).z,entryZ=front-10.5;
 face('score-entry',[{x:-23,y:9.5,z:entryZ},{x:23,y:9.5,z:entryZ},{x:23,y:15.5,z:entryZ},{x:-23,y:15.5,z:entryZ}],c.red,{material:a.details?.logos===false?null:'niikura:entry'});
 face('entry-canopy',[{x:-27,y:8.3,z:front+1},{x:27,y:8.3,z:front+1},{x:27,y:8.3,z:front-10},{x:-27,y:8.3,z:front-10}],c.gold);
 face('lamp-entry-canopy',[{x:-27,y:7.7,z:front-10},{x:27,y:7.7,z:front-10},{x:27,y:8.3,z:front-10},{x:-27,y:8.3,z:front-10}],c.blue);
 for(let i=0;i<5;i++){const x=-21+i*8.5;face('score-entry-doors',[{x,y:.75,z:front-.4},{x:x+7.5,y:.75,z:front-.4},{x:x+7.5,y:7,z:front-.4},{x,y:7,z:front-.4}],c.red,{material:'niikura:doors'});}
 for(const x of [-25,-16.5,-8,8,16.5,25])tube('entry-column',[{x,y:.75,z:front-8},{x,y:8.3,z:front-8}],.45,c.blue,4);
 for(let i=0;i<3;i++){const y=(3-i)*.25,z=front-10-i*2;face('entry-step',[{x:-29,y,z},{x:29,y,z},{x:29,y,z:z-2},{x:-29,y,z:z-2}],mixNiikura(c.gold,c.blue,.08));face('entry-riser',[{x:-29,y:y-.25,z:z-2},{x:29,y:y-.25,z:z-2},{x:29,y,z:z-2},{x:-29,y,z:z-2}],c.gold);}
 face('arrival-plaza',[{x:-95,y:-.03,z:front-10},{x:95,y:-.03,z:front-10},{x:95,y:-.03,z:front-50},{x:-95,y:-.03,z:front-50}],'#8d9279');
 return{surfaces,segments,lights,illuminationFixtures,capacity:a.capacity,tiers:2,rowsPerTier:tiers.map(d=>d.bands),seating:{decks:2,mosaic:true,sharedFacadePalette:true},facilities,spectatorLights:0,spectatorTiles:tiles,
 envelope:{rx:170,rz:180,centerZ:55,frontZ:-98,bowlTop:37,eaveY:44,topY:141,exponent:2},roof:{type:'open',openingPercent:100,centralAperture:true},arch:{count:1,topY:138,width:328},
 scoreboard:{enabled:score.enabled,mode:'DESIGN_SAMPLE',mainBoard,monitors:boards,boards,z:mainBoard.z,baseY:mainBoard.baseY,scale:1,width:mainBoard.width,teams:score.teams.map(t=>({...t,runs:runs(t)})),balls:score.balls,strikes:score.strikes,outs:score.outs,speedKmh:score.speedKmh}};
}
