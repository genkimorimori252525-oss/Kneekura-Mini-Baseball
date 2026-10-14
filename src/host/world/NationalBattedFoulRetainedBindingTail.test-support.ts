import { assertNationalOriginalStatisticsBoundary, type NationalOriginalStatisticsBoundary } from './NationalBattedFoulOriginalStatisticsBoundary.test-support';
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
// Only this original fixture's fixed official suffix is resumable.
const officialStages = [
  ['actual_live_rule_consumptions', 'rule-consumption'], ['actual_first_base_umpire_setups', 'play-end-umpire-setup'],
  ['actual_first_base_umpire_observations', 'play-end-umpire-observation'], ['actual_first_base_umpire_calls', 'scheduled-operative-call'],
  ['batted_world_field_executions', 'actual-call-due-cut'], ['actual_first_base_umpire_calls', 'operative-call'],
  ['batted_world_field_executions', 'actual-post-call-quantizer-tail'],
  ['actual_communication_models', 'call-reception-model'], ['actual_call_communications', 'call-information'],
  ['actual_first_base_play_ends', 'physical-end'], ['actual_live_adjudications', 'fixture-actual-live-adjudication'],
  ['actual_live_play_closures', 'fixture-actual-live-closure'],
] as const;
const admittedOfficialOwners = new Set(['actual_live_rule_consumptions', 'actual_first_base_umpire_setups',
  'actual_first_base_umpire_observations', 'actual_first_base_umpire_calls', 'batted_world_field_executions', 'actual_call_communications']);
/** A structural guard only. The real binding reader below authenticates every
 * archived input; these rows never substitute for its owned evidence. */
export const assertNationalBattedFoulRetainedBindingFrontier = (db: Pick<Db, 'prepare'>, statisticsBoundary?: NationalOriginalStatisticsBoundary): string => {
  if (statisticsBoundary) assertNationalOriginalStatisticsBoundary(statisticsBoundary);
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
  const executions = db.prepare(`SELECT * FROM batted_world_field_executions WHERE physical_pitch_source_id=? OR source_id IN ('field-race-acquisition','actual-call-due-cut','actual-post-call-quantizer-tail') ORDER BY revision`).all(pitch);
  const executionHeads = db.prepare(`SELECT * FROM batted_world_field_execution_heads WHERE physical_pitch_source_id=? OR source_id IN ('field-race-acquisition','actual-call-due-cut','actual-post-call-quantizer-tail')`).all(pitch);
  const runtimes = db.prepare(`SELECT * FROM actual_live_play_runtimes WHERE (game_id=? AND play_id=8) OR physical_pitch_source_id=? OR source_id='live-play-runtime'`).all(gameId, pitch);
  const admissions = db.prepare(`SELECT * FROM actual_live_play_admissions WHERE runtime_source_id='live-play-runtime'
    OR source_id IN ('national-live:field','field-race-candidate-0','field-race-acquisition') ORDER BY sequence`).all();
  const officialRows = new Map<string, Record<string, unknown>[]>();
  for (const owner of new Set(officialStages.map(([owner]) => owner))) if (owner !== 'batted_world_field_executions') {
    const rows = installed(owner) ? db.prepare(`SELECT * FROM ${owner}`).all() : [];
    const allowed = officialStages.filter(([table]) => table === owner).map(([, sourceId]) => String(sourceId));
    assert(rows.every(row => allowed.includes(String(row.source_id))), 'unexpected retained official owner');
    officialRows.set(owner, rows);
  }
  const officialPrefix: { owner: string; row: Record<string, unknown> }[] = [];
  let absent = false;
  for (const [owner, sourceId] of officialStages) {
    const rows = (owner === 'batted_world_field_executions' ? executions : officialRows.get(owner)!)
      .filter(row => row.source_id === sourceId);
    assert(rows.length <= 1, 'unexpected retained official owner');
    if (!rows.length) { absent = true; continue; }
    assert(!absent, 'retained official prefix has a hole');
    const row = rows[0];
    if (owner.startsWith('actual_first_base_umpire_')) {
      const dependency = sourceId === 'play-end-umpire-setup' ? pitch
        : sourceId === 'play-end-umpire-observation' ? 'play-end-umpire-setup' : 'play-end-umpire-observation';
      const current = sourceId === 'play-end-umpire-setup' ? null : sourceId === 'operative-call' ? 'actual-call-due-cut' : 'field-first-base-race';
      assert.deepEqual([row.source_version, row.game_id, row.physical_pitch_source_id, row.umpire_id, row.dependency_source_id, row.current_execution_source_id],
        ['fixture-v1', gameId, pitch, 'umpire-1', dependency, current], 'retained official owner scope differs');
    }
    if (owner === 'actual_communication_models') assert.deepEqual([row.source_version, row.game_id, row.physical_pitch_source_id],
      ['fixture-v1', gameId, pitch], 'retained communication model scope differs');
    if (owner === 'actual_call_communications') assert.deepEqual([row.source_version, row.game_id, row.play_id, row.physical_pitch_source_id,
      row.call_source_id, row.model_source_id, row.current_execution_source_id, row.previous_source_id, row.revision],
      ['fixture-v1', gameId, 8, pitch, 'operative-call', 'call-reception-model', 'actual-post-call-quantizer-tail', null, 1], 'retained communication scope differs');
    if (owner === 'actual_first_base_play_ends') assert.deepEqual([row.game_id, row.play_id, row.physical_pitch_source_id], [gameId, 8, pitch]);
    if (owner === 'actual_live_adjudications') assert.deepEqual([row.game_id, row.play_id, row.physical_end_source_id], [gameId, 8, 'physical-end']);
    if (owner === 'actual_live_play_closures') {
      assert.deepEqual([row.game_id, row.play_id, row.application_id], [gameId, 8, 'fixture-actual-live-application']);
      assert(row.status === 'QUEUED' && row.result_json === null || row.status === 'OFFICIAL_APPLIED' && typeof row.result_json === 'string',
        'retained closure stage differs');
    }
    officialPrefix.push({ owner, row });
  }
  if (officialPrefix.length) assert(executions.length >= 8, 'retained official prefix requires the original first-base race');
  const communication = officialPrefix.some(v => v.owner === 'actual_call_communications');
  assert.deepEqual(installed('actual_call_communication_heads') ? db.prepare('SELECT * FROM actual_call_communication_heads').all().map(v => ({ ...v })) : [],
    communication ? [{ call_source_id: 'operative-call', source_id: 'call-information', revision: 1 }] : [], 'retained communication head differs');
  const ended = officialPrefix.some(v => v.owner === 'actual_first_base_play_ends');
  assert.deepEqual(installed('actual_live_play_fences') ? db.prepare('SELECT * FROM actual_live_play_fences WHERE (game_id=? AND play_id=8) OR physical_pitch_source_id=? OR closure_source_id=?')
    .all(gameId, pitch, 'physical-end').map(v => ({ ...v })) : [],
    ended ? [{ game_id: gameId, play_id: 8, physical_pitch_source_id: pitch, closure_source_id: 'physical-end' }] : [], 'retained physical end fence differs');
  if (!fields.length && !executions.length && !runtimes.length) {
    assert.deepEqual(heads, []); assert.deepEqual(executionHeads, []); assert.deepEqual(admissions, []); assert.deepEqual(officialPrefix, []);
  } else {
    // Keep the original physical prefix distinct from the two optional call cuts.
    // Every supported boundary must retain its contiguous original admissions.
    assert.deepEqual(runtimes.map(r => [r.source_id, r.game_id, r.play_id, r.physical_pitch_source_id]),
      [['live-play-runtime', gameId, 8, pitch]]);
    assert.deepEqual(fields.map(r => [r.source_id, r.revision, r.previous_source_id, r.game_id, r.physical_pitch_source_id, r.response_source_id, r.geometry_source_id]),
      fieldIds.map((id, i) => [id, i + 1, i ? fieldIds[0] : null, gameId, pitch, 'national-live:response', 'national-foul:geometry']));
    assert.deepEqual(heads.map(r => ({ ...r })), [{ physical_pitch_source_id: pitch, response_source_id: 'national-live:response',
      geometry_source_id: 'national-foul:geometry', source_id: fieldIds[1], revision: 2 }]);
    const executionIds = [5, 6, 8, 9, 10].includes(executions.length) ? ['field-race-acquisition', 'field-race-capture-initialized', 'field-race-capture-fence',
      'field-race-capture-confirmed', 'field-race-feet', ...(executions.length >= 6 ? ['field-race-real-motor'] : []),
      ...(executions.length >= 8 ? ['field-race-quantizer-tail', 'field-first-base-race'] : []),
      ...(executions.length >= 9 ? ['actual-call-due-cut'] : []), ...(executions.length === 10 ? ['actual-post-call-quantizer-tail'] : [])] : ['field-race-acquisition'];
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
      if (executionIds.length >= 6) {
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
      ...executions.slice(5, 8).map(row => ({ owner: 'batted_world_field_executions', row })),
      ...officialPrefix.filter(v => admittedOfficialOwners.has(v.owner)),
    ];
    const archives = [...runtimes, ...ordered.map(v => v.row), ...decisionModels, ...motorModels,
      ...officialPrefix.filter(v => !admittedOfficialOwners.has(v.owner) && v.owner !== 'actual_live_play_closures').map(v => v.row)];
    for (const row of archives) for (const part of ['source', 'snapshot']) {
      assert.equal(typeof row[part + '_json'], 'string');
      assert.equal(createHash('sha256').update(String(row[part + '_json'])).digest('hex'), row[part + '_hash']);
    }
    const closure = officialPrefix.find(v => v.owner === 'actual_live_play_closures')?.row;
    if (closure) for (const part of ['source', 'proposal']) {
      assert.equal(typeof closure[part + '_json'], 'string');
      assert.equal(createHash('sha256').update(String(closure[part + '_json'])).digest('hex'), closure[part + '_hash']);
    }
    assert.deepEqual(admissions.map(r => ({ ...r })), ordered.map(({ owner, row }, i) => ({ runtime_source_id: 'live-play-runtime', sequence: i + 1,
      owner, source_id: row.source_id, source_hash: row.source_hash, snapshot_hash: row.snapshot_hash })));
  }
  const rows = (table: string) => installed(table) ? db.prepare(`SELECT * FROM ${table}`).all() : [];
  const outcomes = rows('official_player_outcome_applications'), scoring = rows('actual_live_scoring_sources');
  const genesis = rows('world_person_genesis_careers'), people = rows('world_person_priors');
  const episodes = rows('world_development_initiations'), episodeOrigins = rows('world_development_national_exposure_origins');
  const revocations = installed('world_national_eligibility_facts') ? db.prepare("SELECT * FROM world_national_eligibility_facts WHERE evidence_id='national-later-revocation'").all() : [];
  if (statisticsBoundary) {
    const closure = officialPrefix.find(v => v.owner === 'actual_live_play_closures')?.row;
    assert.equal(closure?.status, 'OFFICIAL_APPLIED', 'retained statistics require the original applied closure');
    assert(outcomes.every(row => row.game_id === gameId && (row.owner === 'actual_foul_terminal_applications' && row.source_id === 'national-foul:terminal'
      || row.owner === 'actual_live_play_closures' && row.source_id === 'fixture-actual-live-closure')), 'foreign retained statistics owner');
    assert.equal(outcomes.filter(row => row.owner === 'actual_foul_terminal_applications').length, 1, 'original foul attribution is missing');
    assert(scoring.length <= 1 && scoring.every(row => row.source_id === 'national-live:ground-out' && row.game_id === gameId
      && row.play_id === 8 && row.closure_id === 'fixture-actual-live-closure' && row.scoring_application_id === 'national-live:ground-out-score'
      && (row.status === 'QUEUED' && row.result_json === null || row.status === 'SCORED' && typeof row.result_json === 'string')), 'foreign retained scoring owner');
    assert(genesis.length <= 1 && genesis.every(row => row.career_id === 'career-a'), 'foreign retained genesis');
    assert(people.length === 0 || people.length === 2 && ['link-9', 'link-10'].every(id => people.some(row => row.source_id === id)), 'retained original Person batch differs');
    assert(episodes.length <= 2 && episodes.every(row => ['episode-p9', 'episode-p10'].includes(String(row.episode_id))), 'foreign retained exposure');
    assert.deepEqual(episodeOrigins.map(row => row.episode_id).sort(), episodes.map(row => row.episode_id).sort(), 'retained exposure origin differs');
    assert(revocations.length <= 1);
    const stages = [scoring.length === 1, scoring[0]?.status === 'SCORED', outcomes.some(row => row.owner === 'actual_live_play_closures'),
      genesis.length === 1, people.length === 2, episodes.some(row => row.episode_id === 'episode-p9'),
      episodes.some(row => row.episode_id === 'episode-p10'), revocations.length === 1];
    let missing = false;
    for (const present of stages) { assert(!missing || !present, 'retained original consumer prefix has a hole'); missing ||= !present; }
  } else {
    assert.equal([...outcomes, ...scoring, ...genesis, ...people, ...episodes, ...episodeOrigins, ...revocations].length, 0,
      'later original consumer requires its completed assertion witness');
  }
  assert.deepEqual(db.prepare('SELECT source_id,status,play_id FROM actual_foul_terminal_applications WHERE game_id=?').all(gameId).map(v => ({ ...v })),
    [{ source_id: 'national-foul:terminal', status: 'POST_PLAY_COMPLETED_CONTINUING', play_id: 7 }]);
  assert.deepEqual(db.prepare('SELECT player_id FROM official_participation_receipts WHERE game_id=? ORDER BY player_id').all(gameId).map(v => ({ ...v })),
    statisticsBoundary ? [{ player_id: 'p10' }, { player_id: 'p9' }] : [{ player_id: 'p9' }]);
  assert.equal(db.prepare("SELECT count(*) AS n FROM world_national_callups WHERE event_id='national-live:appearance'").get()!.n, statisticsBoundary ? 1 : 0);
  return gameId;
};

/** Compare the retained proposals against the unchanged helper recipe, after
 * its binding has been authenticated. No saved snapshot is returned as proof. */
export const assertNationalBattedFoulRetainedAcquisitionSources = (db: Pick<Db, 'prepare'>,
  firstField: Extract<AcceptedBattedWorldFieldAction, { kind?: never }>, statisticsBoundary?: NationalOriginalStatisticsBoundary) => {
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
    assertNationalBattedFoulRetainedBindingFrontier(db, statisticsBoundary);
    assert(['field-race-feet', 'field-race-real-motor', 'field-first-base-race', 'actual-call-due-cut', 'actual-post-call-quantizer-tail'].includes(String(db.prepare('SELECT source_id FROM batted_world_field_execution_heads WHERE physical_pitch_source_id=?').get(pitch)?.source_id)));
  }
  const knownWork = hasMotorModel ? firstField.commands.map(c => ({ playerId: c.playerId, decisionSourceId: null, motorSourceId: null }))
    : ownedMotionKnownWorkFromSqlite(db, pitch, firstField.commands.map(c => c.playerId));
  assert(knownWork.every(work => work.decisionSourceId === null && work.motorSourceId === null), 'retained acquisition cut has later decision or motor work');
  assert.equal(db.prepare("SELECT source_json FROM batted_world_field_executions WHERE source_id='field-race-acquisition'").get()?.source_json,
    json({ sourceId: 'field-race-acquisition', sourceVersion: 'fixture-v1', baseFieldSourceId: candidate.sourceId, previousExecutionSourceId: null,
      action: { kind: 'owned_acquisition_plan_v1', knownWork } }));
};

/** Resume the genuine binding, acquisition, feet, observation + decision-model,
 * pre-motor, motor-adoption, first-base race, or contiguous seven-stage official prefix.
 * No pitch, flight, contact, response, binding or foul admission is retried.
 * The ordinary entry retains every original assertion, including the missing
 * scoring check. Only the separate witnessed statistics entry skips that past check. */
export const continueRetainedNationalBattedFoulBindingTail = (path: string, progress: (phase: string) => void) =>
  continueRetainedOriginalTail(path, progress);
/** This later entry requires the original run's completed missing-scoring check. */
export const continueRetainedNationalBattedFoulStatisticsTail = (path: string, progress: (phase: string) => void,
  boundary: NationalOriginalStatisticsBoundary) => continueRetainedOriginalTail(path, progress, boundary);
const continueRetainedOriginalTail = (path: string, progress: (phase: string) => void,
  statisticsBoundary?: NationalOriginalStatisticsBoundary) => {
  if (statisticsBoundary) assertNationalOriginalStatisticsBoundary(statisticsBoundary);
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
      const gameId = assertNationalBattedFoulRetainedBindingFrontier(db, statisticsBoundary);
      const binding = battedEpisodeFieldBindingEvidenceFromSqlite(db).read('national-live:episode-binding'); assert(binding);
      assert.equal(binding.gameId, gameId); assert.equal(binding.playId, 8);
      assert.deepEqual(binding.source, { sourceId: 'national-live:episode-binding', sourceVersion: 'fixture-v1', version: 'batted_episode_field_binding_v3',
        responseSourceId: 'national-live:response', fieldCalibrationSourceId: 'national-foul:geometry', physicalActorSourceId: 'national-live:batter',
        completedOrigin: { kind: 'foul_terminal_completion', sourceId: 'national-foul:terminal' } });
      const origin = readNationalMatchOrigin(db, gameId); assert(origin);
      const physicalHead = db.prepare("SELECT source_id FROM batted_world_field_execution_heads WHERE physical_pitch_source_id=?").get('national-live:pitch-0')?.source_id;
      const completedOfficialSourceIds = officialStages.filter(([owner, sourceId]) =>
        db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(owner)
        && db.prepare(`SELECT source_id FROM ${owner} WHERE source_id=?`).get(sourceId)).map(([, sourceId]) => String(sourceId));
      const officialPhysicalHead = (['field-first-base-race', 'actual-call-due-cut', 'actual-post-call-quantizer-tail'] as const).find(id => id === physicalHead);
      if (completedOfficialSourceIds.length) assert(officialPhysicalHead, 'retained official physical head differs');
      const retainedPhysicalCut = completedOfficialSourceIds.length ? { kind: 'official_prefix' as const,
        physicalHeadSourceId: officialPhysicalHead!, completedSourceIds: completedOfficialSourceIds } : physicalHead === 'field-first-base-race' ? 'first_base_race' as const : physicalHead === 'field-race-real-motor' ? 'adopted_motor' as const : physicalHead === 'field-race-feet' ? db.prepare('SELECT count(*) AS n FROM actual_field_observations').get()!.n === 1
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
    withBattedVenueLegalReadSnapshot(db, () => assertNationalBattedFoulRetainedAcquisitionSources(db, source, statisticsBoundary));
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
    continueNationalBattedFoulOriginalTailFromField({ f, nextActor, retainedPhysicalCut, statisticsBoundary, liveRoot: { f, actor: nextActor, physical, flight, worldContact, response,
      fields, source, sources, geometry: binding.calibration, forecastGroundElapsedSeconds },
      foulTerminalSource: { sourceId: 'national-foul:terminal', applicationId: 'national-foul:application' }, foulReceipt, adoptedFoul,
      originBytes: json(origin), clubBefore: roster.readHead('career-a', 'club-a'), progress });
  } finally { close(); }
};
