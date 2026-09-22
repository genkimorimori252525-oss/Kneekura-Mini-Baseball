import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { createClubCatalog, findCatalogClub, getDefaultClubCatalog } from './index';
import { copy, ok, rejected } from './CatalogFixtures.test-support';
const base = getDefaultClubCatalog();
describe('approved club catalog', () => {
  it('contains the exact 234 clubs, 21 leagues and 148 directed seed rows', () => {
    assert.equal(base.clubs.length, 234); assert.equal(base.leagues.length, 21); assert.equal(base.rivalries.length, 148);
    assert.equal(base.leagues.reduce((n,x) => n+x.clubCount,0),234);
    assert.equal(new Set(base.clubs.map(x => x.canonicalOriginId)).size,234);
    assert.equal(base.sources.length,12);
  });
  for (const [name, count] of [['Japan',12],['Korea',10],['Taiwan',6],['Australia',4],['North America',30],['Mexico',20]] as const)
    it('preserves approved ' + name + ' club count', () => assert.equal(base.leagues.find(x => x.displayName === name)!.clubCount, count));
  for (const name of ['LG Twins','LG 트윈스','Wei Chuan Dragons','味全龍','Shanghai Shenhua','上海申花','阪神タイガース'])
    it('resolves explicit source spelling: ' + name, () => {
      const result = ok(findCatalogClub(base,{name,leagueId:null})); assert.equal(result.status,'FOUND'); assert.equal(result.clubIds.length,1);
      assert.ok(base.clubs.find(x => x.clubId===result.clubIds[0])!.displayName.includes(name));
    });
  it('normalizes NFC/case/outer spaces without removing accents or fuzzy matching', () => {
    assert.equal(ok(findCatalogClub(base,{name:'  FC BAYERN MU\u0308NCHEN  ',leagueId:null})).status,'FOUND');
    assert.equal(ok(findCatalogClub(base,{name:'FC Bayern Munchen',leagueId:null})).status,'NOT_FOUND');
    assert.equal(ok(findCatalogClub(base,{name:base.clubs[0]!.clubId,leagueId:null})).status,'NOT_FOUND');
  });
  it('reports ambiguity and allows explicit league scoping', () => {
    const c=copy(base);c.clubs[0]!.aliases.push('shared-name');c.clubs[12]!.aliases.push('shared-name');
    const result=ok(findCatalogClub(c,{name:'shared-name',leagueId:null})); assert.equal(result.status,'AMBIGUOUS'); assert.equal(result.clubIds.length,2);
    assert.deepEqual(ok(findCatalogClub(c,{name:'shared-name',leagueId:c.clubs[0]!.leagueId})).clubIds,[c.clubs[0]!.clubId]);
  });
  it('does not remint identity when names change', () => {
    const c=copy(base);c.clubs[0]!.displayName='A later catalog name';
    assert.equal(ok(createClubCatalog(c)).clubs[0]!.clubId,base.clubs[0]!.clubId);
  });
  it('normalizes collection order without mutating or freezing caller records', () => {
    const c=copy(base);c.clubs.reverse();c.leagues.reverse();c.sources.reverse();c.rivalries.reverse();const before=copy(c);
    const result=ok(createClubCatalog(c));assert.deepEqual(result,base);assert.deepEqual(c,before);
    assert.equal(Object.isFrozen(c.clubs),false);assert.equal(Object.isFrozen(result.clubs[0]!.targets),true);
    c.clubs[0]!.targets.finance=0;assert.notEqual(result.clubs.at(-1)!.targets.finance,0);
  });
  it('rejects getter-bearing nested input without executing getters', () => {
    const c=copy(base);let invoked=false;
    Object.defineProperty(c.clubs[0]!.targets,'finance',{enumerable:true,get(){invoked=true;return 90;}});
    rejected(createClubCatalog(c),'INVALID_INPUT');assert.equal(invoked,false);
  });
  for (const [label, mutate] of [
    ['duplicate club', (c: ReturnType<typeof copy<typeof base>>) => c.clubs.push(c.clubs[0]!)],
    ['duplicate origin', (c: ReturnType<typeof copy<typeof base>>) => {c.clubs[1]!.canonicalOriginId=c.clubs[0]!.canonicalOriginId;}],
    ['unknown league', (c: ReturnType<typeof copy<typeof base>>) => {c.clubs[0]!.leagueId='absent';}],
    ['wrong count', (c: ReturnType<typeof copy<typeof base>>) => {c.leagues[0]!.clubCount++;}],
    ['unknown source', (c: ReturnType<typeof copy<typeof base>>) => {c.clubs[0]!.provenance.seed.sourceId='absent';}],
    ['NaN target', (c: ReturnType<typeof copy<typeof base>>) => {c.clubs[0]!.targets.finance=NaN;}],
    ['negative target', (c: ReturnType<typeof copy<typeof base>>) => {c.clubs[0]!.targets.finance=-1;}],
    ['over 100 target', (c: ReturnType<typeof copy<typeof base>>) => {c.clubs[0]!.targets.finance=101;}],
    ['NUL ID', (c: ReturnType<typeof copy<typeof base>>) => {c.clubs[0]!.clubId='club\0x';}],
    ['self relation', (c: ReturnType<typeof copy<typeof base>>) => {c.rivalries[0]!.toClubId=c.rivalries[0]!.fromClubId;}],
    ['unknown endpoint', (c: ReturnType<typeof copy<typeof base>>) => {c.rivalries[0]!.toClubId='absent';}],
    ['duplicate pair with another ID', (c: ReturnType<typeof copy<typeof base>>) => {c.rivalries.push({...c.rivalries[0]!,edgeId:'other'});}],
    ['historical below floor', (c: ReturnType<typeof copy<typeof base>>) => {c.rivalries[0]!.reason='HISTORICAL_RIVAL';c.rivalries[0]!.intensity=1;}],
    ['duplicate alias', (c: ReturnType<typeof copy<typeof base>>) => {c.clubs[0]!.aliases=['Hello','HELLO'];}],
    ['sparse clubs', (c: ReturnType<typeof copy<typeof base>>) => {delete c.clubs[0];}],
    ['unknown field', (c: ReturnType<typeof copy<typeof base>>) => {Object.assign(c,{overallBuff:10});}],
    ['invalid revision', (c: ReturnType<typeof copy<typeof base>>) => {c.sourceRevision='latest';}],
  ] as const) it('rejects ' + label, () => {const c=copy(base);mutate(c);rejected(createClubCatalog(c));});
  for (const input of [null,{},[],false,7,'catalog']) it('rejects noncatalog input '+JSON.stringify(input),()=>rejected(createClubCatalog(input),'INVALID_INPUT'));
});
