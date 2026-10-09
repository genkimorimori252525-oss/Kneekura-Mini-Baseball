// Tiny real SQLite guard fixtures only. Successful ancestry uses retained genuine
// owners in the separate acceptance gate; these rows never represent valid P/C/E.
import { createRequire } from 'node:module';
import type { DatabaseSync as Database } from 'node:sqlite';
import { expect, it, vi } from 'vitest';
import * as terminalEvidence from './ActualFoulTerminalApplicationEvidenceFromSqlite';
import { foulTerminalScoringEvidenceFromSqlite } from './ActualFoulTerminalScoringEvidenceFromSqlite';
import { foulTerminalRoleWorkloadContextFromSqlite } from './ActualFoulTerminalRoleWorkloadEvidenceFromSqlite';
import * as terminalOwnership from './ActualFoulTerminalApplicationOwnership';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { activeBattedWorldFieldReadSnapshot } from './SqliteBattedWorldFieldStore';

type AncestryReader = (db: Database) => { read(sourceId: string): unknown };
const reader = (): AncestryReader => db => {
  const loaded = terminalEvidence as typeof terminalEvidence & { foulTerminalAcknowledgementAncestryFromSqlite?: AncestryReader };
  expect(typeof loaded.foulTerminalAcknowledgementAncestryFromSqlite, 'IMMUTABLE_ACKNOWLEDGEMENT_ANCESTRY_API_MISSING').toBe('function');
  return loaded.foulTerminalAcknowledgementAncestryFromSqlite!(db);
};
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const fixture = (sql = terminalEvidence.foulTerminalAcknowledgementTableSql) => {
  const db = new DatabaseSync(':memory:');
  db.exec(sql + `;
    CREATE TABLE matches(match_id TEXT PRIMARY KEY,durable_revision INTEGER NOT NULL,state_json TEXT NOT NULL,activation_json TEXT);
    CREATE TABLE applications(application_id TEXT PRIMARY KEY,match_id TEXT NOT NULL,closure_id TEXT NOT NULL,request_hash TEXT NOT NULL,result_json TEXT NOT NULL,UNIQUE(match_id,closure_id));
    CREATE TABLE official_fixtures(game_id TEXT PRIMARY KEY,venue_id TEXT NOT NULL,fixture_event_id TEXT NOT NULL UNIQUE,fixture_revision INTEGER NOT NULL);
    CREATE TABLE official_scoring_applications(scoring_application_id TEXT PRIMARY KEY,match_id TEXT NOT NULL,
      official_application_id TEXT NOT NULL REFERENCES applications(application_id),closure_id TEXT NOT NULL,source_event_id TEXT NOT NULL UNIQUE,
      request_json TEXT NOT NULL,result_json TEXT NOT NULL,UNIQUE(match_id,closure_id));
    PRAGMA user_version=3;`);
  return db;
};
const insertMalformed = (db: Database, status: string, result: string | null) => {
  db.exec('PRAGMA ignore_check_constraints=ON');
  db.prepare('INSERT INTO actual_foul_terminal_applications VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
    'malformed-stage','game',7,'application','pitch','end','obligation',status,'{}','bad','{}','bad',result);
  db.exec('PRAGMA ignore_check_constraints=OFF');
};
const unchanged = (db: Database, body: () => void) => {
  const before = db.prepare('SELECT total_changes() AS n').get();
  const schema = db.prepare('SELECT * FROM main.sqlite_master ORDER BY name').all();
  body();
  expect(db.prepare('SELECT total_changes() AS n').get()).toEqual(before);
  expect(db.prepare('SELECT * FROM main.sqlite_master ORDER BY name').all()).toEqual(schema);
};

it('AN01 immutable ancestry has a read-only missing-owner result independent of the public reader', () => {
  const db = fixture(), internal = reader();
  const publicReader = vi.spyOn(terminalEvidence, 'foulTerminalApplicationEvidenceFromSqlite').mockImplementation(() => {
    throw new Error('PUBLIC_TERMINAL_READER_REENTRY');
  });
  try { unchanged(db, () => expect(internal(db).read('missing')).toBeNull()); expect(publicReader).not.toHaveBeenCalled(); }
  finally { publicReader.mockRestore(); db.close(); }
});
it('AN02 invalid Source identity is rejected without mutation', () => {
  const db = fixture(), internal = reader();
  try { unchanged(db, () => expect(() => internal(db).read('')).toThrow('invalid foul terminal queue identity')); }
  finally { db.close(); }
});
for (const [status, result] of [
  ['QUEUED','{}'],['OFFICIAL_APPLIED_PENDING_POST_PLAY',null],['OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY',null],
  ['POST_PLAY_COMPLETED_CONTINUING','{}'],
] as const) it('AN03 preserves unsupported archive rejection for ' + status, () => {
  const db = fixture(), internal = reader();
  try {
    insertMalformed(db, status, result);
    unchanged(db, () => {
      const reason=status==='POST_PLAY_COMPLETED_CONTINUING'?'foul terminal completion storage prerequisite':'foul terminal queue archive stage is unsupported';
      expect(() => internal(db).read('malformed-stage')).toThrow(reason);
      expect(() => terminalEvidence.foulTerminalApplicationEvidenceFromSqlite(db).read('malformed-stage'))
        .toThrow(reason);
    });
  } finally { db.close(); }
});
it('AN04 immutable ancestry requires the exact existing acknowledgement schema', () => {
  const db = fixture(terminalEvidence.foulTerminalApplicationTableSql), internal = reader();
  try {
    insertMalformed(db, 'OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY', '{}');
    unchanged(db, () => expect(() => internal(db).read('malformed-stage'))
      .toThrow('foul terminal acknowledgement storage prerequisite requires its exact CHECK schema'));
  } finally { db.close(); }
});
it('AN05 immutable ancestry discovers a surviving raw official claim without inventing acknowledgement', () => {
  const db = fixture(), internal = reader();
  try {
    db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run('foreign','foreign','foreign','bad',
      '{"pendingPostPlay":{"origin":{"owner":"actual_foul_terminal_applications","source\\u0049d":"missing","sourceId":"foreign"}}}');
    unchanged(db, () => expect(() => internal(db).read('missing')).toThrow(/missing.*claims survive/));
  } finally { db.close(); }
});
it('AN06 future completed CHECK capability is still unsupported', () => {
  const db = fixture(terminalEvidence.foulTerminalAcknowledgementTableSql.replace("status='QUEUED'", "status IN ('QUEUED','POST_PLAY_COMPLETED_CONTINUING')"));
  const internal = reader();
  try { unchanged(db, () => expect(() => internal(db).read('missing')).toThrow(/schema|constraints/)); }
  finally { db.close(); }
});
it('AN07 scoring uses immutable ancestry without invoking the public terminal reader', () => {
  const db = fixture();
  const publicReader = vi.spyOn(terminalEvidence, 'foulTerminalApplicationEvidenceFromSqlite').mockImplementation(() => {
    throw new Error('PUBLIC_TERMINAL_READER_REENTRY');
  });
  try { unchanged(db, () => expect(foulTerminalScoringEvidenceFromSqlite(db).prepare('missing')).toBeNull()); expect(publicReader).not.toHaveBeenCalled(); }
  finally { publicReader.mockRestore(); db.close(); }
});
it('AN08 workload uses immutable ancestry while retaining pending-only eligibility', () => {
  const db = fixture();
  const publicReader = vi.spyOn(terminalEvidence, 'foulTerminalApplicationEvidenceFromSqlite').mockImplementation(() => {
    throw new Error('PUBLIC_TERMINAL_READER_REENTRY');
  });
  try {
    unchanged(db, () => expect(() => foulTerminalRoleWorkloadContextFromSqlite(db, 'missing'))
      .toThrow('terminal workload requires authentic acknowledged pending post-play'));
    expect(publicReader).not.toHaveBeenCalled();
  } finally { publicReader.mockRestore(); db.close(); }
});
it('AN09 missing original owners remain fresh across sibling consumers and independent reads', () => {
  const db = fixture(), internal = reader(), original = terminalOwnership.foulTerminalApplicationIdentityRows;
  const identities = vi.spyOn(terminalOwnership, 'foulTerminalApplicationIdentityRows').mockImplementation(original);
  try {
    unchanged(db, () => {
      withBattedVenueLegalReadSnapshot(db, () => {
        expect(internal(db).read('missing')).toBeNull();
        expect(withBattedWorldPhysicalReadTraversal(db, () => internal(db).read('missing'))).toBeNull();
        expect(identities).toHaveBeenCalledTimes(2);
      });
      expect(internal(db).read('missing')).toBeNull(); expect(identities).toHaveBeenCalledTimes(3);
    });
  } finally { identities.mockRestore(); db.close(); }
});
it('AN10 a caught original-reader failure poisons snapshot reuse while independent retries stay fresh', () => {
  const db = fixture(), internal = reader();
  try {
    unchanged(db, () => {
      withBattedVenueLegalReadSnapshot(db, () => {
        expect(activeBattedWorldFieldReadSnapshot(db)).not.toBeNull();
        expect(() => internal(db).read('')).toThrow('invalid foul terminal queue identity');
        expect(() => activeBattedWorldFieldReadSnapshot(db)).toThrow('physical read snapshot failed');
      });
      expect(activeBattedWorldFieldReadSnapshot(db)).toBeNull();
      expect(internal(db).read('missing')).toBeNull();
    });
  } finally { db.close(); }
});
it('AN11 an earlier missing result cannot hide a newly attached owner namespace', () => {
  const db = fixture(), internal = reader();
  try {
    withBattedVenueLegalReadSnapshot(db, () => {
      expect(internal(db).read('missing')).toBeNull();
      db.exec("ATTACH ':memory:' AS original_namespace_probe");
      expect(() => internal(db).read('missing')).toThrow('main-only authority storage');
      expect(() => activeBattedWorldFieldReadSnapshot(db)).toThrow('physical read snapshot failed');
    });
    db.exec('DETACH original_namespace_probe'); expect(internal(db).read('missing')).toBeNull();
  } finally { db.close(); }
});
