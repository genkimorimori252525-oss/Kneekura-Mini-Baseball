import { expect, it } from 'vitest';
import { simulateLivePitchV1, type LivePitchInputV1 } from './LivePitchV1';
import { createLiveBaseballMatchV1, LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, LIVE_MATCH_PHYSICS_V1 } from './LiveBaseballMatchV1';
import { createPitchSnapshotFromPresetV78, getLivePitchCatalogV78, migratePitchRepertoireV77ToV78, type PitchRepertoireV78 } from './LivePitchAuthoringV78';
import { liveMatchFixture } from './LiveBaseballMatchV1.test-support';
import { buildPitcherWorkbenchInputV77, simulatePitcherWorkbenchV77 } from './PitcherWorkbenchV77';
import { createSourceFreeBallKernel } from '../../core/sim/ball/SourceFreeBallKernel';
const input = (): LivePitchInputV1 => ({ originTick: 1_000_000, seed: 123,
  batter: { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, heightMeters: 1.8, bats: 'R' },
  pitcher: { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, heightMeters: 1.9 }, measuredClips: liveMatchFixture().measuredClips,
  batting: 'take', pitchType: 'fastball', location: 'zone', physics: LIVE_MATCH_PHYSICS_V1 });
const owned = (): PitchRepertoireV78 => ({ version: 'pitch_repertoire_v78', pitches: [
  createPitchSnapshotFromPresetV78({ presetId: 'slider', pitchId: 'slide-a', physical: LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1 }),
  { ...createPitchSnapshotFromPresetV78({ presetId: 'slider', pitchId: 'slide-b', physical: LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1 }), name: '二つ目の球', releaseSpeedMps: 34 },
] });
it('keeps omitted and fixed spin execution exactly equal to the legacy record', () => {
  const i = input(); for (const pitchType of ['fastball', 'curve', 'auto']) {
    const before = simulateLivePitchV1({ ...i, pitchType });
    expect(JSON.stringify(simulateLivePitchV1({ ...i, pitchType, pitcher: { ...i.pitcher, minimumSpinRatio: 1 } }))).toBe(JSON.stringify(before));
  }
});
it('plans release velocity using nominal spin and applies actual spin only after that plan', () => {
  const i = input(), baseline = simulateLivePitchV1(i), varied = simulateLivePitchV1({ ...i, pitcher: { ...i.pitcher, minimumSpinRatio: .8 } });
  const intended = baseline.diagnostics.sourceDescriptor.initial.ball, actual = varied.diagnostics.sourceDescriptor.initial.ball;
  expect(actual.position).toEqual(intended.position); expect(actual.velocity).toEqual(intended.velocity);
  expect(actual.spin).not.toEqual(intended.spin);
  const ratio = actual.spin.x / intended.spin.x;
  expect(ratio).toBeGreaterThanOrEqual(.8); expect(ratio).toBeLessThan(1);
  expect(actual.spin).toEqual({ x: intended.spin.x * ratio, y: intended.spin.y * ratio, z: intended.spin.z * ratio });
  expect(varied.diagnostics.spinExecution).toMatchObject({ minimumSpinRatio: .8, nominalPlanRetained: true });
});
it('does not compensate material seam force in the nominal inverse command solve',()=>{
  const i=input(),snapshot=createPitchSnapshotFromPresetV78({presetId:'two_seam',pitchId:'selected',physical:i.pitcher}),
    execute=(coefficientScale:number)=>simulateLivePitchV1({...i,pitchType:snapshot.pitchType,pitchId:snapshot.pitchId,pitcher:{...i.pitcher,
      minimumSpinRatio:.8,pitchRepertoireV78:{version:'pitch_repertoire_v78',pitches:[{...snapshot,seamForce:{version:'baseball_seam_force_v1',coefficientScale}}]}}}),
    without=execute(0),withSeams=execute(1),mean=without.diagnostics.sourceDescriptor,actual=withSeams.diagnostics.sourceDescriptor;
  expect(actual.initial).toEqual(mean.initial);expect(withSeams.diagnostics.spinExecution).toEqual(without.diagnostics.spinExecution);
  expect(actual.profile.air.aerodynamics.seamForce?.coefficientScale).toBe(1);
  expect(createSourceFreeBallKernel(actual).evaluateAt(.2).moment.ball.position).not.toEqual(createSourceFreeBallKernel(mean).evaluateAt(.2).moment.ball.position);
});
it('selects owned IDs rather than generating an unowned type, and rejects ambiguous explicit classification', () => {
  const i = input(), repertoire = owned(), pitcher = { ...i.pitcher, pitchRepertoireV78: repertoire };
  const chosen = simulateLivePitchV1({ ...i, pitcher, pitchType: 'slider', pitchId: 'slide-b' });
  expect(chosen.pitchType).toBe('slider'); expect(chosen.pitchId).toBe('slide-b'); expect(chosen.pitchName).toBe('二つ目の球');
  for (let seed = 0; seed < 8; seed++) expect(['slide-a', 'slide-b']).toContain(simulateLivePitchV1({ ...i, seed, pitcher, pitchType: 'auto' }).pitchId);
  expect(() => simulateLivePitchV1({ ...i, pitcher, pitchType: 'slider' })).toThrow(/ambiguous/);
  expect(() => simulateLivePitchV1({ ...i, pitcher, pitchType: 'slider', pitchId: 'not-owned' })).toThrow();
  expect(() => simulateLivePitchV1({ ...i, pitcher, pitchType: 'fastball', pitchId: 'slide-a' })).toThrow(/mismatched classification/);
});
it('uses the exact same snapshot and downward spin in Host and pitcher trial', () => {
  const f = liveMatchFixture(44), repertoire = owned(), pitcher = { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, pitchRepertoireV78: repertoire, minimumSpinRatio: .98 },
    players = f.players.map(p => p.playerId === '1-p0' ? { ...p, physical: pitcher } : { ...p, physical: LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1 }),
    host = createLiveBaseballMatchV1({ ...f, players }), record = host.issuePitch({ batting: 'take', managedTeam: 1, pitchType: 'slider', pitchId: 'slide-b', location: 'zone' }),
    trialInput = buildPitcherWorkbenchInputV77({ players, pitcherId: '1-p0', batterId: '0-b0', catcherId: '1-b0', measuredClips: f.measuredClips,
      seed: (44 + Math.imul(1, 0x9e3779b9)) >>> 0, pitchType: 'slider', pitchId: 'slide-b', location: 'zone' }), trial = simulatePitcherWorkbenchV77({ pitch: trialInput });
  const diagnostics=record.play.diagnostics;
  if(!diagnostics||typeof diagnostics!=='object'||!('sourceDescriptor' in diagnostics))throw new Error('Host pitch diagnostics must expose its Source descriptor');
  expect(trial.pitch.diagnostics.sourceDescriptor).toEqual(diagnostics.sourceDescriptor);
  expect(record.pitchId).toBe('slide-b'); expect(record.pitchName).toBe('二つ目の球');
});
it('executes every classified preset and variant with explicit material physics on both throwing sides', () => {
  for (const preset of getLivePitchCatalogV78().presets) for (const throws of ['R', 'L'] as const) {
    const snapshot = createPitchSnapshotFromPresetV78({ presetId: preset.presetId, pitchId: 'selected', physical: LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, throws }),
      i = input(), result = simulateLivePitchV1({ ...i, pitchType: snapshot.pitchType, pitchId: 'selected',
        pitcher: { ...i.pitcher, throws, pitchRepertoireV78: { version: 'pitch_repertoire_v78', pitches: [snapshot] } } });
    expect(result.pitchId).toBe('selected'); expect(result.diagnostics.sourceDescriptor.materialOrientationAtStart).toEqual(snapshot.releaseOrientation);
    expect(result.diagnostics.sourceDescriptor.profile.air.aerodynamics.seamForce).toEqual(snapshot.seamForce);
    expect(result.frames.every(f => Object.values(f.ball.position).every(Number.isFinite))).toBe(true);
  }
  expect(migratePitchRepertoireV77ToV78(LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1).pitches.every(p => p.seamForce === undefined && p.releaseOrientation === undefined)).toBe(true);
});
