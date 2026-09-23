import { expect, it } from 'vitest';
import { createCompetitionEdition, applyCompetitionReform } from './CompetitionEdition';

const profile = {
  competitionId: 'wbc', formatVersion: 'format-v1', ruleProfileVersion: 'rules-v1',
  hostingPolicyVersion: 'host-v1', drawPolicyVersion: 'draw-v1',
  awardPolicyVersion: 'awards-v1', canonicalRole: 'NATIONAL_WORLD_CHAMPIONSHIP',
};
const editionInput = {
  editionId: 'wbc-2027', qualificationSnapshotId: 'qualification-2027',
  participantIds: ['nation-jp', 'nation-us'],
  host: { nationId: 'US', cityIds: ['city-a'], venueIds: ['venue-a'] },
  calendarWindow: { startsOnDay: 100, endsOnDay: 120 },
  drawSnapshotId: 'draw-2027', prestigeAtEdition: 80,
};

it('pins every rule, qualification, host and calendar source in an edition snapshot', () => {
  const edition = createCompetitionEdition(profile, editionInput);
  expect(edition).toMatchObject({ ...profile, ...editionInput });
  expect(Object.isFrozen(edition.participantIds)).toBe(true);
  const reformed = applyCompetitionReform(profile, {
    eventId: 'reform-1', effectiveAfterEditionId: 'wbc-2027',
    newFormatVersion: 'format-v2',
  });
  expect(reformed.formatVersion).toBe('format-v2');
  expect(edition.formatVersion).toBe('format-v1');
  expect(edition.canonicalRole).toBe('NATIONAL_WORLD_CHAMPIONSHIP');
});
