/** Read-only display view; the original wrapper must be sent intact to Host/Worker. */
function readMatchContinuation(continuation) {
 if(!continuation||typeof continuation!=='object'||Array.isArray(continuation))throw Error('continuation view HOLD: invalid continuation');
 let inner;
 if(continuation.version==='live_match_continuation_v116')inner=continuation;
 else if(continuation.version==='match_experimental_continuation_v1'||continuation.version==='match_experimental_continuation_v2'){
  const isV2=continuation.version==='match_experimental_continuation_v2',keys=isV2?'generalLoose|robinAuto|robinSource':'generalLoose|robinAuto';
  if(Object.keys(continuation).sort().join('|')!=='inner|policies|version'||!continuation.policies||Object.keys(continuation.policies).sort().join('|')!==keys)throw Error('continuation view HOLD: invalid wrapper');
  const {robinSource=null,robinAuto,generalLoose}=continuation.policies;
  if((robinAuto!==null&&robinAuto?.version!=='robin_original_auto_v1')||(generalLoose!==null&&generalLoose?.version!=='general_loose_policy_v1')||(isV2&&robinSource!==null&&robinSource?.version!=='robin_original_source_v1')||(isV2&&robinAuto!==null&&robinSource===null)||(isV2?!robinSource&&!generalLoose:!robinAuto&&!generalLoose))throw Error('continuation view HOLD: unsupported policy');
  inner=continuation.inner;
 }else throw Error('continuation view HOLD: unsupported version');
 if(!inner||inner.version!=='live_match_continuation_v116'||!Number.isSafeInteger(inner.pitchCount)||inner.pitchCount<0||!Number.isSafeInteger(inner.nextTick)||inner.nextTick<0||!inner.match||typeof inner.match!=='object'||Array.isArray(inner.match))throw Error('continuation view HOLD: invalid inner state');
 const match=structuredClone(inner.match);
 function deepFreeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(deepFreeze);Object.freeze(value)}return value}
 return Object.freeze({version:continuation.version,pitchCount:inner.pitchCount,nextTick:inner.nextTick,match:deepFreeze(match)});
}

