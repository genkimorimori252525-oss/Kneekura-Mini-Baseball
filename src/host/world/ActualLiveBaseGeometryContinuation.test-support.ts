import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { constants, copyFileSync, existsSync, readFileSync, readdirSync, readlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { SqliteOfficialParticipationStore } from './SqliteOfficialParticipationStore';
import { openSqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
import { openSqliteOfficialInitialWorldStore } from './SqliteOfficialInitialWorldStore';
import { openSqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';
import { openSqlitePlayerPitchTimingStore } from './SqlitePlayerPitchTimingStore';
import { openSqlitePlayerReleaseGeometryStore } from './SqlitePlayerReleaseGeometryStore';
import { openSqlitePitchFatiguePolicyStore } from './SqlitePitchFatiguePolicyStore';
import { openSqlitePhysicalPitchProgressStore, type AcceptedPhysicalPitchActionSource, type DurablePhysicalPitch } from './SqlitePhysicalPitchProgressStore';
import { readPhysicalPitchProgressFromSqlite } from './PhysicalPitchEvidenceFromSqlite';
import { readPhysicalPlateAppearanceActorFromSqlite, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { actualLivePlayReadinessFromSqlite } from './ActualLivePlayReadinessFromSqlite';
import { battedBallFlightEvidenceFromSqlite, openSqliteBattedBallFlightStore, type AcceptedBattedBallFlight, type DurableBattedBallFlight } from './SqliteBattedBallFlightStore';
import { battedWorldContactEvidenceFromSqlite } from './SqliteBattedWorldContactStore';
import { battedContactResponseEvidenceFromSqlite } from './SqliteBattedContactResponseStore';
import { battedWorldBaseGeometryEvidenceFromSqlite } from './SqliteBattedWorldBaseGeometryStore';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { resolveContinuousPlayerPitchAgainstBatterFromWorld } from './ContinuousPlayerPitchRuntime';
import { samplePitchTrajectorySegment } from '../../core/sim/pitching/PitchTrajectory';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
export const geometryFileHash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
type Pin = Readonly<{ path: string; sha256: string }>;
type GeometryInput = Readonly<{ schema: string; inputs: Record<'input' | 'receipt' | 'checkpoint' | 'terminal', Pin>;
  fixture: Readonly<{ gameId: string; playId: number; priorPitchSourceId: string; expectedProgressRevision: number;
    actorSourceId: string; batterPlayerId: string; activationApplicationId: string; closureSourceId: string;
    swingSourceId: string; flightSourceId: string; sourceVersion: string; readyAtUs: number;
    priorTimelineStatus: unknown; recipe: Readonly<{ ownerSha256: string }>; expectedBaseCenters: unknown }> }>;
export const geometryClosed = (path: string) => {
  for (const suffix of ['-wal', '-shm', '-journal']) assert(!existsSync(path + suffix), `database sidecar remains: ${suffix}`);
  assert.deepEqual(readdirSync('/proc/self/fd').flatMap(fd => {
    try { const target = readlinkSync(`/proc/self/fd/${fd}`); return [path, `${path}-wal`, `${path}-shm`].includes(target) ? [target] : []; }
    catch { return []; }
  }), [], 'SQLite handles remain open');
};
export const geometryRows = (db: InstanceType<typeof DatabaseSync>) => ({
  schema: db.prepare('SELECT rowid AS __schemaRowId,type,name,tbl_name,rootpage,sql FROM sqlite_master ORDER BY rowid').all().map(row => json(row)),
  tables: Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => {
    const table = String(row.name); assert(/^[a-z_]+$/.test(table));
    return [table, db.prepare(`SELECT rowid AS __rowid,* FROM ${table} ORDER BY rowid`).all().map(value => json(value))];
  })),
});
const frozenRowsPreserved = (before: ReturnType<typeof geometryRows>, after: ReturnType<typeof geometryRows>,
  swing: DurablePhysicalPitch, flight: DurableBattedBallFlight) => {
  const expected = structuredClone(before), tables = expected.tables;
  const append = (table: string, row: object) => {
    const next = Math.max(0, ...tables[table].map(value => Number(JSON.parse(value).__rowid))) + 1;
    tables[table].push(json({ __rowid: next, ...row }));
  };
  append('physical_pitch_progress_actions', { source_id: swing.source.sourceId, game_id: swing.frame.gameId,
    play_id: swing.frame.match.playId, progress_revision: swing.progressRevision, source_json: json(swing.source),
    source_hash: hash(swing.source), snapshot_json: json(swing), snapshot_hash: hash(swing) });
  let changedHeads = 0;
  tables.physical_pitch_progress_heads = tables.physical_pitch_progress_heads.map(bytes => {
    const row = JSON.parse(bytes);
    if (row.game_id !== swing.frame.gameId || row.play_id !== swing.frame.match.playId) return bytes;
    changedHeads++;
    assert.equal(row.revision, swing.progressRevision - 1);
    return json({ ...row, revision: swing.progressRevision, last_source_id: swing.source.sourceId });
  });
  assert.equal(changedHeads, 1);
  append('batted_ball_flights', { source_id: flight.source.sourceId, physical_pitch_source_id: swing.source.sourceId,
    game_id: swing.frame.gameId, play_id: swing.frame.match.playId, revision: flight.revision,
    previous_source_id: flight.source.previousFlightSourceId, source_json: json(flight.source), source_hash: hash(flight.source),
    snapshot_json: json(flight), snapshot_hash: hash(flight) });
  append('batted_ball_flight_heads', { physical_pitch_source_id: swing.source.sourceId, source_id: flight.source.sourceId, revision: flight.revision });
  // No play8 runtime exists or is registered here, so both writes add exactly zero
  // actual_live_play_admissions. All other rowids, values and schema stay exact.
  assert.deepEqual(after, expected, 'unexpected schema, row identity, owner/head or admission delta');
};

/** One explicit fixture append after an already-qualified TAKE. This helper never
 * rebuilds the prior six-phase chain or changes/tunes accepted physical inputs. */
export const prepareActualLiveBaseGeometryContinuation = (manifestPath: string, directory: string) => {
  const m = JSON.parse(readFileSync(manifestPath, 'utf8')) as GeometryInput;
  assert.equal(m.schema, 'actual_live_setup_geometry_input_v1');
  for (const pin of Object.values(m.inputs)) assert.equal(geometryFileHash(pin.path), pin.sha256);
  const receipt = JSON.parse(readFileSync(m.inputs.receipt.path, 'utf8'));
  const checkpoint = JSON.parse(readFileSync(m.inputs.checkpoint.path, 'utf8'));
  const terminal = JSON.parse(readFileSync(m.inputs.terminal.path, 'utf8'));
  assert.equal(receipt.phase, 'next'); assert.equal(receipt.result.destinationSha256, m.inputs.input.sha256);
  assert.equal(checkpoint.exitCode, 0); assert.equal(checkpoint.reaped, true); assert.deepEqual(checkpoint.remainingOwnedProcesses, []);
  assert.equal(checkpoint.sourceDependenciesControlsInputUnchanged, true); assert.equal(checkpoint.phaseVerified, true);
  assert.equal(terminal.freshContinuationVerified, true); assert.equal(terminal.reaped, true); assert.equal(terminal.failure, null);
  assert.deepEqual(terminal.remainingOwnedProcesses, []); assert.equal(terminal.originalConstructionProven, false);
  const f = m.fixture;
  assert.deepEqual([f.gameId, f.playId, f.expectedProgressRevision, f.readyAtUs], ['game-1', 8, 1, 23_971_936]);
  assert.deepEqual([f.priorPitchSourceId, f.actorSourceId, f.batterPlayerId, f.activationApplicationId, f.closureSourceId],
    ['fixture-next-actual-pitch', 'fixture-next-actual-batter', 'away-2', 'fixture-actual-live-application', 'fixture-actual-live-closure']);
  assert.equal(geometryFileHash(new URL('./BattedBallFlightFixtures.test-support.ts', import.meta.url).pathname), f.recipe.ownerSha256);
  geometryClosed(m.inputs.input.path);
  const path = join(directory, 'next-swing.sqlite'); assert(!existsSync(path));
  copyFileSync(m.inputs.input.path, path, constants.COPYFILE_EXCL); assert.equal(geometryFileHash(path), m.inputs.input.sha256);
  const resources: { close(): void }[] = [], track = <T extends { close(): void }>(resource: T): T => { resources.push(resource); return resource; };
  const drain = () => { while (resources.length) resources.pop()!.close(); };
  const progress = (message: string) => console.info(`actual-geometry: ${message}`);
  try {
    let db = track(new DatabaseSync(path)); const before = geometryRows(db);
    const authenticated = withSqliteReadTransaction(db, () => withBattedWorldPhysicalReadTraversal(db, () => {
      progress('reauthenticating the exact original actual-live closure and settled effects');
      const ready = actualLivePlayReadinessFromSqlite(db).readHistorical(f.closureSourceId);
      assert.equal(ready.kind, 'ready'); if (ready.kind !== 'ready') throw new Error('historical actual readiness is pending');
      const actor = readPhysicalPlateAppearanceActorFromSqlite(db, f.actorSourceId); assert(actor);
      assert.equal(actor.binding.playerId, f.batterPlayerId); assert.deepEqual(actor.origin.actualLiveReadiness, ready.reference);
      const history = readPhysicalPitchProgressFromSqlite(db, f.gameId, f.playId); assert.equal(history.length, 1);
      const prior = history[0]; assert.equal(prior.source.sourceId, f.priorPitchSourceId);
      assert.equal(prior.source.request.batter.action.kind, 'take'); assert.equal(prior.progressRevision, 1);
      assert.deepEqual(prior.result.pitch.resolution.timeline.status, f.priorTimelineStatus);
      assert.equal(prior.result.pitch.resolution.timeline.lastEventTick, f.readyAtUs);
      assert.equal(prior.result.pitch.resolution.timeline.events.filter(event => event.kind === 'BatBallContact').length, 0);
      const original = battedBallFlightEvidenceFromSqlite(db).read('flight-1'); assert(original);
      const bases = battedWorldBaseGeometryEvidenceFromSqlite(db).read('field-original-base-geometry'); assert(bases);
      const model = battedWorldContactEvidenceFromSqlite(db).readModel('world-model'); assert(model);
      const response = battedContactResponseEvidenceFromSqlite(db).readModel('response-model'); assert(response);
      for (const value of [model, response]) {
        assert.equal(value.actors.length, 18); assert(value.actors.some(a => a.playerId === f.batterPlayerId));
      }
      assert.equal(db.prepare('SELECT count(*) AS n FROM actual_live_play_runtimes WHERE play_id=?').get(f.playId)!.n, 0);
      assert.equal(db.prepare('SELECT count(*) AS n FROM official_scoring_applications').get()!.n, 0);
      return { ready, prior, original, model, response };
    }));
    progress('fresh Native reauthentication returned; preparing the predeclared fixture action');
    const { prior } = authenticated, frame = prior.frame, timeline = prior.result.pitch.resolution.timeline;
    const p = authenticated.ready.closure.proposal, first = p.actors[0].binding, game = p.seasonFixture.game;
    const openSources = () => {
      const links = track(openSqlitePlayerPersonLinkStore(path)), official = track(new SqliteOfficialStateStore(path));
      const participation = track(new SqliteOfficialParticipationStore(path, { readGame: gameId => gameId !== f.gameId ? null : {
        careerId: first.careerId, competitionEditionId: first.competitionEditionId, gameDay: first.gameDay,
        homeClubId: game.homeClubId, awayClubId: game.awayClubId, fixtureEventId: first.fixtureEventId }, readRoster: () => null,
        readPersonLink: (playerId, sourceId) => { const link = links.readLink(sourceId); return link?.playerId === playerId ? { sourceId, personId: link.personId } : null; } }));
      const initialWorlds = track(openSqliteOfficialInitialWorldStore(path, { matches: official, participation }));
      const workload = track(openSqlitePlayerWorkloadRecoveryStore(path, links)), timing = track(openSqlitePlayerPitchTimingStore(path, links));
      const release = track(openSqlitePlayerReleaseGeometryStore(path, links)), policies = track(openSqlitePitchFatiguePolicyStore(path));
      const runtime = { workload, timing, release, policies, effortPolicies: { readAcceptedPolicy: (id: string) => id === prior.source.effortPolicy.sourceId ? prior.source.effortPolicy : null } };
      return { matches: official, initialWorlds, participation, runtime };
    };
    let sources = openSources();
    const request = { ...prior.source.request, delivery: { ...prior.source.request.delivery, readyAtUs: timeline.lastEventTick } };
    const preview = resolveContinuousPlayerPitchAgainstBatterFromWorld(sources.runtime, { ...request, timeline,
      effortPolicySourceId: prior.source.effortPolicy.sourceId, delivery: { ...request.delivery, playId: f.playId, pitchIndex: 1 } });
    const startTick = preview.pitch.trajectory.start.tick + 590_000;
    const ball = samplePitchTrajectorySegment(preview.pitch.trajectory, startTick).position;
    const action: AcceptedPhysicalPitchActionSource = { ...prior.source, sourceId: f.swingSourceId, sourceVersion: f.sourceVersion,
      request: { ...request, batter: { action: { kind: 'swing', swing: { startTick, endTick: startTick + 10_000, ticksPerSecond: 1_000_000,
        stateAtStart: { pose: { grip: { ...ball, x: ball.x - 0.4 }, tip: { ...ball, x: ball.x + 0.4 } },
          linearVelocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 } } } } } } };
    assert.equal(action.request.workloadRevision, frame.workload.revision); assert(!('battingIntent' in action));
    writeFileSync(join(directory, 'accepted-fixture-action.json'), `${json({ kind: 'explicit_fixture_recipe_v1', action, actionHash: hash(action),
      recipeOwnerHash: f.recipe.ownerSha256, priorSourceHash: hash(prior.source), priorSnapshotHash: hash(prior),
      previewTrajectoryHash: hash(preview.pitch.trajectory), autonomousBattingInput: false })}\n`, { flag: 'wx' });
    let pitches = track(openSqlitePhysicalPitchProgressStore(path, sources, { readAcceptedAction: id => id === action.sourceId ? action : null }));
    progress('accepting one real SWING after the TAKE');
    const swing = pitches.accept(action.sourceId, 1), afterTimeline = swing.result.pitch.resolution.timeline;
    assert.equal(swing.progressRevision, 2); assert.equal(swing.frame.batterActor!.binding.playerId, f.batterPlayerId);
    assert.equal(afterTimeline.status.kind, 'batted_ball_pending', 'accepted recipe produced no contact; do not tune');
    const contacts = afterTimeline.events.slice(timeline.events.length).filter(event => event.kind === 'BatBallContact');
    assert.equal(contacts.length, 1, 'accepted fixture must append exactly one contact');
    assert.deepEqual(swing.beforeTimeline, timeline); assert.deepEqual(afterTimeline.events.slice(0, timeline.events.length), timeline.events);
    assert.deepEqual(swing.frame, prior.frame);
    const afterSwing = geometryRows(db); drain(); geometryClosed(path);
    db = track(new DatabaseSync(path)); sources = openSources();
    pitches = track(openSqlitePhysicalPitchProgressStore(path, sources));
    assert.deepEqual(pitches.accept(action.sourceId, 1), swing); assert.deepEqual(geometryRows(db), afterSwing);
    progress('all physical connections closed/reopened and zero-write retry returned');
    const flightSource: AcceptedBattedBallFlight = { ...authenticated.original.source, sourceId: f.flightSourceId,
      sourceVersion: f.sourceVersion, physicalPitchSourceId: action.sourceId, previousFlightSourceId: null, searchDurationTicks: 0 };
    const flights = track(openSqliteBattedBallFlightStore(path, pitches, { readAcceptedFlight: id => id === flightSource.sourceId ? flightSource : null }));
    const flight = flights.accept(flightSource.sourceId); assert.deepEqual(flight.physicalPitch, swing);
    assert.equal(flight.source.searchDurationTicks, 0); assert.equal(flight.source.previousFlightSourceId, null);
    assert.deepEqual(flight.source.execution, authenticated.original.source.execution);
    frozenRowsPreserved(before, geometryRows(db), swing, flight);
    const receipt = { schema: 'actual_live_setup_geometry_prerequisites_v1', inputManifestSha256: geometryFileHash(manifestPath),
      inputSha256: m.inputs.input.sha256, destinationPath: path, actionHash: hash(action), swingHash: hash(swing), flightHash: hash(flight),
      closureReference: authenticated.ready.reference, modelHash: hash(authenticated.model), responseModelHash: hash(authenticated.response),
      contact: { sequence: contacts[0].sequence, tick: contacts[0].tick }, priorRowsHash: hash(before), afterRowsHash: hash(geometryRows(db)),
      priorRowsPreserved: true, schemaPreserved: true, rowidsPreserved: true, priorTakePrefixPreserved: true,
      exactOwnerDeltas: { physical_pitch_progress_actions: 1, physical_pitch_progress_heads: 'one exact existing play8 head update',
        batted_ball_flights: 1, batted_ball_flight_heads: 1, actual_live_play_admissions: 0 }, fixtureActionIsAutonomous: false, originalConstructionProven: false };
    drain(); geometryClosed(path);
    const reopened = new DatabaseSync(path, { readOnly: true });
    try {
      withSqliteReadTransaction(reopened, () => {
        assert.deepEqual(battedBallFlightEvidenceFromSqlite(reopened).read(flightSource.sourceId), flight);
        frozenRowsPreserved(before, geometryRows(reopened), swing, flight);
      });
    } finally { reopened.close(); }
    geometryClosed(path); assert.equal(geometryFileHash(m.inputs.input.path), m.inputs.input.sha256);
    writeFileSync(join(directory, 'geometry-prerequisites.json'), `${json({ ...receipt, destinationSha256: geometryFileHash(path),
      allConnectionsClosedReopened: true, sourceUnchanged: true })}\n`, { flag: 'wx' });
    progress('genuine new contact and zero-horizon flight closed/reopened; ready for geometry routing assertion');
    return { path, flight, expectedBaseCenters: f.expectedBaseCenters, manifest: m };
  } finally {
    drain(); assert.equal(geometryFileHash(m.inputs.input.path), m.inputs.input.sha256);
  }
};
