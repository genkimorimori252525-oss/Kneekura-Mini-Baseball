/* Presentation only: retain input nodes, handlers, drafts, errors and canonical maker APIs. */
(function(root){
 'use strict';
 const document=root.document,$=id=>document.getElementById(id);
 function install(){
  if(root.KneekuraMakerLayoutV112)return;
  if(!root.baseballMaker||!$('live-public-abilities'))throw Error('メーカーの表示整理に必要な編集欄がありません。');
  document.body.classList.add('maker-layout-v112');
  const disclosures=new Map();
  function disclosure(id,title,parent,before){
   if(disclosures.get(id)?.isConnected)return disclosures.get(id);
   const node=document.createElement('details'),summary=document.createElement('summary');
   node.id=id;node.className='maker-disclosure-v112';summary.textContent=title;node.append(summary);
   parent.insertBefore(node,before??null);disclosures.set(id,node);return node;
  }
  function fold(node,id,title){
   if(!node||node.closest('.maker-disclosure-v112')||node.matches('[role=status],[role=alert],.error'))return;
   const target=disclosure(id,title,node.parentElement,node);target.append(node);
  }
  function text(node,value){if(node&&node.textContent!==value)node.textContent=value;}
  function textNode(node,value){
   const first=node&&[...node.childNodes].find(n=>n.nodeType===3);
   if(first&&first.textContent!==value)first.textContent=value;
  }
  const header=document.querySelector('header'),mode=$('maker-mode-human')?.parentElement;
  header.querySelector(':scope>div>p')?.classList.add('maker-redundant-v112');
  if(mode){mode.classList.add('maker-mode-v112');mode.setAttribute('role','group');mode.setAttribute('aria-label','編集モード');
   mode.querySelector('span')?.classList.add('maker-redundant-v112');text($('maker-mode-human'),'通常編集');}
  const audio=[...header.querySelectorAll('details')].find(d=>d.querySelector('summary')?.textContent.startsWith('効果音'));
  if(audio){audio.classList.add('maker-audio-v112');text(audio.querySelector('summary'),'効果音');}
  text($('save-json'),'全体JSONを保存');text($('load-json'),'JSON読込');
  const batLength=$('swing-bat-length');if(batLength){
   batLength.dataset.helpLabel='バットの長さ（cm）';batLength.dataset.help='84なら84cm、115なら115cmです。選手作成と同じ長さを編集し、バットの表示と届く範囲へ反映します。';
   textNode(batLength.closest('label'),'バットの長さ（cm）');
  }
  const shortcuts=document.querySelector('.comparison-shortcuts');
  if(shortcuts){$('bat-panel').querySelector('h2').after(shortcuts);text($('comparison-jump'),'打球比較へ');text(shortcuts.querySelector('button:last-child'),'バットを拡大');}
  $('live-roster-editor').querySelector(':scope>h3')?.classList.add('maker-redundant-v112');
  const stance=$('batting-setup-v94'),publicLayout=$('live-public-abilities').closest('.maker-public-guide-layout-v85');
  if(stance&&publicLayout){
   const wrapper=disclosure('maker-stance-v112','構え・打席位置',publicLayout.parentElement,publicLayout.nextSibling);
   wrapper.append(stance);stance.querySelector('h3')?.classList.add('maker-redundant-v112');
  }
  for(const [kind,title]of[['player','能力の見方'],['bat','バット軌道の見方'],['pitcher','投球の見方'],['library','保管庫の使い方']]){
   const guide=$('maker-guide-'+kind+'-v85');if(!guide)continue;
   fold(guide,'maker-guide-'+kind+'-v112',title);
   guide.querySelector('h3')?.classList.add('maker-redundant-v112');
   guide.querySelector('.maker-guide-intro-v85')?.classList.add('maker-redundant-v112');
  }
  // A single selector is primary; the quick buttons remain available on demand.
  fold($('fieldlab-player-list'),'maker-field-players-v112','守備位置から選ぶ');
  text($('fieldlab-save-player'),'復元用の保存点を更新');text($('fieldlab-restore-player'),'保存点へ戻す');
  text($('fieldlab-reset-player'),'この選手を初期化');
  const cards=$('pitcher-cards'),actions=$('pitcher-owned-actions-v82');if(cards&&actions)cards.after(actions);
  $('pitcher-selected-label-v82')?.classList.add('maker-redundant-v112');
  $('pitcher-owned-heading-v80')?.classList.add('maker-redundant-v112');
  const pitchList=cards?.closest('.pitcher-lab-box');if(pitchList)text(pitchList.querySelector('h3'),'持ち球');
  textNode(document.querySelector('label[for="live-roster-player"]'),'選手');
  const staticGroups=[
   ['#live-public-editor>p.note:not([id])','player'],
   ['#live-trait-editor>p.note:not([id])','player'],
   ['#pitcher-panel>p.note:not([id]),#pitcher-panel>p.pitcher-hint:not([id])','pitcher'],
   ['#pitcher-tuning-pane .pitcher-lab-box>p.pitcher-hint:not([id])','pitcher'],
   ['#pitcher-tuning-pane .pitcher-lab-box>details>p.note:not([id])','pitcher'],
   ['#pitcher-movement-v92>p.pitcher-hint:not([id])','pitcher'],
   ['#batting-setup-v94>p.note:not([id])','player'],
   ['#player-swing-editor>p.note:not([id])','bat'],
   ['#ball-comparison-editor>p.note:not([id])','bat']
  ];
  const guideNotes=new Map();
  function toGuide(node,kind){
   const guide=$('maker-guide-'+kind+'-v85');if(!guide||!node)return;
   const key=kind+':'+(node.id||node.textContent),prior=guideNotes.get(key);
   if(prior&&prior!==node)prior.remove();guideNotes.set(key,node);
   if(!guide.contains(node))guide.append(node);
  }
  const gradeNote=document.createElement('p');gradeNote.className='note';gradeNote.id='maker-rank-note-v112';
  gradeNote.textContent=document.querySelector('.public-grade[data-help]')?.dataset.help??'';toGuide(gradeNote,'player');
  toGuide(document.querySelector('.bottom-note'),'bat');
  const course=$('course-panel-v79'),courseGuide=course?disclosure('maker-course-guide-v112','コース・方向の見方',course):null;
  if(courseGuide)for(const node of course.querySelectorAll(':scope>p.course-note-v79:not([id]),.course-box-v79>p.course-note-v79:not([id])'))courseGuide.append(node);
  const legacyCourse=$('course-source-diff-v87')?.parentElement;if(legacyCourse&&$('course-origin-v79'))legacyCourse.append($('course-origin-v79'));
  function revealInvalid(input){for(let node=input.parentElement;node;node=node.parentElement)if(node.tagName==='DETAILS'&&!node.open)node.open=true;}
  document.addEventListener('invalid',event=>revealInvalid(event.target),true);
  function refresh(){
   for(const id of['live-roster-identity','live-roster-note','live-public-authoring-note'])toGuide($(id),'player');
   for(const id of['swing-method-note','swing-source-note','swing-angle-note'])toGuide($(id),'bat');
   for(const [id,label]of[['swing-player-select','選手'],['swing-search','フォーム検索'],['swing-form-class','フォーム分類'],['swing-clip','使用フォーム'],['swing-method','角度の変え方'],['swing-grade','弾道']])textNode($(id)?.closest('label'),label);
   text($('swing-enabled-text'),'角度を調整');
   for(const [selector,kind]of staticGroups)for(const node of document.querySelectorAll(selector))toGuide(node,kind);
   for(const card of document.querySelectorAll('#pitcher-cards .pitcher-card')){
    const name=card.querySelector('strong')?.textContent,small=card.querySelector('small');
    if(name&&small?.textContent.startsWith(name+' · '))text(small,small.textContent.slice(name.length+3));
   }
   const movement=$('pitcher-movement-v92');if(movement){
    const heading=movement.querySelector('h4');if(heading?.textContent.endsWith('の変化量'))text(heading,heading.textContent.slice(0,-4));
    const value=$('pitcher-movement-value-v92');if(value?.textContent.startsWith('変化量 '))text(value,value.textContent.slice(4));
   }
   const courseDetail=$('course-zone-detail-v87');if(courseDetail)courseDetail.classList.toggle('maker-redundant-v112',/^区画\d+$/.test(courseDetail.textContent));
   const fieldMeta=$('fieldlab-player-meta'),metaParts=fieldMeta?.textContent.split(' / ');if(metaParts?.length>=3)text(fieldMeta,metaParts.slice(1).join(' / '));
   for(const input of document.querySelectorAll('[aria-invalid=true]')){
    if(input.disabled)continue;
    revealInvalid(input);
   }
  }
  let queued=false;const observer=new MutationObserver(()=>{
   if(queued)return;queued=true;root.queueMicrotask(()=>{queued=false;refresh();});
  });
  // Playback updates clocks/metrics every frame. Observe only structural editor
  // replacement and error attributes, never the full subtree's text updates.
  for(const node of[$('live-public-abilities'),$('live-trait-editor'),cards,$('course-zone-detail-v87'),$('fieldlab-player-meta'),$('pitcher-movement-value-v92'),$('pitcher-movement-v92')?.querySelector('h4')]){
   if(node)observer.observe(node,{childList:true});
  }
  observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['aria-invalid']});
  refresh();
  root.KneekuraMakerLayoutV112=Object.freeze({version:112,refresh,inspect:()=>({version:112,readOnly:true,disclosures:[...disclosures.keys()]})});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(globalThis);
