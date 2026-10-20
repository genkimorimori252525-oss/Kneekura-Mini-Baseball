import { expect, it } from 'vitest';
import { simulateLiveFieldPlayV1, type LiveFieldPlayInputV1 } from './LiveFieldPlayV1';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../ball/BaseballAerodynamics';
import { estimateLiveRunnerLegSecondsV1 } from './LiveRunnerAdvancePolicyV1';

const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const runnerId = 'second-runner';
function fixture(): LiveFieldPlayInputV1 {
  const tps = 1e6;
  return {
    ball: { originTick: 0, elapsedSeconds: 0, ball: { tick: 0, position: v(0, .5, 0), velocity: v(0, 26, 30), spin: v(-150, 0, 0) } },
    physics: { kind: 'aero_ground_v1', air: { ticksPerSecond: tps, integrationStepTicks: 4000, gravityY: -9.81,
      aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS }, ground: { ticksPerSecond: tps, gravityMps2: 9.81,
      radiusM: .0366, inertiaRatio: .378, restingVerticalSpeedMps: .15, material: { restitution: .4,
        slidingFriction: .25, rollingDecelerationMps2: 1, normalSpinDecayPerSecond: .5 } } },
    field: { bases: { home: v(), first: v(19.39, 0, 19.39), second: v(0, 0, 38.78), third: v(-19.39, 0, 19.39) },
      fenceRadiusMeters: 110, fenceHeightMeters: 2 },
    fielders: [v(0, 1, 10), v(0, 1, -2), v(20, 1, 20), v(-20, 1, 20), v(12, 1, 35), v(-12, 1, 35),
      v(-35, 1, 65), v(0, 1, 75), v(35, 1, 65)].map((position, i) => ({ playerId: `fielder-${i}`, position,
      reactionSeconds: .08, topSpeedMps: 7, accelerationMps2: 6, gloveSpeedMps: 6, gloveReachMeters: 1.3, gloveRadiusMeters: .1,
      transferSeconds: .25, throwSpeedMps: 8, catchRetention: { ticksPerSecond: tps, ballMassKg: .145,
        ballRadiusMeters: .0366, pocketRadiusMeters: .3, centerRetentionCapacityJ: 150, captureDissipationPowerW: 3000,
        failedContactRestitution: .2, failedTangentialDamping: .4, failedSpinDamping: .2 } })),
    runners: [{ runnerId: 'batter', initialBase: 0, topSpeedMps: 8, accelerationMps2: 5, reactionSeconds: .1 },
      { runnerId, initialBase: 2, topSpeedMps: 8, accelerationMps2: 5, reactionSeconds: .1 }],
    outs: 0, maxPlaySeconds: 20,
  };
}
const departure = (result: ReturnType<typeof simulateLiveFieldPlayV1>, id = runnerId) =>
  result.facts.find(f => f.kind === 'runner_base_departure' && f.runnerId === id);
const thirdTouch = (result: ReturnType<typeof simulateLiveFieldPlayV1>) =>
  result.facts.find(f => f.kind === 'runner_base_touch' && f.runnerId === runnerId && f.base === 3);

it('physically advances second to third on a deep caught fly against a weak arm', () => {
  const input = fixture(), result = simulateLiveFieldPlayV1(input), caught = result.ruleFacts.flyCatch!;
  expect(result.end.complete).toBe(true);
  expect(caught).not.toBeNull();
  expect(result.ruleFacts.firstGroundContactTick).toBeNull();
  const left = departure(result)!, touched = thirdTouch(result)!;
  expect(left.tick).toBeGreaterThanOrEqual(caught.firstTouchTick + 100_000);
  expect(touched.tick).toBeGreaterThan(left.tick);
  const routeSeconds = estimateLiveRunnerLegSecondsV1(Math.hypot(19.39, 19.39), 8, 5, input.field.baseTouchRadiusMeters ?? .28);
  const began = result.diagnostics.aiTelemetry.runnerMotions.find(m => m.runnerId === runnerId)!;
  expect(left.elapsedSeconds - began.elapsedSeconds).toBeCloseTo(Math.sqrt(2 * (input.field.baseTouchRadiusMeters ?? .28) / 5), 9);
  expect(touched.elapsedSeconds - began.elapsedSeconds).toBeCloseTo(routeSeconds, 9);
  expect(result.finalRunners.find(r => r.runnerId === runnerId)!.base).toBeGreaterThanOrEqual(3);
});

it('physically advances while a distant ground ball cannot be retrieved before the runner arrives', () => {
  const raw = fixture(), result = simulateLiveFieldPlayV1({ ...raw,
    ball: { ...raw.ball, ball: { ...raw.ball.ball, position: v(0, .2, 60), velocity: v(0, -1, 10), spin: v() } },
    fielders: raw.fielders.map(f => ({ ...f, reactionSeconds: 8 })), maxPlaySeconds: 7.5,
  });
  expect(result.ruleFacts.firstGroundContactTick).not.toBeNull();
  expect(departure(result)!.tick).toBeGreaterThanOrEqual(result.ruleFacts.firstGroundContactTick! + 100_000);
  expect(thirdTouch(result)!.elapsedSeconds).toBeLessThan(8);
  expect(result.facts.filter(f => f.kind === 'catch_secured')).toEqual([]);
});

it('starts a legal tag-up after first touch and reaction, before a later secure catch', () => {
  const raw = fixture(), result = simulateLiveFieldPlayV1({ ...raw,
    fielders: raw.fielders.map(f => ({ ...f, catchRetention: { ...f.catchRetention, captureDissipationPowerW: 30 } })),
  }), caught = result.ruleFacts.flyCatch!, left = departure(result)!;
  expect(caught.secureCatchTick - caught.firstTouchTick).toBeGreaterThan(100_000);
  expect(left.tick).toBeGreaterThanOrEqual(caught.firstTouchTick + 100_000);
  expect(left.tick).toBeLessThan(caught.secureCatchTick);
  expect(result.facts.find(f => f.kind === 'catch_secured')!.tick).toBe(caught.secureCatchTick);
  expect(thirdTouch(result)).toBeDefined();
});

it('holds second on a shallow caught fly defended by strong arms', () => {
  const raw = fixture(), result = simulateLiveFieldPlayV1({ ...raw,
    ball: { ...raw.ball, ball: { ...raw.ball.ball, position: v(0, 2, 8), velocity: v(0, 1, 5), spin: v() } },
    fielders: raw.fielders.map(f => ({ ...f, throwSpeedMps: 40 })),
  });
  expect(result.end.complete).toBe(true);
  expect(result.ruleFacts.flyCatch).not.toBeNull();
  expect(departure(result)).toBeUndefined();
  expect(result.finalRunners.find(r => r.runnerId === runnerId)).toMatchObject({ base: 2, retired: false });
  expect(result.diagnostics.aiTelemetry.runnerDecisions.some(d => d.runnerId === runnerId && d.reason === 'insufficient_safety_margin')).toBe(true);
});

it('uses the hidden safety margin in the actual runner decision', () => {
  const raw = fixture(), input = { ...raw, fielders: raw.fielders.map(f => ({ ...f, throwSpeedMps: 8 })) },
    ordinary = simulateLiveFieldPlayV1({ ...input, runners: input.runners.map(r => ({ ...r, advanceSafetyMarginSeconds: 0 })) }),
    careful = simulateLiveFieldPlayV1({ ...input, runners: input.runners.map(r => ({ ...r, advanceSafetyMarginSeconds: 3 })) });
  expect(departure(ordinary)).toBeDefined();
  expect(departure(careful)).toBeUndefined();
  expect(careful.finalRunners.find(r => r.runnerId === runnerId)).toMatchObject({ base: 2, retired: false });
});

it('waits for the runner reaction after the actual first touch and keeps that decision alive', () => {
  const raw = fixture(), reactionSeconds = 1,
    result = simulateLiveFieldPlayV1({ ...raw, runners: raw.runners.map(r => r.runnerId === runnerId ? { ...r, reactionSeconds } : r) }),
    caught = result.ruleFacts.flyCatch!, left = departure(result)!;
  expect(left.tick).toBeGreaterThanOrEqual(caught.firstTouchTick + reactionSeconds * 1e6);
  const began = result.diagnostics.aiTelemetry.runnerMotions.find(m => m.runnerId === runnerId)!;
  expect(began.elapsedSeconds).toBeLessThan(caught.firstTouchTick / 1e6 + reactionSeconds + .05);
  expect(left.elapsedSeconds - began.elapsedSeconds).toBeCloseTo(Math.sqrt(2 * .28 / 5), 9);
  expect(thirdTouch(result)).toBeDefined();
  expect(result.end.tick).toBeGreaterThan(left.tick);
});

it('runs on contact with two outs and stops on the actual secured third-out fly', () => {
  const result = simulateLiveFieldPlayV1({ ...fixture(), outs: 2 });
  expect(result.end).toMatchObject({ complete: true, reason: 'third_out', tick: result.ruleFacts.flyCatch!.secureCatchTick });
  expect(departure(result)!.tick).toBeLessThan(result.ruleFacts.flyCatch!.firstTouchTick);
  expect(result.facts.every(f => f.tick <= result.ruleFacts.flyCatch!.secureCatchTick)).toBe(true);
  expect(result.ruleFacts.runnerTouches.filter(f => f.runnerId === runnerId && f.base === 4)).toEqual([]);
  expect(result.finalRunners.find(r => r.runnerId === runnerId)!.scored).toBe(false);
});

it.each([3, 4])('throws home after the force dissolves and retires the runner by a physically held tag (%s m/s)', thirdRunnerSpeed => {
  const raw = fixture(), input: LiveFieldPlayInputV1 = { ...raw,
    ball: { ...raw.ball, ball: { ...raw.ball.ball, position: v(18, .2, 19), velocity: v(0, -1, 1), spin: v() } },
    fielders: raw.fielders.map((f, i) => ({ ...f, defensivePosition: (['P', 'C', '1B', '3B', '2B', 'SS', 'LF', 'CF', 'RF'] as const)[i],
      throwSpeedMps: 32, gloveSpeedMps: 11, throwBackspinRadPerSecond: 120 })),
    runners: [{ ...raw.runners[0], topSpeedMps: 2 },
      { runnerId: 'first-runner', initialBase: 1, topSpeedMps: 8, accelerationMps2: 5, reactionSeconds: .1 },
      raw.runners[1],
      { runnerId: 'third-runner', initialBase: 3, topSpeedMps: thirdRunnerSpeed, accelerationMps2: 5, reactionSeconds: .1 }],
  }, result = simulateLiveFieldPlayV1(input),
    firstOut = result.ruleFacts.controlledBaseContacts.find(f => f.base === 1)!,
    tag = result.facts.find(f => f.kind === 'controlled_runner_tag' && f.runnerId === 'third-runner');
  expect(result.end.complete).toBe(true);
  expect(result.finalRunners.find(r => r.runnerId === 'batter')!.retired).toBe(true);
  expect(tag).toBeDefined();
  // Follow actual custody into the tag instead of assuming that the first
  // intended receiver must also be the final player who tags the runner.
  const received = result.facts.filter(f => f.kind === 'catch_secured' && f.playerId === tag!.playerId && f.tick < tag!.tick).at(-1)!,
    release = result.facts.filter(f => f.kind === 'throw_release' && f.base === 4
      && f.receiverPlayerId === received.playerId && f.tick < received.tick).at(-1)!;
  expect(received).toBeDefined();
  expect(release).toBeDefined();
  expect(release.reason).toBe('tag_play');
  expect(release.tick).toBeGreaterThan(firstOut.tick);
  expect(received.tick).toBeGreaterThan(release.tick);
  expect(tag!.tick).toBeGreaterThan(received.tick);
  expect(result.facts.some(f => f.kind === 'throw_release' && f.playerId === tag!.playerId
    && f.tick > received.tick && f.tick < tag!.tick)).toBe(false);
  expect(result.ruleFacts.controlledBaseContacts.filter(f => f.base === 4)).toEqual([]);
  expect(result.ruleFacts.runnerTouches.filter(f => f.runnerId === 'third-runner' && f.base === 4)).toEqual([]);
  expect(result.finalRunners.find(r => r.runnerId === 'third-runner')!.retired).toBe(true);
  // Request a readonly observation exactly at the actual tag. The later play
  // closure need not coincide with this out when other decisions remain live.
  const observed = simulateLiveFieldPlayV1({ ...input, frameSeconds: tag!.elapsedSeconds });
  expect(observed.facts).toEqual(result.facts);
  expect(observed.ruleFacts).toEqual(result.ruleFacts);
  const frame = observed.frames.find(f => f.elapsedSeconds === tag!.elapsedSeconds)!,
    tagger = frame.fielders.find(f => f.playerId === tag!.playerId)!, runner = frame.runners.find(r => r.runnerId === 'third-runner')!;
  expect(frame.tick).toBe(tag!.tick);
  expect(Math.hypot(tagger.glove.x - runner.position.x, tagger.glove.y - runner.position.y - .9,
    tagger.glove.z - runner.position.z)).toBeLessThanOrEqual(.28 + 1e-8);
});

it('commits a safe next advance through third instead of closing the held-ball play', () => {
  const raw = fixture(), result = simulateLiveFieldPlayV1({ ...raw,
    fielders: raw.fielders.map(f => ({ ...f, throwSpeedMps: 4 })),
  }), touches = result.ruleFacts.runnerTouches.filter(f => f.runnerId === runnerId);
  expect(result.end.complete).toBe(true);
  expect(touches.map(f => f.base)).toEqual([3, 4]);
  const through = result.diagnostics.aiTelemetry.runnerMotions.find(m => m.runnerId === runnerId && m.throughBases.join(',') === '3,4')!;
  expect(through).toBeDefined();
  expect(through.elapsedSeconds).toBeLessThan(thirdTouch(result)!.elapsedSeconds);
  expect(result.finalRunners.find(r => r.runnerId === runnerId)).toMatchObject({ scored: true, retired: false });
});

it('protects a nonforced runner still touching the origin even while a controlled glove overlaps the body', () => {
  const raw = fixture(), result = simulateLiveFieldPlayV1({ ...raw,
    ball: { ...raw.ball, ball: { ...raw.ball.ball, position: v(0, 1.4, 38.78), velocity: v(0, -1, .1), spin: v() } },
    fielders: raw.fielders.map((f, i) => ({ ...f, position: i === 7 ? v(0, 1, 38.78) : f.position,
      topSpeedMps: .1, accelerationMps2: .1, throwSpeedMps: 4, gloveSpeedMps: 11 })),
    runners: raw.runners.map(r => ({ ...r, reactionSeconds: 0 })),
  }), caught = result.ruleFacts.flyCatch!, tag = result.ruleFacts.controlledRunnerTags.find(f => f.runnerId === runnerId)!;
  expect(result.end.complete).toBe(true);
  expect(tag.tick).toBeGreaterThan(caught.secureCatchTick);
  const protectedFrame = result.frames.find(frame => {
    if (frame.tick < caught.secureCatchTick || frame.tick >= tag.tick) return false;
    const runner = frame.runners.find(r => r.runnerId === runnerId)!, holder = frame.fielders.find(f => f.playerId === frame.ball.possessedBy)!;
    return holder && !runner.retired && Math.hypot(runner.position.x, runner.position.z - 38.78) < .28
      && Math.hypot(holder.glove.x - runner.position.x, holder.glove.y - runner.position.y - .9, holder.glove.z - runner.position.z) <= .28;
  });
  expect(protectedFrame).toBeDefined();
  const retired = result.finalRunners.find(r => r.runnerId === runnerId)!;
  expect(Math.hypot(retired.position.x, retired.position.z - 38.78)).toBeGreaterThanOrEqual(.28 - 1e-9);
});

it('allows a physical tag of a forced runner still standing on the old base before reacting', () => {
  const raw = fixture(), thirdRunnerId = 'third-runner', result = simulateLiveFieldPlayV1({ ...raw,
    ball: { ...raw.ball, ball: { ...raw.ball.ball, position: v(-19.39, .2, 19.79), velocity: v(0, -1, 0), spin: v() } },
    fielders: raw.fielders.map((f, i) => ({ ...f, position: i === 3 ? v(-19.39, 1, 19.89) : f.position,
      throwSpeedMps: 32, gloveSpeedMps: 11 })),
    runners: [raw.runners[0], { ...raw.runners[1], runnerId: 'first-runner', initialBase: 1 }, raw.runners[1],
      { ...raw.runners[1], runnerId: thirdRunnerId, initialBase: 3, reactionSeconds: 1 }],
  }), tag = result.ruleFacts.controlledRunnerTags.find(f => f.runnerId === thirdRunnerId)!;
  expect(result.end.complete).toBe(true);
  expect(result.ruleFacts.firstGroundContactTick).not.toBeNull();
  expect(tag.tick).toBeGreaterThan(result.facts.find(f => f.kind === 'catch_secured')!.tick);
  expect(tag.tick).toBeLessThan(result.ruleFacts.firstGroundContactTick! + 1e6);
  expect(departure(result, thirdRunnerId)).toBeUndefined();
  expect(result.finalRunners.find(r => r.runnerId === thirdRunnerId)).toMatchObject({ retired: true, position: raw.field.bases.third });
});
