import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { verifySamePaNormalPrerequisites } from './SamePlateAppearanceNormalPrerequisites.test-support';
import { writeExecutionViewArtifact } from './SamePlateAppearanceExecutionViewGate.test-support';
it('SP-D01 read-only normal prerequisite Sources bind the qualified target members without model acceptance', () => {
  const inputPath = process.env.SAME_PA_MODEL_INVENTORY_INPUT, inputSha256 = process.env.SAME_PA_MODEL_INVENTORY_INPUT_SHA256, output = process.env.SAME_PA_MODEL_INVENTORY_OUTPUT_DIRECTORY;
  if (!inputPath || !inputSha256 || !output) throw new Error('explicit reviewed normal prerequisite inventory input required');
  const outputDirectory = mkdtempSync(join(output, 'same-pa-normal-prerequisites-'));
  const value = verifySamePaNormalPrerequisites({ inputPath, inputSha256, outputDirectory });
  writeExecutionViewArtifact(join(outputDirectory, 'receipt.json'), value); expect(value.totalChanges).toBe(0); expect(value.normalOwnerInventoryQualified).toBe(true);
});
