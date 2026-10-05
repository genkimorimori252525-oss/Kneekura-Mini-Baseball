import { expect, it } from 'vitest';
import { ownedRunnerFieldNativeFixture } from './OwnedRunnerFieldNativeFixtures.test-support';
import { openSqliteActualPlayerKinematicsReader, type ActualPlayerOwnedRunnerFieldCut } from './SqliteActualPlayerKinematicsReader';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** One real registered-profile chain, reused for read/reopen and upstream tamper checks. */
it('reads owned runner field kinematics through a real registered-profile chain without changing official state', () => {
  const x = ownedRunnerFieldNativeFixture(), { f } = x;
  try {
    x.touches.accept(x.touchSource.sourceId); x.responses.accept(x.responseSource.sourceId);
    x.bases.accept(x.baseSource.sourceId); x.fields.acceptGeometry(x.geometrySource.sourceId);
    const first = x.fields.accept(x.source.sourceId);
    const next = { ...x.source, sourceId: 'runner-field-kinematics-2', previousFieldSourceId: first.source.sourceId, throughTick: x.throughTick };
    x.sources.set(next.sourceId, next);
    const second = x.fields.accept(next.sourceId), moment = second.field.motion.world.moment;
    const cut: ActualPlayerOwnedRunnerFieldCut = { kind: 'owned_runner_field_v1', physicalPitchSourceId: x.action.sourceId,
      fieldSourceId: second.source.sourceId, playerId: x.runner.playerId };
    const snapshot = () => ({ schema: f.db.prepare('SELECT name,type,sql FROM sqlite_master ORDER BY name').all(),
      fields: f.db.prepare('SELECT source_id,source_hash,snapshot_hash FROM batted_world_field_actions ORDER BY revision').all(),
      heads: f.db.prepare('SELECT * FROM batted_world_field_heads').all(), match: f.official.getMatch('game-1') });
    const before = snapshot(), reader = f.track(openSqliteActualPlayerKinematicsReader(f.path));
    const value = reader.readOwnedRunnerField(cut);
    expect(x.originalMatch.ruleProfileId).toBe('npb-2026');
    expect(value.at).toEqual({ originTick: moment.originTick, elapsedSeconds: moment.elapsedSeconds, tick: moment.ball.tick });
    expect(value.at.tick).toBeLessThan(x.throughTick);
    expect(value.authority).toMatchObject({ owner: 'physical_pitch_progress_actions', sourceId: x.action.sourceId,
      runnerSourceId: x.runner.sourceId, runnerSourceHash: hash(x.runner), acceptedThroughTick: x.runner.coverageThroughTick, motionRevision: x.runner.motionRevision });
    expect(value.execution).toEqual({ owner: 'batted_world_field_actions', sourceId: second.source.sourceId, revision: 2,
      sourceHash: hash(second.source), snapshotHash: hash(second), executedThrough: value.at });
    expect(value.physicalPrefix.participants).toHaveLength(11);
    expect(value.physicalPrefix.segments).toHaveLength(3);
    expect(value.physicalPrefix.segments.every(segment => segment.actors.length === 55)).toBe(true);
    for (const role of value.roles) {
      const actor = role.canonicalActor, p = actor.primitive;
      const dt = (value.at.originTick - p.startTick) / value.ticksPerSecond + value.at.elapsedSeconds - (actor.startElapsedSeconds ?? 0);
      for (const axis of ['x', 'y', 'z'] as const) {
        expect(value.root.position[axis] + role.offset[axis]).toBeCloseTo(p.startCenter[axis] + p.startVelocity[axis] * dt + 0.5 * p.acceleration[axis] * dt * dt, 10);
        expect(value.root.velocity[axis] + role.relativeVelocity[axis]).toBeCloseTo(p.startVelocity[axis] + p.acceleration[axis] * dt, 10);
      }
    }
    const original = reader.readOriginalContact({ kind: 'owned_runner_contact_v1', physicalPitchSourceId: x.action.sourceId,
      worldContactSourceId: x.world.source.sourceId, playerId: x.runner.playerId });
    expect(original.at.elapsedSeconds).toBe(0); expect(original.origin).toEqual(value.origin);
    expect(() => reader.read({ physicalPitchSourceId: x.action.sourceId, playerId: x.runner.playerId,
      baseFieldSourceId: first.source.sourceId, executionSourceId: null, mode: 'original' })).toThrow(/unsupported original pre-pitch runner consumer/);
    expect(value).not.toHaveProperty('activeCommand'); expect(value.physicalPrefix).not.toHaveProperty('controlWindows');
    expect(snapshot()).toEqual(before);
    reader.close(); expect(() => reader.readOwnedRunnerField(cut)).toThrow(/closed/);
    const reopened = f.track(openSqliteActualPlayerKinematicsReader(f.path));
    expect(reopened.readOwnedRunnerField(cut)).toEqual(value);
    const row = f.db.prepare('SELECT snapshot_json,snapshot_hash FROM physical_pitch_progress_actions WHERE source_id=?').get(x.action.sourceId)!;
    const corrupt = JSON.parse(row.snapshot_json as string); corrupt.frame.prePitchRunner.canonical.position.x += 1;
    f.db.prepare('UPDATE physical_pitch_progress_actions SET snapshot_json=?,snapshot_hash=? WHERE source_id=?').run(json(corrupt), hash(corrupt), x.action.sourceId);
    expect(() => reopened.readOwnedRunnerField(cut)).toThrow();
    f.db.prepare('UPDATE physical_pitch_progress_actions SET snapshot_json=?,snapshot_hash=? WHERE source_id=?').run(row.snapshot_json, row.snapshot_hash, x.action.sourceId);
    expect(reopened.readOwnedRunnerField(cut)).toEqual(value); expect(snapshot()).toEqual(before);
    expect(f.official.getMatch('game-1')!.matchState).toEqual(x.originalMatch);
  } finally { f.close(); }
}, 180_000);
