/* Explicit AI/debug input for a new local game; shared Core owns validation. */
(function(root){
 'use strict';let pending=null;
 const copy=v=>JSON.parse(JSON.stringify(v));
 root.KneekuraLiveExecutionV122=Object.freeze({
  setContextJSON(text){const value=JSON.parse(text);if(!value||Array.isArray(value)||typeof value!=='object'
   ||Object.keys(value).some(k=>!['workloadV122','communicationScopeV122','batterKnowledgeV122'].includes(k)))
    throw Error('実行コンテキストには workloadV122 / communicationScopeV122 / batterKnowledgeV122 のみ設定できます。');
   pending=value;return Object.freeze({applies:'NEXT_NEW_GAME',nativeAdmission:false});},
  getContext:()=>copy(pending),clear:()=>{pending=null;},
  decorate:configuration=>pending===null?configuration:{...configuration,...copy(pending)}
 });
})(globalThis);
