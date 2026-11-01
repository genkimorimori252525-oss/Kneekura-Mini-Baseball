import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { physicalPlateAppearanceActorFixture } from './PhysicalPlateAppearanceActorFixtures.test-support';
import { openSqliteOfficialPlayerOutcomeStore } from './SqliteOfficialPlayerOutcomeStore';
import * as context from './OfficialPlayerContextEvidenceV123';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
it('SCTX03 context reader refuses a substituted connection or an unowned snapshot', () => {
  expect(() => context.deriveOfficialPlayerContextEvidenceV123({} as InstanceType<typeof DatabaseSync>, {} as never)).toThrow(/Native transaction/);
  const db = new DatabaseSync(':memory:');
  try { expect(() => context.deriveOfficialPlayerContextEvidenceV123(db, {} as never)).toThrow(/Native transaction/); }
  finally { db.close(); }
});

// Genuine accepted actor → physical pitches → closure/scoring → original
// attribution. Finite fixture calibration is synthetic, original owners are not.
it('SCTX04 genuine Native pre-play context aggregate preserves old bytes and rejects a changed original even outside asOfDay', () => {
  const x = physicalPlateAppearanceActorFixture(), { f } = x;
  try {
    const actor = x.actors.accept(x.source.sourceId); x.close();
    const owner = f.track(openSqliteOfficialPlayerOutcomeStore(f.path));
    const attributed = owner.apply({ owner: 'physical_play_closures', sourceId: 'close-1' });
    if (attributed.kind !== 'attributed') throw Error('genuine attribution missing');
    const scope = { careerId: actor.binding.careerId, competitionEditionId: actor.binding.competitionEditionId,
      playerId: actor.binding.playerId, asOfDay: actor.binding.gameDay };
    const before = hash({ schema: f.db.prepare('SELECT * FROM sqlite_master ORDER BY name').all(),
      outcome: f.db.prepare('SELECT * FROM official_player_outcome_applications').all(), heads: f.db.prepare('SELECT * FROM official_player_outcome_heads').all(),
      score: f.db.prepare('SELECT * FROM official_scoring_applications').all(), official: f.db.prepare('SELECT * FROM applications').all() });
    const old = owner.aggregate(scope), result = owner.aggregateContextEvidenceV123(scope);
    expect(result.editionHistory).toEqual({ revision: 1, historyHash: hash([attributed]) });
    expect(result.batting.reduce((n, row) => n + row.plays, 0)).toBe(1);
    expect(result.batting.find(row => row.plays === 1)).toMatchObject({ bases: 'basesEmpty', outs: 0, balls: 0, strikes: 0,
      atBats: { value: 1, knownSubtotal: 1, unknownCount: 0 }, hits: { value: 0, knownSubtotal: 0, unknownCount: 0 } });
    expect(owner.aggregate(scope)).toEqual(old);
    expect(hash({ schema: f.db.prepare('SELECT * FROM sqlite_master ORDER BY name').all(),
      outcome: f.db.prepare('SELECT * FROM official_player_outcome_applications').all(), heads: f.db.prepare('SELECT * FROM official_player_outcome_heads').all(),
      score: f.db.prepare('SELECT * FROM official_scoring_applications').all(), official: f.db.prepare('SELECT * FROM applications').all() })).toBe(before);
    const reopened = f.track(openSqliteOfficialPlayerOutcomeStore(f.path));
    expect(reopened.aggregateContextEvidenceV123(scope)).toEqual(result);
    expect(reopened.aggregateContextEvidenceV123({ ...scope, asOfDay: scope.asOfDay - 1 }).batting.every(row => row.plays === 0)).toBe(true);
    f.db.prepare("UPDATE official_scoring_applications SET result_json=json_set(result_json,'$.record.hitsCredited',1)").run();
    expect(() => reopened.aggregateContextEvidenceV123({ ...scope, asOfDay: scope.asOfDay - 1 })).toThrow();
  } finally { f.close(); }
}, 180_000);
