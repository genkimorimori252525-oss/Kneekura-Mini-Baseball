// Focused transforms over the byte-pinned v61 presentation. No legacy UI reset.
export function applyPitcherPresentationV62(game){
 const once=(a,b)=>{
  const candidates=[a,a.replaceAll('\n','\r\n')].filter((x,i,all)=>all.indexOf(x)===i),found=candidates.filter(x=>game.includes(x));
  if(found.length!==1||game.split(found[0]).length!==2)throw Error('v62 marker '+a.slice(0,100));
  game=game.replace(found[0],()=>b);
 };
 const start=game.indexOf("  if(state.camera==='mound'){"),end=game.indexOf("  if(observed.liveObservation&&state.camera==='batter'",start);
 if(start<0||end<start)throw Error('v62 mound renderer missing');
 const old=game.slice(start,end);
 once(old,`  if(state.camera==='mound'){
   const eye=observed.livePitcherBodyHeadView?.eye??{x:0,y:1.98,z:18.44},
    base={eye:{...eye},yaw:Math.atan2(-eye.x,-eye.z),pitch:Math.atan2(eye.y-1.03,Math.hypot(eye.x,eye.z)),f:1600,cx:300,cy:192,labelMetres:.23};
   if((observed.fair||observed.liveBattedObservation)&&(observed.liveFieldCameraTarget||observed.ball)){
    const target=observed.liveDefensiveOpportunity&&observed.ball?observed.ball.position:observed.liveFieldCameraTarget??observed.ball.position;
    base.yaw=Math.atan2(target.x-eye.x,target.z-eye.z);
    base.pitch=-Math.atan2(target.y-eye.y,Math.hypot(target.x-eye.x,target.z-eye.z));base.f=530;
   }
   return window.KneekuraLivePitcherReactionView.mixTrackingView({reaction:observed.livePitcherReactionView,tracked:base});
  }
`);
 once('let pitcherReactionView=null;','let pitcherReactionView=null,pitcherBodyHeadView=null;');
 once("if(frame.phase==='bench')return 'overhead';","if(frame.phase==='bench')return 'overhead';\n  if(options.camera==='mound'&&frame.defensiveOpportunity?.kind==='none-decisive-over-fence')return 'mound';");
 once('  pitcherReactionView=window.KneekuraLivePitcherReactionView.observe({record:result,frame:currentFrame,sceneMs,',
 `  pitcherBodyHeadView=window.KneekuraPitcherBodyHeadView.observe({record:result,frame:currentFrame,sceneMs,preparationMs:timing.preparationMs,
   pitcherActor:actors.find(actor=>actor.id==='P'),moundSurfacePosition:state.moundSurfacePosition});
  pitcherReactionView=window.KneekuraLivePitcherReactionView.observe({record:result,frame:currentFrame,sceneMs,`);
 once("preparationMs:timing.preparationMs,pitcherActor:actors.find(actor=>actor.id==='P')});",
 "preparationMs:timing.preparationMs,pitcherActor:actors.find(actor=>actor.id==='P'),pitcherBodyHeadView});");
 once('livePitcherReactionView:pitcherReactionView,liveContinuousBatterView:',
 'livePitcherBodyHeadView:pitcherBodyHeadView,liveDefensiveOpportunity:currentFrame.defensiveOpportunity,livePitcherReactionView:pitcherReactionView,liveContinuousBatterView:');
 once(" function setNameDisplay(patch){return window.KneekuraNameDisplayControls.configure(patch);}",
 ` function setNameDisplay(patch){return window.KneekuraNameDisplayControls.configure(patch);}
 function setPitcherBodyHead(patch){const value=window.KneekuraPitcherBodyHeadView.configure(patch);
  const enabled=$('pitcher-head-enabled'),scale=$('pitcher-head-scale');if(enabled)enabled.checked=value.enabled;if(scale)scale.value=value.scale;draw();return value;}`);
 once('window.liveMatchPlayback=Object.freeze({setNameDisplay,setBallDisplay,','window.liveMatchPlayback=Object.freeze({setPitcherBodyHead,setNameDisplay,setBallDisplay,');
 once('stage:sceneStage(),pitcherReactionView,elapsedMs:','stage:sceneStage(),pitcherReactionView,pitcherBodyHeadView,elapsedMs:');
 once(" const nameDisplayPanel=document.createElement('details');",` const pitcherHeadPanel=document.createElement('details');pitcherHeadPanel.id='pitcher-head-controls';pitcherHeadPanel.style.padding='12px 18px';
 pitcherHeadPanel.innerHTML='<summary>投手視点：投球時の身体・頭の動き</summary><p>投手の位置に付いた目が、投球動作と同じ時間で踏み込み・回復します。動きは調整中の仮モデルです。</p><label><input id="pitcher-head-enabled" type="checkbox" checked>身体に伴うカメラ移動</label><label>動きの倍率 <input id="pitcher-head-scale" type="number" min="0" max="2" step="0.05" value="1"></label><button id="pitcher-head-reset">初期値に戻す</button>';
 document.querySelector('details.settings').after(pitcherHeadPanel);
 $('pitcher-head-enabled').onchange=()=>setPitcherBodyHead({enabled:$('pitcher-head-enabled').checked});
 $('pitcher-head-scale').onchange=()=>{try{setPitcherBodyHead({scale:Number($('pitcher-head-scale').value)});}catch(error){setPitcherBodyHead({});$('announcement').textContent=error.message;}};
 $('pitcher-head-reset').onclick=()=>setPitcherBodyHead(window.KneekuraPitcherBodyHeadView.defaults);
 const nameDisplayPanel=document.createElement('details');`);
 return game;
}
