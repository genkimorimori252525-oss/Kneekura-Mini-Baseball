import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { expect,it } from 'vitest';
import { verifyGenuineSamePaTotalSet,writeTotalSetArtifact } from './SamePlateAppearanceTotalSet.test-support';
it('SP-T01 genuine ten TOTALs preserve the qualified empty prefix and return exact owner references without accepting a view',()=>{
  const path=process.env.SAME_PA_TOTAL_SET_INPUT,sha=process.env.SAME_PA_TOTAL_SET_INPUT_SHA256,output=process.env.SAME_PA_TOTAL_SET_OUTPUT_DIRECTORY;
  if(!path||!sha||!output)throw new Error('explicit reviewed ten-TOTAL controller input required');
  const directory=mkdtempSync(join(output,'same-pa-ten-total-'));
  const result=verifyGenuineSamePaTotalSet({inputPath:path,inputSha256:sha,destinationPath:join(directory,'ten-total.sqlite')});
  writeTotalSetArtifact(join(directory,'receipt.json'),result);
  expect(result.newTotalRows).toBe(10);expect(result.newPrefixRows).toBe(0);expect(result.newViewRows).toBe(0);
  expect(result.participantTotalReferences).toHaveLength(10);expect(result.physicalPitchWriterInvoked).toBe(false);
});
