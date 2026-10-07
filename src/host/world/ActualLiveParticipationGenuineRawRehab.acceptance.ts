import { it } from 'vitest';
import { verifyGenuineRawRehabRejection } from './ActualLiveParticipationGenuineConsumers.test-support';

it('C08-R rejects genuine tagged participation at the raw rehabilitation boundary without clinical effects', () => {
  process.stdout.write(`${JSON.stringify(verifyGenuineRawRehabRejection())}\n`);
}, 90_000);
