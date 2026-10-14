import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { verifySamePaNormalModelAcceptance } from './SamePlateAppearanceNormalModels.test-support';
import { writeExecutionViewArtifact } from './SamePlateAppearanceExecutionViewGate.test-support';
it('SP-M01 accepted player-specific nominal model Sources preserve the reserved view and all prior rows', () => {
  const inputPath = process.env.SAME_PA_MODEL_INVENTORY_INPUT, inputSha256 = process.env.SAME_PA_MODEL_INVENTORY_INPUT_SHA256, output = process.env.SAME_PA_MODEL_INVENTORY_OUTPUT_DIRECTORY;
  if (!inputPath || !inputSha256 || !output) throw new Error('explicit reviewed normal model acceptance input required');
  const outputDirectory = mkdtempSync(join(output, 'same-pa-normal-models-'));
  const value = verifySamePaNormalModelAcceptance({ inputPath, inputSha256, outputDirectory });
  writeExecutionViewArtifact(join(outputDirectory, 'receipt.json'), value); expect(value.newNormalOwnerRows).toBe(38); expect(value.nominalModelsQualified).toBe(true);
});
