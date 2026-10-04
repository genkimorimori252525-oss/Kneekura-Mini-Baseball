import { createRequire } from 'node:module';
import { assertDefensiveMetadataUnambiguous as unambiguous, defensiveMetadataId as metadataId, defensiveMetadataScope as metadataScope } from './ActualDefensiveMetadata';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { PrePlayDefensivePlan } from '../../core/sim/fielding/DefensiveDecision';
import type { ActualObservationMoment } from './ActualFieldObservation';
import { actualObservationId as id } from './ActualFieldObservation';
import { actualDefensiveContextFromSqlite, defensiveFields as fields, defensiveTick, type DefensiveDb } from './ActualDefensiveContext';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';

/** Explicit imported contextual priorities; this does not claim that pre-play planning was executed. */
export type AcceptedActualDefensivePlan = Readonly<{
  sourceId: string; sourceVersion: string; provenance: 'accepted_at_actual_observation';
  physicalPitchSourceId: string; careerId: string; playerId: string; personLinkSourceId: string; fieldingModelSourceId: string;
  gameDay: number; observationSourceId: string; priorities: PrePlayDefensivePlan;
}>;
export type DurableActualDefensivePlan = Readonly<{ source: AcceptedActualDefensivePlan; binding: OfficialParticipantBinding;
  availability: ActualObservationMoment; observationHash: string; fieldingModelHash: string }>;
type Authority = Readonly<{ readAcceptedPlan(sourceId: string): AcceptedActualDefensivePlan | null }>;
type Row = { source_id: string; source_version: string; physical_pitch_source_id: string; career_id: string; player_id: string;
  person_link_source_id: string; fielding_model_source_id: string; game_day: number; observation_source_id: string;
  source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string };
const input = (raw: AcceptedActualDefensivePlan, sourceId?: string): AcceptedActualDefensivePlan => {
  const s = cloneInert(raw), p = s.priorities, unit = (n: number) => Number.isFinite(n) && n >= 0 && n <= 1;
  if (!fields(s, ['sourceId', 'sourceVersion', 'provenance', 'physicalPitchSourceId', 'careerId', 'playerId', 'personLinkSourceId',
    'fieldingModelSourceId', 'gameDay', 'observationSourceId', 'priorities']) || sourceId !== undefined && s.sourceId !== sourceId
    || ![s.sourceId, s.sourceVersion, s.physicalPitchSourceId, s.careerId, s.playerId, s.personLinkSourceId, s.fieldingModelSourceId, s.observationSourceId].every(id)
    || s.provenance !== 'accepted_at_actual_observation' || !defensiveTick(s.gameDay)
    || !fields(p, ['ballPursuitPriority', 'baseCoverPriorities', 'relayPriority', 'backupPriority', 'deepCoveragePriority', 'holdPriority'])
    || ![p.ballPursuitPriority, p.relayPriority, p.backupPriority, p.deepCoveragePriority, p.holdPriority].every(unit)
    || !Array.isArray(p.baseCoverPriorities) || new Set(p.baseCoverPriorities.map(v => v?.base)).size !== p.baseCoverPriorities.length
    || p.baseCoverPriorities.some(v => !fields(v, ['base', 'priority']) || ![1, 2, 3, 4].includes(v.base) || !unit(v.priority))) {
    throw new Error('invalid accepted actual defensive plan Source');
  }
  return freeze(s);
};
export const actualDefensivePlanEvidenceFromSqlite = (db: DefensiveDb) => {
  const contexts = actualDefensiveContextFromSqlite(db);
  const derive = (raw: AcceptedActualDefensivePlan, current = false): DurableActualDefensivePlan => {
    const source = input(raw), c = contexts.read(source.observationSourceId, source.physicalPitchSourceId, source.playerId, current);
    if (source.careerId !== c.binding.careerId || source.personLinkSourceId !== c.binding.personLinkSourceId
      || source.gameDay !== c.binding.gameDay || source.fieldingModelSourceId !== c.fieldingModel.source.sourceId) {
      throw new Error('actual defensive plan original Player/Person/fielding/day scope differs');
    }
    return freeze({ source, binding: c.binding, availability: c.observation.receipt.at,
      observationHash: hash(c.observation), fieldingModelHash: hash(c.fieldingModel) });
  };
  const scope = (pitchId: string, playerId: string): readonly DurableActualDefensivePlan[] => {
    const rows = db.prepare(`SELECT * FROM actual_defensive_plans WHERE (physical_pitch_source_id=? AND player_id=?)
      OR ${metadataScope('source_json')}
      OR ${metadataScope('snapshot_json', ['source'])}
      OR (${metadataId('snapshot_json', ['source', 'physicalPitchSourceId'])} AND ${metadataId('snapshot_json', ['binding', 'playerId'])})
      OR EXISTS (SELECT 1 FROM actual_field_observations o WHERE o.physical_pitch_source_id=? AND o.player_id=?
        AND (o.source_id=actual_defensive_plans.observation_source_id
          OR ${metadataId('actual_defensive_plans.source_json', ['observationSourceId'], 'o.source_id')}
          OR ${metadataId('actual_defensive_plans.snapshot_json', ['source', 'observationSourceId'], 'o.source_id')}))`)
      .all(pitchId, playerId, pitchId, playerId, pitchId, playerId, pitchId, playerId, pitchId, playerId) as Row[];
    if (rows.length > 1) throw new Error('actual defensive plan baseline scope differs');
    return rows.map(row => {
      unambiguous(db, 'plan', row.source_json, row.snapshot_json);
      const source = input(JSON.parse(row.source_json), row.source_id), value = derive(source);
      if (row.physical_pitch_source_id !== pitchId || source.physicalPitchSourceId !== pitchId || row.player_id !== playerId || source.playerId !== playerId
        || row.source_version !== source.sourceVersion || row.career_id !== source.careerId || row.person_link_source_id !== source.personLinkSourceId
        || row.fielding_model_source_id !== source.fieldingModelSourceId || row.game_day !== source.gameDay || row.observation_source_id !== source.observationSourceId
        || row.source_json !== json(source) || row.source_hash !== hash(source) || row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) {
        throw new Error('corrupt original actual defensive plan archive');
      }
      return value;
    });
  };
  const read = (sourceId: string): DurableActualDefensivePlan | null => {
    if (!id(sourceId)) throw new Error('invalid actual defensive plan identity');
    const rows = db.prepare(`SELECT * FROM actual_defensive_plans WHERE source_id=?
      OR ${metadataId('source_json', ['sourceId'])} OR ${metadataId('snapshot_json', ['source', 'sourceId'])}`)
      .all(sourceId, sourceId, sourceId) as Row[];
    if (rows.length > 1) throw new Error('actual defensive plan identity scope differs');
    if (!rows.length) return null;
    unambiguous(db, 'plan', rows[0].source_json, rows[0].snapshot_json);
    const source = input(JSON.parse(rows[0].source_json), sourceId), value = scope(source.physicalPitchSourceId, source.playerId)[0];
    if (!value || value.source.sourceId !== sourceId) throw new Error('actual defensive plan outside original scope');
    return value;
  };
  const before = (raw: DurableActualDefensivePlan) => {
    const value = cloneInert(raw);
    if (scope(value.source.physicalPitchSourceId, value.source.playerId).length) throw new Error('actual defensive plan baseline already exists');
    if (json(derive(value.source, true)) !== json(value)) throw new Error('actual defensive plan dependency changed before write');
  };
  return { derive, read, before };
};
export const openSqliteActualDefensivePlanStore = (path: string, authority?: Authority) => {
  if (!id(path) || authority != null && typeof authority.readAcceptedPlan !== 'function') throw new Error('invalid actual defensive plan owner');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS actual_defensive_plans (source_id TEXT PRIMARY KEY,source_version TEXT NOT NULL,
    physical_pitch_source_id TEXT NOT NULL,career_id TEXT NOT NULL,player_id TEXT NOT NULL,person_link_source_id TEXT NOT NULL,
    fielding_model_source_id TEXT NOT NULL,game_day INTEGER NOT NULL,observation_source_id TEXT NOT NULL,
    source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,
    UNIQUE(physical_pitch_source_id,player_id));`);
  const own = actualDefensivePlanEvidenceFromSqlite(db); let closed = false;
  const check = () => { if (closed) throw new Error('closed actual defensive plan store'); };
  return Object.freeze({ read(sourceId: string) { check(); return own.read(sourceId); },
    accept(sourceId: string): DurableActualDefensivePlan {
      check(); const prior = own.read(sourceId), raw = authority?.readAcceptedPlan(sourceId) ?? null, source = raw === null ? null : input(raw, sourceId);
      if (prior) {
        if (source && json(source) !== json(prior.source)) throw new Error('actual defensive plan Source frozen differently');
        const saved = own.read(sourceId); if (!saved || json(saved) !== json(prior)) throw new Error('actual defensive plan changed during retry'); return saved;
      }
      if (!source) throw new Error('accepted actual defensive plan Source missing');
      const value = own.derive(source); own.before(value); db.exec('BEGIN IMMEDIATE');
      try {
        own.before(value);
        db.prepare('INSERT INTO actual_defensive_plans VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(sourceId, source.sourceVersion, source.physicalPitchSourceId,
          source.careerId, source.playerId, source.personLinkSourceId, source.fieldingModelSourceId, source.gameDay, source.observationSourceId,
          json(source), hash(source), json(value), hash(value));
        const saved = own.read(sourceId);
        if (!saved || json(saved) !== json(value) || json(own.derive(source, true)) !== json(value)) throw new Error('actual defensive plan changed during write');
        db.exec('COMMIT'); return saved;
      } catch (e) { db.exec('ROLLBACK'); throw e; }
    }, close() { if (!closed) { db.close(); closed = true; } } });
};
