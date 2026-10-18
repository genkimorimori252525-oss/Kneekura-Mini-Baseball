import { expect, it } from 'vitest';
import { createLiveBaseballMatchV1, LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, LIVE_MATCH_PHYSICS_V1,
  type LiveIssuedPitchV1, type LiveMatchInputV1, type LivePitchCommandV1 } from './LiveBaseballMatchV1';
import { simulateLivePitchV1, type LivePitchInputV1 } from './LivePitchV1';
import type { LiveTraitProfileV1 } from './LiveTraitProfilesV1';
import { liveMatchFixture } from './LiveBaseballMatchV1.test-support';

type SwingMode = 'POWER' | 'BALANCED' | 'CONTACT';
type PitchApproach = 'FASTBALL' | 'BALANCED' | 'BREAKING';
const profile = (familyId: string, stateId: string | null): LiveTraitProfileV1 => ({ version: 'live_trait_profile_v1',
  selections: [{ familyId, stateId, source: {} }] } as unknown as LiveTraitProfileV1);
const command = (batting: LivePitchCommandV1['batting'], managedTeam: 0 | 1 = 0): LivePitchCommandV1 =>
  ({ batting, pitchType: 'auto', location: 'auto', managedTeam });
const matchInput = (side: 'R' | 'L' = 'R'): LiveMatchInputV1 => {
  const raw = liveMatchFixture(1234);
  return { ...raw, players: raw.players.map(p => ({ ...p, bats: side, throws: side, physical: { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,
    technicalTimingOffsetSeconds: .3, timingStdSeconds: 0, aimStdMeters: 0 } })) };
};
const withTrait = (input: LiveMatchInputV1, playerId: string, trait: LiveTraitProfileV1): LiveMatchInputV1 =>
  ({ ...input, players: input.players.map(p => p.playerId === playerId ? { ...p, traitProfile: trait } : p) });
const diagnosticsWithoutPreferences = (value: unknown) => {
  const { traitPreferences: _host, pitchPreference: _pitch, managerBaserunning: _manager, ...old } = value as Record<string, unknown>;
  return old;
};
const source = (r: LiveIssuedPitchV1) => ({ ...r, command: undefined,
  play: { ...r.play, diagnostics: diagnosticsWithoutPreferences(r.play.diagnostics) } });
const pitchInput = (seed = 1, side: 'R' | 'L' = 'R'): LivePitchInputV1 => ({ originTick: 1_000_000, seed,
  batter: { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, heightMeters: 1.8, bats: side },
  pitcher: { releaseSpeedMps: 42.5, spinRadPerSecond: { x: -230, y: 15, z: 10 }, commandStdMeters: .11, throws: side },
  measuredClips: liveMatchFixture().measuredClips, batting: 'take', pitchType: 'auto', location: 'auto', physics: LIVE_MATCH_PHYSICS_V1 });
const pitchSource = (r: ReturnType<typeof simulateLivePitchV1>) => ({ ...r, sampleBatAtTick: undefined,
  diagnostics: diagnosticsWithoutPreferences(r.diagnostics) });

it('keeps omitted, neutral and BALANCED preferences exactly equivalent under old commands', () => {
  const raw = matchInput(), expected = createLiveBaseballMatchV1(raw).issuePitch(command('balanced'));
  for (const family of ['swing_mode_preference', 'pitch_approach']) for (const state of [null, 'BALANCED']) {
    const id = family === 'pitch_approach' ? '1-p0' : '0-b0', actual =
      createLiveBaseballMatchV1(withTrait(raw, id, profile(family, state))).issuePitch(command('balanced'));
    expect(actual).toEqual(expected);
  }
  const auto = createLiveBaseballMatchV1(raw).issuePitch(command('auto'));
  expect(source(auto)).toEqual(source(expected));
});

it.each(['R', 'L'] as const)('executes personal POWER/CONTACT through the existing real bat motor for %s', side => {
  const raw = matchInput(side), balanced = createLiveBaseballMatchV1(raw).issuePitch(command('balanced'));
  for (const mode of ['POWER', 'CONTACT'] as SwingMode[]) {
    const changed = withTrait(raw, '0-b0', profile('swing_mode_preference', mode)), actual =
      createLiveBaseballMatchV1(changed).issuePitch(command('auto')), expected =
      createLiveBaseballMatchV1(raw).issuePitch(command(mode === 'POWER' ? 'power' : 'contact'));
    expect(source(actual)).toEqual(source(expected));
    expect(actual.frames.map(f => f.bat)).not.toEqual(balanced.frames.map(f => f.bat));
    expect(actual.play.diagnostics).toMatchObject({ playbackRate: mode === 'POWER' ? 1.08 : .92,
      traitPreferences: { batting: { preference: mode, resolvedCommand: mode === 'POWER' ? 'power' : 'contact', source: 'player_preference' } } });
  }
});

it.each(['balanced', 'contact', 'power', 'take', 'bunt'] as const)('lets explicit %s override a personal swing preference', batting => {
  const raw = matchInput(), actual = createLiveBaseballMatchV1(withTrait(raw, '0-b0', profile('swing_mode_preference', 'POWER')))
    .issuePitch(command(batting)), expected = createLiveBaseballMatchV1(raw).issuePitch(command(batting));
  expect(source(actual)).toEqual(source(expected));
  expect(actual.play.diagnostics).toMatchObject({ traitPreferences: { batting: { resolvedCommand: batting,
    source: 'manager_command', overrideReason: 'explicit_manager_batting' } } });
});

it('uses the actual unmanaged batter preference instead of the other club manager command', () => {
  const raw = matchInput('L'), actual = createLiveBaseballMatchV1(withTrait(raw, '0-b0', profile('swing_mode_preference', 'CONTACT')))
    .issuePitch(command('take', 1)), expected = createLiveBaseballMatchV1(raw).issuePitch(command('contact'));
  expect(source(actual)).toEqual(source(expected));
  expect(actual.play.diagnostics).toMatchObject({ traitPreferences: { batting: { source: 'player_preference', overrideReason: 'unmanaged_offense' } } });
});

it('resolves only the actual pitcher profile and preserves the managed/unmanaged auto pitch Source', () => {
  const raw = matchInput(), actualPitcher = withTrait(raw, '1-p0', profile('pitch_approach', 'FASTBALL')),
    offenseManaged = createLiveBaseballMatchV1(actualPitcher).issuePitch(command('auto')),
    defenseManaged = createLiveBaseballMatchV1(actualPitcher).issuePitch(command('balanced', 1));
  expect(source(offenseManaged)).toEqual(source(defenseManaged));
  expect(offenseManaged.play.diagnostics).toMatchObject({ traitPreferences: { pitching: { preference: 'FASTBALL', source: 'player_preference' } } });
  expect(createLiveBaseballMatchV1(withTrait(raw, '0-p0', profile('pitch_approach', 'FASTBALL'))).issuePitch(command('balanced')))
    .toEqual(createLiveBaseballMatchV1(raw).issuePitch(command('balanced')));
});

it('uses the new current batter after the inning changes and keeps an inactive player preference out of earlier Sources', () => {
  const raw = matchInput('L'), host = createLiveBaseballMatchV1(withTrait(raw, '1-b0', profile('swing_mode_preference', 'CONTACT'))),
    neutral = createLiveBaseballMatchV1(raw);
  let pitches = 0;
  while (host.inspect().match.half === 'top' && pitches++ < 80)
    expect(host.issuePitch(command('take'))).toEqual(neutral.issuePitch(command('take')));
  expect(host.inspect().match.half).toBe('bottom');
  const actual = host.issuePitch(command('power')), expected = neutral.issuePitch(command('contact', 1));
  expect(actual.batterPlayerId).toBe('1-b0'); expect(source(actual)).toEqual(source(expected));
  expect(actual.play.diagnostics).toMatchObject({ traitPreferences: { batting: { preference: 'CONTACT', source: 'player_preference' } } });
}, 20_000);

it('lets every explicit manager pitch override both pitcher preferences in the Host', () => {
  const raw = matchInput();
  for (const pitchType of ['fastball', 'slider', 'curve', 'changeup', 'cutter', 'sinker', 'splitter']) {
    const issuedCommand = { ...command('balanced', 1), pitchType, location: 'zone' }, expected =
      createLiveBaseballMatchV1(raw).issuePitch(issuedCommand);
    for (const approach of ['FASTBALL', 'BREAKING']) {
      const actual = createLiveBaseballMatchV1(withTrait(raw, '1-p0', profile('pitch_approach', approach))).issuePitch(issuedCommand);
      expect(source(actual)).toEqual(source(expected));
      expect(actual.play.diagnostics).toMatchObject({ traitPreferences: { pitching: { preference: approach,
        pitchTypeCommand: pitchType, source: 'manager_command', overrideReason: 'explicit_manager_pitch' } } });
    }
  }
});

it('keeps BALANCED auto and every explicit pitch exactly equal, including RNG-dependent Source and controls', () => {
  for (const side of ['R', 'L'] as const) {
    const raw = pitchInput(7, side), plain = simulateLivePitchV1(raw), balanced =
      simulateLivePitchV1({ ...raw, pitcher: { ...raw.pitcher, pitchApproach: 'BALANCED' } });
    expect(pitchSource(balanced)).toEqual(pitchSource(plain));
    for (const pitchType of ['fastball', 'slider', 'curve', 'changeup', 'cutter', 'sinker', 'splitter']) {
      const explicit = simulateLivePitchV1({ ...raw, pitchType });
      for (const pitchApproach of ['FASTBALL', 'BREAKING'] as PitchApproach[])
        expect(pitchSource(simulateLivePitchV1({ ...raw, pitchType, pitcher: { ...raw.pitcher, pitchApproach } }))).toEqual(pitchSource(explicit));
    }
  }
});

it('changes only auto pitch selection weights, with the same downstream draw stream when a type is unchanged', () => {
  const counts: Record<PitchApproach, number> = { BALANCED: 0, FASTBALL: 0, BREAKING: 0 };
  let matchingTypes = 0;
  for (let seed = 0; seed < 64; seed++) {
    const raw = pitchInput(seed), baseline = simulateLivePitchV1(raw);
    if (baseline.pitchType === 'fastball') counts.BALANCED++;
    for (const pitchApproach of ['FASTBALL', 'BREAKING'] as const) {
      const actual = simulateLivePitchV1({ ...raw, pitcher: { ...raw.pitcher, pitchApproach } });
      expect(actual.diagnostics.pitchPreference).toMatchObject({ preference: pitchApproach,
        weights: pitchApproach === 'FASTBALL' ? [7, 1, 1, 1] : [1, 3, 3, 3] });
      if (actual.pitchType === 'fastball') counts[pitchApproach]++;
      expect(actual.diagnostics.individualControls).toEqual(baseline.diagnostics.individualControls);
      if (actual.pitchType === baseline.pitchType) { matchingTypes++; expect(pitchSource(actual)).toEqual(pitchSource(baseline)); }
    }
  }
  // A deterministic Source replay for these 64 seeds, not a claimed real-world pitch distribution.
  expect(counts).toEqual({ BALANCED: 21, FASTBALL: 42, BREAKING: 12 });
  expect(matchingTypes).toBeGreaterThan(0);
}, 30_000);
