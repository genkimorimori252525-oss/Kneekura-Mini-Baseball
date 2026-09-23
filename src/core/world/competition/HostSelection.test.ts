import { expect, it } from 'vitest';
import { selectCompetitionHost } from './HostSelection';

it('enforces WBC finals in the United States before ranking suitable venues', () => {
  const selection = selectCompetitionHost({
    competitionKind: 'WBC_FINALS', policyVersion: 'host-v1',
    candidates: [
      { venueId: 'ca', nationId: 'CA', cityId: 'toronto', regionId: 'americas',
        eligible: true, suitabilityScore: 100, rotationScore: 100 },
      { venueId: 'us-old', nationId: 'US', cityId: 'old', regionId: 'americas',
        eligible: true, suitabilityScore: 80, rotationScore: 0 },
      { venueId: 'us-new', nationId: 'US', cityId: 'new', regionId: 'americas',
        eligible: true, suitabilityScore: 75, rotationScore: 10 },
      { venueId: 'us-bad', nationId: 'US', cityId: 'bad', regionId: 'americas',
        eligible: false, suitabilityScore: 1000, rotationScore: 1000 },
    ],
  });
  expect(selection.selectedVenueId).toBe('us-new');
  expect(selection.evaluations.find((item) => item.venueId === 'ca')?.rejectionReason)
    .toBe('WBC_US_ONLY');
  expect(selection.evaluations.find((item) => item.venueId === 'us-bad')?.rejectionReason)
    .toBe('INELIGIBLE');
  expect(() => selectCompetitionHost({
    competitionKind: 'WBC_FINALS', policyVersion: 'host-v1',
    candidates: [{ venueId: 'ca', nationId: 'CA', cityId: 'toronto', regionId: 'americas',
      eligible: true, suitabilityScore: 100, rotationScore: 0 }],
  })).toThrow('eligible host');
});
