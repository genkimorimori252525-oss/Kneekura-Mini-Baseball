/* Explicit local two-pitch diagnosis; never earned or Native qualification. */
(function(root){
 'use strict';
 const practice=root.KneekuraBattingPractice,container=document.getElementById('batting-practice-editor');if(!practice||!container)return;
 const panel=document.createElement('section');panel.id='spin-practice-v239';
 panel.innerHTML='<h3>固定スイングの二球診断</h3><p>開始時の現在の打者・打ち方・方向・二球を固定します。変更は診断中に反映されません。未校正の固定設定を2球試します。技術の習得や得能付与は別判定です。</p><label>診断する技術 <select id="spin-practice-technique-v239"><option value="BACKSPIN">バックスピン</option><option value="TOPSPIN">トップスピン</option><option value="SLICE">スライス</option><option value="HOOK">フック</option></select></label><div class="swing-toolbar"><button type="button" id="spin-practice-start-v239">診断を開始</button><button type="button" id="spin-practice-next-v239">診断の次球</button><button type="button" id="spin-practice-close-v239">診断を終了</button></div><p id="spin-practice-status-v239" role="status"></p><div id="spin-practice-result-v239"></div>';
 const names={BACKSPIN:'バックスピン',TOPSPIN:'トップスピン',SLICE:'スライス',HOOK:'フック'},phases={ACTIVE:'進行中',CLOSED:'終了',INTERRUPTED:'中断'},statuses={HOLD:'判定保留',UNAVAILABLE:'未成立',DIAGNOSTIC_CRITERION_MET:'今回の診断条件を満たす'},outcomes={CONTACT:'接触',MISS:'未接触',NO_TARGET:'対象なし',UNRESOLVED:'未解決'};
 container.append(panel);const $=id=>panel.querySelector('#'+id),status=$('spin-practice-status-v239'),output=$('spin-practice-result-v239');let busy=false;
 function render(){
  const snapshot=practice.inspect(),state=snapshot.state,spin=state?.spinMotorPracticeV239;
  $('spin-practice-start-v239').disabled=busy||!state||snapshot.stale||state.finished||!!spin;
  $('spin-practice-next-v239').disabled=busy||spin?.phase!=='ACTIVE';$('spin-practice-close-v239').disabled=busy||spin?.phase!=='ACTIVE';
  output.replaceChildren();if(!spin)return;
  const id=spin.plan.motor.subjectId,name=root.KneekuraLiveGameRosterCatalog?.players?.find(p=>p.playerId===id)?.name??id;
  const text=document.createElement('p');text.textContent='打者 '+name+'（'+id+'） ／ '+(names[spin.plan.motor.technique]??'技術不明')+' ／ 対象球 '+spin.plan.pitchOrdinals.join('・')+' ／ '+(phases[spin.phase]??'状態不明')+' ／ '+(statuses[spin.evaluation.status]??'判定不明')+' ／ 未校正・得能未授与';output.append(text);
  const criterion=document.createElement('p'),c=spin.plan.criterion;criterion.textContent=c===null?'参考基準：未設定':'参考基準：対象 '+spin.plan.pitchOrdinals.length+'球、必要試行数 '+c.minimumIndependentTrials+'球以上、接触率 '+(c.minimumContactFraction*100)+'%以上、成功率 '+(c.minimumSuccessFraction*100)+'%以上、要求向き成分 '+c.minimumDirectionalSpin+' rad/s以上、通常との差 '+c.minimumDirectionalImprovement+' rad/s以上。';output.append(criterion);
  for(const slot of spin.slots){if(!spin.entries.some(entry=>entry.kind==='COMPLETE'&&entry.trial.opportunity.pitchOrdinal===slot.pitchOrdinal)){const row=document.createElement('p');row.textContent='球 '+slot.pitchOrdinal+' ／ 未実施';output.append(row);}}
  for(const observation of spin.evaluation.observations??[]){const row=document.createElement('p');row.textContent='比較 球 '+observation.opportunity.pitchOrdinal+' ／ 通常 '+String(observation.normalDirectionalSpin)+' rad/s ／ 診断 '+String(observation.actualDirectionalSpin)+' rad/s ／ 差 '+String(observation.directionalImprovement)+' rad/s';output.append(row);}
  for(const item of spin.entries){const row=document.createElement('p');row.textContent='球 '+item.trial.opportunity.pitchOrdinal+' ／ '+(outcomes[item.trial.outcome]??'結果不明')+(item.hold?' ／ 判定保留':'');output.append(row);}
 }
 async function run(fn){if(busy)return;busy=true;render();try{const result=await fn();status.textContent=result?.accepted===false?'未解決のため同じ機会を保持しました。再試行または終了できます。':'診断の状態を更新しました。';}catch(error){status.textContent=String(error.message??error);}finally{busy=false;render();}}
 $('spin-practice-start-v239').onclick=()=>run(()=>practice.startSpinMotor($('spin-practice-technique-v239').value));
 $('spin-practice-next-v239').onclick=()=>run(()=>practice.nextSpinMotor());$('spin-practice-close-v239').onclick=()=>run(()=>practice.closeSpinMotor());
 root.addEventListener('maker-practice-start-v240',render);root.addEventListener('maker-practice-restore-v240',render);root.addEventListener('maker-practice-accepted-v240',()=>queueMicrotask(render));
 render();
})(globalThis);
