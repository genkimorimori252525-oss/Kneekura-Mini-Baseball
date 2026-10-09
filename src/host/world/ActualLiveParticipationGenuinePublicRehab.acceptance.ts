import { it } from 'vitest';
import { verifyGenuinePublicRehabRejection } from './ActualLiveParticipationGenuineConsumers.test-support';

it('C07-P rejects a genuine tagged peer receipt that differs from local proof and preserves legacy apply reopen retry', () => {
  process.stdout.write(`${JSON.stringify(verifyGenuinePublicRehabRejection())}\n`);
}, 240_000);
