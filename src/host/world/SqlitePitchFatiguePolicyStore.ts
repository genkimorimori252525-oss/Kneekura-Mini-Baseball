import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { validatePitchFatigueExecutionPolicy, type PitchFatigueExecutionPolicy } from '../../core/sim/pitch/PitchFatigueExecution';

export type AcceptedPitchFatiguePolicy = PitchFatigueExecutionPolicy & Readonly<{ sourceId: string; sourceVersion: string }>;
export type SqlitePitchFatiguePolicyStore = Readonly<{
  accept(sourceId: string): AcceptedPitchFatiguePolicy;
  readAcceptedPolicy(sourceId: string): AcceptedPitchFatiguePolicy | null;
  close(): void;
}>;
type Row = { source_id: string; source_version: string; policy_id: string; version: string; source_json: string; policy_json: string; source_hash: string };
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const json = (value: unknown): string => JSON.stringify(cloneInert(value), (_key, item: unknown) => item !== null && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const hash = (value: AcceptedPitchFatiguePolicy): string => createHash('sha256').update(json(value)).digest('hex');
const base = ({ sourceId: _sourceId, sourceVersion: _sourceVersion, ...policy }: AcceptedPitchFatiguePolicy): PitchFatigueExecutionPolicy => policy;
const accepted = (raw: AcceptedPitchFatiguePolicy, sourceId: string): AcceptedPitchFatiguePolicy => {
  const value = cloneInert(raw);
  if (!value || !id(value.sourceId) || value.sourceId !== sourceId || !id(value.sourceVersion)) throw new Error('invalid accepted pitch fatigue policy');
  const policy = validatePitchFatigueExecutionPolicy(base(value));
  return Object.freeze({ sourceId: value.sourceId, sourceVersion: value.sourceVersion, ...policy });
};

/** Explicit independently accepted response calibration; no implicit production policy. */
export const openSqlitePitchFatiguePolicyStore = (databasePath: string,
  authority?: Readonly<{ readAcceptedPolicy(sourceId: string): AcceptedPitchFatiguePolicy | null }>): SqlitePitchFatiguePolicyStore => {
  if (!id(databasePath) || authority != null && typeof authority.readAcceptedPolicy !== 'function') throw new Error('invalid pitch fatigue policy authority');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_pitch_fatigue_policies (
    source_id TEXT PRIMARY KEY, source_version TEXT NOT NULL, policy_id TEXT NOT NULL, version TEXT NOT NULL,
    source_json TEXT NOT NULL, policy_json TEXT NOT NULL, source_hash TEXT NOT NULL
  );`);
  const get = db.prepare('SELECT * FROM world_pitch_fatigue_policies WHERE source_id=?');
  let closed = false;
  const check = (sourceId: string) => { if (closed || !id(sourceId)) throw new Error('invalid or closed pitch fatigue policy scope'); };
  const decode = (row: Row): AcceptedPitchFatiguePolicy => {
    try {
      const value = accepted(JSON.parse(row.source_json) as AcceptedPitchFatiguePolicy, row.source_id);
      if (row.source_version !== value.sourceVersion || row.policy_id !== value.policyId || row.version !== value.version
        || row.source_json !== json(value) || row.policy_json !== json(base(value)) || row.source_hash !== hash(value)) throw new Error('policy archive differs');
      return value;
    } catch (cause) { throw new Error('corrupt accepted pitch fatigue policy', { cause }); }
  };
  return Object.freeze({
    accept(sourceId): AcceptedPitchFatiguePolicy {
      check(sourceId);
      const raw = authority?.readAcceptedPolicy(sourceId) ?? null;
      const value = raw === null ? null : accepted(raw, sourceId);
      db.exec('BEGIN IMMEDIATE');
      try {
        const prior = get.get(sourceId) as Row | undefined;
        if (prior) {
          const saved = decode(prior);
          if (value && json(value) !== json(saved)) throw new Error('pitch fatigue policy Source is already frozen differently');
          db.exec('COMMIT'); return saved;
        }
        if (!value) throw new Error('accepted pitch fatigue policy is missing');
        const policyJson = json(base(value));
        const version = db.prepare('SELECT policy_json FROM world_pitch_fatigue_policies WHERE policy_id=? AND version=? LIMIT 1')
          .get(value.policyId, value.version) as { policy_json: string } | undefined;
        if (version && version.policy_json !== policyJson) throw new Error('pitch fatigue policy version is already frozen differently');
        db.prepare('INSERT INTO world_pitch_fatigue_policies VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(value.sourceId, value.sourceVersion, value.policyId, value.version, json(value), policyJson, hash(value));
        const saved = decode(get.get(sourceId) as Row);
        if (json(saved) !== json(value)) throw new Error('pitch fatigue policy changed during acceptance');
        db.exec('COMMIT'); return saved;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    readAcceptedPolicy(sourceId): AcceptedPitchFatiguePolicy | null {
      check(sourceId); const row = get.get(sourceId) as Row | undefined;
      return row ? decode(row) : null;
    },
    close() { if (!closed) { db.close(); closed = true; } },
  });
};
