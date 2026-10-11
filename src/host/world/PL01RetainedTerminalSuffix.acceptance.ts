import { readFileSync } from 'node:fs';
import { it } from 'vitest';
import { runPL01RetainedTerminalSuffix } from './PL01RetainedTerminalSuffix.test-support';
import type { PL01RetainedSuffixInput } from './PL01RetainedCheckpoint.test-support';

it('PL01-R4 continues exact cp11 through original occupied pitch readback and row comparison (remaining suffix only)', () => {
  const path = process.env.BASEBALL_PL01_RETAINED_INPUT;
  if (!path) throw new Error('reviewed PL01 retained suffix input is required');
  const input = JSON.parse(readFileSync(path, 'utf8')) as PL01RetainedSuffixInput;
  runPL01RetainedTerminalSuffix(input, phase => console.log('[PL01 retained suffix] ' + phase));
}, 1_200_000);
