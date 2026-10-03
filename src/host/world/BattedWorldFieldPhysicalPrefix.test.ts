import { afterAll, beforeAll, expect, it } from 'vitest';
import { battedWorldFieldThrowFixture } from './BattedWorldFieldExecutionFixtures.test-support';
import { battedWorldFieldFixture } from './BattedWorldFieldFixtures.test-support';
import { battedWorldFieldPhysicalPrefix, battedWorldFieldBaseTouchHistoryFromPrefix } from './BattedWorldFieldPhysicalPrefix';
import { openSqliteBattedWorldFieldExecutionStore, type DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';

let x: ReturnType<typeof battedWorldFieldThrowFixture>, thrown: DurableBattedWorldFieldExecution;
beforeAll(() => { x = battedWorldFieldThrowFixture(); thrown = x.executions.accept(x.source.sourceId); }, 60_000);
afterAll(() => x?.f.close());
const input = () => ({ baseField: x.baseField, fields: [x.baseField], executions: [x.acquired, thrown] });

it('uses original elapsed zero, actual fractional capture and release-exclusive custody', () => {
  const value = battedWorldFieldPhysicalPrefix(input());
  if (thrown.execution.kind !== 'throw' || thrown.execution.throw.kind !== 'released') throw new Error('released fixture');
  expect(value.segments[0].startElapsedSeconds).toBe(0);
  expect(value.segments.at(-1)!.endElapsedSeconds).toBe(thrown.execution.field.motion.world.moment.elapsedSeconds);
  expect(value.segments.at(-1)!.startElapsedSeconds).toBe(x.capture.moment.elapsedSeconds);
  expect(value.segments.at(-2)).toMatchObject({ startElapsedSeconds: x.capture.contactMoment.elapsedSeconds,
    endElapsedSeconds: x.capture.moment.elapsedSeconds, actors: x.baseField.field.motion.actors });
  expect(x.capture.moment.elapsedSeconds).not.toBe((x.capture.secureTick - value.field.evidence.originTick) / value.field.evidence.ticksPerSecond);
  expect(value.controlWindows).toEqual([
    { playerId: x.capture.acquirerPlayerId, startElapsedSeconds: x.capture.moment.elapsedSeconds,
      endElapsedSeconds: x.capture.moment.elapsedSeconds, endInclusive: true },
    { playerId: x.capture.acquirerPlayerId, startElapsedSeconds: x.capture.moment.elapsedSeconds,
      endElapsedSeconds: thrown.execution.throw.releaseCursor.moment.elapsedSeconds, endInclusive: false },
  ]);
  expect(value.field.evidence.acquisitions).toEqual([x.capture]);
  expect(value.field.evidence.contacts[0].moment).toEqual(x.capture.contactMoment);
  expect(value.field.evidence.horizon).toEqual(thrown.execution.field.motion.world.moment);
});

it('derives both-foot history through the same physical horizon without assigning control to the batter', () => {
  const geometry = x.baseField.geometry.geometry.baseGeometry, playerId = x.response.touch.worldContact.flight.physicalPitch.frame.batterActor!.binding.playerId;
  const result = battedWorldFieldBaseTouchHistoryFromPrefix({ ...input(), playerId,
    base: geometry.bases.first.region, baseSurfaceHeightMeters: geometry.bases.first.surfaceHeightMeters });
  expect(result.history.startElapsedSeconds).toBe(0);
  expect(result.history.endElapsedSeconds).toBe(thrown.execution.field.motion.world.moment.elapsedSeconds);
  expect(result.controlledContacts).toEqual([]);
});

it('rejects missing, reordered and rebound prefix identities', () => {
  expect(() => battedWorldFieldPhysicalPrefix({ ...input(), fields: [] })).toThrow(/prefix/);
  expect(() => battedWorldFieldPhysicalPrefix({ ...input(), executions: [thrown] })).toThrow(/prefix/);
  expect(() => battedWorldFieldPhysicalPrefix({ ...input(), executions: [thrown, x.acquired] })).toThrow(/prefix/);
  expect(() => battedWorldFieldPhysicalPrefix({ ...input(), executions: [{ ...x.acquired, baseField: { ...x.baseField,
    source: { ...x.baseField.source, sourceId: 'rebound-root' } } }, thrown] })).toThrow(/scope|root|prefix/);
  expect(() => battedWorldFieldPhysicalPrefix({ ...input(), fields: [{ ...x.baseField, revision: 1.5 }] })).toThrow(/prefix/);
});

it('rejects discontinuous actor rebases before a history can select a player', () => {
  const field = thrown.execution.field;
  const changed = { ...thrown, execution: { ...thrown.execution, field: { ...field, motion: { ...field.motion,
    actors: field.motion.actors.map((actor, index) => index ? actor : { ...actor,
      primitive: { ...actor.primitive, startCenter: { ...actor.primitive.startCenter, x: actor.primitive.startCenter.x + 1 } } }) } } } };
  expect(() => battedWorldFieldPhysicalPrefix({ ...input(), executions: [x.acquired, changed] })).toThrow(/actor|rebase|throw/);
});

it('preserves every adopted bag companion and rejects missing or rebound provenance', () => {
  const y = battedWorldFieldFixture();
  try {
    const baseField = y.fields.accept(y.source.sourceId), prefix = { baseField, fields: [baseField], executions: [] };
    const result = battedWorldFieldPhysicalPrefix(prefix);
    expect(result.field.baseContacts).toEqual(baseField.field.baseContacts);
    expect(result.field.baseContacts.length).toBeGreaterThan(0);
    const changed = { ...baseField, field: { ...baseField.field, baseContacts: [] } };
    expect(() => battedWorldFieldPhysicalPrefix({ ...prefix, baseField: changed, fields: [changed] })).toThrow(/base|provenance/);
  } finally { y.f.close(); }
}, 60_000);

it.each(['capture', 'carry', 'transfer', 'release'] as const)('preserves adopted bag provenance during %s with actual custody boundaries', async (kind) => {
  const { fieldPhysicalBagFixture } = await import('./BattedWorldFieldPhysicalPrefixFixtures.test-support');
  const y = fieldPhysicalBagFixture(kind);
  try {
    const value = battedWorldFieldPhysicalPrefix({ baseField: y.baseField, fields: [y.baseField], executions: y.prefix });
    const last = y.prefix.at(-1)!.execution;
    if (last.kind !== 'acquisition' && last.kind !== 'motion' && last.kind !== 'throw') throw new Error('physical fixture');
    const expected = last.kind === 'acquisition' ? last.acquisition.baseContacts : last.field.baseContacts;
    expect(expected).toHaveLength(1);
    expect(value.field.baseContacts).toEqual(expected);
    expect(expected[0].baseId).toBe(kind === 'release' ? 'home' : 'third');
    expect(value.field.evidence.contacts.at(-1)!.moment).toEqual(expected[0].moment);
    if (kind === 'capture') {
      expect(last).toMatchObject({ kind: 'acquisition', acquisition: { kind: 'interrupted', reason: 'contact' } });
      expect(value.controlWindows).toEqual([]);
    } else if (kind === 'release') {
      if (last.kind !== 'throw' || last.throw.kind !== 'released') throw new Error('release fixture');
      expect(value.controlWindows.at(-1)!.endElapsedSeconds).toBe(last.throw.releaseCursor.moment.elapsedSeconds);
      expect(value.controlWindows.at(-1)!.endElapsedSeconds).toBeLessThan(value.field.evidence.horizon.elapsedSeconds);
    } else {
      expect(value.controlWindows.at(-1)).toMatchObject({ endInclusive: false,
        endElapsedSeconds: value.field.evidence.horizon.elapsedSeconds });
    }
    expect(value.field.groundSegments).toEqual([]);
  } finally { y.f.close(); }
}, 60_000);


it('keeps failed glove retention as an actual rebound without manufacturing a capture or control', async () => {
  const { fieldPhysicalBagFixture } = await import('./BattedWorldFieldPhysicalPrefixFixtures.test-support');
  const y = fieldPhysicalBagFixture('rebound');
  try {
    expect(y.baseField.field.motion.response.kind).toBe('rebound');
    const value = battedWorldFieldPhysicalPrefix({ baseField: y.baseField, fields: [y.baseField], executions: y.prefix });
    expect(value.field.evidence.acquisitions).toEqual([]);
    expect(value.controlWindows).toEqual([]);
    expect(value.field.evidence.contacts).toHaveLength(2);
    expect(value.field.baseContacts).toMatchObject([{ baseId: 'home' }]);
    expect(value.segments.at(-1)!.startElapsedSeconds).toBe(y.baseField.field.motion.cursor!.moment.elapsedSeconds);
    expect(value.field.evidence.horizon.elapsedSeconds).toBeGreaterThan(y.baseField.field.motion.world.moment.elapsedSeconds);
  } finally { y.f.close(); }
}, 60_000);

it('begins a free ground interval at the adopted response cursor rather than the original incoming ball', () => {
  const y = battedWorldFieldFixture(undefined, true, false);
  try {
    const baseField = y.fields.accept(y.source.sourceId);
    expect(baseField.field.motion.response.kind).toBe('ground');
    const end = baseField.field.motion.world.moment.ball.tick;
    const source = { sourceId: 'ground-interval', sourceVersion: 'synthetic-v1', baseFieldSourceId: baseField.source.sourceId,
      previousExecutionSourceId: null, action: { kind: 'motion' as const, availableAtTick: end, throughTick: end + 100_000,
        commands: y.source.commands } };
    const owner = y.f.track(openSqliteBattedWorldFieldExecutionStore(y.f.path, y.fields,
      { readAcceptedExecution: () => source })), execution = owner.accept(source.sourceId);
    const value = battedWorldFieldPhysicalPrefix({ baseField, fields: [baseField], executions: [execution] });
    expect(value.field.groundSegments).toHaveLength(1);
    expect(value.field.groundSegments![0]).toMatchObject({ moment: baseField.field.motion.cursor!.moment,
      throughElapsedSeconds: execution.execution.field.motion.world.moment.elapsedSeconds });
    expect(value.field.groundSegments![0].moment.ball.velocity).not.toEqual(baseField.field.motion.world.moment.ball.velocity);
    expect(value.controlWindows).toEqual([]);
  } finally { y.f.close(); }
}, 60_000);

it('keeps observation rows outside physical time and scopes identical Source ids to their own owners', () => {
  const source = { ...x.source, sourceId: x.baseField.source.sourceId, previousExecutionSourceId: thrown.source.sourceId,
    action: { kind: 'first_base_race' as const } };
  x.sources.set(source.sourceId, source);
  const observed = x.executions.accept(source.sourceId);
  expect(battedWorldFieldPhysicalPrefix({ ...input(), executions: [...input().executions, observed] }))
    .toEqual(battedWorldFieldPhysicalPrefix(input()));
}, 60_000);
