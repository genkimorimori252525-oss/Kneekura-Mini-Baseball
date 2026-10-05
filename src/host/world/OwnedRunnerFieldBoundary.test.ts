import { expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ownedRunnerFieldInputs } from './OwnedRunnerFieldFixtures.test-support';
import { battedWorldResponseInput, battedWorldContinuationEvidenceFromSqlite } from './SqliteBattedWorldContinuationStore';
import { battedWorldMotionPrimitiveCommands } from './SqliteBattedWorldMotionStore';
import { battedWorldAcquisitionEvidenceFromSqlite } from './SqliteBattedWorldAcquisitionStore';
import { openSqliteBattedPostResponseFlightStore } from './SqliteBattedPostResponseFlightStore';
import { deriveBattedBallPostResponseFlight } from '../../core/sim/ball/BattedBallPostResponseFlight';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import { battedWorldFieldTerritoryFromPrefix } from './BattedWorldFieldTerritoryFromPrefix';
import { actualPlayerKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { deriveActualLivePlayScope } from './ActualLivePlayScope';
import { deriveInitialBattedWorldFieldMotion } from '../../core/sim/ball/BattedWorldFieldMotion';
import { deriveBallWorldBattedRuleEvidence } from '../../core/rules/BallWorldBattedRuleEvidence';
import type { DurableBattedWorldFieldAction } from './SqliteBattedWorldFieldStore';
const state = vi.hoisted(() => ({ flight: null as any, response: null as any }));
vi.mock('./SqliteBattedBallFlightStore', () => ({ battedBallFlightEvidenceFromSqlite: () => ({ read: () => state.flight }) }));
vi.mock('./SqliteBattedContactResponseStore', () => ({ battedContactResponseEvidenceFromSqlite: () => ({ read: () => state.response,
  current: (response: unknown) => { if (response !== state.response) throw new Error('source fixture response identity differs'); } }) }));
const fixture = (duration = 100_000) => {
  const x = ownedRunnerFieldInputs(); state.flight = x.flight;
  const world = x.deriveWorld(), root = x.deriveRoot(world); state.response = root.response;
  const source = { ...x.source, throughTick: x.source.availableAtTick + duration };
  // Genuine Core physical fixture, not a claimed Native admission. Each runner
  // acceleration comes from the original controller-derived primitive.
  const field = deriveInitialBattedWorldFieldMotion({ response: root.responseInput, geometry: x.geometry.geometry,
    availableAtTick: source.availableAtTick, throughTick: source.throughTick,
    commands: world.actors.map(a => ({ playerId: a.playerId, role: a.primitive.role, acceleration: a.primitive.acceleration })) });
  const baseField: DurableBattedWorldFieldAction = { source, response: root.response, geometry: x.geometry, revision: 1, history: [source], field };
  return { ...x, ...root, world, baseField, prefix: { baseField, fields: [baseField], executions: [] } };
};

it.each(['response_input', 'continuation', 'motion', 'acquisition', 'field_prefix', 'player_kinematics'] as const)
('keeps the complete runner field fixture outside the legacy %s capability', kind => {
  const x = fixture();
  try {
    expect(x.baseField.field.motion.actors).toHaveLength(55);
    const run = () => {
      if (kind === 'response_input') return battedWorldResponseInput(x.response);
      if (kind === 'continuation') return battedWorldContinuationEvidenceFromSqlite(x.db).derive({ sourceId: 'legacy-continuation', sourceVersion: 'v1',
        responseSourceId: x.response.source.sourceId, previousContinuationSourceId: null, throughTick: x.source.throughTick });
      if (kind === 'motion') return battedWorldMotionPrimitiveCommands(x.response, x.source.commands);
      if (kind === 'acquisition') return battedWorldAcquisitionEvidenceFromSqlite(x.db).derive({ sourceId: 'legacy-acquisition', sourceVersion: 'v1',
        responseSourceId: x.response.source.sourceId, continuationSourceId: null });
      if (kind === 'player_kinematics') return actualPlayerKinematicsFromPrefix('runner', x.prefix);
      return battedWorldFieldPhysicalPrefix(x.prefix);
    };
    expect(run).toThrow(/unsupported original pre-pitch runner consumer/);
  } finally { x.db.close(); }
});

// RED target: this public reader currently accepts a runner response projection
// because it relied on the upstream response owner to refuse all runner inputs.
it.each(['read', 'accept'] as const)('rejects a consistent runner post-response projection at public %s', operation => {
  const directory = mkdtempSync(join(tmpdir(), 'runner-field-projection-'));
  const path = join(directory, 'source.sqlite'), x = ownedRunnerFieldInputs(path);
  let store: ReturnType<typeof openSqliteBattedPostResponseFlightStore> | undefined;
  try {
    state.flight = x.flight;
    const world = x.deriveWorld(), { response } = x.deriveRoot(world); state.response = response;
    const source = { sourceId: 'runner-legacy-projection', sourceVersion: 'v1', contactResponseSourceId: response.source.sourceId,
      previousContinuationSourceId: null, searchDurationTicks: 100_000 };
    store = openSqliteBattedPostResponseFlightStore(path, { read: () => response }, { readAcceptedContinuation: id => id === source.sourceId ? source : null });
    const result = deriveBattedBallPostResponseFlight({ response: response.result,
      parameters: world.flight.source.execution.ballFlightParameters, searchDurationTicks: source.searchDurationTicks });
    expect(result).toEqual({ kind: 'requires_world_extension', throughTick: x.flight.flight.contact.tick });
    const value = { source, revision: 1, response, result };
    if (operation === 'read') {
      x.db.prepare('INSERT INTO batted_post_response_flights VALUES(?,?,?,?,?,?,?,?,?)').run(source.sourceId, source.contactResponseSourceId,
        response.model.gameId, 1, null, json(source), hash(source), json(value), hash(value));
    } else {
      // Minimal physical-pitch ownership metadata for this isolated downstream
      // boundary test; the legal producer chain is covered by the Native test.
      x.db.exec('CREATE TABLE physical_pitch_progress_actions(source_id TEXT,game_id TEXT,play_id INTEGER)');
      x.db.prepare('INSERT INTO physical_pitch_progress_actions VALUES(?,?,?)').run(world.flight.source.physicalPitchSourceId,
        response.model.gameId, world.flight.physicalPitch.frame.match.playId);
    }
    expect(() => store![operation](source.sourceId)).toThrow(/unsupported original pre-pitch runner consumer/);
    if (operation === 'accept') expect(x.db.prepare('SELECT count(*) AS n FROM batted_post_response_flights').get()).toEqual({ n: 0 });
  } finally { store?.close(); x.db.close(); rmSync(directory, { recursive: true, force: true }); }
});

// RED target: this entry currently relies on upstream runner rejection and needs its own fence.
it('does not silently turn runner field execution into supported territory interpretation', () => {
  const x = fixture();
  try {
    expect(x.baseField.field.motion.world.kind).toBe('moving');
    expect(() => battedWorldFieldTerritoryFromPrefix([x.baseField])).toThrow(/unsupported original pre-pitch runner consumer/);
  } finally { x.db.close(); }
});

it('keeps original pre-pitch runners outside the ten-participant actual live Scope and End prerequisite', () => {
  const x = fixture();
  try {
    const pitch = structuredClone(x.world.flight.physicalPitch) as any;
    pitch.frame.bindings = pitch.frame.batterActor!.defenderBindings;
    const source = { sourceId: 'runner-scope', sourceVersion: 'v1', capability: 'actual_live_play_scope_v1' as const,
      physicalPitchSourceId: pitch.source.sourceId, cut: { kind: 'field_execution' as const, baseFieldSourceId: x.baseField.source.sourceId, executionSourceId: null } };
    expect(() => deriveActualLivePlayScope(source, pitch, x.prefix)).toThrow(/unsupported original participation/);
  } finally { x.db.close(); }
});

it('preserves unresolved non-defender policy for a real runner body contact', () => {
  const x = fixture(500_000);
  try {
    const boundary = x.baseField.field.motion.world;
    expect(boundary.kind).toBe('boundary');
    if (boundary.kind !== 'boundary') throw new Error('fixture must reach real moving runner');
    expect(boundary.contacts).toMatchObject([{ kind: 'actor', playerId: 'runner', role: 'body' }]);
    const result = deriveBallWorldBattedRuleEvidence({ batterRunnerId: 'batter', defenderIds: x.world.flight.physicalPitch.frame.batterActor!.defenderBindings.map(b => b.playerId),
      field: x.geometry.geometry.baseGeometry.field, bases: x.geometry.geometry.baseGeometry.gates,
      ballRadiusMeters: x.flight.source.execution.ballFlightParameters.ballRadius, originTick: x.flight.flight.contact.tick, ticksPerSecond: 1_000_000,
      horizon: boundary.moment, contacts: [{ moment: boundary.moment, contacts: [{ kind: 'actor', playerId: 'runner', role: 'body' }] }], acquisitions: [] });
    expect(result).toEqual({ kind: 'unresolved', reason: 'non_defender_contact' });
    expect(x.baseField.field.motion.carrierPlayerId).toBeNull();
  } finally { x.db.close(); }
});
