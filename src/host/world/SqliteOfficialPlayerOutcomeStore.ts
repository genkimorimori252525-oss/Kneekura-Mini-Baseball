import { createRequire } from 'node:module';
import { aggregateOfficialPlayerOutcomes, type OfficialPlayerOutcomeStatisticsScope } from '../../core/world/competition/OfficialPlayerOutcomeStatistics';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { deriveOfficialPlayerOutcomeFromSqlite as derive, officialPlayerOutcomeSource as input,
  type OfficialPlayerOutcomeSource, type OfficialPlayerOutcomeAttribution } from './OfficialPlayerOutcomeEvidenceFromSqlite';
import { scoringOwnershipRows } from './ActualLiveScoringMetadata';
import { physicalStoreTransactionBoundary } from './PhysicalStoreTransactionBoundary';

const table = 'official_player_outcome_applications';
const id = (v: unknown): v is string => typeof v === 'string' && !!v && v.trim() === v;
/** Append-only attribution; every read/retry and aggregate authenticates its
 * complete edition history on this private connection. No statistics feed back
 * into Match truth or become an implicit scoring/calibration policy. */
export const openSqliteOfficialPlayerOutcomeStore = (path: string) => {
  if (!id(path)) throw new Error('invalid official player outcome path');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS ${table}(
      attribution_id TEXT PRIMARY KEY, career_id TEXT NOT NULL, competition_edition_id TEXT NOT NULL,
      game_id TEXT NOT NULL, play_id INTEGER NOT NULL, game_day INTEGER NOT NULL,
      owner TEXT NOT NULL, source_id TEXT NOT NULL, source_json TEXT NOT NULL,
      snapshot_json TEXT NOT NULL, snapshot_hash TEXT NOT NULL,
      UNIQUE(owner,source_id), UNIQUE(career_id,game_id,play_id));
    CREATE TABLE IF NOT EXISTS official_player_outcome_heads(
      career_id TEXT NOT NULL, competition_edition_id TEXT NOT NULL, revision INTEGER NOT NULL,
      attribution_ids_json TEXT NOT NULL, history_hash TEXT NOT NULL,
      PRIMARY KEY(career_id,competition_edition_id))`);
  const tx = physicalStoreTransactionBoundary(db, 'official player outcome');
  const rowFor = (value: OfficialPlayerOutcomeAttribution) => ({ attribution_id: value.attributionId,
    career_id: value.careerId, competition_edition_id: value.competitionEditionId, game_id: value.gameId,
    play_id: value.playId, game_day: value.gameDay, owner: value.source.owner, source_id: value.source.sourceId,
    source_json: json(value.source), snapshot_json: json(value), snapshot_hash: hash(value) });
  const identityRows = (source: OfficialPlayerOutcomeSource) => scoringOwnershipRows(db, 'main.' + table, [[
    { column: 'owner', value: source.owner, mirrors: [['source_json', ['owner']], ['snapshot_json', ['source', 'owner']]] },
    { column: 'source_id', value: source.sourceId, mirrors: [['source_json', ['sourceId']], ['snapshot_json', ['source', 'sourceId']]] },
  ]]);
  const scopeRows = (careerId: string, competitionEditionId: string) => scoringOwnershipRows(db, 'main.' + table, [[
    { column: 'career_id', value: careerId, mirrors: [['snapshot_json', ['careerId']], ['snapshot_json', ['batter', 'careerId']], ['snapshot_json', ['pitcher', 'careerId']]] },
    { column: 'competition_edition_id', value: competitionEditionId, mirrors: [['snapshot_json', ['competitionEditionId']],
      ['snapshot_json', ['batter', 'competitionEditionId']], ['snapshot_json', ['pitcher', 'competitionEditionId']]] },
  ]]);
  const decode = (row: ReturnType<typeof identityRows>[number]): OfficialPlayerOutcomeAttribution => {
    const source = input(JSON.parse(String(row.source_json)) as OfficialPlayerOutcomeSource);
    const owned = derive(db, source);
    if (owned.kind !== 'attributed' || json(row) !== json(rowFor(owned))) throw new Error('official player outcome archive or original proof differs');
    const rivals = scoringOwnershipRows(db, 'main.' + table, [
      [{ column: 'attribution_id', value: owned.attributionId, mirrors: [['snapshot_json', ['attributionId']]] }],
      [{ column: 'career_id', value: owned.careerId, mirrors: [['snapshot_json', ['careerId']]] },
        { column: 'game_id', value: owned.gameId, mirrors: [['snapshot_json', ['gameId']]] },
        { column: 'play_id', value: owned.playId, mirrors: [['snapshot_json', ['playId']]] }],
    ]);
    if (rivals.length !== 1 || rivals[0].attribution_id !== owned.attributionId || identityRows(source).length !== 1) {
      throw new Error('official player outcome canonical play ownership differs');
    }
    return owned;
  };
  const headFor = (careerId: string, competitionEditionId: string, values: readonly OfficialPlayerOutcomeAttribution[]) => ({
    career_id: careerId, competition_edition_id: competitionEditionId, revision: values.length,
    attribution_ids_json: json(values.map(v => v.attributionId)), history_hash: hash(values),
  });
  const history = (careerId: string, competitionEditionId: string, checkHead = true) => {
    const values = scopeRows(careerId, competitionEditionId).map(decode);
    if (values.some(v => v.careerId !== careerId || v.competitionEditionId !== competitionEditionId)
      || new Set(values.map(v => v.attributionId)).size !== values.length) throw new Error('official player outcome edition history differs');
    values.sort((a, b) => a.attributionId < b.attributionId ? -1 : a.attributionId > b.attributionId ? 1 : 0);
    if (checkHead) {
      const head = db.prepare('SELECT * FROM main.official_player_outcome_heads WHERE career_id=? AND competition_edition_id=?').get(careerId, competitionEditionId);
      if (head ? json(head) !== json(headFor(careerId, competitionEditionId, values)) : values.length > 0) {
        throw new Error('official player outcome complete history anchor differs');
      }
    }
    return values;
  };
  return Object.freeze({
    apply(raw: OfficialPlayerOutcomeSource) {
      const source = input(raw);
      return tx.write(() => {
        const owned = derive(db, source);
        if (owned.kind === 'unavailable') {
          if (identityRows(source).length) throw new Error('official player outcome original proof became unavailable');
          return owned;
        }
        const before = history(owned.careerId, owned.competitionEditionId), rows = identityRows(source);
        if (rows.length) {
          if (rows.length !== 1 || json(decode(rows[0])) !== json(owned)) throw new Error('official player outcome Source changed during retry');
          return owned;
        }
        if (before.some(v => v.attributionId === owned.attributionId)) throw new Error('official player outcome play already attributed differently');
        const row = rowFor(owned);
        db.prepare(`INSERT INTO main.${table} VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(...Object.values(row));
        // A fresh traversal after INSERT must authenticate both the new play and
        // every earlier fact used by this edition's aggregates. Triggers cannot
        // corrupt an earlier owner and leave a valid-looking new receipt.
        const after = history(owned.careerId, owned.competitionEditionId, false);
        const expected = [...before, owned].sort((a, b) => a.attributionId < b.attributionId ? -1 : a.attributionId > b.attributionId ? 1 : 0);
        if (json(after) !== json(expected)) throw new Error('official player outcome history changed during admission');
        const head = headFor(owned.careerId, owned.competitionEditionId, after);
        if (!before.length) db.prepare('INSERT INTO main.official_player_outcome_heads VALUES(?,?,?,?,?)').run(...Object.values(head));
        else {
          const changed = db.prepare(`UPDATE main.official_player_outcome_heads SET revision=?,attribution_ids_json=?,history_hash=?
            WHERE career_id=? AND competition_edition_id=? AND revision=? AND history_hash=?`)
            .run(head.revision, head.attribution_ids_json, head.history_hash, owned.careerId, owned.competitionEditionId, before.length, hash(before));
          if (changed.changes !== 1) throw new Error('official player outcome history anchor changed during admission');
        }
        if (json(history(owned.careerId, owned.competitionEditionId)) !== json(expected)) {
          throw new Error('official player outcome anchored history changed during admission');
        }
        return owned;
      });
    },
    readApplication(raw: OfficialPlayerOutcomeSource): OfficialPlayerOutcomeAttribution | null {
      const source = input(raw);
      return tx.read(() => {
        const rows = identityRows(source);
        if (!rows.length) {
          const original = derive(db, source);
          if (original.kind === 'attributed') history(original.careerId, original.competitionEditionId);
          return null;
        }
        if (rows.length !== 1) throw new Error('official player outcome Source ownership differs');
        const value = decode(rows[0]);
        history(value.careerId, value.competitionEditionId);
        return value;
      });
    },
    aggregate(scope: OfficialPlayerOutcomeStatisticsScope) {
      // Core validates the exact scope before any database query.
      aggregateOfficialPlayerOutcomes([], scope);
      return tx.read(() => freeze(aggregateOfficialPlayerOutcomes(history(scope.careerId, scope.competitionEditionId), scope)));
    },
    close() { tx.close(); },
  });
};
