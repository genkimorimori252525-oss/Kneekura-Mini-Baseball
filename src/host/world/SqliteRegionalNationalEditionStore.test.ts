import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import * as editionModule from './SqliteRegionalNationalEditionStore';
import { regionalNationalAssemblyFixture } from './RegionalNationalAssemblyFixtures.test-support';
import { openSqliteRegionalNationalDrawStore } from './SqliteRegionalNationalDrawStore';
import { registerCompetitionDrawPolicy, EMPTY_COMPETITION_DRAW_POLICY_REGISTRY } from '../../core/world/competition/CompetitionDraw';
import { openSqliteRegionalNationalGroupStore } from './SqliteRegionalNationalGroupStore';
import { openSqliteRegionalNationalScheduleStore } from './SqliteRegionalNationalScheduleStore';
import { openSqliteRegionalNationalKnockoutStore } from './SqliteRegionalNationalKnockoutStore';

it.each([8, 12, 16])('generates the %i-country regional Edition and knockout from Native accepted roster, draw and public hosts', (count) => {
  expect(editionModule).toHaveProperty('openSqliteRegionalNationalEditionStore');
  const f = regionalNationalAssemblyFixture(count);
  const draws = openSqliteRegionalNationalDrawStore(f.path, f.drawSources);
  const drawPolicy = { ...f.drawRequest.policy, hostPot1CandidateRule: 'QUALIFIED_HOSTS_FIRST' as const };
  const acceptedDraw = draws.initialize({ ...f.drawRequest, policy: drawPolicy,
    registry: registerCompetitionDrawPolicy(EMPTY_COMPETITION_DRAW_POLICY_REGISTRY, drawPolicy) });
  const sources = { draws, hosts: f.hosts, nations: f.nations };
  let editions = editionModule.openSqliteRegionalNationalEditionStore(f.path, sources);
  const qualifierCount = count === 8 ? 4 : 8;
  const profile = { competitionId: 'regional-europe', formatVersion: `regional-${count}-fixture-v1`,
    ruleProfileVersion: 'national-rules-v1', gamePolicyVersion: 'national-games-v1', hostingPolicyVersion: f.hostPolicy.version,
    tiebreakPolicy: { version: 'regional-group-fixture-v1', tieCreditNumerator: 0, tieCreditDenominator: 1, runDifferentialCapPerGame: 5 },
    bestThirdPolicy: { version: 'regional-third-fixture-v1', criteria: ['WINS', 'CAPPED_RUN_DIFFERENTIAL', 'RUNS_AGAINST'] as const },
    groupHostIndices: Array.from({ length: count / 4 }, (_, i) => i % 2),
    knockoutPolicy: { version: 'regional-ko-fixture-v1', openingPairs: Array.from({ length: qualifierCount / 2 }, (_, i) => [i * 2, i * 2 + 1] as const),
      openingHubIndices: Array.from({ length: qualifierCount / 2 }, () => 0), semifinalHubIndices: [0, 0],
      placementPolicy: { version: 'regional-placement-fixture-v1', criteria: ['GROUP_WINS', 'GROUP_RUN_DIFFERENTIAL', 'GROUP_RUNS_AGAINST'] as const } } };
  const request = { careerId: 'career-a', editionId: f.selection.editionId, profile, bestThirdDrawSeed: 'third-seed', placementDrawSeed: 'placement-seed' };
  try {
    expect(() => editions.initialize({ ...request, profile: { ...profile, groupHostIndices: [9, ...profile.groupHostIndices.slice(1)] } }))
      .toThrow('group host mapping');
    expect(editions.readSnapshot('career-a', f.selection.editionId)).toBeNull();
    const accepted = editions.initialize(request);
    expect(accepted.edition.groups.map((group) => group.hostVenueId)).toEqual(profile.groupHostIndices.map((index) => `venue-${count - index}`));
    expect(accepted.edition.groups.flatMap((group) => group.nationIds).sort()).toEqual(f.nationIds.slice(0, count));
    expect(accepted.edition.hostNationIds).toEqual([f.nationIds[count - 1], f.nationIds[count]]);
    expect(accepted.edition.qualificationSnapshotId).toBe(f.cohort.eligibility.snapshotId);
    expect(accepted.edition.drawSnapshotId).toBe(acceptedDraw.drawSnapshotId);
    expect(accepted.knockoutEdition.openingVenueIds).toEqual(Array.from({ length: qualifierCount / 2 }, () => `venue-${count}`));
    expect(accepted.knockoutEdition.finalVenueId).toBe(`venue-${count}`);
    expect(editions.initialize(request)).toEqual(accepted);
    expect(() => editions.initialize({ ...request, placementDrawSeed: 'another-seed' })).toThrow('frozen differently');
    editions.close(); editions = editionModule.openSqliteRegionalNationalEditionStore(f.path, sources);
    expect(editions.readSnapshot('career-a', f.selection.editionId)).toEqual(accepted);
    const groups = openSqliteRegionalNationalGroupStore(':memory:', { regions: f.nations, selections: f.selections, draws,
      editions: { readEdition: (careerId: string, editionId: string) => editions.readEdition(careerId, editionId) },
      matches: { getMatch: () => null, getOfficialFixture: () => null } });
    const acceptedEditions = { readEdition: (careerId: string, editionId: string) => editions.readEdition(careerId, editionId),
      readKnockoutEdition: (careerId: string, editionId: string) => editions.readKnockoutEdition(careerId, editionId) };
    const schedules = openSqliteRegionalNationalScheduleStore(':memory:', { groups, selections: f.selections, editions: acceptedEditions });
    const knockouts = openSqliteRegionalNationalKnockoutStore(':memory:', { groups, regions: f.nations,
      editions: acceptedEditions,
      matches: { getMatch: () => null, getOfficialFixture: () => null } });
    try {
      expect(() => groups.initialize('career-a', { ...accepted.edition, ruleProfileVersion: 'manual-rules' })).toThrow('accepted regional Edition');
      expect(() => groups.initialize('career-a', { ...accepted.edition, groups: accepted.edition.groups.map((group, i) => i === 0
        ? { ...group, hostVenueId: 'manual-host-venue' } : group) })).toThrow('accepted regional Edition');
      groups.initialize('career-a', accepted.edition);
      expect(() => knockouts.initialize('career-a', { ...accepted.knockoutEdition, finalVenueId: 'manual-final' })).toThrow('accepted regional Edition');
      expect(() => knockouts.initialize('career-a', accepted.knockoutEdition)).toThrow('frozen group outcome');
      expect(() => schedules.initialize({ careerId: 'career-a', editionId: f.selection.editionId,
        knockoutEdition: { ...accepted.knockoutEdition, finalVenueId: 'manual-final' },
        policy: { version: 'regional-schedule-fixture-v1', gamesPerVenuePerDay: 2, minimumOffDaysBetweenRounds: 0 } })).toThrow('accepted regional Edition');
      const schedule = schedules.initialize({ careerId: 'career-a', editionId: f.selection.editionId,
        knockoutEdition: accepted.knockoutEdition, policy: { version: 'regional-schedule-fixture-v1', gamesPerVenuePerDay: 2, minimumOffDaysBetweenRounds: 0 } });
      expect(schedule.games).toHaveLength(count === 8 ? 15 : count === 12 ? 25 : 31);
      // Each downstream owner verifies the group Edition even if its group source is legacy/unconnected.
      const legacyGroups = openSqliteRegionalNationalGroupStore(':memory:', { regions: f.nations, draws,
        matches: { getMatch: () => null, getOfficialFixture: () => null } });
      const partialSchedule = openSqliteRegionalNationalScheduleStore(':memory:', { groups: legacyGroups, selections: f.selections, editions: acceptedEditions });
      const partialKnockout = openSqliteRegionalNationalKnockoutStore(':memory:', { groups: legacyGroups, regions: f.nations, editions: acceptedEditions,
        matches: { getMatch: () => null, getOfficialFixture: () => null } });
      try {
        legacyGroups.initialize('career-a', { ...accepted.edition,
          groups: accepted.edition.groups.map((group, i) => i === 0 ? { ...group, hostVenueId: 'manual-host-venue' } : group) });
        expect(() => partialSchedule.initialize({ careerId: 'career-a', editionId: f.selection.editionId,
          knockoutEdition: accepted.knockoutEdition, policy: schedule.policy })).toThrow('accepted regional Edition');
        expect(() => partialKnockout.initialize('career-a', accepted.knockoutEdition)).toThrow('accepted regional Edition');
      } finally { partialKnockout.close(); partialSchedule.close(); legacyGroups.close(); }
      const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
      const sourceDb = new DatabaseSync(f.path);
      try {
        const stored = sourceDb.prepare('SELECT snapshot_json FROM world_regional_national_editions').get() as { snapshot_json: string };
        sourceDb.prepare("UPDATE world_regional_national_editions SET snapshot_json='{}'").run();
        expect(() => groups.readPlan('career-a', f.selection.editionId)).toThrow('corrupt');
        expect(() => schedules.readSchedule('career-a', f.selection.editionId)).toThrow('corrupt');
        sourceDb.prepare('UPDATE world_regional_national_editions SET snapshot_json=?').run(stored.snapshot_json);
        expect(schedules.readSchedule('career-a', f.selection.editionId)).toEqual(schedule);
        const savedProfile = sourceDb.prepare('SELECT profile_json FROM world_regional_national_edition_profiles').get() as { profile_json: string };
        sourceDb.prepare("UPDATE world_regional_national_edition_profiles SET profile_json='{}'").run();
        expect(() => editions.readSnapshot('career-a', f.selection.editionId)).toThrow('corrupt');
        sourceDb.prepare('UPDATE world_regional_national_edition_profiles SET profile_json=?').run(savedProfile.profile_json);
      } finally { sourceDb.close(); }
    } finally { knockouts.close(); schedules.close(); groups.close(); }
    const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
    const db = new DatabaseSync(f.path);
    try { db.prepare("UPDATE world_regional_national_editions SET snapshot_json='{}'").run(); }
    finally { db.close(); }
    expect(() => editions.readSnapshot('career-a', f.selection.editionId)).toThrow('corrupt');
  } finally { editions.close(); draws.close(); f.close(); }
});
