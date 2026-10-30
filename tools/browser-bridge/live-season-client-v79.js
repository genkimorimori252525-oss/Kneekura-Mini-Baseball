/* The same validated season reducer backs maker and ordinary offline match. */
(function(root){
 'use strict';
 function create({core,storageKey,initial}){
  if(!core||typeof storageKey!=='string'||!storageKey)throw Error('シーズン保存先が不正です。');
  let state=core.validateLiveSeasonStoreV79(initial??core.createLiveSeasonStoreV79());const listeners=new Set();
  const copy=()=>root.structuredClone(state);
  function publish(next,reason){
   state=core.validateLiveSeasonStoreV79(next);
   for(const listener of listeners){try{listener(copy(),reason);}catch(error){root.console?.error('Season view update failed',error);}}
   return copy();
  }
  return Object.freeze({getState:copy,validateState:raw=>core.validateLiveSeasonStoreV79(raw),
   replaceValidated:raw=>publish(raw,'import'),
   command:command=>publish(core.reduceLiveSeasonStoreV79({store:state,command}),'command'),
   subscribe:listener=>{if(typeof listener!=='function')throw Error('シーズンの更新通知が不正です。');listeners.add(listener);return ()=>listeners.delete(listener);},
   saveLocal:()=>{root.localStorage.setItem(storageKey,JSON.stringify(state));return copy();},
   restoreLocal:()=>{const raw=root.localStorage.getItem(storageKey);if(raw===null)throw Error('この端末には保存したシーズンがありません。');return publish(JSON.parse(raw),'restore');}});
 }
 root.KneekuraSeasonClientV79=Object.freeze({version:1,create});
})(globalThis);
