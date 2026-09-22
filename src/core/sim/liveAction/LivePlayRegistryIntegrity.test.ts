import { expect, it } from 'vitest';
import {
  createLivePlayRegistry,
  resolveLivePlayRegistry,
  type LivePlayRegistry,
} from './LivePlayRegistry';

const base = (): LivePlayRegistry => ({
  playId: 1,
  revision: 0,
  sources: [],
});

it('does not invoke an active sources getter at the registry boundary', () => {
  let called = 0;
  const input: any = { playId: 1, revision: 0 };
  Object.defineProperty(input, 'sources', {
    enumerable: true,
    get() {
      called += 1;
      return [];
    },
  });
  expect(() => createLivePlayRegistry(input)).toThrow();
  expect(called).toBe(0);
});

it('does not invoke an active queue getter inside a source', () => {
  let called = 0;
  const source: any = {
    sourceId: 'source',
    revision: 1,
    physical: [],
    intents: [],
    information: [],
    decisions: [],
    ruleWindows: [],
  };
  Object.defineProperty(source, 'queue', {
    enumerable: true,
    get() {
      called += 1;
      return null;
    },
  });
  expect(() => createLivePlayRegistry({
    playId: 1,
    revision: 0,
    sources: [source],
  })).toThrow();
  expect(called).toBe(0);
});

it('rejects an unknown terminal condition instead of treating it as a terminal rule event', () => {
  expect(() => resolveLivePlayRegistry(base(), {
    tick: 10,
    actors: [],
    terminal: 'invented-terminal' as any,
  })).toThrow();
});
