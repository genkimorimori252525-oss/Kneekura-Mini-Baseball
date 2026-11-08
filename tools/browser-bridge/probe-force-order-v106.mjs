import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const out='docs/verification/releases/v106/investigation';await mkdir(out,{recursive:true});
const bundle=await readFile('dist/native-match-core-browser.js','utf8'),request=JSON.parse(await readFile(out+'/maker-v105-second-force/report.json','utf8')).request,
  sha=s=>createHash('sha256').update(s).digest('hex'),
  seam='candidates.find((candidate) => !candidate.containment && candidate.margin > 0)',
  altered='candidates.find((candidate) => candidate.forced && candidate.base === 2 && candidate.margin > 0) ?? '+seam;
assert.equal(bundle.split(seam).length,2,'one diagnostic decision seam');
const report={diagnosticOnly:true,productionSourceChanged:false,sourceBundleSha256:sha(bundle),conditionsUnchanged:request.fieldInput,cases:[]};
for(const [label,code]of [['current',bundle],['second-first-counterfactual',bundle.replace(seam,altered)]]){
  const api=new Function(code+';return KneekuraNativeMatchCore;')(),start=performance.now(),r=api.runFieldPracticeV98(request);
  report.cases.push({label,generationMs:performance.now()-start,end:r.field.end,facts:r.field.facts,
    rules:r.rules,holderDecisions:r.field.diagnostics.aiTelemetry.holderDecisions,handPreparations:r.field.diagnostics.handPreparationProofs,
    throwDecisions:r.field.diagnostics.throwDecisions,bodyGeometry:r.field.diagnostics.bodyGeometryV105,
    frames:r.field.frames,receiveTiming:r.field.diagnostics.aiTelemetry.receiveTimingV99??r.field.diagnostics.aiTelemetry.receiveTiming,
    effortCommands:r.field.diagnostics.throwEffortCommandsV103});
}
await writeFile(out+'/force-order-counterfactual.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.cases.map(c=>({label:c.label,end:c.end,facts:c.facts.filter(f=>['throw_release','catch_secured','controlled_base_contact','controlled_runner_tag','runner_base_touch'].includes(f.kind))})),null,2));
