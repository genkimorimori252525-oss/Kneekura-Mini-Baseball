import {expect,it} from 'vitest';
import * as api from './SignatureDisplayV125';
const ref=(id:string)=>({owner:'synthetic-skill-owner',sourceId:id,sourceVersion:'1',sourceHash:'a'.repeat(64),snapshotHash:'b'.repeat(64)});
const trait=(id:string,familyId=id)=>({traitId:id,familyId,stateId:'GOLD',lifecycleClass:'LEARNED_MASTERY_PERSISTENT',label:id,sourceEffectIdentity:id+'-effect',sourceRef:ref(id)});
const definition=()=>({version:'named_signature_definition_v125' as const,signatureId:'style-1',careerId:'career',originPlayerId:'founder',recognitionAtDay:20,
 definitionVersion:'1',displayNameAtRecognition:'架空選手の打法',coveredSources:[{sourceEffectIdentity:'swing-effect',sourceRef:ref('swing')},{sourceEffectIdentity:'run-effect',sourceRef:ref('run')}],
 coveredTraitFamilyIds:['swing','run'],evidenceDigestRef:ref('accepted-review'),statusAtRecognition:'ACTIVE_PLAYER' as const});
const input=()=>({scope:{careerId:'career',playerId:'founder',asOfDay:20},definitions:[definition()],aliases:[],traits:[trait('swing'),trait('run'),trait('arm')]});

it('folds only the covered original traits for display without changing Sources, lifecycle or adding an execution effect',()=>{
 const i=input(),before=structuredClone(i),r=api.projectSignatureDisplayV125(i);
 expect(r.boundary).toBe('SIGNATURE_DISPLAY_ONLY');expect(r.effectsApplied).toBe(false);expect(r.nativeAdmission).toBe(false);
 expect(r.groups).toHaveLength(1);expect(r.groups[0].components.map(t=>t.traitId)).toEqual(['swing','run']);
 expect(r.visibleTraits.map(t=>t.traitId)).toEqual(['arm']);expect(r.originalTraits).toEqual(i.traits);expect(i).toEqual(before);
 expect(r).not.toHaveProperty('physical');expect(r).not.toHaveProperty('powerMultiplier');expect(Object.isFrozen(r.groups[0].components)).toBe(true);
});

it('does not display future recognition or later aliases in earlier cards and preserves the frozen origin name',()=>{
 const i=input(),aliases=[{careerId:'career',signatureId:'style-1',aliasId:'rename',atDay:30,sequence:0,displayName:'新しい別名',sourceRef:ref('rename-event')}];
 expect(api.projectSignatureDisplayV125({...i,scope:{...i.scope,asOfDay:19},aliases}).groups).toEqual([]);
 expect(api.projectSignatureDisplayV125({...i,aliases}).groups[0].displayName).toBe('架空選手の打法');
 const later=api.projectSignatureDisplayV125({...i,scope:{...i.scope,asOfDay:30},aliases});
 expect(later.groups[0].displayName).toBe('新しい別名');expect(later.groups[0].definition.displayNameAtRecognition).toBe('架空選手の打法');
 expect(later.groups[0].definition.originPlayerId).toBe('founder');
});

it('retains historical recognition when present Sources change and does not hide independent or unmatched traits',()=>{
 const i=input(),changed={...i.traits[0],sourceRef:{...ref('swing'),sourceVersion:'2'}},r=api.projectSignatureDisplayV125({...i,traits:[changed,i.traits[2]]});
 expect(r.groups[0].currentExpression).toBe('SOURCE_REFS_CHANGED_OR_MISSING');expect(r.groups[0].components).toEqual([]);
 expect(r.visibleTraits).toEqual([changed,i.traits[2]]);
 expect(api.projectSignatureDisplayV125({...i,scope:{...i.scope,playerId:'same-name-other-person'}}).groups).toEqual([]);
 const retired={...definition(),statusAtRecognition:'RETIRED_PLAYER' as const};expect(api.projectSignatureDisplayV125({...i,definitions:[retired]}).groups).toHaveLength(1);
});

it('rejects duplicate identities and unowned effect fields; overlapping historical groups never fold a component twice',()=>{
 const i=input();expect(()=>api.projectSignatureDisplayV125({...i,traits:[i.traits[0],i.traits[0]]})).toThrow();
 expect(()=>api.projectSignatureDisplayV125({...i,definitions:[i.definitions[0],i.definitions[0]]})).toThrow();
 const unowned={...definition(),powerMultiplier:2};
 expect(()=>api.validateNamedSignatureDefinitionV125(unowned)).toThrow();
 const second={...definition(),signatureId:'later-style',recognitionAtDay:21};
 const r=api.projectSignatureDisplayV125({...i,scope:{...i.scope,asOfDay:22},definitions:[second,definition()]});
 expect(r.groups.flatMap(g=>g.components).map(t=>t.traitId)).toEqual(['swing','run']);expect(r.originalTraits).toEqual(i.traits);
 expect(api.projectSignatureDisplayV125({...i,scope:{...i.scope,asOfDay:22},definitions:[definition(),second]})).toEqual(r);
});
