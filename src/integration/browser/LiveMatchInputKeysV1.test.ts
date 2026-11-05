import { expect, it } from 'vitest';
import { createLiveBaseballMatchWorkerV116 } from './LiveBaseballMatchV1';
import { liveMatchFixture } from './LiveBaseballMatchV1.test-support';

it('refuses a match input key it does not know, instead of running as if it were absent', () => {
  const input = { ...liveMatchFixture(), battedBallAeroV2: { dragScale: 1.1 } } as Parameters<typeof createLiveBaseballMatchWorkerV116>[0];
  expect(() => createLiveBaseballMatchWorkerV116(input)).toThrow('live baseball match: unknown match input battedBallAeroV2');
});

it('accepts every key the match input type declares', () => {
  const input = { ...liveMatchFixture(), battedBallAeroV1: { dragScale: 1.1 } };
  expect(() => createLiveBaseballMatchWorkerV116(input)).not.toThrow();
});
