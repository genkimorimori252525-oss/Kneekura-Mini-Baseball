import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';

const [commit,output]=process.argv.slice(2),repo='genkimorimori252525-oss/Kneekura-Mini-Baseball',
  branch='jolly/tbd-lad-native-browser-core-2026-10-14',
  sha=bytes=>createHash('sha256').update(bytes).digest('hex'),
  git=args=>execFileSync('git',args),
  api=endpoint=>JSON.parse(execFileSync('C:/Program Files/GitHub CLI/gh.exe',['api',endpoint],{encoding:'utf8'}));
assert(/^[0-9a-f]{40}$/.test(commit??'')&&output,'commit and new output file required');
assert.equal(git(['rev-parse','HEAD']).toString().trim(),commit);
const files=git(['diff-tree','--no-commit-id','--name-only','-r',commit]).toString().trim().split('\n');
assert.equal(files.length,4);assert(files.every(path=>path.startsWith('docs/')&&path.endsWith('.md')));
const pr=api(`repos/${repo}/pulls/380`);
assert.equal(pr.head.repo.full_name,repo);assert.equal(pr.head.ref,branch);assert.equal(pr.head.sha,commit);
const checks=[];
for(const path of files){
  const local=await readFile(path),blob=git(['show',`${commit}:${path}`]),remote=api(`repos/${repo}/contents/${path}?ref=${commit}`),
    content=Buffer.from(remote.content,'base64'),expectedBlob=git(['rev-parse',`${commit}:${path}`]).toString().trim();
  assert.equal(blob.toString(),local.toString().replace(/\r\n/g,'\n'));
  assert.deepEqual(content,blob);assert.equal(remote.sha,expectedBlob);
  checks.push({path,url:remote.html_url,gitBlobSha:remote.sha,bytes:content.length,contentSha256:sha(content),localAdoptedTextExact:true});
}
const result={pass:true,taskId:'MB-20261027-REALISM-DEBUG-PLAN',repository:repo,branch,commit,
  authority:'CURRENT_DESIGN_SNAPSHOT_GITHUB_CONTENT_VERIFICATION_NOT_GOAL_COMPLETION',files:checks,
  githubHeadVerified:true,sourceImplementationCommitted:false,finalDesignMustBeRecheckedAfterRemainingWork:true};
await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({pass:true,commit,fileCount:checks.length,contentVerifiedFromGithub:true}));
