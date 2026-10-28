import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';

const [commit,output]=process.argv.slice(2),repo='genkimorimori252525-oss/Kneekura-Mini-Baseball',
  branch='jolly/tbd-lad-native-browser-core-2026-10-14',
  git=args=>execFileSync('git',args),
  api=path=>JSON.parse(execFileSync('C:/Program Files/GitHub CLI/gh.exe',['api',path],{encoding:'utf8'})),
  sha=bytes=>createHash('sha256').update(bytes).digest('hex');
assert(/^[0-9a-f]{40}$/.test(commit??'')&&output,'commit and new output path required');
assert.equal(git(['rev-parse','HEAD']).toString().trim(),commit);
assert.equal(git(['remote','get-url','origin']).toString().trim(),'https://github.com/'+repo+'.git');
const files=git(['diff-tree','--no-commit-id','--name-only','-r',commit]).toString().trim().split('\n');
assert(files.length>0&&files.every(path=>/^docs\/.*\.md$/.test(path)
  ||/^src\/host\/world\/(?:NativeMeasuredBattingContactV182|NativeMeasuredOriginalPitchContactV183|NativeMeasuredInitialJointContactV184|NativeMeasuredBattingContactCollectionV185|NativeMeasuredContactCalendarV186)(?:\.test)?\.ts$/.test(path)
  ||/^src\/host\/world\/(?:SqliteDomesticScheduleStore|WorldBoundDomesticSeasonRuntime|SqliteDomesticSeasonAdvanceStore|DomesticCalendarOriginV186\.test)\.ts$/.test(path)
  ||/^src\/host\/world\/(?:(?:OfficialPitchWorkloadFixtures|ContinuousPitchFixtures|PhysicalPlateAppearanceActorFixtures|OriginalBattingIntentFixtures|WorldBoundOriginalContactV187)\.test-support|WorldBoundOriginalContactV187\.test)\.ts$/.test(path)
  ||/^src\/host\/world\/(?:NativeBattingContactInventoryV188|SqliteNativeBattingContactObservationStoreV188)(?:\.test)?\.ts$/.test(path)
  ||/^src\/host\/world\/(?:NativeBattingContactObservationSnapshotV189\.test|NativeBattingContactTraitProjectionV189(?:\.test)?)\.ts$/.test(path)
  ||/^src\/host\/world\/WorldBoundOriginalContactsV190\.(?:test-support|test)\.ts$/.test(path)
  ||/^src\/host\/world\/NativeLineDriveFlightV191\.test-support\.ts$/.test(path)
  ||/^src\/integration\/traits\/ContactDescriptorReportV191(?:\.test)?\.ts$/.test(path)
  ||path==='tools/browser-bridge/check-maker-contact-descriptor-v191.mjs'
  ||/^tools\/(?:native-contact-report-v192(?:\.test)?\.mjs|native-contact-report-runtime-v192(?:\.test)?\.ts)$/.test(path)
  ||path==='tools/verification/check-native-contact-report-cli-v192.mjs'
  ||/^src\/core\/world\/competition\/WorldCalendarDate(?:\.test)?\.ts$/.test(path)
  ||/^tools\/verification\/(?:(?:check-native-measured-contact|verify-github-change)-v182\.mjs|native-measurement-probe-support-v183(?:\.test)?\.mjs|native-original-contact-case-v183\.ts|check-native-original-contact-v183\.mjs|(?:prepare|check)-native-initial-joint-contact-v184\.mjs|check-native-contact-collection-v185\.mjs|check-native-contact-calendar-v186\.mjs|native-contact-calendar-case-v187\.ts|check-native-contact-calendar-v187\.mjs|native-contact-observation-case-v188\.ts|check-native-contact-observation-v188\.mjs|native-contact-trait-projection-case-v189\.ts|check-native-contact-trait-projection-v189\.mjs|native-two-day-contact-case-v190\.ts|check-native-two-day-contact-v190\.mjs|native-line-drive-flight-case-v191\.ts|check-native-line-drive-flight-v191\.mjs)$/.test(path)),
  'only the explicitly owned source/tests/verifiers and Markdown may be published');
const head=api(`repos/${repo}/git/ref/heads/${branch}`);assert.equal(head.object.sha,commit);
const pr=api(`repos/${repo}/pulls/380`);assert.equal(pr.head.repo.full_name,repo);assert.equal(pr.head.ref,branch);
const verified=[];
for(const path of files){
  const blob=git(['show',`${commit}:${path}`]),local=await readFile(path),
    remote=api(`repos/${repo}/contents/${path}?ref=${commit}`),content=Buffer.from(remote.content,'base64'),
    blobSha=git(['rev-parse',`${commit}:${path}`]).toString().trim();
  assert.equal(local.toString('utf8').replace(/\r\n/g,'\n'),blob.toString('utf8'));
  assert.deepEqual(content,blob);assert.equal(remote.sha,blobSha);
  verified.push({path,url:remote.html_url,gitBlobSha:blobSha,bytes:blob.length,contentSha256:sha(blob),localAdoptedTextExact:true});
}
const result={pass:true,taskId:'MB-20261027-REALISM-DEBUG-PLAN',repository:repo,branch,commit,files:verified,
  branchHeadVerified:true,pullRequest:380,pullRequestHeadAtRead:pr.head.sha,
  pullRequestHeadMatchedAtRead:pr.head.sha===commit,
  sourceImplementationPartiallyCommitted:true,remainingSourceChangesNotIncluded:true,
  wholeGoalComplete:false,finalDesignMustBeRecheckedAfterRemainingWork:true};
await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({pass:true,commit,fileCount:files.length,githubContentExact:true,branchHeadVerified:true}));
