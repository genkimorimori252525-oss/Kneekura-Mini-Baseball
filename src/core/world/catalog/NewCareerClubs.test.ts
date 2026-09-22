import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { createCareerClubs, getDefaultClubCatalog } from './index';
import { restoreClubState } from '../club';
import { deriveRivalryEffectiveIntensity, withCurrentCompetitiveThreat } from '../rivalry/RivalryLifecycle';
import { copy, ok, rejected, setup } from './CatalogFixtures.test-support';
const catalog=getDefaultClubCatalog();
describe('new career club assembly',()=>{
  it('creates all clubs with caller money, geometry and external player references unchanged',()=>{
    const request=setup();request.clubs[0]!.initial.cash=123456;const before=copy(request);
    const b=ok(createCareerClubs(catalog,request));assert.equal(b.clubs.length,234);assert.deepEqual(request,before);
    for (const club of b.clubs) {
      const provided=request.clubs.find(x=>x.clubId===club.identity.clubId)!;
      const seed=catalog.clubs.find(x=>x.clubId===club.identity.clubId)!;
      assert.equal(club.live.finance.cash,provided.initial.cash);assert.deepEqual(club.initialSeed.targets,seed.targets);
      assert.equal(club.institutional.stadium.geometryRef,provided.initial.stadium.geometryRef);
      assert.deepEqual(club.live.references.playerClubStateRefs,provided.initial.references.playerClubStateRefs);
      assert.deepEqual(ok(restoreClubState(club)),club);
    }
    assert.equal(Object.isFrozen(b.clubs[0]!.live.references),true);assert.equal(Object.isFrozen(request.clubs[0]!.initial),false);
  });
  it('reuses the directed lifecycle and preserves every historical starting intensity',()=>{
    const b=ok(createCareerClubs(catalog,setup()));
    for (const r of catalog.rivalries) {
      const e=b.rivalryGraph.edges.find(x=>x.fromClubId===r.fromClubId&&x.toClubId===r.toClubId);
      if (r.reason==='DOMINANT_CLUB_TARGET') {
        assert.equal(e,undefined);assert.equal(b.competitiveThreats.find(x=>x.signal.fromClubId===r.fromClubId&&x.signal.toClubId===r.toClubId)!.signal.currentCompetitiveThreat,r.intensity);
      } else {assert.ok(e);assert.ok(Math.abs(deriveRivalryEffectiveIntensity(e,1)-r.intensity)<1e-10);}
    }
    assert.equal(b.rivalryGraph.edges.length+b.competitiveThreats.length,148);
    for (const e of b.rivalryReferences) assert.ok(b.clubs.find(c=>c.identity.clubId===e.fromClubId)!.live.references.rivalryStateRefs.some(x=>x.stateRef===e.stateRef));
  });
  it('keeps the asymmetric 94/92 rivalry and subsequent directional changes independent',()=>{
    const b=ok(createCareerClubs(catalog,setup()));
    const hanshin=catalog.clubs.find(x=>x.displayName==='阪神タイガース')!.clubId;
    const yomiuri=catalog.clubs.find(x=>x.displayName==='読売ジャイアンツ')!.clubId;
    const a=b.rivalryGraph.edges.find(x=>x.fromClubId===hanshin&&x.toClubId===yomiuri)!;
    const z=b.rivalryGraph.edges.find(x=>x.fromClubId===yomiuri&&x.toClubId===hanshin)!;
    assert.equal(deriveRivalryEffectiveIntensity(a,1),94);assert.equal(deriveRivalryEffectiveIntensity(z,1),92);
    assert.equal(withCurrentCompetitiveThreat(a,99).currentCompetitiveThreat,99);assert.equal(z.currentCompetitiveThreat,0);
  });
  it('is deterministic under input order changes',()=>{
    const c=copy(catalog),r=setup();const expected=ok(createCareerClubs(c,r));
    c.clubs.reverse();c.leagues.reverse();c.rivalries.reverse();c.sources.reverse();r.clubs.reverse();
    assert.deepEqual(ok(createCareerClubs(c,r)),expected);
  });
  it('pins provenance and leaves an earlier bundle unchanged by a future catalog',()=>{
    const c=copy(catalog),r=setup();const previous=ok(createCareerClubs(c,r));const before=JSON.stringify(previous);
    c.datasetVersion='club-initial-seeds-v2';c.clubs[0]!.targets.finance=1;
    const next=ok(createCareerClubs(c,r));assert.equal(next.clubs[0]!.initialSeed.targets.finance,1);
    assert.equal(JSON.stringify(previous),before);assert.equal(previous.provenance.datasetVersion,'club-initial-seeds-v1');
    assert.equal(previous.provenance.sourceSnapshots.length,12);
  });
  it('binds relation IDs to career and uses unambiguous tuple encoding',()=>{
    const a=setup(), b=setup();b.context.careerId='different:career';
    const x=ok(createCareerClubs(catalog,a)),y=ok(createCareerClubs(catalog,b));
    assert.notEqual(x.rivalryReferences[0]!.stateRef,y.rivalryReferences[0]!.stateRef);
    assert.notEqual(x.rivalryGraph.edges[0]!.memories[0]!.sourceEventId,y.rivalryGraph.edges[0]!.memories[0]!.sourceEventId);
  });
  it('accepts a large explicitly supplied season without wall clocks or annual loops',()=>{
    const r=setup();r.season=300;
    for (const c of r.clubs) {c.initial.season.season=300;c.initial.season.financialProfile.season=300;}
    const b=ok(createCareerClubs(catalog,r));assert.equal(b.season,300);assert.equal(b.rivalryGraph.edges[0]!.createdSeason,300);
  });
  it('does not execute nested caller getters',()=>{
    const r=setup();let invoked=false;
    Object.defineProperty(r.clubs[0]!.initial.brand,'displayName',{enumerable:true,get(){invoked=true;return 'x';}});
    rejected(createCareerClubs(catalog,r),'INVALID_INPUT');assert.equal(invoked,false);
  });
  for (const [label,mutate,code] of [
    ['running career',(r:ReturnType<typeof setup>)=>{r.context.phase='RUNNING';},'CAREER_ALREADY_RUNNING'],
    ['existing clubs',(r:ReturnType<typeof setup>)=>{r.context.existingClubIds=['old'];},'CLUB_ALREADY_EXISTS'],
    ['missing setup',(r:ReturnType<typeof setup>)=>{r.clubs.pop();},'STATE_INCONSISTENT'],
    ['unknown club',(r:ReturnType<typeof setup>)=>{r.clubs[0]!.clubId='unknown';},'STATE_INCONSISTENT'],
    ['duplicate club',(r:ReturnType<typeof setup>)=>{r.clubs[1]!.clubId=r.clubs[0]!.clubId;},'DUPLICATE_ID'],
    ['sparse array',(r:ReturnType<typeof setup>)=>{delete r.clubs[0];},'INVALID_INPUT'],
    ['bad cash at end',(r:ReturnType<typeof setup>)=>{r.clubs.at(-1)!.initial.cash=-1;},'INVALID_INPUT'],
    ['wrong season',(r:ReturnType<typeof setup>)=>{r.clubs[0]!.initial.season.season=2;},'WRONG_SEASON'],
    ['wrong profile league',(r:ReturnType<typeof setup>)=>{r.clubs[0]!.initial.season.financialProfile.leagueId='wrong';},'STATE_INCONSISTENT'],
    ['conflicting rules',(r:ReturnType<typeof setup>)=>{r.clubs[1]!.initial.season.financialProfile.revenueSharingRate=0.2;},'PROFILE_VERSION_CONFLICT'],
    ['cross league profile ID collision',(r:ReturnType<typeof setup>)=>{r.clubs[12]!.initial.season.financialProfile.profileId=r.clubs[0]!.initial.season.financialProfile.profileId;},'PROFILE_VERSION_CONFLICT'],
    ['altered initial brand',(r:ReturnType<typeof setup>)=>{r.clubs[0]!.initial.brand.displayName='unrelated';},'STATE_INCONSISTENT'],
    ['preloaded rivalries',(r:ReturnType<typeof setup>)=>{r.clubs[0]!.initial.references.rivalryStateRefs=[{fromClubId:'a',toClubId:'b',stateRef:'x'}];},'STATE_INCONSISTENT'],
    ['preloaded threats',(r:ReturnType<typeof setup>)=>{r.clubs[0]!.initial.references.competitiveThreatRefs=['x'];},'STATE_INCONSISTENT'],
    ['missing physical geometry',(r:ReturnType<typeof setup>)=>{r.clubs[0]!.initial.stadium.geometryRef='';},'INVALID_INPUT'],
    ['unknown field',(r:ReturnType<typeof setup>)=>{Object.assign(r,{uiScreen:'not-here'});},'INVALID_INPUT'],
  ] as const) it('atomically rejects '+label,()=>{
    const r=setup();mutate(r);const before=copy(r);const result=createCareerClubs(catalog,r);
    rejected(result,code);assert.deepEqual(r,before);assert.equal(Object.isFrozen(r),false);
  });
});
