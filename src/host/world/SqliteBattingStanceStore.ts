import { createRequire } from 'node:module';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { withBodyCompositionTransaction } from './BodyMaterializationSqliteOwnership';
import { bodySourceId as id } from './PlayerBodyCapabilityMaterialization';
import { battingStanceSourceInput, type BattingStanceAuthority, type BattingStanceStore } from './BattingStance';
import { battingStanceEvidenceFromSqlite } from './BattingStanceEvidence';

/** Source-only stance ownership. It neither starts a pitch nor reserves a staged physical producer. */
export const openSqliteBattingStanceStore = (path: string, authority?: BattingStanceAuthority): BattingStanceStore => {
  if (!id(path) || authority !== undefined && typeof authority.readAcceptedStance !== 'function') throw new Error('invalid accepted batting stance authority');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  try {
    db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS main.world_batting_stances (
        source_id TEXT PRIMARY KEY,source_version TEXT NOT NULL,career_id TEXT NOT NULL,player_id TEXT NOT NULL,person_id TEXT NOT NULL,
        person_link_source_id TEXT NOT NULL,accepted_at_day INTEGER NOT NULL,game_id TEXT NOT NULL,fixture_event_id TEXT NOT NULL,
        play_id INTEGER NOT NULL,physical_actor_source_id TEXT NOT NULL,model_source_id TEXT NOT NULL,initial_world_source_id TEXT NOT NULL,
        started_at_tick INTEGER NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,
        UNIQUE(physical_actor_source_id),UNIQUE(game_id,play_id)
      );`);
    const own = battingStanceEvidenceFromSqlite(db);
    let closed = false;
    const check = () => { if (closed) throw new Error('closed batting stance store'); };
    return Object.freeze({
      read(sourceId: string) { check(); return withBodyCompositionTransaction(db, false, () => own.read(sourceId)); },
      accept(sourceId: string) {
        check();
        return withBodyCompositionTransaction(db, true, () => {
          const prior = own.read(sourceId);
          if (prior) {
            if (authority) {
              const raw = authority.readAcceptedStance(sourceId);
              if (raw === null || json(battingStanceSourceInput(raw, sourceId)) !== json(prior.source)) throw new Error('accepted batting stance is frozen differently');
            }
            const current = own.read(sourceId);
            if (json(current) !== json(prior)) throw new Error('original batting stance changed during retry');
            return current!;
          }
          const raw = authority?.readAcceptedStance(sourceId) ?? null;
          if (raw === null) throw new Error('accepted batting stance Source is missing');
          const source = battingStanceSourceInput(raw, sourceId), value = own.derive(source);
          own.assertScope(source, false); own.assertCurrent(value);
          db.prepare('INSERT INTO main.world_batting_stances VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
            .run(source.sourceId, source.sourceVersion, source.careerId, source.playerId, source.personId, source.personLinkSourceId,
              source.acceptedAtDay, source.gameId, source.fixtureEventId, source.playId, source.physicalActorSourceId, source.modelRef.sourceId,
              source.initialWorldSourceId, source.startedAtTick, json(source), hash(source), json(value), hash(value));
          const saved = own.read(sourceId);
          if (!saved || json(saved) !== json(value)) throw new Error('batting stance original actor/model changed during write');
          own.assertCurrent(saved); return saved;
        });
      },
      close() { if (!closed) { db.close(); closed = true; } },
    });
  } catch (error) { db.close(); throw error; }
};
