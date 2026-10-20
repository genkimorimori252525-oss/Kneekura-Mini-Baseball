/** Presentation-only, fail-closed patches for the frozen v79 renderer.
 * No trajectory, physical time, Host command or label measurement is cached. */
const frameMarker='  frameIndex=0;while(frameIndex+1<result.frames.length&&result.frames[frameIndex+1].tick<=tick)frameIndex++;';
const labelsMarker=` function labels(){
  labelHost.replaceChildren();if(!state.labels)return;
  const visibleLabels=labelPositions.filter(p=>!observed.liveObservation||p.id!=='BAT'||
   (p.role==='runner'&&observed.liveBatterRunStarted));
  const sx=labelHost.clientWidth/600,sy=labelHost.clientHeight/432;
  const nameScale=window.KneekuraNameDisplayControls?.inspect().scale??1;
  labelHost.style.setProperty('--kneekura-name-scale',String(nameScale));
  // All cameras retain the actual projected anchor. Do not stagger or hide a
  // name merely because another label or the ball occupies the same rectangle.
  // The label host is a stacking context below the transparent ball overlay.
  const ranked=[...visibleLabels].sort((a,b)=>Number(a.role==='runner')-Number(b.role==='runner'));
  for(const p of ranked){
   const outfield=['LF','CF','RF'].includes(p.id);
   const baseFont=outfield?Math.max(11,Math.min(15,p.fontPx)):Math.max(9,Math.min(18,p.fontPx));
   const font=baseFont*nameScale,el=document.createElement('span');el.textContent=p.name;
   el.dataset.actor=p.id;el.dataset.role=p.role;el.dataset.nameScale=String(nameScale);
   el.style.setProperty('--kneekura-name-base-font',baseFont*sx+'px');
   el.style.fontSize='calc(var(--kneekura-name-base-font) * var(--kneekura-name-scale))';
   el.style.whiteSpace='nowrap';el.style.zIndex=p.role==='runner'?'3':'1';
   if(p.role==='runner')el.style.color='#ff7777';labelHost.append(el);
   const rect=el.getBoundingClientRect(),w=rect.width/sx,h=rect.height/sy,gap=Math.max(2,font*.15);
   const box={x:p.nameAnchor.x-w/2,y:p.nameAnchor.y-h-gap,w,h};
   el.style.left=box.x*sx+'px';el.style.top=box.y*sy+'px';p.labelBox=box;p.nameDisplayScale=nameScale;
  }
 }
`;
const labelsReplacement=` const labelNodesV81=new Map();
 const labelStyleInputsV81=new WeakMap();
 function labelStyleV81(el,key,value){
  const current=el.style.getPropertyValue(key),inputs=labelStyleInputsV81.get(el)||new Map(),previous=inputs.get(key);
  // CSSOM can round pixel values. Compare both the exact input and its applied
  // representation, while still repairing an external inline-style change.
  if(previous?.input===value&&previous.applied===current)return;
  if(current!==value)el.style.setProperty(key,value);
  inputs.set(key,{input:value,applied:el.style.getPropertyValue(key)});labelStyleInputsV81.set(el,inputs);
 }
 function labelDataV81(el,key,value){value=String(value);if(el.dataset[key]!==value)el.dataset[key]=value;}
 function labels(){
  if(!state.labels){if(labelHost.childNodes.length)labelHost.replaceChildren();labelNodesV81.clear();return;}
  const visibleLabels=labelPositions.filter(p=>!observed.liveObservation||p.id!=='BAT'||
   (p.role==='runner'&&observed.liveBatterRunStarted));
  const sx=labelHost.clientWidth/600,sy=labelHost.clientHeight/432;
  const nameScale=window.KneekuraNameDisplayControls?.inspect().scale??1;
  labelStyleV81(labelHost,'--kneekura-name-scale',String(nameScale));
  // Preserve the original stable runner-last stacking and actor occurrence order.
  const ranked=[...visibleLabels].sort((a,b)=>Number(a.role==='runner')-Number(b.role==='runner'));
  const nextNodes=new Map(),entries=[];
  for(const p of ranked){
   const pool=nextNodes.get(p.id)||[],el=labelNodesV81.get(p.id)?.[pool.length]||document.createElement('span');
   pool.push(el);nextNodes.set(p.id,pool);entries.push({p,el});
  }
  const wanted=new Set(entries.map(entry=>entry.el));
  for(const child of Array.from(labelHost.childNodes))if(!wanted.has(child))labelHost.removeChild(child);
  labelNodesV81.clear();for(const [id,pool]of nextNodes)labelNodesV81.set(id,pool);
  for(let index=0;index<entries.length;index++){
   const {p,el}=entries[index],outfield=['LF','CF','RF'].includes(p.id);
   const baseFont=outfield?Math.max(11,Math.min(15,p.fontPx)):Math.max(9,Math.min(18,p.fontPx));
   const font=baseFont*nameScale;if(el.textContent!==p.name)el.textContent=p.name;
   labelDataV81(el,'actor',p.id);labelDataV81(el,'role',p.role);labelDataV81(el,'nameScale',nameScale);
   labelStyleV81(el,'--kneekura-name-base-font',baseFont*sx+'px');
   labelStyleV81(el,'font-size','calc(var(--kneekura-name-base-font) * var(--kneekura-name-scale))');
   labelStyleV81(el,'white-space','nowrap');labelStyleV81(el,'z-index',p.role==='runner'?'3':'1');
   const color=p.role==='runner'?'rgb(255, 119, 119)':'';
   // A newly added runner color precedes left/top in the original cssText.
   if(color&&el.style.getPropertyValue('color')!==color){el.style.removeProperty('left');el.style.removeProperty('top');}
   labelStyleV81(el,'color',color);
   if(labelHost.children[index]!==el)labelHost.insertBefore(el,labelHost.children[index]||null);
   // Measure the live DOM on every draw: no font/resize/host-size invalidation seam.
   const rect=el.getBoundingClientRect(),w=rect.width/sx,h=rect.height/sy,gap=Math.max(2,font*.15);
   const box={x:p.nameAnchor.x-w/2,y:p.nameAnchor.y-h-gap,w,h};
   const left=box.x*sx,top=box.y*sy;
   labelStyleV81(el,'left',Number.isFinite(left)?left+'px':'');labelStyleV81(el,'top',Number.isFinite(top)?top+'px':'');p.labelBox=box;p.nameDisplayScale=nameScale;
  }
 }
`;
function replaceExactlyOnce(html,marker,replacement,label){
  const first=html.indexOf(marker);if(first<0||html.indexOf(marker,first+marker.length)>=0)throw Error('v81 presentation UI marker differs: '+label);
  return html.slice(0,first)+replacement+html.slice(first+marker.length);
}
export function applyPresentationUiPerformanceV81(html){
  if(typeof html!=='string')throw TypeError('v81 presentation UI requires HTML text');
  const eol=html.includes(' function setSceneTime(value){\r\n')?'\r\n':'\n';
  const frameReplacement=[
    '  let lowerV81=0,upperV81=result.frames.length;',
    '  while(lowerV81<upperV81){const middleV81=Math.floor((lowerV81+upperV81)/2);',
    '   if(result.frames[middleV81].tick<=tick)lowerV81=middleV81+1;else upperV81=middleV81;}',
    '  frameIndex=Math.max(0,lowerV81-1);',
  ].join(eol);
  const next=replaceExactlyOnce(html,frameMarker,frameReplacement,'setSceneTime frame search');
  return replaceExactlyOnce(next,labelsMarker,labelsReplacement,'broadcast labels');
}
