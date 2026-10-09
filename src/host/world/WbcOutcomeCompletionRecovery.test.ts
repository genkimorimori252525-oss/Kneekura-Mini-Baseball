import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import type { OfficialGameResult } from '../../core/world/competition/OfficialGameCompletion';
import type { WbcGlobalQualifierEdition } from '../../core/world/competition/WbcGlobalQualifierPods';
import type { WbcQualifierSelection } from '../../core/world/competition/WbcGlobalQualifierSelection';
import type { PostseasonMatchSource } from './PostseasonResultsFromMatches';
import type { CompletedMatchPlayerOutcomes } from './SqliteOfficialPlayerOutcomeStore';
import { openSqliteWbcFinalsGroupStore } from './SqliteWbcFinalsGroupStore';
import { openSqliteWbcFinalsKnockoutStore } from './SqliteWbcFinalsKnockoutStore';
import { openSqliteWbcGlobalQualifierPodStore } from './SqliteWbcGlobalQualifierPodStore';
import { wbcFinalsInput } from './WbcFinalsFixtures.test-support';
import { completeWorldBoundWbcFinals, initializeWorldBoundWbcKnockout, resumePendingWorldBoundWbcFinals,
  type WorldBoundWbcFinalsStores } from './WorldBoundWbcFinalsRuntime';
import { completeWorldBoundWbcQualifier, resumePendingWorldBoundWbcQualifier,
  type WorldBoundWbcQualifierStores } from './WorldBoundWbcQualifierRuntime';

const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
// Native competition rows/reopen/CAS; Match finals and statistics are deliberately
// substituted. This does not qualify the independent National Native scenario.
const fixture = (kind: 'finals' | 'qualifier', legacy = false) => {
  const directory = mkdtempSync(join(tmpdir(), 'wbc-outcome-recovery-')), path = join(directory, 'world.sqlite');
  const table = kind === 'finals' ? 'world_wbc_finals_knockout' : 'world_wbc_qualifier_pods';
  const editionId = kind === 'finals' ? 'wbc-2032' : 'qualifier-2032';
  const input = wbcFinalsInput({ startsOnDay: 110, endsOnDay: 140 }, 'cutoff');
  const finals = new Map<string, OfficialGameResult>();
  const matches = { getMatch: (id: string) => finals.has(id) ? { finalResult: finals.get(id) } : null,
    getOfficialFixture: (id: string) => finals.get(id)?.venueBinding ?? null } as PostseasonMatchSource;
  const put = (game: { gameId: string; homeNationId: string; awayNationId: string; venueId: string }) => {
    finals.set(game.gameId, { gameId: game.gameId, seasonId: editionId, homeClubId: game.homeNationId,
      awayClubId: game.awayNationId, homeRuns: 2, awayRuns: 1, winnerClubId: game.homeNationId,
      completionReason: 'BOTTOM_COMPLETE', ruleProfileId: asRuleProfileId('wbc-rules-v1'), gamePolicyVersion: 'wbc-game-v1',
      closureId: `closure-${game.gameId}`, applicationId: `application-${game.gameId}`, durableRevision: 1,
      venueBinding: { gameId: game.gameId, venueId: game.venueId, fixtureEventId: `fixture-${game.gameId}`, fixtureRevision: 1 },
      lineScore: { innings: [{ inning: 1, homeRuns: 2, awayRuns: 1 }], totals: {
        home: { runs: 2, hits: 0, errors: 0 }, away: { runs: 1, hits: 0, errors: 0 } } } });
  };
  const commitment = { version: 'wbc_player_outcomes_v1' as const, wbcEditionId: 'wbc-2032' };
  const groups = kind === 'finals' ? openSqliteWbcFinalsGroupStore(path,
    { berths: { readAllocation: () => input.berths }, matches }) : null;
  const regions = ['ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'] as const;
  const qualifier: WbcGlobalQualifierEdition = { competitionId: 'wbc-global-qualifier', editionId,
    canonicalRole: 'WBC_GLOBAL_QUALIFIER', formatVersion: 'four-pods-v1', ruleProfileVersion: 'wbc-rules-v1',
    gamePolicyVersion: 'wbc-game-v1', hostingPolicyVersion: 'hosts-v1', qualificationSnapshotId: 'selected-16',
    drawSnapshotId: 'draw-16', calendarWindow: { startsOnDay: 40, endsOnDay: 50 },
    pods: Array.from({ length: 4 }, (_, podIndex) => ({ podIndex, hostNationId: `host-${podIndex}`,
      hostCityId: `city-${podIndex}`, hostVenueId: `venue-${podIndex}`,
      entrants: regions.map(region => ({ nationId: `${region}-${podIndex}`, region })) })) };
  const selection: WbcQualifierSelection = { qualifierEditionId: editionId, directSnapshotId: 'direct', rankingSnapshotId: 'ranking',
    eligibilitySnapshotId: 'eligible', policyVersion: 'selection', qualificationSnapshotId: 'selected-16',
    entrants: qualifier.pods.flatMap(pod => pod.entrants.map(entrant => ({ ...entrant,
      route: 'REGIONAL_PRIORITY' as const, sourceId: 'placement' }))) };
  const open = () => kind === 'finals' ? openSqliteWbcFinalsKnockoutStore(path, { groups: groups!, matches })
    : openSqliteWbcGlobalQualifierPodStore(path, { selection: { readSelection: () => selection }, matches });
  let owner = open();
  const state = { fail: true, alter: false, calls: [] as string[], writes: new Set<string>(), effects: [] as string[] };
  const outcomes = { applyCompletedGame({ gameId }: { careerId: string; gameId: string }): CompletedMatchPlayerOutcomes {
    state.calls.push(gameId);
    if (state.fail && state.calls.length % 2 === 0) throw new Error('interrupted WBC outcomes');
    const finalResult = finals.get(gameId)!;
    state.writes.add(gameId);
    if (state.alter && state.calls.length === finals.size) {
      const first = finals.values().next().value!;
      finals.set(first.gameId, { ...first, venueBinding: { ...first.venueBinding!, fixtureRevision: 2 } });
    }
    return { finalResult, coverage: 'attributed_supported_plays_only', plays: [] };
  } };
  const stores = (authority = true) => kind === 'finals' ? {
    outcomes: authority ? outcomes : undefined,
    editions: { readSnapshot: () => ({ kind: 'WBC', knockoutEdition: input.knockoutEdition }) }, groups,
    knockout: owner, history: { record: () => { state.effects.push('history'); return {}; } },
    rankingHistory: { recordWbc: () => { state.effects.push('ranking'); return {}; } },
  } as unknown as WorldBoundWbcFinalsStores : {
    outcomes: authority ? outcomes : undefined, pods: owner,
    qualification: { readSnapshot: () => ({ input: { qualifierEditionId: editionId } }) },
    history: { recordQualifier: () => { state.effects.push('history'); return {}; } },
    hosts: { recordCompletedEdition: () => { state.effects.push('hosts'); return {}; } },
    berths: { initialize: () => { state.effects.push('berths'); return { entrantNationIds: ['nation'] }; } },
  } as unknown as WorldBoundWbcQualifierStores;
  if (kind === 'finals') {
    const groupPlan = groups!.initialize({ careerId: 'career', edition: input.edition });
    groupPlan.groups.flatMap(group => group.games).forEach(put);
    groups!.finalize('career', editionId);
    const knockout = owner as ReturnType<typeof openSqliteWbcFinalsKnockoutStore>;
    const plan = legacy ? knockout.initialize({ careerId: 'career', edition: input.knockoutEdition })
      : initializeWorldBoundWbcKnockout(stores() as WorldBoundWbcFinalsStores, 'career', editionId)!;
    plan.roundOf16Games.forEach(put);
    knockout.quarterfinalGames('career', editionId)!.forEach(put);
    knockout.semifinalGames('career', editionId)!.forEach(put);
    put(knockout.finalGame('career', editionId)!);
  } else {
    const pods = owner as ReturnType<typeof openSqliteWbcGlobalQualifierPodStore>;
    const plan = pods.initialize({ careerId: 'career', edition: qualifier, ...(legacy ? {} : { completion: commitment }) });
    plan.pods.flatMap(pod => pod.semifinals).forEach(put);
    pods.finalGames('career', editionId)!.forEach(put);
  }
  const run = (authority = true) => kind === 'finals'
    ? completeWorldBoundWbcFinals(stores(authority) as WorldBoundWbcFinalsStores, 'career', 'wbc-2032')
    : completeWorldBoundWbcQualifier(stores(authority) as WorldBoundWbcQualifierStores, 'career', 'wbc-2032');
  const drain = (authority = true) => kind === 'finals'
    ? resumePendingWorldBoundWbcFinals(stores(authority) as WorldBoundWbcFinalsStores)
    : resumePendingWorldBoundWbcQualifier(stores(authority) as WorldBoundWbcQualifierStores);
  const saved = () => { const db = new DatabaseSync(path); try {
    return db.prepare(`SELECT * FROM ${table}`).get()!;
  } finally { db.close(); } };
  return { state, finals, run, drain, saved, editionId, path, table, owner: () => owner,
    reopen: () => { owner.close(); owner = open(); },
    close: () => { owner.close(); groups?.close(); rmSync(directory, { recursive: true, force: true }); } };
};

it.each(['finals', 'qualifier'] as const)('discovers interrupted %s delivery after reopen and drains with the retained edition identity', kind => {
  const f = fixture(kind);
  try {
    expect(f.owner().listPendingCompletions()).toMatchObject([{ careerId: 'career', editionId: f.editionId,
      status: 'PENDING', commitment: { wbcEditionId: 'wbc-2032' } }]);
    expect(() => f.run()).toThrow('interrupted WBC outcomes');
    expect(f.saved().outcome_json).not.toBeNull(); expect(f.saved().outcome_delivery_json).toBeNull();
    const accepted = f.saved(); f.reopen();
    expect(f.drain(false)[0].result?.playerOutcomes.kind).toBe('unavailable');
    expect(f.owner().listPendingCompletions()).toHaveLength(1);
    f.state.fail = false;
    expect(f.drain()[0].result?.playerOutcomes).toMatchObject({ kind: 'delivered', coverage: 'attributed_supported_plays_only' });
    expect(f.owner().listPendingCompletions()).toEqual([]); expect(f.state.writes.size).toBe(kind === 'finals' ? 51 : 12);
    expect(f.saved()).toMatchObject({ request_json: accepted.request_json, plan_json: accepted.plan_json, outcome_json: accepted.outcome_json });
    f.reopen(); expect(f.owner().readCompletion('career', f.editionId)?.status).toBe('COMPLETED');
    expect(f.drain()).toEqual([]); expect(f.run()?.playerOutcomes.kind).toBe('delivered');
    expect(f.state.writes.size).toBe(kind === 'finals' ? 51 : 12);
  } finally { f.close(); }
});
it.each(['finals', 'qualifier'] as const)('rejects changed %s original finals during delivery before the completion CAS', kind => {
  const f = fixture(kind);
  try {
    f.state.fail = false; f.state.alter = true;
    const original = [...f.finals.values()];
    expect(() => f.run()).toThrow('original changed during delivery');
    expect(f.saved().outcome_delivery_json).toBeNull(); f.reopen();
    expect(f.owner().listPendingCompletions()).toHaveLength(1);
    original.forEach(final => f.finals.set(final.gameId, final)); f.state.alter = false;
    expect(f.drain()[0].result?.playerOutcomes.kind).toBe('delivered');
    f.finals.set(original[0].gameId, { ...original[0], venueBinding: { ...original[0].venueBinding!, fixtureRevision: 9 } });
    expect(() => f.owner().readCompletion('career', f.editionId)).toThrow('original finals differ');
  } finally { f.close(); }
});
it.each(['finals', 'qualifier'] as const)('preserves legacy %s request/result bytes without enrollment', kind => {
  const f = fixture(kind, true);
  try {
    f.state.fail = false; f.run(); const saved = f.saved();
    expect(f.owner().readCompletion('career', f.editionId)?.status).toBe('LEGACY');
    expect(f.owner().listPendingCompletions()).toEqual([]); expect(saved.outcome_delivery_json).toBeNull();
    f.reopen(); f.state.fail = true;
    expect(() => f.run()).toThrow('interrupted WBC outcomes'); expect(f.saved()).toEqual(saved);
    expect(f.drain()).toEqual([]);
  } finally { f.close(); }
});
it.each(['finals', 'qualifier'] as const)('rolls back %s completion receipt and owner-row trigger tampering before commit', kind => {
  const f = fixture(kind), db = new DatabaseSync(f.path);
  try {
    f.state.fail = false; f.run(false); const before = f.saved();
    for (const mutation of ["outcome_delivery_json='[]'", "plan_json='{}'"]) {
      db.exec(`CREATE TRIGGER corrupt_delivery AFTER UPDATE OF outcome_delivery_json ON ${f.table}
        BEGIN UPDATE ${f.table} SET ${mutation} WHERE career_id=NEW.career_id AND edition_id=NEW.edition_id; END;`);
      expect(() => f.drain()).toThrow('WBC outcome completion persisted original differs');
      expect(f.saved()).toEqual(before);
      f.reopen(); expect(f.owner().listPendingCompletions()).toHaveLength(1);
      db.exec('DROP TRIGGER corrupt_delivery');
    }
    expect(f.drain()[0].result?.playerOutcomes.kind).toBe('delivered');
    expect(f.owner().listPendingCompletions()).toEqual([]);
  } finally { db.close(); f.close(); }
});
