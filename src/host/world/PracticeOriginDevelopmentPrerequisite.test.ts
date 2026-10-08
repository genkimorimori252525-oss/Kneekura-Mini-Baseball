import { afterEach, it } from 'vitest';
import { assertPracticeOriginPrerequisite, practiceOriginFixture } from './PracticeOriginDevelopment.test-support';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });

it('completes, assesses, settles and reopens an original null-episode practice with zero roster executions', () => {
  assertPracticeOriginPrerequisite(practiceOriginFixture(cleanup));
});
