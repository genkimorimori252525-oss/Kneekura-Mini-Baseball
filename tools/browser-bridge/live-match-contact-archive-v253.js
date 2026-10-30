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
