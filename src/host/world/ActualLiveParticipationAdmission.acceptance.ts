import { it } from 'vitest';
import { admitParticipationOfficialArtifact, readParticipationAdmissionInput } from './ActualLiveParticipationAdmission.test-support';

it('admits the pinned genuine official artifact with two fresh candidate-source read authentications', () => {
  const result = admitParticipationOfficialArtifact(readParticipationAdmissionInput(process.env.ACTUAL_LIVE_PARTICIPATION_ADMISSION_INPUT));
  process.stdout.write(`${JSON.stringify({ kind: result.kind, candidate: result.candidate, manifest: result.manifest })}\n`);
});
