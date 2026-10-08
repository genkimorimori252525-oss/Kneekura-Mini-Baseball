import { createRequire } from 'node:module';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { deriveReceivedUmpireDefenderReplan, type ReceivedUmpireDefenderReplanInput } from '../../core/sim/fielding/ReceivedUmpireDefenderReplan';
import { actualReceivedUmpireDefenderReplanInputEvidenceFromSqlite, type AcceptedActualReceivedUmpireDefenderReplan } from './ActualReceivedUmpireDefenderReplanInput';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { receivedArtifactSha as sha, receivedStageInput, receivedFreshOutput, receivedStageCensus } from './ActualReceivedUmpireDefenderReplanGenuine.test-support';

const { DatabaseSync, constants } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type Expected = Readonly<{ source: AcceptedActualReceivedUmpireDefenderReplan; input: ReceivedUmpireDefenderReplanInput }>;
const selected = process.env.BASEBALL_RECEIVED_CALL_STAGE_INPUT && process.env.BASEBALL_RECEIVED_CALL_STAGE_OUTPUT;
const selectedStage: unknown = selected ? JSON.parse(readFileSync(process.env.BASEBALL_RECEIVED_CALL_STAGE_INPUT!, 'utf8')).consumerStage : undefined;

it.runIf(!!selected)(`qualifies genuine received-call ${String(selectedStage ?? 'unselected')} without mutating owner state`, () => {
  expect(['semantics', 'source-faults', 'corruption']).toContain(selectedStage);
  const previous = receivedStageInput('received'), output = receivedFreshOutput(); mkdirSync(output, { mode: 0o700 });
  const path = join(output, 'read-copy.sqlite'); copyFileSync(previous.input.database.path, path);
  const expected = previous.receipt.expected as { before: Expected; after: Expected };
  const db = new DatabaseSync(path, { readOnly: true });
  let qualifiedHash: string;
  try {
    const reader = actualReceivedUmpireDefenderReplanInputEvidenceFromSqlite(db);
    db.setAuthorizer(code => code === constants.SQLITE_DELETE ? constants.SQLITE_DENY : constants.SQLITE_OK);
    const census = receivedStageCensus(db); expect(hash(census)).toBe(previous.receipt.finalCensusHash);
    const changes = db.prepare('SELECT total_changes() AS n').get();
    // The expected Core inputs were assembled from independent genuine owner
    // outputs during the separately closed construction stage, not this reader.
    const after = reader.derive(expected.after.source);
    expect(after.input).toEqual(expected.after.input);
    expect(after.replan).toEqual(deriveReceivedUmpireDefenderReplan(expected.after.input));
    expect(after.replan).toMatchObject({ trigger: 'communication_received', semantic: 'call_profile_unavailable',
      selected: null, selectedAt: null, target: null, policyBinding: null, retainedCommand: expected.after.input.predecessor.command });
    expect(after.replan.work).toHaveLength(1); expect(after.replan.work[0].kind).toBe('decision');
    expect(after.input.predecessor.motor).toEqual(expected.after.input.predecessor.motor);
    expect(after.input.policy).toBeNull(); expect(after.input.previous).toBeNull();
    if (selectedStage === 'semantics') {
      const before = reader.derive(expected.before.source);
      expect(before.input).toEqual(expected.before.input);
      expect(before.replan).toEqual(deriveReceivedUmpireDefenderReplan(expected.before.input));
      expect(before.replan).toMatchObject({ trigger: 'no_new_trigger', selected: null, selectedAt: null, work: [] });
      expect(before.input.observation.perceived.communications).toEqual([]);
      expect(json(before.input.observation)).not.toContain('onFieldCall');
      // The received communication and observation heads are already later than
      // the scheduled request. Historical reads must retain the earlier payload cut.
      expect(reader.derive(expected.before.source)).toEqual(before);
      for (const queryOnly of [0, 1]) {
        db.exec('BEGIN'); db.exec('PRAGMA query_only='+queryOnly);
        expect(reader.derive(expected.after.source)).toEqual(after);
        expect(reader.derive(expected.before.source)).toEqual(before);
        expect(db.isTransaction).toBe(true); expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(queryOnly);
        expect(() => db.prepare('DELETE FROM main.actual_field_observations')).toThrow(/authorized/i);
        db.exec('ROLLBACK');
      }
    }
    if (selectedStage === 'source-faults') {
      const faults = [
        { name: 'foreign player', source: { ...expected.after.source, playerId: 'not-original-player' } },
        { name: 'foreign pitch', source: { ...expected.after.source, physicalPitchSourceId: 'not-original-pitch' } },
        { name: 'wrong adoption', source: { ...expected.after.source, predecessorAdoptionSourceId: expected.before.source.currentExecutionSourceId } },
        { name: 'unowned execution', source: { ...expected.after.source, currentExecutionSourceId: 'not-owned-execution' } },
        { name: 'future observation', source: { ...expected.after.source, currentExecutionSourceId: expected.before.source.currentExecutionSourceId } },
        { name: 'extra clock', source: { ...expected.after.source, currentCut: expected.after.input.currentCut } },
        { name: 'unsupported policy', source: { ...expected.after.source, policySourceId: 'not-owned-policy' } },
      ];
      for (const fault of faults) {
        expect(() => reader.derive(fault.source as AcceptedActualReceivedUmpireDefenderReplan), fault.name).toThrow();
        expect(db.isTransaction).toBe(false);
      }
      expect(reader.derive(expected.after.source)).toEqual(after);
    }
    expect(receivedStageCensus(db)).toEqual(census); expect(db.prepare('SELECT total_changes() AS n').get()).toEqual(changes);
    qualifiedHash = hash(after);
  } finally { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); }
  if (selectedStage === 'semantics') {
    const reopened = new DatabaseSync(path, { readOnly: true });
    try { expect(hash(actualReceivedUmpireDefenderReplanInputEvidenceFromSqlite(reopened).derive(expected.after.source))).toBe(qualifiedHash); }
    finally { reopened.close(); }
  }
  if (selectedStage === 'corruption') {
    // Faults live only on a separate copy. Removing owner snapshot validation or
    // replaying a later payload at the historical cut makes these checks fail.
    const faultPath = join(output, 'fault-copy.sqlite'); copyFileSync(path, faultPath);
    const faultDb = new DatabaseSync(faultPath);
    try {
      const reader = actualReceivedUmpireDefenderReplanInputEvidenceFromSqlite(faultDb);
      const census = receivedStageCensus(faultDb);
      const corruptions = [
        { table: 'actual_field_observations', sourceId: expected.after.source.observationSourceId,
          error: /corrupt actual observation snapshot/ },
        { table: 'actual_call_communications', sourceId: expected.after.input.communication.sourceId,
          error: /corrupt actual communication original snapshot/ },
      ] as const;
      for (const corruption of corruptions) {
        faultDb.exec('BEGIN');
        expect(faultDb.prepare(`UPDATE main.${corruption.table} SET snapshot_hash=? WHERE source_id=?`)
          .run('received-bridge-isolated-corruption', corruption.sourceId).changes).toBe(1);
        const corruptedCensus = receivedStageCensus(faultDb);
        const changes = faultDb.prepare('SELECT total_changes() AS n').get();
        expect(() => reader.derive(expected.after.source)).toThrow(corruption.error);
        expect(faultDb.isTransaction).toBe(true);
        // The later owner metadata remains valid while its payload hash is bad.
        // A historical scheduled read must neither consume nor bless that payload.
        expect(reader.derive(expected.before.source).input).toEqual(expected.before.input);
        expect(receivedStageCensus(faultDb)).toEqual(corruptedCensus);
        expect(faultDb.prepare('SELECT total_changes() AS n').get()).toEqual(changes);
        expect(faultDb.isTransaction).toBe(true); faultDb.exec('ROLLBACK');
        expect(receivedStageCensus(faultDb)).toEqual(census);
        expect(hash(reader.derive(expected.after.source))).toBe(qualifiedHash);
        expect(faultDb.isTransaction).toBe(false);
      }
    } finally { if (faultDb.isTransaction) faultDb.exec('ROLLBACK'); faultDb.close(); }
  }
  expect(sha(readFileSync(path))).toBe(previous.input.database.sha256);
  expect(sha(readFileSync(previous.input.database.path))).toBe(previous.input.database.sha256);
  writeFileSync(join(output, 'bridge.json'), JSON.stringify({ schema: 'received_call_native_bridge_qualification_v1',
    inputDatabaseSha256: previous.input.database.sha256, extensionReceiptSha256: previous.input.receipt.sha256,
    consumerStage: selectedStage, bridgeEvidenceHash: qualifiedHash, pendingSemantic: 'call_profile_unavailable', committedSelection: false,
    newMotorOrAdoption: false, settlementCredit: 0, recoveredPR350Credit: 0 }, null, 2)+'\n', { flag: 'wx', mode: 0o600 });
}, 300_000);
