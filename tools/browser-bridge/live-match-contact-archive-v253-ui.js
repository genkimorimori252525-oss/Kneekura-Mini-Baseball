/* Self-reported archived contacts are separate from the running match. */
(function(root){
 'use strict';
 function attach(core,panel,currentSnapshot,currentPlayers){
  if(panel.querySelector('#normal-match-contact-archive-v253'))return;
  const archive=root.KneekuraLocalContactArchiveV253,codec=root.KneekuraContactArchiveCodecV253;
  const section=document.createElement('section');section.id='normal-match-contact-archive-v253';
  section.innerHTML='<h4>打球記録の保存と再表示</h4><p>保存ファイルは自己申告で、真正性や削除の有無を証明しません。再表示は現在の試合と別です。保存された全接触を分母とし、ファウル・バントも含みます。試合再開・career・Native・選手能力の認定ではありません。</p><button type="button" data-v253-save>この試合の打球記録を保存</button><button type="button" data-v253-load>保存した打球記録を読む</button><button type="button" data-v253-clear>保存記録の表示を消す</button><input type="file" data-v253-file accept=".json,application/json" hidden><p data-v253-status role="status"></p><div data-v253-saved></div>';
  panel.append(section);const status=section.querySelector('[data-v253-status]'),target=section.querySelector('[data-v253-saved]'),input=section.querySelector('[data-v253-file]');
  const adapter={
   prepare(value){const fragment=document.createDocumentFragment(),title=document.createElement('p');title.textContent='保存された自己申告 ／ 受理投球 '+value.acceptedCount+'球 ／ 保存ファイルに含まれる全接触';fragment.append(title);
    const names=new Map(value.names.map(x=>[x.playerId,x.name]));
    for(const report of value.reports){const band=core.projectLocalLineDriveAngleReferenceV249(report),p=document.createElement('p');p.textContent=names.get(report.binding.playerId)+' ／ ラインドライブ参考帯 '+band.bandCount+' / '+band.totalContacts+'件 ／ '+(band.fraction===null?'割合なし':'割合 '+String(band.fraction*100)+'%')+' ／ 25°境界 '+band.boundary25Count+'件';fragment.append(p);for(const contact of band.contacts){const row=document.createElement('p'),label=contact.label==='BOUNDARY_25'?'ラインドライブ／フライ境界':contact.label==='LINE_DRIVE_BAND'?'ラインドライブ参考帯':'参考帯外';row.textContent='投球 '+contact.pitchOrdinal+' ／ '+String(contact.launchAngleDeg)+'° ／ '+label;fragment.append(row)}}return fragment;},
   prepareEmpty:()=>document.createDocumentFragment(),commit:fragment=>target.replaceChildren(fragment),
   error:error=>{status.textContent='保存した打球記録を読み込めません: '+String(error?.message??error)},success:()=>{status.textContent='保存された記録は現在の試合とは別の自己申告です。'}
  };
  const controller=archive.createSavedArchiveControllerV253(core,codec,adapter);
  section.querySelector('[data-v253-load]').onclick=()=>input.click();section.querySelector('[data-v253-clear]').onclick=()=>controller.clear();
  input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{await controller.importText(()=>file.text())}finally{input.value=''}};
  section.querySelector('[data-v253-save]').onclick=()=>{try{
   const snap=currentSnapshot(),players=currentPlayers(),reports=snap.reports.map(r=>core.readLocalSavedContactDescriptorReportV240(r));
   const names=reports.map(r=>{const id=r.binding.playerId,name=players?.[id]?.name;return {playerId:id,name:typeof name==='string'&&name.trim()?name:id}});
   const text=archive.writeContactArchiveV253(core,codec,{version:'normal_match_contact_archive_v253',scope:'LOCAL_SAVED_DEBUG',binding:snap.binding,acceptedCount:snap.acceptedCount,reports,names});
   const url=URL.createObjectURL(new Blob([text+'\n'],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='kneekura-local-contact-record.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='この試合のローカル打球記録を保存しました。';
  }catch(error){status.textContent='この試合の打球記録を保存できません: '+String(error?.message??error)}};
 }
 root.KneekuraContactArchiveUiV253=Object.freeze({attach});
})(globalThis);
