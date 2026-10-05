import { actualPlayerKinematicsFromOriginalContact, type ActualOriginalContactPlayerKinematics } from './ActualPlayerKinematicsFromOriginalContact';
import { battedWorldContactEvidenceFromSqlite } from './SqliteBattedWorldContactStore';
import { ownedScheduledMotionArchiveHash } from './OwnedScheduledMotionArchive';
import type { DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actualPlayerKinematicsFromPrefix, type ActualPlayerKinematics } from './ActualPlayerKinematicsFromPrefix';
import { actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battedWorldFieldEvidenceFromSqlite, withBattedWorldFieldReadTraversal } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite } from './SqliteBattedWorldFieldExecutionStore';
import { actualPlayerKinematicsFromOwnedRunnerField, type ActualOwnedRunnerFieldKinematics } from './ActualPlayerKinematicsFromOwnedRunnerField';

export type ActualPlayerKinematicsCut = Readonly<{ physicalPitchSourceId: string; playerId: string; baseFieldSourceId: string;
  executionSourceId: string | null; mode: 'original' | 'current' }>;
export type OwnedActualPlayerKinematics = ActualPlayerKinematics & Readonly<{ cut: ActualPlayerKinematicsCut;
  dependencyHashes: Readonly<{ physicalPrefix: string; physicalPitch: string; worldContact: string; model: string }> }>;
export type ActualPlayerOriginalContactCut = Readonly<{ kind: 'owned_runner_contact_v1'; physicalPitchSourceId: string;
  worldContactSourceId: string; playerId: string }>;
export type OwnedActualOriginalContactKinematics = ActualOriginalContactPlayerKinematics & Readonly<{ cut: ActualPlayerOriginalContactCut;
  dependencyHashes: Readonly<{ physicalPrefix: string; physicalPitch: string; worldContact: string; model: string }> }>;
export type ActualPlayerOwnedRunnerFieldCut = Readonly<{ kind: 'owned_runner_field_v1'; physicalPitchSourceId: string;
  fieldSourceId: string; playerId: string }>;
export type OwnedActualRunnerFieldKinematics = ActualOwnedRunnerFieldKinematics & Readonly<{ cut: ActualPlayerOwnedRunnerFieldCut;
  dependencyHashes: Readonly<{ physicalPrefix: string; physicalPitch: string; worldContact: string; model: string; field: string }> }>;
export type SqliteActualPlayerKinematicsReader = Readonly<{ read(cut: ActualPlayerKinematicsCut): OwnedActualPlayerKinematics;
  readOriginalContact(cut: ActualPlayerOriginalContactCut): OwnedActualOriginalContactKinematics;
  readOwnedRunnerField(cut: ActualPlayerOwnedRunnerFieldCut): OwnedActualRunnerFieldKinematics; close(): void }>;
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v === v.trim();
const input = (raw: ActualPlayerKinematicsCut) => {
  const s = cloneInert(raw);
  if (!s || JSON.stringify(Object.keys(s).sort()) !== JSON.stringify(['physicalPitchSourceId', 'playerId', 'baseFieldSourceId', 'executionSourceId', 'mode'].sort())
    || ![s.physicalPitchSourceId, s.playerId, s.baseFieldSourceId].every(id)
    || s.executionSourceId !== null && !id(s.executionSourceId) || s.mode !== 'original' && s.mode !== 'current') {
    throw new Error('invalid actual Player kinematics cut');
  }
  return s;
};

/** Own-reader adapter, suitable for use on a future physical owner's same transaction/connection. */
export const actualPlayerKinematicsEvidenceFromSqlite = (db: Pick<import('node:sqlite').DatabaseSync, 'prepare'>) => {
  const fields = battedWorldFieldEvidenceFromSqlite(db), executions = battedWorldFieldExecutionEvidenceFromSqlite(db);
  const read = (raw: ActualPlayerKinematicsCut): OwnedActualPlayerKinematics => {
    const cut = input(raw), baseField = fields.read(cut.baseFieldSourceId);
    if (!baseField) throw new Error('actual Player kinematics original field is missing');
    const world = baseField.response.touch.worldContact;
    if (world.flight.source.physicalPitchSourceId !== cut.physicalPitchSourceId) throw new Error('actual Player kinematics pitch scope differs');
    const tables = db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('batted_world_field_executions','batted_world_field_execution_heads')").get() as { n: number };
    if (tables.n !== 0 && tables.n !== 2) throw new Error('actual Player kinematics execution owner tables differ');
    const prefix = { baseField, fields: fields.scope(baseField, cut.baseFieldSourceId),
      executions: tables.n === 2 ? executions.scope(baseField, cut.executionSourceId) : [] };
    if (cut.executionSourceId !== null && prefix.executions.at(-1)?.source.sourceId !== cut.executionSourceId) {
      throw new Error('actual Player kinematics original execution is missing');
    }
    if (cut.mode === 'current') {
      fields.current(baseField);
      const last = prefix.executions.at(-1);
      if (last) executions.current(last);
      else if (tables.n === 2 && executions.scope(baseField).length) throw new Error('actual Player kinematics execution cut is stale');
    }
    const value = actualPlayerKinematicsFromPrefix(cut.playerId, prefix);
    // Hash each bounded snapshot separately: aggregated repeated roots can exceed cloneInert's object limit.
    const reference = (owner: 'batted_world_field_actions' | 'batted_world_field_executions',
      snapshot: { source: { sourceId: string }; revision: number }) => ({ owner, sourceId: snapshot.source.sourceId,
      revision: snapshot.revision, snapshotHash: owner === 'batted_world_field_executions'
        ? ownedScheduledMotionArchiveHash(snapshot as DurableBattedWorldFieldExecution) : hash(snapshot) });
    const manifest = { version: 'actual_player_kinematics_prefix_v1',
      baseField: reference('batted_world_field_actions', prefix.baseField),
      fields: prefix.fields.map((snapshot) => reference('batted_world_field_actions', snapshot)),
      executions: prefix.executions.map((snapshot) => reference('batted_world_field_executions', snapshot)) };
    return freeze({ ...value, cut, dependencyHashes: { physicalPrefix: hash(manifest), physicalPitch: hash(world.flight.physicalPitch),
      worldContact: hash(world), model: hash(world.model) } });
  };
  const readOriginalContact = (raw: ActualPlayerOriginalContactCut): OwnedActualOriginalContactKinematics => {
    const cut = cloneInert(raw);
    if (!cut || JSON.stringify(Object.keys(cut).sort()) !== JSON.stringify(['kind', 'physicalPitchSourceId', 'playerId', 'worldContactSourceId'].sort())
      || cut.kind !== 'owned_runner_contact_v1' || ![cut.physicalPitchSourceId, cut.worldContactSourceId, cut.playerId].every(id)) {
      throw new Error('invalid original contact kinematics cut');
    }
    const contacts = battedWorldContactEvidenceFromSqlite(db), world = contacts.read(cut.worldContactSourceId);
    if (!world || world.flight.source.physicalPitchSourceId !== cut.physicalPitchSourceId) throw new Error('original contact kinematics owned Source is missing or differs');
    const head = contacts.head(cut.physicalPitchSourceId);
    if (!head || head.revision < world.revision || head.revision === world.revision && head.source_id !== world.source.sourceId) {
      throw new Error('original contact kinematics prefix metadata differs');
    }
    const metadata = db.prepare('SELECT source_id,game_id,revision,previous_source_id FROM batted_world_contacts WHERE physical_pitch_source_id=? ORDER BY revision')
      .all(cut.physicalPitchSourceId) as { source_id: string; game_id: string; revision: number; previous_source_id: string | null }[];
    if (metadata.length !== head.revision || new Set(metadata.map(row => row.source_id)).size !== metadata.length
      || metadata.some((row, index) => !id(row.source_id) || row.game_id !== world.model.gameId || row.revision !== index + 1
        || row.previous_source_id !== (index === 0 ? null : metadata[index - 1].source_id))
      || metadata[world.revision - 1]?.source_id !== world.source.sourceId) throw new Error('original contact kinematics ownership metadata differs');
    const value = actualPlayerKinematicsFromOriginalContact(cut.playerId, world);
    return freeze({ ...value, cut, dependencyHashes: { physicalPrefix: hash(value.physicalPrefix), ...value.physicalPrefix.dependencyHashes } });
  };
  const readOwnedRunnerField = (raw: ActualPlayerOwnedRunnerFieldCut): OwnedActualRunnerFieldKinematics => {
    const cut = cloneInert(raw);
    if (!cut || JSON.stringify(Object.keys(cut).sort()) !== JSON.stringify(['kind', 'physicalPitchSourceId', 'fieldSourceId', 'playerId'].sort())
      || cut.kind !== 'owned_runner_field_v1' || ![cut.physicalPitchSourceId, cut.fieldSourceId, cut.playerId].every(id)) {
      throw new Error('invalid owned runner field kinematics cut');
    }
    return withBattedWorldFieldReadTraversal(db, () => {
      const field = fields.read(cut.fieldSourceId);
      if (!field || field.source.kind !== 'owned_runner_field_v1'
        || field.response.touch.worldContact.flight.source.physicalPitchSourceId !== cut.physicalPitchSourceId) {
        throw new Error('owned runner field kinematics Source is missing or differs');
      }
      const chain = fields.scope(field, cut.fieldSourceId), world = field.response.touch.worldContact;
      const value = actualPlayerKinematicsFromOwnedRunnerField(cut.playerId, chain);
      return freeze({ ...value, cut, dependencyHashes: { physicalPrefix: hash(value.physicalPrefix), physicalPitch: hash(world.flight.physicalPitch),
        worldContact: hash(world), model: hash(world.model), field: hash(field) } });
    });
  };
  return { read, readOriginalContact, readOwnedRunnerField };
};

/** Opens an existing database read-only. A read transaction pins one consistent SQLite snapshot; no schema or receipt is created. */
export const openSqliteActualPlayerKinematicsReader = (path: string): SqliteActualPlayerKinematicsReader => {
  if (!id(path)) throw new Error('invalid actual Player kinematics database');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(path, { readOnly: true }), own = actualPlayerKinematicsEvidenceFromSqlite(db);
  let closed = false;
  return Object.freeze({ read(cut) {
    if (closed) throw new Error('closed actual Player kinematics reader');
    db.exec('BEGIN');
    try { const value = own.read(cut); db.exec('COMMIT'); return value; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }, readOriginalContact(cut) {
    if (closed) throw new Error('closed actual Player kinematics reader');
    db.exec('BEGIN');
    try { const value = own.readOriginalContact(cut); db.exec('COMMIT'); return value; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }, readOwnedRunnerField(cut) {
    if (closed) throw new Error('closed actual Player kinematics reader');
    db.exec('BEGIN');
    try { const value = own.readOwnedRunnerField(cut); db.exec('COMMIT'); return value; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }, close() { if (!closed) { db.close(); closed = true; } } });
};
