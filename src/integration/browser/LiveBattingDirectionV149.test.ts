import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { simulateLivePitchV1, type LivePitchInputV1, type LiveMeasuredClipV1 } from './LivePitchV1';
import { createLiveBaseballMatchV1, LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, LIVE_MATCH_PHYSICS_V1, type LiveTeamV1 } from './LiveBaseballMatchV1';
import { createNeutralBatterCourseProfileV79 } from './BatterCourseProfileV79';
import { compareMeasuredTrajectoriesV69 } from './MeasuredTrajectoryComparisonWorkbenchV69';

const clips = JSON.parse(readFileSync(new URL('../../../docs/demos/measured-bat-motions.json', import.meta.url), 'utf8')).clips as LiveMeasuredClipV1[];
const source = (): LivePitchInputV1 => {
  const clip = clips.find(c => c.side === 'L')!;
  return { originTick: 1000000, seed: 20261019, batter: { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,
    heightMeters: 1.8, bats: 'L', clipId: clip.id, maximumSweetSpotSpeedMps: 50, targetSweetSpotSpeedMps: 30,
    motorLatencySeconds: .04, pullAngleDegrees: -3, timingStdSeconds: .009, aimStdMeters: .022,
    swingDecision: { approach: 'SWING', threshold: .5, aggressionWeight: .5 } },
    pitcher: { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, commandStdMeters: .05 }, measuredClips: [clip],
    batting: 'balanced', pitchType: 'fastball', location: 'inside', physics: LIVE_MATCH_PHYSICS_V1 };
};
const request = (mode: 'AUTO' | 'PULL' | 'CENTER' | 'OPPOSITE') => ({
  version: 'batting_direction_request_v149' as const, sourceId: 'practice-direction', mode });
const profile = { version: 'batter_approach_v122' as const, sourceId: 'authored-opposite', priorReliance: 0,
  directionCommitment: 1, twoStrikeCommitmentDelta: 0, preferredWhenCommitted: { pull: 0, center: 0, opposite: 1 },
  targetPullAnglesDegrees: { pull: 25, center: 0, opposite: -25 } };

it('keeps pitch, perception and execution error streams fixed when only the direction request changes', () => {
  const input = source(), before = JSON.stringify(input), legacy = simulateLivePitchV1(input);
  for (const mode of ['AUTO', 'PULL', 'CENTER', 'OPPOSITE'] as const) {
    const r = simulateLivePitchV1({ ...input, battingDirectionRequestV149: request(mode) });
    expect(r.diagnostics.sourceDescriptor).toEqual(legacy.diagnostics.sourceDescriptor);
    expect(r.diagnostics.zoneJudgment).toEqual(legacy.diagnostics.zoneJudgment);
    expect(r.diagnostics.timingErrorSeconds).toBe(legacy.diagnostics.timingErrorSeconds);
    expect(r.diagnostics.aimErrorMeters).toEqual(legacy.diagnostics.aimErrorMeters);
    expect(r.diagnostics.sweetSpotT).toBe(legacy.diagnostics.sweetSpotT);
    expect(r.diagnostics.battingDirectionV149!.postContactResultOverride).toBe(false);
  }
  expect(JSON.stringify(input)).toBe(before);
  expect(legacy.diagnostics).not.toHaveProperty('battingDirectionV149');
});

it('does not use the old saved pull angle as the fallback AUTO direction', () => {
  const input = source(), a = simulateLivePitchV1({ ...input, battingDirectionRequestV149: request('AUTO') }),
    b = simulateLivePitchV1({ ...input, batter: { ...input.batter, pullAngleDegrees: 37 }, battingDirectionRequestV149: request('AUTO') });
  expect(a.diagnostics.battingDirectionV149).toMatchObject({ owner: 'OBSERVATION_RESPONSE',
    reason: 'NO_AUTHORED_DIRECTION_PREFERENCE', direction: { kind: 'REACTIVE', pullAngleDegrees: null } });
  expect(a.frames).toEqual(b.frames); expect(a.contact).toEqual(b.contact);
  expect(a.diagnostics.referenceContactSweetSpotVelocity).toEqual(b.diagnostics.referenceContactSweetSpotVelocity);
});

it('keeps the authored policy on AUTO and makes a temporary opposite-policy manual override reach the motor', () => {
  const input = source(), authored = { ...input, batter: { ...input.batter, batterApproachV122: profile } }, before = JSON.stringify(authored),
    normal = simulateLivePitchV1(authored), auto = simulateLivePitchV1({ ...authored, battingDirectionRequestV149: request('AUTO') }),
    pull = simulateLivePitchV1({ ...authored, battingDirectionRequestV149: request('PULL') });
  expect(auto.frames).toEqual(normal.frames); expect(auto.contact).toEqual(normal.contact);
  expect(pull.diagnostics.battingDirectionV149!.direction.aim).toBe('PULL');
  expect(pull.diagnostics.referenceContactSweetSpotVelocity).not.toEqual(auto.diagnostics.referenceContactSweetSpotVelocity);
  expect(JSON.stringify(authored)).toBe(before);
});

it('retains the old five-sector prior on AUTO instead of turning it into equal three-direction weights', () => {
  const input = source(), b = { ...input.batter, batterCourseProfileV79: { ...createNeutralBatterCourseProfileV79(), directionWeights: [0, 0, 0, 0, 1] } },
    r = simulateLivePitchV1({ ...input, batter: b, battingDirectionRequestV149: request('AUTO') });
  expect(r.diagnostics.battingDirectionV149).toMatchObject({ owner: 'LEGACY_DIRECTION_DISTRIBUTION',
    direction: { kind: 'LEGACY_SECTOR', fieldAngleDegrees: 36 } });
  expect(r.diagnostics.courseV79!.directionIntent!.sectorIndex).toBe(4);
});

it('uses exactly the same direction decision for all four trajectory levels and reproduces the fixed seed', () => {
  const pitch = { ...source(), battingDirectionRequestV149: request('AUTO') },
    comparison = compareMeasuredTrajectoriesV69({ pitch, afterContactSeconds: .1 });
  for (const row of comparison.cases) expect(row.pitch.diagnostics.battingDirectionV149).toEqual(comparison.cases[0].pitch.diagnostics.battingDirectionV149);
  const a = simulateLivePitchV1(pitch), b = simulateLivePitchV1(pitch);
  expect(a.diagnostics).toEqual(b.diagnostics); expect(a.frames).toEqual(b.frames);
});

it('uses the same one-pitch request in the match Host and ignores an opponent manager direction', () => {
  const input = source(), roles = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'],
    team = (t: number): LiveTeamV1 => ({ id: 't' + t, name: 'T' + t, battingOrder: Array.from({ length: 9 }, (_, i) => t + '-b' + i),
      pitcherId: t + '-p0', defense: Object.fromEntries(roles.map((r, i) => [r, i ? t + '-b' + (i - 1) : t + '-p0'])) as LiveTeamV1['defense'] }),
    teams = [team(0), team(1)] as const,
    players = [0, 1].flatMap(t => [...Array.from({ length: 9 }, (_, i) => t + '-b' + i), t + '-p0'].map(playerId => ({
      playerId, name: 'test', heightMeters: 1.8, bats: 'L' as const,
      physical: { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, clipId: input.batter.clipId, swingDecision: { approach: 'TAKE' as const, threshold: 1, aggressionWeight: 0 } } }))),
    configuration = { seed: 3, innings: 1, teams, players, measuredClips: input.measuredClips },
    command = { batting: 'take' as const, pitchType: 'fastball', location: 'zone', battingDirectionRequestV149: request('PULL') },
    a = createLiveBaseballMatchV1(configuration).issuePitch({ ...command, managedTeam: 0 }),
    b = createLiveBaseballMatchV1(configuration).issuePitch({ ...command, managedTeam: 1 });
  expect(a.play.diagnostics).toMatchObject({ battingDirectionV149: { owner: 'TEMPORARY_REQUEST', direction: { aim: 'PULL' } } });
  expect(b.play.diagnostics).not.toHaveProperty('battingDirectionV149');
});
