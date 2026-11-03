(function(root){
 'use strict';
 const maker=root.baseballMaker,core=root.KneekuraBaseballWorkbench,$=id=>document.getElementById(id),clone=x=>JSON.parse(JSON.stringify(x));
 if(!maker?.commitLiveRosterEditV86||!core?.validateSwingPolicyV121||!$('swing-bat-mass'))return;
 const panel=document.createElement('details');panel.id='swing-policy-v121';
 const style=document.createElement('style');style.textContent='#swing-policy-fields-v121{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:12px}#swing-policy-fields-v121 label{min-width:0;display:flex;flex-direction:column;gap:6px}#swing-policy-fields-v121 input{width:100%;min-width:0;box-sizing:border-box}';document.head.append(style);
 panel.innerHTML='<summary>スイングの使い方</summary><label><input id="swing-policy-enabled-v121" type="checkbox">一球ごとの振り方を設定</label><div class="swing-settings-grid" id="swing-policy-fields-v121"></div><details><summary>基準バット・校正JSON</summary><textarea id="swing-capacity-model-v121" rows="5" style="width:100%;box-sizing:border-box" aria-label="基準バットと校正JSON"></textarea></details><div class="swing-toolbar"><button type="button" id="swing-policy-apply-v121">適用</button><button type="button" id="swing-policy-revert-v121">入力を戻す</button><button type="button" id="swing-policy-reset-v121">この設定を外す</button></div><p id="swing-policy-status-v121" role="status" aria-live="polite"></p>';
 $('swing-bat-mass').closest('.swing-settings-grid').after(panel);
 const undoButton=document.createElement('button');Object.assign(undoButton,{type:'button',id:'swing-policy-undo-v121',textContent:'直前の適用を取り消す',hidden:true});panel.querySelector('.swing-toolbar').append(undoButton);let undo=null;
 const specs=[['effort','出力を使う意図',0,1,.05],['compactness','コンパクトさ',0,1,.05],['controlPriority','軌道修正の優先度',0,1,.05],
 ['effortVariation','一球ごとの意図の幅',0,1,.01],['twoStrikeEffortDelta','2ストライク時の出力の差',-1,1,.05],
 ['twoStrikeCompactnessDelta','2ストライク時のコンパクトさの差',-1,1,.05],['maximumClockAccelerationPerSecond','軌道の加速上限（毎秒）',.1,500,.1]];
 for(const [key,label,min,max]of specs){const l=document.createElement('label');l.textContent=label;const input=document.createElement('input');Object.assign(input,{id:'swing-policy-'+key+'-v121',type:'number',min:String(min),max:String(max),step:'any'});input.dataset.key=key;l.append(input);$('swing-policy-fields-v121').append(l);}
 const defaults={version:'swing_policy_v121',sourceId:'maker-author-v121',effort:.8,compactness:.3,controlPriority:.5,effortVariation:.05,
  twoStrikeEffortDelta:0,twoStrikeCompactnessDelta:0,maximumClockAccelerationPerSecond:30},drafts=new Map();let currentId=null;
 const id=()=>$('live-roster-player').value,physical=()=>maker.getLiveRoster().entries.find(e=>e.playerId===id()).physical;
 const status=(text,error=false)=>{const node=$('swing-policy-status-v121');node.textContent=text;node.classList.toggle('error',error);};
 const sourcePair=p=>[p.swingPolicyV121??null,p.batSwingCapacityV121??null];
 function read(){const policy={...(physical().swingPolicyV121??defaults)};for(const [key]of specs){const input=$('swing-policy-'+key+'-v121');if(input.value.trim()===''||!input.checkValidity())throw Error(input.closest('label').firstChild.textContent+'を範囲内の数値で入力してください。');policy[key]=Number(input.value);}
  return {enabled:$('swing-policy-enabled-v121').checked,policy,model:$('swing-capacity-model-v121').value};}
 function refresh(){currentId=id();const p=physical(),draft=drafts.get(currentId),value=draft??{enabled:!!p.swingPolicyV121,policy:p.swingPolicyV121??defaults,model:p.batSwingCapacityV121?JSON.stringify(p.batSwingCapacityV121,null,2):''};
  $('swing-policy-enabled-v121').checked=value.enabled;for(const [key]of specs)$('swing-policy-'+key+'-v121').value=value.policy[key];$('swing-capacity-model-v121').value=value.model;
  undoButton.hidden=undo?.playerId!==currentId;undoButton.disabled=!!draft;
  status(draft?'未適用の入力があります。':p.swingPolicyV121?'一球ごとの出力・軌道の設定を採用中':'従来の設定を採用中');}
 function remember(){undoButton.disabled=true;try{drafts.set(currentId,read());status('未適用の入力があります。');}catch(error){status(error.message,true);drafts.set(currentId,{enabled:$('swing-policy-enabled-v121').checked,policy:Object.fromEntries([...Object.entries(defaults),...specs.map(([key])=>[key,$('swing-policy-'+key+'-v121').value])]),model:$('swing-capacity-model-v121').value});}}
 function apply(remove=false){try{
  const value=remove?null:read(),roster=maker.getLiveRoster(),p=roster.entries.find(e=>e.playerId===id()).physical,before=clone(sourcePair(p));
  if(remove||!value.enabled)delete p.swingPolicyV121;else p.swingPolicyV121=core.validateSwingPolicyV121(value.policy);
  if(remove||!value.model.trim())delete p.batSwingCapacityV121;else p.batSwingCapacityV121=JSON.parse(value.model);
  maker.commitLiveRosterEditV86(roster);undo={playerId:id(),before,after:JSON.stringify(sourcePair(p))};drafts.delete(id());refresh();root.KneekuraBatCapacityMakerV121?.refresh();status(remove?'この設定を外しました。':'適用しました。通常試合には能力JSONを読み込んで反映します。');
 }catch(error){status('適用できません：'+error.message,true);throw error;}}
 panel.addEventListener('input',remember);panel.addEventListener('change',remember);
 $('swing-policy-apply-v121').onclick=()=>{try{apply();}catch{}};
 $('swing-policy-reset-v121').onclick=()=>{try{apply(true);}catch{}};
 $('swing-policy-revert-v121').onclick=()=>{drafts.delete(id());refresh();};
 undoButton.onclick=()=>{try{if(drafts.has(id()))throw Error('未適用の入力を先に戻してください。');const r=maker.getLiveRoster(),p=r.entries.find(e=>e.playerId===id()).physical;
  if(undo?.playerId!==id()||JSON.stringify(sourcePair(p))!==undo.after)throw Error('別の変更後は直前の設定を取り消せません。');
  for(const [i,key]of ['swingPolicyV121','batSwingCapacityV121'].entries())if(undo.before[i]===null)delete p[key];else p[key]=clone(undo.before[i]);
  maker.commitLiveRosterEditV86(r);undo=null;refresh();root.KneekuraBatCapacityMakerV121?.refresh();status('直前の適用を取り消しました。');
 }catch(error){status(error.message,true);}};
 document.addEventListener('kneekura:maker-roster-change',()=>{if(undo&&undo.playerId===id()&&JSON.stringify(sourcePair(physical()))!==undo.after)undo=null;if(currentId!==id()||!drafts.has(id()))refresh();});
 $('live-roster-player').addEventListener('change',refresh);
 root.KneekuraSwingPolicyMakerV121=Object.freeze({refresh,apply:()=>apply(),reset:()=>apply(true),inspect:()=>({playerId:id(),pending:[...drafts.keys()],physical:clone(physical())}),
  assertNoPending:()=>{if(drafts.size)throw Error('スイングの使い方に未適用の入力があります。適用するか「入力を戻す」を押してください。');}});
 refresh();
})(globalThis);
