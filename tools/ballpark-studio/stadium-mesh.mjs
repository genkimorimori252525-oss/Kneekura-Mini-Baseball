import {defaultScoreboard,runs,sampleScoreboard} from './scoreboard.mjs';
import {projectedMaterialDetail} from './material-lod.mjs';
import {sampleLogoUV} from './ground-logo.mjs';
import {blendMaterial} from './surface-layers.mjs';
import {wallAt} from './model.mjs';
import {DEFAULT_CROWD_APPEARANCE,PENLIGHT_LENGTH_METERS} from './crowd.mjs';
import {crowdAtlas,sampleCrowdTile,CROWD_TILE} from './crowd-tiles.mjs';
const TAU=Math.PI*2,cache=new WeakMap(),mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t,
 ...(a.u===undefined?{}:{u:a.u+(b.u-a.u)*t,v:a.v+(b.v-a.v)*t})});
const shade=(hex,k)=>'#'+hex.slice(1).match(/../g).map(v=>Math.min(255,Math.round(parseInt(v,16)*k)).toString(16).padStart(2,'0')).join('');

/** Real world-space architecture; no image backdrop and no changes to the fixed diamond. */
export function stadiumMesh(g){
 if(!g.architecture)return null;if(cache.has(g))return cache.get(g);
 const a=g.architecture,c=a.colors,surfaces=[],segments=[],lights=[],N=96,
  rows=Math.max(12,Math.ceil(a.capacity/(a.tiers*1000))),tierStride=rows*.68+5,
  outerOffset=7+(a.tiers-1)*tierStride+(rows-1)*.68+8,
  rimY=4+(a.tiers-1)*(rows*.52+4)+(rows-1)*.52+12,
  radial=(t,offset,y)=>{const r=wallAt(g,t).distanceMeters+offset;return {x:Math.sin(t)*r,y,z:Math.cos(t)*r};},
  seatPoint=(t,offset,y)=>radial(t,offset+7-5*Math.max(0,Math.min(1,(Math.abs(t)-Math.PI/4)/(Math.PI/12))),y),
  face=(points,color,roof=false,crowdTile=null,material=null)=>surfaces.push({id:`${material??'surface'}-${surfaces.length}`,points,color,roof,crowdTile,material}),
  line=(p,q,color,roof=false)=>segments.push({p,q,color,roof});
 // Low, solid outfield fence. Its top uses exactly the authored height query.
 const wallAngles=[...new Set([...Array.from({length:N+1},(_,i)=>-Math.PI+i*TAU/N),...g.vertices.map(p=>p.angleDegrees*Math.PI/180)])].sort((a,b)=>a-b);
 for(let i=0;i<wallAngles.length-1;i++){const t0=wallAngles[i],t1=wallAngles[i+1],w0=wallAt(g,t0),w1=wallAt(g,t1),
  p0={...w0.position,y:0},p1={...w1.position,y:0},q0={...w0.position,y:w0.heightMeters},q1={...w1.position,y:w1.heightMeters};
  face([p0,p1,q1,q0],shade(c.blue,.85));line(q0,q1,c.gold);
 }
 // Packed crowd blocks cover the existing stand quads; no individual spectator positions.
 for(let tier=0;tier<a.tiers;tier++){
  const offset=tier*tierStride,y=3+tier*(rows*.52+4);
  for(let band=0;band<4;band++)for(let i=0;i<N;i++){
   const r0=band*(rows-1)/4,r1=(band+1)*(rows-1)/4,t0=-Math.PI+i*TAU/N,t1=-Math.PI+(i+1)*TAU/N,
    color=(Math.floor(i/8)+tier)%2?c.blue:c.red;
   face([seatPoint(t0,offset+r0*.68,y+r0*.52),seatPoint(t1,offset+r0*.68,y+r0*.52),seatPoint(t1,offset+r1*.68,y+r1*.52),seatPoint(t0,offset+r1*.68,y+r1*.52)],shade(color,.65+band*.06),false,{id:tier*4*N+band*N+i,tier,band,sector:i});
  }
  for(let i=0;i<N;i++){const t0=-Math.PI+i*TAU/N,t1=-Math.PI+(i+1)*TAU/N;
   line(seatPoint(t0,offset-1,y-.4),seatPoint(t1,offset-1,y-.4),c.gold);
   line(seatPoint(t0,offset+(rows-1)*.68+1,y+(rows-1)*.52+.5),seatPoint(t1,offset+(rows-1)*.68+1,y+(rows-1)*.52+.5),c.gold);
  }
  for(let i=0;i<24;i++){const t=-Math.PI+i*TAU/24;line(seatPoint(t,offset,y),seatPoint(t,offset+(rows-1)*.68,y+(rows-1)*.52),shade(c.gold,.85));}
 }
 // Balconies have a front face and a walkway, rather than floating seating sheets.
 for(let tier=0;tier<a.tiers;tier++)for(let i=0;i<N;i++){
  const t0=-Math.PI+i*TAU/N,t1=-Math.PI+(i+1)*TAU/N,offset=tier*tierStride,y=3+tier*(rows*.52+4),
   p=seatPoint(t0,offset-1.3,y),q=seatPoint(t1,offset-1.3,y),bottom=Math.max(.3,y-3.2);
  face([{...p,y:bottom},{...q,y:bottom},q,p],shade(c.blue,.52));
  face([{...p,y:y-.25},{...q,y:y-.25},seatPoint(t1,offset+1,y-.25),seatPoint(t0,offset+1,y-.25)],shade(c.gold,.65));
  line({...p,y:y-1.1},{...q,y:y-1.1},c.gold);line(p,q,'#fff0ba');
 }
 // A closed rounded shell surrounds every stand; its shape is independent of the diamond.
 const seatVertices=surfaces.filter(s=>s.crowdTile).flatMap(s=>s.points),xs=seatVertices.map(p=>Math.abs(p.x)),zs=seatVertices.map(p=>p.z),
  centerZ=(Math.max(...zs)+Math.min(...zs))/2,rx=Math.max(...xs)+13,rz=(Math.max(...zs)-Math.min(...zs))/2+13,
  exponent=3.3,bowlTop=Math.max(...seatVertices.map(p=>p.y)),eaveY=bowlTop+8,
  shell=(t,y)=>{const sn=Math.sin(t),cs=Math.cos(t);return {x:rx*Math.sign(sn)*Math.abs(sn)**(2/exponent),y,z:centerZ+rz*Math.sign(cs)*Math.abs(cs)**(2/exponent)};},
  shellSpan=z=>rx*Math.max(0,1-Math.abs((z-centerZ)/rz)**exponent)**(1/exponent),
  frontZ=centerZ-rz,roofY=eaveY+10,z0=Math.max(frontZ+28,-95),z1=Math.min(centerZ+rz-30,wallAt(g,0).distanceMeters+28),halfX=Math.min(shellSpan(z0),shellSpan(z1))*.49,
  opening=a.roof.openingPercent/100,
  rectangle=t=>{const sx=Math.sin(t),sz=Math.cos(t),distance=Math.min(Math.abs(sx)>1e-9?halfX/Math.abs(sx):Infinity,Math.abs(sz)>1e-9?(sz>0?z1-centerZ:z0-centerZ)/sz:Infinity);return{x:sx*distance,z:centerZ+sz*distance};};
 for(let i=0;i<N;i++){
  const t0=-Math.PI+i*TAU/N,t1=-Math.PI+(i+1)*TAU/N,p=(t,y)=>shell(t,y),color=(Math.floor(i/8)%2)?c.blue:c.red;
  // Glass podium, solid facade and continuous gold belts.
  face([p(t0,0),p(t1,0),p(t1,13),p(t0,13)],i%2?'#193445':'#3e5861');
  face([p(t0,13),p(t1,13),p(t1,16),p(t0,16)],c.gold);
  face([p(t0,16),p(t1,16),p(t1,eaveY-7),p(t0,eaveY-7)],shade(color,.8),false,null,a.details?.ornaments===false?null:'facade:'+i);
  face([p(t0,eaveY-7),p(t1,eaveY-7),p(t1,eaveY),p(t0,eaveY)],shade(c.gold,.85));
  line(p(t0,0),p(t0,13),'#e7b75c');line(p(t0,6),p(t1,6),'#bd9853');
  line(p(t0,eaveY-1),p(t1,eaveY-1),'#ead39a');
  const seatEdge0=seatPoint(t0,(a.tiers-1)*tierStride+(rows-1)*.68,bowlTop),seatEdge1=seatPoint(t1,(a.tiers-1)*tierStride+(rows-1)*.68,bowlTop);
  face([seatEdge0,seatEdge1,p(t1,bowlTop),p(t0,bowlTop)],shade(c.blue,.55));
  line(p(t0,bowlTop+1),p(t1,bowlTop+1),c.gold);
  // Four radial rings form a curved fixed canopy, with integrated trusses.
  const in0=rectangle(t0),in1=rectangle(t1),out0=p(t0,eaveY),out1=p(t1,eaveY),
   canopy=(out,inner,u)=>({x:out.x+(inner.x-out.x)*u,z:out.z+(inner.z-out.z)*u,y:eaveY+10*u+3*Math.sin(u*Math.PI)});
  for(let ring=0;ring<4;ring++){
   const u=ring/4,v=(ring+1)/4;
   face([canopy(out0,in0,u),canopy(out1,in1,u),canopy(out1,in1,v),canopy(out0,in0,v)],shade('#a2b2c6',.72+.22*Math.sin(t0+.8)+ring*.035),true);
  }
  line(out0,out1,'#55aeff',true);line({...in0,y:roofY},{...in1,y:roofY},c.gold,true);
  if(i%4===0){const a0={...out0,y:eaveY-3},a1={...in0,y:roofY-3};line(a0,a1,c.gold,true);
   const mid=mix(a0,a1,.5);line({...a0,y:a0.y-4},mid,c.gold,true);line(mid,{...a1,y:a1.y-4},c.gold,true);}
 }
 // Leaves slide onto the fixed shell, staying inside its outer width even fully open.
 const leafPoint=(side,u,v)=>({x:side*halfX*(u+opening),y:roofY+5*(1-u*u)*Math.sin(v*Math.PI),z:z0+(z1-z0)*v});
 for(const side of [-1,1])for(let i=0;i<8;i++)for(let j=0;j<20;j++){
  const p=leafPoint(side,i/8,j/20),q=leafPoint(side,(i+1)/8,j/20),r=leafPoint(side,(i+1)/8,(j+1)/20),s=leafPoint(side,i/8,(j+1)/20);
  face([p,q,r,s],shade('#aab8cc',.78+i*.028+(side===-1?.08:0)),true);
  if(i===0||i===7)line(p,s,i===0?'#f1dc9e':'#69bfff',true);
  if(j%5===0)line(p,q,shade(c.gold,.85),true);
 }
 for(const z of [z0,z1]){
  const span=shellSpan(z)-1;
  line({x:-span,y:roofY-1,z},{x:span,y:roofY-1,z},c.gold,true);
  line({x:-span,y:roofY-4,z},{x:span,y:roofY-4,z},shade(c.gold,.7),true);
  for(let i=0;i<16;i++){const x=-span+i*span*2/16,dx=span*2/16;
   line({x,y:roofY-1,z},{x:x+dx/2,y:roofY-4,z},c.gold,true);line({x:x+dx/2,y:roofY-4,z},{x:x+dx,y:roofY-1,z},c.gold,true);}
 }
 // Both badges use the approved grass PNG as a world-space material, not an outline.
 const board=(z,y,w,h)=>{
  face([{x:-w/2,y,z},{x:w/2,y,z},{x:w/2,y:y+h,z},{x:-w/2,y:y+h,z}],'#101d33',false,null,a.details?.logos===false?null:'wolf');
  line({x:-w/2,y,z:z-.08},{x:-w/2,y:y+h,z:z-.08},c.gold);line({x:w/2,y,z:z-.08},{x:w/2,y:y+h,z:z-.08},c.gold);
  line({x:-w/2,y:y+h,z:z-.08},{x:w/2,y:y+h,z:z-.08},c.gold);
 };
 const score=a.scoreboard??defaultScoreboard(),scoreZ=wallAt(g,0).distanceMeters+outerOffset*.3,scoreBase=bowlTop-42,
  scoreScale=Math.min(1,Math.max(.25,(roofY-6)/59)),fittedBase=Math.max(5,Math.min(scoreBase,roofY-1-59*scoreScale)),
  panel=(x0,x1,y0,y1,z,color,material=null)=>face([{x:x0,y:y0,z},{x:x1,y:y0,z},{x:x1,y:y1,z},{x:x0,y:y1,z}],color,false,null,material);
 if(score.enabled){
  const firstFace=surfaces.length,firstSegment=segments.length;
  // Opaque housing, side cheeks and supporting columns belong to the same 3D world.
  panel(-82,82,scoreBase,scoreBase+31,scoreZ+3,'#111d30');
  for(const x of [-82,82])face([{x,y:scoreBase,z:scoreZ},{x,y:scoreBase,z:scoreZ+3},{x,y:scoreBase+31,z:scoreZ+3},{x,y:scoreBase+31,z:scoreZ}],shade(c.gold,.7));
  face([{x:-82,y:scoreBase+31,z:scoreZ},{x:82,y:scoreBase+31,z:scoreZ},{x:82,y:scoreBase+31,z:scoreZ+3},{x:-82,y:scoreBase+31,z:scoreZ+3}],c.gold);
  panel(-82,82,scoreBase,scoreBase+31,scoreZ,c.gold);
  panel(-80,80,scoreBase+1,scoreBase+30,scoreZ-.12,'#0b182b');
  panel(-77,77,scoreBase+2,scoreBase+24,scoreZ-.25,'#0b182b','scoreboard');
  panel(-77,77,scoreBase+24,scoreBase+30,scoreZ-.25,'#0b182b','scoreboard-title');
  for(const side of [-1,1]){
   const x0=side<0?-91:82,x1=x0+9;
   panel(x0,x1,scoreBase-1,scoreBase+42,scoreZ,side<0?c.red:c.blue,a.details?.ornaments===false?null:'facade:0');
   for(const x of [x0,x1])line({x,y:scoreBase-1,z:scoreZ-.1},{x,y:scoreBase+42,z:scoreZ-.1},c.gold);
   line({x:x0,y:scoreBase+42,z:scoreZ-.1},{x:x1,y:scoreBase+42,z:scoreZ-.1},c.gold);
   const x=side*66;panel(x-1.2,x+1.2,scoreBase-16,scoreBase,scoreZ+1,shade(c.gold,.7));
  }
  board(scoreZ-.3,scoreBase+30,31,27.5);
  const crest=[[-18,scoreBase+30],[-18,scoreBase+53],[0,scoreBase+59],[18,scoreBase+53],[18,scoreBase+30]];
  for(let i=1;i<crest.length;i++)line({x:crest[i-1][0],y:crest[i-1][1],z:scoreZ-.4},{x:crest[i][0],y:crest[i][1],z:scoreZ-.4},c.gold);
  if(scoreScale!==1||fittedBase!==scoreBase){const fit=p=>{p.x*=scoreScale;p.y=Math.max(0,fittedBase+(p.y-scoreBase)*scoreScale);p.z=scoreZ+(p.z-scoreZ)*scoreScale;};
   for(let i=firstFace;i<surfaces.length;i++)surfaces[i].points.forEach(fit);for(let i=firstSegment;i<segments.length;i++){fit(segments[i].p);fit(segments[i].q);}}
 }else board(wallAt(g,0).distanceMeters+outerOffset*.55,bowlTop-23,38,34);
 board(frontZ-.35,21,42,38);
 // Entrance apron and stairs remain outside playable territory.
 for(let i=0;i<8;i++){
  const z=frontZ-4-i*1.4,y=(8-i)*.32;
  face([{x:-40,y,z},{x:40,y,z},{x:40,y,z:z-1.4},{x:-40,y,z:z-1.4}],shade('#b7aa8e',.5+i*.025));
  line({x:-40,y,z},{x:40,y,z},shade(c.gold,.75));
 }
 const mesh={scoreboard:{enabled:score.enabled,mode:'DESIGN_SAMPLE',z:scoreZ,baseY:fittedBase,scale:scoreScale,width:164*scoreScale,teams:score.teams.map(t=>({...t,runs:runs(t)})),balls:score.balls,strikes:score.strikes,outs:score.outs,speedKmh:score.speedKmh},surfaces,segments,lights,capacity:a.capacity,tiers:a.tiers,rowsPerTier:rows,outerOffset,
  envelope:{rx,rz,centerZ,frontZ,bowlTop,eaveY,topY:roofY+5,exponent},
  roof:{halfX,z0,z1,y:roofY,openingPercent:a.roof.openingPercent,leftInnerEdge:opening===0?0:-opening*halfX,rightInnerEdge:opening*halfX},
  spectatorLights:0,spectatorTiles:a.tiers*4*N};
 cache.set(g,mesh);return mesh;
}

/** Rasterize on the original renderer's exact lattice and shared world depth map. */
export function renderStadium({geometry:g,project,paint,grid,cam,cutaway=false,crowd={frame:0,frames:3,visible:true}}){
 const m=stadiumMesh(g);if(!m)return null;
 const appearance=g.architecture.crowd??DEFAULT_CROWD_APPEARANCE,palette=[g.architecture.colors.red,g.architecture.colors.blue],atlas=crowd.visible&&appearance.attendance!=='empty'?crowdAtlas(palette,appearance):null;
 const step=grid.step(),sinYaw=Math.sin(cam.yaw),cosYaw=Math.cos(cam.yaw),sinPitch=Math.sin(cam.pitch),cosPitch=Math.cos(cam.pitch),
  depth=p=>-sinPitch*(p.y-cam.eye.y)+cosPitch*(sinYaw*(p.x-cam.eye.x)+cosYaw*(p.z-cam.eye.z)),
  omit=(roof,ps)=>roof&&cutaway&&cam.eye.y>20&&ps.reduce((n,p)=>n+p.z,0)/ps.length<35;
 const depthBins=new Map(),fineJobs=[],logoProfiles=[],binSize=24;
 let cells=0,triangles=0,omitted=0,crowdCells=0,ledCells=0,fineCells=0,emblemCells=0,fineGeometryOccluded=0;
 const emit=(x,y,d,color,glow=0,density=1,surfaceId=null,alpha=1)=>{if(Number.isFinite(d)&&d>=.121){paint(x,y,d,color,alpha,'ballpark',glow,density,surfaceId);cells++;if(density>1)fineCells++;}},
  clip=ps=>{const output=[];for(let i=0;i<ps.length;i++){const p=ps[i],q=ps[(i+1)%ps.length],dp=depth(p),dq=depth(q);
   if(dp>=.121)output.push(p);if((dp<.121)!==(dq<.121))output.push(mix(p,q,(.121-dp)/(dq-dp)));}return output;},
  raster=(a,b,c,color,tile=null,material=null,surfaceId=null,density=1,sMaterialZ=Infinity,lodProfile=null)=>{
   const edge=(p,q,x,y)=>(q.x-p.x)*(y-p.y)-(q.y-p.y)*(x-p.x),area=edge(a,b,c.x,c.y);if(!Number.isFinite(area)||Math.abs(area)<.001)return;
   const x0=Math.max(step,grid.ceil(Math.min(a.x,b.x,c.x)*density)/density),x1=Math.min(600-step,grid.floor(Math.max(a.x,b.x,c.x)*density)/density),
    y0=Math.max(step,grid.ceil(Math.min(a.y,b.y,c.y)*density)/density),y1=Math.min(432-step,grid.floor(Math.max(a.y,b.y,c.y)*density)/density);
   if(density===1){for(let by=Math.floor(Math.max(0,Math.min(a.y,b.y,c.y))/binSize);by<=Math.floor(Math.min(432,Math.max(a.y,b.y,c.y))/binSize);by++)for(let bx=Math.floor(Math.max(0,Math.min(a.x,b.x,c.x))/binSize);bx<=Math.floor(Math.min(600,Math.max(a.x,b.x,c.x))/binSize);bx++){
    const key=bx+','+by;if(!depthBins.has(key))depthBins.set(key,[]);depthBins.get(key).push({a,b,c,area,surfaceId});
   }}
   if(x0>x1||y0>y1)return;triangles++;
   for(let y=y0;y<=y1+1e-8;y+=step/density)for(let x=x0;x<=x1+1e-8;x+=step/density){const u=edge(b,c,x,y)/area,v=edge(c,a,x,y)/area,w=1-u-v;
    if(u>=-1e-8&&v>=-1e-8&&w>=-1e-8){const d=1/(u/a.depth+v/b.depth+w/c.depth);
     if(density>1){let hidden=false;for(const t of depthBins.get(Math.floor(x/binSize)+','+Math.floor(y/binSize))??[]){
      if(t.surfaceId===surfaceId)continue;
      const u0=edge(t.b,t.c,x,y)/t.area,v0=edge(t.c,t.a,x,y)/t.area,w0=1-u0-v0;
      if(u0>=-1e-8&&v0>=-1e-8&&w0>=-1e-8&&1/(u0/t.a.depth+v0/t.b.depth+w0/t.c.depth)<d-.02){hidden=true;break;}
     }if(hidden){fineGeometryOccluded++;continue;}}
     if(tile&&atlas){const tu=d*(u*a.u/a.depth+v*b.u/b.depth+w*c.u/c.depth),tv=d*(u*a.v/a.depth+v*b.v/b.depth+w*c.v/c.depth),
       s=sampleCrowdTile(atlas,tu,tv,tile.id,crowd.frame,crowd.frames,appearance.size);
      emit(x,y,d,s.color,s.glow,1,'crowd-'+surfaceId);crowdCells++;if(s.kind==='led')ledCells++;
     }else if(material){
      const tu=d*(u*a.u/a.depth+v*b.u/b.depth+w*c.u/c.depth),tv=d*(u*a.v/a.depth+v*b.v/b.depth+w*c.v/c.depth);
      if(density===1){emit(x,y,d,color,0,1,surfaceId,0);continue;}
      let sample={color};
      if(material==='wolf'&&cam.eye.z<sMaterialZ){
       const overlay=sampleLogoUV((tu-.06)/.88,(1-tv-.06)/.88,lodProfile);
       sample=blendMaterial(sample,overlay&&lodProfile?{...overlay,a:overlay.a*lodProfile.contrast}:overlay,lodProfile??{brightness:1.7,glow:.15});
       if(sample.logoCoverage)emblemCells++;
      }else if(material.startsWith('scoreboard')){
       if(cam.eye.z<sMaterialZ)sample=sampleScoreboard(g,material,tu,tv,lodProfile)??sample;
      }else if(material!=='wolf'){
       const du=Math.abs((tu*3+tv*7)%1-.5),dv=Math.abs((tu*3-tv*7+20)%1-.5);
       const sector=Number(material.split(':')[1]??0),vBrace=Math.abs(((sector+tu)%8)/4-1);
       if(Math.abs(tv-vBrace)<.065)sample={color:shade(g.architecture.colors.gold,1.16)};
       else if(Math.min(du,dv)<.045)sample={color:shade(g.architecture.colors.gold,.78)};
      }
      emit(x,y,d,sample.color,sample.logoGlow??0,density,surfaceId);
     }else emit(x,y,d,color,0,1,surfaceId);
    }}
  },
  dot=(p,color)=>{const q=project(p);if(q&&q.x>=step&&q.x<=600-step&&q.y>=step&&q.y<=432-step)emit(q.x,q.y,q.depth-.025,color);},
  line=(p,q,color)=>{const dp=depth(p),dq=depth(q);if(dp<.121&&dq<.121)return;
   if(dp<.121)p=mix(p,q,(.121-dp)/(dq-dp));else if(dq<.121)q=mix(q,p,(.121-dq)/(dp-dq));
   const a=project(p),b=project(q);if(!a||!b)return;const dx=b.x-a.x,dy=b.y-a.y;let lo=0,hi=1;
   for(const [v,w]of[[-dx,a.x-step],[dx,600-step-a.x],[-dy,a.y-step],[dy,432-step-a.y]]){if(Math.abs(v)<1e-12){if(w<0)return;continue;}const t=w/v;if(v<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return;}
   const n=Math.max(1,Math.ceil(Math.hypot(dx,dy)*(hi-lo)/step));for(let i=0;i<=n;i++){const t=lo+(hi-lo)*i/n;emit(a.x+dx*t,a.y+dy*t,1/((1-t)/a.depth+t/b.depth)-.035,color);}
  };
 for(const s of m.surfaces){if(omit(s.roof,s.points)){omitted++;continue;}
  const source=(s.crowdTile&&atlas)||s.material?s.points.map((p,i)=>({...p,u:[0,1,1,0][i],v:[0,0,1,1][i]})):s.points,
   ps=clip(source).map(p=>{const q=project(p);return q?{...q,u:p.u,v:p.v}:null;});
  const profile=(s.material==='wolf'||s.material?.startsWith('scoreboard'))?projectedMaterialDetail(ps,g.architecture.details?.factor??6,step):null;
  if(profile&&s.material==='wolf')logoProfiles.push({id:s.id,...profile});
  for(let i=1;i<ps.length-1;i++)if(ps[0]&&ps[i]&&ps[i+1]){
    raster(ps[0],ps[i],ps[i+1],s.color,s.crowdTile,s.material,s.id,1,s.points[0].z);
    if(s.material)fineJobs.push([ps[0],ps[i],ps[i+1],s.color,null,s.material,s.id,profile?(profile.density):2,s.points[0].z,profile]);
   }
 }
 for(const job of fineJobs)raster(...job);
 for(const s of m.segments){if(omit(s.roof,[s.p,s.q]))continue;line(s.p,s.q,s.color);}
 return {scoreboard:m.scoreboard,capacity:m.capacity,tiers:m.tiers,rowsPerTier:m.rowsPerTier,spectatorLights:m.spectatorLights,
  crowd:{...crowd,mode:'tiled_clusters',attendance:atlas?'full':'empty',groups:atlas?m.spectatorTiles:0,coverage:atlas?1:0,individualWorldObjects:0,tile:CROWD_TILE,candidateCrowdCells:crowdCells,candidateLedCells:ledCells,appearance,penLengthMeters:PENLIGHT_LENGTH_METERS,palette},
  envelope:m.envelope,detail:{logoProfiles,fineCells,emblemCells,fineGeometryOccluded,depthMethod:'projected_triangle_bins_then_shared_world_depth',raster:'shared_circle_dots',material:'approved_wolf_png_and_facade_ornament',factor:g.architecture.details?.factor??6},roof:{...m.roof,cutaway},surfaces:m.surfaces.length,triangles,candidateCells:cells,omittedRoofSurfaces:omitted,
  renderer:'original_projection_grid_depth_and_dot',simulationIntegration:'DESIGN_ONLY_NOT_MATCH_CORE_ADMITTED'};
}
