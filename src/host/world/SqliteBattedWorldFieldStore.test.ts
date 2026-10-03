import { expect, it } from 'vitest';
import { battedWorldFieldFixture as fixture } from './BattedWorldFieldFixtures.test-support';
import { battedWorldBaseSurfaceId } from '../../core/sim/ball/BattedWorldFieldMotion';
import { openSqliteBattedWorldMotionStore, type AcceptedBattedWorldMotion } from './SqliteBattedWorldMotionStore';
import type { SqliteBattedWorldFieldStore } from './SqliteBattedWorldFieldStore';

it('interprets only its adopted field prefix and preserves the original territory after later motion', () => {
  const x = fixture();
  try {
    const fields = x.fields as SqliteBattedWorldFieldStore & { interpret(sourceId: string): unknown };
    expect(fields.interpret('missing')).toBeNull();
    const first = fields.accept(x.source.sourceId), original = JSON.stringify(first.response);
    const observed = fields.interpret(first.source.sourceId);
    expect(observed).toMatchObject({ fieldSourceId: first.source.sourceId, geometrySourceId: x.geometrySource.sourceId,
      physicalPitchSourceId: first.response.touch.worldContact.flight.source.physicalPitchSourceId,
      horizon: first.field.motion.world.moment,
      territory: { kind: 'resolved', territory: 'fair', basis: 'base_contact', baseId: 'third' } });
    expect(observed).not.toHaveProperty('playEnd');
    expect(observed).not.toHaveProperty('officialClosure');
    const next = { ...x.source, sourceId: 'field-motion-2', previousFieldSourceId: first.source.sourceId,
      throughTick: first.field.motion.world.moment.ball.tick + 1000 };
    x.sources.set(next.sourceId, next);
    const second = fields.accept(next.sourceId);
    expect(fields.interpret(second.source.sourceId)).toMatchObject({ horizon: second.field.motion.world.moment,
      territory: { kind: 'resolved', territory: 'fair' } });
    expect(fields.interpret(first.source.sourceId)).toEqual(observed);
    x.f.db.prepare("UPDATE batted_world_field_actions SET source_json='invalid future payload' WHERE source_id=?").run(next.sourceId);
    expect(fields.interpret(first.source.sourceId)).toEqual(observed);
    expect(() => fields.interpret(second.source.sourceId)).toThrow();
    expect(JSON.stringify(x.responses.read(first.response.source.sourceId))).toBe(original);
  } finally { x.f.close(); }
});
it('connects adopted ground/rolling motion to territory without a forecast stop or future official closure', () => {
  const x = fixture(undefined, true, false);
  try {
    const first = x.fields.accept(x.source.sourceId);
    expect(first.field.motion.world).toMatchObject({ kind: 'boundary', contacts: [{ kind: 'ground' }] });
    expect(first.field.baseContacts).toEqual([]);
    expect(x.fields.interpret(first.source.sourceId)?.territory).toMatchObject({ kind: 'unresolved', reason: 'fair_foul_pending' });
    let second = first;
    for (let step = 0; step < 32; step++) {
      const source = { ...x.source, sourceId: `field-ground-motion-${step}`, previousFieldSourceId: second.source.sourceId,
        throughTick: first.field.motion.world.moment.ball.tick + 100_000_000 };
      x.sources.set(source.sourceId, source);
      second = x.fields.accept(source.sourceId);
      if (second.field.motion.world.kind === 'boundary' && second.field.motion.world.contacts.some((c) => c.kind === 'rolling_stop')) break;
    }
    const observed = x.fields.interpret(second.source.sourceId);
    expect(second.field.motion.world).toMatchObject({ kind: 'boundary', contacts: [{ kind: 'rolling_stop' }] });
    expect(observed?.territory).toMatchObject({ kind: 'resolved', territory: 'fair', basis: 'settling' });
    expect(observed).not.toHaveProperty('playEnd');
    expect(observed).not.toHaveProperty('officialClosure');
    expect(x.fields.interpret(first.source.sourceId)?.territory.kind).toBe('unresolved');
    const stopped = observed;
    const restingSource = { ...x.source, sourceId: 'field-post-stop-resting', previousFieldSourceId: second.source.sourceId,
      throughTick: second.field.motion.world.moment.ball.tick + 1_000_000 };
    x.sources.set(restingSource.sourceId, restingSource);
    const resting = x.fields.accept(restingSource.sourceId);
    expect(resting.field.motion.world).toMatchObject({ kind: 'resting', phase: 'resting' });
    expect(x.fields.interpret(resting.source.sourceId)?.territory).toEqual(stopped?.territory);
    expect(x.fields.interpret(second.source.sourceId)).toEqual(stopped);
  } finally { x.f.close(); }
});
it('observes the actual post-ground gate crossing from original field calibration before the rolling stop', () => {
  const x = fixture(undefined, true, false, 0.1);
  try {
    let value = x.fields.accept(x.source.sourceId);
    const original = value;
    expect(x.fields.interpret(value.source.sourceId)?.territory.kind).toBe('unresolved');
    for (let step = 0; step < 12; step++) {
      const source = { ...x.source, sourceId: `field-long-roll-${step}`, previousFieldSourceId: value.source.sourceId,
        throughTick: original.field.motion.world.moment.ball.tick + 100_000_000 };
      x.sources.set(source.sourceId, source);
      value = x.fields.accept(source.sourceId);
      if (x.fields.interpret(value.source.sourceId)?.territory.kind === 'resolved') break;
    }
    const observed = x.fields.interpret(value.source.sourceId);
    expect(observed?.territory).toMatchObject({ kind: 'resolved', territory: 'fair', basis: 'base_gate' });
    if (observed?.territory.kind !== 'resolved') throw new Error('actual original gate');
    expect(observed.territory.moment.elapsedSeconds).toBeLessThan(observed.horizon.elapsedSeconds);
    expect(x.fields.interpret(original.source.sourceId)?.territory.kind).toBe('unresolved');
    expect(x.fields.read(value.source.sourceId)?.response.touch.worldContact.flight.source.execution.ballFlightParameters.groundRollingDecelerationMps2).toBe(0.1);
  } finally { x.f.close(); }
});

it('adopts actual original bag contact before the old forecast ground and preserves original archives', () => {
  const x = fixture();
  try {
    const old = JSON.stringify(x.response), value = x.fields.accept(x.source.sourceId);
    expect(value.field.baseContacts).toMatchObject([{ baseId: 'third' }]);
    expect(value.field.motion.world).toMatchObject({ kind: 'boundary', contacts: [{ kind: 'surface', surfaceId: battedWorldBaseSurfaceId('third') }] });
    expect(value.field.motion.response.kind).toBe('rebound');
    expect(value.field.motion.world.moment.ball.tick).toBeLessThan(x.forecast.firstGroundContact!.tick);
    expect(x.response.result.kind).toBe('airborne');
    expect(x.response.touch.worldContact.flight.source.searchDurationTicks).toBe(0);
    expect(value.field.motion.carrierPlayerId).toBeNull();
    expect(JSON.stringify(x.responses.read(x.response.source.sourceId))).toBe(old);
    expect(x.fields.read(value.source.sourceId)).toEqual(value);
    expect(x.fields.accept(value.source.sourceId)).toEqual(value);
  } finally { x.f.close(); }
});
it('uses the previous adopted rebound for a later field action and never accepts caller afterWorld', () => {
  const x = fixture();
  try {
    const first = x.fields.accept(x.source.sourceId);
    if (!first.field.motion.cursor) throw new Error('actual bag rebound');
    const source = { ...x.source, sourceId: 'field-motion-2', previousFieldSourceId: x.source.sourceId,
      throughTick: first.field.motion.cursor.moment.ball.tick + 1000 };
    x.sources.set(source.sourceId, source);
    const second = x.fields.accept(source.sourceId);
    expect(second.revision).toBe(2);
    expect(second.field.motion.world.moment.elapsedSeconds).toBeGreaterThan(first.field.motion.world.moment.elapsedSeconds);
    expect(x.fields.read(first.source.sourceId)).toEqual(first);
  } finally { x.f.close(); }
});
it.each(['afterWorld', 'fairResult', 'captureTick', 'cursor', 'contacts'])('rejects %s physical/result injection without writing an action', (field) => {
  const x = fixture();
  try {
    x.sources.set(x.source.sourceId, { ...x.source, [field]: 'caller' });
    expect(() => x.fields.accept(x.source.sourceId)).toThrow();
    expect(x.f.db.prepare('SELECT count(*) AS n FROM batted_world_field_actions').get()).toEqual({ n: 0 });
  } finally { x.f.close(); }
});
it('prevents a new field owner from rewriting already executed old motion and prevents old motion over field action', () => {
  const x = fixture();
  try {
    x.fields.accept(x.source.sourceId);
    const responseTick = x.response.touch.worldContact.flight.flight.initialBall.tick;
    const source: AcceptedBattedWorldMotion = { sourceId: 'old-motion', sourceVersion: 'fixture-v1', responseSourceId: x.response.source.sourceId,
      continuationSourceId: null, acquisitionSourceId: null, previousMotionSourceId: null,
      availableAtTick: responseTick, throughTick: responseTick + 1000, commands: x.source.commands };
    const old = x.f.track(openSqliteBattedWorldMotionStore(x.f.path, x.responses, { readAcceptedMotion: (id) => id === source.sourceId ? source : null }));
    expect(() => old.accept(source.sourceId)).toThrow(/field|owner/);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM batted_world_motions').get()).toEqual({ n: 0 });
  } finally { x.f.close(); }
});
it('rejects an already advanced legacy flight/World prefix instead of restarting its physical past', () => {
  const x = fixture(undefined, false);
  try {
    expect(x.response.touch.worldContact.flight.source.searchDurationTicks).toBeGreaterThan(0);
    expect(() => x.fields.accept(x.source.sourceId)).toThrow(/unadvanced|original field/);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM batted_world_field_actions').get()).toEqual({ n: 0 });
  } finally { x.f.close(); }
});
