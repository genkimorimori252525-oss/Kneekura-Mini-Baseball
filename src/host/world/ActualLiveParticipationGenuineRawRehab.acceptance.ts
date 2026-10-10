import { it } from 'vitest';
import { verifyGenuineRawRehabRejection } from './ActualLiveParticipationGenuineConsumers.test-support';

it('C08-R requires original pregame roster proof after authenticating genuine tagged participation', () => {
  process.stdout.write(`${JSON.stringify(verifyGenuineRawRehabRejection())}\n`);
}, 240_000);
