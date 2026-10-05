import { expect, it, vi } from 'vitest';
import * as observations from './SqliteActualFieldObservationStore';
import { requireOwnedRunnerObservation, runnerObservationFixture } from './OwnedRunnerFieldObservationContracts.test-support';
import { ownedRunnerFieldPiecesPhysicalPrefix } from './OwnedRunnerFieldPiecesPhysicalPrefix';
import { actualPlayerKinematicsFromRunnerFieldPieces } from './ActualPlayerKinematicsFromRunnerFieldPieces';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { projectedActorState } from './PrePitchRunnerFieldPiecesContracts.test-support';
import { playerObservationCalibrationFixture } from '../../core/sim/perception/PlayerObservationCalibrationFixtures.test-support';
import { evaluateObservationGeometry } from '../../core/sim/perception/ObservationGeometry';
import { composeObservationQuality } from '../../core/sim/perception/ObservationQuality';
import { estimateOcclusionVisibility } from '../../core/sim/perception/Occlusion';
const state = vi.hoisted(() => ({ flight: null as any, response: null as any, bases: null as any }));
vi.mock('./SqliteBattedBallFlightStore', () => ({ battedBallFlightEvidenceFromSqlite: () => ({ read: () => state.flight }) }));
vi.mock('./SqliteBattedContactResponseStore', () => ({ battedContactResponseEvidenceFromSqlite: () => ({ read: () => state.response }) }));
vi.mock('./SqliteBattedWorldBaseGeometryStore', () => ({ battedWorldBaseGeometryEvidenceFromSqlite: () => ({ read: () => state.bases }) }));

it.each([1, 2, 3] as const)('authenticates original public base %s without using it as current physical position or live rule knowledge', startingBase => {
  const x = runnerObservationFixture(state, { startingBase });
  try {
    const derive = requireOwnedRunnerObservation(observations, x.db), value = derive(x.source);
    const frame = x.field.response.touch.worldContact.flight.physicalPitch.frame;
    expect(value.originalPublicContext).toEqual({ kind: 'original_official_occupancy_v1', startingBase, normalNextBase: startingBase + 1,
      actorSourceId: frame.batterActor!.source.sourceId, officialRevision: frame.batterActor!.officialRevision,
      matchHash: hash(frame.batterActor!.match), availableAtTick: frame.world.tick });
    expect(value.knowledge).toEqual({ status: 'pending', knownContext: null, force: 'unavailable', tagUp: 'unavailable',
      cueGeneration: 'unavailable', consumedSignals: [], perceivedCues: [] });
    expect(value.receipt.perceived.knownContext).toBeNull();
    expect(frame.prePitchRunner!.canonical.position).toEqual({ x: 10, z: 5 });
    expect(value).not.toHaveProperty('position'); expect(value).not.toHaveProperty('currentBase');
  } finally { x.close(); }
});

it('samples the runner as observer with the other ten identities and authenticates all fifty-five executed parts', () => {
  const x = runnerObservationFixture(state);
  try {
    const derive = requireOwnedRunnerObservation(observations, x.db), value = derive(x.source), fields = x.own.scope(x.field, x.field.source.sourceId);
    const prefix = ownedRunnerFieldPiecesPhysicalPrefix(fields), frame = x.field.response.touch.worldContact.flight.physicalPitch.frame;
    expect(value.version).toBe('owned_runner_field_observation_v1'); expect(value.playerId).toBe('runner'); expect(value.personId).toBe('runner-person');
    expect(value.prePitchRunnerSourceId).toBe(x.runner.source.sourceId); expect(value.motionRevision).toBe(x.runner.source.motionRevision);
    expect(value.dependencyHashes).toEqual({ field: hash(x.field), physicalPrefix: hash(prefix),
      physicalPitch: hash(x.field.response.touch.worldContact.flight.physicalPitch), model: hash(x.observationModel) });
    expect(value.receipt.perceived.observerId).toBe('runner'); expect(value.receipt.at).toEqual(prefix.at);
    expect(prefix.segments.every(segment => segment.actors.length === 55)).toBe(true);
    expect(value.receipt.results.map(result => result.target)).toEqual([{ kind: 'ball' },
      ...[frame.batterActor!.binding.playerId, ...frame.world.defenders.map(actor => actor.playerId)].sort().map(playerId => ({ kind: 'player', playerId }))]);
    expect(value.receipt.results.find(result => result.target.kind === 'ball')!.status).toBe('detected');
    expect(value.receipt.samples.ball).not.toBeNull();
    expect(value.receipt.perceived.players.every(player => player.playerId !== 'runner')).toBe(true);
    expect(frame.prePitchRunner).toEqual(x.runner);
  } finally { x.close(); }
});

it('retains the actual fractional collision cut instead of evaluating the rounded event tick', () => {
  const x = runnerObservationFixture(state, { collision: true });
  try {
    const derive = requireOwnedRunnerObservation(observations, x.db), value = derive(x.source), at = x.field.field.motion.world.moment;
    expect(x.field.field.motion.response.kind).toBe('rebound');
    expect(value.receipt.at).toEqual({ originTick: at.originTick, elapsedSeconds: at.elapsedSeconds, tick: at.ball.tick });
    expect(at.elapsedSeconds).toBeLessThan((at.ball.tick - at.originTick) / 1_000_000);
    expect(value.receipt.samples.ball!.at).toEqual(value.receipt.at);
    expect(value.knowledge.knownContext).toBeNull(); expect(value).not.toHaveProperty('motionIntent');
  } finally { x.close(); }
});

it('keeps a real zero-time unresolved contact physically unavailable without inventing ball continuation', () => {
  const x = runnerObservationFixture(state, { zeroBag: true });
  try {
    const derive = requireOwnedRunnerObservation(observations, x.db), value = derive(x.source);
    expect(x.field.field.motion.cursor).toBeNull(); expect(value.receipt.at.elapsedSeconds).toBe(0);
    expect(value.receipt.results.find(result => result.target.kind === 'ball')).toEqual({ target: { kind: 'ball' }, status: 'physical_state_unavailable' });
    expect(value.receipt.samples.ball).toBeNull(); expect(value.receipt.perceived.ball).toBeNull();
    expect(value.knowledge.force).toBe('unavailable'); expect(value.knowledge.tagUp).toBe('unavailable');
  } finally { x.close(); }
});

it('retains FOV nondetection without interpreting unseen motion as safe, hold or a force/tag-up fact', () => {
  const x = runnerObservationFixture(state, { reverseView: true });
  try {
    const derive = requireOwnedRunnerObservation(observations, x.db), value = derive(x.source);
    expect(value.receipt.results.find(result => result.target.kind === 'ball')!.status).toBe('not_detected');
    expect(value.receipt.samples.ball).toBeNull(); expect(value.receipt.perceived.ball).toBeNull();
    expect(value.knowledge).toMatchObject({ status: 'pending', knownContext: null, cueGeneration: 'unavailable', perceivedCues: [] });
    expect(value).not.toHaveProperty('decision'); expect(value).not.toHaveProperty('settlement');
  } finally { x.close(); }
});

it('uses the executed body center for the eye rather than substituting the runner root', () => {
  const x = runnerObservationFixture(state, { configureModel: source => ({ ...source,
    calibration: { ...source.calibration, geometryParameters: playerObservationCalibrationFixture().geometryParameters } }) });
  try {
    const derive = requireOwnedRunnerObservation(observations, x.db), fields = x.own.scope(x.field, x.field.source.sourceId);
    const self = actualPlayerKinematicsFromRunnerFieldPieces('runner', fields), at = x.field.field.motion.world.moment;
    const actor = x.field.field.motion.actors.find(actor => actor.playerId === 'runner' && actor.primitive.role === 'body')!;
    const body = projectedActorState(actor, at.originTick, at.elapsedSeconds), ball = x.field.field.motion.cursor!.moment.ball;
    expect(body.position.y).not.toBe(self.root.position.y);
    const view = { ...x.source.view, bodyRelativeEyeOffset: { x: 0, y: 0, z: 0 },
      forward: { x: ball.position.x - body.position.x, y: ball.position.y - body.position.y, z: ball.position.z - body.position.z } };
    const value = derive({ ...x.source, view }), c = x.observationModel.source.calibration;
    const occluders = x.field.field.motion.actors.filter(actor => actor.playerId !== 'runner').map(actor => ({
      center: projectedActorState(actor, at.originTick, at.elapsedSeconds).position, radiusMeters: actor.primitive.radius }));
    const quality = (position: typeof body.position) => composeObservationQuality({
      ...evaluateObservationGeometry({ position, velocity: body.velocity, forward: view.forward }, ball, c.geometryParameters),
      occlusionVisibility: estimateOcclusionVisibility(position, ball.position, occluders), attentionQuality: 1, observationDurationSeconds: 0,
      perceptionAbility: c.perceptionAbility }, c.qualityParameters).totalQuality;
    expect(value.receipt.samples.ball!.sample.confidence).toBeCloseTo(quality(body.position), 12);
    expect(quality(self.root.position)).toBeLessThan(quality(body.position));
    expect(value.receipt.viewGeometry.eyeAnchor).toBe('body_primitive_center');
  } finally { x.close(); }
});

it('repeats deterministically without persisting an observation, signal consumption or new controller', () => {
  const x = runnerObservationFixture(state);
  try {
    const derive = requireOwnedRunnerObservation(observations, x.db);
    const snapshot = () => ({ schema: x.db.prepare('SELECT name,type,sql FROM sqlite_master ORDER BY name').all(),
      fields: x.db.prepare('SELECT * FROM batted_world_field_actions ORDER BY revision').all(),
      observations: x.db.prepare('SELECT * FROM actual_field_observations').all(), heads: x.db.prepare('SELECT * FROM actual_field_observation_heads').all(),
      models: x.db.prepare('SELECT * FROM world_player_observation_models').all(), participants: x.db.prepare('SELECT * FROM official_participant_bindings ORDER BY player_id').all() });
    const before = snapshot(), value = derive(x.source);
    expect(derive(x.source)).toEqual(value); expect(snapshot()).toEqual(before);
    for (const field of ['decisionInput', 'decision', 'motionIntent', 'activeCommand', 'controlWindows', 'playEnd', 'ruleResult']) expect(value).not.toHaveProperty(field);
    expect(value.knowledge.consumedSignals).toEqual([]); expect(value.knowledge.perceivedCues).toEqual([]);
  } finally { x.close(); }
});
