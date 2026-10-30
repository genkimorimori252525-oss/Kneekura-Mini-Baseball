import { describe, expect, it } from 'vitest';
import {
  buildCanonicalFieldingPlayInputV1,
  CANONICAL_FIELDING_SCENARIOS_V1,
  diagnoseLiveFieldPlayV1,
  formatLiveFieldPlayDiagnosticReportV1,
  type AbilityTierV1,
} from './LiveFieldPlayDiagnosticsV1';
import { simulateLiveFieldPlayV1, type LiveFieldPlayInputV1 } from './LiveFieldPlayV1';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../ball/BaseballAerodynamics';

function actualNonforceTagInput(): LiveFieldPlayInputV1 {
  const v = (x = 0, y = 0, z = 0) => ({ x, y, z }), tps = 1e6;
  return {
    ball: { originTick: 0, elapsedSeconds: 0, ball: { tick: 0, position: v(18, .2, 19), velocity: v(0, -1, 1), spin: v() } },
    physics: { kind: 'aero_ground_v1', air: { ticksPerSecond: tps, integrationStepTicks: 4000, gravityY: -9.81,
      aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS }, ground: { ticksPerSecond: tps, gravityMps2: 9.81,
      radiusM: .0366, inertiaRatio: .378, restingVerticalSpeedMps: .15, material: { restitution: .4,
        slidingFriction: .25, rollingDecelerationMps2: 1, normalSpinDecayPerSecond: .5 } } },
    field: { bases: { home: v(), first: v(19.39, 0, 19.39), second: v(0, 0, 38.78), third: v(-19.39, 0, 19.39) },
      fenceRadiusMeters: 110, fenceHeightMeters: 2 },
    fielders: [v(0, 1, 10), v(0, 1, -2), v(20, 1, 20), v(-20, 1, 20), v(12, 1, 35), v(-12, 1, 35),
      v(-35, 1, 65), v(0, 1, 75), v(35, 1, 65)].map((position, i) => ({ playerId: `fielder-${i}`, position,
      reactionSeconds: .08, topSpeedMps: 7, accelerationMps2: 6, gloveSpeedMps: 11, gloveReachMeters: 1.3, gloveRadiusMeters: .1,
      transferSeconds: .25, throwSpeedMps: 32, throwBackspinRadPerSecond: 120, catchRetention: { ticksPerSecond: tps, ballMassKg: .145,
        ballRadiusMeters: .0366, pocketRadiusMeters: .3, centerRetentionCapacityJ: 150, captureDissipationPowerW: 3000,
        failedContactRestitution: .2, failedTangentialDamping: .4, failedSpinDamping: .2 } })),
    runners: [{ runnerId: 'batter', initialBase: 0, topSpeedMps: 2, accelerationMps2: 5, reactionSeconds: .1 },
      { runnerId: 'first-runner', initialBase: 1, topSpeedMps: 8, accelerationMps2: 5, reactionSeconds: .1 },
      { runnerId: 'second-runner', initialBase: 2, topSpeedMps: 8, accelerationMps2: 5, reactionSeconds: .1 },
      { runnerId: 'third-runner', initialBase: 3, topSpeedMps: 3, accelerationMps2: 5, reactionSeconds: .1 }],
    outs: 0, maxPlaySeconds: 20,
  };
}

describe('LiveFieldPlayDiagnosticsV1', () => {
  const diagnosticFixture = () => {
    const scenario = CANONICAL_FIELDING_SCENARIOS_V1.find(s => s.id === 'SS_up_middle')!;
    const built = buildCanonicalFieldingPlayInputV1(scenario);
    return { ...built, result: simulateLiveFieldPlayV1(built.input) };
  };

  it('detects an observed pair of overlapping fielder bodies with both tasks and distance', () => {
    const { input, result, roleMap } = diagnosticFixture(), last = result.frames.at(-1)!,
      fielders = last.fielders.map((f, i) => i < 2 ? { ...f, position: { x: i * .479, y: .9, z: 0 },
        intent: i === 0 ? 'backup' as const : 'base_cover' as const } : f),
      broken = { ...result, frames: [{ ...last, fielders }] }, diag = diagnoseLiveFieldPlayV1(input, broken, roleMap);
    expect(diag.anomalies).toContainEqual(expect.objectContaining({ kind: 'FIELDER_BODY_OVERLAP',
      elapsedSeconds: last.elapsedSeconds, playerId: fielders[0].playerId, otherPlayerId: fielders[1].playerId,
      distanceMeters: .479, playerIntent: 'backup', otherPlayerIntent: 'base_cover' }));
    expect(formatLiveFieldPlayDiagnosticReportV1(diag)).toContain('0.479m < 0.480m');
  });

  it.each([.48, .481])('accepts legal close coordination at a body-center distance of %sm', separation => {
    const { input, result, roleMap } = diagnosticFixture(), last = result.frames.at(-1)!,
      fielders = last.fielders.map((f, i) => i < 2 ? { ...f, position: { x: i * separation, y: .9, z: 0 } } : f),
      diag = diagnoseLiveFieldPlayV1(input, { ...result, frames: [{ ...last, fielders }] }, roleMap);
    expect(diag.anomalies.filter(a => a.kind === 'FIELDER_BODY_OVERLAP')).toEqual([]);
    expect(diag.fieldingSpacing.minimumObservedDistanceMeters).toBe(separation);
  });

  it('uses the declared body radius and observes three nearby fielders without inventing a cluster violation', () => {
    const { input, result, roleMap } = diagnosticFixture(), last = result.frames.at(-1)!,
      points = [{ x: 0, y: .9, z: 0 }, { x: .8, y: .9, z: 0 }, { x: .4, y: .9, z: .7 }],
      fielders = last.fielders.map((f, i) => i < 3 ? { ...f, position: points[i] } : f),
      clustered = { ...result, frames: [{ ...last, fielders }] }, diag = diagnoseLiveFieldPlayV1(input, clustered, roleMap);
    expect(diag.fieldingSpacing).toMatchObject({ observedTripleClusterFrameCount: 1, maximumActorsWithinTwoMeters: 3 });
    expect(diag.anomalies.filter(a => a.kind === 'FIELDER_BODY_OVERLAP')).toEqual([]);
    const largerBodyResult = { ...clustered, model: { ...result.model } };
    Object.defineProperty(largerBodyResult.model, 'bodyRadiusMeters', { value: .41 });
    const largerBodies = diagnoseLiveFieldPlayV1(input, largerBodyResult, roleMap);
    expect(largerBodies.anomalies).toContainEqual(expect.objectContaining({ kind: 'FIELDER_BODY_OVERLAP', distanceMeters: .8 }));
  });

  it('audits declared defensive positions rather than relying on fixture names or current coordinates', () => {
    const { input } = buildCanonicalFieldingPlayInputV1(CANONICAL_FIELDING_SCENARIOS_V1[0]);
    expect(input.fielders.map(f => f.defensivePosition)).toEqual(['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']);
  });

  it('detects a completed live play whose final observed runner is still advancing', () => {
    const { input, result, roleMap } = diagnosticFixture(), last = result.frames.at(-1)!;
    const broken = { ...result, frames: [...result.frames.slice(0, -1), { ...last,
      runners: last.runners.map(r => ({ ...r, targetBase: 2, velocity: { x: 1, y: 0, z: 0 } })) }] };
    expect(result.end.reason).toBe('live_action_complete');
    expect(diagnoseLiveFieldPlayV1(input, broken, roleMap).anomalies).toContainEqual(
      expect.objectContaining({ kind: 'LIVE_PLAY_CLOSED_WITH_ACTIVE_RUNNER', playerId: input.runners[0].runnerId }));
  });

  it('detects a completed live play with a free ball at the final observation', () => {
    const { input, result, roleMap } = diagnosticFixture(), last = result.frames.at(-1)!;
    const broken = { ...result, frames: [...result.frames.slice(0, -1), { ...last,
      ball: { ...last.ball, possessedBy: null, visible: true, phase: 'air' } }] };
    expect(diagnoseLiveFieldPlayV1(input, broken, roleMap).anomalies).toContainEqual(
      expect.objectContaining({ kind: 'LIVE_PLAY_CLOSED_WITH_FREE_BALL' }));
  });

  it('detects duplicate base cover assignments without treating nearby different tasks as duplicate coverage', () => {
    const { input, result, roleMap } = diagnosticFixture(), last = result.frames.at(-1)!;
    const broken = { ...result, frames: [{ ...last, fielders: last.fielders.map((f, i) => i < 2
      ? { ...f, intent: 'base_cover' as const, targetBase: 1 as const } : { ...f, intent: 'hold' as const, targetBase: null }) }] };
    expect(diagnoseLiveFieldPlayV1(input, broken, roleMap).anomalies).toContainEqual(
      expect.objectContaining({ kind: 'DUPLICATE_BASE_COVER', base: 1 }));
    const distinctTasks = { ...broken, frames: [{ ...broken.frames[0], fielders: broken.frames[0].fielders.map((f, i) => i === 1
      ? { ...f, intent: 'backup' as const, targetBase: null } : f) }] };
    expect(diagnoseLiveFieldPlayV1(input, distinctTasks, roleMap).anomalies.filter(a => a.kind === 'DUPLICATE_BASE_COVER')).toEqual([]);
  });

  it.each([-.01, 0])('detects retirement supported only by bag control after a legal first-base touch (offset=%s)', offset => {
    const scenario = CANONICAL_FIELDING_SCENARIOS_V1.find(s => s.id === 'SS_routine')!,
      { input, roleMap } = buildCanonicalFieldingPlayInputV1(scenario), result = simulateLiveFieldPlayV1(input),
      contact = result.facts.find(f => f.kind === 'controlled_base_contact' && f.base === 1)!,
      elapsedSeconds = contact.elapsedSeconds + offset, tick = contact.tick + Math.round(offset * input.physics.air.ticksPerSecond),
      touch = { kind: 'runner_base_touch' as const, runnerId: input.runners[0].runnerId, base: 1 as const,
        elapsedSeconds, tick, position: input.field.bases.first },
      broken = { ...result, facts: [...result.facts, touch], ruleFacts: { ...result.ruleFacts,
        runnerTouches: [...result.ruleFacts.runnerTouches, { kind: touch.kind, runnerId: touch.runnerId, base: touch.base, tick }] } };
    expect(result.finalRunners[0].retired).toBe(true);
    expect(diagnoseLiveFieldPlayV1(input, broken, roleMap).anomalies).toContainEqual(
      expect.objectContaining({ kind: 'UNSUPPORTED_RUNNER_RETIREMENT', playerId: touch.runnerId }));
  });

  it('detects an observed bag-volume arrival that precedes the official touch fact', () => {
    const { input, result, roleMap } = diagnosticFixture(), last = result.frames.at(-1)!,
      touch = result.facts.find(f => f.kind === 'runner_base_touch' && f.base === 1)!,
      elapsedSeconds = touch.elapsedSeconds - .02, base = input.field.bases.first,
      witness = { ...last, elapsedSeconds, tick: touch.tick - 20000,
        runners: last.runners.map(r => ({ ...r, currentBase: 0, retired: false, scored: false,
          position: { ...base, x: base.x - .1 }, velocity: { x: 1, y: 0, z: 0 }, targetBase: 1 })) },
      broken = { ...result, frames: [...result.frames.filter(f => f.elapsedSeconds !== elapsedSeconds), witness]
        .sort((a, b) => a.elapsedSeconds - b.elapsedSeconds) };
    expect(diagnoseLiveFieldPlayV1(input, broken, roleMap).anomalies).toContainEqual(
      expect.objectContaining({ kind: 'RUNNER_BASE_TOUCH_LATE', playerId: touch.runnerId, base: 1 }));
  });

  it('accepts an explicit controlled tag after first-base arrival as retirement evidence', () => {
    const scenario = CANONICAL_FIELDING_SCENARIOS_V1.find(s => s.id === 'SS_routine')!,
      { input, roleMap } = buildCanonicalFieldingPlayInputV1(scenario), result = simulateLiveFieldPlayV1(input),
      contact = result.facts.find(f => f.kind === 'controlled_base_contact' && f.base === 1)!, runnerId = input.runners[0].runnerId,
      touch = { kind: 'runner_base_touch' as const, runnerId, base: 1 as const, tick: contact.tick - 10000,
        elapsedSeconds: contact.elapsedSeconds - .01, position: input.field.bases.first },
      tag = { kind: 'controlled_runner_tag' as const, runnerId, playerId: contact.playerId,
        tick: contact.tick + 10000, elapsedSeconds: contact.elapsedSeconds + .01 },
      withTag = { ...result, facts: [...result.facts, touch, tag] };
    expect(diagnoseLiveFieldPlayV1(input, withTag, roleMap).anomalies.filter(a => a.kind === 'UNSUPPORTED_RUNNER_RETIREMENT')).toEqual([]);
  });

  it('reports sampled travel by actor and task without declaring long movement irrational', () => {
    const { input, result, roleMap } = diagnosticFixture(), last = result.frames.at(-1)!, actor = input.fielders[1],
      first = { ...last, fielders: last.fielders.map(f => f.playerId === actor.playerId ? { ...f, position: actor.position } : f) },
      second = { ...last, fielders: last.fielders.map(f => f.playerId === actor.playerId
        ? { ...f, position: { ...actor.position, x: actor.position.x + 3, z: actor.position.z + 4 }, intent: 'backup' as const } : f) },
      sampled = { ...result, frames: [first, second] }, diag = diagnoseLiveFieldPlayV1(input, sampled, roleMap);
    expect(diag.fieldingMovement.find(f => f.playerId === actor.playerId)).toMatchObject({ sampledTravelMeters: 5,
      maximumDistanceFromHomeMeters: 5, sampledTravelByIntentMeters: { backup: 5 } });
    expect(diag.anomalies.some(a => a.detail.includes('irrational'))).toBe(false);
  });

  it('recognizes an actual relay receipt away from the final bag without reporting a missing force-base touch', () => {
    const raw = actualNonforceTagInput(), v = (x = 0, y = 0, z = 0) => ({ x, y, z }), input = { ...raw,
      ball: { ...raw.ball, ball: { ...raw.ball.ball, position: v(0, .2, 90), velocity: v(0, -1, .1) } },
      fielders: raw.fielders.map((f, i) => ({ ...f, reactionSeconds: .01,
        position: i === 7 ? v(0, 1, 90) : i === 6 ? v(0, 1, 70) : f.position, throwSpeedMps: i === 7 ? 16 : 38 })),
      runners: raw.runners.map(r => ({ ...r, topSpeedMps: r.initialBase === 3 ? 3 : 12 })) },
      result = simulateLiveFieldPlayV1(input), before = JSON.stringify(result), diag = diagnoseLiveFieldPlayV1(input, result),
      relay = diag.throws.find(t => t.relayHop)!, final = diag.throws.find(t => t.forcePlay)!;
    expect(result.end.complete).toBe(true);
    expect(result.facts.some(f => f.kind === 'throw_release' && f.reason === 'relay_play')).toBe(true);
    expect(relay).toMatchObject({ forcePlay: false, relayHop: true, receptionOutcome: 'glove_secured', baseTouched: false,
      baseTouchElapsedSeconds: null, frozenByTransferBeforeBaseTouch: false });
    expect(relay.receiverDistanceToBaseAtReceptionMeters).toBeGreaterThan(60);
    expect(final).toMatchObject({ forcePlay: true, relayHop: false, receptionOutcome: 'glove_secured', baseTouched: true });
    expect(relay.receiverId).not.toBe(final.receiverId);
    expect(diag.anomalies.filter(a => a.kind === 'CAUGHT_THROW_NO_BASE_TOUCH')).toEqual([]);
    expect(formatLiveFieldPlayDiagnosticReportV1(diag)).toContain('play=relay');
    expect(JSON.stringify(result)).toBe(before);
  });

  it('recognizes an actual nonforce throw and catcher tag without requiring a bag contact', () => {
    const input = actualNonforceTagInput(), result = simulateLiveFieldPlayV1(input), before = JSON.stringify(result),
      diag = diagnoseLiveFieldPlayV1(input, result), tag = result.ruleFacts.controlledRunnerTags.find(t => t.runnerId === 'third-runner')!,
      release = result.facts.filter(f => f.kind === 'throw_release' && f.base === 4 && f.runnerId === tag.runnerId && f.tick < tag.tick).at(-1)!,
      exchange = diag.throws.find(t => t.releaseElapsedSeconds === release.elapsedSeconds)!;
    if (process.env.FIELDING_DIAG_REPORT === '1' && tag.defenderId !== release.receiverPlayerId)
      console.log('NONFORCE_TAG_TRACE', JSON.stringify({ facts: result.facts.filter(f => ['throw_release', 'catch_secured', 'controlled_runner_tag', 'play_end'].includes(f.kind)),
        contacts: result.diagnostics.aiTelemetry.contactDiagnostics, cancellations: result.diagnostics.aiTelemetry.throwTargetCancellations }));
    expect(result.end.complete).toBe(true);
    expect(release).toMatchObject({ reason: 'tag_play', runnerId: 'third-runner' });
    expect(exchange).toMatchObject({ forcePlay: false, receptionOutcome: 'glove_secured', baseTouched: false });
    expect(tag.defenderId).toBe(release.receiverPlayerId);
    expect(tag.tick).toBeGreaterThan(result.facts.find(f => f.kind === 'catch_secured' && f.playerId === release.receiverPlayerId && f.tick > release.tick)!.tick);
    expect(result.ruleFacts.controlledBaseContacts.filter(f => f.base === 4)).toEqual([]);
    expect(result.ruleFacts.runnerTouches.filter(f => f.runnerId === 'third-runner' && f.base === 4)).toEqual([]);
    expect(result.finalRunners.find(r => r.runnerId === 'third-runner')!.retired).toBe(true);
    expect(diag.anomalies.filter(a => a.kind === 'CAUGHT_THROW_NO_BASE_TOUCH')).toEqual([]);
    expect(formatLiveFieldPlayDiagnosticReportV1(diag)).toContain('play=tag');
    expect(JSON.stringify(result)).toBe(before);
  });

  it('distinguishes post-pass ball recovery from cancellation based on a stale pre-release observation', () => {
    const scenario = CANONICAL_FIELDING_SCENARIOS_V1.find(s => s.id === '56_hole_grounder')!,
      { input: positionedInput, roleMap } = buildCanonicalFieldingPlayInputV1(scenario, 'low'),
      // Preserve a known actual missed-throw recovery for the supported legacy
      // caller without declared positions. The 60-scenario matrix below uses
      // all nine explicit positions and tests the production role policy.
      input = { ...positionedInput, fielders: positionedInput.fielders.map(f => { const legacy = { ...f }; delete legacy.defensivePosition; return legacy; }) },
      result = simulateLiveFieldPlayV1(input),
      cancellation = result.diagnostics.aiTelemetry.throwTargetCancellations[0], release = result.facts.find(f => f.kind === 'throw_release')!;
    expect(cancellation).toBeDefined();
    expect(cancellation.seenAt).toBeGreaterThan(release.elapsedSeconds);
    const diag = diagnoseLiveFieldPlayV1(input, result, roleMap);
    if (process.env.FIELDING_DIAG_REPORT === '1' && !diag.throws[0].postPassRecovery)
      console.log('POST_PASS_TRACE', JSON.stringify({ release, cancellation, observed: result.frames.filter(f => f.elapsedSeconds <= cancellation.seenAt).at(-1)?.ball,
        nearby: result.frames.filter(f => f.elapsedSeconds >= cancellation.seenAt - .06 && f.elapsedSeconds < cancellation.seenAt + .06).map(f => ({ elapsedSeconds: f.elapsedSeconds, ball: f.ball })) }));
    expect(diag.throws[0]).toMatchObject({ cancelledMidFlight: false, postPassRecovery: true });
    expect(diag.anomalies.filter(a => a.kind === 'THROW_CANCELLED_MIDFLIGHT')).toEqual([]);
    // The actual passed-ball recovery must not excuse a command discarded on
    // a pre-release observation. Keep every physical fact/frame unchanged.
    const stale = { ...result, diagnostics: { ...result.diagnostics, aiTelemetry: { ...result.diagnostics.aiTelemetry,
      throwTargetCancellations: result.diagnostics.aiTelemetry.throwTargetCancellations.map((c, i) => i === 0
        ? { ...c, seenAt: release.elapsedSeconds - .01 } : c) } } };
    expect(diagnoseLiveFieldPlayV1(input, stale, roleMap).anomalies).toContainEqual(
      expect.objectContaining({ kind: 'THROW_CANCELLED_MIDFLIGHT', base: release.base }));
  });

  it.each(['force_play', undefined] as const)('retains missing-bag detection for a force throw (release reason=%s)', reason => {
    const scenario = CANONICAL_FIELDING_SCENARIOS_V1.find(s => s.id === 'SS_routine')!,
      { input, roleMap } = buildCanonicalFieldingPlayInputV1(scenario), result = simulateLiveFieldPlayV1(input),
      release = result.facts.find(f => f.kind === 'throw_release')!;
    expect(release.reason).toBe('force_play');
    expect(result.facts.some(f => f.kind === 'controlled_base_contact' && f.base === release.base)).toBe(true);
    // Deliberately remove the force-play bag observation to verify the anomaly detector remains active.
    const missingBagObservation = { ...result, facts: result.facts.filter(f => f.kind !== 'controlled_base_contact').map(f =>
      f.kind === 'throw_release' ? { ...f, reason } : f) }, diag = diagnoseLiveFieldPlayV1(input, missingBagObservation, roleMap);
    expect(diag.throws[0]).toMatchObject({ forcePlay: true, receptionOutcome: 'glove_secured', baseTouched: false });
    expect(diag.anomalies).toContainEqual(expect.objectContaining({ kind: 'CAUGHT_THROW_NO_BASE_TOUCH', base: release.base }));
  });

  it('accepts an explicitly evaluated losing hold while still reporting a contradictory positive throw opportunity', () => {
    const scenario = CANONICAL_FIELDING_SCENARIOS_V1.find(s => s.id === 'SS_up_middle')!,
      { input, roleMap } = buildCanonicalFieldingPlayInputV1(scenario), result = simulateLiveFieldPlayV1(input),
      diag = diagnoseLiveFieldPlayV1(input, result, roleMap);
    expect(result.facts.some(f => f.kind === 'catch_secured')).toBe(true);
    expect(result.facts.filter(f => f.kind === 'throw_release')).toEqual([]);
    expect(result.diagnostics.aiTelemetry.relayPlans.some(p => p.kind === 'hold' && p.marginSeconds < 0)).toBe(true);
    expect(diag.anomalies.filter(a => a.kind === 'HELD_BALL_NO_THROW_ON_FORCE')).toEqual([]);
    // Keep the same actual no-throw facts, but deliberately report a positive
    // controller opportunity. That inconsistency must remain detectable.
    const contradictoryEstimate = { ...result, diagnostics: { ...result.diagnostics, aiTelemetry: { ...result.diagnostics.aiTelemetry,
      holderDecisions: result.diagnostics.aiTelemetry.holderDecisions.map(d => d.state === 'pursue_tag' || d.state === 'hold_no_positive_margin'
        ? { ...d, margin: 2 } : d) } } }, contradictory = diagnoseLiveFieldPlayV1(input, contradictoryEstimate, roleMap);
    if (process.env.FIELDING_DIAG_REPORT === '1' && !contradictory.anomalies.some(a => a.kind === 'HELD_BALL_NO_THROW_ON_FORCE'))
      console.log('POSITIVE_HOLD_TRACE', JSON.stringify({ facts: result.facts.filter(f => ['catch_secured', 'runner_base_touch'].includes(f.kind)),
        decisions: contradictoryEstimate.diagnostics.aiTelemetry.holderDecisions, throws: result.diagnostics.throwDecisions }));
    expect(contradictory.anomalies).toContainEqual(expect.objectContaining({ kind: 'HELD_BALL_NO_THROW_ON_FORCE', base: 1 }));
  });

  it('captures structured AI telemetry, kinematic oracle, and anomaly classifications without altering simulation facts', () => {
    const scenario = CANONICAL_FIELDING_SCENARIOS_V1.find((s) => s.id === 'SS_routine')!;
    const { input, roleMap } = buildCanonicalFieldingPlayInputV1(scenario, 'default');
    const resultA = simulateLiveFieldPlayV1(input);
    const diag = diagnoseLiveFieldPlayV1(input, resultA, roleMap);
    const resultB = simulateLiveFieldPlayV1(input);

    expect(resultA.facts).toEqual(resultB.facts);
    expect(resultA.ruleFacts).toEqual(resultB.ruleFacts);
    expect(diag.oracle.infieldReachable).toBe(true);
    expect(diag.oracle.earliestInfielder?.role).toBe('SS');
    expect(diag.telemetry.roleTransitions.length).toBeGreaterThan(0);
    expect(formatLiveFieldPlayDiagnosticReportV1(diag, scenario.id)).toContain('=== [SS_routine]');
  });

  it('audits the full 20-scenario canonical fielding matrix', () => {
    const tiers: readonly AbilityTierV1[] = process.env.FIELDING_DIAG_TIERS === '1' ? ['low', 'default', 'high'] : ['default'];
    const summaryByTier: Record<
      string,
      {
        totalOuts: number;
        infieldGrounderOuts: number;
        infieldGrounderCount: number;
        anomalyCounts: Record<string, number>;
        totalAnomalies: number;
      }
    > = {};

    const defaultReports: string[] = [];

    for (const tier of tiers) {
      summaryByTier[tier] = { totalOuts: 0, infieldGrounderOuts: 0, infieldGrounderCount: 0, anomalyCounts: {}, totalAnomalies: 0 };
      for (const scenario of CANONICAL_FIELDING_SCENARIOS_V1) {
        const { input, roleMap } = buildCanonicalFieldingPlayInputV1(scenario, tier);
        const diag = diagnoseLiveFieldPlayV1(input, undefined, roleMap);
        expect(diag.end.complete).toBe(true);

        const bucket = summaryByTier[tier];
        bucket.totalOuts += diag.outsRecorded;
        if (scenario.category === 'infield_grounder' || scenario.category === 'slow_roller' || scenario.category === 'double_play') {
          bucket.infieldGrounderCount++;
          bucket.infieldGrounderOuts += diag.outsRecorded;
        }
        for (const a of diag.anomalies) {
          bucket.anomalyCounts[a.kind] = (bucket.anomalyCounts[a.kind] ?? 0) + 1;
          bucket.totalAnomalies++;
        }
        if (tier === 'default') {
          defaultReports.push(formatLiveFieldPlayDiagnosticReportV1(diag, `${scenario.id} (${scenario.category})`));
        }
      }
    }

    if (process.env.FIELDING_DIAG_REPORT === '1') {
      console.log('\n================ CANONICAL 20-SCENARIO DIAGNOSTIC REPORT (DEFAULT TIER) ================');
      console.log(defaultReports.join('\n\n'));
      console.log('\n================ TIER SUMMARY ================');
      console.log(JSON.stringify(summaryByTier, null, 2));
    }

    expect(summaryByTier.default.infieldGrounderCount).toBe(13);
    expect(summaryByTier.default.totalAnomalies).toBe(0);
    // Authored V84 abilities use weaker propulsion at high speed. The audited
    // matrix now yields 11 infield outs / 15 total with zero physical anomalies;
    // these regression floors are not empirical fielding-rate calibration.
    expect(summaryByTier.default.infieldGrounderOuts).toBeGreaterThanOrEqual(11);
    expect(summaryByTier.default.totalOuts).toBeGreaterThanOrEqual(15);
    if (process.env.FIELDING_DIAG_TIERS === '1') {
      expect(summaryByTier.low.totalOuts).toBeLessThan(summaryByTier.default.totalOuts);
      expect(summaryByTier.default.totalOuts).toBeLessThan(summaryByTier.high.totalOuts);
      expect(summaryByTier.high.totalAnomalies).toBe(0);
    }
  });

  it('demonstrates monotonic physical fielding progression across low, default, and high ability tiers', () => {
    const benchmarkIds = ['56_hole_grounder', '34_hole_grounder', 'slow_roller_3B', 'DP_643_grounder', 'force_3B_grounder', 'shallow_CF_liner'] as const;
    const outsByTier: Record<AbilityTierV1, number> = { low: 0, default: 0, high: 0 };
    for (const tier of ['low', 'default', 'high'] as const) {
      for (const id of benchmarkIds) {
        const scenario = CANONICAL_FIELDING_SCENARIOS_V1.find((s) => s.id === id)!;
        const { input, roleMap } = buildCanonicalFieldingPlayInputV1(scenario, tier);
        const diag = diagnoseLiveFieldPlayV1(input, undefined, roleMap);
        if (process.env.FIELDING_DIAG_REPORT === '1' && diag.anomalies.length)
          console.log(formatLiveFieldPlayDiagnosticReportV1(diag, `${id} ${tier} benchmark`));
        expect(diag.anomalies).toEqual([]);
        outsByTier[tier] += diag.outsRecorded;
      }
    }
    expect(outsByTier.low).toBeLessThan(outsByTier.default);
    expect(outsByTier.default).toBeLessThan(outsByTier.high);
  });
});
