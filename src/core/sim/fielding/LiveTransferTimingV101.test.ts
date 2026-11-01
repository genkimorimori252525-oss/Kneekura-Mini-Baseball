import { expect, it } from 'vitest';
import { sampleLiveTransferDelayV101 } from './LiveTransferTimingV101';

it('uses a bounded, baseline-favouring provisional distribution without consuming a shared RNG', () => {
  const samples = Array.from({ length: 2048 }, (_, seed) => sampleLiveTransferDelayV101(seed, 'A', 0, .15));
  expect(Math.min(...samples)).toBeGreaterThanOrEqual(0);
  expect(Math.max(...samples)).toBeLessThanOrEqual(.15);
  expect(samples.reduce((a, b) => a + b, 0) / samples.length).toBeCloseTo(.05, 2);
  expect(samples.filter(x => x < .05).length).toBeGreaterThan(samples.filter(x => x >= .1).length);
  expect(sampleLiveTransferDelayV101(101, 'A', 0, .15)).toBe(sampleLiveTransferDelayV101(101, 'A', 0, .15));
  expect(sampleLiveTransferDelayV101(101, 'A', 1, .15)).not.toBe(sampleLiveTransferDelayV101(101, 'A', 0, .15));
  expect(sampleLiveTransferDelayV101(101, 'B', 0, .15)).not.toBe(sampleLiveTransferDelayV101(101, 'A', 0, .15));
  expect(sampleLiveTransferDelayV101(101, 'A', 0, 0)).toBe(0);
  for (const max of [-.1, NaN, Infinity, 2.1]) expect(() => sampleLiveTransferDelayV101(101, 'A', 0, max)).toThrow();
});
