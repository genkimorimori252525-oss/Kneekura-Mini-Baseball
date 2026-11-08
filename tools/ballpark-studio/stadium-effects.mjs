// Presentation only: never uses the match clock, match RNG or gameplay physics.
export const FIREWORK_DURATION_MS=5400,MAX_FIREWORK_POINTS=512;
export function defaultEffects(a){return{version:1,lighting:{enabled:true,brightness:1,color:'#ffffff'},fireworks:{enabled:true,autoHomeRun:false,
 colors:a?.style==='niikura_dome'?[a.colors.blue,a.colors.red]:a?.style==='koshien'?['#ffd33c','#f6e9b1']:a?.style==='dodger_stadium'?['#3b86e8','#e3ecfa']:[a?.colors.red??'#cf3651',a?.colors.blue??'#407ce0'],x:0,z:a?.style==='koshien'?210:a?.style==='dodger_stadium'?250:350,height:a?.style==='koshien'?82:a?.style==='dodger_stadium'?100:140,size:28,variation:.65}};}
export function validateEffects(e,error){
 const fields=(o,keys,path)=>{if(!o||typeof o!=='object'||Array.isArray(o)){error(path,'演出設定をオブジェクトで指定してください');return false;}for(const k of Object.keys(o))if(!keys.includes(k))error(path+'.'+k,'対応していない演出項目です');return true;},
 number=(v,min,max,path)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)error(path,`${min}〜${max}の数値を入力してください`);},color=c=>typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c),root='architecture.effects';
 if(!fields(e,['version','lighting','fireworks','environment'],root))return;if(e.version!==1)error(root+'.version','対応していない演出設定の版です');
 if(e.environment!==undefined&&fields(e.environment,['period','weather','flags','wind'],root+'.environment')){if(!['day','night'].includes(e.environment.period))error(root+'.environment.period','昼か夜を指定してください');if(!['clear','cloudy'].includes(e.environment.weather))error(root+'.environment.weather','晴れか曇りを指定してください');if(typeof e.environment.flags!=='boolean')error(root+'.environment.flags','旗の動作を指定してください');if(e.environment.wind!==undefined&&fields(e.environment.wind,['directionDegrees','speedMps'],root+'.environment.wind')){number(e.environment.wind.directionDegrees,0,359,root+'.environment.wind.directionDegrees');number(e.environment.wind.speedMps,0,30,root+'.environment.wind.speedMps');}}
 if(fields(e.lighting,['enabled','brightness','color'],root+'.lighting')){if(typeof e.lighting.enabled!=='boolean')error(root+'.lighting.enabled','照明の点灯状態を指定してください');number(e.lighting.brightness,0,2.5,root+'.lighting.brightness');if(!color(e.lighting.color))error(root+'.lighting.color','色は # と6桁の16進数で指定してください');}
 if(fields(e.fireworks,['enabled','autoHomeRun','colors','x','z','height','size','variation'],root+'.fireworks')){const f=e.fireworks;for(const k of ['enabled','autoHomeRun'])if(typeof f[k]!=='boolean')error(root+'.fireworks.'+k,'有効・無効を指定してください');if(!Array.isArray(f.colors)||f.colors.length!==2||!f.colors.every(color))error(root+'.fireworks.colors','6桁の16進数の色を2つ指定してください');for(const[k,min,max]of [['x',-350,350],['z',-150,500],['height',40,180],['size',5,35]])number(f[k],min,max,root+'.fireworks.'+k);if(f.variation!==undefined)number(f.variation,0,1,root+'.fireworks.variation');}
}
const colorCache=new Map();let lightSource=null,lightNeutral=true,lightGain=1,lightTint=[1,1,1];
export const emissiveSurface=id=>/score|clock|lamp/.test(id??'');
export const neutralLighting=l=>!l||l.enabled&&l.brightness===1&&l.color.toLowerCase()==='#ffffff';
export function lightColor(color,lighting,emissive=false){
 if(!lighting||emissive)return color;
 // Validated geometry is immutable; prepare a transform once per settings object.
 if(lighting!==lightSource){colorCache.clear();lightSource=lighting;lightNeutral=neutralLighting(lighting);lightGain=lighting.enabled ? .2+.8*lighting.brightness : .2;lightTint=[1,3,5].map(i=>lighting.enabled ? .25+.75*parseInt(lighting.color.slice(i,i+2),16)/255 : 1);}
 if(lightNeutral)return color;if(colorCache.has(color))return colorCache.get(color);
 const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)),value='#'+rgb.map((v,i)=>Math.max(0,Math.min(255,Math.round(v*lightGain*lightTint[i]))).toString(16).padStart(2,'0')).join('');
 if(colorCache.size>=512)colorCache.delete(colorCache.keys().next().value);colorCache.set(color,value);return value;
}
export function eventSeed(id){let s=2166136261;for(const c of id)s=Math.imul(s^c.charCodeAt(0),16777619);return s>>>0;}
const directions=Array.from({length:48},(_,i)=>{const y=1-2*(i+.5)/48,r=Math.sqrt(1-y*y),a=i*2.399963229728653;return{x:r*Math.cos(a),y,z:r*Math.sin(a)};});
const sparkColors=new Map();
function sparkColor(color){if(sparkColors.has(color))return sparkColors.get(color);const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)),scale=255/Math.max(1,...rgb),value='#'+rgb.map(v=>Math.round(v*scale*.85+255*.15).toString(16).padStart(2,'0')).join('');if(sparkColors.size>=64)sparkColors.delete(sparkColors.keys().next().value);sparkColors.set(color,value);return value;}
export function fireworkShells(f,seed=0){return Array.from({length:3},(_,i)=>{const r=k=>eventSeed(seed+':'+i+':'+k)/4294967295-.5,v=f.variation??0;return{height:f.height*(1+v*.5*r('h')),size:f.size*(1+v*.8*r('r')),delay:i*.45+v*.12*(r('t')+.5)};});}
export function sampleFireworks(f,timeMs,seed=0){if(!f.enabled||timeMs<0||timeMs>=FIREWORK_DURATION_MS)return[];
 const points=[],phase=(seed%360)*Math.PI/180,cs=Math.cos(phase),sn=Math.sin(phase),point=(p,color,alpha,glow)=>{if(p.y>=0)points.push({...p,color,alpha,glow});};
 const shells=fireworkShells(f,seed);for(let shell=0;shell<3;shell++){const config=shells[shell],age=timeMs/1000-config.delay,base={x:f.x+(shell-1)*f.size*1.8,z:f.z+shell*5},color=sparkColor(f.colors[shell%2]);if(age<0)continue;
  if(age<1.25){for(let trail=0;trail<5;trail++){const t=Math.max(0,age-trail*.028)/1.25;point({...base,y:config.height*(1-(1-t)**2)},color,(1-trail/6)*.9,trail?1:4);}continue;}
  const t=age-1.25;if(t>2.9)continue;const fade=Math.min(1,((1-t/2.9)**1.3)*1.8);
  for(const d of directions)for(let trail=0;trail<3;trail++){const r=config.size*(1-Math.exp(-t*2.2))*[1,.82,.64][trail],x=d.x*cs-d.z*sn,z=d.x*sn+d.z*cs;
   point({x:base.x+x*r,y:config.height+d.y*r-3.2*t*t,z:base.z+z*r},color,fade*[1,.4,.12][trail],trail?.6:2.5*fade);}
 }
 return points;
}
export function createFireworksPlayback({clock=()=>performance.now()}={}){
 let last=clock(),elapsed=0,playing=false,paused=false,hidden=false,id=null,seed=0;const seen=new Set();
 const sync=()=>{const now=clock();if(playing&&!paused&&!hidden)elapsed+=Math.max(0,now-last);last=now;if(elapsed>=FIREWORK_DURATION_MS){elapsed=FIREWORK_DURATION_MS;playing=false;}};
 function inspect(){sync();return{playing,paused,hidden,elapsedMs:elapsed,id,seed,active:playing&&!paused&&!hidden,durationMs:FIREWORK_DURATION_MS};}
 function start(event,{reducedMotion=false}={}){if(!event||!['manual','home_run'].includes(event.type)||typeof event.id!=='string'||!event.id||event.id.length>120)throw Error('花火には種類と120文字以内のイベントIDが必要です');sync();if(seen.has(event.id))return{accepted:false,reason:'duplicate'};seen.add(event.id);if(seen.size>64)seen.delete(seen.values().next().value);id=event.id;seed=eventSeed(id);elapsed=reducedMotion?2600:0;playing=true;paused=reducedMotion;return{accepted:true,...inspect()};}
 function configure(options){if(!options||Object.keys(options).some(k=>!['paused','hidden'].includes(k))||Object.values(options).some(v=>typeof v!=='boolean'))throw Error('花火の停止状態はtrue/falseで指定してください');sync();if('paused'in options)paused=options.paused;if('hidden'in options)hidden=options.hidden;return inspect();}
 function stop(){sync();playing=false;elapsed=0;id=null;return inspect();}
 return Object.freeze({inspect,start,configure,stop});
}
