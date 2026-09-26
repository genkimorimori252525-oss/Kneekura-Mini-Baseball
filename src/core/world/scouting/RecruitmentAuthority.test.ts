import { expect, it } from 'vitest';
import { applyClubCommand, createClubFromSeed } from '../club';
import { bootstrap, command } from '../club/ClubFixtures.test-support';
import { deriveRecruitmentAuthority } from './RecruitmentAuthority';

const club = () => {
  const seed = bootstrap();
  const created = createClubFromSeed({ ...seed,
    context: { ...seed.context, careerId: 'career-1' },
    initial: { ...seed.initial, references: {
      ...seed.initial.references, staffRoleLinks: [
        ...seed.initial.references.staffRoleLinks,
        { roleId: 'gm-role', roleKind: 'OTHER' as const,
          personId: 'gm-1', appointmentId: 'gm-appointment-1' },
      ],
    } },
  });
  if (!created.ok) throw new Error(JSON.stringify(created.reason));
  return created.value;
};
const profile = () => ({ profileId: 'recruitment-authority-1',
  version: 'governance-v1', careerId: 'career-1', clubId: 'club-a',
  season: 1, governanceRef: 'governance-a', availableAtDay: 10,
  finalAuthorityKind: 'GM' as const, authorityRoleId: 'gm-role' });

it('derives acquisition authority from the current club staff appointment', () => {
  const source = deriveRecruitmentAuthority(club(), profile(),
    'gm-1', 'governance-v1', 12);
  expect(source).toMatchObject({ clubRevision: 0,
    authorityPersonId: 'gm-1', profile: profile(),
    appointment: { roleId: 'gm-role', roleKind: 'OTHER',
      appointmentId: 'gm-appointment-1' } });
  expect(Object.isFrozen(source.appointment)).toBe(true);
});

it('does not let a manager or an obsolete front office appointment acquire players', () => {
  const initial = club();
  expect(() => deriveRecruitmentAuthority(initial, profile(),
    'manager-a', 'governance-v1', 12)).toThrow('authority person');
  const references = { ...initial.live.references, staffRoleLinks: [
    initial.live.references.staffRoleLinks[0]!,
    { roleId: 'gm-role', roleKind: 'OTHER' as const,
      personId: 'gm-2', appointmentId: 'gm-appointment-2' },
  ] };
  const changed = applyClubCommand(initial, command([{
    kind: 'UPDATE_REFERENCES', references,
  }], initial, 'gm-change'));
  if (!changed.ok) throw new Error(JSON.stringify(changed.reason));
  expect(() => deriveRecruitmentAuthority(changed.state, profile(),
    'gm-1', 'governance-v1', 12)).toThrow('authority person');
  expect(deriveRecruitmentAuthority(changed.state, profile(),
    'gm-2', 'governance-v1', 12).clubRevision).toBe(1);
});

it('rejects wrong governance, season, club, version, future and unknown fields', () => {
  const current = club();
  expect(() => deriveRecruitmentAuthority(current,
    { ...profile(), governanceRef: 'other' },
    'gm-1', 'governance-v1', 12)).toThrow();
  expect(() => deriveRecruitmentAuthority(current,
    { ...profile(), season: 2 },
    'gm-1', 'governance-v1', 12)).toThrow();
  expect(() => deriveRecruitmentAuthority(current,
    { ...profile(), clubId: 'other' },
    'gm-1', 'governance-v1', 12)).toThrow();
  expect(() => deriveRecruitmentAuthority(current, profile(),
    'gm-1', 'old-version', 12)).toThrow();
  expect(() => deriveRecruitmentAuthority(current,
    { ...profile(), availableAtDay: 13 },
    'gm-1', 'governance-v1', 12)).toThrow();
  const contaminated = { ...profile(), trueSkill: 99 };
  expect(() => deriveRecruitmentAuthority(current, contaminated,
    'gm-1', 'governance-v1', 12)).toThrow('unknown');
});
