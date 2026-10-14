import { expect, it } from 'vitest';
import { samePaPhysicalFieldActionInput } from './SamePlateAppearancePhysicalFieldAction';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const ref = (owner: string, sourceId: string) => ({ owner, sourceId, sourceHash: hash(sourceId), snapshotHash: hash(sourceId) });
const action = (): any => ({ kind: 'occupied_runner_motion_v1',
  member: { playerId: 'runner', bindingHash: hash('binding'), personHash: hash('person'), baselineSourceId: 'baseline',
    reservedRevision: 0, reservedStateHash: hash('reserved'), projectedStateHash: hash('projected') },
  holdReference: ref('world_same_pa_occupied_runner_holds', 'hold'), predecessorMotionReference: null,
  route: { segments: [{ kind: 'line', start: { x: 27, z: 0 }, end: { x: 27, z: 30 } }] },
  intent: { kind: 'advance', issuedTick: 0 }, endTick: 3_000_000,
  provenance: { sourceRecordId: 'explicit-runner-advance', sourceVersion: 'test' } });
it('ORM01 admits only an explicit finite original occupied-runner advance source', () => {
  expect(() => samePaPhysicalFieldActionInput(action())).not.toThrow();
});

import { deriveSamePaOccupiedRunnerMotion, deriveSamePaOccupiedRunnerMotionCensus } from './SamePlateAppearanceOccupiedRunnerMotion';
import { samePaBatterRunFixture } from './SamePlateAppearanceBatterRunFixtures.test-support';
import { deriveBattedWorldFieldMotionAdoption } from '../../core/sim/ball/BattedWorldFieldMotion';
import { samplePiecewiseFieldActor } from '../../core/sim/ball/BattedWorldPiecewiseFieldMotion';
import { deriveSamePaFieldRuleEvidence } from './SamePlateAppearanceFieldRuleEvidence';
import { deriveSamePaStationaryOccupiedRunners } from './SamePlateAppearanceStationaryOccupiedRunners';
import { deriveSamePaLiveWorkCensus } from './SamePlateAppearanceLiveWorkCensus';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
const fieldRef = (f: any) => reference(f.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', f);
/** Structural Native inputs; real existing Core performs every physical sample
 * and contact. Original SQLite admission is left to the combined Native lane. */
const fixture = () => {
  const h = samePaBatterRunFixture(true), root = h.root;
  root.operationOrdinal = 0; root.pitchOrdinal = 1;
  root.lineage.enrollmentReference = ref('same_pa_enrollments', 'enrollment');
  root.source.parameters = root.response.world.parameters;
  const body = { playerId: 'runner', personId: 'runner-person', bodyOriginHeightMeters: 2,
    primitives: h.plan.exitState.body.primitives.map((p: any) => ({ ...p, offset: { x: 0, y: p.role.endsWith('foot') ? -1 : 0, z: 0 } })) };
  const runnerActors = body.primitives.map((p: any) => ({ playerId: 'runner', primitive: {
    ...root.response.world.actors[0].primitive, role: p.role, radius: p.radius,
    startCenter: { x: 27, y: 2 + p.offset.y, z: 0 } } }));
  root.response.world.actors.push(...runnerActors);
  root.response.actors.push(...root.response.actors.filter((a: any) => a.playerId === 'batter').map((a: any) => ({ ...a, playerId: 'runner' })));
  root.field = deriveBattedWorldFieldMotionAdoption({ response: root.response, geometry: root.geometry,
    actors: root.response.world.actors, carrierPlayerId: null, cursor: root.field.motion.cursor,
    availableAtTick: 0, coverageThroughTick: 5_000_000,
    commands: root.response.world.actors.map((a: any) => ({ playerId: a.playerId, role: a.primitive.role, acceleration: { x: 0, y: 0, z: 0 } })) });
  const hold: any = { source: { sourceId: 'hold', sourceVersion: 'test', playerId: 'runner', personId: 'runner-person',
    enrollmentReference: root.lineage.enrollmentReference, intent: { kind: 'hold', issuedTick: 0 }, coverageThroughTick: 5_000_000 },
    setup: { playerId: 'runner', personId: 'runner-person', tick: 0, position: { x: 27, z: 0 }, velocity: { x: 0, z: 0 } },
    startingBase: 1, body: { actor: body }, model: { source: { motion: { ...h.plan.exitState.model.runnerModel.source.motion, reactionDelayTicks: 100_000 } } } };
  const accepted = action(); accepted.holdReference = reference('world_same_pa_occupied_runner_holds', hold);
  const match: any = { bases: { first: 'runner', second: null, third: null }, outs: 0 };
  const basis: any = { members: [accepted.member], actor: { binding: { playerId: 'batter' }, match,
    world: { runners: [{ playerId: 'runner', position: hold.setup.position, velocity: hold.setup.velocity }] } } };
  const prefix: any[] = [root];
  const source = (throughTick: number, patch: any = {}) => {
    const previous = prefix.at(-1), own = [...prefix].reverse().find(f => f.actionResult?.kind === 'occupied_runner_motion_v1');
    return { sourceId: 'motion-' + prefix.length, sourceVersion: 'test', throughTick,
      previousFieldReference: fieldRef(previous), previousOperationReference: fieldRef(previous), fieldRootReference: fieldRef(root),
      action: { ...accepted, predecessorMotionReference: own ? fieldRef(own) : null, ...patch } } as any;
  };
  const move = (throughTick: number, patch: any = {}) => {
    const s = source(throughTick, patch), previous = prefix.at(-1);
    const value = deriveSamePaOccupiedRunnerMotion(s, root, previous, hold, basis, prefix);
    const step = { ...previous, ...value, kind: 'same_pa_physical_field_step_v1', source: s, operationOrdinal: previous.operationOrdinal + 1 };
    prefix.push(step); return step;
  };
  const evidence = () => deriveSamePaFieldRuleEvidence({ fields: prefix, batterRunnerId: 'batter', defenderIds: ['fielder'], occupiedRunnerIds: ['runner'], outsAtStart: 0 });
  return { root, hold, basis, prefix, move, source, evidence, accepted, match };
};
it('ORM02 preserves reaction, actual five-part displacement and both base departure and touch histories', () => {
  const h = fixture(), before = JSON.stringify(h.match), original = h.evidence();
  expect(original).not.toHaveProperty('occupiedRunnerBaseContacts');
  expect(deriveSamePaStationaryOccupiedRunners({ match: h.match, root: h.root, holds: [h.hold], evidence: original }).kind)
    .toBe('same_pa_stationary_occupied_runners_v1');
  const waiting = h.move(50_000), actors = waiting.field.motion.actors.filter((a: any) => a.playerId === 'runner');
  expect(actors).toHaveLength(5);
  expect(actors.every((a: any) => samplePiecewiseFieldActor(a, waiting.field.motion.world.moment).center.z === 0)).toBe(true);
  expect(deriveSamePaOccupiedRunnerMotionCensus(h.prefix)[0]).toMatchObject({ adopted: true, work: [
    { kind: 'reaction', dueTick: 100_000, due: 'future' },
    { kind: 'controller_piece', dueTick: 100_000, due: 'future' },
    { kind: 'controller_end', dueTick: 3_000_000, due: 'future' },
  ] });
  h.move(100_000); const advanced = h.move(2_000_000), evidence = h.evidence();
  const moved = advanced.field.motion.actors.filter((a: any) => a.playerId === 'runner');
  expect(moved.every((a: any) => Math.abs(samplePiecewiseFieldActor(a, advanced.field.motion.world.moment).center.z - 3.61) < 1e-12)).toBe(true);
  const histories = evidence.occupiedRunnerBaseContacts![0];
  expect(histories.playerId).toBe('runner');
  expect(histories.bases.map(b => b.base)).toEqual(['home', 'first', 'second', 'third']);
  expect(histories.bases.find(b => b.base === 'first')!.history).toMatchObject({ contactAtStart: true, contactAtHorizon: false });
  expect(histories.bases.find(b => b.base === 'first')!.history.events.map(e => e.kind)).toEqual(['touch', 'departure']);
  expect(histories.bases.find(b => b.base === 'second')!.history.events.map(e => e.kind)).toEqual(['touch', 'departure']);
  expect(histories.bases.every(b => b.history.endElapsedSeconds === 2)).toBe(true);
  expect(deriveSamePaStationaryOccupiedRunners({ match: h.match, root: h.root, holds: [h.hold], evidence }))
    .toEqual({ kind: 'pending', reason: 'occupied_runner_moving_history_consumer_required' });
  expect(evidence.terminal.physicalEnd).toBeNull(); expect(JSON.stringify(h.match)).toBe(before);
  expect(evidence.physical.controlWindows).toEqual([]);
  const census = deriveSamePaLiveWorkCensus({ fields: h.prefix, participantIds: ['batter', 'fielder', 'runner'], observationPolicies: [],
    possessionEvidence: { policy: 'scheduled_capture_confirmation_v1', originTick: 0, ticksPerSecond: 1_000_000, throughElapsedSeconds: 2, pending: [] } });
  expect(census.occupiedRunnerMotions![0].work).toEqual([
    { kind: 'controller_piece', dueTick: 2_600_000, due: 'future' }, { kind: 'controller_end', dueTick: 3_000_000, due: 'future' }]);
  expect(census.participantCurves.map(c => c.playerId)).toEqual(['batter', 'fielder', 'runner']);
});
it('ORM03 crosses analytic boundaries only through the same original command and keeps its exhausted end due', () => {
  const h = fixture(); h.move(100_000); h.move(2_600_000); const last = h.move(3_000_000);
  expect(last.actionResult.controllerSegmentIndex).toBe(2);
  expect(deriveSamePaOccupiedRunnerMotionCensus(h.prefix)[0].work).toEqual([
    { kind: 'controller_piece', dueTick: 3_000_000, due: 'due' }, { kind: 'controller_end', dueTick: 3_000_000, due: 'due' }]);
  expect(() => h.move(3_000_001)).toThrow(/exhausted|coverage/);
  expect(h.evidence().terminal.kind).toBe('pending');
});
it.each(['no_intent', 'implicit_hold', 'no_provenance', 'new_route', 'new_end', 'foreign_predecessor', 'missing_predecessor'] as const)
('ORM04 rejects %s without replacing accepted control', fault => {
  const h = fixture(); h.move(100_000); const a = structuredClone(h.source(200_000).action);
  if (fault === 'no_intent') delete a.intent;
  if (fault === 'implicit_hold') a.intent.kind = 'hold';
  if (fault === 'no_provenance') delete a.provenance;
  if (fault === 'new_route') a.route.segments[0].end.z++;
  if (fault === 'new_end') a.endTick++;
  if (fault === 'foreign_predecessor') a.predecessorMotionReference = ref('pa_physical_v1_field_steps', 'foreign');
  if (fault === 'missing_predecessor') a.predecessorMotionReference = null;
  const source = { ...h.source(200_000), action: a };
  expect(() => deriveSamePaOccupiedRunnerMotion(source, h.root, h.prefix.at(-1), h.hold, h.basis, h.prefix)).toThrow();
});
it.each(['wrong_player', 'wrong_person', 'wrong_hold', 'wrong_member', 'route_start', 'body_pose', 'no_future', 'old_intent', 'future_intent', 'foreign_coverage', 'analytic_boundary', 'model_clock'] as const)
('ORM05 rejects %s at original adoption', fault => {
  const h = fixture(), s = h.source(50_000);
  if (fault === 'wrong_player') h.basis.actor.world.runners = [];
  if (fault === 'wrong_person') h.hold.body.actor.personId = 'foreign';
  if (fault === 'wrong_hold') s.action.holdReference = ref('world_same_pa_occupied_runner_holds', 'foreign');
  if (fault === 'wrong_member') s.action.member = { ...s.action.member, reservedRevision: 1 };
  if (fault === 'route_start') s.action.route = { segments: [{ kind: 'line', start: { x: 28, z: 0 }, end: { x: 27, z: 30 } }] };
  if (fault === 'body_pose') { h.root.field = structuredClone(h.root.field); h.root.field.motion.actors.find((a: any) => a.playerId === 'runner').primitive.startCenter.x++; }
  if (fault === 'no_future') s.action.endTick = 100_000;
  if (fault === 'old_intent') s.action.intent = { kind: 'advance', issuedTick: -1 };
  if (fault === 'future_intent') s.action.intent = { kind: 'advance', issuedTick: 1 };
  if (fault === 'foreign_coverage') { h.root.field = structuredClone(h.root.field); h.root.field.motion.actors.find((a: any) => a.playerId === 'fielder').primitive.endTick = 49_999; }
  if (fault === 'analytic_boundary') s.throughTick = 100_001;
  if (fault === 'model_clock') h.hold.model.source.motion.ticksPerSecond = 1_000;
  expect(() => deriveSamePaOccupiedRunnerMotion(s, h.root, h.root, h.hold, h.basis, h.prefix)).toThrow();
});
it('ORM06 preserves a later foreign replacement horizon and refuses received-response bypass', () => {
  const h = fixture(); const first = h.move(100_000);
  const changed = { ...first, field: structuredClone(first.field), source: { sourceId: 'foreign-replacement', sourceVersion: 'test' },
    actionResult: { kind: 'defender_motion_v1' } };
  for (const a of changed.field.motion.actors) if (a.playerId === 'fielder') a.primitive.endTick = 110_000;
  h.prefix.push(changed); expect(() => h.move(110_001)).toThrow(/coverage/);
  const other = fixture(); other.prefix.push({ ...other.root, kind: 'same_pa_physical_field_step_v1',
    source: { sourceId: 'received', sourceVersion: 'test' }, actionResult: { kind: 'occupied_runner_catch_response_v1', playerId: 'runner' } });
  expect(() => other.move(50_000)).toThrow(/actual first motor/);
});
it('ORM07 consumes the current projected-workload member while retaining the original issued controller', () => {
  const h = fixture(), first = h.move(100_000);
  const member = { ...h.accepted.member, projectedStateHash: hash('later-actual-workload') };
  h.basis.members = [member];
  expect(() => h.move(200_000)).toThrow(/binding/);
  const next = h.move(200_000, { member });
  expect(next.actionResult.controller).toEqual(first.actionResult.controller);
  expect(deriveSamePaOccupiedRunnerMotionCensus(h.prefix)).toHaveLength(1);
});

it('ORM exact speed-cap knots preserve the original occupied controller and future work within one tick',()=>{
  const h=fixture();h.hold.model.source.motion.topSpeedMps=0.000001;
  h.accepted.holdReference=reference('world_same_pa_occupied_runner_holds',h.hold);
  h.move(100_000);const first=h.move(100_001),at=first.field.motion.world.moment;
  expect(first.evaluationTick).toBe(100_001);expect(at.elapsedSeconds).toBeCloseTo(0.1000005,14);
  expect(first.actionResult.exactControllerPiece.coverageThroughElapsedSeconds).toBe(at.elapsedSeconds);
  const census=deriveSamePaOccupiedRunnerMotionCensus(h.prefix)[0];
  expect(census.work).toContainEqual({kind:'controller_piece',dueTick:100_001,dueElapsedSeconds:at.elapsedSeconds,due:'due'});
  const next=h.move(100_001);expect(next.evaluationTick).toBe(100_001);
  expect(next.field.motion.world.moment.elapsedSeconds).toBe(0.100001);
  expect(next.actionResult.controllerSegmentIndex).toBe(2);
  expect(deriveSamePaOccupiedRunnerMotionCensus(h.prefix)[0].work).toContainEqual({kind:'controller_end',dueTick:3_000_000,due:'future'});
  const history=h.evidence();expect(history.occupiedRunnerBaseContacts![0].playerId).toBe('runner');
  const live=deriveSamePaLiveWorkCensus({fields:h.prefix,participantIds:['batter','fielder','runner'],observationPolicies:[],
    possessionEvidence:{policy:'scheduled_capture_confirmation_v1',originTick:0,ticksPerSecond:1_000_000,throughElapsedSeconds:0.100001,pending:[]}});
  expect(live.exactRunnerControllerPieces![0]).toMatchObject({playerId:'runner',due:'future',dueElapsedSeconds:3});
});
