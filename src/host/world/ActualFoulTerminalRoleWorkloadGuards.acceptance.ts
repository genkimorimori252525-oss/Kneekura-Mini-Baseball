import { expect, it } from 'vitest';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { rawCensus, schemaCensus } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import { openSqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';
import { prepareTerminalWorkloadCopy, requireTerminalWorkload, acceptedTerminalWorkloadFixturePacket,
  expectedActivity, cleanupTerminalWorkload, type TerminalWorkloadStore } from './ActualFoulTerminalRoleWorkloadFixture.test-support';

it('W08 assessment acceptance authenticates every existing original participant head before writing', async () => {
  const f = prepareTerminalWorkloadCopy(); let store: TerminalWorkloadStore | undefined;
  try {
    const api = await requireTerminalWorkload(), packet = acceptedTerminalWorkloadFixturePacket(f);
    store = api.open(f.path, f.links, packet.authority);
    const row = f.db.prepare('SELECT * FROM world_player_workload_heads WHERE career_id=? ORDER BY player_id').all(f.reference.careerId)
      .find(row => f.actors.some(actor => actor.binding.playerId === row.player_id));
    expect(row, 'GENUINE_EXISTING_PARTICIPANT_HEAD_MISSING').toBeDefined();
    if (!row) throw new Error('GENUINE_EXISTING_PARTICIPANT_HEAD_MISSING');
    expect(f.db.prepare('UPDATE world_player_workload_heads SET revision=revision+1 WHERE career_id=? AND player_id=?')
      .run(f.reference.careerId, row.player_id).changes).toBe(1);
    const before = rawCensus(f.db), schema = schemaCensus(f.db);
    expect(() => store!.acceptAssessments([...packet.assessments.keys()])).toThrow();
    expect(rawCensus(f.db)).toEqual(before); expect(schemaCensus(f.db)).toEqual(schema);
  } finally { cleanupTerminalWorkload(f, store); }
}, 2_400_000);

it('W08 assessment retry authenticates an existing claimed frozen settlement before returning', async () => {
  const f = prepareTerminalWorkloadCopy(); let store: TerminalWorkloadStore | undefined;
  try {
    const api = await requireTerminalWorkload(), packet = acceptedTerminalWorkloadFixturePacket(f);
    store = api.open(f.path, f.links, packet.authority);
    store.acceptAssessments([...packet.assessments.keys()]);
    // Deliberately damaged durable claim. A zero-write assessment retry must
    // authenticate this row rather than skip it merely because inputs exist.
    f.db.prepare('INSERT INTO actual_role_workload_settlements VALUES(?,?,?,?,?,?)')
      .run(f.sourceId, f.reference.careerId, f.reference.gameId, f.reference.playId, '{}', hash({}));
    const before = rawCensus(f.db), schema = schemaCensus(f.db);
    expect(() => store!.acceptAssessments([...packet.assessments.keys()])).toThrow();
    expect(rawCensus(f.db)).toEqual(before); expect(schemaCensus(f.db)).toEqual(schema);
  } finally { cleanupTerminalWorkload(f, store); }
}, 2_400_000);

it('W08 missing canonical settlement cannot hide a surviving original end claim under moved aliases', async () => {
  const f = prepareTerminalWorkloadCopy(); let store: TerminalWorkloadStore | undefined;
  try {
    const api = await requireTerminalWorkload(); store = api.open(f.path, f.links);
    const moved = { ...f.reference, terminalSourceId: 'moved-terminal', terminalReference: { ...f.reference.terminalReference, sourceId: 'moved-terminal' },
      careerId: 'moved-career', gameId: 'moved-game', playId: 999999, kind: 'frozen', capturedAt: 'settlement_freeze', participants: [], assessmentHashes: [] };
    f.db.prepare('INSERT INTO actual_role_workload_settlements VALUES(?,?,?,?,?,?)')
      .run('moved-terminal', 'moved-career', 'moved-game', 999999, json(moved), hash(moved));
    const before = rawCensus(f.db), schema = schemaCensus(f.db);
    expect(() => store!.readSettlement(f.sourceId)).toThrow();
    expect(() => store!.freeze(f.sourceId)).toThrow(); expect(() => store!.settle(f.sourceId)).toThrow();
    expect(rawCensus(f.db)).toEqual(before); expect(schemaCensus(f.db)).toEqual(schema);
  } finally { cleanupTerminalWorkload(f, store); }
}, 2_400_000);

it('W08 renamed original TOTAL activity remains an orphan charge without its settlement', async () => {
  const f = prepareTerminalWorkloadCopy(); let store: TerminalWorkloadStore | undefined;
  try {
    const api = await requireTerminalWorkload(), packet = acceptedTerminalWorkloadFixturePacket(f);
    const source = [...packet.assessments.values()].find(source => withSqliteReadTransaction(f.db, () =>
      readActualRoleWorkloadState(f.db, f.reference.careerId, source.participantReference.playerId)) !== null);
    expect(source, 'GENUINE_EXISTING_PARTICIPANT_BASELINE_MISSING').toBeDefined();
    if (!source) throw new Error('GENUINE_EXISTING_PARTICIPANT_BASELINE_MISSING');
    const activity = expectedActivity(f, source);
    const beforeState = withSqliteReadTransaction(f.db, () => readActualRoleWorkloadState(f.db, f.reference.careerId, activity.playerId))!;
    // Real global workload writer, independently accepted fixture TOTAL and
    // genuine original E/participant. Deliberately omit its terminal settlement.
    const global = openSqlitePlayerWorkloadRecoveryStore(f.path, f.links, {
      readAcceptedBaseline: () => null, readAcceptedActivity: id => id === activity.sourceEventId ? activity : null,
    });
    const afterState = global.apply(activity.sourceEventId, beforeState.revision); global.close();
    const renamed = { ...activity, sourceEventId: 'renamed-original-total-activity' };
    expect(f.db.prepare('UPDATE world_player_workload_activities SET source_id=?,source_json=? WHERE source_id=?')
      .run(renamed.sourceEventId, json(renamed), activity.sourceEventId).changes).toBe(1);
    expect(withSqliteReadTransaction(f.db, () => readActualRoleWorkloadState(f.db, f.reference.careerId, activity.playerId))).toEqual(afterState);
    store = api.open(f.path, f.links, packet.authority);
    const before = rawCensus(f.db), schema = schemaCensus(f.db);
    expect(() => store!.readSettlement(f.sourceId)).toThrow();
    expect(() => store!.freeze(f.sourceId)).toThrow(); expect(() => store!.settle(f.sourceId)).toThrow();
    expect(rawCensus(f.db)).toEqual(before); expect(schemaCensus(f.db)).toEqual(schema);
  } finally { cleanupTerminalWorkload(f, store); }
}, 2_400_000);
