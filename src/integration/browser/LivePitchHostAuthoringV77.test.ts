import { expect, it } from 'vitest';
import { createLiveBaseballMatchV1, LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1 } from './LiveBaseballMatchV1';
import { liveMatchFixture } from './LiveBaseballMatchV1.test-support';
import { buildPitcherWorkbenchInputV77, simulatePitcherWorkbenchV77 } from './PitcherWorkbenchV77';
import { validateLiveTraitProfileV1 } from './LiveTraitProfilesV1';

it('uses the same repertoire, handed release, technique and physical Source in Host and pitcher workbench', () => {
  const fixture = liveMatchFixture(1234), pitcherId = fixture.teams[1].pitcherId, batterId = fixture.teams[0].battingOrder[0], catcherId = fixture.teams[1].defense.C,
    physical = { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, maximumPitchSpeedMps: 45,
      pitchRepertoire: [{ pitchType: 'fastball' as const, releaseSpeedMps: 40, spinRadPerSecond: { x: 200, y: -70, z: 60 } }],
      pitchReleaseHeightMeters: 1.5, pitchReleaseSideMeters: .6, pitchReleaseExtensionMeters: 1.9,
      pitchingMotion: { preparationMs: 2000, headMotionScale: .7 } },
    traitProfile = validateLiveTraitProfileV1({ version: 'live_trait_profile_v2', selections: [
      { familyId: 'inside_command', stateId: 'MASTERED', source: { effectScale: 1 } }
    ] }, physical),
    players = fixture.players.map(p => p.playerId === pitcherId ? { ...p, throws: 'L' as const, physical, traitProfile } : p),
    snapshot = JSON.stringify(players), host = createLiveBaseballMatchV1({ ...fixture, players }),
    record = host.issuePitch({ batting: 'take', pitchType: 'fastball', location: 'inside', managedTeam: 1 }),
    input = buildPitcherWorkbenchInputV77({ players, pitcherId, batterId, catcherId, measuredClips: fixture.measuredClips,
      seed: (fixture.seed + Math.imul(1, 0x9e3779b9)) >>> 0, pitchType: 'fastball', location: 'inside' }),
    trial = simulatePitcherWorkbenchV77({ pitch: input, context: { pitcherId, batterId } });
  expect(trial.pitch.diagnostics.sourceDescriptor).toEqual((record.play.diagnostics as typeof trial.pitch.diagnostics).sourceDescriptor);
  expect(record.frames[0].ball!.position).toEqual({ x: .6, y: .254 + 1.5, z: 18.44 - 1.9 });
  expect((record.play.diagnostics as typeof trial.pitch.diagnostics).pitchingMotion).toEqual(physical.pitchingMotion);
  expect(trial.pitch.diagnostics.insideCommandTechnique!.effectiveStandardDeviationMeters).toBeLessThan(physical.commandStdMeters);
  expect(JSON.stringify(players)).toBe(snapshot);
});

it('rejects repertoire speeds above the individual limit before creating a Host', () => {
  const fixture = liveMatchFixture(), pitcherId = fixture.teams[1].pitcherId,
    players = fixture.players.map(p => p.playerId === pitcherId ? { ...p, physical: { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,
      maximumPitchSpeedMps: 35, pitchRepertoire: [{ pitchType: 'fastball' as const, releaseSpeedMps: 40, spinRadPerSecond: { x: 200, y: 0, z: 0 } }] } } : p);
  expect(() => createLiveBaseballMatchV1({ ...fixture, players })).toThrow('pitch speed exceeds');
});
