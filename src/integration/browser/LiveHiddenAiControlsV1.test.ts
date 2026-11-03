import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import * as livePitch from './LivePitchV1';
import * as liveField from '../../core/sim/fielding/LiveFieldPlayV1';
import { IDENTITY_QUATERNION } from '../../core/sim/pitching/BaseballOrientation';
import { createLiveBaseballMatchV1, LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1 } from './LiveBaseballMatchV1';
import { liveMatchFixture } from './LiveBaseballMatchV1.test-support';
import { applyLivePhysicalRosterV1, type LivePhysicalRosterInputV1 } from './LivePhysicalRosterV1';
import { editLivePublicAbilityV1, projectLivePublicAbilitiesV1, type LivePublicAbilityReferenceV1 } from './LivePublicAbilitiesV1';

it.each([false, true])('passes tactical controls for the batter, existing runners and every defender (explicit=%s)', explicit => {
  const fixture = liveMatchFixture(), battingOrder = fixture.teams[0].battingOrder,
    projection = applyLivePhysicalRosterV1({ players: fixture.players, roster: { version: 'live_physical_roster_v1', sourceId: 'tactics-test',
      entries: fixture.players.map((p, i) => ({ playerId: p.playerId, sourceId: 'individual-tactics', physical: {
        basis: 'EXPLICIT_AUTHORED_SI_V1', accelerationMps2: 3 + i / 10,
        ...(explicit ? { baserunningSafetyMarginSeconds: i / 10, fieldingPursuitCostWeight: .5 + i / 10,
          defensiveDecisionSeconds: i / 100, baserunningTurnRadiusMeters: 2 + i / 10, baserunningLateralAccelerationMps2: 6 + i / 10 } : {}) } })) } }),
    input = { ...fixture, players: projection.players }, before = JSON.stringify(input), host = createLiveBaseballMatchV1(input),
    command = { batting: 'take' as const, managedTeam: 0 as const, pitchType: 'auto', location: 'auto' },
    stoppedAtFieldBoundary = new Error('captured field input');
  let syntheticPitches = 0;
  const pitchSpy = vi.spyOn(livePitch, 'simulateLivePitchV1').mockImplementation(p => {
    const ball = { tick: p.originTick, elapsedSeconds: 0, ball: { position: { x: 0, y: 1, z: 0 },
      velocity: { x: 0, y: 0, z: 10 }, spin: { x: 0, y: 0, z: 0 } } };
    // Three synthetic walks load the bases; only the Host-to-Core boundary is under test.
    return { frames: [], contact: syntheticPitches++ >= 12 ? { exitVelocity: ball.ball.velocity, exitSpin: ball.ball.spin } : null,
      contactMoment: ball, contactOrientation: IDENTITY_QUATERNION, call: 'ball', endedAtTick: p.originTick + 1,
      pitchType: 'fastball', speedKmh: 100, sampleBatAtTick: () => null, diagnostics: {} } as unknown as ReturnType<typeof livePitch.simulateLivePitchV1>;
  });
  const fieldSpy = vi.spyOn(liveField, 'simulateLiveFieldPlayV1').mockImplementation(() => { throw stoppedAtFieldBoundary; });
  try {
    for (let i = 0; i < 12; i++) host.issuePitch(command);
    expect(host.inspect().match.bases).toEqual({ first: battingOrder[2], second: battingOrder[1], third: battingOrder[0] });
    expect(() => host.issuePitch(command)).toThrow(stoppedAtFieldBoundary);
    const fieldInput = fieldSpy.mock.calls[0][0];
    expect(fieldInput.runners.map(r => [r.runnerId, r.initialBase])).toEqual([
      [battingOrder[3], 0], [battingOrder[2], 1], [battingOrder[1], 2], [battingOrder[0], 3],
    ]);
    for (const runner of fieldInput.runners) {
      const physical = projection.players.find(p => p.playerId === runner.runnerId)!.physical;
      expect(runner.advanceSafetyMarginSeconds).toBe(physical.baserunningSafetyMarginSeconds ?? .35);
      expect(runner.topSpeedMps).toBe(physical.topSpeedMps);
      expect(runner.roundingRadiusMeters).toBe(physical.baserunningTurnRadiusMeters ?? 4.5);
      expect(runner.lateralAccelerationMps2).toBe(physical.baserunningLateralAccelerationMps2 ?? 1.5 * physical.accelerationMps2);
    }
    expect(fieldInput.fielders).toHaveLength(9);
    for (const fielder of fieldInput.fielders) {
      const physical = projection.players.find(p => p.playerId === fielder.playerId)!.physical;
      expect(fielder.fieldingCognition).toEqual({ decisionSeconds: physical.defensiveDecisionSeconds ?? 0, pursuitCostWeight: physical.fieldingPursuitCostWeight ?? 1 });
      expect(fielder.topSpeedMps).toBe(physical.topSpeedMps);
      expect(fielder.throwSpeedMps).toBe(physical.throwSpeedMps);
    }
    expect(JSON.stringify(input)).toBe(before);
  } finally { pitchSpy.mockRestore(); fieldSpy.mockRestore(); }
});

it('exposes hidden maker defaults without adding public abilities or changing public SI projection', () => {
  const load = <T>(name: string): T => JSON.parse(readFileSync(new URL('../../../docs/demos/' + name, import.meta.url), 'utf8')) as T;
  const catalog = load<{ fields: { path: string; min?: number; max?: number; default?: number; defaultFrom?: string; defaultScale?: number; note?: string }[] }>('live-game-roster-catalog-v2.json'),
    roster = load<LivePhysicalRosterInputV1>('live-game-roster-v2.json'), reference = load<LivePublicAbilityReferenceV1>('live-public-ability-reference-v1.json'),
    playerId = roster.entries[0].playerId, original = projectLivePublicAbilitiesV1({ roster, reference, playerId }),
    edited = { ...roster, entries: roster.entries.map((entry, i) => i ? entry : { ...entry, physical: {
      ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, ...entry.physical, baserunningSafetyMarginSeconds: 1.5, fieldingPursuitCostWeight: .25,
      baserunningTurnRadiusMeters: 3.2, baserunningLateralAccelerationMps2: 8.4 } }) };
  expect(catalog.fields.find(f => f.path === 'baserunningSafetyMarginSeconds')).toMatchObject({ min: 0, max: 3, default: .35 });
  expect(catalog.fields.find(f => f.path === 'fieldingPursuitCostWeight')).toMatchObject({ min: .25, max: 4, default: 1 });
  expect(catalog.fields.find(f => f.path === 'baserunningTurnRadiusMeters')).toMatchObject({ min: .5, max: 10, default: 4.5 });
  expect(catalog.fields.find(f => f.path === 'baserunningLateralAccelerationMps2')).toMatchObject({ min: .5, max: 20, defaultFrom: 'accelerationMps2', defaultScale: 1.5 });
  expect(catalog.fields).toHaveLength(44);
  expect(original.abilities).toHaveLength(10);
  expect(original.abilities.map(a => a.id)).not.toContain('badBallControl');
  expect(projectLivePublicAbilitiesV1({ roster: edited, reference, playerId }).abilities).toEqual(original.abilities);
  for (const abilityId of ['run', 'field', 'arm']) {
    const value = original.abilities.find(a => a.id === abilityId)!.value,
      publicEdit = editLivePublicAbilityV1({ roster: edited, reference, playerId, abilityId, value: value > 98 ? value - 1 : value + 1 });
    expect(publicEdit.roster.entries[0].physical).toMatchObject({ baserunningSafetyMarginSeconds: 1.5, fieldingPursuitCostWeight: .25,
      baserunningTurnRadiusMeters: 3.2, baserunningLateralAccelerationMps2: 8.4 });
    expect(publicEdit.changes.every(c => !['baserunningSafetyMarginSeconds', 'fieldingPursuitCostWeight',
      'baserunningTurnRadiusMeters', 'baserunningLateralAccelerationMps2'].includes(c.path))).toBe(true);
  }
  expect(roster.entries.every(entry => entry.physical?.baserunningSafetyMarginSeconds === undefined && entry.physical?.fieldingPursuitCostWeight === undefined)).toBe(true);
  const running = original.abilities.find(a => a.id === 'run')!, runEdit = editLivePublicAbilityV1({ roster, reference, playerId, abilityId: 'run', value: running.value + (running.value > 98 ? -1 : 1) });
  expect(runEdit.roster.entries[0].physical).not.toHaveProperty('baserunningLateralAccelerationMps2');
  expect(runEdit.roster.entries[0].physical!.accelerationMps2).not.toBe(roster.entries[0].physical!.accelerationMps2);
  expect(roster.entries.every(entry => entry.physical?.baserunningTurnRadiusMeters === undefined && entry.physical?.baserunningLateralAccelerationMps2 === undefined)).toBe(true);
});
