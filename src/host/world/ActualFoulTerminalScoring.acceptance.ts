import { createRequire } from 'node:module';
import type { DatabaseSync as Database } from 'node:sqlite';
import { setImmediate as yieldForReporter } from 'node:timers/promises';
import { expect, it } from 'vitest';
import { openSqliteOfficialScoringStore, type PersistOfficialScoringInput } from '../SqliteOfficialScoringStore';
import { officialStateSerialized as json } from '../OfficialStateEncoding';
import { rawCensus, schemaCensus, fileHash } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
import { assertPriorPhysicalClosureCompleted } from './PhysicalPlayClosureEvidenceFromSqlite';
import { readActualLivePhysicalActivation } from './ActualLivePhysicalActivation';
import { prepareTerminalScoringCopy, requireTerminalScoring, scoringRows, scoringTable,
  type TerminalScoringStore } from './ActualFoulTerminalScoringFixture.test-support';

it('S01 genuine acknowledged terminal scores the assigned call once while post-play remains blocked', async () => {
  const f = prepareTerminalScoringCopy();
  let observer: Database | undefined = f.db, scorer: TerminalScoringStore | undefined;
  try {
    // No adapter import/assertion occurs until current genuine P/C/E/journal,
    // acknowledgement/application/Match and assigned-call prerequisites pass.
    const open = await requireTerminalScoring();
    await yieldForReporter();
    const before = rawCensus(observer), beforeSchema = schemaCensus(observer), beforeScoring = scoringRows(observer);
    let writer: Database | undefined;
    const witness = witnessSqliteWrite(/INSERT INTO (?:main\.)?official_scoring_applications\b/, connection => {
      writer = connection;
      return connection.isTransaction && connection.prepare('SELECT result_json FROM main.official_scoring_applications WHERE scoring_application_id=?')
        .get(f.expected.scoringApplicationId)?.result_json === json(f.expected);
    });
    let result;
    try {
      // Observe INSERT even when the shared writer prepares it at open time.
      scorer = open(f.path);
      expect(rawCensus(observer)).toEqual(before); expect(schemaCensus(observer)).toEqual(beforeSchema);
      expect(scorer.read(f.sourceId)).toBeNull();
      result = scorer.apply(f.sourceId); expect(witness.wasReached()).toBe(true);
    }
    finally { witness.close(); }
    expect(result).toEqual(f.expected);
    expect(Object.isFrozen(result)).toBe(true); expect(Object.isFrozen(result.record)).toBe(true);
    expect(result.record.basisRulingId).toBe(f.callId);
    expect(result.record.basisRulingId).not.toBe(f.saved.proposal.scoring.basisRulingId);
    expect(writer!.isTransaction).toBe(false);
    expect(writer!.prepare('SELECT total_changes() AS n').get()!.n).toBe(1);
    const inserted = { __ack_rowid: Math.max(0, ...beforeScoring.map(row => Number(row.__ack_rowid))) + 1,
      scoring_application_id: result.scoringApplicationId, match_id: result.matchId,
      official_application_id: result.officialApplicationId, closure_id: result.closureId,
      source_event_id: result.sourceEventId,
      request_json: json({ input: { scoringApplicationId: result.scoringApplicationId, officialApplication: f.request }, evidence: null }),
      result_json: json(result) };
    const after = before.map(owner => owner.table === scoringTable ? { ...owner, rows: [...beforeScoring, inserted] } : owner);
    expect(rawCensus(observer)).toEqual(after); expect(schemaCensus(observer)).toEqual(beforeSchema);
    expect(scorer.read(f.sourceId)).toEqual(result); expect(scorer.apply(f.sourceId)).toEqual(result);
    expect(writer!.prepare('SELECT total_changes() AS n').get()!.n).toBe(1);
    expect(rawCensus(observer)).toEqual(after); expect(schemaCensus(observer)).toEqual(beforeSchema);
    const legacy = openSqliteOfficialScoringStore(f.path);
    try {
      const forbidden = { scoringApplicationId: result.scoringApplicationId,
        officialApplication: f.request } as unknown as PersistOfficialScoringInput;
      expect(() => legacy.apply(forbidden)).toThrow(/terminal pending/);
      expect(() => legacy.readApplication(result.scoringApplicationId)).toThrow(/terminal pending/);
      expect(() => legacy.readAcceptedPlay(result.scoringApplicationId)).toThrow(/terminal pending/);
    } finally { legacy.close(); }
    withSqliteReadTransaction(observer, () => {
      expect(() => assertPriorPhysicalClosureCompleted(observer!, f.saved.source.applicationId)).toThrow(/terminal|pending/);
      expect(() => readActualLivePhysicalActivation(observer!, f.saved.proposal.gameId, f.saved.source.applicationId)).toThrow(/terminal|pending/);
    });
    expect(rawCensus(observer)).toEqual(after); expect(schemaCensus(observer)).toEqual(beforeSchema);
    scorer.close(); scorer = undefined; observer.close(); observer = undefined;
    expect(() => writer!.prepare('SELECT 1')).toThrow();
    await yieldForReporter();
    scorer = open(f.path); expect(scorer.read(f.sourceId)).toEqual(result); expect(scorer.apply(f.sourceId)).toEqual(result);
    scorer.close(); scorer = undefined;
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
    observer = new DatabaseSync(f.path);
    expect(rawCensus(observer)).toEqual(after); expect(schemaCensus(observer)).toEqual(beforeSchema);
    expect(fileHash(f.retainedPath)).toBe(f.retainedSha256);
  } finally { scorer?.close(); observer?.close(); }
}, 2_400_000);
