import { expect, it } from 'vitest';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../ball/BaseballAerodynamics';
import { simulateLiveFieldPlayV1, type LiveFieldPlayInputV1 } from './LiveFieldPlayV1';
import { planLiveThrowV1 } from './LiveThrowPlanV1';
const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const fixture = (): LiveFieldPlayInputV1 => ({
  ball: { originTick: 100000, elapsedSeconds: .123456789, ball: { tick: 223457, position: v(0, .2, 0), velocity: v(1, -1, 5), spin: v() } },
  physics: { kind: 'aero_ground_v1', air: { ticksPerSecond: 1e6, integrationStepTicks: 4000, gravityY: -9.81,
    aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS }, ground: { ticksPerSecond: 1e6, gravityMps2: 9.81,
    radiusM: .0366, inertiaRatio: .378, restingVerticalSpeedMps: .15,
    material: { restitution: .4, slidingFriction: .25, rollingDecelerationMps2: 1, normalSpinDecayPerSecond: .5 } } },
  field: { bases: { home: v(), first: v(19.39, 0, 19.39), second: v(0, 0, 38.78), third: v(-19.39, 0, 19.39) }, fenceRadiusMeters: 110, fenceHeightMeters: 2 },
  fielders: [v(0, 1, 10), v(0, 1, -2), v(20, 1, 20), v(-20, 1, 20), v(12, 1, 35), v(-12, 1, 35), v(-35, 1, 65), v(0, 1, 75), v(35, 1, 65)]
    .map((position, i) => ({ playerId: 'defender-' + i, position, reactionSeconds: .08, topSpeedMps: 7, accelerationMps2: 6,
      gloveSpeedMps: 6, gloveReachMeters: 1.3, gloveRadiusMeters: .1, transferSeconds: .25, throwSpeedMps: 32,
      catchRetention: { ticksPerSecond: 1e6, ballMassKg: .145, ballRadiusMeters: .0366, pocketRadiusMeters: .3,
        centerRetentionCapacityJ: 150, captureDissipationPowerW: 3000, failedContactRestitution: .2, failedTangentialDamping: .4, failedSpinDamping: .2 } })),
  runners: [{ runnerId: 'batter', initialBase: 0, topSpeedMps: 8, accelerationMps2: 5, reactionSeconds: .1 }], outs: 0, maxPlaySeconds: 30,
});

const deepRelayInput = (holderThrowSpeedMps = 16): LiveFieldPlayInputV1 => {
  const raw = fixture(); return { ...raw,
    ball: { ...raw.ball, ball: { ...raw.ball.ball, position: v(0, .2, 90), velocity: v(0, -1, .1) } },
    fielders: raw.fielders.map((f, i) => ({ ...f, reactionSeconds: .01, gloveSpeedMps: 11, throwBackspinRadPerSecond: 120,
      position: i === 7 ? v(0, 1, 90) : i === 6 ? v(0, 1, 70) : f.position, throwSpeedMps: i === 7 ? holderThrowSpeedMps : 38 })),
    runners: [{ ...raw.runners[0], topSpeedMps: 12 }, ...([1, 2, 3] as const).map(initialBase => ({
      runnerId: 'runner-' + initialBase, initialBase, topSpeedMps: initialBase === 3 ? 3 : 12, accelerationMps2: 5, reactionSeconds: .1 }))], maxPlaySeconds: 25,
  };
};

it('makes two actual throws with a secured relay, a new transfer and actual final base control', () => {
  const raw = deepRelayInput(), before = JSON.stringify(raw), result = simulateLiveFieldPlayV1(raw),
    releases = result.facts.filter(f => f.kind === 'throw_release'), secured = result.facts.filter(f => f.kind === 'catch_secured');
  expect(result.end.complete).toBe(true); expect(result.diagnostics.unresolvedDetail).toBeNull();
  expect(releases.map(f => [f.playerId, f.receiverPlayerId])).toEqual([['defender-7', 'defender-6'], ['defender-6', 'defender-1']]);
  expect(releases[0].reason).toBe('relay_play'); expect(releases[1].reason).toBe('force_play');
  expect(releases.every(f => f.base === 4 && f.runnerId === 'runner-3')).toBe(true);
  expect(secured.map(f => f.playerId)).toEqual(['defender-7', 'defender-6', 'defender-1']);
  expect(result.ruleFacts.controlledBaseContacts).toMatchObject([{ defenderId: 'defender-1', base: 4, tick: secured[2].tick }]);
  expect(result.finalRunners.find(r => r.runnerId === 'runner-3')).toMatchObject({ retired: true, scored: false });
  expect(planLiveThrowV1({ releasePosition: releases[0].position!, bodyVelocity: result.diagnostics.throwDirectionCommands[0].bodyVelocity,
    maximumThrowSpeedMps: raw.fielders[7].throwSpeedMps, spin: result.diagnostics.throwDirectionCommands[0].actual.spin,
    physics: raw.physics, target: v(0, 1, 0) }).kind).toBe('unreachable');
  for (let i = 0; i < releases.length; i++) {
    const release = releases[i], spec = raw.fielders.find(f => f.playerId === release.playerId)!;
    expect(release.elapsedSeconds).toBeGreaterThanOrEqual(secured[i].elapsedSeconds + spec.transferSeconds);
    const contact = result.facts.find(f => f.kind === 'glove_contact' && f.playerId === release.receiverPlayerId && f.elapsedSeconds > release.elapsedSeconds)!;
    expect(contact.elapsedSeconds).toBeLessThan(secured[i + 1].elapsedSeconds);
    expect(result.frames.filter(f => f.elapsedSeconds > release.elapsedSeconds && f.elapsedSeconds < contact.elapsedSeconds)
      .every(f => f.ball.possessedBy === null && f.ball.visible)).toBe(true);
  }
  const relayFrame = result.frames.find(f => f.elapsedSeconds >= releases[0].elapsedSeconds)!;
  expect(relayFrame.fielders.find(f => f.playerId === 'defender-6')).toMatchObject({ intent: 'relay', targetBase: null });
  expect(relayFrame.fielders.filter(f => f.intent === 'base_cover' && f.targetBase === 4)).toHaveLength(1);
  expect(releases[0].target!.z).toBeGreaterThan(65); expect(releases[0].target!.z).toBeLessThan(75);
  expect(releases[1].target).toEqual(v(0, 1, 0));
  expect(result.diagnostics.aiTelemetry.relayPlans.some(p => p.playerId === 'defender-6' && p.kind === 'direct'
    && p.elapsedSeconds >= secured[1].elapsedSeconds + raw.fielders[6].transferSeconds)).toBe(true);
  for (let k = 1; k < result.frames.length; k++) {
    const a = result.frames[k - 1], b = result.frames[k], dt = b.elapsedSeconds - a.elapsedSeconds;
    for (let i = 0; i < raw.fielders.length; i++) {
      const from = a.fielders[i], to = b.fielders[i], spec = raw.fielders[i];
      expect(Math.hypot(to.position.x - from.position.x, to.position.z - from.position.z)).toBeLessThanOrEqual(spec.topSpeedMps * dt + 1e-8);
      expect(Math.hypot(to.velocity.x - from.velocity.x, to.velocity.z - from.velocity.z)).toBeLessThanOrEqual(spec.accelerationMps2 * dt + 1e-8);
      expect(Math.hypot(to.glove.x - to.position.x, to.glove.y - to.position.y, to.glove.z - to.position.z)).toBeLessThanOrEqual(spec.gloveReachMeters + 1e-8);
    }
  }
  expect(JSON.stringify(raw)).toBe(before);
});

it('uses a faster actual direct throw when the same holder has sufficient arm speed', () => {
  const result = simulateLiveFieldPlayV1(deepRelayInput(50)), releases = result.facts.filter(f => f.kind === 'throw_release');
  expect(releases[0]).toMatchObject({ playerId: 'defender-7', receiverPlayerId: 'defender-1', base: 4, reason: 'force_play', target: v(0, 1, 0) });
  expect(result.ruleFacts.controlledBaseContacts.some(f => f.base === 4)).toBe(true);
  expect(result.diagnostics.aiTelemetry.relayPlans.some(p => p.playerId === 'defender-7' && p.base === 4 && p.kind === 'direct')).toBe(true);
});

it('executes two intermediate receipts as three separate actual throws and custody intervals', () => {
  const raw = deepRelayInput(), positions = [v(-60, 1, 30), v(0, 1, 0), v(60, 1, 30), v(-55, 1, 60),
    v(0, 1, 22), v(55, 1, 60), v(0, 1, 44), v(0, 1, 66), v(50, 1, 0)],
    result = simulateLiveFieldPlayV1({ ...raw,
      ball: { ...raw.ball, ball: { ...raw.ball.ball, position: v(0, .2, 66) } },
      fielders: raw.fielders.map((f, i) => ({ ...f, position: positions[i], throwSpeedMps: 16,
        topSpeedMps: .1, accelerationMps2: .1, reactionSeconds: [1, 4, 6, 7].includes(i) ? .01 : 60 })),
      runners: raw.runners.map(r => r.initialBase === 3 ? { ...r, topSpeedMps: 1.5 } : r) }),
    releases = result.facts.filter(f => f.kind === 'throw_release'), secured = result.facts.filter(f => f.kind === 'catch_secured');
  expect(result.end.complete).toBe(true); expect(result.diagnostics.unresolvedDetail).toBeNull();
  expect(releases.map(f => f.receiverPlayerId)).toEqual(['defender-6', 'defender-4', 'defender-1']);
  expect(releases.map(f => f.reason)).toEqual(['relay_play', 'relay_play', 'force_play']);
  expect(releases.every(f => f.base === 4 && f.runnerId === 'runner-3')).toBe(true);
  expect(secured.map(f => f.playerId)).toEqual(['defender-7', 'defender-6', 'defender-4', 'defender-1']);
  for (let i = 0; i < releases.length; i++) {
    expect(releases[i].elapsedSeconds).toBeGreaterThanOrEqual(secured[i].elapsedSeconds + raw.fielders[7].transferSeconds);
    expect(releases[i].elapsedSeconds).toBeLessThan(secured[i + 1].elapsedSeconds);
    expect(result.facts.some(f => f.kind === 'glove_contact' && f.playerId === releases[i].receiverPlayerId
      && f.elapsedSeconds > releases[i].elapsedSeconds && f.elapsedSeconds < secured[i + 1].elapsedSeconds)).toBe(true);
  }
  expect(result.ruleFacts.controlledBaseContacts).toMatchObject([{ defenderId: 'defender-1', base: 4, tick: secured[3].tick }]);
  expect(result.finalRunners.find(r => r.runnerId === 'runner-3')).toMatchObject({ retired: true, scored: false });
  expect(result.diagnostics.aiTelemetry.relayPlans.find(p => p.base === 4)?.receivers).toEqual(['defender-6', 'defender-4', 'defender-1']);
});
