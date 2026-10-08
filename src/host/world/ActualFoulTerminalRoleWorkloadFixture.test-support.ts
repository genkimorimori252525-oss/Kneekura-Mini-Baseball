import { createRequire } from 'node:module';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync as Database } from 'node:sqlite';
import { expect } from 'vitest';
import type { PlayerWorkloadActivity, PlayerWorkloadRecoveryState } from '../../core/world/development/PlayerWorkloadRecovery';
import { advancePlayerWorkloadRecovery, createPlayerWorkloadRecovery } from '../../core/world/development/PlayerWorkloadRecovery';
import type { FoulEndedEvidence } from './ActualFoulPlayEnd';
import type { DurableFoulTerminalApplication, FoulTerminalParticipant, FoulTerminalPhysicalPitchReference } from './ActualFoulTerminalApplication';
import type { FoulOfficialEndReference } from './ActualFoulOfficial';
import type { AcceptedPlayerWorkloadBaseline } from './SqlitePlayerWorkloadRecoveryStore';
import type { SqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
import { openSqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
import { foulTerminalApplicationEvidenceFromSqlite, foulTerminalPendingInput } from './ActualFoulTerminalApplicationEvidenceFromSqlite';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { prepareRetainedTerminalAcknowledgementCopy } from './ActualFoulTerminalAcknowledgementRetained.test-support';
import { rawCensus, schemaCensus, fileHash } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';

// Proposed public types only. No production module/import exists until a genuine
// missing-capability RED has been observed under separately admitted controls.
export type TerminalWorkloadReference = Readonly<{
  owner: 'actual_foul_terminal_applications'; sourceId: string; sourceVersion: string;
  sourceHash: string; proposalHash: string; officialReceiptHash: string; acknowledgementHash: string;
}>;
export type AcceptedTerminalWorkloadAssessment = Readonly<{
  sourceId: string; sourceVersion: string; capability: 'actual_foul_terminal_total_workload_v1';
  terminalReference: TerminalWorkloadReference; physicalEndReference: FoulOfficialEndReference;
  wholeHistoryReference: Readonly<{ hash: string; convention: 'owned_scheduled_whole_history_manifest_v1' }>;
  originalPhysicalPitchPrefix: readonly FoulTerminalPhysicalPitchReference[];
  participantReference: Readonly<{ playerId: string; bindingHash: string; personHash: string }>;
  effortUnits: number;
  provenance: Readonly<{ assessmentSourceId: string; assessmentVersion: string; calibrationSourceId: string; calibrationVersion: string }>;
}>;
export type TerminalWorkloadContextReference = Readonly<{
  terminalSourceId: string; terminalReference: TerminalWorkloadReference;
  careerId: string; gameId: string; playId: number; gameDay: number;
  physicalEndReference: FoulOfficialEndReference;
  wholeHistoryReference: AcceptedTerminalWorkloadAssessment['wholeHistoryReference'];
  originalPhysicalPitchPrefix: readonly FoulTerminalPhysicalPitchReference[];
}>;
type Terminal = Extract<DurableFoulTerminalApplication, { status: 'OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY' }>;
export type TerminalWorkloadContext = Readonly<{ terminal: Terminal; actors: readonly FoulTerminalParticipant[]; reference: TerminalWorkloadContextReference }>;
export type TerminalWorkloadParticipant = Readonly<{
  playerId: string; personId: string; clubId: string; assessmentSourceId: string;
  activity: Extract<PlayerWorkloadActivity, { kind: 'MATCH' }>;
  before: PlayerWorkloadRecoveryState; after: PlayerWorkloadRecoveryState; applied: boolean;
}>;
export type TerminalWorkloadPlan = TerminalWorkloadContextReference & (
  Readonly<{ kind: 'pending'; missingAssessments: readonly string[]; missingBaselines: readonly string[]; reason?: 'settlement_not_frozen' }>
  | Readonly<{ kind: 'applying' | 'complete'; capturedAt: 'settlement_freeze'; participants: readonly TerminalWorkloadParticipant[];
      assessmentHashes: readonly Readonly<{ sourceId: string; hash: string }>[] }>);
export type TerminalWorkloadAuthority = Readonly<{
  readAcceptedAssessment(sourceId: string): AcceptedTerminalWorkloadAssessment | null;
  readAcceptedBaseline?(sourceId: string): AcceptedPlayerWorkloadBaseline | null;
}>;
export type TerminalWorkloadStore = Readonly<{
  acceptAssessment(sourceId: string): unknown; acceptAssessments(sourceIds: readonly string[]): readonly unknown[];
  initializeBaseline(terminalSourceId: string, baselineSourceId: string): PlayerWorkloadRecoveryState;
  freeze(terminalSourceId: string): TerminalWorkloadPlan;
  settle(terminalSourceId: string): TerminalWorkloadPlan;
  readSettlement(terminalSourceId: string): TerminalWorkloadPlan; close(): void;
}>;
export type TerminalWorkloadApi = Readonly<{
  context(db: Database, terminalSourceId: string): TerminalWorkloadContext;
  open(path: string, personLinks: Pick<SqlitePlayerPersonLinkStore, 'readLink'>, authority?: TerminalWorkloadAuthority): TerminalWorkloadStore;
}>;

export const workloadTables = ['actual_role_workload_assessments', 'actual_role_workload_settlements',
  'world_player_workload_policies', 'world_player_workload_baselines', 'world_player_workload_heads', 'world_player_workload_activities'] as const;
// Canonical existing layouts copied literally in meaning. Installation belongs
// to exclusive private test-copy preparation, never the terminal production API.
const layouts: readonly [string, string][] = [
  ['actual_role_workload_assessments', `CREATE TABLE IF NOT EXISTS actual_role_workload_assessments(source_id TEXT PRIMARY KEY,closure_source_id TEXT NOT NULL,
    career_id TEXT NOT NULL,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,player_id TEXT NOT NULL,
    source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,
    UNIQUE(career_id,game_id,play_id,player_id))`],
  ['actual_role_workload_settlements', `CREATE TABLE IF NOT EXISTS actual_role_workload_settlements(closure_source_id TEXT PRIMARY KEY,career_id TEXT NOT NULL,
    game_id TEXT NOT NULL,play_id INTEGER NOT NULL,plan_json TEXT NOT NULL,plan_hash TEXT NOT NULL,UNIQUE(career_id,game_id,play_id))`],
  ['world_player_workload_policies', `CREATE TABLE IF NOT EXISTS world_player_workload_policies (
    career_id TEXT NOT NULL, policy_id TEXT NOT NULL, version TEXT NOT NULL, policy_json TEXT NOT NULL,
    PRIMARY KEY(career_id, policy_id, version))`],
  ['world_player_workload_baselines', `CREATE TABLE IF NOT EXISTS world_player_workload_baselines (
    source_id TEXT PRIMARY KEY, career_id TEXT NOT NULL, player_id TEXT NOT NULL,
    source_json TEXT NOT NULL, initial_json TEXT NOT NULL, UNIQUE(career_id, player_id))`],
  ['world_player_workload_heads', `CREATE TABLE IF NOT EXISTS world_player_workload_heads (
    career_id TEXT NOT NULL, player_id TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision >= 0),
    state_json TEXT NOT NULL, PRIMARY KEY(career_id, player_id))`],
  ['world_player_workload_activities', `CREATE TABLE IF NOT EXISTS world_player_workload_activities (
    source_id TEXT PRIMARY KEY, career_id TEXT NOT NULL, player_id TEXT NOT NULL,
    before_revision INTEGER NOT NULL CHECK(before_revision >= 0), after_revision INTEGER NOT NULL CHECK(after_revision > before_revision),
    source_json TEXT NOT NULL, before_json TEXT NOT NULL, after_json TEXT NOT NULL,
    UNIQUE(career_id, player_id, after_revision))`],
];
const compact = (sql: string) => sql.replace(/'(?:[^']|'')*'|"(?:[^"]|"")*"|\s+/g,
  token => token[0] === "'" || token[0] === '"' ? token : '').replace(/^CREATETABLE(?:IFNOTEXISTS)?(?:main\.)?/i, '');
export const rows = (db: Database, table: string) => db.prepare('SELECT rowid AS __ack_rowid,* FROM main."'
  + table.replaceAll('"', '""') + '" ORDER BY rowid').all();
export const literal = (value: string) => "'" + value.replaceAll("'", "''") + "'";

/** The reviewed retained helper performs copy-only lineage admission. This
 * helper authenticates genuine current owners before layout or fixture inputs.
 * It never reruns a pitch/field producer or applies/acknowledges the terminal. */
export const prepareTerminalWorkloadCopy = () => {
  const retained = prepareRetainedTerminalAcknowledgementCopy('acknowledged');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(retained.path);
  let links: SqlitePlayerPersonLinkStore | undefined;
  try {
    const saved = withSqliteReadTransaction(db, () => foulTerminalApplicationEvidenceFromSqlite(db).read(retained.sourceId));
    expect(saved?.status).toBe('OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY');
    if (!saved || saved.status !== 'OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY') throw new Error('GENUINE_TERMINAL_WORKLOAD_ACKNOWLEDGEMENT_MISSING');
    const p = saved.proposal, request = foulTerminalPendingInput(p), official = saved.result.official;
    expect(db.prepare('SELECT request_hash,result_json FROM main.applications WHERE application_id=?').get(p.source.applicationId))
      .toEqual({ request_hash: hash(request), result_json: json(official) });
    expect(db.prepare('SELECT durable_revision,state_json,activation_json FROM main.matches WHERE match_id=?').get(p.gameId))
      .toEqual({ durable_revision: official.receipt.durableRevision, state_json: json(p.nextMatch), activation_json: json({ pendingPostPlay: official.pendingPostPlay }) });
    const endRow = db.prepare('SELECT * FROM main.actual_foul_play_ends WHERE source_id=?').get(p.physicalEndReference.sourceId)!;
    // E archives the projection without its reconstructed wholeHistory payload.
    const end = JSON.parse(String(endRow.snapshot_json)) as Omit<FoulEndedEvidence, 'wholeHistory'>;
    expect(end.kind).toBe('ended'); expect(endRow.snapshot_hash).toBe(hash(end));
    expect(endRow.snapshot_hash).toBe(p.physicalEndReference.snapshotHash);
    expect(endRow.source_hash).toBe(p.physicalEndReference.sourceHash);
    expect(end.pending.workloadSettlement).toBe('unowned'); expect(end.pending.reset).toBe('unowned');
    expect(end.wholeHistoryHashConvention).toBe('owned_scheduled_whole_history_manifest_v1');
    expect(p.originalPhysicalPitchPrefix.length).toBeGreaterThan(0);
    expect(p.originalPhysicalPitchPrefix.at(-1)).toEqual(p.physicalPitchReference);
    for (const ref of p.originalPhysicalPitchPrefix) {
      const row = db.prepare('SELECT * FROM main.physical_pitch_progress_actions WHERE source_id=?').get(ref.sourceId)!;
      expect(row.source_hash).toBe(ref.sourceHash); expect(row.snapshot_hash).toBe(ref.snapshotHash);
      if (ref.sourceId === p.physicalPitchSourceId) {
        const pitch = JSON.parse(String(row.snapshot_json));
        expect(pitch.result.pitch.resolution.timeline.status.kind).toBe('batted_ball_pending');
        // SQLite archives canonical JSON; JSON normalizes a computed -0 to 0.
        // Compare the actual wire contract, preserving every archived event byte.
        expect(json(pitch.result.pitch.resolution.timeline)).toBe(json(p.originalPhysicalTimeline));
      }
    }
    const actors = [...p.participants].sort((a, b) => a.binding.playerId < b.binding.playerId ? -1 : a.binding.playerId > b.binding.playerId ? 1 : 0);
    expect(actors).toHaveLength(10); expect(new Set(actors.map(a => a.binding.playerId)).size).toBe(10);
    expect(new Set(actors.map(a => a.person.personId)).size).toBe(10);
    expect(actors.filter(a => a.role === 'batter')).toHaveLength(1);
    expect(actors.filter(a => a.role === 'defender')).toHaveLength(9);
    const terminalReference: TerminalWorkloadReference = { owner: 'actual_foul_terminal_applications', sourceId: saved.source.sourceId,
      sourceVersion: saved.source.sourceVersion, sourceHash: hash(saved.source), proposalHash: hash(p),
      officialReceiptHash: hash(official.receipt), acknowledgementHash: hash(saved.result.acknowledgement) };
    const reference: TerminalWorkloadContextReference = { terminalSourceId: saved.source.sourceId, terminalReference,
      careerId: actors[0].binding.careerId, gameId: p.gameId, playId: p.playId, gameDay: actors[0].binding.gameDay,
      physicalEndReference: p.physicalEndReference,
      wholeHistoryReference: { hash: end.wholeHistoryHash, convention: end.wholeHistoryHashConvention },
      originalPhysicalPitchPrefix: p.originalPhysicalPitchPrefix };
    for (const actor of actors) expect(actor.binding).toMatchObject({ careerId: reference.careerId, gameId: reference.gameId, gameDay: reference.gameDay });

    const beforeRows = rawCensus(db), beforeSchema = schemaCensus(db), added: string[] = [];
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const [table, sql] of layouts) {
        const existing = db.prepare('SELECT type,sql FROM main.sqlite_master WHERE name=?').all(table);
        expect(db.prepare('SELECT name FROM temp.sqlite_master WHERE name=?').all(table)).toEqual([]);
        if (!existing.length) { db.exec(sql); added.push(table); }
        else { expect(existing).toHaveLength(1); expect(existing[0].type).toBe('table'); expect(compact(String(existing[0].sql))).toBe(compact(sql)); }
      }
      db.exec('COMMIT');
    } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
    expect(rawCensus(db, added)).toEqual(beforeRows);
    const afterSchema = schemaCensus(db);
    expect(afterSchema.main.filter(row => !added.includes(String(row.tbl_name)))).toEqual(beforeSchema.main);
    expect(afterSchema.temp).toEqual(beforeSchema.temp); expect(afterSchema.tempVersion).toBe(beforeSchema.tempVersion);
    expect(afterSchema.userVersion).toBe(beforeSchema.userVersion);
    expect(afterSchema.mainVersion).toBe(Number(beforeSchema.mainVersion) + added.length);
    writeFileSync(join(retained.directory, 'workload-layout-receipt.json'), JSON.stringify({
      version: 'terminal_workload_private_layout_v1', added, beforeSchema, afterSchema, originalRowsHash: hash(beforeRows),
      retainedSha256: retained.retainedSha256, destinationPath: retained.path,
    }, null, 2), { flag: 'wx' });
    const beforeLinks = rawCensus(db), linksSchema = schemaCensus(db);
    links = openSqlitePlayerPersonLinkStore(retained.path);
    for (const actor of actors) expect(links.readLink(actor.binding.personLinkSourceId)).toEqual(actor.person);
    expect(rawCensus(db)).toEqual(beforeLinks); expect(schemaCensus(db)).toEqual(linksSchema);
    expect(fileHash(retained.retainedPath)).toBe(retained.retainedSha256);
    return { ...retained, db, links, saved, actors, reference };
  } catch (error) { try { links?.close(); } finally { db.close(); } throw error; }
};
export type TerminalWorkloadFixture = ReturnType<typeof prepareTerminalWorkloadCopy>;

/** Prospective fixture-only accepted packet, copied from the already declared
 * role-workload harness by coordinator instruction. No runtime or production
 * calibration may call this helper. Current genuine participants supply identity;
 * these numbers are explicit synthetic test acceptance, not inferred effort. */
export const acceptedTerminalWorkloadFixturePacket = (f: TerminalWorkloadFixture) => {
  const efforts = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
  const assessments = new Map<string, AcceptedTerminalWorkloadAssessment>();
  const baselines = new Map<string, AcceptedPlayerWorkloadBaseline>();
  for (const [i, actor] of f.actors.entries()) {
    const playerId = actor.binding.playerId, sourceId = 'fixture-terminal-total-effort:' + playerId;
    assessments.set(sourceId, { sourceId, sourceVersion: 'fixture-v1', capability: 'actual_foul_terminal_total_workload_v1',
      terminalReference: f.reference.terminalReference, physicalEndReference: f.reference.physicalEndReference,
      wholeHistoryReference: f.reference.wholeHistoryReference, originalPhysicalPitchPrefix: f.reference.originalPhysicalPitchPrefix,
      participantReference: { playerId, bindingHash: hash(actor.binding), personHash: hash(actor.person) }, effortUnits: efforts[i],
      provenance: { assessmentSourceId: 'explicit-fixture-assessment:' + playerId, assessmentVersion: 'fixture-v1',
        calibrationSourceId: 'explicit-fixture-total-effort', calibrationVersion: 'fixture-v1' } });
    const existing = withSqliteReadTransaction(f.db, () => readActualRoleWorkloadState(f.db, f.reference.careerId, playerId, undefined, actor.binding.personLinkSourceId));
    if (!existing) {
      const baselineId = 'fixture-terminal-role-baseline:' + playerId;
      baselines.set(baselineId, { sourceId: baselineId, sourceVersion: 'fixture-v1', personLinkSourceId: actor.binding.personLinkSourceId,
        careerId: f.reference.careerId, playerId, createdAtDay: f.reference.gameDay, fatigue: 0.1, recoveryCapacity: 0.5,
        policy: { policyId: 'explicit-role-workload-fixture', version: 'fixture-v1', availableAtDay: 0,
          workloadFatiguePerUnit: 0.01, travelFatiguePerKm: 0.001, recoveryPerHour: 0.1 } });
    }
  }
  const authority: TerminalWorkloadAuthority = { readAcceptedAssessment: id => assessments.get(id) ?? null,
    readAcceptedBaseline: id => baselines.get(id) ?? null };
  return { assessments, baselines, authority };
};

/** Qualify setup as well as settlement: existing baselines/policies/heads are
 * immutable. Only the exact accepted missing baseline, canonical initial state,
 * and an absent matching policy row may be added. No pre-existing activity moves. */
export const initializeTerminalWorkloadFixtureBaselines = (f: TerminalWorkloadFixture, store: TerminalWorkloadStore,
  packet: ReturnType<typeof acceptedTerminalWorkloadFixturePacket>) => {
  const accounting = observeTerminalWorkloadConnectionChanges();
  try {
    const before = rawCensus(f.db), schema = schemaCensus(f.db);
    const expected = before.map(owner => ({ ...owner, rows: owner.rows.map(row => ({ ...row })) }));
    const table = (name: string) => expected.find(owner => owner.table === name)!.rows;
    const append = (name: string, row: Record<string, string | number>) => {
      const target = table(name);
      target.push({ __ack_rowid: Math.max(0, ...target.map(row => Number(row.__ack_rowid))) + 1, ...row });
    };
    for (const source of packet.baselines.values()) {
      const initial = createPlayerWorkloadRecovery({ careerId: source.careerId, playerId: source.playerId, createdAtDay: source.createdAtDay,
        fatigue: source.fatigue, recoveryCapacity: source.recoveryCapacity, policy: source.policy });
      const policy = table('world_player_workload_policies').find(row => row.career_id === source.careerId
        && row.policy_id === source.policy.policyId && row.version === source.policy.version);
      if (policy) expect(policy.policy_json).toBe(json(source.policy));
      else append('world_player_workload_policies', { career_id: source.careerId, policy_id: source.policy.policyId,
        version: source.policy.version, policy_json: json(source.policy) });
      append('world_player_workload_baselines', { source_id: source.sourceId, career_id: source.careerId, player_id: source.playerId,
        source_json: json(source), initial_json: json(initial) });
      append('world_player_workload_heads', { career_id: source.careerId, player_id: source.playerId, revision: 0, state_json: json(initial) });
      expect(store.initializeBaseline(f.sourceId, source.sourceId)).toEqual(initial);
      expect(rawCensus(f.db)).toEqual(expected); expect(schemaCensus(f.db)).toEqual(schema);
    }
    expect(rawCensus(f.db)).toEqual(expected); expect(schemaCensus(f.db)).toEqual(schema);
    const insertedRows = expected.reduce((sum, owner, i) => sum + owner.rows.length - before[i].rows.length, 0);
    accounting.assertChanges(insertedRows);
  } finally { accounting.close(); }
};

/** Call only after the genuine prerequisite helper has returned. */
export const requireTerminalWorkload = async (): Promise<TerminalWorkloadApi> => {
  const storeId = './SqliteActualFoulTerminalRoleWorkloadStore', evidenceId = './ActualFoulTerminalRoleWorkloadEvidenceFromSqlite';
  const owner: { openSqliteActualFoulTerminalRoleWorkloadStore?: TerminalWorkloadApi['open'] } =
    existsSync(new URL(storeId + '.ts', import.meta.url)) ? await import(/* @vite-ignore */ storeId) : {};
  expect(typeof owner.openSqliteActualFoulTerminalRoleWorkloadStore, 'GENUINE_ACKNOWLEDGED_TERMINAL_WORKLOAD_API_MISSING').toBe('function');
  const evidence: { foulTerminalRoleWorkloadContextFromSqlite?: TerminalWorkloadApi['context'] } =
    existsSync(new URL(evidenceId + '.ts', import.meta.url)) ? await import(/* @vite-ignore */ evidenceId) : {};
  expect(typeof evidence.foulTerminalRoleWorkloadContextFromSqlite, 'GENUINE_ACKNOWLEDGED_TERMINAL_WORKLOAD_CONTEXT_MISSING').toBe('function');
  return { open: owner.openSqliteActualFoulTerminalRoleWorkloadStore!, context: evidence.foulTerminalRoleWorkloadContextFromSqlite! };
};

export const expectedActivity = (f: TerminalWorkloadFixture, source: AcceptedTerminalWorkloadAssessment): Extract<PlayerWorkloadActivity, { kind: 'MATCH' }> => ({
  sourceEventId: 'actual-total-play-workload:' + hash([f.reference.careerId, f.reference.gameId, f.reference.playId, source.participantReference.playerId]),
  sourceVersion: 'actual-total-play-workload-v1', evidenceId: f.reference.physicalEndReference.sourceId,
  careerId: f.reference.careerId, playerId: source.participantReference.playerId, atDay: f.reference.gameDay, kind: 'MATCH', effortUnits: source.effortUnits,
});
export const assertFrozenParticipants = (f: TerminalWorkloadFixture, plan: TerminalWorkloadPlan,
  packet: ReturnType<typeof acceptedTerminalWorkloadFixturePacket>) => {
  expect(plan.kind).not.toBe('pending'); if (plan.kind === 'pending') throw new Error('required terminal workload plan missing');
  expect(plan).toMatchObject(f.reference); expect(plan.capturedAt).toBe('settlement_freeze'); expect(plan.participants).toHaveLength(10);
  expect(plan.participants.map(p => p.playerId)).toEqual(f.actors.map(a => a.binding.playerId));
  const assessmentHashes = [...packet.assessments.values()].map(source => {
    const actor = f.actors.find(a => a.binding.playerId === source.participantReference.playerId)!;
    return { sourceId: source.sourceId, hash: hash({ source, careerId: f.reference.careerId, gameId: f.reference.gameId,
      playId: f.reference.playId, playerId: actor.binding.playerId, actor, activity: expectedActivity(f, source) }) };
  }).sort((a, b) => a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0);
  expect(plan.assessmentHashes).toEqual(assessmentHashes);
  for (const [i, participant] of plan.participants.entries()) {
    const actor = f.actors[i], source = packet.assessments.get(participant.assessmentSourceId)!;
    expect(source).toBeDefined(); expect(participant.personId).toBe(actor.person.personId); expect(participant.clubId).toBe(actor.binding.clubId);
    expect(participant.activity).toEqual(expectedActivity(f, source));
    expect(participant.before).toMatchObject({ careerId: actor.binding.careerId, playerId: actor.binding.playerId });
    expect(participant.after).toEqual(advancePlayerWorkloadRecovery(participant.before, participant.before.revision, expectedActivity(f, source)));
  }
  return plan;
};

export const cleanupTerminalWorkload = (f: TerminalWorkloadFixture, store?: TerminalWorkloadStore) => {
  const errors: unknown[] = [];
  for (const close of [() => store?.close(), () => f.links.close(), () => f.db.close()]) {
    try { close(); } catch (error) { errors.push(error); }
  }
  if (errors.length) throw new AggregateError(errors, 'terminal workload test cleanup failed');
};

/** Observe actual SQLite connections, including exec-only DML and byte-neutral
 * UPDATEs. Install before the reopened handles are constructed and assert while
 * they are still open. This is test-only accounting, not a production seam. */
export const observeTerminalWorkloadConnectionChanges = () => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const prototype = DatabaseSync.prototype;
  const prepareDescriptor = Object.getOwnPropertyDescriptor(prototype, 'prepare');
  const execDescriptor = Object.getOwnPropertyDescriptor(prototype, 'exec');
  if (!prepareDescriptor || !execDescriptor || typeof prepareDescriptor.value !== 'function' || typeof execDescriptor.value !== 'function') {
    throw new Error('SQLite connection accounting descriptors missing');
  }
  const prepare = prepareDescriptor.value as Database['prepare'], exec = execDescriptor.value as Database['exec'];
  const counters = new Map<Database, unknown>();
  const count = (db: Database) => (Reflect.apply(prepare, db, ['SELECT total_changes() AS n']) as ReturnType<Database['prepare']>).get()!.n;
  const observe = (db: Database) => { if (!counters.has(db)) counters.set(db, count(db)); };
  const installedPrepare = { ...prepareDescriptor, value: function(this: Database, ...args: Parameters<Database['prepare']>) {
    observe(this); return Reflect.apply(prepare, this, args);
  } };
  const installedExec = { ...execDescriptor, value: function(this: Database, ...args: Parameters<Database['exec']>) {
    observe(this); return Reflect.apply(exec, this, args);
  } };
  Object.defineProperty(prototype, 'prepare', installedPrepare); Object.defineProperty(prototype, 'exec', installedExec);
  const same = (actual: PropertyDescriptor | undefined, expected: PropertyDescriptor) => actual !== undefined
    && (['configurable', 'enumerable', 'value', 'writable', 'get', 'set'] as const).every(key => actual[key] === expected[key]);
  return {
    checkpoint() { for (const db of counters.keys()) counters.set(db, count(db)); },
    assertChanges(expected: number) {
      expect(counters.size).toBeGreaterThan(0);
      let total = 0;
      for (const [db, before] of counters) {
        const delta = Number(count(db)) - Number(before);
        expect(delta).toBeGreaterThanOrEqual(0); total += delta;
      }
      expect(total).toBe(expected);
    },
    assertUnchanged() {
      expect(counters.size).toBeGreaterThan(0);
      for (const [db, before] of counters) expect(count(db)).toBe(before);
    },
    close() {
      const failures: string[] = [];
      if (same(Object.getOwnPropertyDescriptor(prototype, 'prepare'), installedPrepare)) Object.defineProperty(prototype, 'prepare', prepareDescriptor);
      else failures.push('prepare');
      if (same(Object.getOwnPropertyDescriptor(prototype, 'exec'), installedExec)) Object.defineProperty(prototype, 'exec', execDescriptor);
      else failures.push('exec');
      if (failures.length) throw new Error('later SQLite accounting interceptors preserved: ' + failures.join(', '));
    },
  };
};
