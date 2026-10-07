import { it } from 'vitest';
import { verifyGenuineNationalRejection } from './ActualLiveParticipationGenuineConsumers.test-support';

it('C06-N rejects genuine tagged participation at the National public boundary without changing either database', () => {
  process.stdout.write(`${JSON.stringify(verifyGenuineNationalRejection())}\n`);
}, 180_000);
