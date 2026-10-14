import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { assertNationalBattedFoulRetainedPitchFrontier } from './NationalBattedFoulRetainedTail.test-support';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const gameId='retained-national-game', sourceId='national-live:pitch-0';
const fixture=(retained:boolean)=>{
  const db=new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE physical_pitch_progress_actions(source_id TEXT PRIMARY KEY,game_id TEXT,play_id INTEGER,progress_revision INTEGER);
    CREATE TABLE physical_pitch_progress_heads(game_id TEXT,play_id INTEGER,revision INTEGER,last_source_id TEXT,PRIMARY KEY(game_id,play_id));`);
  db.prepare('INSERT INTO physical_pitch_progress_actions VALUES(?,?,?,?)').run('national-foul:pitch-2',gameId,7,3);
  db.prepare('INSERT INTO physical_pitch_progress_heads VALUES(?,?,?,?)').run(gameId,7,3,'national-foul:pitch-2');
  if(retained){db.prepare('INSERT INTO physical_pitch_progress_actions VALUES(?,?,?,?)').run(sourceId,gameId,8,1);
    db.prepare('INSERT INTO physical_pitch_progress_heads VALUES(?,?,?,?)').run(gameId,8,1,sourceId);}
  return db;
};
const rows=(db:InstanceType<typeof DatabaseSync>)=>({
  actions:db.prepare('SELECT * FROM physical_pitch_progress_actions ORDER BY source_id').all(),
  heads:db.prepare('SELECT * FROM physical_pitch_progress_heads ORDER BY game_id,play_id').all(),
});

it.each([false,true])('accepts only the supported retained cut without changing rows (pitch present: %s)',retained=>{
  const db=fixture(retained);try{const before=rows(db);
    expect(()=>assertNationalBattedFoulRetainedPitchFrontier(db,gameId)).not.toThrow();expect(rows(db)).toEqual(before);
  }finally{db.close();}
});

it.each([
  ['missing head',"DELETE FROM physical_pitch_progress_heads WHERE play_id=8"],
  ['orphan head',"DELETE FROM physical_pitch_progress_actions WHERE play_id=8"],
  ['other action',"UPDATE physical_pitch_progress_actions SET source_id='other' WHERE play_id=8"],
  ['wrong action game',"UPDATE physical_pitch_progress_actions SET game_id='foreign' WHERE play_id=8"],
  ['wrong action play',"UPDATE physical_pitch_progress_actions SET play_id=9 WHERE play_id=8"],
  ['wrong action revision',"UPDATE physical_pitch_progress_actions SET progress_revision=2 WHERE play_id=8"],
  ['wrong head game',"UPDATE physical_pitch_progress_heads SET game_id='foreign' WHERE play_id=8"],
  ['wrong head play',"UPDATE physical_pitch_progress_heads SET play_id=9 WHERE play_id=8"],
  ['wrong head revision',"UPDATE physical_pitch_progress_heads SET revision=2 WHERE play_id=8"],
  ['wrong head source',"UPDATE physical_pitch_progress_heads SET last_source_id='other' WHERE play_id=8"],
  ['extra pitch',"INSERT INTO physical_pitch_progress_actions VALUES('national-live:pitch-1','retained-national-game',8,2)"],
  ['foreign head claiming original source',"INSERT INTO physical_pitch_progress_heads VALUES('foreign',8,1,'national-live:pitch-0')"],
])('rejects a malformed retained frontier: %s',(_label,mutation)=>{
  const db=fixture(true);try{db.exec(mutation);const before=rows(db);
    expect(()=>assertNationalBattedFoulRetainedPitchFrontier(db,gameId)).toThrow();expect(rows(db)).toEqual(before);
  }finally{db.close();}
});
