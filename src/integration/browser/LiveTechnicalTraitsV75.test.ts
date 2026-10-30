import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { getLiveTraitCatalogV1, setLiveTraitProfileV1, projectLiveTraitProfilesV1, validateLiveTraitProfileV1, reconcileLiveTraitSourcesV54 } from './LiveTraitProfilesV1';
import { resolveLiveTechnicalTraitsV75 } from './LiveTraitProfilesV1';
import { applyLivePhysicalRosterV1, type LivePhysicalRosterInputV1 } from './LivePhysicalRosterV1';
import { validateTechnicalSkillControlsV75 } from '../../core/sim/TechnicalSkillControlsV75';
const initial = JSON.parse(readFileSync('docs/demos/live-game-roster-v62.json','utf8')) as LivePhysicalRosterInputV1;
const players=JSON.parse(readFileSync('docs/demos/live-game-roster-catalog-v62.json','utf8')).players;
const ids=['baserunning','bunting','advanced_fielding','bat_to_run_transition','slow_ball_charge','low_zone_command'];
const edit=(roster:LivePhysicalRosterInputV1,id:string,stateId:string|null,scale=1)=>setLiveTraitProfileV1({roster,playerId:initial.entries[0].playerId,familyId:id,stateId,source:{effectScale:scale}}).roster;
describe('v75 dedicated technique authoring',()=>{
 it('retains old seven-family catalog and exposes thirteen only when requested',()=>{
  expect(getLiveTraitCatalogV1()).toHaveLength(7);expect(getLiveTraitCatalogV1({includeTechnical:true})).toHaveLength(13);
  expect(projectLiveTraitProfilesV1({roster:initial,playerId:initial.entries[0].playerId}).traits).toHaveLength(7);
 });
 it.each(ids)('%s has one execution owner, preserves physical and other players, and roundtrips JSON',(id)=>{
  const next=edit(initial,id,id==='baserunning'?'GOLD':'LEARNED',1.7),entry=next.entries[0],physical=initial.entries[0].physical;
  expect(entry.physical).toEqual(physical);expect(next.entries.slice(1)).toEqual(initial.entries.slice(1));
  expect(applyLivePhysicalRosterV1({players,roster:JSON.parse(JSON.stringify(next))}).players).toHaveLength(20);
  expect(resolveLiveTechnicalTraitsV75(entry.traitProfile)?.[id as 'bunting']).toBeGreaterThan(0);
  expect(edit(next,id,id==='baserunning'?'GOLD':'LEARNED',1.7)).toEqual(next);
  const off=edit(next,id,null,1.7);expect(resolveLiveTechnicalTraitsV75(off.entries[0].traitProfile)).toBeUndefined();
  const zero=edit(next,id,id==='baserunning'?'GOLD':'LEARNED',0);expect(resolveLiveTechnicalTraitsV75(zero.entries[0].traitProfile)).toBeUndefined();
 });
 it('keeps gold exclusive, scaled, and negative running grades separate from aggression',()=>{
  let next=edit(initial,'baserunning','G',1);expect(resolveLiveTechnicalTraitsV75(next.entries[0].traitProfile)?.baserunning).toBe(-1);
  next=edit(next,'baserunning','A',1);next=edit(next,'baserunning','GOLD',2);
  expect(next.entries[0].traitProfile!.selections.filter(s=>s.familyId==='baserunning')).toHaveLength(1);
  expect(resolveLiveTechnicalTraitsV75(next.entries[0].traitProfile)?.baserunning).toBe(2);
 });
 it('rejects invalid strength/state/duplicate/unknown sources atomically',()=>{
  const before=JSON.stringify(initial);
  for(const scale of [-.1,2.01,NaN,Infinity])expect(()=>edit(initial,'bunting','LEARNED',scale)).toThrow();
  expect(()=>edit(initial,'slow_ball_charge','MASTERED')).toThrow();
  const p=edit(initial,'bunting','LEARNED').entries[0].traitProfile!;
  expect(()=>validateLiveTraitProfileV1({...p,selections:[...p.selections,...p.selections.filter(s=>s.familyId==='bunting')]},initial.entries[0].physical!)).toThrow();
  expect(()=>validateTechnicalSkillControlsV75({bunting:3})).toThrow();expect(()=>validateTechnicalSkillControlsV75({madeUp:1})).toThrow();
  expect(JSON.stringify(initial)).toBe(before);
 });
 it('refuses malformed public resolver packets rather than silently skipping them',()=>{
  for(const p of [{version:'wrong',selections:[]},{version:'live_trait_profile_v1',selections:[{familyId:'unknown',stateId:null,source:{}}]}, {version:'live_trait_profile_v1',selections:[{familyId:'bunting',stateId:'LEARNED',source:{effectScale:1,extra:2}}]}])expect(()=>resolveLiveTechnicalTraitsV75(p as never)).toThrow();
 });
 it('keeps technique source independent when common abilities are edited',()=>{
  const next=edit(initial,'advanced_fielding','MASTERED');
  const reconciled=reconcileLiveTraitSourcesV54({roster:next,playerId:next.entries[0].playerId,changedPaths:['physical.transferSeconds','physical.topSpeedMps']});
  expect(reconciled).toEqual(next);
 });
});
