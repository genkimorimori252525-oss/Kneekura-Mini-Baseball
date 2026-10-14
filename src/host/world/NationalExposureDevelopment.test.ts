import { afterEach, expect, it } from 'vitest';
import { officialPitchWorkloadFixture } from './OfficialPitchWorkloadFixtures.test-support';
import { nationalExposureAppraisal, nationalExposurePolicies } from './NationalExposureDevelopment.test-support';
import { openSqliteDevelopmentInitiationStore } from './SqliteDevelopmentInitiationStore';
const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });

it('rejects domestic receipts without treating National labels or appraisal as membership', () => {
  const f = officialPitchWorkloadFixture(false); cleanup.push(() => f.close());
  const receipt = f.participation.confirmPlayed('game-1', 'p2', 'DEFENDER', 'application-1', 'application-2');
  const appraisal = nationalExposureAppraisal('p2', 10), policies = nationalExposurePolicies();
  const store = f.track(openSqliteDevelopmentInitiationStore(f.path, { roster: { readDevelopmentRosterChange: () => null },
    person: { read: () => null, readDevelopmentSeed: () => null }, appraisal: { readAcceptedAppraisal: () => null },
    policies: { readAcceptedPolicies: () => policies }, nationalExposure: { readAcceptedAppraisal: () => appraisal } }));
  expect(() => store.applyNationalExposure({ episodeId: appraisal.episodeId, playerId: 'p2', personSourceId: 'intake-p2',
    appraisalSourceId: appraisal.sourceId, policySourceId: policies.sourceId, participationReceiptId: receipt.receiptId })).toThrow('actual supported National');
  expect(store.read(appraisal.episodeId)).toBeNull();
});
