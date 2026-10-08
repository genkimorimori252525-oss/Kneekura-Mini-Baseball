import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { setImmediate as yieldForReporter } from 'node:timers/promises';
import type { DatabaseSync as Database } from 'node:sqlite';
import { expect,it } from 'vitest';
import { SqliteOfficialStateStore as FrozenV2Store } from '../SqliteOfficialStateV2.test-support';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { openSqliteActualFoulTerminalApplicationStore } from './SqliteActualFoulTerminalApplicationStore';
import { actorHash as hash,actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { actualFoulClosedEvidenceFromSqlite } from './SqliteActualFoulPlayEndStore';
import { actualFoulRuleConsumptionEvidenceFromSqlite } from './SqliteActualFoulRuleConsumptionStore';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
import { assertPriorPhysicalClosureCompleted } from './PhysicalPlayClosureEvidenceFromSqlite';
import { readActualLivePhysicalActivation } from './ActualLivePhysicalActivation';
import { closePendingAndPrepareAcknowledgementCopy,prepareLegacyPendingCopy,rawCensus,schemaCensus,
  terminalRows,fileHash } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { expectedAcknowledgement,type AcknowledgementRunner,type Acknowledged,type Applied }
  from './ActualFoulTerminalAcknowledgementWire.test-support';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const sourceId = 'terminal-application';
export const openAcknowledgementRunner = async (): Promise<(path:string) => AcknowledgementRunner> => {
  const moduleId = './SqliteActualFoulTerminalApplicationRunner';
  if (!existsSync(new URL(moduleId + '.ts',import.meta.url))) throw new Error('QUALIFIED_PENDING_RUNNER_PREREQUISITE_MISSING');
  const module = await import(/* @vite-ignore */ moduleId);
  expect(typeof module.openSqliteActualFoulTerminalApplicationRunner).toBe('function');
  return module.openSqliteActualFoulTerminalApplicationRunner;
};

it('A01 genuine terminal official child acknowledges once while post-play and next-pitch remain blocked', async () => {
  const prepared = prepareLegacyPendingCopy(), open = await openAcknowledgementRunner();
  expect(() => new FrozenV2Store(prepared.path)).toThrow('unsupported official state store schema version');
  let observer:Database | undefined,runner:AcknowledgementRunner | undefined;
  try {
    observer = new DatabaseSync(prepared.path); runner = open(prepared.path);
    const queued = runner.read(sourceId);
    expect(queued?.status).toBe('QUEUED');
    if (!queued || queued.status !== 'QUEUED') throw new Error('GENUINE_QUEUED_TERMINAL_PREREQUISITE_MISSING');
    // Independently read E/C through their real owners before applying. These
    // assertions are prerequisites, not substitutes for the new behavior RED.
    const original = withSqliteReadTransaction(observer,() => {
      const end = actualFoulClosedEvidenceFromSqlite(observer!).read(queued.proposal.physicalEndReference.sourceId);
      const count = actualFoulRuleConsumptionEvidenceFromSqlite(observer!).read(queued.proposal.consumptionReference.sourceId);
      expect(end).not.toBeNull(); expect(count).not.toBeNull();
      return { end:end!,count:count! };
    });
    expect(original.end.dispositionObligations.official).toEqual(queued.proposal.officialObligation);
    expect(original.end.dispositionObligations.official).toMatchObject({ status:'pending',consumer:null,
      pendingReason:'terminal_official_closure_unowned' });
    expect(original.count.successor.successorKey).toBe(queued.proposal.originalSuccessorKey);
    expect(original.count.disposition.kind).toBe('terminal_strikeout');
    const originalsBefore = rawCensus(observer,['matches','applications','actual_foul_terminal_applications']);
    let pendingWriter:Database | undefined;
    const pendingWitness = witnessSqliteWrite(/UPDATE main\.actual_foul_terminal_applications\b/,connection => {
      pendingWriter = connection;
      return connection.isTransaction && connection.prepare('SELECT status FROM main.actual_foul_terminal_applications WHERE source_id=?')
        .get(sourceId)!.status === 'OFFICIAL_APPLIED_PENDING_POST_PLAY';
    });
    let applied:Applied;
    try {
      const result = runner.apply(sourceId);
      expect(result.status).toBe('OFFICIAL_APPLIED_PENDING_POST_PLAY');
      if (result.status !== 'OFFICIAL_APPLIED_PENDING_POST_PLAY') throw new Error('GENUINE_PENDING_APPLICATION_PREREQUISITE_MISSING');
      applied = result; expect(pendingWitness.wasReached()).toBe(true);
    } finally { pendingWitness.close(); }
    expect(pendingWriter!.isTransaction).toBe(false);
    expect(applied.result.acknowledgement).toBeNull();
    const p = applied.proposal,o = applied.result.official;
    const origin = { owner:'actual_foul_terminal_applications',sourceId,sourceVersion:p.source.sourceVersion,
      sourceHash:hash(p.source),snapshotHash:hash(p) };
    const receipt = { applicationId:p.source.applicationId,closureId:sourceId,previousPlayId:p.playId,
      durableRevision:p.originalOfficialRevision + 1,appliedMatchState:p.nextMatch };
    const expectedOfficial = { receipt,pendingPostPlay:{ version:'official_pending_post_play_v1',matchId:p.gameId,
      applicationId:receipt.applicationId,closureId:receipt.closureId,previousPlayId:receipt.previousPlayId,
      durableRevision:receipt.durableRevision,origin,requestHash:hash({ ...p.applicationBody,origin }),
      gameProgression:p.projectedGameProgression } };
    expect(o).toEqual(expectedOfficial);
    expect(rawCensus(observer,['matches','applications','actual_foul_terminal_applications'])).toEqual(originalsBefore);
    expect(observer.prepare('SELECT result_json FROM main.applications WHERE application_id=?').get(p.source.applicationId)!.result_json).toBe(json(o));
    expect(observer.prepare('SELECT activation_json FROM main.matches WHERE match_id=?').get(p.gameId)!.activation_json)
      .toBe(json({ pendingPostPlay:o.pendingPostPlay }));
    expect(terminalRows(observer).find(row => row.source_id === sourceId)!.result_json).toBe(json(applied.result));
    // The authentic pending owner and its original/mirror prerequisites passed.
    // Frozen production has no method: THIS assertion is the intended RED.
    expect(typeof runner.acknowledge,'GENUINE_PENDING_TERMINAL_ACKNOWLEDGE_API_MISSING').toBe('function');
    await yieldForReporter();

    // Schema capability itself is not authority to migrate the current file.
    // Close exact observed handles, record applied-stage lineage, then extend
    // CHECK only on a second exclusive private copy for the actual operation.
    const owned = { ...prepared,applied,runner,observer,writerConnection:pendingWriter! };
    runner = undefined; observer = undefined;
    const path = closePendingAndPrepareAcknowledgementCopy(owned);
    observer = new DatabaseSync(path); runner = open(path);
    const before = rawCensus(observer),beforeSchema = schemaCensus(observer),beforeTerminal = terminalRows(observer);
    const expected = expectedAcknowledgement(applied);
    expect(expected.obligationKey).toBe(original.end.dispositionObligations.official.obligationKey);
    expect(expected.scope).toEqual(original.end.dispositionObligations.official.scope);
    expect(expected.originalSuccessorKey).toBe(original.count.successor.successorKey);
    let ackWriter:Database | undefined;
    const witness = witnessSqliteWrite(/UPDATE main\.actual_foul_terminal_applications\b/,connection => {
      ackWriter = connection;
      return connection.isTransaction && connection.prepare('SELECT status FROM main.actual_foul_terminal_applications WHERE source_id=?')
        .get(sourceId)!.status === 'OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY';
    });
    let acknowledged:Acknowledged;
    try { acknowledged = runner.acknowledge!(sourceId); expect(witness.wasReached()).toBe(true); }
    finally { witness.close(); }
    expect(ackWriter!.isTransaction).toBe(false);
    expect(ackWriter!.prepare('SELECT total_changes() AS n').get()!.n).toBe(1);
    expect(acknowledged).toEqual({ ...applied,status:'OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY',
      result:{ ...applied.result,acknowledgement:expected } });
    expect(Object.isFrozen(acknowledged.result.acknowledgement)).toBe(true);
    expect(Object.isFrozen(acknowledged.result.acknowledgement.applicationReference)).toBe(true);
    const expectedRows = beforeTerminal.map(row => row.source_id === sourceId ? { ...row,
      status:'OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY',result_json:json(acknowledged.result) } : row);
    const after = before.map(owner => owner.table === 'actual_foul_terminal_applications' ? { ...owner,rows:expectedRows } : owner);
    expect(rawCensus(observer)).toEqual(after); expect(schemaCensus(observer)).toEqual(beforeSchema);
    expect(runner.read(sourceId)).toEqual(acknowledged);
    expect(runner.apply(sourceId)).toEqual(acknowledged); expect(runner.acknowledge!(sourceId)).toEqual(acknowledged);
    expect(ackWriter!.prepare('SELECT total_changes() AS n').get()!.n).toBe(1);
    const queue = openSqliteActualFoulTerminalApplicationStore(path);
    try { expect(queue.enqueue(sourceId)).toEqual(acknowledged); } finally { queue.close(); }
    expect(rawCensus(observer)).toEqual(after); expect(schemaCensus(observer)).toEqual(beforeSchema);
    withSqliteReadTransaction(observer,() => {
      expect(actualFoulClosedEvidenceFromSqlite(observer!).read(p.physicalEndReference.sourceId)).toEqual(original.end);
      expect(() => assertPriorPhysicalClosureCompleted(observer!,p.source.applicationId)).toThrow(/terminal|pending/);
      expect(() => readActualLivePhysicalActivation(observer!,p.gameId,p.source.applicationId)).toThrow(/terminal|pending/);
    });
    const official = new SqliteOfficialStateStore(path);
    try { expect(official.getMatch(p.gameId)).toEqual({ durableRevision:receipt.durableRevision,matchState:p.nextMatch,
      activation:null,nextWorld:null,finalResult:null,pendingPostPlay:o.pendingPostPlay }); }
    finally { official.close(); }
    runner.close(); runner = undefined; observer.close(); observer = undefined;
    await yieldForReporter();
    runner = open(path); expect(runner.read(sourceId)).toEqual(acknowledged);
    runner.close(); runner = undefined; observer = new DatabaseSync(path);
    expect(rawCensus(observer)).toEqual(after); expect(schemaCensus(observer)).toEqual(beforeSchema);
    expect(fileHash(prepared.producer.sourcePath)).toBe(prepared.producer.sourceSha256);
  } finally { runner?.close(); observer?.close(); }
},2_400_000);
