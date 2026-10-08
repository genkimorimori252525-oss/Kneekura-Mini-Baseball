import { battedVenueLegalEvidenceFromSqlite } from './BattedVenueLegalEvidenceFromSqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { battedWorldFieldFixture } from './BattedWorldFieldFixtures.test-support';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { openSqliteBattedEpisodeFieldBindingStore } from './SqliteBattedEpisodeFieldBindingStore';
import { openSqliteBattedVenueLegalPolicyStore, type AcceptedBattedVenueLegalPolicy } from './SqliteBattedVenueLegalPolicyStore';
import { battedWorldFieldEvidenceFromSqlite, withBattedWorldFieldReadTraversal } from './SqliteBattedWorldFieldStore';
import { openSqliteBattedWorldFieldExecutionStore, type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import type { AcceptedBattedEpisodeFieldBinding } from './BattedEpisodeFieldBinding';

const directories: string[] = [];
const fixtures: ReturnType<typeof battedWorldFieldFixture>[] = [];
afterEach(() => { for (const x of fixtures.splice(0).reverse()) x.f.close(); for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });
const fixture = (venueProfile = false) => { const directory = mkdtempSync(join(tmpdir(), 'episode-binding-consumers-')); directories.push(directory); const x = battedWorldFieldFixture(join(directory, 'world.sqlite'), true, true, undefined, venueProfile ? { originalProfile: { ruleProfileId: NPB_2026_RULE_PROFILE.id } } : undefined); fixtures.push(x); return x; };
const bind = (x: ReturnType<typeof fixture>) => {
  const source: AcceptedBattedEpisodeFieldBinding = { sourceId: 'episode-binding', sourceVersion: 'fixture-v1',
    version: 'batted_episode_field_binding_v1', responseSourceId: x.response.source.sourceId,
    fieldCalibrationSourceId: x.geometrySource.sourceId };
  const bindings = x.f.track(openSqliteBattedEpisodeFieldBindingStore(x.f.path, { readAcceptedBinding: id => id === source.sourceId ? source : null }));
  return { source, bindings, value: bindings.accept(source.sourceId), field: { ...x.source,
    episodeFieldBinding: { version: 'batted_episode_field_binding_v1' as const, sourceId: source.sourceId } } };
};
it('executes the explicit binding field arm through prefix, territory, execution and venue-policy consumers', () => {
  const x = fixture(true), bound = bind(x), calibration = json(x.geometry);
  x.sources.set(bound.field.sourceId, bound.field as never);
  let first: ReturnType<typeof x.fields.accept> | undefined;
  expect(() => { first = x.fields.accept(bound.field.sourceId); }).not.toThrow();
  expect(first).toMatchObject({ rootKind: 'episode_field_binding_v1', episodeFieldBinding: bound.value });
  expect(first!.response).toEqual(bound.value.response);
  expect(json(first!.geometry)).toBe(calibration);
  expect(first!.field.baseContacts[0].baseId).toBe('third');
  const physical = battedWorldFieldPhysicalPrefix({ baseField: first!, fields: [first!], executions: [] });
  expect(physical.field.evidence.field).toEqual(bound.value.geometry.baseGeometry.field);
  expect(x.fields.interpret(first!.source.sourceId)?.territory).toMatchObject({ kind: 'resolved', territory: 'fair' });
  const world = first!.response.touch.worldContact;
  const policySource: AcceptedBattedVenueLegalPolicy = { sourceId: 'bound-field-policy', sourceVersion: 'fixture-v1', version: 'batted_venue_legal_policy_v1',
    gameId: world.model.gameId, careerId: world.model.careerId, fixtureEventId: world.model.fixtureEventId,
    venueId: world.model.venueId, availableAtDay: 1, baseFieldSourceId: first!.source.sourceId,
    worldModelSourceId: world.model.sourceId, responseModelSourceId: first!.response.model.sourceId,
    fieldGeometrySourceId: first!.geometry.source.sourceId, baseGeometrySourceId: first!.geometry.baseGeometry.source.sourceId,
    rulePolicy: { version: 'untouched_settled_foul_dead_v1', ruleProfileId: NPB_2026_RULE_PROFILE.id, rulesRevision: NPB_2026_RULE_PROFILE.rulesRevision } };
  const policies = x.f.track(openSqliteBattedVenueLegalPolicyStore(x.f.path, { readAcceptedPolicy: id => id === policySource.sourceId ? policySource : null }));
  const policy = policies.accept(policySource.sourceId);
  expect(policy.dependencies).toHaveProperty('episodeFieldBindingHash', hash(bound.value));
  expect(policy.physicalPitchSourceId).toBe(bound.value.physicalPitchSourceId);
  expect(policy.dependencies.fieldGeometryHash).toBe(hash(x.geometry));
  const legal = battedVenueLegalEvidenceFromSqlite(x.f.db).read({ version: 'batted_venue_legal_observation_v1',
    policySourceId: policySource.sourceId, baseFieldSourceId: first!.source.sourceId, executionSourceId: null });
  expect(legal.physicalPitchSourceId).toBe(bound.value.physicalPitchSourceId);
  expect(legal.physicalCut.baseFieldSourceId).toBe(first!.source.sourceId);
  const source: AcceptedBattedWorldFieldExecution = { sourceId: 'bound-field-execution', sourceVersion: 'fixture-v1',
    baseFieldSourceId: first!.source.sourceId, previousExecutionSourceId: null,
    action: { kind: 'motion', availableAtTick: first!.field.motion.world.moment.ball.tick,
      throughTick: first!.field.motion.world.moment.ball.tick + 1000, commands: x.source.commands } };
  const executions = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields,
    { readAcceptedExecution: id => id === source.sourceId ? source : null }));
  const execution = executions.accept(source.sourceId);
  expect(execution.baseField).toEqual(first);
  expect(execution.execution.field.motion.world.moment.elapsedSeconds).toBeGreaterThan(first!.field.motion.world.moment.elapsedSeconds);
  expect(executions.read(source.sourceId)).toEqual(execution);
  expect(policies.read(policySource.sourceId)).toEqual(policy);
  expect(x.fields.read(first!.source.sourceId)).toEqual(first);
  expect(json(x.fields.readGeometry(x.geometrySource.sourceId))).toBe(calibration);
});
it.each(['missing_binding', 'wrong_response', 'wrong_calibration', 'runner', 'runner_pieces', 'inline_geometry'] as const)(
  'rejects the unsupported binding opt-in %s before physical field work', kind => {
    const x = fixture(), bound = bind(x);
    const changed = kind === 'missing_binding' ? { ...bound.field, episodeFieldBinding: { ...bound.field.episodeFieldBinding, sourceId: 'missing' } }
      : kind === 'wrong_response' ? { ...bound.field, responseSourceId: 'foreign' }
        : kind === 'wrong_calibration' ? { ...bound.field, geometrySourceId: 'foreign' }
          : kind === 'runner' || kind === 'runner_pieces' ? { ...bound.field, kind: kind === 'runner' ? 'owned_runner_field_v1' : 'owned_runner_field_pieces_v1', prePitchRunnerSourceId: 'foreign' }
            : { ...bound.field, episodeFieldBinding: { ...bound.field.episodeFieldBinding, geometry: x.geometry.geometry } };
    x.sources.set(changed.sourceId, changed as never);
    expect(() => x.fields.accept(changed.sourceId)).toThrow();
    expect(x.f.db.prepare('SELECT count(*) AS n FROM batted_world_field_actions').get()!.n).toBe(0);
  });
it.each(['legacy_to_bound', 'bound_to_legacy', 'changed_binding'] as const)('rejects %s inside one physical field prefix', mode => {
  const x = fixture(), bound = bind(x);
  if (mode !== 'legacy_to_bound') x.sources.set(bound.field.sourceId, bound.field as never);
  const first = x.fields.accept(x.source.sourceId);
  const next = { ...(mode === 'bound_to_legacy' ? x.source : bound.field), sourceId: 'next-field', previousFieldSourceId: first.source.sourceId,
    throughTick: first.field.motion.world.moment.ball.tick + 1000,
    ...(mode === 'changed_binding' ? { episodeFieldBinding: { ...bound.field.episodeFieldBinding, sourceId: 'another-binding' } } : {}) };
  x.sources.set(next.sourceId, next as never);
  expect(() => x.fields.accept(next.sourceId)).toThrow();
  expect(x.f.db.prepare('SELECT count(*) AS n FROM batted_world_field_actions').get()!.n).toBe(1);
  expect(x.fields.read(first.source.sourceId)).toEqual(first);
});
it('rejects a mixed binding mode after an authenticated legacy read in one private traversal', () => {
  const x = fixture(), bound = bind(x), first = x.fields.accept(x.source.sourceId);
  const source = { ...bound.field, sourceId: 'mode-switch', previousFieldSourceId: first.source.sourceId,
    throughTick: first.field.motion.world.moment.ball.tick + 1000 };
  // derive replays the proposed Source against the existing prefix; no forged
  // persisted second physical pitch or second binding is introduced here.
  x.f.db.exec('BEGIN');
  try {
    withBattedWorldFieldReadTraversal(x.f.db, () => {
      const own = battedWorldFieldEvidenceFromSqlite(x.f.db);
      expect(own.read(first.source.sourceId)).toEqual(first);
      expect(() => own.derive(source as never)).toThrow();
    });
    expect(x.f.db.isTransaction).toBe(true);
  } finally { x.f.db.exec('ROLLBACK'); }
});
it.each(['root_kind_only', 'missing_receipt', 'foreign_pitch', 'changed_geometry'] as const)(
  'rejects spoofed %s when projecting a binding physical prefix', kind => {
    const x = fixture(), bound = bind(x);
    x.sources.set(bound.field.sourceId, bound.field as never);
    const first = x.fields.accept(bound.field.sourceId);
    const changed = kind === 'root_kind_only' ? { ...first, rootKind: 'foreign' }
      : kind === 'missing_receipt' ? Object.fromEntries(Object.entries(first).filter(([key]) => key !== 'episodeFieldBinding'))
        : { ...first, episodeFieldBinding: { ...bound.value, ...(kind === 'foreign_pitch'
          ? { physicalPitchSourceId: 'foreign' } : { geometry: { ...bound.value.geometry, unexpected: true } }) } };
    expect(() => battedWorldFieldPhysicalPrefix({ baseField: changed as never, fields: [changed as never], executions: [] })).toThrow();
  });
it('retains exact legacy Source and durable root shape with no implicit binding default', () => {
  const x = fixture(), first = x.fields.accept(x.source.sourceId);
  expect(first.source).toEqual(x.source);
  expect(first).not.toHaveProperty('rootKind');
  expect(first).not.toHaveProperty('episodeFieldBinding');
  expect(x.fields.read(first.source.sourceId)).toEqual(first);
  expect(() => battedWorldFieldPhysicalPrefix({ baseField: first, fields: [first], executions: [] })).not.toThrow();
});

it('carries the bound root through owned scheduled retained motion without changing actor authority', async () => {
  const { actualPlayersKinematicsFromPrefix } = await import('./ActualPlayerKinematicsFromPrefix');
  const { ownedMotionKnownWorkFromSqlite } = await import('./OwnedMotionKnownWorkFromSqlite');
  const x = fixture(), bound = bind(x);
  x.sources.set(bound.field.sourceId, bound.field as never);
  const first = x.fields.accept(bound.field.sourceId);
  const sources = new Map<string, AcceptedBattedWorldFieldExecution>();
  const executions = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields,
    { readAcceptedExecution: id => sources.get(id) ?? null }));
  const playerIds = first.source.commands.map(command => command.playerId);
  const prefix = { baseField: first, fields: [first], executions: [] };
  const selves = actualPlayersKinematicsFromPrefix(playerIds, prefix);
  const source: AcceptedBattedWorldFieldExecution = { sourceId: 'bound-owned-motion', sourceVersion: 'fixture-v1',
    baseFieldSourceId: first.source.sourceId, previousExecutionSourceId: null,
    action: { kind: 'owned_motion_v2', checkpoint: { kind: 'motion', throughTick: first.field.motion.world.moment.ball.tick + 1000 },
      knownWork: ownedMotionKnownWorkFromSqlite(x.f.db, bound.value.physicalPitchSourceId, playerIds),
      contributions: selves.map(self => ({ kind: 'retained', playerId: self.playerId, command: self.activeCommand })) } };
  sources.set(source.sourceId, source);
  const value = executions.accept(source.sourceId);
  expect(value.execution.kind).toBe('owned_motion_v2');
  expect(value.baseField).toEqual(first);
  expect(value.execution.field.motion.world.moment.elapsedSeconds).toBeGreaterThan(first.field.motion.world.moment.elapsedSeconds);
  expect(executions.read(source.sourceId)).toEqual(value);
});
