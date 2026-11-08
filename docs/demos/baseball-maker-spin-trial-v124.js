(function(root){
 'use strict';
 const core=root.KneekuraBaseballWorkbench,maker=root.baseballMaker,editor=root.KneekuraSpinControlMakerV123,$=id=>document.getElementById(id);
 if(!core?.simulateSpinControlWorkbenchV124||!editor||!$('spin-control-v123'))return;
 const clone=value=>JSON.parse(JSON.stringify(value)),names={SLICE:'スライス',HOOK:'フック',BACKSPIN:'バックスピン',TOPSPIN:'トップスピン',NO_SPIN_TARGET:'通常'},
  reasons={NONE_REQUESTED:'通常の打ち方',UNMASTERED_TECHNIQUE:'未習得または未確認',NO_SWING:'見送り',BUNT_SEPARATE_MOTOR:'バント',SOURCE_DOMAIN_MISMATCH:'元のスイングが未登録',OUTSIDE_CALIBRATED_COURSE:'適用コースの範囲外',INSUFFICIENT_MOTOR_TIME:'動作時間が不足',APPLIED:'技術を使用'};
 const panel=document.createElement('details');panel.id='spin-trial-v124';
 panel.innerHTML='<summary>この入力で試打</summary><div class="spin-grid-v123"><label>投手<select id="spin-trial-pitcher-v124"></select></label>'+
  '<label>球種<select id="spin-trial-pitch-v124"></select></label><label>コース<select id="spin-trial-course-v124"><option value="zone">中央付近</option><option value="inside">内角</option><option value="outside">外角</option><option value="high">高め</option><option value="low">低め</option></select></label>'+
  '<label>同じ球を再現する番号<input id="spin-trial-seed-v124" type="number" min="0" max="4294967295" step="1" value="3"></label></div>'+
  '<label class="spin-confirm-v123"><input id="spin-trial-swing-v124" type="checkbox">試打では振る</label>'+
  '<button id="spin-trial-run-v124" type="button">試打</button><p id="spin-trial-status-v124" role="status" aria-live="polite"></p>'+
  '<p>未適用の回転入力も反映します。他の項目は確定値を使います。</p><div id="spin-trial-metrics-v124"></div>'+
  '<label class="spin-confirm-v123"><input id="spin-trial-comparison-v124" type="checkbox">通常の打ち方も表示</label><div id="spin-trial-plots-v124"></div>'+
  '<details><summary>試打の記録</summary><textarea id="spin-trial-json-v124" rows="6" readonly aria-label="回転技術の試打記録"></textarea></details>';
 $('spin-status-v123').after(panel);
 const style=document.createElement('style');style.textContent='#spin-trial-v124 input[type=checkbox]{width:auto!important}#spin-trial-plots-v124 canvas{display:block;width:100%;height:auto;border:1px solid #c8dbcf;border-radius:6px;background:#fbfdfb;margin:5px 0 12px}#spin-trial-metrics-v124{overflow-wrap:anywhere}#spin-trial-metrics-v124 dl{display:grid;grid-template-columns:auto 1fr;gap:5px 12px}#spin-trial-metrics-v124 dd{margin:0}';document.head.append(style);
 for(const [view,label]of [['side','横から：奥行きと高さ'],['front','正面：左右と高さ'],['top','上から：左右と奥行き']]){
  const box=document.createElement('div'),title=document.createElement('div'),canvas=document.createElement('canvas');title.textContent=label;
  canvas.id='spin-trial-'+view+'-v124';canvas.width=600;canvas.height=320;canvas.setAttribute('aria-label',label+'のバット先端軌道');box.append(title,canvas);$('spin-trial-plots-v124').append(box);
 }
 const catalog=root.KneekuraLiveGameRosterCatalog,identity=()=>catalog.players.find(p=>p.playerId===$('live-roster-player').value),
  status=(message,error=false)=>{const n=$('spin-trial-status-v124');n.textContent=message;n.classList.toggle('error',error);};
 const pitchers=catalog.players.filter(p=>p.role==='P');
 for(const p of pitchers){const option=document.createElement('option');option.value=p.playerId;option.textContent=p.teamName+' · '+p.name;$('spin-trial-pitcher-v124').append(option);}
 let last=null,lastInput=null,lastBatter=null;
 function players(){return core.applyLivePhysicalRosterV1({players:catalog.players,roster:maker.getLiveRoster()}).players;}
 function pitchOptions(){const pitcher=players().find(p=>p.playerId===$('spin-trial-pitcher-v124').value),p=core.resolveLiveMatchPlayerPhysicalV98(pitcher),select=$('spin-trial-pitch-v124'),previous=select.value;
  select.replaceChildren();const all=document.createElement('option');all.value='auto';all.textContent='自動';select.append(all);
  const pitches=p.pitchRepertoireV78?.pitches??core.resolvePitcherRepertoireV77(p,pitcher.throws??'R');
  for(const pitch of pitches){const option=document.createElement('option');option.value=pitch.pitchId??pitch.pitchType;option.textContent=pitch.name??pitch.pitchType;option.dataset.type=pitch.pitchType;select.append(option);}
  if([...select.options].some(o=>o.value===previous))select.value=previous;
 }
 function refresh(){const b=identity();if(lastBatter!==b.playerId){last=null;lastInput=null;lastBatter=b.playerId;$('spin-trial-metrics-v124').replaceChildren();$('spin-trial-json-v124').value='';status('');
   $('spin-trial-pitcher-v124').value=(pitchers.find(p=>p.teamName!==b.teamName)??pitchers[0]).playerId;}
  pitchOptions();draw();if(last)status('設定が変わりました。再試打してください。');
 }
 function draw(){for(const [view,a,b]of [['side','z','y'],['front','x','y'],['top','x','z']]){
  const canvas=$('spin-trial-'+view+'-v124'),c=canvas.getContext('2d');c.fillStyle='#fbfdfb';c.fillRect(0,0,600,320);if(!last)continue;
  const compare=$('spin-trial-comparison-v124').checked,paths=compare?[last.ordinary,last.requested]:[last.requested],points=paths.flatMap(p=>p.batPath.map(s=>s.tip));if(!points.length)continue;
  const loA=Math.min(...points.map(p=>p[a])),hiA=Math.max(...points.map(p=>p[a])),loB=Math.min(...points.map(p=>p[b])),hiB=Math.max(...points.map(p=>p[b])),
   scale=Math.min(540/Math.max(.1,hiA-loA),260/Math.max(.1,hiB-loB)),cx=(loA+hiA)/2,cy=(loB+hiB)/2;
  c.strokeStyle='#e4ece7';c.lineWidth=1;for(let x=30;x<600;x+=45){c.beginPath();c.moveTo(x,15);c.lineTo(x,305);c.stroke();}
  paths.forEach((p,index)=>{c.beginPath();c.lineWidth=2.5;c.strokeStyle=compare&&index===0?'#8a9b91':'#216c47';p.batPath.forEach((s,i)=>{const x=300+(s.tip[a]-cx)*scale,y=160-(s.tip[b]-cy)*scale;if(i)c.lineTo(x,y);else c.moveTo(x,y);});c.stroke();});
 }}
 function metrics(){const r=last.requested,box=$('spin-trial-metrics-v124');box.replaceChildren();const dl=document.createElement('dl'),add=(label,value)=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;dl.append(dt,dd);};
  add('狙い',names[r.intent?.requestedIntent]??'通常');add('実行',reasons[r.intent?.reason]??'通常の打ち方');add('使った軌道',r.clipId);
  if(r.contact){const v=r.contact.exitVelocity,s=r.spin;add('打球速度',(Math.hypot(v.x,v.y,v.z)*3.6).toFixed(1)+' km/h');
   add('打球角度',(Math.atan2(v.y,Math.hypot(v.x,v.z))*180/Math.PI).toFixed(1)+'°');
   if(s.basisStatus==='DEFINED')for(const [key,label]of [['backspinRadPerSecond','バックスピン'],['topspinRadPerSecond','トップスピン'],['sliceRadPerSecond','スライス'],['hookRadPerSecond','フック']])add(label,(s[key]*60/(2*Math.PI)).toFixed(1)+' rpm');
   else add('回転の分類','鉛直付近のため分類しない');
  }else add('打球','バットとボールの接触なし');
  box.append(dl);
 }
 function run(){const seed=$('spin-trial-seed-v124');if(seed.value.trim()===''||!seed.checkValidity())throw Error('再現番号は0〜4294967295の整数で入力してください。');
  const roster=players(),batter=roster.find(p=>p.playerId===identity().playerId),pitcher=roster.find(p=>p.playerId===$('spin-trial-pitcher-v124').value),
   bp=clone(core.resolveLiveMatchPlayerPhysicalV98(batter)),pp=core.resolveLiveMatchPlayerPhysicalV98(pitcher),draft=editor.inspect();
  if(draft.pending.includes(batter.playerId))bp.spinControlV123=editor.getDraft();
  if($('spin-trial-swing-v124').checked)bp.swingDecision={...(bp.swingDecision??{threshold:.5,aggressionWeight:.5}),approach:'SWING'};
  const option=$('spin-trial-pitch-v124').selectedOptions[0],owned=pp.pitchRepertoireV78?.pitches.find(p=>p.pitchId===option.value),
   bt=core.resolveLiveTechnicalTraitsV75(batter.traitProfile),pt=core.resolveLiveTechnicalTraitsV75(pitcher.traitProfile);
  const input={originTick:1000000,seed:Number(seed.value),batter:{...bp,heightMeters:batter.heightMeters,bats:batter.bats,...(bt?{technicalSkills:bt}:{})},
   pitcher:{...pp,heightMeters:pitcher.heightMeters,moundPosition:core.LIVE_MATCH_MOUND_SURFACE_V1,...(pitcher.throws?{throws:pitcher.throws}:{}),...(pt?{technicalSkills:pt}:{})},
   measuredClips:root.KneekuraReferenceBatMotions.clips,batting:'balanced',pitchType:owned?.pitchType??option.dataset.type??'auto',...(owned?{pitchId:owned.pitchId}:{}),location:$('spin-trial-course-v124').value,physics:core.LIVE_MATCH_PHYSICS_V1};
  const result=core.simulateSpinControlWorkbenchV124(input);last=result;lastInput=clone({batterPlayerId:batter.playerId,pitcherPlayerId:pitcher.playerId,
   originTick:input.originTick,seed:input.seed,batter:input.batter,pitcher:input.pitcher,pitchType:input.pitchType,pitchId:input.pitchId??null,location:input.location,physics:input.physics,
   measuredCatalogRefs:input.measuredClips.map(c=>({id:c.id,side:c.side,sourceSha256:c.source.sha256,defaultSelection:c.defaultSelection??true}))});
  metrics();draw();$('spin-trial-json-v124').value=JSON.stringify({input:lastInput,result},null,2);status('試打しました。保存値や技能認定は変更していません。');return clone(result);
 }
 $('spin-trial-run-v124').onclick=()=>{try{run();}catch(e){status(e.message,true);}};
 $('spin-trial-pitcher-v124').onchange=pitchOptions;$('spin-trial-comparison-v124').onchange=draw;
 $('live-roster-player').addEventListener('change',refresh);document.addEventListener('kneekura:maker-roster-change',refresh);
 $('spin-control-v123').addEventListener('input',event=>{if(!event.target.closest('#spin-trial-v124')&&last)status('入力が変わりました。再試打してください。');});
 $('spin-control-v123').addEventListener('click',event=>{if(event.target.closest('.swing-toolbar')&&last)queueMicrotask(()=>status('設定が変わりました。再試打してください。'));});
 root.KneekuraSpinTrialV124=Object.freeze({run,refresh,inspect:()=>({input:lastInput?clone(lastInput):null,result:last?clone(last):null})});refresh();
})(globalThis);
