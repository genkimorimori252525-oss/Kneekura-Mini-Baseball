import { createRequire } from 'node:module';
import { appendFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { battingModelStanceFixture } from './NativeBattingModelStanceFixtures.test-support';
import { prepareActorSpinPracticeV127 } from './ActorSpinPracticeV127.test-support';
import { openSqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';
import { actorHash as hash, readPhysicalActorForPlayFromSqlite } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { readSamePaSpinContextV123, type SamePaSpinBindingV123 } from './SamePlateAppearanceSpinBindingV123';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';

/** Pre-enrollment Native Actor/qualification binding only. Every positive proof
 * is from original owners in one persisted database, with all nine defenders.
 * No dispatch/32-calibration, physical commitment, contact or replay of a game
 * is executed or replaced by this test. Negative Actor edits are rejected
 * inputs only: no fabricated Actor/qualification is admitted or stored. */
it('ASB127 binds real pre-game practice to the original Native Actor/model and rejects cross-scope pins before and after complete DB reopen', () => {
  const directory = mkdtempSync(join(tmpdir(), 'actor-spin-binding-v127-'));
  // The existing base fixture chooses its own real persistent file in this
  // directory. Retain it for failure inspection; no donor rows are copied.
  const priorDirectory = process.env.BASEBALL_NATIVE_DATABASE_DIRECTORY;
  let f: ReturnType<typeof battingModelStanceFixture>;
  process.env.BASEBALL_NATIVE_DATABASE_DIRECTORY = directory;
  try { f = battingModelStanceFixture({ modelDay: 1 }); }
  finally {
    if (priorDirectory === undefined) delete process.env.BASEBALL_NATIVE_DATABASE_DIRECTORY;
    else process.env.BASEBALL_NATIVE_DATABASE_DIRECTORY = priorDirectory;
  }
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  let reopened: InstanceType<typeof DatabaseSync> | null = null, originalsClosed = false;
  const stage = (name: string) => {
    if (process.env.BASEBALL_GATE_ERRORS) appendFileSync(process.env.BASEBALL_GATE_ERRORS + '.ASB127-stages.jsonl', JSON.stringify({ name, at: Date.now() }) + '\n');
  };
  try {
    const runtime = f.x.f, { db, path, links, track } = runtime;
    const actor = f.actor, batting = f.modelStore.accept(f.source.sourceId);
    expect(actor.defenderBindings).toHaveLength(9); expect(actor.defenderPersons).toHaveLength(9);
    expect(actor.binding).toMatchObject({ careerId: 'career-a', playerId: 'away-1', personLinkSourceId: 'intake-away-1', gameDay: 10 });
    for (const playerId of ['away-1', 'p-away']) {
      const baseline = { ...runtime.baseline, sourceId: playerId === 'p-away' ? 'workload-away' : 'native-baseline:away-1',
        playerId, personLinkSourceId: 'intake-' + playerId };
      track(openSqlitePlayerWorkloadRecoveryStore(path, links, { readAcceptedBaseline: id => id === baseline.sourceId ? baseline : null,
        readAcceptedActivity: () => null })).initialize(baseline.sourceId);
    }
    const originalBytes = () => hash({ actors: db.prepare('SELECT * FROM physical_plate_appearance_actors').all(),
      model: db.prepare('SELECT * FROM world_player_batting_models WHERE source_id=?').all(batting.source.sourceId),
      body: db.prepare('SELECT * FROM world_player_body_materializations').all(),
      participants: db.prepare('SELECT * FROM official_participant_bindings ORDER BY game_id,player_id').all() });
    const before = originalBytes(), prepared = prepareActorSpinPracticeV127({ fixture: f, batting }, stage);
    expect(prepared.qualification.contacts).toHaveLength(3);
    expect(prepared.qualification.source).toMatchObject({ careerId: 'career-a', playerId: 'away-1', personLinkSourceId: 'intake-away-1', acceptedAtDay: 9 });
    const modelReference = reference('world_player_batting_models', batting);
    const binding: SamePaSpinBindingV123 = { kind: 'fixed_native_spin_binding_v123', modelReference,
      intent: { technique: 'BACKSPIN', selectedAtTick: 100 }, qualificationReferences: [prepared.qualificationReference] };
    const read = (reader: typeof db, ownedActor = actor, fixed = binding, model = modelReference) => withSqliteReadTransaction(reader,
      () => readSamePaSpinContextV123(reader, fixed, { actor: ownedActor, modelReference: model, decisionTick: 100, effectiveRepertoire: batting.repertoire.values }));
    const admitted = read(db);
    expect(admitted).toMatchObject({ atDay: 10, repertoireSourceRef: batting.source.repertoireRef,
      techniques: [{ technique: 'BACKSPIN', qualificationRef: { sourceId: prepared.qualification.source.sourceId,
        sourceVersion: prepared.qualification.source.sourceVersion }, acceptedAtDay: 9, repertoireRef: batting.source.repertoireRef }] });
    stage('native-actor-binding-ready');
    for (const wrongActor of [
      { ...actor, binding: { ...actor.binding, playerId: 'p2' } },
      { ...actor, binding: { ...actor.binding, personId: 'different-person' } },
      { ...actor, binding: { ...actor.binding, gameDay: 8 } },
    ]) expect(() => read(db, wrongActor)).toThrow(/Player|model|qualification/);
    expect(() => read(db, actor, { ...binding, modelReference: { ...modelReference, sourceId: 'foreign-model' } })).toThrow(/model/);
    for (const pin of [{ ...prepared.qualificationReference, sourceHash: hash('wrong-source') },
      { ...prepared.qualificationReference, snapshotHash: hash('wrong-snapshot') }]) {
      expect(() => read(db, actor, { ...binding, qualificationReferences: [pin] })).toThrow(/hash/);
    }
    // A different repertoire is declared and accepted by the real model owner
    // at day9 (after the day4 practice). No original row or payload is edited.
    const otherRepertoire = { ...f.repertoire, sourceId: 'actor-spin-v127:other-repertoire', acceptedAtDay: 9 };
    f.repertoires.set(otherRepertoire.sourceId, otherRepertoire);
    const otherSource = { ...f.source, sourceId: 'actor-spin-v127:other-model', acceptedAtDay: 9,
      repertoireRef: { sourceId: otherRepertoire.sourceId, sourceVersion: otherRepertoire.sourceVersion } };
    f.models.set(otherSource.sourceId, otherSource);
    const otherModel = f.modelStore.accept(otherSource.sourceId), otherReference = reference('world_player_batting_models', otherModel);
    expect(() => read(db, actor, { ...binding, modelReference: otherReference }, otherReference)).toThrow(/repertoire/);
    expect(originalBytes()).toBe(before);
    stage('cross-scope-and-repertoire-rejected');
    f.close(); originalsClosed = true;
    reopened = new DatabaseSync(path, { readOnly: true });
    const restoredActor = withSqliteReadTransaction(reopened, () => readPhysicalActorForPlayFromSqlite(reopened!, actor.source.gameId, actor.match.playId));
    expect(restoredActor).toEqual(actor); expect(restoredActor!.defenderBindings).toHaveLength(9);
    expect(read(reopened, restoredActor!)).toEqual(admitted);
    stage('closed-reopened-native-binding-ready');
  } finally {
    reopened?.close();
    if (!originalsClosed) f.close();
  }
}, 90_000);
