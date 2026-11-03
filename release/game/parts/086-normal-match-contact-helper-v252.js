
/* Pure projection of recorded world-space exit velocities; no physics or identity authority. */
(function(root){
 'use strict';
 function project(report){
  if(!report||!Array.isArray(report.contacts))return {status:'UNKNOWN',reason:'CONTACTS_UNAVAILABLE',contacts:[]};
  const contacts=report.contacts.map(c=>{
   const v=c?.exitVelocity;
   if(!v||![v.x,v.y,v.z].every(Number.isFinite)||Math.hypot(v.x,v.z)===0)return {pitchOrdinal:c?.pitchOrdinal??null,status:'UNKNOWN',angleDegrees:null,side:null};
   return {pitchOrdinal:c.pitchOrdinal,status:'OBSERVED',angleDegrees:Math.atan2(v.x,v.z)*180/Math.PI,side:v.x>0?'FIRST_BASE_SIDE':v.x<0?'THIRD_BASE_SIDE':'CENTER_AXIS'};
  });
  const counts={firstBaseSide:0,thirdBaseSide:0,centerAxis:0,unknown:0};
  for(const c of contacts){if(c.status==='UNKNOWN')counts.unknown++;else if(c.side==='FIRST_BASE_SIDE')counts.firstBaseSide++;else if(c.side==='THIRD_BASE_SIDE')counts.thirdBaseSide++;else counts.centerAxis++;}
  return {status:counts.unknown?'PARTIAL':'OBSERVED',counts,contacts};
 }
 root.KneekuraContactDirectionProjectionV276=Object.freeze({project});
})(globalThis);

/* One local match only. This descriptive observation does not alter physics or award traits. */
(function(root){
 'use strict';
 function createLedger(core,binding){
  if(!core?.createLocalContactDescriptorReportV240||!core.appendAcceptedContactV240||!core.projectLocalLineDriveAngleReferenceV249)throw Error('打球記録の共通機能がありません。');
  const seen=new Map(),byPlayer=new Map();let lastOrdinal=0;
  function accept(pitch,beforeCount,afterCount){
   if(!Number.isSafeInteger(beforeCount)||beforeCount<0||!Number.isSafeInteger(afterCount)||afterCount!==beforeCount+1)throw Error('受理投球の ordinal が一致しません。');
   const ordinal=afterCount,playerId=pitch?.batterPlayerId,playId=pitch?.beforeMatch?.playId;
   if(typeof playerId!=='string'||!playerId||!Number.isSafeInteger(playId))throw Error('受理投球の識別情報がありません。');
   const existing=seen.get(ordinal),hasContact=!!pitch.play?.contact;
   if(existing&&(existing.playerId!==playerId||existing.playId!==playId||existing.hasContact!==hasContact))throw Error('同一 ordinal の受理投球が conflict です。');
   if(!existing&&ordinal!==lastOrdinal+1)throw Error('受理投球の ordinal に欠落があります。');
   const previous=byPlayer.get(playerId)??core.createLocalContactDescriptorReportV240({...binding,playerId},null);
   const result=core.appendAcceptedContactV240(previous,{pitch,pitchOrdinal:ordinal,playId:String(playId)});
   if(result.status==='CONFLICT')throw Error('同一 ordinal の打球が conflict です。');
   if(existing&&result.status==='NO_CONTACT')return 'DUPLICATE';
   if(existing&&result.status!=='DUPLICATE')throw Error('受理投球の重複が conflict です。');
   if(result.status==='ADDED')byPlayer.set(playerId,result.report);
   if(!existing){seen.set(ordinal,{playerId,playId,hasContact});lastOrdinal=ordinal;}
   return result.status;
  }
  return Object.freeze({accept,reports:()=>[...byPlayer.values()],snapshot:()=>structuredClone({binding,acceptedCount:lastOrdinal,reports:[...byPlayer.values()]})});
 }
 let panel=null,ledger=null,players=null,healthy=false;
 function showError(error){if(panel){const n=panel.querySelector('[data-contact-status]');if(n)n.textContent='打球記録を更新できません: '+String(error?.message??error);}}
 function render(core){
  const results=panel.querySelector('[data-contact-results]');results.replaceChildren();
  const reports=ledger.reports();if(!healthy){const n=document.createElement('p');n.textContent='記録の完全性 未確認。表示は記録済み分です。';results.append(n)}if(!reports.length){const p=document.createElement('p');p.textContent=healthy?'この試合の打球 0件 ／ 割合なし':'記録済み打球 0件 ／ 全体は未確認 ／ 割合なし';results.append(p)}
  for(const report of reports){const band=core.projectLocalLineDriveAngleReferenceV249(report),p=document.createElement('p'),name=players?.[report.binding.playerId]?.name,displayName=typeof name==='string'&&name.trim()?name:report.binding.playerId;p.textContent=displayName+' ／ ラインドライブ参考帯 '+band.bandCount+' / '+band.totalContacts+'件 ／ '+(band.fraction===null?'割合なし':'割合 '+String(band.fraction*100)+'%')+' ／ 25°境界 '+band.boundary25Count+'件';results.append(p);const direction=root.KneekuraContactDirectionProjectionV276?.project(report),row=document.createElement('p');row.textContent=direction?.status==='UNKNOWN'?'打球方向 未確認':direction?'打球方向（記録済み分・中央軸は厳密にX=0） 一塁側 '+direction.counts.firstBaseSide+'件 ／ 三塁側 '+direction.counts.thirdBaseSide+'件 ／ 中央軸 '+direction.counts.centerAxis+'件 ／ 未確認 '+direction.counts.unknown+'件 ／ 角度（＋一塁側・−三塁側）: '+direction.contacts.map(c=>c.status==='UNKNOWN'?'未確認':'約'+(Object.is(c.angleDegrees,-0)?'-0.0':c.angleDegrees.toFixed(1))+'°').join('、'):'打球方向 未対応';results.append(row);for(const contact of band.contacts){const row=document.createElement('p'),label=contact.label==='BOUNDARY_25'?'ラインドライブ／フライ境界':contact.label==='LINE_DRIVE_BAND'?'ラインドライブ参考帯':'参考帯外';row.textContent='投球 '+contact.pitchOrdinal+' ／ '+String(contact.launchAngleDeg)+'° ／ '+label;results.append(row)}}
 }
 function reset(core,playerById){
  try{
   if(!panel){panel=document.createElement('section');panel.id='normal-match-contact-v252';panel.innerHTML='<h3>この試合の打球記録（ローカル）</h3><p>ラインドライブ参考帯は打出角10〜25°のMLB一般目安です。25°は境界です。分母はファウル・バントを含む全接触です。選手能力・傾向は未評価です。</p><p>この画面の試合だけを記録し、保存後の再開や career の認定には対応していません。</p><p data-contact-status role="status"></p><div data-contact-results></div>';document.querySelector('.manager-controls').after(panel);}
   players=playerById;ledger=createLedger(core,{sessionId:crypto.randomUUID(),configId:crypto.randomUUID(),buildId:'normal-match-contact-v252'});healthy=true;panel.querySelector('[data-contact-status]').textContent='';render(core);
   try{root.KneekuraContactArchiveUiV253?.attach(core,panel,()=>{if(!healthy||!ledger)throw Error('現在の試合の記録に未解決のエラーがあります。');return ledger.snapshot()},()=>players)}catch(error){showError(error)}
  }catch(error){ledger=null;healthy=false;showError(error)}
 }
 function acceptAfterHistory(core,record,beforeCount,afterCount){try{if(!ledger)throw Error('この試合の打球記録が開始されていません。');ledger.accept(record,beforeCount,afterCount);render(core)}catch(error){healthy=false;let renderError=null;try{if(panel&&ledger)render(core)}catch(e){renderError=e}showError(renderError?new Error(String(error?.message??error)+' ／ 表示も更新できません: '+String(renderError?.message??renderError)):error)}}
 root.KneekuraLiveMatchContactV252=Object.freeze({createLedger,reset,acceptAfterHistory});
})(globalThis);

