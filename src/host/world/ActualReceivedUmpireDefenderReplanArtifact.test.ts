import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { expect, it } from 'vitest';
import { actualLiveRuntimeEvidenceFromSqlite } from './SqliteActualLivePlayRuntimeStore';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite, withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { actualDefensiveDecisionEvidenceFromSqlite } from './SqliteActualDefensiveDecisionStore';
import { actualFieldObservationEvidenceFromSqlite } from './SqliteActualFieldObservationStore';
import { actualLocomotionEvidenceFromSqlite } from './SqliteActualLocomotionStore';
import { actualPlayersKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { ownedScheduledMotionArchiveHash } from './OwnedScheduledMotionArchive';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const sha = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
// Same byte-level row convention as the published fixture manifest.
const fingerprints = (db: InstanceType<typeof DatabaseSync>) => db.prepare(
  "SELECT name FROM main.sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => {
    const name = String(row.name), quoted = '"'+name.replaceAll('"', '""')+'"', rows: string[] = [];
    for (const value of db.prepare(`SELECT * FROM main.${quoted}`).iterate()) rows.push(sha(JSON.stringify(value)));
    return { name, count: rows.length, logicalRowsHash: sha(JSON.stringify(rows.sort())) };
  });
const originalHash = '691c1640471fd268eea26c61f65699b7ca1c94566f4baa70344d86e0687ab810';
const output = process.env.BASEBALL_RECEIVED_CALL_ORIGINAL_OUTPUT;

// Explicitly selected prospective prerequisite. This does not recover PR350,
// construct a new root, add reception, or qualify the read-only bridge itself.
it.runIf(!!output)('authenticates the published original incumbent and unchanged coverage before any received-call extension', () => {
  if (!output || !isAbsolute(output) || existsSync(output)) throw new Error('fresh absolute original-artifact output required');
  const fixture = 'docs/verification/fixtures/first-base-original-chain-bf823';
  const manifest = JSON.parse(readFileSync(fixture+'.manifest.json', 'utf8'));
  expect(manifest.sourceCommit).toBe('bf8233fa4ce4c7a7a66be62aa757ef93642e9c29');
  expect(manifest.sourceTree).toBe('61eebeac549bac6237fd4b0f24718deae92a654b');
  expect(manifest.databaseSha256).toBe(originalHash);
  const gzip = Buffer.from(readFileSync(fixture+'.sqlite.gz.b64', 'utf8'), 'base64');
  expect(gzip.length).toBe(139805);
  expect(sha(gzip)).toBe('712313f01f85af1196a93dbdd1d65b92aca3af908f93b42f57e637b8011935d8');
  const bytes = gunzipSync(gzip); expect(bytes.length).toBe(2699264); expect(sha(bytes)).toBe(originalHash);
  mkdirSync(output, { recursive: false, mode: 0o700 });
  expect(realpathSync(output)).toBe(output);
  const path = join(output, 'original.sqlite'); writeFileSync(path, bytes, { flag: 'wx', mode: 0o600 });
  const db = new DatabaseSync(path, { readOnly: true });
  let receipt: unknown;
  try {
    expect(db.prepare('PRAGMA database_list').all().filter(r => r.name === 'main').map(r => r.file)).toEqual([path]);
    expect(db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
    db.exec('BEGIN');
    const schema = db.prepare('SELECT * FROM main.sqlite_master ORDER BY name').all();
    const changes = db.prepare('SELECT total_changes() AS n').get();
    const originalTables = fingerprints(db);
    expect(originalTables).toEqual(manifest.tables); expect(originalTables).toHaveLength(63);
    expect(originalTables.reduce((n, table) => n + table.count, 0)).toBe(113);
    receipt = withBattedWorldPhysicalReadTraversal(db, () => {
      const runtimeOwner = actualLiveRuntimeEvidenceFromSqlite(db), runtime = runtimeOwner.read('live-play-runtime');
      const owner = battedWorldFieldExecutionEvidenceFromSqlite(db), race = owner.read('field-first-base-race');
      if (!runtime || !race || race.execution.kind !== 'first_base_race') throw new Error('original runtime or race missing');
      expect(runtime.membership.participants).toHaveLength(10);
      expect(runtime.membership.producers).toHaveLength(70);
      const fieldOwner = battedWorldFieldEvidenceFromSqlite(db), baseField = race.baseField;
      const prefix = { baseField, fields: fieldOwner.scope(baseField, baseField.source.sourceId), executions: owner.scope(baseField) };
      expect(prefix.executions.at(-1)?.source.sourceId).toBe(race.source.sourceId);
      const decisionIds = db.prepare('SELECT source_id FROM main.actual_defensive_decisions').all();
      const motorIds = db.prepare('SELECT source_id FROM main.actual_locomotion_receipts').all();
      expect(decisionIds).toHaveLength(1); expect(motorIds).toHaveLength(1);
      const decision = actualDefensiveDecisionEvidenceFromSqlite(db).read(String(decisionIds[0].source_id));
      const motor = actualLocomotionEvidenceFromSqlite(db).read(String(motorIds[0].source_id));
      if (!decision || !motor) throw new Error('original incumbent owner missing');
      expect(decision.receipt.lifecycle.status).toBe('issued');
      expect(motor.source.decisionSourceId).toBe(decision.source.sourceId); expect(motor.decisionHash).toBe(hash(decision));
      const observation = actualFieldObservationEvidenceFromSqlite(db).read(decision.receipt.originObservationSourceId);
      if (!observation) throw new Error('original information owner missing');
      expect(motor.originObservationHash).toBe(hash(observation)); expect(observation.receipt.perceived.communications).toEqual([]);
      const admissions = runtimeOwner.admissions(runtime); expect(admissions).toHaveLength(14);
      for (const [owner, sourceId] of [['actual_field_observations', observation.source.sourceId],
        ['actual_defensive_decisions', decision.source.sourceId], ['actual_locomotion_receipts', motor.source.sourceId],
        ['batted_world_field_executions', race.source.sourceId]]) {
        expect(admissions.some(a => a.owner === owner && a.sourceId === sourceId)).toBe(true);
      }
      const ids = runtime.membership.participants.map(p => p.playerId), selves = actualPlayersKinematicsFromPrefix(ids, prefix);
      expect(new Set(ids).size).toBe(10); expect(selves.flatMap(s => s.roles)).toHaveLength(50);
      const self = selves.find(s => s.playerId === motor.source.playerId);
      const adoption = prefix.executions.find(v => v.source.sourceId === 'field-race-real-motor');
      if (!self || !adoption || adoption.execution.kind !== 'owned_motion_v2') throw new Error('original physical adoption missing');
      const contributor = adoption.execution.composition.contributors.find(c => c.playerId === self.playerId);
      expect(contributor).toMatchObject({ kind: 'motor', motorSourceId: motor.source.sourceId, motorHash: hash(motor) });
      expect(self.activeCommand).toMatchObject({ kind: 'owned_motion_v2', sourceId: adoption.source.sourceId,
        sourceHash: hash(adoption.source), adoptionSourceId: adoption.source.sourceId,
        adoptionSourceHash: hash(adoption.source), adoptedAt: adoption.execution.adoption.adoptedAt, executedThrough: self.at });
      expect(self.ownedMotionCoverage?.rootAuthority).toMatchObject({ owner: 'actual_locomotion_receipts', sourceId: motor.source.sourceId });
      expect(json(self.ownedMotionCoverage?.roleAuthorities)).toBe(json(contributor!.roleAuthorities));
      const frame = baseField.response.touch.worldContact.flight.physicalPitch.frame;
      for (const player of selves) {
        const binding = [frame.batterActor!.binding, ...frame.batterActor!.defenderBindings].find(b => b.playerId === player.playerId)!;
        expect(player).toMatchObject({ gameId: binding.gameId, gameDay: binding.gameDay, personId: binding.personId,
          personLinkSourceId: binding.personLinkSourceId, physicalPitchSourceId: runtime.source.physicalPitchSourceId, at: self.at });
      }
      const coverage = Math.min(...selves.flatMap(s => [s.activeCommand.acceptedThroughTick,
        s.ownedMotionCoverage?.rootAuthority.acceptedThroughTick ?? Infinity,
        ...s.roles.map(r => r.canonicalActor.primitive.endTick),
        ...(s.ownedMotionCoverage?.roleAuthorities.map(r => r.acceptedThroughTick) ?? [])]));
      // A fixed ten-tick prerequisite budget covers the existing two-tick call
      // and at-most-seven-tick communication recipe; never enlarge authority.
      expect(coverage).toBeGreaterThan(self.at.tick + 10);
      expect(race.execution.groundRule?.correctRuleResult).toMatchObject({ kind: 'resolved', batterRunnerFirstBase: { kind: 'out' } });
      for (const table of ['actual_first_base_umpire_calls', 'actual_call_communications', 'actual_first_base_play_ends', 'actual_live_play_fences']) {
        const present = db.prepare("SELECT 1 FROM main.sqlite_master WHERE type='table' AND name=?").get(table);
        if (present) expect(db.prepare(`SELECT count(*) AS n FROM main.${table}`).get()!.n).toBe(0);
      }
      return { schema: 'received_call_original_artifact_authentication_v1', originalDatabaseSha256: originalHash,
        sourceHistoricalCredit: 0, recoveredPR350Credit: 0, bridgeCredit: 0,
        identities: { physicalPitch: runtime.source.physicalPitchSourceId, baseField: baseField.source.sourceId,
          execution: race.source.sourceId, player: self.playerId, observation: observation.source.sourceId,
          decision: decision.source.sourceId, motor: motor.source.sourceId, adoption: adoption.source.sourceId },
        hashes: { runtime: hash(runtime), admissions: hash(admissions), originalTables: hash(originalTables),
          race: ownedScheduledMotionArchiveHash(race), observation: hash(observation),
          decision: hash(decision), motor: hash(motor), adoption: ownedScheduledMotionArchiveHash(adoption), self: hash(self) },
        at: self.at, ticksPerSecond: self.ticksPerSecond, minimumActualCoverageThroughTick: coverage,
        playerCount: selves.length, roleCount: selves.flatMap(s => s.roles).length };
    });
    expect(fingerprints(db)).toEqual(originalTables);
    expect(db.prepare('SELECT * FROM main.sqlite_master ORDER BY name').all()).toEqual(schema);
    expect(db.prepare('SELECT total_changes() AS n').get()).toEqual(changes); expect(db.isTransaction).toBe(true); db.exec('COMMIT');
  } finally { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); }
  expect(sha(readFileSync(path))).toBe(originalHash);
  writeFileSync(join(output, 'authentication.json'), JSON.stringify(receipt, null, 2)+'\n', { flag: 'wx', mode: 0o600 });
}, 300_000);
