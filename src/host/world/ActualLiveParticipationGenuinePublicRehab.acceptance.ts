import { it } from 'vitest';
import { verifyGenuinePublicRehabRejection } from './ActualLiveParticipationGenuineConsumers.test-support';

it('C07-P rejects genuine tagged participation after valid raw legacy proof and preserves legacy apply reopen retry', () => {
  process.stdout.write(`${JSON.stringify(verifyGenuinePublicRehabRejection())}\n`);
}, 240_000);
