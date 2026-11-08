
globalThis.KneekuraContactArchiveCodecV253={stringify:function stringifyDebugRecord(value) {
  const tag = '$liveDebugValue';
  return JSON.stringify(value, function (key, current) {
    const original = this[key];
    if (original && typeof original === 'object' && !Array.isArray(original)
      && Object.getPrototypeOf(original) !== Object.prototype && Object.getPrototypeOf(original) !== null)
      throw Error('expected plain record data');
    if (['function', 'symbol', 'bigint'].includes(typeof current)) throw Error('expected plain record data');
    if (current === undefined) return { [tag]: ['undefined'] };
    if (typeof current === 'number' && (!Number.isFinite(current) || Object.is(current, -0)))
      return { [tag]: ['number', Object.is(current, -0) ? '-0' : String(current)] };
    if (current && typeof current === 'object' && !Array.isArray(current) && Object.hasOwn(current, tag))
      return { [tag]: ['object', Object.entries(current)] };
    return current;
  });
},parse:function parseDebugRecord(text) {
  const tag = '$liveDebugValue';
  function fail() { throw Error('invalid compact debug record'); }
  function restore(value) {
    if (!value || typeof value !== 'object') return value;
    if (!Array.isArray(value) && Object.hasOwn(value, tag)) {
      const wrapped = value[tag];
      if (Object.keys(value).length !== 1 || !Array.isArray(wrapped)) return fail();
      if (wrapped[0] === 'undefined' && wrapped.length === 1) return undefined;
      if (wrapped[0] === 'number' && wrapped.length === 2 && typeof wrapped[1] === 'string') {
        if (wrapped[1] === '-0') return -0;
        const number = Number(wrapped[1]);
        if (Number.isFinite(number) || String(number) !== wrapped[1]) return fail();
        return number;
      }
      if (wrapped[0] === 'object' && wrapped.length === 2 && Array.isArray(wrapped[1])) {
        const keys = new Set();
        return Object.fromEntries(wrapped[1].map(pair => {
          if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== 'string' || keys.has(pair[0])) return fail();
          keys.add(pair[0]); return [pair[0], restore(pair[1])];
        }));
      }
      return fail();
    }
    for (const key of Object.keys(value)) value[key] = restore(value[key]);
    return value;
  }
  return restore(JSON.parse(text));
}};
(function(root){
'use strict';
const fields=(x,keys)=>!!x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const text=x=>typeof x==='string'&&x.trim().length>0;
const validTree=(x,stack=new Set())=>{
 if(x===null||typeof x==='string'||typeof x==='boolean')return true;if(typeof x==='number')return Number.isFinite(x);
 if(typeof x!=='object'||stack.has(x))return false;stack.add(x);
 const ok=(Array.isArray(x)?x:Object.values(x)).every(v=>validTree(v,stack));stack.delete(x);return ok;
};
const equalBinding=(a,b)=>['sessionId','configId','buildId'].every(k=>a[k]===b[k]);
function validateContactArchiveV253(core,raw){
 if(!validTree(raw)||!fields(raw,['version','scope','binding','acceptedCount','reports','names'])||raw.version!=='normal_match_contact_archive_v253'||raw.scope!=='LOCAL_SAVED_DEBUG'||!fields(raw.binding,['sessionId','configId','buildId'])||!Object.values(raw.binding).every(text)||!Number.isSafeInteger(raw.acceptedCount)||raw.acceptedCount<0||!Array.isArray(raw.reports)||!Array.isArray(raw.names))throw Error('invalid local contact archive');
 const ids=new Set(),ordinals=new Set(),reports=[];
 for(const report of raw.reports){
  if(!fields(report,['version','scope','binding','rule','contacts','summary','careerConditions','physicsEffects','modelCalibration'])||report.version!=='local_contact_descriptor_report_v240'||report.scope!=='LOCAL_SAVED_DEBUG'||!fields(report.binding,['sessionId','configId','buildId','playerId'])||!Object.values(report.binding).every(text)||!equalBinding(report.binding,raw.binding)||ids.has(report.binding.playerId)||report.rule!==null||!Array.isArray(report.contacts)||!fields(report.summary,['status','count','fraction','matched'])||report.summary.status!=='UNASSESSED'||report.summary.count!==0||report.summary.fraction!==null||report.summary.matched!==null||report.careerConditions!=='UNASSESSED'||report.physicsEffects!=='NONE'||report.modelCalibration!=='UNCONFIRMED')throw Error('invalid archived report');
  ids.add(report.binding.playerId);
  for(const contact of report.contacts){
   if(!fields(contact,['playerId','pitchOrdinal','playId','contactTick','exitVelocity','launchAngleDeg'])||contact.playerId!==report.binding.playerId||!Number.isSafeInteger(contact.pitchOrdinal)||contact.pitchOrdinal<1||contact.pitchOrdinal>raw.acceptedCount||ordinals.has(contact.pitchOrdinal)||!text(contact.playId)||!Number.isSafeInteger(contact.contactTick)||!fields(contact.exitVelocity,['x','y','z'])||!Object.values(contact.exitVelocity).every(Number.isFinite)||!Number.isFinite(contact.launchAngleDeg))throw Error('invalid archived contact');ordinals.add(contact.pitchOrdinal);
  }
  reports.push(core.readLocalSavedContactDescriptorReportV240(report));
 }
 const named=new Set(),names=[];for(const entry of raw.names){if(!fields(entry,['playerId','name'])||!text(entry.playerId)||!text(entry.name)||!ids.has(entry.playerId)||named.has(entry.playerId))throw Error('invalid archived name');named.add(entry.playerId);names.push({playerId:entry.playerId,name:entry.name})}
 if(named.size!==ids.size)throw Error('archived player name missing');
 return {version:'normal_match_contact_archive_v253',scope:'LOCAL_SAVED_DEBUG',binding:{...raw.binding},acceptedCount:raw.acceptedCount,reports,names};
}
function readContactArchiveV253(core,codec,text){if(typeof text!=='string')throw Error('invalid archive text');return validateContactArchiveV253(core,codec.parse(text));}
function writeContactArchiveV253(core,codec,archive){return codec.stringify(validateContactArchiveV253(core,archive));}

function createSavedArchiveControllerV253(core,codec,adapter){
 let revision=0,saved=null;
 async function importText(read){const ticket=++revision;try{const raw=await read();if(ticket!==revision)return;const candidate=readContactArchiveV253(core,codec,raw),fragment=adapter.prepare(candidate);if(ticket!==revision)return;adapter.commit(fragment);saved=candidate;adapter.success?.()}catch(error){if(ticket===revision)adapter.error(error)}}
 function clear(){++revision;try{const fragment=adapter.prepareEmpty();adapter.commit(fragment);saved=null;adapter.success?.()}catch(error){adapter.error(error)}}
 return Object.freeze({importText,clear,current:()=>saved});
}
root.KneekuraLocalContactArchiveV253=Object.freeze({validateContactArchiveV253,readContactArchiveV253,writeContactArchiveV253,createSavedArchiveControllerV253});
})(globalThis);

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

