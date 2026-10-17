import { expect, it } from 'vitest';
import { simulateLiveFieldPlayV1, type LiveFieldPlayInputV1 } from './LiveFieldPlayV1';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../ball/BaseballAerodynamics';
const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
/** Explicit synthetic movement fixture, with no league/person calibration. */
const fixture = (): LiveFieldPlayInputV1 => ({
  ball: { originTick: 0, elapsedSeconds: 0, ball: { tick: 0, position: v(0, .2, 0), velocity: v(0, -1, 8), spin: v() } },
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
  runners: [{ runnerId: 'batter', initialBase: 0, topSpeedMps: 8, accelerationMps2: 5, reactionSeconds: .1 }], outs: 0, maxPlaySeconds: 8,
});

it('executes unique receiver coverage through a real throw while spare outfielders retain deep coverage', () => {
  const raw = fixture(), before = JSON.stringify(raw), result = simulateLiveFieldPlayV1(raw), releases = result.facts.filter(f => f.kind === 'throw_release');
  expect(releases.length).toBeGreaterThan(0);
  for (const frame of result.frames) for (const base of [1, 2, 3, 4])
    expect(frame.fielders.filter(f => f.intent === 'base_cover' && f.targetBase === base).length).toBeLessThanOrEqual(1);
  for (const release of releases) {
    const frame = result.frames.find(f => f.elapsedSeconds >= release.elapsedSeconds)!;
    expect(frame.fielders.find(f => f.playerId === release.receiverPlayerId)).toMatchObject({ intent: 'base_cover', targetBase: release.base });
  }
  const active = result.frames.find(f => f.elapsedSeconds > .5)!;
  expect(active.fielders.filter(f => f.intent === 'hold' && f.position.z >= 60).length).toBeGreaterThanOrEqual(2);
  expect(result.ruleFacts.controlledBaseContacts.some(c => c.base === 1)).toBe(true);
  expect(JSON.stringify(raw)).toBe(before);
});

it('applies additional SI decision latency to actual motion rather than weakening the assignment algorithm', () => {
  const raw = fixture(), ordinary = simulateLiveFieldPlayV1({ ...raw, maxPlaySeconds: .5 }), delayed = simulateLiveFieldPlayV1({ ...raw, maxPlaySeconds: .5,
    fielders: raw.fielders.map(f => ({ ...f, fieldingCognition: { decisionSeconds: .2 } })) });
  for (const frame of delayed.frames.filter(f => f.elapsedSeconds <= .28)) for (let i = 0; i < raw.fielders.length; i++) {
    expect(frame.fielders[i].position).toEqual(raw.fielders[i].position);
    expect(frame.fielders[i].velocity).toEqual(v());
  }
  expect(ordinary.frames.some(f => f.elapsedSeconds < .28 && f.fielders.some((p, i) => p.position.z !== raw.fielders[i].position.z))).toBe(true);
  expect(delayed.frames.some(f => f.elapsedSeconds > .28 && f.fielders.some((p, i) => p.position.z !== raw.fielders[i].position.z))).toBe(true);
  expect(delayed.ruleFacts.firstGroundContactTick).toBe(ordinary.ruleFacts.firstGroundContactTick);
});

it('keeps actual positions and velocities continuous through role changes without candidate jumps', () => {
  const raw = fixture(), result = simulateLiveFieldPlayV1(raw);
  for (let k = 1; k < result.frames.length; k++) {
    const before = result.frames[k - 1], after = result.frames[k], dt = after.elapsedSeconds - before.elapsedSeconds;
    for (let i = 0; i < raw.fielders.length; i++) {
      const a = before.fielders[i], b = after.fielders[i], spec = raw.fielders[i];
      expect(Math.hypot(b.position.x - a.position.x, b.position.z - a.position.z)).toBeLessThanOrEqual(spec.topSpeedMps * dt + 1e-8);
      expect(Math.hypot(b.velocity.x - a.velocity.x, b.velocity.z - a.velocity.z)).toBeLessThanOrEqual(spec.accelerationMps2 * dt + 1e-8);
    }
  }
});

it('rejects invalid additional latency without inventing a result', () => {
  const raw = fixture();
  for (const decisionSeconds of [-.1, NaN, Infinity]) expect(() => simulateLiveFieldPlayV1({ ...raw,
    fielders: raw.fielders.map(f => ({ ...f, fieldingCognition: { decisionSeconds } })) })).toThrow();
});

it('keeps zero-error actual physics exact and launches a reproducible physical miss for nonzero angular error', () => {
  const raw = fixture(), old = simulateLiveFieldPlayV1(raw), zero = simulateLiveFieldPlayV1({ ...raw, seed: 41,
    fielders: raw.fielders.map(f => ({ ...f, throwDirectionStdRadians: 0 })) });
  expect(zero.facts).toEqual(old.facts); expect(zero.ruleFacts).toEqual(old.ruleFacts); expect(zero.frames).toEqual(old.frames);
  const erroneous = { ...raw, seed: 41, fielders: raw.fielders.map(f => ({ ...f, throwDirectionStdRadians: .04 })) },
    a = simulateLiveFieldPlayV1(erroneous), b = simulateLiveFieldPlayV1(erroneous),
    renamed = simulateLiveFieldPlayV1({ ...erroneous, fielders: erroneous.fielders.map(f => ({ ...f, playerId: 'renamed-' + f.playerId })) });
  expect(a.diagnostics.throwDirectionCommands.length).toBeGreaterThan(0);
  expect(a.facts).toEqual(b.facts);
  const command = a.diagnostics.throwDirectionCommands[0];
  expect(command.actual.velocity).not.toEqual(command.plannedVelocity);
  expect(renamed.diagnostics.throwDirectionCommands[0]).toEqual(command);
  const release = a.facts.find(f => f.kind === 'throw_release')!, frame = a.frames.find(f => f.elapsedSeconds > release.elapsedSeconds && !f.ball.possessedBy)!;
  const baseline = old.frames.find(f => f.elapsedSeconds === frame.elapsedSeconds);
  expect(baseline).toBeDefined(); expect(frame.ball.position).not.toEqual(baseline!.ball.position);
});
