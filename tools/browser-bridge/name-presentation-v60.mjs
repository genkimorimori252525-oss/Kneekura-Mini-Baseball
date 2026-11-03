import {createHash} from 'node:crypto';

const sha=value=>createHash('sha256').update(value).digest('hex');
function once(source,from,to){
 if(source.split(from).length!==2)throw new Error('v60 name presentation marker: '+from.slice(0,100));
 return source.replace(from,()=>to);
}

// Kept as a narrowly pinned transform because the frozen HTML owns this renderer.
// The caller embeds live-name-display-controls-v60.js before the live Host starts.
export function applyNamePresentationV60(game){
 const startMarker=' function labels(){',endMarker=' function chooseCamera(){';
 if(game.split(startMarker).length!==2||game.split(endMarker).length!==2)throw new Error('v60 name renderer boundary');
 const start=game.indexOf(startMarker),end=game.indexOf(endMarker,start),previous=game.slice(start,end);
 if(sha(previous)!=='4a572842f3d803c443574efc113d15fcdb3a5c9174afc127ca6c0e57a905e6ef')throw new Error('Frozen v59 name renderer SHA mismatch');
 const labels=` function labels(){
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
 game=game.slice(0,start)+labels+game.slice(end);
 game=once(game,'.actor-labels{position:absolute;inset:0;pointer-events:none}',
  '.actor-labels{position:absolute;inset:0;pointer-events:none;z-index:1;--kneekura-name-scale:1}.ball-overlay{z-index:2}');
 const nameFunctions=`function syncNameDisplay(){const input=$('name-display-scale');if(input)input.value=window.KneekuraNameDisplayControls.inspect().scale;}
 function setNameDisplay(patch){return window.KneekuraNameDisplayControls.configure(patch);}
 window.addEventListener('kneekura:name-display-change',()=>{syncNameDisplay();draw();});
 `;
 game=once(game,'function syncBallDisplay(){',nameFunctions+'function syncBallDisplay(){');
 const namePanel=`const nameDisplayPanel=document.createElement('details');nameDisplayPanel.id='name-display-controls';nameDisplayPanel.style.padding='12px 18px';
 nameDisplayPanel.innerHTML='<summary>選手名の表示サイズ</summary><p>文字と背景枠を一緒に拡大します。初期値は1です。全視点で名前の重なりを許し、走者名を上に表示します。</p><label>名前の倍率 <input id="name-display-scale" type="number" min="0.5" max="2.5" step="0.05" value="1"></label><button id="name-display-reset">倍率を1に戻す</button>';
 document.querySelector('details.settings').after(nameDisplayPanel);
 $('name-display-scale').onchange=()=>{try{setNameDisplay({scale:Number($('name-display-scale').value)});}catch(error){syncNameDisplay();$('announcement').textContent=error.message;}};
 $('name-display-reset').onclick=()=>setNameDisplay(window.KneekuraNameDisplayControls.defaults);
 `;
 game=once(game,"const ballDisplayPanel=document.createElement('details');",namePanel+"const ballDisplayPanel=document.createElement('details');");
 game=once(game,'window.liveMatchPlayback=Object.freeze({setBallDisplay,','window.liveMatchPlayback=Object.freeze({setNameDisplay,setBallDisplay,');
 game=once(game,'presentation:{ballDisplay:window.KneekuraBallDisplayControls.inspect(),',
  'presentation:{nameDisplay:window.KneekuraNameDisplayControls.inspect(),ballDisplay:window.KneekuraBallDisplayControls.inspect(),');
 return game;
}
