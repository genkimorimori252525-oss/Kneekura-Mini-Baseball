import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const json=async p=>JSON.parse(await readFile(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex'),
 out='docs/verification/releases/v116',published=await json(out+'/publish.json'),config=published.config,
 snapshot=await json(resolve(config.candidate,'build-sources-v116.json')),
 comment=JSON.parse(execFileSync('gh',['api','repos/genkimorimori252525-oss/Kneekura-Mini-Baseball/issues/comments/6382611806'],{encoding:'utf8'})),
 expected=await readFile(out+'/github-summary.md','utf8');
assert(published.pass&&published.releaseVersion===116&&published.originalsPreserved);
for(const r of published.rows){assert.equal(sha(await readFile(r.destination)),r.sha256);assert.equal(sha(await readFile(r.source)),r.sha256);}
for(const [p,h]of Object.entries(snapshot.inputs))assert.equal(sha(await readFile(p)),h,'captured input '+p);
assert.equal(comment.html_url,'https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/380#issuecomment-6382611806');
assert.equal(comment.body.trimEnd(),expected.trimEnd(),'public decision readback differs');
const nine=await json(resolve(config.nine,'report.json'));
assert(nine.pass&&nine.finished&&nine.sourceCoreSha256===published.sourceCoreSha256);
const report={pass:true,releaseVersion:116,files:published.rows.length,sourceInputs:Object.keys(snapshot.inputs).length,
 sourceCoreSha256:published.sourceCoreSha256,githubComment:comment.html_url,
 githubBodySha256:sha(Buffer.from(comment.body.trimEnd())),pitches:nine.pitches,fieldPlays:nine.fieldPlays};
await writeFile(out+'/final-readback.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
