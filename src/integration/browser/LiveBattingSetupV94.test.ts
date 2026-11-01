import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, LIVE_MATCH_PHYSICS_V1 } from './LiveBaseballMatchV1';
import { simulateLivePitchV1, type LiveMeasuredClipV1, type LivePitchInputV1 } from './LivePitchV1';
import { simulatePitcherWorkbenchV77 } from './PitcherWorkbenchV77';
import { applyLivePhysicalRosterV1 } from './LivePhysicalRosterV1';
import { distanceToStrikeZoneVolumeV94 } from '../../core/sim/pitching/StrikeZoneVolumeV94';
import { createPitchSnapshotFromPresetV78 } from './LivePitchAuthoringV78';
import { setPitchMovementLevelV92 } from './PitchMovementV92';

const clips = JSON.parse(readFileSync(new URL('../../../docs/demos/measured-bat-motions.json', import.meta.url), 'utf8')).clips as LiveMeasuredClipV1[];
const input = (bats: 'R' | 'L' = 'R'): LivePitchInputV1 => ({ originTick: 1_000_000, seed: 3,
  batter: { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, heightMeters: 1.8, bats, timingStdSeconds: 0, aimStdMeters: 0 },
  pitcher: { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, commandStdMeters: 0 },
  measuredClips: clips, batting: 'balanced', pitchType: 'fastball', location: 'zone', physics: LIVE_MATCH_PHYSICS_V1 });

it('uses a real 3D air contact before catcher custody for a taken official strike', () => {
  const source = input(), result = simulateLivePitchV1({ ...source, batting: 'take' }), contact = result.diagnostics.officialStrikeZoneContactV94;
  expect(result.call).toBe('called_strike'); expect(contact?.kind).toBe('hit');
  if (contact?.kind !== 'hit') throw Error('fixture needs official 3D strike contact');
  expect(contact.at).toBeLessThan(result.diagnostics.catcherContactElapsedSeconds!);
  expect(distanceToStrikeZoneVolumeV94(contact.position, result.diagnostics.strikeZoneVolumeV94)).toBeLessThanOrEqual(source.physics.air.aerodynamics.ballRadiusM);
  expect(result.diagnostics.strikeZoneVolumeV94).toEqual(result.diagnostics.battingSetupV94.volume);
  expect(result.diagnostics.courseRecognitionV87.pitcher.planeZ).toBe(.4318);
});

it('changes measured bat contact aim and time with the support-foot position while the pitched Source stays fixed', () => {
  for (const bats of ['R', 'L'] as const) {
    const source = input(bats), before = JSON.stringify(source), forced = { ...source.batter, swingDecision: { approach: 'SWING' as const, threshold: .5, aggressionWeight: .5 } },
      back = simulateLivePitchV1({ ...source, batter: { ...forced, battingSetupV94: { boxPosition: 'back' } } }),
      middle = simulateLivePitchV1({ ...source, batter: { ...forced, battingSetupV94: { boxPosition: 'middle' } } }),
      front = simulateLivePitchV1({ ...source, batter: { ...forced, battingSetupV94: { boxPosition: 'front' } } });
    expect(back.diagnostics.sourceDescriptor).toEqual(front.diagnostics.sourceDescriptor);
    expect(front.diagnostics.desiredContactElapsedSeconds).toBeLessThan(middle.diagnostics.desiredContactElapsedSeconds);
    expect(middle.diagnostics.desiredContactElapsedSeconds).toBeLessThan(back.diagnostics.desiredContactElapsedSeconds);
    expect(front.diagnostics.referenceContactTick).toBeLessThan(back.diagnostics.referenceContactTick);
    const sample = (result: typeof front) => result.sampleBatAtTick(result.diagnostics.referenceContactTick)!;
    expect(sample(front).grip.z).toBeGreaterThan(sample(back).grip.z);
    expect(front.diagnostics.strikeZoneVolumeV94).toEqual(back.diagnostics.strikeZoneVolumeV94);
    expect(JSON.stringify(source)).toBe(before);
  }
});

it('uses exactly the same resolved landmarks and volume in pitcher measurement and physical pitch diagnostics', () => {
  const source = input(), battingSetupV94 = { boxPosition: 'front' as const,
    normalPose: { shoulderTopRatio: .7, uniformPantsTopRatio: .45, kneecapBottomRatio: .25 } },
    result = simulatePitcherWorkbenchV77({ pitch: { ...source, batter: { ...source.batter, battingSetupV94 } } });
  expect(result.metrics.battingSetupV94).toEqual(result.pitch.diagnostics.battingSetupV94);
  expect(result.metrics.strikeZoneVolumeV94).toEqual(result.pitch.diagnostics.strikeZoneVolumeV94);
  expect(result.metrics.strikeZone).toEqual(result.pitch.diagnostics.strikeZone);
  expect(result.metrics.platePosition.z).toBeCloseTo(.4318, 8);
});

it('accepts old roster JSON without writing new fields and validates explicitly saved setup atomically', () => {
  const players = [{ playerId: 'B', name: 'Batter', heightMeters: 1.8, bats: 'R' as const }], old = {
    version: 'live_physical_roster_v1', sourceId: 'v94-compat', entries: [{ playerId: 'B', sourceId: 'source', physical: { basis: 'EXPLICIT_AUTHORED_SI_V1' } }] },
    before = JSON.stringify(old), projected = applyLivePhysicalRosterV1({ players, roster: old });
  expect(projected.players[0].physical).not.toHaveProperty('battingSetupV94'); expect(JSON.stringify(old)).toBe(before);
  const battingSetupV94 = { boxPosition: 'back', normalPose: { shoulderTopRatio: .69, uniformPantsTopRatio: .43, kneecapBottomRatio: .24 } },
    packet = { ...old, entries: [{ ...old.entries[0], physical: { ...old.entries[0].physical, battingSetupV94 } }] }, snapshot = JSON.stringify(packet),
    updated = applyLivePhysicalRosterV1({ players, roster: packet });
  expect(updated.players[0].physical.battingSetupV94).toEqual(battingSetupV94); expect(JSON.stringify(packet)).toBe(snapshot);
  expect(() => applyLivePhysicalRosterV1({ players, roster: { ...packet, entries: [{ ...packet.entries[0], physical: { ...packet.entries[0].physical,
    battingSetupV94: { ...battingSetupV94, normalPose: { shoulderTopRatio: .4, uniformPantsTopRatio: .5, kneecapBottomRatio: .2 } } } }] } })).toThrow();
  expect(JSON.stringify(packet)).toBe(snapshot);
});

it('resolves ordinary taken trials across movement levels 0–7, four pitch types, body heights and both sides', () => {
  for (let level = 0; level <= 7; level++) {
    const source = input(level % 2 ? 'L' : 'R'), throws = level % 2 ? 'L' as const : 'R' as const,
      presetId = ['slider', 'curve', 'sinker', 'changeup'][level % 4],
      snapshot = setPitchMovementLevelV92({ pitch: createPitchSnapshotFromPresetV78({ presetId, pitchId: 'v94-trial', physical: source.pitcher, throws }), level }),
      result = simulateLivePitchV1({ ...source, seed: level + 1, batting: 'take', pitchType: snapshot.pitchType, pitchId: snapshot.pitchId,
        batter: { ...source.batter, heightMeters: level % 2 ? 1.65 : 1.95, battingSetupV94: { boxPosition: (['back', 'middle', 'front'] as const)[level % 3] } },
        pitcher: { ...source.pitcher, throws, pitchRepertoireV78: { version: 'pitch_repertoire_v78', pitches: [snapshot] } } });
    expect(result.diagnostics.officialStrikeZoneContactV94?.kind, presetId + ' level ' + level).not.toBe('unresolved');
    expect(result.diagnostics.unsupportedReason, presetId + ' level ' + level).toBeNull();
    expect(['called_strike', 'ball']).toContain(result.call);
  }
});
