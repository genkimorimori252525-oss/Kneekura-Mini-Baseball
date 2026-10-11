import { readFileSync } from 'node:fs';
import { it } from 'vitest';
import { runLAN01RetainedOriginalSuffix } from './LAN01RetainedOriginalSuffix.test-support';
import type { LAN01RetainedSuffixInput } from './LAN01RetainedCheckpoint.test-support';

it('LAN01-R4 continues exact cp23 from the completed second TAKE and cut0 through original live-appeal closure and Match assertions (remaining suffix only)', () => {
  const path = process.env.BASEBALL_LAN01_RETAINED_INPUT;
  if (!path) throw new Error('reviewed LAN01 retained suffix input is required');
  const input = JSON.parse(readFileSync(path, 'utf8')) as LAN01RetainedSuffixInput;
  runLAN01RetainedOriginalSuffix(input, phase => console.log('[LAN01 retained suffix] ' + phase));
}, 1_800_000);
