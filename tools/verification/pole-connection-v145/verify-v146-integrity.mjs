import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(readFileSync('docs/verification/traits-spin-continuation-v123/source-integrity-v146.json','utf8'));
assert.equal(manifest.taskId,'MB-20261026-TRAITS-SPIN-CONTINUATION-V123');
for(const file of manifest.files){
  assert.ok(!file.path.includes('..')&&!file.path.includes(':')&&!file.path.startsWith('/'));
  const bytes=readFileSync(file.path);assert.equal(bytes.length,file.bytes,file.path);assert.equal(sha(bytes),file.sha256,file.path);
}
assert.ok(process.argv[2],'original user JSON path is required');
assert.equal(sha(readFileSync(process.argv[2])),manifest.originalUserJsonSha256,'original user JSON changed');
console.log(JSON.stringify({taskId:manifest.taskId,sourceFilesChecked:manifest.files.length,originalUserJsonUnchanged:true,
  verificationScope:'FILE_INTEGRITY_ONLY',newNativeDepartureOrBrowserCredit:false}));
