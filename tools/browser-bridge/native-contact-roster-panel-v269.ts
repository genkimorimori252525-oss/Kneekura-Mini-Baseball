import {prepareNativeContactRosterViewV268} from './native-contact-roster-view-v268';

const reasons:Record<string,string>={
 ROSTER_SNAPSHOT_NAMESPACE_ABSENT:'ロスターの保存領域がありません',ROSTER_SNAPSHOT_NOT_FOUND:'指定されたロスターが見つかりません',
 SUBJECT_LINK_NAMESPACE_ABSENT:'人物リンクの保存領域がありません',EMPTY_ROSTER_SNAPSHOT:'指定ロスターに選手がいません',
 SUBJECT_LINK_MISSING:'人物リンクが見つかりません',SUBJECT_LINK_AMBIGUOUS:'人物リンクを一意に特定できません',
 NO_REGISTERED_CONTACTS:'登録済みの接触記録がありません',INVENTORY_NOT_CAPTURED:'接触記録の収集が完了していません',
 INVENTORY_CHANGED_SINCE_CAPTURE:'収集後に接触記録が変わりました',UNRESOLVED_CONTACT_IDENTITY:'同じ打席の接触を区別できません',
 PROJECTION_NOT_READY:'集計の準備が整っていません',SNAPSHOT_INCONSISTENT:'収集記録の整合性を確認できません',
 UNDEFINED_CONTACT_DIRECTION:'打球速度から打出角を求められません'
};
const producerNames:Record<string,string>={physical_pitch_progress_actions:'投球進行の接触記録',pa_physical_v1_resolutions:'打席の物理結果の接触記録',pa_initial_joint_v1_executions:'初期統合物理計算の接触記録'};
const reasonText=(code:string)=>Object.hasOwn(reasons,code)?reasons[code]:'詳細未確認（'+code+'）';
const stateText=(value:string)=>value==='OBSERVED'?'観測済み':value==='UNKNOWN'?'未確認':value==='PARTIAL'?'一部未確認':value==='OBSERVED_FOR_SNAPSHOT_ROSTER'?'指定ロスターを確認済み':'未確認（'+value+'）';
const percent=(fraction:number)=>{const n=fraction*100,rounded=Number(n.toFixed(1));return (rounded===n?'':'約')+String(rounded)+'%'};

/** Separate, passive display: importing a file grants no Native authority. */
export function attachNativeContactRosterPanelV269(parent:HTMLElement){
 const doc=parent.ownerDocument,section=doc.createElement('section'),heading=doc.createElement('h4'),note=doc.createElement('p'),loadButton=doc.createElement('button'),clearButton=doc.createElement('button'),file=doc.createElement('input'),status=doc.createElement('p'),results=doc.createElement('div');
 section.id='native-contact-roster-panel-v269';heading.textContent='外部の打球記録';note.textContent='外部 JSON の内容です。Native 由来や真正性は確認できません。現在の試合と別に表示します。';
 loadButton.type='button';loadButton.textContent='外部記録を読む';clearButton.type='button';clearButton.textContent='外部記録の表示を消す';file.type='file';file.accept='.json,application/json';file.hidden=true;status.setAttribute('role','status');
 section.append(heading,note,loadButton,clearButton,file,status,results);parent.append(section);let revision=0;
 const prepare=(text:string)=>{
  const v=prepareNativeContactRosterViewV268(text),fragment=doc.createDocumentFragment();
  const line=(value:string)=>{const p=doc.createElement('p');p.textContent=value;fragment.append(p)};
  line('外部 JSON ／ Native 由来・真正性は未確認');
  line('キャリア '+v.careerId+' ／ ロスター '+v.rosterSnapshotId+' ／ 対象: 指定ロスターのみ ／ 対応 Native 記録のみ');
  line('ロスターは指定時点、人物リンクと最終登録接触は読み取り時点の情報です。');
  if(v.roster)line('ロスターの日 '+v.roster.effectiveDay+' ／ 版 '+v.roster.revision+' ／ 人数 '+v.roster.playerCount);
  if(v.reasons.length)line('状態 '+stateText(v.status)+' ／ 理由 '+v.reasons.map(reasonText).join('、'));
  if(v.rows!==null&&v.rows.length===0)line('指定ロスターに選手がいません。');
  for(const row of v.rows??[]){
   line('選手 '+row.playerId+' ／ 名前 未確認 ／ 状態 '+stateText(row.status)+(row.reasons.length?' ／ 理由 '+row.reasons.map(reasonText).join('、'):''));
   if(row.identity)line('人物 ID '+row.identity.personId+' ／ リンク元 '+row.identity.sourceId);else line('人物リンク 未確認');
   if(row.producerAvailability)for(const [name,value] of Object.entries(row.producerAvailability))line('記録元 '+(Object.hasOwn(producerNames,name)?producerNames[name]:'種類未確認（'+name+'）')+' ／ '+(value==='PRESENT'?'記録元あり（件数は別）':value==='ABSENT'?'記録元なし（未収録）':'状態未確認（'+value+'）'));else line('記録元 未確認');
   if(row.source)line('最終登録接触 通算 '+row.source.time.day+'日 ／ 順序 '+row.source.time.sequence);
   if(row.totalContacts===null)line('打球数・参考帯・割合 未確認');
   else line('打球 '+row.totalContacts+'件 ／ ラインドライブ参考帯 '+row.bandCount+'件 ／ 25°境界 '+row.boundary25Count+'件 ／ 割合 '+(row.fraction===null?'未確認':percent(row.fraction)));
   for(const contact of row.contacts??[]){const label=contact.label==='BOUNDARY_25'?'ラインドライブ／フライ境界':contact.label==='LINE_DRIVE_BAND'?'ラインドライブ参考帯':'参考帯外';line('打出角 '+(Object.is(contact.launchAngleDeg,-0)?'-0':String(contact.launchAngleDeg))+'° ／ '+label)}
  }
  line('打出角10〜25°は MLB の一般的な参考帯で、25°は境界です。選手能力や回転物理の認定ではありません。');return fragment;
 };
 async function load(read:()=>Promise<string>){const ticket=++revision;try{const text=await read();if(ticket!==revision)return;const candidate=prepare(text);if(ticket!==revision)return;results.replaceChildren(candidate);status.textContent='外部記録を表示中（真正性 未確認）';}catch{if(ticket===revision)status.textContent='外部記録を読み込めません。現在の表示は保持しました。'}}
 function clear(){revision++;results.replaceChildren();status.textContent='外部記録の表示を消しました。'}
 loadButton.onclick=()=>file.click();clearButton.onclick=clear;
 file.onchange=()=>{const selected=file.files?.[0];if(!selected)return;file.value='';void load(async()=>{if(selected.size>10_000_000)throw Error('file too large');return selected.text()})};
 return Object.freeze({section,load,clear});
}
