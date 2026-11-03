import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
/** Focused edits over the frozen presentation. World decisions remain in Core. */
export async function applyRulesPresentationV94(input){
 let game=input;const once=(from,to)=>{const choices=[from,from.replaceAll('\n','\r\n')].filter((v,i,a)=>a.indexOf(v)===i),found=choices.filter(v=>game.includes(v));assert.equal(found.length,1,from.slice(0,100));assert.equal(game.split(found[0]).length,2);game=game.replace(found[0],()=>to);};
 const setup=await readFile('tools/browser-bridge/live-batting-setup-view-v94.js','utf8'),oldCamera=await readFile('tools/browser-bridge/live-camera-tuning-batter-view-v66.js','utf8'),camera=await readFile('tools/browser-bridge/live-camera-tuning-batter-view-v94.js','utf8');
 assert(!/<\/script/i.test(setup+camera));once(oldCamera,setup+'\n'+camera);
 // Preserve the effective per-player setup in the world, not only the temporary
 // object passed to the camera controller. Ready frames have no pitch diagnostics.
 once("playerById=Object.fromEntries(Object.values(data.players).map(player=>[player.id,{...player,\n   height:players.find(configured=>configured.playerId===player.id)?.heightMeters??player.height,throws:players.find(configured=>configured.playerId===player.id)?.throws??player.throws}]));",
 `playerById=Object.fromEntries(Object.values(data.players).map(player=>{const configured=players.find(candidate=>candidate.playerId===player.id);return[player.id,{...player,
   height:configured?.heightMeters??player.height,hand:configured?.bats??player.hand,throws:configured?.throws??player.throws,physical:configured?.physical}];}));`);
 once("const world={liveObservation:true,livePark:state.fenceGeometry,", "const world={liveObservation:true,liveBattingSetupV94:result?.play.diagnostics.battingSetupV94??window.KneekuraBattingSetupViewV94.resolveBatter(batter),livePark:state.fenceGeometry,");
 const oldChart=await readFile('tools/browser-bridge/live-pitch-chart-v78.js','utf8'),chart=await readFile('tools/browser-bridge/live-pitch-chart-v94.js','utf8');
 assert(!/<\/script/i.test(chart));once(oldChart,chart);
 once("batterHeightMeters:batter.height,selectedPitchId:selectedMark", "batterHeightMeters:batter.height,battingSetupV94:result?.play.diagnostics.battingSetupV94??window.KneekuraBattingSetupViewV94.resolveBatter(batter),selectedPitchId:selectedMark");
 once("  const w=.4318/2,y0=observed.batter.height*.270,y1=observed.batter.height*.535,z=observed.liveObservation?.15:0;\n  zoneCorners=[{x:-w,y:y1,z},{x:w,y:y1,z},{x:w,y:y0,z},{x:-w,y:y0,z}].map(project);if(zoneCorners.some(p=>!p))return;\n  const ballCells=[...rasterCells.values()].filter(c=>c.owner==='ball'),cells=new Map();\n  for(let i=0;i<4;i++){\n   const a=zoneCorners[i],b=zoneCorners[(i+1)%4],d=Math.hypot(a.x-b.x,a.y-b.y),n=Math.ceil(d/gridV84.step());",
 `  const setup=observed.liveObservation?window.KneekuraBattingSetupViewV94.observed(observed):null,
   w=setup?.region.halfWidth??.4318/2,y0=setup?.region.lowerY??observed.batter.height*.270,y1=setup?.region.upperY??observed.batter.height*.535,z=setup?.plateFrontZ??0;
  zoneCorners=[{x:-w,y:y1,z},{x:w,y:y1,z},{x:w,y:y0,z},{x:-w,y:y0,z}].map(project);if(zoneCorners.some(p=>!p))return;
  const ballCells=[...rasterCells.values()].filter(c=>c.owner==='ball'),cells=new Map(),edges=[];
  if(setup){const polygon=setup.volume.platePolygon,lower=polygon.map(p=>project({...p,y:y0})),upper=polygon.map(p=>project({...p,y:y1}));
   for(let i=0;i<polygon.length;i++){const j=(i+1)%polygon.length;edges.push([lower[i],lower[j]],[upper[i],upper[j]],[lower[i],upper[i]]);}}
  else for(let i=0;i<4;i++)edges.push([zoneCorners[i],zoneCorners[(i+1)%4]]);
  for(const [a,b]of edges){
   if(!a||!b)continue;const d=Math.hypot(a.x-b.x,a.y-b.y),n=Math.max(1,Math.ceil(d/gridV84.step()));`);
 once("zonePlaneZ:observed.liveObservation?.15:0,custody:","zonePlaneZ:observed.liveObservation?window.KneekuraBattingSetupViewV94.observed(observed).plateFrontZ:0,strikeZoneVolumeV94:observed.liveObservation?window.KneekuraBattingSetupViewV94.observed(observed).volume:null,battingSetupV94:observed.liveObservation?window.KneekuraBattingSetupViewV94.observed(observed):null,custody:");
 // Ready/non-record frames use the same initial eye as the continuous controller.
 once("const base={eye:{x:-.4*s,y:Math.max(1.15,observed.batter.height*.77),z:-.95},yaw:Math.atan2(.4*s,19.4),pitch:.08,f:400,cx:300,cy:110,labelMetres:.55};",
 "const battingOffsetV94=window.KneekuraBattingSetupViewV94.resolveBatter(observed.batter).cameraOffsetZ,base={eye:{x:-.4*s,y:Math.max(1.15,observed.batter.height*.77),z:-.95+battingOffsetV94},yaw:Math.atan2(.4*s,19.4-battingOffsetV94),pitch:.08,f:400,cx:300,cy:110,labelMetres:.55};");
 return game;
}
