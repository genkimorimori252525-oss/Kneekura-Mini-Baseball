import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { nationalCallupFixture } from './NationalCallupFixtures.test-support';
import { openSqliteNationalCallupStore } from './SqliteNationalCallupStore';
import { openSqliteNationalRosterEligibilityStore } from './SqliteNationalRosterEligibilityStore';
import { openSqliteWbcQualifierSelectionStore } from './SqliteWbcQualifierSelectionStore';

it('derives a dated eligibility list from accepted active callups and explicit minimum roster policy', () => {
  const f = nationalCallupFixture(), callups = openSqliteNationalCallupStore(f.path, f.sources);
  let eligibility: ReturnType<typeof openSqliteNationalRosterEligibilityStore> | undefined;
  try {
    const accepted = callups.register({ ...f.request(), registeredAtDay: 390 });
    callups.register({ ...f.request(1), nationId: 'KR', registeredAtDay: 390,
      response: { decision: 'DECLINE', reason: 'PERSONAL', evidenceId: 'decline-KR' } });
    eligibility = openSqliteNationalRosterEligibilityStore(f.path, { selections: f.selections, nations: f.nations, callups });
    const request = { careerId: 'career-a', editionId: 'wbc-2032', asOfDay: 400,
      candidateNationIds: ['JP', 'KR'], policy: { version: 'test-roster-eligibility-v1', minimumActivePlayers: 1 } };
    const snapshot = eligibility.initialize(request);
    expect(snapshot.eligibility.eligibleNationIds).toEqual(['JP']);
    expect(snapshot.source.candidates[0].callupSnapshotIds).toEqual([accepted.snapshotId]);
    expect(eligibility.initialize(request)).toEqual(snapshot);
    callups.register({ ...f.request(4), nationId: 'KR', registeredAtDay: 400 });
    expect(eligibility.readEligibility('career-a', snapshot.eligibility.snapshotId)).toEqual(snapshot.eligibility);
    const qualifier = openSqliteWbcQualifierSelectionStore(f.path, { eligibility, nations: f.nations,
      direct: { readDirect: () => { throw new Error('direct Source must follow eligibility validation'); } },
      ranking: { readRanking: () => null } });
    try {
      const qualifierInput = { careerId: 'career-a', wbcEditionId: 'wbc-2032', qualifierEditionId: 'qualifier-2032',
        rankingAsOfDay: 400, eligibility: { ...snapshot.eligibility, eligibleNationIds: ['KR'] },
        policy: { version: 'selector-v1', regionalPriorityPerRegion: 1, rankingPolicyVersion: 'ranking-v1' }, registry: { policies: [] } };
      expect(() => qualifier.initialize(qualifierInput)).toThrow('accepted national roster eligibility');
      expect(() => qualifier.initialize({ ...qualifierInput, eligibility: snapshot.eligibility })).toThrow('direct Source');
    } finally { qualifier.close(); }
    expect(() => eligibility!.initialize({ ...request, asOfDay: 401 })).toThrow('qualification cutoff');
    expect(() => eligibility!.initialize({ ...request, policy: { ...request.policy, minimumActivePlayers: 2 } })).toThrow('policy version');
    const stricter = eligibility.initialize({ ...request, policy: { version: 'test-min-two-v1', minimumActivePlayers: 2 } });
    expect(stricter.eligibility.eligibleNationIds).toEqual([]);
    f.facts.record({ careerId: 'career-a', personLinkSourceId: 'link-0', active: false, fact: {
      evidenceId: 'revoked-for-next-snapshot', playerId: 'p0', personId: 'person-0', nationId: 'JP', basis: 'CITIZENSHIP', effectiveFromDay: 395 } });
    const invalidated = eligibility.initialize({ ...request, asOfDay: 399 });
    expect(invalidated.eligibility.eligibleNationIds).toEqual([]);
    expect(eligibility.readEligibility('career-a', snapshot.eligibility.snapshotId)).toEqual(snapshot.eligibility);
    f.changeAvailability('p0', 'INJURED', 421);
    eligibility.close(); eligibility = openSqliteNationalRosterEligibilityStore(f.path, { selections: f.selections, nations: f.nations, callups });
    expect(eligibility.readEligibility('career-a', snapshot.eligibility.snapshotId)).toEqual(snapshot.eligibility);
    const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
    const db = new DatabaseSync(f.path);
    try {
      db.prepare("UPDATE world_national_roster_eligibility SET snapshot_json='{}' WHERE snapshot_id=?").run(snapshot.eligibility.snapshotId);
      expect(() => eligibility!.readEligibility('career-a', snapshot.eligibility.snapshotId)).toThrow('corrupt');
    } finally { db.close(); }
  } finally { eligibility?.close(); callups.close(); f.close(); }
});
