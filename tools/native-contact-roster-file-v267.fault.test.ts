import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {afterEach,expect,it,vi} from 'vitest';
import type {NativeContactRosterExportV264} from './native-contact-roster-export-v264';
const fault=vi.hoisted(()=>({mode:'',reads:0,unlinks:0,foreignPath:''}));
vi.mock('node:fs',async(importOriginal)=>{const actual=await importOriginal<typeof import('node:fs')>();return {...actual,
 openSync:(...args:Parameters<typeof actual.openSync>)=>{if(fault.mode==='open-collision'){fault.foreignPath=String(args[0]);actual.writeFileSync(fault.foreignPath,'foreign-temp');const e=new Error('injected collision') as NodeJS.ErrnoException;e.code='EEXIST';throw e}return (actual.openSync as any)(...args)},
 unlinkSync:(path:fs.PathLike)=>{fault.unlinks++;return actual.unlinkSync(path)},
 writeSync:(...args:Parameters<typeof actual.writeSync>)=>{if(fault.mode==='write')return 0;return (actual.writeSync as any)(...args)},
 fsyncSync:(fd:number)=>{if(fault.mode==='sync')throw Error('injected sync');return actual.fsyncSync(fd)},
 linkSync:(oldPath:fs.PathLike,newPath:fs.PathLike)=>{if(fault.mode==='link')throw Error('injected link');return actual.linkSync(oldPath,newPath)},
 readFileSync:(...args:Parameters<typeof actual.readFileSync>)=>{fault.reads++;if((fault.mode==='stage'&&fault.reads===1)||((fault.mode==='published'||fault.mode==='published-cleanup')&&fault.reads===2))throw Error('injected read');return (actual.readFileSync as any)(...args)},
 rmdirSync:(...args:Parameters<typeof actual.rmdirSync>)=>{if(fault.mode==='cleanup'||fault.mode==='published-cleanup')throw Error('injected cleanup');return actual.rmdirSync(...args)}
 }});
import * as fs from 'node:fs';
import {writeContactRosterFileV267 as write} from './native-contact-roster-file-v267';
const directories:string[]=[];afterEach(()=>{fault.mode='';fault.reads=0;fault.unlinks=0;fault.foreignPath='';for(const d of directories.splice(0))fs.rmSync(d,{recursive:true,force:true})});
const setup=()=>{const d=fs.mkdtempSync(join(tmpdir(),'contact-v267-fault-'));directories.push(d);fault.reads=0;return {d,target:join(d,'out.json')}};
const payload={version:'native-contact-roster-export-v264',boundary:'LOCAL_READ_ONLY_NATIVE_ROSTER_EXPORT',batch:{version:'native-contact-distribution-batch-v263',boundary:'READ_ONLY_NATIVE_ROSTER_CONTACT_BATCH',careerId:'c',requestedRosterSnapshotId:'s',status:'UNKNOWN',reasons:['ROSTER_SNAPSHOT_NOT_FOUND'],roster:null,rows:null,populationBoundary:'EXPLICIT_GLOBAL_ROSTER_SNAPSHOT_ONLY',producerCoverage:'SUPPORTED_NATIVE_INVENTORY_ONLY',asOfSemantics:'ROSTER_CHECKPOINT_AND_LATEST_REGISTERED_CONTACT_AT_SAME_DB_SNAPSHOT',directionStatus:'UNASSESSED',physicsEffects:'NONE'},subjectLinks:null} as unknown as NativeContactRosterExportV264;
it.each(['write','sync','link','stage'])('fails before publication on %s fault',mode=>{const {d,target}=setup();fault.mode=mode;expect(()=>write(payload,target)).toThrow();fault.mode='';expect(fs.existsSync(target)).toBe(false);expect(fs.readdirSync(d)).toEqual([])});
it('preserves a fully published file when post-publication read fails',()=>{const {target}=setup();fault.mode='published';expect(()=>write(payload,target)).toThrow();fault.mode='';expect(fs.existsSync(target)).toBe(true);expect(fs.readFileSync(target,'utf8')).toContain('native-contact-roster-json-v266')});
it('reports cleanup failure without deleting a published file',()=>{const {d,target}=setup();fault.mode='cleanup';expect(()=>write(payload,target)).toThrow();fault.mode='';expect(fs.existsSync(target)).toBe(true);expect(fs.readdirSync(d)).toHaveLength(2)});

it('preserves foreign temp bytes and never unlinks when exclusive open fails',()=>{const {target}=setup();fault.mode='open-collision';let error:unknown;try{write(payload,target)}catch(e){error=e}expect(error).toBeInstanceOf(AggregateError);const errors=(error as AggregateError).errors;expect(errors).toHaveLength(2);expect(errors[0]).toMatchObject({code:'EEXIST',message:'injected collision'});expect(errors[1]).toMatchObject({code:'ENOTEMPTY'});fault.mode='';expect(fault.unlinks).toBe(0);expect(fs.readFileSync(fault.foreignPath,'utf8')).toBe('foreign-temp');expect(fs.existsSync(target)).toBe(false)});

it('preserves published output and both read and cleanup failures',()=>{const {target}=setup();fault.mode='published-cleanup';let error:unknown;try{write(payload,target)}catch(e){error=e}expect(error).toBeInstanceOf(AggregateError);const errors=(error as AggregateError).errors;expect(errors).toHaveLength(2);expect(errors[0]).toMatchObject({message:'injected read'});expect(errors[1]).toMatchObject({message:'injected cleanup'});fault.mode='';expect(fs.existsSync(target)).toBe(true);expect(fs.readFileSync(target,'utf8')).toContain('native-contact-roster-json-v266')});
