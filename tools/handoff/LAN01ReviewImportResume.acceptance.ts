import { readFileSync } from 'node:fs';
import { it } from 'vitest';
import { runLAN01RetainedReviewImportSuffix } from '../../src/host/world/LAN01RetainedOriginalSuffix.test-support';
import type { LAN01RetainedSuffixInput } from '../../src/host/world/LAN01RetainedCheckpoint.test-support';

// Explicitly opt in through vitest.lan01-cp1.config.mjs. This adapter adds no
// substitute assertions, mock owners, accepted Sources, or completed writes.
it('continues the exact LAN01-R15 cp1 after accepted import through the original rights and terminal tail', () => {
  const path = process.env.LAN01_RETAINED_REVIEW_IMPORT_INPUT;
  if (!path) throw new Error('prepared and reviewed LAN01 cp1 input is required');
  const input = JSON.parse(readFileSync(path, 'utf8')) as LAN01RetainedSuffixInput;
  runLAN01RetainedReviewImportSuffix(input, phase => console.log('[LAN01 retained suffix] ' + phase));
}, 42_900_000);
