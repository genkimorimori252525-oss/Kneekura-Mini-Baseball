import { expect, it } from 'vitest';
import { convertLiveFieldFramesV98 } from './LiveFieldFrameConversionV98';
import type { LiveMatchFrameV1 } from './LiveBaseballMatchV1';
import type { LiveFieldFrameV1, LiveFieldFactV1, LiveFieldRuleFactsV1 } from '../../core/sim/fielding/LiveFieldPlayV1';
import type { PlayableMatchRuleResultV1 } from './PlayableMatchRulesV1';

const zero = () => ({ x: 0, y: 0, z: 0 });
const roles = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const;
const defense = Object.fromEntries(roles.map(role => [role, 'def-' + role])) as Record<typeof roles[number], string>;
const ready: LiveMatchFrameV1 = { tick: 100, ball: null, bat: null, actors: [], batterPlayerId: 'batter', pitcherPlayerId: 'def-P',
  phase: 'ready', ballKind: 'pitch', fairKnown: false, possessedBy: null };
const frame = (tick: number, possessedBy: string | null): LiveFieldFrameV1 => ({ tick, elapsedSeconds: tick / 1000,
  defensiveOpportunity: null,
  ball: { position: { x: 2, y: 1, z: 4 }, velocity: zero(), spin: zero(), orientation: { x: 0, y: 0, z: 0, w: 1 },
    visible: possessedBy === null, possessedBy, phase: possessedBy ? 'possessed' : 'airborne' },
  fielders: roles.map(role => ({ playerId: defense[role], position: { x: role === 'RF' ? 2 : 0, y: .9, z: 4 },
    velocity: zero(), glove: { x: 0, y: 1, z: 4 }, intent: role === 'RF' ? 'intercept' : 'hold', targetBase: null })),
  runners: [{ runnerId: 'batter', position: { x: 3, y: 0, z: 5 }, velocity: { x: 4, y: 0, z: 4 }, currentBase: 0,
    targetBase: 1, retired: tick >= 300, scored: false }] });

it('does not present an HR confirmation from a physical pole observation without adopted legal policy', () => {
  const ruleFacts: LiveFieldRuleFactsV1 = { contactTick: 100, throughTick: 300, territory: 'fair', firstGroundContactTick: null,
    flyCatch: null, runnerTouches: [], controlledBaseContacts: [], controlledRunnerTags: [], runnerDepartures: [],
    overFence: { tick: 250, fair: true, untouchedGround: true }, playEnd: { kind: 'play_end', tick: 300, reason: 'dead_ball' },
    pendingEquipmentPolicyV148: { firstContactTick: 200, surfaceIds: ['synthetic-pole'] } };
  const result = convertLiveFieldFramesV98({ field: { frames: [frame(100, null), frame(300, null)], facts: [], ruleFacts },
    readyFrame: ready, defense, battingTeam: 0, ticksPerSecond: 1000, rules: { kind: 'unresolved', reason: 'pole_legal_policy_unadopted_v148', tick: 200 } });
  expect(result.every(f => f.homeRunConfirmed === false)).toBe(true);
});

it('preserves the former Host conversion including throw transitions, flattening and retired-runner movement', () => {
  const facts: LiveFieldFactV1[] = [{ kind: 'territory_determined', tick: 100, elapsedSeconds: .1, reason: 'fair' },
    { kind: 'catch_secured', tick: 180, elapsedSeconds: .18, playerId: 'def-RF' },
    { kind: 'throw_release', tick: 250, elapsedSeconds: .25, playerId: 'def-RF' }];
  const ruleFacts = { overFence: { tick: 280, fair: true, untouchedGround: true } } as LiveFieldRuleFactsV1;
  const source = { frames: [frame(100, null), frame(200, 'def-RF'), frame(400, null)], facts, ruleFacts };
  const rules = { kind: 'applied', outcomes: [{ runnerId: 'batter', tick: 300 }] } as unknown as PlayableMatchRuleResultV1;
  const before = JSON.stringify(source), sampleBatAtTick = (tick: number) => ({ grip: zero(), tip: { x: tick, y: 1, z: 2 } });
  const result = convertLiveFieldFramesV98({ field: source, readyFrame: ready, defense, battingTeam: 0,
    ticksPerSecond: 1000, rules, sampleBatAtTick });
  // Pinned transcription of the pre-v98 Host formula, independent of the helper.
  let lastThrow = -Infinity, observer: string | undefined;
  const legacy = source.frames.map(f => {
    const events = source.facts.filter(e => e.tick <= f.tick);
    lastThrow = events.filter(e => e.kind === 'throw_release').at(-1)?.tick ?? -Infinity;
    const latestCatch = events.filter(e => e.kind === 'catch_secured').at(-1);
    observer = f.ball.possessedBy ?? latestCatch?.playerId ?? f.fielders.filter(a => a.intent === 'intercept')
      .sort((a, b) => Math.hypot(a.position.x - f.ball.position.x, a.position.z - f.ball.position.z)
        - Math.hypot(b.position.x - f.ball.position.x, b.position.z - f.ball.position.z))[0]?.playerId;
    return { ...ready, tick: f.tick, ball: f.ball, bat: sampleBatAtTick(f.tick), actors: [
      ...f.fielders.map(a => ({ playerId: a.playerId, role: roles.find(pos => defense[pos] === a.playerId)!, team: 1,
        position: { ...a.position, y: 0 }, velocity: a.velocity })),
      ...f.runners.map(r => { const out = rules.kind === 'applied' ? rules.outcomes.find(o => o.runnerId === r.runnerId) : null,
        dt = out ? Math.max(0, (f.tick - out.tick) / 1000) : 0, dx = -30 - r.position.x, dz = 3 - r.position.z,
        length = Math.hypot(dx, dz), travel = Math.min(length, dt * 3.2);
        return { playerId: r.runnerId, role: 'runner', team: 0, position: { x: r.position.x + dx / (length || 1) * travel,
          y: 0, z: r.position.z + dz / (length || 1) * travel }, velocity: dt > 0 ? { x: dx / (length || 1) * 3.2,
          y: 0, z: dz / (length || 1) * 3.2 } : r.velocity, retired: r.retired }; })],
      phase: f.ball.possessedBy ? 'held' : lastThrow >= (latestCatch?.tick ?? Infinity) ? 'throw' : 'batted',
      ballKind: lastThrow >= (latestCatch?.tick ?? Infinity) ? 'throw' : 'batted',
      fairKnown: events.some(e => e.kind === 'territory_determined' && e.reason === 'fair'), possessedBy: f.ball.possessedBy,
      fieldObserverPlayerId: observer, defensiveOpportunity: f.defensiveOpportunity,
      homeRunConfirmed: !!source.ruleFacts.overFence?.fair && source.ruleFacts.overFence.untouchedGround && f.tick >= source.ruleFacts.overFence.tick };
  });
  expect(JSON.stringify(result)).toBe(JSON.stringify(legacy)); expect(JSON.stringify(source)).toBe(before);
  expect(result.map(f => f.phase)).toEqual(['batted', 'held', 'throw']);
  expect(result[0].actors[0].position.y).toBe(0); expect(result[0].fieldObserverPlayerId).toBe('def-RF');
  expect(result[2].actors.at(-1)!.velocity).not.toEqual(source.frames[2].runners[0].velocity);
});

it('does not fabricate a bat or retired-runner movement for an unresolved practice play', () => {
  const result = convertLiveFieldFramesV98({ field: { frames: [frame(200, null)], facts: [],
    ruleFacts: { overFence: null } as LiveFieldRuleFactsV1 }, readyFrame: ready, defense, battingTeam: 1,
    ticksPerSecond: 1000, rules: null });
  expect(result[0].bat).toBeNull(); expect(result[0].actors[0].team).toBe(0);
  expect(result[0].actors.at(-1)).toMatchObject({ team: 1, position: { x: 3, y: 0, z: 5 }, velocity: { x: 4, y: 0, z: 4 } });
});

it('passes the canonical body pose and its elevated foot anchor without rewriting Source observations', () => {
  const source = frame(200, null), pose = { foot: { x: 2, y: .12, z: 4 }, hip: { x: 2, y: .62, z: 4 },
    shoulder: { x: 2, y: 1.12, z: 4 }, head: { x: 2, y: 1.42, z: 4 }, eye: { x: 2, y: 1.28, z: 4 },
    eyeVelocity: { x: 0, y: -.4, z: 0 }, forward: { x: 0, y: 0, z: -1 }, crouchMeters: .4, armReachMeters: .8 };
  Object.assign(source.fielders[8], { bodyPoseV105: pose });
  const before = JSON.stringify(source), result = convertLiveFieldFramesV98({ field: { frames: [source], facts: [],
    ruleFacts: { overFence: null } as LiveFieldRuleFactsV1 }, readyFrame: ready, defense, battingTeam: 0,
    ticksPerSecond: 1000, rules: null });
  const actor = result[0].actors.find(a => a.playerId === 'def-RF')!;
  expect(actor.position).toEqual(pose.foot); expect(actor.bodyPoseV105).toBe(pose);
  expect(source.fielders[8].position).toEqual({ x: 2, y: .9, z: 4 });
  expect(JSON.stringify(source)).toBe(before);
});

it('V115 retains field actions and runner slide poses, including physical motion after an out', () => {
  const source = frame(400, null), pose = { foot: { x: 2, y: .4, z: 4 }, hip: { x: 2, y: .7, z: 4 },
    shoulder: { x: 2.3, y: .8, z: 4 }, head: { x: 2.7, y: .85, z: 4 }, eye: { x: 2.65, y: .8, z: 4 },
    eyeVelocity: { x: 3, y: -.2, z: 0 }, forward: { x: 1, y: 0, z: 0 }, crouchMeters: .2, armReachMeters: .8 },
    fieldAction = { kind: 'dive', phase: 'airborne', fromSeconds: .2, throughSeconds: 1.5 } as const,
    runAction = { kind: 'head_slide', phase: 'slide' } as const;
  Object.assign(source.fielders[8], { bodyPoseV105: pose, athleticV115: fieldAction });
  Object.assign(source.runners[0], { bodyPoseV105: pose, athleticV115: runAction });
  const before = JSON.stringify(source), result = convertLiveFieldFramesV98({ field: { frames: [source], facts: [],
    ruleFacts: { overFence: null } as LiveFieldRuleFactsV1 }, readyFrame: ready, defense, battingTeam: 0,
    ticksPerSecond: 1000, rules: { kind: 'applied', outcomes: [{ runnerId: 'batter', tick: 300 }] } as unknown as PlayableMatchRuleResultV1 });
  const fielder = result[0].actors.find(a => a.playerId === 'def-RF')!, runner = result[0].actors.at(-1)!;
  expect(fielder.athleticV115).toBe(fieldAction); expect(fielder.bodyPoseV105).toBe(pose);
  expect(runner.athleticV115).toBe(runAction); expect(runner.bodyPoseV105).toBe(pose);
  expect(runner.position).toBe(pose.foot); expect(runner.velocity).toBe(source.runners[0].velocity);
  expect(runner.retired).toBe(true); expect(JSON.stringify(source)).toBe(before);
});
