import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { createBattedBallFlightEvidence } from '../../core/sim/ball/BattedBallFlightEvidence';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battedEpisodeFieldBindingEvidenceFromSqlite } from './SqliteBattedEpisodeFieldBindingStore';
import { battedContactResponseEvidenceFromSqlite } from './SqliteBattedContactResponseStore';
import { battedWorldBaseGeometryEvidenceFromSqlite } from './SqliteBattedWorldBaseGeometryStore';
import { openSqliteBattedWorldFieldStore, type AcceptedBattedWorldFieldAction } from './SqliteBattedWorldFieldStore';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { ownedMotionKnownWorkFromSqlite } from './OwnedMotionKnownWorkFromSqlite';
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
  const installed = (table: string) => !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
  const row = db.prepare('SELECT game_id FROM batted_episode_field_bindings WHERE source_id=?').get('national-live:episode-binding'); assert(row);
  const gameId = String(row.game_id);
  assertNationalBattedFoulRetainedPitchFrontier(db, gameId);
  assert.equal(db.prepare('SELECT count(*) AS n FROM physical_pitch_progress_actions WHERE source_id=?').get('national-live:pitch-0')!.n, 1);
  const bindings = db.prepare(`SELECT source_id,binding_version,game_id,play_id,physical_pitch_source_id,response_source_id,field_calibration_source_id
    FROM batted_episode_field_bindings`).all().map(v => ({ ...v }));
  assert.deepEqual(bindings, [{ source_id: 'national-live:episode-binding', binding_version: 'batted_episode_field_binding_v3', game_id: gameId,
    play_id: 8, physical_pitch_source_id: 'national-live:pitch-0', response_source_id: 'national-live:response', field_calibration_source_id: 'national-foul:geometry' }]);
  const pitch = 'national-live:pitch-0';
  const fieldIds = ['national-live:field', 'field-race-candidate-0'];
  const fields = db.prepare(`SELECT * FROM batted_world_field_actions WHERE physical_pitch_source_id=? OR source_id IN (?,?) ORDER BY revision`)
    .all(pitch, ...fieldIds);
  const heads = db.prepare(`SELECT * FROM batted_world_field_heads WHERE physical_pitch_source_id=? OR source_id IN (?,?)`).all(pitch, ...fieldIds);
  const executions = db.prepare(`SELECT * FROM batted_world_field_executions WHERE physical_pitch_source_id=? OR source_id='field-race-acquisition' ORDER BY revision`).all(pitch);
  const executionHeads = db.prepare(`SELECT * FROM batted_world_field_execution_heads WHERE physical_pitch_source_id=? OR source_id='field-race-acquisition'`).all(pitch);
  const runtimes = db.prepare(`SELECT * FROM actual_live_play_runtimes WHERE (game_id=? AND play_id=8) OR physical_pitch_source_id=? OR source_id='live-play-runtime'`).all(gameId, pitch);
  const admissions = db.prepare(`SELECT * FROM actual_live_play_admissions WHERE runtime_source_id='live-play-runtime'
    OR source_id IN ('national-live:field','field-race-candidate-0','field-race-acquisition') ORDER BY sequence`).all();
  if (!fields.length && !executions.length && !runtimes.length) {
    assert.deepEqual(heads, []); assert.deepEqual(executionHeads, []); assert.deepEqual(admissions, []);
  } else {
    // Only the complete acquisition or feet physical prefix is supported.
    // The optional original observation/model return boundary is checked below.
    assert.deepEqual(runtimes.map(r => [r.source_id, r.game_id, r.play_id, r.physical_pitch_source_id]),
      [['live-play-runtime', gameId, 8, pitch]]);
    assert.deepEqual(fields.map(r => [r.source_id, r.revision, r.previous_source_id, r.game_id, r.physical_pitch_source_id, r.response_source_id, r.geometry_source_id]),
      fieldIds.map((id, i) => [id, i + 1, i ? fieldIds[0] : null, gameId, pitch, 'national-live:response', 'national-foul:geometry']));
    assert.deepEqual(heads.map(r => ({ ...r })), [{ physical_pitch_source_id: pitch, response_source_id: 'national-live:response',
      geometry_source_id: 'national-foul:geometry', source_id: fieldIds[1], revision: 2 }]);
    const executionIds = executions.length === 5 || executions.length === 6 ? ['field-race-acquisition', 'field-race-capture-initialized', 'field-race-capture-fence',
      'field-race-capture-confirmed', 'field-race-feet', ...(executions.length === 6 ? ['field-race-real-motor'] : [])] : ['field-race-acquisition'];
    assert.deepEqual(executions.map(r => [r.source_id, r.revision, r.previous_source_id, r.game_id, r.physical_pitch_source_id, r.base_field_source_id]),
      executionIds.map((id, i) => [id, i + 1, i ? executionIds[i - 1] : null, gameId, pitch, fieldIds[1]]));
    assert.deepEqual(executionHeads.map(r => ({ ...r })), [{ physical_pitch_source_id: pitch, base_field_source_id: fieldIds[1], source_id: executionIds.at(-1), revision: executionIds.length }]);
    const observations: Record<string, unknown>[] = [];
    const decisionModels: Record<string, unknown>[] = [];
    const plans: Record<string, unknown>[] = [], decisions: Record<string, unknown>[] = [], motorModels: Record<string, unknown>[] = [], motors: Record<string, unknown>[] = [];
    if (executionIds.length >= 5) {
      assert.deepEqual(db.prepare('SELECT source_id FROM world_player_fielding_models').all().map(r => ({ ...r })), [{ source_id: 'observation-fielding-p1' }]);
      assert.deepEqual(db.prepare('SELECT source_id FROM world_player_observation_models').all().map(r => ({ ...r })), [{ source_id: 'actual-observation-model-p1' }]);
      observations.push(...db.prepare('SELECT * FROM actual_field_observations').all());
      if (installed('world_player_decision_models')) decisionModels.push(...db.prepare('SELECT * FROM world_player_decision_models').all());
      if (!observations.length) {
        assert.deepEqual(db.prepare('SELECT * FROM actual_field_observation_heads').all(), []);
        assert.deepEqual(decisionModels, []);
      } else {
        // Exactly the successful observation + model return boundary. Raw rows
        // identify the cut; their real public readers authenticate it below.
        assert.deepEqual(observations.map(r => [r.source_id, r.physical_pitch_source_id, r.player_id, r.base_field_source_id,
          r.execution_source_id, r.observation_model_source_id, r.previous_source_id, r.revision]),
        [['actual-observation-p1-1', pitch, 'p1', fieldIds[1], 'field-race-feet', 'actual-observation-model-p1', null, 1]]);
        assert.deepEqual(db.prepare('SELECT * FROM actual_field_observation_heads').all().map(r => ({ ...r })),
          [{ physical_pitch_source_id: pitch, player_id: 'p1', source_id: 'actual-observation-p1-1', revision: 1 }]);
        assert.deepEqual(decisionModels.map(r => [r.source_id, r.source_version, r.career_id, r.player_id, r.person_link_source_id,
          r.fielding_model_source_id, r.accepted_at_day]),
        [['scheduled-decision-model-p1', 'synthetic-v1', 'career-a', 'p1', 'link-1', 'observation-fielding-p1', 121]]);
      }
      if (installed('actual_defensive_plans')) plans.push(...db.prepare('SELECT * FROM actual_defensive_plans').all());
      if (installed('actual_defensive_decisions')) decisions.push(...db.prepare('SELECT * FROM actual_defensive_decisions').all());
      if (installed('world_player_locomotion_models')) motorModels.push(...db.prepare('SELECT * FROM world_player_locomotion_models').all());
      const decisionHeads = installed('actual_defensive_decision_heads') ? db.prepare('SELECT * FROM actual_defensive_decision_heads').all() : [];
      if (plans.length || decisions.length || motorModels.length || decisionHeads.length) {
        assert.equal(observations.length, 1); assert.equal(decisionModels.length, 1);
        assert.deepEqual(plans.map(r => [r.source_id, r.source_version, r.physical_pitch_source_id, r.career_id, r.player_id,
          r.person_link_source_id, r.fielding_model_source_id, r.game_day, r.observation_source_id]),
        [['scheduled-priorities-p1', 'synthetic-v1', pitch, 'career-a', 'p1', 'link-1', 'observation-fielding-p1', 121, 'actual-observation-p1-1']]);
        assert.deepEqual(decisions.map(r => [r.source_id, r.source_version, r.physical_pitch_source_id, r.player_id, r.observation_source_id,
          r.decision_model_source_id, r.plan_source_id, r.previous_source_id, r.revision]),
        [['scheduled-decision-p1', 'synthetic-v1', pitch, 'p1', 'actual-observation-p1-1', 'scheduled-decision-model-p1', 'scheduled-priorities-p1', null, 1]]);
        assert.deepEqual(decisionHeads.map(r => ({ ...r })), [{ physical_pitch_source_id: pitch, player_id: 'p1', source_id: 'scheduled-decision-p1', revision: 1 }]);
        assert.deepEqual(motorModels.map(r => [r.source_id, r.source_version, r.capability, r.career_id, r.player_id, r.person_link_source_id,
          r.fielding_model_source_id, r.accepted_at_day]),
        [['scheduled-locomotion-model-p1', 'synthetic-v1', 'defender_locomotion_v1', 'career-a', 'p1', 'link-1', 'observation-fielding-p1', 121]]);
      }
      if (executionIds.length === 6) {
        assert.equal(decisions.length, 1); assert.equal(motorModels.length, 1);
        motors.push(...db.prepare('SELECT * FROM actual_locomotion_receipts').all());
        assert.deepEqual(motors.map(r => [r.source_id, r.source_version, r.capability, r.physical_pitch_source_id, r.player_id,
          r.decision_source_id, r.locomotion_model_source_id, r.base_field_source_id, r.execution_source_id]),
        [['scheduled-motor-p1', 'synthetic-v1', 'initial_defender_step_v1', pitch, 'p1', 'scheduled-decision-p1',
          'scheduled-locomotion-model-p1', fieldIds[1], 'field-race-feet']]);
        assert.deepEqual(db.prepare('SELECT * FROM actual_locomotion_heads').all().map(r => ({ ...r })),
          [{ physical_pitch_source_id: pitch, player_id: 'p1', source_id: 'scheduled-motor-p1', revision: 1 }]);
      } else for (const table of ['actual_locomotion_receipts', 'actual_locomotion_heads']) if (installed(table))
        assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table}`).get()!.n, 0);
    }
    // Preserve the original interleaving: physical feet, observation/decision,
    // motor receipt, then the already returned physical motor adoption.
    const ordered = [
      ...fields.map(row => ({ owner: 'batted_world_field_actions', row })),
      ...executions.slice(0, 5).map(row => ({ owner: 'batted_world_field_executions', row })),
      ...observations.map(row => ({ owner: 'actual_field_observations', row })),
      ...plans.map(row => ({ owner: 'actual_defensive_plans', row })),
      ...decisions.map(row => ({ owner: 'actual_defensive_decisions', row })),
      ...motors.map(row => ({ owner: 'actual_locomotion_receipts', row })),
      ...executions.slice(5).map(row => ({ owner: 'batted_world_field_executions', row })),
    ];
    for (const row of [...runtimes, ...ordered.map(v => v.row), ...decisionModels, ...motorModels]) for (const part of ['source', 'snapshot']) {
      assert.equal(typeof row[part + '_json'], 'string');
      assert.equal(createHash('sha256').update(String(row[part + '_json'])).digest('hex'), row[part + '_hash']);
    }
    assert.deepEqual(admissions.map(r => ({ ...r })), ordered.map(({ owner, row }, i) => ({ runtime_source_id: 'live-play-runtime', sequence: i + 1,
      owner, source_id: row.source_id, source_hash: row.source_hash, snapshot_hash: row.snapshot_hash })));
  }
  if (installed('actual_live_play_closures')) assert.equal(db.prepare('SELECT count(*) AS n FROM actual_live_play_closures WHERE game_id=?').get(gameId)!.n, 0);
  if (installed('official_player_outcome_applications')) assert.equal(db.prepare('SELECT count(*) AS n FROM official_player_outcome_applications').get()!.n, 0);
  assert.deepEqual(db.prepare('SELECT source_id,status,play_id FROM actual_foul_terminal_applications WHERE game_id=?').all(gameId).map(v => ({ ...v })),
    [{ source_id: 'national-foul:terminal', status: 'POST_PLAY_COMPLETED_CONTINUING', play_id: 7 }]);
  assert.deepEqual(db.prepare('SELECT player_id FROM official_participation_receipts WHERE game_id=?').all(gameId).map(v => ({ ...v })), [{ player_id: 'p9' }]);
  assert.equal(db.prepare("SELECT count(*) AS n FROM world_national_callups WHERE event_id='national-live:appearance'").get()!.n, 0);
  return gameId;
};

/** Compare the retained proposals against the unchanged helper recipe, after
 * its binding has been authenticated. No saved snapshot is returned as proof. */
export const assertNationalBattedFoulRetainedAcquisitionSources = (db: Pick<Db, 'prepare'>,
  firstField: Extract<AcceptedBattedWorldFieldAction, { kind?: never }>) => {
  const runtime = db.prepare("SELECT source_json FROM actual_live_play_runtimes WHERE source_id='live-play-runtime'").get();
  if (!runtime) return;
  const pitch = 'national-live:pitch-0';
  assert.equal(runtime.source_json, json({ sourceId: 'live-play-runtime', sourceVersion: 'fixture-v1',
    capability: 'causal_original_live_play_runtime_v1', physicalPitchSourceId: pitch }));
  const candidate = { ...firstField, sourceId: 'field-race-candidate-0', previousFieldSourceId: firstField.sourceId };
  for (const source of [firstField, candidate]) assert.equal(
    db.prepare('SELECT source_json FROM batted_world_field_actions WHERE source_id=?').get(source.sourceId)?.source_json, json(source));
  // Historical acquisition precedes the retained decision. Current heads must
  // never rewrite its original proposal; public execution replay authenticates it.
  const hasMotorModel = !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='world_player_locomotion_models'").get()
    && db.prepare('SELECT count(*) AS n FROM world_player_locomotion_models').get()!.n !== 0;
  if (hasMotorModel) {
    assertNationalBattedFoulRetainedBindingFrontier(db);
    assert(['field-race-feet', 'field-race-real-motor'].includes(String(db.prepare('SELECT source_id FROM batted_world_field_execution_heads WHERE physical_pitch_source_id=?').get(pitch)?.source_id)));
  }
  const knownWork = hasMotorModel ? firstField.commands.map(c => ({ playerId: c.playerId, decisionSourceId: null, motorSourceId: null }))
    : ownedMotionKnownWorkFromSqlite(db, pitch, firstField.commands.map(c => c.playerId));
  assert(knownWork.every(work => work.decisionSourceId === null && work.motorSourceId === null), 'retained acquisition cut has later decision or motor work');
  assert.equal(db.prepare("SELECT source_json FROM batted_world_field_executions WHERE source_id='field-race-acquisition'").get()?.source_json,
    json({ sourceId: 'field-race-acquisition', sourceVersion: 'fixture-v1', baseFieldSourceId: candidate.sourceId, previousExecutionSourceId: null,
      action: { kind: 'owned_acquisition_plan_v1', knownWork } }));
};

/** Resume the genuine binding, acquisition, feet, observation + decision-model, pre-motor, or returned motor-adoption cut.
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
    const { binding, origin, retainedPhysicalCut } = withBattedVenueLegalReadSnapshot(db, () => {
      const gameId = assertNationalBattedFoulRetainedBindingFrontier(db);
      const binding = battedEpisodeFieldBindingEvidenceFromSqlite(db).read('national-live:episode-binding'); assert(binding);
      assert.equal(binding.gameId, gameId); assert.equal(binding.playId, 8);
      assert.deepEqual(binding.source, { sourceId: 'national-live:episode-binding', sourceVersion: 'fixture-v1', version: 'batted_episode_field_binding_v3',
        responseSourceId: 'national-live:response', fieldCalibrationSourceId: 'national-foul:geometry', physicalActorSourceId: 'national-live:batter',
        completedOrigin: { kind: 'foul_terminal_completion', sourceId: 'national-foul:terminal' } });
      const origin = readNationalMatchOrigin(db, gameId); assert(origin);
      const physicalHead = db.prepare("SELECT source_id FROM batted_world_field_execution_heads WHERE physical_pitch_source_id=?").get('national-live:pitch-0')?.source_id;
      const retainedPhysicalCut = physicalHead === 'field-race-real-motor' ? 'adopted_motor' as const : physicalHead === 'field-race-feet' ? db.prepare('SELECT count(*) AS n FROM actual_field_observations').get()!.n === 1
        ? db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name='world_player_locomotion_models'").get()!.n === 1
          && db.prepare('SELECT count(*) AS n FROM world_player_locomotion_models').get()!.n === 1
          ? 'feet_with_motor_model' as const : 'feet_with_decision_model' as const : 'feet' as const : undefined;
      return { binding, origin, retainedPhysicalCut };
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
    withBattedVenueLegalReadSnapshot(db, () => assertNationalBattedFoulRetainedAcquisitionSources(db, source));
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
    continueNationalBattedFoulOriginalTailFromField({ f, nextActor, retainedPhysicalCut, liveRoot: { f, actor: nextActor, physical, flight, worldContact, response,
      fields, source, sources, geometry: binding.calibration, forecastGroundElapsedSeconds },
      foulTerminalSource: { sourceId: 'national-foul:terminal', applicationId: 'national-foul:application' }, foulReceipt, adoptedFoul,
      originBytes: json(origin), clubBefore: roster.readHead('career-a', 'club-a'), progress });
  } finally { close(); }
};
