import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
assert.equal(process.versions.node.split('.')[0],'24');
const sha=b=>createHash('sha256').update(b).digest('hex'),bytes=readFileSync('dist/native-match-core-browser.js'),
 expected='3d0ef3a2477816a3157e59f9a8235e1459913fa35f74f791541c8cee8e885a37';assert.equal(sha(bytes),expected);
const out=resolve(process.argv[2]);assert(out.startsWith(resolve('docs/verification/releases/v114/runner-estimator-')));mkdirSync(dirname(out),{recursive:true});mkdirSync(out);
const marker='return __toCommonJS(browser_exports);',calls=[],transferCalls=[],preparations=[];let code=bytes.toString('utf8');assert.equal(code.split(marker).length,2);
code=code.replace(marker,`const originalTransfer=planLiveTransferActionV110;planLiveTransferActionV110=(...args)=>{const result=originalTransfer(...args);recordTransfer(args,result);return result;};const originalPreparation=createLiveBodyHandPreparationV105;createLiveBodyHandPreparationV105=(...args)=>{const result=originalPreparation(...args);recordPreparation(args,result);return result;};const originalPlan=planLiveThrowV1;planLiveThrowV1=(input)=>{const result=originalPlan(input);record(input,result);return result;};return {estimate:estimateLiveDefenseControlV95};`);
const record=(input,result)=>calls.push({releasePosition:input.releasePosition,target:input.target,capacity:input.maximumThrowSpeedMps,effort:input.effortSelectionV103,
 kind:result.kind,flight:result.flightSeconds,relativeSpeed:result.relativeReleaseSpeedMps,diagnostics:result.diagnostics}),recordTransfer=(args,result)=>transferCalls.push({normalPreparationAvailable:args[3],capacityMps:args[0].capacityMps,releasePosition:args[0].releasePosition,target:args[0].target,gloveToss:args[1]?.gloveTossV110,kind:result.kind,reason:result.reason}),
 recordPreparation=(args,result)=>preparations.push({initialOffset:args[0].initialOffset,initialRelativeVelocity:args[0].initialRelativeVelocity,targetOffset:args[0].targetOffset,maximumRelativeSpeedMps:args[0].maximumRelativeSpeedMps,maximumReachMeters:args[0].maximumReachMeters,kind:result.kind,reason:result.reason}),
 api=new Function('record','recordTransfer','recordPreparation',code+';return KneekuraNativeMatchCore;')(record,recordTransfer,recordPreparation),rows=[];
for(const name of ['deep','middle']){
 const report=JSON.parse(readFileSync('docs/verification/releases/v114/runner-observation-1/'+name+'.json','utf8')),
 physics=JSON.parse(readFileSync(report.inputPath,'utf8')).input.physics,
 advance=report.runnerDecisions.find(d=>d.runnerId==='runner-2'&&d.advance),
 selected=[report.estimates.find(e=>e.nowSeconds===advance.elapsedSeconds&&e.target.base===3)];
 if(name==='deep'){const extension=report.runnerMotions.find(m=>m.runnerId==='runner-2'&&m.throughBases.includes(4));selected.push(report.estimates.find(e=>e.nowSeconds===extension.elapsedSeconds&&e.target.base===4));}
 for(const observed of selected)for(const [label,limits]of [['default',undefined],['three-relays',{maximumRelays:3,maximumAeroSolves:12}]]){
  calls.length=0;transferCalls.length=0;preparations.length=0;const input={...observed,physics,result:undefined,...(limits?{limits}:{})};delete input.result;
  const began=performance.now(),result=api.estimate(input);rows.push({name,target:input.target.base,time:input.nowSeconds,label,result,calls:structuredClone(calls),transferCalls:structuredClone(transferCalls),preparations:structuredClone(preparations),wallMs:performance.now()-began});
 }
}
assert.equal(sha(readFileSync('dist/native-match-core-browser.js')),expected);
writeFileSync(resolve(out,'report.json'),JSON.stringify({coreSha256:expected,rows,sourceEdits:false,actualSimulationsRun:0},null,2)+'\n');
console.log(JSON.stringify(rows.map(r=>({name:r.name,target:r.target,time:r.time,label:r.label,kind:r.result.kind,route:r.result.route,control:r.result.controlSeconds,unknown:r.result.diagnostics.unknownReason,legs:r.result.legs.map(l=>({from:l.throwerPlayerId,to:l.receiverPlayerId,flight:l.flightSeconds,release:l.releaseDelaySeconds})),transferCalls:r.transferCalls,preparations:r.preparations.filter(p=>p.kind!=='planned'),calls:r.calls.map(c=>({kind:c.kind,capacity:c.capacity,flight:c.flight,relativeSpeed:c.relativeSpeed,bestSpeed:c.diagnostics.bestCandidateRelativeReleaseSpeedMps,evals:c.diagnostics.solverEvaluationCount})),wallMs:r.wallMs}))));
