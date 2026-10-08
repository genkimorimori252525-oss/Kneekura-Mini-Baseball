import { createRequire } from 'node:module';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync as Database } from 'node:sqlite';
import { expect } from 'vitest';
import { classifyClosedPlayForOfficialScoring } from '../../core/adjudication/OfficialScoring';
import { getOfficialPlayClosure } from '../../core/adjudication/PlayAdjudicationLedger';
import type { PersistedOfficialScoring } from '../SqliteOfficialScoringStore';
import { officialStateSerialized as json, officialStateHash as hash } from '../OfficialStateEncoding';
import { foulTerminalApplicationEvidenceFromSqlite, foulTerminalPendingInput }
  from './ActualFoulTerminalApplicationEvidenceFromSqlite';
import { rawCensus, schemaCensus, fileHash } from './ActualFoulTerminalAcknowledgementCutover.test-support';
// This copy-only helper must arrive in the coordinator's final acknowledgement
// qualification commit before compiler/runtime admission. Never import the
// acknowledgement acceptance test or regenerate its producer as a fallback.
import { prepareRetainedTerminalAcknowledgementCopy } from './ActualFoulTerminalAcknowledgementRetained.test-support';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';

export type TerminalScoringStore = Readonly<{
  apply(sourceId: string): PersistedOfficialScoring;
  read(sourceId: string): PersistedOfficialScoring | null;
  close(): void;
}>;
export type OpenTerminalScoring = (path: string) => TerminalScoringStore;
export const scoringTable = 'official_scoring_applications';
/** Frozen legacy canonical schema, independent of future production exports. */
const scoringSql = `CREATE TABLE IF NOT EXISTS official_scoring_applications (
    scoring_application_id TEXT PRIMARY KEY,
    match_id TEXT NOT NULL,
    official_application_id TEXT NOT NULL REFERENCES applications(application_id),
    closure_id TEXT NOT NULL,
    source_event_id TEXT NOT NULL UNIQUE,
    request_json TEXT NOT NULL,
    result_json TEXT NOT NULL,
    UNIQUE(match_id, closure_id)
  )`;
const compact = (sql: string) => sql.replace(/'(?:[^']|'')*'|"(?:[^"]|"")*"|\s+/g,
  token => token[0] === "'" || token[0] === '"' ? token : '')
  .replace(/^CREATETABLE(?:IFNOTEXISTS)?(?:main\.)?/i, '');
export const scoringRows = (db: Database) => db.prepare(
  'SELECT rowid AS __ack_rowid,* FROM main.official_scoring_applications ORDER BY rowid').all();

/** Setup is allowed only on the new exclusive copy returned by the fully pinned
 * lineage helper. It never opens the original retained database or applies/acks
 * a terminal source. The production scoring opener has no schema setup right. */
export const prepareTerminalScoringCopy = () => {
  const retained = prepareRetainedTerminalAcknowledgementCopy('acknowledged');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(retained.path);
  try {
    const saved = withSqliteReadTransaction(db, () => foulTerminalApplicationEvidenceFromSqlite(db).read(retained.sourceId));
    expect(saved?.status).toBe('OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY');
    if (!saved || saved.status !== 'OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY') {
      throw new Error('GENUINE_ACKNOWLEDGED_TERMINAL_PREREQUISITE_MISSING');
    }
    const p = saved.proposal, official = saved.result.official;
    const request = foulTerminalPendingInput(p);
    expect(hash(request)).toBe(official.pendingPostPlay.requestHash);
    expect(db.prepare('SELECT request_hash,result_json FROM main.applications WHERE application_id=?')
      .get(p.source.applicationId)).toEqual({ request_hash: hash(request), result_json: json(official) });
    expect(db.prepare('SELECT durable_revision,state_json,activation_json FROM main.matches WHERE match_id=?').get(p.gameId))
      .toEqual({ durable_revision: official.receipt.durableRevision, state_json: json(p.nextMatch),
        activation_json: json({ pendingPostPlay: official.pendingPostPlay }) });
    const calls = p.originalOfficialLedger.events.filter(event => event.kind === 'OnFieldCallRecorded');
    expect(calls).toHaveLength(1);
    const call = calls[0];
    if (call.kind !== 'OnFieldCallRecorded') throw new Error('GENUINE_ASSIGNED_CALL_PREREQUISITE_MISSING');
    expect(call.call.callId).toBe(p.callSource.sourceId);
    expect(call.eventId).toBe(p.callSource.sourceId + ':call');
    const closure = getOfficialPlayClosure(request.adjudication);
    expect(closure?.finalRuling).toMatchObject({ source: 'on_field_call',
      rulingId: call.call.callId, basisCallId: call.call.callId });
    const classified = classifyClosedPlayForOfficialScoring({ kind: 'non_live', match: request.match,
      timeline: request.timeline, adjudication: request.adjudication, context: request.context });
    expect(classified.kind).toBe('supported');
    if (classified.kind !== 'supported') throw new Error('GENUINE_TERMINAL_CLASSIFICATION_PREREQUISITE_MISSING');
    expect(classified.record).toMatchObject({ classification: 'strikeout', basisRulingId: call.call.callId,
      hitsCredited: 0, errorsCharged: 0 });
    expect(classified.record.basisRulingId).not.toBe(call.eventId);
    expect(classified.record.basisRulingId).not.toBe(p.scoring.basisRulingId);
    const pitchRow = db.prepare('SELECT snapshot_json FROM main.physical_pitch_progress_actions WHERE source_id=?')
      .get(p.physicalPitchSourceId)!;
    const pitch = JSON.parse(String(pitchRow.snapshot_json));
    expect(pitch.result.pitch.resolution.timeline.status.kind).toBe('batted_ball_pending');
    // The existing archive codec canonicalizes signed zero. Compare durable
    // wire bytes, not Object.is(-0, 0); no physics/serialization repair occurs.
    expect(json(pitch.result.pitch.resolution.timeline)).toBe(json(p.originalPhysicalTimeline));
    expect(json(request.timeline.events.slice(0, -1))).toBe(json(p.originalPhysicalTimeline.events));

    const beforeSchema = schemaCensus(db), beforeRows = rawCensus(db);
    const installed = db.prepare('SELECT type,sql FROM main.sqlite_master WHERE name=?').all(scoringTable);
    if (installed.length === 0) {
      db.exec('BEGIN IMMEDIATE');
      try { db.exec(scoringSql); db.exec('COMMIT'); }
      catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
      expect(rawCensus(db, [scoringTable])).toEqual(beforeRows);
      const afterSchema = schemaCensus(db);
      expect(afterSchema.main.filter(row => row.tbl_name !== scoringTable)).toEqual(beforeSchema.main);
      expect(afterSchema.temp).toEqual(beforeSchema.temp);
      expect(afterSchema.mainVersion).toBe(Number(beforeSchema.mainVersion) + 1);
      expect(afterSchema.tempVersion).toBe(beforeSchema.tempVersion);
      expect(afterSchema.userVersion).toBe(beforeSchema.userVersion);
    } else {
      expect(installed).toHaveLength(1); expect(installed[0].type).toBe('table');
      expect(compact(String(installed[0].sql))).toBe(compact(scoringSql));
      expect(rawCensus(db)).toEqual(beforeRows); expect(schemaCensus(db)).toEqual(beforeSchema);
    }
    expect(db.prepare('SELECT name FROM temp.sqlite_master WHERE name=?').all(scoringTable)).toEqual([]);
    const scoringApplicationId = JSON.stringify(['actual_foul_terminal_scoring_v1', retained.sourceId]);
    const expected: PersistedOfficialScoring = { scoringApplicationId, matchId: p.gameId,
      officialApplicationId: p.source.applicationId, closureId: p.source.sourceId,
      sourceEventId: 'official-non-live:' + p.source.applicationId, record: classified.record };
    expect(db.prepare('SELECT * FROM main.official_scoring_applications WHERE scoring_application_id=? OR official_application_id=? OR closure_id=?')
      .all(scoringApplicationId, p.source.applicationId, p.source.sourceId)).toEqual([]);
    writeFileSync(join(retained.directory, 'scoring-layout-receipt.json'), JSON.stringify({
      version: 'terminal_scoring_private_layout_v1', retainedPath: retained.retainedPath,
      retainedSha256: retained.retainedSha256, destinationPath: retained.path,
      beforeSchema, afterSchema: schemaCensus(db), originalRowsHash: hash(beforeRows),
      scoringTableCreated: installed.length === 0,
    }, null, 2), { flag: 'wx' });
    expect(fileHash(retained.retainedPath)).toBe(retained.retainedSha256);
    return { ...retained, db, saved, request, expected, callId: call.call.callId };
  } catch (error) { db.close(); throw error; }
};

/** Called only after genuine current-owner authentication and layout checks. */
export const requireTerminalScoring = async (): Promise<OpenTerminalScoring> => {
  const moduleId = './SqliteActualFoulTerminalScoringStore';
  const found: { openSqliteActualFoulTerminalScoringStore?: OpenTerminalScoring } =
    existsSync(new URL(moduleId + '.ts', import.meta.url)) ? await import(/* @vite-ignore */ moduleId) : {};
  expect(typeof found.openSqliteActualFoulTerminalScoringStore, 'GENUINE_ACKNOWLEDGED_TERMINAL_SCORING_API_MISSING').toBe('function');
  return found.openSqliteActualFoulTerminalScoringStore!;
};
