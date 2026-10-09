import { mkdtempSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync as NativeDatabase } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import type {
  OfficialPlayerOutcomeAttribution, OfficialPlayerOutcomeEvidence,
  OfficialPlayerOutcomeSource,
} from './OfficialPlayerOutcomeEvidenceFromSqlite';
import { openSqliteOfficialPlayerOutcomeStore } from './SqliteOfficialPlayerOutcomeStore';

const witness = vi.hoisted(() => ({ reads: [] as {
  sourceId: string; sourceProofHash: string | null; headHistoryHash: string | null;
}[] }));

/**
 * Lower-owner substitution only: synthetic JSON replaces original physical and
 * official evidence derivation. The store, ownership queries, Native SQLite,
 * transactions, history anchor and Core aggregation remain production code.
 * These cases do not qualify any genuine game or production producer route.
 */
vi.mock('./OfficialPlayerOutcomeEvidenceFromSqlite', async importOriginal => {
  const actual = await importOriginal<typeof import('./OfficialPlayerOutcomeEvidenceFromSqlite')>();
  return {
    ...actual,
    deriveOfficialPlayerOutcomeFromSqlite(db: NativeDatabase, raw: OfficialPlayerOutcomeSource): OfficialPlayerOutcomeEvidence {
      if (!(db instanceof DatabaseSync) || !db.isTransaction) {
        throw new Error('synthetic lower owner requires the private Native transaction');
      }
      const source = actual.officialPlayerOutcomeSource(raw);
      const row = db.prepare('SELECT evidence_json FROM main.test_original_outcomes WHERE owner=? AND source_id=?')
        .get(source.owner, source.sourceId);
      if (!row) throw new Error('synthetic lower owner evidence is missing');
      const evidence = JSON.parse(String(row.evidence_json)) as OfficialPlayerOutcomeEvidence;
      if (evidence.source.owner !== source.owner || evidence.source.sourceId !== source.sourceId) {
        throw new Error('synthetic lower owner Source differs');
      }
      const head = evidence.kind === 'attributed'
        ? db.prepare('SELECT history_hash FROM main.official_player_outcome_heads WHERE career_id=? AND competition_edition_id=?')
          .get(evidence.careerId, evidence.competitionEditionId) : undefined;
      witness.reads.push({ sourceId: source.sourceId,
        sourceProofHash: evidence.kind === 'attributed' ? evidence.sourceProofHash : null,
        headHistoryHash: head ? String(head.history_hash) : null });
      return evidence;
    },
  };
});

// This suite substitutes both original evidence producers. Native owner history,
// aggregation, read transactions and archived attribution bytes stay genuine.
vi.mock('./OfficialPlayerScoringEvidenceFromSqlite', () => ({
  deriveOfficialPlayerScoringFromSqlite(db: NativeDatabase, outcome: OfficialPlayerOutcomeAttribution) {
    if (!db.isTransaction) throw new Error('synthetic scoring requires the owned read transaction');
    return { atBats: { kind: 'known' as const, value: outcome.classification === 'strikeout' ? 1 : 0 },
      runsBattedIn: { kind: 'known' as const, value: 0 }, hitBases: { kind: 'known' as const, value: 0 }, pitchingOuts: outcome.classification === 'strikeout' ? 1 : 0 };
  },
}));

vi.mock('./OfficialPitchingRunEvidenceFromSqlite', () => ({ readOfficialPitchingRunOriginal: () => null }));

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const stores: { close(): void }[] = [];
afterEach(() => {
  for (const store of stores.splice(0).reverse()) store.close();
  // Preserve the tiny fixture files for any later failure inspection.
  witness.reads.length = 0;
});

const scope = (playerId = 'player-a') => ({
  careerId: 'synthetic-career', competitionEditionId: 'synthetic-edition',
  playerId, asOfDay: 10,
});
const attribution = (playId: number, sourceId = `synthetic-source-${playId}`,
  batting = true): OfficialPlayerOutcomeAttribution => {
  const batterPlayerId = batting ? 'player-a' : 'player-b';
  const pitcherPlayerId = batting ? 'player-b' : 'player-a';
  const source: OfficialPlayerOutcomeSource = { owner: 'physical_play_closures', sourceId };
  const binding = (playerId: string, side: 'HOME' | 'AWAY'): OfficialParticipantBinding => ({
    gameId: 'synthetic-game', careerId: 'synthetic-career',
    competitionEditionId: 'synthetic-edition', gameDay: 5,
    clubId: side === 'HOME' ? 'home-club' : 'away-club', side,
    playerId, personId: `person-${playerId}`, personLinkSourceId: `person-link-${playerId}`,
    rosterRevision: 1, fixtureEventId: 'synthetic-fixture',
  });
  return {
    kind: 'attributed', source, sourceProofHash: `synthetic-proof-${sourceId}`,
    attributionId: JSON.stringify(['official_player_outcome_v1', 'synthetic-career', 'synthetic-game', playId]),
    careerId: 'synthetic-career', competitionEditionId: 'synthetic-edition',
    gameId: 'synthetic-game', playId, gameDay: 5, batterPlayerId, pitcherPlayerId,
    classification: batting ? 'strikeout' : 'base_on_balls',
    batter: binding(batterPlayerId, batting ? 'AWAY' : 'HOME'),
    pitcher: binding(pitcherPlayerId, batting ? 'HOME' : 'AWAY'),
    batterPersonHash: `synthetic-person-proof-${batterPlayerId}`,
    pitcherPersonHash: `synthetic-person-proof-${pitcherPlayerId}`,
    officialApplicationId: `synthetic-official-${sourceId}`, durableRevision: playId + 1,
    scoring: {
      scoringApplicationId: `synthetic-scoring-${sourceId}`, matchId: 'synthetic-game',
      officialApplicationId: `synthetic-official-${sourceId}`, closureId: sourceId,
      sourceEventId: `synthetic-scoring-event-${sourceId}`,
      record: { playId, closureId: sourceId, basisRulingId: `synthetic-ruling-${sourceId}`,
        classification: batting ? 'strikeout' : 'base_on_balls', battingTeam: batting ? 'away' : 'home',
        runsScored: 0, hitsCredited: 0, errorsCharged: 0 },
    },
  };
};

const fixture = () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-player-outcome-unit-'));
  const path = join(directory, 'synthetic.sqlite');
  const db = new DatabaseSync(path);
  stores.push(db);
  db.exec(`CREATE TABLE test_original_outcomes(
    owner TEXT NOT NULL, source_id TEXT NOT NULL, evidence_json TEXT NOT NULL,
    PRIMARY KEY(owner,source_id))`);
  const put = (evidence: OfficialPlayerOutcomeEvidence) => db.prepare(`
    INSERT INTO test_original_outcomes VALUES(?,?,?)
    ON CONFLICT(owner,source_id) DO UPDATE SET evidence_json=excluded.evidence_json`)
    .run(evidence.source.owner, evidence.source.sourceId, JSON.stringify(evidence));
  const open = () => {
    const store = openSqliteOfficialPlayerOutcomeStore(path);
    stores.push(store);
    return store;
  };
  const store = open();
  const census = () => ({
    originals: db.prepare('SELECT * FROM test_original_outcomes ORDER BY owner,source_id').all(),
    applications: db.prepare('SELECT * FROM official_player_outcome_applications ORDER BY attribution_id').all(),
    heads: db.prepare('SELECT * FROM official_player_outcome_heads ORDER BY career_id,competition_edition_id').all(),
  });
  return { path, db, store, put, open, census };
};

describe('official player outcome Native store with synthetic lower-owner substitution', () => {
  it('persists the first attribution and reads/retries exactly after reopen', () => {
    const f = fixture(), original = attribution(1);
    f.put(original);
    expect(f.store.readApplication(original.source)).toBeNull();
    expect(f.store.apply(original.source)).toEqual(original);
    const before = f.census();
    expect(before.applications).toHaveLength(1);
    expect(before.heads).toHaveLength(1);
    expect(before.heads[0].revision).toBe(1);
    f.store.close();
    const reopened = f.open();
    expect(reopened.readApplication(original.source)).toEqual(original);
    expect(reopened.apply(original.source)).toEqual(original);
    expect(f.census()).toEqual(before);
  });

  it('aggregates two original plays for the same player in batting and pitching roles', () => {
    const f = fixture(), batting = attribution(1), pitching = attribution(2, 'synthetic-source-2', false);
    f.put(batting); f.put(pitching);
    f.store.apply(batting.source); f.store.apply(pitching.source);
    const result = f.store.aggregate(scope());
    expect(result.coverage).toBe('attributed_supported_plays_only');
    expect(result.scoring.batting.atBats).toEqual({ value: 1, knownSubtotal: 1, unavailable: [] });
    expect(result.scoring.pitching).toEqual({ outsRecorded: 0, inningsPitched: { completeInnings: 0, remainderOuts: 0 } });
    const saved = f.census();
    expect(f.open().aggregate(scope())).toEqual(result);
    expect(f.census()).toEqual(saved);
    expect(result.batting).toMatchObject({ classifiedPlays: 1, outcomes: { strikeout: 1, base_on_balls: 0 } });
    expect(result.pitching).toMatchObject({ classifiedPlays: 1, outcomes: { strikeout: 0, base_on_balls: 1 } });
    expect(result.attributionIds).toEqual([batting.attributionId, pitching.attributionId].sort());
    expect(result.gameIds).toEqual(['synthetic-game']);
    expect(f.census().heads[0].revision).toBe(2);
    expect(f.store.aggregate({ ...scope(), asOfDay: 4 }).attributionIds).toEqual([]);
  });

  it('rejects corrupted original proof on read, exact retry and aggregate', () => {
    const f = fixture(), original = attribution(1);
    f.put(original); f.store.apply(original.source);
    f.db.prepare(`UPDATE test_original_outcomes
      SET evidence_json=json_set(evidence_json,'$.sourceProofHash','changed-original') WHERE source_id=?`)
      .run(original.source.sourceId);
    const corrupted = f.census();
    for (const read of [() => f.store.readApplication(original.source),
      () => f.store.apply(original.source), () => f.store.aggregate(scope())]) {
      expect(read).toThrow('archive or original proof differs');
    }
    expect(f.census()).toEqual(corrupted);
  });

  it('detects deletion of an earlier attribution through the edition history anchor', () => {
    const f = fixture(), first = attribution(1), second = attribution(2), third = attribution(3);
    for (const value of [first, second, third]) f.put(value);
    f.store.apply(first.source); f.store.apply(second.source);
    f.db.prepare('DELETE FROM official_player_outcome_applications WHERE attribution_id=?').run(first.attributionId);
    const corrupted = f.census();
    for (const read of [() => f.store.readApplication(first.source), () => f.store.readApplication(second.source),
      () => f.store.apply(second.source), () => f.store.aggregate(scope()),
      () => f.store.apply(third.source)]) {
      expect(read).toThrow('complete history anchor differs');
    }
    expect(f.census()).toEqual(corrupted);
  });

  it('rolls back a new attribution and an AFTER INSERT mutation of prior original proof', () => {
    const f = fixture(), first = attribution(1), second = attribution(2);
    f.put(first); f.put(second); f.store.apply(first.source);
    f.db.exec(`CREATE TRIGGER corrupt_prior_original AFTER INSERT ON official_player_outcome_applications
      WHEN NEW.source_id='synthetic-source-2' BEGIN
      UPDATE test_original_outcomes SET evidence_json=json_set(evidence_json,
        '$.sourceProofHash','corrupted-by-attribution-trigger') WHERE source_id='synthetic-source-1'; END`);
    const before = f.census();
    witness.reads.length = 0;
    expect(() => f.store.apply(second.source)).toThrow('archive or original proof differs');
    expect(witness.reads.some(read => read.sourceId === first.source.sourceId
      && read.sourceProofHash === 'corrupted-by-attribution-trigger')).toBe(true);
    expect(f.census()).toEqual(before);
    expect(f.store.readApplication(second.source)).toBeNull();
    expect(f.store.readApplication(first.source)).toEqual(first);
    f.db.exec('DROP TRIGGER corrupt_prior_original');
    expect(f.store.apply(second.source)).toEqual(second);
  });

  it('rolls back the new attribution and an AFTER UPDATE corruption of its history head', () => {
    const f = fixture(), first = attribution(1), second = attribution(2);
    f.put(first); f.put(second); f.store.apply(first.source);
    f.db.exec(`CREATE TRIGGER corrupt_updated_head AFTER UPDATE ON official_player_outcome_heads
      WHEN NEW.revision=2 AND NEW.history_hash!='corrupted-by-head-trigger' BEGIN
      UPDATE official_player_outcome_heads SET history_hash='corrupted-by-head-trigger'
      WHERE career_id=NEW.career_id AND competition_edition_id=NEW.competition_edition_id; END`);
    const before = f.census();
    witness.reads.length = 0;
    expect(() => f.store.apply(second.source)).toThrow('complete history anchor differs');
    expect(witness.reads.some(read => read.headHistoryHash === 'corrupted-by-head-trigger')).toBe(true);
    expect(f.census()).toEqual(before);
    f.db.exec('DROP TRIGGER corrupt_updated_head');
    expect(f.store.apply(second.source)).toEqual(second);
    expect(f.census().heads[0].revision).toBe(2);
  });

  it.each(['original_batter_missing', 'supported_official_scoring_missing'] as const)(
    'leaves attribution and head storage empty when the lower owner reports %s', reason => {
      const f = fixture();
      const missing: OfficialPlayerOutcomeEvidence = {
        kind: 'unavailable', source: { owner: 'actual_live_play_closures', sourceId: 'synthetic-unavailable' }, reason,
      };
      f.put(missing);
      const before = f.census();
      expect(f.store.apply(missing.source)).toEqual(missing);
      expect(f.store.apply(missing.source)).toEqual(missing);
      expect(f.store.readApplication(missing.source)).toBeNull();
      expect(f.store.aggregate(scope()).attributionIds).toEqual([]);
      expect(f.census()).toEqual(before);
      expect(before.applications).toEqual([]);
      expect(before.heads).toEqual([]);
    });

  it('rejects an existing Source reassigned to a different original play', () => {
    const f = fixture(), first = attribution(1);
    f.put(first); f.store.apply(first.source);
    f.put(attribution(2, first.source.sourceId));
    const before = f.census();
    expect(() => f.store.apply(first.source)).toThrow('archive or original proof differs');
    expect(f.census()).toEqual(before);
  });

  it.each([false, true])('rejects a second Source for an existing canonical play (distinct ID: %s)', distinctId => {
    const f = fixture(), first = attribution(1);
    const rival = { ...attribution(1, 'synthetic-rival'),
      ...(distinctId ? { attributionId: 'synthetic-conflicting-attribution' } : {}) };
    f.put(first); f.put(rival); f.store.apply(first.source);
    const before = f.census();
    expect(() => f.store.apply(rival.source)).toThrow();
    expect(f.census()).toEqual(before);
    expect(f.store.readApplication(first.source)).toEqual(first);
    expect(f.store.readApplication(rival.source)).toBeNull();
  });
});
