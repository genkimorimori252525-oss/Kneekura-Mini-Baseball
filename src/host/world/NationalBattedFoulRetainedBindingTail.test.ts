import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { firstBaseFixtureKnownWork } from './ActualFirstBasePlayEndFixtures.test-support';
import type { AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { nationalBattedFieldFixtureSource } from './NationalBattedFieldFixtures.test-support';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { assertNationalBattedFoulRetainedBindingFrontier, assertNationalBattedFoulRetainedAcquisitionSources } from './NationalBattedFoulRetainedBindingTail.test-support';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const gameId = 'retained-common-national';
const fixture = () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE physical_pitch_progress_actions(source_id TEXT,game_id TEXT,play_id INTEGER,progress_revision INTEGER);
    CREATE TABLE physical_pitch_progress_heads(game_id TEXT,play_id INTEGER,revision INTEGER,last_source_id TEXT);
    CREATE TABLE batted_episode_field_bindings(source_id TEXT,binding_version TEXT,game_id TEXT,play_id INTEGER,physical_pitch_source_id TEXT,response_source_id TEXT,field_calibration_source_id TEXT);
    CREATE TABLE batted_world_field_actions(source_id TEXT,physical_pitch_source_id TEXT,response_source_id TEXT,geometry_source_id TEXT,previous_source_id TEXT,
      revision INTEGER,game_id TEXT,source_json TEXT,source_hash TEXT,snapshot_json TEXT,snapshot_hash TEXT);
    CREATE TABLE batted_world_field_heads(physical_pitch_source_id TEXT,response_source_id TEXT,geometry_source_id TEXT,source_id TEXT,revision INTEGER);
    CREATE TABLE batted_world_field_executions(source_id TEXT,physical_pitch_source_id TEXT,base_field_source_id TEXT,previous_source_id TEXT,revision INTEGER,game_id TEXT,
      source_json TEXT,source_hash TEXT,snapshot_json TEXT,snapshot_hash TEXT);
    CREATE TABLE batted_world_field_execution_heads(physical_pitch_source_id TEXT,base_field_source_id TEXT,source_id TEXT,revision INTEGER);
    CREATE TABLE actual_live_play_admissions(runtime_source_id TEXT,sequence INTEGER,owner TEXT,source_id TEXT,source_hash TEXT,snapshot_hash TEXT);
    CREATE TABLE actual_live_play_runtimes(source_id TEXT,game_id TEXT,play_id INTEGER,physical_pitch_source_id TEXT,source_json TEXT,source_hash TEXT,snapshot_json TEXT,snapshot_hash TEXT);
    CREATE TABLE actual_foul_terminal_applications(source_id TEXT,game_id TEXT,status TEXT,play_id INTEGER);
    CREATE TABLE official_participation_receipts(game_id TEXT,player_id TEXT);
    CREATE TABLE world_national_callups(event_id TEXT);`);
  db.prepare('INSERT INTO physical_pitch_progress_actions VALUES(?,?,8,1)').run('national-live:pitch-0', gameId);
  db.prepare('INSERT INTO physical_pitch_progress_heads VALUES(?,8,1,?)').run(gameId, 'national-live:pitch-0');
  db.prepare('INSERT INTO batted_episode_field_bindings VALUES(?,?,?,?,?,?,?)').run('national-live:episode-binding', 'batted_episode_field_binding_v3', gameId, 8,
    'national-live:pitch-0', 'national-live:response', 'national-foul:geometry');
  db.prepare('INSERT INTO actual_foul_terminal_applications VALUES(?,?,?,7)').run('national-foul:terminal', gameId, 'POST_PLAY_COMPLETED_CONTINUING');
  db.prepare('INSERT INTO official_participation_receipts VALUES(?,?)').run(gameId, 'p9');
  db.exec("INSERT INTO batted_world_field_actions(physical_pitch_source_id) VALUES('national-foul:pitch-2'); INSERT INTO actual_live_play_runtimes(source_id,game_id,play_id) VALUES('national-foul:end-runtime','retained-common-national',7)");
  return db;
};
const rows = (db: InstanceType<typeof DatabaseSync>) => db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
  .map(row => [row.name, db.prepare(`SELECT * FROM ${row.name}`).all()]);

it('checks the exact pre-runtime binding frontier without treating structural rows as owner proof', () => {
  const db = fixture(); try { const before = rows(db), changes = db.prepare('SELECT total_changes() AS n').get();
    expect(assertNationalBattedFoulRetainedBindingFrontier(db)).toBe(gameId);
    expect(rows(db)).toEqual(before); expect(db.prepare('SELECT total_changes() AS n').get()).toEqual(changes);
  } finally { db.close(); }
});
it.each([
  ['missing pitch', 'DELETE FROM physical_pitch_progress_actions'],
  ['wrong binding version', "UPDATE batted_episode_field_bindings SET binding_version='batted_episode_field_binding_v2'"],
  ['wrong original calibration', "UPDATE batted_episode_field_bindings SET field_calibration_source_id='national-live:geometry'"],
  ['already registered runtime', "INSERT INTO actual_live_play_runtimes(source_id,game_id,play_id) VALUES('live-play-runtime','retained-common-national',8)"],
  ['already applied field', "INSERT INTO batted_world_field_actions(physical_pitch_source_id) VALUES('national-live:pitch-0')"],
  ['already applied statistics', 'CREATE TABLE official_player_outcome_applications(source_id TEXT); INSERT INTO official_player_outcome_applications VALUES(\'national-foul:terminal\')'],
  ['already participated next batter', "INSERT INTO official_participation_receipts VALUES('retained-common-national','p10')"],
])('rejects an unsupported structural binding cut: %s', (_label, mutation) => {
  const db = fixture(); try { db.exec(mutation); const before = rows(db);
    expect(() => assertNationalBattedFoulRetainedBindingFrontier(db)).toThrow(); expect(rows(db)).toEqual(before);
  } finally { db.close(); }
});
it.each([false, true])('preserves the original unaccepted field Source recipe (episode binding: %s)', retained => {
  const zero = { x: 0, y: 0, z: 0 }, acceleration = { x: 1, y: 2, z: 3 };
  const binding = { version: 'batted_episode_field_binding_v3' as const, sourceId: 'national-live:episode-binding' };
  const commands = [{ playerId: 'p10', bodyAcceleration: zero, primitiveMotions: [{ role: 'left_foot' as const, offsetVelocity: zero, offsetAcceleration: acceleration }] }];
  const before = structuredClone(commands);
  expect(nationalBattedFieldFixtureSource({ label: 'national-live', responseSourceId: 'national-live:response', geometrySourceId: 'national-foul:geometry',
    initialBallTick: 123456, commands, ...(retained ? { episodeFieldBinding: binding } : {}) })).toEqual({
    sourceId: 'national-live:field', sourceVersion: 'fixture-v1', responseSourceId: 'national-live:response', geometrySourceId: 'national-foul:geometry',
    previousFieldSourceId: null, availableAtTick: 123456, throughTick: 2123456,
    commands: [{ playerId: 'p10', bodyAcceleration: zero, primitiveMotions: [{ role: 'left_foot', offsetAcceleration: acceleration }] }],
    ...(retained ? { episodeFieldBinding: binding } : {}),
  });
  expect(commands).toEqual(before);
});

// Metadata-only fixture checks. These rows intentionally do not constitute
// physical owner evidence or qualify a genuine acquisition/continuation.
const acquisitionCut = () => {
  const db = fixture(), pitch = 'national-live:pitch-0', zero = { x: 0, y: 0, z: 0 };
  const players = ['p0', 'p1', 'p10', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
  const first = nationalBattedFieldFixtureSource({ label: 'national-live', responseSourceId: 'national-live:response', geometrySourceId: 'national-foul:geometry',
    initialBallTick: 123456, commands: players.map(playerId => ({ playerId, bodyAcceleration: zero,
      primitiveMotions: [{ role: 'left_foot', offsetVelocity: zero, offsetAcceleration: zero }] })),
    episodeFieldBinding: { version: 'batted_episode_field_binding_v3', sourceId: 'national-live:episode-binding' } });
  const runtime = { sourceId: 'live-play-runtime', sourceVersion: 'fixture-v1', capability: 'causal_original_live_play_runtime_v1', physicalPitchSourceId: pitch };
  const snapshot = { metadataTestOnly: true }, bytes = json(snapshot), digest = hash(snapshot);
  db.prepare('INSERT INTO actual_live_play_runtimes VALUES(?,?,8,?,?,?,?,?)').run(runtime.sourceId, gameId, pitch, json(runtime), hash(runtime), bytes, digest);
  const candidate = { ...first, sourceId: 'field-race-candidate-0', previousFieldSourceId: first.sourceId };
  for (const [i, source] of [first, candidate].entries()) {
    db.prepare('INSERT INTO batted_world_field_actions VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(source.sourceId, pitch, source.responseSourceId, source.geometrySourceId,
      source.previousFieldSourceId, i + 1, gameId, json(source), hash(source), bytes, digest);
    db.prepare('INSERT INTO actual_live_play_admissions VALUES(?,?,?,?,?,?)').run(runtime.sourceId, i + 1, 'batted_world_field_actions', source.sourceId, hash(source), digest);
  }
  db.prepare('INSERT INTO batted_world_field_heads VALUES(?,?,?,?,2)').run(pitch, first.responseSourceId, first.geometrySourceId, candidate.sourceId);
  const acquisition = { sourceId: 'field-race-acquisition', sourceVersion: 'fixture-v1', baseFieldSourceId: candidate.sourceId, previousExecutionSourceId: null,
    action: { kind: 'owned_acquisition_plan_v1', knownWork: players.map(playerId => ({ playerId, decisionSourceId: null, motorSourceId: null })) } };
  db.prepare('INSERT INTO batted_world_field_executions VALUES(?,?,?,NULL,1,?,?,?,?,?)').run(acquisition.sourceId, pitch, candidate.sourceId,
    gameId, json(acquisition), hash(acquisition), bytes, digest);
  db.prepare('INSERT INTO batted_world_field_execution_heads VALUES(?,?,?,1)').run(pitch, candidate.sourceId, acquisition.sourceId);
  db.prepare('INSERT INTO actual_live_play_admissions VALUES(?,3,?,?,?,?)').run(runtime.sourceId, 'batted_world_field_executions', acquisition.sourceId, hash(acquisition), digest);
  return { db, first };
};
it('admits only the complete acquisition metadata prefix and unchanged helper Sources without writes', () => {
  const { db, first } = acquisitionCut(); try { const before = rows(db), changes = db.prepare('SELECT total_changes() AS n').get();
    expect(assertNationalBattedFoulRetainedBindingFrontier(db)).toBe(gameId);
    expect(() => assertNationalBattedFoulRetainedAcquisitionSources(db, first)).not.toThrow();
    expect(rows(db)).toEqual(before); expect(db.prepare('SELECT total_changes() AS n').get()).toEqual(changes);
  } finally { db.close(); }
});
it.each([
  ['missing runtime admission', 'DELETE FROM actual_live_play_admissions WHERE sequence=2'],
  ['wrong admitted snapshot', "UPDATE actual_live_play_admissions SET snapshot_hash='other' WHERE sequence=3"],
  ['wrong execution head', "UPDATE batted_world_field_execution_heads SET source_id='field-race-capture-initialized'"],
  ['extra initialized execution', "INSERT INTO batted_world_field_executions(source_id,physical_pitch_source_id,revision) VALUES('field-race-capture-initialized','national-live:pitch-0',2)"],
  ['foreign ground owner', "UPDATE batted_world_field_actions SET physical_pitch_source_id='foreign' WHERE source_id='national-live:field'"],
  ['changed archived bytes', "UPDATE batted_world_field_executions SET snapshot_json='{}' WHERE source_id='field-race-acquisition'"],
])('rejects malformed acquisition metadata: %s', (_label, mutation) => {
  const { db } = acquisitionCut(); try { db.exec(mutation); const before = rows(db);
    expect(() => assertNationalBattedFoulRetainedBindingFrontier(db)).toThrow(); expect(rows(db)).toEqual(before);
  } finally { db.close(); }
});
it.each([
  ['runtime capability', "UPDATE actual_live_play_runtimes SET source_json=json_set(source_json,'$.capability','other') WHERE source_id='live-play-runtime'"],
  ['field clock', "UPDATE batted_world_field_actions SET source_json=json_set(source_json,'$.throughTick',2123457) WHERE source_id='national-live:field'"],
  ['candidate predecessor', "UPDATE batted_world_field_actions SET source_json=json_set(source_json,'$.previousFieldSourceId','foreign') WHERE source_id='field-race-candidate-0'"],
  ['acquisition work', "UPDATE batted_world_field_executions SET source_json=json_set(source_json,'$.action.knownWork[0].motorSourceId','later') WHERE source_id='field-race-acquisition'"],
])('compares retained proposals with the original helper recipe: %s', (_label, mutation) => {
  const { db, first } = acquisitionCut(); try { db.exec(mutation); const before = rows(db);
    expect(() => assertNationalBattedFoulRetainedAcquisitionSources(db, first)).toThrow(); expect(rows(db)).toEqual(before);
  } finally { db.close(); }
});

const feetCut = () => {
  const { db, first } = acquisitionCut(), pitch = 'national-live:pitch-0';
  const ids = ['field-race-acquisition', 'field-race-capture-initialized', 'field-race-capture-fence', 'field-race-capture-confirmed', 'field-race-feet'];
  for (let i = 1; i < ids.length; i++) {
    const source = { sourceId: ids[i], sourceVersion: 'fixture-v1', baseFieldSourceId: 'field-race-candidate-0', previousExecutionSourceId: ids[i - 1],
      action: { metadataTestOnly: true } };
    const snapshot = { metadataTestOnly: true, revision: i + 1 };
    db.prepare('INSERT INTO batted_world_field_executions VALUES(?,?,?,?,?,?,?,?,?,?)').run(ids[i], pitch, source.baseFieldSourceId, source.previousExecutionSourceId,
      i + 1, gameId, json(source), hash(source), json(snapshot), hash(snapshot));
    db.prepare('INSERT INTO actual_live_play_admissions VALUES(?,?,?,?,?,?)').run('live-play-runtime', i + 3, 'batted_world_field_executions', ids[i], hash(source), hash(snapshot));
  }
  db.exec("UPDATE batted_world_field_execution_heads SET source_id='field-race-feet',revision=5");
  db.exec(`CREATE TABLE world_player_fielding_models(source_id TEXT); INSERT INTO world_player_fielding_models VALUES('observation-fielding-p1');
    CREATE TABLE world_player_observation_models(source_id TEXT); INSERT INTO world_player_observation_models VALUES('actual-observation-model-p1');
    CREATE TABLE actual_field_observations(source_id TEXT); CREATE TABLE actual_field_observation_heads(source_id TEXT);`);
  return { db, first };
};
it('admits exactly the feet metadata cut before observation without claiming its rows as physical proof', () => {
  const { db, first } = feetCut(); try { const before = rows(db), changes = db.prepare('SELECT total_changes() AS n').get();
    expect(assertNationalBattedFoulRetainedBindingFrontier(db)).toBe(gameId);
    expect(() => assertNationalBattedFoulRetainedAcquisitionSources(db, first)).not.toThrow();
    expect(rows(db)).toEqual(before); expect(db.prepare('SELECT total_changes() AS n').get()).toEqual(changes);
  } finally { db.close(); }
});
it.each([
  ['missing capture predecessor', "DELETE FROM batted_world_field_executions WHERE source_id='field-race-capture-fence'"],
  ['wrong feet head', 'UPDATE batted_world_field_execution_heads SET revision=4'],
  ['observation already admitted', "INSERT INTO actual_field_observations VALUES('actual-observation-p1-1')"],
  ['different observation model', "UPDATE world_player_observation_models SET source_id='different'"],
  ['later motor work', "CREATE TABLE actual_locomotion_receipts(source_id TEXT); INSERT INTO actual_locomotion_receipts VALUES('scheduled-motor-p1')"],
])('rejects unsupported feet metadata: %s', (_label, mutation) => {
  const { db } = feetCut(); try { db.exec(mutation); const before = rows(db);
    expect(() => assertNationalBattedFoulRetainedBindingFrontier(db)).toThrow(); expect(rows(db)).toEqual(before);
  } finally { db.close(); }
});


const decisionModelCut = () => {
  const { db, first } = feetCut(), pitch = 'national-live:pitch-0';
  db.exec(`DROP TABLE actual_field_observations; DROP TABLE actual_field_observation_heads;
    CREATE TABLE actual_field_observations(source_id TEXT,physical_pitch_source_id TEXT,player_id TEXT,base_field_source_id TEXT,execution_source_id TEXT,
      observation_model_source_id TEXT,previous_source_id TEXT,revision INTEGER,source_json TEXT,source_hash TEXT,snapshot_json TEXT,snapshot_hash TEXT);
    CREATE TABLE actual_field_observation_heads(physical_pitch_source_id TEXT,player_id TEXT,source_id TEXT,revision INTEGER);
    CREATE TABLE world_player_decision_models(source_id TEXT,source_version TEXT,career_id TEXT,player_id TEXT,person_link_source_id TEXT,
      fielding_model_source_id TEXT,accepted_at_day INTEGER,source_json TEXT,source_hash TEXT,snapshot_json TEXT,snapshot_hash TEXT);`);
  const observation = { sourceId: 'actual-observation-p1-1', sourceVersion: 'synthetic-v1', physicalPitchSourceId: pitch, playerId: 'p1',
    baseFieldSourceId: 'field-race-candidate-0', executionSourceId: 'field-race-feet', observationModelSourceId: 'actual-observation-model-p1',
    previousObservationSourceId: null, view: { poseVersion: 'synthetic-body-translation-world-axes-v1', bodyRelativeEyeOffset: { x: 0, y: 3, z: 0 },
      forward: { x: 0, y: 0, z: 1 }, attentionTarget: { kind: 'ball' } } };
  const model = { sourceId: 'scheduled-decision-model-p1', sourceVersion: 'synthetic-v1', careerId: 'career-a', playerId: 'p1',
    personLinkSourceId: 'link-1', fieldingModelSourceId: 'observation-fielding-p1', acceptedAtDay: 121, calibration: { metadataTestOnly: true } };
  const snapshot = { metadataTestOnly: true };
  db.prepare('INSERT INTO actual_field_observations VALUES(?,?,?,?,?,?,NULL,1,?,?,?,?)').run(observation.sourceId, pitch, 'p1',
    observation.baseFieldSourceId, observation.executionSourceId, observation.observationModelSourceId, json(observation), hash(observation), json(snapshot), hash(snapshot));
  db.prepare('INSERT INTO actual_field_observation_heads VALUES(?,?,?,1)').run(pitch, 'p1', observation.sourceId);
  db.prepare('INSERT INTO actual_live_play_admissions VALUES(?,8,?,?,?,?)').run('live-play-runtime', 'actual_field_observations', observation.sourceId, hash(observation), hash(snapshot));
  db.prepare('INSERT INTO world_player_decision_models VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(model.sourceId, model.sourceVersion, model.careerId, model.playerId,
    model.personLinkSourceId, model.fieldingModelSourceId, model.acceptedAtDay, json(model), hash(model), json(snapshot), hash(snapshot));
  return { db, first };
};
it.each([false, true])('admits exact observation and decision-model metadata before the first plan, preserving rows (empty plan schema: %s)', emptyPlan => {
  const { db, first } = decisionModelCut(); try {
    if (emptyPlan) db.exec('CREATE TABLE actual_defensive_plans(source_id TEXT)');
    const before = rows(db), changes = db.prepare('SELECT total_changes() AS n').get();
    expect(assertNationalBattedFoulRetainedBindingFrontier(db)).toBe(gameId);
    expect(() => assertNationalBattedFoulRetainedAcquisitionSources(db, first)).not.toThrow();
    expect(rows(db)).toEqual(before); expect(db.prepare('SELECT total_changes() AS n').get()).toEqual(changes);
  } finally { db.close(); }
});
it.each([
  ['wrong observation execution', "UPDATE actual_field_observations SET execution_source_id='field-race-capture-confirmed'"],
  ['wrong observation player', "UPDATE actual_field_observations SET player_id='p2'"],
  ['wrong observation head', "UPDATE actual_field_observation_heads SET revision=2"],
  ['missing observation admission', 'DELETE FROM actual_live_play_admissions WHERE sequence=8'],
  ['wrong observation archive hash', "UPDATE actual_field_observations SET snapshot_hash='changed'"],
  ['missing decision model', 'DELETE FROM world_player_decision_models'],
  ['wrong model player', "UPDATE world_player_decision_models SET player_id='p2'"],
  ['changed model archive', "UPDATE world_player_decision_models SET source_json='{}'"],
  ['already committed plan', "CREATE TABLE actual_defensive_plans(source_id TEXT); INSERT INTO actual_defensive_plans VALUES('scheduled-priorities-p1')"],
  ['already committed decision', "CREATE TABLE actual_defensive_decisions(source_id TEXT); INSERT INTO actual_defensive_decisions VALUES('scheduled-decision-p1')"],
  ['already accepted motor model', "CREATE TABLE world_player_locomotion_models(source_id TEXT); INSERT INTO world_player_locomotion_models VALUES('scheduled-locomotion-model-p1')"],
])('rejects unsupported observation and model metadata: %s', (_label, mutation) => {
  const { db } = decisionModelCut(); try { db.exec(mutation); const before = rows(db);
    expect(() => assertNationalBattedFoulRetainedBindingFrontier(db)).toThrow(); expect(rows(db)).toEqual(before);
  } finally { db.close(); }
});


const motorModelCut = () => {
  const { db, first } = decisionModelCut(), pitch = 'national-live:pitch-0';
  db.exec(`CREATE TABLE actual_defensive_plans(source_id TEXT,source_version TEXT,physical_pitch_source_id TEXT,career_id TEXT,player_id TEXT,
    person_link_source_id TEXT,fielding_model_source_id TEXT,game_day INTEGER,observation_source_id TEXT,source_json TEXT,source_hash TEXT,snapshot_json TEXT,snapshot_hash TEXT);
    CREATE TABLE actual_defensive_decisions(source_id TEXT,source_version TEXT,physical_pitch_source_id TEXT,player_id TEXT,observation_source_id TEXT,
    decision_model_source_id TEXT,plan_source_id TEXT,previous_source_id TEXT,revision INTEGER,source_json TEXT,source_hash TEXT,snapshot_json TEXT,snapshot_hash TEXT);
    CREATE TABLE actual_defensive_decision_heads(physical_pitch_source_id TEXT,player_id TEXT,source_id TEXT,revision INTEGER);
    CREATE TABLE world_player_locomotion_models(source_id TEXT,source_version TEXT,capability TEXT,career_id TEXT,player_id TEXT,person_link_source_id TEXT,
    fielding_model_source_id TEXT,accepted_at_day INTEGER,source_json TEXT,source_hash TEXT,snapshot_json TEXT,snapshot_hash TEXT);`);
  const plan = { sourceId: 'scheduled-priorities-p1', sourceVersion: 'synthetic-v1', physicalPitchSourceId: pitch, careerId: 'career-a', playerId: 'p1',
    personLinkSourceId: 'link-1', fieldingModelSourceId: 'observation-fielding-p1', gameDay: 121, observationSourceId: 'actual-observation-p1-1' };
  const decision = { sourceId: 'scheduled-decision-p1', sourceVersion: 'synthetic-v1', physicalPitchSourceId: pitch, playerId: 'p1',
    observationSourceId: plan.observationSourceId, decisionModelSourceId: 'scheduled-decision-model-p1', planSourceId: plan.sourceId, previousDecisionSourceId: null };
  const model = { sourceId: 'scheduled-locomotion-model-p1', sourceVersion: 'synthetic-v1', capability: 'defender_locomotion_v1', careerId: 'career-a',
    playerId: 'p1', personLinkSourceId: 'link-1', fieldingModelSourceId: 'observation-fielding-p1', acceptedAtDay: 121 };
  const snapshot = { metadataTestOnly: true };
  db.prepare('INSERT INTO actual_defensive_plans VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(plan.sourceId, plan.sourceVersion, pitch, plan.careerId, plan.playerId,
    plan.personLinkSourceId, plan.fieldingModelSourceId, plan.gameDay, plan.observationSourceId, json(plan), hash(plan), json(snapshot), hash(snapshot));
  db.prepare('INSERT INTO actual_defensive_decisions VALUES(?,?,?,?,?,?,?,NULL,1,?,?,?,?)').run(decision.sourceId, decision.sourceVersion, pitch, decision.playerId,
    decision.observationSourceId, decision.decisionModelSourceId, decision.planSourceId, json(decision), hash(decision), json(snapshot), hash(snapshot));
  db.prepare('INSERT INTO actual_defensive_decision_heads VALUES(?,?,?,1)').run(pitch, 'p1', decision.sourceId);
  db.prepare('INSERT INTO world_player_locomotion_models VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(model.sourceId, model.sourceVersion, model.capability,
    model.careerId, model.playerId, model.personLinkSourceId, model.fieldingModelSourceId, model.acceptedAtDay, json(model), hash(model), json(snapshot), hash(snapshot));
  for (const [i, [owner, source]] of [['actual_defensive_plans', plan], ['actual_defensive_decisions', decision]].entries())
    db.prepare('INSERT INTO actual_live_play_admissions VALUES(?,?,?,?,?,?)').run('live-play-runtime', i + 9, owner as string,
      (source as typeof plan).sourceId, hash(source), hash(snapshot));
  return { db, first };
};
it.each([false, true])('admits exactly the returned plan/decision/locomotion-model cut with the original acquisition census (empty motor schema: %s)', emptyMotor => {
  const { db, first } = motorModelCut(); try {
    if (emptyMotor) db.exec('CREATE TABLE actual_locomotion_receipts(source_id TEXT); CREATE TABLE actual_locomotion_heads(source_id TEXT)');
    const before = rows(db), changes = db.prepare('SELECT total_changes() AS n').get();
    expect(assertNationalBattedFoulRetainedBindingFrontier(db)).toBe(gameId);
    expect(() => assertNationalBattedFoulRetainedAcquisitionSources(db, first)).not.toThrow();
    expect(rows(db)).toEqual(before); expect(db.prepare('SELECT total_changes() AS n').get()).toEqual(changes);
  } finally { db.close(); }
});
it.each([
  ['missing original plan', 'DELETE FROM actual_defensive_plans'],
  ['wrong plan observation', "UPDATE actual_defensive_plans SET observation_source_id='foreign'"],
  ['wrong decision predecessor', "UPDATE actual_defensive_decisions SET previous_source_id='foreign'"],
  ['wrong decision head', 'UPDATE actual_defensive_decision_heads SET revision=2'],
  ['missing decision admission', 'DELETE FROM actual_live_play_admissions WHERE sequence=10'],
  ['changed plan archive', "UPDATE actual_defensive_plans SET snapshot_json='{}'"],
  ['changed motor model archive', "UPDATE world_player_locomotion_models SET source_hash='other'"],
  ['wrong motor model capability', "UPDATE world_player_locomotion_models SET capability='other'"],
  ['missing motor model', 'DELETE FROM world_player_locomotion_models'],
  ['already committed motor receipt', "CREATE TABLE actual_locomotion_receipts(source_id TEXT); INSERT INTO actual_locomotion_receipts VALUES('scheduled-motor-p1')"],
  ['already committed motor head', "CREATE TABLE actual_locomotion_heads(source_id TEXT); INSERT INTO actual_locomotion_heads VALUES('scheduled-motor-p1')"],
])('rejects unsupported retained motor boundary: %s', (_label, mutation) => {
  const { db } = motorModelCut(); try { db.exec(mutation); const before = rows(db);
    expect(() => assertNationalBattedFoulRetainedBindingFrontier(db)).toThrow(); expect(rows(db)).toEqual(before);
  } finally { db.close(); }
});

it('uses authenticated historical acquisition work while new operations keep current decision discovery', () => {
  const players = ['p0', 'p1'], original = players.map(playerId => ({ playerId, decisionSourceId: null, motorSourceId: null }));
  const saved: AcceptedBattedWorldFieldExecution = { sourceId: 'field-race-acquisition', sourceVersion: 'fixture-v1',
    baseFieldSourceId: 'field-race-candidate-0', previousExecutionSourceId: null, action: { kind: 'owned_acquisition_plan_v1', knownWork: original } };
  const later = [{ playerId: 'p0', decisionSourceId: null, motorSourceId: null },
    { playerId: 'p1', decisionSourceId: 'scheduled-decision-p1', motorSourceId: 'scheduled-motor-p1' }];
  let calls = 0; const current = () => { calls++; return later; };
  expect(firstBaseFixtureKnownWork(players, saved, current)).toBe(original); expect(calls).toBe(0);
  expect(firstBaseFixtureKnownWork(players, undefined, current)).toBe(later); expect(calls).toBe(1);
  expect(() => firstBaseFixtureKnownWork(players, { ...saved, action: { kind: 'owned_acquisition_plan_v1', knownWork: later } }, current)).toThrow(/pre-decision work/);
  expect(calls).toBe(1); expect(saved.action).toEqual({ kind: 'owned_acquisition_plan_v1', knownWork: original });
});

it('keeps current work rejection for an earlier acquisition cut with unsupported later owners', () => {
  const { db, first } = acquisitionCut(); try {
    db.exec("CREATE TABLE actual_defensive_decisions(source_id TEXT); INSERT INTO actual_defensive_decisions VALUES('scheduled-decision-p1')");
    const before = rows(db);
    expect(() => assertNationalBattedFoulRetainedAcquisitionSources(db, first)).toThrow(); expect(rows(db)).toEqual(before);
  } finally { db.close(); }
});
