import{readFileSync as read,writeFileSync as write}from'node:fs';
import{createHash}from'node:crypto';
const files=['NativeDevelopmentReadPhaseV126.ts','NativeDevelopmentEpisodeFromSqlite.ts','NativePitchPracticeEvidenceFromSqlite.ts',
 'SqliteDevelopmentPracticeExposureStore.ts','SqliteDevelopmentInitiationStore.ts','SqliteSpinControlMasteryV123.ts',
 'NativeDevelopmentReadPhaseV126.test.ts','NativePitchPracticeReadMemoV126.test.ts','SqliteSpinControlMasteryMultiV125.test.ts',
 'SpinMasteryMultiV125.test-support.ts','SpinExposureCpuV126.test-support.ts'].map(name=>'src/host/world/'+name);
const inputs=Object.fromEntries(files.map(path=>[path,createHash('sha256').update(read(path)).digest('hex')]));
write('docs/verification/spin-trial-v124/review-sources-v126.json',JSON.stringify({boundary:'UNCOMMITTED_NAMED_SOURCE_REVIEW_SNAPSHOT',
 head:'90dba70ba1a0b92840b303769e854047e725a317',inputs},null,2)+'\n');console.log(JSON.stringify({files:files.length,codeCommit:false}));
