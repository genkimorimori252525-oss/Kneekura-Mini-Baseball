/* Preserve authoring view state across existing renderers; import through existing guarded APIs. */
(function(root){
 'use strict';
 const maker=root.baseballMaker,document=root.document,panels=['live-trait-editor','live-public-abilities'].map(id=>document.getElementById(id)),
  remembered=new Map(),owners=new WeakMap(),player=()=>document.getElementById('live-roster-player').value;
 if(!maker||panels.some(panel=>!panel))throw Error('編集欄の復帰には選手メーカーが必要です。');
 function key(details,panel){return player()+':'+panel.id+':'+(details.id||details.dataset.traitSecondary||details.dataset.section);}
 function speedLabel(){
  const input=document.getElementById('public-ability-maxSpeedKmh'),row=input?.closest('.control'),grade=row?.querySelector('.public-grade');
  if(!grade)return;row.dataset.publicSpeedV90='true';
  const match=grade.textContent.match(/^(\d+(?:\.\d+)?) km\/h$/);
  if(match){const text=Number(match[1]).toLocaleString('ja-JP',{maximumFractionDigits:1})+' km/h';if(grade.textContent!==text)grade.textContent=text;}
 }
 function restore(){
  for(const panel of panels)for(const details of panel.querySelectorAll('details')){
   const id=key(details,panel);owners.set(details,id);
   if(remembered.has(id))details.open=remembered.get(id);else remembered.set(id,details.open);
  }
  speedLabel();
 }
 const observer=new MutationObserver(records=>{
  const captured=new Set();
  for(const record of records)for(const removed of record.removedNodes){
   if(removed.nodeType!==1)continue;
   for(const details of [...(removed.matches('details')?[removed]:[]),...removed.querySelectorAll('details')]){
    const id=owners.get(details);if(id&&!captured.has(id)){remembered.set(id,details.open);captured.add(id);}
   }
  }
  restore();
 });
 for(const panel of panels){
  panel.addEventListener('toggle',event=>{const details=event.target,id=owners.get(details);if(id&&details.isConnected)remembered.set(id,details.open);},true);
  observer.observe(panel,{childList:true,subtree:true});
 }
 restore();
 // The top picker accepts both existing packet types without weakening either validator.
 const picker=document.getElementById('import-file'),status=document.createElement('p');
 status.id='maker-file-status-v90';status.className='note';status.setAttribute('role','status');status.hidden=true;
 document.querySelector('header').after(status);document.getElementById('load-json').title='メーカー全体JSONと試合用能力JSONを読み込めます。';
 let generation=0;
 picker.onchange=async()=>{
  const file=picker.files[0],ticket=++generation;if(!file)return;
  try{
   const raw=JSON.parse((await file.text()).replace(/^\uFEFF/,''));if(ticket!==generation)return;
   if(raw?.version==='live_physical_roster_v1')maker.importLiveRoster(raw);else maker.importState(raw);
   document.getElementById('error-status').hidden=true;document.getElementById('error-status').textContent='';
   const detail=document.getElementById('maker-error-details-v82');if(detail)detail.hidden=true;
   root.KneekuraMakerValidationV86?.clearActions();
   status.classList.remove('error');status.textContent=raw?.version==='live_physical_roster_v1'?'試合用能力JSON（'+maker.getLiveRoster().entries.length+'選手）を読み込みました。':'メーカー全体JSONを読み込みました。';
  }catch(error){
   if(ticket!==generation)return;
   const message=root.KneekuraPitcherMakerV78.describeError(error);
   status.classList.add('error');status.textContent='JSONを読み込めませんでした：'+message;
   root.KneekuraMakerValidationV86?.action(message,true);
  }finally{if(ticket===generation){status.hidden=false;picker.value='';}}
 };
 root.KneekuraMakerEditorV90=Object.freeze({version:90,restore,inspect:()=>({version:90,rememberedSections:remembered.size})});
})(globalThis);
