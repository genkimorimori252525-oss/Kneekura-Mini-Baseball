// Inserted in the field-workbench closure: uses its shared roster/undo/commit.
 let relationPeerV99=null;
 function syncRelationshipsV99(){
  let box=$('relationships');if(!box){box=document.createElement('details');box.dataset.fieldId='relationships';box.id='fieldlab-relationships';
   const title=document.createElement('summary');title.textContent='相手への信頼・守備連携';box.append(title);$('player-panel').append(box);}
  const opened=box.open;while(box.children.length>1)box.lastChild.remove();box.open=opened;
  const note=document.createElement('p');note.className='muted';note.textContent='選択選手 → 受け手の方向付き設定です。信頼は先に投げて任せる判断、連携は合図への対応に使います。未設定は標準50。仲の良さや肩力とは別です。';box.append(note);
  const peers=s.roster.entries.filter(e=>e.playerId!==s.selectedPlayerId&&e.playerId.split('-')[0]===s.selectedPlayerId.split('-')[0]),select=document.createElement('select');
  select.id='fieldlab-relation-peer';select.setAttribute('aria-label','送球を任せる相手');
  if(!peers.some(e=>e.playerId===relationPeerV99))relationPeerV99=peers[0]?.playerId;
  for(const e of peers)select.add(new Option(data.players[e.playerId]?.name??e.playerId,e.playerId));select.value=relationPeerV99??'';
  select.onchange=()=>{if(errors.has('relation-trust')||errors.has('relation-coordination')){select.value=relationPeerV99;message('信頼・連携の入力を範囲内に戻してから相手を切り替えてください。');return;}relationPeerV99=select.value;syncRelationshipsV99();};box.append(select);
  const relation=selectedEntry().physical?.fieldRelationshipsV99?.find(r=>r.toPlayerId===relationPeerV99),status=document.createElement('p');status.className='muted';status.textContent=relation?'この相手への設定あり':'未設定（標準）。選手の実測関係ではありません。';box.append(status);
  const fields=document.createElement('div');fields.className='fields';box.append(fields);
  for(const [key,label,help]of [['trust','相手へ任せる信頼','高いほど、受け手が到着する見込みの際どい先行送球にも挑戦しやすくなります。到達不能の球や捕球失敗を成功にはしません。'],['coordination','守備の連携','合図や送球意図を共有するタイミングです。捕球・走力・肩力の基礎値を増やしません。']])
   field(fields,'relation-'+key,label,relation?.[key]??50,0,100,1,help,n=>change(()=>{const e=selectedEntry(),old=e.physical?.fieldRelationshipsV99??[],existing=old.find(r=>r.toPlayerId===relationPeerV99)??{toPlayerId:relationPeerV99,trust:50,coordination:50};e.physical={...e.physical,fieldRelationshipsV99:[...old.filter(r=>r.toPlayerId!==relationPeerV99),{...existing,[key]:n}]};status.textContent='この相手への設定あり';reset.disabled=false;},{key:'relation-'+key}));
  const reset=document.createElement('button');reset.textContent='この相手の設定を解除';reset.disabled=!relation;reset.onclick=()=>change(()=>{const e=selectedEntry();e.physical={...e.physical,fieldRelationshipsV99:(e.physical?.fieldRelationshipsV99??[]).filter(r=>r.toPlayerId!==relationPeerV99)};},{rebuild:true,key:'relation-trust'});box.append(reset);
 }
