import { ok, throws } from 'node:assert';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createLiveBaseballMatchV1 } from '../../src/integration/browser/LiveBaseballMatchV1';
import { liveMatchFixture } from '../../src/integration/browser/LiveBaseballMatchV1.test-support';
import { assertLiveMatchReplayRecordV1, compactLiveIssuedPitchV1, hashLiveMatchRecordingValueV1 as sha,
  INITIAL_LIVE_MATCH_RECORD_HASH_V1, verifyLiveMatchRecordingV1,
  type CompactLiveMatchRecordV1, type LiveMatchRecordingV1 } from './LiveMatchRecordingV1';

ok(process.argv[2], 'recording directory required');
const directory = resolve(process.argv[2]), replayCount = Number(process.argv[3] ?? 1);
const paths = readdirSync(directory).filter(name => /^game-\d+\.json$/.test(name)).sort();
ok(paths.length > 0, 'no saved game records');
ok(Number.isSafeInteger(replayCount) && replayCount >= 0 && replayCount <= paths.length, 'replay count must be an integer between zero and saved game count');
const verify = (recording: LiveMatchRecordingV1) => {
  const fixture = liveMatchFixture(recording.summary.seed);
  verifyLiveMatchRecordingV1(recording, { seed: fixture.seed, initialMatch: createLiveBaseballMatchV1(fixture).inspect().match,
    teams: fixture.teams, regulationInnings: fixture.innings ?? 9 });
};
const rehash = (recording: LiveMatchRecordingV1) => {
  let chain = INITIAL_LIVE_MATCH_RECORD_HASH_V1;
  for (const record of recording.records) {
    record.previousHash = chain;
    const { hash: ignored, ...item } = record; void ignored;
    record.hash = sha(item); chain = record.hash;
  }
  recording.summary.recordsHash = chain;
};
let verified = 0, replayed = 0, tamperChecks = 0, totalPitches = 0;
for (const path of paths) {
  const recording = JSON.parse(readFileSync(resolve(directory, path), 'utf8')) as LiveMatchRecordingV1;
  verify(recording); verified++; totalPitches += recording.records.length;
  const mutated = structuredClone(recording);
  (mutated.records[0].after.score as { away: number }).away += 1;
  throws(() => verify(mutated)); tamperChecks++;
  // Recomputing an untrusted hash chain does not replace Core rule validation.
  rehash(mutated); throws(() => verify(mutated)); tamperChecks++;
  const truncated = structuredClone(recording);
  truncated.records.pop(); truncated.summary.pitches--;
  truncated.summary.final = truncated.records.at(-1)?.after ?? recording.records[0].before;
  rehash(truncated); throws(() => verify(truncated)); tamperChecks++;
  const wrongOrdinal = structuredClone(recording);
  wrongOrdinal.records[0].pitch++; rehash(wrongOrdinal); throws(() => verify(wrongOrdinal)); tamperChecks++;
  if (replayed < replayCount) {
    const host = createLiveBaseballMatchV1(liveMatchFixture(recording.summary.seed));
    const replayRecords: CompactLiveMatchRecordV1[] = [];
    let actualChain = INITIAL_LIVE_MATCH_RECORD_HASH_V1;
    for (const record of recording.records) {
      const actual = compactLiveIssuedPitchV1(host.issuePitch(record.command), replayRecords.length + 1, actualChain);
      assertLiveMatchReplayRecordV1(record, actual);
      actualChain = actual.hash; replayRecords.push(actual);
    }
    ok(host.inspect().finished); replayed++;
    const contactIndex = recording.records.findIndex(r => r.play.contact !== null);
    if (contactIndex >= 0) {
      // A coordinated impulse/successor mutation can satisfy internal rule and
      // clock checks. Only the fresh full physical record rejects this claim.
      const coordinated = structuredClone(recording), changed = coordinated.records[contactIndex];
      const impact = changed.play.contact as { exitVelocity: { x: number } };
      impact.exitVelocity.x += .125;
      changed.play = { ...changed.play, outgoingBallMoment: { ...changed.play.outgoingBallMoment!, ball: { ...changed.play.outgoingBallMoment!.ball,
        velocity: { ...changed.play.outgoingBallMoment!.ball.velocity, x: impact.exitVelocity.x } } } };
      rehash(coordinated);
      throws(() => assertLiveMatchReplayRecordV1(changed, replayRecords[contactIndex])); tamperChecks++;
    }
  }
}
const report = { kind: 'local-core-saved-records-verified-v1', verifiedGames: verified, totalPitches, replayedGames: replayed, tamperChecks,
  nativeAuthentication: false, scope: 'complete saved games, full hash chains, identities and Core rule replay for every game; full compact physical re-execution comparison for selected games' };
writeFileSync(resolve(directory, 'saved-record-verification.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report));
