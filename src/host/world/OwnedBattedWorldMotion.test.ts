import { expect, it } from 'vitest';
import { ownedBattedWorldMotionFixture as fixture } from './OwnedBattedWorldMotionFixtures.test-support';
import { openSqliteBattedWorldFieldExecutionStore } from './SqliteBattedWorldFieldExecutionStore';
import { actualPlayerKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { wholePlayPhysicalHistoryFromPrefix } from './WholePlayPhysicalHistoryFromPrefix';

it('opts in atomically with all ten actual retained commands without rebasing actors or renewing coverage', () => {
  const x = fixture();
  try {
    const archived = x.f.db.prepare('SELECT * FROM batted_world_field_actions').all();
    const source = x.retain(x.first.source.sourceId, x.at + 200); x.sources.set(source.sourceId, source);
    const saved = x.executions.accept(source.sourceId);
    expect(saved.execution.kind).toBe('owned_motion_v1');
    if (saved.execution.kind !== 'owned_motion_v1') throw new Error('owned adoption missing');
    expect(saved.execution.composition.mode).toBe('retained');
    expect(saved.execution.composition.contributors).toHaveLength(10);
    expect(saved.execution.field.motion.actors).toEqual(x.first.execution.field.motion.actors);
    expect(saved.execution.adoption.contributors.every(c => c.motorAdoptionEventId === null)).toBe(true);
    expect(saved.execution.adoption.executedThrough.elapsedSeconds).toBe(saved.execution.field.motion.world.moment.elapsedSeconds);
    const previousPrefix = x.prefix(x.first.source.sourceId), currentPrefix = x.prefix(saved.source.sourceId);
    for (const c of x.fieldSource.commands) {
      const previous = actualPlayerKinematicsFromPrefix(c.playerId, previousPrefix);
      const current = actualPlayerKinematicsFromPrefix(c.playerId, currentPrefix);
      expect(current.adoptions).toHaveLength(previous.adoptions.length);
      expect(current.activeCommand.sourceId).toBe(x.bootstrap.sourceId);
      expect(current.roles.every(p => p.canonicalActor.primitive.endTick === x.at + 2000)).toBe(true);
    }
    expect(wholePlayPhysicalHistoryFromPrefix(x.prefix(source.sourceId)).horizon).toEqual(saved.execution.field.motion.world.moment);
    expect(x.f.db.prepare('SELECT * FROM batted_world_field_actions').all()).toEqual(archived);
    expect(x.executions.accept(source.sourceId)).toEqual(saved);
    expect(x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields)).accept(source.sourceId)).toEqual(saved);
  } finally { x.f.close(); }
});

it('rejects incomplete, aliased, override and stale retained contributions without any physical row', () => {
  const x = fixture();
  try {
    const source = x.retain(x.first.source.sourceId, x.at + 200);
    if (source.action.kind !== 'owned_motion_v1') throw new Error('fixture');
    const action = source.action, rows = x.f.db.prepare('SELECT * FROM batted_world_field_executions').all();
    const first = action.contributions[0];
    if (first.kind !== 'retained') throw new Error('fixture');
    const variants = [
      { ...action, contributions: action.contributions.slice(1) },
      { ...action, contributions: [...action.contributions.slice(1), action.contributions[1]] },
      { ...action, contributions: action.contributions.map((c, i) => i ? c : { ...c, playerId: 'foreign' }) },
      { ...action, commands: x.fieldSource.commands },
      { ...action, contributions: action.contributions.map((c, i) => i ? c : { ...c, acceleration: { x: 0, y: 0, z: 0 } }) },
      { ...action, contributions: action.contributions.map((c, i) => i ? c : { ...first, command: { ...first.command, owner: 'batted_world_field_actions' } }) },
      { ...action, contributions: action.contributions.map((c, i) => i ? c : { ...first, command: { ...first.command, sourceHash: 'wrong' } }) },
      { ...action, contributions: action.contributions.map((c, i) => i ? c : { ...first, command: { ...first.command, acceptedThroughTick: x.at + 3000 } }) },
      { ...action, knownWork: action.knownWork.slice(1) },
      { ...action, knownWork: action.knownWork.map((w, i) => i ? w : { ...w, decisionSourceId: 'unknown' }) },
    ];
    for (const bad of variants) {
      x.sources.set(source.sourceId, { ...source, action: bad } as typeof source);
      expect(() => x.executions.accept(source.sourceId)).toThrow();
      expect(x.f.db.prepare('SELECT * FROM batted_world_field_executions').all()).toEqual(rows);
    }
    let accessed = false;
    x.sources.set(source.sourceId, { ...source, action: { ...action, get checkpointThroughTick() { accessed = true; return x.at + 200; } } });
    expect(() => x.executions.accept(source.sourceId)).toThrow(/accessor/); expect(accessed).toBe(false);
  } finally { x.f.close(); }
});

it('fences all fresh raw physical actions after opt-in while archived raw retries and observers remain readable', () => {
  const x = fixture();
  try {
    const source = x.retain(x.first.source.sourceId, x.at + 200); x.sources.set(source.sourceId, source);
    const saved = x.executions.accept(source.sourceId);
    for (const action of [x.source.action, x.bootstrap.action, { kind: 'retained_motion_checkpoint_v1' as const, checkpointThroughTick: x.at + 300 },
      { kind: 'acquisition' as const }, { kind: 'acquisition_plan' as const },
      { kind: 'throw_advance' as const, planSourceId: 'missing-plan', throughElapsedSeconds: 10 }]) {
      const raw = { ...source, sourceId: 'raw-bypass', previousExecutionSourceId: source.sourceId, action };
      x.sources.set(raw.sourceId, raw); expect(() => x.executions.accept(raw.sourceId)).toThrow(/owned.*guard|guard.*owned/);
    }
    expect(x.executions.accept(x.bootstrap.sourceId)).toEqual(x.first);
    const observer = { ...source, sourceId: 'owned-history-observer', previousExecutionSourceId: source.sourceId, action: { kind: 'whole_play_history' as const } };
    x.sources.set(observer.sourceId, observer); const observed = x.executions.accept(observer.sourceId);
    expect(observed.execution.field).toEqual(saved.execution.field);
    expect(x.executions.read(source.sourceId)).toEqual(saved);
  } finally { x.f.close(); }
});
