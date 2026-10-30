/* Four physical experiments share one pitch, one player and one measured form. */
(function(root){
 'use strict';
 const $=id=>document.getElementById(id),clone=value=>JSON.parse(JSON.stringify(value)),core=root.KneekuraBaseballWorkbench,
  maker=root.baseballMaker,library=root.KneekuraReferenceBatMotions,catalog=root.KneekuraLiveGameRosterCatalog,
  colors=['#1763a6','#18824d','#b05200','#8937a3'],defaults={level:2,angleDegreesByLevel:[-10,0,10,20],beforeSeconds:.1,afterSeconds:.06};
 if(!core?.compareMeasuredTrajectoriesV69||!maker||!library)return;
 const panel=document.createElement('section');panel.id='ball-comparison-editor';panel.className='swing-editor ball-comparison-editor';
 panel.innerHTML=`<h3>同じ球で、弾道1〜4の打球を比べる</h3>
  <p class="note">上で選んだ選手・打ち方を使います。投球と能力のばらつきも4段階で共通にし、弾道だけを切り替えます。空振りもそのまま結果として表示します。</p>
  <div class="comparison-settings">
   <label>投げる選手<select id="comparison-pitcher" data-help="この選手の球速・回転・制球・利き腕・リリース位置を使います。4段階とも同じ投手で比べます。"></select></label>
   <label>球種<select id="comparison-pitch-type" data-help="4段階とも同じ球種を投げます。投手の能力とこの番号のばらつきで決まった、同じ球を使います。"><option value="fastball">ストレート</option><option value="slider">スライダー</option><option value="curve">カーブ</option><option value="changeup">チェンジアップ</option><option value="cutter">カットボール</option><option value="sinker">シンカー</option><option value="splitter">スプリット</option></select></label>
   <label>狙うコース<select id="comparison-location" data-help="投手が狙うコースです。制球のばらつきは残しますが、4段階とも同じばらつきで同じ球を投げます。"><option value="zone">ストライクゾーン内</option><option value="low">低め</option><option value="high">高め</option><option value="inside">内角</option><option value="outside">外角</option></select></label>
   <label>投球のばらつき番号<input id="comparison-seed" type="number" min="0" max="4294967295" step="1" value="20261019" data-help="同じ番号なら、投球・狙いのずれ・タイミングのずれを再現します。番号を変えると4段階すべての球を一緒に変更します。当たる番号を自動で探すことはしません。"></label>
   <label>打ち方の指示<select id="comparison-batting" data-help="『選手の好み』なら、その選手のミート・強振の好みを使います。選んだ指示を4段階で共通にします。"><option value="auto">選手の好みを使う</option><option value="balanced">バランス</option><option value="contact">ミート</option><option value="power">強振</option></select></label>
   <label>打つ方向の指示<select id="comparison-direction" data-help="『おまかせ』は打者本人の方針と観測に任せます。手動の方向は狙いであり、実際の打球方向を保証しません。選手の保存方針は変更しません。"><option value="AUTO">おまかせ(打者に任せる)</option><option value="PULL">引っ張る</option><option value="CENTER">中央</option><option value="OPPOSITE">流す</option></select></label>
   <label><input id="comparison-force-swing" type="checkbox" checked data-help="比較しやすいように、振るか見送るかの判断だけを『振る』に固定します。能力・タイミングや芯のずれは残すので、空振りも起きます。選手の保存値は変更しません。">比較中は必ず振る</label>
  </div><details id="comparison-spin-trial"><summary>打球回転の明示試行（任意）</summary><p class="note">未校正の一球試行です。回転の成功や習得を保証せず、選手の保存値も変更しません。実行する場合は、この選手に保存した打ち方と数値を明示してください。</p><div class="comparison-settings" style="grid-template-columns:minmax(0,1fr)">
   <label>試行<select id="comparison-spin-technique"><option value="">指定なし</option><option value="BACKSPIN">バックスピン</option><option value="TOPSPIN">トップスピン</option><option value="SLICE">スライス</option><option value="HOOK">フック</option></select></label>
   <label>狙いの横差（m）<input id="comparison-spin-x" type="number" step="any" placeholder="例: 0.01"></label><label>狙いの高さ差（m）<input id="comparison-spin-y" type="number" step="any" placeholder="例: 0.01"></label>
   <label>接触を予測する奥行き（m）<input id="comparison-spin-depth" type="number" step="any" placeholder="実行前に指定"></label></div></details><details id="comparison-random-details"><summary>ばらつきを個別に指定（任意）</summary><div class="swing-toolbar">
   <label>おまかせ方向の抽選番号<input id="comparison-direction-seed" type="number" min="0" max="4294967295" step="1" placeholder="空欄なら共通番号から自動" data-help="本人の方針に方向の抽選がある場合、その抽選だけを変えます。投球・球の予想・振り方・打撃のずれは変えません。手動の方向指定がある場合は指定を優先します。"></label>
   <label>打撃のずれの番号<input id="comparison-execution-seed" type="number" min="0" max="4294967295" step="1" placeholder="空欄なら共通番号から自動" data-help="投球と打者の判断を保ち、タイミング・芯のずれだけを変えて比較します。選手の保存値を変更しません。"></label>
  </div><p class="note">空欄なら共通番号から自動で決まります。連続練習では開始時の基準番号として使い、一球ごとに別のばらつきを作ります。変更後は新しく開始してください。</p></details>
  <div class="swing-toolbar"><button id="comparison-run" class="primary" type="button">同じ球で4段階を計算</button><button id="comparison-next" type="button" data-help="ばらつき番号を1つ進め、4段階とも同じ次の球で計算します。特定の結果になる球を探したり選んだりはしません。">次の球で比べる</button><button id="comparison-export" type="button" disabled>比較条件と結果をJSON保存</button></div>
  <p id="comparison-status" class="note" role="status">「同じ球で4段階を計算」を押してください。</p><p id="comparison-conditions" class="note"></p>
  <div class="comparison-table-wrap"><table id="comparison-results"><thead><tr><th>弾道</th><th>接触の結果</th><th>打球の初速</th><th>打ち出す角度</th><th>回転数</th><th>最初の着地まで</th></tr></thead><tbody></tbody></table></div>
  <div class="swing-toolbar"><button id="comparison-play" type="button" disabled>▶ 再生</button><button id="comparison-impact" type="button" disabled>当たる付近へ</button>
   <label>強調する弾道<select id="comparison-level"><option value="1">1：低め</option><option value="2" selected>2：基準</option><option value="3">3：高め</option><option value="4">4：さらに高め</option></select></label>
   <label>再生の速さ<select id="comparison-speed"><option value="0.1">0.1倍</option><option value="0.25">0.25倍</option><option value="0.5" selected>0.5倍</option><option value="1">1倍</option></select></label>
  </div><label>投球が始まってからの時間 <output id="comparison-time-label">0.000秒</output><input id="comparison-time" type="range" min="0" max="9" step="0.001" value="0" data-help="すべて同じ投球開始時刻で再生します。当たる時刻が違っても、それぞれのインパクトを0秒へずらしてはいません。"></label>
  <div class="swing-toolbar"><label>拡大率 <output id="comparison-zoom-label">1倍</output><input id="comparison-zoom" type="range" min="0.25" max="16" step="0.05" value="1" data-help="図だけを拡大します。4段階は共通の縮尺です。図をドラッグすると表示位置を動かせます。球・バットの物理や結果は変えません。"></label><button id="comparison-fit" type="button">打球全体を表示</button><button id="comparison-impact-focus" type="button" data-help="バットと球が接する付近を大きく表示します。4段階は同じ中心と倍率のまま比べます。">打点を拡大</button></div>
  <div class="comparison-views"><figure><figcaption>横から：高さと伸びを比べる</figcaption><canvas id="comparison-canvas-side" width="960" height="480" aria-label="横から見た4弾道の比較"></canvas></figure><figure><figcaption>上から：飛ぶ方向を比べる</figcaption><canvas id="comparison-canvas-top" width="960" height="480" aria-label="上から見た4弾道の比較"></canvas></figure></div>
  <p class="note">線と球の色は弾道1〜4に対応します。すべて同じ縮尺・時刻で描きます。「最初の着地まで」は打点からの水平距離です。守備・フェンス・公式の安打／本塁打の裁定は、この比較には含みません。回転の向きと接触時刻は結果の説明欄でも確認できます。</p><details><summary>回転の向きと計算の条件</summary><div id="comparison-details" class="note"></div></details>`;
 $('player-swing-editor').after(panel);
 if(root.KneekuraBallComparisonLayoutV74===true){panel.classList.add('ball-comparison-fullwidth');$('maker-layout').append(panel);panel.hidden=$('bat-panel').hidden;}
 const shortcuts=document.createElement('nav');shortcuts.className='comparison-shortcuts';shortcuts.setAttribute('aria-label','比較画面への移動');
 const jump=document.createElement('button');jump.id='comparison-jump';jump.type='button';jump.textContent='弾道ごとの打球比較へ';
 jump.onclick=()=>{$(root.KneekuraPlayerSwingPreviewEnabled===true?'tab-bat':'tab-player').click();panel.scrollIntoView({block:'start'});};
 const batJump=document.createElement('button');batJump.type='button';batJump.textContent='バット画面へ（拡大できます）';
 batJump.onclick=()=>{$('tab-bat').click();$('maker-scene').scrollIntoView({block:'center'});};shortcuts.append(jump,batJump);document.querySelector('header').after(shortcuts);
 let result=null,input=null,context=null,clock=0,playing=false,lastTime=null,maxTime=9,generation=0,signature='',error=null,
  zoom=1,pan={side:{x:0,y:0},top:{x:0,y:0}},geometry=null,drag=null;
 const format=(value,d=1)=>Number.isFinite(value)?value.toFixed(d):'—';
 function identity(){return catalog.players.find(p=>p.playerId===$('live-roster-player').value);}
 function refreshPitchers(){const batter=identity(),select=$('comparison-pitcher'),prior=select.value;select.replaceChildren();
  for(const p of catalog.players.filter(p=>p.role==='P'&&p.playerId!==batter.playerId)){const o=document.createElement('option');o.value=p.playerId;o.textContent=p.teamName+' '+p.name;select.append(o);}
  if([...select.options].some(o=>o.value===prior))select.value=prior;else select.value=catalog.players.find(p=>p.role==='P'&&p.teamName!==batter.teamName)?.playerId??select.options[0]?.value;
 }
 function randomnessFor(scope){
  if(!['PLAY','MATCH'].includes(scope)||typeof core.validateLiveRandomnessV152!=='function')throw Error('ばらつきの用途別指定に対応する最新版を読み込んでください。');
  const policy=clone(scope==='MATCH'?core.AUTHORED_MATCH_RANDOMNESS_V152:core.AUTHORED_PLAY_RANDOMNESS_V152),overrides={};
  for(const [id,key]of [['comparison-direction-seed','batterDirection'],['comparison-execution-seed','batterExecution']]){
   const text=$(id).value;if(text==='')continue;const seed=Number(text);
   if(!Number.isSafeInteger(seed)||seed<0||seed>4294967295)throw Error('個別のばらつき番号は空欄または0〜4294967295の整数にしてください。');
   overrides[key]=seed;
  }
  if(Object.keys(overrides).length)policy.overrides=overrides;return core.validateLiveRandomnessV152(policy,scope);
 }
 function observedSpinTrial(subjectId,physical,bats,heightMeters,clips){
  const technique=$('comparison-spin-technique').value;if(!technique)return null;
  const values=['comparison-spin-x','comparison-spin-y','comparison-spin-depth'].map(id=>$(id).value);
  if(values.some(v=>v===''||!Number.isFinite(Number(v))))throw Error('回転試行の横差・高さ差・接触奥行きをすべて指定してください。');
  const clip=typeof physical.clipId==='string'?clips.find(c=>c.id===physical.clipId&&c.side===bats):null;
  if(!clip)throw Error('回転試行には、現在の打者に保存された左右一致の打ち方を指定してください。');
  const setup=core.resolveLiveBattingSetupV94({...physical,heightMeters,bats});
  return {version:'live_observed_spin_trial_v236',subjectId,technique,clip:{id:clip.id,sourceSha256:clip.source.sha256,bats},
   domain:{plateZ:setup.contactPlaneZ,contactDepthZ:Number(values[2]),coordinateSystem:'LIVE_WORLD_METERS_V1'},delta:{x:Number(values[0]),y:Number(values[1])}};
 }
 function buildInput(){
  if(typeof core.validateBattingDirectionRequestV149!=='function'||!core.AUTHORED_LIVE_BATTER_OBSERVATION_V151)throw Error('方向指定と位置観測の予測に対応する最新版を読み込んでから比較してください。');
  const pending=[...$('live-roster-editor').querySelectorAll('input,select')].find(control=>control.validity.customError);
  if(pending)throw Error('選手の能力に未確定の入力があります。エラーを修正してから比較してください。');
  const roster=maker.getLiveRoster(),batterId=$('live-roster-player').value,pitcherId=$('comparison-pitcher').value,
   players=core.applyLivePhysicalRosterV1({players:catalog.players,roster}).players,batter=players.find(p=>p.playerId===batterId),pitcher=players.find(p=>p.playerId===pitcherId),
   pIdentity=catalog.players.find(p=>p.playerId===pitcherId),catcherId=catalog.players.find(p=>p.teamName===pIdentity?.teamName&&p.role==='C')?.playerId,
   catcher=players.find(p=>p.playerId===catcherId),entry=roster.entries.find(p=>p.playerId===batterId),bp=root.KneekuraIndependentTraitsV77?core.resolveLiveExecutionPhysicalV77(batter.physical,batter.traitProfile):batter.physical,pp=root.KneekuraIndependentTraitsV77?core.resolveLiveExecutionPhysicalV77(pitcher?.physical,pitcher?.traitProfile):pitcher?.physical,cp=root.KneekuraIndependentTraitsV77?core.resolveLiveExecutionPhysicalV77(catcher?.physical,catcher?.traitProfile):catcher?.physical,
   clip=library.clips.find(c=>c.id===bp.clipId)??library.clips.find(c=>c.side===batter.bats&&c.defaultSelection!==false),seed=Number($('comparison-seed').value),directionRequestMode=$('comparison-direction').value;
  if(!pitcher||!catcher||!clip)throw Error('投手・捕手・打ち方の設定を確認してください。');
  if(!Number.isSafeInteger(seed)||seed<0||seed>4294967295)throw Error('ばらつき番号は0〜4294967295の整数にしてください。');
  const pref=core.resolveLiveTraitPreferencesV54(batter.traitProfile),pitchPref=core.resolveLiveTraitPreferencesV54(pitcher.traitProfile),
   batting=$('comparison-batting').value==='auto'?{POWER:'power',CONTACT:'contact',BALANCED:'balanced'}[pref.swingMode]:$('comparison-batting').value,
   b={...bp,clipId:clip.id,heightMeters:batter.heightMeters,bats:batter.bats,impactTrajectory:clone(bp.impactTrajectory??(root.KneekuraWholeArcTrajectoryEnabled===true?core.DEFAULT_WHOLE_ARC_TRAJECTORY_V1:defaults))};
  const batterTechnique=root.KneekuraTechnicalTraitsV75?core.resolveLiveTechnicalTraitsV75(batter.traitProfile):undefined,pitcherTechnique=root.KneekuraTechnicalTraitsV75?core.resolveLiveTechnicalTraitsV75(pitcher.traitProfile):undefined;
   if(batterTechnique)b.technicalSkills=clone(batterTechnique);
   if($('comparison-force-swing').checked)b.swingDecision={...(b.swingDecision??{threshold:.5,aggressionWeight:.5}),approach:'SWING'};
  const trial=observedSpinTrial(batterId,b,batter.bats,batter.heightMeters,library.clips);
  const pitch={...(trial?{observedSpinTrialV236:trial}:{}),originTick:1000000,seed,randomnessV152:randomnessFor('PLAY'),batterObservationV151:clone(core.AUTHORED_LIVE_BATTER_OBSERVATION_V151),batterDirectionMotorV153:clone(core.AUTHORED_OBSERVED_DIRECTION_MOTOR_V153),battingDirectionRequestV149:{version:'batting_direction_request_v149',sourceId:'maker-practice-direction-v149',mode:directionRequestMode},batter:b,pitcher:{...pp,...(pitcherTechnique?{technicalSkills:clone(pitcherTechnique)}:{}),heightMeters:pitcher.heightMeters,moundPosition:clone(core.LIVE_MATCH_MOUND_SURFACE_V1),
   ...(pitcher.throws===undefined?{}:{throws:pitcher.throws}),pitchApproach:pitchPref.pitchApproach},
   catcher:{gloveSpeedMps:cp.gloveSpeedMps,gloveReachMeters:cp.gloveReachMeters,gloveRadiusMeters:cp.gloveRadiusMeters,
    retentionCapacityJ:cp.retentionCapacityJ,captureDissipationPowerW:cp.captureDissipationPowerW,pocketRadiusMeters:.14},
   measuredClips:[{id:clip.id,side:clip.side,source:{sha256:clip.source.sha256,repository:clip.source.repository},contactTimeSeconds:clip.contactTimeSeconds,
    normalization:clone(clip.normalization),frames:clip.frames.map(f=>({tick:f.tick,grip:clone(f.grip),orientation:clone(f.orientation)})),defaultSelection:clip.defaultSelection}],
   batting,pitchType:$('comparison-pitch-type').value,location:$('comparison-location').value,physics:clone(core.LIVE_MATCH_PHYSICS_V1)};
  return {pitch,labels:{batterId,batterName:identity().name,pitcherId,pitcherName:pIdentity.name,clipId:clip.id,clipLabel:clip.label,
   directionRequestMode,forceSwing:$('comparison-force-swing').checked,rosterSourceId:roster.sourceId,playerSourceId:entry.sourceId},roster};
 }
 function ballAt(item,seconds){
  if(item.pitch.contact&&seconds>=(item.pitch.contact.tick-input.originTick)/1e6)return item.sampleFlightAtPitchElapsedSeconds(seconds);
  const frames=item.pitch.frames,target=input.originTick+seconds*1e6;if(target>frames.at(-1).tick)return null;
  let i=0;while(i+1<frames.length&&frames[i+1].tick<=target)i++;const a=frames[i],b=frames[Math.min(i+1,frames.length-1)],u=b.tick===a.tick?0:(target-a.tick)/(b.tick-a.tick);
  return {position:Object.fromEntries(['x','y','z'].map(k=>[k,a.ball.position[k]+(b.ball.position[k]-a.ball.position[k])*u])),visible:a.ball.visible};
 }
 function resultText(item){if(item.pitch.contact)return item.metrics.firstGroundSide==='FOUL_SIDE'?'接触・ファウル方向':item.metrics.firstGroundSide==='FOUL_LINE'?'接触・ライン付近':'接触';
  return {swinging_strike:'空振り',called_strike:'見逃し・ストライク',ball:'見逃し・ボール',unsupported:'継続が必要な球'}[item.pitch.call]??String(item.pitch.call);}
 function buildGeometry(){
  const points=[{x:0,y:0,z:0},{x:0,y:2,z:18.44}];
  for(const item of result.cases){for(const f of item.pitch.frames){points.push(f.ball.position);if(f.bat)points.push(f.bat.grip,f.bat.tip);}for(const f of item.flightFrames)points.push(f.position);}
  geometry={};for(const [view,a,b]of [['side','z','y'],['top','x','z']]){const xs=points.map(p=>p[a]),ys=points.map(p=>p[b]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
   geometry[view]={a,b,cx:(minX+maxX)/2,cy:(minY+maxY)/2,scale:Math.min(850/Math.max(3,maxX-minX),365/Math.max(3,maxY-minY))};}
 }
 function draw(){
  $('comparison-play').textContent=playing?'⏸ 停止':'▶ 再生';
  $('comparison-time-label').textContent=clock.toFixed(3)+'秒';$('comparison-time').value=clock;
  const level=Number($('comparison-level').value);
  for(const view of ['side','top']){const canvas=$('comparison-canvas-'+view),c=canvas.getContext('2d');c.fillStyle='#fbfdfb';c.fillRect(0,0,960,480);
   c.fillStyle='#52685a';c.font='16px sans-serif';if(!result||!geometry){c.fillText('同じ球で4段階を計算すると表示します。',24,44);continue;}
   const g=geometry[view],s=g.scale*zoom,point=p=>({x:480+(p[g.a]-g.cx)*s+pan[view].x*960,y:245-(p[g.b]-g.cy)*s+pan[view].y*480});
   c.save();c.beginPath();c.rect(0,0,960,480);c.clip();
   const grid=s>80?.25:s>30?1:s>10?5:10;c.strokeStyle='#e0e9e3';c.lineWidth=1;
   const loX=g.cx+(-480-pan[view].x*960)/s,hiX=g.cx+(480-pan[view].x*960)/s,loY=g.cy+(-235+pan[view].y*480)/s,hiY=g.cy+(245+pan[view].y*480)/s;
   for(let x=Math.ceil(loX/grid)*grid;x<=hiX;x+=grid){const p=point({x:0,y:0,z:0,[g.a]:x});c.beginPath();c.moveTo(p.x,0);c.lineTo(p.x,480);c.stroke();}
   for(let y=Math.ceil(loY/grid)*grid;y<=hiY;y+=grid){const p=point({x:0,y:0,z:0,[g.b]:y});c.beginPath();c.moveTo(0,p.y);c.lineTo(960,p.y);c.stroke();}
   const home=point({x:0,y:0,z:0});c.strokeStyle='#93a99a';c.lineWidth=2;c.beginPath();if(view==='side'){c.moveTo(0,home.y);c.lineTo(960,home.y);}else{const l=point({x:-150,y:0,z:150}),r=point({x:150,y:0,z:150});c.moveTo(l.x,l.y);c.lineTo(home.x,home.y);c.lineTo(r.x,r.y);}c.stroke();
   for(const item of result.cases){c.strokeStyle=colors[item.level-1];c.globalAlpha=item.level===level?1:.45;c.lineWidth=item.level===level?3.5:1.5;c.beginPath();
    item.flightFrames.forEach((f,i)=>{const p=point(f.position);if(i)c.lineTo(p.x,p.y);else c.moveTo(p.x,p.y);});c.stroke();
    const ball=ballAt(item,clock);if(ball&&ball.visible!==false){const p=point(ball.position);c.fillStyle=colors[item.level-1];c.beginPath();c.arc(p.x,p.y,item.level===level?6:4,0,Math.PI*2);c.fill();}
    const bat=item.pitch.sampleBatAtTick(input.originTick+clock*1e6);if(bat){const a=point(bat.grip),b=point(bat.tip);c.lineWidth=item.level===level?6:2;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();}
   }c.restore();c.globalAlpha=1;c.fillStyle='#52685a';c.fillText('1目盛り '+grid+' m ／ 全弾道で共通の縮尺',16,460);
  }
  document.dispatchEvent(new CustomEvent('kneekura:ball-comparison-change',{detail:{ready:!!result,level,clockSeconds:clock,playing}}));
 }
 function fillResults(){const body=$('comparison-results').tBodies[0];body.replaceChildren();$('comparison-details').replaceChildren();
  for(const item of result.cases){const row=body.insertRow();row.dataset.level=item.level;row.style.color=colors[item.level-1];const m=item.metrics;
   for(const value of ['弾道'+item.level,resultText(item),Number.isFinite(m.exitSpeedMps)?format(m.exitSpeedMps*3.6)+' km/h':'—',Number.isFinite(m.launchAngleDegrees)?format(m.launchAngleDegrees)+'°':'—',Number.isFinite(m.spinRpm)?format(m.spinRpm,0)+' rpm':'—',Number.isFinite(m.carryMeters)?format(m.carryMeters)+' m':item.pitch.contact?'観測時間内に未着地':'—'])row.insertCell().textContent=value;
   row.addEventListener('click',()=>{$('comparison-level').value=item.level;draw();});
   const p=document.createElement('p'),spin=item.pitch.contact?.exitSpin,contact=item.pitch.contact;
   p.textContent='弾道'+item.level+'：'+(contact?'接触 '+format((contact.tick-input.originTick)/1e6,4)+'秒、回転軸の成分（rpm） X '+format(spin.x*60/(2*Math.PI),0)+' / Y '+format(spin.y*60/(2*Math.PI),0)+' / Z '+format(spin.z*60/(2*Math.PI),0):resultText(item))+'。実際の振る速さ '+format(item.pitch.diagnostics.playbackRate,3)+'倍。';$('comparison-details').append(p);
  }
  const note=document.createElement('p');note.textContent='Xは一塁側、Yは上、Zは外野側の軸です。回転数だけで伸びは決まりません。4段階とも同じ能力上限を使うため、軌道変更によって上限に達する場合は、通常試合と同じ処理で振る速さが抑えられます。';$('comparison-details').append(note);
 }
 function setView(patch={}){const nextZoom=patch.zoom??zoom,nextPan=clone(pan);if(!Number.isFinite(nextZoom)||nextZoom<.25||nextZoom>16)throw Error('拡大率は0.25〜16倍です。');
  if(patch.zoom!==undefined&&!patch.pan)for(const view of ['side','top'])nextPan[view]={x:Math.max(-10,Math.min(10,pan[view].x*nextZoom/zoom)),y:Math.max(-10,Math.min(10,pan[view].y*nextZoom/zoom))};
  if(patch.pan)for(const view of ['side','top'])if(patch.pan[view]){const p=patch.pan[view];if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>10||Math.abs(p.y)>10)throw Error('表示位置を確認してください。');nextPan[view]={x:p.x,y:p.y};}
  zoom=nextZoom;pan=nextPan;
  $('comparison-zoom').value=zoom;$('comparison-zoom-label').textContent=format(zoom,2)+'倍';draw();return {zoom,pan:clone(pan)};}
 function seek(seconds){if(!Number.isFinite(seconds))throw Error('再生時刻を確認してください。');playing=false;clock=Math.max(0,Math.min(maxTime,seconds));$('comparison-play').textContent='▶ 再生';draw();}
 async function run(){const ticket=++generation;playing=false;$('comparison-run').disabled=true;$('comparison-status').textContent='同じ条件で4段階を計算しています…';
  try{const next=buildInput();await new Promise(requestAnimationFrame);if(ticket!==generation)return null;
   const calculated=core.compareMeasuredTrajectoriesV69({pitch:next.pitch,afterContactSeconds:8});if(ticket!==generation)return null;
   result=calculated;input=clone(next.pitch);context=next.labels;signature=JSON.stringify(next.roster);error=null;
   maxTime=Math.max(...result.cases.map(c=>(c.flightFrames.at(-1)?.tick??c.pitch.endedAtTick)-input.originTick))/1e6;
   clock=Math.max(0,Math.min(...result.cases.map(c=>(c.pitch.contact?.tick??c.pitch.diagnostics.referenceContactTick)-input.originTick))/1e6-.08);
   $('comparison-time').max=maxTime;buildGeometry();fillResults();setView({zoom:1,pan:{side:{x:0,y:0},top:{x:0,y:0}}});
   $('comparison-conditions').textContent=context.batterName+' ／ '+context.clipLabel+' ／ 投手 '+context.pitcherName+' ／ 球速 '+format(result.cases[0].pitch.speedKmh)+' km/h ／ ばらつき番号 '+input.seed+' ／ 方向 '+{AUTO:'おまかせ(打者に任せる)',PULL:'引っ張る',CENTER:'中央',OPPOSITE:'流す'}[context.directionRequestMode]+(context.forceSwing?' ／ 振る判断だけ固定':' ／ 振る判断も選手の設定');
   $('comparison-status').textContent='4段階を同じ球で計算しました。表や「強調する弾道」で表示を切り替えられます。';$('comparison-status').classList.remove('error');
   for(const id of ['comparison-export','comparison-play','comparison-impact'])$(id).disabled=false;return result;
  }catch(e){invalidate();error=String(e.message??e);$('comparison-status').textContent=error;$('comparison-status').classList.add('error');throw e;}
  finally{if(ticket===generation)$('comparison-run').disabled=false;}
 }
 function invalidate(){generation++;playing=false;result=null;input=null;context=null;geometry=null;clock=0;error=null;
  $('comparison-results').tBodies[0].replaceChildren();$('comparison-details').replaceChildren();$('comparison-conditions').textContent='';$('comparison-status').textContent='条件が変わりました。「同じ球で4段階を計算」を押してください。';$('comparison-status').classList.remove('error');
  for(const id of ['comparison-export','comparison-play','comparison-impact'])$(id).disabled=true;$('comparison-run').disabled=false;$('comparison-play').textContent='▶ 再生';draw();}
 $('comparison-run').onclick=()=>run().catch(()=>{});$('comparison-next').onclick=()=>{$('comparison-seed').value=(Number($('comparison-seed').value)+1)>>>0;invalidate();run().catch(()=>{});};
 for(const id of ['comparison-pitcher','comparison-pitch-type','comparison-location','comparison-seed','comparison-batting','comparison-direction','comparison-force-swing','comparison-direction-seed','comparison-execution-seed','comparison-spin-technique','comparison-spin-x','comparison-spin-y','comparison-spin-depth'])$(id).addEventListener('change',invalidate);
 $('comparison-level').onchange=draw;$('comparison-time').oninput=()=>seek(Number($('comparison-time').value));$('comparison-zoom').oninput=()=>setView({zoom:Number($('comparison-zoom').value)});
 $('comparison-fit').onclick=()=>setView({zoom:1,pan:{side:{x:0,y:0},top:{x:0,y:0}}});
 $('comparison-impact').onclick=()=>{if(result)seek(Math.min(...result.cases.map(c=>(c.pitch.contact?.tick??c.pitch.diagnostics.referenceContactTick)-input.originTick))/1e6);};
 $('comparison-impact-focus').onclick=()=>{if(!result)return;const points=result.cases.map(c=>c.pitch.contact?.ballCenter??c.pitch.diagnostics.zoneJudgment.observedForecastPosition),p={};
  for(const view of ['side','top']){const g=geometry[view],a=points.reduce((n,q)=>n+q[g.a],0)/4,b=points.reduce((n,q)=>n+q[g.b],0)/4;p[view]={x:-(a-g.cx)*g.scale*8/960,y:(b-g.cy)*g.scale*8/480};}
  setView({zoom:8,pan:p});$('comparison-impact').click();};
 $('comparison-play').onclick=()=>{if(!result)return;playing=!playing;if(playing&&clock>=maxTime)clock=0;lastTime=null;$('comparison-play').textContent=playing?'⏸ 停止':'▶ 再生';};
 $('comparison-export').onclick=()=>{if(!result)return;const packet={version:69,context:clone(context),input:clone(input),afterContactSeconds:result.afterContactSeconds,invariants:clone(result.invariants),
  cases:result.cases.map(c=>({level:c.level,call:c.pitch.call,contact:c.pitch.contact,metrics:c.metrics,pitchFrames:c.pitch.frames,flightFrames:c.flightFrames,diagnostics:c.pitch.diagnostics})),view:{zoom,pan:clone(pan)},nativeAdmission:false,officialResult:null},
  url=URL.createObjectURL(new Blob([JSON.stringify(packet,null,2)+'\n'],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='弾道1〜4_同じ投球の比較.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 for(const view of ['side','top']){const canvas=$('comparison-canvas-'+view);canvas.addEventListener('pointerdown',e=>{if(!result)return;drag={id:e.pointerId,view,x:e.clientX,y:e.clientY,pan:{...pan[view]}};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId||drag.view!==view)return;const r=canvas.getBoundingClientRect();setView({pan:{[view]:{x:Math.max(-10,Math.min(10,drag.pan.x+(e.clientX-drag.x)/r.width)),y:Math.max(-10,Math.min(10,drag.pan.y+(e.clientY-drag.y)/r.height))}}});});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>drag=null);
 }
 document.addEventListener('kneekura:maker-roster-change',()=>{if(signature&&JSON.stringify(maker.getLiveRoster())===signature&&context?.batterId===$('live-roster-player').value)return;refreshPitchers();invalidate();});
 function loop(now){if(playing&&result){if(lastTime!==null)clock+=Math.min(.1,(now-lastTime)/1000)*Number($('comparison-speed').value);if(clock>=maxTime){clock=maxTime;playing=false;$('comparison-play').textContent='▶ 再生';}draw();}lastTime=now;requestAnimationFrame(loop);}
 root.KneekuraBallComparison=Object.freeze({run,seek,setView,getObservedSpinTrial:observedSpinTrial,getRandomnessV152:randomnessFor,getResult:()=>result,getInput:()=>input&&clone(input),inspect:()=>({ready:!!result,error,context:context&&clone(context),clockSeconds:clock,maxTime,playing,zoom,pan:clone(pan),invariants:result&&clone(result.invariants),metrics:result?.cases.map(c=>({level:c.level,...clone(c.metrics),call:c.pitch.call}))??[]})});
 refreshPitchers();draw();requestAnimationFrame(loop);root.KneekuraMakerHelp?.decorate(panel);
})(globalThis);
