import { expect, it } from 'vitest';
import { qualifyActualReceivedCallPrerequisite } from './ActualReceivedCallControllerFixtures.test-support';

it('qualifies the genuine received-call prerequisite with an issued and adopted incumbent motor and ordinary reopen', () => {
  const prerequisite = qualifyActualReceivedCallPrerequisite();
  expect(prerequisite.observationAvailableAt.elapsedSeconds).toBeGreaterThanOrEqual(prerequisite.receivedAt.elapsedSeconds);
  console.info('received-call-prerequisite-qualified', JSON.stringify(prerequisite));
});
