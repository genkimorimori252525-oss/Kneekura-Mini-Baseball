// Test-support mechanics only. These tiny FK schemas are not genuine producers.
import { expect,it } from 'vitest';
import { DatabaseSync,captureRow } from './ActualFoulTerminalAcknowledgementIntegrity.test-support';
const fixture = () => {
  const db=new DatabaseSync(':memory:');
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE matches(match_id TEXT PRIMARY KEY,activation_json TEXT);
    CREATE TABLE applications(application_id TEXT PRIMARY KEY,match_id TEXT REFERENCES matches(match_id));
    INSERT INTO matches VALUES('match','original');
    INSERT INTO applications VALUES('application','match');`);
  return db;
};
it('AF01 captured referenced Match restores exact bytes and original foreign-key policy',() => {
  const db=fixture();
  try {
    const captured=captureRow(db,'matches','match_id','match');
    db.prepare('UPDATE matches SET activation_json=? WHERE match_id=?').run('damaged','match');
    expect(() => captured.restore(),'MATCH_RESTORE_FOREIGN_KEY_GUARD_MISSING').not.toThrow();
    expect(db.prepare('SELECT rowid AS __ack_rowid,* FROM matches').get()).toEqual(captured.saved);
    expect(db.prepare('SELECT * FROM applications').all()).toEqual([{application_id:'application',match_id:'match'}]);
    expect(db.prepare('PRAGMA foreign_keys').get()!.foreign_keys).toBe(1);
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);expect(db.isTransaction).toBe(false);
  } finally {db.close();}
});
it('AF02 captured missing Match reinserts its exact rowid with foreign keys restored',() => {
  const db=fixture();
  try {
    const captured=captureRow(db,'matches','match_id','match');
    db.exec('PRAGMA foreign_keys=OFF');
    try {expect(db.prepare('DELETE FROM matches WHERE match_id=?').run('match').changes).toBe(1);}
    finally {db.exec('PRAGMA foreign_keys=ON');}
    expect(db.isTransaction).toBe(false);expect(db.prepare('PRAGMA foreign_keys').get()!.foreign_keys).toBe(1);
    expect(db.prepare('PRAGMA foreign_key_check').all()).toHaveLength(1);
    captured.restore();
    expect(db.prepare('SELECT rowid AS __ack_rowid,* FROM matches').get()).toEqual(captured.saved);
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);expect(db.isTransaction).toBe(false);
  } finally {db.close();}
});
