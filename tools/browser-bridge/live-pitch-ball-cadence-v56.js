/* Read-only incoming-pitch observer. The original Source owns every position,
 * velocity and material rotation; this adapter only limits its visible scope. */
(function(root){
 'use strict';
 const vector=p=>({x:p.x,y:p.y,z:p.z}),quaternion=q=>({w:q.w,x:q.x,y:q.y,z:q.z});
 const contract=Object.freeze({version:1,ballKind:'pitch',source:'ORIGINAL_SOURCE_MATERIAL_HISTORY',
  readOnly:true,interpolated:false,reanchored:false});
 function create(core){
  if(typeof core?.createSourceBallMaterialHistoryV1!=='function')throw Error('pitch ball cadence: original Source observer required');
  const cache=new WeakMap();
  function sample(record,physicalElapsedSeconds){
   if(!Number.isFinite(physicalElapsedSeconds)||physicalElapsedSeconds<0||!record||typeof record!=='object')return null;
   const frames=record.frames,d=record.play?.diagnostics,tps=d?.sourceClockTicksPerSecond,first=frames?.[0];
   if(!Array.isArray(frames)||!frames.length||!Number.isSafeInteger(tps)||tps<=0||!Number.isFinite(first?.tick))return null;
   const atTick=first.tick+physicalElapsedSeconds*tps;
   if(!Number.isFinite(atTick)||atTick>frames[frames.length-1].tick)return null;
   // Only clocks are read ahead. In particular, a future field/throw payload
   // is never consulted, and a same-tick successor wins over its pitch frame.
   let lo=0,hi=frames.length-1;
   while(lo<hi){const middle=Math.ceil((lo+hi)/2);if(frames[middle].tick<=atTick)lo=middle;else hi=middle-1;}
   const frame=frames[lo];
   if(frame.tick>atTick||frame.phase!=='pitch'||frame.ballKind!=='pitch')return null;
   const ball=frame.ball;
   if(!ball||ball.visible!==true
    ||frame.possessedBy||ball.possessedBy||ball.custody)return null;
   let entry=cache.get(record);
   if(!entry){
    const descriptor=d.sourceDescriptor,initial=descriptor?.initial,orientation=first.ball?.orientation;
    if(descriptor?.kind!=='aero_ground_continuous_source_kernel_v2'||!Number.isFinite(initial?.elapsedSeconds)
     ||!Number.isFinite(descriptor.throughElapsedSeconds)||!orientation)return null;
    // The free-pitch Source ends at bat/glove first contact, before the
    // catcher's finite retention constraint or any outgoing batted Source.
    const contact=record.play.contactMoment?.elapsedSeconds,catcher=d.catcherContactElapsedSeconds,
     cuts=[descriptor.throughElapsedSeconds,...(Number.isFinite(contact)?[contact]:[]),...(Number.isFinite(catcher)?[catcher]:[])],
     through=Math.min(...cuts);
    if(through<initial.elapsedSeconds)return null;
    entry={from:initial.elapsedSeconds,through,contactCut:Number.isFinite(contact)&&through===contact
      ||Number.isFinite(catcher)&&through===catcher,
     observer:core.createSourceBallMaterialHistoryV1({initialMaterialOrientation:quaternion(orientation),
      spans:[{descriptor,throughElapsedSeconds:through,side:'incoming'}]})};
    cache.set(record,entry);
   }
   const seconds=entry.from+physicalElapsedSeconds;
   if(seconds>entry.through||entry.contactCut&&seconds>=entry.through)return null;
   const observed=entry.observer.evaluateAt(seconds,'incoming');
   // Own copies prevent a renderer from mutating frozen Source observations
   // or contaminating a later seek/rewind result.
   return {position:vector(observed.moment.ball.position),velocity:vector(observed.moment.ball.velocity),
    orientation:quaternion(observed.orientation),visible:true,sourceObservation:true,ballKind:'pitch'};
  }
  return Object.freeze({sample,inspect:()=>contract});
 }
 root.KneekuraPitchBallCadence=Object.freeze({version:1,create});
})(typeof globalThis==='object'?globalThis:this);
