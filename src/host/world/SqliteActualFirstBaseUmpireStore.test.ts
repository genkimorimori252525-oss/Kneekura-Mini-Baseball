import { expect, it } from 'vitest';
import { actualFirstBaseUmpireFixture } from './ActualFirstBaseUmpireFixtures.test-support';
import { actualFirstBaseOffensiveDisposition } from './ActualFirstBaseUmpire';
import { openSqliteActualFirstBaseUmpireStore } from './SqliteActualFirstBaseUmpireStore';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

it('owns real first-base event perception and an operative OUT while preserving original physical/rule/motor archives', () => {
  const x = actualFirstBaseUmpireFixture();
  try {
    const original = JSON.stringify(x.race), modelBytes = JSON.stringify(x.worldContact.model);
    expect(x.race.execution).toMatchObject({ kind: 'first_base_race', groundRule: { correctRuleResult: { batterRunnerFirstBase: { kind: 'out' } } } });
    x.umpires.acceptSetup(x.setup.sourceId);
    const observation = x.umpires.observe(x.observation.sourceId), call = x.umpires.advanceCall(x.call.sourceId);
    expect(observation.perception.kind).toBe('perceived'); expect(observation.eventEvidence).not.toBeNull();
    expect(call.schedule.kind).toBe('called'); expect(call.onFieldCall?.ruling.outsAfter).toBe(observation.outsAtStart + 1);
    expect(actualFirstBaseOffensiveDisposition(call)).toMatchObject({ kind: 'retired', runnerId: observation.batterRunnerId, causeCallSourceId: x.call.sourceId });
    expect(call.onFieldCall?.ruling.basesAfter).toEqual({ first: null, second: null, third: null });
    expect(hash(x.race)).toBe(observation.ruleEvidenceHash);
    expect(JSON.stringify(x.executions.read(x.race.source.sourceId))).toBe(original);
    expect(JSON.stringify(x.worldContact.model)).toBe(modelBytes);
    expect(call).not.toHaveProperty('playEnd'); expect(call).not.toHaveProperty('motorCancellation');
    expect(call).not.toHaveProperty('communicationAcknowledgements');
    const reopened = x.f.track(openSqliteActualFirstBaseUmpireStore(x.f.path));
    expect(reopened.readObservation(x.observation.sourceId)).toEqual(observation);
    expect(reopened.advanceCall(x.call.sourceId)).toEqual(call);
  } finally { x.f.close(); }
});

it.each(['calibration', 'pose', 'attention'] as const)('stores named pending %s and never substitutes an ideal umpire', key => {
  const x = actualFirstBaseUmpireFixture(setup => ({ ...setup, [key]: null }));
  try {
    x.umpires.acceptSetup(x.setup.sourceId); const observation = x.umpires.observe(x.observation.sourceId);
    const call = x.umpires.advanceCall(x.call.sourceId);
    expect(observation.perception).toEqual({ kind: 'pending', reason: key === 'pose' ? 'pose_unavailable' : `${key}_unavailable` });
    expect(call.onFieldCall).toBeNull(); expect(actualFirstBaseOffensiveDisposition(call).kind).toBe('pending');
  } finally { x.f.close(); }
});

it('keeps real missing event pair and pose-interval unavailability distinct from actual nondetection', () => {
  const missing = actualFirstBaseUmpireFixture(undefined, 0.04, 0.08, 0.045);
  try {
    missing.umpires.acceptSetup(missing.setup.sourceId);
    expect(missing.umpires.observe(missing.observation.sourceId).perception).toEqual({ kind: 'pending', reason: 'event_pair_unavailable' });
    expect(missing.umpires.advanceCall(missing.call.sourceId).onFieldCall).toBeNull();
  } finally { missing.f.close(); }
  const outOfInterval = actualFirstBaseUmpireFixture(setup => ({ ...setup, pose: { ...setup.pose!, validThroughElapsedSeconds: 0.001 } }));
  try {
    outOfInterval.umpires.acceptSetup(outOfInterval.setup.sourceId);
    expect(outOfInterval.umpires.observe(outOfInterval.observation.sourceId).perception).toEqual({ kind: 'pending', reason: 'pose_interval_unavailable' });
  } finally { outOfInterval.f.close(); }
  const blind = actualFirstBaseUmpireFixture(setup => ({ ...setup, pose: { ...setup.pose!, forward: { x: 0, y: 1, z: 0 } },
    calibration: { ...setup.calibration!, geometryParameters: { ...setup.calibration!.geometryParameters,
      fullQualityHalfAngleRadians: Math.PI / 6, maxVisibleHalfAngleRadians: Math.PI / 2 } } }));
  try {
    blind.umpires.acceptSetup(blind.setup.sourceId);
    expect(blind.umpires.observe(blind.observation.sourceId).perception.kind).toBe('undetectable');
    expect(blind.umpires.advanceCall(blind.call.sourceId).onFieldCall).toBeNull();
  } finally { blind.f.close(); }
});

it('rejects caller-injected truth, ruling, call time or fabricated retirement at every accepted boundary', () => {
  const x = actualFirstBaseUmpireFixture();
  try {
    for (const field of ['ruling', 'correctRuleResult', 'calledAtElapsedSeconds', 'retiredRunnerId']) {
      x.setups.set(x.setup.sourceId, { ...x.setup, [field]: 'out' }); expect(() => x.umpires.acceptSetup(x.setup.sourceId)).toThrow();
    }
    x.setups.set(x.setup.sourceId, x.setup); x.umpires.acceptSetup(x.setup.sourceId);
    for (const field of ['perception', 'ruling', 'availability']) {
      x.observations.set(x.observation.sourceId, { ...x.observation, [field]: 'out' }); expect(() => x.umpires.observe(x.observation.sourceId)).toThrow();
    }
    x.observations.set(x.observation.sourceId, x.observation); x.umpires.observe(x.observation.sourceId);
    for (const field of ['onFieldCall', 'calledAtElapsedSeconds', 'retirement']) {
      x.calls.set(x.call.sourceId, { ...x.call, [field]: 'out' }); expect(() => x.umpires.advanceCall(x.call.sourceId)).toThrow();
    }
    expect(actualFirstBaseOffensiveDisposition(null)).toEqual({ kind: 'pending', reason: 'operative_call_unavailable' });
  } finally { x.f.close(); }
});

it('adopts the owned delayed call only after the actual clock reaches it and keeps exact availability inside one recorded tick', () => {
  const x = actualFirstBaseUmpireFixture(setup => ({ ...setup, calibration: { ...setup.calibration!, callDelaySeconds: 0.0000001 } }));
  try {
    x.umpires.acceptSetup(x.setup.sourceId); const observation = x.umpires.observe(x.observation.sourceId);
    const before = x.umpires.advanceCall(x.call.sourceId);
    expect(before.schedule).toMatchObject({ kind: 'scheduled' }); expect(before.onFieldCall).toBeNull();
    if (x.move.action.kind !== 'motion') throw new Error('synthetic actual motion');
    const next = { ...x.move, sourceId: 'umpire-clock-motion', previousExecutionSourceId: x.race.source.sourceId,
      action: { ...x.move.action, availableAtTick: observation.availability.tick, throughTick: observation.availability.tick + 1 } };
    x.sources.set(next.sourceId, next); const physical = x.executions.accept(next.sourceId);
    const source = { ...x.call, sourceId: 'umpire-call-after-due', currentExecutionSourceId: physical.source.sourceId };
    x.calls.set(source.sourceId, source); const after = x.umpires.advanceCall(source.sourceId);
    if (after.schedule.kind !== 'called') throw new Error('owned call due');
    const due = observation.availability.elapsedSeconds + 0.0000001;
    expect(after.schedule.calledAtElapsedSeconds).toBe(due);
    expect(after.advancedThrough.elapsedSeconds).toBeGreaterThan(due);
    const earlier = { originTick: observation.clock.originTick, elapsedSeconds: due - 0.00000001, tick: after.schedule.tick };
    expect(x.umpires.readAvailableCall(source.sourceId, earlier)).toBeNull();
    expect(x.umpires.readAvailableCall(source.sourceId, { ...earlier, elapsedSeconds: due })).toEqual(after);
    expect(x.umpires.readCall(x.call.sourceId)).toEqual(before);
    const duplicate = { ...source, sourceId: 'umpire-duplicate-called-event' };
    x.calls.set(duplicate.sourceId, duplicate); expect(() => x.umpires.advanceCall(duplicate.sourceId)).toThrow(/already|later/);
  } finally { x.f.close(); }
});

it.each([['out', 'safe', 0.04, 0.08], ['safe', 'out', 0.08, 0.04]] as const)(
  'preserves true %s while independent perception produces operative %s', async (truth, operative, defender, runner) => {
    const { SeedRoot } = await import('../../core/rng/SeedRoot');
    const { actorJson: json } = await import('./PhysicalPlateAppearanceActorEvidenceFromSqlite');
    const x = actualFirstBaseUmpireFixture(undefined, defender, runner);
    try {
      if (x.race.execution.kind !== 'first_base_race' || !x.race.execution.groundRule) throw new Error('actual legal race fixture');
      const original = JSON.stringify(x.race), chronology = x.race.execution.groundRule.actualChronology;
      expect(x.race.execution.groundRule.correctRuleResult.batterRunnerFirstBase.kind).toBe(truth);
      const root = new SeedRoot(x.physical.frame.matchSeed);
      // Select an explicit synthetic identity with a known large independently sampled timing error.
      // The production Source accepts only calibration/identity, never this expected call.
      const umpireId = Array.from({ length: 50 }, (_, n) => `synthetic-noisy-umpire-${n}`).find(id => {
        const error = (cue: string) => {
          const rng = root.streamRng(x.physical.frame.match.playId, 'perception', json([
            'actual_first_base_umpire_v1', x.setup.physicalPitchSourceId, id, x.observation.sourceId, cue]));
          return (rng.nextFloat() - rng.nextFloat()) * 10;
        };
        const difference = chronology.firstDefenderControls[0].elapsedSeconds + error('control')
          - chronology.runnerTouch!.elapsedSeconds - error('touch');
        return operative === 'safe' ? difference > 1 : difference < -1;
      })!;
      expect(umpireId).toBeTruthy();
      x.setups.set(x.setup.sourceId, { ...x.setup, umpireId, calibration: { ...x.setup.calibration!,
        timingErrorParameters: { minimumDetectionQuality: 0.1, minimumTimeErrorSeconds: 10, maximumTimeErrorSeconds: 10 } } });
      x.umpires.acceptSetup(x.setup.sourceId); x.umpires.observe(x.observation.sourceId);
      const call = x.umpires.advanceCall(x.call.sourceId);
      expect(call.schedule).toMatchObject({ kind: 'called', call: operative });
      expect(actualFirstBaseOffensiveDisposition(call).kind).toBe(operative === 'out' ? 'retired' : 'active');
      expect(JSON.stringify(x.executions.read(x.race.source.sourceId))).toBe(original);
    } finally { x.f.close(); }
  });
