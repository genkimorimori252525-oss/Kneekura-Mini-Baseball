/* Read-only wording of accepted Core facts. This does not score hits/errors,
 * change a count or decide a play. Consumers retain their observation-time
 * gate: full descriptions become available at rules.endedAtTick. */
(function(root){
 'use strict';
 const baseNames={1:'一塁',2:'二塁',3:'三塁',4:'本塁'};
 const fixed={single:['ヒット（単打）','hit'],double:['二塁打','hit'],triple:['三塁打','hit'],
  home_run:['ホームラン','hit'],walk:['四球','ball'],hit_by_pitch:['死球','ball'],
  strikeout:['三振','out'],foul:['ファウル','strike'],fly_out:['フライアウト','out'],
  foul_out:['ファウルフライアウト','out'],ground_rule_double:['二塁の安全進塁権','in-play'],
  ground_out:['ゴロアウト','out'],field_out:['アウト','out']};
 function describe(record){
  if(!record?.play||!record.beforeMatch||!record.match)throw new Error('Live play description requires an issued Core record');
  const play=record.play,rules=play.rules,classification=play.classification,ended=rules.endedAtTick,
   facts=play.field?.ruleFacts,batterId=record.batterPlayerId,
   outcomes=[...rules.outcomes].filter(out=>out.tick<=ended).sort((a,b)=>a.tick-b.tick),
   batterOut=outcomes.find(out=>out.runnerId===batterId)??null;
  const touches=(facts?.runnerTouches??[]).filter(touch=>touch.runnerId===batterId&&touch.tick<=ended&&(!batterOut||touch.tick<=batterOut.tick));
  const scored=rules.scoredRunnerIds??[],batterScored=scored.includes(batterId),
   bases=record.match.bases,finalBase=batterScored?4:batterOut?null:
    bases.first===batterId?1:bases.second===batterId?2:bases.third===batterId?3:null,
   baseReached=Math.max(0,...touches.map(touch=>touch.base),finalBase??0),
   playOuts=outcomes.length,outsBefore=record.beforeMatch.outs,outsAfter=Math.min(3,outsBefore+playOuts),thirdOut=outsBefore+playOuts>=3;
  const outReasons=outcomes.map(out=>{
   const batter=out.runnerId===batterId;
   let base=null,label,shortLabel;
   if(out.cause==='fly_catch'){
    label=facts?.territory==='foul'?'ファウルフライアウト':'フライアウト';shortLabel='飛球捕球';
   }else if(out.cause==='tag_up_appeal'){label='飛球の早離塁アピールアウト';shortLabel='早離塁アピール';}
   else if(out.cause==='pitch_count'){label='三振';shortLabel=label;}
   else if(out.cause==='runner_tag'){
    label=batter?'打者走者タッチアウト':'走者タッチアウト';shortLabel=batter?'打者走者タッチ':'走者タッチ';
   }else if(out.cause==='base_control'){
    const candidates=[...new Set((facts?.controlledBaseContacts??[])
     .filter(contact=>contact.tick===out.tick&&contact.defenderId===out.defenderId).map(contact=>contact.base))];
    base=candidates.length===1?candidates[0]:null;
    if(batter&&base===1){
     label=facts?.firstGroundContactTick!=null&&facts.firstGroundContactTick<=out.tick?'ゴロアウト（一塁）':'一塁アウト';shortLabel='一塁';
    }else {label=base?baseNames[base]+'フォースアウト':'フォースアウト';shortLabel=base?baseNames[base]:'封殺';}
   }else {label=batter?'打者走者アウト':'走者アウト';shortLabel=label;}
   return {runnerId:out.runnerId,defenderId:out.defenderId,cause:out.cause,classification:out.classification,
    tick:out.tick,base,label,shortLabel};
  });
  let label,category;
  if(classification==='count'){
   label={ball:'ボール',called_strike:'見逃し',swinging_strike:'空振り'}[play.call]??'カウント判定';
   category=play.call==='ball'?'ball':'strike';
  }else if(playOuts>=2){
   label=(playOuts===2?'併殺':'三重殺')+'（'+outReasons.map(out=>out.shortLabel).join('→')+'）';category='out';
  }else if(fixed[classification]){
   [label,category]=fixed[classification];
  }else if(classification==='live_ball'){
   if(batterOut){label=outReasons.find(out=>out.runnerId===batterId).label;category='out';}
   else{
    label=batterScored?'本塁生還':baseReached===1?'一塁出塁':baseReached===2?'二塁到達':baseReached===3?'三塁到達':
     baseReached===4?'本塁到達（得点不成立）':'到達塁は未記録';
    if(playOuts)label+='・'+outReasons.map(out=>out.label).join('・');
    category=playOuts?'out':'in-play';
   }
  }else {label='判定情報なし';category='unknown';}
  const officialHit={single:'single',double:'double',triple:'triple',home_run:'home_run'}[classification]??null;
  return {label,category,classification,availableAtTick:ended,playOuts,outsBefore,outsAfter,thirdOut,
   thirdOutAtTick:thirdOut?outcomes.at(-1)?.tick??null:null,
   batter:{playerId:batterId,out:!!batterOut,outAtTick:batterOut?.tick??null,baseReached,finalBase,scored:batterScored},
   outReasons,runCount:new Set(scored).size,
   scoring:{officialHit,officialError:null,basis:officialHit?'EXPLICIT_CORE_CLASSIFICATION':'HIT_ERROR_SCORING_NOT_PROVIDED'}};
 }
 root.KneekuraLivePlayDescription=Object.freeze({version:1,describe});
})(typeof globalThis==='object'?globalThis:this);
