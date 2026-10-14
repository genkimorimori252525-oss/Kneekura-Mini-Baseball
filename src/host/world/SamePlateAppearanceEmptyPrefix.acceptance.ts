import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { expect,it } from 'vitest';
import { verifyGenuineSamePaEmptyPrefix,writeEmptyPrefixArtifact } from './SamePlateAppearanceEmptyPrefix.test-support';
it('SP-V01 genuine empty prefix preserves the reservation and prepares ten explicit TOTAL inputs without accepting them',()=>{
  const path=process.env.SAME_PA_EMPTY_PREFIX_INPUT,sha=process.env.SAME_PA_EMPTY_PREFIX_INPUT_SHA256,output=process.env.SAME_PA_EMPTY_PREFIX_OUTPUT_DIRECTORY;
  if(!path||!sha||!output)throw new Error('explicit reviewed empty-prefix controller input required');
  const directory=mkdtempSync(join(output,'same-pa-empty-prefix-'));
  const result=verifyGenuineSamePaEmptyPrefix({inputPath:path,inputSha256:sha,destinationPath:join(directory,'empty-prefix.sqlite')});
  writeEmptyPrefixArtifact(join(directory,'receipt.json'),result);
  expect(result.newPrefixRows).toBe(1);expect(result.newTotalRows).toBe(0);expect(result.newViewRows).toBe(0);
  expect(result.proposedTotalSources).toHaveLength(10);expect(result.physicalPitchWriterInvoked).toBe(false);
});
