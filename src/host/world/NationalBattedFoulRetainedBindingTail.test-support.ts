import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createBattedBallFlightEvidence } from '../../core/sim/ball/BattedBallFlightEvidence';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battedEpisodeFieldBindingEvidenceFromSqlite } from './SqliteBattedEpisodeFieldBindingStore';
import { battedContactResponseEvidenceFromSqlite } from './SqliteBattedContactResponseStore';
import { battedWorldBaseGeometryEvidenceFromSqlite } from './SqliteBattedWorldBaseGeometryStore';
import { openSqliteBattedWorldFieldStore, type AcceptedBattedWorldFieldAction } from './SqliteBattedWorldFieldStore';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { nationalBattedFieldFixtureSource } from './NationalBattedFieldFixtures.test-support';
import { assertNationalBattedFoulRetainedPitchFrontier } from './NationalBattedFoulRetainedTail.test-support';
import { continueNationalBattedFoulOriginalTailFromField, type NationalBattedFoulConsumerContext } from './NationalBattedFoulOriginalTail.test-support';
import { readNationalMatchOrigin, nationalFixtureGame } from './NationalMatchOriginFromSqlite';
import { openSqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
import { SqliteOfficialParticipationStore, type CompletedPlayParticipationReceipt } from './SqliteOfficialParticipationStore';
import { openSqliteManagerRosterDecisionStore } from './SqliteManagerRosterDecisionStore';
import { nationCompetitionRegionEvidenceFromSqlite } from './SqliteNationCompetitionRegionStore';
import { worldCompetitionCycleEvidenceFromSqlite } from './SqliteWorldCompetitionCycleStore';
import { nationalCompetitionSelectionEvidenceFromSqlite } from './SqliteNationalCompetitionSelectionStore';
import { openSqliteNationalEligibilityFactStore } from './SqliteNationalEligibilityFactStore';
import { openSqliteNationalRosterSnapshotStore } from './SqliteNationalRosterSnapshotStore';
import { openSqliteNationalCallupStore, type DurableNationalAppearance } from './SqliteNationalCallupStore';

type Db = import('node:sqlite').DatabaseSync;
/** A structural guard only. The real binding reader below authenticates every
 * archived input; these rows never substitute for its owned evidence. */
export const assertNationalBattedFoulRetainedBindingFrontier = (db: Pick<Db, 'prepare'>): string => {
  const row = db.prepare('SELECT game_id FROM batted_episode_field_bindings WHERE source_id=?').get('national-live:episode-binding'); assert(row);
  const gameId = String(row.game_id);
  assertNationalBattedFoulRetainedPitchFrontier(db, gameId);
  assert.equal(db.prepare('SELECT count(*) AS n FROM physical_pitch_progress_actions WHERE source_id=?').get('national-live:pitch-0')!.n, 1);
  const bindings = db.prepare(`SELECT source_id,binding_version,game_id,play_id,physical_pitch_source_id,response_source_id,field_calibration_source_id
    FROM batted_episode_field_bindings`).all().map(v => ({ ...v }));
  assert.deepEqual(bindings, [{ source_id: 'national-live:episode-binding', binding_version: 'batted_episode_field_binding_v3', game_id: gameId,
    play_id: 8, physical_pitch_source_id: 'national-live:pitch-0', response_source_id: 'national-live:response', field_calibration_source_id: 'national-foul:geometry' }]);
  for (const table of ['batted_world_field_actions', 'batted_world_field_heads', 'batted_world_field_executions'])
    assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table} WHERE physical_pitch_source_id=?`).get('national-live:pitch-0')!.n, 0);
  assert.equal(db.prepare("SELECT count(*) AS n FROM actual_live_play_runtimes WHERE (game_id=? AND play_id=8) OR source_id='live-play-runtime'").get(gameId)!.n, 0);
  const installed = (table: string) => !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
  if (installed('actual_live_play_closures')) assert.equal(db.prepare('SELECT count(*) AS n FROM actual_live_play_closures WHERE game_id=?').get(gameId)!.n, 0);
  if (installed('official_player_outcome_applications')) assert.equal(db.prepare('SELECT count(*) AS n FROM official_player_outcome_applications').get()!.n, 0);
  assert.deepEqual(db.prepare('SELECT source_id,status,play_id FROM actual_foul_terminal_applications WHERE game_id=?').all(gameId).map(v => ({ ...v })),
    [{ source_id: 'national-foul:terminal', status: 'POST_PLAY_COMPLETED_CONTINUING', play_id: 7 }]);
  assert.deepEqual(db.prepare('SELECT player_id FROM official_participation_receipts WHERE game_id=?').all(gameId).map(v => ({ ...v })), [{ player_id: 'p9' }]);
  assert.equal(db.prepare("SELECT count(*) AS n FROM world_national_callups WHERE event_id='national-live:appearance'").get()!.n, 0);
  return gameId;
};

/** Resume only the genuine common-model binding cut, before runtime/field work.
 * No pitch, flight, contact, response, binding or foul admission is retried.
 * This lineage has no foul statistics yet: every original attribution assertion
 * remains in the shared tail, including admission and reopened exact retry. */
export const continueRetainedNationalBattedFoulBindingTail = (path: string, progress: (phase: string) => void) => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(path), handles: { close(): void }[] = []; db.exec('PRAGMA query_only=ON');
  const track = <T extends { close(): void }>(store: T): T => { handles.push(store); return store; };
  let closed = false;
  const close = () => { if (closed) return; closed = true; const failures: unknown[] = [];
    while (handles.length) try { handles.pop()!.close(); } catch (error) { failures.push(error); }
    try { db.close(); } catch (error) { failures.push(error); }
    if (failures.length) throw new AggregateError(failures, 'retained National binding cleanup failed');
  };
  try {
    const { binding, origin } = withBattedVenueLegalReadSnapshot(db, () => {
      const gameId = assertNationalBattedFoulRetainedBindingFrontier(db);
      const binding = battedEpisodeFieldBindingEvidenceFromSqlite(db).read('national-live:episode-binding'); assert(binding);
      assert.equal(binding.gameId, gameId); assert.equal(binding.playId, 8);
      assert.deepEqual(binding.source, { sourceId: 'national-live:episode-binding', sourceVersion: 'fixture-v1', version: 'batted_episode_field_binding_v3',
        responseSourceId: 'national-live:response', fieldCalibrationSourceId: 'national-foul:geometry', physicalActorSourceId: 'national-live:batter',
        completedOrigin: { kind: 'foul_terminal_completion', sourceId: 'national-foul:terminal' } });
      const origin = readNationalMatchOrigin(db, gameId); assert(origin); return { binding, origin };
    });
    const response = binding.response, worldContact = response.touch.worldContact, flight = worldContact.flight, physical = flight.physicalPitch;
    const nextActor = physical.frame.batterActor; assert(nextActor);
    assert.equal(nextActor.source.sourceId, 'national-live:batter'); assert.equal(nextActor.binding.playerId, 'p10'); assert.equal(nextActor.match.playId, 8);
    assert.equal(physical.source.sourceId, 'national-live:pitch-0'); assert.equal(flight.source.sourceId, 'national-live:flight');
    assert.equal(worldContact.source.sourceId, 'national-live:world-contact'); assert.equal(response.touch.source.sourceId, 'national-live:touch');
    assert.equal(worldContact.model.sourceId, 'national-common:world-model'); assert.equal(response.model.sourceId, 'national-common:response-model');
    const predicted = createBattedBallFlightEvidence({ contact: flight.flight.contact, parameters: flight.source.execution.ballFlightParameters, searchDurationTicks: 2_000_000 });
    assert(predicted.firstGroundContact, 'explicit first-base fixture forecast has no ground contact');
    const forecastGroundElapsedSeconds = (predicted.firstGroundContact.tick - flight.flight.initialBall.tick) / flight.source.execution.ballFlightParameters.ticksPerSecond;
    const source = nationalBattedFieldFixtureSource({ label: 'national-live', responseSourceId: response.source.sourceId,
      geometrySourceId: binding.calibration.source.sourceId, initialBallTick: flight.flight.initialBall.tick, commands: worldContact.source.commands,
      episodeFieldBinding: { sourceId: binding.source.sourceId, version: binding.source.version } });
    const sources = new Map<string, AcceptedBattedWorldFieldAction>([[source.sourceId, source]]);
    const fields = track(openSqliteBattedWorldFieldStore(path, battedContactResponseEvidenceFromSqlite(db), battedWorldBaseGeometryEvidenceFromSqlite(db),
      { readAcceptedGeometry: () => null, readAcceptedAction: id => sources.get(id) ?? null }));
    const links = track(openSqlitePlayerPersonLinkStore(path));
    const participation = track(new SqliteOfficialParticipationStore(path, {
      readGame: gameId => { const saved = readNationalMatchOrigin(db, gameId); return saved ? nationalFixtureGame(saved.fixture) : null; },
      readRoster: () => null, readPersonLink: (playerId, sourceId) => { const link = links.readLink(sourceId); return link?.playerId === playerId ? link : null; },
    }));
    const roster = track(openSqliteManagerRosterDecisionStore(path));
    const nations = nationCompetitionRegionEvidenceFromSqlite(db);
    const selections = nationalCompetitionSelectionEvidenceFromSqlite(db, { cycle: worldCompetitionCycleEvidenceFromSqlite(db) });
    const facts = track(openSqliteNationalEligibilityFactStore(path, { nations, personLinks: links }));
    const rosterSnapshots = track(openSqliteNationalRosterSnapshotStore(path, { roster }));
    const callups = track(openSqliteNationalCallupStore(path, { nations, selections, personLinks: links, facts, rosterSnapshots, participation,
      games: { readGame: gameId => { const saved = readNationalMatchOrigin(db, gameId); return saved ? nationalFixtureGame(saved.fixture) : null; } } }));
    // Archived expected values only; original owner comparisons remain later in the tail.
    const receiptRow = db.prepare('SELECT receipt_json FROM official_participation_receipts WHERE game_id=? AND player_id=?').get(binding.gameId, 'p9'); assert(receiptRow);
    const foulReceipt = JSON.parse(String(receiptRow.receipt_json)) as CompletedPlayParticipationReceipt;
    const appearanceRow = db.prepare('SELECT entry_json FROM world_national_callups WHERE career_id=? AND event_id=?').get('career-a', 'national-foul:appearance'); assert(appearanceRow);
    const adoptedFoul = JSON.parse(String(appearanceRow.entry_json)) as DurableNationalAppearance;
    assert.equal(foulReceipt.closureSourceId, 'national-foul:terminal'); assert.equal(adoptedFoul.input.receiptId, foulReceipt.receiptId);
    const f: NationalBattedFoulConsumerContext = { path, db, track, close, source: origin.source, roster, callups, facts, participation,
      origins: { read: gameId => readNationalMatchOrigin(db, gameId) } };
    progress('retained_original_binding_authenticated');
    continueNationalBattedFoulOriginalTailFromField({ f, nextActor, liveRoot: { f, actor: nextActor, physical, flight, worldContact, response,
      fields, source, sources, geometry: binding.calibration, forecastGroundElapsedSeconds },
      foulTerminalSource: { sourceId: 'national-foul:terminal', applicationId: 'national-foul:application' }, foulReceipt, adoptedFoul,
      originBytes: json(origin), clubBefore: roster.readHead('career-a', 'club-a'), progress });
  } finally { close(); }
};
