/* Read-only single-shot audio. Original ARM branch numbers have unknown SI
 * units. The 42/34/26 m/s tiers here are provisional game policy, not a claim
 * of reproducing the original selector. No Core RNG or outcome mutation. */
(function(root){
 'use strict';
 const cache=new WeakMap();
 // Home-run themes belong to the park's home team and play only for its own
 // home runs there. tools/ballpark-studio/homerun-theme.mjs holds the same rule.
 const homeThemes=Object.freeze({tambov:Object.freeze({early:'hrTbdEarly',late:'hrTbdLate',walkoff:'hrTbdWalkoff'})});
 function homeTheme(record){
  const theme=homeThemes[root.document?.getElementById('stadium-choice')?.value],before=record.beforeMatch;
  if(!theme||before?.half!=='bottom')return null;
  const key=record.finished?theme.walkoff:before.inning<=6?theme.early:theme.late;
  return root.KneekuraAudioPackV100?.[key]?key:null;
 }
 function events(record){
  if(!record)return [];if(cache.has(record))return cache.get(record);
  const play=record.play??{},rules=play.rules??{},d=play.diagnostics??{},tps=d.sourceClockTicksPerSecond??1e6,
   contact=play.contactMoment,origin=contact?.originTick??record.frames?.[0]?.tick??0,rows=[],id=record.beforeMatch?.playId??0,
   add=(tick,key,group='sfx',priority=1)=>{if(Number.isFinite(tick))rows.push(Object.freeze({id:`${id}:${tick}:${key}`,play:id,tick,key,group,priority}));},
   first=record.frames?.[0]?.tick;
  if(record.beforeMatch?.playId===0&&record.beforeMatch?.balls===0&&record.beforeMatch?.strikes===0)add(first+1,'start','crowd',2);
  if(record.frames?.some(f=>f.ballKind==='pitch'))add(first+1,'throw');
  if(d.swingOffered&&record.command?.batting!=='bunt'&&Number.isFinite(d.referenceStartTick))add(d.referenceStartTick,'swing');
  let strong=false;
  if(contact&&play.outgoingBallMoment){const v=play.outgoingBallMoment.ball.velocity,speed=Math.hypot(v.x,v.y,v.z),angle=Math.atan2(v.y,Math.hypot(v.x,v.z))*180/Math.PI,
    stage=angle>=55?4:speed>42?1:speed>34?2:speed>26?3:4;
   add(contact.ball.tick,record.command?.batting==='bunt'?'bunt':`wood${stage}`);
   if(speed>34&&record.command?.batting!=='bunt'){add(contact.ball.tick,speed>42?'hit2':'hit1','crowd',2);strong=true;}
  }
  let throwSeen=false,groundSeen=false,lastBounce=-Infinity;
  for(const f of play.field?.facts??[]){
   if(f.tick>rules.endedAtTick)continue;
   if(f.kind==='throw_release'){add(f.tick,'throw');throwSeen=true;}
   if(f.kind==='ground_contact'){groundSeen=true;if(f.tick-lastBounce>tps*.35){add(f.tick,'bound');lastBounce=f.tick;}}
   if(f.kind==='catch_secured')add(f.tick,groundSeen&&!throwSeen?'catchGround':'catch');
   if(f.kind==='wall_support')add(f.tick,'fence');
  }
  // A steal throw and a pickoff are extra pitch-phase frames that the field facts above do not describe.
  // Each throw gets its release sound, and the catch sound where the ball arrives at the base.
  {let flying=false,arrived=false,lastThrow=null;
   for(const f of record.frames??[]){
    if(f.phase!=='pitch')continue;
    if(f.ballKind==='throw'){
     if(!flying){add(f.tick,'throw');flying=true;arrived=false;}
     if(!arrived&&(f.ball?.possessedBy||f.ball?.visible===false)){add(f.tick,'catch');arrived=true;}
     lastThrow=f.tick;
    }else if(flying){if(!arrived)add(lastThrow,'catch');flying=false;}
   }
   if(flying&&!arrived)add(lastThrow,'catch');}
  if(!contact){const secured=d.catcherSecureTick??record.frames?.find(f=>f.ball?.possessedBy===record.pitcherPlayerId)?.tick;
   if(Number.isFinite(secured))add(secured,'mitt');
   else {const caught=record.frames?.find(f=>f.possessedBy&&f.phase==='pitch'&&f.possessedBy!==record.pitcherPlayerId);if(caught)add(caught.tick,'mitt');}
  }
  const fence=play.field?.ruleFacts?.overFence;
  const hr=play.classification==='home_run'&&fence?.fair&&fence.untouchedGround&&fence.cause!=='throw';
  if(hr){add(fence.tick,'homerun','crowd',5);const theme=homeTheme(record);if(theme)add(fence.tick,theme,'music',5);}
  else if(rules.scoredRunnerIds?.length){add(rules.endedAtTick,'score');add(rules.endedAtTick,'hit2','crowd',3);}
  else if(play.localScoringV100?.hits===1&&!strong)add(play.localScoringV100.atTick,'hit1','crowd',2);
  else if(play.classification==='hit_by_pitch')add(rules.endedAtTick,'hbp','crowd',2);
  else if(['walk','strikeout'].includes(play.classification))add(rules.endedAtTick,'hit1','crowd',2);
  else if(rules.outcomes?.length||['called_strike','swinging_strike'].includes(play.call))add(rules.endedAtTick,'clap','crowd',1);
  if(record.finished)add(rules.endedAtTick,'end','crowd',6);
  const out=Object.freeze(rows.sort((a,b)=>a.tick-b.tick||b.priority-a.priority));cache.set(record,out);return out;
 }
 // The crowd under the whole game: one looped wave in two voices, hard left and hard right, at slightly different
 // pitches, so the two never repeat together. Frames and rates are the source's own; reactions play on top in their own slot.
 const BED=Object.freeze({sampleRate:14004,loopStart:160,loopEnd:8592,gain:.140625,voices:Object.freeze([Object.freeze({rate:.841481045600393,pan:1}),Object.freeze({rate:.891643850107123,pan:-1})])});
 function owner(){
  try{if(root.parent!==root&&root.parent.KneekuraAudioV100)return root.parent.KneekuraAudioV100.owner();}catch{}
  if(root.__kneekuraAudioOwnerV100)return root.__kneekuraAudioOwnerV100;
  let context=null,epoch=0,activeCrowd=null,error='',settings={master:.65,sfx:.8,crowd:.45,music:.7,mute:false},lastOwner=null;
  const decoded=new Map(),loading=new Map(),voices=new Set(),trace=[],ownerEpochs=new WeakMap(),listeners=new Set();
  const notify=()=>{for(const callback of listeners)try{callback();}catch{}};
  try{const saved=JSON.parse(root.localStorage?.getItem('kneekura-audio-v100')??'null');if(saved)for(const k of Object.keys(settings))if(typeof saved[k]===typeof settings[k]&&(k==='mute'||Number.isFinite(saved[k])&&saved[k]>=0&&saved[k]<=1))settings[k]=saved[k];}catch{}
  let bed=null,bedBuffer=null,bedGeneration=0;
  const bedLevel=()=>settings.mute?0:settings.master*settings.crowd*BED.gain;
  // The native 14,004 Hz samples: decodeAudioData would resample them and move the loop points.
  async function bedSamples(){
   if(bedBuffer)return bedBuffer;
   const binary=root.atob(bank().crowdBed.base64),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
   const view=new DataView(bytes.buffer);
   for(let p=12;p+8<=bytes.length;){const size=view.getUint32(p+4,true);
    if(String.fromCharCode(...bytes.subarray(p,p+4))==='data'){const b=context.createBuffer(1,size/2,BED.sampleRate),a=b.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=view.getInt16(p+8+i*2,true)/32768;return bedBuffer=b;}
    p+=8+size+(size&1);}
   throw Error('通常歓声の音源を読めません');
  }
  function stopBed(fadeSeconds=0){bedGeneration++;if(!bed)return;const t=context.currentTime,playing=bed;bed=null;
   for(const v of playing){v.gain.gain.setValueAtTime(v.gain.gain.value,t);if(fadeSeconds)v.gain.gain.linearRampToValueAtTime(0,t+fadeSeconds);try{v.source.stop(t+fadeSeconds);}catch{}}}
  async function startBed(){
   if(bed||!context||context.state!=='running'||!bank().crowdBed||!bedLevel())return;
   const generation=++bedGeneration;
   try{const buffer=await bedSamples();if(generation!==bedGeneration||bed||!bedLevel())return;
    const at=context.currentTime+.01;
    bed=BED.voices.map(voice=>{const source=context.createBufferSource(),gain=context.createGain(),pan=context.createStereoPanner();
     source.buffer=buffer;source.loop=true;source.loopStart=BED.loopStart/BED.sampleRate;source.loopEnd=BED.loopEnd/BED.sampleRate;source.playbackRate.value=voice.rate;
     gain.gain.value=bedLevel();pan.pan.value=voice.pan;source.connect(gain);gain.connect(pan);pan.connect(context.destination);
     source.onended=()=>{source.disconnect();gain.disconnect();pan.disconnect();};source.start(at);return {source,gain};});
   }catch(e){error='通常歓声を再生できません：'+e.message;notify();}
  }
  const stop=(sourceOwner,keepMusic=false)=>{if(sourceOwner&&typeof sourceOwner==='object')ownerEpochs.set(sourceOwner,(ownerEpochs.get(sourceOwner)??0)+1);else epoch++;
   for(const v of voices)if((!sourceOwner||v.owner===sourceOwner)&&!(keepMusic&&v.group!=='sfx')){try{v.source.stop();}catch{}voices.delete(v);if(activeCrowd===v)activeCrowd=null;}};
  // A theme outlives its own play, then gives way when the next pitch is thrown.
  const fadeMusic=(play,seconds=1.2)=>{for(const v of voices)if(v.group==='music'&&v.play!==play&&!v.fading){v.fading=true;const t=context.currentTime;
   v.gain.gain.setValueAtTime(v.gain.gain.value,t);v.gain.gain.linearRampToValueAtTime(0,t+seconds);try{v.source.stop(t+seconds);}catch{}}};
  function bank(){return root.KneekuraAudioPackV100??{};}
  async function unlock(){
   try{const C=root.AudioContext??root.webkitAudioContext;if(!C)throw Error('このブラウザーは音声再生に対応していません');
    if(!context)context=new C();await context.resume();error='';
    // Prepare only common short effects. Long crowds remain demand-loaded.
    await Promise.all(['wood1','wood2','wood3','wood4','catch','mitt','throw','swing'].filter(k=>bank()[k]).map(load));
   }catch(e){error='音声を有効にできません：'+e.message;}notify();return context?.state==='running'&&!error;
  }
  async function load(key){
   if(decoded.has(key)){const b=decoded.get(key);decoded.delete(key);decoded.set(key,b);return b;}
   if(loading.has(key))return loading.get(key);
   const entry=bank()[key];if(!entry)throw Error('音源がありません：'+key);
   const p=(async()=>{const binary=root.atob(entry.base64),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    const wav=entry.encoding==='deflate'?await new Response(new Blob([bytes]).stream().pipeThrough(new root.DecompressionStream('deflate'))).arrayBuffer():bytes.buffer;
    const b=await context.decodeAudioData(wav);decoded.set(key,b);while(decoded.size>16)decoded.delete(decoded.keys().next().value);return b;})();
   loading.set(key,p);try{return await p;}finally{loading.delete(key);}
  }
  async function sound(event,sourceOwner){
   if(!context||context.state!=='running'||settings.mute||!settings.master)return;
   if(lastOwner!==sourceOwner){stop();lastOwner=sourceOwner;}
   const generation=epoch,ownerGeneration=typeof sourceOwner==='object'?ownerEpochs.get(sourceOwner)??0:0,requested=context.currentTime;
   try{const buffer=await load(event.key);if(epoch!==generation||typeof sourceOwner==='object'&&(ownerEpochs.get(sourceOwner)??0)!==ownerGeneration||event.group!=='music'&&context.currentTime-requested>.18||settings.mute)return;
    if(event.key==='throw')fadeMusic(event.play);
    if(event.group==='crowd'&&activeCrowd){if(activeCrowd.play===event.play&&activeCrowd.priority>event.priority)return;try{activeCrowd.source.stop();}catch{}voices.delete(activeCrowd);activeCrowd=null;}
    const effects=[...voices].filter(v=>v.group==='sfx');if(event.group==='sfx'&&effects.length>=8){const oldest=effects[0];oldest.source.stop();voices.delete(oldest);}
    const source=context.createBufferSource(),gain=context.createGain(),voice={source,gain,owner:sourceOwner,group:event.group,priority:event.priority,play:event.play};source.buffer=buffer;source.loop=false;
    gain.gain.value=settings.master*settings[event.group];source.connect(gain);gain.connect(context.destination);voices.add(voice);if(event.group==='crowd')activeCrowd=voice;
    source.onended=()=>{const finished=voices.delete(voice);if(activeCrowd===voice)activeCrowd=null;source.disconnect();gain.disconnect();if(event.key==='end'&&finished)stopBed(2);};source.start();
    trace.push({id:event.id,key:event.key,tick:event.tick,time:context.currentTime});if(trace.length>256)trace.shift();
   }catch(e){error='音源を再生できません：'+e.message;notify();}
  }
  function prepare(keys){if(!context||context.state!=='running')return false;
   for(const key of new Set(keys))if(bank()[key])load(key).catch(e=>{error='音源を準備できません：'+e.message;notify();});return true;
  }
  function configure(patch){for(const [k,v]of Object.entries(patch)){if(!Object.hasOwn(settings,k)||typeof v!==typeof settings[k]||k!=='mute'&&(!Number.isFinite(v)||v<0||v>1))throw Error('音量は0〜100%で設定してください');settings[k]=v;}
   stop();if(bed){if(bedLevel())for(const v of bed)v.gain.gain.value=bedLevel();else stopBed();}
   try{root.localStorage?.setItem('kneekura-audio-v100',JSON.stringify(settings));}catch{}return {...settings};}
  root.addEventListener?.('pagehide',()=>{stop();stopBed();});root.document?.addEventListener('visibilitychange',()=>{if(root.document.hidden){stop();stopBed();}});
  const api=Object.freeze({unlock,load,prepare,sound,stop,startBed,stopBed,configure,subscribe(callback){listeners.add(callback);return()=>listeners.delete(callback);},owner:()=>api,inspect:()=>({settings:{...settings},state:context?.state??'locked',decoded:decoded.size,loading:loading.size,voices:voices.size,bedVoices:bed?.length??0,crowdReactionPlay:activeCrowd?.play??null,error,trace:[...trace]})});
  root.__kneekuraAudioOwnerV100=api;return api;
 }
 function policy(){try{return root.parent?.KneekuraAudioPolicyV100??root.KneekuraAudioPolicyV100??{};}catch{return root.KneekuraAudioPolicyV100??{};}}
 function create(){let record=null,cursor=null,playingBefore=false,preparedRecord=null;const token={},audio=owner();
  return Object.freeze({observe(next){const {tick,playing,speed=1,quiet=false}=next,changed=next.record!==record,back=cursor!==null&&tick<cursor;
    if(changed||back){audio.stop(token,!back);record=next.record;cursor=Number.isFinite(tick)&&record&&tick<=record.frames?.[0]?.tick?tick-1:tick;}
    // Preparation may inspect already generated event keys, never emit their
    // sound. It avoids first-use crowd decode lag during the physical scene.
    if(record&&preparedRecord!==record&&audio.prepare(events(record).filter(e=>e.group!=='crowd'||policy().crowd!==false).map(e=>e.key)))preparedRecord=record;
    if(quiet)audio.stopBed();
    if(!record||!playing||speed>1.25||!Number.isFinite(tick)){if(playingBefore)audio.stop(token,true);cursor=tick;playingBefore=false;return;}
    if(policy().crowd!==false&&!record.finished)audio.startBed();
    if(cursor!==null&&tick-cursor<=500_000){for(const e of events(record))if(e.tick>cursor&&e.tick<=tick&&(e.group!=='crowd'||policy().crowd!==false))audio.sound(e,token);}
    cursor=tick;playingBefore=true;
   },stop(between=false){playingBefore=false;audio.stop(token,between);if(!between)audio.stopBed();},inspect:()=>({cursor,playing:playingBefore,...audio.inspect()})});
 }
 function installControls(container){if(!container||container.querySelector('[data-audio-v100]'))return;const host=owner(),panel=root.document.createElement('details');panel.dataset.audioV100='';
  panel.style.padding='12px 18px';
  const summary=root.document.createElement('summary');summary.textContent=policy().crowd===false?'効果音（メーカーでは歓声なし）':'音声・歓声';panel.append(summary);
  const unlock=root.document.createElement('button');unlock.textContent='音声を有効にする';unlock.type='button';panel.append(unlock);
  const settings=host.inspect().settings;
  for(const [key,label]of [['master','全体'],['sfx','効果音'],...(policy().crowd===false?[]:[['crowd','歓声'],['music','本塁打曲']])]){const row=root.document.createElement('label');row.style.cssText='display:inline-flex;align-items:center;gap:8px;margin:8px';row.append(label);
   const input=root.document.createElement('input');input.type='range';input.min='0';input.max='100';input.value=String(settings[key]*100);input.setAttribute('aria-label',label+'音量');input.oninput=()=>host.configure({[key]:Number(input.value)/100});row.append(input);panel.append(row);}
  const muteLabel=root.document.createElement('label'),mute=root.document.createElement('input');mute.type='checkbox';mute.checked=settings.mute;mute.onchange=()=>host.configure({mute:mute.checked});muteLabel.append(mute,' 消音');panel.append(muteLabel);
  const status=root.document.createElement('p');status.setAttribute('role','status');status.textContent='通常歓声は試合中に流れ続け、反応の歓声と効果音は単発で重なります。停止・移動した時刻の音はまとめて再生しません。';panel.append(status);
  const refresh=()=>{const s=host.inspect();status.textContent=s.error||(s.state==='running'?'音声は有効です。試合・練習を再生すると鳴ります。':'最初の操作で音声を有効にします。停止・移動した時刻の音はまとめて再生しません。');status.style.color=s.error?'#c94b42':'';};
  const unsubscribe=host.subscribe(refresh);root.addEventListener?.('pagehide',unsubscribe,{once:true});refresh();
  unlock.onclick=async()=>{await host.unlock();refresh();};container.append(panel);
  root.document.addEventListener('pointerdown',()=>host.unlock(),{once:true});root.document.addEventListener('keydown',()=>host.unlock(),{once:true});
 }
 root.KneekuraAudioV100=Object.freeze({version:100,events,owner,create,installControls});
})(globalThis);
