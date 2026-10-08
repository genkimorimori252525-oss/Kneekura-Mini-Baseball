import { it } from 'vitest';
import { readInitialParticipationArtifactInput, verifyInitialParticipationArtifact } from './ActualLiveParticipationInitialArtifact.test-support';

it('accepts genuine initial batter and defender participation with reopened Career reads and exact retries', () => {
  const input = readInitialParticipationArtifactInput(process.env.ACTUAL_LIVE_PARTICIPATION_INITIAL_INPUT);
  const result = verifyInitialParticipationArtifact(input);
  process.stdout.write(`${JSON.stringify(result)}\n`);
});
