import { mkdtemp, realpath, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, basename, sep } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { parseNativeContactReportArgsV192 as parse, runNativeContactReportCliV192 as run } from './native-contact-report-v192.mjs';
const directories=[];
afterEach(async()=>{const base=await realpath(tmpdir());for(const path of directories.splice(0)){const absolute=await realpath(path);
  if(!absolute.startsWith(base+sep)||!basename(absolute).startsWith('native-contact-cli-v192-'))throw Error('cleanup escaped test directory');
  await rm(absolute,{recursive:true,force:true});}});
const base=['--database=existing.sqlite','--career=career-a','--player=away-1'];
it('U01 requires an explicit operation and subject, without numerical defaults',()=>{
  expect(parse(['--help'])).toEqual({operation:'help'});
  expect(parse(['export',...base,'--output=report.json'])).toEqual({operation:'export',database:'existing.sqlite',career:'career-a',player:'away-1',output:'report.json',projectionRevision:0});
  expect(parse(['collect',...base,'--calendar-edition=actual-edition'])).toEqual({operation:'collect',database:'existing.sqlite',career:'career-a',player:'away-1',calendarEdition:'actual-edition'});
});
it.each([
  ['export',...base],['collect','--database=existing.sqlite','--career=career-a'],['guess',...base],
  ['collect',...base,'--output=report.json'],['export',...base,'--output=report.json','--calendar-edition=actual'],
  ['collect',...base,'--model=model.json'],['export',...base,'--output=report.json','--player=again'],
  ['export',...base,'--output='],['export',...base,'--output=report.json','--projection-revision=1.5'],
  ['export',...base,'--output=report.json','--projection-revision=9007199254740992'],
])('U02 rejects incomplete, duplicate and operation-inappropriate arguments: %s',(...args)=>expect(()=>parse(args)).toThrow());
it('U03 preserves explicit caller paths and model/policy references',()=>{
  expect(parse(['export',...base,'--output=a=b report.json','--model=model.json','--policy=policy.json','--projection-revision=9']))
    .toEqual({operation:'export',database:'existing.sqlite',career:'career-a',player:'away-1',output:'a=b report.json',model:'model.json',policy:'policy.json',projectionRevision:9});
});
it('U04 never creates a misspelled Native database',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'native-contact-cli-v192-'));directories.push(directory);
  const database=join(directory,'missing.sqlite');
  await expect(run(['collect','--database='+database,'--career=career-a','--player=away-1'])).rejects.toThrow(/existing|ENOENT/);
  await expect(readFile(database)).rejects.toMatchObject({code:'ENOENT'});
});
it('U05 refuses an existing output before opening the database or compiling runtime',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'native-contact-cli-v192-'));directories.push(directory);
  const database=join(directory,'not-opened.sqlite'),output=join(directory,'report.json');
  await writeFile(database,'deliberately not a SQLite file');await writeFile(output,'keep this report');
  await expect(run(['export','--database='+database,'--career=career-a','--player=away-1','--output='+output])).rejects.toThrow(/exists|EEXIST/);
  expect(await readFile(output,'utf8')).toBe('keep this report');expect(await readFile(database,'utf8')).toBe('deliberately not a SQLite file');
});
