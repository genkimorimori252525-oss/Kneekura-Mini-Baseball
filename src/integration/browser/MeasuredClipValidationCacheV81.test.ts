import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
import { cloneValidatedMeasuredCatalogV81, MEASURED_CLIP_VALIDATION_LIMITS_V81 } from './MeasuredClipValidationCacheV81';
import { createLiveBaseballMatchV1, LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1 } from './LiveBaseballMatchV1';
import { liveMatchFixture } from './LiveBaseballMatchV1.test-support';

const freeze = <T>(value:T):T => { if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value; };
const clip = (id='obp-1_1') => ({id,side:'R',source:{repository:'https://github.com/drivelineresearch/openbiomechanics',sha256:'a'.repeat(64)},
  contactTimeSeconds:.1,normalization:{batLengthM:.84,sweetSpotT:.8},frames:[{tick:0,grip:{x:0,y:0,z:0},orientation:{w:1,x:0,y:0,z:0}},
    {tick:200000,grip:{x:0,y:1,z:0},orientation:{w:1,x:0,y:0,z:0}}]});

it('reuses a detached owned catalog only for a fully immutable input, retaining every ordered clip',()=>{
  const catalog=freeze(Array.from({length:673},(_,i)=>clip('obp-'+i+'_1'))),first=cloneValidatedMeasuredCatalogV81(catalog),second=cloneValidatedMeasuredCatalogV81(catalog);
  expect(second).toBe(first);expect(first).not.toBe(catalog);expect(first.map(c=>c.id)).toEqual(catalog.map(c=>c.id));
  expect(Object.isFrozen(first[672].frames[1].grip)).toBe(true);expect(()=>{(first[0].frames[0].grip as {x:number}).x=9;}).toThrow();
});
it('does not freeze mutable caller data or reuse shallow-frozen/partially frozen trees',()=>{
  for(const catalog of [[clip()],Object.freeze([clip()]),Object.freeze([Object.freeze(clip())])]){
    const first=cloneValidatedMeasuredCatalogV81(catalog);catalog[0].frames[1].tick=210000;
    const second=cloneValidatedMeasuredCatalogV81(catalog);expect(second).not.toBe(first);expect(first[0].frames[1].tick).toBe(200000);expect(second[0].frames[1].tick).toBe(210000);
    expect(Object.isFrozen(catalog[0].frames)).toBe(false);catalog[0].frames[1].tick=-1;expect(()=>cloneValidatedMeasuredCatalogV81(catalog)).toThrow('invalid measured catalog clock');
  }
});
it('includes validation limits in its key even when the same policy object is mutated',()=>{
  const catalog=freeze([clip(),clip('obp-2_1')]),limits={...MEASURED_CLIP_VALIDATION_LIMITS_V81},first=cloneValidatedMeasuredCatalogV81(catalog,limits);
  limits.maximumCatalogFrames=3;expect(()=>cloneValidatedMeasuredCatalogV81(catalog,limits)).toThrow('measured catalog frame budget exceeded');
  limits.maximumCatalogFrames=4;expect(cloneValidatedMeasuredCatalogV81(catalog,limits)).not.toBe(first);
  limits.sourceRepository='https://example.invalid';expect(()=>cloneValidatedMeasuredCatalogV81(catalog,limits)).toThrow('invalid measured catalog clip');
});
it('retains accessors, sparse arrays, duplicate IDs and nonfinite/clock failures without invoking a getter',()=>{
  let reads=0;const bad={...clip()};Object.defineProperty(bad,'frames',{enumerable:true,get(){reads++;return [];}});
  expect(()=>cloneValidatedMeasuredCatalogV81(Object.freeze([Object.freeze(bad)]))).toThrow('accessors');expect(reads).toBe(0);
  const sparse=[clip(),clip('obp-2_1')];delete sparse[1];expect(()=>cloneValidatedMeasuredCatalogV81(sparse)).toThrow('bounded dense');
  expect(()=>cloneValidatedMeasuredCatalogV81(freeze([clip(),clip()]))).toThrow('duplicate measured clip identity');
  const nonfinite=clip();nonfinite.frames[0].grip.x=NaN;expect(()=>cloneValidatedMeasuredCatalogV81(freeze([nonfinite]))).toThrow('finite');
});
it('does not hide a revoked nested Proxy or throwing descriptor trap on a warm hit',()=>{
  const revocable=Proxy.revocable(freeze(clip()),{}),catalog=Object.freeze([revocable.proxy]);cloneValidatedMeasuredCatalogV81(catalog);revocable.revoke();
  expect(()=>cloneValidatedMeasuredCatalogV81(catalog)).toThrow();
  let broken=false;const proxy=new Proxy(freeze(clip()),{getOwnPropertyDescriptor(target,key){if(broken)throw Error('descriptor trap failed');return Reflect.getOwnPropertyDescriptor(target,key);}}),other=Object.freeze([proxy]);
  cloneValidatedMeasuredCatalogV81(other);broken=true;expect(()=>cloneValidatedMeasuredCatalogV81(other)).toThrow('descriptor trap failed');
});
it('handles shared immutable measurements and preserves order-sensitive Proxy fallback',()=>{
  const shared={x:0,y:0,z:0},item={...clip(),measurement:shared};item.frames[0].grip=shared;
  const catalog=freeze([item]);expect(cloneValidatedMeasuredCatalogV81(catalog)).toBe(cloneValidatedMeasuredCatalogV81(catalog));
  let reverse=false;const target=freeze({...clip(),one:1,two:2}),proxy=new Proxy(target,{ownKeys(value){const keys=Reflect.ownKeys(value);return reverse?keys.reverse():keys;}}),other=Object.freeze([proxy]);
  const first=cloneValidatedMeasuredCatalogV81(other);reverse=true;const second=cloneValidatedMeasuredCatalogV81(other);expect(second).not.toBe(first);expect(Reflect.ownKeys(second[0])).toEqual(Reflect.ownKeys(target).reverse());
});
it('reuses the actual 673-clip decoded library without losing rows, default order or public IDs',()=>{
  runInThisContext(readFileSync('tools/browser-bridge/measured-bat-library-v1.js','utf8'));
  const decoder=(globalThis as unknown as {KneekuraMeasuredBatLibrary:{decode(text:string):{clips:unknown[]}}}).KneekuraMeasuredBatLibrary,
    library=decoder.decode(readFileSync('docs/demos/measured-bat-library-v1.json','utf8')),source=JSON.stringify(library.clips),coldAt=performance.now(),
    cold=cloneValidatedMeasuredCatalogV81(library.clips),coldMs=performance.now()-coldAt,warmAt=performance.now(),warm=cloneValidatedMeasuredCatalogV81(library.clips),warmMs=performance.now()-warmAt,
    mutable=JSON.parse(source),uncachedAt=performance.now(),uncached=cloneValidatedMeasuredCatalogV81(mutable),uncachedMs=performance.now()-uncachedAt;
  expect(warm).toBe(cold);expect(JSON.stringify(warm)).toBe(source);expect(warm.length).toBe(673);expect(warm.reduce((count,item)=>count+item.frames.length,0)).toBe(92201);
  expect(warm.filter(item=>item.defaultSelection).map(item=>item.id)).toEqual(['obp-123_6','obp-190_7','obp-103_5','obp-185_5','obp-254_3','obp-42_5','obp-51_3','obp-313_7','obp-353_2','obp-273_4','obp-56_1','obp-358_7']);
  expect(JSON.stringify(uncached)).toBe(source);expect(Object.isFrozen(mutable)).toBe(false);
  console.info('v81 measured catalog cache single-run milliseconds',JSON.stringify({clips:warm.length,coldMs,warmMs,uncachedMs,warmToColdRatio:warmMs/coldMs,warmToUncachedRatio:warmMs/uncachedMs,scope:'Node helper only; not browser startup or device FPS'}));
},60000);
it('does not reuse player/seed/explicit clip validation when a catalog is warm',()=>{
  const fixture=liveMatchFixture(),measuredClips=freeze(fixture.measuredClips);createLiveBaseballMatchV1({...fixture,measuredClips});
  expect(()=>createLiveBaseballMatchV1({...fixture,measuredClips,seed:NaN})).toThrow('finite');
  expect(()=>createLiveBaseballMatchV1({...fixture,measuredClips,players:fixture.players.map((player,i)=>i?player:{...player,physical:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,clipId:'obp-unknown'}})})).toThrow('unknown measured clip or wrong batting side');
});
it('keeps omitted-feature same-seed complete Host history identical for mutable, cold and warm catalogs',()=>{
  const fixture={...liveMatchFixture(2468),innings:1},immutable=freeze(structuredClone(fixture.measuredClips)),command={batting:'balanced' as const,pitchType:'auto',location:'auto',managedTeam:0 as const};
  const play=(measuredClips:typeof fixture.measuredClips)=>{const host=createLiveBaseballMatchV1({...fixture,measuredClips});let pitches=0;while(!host.inspect().finished&&pitches++<300)host.issuePitch(command);expect(host.inspect().finished).toBe(true);return JSON.stringify(host.inspect());};
  const original=play(fixture.measuredClips);expect(play(immutable)).toBe(original);expect(play(immutable)).toBe(original);
},120000);
