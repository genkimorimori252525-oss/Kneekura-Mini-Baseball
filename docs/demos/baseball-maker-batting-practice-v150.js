/* Continuous practice owns one ordinary Host continuation in a real Worker. */
(function(root){
 'use strict';
 const $=id=>document.getElementById(id),core=root.KneekuraBaseballWorkbench,maker=root.baseballMaker,
  library=root.KneekuraReferenceBatMotions,catalog=root.KneekuraLiveGameRosterCatalog,
  codec=root.KneekuraBattingPracticeCodecV150,build=root.KneekuraBattingPracticeBuildV150;
 if(!core?.createLiveBattingPracticeV150||!core.AUTHORED_LIVE_BATTER_OBSERVATION_V151||!core.AUTHORED_MATCH_RANDOMNESS_V152||!maker||!codec||!build)return;
 const panel=document.createElement('section');panel.id='batting-practice-editor';panel.className='swing-editor ball-comparison-editor';
 panel.innerHTML=`<h3>カウントを引き継いで打撃練習</h3>
  <p class="note">選択中の打者を先頭にした練習用の打順で始め、現在の選手設定の弾道を使います。一球ごとにカウントと打順を引き継ぎます。投球は投手に任せるため、上の球種・コース指定は単球比較だけに使います。</p>
  <div class="comparison-settings"><label>次の一球の打ち方<select id="practice-batting"><option value="auto">打者に任せる</option><option value="take">見送る</option><option value="balanced">バランス</option><option value="contact">ミート</option><option value="power">強振</option></select></label></div>
  <p class="note">方向は上の「打つ方向の指示」を一球ごとに使います。練習開始後の選手・投手・能力・ばらつき番号の変更は、新しい練習に反映します。打席が終わると練習用打順の次の打者へ進みます。</p>
  <div class="swing-toolbar"><button id="practice-start" type="button">選んだ打者から新しく開始</button><button id="practice-next" type="button" class="primary" disabled>次の一球を進める</button><button id="practice-export" type="button" disabled>練習をJSON保存</button><button id="practice-import" type="button">保存した練習を再開</button><input id="practice-file" type="file" accept="application/json,.json" hidden></div>
  <p id="practice-status" class="note" role="status">新しく開始すると、現在の設定を練習用に固定します。</p><p id="practice-count" class="note"></p><p id="practice-context" class="note"></p>
  <div class="comparison-table-wrap"><table id="practice-results"><thead><tr><th>球</th><th>打者</th><th>結果</th><th>前→後のカウント</th><th>方向の指示</th></tr></thead><tbody></tbody></table></div>`;
 $('ball-comparison-editor').after(panel);
 const directionNames={AUTO:'おまかせ',PULL:'引っ張る',CENTER:'中央',OPPOSITE:'流す'},
  resultNames={ball:'ボール',called_strike:'見逃しストライク',swinging_strike:'空振り',strikeout:'三振',walk:'四球',
   foul:'ファウル',hit_by_pitch:'死球',single:'単打',double:'二塁打',triple:'三塁打',home_run:'本塁打',ground_out:'ゴロアウト',fly_out:'フライアウト',
   foul_out:'ファウルフライアウト',ground_rule_double:'二塁の安全進塁権',field_out:'アウト',in_play:'インプレー',live_ball:'インプレー',count:'カウント継続',unsupported:'継続の判定待ち'};
 let worker=null,sequence=0,state=null,context=null,signature=null,busy=false,stale=false,rows=[],matchData=null,practiceConfiguration=null;
 const clone=value=>root.structuredClone(value);
 function currentSignature(){return JSON.stringify({batterId:$('live-roster-player').value,pitcherId:$('comparison-pitcher').value,
  seed:$('comparison-seed').value,directionSeed:$('comparison-direction-seed').value,executionSeed:$('comparison-execution-seed').value,roster:maker.getLiveRoster()});}
 function configuration(){
  const pendingValue=[...$('live-roster-editor').querySelectorAll('input,select')].find(control=>control.validity.customError);
  if(pendingValue)throw Error('選手の能力に未確定の入力があります。エラーを修正してから開始してください。');
  if(!matchData){const source=new DOMParser().parseFromString(root.KneekuraMakerMatchHtmlV70,'text/html');
   matchData=JSON.parse(source.getElementById('match-data').textContent);}
  const batterId=$('live-roster-player').value,pitcherId=$('comparison-pitcher').value,seed=Number($('comparison-seed').value),
   roles=['P','C','1B','2B','3B','SS','LF','CF','RF'],teams=[0,1].map(team=>({id:matchData.teams[team],name:matchData.teamNames[team],
    battingOrder:Array.from({length:9},(_,i)=>team+'-b'+i),pitcherId:team+'-p0',
    defense:Object.fromEntries(roles.map(role=>[role,role==='P'?team+'-p0':team+'-b'+matchData.defenseMap[team][role]]))})),
   attacking=teams.findIndex(team=>team.battingOrder.includes(batterId)),defending=teams.findIndex(team=>team.pitcherId===pitcherId);
  if(!Number.isSafeInteger(seed)||seed<0||seed>4294967295)throw Error('ばらつき番号は0〜4294967295の整数にしてください。');
  if(attacking<0)throw Error('連続練習は打順に登録された打者を選んでください。この選手の単球比較は引き続き使えます。');
  if(defending<0||attacking===defending)throw Error('連続練習には相手チームの投手を選んでください。');
  const battingOrder=teams[attacking].battingOrder,index=battingOrder.indexOf(batterId),
   practiceTeams=[{...teams[attacking],battingOrder:[...battingOrder.slice(index),...battingOrder.slice(0,index)]},teams[defending]],
   roster=maker.getLiveRoster(),players=core.applyLivePhysicalRosterV1({players:catalog.players,roster}).players,
   measuredClips=library.clips.map(clip=>({id:clip.id,side:clip.side,source:{sha256:clip.source.sha256,repository:clip.source.repository},
    contactTimeSeconds:clip.contactTimeSeconds,normalization:clone(clip.normalization),
    frames:clip.frames.map(frame=>({tick:frame.tick,grip:clone(frame.grip),orientation:clone(frame.orientation)})),defaultSelection:clip.defaultSelection}));
  return {configuration:{seed,innings:9,teams:practiceTeams,players,measuredClips,park:{fenceRadiusMeters:110,fenceHeightMeters:3},
    batterObservationV151:clone(core.AUTHORED_LIVE_BATTER_OBSERVATION_V151),batterDirectionMotorV153:clone(core.AUTHORED_OBSERVED_DIRECTION_MOTOR_V153),randomnessV152:root.KneekuraBallComparison.getRandomnessV152('MATCH'),
    ...(root.KneekuraObservedRegionEnabledV222===true?{batterObservedRegionExperienceV222:clone(core.AUTHORED_BATTER_OBSERVED_REGION_EXPERIENCE_V222)}:{})},
   context:{startingBatterId:batterId,pitcherId,teamNames:practiceTeams.map(team=>team.name),fromSavedPractice:false}};
 }
 function closeWorker(client=worker){
  if(!client)return;client.native.terminate();URL.revokeObjectURL(client.url);
  for(const item of client.pending.values())item.reject(Error('練習を切り替えました。'));client.pending.clear();
  if(client===worker){worker=null;state=null;context=null;signature=null;stale=false;rows=[];practiceConfiguration=null;}
 }
 function openWorker(){
  const scripts=[...document.scripts].filter(script=>script.textContent.includes('var Knee'+'kuraBaseballWorkbench =')&&script.textContent.includes('__toCommonJS'));
  if(scripts.length!==1)throw Error('連続練習用のCoreを特定できません。');
  const source=scripts[0].textContent+'\nconst stringifyPractice='+codec.stringify.toString()+';let practice;\n'+
   'function summary(){const s=practice.inspect();return {match:s.match,pitchCount:s.pitchCount,batterPlayerId:s.batterPlayerId,pitcherPlayerId:s.pitcherPlayerId,finished:s.finished,seed:s.configuration.seed,randomness:s.configuration.randomnessV152??null,'+
   'knowledgeConnected:s.batterKnowledgeV122!==undefined,knownEvidenceCount:(s.batterKnowledgeV122?.beliefs??[]).reduce((n,b)=>n+b.evidenceRefs.length,0),'+
   'observedMemoryConnected:s.batterObservedMemoryV151!==undefined,observedEvidenceCount:(s.batterObservedMemoryV151?.memories??[]).find(m=>m.observerPlayerId===s.batterPlayerId&&m.pitcherId===s.pitcherPlayerId)?.totalObservations??0,'+
   'workloadConnected:s.workloadV122!==undefined,spinMotorPracticeV239:practice.capture().spinMotorPracticeV239??null};}\n'+
   'self.onmessage=async event=>{const {id,kind,value}=event.data;try{let result;if(kind==="start"){practice=value.capture?.spinMotorPracticeV239?await KneekuraBaseballWorkbench.resumeLiveBattingPracticeSpinV239(value.configuration,value.capture):KneekuraBaseballWorkbench.createLiveBattingPracticeV150(value.configuration,value.capture);result=summary();}'+
   'else if(kind==="pitch"){const record=practice.issuePitch(value);result={state:summary(),record};}'+
   'else if(kind==="spin-start"){await practice.startSpinMotorPractice(value);result={state:summary()};}'+
   'else if(kind==="spin-next"){const candidate=await practice.previewSpinMotorPractice();const record=await practice.acceptSpinMotorPractice(candidate);result={state:summary(),record,entry:candidate.entry};}'+
   'else if(kind==="spin-close"){practice.closeSpinMotorPractice();result={state:summary()};}'+
   'else if(kind==="export"){result=stringifyPractice({version:"maker_batting_practice_v150",authority:"LOCAL_DEBUG_ARTIFACT_NOT_NATIVE",build:value.build,context:value.context,rows:value.rows,capture:practice.capture()});}'+
   'else throw Error("unknown practice request");self.postMessage({id,result});}catch(error){self.postMessage({id,error:String(error.message??error)});}};';
  const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'})),client={url,native:new Worker(url),pending:new Map()};
  client.native.onmessage=event=>{const {id,result,error}=event.data,item=client.pending.get(id);if(!item)return;client.pending.delete(id);if(error)item.reject(Error(error));else item.resolve(result);};
  client.native.onerror=event=>{for(const item of client.pending.values())item.reject(Error(event.message||'練習の計算が停止しました。'));client.pending.clear();};
  return client;
 }
 function send(kind,value,client=worker){return new Promise((resolve,reject)=>{const id=++sequence;client.pending.set(id,{resolve,reject});client.native.postMessage({id,kind,value});});}
 async function replaceSession(value){
  const candidate=openWorker();let nextState;
  try{nextState=await send('start',value,candidate);}catch(error){closeWorker(candidate);throw error;}
  const prior=worker;worker=candidate;closeWorker(prior);state=nextState;
 }
 function playerName(id){return catalog.players.find(player=>player.playerId===id)?.name??id;}
 const count=match=>match.balls+'B '+match.strikes+'S '+match.outs+'O';
 function render(){
  $('practice-start').disabled=busy;$('practice-import').disabled=busy;
  $('practice-next').disabled=busy||!state||stale||state.finished||state.spinMotorPracticeV239?.phase==='ACTIVE';$('practice-export').disabled=busy||!state;
  if(!state){$('practice-count').textContent='';$('practice-context').textContent='';$('practice-results').tBodies[0].replaceChildren();return;}
  $('practice-count').textContent=state.match.inning+'回'+(state.match.half==='top'?'表':'裏')+' ／ '+count(state.match)+' ／ '+state.pitchCount+'球 ／ 次の打者 '+playerName(state.batterPlayerId)+' ／ 投手 '+playerName(state.pitcherPlayerId);
  $('practice-context').textContent=(context.fromSavedPractice?'保存時の選手・ばらつき条件で再開。現在のメーカー設定は変更していません。':'開始時の選手設定を使用。')+
   ' 投球は投手におまかせ。'+(state.observedMemoryConnected?'この打者の軌道経験 '+state.observedEvidenceCount+'件（球種は未分類）。':state.knowledgeConnected?'明示された本人知識（証拠 '+state.knownEvidenceCount+'件）。':'前球からの知識学習は未接続。')+
   (state.workloadConnected?'投球負荷を接続。':'疲労更新は未接続。')+' 練習の基準番号 '+state.seed+
   (state.randomness?.overrides?.batterDirection===undefined?'':' ／ 方向 '+state.randomness.overrides.batterDirection)+
   (state.randomness?.overrides?.batterExecution===undefined?'':' ／ 打撃のずれ '+state.randomness.overrides.batterExecution)+'。';
  const body=$('practice-results').tBodies[0];body.replaceChildren();
  for(const row of rows){const tr=body.insertRow(),classification=row.classification==='count'?(row.call??row.classification):row.classification;
   for(const text of [row.pitchCount,playerName(row.batterPlayerId),resultNames[classification]??classification,row.beforeCount+' → '+row.afterCount,directionNames[row.direction]??row.direction])tr.insertCell().textContent=text;}
 }
 async function act(action){if(busy)return;busy=true;render();try{return await action();}catch(error){$('practice-status').textContent=String(error.message??error);throw error;}finally{busy=false;render();}}
 async function start(){return act(async()=>{
  const startingSignature=currentSignature(),setup=configuration();await replaceSession({configuration:setup.configuration});practiceConfiguration=setup.configuration;context=setup.context;
  signature=startingSignature;stale=currentSignature()!==signature;rows=[];
  root.dispatchEvent(new CustomEvent('maker-practice-start-v240',{detail:{configuration:clone(practiceConfiguration),build:clone(build)}}));
  $('practice-status').textContent=stale?'開始中に設定が変わりました。新しい練習を開始してください。':'開始しました。「次の一球を進める」で投球します。';return clone(state);
 });}
 async function next(){return act(async()=>{
  if(!state)throw Error('先に練習を開始してください。');
  if(currentSignature()!==signature){stale=true;throw Error('選手・投手・能力・ばらつき番号が変わりました。新しい練習を開始してください。');}
  $('practice-status').textContent='次の一球を計算しています。画面の再生時間を待たずに進めます。';
  const trial=$('comparison-spin-technique')?.value?(()=>{const batter=practiceConfiguration.players.find(p=>p.playerId===state.batterPlayerId);
   if(!batter)throw Error('現在の打者が練習の選手設定に見つかりません。');const physical=core.resolveLiveMatchPlayerPhysicalV98(batter);
   return root.KneekuraBallComparison.getObservedSpinTrial(batter.playerId,physical,batter.bats,batter.heightMeters,practiceConfiguration.measuredClips)})():null,
   mode=$('comparison-direction').value,request={batting:$('practice-batting').value,
   battingDirectionRequestV149:{version:'batting_direction_request_v149',sourceId:'maker-continuous-practice-v150',mode},...(trial?{observedSpinTrialV236:trial}:{})},answer=await send('pitch',request),record=answer.record;
  adopt(answer,request,mode,trial);
  stale=currentSignature()!==signature;
  $('practice-status').textContent=stale?'計算中に設定が変わりました。新しい練習を開始してください。':state.finished?'練習試合が終了しました。':record.play.rules.batterAdvanced?'打席が終了し、次の打者へ進みました。':'カウントを引き継ぎました。';
  return {state:clone(state),record};
 });}
 function adopt(answer,request,mode,trial){
  const record=answer.record;state=answer.state;rows.push({pitchCount:state.pitchCount,batterPlayerId:record.batterPlayerId,pitcherPlayerId:record.pitcherPlayerId,
   classification:record.play.classification,call:record.play.call,beforeCount:count(record.beforeMatch),afterCount:count(record.match),direction:mode,batting:request.batting,
   battingDirectionV149:clone(record.play.diagnostics.battingDirectionV149),...(trial?{observedSpinTrialV236:clone(trial)}:{}),batterAdvanced:record.play.rules.batterAdvanced});
  root.dispatchEvent(new CustomEvent('maker-practice-accepted-v240',{detail:{record:clone(record),pitchOrdinal:state.pitchCount}}));
 }
 async function startSpinMotor(technique){return act(async()=>{
  if(!state||stale||state.finished||currentSignature()!==signature)throw Error('有効な連続練習を先に開始してください。');
  const deltas={BACKSPIN:{x:0,y:.01},TOPSPIN:{x:0,y:-.01},SLICE:{x:.01,y:0},HOOK:{x:-.01,y:0}};
  if(!Object.hasOwn(deltas,technique))throw Error('診断する技術を選んでください。');
  const batter=practiceConfiguration.players.find(p=>p.playerId===state.batterPlayerId);if(!batter)throw Error('現在の打者が見つかりません。');
  const physical=core.resolveLiveMatchPlayerPhysicalV98(batter),clip=practiceConfiguration.measuredClips.find(c=>c.id===physical.clipId&&c.side===batter.bats);
  if(!clip)throw Error('現在の打者に左右一致の保存された打ち方がありません。');
  const setup=core.resolveLiveBattingSetupV94({...physical,heightMeters:batter.heightMeters,bats:batter.bats}),scopeId=crypto.randomUUID(),mode=$('comparison-direction').value;
  const plan={version:'live_spin_practice_plan_v239',scopeId,pitchOrdinals:[state.pitchCount+1,state.pitchCount+2],motor:{version:'live_spin_xy_motor_v239',motorId:'diagnostic-'+scopeId,motorVersion:'fixed-probe-v1',subjectId:batter.playerId,technique,clip:{id:clip.id,sourceSha256:clip.source.sha256,bats:batter.bats},domain:{plateZ:setup.contactPlaneZ,coordinateSystem:'LIVE_WORLD_METERS_V1'},delta:deltas[technique],provenance:{kind:'EXPLICIT_DIAGNOSTIC_UNCALIBRATED',sourceId:'project-fixed-xy-probe',sourceVersion:'v238',humanCalibration:'NOT_MEASURED'},trainingOpportunities:[]},
   criterion:{version:'live_spin_practice_criterion_v239',authority:'EXPLICIT_UNCALIBRATED_PROJECT',minimumIndependentTrials:2,minimumContactFraction:1,minimumSuccessFraction:1,minimumDirectionalSpin:1,minimumDirectionalImprovement:1,miss:'COUNT_FAILURE',noTarget:'COUNT_FAILURE',unresolved:'HOLD'},
   normalRequest:{batting:$('practice-batting').value,battingDirectionRequestV149:{version:'batting_direction_request_v149',sourceId:'maker-continuous-practice-v150',mode}}};
  const answer=await send('spin-start',plan);state=answer.state;return clone(state.spinMotorPracticeV239);
 });}
 async function nextSpinMotor(){return act(async()=>{
  if(!state||currentSignature()!==signature)throw Error('練習条件が変更されました。診断を終了してください。');
  const spin=state.spinMotorPracticeV239;if(spin?.phase!=='ACTIVE')throw Error('診断は進行中ではありません。');
  const answer=await send('spin-next'),request=spin.plan.normalRequest;
  if(answer.record)adopt(answer,request,request.battingDirectionRequestV149.mode,null);else state=answer.state;
  return {state:clone(state),entry:clone(answer.entry),accepted:!!answer.record};
 });}
 async function closeSpinMotor(){return act(async()=>{if(!state)throw Error('練習がありません。');const answer=await send('spin-close');state=answer.state;return clone(state.spinMotorPracticeV239);});}
 async function exportText(){return act(async()=>{
  if(!state)throw Error('保存する練習がありません。');const text=await send('export',{build,context,rows});
  const sidecar=root.KneekuraContactSessionV240?.exportSidecar();if(!sidecar)return text;
  const saved=codec.parse(text);saved.localContactReportV240=sidecar;return codec.stringify(saved);
 });}
 async function restore(text){return act(async()=>{
  const saved=codec.parse(text);
  const compatibility=root.KneekuraObservedRegionCompatibilityV222,
   exact=(a,b)=>JSON.stringify(a)===JSON.stringify(b),
   legacyAllowed=compatibility?.version==='observed_region_compatibility_v222'&&compatibility.uiGateReady===true
    &&exact(build,compatibility.targetBuild)&&exact(saved.build,compatibility.oldBuild)
    &&saved.capture?.configuration&&!Object.hasOwn(saved.capture.configuration,'batterObservedRegionExperienceV222')
    &&saved.capture?.continuation&&!Object.hasOwn(saved.capture.continuation,'batterObservedRegionExperienceV222');
  if(saved.version!=='maker_batting_practice_v150'||saved.authority!=='LOCAL_DEBUG_ARTIFACT_NOT_NATIVE'||!exact(saved.build,build)&&!legacyAllowed)
   throw Error('保存元とCoreが異なります。保存元の候補で再開してください。');
  if(!saved.capture?.configuration||!saved.context||typeof saved.context!=='object'||Array.isArray(saved.context)
   ||typeof saved.context.startingBatterId!=='string'||typeof saved.context.pitcherId!=='string'
   ||!Array.isArray(saved.rows)||saved.rows.length!==saved.capture.continuation?.pitchCount
   ||!saved.rows.every((row,index)=>row&&typeof row==='object'&&!Array.isArray(row)&&row.pitchCount===index+1
    &&['batterPlayerId','pitcherPlayerId','classification','beforeCount','afterCount'].every(key=>typeof row[key]==='string'&&row[key].length>0&&row[key].length<=200)
    &&[undefined,null,'ball','called_strike','swinging_strike'].includes(row.call)
    &&Object.hasOwn(directionNames,row.direction)&&['auto','take','balanced','contact','power'].includes(row.batting)&&typeof row.batterAdvanced==='boolean'))
   throw Error('練習の保存形式を確認してください。');
  const sidecar=saved.localContactReportV240===undefined?null:root.KneekuraContactSessionV240?.validateSidecar(saved.localContactReportV240);
  if(saved.localContactReportV240!==undefined&&!sidecar)throw Error('ローカル打球記録を確認できません。');
  const startingSignature=currentSignature();await replaceSession({configuration:saved.capture.configuration,capture:saved.capture});practiceConfiguration=saved.capture.configuration;
  context={...saved.context,fromSavedPractice:true};rows=saved.rows;signature=startingSignature;stale=currentSignature()!==signature;
  root.dispatchEvent(new CustomEvent('maker-practice-restore-v240',{detail:{configuration:clone(practiceConfiguration),build:clone(build),sidecar}}));
  $('practice-status').textContent=stale?'再開中に設定が変わりました。新しい練習を開始してください。':'保存したカウントと打順から再開しました。';return clone(state);
 });}
 $('practice-start').onclick=()=>start().catch(()=>{});$('practice-next').onclick=()=>next().catch(()=>{});
 $('practice-export').onclick=()=>exportText().then(text=>{const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');
  a.href=url;a.download='にーくら連続打撃練習_v150.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}).catch(()=>{});
 $('practice-import').onclick=()=>$('practice-file').click();$('practice-file').onchange=event=>{const file=event.target.files[0];if(file)file.text().then(restore).catch(()=>{});event.target.value='';};
 function showPanel(){panel.hidden=$('ball-comparison-editor').hidden;}
 new MutationObserver(showPanel).observe($('ball-comparison-editor'),{attributes:true,attributeFilter:['hidden']});showPanel();
 root.addEventListener('pagehide',()=>{closeWorker();render();});
 root.KneekuraBattingPractice=Object.freeze({start,next,startSpinMotor,nextSpinMotor,closeSpinMotor,exportText,restore,inspect:()=>({ready:!!state,busy,stale,state:state&&clone(state),context:context&&clone(context),rows:clone(rows),workerActive:!!worker})});
 render();root.KneekuraMakerHelp?.decorate(panel);
})(globalThis);
