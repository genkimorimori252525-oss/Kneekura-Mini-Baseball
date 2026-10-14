import {createRequire} from 'node:module';
import {expect,it} from 'vitest';
import {foulTerminalCompletionTableSql,assertFoulTerminalApplicationStorage} from './ActualFoulTerminalApplicationStorage';
import {installFinalCompletionCapabilityOnPrivateCopy} from './TerminalFinalCapabilityFixture.test-support';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite')as typeof import('node:sqlite');
// Structural storage fixtures only, with no claimed original terminal evidence.
it('explicitly adds final capability while preserving terminal rowids and unrelated storage',()=>{
 const db=new DatabaseSync(':memory:');try{db.exec(foulTerminalCompletionTableSql);db.exec("CREATE TABLE unrelated(value TEXT); INSERT INTO unrelated VALUES('kept')");
 db.prepare("INSERT INTO actual_foul_terminal_applications VALUES (?,?,?,?,?,?,?,'QUEUED',?,?,?,?,NULL)").run('source','game',7,'application','pitch','end','obligation','{}','hash','{}','hash');const before=db.prepare('SELECT rowid,* FROM actual_foul_terminal_applications').all();
 expect(installFinalCompletionCapabilityOnPrivateCopy(db)).toEqual({installed:true,rowsPreserved:true,rowCount:1});expect(assertFoulTerminalApplicationStorage(db,'finalCompletion')).toBe(true);expect(db.prepare('SELECT rowid,* FROM actual_foul_terminal_applications').all()).toEqual(before);expect(db.prepare('SELECT * FROM unrelated').all()).toEqual([{value:'kept'}]);expect(installFinalCompletionCapabilityOnPrivateCopy(db).installed).toBe(false);
 }finally{db.close();}
});
it('refuses a caller transaction or dependent schema before changing capability',()=>{
 const db=new DatabaseSync(':memory:');try{db.exec(foulTerminalCompletionTableSql);db.exec('BEGIN');expect(()=>installFinalCompletionCapabilityOnPrivateCopy(db)).toThrow('own its transaction');db.exec('ROLLBACK');db.exec('CREATE VIEW dependent AS SELECT * FROM actual_foul_terminal_applications');expect(()=>installFinalCompletionCapabilityOnPrivateCopy(db)).toThrow('dependent schema');expect(()=>assertFoulTerminalApplicationStorage(db,'finalCompletion')).toThrow('prerequisite');
 }finally{db.close();}
});
