// Read back a child diagnostic; this is not an independent simulation run.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const dir='docs/verification/releases/v113/seam-command-1/',sha=b=>createHash('sha256').update(b).digest('hex'),
 json=p=>JSON.parse(readFileSync(p,'utf8')),report=json(dir+'report.json'),manifest=json(dir+'manifest.json'),
 files=['report.json','manifest.json','raw-user110.json','public-canonical-effort-fixture-with-seams.json'],
 hashes=Object.fromEntries(files.map(f=>[f,sha(readFileSync(dir+f))]));
assert(report.pass&&report.results.length===2);assert.equal(manifest.coreSha256,sha(readFileSync('dist/native-match-core-browser.js')));
assert.equal(manifest.inputSha256,sha(readFileSync(manifest.inputPath)));
assert.equal(manifest.syntheticPhysicsSourceSha256,sha(readFileSync(manifest.syntheticPhysicsSource)));
assert.equal(manifest.memoryInstrumentationOnly,true);assert.equal(manifest.productSourcesChanged,false);
for(const r of report.results)assert(r.pass&&r.inputUnchanged&&r.end.complete);
const raw=report.results[0],actual=report.results[1];
assert.equal(raw.actualReleaseChecks,'NOT_EXERCISED_NO_RELEASE');assert(raw.counts.meanRelayComparisons>0);
assert.equal(actual.actualReleaseChecks,'EXERCISED');assert.equal(actual.checks.length,1);
assert(actual.counts.fullFinalSolves>0&&actual.counts.fullRefreshAttempts>0);
assert.equal(actual.records.releaseSources.length,actual.checks.length);
for(const c of actual.checks){assert(c.readinessAllow);assert(c.elapsedSeconds>=c.readyAt);
 assert(c.relativeSpeedMps<=c.commandSpeedMps+1e-10&&c.commandSpeedMps<=c.capacitySpeedMps+1e-10);
 assert.equal(c.source.seamScale,1);assert(c.source.materialOrientationPresent);}
const result={pass:true,kind:'PARENT_READBACK_NOT_RESIMULATION',coreSha256:manifest.coreSha256,hashes,
 correctedProvenance:'71c15d/3aed01/7aae75 were child tool chunk IDs, not CCG receipts. Golden fixture provenance originalDirectComparisonReceipt:09455a is also a tool output reference, not a CCG receipt.',
 rawComparisonComplete:true,actualSeamReleaseExercised:true,actualReleaseCount:actual.checks.length};
writeFileSync(dir+'parent-readback.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
