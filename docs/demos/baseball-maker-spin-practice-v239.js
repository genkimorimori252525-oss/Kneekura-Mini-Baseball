/* Explicit local two-pitch diagnosis; never earned or Native qualification. */
(function(root){
 'use strict';
 const practice=root.KneekuraBattingPractice,container=document.getElementById('batting-practice-editor');if(!practice||!container)return;
 const panel=document.createElement('section');panel.id='spin-practice-v239';
 panel.innerHTML='<h3>打球の回転を狙う練習</h3><p>開始時の現在の打者・打ち方・方向・二球を固定します。変更は診断中に反映されません。未校正の固定設定を2球試します。技術の習得や得能付与は別判定です。</p><label>診断する技術 <select id="spin-practice-technique-v239"><option value="BACKSPIN">バックスピン</option><option value="TOPSPIN">トップスピン</option><option value="SLICE">スライス</option><option value="HOOK">フック</option></select></label><div class="swing-toolbar"><button type="button" id="spin-practice-start-v239">診断を開始</button><button type="button" id="spin-practice-next-v239">診断の次球</button><button type="button" id="spin-practice-close-v239">診断を終了</button></div><p>同じ本人の反復診断では、選んだ回転を狙える打ち方を予測に合わせて選びます。練習開始時の番号と次の番号で別々に開始します。各回は本人の最初の1球を評価し、打席が終わるまで通常どおり続けます。経験や疲労は各回の初期設定に戻ります。</p><div class="swing-toolbar"><button type="button" id="episodes-start-v242">本人の反復診断を開始</button><button type="button" id="episodes-next-v242">反復診断の次球</button><button type="button" id="episodes-advance-v242">次の回へ</button><button type="button" id="episodes-close-v242">反復診断を終了</button></div><p id="spin-practice-status-v239" role="status"></p><div id="spin-practice-result-v239"></div>';
 const names={BACKSPIN:'バックスピン',TOPSPIN:'トップスピン',SLICE:'スライス',HOOK:'フック'},phases={ACTIVE:'進行中',ENDED:'打席終了・次の練習待ち',CLOSED:'終了',INTERRUPTED:'中断'},statuses={HOLD:'判定保留',UNAVAILABLE:'未成立',DIAGNOSTIC_CRITERION_MET:'今回の診断条件を満たす'},outcomes={CONTACT:'接触',MISS:'未接触',NO_TARGET:'対象なし',UNRESOLVED:'未解決'};
 const reasonText={NO_CANDIDATE_MEETS_DECLARED_THRESHOLDS:'基準を満たす候補なし',CANDIDATE_SEARCH_UNRESOLVED:'接触の予測が未確定',NO_NOMINAL_REGISTRATION:'通常の打ち方を準備できず',PREDICTION_NOT_DELIVERED:'予測がまだ届いていない'};
 const describeReason=reason=>reasonText[reason]??'候補を選べませんでした',displayValue=value=>value===null||value===undefined?'未評価':String(value);
 container.append(panel);const $=id=>panel.querySelector('#'+id),status=$('spin-practice-status-v239'),output=$('spin-practice-result-v239');let busy=false;
 function render(){
  const snapshot=practice.inspect(),state=snapshot.state,spin=state?.spinMotorPracticeV239,episodes=state?.spinPracticeEpisodesV242;
  $('spin-practice-start-v239').disabled=busy||!state||snapshot.stale||state.finished||!!spin||!!episodes;
  $('spin-practice-next-v239').disabled=busy||spin?.phase!=='ACTIVE';$('spin-practice-close-v239').disabled=busy||spin?.phase!=='ACTIVE';
  $('episodes-start-v242').disabled=busy||!state||snapshot.stale||state.finished||state.pitchCount!==0||!!spin||!!episodes;
  $('episodes-next-v242').disabled=busy||episodes?.phase!=='ACTIVE';$('episodes-advance-v242').disabled=busy||episodes?.phase!=='ENDED'||episodes.activeIndex+1>=episodes.slots.length;
  $('episodes-close-v242').disabled=busy||!['ACTIVE','ENDED'].includes(episodes?.phase);
  output.replaceChildren();
  if(episodes){const plan=episodes.plan,id=plan.motor.subjectId,name=root.KneekuraLiveGameRosterCatalog?.players?.find(p=>p.playerId===id)?.name??id,line=document.createElement('p');
   line.textContent='反復診断 ／ 打者 '+name+'（'+id+'） ／ '+(names[plan.motor.technique]??'技術不明')+' ／ '+(phases[episodes.phase]??'状態不明')+' ／ '+(statuses[episodes.evaluation.status]??'判定不明')+' ／ 未校正・得能未授与';output.append(line);
   const c=plan.criterion,rule=document.createElement('p');rule.textContent=c===null?'参考基準：未設定':'参考基準：対象 '+plan.episodes.length+'回、必要試行数 '+c.minimumIndependentTrials+'回以上、接触率 '+(c.minimumContactFraction*100)+'%以上、成功率 '+(c.minimumSuccessFraction*100)+'%以上、要求向き成分 '+c.minimumDirectionalSpin+' rad/s以上、通常との差 '+c.minimumDirectionalImprovement+' rad/s以上。';output.append(rule);
    for(const slot of episodes.slots){const row=document.createElement('p'),target=slot.steps.find(x=>x.kind==='TARGET'),hold=slot.steps.some(x=>x.kind==='HOLD'),record=target?.trialRecord,diagnostic=record?.play.diagnostics?.observedSpinContactFrameV244??record?.play.diagnostics?.observedSpinComposeV238,mode=record?.command.practiceSwingDecisionV241?.mode,decision={AUTO:'おまかせ',SWING:'振る',TAKE:'見送る'}[mode]??'指定なし';
    const outcome=target?(diagnostic?.status==='NO_TARGET'?'対象なし（'+describeReason(diagnostic.reason)+'）':record?.play.contact?'接触':'未接触')+(record?.play.call?' ／ '+record.play.call:'')+' ／ 意思 '+decision:hold?'未解決・評価保留':'本人の評価球は未実施';
    row.textContent='第 '+(slot.index+1)+'回 ／ 固定番号 '+slot.seed+' ／ '+(!slot.initial?'未開始':slot.ended?'打席終了':'未完')+' ／ '+outcome;output.append(row);}
   for(const obs of episodes.evaluation.observations??[]){const row=document.createElement('p');row.textContent='比較 ／ 通常 '+displayValue(obs.normalDirectionalSpin)+' rad/s ／ 診断 '+displayValue(obs.actualDirectionalSpin)+' rad/s ／ 差 '+displayValue(obs.directionalImprovement)+' rad/s';output.append(row);}
  }
  if(!spin)return;
  const id=spin.plan.motor.subjectId,name=root.KneekuraLiveGameRosterCatalog?.players?.find(p=>p.playerId===id)?.name??id;
  const text=document.createElement('p');text.textContent='打者 '+name+'（'+id+'） ／ '+(names[spin.plan.motor.technique]??'技術不明')+' ／ 対象球 '+spin.plan.pitchOrdinals.join('・')+' ／ '+(phases[spin.phase]??'状態不明')+' ／ '+(statuses[spin.evaluation.status]??'判定不明')+' ／ 未校正・得能未授与';output.append(text);
  const criterion=document.createElement('p'),c=spin.plan.criterion;criterion.textContent=c===null?'参考基準：未設定':'参考基準：対象 '+spin.plan.pitchOrdinals.length+'球、必要試行数 '+c.minimumIndependentTrials+'球以上、接触率 '+(c.minimumContactFraction*100)+'%以上、成功率 '+(c.minimumSuccessFraction*100)+'%以上、要求向き成分 '+c.minimumDirectionalSpin+' rad/s以上、通常との差 '+c.minimumDirectionalImprovement+' rad/s以上。';output.append(criterion);
  for(const slot of spin.slots){if(!spin.entries.some(entry=>entry.kind==='COMPLETE'&&entry.trial.opportunity.pitchOrdinal===slot.pitchOrdinal)){const row=document.createElement('p');row.textContent='球 '+slot.pitchOrdinal+' ／ 未実施';output.append(row);}}
  for(const observation of spin.evaluation.observations??[]){const row=document.createElement('p');row.textContent='比較 球 '+observation.opportunity.pitchOrdinal+' ／ 通常 '+String(observation.normalDirectionalSpin)+' rad/s ／ 診断 '+String(observation.actualDirectionalSpin)+' rad/s ／ 差 '+String(observation.directionalImprovement)+' rad/s';output.append(row);}
  for(const item of spin.entries){const row=document.createElement('p');row.textContent='球 '+item.trial.opportunity.pitchOrdinal+' ／ '+(outcomes[item.trial.outcome]??'結果不明')+(item.hold?' ／ 判定保留':'');output.append(row);}
 }
 async function run(fn){if(busy)return;busy=true;render();try{const result=await fn();status.textContent=result?.accepted===false?'未解決のため同じ機会を保持しました。再試行または終了できます。':'診断の状態を更新しました。';}catch(error){status.textContent=String(error.message??error);}finally{busy=false;render();}}
 $('spin-practice-start-v239').onclick=()=>run(()=>practice.startSpinMotor($('spin-practice-technique-v239').value));
 $('episodes-start-v242').onclick=()=>run(()=>practice.startEpisodes($('spin-practice-technique-v239').value));$('episodes-next-v242').onclick=()=>run(()=>practice.nextEpisode());$('episodes-advance-v242').onclick=()=>run(()=>practice.advanceEpisode());$('episodes-close-v242').onclick=()=>run(()=>practice.closeEpisodes());
 $('spin-practice-next-v239').onclick=()=>run(()=>practice.nextSpinMotor());$('spin-practice-close-v239').onclick=()=>run(()=>practice.closeSpinMotor());
 root.addEventListener('maker-practice-start-v240',render);root.addEventListener('maker-practice-restore-v240',render);root.addEventListener('maker-practice-accepted-v240',()=>queueMicrotask(render));
 render();
})(globalThis);
