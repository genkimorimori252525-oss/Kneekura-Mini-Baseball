import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const json=p=>JSON.parse(readFileSync(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex'),
 publication=json('docs/verification/releases/v113/publish.json');
assert(publication.pass);assert.equal(publication.rows.length,9);
for(const r of publication.rows)assert.equal(sha(readFileSync(r.destination)),r.sha256);
const snapshot=json(publication.config.candidate+'/build-sources-v113.json');
for(const [p,h]of Object.entries(snapshot.inputs))assert.equal(sha(readFileSync(p)),h,'Source stable '+p);
assert.equal(sha(readFileSync('dist/native-match-core-browser.js')),publication.sourceCoreSha256);
const originalProof=json('docs/verification/releases/v113/publish-config.json');assert(originalProof.receipts.length>=10);
const comment=spawnSync('gh',['api','repos/genkimorimori252525-oss/Kneekura-Mini-Baseball/issues/comments/6372885715'],{encoding:'utf8'});
assert.equal(comment.status,0,comment.stderr);const remote=JSON.parse(comment.stdout);
assert.equal(remote.body.trim(),readFileSync('docs/verification/releases/v113/github-judgment-v113.md','utf8').trim());
const result={pass:true,filesReadBack:publication.rows.length,sourceSnapshotUnchanged:true,
 sourceCoreSha256:publication.sourceCoreSha256,githubDecisionReadBack:remote.html_url,
 sourceCommitPushMergeDeployPerformed:false,sourceNativeChanges:6};
writeFileSync('docs/verification/releases/v113/final-readback.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
