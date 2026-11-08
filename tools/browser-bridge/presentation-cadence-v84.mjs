/** One Presentation-only clock policy, shared by every observer. */
function installPresentationControlsV84(root){
 'use strict';
 let settings=Object.freeze({frequencyScale:2,qualityScale:1.2});
 const ranges=new Map();
 const baseSceneMs=55/3;
 function configure(input={}){
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
  const previousQuality=settings.qualityScale;settings=Object.freeze({...settings,...patch});
  if(previousQuality!==settings.qualityScale)ranges.clear();
  if(typeof root.dispatchEvent==='function'&&typeof root.CustomEvent==='function')root.dispatchEvent(new root.CustomEvent('kneekura:presentation-controls-v84',{detail:inspect()}));
  return inspect();
 }
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
 function inspect(){return Object.freeze({...settings,baseSceneMs,sceneMs:intervalMs(),pitchMs:intervalMs({kind:'pitch',free:true}),battedMs:intervalMs({kind:'batted',free:true}),gridStep:step(),authority:'READ_ONLY_PRESENTATION_CONVENTION',rafLimited:true});}
 root.KneekuraPresentationControlsV84=Object.freeze({version:84,configure,inspect,intervalMs,intervalAtPlayback,grid,
  get qualityScale(){return settings.qualityScale;},get frequencyScale(){return settings.frequencyScale;}});
}
export const presentationControlsSourceV84='('+installPresentationControlsV84.toString()+')(globalThis);';
const once=(source,a,b)=>{if(source.split(a).length!==2)throw Error('V84 cadence marker differs: '+a.slice(0,90));return source.replace(a,()=>b);};
export function applyPresentationCadenceV84(source){
 let html=once(source,'<script>/* Kneekura Browser Match Slice v23','<script id="v84-presentation-controls">'+presentationControlsSourceV84+'</script>\n<script>/* Kneekura Browser Match Slice v23');
 html=once(html,'effectiveSceneMs:55/3,effectiveFreePitchMs:22/3,ballOnlyPainting:false',"get effectiveSceneMs(){return window.KneekuraPresentationControlsV84.intervalMs();},get effectiveFreePitchMs(){return window.KneekuraPresentationControlsV84.intervalMs({kind:'pitch',free:true});},get effectiveBattedMs(){return window.KneekuraPresentationControlsV84.intervalMs({kind:'batted',free:true});},ballOnlyPainting:false");
 html=once(html,'periodV81=boundaryV81[7]?cadence.effectiveFreePitchMs:cadence.effectiveSceneMs,elapsedV81=now-lastDraw;',`cadenceFrameV84=activeResult()?(sceneStage()==='preparation'?activeResult().beforeFrame:activeResult().frames[frameIndex]):currentFrame,
    periodV81=window.KneekuraPresentationControlsV84.intervalMs({kind:cadenceFrameV84?.ballKind,
     free:boundaryV81[7]||cadenceFrameV84?.ballKind==='batted'&&cadenceFrameV84?.ball?.visible!==false&&!cadenceFrameV84?.possessedBy&&!cadenceFrameV84?.ball?.possessedBy&&!cadenceFrameV84?.ball?.custody,
     possessed:cadenceFrameV84?.possessedBy}),elapsedV81=now-lastDraw;`);
 html=once(html,'// Preserve the original 55:22 scene ratio at triple frequency, capped by','// V84 shared whole-scene frequency; pitch 2.5x and free batted 2x, capped by');
 html=once(html,' function syncNameDisplay(){'," window.addEventListener('kneekura:presentation-controls-v84',()=>draw());\n function syncNameDisplay(){");
 return html;
}
