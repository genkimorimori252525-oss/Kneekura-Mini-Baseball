import { expect, it, vi } from 'vitest';
import { deriveInitialBattedWorldFieldMotion } from '../../core/sim/ball/BattedWorldFieldMotion';
import { deriveRunnerPieces, runnerFieldPiecesFixture } from './OwnedRunnerFieldPiecesContracts.test-support';
import { projectedActorState } from './PrePitchRunnerFieldPiecesContracts.test-support';
const state = vi.hoisted(() => ({ flight: null as any, response: null as any, bases: null as any }));
vi.mock('./SqliteBattedBallFlightStore', () => ({ battedBallFlightEvidenceFromSqlite: () => ({ read: () => state.flight }) }));
vi.mock('./SqliteBattedContactResponseStore', () => ({ battedContactResponseEvidenceFromSqlite: () => ({ read: () => state.response }) }));
vi.mock('./SqliteBattedWorldBaseGeometryStore', () => ({ battedWorldBaseGeometryEvidenceFromSqlite: () => ({ read: () => state.bases }) }));

it('records every actual runner piece and all fifty-five parts without reissuing ten-player commands', () => {
  const x = runnerFieldPiecesFixture(state);
  try {
    const value = deriveRunnerPieces(x.own, { ...x.source, throughTick: x.source.availableAtTick + 300_000 }), pieces = value.pieceExecution.pieces;
    const boundary = x.runner.controller.trajectory.segments[0].endElapsedSeconds - 2;
    expect(pieces.map(piece => [piece.ordinal, piece.controllerSegmentIndex, piece.startMoment.elapsedSeconds, piece.throughElapsedSeconds]))
      .toEqual([[0, 0, 0, boundary], [1, 1, boundary, 0.3]]);
    expect(pieces.map(piece => piece.coverageThroughElapsedSeconds)).toEqual([boundary, 0.3]);
    expect(pieces.every(piece => piece.field.motion.actors.length === 55 && new Set(piece.field.motion.actors.map(actor => actor.playerId)).size === 11)).toBe(true);
    expect(pieces[1].field.motion.actors.filter(actor => actor.playerId !== 'runner')).toEqual(pieces[0].field.motion.actors.filter(actor => actor.playerId !== 'runner'));
    expect(value.field).toEqual(pieces.at(-1)!.field); expect(value.source.commands).toHaveLength(10);
    expect(value.source.commands.some(command => command.playerId === 'runner')).toBe(false);
    expect(value.response.touch.worldContact.flight.physicalPitch.frame.prePitchRunner).toEqual(x.runner);
    expect(value).not.toHaveProperty('ruleResult'); expect(value).not.toHaveProperty('playEnd');
  } finally { x.db.close(); }
});

it('does not adopt a following phase when the requested endpoint is exactly the current phase end', () => {
  const x = runnerFieldPiecesFixture(state, { phase: 'integer' });
  try {
    const value = deriveRunnerPieces(x.own, { ...x.source, throughTick: x.source.availableAtTick + 125_000 });
    expect(value.field.motion.world).toMatchObject({ kind: 'moving', moment: { elapsedSeconds: 0.125 } });
    expect(value.pieceExecution.pieces).toHaveLength(1);
    expect(value.pieceExecution.pieces[0]).toMatchObject({ ordinal: 0, controllerSegmentIndex: 0, throughElapsedSeconds: 0.125 });
    expect(value.field.motion.actors.filter(actor => actor.playerId === 'runner').every(actor => actor.primitive.acceleration.x === 2)).toBe(true);
  } finally { x.db.close(); }
});

it.each(['reaction', 'braking'] as const)('executes retained %s pieces without issuing a replacement runner intent', phase => {
  const x = runnerFieldPiecesFixture(state, { phase });
  try {
    const value = deriveRunnerPieces(x.own, { ...x.source, throughTick: x.source.availableAtTick + 300_000 }), pieces = value.pieceExecution.pieces;
    expect(pieces.map(piece => piece.controllerSegmentIndex)).toEqual([0, 1]);
    expect(pieces.map(piece => piece.field.motion.actors.find(actor => actor.playerId === 'runner' && actor.primitive.role === 'body')!.primitive.acceleration.x))
      .toEqual(phase === 'reaction' ? [0, 2] : [-2, 0]);
    const body = value.field.motion.actors.find(actor => actor.playerId === 'runner' && actor.primitive.role === 'body')!;
    const actual = projectedActorState(body, x.source.availableAtTick, 0.3);
    expect(actual.position.x).toBeCloseTo(phase === 'reaction' ? 10.030625 : 14.515625, 11);
    expect(actual.velocity.x).toBeCloseTo(phase === 'reaction' ? 0.35 : 0, 11);
    const originalRunner = value.response.touch.worldContact.flight.physicalPitch.frame.prePitchRunner;
    if (!originalRunner) throw new Error('fixture requires the preserved original runner execution');
    expect(originalRunner.source).toEqual(x.runner.source);
  } finally { x.db.close(); }
});

it.each(['before', 'coincident', 'after'] as const)('stops on a real %s phase-boundary collision using only the pieces actually executed', collision => {
  const x = runnerFieldPiecesFixture(state, { phase: 'integer', collision });
  try {
    const value = deriveRunnerPieces(x.own, x.source), world = value.field.motion.world, pieces = value.pieceExecution.pieces;
    expect(world.kind).toBe('boundary');
    if (world.kind !== 'boundary') throw new Error('fixture requires a real runner collision');
    expect(world.contacts).toMatchObject([{ kind: 'actor', playerId: 'runner', role: 'body' }]);
    expect(pieces).toHaveLength(collision === 'after' ? 2 : 1);
    if (collision === 'before') expect(world.moment.elapsedSeconds).toBeLessThan(0.125);
    else if (collision === 'coincident') expect(world.moment.elapsedSeconds).toBe(0.125);
    else expect(world.moment.elapsedSeconds).toBeGreaterThan(0.125);
    expect(pieces.at(-1)!.throughElapsedSeconds).toBe(world.moment.elapsedSeconds);
    expect(pieces.at(-1)!.controllerSegmentIndex).toBe(collision === 'after' ? 1 : 0);
    expect(value.field.motion.actors.find(actor => actor.playerId === 'runner' && actor.primitive.role === 'body')!.primitive.acceleration.x)
      .toBe(collision === 'after' ? 0 : 2);
    const stationary = x.world.actors.map(actor => actor.playerId === 'runner' ? { ...actor,
      primitive: { ...actor.primitive, startVelocity: { x: 0, y: 0, z: 0 }, acceleration: { x: 0, y: 0, z: 0 } } } : actor);
    const counterfactual = deriveInitialBattedWorldFieldMotion({ response: { ...x.responseInput, world: { ...x.responseInput.world, actors: stationary } },
      geometry: x.geometry.geometry, availableAtTick: x.source.availableAtTick, throughTick: x.source.throughTick,
      commands: stationary.map(actor => ({ playerId: actor.playerId, role: actor.primitive.role, acceleration: { x: 0, y: 0, z: 0 } })) });
    expect(counterfactual.motion.world.kind).toBe('moving');
  } finally { x.db.close(); }
});

it('records a real zero-time bag boundary without skipping pending contact or adopting the later runner phase', () => {
  const x = runnerFieldPiecesFixture(state, { phase: 'integer', zeroBag: true });
  try {
    const value = deriveRunnerPieces(x.own, x.source);
    expect(value.field.motion.world).toMatchObject({ kind: 'boundary', moment: { elapsedSeconds: 0 } });
    expect(value.field.motion.response).toMatchObject({ kind: 'unresolved', reason: 'degenerate_normal', cursor: null });
    expect(value.pieceExecution.pieces).toHaveLength(1);
    expect(value.pieceExecution.pieces[0]).toMatchObject({ ordinal: 0, controllerSegmentIndex: 0, startMoment: { elapsedSeconds: 0 }, throughElapsedSeconds: 0 });
    expect(value.field.motion.actors.filter(actor => actor.playerId === 'runner').every(actor => actor.primitive.acceleration.x === 2)).toBe(true);
  } finally { x.db.close(); }
});

it('resumes a genuine fractional rebound through the remaining fraction of its rounded tick', () => {
  const x = runnerFieldPiecesFixture(state, { collision: 'after' });
  try {
    const first = deriveRunnerPieces(x.own, x.source), cursor = first.field.motion.cursor;
    expect(first.field.motion.response.kind).toBe('rebound');
    if (!cursor) throw new Error('fixture requires the actual rebound cursor');
    const rounded = (cursor.moment.ball.tick - cursor.moment.originTick) / 1_000_000;
    expect(cursor.moment.elapsedSeconds).toBeLessThan(rounded); x.archive(first);
    const second = deriveRunnerPieces(x.own, { ...x.source, sourceId: 'runner-pieces-after-rebound', previousFieldSourceId: first.source.sourceId,
      throughTick: cursor.moment.ball.tick });
    expect(second.pieceExecution.pieces[0].startMoment).toEqual(cursor.moment);
    expect(second.field.motion.world).toMatchObject({ kind: 'moving', moment: { elapsedSeconds: rounded, ball: { tick: cursor.moment.ball.tick } } });
    const actor = second.pieceExecution.pieces[0].field.motion.actors.find(actor => actor.playerId === 'runner' && actor.primitive.role === 'body')!;
    const prior = first.field.motion.actors.find(part => part.playerId === 'runner' && part.primitive.role === 'body')!;
    const actual = projectedActorState(actor, cursor.moment.originTick, cursor.moment.elapsedSeconds);
    const expected = projectedActorState(prior, cursor.moment.originTick, cursor.moment.elapsedSeconds), future = projectedActorState(prior, cursor.moment.originTick, rounded);
    expect(actual.position.x).toBeCloseTo(expected.position.x, 11); expect(actual.velocity.x).toBeCloseTo(expected.velocity.x, 11);
    expect(Math.abs(actual.position.x - future.position.x)).toBeGreaterThan(1e-10);
  } finally { x.db.close(); }
});

it.each(['pieces', 'controller', 'elapsed', 'result', 'runner_command', 'runner_source', 'coverage', 'predecessor'] as const)
('rejects caller %s after proving valid piece-source admission exists', kind => {
  const x = runnerFieldPiecesFixture(state);
  try {
    expect(deriveRunnerPieces(x.own, x.source).pieceExecution.pieces.length).toBeGreaterThan(0);
    const source = structuredClone(x.source) as any;
    if (kind === 'pieces') source.pieces = [];
    if (kind === 'controller') source.controller = x.runner.controller;
    if (kind === 'elapsed') source.throughElapsedSeconds = 0.6;
    if (kind === 'result') source.result = { kind: 'safe' };
    if (kind === 'runner_command') source.commands.push({ ...source.commands[0], playerId: 'runner' });
    if (kind === 'runner_source') source.prePitchRunnerSourceId = 'unowned';
    if (kind === 'coverage') source.throughTick = x.runner.source.coverageThroughTick + 1;
    if (kind === 'predecessor') source.previousFieldSourceId = 'unowned';
    expect(() => deriveRunnerPieces(x.own, source)).toThrow();
  } finally { x.db.close(); }
});

it.each(['kind', 'throughTick'] as const)('rejects a Source %s getter without executing it', field => {
  const x = runnerFieldPiecesFixture(state);
  try {
    expect(deriveRunnerPieces(x.own, x.source).pieceExecution.pieces.length).toBeGreaterThan(0);
    let called = false;
    const source = { ...x.source }; Object.defineProperty(source, field, { enumerable: true, get() { called = true; return x.source[field]; } });
    expect(() => deriveRunnerPieces(x.own, source)).toThrow(/accessor|inert/); expect(called).toBe(false);
  } finally { x.db.close(); }
});
