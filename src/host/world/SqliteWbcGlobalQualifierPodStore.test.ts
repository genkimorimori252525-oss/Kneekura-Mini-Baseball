import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import type { OfficialGameResult } from
  '../../core/world/competition/OfficialGameCompletion';
import type { WbcQualifierSelection } from
  '../../core/world/competition/WbcGlobalQualifierSelection';
import type { WbcGlobalQualifierEdition,
  WbcQualifierGame } from
  '../../core/world/competition/WbcGlobalQualifierPods';
import { openSqliteWbcGlobalQualifierPodStore } from
  './SqliteWbcGlobalQualifierPodStore';
import { openSqliteNationalQualificationHistoryStore,
  type SqliteNationalQualificationHistoryStore } from
  './SqliteNationalQualificationHistoryStore';
import type { PostseasonMatchSource } from
  './PostseasonResultsFromMatches';

const { DatabaseSync }: typeof import('node:sqlite') =
  createRequire(import.meta.url)('node:sqlite');
const regions = ['ASIA_PACIFIC', 'AMERICAS',
  'EUROPE', 'AFRICA'] as const;
const edition: WbcGlobalQualifierEdition = {
  competitionId: 'wbc-global-qualifier',
  editionId: 'qualifier-2032',
  canonicalRole: 'WBC_GLOBAL_QUALIFIER',
  formatVersion: 'four-pods-v1',
  ruleProfileVersion: 'national-rules-v1',
  gamePolicyVersion: 'national-games-v1',
  hostingPolicyVersion: 'hosts-v1',
  qualificationSnapshotId: 'selected-16',
  drawSnapshotId: 'draw-16',
  calendarWindow: { startsOnDay: 40, endsOnDay: 50 },
  pods: Array.from({ length: 4 }, (_, podIndex) => ({
    podIndex, hostNationId: `host-${podIndex}`,
    hostCityId: `city-${podIndex}`,
    hostVenueId: `venue-${podIndex}`,
    entrants: regions.map((region) => ({
      nationId: `${region}-${podIndex}`, region })),
  })),
};
const selection: WbcQualifierSelection = {
  qualifierEditionId: edition.editionId,
  directSnapshotId: 'direct-20',
  rankingSnapshotId: 'ranking-90',
  eligibilitySnapshotId: 'eligible-90',
  policyVersion: 'selection-v1',
  qualificationSnapshotId: edition.qualificationSnapshotId,
  entrants: edition.pods.flatMap((pod) =>
    pod.entrants.map((entrant) => ({ ...entrant,
      route: 'REGIONAL_PRIORITY' as const,
      sourceId: 'placement-1' }))),
};
const result = (game: WbcQualifierGame,
  index: number): OfficialGameResult => ({
  gameId: game.gameId, seasonId: edition.editionId,
  homeClubId: game.homeNationId,
  awayClubId: game.awayNationId,
  homeRuns: 2, awayRuns: 1,
  winnerClubId: game.homeNationId,
  completionReason: 'BOTTOM_COMPLETE',
  ruleProfileId: asRuleProfileId(edition.ruleProfileVersion),
  gamePolicyVersion: edition.gamePolicyVersion,
  closureId: `closure-${index}`,
  applicationId: `application-${index}`,
  durableRevision: index + 1,
  venueBinding: { gameId: game.gameId, venueId: game.venueId,
    fixtureEventId: `fixture-${index}`, fixtureRevision: 1 },
  lineScore: { innings: [{ inning: 1,
    homeRuns: 2, awayRuns: 1 }], totals: {
    home: { runs: 2, hits: 0, errors: 0 },
    away: { runs: 1, hits: 0, errors: 0 } } },
});

it('advances four qualifier pods only after durable official finals', () => {
  const directory = mkdtempSync(join(tmpdir(), 'wbc-pods-'));
  const path = join(directory, 'world.sqlite');
  const finals = new Map<string, OfficialGameResult>();
  let qualification: SqliteNationalQualificationHistoryStore | null = null;
  let selectionChanged = false;
  const sources = {
    selection: { readSelection: () => {
      // Direct berths read regional history while revalidating this selection.
      qualification?.regionalAuthority('career-1')
        .regionalChampionship('ASIA_PACIFIC', 50);
      return selectionChanged
        ? { ...selection, qualificationSnapshotId: 'changed' }
        : selection;
    } },
    matches: {
      getMatch: (gameId: string) => {
        const finalResult = finals.get(gameId);
        return finalResult ? { finalResult } : null;
      },
      getOfficialFixture: (gameId: string) =>
        finals.get(gameId)?.venueBinding ?? null,
    } as PostseasonMatchSource,
  };
  const store = openSqliteWbcGlobalQualifierPodStore(path,
    sources);
  try {
    const plan = store.initialize({ careerId: 'career-1', edition });
    expect(store.finalize('career-1', edition.editionId))
      .toBeNull();
    expect(store.finalGames('career-1', edition.editionId))
      .toBeNull();
    plan.pods.flatMap((pod) => pod.semifinals)
      .forEach((game, index) => finals.set(game.gameId,
        result(game, index)));
    const finalGames = store.finalGames('career-1',
      edition.editionId)!;
    expect(finalGames).toHaveLength(4);
    expect(store.finalize('career-1', edition.editionId))
      .toBeNull();
    finalGames.forEach((game, index) => finals.set(game.gameId,
      result(game, index + 8)));
    const outcome = store.finalize('career-1',
      edition.editionId)!;
    expect(outcome.winners).toHaveLength(4);
    expect(store.readEvidence('career-1',
      edition.editionId)?.outcome).toEqual(outcome);
    qualification = openSqliteNationalQualificationHistoryStore(path,
      { knockouts: { readEvidence: () => null },
        qualifiers: { readEvidence: () =>
          store.readEvidence('career-1', edition.editionId) },
        selections: sources.selection });
    qualification.initialize('career-1', {
      ASIA_PACIFIC: 'regional-ap', AMERICAS: 'regional-am',
      EUROPE: 'regional-eu', AFRICA: 'regional-af' });
    expect(() => qualification!.recordQualifier('career-1',
      'foreign-edition')).toThrow('edition');
    const qualified = qualification.recordQualifier('career-1',
      edition.editionId);
    expect(qualified.qualifiers[0].winners).toEqual(outcome.winners);
    expect(qualification.readHistory('career-1')).toEqual(qualified);
    expect(qualification.recordQualifier('career-1',
      edition.editionId)).toEqual(qualified);
    expect(qualification.qualifierAuthority('career-1')
      .qualifierPodWinner(0, 49)).toBeNull();
    expect(qualification.qualifierAuthority('career-1')
      .qualifierPodWinner(0, 50)).toEqual(outcome.winners[0]);
    qualification.close();
    qualification = openSqliteNationalQualificationHistoryStore(path,
      { knockouts: { readEvidence: () => null },
        qualifiers: store, selections: sources.selection });
    expect(qualification.readHistory('career-1')).toEqual(qualified);
    qualification.close();
    qualification = null;
    store.close();
    const reopened = openSqliteWbcGlobalQualifierPodStore(path,
      sources);
    expect(reopened.readOutcome('career-1', edition.editionId))
      .toEqual(outcome);
    selectionChanged = true;
    expect(() => reopened.readOutcome('career-1',
      edition.editionId)).toThrow('corrupt WBC qualifier pods');
    selectionChanged = false;
    reopened.close();
    const db = new DatabaseSync(path);
    db.prepare(`UPDATE world_wbc_qualifier_pods SET outcome_json='{}'
      WHERE career_id='career-1'`).run();
    db.close();
    const tampered = openSqliteWbcGlobalQualifierPodStore(path,
      sources);
    expect(() => tampered.readOutcome('career-1',
      edition.editionId)).toThrow('corrupt WBC qualifier pods');
    tampered.close();
  } finally {
    qualification?.close();
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

it('reads eligible qualifier results even when a later completion was recorded first', () => {
  const directory = mkdtempSync(join(tmpdir(), 'wbc-history-prefix-'));
  const path = join(directory, 'world.sqlite');
  const finals = new Map<string, OfficialGameResult>();
  const accepted = new Map<string, WbcQualifierSelection>();
  const pods = openSqliteWbcGlobalQualifierPodStore(':memory:', {
    selection: { readSelection: (_careerId, editionId) => accepted.get(editionId) ?? null },
    matches: { getMatch: (gameId: string) => {
      const finalResult = finals.get(gameId);
      return finalResult ? { finalResult } : null;
    }, getOfficialFixture: (gameId: string) => finals.get(gameId)?.venueBinding ?? null } as PostseasonMatchSource,
  });
  let laterSourceUnavailable = false;
  const history = openSqliteNationalQualificationHistoryStore(path, {
    knockouts: { readEvidence: () => null },
    qualifiers: { readEvidence: (careerId, editionId) => {
      if (laterSourceUnavailable && editionId === 'later') throw new Error('future source traversed');
      return pods.readEvidence(careerId, editionId);
    } }, selections: { readSelection: (_careerId, editionId) => accepted.get(editionId) ?? null },
  });
  try {
    history.initialize('career-1', { ASIA_PACIFIC: 'regional-ap', AMERICAS: 'regional-am',
      EUROPE: 'regional-eu', AFRICA: 'regional-af' });
    for (const [editionId, completedAtDay] of [['later', 50], ['earlier', 30]] as const) {
      const input = { ...edition, editionId,
        calendarWindow: { startsOnDay: completedAtDay - 10, endsOnDay: completedAtDay } };
      accepted.set(editionId, { ...selection, qualifierEditionId: editionId });
      const plan = pods.initialize({ careerId: 'career-1', edition: input });
      const put = (game: WbcQualifierGame, index: number): void => {
        const original = result(game, index);
        finals.set(game.gameId, { ...original, seasonId: editionId,
          closureId: `${editionId}-closure-${index}`, applicationId: `${editionId}-application-${index}`,
          venueBinding: { ...original.venueBinding!, fixtureEventId: `${editionId}-fixture-${index}` } });
      };
      plan.pods.flatMap((pod) => pod.semifinals).forEach(put);
      pods.finalGames('career-1', editionId)!.forEach((game, index) => put(game, index + 8));
      pods.finalize('career-1', editionId);
      history.recordQualifier('career-1', editionId);
    }
    laterSourceUnavailable = true;
    const eligible = history.readHistory('career-1', 30)!;
    expect(eligible.qualifiers.map((item) => item.editionId)).toEqual(['earlier']);
    expect(history.qualifierAuthority('career-1').qualifierPodWinner(0, 30)?.qualifierEditionId)
      .toBe('earlier');
    expect(() => history.readHistory('career-1', 50)).toThrow('corrupt');
    const db = new DatabaseSync(path);
    try {
      const row = db.prepare('SELECT history_json FROM world_national_qualification_events WHERE ordinal=1').get()!;
      const original = row.history_json as string;
      const changed = JSON.parse(original);
      changed.qualifiers[0].rankingSnapshotId = 'changed-prior-prefix';
      db.prepare('UPDATE world_national_qualification_events SET history_json=? WHERE ordinal=1')
        .run(JSON.stringify(changed));
      expect(() => history.readHistory('career-1', 30)).toThrow('corrupt');
    } finally { db.close(); }
  } finally { history.close(); pods.close(); rmSync(directory, { recursive: true, force: true }); }
});
