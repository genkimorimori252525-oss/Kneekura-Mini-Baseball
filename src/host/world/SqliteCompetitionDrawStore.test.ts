import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { expect, it } from 'vitest';
import { EMPTY_COMPETITION_DRAW_POLICY_REGISTRY,
  registerCompetitionDrawPolicy } from
  '../../core/world/competition/CompetitionDraw';
import { openSqliteCompetitionDrawStore } from
  './SqliteCompetitionDrawStore';
import { openSqliteCompetitionEditionStore } from
  './SqliteCompetitionEditionStore';

const { DatabaseSync }: typeof import('node:sqlite') =
  createRequire(import.meta.url)('node:sqlite');
const participantIds = Array.from({ length: 16 }, (_, index) =>
  `club-${index + 1}`);
const profile = { competitionId: 'continental-a',
  formatVersion: 'continental-16-v1',
  ruleProfileVersion: 'continental-rules-v1',
  hostingPolicyVersion: 'final-four-host-v1',
  drawPolicyVersion: 'draw-v1',
  drawPolicy: { version: 'draw-v1', relaxationOrder: [
    'REMATCH_AVOIDANCE', 'REGIONAL_DIVERSITY',
    'SAME_LEAGUE_AVOIDANCE',
  ] as const },
  awardPolicyVersion: 'award-v1', canonicalRole: 'CONTINENTAL_CL',
};
const registry = registerCompetitionDrawPolicy(
  EMPTY_COMPETITION_DRAW_POLICY_REGISTRY, profile.drawPolicy);
const editionInput = { editionId: 'continental-2027',
  qualificationSnapshotId: 'qualified-2027',
  participantIds,
  host: { nationId: 'nation-1', cityIds: ['city-1'],
    venueIds: ['venue-1'] },
  calendarWindow: { startsOnDay: 1, endsOnDay: 30 },
  drawSnapshotId: 'draw-2027', prestigeAtEdition: 1,
  finalFourHostCandidates: [{ venueId: 'venue-1',
    nationId: 'nation-1', cityId: 'city-1', regionId: 'region-1',
    eligible: true, suitabilityScore: 10, rotationScore: 1 }],
  finalFourPairingPolicy: { version: 'sf-v1',
    semifinalPairs: [[0, 1], [2, 3]] as const },
};
const request = { careerId: 'career-1', editionId: 'continental-2027',
  drawSeed: 'seed-2027',
  participants: participantIds.map((teamId, index) => ({
    teamId, pot: index % 4 + 1,
    leagueId: `league-${Math.floor(index / 4) + 1}`,
    regionId: `region-${Math.floor(index / 4) + 1}`,
  })),
  rematchPairs: [] as readonly (readonly [string, string])[],
};

it('draws only frozen Edition entrants and replays the policy after restart', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-draw-'));
  const path = join(directory, 'world.sqlite');
  try {
    const editions = openSqliteCompetitionEditionStore(path);
    editions.initialize('career-1', profile, editionInput,
      registry);
    const draws = openSqliteCompetitionDrawStore(path, editions);
    const drawn = draws.initialize(request);
    expect(drawn.drawSnapshotId).toBe('draw-2027');
    expect(drawn.draw.groups).toHaveLength(4);
    expect(drawn.draw.groups.flat().map((entry) => entry.teamId)
      .sort()).toEqual([...participantIds].sort());
    expect(draws.initialize(request)).toEqual(drawn);
    draws.close(); editions.close();
    const reopenedEditions = openSqliteCompetitionEditionStore(path);
    const reopened = openSqliteCompetitionDrawStore(path,
      reopenedEditions);
    expect(reopened.readDraw('career-1', 'continental-2027'))
      .toEqual(drawn);
    expect(() => reopened.initialize({ ...request,
      participants: request.participants.slice(1) }))
      .toThrow('draw entrants differ');
    reopened.close(); reopenedEditions.close();
    const database = new DatabaseSync(path);
    database.prepare(`UPDATE world_competition_draws
      SET snapshot_json='{}' WHERE career_id='career-1'
      AND edition_id='continental-2027'`).run();
    database.close();
    const lastEditions = openSqliteCompetitionEditionStore(path);
    const corrupted = openSqliteCompetitionDrawStore(path,
      lastEditions);
    expect(() => corrupted.readDraw('career-1', 'continental-2027'))
      .toThrow('corrupt competition draw');
    corrupted.close(); lastEditions.close();
  } finally {
    const root = realpathSync(tmpdir());
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-draw-')) {
      throw new Error('test cleanup target escaped its temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});
