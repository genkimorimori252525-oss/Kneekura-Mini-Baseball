/* Read-only PNG row mapping for the Source crouch. The torso and head keep
 * their original proportions; only the lower-body silhouette folds toward
 * the fixed foot anchor. This is a pixel presentation proxy, not joint IK. */
(function(root){
 'use strict';
 function rowMap({baseline,referenceHeight,heightMeters,crouchMeters,retroScale=.90,hipRatio=.53}){
  if(![baseline,referenceHeight,heightMeters,crouchMeters,retroScale,hipRatio].every(Number.isFinite)
   ||referenceHeight<=0||heightMeters<=0||retroScale<=0||hipRatio<=0||hipRatio>=1||crouchMeters<=0)return null;
  const legs=referenceHeight*hipRatio,delta=Math.min(crouchMeters/heightMeters*referenceHeight/retroScale,legs*.98),
   hip=baseline-legs,fold=(legs-delta)/legs,split=hip+delta;
  return Object.freeze({kind:'SOURCE_CROUCH_LOWER_BODY_PROXY_V105',delta,hip,split,
   map:y=>y<=hip?y+delta:baseline-(baseline-y)*fold,
   unmap:y=>y<=split?y-delta:baseline-(baseline-y)/fold});
 }
 root.KneekuraFielderBodyPresentationV105=Object.freeze({rowMap});
})(typeof globalThis==='object'?globalThis:this);
