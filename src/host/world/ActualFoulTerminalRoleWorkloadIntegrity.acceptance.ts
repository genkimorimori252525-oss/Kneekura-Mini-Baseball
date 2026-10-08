import { expect, it } from 'vitest';
import { prepareTerminalWorkloadReadyCopy } from './ActualFoulTerminalRoleWorkloadCheckpoint.test-support';
import { rawCensus, schemaCensus } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { foulTerminalApplicationEvidenceFromSqlite } from './ActualFoulTerminalApplicationEvidenceFromSqlite';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import { prepareTerminalWorkloadCopy, requireTerminalWorkload, acceptedTerminalWorkloadFixturePacket,
  assertFrozenParticipants, cleanupTerminalWorkload, type TerminalWorkloadStore,
  type AcceptedTerminalWorkloadAssessment } from './ActualFoulTerminalRoleWorkloadFixture.test-support';

// Regression target: accepting effort solely from a player ID or E reference,
// without binding the original terminal, acknowledgement and complete pitch work.
for (const fault of ['terminal', 'acknowledgement', 'receipt', 'end_kind', 'whole_history', 'prefix_empty', 'prefix_duplicate',
  'prefix_hash', 'participant', 'person', 'missing_effort', 'negative_effort', 'extra_fatigue'] as const)
it(`W05 rejects accepted fixture assessment with mismatched ${fault} before persistence`, async () => {
  const f = prepareTerminalWorkloadCopy();
  let store: TerminalWorkloadStore | undefined;
  try {
    const api = await requireTerminalWorkload(), packet = acceptedTerminalWorkloadFixturePacket(f);
    const [id, accepted] = [...packet.assessments][0];
    let source: unknown = structuredClone(accepted);
    const changed = source as AcceptedTerminalWorkloadAssessment;
    if (fault === 'terminal') source = { ...changed, terminalReference: { ...changed.terminalReference, sourceId: 'foreign-terminal' } };
    if (fault === 'acknowledgement') source = { ...changed, terminalReference: { ...changed.terminalReference, acknowledgementHash: 'f'.repeat(64) } };
    if (fault === 'receipt') source = { ...changed, terminalReference: { ...changed.terminalReference, officialReceiptHash: 'f'.repeat(64) } };
    if (fault === 'end_kind') source = { ...changed, physicalEndReference: { ...changed.physicalEndReference, owner: 'actual_first_base_play_ends' } };
    if (fault === 'whole_history') source = { ...changed, wholeHistoryReference: { ...changed.wholeHistoryReference, hash: 'f'.repeat(64) } };
    if (fault === 'prefix_empty') source = { ...changed, originalPhysicalPitchPrefix: [] };
    if (fault === 'prefix_duplicate') source = { ...changed, originalPhysicalPitchPrefix: [...changed.originalPhysicalPitchPrefix, changed.originalPhysicalPitchPrefix[0]] };
    if (fault === 'prefix_hash') source = { ...changed, originalPhysicalPitchPrefix: changed.originalPhysicalPitchPrefix.map((p, i) => i === 0 ? { ...p, sourceHash: 'f'.repeat(64) } : p) };
    if (fault === 'participant') source = { ...changed, participantReference: { ...changed.participantReference, playerId: 'next-lineup-player' } };
    if (fault === 'person') source = { ...changed, participantReference: { ...changed.participantReference, personHash: 'f'.repeat(64) } };
    if (fault === 'missing_effort') { const { effortUnits: _effort, ...without } = changed; source = without; }
    if (fault === 'negative_effort') source = { ...changed, effortUnits: -1 };
    if (fault === 'extra_fatigue') source = { ...changed, fatigue: 0 };
    packet.assessments.set(id, source as AcceptedTerminalWorkloadAssessment);
    store = api.open(f.path, f.links, packet.authority);
    const before = rawCensus(f.db), schema = schemaCensus(f.db);
    expect(() => store!.acceptAssessment(id)).toThrow();
    expect(rawCensus(f.db)).toEqual(before); expect(schemaCensus(f.db)).toEqual(schema);
  } finally { cleanupTerminalWorkload(f, store); }
}, 2_400_000);

// Regression target: a terminal consumer that omits the reverse legacy-pitch
// charge guard. The corruption lives only in the competing producer metadata;
// original terminal evidence and the global workload chain still authenticate.
for (const phase of ['accept', 'freeze', 'charge', 'read', 'retry'] as const)
it(`W06 terminal ${phase} rejects a surviving competing legacy pitch charge`, async () => {
  const f = phase === 'accept' ? prepareTerminalWorkloadCopy() : await prepareTerminalWorkloadReadyCopy();
  let store: TerminalWorkloadStore | undefined;
  try {
    const api = await requireTerminalWorkload(), packet = acceptedTerminalWorkloadFixturePacket(f);
    store = api.open(f.path, f.links, packet.authority);
    // Acceptance stays unprepared; later operations use the qualified ready copy.
    if (phase === 'charge' || phase === 'read' || phase === 'retry') store.freeze(f.sourceId);
    if (phase === 'retry') expect(store.settle(f.sourceId).kind).toBe('complete');
    const pitcher = f.actors.find(actor => actor.registeredPosition === 'P');
    expect(pitcher, 'GENUINE_ORIGINAL_PITCHER_MISSING').toBeDefined();
    if (!pitcher) throw new Error('GENUINE_ORIGINAL_PITCHER_MISSING');
    f.db.exec(`CREATE TABLE IF NOT EXISTS official_pitch_workload_sources (
      source_id TEXT PRIMARY KEY, career_id TEXT NOT NULL, player_id TEXT NOT NULL, game_id TEXT NOT NULL,
      played_play_id INTEGER NOT NULL CHECK(played_play_id >= 0), scoring_application_id TEXT NOT NULL UNIQUE,
      policy_source_id TEXT NOT NULL, request_json TEXT NOT NULL, source_json TEXT NOT NULL, proof_json TEXT NOT NULL,
      UNIQUE(career_id, game_id, played_play_id, player_id))`);
    const baselineState = withSqliteReadTransaction(f.db, () => readActualRoleWorkloadState(f.db,
      f.reference.careerId, pitcher.binding.playerId, undefined, pitcher.binding.personLinkSourceId));
    f.db.prepare('INSERT INTO official_pitch_workload_sources VALUES(?,?,?,?,?,?,?,?,?,?)').run('fault-legacy-pitch-claim',
      f.reference.careerId, pitcher.binding.playerId, f.reference.gameId, f.reference.playId,
      'fault-legacy-scoring-claim', 'fault-unaccepted-policy', '{}', '{}', '{invalid');
    withSqliteReadTransaction(f.db, () => {
      expect(foulTerminalApplicationEvidenceFromSqlite(f.db).read(f.sourceId)).toEqual(f.saved);
      expect(readActualRoleWorkloadState(f.db, f.reference.careerId, pitcher.binding.playerId,
        undefined, pitcher.binding.personLinkSourceId)).toEqual(baselineState);
    });
    const before = rawCensus(f.db), schema = schemaCensus(f.db);
    const action = phase === 'accept' ? () => store!.acceptAssessments([...packet.assessments.keys()])
      : phase === 'freeze' ? () => store!.freeze(f.sourceId)
        : phase === 'read' ? () => store!.readSettlement(f.sourceId) : () => store!.settle(f.sourceId);
    expect(action).toThrow(/legacy.*workload.*charge/);
    expect(rawCensus(f.db)).toEqual(before); expect(schemaCensus(f.db)).toEqual(schema);
  } finally { cleanupTerminalWorkload(f, store); }
}, 2_400_000);

for (const fault of ['pitch', 'count', 'end', 'journal', 'acknowledgement', 'application', 'match'] as const)
it(`W05 damaged genuine ${fault} remains a blocker after a workload handle was opened`, async () => {
  const f = prepareTerminalWorkloadCopy();
  let store: TerminalWorkloadStore | undefined;
  try {
    const api = await requireTerminalWorkload(), p = f.saved.proposal;
    store = api.open(f.path, f.links);
    const [table, column, key, value] = fault === 'pitch'
      ? ['physical_pitch_progress_actions', 'snapshot_hash', 'source_id', p.physicalPitchSourceId]
      : fault === 'count' ? ['actual_foul_rule_consumptions', 'snapshot_hash', 'source_id', p.consumptionReference.sourceId]
      : fault === 'end' ? ['actual_foul_play_ends', 'snapshot_hash', 'source_id', p.physicalEndReference.sourceId]
      : fault === 'journal' ? ['actual_foul_official_events', 'source_hash', 'source_id', p.officialReference.headSourceId]
      : fault === 'acknowledgement' ? ['actual_foul_terminal_applications', 'result_json', 'source_id', f.sourceId]
      : fault === 'application' ? ['applications', 'request_hash', 'application_id', p.source.applicationId]
      : ['matches', 'activation_json', 'match_id', p.gameId];
    const mutation = f.db.prepare('UPDATE ' + table + ' SET ' + column + '=? WHERE ' + key + '=?')
      .run('corrupt-terminal-workload-prerequisite', value);
    expect(mutation.changes).toBe(1);
    const before = rawCensus(f.db), schema = schemaCensus(f.db);
    expect(() => store!.readSettlement(f.sourceId)).toThrow();
    expect(() => store!.freeze(f.sourceId)).toThrow(); expect(() => store!.settle(f.sourceId)).toThrow();
    expect(rawCensus(f.db)).toEqual(before); expect(schemaCensus(f.db)).toEqual(schema);
  } finally { cleanupTerminalWorkload(f, store); }
}, 2_400_000);

it('W05 an uncharged participant changed after freeze prevents the first global charge', async () => {
  const f = await prepareTerminalWorkloadReadyCopy();
  let store: TerminalWorkloadStore | undefined;
  try {
    const api = await requireTerminalWorkload(), packet = acceptedTerminalWorkloadFixturePacket(f);
    store = api.open(f.path, f.links, packet.authority);
    const frozen = assertFrozenParticipants(f, store.freeze(f.sourceId), packet);
    expect(frozen.kind).toBe('applying');
    f.db.prepare('UPDATE world_player_workload_heads SET revision=revision+1 WHERE career_id=? AND player_id=?')
      .run(f.reference.careerId, frozen.participants[9].playerId);
    const before = rawCensus(f.db), schema = schemaCensus(f.db);
    expect(() => store!.settle(f.sourceId)).toThrow();
    expect(rawCensus(f.db)).toEqual(before); expect(schemaCensus(f.db)).toEqual(schema);
  } finally { cleanupTerminalWorkload(f, store); }
}, 2_400_000);

for (const damage of ['missing', 'changed_hash'] as const)
it(`W05 frozen assessment ${damage} blocks replay and charging`, async () => {
  const f = await prepareTerminalWorkloadReadyCopy();
  let store: TerminalWorkloadStore | undefined;
  try {
    const api = await requireTerminalWorkload(), packet = acceptedTerminalWorkloadFixturePacket(f);
    store = api.open(f.path, f.links, packet.authority);
    const frozen = assertFrozenParticipants(f, store.freeze(f.sourceId), packet);
    const assessmentId = frozen.participants[9].assessmentSourceId;
    const result = damage === 'missing'
      ? f.db.prepare('DELETE FROM actual_role_workload_assessments WHERE source_id=?').run(assessmentId)
      : f.db.prepare("UPDATE actual_role_workload_assessments SET snapshot_hash='changed-after-freeze' WHERE source_id=?").run(assessmentId);
    expect(result.changes).toBe(1);
    const before = rawCensus(f.db), schema = schemaCensus(f.db);
    expect(() => store!.readSettlement(f.sourceId)).toThrow(); expect(() => store!.settle(f.sourceId)).toThrow();
    expect(rawCensus(f.db)).toEqual(before); expect(schemaCensus(f.db)).toEqual(schema);
    store.close(); store = api.open(f.path, f.links);
    expect(() => store!.readSettlement(f.sourceId)).toThrow(); expect(() => store!.settle(f.sourceId)).toThrow();
    expect(rawCensus(f.db)).toEqual(before); expect(schemaCensus(f.db)).toEqual(schema);
  } finally { cleanupTerminalWorkload(f, store); }
}, 2_400_000);
