// V123 local-authoring UI. Filled after the missing-panel browser regression.
(function(root){
 'use strict';
 const maker=root.baseballMaker,core=root.KneekuraBaseballWorkbench,$=id=>document.getElementById(id),clone=v=>JSON.parse(JSON.stringify(v));
 if(!maker?.commitLiveRosterEditV86||!core?.validateLiveSpinControlV123||!$('swing-execution-v122'))return;
 const names={SLICE:'スライス',HOOK:'フック',BACKSPIN:'バックスピン',TOPSPIN:'トップスピン'},kinds=Object.keys(names),drafts=new Map();
 const panel=document.createElement('details');panel.id='spin-control-v123';
 panel.innerHTML='<summary>打球の回転を狙う技術</summary><p id="spin-mastery-v123"></p><label>打席で狙う回転<select id="spin-intent-v123"></select></label>'+
  '<div id="spin-tabs-v123" role="tablist" aria-label="回転の技術"></div><div id="spin-editor-v123" role="tabpanel">'+
  '<div class="spin-grid-v123"><label>習得状態<select id="spin-learned-v123"><option value="NONE">未設定</option><option value="PRACTICING">練習中</option><option value="CONSOLIDATED">習得済み</option></select></label>'+
  '<label>使うスイング<select id="spin-clip-v123" class="spin-motion-input"></select></label></div><div id="spin-fields-v123" class="spin-grid-v123"></div>'+
  '<label class="spin-confirm-v123"><input id="spin-verified-v123" type="checkbox">この軌道・打点・適用範囲を確認済み</label></div>'+
  '<details><summary>設定の意味</summary><p>回転はバットの軌道と打点から生じます。指定した回転が必ず得られるわけではありません。スイングや左右が一致しない場合、または適用コース・動作時間の範囲外では通常の打ち方を使います。</p>'+
  '<p>内角は0が中央、1が内角端、−1が外角端です。高さは0が下端、1が上端です。打点の上側を負にすると低く、投手側を正にすると前になります。</p><p>ここは作者による設定です。実測や練習履歴による習得認定とは区別されます。軌道・打点・範囲を変更したら、確認済みを付け直してください。</p></details>'+
  '<div class="swing-toolbar"><button type="button" id="spin-apply-v123">適用</button><button type="button" id="spin-revert-v123">入力を戻す</button><button type="button" id="spin-remove-v123">この設定を外す</button><button type="button" id="spin-undo-v123" hidden>直前の適用を取り消す</button></div>'+
  '<p id="spin-status-v123" role="status" aria-live="polite"></p><details><summary>AI用JSON</summary><textarea id="spin-json-v123" rows="8" aria-label="打球回転のAI用JSON"></textarea><button type="button" id="spin-json-read-v123">確定値を表示</button> <button type="button" id="spin-json-apply-v123">JSONを適用</button></details>';
 $('swing-execution-v122').after(panel);
 const style=document.createElement('style');
 style.textContent='#spin-control-v123{min-width:0}#spin-control-v123 label{display:flex;flex-direction:column;gap:6px;min-width:0}#spin-control-v123 input,#spin-control-v123 select,#spin-control-v123 textarea{min-width:0;max-width:100%;width:100%;box-sizing:border-box}#spin-control-v123 textarea{font-family:monospace}#spin-control-v123 .spin-confirm-v123{flex-direction:row;align-items:center;margin:12px 0}#spin-verified-v123{width:auto!important}#spin-tabs-v123{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0}#spin-tabs-v123 button{flex:1 1 130px;white-space:normal}#spin-tabs-v123 button[aria-selected="true"]{background:#e7f3eb;border-color:#276a47}#spin-control-v123 .spin-grid-v123{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:12px;margin:12px 0}';
 document.head.append(style);
 const specs=[
  ['attack','軌道の角度（度）',-30,30,0],['pull','引っ張り方向への角度（度）',-45,45,0],
  ['offsetPull','打点・引っ張り側（cm）',-20,20,0],['offsetUp','打点・上側（cm）',-20,20,0],['offsetDepth','打点・投手側（cm）',-50,50,0],
  ['insideMin','内角の範囲・下限',-3,3,-1],['insideMax','内角の範囲・上限',-3,3,1],
  ['heightMin','高さの範囲・下限',-3,3,0],['heightMax','高さの範囲・上限',-3,3,1],['time','必要な動作時間（ms）',0,2000,0]
 ];
 for(const [key,label,min,max]of specs){const l=document.createElement('label');l.textContent=label;const input=document.createElement('input');
  Object.assign(input,{id:'spin-'+key+'-v123',type:'number',step:'any',min:String(min),max:String(max),className:'spin-motion-input'});l.append(input);$('spin-fields-v123').append(l);}
 const normal=document.createElement('option');normal.value='NO_SPIN_TARGET';normal.textContent='通常の打ち方';$('spin-intent-v123').append(normal);
 for(const kind of kinds){const o=document.createElement('option');o.value=kind;o.textContent=names[kind];$('spin-intent-v123').append(o);
  const b=document.createElement('button');b.type='button';b.id='spin-tab-'+kind+'-v123';b.role='tab';b.setAttribute('aria-controls','spin-editor-v123');
  b.onclick=()=>{saveView();active=kind;renderEditor();};$('spin-tabs-v123').append(b);}
 const id=()=>$('live-roster-player').value,entry=()=>maker.getLiveRoster().entries.find(e=>e.playerId===id()),
  identity=()=>root.KneekuraLiveGameRosterCatalog.players.find(p=>p.playerId===id()),clips=()=>root.KneekuraReferenceBatMotions.clips,
  status=(text,error=false)=>{const n=$('spin-status-v123');n.textContent=text;n.classList.toggle('error',error);};
 let currentId=null,active='BACKSPIN',state=null,undo=null,committing=false;
 function sourceState(p){
  const profile=p.spinControlV123,side=identity().bats,clip=clips().find(c=>c.id===p.clipId&&c.side===side)??clips().find(c=>c.side===side),rows={};
  for(const kind of kinds){const t=profile?.techniques.find(t=>t.technique===kind),m=t?.motion,c=t?.conditions;
   rows[kind]={learned:t?.learnedStatus??'NONE',clip:t?.clip.id??clip?.id??'',verified:t?.calibration.status==='MODEL_VERIFIED',
    values:m?{attack:String(m.attackAngleDegrees),pull:String(m.pullAngleDeltaDegrees),offsetPull:String(m.contactOffsetMeters.pull*100),offsetUp:String(m.contactOffsetMeters.up*100),offsetDepth:String(m.contactOffsetMeters.depth*100),insideMin:String(c.minimumInsideNormalized),insideMax:String(c.maximumInsideNormalized),heightMin:String(c.minimumHeightNormalized),heightMax:String(c.maximumHeightNormalized),time:String(c.minimumAvailableSeconds*1000)}:Object.fromEntries(specs.map(([k,,,,v])=>[k,String(v)])),original:t??null};
  }
  return {intent:profile?.preferredIntent??'NO_SPIN_TARGET',rows,dirty:false,original:profile??null};
 }
 function saveView(){if(!state)return;state.intent=$('spin-intent-v123').value;const r=state.rows[active];r.learned=$('spin-learned-v123').value;r.clip=$('spin-clip-v123').value;r.verified=$('spin-verified-v123').checked;for(const [key]of specs)r.values[key]=$('spin-'+key+'-v123').value;}
 function renderEditor(){
  const row=state.rows[active];$('spin-intent-v123').value=state.intent;$('spin-learned-v123').value=row.learned;$('spin-verified-v123').checked=row.verified;
  const select=$('spin-clip-v123');select.replaceChildren();for(const c of clips().filter(c=>c.side===identity().bats)){const o=document.createElement('option');o.value=c.id;o.textContent=c.id;select.append(o);}
  if(![...select.options].some(o=>o.value===row.clip)){const o=document.createElement('option');o.value=row.clip;o.textContent='未対応のスイング：'+row.clip;select.append(o);}select.value=row.clip;
  for(const [key]of specs)$('spin-'+key+'-v123').value=row.values[key];
  for(const kind of kinds){const b=$('spin-tab-'+kind+'-v123');b.setAttribute('aria-selected',String(kind===active));b.replaceChildren();const name=document.createElement('span'),badge=document.createElement('small');name.textContent=names[kind];badge.textContent={NONE:'未設定',PRACTICING:'練習中',CONSOLIDATED:'習得済み'}[state.rows[kind].learned];name.style.display=badge.style.display='block';b.append(name,badge);}
  $('spin-undo-v123').hidden=undo?.playerId!==currentId;$('spin-undo-v123').disabled=state.dirty;
 }
 function mastery(){const p=entry().physical.spinControlV123;return p?core.projectLiveSpinMasteryV123(p):{effectiveStateId:'NONE',masteredTechniqueSet:[],nativeAdmission:false,boundary:'LOCAL_AUTHORING_ONLY'};}
 function refresh(){currentId=id();state=drafts.get(currentId)??sourceState(entry().physical);const m=mastery();
  $('spin-mastery-v123').textContent=m.masteredTechniqueSet.length?'有効な技術：'+m.masteredTechniqueSet.map(k=>names[k]).join('・')+(m.effectiveStateId==='GOLD'?'（複数技術）':''):'有効な技術：なし';
  renderEditor();status(state.dirty?'未適用の入力があります。':'');
 }
 function markPending(event){if(!event.target.closest('#spin-editor-v123')&&event.target.id!=='spin-intent-v123')return;
  if(event.target.classList.contains('spin-motion-input'))$('spin-verified-v123').checked=false;
  saveView();state.dirty=true;drafts.set(currentId,state);$('spin-undo-v123').disabled=true;status('未適用の入力があります。');
 }
 panel.addEventListener('input',markPending);panel.addEventListener('change',markPending);
 function profileFromView(){saveView();const original=state.original,version=String((Number(original?.sourceVersion)||0)+1),techniques=[];
  for(const kind of kinds){const r=state.rows[kind];if(r.learned==='NONE')continue;const clip=clips().find(c=>c.id===r.clip&&c.side===identity().bats);
   if(!clip)throw Error(names[kind]+'：この選手の左右に合うスイングを選んでください。');
   const v={};for(const [key,label,min,max]of specs){const raw=r.values[key],n=Number(raw);if(raw.trim()===''||!Number.isFinite(n)||n<min||n>max)throw Error(names[kind]+'：'+label+'は'+min+'〜'+max+'で入力してください。');v[key]=n;}
   if(v.insideMin>v.insideMax||v.heightMin>v.heightMax)throw Error(names[kind]+'：適用範囲の下限を上限以下にしてください。');
   const sourceId=r.original?.sourceId??'maker-spin-'+currentId.slice(0,100)+'-'+kind;
   techniques.push({technique:kind,sourceId,sourceEffectIdentity:r.original?.sourceEffectIdentity??sourceId+'-motion',learnedStatus:r.learned,
    calibration:{sourceId:r.original?.calibration.sourceId??sourceId+'-author-check',sourceVersion:version,status:r.verified?'MODEL_VERIFIED':'UNVERIFIED'},
    clip:{id:clip.id,sourceSha256:clip.source.sha256,bats:identity().bats},motion:{attackAngleDegrees:v.attack,pullAngleDeltaDegrees:v.pull,contactOffsetMeters:{pull:v.offsetPull/100,up:v.offsetUp/100,depth:v.offsetDepth/100}},
    conditions:{minimumInsideNormalized:v.insideMin,maximumInsideNormalized:v.insideMax,minimumHeightNormalized:v.heightMin,maximumHeightNormalized:v.heightMax,minimumAvailableSeconds:v.time/1000}});
  }
  return core.validateLiveSpinControlV123({version:'live_spin_control_v123',boundary:'LOCAL_AUTHORING_ONLY',sourceId:original?.sourceId??'maker-spin-'+currentId.slice(0,100),sourceVersion:version,preferredIntent:state.intent,techniques});
 }
 function commit(profile){const r=maker.getLiveRoster(),p=r.entries.find(e=>e.playerId===id()).physical,before=clone(p.spinControlV123??null);
  if(profile===null)delete p.spinControlV123;else p.spinControlV123=profile;
  committing=true;try{maker.commitLiveRosterEditV86(r);}finally{committing=false;}
  undo={playerId:id(),before,after:JSON.stringify(profile)};drafts.delete(id());refresh();status(profile===null?'この設定を外しました。':'適用しました。試合用能力JSONで通常試合へ反映できます。');return clone(profile);
 }
 function applyJson(raw){if(drafts.size)throw Error('未適用の入力があります。先に適用するか、入力を戻してください。');return commit(core.validateLiveSpinControlV123(typeof raw==='string'?JSON.parse(raw):raw));}
 function run(action){try{return action();}catch(e){status(e.message,true);}}
 $('spin-apply-v123').onclick=()=>run(()=>commit(profileFromView()));$('spin-remove-v123').onclick=()=>run(()=>commit(null));
 $('spin-revert-v123').onclick=()=>{drafts.delete(id());refresh();};
 $('spin-undo-v123').onclick=()=>run(()=>{if(state.dirty||undo?.playerId!==id()||JSON.stringify(entry().physical.spinControlV123??null)!==undo.after)throw Error('別の変更や未適用の入力があるため取り消せません。');
  const before=undo.before;commit(before);undo=null;refresh();status('直前の適用を取り消しました。');});
 $('spin-json-read-v123').onclick=()=>{$('spin-json-v123').value=JSON.stringify(entry().physical.spinControlV123??null,null,2);};
 $('spin-json-apply-v123').onclick=()=>run(()=>applyJson($('spin-json-v123').value));
 document.addEventListener('kneekura:maker-roster-change',()=>{if(committing)return;if(undo&&undo.playerId===id()&&JSON.stringify(entry().physical.spinControlV123??null)!==undo.after)undo=null;if(currentId!==id()||!drafts.has(id()))refresh();});
 $('live-roster-player').addEventListener('change',refresh);
 root.KneekuraSpinControlMakerV123=Object.freeze({refresh,getDraft:()=>clone(profileFromView()),apply:()=>commit(profileFromView()),applyJson,reset:()=>commit(null),
  inspect:()=>({playerId:id(),pending:[...drafts.keys()],physical:clone(entry().physical),mastery:mastery(),committedRoster:maker.getLiveRoster()}),
  assertNoPending:()=>{if(drafts.size)throw Error('打球の回転を狙う技術に未適用の入力があります。適用するか、入力を戻してください。');}});refresh();
})(globalThis);
