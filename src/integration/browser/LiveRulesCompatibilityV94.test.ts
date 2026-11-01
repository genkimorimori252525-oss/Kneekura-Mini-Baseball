import { expect, it } from 'vitest';
import { createLiveBaseballMatchV1, LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, type LivePlayerV1 } from './LiveBaseballMatchV1';
import { liveMatchFixture } from './LiveBaseballMatchV1.test-support';
import { createLiveGameStatisticsV79, summarizeLiveIssuedPitchV79, validateLiveGameStatisticsV79 } from './LiveCourseScoringV79';
import { scoringPitchV79, scoringPlayersV79, gameV79 } from './LiveCourseScoringV79.test-support';
import { resolveLiveBattingSetupV94 } from '../../core/sim/pitching/BattingSetupV94';
import type { simulateLivePitchV1 } from './LivePitchV1';

it('retains old plane and absent anatomy fields when importing historical season games', () => {
  const old = gameV79(), text = JSON.stringify(old), restored = validateLiveGameStatisticsV79(JSON.parse(text));
  expect(JSON.stringify(restored)).toBe(text);
  expect(restored.records[0].course.planeZ).toBe(.15);
  expect(restored.players.every(p => !Object.hasOwn(p, 'battingSetupV94'))).toBe(true);
});

it('stores new front-face observations with authored anatomy and validates them on JSON import', () => {
  const battingSetupV94 = { boxPosition: 'back' as const,
    normalPose: { shoulderTopRatio: .7, uniformPantsTopRatio: .45, kneecapBottomRatio: .25 } },
    setup = resolveLiveBattingSetupV94({ heightMeters: 1.8, bats: 'R', battingSetupV94 }),
    old = scoringPitchV79('home_run'),
    pitch = { ...old, play: { ...old.play, diagnostics: { ...(old.play.diagnostics as Record<string, unknown>), battingSetupV94: setup } } },
    record = summarizeLiveIssuedPitchV79(pitch),
    players = scoringPlayersV79.map(p => p.playerId === 'b' ? { ...p, physical: { battingSetupV94 } } : p) as LivePlayerV1[],
    game = createLiveGameStatisticsV79({ gameId: 'v94-zone', seed: 1, players, records: [record], finished: true });
  expect(record.course.planeZ).toBe(.4318);
  expect(record.course.crossingElapsedSeconds).toBeLessThan(summarizeLiveIssuedPitchV79(old).course.crossingElapsedSeconds!);
  expect(game.records[0].course.zone).toEqual(setup.region);
  expect(game.players[0].battingSetupV94).toEqual(battingSetupV94);
  expect(validateLiveGameStatisticsV79(JSON.parse(JSON.stringify(game)))).toEqual(game);
  const unknownPlane = structuredClone(game); (unknownPlane.records[0].course as { planeZ: number }).planeZ = .3;
  expect(() => validateLiveGameStatisticsV79(unknownPlane)).toThrow('invalid course provenance');
  const invalidPose = structuredClone(game); (invalidPose.players[0].battingSetupV94!.normalPose! as { kneecapBottomRatio: number }).kneecapBottomRatio = .8;
  expect(() => validateLiveGameStatisticsV79(invalidPose)).toThrow();
});

it('starts the Host actor and every pitch frame at the same legal authored body position for both hands', () => {
  for (const bats of ['R', 'L'] as const) for (const boxPosition of ['back', 'middle', 'front'] as const) {
    const fixture = liveMatchFixture(3), battingSetupV94 = { boxPosition },
      players = fixture.players.map(p => p.playerId === '0-b0' ? { ...p, bats, physical: { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, basis: 'EXPLICIT_AUTHORED_SI_V1' as const, battingSetupV94 } } : p),
      host = createLiveBaseballMatchV1({ ...fixture, players }),
      setup = resolveLiveBattingSetupV94({ heightMeters: 1.8, bats, battingSetupV94 }),
      actor = host.inspect().frame.actors.find(a => a.role === 'batter')!,
      record = host.issuePitch({ batting: 'take', pitchType: 'fastball', location: 'zone', managedTeam: 0 });
    expect(actor.position).toEqual(setup.bodyPosition);
    expect(record.frames.length).toBeGreaterThan(1);
    expect(record.frames.every(f => f.actors.find(a => a.role === 'batter')?.position.z === setup.bodyZ)).toBe(true);
    const diagnostic = record.play.diagnostics as ReturnType<typeof simulateLivePitchV1>['diagnostics'];
    expect(diagnostic.battingSetupV94).toEqual(setup);
    expect(diagnostic.strikeZoneVolumeV94.platePolygon).toEqual(setup.volume.platePolygon);
  }
});

it('rejects invalid setup on a later batter before constructing a match', () => {
  const fixture = liveMatchFixture(), players = fixture.players.map(p => p.playerId === '0-b8'
    ? { ...p, physical: { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, basis: 'EXPLICIT_AUTHORED_SI_V1' as const,
      battingSetupV94: { footSeparationMeters: 1.5, strideMeters: .6 } } } : p);
  expect(() => createLiveBaseballMatchV1({ ...fixture, players })).toThrow('cannot fit');
});
