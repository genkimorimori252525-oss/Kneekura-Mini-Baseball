import { expect, it } from 'vitest';
import { activateNextLiveBallPlay } from './NextPlayActivation';

it('does not invoke an active adjudication getter at the next-play activation boundary', () => {
  let called = 0;
  const input: any = {
    match: {},
    physicalTimeline: {},
    nextStartedAtTick: 1,
  };
  Object.defineProperty(input, 'adjudication', {
    enumerable: true,
    get() {
      called += 1;
      return {};
    },
  });

  expect(() => activateNextLiveBallPlay(input)).toThrow();
  expect(called).toBe(0);
});

it('exports the next-play activation fence from the public adjudication seam', async () => {
  const api = await import('./index');
  expect(api.activateNextLiveBallPlay).toBeTypeOf('function');
});
