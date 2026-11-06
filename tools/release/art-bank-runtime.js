/* Adopted art for the broadcast renderer. A pose with no adopted picture returns null and the existing silhouette stays.
 * Left-handed batting and pitching are the right-handed art mirrored (the owner's decision, 2026-11-03).
 * Exclusive sets: keys "chinsuke/..." and "lotso/..." are reachable only through whoIs(), which needs
 * both the roster id and the roster name of that one player; every other actor gets generic art or nothing. */
(function(root){
 'use strict';
 const pack={/*ART_PACK*/},bank=new Map(),hits={},flipped=new Map();
 let lastAthletic=null;
 // The owner's explicit instructions: the afro art is ちんすけ's, and from 2026-11-03 李将軍's too; the purple-beard art is
 // ロッツォ's alone.
 const EXCLUSIVE={'1-b2':{name:'ちんすけ',who:'chinsuke'},'1-b7':{name:'李将軍',who:'chinsuke'},'1-b3':{name:'ロッツォ',who:'lotso'}};
 function whoIs(id,name){const e=EXCLUSIVE[id];return e&&e.name===name?e.who:null;}
 function decode(key,row){
  const image=new Image();
  image.onload=()=>{
   const w=image.naturalWidth,h=image.naturalHeight,size=Math.max(w,h),c=document.createElement('canvas');c.width=size;c.height=size;
   const ctx=c.getContext('2d',{willReadFrequently:true}),x0=Math.floor((size-w)/2),y0=size-h;ctx.drawImage(image,x0,y0);
   const anchor=x0+(row.footX??w/2);
   const bytes=ctx.getImageData(0,0,size,size).data,pixels=new Uint16Array(size*size),lut=new Map(),colors=['rgba(0,0,0,0)'];
   let minX=size,minY=size,maxX=0,maxY=0;
   for(let n=0;n<pixels.length;n++){const k=n*4;if(bytes[k+3]<96)continue;const id=(bytes[k]&248)<<16|(bytes[k+1]&248)<<8|bytes[k+2]&248;
    let index=lut.get(id);if(index===undefined){index=colors.length;lut.set(id,index);colors.push('rgb('+bytes[k]+','+bytes[k+1]+','+bytes[k+2]+')');}
    pixels[n]=index;const x=n%size,y=Math.floor(n/size);if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
   bank.set(key,{sprite:{pixels,size,originX:anchor,baseline:size-1,referenceHeight:row.referenceHeight,minX,minY,maxX,maxY,artBankV1:row.id,
    // Where the real bat's grip belongs on a body drawn without one.
    ...(row.grip?{gripX:x0+row.grip[0],gripY:y0+row.grip[1]}:{}),
    ...(row.bend?{bend:{gripX:x0+row.bend.grip[0],gripY:y0+row.bend.grip[1],pivotX:x0+row.bend.pivot[0],pivotY:y0+row.bend.pivot[1],top:y0+row.bend.top,bottom:y0+row.bend.bottom,faces:row.bend.faces??1,
     ...(row.bend.bat?{bat:[x0+row.bend.bat[0],y0+row.bend.bat[1],x0+row.bend.bat[2],y0+row.bend.bat[3]]}:{})}}:{}),
    // A swing frame: the bat of the art is a separate picture (swingbat/...), held at the grip and turned with the upper body.
    ...(row.swing?{swing:{gripX:x0+row.swing.grip[0],gripY:y0+row.swing.grip[1],tipX:x0+row.swing.tip[0],tipY:y0+row.swing.tip[1],pivotX:x0+row.swing.pivot[0],pivotY:y0+row.swing.pivot[1],
     top:y0+row.swing.top,bottom:y0+row.swing.bottom,cut:row.swing.cut,faces:row.swing.faces}}:{})},palette:colors,id:row.id,key});
  };
  image.src='data:image/png;base64,'+row.data;
 }
 for(const [key,row] of Object.entries(pack))decode(key,row);
 // Mirror image about the foot anchor.
 function flip(found){
  if(flipped.has(found))return flipped.get(found);
  const s=found.sprite,size=s.size,pixels=new Uint16Array(s.pixels.length);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)pixels[y*size+x]=s.pixels[y*size+size-1-x];
  const copy={...found,sprite:{...s,pixels,originX:size-s.originX,minX:size-1-s.maxX,maxX:size-1-s.minX,viewMirrorX:true,...(s.gripX!==undefined?{gripX:size-s.gripX}:{}),
   ...(s.bend?{bend:{...s.bend,gripX:size-s.bend.gripX,pivotX:size-s.bend.pivotX,...(s.bend.bat?{bat:[size-s.bend.bat[2],s.bend.bat[1],size-s.bend.bat[0],s.bend.bat[3]]}:{})}}:{}),
   ...(s.swing?{swing:{...s.swing,gripX:size-s.swing.gripX,tipX:size-s.swing.tipX,pivotX:size-s.swing.pivotX}}:{})},
   ...(found.batLayer?{batLayer:flip(found.batLayer)}:{})};
  flipped.set(found,copy);return copy;
 }
 /* The batter aims the swing: the upper body turns up or down to the ball's height and leans toward or away from the
  * plate with its side, about the hip, fully above the waist and fading out by the knees. The legs stay. lift and reach
  * run from -1 to 1 (high to low, inside to outside); the Core's bat is then put in the bent hands. Bends are kept per
  * picture in small steps. BEND_TURN and BEND_LEAN are the owner-approved probe's extremes (about 20 degrees, 40 px). */
 const BEND_TURN=.35,BEND_LEAN=.06,bends=new WeakMap(),smooth=t=>{t=t<0?0:t>1?1:t;return t*t*(3-2*t);};
 function bend(found,lift,reach){
  const s=found?.sprite,b=s?.bend;if(!b||!Number.isFinite(lift)||!Number.isFinite(reach))return null;
  // A picture that faces screen left turns the other way for the same aim.
  const faces=(b.faces??1)*(s.viewMirrorX?-1:1),
   turn=Math.round(Math.max(-1,Math.min(1,lift))*BEND_TURN*faces/.02)*.02,lean=Math.round(Math.max(-1,Math.min(1,reach))*BEND_LEAN*s.size*faces);
  let cache=bends.get(found);if(!cache){cache=new Map();bends.set(found,cache);}
  const key=turn+':'+lean;let made=cache.get(key);
  if(!made){
   const size=s.size,from=s.pixels,pixels=new Uint16Array(from.length),weight=y=>1-smooth((y-b.top)/(b.bottom-b.top)),
    inBat=(x,y)=>!!b.bat&&x>=b.bat[0]&&x<b.bat[2]&&y>=b.bat[1]&&y<b.bat[3],
    forward=(x,y)=>{const w=weight(y),t=turn*w,c=Math.cos(t),n=Math.sin(t),dx=x-b.pivotX,dy=y-b.pivotY;return [b.pivotX+c*dx-n*dy+lean*w,b.pivotY+n*dx+c*dy];};
   let minX=size,minY=size,maxX=0,maxY=0;
   // Only around the figure: the turn moves nothing farther than a quarter of the picture.
   const reach=Math.ceil(size/4),x0=Math.max(0,s.minX-reach),x1=Math.min(size,s.maxX+reach+1),y0=Math.max(0,s.minY-reach),y1=Math.min(size,s.maxY+reach+1);
   for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
    // Where this pixel came from: the turn depends on the source height, so walk back a few times.
    let px=x+.5,py=y+.5;
    for(let k=0;k<4;k++){const w=weight(py),t=-turn*w,c=Math.cos(t),n=Math.sin(t),dx=x+.5-lean*w-b.pivotX,dy=y+.5-b.pivotY;px=b.pivotX+c*dx-n*dy;py=b.pivotY+n*dx+c*dy;}
    const sx=Math.floor(px),sy=Math.floor(py);if(sx<0||sy<0||sx>=size||sy>=size||inBat(sx,sy))continue;
    const v=from[sy*size+sx];if(!v)continue;
    pixels[y*size+x]=v;
   }
   // A drawn bat is one rigid piece: it turns with the hands instead of bending with the body.
   if(b.bat){
    const held=forward(b.gripX,b.gripY),t=-turn*weight(b.gripY),c=Math.cos(t),n=Math.sin(t);
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
     const dx=x+.5-held[0],dy=y+.5-held[1],sx=Math.floor(b.gripX+c*dx-n*dy),sy=Math.floor(b.gripY+n*dx+c*dy);
     if(sx<0||sy<0||sx>=size||sy>=size||!inBat(sx,sy))continue;
     const v=from[sy*size+sx];if(v)pixels[y*size+x]=v;
    }
   }
   for(let i=0;i<pixels.length;i++)if(pixels[i]){const x=i%size,y=(i-x)/size;if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
   const hand=s.gripX!==undefined?forward(s.gripX,s.gripY):null;
   made={...found,sprite:{...s,pixels,minX,minY,maxX,maxY,...(hand?{gripX:hand[0],gripY:hand[1]}:{}),bent:{turn,lean}}};
   if(cache.size>48)cache.delete(cache.keys().next().value);cache.set(key,made);
  }
  return {found:made};
 }
 /* ---- The swing (docs/ai-continuity/DESIGN-2026-11-06-swing-drawing.md). A swing frame is the art's body and, apart, the
  * art's own bat. The upper body turns about the hip by `turn` (radians, clockwise on screen), fully above `top` and fading
  * out by `bottom`; the legs never move. The bat is one rigid piece held where the turned hands are, turned by turn+batTurn
  * and stretched past the hands by `stretch`, so it shows the length of the player's own bat. The picture is padded by half
  * its size on every side, so a turned or longer bat is never cut off. ---- */
 const SWING_PAD=.5,swings=new WeakMap(),merged=new WeakMap();
 function swingGeometry(found,{turn=0,batTurn=0,stretch=1}={}){
  const s=found?.sprite,r=s?.swing;if(!r)return null;
  const w=1-smooth((r.gripY-r.top)/(r.bottom-r.top)),t=turn*w,c=Math.cos(t),n=Math.sin(t),dx=r.gripX-r.pivotX,dy=r.gripY-r.pivotY,
   grip=[r.pivotX+c*dx-n*dy,r.pivotY+n*dx+c*dy],ux=r.tipX-r.gripX,uy=r.tipY-r.gripY,length=Math.hypot(ux,uy),cut=r.cut*length,
   reach=cut+(length-cut)*stretch,a=turn+batTurn,ca=Math.cos(a),na=Math.sin(a);
  return {grip,tip:[grip[0]+(ca*ux-na*uy)/length*reach,grip[1]+(na*ux+ca*uy)/length*reach],length:reach,artLength:length,cut,
   // The art's own bat angle on screen, degrees, up positive.
   angle:Math.atan2(-uy,ux)*180/Math.PI};
 }
 function swing(found,{turn=0,batTurn=0,stretch=1}={}){
  const s=found?.sprite,r=s?.swing,bat=found?.batLayer;if(!r||!bat)return null;
  turn=Math.round(turn/.01)*.01;batTurn=Math.round(batTurn/.01)*.01;stretch=Math.round(stretch/.02)*.02;
  let cache=swings.get(found);if(!cache){cache=new Map();swings.set(found,cache);}
  const key=turn+':'+batTurn+':'+stretch;let made=cache.get(key);
  if(made)return {found:made};
  const size=s.size,pad=Math.round(size*SWING_PAD),out=size+2*pad,pixels=new Uint16Array(out*out),from=s.pixels,
   weight=y=>1-smooth((y-r.top)/(r.bottom-r.top));
  // One palette for both pieces: the bat's colours follow the body's.
  let palette=merged.get(found);if(!palette){palette=found.palette.concat(bat.palette.slice(1));merged.set(found,palette);}
  const shift=found.palette.length-1;
  // The body, as bend() turns it: walk each pixel back to where it came from.
  const reach=Math.ceil(size/4),x0=Math.max(-pad,s.minX-reach),x1=Math.min(size+pad,s.maxX+reach+1),y0=Math.max(-pad,s.minY-reach),y1=Math.min(size+pad,s.maxY+1);
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
   let px=x+.5,py=y+.5;
   for(let k=0;k<4;k++){const w=weight(py),t=-turn*w,c=Math.cos(t),n=Math.sin(t),dx=x+.5-r.pivotX,dy=y+.5-r.pivotY;px=r.pivotX+c*dx-n*dy;py=r.pivotY+n*dx+c*dy;}
   const sx=Math.floor(px),sy=Math.floor(py);if(sx<0||sy<0||sx>=size||sy>=size)continue;
   const v=from[sy*size+sx];if(v)pixels[(y+pad)*out+x+pad]=v;
  }
  // The bat over it: each pixel is read back through the turn and the stretch past the hands.
  const g=swingGeometry(found,{turn,batTurn,stretch}),b=bat.sprite.pixels,a=turn+batTurn,c=Math.cos(a),n=Math.sin(a),
   ux=(r.tipX-r.gripX)/g.artLength,uy=(r.tipY-r.gripY)/g.artLength,margin=.15*g.artLength+4,
   bx0=Math.max(-pad,Math.floor(Math.min(g.grip[0],g.tip[0])-margin)),bx1=Math.min(size+pad,Math.ceil(Math.max(g.grip[0],g.tip[0])+margin)),
   by0=Math.max(-pad,Math.floor(Math.min(g.grip[1],g.tip[1])-margin)),by1=Math.min(size+pad,Math.ceil(Math.max(g.grip[1],g.tip[1])+margin));
  for(let y=by0;y<by1;y++)for(let x=bx0;x<bx1;x++){
   const dx=x+.5-g.grip[0],dy=y+.5-g.grip[1],lx=c*dx+n*dy,ly=-n*dx+c*dy,along=lx*ux+ly*uy,across=-lx*uy+ly*ux,
    back=along<=g.cut?along:g.cut+(along-g.cut)/stretch,sx=Math.floor(r.gripX+ux*back-uy*across),sy=Math.floor(r.gripY+uy*back+ux*across);
   if(sx<0||sy<0||sx>=size||sy>=size)continue;
   const v=b[sy*size+sx];if(v)pixels[(y+pad)*out+x+pad]=v+shift;
  }
  let minX=out,minY=out,maxX=0,maxY=0;
  for(let i=0;i<pixels.length;i++)if(pixels[i]){const x=i%out,y=(i-x)/out;if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
  made={...found,palette,sprite:{...s,size:out,pixels,originX:s.originX+pad,baseline:s.baseline+pad,minX,minY,maxX,maxY,
   gripX:g.grip[0]+pad,gripY:g.grip[1]+pad,swingBat:{gripX:g.grip[0]+pad,gripY:g.grip[1]+pad,tipX:g.tip[0]+pad,tipY:g.tip[1]+pad},swung:{turn,batTurn,stretch}}};
  if(cache.size>64)cache.delete(cache.keys().next().value);cache.set(key,made);
  return {found:made};
 }
 const swingSlot=(who,frame)=>who&&!bank.has(who+'/swing/mound/'+frame)?frame.replace(/\/(high|low)$/,'/middle'):frame;
 function swingReady(who,frame){const slot=swingSlot(who,frame),base=(who?who+'/':'');return bank.has(base+'swing/mound/'+slot)&&bank.has(base+'swingbat/mound/'+slot);}
 // A slot is the generic key; an exclusive player's own frame for the same slot wins when it exists.
 function slot(who,key){return (who&&bank.get(who+'/'+key))||bank.get(key);}
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 /* Catcher: where the mitt meets the ball, in the strike zone's own terms.
  * art.catcher={x,y,zone:{halfWidth,lower,upper},dirt,knee,sx}; sx=+1 when world +x is screen right. */
 function catcherName(c){
  if(!c)return null;
  const {x,y,zone,dirt,sx}=c,side=v=>v*sx<0?'left':'right';
  const dx=Math.max(0,Math.abs(x)-zone.halfWidth),up=y-zone.upper,down=zone.lower-y;
  if(dirt)return Math.abs(x)>zone.halfWidth+.45?'extreme-middle':down>.45?'extreme-low':'ball-low-kneeling';
  if(dx===0&&up<=0&&down<=0){
   const nx=x/zone.halfWidth,ny=(y-(zone.upper+zone.lower)/2)/((zone.upper-zone.lower)/2);
   if(Math.abs(nx)>.5&&Math.abs(nx)>=Math.abs(ny))return 'zone-'+side(x);
   if(ny>.5)return 'zone-high';
   if(ny<-.5)return 'zone-low';
   return null;
  }
  const far=Math.max(dx,up,down);
  if(far>.45)return dx>=Math.max(up,down)?'extreme-middle':up>down?'extreme-high':'extreme-low';
  if(dx>=Math.max(up,down))return 'ball-'+side(x);
  return up>down?'ball-high':'ball-low-kneeling';
 }
 /* ---- Presentation facts read from the finished pitch record. Nothing here changes a ball, runner, call or clock;
  * it only chooses which adopted picture to show, from events the Core already recorded. ---- */
 const ticksOf=r=>r?.play?.diagnostics?.sourceClockTicksPerSecond??1e6;
 const plateCache=new WeakMap();
 // Where and when the pitched ball first reaches the plate plane: where the pitch really arrived, and when the umpire's call is real.
 function plateInfo(record){
  if(plateCache.has(record))return plateCache.get(record);
  const f=record.frames?.find(x=>x.ballKind==='pitch'&&x.ball?.position&&x.ball.position.z<=0);
  const info=f?{tick:f.tick,x:f.ball.position.x,y:f.ball.position.y}:null;
  plateCache.set(record,info);return info;
 }
 const plateTick=record=>plateInfo(record)?.tick??null;
 // The swing's aim: the ball where the bat met it, or where it crossed the plate. lift -1 is the top of the zone, 1 the
 // bottom; reach -1 is the inside edge, 1 the outside edge. The zone is the batter's own (.27 to .535 of height).
 const aims=new WeakMap();
 function aimOf(record,batterHeight){
  if(aims.has(record))return aims.get(record);
  const ball=record.frames?.find(x=>x.ballKind==='batted'&&x.ball?.position)?.ball.position??plateInfo(record),h=Number.isFinite(batterHeight)?batterHeight:1.8;
  const side=record.play?.diagnostics?.battingSide==='L'?1:-1,aim=ball&&Number.isFinite(ball.y)?{lift:(h*.4025-ball.y)/(h*.1325),reach:-ball.x*side/.25}:null;
  aims.set(record,aim);return aim;
 }
 // The record's frames stop when the ball is dead; the picture goes on. Presentation time past the last frame is read
 // from the scene clock the same way the whiff follow-through does (release tick + elapsed scene seconds).
 function presentTick(record,frame,sceneMs,preparationMs){
  const first=record.frames?.[0]?.tick;
  if(!Number.isFinite(sceneMs)||!Number.isFinite(preparationMs)||first===undefined||sceneMs<preparationMs)return frame.tick;
  return Math.max(frame.tick,first+(sceneMs-preparationMs)/1000*ticksOf(record));
 }
 /* How far the Core's bat has swung: its angular travel since the stance, as a share of the travel at contact (the bat's
  * real contact, or for a miss the swing's reference contact). 0 is the stance, 1 the contact. Past the last recorded bat
  * (a hit's bat stops at the contact) it goes on at the rate the swing had. The renderer picks the frame from this, not
  * from the clock. */
 const swingPaths=new WeakMap(),unit3=v=>{const l=Math.hypot(v.x,v.y,v.z);return l?{x:v.x/l,y:v.y/l,z:v.z/l}:null;};
 function swingPath(record){
  if(swingPaths.has(record))return swingPaths.get(record);
  const d=record.play?.diagnostics??{},tps=ticksOf(record),contact=record.play?.contactMoment?.ball;
  let path=null;
  if(d.swingOffered===true){
   const points=[];let travel=0,prev=null;
   for(const f of record.frames??[]){
    const g=f.bat?.grip,t=f.bat?.tip;if(!g||!t)continue;
    const u=unit3({x:t.x-g.x,y:t.y-g.y,z:t.z-g.z});if(!u)continue;
    if(prev)travel+=Math.acos(clamp(u.x*prev.x+u.y*prev.y+u.z*prev.z,-1,1));
    prev=u;points.push({tick:f.tick,travel,bat:f.bat});
   }
   const hit=Number.isSafeInteger(contact?.tick),at=hit?contact.tick:d.referenceContactTick;
   const travelAt=tick=>{
    if(!points.length)return 0;if(tick<=points[0].tick)return 0;
    for(let i=1;i<points.length;i++)if(points[i].tick>=tick){const a=points[i-1],b=points[i];return a.travel+(b.travel-a.travel)*(tick-a.tick)/(b.tick-a.tick);}
    return points.at(-1).travel;
   };
   const atContact=Number.isFinite(at)?travelAt(at):0;
   if(points.length>1&&atContact>.3){
    // The bat where it met the ball (or where the miss's contact was due), for the stand and the contact match.
    const near=points.reduce((a,b)=>Math.abs(b.tick-at)<Math.abs(a.tick-at)?b:a);
    const last=points.at(-1),before=points.at(-2),rate=(last.travel-before.travel)/Math.max(1,last.tick-before.tick);
    // The swing proper starts at the Core's reference start: the bat moves a little before it, in the load.
    const start=Number.isFinite(d.referenceStartTick)?d.referenceStartTick:null;
    path={points,hit,contactTick:at,contactBat:near.bat,ball:hit?contact.position:null,atContact,lastTick:last.tick,lastTravel:last.travel,
     rate:Math.max(rate,atContact/(.15*tps)),tps,startTick:start,startProgress:start===null?0:travelAt(start)/atContact};
   }
  }
  swingPaths.set(record,path);return path;
 }
 function swingProgress(record,tick){
  const p=swingPath(record);if(!p)return null;
  let travel;
  if(tick<=p.lastTick){
   travel=0;const pts=p.points;
   if(tick>pts[0].tick)for(let i=1;i<pts.length;i++)if(pts[i].tick>=tick){const a=pts[i-1],b=pts[i];travel=a.travel+(b.travel-a.travel)*(tick-a.tick)/(b.tick-a.tick);break;}
  }else travel=p.lastTravel+(tick-p.lastTick)*p.rate;
  return travel/p.atContact;
 }
 const BASE_KEYS=['first','second','third'];
 function actorArt({record,frame,actor,anim,ordinal,batterHeight,sceneMs,preparationMs}){
  if(!record||!frame||!actor)return null;
  const tps=ticksOf(record),tick=presentTick(record,frame,sceneMs,preparationMs),events=record.events??[],art={};
  const bases=record.beforeMatch?.bases??{};
  if(actor.role==='C'&&anim?.action==='catch'){
   art.knee=BASE_KEYS.every(k=>!bases[k]);   // nobody on: the relaxed one-knee stance; a runner on: ready to throw
   const plate=plateInfo(record);
   if(plate&&tick>=plate.tick-.1*tps&&tick<=plate.tick+.8*tps){
    const h=Number.isFinite(batterHeight)?batterHeight:1.8;
    // The ball bounced in front of the plate first: a block, not a catch.
    const dirt=events.some(e=>e.kind==='ground_contact'&&e.position&&e.position.z>-.3&&e.tick<plate.tick);
    art.catcher={x:plate.x,y:plate.y,zone:{halfWidth:.2159+.0366,lower:h*.270,upper:h*.535},dirt,knee:art.knee};
   }
  }
  if(actor.role==='P'&&anim?.action==='pitch'){
   const out=events.find(e=>(e.kind==='pickoff_safe'||e.kind==='picked_off')&&e.playerId);
   const release=out&&events.find(e=>e.kind==='throw_release'&&e.playerId===actor.playerId);
   if(release&&tick>=release.tick-.45*tps&&tick<=release.tick+.7*tps){
    const base=BASE_KEYS.findIndex(k=>bases[k]===out.playerId)+1;
    if(base)art.pickoff={base,frame:tick<release.tick-.15*tps?0:tick<release.tick+.1*tps?1:2};
   }
  }
  if(events.some(e=>e.kind==='runner_out'&&(e.runnerId??e.playerId)===actor.playerId&&e.tick<=tick))art.out=true;
  if(events.some(e=>e.kind==='catch_secured'&&e.playerId===actor.playerId))art.caught=true;
  if(anim?.pose==='ground'){
   const c=events.find(e=>e.kind==='catch_secured'&&e.playerId===actor.playerId&&e.position);
   if(c&&actor.position)art.backhandDx=c.position.x-actor.position.x;
  }
  if(anim?.action==='bat'&&record.batterPlayerId===actor.playerId){
   art.aim=aimOf(record,batterHeight);
   const path=swingPath(record);
   if(path)art.swing={progress:swingProgress(record,tick),tick,path};
   const crossed=plateTick(record),play=record.play??{};
   // Looking at strike three: the batter's reaction starts when the umpire's call does.
   if(play.call==='called_strike'&&play.classification==='strikeout'&&crossed!=null&&tick>=crossed+.25*tps)art.look=['up','bent','photo'][(ordinal??0)%3];
   // Certain home run: held bat, then released bat, once the ball has plainly left (the owner's two-frame order).
   const contact=play.contactMoment?.ball?.tick;
   if(play.classification==='home_run'&&Number.isSafeInteger(contact)&&tick>=contact+.45*tps)art.hr=tick<contact+1.0*tps?0:1;
  }
  return art;
 }
 const STRIKE_CALLS=['diagonal-up','knee-lift','side-punch','arms-spread','overhead-twist'];
 // The plate umpire: the count between pitches, crouched while the pitch is in flight, the call when the ball arrives.
 function umpireArt({record,frame,preparing,ordinal,sceneMs,preparationMs}){
  if(!record||!frame)return {pose:'ready'};
  const before=record.beforeMatch,after=record.match,tps=ticksOf(record),tick=presentTick(record,frame,sceneMs,preparationMs),release=record.frames?.[0]?.tick??tick;
  const count=m=>({pose:'count',balls:clamp(m?.balls??0,0,3),strikes:clamp(m?.strikes??0,0,2)});
  if(preparing||tick<release)return ordinal===0&&(before?.balls??0)===0&&(before?.strikes??0)===0?{pose:'play-ball'}:count(before);
  const crossed=plateTick(record),cls=record.play?.classification;
  if(crossed==null||tick<crossed+.2*tps)return {pose:'ready'};
  if(cls==='strikeout')return tick<crossed+1.5*tps?{pose:'strikeout',name:STRIKE_CALLS[(ordinal??0)%STRIKE_CALLS.length]}:count(after);
  if(cls==='count'||cls==='walk')return count(after);
  if(record.play?.rules?.halfChanged&&tick>=(record.play.rules.endedAtTick??Infinity))return {pose:'time'};
  return {pose:'ready'};
 }
 function pick({role,action,frame,camera,hand,form,team,running,isRobin,pose,away,walking,who,art,athletic,motion,sx,player}){
  // Each team's uniform for this match (pregame-ui-v1.js): the Dragons' own kits, the Dodgers in the other one.
  const uniform=root.KneekuraUniformV1,tbdKit=uniform?.tbd?.()??'home',kit=team===1?'home':(uniform?.lad?.()??'away'),outfield=['LF','CF','RF'].includes(role);
  let key=null,found=null,mirror=false,handed=false,behind=false;
  art=art||{};motion=motion||{x:0,depth:0};sx=sx||1;
  if(art.catcher)art={...art,catcher:{...art.catcher,sx}};
  const reach=art.backhandDx===undefined?0:art.backhandDx*sx,backhand=reach<-.7?'1':reach<-.4?'2':null;
  if(role==='umpire'){
   const u=art.umpire;
   if(u)key=u.pose==='count'?'umpire/count/'+u.balls+'-'+u.strikes:u.pose==='strikeout'?'umpire/strikeout/'+u.name:u.pose==='tag-out'?'umpire/home-tag-out':u.pose==='time'?'umpire/time':u.pose==='play-ball'?'umpire/play-ball':'umpire/ready';
   else key='umpire/ready';
   found=bank.get(key)||bank.get('umpire/ready');
  }
  // A drawn frame always stands in for these motions: the body is never stretched to fake one.
  else if(athletic&&(athletic.kind==='feet_slide'||athletic.kind==='head_slide')&&!isRobin&&(athletic.phase==='slide'||athletic.phase==='recover')){
   // The art slides to screen-left. A slide straight at or away from the camera keeps that side view.
   key=athletic.phase==='recover'&&art.out?'slide/dejected':athletic.kind==='head_slide'?'slide/head':'slide/feet';
   mirror=motion.x>0;
  }
  else if(athletic&&(athletic.kind==='jump'||athletic.kind==='dive')&&!isRobin&&athletic.phase!=='ready'){
   const x=motion.x,depth=motion.depth,sideways=Math.abs(x)>=Math.abs(depth),airborne=['takeoff','airborne'].includes(athletic.phase);
   if(athletic.kind==='jump'){
    key=depth<-.5?'jump/front-jump':x>.4?'jump/lateral-high':(x<-.4&&depth>.3)?'jump/retreat-diagonal':depth>.5?'jump/vertical-reach':'jump/compact-jump';
   }else{
    // The dive art leaves to screen-right; a dive to the left is its mirror, which swaps the glove hand.
    mirror=x<0;
    if(airborne)key=sideways?'dive/horizontal-dive/'+kit:'dive/low-forward-dive/'+kit;
    else if(athletic.phase==='land'||athletic.phase==='slide')key='dive/lateral-slide/'+kit;
    else if(athletic.phase==='recover'&&!art.caught)key=sideways?'dive/lateral-dejected/'+kit:'dive/forward-dejected/'+kit;
   }
  }
  else if(running&&action==='run'){
   // The side views are rejected art, so a runner shows whichever of front and rear he is nearer: front only when coming at the camera.
   const view=(motion.depth<-.1&&!away)?'front':'rear',step=frame%2;
   if(isRobin)key='robin/run/'+view+'/'+step;
   else{
    const glove=!walking&&!['batter','runner'].includes(role);
    key=(walking?'walk':'run')+'/'+(glove?'glove-':'')+view+'/'+step;
   }
  }
  else if(action==='pitch'&&role!=='P')key=isRobin?'robin/throw/'+Math.max(0,frame-3):'throw/'+(outfield?'out':'in')+'/'+kit+'/'+Math.max(0,frame-3);
  else if(pose==='ground'){
   key=isRobin?'robin/ground/'+frame:'ground/'+kit+'/'+frame;
   // A reach to the glove side (screen-left, where the drawn glove is) is the backhand; the art is not mirrored.
   if(!isRobin&&backhand&&frame>=1)key='backhand/'+backhand+'/'+kit;
  }
  else if(pose==='fly'&&role==='P'&&!isRobin)key='liner/'+kit;
  else if(pose==='fly'&&!isRobin)key='fly/'+(outfield?'out':'in')+'/'+kit;
  else if(role==='P'&&art.pickoff&&camera!=='mound'){
   // A left-hander's throw to first is the mirror of a right-hander's throw to third.
   const base=hand==='L'&&!isRobin?4-art.pickoff.base:art.pickoff.base;
   key=isRobin?'robin/pickoff/'+base+'/'+art.pickoff.frame:'pickoff/'+base+'/'+art.pickoff.frame+'/'+kit;handed=!isRobin;
  }
  else if(isRobin){if(action==='pitch')key='robin/pitch/'+(frame===0?0:frame<3?1:2);}
  else if(action==='pitch'&&['over','side','under','montage'].includes(form)&&frame>=0&&frame<6){key='pitch/'+form+'/'+frame;handed=true;}
  // ロッツォ has one home-run picture, so it holds through the second beat.
  else if(action==='bat'&&camera==='mound'&&who&&art.hr!==undefined&&art.hr!==null)key='bat/hr/'+(bank.has(who+'/bat/hr/'+art.hr)?art.hr:0);
  // Batting is drawn from the pitcher's side. A camera behind the plate sees the batter from the other side, so the same
  // picture is mirrored there (sx>0: world +x is screen right). The direct-rear art is a view from the batter's back,
  // which no plate camera has, so it is not used.
  // Every batter swings with the bat of the art (2026-11-06): the renderer names the frame (art.swingKey, e.g. '2/low') from
  // the Core's bat. A player's own set has one impact and one follow-through, its middle.
  else if(action==='bat'&&!art.look&&art.swingKey&&swingReady(who,art.swingKey)){
   key='swing/mound/'+swingSlot(who,art.swingKey);handed=true;behind=sx>0;}
  // Until the swing art is decoded: the body drawn without a bat holding the Core's bat; ちんすけ and ロッツォ bend at
  // the impact toward the ball's height and side.
  else if(action==='bat'&&frame>=0&&frame<4&&!art.look&&(!who||bank.has(who+'/bat/mound/'+frame))){
   key=who?'bat/mound/'+frame:'body/mound/'+frame;handed=true;behind=sx>0;}
  else if(action==='bat'&&art.look){
   const rear=camera!=='mound';
   key='look/'+(art.look==='up'?'look-up':art.look==='bent'?'bent-forward':'photo')+'-'+(rear?'rear':'front');handed=true;
  }
  else if(action==='catch'&&camera!=='mound')key=team===1?'catch/home':'catch/away';
  else if(action==='catch'){
   const name=catcherName(art.catcher),knee=!!art.knee;
   if(name)key='catchx/'+(knee&&!name.startsWith('extreme')&&name!=='ball-low-kneeling'?(name.startsWith('zone')?'kzone-'+name.slice(5):'kball-'+name.slice(5)):name)+'/'+kit;
   else key=knee?'catchx/one-knee/'+kit:(team===1?'catch/home':'catch/away');
  }
  // Standing still: a fielder's ready crouch, the catcher's stance, a runner off the bag.
  if(!key&&!found&&(action==='field'||action==='runner'||athletic)){
   if(action==='runner'&&!isRobin)key='walk/front/0';
   else if(role==='C')key=team===1?'catch/home':'catch/away';
   else key=isRobin?'robin/ground/0':'ground/'+kit+'/0';
  }
  if(athletic)lastAthletic={kind:athletic.kind,phase:athletic.phase,motion,key,isRobin};
  const own=!found&&key&&who?bank.get(who+'/'+key):null;
  // A Dragon wears the chosen Dragons kit (with his own name and number where the back shows), drawn by the owner's
  // uniform compositor; a player with a set of his own keeps it.
  const dragons=!found&&!own&&key&&team===1?bank.get('tbd/'+tbdKit+'/'+player+'/'+key)||bank.get('tbd/'+tbdKit+'/'+key):null;
  if(!found&&key)found=own||dragons||bank.get(key);
  if(!found)return null;
  if(key.startsWith('swing/')&&!found.batLayer)found.batLayer=bank.get((own?who+'/':'')+key.replace('swing/','swingbat/'));
  // ちんすけ's own set and the batless body are drawn left-handed, every other picture right-handed.
  if(handed&&(hand==='L')!==(own?who==='chinsuke':key.startsWith('body/')||key.startsWith('swing/')))mirror=true;
  if(behind)mirror=!mirror;
  hits[found.key]=(hits[found.key]??0)+1;
  return mirror?flip(found):found;
 }
 root.KneekuraArtBankV1=Object.freeze({pick,bend,swing,swingGeometry,whoIs,actorArt,umpireArt,inspect:()=>({loaded:bank.size,total:Object.keys(pack).length,hits:{...hits},lastAthletic})});
})(globalThis);
