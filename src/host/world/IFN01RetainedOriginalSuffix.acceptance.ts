import { readFileSync } from 'node:fs';
import { it } from 'vitest';
import { runIFN01RetainedOriginalSuffix } from './IFN01RetainedOriginalSuffix.test-support';
import type { IFN01RetainedSuffixInput } from './IFN01RetainedCheckpoint.test-support';

it('IFN01-R2 continues exact cp10 from unperformed batter plan open/accept through original remaining hold, closure, TOTAL, scoring and next-actor assertions (suffix only)', () => {
  const path = process.env.BASEBALL_IFN01_RETAINED_INPUT;
  if (!path) throw new Error('reviewed IFN01 retained suffix input is required');
  const input = JSON.parse(readFileSync(path, 'utf8')) as IFN01RetainedSuffixInput;
  runIFN01RetainedOriginalSuffix(input, phase => console.log('[IFN01 retained suffix] ' + phase));
}, 1_200_000);
