import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { getDefaultClubCatalog } from './index';
const root=process.cwd();
const compiler=join(root,'tools/catalog/compile-catalog.mjs');
const data='data/world-club-catalog-v1';
const generated='src/core/world/catalog/GeneratedClubCatalog.ts';
function isolated(work:(dir:string)=>void):void {
  const dir=mkdtempSync(join(tmpdir(),'club-catalog-test-'));
  try {cpSync(join(root,data),join(dir,data),{recursive:true});mkdirSync(join(dir,'src/core/world/catalog'),{recursive:true});work(dir);}
  finally {rmSync(dir,{recursive:true,force:true});}
}
function compile(dir:string,check=false) {
  const r=spawnSync(process.execPath,[compiler,...(check?['--check']:[])],{cwd:dir,encoding:'utf8',timeout:15000});
  assert.equal(r.error,undefined,String(r.error));return r;
}
function registry(dir:string) {
  return JSON.parse(readFileSync(join(dir,data,'identity-registry.json'),'utf8')) as {
    schemaVersion:number;leagues:[string,string,number][];clubs:[string,string,string,string][];
  };
}
function save(dir:string,value:unknown) {writeFileSync(join(dir,data,'identity-registry.json'),JSON.stringify(value));}
describe('catalog source compiler',()=>{
  it('generates runtime literals before both typecheck and standalone tests',()=>{
    const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
    assert.equal(pkg.scripts.pretypecheck,'node tools/catalog/compile-catalog.mjs');
    assert.equal(pkg.scripts.pretest,'node tools/catalog/compile-catalog.mjs');
  });
  it('generates runtime literals before the existing watch-test command on a fresh checkout',()=>{
    const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
    assert.equal(pkg.scripts['pretest:watch'],'node tools/catalog/compile-catalog.mjs');
  });
  it('checks the runtime literal against every exact frozen source byte',()=>{
    const r=compile(root,true);assert.equal(r.status,0,r.stdout+r.stderr);
  });
  it('preserves explicit IDs when registry rows are reordered',()=>isolated(dir=>{
    const r=registry(dir);r.leagues.reverse();r.clubs.reverse();save(dir,r);
    const result=compile(dir);assert.equal(result.status,0,result.stdout+result.stderr);
    assert.equal(readFileSync(join(dir,generated),'utf8'),readFileSync(join(root,generated),'utf8'));
  }));
  it('traces all numeric targets to all 1170 approved cells, not their decorative rank suffix',()=>{
    let cells=0;const catalog=getDefaultClubCatalog();
    for (const c of catalog.clubs) {
      const src=catalog.sources.find(x=>x.sourceId===c.provenance.seed.sourceId)!;
      const line=readFileSync(join(root,data,'sources',src.path.split('/').at(-1)!),'utf8').split('\n')[c.provenance.seed.line-1]!;
      const values=line.split('|').slice(2,-1).map(s=>Number(s.trim().split('(')[0]));
      assert.deepEqual(Object.values(c.targets),values);cells+=values.length;
    }
    assert.equal(cells,1170);
  });
  it('does not let changed source bytes pass their recorded Git blob fingerprint',()=>isolated(dir=>{
    const p=join(dir,data,'sources/27-asia-pacific-club-initial-seeds.md');writeFileSync(p,readFileSync(p,'utf8').replace('88(A)','89(A)'));
    const r=compile(dir);assert.notEqual(r.status,0);assert.match(r.stderr,/Source changed/);
  }));
  it('uses the exact frozen reference revision',()=>{
    assert.equal(getDefaultClubCatalog().sourceRevision,'782f6b8ef2406839de5678b00040001111cd8f77');
    const source=readFileSync(join(root,data,'sources/27-asia-pacific-club-initial-seeds.md'));
    assert.equal(createHash('sha1').update(`blob ${source.length}\0`).update(source).digest('hex'),'468c5b0b84648f559ba07ad4c0969ee1c3db7407');
  });
  for (const [label, mutate] of [
    ['missing club',(r:ReturnType<typeof registry>)=>{r.clubs.pop();}],
    ['duplicate club',(r:ReturnType<typeof registry>)=>{r.clubs[1]![0]=r.clubs[0]![0];}],
    ['unknown seed',(r:ReturnType<typeof registry>)=>{r.clubs[0]![3]='No such source row';}],
    ['wrong league',(r:ReturnType<typeof registry>)=>{r.clubs[0]![2]=r.clubs[12]![2];}],
    ['unsafe ID',(r:ReturnType<typeof registry>)=>{r.clubs[0]![0]='club\0unsafe';}],
    ['unsafe origin',(r:ReturnType<typeof registry>)=>{r.clubs[0]![1]='origin\0unsafe';}],
  ] as const) it('rejects registry '+label,()=>isolated(dir=>{
    const r=registry(dir);mutate(r);save(dir,r);const result=compile(dir);
    assert.notEqual(result.status,0,'compiler must reject '+label);
  }));
});
