import { expect, it } from 'vitest';
import { deriveLiveFieldFenceGeometryV1, simulateLiveFieldPlayV1, type LiveFieldPlayInputV1 } from './LiveFieldPlayV1';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../ball/BaseballAerodynamics';
import { quantizeEventTick } from '../ExactEventTime';
import { createSourceFreeBallKernel } from '../ball/SourceFreeBallKernel';
import { LIVE_RUNNER_ADVANCE_POLICY_V1 } from './LiveRunnerAdvancePolicyV1';
const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
export const liveFieldFixture = (): LiveFieldPlayInputV1 => {
  const tps = 1e6, originTick = 100000, elapsedSeconds = .123456789;
  return { ball: { originTick, elapsedSeconds, ball: { tick: quantizeEventTick(originTick, elapsedSeconds, tps),
    position: v(0, 2, 8), velocity: v(0, 1, 5), spin: v() } },
    physics: { kind: 'aero_ground_v1', air: { ticksPerSecond: tps, integrationStepTicks: 4000, gravityY: -9.81,
      aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS }, ground: { ticksPerSecond: tps, gravityMps2: 9.81,
      radiusM: .0366, inertiaRatio: .378, restingVerticalSpeedMps: .15, material: { restitution: .4,
        slidingFriction: .25, rollingDecelerationMps2: 1, normalSpinDecayPerSecond: .5 } } },
    field: { bases: { home: v(), first: v(19.39, 0, 19.39), second: v(0, 0, 38.78), third: v(-19.39, 0, 19.39) },
      fenceRadiusMeters: 110, fenceHeightMeters: 2 },
    fielders: [v(0, 1, 10), v(0, 1, -2), v(20, 1, 20), v(-20, 1, 20), v(12, 1, 35), v(-12, 1, 35),
      v(-35, 1, 65), v(0, 1, 75), v(35, 1, 65)].map((position, i) => ({ playerId: `fielder-${i}`, position,
      reactionSeconds: .08, topSpeedMps: 7, accelerationMps2: 6, gloveSpeedMps: 6, gloveReachMeters: 1.3, gloveRadiusMeters: .1,
      transferSeconds: .25, throwSpeedMps: 32, catchRetention: { ticksPerSecond: tps, ballMassKg: .145,
        ballRadiusMeters: .0366, pocketRadiusMeters: .3, centerRetentionCapacityJ: 150, captureDissipationPowerW: 3000,
        failedContactRestitution: .2, failedTangentialDamping: .4, failedSpinDamping: .2 } })),
    runners: [{ runnerId: 'batter', initialBase: 0, topSpeedMps: 8, accelerationMps2: 5, reactionSeconds: .1 }],
    outs: 2, maxPlaySeconds: 30 };
};
it('secures a physically contacted fly before recording a third out and hides the possessed ball', () => {
  const input = liveFieldFixture(), before = JSON.stringify(input), result = simulateLiveFieldPlayV1(input);
  expect(result.end).toMatchObject({ complete: true, reason: 'third_out' });
  expect(result.ruleFacts.flyCatch).not.toBeNull();
  expect(result.ruleFacts.flyCatch!.secureCatchTick).toBeGreaterThan(result.ruleFacts.flyCatch!.firstTouchTick);
  expect(result.ruleFacts.firstGroundContactTick).toBeNull();
  expect(result.frames.at(-1)!.ball.visible).toBe(false);
  expect(result.finalRunners[0].retired).toBe(true);
  expect(result.diagnostics.kernelBuilds).toBe(1);
  expect(JSON.stringify(input)).toBe(before);
});
it('runs the complete actual base path after a fair over-fence flight instead of teleporting runners', () => {
  const original = liveFieldFixture(), input = { ...original, outs: 0, field: { ...original.field, fenceRadiusMeters: 60 },
    fielders: original.fielders.map(f => ({ ...f, position: v(f.position.x / 2, f.position.y, f.position.z / 2) })),
    ball: { ...original.ball, ball: { ...original.ball.ball, position: v(0, 2, 0), velocity: v(0, 25, 45) } } };
  const result = simulateLiveFieldPlayV1(input);
  expect(result.end).toMatchObject({ complete: true, reason: 'home_run_completed' });
  expect(result.ruleFacts.overFence).toMatchObject({ fair: true, untouchedGround: true });
  expect(result.ruleFacts.runnerTouches.map(f => f.base)).toEqual([1, 2, 3, 4]);
  expect(result.ruleFacts.runnerTouches[0].tick).toBeGreaterThan(input.ball.ball.tick + 4e6);
  expect(result.finalRunners[0].scored).toBe(true);
  expect(result.frames.some(f => f.runners[0].position.x > 5 && f.runners[0].position.x < 15)).toBe(true);
});
it('does not change physical events when the readonly render cadence changes', () => {
  const input = liveFieldFixture(), a = simulateLiveFieldPlayV1(input), b = simulateLiveFieldPlayV1({ ...input, frameSeconds: .1 });
  expect(a.ruleFacts).toEqual(b.ruleFacts); expect(a.facts).toEqual(b.facts); expect(a.end).toEqual(b.end);
  expect(a.frames.length).not.toBe(b.frames.length);
});
it('refuses incomplete populations and preserves an unfinished scope without a fabricated play result', () => {
  const input = liveFieldFixture();
  expect(() => simulateLiveFieldPlayV1({ ...input, fielders: input.fielders.slice(1) })).toThrow(/nine/);
  expect(() => simulateLiveFieldPlayV1({ ...input, runners: [] })).toThrow(/runner/);
  const short = simulateLiveFieldPlayV1({ ...input, maxPlaySeconds: .02 });
  expect(short.end).toMatchObject({ complete: false, reason: 'scope_exhausted' });
  expect(short.ruleFacts.flyCatch).toBeNull(); expect(short.ruleFacts.controlledBaseContacts).toEqual([]);
});

it('measures pocket miss on the contact entry plane instead of counting the normal ball and glove radii as a miss', () => {
  const input = liveFieldFixture(), result = simulateLiveFieldPlayV1({ ...input,
    fielders: input.fielders.map(f => ({ ...f, catchRetention: { ...f.catchRetention, pocketRadiusMeters: .14 } })) });
  expect(result.ruleFacts.flyCatch).not.toBeNull();
  expect(result.end).toMatchObject({ complete: true, reason: 'third_out' });
});

it('derives two retirements from a received first-base force followed by the same defender carrying the ball to a runner tag', () => {
  const input = liveFieldFixture(), result = simulateLiveFieldPlayV1({ ...input, outs: 0,
    ball: { ...input.ball, ball: { ...input.ball.ball, position: v(0, .2, 0), velocity: v(1, -1, 5) } },
    runners: [{ ...input.runners[0], topSpeedMps: 3 },
      { runnerId: 'first-runner', initialBase: 1, topSpeedMps: 3, accelerationMps2: 3, reactionSeconds: .2 }] });
  if (process.env.FIELDING_DIAG_REPORT === '1') console.log('TWO_RETIREMENTS_TRACE', JSON.stringify({
    facts: result.facts.filter(f => ['catch_secured', 'throw_release', 'controlled_base_contact', 'controlled_runner_tag', 'runner_base_touch', 'play_end'].includes(f.kind)),
    handPreparations: result.diagnostics.handPreparationProofs.map(p => ({ playerId: p.playerId, base: p.base, from: p.from, through: p.through })),
    holderStates: result.diagnostics.aiTelemetry.holderDecisions.filter((d, i, a) => i === 0 || d.state !== a[i - 1].state || d.base !== a[i - 1].base) }));
  expect(result.end.complete).toBe(true);
  expect(result.ruleFacts.controlledBaseContacts.map(f => f.base)).toEqual([1]);
  expect(result.ruleFacts.controlledRunnerTags).toMatchObject([{ runnerId: 'first-runner' }]);
  const controls = result.ruleFacts.controlledBaseContacts, tag = result.ruleFacts.controlledRunnerTags[0],
    releases = result.facts.filter(f => f.kind === 'throw_release');
  expect(releases.length).toBeGreaterThan(0);
  for (const release of result.facts.filter(f => f.kind === 'throw_release')) {
    const receiver = input.fielders.find(f => f.playerId === release.receiverPlayerId);
    expect(receiver).toBeDefined();expect(release.receiverPlayerId).not.toBe(release.playerId);
    const name = ({ 1: 'first', 2: 'second', 3: 'third', 4: 'home' } as const)[release.base!];
    expect(release.target).toEqual({ ...input.field.bases[name], y: input.field.bases[name].y + receiver!.position.y });
    // The receiver exists at release, before any later secure catch can be
    // consulted. This assertion verifies this fixture's actual throw outcome.
    const nextRelease = result.facts.find(f => f.kind === 'throw_release' && f.elapsedSeconds > release.elapsedSeconds);
    const catchFact = result.facts.find(f => f.kind === 'catch_secured' && f.elapsedSeconds > release.elapsedSeconds);
    expect(catchFact?.playerId).toBe(release.receiverPlayerId);
    if (nextRelease) expect(catchFact!.elapsedSeconds).toBeLessThan(nextRelease.elapsedSeconds);
  }
  expect(result.finalRunners.every(r => r.retired)).toBe(true);
  const forceContact = result.facts.find(f => f.kind === 'controlled_base_contact' && f.base === 1)!,
    forceDelivery = releases.filter(f => f.elapsedSeconds < forceContact.elapsedSeconds
    && f.receiverPlayerId === controls[0].defenderId).at(-1)!;
  expect(forceDelivery).toMatchObject({ reason: 'force_play', base: 1, receiverPlayerId: controls[0].defenderId });
  expect(tag.defenderId).toBe(controls[0].defenderId);
  // The receiver can make the non-force tag itself. A second throw during
  // this chase would relinquish a ball it already controls unnecessarily.
  expect(releases.filter(f => f.elapsedSeconds >= forceContact.elapsedSeconds)).toEqual([]);
  expect(tag.tick).toBeGreaterThan(controls[0].tick);
  expect(tag.tick).toBeGreaterThan(result.facts.find(f => f.kind === 'catch_secured' && f.playerId === tag.defenderId)!.tick);
  expect(result.diagnostics.handPreparationProofs).toHaveLength(releases.length);
  for (const preparation of result.diagnostics.handPreparationProofs) {
    expect(preparation.through).toBeGreaterThan(preparation.from);
    const spec = input.fielders.find(f => f.playerId === preparation.playerId)!;
    expect(preparation.diagnostics.controlPointReachBoundMeters).toBeLessThanOrEqual(spec.gloveReachMeters);
    expect(preparation.diagnostics.derivativeControlSpeedBoundMps).toBeLessThanOrEqual(spec.gloveSpeedMps);
    for (const frame of result.frames.filter(f => f.elapsedSeconds > preparation.from && f.elapsedSeconds < preparation.through)) {
      const f = frame.fielders.find(p => p.playerId === preparation.playerId)!, u = (frame.elapsedSeconds - preparation.from) / (preparation.through - preparation.from),
        weights = [(1 - u) ** 3, 3 * u * (1 - u) ** 2, 3 * u ** 2 * (1 - u), u ** 3];
      for (const axis of ['x', 'y', 'z'] as const) expect(f.glove[axis] - f.position[axis]).toBeCloseTo(
        preparation.controls.reduce((sum, p, i) => sum + p[axis] * weights[i], 0), 9);
    }
  }
  for (const frame of result.frames) for (const f of frame.fielders) {
    const spec = input.fielders.find(p => p.playerId === f.playerId)!;
    expect(Math.hypot(f.velocity.x, f.velocity.y, f.velocity.z)).toBeLessThanOrEqual(spec.topSpeedMps + 1e-9);
    expect(Math.hypot(f.glove.x - f.position.x, f.glove.y - f.position.y, f.glove.z - f.position.z)).toBeLessThanOrEqual(spec.gloveReachMeters + 1e-9);
  }
});

it('preserves two force retirements when the second-base runner deadline favors the second-to-first throw chain', () => {
  const input = liveFieldFixture(), result = simulateLiveFieldPlayV1({ ...input, outs: 0,
    ball: { ...input.ball, ball: { ...input.ball.ball, position: v(0, .2, 0), velocity: v(1, -1, 5) } },
    runners: [{ ...input.runners[0], topSpeedMps: 3 },
      { runnerId: 'first-runner', initialBase: 1, topSpeedMps: 2, accelerationMps2: 3, reactionSeconds: .2 }] }),
    releases = result.facts.filter(f => f.kind === 'throw_release'), contacts = result.ruleFacts.controlledBaseContacts;
  expect(result.end.complete).toBe(true); expect(contacts.map(f => f.base)).toEqual([2, 1]);
  expect(releases.map(f => [f.base, f.reason])).toEqual([[2, 'force_play'], [1, 'force_play']]);
  expect(result.ruleFacts.controlledRunnerTags).toEqual([]); expect(result.finalRunners.every(r => r.retired)).toBe(true);
  for (let i = 0; i < releases.length; i++) {
    const release = releases[i], secured = result.facts.find(f => f.kind === 'catch_secured' && f.playerId === release.receiverPlayerId && f.tick > release.tick)!;
    expect(contacts[i].defenderId).toBe(release.receiverPlayerId); expect(contacts[i].tick).toBeGreaterThanOrEqual(secured.tick);
    if (i + 1 < releases.length) expect(releases[i + 1].elapsedSeconds).toBeGreaterThanOrEqual(secured.elapsedSeconds
      + input.fielders.find(f => f.playerId === secured.playerId)!.transferSeconds);
  }
});

it('continues a true wall rebound through its signed-gap certificate and retrieves the ball', () => {
  const input = liveFieldFixture(), result = simulateLiveFieldPlayV1({ ...input, outs: 0,
    fielders: input.fielders.map(f => ({ ...f, reactionSeconds: 6 })),
    ball: { ...input.ball, ball: { ...input.ball.ball, position: v(0, .2, 0), velocity: v(10, -1, 25) } } });
  expect(result.end.complete).toBe(true);
  expect(result.ruleFacts.overFence).toBeNull();
  const proof = result.diagnostics.departureProofs.find(p => p.kind === 'fence');
  expect(proof).toBeDefined();
  expect(proof!.supportingPlaneLowerGapMeters).toBeGreaterThan(0);
  expect(proof!.actualGapAtEscapeMeters).toBeGreaterThan(0);
  expect(proof!.signedGap).toBeGreaterThanOrEqual(-proof!.penetrationBoundMeters);
  for (const frame of result.frames) for (const f of frame.fielders) {
    const { fenceCenter: center, fenceRadiusMeters: radius } = result.fieldGeometry;
    expect(Math.hypot(f.position.x - center.x, f.position.z - center.z)).toBeLessThanOrEqual(radius - .24);
    expect(Math.hypot(f.glove.x - center.x, f.glove.z - center.z)).toBeLessThanOrEqual(radius - .1);
  }
});

it('runs only the actual two-base award after a fair ground bounce clears the continuous fence', () => {
  const input = liveFieldFixture(), result = simulateLiveFieldPlayV1({ ...input, outs: 0,
    field: { ...input.field, fenceRadiusMeters: 40, fenceHeightMeters: .2 },
    fielders: input.fielders.map((f, i) => ({ ...f, position: v(i % 2 ? 20 : -20, 1, 10 + i * 2), reactionSeconds: 3 })),
    ball: { ...input.ball, ball: { ...input.ball.ball, position: v(0, 5, 0), velocity: v(0, -15, 60) } } });
  expect(result.end).toMatchObject({ complete: true, reason: 'ground_rule_award_completed' });
  expect(result.ruleFacts.overFence).toMatchObject({ fair: true, untouchedGround: false });
  expect(result.ruleFacts.firstGroundContactTick).toBeLessThan(result.ruleFacts.overFence!.tick);
  expect(result.ruleFacts.runnerTouches.map(t => t.base)).toEqual([1, 2]);
  expect(result.finalRunners[0]).toMatchObject({ base: 2, scored: false });
});

it('publishes one unchanged solid fence for both camera projection and physical fair/foul trajectories', () => {
  const field = liveFieldFixture().field;
  expect(deriveLiveFieldFenceGeometryV1(field)).toEqual({ fenceCenter: v(0, 0, 37.5), fenceRadiusMeters: 72.5, fenceHeightMeters: 2 });
  expect(() => deriveLiveFieldFenceGeometryV1({ ...field, fenceRadiusMeters: Infinity })).toThrow();
});
it('publishes fair territory only at its actual determination boundary', () => {
  const input = liveFieldFixture(), result = simulateLiveFieldPlayV1({ ...input, outs: 0,
    ball: { ...input.ball, ball: { ...input.ball.ball, position: v(0, .2, 0), velocity: v(1, -1, 5) } } });
  const actual = result.facts.filter(f => f.kind === 'territory_determined');
  expect(actual).toHaveLength(1); expect(actual[0].reason).toBe('fair');
  expect(actual[0].tick).toBeGreaterThan(result.ruleFacts.firstGroundContactTick!);
});
it('reports the actual pocket-settling position derivative and integrates its decaying spin phase', () => {
  const input = liveFieldFixture(), result = simulateLiveFieldPlayV1({ ...input, frameSeconds: .001,
    ball: { ...input.ball, ball: { ...input.ball.ball, spin: v(0, 20, 0) } } });
  const secured = result.facts.find(f => f.kind === 'catch_secured')!, first = result.facts.find(f => f.kind === 'glove_contact')!;
  const pending = result.frames.filter(f => f.elapsedSeconds > first.elapsedSeconds + .002 && f.elapsedSeconds < secured.elapsedSeconds - .002);
  expect(pending.length).toBeGreaterThan(2);
  const safe = pending.find(f => Math.floor((f.elapsedSeconds - .001 - input.ball.elapsedSeconds) / .04)
    === Math.floor((f.elapsedSeconds + .001 - input.ball.elapsedSeconds) / .04))!;
  const index = result.frames.indexOf(safe), a = result.frames[index - 1], b = result.frames[index + 1], dt = b.elapsedSeconds - a.elapsedSeconds;
  for (const axis of ['x', 'y', 'z'] as const)
    expect((b.ball.position[axis] - a.ball.position[axis]) / dt).toBeCloseTo(safe.ball.velocity[axis], 6);
  expect(pending[0].ball.orientation).not.toEqual(pending.at(-1)!.ball.orientation);
});

it('catches an ordinary high center-field fly using a causal aero-ground forecast', () => {
  const input = liveFieldFixture(), result = simulateLiveFieldPlayV1({ ...input,
    ball: { ...input.ball, ball: { ...input.ball.ball, position: v(0, .5, 0), velocity: v(0, 26, 30), spin: v(-150, 0, 0) } } });
  expect(result.end).toMatchObject({ complete: true, reason: 'third_out' });
  expect(result.ruleFacts.firstGroundContactTick).toBeNull();
  expect(result.ruleFacts.flyCatch).not.toBeNull();
  expect(result.diagnostics.forecastBuilds).toBeLessThan(10);
});

it('fields a straight infield grounder and makes a real throw to first before the batter arrives', () => {
  const input = liveFieldFixture(), result = simulateLiveFieldPlayV1({ ...input, outs: 0,
    ball: { ...input.ball, ball: { ...input.ball.ball, position: v(0, .2, 0), velocity: v(0, -1, 8) } } });
  expect(result.end.complete).toBe(true);
  expect(result.ruleFacts.firstGroundContactTick).not.toBeNull();
  expect(result.ruleFacts.controlledBaseContacts.some(c => c.base === 1)).toBe(true);
  expect(result.finalRunners[0].retired).toBe(true);
  expect(result.facts.some(f => f.kind === 'throw_release')).toBe(true);
});

it('keeps bodies, independent gloves and a possessed ball inside the physical fence through pickup and release', () => {
  const input = liveFieldFixture(), result = simulateLiveFieldPlayV1({ ...input, outs: 0,
    ball: { ...input.ball, ball: { ...input.ball.ball, position: v(.12725683123245404, .3853688226185056, .20949887171006185),
      velocity: v(-.015618415247801387, 16.345822469638335, 29.84679538737069), spin: v(-231.34989969737734, 180.8813539535696, 1.1097816738113266) } },
    fielders: input.fielders.map((f, i) => ({ ...f, position: i === 7 ? v(0, .9, 91) : v(f.position.x, .9, f.position.z),
      reactionSeconds: .18, topSpeedMps: 8, accelerationMps2: 5.2, gloveSpeedMps: 11, gloveReachMeters: 1.35, gloveRadiusMeters: .11,
      transferSeconds: .46, throwSpeedMps: 34 })),
    runners: [input.runners[0], { ...input.runners[0], runnerId: 'first', initialBase: 1 }], maxPlaySeconds: 45 });
  expect(result.end.complete).toBe(true);
  const { fenceCenter: center, fenceRadiusMeters: radius } = result.fieldGeometry;
  for (const frame of result.frames) {
    for (const f of frame.fielders) {
      expect(Math.hypot(f.position.x - center.x, f.position.z - center.z)).toBeLessThanOrEqual(radius - .24);
      expect(Math.hypot(f.glove.x - center.x, f.glove.z - center.z)).toBeLessThanOrEqual(radius - .11);
    }
    if (frame.ball.possessedBy) expect(Math.hypot(frame.ball.position.x - center.x, frame.ball.position.z - center.z)).toBeLessThanOrEqual(radius - input.physics.ground.radiusM + .002);
  }
  for (const release of result.facts.filter(f => f.kind === 'throw_release'))
    expect(Math.hypot(release.position!.x - center.x, release.position!.z - center.z)).toBeLessThan(radius - input.physics.ground.radiusM);
});

it('finishes the pinned fast grounder after causal interception without an invented result', () => {
  const input = liveFieldFixture(), t = .420455624996535, positions = [v(0, .9, 18.44), v(0, .85, -1.5), v(23, .9, 25),
    v(13, .9, 36), v(-23, .9, 25), v(-13, .9, 36), v(-46, .9, 76), v(0, .9, 91), v(46, .9, 76)],
    distance = 27.432 / Math.SQRT2;
  const result = simulateLiveFieldPlayV1({ ...input, outs: 0, maxPlaySeconds: 45,
    ball: { originTick: 1012487133, elapsedSeconds: t, ball: { tick: quantizeEventTick(1012487133, t, 1e6),
      position: v(-.007915886638595588, .4878372767424412, .01869935988430351),
      velocity: v(-20.456693505720697, .08294017804811116, 43.06009012193942),
      spin: v(223.68717658246663, -364.621090920902, 149.8602218987753) } },
    physics: { ...input.physics, air: { ...input.physics.air, integrationStepTicks: 5000, gravityY: -9.80665 },
      ground: { ...input.physics.ground, gravityMps2: 9.80665, restingVerticalSpeedMps: .28,
        material: { restitution: .48, slidingFriction: .24, rollingDecelerationMps2: .36, normalSpinDecayPerSecond: .18 } } },
    field: { ...input.field, fenceHeightMeters: 3, bases: { home: v(), first: v(distance, 0, distance), second: v(0, 0, 2 * distance), third: v(-distance, 0, distance) } },
    fielders: input.fielders.map((f, i) => ({ ...f, position: positions[i], reactionSeconds: .18,
      topSpeedMps: 8, accelerationMps2: 5.2, gloveSpeedMps: 11, gloveReachMeters: 1.35, gloveRadiusMeters: .11,
      transferSeconds: .46, throwSpeedMps: 34, throwBackspinRadPerSecond: 120,
      catchRetention: { ...f.catchRetention, pocketRadiusMeters: .14, centerRetentionCapacityJ: 160, failedTangentialDamping: .35 } })),
    runners: [0, 1, 2].map((n) => ({ runnerId: 'runner-' + n, initialBase: n as 0 | 1 | 2,
      ...(n === 0 ? { position: v(.85, 0, -.2) } : {}), topSpeedMps: 8, accelerationMps2: 5.2, reactionSeconds: .18 })) });
  expect(result.end.complete).toBe(true);
  expect(result.facts.some(f => f.kind === 'catch_secured')).toBe(true);
  for (const c of result.diagnostics.simultaneousContacts) {
    expect(c.actorNormalSpeed).toBeGreaterThanOrEqual(0); expect(c.groundNormalSpeed).toBeGreaterThanOrEqual(0);
    expect(c.sameClockAndPosition).toBe(true);
  }
  for (const proof of result.diagnostics.departureProofs) expect(proof.actualGapAtEscapeMeters).toBeGreaterThan(0);
});

it('extends a finite free-ball cache from its original root without changing any sampled physics', () => {
  const input = liveFieldFixture(), ball = { ...input.ball, ball: { ...input.ball.ball, velocity: v(0, 4, 3) } },
    through = ball.elapsedSeconds + 9, source = createSourceFreeBallKernel({ kind: 'aero_ground_continuous_source_kernel_v2',
      initial: ball, throughElapsedSeconds: through, profile: input.physics });
  const result = simulateLiveFieldPlayV1({ ...input, ball, maxPlaySeconds: 9,
    fielders: input.fielders.map((f, i) => ({ ...f, position: v(30 + i, 1, 60), reactionSeconds: 20 })) });
  expect(result.end.reason).toBe('scope_exhausted'); expect(result.diagnostics.kernelBuilds).toBe(1);
  expect(result.diagnostics.kernelExtensions).toBe(1);
  for (const frame of result.frames) {
    const actual = source.evaluateAt(frame.elapsedSeconds, 'outgoing');
    expect(frame.ball.position).toEqual(actual.moment.ball.position);
    expect(frame.ball.velocity).toEqual(actual.moment.ball.velocity);
    expect(frame.ball.spin).toEqual(actual.moment.ball.spin);
    expect(frame.ball.orientation).toEqual(actual.orientation);
  }
});

it('keeps a deep retrieved ball when every force throw would arrive after the runner', () => {
  const input = liveFieldFixture(), result = simulateLiveFieldPlayV1({ ...input, outs: 0,
    ball: { ...input.ball, ball: { ...input.ball.ball, position: v(0, .2, 90), velocity: v(0, -1, 0) } },
    fielders: input.fielders.map((f, i) => ({ ...f, reactionSeconds: 3, ...(i === 7 ? { position: v(0, 1, 91) } : {}) })) });
  expect(result.end).toMatchObject({ complete: true, reason: 'live_action_complete' });
  expect(result.facts.some(f => f.kind === 'catch_secured')).toBe(true);
  expect(result.facts.filter(f => f.kind === 'throw_release')).toEqual([]);
  expect(result.finalRunners[0]).toMatchObject({ base: 1, retired: false });
});

it('rejects unready force receivers without fictional throws while the batter takes a safe extra base and declines an unsafe third', () => {
  const input = liveFieldFixture(), result = simulateLiveFieldPlayV1({ ...input, outs: 0,
    ball: { ...input.ball, ball: { ...input.ball.ball, position: v(0, .2, 0), velocity: v(1, -1, 5) } },
    fielders: input.fielders.map((f, i) => ({ ...f, ...(i === 0 ? {} : { reactionSeconds: 60 }),
      ...(i === 2 ? { position: v(25, 1, 25) } : {}) })) });
  if (process.env.FIELDING_DIAG_REPORT === '1') console.log('UNREADY_RECEIVER_TRACE', JSON.stringify({
    facts: result.facts.filter(f => ['catch_secured', 'throw_release', 'controlled_base_contact', 'controlled_runner_tag', 'runner_base_touch', 'play_end'].includes(f.kind)),
    decisions: result.diagnostics.aiTelemetry.runnerDecisions,
    motions: result.diagnostics.aiTelemetry.runnerMotions.map(m => ({ elapsedSeconds: m.elapsedSeconds, throughBases: m.throughBases, durationSeconds: m.durationSeconds })),
    holderStates: result.diagnostics.aiTelemetry.holderDecisions.filter((d, i, a) => i === 0 || d.state !== a[i - 1].state || d.base !== a[i - 1].base),
    relayPlans: result.diagnostics.aiTelemetry.relayPlans.filter((d, i, a) => i === 0 || d.kind !== a[i - 1].kind || d.base !== a[i - 1].base),
    finalRunners: result.finalRunners }));
  expect(result.end).toMatchObject({ complete: true, reason: 'live_action_complete' });
  expect(result.ruleFacts.runnerTouches.map(f => f.base)).toEqual([1, 2]);
  const lastArrival = result.facts.filter(f => f.kind === 'runner_base_touch').at(-1)!;
  expect(result.end.elapsedSeconds).toBeGreaterThanOrEqual(lastArrival.elapsedSeconds);
  const lastMotion = result.diagnostics.aiTelemetry.runnerMotions.filter(m => m.runnerId === 'batter').at(-1)!;
  const motorEnd = lastMotion.elapsedSeconds + lastMotion.durationSeconds;
  expect(motorEnd).toBeGreaterThan(lastArrival.elapsedSeconds);
  expect(result.end.elapsedSeconds).toBeGreaterThanOrEqual(motorEnd);
  expect(result.end.elapsedSeconds - motorEnd).toBeLessThanOrEqual(result.model.controlSeconds + 1e-9);
  expect(result.facts.some(f => f.kind === 'catch_secured')).toBe(true);
  expect(result.diagnostics.handPreparationProofs).toEqual([]);
  expect(result.facts.filter(f => f.kind === 'throw_release')).toEqual([]);
  expect(result.ruleFacts.controlledBaseContacts).toEqual([]);
  expect(result.ruleFacts.controlledRunnerTags).toEqual([]);
  expect(result.diagnostics.throwDecisions).toEqual([]);
  expect(result.diagnostics.aiTelemetry.relayPlans.some(d => d.base === 1 && d.kind === 'hold' && d.marginSeconds < 0)).toBe(true);
  expect(result.diagnostics.aiTelemetry.holderDecisions.some(d => d.state === 'pursue_tag')).toBe(true);
  const safeAdvance = result.diagnostics.aiTelemetry.runnerDecisions.find(d => d.targetBase === 2 && d.advance)!;
  expect(safeAdvance).toMatchObject({ reason: 'safe_race_advance' });
  expect(safeAdvance.raceMarginSeconds).toBeGreaterThan(LIVE_RUNNER_ADVANCE_POLICY_V1.safetyMarginSeconds);
  expect(result.diagnostics.aiTelemetry.runnerDecisions.some(d => d.targetBase === 3 && !d.advance
    && d.reason === 'insufficient_safety_margin')).toBe(true);
  expect(result.finalRunners[0]).toMatchObject({ base: 2, retired: false, scored: false });
});

it('cancels a prepared force command when an actual nearby body keeps the release blocked until the runner touches first', () => {
  const input = liveFieldFixture(), result = simulateLiveFieldPlayV1({ ...input, outs: 0,
    ball: { ...input.ball, ball: { ...input.ball.ball, position: v(0, .2, 10), velocity: v(0, -1, .1) } },
    fielders: input.fielders.map((f, i) => i === 8 ? { ...f, reactionSeconds: 60, position: v(.45, 1.7, 10.22) } : f) });
  expect(result.end).toMatchObject({ complete: true, reason: 'live_action_complete' });
  expect(result.facts.some(f => f.kind === 'catch_secured')).toBe(true);
  expect(result.diagnostics.handPreparationProofs).toHaveLength(1);
  expect(result.facts.filter(f => f.kind === 'throw_release')).toEqual([]);
  expect(result.ruleFacts.runnerTouches.map(f => f.base)).toEqual([1]);
  expect(result.diagnostics.throwDecisions.some(d => d.reason === 'force_already_satisfied')).toBe(true);
  const cancelled = result.diagnostics.throwDecisions.find(d => d.reason === 'force_already_satisfied')!,
    arrival = result.facts.find(f => f.kind === 'runner_base_touch')!;
  expect(cancelled.elapsedSeconds).toBeGreaterThanOrEqual(arrival.elapsedSeconds);
  expect(cancelled.elapsedSeconds - arrival.elapsedSeconds).toBeLessThanOrEqual(result.model.controlSeconds);
  expect(result.finalRunners[0]).toMatchObject({ base: 1, retired: false });
});
