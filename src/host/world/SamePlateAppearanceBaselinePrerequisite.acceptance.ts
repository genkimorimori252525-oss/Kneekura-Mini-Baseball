import { mkdtempSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect,it } from 'vitest';
import { verifySamePaBaselinePrerequisite } from './SamePlateAppearanceBaselinePrerequisite.test-support';

it('SP-B01 genuine accepted away-2 baseline writes only its initial state and reopens exact actual references',()=>{
  const path=process.env.SAME_PA_BASELINE_INPUT,sha=process.env.SAME_PA_BASELINE_INPUT_SHA256,output=process.env.SAME_PA_BASELINE_OUTPUT_DIRECTORY;
  if(!path||!sha||!output)throw new Error('explicit held/released baseline prerequisite controller input required');
  const directory=mkdtempSync(join(output,'same-pa-baseline-'));
  const result=verifySamePaBaselinePrerequisite({inputPath:path,inputSha256:sha,destinationPath:join(directory,'baseline-prerequisite.sqlite')});
  writeFileSync(join(directory,'receipt.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  expect(result.newBaselineRows).toBe(1);expect(result.newHeadRows).toBe(1);expect(result.reservationAttempted).toBe(false);
});
