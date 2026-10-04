import { expect, it } from 'vitest';
import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { actualFirstBaseUmpireFixture } from './ActualFirstBaseUmpireFixtures.test-support';
import { openSqliteActualFirstBaseUmpireStore, actualFirstBaseUmpireEvidenceFromSqlite } from './SqliteActualFirstBaseUmpireStore';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { estimateOcclusionVisibility } from '../../core/sim/perception/Occlusion';
import { hasUnmodeledObservationSurface } from './ActualObservationSurfaceGuard';
import type { BallWorldMotionActor } from '../../core/sim/ball/BallWorldContinuation';

const sample = (actor: BallWorldMotionActor, originTick: number, at: number) => {
  const p = actor.primitive, dt = (originTick - p.startTick) / p.ticksPerSecond + at - (actor.startElapsedSeconds ?? 0);
  const position = { x: 0, y: 0, z: 0 };
  for (const axis of ['x', 'y', 'z'] as const) position[axis] = p.startCenter[axis] + p.startVelocity[axis] * dt + 0.5 * p.acceleration[axis] * dt * dt;
  return position;
};

it('requires the distinct cue-player body, first-base bag and controlling foot to participate in actual visibility', () => {
  const x = actualFirstBaseUmpireFixture();
  try {
    if (x.race.execution.kind !== 'first_base_race' || !x.race.execution.groundRule) throw new Error('actual race fixture');
    const rule = x.race.execution.groundRule, originTick = rule.actualChronology.runnerTouch!.originTick;
    const actors = x.moved.execution.field.motion.actors;
    const rayThroughOwnBody = (playerId: string, at: number) => {
      const foot = actors.find(value => value.playerId === playerId && value.primitive.role === 'left_foot')!;
      const body = actors.find(value => value.playerId === playerId && value.primitive.role === 'body')!;
      const target = sample(foot, originTick, at), center = sample(body, originTick, at);
      target.y += foot.primitive.radius;
      const position = { x: 2 * center.x - target.x, y: 2 * center.y - target.y, z: 2 * center.z - target.z };
      expect(estimateOcclusionVisibility(position, target, [{ center, radiusMeters: body.primitive.radius }])).toBe(0);
      return { position, forward: { x: target.x - position.x, y: target.y - position.y, z: target.z - position.z } };
    };
    const control = rule.actualChronology.firstDefenderControls[0], touch = rule.actualChronology.runnerTouch!;
    const first = x.geometry.geometry.baseGeometry.bases.first, center = first.region.center;
    const lowBagView = { position: { x: center.x + 2 * first.region.halfSize.x, y: 0.01, z: center.z }, forward: { x: -1, y: 0, z: 0 } };
    const runnerFoot = actors.find(value => value.playerId === x.batter.binding.playerId && value.primitive.role === 'left_foot')!;
    const footCue = sample(runnerFoot, originTick, touch.elapsedSeconds); footCue.y += runnerFoot.primitive.radius;
    expect(hasUnmodeledObservationSurface(lowBagView.position, footCue, [], [x.geometry.geometry.bases.first])).toBe(true);
    const runnerView = rayThroughOwnBody(x.batter.binding.playerId, touch.elapsedSeconds);
    const controlFoot = actors.find(value => value.playerId === control.playerId && value.primitive.role === 'left_foot')!;
    const controlFootCue = sample(controlFoot, originTick, control.elapsedSeconds); controlFootCue.y += controlFoot.primitive.radius;
    const runnerBody = actors.find(value => value.playerId === x.batter.binding.playerId && value.primitive.role === 'body')!;
    expect(estimateOcclusionVisibility(runnerView.position, controlFootCue,
      [{ center: sample(runnerBody, originTick, control.elapsedSeconds), radiusMeters: runnerBody.primitive.radius }])).toBe(0);
    const cases = [
      // This shared sightline hides both feet; the required control component is detected first.
      // It does not isolate the later touch cue, whose own-body intersection was asserted above.
      { name: 'runner-torso', view: runnerView, expected: { kind: 'undetectable', cue: 'control' } },
      { name: 'controlling-torso', view: rayThroughOwnBody(control.playerId, control.elapsedSeconds), expected: { kind: 'undetectable', cue: 'control' } },
      { name: 'first-base-bag', view: lowBagView,
        expected: { kind: 'pending', reason: 'surface_visibility_unavailable' } },
    ];
    const directory = mkdtempSync(join(tmpdir(), 'first-base-umpire-visibility-'));
    for (const test of cases) {
      const path = join(directory, `${test.name}.sqlite`);
      x.f.db.exec(`VACUUM INTO '${path.replaceAll("'", "''")}'`);
      const setup = { ...x.setup, pose: { ...x.setup.pose!, ...test.view } };
      const store = x.f.track(openSqliteActualFirstBaseUmpireStore(path, { ...x.authority, readAcceptedSetup: id => id === setup.sourceId ? setup : null }));
      store.acceptSetup(setup.sourceId);
      expect.soft(store.observe(x.observation.sourceId).perception, test.name).toEqual(test.expected);
    }
  } finally { x.f.close(); }
});

it('rejects a raw second operative call on a later valid physical cut without changing the original archive', () => {
  const x = actualFirstBaseUmpireFixture();
  try {
    x.umpires.acceptSetup(x.setup.sourceId); x.umpires.observe(x.observation.sourceId);
    const original = x.umpires.advanceCall(x.call.sourceId), archived = json(original);
    if (x.move.action.kind !== 'motion') throw new Error('synthetic physical motion');
    const next = { ...x.move, sourceId: 'raw-call-later-motion', previousExecutionSourceId: x.race.source.sourceId,
      action: { ...x.move.action, availableAtTick: original.advancedThrough.tick, throughTick: original.advancedThrough.tick + 1 } };
    x.sources.set(next.sourceId, next); x.executions.accept(next.sourceId);
    const source = { ...x.call, sourceId: 'raw-second-operative-call', currentExecutionSourceId: next.sourceId };
    const own = actualFirstBaseUmpireEvidenceFromSqlite(x.f.db), duplicate = own.derive('call', source);
    x.f.db.prepare('INSERT INTO actual_first_base_umpire_calls VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(source.sourceId, source.sourceVersion,
      original.observation.gameId, original.observation.physicalPitchSourceId, original.observation.setup.umpireId,
      original.observation.source.sourceId, next.sourceId, json(source), hash(source), json(duplicate), hash(duplicate));
    expect(() => x.umpires.readCall(x.call.sourceId)).toThrow(/operative|ownership|duplicate/);
    expect(x.f.db.prepare('SELECT snapshot_json FROM actual_first_base_umpire_calls WHERE source_id=?').get(x.call.sourceId))
      .toEqual({ snapshot_json: archived });
  } finally { x.f.close(); }
});
