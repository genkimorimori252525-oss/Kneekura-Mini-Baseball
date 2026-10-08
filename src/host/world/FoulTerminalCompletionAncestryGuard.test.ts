import { expect, test } from 'vitest';
import { existsSync } from 'node:fs';

// Structural stack tests only. No terminal archive or accepted effect is made.
test('TA-S01 structural ancestry seam rejects self forward foreign and reentrant owners', async () => {
  const path = './FoulTerminalCompletionAncestryGuard';
  expect(existsSync(new URL(path + '.ts', import.meta.url)), 'TERMINAL_ANCESTRY_GUARD_API_MISSING').toBe(true);
  const { withFoulTerminalOriginalScope: scope, withFoulTerminalCompletionReader: reader,
    assertFoulTerminalPriorActivation: prior } = await import(path);
  const db = {}, other = {};
  expect(scope(db, 'terminal-2', 'game', 2, () => prior(db, 'game', 1, 2))).toBeUndefined();
  for (const values of [['game', 2, 3], ['game', 3, 4], ['foreign', 1, 2], ['game', 0, 1]] as const) {
    expect(() => scope(db, 'terminal-2', 'game', 2, () => prior(db, ...values))).toThrow(/ancestry/);
  }
  expect(() => reader(db, 'terminal-2', () => reader(db, 'terminal-2', () => null))).toThrow(/re-entry/);
  expect(reader(db, 'terminal-2', () => reader(other, 'terminal-2', () => 4))).toBe(4);
  expect(reader(db, 'terminal-2', () => scope(db, 'terminal-2', 'game', 2,
    () => scope(db, 'terminal-2', 'game', 2, () => prior(db, 'game', 1, 2))))).toBeUndefined();
  expect(() => scope(db, 'terminal-2', 'game', 2, () => scope(db, 'terminal-1', 'game', 1,
    () => prior(db, 'game', 0, 1)))).not.toThrow();
  expect(() => scope(db, 'terminal-2', 'game', 2, () => { throw new Error('original'); })).toThrow('original');
  expect(() => prior(db, 'game', 3, 4)).not.toThrow();
  expect(reader(db, 'terminal-2', () => 5)).toBe(5);
});

test('TA-S02 structural same owner cannot silently change its original scope', async () => {
  const path = './FoulTerminalCompletionAncestryGuard';
  const {withFoulTerminalOriginalScope:scope} = await import(path), db = {};
  expect(() => scope(db,'terminal','game',2, () => scope(db,'terminal','game',1, () => null)),
    'TERMINAL_SAME_SOURCE_SCOPE_DRIFT_ACCEPTED').toThrow(/ancestry/);
});
