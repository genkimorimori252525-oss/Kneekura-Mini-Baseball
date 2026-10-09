import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { expect,it } from 'vitest';
import { verifyGenuineSamePaExecutionView,writeExecutionViewArtifact } from './SamePlateAppearanceExecutionViewGate.test-support';
it('SP-V02 genuine execution view preserves ten actual states and returns one cumulative basis without physical dispatch',()=>{
  const path=process.env.SAME_PA_EXECUTION_VIEW_INPUT,sha=process.env.SAME_PA_EXECUTION_VIEW_INPUT_SHA256,output=process.env.SAME_PA_EXECUTION_VIEW_OUTPUT_DIRECTORY;
  if(!path||!sha||!output)throw new Error('explicit reviewed execution-view controller input required');
  const directory=mkdtempSync(join(output,'same-pa-execution-view-'));
  const result=verifyGenuineSamePaExecutionView({inputPath:path,inputSha256:sha,destinationPath:join(directory,'execution-view.sqlite')});
  writeExecutionViewArtifact(join(directory,'receipt.json'),result);
  expect(result.newViewRows).toBe(1);expect(result.newTotalRows).toBe(0);expect(result.newPrefixRows).toBe(0);
  expect(result.view.participants).toHaveLength(10);expect(result.physicalPitchWriterInvoked).toBe(false);
});
