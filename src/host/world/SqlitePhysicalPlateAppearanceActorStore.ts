import { createRequire } from 'node:module';
import type { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import type { SqliteOfficialInitialWorldStore } from './SqliteOfficialInitialWorldStore';
import type { SqliteOfficialParticipationStore } from './SqliteOfficialParticipationStore';
import type { PersistedOfficialScoring } from '../SqliteOfficialScoringStore';
import { assertPriorPhysicalClosureCompleted, readPhysicalClosureProposal } from './PhysicalPlayClosureEvidenceFromSqlite';
import { actorJson as json, actorHash as hash, actorFreeze as freeze, physicalActorInput, derivePhysicalPlateAppearanceActor,
  assertPhysicalActorOpenFrame, readPhysicalPlateAppearanceActorFromSqlite, type AcceptedPhysicalPlateAppearanceActor,
  type DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
export type { AcceptedPhysicalPlateAppearanceActor, DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
export type CompletedPhysicalBatterAppearance = Readonly<{
  actor: DurablePhysicalPlateAppearanceActor; playedPlayId: number; officialApplicationId: string;
  scoringApplicationId: string; durableRevision: number; record: PersistedOfficialScoring['record'];
}>;
export type SqlitePhysicalPlateAppearanceActorStore = Readonly<{
  accept(sourceId: string): DurablePhysicalPlateAppearanceActor; read(sourceId: string): DurablePhysicalPlateAppearanceActor | null;
  readCompletedAppearance(sourceId: string): CompletedPhysicalBatterAppearance | null; close(): void;
}>;
type Sources = Readonly<{ matches: Pick<SqliteOfficialStateStore, 'getMatch'>;
  initialWorlds: Pick<SqliteOfficialInitialWorldStore, 'readAcceptedSource'>;
  participation: Pick<SqliteOfficialParticipationStore, 'readPregameBinding'> }>;
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v === v.trim();
export const openSqlitePhysicalPlateAppearanceActorStore = (path: string, sources: Sources,
  authority?: Readonly<{ readAcceptedActor(sourceId: string): AcceptedPhysicalPlateAppearanceActor | null }>): SqlitePhysicalPlateAppearanceActorStore => {
  if (!id(path) || typeof sources?.matches?.getMatch !== 'function' || typeof sources.initialWorlds?.readAcceptedSource !== 'function'
    || typeof sources.participation?.readPregameBinding !== 'function' || authority != null && typeof authority.readAcceptedActor !== 'function') throw new Error('invalid physical batter actor sources');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS physical_plate_appearance_actor_games (game_id TEXT PRIMARY KEY,first_source_id TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS physical_plate_appearance_actors (source_id TEXT PRIMARY KEY,source_version TEXT NOT NULL,
      game_id TEXT NOT NULL,play_id INTEGER NOT NULL,player_id TEXT NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,
      snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,UNIQUE(game_id,play_id));`);
  let closed = false;
  const check = (sourceId: string) => { if (closed || !id(sourceId)) throw new Error('invalid or closed physical batter scope'); };
  const read = (sourceId: string) => { check(sourceId); return readPhysicalPlateAppearanceActorFromSqlite(db, sourceId); };
  const notStarted = (actor: DurablePhysicalPlateAppearanceActor) => {
    for (const table of ['physical_pitch_progress_heads', 'physical_pitch_progress_actions']) {
      if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table)
        && db.prepare(`SELECT 1 FROM ${table} WHERE game_id=? AND play_id=?`).get(actor.source.gameId, actor.match.playId)) throw new Error('physical batter play has already started');
    }
  };
  return Object.freeze({
    read,
    accept(sourceId) {
      check(sourceId); const prior = read(sourceId), raw = authority?.readAcceptedActor(sourceId) ?? null;
      const source = raw === null ? null : physicalActorInput(raw, sourceId);
      if (prior) {
        if (source && json(source) !== json(prior.source)) throw new Error('physical batter Source is frozen differently');
        const original = read(sourceId);
        if (!original || json(original) !== json(prior)) throw new Error('physical batter original evidence changed during retry');
        return original;
      }
      if (!source) throw new Error('accepted physical batter Source is missing');
      assertPriorPhysicalClosureCompleted(db, 'activationApplicationId' in source ? source.activationApplicationId : null);
      const actor = derivePhysicalPlateAppearanceActor(db, source);
      assertPhysicalActorOpenFrame(db, actor); notStarted(actor);
      const current = sources.matches.getMatch(source.gameId), binding = sources.participation.readPregameBinding(source.gameId, source.playerId);
      if (!current || current.finalResult || current.durableRevision !== actor.officialRevision || json(current.matchState) !== json(actor.match)
        || json(binding) !== json(actor.binding) || 'initialWorldSourceId' in source
          && json(sources.initialWorlds.readAcceptedSource(source.initialWorldSourceId)) !== json(JSON.parse((db.prepare('SELECT snapshot_json FROM official_initial_world_sources WHERE source_id=?')
            .get(source.initialWorldSourceId) as { snapshot_json: string }).snapshot_json))) throw new Error('physical batter peer Source differs');
      db.exec('BEGIN IMMEDIATE');
      try {
        assertPriorPhysicalClosureCompleted(db, 'activationApplicationId' in source ? source.activationApplicationId : null);
        assertPhysicalActorOpenFrame(db, actor); notStarted(actor);
        if (json(derivePhysicalPlateAppearanceActor(db, source)) !== json(actor)) throw new Error('physical batter origin changed before acceptance');
        const game = db.prepare('SELECT first_source_id FROM physical_plate_appearance_actor_games WHERE game_id=?').get(source.gameId);
        if (!game) db.prepare('INSERT INTO physical_plate_appearance_actor_games VALUES (?,?)').run(source.gameId, sourceId);
        db.prepare('INSERT INTO physical_plate_appearance_actors VALUES (?,?,?,?,?,?,?,?,?)').run(sourceId, source.sourceVersion, source.gameId,
          actor.match.playId, source.playerId, json(source), hash(source), json(actor), hash(actor));
        assertPhysicalActorOpenFrame(db, actor); notStarted(actor);
        const saved = read(sourceId);
        if (!saved || json(saved) !== json(actor)) throw new Error('physical batter changed during acceptance');
        db.exec('COMMIT'); return saved;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    readCompletedAppearance(sourceId) {
      const actor = read(sourceId); if (!actor) return null;
      if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='physical_play_closures'").get()) return null;
      const row = db.prepare('SELECT source_id,application_id,status FROM physical_play_closures WHERE game_id=? AND play_id=?')
        .get(actor.source.gameId, actor.match.playId) as { source_id: string; application_id: string; status: string } | undefined;
      if (!row || row.status === 'PENDING') return null;
      assertPriorPhysicalClosureCompleted(db, row.application_id);
      const closure = readPhysicalClosureProposal(db, row.source_id)!;
      if (json(closure.proposal.physicalPitch.frame.batterActor) !== json(actor)) throw new Error('physical completed batter actor differs');
      return freeze({ actor, playedPlayId: actor.match.playId, officialApplicationId: row.application_id,
        scoringApplicationId: closure.proposal.expectedScoring.scoringApplicationId, durableRevision: closure.proposal.expectedOfficial.receipt.durableRevision,
        record: closure.proposal.expectedScoring.record });
    },
    close() { if (!closed) { db.close(); closed = true; } },
  });
};
