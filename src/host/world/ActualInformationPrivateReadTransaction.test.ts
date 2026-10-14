import { expect, it } from 'vitest';
import { activeBattedWorldFieldReadFrame } from './SqliteBattedWorldFieldStore';
import { actualInformationPrivateReadFixture as fixture, expectInformationReadReleased as released } from './ActualInformationPrivateRead.test-support';

for (const kind of ['observation', 'communication'] as const) {
  it(`${kind}: authenticates real Native dependencies inside each private read traversal`, () => {
    const x = fixture(kind); let authenticated = false;
    // This assertion runs only after a real field owner has authenticated Native
    // evidence. Base RED stops here, before costly currentBefore/write replays.
    x.setAfter(event => {
      if (authenticated || event.writer || event.name !== 'field-read') return;
      authenticated = true;
      expect(event.transaction).toBe(true);
      expect(event.queryOnly).toBe(1); expect(event.frame).not.toBeNull(); expect(event.traversal).toBe(true);
    });
    try {
      const first = x.accept(), append = [...x.events]; expect(authenticated).toBe(true);
      const before = x.rows(), appendFrames = new Set(append.filter(e => !e.writer).map(e => e.frame));
      expect(appendFrames.size).toBe(1);
      const offset = x.events.length; expect(x.read()).toEqual(first);
      const readFrames = new Set(x.events.slice(offset).map(e => e.frame));
      expect(readFrames.size).toBe(1); expect([...readFrames].every(frame => !appendFrames.has(frame))).toBe(true);
      const retryOffset = x.events.length; expect(x.accept()).toEqual(first);
      const retryFrames = new Set(x.events.slice(retryOffset).map(e => e.frame));
      expect(retryFrames.size).toBe(2); expect([...retryFrames].every(frame => !readFrames.has(frame))).toBe(true);
      expect(x.events.filter(e => !e.writer).every(e => e.transaction && e.queryOnly === 1 && e.frame !== null && e.traversal)).toBe(true);
      const writerReads = append.filter(e => e.writer), writerFrames = new Set(writerReads.map(e => e.frame));
      expect(writerReads.length).toBeGreaterThan(0);
      expect(writerReads.every(e => e.transaction && e.queryOnly === 1 && e.frame !== null && e.traversal)).toBe(true);
      expect(writerFrames.size).toBe(2); expect([...writerFrames].every(frame => !appendFrames.has(frame))).toBe(true);
      if (kind === 'communication') expect(x.events.some(e => !e.writer && e.name === 'execution-pair')).toBe(true);
      expect(x.callbacks).toHaveLength(2);
      expect(x.callbacks.every(e => !e.transaction && e.queryOnly === 0 && e.frame === null)).toBe(true);
      expect(x.rows()).toEqual(before); expect(x.count()).toBe(1); released(x);
    } finally { x.close(); }
  });

  it(`${kind}: pins a peer WAL commit within one read group and observes it in the next`, () => {
    const x = fixture(kind), snapshots: number[] = [], prewrite: number[] = [], writer: number[] = [];
    let changed = false;
    try {
      x.f.db.exec('CREATE TABLE information_read_probe(value INTEGER NOT NULL); INSERT INTO information_read_probe VALUES(0)');
      x.setBefore(event => {
        const value = () => Number(event.db.prepare('SELECT value FROM information_read_probe').get()!.value);
        if (!changed && !event.writer) {
          changed = true; snapshots.push(value()); x.f.db.exec('UPDATE information_read_probe SET value=1'); snapshots.push(value());
        }
        (event.writer ? writer : prewrite).push(value());
      });
      const first = x.accept(); expect(snapshots).toEqual([0, 0]);
      expect(prewrite.length).toBeGreaterThan(1); expect(prewrite.every(v => v === 0)).toBe(true);
      expect(writer.length).toBeGreaterThan(0); expect(writer.every(v => v === 1)).toBe(true);
      const later: number[] = []; x.setBefore(event => later.push(Number(event.db.prepare('SELECT value FROM information_read_probe').get()!.value)));
      expect(x.read()).toEqual(first); expect(later.length).toBeGreaterThan(0); expect(later.every(v => v === 1)).toBe(true); released(x);
    } finally { x.close(); }
  });

  it(`${kind}: sees an authority commit after ending the prior private lookup`, () => {
    const x = fixture(kind), seen: number[] = [];
    try {
      x.f.db.exec('CREATE TABLE information_read_probe(value INTEGER NOT NULL); INSERT INTO information_read_probe VALUES(0)');
      x.setAuthority(event => {
        expect(event.transaction).toBe(false); expect(event.queryOnly).toBe(0); expect(event.frame).toBeNull();
        x.f.db.exec('UPDATE information_read_probe SET value=1');
      });
      x.setBefore(event => seen.push(Number(event.db.prepare('SELECT value FROM information_read_probe').get()!.value)));
      expect(x.accept().revision).toBe(1); expect(seen.length).toBeGreaterThan(0); expect(seen.every(v => v === 1)).toBe(true); released(x);
    } finally { x.close(); }
  });

  it(`${kind}: rejects retry authority corruption through a fresh historical read`, () => {
    const x = fixture(kind); let changed = false;
    try {
      x.accept(); const before = x.rows();
      x.setAuthority(event => {
        expect(event.transaction).toBe(false); expect(event.frame).toBeNull();
        x.f.db.prepare("UPDATE physical_pitch_progress_actions SET source_hash='peer-committed' WHERE source_id=?").run(x.physical.source.sourceId);
        changed = true;
      });
      expect(() => x.accept()).toThrow(/corrupt|differ|changed/); expect(changed).toBe(true);
      expect(x.rows()).toEqual(before);
      expect(x.f.db.prepare('SELECT source_hash FROM physical_pitch_progress_actions WHERE source_id=?').get(x.physical.source.sourceId)!.source_hash).toBe('peer-committed');
      released(x);
    } finally { x.close(); }
  });

  it(`${kind}: preserves the owner error and releases its failed private read before retry`, () => {
    const x = fixture(kind), failure = new Error('private-information-owner-failure');
    x.setBefore(() => { throw failure; });
    try {
      let caught: unknown; try { x.accept(); } catch (error) { caught = error; }
      expect(caught).toBe(failure); expect(x.count()).toBe(0);
      expect(x.statements.filter(sql => /^ROLLBACK\s*;?$/i.test(sql))).toHaveLength(1); released(x);
      x.setBefore(); expect(x.accept().revision).toBe(1); expect(x.count()).toBe(1); released(x);
    } finally { x.close(); }
  });

  it(`${kind}: rejects a same-connection write during its private read and restores writable state`, () => {
    const x = fixture(kind); let attempted = false;
    try {
      x.f.db.exec('CREATE TABLE information_read_probe(value INTEGER NOT NULL)');
      x.setBefore(event => {
        if (attempted || event.writer) return; attempted = true;
        expect(() => event.db.exec('INSERT INTO information_read_probe VALUES(1)')).toThrow(/readonly/i);
      });
      expect(x.accept().revision).toBe(1); expect(attempted).toBe(true);
      expect(x.f.db.prepare('SELECT count(*) AS n FROM information_read_probe').get()!.n).toBe(0); released(x);
    } finally { x.close(); }
  });

  it(`${kind}: reauthenticates physical rows after INSERT and rolls back trigger mutations`, () => {
    const x = fixture(kind);
    try {
      const physical = x.f.db.prepare('SELECT * FROM physical_pitch_progress_actions ORDER BY source_id').all();
      x.f.db.exec(`CREATE TRIGGER private_information_mutation AFTER INSERT ON ${x.table}
        BEGIN UPDATE physical_pitch_progress_actions SET source_hash='writer-local-corrupt'; END`);
      expect(() => x.accept()).toThrow(/corrupt|differ|changed/);
      expect(x.rows()).toEqual([]); expect(x.f.db.prepare(`SELECT * FROM ${x.headTable}`).all()).toEqual([]);
      expect(x.f.db.prepare('SELECT * FROM physical_pitch_progress_actions ORDER BY source_id').all()).toEqual(physical); released(x);
      x.f.db.exec('DROP TRIGGER private_information_mutation'); expect(x.accept().revision).toBe(1); released(x);
    } finally { x.close(); }
  });

  it(`${kind}: leaves caller transactions and their uncommitted writes owned by the caller`, () => {
    const x = fixture(kind), failure = new Error('caller-information-read-failure');
    try {
      const first = x.accept(), db = x.connection();
      db.exec('CREATE TABLE information_read_probe(value INTEGER NOT NULL); BEGIN IMMEDIATE; INSERT INTO information_read_probe VALUES(7)');
      expect(x.read()).toEqual(first); expect(db.isTransaction).toBe(true);
      x.setBefore(() => { throw failure; });
      let caught: unknown; try { x.read(); } catch (error) { caught = error; }
      expect(caught).toBe(failure); expect(db.isTransaction).toBe(true);
      expect(db.prepare('SELECT value FROM information_read_probe').get()!.value).toBe(7);
      expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0); expect(activeBattedWorldFieldReadFrame(db)).toBeNull();
      x.setBefore(); db.exec('COMMIT');
      expect(x.f.db.prepare('SELECT value FROM information_read_probe').get()!.value).toBe(7);
      db.exec('PRAGMA query_only=ON; BEGIN'); expect(x.read()).toEqual(first); expect(db.isTransaction).toBe(true);
      expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(1); db.exec('ROLLBACK; PRAGMA query_only=OFF'); released(x);
    } finally { x.close(); }
  });

  it(`${kind}: excludes a competing writer during original current revalidation`, () => {
    const x = fixture(kind); let attempted = false, caught: unknown;
    try {
      x.f.db.exec('PRAGMA busy_timeout=0');
      x.setBefore(event => {
        if (!event.writer || attempted) return; attempted = true;
        try { x.f.db.exec('UPDATE matches SET durable_revision=durable_revision+1'); } catch (error) { caught = error; }
      });
      expect(x.accept().revision).toBe(1); expect(attempted).toBe(true); expect(String(caught)).toMatch(/locked|busy/);
      released(x); x.f.db.exec('BEGIN IMMEDIATE'); x.f.db.exec('ROLLBACK');
    } finally { x.close(); }
  });
}
