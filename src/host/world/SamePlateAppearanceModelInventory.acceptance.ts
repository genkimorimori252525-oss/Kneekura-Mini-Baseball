import {mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {expect,it} from 'vitest';
import {verifyGenuineSamePaModelInventory} from './SamePlateAppearanceModelInventory.test-support';
import {writeExecutionViewArtifact} from './SamePlateAppearanceExecutionViewGate.test-support';
it('SP-D00 genuine all-ten normal-model inventory preserves the closed execution view without accepting inputs',()=>{
  const path=process.env.SAME_PA_MODEL_INVENTORY_INPUT,sha=process.env.SAME_PA_MODEL_INVENTORY_INPUT_SHA256,output=process.env.SAME_PA_MODEL_INVENTORY_OUTPUT_DIRECTORY;
  if(!path||!sha||!output)throw new Error('explicit reviewed model-inventory controller input required');
  const directory=mkdtempSync(join(output,'same-pa-model-inventory-'));
  const result=verifyGenuineSamePaModelInventory({inputPath:path,inputSha256:sha,destinationPath:join(directory,'model-inventory.sqlite')});
  writeExecutionViewArtifact(join(directory,'receipt.json'),result);expect(result.totalChanges).toBe(0);expect(result.modelInventoryQualified).toBe(true);
});
