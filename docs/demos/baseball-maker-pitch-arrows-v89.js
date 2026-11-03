/* Read-only card icons. Saved world-space spin already includes authored handedness. */
(function(root){
 'use strict';
 const core=root.KneekuraBaseballWorkbench,api=root.KneekuraPitcherMakerV78,menu=root.KneekuraPitchMenuV80,
  owned=document.getElementById('pitcher-cards'),candidates=document.getElementById('pitcher-candidate-list-v80');
 if(!core||!api||!menu||!owned||!candidates)throw Error('球種の矢印には投手調整室と球種一覧が必要です。');
 let queued=false,updates=0;
 function describe(spin){
  const controls=core.pitchSpinToControlsV77(spin),magnitude=Math.hypot(spin.x,spin.y,spin.z),
   directional=Math.hypot(spin.x,spin.y)>Math.max(1,magnitude)*1e-12,
   degrees=controls.breakDirectionDegrees,
   direction=['上','右上','右','右下','下','左下','左','左上'][Math.round(degrees/45)%8];
  return {directional,degrees,label:directional?'回転による曲がりの目安：捕手から見て'+direction+'（'+degrees.toFixed(1)+'°）':'基準の進行方向に対して、上下左右へ曲げる回転成分なし',
   detail:directional?'上向きは落ちにくくする力です。実際の軌道には重力・初速度・縫い目も影響します。矢印の大きさは変化量を表しません。':'無回転・ジャイロ成分のみの目印です。斜めに進む実球や縫い目の効果は、試投で確認してください。'};
 }
 function draw(svg,spin){
  const d=describe(spin),ns='http://www.w3.org/2000/svg',node=(tag,attrs)=>{const el=document.createElementNS(ns,tag);for(const[key,value]of Object.entries(attrs))el.setAttribute(key,String(value));return el;},
   title=node('title',{}),background=node('circle',{cx:19,cy:19,r:17});
  title.textContent=d.label+'。'+d.detail;
  svg.removeAttribute('aria-hidden');svg.setAttribute('role','img');svg.setAttribute('aria-label',d.label);
  svg.dataset.pitchArrowV89=d.directional?'directional':'neutral';svg.dataset.directionDegrees=String(d.degrees);
  // Fixed size communicates direction only; near-gyro axes must not create malformed tiny arrows.
  const mark=d.directional?node('path',{d:'M17.5 29H20.5V15H25L19 7L13 15H17.5Z',transform:'rotate('+d.degrees+' 19 19)',fill:'#286644',stroke:'none'}):
   node('circle',{cx:19,cy:19,r:5,style:'fill:none;stroke:#286644;stroke-width:2;stroke-dasharray:2 2'});
  svg.replaceChildren(title,background,mark);updates++;
 }
 function refresh(){
  // Observe list replacement only. No per-frame work or extra physics trials.
  if(![owned,candidates].some(list=>list.querySelector('svg:not([data-pitch-arrow-v89])')))return;
  const id=api.inspect().pitcherId,players=core.applyLivePhysicalRosterV1({players:root.KneekuraLiveGameRosterCatalog.players,roster:api.getRoster()}).players,
   player=players.find(p=>p.playerId===id),rows=core.resolvePitcherRepertoireV78(player.physical),byId=new Map(rows.map(row=>[row.pitchId,row]));
  for(const card of owned.querySelectorAll('[data-pitch-id]')){const svg=card.querySelector('svg:not([data-pitch-arrow-v89])');if(svg)draw(svg,byId.get(card.dataset.pitchId).spinRadPerSecond);}
  const presets=new Map(menu.inspect().candidates.map(row=>[row.presetId,row]));
  for(const card of candidates.querySelectorAll('[data-preset-id]')){const svg=card.querySelector('svg:not([data-pitch-arrow-v89])');if(svg)draw(svg,presets.get(card.dataset.presetId).spinRadPerSecond);}
 }
 const observer=new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;refresh();});});
 observer.observe(owned,{childList:true});observer.observe(candidates,{childList:true});
 const hint=owned.parentElement.querySelector('.pitcher-hint');
 if(hint)hint.textContent='矢印は捕手から見た、回転による曲がりの向きの目安です。上向きは「落ちにくい」を表します。点線の輪は上下左右へ曲げる回転成分がない印です。実際の軌道は試投で確認できます。';
 root.KneekuraPitchArrowsV89=Object.freeze({version:89,describe,refresh,inspect:()=>({version:89,updates,basis:'CATCHER_VIEW_REFERENCE_FORWARD_MAGNUS_DIRECTION_NOT_TOTAL_TRAJECTORY'})});
 refresh();
})(globalThis);
