import { expect, it } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { simulateLiveFieldPlayV1 } from './LiveFieldPlayV1';
import { buildLiveFieldPlayInputV95 } from '../../../integration/browser/LiveFieldInputV95';
import { LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, type LivePositionV1 } from '../../../integration/browser/LiveBaseballMatchV1';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../ball/BaseballAerodynamics';
import { createLiveDefenseControlMemoV95, estimateLiveDefenseControlV95, type LiveDefenseControlEstimateInputV95 } from './LiveDefenseControlEstimateV95';
import type { LiveRelayActorV1 } from './LiveRelayPlanV1';

const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const roles: readonly LivePositionV1[] = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
function fixture(recoverySeconds: number, ballHeight = 1.2, verticalSpeed = -3, fielderZ = 13, withLead = false) {
  const bases = { home: v(), first: v(19.39, 0, 19.39), second: v(0, 0, 38.78), third: v(-19.39, 0, 19.39) },
    defense = Object.fromEntries(roles.map((role, i) => [role, 'f' + i])) as Record<LivePositionV1, string>,
    placements = Object.fromEntries(roles.map((role, i) => [role, i === 0 ? v(0, .9, fielderZ)
      : i === 1 ? { ...bases.first, y: .85 } : i === 4 && withLead ? { ...bases.third, y: .9 }
        : v(i % 2 ? 35 : -35, .9, 40 + i * 4)])) as Record<LivePositionV1, ReturnType<typeof v>>;
  return buildLiveFieldPlayInputV95({
    ball: { originTick: 0, elapsedSeconds: 0, ball: { tick: 0, position: v(0, ballHeight, 7), velocity: v(0, verticalSpeed, 12), spin: v() } },
    physics: { kind: 'aero_ground_v1', air: { ticksPerSecond: 1e6, integrationStepTicks: 4000, gravityY: -9.81,
      aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS }, ground: { ticksPerSecond: 1e6, gravityMps2: 9.81,
      radiusM: .0366, inertiaRatio: .378, restingVerticalSpeedMps: .15, material: { restitution: .4,
        slidingFriction: .25, rollingDecelerationMps2: 1, normalSpinDecayPerSecond: .5 } } },
    field: { bases, fenceRadiusMeters: 110, fenceHeightMeters: 2 }, defense, placements,
    players: [...roles.map((_, i) => ({ playerId: 'f' + i, heightMeters: 1.8,
      physical: { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, reactionSeconds: 0, topSpeedMps: 7, accelerationMps2: 6,
        gloveSpeedMps: 12, transferSeconds: .25, retentionCapacityJ: 150, commandStdMeters: 0,
        fieldDiveRecoverySecondsV115: i === 0 ? recoverySeconds : 1 } })),
      { playerId: 'b', heightMeters: 1.8, physical: { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, reactionSeconds: .1, topSpeedMps: 6, accelerationMps2: 5 } },
      ...(withLead ? [{ playerId: 'lead', heightMeters: 1.8, physical: { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, reactionSeconds: 0, topSpeedMps: 6.8, accelerationMps2: 5, baserunningSafetyMarginSeconds: 3 } }] : [])],
    batterRunnerId: 'b', batterPosition: v(), occupiedBases: { first: null, second: withLead ? 'lead' : null, third: null },
    baserunning: 'balanced', outs: 0, maxPlaySeconds: 7, frameSeconds: .04, seed: 37,
  });
}

it('audits a matched recovery-only ground-dive pair through the ordinary Host input mapper', () => {
  const runs = [.2, 1.2].map(recovery => {
    const input = fixture(recovery), result = simulateLiveFieldPlayV1(input);
    return { recovery, input, result };
  });
  const report = runs.map(({ recovery, result }) => ({ recovery, end: result.end,
    actions: result.diagnostics.athleticDecisionsV115, facts: result.facts,
    forecasts: result.diagnostics.aiTelemetry.runnerObservationsV95,
    decisions: result.diagnostics.aiTelemetry.runnerDecisions,
    throws: result.diagnostics.throwEffortCommandsV103, detail: result.diagnostics.unresolvedDetail }));
  if (process.env.ATHLETIC_AUDIT_V116 === '1') {
    mkdirSync('docs/verification/releases/v116/athletic-recovery', { recursive: true });
    writeFileSync('docs/verification/releases/v116/athletic-recovery/contrast.json', JSON.stringify(report, null, 2) + '\n');
    console.log('V116_RECOVERY_PAIR', JSON.stringify(report.map(r => ({ recovery: r.recovery, end: r.end,
      actions: r.actions, facts: r.facts.filter(f => ['catch_secured', 'throw_release', 'runner_base_touch'].includes(f.kind)), detail: r.detail }))));
  }
  expect(runs.every(r => r.result.diagnostics.athleticDecisionsV115.some(a => a.kind === 'dive'))).toBe(true);
  expect(runs.every(r => r.result.facts.some(f => f.kind === 'throw_release' && f.playerId === 'f0'))).toBe(true);
  const firstCatches = runs.map(r => r.result.facts.find(f => f.kind === 'catch_secured' && f.playerId === 'f0')!),
    actions = runs.map(r => r.result.diagnostics.athleticDecisionsV115.find(a => a.playerId === 'f0' && a.kind === 'dive')!),
    releases = runs.map(r => r.result.facts.find(f => f.kind === 'throw_release' && f.playerId === 'f0')!);
  expect(firstCatches[0]).toEqual(firstCatches[1]);
  expect(actions[0].point).toEqual(actions[1].point);
  expect(actions[0].fromSeconds).toBe(actions[1].fromSeconds);
  expect(actions[1].throughSeconds - actions[0].throughSeconds).toBeCloseTo(1, 10);
  releases.forEach((release, i) => expect(release.elapsedSeconds).toBeGreaterThanOrEqual(actions[i].throughSeconds));
  expect(releases[1].elapsedSeconds - releases[0].elapsedSeconds).toBeGreaterThan(.5);
  expect(runs.every(r => r.result.end.complete && r.result.diagnostics.unresolvedDetail === null)).toBe(true);
});

it('includes the same held diver recovery in a lead runner defense observation', () => {
  const runs = [.2, 2].map(recovery => ({ recovery, result: simulateLiveFieldPlayV1(fixture(recovery, 1.2, -3, 13, true)) }));
  const report = runs.map(({ recovery, result }) => ({ recovery, end: result.end,
    actions: result.diagnostics.athleticDecisionsV115, facts: result.facts,
    forecasts: result.diagnostics.aiTelemetry.runnerObservationsV95.filter(o => o.runnerId === 'lead'),
    decisions: result.diagnostics.aiTelemetry.runnerDecisions.filter(o => o.runnerId === 'lead') }));
  if (process.env.ATHLETIC_AUDIT_V116 === '1') {
    mkdirSync('docs/verification/releases/v116/athletic-recovery', { recursive: true });
    writeFileSync('docs/verification/releases/v116/athletic-recovery/runner-contrast.json', JSON.stringify(report, null, 2) + '\n');
    console.log('V116_RUNNER_PAIR', JSON.stringify(report.map(r => ({ recovery: r.recovery, end: r.end, actions: r.actions,
      afterSecure: r.forecasts.filter(o => o.observedAtSeconds >= .6 && o.controlSeconds !== null).slice(0, 2), decisions: r.decisions }))));
  }
  const early = report.map(r => r.forecasts.find(o => o.observedAtSeconds >= .6 && o.controlSeconds !== null));
  expect(early.every(o => o && o.controlSeconds !== null)).toBe(true);
  expect(early[1]!.observedAtSeconds).toBe(early[0]!.observedAtSeconds);
  expect(report.every(r => r.actions.some(a => a.playerId === 'f0' && a.kind === 'dive'))).toBe(true);
  // The held ball is >20m from third. This diver cannot deliver or carry it
  // before its already committed Source motor releases ordinary movement.
  const slowReady = report[1].actions.find(a => a.playerId === 'f0' && a.kind === 'dive')!.throughSeconds;
  expect(early[1]!.controlSeconds!).toBeGreaterThanOrEqual(slowReady - early[1]!.elapsedSeconds);
});

const snapshot = (): LiveDefenseControlEstimateInputV95 => {
  const actor = (playerId: string, z: number): LiveRelayActorV1 => ({ playerId, position: v(0, 1, z), velocity: v(),
    homePosition: v(0, 1, z), glovePosition: v(0, 1.3, z), gloveVelocity: v(), topSpeedMps: 7, accelerationMps2: 6,
    throwSpeedMps: 34, remainingReactionSeconds: 0, gloveSpeedMps: 11, gloveReachMeters: 1.35,
    gloveRadiusMeters: .1, transferSeconds: .25 });
  return { observedAtSeconds: 10, nowSeconds: 10, snapshotKey: 'athletic-observed-10',
    actors: [actor('holder', 0), actor('receiver', 20)], sources: [{ playerId: 'holder', point: v(0, 1.3, 0),
      readySeconds: 2, kind: 'pending', holderTransferRemainingSeconds: .6 }],
    target: { base: 3, position: v(0, 1, 20), forced: true }, physics: fixture(.2).physics };
};

it('overlaps pending capture, transfer and recovery, and preserves the nonaction result', () => {
  const raw = snapshot(), normal = estimateLiveDefenseControlV95(raw),
    zero = estimateLiveDefenseControlV95({ ...raw, actors: raw.actors.map(a => ({ ...a, athleticRecoverySecondsV116: 0 })) }),
    overlapping = estimateLiveDefenseControlV95({ ...raw, actors: raw.actors.map((a, i) => i ? a : { ...a, athleticRecoverySecondsV116: 2 }) }),
    slow = estimateLiveDefenseControlV95({ ...raw, actors: raw.actors.map((a, i) => i ? a : { ...a, athleticRecoverySecondsV116: 4 }) });
  expect(normal.route).toBe('direct');
  expect(zero).toEqual(normal);
  expect(overlapping).toEqual(normal);
  expect(slow.route).toBe('direct');
  const leg = slow.legs[0];
  expect(raw.sources[0].readySeconds + leg.releaseDelaySeconds).toBe(4);
  expect(slow.controlSeconds!).toBeGreaterThanOrEqual(4 + leg.flightSeconds);
});

it('waits for observed receiver and carrying recovery instead of lending slide momentum to ordinary running', () => {
  const raw = snapshot(), receiver = estimateLiveDefenseControlV95({ ...raw,
    sources: [{ ...raw.sources[0], readySeconds: 0, kind: 'held', holderTransferRemainingSeconds: 0 }],
    actors: raw.actors.map((a, i) => i ? { ...a, athleticRecoverySecondsV116: 3 } : a) });
  expect(receiver.route).toBe('direct');
  expect(receiver.legs[0].receiverArrivalSeconds).toBe(3);
  expect(receiver.controlSeconds!).toBeGreaterThanOrEqual(3);
  const rest = { ...raw, actors: [raw.actors[0]], sources: [{ ...raw.sources[0], readySeconds: 0 }] },
    ordinary = estimateLiveDefenseControlV95(rest),
    carrying = estimateLiveDefenseControlV95({ ...rest, actors: [{ ...rest.actors[0], velocity: v(0, 0, 7), athleticRecoverySecondsV116: 2 }],
      sources: [{ ...rest.sources[0], readySeconds: .5 }] });
  expect(carrying.route).toBe('carry');
  expect(carrying.controlSeconds!).toBeCloseTo(ordinary.controlSeconds! + 2, 10);
});

it('ages only the captured recovery snapshot and rejects malformed optional wait values', () => {
  const raw = snapshot(), actors = raw.actors.map((a, i) => i ? a : { ...a, athleticRecoverySecondsV116: 4 }),
    input = { ...raw, actors }, before = JSON.stringify(input), memo = createLiveDefenseControlMemoV95(),
    initial = estimateLiveDefenseControlV95(input, memo), aged = estimateLiveDefenseControlV95({ ...input, nowSeconds: 11 }, memo);
  expect(aged.diagnostics.cacheHit).toBe(true);
  expect(aged.controlSeconds!).toBeCloseTo(initial.controlSeconds! - 1, 10);
  expect(JSON.stringify(input)).toBe(before);
  for (const wait of [-1, NaN, Infinity]) expect(() => estimateLiveDefenseControlV95({ ...raw,
    actors: [{ ...raw.actors[0], athleticRecoverySecondsV116: wait }, raw.actors[1]] })).toThrow(/observer snapshot/);
});

it('retains glove ability and park friction differences in actual dive preparation and movement', () => {
  const runs = [{ glove: 6, friction: .25 }, { glove: 14, friction: .25 }, { glove: 12, friction: .15 }, { glove: 12, friction: .4 }].map(settings => {
    const raw = fixture(.2), input = { ...raw, fielders: raw.fielders.map((f, i) => i ? f : { ...f, gloveSpeedMps: settings.glove }),
      physics: { ...raw.physics, ground: { ...raw.physics.ground, material: { ...raw.physics.ground.material, slidingFriction: settings.friction } } } },
      before = JSON.stringify(input), result = simulateLiveFieldPlayV1(input);
    expect(JSON.stringify(input)).toBe(before);
    expect(result.diagnostics.unresolvedDetail).toBeNull();
    for (const action of result.diagnostics.athleticDecisionsV115) for (const release of result.facts.filter(f => f.kind === 'throw_release' && f.playerId === action.playerId))
      expect(release.elapsedSeconds).toBeGreaterThanOrEqual(action.throughSeconds);
    return { settings, end: result.end, actions: result.diagnostics.athleticDecisionsV115,
      catches: result.facts.filter(f => f.kind === 'catch_secured'), releases: result.facts.filter(f => f.kind === 'throw_release') };
  });
  if (process.env.ATHLETIC_AUDIT_V116 === '1') writeFileSync('docs/verification/releases/v116/athletic-recovery/ability-park.json', JSON.stringify(runs, null, 2) + '\n');
  expect(runs.every(r => r.releases.length > 0)).toBe(true);
  expect(runs[0].releases[0].elapsedSeconds).not.toBe(runs[1].releases[0].elapsedSeconds);
  expect(runs[2].actions[0].throughSeconds).not.toBe(runs[3].actions[0].throughSeconds);
});

it('uses normal reception for an easy low grounder rather than selecting a dive on every chance', () => {
  const raw = fixture(.2, .2, 0, 11), result = simulateLiveFieldPlayV1(raw);
  expect(result.end.complete).toBe(true);
  expect(result.diagnostics.athleticDecisionsV115).toEqual([]);
  expect(result.facts.some(f => f.kind === 'catch_secured' && f.playerId === 'f0')).toBe(true);
  expect(result.facts.some(f => f.kind === 'throw_release' && f.playerId === 'f0')).toBe(true);
});

it('changes an actual outer-dive hold into a safe third-base advance when only recovery is longer', () => {
  const runs = [.2, 2].map(recovery => {
    const base = fixture(recovery, 1.2, -3, 13, true), input = { ...base, maxPlaySeconds: 12,
      ball: { ...base.ball, ball: { ...base.ball.ball, position: { ...base.ball.ball.position, z: base.ball.ball.position.z + 65 } } },
      fielders: base.fielders.map((f, i) => i ? f : { ...f, position: { ...f.position, z: f.position.z + 65 } }),
      runners: base.runners.map(r => r.runnerId !== 'lead' ? r : { ...r, advanceSafetyMarginSeconds: .35 }) },
      before = JSON.stringify(input), result = simulateLiveFieldPlayV1(input);
    expect(JSON.stringify(input)).toBe(before);
    expect(result.end.complete).toBe(true);
    expect(result.diagnostics.unresolvedDetail).toBeNull();
    const action = result.diagnostics.athleticDecisionsV115.find(a => a.playerId === 'f0' && a.kind === 'dive')!;
    expect(action).toBeDefined();
    const release = result.facts.find(f => f.kind === 'throw_release' && f.playerId === 'f0')!;
    expect(release).toBeDefined();
    expect(release.elapsedSeconds).toBeGreaterThanOrEqual(action.throughSeconds);
    expect(result.finalRunners.find(r => r.runnerId === 'b')!.retired).toBe(true);
    return { recovery, input, result, action, release };
  }), [fast, slow] = runs;
  expect({ ...fast.input, fielders: fast.input.fielders.map((f, i) => i ? f : { ...f,
    athleticProfileV115: { ...f.athleticProfileV115!, diveRecoverySeconds: 2 } }) }).toEqual(slow.input);
  expect(fast.result.facts.find(f => f.kind === 'catch_secured' && f.playerId === 'f0'))
    .toEqual(slow.result.facts.find(f => f.kind === 'catch_secured' && f.playerId === 'f0'));
  expect(fast.action.point).toEqual(slow.action.point);
  expect(fast.action.fromSeconds).toBe(slow.action.fromSeconds);
  expect(fast.action.interceptSeconds).toBe(slow.action.interceptSeconds);
  expect(slow.release.elapsedSeconds).toBeGreaterThan(fast.release.elapsedSeconds);
  const fastDecisions = fast.result.diagnostics.aiTelemetry.runnerDecisions.filter(d => d.runnerId === 'lead'),
    slowAdvance = slow.result.diagnostics.aiTelemetry.runnerDecisions.find(d => d.runnerId === 'lead' && d.advance)!;
  expect(fastDecisions.every(d => !d.advance)).toBe(true);
  expect(fast.result.finalRunners.find(r => r.runnerId === 'lead')).toMatchObject({ base: 2, retired: false });
  expect(fast.result.ruleFacts.runnerTouches.some(t => t.runnerId === 'lead' && t.base === 3)).toBe(false);
  expect(slowAdvance).toMatchObject({ targetBase: 3, reason: 'safe_race_advance' });
  expect(slowAdvance.raceMarginSeconds!).toBeGreaterThan(.35);
  expect(slow.result.ruleFacts.runnerTouches.some(t => t.runnerId === 'lead' && t.base === 3)).toBe(true);
  expect(slow.result.finalRunners.find(r => r.runnerId === 'lead')).toMatchObject({ base: 3, retired: false });
  if (process.env.ATHLETIC_AUDIT_V116 === '1') {
    mkdirSync('docs/verification/releases/v116/athletic-advance', { recursive: true });
    writeFileSync('docs/verification/releases/v116/athletic-advance/contrast.json', JSON.stringify(runs.map(({ recovery, input, result }) => ({
      recovery, input, end: result.end, facts: result.facts, actions: result.diagnostics.athleticDecisionsV115,
      decisions: result.diagnostics.aiTelemetry.runnerDecisions, final: result.finalRunners,
    })), null, 2) + '\n');
  }
}, 30000);
