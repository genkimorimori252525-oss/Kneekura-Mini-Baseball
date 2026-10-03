import { expect, it } from 'vitest';
import { deriveBallWorldFieldTerritory } from '../../core/rules/BallWorldFieldTerritory';
import type { BallWorldBoundaryContact, BallWorldMoment } from '../../core/sim/ball/BallWorldContinuation';
import { battedWorldBaseSurfaceId, type BattedWorldFieldMotion } from '../../core/sim/ball/BattedWorldFieldMotion';
import { battedWorldFieldFixture } from './BattedWorldFieldFixtures.test-support';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import { openSqliteBattedWorldFieldStore } from './SqliteBattedWorldFieldStore';
import { openSqliteBattedWorldFieldExecutionStore, type AcceptedBattedWorldFieldExecution,
  type DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';

const persistentFixture = (path: 'fields' | 'execution') => {
  // Material calibration is supplied before geometry acceptance. No adopted row or hash is edited.
  const x = battedWorldFieldFixture(undefined, true, true, undefined,
    { material: { restitution: 0, tangentialDamping: 0.25, spinDamping: 0.2 } });
  const first = x.fields.accept(x.source.sourceId), tick = first.field.motion.world.moment.ball.tick;
  const archive = () => x.f.db.prepare('SELECT source_json,source_hash,snapshot_json,snapshot_hash FROM batted_world_field_actions WHERE source_id=?')
    .get(first.source.sourceId);
  const originalArchive = archive();
  const sources = new Map<string, AcceptedBattedWorldFieldExecution>();
  let baseField = first, fields = [first];
  if (path === 'fields') {
    const source = { ...x.source, sourceId: 'persistent-field-2', previousFieldSourceId: first.source.sourceId,
      availableAtTick: tick, throughTick: tick + 100_000 };
    x.sources.set(source.sourceId, source); baseField = x.fields.accept(source.sourceId); fields = [first, baseField];
  }
  const executions = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields,
    { readAcceptedExecution: (id) => sources.get(id) ?? null }));
  const prefix: { baseField: typeof baseField; fields: typeof fields; executions: DurableBattedWorldFieldExecution[] } = {
    baseField, fields, executions: [] };
  if (path === 'execution') {
    const source: AcceptedBattedWorldFieldExecution = { sourceId: 'persistent-motion-1', sourceVersion: 'synthetic-v1',
      baseFieldSourceId: first.source.sourceId, previousExecutionSourceId: null,
      action: { kind: 'motion', availableAtTick: tick, throughTick: tick + 100_000, commands: x.source.commands } };
    sources.set(source.sourceId, source); prefix.executions.push(executions.accept(source.sourceId));
  }
  const latest = prefix.executions.at(-1)?.execution.field ?? baseField.field;
  return { x, first, latest, sources, executions, prefix, archive, originalArchive };
};

it.each([
  ['fields', 'first_base_race'], ['fields', 'base_touch_history'],
  ['execution', 'first_base_race'], ['execution', 'base_touch_history'],
] as const)('observes an adopted persistent %s prefix with %s and preserves its raw history', (path, kind) => {
  const f = persistentFixture(path), { x, first, latest, prefix } = f;
  try {
    const initial = first.field.motion.world, current = latest.motion.world;
    expect(first.field.motion.response.kind).toBe('rebound');
    expect(current).toMatchObject({ kind: 'boundary', pendingReason: 'persistent_contact' });
    expect(latest.motion.response.kind).toBe('unresolved');
    expect(latest.motion.cursor).toBeNull();
    expect(current.moment.elapsedSeconds).toBe(initial.moment.elapsedSeconds);
    expect(current.moment.ball.position).toEqual(initial.moment.ball.position);
    expect(current.moment.ball.velocity).not.toEqual(initial.moment.ball.velocity);
    expect(current.moment.ball.spin).not.toEqual(initial.moment.ball.spin);
    expect(latest.baseContacts).toMatchObject([{ baseId: 'third', continuing: true }]);
    const source: AcceptedBattedWorldFieldExecution = { sourceId: `persistent-observe-${kind}`, sourceVersion: 'synthetic-v1',
      baseFieldSourceId: prefix.baseField.source.sourceId, previousExecutionSourceId: prefix.executions.at(-1)?.source.sourceId ?? null,
      action: kind === 'first_base_race' ? { kind } : { kind, base: 'first',
        playerId: first.response.touch.worldContact.flight.physicalPitch.frame.batterActor!.binding.playerId } };
    f.sources.set(source.sourceId, source);
    const observed = f.executions.accept(source.sourceId);
    expect(observed.source).toEqual(source);
    expect(observed.execution.field).toEqual(latest);
    expect(observed.execution).not.toHaveProperty('officialClosure');
    expect(observed.execution).not.toHaveProperty('playEnd');
    if (observed.execution.kind === 'first_base_race') {
      const result = observed.execution;
      expect(result.fieldTerritory).toEqual({ kind: 'unresolved', reason: 'physical_contact_pending' });
      expect(result.ballEvidence).toEqual({ kind: 'unresolved', reason: 'physical_contact_pending' });
      expect(result.pendingContacts).toEqual([{ elapsedSeconds: initial.moment.elapsedSeconds,
        tick: initial.moment.ball.tick, reason: 'physical_contact_pending' }]);
      expect(result.groundRule).toBeNull();
      expect(result.ballDecisionMoment).toBeNull();
      expect(result.firstGroundMoment).toBeNull();
      for (const history of [result.batterFirstBase, ...result.defendersFirstBase]) {
        expect(history.history.startElapsedSeconds).toBe(0);
        expect(history.history.endElapsedSeconds).toBe(current.moment.elapsedSeconds);
        expect(history.history.events).toEqual([]);
        expect(history.controlledContacts).toEqual([]);
      }
    } else if (observed.execution.kind === 'base_touch_history') {
      expect(observed.execution.history.startElapsedSeconds).toBe(0);
      expect(observed.execution.history.endElapsedSeconds).toBe(current.moment.elapsedSeconds);
      expect(observed.execution.history.events).toEqual([]);
      expect(observed.execution.physicalRuleFacts).toEqual([]);
      expect(observed.execution.controlledContacts).toEqual([]);
    } else throw new Error('expected observation');
    const projected = battedWorldFieldPhysicalPrefix(prefix);
    expect(projected.field.evidence.contacts).toEqual([{ moment: initial.moment,
      contacts: [{ kind: 'surface', surfaceId: battedWorldBaseSurfaceId('third') }] }]);
    expect(projected.field.baseContacts).toEqual([{ ...first.field.baseContacts[0], continuing: true }]);
    expect(projected.field.evidence.horizon).toEqual(current.moment);
    expect(projected.controlWindows).toEqual([]);
    expect(deriveBallWorldFieldTerritory(projected.field)).toEqual({ kind: 'unresolved', reason: 'physical_contact_pending' });
    expect(f.archive()).toEqual(f.originalArchive);
    expect(x.fields.read(first.source.sourceId)).toEqual(first);
    const reopenedFields = x.f.track(openSqliteBattedWorldFieldStore(x.f.path, x.responses, x.bases));
    expect(reopenedFields.read(prefix.baseField.source.sourceId)).toEqual(prefix.baseField);
    const reopened = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, reopenedFields));
    for (const physical of prefix.executions) expect(reopened.read(physical.source.sourceId)).toEqual(physical);
    expect(reopened.read(source.sourceId)).toEqual(observed);
    expect(reopened.accept(source.sourceId)).toEqual(observed);
    expect(f.executions.accept(source.sourceId)).toEqual(observed);
    expect(f.archive()).toEqual(f.originalArchive);
  } finally { x.f.close(); }
}, 120_000);

it('validates raw companions before projection and rejects incompatible coincident states or new identities', () => {
  const f = persistentFixture('execution');
  try {
    const adopted = f.prefix.executions[0], field = adopted.execution.field, world = field.motion.world;
    if (world.kind !== 'boundary') throw new Error('persistent boundary fixture');
    const project = (changed: BattedWorldFieldMotion) => battedWorldFieldPhysicalPrefix({ ...f.prefix,
      executions: [{ ...adopted, execution: { kind: 'motion', field: changed } }] });
    const withMoment = (moment: BallWorldMoment): BattedWorldFieldMotion => ({ ...field,
      motion: { ...field.motion, world: { ...world, moment, contacts: world.contacts.map((contact) => ({ ...contact, moment })) } },
      baseContacts: field.baseContacts.map((contact) => ({ ...contact, moment })) });
    const at = world.moment, before = f.first.field.motion.world.moment;
    // Companion must match its own raw post-response state, not the retained first-contact frame.
    expect(() => project({ ...field, baseContacts: field.baseContacts.map((contact) => ({ ...contact, moment: before })) }))
      .toThrow(/base contact provenance/);
    expect(() => project(withMoment({ ...at, ball: { ...at.ball, position: { ...at.ball.position, x: at.ball.position.x + 1 } } })))
      .toThrow(/coincident actual field contact states/);
    expect(() => project(withMoment({ ...at, originTick: at.originTick + 1, ball: { ...at.ball, tick: at.ball.tick + 1 } })))
      .toThrow(/original moment/);
    const extra: BallWorldBoundaryContact = { kind: 'surface', surfaceId: 'unowned-wall', moment: at,
      point: at.ball.position, normal: { x: 1, y: 0, z: 0 } };
    expect(() => project({ ...field, motion: { ...field.motion, world: { ...world, contacts: [...world.contacts, extra] } } }))
      .toThrow(/coincident actual field contact states/);
    const point = { ...field.baseContacts[0].point, x: field.baseContacts[0].point.x + 1 };
    expect(() => project({ ...field, baseContacts: field.baseContacts.map((contact) => ({ ...contact, point })),
      motion: { ...field.motion, world: { ...world,
        contacts: world.contacts.map((contact) => contact.kind === 'surface' ? { ...contact, point } : contact) } } }))
      .toThrow(/coincident actual field base contact identities/);
  } finally { f.x.f.close(); }
}, 120_000);
