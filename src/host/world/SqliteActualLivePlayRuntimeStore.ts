import { assertActualLiveRegistrationBeforeWork } from './ActualLiveRuntimeRegistration';
import { createHash } from 'node:crypto';
import { actualLivePlayOwnerIdentityRow, actualLiveRuntimeClaims } from './ActualLivePlayOwnerMetadata';
import { createRequire } from 'node:module';
import { actualLivePlayRuntimeInput as input, deriveActualLiveRuntimeMembership, deriveOriginalSettledFoulRuntimeMembership,
  deriveOriginalSettledFoulCountRuntimeMembership, deriveOriginalSettledFoulEndRuntimeMembership,
  type AcceptedActualLivePlayRuntime, type DurableActualLivePlayRuntime } from './ActualLivePlayRuntime';
import { actualLivePlayEvidenceFromSqlite } from './ActualLivePlayEvidenceFromSqlite';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { actualLiveAdmissionOwners, beginActualLivePlayRegistration, assertActualLivePlayRegistrationUnchanged } from './ActualLivePlayFence';
type Db = Pick<import('node:sqlite').DatabaseSync, 'prepare'>;
export const actualLiveRuntimeEvidenceFromSqlite = (db: Db) => {
  const derive = (source: AcceptedActualLivePlayRuntime, current = false): DurableActualLivePlayRuntime => {
    const scope = actualLivePlayEvidenceFromSqlite(db).derive({ sourceId: source.sourceId, sourceVersion: source.sourceVersion,
      capability: 'actual_live_play_scope_v1', physicalPitchSourceId: source.physicalPitchSourceId, cut: { kind: 'original_pitch' } }, current).scope;
    if (scope.unsupportedParticipantIds.length) throw new Error('actual live runtime pre-pitch participation is unsupported');
    return freeze({ source, gameId: scope.gameId, playId: scope.playId, originalPitchHash: scope.originalPitchHash,
      membership: source.capability === 'causal_original_settled_foul_end_runtime_v1'
        ? deriveOriginalSettledFoulEndRuntimeMembership(scope) : source.capability === 'causal_original_settled_foul_count_runtime_v1'
          ? deriveOriginalSettledFoulCountRuntimeMembership(scope) : source.capability === 'causal_original_settled_foul_runtime_v1'
            ? deriveOriginalSettledFoulRuntimeMembership(scope) : deriveActualLiveRuntimeMembership(scope) });
  };
  const read = (sourceId: string): DurableActualLivePlayRuntime | null => {
    const row = actualLivePlayOwnerIdentityRow(db, 'actual_live_play_runtimes', sourceId);
    if (!row) return null;
    const source = input(JSON.parse(String(row.source_json)), sourceId), value = derive(source);
    const claims = actualLiveRuntimeClaims(db, { gameId: value.gameId, playId: value.playId, physicalPitchSourceId: source.physicalPitchSourceId });
    if (claims.length !== 1 || claims[0].source_id !== sourceId || row.game_id !== value.gameId || row.play_id !== value.playId
      || row.physical_pitch_source_id !== source.physicalPitchSourceId || row.source_json !== json(source) || row.source_hash !== hash(source)
      || row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) throw new Error('actual live runtime original ownership differs');
    return value;
  };
  const admissions = (runtime: DurableActualLivePlayRuntime) => {
    const rows = db.prepare('SELECT * FROM actual_live_play_admissions WHERE runtime_source_id=? ORDER BY sequence').all(runtime.source.sourceId);
    const seen = new Set<string>();
    for (const [i, row] of rows.entries()) {
      if (row.sequence !== i + 1 || !actualLiveAdmissionOwners.includes(row.owner as typeof actualLiveAdmissionOwners[number])
        || row.owner === 'actual_settled_foul_stop_productions' && !['causal_original_settled_foul_runtime_v1',
          'causal_original_settled_foul_count_runtime_v1', 'causal_original_settled_foul_end_runtime_v1'].includes(runtime.source.capability)
        || row.owner === 'actual_foul_rule_consumptions' && !['causal_original_settled_foul_count_runtime_v1',
          'causal_original_settled_foul_end_runtime_v1'].includes(runtime.source.capability)
        || typeof row.source_id !== 'string' || seen.has(json([row.owner, row.source_id]))) throw new Error('actual live runtime admission sequence differs');
      const owner = db.prepare(`SELECT source_json,source_hash,snapshot_json,snapshot_hash FROM ${row.owner} WHERE source_id=?`).get(row.source_id);
      if (!owner || owner.source_hash !== row.source_hash || owner.snapshot_hash !== row.snapshot_hash
        || typeof owner.source_json !== 'string' || typeof owner.snapshot_json !== 'string'
        || createHash('sha256').update(owner.source_json).digest('hex') !== row.source_hash
        || createHash('sha256').update(owner.snapshot_json).digest('hex') !== row.snapshot_hash) throw new Error('actual live runtime admitted source changed');
      seen.add(json([row.owner, row.source_id]));
    }
    return rows.map(row => ({ sequence: Number(row.sequence), owner: String(row.owner), sourceId: String(row.source_id),
      sourceHash: String(row.source_hash), snapshotHash: String(row.snapshot_hash) }));
  };
  return { derive, read, admissions };
};
export const openSqliteActualLivePlayRuntimeStore = (path: string,
  authority?: Readonly<{ readAcceptedRuntime(sourceId: string): AcceptedActualLivePlayRuntime | null }>) => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=wal; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS actual_live_play_runtimes(source_id TEXT PRIMARY KEY,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,
      physical_pitch_source_id TEXT NOT NULL UNIQUE,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,UNIQUE(game_id,play_id));
    CREATE TABLE IF NOT EXISTS actual_live_play_admissions(runtime_source_id TEXT NOT NULL,sequence INTEGER NOT NULL,owner TEXT NOT NULL,
      source_id TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_hash TEXT NOT NULL,PRIMARY KEY(runtime_source_id,sequence),UNIQUE(owner,source_id));`);
  const own = actualLiveRuntimeEvidenceFromSqlite(db); let closed = false;
  const check = () => { if (closed) throw new Error('closed actual live runtime store'); };
  const before = (value: DurableActualLivePlayRuntime) => {
    if (json(own.derive(value.source, true)) !== json(value)) throw new Error('actual live runtime original changed');
    // This capability cannot retroactively assert scheduling ownership over a
    // previously active field/controller. Original zero-horizon inputs remain
    // independently reconstructed by the physical owners.
    assertActualLiveRegistrationBeforeWork(db, { gameId: value.gameId, playId: value.playId, physicalPitchSourceId: value.source.physicalPitchSourceId });
  };
  const snapshot = <T>(body: () => T): T => {
    db.exec('BEGIN'); try { const value = body(); db.exec('COMMIT'); return value; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  return Object.freeze({ read(sourceId: string) { check(); return snapshot(() => own.read(sourceId)); },
    accept(sourceId: string) {
      check(); const prior = snapshot(() => own.read(sourceId)), raw = authority?.readAcceptedRuntime(sourceId) ?? null;
      const source = raw === null ? null : input(raw, sourceId);
      if (prior) {
        if (source && json(source) !== json(prior.source)) throw new Error('actual live runtime Source frozen differently');
        return snapshot(() => {
          const saved = own.read(sourceId);
          if (!saved || json(saved) !== json(prior)) throw new Error('actual live runtime changed during retry');
          return saved;
        });
      }
      if (!source) throw new Error('accepted actual live runtime Source missing');
      const value = own.derive(source, true); before(value); db.exec('BEGIN IMMEDIATE');
      try {
        const fence = beginActualLivePlayRegistration(db, { gameId: value.gameId, playId: value.playId, physicalPitchSourceId: source.physicalPitchSourceId });
        before(value);
        db.prepare('INSERT INTO actual_live_play_runtimes VALUES(?,?,?,?,?,?,?,?)').run(sourceId, value.gameId, value.playId,
          source.physicalPitchSourceId, json(source), hash(source), json(value), hash(value));
        before(value); const saved = own.read(sourceId);
        if (!saved || json(saved) !== json(value)) throw new Error('actual live runtime changed during registration');
        if (own.admissions(saved).length !== 0) throw new Error('actual live runtime admission appeared during registration');
        assertActualLivePlayRegistrationUnchanged(db, fence);
        db.exec('COMMIT'); return saved;
      } catch (e) { db.exec('ROLLBACK'); throw e; }
    }, close() { if (!closed) { db.close(); closed = true; } },
  });
};
