/* Local seasons are consumers of closed physical plays, never match authority. */
(function(root){
 'use strict';
 function create({core,getAuthoredPlayers}){
  const client=root.KneekuraSeasonClientV79.create({core,storageKey:'kneekura.seasons.v79'}),document=root.document;
  let active=null,lastError=null,currentPlayerId=null,recordingEnabled=true;
  const node=(tag,text)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;return element;};
  const panel=node('details');panel.id='season-controls-v79';panel.className='season-match-v79';panel.append(node('summary','シーズン・コース別成績'));
  const style=node('style');style.textContent='.season-match-v79{padding:14px 18px;background:#f7fbf8;color:#244633;border:1px solid #bfd2c5}.season-match-v79 .season-row{display:flex;gap:8px;align-items:end;flex-wrap:wrap;margin:10px 0}.season-match-v79 label{display:flex;flex-direction:column;gap:4px;font-size:12px}.season-match-v79 select,.season-match-v79 input,.season-match-v79 button{font:inherit;max-width:100%;min-height:36px;background:#fff;color:#244633;border:1px solid #aec8b6;border-radius:4px}.season-match-v79 input[type=file]{max-width:260px}.season-match-v79 .season-report{display:grid;grid-template-columns:1fr 1fr;gap:16px}.season-match-v79 .season-status{white-space:pre-line;font-size:12px}.season-match-v79 .error{color:#a12828}@media(max-width:650px){.season-match-v79 .season-report{grid-template-columns:1fr}}';document.head.append(style);
  const explain=node('p','シーズンを選び「新しい試合」から適用します。完走した試合は一度だけ成績帳へ加わります。練習と先天的なコース設定は選手メーカーで編集できます。');panel.append(explain);
  const row=node('div');row.className='season-row';const seasons=node('select');seasons.id='season-select-v79';seasons.setAttribute('aria-label','成績を蓄積するシーズン');
  const name=node('input');name.id='season-name-v79';name.placeholder='新しいシーズン名';name.maxLength=80;name.setAttribute('aria-label','新しいシーズン名');
  const add=node('button','シーズンを作成');add.type='button';add.id='season-create-v79';
  const close=node('button','選択シーズンを締める');close.type='button';close.id='season-close-v79';row.append(seasons,name,add,close);panel.append(row);
  const tools=node('div');tools.className='season-row';
  const exportButton=node('button','成績帳JSONを保存'),save=node('button','この端末へ保存'),restore=node('button','端末から復元'),file=node('input');
  exportButton.type=save.type=restore.type='button';exportButton.id='season-export-v79';save.id='season-save-local-v79';restore.id='season-restore-v79';file.id='season-import-v79';file.type='file';file.accept='.json,application/json';file.setAttribute('aria-label','シーズン成績帳JSONを読み込む');tools.append(exportButton,save,restore,file);panel.append(tools);
  const status=node('p','単独試合ではシーズンへの保存を行いません。');status.id='season-status-v79';status.className='season-status';status.setAttribute('role','status');panel.append(status);
  const playerLabel=node('label','成績を見る選手'),players=node('select');players.id='season-player-v79';playerLabel.append(players);panel.append(playerLabel);
  const report=node('div');report.className='season-report';const course=node('section'),spray=node('section');course.id='season-course-v79';spray.id='season-spray-v79';report.append(course,spray);panel.append(report);
  document.querySelector('details.settings').after(panel);
  const uid=prefix=>prefix+'-'+(root.crypto.randomUUID?.()??Array.from(root.crypto.getRandomValues(new Uint32Array(3))).join('-'));
  function say(text,error=false){status.textContent=text;status.classList.toggle('error',error);lastError=error?text:null;}
  function safe(action){try{return action();}catch(error){say(error.message??String(error),true);return null;}}
  function hasLiveGame(){return active&&(active.seasonId||active.records.length>0)&&(!active.finished||!active.saved);}
  function assertCanReplace(){if(hasLiveGame())throw Error('進行中の試合があります。完走するか、新しい単独試合へ切り替えてから成績帳を読み込んでください。');}
  function render(){
   const state=client.getState(),selected=state.selectedSeasonId;
   seasons.replaceChildren();const empty=node('option','単独試合（シーズン集計なし）');empty.value='';seasons.append(empty);
   for(const season of state.seasons){const option=node('option',season.name+(season.status==='closed'?'（締め済み）':''));option.value=season.seasonId;seasons.append(option);}seasons.value=selected??'';
   const entries=getAuthoredPlayers();players.replaceChildren();for(const p of entries){const option=node('option',p.name);option.value=p.playerId;players.append(option);}
   currentPlayerId=entries.some(p=>p.playerId===currentPlayerId)?currentPlayerId:entries[0]?.playerId;players.value=currentPlayerId??'';
   close.disabled=!selected||state.seasons.find(s=>s.seasonId===selected)?.status==='closed'||hasLiveGame();
   course.replaceChildren();spray.replaceChildren();
   if(selected&&currentPlayerId){const value=core.getLiveSeasonReportV87({store:state,seasonId:selected,playerId:currentPlayerId});
    root.KneekuraCourseChartsV79.renderPublic(course,value);root.KneekuraCourseChartsV79.renderSpray(spray,value.spray);
   }else{course.append(node('p','シーズンを作成・選択すると、中央9区画と周囲4区画の打率を表示します。'));spray.append(node('p','打球方向は実際のフェア打球から集計します。'));}
  }
  client.subscribe(render);seasons.onchange=()=>safe(()=>{client.command({kind:'select',seasonId:seasons.value||null});say('選択は「新しい試合」から適用します。進行中の試合は開始時の設定を維持します。');});
  add.onclick=()=>safe(()=>{const title=name.value.trim();if(!title)throw Error('シーズン名を入力してください。');client.command({kind:'create',seasonId:uid('season'),name:title});name.value='';say('シーズンを作成しました。「新しい試合」で集計を始めます。');});
  close.onclick=()=>safe(()=>{assertCanReplace();const seasonId=client.getState().selectedSeasonId;if(!seasonId)throw Error('シーズンを選択してください。');client.command({kind:'close',seasonId});say('シーズンを締め、試合成績から長期特性を一度だけ更新しました。次のシーズンを作成してください。');});
  exportButton.onclick=()=>safe(()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(client.getState(),null,2)+'\n'],{type:'application/json'})),a=node('a');a.href=url;a.download='にーくらシーズン成績帳.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);say('成績帳JSONを保存しました。');});
  save.onclick=()=>safe(()=>{client.saveLocal();say('現在の成績帳をこの端末へ保存しました。');});restore.onclick=()=>safe(()=>{assertCanReplace();client.restoreLocal();say('端末の成績帳を復元しました。自動復元は行いません。');});
  file.onchange=async()=>{try{assertCanReplace();const selected=file.files[0];if(!selected)return;if(selected.size>256_000_000)throw Error('成績帳は256MB以内にしてください。');replaceState(JSON.parse(await selected.text()));say('成績帳を読み込みました。新しい試合から適用します。');}catch(error){say(error.message??String(error),true);}finally{file.value='';}};
  players.onchange=()=>{currentPlayerId=players.value;safe(render);};
  function prepareGame({players,seed}){
   const state=client.getState(),seasonId=recordingEnabled?state.selectedSeasonId:null,season=state.seasons.find(s=>s.seasonId===seasonId);
   if(seasonId&&season?.status!=='open')throw Error('締め済みのシーズンには試合を追加できません。新しいシーズンまたは単独試合を選んでください。');
   const execution=seasonId?players.map(p=>{
    const physical={...p.physical};
    if(physical.batterCourseProfileV87){physical.batterCourseProfileV87=core.deriveLiveCourseProfileV87({store:state,seasonId,playerId:p.playerId,profile:physical.batterCourseProfileV87});}
    else physical.batterCourseProfileV79=core.deriveLiveCourseProfileV79({store:state,seasonId,playerId:p.playerId,...(physical.batterCourseProfileV79?{profile:physical.batterCourseProfileV79}:{})});
    return {...p,physical};
   }):players;
   return {gameId:uid('game'),seed,seasonId,players:execution,authoredPlayers:root.structuredClone(players)};
  }
  function beginGame(prepared){
   active={...prepared,records:[],finished:false,saved:false,pendingGame:null};say(prepared.seasonId?'開始時のシーズン対応を適用しました。完走すると成績帳へ一度だけ保存します。':'単独試合です。能力JSONのコース設定は適用し、シーズンへは保存しません。');render();
  }
  function acceptPitch(record){
   if(!active)return;active.records.push(core.summarizeLiveIssuedPitchV79(record));active.finished=record.finished;
   if(record.finished)active.pendingGame=core.createLiveGameStatisticsV79({gameId:active.gameId,seed:active.seed,players:active.authoredPlayers,records:active.records,finished:true});
  }
  function commitCompleted(){
   if(!active?.pendingGame||active.saved)return false;
   if(active.seasonId&&recordingEnabled){client.command({kind:'record_game',seasonId:active.seasonId,game:active.pendingGame});say('完走した試合を成績帳へ保存しました。JSONまたは端末保存でバックアップできます。');}
   active.saved=true;return true;
  }
  function playbackEnded(){commitCompleted();}
  function replaceState(raw){assertCanReplace();return client.replaceValidated(raw?.courseSeasons??raw);}
  function suspendRecording(){recordingEnabled=false;return false;}
  render();
  return Object.freeze({prepareGame,beginGame,acceptPitch,playbackEnded,commitCompleted,replaceState,validateState:client.validateState,
   getState:client.getState,exportGame:()=>active?.pendingGame?root.structuredClone(active.pendingGame):null,
   command:command=>{if(['close','practice'].includes(command?.kind))assertCanReplace();return client.command(command);},
   render,suspendRecording,inspect:()=>({version:79,selectedSeasonId:client.getState().selectedSeasonId,recordingEnabled,error:lastError,
    active:active?{gameId:active.gameId,seasonId:active.seasonId,finished:active.finished,saved:active.saved,pitches:active.records.length}:null})});
 }
 root.KneekuraLiveSeasonMatchV79=Object.freeze({version:79,create});
})(globalThis);
