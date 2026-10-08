// Acceptance only. Each case needs its own admitted finite Native lane.
import type { DatabaseSync as Database } from 'node:sqlite';
import { expect,it } from 'vitest';
import { openSqliteActualFoulTerminalApplicationStore } from './SqliteActualFoulTerminalApplicationStore';
import { openSqliteActualFoulTerminalApplicationStore as openFrozenTerminalQueue } from './SqliteActualFoulTerminalLegacyOpener.test-support';
import { assertClosedTerminalSidecars } from './ActualFoulTerminalCutover.test-support';
import { rawCensus,schemaCensus,terminalSchema,terminalRows,frozenTerminalSql,acknowledgedTerminalSql,
  assertFrozenTerminalSchema,fileHash } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { withIntegrityFixture,prepareIntegrityFixture,prepareCapableQueuedCopy,closeAndCopyGenuineFixture,
  rebuildPrivateCheck,finishOwned,sourceId,requireAcknowledgement,assertNoOwnerWrites,assertAllRoutesReject,
  assertExactRetries,openIntegrityRunner,DatabaseSync } from './ActualFoulTerminalAcknowledgementIntegrity.test-support';
import type { AcknowledgementRunner } from './ActualFoulTerminalAcknowledgementWire.test-support';

it('A-S01 missing Source cannot acknowledge or invoke the shared writer',async () => withIntegrityFixture(f => {
  const before = rawCensus(f.observer),schema = schemaCensus(f.observer),missing = 'missing-terminal-source';
  requireAcknowledgement(f.runner);
  assertNoOwnerWrites(() => {
    expect(f.runner.read(missing)).toBeNull();
    expect(() => f.runner.acknowledge!(missing)).toThrow();
    expect(() => f.runner.apply(missing)).toThrow();
    const queue = openSqliteActualFoulTerminalApplicationStore(f.path); let failed = false,primary:unknown;
    try { expect(() => queue.enqueue(missing)).toThrow(); }
    catch (error) { failed = true; primary = error; throw error; }
    finally { finishOwned(failed,primary,[() => queue.close()]); }
  });
  expect(rawCensus(f.observer)).toEqual(before); expect(schemaCensus(f.observer)).toEqual(schema);
  assertExactRetries(f);
}),1_200_000);

it('A-S02 genuine QUEUED Source cannot acknowledge on the exact capable schema',async () => {
  const prepared = prepareCapableQueuedCopy(),open = await openIntegrityRunner();
  let observer:Database|undefined,runner:AcknowledgementRunner|undefined,failed = false,primary:unknown;
  try {
    observer = new DatabaseSync(prepared.path); runner = open(prepared.path); requireAcknowledgement(runner);
    const queued = runner.read(sourceId);
    if (!queued || queued.status !== 'QUEUED') throw new Error('GENUINE_QUEUED_TERMINAL_PREREQUISITE_MISSING');
    expect(queued.officialApplied).toBe(false); expect(queued.result).toBeNull();
    expect(terminalRows(observer).find(row => row.source_id === sourceId)!.result_json).toBeNull();
    const rows = rawCensus(observer),schema = schemaCensus(observer);
    assertNoOwnerWrites(() => {
      expect(() => runner!.acknowledge!(sourceId)).toThrow();
      expect(runner!.read(sourceId)).toEqual(queued);
      const queue = openSqliteActualFoulTerminalApplicationStore(prepared.path); let failed = false,primary:unknown;
      try { expect(queue.enqueue(sourceId)).toEqual(queued); }
      catch (error) { failed = true; primary = error; throw error; }
      finally { finishOwned(failed,primary,[() => queue.close()]); }
    });
    expect(rawCensus(observer)).toEqual(rows); expect(schemaCensus(observer)).toEqual(schema);
  } catch (error) { failed = true; primary = error; throw error; }
  finally { finishOwned(failed,primary,[() => runner?.close(),() => observer?.close(),
    () => expect(fileHash(prepared.producer.sourcePath)).toBe(prepared.producer.sourceSha256)]); }
},1_200_000);

it('A-S03 legacy CHECK preserves applied-null retries and refuses acknowledgement without migration',async () => withIntegrityFixture(f => {
  assertFrozenTerminalSchema(f.observer);
  const rows = rawCensus(f.observer),schema = schemaCensus(f.observer);
  expect(f.applied.result.acknowledgement).toBeNull();
  assertNoOwnerWrites(() => expect(() => f.runner.acknowledge!(sourceId)).toThrow());
  assertExactRetries(f);
  // Exercise both production openers again while preserving the exact legacy
  // CHECK. A schema predicate call alone is not credited as an opener test.
  assertNoOwnerWrites(() => {
    const reopened = f.open(f.path); let failed = false,primary:unknown;
    try { expect(reopened.read(sourceId)).toEqual(f.applied); }
    catch (error) { failed = true; primary = error; throw error; }
    finally { finishOwned(failed,primary,[() => reopened.close()]); }
  });
  assertFrozenTerminalSchema(f.observer);
  expect(rawCensus(f.observer)).toEqual(rows); expect(schemaCensus(f.observer)).toEqual(schema);
} ,'legacy-applied'),1_200_000);

it('A-S04 genuine acknowledged bytes in legacy CHECK reject every owner route',async () => withIntegrityFixture(f => {
  const copy = closeAndCopyGenuineFixture(f,'impossible-legacy-check.sqlite');
  let runner:AcknowledgementRunner|undefined,failed = false,primary:unknown;
  try {
    rebuildPrivateCheck(copy.observer,acknowledgedTerminalSql,frozenTerminalSql,true);
    assertFrozenTerminalSchema(copy.observer);
    expect(copy.observer.prepare('PRAGMA ignore_check_constraints').get()!.ignore_check_constraints).toBe(0);
    expect(terminalRows(copy.observer).find(row => row.source_id === sourceId)!.status)
      .toBe('OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY');
    const rows = rawCensus(copy.observer),schema = schemaCensus(copy.observer);
    runner = f.open(copy.path);
    assertAllRoutesReject({ path:copy.path,observer:copy.observer,runner });
    assertNoOwnerWrites(() => {
      const queue = openSqliteActualFoulTerminalApplicationStore(copy.path); let failed = false,primary:unknown;
      try { expect(() => queue.read(sourceId)).toThrow(); }
      catch (error) { failed = true; primary = error; throw error; }
      finally { finishOwned(failed,primary,[() => queue.close()]); }
    });
    expect(rawCensus(copy.observer)).toEqual(rows); expect(schemaCensus(copy.observer)).toEqual(schema);
  } catch (error) { failed = true; primary = error; throw error; }
  finally { finishOwned(failed,primary,[() => runner?.close(),() => copy.observer.close(),() => copy.assertSourcePreserved()]); }
}),1_200_000);

it('A-S05 arbitrary extra CHECK arm is refused by both production openers',async () => withIntegrityFixture(f => {
  const copy = closeAndCopyGenuineFixture(f,'arbitrary-check.sqlite');
  let failed = false,primary:unknown;
  try {
    const replacement = acknowledgedTerminalSql.replace(
      "OR (status='OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY' AND result_json IS NOT NULL)))",
      "OR (status='OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY' AND result_json IS NOT NULL) OR status='UNREVIEWED_STAGE'))");
    expect(replacement).not.toBe(acknowledgedTerminalSql);
    rebuildPrivateCheck(copy.observer,acknowledgedTerminalSql,replacement);
    const rows = rawCensus(copy.observer),schema = schemaCensus(copy.observer);
    const openers = [() => f.open(copy.path),() => openSqliteActualFoulTerminalApplicationStore(copy.path)];
    for (const open of openers) {
      assertNoOwnerWrites(() => {
        let unexpected:ReturnType<typeof open>|undefined,failed = false,primary:unknown;
        try { expect(() => { unexpected = open(); }).toThrow(/schema|constraints/); }
        catch (error) { failed = true; primary = error; throw error; }
        finally { finishOwned(failed,primary,[() => unexpected?.close()]); }
      });
      expect(rawCensus(copy.observer)).toEqual(rows); expect(schemaCensus(copy.observer)).toEqual(schema);
    }
  } catch (error) { failed = true; primary = error; throw error; }
  finally { finishOwned(failed,primary,[() => copy.observer.close(),() => copy.assertSourcePreserved()]); }
}),1_200_000);

const cutoverFaults = [
  { name:'A-S06a cutover refuses an extra terminal trigger without dropping it',
    sql:'CREATE TRIGGER acknowledgement_extra_trigger AFTER UPDATE ON actual_foul_terminal_applications BEGIN SELECT 1; END',
    object:'acknowledgement_extra_trigger',kind:'trigger' },
  { name:'A-S06b cutover refuses an extra terminal index without dropping it',
    sql:'CREATE INDEX acknowledgement_extra_index ON actual_foul_terminal_applications(status)',
    object:'acknowledgement_extra_index',kind:'index' },
];
for (const fault of cutoverFaults) it(fault.name,async () => {
  let retained:{ path:string; directory:string; rows:ReturnType<typeof rawCensus>; schema:ReturnType<typeof schemaCensus>;
    producerPath:string; producerHash:string }|undefined;
  let unexpected:Awaited<ReturnType<typeof prepareIntegrityFixture>>|undefined;
  let primary:unknown,failed = false;
  try {
    await expect((async () => {
      unexpected = await prepareIntegrityFixture('capable-applied',(prepared,db) => {
        db.exec(fault.sql);
        retained = { path:prepared.path,directory:prepared.directory,rows:rawCensus(db),schema:schemaCensus(db),
          producerPath:prepared.producer.sourcePath,producerHash:prepared.producer.sourceSha256 };
      });
    })()).rejects.toThrow();
    if (!retained) throw new Error('GENUINE_APPLIED_EXTRA_OBJECT_CUTOVER_PREREQUISITE_MISSING');
    const source = retained;
    // The freshly copied applied artifact retains the unreviewed object. The
    // controlled CHECK preparation did not silently drop or recreate it.
    for (const path of [source.path]) {
      assertClosedTerminalSidecars(path);
      const db = new DatabaseSync(path); let failed = false,primary:unknown;
      try {
        expect(rawCensus(db)).toEqual(source.rows); expect(schemaCensus(db)).toEqual(source.schema);
        expect(terminalSchema(db).installed).toContainEqual(expect.objectContaining({ name:fault.object,type:fault.kind }));
        assertFrozenTerminalSchema(db);
      } catch (error) { failed = true; primary = error; throw error; }
      finally { finishOwned(failed,primary,[() => db.close()]); }
    }
    expect(fileHash(source.producerPath)).toBe(source.producerHash);
  } catch (error) { failed = true; primary = error; throw error; }
  finally { finishOwned(failed,primary,[() => unexpected?.close()]); }
},1_200_000);

it('A-S07 frozen legacy queue opener rejects capable CHECK before its read factory',async () => withIntegrityFixture(f => {
  const rows = rawCensus(f.observer),schema = schemaCensus(f.observer);
  assertNoOwnerWrites(() => {
    let unexpected:ReturnType<typeof openFrozenTerminalQueue>|undefined,failed = false,primary:unknown;
    try { expect(() => { unexpected = openFrozenTerminalQueue(f.path); }).toThrow('foul terminal queue schema or constraints differ'); }
    catch (error) { failed = true; primary = error; throw error; }
    finally { finishOwned(failed,primary,[() => unexpected?.close()]); }
  });
  expect(rawCensus(f.observer)).toEqual(rows); expect(schemaCensus(f.observer)).toEqual(schema);
  // Only the historical entry point's executed constructor/admission/cleanup
  // path is qualified; no historical post-admission replay claim is made.
}),1_200_000);

it('A-S08 acknowledged rows cannot authenticate with official user_version 2',async () => withIntegrityFixture(f => {
  const db = f.observer,rows = rawCensus(db),schema = schemaCensus(db);
  expect(schema.userVersion).toBe(3);
  let primary:unknown,failed = false;
  try {
    expect(db.isTransaction).toBe(false); db.exec('PRAGMA main.user_version=2');
    assertAllRoutesReject(f);
    assertNoOwnerWrites(() => {
      let unexpected:AcknowledgementRunner|undefined,failed = false,primary:unknown;
      try { expect(() => { unexpected = f.open(f.path); }).toThrow(/schema|version/); }
      catch (error) { failed = true; primary = error; throw error; }
      finally { finishOwned(failed,primary,[() => unexpected?.close()]); }
    });
  } catch (error) { failed = true; primary = error; throw error; }
  finally { finishOwned(failed,primary,[() => db.exec('PRAGMA main.user_version=3'),
    () => expect(rawCensus(db)).toEqual(rows),() => expect(schemaCensus(db)).toEqual(schema)]); }
  assertExactRetries(f);
}),1_200_000);

it('A-S09 whitespace inside quoted acknowledgement status rejects both real openers',async () => withIntegrityFixture(f => {
  const copy = closeAndCopyGenuineFixture(f,'quoted-status-check.sqlite');
  let failed = false,primary:unknown;
  try {
    const canonical = "status='OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY'";
    const malformed = "status='OFFICIAL_ACKNOWLEDGED_PENDING_POST_ PLAY'";
    const replacement = acknowledgedTerminalSql.replace(canonical,malformed);
    expect(replacement).not.toBe(acknowledgedTerminalSql);
    expect(replacement).toContain(malformed); expect(replacement).not.toContain(canonical);
    const genuineRows = terminalRows(copy.observer);
    expect(genuineRows.find(row => row.source_id === sourceId)!.status).toBe('OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY');
    // Reinsert only the exact already-genuine saved row. CHECK bypass is owned
    // by the private-copy helper solely for this reinsertion and is restored
    // before any real opener runs. No fabricated success receipt is admitted.
    rebuildPrivateCheck(copy.observer,acknowledgedTerminalSql,replacement,true);
    expect(copy.observer.prepare('PRAGMA ignore_check_constraints').get()!.ignore_check_constraints).toBe(0);
    expect(terminalRows(copy.observer)).toEqual(genuineRows);
    const installedSql = String(terminalSchema(copy.observer).installed.find(row => row.type === 'table')!.sql);
    // Compare these literal bytes directly. Whitespace-stripping compaction is
    // the bug under test and cannot prove that this CHECK differs semantically.
    expect(installedSql).toContain(malformed); expect(installedSql).not.toContain(canonical);
    const rows = rawCensus(copy.observer),schema = schemaCensus(copy.observer);
    const openers = [() => f.open(copy.path),() => openSqliteActualFoulTerminalApplicationStore(copy.path)];
    for (const open of openers) {
      assertNoOwnerWrites(() => {
        const owned:{ value?:ReturnType<typeof open> } = {};
        let failed = false,primary:unknown;
        try { expect(() => { owned.value = open(); }).toThrow(/schema|constraints/); }
        catch (error) { failed = true; primary = error; throw error; }
        finally { finishOwned(failed,primary,[() => owned.value?.close()]); }
      });
      expect(rawCensus(copy.observer)).toEqual(rows); expect(schemaCensus(copy.observer)).toEqual(schema);
      expect(copy.observer.prepare('PRAGMA ignore_check_constraints').get()!.ignore_check_constraints).toBe(0);
    }
    // These are the current real openers. The historical copied predicate is
    // intentionally not repaired here or credited with rejecting this case.
  } catch (error) { failed = true; primary = error; throw error; }
  finally { finishOwned(failed,primary,[() => copy.observer.close(),() => copy.assertSourcePreserved()]); }
}),1_200_000);
