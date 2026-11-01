import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getLiveTraitCatalogV1, validateLiveTraitProfileV1, resolveLiveTechnicalTraitsV75, type LiveTraitRosterInputV1, type LiveTraitSourceV1 } from './LiveTraitProfilesV1';
import { getLiveTraitCatalogV77, projectLiveTraitProfilesV77, resolveLiveExecutionPhysicalV77, setLiveTraitProfileV77 } from './LiveTraitRuntimeV77';
import { createPitchSnapshotFromPresetV78 } from './LivePitchAuthoringV78';
import { LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1 } from './LiveBaseballMatchV1';

const source={recipeVersion:'kire_release_recipe_v177'};
const states=['KIRE_CIRCLE','KIRE_DOUBLE_CIRCLE','THREATENING_DOUBLE_CIRCLE'] as const;
function fixture():LiveTraitRosterInputV1 {
  const roster:LiveTraitRosterInputV1=JSON.parse(readFileSync('docs/demos/live-game-roster-v62.json','utf8')),
    pitch=createPitchSnapshotFromPresetV78({presetId:'curve',pitchId:'quality-trait-curve',physical:LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1});
  return {...roster,entries:roster.entries.map((entry,index)=>index===0?{...entry,
    physical:{...entry.physical!,pitchRepertoireV78:{version:'pitch_repertoire_v78',pitches:[pitch]}},
    traitProfile:{version:'live_trait_profile_v2',selections:[]}}:entry)};
}
const select=(roster:LiveTraitRosterInputV1,stateId:typeof states[number]|null)=>setLiveTraitProfileV77({roster,
  playerId:roster.entries[0].playerId,familyId:'breaking_ball_quality',stateId}).roster;

describe('V177 quality selection as an independent saved recipe',()=>{
  it('adds only the V77 catalog with the three requested labels and a selection editor',()=>{
    expect(getLiveTraitCatalogV1()).toHaveLength(7);
    expect(getLiveTraitCatalogV1({includeTechnical:true})).toHaveLength(13);
    expect(getLiveTraitCatalogV1({includeTechnical:true}).some(row=>row.familyId==='breaking_ball_quality')).toBe(false);
    const quality=getLiveTraitCatalogV77().find(row=>row.familyId==='breaking_ball_quality');
    expect(quality).toMatchObject({editor:'PITCH_QUALITY',sourceRoute:'SOURCE_EXECUTION'});
    expect(quality!.states.map(row=>[row.stateId,row.label,row.color])).toStrictEqual([
      ['KIRE_CIRCLE','キレ○','blue'],['KIRE_DOUBLE_CIRCLE','キレ◎','blue'],['THREATENING_DOUBLE_CIRCLE','驚異の切れ味','gold']]);
  });

  it.each(states)('persists %s without numeric input and recreates its request after JSON reload',stateId=>{
    const initial=fixture(),before=structuredClone(initial),saved=select(initial,stateId),entry=saved.entries[0],
      restored:LiveTraitRosterInputV1=JSON.parse(JSON.stringify(saved)),
      actual=resolveLiveExecutionPhysicalV77(entry.physical!,entry.traitProfile),
      reload=resolveLiveExecutionPhysicalV77(restored.entries[0].physical!,restored.entries[0].traitProfile);
    expect(entry.traitProfile!.selections).toStrictEqual([{familyId:'breaking_ball_quality',stateId,source}]);
    expect(actual.pitchQualityV177).toStrictEqual({version:'live_pitch_quality_request_v177',qualityState:stateId});
    expect(reload).toStrictEqual(actual);
    const {pitchQualityV177:_request,...base}=actual;
    expect(base).toStrictEqual(entry.physical);
    expect(entry.physical).toStrictEqual(initial.entries[0].physical);
    expect(saved.entries.slice(1)).toStrictEqual(initial.entries.slice(1));
    expect(initial).toStrictEqual(before);expect(Object.isFrozen(initial.entries[0].physical)).toBe(false);
    const projected=projectLiveTraitProfilesV77({roster:restored,playerId:entry.playerId}).traits.find(row=>row.familyId==='breaking_ball_quality');
    expect(projected).toMatchObject({stateId,editor:'PITCH_QUALITY',sourceValue:source});
  });

  it('restores the exact base execution identity with the normal selection',()=>{
    const saved=select(fixture(),states[2]),restored=select(saved,null),entry=restored.entries[0];
    expect(entry.physical).toStrictEqual(saved.entries[0].physical);
    expect(entry.traitProfile!.selections).toStrictEqual([{familyId:'breaking_ball_quality',stateId:null,source}]);
    expect(resolveLiveExecutionPhysicalV77(entry.physical!,entry.traitProfile)).toBe(entry.physical);
    expect(resolveLiveExecutionPhysicalV77(entry.physical!,entry.traitProfile)).not.toHaveProperty('pitchQualityV177');
  });

  it('rejects unknown recipe versions, effectScale and legacy-family admission atomically',()=>{
    const roster=select(fixture(),states[0]),before=JSON.stringify(roster),playerId=roster.entries[0].playerId;
    const invalidSources:LiveTraitSourceV1[]=[{recipeVersion:'other'},{recipeVersion:'kire_release_recipe_v177',effectScale:1},{},
      {recipeVersion:'kire_release_recipe_v177',extra:'ignored'}];
    for(const invalid of invalidSources)
      expect(()=>setLiveTraitProfileV77({roster,playerId,familyId:'breaking_ball_quality',stateId:states[0],source:invalid})).toThrow();
    expect(()=>validateLiveTraitProfileV1({version:'live_trait_profile_v1',selections:[{familyId:'breaking_ball_quality',stateId:states[0],source}]},roster.entries[0].physical!)).toThrow();
    expect(()=>setLiveTraitProfileV77({roster,playerId,familyId:'breaking_ball_quality',stateId:'LEARNED'})).toThrow();
    expect(JSON.stringify(roster)).toBe(before);
  });

  it('preserves other saved techniques and their execution when quality is added and removed',()=>{
    const initial=fixture(),playerId=initial.entries[0].playerId,
      cautious=setLiveTraitProfileV77({roster:initial,playerId,familyId:'fielding_aggression',stateId:'CAUTIOUS',source:{effectScale:.7}}).roster,
      original=setLiveTraitProfileV77({roster:cautious,playerId,familyId:'inside_command',stateId:'MASTERED',source:{effectScale:1}}).roster,
      selected=select(original,states[1]),cleared=select(selected,null),entry=original.entries[0],
      withQuality=resolveLiveExecutionPhysicalV77(selected.entries[0].physical!,selected.entries[0].traitProfile),
      {pitchQualityV177:_quality,...otherwise}=withQuality;
    expect(otherwise).toStrictEqual(resolveLiveExecutionPhysicalV77(entry.physical!,entry.traitProfile));
    expect(selected.entries[0].traitProfile!.selections.filter(row=>row.familyId!=='breaking_ball_quality')).toStrictEqual(entry.traitProfile!.selections);
    expect(resolveLiveTechnicalTraitsV75(selected.entries[0].traitProfile)).toStrictEqual(resolveLiveTechnicalTraitsV75(entry.traitProfile));
    expect(resolveLiveExecutionPhysicalV77(cleared.entries[0].physical!,cleared.entries[0].traitProfile))
      .toStrictEqual(resolveLiveExecutionPhysicalV77(entry.physical!,entry.traitProfile));
    expect(cleared.entries[0].physical).toStrictEqual(entry.physical);
  });
});
