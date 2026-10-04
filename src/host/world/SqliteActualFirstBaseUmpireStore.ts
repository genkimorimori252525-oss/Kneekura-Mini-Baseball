import { createRequire } from 'node:module';
import type { OwnedLiveCallSourceReference } from '../../core/adjudication/PlayAdjudicationLedger';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import { defensiveMetadataId as metadataId } from './ActualDefensiveMetadata';
import { readOriginalPhysicalPitchPrefixFromSqlite } from './PhysicalPitchEvidenceFromSqlite';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite } from './SqliteBattedWorldFieldExecutionStore';
import { actorHash as hash, actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { actualFirstBaseSetupInput, actualFirstBaseObservationInput, actualFirstBaseCallInput, sampleActualFirstBaseUmpireObservation,
  deriveActualFirstBaseUmpireCall, actualFirstBaseOffensiveDisposition, umpireId as id,
  type AcceptedActualFirstBaseUmpireSetup, type DurableActualFirstBaseUmpireSetup,
  type AcceptedActualFirstBaseUmpireObservation, type AcceptedActualFirstBaseUmpireCall,
  type DurableActualFirstBaseUmpireObservation, type DurableActualFirstBaseUmpireCall } from './ActualFirstBaseUmpire';
import type { ActualObservationMoment } from './ActualFieldObservation';

export type ActualFirstBaseUmpireAuthority = Readonly<{
  readAcceptedSetup(sourceId: string): AcceptedActualFirstBaseUmpireSetup | null;
  readAcceptedObservation(sourceId: string): AcceptedActualFirstBaseUmpireObservation | null;
  readAcceptedCall(sourceId: string): AcceptedActualFirstBaseUmpireCall | null;
}>;
export type SqliteActualFirstBaseUmpireStore = Readonly<{
  acceptSetup(sourceId: string): DurableActualFirstBaseUmpireSetup; readSetup(sourceId: string): DurableActualFirstBaseUmpireSetup | null;
  observe(sourceId: string): DurableActualFirstBaseUmpireObservation; readObservation(sourceId: string): DurableActualFirstBaseUmpireObservation | null;
  advanceCall(sourceId: string): DurableActualFirstBaseUmpireCall; readCall(sourceId: string): DurableActualFirstBaseUmpireCall | null;
  readAvailableCall(sourceId: string, at: ActualObservationMoment): DurableActualFirstBaseUmpireCall | null;
  close(): void;
}>;
type Db = Pick<import('node:sqlite').DatabaseSync, 'prepare'>;
type Kind = 'setup' | 'observation' | 'call';
const tables = { setup: 'actual_first_base_umpire_setups', observation: 'actual_first_base_umpire_observations', call: 'actual_first_base_umpire_calls' } as const;
type Source = AcceptedActualFirstBaseUmpireSetup | AcceptedActualFirstBaseUmpireObservation | AcceptedActualFirstBaseUmpireCall;
type Durable = DurableActualFirstBaseUmpireSetup | DurableActualFirstBaseUmpireObservation | DurableActualFirstBaseUmpireCall;
type Row = { source_id: string; source_version: string; game_id: string; physical_pitch_source_id: string; umpire_id: string;
  dependency_source_id: string; current_execution_source_id: string | null; source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string };
const input = (kind: Kind, raw: Source, sourceId: string): Source => kind === 'setup'
  ? actualFirstBaseSetupInput(raw as AcceptedActualFirstBaseUmpireSetup, sourceId)
  : kind === 'observation' ? actualFirstBaseObservationInput(raw as AcceptedActualFirstBaseUmpireObservation, sourceId)
    : actualFirstBaseCallInput(raw as AcceptedActualFirstBaseUmpireCall, sourceId);
const scopeOf = (kind: Kind, value: Durable) => {
  if (kind === 'setup') {
    const s = (value as DurableActualFirstBaseUmpireSetup).source;
    return { gameId: s.gameId, pitchId: s.physicalPitchSourceId, umpireId: s.umpireId, dependencyId: s.physicalPitchSourceId, currentId: null };
  }
  const observation = kind === 'observation' ? value as DurableActualFirstBaseUmpireObservation : (value as DurableActualFirstBaseUmpireCall).observation;
  return { gameId: observation.gameId, pitchId: observation.physicalPitchSourceId, umpireId: observation.setup.umpireId,
    dependencyId: kind === 'observation' ? observation.source.setupSourceId : (value as DurableActualFirstBaseUmpireCall).source.observationSourceId,
    currentId: kind === 'observation' ? observation.source.ruleExecutionSourceId : (value as DurableActualFirstBaseUmpireCall).source.currentExecutionSourceId };
};

/** Source identity, original bounded reconstruction and current-cut guards use the caller's one SQLite connection. */
export const actualFirstBaseUmpireEvidenceFromSqlite = (db: Db) => {
  const fields = battedWorldFieldEvidenceFromSqlite(db), executions = battedWorldFieldExecutionEvidenceFromSqlite(db);
  const identityRows = (kind: Kind, sourceId: string): Row[] => db.prepare(`SELECT * FROM ${tables[kind]} WHERE source_id=?
    OR ${metadataId('source_json', ['sourceId'])} OR ${metadataId('snapshot_json', ['source', 'sourceId'])}`)
    .all(sourceId, sourceId, sourceId) as Row[];
  const rowsForSetupPitch = (pitchId: string): Row[] => db.prepare(`SELECT * FROM ${tables.setup} WHERE physical_pitch_source_id=?
    OR ${metadataId('source_json', ['physicalPitchSourceId'])} OR ${metadataId('snapshot_json', ['source', 'physicalPitchSourceId'])}`)
    .all(pitchId, pitchId, pitchId) as Row[];
  const dependentRows = (kind: 'observation' | 'call', dependencyId: string): Row[] => {
    const key = kind === 'observation' ? 'setupSourceId' : 'observationSourceId';
    const embedded = kind === 'observation' ? ['setup', 'sourceId'] : ['observation', 'source', 'sourceId'];
    return db.prepare(`SELECT * FROM ${tables[kind]} WHERE dependency_source_id=? OR ${metadataId('source_json', [key])}
      OR ${metadataId('snapshot_json', ['source', key])} OR ${metadataId('snapshot_json', embedded)}`)
      .all(dependencyId, dependencyId, dependencyId, dependencyId) as Row[];
  };
  // Raw strings are pinned as strings, not reparsed or normalized domain data.
  // This verifies the transaction's unchanged earlier rowset without
  // expanding later payloads into any historical read.
  const captureCallRowset = (observationId: string, insertedSourceId: string | null = null): string => json(
    dependentRows('call', observationId).filter(row => row.source_id !== insertedSourceId)
      .sort((a, b) => a.source_id < b.source_id ? -1 : a.source_id > b.source_id ? 1 : 0));
  const assertCallRowset = (observationId: string, original: string, insertedSourceId: string | null = null): void => {
    if (captureCallRowset(observationId, insertedSourceId) !== original) throw new Error('actual umpire prior call rowset changed during write');
  };
  const physicalPrefix = (sourceId: string) => {
    const value = executions.read(sourceId);
    if (!value) throw new Error('actual umpire original execution Source is missing');
    return { value, prefix: { baseField: value.baseField, fields: fields.scope(value.baseField, value.baseField.source.sourceId),
      executions: executions.scope(value.baseField, sourceId) } };
  };
  const deriveSetup = (source: AcceptedActualFirstBaseUmpireSetup): DurableActualFirstBaseUmpireSetup => {
    const pitch = readOriginalPhysicalPitchPrefixFromSqlite(db, source.physicalPitchSourceId).at(-1)!;
    if (pitch.frame.gameId !== source.gameId || pitch.source.sourceId !== source.physicalPitchSourceId) throw new Error('actual umpire setup original game/pitch differs');
    return freeze({ source, physicalPitchHash: hash(pitch) });
  };
  const deriveObservation = (source: AcceptedActualFirstBaseUmpireObservation): DurableActualFirstBaseUmpireObservation => {
    const setup = read('setup', source.setupSourceId) as DurableActualFirstBaseUmpireSetup | null;
    if (!setup) throw new Error('actual umpire setup Source is unavailable');
    const { value, prefix } = physicalPrefix(source.ruleExecutionSourceId);
    return sampleActualFirstBaseUmpireObservation(source, setup.source, value, prefix);
  };
  const deriveCall = (source: AcceptedActualFirstBaseUmpireCall): DurableActualFirstBaseUmpireCall => {
    const observation = read('observation', source.observationSourceId) as DurableActualFirstBaseUmpireObservation | null;
    if (!observation) throw new Error('actual umpire observation Source is unavailable');
    const { value, prefix } = physicalPrefix(source.currentExecutionSourceId);
    return deriveActualFirstBaseUmpireCall(source, observation, value, prefix);
  };
  const derive = (kind: Kind, source: Source): Durable => kind === 'setup' ? deriveSetup(source as AcceptedActualFirstBaseUmpireSetup)
    : kind === 'observation' ? deriveObservation(source as AcceptedActualFirstBaseUmpireObservation) : deriveCall(source as AcceptedActualFirstBaseUmpireCall);
  const validateRow = (kind: Kind, row: Row): Durable => {
    const source = input(kind, JSON.parse(row.source_json) as Source, row.source_id);
    if (row.source_json !== json(source) || row.source_hash !== hash(source) || row.source_version !== source.sourceVersion) throw new Error('corrupt actual umpire original Source');
    const value = derive(kind, source), scope = scopeOf(kind, value);
    if (row.game_id !== scope.gameId || row.physical_pitch_source_id !== scope.pitchId || row.umpire_id !== scope.umpireId
      || row.dependency_source_id !== scope.dependencyId || row.current_execution_source_id !== scope.currentId
      || row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) throw new Error('corrupt actual umpire snapshot/ownership mirror');
    return value;
  };
  const read = (kind: Kind, sourceId: string): Durable | null => {
    if (!id(sourceId)) throw new Error('invalid actual umpire Source identity');
    const rows = identityRows(kind, sourceId);
    if (rows.length > 1 || rows.length === 1 && rows[0].source_id !== sourceId) throw new Error('actual umpire Source identity ownership differs');
    if (!rows.length) return null;
    const value = validateRow(kind, rows[0]);
    if (kind === 'setup') {
      const scope = rowsForSetupPitch(scopeOf(kind, value).pitchId);
      if (scope.length !== 1 || scope[0].source_id !== sourceId) throw new Error('actual first-base umpire assignment scope differs');
    } else if (kind === 'observation') {
      const scope = dependentRows('observation', scopeOf(kind, value).dependencyId);
      if (scope.length !== 1 || scope[0].source_id !== sourceId) throw new Error('actual umpire observation ownership differs');
    } else {
      // Inspect later ownership metadata without replaying a later Source's domain
      // payload into this original cut. A second claimed operative event is never
      // an alternative call from which a consumer may silently choose.
      const observationId = (value as DurableActualFirstBaseUmpireCall).source.observationSourceId;
      const candidates = dependentRows('call', observationId);
      const claims = db.prepare(`SELECT source_id FROM ${tables.call} WHERE source_id IN
        (${candidates.map(() => '?').join(',') || "''"})
        AND ${metadataId('snapshot_json', ['schedule', 'kind'], "'called'")}`)
        .all(...candidates.map(row => row.source_id));
      if (claims.length > 1) throw new Error('duplicate operative actual umpire call ownership');
    }
    return value;
  };
  const current = (kind: Kind, value: Durable) => {
    if (json(derive(kind, value.source)) !== json(value)) throw new Error('actual umpire original dependencies changed');
    if (kind !== 'setup') {
      const currentId = scopeOf(kind, value).currentId!;
      const dependency = executions.read(currentId)!;
      executions.current(dependency);
    }
  };
  const admission = (kind: Kind, value: Durable, inserted: boolean) => {
    current(kind, value); const scope = scopeOf(kind, value);
    const rows = kind === 'setup' ? rowsForSetupPitch(scope.pitchId) : dependentRows(kind, scope.dependencyId);
    if (kind !== 'call') {
      if (rows.length !== (inserted ? 1 : 0) || inserted && rows[0].source_id !== value.source.sourceId) throw new Error('actual umpire original owner already exists or changed');
    } else {
      const call = value as DurableActualFirstBaseUmpireCall;
      let terminalCount = 0;
      for (const row of rows) {
        const prior = validateRow('call', row) as DurableActualFirstBaseUmpireCall;
        if (prior.schedule.kind === 'called') terminalCount++;
        if (row.source_id !== call.source.sourceId && (prior.schedule.kind === 'called'
          || prior.advancedThrough.elapsedSeconds >= call.advancedThrough.elapsedSeconds)) throw new Error('actual umpire call already occurred or advance is not later');
      }
      if (terminalCount !== (inserted && call.schedule.kind === 'called' ? 1 : 0)) throw new Error('actual umpire terminal call ownership differs');
      if (inserted && !rows.some(row => row.source_id === call.source.sourceId)) throw new Error('actual umpire inserted call Source is missing');
    }
  };
  const available = (sourceId: string, at: ActualObservationMoment): DurableActualFirstBaseUmpireCall | null => {
    const call = read('call', sourceId) as DurableActualFirstBaseUmpireCall | null;
    if (!call) return null;
    const clock = call.observation.clock;
    if (at.originTick !== clock.originTick || at.tick !== quantizeEventTick(clock.originTick, at.elapsedSeconds, clock.ticksPerSecond)) {
      throw new Error('actual umpire availability clock differs');
    }
    return call.schedule.kind === 'called' && at.elapsedSeconds >= call.schedule.availableAtElapsedSeconds ? call : null;
  };
  const reference = (owner: string, source: Readonly<{ sourceId: string; sourceVersion: string }>, value: unknown): OwnedLiveCallSourceReference => freeze({
    owner, sourceId: source.sourceId, sourceVersion: source.sourceVersion, sourceHash: hash(source), snapshotHash: hash(value) });
  const importReferences = (sourceId: string) => {
    const call = read('call', sourceId) as DurableActualFirstBaseUmpireCall | null;
    if (!call || call.schedule.kind !== 'called' || !call.onFieldCall) return null;
    const observation = call.observation, setup = read('setup', observation.source.setupSourceId) as DurableActualFirstBaseUmpireSetup;
    const rule = executions.read(observation.source.ruleExecutionSourceId)!;
    return freeze({ call: reference(tables.call, call.source, call), perception: reference(tables.observation, observation.source, observation),
      policy: reference(tables.setup, setup.source, setup), ruleEvidence: reference('batted_world_field_executions', rule.source, rule) });
  };
  return { readSetup: (sourceId: string) => read('setup', sourceId) as DurableActualFirstBaseUmpireSetup | null,
    readObservation: (sourceId: string) => read('observation', sourceId) as DurableActualFirstBaseUmpireObservation | null,
    readCall: (sourceId: string) => read('call', sourceId) as DurableActualFirstBaseUmpireCall | null,
    readAvailableCall: available, importReferences,
    offensiveDisposition: (sourceId: string, at: ActualObservationMoment) => actualFirstBaseOffensiveDisposition(available(sourceId, at)),
    derive, admission, captureCallRowset, assertCallRowset };
};

export const openSqliteActualFirstBaseUmpireStore = (path: string, authority?: ActualFirstBaseUmpireAuthority): SqliteActualFirstBaseUmpireStore => {
  if (!id(path) || authority && (!['readAcceptedSetup', 'readAcceptedObservation', 'readAcceptedCall'].every(key =>
    typeof authority[key as keyof ActualFirstBaseUmpireAuthority] === 'function'))) throw new Error('invalid actual umpire Source authority');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  for (const kind of ['setup', 'observation', 'call'] as const) db.exec(`CREATE TABLE IF NOT EXISTS ${tables[kind]} (
    source_id TEXT PRIMARY KEY,source_version TEXT NOT NULL,game_id TEXT NOT NULL,physical_pitch_source_id TEXT NOT NULL,
    umpire_id TEXT NOT NULL,dependency_source_id TEXT NOT NULL,current_execution_source_id TEXT,
    source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,
    ${kind === 'setup' ? 'UNIQUE(physical_pitch_source_id)' : kind === 'observation' ? 'UNIQUE(dependency_source_id)' : 'UNIQUE(dependency_source_id,current_execution_source_id)'});`);
  const own = actualFirstBaseUmpireEvidenceFromSqlite(db); let closed = false;
  const check = (sourceId: string) => { if (closed || !id(sourceId)) throw new Error('invalid or closed actual umpire Source'); };
  const get = (kind: Kind, sourceId: string): Durable | null => kind === 'setup' ? own.readSetup(sourceId)
    : kind === 'observation' ? own.readObservation(sourceId) : own.readCall(sourceId);
  const accept = (kind: Kind, sourceId: string): Durable => {
    check(sourceId); const prior = get(kind, sourceId), raw = kind === 'setup' ? authority?.readAcceptedSetup(sourceId)
      : kind === 'observation' ? authority?.readAcceptedObservation(sourceId) : authority?.readAcceptedCall(sourceId);
    const source = raw == null ? null : input(kind, raw, sourceId);
    if (prior) {
      if (source && json(source) !== json(prior.source)) throw new Error('actual umpire Source is frozen differently');
      const saved = get(kind, sourceId);
      if (!saved || json(saved) !== json(prior)) throw new Error('actual umpire original changed during retry');
      return saved;
    }
    if (!source) throw new Error('accepted actual umpire Source is unavailable');
    const observationId = kind === 'call' ? (source as AcceptedActualFirstBaseUmpireCall).observationSourceId : null;
    const priorCallRows = observationId === null ? null : own.captureCallRowset(observationId);
    const assertPriorCalls = (inserted: boolean) => {
      if (observationId !== null && priorCallRows !== null) own.assertCallRowset(observationId, priorCallRows, inserted ? sourceId : null);
    };
    const value = own.derive(kind, source); own.admission(kind, value, false); assertPriorCalls(false);
    db.exec('BEGIN IMMEDIATE');
    try {
      assertPriorCalls(false); own.admission(kind, value, false); assertPriorCalls(false); const scope = scopeOf(kind, value);
      db.prepare(`INSERT INTO ${tables[kind]} VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(sourceId, source.sourceVersion,
        scope.gameId, scope.pitchId, scope.umpireId, scope.dependencyId, scope.currentId, json(source), hash(source), json(value), hash(value));
      assertPriorCalls(true); const saved = get(kind, sourceId);
      if (!saved || json(saved) !== json(value)) throw new Error('actual umpire original changed after insert');
      own.admission(kind, value, true); assertPriorCalls(true); db.exec('COMMIT'); return value;
    } catch (error) { try { db.exec('ROLLBACK'); } catch { /* retain original failure */ } throw error; }
  };
  return freeze({ acceptSetup(sourceId: string) { return accept('setup', sourceId) as DurableActualFirstBaseUmpireSetup; },
    readSetup(sourceId: string) { check(sourceId); return own.readSetup(sourceId); },
    observe(sourceId: string) { return accept('observation', sourceId) as DurableActualFirstBaseUmpireObservation; },
    readObservation(sourceId: string) { check(sourceId); return own.readObservation(sourceId); },
    advanceCall(sourceId: string) { return accept('call', sourceId) as DurableActualFirstBaseUmpireCall; },
    readCall(sourceId: string) { check(sourceId); return own.readCall(sourceId); },
    readAvailableCall(sourceId: string, at: ActualObservationMoment) { check(sourceId); return own.readAvailableCall(sourceId, at); },
    close() { if (!closed) { closed = true; db.close(); } } });
};
