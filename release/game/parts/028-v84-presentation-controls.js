(function installPresentationControlsV84(root){
 'use strict';
 let settings=Object.freeze({frequencyScale:2,qualityScale:1.2});
 const ranges=new Map();
 const baseSceneMs=55/3;
 // V1: what looks coarse is the size of one dot on the screen. A phone shows a dot of about 2.2 CSS px
 // (quality 1.2 at 0.65 CSS px per drawing unit). A larger canvas gets a finer grid so a dot stays about
 // that size. Display only. A caller that sets qualityScale itself turns this off. If heavy scene draws
 // take longer than heavyDrawMs the ceiling drops one tier, so a slow machine never ends up worse off.
 const qualityTiers=Object.freeze([1.2,1.5,2]),phoneDotCssPx=4/1.2*.65,heavyDrawMs=100;
 let autoQuality=true,qualityCeiling=qualityTiers.at(-1),fieldCssWidth=0,heavyDraws=[];
 const recommendQuality=width=>{const want=4*(width/600)/phoneDotCssPx;let best=qualityTiers[0];for(const tier of qualityTiers)if(tier<=want+.02&&tier<=qualityCeiling)best=tier;return best;};
 function applyAutoQuality(){if(!autoQuality||!(fieldCssWidth>0))return;const next=recommendQuality(fieldCssWidth);if(next!==settings.qualityScale)apply({qualityScale:next},true);}
 // Called with the milliseconds one scene draw took while the scene plays. Cheap draws (cached views) are not counted.
 function noteDraw(ms){
  if(!autoQuality||!Number.isFinite(ms)||ms<24||settings.qualityScale<=qualityTiers[0])return;
  heavyDraws.push(ms);if(heavyDraws.length<6)return;
  const median=heavyDraws.slice().sort((a,b)=>a-b)[heavyDraws.length>>1];heavyDraws=[];
  if(median>heavyDrawMs){qualityCeiling=qualityTiers[Math.max(0,qualityTiers.indexOf(settings.qualityScale)-1)];
   // The caller is inside a draw, and a quality change redraws: let it finish first.
   root.setTimeout(applyAutoQuality,0);}
 }
 function apply(input,auto){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('presentation controls: data settings object required');
  const patch={};
  for(const key of Reflect.ownKeys(input)){
   if(!['frequencyScale','qualityScale'].includes(key))throw Error('presentation controls: unknown setting '+String(key));
   const d=Object.getOwnPropertyDescriptor(input,key);
   if(!d||!Object.hasOwn(d,'value'))throw Error('presentation controls: data setting required');
   const value=d.value,max=key==='frequencyScale'?4:2;
   if(typeof value!=='number'||!Number.isFinite(value)||value<1||value>max)throw Error('presentation controls: setting outside 1..'+max);
   patch[key]=value;
  }
  if(!auto&&Object.hasOwn(patch,'qualityScale'))autoQuality=false;
  const previousQuality=settings.qualityScale;settings=Object.freeze({...settings,...patch});
  if(previousQuality!==settings.qualityScale)ranges.clear();
  if(typeof root.dispatchEvent==='function'&&typeof root.CustomEvent==='function')root.dispatchEvent(new root.CustomEvent('kneekura:presentation-controls-v84',{detail:inspect()}));
  return inspect();
 }
 const configure=input=>apply(input,false);
 function intervalMs({kind=null,free=false,possessed=null}={}){return baseSceneMs/settings.frequencyScale/(free&&!possessed?(kind==='pitch'?2.5:kind==='batted'?2:1):1);}
 function intervalAtPlayback(playback,sceneMs){
  if(playback.isFreePitchAtPresentationMs(sceneMs))return intervalMs({kind:'pitch',free:true});
  const s=playback.inspect(),record=s.host?.history?.[s.selectedPitch],prep=s.presentation?.timing?.preparationMs;
  if(!record?.frames?.length||!Number.isFinite(prep)||sceneMs<prep)return intervalMs();
  const tick=record.frames[0].tick+(sceneMs-prep)/1000*record.play.diagnostics.sourceClockTicksPerSecond;
  let lo=0,hi=record.frames.length;while(lo<hi){const middle=Math.floor((lo+hi)/2);if(record.frames[middle].tick<=tick)lo=middle+1;else hi=middle;}
  const frame=record.frames[Math.max(0,lo-1)],b=frame.ball;
  return intervalMs({kind:frame.ballKind,free:!!b&&b.visible!==false&&!b.possessedBy&&!b.custody,possessed:frame.possessedBy});
 }
 const step=()=>4/settings.qualityScale,index=value=>Math.round(value*settings.qualityScale/4),coordinate=i=>i*4/settings.qualityScale,
  aligned=value=>Number.isFinite(value)&&Math.abs(value*settings.qualityScale/4-index(value))<1e-8;
 const grid=Object.freeze({step,index,coordinate,aligned,snap:value=>coordinate(index(value)),
  floor:value=>coordinate(Math.floor(value*settings.qualityScale/4)),ceil:value=>coordinate(Math.ceil(value*settings.qualityScale/4)),
  range(from,to){
   const first=Math.ceil(from*settings.qualityScale/4-1e-9),last=Math.floor(to*settings.qualityScale/4+1e-9),key=first+':'+last;
   if(ranges.has(key))return ranges.get(key);
   const out=[];for(let i=first;i<=last;i++)out.push(coordinate(i));
   if(ranges.size>=256)ranges.delete(ranges.keys().next().value);
   Object.freeze(out);ranges.set(key,out);return out;
  },
  key:(x,y)=>settings.qualityScale===1||!Number.isFinite(x)||!Number.isFinite(y)?(Number.isFinite(x)&&Number.isFinite(y)?x*512+y:x+','+y):index(x)*1024+index(y)});
 function inspect(){return Object.freeze({...settings,baseSceneMs,sceneMs:intervalMs(),pitchMs:intervalMs({kind:'pitch',free:true}),battedMs:intervalMs({kind:'batted',free:true}),gridStep:step(),qualityAuto:autoQuality,qualityCeiling,fieldCssWidth,authority:'READ_ONLY_PRESENTATION_CONVENTION',rafLimited:true});}
 // The canvas is shown at a different size per layout (phone, tablet, PC), so follow its displayed width.
 try{
  const field=root.document?.getElementById('field');
  if(field&&typeof root.ResizeObserver==='function'){let queued=false;
   new root.ResizeObserver(()=>{if(queued)return;queued=true;root.requestAnimationFrame(()=>{queued=false;fieldCssWidth=field.getBoundingClientRect().width;applyAutoQuality();});}).observe(field);}
 }catch{}
 root.KneekuraPresentationControlsV84=Object.freeze({version:84,configure,noteDraw,inspect,intervalMs,intervalAtPlayback,grid,
  get qualityScale(){return settings.qualityScale;},get frequencyScale(){return settings.frequencyScale;}});
})(globalThis);