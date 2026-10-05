import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from '../../core/sim/ball/BallFlight';
import { classifyPointBeyondFirstThirdBaseGates } from '../../core/sim/ball/FairFoulBaseGateGeometry';
import { deriveBallWorldFieldTerritory } from '../../core/rules/BallWorldFieldTerritory';
import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { nativeSettledFoulInputArchiveBytes, nativeSettledFoulPhysicalFixture } from './NativeSettledFoulPhysicalFixtures.test-support';

it('executes an untouched foul rolling stop from accepted original pitch inputs and preserves every original archive', () => {
  const directory = mkdtempSync(join(tmpdir(), 'native-settled-foul-')), path = join(directory, 'world.sqlite');
  let fixture: ReturnType<typeof nativeSettledFoulPhysicalFixture> | undefined, originalsClosed = false;
  let reopened: import('node:sqlite').DatabaseSync | undefined;
  try {
    const x = fixture = nativeSettledFoulPhysicalFixture(path);
    const world = x.response.touch.worldContact, flight = world.flight, pitch = flight.physicalPitch;
    expect(pitch.frame.match.ruleProfileId).toBe(NPB_2026_RULE_PROFILE.id);
    expect(pitch.source.request.delivery.physics.velocity).toEqual(x.originalPitchPhysics.velocity);
    expect(x.pitches.readAcceptedPitch(pitch.source.sourceId)?.source).toEqual(pitch.source);
    expect(flight.source.searchDurationTicks).toBe(0);
    expect(world.result.kind).toBe('airborne');
    expect(x.response.result.kind).toBe('airborne');
    expect(world.model.surfaces).toEqual([]);
    expect(flight.source.execution.ballFlightParameters).toEqual(DEFAULT_BALL_FLIGHT_PARAMETERS);
    expect(x.baseGeometry.geometry.field).toEqual(flight.source.execution.field);
    expect(x.geometry.geometry.baseGeometry).toEqual(x.baseGeometry.geometry);
    expect(x.geometry.source).toEqual(x.geometrySource);
    expect(x.physical.field.evidence.acquisitions).toEqual([]);
    expect(x.physical.field.baseContacts).toEqual([]);
    expect(x.physical.controlWindows).toEqual([]);

    const contacts = x.physical.field.evidence.contacts, stop = contacts.at(-1)!;
    const territory = deriveBallWorldFieldTerritory(x.physical.field), batterAction = pitch.source.request.batter.action;
    console.info('NATIVE_SETTLED_FOUL_PHYSICAL_DIAGNOSTIC', JSON.stringify({
      physicalPitchSourceId: pitch.source.sourceId, ruleProfileId: pitch.frame.match.ruleProfileId,
      requestedVelocity: pitch.source.request.delivery.physics.velocity,
      deliveredPitchStart: pitch.result.pitch.trajectory.start,
      bat: batterAction.kind === 'swing' ? batterAction.swing : batterAction,
      actualContact: flight.flight.contact, actualLaunch: flight.flight.initialBall,
      contacts: contacts.map(frame => ({ elapsedSeconds: frame.moment.elapsedSeconds,
        tick: frame.moment.ball.tick, kinds: frame.contacts.map(contact => contact.kind) })),
      actualStop: stop.moment, territory,
    }));
    expect(contacts.length).toBeGreaterThan(1);
    expect(contacts.slice(0, -1).every(frame => frame.contacts.length === 1 && frame.contacts[0].kind === 'ground')).toBe(true);
    expect(stop.contacts).toEqual([{ kind: 'rolling_stop' }]);
    expect(stop.moment.elapsedSeconds).toBeGreaterThan(contacts[0].moment.elapsedSeconds);
    expect(stop.moment.ball.velocity).toEqual({ x: 0, y: 0, z: 0 });
    expect(stop.moment.ball.position.y).toBe(flight.source.execution.ballFlightParameters.ballRadius);
    expect(classifyPointBeyondFirstThirdBaseGates(x.physical.field.evidence.bases, stop.moment.ball.position))
      .toEqual({ firstBase: false, thirdBase: false });
    expect(territory)
      .toEqual({ kind: 'resolved', territory: 'foul', basis: 'settling', moment: stop.moment });
    expect(x.fields.interpret(x.last.source.sourceId)?.territory)
      .toEqual({ kind: 'resolved', territory: 'foul', basis: 'settling', moment: stop.moment });

    const rawStop = x.last.field.motion.world;
    expect(rawStop).toMatchObject({ kind: 'boundary', contacts: [{ kind: 'rolling_stop', moment: stop.moment }] });
    expect(rawStop.moment).toEqual(stop.moment);
    expect(x.last.revision).toBe(x.prefix.fields.length);
    expect(x.prefix.fields.map(value => value.revision)).toEqual(x.prefix.fields.map((_, index) => index + 1));
    for (const [index, value] of x.prefix.fields.entries()) {
      expect(value.source.previousFieldSourceId).toBe(x.prefix.fields[index - 1]?.source.sourceId ?? null);
      expect(value.source.geometrySourceId).toBe(x.geometrySource.sourceId);
      expect(value.geometry).toEqual(x.geometry);
      expect(value.response).toEqual(x.response);
    }

    const headsBefore = JSON.stringify(x.f.db.prepare('SELECT * FROM batted_world_field_heads').all());
    const rowsBefore = JSON.stringify(x.f.db.prepare('SELECT * FROM batted_world_field_actions ORDER BY revision').all());
    expect(x.fields.read(x.last.source.sourceId)).toEqual(x.last);
    expect(x.fields.accept(x.last.source.sourceId)).toEqual(x.last);
    const own = battedWorldFieldEvidenceFromSqlite(x.f.db), accepted = own.read(x.last.source.sourceId)!;
    expect(battedWorldFieldPhysicalPrefix({ baseField: accepted,
      fields: own.scope(accepted, accepted.source.sourceId), executions: [] })).toEqual(x.physical);
    expect(JSON.stringify(x.f.db.prepare('SELECT * FROM batted_world_field_heads').all())).toBe(headsBefore);
    expect(JSON.stringify(x.f.db.prepare('SELECT * FROM batted_world_field_actions ORDER BY revision').all())).toBe(rowsBefore);
    expect(x.inputArchiveBytes()).toBe(x.originalInputArchiveBytes);
    expect(JSON.stringify(x.f.official.getMatch('game-1'))).toBe(x.originalMatchBytes);
    for (const table of ['actual_first_base_play_ends', 'actual_live_play_fences', 'batted_venue_legal_policies']) {
      const exists = x.f.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
      expect(exists).toBeUndefined();
    }

    const sourceId = x.last.source.sourceId, expectedFinalBytes = JSON.stringify(x.last);
    const expectedPrefixBytes = JSON.stringify(x.physical), expectedOriginalBytes = x.originalInputArchiveBytes;
    const expectedFieldPrefixBytes = JSON.stringify(x.prefix.fields);
    x.f.close();
    originalsClosed = true;
    expect(() => x.f.db.prepare('SELECT 1').get()).toThrow();
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
    reopened = new DatabaseSync(path, { readOnly: true });
    reopened.exec('BEGIN');
    const freshOwner = battedWorldFieldEvidenceFromSqlite(reopened), freshFinal = freshOwner.read(sourceId);
    expect(freshFinal).not.toBeNull();
    if (!freshFinal) throw new Error('closed original foul archive is missing its final field Source');
    const freshFields = freshOwner.scope(freshFinal, sourceId);
    expect(JSON.stringify(freshFinal)).toBe(expectedFinalBytes);
    expect(JSON.stringify(freshFields)).toBe(expectedFieldPrefixBytes);
    expect(JSON.stringify(battedWorldFieldPhysicalPrefix({ baseField: freshFinal, fields: freshFields, executions: [] })))
      .toBe(expectedPrefixBytes);
    expect(nativeSettledFoulInputArchiveBytes(reopened)).toBe(expectedOriginalBytes);
    expect(JSON.stringify(reopened.prepare('SELECT * FROM batted_world_field_heads').all())).toBe(headsBefore);
    expect(JSON.stringify(reopened.prepare('SELECT * FROM batted_world_field_actions ORDER BY revision').all())).toBe(rowsBefore);
    reopened.exec('COMMIT');
  } finally {
    reopened?.close();
    if (fixture && !originalsClosed) fixture.f.close();
    rmSync(directory, { recursive: true, force: true });
  }
}, 60_000);
