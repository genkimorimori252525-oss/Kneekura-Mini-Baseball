(function(root){
 'use strict';
 const maker=root.baseballMaker,core=root.KneekuraBaseballWorkbench,$=id=>document.getElementById(id),clone=v=>JSON.parse(JSON.stringify(v));
 if(!maker?.commitLiveRosterEditV86||!core?.validateSwingExecutionV122||!$('swing-policy-v121'))return;
 const panel=document.createElement('details');panel.id='swing-execution-v122';
 const envelopeSupported=typeof core.validateLiveSwingEnvelopeV133==='function';
 panel.innerHTML='<summary>動きの上限・狙い方</summary><label><input type="checkbox" id="swing-execution-enabled-v122">速度の連続する補間と加速度制限を使う</label><div id="swing-execution-fields-v122"></div><details><summary>方向・予測の詳細JSON</summary><textarea id="batter-approach-json-v122" rows="6" aria-label="方向・予測の詳細JSON"></textarea><p>設定すると、この選手はここで指定した狙い方を使います。従来の5方向配分は保存され、解除すると戻ります。</p></details><div class="swing-toolbar"><button type="button" id="swing-execution-apply-v122">適用</button><button type="button" id="swing-execution-revert-v122">入力を戻す</button><button type="button" id="swing-execution-reset-v122">この設定を外す</button><button type="button" id="swing-execution-undo-v122" hidden>直前の適用を取り消す</button></div><p id="swing-execution-status-v122" role="status" aria-live="polite"></p>';
 $('swing-policy-v121').after(panel);
 if(envelopeSupported){const detail=document.createElement('details');detail.innerHTML='<summary>準備・回復の詳細JSON</summary><textarea id="swing-envelope-json-v133" rows="6" aria-label="準備・回復の詳細JSON"></textarea><p>任意設定です。開始・終了姿勢は原clipをフィールドへ登録した座標のmと単位quaternion、時間は実行秒で指定します。身長換算と既知の立ち位置の前後差は実行時に一度適用し、現在球によって静止姿勢を変えません。C1と加速度上限の明示設定が必要です。姿勢・時間の個人値は自動補完しません。</p>';panel.querySelector('.swing-toolbar').before(detail);}
 const style=document.createElement('style');style.textContent='#swing-execution-fields-v122{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:12px}#swing-execution-v122 label{display:flex;flex-direction:column;gap:6px;min-width:0}#swing-execution-v122>label{flex-direction:row;align-items:center}#swing-execution-fields-v122 input,#batter-approach-json-v122{width:100%;min-width:0;box-sizing:border-box}';document.head.append(style);
 const specs=[['maximumGripAccelerationMps2','手元の加速度上限（m/s²）',1e7],['maximumAngularAccelerationRadPerSecond2','回転の加速度上限（rad/s²）',1e7],
  ['maximumSweetSpotAccelerationMps2','芯の加速度上限（m/s²）',1e7],['maximumCorrectionMeters','観測後の修正距離上限（m）',3]],drafts=new Map();
 for(const [key,label,max] of specs){const l=document.createElement('label');l.textContent=label;const input=document.createElement('input');Object.assign(input,{id:'swing-execution-'+key+'-v122',type:'number',step:'any',min:'0',max:String(max)});l.append(input);$('swing-execution-fields-v122').append(l);}
 const id=()=>$('live-roster-player').value,physical=()=>maker.getLiveRoster().entries.find(e=>e.playerId===id()).physical,
  pair=p=>[p.swingExecutionV122??null,p.batterApproachV122??null,p.swingEnvelopeV133??null],status=(s,error=false)=>{const n=$('swing-execution-status-v122');n.textContent=s;n.classList.toggle('error',error);};
 let currentId=null,undo=null;
 function read(){return {enabled:$('swing-execution-enabled-v122').checked,values:Object.fromEntries(specs.map(([key])=>[key,$('swing-execution-'+key+'-v122').value])),json:$('batter-approach-json-v122').value,envelopeJson:$('swing-envelope-json-v133')?.value??''};}
 function refresh(){currentId=id();const p=physical(),d=drafts.get(currentId)??{enabled:!!p.swingExecutionV122,values:p.swingExecutionV122??{},json:p.batterApproachV122?JSON.stringify(p.batterApproachV122,null,2):'',envelopeJson:p.swingEnvelopeV133?JSON.stringify(p.swingEnvelopeV133,null,2):''};
  $('swing-execution-enabled-v122').checked=d.enabled;for(const [key]of specs)$('swing-execution-'+key+'-v122').value=d.values[key]??'';
  $('batter-approach-json-v122').value=d.json;$('swing-execution-undo-v122').hidden=undo?.playerId!==currentId;$('swing-execution-undo-v122').disabled=drafts.has(currentId);
  if(envelopeSupported)$('swing-envelope-json-v133').value=d.envelopeJson??'';
  status(drafts.has(currentId)?'未適用の入力があります。':p.swingExecutionV122?'入力した実行上限を採用中。個人の実測値を自動推定する機能ではありません。':'未設定。従来の動きを採用中。');}
 function apply(remove=false){const r=maker.getLiveRoster(),p=r.entries.find(e=>e.playerId===id()).physical,before=clone(pair(p)),d=read();
  if(remove||!d.enabled)delete p.swingExecutionV122;else{
   const values={};for(const [key,label]of specs){const field=$('swing-execution-'+key+'-v122');if(field.value.trim()===''||!field.checkValidity())throw Error(label+'を入力してください。');values[key]=Number(field.value);}
   p.swingExecutionV122=core.validateSwingExecutionV122({version:'swing_execution_v122',sourceId:p.swingExecutionV122?.sourceId??'maker-author-v122',interpolation:'cubic-c1',...values});}
  if(remove||!d.json.trim())delete p.batterApproachV122;else p.batterApproachV122=core.validateBatterApproachV122(JSON.parse(d.json));
  if(remove||!d.envelopeJson.trim())delete p.swingEnvelopeV133;else{
   let value;try{value=JSON.parse(d.envelopeJson);}catch{throw Error('準備・回復の詳細JSONの構文を確認してください。キーの二重引用符、カンマ、括弧を見直してください。');}
   p.swingEnvelopeV133=core.validateLiveSwingEnvelopeV133(value,p.swingExecutionV122);}
  maker.commitLiveRosterEditV86(r);undo={playerId:id(),before,after:JSON.stringify(pair(p))};drafts.delete(id());refresh();status(remove?'この設定を外しました。':'適用しました。能力JSONで通常試合へ反映できます。');}
 panel.addEventListener('input',()=>{drafts.set(currentId,read());$('swing-execution-undo-v122').disabled=true;status('未適用の入力があります。');});
 $('swing-execution-apply-v122').onclick=()=>{try{apply();}catch(e){status(e.message,true);}};
 $('swing-execution-reset-v122').onclick=()=>{try{apply(true);}catch(e){status(e.message,true);}};
 $('swing-execution-revert-v122').onclick=()=>{drafts.delete(id());refresh();};
 $('swing-execution-undo-v122').onclick=()=>{try{if(drafts.has(id())||undo?.playerId!==id()||JSON.stringify(pair(physical()))!==undo.after)throw Error('別の変更や未適用の入力があるため取り消せません。');
  const r=maker.getLiveRoster(),p=r.entries.find(e=>e.playerId===id()).physical;for(const [i,key]of ['swingExecutionV122','batterApproachV122','swingEnvelopeV133'].entries())if(undo.before[i]===null)delete p[key];else p[key]=clone(undo.before[i]);
  maker.commitLiveRosterEditV86(r);undo=null;refresh();status('直前の適用を取り消しました。');}catch(e){status(e.message,true);}};
 document.addEventListener('kneekura:maker-roster-change',()=>{if(undo&&undo.playerId===id()&&JSON.stringify(pair(physical()))!==undo.after)undo=null;if(currentId!==id()||!drafts.has(id()))refresh();});
 $('live-roster-player').addEventListener('change',refresh);
 root.KneekuraSwingExecutionMakerV122=Object.freeze({refresh,apply:()=>apply(),reset:()=>apply(true),inspect:()=>({playerId:id(),pending:[...drafts.keys()],physical:clone(physical())}),
  assertNoPending:()=>{if(drafts.size)throw Error('動きの上限・狙い方に未適用の入力があります。適用するか、入力を戻してください。');}});refresh();
})(globalThis);
