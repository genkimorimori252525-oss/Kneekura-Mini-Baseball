const reactions=Object.freeze({hit:{interval:95,duration:2400,priority:2},home_run:{interval:80,duration:4500,priority:3},out:{interval:140,duration:1400,priority:1},error:{interval:120,duration:1800,priority:1}});
export const DEFAULT_CROWD_APPEARANCE=Object.freeze({density:.75,detail:'simple',size:1,brightness:1,glow:.7});
export const PENLIGHT_LENGTH_METERS=.07;
const groupSeed=index=>(Math.imul(index+1,2654435761)^(index>>>4))>>>0;
export const includeCrowd=(index,density)=>groupSeed(index)/4294967296<density;
/** A presentation clock. It consumes observations and never decides a baseball result. */
export function createCrowdPlayback({clock=()=>performance.now(),paused=false}={}){
 let last=clock(),elapsed=0,frames=3,pattern='223',visible=true,hidden=false,userPaused=paused,reaction=null;const seen=new Set();
 const sync=()=>{const now=clock();if(visible&&!hidden&&!userPaused)elapsed+=Math.max(0,now-last);last=now;if(reaction&&elapsed>=reaction.until)reaction=null;};
 function inspect(){sync();const interval=reaction?reactions[reaction.type].interval:400,sequence=frames===2?[0,1]:pattern==='223'?[0,2,0,2,0,1,2]:[0,1,2,1];
  return {visible,paused:userPaused,hidden,frames,pattern,loopFrames:sequence.length,frame:sequence[Math.floor(elapsed/interval)%sequence.length],intervalMs:interval,
   nextInMs:Math.max(1,interval-elapsed%interval),active:visible&&!hidden&&!userPaused,reaction:reaction?.type??null,elapsedMs:elapsed};}
 function configure(options){const allowed=['visible','paused','hidden','frames','pattern'];if(!options||Object.keys(options).some(k=>!allowed.includes(k)))throw Error('観客の表示・停止・コマ数・ループだけを設定できます');
  for(const k of ['visible','paused','hidden'])if(k in options&&typeof options[k]!=='boolean')throw Error('観客の表示・停止はtrue/falseで指定してください');
  if('frames' in options&&![2,3].includes(options.frames))throw Error('観客は2コマか3コマを指定してください');
  if('pattern'in options&&!['223','uniform'].includes(options.pattern))throw Error('ループは223かuniformを指定してください');sync();
  if('visible'in options)visible=options.visible;if('paused'in options)userPaused=options.paused;if('hidden'in options)hidden=options.hidden;
  if('frames'in options){frames=options.frames;if(!('pattern'in options))pattern='uniform';}if('pattern'in options){pattern=options.pattern;if(pattern==='223')frames=3;}return inspect();}
 function react(event){if(!event||!Object.hasOwn(reactions,event.type)||typeof event.id!=='string'||!event.id||event.id.length>120)throw Error('反応はhit/home_run/out/errorと固有のイベントIDを指定してください');
  sync();if(seen.has(event.id))return {accepted:false,reason:'duplicate'};seen.add(event.id);if(seen.size>64)seen.delete(seen.values().next().value);
  if(reaction&&reactions[reaction.type].priority>reactions[event.type].priority)return {accepted:false,reason:'lower_priority'};
  reaction={type:event.type,until:elapsed+reactions[event.type].duration};return {accepted:true,...inspect()};}
 return Object.freeze({inspect,configure,react});
}
const ledColors=new Map();
export function ledColor(hex){if(ledColors.has(hex))return ledColors.get(hex);const rgb=hex.slice(1).match(/../g).map(v=>parseInt(v,16)),scale=255/Math.max(1,...rgb),
 color='#'+rgb.map(v=>Math.round(Math.min(255,v*scale)*.88+255*.12).toString(16).padStart(2,'0')).join('');ledColors.set(hex,color);return color;}
/** Small world-space symbols represent groups of spectators, not simulation actors. */
export function crowdSymbol(light,index,frame,frames,colors,appearance=DEFAULT_CROWD_APPEARANCE){const offset=groupSeed(index)%frames,
 phase=(frame+offset)%frames,angle=frames===2?[-.65,.65][phase]:[-.7,0,.7][phase],
 p=light.p,t=Math.atan2(p.x,p.z),size=appearance.size,
 base={x:p.x+Math.cos(t)*Math.sin(angle)*.3*size,y:p.y+(1.1+Math.cos(angle)*.22)*size,z:p.z-Math.sin(t)*Math.sin(angle)*.3*size},
 tip={x:base.x+Math.cos(t)*Math.sin(angle)*PENLIGHT_LENGTH_METERS,y:base.y+Math.cos(angle)*PENLIGHT_LENGTH_METERS,z:base.z-Math.sin(t)*Math.sin(angle)*PENLIGHT_LENGTH_METERS},
 color=ledColor(colors[index%colors.length]).slice(1).match(/../g).map(v=>Math.min(255,Math.round(parseInt(v,16)*appearance.brightness)).toString(16).padStart(2,'0')).join('');
 return {body:p,head:{...p,y:p.y+.95*size},base,tip,color:'#'+color,phase,penLengthMeters:PENLIGHT_LENGTH_METERS};}
