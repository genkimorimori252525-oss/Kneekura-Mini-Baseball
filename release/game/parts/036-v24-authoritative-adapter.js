
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const proofLog = text => {$('native-log').textContent = text;};
  const visual = window.matchPreview;
  const native = window.KneekuraNativeMatchCore;
  let session = null, active = false, playing = false;
  let nativeMode = 'aero';let continuation=null,nativeOverhead=false;
  let token = 0, oldTick = 0, oldCamera = 'batter', previousButtons = [];
  let last = null, previousSpinHidden = true, oldCaption = '', oldResult = '';
  const controlsToSuspend = [
    'play','previous-pitch','next-pitch','finish-game','new-game','restart',
    'inning-select','pa-select','managed-team'
  ];
  const background = $('field')?.parentElement;
  const banner = document.createElement('div');
  banner.className = 'native-proof-banner'; banner.hidden = true;
  banner.textContent = 'Native投球：PNG選手は配置参考。正式な守備・走塁は未接続';
  background?.appendChild(banner);
  function setLegacyControlsDisabled(disabled) {
    if (disabled) previousButtons = controlsToSuspend.map(id => [id,$(id)?.disabled]);
    const states = new Map(previousButtons);
    for (const id of controlsToSuspend) {
      const el = $(id); if (el) el.disabled = disabled || !!states.get(id);
    }
  }
  function displayBall(sample) {
    if (!sample?.world?.ball) {visual.nativePaintBall(null);visual.nativePaintBat(null);return;}
    const ball = sample.world.ball;
    const spinFrames=last.result.spinFrames??[];
    let frameIndex=0;while(frameIndex+1<spinFrames.length&&spinFrames[frameIndex+1].tick<=sample.world.tick)frameIndex++;
    const orientation=sample.materialOrientation??spinFrames[frameIndex]?.orientationMaterialToWorld??null;
    // Latest actual Native spin frame; no invented omega or interpolation across
    // multiple turns. Unknown release phase remains explicitly uncalibrated.
    visual.nativePaintBall({position:ball.position,orientation,nativeObservation:true,ballKind:sample.materialOrientation?'batted':null});
    // Same authoritative Native swing pose, read by the v23 approved bat renderer.
    // The static four-frame B1 artwork is never regenerated or changed.
    visual.nativePaintBat(sample?.batter?.bat ?? null);
  }
  function enter() {
    if (playing)return;
    if (!native?.createNativeSinglePaSession || !native?.createNativeAerodynamicSession
      || !native?.createReferenceAerodynamicPhysicalSource || !visual?.nativePaintBall) {
      proofLog('正式Coreの同梱JavaScriptが見つからん。検証モジュールと同じフォルダで開いてくれ。');return;
    }
    const seed = Number($('native-seed').value);
    nativeMode = $('native-physics').value;
    try {
      if (nativeMode === 'aero') {
        // Explicit source-owned, one-PA diagnostic fixture. This does NOT claim
        // the 18 players have been enrolled in the production Native world.
        session = native.createNativeAerodynamicSession({
          match: {ruleProfileId:'npb-2026',inning:1,half:'top',outs:0,balls:0,strikes:0,
            bases:{first:null,second:null,third:null},score:{away:0,home:0},playId:0},
          startedAtTick:0,matchSeed:seed,batterRunnerId:'lad-ohtani',
          batterHandedness:'L',pitcherHandedness:'R',
        });
      } else {
        session = native.createNativeSinglePaSession(seed);
      }
    } catch(error){ proofLog(error.message);return; }
    active = true; token++;
    const inspected = visual.inspect(); oldTick = inspected.tick;
    oldCamera = inspected.autoCamera ?? 'batter';
    visual.seek(0);
    visual.setOptions({cameraChoice:'batter', appearance:'retro', autoOverhead:false});
    setLegacyControlsDisabled(true);
    previousSpinHidden = $('spin-hud')?.hidden ?? true;
    if($('spin-hud'))$('spin-hud').hidden = true;
    oldCaption = $('camera-caption')?.textContent ?? '';
    oldResult = $('result-text')?.textContent ?? '';
    if($('camera-caption'))$('camera-caption').textContent = 'Native 正史投球';
    if($('result-text'))$('result-text').textContent = '正式Coreの1打席検証中';
    banner.hidden = false;
    $('native-enter').disabled = true;
    $('native-issue').disabled = false;
    $('native-exit').disabled = false;
    proofLog('正式Core・'+(nativeMode==='aero'?'空力＋剛体':'一定加速度')+'参照検証。TBD対LADは画面ラベルだけで、実選手能力はまだ適用していない。試行シード='+seed+'。次球を待機。');
  }
  function exit() {
    token++; active = false; playing = false; session = null;
    visual.seek(oldTick);visual.setOptions({cameraChoice:oldCamera});
    setLegacyControlsDisabled(false);
    if($('spin-hud'))$('spin-hud').hidden = previousSpinHidden;
    if($('camera-caption'))$('camera-caption').textContent = oldCaption;
    if($('result-text'))$('result-text').textContent = oldResult;
    banner.hidden = true;
    $('native-enter').disabled = false;
    $('native-issue').disabled = true;
    $('native-exit').disabled = true;
    proofLog('既存v23の試合へ復帰。正式Core実証で生成した内容はv23の試合記録へ混ぜていない。');
  }
  function issue() {
    if (!active || playing || !session)return;
    const request = {
      pitcher: {
        attackZone: $('native-target').value,
        verticalPlan: $('native-height').value,
        aggression: 'balanced',
      },
      // Explicit TEST batter action, not user manager's instruction to the LAD opponent.
      batter: {approach:$('native-approach').value,swingBias:'neutral'},
      runners: {posture:'balanced'},
    };
    let result;
    try {
      if (nativeMode === 'aero') {
        // The source is explicitly supplied and models real aero and rigid
        // collisions. The *demo* input never pretends to be the skill-backed
        // Tikao/Ohtani PhysicalProducer. Real official gameplay requires it.
        session.acceptNextCommand(request);
        const explicitSource = native.createReferenceAerodynamicPhysicalSource({
          actorsAtTick: () => ({defenders:[],runners:[]}),
          pitchSpeedMps: 40,
          batterAction: request.batter.approach === 'take' ? 'take' : 'swing',sweetSpotBand:{minimumT:.65,maximumT:.78},aimAtPlate:true,aerodynamics:native.REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS,
        });
        result = session.issue(explicitSource);
      } else {
        result = session.issue(request);
      }
    }catch(error){
      proofLog('正史処理停止: '+error.message);
      $('native-issue').disabled = true;return;
    }
    last=result;continuation=null;nativeOverhead=false;
    if(result.result.rigidContact&&native.observeNativeFreeBallContinuation){
     // Explicit synthetic reference calibration. Not Tikao ability or stadium material.
     try{continuation=native.observeNativeFreeBallContinuation({observation:result.result,
      throughTick:result.result.rigidContact.tick+8000000,
      aerodynamics:{ticksPerSecond:1000000,integrationStepTicks:1000,gravityY:-9.81,
       aerodynamics:native.REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS},
      ground:{radiusM:.0366,inertiaRatio:.378,gravityMps2:9.81,ticksPerSecond:1000000,
       restingVerticalSpeedMps:.15,material:{restitution:.4,slidingFriction:.3,
        rollingDecelerationMps2:.8,normalSpinDecayPerSecond:.5}}});
     }catch(error){playing=false;proofLog('Native実打球の観測停止: '+error.message);return;}
    }playing=true;
    $('native-issue').disabled=true;
    const samples=continuation?[...result.result.samples,
     ...continuation.samples.slice(1).map(s=>({world:{tick:s.tick,ball:s.ball},
       materialOrientation:s.orientation,batter:{action:'follow_through',bat:null}}))]:result.result.samples;
    const initialBall=samples[0]?.world?.ball;
    if (!samples?.length){proofLog('Native Coreから物理サンプルを取得できへん');playing=false;return;}
    const start=performance.now(),clock=++token;
    const render=()=>{
      if (clock!==token || !active)return;
      const ms=performance.now()-start;
      // Rendering only: interpolate samples, do not advance Core ticks or umpire state.
      const offsetUs=ms*1000, target=samples[0].world.tick+offsetUs;
      let i=0;
      while(i+1<samples.length && samples[i+1].world.tick<=target)i++;
      const a=samples[i],b=samples[i+1];
      let ballSample=a;
      if(b && target>a.world.tick && a.world.ball && b.world.ball){
        const alpha=Math.max(0,Math.min(1,(target-a.world.tick)/(b.world.tick-a.world.tick)));
        const interpolate=(x,y)=>x+(y-x)*alpha;
        const a0=a.world.ball,b0=b.world.ball;
        const aBat=a.batter?.bat,bBat=b.batter?.bat;
        const bat=aBat&&bBat&&a.batter.action===b.batter.action?{grip:{
          x:interpolate(aBat.grip.x,bBat.grip.x),y:interpolate(aBat.grip.y,bBat.grip.y),z:interpolate(aBat.grip.z,bBat.grip.z)},tip:{
          x:interpolate(aBat.tip.x,bBat.tip.x),y:interpolate(aBat.tip.y,bBat.tip.y),z:interpolate(aBat.tip.z,bBat.tip.z)}}:aBat??null;
        ballSample={world:{tick:target,ball:{position:{
          x:interpolate(a0.position.x,b0.position.x),
          y:interpolate(a0.position.y,b0.position.y),
          z:interpolate(a0.position.z,b0.position.z)},spin:a0.spin}},batter:{...a.batter,bat}};
      }
      // Contact/ground impulses are discontinuities: observe their exact source
      // sample instead of interpolating a pre-impact state through a bounce.
      if(continuation&&a.world.tick>=result.result.rigidContact.tick){ballSample=a;
       if(!nativeOverhead){nativeOverhead=true;
        visual.setOptions({cameraChoice:'overhead',autoOverhead:false});
        if($('camera-caption'))$('camera-caption').textContent='Native 実打球・俯瞰';
       }
      }
      displayBall(ballSample);
      if(target < samples.at(-1).world.tick){requestAnimationFrame(render);return;}
      playing=false;
      const status=session.inspect();const count=status.count;
      const logCount=count?count.balls+'B '+count.strikes+'S':status.phase;
      const kinds=result.eventKinds.join(' → ');
      const source=result.result.authority;
      const flightStart=initialBall?.position?.z;
      if(result.result.requiresOfficialLiveBallResolution){
        $('native-issue').disabled=true;
        proofLog(source+' / 接触後の正史物理: '+kinds+'\n'+(continuation?'正式Coreの実打球・地面接触 '+continuation.groundContacts.length+'回を観測。土の反発・摩擦は明示的な参照校正。\n':'')+'守備・走者・審判の受理された正史履歴がないため、公式結果は未確定で停止。');
      }else{
        $('native-issue').disabled=status.phase!=='active';
        proofLog(source+' / Native第'+(result.ordinal+1)+'球 / '+logCount+' / 始点z='+flightStart?.toFixed(1)+'m\n'+kinds+
          (status.phase==='active'?'\n次球の指示はこれから受理される。':'\n正史のこの打席は終了。'));
      }
    };
    requestAnimationFrame(render);
  }
  document.addEventListener('keydown',event=>{
    if(!active)return;
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();exit();return;}
    if(['ArrowLeft','ArrowRight',' ','Enter'].includes(event.key)&&!event.target.closest?.('#native-proof-panel')){
      event.preventDefault();event.stopImmediatePropagation();
    }
  },true);
  $('native-enter').addEventListener('click',enter);
  $('native-exit').addEventListener('click',exit);
  $('native-issue').addEventListener('click',issue);
  window.nativeV25Bridge=Object.freeze({enter,exit,issue,inspect:()=>({
    physicsMode:nativeMode,
    active,playing,authority:last?.result.authority??null,
    samples:last?.result.samples.length??0,
    acceptedEvents:last?.eventKinds??[],
    phase:session?.inspect().phase??null,
    count:session?.inspect().count??null,
    prefixRendererOnly:!!visual.nativePaintBall,spinFrames:last?.result.spinFrames?.length??0,spinSource:last?.result.spinFrames?.[0]?.authority??null,sourceSpinSpeedAtRelease:last?.result.spinFrames?.[0]?.angularSpeedRadPerSecond??null,sourceSpinSpeedAtContact:last?.result.spinFrames?.at(-1)?.angularSpeedRadPerSecond??null,referenceProfileSpinDecay:!!native.REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS?.spinDecay,continuationAuthority:continuation?.authority??null,groundContactCount:continuation?.groundContacts.length??0,continuationSamples:continuation?.samples.length??0,continuationPhases:[...new Set(continuation?.samples.map(s=>s.phase)??[])],contactSegmentT:last?.result.rigidContact?.segmentT??null,officialFreeBallResult:continuation?.officialResult??null,
    unresolved:last?.result.requiresOfficialLiveBallResolution??false,
  })});
})();
