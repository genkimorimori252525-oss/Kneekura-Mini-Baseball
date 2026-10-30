/* Local, self-reported practice observations; never a Native trait or physical input. */
(function(root){
 'use strict';
 const core=root.KneekuraBaseballWorkbench,practice=document.getElementById('batting-practice-editor');
 if(!practice||!core?.createLocalContactDescriptorReportV240||!core.appendAcceptedContactV240||!core.readLocalSavedContactDescriptorReportV240||!core.withLocalContactDescriptorRuleV240)return;
 const section=document.createElement('section');section.id='local-contact-session-v240';
 section.innerHTML='<h3>連続練習の打球記録（ローカル）</h3><p>この画面の受理済み練習だけを記録します。保存データは自己申告で、Native 記録や得能の認証ではありません。分類は参考で、基準は未校正、career 日数条件は未評価です。</p><p>ラインドライブの打出角10〜25°は <a href="https://www.mlb.com/glossary/statcast/launch-angle" target="_blank" rel="noopener noreferrer">MLBの一般的な目安</a>による参考帯です。25°はフライとの境界です。分母はこの記録の全接触で、選手の傾向や得能の判定ではありません。</p><button type="button" id="local-rule-load-v240">分類基準 JSON を読み込む（参考）</button><button type="button" id="local-rule-clear-v240">基準を解除</button><input type="file" id="local-rule-file-v240" accept="application/json,.json" hidden><p id="local-rule-status-v240" role="status"></p><div id="local-contact-session-v240-results"></div>';
 practice.append(section);
 let current=new Map(),saved=[],session=null,rule=null;
 const results=section.querySelector('#local-contact-session-v240-results'),status=section.querySelector('#local-rule-status-v240'),file=section.querySelector('#local-rule-file-v240');
 function displayPlayer(id){const players=root.KneekuraLiveGameRosterCatalog?.players,player=Array.isArray(players)?players.find(x=>x?.playerId===id):undefined,name=player?.name;return typeof name==='string'&&name.trim()?name+'（'+id+'）':id;}
 function render(){
  results.replaceChildren();status.textContent=rule?'基準 '+rule.reference+'（未校正・参考）':'基準 未設定';
  if(saved.length===0&&current.size===0){const line=document.createElement('p');line.textContent='打球 0件 ／ ラインドライブ参考帯 0件・割合なし ／ 基準 未評価 ／ career 日数 未評価';results.append(line);}
  for(const report of [...saved,...current.values()]){
   const line=document.createElement('p'),angles=report.contacts.map(x=>x.launchAngleDeg.toFixed(1)+'°').join('、');
   line.textContent=(report.scope==='LOCAL_SAVED_DEBUG'?'保存された自己申告（選手名は現在の登録を参照）':'現在の練習')+' ／ '+displayPlayer(report.binding.playerId)+' ／ 打球 '+report.contacts.length+'件'+(angles?' ／ 打出角 '+angles:'')+(report.summary.status==='ASSESSED'?' ／ 基準 '+report.rule.reference+' ／ 該当 '+report.summary.count+'件 ／ 割合 '+(report.summary.fraction*100)+'% ／ '+(report.summary.matched?'参考基準を満たす':'参考基準未達'):' ／ 基準 未評価')+' ／ 未校正 ／ career 日数 未評価';
   results.append(line);
   if(typeof core.projectLocalLineDriveAngleReferenceV249==='function'){
    const band=core.projectLocalLineDriveAngleReferenceV249(report),summary=document.createElement('p');
    summary.textContent='ラインドライブ参考帯 10〜25° ／ '+band.bandCount+' / '+band.totalContacts+'件 ／ '+(band.fraction===null?'割合なし':'割合 '+String(band.fraction*100)+'%')+' ／ うち25°境界 '+band.boundary25Count+'件 ／ 選手の傾向判定 未評価';results.append(summary);
    for(const contact of band.contacts){const item=document.createElement('p'),label=contact.label==='BOUNDARY_25'?'ラインドライブ／フライ境界':contact.label==='LINE_DRIVE_BAND'?'ラインドライブ参考帯':'参考帯外';item.textContent='投球 '+contact.pitchOrdinal+' ／ '+String(contact.launchAngleDeg)+'° ／ '+label;results.append(item);}
   }
  }
 }
 function begin(detail,archived){
  saved=archived?.reports??[];rule=archived?.rule??null;current=new Map();
  session={sessionId:crypto.randomUUID(),configId:crypto.randomUUID(),buildId:JSON.stringify(detail.build)};
  render();
 }
 function validateSidecar(raw){
  if(!raw||raw.version!=='local_contact_session_sidecar_v240'||!Array.isArray(raw.reports))throw Error('invalid local contact sidecar');
  const reports=raw.reports.map(report=>core.readLocalSavedContactDescriptorReportV240(report));
  const nextRule=raw.rule===undefined?null:validateRule(raw.rule);return {reports,rule:nextRule};
 }
 function validateRule(raw){
  if(raw===null)return null;
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).sort().join('|')!=='lowerAngleDeg|minimumFraction|reference|upperAngleDeg'||typeof raw.reference!=='string'||!raw.reference.trim())throw Error('分類基準の形式を確認してください。');
  return core.createLocalContactDescriptorReportV240({sessionId:'validation',configId:'validation',buildId:'validation',playerId:'validation'},raw).rule;
 }
 function setRule(raw){
  const next=validateRule(raw),newSaved=saved.map(r=>core.withLocalContactDescriptorRuleV240(r,next)),newCurrent=new Map([...current].map(([id,r])=>[id,core.withLocalContactDescriptorRuleV240(r,next)]));
  rule=next;saved=newSaved;current=newCurrent;render();
 }
 section.querySelector('#local-rule-load-v240').onclick=()=>file.click();
 section.querySelector('#local-rule-clear-v240').onclick=()=>setRule(null);
 file.onchange=async()=>{try{if(file.files[0])setRule(JSON.parse(await file.files[0].text()));}catch(error){status.textContent=String(error.message??error);}finally{file.value='';}};
 root.addEventListener('maker-practice-start-v240',event=>begin(event.detail,null));
 root.addEventListener('maker-practice-restore-v240',event=>begin(event.detail,event.detail.sidecar??null));
 root.addEventListener('maker-practice-accepted-v240',event=>{
  if(!session)return;
  try{
   const {record,pitchOrdinal}=event.detail,playerId=record.batterPlayerId,playId=record.beforeMatch?.playId;
   if(!Number.isSafeInteger(playId))throw Error('受理済み投球の playId が未接続です。');
   const previous=current.get(playerId)??core.createLocalContactDescriptorReportV240({...session,playerId},rule);
   const result=core.appendAcceptedContactV240(previous,{pitch:record,pitchOrdinal,playId:String(playId)});
   if(result.status==='CONFLICT')throw Error('同じ投球のローカル記録が競合しました。');
   if(result.status==='ADDED')current.set(playerId,result.report);
   render();
  }catch(error){const line=document.createElement('p');line.textContent='ローカル記録を更新できません: '+String(error.message??error);results.append(line);}
 });
 root.KneekuraContactSessionV240=Object.freeze({
  exportSidecar:()=>({version:'local_contact_session_sidecar_v240',reports:structuredClone([...saved,...current.values()]),rule:structuredClone(rule)}),
  validateSidecar,setRule,
 });
 render();
})(globalThis);
