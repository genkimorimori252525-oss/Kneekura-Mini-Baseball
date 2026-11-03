(function installPresentationControlsV84(root){
 'use strict';
 let settings=Object.freeze({frequencyScale:3,qualityScale:1.2});
 const ranges=new Map();
 const baseSceneMs=55/3;
 // V1: what looks coarse is the size of one dot on the screen. A phone shows a dot of about 2.2 CSS px
 // (quality 1.2 at 0.65 CSS px per drawing unit). A larger canvas gets a finer grid so a dot stays about
 // that size. Display only. A caller that sets qualityScale itself turns this off. If heavy scene draws
 // take longer than heavyDrawMs the ceiling drops one tier, so a slow machine never ends up worse off.
 // On a PC (the picture at least PC_MIN_CSS_PX wide) the finest tier is 1.4 times finer again, and the canvas gets 1.4 times the
 // pixels with it, so a dot keeps its size on screen and there are 1.4 times as many each way. Phones stay as they were.
 const qualityTiers=Object.freeze([1.2,1.5,2,2.8]),phoneDotCssPx=4/1.2*.65,heavyDrawMs=100,PC_TIER=2.8,PC_MIN_CSS_PX=700;
 // A slow view lowers only its own ceiling: the pitcher and runner views move the stadium every frame, the catcher view does not.
 let autoQuality=true,fieldCssWidth=0,heavyDraws=[];
 const ceilings=new Map(),view=()=>root.document?.querySelector('[data-camera][aria-pressed="true"]')?.dataset.camera??'',
  ceiling=()=>ceilings.get(view())??qualityTiers.at(-1);
 const recommendQuality=width=>{const want=4*(width/600)/phoneDotCssPx,top=ceiling();let best=qualityTiers[0];for(const tier of qualityTiers)if(tier<PC_TIER&&tier<=want+.02&&tier<=top)best=tier;
  return best===2&&width>=PC_MIN_CSS_PX&&top>=PC_TIER?PC_TIER:best;};
 // Canvas pixels per drawing unit: 2, or 2.8 at the PC tier.
 const canvasScale=quality=>quality>=PC_TIER?2.8:2;
 function sizeCanvases(){
  const scale=canvasScale(settings.qualityScale),width=Math.round(600*scale),height=Math.round(432*scale);
  for(const id of ['field','ball-overlay','bat-overlay']){const c=root.document?.getElementById(id);if(c&&(c.width!==width||c.height!==height)){c.width=width;c.height=height;}}
 }
 function applyAutoQuality(){if(!autoQuality||!(fieldCssWidth>0))return;const next=recommendQuality(fieldCssWidth);if(next!==settings.qualityScale)apply({qualityScale:next},true);}
 // Called with the milliseconds one scene draw took while the scene plays. Cheap draws (cached views) are not counted.
 function noteDraw(ms){
  if(!autoQuality||!Number.isFinite(ms)||ms<24||settings.qualityScale<=qualityTiers[0])return;
  heavyDraws.push(ms);if(heavyDraws.length<3)return;
  const median=heavyDraws.slice().sort((a,b)=>a-b)[heavyDraws.length>>1];heavyDraws=[];
  // The cost grows with the number of dots, the square of the tier: go straight to the tier that fits.
  if(median>heavyDrawMs){const fits=settings.qualityScale*Math.sqrt(heavyDrawMs/median),below=qualityTiers.filter(t=>t<settings.qualityScale);
   ceilings.set(view(),below.filter(t=>t<=fits).at(-1)??below.at(-1)??qualityTiers[0]);
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
   const value=d.value,max=key==='frequencyScale'?4:3;
   if(typeof value!=='number'||!Number.isFinite(value)||value<1||value>max)throw Error('presentation controls: setting outside 1..'+max);
   patch[key]=value;
  }
  if(!auto&&Object.hasOwn(patch,'qualityScale'))autoQuality=false;
  const previousQuality=settings.qualityScale;settings=Object.freeze({...settings,...patch});
  if(previousQuality!==settings.qualityScale){ranges.clear();sizeCanvases();}
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
 function inspect(){return Object.freeze({...settings,baseSceneMs,sceneMs:intervalMs(),pitchMs:intervalMs({kind:'pitch',free:true}),battedMs:intervalMs({kind:'batted',free:true}),gridStep:step(),qualityAuto:autoQuality,qualityCeiling:ceiling(),qualityCeilings:Object.fromEntries(ceilings),fieldCssWidth,authority:'READ_ONLY_PRESENTATION_CONVENTION',rafLimited:true});}
 // The canvas is shown at a different size per layout (phone, tablet, PC), so follow its displayed width.
 try{
  const field=root.document?.getElementById('field');
  if(field&&typeof root.ResizeObserver==='function'){let queued=false;
   root.document.addEventListener('click',e=>{if(e.target.closest?.('[data-camera]'))root.setTimeout(()=>{heavyDraws=[];applyAutoQuality();},0);});
   new root.ResizeObserver(()=>{if(queued)return;queued=true;root.requestAnimationFrame(()=>{queued=false;fieldCssWidth=field.getBoundingClientRect().width;applyAutoQuality();});}).observe(field);}
 }catch{}
 root.KneekuraPresentationControlsV84=Object.freeze({version:84,configure,noteDraw,inspect,intervalMs,intervalAtPlayback,grid,canvasScale:()=>canvasScale(settings.qualityScale),
  get qualityScale(){return settings.qualityScale;},get frequencyScale(){return settings.frequencyScale;}});
})(globalThis);