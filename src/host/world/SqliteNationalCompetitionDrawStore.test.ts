import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { EMPTY_COMPETITION_DRAW_POLICY_REGISTRY, registerCompetitionDrawPolicy } from
  '../../core/world/competition/CompetitionDraw';
import { openSqliteWorldCompetitionCycleStore } from './SqliteWorldCompetitionCycleStore';
import { openSqliteNationalCompetitionSelectionStore } from './SqliteNationalCompetitionSelectionStore';
import { openSqliteNationCompetitionRegionStore } from './SqliteNationCompetitionRegionStore';
import { openSqliteNationalCompetitionDrawStore } from './SqliteNationalCompetitionDrawStore';
import { openSqliteWbcFinalsGroupStore } from './SqliteWbcFinalsGroupStore';
import { worldCycleInput } from './WorldCompetitionCycleFixtures.test-support';
import { wbcFinalsInput } from './WbcFinalsFixtures.test-support';

const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');

it('pins WBC qualification and ranking pots while rejecting changed policies and saved draws', () => {
  const closables: { close(): void }[] = [];
  const track = <T extends { close(): void }>(store: T): T => { closables.push(store); return store; };
  try {
    const cycle = track(openSqliteWorldCompetitionCycleStore(':memory:'));
    cycle.initialize('career-1', worldCycleInput(0));
    const selections = track(openSqliteNationalCompetitionSelectionStore(':memory:', { cycle }));
    const selection = selections.initialize({ careerId: 'career-1', editionId: 'wbc-2032',
      cycleOrdinal: 0, kind: 'WBC', careerDayOne: '2031-01-01', cutoffDay: 400 });
    const { berths, edition } = wbcFinalsInput(selection.calendarWindow,
      selection.qualificationCutoff.snapshotId);
    const nations = track(openSqliteNationCompetitionRegionStore(':memory:'));
    berths.entrantNationIds.forEach((nationId, index) => nations.record({ careerId: 'career-1', nationId,
      region: (['ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'] as const)[index % 4],
      effectiveFromDay: 0, sourceEventId: `region-${index}` }));
    // Ranking/qualification are accepted fixtures in this isolated draw test.
    const ranking = { snapshotId: 'ranking-400', policyVersion: 'ranking-test-v1', asOfDay: 400,
      orderedNationIds: berths.entrantNationIds, evidenceResultIds: ['old-official-result'] };
    let rankingMissing = false;
    const sources = { selections, nations, rankings: { readRanking: () => rankingMissing ? null : ranking },
      history: { readHistory: () => ({ editions: [{ editionId: 'prior', tier: 'WBC' as const,
        completedAtDay: 100, snapshotId: 'prior-history', games: [{ applicationId: 'old-official-result',
          stage: 'GROUP' as const, homeNationId: 'nation-0', awayNationId: 'nation-1',
          winnerNationId: 'nation-0' }] }] }) }, wbcBerths: { readAllocation: () => berths } };
    const policy = { version: 'wbc-test-draw-v1', rematchLookbackDays: 200,
      relaxationOrder: ['REMATCH_AVOIDANCE', 'SAME_LEAGUE_AVOIDANCE', 'REGIONAL_DIVERSITY'] as const };
    const registry = registerCompetitionDrawPolicy(EMPTY_COMPETITION_DRAW_POLICY_REGISTRY, policy);
    // A shared memory URI permits another connection to validate deliberate saved-data corruption.
    const path = `file:national-draw-test-${crypto.randomUUID()}?mode=memory&cache=shared`;
    const draws = track(openSqliteNationalCompetitionDrawStore(path, sources));
    const request = { careerId: 'career-1', editionId: edition.editionId, kind: 'WBC' as const,
      drawSeed: 'seed-wbc', policy, registry };
    rankingMissing = true;
    expect(() => draws.initialize(request)).toThrow('cutoff ranking');
    rankingMissing = false;
    const draw = draws.initialize(request);
    expect(draw.draw.groups.map((group) => group.length)).toEqual([4, 4, 4, 4, 4, 4]);
    for (const group of draw.draw.groups) expect(group.map((nation) => nation.pot)).toEqual([1, 2, 3, 4]);
    expect(draw.source.rematchHistory.editions).toHaveLength(0);
    expect(draw.source.berths).toEqual(berths);
    expect(() => draws.initialize({ ...request, policy: { ...policy, rematchLookbackDays: 100 } }))
      .toThrow('frozen differently');
    const groups = track(openSqliteWbcFinalsGroupStore(':memory:', { selections, draws,
      berths: sources.wbcBerths, matches: { getMatch: () => null, getOfficialFixture: () => null } }));
    const acceptedEdition = { ...edition, drawSnapshotId: draw.drawSnapshotId,
      drawPolicyVersion: policy.version, groups: draw.draw.groups.map((group, groupIndex) => ({
        ...edition.groups[groupIndex], nationIds: group.map((nation) => nation.teamId) })) };
    expect(() => groups.initialize({ careerId: 'career-1', edition: { ...acceptedEdition,
      drawPolicyVersion: 'another-policy-version' } })).toThrow('accepted draw');
    expect(groups.initialize({ careerId: 'career-1', edition: acceptedEdition }).groups).toHaveLength(6);
    const db = new DatabaseSync(path);
    db.prepare("UPDATE world_national_draws SET draw_json='{}'").run();
    db.close();
    expect(() => draws.readDraw('career-1', edition.editionId)).toThrow('corrupt');
  } finally {
    closables.reverse().forEach((store) => store.close());
  }
});
