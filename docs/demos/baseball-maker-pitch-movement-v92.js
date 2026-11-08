/* Authoring convenience only. Normal matches consume the resulting canonical spin/seam values. */
(function(root){
 'use strict';
 const core=root.KneekuraBaseballWorkbench,api=root.KneekuraPitcherMakerV78,maker=root.baseballMaker,
  catalog=root.KneekuraLiveGameRosterCatalog,owned=document.getElementById('pitcher-cards'),details=document.getElementById('pitcher-pitch-details');
 if(!core?.setPitchMovementLevelV92||!api||!owned||!details)throw Error('変化量の設定には対応する投手調整Coreが必要です。');
 const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;},box=el('section');
 box.id='pitcher-movement-v92';box.className='pitcher-movement-v92';
 const title=el('h4'),label=el('label','変化量（0〜7）'),select=el('select'),range=el('input'),value=el('output'),note=el('p'),status=el('p'),buttons=el('div'),trial=el('button','この変化量で試投'),undo=el('button','直前の変化量に戻す'),reference=el('button','球種の参考設定を基準にする');
 select.id='pitcher-movement-level-v92';select.setAttribute('aria-label','選んだ球の変化量');const manual=el('option','未設定・手動調整（現在値を維持）');manual.value='';select.append(manual);
 for(let level=0;level<=7;level++){const option=el('option',String(level));option.value=String(level);select.append(option);}
 range.id='pitcher-movement-range-v92';range.type='range';range.min='0';range.max='7';range.step='1';range.setAttribute('aria-label','変化量を0から7で調整');
 value.id='pitcher-movement-value-v92';label.append(select);note.className='pitcher-hint';
 note.textContent='0は回転・縫い目による曲がりなし。重力では落下します。初めて調整する球は現在の設定を4の基準にします。同じ段階でも球種・球速で実際のcmは異なります。';
 note.dataset.help='0〜7は回転や縫い目の設定をまとめて調整する目盛りです。球速と放す位置は保ちます。ナックルは揺れを作る縫い目の作用を調整します。cmが段階に比例する保証はありません。回転を手動編集した場合は段階外として扱います。';
 status.id='pitcher-movement-status-v92';status.className='pitcher-hint';status.setAttribute('role','status');buttons.className='swing-toolbar';
 for(const button of [trial,undo,reference]){button.type='button';buttons.append(button);}undo.id='pitcher-movement-undo-v92';reference.id='pitcher-movement-reference-v92';trial.id='pitcher-movement-trial-v92';box.append(title,label,range,value,note,buttons,status);details.before(box);
 let lastUndo=null,queued=false,lastError=null,lastSeen=null;
 const json=JSON.stringify;
 function current(){const roster=api.getRoster(),id=api.inspect().pitcherId,player=core.applyLivePhysicalRosterV1({players:catalog.players,roster}).players.find(p=>p.playerId===id),rows=core.resolvePitcherRepertoireV78(player.physical),row=rows.find(p=>p.pitchId===api.inspect().pitchId);return {roster,id,player,rows,row};}
 function say(message,error=false){status.textContent=message;status.classList.toggle('error',error);lastError=error?message:null;}
 function clean(row){const copy=root.structuredClone(row);delete copy.authored;return copy;}
 function commit(state,row){const next=root.structuredClone(state.roster),entry=next.entries.find(e=>e.playerId===state.id);
  if(!entry.physical.pitchRepertoireV78){entry.physical.pitchRepertoireV78=root.structuredClone(core.migratePitchRepertoireV77ToV78(entry.physical));delete entry.physical.pitchRepertoire;}
  entry.physical.pitchRepertoireV78.pitches=entry.physical.pitchRepertoireV78.pitches.map(p=>p.pitchId===row.pitchId?row:p);api.applyRoster(next);return api.getRoster();
 }
 function apply(level,useReference=false){
  try{maker.assertCanSave();const state=current();let referencePitch;
   if(useReference){const presets=core.getLivePitchCatalogV78().presets,preset=presets.find(p=>p.presetId===state.row.source.id&&p.pitchType===state.row.pitchType)??presets.find(p=>p.pitchType===state.row.pitchType);
    referencePitch=core.createPitchSnapshotFromPresetV78({presetId:preset.presetId,pitchId:'movement-reference',physical:state.player.physical,throws:state.player.throws??'R'});
    // Referencing a direction must not silently change the authored material orientation.
    if(!state.row.releaseOrientation){referencePitch=root.structuredClone(referencePitch);delete referencePitch.seamForce;}
   }
   let input=clean(state.row);
   if(useReference){delete input.movementV92;input.spinRadPerSecond={x:0,y:0,z:0};if(input.seamForce)input.seamForce={...input.seamForce,coefficientScale:0};}
   const changed=core.setPitchMovementLevelV92({pitch:input,level,...(referencePitch?{referencePitch}:{} )}),after=commit(state,changed);
   lastUndo={before:state.roster,after:json(after),pitcherId:state.id,pitchId:state.row.pitchId};
   refresh();const info=core.inspectPitchMovementV92(changed);say('変化量'+level+'を反映しました。'+(info.notes??[]).join(' '));return changed;
  }catch(error){refresh();say(api.describeError(error),true);return null;}
 }
 function refresh(){const state=current(),info=core.inspectPitchMovementV92(clean(state.row)),supported=info.status!=='unsupported',seen=json([state.id,clean(state.row)]);
  if(seen!==lastSeen){lastSeen=seen;say('変化量を選ぶと、この球へ反映します。試投で実際の軌道を確認できます。');}
  title.textContent=state.row.name+'の変化量';select.disabled=range.disabled=trial.disabled=reference.disabled=!supported;
  select.value=info.status==='level'?String(info.level):'';range.value=info.level??4;
  value.textContent=!supported?'ストレートは回転の詳細設定で調整します。':info.status==='level'?'変化量 '+info.level+(info.clamped?'（物理の上限に到達）':''):info.status==='manual'?'手動調整：回転・縫い目の現在値を維持しています。':'未設定：現在値は変更していません。';
  undo.disabled=!lastUndo||state.id!==lastUndo.pitcherId||state.row.pitchId!==lastUndo.pitchId||json(state.roster)!==lastUndo.after;
  for(const card of owned.querySelectorAll('[data-pitch-id]')){const row=state.rows.find(p=>p.pitchId===card.dataset.pitchId);if(!row||row.pitchType==='fastball')continue;let badge=card.querySelector('[data-movement-badge-v92]');if(!badge){badge=el('small');badge.dataset.movementBadgeV92='true';card.querySelector('span').append(badge);}const item=core.inspectPitchMovementV92(clean(row));badge.textContent=item.status==='level'?'変化量 '+item.level:'変化量：手動設定';}
 }
 select.onchange=()=>{if(select.value!=='')apply(Number(select.value));};range.oninput=()=>apply(Number(range.value));reference.onclick=()=>apply(4,true);
 trial.onclick=async()=>{try{await api.run();const m=api.inspect().metrics;say('試投結果（同じ初速の無回転比較）：横 '+m.horizontalBreakCm.toFixed(1)+' cm／縦 '+m.verticalBreakCm.toFixed(1)+' cm。縫い目込みの総変化や総落下量とは別です。');}catch(error){say(api.describeError(error),true);}};
 undo.onclick=()=>{try{maker.assertCanSave();const state=current();if(undo.disabled||json(state.roster)!==lastUndo.after)throw Error('別の設定が保存されたため、この変化量の取消はできません。');const saved=lastUndo;lastUndo=null;api.applyRoster(saved.before);refresh();say('直前の変化量の変更を戻しました。');}catch(error){say(api.describeError(error),true);}};
 new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;refresh();});}).observe(owned,{childList:true});
 root.KneekuraPitchMovementMakerV92=Object.freeze({version:92,applyLevel:apply,refresh,inspect:()=>({version:92,...core.inspectPitchMovementV92(clean(current().row)),error:lastError})});
 refresh();root.KneekuraMakerHelp?.decorate(box);
})(globalThis);
