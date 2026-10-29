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
  ||/^src\/integration\/browser\/SpinNeutralGoldV193\.(?:test-support|test)\.ts$/.test(path)
  ||/^tools\/verification\/(?:spin-neutral-live-case-v193\.ts|check-spin-neutral-live-v193\.mjs)$/.test(path)
  ||/^tools\/verification\/NativeSpinNeutralV193-(?:sql|gates\.test|frontier|advance)\.ts$/.test(path)
  ||/^tools\/verification\/check-NativeSpinNeutralV193-(?:backup|advance)\.mjs$/.test(path)
  ||path==='src/host/world/SamePlateAppearanceLifecycleFixture.test-support.ts'
  ||path==='src/host/world/InFlightBattingLifecycleFixture.test-support.ts'
  ||/^tools\/verification\/NativeSpinNeutralV193-suffix\.(?:test-support|test)\.ts$/.test(path)
  ||path==='tools/verification/check-NativeSpinNeutralV193-suffix.mjs'
  ||path==='tools/verification/NativeSpinNeutralV193-recover.ts'
  ||path==='tools/verification/check-NativeSpinNeutralV193-recover.mjs'
  ||/^src\/host\/world\/(?:SamePlateAppearanceLifecycleFromSqlite|SamePlateAppearanceContinuationFromSqlite|SamePaAssessmentProvenanceV129(?:\.test)?|SamePaAssessmentProvenanceV130\.test|SamePaLifecycleAbsentIdsV194\.test)\.ts$/.test(path)
  ||/^tools\/verification\/(?:native-lifecycle-absence-case-v194\.ts|check-native-lifecycle-absence-v194\.mjs)$/.test(path)
  ||/^tools\/verification\/(?:native-spin-neutral-cut11-v195\.ts|check-native-spin-neutral-cut11-v195\.mjs)$/.test(path)
  ||/^tools\/verification\/(?:native-spin-neutral-witness-v196\.ts|check-native-spin-neutral-witness-v196\.mjs)$/.test(path)
  ||/^tools\/verification\/(?:native-spin-neutral-prelaunch-v197\.ts|check-native-spin-neutral-prelaunch-v197\.mjs)$/.test(path)
  ||path==='src/host/world/SamePlateAppearancePhysicalFieldFixture.test-support.ts'
  ||/^tools\/verification\/(?:native-field-preparation-v198(?:\.test)?\.ts|check-native-field-preparation-v198\.mjs)$/.test(path)
  ||/^tools\/verification\/(?:native-field-continuation-v199(?:\.test)?\.ts|check-native-field-continuation-v199\.mjs)$/.test(path)
  ||/^tools\/verification\/(?:native-lifecycle-read-profile-v200\.ts|check-native-lifecycle-read-profile-v200\.mjs)$/.test(path)
  ||/^tools\/verification\/(?:native-lifecycle-identity-batch-v201(?:\.test)?\.ts|check-native-lifecycle-identity-batch-v201\.mjs)$/.test(path)
  ||/^src\/host\/world\/SamePaLifecycleIdentityCandidatesV202(?:\.test)?\.ts$/.test(path)
  ||path==='tools/verification/check-native-lifecycle-identity-v202.mjs'
  ||/^tools\/verification\/(?:native-field-observation-v203(?:\.test)?\.ts|check-native-field-observation-v203\.mjs)$/.test(path)
  ||/^tools\/verification\/(?:native-field-delivery-v204(?:\.test)?\.ts|check-native-field-delivery(?:-retained)?-v204\.mjs)$/.test(path)
  ||/^tools\/verification\/(?:native-post-delivery-auth-v205(?:\.test)?\.ts|check-native-post-delivery-auth-v205\.mjs)$/.test(path)
  ||/^tools\/verification\/(?:native-delivery-forecast-v206(?:\.test)?\.ts|check-native-delivery-forecast-v206\.mjs)$/.test(path)
  ||/^tools\/verification\/(?:native-inflight-original-inputs-v207\.ts|native-forecast-admission-v207(?:\.test)?\.ts|check-native-forecast-admission-v207\.mjs)$/.test(path)
  ||/^tools\/verification\/(?:native-execution-input-v208(?:\.test)?\.ts|check-native-execution-input-v208\.mjs)$/.test(path)
  ||path==='src/host/world/SamePlateAppearanceLifecycleFixture.test-support.ts'
  ||/^tools\/verification\/(?:native-execution-input-recovery-v209(?:\.test)?\.ts|check-native-execution-input-recovery-v209\.mjs)$/.test(path)
  ||/^tools\/verification\/(?:native-post-input-resolution-v210(?:\.test)?\.ts|check-native-post-input-resolution-v210\.mjs)$/.test(path)
  ||/^tools\/verification\/(?:native-field-root-v211(?:\.test)?\.ts|check-native-field-root-v211\.mjs)$/.test(path)
  ||/^tools\/verification\/(?:native-field-clock-v212(?:\.test)?\.ts|check-native-field-clock-v212\.mjs)$/.test(path)
  ||/^tools\/verification\/live-debug-(?:case|batch(?:\.test)?)\.mjs$/.test(path)
  ||/^src\/core\/sim\/fielding\/(?:LiveFieldPlayV1|LivePoleContactWitnessV213(?:\.test)?)\.ts$/.test(path)
  ||/^src\/host\/world\/SamePaInitialDefenderObservationViewV214(?:\.test)?\.ts$/.test(path)
  ||/^src\/host\/world\/(?:RuleSourceRegistryV1|SqliteRuleSourceRegistryStore)(?:\.test)?\.ts$/.test(path)
  ||/^tools\/verification\/(?:native-initial-defender-views-v214(?:\.test)?\.ts|check-native-initial-defender-views-v214\.mjs)$/.test(path)
  ||/^tools\/verification\/(?:native-initial-defender-views-inventory-v216(?:\.test)?\.ts|check-native-initial-defender-views-inventory(?:-proof)?-v216\.mjs)$/.test(path)
  ||/^tools\/verification\/(?:native-initial-defender-views-recovery-v217(?:\.test)?\.ts|check-native-initial-defender-views-recovery-v217\.mjs)$/.test(path)
  ||/^tools\/verification\/(?:native-initial-defender-decision-v219(?:\.test)?\.ts|check-native-initial-defender-decision-v219\.mjs)$/.test(path)
  ||/^tools\/verification\/(?:native-lifecycle-current-profile-v220(?:\.test)?\.ts|check-native-lifecycle-current-profile-v220\.mjs)$/.test(path)
  ||/^tools\/verification\/(?:native-lifecycle-claim-metadata-compare-v221(?:\.test)?\.ts|check-native-lifecycle-claim-metadata-compare-v221\.mjs)$/.test(path)
  ||/^tools\/verification\/(?:prepare-maker-direction|check-maker-direction-practice-current)\.mjs$/.test(path)
  ||/^src\/core\/decision\/batting\/BatterObservedRegionExperienceV222(?:\.test)?\.ts$/.test(path)
  ||/^src\/integration\/browser\/(?:LiveBatterObservationV151|LivePitchV1|LiveBaseballMatchV1|LiveObservedRegionExperienceV222\.test|index|workbench-index)\.ts$/.test(path)
  ||path==='docs/demos/baseball-maker-batting-practice-v150.js'
  ||path==='tools/browser-bridge/background-match-v116.mjs'
  ||path==='tools/verification/check-observed-region-compat-v222.mjs'
  ||/^tools\/verification\/(?:native-spin-motion-binding-gate-v223(?:\.test)?\.ts|check-native-spin-motion-binding-gate-v223\.mjs)$/.test(path)
  ||/^tools\/verification\/(?:motor-evidence-readonly-gate-v224(?:\.test)?\.ts|check-motor-evidence-readonly-gate-v224\.mjs)$/.test(path)
  ||/^src\/host\/world\/(?:SqliteStandalonePracticeStore|StandaloneBattingMotorEvidenceV224\.test)\.ts$/.test(path)
  ||/^src\/host\/world\/(?:SpinMotionBindingV225|SqliteSpinMotionBindingV225)(?:\.test)?\.ts$/.test(path)
  ||/^tools\/verification\/(?:spin-motion-binding-owned-copy-v225(?:\.test)?\.ts|check-spin-motion-binding-owned-copy-v225\.mjs)$/.test(path)
  ||/^src\/core\/world\/psychology\/batting\/(?:BattingMotorPlanV1|BattingCommitment|ObservedSpinAimTrialV226(?:\.test)?|BattingObservedSpinAimExecutionV226\.test)\.ts$/.test(path)
  ||/^src\/host\/world\/(?:SamePlateAppearancePhysicalEpisode|SamePlateAppearancePhysicalEpisodeFromSqlite|SamePlateAppearanceLifecycleClaimGuard|SamePaObservedSpinAimTrialV226(?:\.test)?)\.ts$/.test(path)
  ||/^tools\/verification\/(?:native-observed-spin-aim-trial-v226(?:\.test)?\.ts|check-native-observed-spin-aim-trial-v226\.mjs)$/.test(path)
  ||/^src\/host\/world\/NativeSpinTrialMotorEvidenceV227(?:\.test)?\.ts$/.test(path)
  ||/^tools\/verification\/(?:native-spin-trial-motor-evidence-v227(?:\.test)?\.ts|check-native-spin-trial-motor-evidence-v227\.mjs)$/.test(path)
  ||/^src\/integration\/traits\/ContactDescriptorEnvelopeV229(?:\.test)?\.ts$/.test(path)
  ||/^tools\/native-contact-report-(?:runtime-v192\.ts|v192\.mjs|v229\.test\.mjs)$/.test(path)
  ||path==='docs/demos/baseball-maker-ui-v94.mjs'
  ||/^tools\/browser-bridge\/(?:build-maker|prepare-maker-contact-envelope-v229|check-maker-contact-envelope-v229)\.mjs$/.test(path)
  ||/^tools\/verification\/(?:native-contact-envelope-readonly-v229\.ts|check-native-contact-envelope-readonly-v229\.mjs)$/.test(path)
  ||/^src\/host\/world\/SamePlateAppearanceSourcePoleFieldV1(?:\.test)?\.ts$/.test(path)
  ||path==='src/integration/browser/LivePoleScopeV148.test.ts'
  ||/^src\/host\/world\/SamePaObservationClockProjectionSourcesV212(?:\.test)?\.ts$/.test(path)
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
  assert.equal(local.toString('utf8').replace(/\r\n/g,'\n'),blob.toString('utf8').replace(/\r\n/g,'\n'));
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
