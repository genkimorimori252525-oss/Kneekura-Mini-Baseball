import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const out='docs/verification/releases/v107/investigation';await mkdir(out,{recursive:true});
const bundle=await readFile('dist/native-match-core-browser.js','utf8'),request=JSON.parse(await readFile(out+'/maker-v106-rf-ground/report.json','utf8')).request,
 sha=s=>createHash('sha256').update(s).digest('hex'),
 near=bundle.match(/if \(distance6\(perceivedTarget,[^\n]+\)\n\s+anticipated = perceivedTarget;/g);
assert.equal(near?.length,1);
const debugSeam='retentionLoadJ: retention.diagnostics.retentionLoadJ,',
 debug='ballVelocity: incoming.moment.ball.velocity, gloveVelocity: velocityAt(c, time), translationalEnergyJ: retention.diagnostics.translationalEnergyJ, rotationalEnergyJ: retention.diagnostics.rotationalEnergyJ, '+debugSeam;
assert.equal(bundle.split(debugSeam).length,2);
const debugBundle=bundle.replace(debugSeam,debug),variants=[['baseline',debugBundle],
 ['keep-ground-intercept',debugBundle.replace(near[0],near[0].replace('if (distance6(', 'if (perceivedTarget.y > Math.max(gloveRadius, input.physics.ground.radiusM)*1.2 && distance6('))]];
const report={diagnosticOnly:true,productionSourceChanged:false,bundleSha256:sha(bundle),requestSha256:sha(JSON.stringify(request)),cases:[]};
for(const [label,code]of variants){const api=new Function(code+';return KneekuraNativeMatchCore;')(),start=performance.now(),r=api.runFieldPracticeV98(request);
 report.cases.push({label,generationMs:performance.now()-start,field:r.field,rules:r.rules});}
await writeFile(out+'/receive-target-counterfactual.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.cases.map(c=>({label:c.label,end:c.field.end,contacts:c.field.diagnostics.aiTelemetry.contactDiagnostics,
 simultaneous:c.field.diagnostics.simultaneousContacts,facts:c.field.facts.filter(f=>['glove_contact','catch_secured','throw_release'].includes(f.kind))})),null,2));
