import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { runFieldPracticeV98, resolveFieldPracticePlayersV98 } from './FieldPracticeWorkbenchV98';
import { AVERAGE_FIELD_PROFILE_V95, buildAverageFieldCaseV95 } from './LiveFieldAverageHarnessV95';
import { buildLiveFieldPlayInputV95, restoreLiveFieldAuthoredPlacementV105, type LiveFieldInputRequestV95 } from './LiveFieldInputV95';
import { simulateLiveFieldPlayV1 } from '../../core/sim/fielding/LiveFieldPlayV1';
import { reducePlayableMatchV1 } from './PlayableMatchRulesV1';
import { convertLiveFieldFramesV98 } from './LiveFieldFrameConversionV98';
import { createLiveBaseballMatchV1, LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, LIVE_MATCH_BASES_V1, LIVE_MATCH_PHYSICS_V1 } from './LiveBaseballMatchV1';
import { liveMatchFixture } from './LiveBaseballMatchV1.test-support';

const roles = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const;
const fixture = (maxPlaySeconds = 45): LiveFieldInputRequestV95 => {
  const original = buildAverageFieldCaseV95({ caseId: 'SS_ground', seed: 2025, bats: 'R', parkRadiusMeters: 110 }).input;
  return { ball: original.ball, physics: original.physics, seed: original.seed, field: original.field, outs: original.outs,
    maxPlaySeconds, defense: Object.fromEntries(roles.map(role => [role, 'def-' + role])) as LiveFieldInputRequestV95['defense'],
    placements: Object.fromEntries(original.fielders.map(f => [f.defensivePosition, f.position])) as LiveFieldInputRequestV95['placements'],
    players: [...original.fielders.map(f => f.playerId), ...original.runners.map(r => r.runnerId)]
      .map(playerId => ({ playerId, physical: AVERAGE_FIELD_PROFILE_V95.physical })),
    batterRunnerId: 'runner-0', batterPosition: original.runners[0].position!,
    occupiedBases: { first: null, second: null, third: null }, baserunning: 'balanced' };
};

it('uses exactly the shared ordinary input, physics, rule reducer and frame conversion without mutating the request', () => {
  const fieldInput = fixture(), request = { fieldInput, context: { source: 'AUTHORED_NOCK' as const,
    sourceCoreSha256: 'a'.repeat(64), sourceGameSha256: 'b'.repeat(64) } }, before = JSON.stringify(request),
    practice = runFieldPracticeV98(request), input = { ...buildLiveFieldPlayInputV95(fieldInput), recordInitialMovementV98: true as const,recordDecisionTraceV118:true as const }, field = simulateLiveFieldPlayV1(input);
  expect(practice.input).toEqual(input); expect(practice.field).toEqual(field); expect(field.end.complete).toBe(true);
  const rules = reducePlayableMatchV1({ match: practice.beforeMatch, batterRunnerId: fieldInput.batterRunnerId,
    event: { kind: 'field_play', facts: { ...field.ruleFacts, buntAttempt: false } } });
  expect(practice.rules).toEqual(rules);
  expect(practice.frames).toEqual(convertLiveFieldFramesV98({ field, readyFrame: practice.beforeFrame,
    defense: fieldInput.defense, battingTeam: 0, ticksPerSecond: practice.ticksPerSecond, rules }));
  expect(practice.batterPlayerId).toBe('runner-0'); expect(practice.pitcherPlayerId).toBe('def-P');
  expect(practice.context.source).toBe('AUTHORED_NOCK'); expect(JSON.stringify(request)).toBe(before);
  expect(Object.isFrozen(practice.frames)).toBe(true); expect(Object.isFrozen(practice.input.fielders)).toBe(true);
});

it('retains incomplete physical scope instead of manufacturing an official result', () => {
  const result = runFieldPracticeV98({ fieldInput: fixture(.08) });
  expect(result.field.end.complete).toBe(false); expect(result.rules).toBeNull();
  expect(result.match).toEqual(result.beforeMatch); expect(result.frames.length).toBeGreaterThan(0);
  expect(result.field.end.reason).toBe('scope_exhausted');
});

it('validates context, clocks and original runner state before practice simulation', () => {
  const fieldInput = fixture(.08), valid = runFieldPracticeV98({ fieldInput });
  expect(() => runFieldPracticeV98({ fieldInput, context: { beforeMatch: { ...valid.beforeMatch, outs: 1 } } })).toThrow(/outs/);
  expect(() => runFieldPracticeV98({ fieldInput, context: { beforeMatch: { ...valid.beforeMatch,
    bases: { first: 'phantom', second: null, third: null } } } })).toThrow(/bases/);
  expect(() => runFieldPracticeV98({ fieldInput, context: { sourceCoreSha256: 'made-up' } })).toThrow(/SHA/);
  expect(() => runFieldPracticeV98({ fieldInput: { ...fieldInput, physics: { ...fieldInput.physics,
    ground: { ...fieldInput.physics.ground, ticksPerSecond: 100 } } } })).toThrow(/clock/);
  const accessed = { fieldInput, get context(): never { throw Error('getter executed'); } };
  expect(() => runFieldPracticeV98(accessed)).toThrow(/accessors/);
});

it('resolves authored base values and independent technical traits with the same Host validation', () => {
  const player = { playerId: 'one', name: 'One', bats: 'R' as const, heightMeters: 1.8,
    physical: { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, fieldingReactionScaleV98: .8 } }, before = JSON.stringify(player);
  const resolved = resolveFieldPracticePlayersV98([player]);
  expect(resolved[0]).toMatchObject({ playerId: 'one', physical: player.physical });
  expect(resolved[0].technicalSkills).toBeUndefined(); expect(JSON.stringify(player)).toBe(before);
  expect(() => resolveFieldPracticePlayersV98([player, player])).toThrow(/unique/);
  expect(() => resolveFieldPracticePlayersV98([{ ...player, physical: { ...player.physical, fieldingReactionScaleV98: 5 } }])).toThrow(/reaction scale/);
  expect(() => resolveFieldPracticePlayersV98([{ ...player, physical: { ...player.physical, throwSpeedMps: -1 } }])).toThrow(/invalid explicit/);
});

it('records actual activation, first command and separately sampled motion once for each defender', () => {
  const result = runFieldPracticeV98({ fieldInput: fixture(.65) }), telemetry = result.field.diagnostics.aiTelemetry.firstMovementV98!;
  expect(telemetry).toHaveLength(9); expect(new Set(telemetry.map(t => t.playerId)).size).toBe(9);
  const ss = telemetry.find(t => t.playerId === 'def-SS')!;
  expect(ss).toMatchObject({ inputReactionSeconds: .18, decisionSeconds: .04, responseSecondsAtStart: .22, sampleIntervalSeconds: .055 });
  expect(ss.firstActivation!.elapsedSeconds).toBeGreaterThanOrEqual(result.input.ball.elapsedSeconds + .22);
  expect(ss.firstMovementCommand!.elapsedSeconds).toBeGreaterThanOrEqual(ss.firstActivation!.elapsedSeconds);
  expect(ss.firstSampledMoving!.elapsedSeconds).toBeGreaterThan(ss.firstMovementCommand!.elapsedSeconds);
  const sampled = result.field.frames.find(f => f.tick === ss.firstSampledMoving!.tick)!.fielders.find(f => f.playerId === ss.playerId)!;
  expect(ss.firstSampledMoving!.position).toEqual(sampled.position); expect(ss.firstSampledMoving!.velocity).toEqual(sampled.velocity);
  expect(ss.firstSampledMoving!.previousSampleElapsedSeconds).toBeLessThan(ss.firstSampledMoving!.elapsedSeconds);
  expect(ss.firstSampledMoving!.elapsedSeconds - ss.firstSampledMoving!.previousSampleElapsedSeconds!).toBeLessThanOrEqual(.055 + 1e-12);
});

it('keeps first-movement diagnostics opt-in and leaves every physical fact and ordinary telemetry unchanged', () => {
  const input = buildLiveFieldPlayInputV95(fixture(.65)), normal = simulateLiveFieldPlayV1(input),
    logged = simulateLiveFieldPlayV1({ ...input, recordInitialMovementV98: true });
  expect(normal.diagnostics.aiTelemetry).not.toHaveProperty('firstMovementV98');
  const { firstMovementV98: _first, ...oldTelemetry } = logged.diagnostics.aiTelemetry;
  expect({ ...logged, diagnostics: { ...logged.diagnostics, aiTelemetry: oldTelemetry } }).toEqual(normal);
  expect(() => simulateLiveFieldPlayV1({ ...input, recordInitialMovementV98: false } as unknown as typeof input)).toThrow(/telemetry option/);
});

it('replays an actual ordinary contact through practice with identical field facts, actor frames and official result', () => {
  const authored = liveMatchFixture(2468), host = createLiveBaseballMatchV1(authored);
  let checked = false;
  for (let ordinal = 1; ordinal <= 12 && !checked; ordinal++) {
    const before = host.inspect(), record = host.issuePitch({ batting: 'balanced', pitchType: 'auto', location: 'auto', managedTeam: 0 });
    if (!record.play.field) continue;
    const normal = record.play.field, battingTeam = record.beforeMatch.half === 'top' ? 0 : 1,
      defense = authored.teams[1 - battingTeam].defense,
      diagnostics = record.play.diagnostics as { sourceDescriptor: { profile: typeof LIVE_MATCH_PHYSICS_V1 } },
      profile = diagnostics.sourceDescriptor.profile.air.aerodynamics.seamForce === undefined ? LIVE_MATCH_PHYSICS_V1 : diagnostics.sourceDescriptor.profile;
    const fieldInput: LiveFieldInputRequestV95 = { ball: record.play.outgoingBallMoment!, orientation: record.play.contactOrientation!,
      physics: profile, seed: (authored.seed + Math.imul(ordinal, 0x9e3779b9)) >>> 0,
      field: { bases: LIVE_MATCH_BASES_V1, fenceRadiusMeters: authored.park?.fenceRadiusMeters ?? 110,
        fenceHeightMeters: authored.park?.fenceHeightMeters ?? 3 },
      defense, placements: Object.fromEntries(normal.frames[0].fielders.map(f => { const role = roles.find(r => defense[r] === f.playerId)!;
        return [role, restoreLiveFieldAuthoredPlacementV105(f, role)]; })) as LiveFieldInputRequestV95['placements'],
      players: resolveFieldPracticePlayersV98(authored.players), batterRunnerId: record.batterPlayerId,
      batterPosition: before.frame.actors.find(a => a.playerId === record.batterPlayerId)!.position,
      occupiedBases: record.beforeMatch.bases, baserunning: 'balanced', outs: record.beforeMatch.outs, maxPlaySeconds: 45 };
    const practice = runFieldPracticeV98({ fieldInput, context: { source: 'MATCH_CONTACT', beforeMatch: record.beforeMatch,
      regulationInnings: authored.innings ?? 9, battingTeam, pitcherPlayerId: record.pitcherPlayerId } });
    const { firstMovementV98: _first,decisionTraceV118:_trace, ...oldTelemetry } = practice.field.diagnostics.aiTelemetry;
    expect({ ...practice.field, diagnostics: { ...practice.field.diagnostics, aiTelemetry: oldTelemetry } }).toEqual(normal);
    expect(practice.rules).toEqual(record.play.rules);
    for (const f of practice.frames) {
      if (record.play.rules.kind !== 'applied' || f.tick > record.play.rules.endedAtTick) continue;
      const actual = record.frames.find(source => source.tick === f.tick && source.ballKind !== 'pitch');
      expect(actual).toBeDefined();
      // The practice starts at contact and has no batting animation; all field
      // actors, ball samples, observer identities and timing are shared.
      expect({ ...f, bat: actual!.bat }).toEqual(actual);
    }
    checked = true;
  }
  expect(checked).toBe(true);
}, 30000);

it('advances a selected shortstop actual activation and movement using a field-only reaction scale', () => {
  const original = fixture(.65), selectedId = 'def-SS';
  const run = (scale: number) => runFieldPracticeV98({ fieldInput: { ...original,
    players: original.players.map(p => p.playerId === selectedId ? { ...p,
      physical: { ...p.physical, fieldingReactionScaleV98: scale } } : p) } });
  const baseline = run(1), faster = run(.8), zeroReaction = run(0),
    row = (r: typeof baseline) => r.field.diagnostics.aiTelemetry.firstMovementV98!.find(f => f.playerId === selectedId)!;
  const a = row(baseline), b = row(faster), z = row(zeroReaction);
  expect(b.inputReactionSeconds).toBeCloseTo(.18 * .8, 15); expect(b.decisionSeconds).toBe(.04);
  expect(b.firstActivation!.elapsedSeconds).toBeLessThan(a.firstActivation!.elapsedSeconds);
  expect(b.firstMovementCommand!.elapsedSeconds).toBeLessThan(a.firstMovementCommand!.elapsedSeconds);
  expect(b.firstSampledMoving!.elapsedSeconds).toBeLessThan(a.firstSampledMoving!.elapsedSeconds);
  const commonTick = a.firstSampledMoving!.tick, positionAt = (r: typeof baseline) => r.field.frames.find(f => f.tick === commonTick)!.fielders.find(f => f.playerId === selectedId)!,
    startPosition = baseline.input.fielders.find(f => f.playerId === selectedId)!.position,
    commonMeasurements = [baseline, faster, zeroReaction].map(r => { const f = positionAt(r); return {
      tick: commonTick, position: f.position, velocity: f.velocity, speedMps: Math.hypot(f.velocity.x, f.velocity.y, f.velocity.z),
      displacementMeters: Math.hypot(f.position.x - startPosition.x, f.position.y - startPosition.y, f.position.z - startPosition.z) }; });
  expect(commonMeasurements[1].speedMps).toBeGreaterThan(commonMeasurements[0].speedMps);
  expect(commonMeasurements[1].displacementMeters).toBeGreaterThan(commonMeasurements[0].displacementMeters);
  for (const run of [faster, zeroReaction]) {
    expect(run.input.ball).toEqual(baseline.input.ball); expect(run.input.seed).toBe(baseline.input.seed);
    expect(run.input.runners).toEqual(baseline.input.runners);
    expect(run.input.fielders.filter(f => f.playerId !== selectedId)).toEqual(baseline.input.fielders.filter(f => f.playerId !== selectedId));
    const selected = run.input.fielders.find(f => f.playerId === selectedId)!, old = baseline.input.fielders.find(f => f.playerId === selectedId)!;
    expect({ ...selected, reactionSeconds: old.reactionSeconds }).toEqual(old);
  }
  // A zero reaction factor does not erase the independent decision latency or
  // grant movement before the first causally available command.
  expect(z.inputReactionSeconds).toBe(0); expect(z.responseSecondsAtStart).toBe(.04);
  expect(z.firstActivation!.elapsedSeconds).toBeGreaterThanOrEqual(zeroReaction.input.ball.elapsedSeconds + z.decisionSeconds);
  expect(z.firstMovementCommand!.elapsedSeconds).toBeGreaterThanOrEqual(z.firstActivation!.elapsedSeconds);
  for (const result of [baseline, faster, zeroReaction]) for (const observation of result.field.diagnostics.aiTelemetry.runnerObservationsV95)
    expect(observation.observedAtSeconds).toBeLessThanOrEqual(observation.elapsedSeconds - observation.reactionSeconds + 1e-10);

  const reportPath = process.env.FIELD_REACTION_V98_REPORT;
  if (reportPath) {
    const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
    writeFileSync(reportPath, JSON.stringify({ purpose: 'SELECTED_SS_FIELD_ONLY_REACTION_CAUSAL_COUNTERFACTUAL_NOT_MLB_CALIBRATION',
      sourceSha256: Object.fromEntries(['src/core/sim/fielding/LiveFieldPlayV1.ts', 'src/integration/browser/LiveFieldInputV95.ts',
        'src/integration/browser/FieldPracticeWorkbenchV98.ts'].map(path => [path, sha(path)])),
      selectedPlayerId: selectedId, seed: baseline.input.seed, ball: baseline.input.ball,
      unchanged: { otherFieldersInput: true, runnerInputs: true, selectedNonReactionSI: true, ballAndSeed: true },
      timingBasis: 'ACTUAL_CORE_COMMAND_AND_SAMPLED_FRAME_TELEMETRY_NOT_INFERRED_CONTROL_GRID',
      counterfactuals: [baseline, faster, zeroReaction].map((r, i) => ({ scale: [1, .8, 0][i],
        telemetry: row(r), input: r.input.fielders.find(f => f.playerId === selectedId), end: r.field.end,
        commonTimeMeasurement: commonMeasurements[i],
        runnerObservationCount: r.field.diagnostics.aiTelemetry.runnerObservationsV95.length,
        runnerCausalObservationPass: r.field.diagnostics.aiTelemetry.runnerObservationsV95.every(o => o.observedAtSeconds <= o.elapsedSeconds - o.reactionSeconds + 1e-10) })) }, null, 2) + '\n');
  }
});


it('V105 practice preserves stature through the same input mapping and Source body pose without rewriting authoring', () => {
  const fieldInput = fixture(.08), raw = fieldInput.players.map((p, i) => ({ ...p,
    heightMeters: i === 0 ? 1.6 : 2, name: p.playerId, bats: 'R' as const })), before = JSON.stringify(raw),
    resolved = resolveFieldPracticePlayersV98(raw), result = runFieldPracticeV98({ fieldInput: { ...fieldInput, players: resolved } });
  expect(resolved[0].heightMeters).toBe(1.6); expect(resolved[1].heightMeters).toBe(2);
  for (const f of result.input.fielders) {
    const original = raw.find(p => p.playerId === f.playerId)!;
    expect(f.bodyModelV105!.heightMeters).toBe(original.heightMeters);
    const frame = result.field.frames[0].fielders.find(a => a.playerId === f.playerId)!;
    expect(frame.bodyPoseV105).toBeDefined();
    expect(frame.bodyPoseV105!.eye.y - frame.bodyPoseV105!.foot.y).toBeCloseTo(original.heightMeters * .92);
    expect(original.physical).not.toHaveProperty('fieldArmReachMetersV105');
  }
  expect(JSON.stringify(raw)).toBe(before);
});
