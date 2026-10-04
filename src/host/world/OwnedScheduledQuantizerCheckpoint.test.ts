import { expect, it } from 'vitest';
import { quantizerFixture } from './OwnedScheduledQuantizerFixture.test-support';
import { ownedScheduledMotionActionInput, type OwnedMotionV2Action } from './OwnedScheduledBattedWorldMotion';
import { deriveQuantizerClosedGenerationBoundary } from '../../core/sim/liveAction/QuantizerClosedGenerationBoundary';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';

const checkpoint = (throughTick: number) => ({ kind: 'retained_quantizer_bucket_v1' as const, throughTick });
it('accepts only the explicit retained target-tick request and rejects caller outcomes and adoption', () => {
  const x = quantizerFixture();
  try {
    const action = x.action(checkpoint(102) as unknown as OwnedMotionV2Action['checkpoint']);
    expect(ownedScheduledMotionActionInput(action)).toEqual(action);
    for (const extra of [{ throughElapsedSeconds: 1 }, { actors: [] }, { completed: true }, { watermark: 102 }]) {
      expect(() => ownedScheduledMotionActionInput({ ...action, checkpoint: { ...action.checkpoint, ...extra } } as OwnedMotionV2Action)).toThrow();
    }
    expect(() => ownedScheduledMotionActionInput({ ...action, contributions: action.contributions.map((c, i) => i ? c
      : { kind: 'motor', playerId: c.playerId, motorSourceId: 'motor' }) })).toThrow(/retained/);
  } finally { x.restore(); }
});
it.each([[100, 3], [7, 7], [500, 1_000_000]])('executes the production bucket tail with origin=%s and rate=%s', (origin, rate) => {
  const x = quantizerFixture(origin, rate);
  try {
    const throughTick = origin + 2, boundary = deriveQuantizerClosedGenerationBoundary({ originTick: origin, throughTick, ticksPerSecond: rate });
    expect(boundary.lastIncludedElapsedSeconds).toBeGreaterThan(2 / rate);
    const result = x.execute(checkpoint(throughTick) as unknown as OwnedMotionV2Action['checkpoint']);
    if (result.kind !== 'owned_motion_v2') throw new Error('checkpoint execution');
    expect(result.field.motion.world.moment.elapsedSeconds).toBe(boundary.lastIncludedElapsedSeconds);
    expect(result.adoption.executedThrough.elapsedSeconds).toBe(boundary.lastIncludedElapsedSeconds);
    expect(result.adoption.executedThrough.tick).toBe(throughTick);
    expect(result.composition).toMatchObject({ quantizerBoundary: boundary, mode: 'retained' });
    expect(result.field.motion.actors).toEqual(x.field.motion.actors);
    expect(result.adoption.contributors).toHaveLength(10);
    expect(result.adoption.contributors.every(c => c.motorSourceId === null)).toBe(true);
    expect(result.liveWork.queue).toBeNull(); expect(result.liveWork).not.toHaveProperty('playEnd');
    expect(quantizeEventTick(origin, boundary.firstExcludedElapsedSeconds, rate)).toBe(throughTick + 1);
  } finally { x.restore(); }
});

it('admits positive exact progress in the already recorded target tick, then refuses an already reached or past goal', () => {
  const x = quantizerFixture(), goal = deriveQuantizerClosedGenerationBoundary({ originTick: 100, throughTick: 102, ticksPerSecond: 3 });
  try {
    x.moveCut(2 / 3);
    expect(x.at.tick).toBe(102);
    const result = x.execute(checkpoint(102));
    if (result.kind !== 'owned_motion_v2') throw new Error('checkpoint');
    expect(result.adoption.executedThrough.elapsedSeconds).toBeGreaterThan(x.at.elapsedSeconds);
    x.moveCut(goal.lastIncludedElapsedSeconds);
    expect(() => x.execute(checkpoint(102))).toThrow(/already reached or past.*no segment/);
    x.moveCut(goal.firstExcludedElapsedSeconds);
    expect(() => x.execute(checkpoint(102))).toThrow(/already reached or past.*no segment/);
  } finally { x.restore(); }
});
it('exhausts an endTick=T curve at its mathematical end without claiming the requested bucket tail', () => {
  const x = quantizerFixture(100, 3, 2);
  try {
    const result = x.execute(checkpoint(102));
    if (result.kind !== 'owned_motion_v2') throw new Error('checkpoint');
    expect(result.adoption.status).toBe('coverage_exhausted');
    expect(result.adoption.executedThrough.elapsedSeconds).toBe(2 / 3);
    expect(result.composition.quantizerBoundary!.lastIncludedElapsedSeconds).toBeGreaterThan(result.adoption.executedThrough.elapsedSeconds);
    expect(result.liveWork.unresolvedSuccessor).toBe('next_owned_controller_command');
    expect(result.field.motion.actors).toEqual(x.field.motion.actors);
  } finally { x.restore(); }
});
it.each(['root', 'relative'] as const)('refuses inconsistent %s authority and physical coverage instead of creating an unreplayable result', kind => {
  const x = quantizerFixture();
  try {
    const self = x.selves[0];
    Object.assign(self, { ownedMotionCoverage: { compositionSourceId: 'prior', physicalThroughTick: 112,
      rootAuthority: { ...self.activeCommand, acceptedThroughTick: kind === 'root' ? 102 : 112 },
      roleAuthorities: self.roles.map(p => ({ role: p.role, command: self.activeCommand,
        acceptedThroughTick: kind === 'relative' && p.role === 'right_foot' ? 102 : 112 })) } });
    expect(() => x.execute(checkpoint(103))).toThrow(/authority\/physical coverage/);
  } finally { x.restore(); }
});
import type { DurableActualDefensiveDecision } from './SqliteActualDefensiveDecisionStore';
const decision = (x: ReturnType<typeof quantizerFixture>, phase: 'pending_decision' | 'pending_first_step' | 'issued', dueTick = 102) => {
  Object.assign(x.knownWork[0], { decisionSourceId: 'decision' });
  return { source: { sourceId: 'decision', playerId: x.bindings[0].playerId, physicalPitchSourceId: 'pitch' },
    receipt: { observedThrough: x.at, lifecycle: { status: phase }, scheduling: { decisionTick: dueTick, movementStartTick: dueTick } } } as unknown as DurableActualDefensiveDecision;
};
it.each(['pending_decision', 'pending_first_step'] as const)('stops at still-pending %s and retains the decision handoff', phase => {
  const x = quantizerFixture();
  try {
    const d = decision(x, phase), result = x.execute(checkpoint(102), [d]);
    if (result.kind !== 'owned_motion_v2') throw new Error('checkpoint');
    expect(result.adoption.executedThrough.elapsedSeconds).toBe(2 / 3);
    expect(result.adoption.status).toBe('decision_boundary');
    expect(result.composition.quantizerBoundary!.lastIncludedElapsedSeconds).toBeGreaterThan(2 / 3);
    expect(result.liveWork.pendingDecisionHandoffs).toHaveLength(1);
    expect(result.liveWork.unresolvedSuccessor).toBe('actual_defensive_decision_owner');
    x.moveCut(2 / 3);
    expect(() => x.execute(checkpoint(102), [d])).toThrow(/due decision revision/);
  } finally { x.restore(); }
});
it('refuses issued decisions and unadopted motors rather than implicitly renewing any Player motion', () => {
  const x = quantizerFixture();
  try {
    const d = decision(x, 'issued');
    expect(() => x.execute(checkpoint(102), [d])).toThrow(/awaits motor adoption/);
    Object.assign(x.knownWork[0], { motorSourceId: 'motor' });
    expect(() => x.execute(checkpoint(102), [d])).toThrow(/due motor.*adopted/);
  } finally { x.restore(); }
});
it.each(['owned_acquisition_plan_v1', 'owned_throw_plan_v1', 'acquisition_plan', 'throw_plan'] as const)('refuses pending %s and leaves its existing exact operation route authoritative', kind => {
  const x = quantizerFixture();
  try {
    x.prefix.executions.push({ source: { sourceId: 'pending-plan' }, execution: { kind, field: x.field } } as never);
    expect(() => x.execute(checkpoint(102))).toThrow(/operation owns pending physical/);
  } finally { x.restore(); }
});
it('refuses an unresolved or unsupported physical cursor without manufacturing free motion', () => {
  const x = quantizerFixture();
  try {
    x.prefix.executions.push({ source: { sourceId: 'unresolved' }, execution: { kind: 'motion', field: {
      ...x.field, motion: { ...x.field.motion, cursor: null } } } } as never);
    expect(() => x.execute(checkpoint(102))).toThrow(/unresolved physical contact/);
  } finally { x.restore(); }
});
it.each([1, 2])('stops at the raw first contact with %s collider(s), retaining simultaneous sets and the actual endpoint', count => {
  const x = quantizerFixture(100, 3, 12, actors => actors.map(a => a.primitive.role === 'body'
    && Number(a.playerId.split('-')[1]) < count ? { ...a, primitive: { ...a.primitive, startCenter: { x: 2.25, y: 10, z: 10 } } } : a));
  try {
    const result = x.execute(checkpoint(102));
    if (result.kind !== 'owned_motion_v2' || result.field.motion.world.kind !== 'boundary') throw new Error('boundary');
    expect(result.adoption.status).toBe('physical_boundary');
    expect(result.field.motion.world.contacts).toHaveLength(count);
    expect(result.adoption.executedThrough.elapsedSeconds).toBe(result.field.motion.world.moment.elapsedSeconds);
    expect(result.adoption.executedThrough.elapsedSeconds).toBeLessThan(result.composition.checkpointThroughElapsedSeconds);
    expect(result.adoption.executedThrough.tick).toBeLessThanOrEqual(102);
    if (count === 2) expect(result.field.motion.cursor).toBeNull();
    expect(result.field.motion.actors).toEqual(x.field.motion.actors);
  } finally { x.restore(); }
});
it('honors the safe-clock maximum with exact coverage rather than asking for an invented T+1', () => {
  const max = Number.MAX_SAFE_INTEGER, x = quantizerFixture(max - 12, 3, 12);
  try {
    const result = x.execute(checkpoint(max));
    if (result.kind !== 'owned_motion_v2') throw new Error('checkpoint');
    expect(result.composition.quantizerBoundary!.firstExcludedTick).toBeNull();
    expect(result.adoption.executedThrough.tick).toBe(max);
    expect(result.adoption.executedThrough.elapsedSeconds).toBe(4);
    expect(result.adoption.status).toBe('coverage_exhausted');
  } finally { x.restore(); }
});

import { deriveCanonicalWholePlayHistory } from '../../core/sim/plateAppearance/CanonicalWholePlayHistory';
import { createCanonicalPlateAppearanceTimeline, recordBatBallContact } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import { deriveBallWorldPlayerBaseContactHistory } from '../../core/sim/ball/BallWorldPlayerBaseContactHistory';
it('records the actually executed exact segment in canonical history and generates a foot/base touch despite a contact-free ball', () => {
  const x = quantizerFixture(100, 3, 12, actors => actors.map(a => a.playerId === 'player-0' && a.primitive.role === 'left_foot'
    ? { ...a, primitive: { ...a.primitive, startCenter: { x: 2.125, y: 1, z: 0 }, startVelocity: { x: 1, y: 0, z: 0 } } } : a));
  try {
    const result = x.execute(checkpoint(102));
    if (result.kind !== 'owned_motion_v2') throw new Error('checkpoint');
    const initial = x.response.world.flight.initialBall, origin = { originTick: 100, elapsedSeconds: 0, ball: initial };
    const originalTimeline = recordBatBallContact(createCanonicalPlateAppearanceTimeline({ ruleProfileId: asRuleProfileId('npb-2026'),
      inning: 1, half: 'top', outs: 0, balls: 0, strikes: 0, bases: { first: null, second: null, third: null }, score: { away: 0, home: 0 }, playId: 1 }, 100),
    x.response.world.flight.contact);
    const ref = (sourceId: string, owner: 'field_action' | 'field_execution') => ({ owner, sourceId, revision: 1, physicalPitchSourceId: 'pitch' });
    const history = deriveCanonicalWholePlayHistory({ scope: { gameId: 'game', playId: 1, physicalPitchSourceId: 'pitch' }, originalTimeline,
      origin: { moment: origin, actors: x.response.world.actors, batterRunnerId: 'player-0', defenderIds: x.bindings.slice(1).map(b => b.playerId), ticksPerSecond: 3 },
      steps: [{ source: ref('field', 'field_action'), previousSourceId: null, kind: 'motion', startCursor: { moment: origin, previousContacts: [] }, field: x.field },
        { source: ref('checkpoint', 'field_execution'), previousSourceId: null, kind: 'owned_motion_v2', startCursor: x.field.motion.cursor,
          mode: 'retained', field: result.field, operation: null }] });
    expect(history.horizon.elapsedSeconds).toBe(result.adoption.executedThrough.elapsedSeconds);
    expect(history.physicalSteps.at(-1)).toMatchObject({ kind: 'owned_motion_v2', field: result.field });
    expect(history.end).toEqual({ kind: 'unestablished' });
    const segments = [{ originTick: 100, startElapsedSeconds: 0, endElapsedSeconds: x.at.elapsedSeconds, actors: x.field.motion.actors },
      { originTick: 100, startElapsedSeconds: x.at.elapsedSeconds, endElapsedSeconds: history.horizon.elapsedSeconds, actors: result.field.motion.actors }];
    const foot = deriveBallWorldPlayerBaseContactHistory({ segments, playerId: 'player-0', base: x.core.geometry.baseGeometry.bases.first.region, baseSurfaceHeightMeters: 1 });
    expect(foot.episodes).toHaveLength(1);
    expect(foot.episodes[0].startElapsedSeconds).toBe(.625);
    expect(foot.episodes[0].endElapsedSeconds).toBe(history.horizon.elapsedSeconds);
    expect(result.adoption.physicalBoundary).toBeNull();
  } finally { x.restore(); }
});
