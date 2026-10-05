import { expect, it } from 'vitest';
import { ownedRunnerFieldNativeFixture } from './OwnedRunnerFieldNativeFixtures.test-support';
import { openSqliteBattedWorldFieldStore } from './SqliteBattedWorldFieldStore';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

// One legal producer construction. Requires the coordinator's exclusive Native slot.
// RED target: tagged first-touch Source is currently rejected before field execution.
it('extends a prospectively owned legal-walk runner through actual field actions with rollback and durable reopen', () => {
  const x = ownedRunnerFieldNativeFixture(), { f } = x;
  try {
    expect(x.originalMatch.ruleProfileId).toBe('npb-2026');
    expect(x.physical.frame.match.ruleProfileId).toBe('npb-2026');
    expect(x.world.actors).toHaveLength(55);
    expect(x.world.result).toMatchObject({ kind: 'airborne', throughTick: x.at });
    x.touches.accept(x.touchSource.sourceId);
    const response = x.responses.accept(x.responseSource.sourceId);
    expect(response.result).toMatchObject({ kind: 'airborne', ball: x.flight.flight.initialBall });
    x.bases.accept(x.baseSource.sourceId); x.fields.acceptGeometry(x.geometrySource.sourceId);
    const first = x.fields.accept(x.source.sourceId);
    expect(first.field.motion.world).toMatchObject({ kind: 'moving' });
    expect(first.field.motion.world.moment.elapsedSeconds).toBeCloseTo(0.05, 11);
    const next = { ...x.source, sourceId: 'runner-field-2', previousFieldSourceId: first.source.sourceId, throughTick: x.throughTick };
    x.sources.set(next.sourceId, next);
    const binding = f.db.prepare('SELECT binding_json FROM official_participant_bindings WHERE game_id=? AND player_id=?').get('game-1', x.runner.playerId);
    const heads = f.db.prepare('SELECT * FROM batted_world_field_heads').all();
    f.db.exec(`CREATE TRIGGER tamper_owned_runner_field AFTER INSERT ON batted_world_field_actions WHEN NEW.source_id='runner-field-2' BEGIN
      UPDATE official_participant_bindings SET binding_json='{}' WHERE game_id='game-1' AND player_id='away-1'; END;`);
    expect(() => x.fields.accept(next.sourceId)).toThrow();
    expect(f.db.prepare('SELECT source_id FROM batted_world_field_actions ORDER BY revision').all()).toEqual([{ source_id: first.source.sourceId }]);
    expect(f.db.prepare('SELECT * FROM batted_world_field_heads').all()).toEqual(heads);
    expect(f.db.prepare('SELECT binding_json FROM official_participant_bindings WHERE game_id=? AND player_id=?').get('game-1', x.runner.playerId)).toEqual(binding);
    f.db.exec('DROP TRIGGER tamper_owned_runner_field');
    const second = x.fields.accept(next.sourceId), boundary = second.field.motion.world;
    expect(boundary.kind).toBe('boundary');
    if (boundary.kind !== 'boundary') throw new Error('fixture must reach the moving original runner');
    expect(boundary.contacts).toMatchObject([{ kind: 'actor', playerId: x.runner.playerId, role: 'body' }]);
    expect(boundary.moment.ball.tick).toBeGreaterThan(x.at); expect(boundary.moment.ball.tick).toBeLessThanOrEqual(x.hitTick);
    expect(second.field.motion.actors).toHaveLength(55); expect(new Set(second.field.motion.actors.map(a => a.playerId)).size).toBe(11);
    expect(second.source.commands).toHaveLength(10); expect(second.field.motion.carrierPlayerId).toBeNull();
    expect(() => x.fields.interpret(second.source.sourceId)).toThrow(/unsupported original pre-pitch runner consumer/);
    const stale = { ...next, sourceId: 'runner-field-stale' }; x.sources.set(stale.sourceId, stale);
    expect(() => x.fields.accept(stale.sourceId)).toThrow(/predecessor/);
    expect(f.official.getMatch('game-1')!.matchState).toEqual(x.originalMatch);
    expect(f.official.getMatch('game-1')!.durableRevision).toBe(x.actor.officialRevision);
    const reopened = f.track(openSqliteBattedWorldFieldStore(f.path, x.responses, x.bases));
    expect(reopened.read(first.source.sourceId)).toEqual(first);
    expect(reopened.read(second.source.sourceId)).toEqual(second);
    expect(reopened.accept(second.source.sourceId)).toEqual(second);
    const row = f.db.prepare('SELECT snapshot_json,snapshot_hash FROM physical_pitch_progress_actions WHERE source_id=?').get(x.action.sourceId)!;
    const corrupt = JSON.parse(row.snapshot_json as string); corrupt.frame.prePitchRunner.canonical.position.x += 1;
    f.db.prepare('UPDATE physical_pitch_progress_actions SET snapshot_json=?,snapshot_hash=? WHERE source_id=?').run(json(corrupt), hash(corrupt), x.action.sourceId);
    expect(() => reopened.read(first.source.sourceId)).toThrow();
    f.db.prepare('UPDATE physical_pitch_progress_actions SET snapshot_json=?,snapshot_hash=? WHERE source_id=?').run(row.snapshot_json, row.snapshot_hash, x.action.sourceId);
    expect(reopened.read(first.source.sourceId)).toEqual(first);
  } finally { f.close(); }
}, 180_000);
