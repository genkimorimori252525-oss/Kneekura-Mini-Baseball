import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { it } from 'vitest';
import { compareNativeLifecycleClaimMetadataV221, rawNativeSpinNeutralSqlDigestV193,
  type NativeLifecycleClaimMetadataCompareInputV221 } from './native-lifecycle-claim-metadata-compare-v221';

it('NCM221-S00 imports the unsampled comparison getter without opening a database', () => {
  assert.equal(typeof compareNativeLifecycleClaimMetadataV221, 'function');
});

const databasePath = process.env.BASEBALL_NATIVE_LIFECYCLE_CLAIM_METADATA_COMPARE_V221_DATABASE;
const inputPath = process.env.BASEBALL_NATIVE_LIFECYCLE_CLAIM_METADATA_COMPARE_V221_INPUT;
const outputPath = process.env.BASEBALL_NATIVE_LIFECYCLE_CLAIM_METADATA_COMPARE_V221_OUTPUT;
it.skipIf(!databasePath || !inputPath || !outputPath)('NCM221-S01 times one normal current22 getter without Inspector on an owned readonly backup', () => {
  const output = resolve(outputPath!); mkdirSync(output, { recursive: false });
  const codec = createRequire(import.meta.url)('./live-debug-record.mjs') as {
    parseDebugRecord(value: string): NativeLifecycleClaimMetadataCompareInputV221; stringifyDebugRecord(value: unknown): string;
  };
  const input = codec.parseDebugRecord(readFileSync(inputPath!, 'utf8'));
  assert(input.leg === 'OLD' || input.leg === 'NEW');
  assert(!/(?:^|\s)--inspect(?:-brk|-wait)?(?:=|\s|$)/.test([...process.execArgv, process.env.NODE_OPTIONS ?? ''].join(' ')), 'Inspector is forbidden in the comparison host');
  const save = (name: string, value: unknown) => writeFileSync(resolve(output, name), codec.stringifyDebugRecord(value) + '\n', { flag: 'wx' });
  const persist = (value: unknown) => codec.parseDebugRecord(codec.stringifyDebugRecord(value));
  const stage = (name: string) => appendFileSync(resolve(output, 'stages.jsonl'), JSON.stringify({ name, at: new Date().toISOString() }) + '\n');
  const report: { pass: boolean; [key: string]: unknown } = { pass: false, leg: input.leg, boundary: 'NATIVE_CURRENT22_CLAIM_METADATA_UNSAMPLED_COMPARISON_ONLY',
    execution: 'VITEST_ORIGINAL_SOURCE_ENTRY', normalGetterInvocations: 0, newWriterCalls: 0, newPhysicalOperationsAccepted: 0, ddlDmlExecuted: 0,
    performancePass: false, inspectorUsed: false, sqlInstrumentationAdded: false, ownerReadWarmupInvocations: 0,
    changeReason: 'OLD_NEW_SAME_CURRENT22_INPUT_ONE_TYPED_METADATA_SQL_CHANGE; V220_SAMPLING_TIME_IS_NOT_THE_OLD_BASELINE',
    cacheCondition: 'FIRST_NORMAL_GETTER_AFTER_READONLY_LOGICAL_DIGEST_NO_OWNER_READ_WARMUP',
    measurementLimit: 'SINGLE_PAIR_NOT_STATISTICAL_OR_WHOLE_MATCH_PERFORMANCE_ACCEPTANCE', privateArtifactNotForPublication: true };
  const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'));
  let db: InstanceType<typeof Native.DatabaseSync> | undefined;
  let before: ReturnType<typeof rawNativeSpinNeutralSqlDigestV193> | undefined, callerBefore: unknown, getterCalls = 0;
  let failed = false, failure: unknown; const cleanupErrors: unknown[] = [];
  const priorReport = process.report ? { directory: process.report.directory, reportOnFatalError: process.report.reportOnFatalError, excludeEnv: process.report.excludeEnv } : null;
  if (process.report) { process.report.directory = output; process.report.reportOnFatalError = true; process.report.excludeEnv = true; }
  const stamps = () => { const connection = db!; return { transaction: connection.isTransaction, queryOnly: connection.prepare('PRAGMA query_only').get()!.query_only,
    totalChanges: connection.prepare('SELECT total_changes() n').get()!.n, mainSchema: connection.prepare('PRAGMA main.schema_version').get()!.schema_version,
    tempSchema: connection.prepare('PRAGMA temp.schema_version').get()!.schema_version, mainUserVersion: connection.prepare('PRAGMA main.user_version').get()!.user_version }; };
  try {
    db = new Native.DatabaseSync(databasePath!, { readOnly: true }); db.exec('PRAGMA query_only=1; BEGIN; SAVEPOINT caller_v221');
    db.setAuthorizer(code => code === Native.constants.SQLITE_ATTACH || code === Native.constants.SQLITE_DETACH ? Native.constants.SQLITE_DENY : Native.constants.SQLITE_OK);
    callerBefore = stamps(); assert.equal(db.isTransaction, true); assert.equal(db.prepare('PRAGMA query_only').get()!.query_only, 1);
    assert.throws(() => db!.prepare("ATTACH DATABASE ':memory:' AS denied_v221"), /not authorized/);
    before = rawNativeSpinNeutralSqlDigestV193(db); save('logical-before-with-rowid.json', before); stage('readonly-digest-complete-before-single-getter');
    let current: ReturnType<typeof compareNativeLifecycleClaimMetadataV221> | undefined;
    const started = process.hrtime.bigint();
    try { getterCalls++; current = compareNativeLifecycleClaimMetadataV221(db, input.viewReference); }
    finally { report.getterElapsedMs = Number(process.hrtime.bigint() - started) / 1e6; }
    stage('single-normal-getter-complete-without-inspector'); assert.equal(getterCalls, 1);
    assert(current); save('current.lossless.json', current);
    assert.deepStrictEqual(persist(current), persist(input.expectedCurrent), 'current22 differs from accepted V217 full saved normal record');
    assert.equal(current.view.source.sourceId, 'physical-fixture:cut22:view'); assert.equal(current.view.cut.stage, 'field_active'); assert.equal(current.view.participants.length, 10);
    assert.deepStrictEqual(current.view.cut.physicalOperationReference, input.expectedPhysicalReference);
    report.savedV217FullCurrentLosslessEqual = true; report.normalCurrentReadAccepted = true; report.pass = true;
  } catch (error) { failed = true; failure = error; report.error = String((error as Error).stack ?? error); }
  finally {
    report.normalGetterInvocations = getterCalls;
    if (db) {
      try {
        if (before && callerBefore) {
          const after = rawNativeSpinNeutralSqlDigestV193(db); save('logical-after-with-rowid.json', after); assert.deepStrictEqual(after, before);
          assert.deepStrictEqual(stamps(), callerBefore); report.allRowsRowidsCatalogAndHeadsUnchanged = true; report.callerBefore = callerBefore; report.callerAfter = stamps();
          assert.throws(() => db!.prepare("ATTACH DATABASE ':memory:' AS denied_v221"), /not authorized/); report.authorizerPreserved = true;
          db.exec('ROLLBACK TO caller_v221; RELEASE caller_v221'); assert.equal(db.isTransaction, true); report.callerSavepointPreserved = true;
        }
      } catch (error) { cleanupErrors.push(error); }
      try { if (db.isTransaction) db.exec('ROLLBACK'); db.setAuthorizer(null); db.close(); } catch (error) { cleanupErrors.push(error); }
    }
    if (process.report && priorReport) Object.assign(process.report, priorReport);
    if (failed || cleanupErrors.length) report.pass = false;
    if (cleanupErrors.length) report.cleanupErrors = cleanupErrors.map(String);
    save('report.json', report);
  }
  if (cleanupErrors.length) throw new AggregateError([...(failed ? [failure] : []), ...cleanupErrors], 'V221 caller cleanup failed');
  if (failed) throw failure; assert.equal(report.pass, true);
}, 285_000);
