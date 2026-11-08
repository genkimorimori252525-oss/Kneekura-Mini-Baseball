(function (root) {
 'use strict';
 const core=root.KneekuraBaseballWorkbench,maker=root.baseballMaker,$=id=>document.getElementById(id);
 if(!core?.evaluateBatSwingCapacityV121||!maker?.getLiveRoster||!$('swing-bat-mass'))return;
 const line=document.createElement('output');line.id='swing-bat-capacity-v121';
 line.style.display='block';line.style.fontSize='.78em';line.style.lineHeight='1.35';line.style.marginTop='.15em';
 line.setAttribute('aria-live','polite');
 line.title='芯（sweet spot）の速度の推定上限です。明示した基準バット・校正の範囲内だけ算出します。接触時の実速度・平均・再生速度・到達の保証ではありません。';
 ($('swing-bat-mass-g')??$('swing-bat-mass')).after(line);
 const reasons={MISSING_EXPLICIT_BASELINE_CALIBRATION:'基準バット・校正参照が未設定',OUTSIDE_CALIBRATION_RANGE:'校正の適用範囲外'};
 let snapshot=null,queued=false;
 const show=(text,status)=>{line.textContent='このバットでの推定MAXスイング速度：'+text;line.dataset.status=status;};
 function refresh(){
  try{
   const playerId=$('live-roster-player')?.value??root.KneekuraSwingMaker?.getPreviewSource?.().playerId,
    physical=maker.getLiveRoster()?.entries.find(entry=>entry.playerId===playerId)?.physical;
   if(!physical){snapshot=null;show('未算出（選手の用具Sourceが未設定）','UNAVAILABLE');return;}
   const pending=maker.getRecoveryStateV82?.().pendingFields??[],
    relevant=new Set(['batMassKg','batLengthM','sweetSpotT','maximumSweetSpotSpeedMps','batSwingCapacityV121']);
   let unsettled=pending.some(item=>item.playerId===playerId&&relevant.has(item.path));
   for(const [id,key]of [['swing-bat-mass','batMassKg'],['swing-bat-length','batLengthM']]){
    const input=$(id),scale=key==='batLengthM'?.01:1;
    // V94's human length editor is centimetres; the roster remains metres.
    if(input&&(input.value.trim()===''||!Number.isFinite(Number(input.value))
      ||input.validity?.valid===false||Math.abs(Number(input.value)*scale-physical[key])>Number.EPSILON*16*Math.max(1,Math.abs(physical[key]))))unsettled=true;
   }
   if(unsettled){snapshot=null;show('入力未確定','PENDING');return;}
   const preview=root.KneekuraSwingMaker?.getPreviewSource?.(),equipment=preview?.playerId===playerId?preview.equipment:null;
   const result=core.evaluateBatSwingCapacityV121({maximumSweetSpotSpeedMps:physical.maximumSweetSpotSpeedMps,
    bat:{lengthM:physical.batLengthM??equipment?.batLengthM,massKg:physical.batMassKg,sweetSpotT:physical.sweetSpotT??equipment?.sweetSpotT},
    ...(physical.batSwingCapacityV121===undefined?{}:{model:physical.batSwingCapacityV121})});
   snapshot=result;
   if(result.status!=='ESTIMATED'){show('未算出（'+(reasons[result.reason]??result.reason)+'）','UNAVAILABLE');return;}
   const max=result.effectiveMaxSweetSpotSpeedMps;
   let text=max.toFixed(1)+' m/s（約 '+(max*3.6).toFixed(0)+' km/h）';
   if(Number.isFinite(physical.targetSweetSpotSpeedMps)&&physical.targetSweetSpotSpeedMps>max)
    text+=' ／ 設定速度が上限超過：'+max.toFixed(1)+' m/s以下への調整が必要';
   show(text,'ESTIMATED');
  }catch(error){snapshot=null;show('未算出（能力・用具・校正の入力を確認）','UNAVAILABLE');}
 }
 const schedule=()=>{if(!queued){queued=true;queueMicrotask(()=>{queued=false;refresh();});}};
 for(const event of ['input','change','kneekura:maker-roster-change','kneekura:maker-validation-change','kneekura:swing-preview-source-change'])
  document.addEventListener(event,schedule);
 root.KneekuraBatCapacityMakerV121=Object.freeze({refresh,inspect:()=>snapshot?JSON.parse(JSON.stringify(snapshot)):null});
 refresh();
})(globalThis);
