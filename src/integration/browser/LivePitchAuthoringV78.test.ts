import { describe, expect, it } from 'vitest';
import { appendPitchLibraryRevisionV78, createPitchSnapshotFromLibraryV78, createPitchSnapshotFromPresetV78, getLivePitchCatalogV78,
  migratePitchRepertoireV77ToV78, resolvePitcherRepertoireV78, samplePitchSpinExecutionV78, validatePitchLibraryV78, validatePitchRepertoireV78 } from './LivePitchAuthoringV78';
import { validatePitchRepertoireV77 } from './LivePitchAuthoringV77';
import { LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, LIVE_MATCH_PHYSICS_V1 } from './LiveBaseballMatchV1';
import { calculateBaseballAerodynamics } from '../../core/sim/ball/BaseballAerodynamics';
import { sampleAerodynamicPitchStateAtElapsedSeconds } from '../../core/sim/pitching/AerodynamicPitchTrajectory';
const empty = { version: 'pitch_library_v78' as const, records: [] };
const draft = { originalId: 'my-slider', name: '曲がる球', pitchType: 'slider' as const, releaseSpeedMps: 35, spinRadPerSecond: { x: 100, y: 120, z: 30 } };
describe('v78 distinct pitch identity, immutable library and physical execution', () => {
  it('keeps fifteen classifications and named variants separate from stable owned IDs', () => {
    const catalog = getLivePitchCatalogV78();
    expect(catalog.types).toHaveLength(15);
    expect(catalog.presets.some(p => p.presetId === 'two_seam' && p.pitchType === 'sinker')).toBe(true);
    expect(catalog.presets.some(p => p.presetId === 'forkball' && p.pitchType === 'forkball')).toBe(true);
    const one = createPitchSnapshotFromPresetV78({ presetId: 'slider', pitchId: 'slider-a', physical: LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1 });
    const two = { ...one, pitchId: 'slider-b', releaseSpeedMps: 30 };
    const packet = { version: 'pitch_repertoire_v78', pitches: [one, two] };
    expect(validatePitchRepertoireV78(packet).pitches.map(p => p.pitchId)).toEqual(['slider-a', 'slider-b']);
    expect(resolvePitcherRepertoireV78({ ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, pitchRepertoireV78: packet as never }).map(p => p.pitchId)).toEqual(['slider-a', 'slider-b']);
    expect(() => validatePitchRepertoireV77([one])).toThrow();
    expect(() => validatePitchRepertoireV78({ ...packet, pitches: [one, one] })).toThrow();
    expect(() => resolvePitcherRepertoireV78({ ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, pitchRepertoireV78: packet as never,
      pitchRepertoire: [{ pitchType: 'fastball', releaseSpeedMps: 40, spinRadPerSecond: { x: 1, y: 0, z: 0 } }] })).toThrow();
  });
  it('appends new immutable revisions and copies a selected snapshot without future linkage', () => {
    const first = appendPitchLibraryRevisionV78({ library: empty, ...draft }), before = JSON.stringify(first.library),
      snapshot = createPitchSnapshotFromLibraryV78({ library: first.library, originalId: draft.originalId, revision: 1, pitchId: 'owned-1' }),
      second = appendPitchLibraryRevisionV78({ library: first.library, ...draft, releaseSpeedMps: 38 });
    expect(first.record.revision).toBe(1); expect(second.record.revision).toBe(2);
    expect(JSON.stringify(first.library)).toBe(before);
    expect(snapshot.releaseSpeedMps).toBe(35); expect(snapshot.source).toEqual({ kind: 'original', id: 'my-slider', revision: 1 });
    expect(validatePitchLibraryV78(JSON.parse(JSON.stringify(second.library)))).toEqual(second.library);
    expect(() => validatePitchLibraryV78({ ...second.library, records: [...second.library.records, first.record] })).toThrow();
    expect(() => createPitchSnapshotFromLibraryV78({ library: second.library, originalId: draft.originalId, revision: 3, pitchId: 'owned-1' })).toThrow();
  });
  it('mirrors only newly generated left-handed examples, including their material force and physical path',()=>{
    const physical={...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,pitchRepertoire:[{pitchType:'slider' as const,releaseSpeedMps:20,spinRadPerSecond:{x:1,y:2,z:3}}]},
      before=JSON.stringify(physical),mirror=(v:{x:number;y:number;z:number})=>({x:-v.x,y:v.y,z:v.z});
    for(const preset of getLivePitchCatalogV78().presets){
      const right=createPitchSnapshotFromPresetV78({presetId:preset.presetId,pitchId:'right',physical,throws:'R'}),
        left=createPitchSnapshotFromPresetV78({presetId:preset.presetId,pitchId:'left',physical,throws:'L'}),
        velocity={x:2,y:1,z:-36},rAir={...LIVE_MATCH_PHYSICS_V1.air,aerodynamics:{...LIVE_MATCH_PHYSICS_V1.air.aerodynamics,seamForce:right.seamForce}},
        lAir={...rAir,aerodynamics:{...rAir.aerodynamics,seamForce:left.seamForce}},
        rf=calculateBaseballAerodynamics(velocity,right.spinRadPerSecond,rAir.aerodynamics,right.releaseOrientation),
        lf=calculateBaseballAerodynamics(mirror(velocity),left.spinRadPerSecond,lAir.aerodynamics,left.releaseOrientation);
      expect(left.spinRadPerSecond).toEqual({x:right.spinRadPerSecond.x,y:-right.spinRadPerSecond.y,z:-right.spinRadPerSecond.z});
      expect(left.releaseSpeedMps).toBe(right.releaseSpeedMps);
      for(const key of ['x','y','z'] as const)expect(lf.totalAcceleration[key]).toBeCloseTo(mirror(rf.totalAcceleration)[key],10);
      const initial={tick:0,position:{x:-.4,y:2,z:17},velocity,spin:right.spinRadPerSecond},
        r=sampleAerodynamicPitchStateAtElapsedSeconds(initial,.12,rAir,right.releaseOrientation),
        l=sampleAerodynamicPitchStateAtElapsedSeconds({...initial,position:mirror(initial.position),velocity:mirror(velocity),spin:left.spinRadPerSecond},.12,lAir,left.releaseOrientation);
      for(const key of ['x','y','z'] as const)expect(l.position[key]).toBeCloseTo(mirror(r.position)[key],10);
      if(preset.presetId==='slider')expect(right.releaseSpeedMps).not.toBe(20);
    }
    expect(JSON.stringify(physical)).toBe(before);
    const old=migratePitchRepertoireV77ToV78(physical).pitches.find(p=>p.pitchType==='slider')!;
    expect(old.releaseSpeedMps).toBe(20);expect(old.spinRadPerSecond).toEqual({x:1,y:2,z:3});expect(old).not.toHaveProperty('releaseOrientation');
  });
  it('samples downward spin only, keeps the axis, and uses a deterministic isolated stream', () => {
    const nominalSpin = { x: 100, y: -20, z: 40 }, before = JSON.stringify(nominalSpin);
    for (const seed of Array.from({ length: 128 }, (_, i) => i)) {
      const low = samplePitchSpinExecutionV78({ seed, nominalSpin, minimumSpinRatio: .8 }), high = samplePitchSpinExecutionV78({ seed, nominalSpin, minimumSpinRatio: .98 });
      expect(low.ratio).toBeGreaterThanOrEqual(.8); expect(low.ratio).toBeLessThanOrEqual(1);
      expect(high.ratio).toBeGreaterThanOrEqual(.98); expect(high.ratio).toBeLessThanOrEqual(1);
      expect(high.ratio).toBeGreaterThanOrEqual(low.ratio);
      expect(low.spin).toEqual({ x: nominalSpin.x * low.ratio, y: nominalSpin.y * low.ratio, z: nominalSpin.z * low.ratio });
      expect(samplePitchSpinExecutionV78({ seed, nominalSpin, minimumSpinRatio: .8 })).toEqual(low);
    }
    expect(samplePitchSpinExecutionV78({ seed: 4, nominalSpin }).spin).toBe(nominalSpin);
    expect(Object.isFrozen(nominalSpin)).toBe(false);
    expect(samplePitchSpinExecutionV78({ seed: 4, nominalSpin, minimumSpinRatio: 1 }).active).toBe(false);
    expect(JSON.stringify(nominalSpin)).toBe(before);
  });
  it('rejects unsafe IDs, malformed nested fields, non-finite physics and getters atomically', () => {
    for (const bad of [ { ...draft, originalId: '../escape' }, { ...draft, releaseSpeedMps: NaN }, { ...draft, name: '<script>text</script>\n' },
      { ...draft, spinRadPerSecond: { x: 1201, y: 0, z: 0 } }, { ...draft, extra: true } ])
      expect(() => appendPitchLibraryRevisionV78({ library: empty, ...bad })).toThrow();
    let invoked = false;
    expect(() => validatePitchLibraryV78({ version: 'pitch_library_v78', get records() { invoked = true; return []; } })).toThrow();
    expect(invoked).toBe(false); expect(empty.records).toEqual([]);
    expect(() => migratePitchRepertoireV77ToV78({ ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, get pitchRepertoireV78() { invoked = true; return undefined; } })).toThrow();
    expect(invoked).toBe(false);
  });
});
