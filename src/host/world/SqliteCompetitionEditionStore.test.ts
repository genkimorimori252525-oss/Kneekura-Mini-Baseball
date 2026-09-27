import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { expect, it } from 'vitest';
import { applyCompetitionReform } from
  '../../core/world/competition/CompetitionEdition';
import { EMPTY_COMPETITION_DRAW_POLICY_REGISTRY,
  registerCompetitionDrawPolicy } from
  '../../core/world/competition/CompetitionDraw';
import { openSqliteCompetitionEditionStore } from
  './SqliteCompetitionEditionStore';

const { DatabaseSync }: typeof import('node:sqlite') =
  createRequire(import.meta.url)('node:sqlite');
const profile = {
  competitionId: 'wbc', formatVersion: 'format-v1',
  ruleProfileVersion: 'rules-v1',
  hostingPolicyVersion: 'host-v1', drawPolicyVersion: 'draw-v1',
  drawPolicy: { version: 'draw-v1', relaxationOrder: [
    'REMATCH_AVOIDANCE', 'REGIONAL_DIVERSITY',
    'SAME_LEAGUE_AVOIDANCE',
  ] as const },
  awardPolicyVersion: 'awards-v1',
  canonicalRole: 'NATIONAL_WORLD_CHAMPIONSHIP',
};
const input = {
  editionId: 'wbc-2027', qualificationSnapshotId: 'qualification-2027',
  participantIds: ['nation-jp', 'nation-us'],
  host: { nationId: 'US', cityIds: ['city-a'],
    venueIds: ['venue-a'] },
  calendarWindow: { startsOnDay: 100, endsOnDay: 120 },
  drawSnapshotId: 'draw-2027', prestigeAtEdition: 80,
};
const registry = registerCompetitionDrawPolicy(
  EMPTY_COMPETITION_DRAW_POLICY_REGISTRY, profile.drawPolicy);

it('replays the historical edition after restart and keeps a reformed edition separate', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-edition-'));
  const path = join(directory, 'world.sqlite');
  try {
    const first = openSqliteCompetitionEditionStore(path);
    const old = first.initialize('career-1', profile, input,
      registry);
    expect(first.initialize('career-1', profile, input,
      registry)).toEqual(old);
    const reformed = applyCompetitionReform(profile, {
      eventId: 'reform-1', effectiveAfterEditionId: 'wbc-2027',
      newFormatVersion: 'format-v2',
    });
    first.initialize('career-1', reformed,
      { ...input, editionId: 'wbc-2031',
        qualificationSnapshotId: 'qualification-2031',
        drawSnapshotId: 'draw-2031' }, registry);
    first.close();
    const reopened = openSqliteCompetitionEditionStore(path);
    expect(reopened.readEdition('career-1', 'wbc-2027'))
      .toEqual(old);
    expect(reopened.readEdition('career-1', 'wbc-2031')
      ?.formatVersion).toBe('format-v2');
    expect(() => reopened.initialize('career-1', profile,
      { ...input, participantIds: ['nation-us'] }, registry))
      .toThrow('already frozen differently');
    const changedPolicy = { ...profile, drawPolicy: {
      ...profile.drawPolicy, relaxationOrder: [
        'SAME_LEAGUE_AVOIDANCE', 'REGIONAL_DIVERSITY',
        'REMATCH_AVOIDANCE',
      ] as const } };
    const changedRegistry = registerCompetitionDrawPolicy(
      EMPTY_COMPETITION_DRAW_POLICY_REGISTRY,
      changedPolicy.drawPolicy);
    expect(() => reopened.initialize('career-1', changedPolicy,
      { ...input, editionId: 'wbc-2035' }, changedRegistry))
      .toThrow('draw policy version');
    reopened.close();
    const database = new DatabaseSync(path);
    database.prepare(`UPDATE world_competition_editions
      SET snapshot_json='{}' WHERE career_id='career-1'
      AND edition_id='wbc-2027'`).run();
    database.close();
    const corrupted = openSqliteCompetitionEditionStore(path);
    expect(() => corrupted.readEdition('career-1', 'wbc-2027'))
      .toThrow('corrupt competition edition');
    corrupted.close();
  } finally {
    const root = realpathSync(tmpdir());
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-edition-')) {
      throw new Error('test cleanup target escaped its temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});
