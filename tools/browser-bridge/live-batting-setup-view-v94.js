/* Read-only geometry from the same Core resolver as the pitch and Host. */
(function(root){
 'use strict';
 const cache=new WeakMap();
 function resolveBatter(batter){
  if(!batter||typeof batter!=='object')throw Error('打者の姿勢とゾーンを表示する選手がありません。');
  const physical=batter.physical??{},heightMeters=batter.heightMeters??batter.height,bats=batter.bats??batter.hand??'R',
   prior=cache.get(batter),setup=physical.battingSetupV94,contact=physical.contactDepthMeters;
  if(prior&&prior.height===heightMeters&&prior.bats===bats&&prior.setup===setup&&prior.contact===contact)return prior.value;
  const value=root.KneekuraNativeMatchCore.resolveLiveBattingSetupV94({heightMeters,bats,
   ...(setup===undefined?{}:{battingSetupV94:setup}),...(contact===undefined?{}:{contactDepthMeters:contact})});
  cache.set(batter,{height:heightMeters,bats,setup,contact,value});return value;
 }
 function observed(world){return world.liveBattingSetupV94??resolveBatter(world.batter);}
 root.KneekuraBattingSetupViewV94=Object.freeze({version:94,resolveBatter,observed});
})(globalThis);
