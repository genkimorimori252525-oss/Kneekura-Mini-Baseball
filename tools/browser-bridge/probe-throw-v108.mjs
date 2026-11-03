import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const out='docs/verification/releases/v108/investigation';await mkdir(out,{recursive:true});
const bundle=await readFile('dist/native-match-core-browser.js','utf8'),request=JSON.parse(await readFile('docs/demos/field-rf-ground-v107.json','utf8')),
 sha=s=>createHash('sha256').update(s).digest('hex'),
 posture='remainingTransferSeconds: possession.spec.bodyModelV105 ? liveFielderPreparationPostureSecondsV105(possession.spec.bodyModelV105, poseV105(possession, t), at(possession.body, t), point) : 0,\n              handPreparationSeconds: preparation.durationSeconds,',
 replaced='remainingTransferSeconds: 0,\n              handPreparationSeconds: preparation.durationSeconds + (possession.spec.bodyModelV105 ? liveFielderPreparationPostureSecondsV105(possession.spec.bodyModelV105, poseV105(possession, t), at(possession.body, t), point) : 0),',
 risk='-0.25 * Math.sqrt(aggression)';assert.equal(bundle.split(posture).length,2);assert.equal(bundle.split(risk).length,2);
const report={diagnosticOnly:true,productionSourceChanged:false,bundleSha256:sha(bundle),cases:[]};
for(const [label,code,cost]of [['standard',bundle,1],['aggressive',bundle,.65],['posture-time-matches-execution',bundle.replace(posture,replaced),1],['wider-attempt-counterfactual',bundle.replace(risk,'-0.85 * Math.sqrt(aggression)'),1]]){
 const api=new Function(code+';return KneekuraNativeMatchCore;')(),r=structuredClone(request);r.fieldInput.players.find(p=>p.playerId===r.fieldInput.defense.RF).physical.fieldingPursuitCostWeight=cost;
 const start=performance.now(),result=api.runFieldPracticeV98(r),f=result.field;
 report.cases.push({label,generationMs:performance.now()-start,request:r,field:f,rules:result.rules});}
await writeFile(out+'/rf-throw-counterfactual.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.cases.map(c=>({label:c.label,end:c.field.end,outs:c.rules?.match?.outs,
 decisions:c.field.diagnostics.aiTelemetry.holderDecisions.filter((d,i,a)=>i===0||d.state!==a[i-1].state).slice(0,8),
 efforts:c.field.diagnostics.throwEffortCommandsV103,facts:c.field.facts.filter(f=>['throw_release','catch_secured','controlled_base_contact','runner_base_touch'].includes(f.kind))})),null,2));
