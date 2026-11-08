/* Authoring only. Position, feet and zone always come from the shared Core resolver. */
(function(root){
 'use strict';
 const document=root.document,$=id=>document.getElementById(id),core=root.KneekuraBaseballWorkbench,
  maker=root.baseballMaker,api=root.KneekuraPitcherMakerV78,catalog=root.KneekuraLiveGameRosterCatalog,
  picker=$('live-roster-player'),anchor=$('live-roster-identity'),clone=value=>root.structuredClone(value),json=JSON.stringify;
 if(!maker||!api||!picker||!anchor||typeof core?.resolveLiveBattingSetupV94!=='function')throw Error('打席位置の設定には対応する共通Coreと選手メーカーが必要です。');
 const poseFields=[['shoulderTopRatio','shoulderTopY','肩の上端'],['uniformPantsTopRatio','uniformPantsTopY','ズボンの上端'],['kneecapBottomRatio','kneecapBottomY','膝の下端']],
  footFields=[['footSeparationMeters','両足の中心の間隔'],['footLengthMeters','足の長さ'],['footWidthMeters','足の幅'],['strideMeters','踏み込む距離']],
  labels={legacy:'従来位置',front:'前',middle:'中央',back:'後'},inputs=new Map(),messages=new Map();
 const panel=document.createElement('section');panel.id='batting-setup-v94';panel.className='batting-setup-v94';
 const field=(key,label,help)=>`<div class="control"><label for="batting-${key}-v94">${label}（cm）</label><input id="batting-${key}-v94" type="number" min="0" step="any" data-help="${help}"><p id="batting-${key}-error-v94" class="batting-field-error-v94" hidden></p></div>`;
 panel.innerHTML=`<h3 id="batting-setup-title-v94">通常の構え・打席位置</h3>
  <p class="note">通常の打撃姿勢での身体の高さと、足を含めた打席の前後位置を設定します。変更は下の保存ボタンで確定します。</p>
  <div class="control"><label for="batting-position-v94">打席の前後位置</label><select id="batting-position-v94" data-help="前は投手寄り、後は捕手寄りです。両足と踏み込み後の足が打席の線を越えない範囲で位置を決めます。従来位置は以前の固定位置で、打席の中央とは異なります。前後位置で本塁のゾーンは移動しません。"><option value="">従来位置（前後を指定しない）</option><option value="front">前</option><option value="middle">中央</option><option value="back">後</option></select><p id="batting-position-error-v94" class="batting-field-error-v94" hidden></p></div>
  <p id="batting-pose-basis-v94" class="note"></p>
  <div class="batting-pose-fields-v94">${poseFields.map(([key,,label])=>field(key,label,'通常の打撃姿勢で地面から測った高さです。実測資料がない選手の初期表示は身長からの暫定値です。保存時は身長に対する比率を記録するため、身長を変えるとこの高さも比例して変わります。')).join('')}</div>
  <div class="batting-diagrams-v94"><figure><figcaption>通常姿勢とゾーンの高さ</figcaption><svg id="batting-body-v94" viewBox="0 0 340 260" role="img" aria-label="肩・ズボン・膝とゾーンの上下限"></svg></figure><figure><figcaption>上から見た打席と両足</figcaption><svg id="batting-feet-v94" viewBox="0 0 340 260" role="img" aria-label="構えの足と踏み込み後の足、打席の境界"></svg></figure></div>
  <p id="batting-zone-summary-v94" class="note"></p>
  <details id="batting-feet-details-v94"><summary>足の大きさ・開き方と踏み込み</summary><p class="note">ゲーム内の足の支持範囲です。実測の足形やフォームの再現値ではありません。前・後は、この設定から合法な端を計算します。</p><div class="batting-foot-fields-v94">${footFields.map(([key,label])=>field(key,label,'足を含めて打席の境界内に収めるためのゲーム内設定です。足の長さは横方向、足の幅と両足の間隔・踏み込みは前後方向に使います。')).join('')}</div></details>
  <div class="swing-toolbar"><button id="batting-save-v94" type="button" class="primary">この選手の構えを保存</button><button id="batting-cancel-v94" type="button">未保存の入力を戻す</button><button id="batting-reset-v94" type="button" data-help="この選手の新しい構え設定だけを外し、従来位置と暫定の身体値へ戻します。身長・能力・打ち方などは変更しません。">従来の設定に戻す</button><button id="batting-undo-v94" type="button">直前の保存を取り消す</button></div>
  <p id="batting-status-v94" class="note" role="status"></p>`;
 anchor.after(panel);
 inputs.set('boxPosition',$('batting-position-v94'));messages.set('boxPosition',$('batting-position-error-v94'));
 for(const [key]of [...poseFields,...footFields]){inputs.set(key,$('batting-'+key+'-v94'));messages.set(key,$('batting-'+key+'-error-v94'));}
 for(const [key,input]of inputs){input.setAttribute('aria-describedby',messages.get(key).id);}
 let selectedId=picker.value,draft=null,lastUndo=null,committing=false,lastError=null,lastResolved=null;
 function state(){const roster=maker.getLiveRoster(),id=picker.value,entry=roster.entries.find(row=>row.playerId===id),identity=catalog.players.find(row=>row.playerId===id);
  if(!entry||!identity)throw Error('編集する選手を選んでください。');
  const player=core.applyLivePhysicalRosterV1({players:catalog.players,roster}).players.find(row=>row.playerId===id);
  return {roster,id,entry,identity,player,setup:entry.physical.battingSetupV94};
 }
 function resolve(s,setup=s.setup){return core.resolveLiveBattingSetupV94({heightMeters:s.player.heightMeters,bats:s.player.bats??s.identity.bats,...(s.player.physical.contactDepthMeters===undefined?{}:{contactDepthMeters:s.player.physical.contactDepthMeters}),...(setup?{battingSetupV94:setup}:{})});}
 function fingerprint(s){return json({setup:s.setup??null,heightMeters:s.player.heightMeters,bats:s.player.bats??s.identity.bats});}
 function values(s){const resolved=resolve(s),out={boxPosition:s.setup?.boxPosition??''};
  for(const [key]of poseFields)out[key]=String(Number((resolved.normalPose.ratios[key]*s.player.heightMeters*100).toFixed(8)));
  for(const [key]of footFields)out[key]=String(Number((resolved.support[key]*100).toFixed(8)));
  return out;
 }
 function say(message,error=false){$('batting-status-v94').textContent=message;$('batting-status-v94').classList.toggle('error',error);lastError=error?message:null;}
 function describe(error){return /[ぁ-んァ-ヶ一-龠]/.test(String(error?.message??error))?String(error.message??error):'身体の高さは肩＞ズボン＞膝の順、足の設定は打席に収まる範囲にしてください。（詳細：'+String(error?.message??error)+'）';}
 function localErrors(errors={}){for(const [key,input]of inputs){const text=errors[key]??'',message=messages.get(key);input.setCustomValidity(text);input.setAttribute('aria-invalid',String(!!text));message.textContent=text;message.hidden=!text;}}
 function candidate(s){const errors={},next=clone(s.setup??{});
  if(!draft)return {setup:s.setup,resolved:resolve(s),errors};
  const numbers={};for(const [key]of [...poseFields,...footFields]){const raw=draft.values[key],number=Number(raw);if(raw.trim()===''||!Number.isFinite(number)||number<0||(key!=='strideMeters'&&number===0))errors[key]='0'+(key==='strideMeters'?'以上':'より大きい')+'の有限の数値を入力してください。';else numbers[key]=number/100;}
  if(draft.touched.has('boxPosition')){if(draft.values.boxPosition)next.boxPosition=draft.values.boxPosition;else delete next.boxPosition;}
  if(poseFields.some(([key])=>draft.touched.has(key))&&!poseFields.some(([key])=>errors[key])){
   if(!(numbers.shoulderTopRatio>numbers.uniformPantsTopRatio&&numbers.uniformPantsTopRatio>numbers.kneecapBottomRatio))for(const [key]of poseFields)errors[key]='高さは肩＞ズボン＞膝の順にしてください。';
   if(numbers.shoulderTopRatio>s.player.heightMeters)errors.shoulderTopRatio='肩の上端は身長以下にしてください。';
   const currentRatios=resolve(s).normalPose.ratios;
   next.normalPose=Object.fromEntries(poseFields.map(([key])=>[key,draft.touched.has(key)?numbers[key]/s.player.heightMeters:currentRatios[key]]));
  }
  for(const [key]of footFields)if(draft.touched.has(key)&&!errors[key])next[key]=numbers[key];
  let resolved=null;if(!Object.keys(errors).length)try{resolved=resolve(s,Object.keys(next).length?next:undefined);}catch(error){const text=describe(error),keys=[...draft.touched];for(const key of keys)errors[key]=text;}
  return {setup:Object.keys(next).length?next:undefined,resolved,errors};
 }
 function draftChanged(key){const s=state();draft??={id:s.id,baseline:fingerprint(s),values:values(s),touched:new Set()};draft.values[key]=inputs.get(key).value;draft.touched.add(key);refresh(false);document.dispatchEvent(new CustomEvent('kneekura:maker-validation-change'));}
 const ns='http://www.w3.org/2000/svg';
 function svgNode(svg,tag,attrs,text){const node=document.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));if(text!==undefined)node.textContent=text;svg.append(node);return node;}
 function diagrams(s,resolved){const body=$('batting-body-v94'),feet=$('batting-feet-v94');body.replaceChildren();feet.replaceChildren();
  const height=s.player.heightMeters,toY=y=>235-y/height*205,ratios=resolved.normalPose.ratios,lower=resolved.volume.lowerY,upper=resolved.volume.upperY;
  svgNode(body,'line',{x1:20,y1:235,x2:320,y2:235,stroke:'#a5bfad'});svgNode(body,'rect',{x:180,y:toY(upper),width:70,height:toY(lower)-toY(upper),fill:'#e0f0e5',stroke:'#286644'});
  const shoulder=ratios.shoulderTopRatio*height,pants=ratios.uniformPantsTopRatio*height,knee=ratios.kneecapBottomRatio*height;
  svgNode(body,'circle',{cx:90,cy:toY(Math.min(height*.94,shoulder+height*.13)),r:12,fill:'#edf6f0',stroke:'#52685a'});
  svgNode(body,'path',{d:`M90 ${toY(shoulder+height*.04)} L90 ${toY(pants)} M60 ${toY(pants+height*.09)} L90 ${toY(shoulder-height*.015)} L120 ${toY(pants+height*.09)} M90 ${toY(pants)} L70 ${toY(knee)} L65 235 M90 ${toY(pants)} L110 ${toY(knee)} L115 235`,fill:'none',stroke:'#52685a','stroke-width':6,'stroke-linecap':'round'});
  for(const [key,,label]of poseFields){const y=toY(ratios[key]*height);svgNode(body,'line',{x1:45,y1:y,x2:175,y2:y,stroke:'#6d9680','stroke-dasharray':'4 3'});svgNode(body,'text',{x:14,y:y-5,fill:'#36533f','font-size':11},label+' '+(ratios[key]*height*100).toFixed(1));}
  svgNode(body,'text',{x:184,y:toY(upper)-6,fill:'#245b39','font-size':11},'上限 '+(upper*100).toFixed(1));svgNode(body,'text',{x:184,y:toY(lower)+16,fill:'#245b39','font-size':11},'下限 '+(lower*100).toFixed(1));
  const box=resolved.legalBox,polygon=resolved.volume.platePolygon,minX=Math.min(box.minX,...polygon.map(p=>p.x))-.12,maxX=Math.max(box.maxX,...polygon.map(p=>p.x))+.12,
   minZ=Math.min(box.minZ,...polygon.map(p=>p.z))-.15,maxZ=Math.max(box.maxZ,...polygon.map(p=>p.z))+.15,scale=Math.min(275/(maxX-minX),195/(maxZ-minZ)),x=v=>30+(v-minX)*scale,z=v=>225-(v-minZ)*scale;
  const rect=(r,attrs)=>svgNode(feet,'rect',{x:x(r.minX),y:z(r.maxZ),width:(r.maxX-r.minX)*scale,height:(r.maxZ-r.minZ)*scale,...attrs});
  rect(box,{fill:'#f6fbf7',stroke:'#8faa96','stroke-width':2});svgNode(feet,'polygon',{points:polygon.map(p=>x(p.x)+','+z(p.z)).join(' '),fill:'#fff',stroke:'#6d9680'});
  for(const r of resolved.contactFeet)rect(r,{fill:'none',stroke:'#b05200','stroke-width':2,'stroke-dasharray':'4 3'});
  for(const r of resolved.readyFeet)rect(r,{fill:'#d6ebdd',stroke:'#286644','stroke-width':2});
  svgNode(feet,'text',{x:16,y:17,fill:'#36533f','font-size':12},'投手側 ↑');svgNode(feet,'text',{x:16,y:253,fill:'#36533f','font-size':11},'緑：構えの足 ／ 茶の破線：踏み込み後');
  const range=resolved.legalBodyRangeZ;$('batting-zone-summary-v94').textContent=(draft?'未保存の表示：':'保存済み：')+labels[resolved.boxPosition]+'。ゾーンの上限は肩とズボンの中間、下限は膝の下端です。身体中心の前後範囲 '+(range.min*100).toFixed(1)+'〜'+(range.max*100).toFixed(1)+' cm／現在 '+(resolved.bodyZ*100).toFixed(1)+' cm（本塁後端が0）。';
 }
 function refresh(fill=true){const s=state();selectedId=s.id;const raw=draft?.id===s.id?draft.values:values(s);
  if(fill)for(const [key,input]of inputs)input.value=raw[key];
  const current=candidate(s),conflict=!!draft&&draft.baseline!==fingerprint(s);localErrors(current.errors);lastResolved=current.resolved??resolve(s);diagrams(s,lastResolved);
  $('batting-setup-title-v94').textContent=s.identity.name+'の通常の構え・打席位置';
  $('batting-pose-basis-v94').textContent=lastResolved.normalPose.basis==='AUTHORED_NORMAL_BATTING_POSE'?'通常姿勢の身体値：この選手へ入力した設定です。実測の保証はありません。':'通常姿勢の身体値：身長からの暫定値です。未設定の選手は従来の高低を維持します。実測値ではありません。';
  $('batting-save-v94').disabled=!draft||!!Object.keys(current.errors).length||conflict;
  $('batting-cancel-v94').disabled=!draft;$('batting-reset-v94').disabled=!s.setup&&!draft;
  $('batting-undo-v94').disabled=!lastUndo||lastUndo.id!==s.id||lastUndo.after!==json(s.roster)||!!draft;
  if(conflict)say('入力中にこの選手の設定が変わりました。未保存の入力を戻してから、もう一度編集してください。',true);
  else if(Object.keys(current.errors).length)say('入力を確認してください。保存済みの選手データは変更していません。',true);
  else if(draft)say('未保存です。この選手の構えを保存するか、入力を戻してください。');
  root.KneekuraMakerHelp?.decorate(panel);return current;
 }
 function assertNoPending(){if(draft&&!committing)throw Error('打席位置・通常姿勢に未保存の入力があります。構えを保存するか、未保存の入力を戻してください。');}
 function commit(s,setup,message){const next=clone(s.roster),entry=next.entries.find(row=>row.playerId===s.id),before=clone(s.setup??null);if(setup)entry.physical.battingSetupV94=clone(setup);else delete entry.physical.battingSetupV94;
  committing=true;try{api.applyRoster(next);}finally{committing=false;}
  const after=maker.getLiveRoster();lastUndo={id:s.id,before,after:json(after)};draft=null;refresh();say(message);document.dispatchEvent(new CustomEvent('kneekura:maker-validation-change'));return after;
 }
 function save(){try{const s=state();if(!draft)return s.roster;if(draft.id!==s.id||draft.baseline!==fingerprint(s))throw Error('入力中に選手の設定が変わりました。未保存の入力を戻してください。');const result=candidate(s);if(Object.keys(result.errors).length)throw Error('入力エラーを修正してから保存してください。');return commit(s,result.setup,'この選手の構えを共通の選手データへ保存しました。');}catch(error){say(describe(error),true);return null;}}
 function cancel(){draft=null;localErrors();refresh();say('未保存の入力を戻しました。保存済みの選手データは変わっていません。');document.dispatchEvent(new CustomEvent('kneekura:maker-validation-change'));return maker.getLiveRoster();}
 function reset(){try{return commit(state(),undefined,'この選手の構え設定だけを外し、従来の設定に戻しました。');}catch(error){say(describe(error),true);return null;}}
 function undo(){try{const s=state();assertNoPending();if(!lastUndo||lastUndo.id!==s.id||lastUndo.after!==json(s.roster))throw Error('別の設定が保存されたため、直前の構えの保存は取り消せません。');const saved=lastUndo,before=saved.before,result=commit(s,before??undefined,'直前の構えの保存を取り消しました。');lastUndo=null;refresh();return result;}catch(error){say(describe(error),true);return null;}}
 for(const [key,input]of inputs)input.addEventListener(input.tagName==='SELECT'?'change':'input',()=>draftChanged(key));
 $('batting-save-v94').onclick=save;$('batting-cancel-v94').onclick=cancel;$('batting-reset-v94').onclick=reset;$('batting-undo-v94').onclick=undo;
 picker.addEventListener('change',event=>{if(!draft||picker.value===selectedId)return;picker.value=selectedId;if($('swing-player-select'))$('swing-player-select').value=selectedId;event.stopImmediatePropagation();say('未保存の構えがあります。保存するか入力を戻してから、選手を切り替えてください。',true);},true);
 document.addEventListener('kneekura:maker-roster-change',()=>{if(!committing){refresh();if(!draft)say('この選手の保存済みの構えを表示しています。');}});
 root.KneekuraBattingSetupMakerV94=Object.freeze({version:94,assertNoPending,save,cancel,reset,undo,refresh,
  inspect:()=>({version:94,playerId:picker.value,pending:!!draft,error:lastError,canUndo:!$('batting-undo-v94').disabled,setup:clone(state().setup??null),resolved:clone(lastResolved)})});
 refresh();say('表示だけでは選手データは変わりません。未指定の前後位置は「従来位置」です。');
})(globalThis);
