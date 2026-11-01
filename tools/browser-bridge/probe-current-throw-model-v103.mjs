import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {build} from 'esbuild';
import vm from 'node:vm';
const output=resolve(process.argv[2]??'docs/verification/releases/v103-investigation/current-throw-model.json');
const paths={abilities:'src/integration/browser/LivePublicAbilitiesV1.ts',throw:'src/core/sim/fielding/LiveThrowPlanV1.ts',aero:'src/core/sim/ball/BaseballAerodynamics.ts'};
const built=await build({stdin:{contents:`import * as abilities from ${JSON.stringify(resolve(paths.abilities))};
import {planLiveThrowV1} from ${JSON.stringify(resolve(paths.throw))};
import {REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS as aerodynamics} from ${JSON.stringify(resolve(paths.aero))};
globalThis.probe={...abilities,planLiveThrowV1,aerodynamics};`,resolveDir:process.cwd(),loader:'ts'},write:false,bundle:true,platform:'browser',format:'iife',target:'es2022'});
// Keep caller and exported functions in one realm: Core intentionally rejects
// foreign-prototype objects rather than weakening its inert-input validation.
vm.runInThisContext(built.outputFiles[0].text);const api=globalThis.probe;delete globalThis.probe;
const reference=JSON.parse(await readFile('docs/demos/live-public-ability-reference-v1.json','utf8')),
 original=JSON.parse(await readFile('docs/demos/live-game-roster-v2.json','utf8')),before=JSON.stringify(original),roster=api.materializeLivePlateVisionV1({roster:original,reference}).roster;
const authored999=roster.entries.map(entry=>{const changed=api.editLivePublicAbilityV1({roster,reference,playerId:entry.playerId,abilityId:'arm',value:999});
 const speed=changed.roster.entries.find(e=>e.playerId===entry.playerId).physical.throwSpeedMps;
 return {playerId:entry.playerId,requestedRating:999,projectedRating:changed.projection.abilities.find(a=>a.id==='arm').value,capacityMps:speed};});
const input=distance=>({releasePosition:{x:0,y:1,z:0},bodyVelocity:{x:0,y:0,z:0},maximumThrowSpeedMps:34,spin:{x:120,y:0,z:0},target:{x:0,y:1,z:distance},
 physics:{kind:'aero_ground_v1',air:{ticksPerSecond:1e6,integrationStepTicks:5000,gravityY:-9.81,aerodynamics:api.aerodynamics},
 ground:{ticksPerSecond:1e6,gravityMps2:9.81,radiusM:.0366,inertiaRatio:.378,restingVerticalSpeedMps:.2,material:{restitution:.48,slidingFriction:.24,rollingDecelerationMps2:.36,normalSpinDecayPerSecond:.18}}}});
const baseline=[20,70].map(distance=>{const result=api.planLiveThrowV1(input(distance));assert.equal(result.kind,'planned');return {distanceMeters:distance,maximumCapacityMps:34,
 relativeReleaseSpeedMps:result.relativeReleaseSpeedMps,flightSeconds:result.flightSeconds,diagnostics:result.diagnostics};});
let rejected=null;try{api.planLiveThrowV1({...input(20),maximumThrowSpeedMps:authored999[0].capacityMps});}catch(e){rejected=String(e.message);}
assert.match(rejected,/finite throw command/);assert(authored999.every(a=>a.capacityMps>120&&Math.abs(a.projectedRating-999)<1e-9));assert.equal(JSON.stringify(original),before);
await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify({investigationCompleted:true,productFixImplemented:false,
 fixtureBasis:'Legacy reference/v2 roster used only to reproduce authoring-to-solver mismatch; not the current MLB mean',authored999,baseline,
 raw999CapacityRejectedByCurrentSolver:rejected,inputRosterUnchanged:true,sourceBuiltInMemoryOnly:true},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({investigationCompleted:true,productFixImplemented:false,playersAccepting999:authored999.length,allRawCapacitiesRejectedAbove120:true,baseline:baseline.map(({diagnostics,...row})=>row),output}));
