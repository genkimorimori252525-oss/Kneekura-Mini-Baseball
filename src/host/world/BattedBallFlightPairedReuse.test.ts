import { expect, it } from 'vitest';
import { readOriginalPhysicalPitchPrefixFromSqlite } from './PhysicalPitchEvidenceFromSqlite';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { ownedRead, pairedPitchFixture, requirePairedReader } from './BattedBallFlightPairedPitch.test-support';

it('reuses a completed prefix in one frame while auditing every access and keeping child and independent reads fresh', () => {
  const x = pairedPitchFixture(); try {
    const read = requirePairedReader(), counts = x.observeReplay(), rows = x.observeOwnedRows(() => {});
    const sourceId = x.g.physical.source.sourceId;
    ownedRead(x.db, () => {
      const first = read(x.db, sourceId), prefix = readOriginalPhysicalPitchPrefixFromSqlite(x.db, sourceId);
      expect(prefix).toEqual(first.prefix); prefix.pop(); expect(first.prefix).toHaveLength(3);
      expect(read(x.db, sourceId)).toBe(first);
      expect(counts.authentications).toBe(1); expect(rows()).toBe(6);
      withBattedWorldPhysicalReadTraversal(x.db, () => {
        expect(read(x.db, sourceId)).not.toBe(first); expect(counts.authentications).toBe(2);
      });
      expect(read(x.db, sourceId)).toBe(first); expect(counts.authentications).toBe(2);
    });
    expect(ownedRead(x.db, () => read(x.db, sourceId)).originalPitchRows).toEqual(x.legacyRows);
    expect(counts).toEqual({ authentications: 3, executions: [0, 1, 2, 0, 1, 2, 0, 1, 2] });
    expect(rows()).toBe(12);
  } finally { x.close(); }
});

it('rejects a changed raw audit on reuse and expires completed proof after a caught failure', () => {
  const x = pairedPitchFixture(); try {
    const read = requirePairedReader(), counts = x.observeReplay(), sourceId = x.g.physical.source.sourceId;
    x.observeOwnedRows((rows, ordinal) => { if (ordinal === 4) rows[0].source_hash = 'changed-reused-audit'; });
    ownedRead(x.db, () => {
      read(x.db, sourceId);
      expect(() => read(x.db, sourceId)).toThrow('corrupt original physical pitch prefix');
      expect(() => read(x.db, sourceId)).toThrow('corrupt original physical pitch prefix');
      expect(counts.authentications).toBe(1);
    });
    expect(ownedRead(x.db, () => read(x.db, sourceId)).originalPitchRows).toEqual(x.legacyRows);
    expect(counts.authentications).toBe(2);
  } finally { x.close(); }
});

it('never installs a completed prefix after authentication catches a nested failed read', () => {
  const x = pairedPitchFixture(); try {
    const read = requirePairedReader(), sourceId = x.g.physical.source.sourceId;
    let failNested = true;
    x.observeReplay({ afterActor: () => {
      if (failNested) {
        failNested = false;
        expect(() => read(x.db, 'missing-nested-pitch')).toThrow('corrupt original physical pitch prefix');
      }
    } });
    expect(() => ownedRead(x.db, () => read(x.db, sourceId))).toThrow('corrupt original physical pitch prefix');
    expect(ownedRead(x.db, () => read(x.db, sourceId)).originalPitchRows).toEqual(x.legacyRows);
  } finally { x.close(); }
});

it('checks the existing frame before reuse after a dependency write and restoration', () => {
  const x = pairedPitchFixture(); try {
    const read = requirePairedReader(), sourceId = x.g.physical.source.sourceId;
    x.db.exec('CREATE TABLE paired_reuse_probe(value INTEGER); INSERT INTO paired_reuse_probe VALUES(0)');
    expect(() => ownedRead(x.db, () => {
      read(x.db, sourceId);
      x.db.exec('PRAGMA query_only=OFF; UPDATE paired_reuse_probe SET value=1; UPDATE paired_reuse_probe SET value=0; PRAGMA query_only=ON');
      expect(() => read(x.db, sourceId)).toThrow('physical read transaction or dependencies changed');
    })).toThrow(/changed|transaction|cleanup/);
    expect(ownedRead(x.db, () => read(x.db, sourceId)).originalPitchRows).toEqual(x.legacyRows);
  } finally { x.close(); }
});

it('retains private savepoint rejection when a completed proof is read after rollback and rebegin', () => {
  const x = pairedPitchFixture(); try {
    const read = requirePairedReader(), sourceId = x.g.physical.source.sourceId;
    expect(() => ownedRead(x.db, () => {
      read(x.db, sourceId); x.db.exec('ROLLBACK; BEGIN');
      read(x.db, sourceId);
    })).toThrow(/savepoint|transaction|cleanup/);
    expect(ownedRead(x.db, () => read(x.db, sourceId)).originalPitchRows).toEqual(x.legacyRows);
  } finally { x.close(); }
});

it('declines completed proof after an attached namespace change and never retains a missing result', () => {
  const x = pairedPitchFixture(); try {
    const read = requirePairedReader(), sourceId = x.g.physical.source.sourceId;
    ownedRead(x.db, () => {
      read(x.db, sourceId); x.db.exec("ATTACH ':memory:' AS paired_reuse_attached");
      expect(() => read(x.db, sourceId)).toThrow('corrupt original physical pitch prefix');
    });
    x.db.exec('DETACH paired_reuse_attached');
    ownedRead(x.db, () => {
      expect(() => read(x.db, 'missing-reused-pitch')).toThrow('corrupt original physical pitch prefix');
      expect(() => read(x.db, sourceId)).toThrow('corrupt original physical pitch prefix');
    });
    expect(ownedRead(x.db, () => read(x.db, sourceId)).originalPitchRows).toEqual(x.legacyRows);
  } finally { x.close(); }
});
