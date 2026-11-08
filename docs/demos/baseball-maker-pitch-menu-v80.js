/* Additive pitch browsing. Existing authoring, snapshots and Core remain owners. */
(function(root){
 'use strict';
 const core=root.KneekuraBaseballWorkbench,maker=root.baseballMaker,api=root.KneekuraPitcherMakerV78,library=root.KneekuraPitchLibraryV78,
  catalog=root.KneekuraLiveGameRosterCatalog,owned=document.getElementById('pitcher-cards');
 if(!api||!library||!owned)throw Error('球種一覧には投手調整室が必要です。');
 const pitchCatalog=core.getLivePitchCatalogV78(),names=Object.fromEntries(pitchCatalog.types.map(type=>[type.pitchType,type.name])),
  groups=[{id:'straight',label:'直球',presets:['fastball']},
   {id:'arm',presets:['sinker','two_seam','shuto','changeup','circle_change','screwball']},
   {id:'glove',presets:['cutter','slider','sweeper','slurve','hard_slider']},
   {id:'down',label:'↓ 落ちる球',presets:['splitter','sff','split_change','forkball','curve','knuckle_curve','slow_curve','vertical_slider','vertical_curve']},
   {id:'special',label:'特殊・小変化',presets:[]}];
 let selected='straight',error=null,queued=false,lastRows=[];
 const element=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;},
  heading=element('h4'),count=element('span'),section=element('section'),tabs=element('div'),list=element('div'),description=element('p'),status=element('p');
 heading.id='pitcher-owned-heading-v80';heading.append(document.createTextNode('この選手の所持球 '),count);owned.before(heading);
 owned.setAttribute('aria-labelledby',heading.id);section.id='pitcher-candidates-v80';section.className='pitcher-menu-v80';section.append(element('h4','球を追加する'));
 const note=element('p','方向から候補を選んで追加できます。同じ種類も別の球として持てます。');note.className='pitcher-hint';section.append(note);
 tabs.className='pitcher-direction-tabs-v80';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','追加する球の方向');section.append(tabs);
 description.id='pitcher-direction-note-v80';description.className='pitcher-hint';description.textContent='分類は球種の傾向です。矢印は回転による力の向きで、実際の軌道は試投で確認できます。';section.append(description);
 list.id='pitcher-candidate-list-v80';list.className='pitcher-candidate-list-v80';list.setAttribute('role','tabpanel');section.append(list);
 status.id='pitcher-menu-status-v80';status.className='pitcher-hint';status.setAttribute('role','status');section.append(status);owned.after(section);
 const legacy=document.getElementById('pitcher-preset').closest('details');legacy.hidden=true;
 function say(message,failed=false){status.textContent=message;status.classList.toggle('error',failed);error=failed?message:null;}
 function groupId(presetId){return groups.find(group=>group.presets.includes(presetId))?.id??'special';}
 function arrow(spin){const c=core.pitchSpinToControlsV77(spin),r=c.breakDirectionDegrees*Math.PI/180,length=12*Math.sqrt(Math.max(0,1-c.gyroFraction*c.gyroFraction)),
  x=19+Math.sin(r)*length,y=19-Math.cos(r)*length,ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 38 38');svg.setAttribute('aria-hidden','true');
  for(const[tag,attributes]of [['circle',{cx:19,cy:19,r:17}],['line',{x1:19,y1:19,x2:x,y2:y}],['circle',{cx:x,cy:y,r:2.3,style:'fill:#286644'}]]){const node=document.createElementNS(ns,tag);for(const[key,value]of Object.entries(attributes))node.setAttribute(key,String(value));svg.append(node);}return svg;
 }
 function selectDirection(id,focus=false){if(!groups.some(group=>group.id===id))throw Error('未対応の球種方向です。');selected=id;render();if(focus)document.getElementById('pitcher-direction-'+id+'-v80').focus();return selected;}
 function render(){
  const focused=document.activeElement,focusedDirection=tabs.contains(focused)?focused.dataset.direction:null,focusedPreset=list.contains(focused)?focused.dataset.addPreset:null;
  const state=api.inspect(),players=core.applyLivePhysicalRosterV1({players:catalog.players,roster:maker.getLiveRoster()}).players,
   player=players.find(p=>p.playerId===state.pitcherId),rows=core.resolvePitcherRepertoireV78(player.physical),left=player.throws==='L';
  count.textContent=rows.length+'球';
  const prepared=pitchCatalog.presets.map(preset=>({preset,row:core.createPitchSnapshotFromPresetV78({presetId:preset.presetId,pitchId:'menu-'+preset.presetId,physical:player.physical,throws:player.throws??'R'}),group:groupId(preset.presetId)}));
  lastRows=prepared;tabs.replaceChildren();
  const menuGroups=left?[groups[0],groups[2],groups[1],groups[3],groups[4]]:groups;
  for(const group of menuGroups){const label=group.id==='arm'?(left?'一塁側 →':'← 三塁側'):group.id==='glove'?(left?'← 三塁側':'一塁側 →'):group.label,
    button=element('button',label+' '+prepared.filter(item=>item.group===group.id).length);button.id='pitcher-direction-'+group.id+'-v80';button.type='button';button.dataset.direction=group.id;button.setAttribute('role','tab');button.setAttribute('aria-selected',String(selected===group.id));button.setAttribute('aria-controls',list.id);button.tabIndex=selected===group.id?0:-1;button.onclick=()=>selectDirection(group.id,true);
   button.onkeydown=event=>{const delta=event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0;if(!delta&&!['Home','End'].includes(event.key))return;event.preventDefault();const index=event.key==='Home'?0:event.key==='End'?menuGroups.length-1:(menuGroups.findIndex(g=>g.id===group.id)+delta+menuGroups.length)%menuGroups.length;selectDirection(menuGroups[index].id,true);};tabs.append(button);
  }
  list.setAttribute('aria-labelledby','pitcher-direction-'+selected+'-v80');list.replaceChildren();
  for(const {preset,row}of prepared.filter(item=>item.group===selected)){
   const card=element('article');card.className='pitcher-card pitcher-candidate-v80';card.dataset.presetId=preset.presetId;card.append(arrow(row.spinRadPerSecond));
   const text=element('span'),name=element('strong',preset.name),detail=element('small',names[row.pitchType]+' · '+(row.releaseSpeedMps*3.6).toFixed(1)+' km/h');text.append(name,detail);card.append(text);
   const add=element('button','＋ 追加');add.type='button';add.dataset.addPreset=preset.presetId;add.setAttribute('aria-label',preset.name+'を所持球に追加');
   add.onclick=()=>{try{maker.assertCanSave();library.addPreset(preset.presetId);say(preset.name+'を追加しました。上の所持球から選んで調整できます。');render();}catch(e){say(e.message??String(e),true);}};card.append(add);list.append(card);
  }
  if(focusedDirection)document.getElementById('pitcher-direction-'+focusedDirection+'-v80')?.focus({preventScroll:true});
  else if(focusedPreset)list.querySelector('[data-add-preset="'+focusedPreset+'"]')?.focus({preventScroll:true});
 }
 owned.addEventListener('click',event=>{if(!event.target.closest('button.pitcher-card'))return;try{maker.assertCanSave();}catch(e){event.preventDefault();event.stopImmediatePropagation();say(e.message??String(e),true);}},true);
 new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;try{render();}catch(e){say(e.message??String(e),true);}});}).observe(owned,{childList:true});
 root.KneekuraPitchMenuV80=Object.freeze({version:80,selectDirection,inspect:()=>({version:80,selectedDirection:selected,error,
  ownedPitchIds:[...owned.querySelectorAll('[data-pitch-id]')].map(card=>card.dataset.pitchId),
  groups:groups.map(group=>({id:group.id,presetIds:lastRows.filter(item=>item.group===group.id).map(item=>item.preset.presetId)})),
  candidates:lastRows.map(item=>({presetId:item.preset.presetId,pitchType:item.row.pitchType,group:item.group,spinRadPerSecond:{...item.row.spinRadPerSecond}}))})});render();
})(globalThis);
