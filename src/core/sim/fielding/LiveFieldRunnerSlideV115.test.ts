import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../model/geometry';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../ball/BaseballAerodynamics';
import { resolveLiveAthleticProfileV115 } from '../LiveAthleticControlsV115';
import { simulateLiveFieldPlayV1, type LiveFieldPlayInputV1 } from './LiveFieldPlayV1';
import { buildLivePostPlayFramesV115, type LiveMatchFrameV1, type LivePositionV1 } from '../../../integration/browser/LiveBaseballMatchV1';
import { convertLiveFieldFramesV98 } from '../../../integration/browser/LiveFieldFrameConversionV98';

const v = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const defense = Object.fromEntries(['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'].map((role, i) => [role, `f${i}`])) as Record<LivePositionV1, string>;
const ready: LiveMatchFrameV1 = { tick: 0, ball: null, bat: null, actors: [], batterPlayerId: 'batter', pitcherPlayerId: 'f0',
  phase: 'ready', ballKind: 'pitch', fairKnown: false, possessedBy: null };
const fixture = (): LiveFieldPlayInputV1 => {
  const tps = 1e6;
  return {
    ball: { originTick: 0, elapsedSeconds: 0, ball: { tick: 0, position: v(0, .04, 30), velocity: v(0, -.1, 3), spin: v() } },
    physics: { kind: 'aero_ground_v1', air: { ticksPerSecond: tps, integrationStepTicks: 4000, gravityY: -9.81,
      aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS }, ground: { ticksPerSecond: tps, gravityMps2: 9.81,
      radiusM: .0366, inertiaRatio: .378, restingVerticalSpeedMps: .15, material: { restitution: .4,
        slidingFriction: .25, rollingDecelerationMps2: 1, normalSpinDecayPerSecond: .5 } } },
    field: { bases: { home: v(), first: v(8, 0, 8), second: v(0, 0, 16), third: v(-8, 0, 8) },
      fenceRadiusMeters: 120, fenceHeightMeters: 2 },
    fielders: Array.from({ length: 9 }, (_, i) => ({ playerId: `f${i}`, position: v((i - 4) * 8, 1, 80),
      reactionSeconds: 20, topSpeedMps: 1, accelerationMps2: 2, gloveSpeedMps: 2, gloveReachMeters: 1,
      gloveRadiusMeters: .1, transferSeconds: .3, throwSpeedMps: 20,
      catchRetention: { ticksPerSecond: tps, ballMassKg: .145, ballRadiusMeters: .0366, pocketRadiusMeters: .3,
        centerRetentionCapacityJ: 150, captureDissipationPowerW: 3000, failedContactRestitution: .2,
        failedTangentialDamping: .4, failedSpinDamping: .2 } })),
    runners: [{ runnerId: 'batter', initialBase: 0, topSpeedMps: 8, accelerationMps2: 5, reactionSeconds: 0,
      athleticProfileV115: resolveLiveAthleticProfileV115({ heightMeters: 1.8, accelerationMps2: 5,
        reactionSeconds: 0, gloveSpeedMps: 8, controls: { runHeadSlidePreferenceV115: 1 } }) }],
    outs: 0, maxPlaySeconds: 4.8, frameSeconds: .005,
  };
};

describe('live FieldPlay runner slide V115', () => {
  it('keeps an uncontested forced advance as ordinary running with the default head preference', () => {
    const source = fixture(), profile = resolveLiveAthleticProfileV115({ heightMeters: 1.8,
      accelerationMps2: 5, reactionSeconds: 0, gloveSpeedMps: 8 }),
      result = simulateLiveFieldPlayV1({ ...source, runners: [...source.runners,
        { runnerId: 'lead', initialBase: 1, topSpeedMps: 8, accelerationMps2: 5, reactionSeconds: 0, athleticProfileV115: profile }] });
    expect(result.diagnostics.aiTelemetry.runnerMotions.some(m => m.runnerId === 'lead' && m.throughBases.includes(2))).toBe(true);
    expect(result.frames.every(f => !f.runners.find(r => r.runnerId === 'lead')!.athleticV115)).toBe(true);
  });

  it('publishes the real first-base hand contact and continuous eye velocity while keeping the committed motor', () => {
    const source = fixture(), result = simulateLiveFieldPlayV1(source), bag = source.field.bases.first,
      lowered = result.frames.filter(f => f.runners[0].athleticV115?.phase === 'slide');
    expect(lowered.length).toBeGreaterThan(10);
    expect(result.frames.some(f => f.runners[0].athleticV115?.phase === 'recover')).toBe(true);
    const touch = result.facts.find(f => f.kind === 'runner_base_touch' && f.runnerId === 'batter' && f.base === 1)!;
    expect(touch).toBeDefined();
    expect(distance(touch.position!, bag)).toBeLessThanOrEqual(.28);
    const firstLow = lowered[0].elapsedSeconds,
      lastRecovery = result.frames.filter(f => f.runners[0].athleticV115?.phase === 'recover').at(-1)!.elapsedSeconds;
    expect(result.diagnostics.aiTelemetry.runnerMotions.filter(m => m.elapsedSeconds > firstLow && m.elapsedSeconds < lastRecovery)).toEqual([]);
    const transitionIndex = result.frames.findIndex(f => {
      const p = f.runners[0].bodyPoseV105;
      return f.runners[0].athleticV115?.phase === 'slide' && p && p.head.y > .6 && p.head.y < 1.5;
    });
    expect(transitionIndex).toBeGreaterThan(0);
    const before = result.frames[transitionIndex - 1], current = result.frames[transitionIndex], after = result.frames[transitionIndex + 1],
      elapsed = after.elapsedSeconds - before.elapsedSeconds, a = before.runners[0].bodyPoseV105!.eye,
      b = after.runners[0].bodyPoseV105!.eye, expected = v((b.x - a.x) / elapsed, (b.y - a.y) / elapsed, (b.z - a.z) / elapsed);
    expect(distance(current.runners[0].bodyPoseV105!.eyeVelocity, expected)).toBeLessThan(.03);
  });

  it('tags the grounded body before hand contact and lets a retired committed slide finish physically', () => {
    const source = fixture(), along = 1 / Math.sqrt(2), defender = v(8 - .9 * along, .35, 8 - .9 * along),
      result = simulateLiveFieldPlayV1({ ...source,
        ball: { ...source.ball, ball: { ...source.ball.ball,
          position: v(defender.x - 1.2 * along, .04, defender.z - 1.2 * along), velocity: v(4 * along, -.1, 4 * along) } },
        fielders: source.fielders.map((f, i) => i ? f : { ...f, position: defender, gloveRadiusMeters: .3 }),
        runners: [...source.runners, { runnerId: 'second', initialBase: 2, topSpeedMps: .01, accelerationMps2: .01, reactionSeconds: 0 }],
      });
    expect(result.ruleFacts.flyCatch).toBeNull();
    expect(result.ruleFacts.controlledRunnerTags).toHaveLength(1);
    expect(result.ruleFacts.runnerTouches).toHaveLength(0);
    const tagged = result.facts.find(f => f.kind === 'controlled_runner_tag')!,
      after = result.frames.filter(f => f.elapsedSeconds > tagged.elapsedSeconds && f.runners[0].retired);
    expect(after.some(f => f.runners[0].athleticV115?.phase === 'slide' && distance(f.runners[0].velocity, v()) > .1)).toBe(true);
    expect(after.some(f => f.runners[0].athleticV115?.phase === 'recover')).toBe(true);
    expect(result.end).toMatchObject({ complete: true, reason: 'live_action_complete' });
    expect(result.frames.at(-1)!.runners[0].athleticV115?.phase).toBe('stand');
  });

  it('keeps a real hand touch protected when the low head and recovering torso later reach the glove', () => {
    const source = fixture(), direction = -1 / Math.sqrt(2), defender = v(-8, .35, 8),
      result = simulateLiveFieldPlayV1({ ...source, outs: 2,
        ball: { ...source.ball, ball: { ...source.ball.ball,
          position: v(defender.x - 1.2 * direction, .04, defender.z - 1.2 * direction), velocity: v(4 * direction, -.1, 4 * direction) } },
        fielders: source.fielders.map((f, i) => i === 0 ? { ...f, position: defender, gloveRadiusMeters: .3 }
          : i === 1 ? { ...f, position: v(0, 1, 0), reactionSeconds: 0, topSpeedMps: 8, accelerationMps2: 5 } : f),
        runners: [{ runnerId: 'batter', initialBase: 0, topSpeedMps: .01, accelerationMps2: .01, reactionSeconds: 0 },
          { ...source.runners[0], runnerId: 'lead', initialBase: 2 }],
      });
    expect(result.ruleFacts.flyCatch).toBeNull();
    const touch = result.facts.find(f => f.kind === 'runner_base_touch' && f.runnerId === 'lead' && f.base === 3);
    expect(touch).toBeDefined();
    expect(result.frames.some(f => f.runners[1].athleticV115?.phase === 'recover')).toBe(true);
    expect(result.ruleFacts.controlledRunnerTags.filter(t => t.runnerId === 'lead')).toEqual([]);
    expect(result.finalRunners.find(r => r.runnerId === 'lead')!.retired).toBe(false);
  });

  it('keeps the third-out fact clock at the actual low-body tag while the source slide is unfinished', () => {
    const source = fixture(), along = 1 / Math.sqrt(2), defender = v(8 - .9 * along, .35, 8 - .9 * along),
      result = simulateLiveFieldPlayV1({ ...source, outs: 2,
        ball: { ...source.ball, ball: { ...source.ball.ball,
          position: v(defender.x - 1.2 * along, .04, defender.z - 1.2 * along), velocity: v(4 * along, -.1, 4 * along) } },
        fielders: source.fielders.map((f, i) => i ? f : { ...f, position: defender, gloveRadiusMeters: .3 }),
        runners: [...source.runners, { runnerId: 'second', initialBase: 2, topSpeedMps: .01, accelerationMps2: .01, reactionSeconds: 20 }],
      }), tag = result.facts.find(f => f.kind === 'controlled_runner_tag')!,
      officialFrame = result.frames.find(f => f.elapsedSeconds === result.end.elapsedSeconds)!;
    expect(result.end).toMatchObject({ complete: true, reason: 'third_out', elapsedSeconds: tag.elapsedSeconds, tick: tag.tick });
    expect(officialFrame.runners[0].retired).toBe(true);
    expect(officialFrame.runners[0].athleticV115?.phase).toBe('slide');
    expect(officialFrame.runners[0].bodyPoseV105!.head.y).toBeCloseTo(.414, 10);
    expect(distance(officialFrame.runners[0].velocity, v())).toBeGreaterThan(.1);
    expect(result.diagnostics.aiTelemetry.runnerMotions[0].durationSeconds).toBeGreaterThan(result.end.elapsedSeconds);
    const recovery = result.recoveryFramesV115!;
    expect(recovery?.length).toBeGreaterThan(0);
    expect(recovery.every(f => f.tick > result.end.tick && f.recoveryV115?.officialEndTick === result.end.tick)).toBe(true);
    expect(recovery.some(f => f.runners[0].athleticV115?.phase === 'slide')).toBe(true);
    expect(recovery.some(f => f.runners[0].athleticV115?.phase === 'recover')).toBe(true);
    expect(recovery.at(-1)!.runners[0].athleticV115?.phase).toBe('stand');
    expect(recovery.at(-1)!.runners[0].bodyPoseV105!.head.y).toBeCloseTo(1.692, 10);
    expect(recovery.at(-1)!.ball.position).toEqual(officialFrame.ball.position);
    expect(recovery.at(-1)!.fielders.map(f => f.position)).toEqual(officialFrame.fielders.map(f => f.position));
    expect(result.finalRunners[0].position).toEqual(officialFrame.runners[0].position);
    expect(result.frames.every(f => f.tick <= result.end.tick)).toBe(true);
    expect(Object.isFrozen(recovery)).toBe(true);
    const sourceBefore = JSON.stringify(result),
      lastFrame = convertLiveFieldFramesV98({ field: { ...result, frames: [officialFrame] }, readyFrame: ready,
        defense, battingTeam: 0, ticksPerSecond: 1e6, rules: null })[0],
      post = buildLivePostPlayFramesV115({ lastFrame, field: result, readyFrame: ready, defense,
        battingTeam: 0, ticksPerSecond: 1e6, officialEndTick: result.end.tick }),
      recovered = post.filter(f => f.recoveryV115), bench = post.filter(f => f.phase === 'bench'),
      recoveredActor = recovered.at(-1)!.actors.find(a => a.playerId === 'batter')!,
      benchActor = bench[0].actors.find(a => a.playerId === 'batter')!;
    expect(recovered).toHaveLength(recovery.length);
    expect(recoveredActor.bodyPoseV105).toEqual(recovery.at(-1)!.runners[0].bodyPoseV105);
    expect(bench[0].tick).toBe(recovered.at(-1)!.tick + 55000);
    expect(benchActor.bodyPoseV105!.head.y).toBeCloseTo(1.692, 10);
    expect(benchActor.bodyPoseV105!.crouchMeters).toBe(0);
    expect(bench[0].recoveryV115).toBeUndefined();
    expect(bench.at(-1)!.tick - recovered.at(-1)!.tick).toBe(3000000);
    expect(distance(benchActor.position, recoveredActor.position)).toBeCloseTo(.055 * 3.2, 10);
    expect(JSON.stringify(result)).toBe(sourceBefore);
    if (process.env.FIELDING_DIAG_REPORT === '1') console.log('SLIDE_THIRD_OUT_TAIL', JSON.stringify({
      end: result.end, runner: officialFrame.runners[0], motionEnd: result.diagnostics.aiTelemetry.runnerMotions[0].durationSeconds,
    }));
  });

  it('retains the established three-second bench clock when no action recovery exists', () => {
    const post = buildLivePostPlayFramesV115({ lastFrame: { ...ready, tick: 100 }, field: null, readyFrame: ready,
      defense, battingTeam: 0, ticksPerSecond: 1000, officialEndTick: 200 });
    expect(post[0].tick).toBe(255);
    expect(post.at(-1)!.tick).toBe(3200);
    expect(post.every(f => f.phase === 'bench' && !f.recoveryV115)).toBe(true);
  });
});
