import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Session, type Debugger, type Profiler } from 'node:inspector';
import { createRequire } from 'node:module';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { it } from 'vitest';
import { readNativeLifecycleCurrentOnceV220, summarizeNativeCurrentProfileV220, rawNativeSpinNeutralSqlDigestV193,
  type NativeLifecycleCurrentProfileInputV220 } from './native-lifecycle-current-profile-v220';

it('NCP220-S00 imports the single normal getter without opening a database or starting a profiler', () => {
  assert.equal(typeof readNativeLifecycleCurrentOnceV220, 'function');
});
it('NCP220-P01 accounts raw sampled weights without promoting frame attribution to exclusive CPU or performance acceptance', () => {
  const profile: Profiler.Profile = { nodes: [{ id: 1, callFrame: { functionName: 'normalGetter', scriptId: '1', url: 'file:///declared.ts', lineNumber: 2, columnNumber: 4 } }],
    startTime: 100, endTime: 3100, samples: [1, 1], timeDeltas: [1000, 2000] };
  const summary = summarizeNativeCurrentProfileV220(profile); assert.equal(summary.sampleCount, 2); assert.equal(summary.sampledTimeMs, 3);
  assert.equal(summary.topSelfSampledFrames[0].sampledSelfTimeMs, 3); assert.equal(summary.topSelfSampledFrames[0].line, 3);
  assert.throws(() => summarizeNativeCurrentProfileV220({ ...profile, samples: [99] }));
  assert.throws(() => summarizeNativeCurrentProfileV220({ ...profile, timeDeltas: [1000, -1] }));
});

const databasePath = process.env.BASEBALL_NATIVE_LIFECYCLE_CURRENT_PROFILE_V220_DATABASE;
const inputPath = process.env.BASEBALL_NATIVE_LIFECYCLE_CURRENT_PROFILE_V220_INPUT;
const outputPath = process.env.BASEBALL_NATIVE_LIFECYCLE_CURRENT_PROFILE_V220_OUTPUT;
it.skipIf(!databasePath || !inputPath || !outputPath)('NCP220-S01 profiles exactly one normal current22 getter on an owned readonly backup', async () => {
  const output = resolve(outputPath!); mkdirSync(output, { recursive: false });
  const codec = createRequire(import.meta.url)('./live-debug-record.mjs') as {
    parseDebugRecord(value: string): NativeLifecycleCurrentProfileInputV220; stringifyDebugRecord(value: unknown): string;
  };
  const input = codec.parseDebugRecord(readFileSync(inputPath!, 'utf8'));
  const save = (name: string, value: unknown) => writeFileSync(resolve(output, name), codec.stringifyDebugRecord(value) + '\n', { flag: 'wx' });
  const persist = (value: unknown) => codec.parseDebugRecord(codec.stringifyDebugRecord(value));
  const stage = (name: string) => appendFileSync(resolve(output, 'stages.jsonl'), JSON.stringify({ name, at: new Date().toISOString() }) + '\n');
  const report: { pass: boolean; [key: string]: unknown } = { pass: false, boundary: 'NATIVE_CURRENT22_SINGLE_GETTER_CPU_PROFILE_ONLY', execution: 'VITEST_ORIGINAL_SOURCE_ENTRY',
    normalGetterInvocations: 0, newWriterCalls: 0, newPhysicalOperationsAccepted: 0, ddlDmlExecuted: 0, performancePass: false,
    changeReason: 'NEW_CURRENT22_FIELD_AND_NINE_OBSERVATIONS_GRAPH_NOT_REMEASUREMENT_OF_RESOLVED_CUT11',
    cacheCondition: 'FIRST_NORMAL_GETTER_AFTER_READONLY_LOGICAL_DIGEST_NO_OWNER_READ_WARMUP', samplingIntervalMicroseconds: 1000,
    measurementLimit: 'SAMPLING_OVERHEAD_INCLUDED_NOT_UNINSTRUMENTED_OR_WHOLE_MATCH_PERFORMANCE', privateArtifactNotForPublication: true };
  const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'));
  let db: InstanceType<typeof Native.DatabaseSync> | undefined, session: Session | undefined, profilerStarted = false;
  let before: ReturnType<typeof rawNativeSpinNeutralSqlDigestV193> | undefined, callerBefore: unknown, getterCalls = 0, profile: Profiler.Profile | undefined;
  let failed = false, failure: unknown; const cleanupErrors: unknown[] = [];
  const priorReport = process.report ? { directory: process.report.directory, reportOnFatalError: process.report.reportOnFatalError, excludeEnv: process.report.excludeEnv } : null;
  if (process.report) { process.report.directory = output; process.report.reportOnFatalError = true; process.report.excludeEnv = true; }
  const stamps = () => { const connection = db!; return { transaction: connection.isTransaction, queryOnly: connection.prepare('PRAGMA query_only').get()!.query_only,
    totalChanges: connection.prepare('SELECT total_changes() n').get()!.n, mainSchema: connection.prepare('PRAGMA main.schema_version').get()!.schema_version,
    tempSchema: connection.prepare('PRAGMA temp.schema_version').get()!.schema_version, mainUserVersion: connection.prepare('PRAGMA main.user_version').get()!.user_version }; };
  const post = <T extends object = Record<string, never>>(method: string, params: object = {}) => new Promise<T>((done, reject) =>
    session!.post(method, params, (error, value) => error ? reject(error) : done(value as T)));
  try {
    db = new Native.DatabaseSync(databasePath!, { readOnly: true }); db.exec('PRAGMA query_only=1; BEGIN; SAVEPOINT caller_v220');
    db.setAuthorizer(code => code === Native.constants.SQLITE_ATTACH || code === Native.constants.SQLITE_DETACH ? Native.constants.SQLITE_DENY : Native.constants.SQLITE_OK);
    callerBefore = stamps(); assert.equal(db.isTransaction, true); assert.equal(db.prepare('PRAGMA query_only').get()!.query_only, 1);
    assert.throws(() => db!.prepare("ATTACH DATABASE ':memory:' AS denied_v220"), /not authorized/);
    before = rawNativeSpinNeutralSqlDigestV193(db); save('logical-before-with-rowid.json', before); stage('readonly-digest-complete-before-profiler');
    session = new Session(); session.connect(); await post('Profiler.enable'); await post('Profiler.setSamplingInterval', { interval: 1000 });
    await post('Profiler.start'); profilerStarted = true;
    let current: ReturnType<typeof readNativeLifecycleCurrentOnceV220> | undefined, getterFailed = false, getterFailure: unknown;
    const started = process.hrtime.bigint();
    try { getterCalls++; current = readNativeLifecycleCurrentOnceV220(db, input.viewReference); }
    catch (error) { getterFailed = true; getterFailure = error; report.getterError = String((error as Error).stack ?? error); }
    finally {
      report.getterElapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
      const stopped = await post<{ profile: Profiler.Profile }>('Profiler.stop'); profilerStarted = false; profile = stopped.profile;
      writeFileSync(resolve(output, 'single-current22-read.cpuprofile'), JSON.stringify(profile) + '\n', { flag: 'wx' });
    }
    stage('single-getter-profile-stopped'); assert.equal(getterCalls, 1); assert(profile);
    report.cpuProfile = summarizeNativeCurrentProfileV220(profile); save('profile-summary.json', report.cpuProfile);
    // Capture the actual Vitest/V8 scripts after stop. A nonexecuted esbuild
    // closure alone cannot map this host's sampled scriptId/line positions.
    const scripts = new Map<string, Debugger.ScriptParsedEventDataType>(); session.on('Debugger.scriptParsed', event => scripts.set(event.params.scriptId, event.params));
    await post('Debugger.enable');
    const workspaceUrl = pathToFileURL(resolve(process.cwd()) + sep).href;
    const ids = [...new Set(profile.nodes.filter(node => node.callFrame.url.startsWith(workspaceUrl)).map(node => node.callFrame.scriptId))];
    assert(ids.length > 0, 'sampled workspace script identities missing'); mkdirSync(resolve(output, 'loader-sources'));
    const captured = [];
    for (const scriptId of ids) {
      assert(/^\d+$/.test(scriptId)); const parsed = scripts.get(scriptId); assert(parsed, 'sampled script was not reported by the actual V8 loader');
      const value = await post<{ scriptSource: string }>('Debugger.getScriptSource', { scriptId }); assert.equal(typeof value.scriptSource, 'string');
      const bytes = Buffer.from(value.scriptSource, 'utf8'), name = 'loader-sources/script-' + scriptId + '.js'; writeFileSync(resolve(output, name), bytes, { flag: 'wx' });
      captured.push({ scriptId, url: parsed.url, sourceMapURL: parsed.sourceMapURL ?? null, name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    }
    save('loader-source-manifest.json', { workspaceUrl, sampledWorkspaceScriptIds: ids, captured, captureAfterProfilerStop: true, debuggerEnabledDuringGetter: false });
    report.actualLoaderSourceCaptured = true; report.loaderSourceCount = captured.length; await post('Debugger.disable');
    if (getterFailed) throw getterFailure;
    assert(current); save('current.lossless.json', current);
    assert.deepStrictEqual(persist(current), persist(input.expectedCurrent), 'current22 differs from accepted V217 full saved normal record');
    assert.equal(current.view.source.sourceId, 'physical-fixture:cut22:view'); assert.equal(current.view.cut.stage, 'field_active'); assert.equal(current.view.participants.length, 10);
    assert.deepStrictEqual(current.view.cut.physicalOperationReference, input.expectedPhysicalReference);
    report.savedV217FullCurrentLosslessEqual = true; report.normalCurrentReadAccepted = true;
    report.pass = true;
  } catch (error) { failed = true; failure = error; report.error = String((error as Error).stack ?? error); }
  finally {
    report.normalGetterInvocations = getterCalls;
    if (session) {
      if (profilerStarted) try { const stopped = await post<{ profile: Profiler.Profile }>('Profiler.stop'); profilerStarted = false;
        if (!profile) writeFileSync(resolve(output, 'single-current22-read.cpuprofile'), JSON.stringify(stopped.profile) + '\n', { flag: 'wx' });
      } catch (error) { cleanupErrors.push(error); }
      try { session.disconnect(); } catch (error) { cleanupErrors.push(error); }
    }
    if (db) {
      try {
        if (before && callerBefore) {
          const after = rawNativeSpinNeutralSqlDigestV193(db); save('logical-after-with-rowid.json', after); assert.deepStrictEqual(after, before);
          assert.deepStrictEqual(stamps(), callerBefore); report.allRowsRowidsCatalogAndHeadsUnchanged = true; report.callerBefore = callerBefore; report.callerAfter = stamps();
          assert.throws(() => db!.prepare("ATTACH DATABASE ':memory:' AS denied_v220"), /not authorized/); report.authorizerPreserved = true;
          db.exec('ROLLBACK TO caller_v220; RELEASE caller_v220'); assert.equal(db.isTransaction, true); report.callerSavepointPreserved = true;
        }
      } catch (error) { cleanupErrors.push(error); }
      try { if (db.isTransaction) db.exec('ROLLBACK'); db.setAuthorizer(null); db.close(); } catch (error) { cleanupErrors.push(error); }
    }
    if (process.report && priorReport) Object.assign(process.report, priorReport);
    if (failed || cleanupErrors.length || profilerStarted) report.pass = false;
    if (cleanupErrors.length) report.cleanupErrors = cleanupErrors.map(String);
    save('report.json', report);
  }
  if (cleanupErrors.length) throw new AggregateError([...(failed ? [failure] : []), ...cleanupErrors], 'V220 profiler or caller cleanup failed');
  if (failed) throw failure; assert.equal(report.pass, true);
}, 285_000);
