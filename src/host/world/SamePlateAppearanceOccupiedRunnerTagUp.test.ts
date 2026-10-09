import { expect, it } from 'vitest';
import * as tagUp from './SamePlateAppearanceOccupiedRunnerTagUp';
import { deriveBallWorldPlayerBaseContactHistory } from '../../core/sim/ball/BallWorldPlayerBaseContactHistory';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import { geometry } from '../../core/sim/ball/BattedWorldScheduledFieldThrow.test-support';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
const zero = { x: 0, y: 0, z: 0 };
const roles = ['body', 'glove', 'tag_hand', 'left_foot', 'right_foot'] as const;
/** Structural Native prefix. Real Core computes contacts from continuous body
 * curves; these return curves are test evidence, not an accepted return policy. */
const fixture = (horizon = 2, firstTouch = 1, originTick = 0, originHalfSize = 0.25) => {
  const shape = structuredClone(geometry(27)), enrollment = { owner: 'same_pa_enrollments', sourceId: 'enrollment', sourceHash: hash('e'), snapshotHash: hash('e') };
  (shape.baseGeometry.bases.first.region.halfSize as { x: number; z: number }).z = originHalfSize;
  const body = { playerId: 'runner', personId: 'person', bodyOriginHeightMeters: 2,
    primitives: roles.map(role => ({ role, radius: 0.05, offset: { x: 0, y: role.endsWith('foot') ? -1 : 0, z: 0 } })) };
  const spans = [{ start: 0, end: 1, z: 0, velocity: 0, acceleration: 2 },
    { start: 1, end: 3, z: 1, velocity: 2, acceleration: -2 }, { start: 3, end: 4, z: 1, velocity: -2, acceleration: 2 }];
  const segments = spans.filter(s => s.start < horizon).map(s => ({ originTick, startElapsedSeconds: s.start, endElapsedSeconds: Math.min(s.end, horizon),
    actors: body.primitives.map(p => ({ playerId: 'runner', startElapsedSeconds: s.start, primitive: {
      role: p.role, radius: p.radius, startTick: originTick, endTick: originTick + 4_000_000, ticksPerSecond: 1_000_000,
      startCenter: { x: 27, y: 2 + p.offset.y, z: s.z }, startVelocity: { ...zero, z: s.velocity }, acceleration: { ...zero, z: s.acceleration } } })) }));
  const moment = (elapsedSeconds: number) => ({ originTick, elapsedSeconds, ball: { tick: quantizeEventTick(originTick, elapsedSeconds, 1_000_000),
    position: { x: 50, y: 10, z: 50 }, velocity: zero, spin: zero } });
  const contact = { moment: moment(firstTouch), contacts: [{ kind: 'actor', playerId: 'fielder', role: 'glove' }] };
  const root: any = { kind: 'same_pa_physical_field_root_v1', source: { sourceId: 'first-touch', sourceVersion: 'test' },
    lineage: { enrollmentReference: enrollment }, physicalPitchSourceId: 'pitch', geometry: shape,
    response: { world: { flight: { initialBall: { tick: originTick } }, parameters: { ticksPerSecond: 1_000_000 } } },
    field: { motion: { world: { kind: 'boundary', ...contact } } } };
  const last: any = { kind: 'same_pa_physical_field_step_v1', source: { sourceId: 'latest', sourceVersion: 'test' },
    evaluationTick: moment(horizon).ball.tick, field: { motion: { world: { moment: moment(horizon) } } } };
  const hold: any = { source: { sourceId: 'hold', sourceVersion: 'test', playerId: 'runner', personId: 'person',
    enrollmentReference: enrollment, coverageThroughTick: originTick + 4_000_000 }, startingBase: 1, body: { actor: body }, setup: { position: { x: 27, z: 0 } } };
  const bag = shape.baseGeometry.bases.first;
  const history = deriveBallWorldPlayerBaseContactHistory({ segments, playerId: 'runner', base: bag.region, baseSurfaceHeightMeters: bag.surfaceHeightMeters });
  const evidence: any = { physical: { segments, field: { evidence: { batterRunnerId: 'batter', defenderIds: ['fielder'], originTick,
    ticksPerSecond: 1_000_000, horizon: moment(horizon), contacts: [contact] } } },
    occupiedRunnerBaseContacts: [{ playerId: 'runner', bases: [{ base: 'first', history }] }],
    rule: { ballEvidence: { kind: 'fly_catch', firstFielderTouch: { fielderId: 'fielder', tick: contact.moment.ball.tick,
      ballCenter: contact.moment.ball.position } } } };
  return { match: { bases: { first: 'runner', second: null, third: null } } as any, root, holds: [hold], evidence,
    fields: [root, last], history };
};
const project = (input: ReturnType<typeof fixture>): any => {
  const derive = (tagUp as { deriveSamePaOccupiedRunnerTagUp?: Function }).deriveSamePaOccupiedRunnerTagUp;
  expect(derive, 'original occupied-runner legal-evidence adapter is missing').toBeTypeOf('function');
  return derive!(input);
};
it('ORT01 preserves actual early departure as appealable and pins original first-fielder contact', () => {
  const f = fixture(), result = project(f), runner = result.runners[0];
  expect(runner).toMatchObject({ playerId: 'runner', personId: 'person', startingBase: 'first',
    compliance: { kind: 'appealable_early_departure', originBase: 1, retouchTick: null } });
  expect(runner.history).toEqual(f.history);
  expect(runner.physicalRuleFacts.map((fact: any) => fact.kind)).toEqual(['runner_base_touch', 'runner_base_departure']);
  expect(result.firstFielderTouch.fieldReference).toEqual(reference('pa_physical_v1_field_roots', f.root));
  expect(result.firstFielderTouch.moment).toEqual(f.evidence.physical.field.evidence.contacts[0].moment);
  expect(result.appeal).toEqual({ kind: 'pending', reason: 'original_defensive_appeal_action_required' });
  expect(result.physicalEnd).toBeNull(); expect(result.officialRuling).toBeNull();
});
it('ORT02 uses actual origin-base retouch to restore compliance without inventing an appeal or terminal', () => {
  const f = fixture(4), result = project(f), runner = result.runners[0];
  expect(runner.physicalRuleFacts.map((fact: any) => fact.kind)).toEqual(['runner_base_touch', 'runner_base_departure', 'runner_base_touch']);
  expect(runner.compliance).toMatchObject({ kind: 'compliant', basis: 'retouched_after_first_touch',
    retouchTick: f.history.events[2].tick, legalAdvanceFromTick: f.history.events[2].tick });
  expect(runner.retouch).toEqual(f.history.events[2]); expect(runner.retouch.elapsedSeconds).toBeGreaterThan(3);
  expect(result.appeal.kind).toBe('pending'); expect(result.officialRuling).toBeNull();
});
it('ORT03 respects actual departure after first fielder touch and the exact-equality contract', () => {
  const after = project(fixture(2, 0.2));
  expect(after.runners[0].compliance).toMatchObject({ kind: 'compliant', basis: 'departed_at_or_after_first_touch' });
  const departure = fixture().history.events[1].elapsedSeconds;
  expect(project(fixture(2, departure)).runners[0].compliance).toMatchObject({ kind: 'compliant', basis: 'departed_at_or_after_first_touch' });
});
it.each(['early_departure', 'contact_before_first_touch', 'retouch_after_first_touch'] as const)
('ORT04 interprets exact %s moments even when their recorded ticks coincide', event => {
  const horizon = event === 'early_departure' ? 2 : 4;
  const history = fixture(horizon, 1, 0, 0.2500001).history;
  const actual = history.events[event === 'early_departure' ? 1 : 2];
  const firstTouch = actual.elapsedSeconds + (event === 'retouch_after_first_touch' ? -1e-10 : 1e-10);
  const f = fixture(horizon, firstTouch, 0, 0.2500001), result = project(f), compliance = result.runners[0].compliance;
  expect(f.evidence.rule.ballEvidence.firstFielderTouch.tick).toBe(actual.tick);
  expect(result.firstFielderTouch.moment.elapsedSeconds).not.toBe(actual.elapsedSeconds);
  if (event === 'early_departure') expect(compliance.kind).toBe('appealable_early_departure');
  else expect(compliance).toMatchObject({ kind: 'compliant', basis: event === 'retouch_after_first_touch'
    ? 'retouched_after_first_touch' : 'contact_at_first_fielder_touch' });
  expect(compliance.exact.firstFielderTouchElapsedSeconds).toBe(firstTouch);
  expect(result.runners[0].history).toEqual(history);
});
it('ORT05 interprets the actual contact interval without inserting a retouch at first fielder touch', () => {
  const f = fixture(4, 3.9), result = project(f), runner = result.runners[0];
  expect(runner.retouch.elapsedSeconds).toBeLessThan(3.9);
  expect(runner.compliance).toMatchObject({ kind: 'compliant', basis: 'contact_at_first_fielder_touch',
    exact: { legalAdvanceFromElapsedSeconds: 3.9 } });
  expect(runner.history.events).toHaveLength(3);
  expect(runner.physicalRuleFacts.map((fact: any) => fact.tick)).toEqual(f.history.events.map(e => e.tick));
});
it('ORT06 cannot infer departure from the observed horizon or tag-up obligation from an unconfirmed catch', () => {
  const held = project(fixture(0.2, 0.1));
  expect(held.runners[0].departure).toBeNull();
  expect(held.runners[0].compliance).toMatchObject({ kind: 'compliant', basis: 'contact_at_first_fielder_touch', departureTick: null });
  const f = fixture(); f.evidence.rule.ballEvidence = { kind: 'unresolved', reason: 'catch_pending' };
  const result = project(f);
  expect(result.firstFielderTouch.fact.fielderId).toBe('fielder');
  expect(result.runners[0].physicalRuleFacts).toHaveLength(2);
  expect(result.runners[0].compliance).toEqual({ kind: 'pending', reason: 'actual_fly_catch_first_touch_required' });
});
it('ORT07 retains the original epoch and exact recorded times at a large safe tick origin', () => {
  const f = fixture(4, 1, 2 ** 52), result = project(f);
  expect(result.evaluatedThrough).toEqual({ originTick: 2 ** 52, elapsedSeconds: 4, tick: 2 ** 52 + 4_000_000 });
  expect(result.runners[0].compliance).toMatchObject({ kind: 'compliant', firstFielderTouchTick: 2 ** 52 + 1_000_000,
    retouchTick: f.history.events[2].tick });
  expect(result.runners[0].retouch.elapsedSeconds).toBe(f.history.events[2].elapsedSeconds);
});
it.each(['missing_hold', 'duplicate_hold', 'wrong_base', 'wrong_person', 'wrong_enrollment', 'changed_shape', 'changed_history', 'wrong_fielder', 'missing_contact_source', 'exhausted_hold'] as const)
('ORT08 rejects %s instead of manufacturing original legal evidence', fault => {
  const f = fixture();
  if (fault === 'missing_hold') f.holds = [];
  if (fault === 'duplicate_hold') f.holds.push(f.holds[0]);
  if (fault === 'wrong_base') f.holds[0].startingBase = 2;
  if (fault === 'wrong_person') f.holds[0].body.actor.personId = 'foreign';
  if (fault === 'wrong_enrollment') f.holds[0].source.enrollmentReference = { ...f.root.lineage.enrollmentReference, sourceId: 'foreign' };
  if (fault === 'changed_shape') f.holds[0].body.actor.primitives[0].radius++;
  if (fault === 'changed_history') f.evidence.occupiedRunnerBaseContacts[0].bases[0].history = { ...f.history, events: [] };
  if (fault === 'wrong_fielder') f.evidence.rule.ballEvidence.firstFielderTouch.fielderId = 'other';
  if (fault === 'missing_contact_source') f.root.field.motion.world = { ...f.root.field.motion.world, kind: 'moving' };
  if (fault === 'exhausted_hold') f.holds[0].source.coverageThroughTick = 1_000_000;
  expect(() => project(f)).toThrow();
});
it('ORT09 independently maps another original stationary runner to its own base and history', () => {
  const f = fixture(), other = structuredClone(f.holds[0]);
  other.source = { ...other.source, sourceId: 'second-hold', playerId: 'runner2', personId: 'person2' };
  other.body.actor.playerId = 'runner2'; other.body.actor.personId = 'person2'; other.startingBase = 2; other.setup.position = { x: 27, z: 3 };
  f.holds.push(other); f.match.bases.second = 'runner2';
  for (const segment of f.evidence.physical.segments) segment.actors.push(...other.body.actor.primitives.map((p: any) => ({ playerId: 'runner2',
    primitive: { role: p.role, radius: p.radius, startTick: 0, endTick: 4_000_000, ticksPerSecond: 1_000_000,
      startCenter: { x: 27, y: 2 + p.offset.y, z: 3 }, startVelocity: zero, acceleration: zero } })));
  const bag = f.root.geometry.baseGeometry.bases.second;
  const history = deriveBallWorldPlayerBaseContactHistory({ segments: f.evidence.physical.segments, playerId: 'runner2', base: bag.region, baseSurfaceHeightMeters: bag.surfaceHeightMeters });
  f.evidence.occupiedRunnerBaseContacts.push({ playerId: 'runner2', bases: [{ base: 'second', history }] });
  const runners = project(f).runners;
  expect(runners.map((r: any) => [r.playerId, r.startingBase])).toEqual([['runner', 'first'], ['runner2', 'second']]);
  expect(runners[1].physicalRuleFacts).toEqual([{ kind: 'runner_base_touch', runnerId: 'runner2', base: 2, tick: 0 }]);
  expect(runners[1].departure).toBeNull();
});
it('ORT10 preserves physically absent initial foot contact as pending instead of inferring contact from official occupancy', () => {
  const f = fixture();
  for (const p of f.holds[0].body.actor.primitives) if (p.role.endsWith('foot')) p.offset.z = 1;
  for (const segment of f.evidence.physical.segments) for (const actor of segment.actors)
    if (actor.primitive.role.endsWith('foot')) actor.primitive.startCenter.z += 1;
  const bag = f.root.geometry.baseGeometry.bases.first;
  const history = deriveBallWorldPlayerBaseContactHistory({ segments: f.evidence.physical.segments, playerId: 'runner', base: bag.region, baseSurfaceHeightMeters: bag.surfaceHeightMeters });
  f.evidence.occupiedRunnerBaseContacts[0].bases[0].history = history;
  const result = project(f).runners[0];
  expect(result.history.contactAtStart).toBe(false); expect(result.physicalRuleFacts).toEqual([]);
  expect(result.compliance).toEqual({ kind: 'pending', reason: 'original_origin_base_contact_required' });
});
