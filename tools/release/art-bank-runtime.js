/* Adopted art for the broadcast renderer. A pose with no adopted picture (left-handed pitching and batting)
 * returns null and the existing silhouette stays.
 * Exclusive sets: keys "chinsuke/..." and "lotso/..." are reachable only through whoIs(), which needs
 * both the roster id and the roster name of that one player; every other actor gets generic art or nothing. */
(function(root){
 'use strict';
 const pack={/*ART_PACK*/},bank=new Map(),hits={},flipped=new Map();
 let lastAthletic=null;
 // The owner's explicit instruction: the afro art is ちんすけ's alone, the purple-beard art is ロッツォ's alone.
 const EXCLUSIVE={'1-b2':{name:'ちんすけ',who:'chinsuke'},'1-b3':{name:'ロッツォ',who:'lotso'}};
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
   bank.set(key,{sprite:{pixels,size,originX:anchor,baseline:size-1,referenceHeight:row.referenceHeight,minX,minY,maxX,maxY,artBankV1:row.id},palette:colors,id:row.id,key});
  };
  image.src='data:image/png;base64,'+row.data;
 }
 for(const [key,row] of Object.entries(pack))decode(key,row);
 // Mirror image about the foot anchor. Used only for art with no glove or bat hand to swap (runner slides).
 function flip(found){
  if(flipped.has(found))return flipped.get(found);
  const s=found.sprite,size=s.size,pixels=new Uint16Array(s.pixels.length);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)pixels[y*size+x]=s.pixels[y*size+size-1-x];
  const copy={...found,sprite:{...s,pixels,originX:size-s.originX,minX:size-1-s.maxX,maxX:size-1-s.minX,viewMirrorX:true}};
  flipped.set(found,copy);return copy;
 }
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
 // The record's frames stop when the ball is dead; the picture goes on. Presentation time past the last frame is read
 // from the scene clock the same way the whiff follow-through does (release tick + elapsed scene seconds).
 function presentTick(record,frame,sceneMs,preparationMs){
  const first=record.frames?.[0]?.tick;
  if(!Number.isFinite(sceneMs)||!Number.isFinite(preparationMs)||first===undefined||sceneMs<preparationMs)return frame.tick;
  return Math.max(frame.tick,first+(sceneMs-preparationMs)/1000*ticksOf(record));
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
 function pick({role,action,frame,camera,hand,form,team,running,isRobin,pose,away,walking,who,art,athletic,motion,sx}){
  const kit=team===1?'home':'away',outfield=['LF','CF','RF'].includes(role);
  let key=null,found=null,mirror=false;
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
  else if(pose==='fly'&&!isRobin)key='fly/'+(outfield?'out':'in')+'/'+kit;
  else if(isRobin){if(action==='pitch')key='robin/pitch/'+(frame===0?0:frame<3?1:2);}
  else if(role==='P'&&art.pickoff&&camera!=='mound')key='pickoff/'+art.pickoff.base+'/'+art.pickoff.frame+'/'+kit;
  else if(action==='pitch'&&hand==='R'&&['over','side','under'].includes(form)&&frame>=0&&frame<6)key='pitch/'+form+'/'+frame;
  else if(action==='bat'&&camera==='mound'&&who&&art.hr!==undefined&&art.hr!==null)key='bat/hr/'+art.hr;
  else if(action==='bat'&&camera==='mound'&&who&&frame>=0&&frame<4&&!art.look&&bank.has(who+'/bat/mound/'+frame))key='bat/mound/'+frame;
  else if(action==='bat'&&art.look&&(hand==='R'||who)){
   const rear=camera!=='mound';
   key='look/'+(art.look==='up'?'look-up':art.look==='bent'?'bent-forward':'photo')+'-'+(rear?'rear':'front');
  }
  else if(action==='bat'&&camera!=='mound'&&hand==='R'&&frame>=0&&frame<4)key='bat/rear/'+frame;
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
  if(!found&&key){found=(who?bank.get(who+'/'+key):null)||bank.get(key);}
  if(!found)return null;
  hits[found.key]=(hits[found.key]??0)+1;
  return mirror?flip(found):found;
 }
 root.KneekuraArtBankV1=Object.freeze({pick,whoIs,actorArt,umpireArt,inspect:()=>({loaded:bank.size,total:Object.keys(pack).length,hits:{...hits},lastAthletic})});
})(globalThis);
